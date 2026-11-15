import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { PRESETS, CATEGORIES } from './presets/index.js';
import { voxelize, measureSolid } from './sim/voxelize.js';
import { Field } from './viz/field.js';
import { Streaks } from './viz/streaks.js';
import { Slice } from './viz/slice.js';
import { VoxelView } from './viz/voxels.js';
import { lutCss } from './viz/colormaps.js';
import { loadModelFiles, ACCEPT } from './loaders.js';

const $ = (id) => document.getElementById(id);
const FAN_G0 = 0.0012; // lattice body force of a fan at 100 %
const FAN_U0 = 0.026; // free-air face speed that force produces (lattice units)
const FAN_FREE_MS = 2.5; // ...which stands for a typical 120 mm case fan (≈ 60 CFM)
const U_LATTICE = 0.06; // free-stream speed in lattice units
const NU_MIN = 0.001; // lowest stable lattice viscosity (LES handles the rest)
const DEFAULT_FIT = [1.55, 0.85, 0.85];

const state = {
  preset: null,
  speed: 120,
  fan: 1,
  yaw: 0,
  pitch: 0,
  roll: 0,
  scale: 1,
  grounded: true,
  real: 1,
  body: 'solid',
  seed: 'inlet',
  count: 6000,
  color: 'speed',
  slice: 'off',
  axis: 'z',
  slicePos: 0.5,
  ny: 48,
  running: true,
  temp: 15, // °C
  altitude: 0, // m
  turbulence: 0, // inlet turbulence intensity, %
  ground: 'belt', // 'belt' (moving ground) | 'fixed' (no-slip floor)
};

/* ───────────────────────────── renderer & scene ───────────────────────────── */

const canvas = $('view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#06080c');
scene.fog = new THREE.Fog('#06080c', 9, 22);
const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.55;

const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 80);
camera.position.set(-3.6, 2.4, 5.0);
const controls = new OrbitControls(camera, canvas);
controls.target.set(-0.25, 0.7, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 0.8;
controls.maxDistance = 14;
controls.maxPolarAngle = Math.PI * 0.497;

const sun = new THREE.DirectionalLight('#ffffff', 2.4);
sun.position.set(-2.5, 6, 3.5);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 14 });
sun.shadow.bias = -0.0004;
sun.shadow.radius = 4;
scene.add(sun, new THREE.HemisphereLight('#bcd7ff', '#0b0d12', 0.55));
const rim = new THREE.DirectionalLight('#45dcff', 0.7);
rim.position.set(4, 1.2, -4);
scene.add(rim);

const tunnel = new THREE.Group();
scene.add(tunnel);
const objectRoot = new THREE.Group();
const rotator = new THREE.Group();
rotator.rotation.order = 'YZX';
objectRoot.add(rotator);
scene.add(objectRoot);

const streaks = new Streaks();
const slice = new Slice();
const voxelView = new VoxelView();
scene.add(streaks.object, slice.object, voxelView.object);

/* ───────────────────────────── grid & tunnel ───────────────────────────── */

let grid = null;
let field = null;
let gen = 0;
let solid = { area: 0, length: 0 };
let hasFans = false;

function makeGrid(ny) {
  const nz = ny;
  const nx = ny * 2;
  const h = 2 / (ny - 2);
  const size = new THREE.Vector3((nx - 2) * h, 2, (nz - 2) * h);
  return { nx, ny, nz, h, size, origin: new THREE.Vector3(-size.x / 2 - h, -h, -size.z / 2 - h) };
}

function buildTunnel() {
  for (const c of [...tunnel.children]) {
    tunnel.remove(c);
    c.geometry?.dispose();
    c.material?.dispose();
  }
  const { size } = grid;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(size.x, size.z),
    new THREE.MeshStandardMaterial({ color: '#0a0d13', roughness: 0.82, metalness: 0.1 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  tunnel.add(floor);

  const apron = new THREE.Mesh(new THREE.CircleGeometry(30, 48), new THREE.MeshBasicMaterial({ color: '#05070a' }));
  apron.rotation.x = -Math.PI / 2;
  apron.position.y = -0.004;
  tunnel.add(apron);

  // Floor grid.
  const pts = [];
  const step = 0.25;
  for (let x = -Math.floor(size.x / 2 / step) * step; x <= size.x / 2 + 1e-6; x += step) pts.push(x, 0.002, -size.z / 2, x, 0.002, size.z / 2);
  for (let z = -size.z / 2; z <= size.z / 2 + 1e-6; z += step) pts.push(-size.x / 2, 0.002, z, size.x / 2, 0.002, z);
  const lines = new THREE.LineSegments(
    new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)),
    new THREE.LineBasicMaterial({ color: '#8fb4d9', transparent: true, opacity: 0.07 }),
  );
  tunnel.add(lines);

  // Test-section frame.
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(size.x, size.y, size.z)),
    new THREE.LineBasicMaterial({ color: '#45dcff', transparent: true, opacity: 0.22 }),
  );
  frame.position.y = size.y / 2;
  tunnel.add(frame);

  // Inlet flow straightener.
  const hc = [];
  const x0 = -size.x / 2;
  for (let i = 0; i <= 16; i++) {
    const y = (i / 16) * size.y;
    const z = -size.z / 2 + (i / 16) * size.z;
    hc.push(x0, y, -size.z / 2, x0, y, size.z / 2, x0, 0, z, x0, size.y, z);
  }
  tunnel.add(
    new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(hc, 3)),
      new THREE.LineBasicMaterial({ color: '#45dcff', transparent: true, opacity: 0.09 }),
    ),
  );

  // Flow direction chevrons on the floor.
  const chev = [];
  for (let i = 0; i < 3; i++) {
    const x = -size.x / 2 + 0.18 + i * 0.12;
    chev.push(x, 0.003, -0.1, x + 0.08, 0.003, 0, x + 0.08, 0.003, 0, x, 0.003, 0.1);
  }
  tunnel.add(
    new THREE.LineSegments(
      new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(chev, 3)),
      new THREE.LineBasicMaterial({ color: '#45dcff', transparent: true, opacity: 0.55 }),
    ),
  );
}

/* ───────────────────────────── solver worker ───────────────────────────── */

const worker = new Worker(new URL('./sim/worker.js', import.meta.url), { type: 'module' });
const smooth = { cd: null, cl: null, cs: null, sps: 0 };
const history = { cd: [], cl: [] };
let lastHistory = 0;

function setGrid(ny) {
  state.ny = ny;
  grid = makeGrid(ny);
  field = new Field(grid);
  gen++;
  worker.postMessage({ type: 'init', gen, nx: grid.nx, ny: grid.ny, nz: grid.nz });
  buildTunnel();
  const cells = grid.nx * grid.ny * grid.nz;
  $('gridNote').textContent = `${grid.nx} × ${grid.ny} × ${grid.nz} lattice · ${(cells / 1000).toFixed(0)}k cells · D3Q19 LBM + LES`;
}

/** Air properties from temperature and altitude (ISA pressure, Sutherland viscosity). */
function air() {
  const T = state.temp + 273.15;
  const p = 101325 * Math.pow(1 - 2.25577e-5 * state.altitude, 5.25588);
  const rho = p / (287.05 * T);
  const mu = (1.716e-5 * Math.pow(T / 273.15, 1.5) * (273.15 + 110.4)) / (T + 110.4);
  return { rho, mu, nu: mu / rho, a: Math.sqrt(1.4 * 287.05 * T), p };
}

function uScale() {
  if (state.speed > 0) return Math.max(0.012, flowParams().U);
  return hasFans ? FAN_U0 * 1.3 * Math.max(0.3, state.fan) : U_LATTICE;
}

/** Metres per second represented by one lattice velocity unit. */
function velScale() {
  if (state.speed > 0) return state.speed / 3.6 / flowParams().U;
  return FAN_FREE_MS / FAN_U0;
}

function metresPerWorld() {
  return state.real / Math.max(1e-6, model.maxDim * model.baseScale * state.scale);
}

function flowParams() {
  const U = U_LATTICE * Math.min(1, state.speed / 12);
  const lengthM = Math.max(1, solid.length) * grid.h * metresPerWorld();
  const reReal = ((state.speed / 3.6) * lengthM) / air().nu;
  const nu = reReal > 0 ? THREE.MathUtils.clamp((U * Math.max(1, solid.length)) / reReal, NU_MIN, 0.05) : 0.004;
  return { U, tau0: 0.5 + 3 * nu, nu, reReal, reSim: (U * Math.max(1, solid.length)) / nu };
}

function pushParams() {
  const p = flowParams();
  // Fan force is set so its free-air face speed is FAN_FREE_MS × power in real
  // units: in a 200 km/h gale a case fan barely registers, as it should.
  const face = (state.fan * FAN_FREE_MS) / velScale();
  const fanK = hasFans ? Math.min(0.004, FAN_G0 * (face / FAN_U0) ** 2) : 0;
  worker.postMessage({
    type: 'params',
    params: { U: p.U, tau0: p.tau0, fanK, running: state.running, noSlipFloor: state.ground === 'fixed', turbulence: state.turbulence / 100 },
  });
  streaks.speed = state.speed > 0 ? 0.55 + 0.75 * Math.sqrt(Math.min(1, state.speed / 300)) : 0.8;
  streaks.material.uniforms.speedFade.value = state.speed > 0 ? 0 : 1;
  $('sRe').textContent = p.reReal > 0 ? fmtSci(p.reReal) : '—';
  $('sReSim').textContent = p.reReal > 0 ? `simulated at ${fmtSci(p.reSim)}` : 'fan-driven flow';
  updateStaticData();
  updateLegend();
}

let lastScan = 0;
worker.onmessage = (e) => {
  const m = e.data;
  if (m.type !== 'field' || m.gen !== gen) return;
  if (field.data) worker.postMessage({ type: 'recycle', data: field.data }, [field.data.buffer]);
  field.data = m.data;
  field.rhoRef = m.rhoRef;
  field.U = m.U;
  field.steps = m.steps;
  const us = uScale();
  slice.update(field, us);
  voxelView.update(field, us);
  updateTelemetry(m);
  const now = performance.now();
  if (now - lastScan > 450) {
    lastScan = now;
    scanField();
  }
};

const fmt = (v, d = 2) => (Number.isFinite(v) ? (Math.abs(v) >= 1000 ? v.toFixed(0) : Math.abs(v) >= 100 ? v.toFixed(Math.max(0, d - 2)) : Math.abs(v) >= 10 ? v.toFixed(Math.max(0, d - 1)) : v.toFixed(d)) : '—');
const fmtForce = (n) => {
  const a = Math.abs(n);
  return a >= 1000 ? `${fmt(n / 1000)} kN` : a >= 1 ? `${fmt(n)} N` : `${fmt(n * 1000)} mN`;
};
const fmtPa = (p) => (Math.abs(p) >= 1000 ? `${fmt(p / 1000)} kPa` : `${fmt(p, 1)} Pa`);

/** Frontal area (m²) and free-stream dynamic pressure (Pa) in real units. */
function realRef() {
  const mpw = metresPerWorld();
  const v = state.speed / 3.6;
  const area = solid.area * grid.h * grid.h * mpw * mpw;
  return { v, area, q: 0.5 * air().rho * v * v, mpw };
}

/** Seconds of real time one solver step represents. */
const stepSeconds = () => (grid.h * metresPerWorld()) / velScale();

function updateStaticData() {
  const A = air();
  const { v, area, q } = realRef();
  $('dQ').textContent = v > 0 ? fmtPa(q) : '—';
  $('dMach').textContent = v > 0 ? (v / A.a).toFixed(3) : '—';
  $('dArea').textContent = area >= 0.01 ? `${fmt(area)} m²` : `${fmt(area * 1e4, 1)} cm²`;
  $('dBlock').textContent = `${((solid.area / ((grid.ny - 2) * (grid.nz - 2))) * 100).toFixed(1)} %`;
  $('dRho').textContent = `${A.rho.toFixed(3)} kg/m³`;
  $('dNu').textContent = `${(A.nu * 1e5).toFixed(2)}×10⁻⁵ m²/s`;
  $('dRef').textContent = state.preset?.ref ?? '—';
  $('machWarn').hidden = !(v / A.a > 0.3);
}

const clTrace = [];
function updateTelemetry(m) {
  smooth.sps += (m.sps - smooth.sps) * 0.2;
  $('sSps').textContent = smooth.sps > 0 ? smooth.sps.toFixed(0) : '—';
  const t = m.steps * stepSeconds();
  $('dTime').textContent = t >= 1 ? `${fmt(t)} s` : `${fmt(t * 1000, 1)} ms`;
  const windy = state.speed > 0 && m.U > 0.004 && solid.area > 0;
  if (!windy) {
    for (const id of ['sCd', 'sCl', 'sDrag', 'sLift', 'sPower', 'dCs', 'dCdA', 'dSide']) $(id).textContent = '—';
    return;
  }
  // Solid-blockage correction: the body squeezes the stream, so the air
  // passing it is faster than the nominal tunnel speed.
  const blockage = solid.area / ((grid.ny - 2) * (grid.nz - 2));
  const qL = (0.5 * m.U * m.U * solid.area) / (1 - blockage) ** 2;
  const cd = m.force[0] / qL;
  const cl = m.force[1] / qL;
  const cs = m.force[2] / qL;
  if (!Number.isFinite(cd) || !Number.isFinite(cl)) return;
  // The impulsive start sends pressure waves through the tunnel; wait for
  // them to wash out before trusting the balance.
  if (m.steps < settleSteps()) {
    for (const id of ['sCd', 'sCl', 'sDrag', 'sLift', 'sPower']) $(id).textContent = '…';
    smooth.cd = smooth.cl = smooth.cs = null;
    clTrace.length = 0;
    return;
  }
  const mix = (old, v) => (old === null || old === undefined ? v : old + (v - old) * 0.06);
  smooth.cd = mix(smooth.cd, cd);
  smooth.cl = mix(smooth.cl, cl);
  smooth.cs = mix(smooth.cs, cs);
  clTrace.push(m.steps, cl);
  if (clTrace.length > 1200) clTrace.splice(0, 2);

  const { v, area, q } = realRef();
  const drag = smooth.cd * q * area;
  const lift = smooth.cl * q * area;
  const side = smooth.cs * q * area;
  $('sCd').textContent = smooth.cd.toFixed(2);
  $('sCl').textContent = smooth.cl.toFixed(2);
  setForce('sDrag', 'uDrag', drag);
  setForce('sLift', 'uLift', Math.abs(lift));
  $('lLiftF').textContent = smooth.cl < 0 ? 'Downforce' : 'Lift';
  const watts = drag * v;
  $('sPower').textContent = Math.abs(watts) >= 1000 ? fmt(watts / 1000) : fmt(watts, 1);
  $('uPower').textContent = Math.abs(watts) >= 1000 ? `kW · ${fmt(watts / 745.7, 1)} hp` : 'W';
  $('dCs').textContent = smooth.cs.toFixed(3);
  $('dCdA').textContent = `${fmt(smooth.cd * area, 3)} m²`;
  $('dSide').textContent = fmtForce(side);

  const now = performance.now();
  if (now - lastHistory > 90) {
    lastHistory = now;
    history.cd.push(smooth.cd);
    history.cl.push(smooth.cl);
    if (history.cd.length > 260) {
      history.cd.shift();
      history.cl.shift();
    }
    if (log.length < 20000) log.push([t, m.steps, smooth.cd, smooth.cl, smooth.cs, drag, lift, side]);
    drawSpark();
  }
}

/* Periodic pass over the whole field for extremes, surface loads and fan flow. */
let surfaceProbe = new Int32Array(0);
let fans = [];
const log = [];

function buildSurfaceProbe() {
  const { nx, ny, nz } = grid;
  const f = field.flag;
  const nxy = nx * ny;
  const out = [];
  for (let z = 1; z < nz - 1; z++)
    for (let y = 1; y < ny - 1; y++)
      for (let x = 1; x < nx - 1; x++) {
        const c = x + nx * (y + ny * z);
        if (f[c] === 1) continue;
        if (f[c + 1] === 1 || f[c - 1] === 1 || f[c + nx] === 1 || f[c - nx] === 1 || f[c + nxy] === 1 || f[c - nxy] === 1) out.push(c);
      }
  surfaceProbe = Int32Array.from(out);
}

function scanField() {
  if (!field.ready) return;
  const { N, data, flag } = field;
  const C = velScale();
  const A = air();
  let peak = 0;
  for (let c = 0; c < N; c++) {
    if (flag[c] === 1) continue;
    const s = data[c] * data[c] + data[N + c] * data[N + c] + data[2 * N + c] * data[2 * N + c];
    if (s > peak) peak = s;
  }
  const peakMs = Math.sqrt(peak) * C;
  $('dPeak').textContent = `${fmt(peakMs, 1)} m/s · ${fmt(peakMs * 3.6, 1)} km/h`;

  // Surface pressure extremes (gauge), with Cp when there is a free stream.
  let lo = Infinity;
  let hi = -Infinity;
  for (let k = 0; k < surfaceProbe.length; k++) {
    const r = data[3 * N + surfaceProbe[k]];
    if (r < lo) lo = r;
    if (r > hi) hi = r;
  }
  const settled = (field.steps ?? 0) >= settleSteps();
  if (surfaceProbe.length && settled) {
    const toPa = (r) => ((r - field.rhoRef) / 3) * A.rho * C * C;
    const q = realRef().q;
    const cp = (r) => (state.speed > 0 && q > 0 ? ` (Cp ${(toPa(r) / q).toFixed(2)})` : '');
    $('dCpMax').textContent = `${fmtPa(toPa(hi))}${cp(hi)}`;
    $('dCpMin').textContent = `${fmtPa(toPa(lo))}${cp(lo)}`;
  } else $('dCpMax').textContent = $('dCpMin').textContent = settled ? '—' : '…';

  // Fan throughput: mean face velocity × swept area.
  $('fanData').hidden = !fans.length;
  if (fans.length) {
    const mpw = metresPerWorld();
    let total = 0;
    let free = 0;
    for (const f of fans) {
      let un = 0;
      for (const c of f.cells) un += data[c] * f.dir[0] + data[N + c] * f.dir[1] + data[2 * N + c] * f.dir[2];
      const areaM2 = f.area * mpw * mpw;
      total += Math.abs(un / f.cells.length) * C * areaM2;
      free += FAN_FREE_MS * state.fan * f.strength ** 0.5 * areaM2;
    }
    const m3h = total * 3600;
    $('dFan').textContent = `${fmt(m3h, 1)} m³/h · ${fmt(m3h / 1.699, 1)} CFM`;
    $('dFanN').textContent = `(sum of ${fans.length})`;
    $('dFanEff').textContent = free > 0 && state.speed === 0 ? `${Math.round((total / free) * 100)} % of free-air rating` : '—';
  }

  // Vortex-shedding frequency from the lift trace (upward mean crossings).
  let shed = '—';
  const n = clTrace.length / 2;
  if (n > 80 && state.speed > 0) {
    let mean = 0;
    for (let i = 0; i < n; i++) mean += clTrace[i * 2 + 1] / n;
    let sd = 0;
    for (let i = 0; i < n; i++) sd += (clTrace[i * 2 + 1] - mean) ** 2 / n;
    sd = Math.sqrt(sd);
    const cross = [];
    let below = false;
    for (let i = 0; i < n; i++) {
      const d = clTrace[i * 2 + 1] - mean;
      if (d < -0.3 * sd) below = true;
      else if (below && d > 0.3 * sd) {
        cross.push(clTrace[i * 2]);
        below = false;
      }
    }
    // Only report a frequency when the oscillation is strong and regular.
    const gaps = cross.slice(1).map((c, i) => c - cross[i]);
    const gMean = gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length);
    const gSd = Math.sqrt(gaps.reduce((a, b) => a + (b - gMean) ** 2, 0) / Math.max(1, gaps.length));
    if (sd > 0.03 && cross.length >= 5 && gSd / gMean < 0.25) {
      const period = gMean * stepSeconds();
      const f = 1 / period;
      const D = (model.bbox.max.y - model.bbox.min.y) * metresPerWorld();
      shed = `${f >= 100 ? f.toFixed(0) : f.toFixed(1)} Hz · St ${((f * D) / (state.speed / 3.6)).toFixed(2)}`;
    }
  }
  $('dShed').textContent = shed;
}

function exportCsv() {
  const A = air();
  const p = flowParams();
  const head = [
    `# Zephyr wind tunnel export`,
    `# subject,${state.preset?.name ?? ''}`,
    `# wind_speed_kmh,${state.speed}`,
    `# real_size_m,${state.real}`,
    `# yaw_deg,${state.yaw}`,
    `# pitch_deg,${state.pitch}`,
    `# roll_deg,${state.roll}`,
    `# air_temperature_C,${state.temp}`,
    `# altitude_m,${state.altitude}`,
    `# air_density_kg_m3,${A.rho.toFixed(4)}`,
    `# inlet_turbulence_pct,${state.turbulence}`,
    `# ground,${state.ground}`,
    `# frontal_area_m2,${realRef().area.toPrecision(5)}`,
    `# reynolds_real,${p.reReal.toExponential(3)}`,
    `# reynolds_simulated,${p.reSim.toExponential(3)}`,
    `# lattice,${grid.nx}x${grid.ny}x${grid.nz}`,
    'time_s,step,cd,cl,cs,drag_N,lift_N,side_N',
  ];
  const rows = log.map((r) => r.map((v, i) => (i === 1 ? v : Number(v).toPrecision(6))).join(','));
  const blob = new Blob([[...head, ...rows].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `zephyr-${state.preset?.id ?? 'run'}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  toast(rows.length ? `Exported ${rows.length} samples` : 'Exported setup only: no force samples yet');
}

const settleSteps = () => Math.round(grid.nx * 3.5);

function setForce(valueId, unitId, newtons) {
  const a = Math.abs(newtons);
  const [val, unit] = a >= 1000 ? [newtons / 1000, 'kN'] : a >= 1 ? [newtons, 'N'] : [newtons * 1000, 'mN'];
  $(valueId).textContent = Math.abs(val) >= 100 ? val.toFixed(0) : Math.abs(val) >= 10 ? val.toFixed(1) : val.toFixed(2);
  $(unitId).textContent = unit;
}

function fmtSci(v) {
  if (v < 1000) return v.toFixed(0);
  const e = Math.floor(Math.log10(v));
  return `${(v / 10 ** e).toFixed(1)}×10${String(e).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d])}`;
}

const spark = $('spark');
function drawSpark() {
  const ctx = spark.getContext('2d');
  const W = spark.width;
  const H = spark.height;
  ctx.clearRect(0, 0, W, H);
  const all = [...history.cd, ...history.cl, 0];
  let lo = Math.min(...all);
  let hi = Math.max(...all);
  const pad = Math.max(0.05, (hi - lo) * 0.15);
  lo -= pad;
  hi += pad;
  const y = (v) => H - ((v - lo) / (hi - lo)) * H;
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 4]);
  ctx.beginPath();
  ctx.moveTo(0, y(0));
  ctx.lineTo(W, y(0));
  ctx.stroke();
  ctx.setLineDash([]);
  for (const [arr, col] of [[history.cl, '#ff8a4c'], [history.cd, '#45dcff']]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    arr.forEach((v, i) => {
      const x = W - (arr.length - 1 - i) * (W / 259);
      i ? ctx.lineTo(x, y(v)) : ctx.moveTo(x, y(v));
    });
    ctx.stroke();
  }
}

/* ───────────────────────────── subject (model) ───────────────────────────── */

const model = { object: null, keep: false, center: new THREE.Vector3(), maxDim: 1, baseScale: 1, spinners: [], bbox: new THREE.Box3() };
const ghostMat = new THREE.MeshPhysicalMaterial({ color: '#9fd8ff', transparent: true, opacity: 0.13, roughness: 0.2, depthWrite: false, side: THREE.DoubleSide });

function disposeTree(obj) {
  obj.traverse((o) => {
    o.geometry?.dispose();
    const mats = o.userData.origMat ?? o.material;
    for (const m of Array.isArray(mats) ? mats : mats ? [mats] : []) {
      for (const v of Object.values(m)) if (v && v.isTexture) v.dispose();
      m.dispose();
    }
  });
}

function setSubject(preset) {
  if (model.object) {
    rotator.remove(model.object);
    if (!model.keep) disposeTree(model.object);
  }
  state.preset = preset;
  const obj = preset.build();
  model.object = obj;
  model.keep = !!preset.keep;
  obj.position.set(0, 0, 0);
  obj.scale.setScalar(1);
  obj.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(obj, true);
  const size = box.getSize(new THREE.Vector3());
  box.getCenter(model.center);
  obj.position.copy(model.center).negate();
  const fit = preset.fit ?? DEFAULT_FIT;
  model.maxDim = Math.max(size.x, size.y, size.z) || 1;
  model.baseScale = Math.min(fit[0] / (size.x || 1e-6), fit[1] / (size.y || 1e-6), fit[2] / (size.z || 1e-6));
  model.spinners = [];
  obj.traverse((o) => o.userData.spin && model.spinners.push(o));
  rotator.add(obj);

  Object.assign(state, {
    speed: preset.speed ?? 100,
    yaw: 0,
    pitch: preset.pitch ?? 0,
    roll: 0,
    scale: 1,
    grounded: !!preset.grounded,
    real: preset.real ?? 1,
    seed: preset.seed ?? 'inlet',
    fan: 1,
  });
  state.slice = preset.slice ? 'speed' : 'off';
  applyBodyMode();
  syncUi();
  rebuildSubject(true);
  smooth.cd = smooth.cl = smooth.cs = null;
  history.cd.length = history.cl.length = 0;
  log.length = clTrace.length = 0;
  drawSpark();
  $('subjectName').textContent = preset.name;
  $('subjectDesc').textContent = preset.desc ?? '';
  document.querySelectorAll('.card').forEach((c) => c.classList.toggle('on', c.dataset.id === preset.id));
}

function layoutSubject() {
  const d2r = Math.PI / 180;
  rotator.rotation.set(state.roll * d2r, state.yaw * d2r, -state.pitch * d2r);
  rotator.scale.setScalar(model.baseScale * state.scale);
  objectRoot.position.set(-grid.size.x / 2 + grid.size.x * 0.33, 0, 0);
  objectRoot.updateMatrixWorld(true);
  const box = model.bbox.setFromObject(objectRoot, true);
  objectRoot.position.y = state.grounded ? -box.min.y : 1 - (box.min.y + box.max.y) / 2;
  objectRoot.updateMatrixWorld(true);
  box.setFromObject(objectRoot, true);
}

function rebuildSubject(reset = false) {
  layoutSubject();
  const res = voxelize(objectRoot, grid);
  field.flag = res.flag;
  solid = measureSolid(res.flag, grid.nx, grid.ny, grid.nz);
  hasFans = res.fanIdx.length > 0;
  fans = res.fans;
  buildSurfaceProbe();
  $('fanRow').hidden = !hasFans;
  worker.postMessage({ type: 'geometry', gen, flag: res.flag, fanIdx: res.fanIdx, fanVec: res.fanVec, reset });
  pushParams();
  if (state.body === 'voxels') voxelView.rebuild(field);
  voxelDirty = state.body !== 'voxels';
  updateSeedBounds();
}

let voxelDirty = true;
let rebuildTimer = 0;
function scheduleRebuild() {
  layoutSubject();
  clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(() => rebuildSubject(false), 140);
}

function updateSeedBounds() {
  const b = model.bbox;
  const { size } = grid;
  const my = 0.3 * (b.max.y - b.min.y) + 0.12;
  const mz = 0.3 * (b.max.z - b.min.z) + 0.12;
  const eps = grid.h * 0.6;
  const inlet = {
    x: -size.x / 2 + eps,
    x1: size.x / 2 - eps,
    y0: Math.max(eps, b.min.y - my),
    y1: Math.min(size.y - eps, b.max.y + my),
    z0: Math.max(-size.z / 2 + eps, b.min.z - mz),
    z1: Math.min(size.z / 2 - eps, b.max.z + mz),
  };
  const volume = new THREE.Box3(
    new THREE.Vector3(Math.max(-size.x / 2 + eps, b.min.x - 0.45), Math.max(eps, b.min.y - 0.15), Math.max(-size.z / 2 + eps, b.min.z - 0.35)),
    new THREE.Vector3(Math.min(size.x / 2 - eps, b.max.x + 0.9), Math.min(size.y - eps, b.max.y + 0.5), Math.min(size.z / 2 - eps, b.max.z + 0.35)),
  );
  streaks.setBounds(inlet, volume);
}

function applyBodyMode() {
  const obj = model.object;
  if (!obj) return;
  const ghost = state.body === 'ghost';
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const hiddenMat = !Array.isArray(o.material) && o.material.visible === false && !o.userData.origMat;
    if (hiddenMat) return;
    if (ghost && !o.userData.origMat) {
      o.userData.origMat = o.material;
      o.material = ghostMat;
      o.castShadow = false;
    } else if (!ghost && o.userData.origMat) {
      o.material = o.userData.origMat;
      delete o.userData.origMat;
      o.castShadow = true;
    }
  });
  objectRoot.visible = state.body !== 'voxels';
  voxelView.object.visible = state.body === 'voxels';
  if (state.body === 'voxels' && voxelDirty && field) {
    voxelView.rebuild(field);
    voxelDirty = false;
    voxelView.update(field, uScale());
  }
  updateLegend();
}

/* ───────────────────────────── UI ───────────────────────────── */

function bindRange(id, outId, fmt, apply) {
  const el = $(id);
  const out = $(outId);
  const show = () => (out.textContent = fmt(+el.value));
  el.addEventListener('input', () => {
    apply(+el.value);
    show();
  });
  return { set: (v) => { el.value = v; show(); } };
}

function bindSeg(id, apply) {
  const el = $(id);
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    set(b.dataset.v);
    apply(b.dataset.v);
  });
  const set = (v) => el.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b.dataset.v === String(v)));
  return { set };
}

const ui = {
  speed: bindRange('speed', 'oSpeed', (v) => (v ? `${v} km/h · ${(v / 3.6).toFixed(1)} m/s` : 'still air'), (v) => { state.speed = v; pushParams(); }),
  fan: bindRange('fan', 'oFan', (v) => `${v}%`, (v) => { state.fan = v / 100; pushParams(); }),
  temp: bindRange('temp', 'oTemp', (v) => `${v} °C`, (v) => { state.temp = v; pushParams(); }),
  altitude: bindRange('altitude', 'oAlt', (v) => `${v} m`, (v) => { state.altitude = v; pushParams(); }),
  turbulence: bindRange('turbulence', 'oTurb', (v) => (v ? `${v} %` : 'smooth'), (v) => { state.turbulence = v; pushParams(); }),
  ground: bindSeg('segGround', (v) => { state.ground = v; pushParams(); }),
  yaw: bindRange('yaw', 'oYaw', (v) => `${v}°`, (v) => { state.yaw = v; scheduleRebuild(); }),
  pitch: bindRange('pitch', 'oPitch', (v) => `${v}°`, (v) => { state.pitch = v; scheduleRebuild(); }),
  roll: bindRange('roll', 'oRoll', (v) => `${v}°`, (v) => { state.roll = v; scheduleRebuild(); }),
  scale: bindRange('scale', 'oScale', (v) => `${v}%`, (v) => { state.scale = v / 100; scheduleRebuild(); }),
  count: bindRange('count', 'oCount', (v) => `${(v / 1000).toFixed(1)}k`, (v) => { state.count = v; streaks.setCount(v); applySmokeOpacity(); }),
  slicePos: bindRange('slicePos', 'oSlicePos', (v) => `${v}%`, (v) => { state.slicePos = v / 100; applySlice(); }),
  body: bindSeg('segBody', (v) => { state.body = v; applyBodyMode(); }),
  seed: bindSeg('segSeed', (v) => { state.seed = v; applySeed(); }),
  color: bindSeg('segColor', (v) => { state.color = v; streaks.setColorBy(v); updateLegend(); }),
  slice: bindSeg('segSlice', (v) => { state.slice = v; applySlice(); }),
  axis: bindSeg('segAxis', (v) => { state.axis = v; applySlice(); }),
  quality: bindSeg('segQuality', (v) => {
    setGrid(+v);
    rebuildSubject(true);
    applySlice();
  }),
};

$('grounded').addEventListener('change', (e) => {
  state.grounded = e.target.checked;
  scheduleRebuild();
});
$('real').addEventListener('change', (e) => {
  const v = parseFloat(e.target.value);
  if (v > 0) {
    state.real = v;
    pushParams();
  } else e.target.value = state.real;
});

function applySeed() {
  streaks.object.visible = state.seed !== 'off';
  applySmokeOpacity();
  if (state.seed !== 'off') {
    streaks.mode = state.seed;
    streaks.respawnAll();
  }
  updateLegend();
}

function applySmokeOpacity() {
  const dense = Math.sqrt(6000 / Math.max(1000, state.count));
  const volume = state.seed === 'volume' ? 2.2 : 1;
  streaks.material.uniforms.opacity.value = Math.min(0.9, 0.26 * dense * volume * (state.slice !== 'off' ? 0.5 : 1));
}

function applySlice() {
  applySmokeOpacity();
  slice.object.visible = state.slice !== 'off';
  if (state.slice !== 'off') slice.quantity = state.slice;
  slice.axis = state.axis;
  slice.t = state.slicePos;
  if (field) slice.update(field, uScale());
  updateLegend();
}

function syncUi() {
  ui.speed.set(state.speed);
  ui.fan.set(Math.round(state.fan * 100));
  ui.temp.set(state.temp);
  ui.altitude.set(state.altitude);
  ui.turbulence.set(state.turbulence);
  ui.ground.set(state.ground);
  ui.yaw.set(state.yaw);
  ui.pitch.set(state.pitch);
  ui.roll.set(state.roll);
  ui.scale.set(Math.round(state.scale * 100));
  ui.count.set(state.count);
  ui.slicePos.set(Math.round(state.slicePos * 100));
  ui.seed.set(state.seed);
  ui.slice.set(state.slice);
  $('grounded').checked = state.grounded;
  $('real').value = state.real;
  applySeed();
  applySlice();
}

function updateLegend() {
  const sliceOn = state.slice !== 'off';
  const q = sliceOn ? state.slice : state.body === 'voxels' && state.seed === 'off' ? 'pressure' : state.color;
  $('legend').style.display = !sliceOn && state.seed === 'off' && state.body !== 'voxels' ? 'none' : '';
  $('legendBar').style.background = lutCss(q);
  if (q === 'speed') {
    const top = 1.7 * uScale() * velScale();
    const u = state.speed > 0 ? [3.6, 'km/h'] : [1, 'm/s'];
    $('legendTitle').textContent = 'Air speed';
    $('legendMin').textContent = '0';
    $('legendMid').textContent = fmt(top * u[0] * 0.5, 1);
    $('legendMax').textContent = `${fmt(top * u[0], 1)} ${u[1]}`;
  } else if (q === 'pressure') {
    $('legendTitle').textContent = 'Pressure coefficient';
    $('legendMin').textContent = '−1.25 suction';
    $('legendMid').textContent = '0';
    $('legendMax').textContent = '+1.25';
  } else {
    $('legendTitle').textContent = 'Vorticity';
    $('legendMin').textContent = 'calm';
    $('legendMid').textContent = '';
    $('legendMax').textContent = 'swirling';
  }
}

/* gallery */
const customPresets = [];
let activeCat = 'All';
const thumbs = new Map();

function renderChips() {
  const cats = [...CATEGORIES, ...(customPresets.length ? ['Imported'] : [])];
  $('chips').replaceChildren(
    ...cats.map((c) => {
      const b = document.createElement('button');
      b.textContent = c;
      b.className = c === activeCat ? 'on' : '';
      b.onclick = () => {
        activeCat = c;
        renderChips();
        renderGallery();
      };
      return b;
    }),
  );
}

function renderGallery() {
  const q = $('search').value.trim().toLowerCase();
  const list = [...customPresets, ...PRESETS].filter(
    (p) => (activeCat === 'All' || p.cat === activeCat) && (!q || `${p.name} ${p.desc} ${p.cat}`.toLowerCase().includes(q)),
  );
  const nodes = list.map((p) => {
    const b = document.createElement('button');
    b.className = `card${state.preset?.id === p.id ? ' on' : ''}`;
    b.dataset.id = p.id;
    b.title = p.desc ?? p.name;
    const thumb = document.createElement('span');
    thumb.className = 'thumb';
    if (thumbs.has(p.id)) {
      const img = new Image();
      img.src = thumbs.get(p.id);
      img.alt = '';
      thumb.append(img);
    }
    const name = document.createElement('span');
    name.className = 'name';
    name.textContent = p.name;
    b.append(thumb, name);
    if (p.cat === 'Imported') {
      const tag = document.createElement('span');
      tag.className = 'tag';
      tag.textContent = 'yours';
      b.append(tag);
    }
    b.onclick = () => {
      setSubject(p);
      closePanels();
    };
    return b;
  });
  if (!nodes.length) {
    const e = document.createElement('div');
    e.className = 'empty';
    e.textContent = 'No matches';
    nodes.push(e);
  }
  $('gallery').replaceChildren(...nodes);
}
$('search').addEventListener('input', renderGallery);

/* thumbnails: rendered once with a small offscreen renderer */
let thumbKit = null;
function renderThumb(preset) {
  if (!thumbKit) {
    const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    r.setSize(240, 165);
    r.toneMapping = THREE.ACESFilmicToneMapping;
    const s = new THREE.Scene();
    s.environment = new THREE.PMREMGenerator(r).fromScene(new RoomEnvironment(), 0.04).texture;
    const key = new THREE.DirectionalLight('#fff', 2.2);
    key.position.set(-2, 4, 3);
    s.add(key);
    thumbKit = { r, s, cam: new THREE.PerspectiveCamera(30, 240 / 165, 0.01, 1000) };
  }
  const { r, s, cam } = thumbKit;
  const obj = preset.build();
  s.add(obj);
  const box = new THREE.Box3().setFromObject(obj, true);
  const sphere = box.getBoundingSphere(new THREE.Sphere());
  const d = sphere.radius / Math.sin((cam.fov * Math.PI) / 360) * 0.92;
  cam.position.copy(sphere.center).add(new THREE.Vector3(-0.62, 0.42, 0.66).normalize().multiplyScalar(d));
  cam.near = d / 50;
  cam.far = d * 4;
  cam.updateProjectionMatrix();
  cam.lookAt(sphere.center);
  r.render(s, cam);
  const url = r.domElement.toDataURL('image/png');
  s.remove(obj);
  if (!preset.keep) disposeTree(obj);
  return url;
}

function generateThumbs() {
  const queue = [...PRESETS];
  const next = () => {
    const p = queue.shift();
    if (!p) return;
    try {
      thumbs.set(p.id, renderThumb(p));
      const card = document.querySelector(`.card[data-id="${p.id}"] .thumb`);
      if (card && !card.firstChild) {
        const img = new Image();
        img.src = thumbs.get(p.id);
        img.alt = '';
        card.append(img);
      }
    } catch (err) {
      console.warn('thumbnail failed', p.id, err);
    }
    setTimeout(next, 30);
  };
  setTimeout(next, 400);
}

/* import */
let toastTimer = 0;
function toast(msg, err = false) {
  const t = $('toast');
  t.textContent = msg;
  t.className = `toast show${err ? ' err' : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.className = 'toast'), err ? 5200 : 2800);
}

async function importFiles(files) {
  if (!files?.length) return;
  toast('Loading model…');
  try {
    const { object, name, triangles } = await loadModelFiles(files);
    const preset = {
      id: `custom-${Date.now()}`,
      name,
      cat: 'Imported',
      desc: `Imported model · ${triangles.toLocaleString()} triangles`,
      real: 1,
      speed: 100,
      grounded: true,
      keep: true,
      build: () => object.clone(true),
    };
    customPresets.unshift(preset);
    try {
      thumbs.set(preset.id, renderThumb(preset));
    } catch {}
    activeCat = 'Imported';
    renderChips();
    setSubject(preset);
    renderGallery();
    toast(`${name} is in the tunnel. Set its real size under Subject for accurate forces.`);
  } catch (err) {
    console.error(err);
    toast(err.message || 'Could not load that model.', true);
  }
}

$('file').accept = ACCEPT;
$('file').addEventListener('change', (e) => {
  importFiles(e.target.files);
  e.target.value = '';
});
let dragDepth = 0;
window.addEventListener('dragenter', (e) => {
  if (![...(e.dataTransfer?.types ?? [])].includes('Files')) return;
  dragDepth++;
  $('dropveil').classList.add('show');
});
window.addEventListener('dragleave', () => {
  if (--dragDepth <= 0) {
    dragDepth = 0;
    $('dropveil').classList.remove('show');
  }
});
window.addEventListener('dragover', (e) => e.preventDefault());
window.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  $('dropveil').classList.remove('show');
  importFiles(e.dataTransfer?.files);
});

/* top bar */
function setRunning(run) {
  state.running = run;
  $('playIcon').textContent = run ? '❚❚' : '▶';
  $('playLabel').textContent = run ? 'Pause' : 'Resume';
  pushParams();
}
function resetFlow() {
  worker.postMessage({ type: 'reset' });
  streaks.respawnAll();
  smooth.cd = smooth.cl = smooth.cs = null;
  history.cd.length = history.cl.length = 0;
  log.length = clTrace.length = 0;
  drawSpark();
}
$('btnCsv').onclick = exportCsv;
$('btnPlay').onclick = () => setRunning(!state.running);
$('btnReset').onclick = resetFlow;
$('btnShot').onclick = () => {
  renderer.render(scene, camera);
  canvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `zephyr-${state.preset?.id ?? 'tunnel'}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
};
function closePanels() {
  $('panelLeft').classList.remove('open');
  $('panelRight').classList.remove('open');
}
$('btnPanels').onclick = () => {
  $('panelRight').classList.remove('open');
  $('panelLeft').classList.toggle('open');
};
$('btnControls').onclick = () => {
  $('panelLeft').classList.remove('open');
  $('panelRight').classList.toggle('open');
};
window.addEventListener('keydown', (e) => {
  if (e.target.matches('input, textarea')) return;
  if (e.code === 'Space') {
    e.preventDefault();
    setRunning(!state.running);
  } else if (e.key === 'r' || e.key === 'R') resetFlow();
});

/* probe: hover the cut plane for local values */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const probeEl = $('probe');
const probeOut = new Float32Array(4);
canvas.addEventListener('pointermove', (e) => {
  if (!slice.object.visible || !field?.ready || e.buttons) return (probeEl.hidden = true);
  pointer.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  raycaster.setFromCamera(pointer, camera);
  const hit = raycaster.intersectObject(slice.object)[0];
  if (!hit || !field.sample(hit.point.x, hit.point.y, hit.point.z, probeOut)) return (probeEl.hidden = true);
  const C = velScale();
  const A = air();
  const sp = Math.hypot(probeOut[0], probeOut[1], probeOut[2]) * C;
  const pa = ((probeOut[3] - field.rhoRef) / 3) * A.rho * C * C;
  const q = realRef().q;
  const mpw = metresPerWorld();
  const lines = [
    `speed     ${fmt(sp, 1)} m/s  (${fmt(sp * 3.6, 1)} km/h)`,
    `u, v, w   ${fmt(probeOut[0] * C, 1)}, ${fmt(probeOut[1] * C, 1)}, ${fmt(probeOut[2] * C, 1)} m/s`,
    `pressure  ${fmtPa(pa)} gauge${state.speed > 0 && q > 0 ? `  (Cp ${(pa / q).toFixed(2)})` : ''}`,
    `position  ${fmt((hit.point.x - objectRoot.position.x) * mpw)}, ${fmt(hit.point.y * mpw)}, ${fmt(hit.point.z * mpw)} m`,
  ];
  probeEl.textContent = lines.join('\n');
  probeEl.style.left = `${Math.min(e.clientX, window.innerWidth - 330)}px`;
  probeEl.style.top = `${Math.min(e.clientY, window.innerHeight - 110)}px`;
  probeEl.hidden = false;
});
canvas.addEventListener('pointerleave', () => (probeEl.hidden = true));

/* ───────────────────────────── frame loop ───────────────────────────── */

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  // Pull back on narrow / portrait screens so the whole test section stays in view.
  camera.fov = w / h < 1 ? 58 : 38;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  controls.update();
  if (state.running) {
    if (streaks.object.visible) streaks.update(field, dt, uScale());
    const spin = hasFans ? 26 * state.fan : 0;
    for (const s of model.spinners) s.rotation.y -= spin * dt * (s.userData.spin || 1);
  }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ───────────────────────────── boot ───────────────────────────── */

setGrid(state.ny);
resize();
renderChips();
const initial = PRESETS.find((p) => p.id === new URLSearchParams(location.search).get('preset')) ?? PRESETS[0];
setSubject(initial);
renderGallery();
generateThumbs();
frame();

// Handy for debugging and automated checks.
window.__zephyr = { state, streaks, renderer, PRESETS, setSubject, get field() { return field; }, get solid() { return solid; }, smooth };
