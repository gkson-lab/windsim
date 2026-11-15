// Preset library. Each preset builds a THREE.Group procedurally.
//   real      largest real-world dimension in metres (for Reynolds number and forces)
//   speed     default wind speed, km/h
//   grounded  sits on the tunnel floor instead of floating mid-stream
//   seed      default smoke seeding ('inlet' | 'rake' | 'volume')
//   temp/alt  ambient air temperature (°C) and altitude (m) the subject normally meets
//   turb      free-stream turbulence (%) typical of where it operates
import { THREE, mat, glass, box, cyl, sph, torus, extrude, planform, lathe, put, deco, tire, naca, fan, aim, loft, wing } from './kit.js';

const G = () => new THREE.Group();
const PI = Math.PI;

/* ───────────────────────────── vehicles ───────────────────────────── */

const lamp = (c) => mat(c, { emissive: c, emissiveIntensity: 0.8, roughness: 0.2 });

function f1Car() {
  const g = G();
  const body = mat('#d4102a', { roughness: 0.22, metalness: 0.45 });
  const carbon = mat('#15161a', { roughness: 0.42, metalness: 0.45 });
  const white = mat('#f2f3f5', { roughness: 0.3, metalness: 0.2 });

  // Nose, survival cell and engine cover as one lofted shell.
  put(g, loft([
    { x: -2.62, w: 0.1, h: 0.07, y: 0.2, n: 2.2 },
    { x: -2.3, w: 0.2, h: 0.13, y: 0.25 },
    { x: -1.7, w: 0.32, h: 0.24, y: 0.36, n: 3 },
    { x: -1.1, w: 0.48, h: 0.4, y: 0.42, n: 3.5 },
    { x: -0.55, w: 0.6, h: 0.5, y: 0.44, n: 3.5 },
    { x: -0.1, w: 0.58, h: 0.62, y: 0.5, n: 3 },
    { x: 0.35, w: 0.5, h: 0.74, y: 0.56, n: 2.4 },
    { x: 0.9, w: 0.44, h: 0.62, y: 0.5, n: 2.4 },
    { x: 1.5, w: 0.32, h: 0.42, y: 0.4 },
    { x: 2.05, w: 0.2, h: 0.24, y: 0.32 },
    { x: 2.2, w: 0.12, h: 0.14, y: 0.3 },
  ], body));
  put(g, extrude([[0.45, 0.9], [1.95, 0.6], [1.95, 0.48], [0.45, 0.6]], 0.03, body));
  put(g, deco(sph(0.2, mat('#08080a', { roughness: 0.9 }), 1.7, 0.45, 0.85)), -0.45, 0.69, 0);
  put(g, deco(sph(0.1, mat('#08080a'), 0.6, 0.9, 1.2)), 0.13, 0.86, 0);

  for (const s of [-1, 1]) {
    // Sidepods with undercut and coke-bottle taper.
    put(g, loft([
      { x: -0.62, w: 0.3, h: 0.26, y: 0.44, z: s * 0.5, n: 3.5 },
      { x: -0.3, w: 0.5, h: 0.4, y: 0.4, z: s * 0.56, n: 4 },
      { x: 0.5, w: 0.5, h: 0.36, y: 0.36, z: s * 0.54, n: 3.5 },
      { x: 1.2, w: 0.36, h: 0.26, y: 0.3, z: s * 0.42, n: 3 },
      { x: 1.85, w: 0.14, h: 0.12, y: 0.24, z: s * 0.26 },
    ], body));
    put(g, deco(box(0.03, 0.2, 0.36, mat('#08080a'), 0.01)), -0.6, 0.45, s * 0.52);
    // Front wing endplates, rear wing endplates.
    put(g, extrude([[-2.68, 0.04], [-2.0, 0.04], [-2.0, 0.36], [-2.3, 0.36], [-2.68, 0.15]], 0.025, carbon), 0, 0, s * 0.95);
    put(g, extrude([[2.1, 0.28], [2.86, 0.28], [2.86, 1.1], [2.1, 1.03]], 0.025, carbon), 0, 0, s * 0.51);
    // Wheels, brake ducts, suspension.
    put(g, tire(0.36, 0.34, { rim: '#2a2c31' }), -1.7, 0.36, s * 0.83);
    put(g, tire(0.36, 0.44, { rim: '#2a2c31' }), 1.75, 0.36, s * 0.79);
    for (const [x, len, y0] of [[-1.7, 0.72, 0.3], [1.75, 0.62, 0.3]])
      for (const [dy, dx] of [[0, -0.16], [0, 0.16], [0.2, -0.12], [0.2, 0.12]])
        put(g, deco(cyl(0.014, len, carbon, 'z', 0.014, 8)), x + dx * 0.5, y0 + dy, s * 0.46, [0, dx * 0.9, 0]);
    put(g, box(0.1, 0.06, 0.16, body, 0.02), -0.72, 0.68, s * 0.42);
    // Floor edge fences.
    put(g, deco(box(0.5, 0.1, 0.012, carbon)), -0.85, 0.16, s * 0.6, [0, s * 0.25, 0]);
  }
  // Floor with a pointed leading edge, plank and diffuser.
  put(g, planform([[-1.5, -0.3], [-1.0, -0.72], [1.95, -0.72], [2.1, -0.5], [2.1, 0.5], [1.95, 0.72], [-1.0, 0.72], [-1.5, 0.3]], 0.04, carbon), 0, 0.09, 0);
  put(g, box(0.8, 0.035, 1.3, carbon), 2.3, 0.2, 0, [0, 0, 0.3]);
  for (const z of [-0.45, -0.15, 0.15, 0.45]) put(g, deco(box(0.7, 0.16, 0.012, carbon)), 2.3, 0.17, z, [0, 0, 0.3]);

  // Three-element front wing (inverted sections, increasing incidence).
  [[-2.66, 0.1, 0.3, -0.06, carbon], [-2.4, 0.13, 0.24, -0.3, white], [-2.2, 0.2, 0.2, -0.55, body]].forEach(([x, y, chord, aoa, m]) =>
    put(g, wing([{ z: -0.94, chord, twist: aoa }, { z: 0.94, chord, twist: aoa }], m, { camber: -0.06, thick: 0.11 }), x, y, 0));
  for (const s of [-1, 1]) put(g, box(0.16, 0.14, 0.03, carbon), -2.45, 0.19, s * 0.1);
  // Rear wing: main plane + flap, beam wing, swan-neck pylon.
  put(g, wing([{ z: -0.5, chord: 0.4, twist: -0.2 }, { z: 0.5, chord: 0.4, twist: -0.2 }], carbon, { camber: -0.07, thick: 0.13 }), 2.18, 0.9, 0);
  put(g, wing([{ z: -0.5, chord: 0.24, twist: -0.62 }, { z: 0.5, chord: 0.24, twist: -0.62 }], white, { camber: -0.07, thick: 0.12 }), 2.58, 0.99, 0);
  put(g, wing([{ z: -0.5, chord: 0.26, twist: -0.25 }, { z: 0.5, chord: 0.26, twist: -0.25 }], carbon, { camber: -0.05, thick: 0.12 }), 2.2, 0.42, 0);
  put(g, box(0.34, 0.5, 0.04, carbon), 2.25, 0.66, 0);

  // Driver, halo, camera pod.
  put(g, sph(0.15, mat('#ffd400', { roughness: 0.25, metalness: 0.2 })), -0.5, 0.72, 0);
  const halo = torus(0.3, 0.026, carbon, PI);
  halo.geometry.rotateX(-PI / 2);
  halo.geometry.rotateY(PI / 2);
  put(g, deco(halo), -0.48, 0.79, 0);
  put(g, deco(cyl(0.02, 0.22, carbon, 'y', 0.02, 8)), -0.78, 0.7, 0, [0, 0, 0.5]);
  put(g, box(0.16, 0.07, 0.05, carbon, 0.02), 0.2, 0.96, 0);
  return g;
}

function roadCar({ lower, cabin, paint, wheelR = 0.33, wheelW = 0.23, axles = [-1.4, 1.4], track = 0.8, extras }) {
  const g = G();
  const gl = mat('#0d1117', { roughness: 0.08, metalness: 0.7 });
  put(g, loft(lower, paint, { seg: 44 }));
  put(g, loft(cabin, gl, { seg: 44 }));
  for (const x of axles)
    for (const s of [-1, 1]) {
      put(g, tire(wheelR, wheelW), x, wheelR, s * track);
      put(g, deco(cyl(wheelR * 1.16, 0.02, mat('#07080a', { roughness: 1 }), 'z')), x, wheelR * 1.02, s * (track - wheelW * 0.55));
    }
  const front = lower[0].x;
  const rear = lower[lower.length - 1].x;
  const wMid = lower[1].w;
  const yMid = lower[1].y;
  for (const s of [-1, 1]) {
    put(g, deco(box(0.06, 0.09, 0.34, lamp('#fff6d8'), 0.02)), front + 0.1, yMid + 0.08, s * wMid * 0.33);
    put(g, deco(box(0.06, 0.07, 0.4, lamp('#ff2a2a'), 0.02)), rear - 0.08, yMid + 0.14, s * wMid * 0.3);
    put(g, box(0.13, 0.08, 0.17, paint, 0.03), cabin[1].x - 0.05, cabin[1].y - 0.1, s * (wMid * 0.54));
  }
  put(g, deco(box(0.04, 0.12, wMid * 0.5, mat('#08090b', { roughness: 0.6 }), 0.015)), front + 0.04, yMid - 0.08, 0);
  extras?.(g);
  return g;
}

const sedan = () =>
  roadCar({
    paint: mat('#2a62d6', { roughness: 0.2, metalness: 0.6 }),
    lower: [
      { x: -2.32, w: 1.2, h: 0.34, y: 0.42, n: 3, nb: 4 },
      { x: -2.2, w: 1.66, h: 0.46, y: 0.46, n: 4, nb: 5 },
      { x: -1.5, w: 1.8, h: 0.58, y: 0.5, n: 4.5, nb: 6 },
      { x: -0.6, w: 1.82, h: 0.66, y: 0.53, n: 5, nb: 6 },
      { x: 0.6, w: 1.82, h: 0.68, y: 0.54, n: 5, nb: 6 },
      { x: 1.6, w: 1.8, h: 0.66, y: 0.55, n: 4.5, nb: 6 },
      { x: 2.2, w: 1.68, h: 0.56, y: 0.56, n: 4, nb: 5 },
      { x: 2.34, w: 1.3, h: 0.4, y: 0.54, n: 3, nb: 4 },
    ],
    cabin: [
      { x: -1.05, w: 1.36, h: 0.04, y: 0.84, n: 4 },
      { x: -0.45, w: 1.5, h: 0.5, y: 1.04, n: 5 },
      { x: 0.45, w: 1.5, h: 0.62, y: 1.09, n: 5.5 },
      { x: 1.1, w: 1.44, h: 0.5, y: 1.05, n: 5 },
      { x: 1.8, w: 1.34, h: 0.04, y: 0.86, n: 4 },
    ],
  });

const sportsCar = () =>
  roadCar({
    paint: mat('#f2a900', { roughness: 0.18, metalness: 0.55 }),
    wheelR: 0.34,
    wheelW: 0.28,
    axles: [-1.32, 1.3],
    track: 0.84,
    lower: [
      { x: -2.25, w: 1.1, h: 0.18, y: 0.3, n: 3, nb: 5 },
      { x: -2.05, w: 1.74, h: 0.32, y: 0.36, n: 3.5, nb: 6 },
      { x: -1.3, w: 1.92, h: 0.48, y: 0.42, n: 3.5, nb: 7 },
      { x: -0.4, w: 1.94, h: 0.56, y: 0.44, n: 4, nb: 7 },
      { x: 0.7, w: 1.98, h: 0.62, y: 0.47, n: 4, nb: 7 },
      { x: 1.6, w: 1.98, h: 0.62, y: 0.5, n: 4, nb: 7 },
      { x: 2.12, w: 1.84, h: 0.5, y: 0.54, n: 3.5, nb: 5 },
      { x: 2.24, w: 1.4, h: 0.3, y: 0.56, n: 3, nb: 4 },
    ],
    cabin: [
      { x: -0.75, w: 1.3, h: 0.04, y: 0.7, n: 3.5 },
      { x: -0.15, w: 1.44, h: 0.44, y: 0.88, n: 4 },
      { x: 0.5, w: 1.42, h: 0.5, y: 0.92, n: 4 },
      { x: 1.3, w: 1.3, h: 0.3, y: 0.86, n: 3.5 },
      { x: 2.0, w: 1.1, h: 0.04, y: 0.78, n: 3 },
    ],
    extras: (g) => {
      const carbon = mat('#15161a', { roughness: 0.4, metalness: 0.4 });
      put(g, wing([{ z: -0.8, chord: 0.3, twist: -0.18 }, { z: 0.8, chord: 0.3, twist: -0.18 }], carbon, { camber: -0.05 }), 1.92, 1.02, 0);
      for (const s of [-1, 1]) put(g, box(0.1, 0.24, 0.04, carbon), 2.02, 0.9, s * 0.5);
      put(g, box(0.5, 0.03, 1.7, carbon), -2.15, 0.2, 0);
    },
  });

const suv = () =>
  roadCar({
    paint: mat('#3d4a3f', { roughness: 0.3, metalness: 0.5 }),
    wheelR: 0.39,
    wheelW: 0.27,
    axles: [-1.42, 1.38],
    track: 0.82,
    lower: [
      { x: -2.34, w: 1.4, h: 0.5, y: 0.62, n: 3.5, nb: 4 },
      { x: -2.2, w: 1.8, h: 0.66, y: 0.66, n: 5, nb: 5 },
      { x: -1.4, w: 1.92, h: 0.78, y: 0.7, n: 5.5, nb: 6 },
      { x: -0.4, w: 1.94, h: 0.84, y: 0.72, n: 6, nb: 6 },
      { x: 1.0, w: 1.94, h: 0.86, y: 0.73, n: 6, nb: 6 },
      { x: 2.2, w: 1.88, h: 0.84, y: 0.74, n: 5, nb: 5 },
      { x: 2.36, w: 1.6, h: 0.66, y: 0.74, n: 4, nb: 4 },
    ],
    cabin: [
      { x: -0.95, w: 1.5, h: 0.04, y: 1.12, n: 5 },
      { x: -0.35, w: 1.66, h: 0.56, y: 1.38, n: 6 },
      { x: 1.0, w: 1.66, h: 0.62, y: 1.41, n: 6 },
      { x: 2.05, w: 1.6, h: 0.56, y: 1.38, n: 6 },
      { x: 2.3, w: 1.5, h: 0.2, y: 1.2, n: 5 },
    ],
    extras: (g) => {
      for (const s of [-1, 1]) put(g, deco(cyl(0.02, 2.2, mat('#101114'), 'x', 0.02, 8)), 0.8, 1.76, s * 0.62);
    },
  });

function pickup() {
  const g = G();
  const paint = mat('#c8cdd4', { roughness: 0.28, metalness: 0.65 });
  const dark = mat('#0d1117', { roughness: 0.1, metalness: 0.7 });
  const trim = mat('#15171b', { roughness: 0.6 });
  put(g, loft([
    { x: -2.75, w: 1.5, h: 0.5, y: 0.72, n: 4, nb: 4 },
    { x: -2.6, w: 1.9, h: 0.66, y: 0.76, n: 6, nb: 5 },
    { x: -1.2, w: 1.96, h: 0.74, y: 0.8, n: 6, nb: 6 },
    { x: -1.05, w: 1.96, h: 0.78, y: 0.82, n: 6, nb: 6 },
  ], paint));
  put(g, loft([
    { x: -1.15, w: 1.9, h: 0.5, y: 0.7, n: 6 },
    { x: -0.95, w: 1.94, h: 1.2, y: 1.04, n: 6 },
    { x: -0.3, w: 1.94, h: 1.36, y: 1.12, n: 7 },
    { x: 0.55, w: 1.94, h: 1.36, y: 1.12, n: 7 },
    { x: 0.7, w: 1.9, h: 1.2, y: 1.04, n: 6 },
  ], paint, { sub: 3 }));
  put(g, deco(box(0.9, 0.5, 1.96, dark, 0.05)), -0.15, 1.5, 0);
  put(g, deco(box(0.05, 0.5, 1.6, dark, 0.02)), -1.0, 1.48, 0, [0, 0, -0.35]);
  put(g, box(2.2, 0.14, 1.94, paint, 0.03), 1.7, 0.52, 0);
  for (const s of [-1, 1]) put(g, box(2.2, 0.56, 0.08, paint, 0.03), 1.7, 0.86, s * 0.93);
  put(g, box(0.08, 0.56, 1.94, paint, 0.03), 2.78, 0.86, 0);
  put(g, box(0.1, 0.2, 1.9, trim, 0.03), 2.84, 0.5, 0);
  put(g, deco(box(0.06, 0.36, 1.4, trim, 0.02)), -2.78, 0.8, 0);
  for (const s of [-1, 1]) {
    put(g, deco(box(0.06, 0.14, 0.26, lamp('#fff6d8'), 0.02)), -2.72, 0.9, s * 0.78);
    put(g, deco(box(0.05, 0.3, 0.1, lamp('#ff2a2a'), 0.02)), 2.83, 0.9, s * 0.9);
    put(g, box(0.14, 0.2, 0.2, trim, 0.03), -0.9, 1.28, s * 1.06);
    for (const x of [-1.85, 1.75]) put(g, tire(0.43, 0.3), x, 0.43, s * 0.85);
  }
  return g;
}

function semi() {
  const g = G();
  const cab = mat('#e04a1c', { roughness: 0.28, metalness: 0.45 });
  const white = mat('#eef1f5', { roughness: 0.5 });
  const dark = mat('#15171b', { roughness: 0.5 });
  put(g, loft([
    { x: -6.4, w: 2.2, h: 2.2, y: 1.9, n: 6 },
    { x: -6.2, w: 2.44, h: 2.5, y: 2.0, n: 8 },
    { x: -5.2, w: 2.46, h: 2.9, y: 2.2, n: 8 },
    { x: -4.3, w: 2.46, h: 3.1, y: 2.3, n: 8 },
  ], cab, { sub: 4 }));
  put(g, loft([
    { x: -5.9, w: 2.0, h: 0.1, y: 3.6, n: 4 },
    { x: -5.0, w: 2.4, h: 0.7, y: 3.75, n: 4 },
    { x: -4.25, w: 2.46, h: 0.9, y: 3.72, n: 6 },
  ], cab, { sub: 4 }));
  put(g, deco(box(0.06, 0.85, 2.1, mat('#0d1117', { roughness: 0.08, metalness: 0.7 }), 0.02)), -6.36, 2.6, 0);
  put(g, deco(box(0.06, 0.7, 1.5, dark, 0.02)), -6.44, 1.4, 0);
  put(g, box(10.4, 2.9, 2.5, white, 0.06), 1.3, 2.6, 0);
  put(g, box(11.8, 0.3, 1.0, dark), 0.2, 0.95, 0);
  for (const s of [-1, 1]) {
    put(g, box(4.6, 0.6, 0.04, dark), 1.2, 0.85, s * 1.22);
    put(g, box(0.18, 0.4, 0.16, dark, 0.03), -6.0, 2.9, s * 1.36);
    for (const x of [-5.5, -3.7, -2.6, 4.6, 5.75]) put(g, tire(0.52, 0.56, { rim: '#8b929c', spokes: 8 }), x, 0.52, s * 0.95);
  }
  return g;
}

function airliner() {
  const g = G();
  const white = mat('#f1f4f8', { roughness: 0.28, metalness: 0.25 });
  const navy = mat('#14306b', { roughness: 0.35, metalness: 0.3 });
  const metal = mat('#9aa3b0', { roughness: 0.3, metalness: 0.85 });
  put(g, lathe([[0, 0], [0.5, 0.25], [1.1, 1.1], [1.7, 2.6], [1.95, 4.4], [1.95, 25], [1.75, 28.5], [1.2, 32.5], [0.5, 35.8], [0.15, 36.6], [0, 36.7]], white), -18.3, 0, 0);
  put(g, deco(box(1.0, 0.36, 2.9, mat('#0d1117', { roughness: 0.1, metalness: 0.7 }), 0.1)), -16.2, 0.55, 0, [0, 0, 0.5]);
  for (const s of [-1, 1]) {
    // Swept, tapered main wing with dihedral and a blended winglet.
    put(g, wing([
      { z: s * 1.6, chord: 7.2, x: -5.2, y: -0.75, twist: 0.03 },
      { z: s * 6.4, chord: 4.4, x: -1.6, y: -0.3, twist: 0.02 },
      { z: s * 16.6, chord: 1.7, x: 5.0, y: 0.75, twist: -0.02 },
      { z: s * 17.4, chord: 1.1, x: 5.9, y: 1.5 },
      { z: s * 17.7, chord: 0.6, x: 6.6, y: 2.6 },
    ], white, { thick: 0.13, camber: 0.025 }));
    put(g, wing([{ z: s * 0.6, chord: 3.6, x: 13.4, y: 0.7 }, { z: s * 6.6, chord: 1.3, x: 17.2, y: 1.2 }], white, { thick: 0.1, camber: 0 }));
    // High-bypass engine: nacelle, intake lip, pylon.
    put(g, lathe([[0, 0.25], [0.95, 0.3], [1.12, 0.05], [1.2, 0.5], [1.18, 2.4], [0.8, 3.9], [0.45, 4.6], [0, 4.7]], metal), -6.6, -1.9, s * 6.2);
    put(g, deco(cyl(0.96, 0.05, mat('#1a1c20', { roughness: 0.4, metalness: 0.6 }), 'x')), -6.32, -1.9, s * 6.2);
    put(g, box(2.6, 0.9, 0.2, white, 0.08), -3.9, -1.05, s * 6.2);
    for (let i = 0; i < 26; i++) put(g, deco(box(0.26, 0.24, 0.02, mat('#16202e', { roughness: 0.2 }), 0.008)), -13.5 + i * 1.05, 0.45, s * 1.9);
  }
  put(g, extrude([[12.2, 1.5], [16.4, 8.4], [18.3, 8.4], [17.7, 1.2]], 0.34, navy, 0.12));
  return g;
}

function rocket() {
  const g = G();
  const white = mat('#f3f4f6', { roughness: 0.3, metalness: 0.2 });
  const red = mat('#d22f27', { roughness: 0.35 });
  put(g, lathe([[0, 0], [0.16, 0.2], [0.34, 0.7], [0.45, 1.4], [0.45, 5.3], [0.36, 5.5], [0.5, 6.0], [0, 6.0]], white));
  put(g, deco(cyl(0.455, 0.25, red, 'x')), 1.6, 0, 0);
  put(g, deco(cyl(0.455, 0.25, red, 'x')), 4.6, 0, 0);
  for (let i = 0; i < 4; i++) {
    const fin = extrude([[4.1, 0.4], [5.3, 1.25], [5.9, 1.25], [5.5, 0.4]], 0.07, red, 0.015);
    const pivot = G();
    pivot.rotation.x = (i * PI) / 2 + PI / 4;
    pivot.add(fin);
    put(g, pivot);
  }
  return g;
}

function cyclist() {
  const g = G();
  const frame = mat('#f2f2f2', { roughness: 0.3, metalness: 0.5 });
  const kit = mat('#0fb5a6', { roughness: 0.6 });
  const skin = mat('#e0a988', { roughness: 0.7 });
  const tire = mat('#111216', { roughness: 0.8 });
  for (const x of [-0.5, 0.5]) {
    const t = torus(0.33, 0.022, tire);
    put(g, t, x, 0.35, 0);
    put(g, cyl(0.31, 0.012, mat('#30343b', { transparent: true, opacity: 0.35 }), 'z'), x, 0.35, 0);
  }
  const tube = (x0, y0, x1, y1, r = 0.02, m = frame) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    const c = cyl(r, len, m, 'x', r, 12);
    return put(g, c, (x0 + x1) / 2, (y0 + y1) / 2, 0, [0, 0, Math.atan2(y1 - y0, x1 - x0)]);
  };
  tube(0.5, 0.35, 0.02, 0.38); tube(0.02, 0.38, 0.2, 0.92); tube(0.2, 0.92, -0.38, 0.9);
  tube(-0.38, 0.9, 0.02, 0.38); tube(-0.38, 0.9, -0.5, 0.35); tube(0.5, 0.35, 0.2, 0.92);
  // Rider: torso, head, arms, legs.
  const torso = sph(0.19, kit, 1.75, 0.8, 0.95);
  put(g, torso, -0.08, 1.2, 0, [0, 0, 0.5]);
  put(g, sph(0.12, mat('#f4d21f', { roughness: 0.3 }), 1.25, 0.9, 0.9), -0.48, 1.42, 0, [0, 0, 0.35]);
  for (const s of [-1, 1]) {
    put(g, cyl(0.04, 0.5, skin, 'y', 0.035, 12), -0.42, 1.13, s * 0.17, [0, 0, -0.35]);
    put(g, cyl(0.07, 0.5, kit, 'y', 0.055, 12), 0.05, 0.85, s * 0.11, [0, 0, s > 0 ? 0.75 : 0.25]);
    put(g, cyl(0.05, 0.46, skin, 'y', 0.04, 12), s > 0 ? -0.1 : 0.02, 0.5, s * 0.11, [0, 0, s > 0 ? -0.2 : 0.15]);
  }
  put(g, box(0.06, 0.03, 0.44, frame, 0.01), -0.42, 0.93, 0);
  return g;
}

/* ───────────────────────────── PC hardware ───────────────────────────── */

function pcCase({ L = 0.46, H = 0.48, W = 0.22, front = 'mesh', frontFans = 3, topFans = 2, rearFan = true, color = '#1b1e25', accent = '#33d6ff' } = {}) {
  const g = G();
  const t = 0.012;
  const y0 = 0.025;
  const panel = mat(color, { roughness: 0.5, metalness: 0.5 });
  const metal = mat('#8f98a6', { roughness: 0.35, metalness: 0.85 });
  const pcb = mat('#143326', { roughness: 0.6 });
  const fr = Math.min(0.06, W / 2 - 0.035);
  const inset = front === 'glass' ? 0.07 : 0;

  for (const [x, z] of [[-1, -1], [-1, 1], [1, -1], [1, 1]])
    put(g, deco(cyl(0.02, y0, mat('#0c0d10'))), x * (L / 2 - 0.04), y0 / 2, z * (W / 2 - 0.03));
  put(g, box(L, t, W, panel), 0, y0 + t / 2, 0);
  // Top: vented between two rails when there are top fans.
  if (topFans) {
    for (const s of [-1, 1]) put(g, box(L, t, 0.028, panel), 0, y0 + H, s * (W / 2 - 0.014));
    put(g, box(0.06, t, W, panel), -L / 2 + 0.03, y0 + H, 0);
    put(g, box(0.05, t, W, panel), L / 2 - 0.025, y0 + H, 0);
    put(g, deco(box(L - 0.1, 0.003, W - 0.05, mat('#0a0b0d', { transparent: true, opacity: 0.45 }))), 0, y0 + H + 0.004, 0);
  } else put(g, box(L, t, W, panel), 0, y0 + H, 0);
  // Back: I/O wall with an exhaust opening near the top.
  put(g, box(t, H - 0.19, W, panel), L / 2, y0 + (H - 0.19) / 2, 0);
  put(g, box(t, 0.035, W, panel), L / 2, y0 + H - 0.018, 0);
  // Sides: steel on the far side, tempered glass on the near side.
  const sideLen = L - inset;
  put(g, box(sideLen, H, t, panel), inset / 2, y0 + H / 2, -W / 2);
  put(g, box(sideLen, H, t, glass('#a8dcff', 0.16)), inset / 2, y0 + H / 2, W / 2);
  // Front.
  if (front === 'mesh') {
    put(g, box(t, 0.03, W, panel), -L / 2, y0 + 0.015, 0);
    put(g, box(t, 0.03, W, panel), -L / 2, y0 + H - 0.015, 0);
    const grille = new THREE.Mesh(
      new THREE.PlaneGeometry(W - 0.01, H - 0.05, 16, 34),
      new THREE.MeshBasicMaterial({ color: '#5a6677', wireframe: true, transparent: true, opacity: 0.55 }),
    );
    grille.rotation.y = -PI / 2;
    put(g, deco(grille), -L / 2 - 0.002, y0 + H / 2, 0);
  } else {
    // Sealed glass front: air has to sneak in through the side gaps.
    put(g, box(t, H, W, glass('#a8dcff', 0.2)), -L / 2, y0 + H / 2, 0);
    put(g, box(inset, t, W, panel), -L / 2 + inset / 2, y0 + H, 0);
  }
  // PSU shroud with the supply inside, motherboard, tower cooler, GPU, RAM.
  put(g, box(L - 0.03, 0.085, W - 2 * t, panel), 0.005, y0 + t + 0.042, 0);
  put(g, deco(box(0.15, 0.07, 0.012, mat('#2b2f38', { roughness: 0.4, metalness: 0.7 }))), L / 2 - 0.1, y0 + t + 0.042, W / 2 - t - 0.004);
  const mbX = L / 2 - 0.02 - 0.125;
  const mbY = y0 + H - 0.03 - 0.15;
  const mbZ = -W / 2 + 0.02;
  put(g, box(0.25, 0.3, 0.008, pcb), mbX, mbY, mbZ);
  // VRM heatsinks, chipset block, rear I/O shield.
  put(g, deco(box(0.03, 0.09, 0.025, metal, 0.004)), mbX + 0.07, mbY + 0.08, mbZ + 0.016);
  put(g, deco(box(0.1, 0.022, 0.025, metal, 0.004)), mbX + 0.01, mbY + 0.133, mbZ + 0.016);
  put(g, deco(box(0.06, 0.06, 0.012, mat('#22262e', { metalness: 0.6, roughness: 0.4 }), 0.004)), mbX - 0.07, mbY - 0.1, mbZ + 0.01);
  put(g, box(0.02, 0.15, 0.045, metal), L / 2 - 0.022, mbY + 0.07, mbZ + 0.03);
  const cz = mbZ + 0.004 + 0.055;
  // Tower cooler: fin stack (visual), solid core for the solver, heat pipes, push fan.
  put(g, box(0.05, 0.11, 0.1, mat('#6f7884', { roughness: 0.5, metalness: 0.8 })), mbX + 0.012, mbY + 0.06, cz);
  for (let i = 0; i < 22; i++) put(g, deco(box(0.066, 0.0018, 0.112, metal)), mbX + 0.012, mbY + 0.008 + i * 0.005, cz);
  for (const dz of [-0.03, -0.01, 0.01, 0.03]) put(g, deco(cyl(0.004, 0.14, mat('#b87333', { metalness: 0.9, roughness: 0.3 }), 'y', 0.004, 8)), mbX + 0.012, mbY + 0.055, cz + dz);
  put(g, deco(box(0.05, 0.02, 0.05, mat('#b87333', { metalness: 0.9, roughness: 0.3 }))), mbX + 0.012, mbY - 0.01, mbZ + 0.016);
  put(g, aim(fan(0.05, { strength: 0.8, thick: 0.02 }), '+x'), mbX - 0.036, mbY + 0.06, cz);
  if (H > 0.34) {
    // Graphics card: PCB, heatsink shroud, backplate, three (visual) fans, power cables.
    const gy = mbY - 0.075;
    const gz = mbZ + 0.004 + 0.066;
    put(g, box(0.29, 0.045, 0.125, mat('#23272f', { roughness: 0.4, metalness: 0.6 }), 0.008), mbX - 0.04, gy, gz);
    put(g, deco(box(0.292, 0.004, 0.128, mat('#3a3f4a', { metalness: 0.85, roughness: 0.3 }))), mbX - 0.04, gy + 0.025, gz);
    for (const dx of [-0.095, 0, 0.095]) put(g, deco(aim(fan(0.04, { thick: 0.008, frame: false }), '-y')), mbX - 0.04 + dx, gy - 0.024, gz);
    put(g, deco(box(0.27, 0.004, 0.012, mat(accent, { emissive: accent, emissiveIntensity: 1.6 }))), mbX - 0.04, gy + 0.02, gz + 0.064);
    for (const dz of [0, 0.012]) {
      const cable = new THREE.Mesh(
        new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
          new THREE.Vector3(mbX - 0.1, gy + 0.025, gz + 0.03 + dz), new THREE.Vector3(mbX - 0.11, gy + 0.07, gz + 0.04 + dz),
          new THREE.Vector3(mbX - 0.15, gy + 0.03, mbZ + 0.03), new THREE.Vector3(mbX - 0.15, y0 + 0.1, mbZ + 0.02),
        ]), 20, 0.005, 6),
        mat('#0c0d10', { roughness: 0.8 }),
      );
      put(g, deco(cable));
    }
  }
  // Four RAM sticks with light bars.
  for (let i = 0; i < 4; i++) {
    const rx = mbX - 0.07 - i * 0.011;
    put(g, deco(box(0.006, 0.13, 0.032, mat('#1a1d23', { metalness: 0.6, roughness: 0.4 }))), rx, mbY + 0.07, mbZ + 0.02);
    put(g, deco(box(0.006, 0.13, 0.005, mat(accent, { emissive: accent, emissiveIntensity: 1.2 }))), rx, mbY + 0.07, mbZ + 0.038);
  }
  // Rear expansion slots.
  for (let i = 0; i < 7; i++) put(g, deco(box(0.004, 0.016, 0.1, metal)), L / 2 + 0.007, y0 + 0.11 + i * 0.021, -0.02);
  // Fans.
  const usable = H - 0.085 - 0.04;
  for (let i = 0; i < frontFans; i++)
    put(g, aim(fan(fr), '+x'), -L / 2 + 0.035 + inset * 0.6, y0 + 0.1 + (usable * (i + 0.5)) / frontFans, 0);
  if (rearFan) put(g, aim(fan(fr), '+x'), L / 2 - 0.03, y0 + H - 0.105, 0);
  for (let i = 0; i < topFans; i++) put(g, fan(fr), L / 2 - 0.1 - i * (2 * fr + 0.02), y0 + H - 0.03, 0);
  return g;
}

function openBench() {
  const g = G();
  const metal = mat('#8f98a6', { roughness: 0.35, metalness: 0.85 });
  const black = mat('#1a1d23', { roughness: 0.5, metalness: 0.4 });
  put(g, box(0.4, 0.012, 0.36, black), 0, 0.14, 0);
  for (const x of [-0.18, 0.18]) for (const z of [-0.16, 0.16]) put(g, cyl(0.012, 0.14, metal), x, 0.07, z);
  put(g, box(0.305, 0.006, 0.245, mat('#143326')), 0, 0.152, 0.02);
  put(g, box(0.15, 0.086, 0.14, black, 0.006), -0.08, 0.05, 0);
  // Tower cooler with push fan.
  put(g, box(0.06, 0.15, 0.12, metal, 0.005), 0.02, 0.235, 0.05);
  put(g, aim(fan(0.055), '+x'), -0.03, 0.235, 0.05);
  // Vertical GPU.
  put(g, box(0.29, 0.125, 0.045, black, 0.008), 0, 0.225, -0.085);
  for (const x of [-0.09, 0, 0.09]) put(g, aim(fan(0.04, { strength: 0.7 }), '+z'), x, 0.225, -0.125);
  for (const dz of [0, 0.014]) put(g, deco(box(0.006, 0.04, 0.13, mat('#33d6ff', { emissive: '#33d6ff', emissiveIntensity: 0.9 }))), 0.09 + dz, 0.178, 0.05);
  return g;
}

function gpuCard() {
  const g = G();
  const shroud = mat('#22262e', { roughness: 0.4, metalness: 0.6 });
  const fins = mat('#aab2bf', { roughness: 0.3, metalness: 0.9 });
  put(g, box(0.3, 0.004, 0.125, mat('#143326')), 0, 0.03, 0);
  put(g, box(0.29, 0.026, 0.115, fins), 0, 0.015, 0);
  put(g, box(0.305, 0.012, 0.13, shroud, 0.004), 0, 0.037, 0);
  for (const s of [-1, 1]) put(g, box(0.3, 0.02, 0.008, shroud), 0, -0.005, s * 0.062);
  put(g, box(0.004, 0.11, 0.125, fins), -0.152, 0.0, 0);
  for (const x of [-0.095, 0, 0.095]) put(g, fan(0.042, { strength: 0.9 }), x, -0.012, 0);
  return g;
}

/* ───────────────────────────── food & fun ───────────────────────────── */

function sandwich() {
  const g = G();
  const crust = mat('#b9783a', { roughness: 0.85 });
  const crumb = mat('#f1dcae', { roughness: 0.95 });
  const slice = (y) => {
    const s = G();
    // Bread outline (top view): square loaf with a domed top edge.
    const pts = [];
    pts.push([0.5, -0.5], [0.5, 0.36]);
    for (let i = 0; i <= 16; i++) {
      const a = (PI * i) / 16;
      pts.push([0.5 * Math.cos(a) * 1.06, 0.36 + 0.2 * Math.sin(a)]);
    }
    pts.push([-0.5, 0.36], [-0.5, -0.5]);
    const loaf = extrude(pts, 0.11, crust, 0.035);
    loaf.geometry.rotateX(-PI / 2);
    s.add(loaf);
    const face = extrude(pts.map(([x, z]) => [x * 0.93, z * 0.93 + 0.0]), 0.19, crumb);
    face.geometry.rotateX(-PI / 2);
    s.add(deco(face));
    return put(g, s, 0, y, 0);
  };
  slice(0.09);
  // Ham, cheese (corners poking out), tomato, lettuce.
  put(g, box(1.08, 0.05, 1.0, mat('#e58a8f', { roughness: 0.7 }), 0.02), 0.01, 0.2, 0.05, [0, 0.12, 0]);
  put(g, box(0.98, 0.03, 0.98, mat('#ffc629', { roughness: 0.5 })), 0, 0.245, 0.05, [0, PI / 4, 0]);
  for (const [x, z] of [[-0.24, -0.14], [0.26, -0.1], [0.02, 0.32]])
    put(g, cyl(0.24, 0.05, mat('#e23b2e', { roughness: 0.4 })), x, 0.29, z);
  const lettuce = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.045, 28, 1), mat('#6fbf3b', { roughness: 0.7, side: THREE.DoubleSide }));
  const lp = lettuce.geometry.attributes.position;
  for (let i = 0; i < lp.count; i++) {
    const a = Math.atan2(lp.getZ(i), lp.getX(i));
    const r = Math.hypot(lp.getX(i), lp.getZ(i));
    if (r > 0.1) lp.setY(i, lp.getY(i) + 0.035 * Math.sin(a * 7) * (r / 0.72));
  }
  lettuce.geometry.computeVertexNormals();
  put(g, lettuce, 0, 0.345, 0.04);
  slice(0.46);
  // Cocktail stick with an olive.
  put(g, cyl(0.012, 0.5, mat('#d9b98a')), 0.05, 0.62, 0.05);
  put(g, sph(0.07, mat('#6b8e23', { roughness: 0.35 }), 1, 1.2, 1), 0.05, 0.86, 0.05);
  return g;
}

function burger() {
  const g = G();
  const bun = mat('#c98a3c', { roughness: 0.7 });
  put(g, lathe([[0, 0], [0.46, 0.0], [0.5, 0.06], [0.5, 0.14], [0, 0.14]], bun, 'y'));
  put(g, cyl(0.52, 0.11, mat('#4a2a17', { roughness: 0.9 })), 0, 0.2, 0);
  put(g, box(0.92, 0.025, 0.92, mat('#ffc629', { roughness: 0.5 })), 0, 0.27, 0, [0, 0.5, 0]);
  put(g, cyl(0.47, 0.04, mat('#e23b2e', { roughness: 0.4 })), 0, 0.305, 0);
  put(g, cyl(0.55, 0.03, mat('#6fbf3b', { roughness: 0.7 })), 0, 0.34, 0);
  put(g, lathe([[0, 0], [0.5, 0], [0.52, 0.08], [0.46, 0.22], [0.3, 0.32], [0, 0.36]], bun, 'y'), 0, 0.36, 0);
  const seed = mat('#f6e8c3');
  for (let i = 0; i < 26; i++) {
    const a = i * 2.4;
    const r = 0.06 + 0.36 * Math.sqrt((i + 0.5) / 26);
    const y = 0.36 + 0.355 * Math.sqrt(Math.max(0, 1 - (r / 0.56) ** 2)) - 0.01;
    put(g, deco(sph(0.016, seed, 1.6, 0.6, 1)), r * Math.cos(a), y, r * Math.sin(a), [0, a, 0]);
  }
  return g;
}

function duck() {
  const g = G();
  const y = mat('#ffd21f', { roughness: 0.35 });
  put(g, sph(0.5, y, 1.25, 0.85, 1), 0.08, 0.42, 0);
  put(g, sph(0.3, y), -0.38, 0.95, 0);
  const tail = cyl(0.2, 0.36, y, 'x', 0.02);
  put(g, tail, 0.72, 0.62, 0, [0, 0, 0.6]);
  put(g, box(0.26, 0.07, 0.24, mat('#ff7a1a', { roughness: 0.4 }), 0.03), -0.7, 0.9, 0);
  for (const s of [-1, 1]) {
    put(g, deco(sph(0.045, mat('#111'))), -0.58, 1.05, s * 0.16);
    put(g, sph(0.26, y, 1.5, 0.5, 0.35), 0.15, 0.5, s * 0.47, [0, 0, -0.15]);
  }
  return g;
}

function donut() {
  const g = G();
  const d = torus(0.42, 0.21, mat('#d9a05b', { roughness: 0.75 }));
  put(g, d, 0, 0, 0);
  const ice = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.215, 20, 56), mat('#ff7eb6', { roughness: 0.3 }));
  ice.scale.set(1.0, 1.0, 0.72);
  put(g, deco(ice), 0, 0, 0.065);
  const cols = ['#ffffff', '#ffe14d', '#57d1ff', '#8cff8a', '#ff5a5a'];
  for (let i = 0; i < 70; i++) {
    const a = i * 2.399;
    const r = 0.3 + 0.24 * ((i * 0.618) % 1);
    const sp = cyl(0.012, 0.06, mat(cols[i % 5]), 'x', 0.012, 8);
    const zz = 0.065 + 0.155 * Math.sqrt(Math.max(0, 1 - ((r - 0.42) / 0.215) ** 2));
    put(g, deco(sp), r * Math.cos(a), r * Math.sin(a), zz, [0, 0, i * 1.7]);
  }
  g.rotation.y = PI / 2; // face the hole into the wind
  const wrap = G();
  wrap.add(g);
  return wrap;
}

function mug() {
  const g = G();
  const cer = mat('#f4f1ea', { roughness: 0.25 });
  put(g, lathe([[0, 0], [0.36, 0], [0.4, 0.04], [0.42, 0.9], [0.39, 0.92], [0.36, 0.9], [0.34, 0.08], [0, 0.08]], cer, 'y'));
  put(g, deco(cyl(0.35, 0.02, mat('#3a1f10', { roughness: 0.2 }))), 0, 0.78, 0);
  const handle = torus(0.24, 0.05, cer, PI);
  handle.geometry.rotateZ(-PI / 2);
  put(g, handle, 0.4, 0.47, 0);
  return g;
}

function sphericalCow() {
  const g = G();
  const white = mat('#f6f4ef', { roughness: 0.7 });
  const black = mat('#1b1b1d', { roughness: 0.7 });
  const pink = mat('#f4a6b7', { roughness: 0.6 });
  put(g, sph(0.6, white), 0, 0.95, 0);
  for (const [a, b, r] of [[0.6, 0.5, 0.2], [2.2, -0.3, 0.26], [4.0, 0.7, 0.18], [5.2, -0.5, 0.22], [1.2, 1.1, 0.16]]) {
    const p = new THREE.Vector3().setFromSphericalCoords(0.56, PI / 2 - b, a);
    put(g, deco(sph(r, black, 1, 1, 1)), p.x, 0.95 + p.y, p.z).scale.setScalar(0.5);
  }
  put(g, sph(0.24, white, 1.2, 1, 0.95), -0.72, 1.25, 0);
  put(g, sph(0.13, pink, 0.9, 0.8, 1.1), -0.95, 1.18, 0);
  for (const s of [-1, 1]) {
    put(g, cyl(0.05, 0.16, mat('#e9dfc8'), 'y', 0.01, 12), -0.7, 1.5, s * 0.14, [s * 0.3, 0, 0.2]);
    put(g, sph(0.07, black, 0.5, 1, 1.4), -0.66, 1.36, s * 0.26);
    put(g, deco(sph(0.03, black)), -0.9, 1.33, s * 0.11);
    for (const x of [-0.26, 0.26]) put(g, cyl(0.07, 0.5, white, 'y', 0.08, 14), x, 0.25, s * 0.24);
  }
  put(g, sph(0.14, pink, 1, 0.7, 1), 0.1, 0.4, 0);
  put(g, cyl(0.02, 0.4, white, 'x', 0.012, 10), 0.72, 0.9, 0, [0, 0, -0.9]);
  return g;
}

/* ───────────────────────────── shapes ───────────────────────────── */

const steel = () => mat('#c3cad6', { roughness: 0.25, metalness: 0.85 });

const shape = (fn) => () => {
  const g = G();
  put(g, fn());
  return g;
};

function golfBall() {
  const g = G();
  const geo = new THREE.IcosahedronGeometry(0.5, 14);
  const p = geo.attributes.position;
  const v = new THREE.Vector3();
  // Dimples from a Fibonacci lattice of centres.
  const centres = [];
  const n = 180;
  for (let i = 0; i < n; i++) {
    const yy = 1 - (2 * (i + 0.5)) / n;
    const r = Math.sqrt(1 - yy * yy);
    const a = i * 2.39996;
    centres.push(new THREE.Vector3(r * Math.cos(a), yy, r * Math.sin(a)));
  }
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    let best = -1;
    for (const c of centres) best = Math.max(best, v.dot(c));
    const d = Math.acos(Math.min(1, best)) / 0.11;
    const depth = d < 1 ? 0.02 * (1 - d * d) : 0;
    v.multiplyScalar(0.5 - depth);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  put(g, new THREE.Mesh(geo, mat('#fafafa', { roughness: 0.3 })));
  return g;
}

function skyline() {
  const g = G();
  const cols = ['#9fb3c8', '#6f8296', '#c9d3de', '#51657a', '#8a9db1'];
  const towers = [[-1.4, -0.6, 0.7, 3.2, 0.7], [-0.3, 0.5, 0.9, 4.6, 0.8], [0.9, -0.5, 0.8, 2.4, 0.9], [1.9, 0.6, 0.7, 3.6, 0.7],
    [-1.3, 0.75, 0.6, 1.6, 0.6], [0.6, 0.9, 0.5, 1.2, 0.6], [-0.2, -0.9, 0.7, 1.9, 0.6], [2.2, -0.6, 0.6, 1.4, 0.7]];
  towers.forEach(([x, z, w, h, d], i) => put(g, box(w, h, d, mat(cols[i % cols.length], { roughness: 0.35, metalness: 0.5 }), 0.03), x, h / 2, z));
  put(g, cyl(0.03, 0.9, steel()), -0.3, 5.05, 0.5);
  return g;
}

/* ───────────────────────────── catalogue ───────────────────────────── */

export const CATEGORIES = ['All', 'Vehicles', 'PC hardware', 'Food & fun', 'Shapes'];

export const PRESETS = [
  { id: 'f1', temp: 28, ref: 'Cd 0.7–1.1, Cl −2.5 to −3.5', name: 'F1 car', cat: 'Vehicles', desc: 'Open-wheel racer with front + rear wings and diffuser', real: 5.4, speed: 280, grounded: true, seed: 'inlet', build: f1Car },
  { id: 'sedan', turb: 3, ref: 'Cd 0.24–0.32', name: 'Sedan', cat: 'Vehicles', desc: 'Three-box family car', real: 4.6, speed: 120, grounded: true, build: sedan },
  { id: 'sports', temp: 22, name: 'Sports coupé', cat: 'Vehicles', desc: 'Low fastback with a rear wing and splitter', real: 4.5, speed: 200, grounded: true, ref: 'Cd 0.30–0.36', build: sportsCar },
  { id: 'suv', turb: 3, name: 'SUV', cat: 'Vehicles', desc: 'Tall two-box body with a blunt tail', real: 4.7, speed: 110, grounded: true, ref: 'Cd 0.33–0.40', build: suv },
  { id: 'pickup', turb: 3, ref: 'Cd 0.40–0.50', name: 'Pickup truck', cat: 'Vehicles', desc: 'Open bed makes a big recirculation bubble', real: 5.5, speed: 110, grounded: true, build: pickup },
  { id: 'semi', temp: 10, turb: 4, ref: 'Cd 0.6–0.9', name: 'Semi truck', cat: 'Vehicles', desc: 'Cab-over tractor and box trailer', real: 13, speed: 90, grounded: true, build: semi },
  { id: 'airliner', temp: -54, alt: 10700, name: 'Airliner', cat: 'Vehicles', desc: 'Twin-engine jet in cruise', real: 37, speed: 320, grounded: false, pitch: 3, build: airliner },
  { id: 'rocket', temp: -4, alt: 3000, ref: 'Cd 0.3–0.5', name: 'Rocket', cat: 'Vehicles', desc: 'Ogive nose, four fins', real: 6, speed: 350, grounded: false, build: rocket },
  { id: 'cyclist', temp: 20, ref: 'CdA 0.25–0.35 m²', name: 'Cyclist', cat: 'Vehicles', desc: 'Rider in the drops on a road bike', real: 1.75, speed: 45, grounded: true, build: cyclist },

  { id: 'pc-mesh', temp: 24, name: 'Mesh-front tower', cat: 'PC hardware', desc: 'Three intakes, rear + top exhaust. Free-breathing.', real: 0.5, speed: 0, grounded: true, seed: 'volume', fans: true, build: () => pcCase({ front: 'mesh' }) },
  { id: 'pc-glass', temp: 24, name: 'Glass-front tower', cat: 'PC hardware', desc: 'Sealed front panel: intakes starve through side gaps', real: 0.5, speed: 0, grounded: true, seed: 'volume', fans: true, build: () => pcCase({ front: 'glass', color: '#f1f2f4', accent: '#ff5fd2' }) },
  { id: 'pc-sff', temp: 24, name: 'Small form factor', cat: 'PC hardware', desc: 'Compact cube, one intake and one top exhaust', real: 0.33, speed: 0, grounded: true, seed: 'volume', fans: true, build: () => pcCase({ L: 0.34, H: 0.3, W: 0.2, frontFans: 1, topFans: 1, color: '#2a2f3a', accent: '#8cff8a' }) },
  { id: 'pc-bench', temp: 24, name: 'Open test bench', cat: 'PC hardware', desc: 'No panels: tower cooler and vertical GPU', real: 0.4, speed: 0, grounded: true, seed: 'volume', fans: true, build: openBench },
  { id: 'gpu', temp: 24, name: 'Graphics card', cat: 'PC hardware', desc: 'Triple-fan cooler blowing into the heatsink', real: 0.3, speed: 0, grounded: false, seed: 'volume', fans: true, build: gpuCard },

  { id: 'sandwich', temp: 20, name: 'Sandwich', cat: 'Food & fun', desc: 'Club sandwich. Surprisingly bluff.', real: 0.14, speed: 30, grounded: false, pitch: -6, build: sandwich },
  { id: 'burger', temp: 20, name: 'Burger', cat: 'Food & fun', desc: 'Sesame bun, single patty', real: 0.11, speed: 30, grounded: true, build: burger },
  { id: 'donut', temp: 20, name: 'Donut', cat: 'Food & fun', desc: 'Air threads straight through the hole', real: 0.1, speed: 25, grounded: false, build: donut },
  { id: 'mug', temp: 20, name: 'Coffee mug', cat: 'Food & fun', desc: 'Open cavity with a handle in the wake', real: 0.1, speed: 20, grounded: true, build: mug },
  { id: 'duck', temp: 20, name: 'Rubber duck', cat: 'Food & fun', desc: 'The classic debugging companion', real: 0.09, speed: 20, grounded: true, build: duck },
  { id: 'cow', temp: 14, turb: 8, name: 'Spherical cow', cat: 'Food & fun', desc: 'Assume a spherical cow in a wind tunnel', real: 2.2, speed: 40, grounded: true, build: sphericalCow },

  { id: 'sphere', ref: 'Cd 0.47 (0.1–0.2 above Re 3×10⁵)', name: 'Sphere', cat: 'Shapes', desc: 'The reference bluff body', real: 0.2, speed: 80, grounded: false, build: shape(() => sph(0.5, steel())) },
  { id: 'golf', temp: 22, ref: 'Cd ≈ 0.25', name: 'Golf ball', cat: 'Shapes', desc: 'Dimpled sphere', real: 0.043, speed: 250, grounded: false, build: golfBall },
  { id: 'cube', ref: 'Cd ≈ 1.05', name: 'Cube', cat: 'Shapes', desc: 'Sharp edges, fixed separation', real: 0.2, speed: 80, grounded: false, build: shape(() => box(1, 1, 1, steel())) },
  { id: 'cylinder', ref: 'Cd 1.0–1.2, St ≈ 0.2', name: 'Cylinder', cat: 'Shapes', desc: 'Crossflow cylinder: von Kármán vortex street', real: 0.3, speed: 60, grounded: false, slice: true, build: shape(() => cyl(0.25, 2.2, steel(), 'z')) },
  { id: 'airfoil', ref: 'section Cl ≈ 1.1 at 8°', name: 'Airfoil', cat: 'Shapes', desc: 'NACA 2412 wing section at 8° angle of attack', real: 1.5, speed: 200, grounded: false, pitch: 8, slice: true, build: shape(() => extrude(naca(1.5), 1.9, steel())) },
  { id: 'plate', ref: 'Cd 1.17–1.28', name: 'Flat plate', cat: 'Shapes', desc: 'Plate normal to the flow: maximum drag', real: 0.5, speed: 80, grounded: false, build: shape(() => box(0.06, 1, 1, steel())) },
  { id: 'teardrop', ref: 'Cd 0.04–0.09', name: 'Teardrop', cat: 'Shapes', desc: 'Streamlined body of revolution', real: 1.0, speed: 200, grounded: false,
    build: shape(() => lathe(Array.from({ length: 33 }, (_, i) => { const x = i / 32; return [4.5 * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4) * (i === 32 ? 0 : 1), x * 3]; }), steel())) },
  { id: 'skyline', temp: 12, turb: 12, name: 'City block', cat: 'Shapes', desc: 'Urban canyon wind between towers', real: 180, speed: 60, grounded: true, build: skyline },
];
