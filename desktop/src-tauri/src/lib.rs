use keyring::Entry;
use serde_json::Value;

const SERVICE: &str = "HOME Desktop";
const USER: &str = "sync-token";
const ENDPOINT: &str = "https://luis-home-sync.luisbogensberger.workers.dev";

fn token_entry() -> Result<Entry, String> {
    Entry::new(SERVICE, USER).map_err(|e| e.to_string())
}

#[tauri::command]
fn home_has_token() -> bool {
    token_entry().ok().and_then(|e| e.get_password().ok()).map(|s| s.len() >= 16).unwrap_or(false)
}

#[tauri::command]
fn home_set_token(token: String) -> Result<(), String> {
    let clean = token.trim().to_string();
    if clean.len() < 16 { return Err("HOME token is too short".into()); }
    token_entry()?.set_password(&clean).map_err(|e| e.to_string())
}

#[tauri::command]
fn home_clear_token() -> Result<(), String> {
    let e = token_entry()?;
    match e.delete_credential() {
        Ok(_) => Ok(()),
        Err(_) => Ok(()),
    }
}

#[tauri::command]
async fn home_request(method: String, path: String, body: Option<Value>) -> Result<Value, String> {
    let token = token_entry()?.get_password().map_err(|_| "HOME is not paired yet".to_string())?;
    let path = if path.starts_with('/') { path } else { format!("/{path}") };
    let url = format!("{ENDPOINT}{path}");
    let client = reqwest::Client::new();
    let mut req = match method.to_uppercase().as_str() {
        "GET" => client.get(&url),
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        "PATCH" => client.patch(&url),
        "DELETE" => client.delete(&url),
        _ => return Err("Unsupported method".into()),
    };
    req = req.bearer_auth(token).header("content-type", "application/json");
    if let Some(v) = body { req = req.json(&v); }
    let res = req.send().await.map_err(|e| e.to_string())?;
    let status = res.status();
    let text = res.text().await.map_err(|e| e.to_string())?;
    let data: Value = serde_json::from_str(&text).unwrap_or(Value::String(text));
    if !status.is_success() {
        let message = data.get("error").and_then(|v| v.as_str()).unwrap_or("HOME Sync request failed");
        return Err(format!("HTTP {}: {}", status.as_u16(), message));
    }
    Ok(data)
}

#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    if !(url.starts_with("https://") || url.starts_with("mailto:")) { return Err("Unsupported URL".into()); }
    open::that(url).map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![home_has_token, home_set_token, home_clear_token, home_request, open_external])
        .run(tauri::generate_context!())
        .expect("error while running HOME");
}
