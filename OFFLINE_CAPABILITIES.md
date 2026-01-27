# Molt Offline & Local-First Capabilities

> **Status:** Design Specification  
> **Version:** 1.0  
> **Date:** 2025-01-20

---

## Executive Summary

Molt is already architecturally suited for offline-first operation. All conversations are stored locally in IndexedDB, search happens client-side, and the only network dependency is the Clawdbot Gateway for sending messages. This document specifies how to:

1. Gracefully handle network unavailability
2. Integrate local LLMs for true offline AI
3. Synchronize across devices when connectivity returns
4. Provide excellent UX during all network states

---

## Table of Contents

1. [Offline Scenarios](#1-offline-scenarios)
2. [Local LLM Integration](#2-local-llm-integration)
3. [Data Sync Protocol](#3-data-sync-protocol)
4. [Feature Availability Matrix](#4-feature-availability-matrix)
5. [Connection State Machine](#5-connection-state-machine)
6. [Implementation Plan](#6-implementation-plan)
7. [User Experience](#7-user-experience)

---

## 1. Offline Scenarios

### 1.1 Scenario Classification

| Scenario | Network State | User Intent | Priority |
|----------|---------------|-------------|----------|
| **Total Offline** | No connectivity | Unintentional | P1 |
| **Spotty Connection** | Intermittent | Unintentional | P1 |
| **Privacy Mode** | Full connectivity | Intentional disconnect | P2 |
| **Local-Only Mode** | Any | Prefer local LLM | P2 |
| **Airplane Mode** | OS-level block | Intentional | P1 |

### 1.2 Total Offline

**Trigger:** No network adapter, WiFi disconnected, no route to Gateway

**Behavior:**
- App launches normally (all data is local)
- Conversations load from IndexedDB
- Search works completely
- Sending messages queues them for later
- Local LLM available (if configured)
- Clear UI indication: "Offline - Using local AI"

**Implementation:**
```typescript
// Connection detection
const checkConnectivity = async (): Promise<ConnectivityState> => {
  // 1. Check navigator.onLine (fast, unreliable)
  if (!navigator.onLine) return 'offline';
  
  // 2. Ping Gateway health endpoint
  try {
    const response = await fetch(`${gatewayUrl}/health`, { 
      method: 'HEAD',
      timeout: 3000 
    });
    return response.ok ? 'online' : 'gateway-unreachable';
  } catch {
    // 3. Check generic internet connectivity
    try {
      await fetch('https://1.1.1.1/cdn-cgi/trace', { 
        method: 'HEAD',
        timeout: 3000 
      });
      return 'online-no-gateway';
    } catch {
      return 'offline';
    }
  }
};
```

### 1.3 Spotty Connection

**Trigger:** Weak WiFi, mobile data, train/plane WiFi

**Behavior:**
- Aggressive message queuing
- Exponential backoff on retries
- Show "Reconnecting..." with progress
- Don't lose any user messages
- Auto-resume when connection stabilizes

**Implementation:**
```typescript
interface QueuedMessage {
  id: string;
  conversationId: string;
  content: string;
  timestamp: Date;
  retryCount: number;
  lastAttempt: Date | null;
  status: 'pending' | 'sending' | 'failed';
}

class MessageQueue {
  private queue: QueuedMessage[] = [];
  private readonly maxRetries = 5;
  private readonly baseDelay = 1000; // 1s, 2s, 4s, 8s, 16s
  
  async processQueue(): Promise<void> {
    for (const msg of this.queue) {
      if (msg.status === 'sending') continue;
      
      const delay = this.baseDelay * Math.pow(2, msg.retryCount);
      const timeSinceLastAttempt = Date.now() - (msg.lastAttempt?.getTime() || 0);
      
      if (timeSinceLastAttempt < delay) continue;
      
      msg.status = 'sending';
      try {
        await this.sendMessage(msg);
        this.queue = this.queue.filter(m => m.id !== msg.id);
      } catch {
        msg.status = 'failed';
        msg.retryCount++;
        msg.lastAttempt = new Date();
        
        if (msg.retryCount >= this.maxRetries) {
          // Move to dead letter queue, notify user
          this.moveToDeadLetter(msg);
        }
      }
    }
  }
}
```

### 1.4 Privacy Mode

**Trigger:** User toggle in settings

**Behavior:**
- Disconnect from Gateway intentionally
- Route all queries to local LLM
- No network requests of any kind
- Visual indicator: "Privacy Mode 🔒"
- Queue messages if user sends to cloud model

**Implementation:**
```typescript
interface PrivacyModeSettings {
  enabled: boolean;
  allowLocalLLM: boolean;
  queueCloudMessages: boolean;  // Send when privacy mode disabled
  localModelId: string | null;
}

// Store in Zustand
const usePrivacyMode = create<{
  settings: PrivacyModeSettings;
  enable: () => void;
  disable: () => void;
}>((set, get) => ({
  settings: {
    enabled: false,
    allowLocalLLM: true,
    queueCloudMessages: true,
    localModelId: 'ollama/llama3.2',
  },
  enable: () => {
    gateway.disconnect();
    set({ settings: { ...get().settings, enabled: true } });
  },
  disable: async () => {
    await gateway.connect();
    await messageQueue.processQueue();
    set({ settings: { ...get().settings, enabled: false } });
  },
}));
```

---

## 2. Local LLM Integration

### 2.1 Provider Comparison

| Provider | Platform | Setup Complexity | Performance | Models | Recommendation |
|----------|----------|------------------|-------------|--------|----------------|
| **Ollama** | All | ⭐ Easy | ⭐⭐⭐ Good | 100+ | **Primary Choice** |
| **llama.cpp** | All | ⭐⭐⭐ Complex | ⭐⭐⭐⭐ Best | GGUF only | Advanced users |
| **MLX** | macOS only | ⭐⭐ Medium | ⭐⭐⭐⭐ Best on M-series | Growing | macOS primary |
| **ONNX Runtime** | All | ⭐⭐ Medium | ⭐⭐ Variable | Limited | Not recommended |

### 2.2 Recommended Strategy

**Primary:** Ollama  
**macOS Optimization:** MLX fallback  
**Power Users:** llama.cpp support

```
┌─────────────────────────────────────────────────────────────┐
│                    Local LLM Strategy                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  User sends message offline                                 │
│            │                                                │
│            ▼                                                │
│  ┌─────────────────┐                                        │
│  │ Check Ollama    │───Yes──▶ Use Ollama API               │
│  │ running?        │         (localhost:11434)             │
│  └────────┬────────┘                                        │
│           │ No                                              │
│           ▼                                                 │
│  ┌─────────────────┐                                        │
│  │ macOS with      │───Yes──▶ Use MLX                      │
│  │ Apple Silicon?  │         (direct inference)            │
│  └────────┬────────┘                                        │
│           │ No                                              │
│           ▼                                                 │
│  ┌─────────────────┐                                        │
│  │ llama.cpp       │───Yes──▶ Use llama.cpp                │
│  │ configured?     │         (via Tauri sidecar)           │
│  └────────┬────────┘                                        │
│           │ No                                              │
│           ▼                                                 │
│  Queue message for later                                    │
│  Show: "No local AI available"                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 Ollama Integration (Primary)

**Why Ollama:**
- Dead simple: `curl http://localhost:11434/api/generate`
- Streaming support built-in
- Model management included
- Active development
- 100+ models available

**Detection & Connection:**
```rust
// src-tauri/src/local_llm.rs

use serde::{Deserialize, Serialize};
use reqwest::Client;

#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaModel {
    pub name: String,
    pub size: u64,
    pub digest: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct OllamaModelsResponse {
    pub models: Vec<OllamaModel>,
}

/// Check if Ollama is running and get available models
#[tauri::command]
pub async fn detect_ollama() -> Result<Vec<OllamaModel>, String> {
    let client = Client::new();
    
    let response = client
        .get("http://localhost:11434/api/tags")
        .timeout(std::time::Duration::from_secs(2))
        .send()
        .await
        .map_err(|_| "Ollama not running")?;
    
    let models: OllamaModelsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Ollama response: {}", e))?;
    
    Ok(models.models)
}

/// Generate completion using Ollama
#[tauri::command]
pub async fn ollama_generate(
    app: tauri::AppHandle,
    model: String,
    prompt: String,
    system: Option<String>,
) -> Result<(), String> {
    let client = Client::new();
    
    let body = serde_json::json!({
        "model": model,
        "prompt": prompt,
        "system": system.unwrap_or_default(),
        "stream": true,
    });
    
    let mut response = client
        .post("http://localhost:11434/api/generate")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;
    
    // Stream response chunks to frontend
    while let Some(chunk) = response.chunk().await.map_err(|e| e.to_string())? {
        let text = String::from_utf8_lossy(&chunk);
        for line in text.lines() {
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(line) {
                if let Some(response_text) = json.get("response").and_then(|v| v.as_str()) {
                    let _ = app.emit("local-llm:stream", response_text);
                }
                if json.get("done").and_then(|v| v.as_bool()) == Some(true) {
                    let _ = app.emit("local-llm:complete", ());
                }
            }
        }
    }
    
    Ok(())
}
```

**Frontend Integration:**
```typescript
// src/lib/local-llm.ts

import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

export interface LocalModel {
  name: string;
  size: number;
  provider: 'ollama' | 'mlx' | 'llama.cpp';
}

export class LocalLLMClient {
  private models: LocalModel[] = [];
  private currentModel: string | null = null;
  
  async detectProviders(): Promise<{
    ollama: boolean;
    mlx: boolean;
    llamaCpp: boolean;
  }> {
    const [ollamaModels, mlxAvailable, llamaCppAvailable] = await Promise.all([
      invoke<LocalModel[]>('detect_ollama').catch(() => []),
      invoke<boolean>('detect_mlx').catch(() => false),
      invoke<boolean>('detect_llama_cpp').catch(() => false),
    ]);
    
    this.models = ollamaModels.map(m => ({
      ...m,
      provider: 'ollama' as const,
    }));
    
    return {
      ollama: ollamaModels.length > 0,
      mlx: mlxAvailable,
      llamaCpp: llamaCppAvailable,
    };
  }
  
  async generate(
    prompt: string,
    options: {
      model?: string;
      system?: string;
      onChunk: (text: string) => void;
      onComplete: () => void;
    }
  ): Promise<void> {
    const model = options.model || this.currentModel || this.models[0]?.name;
    if (!model) throw new Error('No local model available');
    
    // Set up event listeners
    const unlistenStream = await listen<string>('local-llm:stream', (event) => {
      options.onChunk(event.payload);
    });
    
    const unlistenComplete = await listen('local-llm:complete', () => {
      options.onComplete();
      unlistenStream();
      unlistenComplete();
    });
    
    // Start generation
    await invoke('ollama_generate', {
      model,
      prompt,
      system: options.system,
    });
  }
}

export const localLLM = new LocalLLMClient();
```

### 2.4 MLX Integration (macOS)

MLX provides superior performance on Apple Silicon. For macOS users, we should detect and prefer MLX when available.

```rust
// src-tauri/src/mlx.rs

#[cfg(target_os = "macos")]
pub mod mlx {
    use std::process::Command;
    
    /// Check if MLX is available (Python with mlx-lm installed)
    #[tauri::command]
    pub async fn detect_mlx() -> Result<bool, String> {
        let output = Command::new("python3")
            .args(["-c", "import mlx_lm; print('ok')"])
            .output();
        
        match output {
            Ok(out) => Ok(String::from_utf8_lossy(&out.stdout).contains("ok")),
            Err(_) => Ok(false),
        }
    }
    
    /// Get available MLX models
    #[tauri::command]
    pub async fn list_mlx_models() -> Result<Vec<String>, String> {
        // MLX models are typically in ~/.cache/huggingface/hub/
        // Look for models that have been converted to MLX format
        let home = std::env::var("HOME").map_err(|e| e.to_string())?;
        let mlx_cache = format!("{}/.cache/mlx-models", home);
        
        let mut models = Vec::new();
        if let Ok(entries) = std::fs::read_dir(&mlx_cache) {
            for entry in entries.flatten() {
                if entry.path().is_dir() {
                    if let Some(name) = entry.file_name().to_str() {
                        models.push(name.to_string());
                    }
                }
            }
        }
        
        Ok(models)
    }
}

#[cfg(not(target_os = "macos"))]
pub mod mlx {
    #[tauri::command]
    pub async fn detect_mlx() -> Result<bool, String> {
        Ok(false)
    }
    
    #[tauri::command]
    pub async fn list_mlx_models() -> Result<Vec<String>, String> {
        Ok(Vec::new())
    }
}
```

### 2.5 llama.cpp Integration (Advanced)

For power users who want maximum control, support llama.cpp directly via Tauri sidecar.

```rust
// src-tauri/src/llama_cpp.rs

use std::process::{Child, Command, Stdio};
use std::io::{BufRead, BufReader};
use tauri::{AppHandle, Emitter};

/// Bundled llama.cpp server as sidecar
pub struct LlamaCppServer {
    process: Option<Child>,
    port: u16,
}

impl LlamaCppServer {
    pub fn new() -> Self {
        Self {
            process: None,
            port: 8080,
        }
    }
    
    pub fn start(&mut self, model_path: &str) -> Result<(), String> {
        // Use Tauri's sidecar feature
        let process = Command::new("llama-server")
            .args([
                "-m", model_path,
                "--port", &self.port.to_string(),
                "--ctx-size", "4096",
                "-ngl", "99",  // GPU layers
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| e.to_string())?;
        
        self.process = Some(process);
        Ok(())
    }
    
    pub fn stop(&mut self) {
        if let Some(mut process) = self.process.take() {
            let _ = process.kill();
        }
    }
}
```

**Tauri sidecar configuration:**
```json
// tauri.conf.json
{
  "bundle": {
    "externalBin": [
      "binaries/llama-server"
    ]
  }
}
```

### 2.6 Model Selection UI

```typescript
// src/components/LocalModelPicker.tsx

import { useEffect, useState } from 'react';
import { localLLM, LocalModel } from '../lib/local-llm';

export function LocalModelPicker() {
  const [models, setModels] = useState<LocalModel[]>([]);
  const [providers, setProviders] = useState<{
    ollama: boolean;
    mlx: boolean;
    llamaCpp: boolean;
  }>({ ollama: false, mlx: false, llamaCpp: false });
  const [selected, setSelected] = useState<string | null>(null);
  
  useEffect(() => {
    localLLM.detectProviders().then(setProviders);
  }, []);
  
  return (
    <div className="local-model-picker">
      <h3>Local AI Models</h3>
      
      {!providers.ollama && !providers.mlx && !providers.llamaCpp && (
        <div className="no-providers">
          <p>No local AI providers detected.</p>
          <a href="https://ollama.ai" target="_blank">
            Install Ollama →
          </a>
        </div>
      )}
      
      {providers.ollama && (
        <div className="provider-section">
          <h4>🦙 Ollama</h4>
          {models.filter(m => m.provider === 'ollama').map(model => (
            <button
              key={model.name}
              onClick={() => setSelected(model.name)}
              className={selected === model.name ? 'selected' : ''}
            >
              {model.name}
              <span className="size">{formatSize(model.size)}</span>
            </button>
          ))}
        </div>
      )}
      
      {providers.mlx && (
        <div className="provider-section">
          <h4>🍎 MLX (Apple Silicon)</h4>
          {/* MLX models */}
        </div>
      )}
    </div>
  );
}
```

---

## 3. Data Sync Protocol

### 3.1 Sync Architecture

Molt is primarily a local-first app. Sync is optional and designed for:
- Multiple devices (laptop + desktop)
- Backup to user-controlled storage
- Sharing conversations

```
┌─────────────────────────────────────────────────────────────┐
│                    Sync Architecture                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Device A                              Device B             │
│  ┌──────────┐                         ┌──────────┐         │
│  │ IndexedDB │                         │ IndexedDB │         │
│  │  (local)  │                         │  (local)  │         │
│  └─────┬─────┘                         └─────┬─────┘         │
│        │                                     │               │
│        ▼                                     ▼               │
│  ┌──────────┐                         ┌──────────┐         │
│  │   Sync   │──────────────────────────│   Sync   │         │
│  │  Engine  │      Sync Protocol       │  Engine  │         │
│  └─────┬─────┘                         └─────┬─────┘         │
│        │                                     │               │
│        └─────────────┬───────────────────────┘               │
│                      ▼                                       │
│              ┌──────────────┐                               │
│              │  Sync Target  │                               │
│              │  (optional)   │                               │
│              ├──────────────┤                               │
│              │ • WebDAV     │                               │
│              │ • S3/R2      │                               │
│              │ • iCloud     │                               │
│              │ • Local NAS  │                               │
│              └──────────────┘                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Conflict Resolution (CRDT-Inspired)

**Strategy:** Last-Write-Wins with Tombstones

```typescript
// src/lib/sync/conflict.ts

interface SyncableEntity {
  id: string;
  version: number;  // Lamport timestamp
  updatedAt: Date;
  deletedAt: Date | null;  // Tombstone
  deviceId: string;
  checksum: string;  // Content hash
}

interface ConversationSync extends SyncableEntity {
  title: string;
  messages: MessageSync[];
}

interface MessageSync extends SyncableEntity {
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
}

class ConflictResolver {
  /**
   * Merge two versions of a conversation
   * Strategy: Keep all unique messages, resolve metadata conflicts
   */
  resolveConversation(
    local: ConversationSync,
    remote: ConversationSync
  ): ConversationSync {
    // If either is deleted, keep deletion
    if (local.deletedAt || remote.deletedAt) {
      return local.deletedAt && remote.deletedAt
        ? (local.deletedAt > remote.deletedAt ? local : remote)
        : (local.deletedAt ? local : remote);
    }
    
    // Merge messages (union of both sets)
    const messageMap = new Map<string, MessageSync>();
    
    for (const msg of [...local.messages, ...remote.messages]) {
      const existing = messageMap.get(msg.id);
      if (!existing || msg.version > existing.version) {
        messageMap.set(msg.id, msg);
      }
    }
    
    // Metadata: latest wins
    const winner = local.version > remote.version ? local : remote;
    
    return {
      ...winner,
      messages: Array.from(messageMap.values())
        .filter(m => !m.deletedAt)  // Exclude tombstones
        .sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime()),
      version: Math.max(local.version, remote.version) + 1,
    };
  }
}
```

### 3.3 Sync Protocol

**Format:** JSON Lines (NDJSON) with encryption

```typescript
// src/lib/sync/protocol.ts

interface SyncManifest {
  version: 1;
  deviceId: string;
  lastSync: Date;
  conversations: {
    id: string;
    version: number;
    checksum: string;
  }[];
}

interface SyncPacket {
  type: 'manifest' | 'conversation' | 'ack';
  payload: unknown;
  timestamp: Date;
  signature: string;
}

class SyncEngine {
  private readonly storageAdapter: SyncStorageAdapter;
  private readonly deviceId: string;
  
  constructor(adapter: SyncStorageAdapter) {
    this.storageAdapter = adapter;
    this.deviceId = this.getOrCreateDeviceId();
  }
  
  async sync(): Promise<SyncResult> {
    // 1. Get local manifest
    const localManifest = await this.buildLocalManifest();
    
    // 2. Fetch remote manifest
    const remoteManifest = await this.storageAdapter.getManifest();
    
    // 3. Determine what needs syncing
    const toUpload: string[] = [];
    const toDownload: string[] = [];
    
    for (const local of localManifest.conversations) {
      const remote = remoteManifest?.conversations
        .find(c => c.id === local.id);
      
      if (!remote || local.version > remote.version) {
        toUpload.push(local.id);
      } else if (remote.version > local.version) {
        toDownload.push(local.id);
      } else if (local.checksum !== remote.checksum) {
        // Same version but different content = conflict
        toDownload.push(local.id);  // Will merge
      }
    }
    
    // 4. Download and merge
    for (const id of toDownload) {
      const remote = await this.storageAdapter.getConversation(id);
      const local = await this.getLocalConversation(id);
      const merged = this.conflictResolver.resolveConversation(local, remote);
      await this.saveLocalConversation(merged);
    }
    
    // 5. Upload
    for (const id of toUpload) {
      const local = await this.getLocalConversation(id);
      await this.storageAdapter.putConversation(local);
    }
    
    // 6. Update manifest
    await this.storageAdapter.putManifest(await this.buildLocalManifest());
    
    return {
      uploaded: toUpload.length,
      downloaded: toDownload.length,
      conflicts: 0,  // Resolved automatically
    };
  }
}
```

### 3.4 Storage Adapters

```typescript
// src/lib/sync/adapters.ts

interface SyncStorageAdapter {
  getManifest(): Promise<SyncManifest | null>;
  putManifest(manifest: SyncManifest): Promise<void>;
  getConversation(id: string): Promise<ConversationSync>;
  putConversation(conversation: ConversationSync): Promise<void>;
  deleteConversation(id: string): Promise<void>;
}

// WebDAV adapter (Nextcloud, ownCloud, etc.)
class WebDAVAdapter implements SyncStorageAdapter {
  constructor(
    private readonly url: string,
    private readonly username: string,
    private readonly password: string,
  ) {}
  
  async getManifest(): Promise<SyncManifest | null> {
    const response = await fetch(`${this.url}/molt/manifest.json`, {
      headers: this.authHeaders(),
    });
    if (!response.ok) return null;
    return response.json();
  }
  
  // ... other methods
}

// S3-compatible adapter (AWS, Cloudflare R2, MinIO)
class S3Adapter implements SyncStorageAdapter {
  constructor(
    private readonly bucket: string,
    private readonly accessKey: string,
    private readonly secretKey: string,
    private readonly endpoint?: string,  // For R2/MinIO
  ) {}
  
  // ... implementation
}

// iCloud adapter (macOS only, via Tauri plugin)
class ICloudAdapter implements SyncStorageAdapter {
  // Uses NSUbiquitousKeyValueStore or iCloud Drive
  // Requires Tauri plugin for native access
}

// Local folder adapter (NAS, USB drive)
class LocalFolderAdapter implements SyncStorageAdapter {
  constructor(private readonly path: string) {}
  
  async getManifest(): Promise<SyncManifest | null> {
    const manifestPath = `${this.path}/manifest.json`;
    try {
      const content = await readTextFile(manifestPath);
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
}
```

---

## 4. Feature Availability Matrix

### 4.1 By Network State

| Feature | Online | Offline (no local AI) | Offline (with Ollama) | Privacy Mode |
|---------|--------|----------------------|----------------------|--------------|
| **Browse conversations** | ✅ | ✅ | ✅ | ✅ |
| **Search** | ✅ | ✅ | ✅ | ✅ |
| **Send to Claude** | ✅ | ⏳ Queued | ⏳ Queued | ⏳ Queued |
| **Send to local AI** | ✅ | ❌ N/A | ✅ | ✅ |
| **Export** | ✅ | ✅ | ✅ | ✅ |
| **Copy messages** | ✅ | ✅ | ✅ | ✅ |
| **Delete** | ✅ | ✅ | ✅ | ✅ |
| **Sync** | ✅ | ❌ | ❌ | ❌ |
| **Model list refresh** | ✅ | ❌ Cached | ✅ Local only | ❌ |

### 4.2 Network Requirements by Feature

```typescript
// src/lib/feature-flags.ts

type NetworkRequirement = 
  | 'none'           // Works completely offline
  | 'optional'       // Enhanced with network, works without
  | 'required'       // Cannot function without network
  | 'local-llm'      // Requires local LLM if offline
  | 'queued';        // Can be deferred until online

const FEATURE_NETWORK_REQUIREMENTS: Record<string, NetworkRequirement> = {
  // Core features - work offline
  'browse-conversations': 'none',
  'search': 'none',
  'delete-conversation': 'none',
  'copy-message': 'none',
  'export-markdown': 'none',
  'export-json': 'none',
  'settings': 'none',
  
  // AI features - depend on mode
  'send-message-cloud': 'queued',
  'send-message-local': 'local-llm',
  
  // Sync features - require network
  'sync': 'required',
  'refresh-models': 'optional',  // Uses cached list
};
```

---

## 5. Connection State Machine

### 5.1 State Diagram

```
                    ┌─────────────────────────────────────────┐
                    │                                         │
                    ▼                                         │
             ┌──────────┐                                     │
             │          │                                     │
    ┌───────▶│ OFFLINE  │◀────────┐                          │
    │        │          │         │                          │
    │        └────┬─────┘         │                          │
    │             │               │                          │
    │   Network   │               │  Lost                    │
    │   detected  │               │  connection              │
    │             ▼               │                          │
    │        ┌──────────┐         │                          │
    │        │          │         │                          │
    │        │CONNECTING│─────────┤                          │
    │        │          │         │                          │
    │        └────┬─────┘         │                          │
    │             │               │                          │
    │   Connected │               │                          │
    │             ▼               │                          │
    │        ┌──────────┐         │                          │
    │        │          │─────────┘                          │
    │        │  ONLINE  │                                    │
    │        │          │                                    │
    │        └────┬─────┘                                    │
    │             │                                          │
    │   User      │                                          │
    │   toggle    ▼                                          │
    │        ┌──────────┐                                    │
    │        │          │                                    │
    └────────│ PRIVACY  │────────────────────────────────────┘
             │  MODE    │      User disables
             │          │
             └──────────┘
```

### 5.2 State Implementation

```typescript
// src/stores/connection-store.ts

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';

type ConnectionState = 
  | 'offline'
  | 'connecting'
  | 'online'
  | 'reconnecting'
  | 'privacy-mode';

interface ConnectionStore {
  state: ConnectionState;
  lastOnline: Date | null;
  gatewayUrl: string | null;
  localLLMAvailable: boolean;
  reconnectAttempts: number;
  
  // Actions
  connect: (url: string, token: string) => Promise<void>;
  disconnect: () => void;
  enablePrivacyMode: () => void;
  disablePrivacyMode: () => void;
}

export const useConnection = create<ConnectionStore>((set, get) => ({
  state: 'offline',
  lastOnline: null,
  gatewayUrl: null,
  localLLMAvailable: false,
  reconnectAttempts: 0,
  
  connect: async (url, token) => {
    set({ state: 'connecting' });
    
    try {
      await invoke('connect', { url, token });
      set({ 
        state: 'online',
        lastOnline: new Date(),
        gatewayUrl: url,
        reconnectAttempts: 0,
      });
    } catch (error) {
      // Check if local LLM is available
      const localAvailable = await checkLocalLLM();
      set({ 
        state: 'offline',
        localLLMAvailable: localAvailable,
      });
    }
  },
  
  disconnect: () => {
    invoke('disconnect');
    set({ state: 'offline' });
  },
  
  enablePrivacyMode: () => {
    invoke('disconnect');
    set({ state: 'privacy-mode' });
  },
  
  disablePrivacyMode: async () => {
    const { gatewayUrl } = get();
    if (gatewayUrl) {
      set({ state: 'connecting' });
      // Re-connect will be handled by connect()
    } else {
      set({ state: 'offline' });
    }
  },
}));

// Set up connection monitoring
async function initConnectionMonitoring() {
  // Listen for gateway events
  await listen('gateway:connected', () => {
    useConnection.setState({ state: 'online', lastOnline: new Date() });
  });
  
  await listen('gateway:disconnected', () => {
    const { state } = useConnection.getState();
    if (state !== 'privacy-mode') {
      useConnection.setState({ state: 'offline' });
      scheduleReconnect();
    }
  });
  
  await listen('gateway:error', () => {
    const { state, reconnectAttempts } = useConnection.getState();
    if (state !== 'privacy-mode') {
      useConnection.setState({ 
        state: 'reconnecting',
        reconnectAttempts: reconnectAttempts + 1,
      });
      scheduleReconnect();
    }
  });
  
  // Check local LLM periodically
  setInterval(async () => {
    const available = await checkLocalLLM();
    useConnection.setState({ localLLMAvailable: available });
  }, 30000);  // Every 30 seconds
}

async function checkLocalLLM(): Promise<boolean> {
  try {
    const models = await invoke<any[]>('detect_ollama');
    return models.length > 0;
  } catch {
    return false;
  }
}

function scheduleReconnect() {
  const { reconnectAttempts, state } = useConnection.getState();
  if (state === 'privacy-mode') return;
  
  const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 30000);
  setTimeout(async () => {
    const { gatewayUrl } = useConnection.getState();
    if (gatewayUrl) {
      // Try to reconnect
      const token = await getStoredToken();
      useConnection.getState().connect(gatewayUrl, token);
    }
  }, delay);
}
```

---

## 6. Implementation Plan

### 6.1 Phase Overview

| Phase | Focus | Duration | Priority |
|-------|-------|----------|----------|
| **Phase 1** | Connection state machine | 1 week | P0 |
| **Phase 2** | Message queue | 1 week | P0 |
| **Phase 3** | Ollama integration | 2 weeks | P1 |
| **Phase 4** | Privacy mode | 1 week | P2 |
| **Phase 5** | Sync protocol | 3 weeks | P3 |
| **Phase 6** | MLX/llama.cpp | 2 weeks | P3 |

### 6.2 Phase 1: Connection State Machine

**Goal:** Graceful handling of network state changes

**Tasks:**
1. [ ] Create `connection-store.ts` with state machine
2. [ ] Add network event listeners (online/offline)
3. [ ] Implement reconnection logic with exponential backoff
4. [ ] Add connection status indicator to UI
5. [ ] Update existing gateway code to emit proper events

**Files to modify:**
- `src/stores/store.ts` → Extract connection state
- `src-tauri/src/gateway.rs` → Add health check, reconnection
- `src/components/StatusBar.tsx` → Show connection state
- `src/App.tsx` → Initialize connection monitoring

### 6.3 Phase 2: Message Queue

**Goal:** Never lose user messages

**Tasks:**
1. [ ] Create `message-queue.ts` with persistence
2. [ ] Add queue to IndexedDB schema (new table)
3. [ ] Implement queue processing on reconnection
4. [ ] Add "pending" state to message UI
5. [ ] Add "retry" button for failed messages

**New files:**
- `src/lib/message-queue.ts`
- `src/lib/db.ts` (add `queuedMessages` table)

**Schema addition:**
```typescript
// Add to db.ts
interface DBQueuedMessage {
  id: string;
  conversationId: string;
  content: string;
  timestamp: Date;
  retryCount: number;
  lastAttempt: Date | null;
  status: 'pending' | 'sending' | 'failed';
  model: string;
}

// In MoltDB constructor
this.version(2).stores({
  messages: 'id, conversationId, timestamp, *searchWords',
  conversations: 'id, updatedAt, isPinned',
  settings: 'key',
  queuedMessages: 'id, conversationId, status, timestamp',  // NEW
});
```

### 6.4 Phase 3: Ollama Integration

**Goal:** Working local AI when offline

**Tasks:**
1. [ ] Create Rust module for Ollama detection
2. [ ] Add Ollama generate command with streaming
3. [ ] Create `LocalModelPicker` component
4. [ ] Add "Use local AI" toggle in chat
5. [ ] Auto-fallback to Ollama when Gateway unavailable
6. [ ] Add model download management (optional)

**New files:**
- `src-tauri/src/local_llm.rs`
- `src/lib/local-llm.ts`
- `src/components/LocalModelPicker.tsx`

### 6.5 Phase 4: Privacy Mode

**Goal:** Intentional offline operation

**Tasks:**
1. [ ] Add Privacy Mode toggle to settings
2. [ ] Disconnect from Gateway when enabled
3. [ ] Block all network requests (enforce in Rust)
4. [ ] Route all messages to local LLM
5. [ ] Visual indicator in UI
6. [ ] Option to queue messages for later cloud processing

**Files to modify:**
- `src/components/SettingsDialog.tsx`
- `src/stores/connection-store.ts`
- `src-tauri/src/lib.rs` (add privacy mode state)

### 6.6 Phase 5: Sync Protocol

**Goal:** Multi-device support

**Tasks:**
1. [ ] Design sync manifest format
2. [ ] Implement CRDT-style conflict resolution
3. [ ] Create WebDAV adapter (most common)
4. [ ] Create S3/R2 adapter
5. [ ] Add sync settings UI
6. [ ] Add sync status indicator
7. [ ] Implement full sync flow

**New files:**
- `src/lib/sync/protocol.ts`
- `src/lib/sync/conflict.ts`
- `src/lib/sync/adapters/webdav.ts`
- `src/lib/sync/adapters/s3.ts`
- `src/components/SyncSettings.tsx`

### 6.7 Phase 6: MLX & llama.cpp

**Goal:** Maximum performance for power users

**Tasks:**
1. [ ] Create MLX detection (macOS only)
2. [ ] Implement MLX inference wrapper
3. [ ] Bundle llama.cpp as Tauri sidecar
4. [ ] Add model management (download, delete)
5. [ ] Benchmark and optimize

---

## 7. User Experience

### 7.1 Connection Status Indicator

Always visible, never intrusive:

```
┌────────────────────────────────────────────────────────────┐
│  ┌──────────────────┐                                      │
│  │ ● Connected      │  ← Green dot, minimal text           │
│  └──────────────────┘                                      │
│                                                            │
│  ┌──────────────────┐                                      │
│  │ ○ Offline        │  ← Gray dot, shows local AI status   │
│  │   Using Ollama   │                                      │
│  └──────────────────┘                                      │
│                                                            │
│  ┌──────────────────┐                                      │
│  │ ◐ Reconnecting..│  ← Animated, shows attempt count     │
│  │   (3/5)         │                                      │
│  └──────────────────┘                                      │
│                                                            │
│  ┌──────────────────┐                                      │
│  │ 🔒 Privacy Mode  │  ← Lock icon, intentional           │
│  │   Local AI only │                                      │
│  └──────────────────┘                                      │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 7.2 Queued Message UI

```typescript
// src/components/MessageBubble.tsx

function MessageBubble({ message, queueStatus }: Props) {
  return (
    <div className={cn('message', queueStatus && 'queued')}>
      <div className="content">{message.content}</div>
      
      {queueStatus === 'pending' && (
        <div className="queue-indicator">
          <ClockIcon className="w-4 h-4" />
          <span>Waiting to send...</span>
        </div>
      )}
      
      {queueStatus === 'sending' && (
        <div className="queue-indicator">
          <Spinner className="w-4 h-4" />
          <span>Sending...</span>
        </div>
      )}
      
      {queueStatus === 'failed' && (
        <div className="queue-indicator error">
          <ExclamationIcon className="w-4 h-4" />
          <span>Failed to send</span>
          <button onClick={retry}>Retry</button>
        </div>
      )}
    </div>
  );
}
```

### 7.3 Offline Notification

Show once per session, dismissible:

```typescript
// src/components/OfflineBanner.tsx

function OfflineBanner() {
  const { state, localLLMAvailable } = useConnection();
  const [dismissed, setDismissed] = useState(false);
  
  if (state === 'online' || dismissed) return null;
  
  return (
    <div className="offline-banner">
      <WifiOffIcon />
      <div className="content">
        <strong>You're offline</strong>
        {localLLMAvailable ? (
          <p>Chat is available using your local AI (Ollama)</p>
        ) : (
          <p>Messages will be sent when you're back online</p>
        )}
      </div>
      <button onClick={() => setDismissed(true)}>
        <XIcon />
      </button>
    </div>
  );
}
```

### 7.4 Local Model Setup Flow

First-time offline experience:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│           🦙 Set Up Local AI                               │
│                                                             │
│  To chat offline, you need a local AI model.               │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ◉ Ollama (Recommended)                              │   │
│  │    Easy setup, many models                           │   │
│  │    → Install Ollama                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  ○ Skip for now                                      │   │
│  │    Messages will queue until online                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Skip]                               [Set Up Ollama →]    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 8. Testing Strategy

### 8.1 Offline Simulation

```typescript
// tests/offline.spec.ts

import { test, expect } from '@playwright/test';

test.describe('Offline Mode', () => {
  test('should show offline indicator when disconnected', async ({ page, context }) => {
    // Simulate offline
    await context.setOffline(true);
    
    await page.goto('/');
    await expect(page.locator('.connection-status')).toContainText('Offline');
  });
  
  test('should queue messages when offline', async ({ page, context }) => {
    await page.goto('/');
    
    // Go offline
    await context.setOffline(true);
    
    // Send message
    await page.fill('[data-testid="chat-input"]', 'Hello offline');
    await page.click('[data-testid="send-button"]');
    
    // Should show queued
    await expect(page.locator('.queue-indicator')).toBeVisible();
    
    // Go online
    await context.setOffline(false);
    
    // Should send
    await expect(page.locator('.queue-indicator')).not.toBeVisible();
  });
  
  test('should use local LLM when offline', async ({ page }) => {
    // Mock Ollama
    await page.route('http://localhost:11434/**', (route) => {
      if (route.request().url().includes('/api/tags')) {
        route.fulfill({
          json: { models: [{ name: 'llama3.2' }] },
        });
      } else if (route.request().url().includes('/api/generate')) {
        route.fulfill({
          body: '{"response":"Hello from local AI","done":true}',
        });
      }
    });
    
    // Disconnect from gateway
    await page.evaluate(() => {
      window.dispatchEvent(new Event('offline'));
    });
    
    // Send message
    await page.fill('[data-testid="chat-input"]', 'Hello');
    await page.click('[data-testid="send-button"]');
    
    // Should get response from local AI
    await expect(page.locator('.message.assistant')).toContainText('Hello from local AI');
  });
});
```

### 8.2 Manual Testing Checklist

- [ ] Kill Gateway process → App still works
- [ ] Disable WiFi → Messages queue
- [ ] Re-enable WiFi → Messages send
- [ ] Start Ollama → Model appears in picker
- [ ] Send with Ollama → Response streams
- [ ] Enable Privacy Mode → No network requests (check dev tools)
- [ ] Sync to WebDAV → Files appear
- [ ] Conflict: edit on two devices → Both changes preserved

---

## 9. Security Considerations

### 9.1 Local LLM Privacy

- Local LLM responses never leave the device
- No telemetry or analytics for offline usage
- Model files are user-controlled
- Privacy mode blocks ALL network (enforced in Rust)

### 9.2 Sync Security

- All synced data remains encrypted
- Encryption key never syncs (device-bound)
- Sync uses user's own storage (no third-party)
- Optional: additional sync-layer encryption

### 9.3 Message Queue Security

- Queued messages encrypted in IndexedDB
- Queue cleared on logout
- Failed messages expire after 7 days

---

## 10. Future Considerations

### 10.1 Potential Enhancements

1. **P2P Sync** - Direct device-to-device sync without cloud
2. **Background Sync** - Tauri background service for sync
3. **Model Hub** - In-app model browsing and download
4. **Offline Export** - Export to PDF/DOCX without network
5. **Voice Input** - Local whisper.cpp for speech-to-text

### 10.2 Not In Scope

- Real-time collaboration (too complex for MVP)
- End-to-end encrypted sync (encryption already at rest)
- Custom model training (out of scope)

---

## Appendix A: Quick Reference

### Commands

```bash
# Check if Ollama is running
curl http://localhost:11434/api/tags

# Pull a model
ollama pull llama3.2

# Test generation
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2",
  "prompt": "Hello!"
}'
```

### Environment Variables

```bash
# Optional: custom Ollama URL
MOLT_OLLAMA_URL=http://localhost:11434

# Optional: custom sync folder
MOLT_SYNC_PATH=/path/to/sync

# Debug: verbose connection logging
MOLT_DEBUG_CONNECTION=1
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Gateway** | Clawdbot backend server that routes messages to AI providers |
| **Ollama** | Local LLM server that runs models on your machine |
| **MLX** | Apple's ML framework optimized for Apple Silicon |
| **CRDT** | Conflict-free Replicated Data Type - merge strategy |
| **Tombstone** | Marker for deleted items to prevent resurrection on sync |
| **Privacy Mode** | User-enabled offline mode that blocks all network |

---

*Document maintained by the Molt team. Last updated: 2025-01-20*
