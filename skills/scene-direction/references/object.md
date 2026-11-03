# The object: make the subject's own thing, and make it well

One hero object that really belongs to the subject beats a scene full of effects. Spend the effort on its silhouette, its material and its details.

## A model is supplied (glTF/GLB)

It's the hero: don't swap it for a primitive, and don't recolour it by hand.

```js
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
const gltf = await new GLTFLoader().loadAsync('model.glb');
gltf.scene.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
scene.add(gltf.scene);
```

- Give it reflections, or PBR materials look dead: `scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment()).texture`, with `RoomEnvironment` from `three/addons/environments/RoomEnvironment.js`. Tune with `scene.environmentIntensity`.
- Frame it with a fit for the current aspect ratio, on every resize (framing.md).
- If the file has **colourways** (`KHR_materials_variants`), use them. Core `GLTFLoader` keeps the data in `userData` but doesn't switch variants itself. This recipe is tested on three r187:

```js
const parser = gltf.parser;
const variantNames = gltf.userData.gltfExtensions?.KHR_materials_variants?.variants.map((v) => v.name) ?? [];
gltf.scene.traverse((o) => { if (o.material) o.userData.originalMaterial = o.material; });

async function selectVariant(name) {
  const index = variantNames.indexOf(name);
  const jobs = [];
  gltf.scene.traverse((o) => {
    const ext = o.userData.gltfExtensions?.KHR_materials_variants;
    if (!o.isMesh || !ext) return;
    const mapping = ext.mappings.find((m) => m.variants.includes(index));
    jobs.push((mapping ? parser.getDependency('material', mapping.material) : Promise.resolve(o.userData.originalMaterial))
      .then((m) => { o.material = m; if (mapping) parser.assignFinalMaterial(o); }));
  });
  await Promise.all(jobs);
}
```

Read the variant names from the file (e.g. `midnight`, `beach`, `street`) and label the buttons from them. Don't guess colours for swatches: take them from the variant's material (`material.color`, or a small render of it).

## No model: build it in code

Most good 3D sites use far fewer polygons than people think. What they use is better silhouettes. Pick the geometry that matches how the real thing is made:

| The real thing is… | Use | Notes |
|---|---|---|
| a device, a box, a slab (laptop, phone, speaker, card) | `RoundedBoxGeometry` (`three/addons/geometries/RoundedBoxGeometry.js`) | sharp boxes read as placeholders; a 2–6% corner radius reads as manufactured |
| a custom flat silhouette (a logo, a tag, a rounded slab) | `ExtrudeGeometry` of a `THREE.Shape`, with `bevelEnabled`, `bevelSize`/`bevelThickness` about 1% of the size, `bevelSegments` 6–10 | `geometry.center()` after extruding |
| turned on a wheel or a lathe (bowl, cup, vase, bottle, lamp) | `LatheGeometry(points, 96)` from a profile of `Vector2(radius, height)` | the profile is the design: draw it from the real piece, lip and foot included |
| a cable, a rail, a route | `TubeGeometry(curve, …)` on a `CatmullRomCurve3` | the same curve can drive the camera |
| many of one thing (keys, trees, rooms, tiles) | `InstancedMesh` | one draw call; vary scale and rotation per instance |
| land (a valley, a slope) | `PlaneGeometry` with height from a noise function, low resolution, flat-shaded or softly lit | fog in the page colour; a few hero props (the hut, the cable car) |

A turned bowl:

```js
const profile = [[0, 0], [0.42, 0], [0.46, 0.03], [0.5, 0.06], [0.78, 0.32], [0.92, 0.55], [0.95, 0.6], [0.9, 0.6], [0.74, 0.36], [0.44, 0.1], [0, 0.08]]
  .map(([r, y]) => new THREE.Vector2(r, y));
const bowl = new THREE.Mesh(new THREE.LatheGeometry(profile, 128),
  new THREE.MeshPhysicalMaterial({ color: '#d9cbb3', roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.35 }));
```

Handmade things aren't perfect. Jitter the vertices a little (±0.3% of the size) so the light breaks the way it does on clay or wood.

## Details: draw them with the site's own type

Labels, stickers, a screen, signage and price tags are what make an object belong to *this* subject. Draw them on a 2D canvas with the page's fonts, then use the canvas as a texture:

```js
await document.fonts.ready;                       // or the canvas falls back to a default font
const c = document.createElement('canvas'); c.width = 1024; c.height = 512;
const g = c.getContext('2d');
g.fillStyle = '#f7d774'; g.beginPath(); g.roundRect(24, 24, 976, 464, 60); g.fill();
g.fillStyle = '#111'; g.font = `700 160px ${getComputedStyle(document.documentElement).getPropertyValue('--font-display')}`;
g.fillText('LDN', 90, 320);
const tex = new THREE.CanvasTexture(c);
tex.colorSpace = THREE.SRGBColorSpace;
tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
```

A canvas texture can also be live: a terminal that types, a clock, a counter. Set `tex.needsUpdate = true` after drawing.

## The bar for an object built in code

Juries compare your object with scanned and hand-modelled ones. Before you call it done:
- **Every edge is bevelled or rounded.** A sharp box edge reads as a placeholder at any size.
- **Real proportions**, measured from the real thing, in metres. A part that is "about right" looks wrong next to a scanned prop.
- **Three or more materials**, one per real material, and none of them a single flat roughness on a large surface (finish.md §5).
- **The detail where the camera looks.** The macro scene's focus point gets the best geometry: the joint, the stitching, the engraving, the label.
- **Imperfection for handmade things**: a little vertex jitter, a slightly uneven glaze, wear on the edges.

## The world around it

The subject is never alone on a void. Give it the table, the room, the land, the collection (ambition, SKILL.md). Props and surfaces at the sheet's fidelity come from the library (assets.md): a scanned chair, a plank floor, a potted plant, at real scale, tinted into the palette. Build what the library can't give you (the subject's own architecture, a custom display) in the same fidelity.

## Materials

- `MeshStandardMaterial` for most things. Roughness 0.35–0.7 reads as a real surface; 0 and 1 rarely do.
- `MeshPhysicalMaterial` when the surface has a coat: glaze and lacquer (`clearcoat`), fabric (`sheen`), real glass (`transmission`, `thickness`, `ior`; it needs an environment and costs a render pass, so use it for glass only).
- Metal needs an environment map, or it renders black.
- One material per real material. A shoe has mesh, foam and rubber. A hut has timber, glass and snow.

## Scale and units

Build in real units (metres): a shoe is 0.3 m long, a bowl 0.2 m across, a laptop 0.31 m. Shadows, fog distances and light falloff then behave predictably, and the parts of the scene agree with each other.
