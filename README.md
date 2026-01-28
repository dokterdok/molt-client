<div align="center">

# Moltzer

### The AI chat interface you already know. But native.

**A familiar, fast desktop app for AI chat — like ChatGPT or Claude.ai, but running on your computer.**

[**Download for Mac**](https://github.com/AlixHQ/moltzer-community/releases) ·
[Windows](https://github.com/AlixHQ/moltzer-community/releases) ·
[Linux](https://github.com/AlixHQ/moltzer-community/releases)

</div>

---

## Why Moltzer?

If you've used ChatGPT or Claude.ai, you already know how to use Moltzer. Same familiar interface — but as a real desktop app.

| ChatGPT/Claude.ai | Moltzer |
|-------------------|---------|
| Browser tab you lose | Native app that's always there |
| Generic web interface | Feels like a real desktop app |
| No offline access | Read old conversations anytime |
| One AI provider | Any model (Claude, GPT, Gemini, local) |

### What makes it different

- **Familiar interface** — Same chat experience you know from ChatGPT/Claude.ai
- **Global hotkey** — Summon it instantly from anywhere on your computer
- **Local storage** — Conversations stored on your device, encrypted
- **Actually fast** — Native app, not a browser in disguise
- **Any AI model** — Claude, GPT, Gemini, or local models via Moltbot Gateway

---

## Get Started

### Step 1: Install Moltbot Gateway

Moltzer connects to [Moltbot](https://github.com/moltbot/moltbot), the open-source AI gateway that routes your requests to AI providers.

**Install Moltbot:**
```bash
npm install -g moltbot
moltbot setup
```

See the [official Moltbot installation guide](https://github.com/moltbot/moltbot#installation) for details.

### Step 2: Download Moltzer

Download the latest release for your platform:

- [Mac (Apple Silicon / Intel)](https://github.com/AlixHQ/moltzer-community/releases)
- [Windows](https://github.com/AlixHQ/moltzer-community/releases)
- [Linux](https://github.com/AlixHQ/moltzer-community/releases)

### Step 3: Connect

1. Launch Moltzer
2. Open Settings
3. Enter your Gateway URL (default: `ws://localhost:18789`)
4. Start chatting!

---

## Features

### Familiar & Fast
- **Same UX you know** — Chat interface inspired by ChatGPT and Claude.ai
- **Streaming responses** — See AI responses as they're generated
- **Instant search** — Full-text search across all conversations
- **Keyboard shortcuts** — Navigate like a power user

### Your Conversations
- **Local storage** — All chats saved on your device
- **Encrypted at rest** — AES-256 encryption
- **Pin favorites** — Keep important conversations at the top
- **Rich markdown** — Code blocks, syntax highlighting, tables

### Native Experience
- **Global hotkey** — Quick access from anywhere
- **System tray** — Always accessible
- **Native menus** — Standard shortcuts that just work
- **Dark/Light themes** — Follows your system preference

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Cmd/Ctrl+Shift+Space | Quick Ask (global) |
| Cmd/Ctrl+N | New conversation |
| Cmd/Ctrl+K | Search |
| Cmd/Ctrl+, | Settings |

---

## Building from Source

```bash
git clone https://github.com/AlixHQ/moltzer-community.git
cd moltzer-community
npm install
npm run tauri build
```

Requires: Node.js 18+, Rust 1.70+

---

## Contributing

We welcome contributions! See [CONTRIBUTING.md](./CONTRIBUTING.md).

## License

Apache 2.0 — see [LICENSE](./LICENSE)
