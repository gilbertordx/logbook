//! Static data. Original: `config/constants.js`.

use crate::models::{Logs, Session};

pub const GITHUB_REPO_OWNER: &str = "gilbertordx";
pub const GITHUB_REPO_NAME: &str = "logbook";
pub const GITHUB_FILE_PATH: &str = "data/logs.json";

pub const DEFAULT_DISCOMFORT_OPTIONS: [&str; 4] = [
    "NO DISCOMFORT",
    "FEMORAL HEAD",
    "JOINT ACHINESS",
    "MUSCLE STRAIN",
];

/// Which body parts can hurt on a given exercise. `None` -> use the defaults.
pub fn discomfort_options(exercise_name: &str) -> Option<&'static [&'static str]> {
    Some(match exercise_name {
        "CABLE LOW ROW (SHRUG AT END)" => &[
            "NO DISCOMFORT",
            "ROTATOR CUFF",
            "LEFT ULNAR NERVE",
            "LOWER BACK",
            "FOREARM/ELBOW",
        ],
        "ASSISTED CHIN" => &[
            "NO DISCOMFORT",
            "ANTERIOR SHOULDER",
            "ELBOW TENDINITIS",
            "WRIST STRAIN",
        ],
        "LOW-INCLINE DB PRESS" => &[
            "NO DISCOMFORT",
            "ANTERIOR DELT",
            "ROTATOR CUFF",
            "ELBOW TENDINITIS",
        ],
        "INCLINE DB REAR DELT (SHRUG AT END)" => {
            &["NO DISCOMFORT", "REAR DELT TENDON", "NECK STRAIN"]
        }
        "CABLE UPRIGHT ROW (SHRUG AT END)" => &[
            "NO DISCOMFORT",
            "AC JOINT / IMPINGEMENT",
            "WRIST STRAIN",
            "ROTATOR CUFF",
        ],
        "CABLE OH EXT" => &[
            "NO DISCOMFORT",
            "LEFT ULNAR NERVE",
            "RIGHT ULNAR NERVE",
            "TRICEPS TENDON",
            "ELBOW DISCOMFORT",
        ],
        "CABLE CURL" => &[
            "NO DISCOMFORT",
            "BICEPS TENDON",
            "FOREARM / BRACHIALIS",
            "WRIST TENDINITIS",
        ],
        "DEAD-BUG" => &["NO DISCOMFORT", "FEMORAL HEAD", "HIP FLEXOR"],
        "BIRD-DOG" => &[
            "NO DISCOMFORT",
            "FEMORAL HEAD",
            "LOWER BACK STRAIN",
            "WRIST PRESSURE",
        ],
        _ => return None,
    })
}

/// The muscle group a known exercise trains (`primary`). `None` -> unknown.
pub fn muscle_primary(exercise_name: &str) -> Option<&'static str> {
    Some(match exercise_name {
        "DEAD-BUG" | "BIRD-DOG" => "CORE",
        "CABLE LOW ROW (SHRUG AT END)" => "UPPER BACK",
        "ASSISTED CHIN" => "LATS",
        "LOW-INCLINE DB PRESS" => "CHEST",
        "INCLINE DB REAR DELT (SHRUG AT END)" => "REAR DELTS",
        "CABLE UPRIGHT ROW (SHRUG AT END)" => "LATERAL DELTS",
        "CABLE OH EXT" => "TRICEPS",
        "CABLE CURL" => "BICEPS",
        _ => return None,
    })
}

/// The routine loaded by [LOAD ROUTINE]. It lives in a JSON file that was
/// extracted from the original JavaScript so no value was retyped by hand.
pub fn default_routine() -> Session {
    serde_json::from_str(include_str!("../data/default_routine.json"))
        .expect("bundled routine is valid")
}

/// Sample history shown on a first run (12/07/26, 17/07/26, 24/07/26).
pub fn seed_history() -> Logs {
    serde_json::from_str(include_str!("../data/seed_history.json"))
        .expect("bundled history is valid")
}
