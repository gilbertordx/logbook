//! Pure logic for the Logbook workout app: no browser code in here, so every
//! function can be tested with plain `cargo test` (and compared against the
//! original JavaScript, see `docs/RUST_LEARNING.md`).
//!
//! | Original JavaScript                        | Rust module  |
//! |--------------------------------------------|--------------|
//! | `config/constants.js`                      | `constants`  |
//! | (implicit JSON shapes in all files)        | `models`     |
//! | `utils/dateUtils.js`                       | `dates`      |
//! | `utils/mathUtils.js`                       | `math`       |
//! | `ui/DropdownHelpers.js`                    | `options`    |
//! | `ui/WorkSetsStatsUI.js` (the maths part)   | `stats`      |
//! | `services/StorageService.js` (seed + JSON) | `storage`    |

pub mod constants;
pub mod dates;
pub mod math;
pub mod models;
pub mod options;
pub mod stats;
pub mod storage;
