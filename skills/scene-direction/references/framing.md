# Framing: frame each shot, for every screen

A camera placed for a 16:10 desktop crops the same object on a 9:19.5 phone, because a portrait phone's horizontal field of view is far narrower. So frame **per shot, per aspect ratio, on every resize**. A crop is fine when it's a decision (a macro); it's a bug when it's an accident (the hero cut off on a phone).

## Fit a shot

`frameShot` in `assets/starter.html` finds the distance at which every corner of the subject's box sits inside the frame for a given camera direction. `fill` sets how much of the frame the subject takes:

```js
function frameShot({ dir, fill, focus }, aspect) {
  const d = new THREE.Vector3(...dir).normalize();
  const worldUp = Math.abs(d.y) > 0.98 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(0, 1, 0);
  const right = new THREE.Vector3().crossVectors(worldUp, d).normalize(), up = new THREE.Vector3().crossVectors(d, right);
  const tv = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2), th = tv * aspect, margin = 1 / fill;
  let dist = 0;
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
    const v = new THREE.Vector3(x, y, z).sub(center), depth = v.dot(d);
    dist = Math.max(dist, depth + (Math.abs(v.dot(right)) * margin) / th, depth + (Math.abs(v.dot(up)) * margin) / tv);
  }
  const look = center.clone(); if (focus) look.add(new THREE.Vector3(...focus).multiply(size));
  return { pos: look.clone().addScaledVector(d, dist), look, up: worldUp };
}
```

- `fill` below 1 fits the whole object with room (hero about 0.7, wide about 0.3). Above 1 is a deliberate crop on the `focus` detail (macro about 2.4).
- It fits the box, not a bounding sphere, so wide objects (shoes, bikes, laptops) stay large.
- Recompute all shots on resize. On phones, frame as if the screen were slightly wider (the starter uses 1.25× the aspect ratio for non-macro shots), because the copy takes the lower part and the subject is lifted.

## Keep the subject clear of the copy

Copy beside the subject: shift the rendered image away from it without moving the camera:

```js
camera.setViewOffset(w, h, offsetX * w, offsetY * h, w, h);   // e.g. copy left → offsetX = -0.2 moves the subject right
```

The starter interpolates the offset per scene with the shot. A copy column next to a big hero is fine. A statement on top of the object needs a scrim (legibility.md).

## Product viewers the visitor turns

With OrbitControls, frame once per resize, then set `controls.minDistance` to about 0.4× and `maxDistance` to about 2× the framed distance. A fixed `minDistance` from desktop pushes the phone camera into a crop.

## React Three Fiber (drei)

`<Bounds fit clip observe margin={1.12}>` refits on resize (`observe`). For per-scene shots, animate the camera yourself (`useFrame`), and use `Bounds` only to fit the hero.
