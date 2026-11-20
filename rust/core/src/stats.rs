//! Work-set counts per muscle group. Original: the maths half of
//! `ui/WorkSetsStatsUI.js` (the HTML half lives in the web crate).

use crate::constants::muscle_primary;
use crate::models::{Session, SetKind};

/// Result for one day.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct MuscleStats {
    pub total_work_sets: u32,
    /// `(group, sets)` in the order each group first appeared (like a JS
    /// object). Shrug reps add extra sets to `TRAPS`.
    pub groups: Vec<(String, u32)>,
}

fn bump(groups: &mut Vec<(String, u32)>, name: &str, by: u32) {
    match groups.iter_mut().find(|(g, _)| g == name) {
        Some((_, n)) => *n += by,
        None => groups.push((name.to_string(), by)),
    }
}

pub fn muscle_group_stats(session: &Session) -> MuscleStats {
    let mut stats = MuscleStats::default();
    for exercise in &session.exercises {
        let primary = muscle_primary(&exercise.name.to_uppercase())
            .map(str::to_string)
            // JS: `ex.category || 'OTHER'` (an empty category also means OTHER).
            .or_else(|| exercise.category.clone().filter(|c| !c.is_empty()))
            .unwrap_or_else(|| "OTHER".to_string());

        let work_sets: Vec<_> = exercise
            .sets
            .iter()
            .filter(|s| s.kind == SetKind::Work)
            .collect();
        let count = work_sets.len() as u32;
        stats.total_work_sets += count;
        if count > 0 {
            bump(&mut stats.groups, &primary, count);
            let shrug_sets = work_sets
                .iter()
                .filter(|s| s.shrug_reps.unwrap_or(0) > 0)
                .count() as u32;
            if shrug_sets > 0 {
                bump(&mut stats.groups, "TRAPS", shrug_sets);
            }
        }
    }
    stats
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn counts_the_default_routine() {
        let stats = muscle_group_stats(&crate::constants::default_routine());
        // 2+2 core, 2+2 low row ... see the differential test against the JS.
        assert_eq!(stats.total_work_sets, 18);
        assert_eq!(stats.groups.iter().find(|(g, _)| g == "CORE").unwrap().1, 4);
        // three shrug exercises x 2 work sets each
        assert_eq!(
            stats.groups.iter().find(|(g, _)| g == "TRAPS").unwrap().1,
            6
        );
    }

    #[test]
    fn empty_day_has_no_groups() {
        assert_eq!(
            muscle_group_stats(&Session::default()),
            MuscleStats::default()
        );
    }
}
