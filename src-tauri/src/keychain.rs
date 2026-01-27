//! Keychain integration for secure credential storage
//! 
//! Uses the OS-native credential store:
//! - macOS: Keychain
//! - Windows: Credential Manager
//! - Linux: Secret Service (libsecret)

use keyring::Entry;

/// Get a value from the keychain
/// Uses spawn_blocking to prevent UI freezing on macOS
#[tauri::command]
pub async fn keychain_get(service: String, key: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        let entry = Entry::new(&service, &key).map_err(|e| e.to_string())?;
        entry.get_password().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Set a value in the keychain
/// Uses spawn_blocking to prevent UI freezing on macOS
#[tauri::command]
pub async fn keychain_set(
    service: String,
    key: String,
    value: String,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let entry = Entry::new(&service, &key).map_err(|e| e.to_string())?;
        entry.set_password(&value).map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

/// Delete a value from the keychain
/// Uses spawn_blocking to prevent UI freezing on macOS
#[tauri::command]
pub async fn keychain_delete(service: String, key: String) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        let entry = Entry::new(&service, &key).map_err(|e| e.to_string())?;
        entry.delete_credential().map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_keychain_operations() {
        let service = "com.moltzer.client.test".to_string();
        let key = "test-key".to_string();
        let value = "test-value".to_string();

        // Set
        let result = keychain_set(service.clone(), key.clone(), value.clone()).await;
        assert!(result.is_ok(), "Failed to set keychain value");

        // Get
        let result = keychain_get(service.clone(), key.clone()).await;
        assert!(result.is_ok(), "Failed to get keychain value");
        assert_eq!(result.unwrap(), value);

        // Delete
        let result = keychain_delete(service.clone(), key.clone()).await;
        assert!(result.is_ok(), "Failed to delete keychain value");

        // Get after delete should fail
        let result = keychain_get(service, key).await;
        assert!(result.is_err(), "Expected error after delete");
    }
}
