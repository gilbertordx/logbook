# Learning Rust through Logbook

This branch (`rust-remaster`) holds a Rust rewrite of Logbook in [`rust/`](../rust). The
original JavaScript app is untouched at the repository root so the two can be read side by
side. This guide explains what maps to what, which Rust ideas appear where, what was changed
on purpose, and how the port was checked.

You do not have to write Rust to learn from this. The goal is that you can **read** any file
in `rust/` and say what it does and why Rust makes it look that way.

> **Scope:** the Garmin and Spotify features were **dropped on purpose** (they were not
> working well). Everything else is ported: calendar, daily log, timer, work-set stats,
> backup export/import, and the GitHub backup. Saved `garminData` is kept untouched in your
> data so nothing is lost if you ever bring that feature back.

---

## 1. Running it

One-time setup (Rust from <https://rustup.rs>):

```bash
rustup target add wasm32-unknown-unknown
cargo install trunk --locked
```

Run the app (rebuilds when you save a file):

```bash
cd rust/web && trunk serve
```

Then open <http://127.0.0.1:8080>. Your existing browser data and GitHub backups load
unchanged (same `localStorage` key, same JSON).

Run every check that compares it with the original JavaScript (about 20 seconds):

```bash
rust/tools/run_checks.sh
```

A release build for hosting: `cd rust/web && trunk build --release` -> `rust/web/dist/`
(about 1.3 MB of WebAssembly, 264 KB gzipped).

---

## 2. Two crates, on purpose

```
rust/
├── core/   pure logic, no browser code      -> tested with plain `cargo test`
├── web/    the screen, compiled to WebAssembly (Leptos)
└── tools/  scripts that compare the port with the original JavaScript
```

Keeping logic separate from the screen is the most useful habit this project shows. The
`core` crate never touches the browser, so it can be tested in milliseconds and compared
against the JS with thousands of random inputs.

| Original JavaScript | Rust |
|---|---|
| `config/constants.js` | `core/src/constants.rs` (+ `core/data/*.json`, extracted from the JS) |
| the JSON shapes (never written down) | `core/src/models.rs` |
| `utils/dateUtils.js` | `core/src/dates.rs` |
| `utils/mathUtils.js` | `core/src/math.rs` |
| `ui/DropdownHelpers.js` | `core/src/options.rs` |
| maths half of `ui/WorkSetsStatsUI.js` | `core/src/stats.rs` |
| `services/StorageService.js` | `core/src/storage.rs` + `web/src/browser.rs` |
| `services/GitHubSyncService.js` | `web/src/github.rs` |
| `state.js` | `web/src/state.rs` |
| `CalendarUI.js`, `LogPanelUI.js`, `WorkSetsStatsUI.js`, `index.html` | `web/src/ui.rs` |
| `main.js` | `web/src/main.rs` |

Reading order: `models.rs` -> `dates.rs` -> `math.rs` -> `options.rs` -> `stats.rs` ->
`storage.rs` -> `state.rs` -> `ui.rs`.

---

## 3. The Rust ideas, where you will meet them

### 3.1 Describing data instead of hoping (`models.rs`)
The JS passed plain objects around and every function hoped the right keys existed. Here the
shapes are written once as `struct`s. `#[derive(Serialize, Deserialize)]` generates the JSON
reading/writing; `#[serde(rename_all = "camelCase")]` keeps the keys the same as before.

### 3.2 `enum` instead of magic strings (`SetKind`)
In JS a set's type was the string `'WARMUP'` or `'WORK'`, and a typo like `'WARMPUP'` simply
never matched. `SetKind::Warmup` / `SetKind::Work` cannot be misspelled, and `match` makes
the compiler check you handled both.

### 3.3 `Option` instead of `undefined` (`models.rs`, `math.rs`)
Anything that might be missing is `Option<T>`. You cannot use it without deciding what
happens when it is `None`. `skip_serializing_if = "Option::is_none"` keeps the saved JSON
free of nulls, as before.

### 3.4 Remembering order: `IndexMap` (`models.rs`)
JS objects remember insertion order; Rust's `HashMap` does not. `IndexMap` does, so exported
files list days in the same order the app wrote them.

### 3.5 Pure functions you can test (`math.rs`, `options.rs`)
Every function in `core` takes plain values and returns plain values. `options.rs` returns
`Vec<OptionItem>` instead of an HTML string; the UI turns it into elements. No escaping
bugs are possible because there is no string-building.

### 3.6 `Result` and `?` instead of exceptions (`storage.rs`, `github.rs`)
Rust has no exceptions: a function that can fail returns `Result<T, E>` and the caller must
deal with it. `?` means "if this failed, return the error to my caller now".

### 3.7 Iterators and closures (`stats.rs`, `ui.rs`)
`.iter().filter(..).map(..).collect()` is the Rust form of JS array chains; `|x| ...` is an
arrow function. Nothing runs until `.collect()` (or similar) asks for the result.

### 3.8 Signals: state that redraws the screen (`state.rs`)
The JS kept one mutable `state` object and passed a `refresh()` callback to every module so
each could redraw. In Leptos, state lives in **signals** (`RwSignal`). Whatever part of the
screen reads a signal is redrawn when it changes. That is why `main.rs` is only 8 lines of code.
Signals are `Copy`, so `AppState` can be copied into every click handler without fighting
the borrow checker (Rust's rule about who may change what, and when).

### 3.9 `view!` instead of HTML strings (`ui.rs`)
The JS built HTML text and wired events through `window.handleKgChange(...)` globals named
inside `onclick="..."` attributes. `view!` builds real elements and each handler is an
ordinary closure, so there are no globals.

### 3.10 `async` and `spawn_local` (`github.rs`, `state.rs`)
A network call takes time. `async fn` + `.await` lets the page keep working meanwhile;
`spawn_local` hands the future to the browser's event loop.

### 3.11 WebAssembly (`web/`)
The `web` crate compiles to WebAssembly and talks to the browser through `web-sys`, which
mirrors the JavaScript APIs one-to-one (`browser.rs` is the only file that does this).
`trunk` builds and serves it.

---

## 4. Real bugs found while porting (worth reading)

These happened during this port and were caught by the browser test. They are good lessons.

1. **A dropdown that showed the wrong value.** After choosing "50 KG", the screen showed
   "60 KG". Leptos re-used the existing `<option>` elements and changed their attributes, but
   a browser remembers what the user clicked and ignores later attribute changes. The
   original never had this problem because it threw the whole list away and rebuilt it
   (`innerHTML`). The fix (`exercise_list` inside a keyed `<For>` in `ui.rs`) does the same.
   *Lesson: a framework that "updates only what changed" can disagree with a form control
   that has its own memory.*
2. **A text box that kept what you typed.** Same cause: after renaming an exercise the box
   showed `Renamed Lift` instead of the saved `RENAMED LIFT`. Setting the `value` *property*
   (`prop:value`) instead of the attribute fixed it.
3. **Three mistakes in the test harness itself**, found because the first run reported 33 of
   33 failures: joining text with a space, comparing JSON keys in different order, and
   comparing content inside a hidden element. *Lesson: when a test fails everywhere, suspect
   the test.*

---

## 5. Differences from the JavaScript version

### On purpose
- **Garmin and Spotify removed** (see top). `garminData` already saved is preserved.
- **Calendar month buttons no longer skip a month.** The JS used `date.setMonth(...)` on a
  date that still had today's day number, so on the 31st, "next month" from January landed
  in March. Rust tracks only year + month.
- **`+ EXERCISE` saves immediately.** The JS did not, so a reload lost the new exercise until
  the next action.
- **Corrupt saved data is kept.** If `localStorage` holds unreadable JSON the JS silently
  started empty and the next save overwrote it forever. Rust starts empty too but first copies
  the bad text to `tbjp_logbook_dmy_v18_corrupt_backup`.
- **A day with no `exercises` list no longer crashes the page** (the JS could create one by
  saving Garmin numbers on an empty day).
- Importing the same backup file twice in a row works (the file input is reset).
- Table column widths use CSS (`style="width:..%"`) instead of the old `width` attribute.

### Kept even though they look like bugs
- **The timer counts on whichever day is selected**, including old days, and the new total is
  only written the next time anything is saved. Viewing a historical session with the page
  open slowly increases its duration. Kept so behaviour matches; a one-line fix would be to
  only tick when the selected day is today.
- A renamed exercise is saved with the next action, not when you leave the box.
- The `[UNDO CLEAR]` button is global: it undoes the last clear on *any* day.

### Cosmetic
- Inside a saved set the keys appear as `rir` then `shrugReps` (the JS wrote them in the
  order they were added). Values are identical; whole numbers are written without `.0`.

---

## 6. How correctness was checked

`rust/tools/run_checks.sh` runs all of this:

1. **23 unit tests** in `core` (`cargo test`).
2. **16,600 randomised cases, original JS vs Rust**, for the e1RM formula, the "TARGET:" text,
   finding the previous session (including odd dates like `31/02/26`, `5/7/26`, `x/y/z`),
   all four dropdown builders, and the muscle-group stats. 0 mismatches.
3. **40 checks in a real browser (headless Chromium)**: the original JS app and the Rust app
   are driven through the same clicks and compared after every step (calendar, dropdowns,
   expand/collapse, set toggles, add/delete, arm mode, clear/undo, save), comparing both the
   page structure and the JSON saved in `localStorage`. It also checks that data saved by the
   original loads identically and re-saving changes no value, that export files and the
   import merge match, the invalid-file error text, corrupt-data handling, and the GitHub
   backup (intercepted network: identical requests, badges, and accented text decoded the
   same). 0 failures on the debug and release builds.

Not checked: the GitHub backup against the real GitHub (no token here), and appearance on a
phone (the stylesheet is the original, unchanged).

---

## 7. Exercises

1. In `core/src/math.rs`, change the "+1 REP" threshold from 7 to 8. Which test fails, and
   which JS-comparison category lights up?
2. Make the timer only tick when the selected day is today (`ui.rs`, `set_interval`).
3. Add a `[GARMIN]` card back, but keep it in its own file. What would you add to `core`
   first?
4. Remove a `.clone()` somewhere in `ui.rs` and read the compiler message.
5. Delete the `<For>` in `LogPanel` and run `run_checks.sh`. Which steps fail, and why?

References: *The Rust Programming Language* (doc.rust-lang.org/book), *Rust by Example*,
and the Leptos book (book.leptos.dev).
