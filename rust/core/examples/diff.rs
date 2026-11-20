//! Helper for the JS-vs-Rust comparison: reads `cases.json`, runs the Rust
//! functions on every case and prints the results as JSON.
//! Used by `tools/compare_with_js.mjs` (see docs/RUST_LEARNING.md).

use logbook_core::math::{
    PreviousSet, calculate_e1rm, calculate_smart_target_load, find_previous_set_data,
};
use logbook_core::models::{Logs, SetEntry};
use logbook_core::options::{
    OptionItem, discomfort_select_options, kg_options, reps_options, shrug_options,
};
use logbook_core::stats::muscle_group_stats;
use serde_json::{Value, json};

fn opts(o: Vec<OptionItem>) -> Value {
    Value::Array(
        o.into_iter()
            .map(|i| json!([i.value, i.label, i.selected]))
            .collect(),
    )
}

fn main() {
    let text = std::fs::read_to_string(std::env::args().nth(1).expect("cases.json path")).unwrap();
    let cases: Value = serde_json::from_str(&text).unwrap();
    let mut out = serde_json::Map::new();

    out.insert(
        "e1rm".into(),
        cases["e1rm"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| {
                json!(calculate_e1rm(
                    c[0].as_f64().unwrap(),
                    c[1].as_f64().unwrap()
                ))
            })
            .collect(),
    );

    out.insert(
        "smart".into(),
        cases["smart"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| {
                let category = c[0].as_str();
                let prev = if c[1].is_null() {
                    None
                } else {
                    let set: SetEntry = serde_json::from_value(c[1].clone()).unwrap();
                    Some(PreviousSet {
                        date_key: String::new(),
                        set,
                    })
                };
                json!(calculate_smart_target_load(category, prev.as_ref()))
            })
            .collect(),
    );

    out.insert(
        "prev".into(),
        cases["prev"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| {
                let logs: Logs = serde_json::from_value(c["logs"].clone()).unwrap();
                let found = find_previous_set_data(
                    c["name"].as_str().unwrap(),
                    c["idx"].as_u64().unwrap() as usize,
                    c["date"].as_str().unwrap(),
                    &logs,
                );
                match found {
                    None => Value::Null,
                    Some(p) => json!([p.date_key, serde_json::to_value(&p.set).unwrap()]),
                }
            })
            .collect(),
    );

    out.insert(
        "kg".into(),
        cases["kg"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| {
                opts(kg_options(
                    c[0].as_str(),
                    c[1].as_f64().unwrap(),
                    c[2].as_bool().unwrap(),
                ))
            })
            .collect(),
    );
    out.insert(
        "reps".into(),
        cases["reps"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| {
                opts(reps_options(
                    c[0].as_u64().unwrap() as u32,
                    c[1].as_bool().unwrap(),
                ))
            })
            .collect(),
    );
    out.insert(
        "shrug".into(),
        cases["shrug"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| {
                opts(shrug_options(
                    c[0].as_u64().unwrap() as u32,
                    c[1].as_bool().unwrap(),
                ))
            })
            .collect(),
    );
    out.insert(
        "discomfort".into(),
        cases["discomfort"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| {
                opts(discomfort_select_options(
                    c[0].as_str().unwrap(),
                    c[1].as_str().unwrap(),
                ))
            })
            .collect(),
    );

    out.insert(
        "stats".into(),
        cases["stats"]
            .as_array()
            .unwrap()
            .iter()
            .map(|c| {
                let session = serde_json::from_value(c.clone()).unwrap();
                let s = muscle_group_stats(&session);
                json!([s.total_work_sets, s.groups])
            })
            .collect(),
    );

    println!("{}", Value::Object(out));
}
