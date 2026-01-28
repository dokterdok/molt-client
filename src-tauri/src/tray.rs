//! System tray implementation
//!
//! Provides a menu bar/system tray icon for quick access:
//! - New Conversation
//! - Quick Ask
//! - Show/Hide Window
//! - Quit

use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager,
};

/// Tray menu item IDs
pub mod ids {
    pub const SHOW_HIDE: &str = "tray_show_hide";
    pub const NEW_CONVERSATION: &str = "tray_new_conversation";
    pub const QUICK_ASK: &str = "tray_quick_ask";
    pub const QUIT: &str = "tray_quit";
}

/// Build and setup the system tray
pub fn setup_tray(app: &AppHandle) -> tauri::Result<()> {
    // Create tray menu
    let show_hide = MenuItem::with_id(app, ids::SHOW_HIDE, "Show Moltzer", true, None::<&str>)?;
    let new_conv = MenuItem::with_id(app, ids::NEW_CONVERSATION, "New Conversation", true, Some("CmdOrCtrl+N"))?;
    let quick_ask = MenuItem::with_id(app, ids::QUICK_ASK, "Quick Ask...", true, Some("CmdOrCtrl+Shift+Space"))?;
    let quit = MenuItem::with_id(app, ids::QUIT, "Quit Moltzer", true, Some("CmdOrCtrl+Q"))?;

    let menu = Menu::with_items(app, &[&show_hide, &new_conv, &quick_ask, &quit])?;

    // Load tray icon (use app icon)
    let icon = Image::from_bytes(include_bytes!("../icons/icon.png"))?;

    // Build tray icon
    let _tray = TrayIconBuilder::new()
        .icon(icon)
        .menu(&menu)
        .tooltip("Moltzer - Your AI Assistant")
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| {
            handle_tray_menu_event(app, event.id.as_ref());
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                // Single left click - show/hide main window
                if let Some(window) = tray.app_handle().get_webview_window("main") {
                    if window.is_visible().unwrap_or(false) {
                        let _ = window.hide();
                    } else {
                        let _ = window.show();
                        let _ = window.set_focus();
                    }
                }
            }
        })
        .build(app)?;

    Ok(())
}

/// Handle tray menu events
fn handle_tray_menu_event(app: &AppHandle, event_id: &str) {
    match event_id {
        ids::SHOW_HIDE => {
            if let Some(window) = app.get_webview_window("main") {
                if window.is_visible().unwrap_or(false) {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }
        ids::NEW_CONVERSATION => {
            // Show main window and emit new conversation event
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
            use tauri::Emitter;
            let _ = app.emit("menu:new_conversation", ());
        }
        ids::QUICK_ASK => {
            // Toggle quick ask window
            if let Some(window) = app.get_webview_window("quickinput") {
                if window.is_visible().unwrap_or(false) {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }
        }
        ids::QUIT => {
            std::process::exit(0);
        }
        _ => {}
    }
}
