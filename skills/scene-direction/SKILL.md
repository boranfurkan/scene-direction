---
name: scene-direction
description: Art direction, real assets and a visual check for 3D websites made with three.js, React Three Fiber or WebGL, such as immersive scroll-driven sites, portfolios, product launches, brand and place stories, and 3D heroes. A script deals a researched direction (mood, light, palette, type, finish, a shot per scene), so builds don't converge on the generated look (glowing orb, starfield, dotted globe, grey object in a void, the same safe layout everywhere). A starter brings an award-grade pipeline (HDRI light, ambient occlusion, bloom, tone mapping, smooth scroll, text reveals, intro, site chrome), and a second script fetches CC0 models, textures and HDRIs for the world around the subject. The skill renders the site at desktop and phone sizes, films the scroll, checks usability, and fixes what's broken. Use when building or redesigning any 3D or WebGL website, section or hero.
---

# Scene direction

Asked for "an immersive 3D site", a model builds the average of every 3D demo it has seen: a breathing orb in a purple night, a dotted globe with arcs, a grey product on a grey floor, or the same tidy split layout in every section. The sites that win awards do something else: **one idea from the subject, a world around its own object, a camera that changes shot with every beat of the story, light with a source and a graded finish, type with a voice, one thing to play with, and the chrome of a real site.** And they run smoothly on a phone.

This skill gives you a dealt direction, an asset library, a starter with the full finish pipeline, and a check that renders your page the way a visitor and a jury see it. It owns the 3D direction. If page-design skills (taste-skill, impeccable, hallmark), three.js API skills (cloudai-x/threejs-skills) or the official GSAP skills are installed, use them for those parts.

`<skill>` below is this skill's folder. Run the scripts from the project folder.

## The run

1. **Inventory.** List what's real: the subject's name, what it makes or sells, its place, its numbers, its artefacts, and any supplied model or images. A supplied model is the hero (references/object.md).
2. **Deal the direction.** Left alone you will pick the category default, so let the script deal:
   ```bash
   node <skill>/scripts/draw.mjs --kind <person|maker|product|place|brand|event|...> --brief "<one line>"
   node <skill>/scripts/draw.mjs --direction <chosen id> --brief "<one line>" --scenes <n>
   ```
   Choose the one of the three that can carry something only this subject has, not the most familiar. The second command writes `.scene-direction/sheet.md` in the project: the mood, the world, the light, **the finish**, **the assets to look for**, the grounds, the fonts, and a **shot and copy placement for every scene**. Adopt it. Redraw only for a reason you can state, and say so in the report.
3. **Idea and live thing** (references/idea-and-devices.md). *On this site, [a thing that belongs to the subject] becomes [the direction's world or device].* It must fail the competitor test. Add the one live thing. Read references/tells.md.
4. **Get the assets** (references/assets.md). Run the sheet's `assets.mjs` commands: the HDRI, and at the sheet's fidelity the props and surfaces for the world around the subject. **Look at the contact sheets before you pick**, then `get` them into `assets/`.
5. **Build from `<skill>/assets/starter.html`.** It's infrastructure, not a layout: full-bleed canvas whose background is the CSS ground, the finish chain (HDRI, AO, bloom, vignette, tone mapping, SMAA), `SHOTS` for the camera, copy placement per scene with scrims, one clock (gsap.ticker + Lenis), line reveals, a short intro, the header, index and footer, pointer drift, reduced motion and quality steps. Fill its `FINISH` from the sheet and each section's `data-ground`, `data-shot`, `data-copy` and `data-chapter`. Replace the placeholder text, title and description. In Vite or Next.js, port its pieces.
6. **Make the world and the object** (references/object.md, colour-world.md, finish.md). Model the subject's own thing to the bar in object.md, then put it *somewhere*: the props and surfaces you fetched, a room, a valley, the collection. Light it with the sheet's rig and a source inside the frame.
7. **Story, shots and motion** (references/scenes-and-motion.md, motion-and-type.md). Each scene gets a beat, the sheet's shot and a statement in the display face. For a place, the camera travels through the world along a route (`path` scenes), never around a diorama. Plan the camera's travel, the phone version and reduced motion. Dress the chrome in the subject's language (references/chrome.md).
8. **Check.**
   ```bash
   node <skill>/scripts/check.mjs <folder-or-url> --out scene-check     # add --click "Enter" for an intro gate
   ```
   It needs Playwright (`npm i -D playwright && npx playwright install chromium`, in a scratch folder if the project shouldn't get the dependency). It films every scene at its rest point on desktop and phone (`scene-check/film-desktop.png`, `film-phone.png`), loads the page again with reduced motion, and reports frame time, page weight and how long the intro takes. Read every image it writes.
9. **Look and fix: the top three, up to three rounds** (references/critique.md). Score the rubric from the images, fix the three weakest things, check and look again. Fix findings with the smallest change that keeps the design. If a finding is deliberate (layered type, a deliberate crop, an object rising in from below the fold), keep it and name it.
10. **Report.** Give the direction, the idea sentence, the live thing, the assets you used, the check result, your scores, and what you kept on purpose.

## Ambition, not restraint

In blind tests, a judge preferred the rich, atmospheric page with a small flaw to the tidy, safe page with none, every time it was a choice between them. Removing defects is half the job. The other half is substance:

- **Full-bleed.** The 3D owns the screen. The copy sits on it with a scrim, or beside the object while the render shifts away from it.
- **A different shot every scene.** Don't use the same camera with the copy swapped. The check flags a page that shows one or two shots across the whole scroll.
- **A big hero.** On the first screen, the object or world fills most of the frame, next to the name set huge.
- **A world, not an object on a void.** The room, the table, the land, the collection, the props that belong to the subject, at real scale.
- **Atmosphere and finish.** Light with a time of day and a direction, a source inside the scene that glows, contact shadows, a graded frame. **Rich, not milky**: every frame has a true dark and a saturated colour; fog only for distance in a world, never over the subject.
- **Type with a voice.** The sheet's display face at display sizes, with real words and numbers from the inventory, arriving line by line.
- **A site, not a demo.** A header, an index, a footer with a real contact, an intro of about 2 seconds.

## The floor: never ship these

- An **ERROR** from the check: a crash, a blank canvas, a failed load (also with reduced motion).
- The subject **cropped by accident or tiny on the phone's first screen**.
- A statement you **can't read at its scene's rest point**, or **stretches of the scroll with no words**.
- A layout **wider than the phone**.
- A **hidden native cursor**, a missing title, description or `h1`, or placeholder copy.
- An intro that keeps the visitor waiting more than a few seconds, or frames slower than 40 fps on the check's GPU.
- A stale or mismatched **three.js version**. Use the project's version, or the ones below.

## Fixing by tag

- **[errors]**: fix the first error before anything else. Common causes are swapped constructor arguments, a `let`/`const` used before its declaration, addon URLs on another version, a missing import-map entry, 404s, and textures blocked by CORS.
- **[framing]**: frame per shot for the current aspect ratio (references/framing.md).
- **[ambition]**: give each scene its own shot from the sheet (references/scenes-and-motion.md).
- **[story]**: frames with no statement. Keep each scene's words on screen while its scene is on screen, and fade them only at the hand-over (the starter's loop does this).
- **[labels]**: overlapping or clipped text and labels; toolbars on phones (references/labels.md).
- **[legibility]**: calm the scene behind the text or strengthen the scrim before moving anything (references/legibility.md). Light surfaces that bloom are too bright: lower the lights, not the threshold.
- **[usability]**: the jury basics: native cursor, title, description, language, one `h1`, alt text, reduced motion (references/chrome.md).
- **[performance]**: pixel ratio, shadow map size, AO quality, fewer props, smaller textures (references/finish.md §7).

## Pinned versions

Checked on npm and jsDelivr on 2026-11-03 (the starter's import map):

```json
{ "three": "https://cdn.jsdelivr.net/npm/three@0.187.0/build/three.module.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/",
  "three/examples/jsm/": "https://cdn.jsdelivr.net/npm/three@0.187.0/examples/jsm/",
  "postprocessing": "https://cdn.jsdelivr.net/npm/postprocessing@6.39.6/build/index.js",
  "n8ao": "https://cdn.jsdelivr.net/npm/n8ao@2.0.1/dist/N8AO.js",
  "gsap": "https://cdn.jsdelivr.net/npm/gsap@3.15.0/index.js",
  "gsap/": "https://cdn.jsdelivr.net/npm/gsap@3.15.0/",
  "lenis": "https://cdn.jsdelivr.net/npm/lenis@1.3.27/dist/lenis.mjs" }
```

`n8ao` imports `three/examples/jsm/…`, so keep that entry. `postprocessing` 6.39 supports three up to r187. r187 notes: `PCFSoftShadowMap` is gone (use `PCFShadowMap` with `shadow.radius`); `HDRLoader` replaces `RGBELoader`; `outputEncoding`/`sRGBEncoding` are gone. GSAP 3.13+ includes SplitText (`gsap/SplitText.js`).

## References

| File | Read it when |
|---|---|
| references/idea-and-devices.md | step 3: the idea sentence, devices, the live thing |
| references/tells.md | step 3, and again before you report |
| references/assets.md | step 4: fidelity, finding and placing props, surfaces, budget |
| references/object.md | step 6: supplied models (including colourway variants), the bar for code-built objects, details, materials |
| references/colour-world.md | step 6: palette to background, lights and materials; tone mapping; fog; grain |
| references/finish.md | step 6: light rigs, the HDRI, contact shadows and AO, the post chain, performance |
| references/scenes-and-motion.md | step 7: beats, the shot vocabulary, camera travel, paths, the phone |
| references/motion-and-type.md | step 7: one clock, eases and durations, reveals, the intro, type scale, reduced motion |
| references/chrome.md | step 7: header, index, footer, cursor, markup, sound |
| references/critique.md | step 9: the rubric and the look-and-fix loop |
| references/framing.md, labels.md, legibility.md | fixing a finding with that tag |
| references/example-furkanboran.md | to see the bar: a real site taken apart |
| library/directions.json | the twelve directions the script deals from |

## Credits

The dealt directions, the idea sentence, the competitor test, "one live thing", the look-and-fix loop and the warning that restraint alone reads thin are adapted from taste-skill (MIT). The signature and the rotation of directions come from hallmark (MIT), the Experience mode from impeccable (Apache-2.0), and the archetype vocabulary from awwwards-3d (MIT). Models, textures and HDRIs come from Poly Haven (CC0). The worked example, and the patterns adapted from it, are from furkanboran.info by Furkan Boran. See README.md.
