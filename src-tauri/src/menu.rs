//! Native menu bar implementation
//!
//! Provides proper Mac-style menus with standard shortcuts:
//! - Moltz menu: About, Preferences, Quit
//! - File: New Conversation, Close
//! - Edit: Cut, Copy, Paste, Select All
//! - View: Toggle Sidebar, Zoom
//! - Conversation: Search, Export
//! - Window: Minimize, Zoom, standard window controls
//! - Help: Documentation, Support

use tauri::{
    menu::{
        AboutMetadataBuilder, Menu, MenuBuilder, MenuItemBuilder, PredefinedMenuItem,
        SubmenuBuilder,
    },
    AppHandle, Emitter, Manager, Wry,
};

/// Custom menu item IDs
pub mod ids {
    pub const NEW_CONVERSATION: &str = "new_conversation";
    pub const CLOSE_CONVERSATION: &str = "close_conversation";
    pub const TOGGLE_SIDEBAR: &str = "toggle_sidebar";
    pub const SEARCH: &str = "search";
    pub const EXPORT: &str = "export";
    pub const PREFERENCES: &str = "preferences";
    pub const QUICK_ASK: &str = "quick_ask";
}

/// Build the application menu
#[allow(dead_code)] // May be used when custom menus are enabled
pub fn build_menu(app: &AppHandle) -> tauri::Result<Menu<Wry>> {
    let about_metadata = AboutMetadataBuilder::new()
        .name(Some("Moltz"))
        .version(Some(env!("CARGO_PKG_VERSION")))
        .copyright(Some("© 2026 Moltz"))
        .comments(Some("Your private AI assistant"))
        .build();

    // App menu (macOS only shows this as "Moltz")
    let app_menu = SubmenuBuilder::new(app, "Moltz")
        .item(&PredefinedMenuItem::about(
            app,
            Some("About Moltz"),
            Some(about_metadata),
        )?)
        .separator()
        .item(
            &MenuItemBuilder::with_id(ids::PREFERENCES, "Preferences...")
                .accelerator("CmdOrCtrl+,")
                .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::services(app, Some("Services"))?)
        .separator()
        .item(&PredefinedMenuItem::hide(app, Some("Hide Moltz"))?)
        .item(&PredefinedMenuItem::hide_others(app, Some("Hide Others"))?)
        .item(&PredefinedMenuItem::show_all(app, Some("Show All"))?)
        .separator()
        .item(&PredefinedMenuItem::quit(app, Some("Quit Moltz"))?)
        .build()?;

    // File menu
    let file_menu = SubmenuBuilder::new(app, "File")
        .item(
            &MenuItemBuilder::with_id(ids::NEW_CONVERSATION, "New Conversation")
                .accelerator("CmdOrCtrl+N")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::QUICK_ASK, "Quick Ask...")
                .accelerator("CmdOrCtrl+Shift+Space")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(ids::CLOSE_CONVERSATION, "Close Conversation")
                .accelerator("CmdOrCtrl+W")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(ids::EXPORT, "Export Conversation...")
                .accelerator("CmdOrCtrl+Shift+E")
                .build(app)?,
        )
        .build()?;

    // Edit menu with standard items
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .item(&PredefinedMenuItem::undo(app, Some("Undo"))?)
        .item(&PredefinedMenuItem::redo(app, Some("Redo"))?)
        .separator()
        .item(&PredefinedMenuItem::cut(app, Some("Cut"))?)
        .item(&PredefinedMenuItem::copy(app, Some("Copy"))?)
        .item(&PredefinedMenuItem::paste(app, Some("Paste"))?)
        .item(&PredefinedMenuItem::select_all(app, Some("Select All"))?)
        .build()?;

    // View menu
    let view_menu = SubmenuBuilder::new(app, "View")
        .item(
            &MenuItemBuilder::with_id(ids::TOGGLE_SIDEBAR, "Toggle Sidebar")
                .accelerator("CmdOrCtrl+\\")
                .build(app)?,
        )
        .separator()
        .item(&PredefinedMenuItem::fullscreen(
            app,
            Some("Enter Full Screen"),
        )?)
        .build()?;

    // Conversation menu
    let conversation_menu = SubmenuBuilder::new(app, "Conversation")
        .item(
            &MenuItemBuilder::with_id(ids::SEARCH, "Search Conversations...")
                .accelerator("CmdOrCtrl+K")
                .build(app)?,
        )
        .build()?;

    // Window menu (macOS standard)
    let window_menu = SubmenuBuilder::with_id(app, tauri::menu::WINDOW_SUBMENU_ID, "Window")
        .item(&PredefinedMenuItem::minimize(app, Some("Minimize"))?)
        .item(&PredefinedMenuItem::maximize(app, Some("Zoom"))?)
        .separator()
        .item(&PredefinedMenuItem::close_window(
            app,
            Some("Close Window"),
        )?)
        .build()?;

    // Help menu
    let help_menu = SubmenuBuilder::with_id(app, tauri::menu::HELP_SUBMENU_ID, "Help")
        .item(&MenuItemBuilder::new("Moltz Documentation").build(app)?)
        .item(&MenuItemBuilder::new("Clawdbot Gateway Setup").build(app)?)
        .separator()
        .item(&MenuItemBuilder::new("Report Issue...").build(app)?)
        .build()?;

    // Build the complete menu
    MenuBuilder::new(app)
        .item(&app_menu)
        .item(&file_menu)
        .item(&edit_menu)
        .item(&view_menu)
        .item(&conversation_menu)
        .item(&window_menu)
        .item(&help_menu)
        .build()
}

/// Handle menu events
pub fn handle_menu_event(app: &AppHandle, event_id: &str) {
    match event_id {
        ids::NEW_CONVERSATION => {
            let _ = app.emit("menu:new_conversation", ());
        }
        ids::CLOSE_CONVERSATION => {
            let _ = app.emit("menu:close_conversation", ());
        }
        ids::TOGGLE_SIDEBAR => {
            let _ = app.emit("menu:toggle_sidebar", ());
        }
        ids::SEARCH => {
            let _ = app.emit("menu:search", ());
        }
        ids::EXPORT => {
            let _ = app.emit("menu:export", ());
        }
        ids::PREFERENCES => {
            let _ = app.emit("menu:preferences", ());
        }
        ids::QUICK_ASK => {
            // Toggle quick ask window
            if let Some(window) = app.get_webview_window("quickinput") {
                let _ = if window.is_visible().unwrap_or(false) {
                    window.hide()
                } else {
                    window.show().and_then(|_| window.set_focus())
                };
            }
        }
        _ => {}
    }
}
