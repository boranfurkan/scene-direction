# Labels: no pile-ups, nothing off the edge

Labels pinned to 3D points (CSS2DRenderer, drei `<Html>`, or hand-positioned divs) move with the camera. Cities that are close on the map, or labels near the globe's horizon, end up on top of each other, and labels near the canvas edge get cut off. On a 390px phone, twelve labels rarely fit at once.

## Decide what must be visible

- Show the most important labels (HQ, the selected item) and let the rest appear on hover or tap. Put the complete list in HTML beside or below the canvas, where it can't collide.
- Give every label a priority, so the important one wins when two collide.

## Hide labels on the far side, colliding labels, and labels outside the canvas

Run this after `labelRenderer.render(scene, camera)` every frame:

```js
const tmp = new THREE.Vector3(), toCam = new THREE.Vector3();

// labels: [{ object, element }], sorted by priority (most important first)
function declutterLabels(labels, camera, globeCenter, container) {
  toCam.copy(camera.position).sub(globeCenter).normalize();
  const box = container.getBoundingClientRect();
  const placed = [];
  for (const l of labels) {
    l.object.getWorldPosition(tmp).sub(globeCenter).normalize();
    let show = tmp.dot(toCam) > 0.15;              // front side, and not right at the horizon
    if (show) {
      const r = l.element.getBoundingClientRect();
      const inside = r.left >= box.left && r.right <= box.right && r.top >= box.top && r.bottom <= box.bottom;
      const hit = placed.some((p) => r.left < p.right + 4 && r.right + 4 > p.left && r.top < p.bottom + 2 && r.bottom + 2 > p.top);
      show = inside && !hit;
      if (show) placed.push(r);
    }
    l.element.style.opacity = show ? '1' : '0';
    l.element.style.pointerEvents = show ? 'auto' : 'none';
  }
}
```

Add `transition: opacity .2s` to the label CSS so labels fade instead of blinking. For scenes that aren't globes, replace the front-side test with a raycast against the occluding mesh, or drop it.

## Labels near the edges

- Anchor labels on the right half of the canvas to their right edge (`transform: translate(-100%, -50%)`), so they grow inward instead of off the screen.
- Keep `white-space: nowrap` and short text. City names beat "San Francisco, California, USA".

## Toolbars and chip rows on phones

A row of buttons that fits 1440px overflows 390px. Either let it wrap or let it scroll on purpose:

```css
.toolbar { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; max-width: calc(100vw - 32px); }
/* or a deliberate scroller */
.chips { display: flex; gap: 8px; overflow-x: auto; max-width: 100%; scrollbar-width: none; }
```

Anything wider than the screen makes the phone browser zoom the whole page out. The check reports that as "the layout is wider than the screen".

## Deliberate overlaps

Layered type is a real design tool: a headline echoed behind itself, a chip flying past a statement mid-scroll, a collaborator cursor resting on a word. The check reads split letters as one word and ignores identical echo text and marquee tracks, but it can't know intent. When a flagged overlap is the design, keep it, and name it in your report. The test is whether a visitor at that frame can still read what they need to.
