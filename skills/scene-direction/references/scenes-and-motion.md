# Scenes, shots and motion: the camera tells the story

## 1. Write the story as beats

List the sections as claims, one beat each, before building: *"brazed by hand in Bristol"*, *"Reynolds 853 tubing"*, *"eight frames a year"*. A scene shows one beat, which means one statement on screen and one shot of the object or world. Delete scenes that have nothing new to show.

For each scene, the direction sheet gives you the **shot**, the **copy placement** and the **ground**. You add:
- **length**: in screen heights; 1–3 is typical, with a separate (usually shorter) length for phones.
- **statement**: 4–12 words from the inventory, readable at the scene's rest point.
- **what the shot shows**: the lug, the dropout, the painted name. A macro needs a real detail to land on.

## 2. The shot vocabulary

`assets/starter.html` implements these as `SHOTS`. The distance is computed from the subject's box for the current aspect ratio, so a shot means the same on a phone and a desktop.

| Shot | Camera | Shows | fill |
|---|---|---|---|
| `hero` | three-quarter, slightly above | the object at its best; the default first frame | ~0.68 |
| `hero-low` | low, three-quarter | weight and presence; endings and calls to action | ~0.76 |
| `side` | in profile | the silhouette, a measurement along its length | ~0.82 |
| `top` | from above (a plan view) | layout, a flat lay, a map of the world | ~0.72 |
| `underside` | from below | the sole, the base, the mechanism | ~0.7 |
| `macro` | close on one detail (`focus` point) | material, a joint, a texture, a number | 2–3 (a deliberate crop) |
| `wide` | pulled back | the world around the object: the room, the land, the collection | ~0.3 |
| `path` | travelling along a route as the visitor scrolls | a journey through a place: up the valley, along the street, through the rooms | n/a |

Rules:
- **Every scene gets a different shot from the one before.** The check flags a page whose camera shows one or two shots across the whole scroll.
- **Open strong.** The first screen is a `hero`, `hero-low` or `wide` with the name at display size.
- **A macro needs a detail.** Set `focus` to a real part (as a fraction of the object's size from its centre). Don't macro an empty surface.
- **Travel with purpose.** The camera holds the shot while the statement is read, then travels to the next shot over the end of the scene (the starter travels over the last 35%).

**Places are journeys, not dioramas.** For a place (a vineyard, a hotel, a town, a coast), the visitor should travel *through* it. In blind tests, the person judging preferred a camera journey through the place over a camera orbiting a model of it on a plain ground, and named the journey as what they liked. So:
- The **subject** is the focal building or feature (the cellar, the house, the tower), not the whole world. The **world runs past every edge of the frame**: terrain to the horizon, fading into fog only in the far distance.
- Use `data-shot="path"` scenes. The starter flies them along `ROUTE_POINTS` (world units: along the river, up the slope, through the door). Path scenes share the route in order, or take `data-route="0.2-0.55"`.
- `ROUTE_LOOK`: `'subject'` keeps the focal building in view, `'ahead'` looks along the route (a flight), or give a second list of points for the look target to travel along.
- Keep the camera at a human or a bird's height above the ground along the whole route, and check every path scene's film frame: no frame looks into an empty edge of the world.
- Open with a `wide` that shows the place, travel with `path` scenes, and land on a `hero-low` of the focal building for the call to action.

## 3. Copy placement

`data-copy` per scene: `left`, `right`, `bottom` or `over`. On wide screens, left and right shift the rendered image away from the copy (`setViewOffset`), and every placement gets a soft scrim from its side. `over` puts the statement in the upper third with the object lowered, like a poster. On phones, copy sits low with a scrim and the subject is lifted into the top of the screen. Vary the placement with the shots (the sheet does), so sections don't read as one template.

## 4. One loop, native scroll

Keep native scrolling. Pin the copy with `position: sticky`, and drive the 3D from one `requestAnimationFrame` loop that reads the scroll:

```js
const damp = (rate, dt) => 1 - Math.pow(1 - rate, dt * 60);   // frame-rate independent
smoothY += (scrollY - smoothY) * damp(0.12, dt);
const p = clamp((smoothY - section.offsetTop) / (section.offsetHeight - innerHeight)); // scene progress 0..1
```

Never write `value += (target - value) * 0.1` per frame without `dt`: it runs twice as fast on a 120 Hz screen.

The starter runs this loop on `gsap.ticker`, with **Lenis** (`lenis@1.3.27`) smoothing the wheel on desktop (off for touch and reduced motion); motion-and-type.md has the clock, the eases and the reveals. **GSAP ScrollTrigger** is the other good driver, with `scrub: 1` timelines per scene tweening the same camera and pose values. Use one driver per property. For the API, the official `greensock/gsap-skills` are the reference. Pin `gsap@3.15.0`.

## 5. Each scene: entrance, hold, exit

- **Entrance**: the camera arrives at the scene's shot and the statement fades in.
- **Hold**: only a small idle motion (≤ 3°); the statement is read here.
- **Exit**: the camera starts towards the next shot, and the statement fades out only at the hand-over, as the next scene's top passes the middle of the screen.

Keep the words on screen for the whole scene. If the copy fades on the pinned part of a scene alone, a scene 1.6 screens tall shows its statement for about a third of its scroll, and the visitor scrolls through empty frames. The check flags this as `[story]`.

## 6. The phone and reduced motion

- **The phone**: the same shots, refitted for portrait. Copy goes low and the subject high. Touch scrolling is never smoothed.
- **Reduced motion** (`prefers-reduced-motion: reduce`): each scene shows its shot without travel or idle motion, and everything is readable.
- **Intro gates** ("Enter", "Enter with sound"): optional and skippable. Check through them with `--click "<button text>"`.

## 7. Sound (optional)

Sound only behind the visitor's choice ("Enter with sound / Enter quietly"), with a remembered toggle, never on by default on phones. Keep it quiet, and pause it when the tab is hidden.
