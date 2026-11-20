// Drive the ORIGINAL JavaScript app and the Rust (Leptos/WASM) app through the
// same clicks in headless Chromium and compare, after every step:
//   1. the DOM of the calendar, log panel and stats card (structure, text,
//      dropdown choices and selected values), and
//   2. the JSON saved in localStorage.
//
//   usage: node browser_compare.cjs <original-url> <rust-url>
const { chromium } = require('playwright');

const [ORIG, RUST] = process.argv.slice(2);

// Serialise a DOM subtree into plain JSON so the two apps can be compared.
const SNAPSHOT = () => {
  const SKIP_ATTR = new Set(['style', 'width', 'id', 'onclick', 'onchange', 'title']);
  const ser = (node) => {
    if (node.nodeType === 3) return node.textContent;   // raw; merged + normalised below
    if (node.nodeType !== 1) return null;
    const out = { t: node.tagName.toLowerCase() };
    if (node.className) out.c = String(node.className).split(/\s+/).filter(Boolean).sort().join(' ');
    if (node.tagName === 'SELECT') out.sel = { value: node.value, options: [...node.options].map(o => [o.value, o.textContent]) };
    if (node.tagName === 'INPUT') out.value = node.value;
    const kids = [...node.childNodes].map(ser).filter(k => k !== null);
    // The two apps split text into different numbers of text nodes, so join
    // neighbouring pieces with NO separator, then collapse whitespace.
    const merged = [];
    for (const k of kids) { if (typeof k === 'string' && typeof merged[merged.length - 1] === 'string') merged[merged.length - 1] += k; else merged.push(k); }
    const cleaned = merged.map(k => typeof k === 'string' ? k.replace(/\s+/g, ' ').trim() : k).filter(k => k !== '');
    if (cleaned.length) out.k = cleaned;
    return out;
  };
  const q = (s) => document.querySelector(s);
  return {
    calTitle: q('#cal-title').textContent.trim(),
    calendar: ser(q('#calendar-grid')),
    logDate: q('#log-date').textContent.trim(),
    exercises: ser(q('#exercise-container')),
    total: q('#stat-total-worksets').textContent.trim(),
    expandBtn: q('#btn-expand-worksets').textContent.trim(),
    statsVisible: getComputedStyle(q('#muscle-group-list')).display !== 'none',
    stats: getComputedStyle(q('#muscle-group-list')).display !== 'none' ? ser(q('#muscle-group-list')) : null,
    actionsVisible: getComputedStyle(q('#log-actions')).display !== 'none',
    undoVisible: getComputedStyle(q('#btn-undo')).display !== 'none',
  };
};

// What was saved. `durationSeconds` is ignored because both apps tick a
// real-time counter, so the two values legitimately differ by timing.
const STORED = () => {
  const raw = localStorage.getItem('tbjp_logbook_dmy_v18');
  if (!raw) return null;
  const o = JSON.parse(raw);
  for (const d of Object.values(o)) delete d.durationSeconds;
  return o;
};

async function open(browser, url, storage = null) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 1800 }, timezoneId: 'UTC' });
  const page = await ctx.newPage();
  if (storage) await page.addInitScript((kv) => { if (!sessionStorage.getItem('__seeded')) { for (const [k, v] of Object.entries(kv)) localStorage.setItem(k, v); sessionStorage.setItem('__seeded', '1'); } }, storage);
  await page.route(/fonts\.(googleapis|gstatic)\.com|open\.spotify\.com/, r => r.abort());
  page.on('dialog', d => d.accept());
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('#calendar-grid .day-cell');
  return { page, errors, ctx };
}

(async () => {
  const browser = await chromium.launch();
  const a = await open(browser, ORIG);
  const b = await open(browser, RUST);
  let failures = 0, steps = 0;

  async function compare(label, { domOnly = false } = {}) {
    steps++;
    const [sa, sb, da, db] = await Promise.all([
      a.page.evaluate(SNAPSHOT), b.page.evaluate(SNAPSHOT), a.page.evaluate(STORED), b.page.evaluate(STORED)]);
    const ja = JSON.stringify(sa), jb = JSON.stringify(sb);
    const sortKeys = (v) => Array.isArray(v) ? v.map(sortKeys)
      : (v && typeof v === 'object') ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sortKeys(v[k])])) : v;
    const sta = JSON.stringify(sortKeys(da)), stb = JSON.stringify(sortKeys(db));
    let ok = true;
    if (ja !== jb) {
      ok = false;
      const ka = Object.keys(sa).filter(k => JSON.stringify(sa[k]) !== JSON.stringify(sb[k]));
      console.log(`  DOM DIFF in: ${ka.join(', ')}`);
      for (const k of ka.slice(0, 2)) {
        const x = JSON.stringify(sa[k]), y = JSON.stringify(sb[k]);
        let i = 0; while (i < x.length && x[i] === y[i]) i++;
        console.log(`   [${k}] first difference at char ${i}:\n     orig: …${x.slice(Math.max(0, i - 80), i + 120)}\n     rust: …${y.slice(Math.max(0, i - 80), i + 120)}`);
      }
    }
    if (!domOnly && sta !== stb) {
      ok = false;
      let i = 0; while (i < sta.length && sta[i] === stb[i]) i++;
      console.log(`  STORAGE DIFF at char ${i}:\n     orig: …${sta.slice(Math.max(0, i - 80), i + 120)}\n     rust: …${stb.slice(Math.max(0, i - 80), i + 120)}`);
    }
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`);
    if (!ok) failures++;
  }

  // Run the same action on both apps. `fn` receives a Playwright page.
  const both = async (fn) => { await fn(a.page); await fn(b.page); await a.page.waitForTimeout(60); };
  const click = (sel, nth = 0) => both(p => p.locator(sel).nth(nth).click());
  const selectIdx = (sel, nth, index) => both(p => p.locator(sel).nth(nth).selectOption({ index }));
  const dayCell = (text) => both(p => p.locator('#calendar-grid .day-cell:not(.other-month)').filter({ hasText: new RegExp(`^${text}(•)?$`) }).click());

  await compare('first load (today + seeded history)');

  await click('#math-header-expand');                 await compare('expand work-set stats');
  await click('#math-header-expand');                 await compare('collapse work-set stats');

  // go back to July 2026 where the seeded history lives
  for (let i = 0; i < 4; i++) await click('#cal-prev');
  await compare('calendar: 4 months back');
  await dayCell('17');                                 await compare('select 17/07/26 (seeded day)');
  await click('#math-header-expand');                 await compare('stats of a seeded day, expanded');
  await dayCell('24');                                 await compare('select 24/07/26 (shows previous-session hints and PO badges)');
  await dayCell('5');                                  await compare('select an empty day (empty message, actions hidden)');
  await click('#btn-load-routine');                    await compare('load routine on empty day');

  // edit things on the loaded routine
  await selectIdx('.kg-select', 0, 4);                 await compare('change a KG dropdown');
  await selectIdx('.reps-select', 2, 1);               await compare('change a REPS dropdown');
  await both(p => p.locator('.kg-select').nth(1).selectOption('__MORE__')); await compare('KG: [+ MORE]');
  await both(p => p.locator('.kg-select').nth(1).selectOption('__LESS__')); await compare('KG: [COLLAPSE]');
  await both(p => p.locator('.reps-select').nth(0).selectOption('__MORE__')); await compare('REPS: [+ MORE]');
  await selectIdx('.rir-select', 0, 0);                await compare('change RIR');
  await click('.btn-set-type', 3);                     await compare('toggle a set WARMUP/WORK');
  await click('.btn-set-type', 3);                     await compare('toggle it back');
  await both(p => p.locator('.shrug-tracker select').nth(0).selectOption('__MORE__')); await compare('shrug dropdown: [+ MORE]');
  await both(p => p.locator('.shrug-tracker select').nth(0).selectOption({ index: 5 })); await compare('change shrug reps');
  await both(p => p.locator('.discomfort-select').nth(2).selectOption({ index: 2 })); await compare('set discomfort feedback');
  await click('button:has-text("+ WORK SET")', 2);     await compare('+ WORK SET');
  await click('button:has-text("+ WARMUP SET")', 2);   await compare('+ WARMUP SET');
  await click('.btn-del:has-text("×")', 5);            await compare('delete one set');
  await click('.arm-section-divider button');          await compare('arm mode -> ZIGZAG');
  await click('.arm-section-divider button');          await compare('arm mode -> STRAIGHT');
  await both(p => p.locator('.ex-title-input').nth(0).fill('Renamed Lift')); await both(p => p.locator('.ex-title-input').nth(0).press('Tab'));
  await click('#btn-add-ex');                          await compare('rename exercise + add exercise (DOM only: Rust saves here, the JS app did not)', { domOnly: true });
  await click('.btn-del:has-text("[DEL]")', 1);        await compare('delete an exercise');
  await click('#btn-clear');                           await compare('clear day');
  await click('#btn-undo');                            await compare('undo clear');
  await click('#btn-save');                            await compare('save day (no GitHub token: stays local)');
  await click('#today-btn');                           await compare('[TODAY]');
  await click('#cal-next');  await click('#cal-next'); await compare('calendar: forward months');
  for (let i = 0; i < 14; i++) await click('#cal-prev');
  await compare('calendar: across a year boundary');


  // ───────── extra scenarios ─────────
  const KEY = 'tbjp_logbook_dmy_v18';

  // 1. Data saved by the ORIGINAL app must load in the Rust app unchanged.
  const savedByOriginal = await a.page.evaluate((k) => localStorage.getItem(k), KEY);
  const c1 = await open(browser, ORIG, { [KEY]: savedByOriginal });
  const c2 = await open(browser, RUST, { [KEY]: savedByOriginal });
  {
    const [x, y] = await Promise.all([c1.page.evaluate(SNAPSHOT), c2.page.evaluate(SNAPSHOT)]);
    steps++; const ok = JSON.stringify(x) === JSON.stringify(y);
    console.log(`${ok ? 'PASS' : 'FAIL'}  existing data saved by the original app loads identically`); if (!ok) failures++;
    // ...and saving from Rust must not alter any value.
    await c2.page.locator('#btn-save').click(); await c2.page.waitForTimeout(100);
    const [before, after] = [JSON.parse(savedByOriginal), JSON.parse(await c2.page.evaluate((k) => localStorage.getItem(k), KEY))];
    for (const d of [...Object.values(before), ...Object.values(after)]) delete d.durationSeconds;
    const sk = (v) => Array.isArray(v) ? v.map(sk) : (v && typeof v === 'object') ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sk(v[k])])) : v;
    steps++; const same = JSON.stringify(sk(before)) === JSON.stringify(sk(after));
    console.log(`${same ? 'PASS' : 'FAIL'}  re-saving from Rust leaves every value unchanged (no data loss)`); if (!same) failures++;
  }

  // 2. Export: same file name and same content.
  const exportOf = async (p) => { const [dl] = await Promise.all([p.waitForEvent('download'), p.locator('#btn-export').click()]);
    const fs = require('fs'); const path = await dl.path(); return { name: dl.suggestedFilename(), json: JSON.parse(fs.readFileSync(path, 'utf8')) }; };
  {
    const [ea, eb] = [await exportOf(c1.page), await exportOf(c2.page)];
    const strip = (j) => { for (const d of Object.values(j)) delete d.durationSeconds; return j; };
    const sk = (v) => Array.isArray(v) ? v.map(sk) : (v && typeof v === 'object') ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sk(v[k])])) : v;
    steps++; const ok = ea.name === eb.name && JSON.stringify(sk(strip(ea.json))) === JSON.stringify(sk(strip(eb.json)));
    console.log(`${ok ? 'PASS' : 'FAIL'}  export: file name (${ea.name} / ${eb.name}) and contents match`); if (!ok) failures++;
  }

  // 3. Import: merge a backup file, then compare screen + storage.
  {
    const fs = require('fs'), os = require('os'), path = require('path');
    const f = path.join(os.tmpdir(), 'logbook_import_test.json');
    fs.writeFileSync(f, JSON.stringify({ '01/08/26': { exercises: [{ name: 'IMPORTED LIFT', category: 'CABLE', sets: [{ type: 'WORK', weight: 42.5, reps: 6, rir: 2 }] }] } }));
    for (const p of [c1.page, c2.page]) { await p.locator('#import-file').setInputFiles(f); await p.waitForTimeout(250); }
    const [x, y, sx, sy] = await Promise.all([c1.page.evaluate(SNAPSHOT), c2.page.evaluate(SNAPSHOT), c1.page.evaluate(STORED), c2.page.evaluate(STORED)]);
    const sk = (v) => Array.isArray(v) ? v.map(sk) : (v && typeof v === 'object') ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sk(v[k])])) : v;
    steps++; const ok = JSON.stringify(x) === JSON.stringify(y) && JSON.stringify(sk(sx)) === JSON.stringify(sk(sy)) && '01/08/26' in sy;
    console.log(`${ok ? 'PASS' : 'FAIL'}  import: backup merges into the logs identically`); if (!ok) failures++;
    // invalid file -> error dialog, nothing changes
    const bad = path.join(os.tmpdir(), 'logbook_bad.json'); fs.writeFileSync(bad, '{ not json');
    const msgs = [];
    for (const p of [c1.page, c2.page]) { p.removeAllListeners('dialog'); p.on('dialog', d => { msgs.push(d.message()); d.accept(); }); await p.locator('#import-file').setInputFiles(bad); await p.waitForTimeout(250); }
    steps++; const same = msgs.length === 2 && msgs[0] === msgs[1];
    console.log(`${same ? 'PASS' : 'FAIL'}  import: invalid file shows the same error (${JSON.stringify(msgs[0])})`); if (!same) failures++;
  }

  // 4. Corrupt saved data: both start empty; the Rust app also keeps a backup copy.
  {
    const bad = await open(browser, ORIG, { [KEY]: '{ corrupt' });
    const bad2 = await open(browser, RUST, { [KEY]: '{ corrupt' });
    const [x, y] = await Promise.all([bad.page.evaluate(SNAPSHOT), bad2.page.evaluate(SNAPSHOT)]);
    const kept = await bad2.page.evaluate((k) => localStorage.getItem(k + '_corrupt_backup'), KEY);
    steps++; const ok = JSON.stringify(x) === JSON.stringify(y) && kept === '{ corrupt';
    console.log(`${ok ? 'PASS' : 'FAIL'}  corrupt saved data: both start empty; Rust kept a backup copy`); if (!ok) failures++;
  }

  // 5. GitHub backup: intercept api.github.com and compare the requests both apps send.
  {
    const fakeRemote = { '02/09/26': { exercises: [{ name: 'SUPINO RETO — ÃÇÕ', category: 'CABLE', sets: [{ type: 'WORK', weight: 60, reps: 5, rir: 1 }] }] } };
    const b64 = Buffer.from(JSON.stringify(fakeRemote, null, 2), 'utf8').toString('base64').replace(/(.{60})/g, '$1\n');
    const sk = (v) => Array.isArray(v) ? v.map(sk) : (v && typeof v === 'object') ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sk(v[k])])) : v;
    const run = async (url, label) => {
      const requests = [];
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 1800 }, timezoneId: 'UTC' });
      await ctx.addInitScript(() => { if (location.hash === '#t') {} });
      const page = await ctx.newPage();
      await page.route(/fonts\.(googleapis|gstatic)\.com|open\.spotify\.com/, r => r.abort());
      await page.route('https://api.github.com/**', async (route) => {
        const req = route.request(); const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
        if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
        const h = req.headers();
        let body = req.postData(); if (body) { const j = JSON.parse(body); j.contentDecoded = JSON.parse(Buffer.from(j.content, 'base64').toString('utf8')); delete j.content; body = sk(j); }
        requests.push({ method: req.method(), url: req.url(), auth: h['authorization'], accept: h['accept'], body });
        if (req.method() === 'GET') return route.fulfill({ status: 200, headers: cors, contentType: 'application/json', body: JSON.stringify({ sha: 'abc123', content: b64 }) });
        return route.fulfill({ status: 201, headers: cors, contentType: 'application/json', body: '{}' });
      });
      page.on('dialog', d => d.type() === 'prompt' ? d.accept('ghp_testtoken') : d.accept());
      await page.goto(url, { waitUntil: 'load' }); await page.waitForSelector('#calendar-grid .day-cell');
      await page.locator('#btn-github-sync').click(); await page.waitForTimeout(500);   // connect -> push
      const badge1 = await page.locator('#btn-github-sync').textContent();
      await page.locator('#btn-save').click(); await page.waitForTimeout(500);          // save -> push again
      const badge2 = await page.locator('#btn-github-sync').textContent();
      // reload with the token still in sessionStorage -> pulls and merges the fake remote
      await page.reload({ waitUntil: 'load' }); await page.waitForSelector('#calendar-grid .day-cell'); await page.waitForTimeout(700);
      const merged = await page.evaluate(() => JSON.parse(localStorage.getItem('tbjp_logbook_dmy_v18'))['02/09/26']);
      const badge3 = await page.locator('#btn-github-sync').textContent();
      // disconnect (blank prompt)
      page.removeAllListeners('dialog'); const msgs = []; page.on('dialog', d => { msgs.push(d.message()); d.type() === 'prompt' ? d.accept('') : d.accept(); });
      await page.locator('#btn-github-sync').click(); await page.waitForTimeout(200);
      const badge4 = await page.locator('#btn-github-sync').textContent();
      return { requests: requests.map(r => ({ ...r, body: r.body && { ...r.body, contentDecoded: Object.keys(r.body.contentDecoded) } })),
               commitMsgs: requests.filter(r => r.method === 'PUT').map(r => r.body.message), pushedDays: requests.filter(r => r.method === 'PUT').map(r => r.body.contentDecoded),
               badges: [badge1, badge2, badge3, badge4], merged: sk(merged), msgs };
    };
    const [ra, rb] = [await run(ORIG, 'orig'), await run(RUST, 'rust')];
    const ja = JSON.stringify(ra), jb = JSON.stringify(rb);
    steps++; const ok = ja === jb;
    console.log(`${ok ? 'PASS' : 'FAIL'}  GitHub sync: identical requests (${ra.requests.length}), badges ${JSON.stringify(ra.badges)}, remote text decoded identically`);
    if (!ok) { failures++; let i = 0; while (i < ja.length && ja[i] === jb[i]) i++; console.log(`   orig: …${ja.slice(Math.max(0, i - 120), i + 200)}\n   rust: …${jb.slice(Math.max(0, i - 120), i + 200)}`); }
  }

  console.log(`\n${steps} steps compared, ${failures} failed`);
  const allErr = (x) => [...x.errors];
  console.log('page errors  original:', allErr(a).length ? allErr(a) : 'none', ' rust:', allErr(b).length ? allErr(b) : 'none');
  await browser.close();
  process.exit(failures || a.errors.length || b.errors.length ? 1 : 0);
})();
