#!/usr/bin/env bash
# Menu for Logbook (Rust/WebAssembly remaster): run it with live reload, test it, build it.
cd "$(dirname "$0")/../.." || exit 1

if ! command -v cargo >/dev/null 2>&1; then
  echo "Rust is not installed yet. Install it from https://rustup.rs and run this again."
  read -r -p "Press Enter to close..." _; exit 1
fi
open_path() { if command -v xdg-open >/dev/null 2>&1; then xdg-open "$1"; else open "$1"; fi; }

prereqs() {
  if ! command -v trunk >/dev/null 2>&1; then
    echo; echo "The web build tool (trunk) is not installed. Installing it takes about 5 minutes, once."
    read -r -p "Install it now? [y/N] " yn || return 1
    case "$yn" in [Yy]*) cargo install trunk --locked || return 1 ;; *) return 1 ;; esac
  fi
  rustup target add wasm32-unknown-unknown
}

while true; do
  clear 2>/dev/null
  cat <<'MENU'
============================================================
  Logbook - Rust (WebAssembly) remaster
============================================================
  [1] Run the app with live reload  (opens http://127.0.0.1:8080)
      edit a file in rust/web/src and the page rebuilds by itself
  [2] Run the tests
  [3] Build the release version     (rust/web/dist)
  [4] Open the project folder
  [5] Open the learning guide
  [6] Quit

  Tip: this app keeps its data in the browser at 127.0.0.1:8080, separate from
  your real logbook. Use [EXP] on the old one and [IMP] here to test with real data.
MENU
  read -r -p "Choose 1-6: " choice || exit 0   # end of input: leave instead of looping
  case "$choice" in
    1) prereqs && { echo; echo "Starting... the first build takes a few minutes. Ctrl+C to stop."; ( cd rust/web && trunk serve --open ); } ;;
    2) cargo test --workspace --manifest-path rust/Cargo.toml ;;
    3) prereqs && ( cd rust/web && trunk build --release ) && echo "Built into rust/web/dist" ;;
    4) open_path . ;;
    5) open_path docs/RUST_LEARNING.md ;;
    6) exit 0 ;;
    *) echo "Please type a number from 1 to 6." ;;
  esac
  echo; read -r -p "Press Enter to return to the menu..." _ || exit 0
done
