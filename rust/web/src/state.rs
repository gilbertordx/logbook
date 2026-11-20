//! The app's shared state. Original: `state.js` (one big mutable object that
//! every module changed directly).
//!
//! In Leptos, state is held in *signals*. A signal is a box you can read and
//! write; any part of the screen that reads it is re-drawn automatically when
//! it changes. That replaces the JS `refresh()` callback that had to be passed
//! to every module by hand.

use std::collections::HashSet;

use leptos::prelude::*;
use logbook_core::dates::format_date_key;
use logbook_core::models::{Logs, Session};

use crate::{browser, github};

/// `RwSignal` is `Copy`, so this whole struct is cheap to copy into every
/// click handler without fighting the borrow checker.
#[derive(Clone, Copy)]
pub struct AppState {
    pub logs: RwSignal<Logs>,
    /// The day being viewed, as `DD/MM/YY`.
    pub selected: RwSignal<String>,
    /// Month shown in the calendar: `(year, month 1-12)`.
    pub view_month: RwSignal<(i32, u32)>,
    /// What [CLEAR] removed, so [UNDO CLEAR] can put it back.
    pub last_cleared: RwSignal<Option<(String, Session)>>,
    /// Dropdowns the user expanded with "[+ MORE]", keyed `"{exercise}_{set}"`.
    pub expanded_kg: RwSignal<HashSet<String>>,
    pub expanded_reps: RwSignal<HashSet<String>>,
    pub expanded_shrugs: RwSignal<HashSet<String>>,
    pub worksets_expanded: RwSignal<bool>,
    /// Text of the header timer, e.g. `[TIME: 12:05]`.
    pub timer_text: RwSignal<String>,
    /// Text inside the `[SYNC: ...]` button.
    pub sync_status: RwSignal<String>,
}

impl AppState {
    pub fn new() -> Self {
        let (year, month, day) = browser::today();
        let today = format_date_key(year, month, day);
        Self {
            logs: RwSignal::new(browser::load_logs(&today)),
            selected: RwSignal::new(today),
            view_month: RwSignal::new((year, month)),
            last_cleared: RwSignal::new(None),
            expanded_kg: RwSignal::new(HashSet::new()),
            expanded_reps: RwSignal::new(HashSet::new()),
            expanded_shrugs: RwSignal::new(HashSet::new()),
            worksets_expanded: RwSignal::new(false),
            timer_text: RwSignal::new("[TIME: 00:00]".to_string()),
            sync_status: RwSignal::new("LOCAL".to_string()),
        }
    }

    /// Write the logs to `localStorage` (JS: `save(state.logs)`).
    pub fn persist(&self) {
        self.logs.with_untracked(browser::save_logs);
    }

    /// Change the selected day's session, save, and redraw.
    /// Does nothing if that day has no session.
    pub fn edit_session(&self, change: impl FnOnce(&mut Session)) {
        let day = self.selected.get_untracked();
        self.logs.update(|logs| {
            if let Some(session) = logs.get_mut(&day) {
                change(session);
            }
        });
        self.persist();
    }

    /// Replace one day's session wholesale (load routine / undo).
    pub fn set_session(&self, day: String, session: Session) {
        self.logs.update(|logs| {
            logs.insert(day, session);
        });
        self.persist();
    }

    /// Upload everything to GitHub, if a token was provided this tab.
    pub fn sync_to_github(&self, token_override: Option<String>) {
        let Some(token) = token_override.or_else(browser::github_token) else {
            return;
        };
        let state = *self;
        self.sync_status.set("BUSY...".to_string());
        leptos::task::spawn_local(async move {
            let logs = state.logs.get_untracked();
            let day = state.selected.get_untracked();
            let status = match github::push(&token, &logs, &day).await {
                Ok(true) => "OK",
                Ok(false) => "ERR",
                Err(error) => {
                    browser::warn(&format!("GitHub Sync Error: {error}"));
                    "ERR"
                }
            };
            state.sync_status.set(status.to_string());
        });
    }

    /// Download remote logs and merge them over the local ones.
    pub fn pull_from_github(&self, token: String) {
        let state = *self;
        leptos::task::spawn_local(async move {
            match github::pull(&token).await {
                Ok(Some(remote)) => {
                    state
                        .logs
                        .update(|logs| logbook_core::storage::merge_logs(logs, remote));
                    state.persist();
                    state.sync_status.set("OK".to_string());
                }
                Ok(None) => {}
                Err(error) => browser::warn(&format!("GitHub Pull Warning: {error}")),
            }
        });
    }
}
