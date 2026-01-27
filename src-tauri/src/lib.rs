//! Moltzer Client - Native Desktop Client for Clawdbot
//!
//! Rust backend providing:
//! - WebSocket communication with Clawdbot Gateway
//! - OS keychain integration for secure credential storage
//! - Gateway discovery on local network
//! - Native system integration (notifications, window management)

mod gateway;
mod keychain;
mod discovery;
mod protocol;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init());

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_window_state::Builder::new().build());
    }

    builder
        .setup(|app| {
            use tauri::Manager;
            app.manage(gateway::GatewayState::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            gateway::connect,
            gateway::disconnect,
            gateway::send_message,
            gateway::get_connection_status,
            gateway::get_connection_state,
            gateway::get_connection_quality,
            gateway::get_models,
            keychain::keychain_get,
            keychain::keychain_set,
            keychain::keychain_delete,
            discovery::discover_gateways,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
