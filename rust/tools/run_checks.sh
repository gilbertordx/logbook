#!/usr/bin/env bash
# Run every check that compares the Rust port against the original JavaScript.
# Run from anywhere:  rust/tools/run_checks.sh
# Needs: cargo, trunk, node, python3, and Playwright for Node (npm i -g playwright).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="$(mktemp -d)"
trap 'kill $(jobs -p) 2>/dev/null || true; rm -rf "$WORK"' EXIT

echo "== 1/4 unit tests"
(cd "$ROOT/rust" && cargo test --workspace --quiet)

echo "== 2/4 pure logic: Rust vs the original JS on randomised inputs"
# The original js/ files are ES modules; Node needs a package.json saying so.
mkdir -p "$WORK/jsorig" && cp -r "$ROOT/js" "$WORK/jsorig/js" && echo '{"type":"module"}' > "$WORK/jsorig/package.json"
(cd "$ROOT/rust/core" && cargo build --quiet --example diff)
TZ=UTC node "$ROOT/rust/tools/compare_with_js.mjs" "$WORK/jsorig" "$ROOT/rust/target/debug/examples/diff"

echo "== 3/4 build the web app"
(cd "$ROOT/rust/web" && trunk build --release 2>&1 | grep -E "error|success")

echo "== 4/4 whole app in a browser: original JS vs Rust, side by side"
(cd "$ROOT" && python3 -m http.server 8080 --bind 127.0.0.1 >/dev/null 2>&1) &
(cd "$ROOT/rust/web/dist" && python3 -m http.server 8081 --bind 127.0.0.1 >/dev/null 2>&1) &
sleep 1
NODE_PATH="$(npm root -g)" node "$ROOT/rust/tools/browser_compare.cjs" http://127.0.0.1:8080/index.html http://127.0.0.1:8081/
echo "ALL CHECKS PASSED"
