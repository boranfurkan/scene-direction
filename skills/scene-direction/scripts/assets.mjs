#!/usr/bin/env node
// Real assets for a 3D site: search Poly Haven's CC0 library (HDRIs, PBR textures, glTF models) and download
// what you pick into the project, so the site hosts its own files.
//
//   node assets.mjs search <words...> [--type models|hdris|textures] [--limit 12] [--sheet <file.png>]
//   node assets.mjs get <id> [<id> ...] [--res 1k|2k|4k] [--out assets]
//
// Everything on Poly Haven is CC0: free for any use, no attribution required. Downloading (instead of linking to
// the live API at runtime) keeps the site fast and independent; a credit line is still a nice touch.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { execSync } from 'node:child_process';

const argv = process.argv.slice(2);
const opt = (name, dflt) => { const i = argv.indexOf(name); return i > -1 ? argv[i + 1] : dflt; };
const flags = new Set(['--type', '--limit', '--sheet', '--res', '--out']);
const words = argv.filter((a, i) => !a.startsWith('--') && !(i > 0 && flags.has(argv[i - 1]))).flatMap((w) => w.split(/\s+/)).filter(Boolean);
const cmd = words.shift();
const API = 'https://api.polyhaven.com';
const HEADERS = { 'User-Agent': 'scene-direction-skill/1.0 (asset download for a self-hosted site)' };
const CACHE = path.join(os.homedir(), '.scene-direction');
const TYPES = ['models', 'hdris', 'textures'];

function usage(code = 2) {
  console.log(`Usage:
  node assets.mjs search <words...> [--type models|hdris|textures] [--limit 12] [--sheet <file.png>]
  node assets.mjs get <id> [<id> ...] [--res 1k|2k|4k] [--out assets]

Examples:
  node assets.mjs search ceramic vase --type models --sheet vases.png
  node assets.mjs search studio softbox --type hdris
  node assets.mjs search oak wood floor --type textures
  node assets.mjs get studio_small_08 wood_table_001 ArmChair_01 --out assets`);
  process.exit(code);
}

async function getJSON(url) {
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

// the full list of one asset type, cached for a week
async function list(type) {
  const file = path.join(CACHE, `polyhaven-${type}.json`);
  try {
    const st = await fs.stat(file);
    if (Date.now() - st.mtimeMs < 7 * 864e5) return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {}
  const data = await getJSON(`${API}/assets?t=${type}`);
  await fs.mkdir(CACHE, { recursive: true });
  await fs.writeFile(file, JSON.stringify(data));
  return data;
}

const clean = (cats) => cats.filter((c) => !c.startsWith('collection:'));
// Poly Haven sizes are in millimetres, width × depth × height (Blender axes: height is z; in three.js it is y)
const metres = (mm) => mm.map((v) => (v / 1000).toFixed(2)).join(' × ');

function describe(type, id, a) {
  const bits = [clean(a.categories).join(', ')];
  if (type === 'models') {
    if (a.dimensions) bits.push(`${metres(a.dimensions)} m (w × d × h)`);
    if (a.polycount) bits.push(`${a.polycount.toLocaleString('en')} tris`);
  }
  if (type === 'textures' && a.dimensions) bits.push(`covers ${metres(a.dimensions)} m`);
  return `${id.padEnd(30)} ${a.name}  ·  ${bits.join('  ·  ')}`;
}

async function search() {
  if (!words.length) usage();
  const types = opt('--type') ? [opt('--type')] : TYPES;
  for (const t of types) if (!TYPES.includes(t)) { console.error(`--type must be one of ${TYPES.join(', ')}`); process.exit(2); }
  const limit = Number(opt('--limit', 12));
  const q = words.map((w) => w.toLowerCase());
  const hits = [];
  for (const type of types) {
    const data = await list(type);
    for (const [id, a] of Object.entries(data)) {
      const tags = (a.tags ?? []).map((x) => x.toLowerCase()), cats = (a.categories ?? []).map((x) => x.toLowerCase());
      const name = a.name.toLowerCase(), lid = id.toLowerCase();
      let score = 0, matched = 0;
      for (const w of q) {
        const s = (tags.includes(w) ? 3 : 0) + (cats.includes(w) ? 3 : 0) + (name.includes(w) ? 2 : 0) + (lid.includes(w) ? 1 : 0)
          + (tags.some((t) => t.includes(w)) || cats.some((c) => c.includes(w)) ? 1 : 0);
        if (s) matched++;
        score += s;
      }
      if (matched) hits.push({ type, id, a, score: score + matched * 4, pop: a.download_count ?? 0 });
    }
  }
  hits.sort((x, y) => y.score - x.score || y.pop - x.pop);
  const top = hits.slice(0, limit);
  if (!top.length) { console.log('No matches. Try broader words (e.g. "chair", "wood", "studio", "sunset").'); return; }
  for (const h of top) console.log(`[${h.type.slice(0, -1)}] ${describe(h.type, h.id, h.a)}`);
  console.log(`\n${hits.length} matches. Get one with: node assets.mjs get ${top[0].id} --out assets`);
  const sheet = opt('--sheet');
  if (sheet) await contactSheet(top, sheet);
}

// a labelled grid of thumbnails, so you can look before you pick
async function contactSheet(items, file) {
  const chromium = await loadPlaywright();
  if (!chromium) { console.log('(No Playwright, so no contact sheet. npm i -D playwright && npx playwright install chromium)'); return; }
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 400 }, deviceScaleFactor: 1 });
  // the primary render shows the whole asset (thumbs are close crops)
  const cells = items.map((h) => `<figure><img src="https://cdn.polyhaven.com/asset_img/primary/${h.id}.png?width=420"><figcaption>${h.id}</figcaption></figure>`).join('');
  await page.setContent(`<style>body{margin:0;background:#151515;font:13px ui-monospace,monospace;color:#ddd}
    main{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:8px}figure{margin:0;background:#222}
    img{width:100%;aspect-ratio:4/3;object-fit:contain;background:#2a2a2a;display:block}figcaption{padding:6px 8px}</style><main>${cells}</main>`);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.screenshot({ path: file, fullPage: true });
  await browser.close();
  console.log(`Contact sheet: ${file}`);
}

async function download(url, to) {
  const r = await fetch(url, { headers: HEADERS });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  await fs.mkdir(path.dirname(to), { recursive: true });
  await fs.writeFile(to, buf);
  return buf.length;
}

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;

async function get() {
  if (!words.length) usage();
  const res = opt('--res', '1k'), out = opt('--out', 'assets');
  const lists = Object.fromEntries(await Promise.all(TYPES.map(async (t) => [t, await list(t)])));
  let total = 0;
  for (const id of words) {
    const type = TYPES.find((t) => lists[t][id]);
    if (!type) { console.error(`${id}: not found on Poly Haven. Search first: node assets.mjs search <words>`); process.exitCode = 1; continue; }
    const a = lists[type][id], files = await getJSON(`${API}/files/${id}`);
    const pick = (group) => { const g = files[group]; if (!g) return null; return g[res] ?? g[Object.keys(g).sort()[0]]; };
    let bytes = 0;
    if (type === 'hdris') {
      const f = pick('hdri')?.hdr;
      const to = path.join(out, `${id}_${res}.hdr`);
      bytes += await download(f.url, to);
      console.log(`HDRI ${id} -> ${to} (${mb(bytes)})
  import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
  const hdr = await new HDRLoader().loadAsync('${to}');
  scene.environment = new THREE.PMREMGenerator(renderer).fromEquirectangular(hdr).texture;  // light and reflections
  hdr.dispose();   // keep scene.background as the CSS ground colour; rotate with scene.environmentRotation.y`);
    } else if (type === 'textures') {
      const maps = { diff: 'Diffuse', nor_gl: 'nor_gl', rough: 'Rough', arm: 'arm' };
      const got = {};
      for (const [short, key] of Object.entries(maps)) {
        const f = pick(key)?.jpg;
        if (!f) continue;
        const to = path.join(out, id, `${id}_${short}_${res}.jpg`);
        bytes += await download(f.url, to);
        got[short] = to;
      }
      const size = a.dimensions ? `${metres(a.dimensions)} m` : 'its real size';
      console.log(`Texture ${id} -> ${path.join(out, id)}/ (${mb(bytes)}); one tile covers ${size}
  const tl = new THREE.TextureLoader(), tex = (f, srgb) => { const t = tl.load(f); t.wrapS = t.wrapT = THREE.RepeatWrapping; if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t; };
  const mat = new THREE.MeshStandardMaterial({ map: tex('${got.diff}', true), normalMap: tex('${got.nor_gl}'), roughnessMap: tex('${got.rough ?? got.arm}') });
  // repeat = surface size / tile size, set on every map: for (const t of [mat.map, mat.normalMap, mat.roughnessMap]) t.repeat.set(rx, ry);
  // tint toward the palette with mat.color (it multiplies the map) rather than leaving the photo's own colour`);
    } else {
      const g = pick('gltf')?.gltf;
      const dir = path.join(out, id), to = path.join(dir, `${id}_${res}.gltf`);
      bytes += await download(g.url, to);
      for (const [rel, f] of Object.entries(g.include ?? {})) bytes += await download(f.url, path.join(dir, rel));
      const dims = a.dimensions ? `${metres(a.dimensions)} m (width × depth × height; glTF is metres, y up)` : 'unknown size';
      console.log(`Model ${id} -> ${to} (${mb(bytes)}); ${dims}; ${(a.polycount ?? 0).toLocaleString('en')} tris
  import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
  const gltf = await new GLTFLoader().loadAsync('${to}');
  const prop = gltf.scene; prop.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; } });
  scene.add(prop);   // place it at real scale beside the subject; tint materials toward the palette if it clashes`);
    }
    total += bytes;
  }
  if (total) {
    console.log(`\nDownloaded ${mb(total)} in all. CC0 (Poly Haven): free for any use, no attribution required.`);
    if (total > 12 * 1048576) console.log('That is a lot for one page: prefer 1k maps, fewer props, or compress with gltf-transform (KTX2, meshopt).');
  }
}

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

try {
  if (cmd === 'search') await search();
  else if (cmd === 'get') await get();
  else usage(cmd ? 2 : 0);
} catch (e) {
  console.error(`assets: ${e.message}`);
  process.exit(1);
}
