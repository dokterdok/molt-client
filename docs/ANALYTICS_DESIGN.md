# Analytics & Telemetry Design for Molt

## Executive Summary

This document specifies a **privacy-first analytics system** for Molt that respects the app's core philosophy of keeping user data local and private, while providing actionable insights for product improvement.

**Key principles:**
- 🔒 **Opt-in by default** — Analytics disabled until user explicitly enables
- 🏠 **Local-first derivation** — Compute metrics locally, transmit only aggregates
- 👻 **Anonymous by design** — No user IDs, device fingerprinting, or PII
- 🔍 **Transparent collection** — Users can see exactly what's collected
- ⚖️ **GDPR/CCPA compliant** — Full data control, deletion rights

---

## Table of Contents

1. [What to Measure](#1-what-to-measure)
2. [Privacy-First Approach](#2-privacy-first-approach)
3. [Implementation Options Analysis](#3-implementation-options-analysis)
4. [Dashboard Design](#4-dashboard-design)
5. [Implementation Specification](#5-implementation-specification)
6. [Tauri Integration](#6-tauri-integration)
7. [Data Lifecycle](#7-data-lifecycle)
8. [Compliance Checklist](#8-compliance-checklist)

---

## 1. What to Measure

### 1.1 Onboarding Funnel

Track where users drop off during initial setup to improve first-run experience.

| Step | Event Name | Purpose |
|------|------------|---------|
| App launched | `onboarding.started` | Total installs that run |
| Gateway URL entered | `onboarding.gateway_entered` | Users who attempt setup |
| Connection tested | `onboarding.connection_tested` | Users who complete config |
| First message sent | `onboarding.first_message` | Users who actually use app |
| Conversation completed | `onboarding.conversation_complete` | Users with full round-trip |

**Derived locally (not transmitted):**
- Time spent on each step (sensitive — could indicate confusion)
- Number of failed connection attempts

**Funnel visualization:**
```
App Launch → Gateway Config → First Message → Active User
   100%    →     85%       →     60%       →    45%
```

### 1.2 Feature Usage

Understand which features are popular and which are ignored.

| Feature | Event Name | Properties (anonymized) |
|---------|------------|------------------------|
| New conversation | `feature.new_conversation` | `count_bucket`: "1-5", "5-20", "20+" |
| Search used | `feature.search` | `result_count_bucket`: "0", "1-5", "6+" |
| Pin conversation | `feature.pin` | — |
| Model changed | `feature.model_change` | `model_family`: "claude", "gpt", "gemini" |
| Thinking mode | `feature.thinking_enabled` | — |
| Theme switched | `feature.theme_change` | `theme`: "light", "dark", "system" |
| Settings opened | `feature.settings_open` | — |
| Keyboard shortcut | `feature.keyboard_shortcut` | `shortcut_category`: "navigation", "action" |

**NOT tracked:**
- Message content (never!)
- Conversation titles
- Specific models used (only family)
- Search queries
- Custom settings values

### 1.3 Performance Metrics

Monitor app health without compromising privacy.

| Metric | Collection Method | Anonymization |
|--------|-------------------|---------------|
| Startup time | Local measurement | Bucketed: "<1s", "1-3s", "3-5s", "5s+" |
| Memory usage (peak) | Periodic sampling | Bucketed: "<100MB", "100-200MB", "200MB+" |
| Crash rate | Crash handler | Stack trace stripped of PII |
| Message stream latency | Per-message | Bucketed: "<500ms", "500-2000ms", "2s+" |
| Database operations | Aggregated daily | Count only, no query details |

**Crash reporting (opt-in separately):**
- Stack trace without memory addresses
- App version + OS family (not version)
- No user data, no conversation context
- Sentry-style grouping without raw payloads

### 1.4 Retention & Engagement

Track user patterns without individual identification.

| Metric | How Calculated | Privacy Approach |
|--------|----------------|------------------|
| DAU/WAU/MAU | Unique anonymous tokens | Token rotates monthly |
| Session length | Local calculation | Bucketed: "<5m", "5-30m", "30m-2h", "2h+" |
| Session frequency | Local counter | "daily", "weekly", "monthly" |
| Conversations/session | Local aggregate | Bucketed counts |
| Messages/session | Local aggregate | Bucketed counts |

**Anonymous session tokens:**
```
token = hash(random_device_id + month + year)
```
- Token is re-randomizable by user at any time
- Token rotates automatically each month
- Cannot be linked to device/user identity
- Can be deleted entirely (resets analytics)

### 1.5 Session Patterns

Understand usage patterns for product decisions.

| Pattern | Measurement | Bucketing |
|---------|-------------|-----------|
| Time of day | Local time bucket | "morning", "afternoon", "evening", "night" |
| Day of week | Day bucket | "weekday", "weekend" |
| Platform distribution | OS family | "windows", "macos", "linux" |
| Version adoption | App version | Major.Minor only |

---

## 2. Privacy-First Approach

### 2.1 Consent Model

```
┌─────────────────────────────────────────────────────────────┐
│                    Analytics Preferences                     │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Molt doesn't track anything by default. You can help      │
│  improve the app by sharing anonymous usage data.          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📊 Basic Analytics                          [ OFF ] │   │
│  │    Feature usage, session stats, retention          │   │
│  │    No personal data, fully anonymized               │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 🐛 Crash Reports                            [ OFF ] │   │
│  │    Anonymous crash logs to fix bugs faster          │   │
│  │    No conversation content included                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 📈 Performance Metrics                      [ OFF ] │   │
│  │    Startup time, memory usage, latency buckets      │   │
│  │    Helps optimize the app for all users             │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [View what's collected]  [Reset anonymous ID]  [Export]   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Consent tiers:**

| Tier | Data Collected | Default |
|------|----------------|---------|
| **Off** | Nothing | ✅ Default |
| **Basic** | Feature usage, retention | Opt-in |
| **Crash** | Anonymous crash reports | Opt-in |
| **Performance** | Performance buckets | Opt-in |
| **All** | All above combined | Opt-in |

### 2.2 Data Collection vs Local Derivation

**Transmitted to server (only if opted in):**
```json
{
  "token": "abc123...",           // Anonymous, rotates monthly
  "events": [
    {
      "name": "feature.search",
      "timestamp": "2025-01-15",  // Day only, no time
      "properties": {
        "result_count_bucket": "1-5"
      }
    }
  ],
  "session": {
    "length_bucket": "5-30m",
    "platform": "macos",
    "version": "1.0"
  }
}
```

**Computed locally, never transmitted:**
- Exact timestamps
- Session start/end times
- Exact counts (bucketed before transmission)
- Specific model names
- Conversation counts
- Search query patterns
- Error details beyond category

### 2.3 What's NEVER Collected

| Category | Specifically Excluded |
|----------|----------------------|
| **Content** | Messages, conversations, search queries |
| **Identity** | IP address, device ID, user ID, email |
| **Behavior** | Keystroke patterns, mouse movements |
| **External** | Gateway URL, auth tokens, API keys |
| **Sensitive** | File attachments, voice data, clipboard |

### 2.4 GDPR Compliance

| Requirement | Implementation |
|-------------|----------------|
| **Lawful basis** | Explicit consent (opt-in) |
| **Purpose limitation** | Product improvement only |
| **Data minimization** | Bucketed, anonymized, aggregated |
| **Accuracy** | N/A (no personal data) |
| **Storage limitation** | 90-day retention on server |
| **Integrity** | HTTPS transport, encrypted at rest |
| **Accountability** | Published privacy policy, audit log |

**User rights implementation:**

| Right | How Supported |
|-------|---------------|
| **Access** | "View what's collected" button exports all local data |
| **Rectification** | N/A (no personal data to correct) |
| **Erasure** | "Reset anonymous ID" deletes all linkable data |
| **Restriction** | Disable any/all analytics tiers |
| **Portability** | Export button provides JSON/CSV |
| **Object** | Opt-out at any time, immediate effect |

### 2.5 CCPA Compliance

| Requirement | Implementation |
|-------------|----------------|
| **Notice at collection** | Settings clearly state what's collected |
| **Do Not Sell** | N/A (we never sell data) |
| **Opt-out** | Default off, easy toggle |
| **Non-discrimination** | No features gated behind analytics |
| **Data deletion** | Reset ID removes all server-side data |

### 2.6 Privacy Disclosure

Displayed in Settings → Privacy:

```markdown
## What Molt Collects (When Analytics Enabled)

### Basic Analytics
- Which features you use (not how you use them)
- How often you use Molt (daily/weekly/monthly)
- Your platform (macOS/Windows/Linux)

### What We DON'T Collect
- Your conversations or messages
- Your Gateway URL or credentials
- Your IP address or location
- Any way to identify you personally

### How to Verify
Click "View what's collected" to see exactly
what would be sent to our servers.

All data is anonymous and cannot be linked
to you as an individual.
```

---

## 3. Implementation Options Analysis

### 3.1 Option Comparison Matrix

| Criteria | PostHog | Plausible | Aptabase | Custom |
|----------|---------|-----------|----------|--------|
| **Self-hostable** | ✅ Yes | ✅ Yes | ❌ No | ✅ Yes |
| **Desktop SDK** | ⚠️ Web SDK only | ❌ Web only | ✅ Native | ✅ Build it |
| **Privacy focus** | ⚠️ Medium | ✅ High | ✅ High | ✅ Total control |
| **Tauri compatible** | ⚠️ Needs wrapper | ❌ Not designed for | ✅ Built for desktop | ✅ Full control |
| **Cost (self-hosted)** | Free | Free | N/A | Free |
| **Cost (cloud)** | $0-450/mo | $9-99/mo | Free tier + paid | N/A |
| **Setup complexity** | High | Medium | Low | High |
| **Maintenance** | Medium | Low | None | High |
| **Features** | Full analytics suite | Page views focus | App events | What you build |
| **Data ownership** | ✅ Self-hosted | ✅ Self-hosted | ⚠️ Their servers | ✅ Total |
| **GDPR tools** | ✅ Built-in | ✅ Built-in | ✅ Built-in | 🔨 Build it |

### 3.2 PostHog

**Pros:**
- Full-featured: funnels, cohorts, feature flags, A/B testing
- Self-hostable (Docker)
- Good event model
- Session replay (would disable for privacy)
- Generous free tier

**Cons:**
- Heavy (requires Postgres, Redis, ClickHouse)
- Web-focused SDK, needs wrapper for Tauri
- Many features we'd disable (session replay, heatmaps)
- Overkill for our minimal needs

**Verdict:** Too heavy, but could work if self-hosted and locked down.

### 3.3 Plausible

**Pros:**
- Privacy-first by design
- Lightweight, easy to self-host
- GDPR compliant out of box
- No cookies, no personal data
- Beautiful dashboard

**Cons:**
- Designed for websites, not desktop apps
- No native SDK for Tauri/Rust
- Limited custom events
- No funnel analysis
- No cohort analysis

**Verdict:** Wrong tool for desktop apps, despite great privacy model.

### 3.4 Aptabase ⭐ Recommended

**Pros:**
- **Built specifically for desktop apps**
- **Has official Tauri SDK** (first-party support)
- Privacy-first (no IP collection, anonymized)
- Simple event model (perfect for our needs)
- Free tier: 20k events/month
- GDPR compliant
- Minimal integration code
- Good dashboard for app analytics

**Cons:**
- Not self-hostable (hosted service only)
- Less feature-rich than PostHog
- Newer company (less proven)
- Data stored on their servers (US/EU regions)

**Verdict:** Best fit for Molt. Purpose-built for privacy-respecting desktop app analytics.

### 3.5 Custom Minimal Solution

**Pros:**
- Total control over data
- Exactly what we need, nothing more
- Can self-host anywhere
- No third-party dependencies
- Zero cost beyond hosting

**Cons:**
- Significant development effort
- Need to build dashboard
- Maintenance burden
- Reinventing the wheel
- No community/support

**Verdict:** Good long-term option, but delays analytics significantly.

### 3.6 Recommendation

**Phase 1 (Launch): Aptabase**
- Fastest to integrate (official Tauri SDK)
- Privacy-first matches our values
- Free tier sufficient for early stage
- Battle-tested with other Tauri apps

**Phase 2 (Scale): Self-hosted Custom**
- Migrate when we outgrow Aptabase free tier
- Build minimal event collector (Rust + ClickHouse)
- Custom dashboard with exactly our metrics
- Full data ownership

---

## 4. Dashboard Design

### 4.1 Key Metrics Display

```
┌─────────────────────────────────────────────────────────────────────┐
│  MOLT ANALYTICS DASHBOARD                          Last 30 days ▼  │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │
│  │     2,847     │  │     1,423     │  │      68%      │           │
│  │  Monthly      │  │  Weekly       │  │  Week 1       │           │
│  │  Active       │  │  Active       │  │  Retention    │           │
│  │  ↑ 12%        │  │  ↑ 8%         │  │  ↓ 3%         │           │
│  └───────────────┘  └───────────────┘  └───────────────┘           │
│                                                                     │
│  ONBOARDING FUNNEL                                                  │
│  ════════════════════════════════════════════════════════════════  │
│  Launch    Gateway Config    First Message    Active User           │
│  ████████████████████████████████████████████████████  100%        │
│  ██████████████████████████████████████████           85%          │
│  ████████████████████████████                         60%          │
│  ████████████████████                                 45%          │
│                                                                     │
│  Drop-off alert: 25% abandon at "Gateway Config" step              │
│                                                                     │
│  FEATURE USAGE (Last 7 days)                                        │
│  ════════════════════════════════════════════════════════════════  │
│  New Conversation  ████████████████████████████████████████  89%   │
│  Search            ████████████████████████                 52%    │
│  Pin Conversation  ████████████                             28%    │
│  Model Change      ████████                                 18%    │
│  Thinking Mode     ██████                                   14%    │
│  Theme Change      ████                                     9%     │
│                                                                     │
│  PLATFORM DISTRIBUTION              PERFORMANCE HEALTH              │
│  ════════════════════              ══════════════════               │
│  Windows   ███████████████  62%    Startup <3s     ████████  92%   │
│  macOS     ████████████     38%    Crash-free      ████████  99.2% │
│  Linux     ███              8%     Stream <2s      ███████   88%   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.2 Alert Thresholds

| Metric | Warning | Critical | Action |
|--------|---------|----------|--------|
| Onboarding completion | <50% | <30% | Investigate UX |
| Week 1 retention | <60% | <40% | Review first-run experience |
| Crash rate | >1% | >5% | Hotfix release |
| Startup time >5s | >10% | >25% | Performance investigation |
| Feature adoption (core) | <20% | <10% | Discoverable improvement |

### 4.3 Cohort Analysis Needs

**Cohorts to track:**

| Cohort | Definition | Purpose |
|--------|------------|---------|
| **By version** | Users on v1.0 vs v1.1 | Migration tracking |
| **By platform** | Windows vs macOS vs Linux | Platform-specific issues |
| **By install week** | Week of first launch | Retention curves |
| **By power user** | >20 convos/week | Feature validation |
| **By feature adopter** | Uses search vs doesn't | Feature value |

**Retention matrix (example):**

```
         Week 0  Week 1  Week 2  Week 3  Week 4
Jan 1    100%    68%     52%     45%     42%
Jan 8    100%    71%     58%     50%     —
Jan 15   100%    65%     53%     —       —
Jan 22   100%    72%     —       —       —
Jan 29   100%    —       —       —       —
```

---

## 5. Implementation Specification

### 5.1 Event Schema

```typescript
// Base event interface
interface AnalyticsEvent {
  name: string;              // Event name (e.g., "feature.search")
  timestamp: string;         // ISO date only (YYYY-MM-DD)
  properties?: EventProps;   // Optional bucketed properties
}

// Session metadata (sent with event batches)
interface SessionMeta {
  anonymousId: string;       // Rotating anonymous token
  platform: 'windows' | 'macos' | 'linux';
  appVersion: string;        // Major.minor only
  sessionBucket: string;     // Length bucket
}
```

### 5.2 Complete Event List

#### Onboarding Events

```typescript
// User launched app for first time
{ name: 'onboarding.started' }

// User entered gateway URL (not the URL itself!)
{ name: 'onboarding.gateway_entered' }

// User tested connection
{ name: 'onboarding.connection_tested', properties: {
  success: boolean  // true/false only
}}

// User sent first message
{ name: 'onboarding.first_message' }

// User received AI response
{ name: 'onboarding.conversation_complete' }
```

#### Feature Events

```typescript
// Created new conversation
{ name: 'feature.new_conversation', properties: {
  totalCountBucket: '1-5' | '5-20' | '20-50' | '50+'
}}

// Used search
{ name: 'feature.search', properties: {
  resultCountBucket: '0' | '1-5' | '6-20' | '20+'
}}

// Pinned a conversation
{ name: 'feature.pin' }

// Unpinned a conversation
{ name: 'feature.unpin' }

// Changed model
{ name: 'feature.model_change', properties: {
  modelFamily: 'claude' | 'gpt' | 'gemini' | 'other'
}}

// Enabled thinking mode
{ name: 'feature.thinking_enabled' }

// Disabled thinking mode
{ name: 'feature.thinking_disabled' }

// Changed theme
{ name: 'feature.theme_change', properties: {
  theme: 'light' | 'dark' | 'system'
}}

// Opened settings
{ name: 'feature.settings_open' }

// Used keyboard shortcut
{ name: 'feature.keyboard_shortcut', properties: {
  category: 'navigation' | 'action' | 'window'
}}

// Deleted conversation
{ name: 'feature.conversation_delete' }

// Copied code block
{ name: 'feature.code_copy' }

// Copied message
{ name: 'feature.message_copy' }
```

#### Session Events

```typescript
// Session started
{ name: 'session.start' }

// Session ended (app closed/backgrounded)
{ name: 'session.end', properties: {
  durationBucket: '<5m' | '5-30m' | '30m-2h' | '2h+',
  messageCountBucket: '0' | '1-5' | '6-20' | '20+'
}}
```

#### Performance Events

```typescript
// App startup completed
{ name: 'performance.startup', properties: {
  durationBucket: '<1s' | '1-3s' | '3-5s' | '5s+'
}}

// Message stream latency
{ name: 'performance.stream_latency', properties: {
  latencyBucket: '<500ms' | '500-2000ms' | '2s+'
}}

// Memory usage (sampled hourly)
{ name: 'performance.memory', properties: {
  usageBucket: '<100MB' | '100-200MB' | '200MB+'
}}
```

#### Error Events (Crash Reports tier)

```typescript
// Unhandled error
{ name: 'error.unhandled', properties: {
  category: 'network' | 'storage' | 'render' | 'unknown',
  // Stack trace with PII stripped, truncated
  stackHash: string  // Hashed for grouping, not raw trace
}}

// Gateway connection error
{ name: 'error.gateway', properties: {
  type: 'timeout' | 'auth' | 'parse' | 'unknown'
}}
```

### 5.3 Bucketing Functions

```typescript
// Utility functions for privacy-preserving bucketing

function bucketCount(count: number): string {
  if (count <= 5) return '1-5';
  if (count <= 20) return '5-20';
  if (count <= 50) return '20-50';
  return '50+';
}

function bucketDuration(seconds: number): string {
  if (seconds < 300) return '<5m';
  if (seconds < 1800) return '5-30m';
  if (seconds < 7200) return '30m-2h';
  return '2h+';
}

function bucketLatency(ms: number): string {
  if (ms < 500) return '<500ms';
  if (ms < 2000) return '500-2000ms';
  return '2s+';
}

function bucketMemory(mb: number): string {
  if (mb < 100) return '<100MB';
  if (mb < 200) return '100-200MB';
  return '200MB+';
}

function bucketStartup(seconds: number): string {
  if (seconds < 1) return '<1s';
  if (seconds < 3) return '1-3s';
  if (seconds < 5) return '3-5s';
  return '5s+';
}

function getModelFamily(model: string): string {
  if (model.includes('claude')) return 'claude';
  if (model.includes('gpt')) return 'gpt';
  if (model.includes('gemini')) return 'gemini';
  return 'other';
}
```

### 5.4 Anonymous ID Generation

```typescript
import { randomBytes, createHash } from 'crypto';

class AnonymousIdManager {
  private storageKey = 'molt_analytics_id';
  private rotationKey = 'molt_analytics_rotation';
  
  async getOrCreateId(): Promise<string> {
    // Check if rotation needed (monthly)
    const lastRotation = await this.getLastRotation();
    const now = new Date();
    const shouldRotate = !lastRotation || 
      now.getMonth() !== lastRotation.getMonth() ||
      now.getFullYear() !== lastRotation.getFullYear();
    
    if (shouldRotate) {
      return this.rotateId();
    }
    
    // Return existing ID
    const existing = await this.getStoredId();
    if (existing) return existing;
    
    // Generate new ID
    return this.rotateId();
  }
  
  private async rotateId(): Promise<string> {
    const random = randomBytes(32).toString('hex');
    const now = new Date();
    const month = `${now.getFullYear()}-${now.getMonth()}`;
    
    // Hash for additional anonymization
    const id = createHash('sha256')
      .update(random + month)
      .digest('hex')
      .substring(0, 32);
    
    await this.storeId(id);
    await this.setLastRotation(now);
    
    return id;
  }
  
  async resetId(): Promise<void> {
    // User requested ID reset - clears all linkable data
    await this.clearStoredId();
    // This effectively makes them a "new user" in analytics
  }
}
```

---

## 6. Tauri Integration

### 6.1 Aptabase Integration

**Install SDK:**
```bash
npm install @aptabase/tauri
```

**Tauri plugin setup (src-tauri/Cargo.toml):**
```toml
[dependencies]
tauri-plugin-aptabase = "2.0"
```

**Initialize (src-tauri/src/lib.rs):**
```rust
use tauri_plugin_aptabase::EventTracker;

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_aptabase::Builder::new("A-US-XXXXXXXXXX").build())
        // ... other plugins
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

**Frontend usage (TypeScript):**
```typescript
import { trackEvent } from '@aptabase/tauri';

// Analytics wrapper with consent check
class MoltAnalytics {
  private enabled = false;
  
  async init() {
    this.enabled = await this.checkConsent();
  }
  
  private async checkConsent(): Promise<boolean> {
    const settings = await getSettings();
    return settings.analyticsEnabled === true;
  }
  
  async track(name: string, props?: Record<string, unknown>) {
    if (!this.enabled) return;
    
    // Bucket sensitive values before sending
    const sanitized = this.sanitizeProps(props);
    await trackEvent(name, sanitized);
  }
  
  private sanitizeProps(props?: Record<string, unknown>) {
    if (!props) return undefined;
    
    const sanitized = { ...props };
    
    // Apply bucketing to known sensitive fields
    if (typeof sanitized.count === 'number') {
      sanitized.countBucket = bucketCount(sanitized.count);
      delete sanitized.count;
    }
    if (typeof sanitized.duration === 'number') {
      sanitized.durationBucket = bucketDuration(sanitized.duration);
      delete sanitized.duration;
    }
    if (typeof sanitized.model === 'string') {
      sanitized.modelFamily = getModelFamily(sanitized.model);
      delete sanitized.model;
    }
    
    return sanitized;
  }
  
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    // Persist to settings
  }
}

// Export singleton
export const analytics = new MoltAnalytics();
```

### 6.2 Integration Points

**App lifecycle (src/App.tsx):**
```typescript
import { analytics } from './lib/analytics';

function App() {
  useEffect(() => {
    // Initialize analytics (checks consent)
    analytics.init();
    
    // Track session start
    analytics.track('session.start');
    
    // Track startup performance
    const startupTime = performance.now() / 1000;
    analytics.track('performance.startup', { duration: startupTime });
    
    // Track session end on close
    return () => {
      const duration = (Date.now() - sessionStartTime) / 1000;
      analytics.track('session.end', { duration });
    };
  }, []);
}
```

**Feature tracking (components):**
```typescript
// In ChatView.tsx
const handleNewConversation = async () => {
  const conversation = await createConversation();
  analytics.track('feature.new_conversation', {
    count: await getConversationCount()
  });
};

// In SearchDialog.tsx
const handleSearch = async (query: string) => {
  const results = await search(query);
  analytics.track('feature.search', {
    count: results.length
  });
};

// In SettingsDialog.tsx
const handleModelChange = (model: string) => {
  analytics.track('feature.model_change', { model });
};
```

### 6.3 Settings UI Integration

```typescript
// In SettingsDialog.tsx
function AnalyticsSettings() {
  const [settings, setSettings] = useSettings();
  
  return (
    <div className="space-y-4">
      <h3>Analytics & Privacy</h3>
      
      <p className="text-sm text-muted-foreground">
        Molt doesn't track anything by default. You can help 
        improve the app by sharing anonymous usage data.
      </p>
      
      <div className="space-y-2">
        <label className="flex items-center gap-2">
          <Switch 
            checked={settings.analyticsEnabled}
            onCheckedChange={(enabled) => {
              setSettings({ analyticsEnabled: enabled });
              analytics.setEnabled(enabled);
            }}
          />
          <span>Enable anonymous analytics</span>
        </label>
        
        <label className="flex items-center gap-2">
          <Switch 
            checked={settings.crashReportsEnabled}
            onCheckedChange={(enabled) => {
              setSettings({ crashReportsEnabled: enabled });
            }}
          />
          <span>Send crash reports</span>
        </label>
      </div>
      
      <div className="flex gap-2">
        <Button variant="outline" onClick={viewCollectedData}>
          View what's collected
        </Button>
        <Button variant="outline" onClick={resetAnonymousId}>
          Reset anonymous ID
        </Button>
      </div>
    </div>
  );
}
```

### 6.4 Crash Reporting

```typescript
// Error boundary with crash reporting
class ErrorBoundary extends React.Component {
  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Only report if user opted in
    if (await getCrashReportConsent()) {
      analytics.track('error.unhandled', {
        category: categorizeError(error),
        stackHash: hashStack(error.stack)
      });
    }
    
    // Always log locally
    console.error('Unhandled error:', error, info);
  }
}

function hashStack(stack?: string): string {
  if (!stack) return 'unknown';
  
  // Remove line numbers, file paths, memory addresses
  const sanitized = stack
    .split('\n')
    .slice(0, 5)  // First 5 frames only
    .map(line => line.replace(/:\d+:\d+/g, ''))  // Remove line:col
    .map(line => line.replace(/\(.*\)/g, ''))    // Remove file paths
    .join('|');
  
  return createHash('sha256')
    .update(sanitized)
    .digest('hex')
    .substring(0, 16);
}
```

---

## 7. Data Lifecycle

### 7.1 Data Flow

```
┌──────────────────────────────────────────────────────────────────┐
│                         MOLT CLIENT                               │
│  ┌──────────────┐                                                │
│  │   Event      │                                                │
│  │   Occurs     │                                                │
│  └──────┬───────┘                                                │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐     ┌──────────────┐                          │
│  │   Consent    │────▶│   Discard    │  (if disabled)           │
│  │   Check      │     │              │                          │
│  └──────┬───────┘     └──────────────┘                          │
│         │ (if enabled)                                           │
│         ▼                                                        │
│  ┌──────────────┐     ┌──────────────┐                          │
│  │   Sanitize   │────▶│   Bucket     │                          │
│  │   & Strip    │     │   Values     │                          │
│  └──────┬───────┘     └──────────────┘                          │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │   Local      │  ← Can be viewed/exported by user              │
│  │   Buffer     │                                                │
│  └──────┬───────┘                                                │
│         │ (batched every 60s or on close)                        │
│         │                                                        │
└─────────┼────────────────────────────────────────────────────────┘
          │
          ▼ HTTPS
┌──────────────────────────────────────────────────────────────────┐
│                      APTABASE SERVERS                             │
│  ┌──────────────┐                                                │
│  │   Ingest     │                                                │
│  │   Endpoint   │                                                │
│  └──────┬───────┘                                                │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐     ┌──────────────┐                          │
│  │   Aggregate  │────▶│   Store      │  (90 day retention)      │
│  │   & Count    │     │              │                          │
│  └──────┬───────┘     └──────────────┘                          │
│         │                                                        │
│         ▼                                                        │
│  ┌──────────────┐                                                │
│  │   Dashboard  │  ← Team access only                            │
│  │   Display    │                                                │
│  └──────────────┘                                                │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 7.2 Retention Policy

| Data Type | Retention | Reason |
|-----------|-----------|--------|
| Raw events | 90 days | Enough for trend analysis |
| Aggregates | 2 years | Long-term product decisions |
| Crash reports | 30 days | Bug fix urgency |
| User token link | Until rotation | Monthly auto-rotation |

### 7.3 Data Deletion Process

**User requests deletion (Reset anonymous ID):**
1. Client generates new anonymous ID
2. Client clears local analytics buffer
3. Old ID becomes orphaned (no PII to delete on server)
4. Server data expires naturally (90 days)

**Full opt-out:**
1. Client stops sending events
2. Existing server data expires (90 days)
3. No new data collection

---

## 8. Compliance Checklist

### 8.1 Pre-Launch Checklist

- [ ] Analytics OFF by default in production build
- [ ] Settings UI clearly shows what's collected
- [ ] "View collected data" function works
- [ ] "Reset anonymous ID" function works
- [ ] Privacy policy updated on website
- [ ] In-app privacy disclosure accessible
- [ ] Bucketing functions tested (no raw values leak)
- [ ] No PII in any event properties
- [ ] HTTPS only for data transmission
- [ ] Consent persisted correctly across restarts

### 8.2 Ongoing Compliance

- [ ] Monthly audit of collected events
- [ ] Quarterly review of retention periods
- [ ] Respond to deletion requests within 30 days
- [ ] Update privacy policy for any new events
- [ ] Log consent changes for audit trail

### 8.3 Documentation Required

- [ ] Public privacy policy (website)
- [ ] In-app privacy disclosure
- [ ] Data processing agreement (if self-hosted)
- [ ] List of third-party processors (Aptabase)
- [ ] Cookie policy (N/A - desktop app)

---

## Appendix A: Privacy Policy Template

```markdown
# Molt Privacy Policy

Last updated: [DATE]

## Summary

Molt is designed with privacy as a core principle:
- All conversations are stored locally on your device
- Conversations are encrypted with keys only you control
- Analytics are disabled by default
- If you enable analytics, we collect anonymous usage data only

## What We DON'T Collect

- Your conversations or messages
- Your Gateway URL or credentials
- Your IP address (masked by our analytics provider)
- Any personally identifiable information
- Any way to link data back to you

## What We Collect (If You Opt In)

When you enable anonymous analytics, we collect:
- Feature usage (which features you use, not how)
- Session information (bucketed duration, not timestamps)
- Platform (Windows/macOS/Linux)
- App version
- Performance metrics (bucketed, not exact values)

All data is anonymized before leaving your device:
- Exact counts become ranges (e.g., "5-20" not "7")
- Timestamps become dates only
- Model names become families (e.g., "claude" not "claude-3-opus-20240229")

## Your Rights

- **View**: See exactly what would be sent
- **Delete**: Reset your anonymous ID at any time
- **Opt-out**: Disable analytics entirely, instantly
- **Export**: Download your local analytics data

## Data Retention

Analytics data is retained for 90 days, then automatically deleted.

## Contact

Questions about privacy? Email privacy@molt.dev
```

---

## Appendix B: Implementation Timeline

| Week | Task | Owner |
|------|------|-------|
| 1 | Aptabase account setup, API key | DevOps |
| 1 | Settings UI for analytics consent | Frontend |
| 2 | Analytics wrapper implementation | Frontend |
| 2 | Tauri plugin integration | Backend |
| 3 | Event instrumentation (onboarding, features) | Frontend |
| 3 | Performance tracking | Backend |
| 4 | Testing & bucketing verification | QA |
| 4 | Privacy policy update | Legal |
| 5 | Dashboard setup & alerts | DevOps |
| 5 | Documentation finalization | All |

---

*Document version: 1.0*
*Last updated: 2025-01-18*
*Author: Claude (Analytics Design Subagent)*
