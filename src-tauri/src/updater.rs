//! Auto-updater module for Moltzer
//!
//! Provides:
//! - Check for updates on startup
//! - Periodic update checks (every 4-6 hours)
//! - Network reconnection detection
//! - Non-intrusive update notifications
//! - User consent before download/install

use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, Listener, Manager, Runtime};
use tokio::sync::Mutex;
use tokio::time::{interval, Duration};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateInfo {
    pub available: bool,
    pub version: String,
    pub current_version: String,
    pub body: Option<String>,
    pub date: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct UpdaterState {
    pub last_check: Arc<Mutex<Option<std::time::SystemTime>>>,
    pub pending_update: Arc<Mutex<Option<UpdateInfo>>>,
    pub is_checking: Arc<Mutex<bool>>,
}

/// Check for updates without showing built-in dialog
///
/// Checks for available application updates without showing the built-in Tauri updater dialog.
/// Prevents concurrent update checks to avoid redundant network requests.
///
/// # Arguments
/// * `app` - Tauri application handle
///
/// # Returns
/// * `Ok(UpdateInfo)` - Update information (available: true if update found)
/// * `Err(String)` - Error if check fails or already in progress
///
/// # Behavior
/// - Prevents concurrent checks with mutex lock
/// - Stores pending update in app state
/// - Emits "update-available" event if update found
/// - Updates last check timestamp
#[tauri::command]
pub async fn check_for_updates<R: Runtime>(app: AppHandle<R>) -> Result<UpdateInfo, String> {
    let state = app.state::<UpdaterState>();
    
    // Prevent concurrent checks
    {
        let mut is_checking = state.is_checking.lock().await;
        if *is_checking {
            return Err("Update check already in progress".to_string());
        }
        *is_checking = true;
    }

    let result = perform_update_check(&app).await;
    
    // Release lock
    *state.is_checking.lock().await = false;
    
    result
}

/// Download and install the update
///
/// Downloads and installs a pending application update.
/// Emits progress events during download for UI feedback.
///
/// # Arguments
/// * `app` - Tauri application handle
///
/// # Returns
/// * `Ok(())` - Update downloaded and installed successfully (app will restart)
/// * `Err(String)` - Error if no update available or download fails
///
/// # Behavior
/// - Emits "update-download-progress" events with percentage (0-100)
/// - Emits "update-downloaded" event when complete
/// - Application will restart automatically after successful install
#[tauri::command]
pub async fn install_update<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    use tauri_plugin_updater::UpdaterExt;
    
    let updater = app.updater_builder().build().map_err(|e| e.to_string())?;
    
    if let Some(update) = updater.check().await.map_err(|e| e.to_string())? {
        // Download and install
        update
            .download_and_install(
                |chunk_length, content_length| {
                    let progress = if let Some(total) = content_length {
                        (chunk_length as f64 / total as f64) * 100.0
                    } else {
                        0.0
                    };
                    
                    // Emit progress event to frontend
                    let _ = app.emit("update-download-progress", progress);
                },
                || {
                    // Emit completion event
                    let _ = app.emit("update-downloaded", ());
                },
            )
            .await
            .map_err(|e| e.to_string())?;
        
        Ok(())
    } else {
        Err("No update available".to_string())
    }
}

/// Get current update state
#[tauri::command]
pub async fn get_update_status<R: Runtime>(app: AppHandle<R>) -> Result<Option<UpdateInfo>, String> {
    let state = app.state::<UpdaterState>();
    let pending = state.pending_update.lock().await;
    Ok(pending.clone())
}

/// Clear pending update notification
#[tauri::command]
pub async fn dismiss_update<R: Runtime>(app: AppHandle<R>) -> Result<(), String> {
    let state = app.state::<UpdaterState>();
    *state.pending_update.lock().await = None;
    Ok(())
}

/// Internal function to perform the actual update check
async fn perform_update_check<R: Runtime>(app: &AppHandle<R>) -> Result<UpdateInfo, String> {
    use tauri_plugin_updater::UpdaterExt;
    
    let updater = app.updater_builder().build().map_err(|e| e.to_string())?;
    
    let current_version = app.package_info().version.to_string();
    
    match updater.check().await {
        Ok(Some(update)) => {
            let info = UpdateInfo {
                available: true,
                version: update.version.clone(),
                current_version: current_version.clone(),
                body: update.body.clone(),
                date: update.date.map(|d| d.to_string()),
            };
            
            // Store pending update
            let state = app.state::<UpdaterState>();
            *state.pending_update.lock().await = Some(info.clone());
            *state.last_check.lock().await = Some(std::time::SystemTime::now());
            
            // Emit event to frontend
            let _ = app.emit("update-available", &info);
            
            Ok(info)
        }
        Ok(None) => {
            let state = app.state::<UpdaterState>();
            *state.last_check.lock().await = Some(std::time::SystemTime::now());
            
            println!("Update check complete: no updates available (current: {})", current_version);
            
            Ok(UpdateInfo {
                available: false,
                version: current_version.clone(),
                current_version,
                body: None,
                date: None,
            })
        }
        Err(e) => {
            eprintln!("[Updater] Update check failed: {}", e);
            Err(format!("Failed to check for updates: {}", e))
        }
    }
}

/// Setup periodic update checks (every 4-6 hours)
pub fn setup_periodic_checks<R: Runtime>(app: &AppHandle<R>) {
    let app_handle = app.clone();
    
    tauri::async_runtime::spawn(async move {
        // Random interval between 4-6 hours to avoid thundering herd
        let base_hours = 4;
        let random_extra_minutes = (rand::random::<u64>() % 120) as u64; // 0-120 minutes
        let check_interval = Duration::from_secs(
            (base_hours * 3600) + (random_extra_minutes * 60)
        );
        
        println!(
            "[Updater] Periodic checks enabled: every {} hours {} minutes",
            base_hours,
            random_extra_minutes
        );
        
        let mut interval_timer = interval(check_interval);
        
        loop {
            interval_timer.tick().await;
            
            println!("[Updater] Performing periodic update check...");
            
            // Perform update check
            if let Ok(info) = perform_update_check(&app_handle).await {
                if info.available {
                    println!("[Updater] Update available: v{}", info.version);
                } else {
                    println!("[Updater] No updates available");
                }
            }
        }
    });
}

/// Listen for network reconnection events from gateway
pub fn setup_network_listener<R: Runtime>(app: &AppHandle<R>) {
    let app_handle = app.clone();
    
    println!("[Updater] Network listener enabled: will check for updates on gateway reconnection");
    
    // Listen to "gateway:reconnected" event emitted by the gateway module
    let _ = app.listen("gateway:reconnected", move |_event| {
        let app = app_handle.clone();
        tauri::async_runtime::spawn(async move {
            println!("[Updater] Gateway reconnected, checking for updates...");
            let _ = perform_update_check(&app).await;
        });
    });
}
