# Demo Mode & Frictionless Onboarding Design

## Executive Summary

**Goal**: Allow users to experience Molt without requiring Gateway setup, reducing the barrier to adoption while demonstrating the app's value.

**Recommendation**: Implement **Direct API Mode** for V1, with a **Cloud Gateway** as the ideal long-term solution.

---

## 1. The Problem

### Current Flow
```
User downloads Molt
        ↓
Must set up Gateway (requires Node.js, npm, CLI)
        ↓
Configure API keys, ports, security
        ↓
Finally can use Molt
```

### Pain Points
- **Technical barrier**: Setting up Gateway requires technical knowledge
- **Time investment**: 15-30 minutes minimum setup before value
- **Bounce risk**: Users may abandon before experiencing the product
- **No "try before you buy" experience**

### User Journey Gap
Users can't answer "Is this app right for me?" without significant upfront investment.

---

## 2. Solution Analysis

### Option A: Demo Mode (Simulated Responses)

**Description**: Pre-programmed responses that showcase the UI without real AI.

**Implementation**:
```typescript
// src/lib/demo-provider.ts
const DEMO_RESPONSES = [
  { trigger: /hello|hi|hey/i, response: "Hello! I'm in demo mode..." },
  { trigger: /code|program/i, response: "```javascript\n// Demo code\nconsole.log('Hello!');\n```" },
  { trigger: /.*/,  response: "This is a demo response. Connect to Gateway for real AI." }
];

function simulateTyping(text: string, onChunk: (chunk: string) => void) {
  let i = 0;
  const interval = setInterval(() => {
    if (i < text.length) {
      onChunk(text.slice(i, i + 3));
      i += 3;
    } else {
      clearInterval(interval);
    }
  }, 30);
}
```

| Criteria | Rating | Notes |
|----------|--------|-------|
| Technical Complexity | ⭐ Low | ~1-2 days |
| User Experience | ⭐⭐ Poor | Users know it's fake |
| Privacy | ⭐⭐⭐⭐⭐ Excellent | No data leaves device |
| Cost | ⭐⭐⭐⭐⭐ Free | Zero ongoing cost |
| Time to Implement | 1-2 days | |

**Verdict**: ❌ Not recommended - doesn't demonstrate real value.

---

### Option B: Cloud Gateway (Hosted Instance)

**Description**: Anthropic/David-hosted Gateway that new users can connect to.

**Implementation**:
```
demo.moltbot.io
      ↓
  Load Balancer
      ↓
┌─────┴─────┐
│  Gateway  │ (Node.js cluster)
│  Instance │
└─────┬─────┘
      ↓
  AI Providers
  (usage-limited)
```

| Criteria | Rating | Notes |
|----------|--------|-------|
| Technical Complexity | ⭐⭐⭐ Medium | Server infra needed |
| User Experience | ⭐⭐⭐⭐⭐ Excellent | Full functionality |
| Privacy | ⭐⭐ Concerns | User data through 3rd party |
| Cost | ⭐⭐ Ongoing | Server + API costs |
| Time to Implement | 1-2 weeks | |

**Pros**:
- Full Molt experience
- No user setup required
- Easy upgrade path (just change Gateway URL)

**Cons**:
- Privacy: user messages route through your server
- Cost: you pay for API usage
- Trust: users must trust your infrastructure
- Abuse: potential for abuse (rate limiting required)

**Mitigations**:
- Clear privacy policy and terms
- Strict rate limits (e.g., 50 messages/day)
- Account system for tracking usage
- Data retention policy (delete after 24h)

**Verdict**: ⭐ Best long-term solution but requires infrastructure investment.

---

### Option C: Direct API Mode (Recommended for V1)

**Description**: Molt connects directly to AI providers (OpenAI, Anthropic, Google) without Gateway.

**Implementation**:
```
┌─────────────────┐
│   Molt Client   │
└────────┬────────┘
         │ BYOK (Bring Your Own Key)
         ↓
┌─────────────────┐
│  OpenAI API    │ ← User's API key
│  Anthropic API │
│  Google AI     │
└─────────────────┘
```

**Architecture**:
```typescript
// src/lib/direct-api.ts
interface DirectAPIConfig {
  provider: 'openai' | 'anthropic' | 'google';
  apiKey: string;
  model?: string;
}

class DirectAPIClient {
  constructor(private config: DirectAPIConfig) {}
  
  async chat(messages: Message[]): AsyncIterable<StreamChunk> {
    switch (this.config.provider) {
      case 'anthropic':
        return this.chatAnthropic(messages);
      case 'openai':
        return this.chatOpenAI(messages);
      case 'google':
        return this.chatGoogle(messages);
    }
  }
  
  private async *chatAnthropic(messages: Message[]): AsyncIterable<StreamChunk> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.config.apiKey,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: this.config.model || 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        stream: true,
        messages: messages.map(m => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.content,
        })),
      }),
    });
    
    // Parse SSE stream
    for await (const chunk of this.parseSSE(response)) {
      yield chunk;
    }
  }
  
  private async *chatOpenAI(messages: Message[]): AsyncIterable<StreamChunk> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model || 'gpt-4o',
        stream: true,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });
    
    for await (const chunk of this.parseSSE(response)) {
      yield chunk;
    }
  }
}
```

| Criteria | Rating | Notes |
|----------|--------|-------|
| Technical Complexity | ⭐⭐ Low-Medium | 3-5 days |
| User Experience | ⭐⭐⭐⭐ Good | Real AI, some setup |
| Privacy | ⭐⭐⭐⭐⭐ Excellent | Direct to provider |
| Cost | ⭐⭐⭐⭐⭐ User pays | User's API key |
| Time to Implement | 3-5 days | |

**Pros**:
- Real AI experience
- No Gateway infrastructure needed
- User owns their data (direct to provider)
- Zero ongoing cost for you
- Privacy: messages never touch your servers
- Users can try immediately with their existing API keys

**Cons**:
- Requires user to have API key
- Missing Gateway features (tools, skills, channels)
- Limited to basic chat functionality

**Feature Parity Matrix**:
| Feature | Gateway | Direct API |
|---------|---------|------------|
| Chat | ✅ | ✅ |
| Streaming | ✅ | ✅ |
| Multiple models | ✅ | ✅ |
| Tool use | ✅ | ❌ |
| Skills | ✅ | ❌ |
| Channels (Discord, etc.) | ✅ | ❌ |
| Session management | ✅ | Local only |
| Extended thinking | ✅ | ✅ (Anthropic) |

**Verdict**: ⭐⭐⭐⭐⭐ **Best for V1** - Quick to implement, real AI, zero infrastructure.

---

### Option D: Local LLM (Ollama/llama.cpp)

**Description**: Built-in local AI for completely offline demo.

**Implementation**:
```
┌─────────────────┐
│   Molt Client   │
└────────┬────────┘
         │ Local HTTP
         ↓
┌─────────────────┐
│  Ollama        │ (bundled or user-installed)
│  llama.cpp     │
└─────────────────┘
```

| Criteria | Rating | Notes |
|----------|--------|-------|
| Technical Complexity | ⭐⭐⭐⭐ High | Binary bundling, cross-platform |
| User Experience | ⭐⭐⭐ Mixed | Slower, varies by hardware |
| Privacy | ⭐⭐⭐⭐⭐ Excellent | Completely offline |
| Cost | ⭐⭐⭐⭐⭐ Free | No API costs |
| Time to Implement | 2-4 weeks | |

**Pros**:
- Completely offline
- No API keys needed
- Privacy maximized

**Cons**:
- Large binary sizes (models are 4GB+)
- Performance varies dramatically by hardware
- Quality gap vs. Claude/GPT-4
- Complex cross-platform bundling

**Verdict**: ❌ Too complex for V1, interesting for future "offline mode".

---

## 3. Recommendation

### V1: Direct API Mode

**Why**:
1. **Fastest path to value**: 3-5 days implementation
2. **Real AI experience**: Not a fake demo
3. **Zero infrastructure**: No servers to maintain
4. **Privacy-first**: User data goes directly to providers
5. **User investment**: Users with API keys are more likely to be power users

### Long-term: Cloud Gateway

Once Molt has traction:
1. Launch `demo.moltbot.io` with rate-limited free tier
2. Users can try full Gateway experience
3. Easy upgrade: change URL to self-hosted Gateway
4. Monetization opportunity: premium cloud tiers

---

## 4. Implementation Spec for Direct API Mode

### 4.1 UI Changes

#### Connection Screen (Updated)
```
┌────────────────────────────────────────────────────────────┐
│                    Connect to Molt                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ 🌐 Gateway (Recommended)                             │  │
│  │    Connect to your self-hosted Moltbot Gateway      │  │
│  │    Full features: tools, skills, channels           │  │
│  │    [Connect to Gateway →]                           │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ ⚡ Direct API (Quick Start)                          │  │
│  │    Connect directly with your API key               │  │
│  │    Basic chat with Claude, GPT-4, Gemini            │  │
│  │    [Use Direct API →]                               │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  Don't have an API key? [Get one →]                       │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### Direct API Setup
```
┌────────────────────────────────────────────────────────────┐
│                   Direct API Setup                         │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  Provider:                                                 │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ [●] Anthropic (Claude)    [ ] OpenAI    [ ] Google  │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  API Key:                                                  │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ sk-ant-api03-XXXX...                          [👁]  │  │
│  └─────────────────────────────────────────────────────┘  │
│  🔒 Stored securely in your system keychain               │
│                                                            │
│  Model:                                                    │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ claude-sonnet-4-20250514                         ▼  │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ⚠️ Direct API mode has limited features:                  │
│     • No tool use (file access, web browsing)             │
│     • No multi-channel support                            │
│     • No skills integration                               │
│     [Learn about Gateway →]                               │
│                                                            │
│                              [Cancel]  [Connect]          │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

#### Indicator Badge
When in Direct API mode, show subtle indicator:
```
┌──────────────────────────────────────────────────────────────┐
│ Molt Chat                                    ⚡ Direct API   │
├──────────────────────────────────────────────────────────────┤
```

### 4.2 Backend Changes

#### New Files

**`src/lib/providers/index.ts`**
```typescript
export type ProviderType = 'gateway' | 'direct-anthropic' | 'direct-openai' | 'direct-google';

export interface ChatProvider {
  chat(messages: Message[], options: ChatOptions): AsyncIterable<StreamChunk>;
  listModels(): Promise<ModelInfo[]>;
  validateKey(): Promise<boolean>;
}

export function createProvider(type: ProviderType, config: ProviderConfig): ChatProvider {
  switch (type) {
    case 'gateway':
      return new GatewayProvider(config);
    case 'direct-anthropic':
      return new AnthropicProvider(config);
    case 'direct-openai':
      return new OpenAIProvider(config);
    case 'direct-google':
      return new GoogleProvider(config);
  }
}
```

**`src/lib/providers/anthropic.ts`**
```typescript
export class AnthropicProvider implements ChatProvider {
  private apiKey: string;
  
  constructor(config: { apiKey: string }) {
    this.apiKey = config.apiKey;
  }
  
  async *chat(messages: Message[], options: ChatOptions): AsyncIterable<StreamChunk> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options.model || 'claude-sonnet-4-20250514',
        max_tokens: options.maxTokens || 4096,
        stream: true,
        messages: this.formatMessages(messages),
        ...(options.thinking && { 
          thinking: { 
            type: 'enabled', 
            budget_tokens: 10000 
          } 
        }),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') return;
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.type === 'content_block_delta') {
              yield {
                content: parsed.delta?.text || '',
                done: false,
              };
            } else if (parsed.type === 'message_stop') {
              yield { done: true };
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    // Anthropic doesn't have a models endpoint, return known models
    return [
      { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', provider: 'anthropic' },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', provider: 'anthropic' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic' },
    ];
  }

  async validateKey(): Promise<boolean> {
    try {
      // Make a minimal request to validate
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'content-type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-haiku-20241022',
          max_tokens: 1,
          messages: [{ role: 'user', content: 'hi' }],
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private formatMessages(messages: Message[]) {
    return messages
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));
  }
}
```

**`src/lib/providers/openai.ts`**
```typescript
export class OpenAIProvider implements ChatProvider {
  private apiKey: string;
  
  constructor(config: { apiKey: string }) {
    this.apiKey = config.apiKey;
  }
  
  async *chat(messages: Message[], options: ChatOptions): AsyncIterable<StreamChunk> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: options.model || 'gpt-4o',
        stream: true,
        messages: messages.map(m => ({
          role: m.role,
          content: m.content,
        })),
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'API request failed');
    }

    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            yield { done: true };
            return;
          }
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              yield { content, done: false };
            }
          } catch (e) {
            // Skip malformed JSON
          }
        }
      }
    }
  }

  async listModels(): Promise<ModelInfo[]> {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${this.apiKey}` },
    });
    
    if (!response.ok) return this.getDefaultModels();
    
    const data = await response.json();
    return data.data
      .filter((m: any) => m.id.includes('gpt'))
      .map((m: any) => ({
        id: m.id,
        name: this.formatModelName(m.id),
        provider: 'openai',
      }));
  }

  async validateKey(): Promise<boolean> {
    try {
      const response = await fetch('https://api.openai.com/v1/models', {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }

  private getDefaultModels(): ModelInfo[] {
    return [
      { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
    ];
  }

  private formatModelName(id: string): string {
    return id
      .replace('gpt-', 'GPT-')
      .replace('-turbo', ' Turbo')
      .replace('-mini', ' Mini');
  }
}
```

#### Store Updates

**`src/stores/store.ts`** - Add connection mode:
```typescript
interface Settings {
  // Existing
  gatewayUrl: string;
  gatewayToken: string;
  defaultModel: string;
  thinkingDefault: boolean;
  theme: "light" | "dark" | "system";
  
  // New
  connectionMode: 'gateway' | 'direct';
  directProvider?: 'anthropic' | 'openai' | 'google';
  directApiKey?: string;
}

interface Store {
  // Existing...
  
  // New
  provider: ChatProvider | null;
  connectionMode: 'gateway' | 'direct' | null;
  initializeProvider: (mode: 'gateway' | 'direct', config: ProviderConfig) => Promise<void>;
}
```

### 4.3 Rust Backend Changes (Minimal)

Add keychain storage for API keys (already exists, just expand):

**`src-tauri/src/keychain.rs`**:
```rust
#[tauri::command]
pub fn set_api_key(provider: &str, key: &str) -> Result<(), String> {
    let service = format!("molt.direct.{}", provider);
    keyring::Entry::new(&service, "api_key")?
        .set_password(key)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_api_key(provider: &str) -> Result<String, String> {
    let service = format!("molt.direct.{}", provider);
    keyring::Entry::new(&service, "api_key")?
        .get_password()
        .map_err(|e| e.to_string())
}
```

### 4.4 Component Structure

```
src/
├── components/
│   ├── onboarding/
│   │   ├── ConnectionChoice.tsx      # New: Gateway vs Direct choice
│   │   ├── GatewaySetup.tsx          # Existing (renamed)
│   │   ├── DirectAPISetup.tsx        # New: API key entry
│   │   └── index.tsx                 # Orchestrator
│   └── ...
├── lib/
│   ├── providers/
│   │   ├── index.ts                  # Provider factory
│   │   ├── gateway.ts                # Gateway WebSocket client
│   │   ├── anthropic.ts              # Direct Anthropic API
│   │   ├── openai.ts                 # Direct OpenAI API
│   │   └── google.ts                 # Direct Google AI API
│   └── ...
└── ...
```

### 4.5 Migration Path

```
                                 ┌──────────────┐
                                 │ Direct API   │
                                 │    User      │
                                 └──────┬───────┘
                                        │
                                        │ Sees advanced features
                                        │ in documentation
                                        ↓
                                 ┌──────────────┐
                                 │  Prompted to │
                                 │   upgrade    │
                                 └──────┬───────┘
                                        │
                           ┌────────────┴────────────┐
                           │                         │
                           ↓                         ↓
                    ┌──────────────┐         ┌──────────────┐
                    │ Self-hosted  │         │   Cloud      │
                    │   Gateway    │         │   Gateway    │
                    │   (Power)    │         │  (Future)    │
                    └──────────────┘         └──────────────┘
```

### 4.6 Test Plan

1. **Unit Tests**:
   - Provider factory creates correct provider
   - Each provider correctly formats messages
   - SSE parsing handles all edge cases
   - Key validation works for valid/invalid keys

2. **Integration Tests**:
   - Anthropic streaming chat
   - OpenAI streaming chat
   - Error handling (rate limits, invalid keys)
   - Model listing

3. **E2E Tests**:
   - Complete onboarding flow (Direct API path)
   - Switching between Gateway and Direct API
   - Conversation persistence in Direct API mode

---

## 5. Implementation Timeline

### Phase 1: Core Direct API (3 days)
- [ ] Provider abstraction layer
- [ ] Anthropic provider with streaming
- [ ] OpenAI provider with streaming
- [ ] Store updates for connection mode

### Phase 2: UI Integration (2 days)
- [ ] Connection choice screen
- [ ] Direct API setup component
- [ ] Mode indicator badge
- [ ] Settings integration

### Phase 3: Polish & Testing (2 days)
- [ ] Error handling & user feedback
- [ ] Key validation on entry
- [ ] Unit tests
- [ ] E2E tests for both flows

**Total: ~7 days**

---

## 6. Future Enhancements

### Short-term (Post-V1)
- Google AI (Gemini) provider
- Model selection per conversation
- Usage tracking/estimation

### Medium-term
- Cloud Gateway (demo.moltbot.io)
- Account system for cloud tier
- Feature comparison overlay

### Long-term
- Local LLM mode (Ollama)
- Hybrid mode (Gateway + Direct fallback)
- Multi-provider routing

---

## 7. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to first message | < 2 minutes | Analytics |
| Direct API adoption | > 30% of new users | Usage stats |
| Conversion to Gateway | > 20% of Direct users | Tracking |
| Bounce rate reduction | -50% | Before/after |

---

## 8. Open Questions

1. **Should we include a free trial?**
   - Could offer 10 free messages using our API key
   - Risk: abuse potential
   - Alternative: Partner with Anthropic/OpenAI for trial credits

2. **Google AI support priority?**
   - Gemini is free tier friendly
   - But API is less mature than Anthropic/OpenAI
   - Recommendation: Add in Phase 2

3. **Offline detection?**
   - Should we show demo mode when offline?
   - Or just error gracefully?
   - Recommendation: Error gracefully with helpful message

---

## Appendix: API Reference Links

- [Anthropic Messages API](https://docs.anthropic.com/claude/reference/messages)
- [OpenAI Chat Completions](https://platform.openai.com/docs/api-reference/chat)
- [Google AI Gemini](https://ai.google.dev/gemini-api/docs)
