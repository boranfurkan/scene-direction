# The chrome: what makes a 3D scene a website

Usability is 30% of an Awwwards score, and it is where most submissions lose. The chrome is the part of the page that isn't the 3D: the header, the index, the footer, the intro, the cursor, the markup. Done well, it makes the scene feel like a finished site instead of a demo; done carelessly, it caps the score however good the 3D is.

## 1. The header

- The name on the left (a link to the top), at most four section links, one call to action on the right (book, buy, contact). On phones, the name and the call to action only.
- Fixed, small, with a soft scrim under it (the starter's `.hud::before`), so it reads over any shot. Never a solid bar that cuts the canvas.
- The current scene's link is marked (`aria-current`); links scroll smoothly (Lenis `anchors: true`).

## 2. The index and progress

A small fixed index (`01 · The workshop`) with a progress line tells the visitor where they are in the story. The starter updates it from each scene's `data-chapter`. Keep it in the label face, small, at an edge.

## 3. Details that belong to the subject

The memorable sites dress their chrome in the subject's language: frame rulers and a selection box on a designer's site, coordinates on a place, a spec plate on a product, an altitude readout on a climb. One or two such details, drawn from the inventory, do more than any effect. Make them real (the numbers are true), small, and consistent with the direction's type.

## 4. The footer

The last scene ends with what a visitor needs: the real contact, the address or the shop link, the year. One line in the label face is enough (`.foot` in the starter). A 3D site without a way to reach anyone is a demo.

## 5. The cursor and pointer

- **Keep the native cursor.** Hiding it (`cursor: none`) is a penalised tell; the check flags it. A custom cursor may follow the native one (a ring, a label like "drag"), never replace it.
- Hover effects only under `@media (hover: hover) and (pointer: fine)`; on touch, the equivalent is a press or nothing.
- Every interactive thing is a real `<a>` or `<button>`, reachable by keyboard, with a visible `:focus-visible` style (the starter's accent outline).

## 6. Markup a developer jury checks

- `<html lang>`, a real `<title>` (the subject and what it is) and `<meta name="description">`; `theme-color` in the first ground.
- Landmarks: `<header>`, `<main>`, one `<section>` per scene with an `aria-label`, one `<h1>` (the name), `<h2>` per statement.
- The canvas is decoration (`aria-hidden="true"`); everything it says is also in the HTML.
- `alt` on every `<img>` (`alt=""` for decoration).
- The check flags a missing title, description, language, `h1`, alt text and a hidden cursor.

## 7. Sound

Optional, and only behind the visitor's choice: an intro with "Enter with sound / Enter quietly", or a small toggle in the header, remembered between visits. Never on by default on phones; quiet; paused when the tab is hidden. Sound tied to the live thing (a click, a wheel turning, a door opening) is worth more than a music bed.

## 8. The floor, again

Juries cap a site that is broken on a phone, stutters, hides the cursor, keeps the visitor waiting, or uses placeholder content. The check covers most of these; the rest is real copy from the inventory and a look at the phone film.
