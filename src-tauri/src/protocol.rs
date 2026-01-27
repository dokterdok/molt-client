//! Protocol types and validation for Clawdbot Gateway communication
//! 
//! This module provides:
//! - Error classification (network, gateway, auth)
//! - Protocol message validation
//! - Connection state management
//! - Retry strategies

use serde::{Deserialize, Serialize};
use std::time::Duration;
use thiserror::Error;

/// Current protocol version
pub const PROTOCOL_VERSION: i32 = 3;

/// Connection configuration defaults
pub const DEFAULT_REQUEST_TIMEOUT_SECS: u64 = 30;
pub const DEFAULT_STREAM_TIMEOUT_SECS: u64 = 60;
pub const DEFAULT_PING_INTERVAL_SECS: u64 = 30;
pub const DEFAULT_PING_TIMEOUT_SECS: u64 = 10;

/// Exponential backoff configuration
pub const BACKOFF_INITIAL_MS: u64 = 5_000;      // 5 seconds
pub const BACKOFF_MAX_MS: u64 = 60_000;         // 60 seconds
pub const BACKOFF_MULTIPLIER: f64 = 2.0;
pub const MAX_RECONNECT_ATTEMPTS: u32 = 10;

// ============================================================================
// Error Classification
// ============================================================================

/// Classified error types for different recovery strategies
#[derive(Debug, Clone, Serialize, Deserialize, Error)]
pub enum GatewayError {
    /// Network-level errors (TCP, DNS, TLS) - retryable
    #[error("Network error: {message}")]
    Network {
        message: String,
        retryable: bool,
        #[serde(skip)]
        retry_after: Option<Duration>,
    },

    /// WebSocket protocol errors - may be retryable
    #[error("Protocol error: {message}")]
    Protocol {
        message: String,
        code: Option<String>,
        retryable: bool,
    },

    /// Gateway application errors - check code for retryability
    #[error("Gateway error ({code}): {message}")]
    Gateway {
        code: String,
        message: String,
        details: Option<serde_json::Value>,
        retryable: bool,
    },

    /// Authentication errors - not retryable without user action
    #[error("Authentication error: {message}")]
    Auth {
        message: String,
        code: String,
    },

    /// Request timeout - retryable
    #[error("Request timeout after {timeout_secs}s")]
    Timeout {
        timeout_secs: u64,
        request_id: Option<String>,
    },

    /// Streaming timeout (no data received) - may be retryable
    #[error("Stream timeout: no data for {idle_secs}s")]
    StreamTimeout {
        idle_secs: u64,
        run_id: Option<String>,
    },

    /// Validation error - not retryable
    #[error("Validation error: {message}")]
    Validation {
        message: String,
        field: Option<String>,
    },

    /// Connection closed - check reason for retryability
    #[error("Connection closed: {reason}")]
    Closed {
        reason: String,
        code: Option<u16>,
        retryable: bool,
    },
}

impl GatewayError {
    /// Whether this error should trigger automatic retry
    pub fn is_retryable(&self) -> bool {
        match self {
            Self::Network { retryable, .. } => *retryable,
            Self::Protocol { retryable, .. } => *retryable,
            Self::Gateway { retryable, .. } => *retryable,
            Self::Auth { .. } => false, // Always requires user action
            Self::Timeout { .. } => true,
            Self::StreamTimeout { .. } => true,
            Self::Validation { .. } => false,
            Self::Closed { retryable, .. } => *retryable,
        }
    }

    /// Whether this error requires re-authentication
    pub fn requires_reauth(&self) -> bool {
        match self {
            Self::Auth { .. } => true,
            Self::Gateway { code, .. } => {
                matches!(code.as_str(), "UNAUTHORIZED" | "FORBIDDEN" | "TOKEN_EXPIRED")
            }
            _ => false,
        }
    }

    /// Get user-friendly error message
    pub fn user_message(&self) -> String {
        match self {
            Self::Network { .. } => {
                "Unable to connect to Gateway. Please check your network connection.".to_string()
            }
            Self::Protocol { message, .. } => {
                format!("Communication error: {}. Try reconnecting.", message)
            }
            Self::Gateway { message, code, .. } => {
                format!("[{}] {}", code, message)
            }
            Self::Auth { message, .. } => {
                format!("Authentication failed: {}. Please check your credentials.", message)
            }
            Self::Timeout { timeout_secs, .. } => {
                format!("Request timed out after {}s. Please try again.", timeout_secs)
            }
            Self::StreamTimeout { idle_secs, .. } => {
                format!("No response received for {}s. The request may still be processing.", idle_secs)
            }
            Self::Validation { message, .. } => {
                format!("Invalid request: {}", message)
            }
            Self::Closed { reason, .. } => {
                format!("Connection closed: {}", reason)
            }
        }
    }

    /// Create from raw gateway error response
    pub fn from_gateway_response(code: String, message: String, details: Option<serde_json::Value>, retryable: Option<bool>) -> Self {
        // Classify auth errors
        if matches!(code.as_str(), "UNAUTHORIZED" | "FORBIDDEN" | "TOKEN_EXPIRED" | "INVALID_TOKEN") {
            return Self::Auth { message, code };
        }

        // Classify retryable gateway errors
        let is_retryable = retryable.unwrap_or_else(|| {
            matches!(code.as_str(), 
                "RATE_LIMITED" | "SERVICE_UNAVAILABLE" | "OVERLOADED" | 
                "TIMEOUT" | "TEMPORARY_ERROR" | "RETRY")
        });

        Self::Gateway {
            code,
            message,
            details,
            retryable: is_retryable,
        }
    }
}

// ============================================================================
// Connection State
// ============================================================================

/// Connection state for UI display
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(tag = "state")]
pub enum ConnectionState {
    /// Not connected
    Disconnected,
    /// Attempting to connect
    Connecting,
    /// Connected and ready
    Connected {
        #[serde(rename = "sessionId")]
        session_id: Option<String>,
    },
    /// Reconnecting after disconnect
    Reconnecting {
        attempt: u32,
        #[serde(rename = "maxAttempts")]
        max_attempts: u32,
        #[serde(rename = "nextRetryMs")]
        next_retry_ms: u64,
        reason: String,
    },
    /// Failed to connect, given up
    Failed {
        reason: String,
        #[serde(rename = "canRetry")]
        can_retry: bool,
    },
}

impl Default for ConnectionState {
    fn default() -> Self {
        Self::Disconnected
    }
}

impl ConnectionState {
    pub fn is_connected(&self) -> bool {
        matches!(self, Self::Connected { .. })
    }

    pub fn is_connecting(&self) -> bool {
        matches!(self, Self::Connecting | Self::Reconnecting { .. })
    }

    pub fn can_send(&self) -> bool {
        matches!(self, Self::Connected { .. })
    }
}

// ============================================================================
// Connection Quality
// ============================================================================

/// Connection quality indicator based on latency and reliability
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
pub enum ConnectionQuality {
    Excellent,  // < 100ms latency, no recent failures
    Good,       // < 300ms latency, minimal failures
    Fair,       // < 1000ms latency, some failures
    Poor,       // > 1000ms latency or frequent failures
    Unknown,    // Not enough data
}

impl Default for ConnectionQuality {
    fn default() -> Self {
        Self::Unknown
    }
}

/// Health metrics for connection quality assessment
#[derive(Debug, Clone, Default)]
pub struct HealthMetrics {
    /// Recent ping latencies (ms)
    pub latencies: Vec<u64>,
    /// Number of recent failures
    pub recent_failures: u32,
    /// Number of recent successes
    pub recent_successes: u32,
    /// Last successful ping timestamp
    pub last_ping_success: Option<std::time::Instant>,
    /// Messages sent since last ack
    pub pending_acks: u32,
}

impl HealthMetrics {
    /// Maximum latencies to track
    const MAX_LATENCIES: usize = 10;

    pub fn record_latency(&mut self, latency_ms: u64) {
        self.latencies.push(latency_ms);
        if self.latencies.len() > Self::MAX_LATENCIES {
            self.latencies.remove(0);
        }
        self.recent_successes += 1;
        self.last_ping_success = Some(std::time::Instant::now());
    }

    pub fn record_failure(&mut self) {
        self.recent_failures += 1;
    }

    pub fn reset(&mut self) {
        self.latencies.clear();
        self.recent_failures = 0;
        self.recent_successes = 0;
        self.last_ping_success = None;
        self.pending_acks = 0;
    }

    /// Calculate average latency
    pub fn average_latency(&self) -> Option<u64> {
        if self.latencies.is_empty() {
            return None;
        }
        Some(self.latencies.iter().sum::<u64>() / self.latencies.len() as u64)
    }

    /// Assess connection quality
    pub fn quality(&self) -> ConnectionQuality {
        let avg_latency = match self.average_latency() {
            Some(l) => l,
            None => return ConnectionQuality::Unknown,
        };

        // Need at least 3 samples
        if self.latencies.len() < 3 {
            return ConnectionQuality::Unknown;
        }

        // Check failure rate
        let total = self.recent_successes + self.recent_failures;
        let failure_rate = if total > 0 {
            self.recent_failures as f64 / total as f64
        } else {
            0.0
        };

        if avg_latency < 100 && failure_rate < 0.05 {
            ConnectionQuality::Excellent
        } else if avg_latency < 300 && failure_rate < 0.1 {
            ConnectionQuality::Good
        } else if avg_latency < 1000 && failure_rate < 0.25 {
            ConnectionQuality::Fair
        } else {
            ConnectionQuality::Poor
        }
    }
}

// ============================================================================
// Protocol Message Validation
// ============================================================================

/// Validated gateway frame
#[derive(Debug, Clone)]
pub enum ValidatedFrame {
    Request {
        id: String,
        method: String,
        params: Option<serde_json::Value>,
    },
    Response {
        id: String,
        ok: bool,
        payload: Option<serde_json::Value>,
        error: Option<RawGatewayError>,
    },
    Event {
        event: String,
        seq: Option<i32>,
        payload: Option<serde_json::Value>,
    },
}

/// Raw error from gateway (before classification)
#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct RawGatewayError {
    pub code: String,
    pub message: String,
    pub details: Option<serde_json::Value>,
    pub retryable: Option<bool>,
}

/// Raw frame for parsing (before validation)
#[derive(Debug, Deserialize)]
struct RawFrame {
    #[serde(rename = "type")]
    frame_type: Option<String>,
    id: Option<String>,
    method: Option<String>,
    params: Option<serde_json::Value>,
    ok: Option<bool>,
    payload: Option<serde_json::Value>,
    error: Option<RawGatewayError>,
    event: Option<String>,
    seq: Option<i32>,
}

/// Validate and parse a raw JSON message into a typed frame
pub fn validate_frame(json: &str) -> Result<ValidatedFrame, GatewayError> {
    // First, validate JSON syntax
    let raw: RawFrame = serde_json::from_str(json).map_err(|e| {
        GatewayError::Protocol {
            message: format!("Invalid JSON: {}", e),
            code: Some("INVALID_JSON".to_string()),
            retryable: false,
        }
    })?;

    // Validate frame type exists
    let frame_type = raw.frame_type.ok_or_else(|| {
        GatewayError::Protocol {
            message: "Missing 'type' field".to_string(),
            code: Some("MISSING_TYPE".to_string()),
            retryable: false,
        }
    })?;

    match frame_type.as_str() {
        "req" => {
            let id = raw.id.ok_or_else(|| GatewayError::Protocol {
                message: "Request missing 'id' field".to_string(),
                code: Some("MISSING_ID".to_string()),
                retryable: false,
            })?;
            let method = raw.method.ok_or_else(|| GatewayError::Protocol {
                message: "Request missing 'method' field".to_string(),
                code: Some("MISSING_METHOD".to_string()),
                retryable: false,
            })?;
            Ok(ValidatedFrame::Request {
                id,
                method,
                params: raw.params,
            })
        }
        "res" => {
            let id = raw.id.ok_or_else(|| GatewayError::Protocol {
                message: "Response missing 'id' field".to_string(),
                code: Some("MISSING_ID".to_string()),
                retryable: false,
            })?;
            Ok(ValidatedFrame::Response {
                id,
                ok: raw.ok.unwrap_or(false),
                payload: raw.payload,
                error: raw.error,
            })
        }
        "event" => {
            let event = raw.event.ok_or_else(|| GatewayError::Protocol {
                message: "Event missing 'event' field".to_string(),
                code: Some("MISSING_EVENT".to_string()),
                retryable: false,
            })?;
            Ok(ValidatedFrame::Event {
                event,
                seq: raw.seq,
                payload: raw.payload,
            })
        }
        _ => Err(GatewayError::Protocol {
            message: format!("Unknown frame type: {}", frame_type),
            code: Some("UNKNOWN_TYPE".to_string()),
            retryable: false,
        }),
    }
}

// ============================================================================
// Exponential Backoff
// ============================================================================

/// Calculate backoff delay for a given attempt number
pub fn calculate_backoff(attempt: u32) -> Duration {
    let base_ms = BACKOFF_INITIAL_MS as f64;
    let max_ms = BACKOFF_MAX_MS as f64;
    
    let delay_ms = (base_ms * BACKOFF_MULTIPLIER.powi(attempt.saturating_sub(1) as i32)).min(max_ms);
    
    // Add jitter (±10%)
    let jitter = (rand_simple() * 0.2 - 0.1) * delay_ms;
    let final_delay = (delay_ms + jitter).max(BACKOFF_INITIAL_MS as f64) as u64;
    
    Duration::from_millis(final_delay)
}

/// Simple pseudo-random number generator (0.0 to 1.0)
/// Uses time-based seed for jitter
fn rand_simple() -> f64 {
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    ((nanos % 1000) as f64) / 1000.0
}

// ============================================================================
// Message Queue
// ============================================================================

/// Queued message for sending/retry
#[derive(Debug, Clone)]
pub struct QueuedMessage {
    pub id: String,
    pub json: String,
    pub created_at: std::time::Instant,
    pub retry_count: u32,
    pub max_retries: u32,
}

impl QueuedMessage {
    pub fn new(id: String, json: String) -> Self {
        Self {
            id,
            json,
            created_at: std::time::Instant::now(),
            retry_count: 0,
            max_retries: 3,
        }
    }

    pub fn can_retry(&self) -> bool {
        self.retry_count < self.max_retries
    }

    pub fn increment_retry(&mut self) {
        self.retry_count += 1;
    }

    /// Check if message is too old (5 minutes)
    pub fn is_expired(&self) -> bool {
        self.created_at.elapsed() > Duration::from_secs(300)
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_response_frame() {
        let json = r#"{"type":"res","id":"req-123","ok":true,"payload":{"data":"test"}}"#;
        let frame = validate_frame(json).unwrap();
        
        match frame {
            ValidatedFrame::Response { id, ok, .. } => {
                assert_eq!(id, "req-123");
                assert!(ok);
            }
            _ => panic!("Expected Response frame"),
        }
    }

    #[test]
    fn test_validate_event_frame() {
        let json = r#"{"type":"event","event":"chat","seq":1,"payload":{"content":"Hello"}}"#;
        let frame = validate_frame(json).unwrap();
        
        match frame {
            ValidatedFrame::Event { event, seq, .. } => {
                assert_eq!(event, "chat");
                assert_eq!(seq, Some(1));
            }
            _ => panic!("Expected Event frame"),
        }
    }

    #[test]
    fn test_validate_invalid_json() {
        let json = r#"{"type":"res", invalid json"#;
        let result = validate_frame(json);
        assert!(matches!(result, Err(GatewayError::Protocol { .. })));
    }

    #[test]
    fn test_validate_missing_type() {
        let json = r#"{"id":"123","ok":true}"#;
        let result = validate_frame(json);
        assert!(matches!(result, Err(GatewayError::Protocol { .. })));
    }

    #[test]
    fn test_error_classification_auth() {
        let error = GatewayError::from_gateway_response(
            "UNAUTHORIZED".to_string(),
            "Invalid token".to_string(),
            None,
            None,
        );
        assert!(matches!(error, GatewayError::Auth { .. }));
        assert!(error.requires_reauth());
        assert!(!error.is_retryable());
    }

    #[test]
    fn test_error_classification_retryable() {
        let error = GatewayError::from_gateway_response(
            "RATE_LIMITED".to_string(),
            "Too many requests".to_string(),
            None,
            None,
        );
        assert!(error.is_retryable());
    }

    #[test]
    fn test_backoff_calculation() {
        let d1 = calculate_backoff(1);
        let d2 = calculate_backoff(2);
        let d3 = calculate_backoff(3);
        
        // Should be roughly exponential (with jitter)
        assert!(d1.as_millis() >= 4500); // 5000 - 10%
        assert!(d2.as_millis() >= 9000); // 10000 - 10%
        assert!(d3.as_millis() >= 18000); // 20000 - 10%
        
        // Should cap at max
        let d_max = calculate_backoff(10);
        assert!(d_max.as_millis() <= 66000); // 60000 + 10%
    }

    #[test]
    fn test_connection_quality_assessment() {
        let mut metrics = HealthMetrics::default();
        
        // Unknown without data
        assert_eq!(metrics.quality(), ConnectionQuality::Unknown);
        
        // Good with low latency
        for _ in 0..5 {
            metrics.record_latency(50);
        }
        assert_eq!(metrics.quality(), ConnectionQuality::Excellent);
        
        // Degrades with high latency
        metrics.latencies.clear();
        for _ in 0..5 {
            metrics.record_latency(500);
        }
        assert_eq!(metrics.quality(), ConnectionQuality::Fair);
    }

    #[test]
    fn test_queued_message_expiry() {
        let msg = QueuedMessage::new("test".to_string(), "{}".to_string());
        assert!(!msg.is_expired());
        assert!(msg.can_retry());
    }
}
