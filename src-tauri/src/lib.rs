//! Moltzer Client - Native Desktop Client for Clawdbot
//!
//! Rust backend providing:
//! - WebSocket communication with Clawdbot Gateway
//! - OS keychain integration for secure credential storage
//! - Gateway discovery on local network
//! - Native system integration (notifications, window management)
//! - Native menu bar with standard macOS/Windows conventions

mod discovery;
mod gateway;
mod keychain;
mod menu;
mod protocol;
mod tray;
mod updater;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_updater::Builder::new().build());

    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_window_state::Builder::new().build());
    }

    builder
        .setup(|app| {
            use tauri::Manager;
            app.manage(gateway::GatewayState::default());
            app.manage(updater::UpdaterState::default());

            // Build and set native menu bar
            #[cfg(desktop)]
            {
                let menu = menu::build_menu(app.handle())?;
                app.set_menu(menu)?;

                // Setup system tray
                tray::setup_tray(app.handle())?;

                // Ensure quickinput window is hidden on startup
                // (window_state plugin might restore it as visible)
                if let Some(quickinput) = app.get_webview_window("quickinput") {
                    let _ = quickinput.hide();
                }
            }

            // Setup updater - periodic checks and network listener
            updater::setup_periodic_checks(app.handle());
            updater::setup_network_listener(app.handle());

            // Check for updates on startup (async, non-blocking)
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                use crate::updater::check_for_updates;
                // Wait a bit to let the app fully initialize
                tokio::time::sleep(tokio::time::Duration::from_secs(10)).await;
                match check_for_updates(app_handle.clone()).await {
                    Ok(info) if info.available => {
                        println!("Update available on startup: v{}", info.version);
                    }
                    Ok(_) => {
                        println!("No updates available on startup");
                    }
                    Err(e) => {
                        eprintln!("Startup update check failed: {}", e);
                    }
                }
            });

            Ok(())
        })
        .on_menu_event(|app, event| {
            menu::handle_menu_event(app, event.id().as_ref());
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
            updater::check_for_updates,
            updater::install_update,
            updater::get_update_status,
            updater::dismiss_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
