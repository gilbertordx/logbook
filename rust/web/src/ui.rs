//! Everything drawn on screen. Original: `CalendarUI.js`, `LogPanelUI.js`,
//! `WorkSetsStatsUI.js` and the markup in `index.html`.
//!
//! The JavaScript built HTML as strings and wired events through `window.*`
//! globals referenced from `onclick="..."` attributes. Here the `view!` macro
//! builds real DOM nodes and every handler is an ordinary closure, so there
//! are no globals and no string escaping to get wrong.
//!
//! Dropped on purpose (by request): the Garmin card and the Spotify card.

use std::collections::HashSet;
use std::time::Duration;

use leptos::leptos_dom::helpers::set_interval;
use leptos::prelude::*;
use logbook_core::constants::default_routine;
use logbook_core::dates::{format_date_key, month_grid, shift_month};
use logbook_core::math::{
    calculate_e1rm, calculate_smart_target_load, find_previous_set_data, format_work_set_label,
};
use logbook_core::models::{Exercise, Logs, SetEntry, SetKind};
use logbook_core::options::{
    LESS, MORE, OptionItem, discomfort_select_options, kg_options, reps_options, shrug_options,
};
use logbook_core::stats::muscle_group_stats;
use logbook_core::storage::{merge_logs, parse_logs, serialize_logs_pretty};

use crate::browser;
use crate::state::AppState;

/// `5.0` -> `"5"`, `2.5` -> `"2.5"` (JavaScript's number-to-text rule).
fn num(value: f64) -> String {
    value.to_string()
}

fn option_elements(items: Vec<OptionItem>) -> impl IntoView {
    items
        .into_iter()
        .map(|o| view! { <option value=o.value selected=o.selected>{o.label}</option> })
        .collect_view()
}

// ───────────────────────────── App shell ─────────────────────────────

#[component]
pub fn App() -> impl IntoView {
    let state = AppState::new();
    provide_context(state);

    // GitHub backup: pull on load if this tab already has a token.
    browser::forget_persisted_github_token();
    match browser::github_token() {
        Some(token) => {
            state.sync_status.set("OK".to_string());
            state.pull_from_github(token);
        }
        None => state.sync_status.set("LOCAL".to_string()),
    }

    // Session timer: once a second, add a second to the viewed day.
    // (Kept exactly as the original: it counts on whichever day is selected,
    // and the new total is saved the next time anything is saved.)
    set_interval(
        move || {
            let day = state.selected.get_untracked();
            let mut seconds = None;
            state.logs.update_untracked(|logs| {
                if let Some(session) = logs.get_mut(&day) {
                    let total = session.duration_seconds.unwrap_or(0) + 1;
                    session.duration_seconds = Some(total);
                    seconds = Some(total);
                }
            });
            if let Some(total) = seconds {
                state
                    .timer_text
                    .set(format!("[TIME: {:02}:{:02}]", total / 60, total % 60));
            }
        },
        Duration::from_secs(1),
    );

    view! {
        <Header/>
        <main class="grid-main">
            <CalendarPanel/>
            <LogPanel/>
        </main>
    }
}

// ───────────────────────────── Header ─────────────────────────────

#[component]
fn Header() -> impl IntoView {
    let state = expect_context::<AppState>();
    let import_input = NodeRef::<leptos::html::Input>::new();

    let on_export = move |_| {
        let slug = browser::today_key().replace('/', "-");
        let json = state.logs.with_untracked(serialize_logs_pretty);
        browser::download_text(&format!("logbook_backup_{slug}.json"), &json);
    };

    let on_import_chosen = move |_| {
        let Some(input) = import_input.get() else {
            return;
        };
        let Some(file) = input.files().and_then(|files| files.get(0)) else {
            return;
        };
        leptos::task::spawn_local(async move {
            let result = match browser::read_file_text(&file).await {
                Ok(text) => parse_logs(&text).ok_or(()),
                Err(_) => Err(()),
            };
            match result {
                Ok(imported) => {
                    state.logs.update(|logs| merge_logs(logs, imported));
                    state.persist();
                    browser::alert("[SYSTEM] DATA IMPORT SUCCESSFUL.");
                }
                Err(()) => browser::alert("[ERROR] INVALID BACKUP FILE."),
            }
        });
        if let Some(input) = import_input.get() {
            input.set_value(""); // allow choosing the same file again
        }
    };

    let on_sync_click = move |_| {
        let existing = browser::github_token().unwrap_or_default();
        let Some(answer) = browser::prompt(
            "[GITHUB BACKUP SETUP]\n\nEnter a fine-grained PAT limited to this repository with Contents read/write access. It will be retained only for this browser tab.\n\nLeave blank to disconnect.",
            &existing,
        ) else {
            return; // cancelled
        };
        let token = answer.trim().to_string();
        if token.is_empty() {
            browser::set_github_token(None);
            state.sync_status.set("LOCAL".to_string());
            browser::alert("[SYSTEM] GITHUB SYNC DISCONNECTED.");
        } else {
            browser::set_github_token(Some(&token));
            state.sync_status.set("SYNCING...".to_string());
            state.sync_to_github(Some(token));
        }
    };

    view! {
        <header class="hdr">
            <div class="hdr-left">
                <span class="tbjp-tag">"tbjp"</span>
                <span class="hdr-title">"LOGBOOK"</span>
            </div>
            <div class="hdr-right">
                <span>"FORM: IMMACULATE"</span>
                <span>"TARGET: 3-7 REPS @ 1 RIR"</span>
                <span id="session-timer-display" class="session-timer">{move || state.timer_text.get()}</span>
                <button class="btn-subtle" id="btn-github-sync" title="GitHub Auto-Sync Status" on:click=on_sync_click>
                    {move || format!("[SYNC: {}]", state.sync_status.get())}
                </button>
                <button class="btn-subtle" id="btn-export" title="Export Backup" on:click=on_export>"[EXP]"</button>
                <button class="btn-subtle" id="btn-import" title="Import Backup"
                    on:click=move |_| { if let Some(input) = import_input.get() { input.click(); } }>
                    "[IMP]"
                </button>
                <input type="file" id="import-file" style="display:none;" accept=".json"
                    node_ref=import_input on:change=on_import_chosen/>
            </div>
        </header>
    }
}

// ───────────────────────────── Calendar ─────────────────────────────

#[component]
fn CalendarPanel() -> impl IntoView {
    let state = expect_context::<AppState>();

    let title = move || {
        let (year, month) = state.view_month.get();
        format!("{:02}/{:02}", month, year.rem_euclid(100))
    };
    let step = move |delta: i32| {
        state
            .view_month
            .update(|ym| *ym = shift_month(ym.0, ym.1, delta))
    };
    let go_today = move |_| {
        let (y, m, d) = browser::today();
        state.view_month.set((y, m));
        state.selected.set(format_date_key(y, m, d));
    };

    let cells = move || {
        let (year, month) = state.view_month.get();
        let grid = month_grid(year, month);
        let today_key = browser::today_key();
        let selected = state.selected.get();
        let logs = state.logs.get();

        let mut out: Vec<AnyView> = Vec::new();
        for i in (1..=grid.padding).rev() {
            out.push(
                view! { <div class="day-cell other-month">{grid.prev_month_days - i + 1}</div> }
                    .into_any(),
            );
        }
        for day in 1..=grid.total_days {
            let key = format_date_key(year, month, day);
            let mut class = String::from("day-cell");
            if key == today_key {
                class.push_str(" today");
            }
            if key == selected {
                class.push_str(" selected");
            }
            let has_data = logs.contains_key(&key);
            let pick = key.clone();
            out.push(
                view! {
                    <div class=class on:click=move |_| state.selected.set(pick.clone())>
                        {if has_data {
                            view! { <span>{day}</span><span class="has-data">"•"</span> }.into_any()
                        } else {
                            view! { {day.to_string()} }.into_any()
                        }}
                    </div>
                }
                .into_any(),
            );
        }
        out
    };

    view! {
        <section class="panel cal-panel">
            <div class="cal-nav">
                <button id="cal-prev" class="btn" on:click=move |_| step(-1)>"<"</button>
                <span id="cal-title" class="cal-title">{title}</span>
                <button id="cal-next" class="btn" on:click=move |_| step(1)>">"</button>
                <button id="today-btn" class="btn" on:click=go_today>"[TODAY]"</button>
            </div>
            <div class="cal-head">
                <span>"M"</span><span>"T"</span><span>"W"</span><span>"T"</span><span>"F"</span><span>"S"</span><span>"S"</span>
            </div>
            <div id="calendar-grid" class="cal-days">{cells}</div>
            <StatsCard/>
        </section>
    }
}

// ───────────────────────────── Work-set stats ─────────────────────────────

#[component]
fn StatsCard() -> impl IntoView {
    let state = expect_context::<AppState>();
    let stats = move || {
        let day = state.selected.get();
        state
            .logs
            .with(|logs| logs.get(&day).map(muscle_group_stats))
    };

    view! {
        <div class="math-card">
            <div class="math-header-expand" id="math-header-expand"
                on:click=move |_| state.worksets_expanded.update(|v| *v = !*v)>
                <span id="stat-total-worksets">
                    {move || format!("// WORK SETS: {} SETS", stats().map(|s| s.total_work_sets).unwrap_or(0))}
                </span>
                <button class="btn-subtle" id="btn-expand-worksets">
                    {move || if state.worksets_expanded.get() { "[-]" } else { "[+]" }}
                </button>
            </div>
            <div id="muscle-group-list" class="muscle-group-list"
                style:display=move || if stats().is_some() && state.worksets_expanded.get() { "block" } else { "none" }>
                {move || {
                    let groups = stats().map(|s| s.groups).unwrap_or_default();
                    if groups.is_empty() {
                        view! { <div style="color:var(--dim); font-size:0.7rem;">"[NO LOGGED SETS]"</div> }.into_any()
                    } else {
                        groups
                            .into_iter()
                            .map(|(group, count)| view! {
                                <div class="math-row"><span>{group}":"</span>" "<strong>{count}" SETS"</strong></div>
                            })
                            .collect_view()
                            .into_any()
                    }
                }}
            </div>
        </div>
    }
}

// ───────────────────────────── Log panel ─────────────────────────────

#[component]
fn LogPanel() -> impl IntoView {
    let state = expect_context::<AppState>();
    let has_entry = move || state.logs.with(|l| l.contains_key(&state.selected.get()));

    // Bumped every time something the list shows changes; used as the `For` key.
    let generation = RwSignal::new(0u64);
    Effect::new(move |previous: Option<()>| {
        state.logs.track();
        state.selected.track();
        state.expanded_kg.track();
        state.expanded_reps.track();
        state.expanded_shrugs.track();
        if previous.is_some() {
            generation.update(|g| *g += 1);
        }
    });

    let on_load_routine =
        move |_| state.set_session(state.selected.get_untracked(), default_routine());

    let on_clear = move |_| {
        let day = state.selected.get_untracked();
        let Some(previous) = state.logs.with_untracked(|l| l.get(&day).cloned()) else {
            return;
        };
        state.last_cleared.set(Some((day.clone(), previous)));
        state.logs.update(|logs| {
            logs.shift_remove(&day);
        });
        state.persist();
    };

    let on_undo = move |_| {
        if let Some((day, session)) = state.last_cleared.get_untracked() {
            state.last_cleared.set(None);
            state.set_session(day, session);
        }
    };

    let on_add_exercise = move |_| {
        let day = state.selected.get_untracked();
        state.logs.update(|logs| {
            logs.entry(day).or_default().exercises.push(Exercise {
                name: "NEW EXERCISE".into(),
                category: Some("CABLE".into()),
                discomfort: Some("NO DISCOMFORT".into()),
                is_arm: None,
                sets: vec![SetEntry {
                    kind: SetKind::Work,
                    weight: 20.0,
                    reps: 5,
                    rir: Some(1),
                    shrug_reps: None,
                }],
            });
        });
        // The JS app did not save here, so a reload lost the new exercise
        // until the next action. Saving immediately is strictly safer.
        state.persist();
    };

    let on_save = move |_| {
        state.persist();
        // The JS app redrew here; signals make that unnecessary.
        state.sync_to_github(None);
    };

    view! {
        <section class="panel log-panel">
            <div class="log-top">
                <span id="log-date" class="date-str">{move || state.selected.get()}</span>
                <div class="preset-btns">
                    <button class="btn" id="btn-load-routine" on:click=on_load_routine>"[LOAD ROUTINE]"</button>
                    <button class="btn" id="btn-clear" on:click=on_clear>"[CLEAR]"</button>
                    <button class="btn btn-undo" id="btn-undo" on:click=on_undo
                        style:display=move || if state.last_cleared.get().is_some() { "inline-block" } else { "none" }>
                        "[UNDO CLEAR]"
                    </button>
                </div>
            </div>

            <div id="exercise-container" class="ex-container">
                // Rebuild the whole list from scratch whenever the data changes
                // (the JS did this with `innerHTML = ''`). Patching the existing
                // <select>/<option> elements in place is NOT safe: the browser
                // remembers what the user picked and ignores later attribute changes.
                <For each=move || vec![generation.get()] key=|g| *g children=move |_| exercise_list(state)/>
            </div>

            <div class="log-actions" id="log-actions" style:display=move || if has_entry() { "flex" } else { "none" }>
                <button id="btn-add-ex" class="btn" on:click=on_add_exercise>"+ EXERCISE"</button>
                <button id="btn-save" class="btn btn-save" on:click=on_save>"[SAVE DAY & SYNC]"</button>
            </div>
        </section>
    }
}

/// Redraws every exercise card for the selected day (JS: `renderSelectedDate`).
fn exercise_list(state: AppState) -> AnyView {
    let day = state.selected.get_untracked();
    let logs = state.logs.get_untracked();
    let expanded_kg = state.expanded_kg.get_untracked();
    let expanded_reps = state.expanded_reps.get_untracked();
    let expanded_shrugs = state.expanded_shrugs.get_untracked();

    let Some(entry) = logs.get(&day) else {
        return view! {
            <div class="empty-msg">
                {format!("[NO LOGGED SESSION FOR {day}]")}<br/><br/>
                "Click [LOAD ROUTINE] above to load exercises."
            </div>
        }
        .into_any();
    };

    let arm_mode = entry
        .arm_mode
        .clone()
        .unwrap_or_else(|| "STRAIGHT".to_string());
    let (mut mobility_divider, mut lifts_divider, mut arm_divider) = (false, false, false);
    let mut out: Vec<AnyView> = Vec::new();

    for (ex_idx, ex) in entry.exercises.iter().enumerate() {
        let is_mobility = ex.is_mobility();
        let is_arm = ex.is_arm_exercise();

        // Section dividers, in the same if / else-if order as the JS.
        if is_mobility && !mobility_divider {
            out.push(view! { <div class="section-divider">"// SECTION: "<span>"MOBILITY & ACTIVATION"</span></div> }.into_any());
            mobility_divider = true;
        } else if !is_mobility && !is_arm && !lifts_divider {
            out.push(view! { <div class="section-divider">"// SECTION: "<span>"WORKING LIFTS"</span></div> }.into_any());
            lifts_divider = true;
        } else if is_arm && !arm_divider {
            let label = format!("MODE: [{arm_mode}] (CLICK TO TOGGLE)");
            out.push(
                view! {
                    <div class="section-divider arm-section-divider">
                        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
                            <span>"// SECTION: ARMS"</span>
                            <button class="btn-subtle" on:click=move |_| state.edit_session(|s| {
                                let current = s.arm_mode.clone().unwrap_or_else(|| "STRAIGHT".into());
                                s.arm_mode = Some(if current == "STRAIGHT" { "ZIGZAG".into() } else { "STRAIGHT".into() });
                            })>{label}</button>
                        </div>
                    </div>
                }
                .into_any(),
            );
            arm_divider = true;
        }

        out.push(exercise_card(
            state,
            &day,
            &logs,
            &arm_mode,
            ex_idx,
            ex,
            &expanded_kg,
            &expanded_reps,
            &expanded_shrugs,
        ));
    }
    out.into_any()
}

/// A `HashSet` key like `"2_0"` (exercise 2, set 0), as in the JS.
fn key(ex_idx: usize, set_idx: usize) -> String {
    format!("{ex_idx}_{set_idx}")
}

/// Shared by the three "[+ MORE]"-style dropdowns.
fn toggle_expanded(set: RwSignal<HashSet<String>>, key: String, expand: bool) {
    set.update(|s| {
        if expand {
            s.insert(key);
        } else {
            s.remove(&key);
        }
    });
}

#[allow(clippy::too_many_arguments)]
fn exercise_card(
    state: AppState,
    day: &str,
    logs: &Logs,
    arm_mode: &str,
    ex_idx: usize,
    ex: &Exercise,
    expanded_kg: &HashSet<String>,
    expanded_reps: &HashSet<String>,
    expanded_shrugs: &HashSet<String>,
) -> AnyView {
    let is_mobility = ex.is_mobility();
    let is_assisted = ex.is_assisted();
    let has_shrugs = ex.has_shrugs();
    let is_arm = ex.is_arm_exercise();
    let category = ex.category.as_deref();

    let card_class = if is_mobility {
        "ex-row mobility-row"
    } else if is_arm && arm_mode == "ZIGZAG" {
        "ex-row arm-zigzag-row"
    } else {
        "ex-row"
    };

    let first_previous = find_previous_set_data(&ex.name, 0, day, logs);
    let smart_target = calculate_smart_target_load(category, first_previous.as_ref());
    let top_set = ex
        .sets
        .iter()
        .find(|s| s.kind == SetKind::Work)
        .or(ex.sets.first());
    let e1rm = calculate_e1rm(
        top_set.map(|s| s.weight).unwrap_or(0.0),
        top_set.map(|s| s.reps as f64).unwrap_or(0.0),
    );

    let mut work_set_count = 0usize;
    let mut rows: Vec<AnyView> = Vec::new();
    for (set_idx, set) in ex.sets.iter().enumerate() {
        let is_warmup = set.kind == SetKind::Warmup;
        if !is_warmup {
            work_set_count += 1;
        }
        let label = if is_warmup {
            "WARMUP".to_string()
        } else {
            format_work_set_label(work_set_count)
        };
        let previous = find_previous_set_data(&ex.name, set_idx, day, logs).map(|p| p.set);

        // Progressive-overload badge
        let mut badge = String::new();
        if let (false, Some(prev)) = (is_warmup, &previous) {
            if is_mobility {
                let diff = set.reps as i64 - prev.reps as i64;
                if diff > 0 {
                    badge = format!("+{diff} REP PO");
                }
            } else if is_assisted {
                let diff = prev.weight - set.weight;
                if diff > 0.0 {
                    badge = format!("+{}kg BODYWEIGHT", num(diff));
                } else if diff == 0.0 && set.reps > prev.reps {
                    badge = format!("+{}rep", set.reps - prev.reps);
                }
            } else {
                let dw = set.weight - prev.weight;
                let dr = set.reps as i64 - prev.reps as i64;
                if dw > 0.0 {
                    badge = format!("+{}kg", num(dw));
                } else if dw == 0.0 && dr > 0 {
                    badge = format!("+{dr}rep");
                }
            }
        }

        let prev_hint = match &previous {
            None => "—".to_string(),
            Some(p) if is_mobility => format!("{} reps", p.reps),
            Some(p) if is_assisted => format!("Ass:{}k×{}", num(p.weight), p.reps),
            Some(p) => format!("{}k×{}", num(p.weight), p.reps),
        };

        let k = key(ex_idx, set_idx);

        let weight_cell = if is_mobility {
            view! { <span style="font-size:0.7rem;color:var(--dim);">"BW"</span> }.into_any()
        } else {
            let options = kg_options(category, set.weight, expanded_kg.contains(&k));
            let k = k.clone();
            view! {
                <select class="kg-select" on:change=move |ev| {
                    let value = event_target_value(&ev);
                    match value.as_str() {
                        MORE => toggle_expanded(state.expanded_kg, k.clone(), true),
                        LESS => toggle_expanded(state.expanded_kg, k.clone(), false),
                        other => {
                            let weight = other.parse::<f64>().unwrap_or(0.0);
                            state.edit_session(|s| s.exercises[ex_idx].sets[set_idx].weight = weight);
                        }
                    }
                }>{option_elements(options)}</select>
            }
            .into_any()
        };

        let reps_cell = {
            let options = reps_options(set.reps, expanded_reps.contains(&k));
            let k = k.clone();
            view! {
                <select class="small-caps-select reps-select" on:change=move |ev| {
                    let value = event_target_value(&ev);
                    match value.as_str() {
                        MORE => toggle_expanded(state.expanded_reps, k.clone(), true),
                        LESS => toggle_expanded(state.expanded_reps, k.clone(), false),
                        other => {
                            let reps = other.parse::<u32>().unwrap_or(0);
                            state.edit_session(|s| s.exercises[ex_idx].sets[set_idx].reps = reps);
                        }
                    }
                }>{option_elements(options)}</select>
            }
        };

        let shrug_cell = if has_shrugs && !is_warmup {
            let options = shrug_options(set.shrug_reps.unwrap_or(0), expanded_shrugs.contains(&k));
            let k = k.clone();
            view! {
                <div class="shrug-tracker" title="Shrug Reps at End">
                    <select class="small-caps-select" on:change=move |ev| {
                        let value = event_target_value(&ev);
                        match value.as_str() {
                            MORE => toggle_expanded(state.expanded_shrugs, k.clone(), true),
                            LESS => toggle_expanded(state.expanded_shrugs, k.clone(), false),
                            other => {
                                let reps = other.parse::<u32>().unwrap_or(0);
                                state.edit_session(|s| s.exercises[ex_idx].sets[set_idx].shrug_reps = Some(reps));
                            }
                        }
                    }>{option_elements(options)}</select>
                </div>
            }
            .into_any()
        } else {
            ().into_any()
        };

        let rir_cell = if is_warmup {
            view! { <span style="font-size:0.7rem;color:var(--dim);">"—"</span> }.into_any()
        } else {
            let current = set.rir.unwrap_or(1);
            let choices = [
                (3, "3 RIR"),
                (2, "2 RIR"),
                (1, "1 RIR (STD)"),
                (0, "0 (FAIL)"),
            ];
            view! {
                <select class="small-caps-select rir-select" on:change=move |ev| {
                    let rir = event_target_value(&ev).parse::<i32>().unwrap_or(0);
                    state.edit_session(|s| s.exercises[ex_idx].sets[set_idx].rir = Some(rir));
                }>
                    {choices.into_iter().map(|(v, text)| view! {
                        <option value=v.to_string() selected=current == v>{text}</option>
                    }).collect_view()}
                </select>
            }
            .into_any()
        };

        let reps_width = if has_shrugs && !is_warmup {
            "36%"
        } else {
            "22%"
        };
        let type_class = if is_warmup {
            "btn-set-type is-warmup"
        } else {
            "btn-set-type is-work"
        };
        rows.push(
            view! {
                <tr>
                    <td style="width:18%">
                        <button class=type_class on:click=move |_| state.edit_session(|s| {
                            let set = &mut s.exercises[ex_idx].sets[set_idx];
                            set.kind = if set.kind == SetKind::Warmup { SetKind::Work } else { SetKind::Warmup };
                            if set.kind == SetKind::Work {
                                set.rir = Some(1);
                            }
                        })>{label}</button>
                    </td>
                    <td style="width:16%" class="prev-hint-td">{prev_hint}</td>
                    <td style="width:20%"><div style="display:flex;align-items:center;gap:4px;">{weight_cell}</div></td>
                    <td style=format!("width:{reps_width}")>
                        <div style="display:flex;align-items:center;gap:4px;">
                            {reps_cell}{shrug_cell}
                            {(!badge.is_empty()).then(|| view! { <span class="po-badge-inline">{badge.clone()}</span> })}
                        </div>
                    </td>
                    <td style="width:14%">{rir_cell}</td>
                    <td style="width:2%">
                        <button class="btn-del" on:click=move |_| state.edit_session(|s| {
                            s.exercises[ex_idx].sets.remove(set_idx);
                        })>"×"</button>
                    </td>
                </tr>
            }
            .into_any(),
        );
    }

    let discomfort = ex
        .discomfort
        .clone()
        .unwrap_or_else(|| "NO DISCOMFORT".to_string());
    let discomfort_class = if discomfort != "NO DISCOMFORT" {
        "ex-discomfort-row active-discomfort"
    } else {
        "ex-discomfort-row"
    };
    let discomfort_options = discomfort_select_options(&ex.name, &discomfort);
    let load_heading = if is_mobility {
        "LOAD"
    } else if is_assisted {
        "ASSIST KG"
    } else {
        "KG"
    };
    let reps_heading = if has_shrugs { "REPS + SHRUGS" } else { "REPS" };
    let name_value = ex.name.to_uppercase();
    let zigzag_tag = (is_arm && arm_mode == "ZIGZAG")
        .then(|| view! { <span class="arm-tag">"[ZIG-ZAG]"</span> });
    let e1rm_tag =
        (e1rm > 0).then(|| view! { <span class="e1rm-tag">{format!("e1RM: {e1rm}kg")}</span> });
    let target_tag = smart_target
        .filter(|_| !is_mobility)
        .map(|t| view! { <span class="smart-target-badge">{t}</span> });

    view! {
        <div class=card_class>
            <div class="ex-row-header">
                <div style="display:flex;align-items:center;gap:8px;width:70%;">
                    <input type="text" class="ex-title-input" prop:value=name_value
                        on:change=move |ev| {
                            // Saved with the next action, as in the JS: no redraw per edit.
                            let name = event_target_value(&ev).to_uppercase();
                            state.logs.update_untracked(|logs| {
                                if let Some(s) = logs.get_mut(&state.selected.get_untracked()) {
                                    s.exercises[ex_idx].name = name;
                                }
                            });
                        }/>
                    {zigzag_tag}
                </div>
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">{e1rm_tag}{target_tag}</div>
                <button class="btn-del" on:click=move |_| state.edit_session(|s| { s.exercises.remove(ex_idx); })>"[DEL]"</button>
            </div>

            <div class=discomfort_class>
                <span class="discomfort-label">"FEEDBACK:"</span>
                <select class="discomfort-select" on:change=move |ev| {
                    let value = event_target_value(&ev);
                    state.edit_session(|s| s.exercises[ex_idx].discomfort = Some(value));
                }>{option_elements(discomfort_options)}</select>
            </div>

            <div class="table-responsive-wrapper">
                <table class="tbl">
                    <thead>
                        <tr>
                            <th>"SET TYPE"</th>
                            <th>"PREV"</th>
                            <th>{load_heading}</th>
                            <th class="small-caps-header">{reps_heading}</th>
                            <th class="small-caps-header">"RIR"</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>{rows}</tbody>
                </table>
            </div>
            <div style="display:flex;gap:8px;margin-top:4px;">
                <button class="btn" style="font-size:0.7rem;padding:4px 8px;"
                    on:click=move |_| add_set(state, ex_idx, SetKind::Work)>"+ WORK SET"</button>
                <button class="btn" style="font-size:0.7rem;padding:4px 8px;color:var(--gray);"
                    on:click=move |_| add_set(state, ex_idx, SetKind::Warmup)>"+ WARMUP SET"</button>
            </div>
        </div>
    }
    .into_any()
}

/// Copy the last set (or a default one) as a new set of the given kind.
fn add_set(state: AppState, ex_idx: usize, kind: SetKind) {
    state.edit_session(|s| {
        let exercise = &mut s.exercises[ex_idx];
        let mut new_set = exercise.sets.last().cloned().unwrap_or(SetEntry {
            kind,
            weight: 0.0,
            reps: 5,
            rir: Some(1),
            shrug_reps: None,
        });
        new_set.kind = kind;
        new_set.rir = Some(if kind == SetKind::Work { 1 } else { 3 });
        exercise.sets.push(new_set);
    });
}
