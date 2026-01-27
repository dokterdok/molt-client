//! Gateway WebSocket client for communicating with Clawdbot Gateway
//! 
//! Implements the Clawdbot Gateway WebSocket protocol v3:
//! - Frame types: req, res, event
//! - Connect handshake with protocol negotiation
//! - Chat streaming via chat.send method

use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::{mpsc, oneshot, Mutex, RwLock};
use tokio_tungstenite::{connect_async, tungstenite::Message as WsMessage};
use std::collections::HashMap;
use std::sync::Arc;

/// Current protocol version
const PROTOCOL_VERSION: i32 = 3;

/// Connection state managed by Tauri
pub struct GatewayState {
    connected: RwLock<bool>,
    sender: Mutex<Option<mpsc::Sender<String>>>,
    /// Pending request responses, keyed by request ID
    pending_requests: Mutex<HashMap<String, oneshot::Sender<GatewayResponse>>>,
    /// Store token for reconnection
    stored_token: Mutex<Option<String>>,
}

impl Default for GatewayState {
    fn default() -> Self {
        Self {
            connected: RwLock::new(false),
            sender: Mutex::new(None),
            pending_requests: Mutex::new(HashMap::new()),
            stored_token: Mutex::new(None),
        }
    }
}

/// Request to send to Gateway (Clawdbot Protocol v3)
#[derive(Debug, Serialize)]
struct GatewayRequest {
    #[serde(rename = "type")]
    msg_type: String,  // Always "req"
    id: String,
    method: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    params: Option<serde_json::Value>,
}

impl GatewayRequest {
    fn new(method: &str, params: Option<serde_json::Value>) -> Self {
        Self {
            msg_type: "req".to_string(),
            id: uuid::Uuid::new_v4().to_string(),
            method: method.to_string(),
            params,
        }
    }
}

/// Attachment data for sending files
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AttachmentData {
    pub id: String,
    pub filename: String,
    #[serde(rename = "mimeType")]
    pub mime_type: String,
    pub data: String, // base64 encoded
}

/// Chat message parameters
#[derive(Debug, Serialize, Deserialize)]
pub struct ChatParams {
    pub message: String,
    pub session_key: Option<String>,
    pub model: Option<String>,
    pub thinking: Option<String>,
    #[serde(default)]
    pub attachments: Vec<AttachmentData>,
}

/// Stream chunk from Gateway (chat event)
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct ChatEvent {
    #[serde(rename = "runId")]
    pub run_id: Option<String>,
    #[serde(rename = "sessionKey")]
    pub session_key: Option<String>,
    pub seq: Option<i32>,
    pub state: Option<String>,  // "delta" | "final" | "aborted" | "error"
    pub message: Option<serde_json::Value>,
    #[serde(rename = "errorMessage")]
    pub error_message: Option<String>,
}

/// Gateway frame wrapper for parsing incoming messages
#[derive(Debug, Deserialize, Clone)]
pub struct GatewayFrame {
    #[serde(rename = "type")]
    pub frame_type: String,  // "req", "res", or "event"
    // Response fields
    pub id: Option<String>,
    pub ok: Option<bool>,
    pub payload: Option<serde_json::Value>,
    pub error: Option<GatewayError>,
    // Event fields
    pub event: Option<String>,
    #[allow(dead_code)]
    pub seq: Option<i32>,  // Used by protocol, kept for completeness
}

/// Response from Gateway (Clawdbot Protocol v3)
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GatewayResponse {
    #[serde(rename = "type")]
    pub msg_type: Option<String>,
    pub id: Option<String>,
    pub ok: Option<bool>,
    pub payload: Option<serde_json::Value>,
    pub error: Option<GatewayError>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GatewayError {
    pub code: String,  // String in Clawdbot protocol
    pub message: String,
    pub details: Option<serde_json::Value>,
    pub retryable: Option<bool>,
}

/// Result of a connection attempt with protocol info
#[derive(Debug, Serialize, Clone)]
pub struct ConnectResult {
    pub success: bool,
    pub used_url: String,
    pub protocol_switched: bool,
}

/// Connect parameters for Clawdbot Gateway handshake
#[derive(Debug, Serialize)]
struct ConnectParams {
    #[serde(rename = "minProtocol")]
    min_protocol: i32,
    #[serde(rename = "maxProtocol")]
    max_protocol: i32,
    client: ClientInfo,
    role: String,
    scopes: Vec<String>,
    caps: Vec<String>,
    commands: Vec<String>,
    permissions: serde_json::Value,
    auth: AuthInfo,
    locale: String,
    #[serde(rename = "userAgent")]
    user_agent: String,
}

#[derive(Debug, Serialize)]
struct ClientInfo {
    id: String,
    version: String,
    platform: String,
    mode: String,
}

#[derive(Debug, Serialize)]
struct AuthInfo {
    token: String,
}

/// Try to connect with protocol fallback (ws:// <-> wss://) with timeout
async fn try_connect_with_fallback(url: &str) -> Result<(tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>, String, bool), String> {
    // Connection timeout: 8 seconds per attempt (reasonable for local + remote)
    let timeout_duration = std::time::Duration::from_secs(8);
    
    // First, try the URL as provided
    let first_attempt = tokio::time::timeout(timeout_duration, connect_async(url)).await;
    
    match first_attempt {
        Ok(Ok((stream, _))) => return Ok((stream, url.to_string(), false)),
        Ok(Err(first_err)) => {
            // Connection failed, try alternate protocol
            let alternate_url = if url.starts_with("ws://") {
                url.replacen("ws://", "wss://", 1)
            } else if url.starts_with("wss://") {
                url.replacen("wss://", "ws://", 1)
            } else {
                // Not a WebSocket URL, can't switch protocol
                return Err(format!("Connection failed: {}", first_err));
            };
            
            // Try alternate protocol with timeout
            let second_attempt = tokio::time::timeout(timeout_duration, connect_async(&alternate_url)).await;
            
            match second_attempt {
                Ok(Ok((stream, _))) => Ok((stream, alternate_url, true)),
                Ok(Err(_)) => {
                    // Both failed, return user-friendly error
                    Err(format!("Unable to connect to Gateway. Please check:\n• Gateway is running\n• URL is correct ({})\n• Network connection is active", url))
                }
                Err(_) => {
                    // Timeout on second attempt
                    Err(format!("Connection timeout. Gateway at {} is not responding.", alternate_url))
                }
            }
        }
        Err(_) => {
            // Timeout on first attempt, try alternate anyway
            let alternate_url = if url.starts_with("ws://") {
                url.replacen("ws://", "wss://", 1)
            } else if url.starts_with("wss://") {
                url.replacen("wss://", "ws://", 1)
            } else {
                return Err(format!("Connection timeout. Gateway at {} is not responding.", url));
            };
            
            let second_attempt = tokio::time::timeout(timeout_duration, connect_async(&alternate_url)).await;
            
            match second_attempt {
                Ok(Ok((stream, _))) => Ok((stream, alternate_url, true)),
                _ => Err(format!("Connection timeout. Gateway is not responding after {} seconds.", timeout_duration.as_secs() * 2))
            }
        }
    }
}

/// Get platform string for connect handshake
fn get_platform() -> String {
    #[cfg(target_os = "windows")]
    return "windows".to_string();
    #[cfg(target_os = "macos")]
    return "macos".to_string();
    #[cfg(target_os = "linux")]
    return "linux".to_string();
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    return "unknown".to_string();
}

/// Connect to Clawdbot Gateway
#[tauri::command]
pub async fn connect(
    app: AppHandle,
    state: State<'_, GatewayState>,
    url: String,
    token: String,
) -> Result<ConnectResult, String> {
    // Store token for later use
    *state.stored_token.lock().await = Some(token.clone());
    
    // Connect without token in URL (token sent in handshake)
    let (ws_stream, used_url, protocol_switched) = try_connect_with_fallback(&url).await?;

    let (mut write, mut read) = ws_stream.split();

    // Create channel for sending messages
    let (tx, mut rx) = mpsc::channel::<String>(100);

    // Store sender
    *state.sender.lock().await = Some(tx.clone());
    
    // Clone state for async tasks
    let pending_requests = Arc::new(Mutex::new(HashMap::<String, oneshot::Sender<GatewayResponse>>::new()));
    let pending_clone = pending_requests.clone();

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

    // Wait for connect.challenge event, then send connect request
    let _connected = false;  // Will be set true when hello-ok received
    let app_clone = app.clone();
    let tx_clone = tx.clone();
    let token_clone = token.clone();
    
    // Process messages in a loop
    let pending_for_handler = pending_clone.clone();
    tokio::spawn(async move {
        while let Some(msg) = read.next().await {
            match msg {
                Ok(WsMessage::Text(text)) => {
                    let text_str = text.to_string();
                    
                    // Try to parse as a Gateway frame
                    if let Ok(frame) = serde_json::from_str::<GatewayFrame>(&text_str) {
                        match frame.frame_type.as_str() {
                            "event" => {
                                if let Some(event_name) = &frame.event {
                                    match event_name.as_str() {
                                        "connect.challenge" => {
                                            // Send connect request
                                            let connect_req = GatewayRequest {
                                                msg_type: "req".to_string(),
                                                id: uuid::Uuid::new_v4().to_string(),
                                                method: "connect".to_string(),
                                                params: Some(serde_json::to_value(ConnectParams {
                                                    min_protocol: PROTOCOL_VERSION,
                                                    max_protocol: PROTOCOL_VERSION,
                                                    client: ClientInfo {
                                                        id: "molt".to_string(),
                                                        version: env!("CARGO_PKG_VERSION").to_string(),
                                                        platform: get_platform(),
                                                        mode: "operator".to_string(),
                                                    },
                                                    role: "operator".to_string(),
                                                    scopes: vec![
                                                        "operator.read".to_string(),
                                                        "operator.write".to_string(),
                                                    ],
                                                    caps: vec![],
                                                    commands: vec![],
                                                    permissions: serde_json::json!({}),
                                                    auth: AuthInfo {
                                                        token: token_clone.clone(),
                                                    },
                                                    locale: "en-US".to_string(),
                                                    user_agent: format!("molt/{}", env!("CARGO_PKG_VERSION")),
                                                }).unwrap()),
                                            };
                                            
                                            if let Ok(json) = serde_json::to_string(&connect_req) {
                                                let _ = tx_clone.send(json).await;
                                            }
                                        }
                                        "chat" => {
                                            // Parse chat event
                                            if let Some(payload) = frame.payload {
                                                if let Ok(chat_event) = serde_json::from_value::<ChatEvent>(payload) {
                                                    match chat_event.state.as_deref() {
                                                        Some("delta") => {
                                                            // Extract content from message
                                                            if let Some(msg) = &chat_event.message {
                                                                if let Some(content) = msg.get("content").and_then(|c| c.as_str()) {
                                                                    let _ = app_clone.emit("gateway:stream", content.to_string());
                                                                }
                                                            }
                                                        }
                                                        Some("final") => {
                                                            let _ = app_clone.emit("gateway:complete", ());
                                                        }
                                                        Some("aborted") => {
                                                            let _ = app_clone.emit("gateway:aborted", ());
                                                        }
                                                        Some("error") => {
                                                            let error_msg = chat_event.error_message.unwrap_or_else(|| "Unknown error".to_string());
                                                            let _ = app_clone.emit("gateway:error", error_msg);
                                                        }
                                                        _ => {}
                                                    }
                                                }
                                            }
                                        }
                                        "tick" => {
                                            // Keepalive - no action needed
                                        }
                                        "shutdown" => {
                                            let _ = app_clone.emit("gateway:disconnected", ());
                                        }
                                        _ => {
                                            // Unknown event
                                            let _ = app_clone.emit("gateway:event", text_str.clone());
                                        }
                                    }
                                }
                            }
                            "res" => {
                                // Response to a request
                                let response = GatewayResponse {
                                    msg_type: Some(frame.frame_type.clone()),
                                    id: frame.id.clone(),
                                    ok: frame.ok,
                                    payload: frame.payload.clone(),
                                    error: frame.error.clone(),
                                };
                                
                                // Check if this is hello-ok (connect response)
                                if let Some(payload) = &frame.payload {
                                    if payload.get("type").and_then(|t| t.as_str()) == Some("hello-ok") {
                                        let _ = app_clone.emit("gateway:connected", ());
                                    }
                                }
                                
                                // Route to pending request if any
                                if let Some(req_id) = &frame.id {
                                    let mut pending = pending_for_handler.lock().await;
                                    if let Some(sender) = pending.remove(req_id) {
                                        let _ = sender.send(response.clone());
                                    }
                                }
                                
                                // Also emit for general listeners
                                let _ = app_clone.emit("gateway:response", response);
                            }
                            _ => {
                                // Unknown frame type
                                let _ = app_clone.emit("gateway:message", text_str.clone());
                            }
                        }
                    } else {
                        // Failed to parse as frame, emit raw
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

    // Mark as connected (actual confirmation comes from hello-ok event)
    *state.connected.write().await = true;

    Ok(ConnectResult {
        success: true,
        used_url,
        protocol_switched,
    })
}

/// Disconnect from Gateway
#[tauri::command]
pub async fn disconnect(state: State<'_, GatewayState>) -> Result<(), String> {
    *state.sender.lock().await = None;
    *state.connected.write().await = false;
    *state.pending_requests.lock().await = HashMap::new();
    Ok(())
}

/// Image MIME types that should use input_image
const IMAGE_MIMES: &[&str] = &["image/png", "image/jpeg", "image/gif", "image/webp"];

/// Build input items from message and attachments for OpenResponses format
fn build_input_items(message: &str, attachments: &[AttachmentData]) -> serde_json::Value {
    let mut items: Vec<serde_json::Value> = Vec::new();
    
    // Add attachments first (before the text message)
    for attachment in attachments {
        if IMAGE_MIMES.contains(&attachment.mime_type.as_str()) {
            // Image attachment - use input_image type
            items.push(serde_json::json!({
                "type": "input_image",
                "source": {
                    "type": "base64",
                    "media_type": attachment.mime_type,
                    "data": attachment.data
                }
            }));
        } else {
            // File attachment - use input_file type
            items.push(serde_json::json!({
                "type": "input_file",
                "source": {
                    "type": "base64",
                    "media_type": attachment.mime_type,
                    "data": attachment.data,
                    "filename": attachment.filename
                }
            }));
        }
    }
    
    // Add the text message last (or add empty message if only attachments)
    items.push(serde_json::json!({
        "type": "message",
        "role": "user",
        "content": if message.is_empty() && !attachments.is_empty() { 
            "Please analyze the attached file(s)." 
        } else { 
            message 
        }
    }));
    
    serde_json::Value::Array(items)
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
    let idempotency_key = uuid::Uuid::new_v4().to_string();

    // Build request params - use input items format if there are attachments
    let request_params = if params.attachments.is_empty() {
        serde_json::json!({
            "message": params.message,
            "sessionKey": params.session_key,
            "thinking": params.thinking,
            "idempotencyKey": idempotency_key,
        })
    } else {
        // Use OpenResponses input format for attachments
        serde_json::json!({
            "input": build_input_items(&params.message, &params.attachments),
            "sessionKey": params.session_key,
            "thinking": params.thinking,
            "idempotencyKey": idempotency_key,
        })
    };

    let request = GatewayRequest {
        msg_type: "req".to_string(),
        id: request_id.clone(),
        method: "chat.send".to_string(),
        params: Some(request_params),
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
    #[serde(rename = "contextWindow")]
    pub context_window: Option<i32>,
    pub reasoning: Option<bool>,
}

/// Request available models from Gateway
#[tauri::command]
pub async fn get_models(
    _app: AppHandle,
    state: State<'_, GatewayState>,
) -> Result<Vec<ModelInfo>, String> {
    let sender_guard = state.sender.lock().await;
    let sender = sender_guard.as_ref().ok_or("Not connected to Gateway")?;

    // Create request for models
    let request = GatewayRequest::new("models.list", Some(serde_json::json!({})));
    let request_id = request.id.clone();

    // Create oneshot channel for response
    let (response_tx, response_rx) = oneshot::channel();
    
    // Register pending request
    {
        let mut pending = state.pending_requests.lock().await;
        pending.insert(request_id.clone(), response_tx);
    }

    // Send request
    let json = serde_json::to_string(&request).map_err(|e| e.to_string())?;
    sender.send(json).await.map_err(|e| e.to_string())?;
    
    // Drop the sender lock so responses can be processed
    drop(sender_guard);

    // Wait for response with timeout
    match tokio::time::timeout(
        std::time::Duration::from_secs(10),
        response_rx
    ).await {
        Ok(Ok(response)) => {
            if response.ok == Some(true) {
                if let Some(payload) = response.payload {
                    if let Some(models_val) = payload.get("models") {
                        if let Ok(models) = serde_json::from_value::<Vec<ModelInfo>>(models_val.clone()) {
                            return Ok(models);
                        }
                    }
                }
            } else if let Some(error) = response.error {
                return Err(format!("Gateway error: {}", error.message));
            }
            // Fallback if parsing failed
            Ok(get_fallback_models())
        }
        Ok(Err(_)) => {
            // Channel closed, remove from pending
            state.pending_requests.lock().await.remove(&request_id);
            Ok(get_fallback_models())
        }
        Err(_) => {
            // Timeout, remove from pending and return fallback
            state.pending_requests.lock().await.remove(&request_id);
            Ok(get_fallback_models())
        }
    }
}

/// Fallback models if Gateway doesn't respond
fn get_fallback_models() -> Vec<ModelInfo> {
    vec![
        ModelInfo {
            id: "anthropic/claude-sonnet-4-5".to_string(),
            name: "Claude Sonnet 4.5".to_string(),
            provider: "anthropic".to_string(),
            is_default: true,
            context_window: Some(200000),
            reasoning: Some(false),
        },
        ModelInfo {
            id: "anthropic/claude-opus-4-5".to_string(),
            name: "Claude Opus 4.5".to_string(),
            provider: "anthropic".to_string(),
            is_default: false,
            context_window: Some(200000),
            reasoning: Some(true),
        },
        ModelInfo {
            id: "anthropic/claude-sonnet-3-5".to_string(),
            name: "Claude Sonnet 3.5".to_string(),
            provider: "anthropic".to_string(),
            is_default: false,
            context_window: Some(200000),
            reasoning: Some(false),
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_gateway_request_serialization() {
        let request = GatewayRequest {
            msg_type: "req".to_string(),
            id: "test-123".to_string(),
            method: "chat.send".to_string(),
            params: Some(serde_json::json!({
                "message": "Hello, world!",
                "sessionKey": "session-123",
                "idempotencyKey": "idem-456",
            })),
        };

        let json = serde_json::to_string(&request).unwrap();
        assert!(json.contains(r#""type":"req""#));
        assert!(json.contains("test-123"));
        assert!(json.contains("chat.send"));
        assert!(json.contains("Hello, world!"));
        assert!(json.contains("idempotencyKey"));
    }

    #[test]
    fn test_connect_params_serialization() {
        let params = ConnectParams {
            min_protocol: 3,
            max_protocol: 3,
            client: ClientInfo {
                id: "molt".to_string(),
                version: "0.1.0".to_string(),
                platform: "windows".to_string(),
                mode: "operator".to_string(),
            },
            role: "operator".to_string(),
            scopes: vec!["operator.read".to_string()],
            caps: vec![],
            commands: vec![],
            permissions: serde_json::json!({}),
            auth: AuthInfo {
                token: "test-token".to_string(),
            },
            locale: "en-US".to_string(),
            user_agent: "molt/0.1.0".to_string(),
        };

        let json = serde_json::to_string(&params).unwrap();
        assert!(json.contains("minProtocol"));
        assert!(json.contains("maxProtocol"));
        assert!(json.contains("operator"));
    }

    #[test]
    fn test_gateway_frame_response_parsing() {
        let json = r#"{"type":"res","id":"req-123","ok":true,"payload":{"type":"hello-ok","protocol":3}}"#;
        let frame: GatewayFrame = serde_json::from_str(json).unwrap();
        
        assert_eq!(frame.frame_type, "res");
        assert_eq!(frame.id, Some("req-123".to_string()));
        assert_eq!(frame.ok, Some(true));
        assert!(frame.payload.is_some());
    }

    #[test]
    fn test_gateway_frame_event_parsing() {
        let json = r#"{"type":"event","event":"chat","payload":{"runId":"run-1","state":"delta","message":{"content":"Hello"}}}"#;
        let frame: GatewayFrame = serde_json::from_str(json).unwrap();
        
        assert_eq!(frame.frame_type, "event");
        assert_eq!(frame.event, Some("chat".to_string()));
        assert!(frame.payload.is_some());
    }

    #[test]
    fn test_chat_event_parsing() {
        let json = r#"{"runId":"run-123","sessionKey":"sess-456","seq":0,"state":"delta","message":{"content":"Hello"}}"#;
        let event: ChatEvent = serde_json::from_str(json).unwrap();
        
        assert_eq!(event.run_id, Some("run-123".to_string()));
        assert_eq!(event.session_key, Some("sess-456".to_string()));
        assert_eq!(event.state, Some("delta".to_string()));
    }

    #[test]
    fn test_gateway_error_string_code() {
        let json = r#"{"code":"UNAUTHORIZED","message":"Invalid token"}"#;
        let error: GatewayError = serde_json::from_str(json).unwrap();
        
        assert_eq!(error.code, "UNAUTHORIZED");
        assert_eq!(error.message, "Invalid token");
    }

    #[test]
    fn test_models_list_request() {
        let request = GatewayRequest::new("models.list", Some(serde_json::json!({})));
        let json = serde_json::to_string(&request).unwrap();
        
        assert!(json.contains(r#""type":"req""#));
        assert!(json.contains("models.list"));
    }

    #[tokio::test]
    async fn test_gateway_state_default() {
        let state = GatewayState::default();
        
        // Should start disconnected
        assert!(!*state.connected.read().await);
        
        // Should have no sender
        assert!(state.sender.lock().await.is_none());
        
        // Should have no pending requests
        assert!(state.pending_requests.lock().await.is_empty());
    }
}
