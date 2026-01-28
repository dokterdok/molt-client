//! Gateway WebSocket client for communicating with Clawdbot Gateway
//!
//! Implements the Clawdbot Gateway WebSocket protocol v3 with:
//! - Robust error handling and classification
//! - Automatic reconnection with exponential backoff
//! - Message queuing during reconnection
//! - Health monitoring with ping/pong
//! - Request-level and streaming timeouts

#![allow(dead_code)]

use crate::protocol::{
    calculate_backoff, validate_frame, ConnectionQuality, ConnectionState, GatewayError,
    HealthMetrics, QueuedMessage, RawGatewayError, ValidatedFrame, BACKOFF_INITIAL_MS,
    DEFAULT_PING_INTERVAL_SECS, DEFAULT_PING_TIMEOUT_SECS, DEFAULT_REQUEST_TIMEOUT_SECS,
    DEFAULT_STREAM_TIMEOUT_SECS, MAX_RECONNECT_ATTEMPTS, PROTOCOL_VERSION,
};
use futures_util::{SinkExt, StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, State};
use tokio::sync::{mpsc, oneshot, Mutex, RwLock};
use tokio_tungstenite::{connect_async_tls_with_config, tungstenite::Message as WsMessage, Connector};

// ============================================================================
// State Management
// ============================================================================

/// Internal connection state
struct GatewayStateInner {
    /// Current connection state
    connection_state: RwLock<ConnectionState>,
    /// Channel for sending messages to WebSocket
    sender: Mutex<Option<mpsc::Sender<OutgoingMessage>>>,
    /// Pending request responses, keyed by request ID
    pending_requests: Mutex<HashMap<String, PendingRequest>>,
    /// Stored credentials for reconnection
    stored_credentials: Mutex<Option<StoredCredentials>>,
    /// Message queue for retry during reconnection
    message_queue: Mutex<VecDeque<QueuedMessage>>,
    /// Set of processed message IDs for deduplication
    processed_ids: Mutex<HashSet<String>>,
    /// Health metrics for connection quality
    health_metrics: Mutex<HealthMetrics>,
    /// Flag to signal shutdown
    shutdown: AtomicBool,
    /// Current reconnection attempt number
    reconnect_attempt: AtomicU32,
    /// Active run IDs for streaming timeout tracking
    active_runs: Mutex<HashMap<String, Instant>>,
}

impl Default for GatewayStateInner {
    fn default() -> Self {
        Self {
            connection_state: RwLock::new(ConnectionState::Disconnected),
            sender: Mutex::new(None),
            pending_requests: Mutex::new(HashMap::new()),
            stored_credentials: Mutex::new(None),
            message_queue: Mutex::new(VecDeque::new()),
            processed_ids: Mutex::new(HashSet::new()),
            health_metrics: Mutex::new(HealthMetrics::default()),
            shutdown: AtomicBool::new(false),
            reconnect_attempt: AtomicU32::new(0),
            active_runs: Mutex::new(HashMap::new()),
        }
    }
}

/// Connection state managed by Tauri (wrapper with Arc for sharing)
pub struct GatewayState {
    inner: Arc<GatewayStateInner>,
}

impl Default for GatewayState {
    fn default() -> Self {
        Self {
            inner: Arc::new(GatewayStateInner::default()),
        }
    }
}

/// Stored credentials for reconnection
#[derive(Clone)]
struct StoredCredentials {
    url: String,
    token: String,
}

/// Pending request with timeout
struct PendingRequest {
    sender: oneshot::Sender<GatewayResponse>,
    created_at: Instant,
    timeout: Duration,
}

/// Outgoing message types
enum OutgoingMessage {
    Raw(String),
    Ping,
}

// ============================================================================
// Protocol Types
// ============================================================================

/// Request to send to Gateway (Clawdbot Protocol v3)
#[derive(Debug, Serialize)]
struct GatewayRequest {
    #[serde(rename = "type")]
    msg_type: String,
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
    pub data: String,
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
    pub state: Option<String>,
    pub message: Option<serde_json::Value>,
    #[serde(rename = "errorMessage")]
    pub error_message: Option<String>,
    /// Token usage stats
    pub usage: Option<TokenUsage>,
    #[serde(rename = "stopReason")]
    pub stop_reason: Option<String>,
}

/// Token usage statistics
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct TokenUsage {
    pub input: Option<i32>,
    pub output: Option<i32>,
    #[serde(rename = "totalTokens")]
    pub total_tokens: Option<i32>,
}

/// Response from Gateway
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct GatewayResponse {
    #[serde(rename = "type")]
    pub msg_type: Option<String>,
    pub id: Option<String>,
    pub ok: Option<bool>,
    pub payload: Option<serde_json::Value>,
    pub error: Option<RawGatewayError>,
}

/// Result of a connection attempt
#[derive(Debug, Serialize, Clone)]
pub struct ConnectResult {
    pub success: bool,
    pub used_url: String,
    pub protocol_switched: bool,
}

/// Connect parameters for handshake
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

// ============================================================================
// Connection Helpers
// ============================================================================

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

/// Test TCP connection using socket2 with explicit IPv4 (bypasses potential IPv6 issues on macOS)
async fn test_tcp_connection_ipv4(host: &str, port: u16) -> Result<std::net::SocketAddr, String> {
    let addr_str = format!("{}:{}", host, port);
    log_protocol_error("TCP Test", &format!("Testing IPv4-only connection to {}", addr_str));
    
    let host = host.to_string();
    let result = tokio::task::spawn_blocking(move || {
        use socket2::{Socket, Domain, Type, Protocol};
        use std::net::{SocketAddr, ToSocketAddrs};
        use std::time::Duration;
        
        // Resolve hostname - filter to IPv4 only
        let addrs: Vec<SocketAddr> = format!("{}:{}", host, port)
            .to_socket_addrs()
            .map_err(|e| format!("DNS failed: {}", e))?
            .filter(|a| a.is_ipv4())
            .collect();
        
        if addrs.is_empty() {
            return Err("No IPv4 addresses found".to_string());
        }
        
        log_protocol_error("TCP Test", &format!("Resolved to {} IPv4 addrs: {:?}", addrs.len(), addrs));
        
        // Create IPv4-only socket
        let socket = Socket::new(Domain::IPV4, Type::STREAM, Some(Protocol::TCP))
            .map_err(|e| format!("Socket creation failed: {}", e))?;
        
        // Try first IPv4 address
        let addr = addrs[0];
        log_protocol_error("TCP Test", &format!("Connecting to {} (IPv4 only)...", addr));
        
        let start = std::time::Instant::now();
        match socket.connect_timeout(&addr.into(), Duration::from_secs(10)) {
            Ok(()) => {
                log_protocol_error("TCP Test", &format!("SUCCESS in {:?}", start.elapsed()));
                Ok(addr)
            }
            Err(e) => {
                log_protocol_error("TCP Test", &format!("FAILED after {:?}: {}", start.elapsed(), e));
                Err(format!("Connect failed: {}", e))
            }
        }
    }).await.map_err(|e| format!("Task error: {}", e))?;
    
    result
}

/// Resolve hostname using system DNS - IPv4 only (avoids IPv6 issues on macOS with Tailscale)
async fn resolve_with_system_dns(host: &str, port: u16) -> Result<std::net::SocketAddr, String> {
    let addr_str = format!("{}:{}", host, port);
    log_protocol_error("DNS", &format!("Resolving {} via system DNS (IPv4 only)", addr_str));
    
    let addr_str_clone = addr_str.clone();
    let result = tokio::task::spawn_blocking(move || {
        use std::net::ToSocketAddrs;
        let addrs: Vec<_> = addr_str_clone.to_socket_addrs()
            .map_err(|e| format!("DNS resolution failed: {}", e))?
            .filter(|a| a.is_ipv4())  // IPv4 ONLY
            .collect();
        
        addrs.into_iter().next()
            .ok_or_else(|| "No IPv4 addresses found".to_string())
    }).await.map_err(|e| format!("Task error: {}", e))?;
    
    match &result {
        Ok(addr) => log_protocol_error("DNS", &format!("Resolved to {} (IPv4)", addr)),
        Err(e) => log_protocol_error("DNS", &format!("Failed: {}", e)),
    }
    result
}

/// Create IPv4-only TCP connection and upgrade to WebSocket
/// This bypasses tokio-tungstenite's connection logic which has issues on macOS with Tailscale
async fn connect_with_manual_tcp(url_str: &str) -> Result<
    tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>,
    GatewayError,
> {
    log_protocol_error("Manual TCP", &format!("Connecting to {}", url_str));
    
    let parsed_url = url::Url::parse(url_str).map_err(|e| GatewayError::Network {
        message: format!("Invalid URL: {}", e),
        retryable: false,
        retry_after: None,
    })?;
    
    let host = parsed_url.host_str().ok_or_else(|| GatewayError::Network {
        message: "URL missing host".to_string(),
        retryable: false,
        retry_after: None,
    })?;
    
    let port = parsed_url.port().unwrap_or(if url_str.starts_with("wss://") { 443 } else { 80 });
    let use_tls = url_str.starts_with("wss://");
    
    // Step 1: Create IPv4-only TCP connection using socket2 (blocking operation)
    log_protocol_error("Manual TCP", &format!("Resolving {} (IPv4 only)...", host));
    
    let host_clone = host.to_string();
    let tcp_stream = tokio::task::spawn_blocking(move || {
        use socket2::{Socket, Domain, Type, Protocol};
        use std::net::{SocketAddr, ToSocketAddrs};
        
        // Resolve hostname - IPv4 only
        let addrs: Vec<SocketAddr> = format!("{}:{}", host_clone, port)
            .to_socket_addrs()
            .map_err(|e| format!("DNS resolution failed: {}", e))?
            .filter(|a| a.is_ipv4())
            .collect();
        
        if addrs.is_empty() {
            return Err("No IPv4 addresses found".to_string());
        }
        
        log_protocol_error("Manual TCP", &format!("Resolved to {} IPv4 addr(s): {:?}", addrs.len(), addrs));
        
        // Create IPv4-only socket
        let socket = Socket::new(Domain::IPV4, Type::STREAM, Some(Protocol::TCP))
            .map_err(|e| format!("Socket creation failed: {}", e))?;
        
        // Set socket options
        socket.set_nodelay(true)
            .map_err(|e| format!("Failed to set TCP_NODELAY: {}", e))?;
        
        // Try first IPv4 address
        let addr = addrs[0];
        log_protocol_error("Manual TCP", &format!("Connecting to {} (IPv4)...", addr));
        
        socket.connect_timeout(&addr.into(), Duration::from_secs(10))
            .map_err(|e| format!("TCP connect failed: {}", e))?;
        
        log_protocol_error("Manual TCP", "TCP connection established");
        
        // Convert to std::net::TcpStream
        let std_stream: std::net::TcpStream = socket.into();
        std_stream.set_nonblocking(true)
            .map_err(|e| format!("Failed to set non-blocking: {}", e))?;
        
        Ok(std_stream)
    })
    .await
    .map_err(|e| GatewayError::Network {
        message: format!("Task error: {}", e),
        retryable: true,
        retry_after: Some(Duration::from_millis(BACKOFF_INITIAL_MS)),
    })?
    .map_err(|e| GatewayError::Network {
        message: e,
        retryable: true,
        retry_after: Some(Duration::from_millis(BACKOFF_INITIAL_MS)),
    })?;
    
    // Step 2: Convert to tokio TcpStream
    let tokio_stream = tokio::net::TcpStream::from_std(tcp_stream)
        .map_err(|e| GatewayError::Network {
            message: format!("Failed to convert to tokio stream: {}", e),
            retryable: false,
            retry_after: None,
        })?;
    
    log_protocol_error("Manual TCP", "Converted to tokio stream");
    
    // Step 3: Upgrade to WebSocket
    if use_tls {
        log_protocol_error("Manual TCP", "Performing TLS handshake...");
        
        // Perform TLS handshake using native-tls
        let tls_connector = native_tls::TlsConnector::builder()
            .build()
            .map_err(|e| GatewayError::Network {
                message: format!("TLS connector error: {}", e),
                retryable: false,
                retry_after: None,
            })?;
        
        let connector = tokio_native_tls::TlsConnector::from(tls_connector);
        let tls_stream = connector.connect(host, tokio_stream).await
            .map_err(|e| GatewayError::Network {
                message: format!("TLS handshake failed: {}", e),
                retryable: true,
                retry_after: Some(Duration::from_millis(BACKOFF_INITIAL_MS)),
            })?;
        
        log_protocol_error("Manual TCP", "TLS handshake complete, upgrading to WebSocket...");
        
        // Wrap TLS stream in MaybeTlsStream and upgrade to WebSocket
        let maybe_tls_stream = tokio_tungstenite::MaybeTlsStream::NativeTls(tls_stream);
        let ws_stream = tokio_tungstenite::client_async(url_str, maybe_tls_stream).await
            .map_err(|e| GatewayError::Network {
                message: format!("WebSocket upgrade failed: {}", e),
                retryable: true,
                retry_after: Some(Duration::from_millis(BACKOFF_INITIAL_MS)),
            })?
            .0;
        
        log_protocol_error("Manual TCP", "WebSocket connection established (TLS)");
        Ok(ws_stream)
    } else {
        log_protocol_error("Manual TCP", "Upgrading to WebSocket (plain)...");
        
        // Wrap plain TCP stream in MaybeTlsStream and upgrade to WebSocket
        let maybe_tls_stream = tokio_tungstenite::MaybeTlsStream::Plain(tokio_stream);
        let ws_stream = tokio_tungstenite::client_async(url_str, maybe_tls_stream).await
            .map_err(|e| GatewayError::Network {
                message: format!("WebSocket upgrade failed: {}", e),
                retryable: true,
                retry_after: Some(Duration::from_millis(BACKOFF_INITIAL_MS)),
            })?
            .0;
        
        log_protocol_error("Manual TCP", "WebSocket connection established (plain)");
        Ok(ws_stream)
    }
}

/// Try to connect with protocol fallback (ws:// <-> wss://)
async fn try_connect_with_fallback(
    url: &str,
) -> Result<
    (
        tokio_tungstenite::WebSocketStream<
            tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>,
        >,
        String,
        bool,
    ),
    GatewayError,
> {
    let timeout_duration = Duration::from_secs(30);
    
    // Detect if this is a Tailscale or macOS connection that needs manual TCP handling
    #[cfg(target_os = "macos")]
    let needs_manual_tcp = true; // Always use manual TCP on macOS for reliability
    #[cfg(not(target_os = "macos"))]
    let needs_manual_tcp = url.contains(".ts.net"); // Only for Tailscale on other platforms
    
    if needs_manual_tcp {
        log_protocol_error("Connection Strategy", "Using manual TCP (macOS/Tailscale workaround)");
        
        // Try manual TCP connection with the original URL
        let first_attempt = tokio::time::timeout(
            timeout_duration,
            connect_with_manual_tcp(url)
        ).await;
        
        match first_attempt {
            Ok(Ok(stream)) => {
                log_protocol_error("Manual TCP", "SUCCESS with original URL");
                return Ok((stream, url.to_string(), false));
            }
            Ok(Err(e)) => {
                log_protocol_error("Manual TCP", &format!("Failed: {}", e));
                
                // Try alternate protocol
                let alternate_url = if url.starts_with("ws://") {
                    url.replacen("ws://", "wss://", 1)
                } else if url.starts_with("wss://") {
                    url.replacen("wss://", "ws://", 1)
                } else {
                    return Err(GatewayError::Network {
                        message: format!("Invalid WebSocket URL: {}", url),
                        retryable: false,
                        retry_after: None,
                    });
                };
                
                log_protocol_error("Manual TCP", &format!("Trying alternate protocol: {}", alternate_url));
                
                let second_attempt = tokio::time::timeout(
                    timeout_duration,
                    connect_with_manual_tcp(&alternate_url)
                ).await;
                
                match second_attempt {
                    Ok(Ok(stream)) => {
                        log_protocol_error("Manual TCP", "SUCCESS with alternate protocol");
                        return Ok((stream, alternate_url, true));
                    }
                    Ok(Err(e2)) => {
                        log_protocol_error("Manual TCP", &format!("Alternate also failed: {}", e2));
                        return Err(GatewayError::Network {
                            message: format!(
                                "Unable to connect to Gateway. Tried {} and {}. Last error: {}",
                                url, alternate_url, e2
                            ),
                            retryable: true,
                            retry_after: Some(Duration::from_millis(BACKOFF_INITIAL_MS)),
                        });
                    }
                    Err(_) => {
                        return Err(GatewayError::Timeout {
                            timeout_secs: timeout_duration.as_secs(),
                            request_id: None,
                        });
                    }
                }
            }
            Err(_) => {
                log_protocol_error("Manual TCP", "Timeout on first attempt");
                
                // Try alternate protocol on timeout
                let alternate_url = if url.starts_with("ws://") {
                    url.replacen("ws://", "wss://", 1)
                } else if url.starts_with("wss://") {
                    url.replacen("wss://", "ws://", 1)
                } else {
                    return Err(GatewayError::Timeout {
                        timeout_secs: timeout_duration.as_secs(),
                        request_id: None,
                    });
                };
                
                let second_attempt = tokio::time::timeout(
                    timeout_duration,
                    connect_with_manual_tcp(&alternate_url)
                ).await;
                
                match second_attempt {
                    Ok(Ok(stream)) => Ok((stream, alternate_url, true)),
                    _ => Err(GatewayError::Timeout {
                        timeout_secs: timeout_duration.as_secs() * 2,
                        request_id: None,
                    }),
                }
            }
        }
    } else {
        // Standard tokio-tungstenite connection for non-macOS, non-Tailscale
        log_protocol_error("Connection Strategy", "Using standard tokio-tungstenite");
        
        // Use native-tls connector
        let tls_connector = native_tls::TlsConnector::builder()
            .build()
            .map_err(|e| GatewayError::Network {
                message: format!("TLS connector error: {}", e),
                retryable: false,
                retry_after: None,
            })?;
        let connector = Connector::NativeTls(tls_connector);

        // First, try the URL as provided
        let first_attempt = tokio::time::timeout(
            timeout_duration, 
            connect_async_tls_with_config(url, None, false, Some(connector.clone()))
        ).await;

        match first_attempt {
            Ok(Ok((stream, _))) => Ok((stream, url.to_string(), false)),
            Ok(Err(first_err)) => {
                log_protocol_error("Primary connection failed", &first_err.to_string());

                // Try alternate protocol
                let alternate_url = if url.starts_with("ws://") {
                    url.replacen("ws://", "wss://", 1)
                } else if url.starts_with("wss://") {
                    url.replacen("wss://", "ws://", 1)
                } else {
                    return Err(GatewayError::Network {
                        message: format!("Invalid WebSocket URL: {}", url),
                        retryable: false,
                        retry_after: None,
                    });
                };

                let second_attempt =
                    tokio::time::timeout(
                        timeout_duration, 
                        connect_async_tls_with_config(&alternate_url, None, false, Some(connector.clone()))
                    ).await;

                match second_attempt {
                    Ok(Ok((stream, _))) => Ok((stream, alternate_url, true)),
                    Ok(Err(e)) => {
                        log_protocol_error("Fallback connection failed", &e.to_string());
                        Err(GatewayError::Network {
                            message: format!(
                                "Unable to connect to Gateway. Tried {} and {}",
                                url, alternate_url
                            ),
                            retryable: true,
                            retry_after: Some(Duration::from_millis(BACKOFF_INITIAL_MS)),
                        })
                    }
                    Err(_) => Err(GatewayError::Timeout {
                        timeout_secs: timeout_duration.as_secs(),
                        request_id: None,
                    }),
                }
            }
            Err(_) => {
                // Timeout on first attempt, try alternate
                let alternate_url = if url.starts_with("ws://") {
                    url.replacen("ws://", "wss://", 1)
                } else if url.starts_with("wss://") {
                    url.replacen("wss://", "ws://", 1)
                } else {
                    return Err(GatewayError::Timeout {
                        timeout_secs: timeout_duration.as_secs(),
                        request_id: None,
                    });
                };

                let second_attempt =
                    tokio::time::timeout(
                        timeout_duration, 
                        connect_async_tls_with_config(&alternate_url, None, false, Some(connector))
                    ).await;

                match second_attempt {
                    Ok(Ok((stream, _))) => Ok((stream, alternate_url, true)),
                    _ => Err(GatewayError::Timeout {
                        timeout_secs: timeout_duration.as_secs() * 2,
                        request_id: None,
                    }),
                }
            }
        }
    }
}

/// Log protocol errors for debugging
fn log_protocol_error(context: &str, error: &str) {
    eprintln!("[Gateway Protocol Error] {}: {}", context, error);
}

// ============================================================================
// Image handling
// ============================================================================

const IMAGE_MIMES: &[&str] = &["image/png", "image/jpeg", "image/gif", "image/webp"];

fn build_input_items(message: &str, attachments: &[AttachmentData]) -> serde_json::Value {
    let mut items: Vec<serde_json::Value> = Vec::new();

    for attachment in attachments {
        if IMAGE_MIMES.contains(&attachment.mime_type.as_str()) {
            items.push(serde_json::json!({
                "type": "input_image",
                "source": {
                    "type": "base64",
                    "media_type": attachment.mime_type,
                    "data": attachment.data
                }
            }));
        } else {
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

// ============================================================================
// Tauri Commands
// ============================================================================

/// Connect to Clawdbot Gateway
///
/// Establishes a WebSocket connection to the specified Gateway URL using the provided token.
/// Supports automatic protocol fallback (ws <-> wss) if initial connection fails.
///
/// # Arguments
/// * `app` - Tauri application handle
/// * `state` - Gateway connection state
/// * `url` - WebSocket URL of the Gateway (e.g., "ws://localhost:18789")
/// * `token` - Authentication token for the Gateway
///
/// # Returns
/// * `Ok(ConnectResult)` - Connection successful with details about the connection
/// * `Err(String)` - Connection failed with user-friendly error message
///
/// # Behavior
/// - Automatically retries with protocol fallback if initial connection fails
/// - Stores credentials for automatic reconnection on disconnect
/// - Emits "gateway:state" events to notify frontend of connection status
/// - On retryable errors, starts automatic reconnection loop
#[tauri::command]
pub async fn connect(
    app: AppHandle,
    state: State<'_, GatewayState>,
    url: String,
    token: String,
) -> Result<ConnectResult, String> {
    // Input validation: ensure URL is valid WebSocket URL
    if url.is_empty() {
        return Err("Gateway URL cannot be empty".to_string());
    }
    
    if !url.starts_with("ws://") && !url.starts_with("wss://") {
        return Err("Invalid WebSocket URL: must start with ws:// or wss://".to_string());
    }
    
    // Validate token is not empty (actual validation happens server-side)
    if token.trim().is_empty() {
        return Err("Authentication token cannot be empty".to_string());
    }
    
    // DEBUG: Log what URL we actually received from frontend (without token)
    log_protocol_error("CONNECT CALLED - URL received", &url);
    
    // Reset shutdown flag
    state.inner.shutdown.store(false, Ordering::SeqCst);
    state.inner.reconnect_attempt.store(0, Ordering::SeqCst);

    // Clear old credentials - will only store after successful connection
    *state.inner.stored_credentials.lock().await = None;

    // Update connection state
    *state.inner.connection_state.write().await = ConnectionState::Connecting;
    let _ = app.emit("gateway:state", ConnectionState::Connecting);

    // Perform actual connection
    match connect_internal(&app, state.inner.clone(), &url, &token).await {
        Ok(result) => {
            // Only store credentials AFTER successful connection
            *state.inner.stored_credentials.lock().await = Some(StoredCredentials {
                url: result.used_url.clone(),
                token: token.clone(),
            });

            *state.inner.connection_state.write().await =
                ConnectionState::Connected { session_id: None };
            let _ = app.emit(
                "gateway:state",
                ConnectionState::Connected { session_id: None },
            );

            // Drain message queue
            drain_message_queue(&state.inner).await;

            Ok(result)
        }
        Err(e) => {
            let error_msg = e.user_message();
            *state.inner.connection_state.write().await = ConnectionState::Failed {
                reason: error_msg.clone(),
                can_retry: e.is_retryable(),
            };
            let _ = app.emit(
                "gateway:state",
                ConnectionState::Failed {
                    reason: error_msg.clone(),
                    can_retry: e.is_retryable(),
                },
            );

            // If retryable, start reconnection loop
            if e.is_retryable() && !e.requires_reauth() {
                start_reconnection_loop(app.clone(), state.inner.clone()).await;
            }

            Err(error_msg)
        }
    }
}

/// Internal connection logic
async fn connect_internal(
    app: &AppHandle,
    state_arc: Arc<GatewayStateInner>,
    url: &str,
    token: &str,
) -> Result<ConnectResult, GatewayError> {
    let state = &*state_arc; // Deref for compatibility with existing code
    let (ws_stream, used_url, protocol_switched) = try_connect_with_fallback(url).await?;

    let (mut write, mut read) = ws_stream.split();

    // Create channel for sending messages
    let (tx, mut rx) = mpsc::channel::<OutgoingMessage>(100);

    // Store sender
    *state.sender.lock().await = Some(tx.clone());

    // Reset health metrics
    state.health_metrics.lock().await.reset();
    log_protocol_error("Connection", "Health metrics reset, initializing connection state");

    // CRITICAL-8: Reset shutdown flag for new connection
    state.shutdown.store(false, Ordering::SeqCst);
    log_protocol_error("Connection", "Shutdown flag cleared, ready for new connection");

    // Spawn task to handle outgoing messages
    let app_clone = app.clone();
    tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            let ws_msg = match msg {
                OutgoingMessage::Raw(text) => WsMessage::Text(text.into()),
                OutgoingMessage::Ping => WsMessage::Ping(vec![].into()),
            };
            if let Err(e) = write.send(ws_msg).await {
                log_protocol_error("Failed to send message", &e.to_string());
                let _ = app_clone.emit("gateway:error", e.to_string());
                break;
            }
        }
    });

    // Clone for message handler
    let app_clone = app.clone();
    let tx_clone = tx.clone();
    let token_clone = token.to_string();

    // Create shared state for handler
    let pending_requests: Arc<Mutex<HashMap<String, PendingRequest>>> =
        Arc::new(Mutex::new(HashMap::new()));
    let pending_clone = pending_requests.clone();
    let health_metrics = Arc::new(Mutex::new(HealthMetrics::default()));
    let health_clone = health_metrics.clone();
    let active_runs: Arc<Mutex<HashMap<String, Instant>>> = Arc::new(Mutex::new(HashMap::new()));
    let runs_clone = active_runs.clone();

    // Spawn message handler
    tokio::spawn(async move {
        while let Some(msg) = read.next().await {
            match msg {
                Ok(WsMessage::Text(text)) => {
                    let text_str = text.to_string();

                    // Validate and parse frame
                    match validate_frame(&text_str) {
                        Ok(frame) => {
                            handle_validated_frame(
                                frame,
                                &app_clone,
                                &tx_clone,
                                &token_clone,
                                &pending_clone,
                                &runs_clone,
                            )
                            .await;
                        }
                        Err(e) => {
                            log_protocol_error("Frame validation failed", &e.to_string());
                            // Don't crash on malformed messages, just log
                        }
                    }
                }
                Ok(WsMessage::Pong(_)) => {
                    // Ping response - record latency
                    // Note: We'd need to track ping send time for accurate latency
                    health_clone.lock().await.record_latency(0);
                }
                Ok(WsMessage::Close(frame)) => {
                    let reason = frame
                        .map(|f| f.reason.to_string())
                        .unwrap_or_else(|| "Unknown".to_string());
                    log_protocol_error("WebSocket closed", &reason);
                    let _ = app_clone.emit("gateway:disconnected", reason);
                    break;
                }
                Err(e) => {
                    log_protocol_error("WebSocket error", &e.to_string());
                    let _ = app_clone.emit("gateway:error", e.to_string());
                    break;
                }
                _ => {}
            }
        }
    });

    // Start ping/pong health monitor
    start_health_monitor(app.clone(), tx.clone(), health_metrics.clone()).await;

    // Start streaming timeout monitor
    start_stream_timeout_monitor(app.clone(), active_runs.clone(), state_arc.clone()).await;

    // CRITICAL-1: Start cleanup task for expired pending requests
    start_pending_requests_cleanup(pending_requests.clone(), state_arc.clone()).await;

    Ok(ConnectResult {
        success: true,
        used_url,
        protocol_switched,
    })
}

/// Handle a validated protocol frame
async fn handle_validated_frame(
    frame: ValidatedFrame,
    app: &AppHandle,
    tx: &mpsc::Sender<OutgoingMessage>,
    token: &str,
    pending_requests: &Arc<Mutex<HashMap<String, PendingRequest>>>,
    active_runs: &Arc<Mutex<HashMap<String, Instant>>>,
) {
    match frame {
        ValidatedFrame::Event { event, payload, .. } => {
            match event.as_str() {
                "connect.challenge" => {
                    // Send connect request
                    let connect_params = ConnectParams {
                        min_protocol: PROTOCOL_VERSION,
                        max_protocol: PROTOCOL_VERSION,
                        client: ClientInfo {
                            id: "control-ui".to_string(), // Must be a recognized client type
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
                            token: token.to_string(),
                        },
                        locale: "en-US".to_string(),
                        user_agent: format!("moltzer/{}", env!("CARGO_PKG_VERSION")),
                    };
                    
                    // Safely serialize connect params
                    let params_value = match serde_json::to_value(connect_params) {
                        Ok(v) => v,
                        Err(e) => {
                            log_protocol_error("Failed to serialize connect params", &e.to_string());
                            return;
                        }
                    };
                    
                    let connect_req = GatewayRequest {
                        msg_type: "req".to_string(),
                        id: uuid::Uuid::new_v4().to_string(),
                        method: "connect".to_string(),
                        params: Some(params_value),
                    };

                    if let Ok(json) = serde_json::to_string(&connect_req) {
                        let _ = tx.send(OutgoingMessage::Raw(json)).await;
                    }
                }
                "chat" => {
                    if let Some(payload) = payload {
                        if let Ok(chat_event) = serde_json::from_value::<ChatEvent>(payload) {
                            // Update streaming timeout tracker
                            if let Some(run_id) = &chat_event.run_id {
                                active_runs
                                    .lock()
                                    .await
                                    .insert(run_id.clone(), Instant::now());
                            }

                            match chat_event.state.as_deref() {
                                Some("delta") => {
                                    if let Some(msg) = &chat_event.message {
                                        if let Some(content) =
                                            msg.get("content").and_then(|c| c.as_str())
                                        {
                                            let _ = app.emit("gateway:stream", content.to_string());
                                        }
                                    }
                                }
                                Some("final") => {
                                    // Remove from active runs
                                    if let Some(run_id) = &chat_event.run_id {
                                        active_runs.lock().await.remove(run_id);
                                    }
                                    // Emit completion with usage stats
                                    let _ = app.emit(
                                        "gateway:complete",
                                        serde_json::json!({
                                            "usage": chat_event.usage,
                                            "stopReason": chat_event.stop_reason,
                                        }),
                                    );
                                }
                                Some("aborted") => {
                                    if let Some(run_id) = &chat_event.run_id {
                                        active_runs.lock().await.remove(run_id);
                                    }
                                    let _ = app.emit("gateway:aborted", ());
                                }
                                Some("error") => {
                                    if let Some(run_id) = &chat_event.run_id {
                                        active_runs.lock().await.remove(run_id);
                                    }
                                    let error_msg = chat_event
                                        .error_message
                                        .unwrap_or_else(|| "Unknown error".to_string());
                                    let _ = app.emit("gateway:error", error_msg);
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
                    let _ = app.emit("gateway:disconnected", "Server shutdown");
                }
                _ => {
                    // Unknown event - emit for debugging
                    let _ = app.emit(
                        "gateway:event",
                        serde_json::json!({
                            "event": event,
                            "payload": payload
                        }),
                    );
                }
            }
        }
        ValidatedFrame::Response {
            id,
            ok,
            payload,
            error,
        } => {
            let response = GatewayResponse {
                msg_type: Some("res".to_string()),
                id: Some(id.clone()),
                ok: Some(ok),
                payload: payload.clone(),
                error: error.clone(),
            };

            // Check if this is hello-ok (connect response)
            if let Some(payload) = &payload {
                if payload.get("type").and_then(|t| t.as_str()) == Some("hello-ok") {
                    let _ = app.emit("gateway:connected", ());
                }
            }

            // Route to pending request
            let mut pending = pending_requests.lock().await;
            if let Some(pending_req) = pending.remove(&id) {
                let _ = pending_req.sender.send(response.clone());
            }

            // Emit for general listeners
            let _ = app.emit("gateway:response", response);
        }
        ValidatedFrame::Request { .. } => {
            // Server-initiated requests - not currently handled
        }
    }
}

/// Start health monitoring with ping/pong
async fn start_health_monitor(
    app: AppHandle,
    tx: mpsc::Sender<OutgoingMessage>,
    _health_metrics: Arc<Mutex<HealthMetrics>>,
) {
    tokio::spawn(async move {
        let ping_interval = Duration::from_secs(DEFAULT_PING_INTERVAL_SECS);
        let _ping_timeout = Duration::from_secs(DEFAULT_PING_TIMEOUT_SECS);

        loop {
            tokio::time::sleep(ping_interval).await;

            // Send ping
            if tx.send(OutgoingMessage::Ping).await.is_err() {
                // Channel closed, connection lost
                let _ = app.emit("gateway:disconnected", "Connection lost");
                break;
            }
        }
    });
}

/// Start streaming timeout monitor
async fn start_stream_timeout_monitor(
    app: AppHandle,
    active_runs: Arc<Mutex<HashMap<String, Instant>>>,
    state: Arc<GatewayStateInner>,
) {
    tokio::spawn(async move {
        let check_interval = Duration::from_secs(5);
        let stream_timeout = Duration::from_secs(DEFAULT_STREAM_TIMEOUT_SECS);

        loop {
            tokio::time::sleep(check_interval).await;

            // CRITICAL-8: Exit task on shutdown to prevent leak
            if state.shutdown.load(Ordering::SeqCst) {
                break;
            }

            let mut runs = active_runs.lock().await;
            let mut timed_out = Vec::new();

            for (run_id, last_activity) in runs.iter() {
                if last_activity.elapsed() > stream_timeout {
                    timed_out.push(run_id.clone());
                }
            }

            for run_id in timed_out {
                runs.remove(&run_id);
                let _ = app.emit(
                    "gateway:stream_timeout",
                    serde_json::json!({
                        "runId": run_id,
                        "timeoutSecs": stream_timeout.as_secs()
                    }),
                );
            }
        }
    });
}

/// CRITICAL-1: Cleanup task for expired pending requests
async fn start_pending_requests_cleanup(
    pending_requests: Arc<Mutex<HashMap<String, PendingRequest>>>,
    state: Arc<GatewayStateInner>,
) {
    tokio::spawn(async move {
        let cleanup_interval = Duration::from_secs(30);
        
        loop {
            tokio::time::sleep(cleanup_interval).await;
            
            // CRITICAL-8: Exit task on shutdown to prevent leak
            if state.shutdown.load(Ordering::SeqCst) {
                break;
            }
            
            let mut pending = pending_requests.lock().await;
            let now = Instant::now();
            
            // Remove requests older than their timeout + 1 minute grace period
            pending.retain(|_, req| {
                now.duration_since(req.created_at) < req.timeout + Duration::from_secs(60)
            });
        }
    });
}

/// Start reconnection loop with exponential backoff
async fn start_reconnection_loop(app: AppHandle, state: Arc<GatewayStateInner>) {
    tokio::spawn(async move {
        loop {
            let attempt = state.reconnect_attempt.fetch_add(1, Ordering::SeqCst) + 1;

            if attempt > MAX_RECONNECT_ATTEMPTS {
                // Give up
                *state.connection_state.write().await = ConnectionState::Failed {
                    reason: format!(
                        "Failed to reconnect after {} attempts",
                        MAX_RECONNECT_ATTEMPTS
                    ),
                    can_retry: true,
                };
                let _ = app.emit(
                    "gateway:state",
                    ConnectionState::Failed {
                        reason: format!(
                            "Failed to reconnect after {} attempts",
                            MAX_RECONNECT_ATTEMPTS
                        ),
                        can_retry: true,
                    },
                );
                break;
            }

            if state.shutdown.load(Ordering::SeqCst) {
                break;
            }

            let backoff = calculate_backoff(attempt);

            // Update state to reconnecting
            *state.connection_state.write().await = ConnectionState::Reconnecting {
                attempt,
                max_attempts: MAX_RECONNECT_ATTEMPTS,
                next_retry_ms: backoff.as_millis() as u64,
                reason: "Connection lost".to_string(),
            };
            let _ = app.emit(
                "gateway:state",
                ConnectionState::Reconnecting {
                    attempt,
                    max_attempts: MAX_RECONNECT_ATTEMPTS,
                    next_retry_ms: backoff.as_millis() as u64,
                    reason: "Connection lost".to_string(),
                },
            );

            // Wait for backoff
            tokio::time::sleep(backoff).await;

            if state.shutdown.load(Ordering::SeqCst) {
                break;
            }

            // Attempt reconnection
            let credentials = state.stored_credentials.lock().await.clone();
            if let Some(creds) = credentials {
                log_protocol_error("Reconnect", &format!("Attempt {} to {}", attempt, creds.url));
                match connect_internal(&app, state.clone(), &creds.url, &creds.token).await {
                    Ok(_) => {
                        // Success!
                        log_protocol_error("Reconnect", &format!("SUCCESS on attempt {}", attempt));
                        state.reconnect_attempt.store(0, Ordering::SeqCst);
                        *state.connection_state.write().await =
                            ConnectionState::Connected { session_id: None };
                        let _ = app.emit(
                            "gateway:state",
                            ConnectionState::Connected { session_id: None },
                        );
                        let _ = app.emit("gateway:reconnected", attempt);

                        // Drain message queue
                        let queue_size = state.message_queue.lock().await.len();
                        if queue_size > 0 {
                            log_protocol_error("Reconnect", &format!("Draining {} queued messages", queue_size));
                        }
                        drain_message_queue(&state).await;
                        break;
                    }
                    Err(e) => {
                        log_protocol_error("Reconnect", &format!("Failed attempt {}: {}", attempt, e.user_message()));
                        if e.requires_reauth() {
                            // Auth error - stop reconnecting
                            log_protocol_error("Reconnect", "Auth error detected, stopping reconnection attempts");
                            *state.connection_state.write().await = ConnectionState::Failed {
                                reason: e.user_message(),
                                can_retry: false,
                            };
                            let _ = app.emit(
                                "gateway:state",
                                ConnectionState::Failed {
                                    reason: e.user_message(),
                                    can_retry: false,
                                },
                            );
                            break;
                        }
                        // Continue loop for other errors
                    }
                }
            } else {
                // No credentials - can't reconnect
                log_protocol_error("Reconnect", "No stored credentials, cannot reconnect");
                break;
            }
        }
    });
}

/// Drain and send queued messages
async fn drain_message_queue(state: &GatewayStateInner) {
    let sender = state.sender.lock().await;
    if let Some(tx) = sender.as_ref() {
        let mut queue = state.message_queue.lock().await;
        let mut processed = state.processed_ids.lock().await;

        while let Some(mut msg) = queue.pop_front() {
            // Skip expired messages
            if msg.is_expired() {
                continue;
            }

            // Skip already processed (dedup)
            if processed.contains(&msg.id) {
                continue;
            }

            // Try to send
            if tx
                .send(OutgoingMessage::Raw(msg.json.clone()))
                .await
                .is_ok()
            {
                processed.insert(msg.id.clone());
            } else if msg.can_retry() {
                // Put back in queue for retry
                msg.increment_retry();
                queue.push_back(msg);
            }
        }

        // Cleanup old processed IDs (keep last 1000)
        // If we have too many, just clear and start fresh - simpler and more efficient
        // than trying to remove oldest items from a HashSet (which has no ordering)
        if processed.len() > 10_000 {
            log_protocol_error("MessageQueue", &format!(
                "Processed IDs set grew to {}, clearing to prevent unbounded growth",
                processed.len()
            ));
            processed.clear();
        }
    }
}

/// Disconnect from Gateway
///
/// Gracefully closes the WebSocket connection and cleans up all connection state.
///
/// # Arguments
/// * `state` - Gateway connection state
///
/// # Behavior
/// - Sets shutdown flag to stop reconnection attempts
/// - Clears message queue and pending requests
/// - Resets connection state to Disconnected
/// - Cancels all background tasks (ping monitor, stream timeout monitor)
#[tauri::command]
pub async fn disconnect(state: State<'_, GatewayState>) -> Result<(), String> {
    state.inner.shutdown.store(true, Ordering::SeqCst);
    *state.inner.sender.lock().await = None;
    *state.inner.connection_state.write().await = ConnectionState::Disconnected;
    *state.inner.pending_requests.lock().await = HashMap::new();
    *state.inner.active_runs.lock().await = HashMap::new(); // CRITICAL-2: Clear active runs on disconnect
    *state.inner.message_queue.lock().await = VecDeque::new(); // CRITICAL-7: Clear message queue on disconnect
    *state.inner.processed_ids.lock().await = HashSet::new(); // CRITICAL-7: Clear processed IDs on disconnect
    state.inner.health_metrics.lock().await.reset();
    Ok(())
}

/// Send a chat message to Gateway
///
/// Sends a chat message with optional attachments to the Gateway for AI processing.
/// Messages are queued during reconnection and sent when connection is restored.
///
/// # Arguments
/// * `state` - Gateway connection state
/// * `params` - Chat parameters including message text, session key, model, thinking level, and attachments
///
/// # Returns
/// * `Ok(String)` - Request ID for tracking the message
/// * `Err(String)` - Error message if sending fails
///
/// # Behavior
/// - Generates unique request ID and idempotency key
/// - Supports image and file attachments with automatic type detection
/// - Queues messages during reconnection (max 100, oldest dropped)
/// - Tracks sent messages for deduplication (prevents duplicate sends)
/// - Emits "gateway:stream", "gateway:complete", etc. events with responses
#[tauri::command]
pub async fn send_message(
    state: State<'_, GatewayState>,
    params: ChatParams,
) -> Result<String, String> {
    // Input validation: prevent excessively large messages
    const MAX_MESSAGE_LENGTH: usize = 500_000; // ~500KB
    const MAX_ATTACHMENTS: usize = 20;
    const MAX_ATTACHMENT_SIZE: usize = 50_000_000; // 50MB per attachment
    
    if params.message.len() > MAX_MESSAGE_LENGTH {
        return Err(format!(
            "Message too large: {} characters (max {})",
            params.message.len(),
            MAX_MESSAGE_LENGTH
        ));
    }
    
    if params.attachments.len() > MAX_ATTACHMENTS {
        return Err(format!(
            "Too many attachments: {} (max {})",
            params.attachments.len(),
            MAX_ATTACHMENTS
        ));
    }
    
    for (idx, attachment) in params.attachments.iter().enumerate() {
        if attachment.data.len() > MAX_ATTACHMENT_SIZE {
            return Err(format!(
                "Attachment {} too large: {} bytes (max {})",
                idx,
                attachment.data.len(),
                MAX_ATTACHMENT_SIZE
            ));
        }
    }
    
    let connection_state = state.inner.connection_state.read().await.clone();

    // Build request
    let request_id = uuid::Uuid::new_v4().to_string();
    let idempotency_key = uuid::Uuid::new_v4().to_string();

    // Build request params - always use "message" field (not "input")
    // Attachments go in separate "attachments" array per Gateway protocol
    let request_params = if params.attachments.is_empty() {
        serde_json::json!({
            "message": params.message,
            "sessionKey": params.session_key,
            "thinking": params.thinking,
            "idempotencyKey": idempotency_key,
        })
    } else {
        // Convert attachments to Gateway format:
        // [{type: "image", mimeType: "...", content: "base64..."}]
        let attachments: Vec<serde_json::Value> = params
            .attachments
            .iter()
            .map(|a| {
                serde_json::json!({
                    "type": match a.mime_type.as_str() {
                        t if t.starts_with("image/") => "image",
                        t if t.starts_with("text/") => "text",
                        _ => "file"
                    },
                    "mimeType": a.mime_type,
                    "fileName": a.filename,
                    "content": a.data,  // Already base64
                })
            })
            .collect();

        serde_json::json!({
            "message": params.message,
            "sessionKey": params.session_key,
            "thinking": params.thinking,
            "idempotencyKey": idempotency_key,
            "attachments": attachments,
        })
    };

    let request = GatewayRequest {
        msg_type: "req".to_string(),
        id: request_id.clone(),
        method: "chat.send".to_string(),
        params: Some(request_params),
    };

    let json = serde_json::to_string(&request).map_err(|e| e.to_string())?;

    // If reconnecting, queue the message
    if matches!(connection_state, ConnectionState::Reconnecting { .. }) {
        let mut queue = state.inner.message_queue.lock().await;
        
        // CRITICAL-3: Enforce max queue size (drop oldest messages)
        const MAX_QUEUE_SIZE: usize = 100;
        while queue.len() >= MAX_QUEUE_SIZE {
            queue.pop_front();
        }
        
        queue.push_back(QueuedMessage::new(request_id.clone(), json));
        return Ok(request_id);
    }

    // Try to send
    let sender = state.inner.sender.lock().await;
    let sender = sender.as_ref().ok_or("Not connected")?;

    sender
        .send(OutgoingMessage::Raw(json.clone()))
        .await
        .map_err(|e| e.to_string())?;

    // Track for dedup with size limit to prevent unbounded growth
    let mut processed = state.inner.processed_ids.lock().await;
    
    // CRITICAL-7: Prevent unbounded growth of processed_ids
    // Clear the set if it grows too large (10k entries = ~1MB memory)
    if processed.len() > 10_000 {
        processed.clear();
    }
    
    processed.insert(request_id.clone());
    drop(processed);

    Ok(request_id)
}

/// Get connection status
#[tauri::command]
pub async fn get_connection_status(state: State<'_, GatewayState>) -> Result<bool, String> {
    Ok(state.inner.connection_state.read().await.is_connected())
}

/// Get detailed connection state
#[tauri::command]
pub async fn get_connection_state(
    state: State<'_, GatewayState>,
) -> Result<ConnectionState, String> {
    Ok(state.inner.connection_state.read().await.clone())
}

/// Get connection quality
#[tauri::command]
pub async fn get_connection_quality(
    state: State<'_, GatewayState>,
) -> Result<ConnectionQuality, String> {
    Ok(state.inner.health_metrics.lock().await.quality())
}

/// Request available models from Gateway
///
/// Retrieves the list of available AI models from the Gateway.
/// Falls back to a hardcoded list if the request fails.
///
/// # Arguments
/// * `_app` - Tauri application handle (unused but required by Tauri)
/// * `state` - Gateway connection state
///
/// # Returns
/// * `Ok(Vec<ModelInfo>)` - List of available models with metadata
/// * `Err(String)` - Error message if not connected
///
/// # Behavior
/// - Sends "models.list" request to Gateway with 30s timeout
/// - Returns fallback models (Claude Sonnet/Opus) if request fails
/// - Automatically cleans up timed-out requests
#[tauri::command]
pub async fn get_models(
    _app: AppHandle,
    state: State<'_, GatewayState>,
) -> Result<Vec<ModelInfo>, String> {
    let sender_guard = state.inner.sender.lock().await;
    let sender = sender_guard.as_ref().ok_or("Not connected to Gateway")?;

    let request = GatewayRequest::new("models.list", Some(serde_json::json!({})));
    let request_id = request.id.clone();

    let (response_tx, response_rx) = oneshot::channel();

    {
        let mut pending = state.inner.pending_requests.lock().await;
        pending.insert(
            request_id.clone(),
            PendingRequest {
                sender: response_tx,
                created_at: Instant::now(),
                timeout: Duration::from_secs(DEFAULT_REQUEST_TIMEOUT_SECS),
            },
        );
    }

    let json = serde_json::to_string(&request).map_err(|e| e.to_string())?;
    sender
        .send(OutgoingMessage::Raw(json))
        .await
        .map_err(|e| e.to_string())?;

    drop(sender_guard);

    match tokio::time::timeout(
        Duration::from_secs(DEFAULT_REQUEST_TIMEOUT_SECS),
        response_rx,
    )
    .await
    {
        Ok(Ok(response)) => {
            if response.ok == Some(true) {
                if let Some(payload) = response.payload {
                    if let Some(models_val) = payload.get("models") {
                        if let Ok(models) =
                            serde_json::from_value::<Vec<ModelInfo>>(models_val.clone())
                        {
                            return Ok(models);
                        }
                    }
                }
            } else if let Some(error) = response.error {
                return Err(format!("Gateway error: {}", error.message));
            }
            Ok(get_fallback_models())
        }
        Ok(Err(_)) => {
            state
                .inner
                .pending_requests
                .lock()
                .await
                .remove(&request_id);
            Ok(get_fallback_models())
        }
        Err(_) => {
            state
                .inner
                .pending_requests
                .lock()
                .await
                .remove(&request_id);
            Ok(get_fallback_models())
        }
    }
}

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

// ============================================================================
// Tests
// ============================================================================

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
                id: "control-ui".to_string(),
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
            user_agent: "moltzer/0.1.0".to_string(),
        };

        let json = serde_json::to_string(&params).unwrap();
        assert!(json.contains("minProtocol"));
        assert!(json.contains("maxProtocol"));
        assert!(json.contains("operator"));
    }

    #[tokio::test]
    async fn test_gateway_state_default() {
        let state = GatewayState::default();

        assert!(!state.inner.connection_state.read().await.is_connected());
        assert!(state.inner.sender.lock().await.is_none());
        assert!(state.inner.pending_requests.lock().await.is_empty());
        assert!(state.inner.message_queue.lock().await.is_empty());
    }

    #[tokio::test]
    async fn test_message_queue() {
        let state = GatewayState::default();

        let msg = QueuedMessage::new("test-1".to_string(), "{}".to_string());
        state.inner.message_queue.lock().await.push_back(msg);

        assert_eq!(state.inner.message_queue.lock().await.len(), 1);
    }
}
