//! Logbook: entry point. Original: `main.js` (bootstrap and wiring).
//!
//! Notice how short this is. The JS version had to hand a `refresh()` callback
//! to every module so each could redraw the screen; with signals the screen
//! redraws itself whenever the data it shows changes.

mod browser;
mod github;
mod state;
mod ui;

fn main() {
    // Show Rust panics in the browser console instead of "unreachable executed".
    console_error_panic_hook::set_once();
    leptos::mount::mount_to_body(ui::App);
}
