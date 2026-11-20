//! The on-disk format and first-run data. Original: the browser-independent
//! half of `services/StorageService.js` (the actual `localStorage` calls are
//! in the web crate).

use crate::constants::{default_routine, seed_history};
use crate::models::Logs;

/// The `localStorage` key. Unchanged from the JS app so existing data loads.
pub const STORAGE_KEY: &str = "tbjp_logbook_dmy_v18";

/// First-run data: three sample sessions plus today's default routine.
pub fn first_run_logs(today_key: &str) -> Logs {
    let mut logs = seed_history();
    logs.insert(today_key.to_string(), default_routine());
    logs
}

/// Parse saved JSON. `None` if it is corrupt.
pub fn parse_logs(json: &str) -> Option<Logs> {
    serde_json::from_str(json).ok()
}

/// Compact JSON, as written to `localStorage`.
pub fn serialize_logs(logs: &Logs) -> String {
    serde_json::to_string(logs).expect("logs always serialize")
}

/// Indented JSON (2 spaces), as written to backups and to GitHub
/// (JS: `JSON.stringify(logs, null, 2)`).
pub fn serialize_logs_pretty(logs: &Logs) -> String {
    serde_json::to_string_pretty(logs).expect("logs always serialize")
}

/// Merge `incoming` over `base` like JS `{ ...base, ...incoming }`: keys that
/// already exist keep their position, new keys go at the end.
pub fn merge_logs(base: &mut Logs, incoming: Logs) {
    for (key, session) in incoming {
        base.insert(key, session);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn first_run_has_seed_days_and_today() {
        let logs = first_run_logs("20/11/26");
        let keys: Vec<_> = logs.keys().map(String::as_str).collect();
        assert_eq!(keys, ["12/07/26", "17/07/26", "24/07/26", "20/11/26"]);
        assert_eq!(logs["20/11/26"].exercises.len(), 9);
    }

    #[test]
    fn json_round_trip_is_lossless() {
        let logs = first_run_logs("20/11/26");
        let back = parse_logs(&serialize_logs(&logs)).unwrap();
        assert_eq!(back, logs);
        let back = parse_logs(&serialize_logs_pretty(&logs)).unwrap();
        assert_eq!(back, logs);
    }

    #[test]
    fn whole_weights_are_written_without_a_decimal_point() {
        let json = serialize_logs(&first_run_logs("20/11/26"));
        assert!(json.contains("\"weight\":40,"));
        assert!(!json.contains("\"weight\":40.0"));
    }

    #[test]
    fn corrupt_json_is_none() {
        assert!(parse_logs("{ nope").is_none());
    }

    #[test]
    fn merge_keeps_position_of_existing_keys() {
        let mut base = first_run_logs("20/11/26");
        let mut incoming = Logs::new();
        incoming.insert("17/07/26".into(), Default::default());
        incoming.insert("01/01/27".into(), Default::default());
        merge_logs(&mut base, incoming);
        let keys: Vec<_> = base.keys().map(String::as_str).collect();
        assert_eq!(
            keys,
            ["12/07/26", "17/07/26", "24/07/26", "20/11/26", "01/01/27"]
        );
        assert!(base["17/07/26"].exercises.is_empty()); // replaced by the incoming value
    }
}
