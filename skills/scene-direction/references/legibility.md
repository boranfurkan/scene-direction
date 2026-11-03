# Legibility: text that reads over a 3D scene, without flattening the design

Text over a canvas is read against whatever the scene draws behind it, and that changes: a highlight drifts across the headline, an iridescent rim passes behind the subtitle, a pale blob sits under white text. The check measures each line against the actual pixels behind it, in the worst 20% of spots.

**Keep the composition.** Type layered over the scene is often the best thing on the page. In our blind tests, a judge preferred the atmospheric hero with the headline on the glowing ring ("sexier") to the version where the fix had moved the object away from the text. Fix contrast where the text is first; separate text and object only when the object is the content.

## Fixes, in this order

1. **Calm the scene where the text sits.** Turn the object so its darker side is behind the copy. Move the highlight (key light) away from the headline. Lower `toneMappingExposure` a touch, or add a darker gradient to the ground behind the text block.
2. **Put a soft scrim behind the copy**, a gradient rather than a box:
   ```css
   .copy { position: relative; isolation: isolate; }
   .copy::before {
     content: ""; position: absolute; inset: -20% -25%; z-index: -1; pointer-events: none;
     background: radial-gradient(closest-side, rgb(8 10 28 / 0.55), transparent);
   }
   ```
   On a light scene, use a light scrim (`rgb(255 255 255 / 0.6)`) with dark text.
3. **Choose the text colour for this scene**, not for the whole page: dark text on light or pastel scenes, light text on dark ones. White on pastel pink or lavender almost always fails. So does thin type over a bright rim, even when it's huge.
4. **Make buttons solid**: an opaque background with a contrasting label. Translucent glass buttons over a bright scene lose their label.
5. **Separate text and object**, only if the object is the content (a product, a globe, a map) and the text hides it. Give the canvas its own region (framing.md), or shift the render with `setViewOffset`.

## Avoid

- **Relying on text-shadow.** It helps huge headlines a little and body text not at all. The check ignores it.
- **Lowering the opacity of copy** to look elegant. `opacity: .6` over a busy scene is unreadable.
- **Small decorative words over the scene** (breathing cues, kicker labels at 11–12px). If people should read them, they need contrast. If they're decoration, say so in your report.
