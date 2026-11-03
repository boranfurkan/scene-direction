# Assets: a real world around the subject

Agents model boxes. Award sites put the subject in a believable place: a desk, a workshop, a harbour, a shelf. You can't sculpt a chair, a fern or a weathered floor in code in an afternoon, but you don't have to: Poly Haven has about 520 photo-scanned models, 870 PBR textures and 1000 HDRIs, all CC0 (free for any use, no attribution required).

## The rule: one fidelity per site

The sheet says which:
- **photoreal**: scanned props, PBR surfaces, an HDRI, and the subject built to the same standard (real proportions, bevels, real material maps).
- **stylised**: everything built in code in one visual language (toy, paper, blueprint, type). No scanned props: a photoreal fern next to a flat-shaded box looks like a mistake.
- **either**: choose one of the two and hold it.

The subject is still the subject's own thing: a supplied model, or built in code (object.md). The library gives you **the world around it**: the table it sits on, the room, the land, the props that tell its story.

## Find, look, then download

```bash
node <skill>/scripts/assets.mjs search chair wood --type models --sheet .scene-direction/props.png
node <skill>/scripts/assets.mjs search oak floor --type textures --sheet .scene-direction/surfaces.png
node <skill>/scripts/assets.mjs search sunset field --type hdris
node <skill>/scripts/assets.mjs get modern_arm_chair_01 wood_floor lebombo --out assets
```

- `search` ranks by tags, categories and name, and prints each model's real size and triangle count. `--sheet` writes a contact sheet of previews: **look at it before you pick**. Names don't tell you whether a chair is Victorian or modern.
- `get` downloads into the project (a glTF with its textures and buffers; a texture's colour, normal and roughness maps; an HDRI) and prints the code to load it. The site hosts its own files: no live API, no hotlinking, nothing to credit (a credit line is still a nice touch).

## Place props like a set dresser

- **Real scale.** glTF units are metres, and the scans are measured: a chair is about 0.8 m tall, a vase 0.3 m. Scale the subject to match, never the props to the subject.
- **Fewer, closer.** Three to six props, grouped where the camera looks. A prop that is only ever a speck in a wide shot is page weight for nothing.
- **Tell the story.** A record label's crates and a turntable, a glasshouse's pots and a watering can, a frame builder's vice and tubes on the bench. Pick props for the beats, not for filling.
- **Into the palette.** Multiply `material.color` toward the ground or ink so scans don't bring their own colours into the world; keep the subject's own colours untouched.
- **Shadows.** `castShadow`/`receiveShadow` on the props near the subject; AO does the rest.

## Surfaces

A floor, a wall or a tabletop with a real texture is the cheapest realism there is.

```js
const tl = new THREE.TextureLoader();
const tex = (f, srgb) => { const t = tl.load(f); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
const floorMat = new THREE.MeshStandardMaterial({
  map: tex('assets/wood_floor/wood_floor_diff_1k.jpg', true),
  normalMap: tex('assets/wood_floor/wood_floor_nor_gl_1k.jpg'),
  roughnessMap: tex('assets/wood_floor/wood_floor_rough_1k.jpg'),
});
for (const t of [floorMat.map, floorMat.normalMap, floorMat.roughnessMap]) t.repeat.set(4, 4); // floor size / tile size
```

- `search` prints how much of the world one tile covers; set `repeat` from it, so planks are plank-sized.
- Colour maps in sRGB; normal and roughness maps linear (the helper does that). Use the `nor_gl` normal map, not `nor_dx`.
- A visible floor replaces the shadow catcher: it receives the shadow itself (`receiveShadow = true`). Fade its far edge into the ground with fog, or use a circle of floor with a soft alpha edge, so it never ends in a hard line.

## Budget

- 1k textures by default; 2k only for a surface that fills the frame in a macro.
- Keep the page under about 5 MB. `get` prints what it downloaded; the check prints what the page loads.
- Heavy scans (over 50k triangles) only for the hero prop. `gltf-transform optimize in.gltf out.glb --compress meshopt --texture-compress webp` shrinks a scan several times.

## Other sources

A supplied brand model always wins. For anything Poly Haven lacks, the Khronos glTF sample assets and the three.js example models are good for testing but not for a client's site; check the licence of anything else before you ship it.
