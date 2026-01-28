# Welcome to Moltz

**Native AI chat for your desktop. Fast, private, and actually useful.**

---

## Start Here

**Brand new?** [Get up and running in 5 minutes →](./Quick-Start.md)

**Installed but confused?** [Getting Started guide →](./Getting-Started.md)

**Just exploring?** Keep reading!

---

## What is Moltz?

You know ChatGPT and Claude.ai? Moltz is like that, but as a real desktop app.

**What you get:**
- **Familiar interface** - Same chat experience you already know
- **Fast** - Native app, not a browser wrapped in Electron
- **Private** - Everything stays on your computer, encrypted
- **Flexible** - Works with Claude, GPT, Gemini, or local models
- **Always there** - Global hotkey summons it from anywhere

**What you don't get:**
- Cloud sync (yet - coming Q2 2026)
- Mobile apps (yet - iOS/Android in beta Q2 2026)
- Web version (it's desktop-only on purpose)

---

## I Want To...

**[...get started →](./Quick-Start.md)**  
5-minute install guide.

**[...learn keyboard shortcuts →](./Configuration.md#keyboard-shortcuts)**  
Become a power user.

**[...understand how it works →](./Architecture.md)**  
Technical deep-dive for developers.

**[...fix a problem →](./Troubleshooting.md)**  
Real solutions, not "restart your computer."

**[...customize settings →](./Configuration.md)**  
Themes, fonts, shortcuts - make it yours.

**[...see what's coming next →](./Roadmap.md)**  
Feature roadmap Q1-Q4 2026.

**[...contribute code →](./Developer-Guide.md)**  
Build features, fix bugs, improve docs.

**[...report a bug →](https://github.com/AlixHQ/moltz/issues)**  
We're listening.

---

## Documentation Structure

### For Users

**[Quick Start](./Quick-Start.md)** - Install and run in 5 minutes  
**[Getting Started](./Getting-Started.md)** - Detailed setup guide  
**[User Guide](./User-Guide.md)** - How to use Moltz daily  
**[Configuration](./Configuration.md)** - All settings explained  
**[Troubleshooting](./Troubleshooting.md)** - Fix common problems  
**[Features](./Features.md)** - What Moltz can do

### For Developers

**[Architecture](./Architecture.md)** - How Moltz is built  
**[Developer Guide](./Developer-Guide.md)** - Build from source  
**[Contributing](./Contributing.md)** - How to contribute  
**[Security](./Security.md)** - Encryption, audits, best practices  
**[Performance](./Performance.md)** - Benchmarks and optimizations

### For Everyone

**[Roadmap](./Roadmap.md)** - What's coming next  
**[Changelog](./Changelog.md)** - Version history

---

## Frequently Asked Questions

### Is this free?

Yes. Moltz is open-source (Apache 2.0 license).

You pay for AI provider costs (Claude, GPT API keys), not for Moltz itself.

### Does it send my data to your servers?

No. We don't have servers.

Everything is stored locally on your computer, encrypted. Your conversations never leave your device unless you explicitly export them.

### Do I need Clawdbot Gateway?

Yes. Gateway handles AI provider connections and API keys.

Moltz → Gateway → AI providers (Claude, GPT, etc.)

Think of Gateway like a router for AI requests.

### Can I use it offline?

You can read old conversations offline. Sending new messages requires internet (Gateway needs to reach AI providers).

### Which AI models does it support?

Whatever your Gateway is configured for:
- Claude (Sonnet, Opus, Haiku)
- OpenAI (GPT-4, GPT-4o, GPT-3.5)
- Google (Gemini)
- Local models (via Ollama or similar)

Model selection UI coming in v1.1.

### Is it safe?

Messages are encrypted at rest (AES-256-GCM). Gateway tokens stored in your system keychain, not localStorage.

We did a [security audit](./Security.md) - read the findings.

### What platforms does it run on?

- macOS 11+ (Apple Silicon and Intel)
- Windows 10/11 (64-bit)
- Linux (Debian, Ubuntu, Fedora, AppImage)

### Can I sync between computers?

Not yet. Cloud sync is coming in Q2 2026 (optional, end-to-end encrypted).

For now: Export conversations on one machine, import on another.

---

## Get Help

**Something broken?** [Troubleshooting Guide](./Troubleshooting.md)

**Still stuck?** [Ask in Discussions](https://github.com/AlixHQ/moltz/discussions)

**Found a bug?** [Open an issue](https://github.com/AlixHQ/moltz/issues)

**Want to chat?** Discord coming soon

---

## System Requirements

**Minimum:**
- macOS 11, Windows 10, or modern Linux
- 4 GB RAM
- 500 MB disk space

**Recommended:**
- macOS 13+, Windows 11, or latest Linux LTS
- 8 GB RAM
- 2 GB disk space (for conversation storage)

**Need Clawdbot Gateway too:**
- Node.js 18+
- Additional 100 MB disk space

---

## About This Documentation

**Comprehensive?** We tried. If something's missing, [tell us](https://github.com/AlixHQ/moltz/issues).

**Found a typo?** [Edit on GitHub](https://github.com/AlixHQ/moltz/tree/main/docs/wiki) and submit a PR.

**Want to translate?** [Contributing guide](./Contributing.md#translations)

---

## Quick Links

- [GitHub Repository](https://github.com/AlixHQ/moltz)
- [Download Latest Release](https://github.com/AlixHQ/moltz/releases/latest)
- [Report Security Issue](mailto:security@alix.com)
- [Clawdbot Gateway](https://github.com/clawdbot/clawdbot)

---

**Last updated:** January 2026

**Ready to start?** [Quick Start →](./Quick-Start.md)
