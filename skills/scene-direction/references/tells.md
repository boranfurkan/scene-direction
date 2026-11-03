# Tells: what makes 3D on the web look generated

These are the defaults that come out when nobody decides. In our test runs, agents asked for "a calm, premium 3D hero" or "a 3D globe of our offices" produced nearly identical answers. A human judge called them "cheap" even when nothing was technically wrong. Each one is acceptable only when the idea asks for it, and then it has to be done better than the default.

**Subjects**
- A glowing, iridescent or glassy **orb or blob** in the centre, slowly breathing. It's the default for "calm", "AI", "premium" and "meditation".
- A **dotted or holographic globe with arcs** for anything "global".
- A **torus knot, icosahedron, wireframe sphere** or rotating cube standing in for "tech".
- **Particles or a starfield** as filler around everything.
- A product on an **endless grey floor** with OrbitControls and three round buttons, and nothing else.
- 3D that has **nothing to do with the content**: decoration placed behind a page that would read the same without it.

**Colour and light**
- A **purple-to-blue or teal-to-pink gradient** night sky behind the object.
- **Default materials**: mid-grey `MeshStandardMaterial`, pure white, or pure black. The object doesn't take the page's colours.
- **Bloom on everything**, chromatic aberration, a heavy vignette: post-processing used as a filter rather than a finish.
- **One white light**, or flat ambient only: no shape, no separation from the background, no shadow, so the object floats.
- A **black void** behind the object while the page is a different colour.
- A **stock HDRI sky as the background** of a designed page. Use the HDRI for light and reflections; the background is the page's ground.
- **Mixed fidelity**: a photo-scanned prop next to primitive placeholders, or a photoreal room around a flat-shaded object. One fidelity per site.
- **No contact**: an object that floats because nothing darkens where it meets the floor (no shadow, no ambient occlusion).
- **Milk**: fog, bloom or blur over the subject on a light ground, so every frame is pastel and nothing is dark. It reads as washed out, not atmospheric.

**Composition and motion**
- The object **auto-rotates forever** with nothing changing.
- The **camera never moves** with purpose, or it swings on every mouse move.
- **Text on the brightest part of the scene** (a rim, a highlight, a glow), or body text at 60% opacity over it.
- **Every section is the same**: the same object behind every block of text.
- **The phone gets the desktop camera**: the object is cropped or tiny on a portrait screen.
- **The same shot in every scene**: one camera, with the copy swapped from section to section.
- **The safe split everywhere**: copy in one column and the 3D in the other, in every section. It reads as a template.
- **A small object in a big empty frame**, or an object on a void with no world around it.
- **The thin page**: tidy, defect-free and forgettable. Removing tells without adding substance (a world, a camera, atmosphere, voice) makes it worse, not better.

**Chrome and usability**
- A **custom cursor that hides the native one**, or a page that only works with a mouse.
- A **long loader**: a progress bar for several seconds, or an "Enter" gate that sets nothing.
- **Everything animates at once**: every block fades, floats and parallaxes, so nothing leads.
- **A demo, not a site**: no header, no way to contact anyone, no real title, placeholder copy.

**Code**
- A stale **three.js version**. Runs pinned 0.160 to 0.170 while 0.187 was current. Pin the version the project already has, or check `npm view three version`.
- Removed APIs: r187 no longer has a soft PCF shadow map (`PCFSoftShadowMap` falls back to `PCFShadowMap` with a warning; soften with `shadow.radius`). `outputEncoding`/`sRGBEncoding` existed in r160 but are gone by r170; use `outputColorSpace`/`SRGBColorSpace`.

When you notice a tell in your own work, don't just delete it. Replace it with a decision from the idea: what does *this* subject's world look like?
