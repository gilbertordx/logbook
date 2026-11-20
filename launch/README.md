# Desktop shortcut and test menu

One shortcut opens a menu to run the Rust remaster **with live reload** (edit a file in
`rust/web/src` and the page rebuilds), run the tests, build the release version, and open the
folder or the guide.

**Windows** (needs [Rust](https://rustup.rs), installed once; the menu offers to install `trunk` for you):
1. Double-click `launch\windows\create-desktop-shortcut.bat` (once).
2. Use the new **Logbook (Rust)** shortcut on your desktop.

**macOS / Linux:** run `launch/unix/create-desktop-shortcut.sh` once, then use the launcher it creates.

The app stores its data in the browser (localStorage) under `127.0.0.1:8080`, which is separate from
the old app. To test with your real data, use `[EXP]` in the old app and `[IMP]` here.
