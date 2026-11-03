#!/usr/bin/env node
// scene-check: render a three.js page at desktop and phone sizes and report what is visibly wrong.
// Usage: node check.mjs <url | folder> [--out <dir>] [--wait <ms>] [--only desktop|phone] [--click "<text>"] [--frames <n>] [--scroll-wait <ms>]
// Long pages are filmed: <n> evenly spaced scroll positions (default 6) are measured and laid out in film-<viewport>.png.
// Needs Playwright (npm i -D playwright && npx playwright install chromium).
// Exit code: 0 = no problems found, 1 = problems found, 2 = could not run.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

// ---------- arguments ----------
const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i > -1 ? argv[i + 1] : dflt; };
const target = argv.find((a, i) => !a.startsWith('--') && !(i > 0 && argv[i - 1].startsWith('--')));
if (!target) { console.error('Usage: node check.mjs <url | folder> [--out <dir>] [--wait <ms>] [--only desktop|phone] [--click "<text>"] [--frames <n>]'); process.exit(2); }
const OUT = path.resolve(opt('--out', 'scene-check'));
const EXTRA_WAIT = Number(opt('--wait', 1500));
const ONLY = opt('--only', null);
const CLICK = opt('--click', null);
const FRAMES = opt('--frames', null) === null ? null : Math.max(1, Number(opt('--frames')));
const SCROLL_WAIT = Number(opt('--scroll-wait', 1400));

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  phone: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
};

// ---------- playwright: from the project, then next to this script, then global ----------
async function loadPlaywright() {
  const roots = [process.cwd()];
  try { roots.push(execSync('npm root -g', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()); } catch {}
  for (const root of roots) {
    const req = createRequire(path.join(root, 'noop.js'));
    for (const name of ['playwright', 'playwright-core', '@playwright/test']) {
      try { const m = await import(pathToFileURL(req.resolve(name)).href); const c = m.chromium ?? m.default?.chromium; if (c) return c; } catch {}
    }
  }
  try { const m = await import('playwright'); return m.chromium ?? m.default?.chromium; } catch {}
  return null;
}

// ---------- static server for a folder ----------
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json', '.bin': 'application/octet-stream', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.ktx2': 'image/ktx2',
  '.hdr': 'application/octet-stream', '.exr': 'application/octet-stream', '.wasm': 'application/wasm', '.woff2': 'font/woff2',
};
function serve(root) {
  const server = http.createServer(async (req, res) => {
    try {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
      if (p.endsWith('/')) p += 'index.html';
      const file = path.join(root, p);
      if (!file.startsWith(root)) throw new Error('outside root');
      const body = await fs.readFile(file);
      res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end('not found'); }
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

// ---------- runs in the page before any page script ----------
const PROBE = () => {
  const P = (window.__sc = { perFrame: [], pairs: new Map(), renderers: 0 });
  let cur = 0;
  for (const C of [window.WebGLRenderingContext, window.WebGL2RenderingContext]) {
    if (!C) continue;
    for (const n of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced', 'drawRangeElements']) {
      const orig = C.prototype[n];
      if (orig) C.prototype[n] = function (...a) { cur++; return orig.apply(this, a); };
    }
  }
  const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = gc.call(this, type, ...rest);
    if (ctx && /webgl|webgpu/.test(type)) this.__scType = type;
    return ctx;
  };
  const tick = () => { P.perFrame.push(cur); cur = 0; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
  // three.js announces every Scene and renderer to __THREE_DEVTOOLS__; wrap render() to learn the camera.
  const hook = new EventTarget();
  hook.addEventListener('observe', (e) => {
    const o = e.detail;
    if (!o || o.isScene || typeof o.render !== 'function' || !o.domElement) return;
    P.renderers++;
    const orig = o.render;
    o.render = function (scene, camera, ...rest) {
      if (scene && camera && scene.isObject3D) {
        const rt = o.getRenderTarget?.() ?? null;
        // environment-map bakes (PMREM / cube cameras) are not what the user sees
        const bake = !!rt && (rt.isWebGLCubeRenderTarget || rt.texture?.mapping === 306 || rt.texture?.isCubeTexture);
        if (!bake) {
          const k = P.pairs.get(scene) ?? { scene, camera, renderer: o, count: 0, toScreen: 0 };
          k.camera = camera; k.renderer = o; k.count++; if (!rt) k.toScreen++;
          P.pairs.set(scene, k);
        }
      }
      return orig.call(this, scene, camera, ...rest);
    };
  });
  window.__THREE_DEVTOOLS__ = hook;
};

// ---------- runs in the page after it settles: scene + layout facts ----------
const INSPECT = () => {
  const P = window.__sc;
  const vw = innerWidth, vh = innerHeight;
  const R = (r) => ({ x: r.left, y: r.top, w: r.width, h: r.height });
  const inter = (a, b) => { const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y); const w = Math.min(a.x + a.w, b.x + b.w) - x, h = Math.min(a.y + a.h, b.y + b.h) - y; return w > 0 && h > 0 ? { x, y, w, h } : null; };
  const clipOf = (el) => { // visible box of an element after clipping ancestors (and the screen, horizontally)
    let box = R(el.getBoundingClientRect());
    for (let a = el.parentElement; a && a !== document.documentElement; a = a.parentElement) {
      const cs = getComputedStyle(a);
      if (cs.overflowX === 'visible' && cs.overflowY === 'visible') continue;
      const ar = R(a.getBoundingClientRect());
      if (cs.overflowX !== 'visible') { const x = Math.max(box.x, ar.x); box.w = Math.min(box.x + box.w, ar.x + ar.w) - x; box.x = x; }
      if (cs.overflowY !== 'visible') { const y = Math.max(box.y, ar.y); box.h = Math.min(box.y + box.h, ar.y + ar.h) - y; box.y = y; }
    }
    const x = Math.max(box.x, 0); box.w = Math.min(box.x + box.w, vw) - x; box.x = x;
    return box.w > 0 && box.h > 0 ? box : null;
  };

  const canvases = [...document.querySelectorAll('canvas')].filter((c) => c.__scType).map((c) => ({
    el: c, type: c.__scType, rect: R(c.getBoundingClientRect()), visible: clipOf(c), ratio: c.getBoundingClientRect().width ? c.width / c.getBoundingClientRect().width : null,
  }));

  // ---- the 3D subject: visible meshes of the main scene, minus sky domes, ground planes and shadow catchers
  let subject = null, subjectNote = null;
  const pairs = [...P.pairs.values()];
  const countMeshes = (s) => { let n = 0; s.traverseVisible((o) => { if (o.isMesh) n++; }); return n; };
  // the main scene: a perspective camera over real geometry beats what reaches the screen, because with
  // post-processing the last draw to the screen is a full-screen quad (one mesh, orthographic camera)
  const real = (k) => countMeshes(k.scene) > 1;
  const main = pairs.sort((a, b) => (!!b.camera.isPerspectiveCamera - !!a.camera.isPerspectiveCamera) || (real(b) - real(a)) || ((b.toScreen > 0) - (a.toScreen > 0)) || (b.count - a.count) || (countMeshes(b.scene) - countMeshes(a.scene)))[0];
  if (main) {
    const { scene, camera, renderer } = main;
    scene.updateMatrixWorld?.(); camera.updateMatrixWorld?.();
    const T = (e, x, y, z) => [e[0] * x + e[4] * y + e[8] * z + e[12], e[1] * x + e[5] * y + e[9] * z + e[13], e[2] * x + e[6] * y + e[10] * z + e[14]];
    const mul = (a, b) => { const r = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; r[i * 4 + j] = s; } return r; };
    const cam = camera.matrixWorld.elements;
    const camPos = [cam[12], cam[13], cam[14]];
    const meshes = [];
    scene.traverseVisible((o) => { if (o.isMesh && o.geometry?.attributes?.position) meshes.push(o); });
    const items = [];
    for (const m of meshes) {
      const mat = Array.isArray(m.material) ? m.material[0] : m.material;
      if (!mat || mat.isShadowMaterial || mat.visible === false || (mat.transparent && mat.opacity < 0.05)) continue;
      const g = m.geometry;
      if (!g.boundingBox) g.computeBoundingBox();
      const b = g.boundingBox;
      if (!b || !isFinite(b.min.x)) continue;
      const mats = [];
      if (m.isInstancedMesh) {
        const arr = m.instanceMatrix.array, n = Math.min(m.count, 300), step = Math.max(1, Math.floor(m.count / n));
        for (let i = 0; i < m.count; i += step) mats.push(mul(m.matrixWorld.elements, Array.from(arr.slice(i * 16, i * 16 + 16))));
      } else mats.push(m.matrixWorld.elements);
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (const e of mats) for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
        const p = T(e, x, y, z); for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], p[k]); hi[k] = Math.max(hi[k], p[k]); }
      }
      const dims = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]].sort((a, c) => a - c);
      const containsCam = camPos.every((c, k) => c > lo[k] && c < hi[k]);
      const gp = g.parameters ?? {}, localMax = Math.max(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
      const thin = (g.type === 'TorusGeometry' && gp.tube / gp.radius < 0.03) || (g.type === 'TubeGeometry' && gp.radius / localMax < 0.02);
      const faint = mat.transparent && mat.opacity < 0.5;
      items.push({ m, mats, flat: dims[0] < 0.002 * dims[2], containsCam, glow: mat.side === 1 || mat.blending === 2, decor: thin || faint, shader: !!(mat.isShaderMaterial || mat.isRawShaderMaterial) });
    }
    // the subject is the solid main object: glow shells (back-faced/additive), faint meshes and thin
    // rings/tubes are decoration that may bleed past the edge, so they only count if nothing else is there
    // a flat plane with a custom shader is usually a canvas for a procedural effect: its geometry says nothing about what is drawn
    const shaderPlane = (i) => i.flat && i.shader;
    let pick = items.filter((i) => !i.containsCam && !i.flat && !i.glow && !i.decor);
    if (!pick.length) pick = items.filter((i) => !i.containsCam && !i.glow && !i.decor && !shaderPlane(i));
    if (!pick.length) pick = items.filter((i) => !i.containsCam && !i.glow && !shaderPlane(i));
    if (!pick.length && items.length) subjectNote = 'The scene is drawn only by glow, sky or shader-plane layers, so framing cannot be measured from geometry. Judge it from the screenshots.';
    if (pick.length) {
      const VP = mul(camera.projectionMatrix.elements, camera.matrixWorldInverse.elements);
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, behind = 0, total = 0;
      const proj = (x, y, z) => {
        const cx = VP[0] * x + VP[4] * y + VP[8] * z + VP[12], cy = VP[1] * x + VP[5] * y + VP[9] * z + VP[13], cw = VP[3] * x + VP[7] * y + VP[11] * z + VP[15];
        total++;
        if (cw <= 1e-6) { behind++; return; }
        const nx = cx / cw, ny = cy / cw;
        minX = Math.min(minX, nx); maxX = Math.max(maxX, nx); minY = Math.min(minY, ny); maxY = Math.max(maxY, ny);
      };
      const parts = [];
      for (const { m, mats } of pick) {
        const before = { minX, maxX, minY, maxY, behind, total };
        minX = Infinity; maxX = -Infinity; minY = Infinity; maxY = -Infinity; behind = 0; total = 0;
        const pos = m.geometry.attributes.position;
        if (m.isInstancedMesh) {
          const b = m.geometry.boundingBox;
          for (const e of mats) for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) proj(...T(e, x, y, z));
        } else {
          const step = Math.max(1, Math.floor(pos.count / 3000));
          for (let i = 0; i < pos.count; i += step) proj(...T(mats[0], pos.getX(i), pos.getY(i), pos.getZ(i)));
        }
        const mat = Array.isArray(m.material) ? m.material[0] : m.material;
        parts.push({ name: m.name || '', geometry: m.geometry.type, material: mat?.type, ndc: [minX, maxX, minY, maxY].map((v) => +v.toFixed(2)), behind: total ? +(behind / total).toFixed(2) : 0 });
        minX = Math.min(minX, before.minX); maxX = Math.max(maxX, before.maxX); minY = Math.min(minY, before.minY); maxY = Math.max(maxY, before.maxY);
        behind += before.behind; total += before.total;
      }
      const cr = renderer.domElement.getBoundingClientRect();
      const canvas = canvases.find((c) => c.el === renderer.domElement);
      if (isFinite(minX)) {
        const sx = (n) => cr.left + ((n + 1) / 2) * cr.width, sy = (n) => cr.top + ((1 - n) / 2) * cr.height;
        const cm = camera.matrixWorld.elements;
        subject = {
          camera: { pos: [cm[12], cm[13], cm[14]].map((v) => +v.toFixed(3)), dir: [-cm[8], -cm[9], -cm[10]].map((v) => +v.toFixed(3)), fov: camera.fov ?? null, zoom: camera.zoom ?? 1 },
          meshes: pick.length, ignored: items.length - pick.length, ignoredParts: items.filter((i) => !pick.includes(i)).map((i) => ({ geometry: i.m.geometry.type, flat: i.flat, containsCam: i.containsCam, glow: i.glow, decor: i.decor })),
          rect: { x: sx(minX), y: sy(maxY), w: sx(maxX) - sx(minX), h: sy(minY) - sy(maxY) },
          area: canvas?.visible ?? null, behindCamera: total ? behind / total : 0, parts,
        };
      }
    }
  }

  // ---- text on the page, read as blocks: split letters and words (kinetic type) belong to their nearest block
  const blockOf = (el) => { for (let a = el; a && a !== document.body; a = a.parentElement) if (!/^(inline|inline-block|contents)$/.test(getComputedStyle(a).display)) return a; return document.body; };
  const items = new Map();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  while (walker.nextNode()) {
    const n = walker.currentNode, s = n.nodeValue.replace(/\s+/g, ' ').trim();
    if (!s) continue;
    const el = n.parentElement;
    if (!el || el.closest('script,style,noscript,template,svg')) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible' || cs.display === 'none') continue;
    let op = 1;
    for (let a = el; a && op >= 0.05; a = a.parentElement) op *= parseFloat(getComputedStyle(a).opacity);
    if (op < 0.05) continue;
    const range = document.createRange(); range.selectNodeContents(n);
    const lines = [...range.getClientRects()].filter((r) => r.width > 1 && r.height > 1).map(R);
    if (!lines.length) continue;
    const blk = blockOf(el);
    let it = items.get(blk);
    if (!it) items.set(blk, (it = {
      el: blk, parts: [], lines: [], op,
      color: cs.webkitTextFillColor && !/currentcolor/i.test(cs.webkitTextFillColor) ? cs.webkitTextFillColor : cs.color,
      size: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight, 10) || 400, shadow: cs.textShadow !== 'none', ellipsis: cs.textOverflow === 'ellipsis',
    }));
    it.parts.push(s); it.lines.push(...lines);
  }
  const texts = [];
  for (const it of items.values()) {
    const text = (it.parts.every((p) => p.length <= 1) ? it.parts.join('') : it.parts.join(' ')).slice(0, 48);
    const u = it.lines.reduce((a, r) => ({ x: Math.min(a.x, r.x), y: Math.min(a.y, r.y), r: Math.max(a.r, r.x + r.w), b: Math.max(a.b, r.y + r.h) }), { x: Infinity, y: Infinity, r: -Infinity, b: -Infinity });
    const box = { x: u.x, y: u.y, w: u.r - u.x, h: u.b - u.y };
    // clipped by an ancestor that hides overflow; skip scroll containers, marquee tracks wider than the screen,
    // ellipsis and visually-hidden text
    let clippedBy = null, inScroller = false, onTrack = box.w > 1.5 * vw, srOnly = false, fixed = false;
    for (let a = it.el; a && a !== document.documentElement; a = a.parentElement) {
      const acs = getComputedStyle(a), ar = R(a.getBoundingClientRect());
      if (acs.position === 'fixed') fixed = true;
      if (ar.w <= 2 || ar.h <= 2) { srOnly = true; break; }
      if (ar.w > 1.5 * vw) onTrack = true;
      const sx = /auto|scroll/.test(acs.overflowX), sy = /auto|scroll/.test(acs.overflowY);
      if (sx) inScroller = true;
      const hx = /hidden|clip/.test(acs.overflowX), hy = /hidden|clip/.test(acs.overflowY);
      const maskEl = /mask/i.test(typeof a.className === 'string' ? a.className : ''); // reveal masks (SplitText) clip on purpose
      if (!clippedBy && a !== document.body && !it.ellipsis && !maskEl &&
        ((hx && (box.x < ar.x - 1 || box.x + box.w > ar.x + ar.w + 1)) || (hy && !sy && (box.y < ar.y - 1 || box.y + box.h > ar.y + ar.h + 1)))) clippedBy = a.tagName.toLowerCase() + (a.className && typeof a.className === 'string' ? '.' + a.className.trim().split(/\s+/)[0] : '');
    }
    if (srOnly) continue;
    texts.push({ ...it, text, box, clippedBy, inScroller, onTrack, fixed, overCanvas: canvases.some((c) => inter(box, c.rect)), real: text.replace(/[^\p{L}\p{N}]/gu, '').length >= 2 });
  }
  const overlaps = [];
  for (let i = 0; i < texts.length; i++) for (let j = i + 1; j < texts.length; j++) {
    const A = texts[i], B = texts[j];
    if (!A.real || !B.real || A.el.contains(B.el) || B.el.contains(A.el)) continue;
    if (A.op < 0.5 || B.op < 0.5) continue; // text mid-fade is a transition, judged once it has arrived
    if (A.text.toLowerCase() === B.text.toLowerCase()) continue; // layered echo type is a deliberate effect
    let best = 0;
    // compare the band where the letters are: a line box spans the font's ascent and descent, which for
    // large display type reaches far above and below the glyphs
    const ink = (r) => ({ x: r.x + r.w * 0.02, y: r.y + r.h * 0.22, w: r.w * 0.96, h: r.h * 0.56 });
    for (const a0 of A.lines) for (const b0 of B.lines) {
      const a = ink(a0), b = ink(b0), r = inter(a, b);
      if (r && r.h > 0.4 * Math.min(a.h, b.h)) best = Math.max(best, (r.w * r.h) / Math.min(a.w * a.h, b.w * b.h));
    }
    if (best > 0.15) overlaps.push({ a: A.text, b: B.text, ratio: best });
  }
  const movable = (t) => t.real && !t.inScroller && !t.onTrack;
  const offscreen = texts.filter((t) => movable(t) && (t.box.x < -1 || t.box.x + t.box.w > vw + 1)).map((t) => ({ text: t.text, left: t.box.x, right: t.box.x + t.box.w }));
  const clipped = texts.filter((t) => movable(t) && t.clippedBy).map((t) => ({ text: t.text, by: t.clippedBy }));
  // statements on screen: display-size text at readable opacity (the film asks whether a scene's words are there)
  const statements = texts.filter((t) => t.real && t.op >= 0.5 && t.size >= 20 && t.box.y < vh * 0.97 && t.box.y + t.box.h > vh * 0.03 && t.box.x < vw && t.box.x + t.box.w > 0)
    .map((t) => ({ text: t.text, fixed: t.fixed }));
  // text that is fading in or out (under half opacity) is judged once it has arrived, not mid-fade
  const contrastCandidates = texts.filter((t) => t.overCanvas && t.op >= 0.5 && t.box.y < vh && t.box.y + t.box.h > 0).map((t) => ({
    text: t.text, color: t.color, op: t.op, size: t.size, weight: t.weight, shadow: t.shadow,
    lines: t.lines.filter((r) => r.y < vh && r.y + r.h > 0 && r.x < vw && r.x + r.w > 0).slice(0, 12),
  }));

  // ---- what paints on top: hit-test with everything made hit-testable for a moment, then judge the
  // stacks with the real styles (click-through layers, pointer-events: none, are decoration and never cover)
  const pe = document.createElement('style');
  pe.textContent = '*{pointer-events:auto!important}';
  document.head.appendChild(pe);
  const subjectStacks = [], textStacks = [];
  const canvasEl = main?.renderer?.domElement;
  if (subject && subject.area && canvasEl) {
    const r = subject.rect, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
    for (let i = 0; i < 16; i++) for (let j = 0; j < 16; j++) {
      const x = r.x + (r.w * (i + 0.5)) / 16, y = r.y + (r.h * (j + 0.5)) / 16;
      if (((x - cx) / (r.w / 2)) ** 2 + ((y - cy) / (r.h / 2)) ** 2 > 1) continue; // inside the subject's ellipse, not its box corners
      if (x < 0 || y < 0 || x >= vw || y >= vh) continue;
      const stack = document.elementsFromPoint(x, y), ci = stack.indexOf(canvasEl);
      if (ci >= 0) subjectStacks.push(stack.slice(0, ci).filter((el) => !el.contains(canvasEl)));
    }
  }
  for (const t of texts) {
    if (!t.real) continue;
    const st = [];
    for (const r of t.lines.slice(0, 12)) for (let i = 0; i < 5; i++) {
      const x = r.x + (r.w * (i + 0.5)) / 5, y = r.y + r.h / 2;
      if (x < 0 || y < 0 || x >= vw || y >= vh) continue;
      const stack = document.elementsFromPoint(x, y), ti = stack.findIndex((e) => e === t.el || t.el.contains(e));
      if (ti >= 0) st.push(stack.slice(0, ti).filter((e) => !e.contains(t.el)));
    }
    textStacks.push({ t, st });
  }
  pe.remove();
  const sel = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : '');
  const boxCache = new Map();
  const PANEL = /^(DIV|ASIDE|SECTION|NAV|HEADER|FOOTER|FORM|UL|OL|LI|ARTICLE|DIALOG|FIELDSET|TABLE|FIGURE|MAIN|DETAILS)$/;
  const isBox = (el) => { // an opaque-looking box: solid background, background image, frosted glass, image or video
    if (boxCache.has(el)) return boxCache.get(el);
    let v = false;
    if (el !== document.body && el !== document.documentElement && !(el instanceof HTMLCanvasElement)) {
      const cs = getComputedStyle(el), r = el.getBoundingClientRect();
      if (cs.visibility === 'visible' && cs.pointerEvents !== 'none' && r.width * r.height < 0.6 * vw * vh) { // full-screen layers (vignettes, scrims) are deliberate
        const bg = cs.backgroundColor.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
        const a = bg.length > 3 ? bg[3] : 1;
        let op = 1; for (let x = el; x && op > 0.3; x = x.parentElement) op *= parseFloat(getComputedStyle(x).opacity);
        const clipText = cs.backgroundClip === 'text' || cs.webkitBackgroundClip === 'text'; // gradient-filled text, not a box
        v = op > 0.3 && !clipText && (a >= 0.5 || cs.backgroundImage !== 'none' || (cs.backdropFilter && cs.backdropFilter !== 'none') || el.tagName === 'IMG' || el.tagName === 'VIDEO');
      }
    }
    boxCache.set(el, v);
    return v;
  };
  if (subject && subjectStacks.length) {
    const by = new Map(); let hit = 0;
    for (const st of subjectStacks) {
      // only panels count (cards, toolbars, asides): a button or link on a hero backdrop is ordinary design
      const cover = st.find((el) => PANEL.test(el.tagName) && isBox(el));
      if (cover) { hit++; by.set(cover, (by.get(cover) ?? 0) + 1); }
    }
    subject.covered = hit / subjectStacks.length;
    subject.coveredBy = [...by.entries()].sort((p, q) => q[1] - p[1]).slice(0, 3).map(([el]) => sel(el));
  }
  const coveredText = [];
  for (const { t, st } of textStacks) {
    let hit = 0, by = null;
    for (const s of st) { const c = s.find((e) => !t.el.contains(e) && isBox(e)); if (c) { hit++; by = c; } }
    if (st.length && hit / st.length >= 0.4) coveredText.push({ text: t.text, by: sel(by) });
  }

  return {
    vw, vh, revision: window.__THREE__ ?? null, renderers: P.renderers, scenes: pairs.length,
    canvases: canvases.map(({ el, ...c }) => c), subject, subjectNote, overlaps, offscreen, clipped, contrastCandidates, coveredText, statements,
    pageWidth: document.documentElement.scrollWidth, perFrame: P.perFrame.slice(-90),
  };
};

// ---------- pixel analysis of a screenshot, in a scratch page ----------
const PIXELS = async ({ b64, regions, samples }) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = new OffscreenCanvas(img.width, img.height), g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const d = g.getImageData(0, 0, img.width, img.height).data;
  const px = (x, y) => { x = Math.max(0, Math.min(img.width - 1, Math.round(x))); y = Math.max(0, Math.min(img.height - 1, Math.round(y))); const i = (y * img.width + x) * 4; return [d[i], d[i + 1], d[i + 2]]; };
  const flat = regions.map((r) => { // luminance spread inside a region: ~0 means one flat color
    const L = []; for (let i = 0; i < 40; i++) for (let j = 0; j < 40; j++) { const [R, G, B] = px(r.x + (r.w * (i + 0.5)) / 40, r.y + (r.h * (j + 0.5)) / 40); L.push(0.2126 * R + 0.7152 * G + 0.0722 * B); }
    const m = L.reduce((a, b) => a + b, 0) / L.length; return Math.sqrt(L.reduce((a, b) => a + (b - m) ** 2, 0) / L.length);
  });
  return { flat, colors: samples.map(([x, y]) => px(x, y)) };
};

const parseColor = (s) => {
  const n = (s.match(/-?[\d.]+/g) ?? []).map(Number);
  if (/^color\(/.test(s)) return { rgb: n.slice(0, 3).map((v) => v * 255), a: n[3] ?? 1 };
  return { rgb: n.slice(0, 3), a: n[3] ?? 1 };
};
const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const pct = (v) => Math.round(v * 100) + '%';
const q = (s) => `"${s.length > 40 ? s.slice(0, 40) + '…' : s}"`;

// ---------- one viewport ----------
const TRANSPARENT_TEXT = '*{color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}';

// ---------- one look at what is on screen now ----------
async function measureFrame(page, scratch, { framing }) {
  const shot = await page.screenshot({ scale: 'css' });
  const facts = await page.evaluate(INSPECT);
  // backdrop: same frame with all text made transparent, to measure contrast against what is behind it
  const style = await page.addStyleTag({ content: TRANSPARENT_TEXT });
  await page.waitForTimeout(50);
  const backdrop = await page.screenshot({ scale: 'css' });
  await style.evaluate((el) => el.remove()).catch(() => {});

  const findings = [];
  const add = (level, msg, hint) => findings.push({ level, msg, hint });

  // blank canvas
  const gl = facts.canvases.filter((c) => c.visible);
  const onScreen = (r) => { const y = Math.max(r.y, 0), h = Math.min(r.y + r.h, facts.vh) - y; return h > 4 ? { x: r.x, y, w: r.w, h } : null; };
  const regions = gl.map((c) => onScreen(c.visible));
  const flat = (await scratch.evaluate(PIXELS, { b64: shot.toString('base64'), regions: regions.map((r) => r ?? { x: 0, y: 0, w: 1, h: 1 }), samples: [] })).flat;
  const draws = facts.perFrame.filter((d) => d > 0);
  gl.forEach((c, i) => {
    if (!regions[i] || flat[i] >= 0.6) return;
    const nothing = c.type.startsWith('webgl') && draws.length === 0;
    add('error', `The ${c.type} canvas (${Math.round(c.rect.w)}x${Math.round(c.rect.h)}) shows one flat color${nothing ? ' and drew nothing in the last frames' : ''}: the scene is not visible.`, 'errors');
  });

  // subject framing
  const s = facts.subject;
  if (framing && s && s.area) {
    const r = s.rect, a = s.area;
    const cut = { left: Math.max(0, a.x - r.x) / r.w, right: Math.max(0, r.x + r.w - (a.x + a.w)) / r.w, top: Math.max(0, a.y - r.y) / r.h, bottom: Math.max(0, r.y + r.h - (a.y + a.h)) / r.h };
    const sides = Object.entries(cut).filter(([, v]) => v > 0.03);
    if (s.behindCamera > 0.2) add('issue', `The camera is inside or behind the 3D subject (${pct(s.behindCamera)} of its points are behind the camera).`, 'framing');
    else if (sides.length) add('issue', `The 3D subject is cut off: ${sides.map(([k, v]) => `${pct(v)} past the ${k} edge`).join(', ')} of the visible canvas (subject ${Math.round(r.w)}x${Math.round(r.h)}px, visible canvas ${Math.round(a.w)}x${Math.round(a.h)}px).`, 'framing');
    const cover = (Math.min(r.w, a.w) * Math.min(r.h, a.h)) / (a.w * a.h);
    if (s.covered > 0.15) add('issue', `Page UI covers about ${pct(s.covered)} of the 3D subject (${s.coveredBy.join(', ')}). Move it off the subject or give the subject its own space.`, 'framing');
    if (!sides.length && cover < 0.05) add('issue', `The 3D subject is small: about ${pct(cover)} of the visible canvas.`, 'framing');
    if (!sides.length && s.behindCamera <= 0.2 && !(s.covered > 0.15)) add('ok', `3D subject fits the frame (${Math.round(r.w)}x${Math.round(r.h)}px in a ${Math.round(a.w)}x${Math.round(a.h)}px canvas).`);
  } else if (framing && facts.subjectNote) add('info', facts.subjectNote);
  else if (framing && facts.canvases.length && !facts.renderers) add('info', 'Could not inspect the three.js scene (not three.js, or three.js loaded in a way this check cannot see); framing not checked.');

  // text
  for (const o of facts.overlaps.slice(0, 20)) add('issue', `Text overlaps other text: ${q(o.a)} and ${q(o.b)}.`, 'labels');
  for (const o of facts.offscreen.slice(0, 20)) add('issue', `Text is cut off by the screen edge: ${q(o.text)}.`, 'labels');
  for (const o of facts.coveredText.slice(0, 6)) add('issue', `Text is covered by another element (${o.by}): ${q(o.text)}.`, 'labels');
  for (const o of facts.clipped.slice(0, 6)) add('issue', `Text is clipped by its container (${o.by}): ${q(o.text)}.`, 'labels');

  // contrast of text drawn over the canvas, against the pixels actually behind it
  const pts = [], owners = [];
  facts.contrastCandidates.forEach((t, ti) => {
    for (const r of t.lines) for (let i = 0; i < 10; i++) for (let j = 0; j < 3; j++) {
      const x = r.x + r.w * (0.05 + 0.9 * (i + 0.5) / 10), y = r.y + r.h * (0.2 + 0.6 * (j + 0.5) / 3);
      if (x >= 0 && x < facts.vw && y >= 0 && y < facts.vh) { pts.push([x, y]); owners.push(ti); }
    }
  });
  if (pts.length) {
    const { colors } = await scratch.evaluate(PIXELS, { b64: backdrop.toString('base64'), regions: [], samples: pts });
    const low = [];
    facts.contrastCandidates.forEach((t, ti) => {
      const c = parseColor(t.color), alpha = c.a * t.op;
      if (alpha < 0.02) return; // gradient-filled text etc.: cannot measure
      const vals = colors.filter((_, k) => owners[k] === ti).map((bg) => ratio(bg.map((v, k) => alpha * c.rgb[k] + (1 - alpha) * v), bg)).sort((x, y) => x - y);
      if (!vals.length) return;
      const p20 = vals[Math.floor(vals.length * 0.2)];
      const large = t.size >= 24 || (t.size >= 18.66 && t.weight >= 700);
      const need = large ? 3 : 4.5;
      if (p20 < need * 0.9) low.push({ t, p20, need }); // 10% slack: samples include the worst spots behind the text
    });
    low.sort((x, y) => x.p20 / x.need - y.p20 / y.need);
    for (const { t, p20, need } of low.slice(0, 20)) add('issue', `Hard to read over the 3D scene: ${q(t.text)} (${Math.round(t.size)}px) has contrast ${p20.toFixed(1)}:1 against what is behind it; needs ${need}:1${t.shadow ? ' (it has a text-shadow, which this check ignores)' : ''}.`, 'legibility');
  }
  return { shot, facts, findings };
}

// ---------- frames of a long page laid out in one image ----------
const FILM = async ({ frames, w, h, cols, labels }) => {
  const imgs = await Promise.all(frames.map(async (b64) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); return i; }));
  const rows = Math.ceil(imgs.length / cols), gap = 6;
  const c = new OffscreenCanvas(cols * w + (cols + 1) * gap, rows * (h + gap) + gap), g = c.getContext('2d');
  g.fillStyle = '#111'; g.fillRect(0, 0, c.width, c.height);
  imgs.forEach((img, k) => {
    const x = gap + (k % cols) * (w + gap), y = gap + Math.floor(k / cols) * (h + gap);
    g.drawImage(img, x, y, w, h);
    g.fillStyle = 'rgba(0,0,0,.65)'; g.fillRect(x, y, 64, 22);
    g.fillStyle = '#7CFC9A'; g.font = '14px monospace'; g.fillText(labels[k], x + 6, y + 16);
  });
  const blob = await c.convertToBlob({ type: 'image/png' });
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let bin = ''; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

// ---------- one viewport: load, (click), then one look or a film of the scroll ----------
async function checkViewport(browser, scratch, url, name, ctxOpts) {
  const ctx = await browser.newContext(ctxOpts);
  const page = await ctx.newPage();
  const errors = [], warnings = [], failed = [], notes = [];
  let inflight = 0, lastNet = Date.now();
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 240));
    else if (m.type() === 'warning' && /THREE\./.test(m.text())) warnings.push(m.text().slice(0, 240));
  });
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 240)));
  page.on('request', () => { inflight++; lastNet = Date.now(); });
  const done = () => { inflight = Math.max(0, inflight - 1); lastNet = Date.now(); };
  let bytes = 0;
  page.on('requestfinished', (r) => { done(); r.sizes().then((z) => { bytes += z.responseBodySize ?? 0; }).catch(() => {}); });
  page.on('requestfailed', (r) => { done(); if (!/favicon/.test(r.url())) failed.push(`${r.url()} (${r.failure()?.errorText ?? 'failed'})`); });
  page.on('response', (r) => { if (r.status() >= 400 && !/favicon/.test(r.url())) failed.push(`${r.url()} (HTTP ${r.status()})`); });
  await page.addInitScript(PROBE);
  try { await page.goto(url, { waitUntil: 'load', timeout: 60000 }); }
  catch (e) { errors.push('Page did not load: ' + e.message.split('\n')[0]); }
  const quiet = async () => { const t0 = Date.now(); while (Date.now() - t0 < 20000 && (inflight > 0 || Date.now() - lastNet < 800)) await page.waitForTimeout(100); };
  const settle = () => page.evaluate(() => Promise.race([ // let finite CSS entrance animations finish (fades, slide-ins)
    Promise.all(document.getAnimations().filter((a) => isFinite(a.effect?.getComputedTiming().endTime)).map((a) => a.finished.catch(() => {}))),
    new Promise((r) => setTimeout(r, 8000)),
  ])).catch(() => {});
  await quiet(); await settle();
  // a page that announces readiness (the starter sets <html data-ready="0">, then "1" when its intro is done)
  const ready = await page.evaluate(async () => {
    const el = document.documentElement;
    if (!('ready' in el.dataset)) return null;
    const t0 = performance.now();
    while (el.dataset.ready !== '1' && performance.now() - t0 < 12000) await new Promise((r) => setTimeout(r, 100));
    return el.dataset.ready === '1' ? Math.round(performance.now()) : -1;
  }).catch(() => null);
  await page.waitForTimeout(EXTRA_WAIT);
  if (CLICK) {
    const el = page.getByText(CLICK, { exact: false }).first();
    if (await el.count().catch(() => 0)) { await el.click({ timeout: 5000 }).catch(() => notes.push(`Could not click "${CLICK}".`)); await quiet(); await settle(); await page.waitForTimeout(2500); }
    else notes.push(`No element with the text "${CLICK}" to click.`);
  }

  // frame time on the first screen (this machine's GPU; a mid-range phone is several times slower)
  const frameTime = await page.evaluate(() => new Promise((res) => {
    const t = []; let last = performance.now();
    const f = (now) => { t.push(now - last); last = now; if (t.length < 90) requestAnimationFrame(f); else { t.sort((a, b) => a - b); res(t[45]); } };
    requestAnimationFrame(f); setTimeout(() => res(null), 8000);
  })).catch(() => null);
  // the basics a developer jury checks: a real title and description, the language, one h1, alt text, the native cursor
  const sem = await page.evaluate(() => {
    const d = document, hidden = (el) => !!el && getComputedStyle(el).cursor === 'none';
    return {
      title: d.title.trim(), description: (d.querySelector('meta[name="description"]')?.content ?? '').trim(), lang: d.documentElement.lang,
      h1: d.querySelectorAll('h1').length, imgsNoAlt: [...d.querySelectorAll('img')].filter((i) => !i.hasAttribute('alt')).length,
      cursorHidden: [d.documentElement, d.body, d.querySelector('main')].some(hidden),
    };
  }).catch(() => null);
  const maxScroll = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - innerHeight));
  // where to look: each scene at its rest point (the camera holds, the statement has arrived) when the page is
  // built from scenes ([data-shot] sections, or tall <section>s); otherwise evenly spaced scroll positions
  const stops = FRAMES ? null : await page.evaluate(() => {
    const vh = innerHeight, max = Math.max(0, document.documentElement.scrollHeight - vh);
    let els = [...document.querySelectorAll('[data-shot]')];
    if (els.length < 3) els = [...document.querySelectorAll('main section, body > section')].filter((e) => e.offsetHeight > vh * 0.8 && !e.parentElement.closest('section'));
    if (els.length < 3 || els.length > 14) return null;
    const ys = els.map((e, k) => {
      if (k === 0) return 0;
      const top = e.getBoundingClientRect().top + scrollY, h = e.offsetHeight;
      return Math.round(Math.min(max, Math.max(0, h > vh ? top + (h - vh) * 0.35 : top + h / 2 - vh / 2)));
    });
    return ys.filter((y, k) => k === 0 || y - ys[k - 1] > vh * 0.3);
  }).catch(() => null);
  const nFrames = stops?.length ?? FRAMES ?? (maxScroll > ctxOpts.viewport.height * 0.5 ? 6 : 1);
  const shotPath = path.join(OUT, `${name}.png`);
  const looks = [];
  let filmPath = null;
  if (nFrames <= 1) {
    // one screen: if the main 3D canvas is not fully on screen (e.g. below the fold), scroll it into view
    const scrolled = await page.evaluate(() => {
      const cs = [...document.querySelectorAll('canvas')].filter((c) => c.__scType);
      if (!cs.length) return false;
      const c = cs.sort((a, b) => b.clientWidth * b.clientHeight - a.clientWidth * a.clientHeight)[0];
      const r = c.getBoundingClientRect();
      if (r.top >= -1 && r.bottom <= innerHeight + 1) return false;
      window.scrollBy(0, r.height <= innerHeight ? r.top - (innerHeight - r.height) / 2 : r.top);
      return true;
    });
    if (scrolled) { await page.waitForTimeout(600); notes.push('Scrolled the page so the 3D canvas is on screen.'); }
    looks.push({ at: null, ...(await measureFrame(page, scratch, { framing: true })) });
  } else {
    // a long page: look at evenly spaced scroll positions; framing is judged on the first screen only,
    // since a scroll-driven subject is often mid-move between them
    for (let i = 0; i < nFrames; i++) {
      const y = stops ? stops[i] : Math.round((maxScroll * i) / (nFrames - 1));
      await page.evaluate((v) => window.scrollTo(0, v), y);
      await page.waitForTimeout(SCROLL_WAIT);
      looks.push({ at: Math.round((100 * y) / Math.max(1, maxScroll)) + '%', ...(await measureFrame(page, scratch, { framing: i === 0 })) });
    }
    const phone = name === 'phone';
    const film = await scratch.evaluate(FILM, {
      frames: looks.map((l) => l.shot.toString('base64')), labels: looks.map((l) => l.at),
      w: phone ? 195 : 480, h: phone ? 422 : 300, cols: phone ? Math.min(nFrames, nFrames > 6 ? Math.ceil(nFrames / 2) : 6) : 3,
    });
    filmPath = path.join(OUT, `film-${name}.png`);
    await fs.writeFile(filmPath, Buffer.from(film, 'base64'));
  }
  await fs.writeFile(shotPath, looks[0].shot);
  const last = looks[looks.length - 1].facts;
  await ctx.close();

  const findings = [];
  const add = (level, msg, hint, at) => findings.push({ level, msg, hint, at });
  for (const e of [...new Set(errors)]) add('error', `Console/page error: ${e}`, 'errors');
  for (const f of [...new Set(failed)]) add('error', `Failed to load ${f}`, 'errors');
  if (!looks.some((l) => l.facts.canvases.length)) add('error', 'No WebGL/WebGPU canvas on the page: the 3D scene never started.', 'errors');
  const first = looks[0].facts;
  if (name === 'phone') for (const c of first.canvases) if (c.ratio > 2.05) add('issue', `Canvas renders at ${c.ratio.toFixed(1)}x pixel ratio on a phone; cap it at 2 (renderer.setPixelRatio(Math.min(devicePixelRatio, 2))).`, 'performance');
  const devW = ctxOpts.viewport.width;
  if (first.vw > devW + 1) add('issue', `The layout is wider than the screen: something overflows, so the page grew to ${first.vw}px on a ${devW}px screen and the browser zooms out.`, 'labels');
  else if (first.pageWidth > first.vw + 1) add('issue', `The page is wider than the screen (${first.pageWidth}px on a ${first.vw}px screen), so it scrolls sideways.`, 'labels');
  // merge what each look found; the same finding at several scroll positions is reported once with its positions
  const merged = new Map();
  for (const l of looks) for (const f of l.findings) {
    const k = f.level + f.msg;
    if (!merged.has(k)) merged.set(k, { ...f, at: [] });
    if (l.at) merged.get(k).at.push(l.at);
  }
  const perHint = new Map(), CAP = 6;
  for (const f of merged.values()) {
    const k = f.level + f.hint, n = (perHint.get(k) ?? 0) + 1;
    perHint.set(k, n);
    if (f.level !== 'issue' || n <= CAP) add(f.level, f.msg, f.hint, f.at.length ? f.at : null);
  }
  for (const [k, n] of perHint) if (k.startsWith('issue') && n > CAP) add('issue', `…and ${n - CAP} more [${k.slice(5)}] findings like the ones above (see report.json).`, k.slice(5));
  // ambition: does the camera tell the story with different shots? (only when the subject is on screen in
  // most of the scroll; a page whose 3D is one section is judged by its screenshots instead)
  const seen = looks.map((l) => l.facts.subject).filter((s) => s?.rect && s.camera);
  if (nFrames > 1 && seen.length >= 4) {
    let shots = 1;
    for (let k = 1; k < seen.length; k++) {
      const a = seen[k - 1], b = seen[k], d1 = a.camera.dir, d2 = b.camera.dir;
      const ang = Math.acos(Math.max(-1, Math.min(1, (d1[0] * d2[0] + d1[1] * d2[1] + d1[2] * d2[2]) / (Math.hypot(...d1) * Math.hypot(...d2) || 1)))) * 180 / Math.PI;
      const shift = Math.hypot(a.rect.x + a.rect.w / 2 - b.rect.x - b.rect.w / 2, a.rect.y + a.rect.h / 2 - b.rect.y - b.rect.h / 2) / Math.hypot(first.vw, first.vh);
      const grow = (b.rect.w * b.rect.h) / Math.max(1, a.rect.w * a.rect.h);
      if (ang > 12 || shift > 0.12 || grow > 1.6 || grow < 0.62) shots++;
    }
    if (shots <= 2) add('issue', `The camera shows about ${shots === 1 ? 'one shot' : 'two shots'} across ${seen.length} scroll positions: every scene looks the same. Give each scene its own shot (hero, macro, top, side, wide; references/scenes-and-motion.md).`, 'ambition');
  }
  // story: does each part of the scroll carry its words? Fixed text shown in every frame (a logo, the nav)
  // is chrome, not a statement.
  if (nFrames > 1) {
    const all = looks.map((l) => l.facts.statements ?? []);
    const chrome = new Set(all[0].filter((t) => t.fixed && all.every((f) => f.some((u) => u.text === t.text))).map((t) => t.text));
    const empty = looks.filter((l, k) => !all[k].some((t) => !(t.fixed && chrome.has(t.text)))).map((l) => l.at);
    if (empty.length >= Math.ceil(nFrames / 2)) add('issue', `${empty.length} of ${nFrames} scroll positions show no statement (no display-size text at readable opacity): ${empty.join(', ')}. The visitor scrolls through empty frames. Keep each scene's statement on screen while its scene is on screen, and fade it only at the hand-over to the next scene (references/scenes-and-motion.md).`, 'story');
  }
  // usability floor (desktop only: these are page-wide)
  if (name === 'desktop' && sem) {
    if (sem.cursorHidden) add('issue', 'The native cursor is hidden (cursor: none). Juries count this against usability: keep the native cursor; a custom cursor may follow it, never replace it.', 'usability');
    if (!sem.title || /^(starter|document|untitled|index|name: one line.*)$/i.test(sem.title)) add('issue', `The page has no real <title>${sem.title ? ` ("${sem.title}")` : ''}: name the subject and what it is.`, 'usability');
    if (!sem.description || /one sentence a search result/i.test(sem.description)) add('issue', 'No real <meta name="description">: one sentence a search result would show.', 'usability');
    if (!sem.lang) add('issue', 'The <html> element has no lang attribute.', 'usability');
    if (sem.h1 === 0) add('issue', 'The page has no <h1>: the name (or the first statement) should be the h1.', 'usability');
    if (sem.imgsNoAlt) add('issue', `${sem.imgsNoAlt} <img> element${sem.imgsNoAlt > 1 ? 's have' : ' has'} no alt attribute (use alt="" for decoration).`, 'usability');
  }
  if (name === 'desktop') {
    if (ready === -1) add('issue', 'The page never finished its intro: <html data-ready> stayed "0" for 12 s. Nothing should keep the visitor waiting that long.', 'performance');
    else if (ready > 6500) add('issue', `The intro finished ${(ready / 1000).toFixed(1)} s after the page started loading. Keep the reveal near 2 s once the assets have loaded (load less, or show the page while the rest loads).`, 'performance');
    if (frameTime > 25) add('issue', `Frames take about ${Math.round(frameTime)} ms here (${Math.round(1000 / frameTime)} fps) on a desktop GPU, so a phone will crawl. Lower the pixel ratio, the shadow map size, half-res post, fewer lights, instancing (references/finish.md).`, 'performance');
    const mbs = bytes / 1048576;
    if (mbs > 15) add('issue', `The page downloads ${mbs.toFixed(1)} MB. Award sites stay under about 5 MB for a 3D page: 1k textures, fewer props, compressed models (KTX2, meshopt).`, 'performance');
    add('info', `${frameTime ? `Frame time ${Math.round(frameTime)} ms (${Math.round(1000 / frameTime)} fps here). ` : ''}${bytes ? `Downloaded ${mbs.toFixed(1)} MB. ` : ''}${ready > 0 ? `Ready after ${(ready / 1000).toFixed(1)} s.` : ''}`.trim());
  }
  for (const n of notes) add('info', n);
  for (const w of [...new Set(warnings)].slice(0, 5)) add('info', `three.js warning: ${w}`);
  const draws = last.perFrame.filter((d) => d > 0).sort((x, y) => x - y);
  add('info', `${draws.length ? draws[Math.floor(draws.length / 2)] : 0} draw calls per frame; three.js r${last.revision ?? '?'}.${nFrames > 1 ? ` Looked at ${nFrames} ${stops ? 'scenes, each at its rest point' : 'scroll positions'}.` : ''}`);
  const rank = { error: 0, issue: 1, ok: 2, info: 3 };
  findings.sort((a, b) => rank[a.level] - rank[b.level]);
  return { name, size: `${first.vw}x${first.vh}`, screenshot: shotPath, film: filmPath, findings, facts: looks.map((l) => ({ at: l.at, ...l.facts, contrastCandidates: undefined })) };
}

// ---------- reduced motion: the page must still work, and its words must still show ----------
async function checkReduced(browser, scratch, url, seenErrors) {
  const ctx = await browser.newContext({ ...VIEWPORTS.desktop, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 240)); });
  page.on('pageerror', (e) => errors.push(String(e.message).slice(0, 240)));
  await page.addInitScript(PROBE);
  try { await page.goto(url, { waitUntil: 'load', timeout: 60000 }); } catch (e) { errors.push('Page did not load: ' + e.message.split('\n')[0]); }
  await page.waitForTimeout(2000);
  await page.evaluate(async () => {
    const el = document.documentElement;
    if (!('ready' in el.dataset)) return;
    const t0 = performance.now();
    while (el.dataset.ready !== '1' && performance.now() - t0 < 12000) await new Promise((r) => setTimeout(r, 100));
  }).catch(() => {});
  await page.waitForTimeout(EXTRA_WAIT);
  if (CLICK) { const el = page.getByText(CLICK, { exact: false }).first(); if (await el.count().catch(() => 0)) { await el.click({ timeout: 5000 }).catch(() => {}); await page.waitForTimeout(2500); } }
  const maxScroll = await page.evaluate(() => Math.max(0, document.documentElement.scrollHeight - innerHeight));
  const looks = [];
  for (const f of maxScroll > 450 ? [0, 0.5, 1] : [0]) {
    await page.evaluate((y) => window.scrollTo(0, y), Math.round(maxScroll * f));
    await page.waitForTimeout(800);
    looks.push({ at: `${Math.round(f * 100)}%`, ...(await measureFrame(page, scratch, { framing: false })) });
  }
  const shotPath = path.join(OUT, 'reduced-motion.png');
  await fs.writeFile(shotPath, looks[0].shot);
  await ctx.close();
  const findings = [];
  const add = (level, msg, hint, at) => findings.push({ level, msg, hint, at });
  for (const e of [...new Set(errors)].filter((x) => !seenErrors.has(x))) add('error', `With reduced motion: ${e}`, 'errors');
  for (const l of looks) for (const f of l.findings) if (f.level === 'error') add('error', `With reduced motion: ${f.msg}`, f.hint, [l.at]);
  const all = looks.map((l) => l.facts.statements ?? []);
  const chrome = new Set(all[0].filter((t) => t.fixed && all.every((x) => x.some((u) => u.text === t.text))).map((t) => t.text));
  const empty = looks.filter((l, k) => !all[k].some((t) => !(t.fixed && chrome.has(t.text)) || looks.length === 1)).map((l) => l.at);
  if (empty.length) add('issue', `With reduced motion, ${empty.join(', ')} of the scroll show${empty.length === 1 ? 's' : ''} no statement. Reduced motion should drop movement, not content: show the words without the reveal.`, 'usability');
  if (!findings.length) add('ok', `Works with reduced motion (looked at ${looks.map((l) => l.at).join(', ')}).`);
  return { name: 'reduced motion', size: '1440x900', screenshot: shotPath, film: null, findings };
}

// ---------- main ----------
const chromium = await loadPlaywright();
if (!chromium) {
  console.error('scene-check needs Playwright. Install it in this project:\n  npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}
let server = null, url = target;
if (!/^https?:\/\//.test(target)) {
  const dir = path.resolve(target);
  const stat = await fs.stat(dir).catch(() => null);
  if (!stat) { console.error(`Not a URL or folder: ${target}`); process.exit(2); }
  server = await serve(stat.isDirectory() ? dir : path.dirname(dir));
  url = `http://127.0.0.1:${server.address().port}/${stat.isDirectory() ? '' : path.basename(dir)}`;
}
await fs.mkdir(OUT, { recursive: true });
let browser;
try {
  browser = await chromium.launch({ args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-gpu'] });
} catch (e) {
  console.error('Could not start Chromium. Run: npx playwright install chromium\n' + e.message.split('\n')[0]);
  process.exit(2);
}
const scratch = await browser.newPage();
const results = [];
for (const [name, o] of Object.entries(VIEWPORTS)) if (!ONLY || ONLY === name) results.push(await checkViewport(browser, scratch, url, name, o));
if (!ONLY || ONLY === 'desktop') {
  const seen = new Set(results.flatMap((r) => r.findings.filter((f) => f.level === 'error').map((f) => f.msg.replace(/^Console\/page error: /, ''))));
  results.push(await checkReduced(browser, scratch, url, seen));
}
await browser.close();
server?.close();
await fs.writeFile(path.join(OUT, 'report.json'), JSON.stringify({ url, checkedAt: new Date().toISOString(), results }, null, 2));

const MARK = { error: '✗ ERROR', issue: '✗ ISSUE', ok: '✓', info: '·' };
let errs = 0, issues = 0;
console.log(`scene-check ${target}`);
for (const r of results) {
  console.log(`\n${r.name} ${r.size} — screenshot: ${path.relative(process.cwd(), r.screenshot)}${r.film ? `, scroll film: ${path.relative(process.cwd(), r.film)}` : ''}`);
  for (const f of r.findings) {
    if (f.level === 'error') errs++; if (f.level === 'issue') issues++;
    console.log(`  ${MARK[f.level]} ${f.msg}${f.at ? ` (at ${f.at.join(', ')} of the scroll)` : ''}${f.hint && f.level !== 'ok' ? `  [${f.hint}]` : ''}`);
  }
}
const films = results.some((r) => r.film);
console.log(`\n${errs} errors, ${issues} issues. ${errs + issues ? `Look at the screenshots${films ? ' and the scroll films' : ''}, fix these (or say why one is intended), then run the check again.` : `Look at the screenshots${films ? ' and the scroll films' : ''} before you finish.`}`);
process.exit(errs + issues ? 1 : 0);
