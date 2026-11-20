// Differential test: run the ORIGINAL JavaScript and the Rust port on the same
// thousands of randomised inputs and require identical results.
//
//   usage: node compare_with_js.mjs <dir-containing-the-original-js/> <path-to-diff-binary>
//   (needs TZ=UTC so JS Date matches the timezone-free Rust dates)
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

const [jsRoot, diffBin] = process.argv.slice(2);
const imp = (rel) => import(pathToFileURL(path.join(jsRoot, rel)).href);
const { calculateE1RM, calculateSmartTargetLoad, findPreviousSetData } = await imp('js/utils/mathUtils.js');
const D = await imp('js/ui/DropdownHelpers.js');
const { MUSCLE_TARGET_MAP, ANATOMICAL_DISCOMFORT_MAP } = await imp('js/config/constants.js');

// stub the three DOM elements the stats renderer writes to
const els = {};
globalThis.document = { getElementById: (id) => (els[id] ??= { style: {}, textContent: '', innerHTML: '' }) };
const { renderMuscleGroupStats } = await imp('js/ui/WorkSetsStatsUI.js');

/* seeded random numbers so a failure is reproducible */
let seed = 20260720;
const rnd = () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const pick = (a) => a[Math.floor(rnd() * a.length)];
const int = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));

const NAMES = [...Object.keys(MUSCLE_TARGET_MAP), 'NEW EXERCISE', 'cable curl', 'Dead-Bug', 'Leg Press', 'SHRUG THING', 'X'];
const CATS = ['CABLE', 'DUMBBELL', 'ASSISTED', 'MOBILITY', 'MACHINE', undefined];
const WEIGHTS = () => pick([0, 2.5, 5, 10, 12.5, 20, 22.5, 30, 37.5, 42, 55, 80, 100, 120, 125, 149.5, 150, 33, 2, 60]);
const mkSet = () => {
  const s = { type: pick(['WORK', 'WORK', 'WARMUP']), weight: WEIGHTS(), reps: int(0, 22) };
  if (rnd() < 0.7) s.rir = int(0, 3);
  if (rnd() < 0.4) s.shrugReps = int(0, 6);
  return s;
};
const mkEx = () => { const e = { name: pick(NAMES), sets: Array.from({ length: int(0, 5) }, mkSet) };
  const c = pick(CATS); if (c) e.category = c; if (rnd() < 0.3) e.discomfort = 'NO DISCOMFORT'; return e; };
const DATE_KEYS = () => pick(['12/07/26', '17/07/26', '24/07/26', '01/01/27', '31/12/25', '05/07/26', '5/7/26',
  '31/02/26', '29/02/28', '15/13/26', '00/07/26', '1/2', 'x/y/z', '10/10/26', '10/10/25',
  `${String(int(1, 28)).padStart(2, '0')}/${String(int(1, 12)).padStart(2, '0')}/${int(24, 28)}`]);

const cases = { e1rm: [], smart: [], prev: [], kg: [], reps: [], shrug: [], discomfort: [], stats: [] };
for (let i = 0; i < 4000; i++) cases.e1rm.push([WEIGHTS(), int(0, 25)]);
for (let i = 0; i < 4000; i++) cases.smart.push([pick(CATS) ?? null, rnd() < 0.15 ? null : { type: 'WORK', weight: WEIGHTS(), reps: int(0, 15) }]);
for (let i = 0; i < 1500; i++) {
  const logs = {};
  for (let k = int(0, 8); k > 0; k--) logs[DATE_KEYS()] = { exercises: Array.from({ length: int(0, 4) }, mkEx) };
  cases.prev.push({ logs, name: pick(NAMES), idx: int(0, 4), date: DATE_KEYS() });
}
for (let i = 0; i < 3000; i++) cases.kg.push([pick(CATS) ?? null, WEIGHTS(), rnd() < 0.3]);
for (let i = 0; i < 1000; i++) cases.reps.push([int(0, 24), rnd() < 0.3]);
for (let i = 0; i < 1000; i++) cases.shrug.push([int(0, 12), rnd() < 0.3]);
const DNAMES = [...Object.keys(ANATOMICAL_DISCOMFORT_MAP), ...Object.keys(ANATOMICAL_DISCOMFORT_MAP).map(n => n.toLowerCase()), 'UNKNOWN LIFT'];
for (let i = 0; i < 600; i++) cases.discomfort.push([pick(DNAMES), pick(['NO DISCOMFORT', 'FEMORAL HEAD', 'ROTATOR CUFF', 'XYZ'])]);
for (let i = 0; i < 1500; i++) cases.stats.push({ exercises: Array.from({ length: int(0, 7) }, mkEx) });

/* ---- run the ORIGINAL JavaScript ---- */
// (the "[+ MORE]" / "[COLLAPSE]" options in the JS have no space before `>`)
const optRe = /<option value="([^"]*)"\s*(selected)?\s*>([^<]*)<\/option>/g;
const parseOpts = (html) => [...html.matchAll(optRe)].map(m => [m[1], m[3], m[2] === 'selected']);
const js = {
  e1rm: cases.e1rm.map(([w, r]) => calculateE1RM(w, r)),
  smart: cases.smart.map(([c, p]) => calculateSmartTargetLoad(c ?? undefined, p)),
  prev: cases.prev.map(c => { const r = findPreviousSetData(c.name, c.idx, c.date, c.logs); if (!r) return null;
    const { dateKey, ...set } = r; return [dateKey, set]; }),
  kg: cases.kg.map(([c, s, e]) => parseOpts(D.generateKgOptions(c ?? undefined, s, 0, 0, e ? { '0_0': true } : {}))),
  reps: cases.reps.map(([s, e]) => parseOpts(D.generateRepsOptions(s, 0, 0, e ? { '0_0': true } : {}))),
  shrug: cases.shrug.map(([s, e]) => parseOpts(D.generateShrugRepsOptions(s, 0, 0, e ? { '0_0': true } : {}))),
  discomfort: cases.discomfort.map(([n, s]) => parseOpts(D.generateDiscomfortOptions(n, s))),
  stats: cases.stats.map(entry => {
    renderMuscleGroupStats(entry, true);
    const total = Number(/(\d+) SETS/.exec(els['stat-total-worksets'].textContent)[1]);
    const groups = [...els['muscle-group-list'].innerHTML.matchAll(/<span>(.*?):<\/span> <strong>(\d+) SETS<\/strong>/g)].map(m => [m[1], Number(m[2])]);
    return [total, groups];
  }),
};

/* ---- run the Rust port on the same cases ---- */
const tmp = path.join(os.tmpdir(), `logbook-cases-${process.pid}.json`);
fs.writeFileSync(tmp, JSON.stringify(cases));
const rs = JSON.parse(execFileSync(diffBin, [tmp], { maxBuffer: 1 << 28 }).toString());
fs.unlinkSync(tmp);

/* ---- compare ---- */
// JS drops keys whose value is `undefined` when serialised; mirror that so a
// set without shrugReps compares equal to one where Rust omitted the field.
const norm = (v) => JSON.parse(JSON.stringify(v ?? null));
let failures = 0;
for (const kind of Object.keys(cases)) {
  let bad = 0;
  cases[kind].forEach((c, i) => {
    const a = JSON.stringify(norm(js[kind][i])), b = JSON.stringify(norm(rs[kind][i]));
    if (a !== b) { if (bad++ < 3) console.log(`MISMATCH ${kind} #${i}\n  input: ${JSON.stringify(c).slice(0, 300)}\n  js:   ${a.slice(0, 300)}\n  rust: ${b.slice(0, 300)}`); }
  });
  failures += bad;
  console.log(`${kind.padEnd(11)} ${String(cases[kind].length).padStart(5)} cases, ${bad} mismatches`);
}
process.exit(failures ? 1 : 0);
