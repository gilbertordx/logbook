//! Thin wrappers around browser features (storage, dialogs, files, clock).
//!
//! Everything that talks to the browser lives here, so the rest of the app can
//! be written as ordinary Rust. Each function is a few lines because
//! `web-sys` mirrors the JavaScript API one-to-one.

use logbook_core::dates::format_date_key;
use logbook_core::models::Logs;
use logbook_core::storage::{STORAGE_KEY, first_run_logs, parse_logs, serialize_logs};
use wasm_bindgen::JsCast;
use wasm_bindgen_futures::JsFuture;

fn window() -> web_sys::Window {
    web_sys::window().expect("running in a browser")
}

fn local_storage() -> Option<web_sys::Storage> {
    window().local_storage().ok().flatten()
}

fn session_storage() -> Option<web_sys::Storage> {
    window().session_storage().ok().flatten()
}

/// Today as `(year, month 1-12, day)` from the browser's clock.
pub fn today() -> (i32, u32, u32) {
    let now = js_sys::Date::new_0();
    (
        now.get_full_year() as i32,
        now.get_month() + 1,
        now.get_date(),
    )
}

pub fn today_key() -> String {
    let (y, m, d) = today();
    format_date_key(y, m, d)
}

/// JS: `StorageService.load`. Seeds sample data on the very first run.
pub fn load_logs(today_key: &str) -> Logs {
    let storage = local_storage();
    if let Some(saved) = storage
        .as_ref()
        .and_then(|s| s.get_item(STORAGE_KEY).ok().flatten())
    {
        return parse_logs(&saved).unwrap_or_else(|| {
            // The JS app silently started from an empty log here, and the next
            // save then overwrote the unreadable data forever. Keep a copy.
            if let Some(s) = &storage {
                let _ = s.set_item(&format!("{STORAGE_KEY}_corrupt_backup"), &saved);
            }
            Logs::new()
        });
    }
    let logs = first_run_logs(today_key);
    save_logs(&logs);
    logs
}

pub fn save_logs(logs: &Logs) {
    if let Some(s) = local_storage() {
        let _ = s.set_item(STORAGE_KEY, &serialize_logs(logs));
    }
}

pub fn github_token() -> Option<String> {
    session_storage()?
        .get_item("tbjp_gh_token")
        .ok()
        .flatten()
        .filter(|t| !t.is_empty())
}

pub fn set_github_token(token: Option<&str>) {
    if let Some(s) = session_storage() {
        let _ = match token {
            Some(t) => s.set_item("tbjp_gh_token", t),
            None => s.remove_item("tbjp_gh_token"),
        };
    }
}

/// Older versions kept the token in `localStorage`; remove any leftover.
pub fn forget_persisted_github_token() {
    if let Some(s) = local_storage() {
        let _ = s.remove_item("tbjp_gh_token");
    }
}

pub fn alert(message: &str) {
    let _ = window().alert_with_message(message);
}

/// Returns `None` if the user pressed Cancel.
pub fn prompt(message: &str, default: &str) -> Option<String> {
    window()
        .prompt_with_message_and_default(message, default)
        .ok()
        .flatten()
}

pub fn warn(message: &str) {
    web_sys::console::warn_1(&message.into());
}

/// Offer `contents` as a file download (same data-URL trick as the JS app).
pub fn download_text(file_name: &str, contents: &str) {
    let document = window().document().expect("document");
    let href = format!(
        "data:text/json;charset=utf-8,{}",
        String::from(js_sys::encode_uri_component(contents))
    );
    let anchor: web_sys::HtmlAnchorElement =
        document.create_element("a").unwrap().dyn_into().unwrap();
    anchor.set_href(&href);
    anchor.set_download(file_name);
    let body = document.body().expect("body");
    let _ = body.append_child(&anchor);
    anchor.click();
    anchor.remove();
}

/// Read a whole text file chosen with an `<input type="file">`.
pub async fn read_file_text(file: &web_sys::File) -> Result<String, String> {
    let value = JsFuture::from(file.text())
        .await
        .map_err(|_| "file could not be read".to_string())?;
    value
        .as_string()
        .ok_or_else(|| "file is not text".to_string())
}
