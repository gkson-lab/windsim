// Small modelling kit used by the procedural presets.
// Conventions: +x is downstream (noses point to -x), +y is up, units are metres.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

export const mat = (color, o = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1, ...o });

export const glass = (color = '#9fd8ff', opacity = 0.22) =>
  new THREE.MeshPhysicalMaterial({
    color,
    roughness: 0.05,
    metalness: 0,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

const hidden = new THREE.MeshBasicMaterial({ visible: false });

export function box(w, h, d, m, r = 0) {
  const rr = Math.min(r, w * 0.49, h * 0.49, d * 0.49);
  return new THREE.Mesh(rr > 0 ? new RoundedBoxGeometry(w, h, d, 3, rr) : new THREE.BoxGeometry(w, h, d), m);
}

export function cyl(r, len, m, axis = 'y', rTop = r, seg = 40) {
  const g = new THREE.CylinderGeometry(rTop, r, len, seg);
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  return new THREE.Mesh(g, m);
}

export function sph(r, m, sx = 1, sy = 1, sz = 1) {
  const g = new THREE.SphereGeometry(r, 40, 28);
  g.scale(sx, sy, sz);
  return new THREE.Mesh(g, m);
}

export function torus(R, r, m, arc = Math.PI * 2) {
  return new THREE.Mesh(new THREE.TorusGeometry(R, r, 20, 56, arc), m);
}

/** Extrude an (x, y) outline along z, centred on z = 0. */
export function extrude(pts, depth, m, bevel = 0) {
  const shape = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: bevel > 0,
    bevelSize: bevel,
    bevelThickness: bevel,
    bevelSegments: 3,
    curveSegments: 16,
  });
  g.translate(0, 0, -depth / 2);
  return new THREE.Mesh(g, m);
}

/** Extrude an (x, z) planform along y (for wings and plates), centred on y = 0. */
export function planform(pts, thick, m, bevel = 0) {
  const mesh = extrude(pts, thick, m, bevel);
  mesh.geometry.rotateX(Math.PI / 2);
  return mesh;
}

/** Revolve an (r, s) profile around the x axis; s runs downstream. */
export function lathe(pts, m, axis = 'x') {
  const g = new THREE.LatheGeometry(pts.map(([r, s]) => new THREE.Vector2(r, s)), 56);
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  return new THREE.Mesh(g, m);
}

export function put(parent, mesh, x = 0, y = 0, z = 0, rot = null) {
  mesh.position.set(x, y, z);
  if (rot) mesh.rotation.set(rot[0], rot[1], rot[2]);
  mesh.traverse((o) => {
    if (o.isMesh && o.material !== hidden) o.castShadow = o.receiveShadow = true;
  });
  parent.add(mesh);
  return mesh;
}

/** Mark a mesh (or subtree) as decoration only: drawn, but invisible to the solver. */
export function deco(obj) {
  obj.traverse((o) => (o.userData.noVoxel = true));
  return obj;
}

export function wheel(r, width, tire = mat('#15161a', { roughness: 0.85 }), rim = mat('#b9c0cc', { metalness: 0.8, roughness: 0.25 })) {
  const g = new THREE.Group();
  g.add(cyl(r, width, tire, 'z'));
  g.add(deco(cyl(r * 0.58, width * 1.04, rim, 'z')));
  return g;
}

export function naca(chord, m = 0.02, p = 0.4, t = 0.12, n = 40) {
  const upper = [];
  const lower = [];
  for (let i = 0; i <= n; i++) {
    const x = 0.5 * (1 - Math.cos((Math.PI * i) / n));
    const yt = 5 * t * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    const yc = m === 0 ? 0 : x < p ? (m / p ** 2) * (2 * p * x - x * x) : (m / (1 - p) ** 2) * (1 - 2 * p + 2 * p * x - x * x);
    upper.push([(x - 0.5) * chord, (yc + yt) * chord]);
    lower.push([(x - 0.5) * chord, (yc - yt) * chord]);
  }
  return [...upper, ...lower.reverse().slice(1, -1)];
}

/**
 * Axial fan. Air is pushed along the group's local +y axis; rotate the group
 * to aim it. The invisible disc is the actuator zone the solver sees.
 */
export function fan(r, { strength = 1, thick = 0.028, color = '#20242c', frame = true } = {}) {
  const g = new THREE.Group();
  const zone = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.92, r * 0.92, thick, 24), hidden);
  zone.userData.fan = { strength, radius: r * 0.92 };
  g.add(zone);

  const body = mat(color, { roughness: 0.6 });
  const ring = torus(r, r * 0.07, body);
  ring.geometry.rotateX(Math.PI / 2);
  g.add(deco(ring));
  if (frame) {
    // Square 25 mm-style frame with corner webs.
    const side = r * 2.12;
    const f = new THREE.Group();
    for (const [x, z, w, d] of [[0, side / 2, side, r * 0.1], [0, -side / 2, side, r * 0.1], [side / 2, 0, r * 0.1, side], [-side / 2, 0, r * 0.1, side]]) {
      const bar = box(w, thick * 0.9, d, body);
      bar.position.set(x, 0, z);
      f.add(bar);
    }
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const web = box(r * 0.42, thick * 0.9, r * 0.42, body, r * 0.05);
        web.position.set(sx * (side / 2 - r * 0.17), 0, sz * (side / 2 - r * 0.17));
        f.add(web);
      }
    g.add(deco(f));
  }
  const spin = new THREE.Group();
  spin.userData.spin = strength;
  spin.add(cyl(r * 0.28, thick, body));
  const bladeMat = mat('#aeb9c9', { roughness: 0.35, transparent: true, opacity: 0.9 });
  for (let i = 0; i < 7; i++) {
    const pivot = new THREE.Group();
    pivot.rotation.y = (i / 7) * Math.PI * 2;
    const blade = box(r * 0.66, thick * 0.12, r * 0.34, bladeMat);
    blade.position.x = r * 0.58;
    blade.rotation.x = 0.5;
    pivot.add(blade);
    spin.add(pivot);
  }
  g.add(deco(spin));
  return g;
}

/** Aim a fan (built blowing +y) along a principal direction. */
export function aim(fanGroup, dir) {
  if (dir === '+x') fanGroup.rotation.z = -Math.PI / 2;
  else if (dir === '-x') fanGroup.rotation.z = Math.PI / 2;
  else if (dir === '-y') fanGroup.rotation.z = Math.PI;
  else if (dir === '+z') fanGroup.rotation.x = Math.PI / 2;
  else if (dir === '-z') fanGroup.rotation.x = -Math.PI / 2;
  return fanGroup;
}

export { THREE };

/* ───────────── smooth lofted bodies ───────────── */

/**
 * Skin a closed surface over a list of rings (each an equal-length array of
 * [x, y, z]). Ends are capped. Used for car bodies, fuselages and wings.
 */
export function skin(rings, m) {
  const M = rings[0].length;
  const pos = [];
  const idx = [];
  for (const ring of rings) for (const p of ring) pos.push(p[0], p[1], p[2]);
  for (let k = 0; k < rings.length - 1; k++)
    for (let j = 0; j < M; j++) {
      const a = k * M + j;
      const b = k * M + ((j + 1) % M);
      const c = (k + 1) * M + ((j + 1) % M);
      const d = (k + 1) * M + j;
      idx.push(a, b, c, a, c, d);
    }
  // Caps use their own vertices so the rim stays crisp.
  for (const [ring, flip] of [[rings[0], true], [rings[rings.length - 1], false]]) {
    const base = pos.length / 3;
    const c = [0, 0, 0];
    for (const p of ring) {
      pos.push(p[0], p[1], p[2]);
      c[0] += p[0] / M; c[1] += p[1] / M; c[2] += p[2] / M;
    }
    pos.push(c[0], c[1], c[2]);
    for (let j = 0; j < M; j++) {
      const a = base + j;
      const b = base + ((j + 1) % M);
      flip ? idx.push(base + M, b, a) : idx.push(base + M, a, b);
    }
  }
  // Make sure faces point outwards (positive enclosed volume).
  let vol = 0;
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    vol += pos[a] * (pos[b + 1] * pos[c + 2] - pos[b + 2] * pos[c + 1])
      - pos[a + 1] * (pos[b] * pos[c + 2] - pos[b + 2] * pos[c])
      + pos[a + 2] * (pos[b] * pos[c + 1] - pos[b + 1] * pos[c]);
  }
  if (vol < 0) for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return new THREE.Mesh(g, m);
}

/**
 * Loft superellipse cross-sections along x.
 * Station: { x, w, h, y = centre height, z = 0, n = 2.5 (top roundness), nb = n (bottom) }.
 * Stations are smoothed with a Catmull-Rom spline into `sub` slices each.
 */
export function loft(stations, m, { seg = 36, sub = 6 } = {}) {
  const keys = ['x', 'w', 'h', 'y', 'z', 'n', 'nb'];
  const st = stations.map((s) => ({ y: 0, z: 0, n: 2.5, ...s, nb: s.nb ?? s.n ?? 2.5 }));
  const cr = (p0, p1, p2, p3, t) =>
    0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3);
  const fine = [];
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[Math.max(0, i - 1)], b = st[i], c = st[i + 1], d = st[Math.min(st.length - 1, i + 2)];
    for (let k = 0; k < sub; k++) {
      const t = k / sub;
      const s = {};
      for (const key of keys) s[key] = key === 'x' ? b.x + (c.x - b.x) * t : cr(a[key], b[key], c[key], d[key], t);
      s.w = Math.max(1e-4, s.w);
      s.h = Math.max(1e-4, s.h);
      fine.push(s);
    }
  }
  fine.push(st[st.length - 1]);
  const rings = fine.map((s) => {
    const ring = [];
    for (let j = 0; j < seg; j++) {
      const a = (j / seg) * Math.PI * 2;
      const cs = Math.cos(a), sn = Math.sin(a);
      const e = 2 / Math.max(1.2, sn >= 0 ? s.n : s.nb);
      ring.push([s.x, s.y + (s.h / 2) * Math.sign(sn) * Math.abs(sn) ** e, s.z + (s.w / 2) * Math.sign(cs) * Math.abs(cs) ** e]);
    }
    return ring;
  });
  return skin(rings, m);
}

/**
 * A wing built from airfoil sections. Sections: { z, chord, x = leading-edge
 * offset, y = 0, twist = 0 (rad, nose-down positive) }. `camber` < 0 inverts
 * the section (race-car wings).
 */
export function wing(sections, m, { thick = 0.12, camber = 0.02 } = {}) {
  const rings = sections.map((s) => {
    const prof = naca(1, Math.abs(camber), 0.4, thick, 18);
    const c = Math.cos(s.twist ?? 0), sn = Math.sin(s.twist ?? 0);
    return prof.map(([px, py]) => {
      const x = (px + 0.5) * s.chord;
      const y = py * s.chord * Math.sign(camber || 1);
      return [(s.x ?? 0) + x * c - y * sn, (s.y ?? 0) - x * sn + y * c, s.z];
    });
  });
  return skin(rings, m);
}

/** Tyre with rounded shoulders plus a spoked rim. Axle along z. */
export function tire(r, width, { rim = '#b9c0cc', spokes = 5 } = {}) {
  const g = new THREE.Group();
  const c = Math.min(width * 0.32, r * 0.25);
  const prof = [[0, -width / 2]];
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    prof.push([r - c + c * Math.sin(a), -width / 2 + c - c * Math.cos(a)]);
  }
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    prof.push([r - c + c * Math.cos(a), width / 2 - c + c * Math.sin(a)]);
  }
  prof.push([0, width / 2]);
  const rubber = lathe(prof, mat('#111215', { roughness: 0.9 }), 'y');
  rubber.geometry.rotateX(Math.PI / 2);
  g.add(rubber);
  const rimMat = mat(rim, { metalness: 0.85, roughness: 0.25 });
  const d = new THREE.Group();
  d.add(cyl(r * 0.62, width * 1.02, mat('#1c1e23', { roughness: 0.6 }), 'z'));
  const hoop = torus(r * 0.6, r * 0.045, rimMat);
  for (const s of [-1, 1]) {
    const h = hoop.clone();
    h.position.z = s * width * 0.5;
    d.add(h);
    const hub = cyl(r * 0.16, width * 0.06, rimMat, 'z');
    hub.position.z = s * width * 0.52;
    d.add(hub);
    for (let i = 0; i < spokes; i++) {
      const sp = box(r * 0.5, r * 0.09, width * 0.05, rimMat);
      const a = (i / spokes) * Math.PI * 2;
      sp.position.set(Math.cos(a) * r * 0.33, Math.sin(a) * r * 0.33, s * width * 0.51);
      sp.rotation.z = a;
      d.add(sp);
    }
  }
  g.add(deco(d));
  return g;
}
