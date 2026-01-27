//! Gateway WebSocket client for communicating with Moltbot Gateway

use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::{mpsc, Mutex, RwLock};
use tokio_tungstenite::{connect_async, tungstenite::Message as WsMessage};

/// Connection state managed by Tauri
#[derive(Default)]
pub struct GatewayState {
    connected: RwLock<bool>,
    sender: Mutex<Option<mpsc::Sender<String>>>,
}

/// Request to send to Gateway
#[derive(Debug, Serialize)]
struct GatewayRequest {
    id: String,
    method: String,
    params: serde_json::Value,
}

/// Chat message parameters
#[derive(Debug, Serialize, Deserialize)]
pub struct ChatParams {
    pub message: String,
    pub session_key: Option<String>,
    pub model: Option<String>,
    pub thinking: Option<String>,
}

/// Stream chunk from Gateway
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct StreamChunk {
    #[serde(rename = "requestId")]
    pub request_id: Option<String>,
    pub content: Option<String>,
    pub done: Option<bool>,
    #[serde(rename = "type")]
    pub msg_type: Option<String>,
}

/// Response from Gateway
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GatewayResponse {
    pub id: Option<String>,
    pub result: Option<serde_json::Value>,
    pub error: Option<GatewayError>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GatewayError {
    pub code: i32,
    pub message: String,
}

/// Connect to Moltbot Gateway
#[tauri::command]
pub async fn connect(
    app: AppHandle,
    state: State<'_, GatewayState>,
    url: String,
    token: String,
) -> Result<bool, String> {
    // Build WebSocket URL with auth
    let ws_url = format!("{}?token={}", url, token);

    // Connect to WebSocket (pass the string directly)
    let (ws_stream, _) = connect_async(&ws_url)
        .await
        .map_err(|e| format!("Failed to connect: {}", e))?;

    let (mut write, mut read) = ws_stream.split();

    // Create channel for sending messages
    let (tx, mut rx) = mpsc::channel::<String>(100);

    // Store sender
    *state.sender.lock().await = Some(tx);
    *state.connected.write().await = true;

    // Emit connection event
    let _ = app.emit("gateway:connected", ());

    // Spawn task to handle outgoing messages
    let app_clone = app.clone();
    tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if let Err(e) = write.send(WsMessage::Text(msg.into())).await {
                eprintln!("Failed to send message: {}", e);
                let _ = app_clone.emit("gateway:error", e.to_string());
                break;
            }
        }
    });

    // Spawn task to handle incoming messages
    let app_clone = app.clone();
    tokio::spawn(async move {
        while let Some(msg) = read.next().await {
            match msg {
                Ok(WsMessage::Text(text)) => {
                    let text_str = text.to_string();
                    // Try to parse as stream chunk or response
                    if let Ok(chunk) = serde_json::from_str::<StreamChunk>(&text_str) {
                        if let Some(content) = &chunk.content {
                            let _ = app_clone.emit("gateway:stream", content.clone());
                        }
                        if chunk.done == Some(true) {
                            let _ = app_clone.emit("gateway:complete", ());
                        }
                    } else if let Ok(response) = serde_json::from_str::<GatewayResponse>(&text_str) {
                        let _ = app_clone.emit("gateway:response", response);
                    } else {
                        // Raw message
                        let _ = app_clone.emit("gateway:message", text_str);
                    }
                }
                Ok(WsMessage::Close(_)) => {
                    let _ = app_clone.emit("gateway:disconnected", ());
                    break;
                }
                Err(e) => {
                    let _ = app_clone.emit("gateway:error", e.to_string());
                    break;
                }
                _ => {}
            }
        }
    });

    Ok(true)
}

/// Disconnect from Gateway
#[tauri::command]
pub async fn disconnect(state: State<'_, GatewayState>) -> Result<(), String> {
    *state.sender.lock().await = None;
    *state.connected.write().await = false;
    Ok(())
}

/// Send a chat message to Gateway
#[tauri::command]
pub async fn send_message(
    state: State<'_, GatewayState>,
    params: ChatParams,
) -> Result<String, String> {
    let sender = state.sender.lock().await;
    let sender = sender.as_ref().ok_or("Not connected")?;

    let request_id = uuid::Uuid::new_v4().to_string();

    let request = GatewayRequest {
        id: request_id.clone(),
        method: "chat.send".to_string(),
        params: serde_json::json!({
            "message": params.message,
            "sessionKey": params.session_key,
            "model": params.model,
            "thinking": params.thinking,
        }),
    };

    let json = serde_json::to_string(&request).map_err(|e| e.to_string())?;
    sender.send(json).await.map_err(|e| e.to_string())?;

    Ok(request_id)
}

/// Get connection status
#[tauri::command]
pub async fn get_connection_status(state: State<'_, GatewayState>) -> Result<bool, String> {
    Ok(*state.connected.read().await)
}

/// Model info returned from Gateway
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub provider: String,
    #[serde(default)]
    pub is_default: bool,
}

/// Request available models from Gateway
#[tauri::command]
pub async fn get_models(
    state: State<'_, GatewayState>,
) -> Result<Vec<ModelInfo>, String> {
    let sender = state.sender.lock().await;
    let sender = sender.as_ref().ok_or("Not connected to Gateway")?;

    // Create request for models
    let request_id = uuid::Uuid::new_v4().to_string();
    let request = GatewayRequest {
        id: request_id.clone(),
        method: "models.list".to_string(),
        params: serde_json::json!({}),
    };

    let json = serde_json::to_string(&request).map_err(|e| e.to_string())?;
    
    // Send request to Gateway
    sender.send(json).await.map_err(|e| e.to_string())?;

    // TODO: Add response channel to wait for actual model list
    // For now, return fallback models - Gateway will stream the actual list
    Ok(get_fallback_models())
}

/// Fallback models if Gateway doesn't respond
fn get_fallback_models() -> Vec<ModelInfo> {
    vec![
        ModelInfo {
            id: "anthropic/claude-sonnet-4-5".to_string(),
            name: "Claude Sonnet 4.5".to_string(),
            provider: "anthropic".to_string(),
            is_default: true,
        },
        ModelInfo {
            id: "anthropic/claude-opus-4-5".to_string(),
            name: "Claude Opus 4.5".to_string(),
            provider: "anthropic".to_string(),
            is_default: false,
        },
        ModelInfo {
            id: "anthropic/claude-sonnet-3-5".to_string(),
            name: "Claude Sonnet 3.5".to_string(),
            provider: "anthropic".to_string(),
            is_default: false,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gateway_request_serialization() {
        let request = GatewayRequest {
            id: "test-123".to_string(),
            method: "chat.send".to_string(),
            params: serde_json::json!({
                "message": "Hello, world!",
                "model": "anthropic/claude-sonnet-4-5",
            }),
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains("test-123"));
        assert!(json.contains("chat.send"));
        assert!(json.contains("Hello, world!"));
    }

    #[test]
    fn test_chat_params_serialization() {
        let params = ChatParams {
            message: "Test message".to_string(),
            session_key: Some("session-123".to_string()),
            model: Some("anthropic/claude-opus-4-5".to_string()),
            thinking: Some("low".to_string()),
        };

        let json = serde_json::to_string(&params).unwrap();
        assert!(json.contains("Test message"));
        assert!(json.contains("session-123"));
    }

    #[test]
    fn test_stream_chunk_deserialization() {
        let json = r#"{"requestId":"req-123","content":"Hello","done":false,"type":"stream"}"#;
        let chunk: StreamChunk = serde_json::from_str(json).unwrap();
        
        assert_eq!(chunk.request_id, Some("req-123".to_string()));
        assert_eq!(chunk.content, Some("Hello".to_string()));
        assert_eq!(chunk.done, Some(false));
        assert_eq!(chunk.msg_type, Some("stream".to_string()));
    }

    #[test]
    fn test_stream_chunk_done() {
        let json = r#"{"done":true}"#;
        let chunk: StreamChunk = serde_json::from_str(json).unwrap();
        
        assert_eq!(chunk.done, Some(true));
        assert!(chunk.content.is_none());
    }

    #[test]
    fn test_gateway_response_success() {
        let json = r#"{"id":"req-123","result":{"status":"ok"}}"#;
        let response: GatewayResponse = serde_json::from_str(json).unwrap();
        
        assert_eq!(response.id, Some("req-123".to_string()));
        assert!(response.result.is_some());
        assert!(response.error.is_none());
    }

    #[test]
    fn test_gateway_response_error() {
        let json = r#"{"id":"req-123","error":{"code":-1,"message":"Test error"}}"#;
        let response: GatewayResponse = serde_json::from_str(json).unwrap();
        
        assert_eq!(response.id, Some("req-123".to_string()));
        assert!(response.result.is_none());
        assert!(response.error.is_some());
        
        let error = response.error.unwrap();
        assert_eq!(error.code, -1);
        assert_eq!(error.message, "Test error");
    }

    #[tokio::test]
    async fn test_gateway_state_default() {
        let state = GatewayState::default();
        
        // Should start disconnected
        assert!(!*state.connected.read().await);
        
        // Should have no sender
        assert!(state.sender.lock().await.is_none());
    }

    #[tokio::test]
    async fn test_gateway_state_connection_tracking() {
        let state = GatewayState::default();
        
        // Start disconnected
        assert!(!*state.connected.read().await);
        
        // Simulate connection
        *state.connected.write().await = true;
        assert!(*state.connected.read().await);
        
        // Simulate disconnection
        *state.connected.write().await = false;
        assert!(!*state.connected.read().await);
    }
}
