//! The choices shown in each dropdown. Original: `ui/DropdownHelpers.js`.
//!
//! The JavaScript built HTML strings (`"<option value=...>"`). Here each
//! function returns plain data (`Vec<OptionItem>`) and the UI turns it into
//! elements, which avoids hand-built HTML and its escaping problems.
//!
//! Each dropdown shows a small window of values around the current one, plus a
//! "[+ MORE]" entry that expands the full list (and "[COLLAPSE]" to go back).

use crate::constants::{DEFAULT_DISCOMFORT_OPTIONS, discomfort_options};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct OptionItem {
    pub value: String,
    pub label: String,
    pub selected: bool,
}

/// Special `value`s that mean "expand" / "collapse" rather than a real choice.
pub const MORE: &str = "__MORE__";
pub const LESS: &str = "__LESS__";

fn item(value: impl ToString, label: impl ToString, selected: bool) -> OptionItem {
    OptionItem {
        value: value.to_string(),
        label: label.to_string(),
        selected,
    }
}

/// Insert `selected` into a sorted window if it is positive and missing.
fn with_selected<T: PartialOrd + Copy>(mut focused: Vec<T>, selected: T, zero: T) -> Vec<T> {
    if !focused.contains(&selected) && selected > zero {
        focused.push(selected);
        focused.sort_by(|a, b| a.partial_cmp(b).unwrap());
    }
    focused
}

/// Kilograms dropdown. `category` picks the weight step (cable 5, dumbbell 2,
/// assisted 5, anything else 2.5).
pub fn kg_options(category: Option<&str>, selected: f64, expanded: bool) -> Vec<OptionItem> {
    let (step, start, end): (f64, f64, f64) = match category {
        Some("CABLE") => (5.0, 5.0, 120.0),
        Some("DUMBBELL") => (2.0, 2.0, 60.0),
        Some("ASSISTED") => (5.0, 0.0, 50.0),
        _ => (2.5, 2.5, 150.0),
    };
    let make = |w: f64| item(w, format!("{w} KG"), w == selected);

    if expanded {
        let mut out = Vec::new();
        let mut w = start;
        while w <= end {
            out.push(make(w));
            w += step;
        }
        out.push(item(LESS, "[COLLAPSE]", false));
        return out;
    }

    // JS `selectedVal || 30`: zero counts as "not set".
    let center = if selected == 0.0 { 30.0 } else { selected };
    let min_val = if category == Some("ASSISTED") {
        0.0
    } else {
        step
    };
    let focused: Vec<f64> = [
        center - step * 2.0,
        center - step,
        center,
        center + step,
        center + step * 2.0,
    ]
    .into_iter()
    .filter(|w| *w >= min_val)
    .collect();
    let focused = with_selected(focused, selected, 0.0);

    let mut out: Vec<OptionItem> = focused.into_iter().map(make).collect();
    out.push(item(MORE, "[+ MORE]", false));
    out
}

/// Repetitions dropdown.
pub fn reps_options(selected: u32, expanded: bool) -> Vec<OptionItem> {
    let make = |r: u32| item(r, format!("{r} REPS"), r == selected);
    if expanded {
        let mut out: Vec<OptionItem> = (1..=20).map(make).collect();
        out.push(item(LESS, "[COLLAPSE]", false));
        return out;
    }
    let center = if selected == 0 { 5 } else { selected };
    let focused: Vec<u32> = if center <= 5 {
        vec![3, 4, 5, 6, 7]
    } else {
        // `center - 2` could go below 1 only if center < 3, handled above.
        vec![center - 2, center - 1, center, center + 1, center + 2]
    };
    let focused = with_selected(focused, selected, 0);
    let mut out: Vec<OptionItem> = focused.into_iter().map(make).collect();
    out.push(item(MORE, "[+ MORE]", false));
    out
}

/// "Extra shrug reps at the end of a set" dropdown.
pub fn shrug_options(selected: u32, expanded: bool) -> Vec<OptionItem> {
    let make = |r: u32| item(r, format!("+{r} SHRUGS"), r == selected);
    if expanded {
        let mut out: Vec<OptionItem> = (0..=10).map(make).collect();
        out.push(item(LESS, "[COLLAPSE]", false));
        return out;
    }
    let focused = with_selected(vec![0, 1, 2, 3], selected, 0);
    let mut out: Vec<OptionItem> = focused.into_iter().map(make).collect();
    out.push(item(MORE, "[+ MORE]", false));
    out
}

/// "Where does it hurt?" dropdown for an exercise.
pub fn discomfort_select_options(exercise_name: &str, selected: &str) -> Vec<OptionItem> {
    let list: &[&str] =
        discomfort_options(&exercise_name.to_uppercase()).unwrap_or(&DEFAULT_DISCOMFORT_OPTIONS);
    list.iter()
        .map(|d| {
            let label = if *d == "NO DISCOMFORT" {
                "[0 DISCOMFORT]".to_string()
            } else {
                format!("[!] {d}")
            };
            item(d, label, *d == selected)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn values(opts: &[OptionItem]) -> Vec<&str> {
        opts.iter().map(|o| o.value.as_str()).collect()
    }

    #[test]
    fn kg_window_for_cable() {
        let o = kg_options(Some("CABLE"), 40.0, false);
        assert_eq!(values(&o), ["30", "35", "40", "45", "50", "__MORE__"]);
        assert!(o[2].selected && !o[1].selected);
        assert_eq!(o[2].label, "40 KG");
    }

    #[test]
    fn kg_window_drops_values_below_the_minimum_step() {
        assert_eq!(
            values(&kg_options(Some("CABLE"), 5.0, false)),
            ["5", "10", "15", "__MORE__"]
        );
    }

    #[test]
    fn kg_window_is_centred_on_the_selected_value() {
        assert_eq!(
            values(&kg_options(Some("CABLE"), 42.0, false)),
            ["32", "37", "42", "47", "52", "__MORE__"]
        );
    }

    #[test]
    fn kg_re_adds_a_selected_value_the_minimum_filter_removed() {
        // 2.5 kg on a cable: the window around it is cut at the 5 kg minimum,
        // so the selected value is put back in (sorted) rather than vanishing.
        assert_eq!(
            values(&kg_options(Some("CABLE"), 2.5, false)),
            ["2.5", "7.5", "12.5", "__MORE__"]
        );
    }

    #[test]
    fn kg_expanded_lists_everything_and_a_collapse_entry() {
        let o = kg_options(Some("DUMBBELL"), 20.0, true);
        assert_eq!(o.len(), 30 + 1);
        assert_eq!(o.last().unwrap().value, LESS);
        assert_eq!(kg_options(None, 20.0, true).len(), 60 + 1);
    }

    #[test]
    fn reps_windows() {
        assert_eq!(
            values(&reps_options(5, false)),
            ["3", "4", "5", "6", "7", "__MORE__"]
        );
        assert_eq!(
            values(&reps_options(10, false)),
            ["8", "9", "10", "11", "12", "__MORE__"]
        );
        assert_eq!(
            values(&reps_options(0, false)),
            ["3", "4", "5", "6", "7", "__MORE__"]
        );
        assert_eq!(reps_options(1, true).len(), 21);
    }

    #[test]
    fn shrug_labels() {
        let o = shrug_options(0, false);
        assert_eq!(o[0].label, "+0 SHRUGS");
        assert_eq!(o[1].label, "+1 SHRUGS");
        assert_eq!(
            values(&shrug_options(5, false)),
            ["0", "1", "2", "3", "5", "__MORE__"]
        );
    }

    #[test]
    fn discomfort_uses_exercise_specific_or_default_lists() {
        let o = discomfort_select_options("dead-bug", "FEMORAL HEAD");
        assert_eq!(o[0].label, "[0 DISCOMFORT]");
        assert_eq!(o[1].label, "[!] FEMORAL HEAD");
        assert!(o[1].selected);
        assert_eq!(
            discomfort_select_options("SOMETHING NEW", "NO DISCOMFORT").len(),
            4
        );
    }
}
