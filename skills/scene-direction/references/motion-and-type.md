# Motion and type: directed, not decorated

Juries reward motion that paces the story and penalise motion without hierarchy (everything floating, parallaxing and revealing at once). The camera is the main motion (scenes-and-motion.md). Type and UI motion support it.

## 1. One clock

Smooth scrolling, the camera, the copy fades, the reveals and any shader uniforms all run off `gsap.ticker`, so nothing fights for frames:

```js
const lenis = reduced ? null : new Lenis({ autoRaf: false, anchors: true });   // wheel smoothing; touch stays native
gsap.ticker.lagSmoothing(0);
gsap.ticker.add((time, deltaMs) => { lenis?.raf(time * 1000); frame(time, Math.min(0.1, deltaMs / 1000)); });
```

If you add ScrollTrigger, connect it to the same clock: `lenis.on('scroll', ScrollTrigger.update)`. One driver per property: the loop owns the camera, so don't also scrub the camera with a timeline.

## 2. The vocabulary

| Moment | Ease | Duration | Notes |
|---|---|---|---|
| a statement arriving (lines out of a mask) | `expo.out` | 0.9–1.2 s | stagger 0.06–0.1 s per line |
| the name on the first screen (characters) | `expo.out` | 1.1–1.4 s | stagger 0.02–0.035 s per character |
| supporting text, labels, buttons | `power3.out` | 0.6–0.8 s | 0.2–0.4 s after the statement starts |
| the camera between shots | the loop's smoothstep + damping | the scroll | never a timed tween while the visitor scrolls |
| the intro wipe | `expo.inOut` | 0.8–1 s | once |
| hover and press | CSS `cubic-bezier(0.23, 1, 0.32, 1)` | 150–250 ms | transform and opacity only |

- Animate `transform`, `opacity` and `clip-path`. Never `width`, `height`, `top` or `box-shadow` on scroll.
- Nothing starts from `scale(0)`: start at 0.92–0.97 with opacity 0.
- One thing leads each moment. If the camera is travelling, the type waits; if the statement is arriving, the camera holds.

## 3. Reveals with SplitText

GSAP 3.13+ includes SplitText for free. Split with a mask, so lines rise out of a clip instead of fading:

```js
const split = SplitText.create(heading, { type: 'lines', mask: 'lines', linesClass: 'line', autoSplit: true,
  onSplit: (self) => gsap.set(self.lines, { yPercent: revealed ? 0 : 110 }) });
// when its scene arrives:
gsap.to(split.lines, { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.08 });
```

- `autoSplit` re-splits when fonts load or the width changes. Split after `document.fonts.ready`.
- The masks get the class `line-mask`; the check knows that clip is deliberate.
- Each statement reveals once, the first time its scene arrives. Don't replay it when the visitor scrolls back.
- Under reduced motion, don't split: the text is simply there.

## 4. The intro: short and branded

A reveal of about 2 s after loading is craft; a six-second progress bar is a usability penalty.

- Show the name and a count while the HDRI, models and fonts load; then `renderer.compileAsync(scene, camera)`; then wipe the cover away while the camera settles in from further out and the name's characters rise.
- Hard limit: if loading takes more than about 4 s, show the page anyway and let the rest arrive.
- The starter sets `<html data-ready="1">` when the intro ends; the check waits for it and reports how long it took.
- No intro gate ("Enter") unless it sets something real, such as sound (chrome.md).

## 5. The live thing

One interaction worth a screenshot, with a touch equivalent (idea-and-devices.md): drag to turn the object, press to switch the colourway, hover to light a room, scroll speed driving a wheel. Build it with the same clock and damping as everything else. Give it a hint in the copy ("drag to turn"), because a hidden interaction is no interaction.

The starter already has a small pointer drift on desktop (a few percent of the camera distance). Keep it subtle; it makes the hold feel alive without competing with the live thing.

## 6. Type with a voice

- **Scale.** The name on the first screen is the biggest thing on the page: `clamp(3.6rem, 11vw, 12rem)` or more. Statements at 7vw. Body text 16–19 px with 1.5 line-height and lines under about 70 characters.
- **Tracking.** Tighten display sizes (`letter-spacing: -0.02em` or more for grotesks); open small labels (`0.06–0.1em`, uppercase, a mono or the text face).
- **Two families at most**, from the sheet. A third face only for a real job (numbers on a spec label).
- `text-wrap: balance` on headings, `pretty` on paragraphs.
- **Real words.** Statements come from the inventory: numbers, names, places, materials. "Crafted with passion" is not a statement.
- **Numbers as type.** A spec (1,200 m, 48 hours, No. 7) set large in the display face is often the best statement on a page.

## 7. Reduced motion

`prefers-reduced-motion: reduce` means less movement, not less content. Keep opacity changes, cut travel, reveals, smoothing, idle sway and pointer drift; show each scene's shot as a still. The check loads the page with reduced motion and flags missing statements.
