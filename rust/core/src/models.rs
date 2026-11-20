//! The shapes of the data stored in `localStorage` and in `data/logs.json`.
//!
//! The JavaScript app never declared these; it just passed objects around and
//! hoped every key was there. Writing them down as `struct`s means the compiler
//! now checks every access. The `serde` attributes keep the JSON byte-for-byte
//! compatible with what the old app saved, so **existing browser data and
//! GitHub backups load unchanged**.

use indexmap::IndexMap;
use serde::{Deserialize, Deserializer, Serialize, Serializer};

/// Whole days keyed by `DD/MM/YY`. `IndexMap` remembers insertion order, like a
/// JavaScript object does (Rust's plain `HashMap` would shuffle it).
pub type Logs = IndexMap<String, Session>;

/// A kind of set. In JSON this is the string `"WARMUP"` or `"WORK"`.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "UPPERCASE")]
pub enum SetKind {
    Warmup,
    Work,
}

/// Write whole numbers as `35`, not `35.0`, to match what JavaScript wrote.
fn serialize_weight<S: Serializer>(value: &f64, serializer: S) -> Result<S::Ok, S::Error> {
    if value.is_finite() && value.fract() == 0.0 && value.abs() < 9.0e15 {
        serializer.serialize_i64(*value as i64)
    } else {
        serializer.serialize_f64(*value)
    }
}

/// Accept `null` as 0 (JS would have coerced it too).
fn deserialize_weight<'de, D: Deserializer<'de>>(deserializer: D) -> Result<f64, D::Error> {
    Ok(Option::<f64>::deserialize(deserializer)?.unwrap_or(0.0))
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SetEntry {
    /// `type` is a reserved word in Rust, so the field is called `kind`.
    #[serde(rename = "type")]
    pub kind: SetKind,
    #[serde(
        default,
        serialize_with = "serialize_weight",
        deserialize_with = "deserialize_weight"
    )]
    pub weight: f64,
    #[serde(default)]
    pub reps: u32,
    /// Reps In Reserve; only meaningful for work sets.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub rir: Option<i32>,
    /// Extra "shrug" reps done at the end of the set.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub shrug_reps: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Exercise {
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub category: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub discomfort: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub is_arm: Option<bool>,
    #[serde(default)]
    pub sets: Vec<SetEntry>,
}

/// Everything logged on one day.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    /// `"STRAIGHT"` or `"ZIGZAG"` (how the arm exercises are ordered).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub arm_mode: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub duration_seconds: Option<u64>,
    /// Garmin numbers saved by the old app. The Rust version has no Garmin
    /// feature (dropped on purpose), but the value is kept untouched so saving
    /// never erases it from your history.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub garmin_data: Option<serde_json::Value>,
    /// The JS app could create a day with no `exercises` key at all (saving
    /// Garmin numbers on an empty day) and then crash while drawing it.
    /// Here a missing list is simply empty.
    #[serde(default)]
    pub exercises: Vec<Exercise>,
}

impl Exercise {
    /// Name plus category checks used all over the UI (case-sensitive on the
    /// name, exactly like the JavaScript `String.includes`).
    pub fn is_mobility(&self) -> bool {
        self.category.as_deref() == Some("MOBILITY")
            || self.name.contains("BUG")
            || self.name.contains("DOG")
    }
    pub fn is_assisted(&self) -> bool {
        self.category.as_deref() == Some("ASSISTED") || self.name.contains("ASSISTED")
    }
    pub fn has_shrugs(&self) -> bool {
        self.name.to_uppercase().contains("SHRUG")
    }
    pub fn is_arm_exercise(&self) -> bool {
        self.is_arm == Some(true) || self.name.contains("OH EXT") || self.name.contains("CURL")
    }
}
