# Finish: light, grounding, post-processing, performance

The difference between a 3D demo and a 3D site that wins awards is mostly here: light that has a direction and a source, an object that sits on something, a frame that is graded rather than raw, and all of it running smoothly on a phone. The starter has the whole pipeline; this file is how to tune it.

## 1. Light: a rig that flatters

Three lights cover almost every stage. Colours come from the palette (colour-world.md):

```js
const hemi = new THREE.HemisphereLight(sky, floor, 0.6);       // the room's colour, from the ground
const key = new THREE.DirectionalLight(0xfff4e6, 2.2);         // shape + the one shadow
key.position.set(3, 6, 4);                                      // high, to one side, in front
key.castShadow = true; key.shadow.mapSize.setScalar(2048);      // 1024 on phones
key.shadow.radius = 6; key.shadow.bias = -0.0005;               // soft edge (r187 has no PCFSoftShadowMap)
const rim = new THREE.DirectionalLight(accent, 1.4);            // behind and opposite the key
rim.position.set(-4, 2.5, -5);
```

- Keep the shadow camera tight around the subject (about 2× its size). A loose one gives blurry, blocky shadows.
- **A light source inside the frame** gives the eye somewhere to land: a lit window, a screen, a lamp, a neon sign. Make it emissive with an intensity above 1 (`emissiveIntensity: 2–6`), so it is the only thing bright enough to bloom.
- No more than three dynamic lights. Beyond that, bake (a lightmap) or fake (an emissive card, a radial-gradient decal).

## 2. Environment: real light from a real place

Reflections are what make a material read as real; metal without them renders black. Use a downloaded Poly Haven HDRI (the sheet names two that fit the direction) for light and reflections only:

```bash
node <skill>/scripts/assets.mjs get studio_small_08 --out assets
```
```js
const FINISH = { env: 'assets/studio_small_08_1k.hdr', envIntensity: 0.6, envRotation: 1.2, ... };
```

- **Never show the HDRI as the background.** A stock sky behind a designed page is a tell. The background is the CSS ground (colour-world.md).
- Turn it (`envRotation`, radians) until its brightest window sits on the key light's side; the highlights then agree with the shadow.
- `envIntensity` 0.3–0.5 for night and noir, 0.6–0.9 for daylight and studio.
- 1k is enough for lighting. Use 2k only if a mirror-like surface fills the frame.

## 3. Ground it

An object floating in space is a tell. The starter gives it two kinds of contact:

- **A shadow catcher**: a `ShadowMaterial` floor at the subject's base (`opacity` 0.18–0.3) for the key light's cast shadow.
- **Ambient occlusion** (N8AO): the soft darkening where things meet, which cast shadows miss: under a cup, between keys, where a chair leg meets the floor. `FINISH.ao` is its intensity (2–3.5); the starter sets its radius from the subject's size. Paper layers, rooms and still lifes want more; a single product in the air wants less.

## 4. Post-processing: a graded frame, not a filter

The starter runs one chain (pmndrs `postprocessing` 6.39 with `n8ao` 2.0): render → AO → bloom → vignette → tone mapping → SMAA. Tune it from the sheet's `FINISH` block:

| Effect | Range | Use it for | The tell when overdone |
|---|---|---|---|
| bloom | 0.1–0.6, threshold 0.85–0.98 | emissive sources and sun on metal | a haze over everything; the subject's white surfaces glowing |
| vignette | 0.15–0.5 | holding the eye in the frame; darker for night and noir | a dark tunnel on light grounds |
| AO | 2–3.5 | contact and depth | dirty halos around everything |
| fog | the sheet's value, in subject sizes | depth in worlds and landscapes | the subject itself fading |
| tone mapping | `NEUTRAL` (default) or `AGX` | Neutral keeps the page colours exact; AgX for photoreal outdoor scenes | AgX turning a designed palette grey |

Rules:
- Tone mapping is the last colour step, inside the chain (`renderer.toneMapping = NoToneMapping`; the effect does it). The renderer runs with `antialias: false`; SMAA does it after tone mapping.
- Bloom is selective by brightness: keep ordinary surfaces below the threshold and push only the sources above 1. If the whole object glows, lower the lights, not the threshold.
- **Depth of field** (`DepthOfFieldEffect`) only for a macro scene, briefly, and never on phones.
- **Chromatic aberration**, glitch and displacement only in transitions, on the parts that move (Igloo Inc used it that way), never as a permanent look.
- Grain stays a CSS overlay (colour-world.md §7): it costs nothing and covers the type too.

## 5. Rich, not milky

In blind tests the person judging picked the saturated, contrasty build every time the other was pale and hazy, even when the hazy one was more ambitious. Haze is not atmosphere.
- **Every frame has a true dark and a saturated colour**: a shadow, a dark object, the ink, a lit window, a coloured ground. A frame that is all pastel reads as washed out.
- **Fog is for distance in a world** (terrain, a city, a valley): it starts well beyond the subject (`near` at least twice the camera's distance to the subject) and only swallows what is far away. In a close object scene, use no fog.
- **On a light ground, be careful with fog and bloom.** Both push toward white. Give a light direction a dark, saturated subject or props, and keep the vignette and AO doing the depth.
- No blur over the frame, and no `backdrop-filter` frosting over the canvas: it reads as a hazy screenshot. A solid or gradient scrim is sharper.

## 6. Materials that read as real

- One material per real material. A bicycle has steel tubes, leather and rubber; a café has tile, brass and marble.
- Roughness is never a single number on a large surface. Use a Poly Haven texture's roughness map (assets.md), or break it with a noise texture, so the light breaks across it.
- `MeshPhysicalMaterial` for coats and glass: `clearcoat` for glaze and lacquer, `sheen` for fabric, `transmission` + `thickness` + `ior` for real glass (it costs a pass; glass only).
- Put the detail where the camera looks. The macro shot's focus point deserves the best geometry and texture on the page; what the camera only sees from far away can be simple (Lusion's Oryzo spent 90% of its texture detail on the half of the desk the camera lingers on).

## 7. Performance is part of the look

Juries test on phones, and a WebGL hero at 20 fps reads as broken. The starter already does the main things:

- Pixel ratio capped at 2, and **quality steps**: if frames stay slow, it renders fewer pixels (2 → 1.5 → 1.25 → 1).
- A phone preset: AO at low quality, 1024 shadow maps. Add your own (fewer props, no DOF) under the same `small` flag.
- One clock (`gsap.ticker`), which sleeps when the tab is hidden.
- `renderer.compileAsync` during the intro, so the first scroll doesn't stutter while shaders compile.

Also:
- Instancing for repeats (`InstancedMesh`), shared geometries and materials, nothing allocated inside the frame loop.
- About 100 draw calls on a phone; the check prints the count.
- Page weight under about 5 MB: 1k textures, a handful of props, compressed models (`gltf-transform optimize` with meshopt and KTX2; the cloudai-x `threejs-asset-pipeline` skill covers it).
- The check reports the frame time on its GPU and flags anything below 40 fps there, because a phone is several times slower.
