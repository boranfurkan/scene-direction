# Colour world: the 3D belongs to the page

A 3D object looks pasted on when it has its own colours (default grey, a black void, a stock HDRI sky) while the page has others. It looks designed when the page and the scene share one colour world, and the world changes with the story.

## 1. Tokens first

Declare the palette once on `:root` and read it from JavaScript, so the CSS and the scene can't drift apart:

```css
:root {
  --ink: #f4f1ea;          /* text on the grounds */
  --accent: #f2b544;       /* one accent: rim light, a live detail, the call to action */
  --font-display: …; --font-text: …; --font-mono: …;   /* only if labels need it */
}
```

Give every scene its own **ground** (the page background while that scene plays). A ladder in OKLCH keeps the scenes related: hold lightness and chroma roughly steady and move the hue with the story. One portfolio walks its eight scenes through `oklch(0.50 0.085 287)` → `0.46 0.11 345` → `0.48 0.10 262` → `0.30 0.065 282` → `0.46 0.06 192` → `0.46 0.075 132` → `0.47 0.10 12` → `0.52 0.15 32`: lavender, magenta, blue, indigo, teal, green, rose, terracotta. Every ground has about the same lightness, so the same light ink reads on all of them.

If the subject has colours of its own (the shoe's colourways, the hut's red timber, the glaze), they win. Build the grounds around them instead of inventing a palette.

## 2. One canvas, and its background is the CSS ground

The starter draws the ground inside WebGL (so bloom, vignette and fog work on it), but takes the colour from each scene's `data-ground`, so CSS stays the source of truth:

```js
const grounds = scenes.map((s) => untone(cssColor(s.dataset.ground)));   // per scene
scene.background.copy(grounds[i]).lerp(grounds[j], k);                    // in the loop, with the camera's travel
```

Tone mapping changes every colour it touches, the background too. `untone()` returns the colour that comes out of Neutral tone mapping as exactly the CSS colour (measured on r187: the rendered ground matches the CSS ground to within 2 of 255), so the canvas and the HTML never disagree. With AgX, the grounds shift; judge them by eye.

Don't paint a different background inside WebGL (a gradient sky, an HDRI). If you need depth, fade distant things into the ground with fog in the same colour (below).

## 3. Turn CSS colours into scene colours

```js
const probe = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
function cssColor(value) {             // works for hex, rgb() and oklch(); returns sRGB like the page
  probe.clearRect(0, 0, 1, 1); probe.fillStyle = value; probe.fillRect(0, 0, 1, 1);
  const [r, g, b] = probe.getImageData(0, 0, 1, 1).data;
  return new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
}
const ground = cssColor(getComputedStyle(document.body).backgroundColor);
```

Keep three.js colour management on (the default), with `outputColorSpace = SRGBColorSpace`. Then a colour you set from CSS renders as the same colour on the page.

## 4. Lights and materials from the palette

| Part | Take it from | Why |
|---|---|---|
| Hemisphere sky | the ground, mixed 70–80% towards white | soft light that already "is" the room's colour |
| Hemisphere ground | the ground, mixed 30–40% towards black | the underside sinks into the page instead of going grey |
| Key light | warm white (`#fff4e6`) or the accent at low saturation | shape, and the one shadow |
| Rim light | the accent, or the ground lightened and saturated | separates the silhouette from a ground of similar value |
| Object base colour | the ground shifted darker (for an object that belongs to the world), or the subject's real colour | harmony; nothing default-grey |
| Small emissive details | the accent | a screen, an LED, a lit window: one bright point per frame |

A laptop that "belongs" to a lavender scene is dark lavender (`#2A2742`), lit by a lavender-tinted hemisphere light and rim. One pink point light spills from its screen onto the keys. Nothing in that frame is neutral grey.

## 5. Tone mapping that keeps colours true

In the starter, tone mapping is the last step of the finish chain (`FINISH.toneMapping`; finish.md), not a renderer setting.
- **Neutral** (default): keeps brand and palette colours close to their CSS values, while still rolling off highlights. Use it for designed sites.
- **AgX**: filmic, with gentle desaturation in the brights. Good for photoreal products and terrain.
- **ACES Filmic**: strong contrast, but it shifts hues (saturated oranges and reds drift towards yellow, brights wash out). Avoid it when the object must match a brand colour on the page.

Judge brightness on the screenshot, not in the code: lower the lights or `envIntensity` if the subject's light surfaces bloom.

## 6. Change the world with the story

When the scene changes, change the light with it:

```js
// in the frame loop, k = 0..1 through the transition between scene A and scene B
hemi.color.copy(skyA).lerp(skyB, k);
hemi.groundColor.copy(floorA).lerp(floorB, k);
if (scene.fog) scene.fog.color.copy(groundA).lerp(groundB, k);
```

Fog for depth, in the page colour: `scene.fog = new THREE.Fog(ground, near, far)`. The valley in a diorama fades into the page instead of ending at a hard edge.

## 7. Texture

A grain overlay ties the canvas and the HTML together, so they read as one printed surface instead of a 3D window in a web page. Use a fixed div with a small noise tile (see `assets/starter.html`), `mix-blend-mode: overlay`, at 5–9% opacity, with `pointer-events: none`. Keep it out of WebGL, so it costs nothing and covers the type too.
