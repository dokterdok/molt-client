//! Gateway discovery module
//! 
//! Discovers Clawdbot Gateway instances through multiple methods:
//! - Local port scanning (common Gateway ports)
//! - Environment variables
//! - Configuration files
//! - Tailscale network

use serde::{Deserialize, Serialize};
use std::time::Duration;
use tokio::time::timeout;
use tokio_tungstenite::connect_async;

/// A discovered Gateway instance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiscoveredGateway {
    /// WebSocket URL
    pub url: String,
    /// Human-readable source of discovery
    pub source: String,
    /// Connection status (tested during discovery)
    pub reachable: bool,
    /// Response time in milliseconds (if reachable)
    pub response_time_ms: Option<u64>,
}

/// Discover Gateways using all available methods
#[tauri::command]
pub async fn discover_gateways() -> Result<Vec<DiscoveredGateway>, String> {
    let mut gateways = Vec::new();
    
    // Method 1: Check environment variables
    if let Some(url) = check_env_vars() {
        let gateway = test_gateway(url, "Environment Variable").await;
        gateways.push(gateway);
    }
    
    // Method 2: Check common localhost ports (in parallel)
    let local_gateways = scan_local_ports().await;
    gateways.extend(local_gateways);
    
    // Method 3: Check config files
    if let Some(url) = check_config_files().await {
        // Only add if not already found
        if !gateways.iter().any(|g| g.url == url) {
            let gateway = test_gateway(url, "Config File").await;
            gateways.push(gateway);
        }
    }
    
    // Method 4: Check Tailscale network
    let tailscale_gateways = check_tailscale().await;
    // Filter out duplicates
    for tg in tailscale_gateways {
        if !gateways.iter().any(|g| g.url == tg.url) {
            gateways.push(tg);
        }
    }
    
    Ok(gateways)
}

/// Check environment variables for Gateway URL
fn check_env_vars() -> Option<String> {
    // Check common environment variable names
    let var_names = [
        "CLAWDBOT_GATEWAY_URL",
        "MOLT_GATEWAY_URL",
        "GATEWAY_URL",
    ];
    
    for var_name in var_names {
        if let Ok(url) = std::env::var(var_name) {
            if !url.is_empty() {
                return Some(url);
            }
        }
    }
    
    None
}

/// Scan common localhost ports for Gateway
async fn scan_local_ports() -> Vec<DiscoveredGateway> {
    let common_ports = [
        18789, // Default Clawdbot Gateway port
        8789,  // Alternative port
        3000,  // Common development port
        8080,  // Alternative development port
    ];
    
    let protocols = ["ws", "wss"];
    let hosts = ["localhost", "127.0.0.1"];
    
    let mut tasks = Vec::new();
    
    // Create tasks for all combinations
    for protocol in protocols {
        for host in hosts {
            for port in common_ports {
                let url = format!("{}://{}:{}", protocol, host, port);
                let task = tokio::spawn(test_gateway(url.clone(), format!("Local Scan ({})", port)));
                tasks.push(task);
            }
        }
    }
    
    // Wait for all tasks with timeout
    let mut gateways = Vec::new();
    for task in tasks {
        if let Ok(gateway) = task.await {
            gateways.push(gateway);
        }
    }
    
    // Sort by reachability and response time
    gateways.sort_by(|a, b| {
        match (a.reachable, b.reachable) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            (true, true) => a.response_time_ms.cmp(&b.response_time_ms),
            (false, false) => std::cmp::Ordering::Equal,
        }
    });
    
    // Only return reachable gateways from local scan
    gateways.into_iter().filter(|g| g.reachable).collect()
}

/// Check configuration files for Gateway URL
async fn check_config_files() -> Option<String> {
    // Check common config file locations
    let config_paths = [
        ".env.local",
        ".env",
        "clawdbot.config.json",
        "moltzer.config.json",
    ];
    
    // Try current directory first
    for path in config_paths {
        if let Ok(content) = tokio::fs::read_to_string(path).await {
            if let Some(url) = extract_url_from_config(&content) {
                return Some(url);
            }
        }
    }
    
    // Try home directory
    if let Some(home) = dirs::home_dir() {
        for path in config_paths {
            let full_path = home.join(path);
            if let Ok(content) = tokio::fs::read_to_string(&full_path).await {
                if let Some(url) = extract_url_from_config(&content) {
                    return Some(url);
                }
            }
        }
    }
    
    None
}

/// Extract Gateway URL from config file content
fn extract_url_from_config(content: &str) -> Option<String> {
    // Try to parse as JSON first
    if let Ok(json) = serde_json::from_str::<serde_json::Value>(content) {
        if let Some(url) = json.get("gatewayUrl").and_then(|v| v.as_str()) {
            return Some(url.to_string());
        }
        if let Some(url) = json.get("gateway_url").and_then(|v| v.as_str()) {
            return Some(url.to_string());
        }
    }
    
    // Try to parse as .env format
    for line in content.lines() {
        let line = line.trim();
        if line.starts_with("GATEWAY_URL=") || line.starts_with("CLAWDBOT_GATEWAY_URL=") {
            let parts: Vec<&str> = line.splitn(2, '=').collect();
            if parts.len() == 2 {
                let url = parts[1].trim().trim_matches('"').trim_matches('\'');
                if !url.is_empty() {
                    return Some(url.to_string());
                }
            }
        }
    }
    
    None
}

/// Check Tailscale network for Gateway instances
async fn check_tailscale() -> Vec<DiscoveredGateway> {
    let mut gateways = Vec::new();
    
    // Try to execute tailscale status command
    #[cfg(target_os = "windows")]
    let tailscale_cmd = "tailscale.exe";
    #[cfg(not(target_os = "windows"))]
    let tailscale_cmd = "tailscale";
    
    // Check if Tailscale is installed and running
    let output = match tokio::process::Command::new(tailscale_cmd)
        .arg("status")
        .arg("--json")
        .output()
        .await
    {
        Ok(output) if output.status.success() => output,
        _ => return gateways, // Tailscale not available
    };
    
    // Parse Tailscale status JSON
    let status_str = match String::from_utf8(output.stdout) {
        Ok(s) => s,
        Err(_) => return gateways,
    };
    
    let status: serde_json::Value = match serde_json::from_str(&status_str) {
        Ok(s) => s,
        Err(_) => return gateways,
    };
    
    // Extract peer IPs
    if let Some(peers) = status.get("Peer").and_then(|p| p.as_object()) {
        let mut tasks = Vec::new();
        
        for (_id, peer) in peers {
            if let Some(addrs) = peer.get("TailscaleIPs").and_then(|a| a.as_array()) {
                for addr in addrs {
                    if let Some(ip) = addr.as_str() {
                        // Try common Gateway ports on this Tailscale IP
                        for protocol in ["ws", "wss"] {
                            for port in [18789, 8789] {
                                let url = format!("{}://{}:{}", protocol, ip, port);
                                let hostname = peer.get("HostName")
                                    .and_then(|h| h.as_str())
                                    .unwrap_or("unknown")
                                    .to_string();
                                let source = format!("Tailscale ({})", hostname);
                                let task = tokio::spawn(test_gateway(url, source));
                                tasks.push(task);
                            }
                        }
                    }
                }
            }
        }
        
        // Collect results with very short timeout
        for task in tasks {
            if let Ok(gateway) = task.await {
                if gateway.reachable {
                    gateways.push(gateway);
                }
            }
        }
    }
    
    gateways
}

/// Test if a Gateway is reachable at the given URL
async fn test_gateway(url: String, source: impl Into<String>) -> DiscoveredGateway {
    let start = std::time::Instant::now();
    
    // Try to connect with a short timeout (1 second)
    let connect_timeout = Duration::from_secs(1);
    
    let reachable = match timeout(connect_timeout, connect_async(&url)).await {
        Ok(Ok(_)) => true,
        _ => false,
    };
    
    let response_time_ms = if reachable {
        Some(start.elapsed().as_millis() as u64)
    } else {
        None
    };
    
    DiscoveredGateway {
        url,
        source: source.into(),
        reachable,
        response_time_ms,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_url_from_json() {
        let json = r#"{"gatewayUrl": "ws://localhost:18789"}"#;
        let url = extract_url_from_config(json);
        assert_eq!(url, Some("ws://localhost:18789".to_string()));
    }

    #[test]
    fn test_extract_url_from_env() {
        let env = "GATEWAY_URL=ws://localhost:18789\nOTHER_VAR=value";
        let url = extract_url_from_config(env);
        assert_eq!(url, Some("ws://localhost:18789".to_string()));
    }

    #[test]
    fn test_extract_url_with_quotes() {
        let env = r#"GATEWAY_URL="ws://localhost:18789""#;
        let url = extract_url_from_config(env);
        assert_eq!(url, Some("ws://localhost:18789".to_string()));
    }
}
