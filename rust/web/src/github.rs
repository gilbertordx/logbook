//! Backup to a file in the GitHub repo through the Contents API.
//! Original: `services/GitHubSyncService.js`. Same endpoints, same messages.
//!
//! This is `async` code: each `.await` is a network round trip during which the
//! page stays responsive. `spawn_local` (used by the callers) runs these
//! futures on the browser's event loop.

use base64::Engine;
use base64::engine::general_purpose::STANDARD;
use gloo_net::http::Request;
use logbook_core::constants::{GITHUB_FILE_PATH, GITHUB_REPO_NAME, GITHUB_REPO_OWNER};
use logbook_core::models::Logs;
use logbook_core::storage::{parse_logs, serialize_logs_pretty};
use serde_json::{Value, json};

fn url() -> String {
    format!(
        "https://api.github.com/repos/{GITHUB_REPO_OWNER}/{GITHUB_REPO_NAME}/contents/{GITHUB_FILE_PATH}"
    )
}

/// Download the remote log file. `Ok(None)` if it does not exist / not 200.
pub async fn pull(token: &str) -> Result<Option<Logs>, String> {
    let response = Request::get(&url())
        .header("Authorization", &format!("token {token}"))
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    if response.status() != 200 {
        return Ok(None);
    }
    let body: Value = response.json().await.map_err(|e| e.to_string())?;
    // GitHub wraps its base64 every 60 characters; the decoder wants one line.
    let encoded: String = body["content"]
        .as_str()
        .unwrap_or("")
        .split_whitespace()
        .collect();
    let bytes = STANDARD.decode(encoded).map_err(|e| e.to_string())?;
    let text = String::from_utf8(bytes).map_err(|e| e.to_string())?;
    parse_logs(&text)
        .map(Some)
        .ok_or_else(|| "remote logs.json is not valid".to_string())
}

/// Upload all logs. `Ok(true)` when GitHub answered 200/201.
pub async fn push(token: &str, logs: &Logs, selected_date: &str) -> Result<bool, String> {
    let existing = Request::get(&url())
        .header("Authorization", &format!("token {token}"))
        .header("Accept", "application/vnd.github.v3+json")
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let sha = if existing.status() == 200 {
        let body: Value = existing.json().await.map_err(|e| e.to_string())?;
        body["sha"].as_str().map(str::to_string)
    } else {
        None
    };

    let mut payload = json!({
        "message": format!("sync: update workout logs [{selected_date}]"),
        "content": STANDARD.encode(serialize_logs_pretty(logs)),
        "branch": "main",
    });
    if let Some(sha) = sha {
        payload["sha"] = Value::String(sha);
    }

    let response = Request::put(&url())
        .header("Authorization", &format!("token {token}"))
        .header("Accept", "application/vnd.github.v3+json")
        .json(&payload)
        .map_err(|e| e.to_string())?
        .send()
        .await
        .map_err(|e| e.to_string())?;
    Ok(matches!(response.status(), 200 | 201))
}
