#!/usr/bin/env node
// Deal art directions for a 3D site, so builds don't all converge on the same default.
//   node draw.mjs --list
//   node draw.mjs --kind <person|product|place|brand|...> --brief "<one line>"        deals 3 options
//   node draw.mjs --direction <id> --brief "<one line>" --scenes <n>                    writes the sheet
// The sheet goes to .scene-direction/sheet.md in the current folder. Recent deals are remembered in
// ~/.scene-direction/history.json and are not dealt again for a while.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(here, 'assets.mjs');
const LIB = JSON.parse(fs.readFileSync(path.join(here, '..', 'library', 'directions.json'), 'utf8'));
const argv = process.argv.slice(2);
const opt = (n, d = null) => { const i = argv.indexOf(n); return i > -1 ? argv[i + 1] : d; };
const histFile = path.join(os.homedir(), '.scene-direction', 'history.json');
const history = (() => { try { return JSON.parse(fs.readFileSync(histFile, 'utf8')); } catch { return []; } })();
const remember = (id) => { fs.mkdirSync(path.dirname(histFile), { recursive: true }); fs.writeFileSync(histFile, JSON.stringify([...history, { id, at: new Date().toISOString() }].slice(-30), null, 1)); };
const shuffle = (a) => a.map((v) => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(([, v]) => v);

if (argv.includes('--list')) {
  for (const d of LIB) console.log(`${d.id.padEnd(20)} ${d.name.padEnd(20)} for: ${d.for.join(', ')}`);
  process.exit(0);
}

const kind = opt('--kind'), id = opt('--direction'), brief = opt('--brief', '');
if (!id) {
  const recent = new Set(history.slice(-4).map((h) => h.id));
  const fits = shuffle(LIB.filter((d) => !kind || d.for.includes(kind)));
  const fresh = fits.filter((d) => !recent.has(d.id));
  const pool = (fresh.length >= 2 ? fresh : fits).slice(0, 2);
  const wild = shuffle(LIB.filter((d) => !pool.includes(d) && !recent.has(d.id)))[0];
  const dealt = [...pool, wild].filter(Boolean).slice(0, Number(opt('--options', 3)));
  console.log(`Three directions for: ${brief || kind || 'this site'}\n`);
  for (const d of dealt) {
    console.log(`## ${d.id}: ${d.name}${d === wild ? '  (wildcard: a direction from outside this kind, for when the subject wants surprise)' : ''}`);
    console.log(`   ${d.mood}`);
    console.log(`   World: ${d.world}`);
    console.log(`   Signature: ${d.signature}\n`);
  }
  console.log('Choose the one that can carry something only this subject has (not the most familiar), then:');
  console.log(`  node ${path.relative(process.cwd(), path.join(here, 'draw.mjs'))} --direction <id> --brief "${brief}" --scenes <number of scenes>`);
  process.exit(0);
}

const d = LIB.find((x) => x.id === id);
if (!d) { console.error(`Unknown direction "${id}". Run with --list.`); process.exit(2); }
const n = Math.max(2, Math.min(10, Number(opt('--scenes', 6))));
// shots: open with the direction's first shot, then walk its pool from a random point, never repeating a shot twice in a row
function sequence(pool, count, first = true) {
  const out = first ? [pool[0]] : [];
  const rest = pool.slice(first ? 1 : 0);
  let k = Math.floor(Math.random() * rest.length);
  while (out.length < count) { const v = rest[k++ % rest.length]; if (v !== out[out.length - 1] || v === 'path') out.push(v); else k++; }  // a journey may continue
  return out;
}
const shots = sequence(d.shots, n);
const copy = sequence(shuffle(d.copy), n, false);
const grounds = Array.from({ length: n }, (_, i) => d.grounds[Math.round((i * (d.grounds.length - 1)) / Math.max(1, n - 1))]);
const fam = (f, w) => `family=${f.replace(/ /g, '+')}${w ? `:wght@${w}` : ''}`;
const fonts = [...new Set([d.type.display, d.type.text, d.type.label].filter(Boolean))];
const W = { 'Instrument Sans': '400;500;600;700', Inter: '400;500;700', 'Inter Tight': '400;500;700', 'DM Sans': '400;500;700', Rubik: '400;500;700', Geist: '400;500;700', 'Hanken Grotesk': '400;500;700', 'IBM Plex Sans Condensed': '400;500;700', 'Familjen Grotesk': '400;500;700', 'Bricolage Grotesque': '400;600;800', 'JetBrains Mono': '400;500', 'Geist Mono': '400;500', 'IBM Plex Mono': '400;500', Fraunces: '400;600', Newsreader: '400;600' };
const fontsUrl = `https://fonts.googleapis.com/css2?${fonts.map((f) => fam(f, W[f])).join('&')}&display=swap`;

const sheet = `# Direction sheet: ${d.name} (${d.id})

Brief: ${brief || '(none given)'}

**Mood.** ${d.mood}
**World.** ${d.world}
**Signature.** ${d.signature}

## Colour world
Ink ${d.ink}, accent ${d.accent}. Grounds, one per scene:
${grounds.map((g, i) => `- scene ${i + 1}: ${g}`).join('\n')}

## Light
- Rig: ${d.light.rig}
- Key ${d.light.key}${d.light.rim ? `, rim ${d.light.rim}` : ''}, hemisphere sky ${d.light.hemiSky} / ground ${d.light.hemiGround}
- Fog in the ground colour: ${d.light.fog ? 'yes' : 'no'}.

## Finish (set FINISH in the starter; references/finish.md)
\`\`\`js
const FINISH = { env: 'assets/${d.finish.hdri[0]}_1k.hdr', envIntensity: ${d.finish.envIntensity}, envRotation: 0, ao: ${d.finish.ao}, bloom: ${d.finish.bloom}, bloomThreshold: ${d.finish.bloomThreshold}, vignette: ${d.finish.vignette}, fog: ${d.finish.fog}, toneMapping: '${d.finish.toneMapping}' };
\`\`\`
- HDRI for light and reflections (never the visible background): \`node ${ASSETS} get ${d.finish.hdri[0]} --out assets\` (alternative: ${d.finish.hdri[1]}). Turn it with envRotation until its brightest window sits on the key light's side.

## Assets (references/assets.md)
- Fidelity: **${d.assets.fidelity}**. ${d.assets.fidelity === 'stylised' ? 'Build everything in code in one stylised language; no photo-scanned props.' : d.assets.fidelity === 'photoreal' ? 'Real materials: photo-scanned props and PBR surfaces around the subject, and the subject built to the same standard.' : 'Either: photoreal props and surfaces, or all stylised in code. Never mix the two.'}
${d.assets.props.length ? `- Props to look for (the world around the subject, at real scale): \`node ${ASSETS} search ${d.assets.props.join(' ')} --type models --sheet .scene-direction/props.png\`` : '- No library props: the subject and its world are built in code.'}
${d.assets.surfaces.length ? `- Surfaces: \`node ${ASSETS} search ${d.assets.surfaces.join(' ')} --type textures --sheet .scene-direction/surfaces.png\`` : ''}
- Look at the contact sheet before you pick, then \`node ${ASSETS} get <id> [<id> ...] --out assets\`. Keep the page under about 5 MB.

## Type
- Display: ${d.type.display}. Text: ${d.type.text}${d.type.label ? `. Labels: ${d.type.label}` : ''}
- Scale: ${d.type.scale}
- Load: <link rel="stylesheet" href="${fontsUrl}">

## Scenes
| scene | shot | copy | ground |
|---|---|---|---|
${shots.map((s, i) => `| ${i + 1} | ${s} | ${copy[i]} | ${grounds[i]} |`).join('\n')}

Shots are defined in references/scenes-and-motion.md and implemented in assets/starter.html (SHOTS). Copy placement: left / right / bottom / over (over the scene, with a scrim).

## Motion and texture
- ${d.motion}
- ${d.texture}

## Avoid
${d.avoid.map((a) => `- ${a}`).join('\n')}

## Seen in
${d.seenIn.map((a) => `- ${a}`).join('\n')}

Adopt this sheet; don't blend it with the layout you would have made anyway. Now write the idea sentence with this direction's world, and give each scene a beat from the inventory.
`;
fs.mkdirSync('.scene-direction', { recursive: true });
fs.writeFileSync(path.join('.scene-direction', 'sheet.md'), sheet);
remember(d.id);
console.log(sheet);
console.log(`(written to ${path.join('.scene-direction', 'sheet.md')})`);
