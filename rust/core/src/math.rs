//! Training maths. Original: `utils/mathUtils.js`.

use crate::dates::parse_dmy_day_number;
use crate::models::{Logs, SetEntry};

/// `WORKSET 3`.
pub fn format_work_set_label(work_set_index: usize) -> String {
    format!("WORKSET {work_set_index}")
}

/// Epley estimate of a one-rep max: `weight x (1 + reps/30)`, rounded.
/// Zero if either input is zero (JS `!weight || !reps`).
pub fn calculate_e1rm(weight: f64, reps: f64) -> i64 {
    if weight == 0.0 || reps == 0.0 {
        return 0;
    }
    // `f64::round` rounds halves away from zero and JS `Math.round` rounds them
    // up; for the positive numbers used here those are the same thing.
    (weight * (1.0 + reps / 30.0)).round() as i64
}

/// A set from an earlier session, plus the day it was done.
#[derive(Debug, Clone, PartialEq)]
pub struct PreviousSet {
    pub date_key: String,
    pub set: SetEntry,
}

/// The "TARGET: ..." hint shown on an exercise, from last session's set.
pub fn calculate_smart_target_load(
    category: Option<&str>,
    prev: Option<&PreviousSet>,
) -> Option<String> {
    let prev = &prev?.set;
    let inc: f64 = match category {
        Some("CABLE") => 5.0,
        Some("DUMBBELL") => 2.0,
        Some("ASSISTED") => -5.0,
        _ => 2.5,
    };
    Some(if prev.reps >= 7 {
        let target = f64::max(0.0, prev.weight + inc);
        if category == Some("ASSISTED") {
            format!("TARGET: {target}KG ASSIST (-5KG COUNTERWEIGHT)")
        } else {
            format!("TARGET: {target}KG (+{inc}KG INC)")
        }
    } else if prev.reps < 3 {
        format!("TARGET: MAINTAIN {}KG OR DROP LOAD", prev.weight)
    } else {
        format!("TARGET: {}KG (+1 REP)", prev.weight)
    })
}

/// Most recent session *before* `current_date_key` that contains this exercise
/// (name compared ignoring case) with a set at `set_idx`.
pub fn find_previous_set_data(
    ex_name: &str,
    set_idx: usize,
    current_date_key: &str,
    logs: &Logs,
) -> Option<PreviousSet> {
    let current = parse_dmy_day_number(current_date_key)?;
    // Collect (day number, key) for earlier days, newest first. A stable sort
    // keeps the original insertion order for two keys on the same day.
    let mut earlier: Vec<(i32, &String)> = logs
        .keys()
        .filter_map(|k| parse_dmy_day_number(k).map(|n| (n, k)))
        .filter(|(n, _)| *n < current)
        .collect();
    earlier.sort_by(|a, b| b.0.cmp(&a.0));

    let wanted = ex_name.to_uppercase();
    for (_, key) in earlier {
        let session = &logs[key];
        if let Some(exercise) = session
            .exercises
            .iter()
            .find(|e| e.name.to_uppercase() == wanted)
        {
            if let Some(set) = exercise.sets.get(set_idx) {
                return Some(PreviousSet {
                    date_key: key.clone(),
                    set: set.clone(),
                });
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::SetKind;

    fn set(weight: f64, reps: u32) -> SetEntry {
        SetEntry {
            kind: SetKind::Work,
            weight,
            reps,
            rir: Some(1),
            shrug_reps: None,
        }
    }
    fn prev(weight: f64, reps: u32) -> PreviousSet {
        PreviousSet {
            date_key: "01/01/26".into(),
            set: set(weight, reps),
        }
    }

    #[test]
    fn e1rm_examples() {
        assert_eq!(calculate_e1rm(80.0, 5.0), 93);
        assert_eq!(calculate_e1rm(0.0, 5.0), 0);
        assert_eq!(calculate_e1rm(100.0, 0.0), 0);
        assert_eq!(calculate_e1rm(2.5, 3.0), 3);
    }

    #[test]
    fn target_text_by_category_and_reps() {
        assert_eq!(
            calculate_smart_target_load(Some("CABLE"), Some(&prev(40.0, 7))).unwrap(),
            "TARGET: 45KG (+5KG INC)"
        );
        assert_eq!(
            calculate_smart_target_load(Some("ASSISTED"), Some(&prev(15.0, 8))).unwrap(),
            "TARGET: 10KG ASSIST (-5KG COUNTERWEIGHT)"
        );
        assert_eq!(
            calculate_smart_target_load(None, Some(&prev(30.0, 5))).unwrap(),
            "TARGET: 30KG (+1 REP)"
        );
        assert_eq!(
            calculate_smart_target_load(Some("DUMBBELL"), Some(&prev(30.0, 2))).unwrap(),
            "TARGET: MAINTAIN 30KG OR DROP LOAD"
        );
        assert_eq!(calculate_smart_target_load(Some("CABLE"), None), None);
    }

    #[test]
    fn finds_latest_earlier_session() {
        let logs = crate::constants::seed_history();
        let found = find_previous_set_data("cable curl", 0, "24/07/26", &logs).unwrap();
        assert_eq!(found.date_key, "17/07/26");
        assert_eq!(found.set.weight, 30.0);
        assert!(find_previous_set_data("CABLE CURL", 0, "12/07/26", &logs).is_none());
        assert!(find_previous_set_data("NOT AN EXERCISE", 0, "24/07/26", &logs).is_none());
    }
}
