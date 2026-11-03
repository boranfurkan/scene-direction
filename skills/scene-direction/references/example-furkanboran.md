# Worked example: furkanboran.info

[furkanboran.info](https://www.furkanboran.info) is the portfolio of Furkan Boran, a full-stack engineer in London. It's used here, with his permission, as the bar this skill aims at. Code patterns below are adapted from its source, credited to him. Open it on a desktop and a phone and scroll the whole thing before you build.

## The idea

> On this site, **a designer-engineer's working life** becomes **a design tool**.

The page is a frame on a canvas. A ruler runs along the top ("FRAME 01 — HERO", "1440 × 900"), and a scroll ruler along the bottom names the scenes. The name sits in a Figma-style selection box with handles and a size tag (`h1.name 837 × 184`), and a collaborator cursor labelled "Furkan" rests near it. The competitor test fails for any other engineer: the stickers, the city and the work are his.

## The object

One 3D object carries the hero: **his laptop**. It's modelled in code (no model file), from rounded slabs extruded with soft bevels, plus 48 keys, a trackpad and an LED. Its lid carries stickers from his own life: an LDN meetup, a DevConf speaker badge, `postgres`, `strict: true`, `LGTM`, an open-source badge. They're drawn on a 2D canvas in the site's own fonts.

As you scroll, the laptop rises in, opens its lid, and types into a live terminal (a canvas texture). The keys flash and a pink light spills from the screen onto them. Then the camera flies into the screen, and the screen lands on the next scene's colour. The 3D is a story beat, not decoration.

```js
// a rounded slab with soft bevels: the body and the lid
function slab(w, d, r, thickness) {
  const s = new THREE.Shape(), x = -w / 2, y = -d / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + d - r); s.quadraticCurveTo(x + w, y + d, x + w - r, y + d);
  s.lineTo(x + r, y + d); s.quadraticCurveTo(x, y + d, x, y + d - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.045, bevelSegments: 10, curveSegments: 48 });
  g.rotateX(-Math.PI / 2); g.center();
  return g;
}
```

## The colour world

Eight scenes, each with its own ground in OKLCH and its own scroll length (a separate one for phones). They run hero, hello, stack, beliefs, london, work, about and contact: lavender, magenta, blue, deep indigo, teal, green, rose and terracotta, all at about the same lightness. The canvas is transparent over the CSS ground. The laptop is the scene's own dark lavender (`#2A2742`), lit by a lavender-tinted hemisphere light (sky `#e8e4ff`, ground `#2a2546`), a white key light that casts the shadow, and a lavender rim light (`#c9c2ff`) behind. Nothing is default grey.

```js
// scenes: id, scroll length in screen heights (desktop / phone), ground colour
{ id: 'hero',   length: 260, phoneLength: 240, color: [0.5, 0.085, 287] },
{ id: 'intro',  length: 320, phoneLength: 280, color: [0.46, 0.11, 345] },
{ id: 'london', length: 290, phoneLength: 300, color: [0.46, 0.06, 192] },
```

## Motion

One loop drives the whole page. It smooths the scroll (`sy += (scrollY - sy) * 0.12`, made frame-rate independent with `1 - (1 - rate)^dt60`), works out which scenes are visible, crossfades their layers, and hands a shared frame to every updater (the laptop, the hero type, the skyline, the train). The page uses GSAP eases: `power2` for most moves and `back.out(1.6)` for the pops when stickers drop.

## Details that make it his

- Type: Instrument Serif for display and italics, Bricolage Grotesque condensed for bold statements ("FULL STACKS.", "BASED IN LONDON."), JetBrains Mono for labels and tags.
- An 8% grain overlay over everything, a dot grid, a screen frame with rounded corners.
- A custom design-tool cursor; sound behind a choice ("Enter with sound" or "Enter quietly").
- A London scene with the skyline and a passing train; project cards in browser frames; a contact scene of stickers you can grab ("GRAB ANY STICKER — THE LINKS WORK TOO"). That's the one live thing.

## What the check says about it, and why that's fine

Run with `--click "Enter quietly"`, the check reports a few dozen items on this site. Most are design, not defects:
- The hero laptop is cut off at the bottom on the first screen. It's rising in from below, and the next frames show it whole.
- The size tag and the collaborator cursor overlap the name. That's the design-tool joke.
- A stack of tech chips flies across "FULL STACKS." mid-scroll. That's a scene in motion.
- The small ruler and nav labels are low-contrast (2.5–3:1). That's a deliberate quiet layer, though WCAG would ask for more.

That's the judgment the skill asks for: fix what a visitor would read as a mistake, and keep and name what's deliberate.
