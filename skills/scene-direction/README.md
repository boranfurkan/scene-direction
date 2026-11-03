# scene-direction

Art direction, real assets and a visual check for 3D websites (three.js, React Three Fiber, WebGL). See SKILL.md.

## What's in the folder

- `SKILL.md`: the run, the floor, fixing by tag, pinned versions.
- `scripts/draw.mjs`: deals a direction and writes the direction sheet.
- `scripts/assets.mjs`: searches Poly Haven (CC0 models, textures, HDRIs), writes contact sheets, downloads into the project.
- `scripts/check.mjs`: renders the page at desktop and phone sizes, films each scene, reloads it with reduced motion, and reports framing, legibility, story, usability and performance findings.
- `assets/starter.html`: the shot-based starter with the finish pipeline and the site chrome.
- `library/directions.json`: the twelve directions.
- `references/`: the guidance each step points to.

## Sources and credits

- [taste-skill](https://github.com/Leonxlnx/taste-skill) (MIT): the idea sentence, the competitor test, "one live thing", looking at what you made.
- [hallmark](https://github.com/Nutlope/hallmark) (MIT): the signature, the mirror test.
- [impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0): the Experience mode, verifying by looking at rendered sizes.
- [awwwards-3d](https://github.com/tsogjavklann/awwwards-3d) (MIT): the 3D archetype vocabulary.
- [emilkowalski/skills](https://github.com/emilkowalski/skills): easing curves, durations and reduced-motion rules (restated, not copied).
- [cloudai-x/threejs-skills](https://github.com/cloudai-x/threejs-skills) (MIT) and [greensock/gsap-skills](https://github.com/greensock/gsap-skills) (MIT): API references this skill defers to.
- [Poly Haven](https://polyhaven.com) (CC0): the models, textures and HDRIs `assets.mjs` downloads, through its public API.
- Libraries the starter loads: [three.js](https://threejs.org) r187, [postprocessing](https://github.com/pmndrs/postprocessing) 6.39, [N8AO](https://github.com/N8python/n8ao) 2.0, [GSAP](https://gsap.com) 3.15 with SplitText, [Lenis](https://github.com/darkroomengineering/lenis) 1.3.
- Award research: Awwwards' evaluation criteria and case studies (Igloo Inc., Bruno Simon's portfolio), Lusion's Oryzo behind-the-scenes series, Utsubo's three.js guides, and Hon Tran's notes on Site of the Day juries.
- [furkanboran.info](https://www.furkanboran.info) by Furkan Boran: the worked example and the code patterns adapted from it (used with permission).

No text from these projects is copied. The ideas are restated and credited, and the code is written for this skill unless marked as adapted.
