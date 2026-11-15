# windsim — 3D wind tunnel

**Live: https://gkson-lab.github.io/windsim/**

A real-time, in-browser 3D wind tunnel. Drop an object into the test section and watch the air go around (or through) it: smoke streaks, cut planes, pressure maps and live drag/lift numbers.

![windsim running the F1 car preset](docs/screenshot.png)

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static site in dist/ (deploy anywhere)
npm test         # solver sanity checks
```

No backend. Everything runs client-side. Every push to `main` is tested, built and published to the `gh-pages` branch by `.github/workflows/pages.yml`; GitHub Pages serves that branch.

## What it does

- **Real 3D fluid solver** — a D3Q19 lattice-Boltzmann method with a Smagorinsky LES turbulence model, running in a Web Worker so the UI stays smooth. Four cell budgets from about 65k (Draft) to 1M (Ultra).
- **28 presets** — F1 car, sedan, sports coupé, SUV, pickup, semi truck, airliner, rocket, cyclist; four PC builds and a graphics card with working fans; sandwich, burger, donut, coffee mug, rubber duck, spherical cow; sphere, golf ball, cube, cylinder, airfoil, flat plate, teardrop, city block.
- **Bring your own model** — drag in a GLB, glTF (with its .bin/textures), OBJ, STL, PLY or FBX. It is voxelised on the spot; open or messy meshes are fine.
- **PC airflow** — case fans are actuator discs that actually push air. Set wind to zero to see pure fan-driven flow, compare a mesh front against a sealed glass front, or add a cross-breeze.
- **Visualisation** — smoke as a sheet, a rake of streaklines or a volume cloud, coloured by speed or pressure; a movable cut plane showing speed, pressure coefficient or vorticity; and a *Solver view* that shows the voxel body the solver sees, painted with surface pressure.
- **Test section fitted to the subject** — the tunnel is sized around whatever is in it (long and low for a car, tall for a tower PC, wide for an airliner), so the lattice cells go where the object is and different subjects are easy to compare by eye. Rotating the subject re-fits it; "Room around subject" loosens or tightens the fit.
- **Air to match the subject** — each preset starts in the air it normally meets: thin −54 °C air at 10,700 m for the airliner, 24 °C room air for the PCs, a gusty 12 % turbulence for the city block. Temperature and altitude stay adjustable; density, viscosity, speed of sound, Reynolds and Mach numbers follow (ISA atmosphere, Sutherland viscosity).
- **Smoke density follows the subject** — the density slider sets lines per unit of seeded cross-section, so small and large subjects are covered equally.
- **Tunnel conditions** — moving-belt or fixed (no-slip) floor, and 0–20 % inlet turbulence for gusty, real-world air.
- **Telemetry** — drag, lift and side-force coefficients, forces in newtons, drag power (kW/hp), drag area CdA, dynamic pressure, frontal area, blockage, peak air speed, surface pressure extremes, vortex-shedding frequency and Strouhal number, simulated flow time, plus a real-world reference value for most presets.
- **Fan airflow** — throughput of every case fan in m³/h and CFM, and how it compares with the fans' free-air rating (calibrated so an unobstructed fan moves air at 2.5 m/s, a typical 120 mm case fan).
- **Probe and export** — hover the cut plane for local velocity and pressure; export the force history with the full test setup as CSV.
- **Controls** — yaw, pitch (angle of attack), roll, scale, floor contact, wind speed, fan power. Geometry changes re-voxelise live without restarting the flow.

Keys: `Space` pause, `R` restart the flow. `?preset=<id>` in the URL opens a preset directly.

## How it works

| Piece | File |
| --- | --- |
| LBM kernel (code-generated, unrolled stream+collide loop) | `src/sim/kernel.js` |
| Worker loop, field streaming | `src/sim/worker.js` |
| Mesh → voxels (3-axis ray parity + surface capture) | `src/sim/voxelize.js` |
| Smoke streaks, cut plane, voxel pressure view | `src/viz/` |
| Procedural presets | `src/presets/` |
| Model import | `src/loaders.js` |
| App, scene, UI | `src/main.js` |

Boundaries: velocity inlet, zero-gradient outlet, free-slip floor/walls (equivalent to a moving ground), halfway bounce-back on solids. Forces come from momentum exchange on the bounce-back links.

## Accuracy — read this before quoting numbers

This is an interactive visual tool, not certified CFD.

- The grid is coarse (an object is typically 20–50 cells long), so the simulated Reynolds number is capped far below the real one; the LES model stands in for the unresolved turbulence. The HUD shows both values.
- Bluff bodies (cube, plate, trucks, sandwich) give reasonable drag coefficients. Streamlined bodies (teardrop, airfoil) read too high because stair-stepped surfaces and unresolved boundary layers add drag.
- Gaps thinner than about two cells close up. Ground effect under a low car is not resolved at Draft/Standard, so the F1 car shows lift where a real one makes downforce. Use Fine or Ultra and a larger scale for anything that depends on small gaps.
- The fitted test section is tight (blockage is often 10–25 %), so coefficients include a solid-blockage correction, (1 − blockage)². Raise "Room around subject" for a more open tunnel at the cost of resolution.
- Forces in newtons are the measured coefficient scaled to your wind speed and the "Real size" field.
- Fans are idealised actuator discs calibrated to a typical case fan in free air; they have no fan curve, swirl or blade detail. Use the airflow numbers to compare layouts, not as absolute CFM.
- Above about Mach 0.3 real air compresses; the solver does not model that.
- Models are procedural approximations of each object, not CAD of any specific product.
