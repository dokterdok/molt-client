# 🦞 Molt Press Kit

**Last Updated:** January 2025  
**Version:** 1.0

---

## Table of Contents

1. [Brand Assets](#1-brand-assets)
2. [Press Kit Contents](#2-press-kit-contents)
3. [Press Release Template](#3-press-release-template)
4. [Media Outreach](#4-media-outreach)
5. [Social Media Kit](#5-social-media-kit)

---

# 1. Brand Assets

## Logo Variations

### Primary Logo (Full)
```
📁 assets/brand/
├── molt-logo-full.svg          # Vector (scalable)
├── molt-logo-full-dark.svg     # For light backgrounds
├── molt-logo-full-light.svg    # For dark backgrounds
├── molt-logo-full.png          # 1200x400 @ 2x
└── molt-logo-full-300.png      # 300x100 (web use)
```

**Design Specifications:**
- Icon (🦞 lobster) + "Molt" wordmark
- Horizontal layout
- Minimum size: 120px width
- Clear space: 1x icon height on all sides

### Icon Only
```
📁 assets/brand/
├── molt-icon.svg               # Vector
├── molt-icon-512.png           # 512x512 (high-res)
├── molt-icon-256.png           # 256x256
├── molt-icon-128.png           # 128x128
├── molt-icon-64.png            # 64x64 (favicon)
├── molt-icon-32.png            # 32x32 (favicon)
└── molt-icon-16.png            # 16x16 (favicon)
```

**Icon Design:**
- Stylized lobster silhouette
- Rounded corners (8% radius at 512px)
- Works at all sizes down to 16x16

### App Icons (Platform-Specific)
```
📁 assets/icons/
├── icon.icns                   # macOS
├── icon.ico                    # Windows
├── icon.png                    # Linux (512x512)
├── 32x32.png                   # Windows small
├── 128x128.png                 # Electron/Tauri
├── 128x128@2x.png              # Retina
├── icon.svg                    # Scalable
└── Square44x44Logo.png         # Windows Store
```

---

## Color Palette

### Primary Colors

| Name | Hex | RGB | Usage |
|------|-----|-----|-------|
| **Molt Red** | `#E63946` | rgb(230, 57, 70) | Primary accent, CTAs, icons |
| **Deep Ocean** | `#1D3557` | rgb(29, 53, 87) | Dark mode backgrounds, headers |
| **Arctic White** | `#F1FAEE` | rgb(241, 250, 238) | Light mode backgrounds |
| **Seafoam** | `#A8DADC` | rgb(168, 218, 220) | Secondary accent, highlights |
| **Soft Blue** | `#457B9D` | rgb(69, 123, 157) | Links, interactive elements |

### Extended Palette

| Name | Hex | Usage |
|------|-----|-------|
| **Success Green** | `#06D6A0` | Success states, confirmations |
| **Warning Amber** | `#FFD166` | Warnings, notifications |
| **Error Red** | `#EF476F` | Errors, destructive actions |
| **Neutral 100** | `#F8F9FA` | Light backgrounds |
| **Neutral 900** | `#212529` | Dark mode text, backgrounds |

### Color Usage Guidelines

**DO:**
- ✅ Use Molt Red sparingly for emphasis
- ✅ Maintain 4.5:1 contrast ratio for accessibility
- ✅ Use Deep Ocean for dark mode backgrounds
- ✅ Use Arctic White for light mode backgrounds

**DON'T:**
- ❌ Use Molt Red for large text blocks
- ❌ Combine Molt Red with Error Red
- ❌ Use colors outside the palette in official materials
- ❌ Apply gradients to the logo

### Dark Mode / Light Mode

```css
/* Light Mode */
--background: #F1FAEE;
--foreground: #1D3557;
--primary: #E63946;
--secondary: #457B9D;
--muted: #A8DADC;

/* Dark Mode */
--background: #1D3557;
--foreground: #F1FAEE;
--primary: #E63946;
--secondary: #A8DADC;
--muted: #457B9D;
```

---

## Typography

### Primary Typeface: Inter

**Download:** [Google Fonts - Inter](https://fonts.google.com/specimen/Inter)

| Weight | Usage |
|--------|-------|
| **Inter 700 (Bold)** | Headlines, logo wordmark |
| **Inter 600 (SemiBold)** | Subheadings, buttons |
| **Inter 500 (Medium)** | Navigation, labels |
| **Inter 400 (Regular)** | Body text, messages |

### Monospace: JetBrains Mono

**Download:** [JetBrains Mono](https://www.jetbrains.com/lp/mono/)

| Weight | Usage |
|--------|-------|
| **JetBrains Mono 400** | Code blocks, technical text |
| **JetBrains Mono 600** | Emphasized code |

### Type Scale

| Name | Size | Line Height | Usage |
|------|------|-------------|-------|
| **Display** | 48px / 3rem | 1.1 | Hero headlines |
| **H1** | 36px / 2.25rem | 1.2 | Page titles |
| **H2** | 28px / 1.75rem | 1.3 | Section headers |
| **H3** | 22px / 1.375rem | 1.4 | Subsections |
| **Body** | 16px / 1rem | 1.5 | Main content |
| **Small** | 14px / 0.875rem | 1.4 | Captions, meta |
| **Tiny** | 12px / 0.75rem | 1.3 | Labels, badges |

---

## Brand Voice Guidelines

### Personality Traits

| Trait | Description | Example |
|-------|-------------|---------|
| **Capable** | Confident, competent, reliable | "Molt handles your AI conversations effortlessly" |
| **Clean** | Minimal, focused, uncluttered | "One app. Every AI. Zero bloat." |
| **Clever** | Smart, witty (not silly), precise | "Shed the browser tabs. Embrace the shell." |
| **Approachable** | Friendly, not corporate | "Your AI deserves a better home." |

### Tone of Voice

**We are:**
- Direct and clear (no jargon)
- Confident but not arrogant
- Helpful without being condescending
- Technical when needed, human always

**We avoid:**
- Buzzwords ("leverage," "synergy," "disrupt")
- Overpromising ("revolutionary," "groundbreaking")
- Being preachy or superior
- Excessive exclamation marks!!!

### Writing Examples

**Headlines:**
- ✅ "The AI chat client for people who actually work"
- ✅ "One app. Any AI. Native speed."
- ❌ "Revolutionary AI-powered synergistic solution"
- ❌ "The BEST AI app EVER!!!"

**Product Description:**
- ✅ "Molt is a native desktop client for chatting with Claude, GPT, and other AI models. It's fast, lightweight, and keeps your conversations private."
- ❌ "Molt leverages cutting-edge AI technology to provide an unparalleled conversational experience powered by next-generation language models."

**Error Messages:**
- ✅ "Couldn't connect to the AI. Check your internet and try again."
- ❌ "Error 502: Gateway timeout exception occurred."

### Taglines (Approved)

**Primary:**
> "The AI chat client for power users"

**Alternatives:**
> "One app. Every AI. Native speed."
> "Shed the browser tabs."
> "Your AI conversations, your way."
> "ChatGPT meets native performance."

---

# 2. Press Kit Contents

## One-Pager Fact Sheet

### What is Molt?

**Molt** is a native desktop application that provides a ChatGPT-style interface for chatting with multiple AI models (Claude, GPT, Gemini, and more). Unlike browser-based or Electron apps, Molt uses native OS technologies for blazing-fast performance and minimal resource usage.

### The Problem

- Browser tabs get messy when using multiple AI services
- Electron-based AI apps consume 300MB+ RAM
- No single app supports ALL major AI models
- Conversation management is poor across existing tools
- Privacy concerns with cloud-stored conversations

### The Solution

Molt provides:
- **Multi-model support** — Claude, GPT, Gemini in one unified interface
- **Native performance** — ~10MB binary, ~50MB RAM (vs 300MB+ for Electron)
- **Local-first privacy** — All conversations encrypted and stored locally
- **Power user features** — Keyboard shortcuts, search, conversation branching
- **Cross-platform** — Windows, macOS, Linux

### Key Metrics

| Metric | Value |
|--------|-------|
| **Binary size** | ~10MB |
| **Memory usage** | ~50MB idle |
| **Cold start time** | <1 second |
| **Supported models** | 10+ (Claude, GPT-4, Gemini, Llama, etc.) |
| **Platforms** | Windows, macOS, Linux |
| **License** | MIT (open source) |

### Target Users

- **Software developers** using AI for coding assistance
- **Writers and researchers** needing multiple AI perspectives
- **Power users** frustrated with browser-based AI tools
- **Privacy-conscious professionals** handling sensitive information
- **AI enthusiasts** exploring multiple models

### Competitive Advantages

| Feature | Molt | ChatGPT Desktop | Claude Desktop |
|---------|------|-----------------|----------------|
| Multi-model support | ✅ | ❌ | ❌ |
| Native performance | ✅ (Tauri) | ⚠️ (Electron) | ⚠️ (Electron) |
| Local encryption | ✅ | ❌ | ❌ |
| Conversation search | ✅ | ✅ | ✅ |
| Open source | ✅ | ❌ | ❌ |
| Memory footprint | ~50MB | ~500MB | ~400MB |

### Technology Stack

- **Frontend:** React 18, TypeScript, Tailwind CSS
- **Backend:** Tauri v2 (Rust)
- **Storage:** IndexedDB with AES-GCM encryption
- **Credentials:** OS Keychain (macOS), Credential Manager (Windows)

---

## Founder/Team Bio

### About the Creator

**David de Wit** — Creator & Lead Developer

David is a software engineer and AI enthusiast based in Switzerland. He created Molt after growing frustrated with the fragmented experience of using multiple AI assistants across different browser tabs and apps.

> "I was switching between ChatGPT, Claude, and other AI tools constantly. I wanted a single, fast, native app that could talk to all of them. Molt is the tool I wished existed."

**Background:**
- 10+ years in software development
- Experience in desktop applications, web development, and AI integration
- Open source contributor

**Contact:**
- GitHub: [@dokterdok](https://github.com/dokterdok)
- Twitter: [@dokterdok](https://twitter.com/dokterdok)
- Email: david@molt.dev

---

## Screenshots Specification

### Required Screenshots (All Platforms)

```
📁 assets/screenshots/
├── hero-conversation.png       # Main chat interface with conversation
├── hero-clean.png             # Clean new conversation state
├── multi-model.png            # Model picker dropdown open
├── search.png                 # Search functionality
├── settings.png               # Settings dialog
├── dark-mode.png              # Full app in dark mode
├── light-mode.png             # Full app in light mode
├── code-highlighting.png      # Code block with syntax highlighting
├── conversation-list.png      # Sidebar with multiple conversations
└── onboarding.png             # First-run setup screen
```

### Screenshot Specifications

| Property | Value |
|----------|-------|
| **Resolution** | 2560x1600 (2x Retina) |
| **Format** | PNG (lossless) |
| **Color space** | sRGB |
| **Naming** | lowercase-kebab-case.png |

### Platform-Specific Screenshots

```
📁 assets/screenshots/
├── macos/
│   ├── hero-conversation.png
│   └── ...
├── windows/
│   ├── hero-conversation.png
│   └── ...
└── linux/
    ├── hero-conversation.png
    └── ...
```

### App Store Screenshots

**macOS App Store (Required sizes):**
- 1280x800 (MacBook Air 13")
- 1440x900 (MacBook Pro 15")
- 2560x1600 (MacBook Pro 16" Retina)
- 2880x1800 (MacBook Pro 15" Retina)

**Microsoft Store:**
- 1366x768 (minimum)
- 1920x1080 (recommended)
- 2560x1440 (4K preview)

---

## App Icon Specifications

### All Required Sizes

```
📁 assets/icons/
├── icon-16.png
├── icon-32.png
├── icon-48.png
├── icon-64.png
├── icon-128.png
├── icon-256.png
├── icon-512.png
├── icon-1024.png       # App Store
├── icon.icns           # macOS bundle
├── icon.ico            # Windows bundle
└── icon.svg            # Scalable source
```

### Icon Design Guidelines

- **Shape:** Rounded square (iOS-style) with 16% corner radius
- **Background:** Gradient from Molt Red (#E63946) to Deep Ocean (#1D3557)
- **Foreground:** White lobster silhouette
- **Safe zone:** Keep content within 80% of icon area

---

## Feature Highlight Images

### Marketing Visuals Needed

```
📁 assets/marketing/
├── feature-multimodel.png      # Side-by-side model comparison
├── feature-performance.png     # Binary size/RAM comparison chart
├── feature-encryption.png      # Lock icon with conversation
├── feature-keyboard.png        # Keyboard shortcuts overlay
├── feature-search.png          # Search results highlight
├── feature-themes.png          # Dark/Light mode split view
├── infographic-why-molt.png    # Problem/Solution visual
└── comparison-chart.png        # vs competitors table
```

### Specifications

| Asset Type | Size | Format |
|------------|------|--------|
| Feature images | 1200x800 | PNG |
| Social cards | 1200x630 | PNG |
| Infographics | 1200x auto | PNG/SVG |
| Comparison charts | 1000x600 | PNG |

---

# 3. Press Release Template

## Launch Announcement Draft

---

**FOR IMMEDIATE RELEASE**

### Molt Launches: The First Native Desktop Client Supporting All Major AI Models

*New open-source app brings ChatGPT, Claude, and Gemini together in a single, lightning-fast interface*

**[CITY, DATE]** — Today marks the launch of **Molt**, a revolutionary native desktop application that unifies the AI chat experience. For the first time, users can access ChatGPT, Claude, Gemini, and other leading AI models from a single, blazing-fast desktop client.

Unlike browser-based alternatives or resource-heavy Electron apps, Molt uses Tauri technology to deliver native performance. The result: a ~10MB download that uses just ~50MB of RAM—a fraction of competing solutions.

**"I built Molt because I was tired of juggling browser tabs and watching my laptop slow down,"** said David de Wit, creator of Molt. **"Power users deserve a tool that's as fast and focused as they are."**

#### Key Features:

- **Multi-model support:** Switch between GPT-4, Claude, Gemini, and more with one click
- **Native performance:** ~10MB binary, ~50MB RAM, sub-second startup
- **Privacy-first:** End-to-end encryption with conversations stored locally
- **Power user tools:** Keyboard shortcuts, instant search, conversation branching
- **Cross-platform:** Available for Windows, macOS, and Linux

#### Availability:

Molt is available today as a free, open-source download from GitHub:  
**https://github.com/dokterdok/molt-client/releases**

#### About Molt:

Molt is an open-source desktop application designed for professionals who rely on AI daily. Built with Tauri and React, it represents a new generation of lightweight, privacy-respecting AI tools.

**Press Contact:**  
David de Wit  
press@molt.dev  
https://molt.dev/press

**###**

---

## Key Talking Points

### For Journalists

1. **First multi-model desktop client** — No other native app supports GPT, Claude, AND Gemini in one interface

2. **10x lighter than Electron** — Molt uses ~50MB RAM vs ~500MB for ChatGPT/Claude desktop apps

3. **Privacy by design** — All conversations encrypted locally; data never leaves your device

4. **Open source** — Full transparency; community can audit and contribute

5. **For power users, not everyone** — Designed for developers, researchers, and professionals who use AI daily

### Technical Differentiators

- **Tauri vs Electron:** Rust-based framework produces ~10MB binaries (not 300MB)
- **Native webview:** Uses OS-provided WebView2/WebKit instead of bundled Chromium
- **Local-first architecture:** IndexedDB + AES-GCM encryption
- **Keychain integration:** Credentials stored in OS secure enclave

### Market Positioning

- **Not competing with ChatGPT/Claude** — Molt is a *client*, not an AI model
- **Aggregator play** — Like a universal TV remote for AI services
- **Power tools market** — Positioned with developer tools (VS Code, iTerm, etc.)

---

## Quotable Statements

### From the Creator

> "The best AI tool is the one that gets out of your way. Molt is invisible until you need it, then lightning-fast when you do."
> — David de Wit, Creator of Molt

> "I'm not building the next ChatGPT. I'm building the best way to *use* ChatGPT—and Claude, and Gemini, and whatever comes next."
> — David de Wit

> "Browser tabs are where productivity goes to die. Molt is the escape hatch."
> — David de Wit

### For Attribution

> "Molt represents a new category: the AI client. As AI models become commoditized, the interface layer becomes increasingly valuable."

> "Privacy isn't a feature—it's a right. Molt keeps your conversations on your device, encrypted, where they belong."

> "We're building tools for the AI-native generation of workers who use AI as naturally as email."

---

# 4. Media Outreach

## Tech Journalists Covering AI/Productivity Apps

### Tier 1: Major Tech Publications

| Name | Outlet | Focus | Contact |
|------|--------|-------|---------|
| **Casey Newton** | Platformer | AI, social platforms | casey@platformer.news |
| **Kara Swisher** | On with Kara Swisher | Tech industry | Twitter: @karaswisher |
| **Nilay Patel** | The Verge | Consumer tech, AI | nilay@theverge.com |
| **David Pierce** | The Verge | Apps, productivity | david.pierce@theverge.com |
| **Lauren Goode** | Wired | Consumer tech | Twitter: @LaurenGoode |
| **Will Knight** | Wired | AI, machine learning | will_knight@wired.com |
| **Kyle Wiggers** | TechCrunch | AI, ML startups | kyle.wiggers@techcrunch.com |
| **Devin Coldewey** | TechCrunch | Dev tools, startups | devin@techcrunch.com |
| **Benj Edwards** | Ars Technica | AI history, tools | benj.edwards@arstechnica.com |
| **Ron Amadeo** | Ars Technica | Android, desktop apps | ron.amadeo@arstechnica.com |

### Tier 2: Developer & Productivity Focus

| Name | Outlet | Focus | Contact |
|------|--------|-------|---------|
| **Swyx (Shawn Wang)** | Latent Space | AI engineering | swyx@latent.space |
| **Simon Willison** | simonwillison.net | AI tools, dev | Twitter: @simonw |
| **Matt Shumer** | AI tool reviews | AI apps | Twitter: @mattshumer_ |
| **Ethan Mollick** | One Useful Thing | AI for work | Twitter: @emollick |
| **Nat Friedman** | AI investor/builder | AI ecosystem | Twitter: @natfriedman |
| **Andrej Karpathy** | AI thought leader | AI tools | Twitter: @karpathy |
| **Dan Shipper** | Every | AI & productivity | dan@every.to |

### Tier 3: AI-Focused Newsletters

| Newsletter | Author | Focus | Pitch Email |
|------------|--------|-------|-------------|
| **The Neuron** | Pete Huang | AI news digest | tips@theneurondaily.com |
| **TLDR AI** | Team | AI/ML daily | editor@tldr.tech |
| **Import AI** | Jack Clark | AI research | submissions@importai.net |
| **Ben's Bites** | Ben Tossell | AI tools | ben@bensbites.co |
| **The Rundown AI** | Rowan Cheung | AI news | tips@therundown.ai |
| **Superhuman AI** | Zain Kahn | AI productivity | zain@superhumanai.io |

---

## Podcast Opportunities

### AI & Tech Podcasts

| Podcast | Host | Audience | Pitch Angle |
|---------|------|----------|-------------|
| **Latent Space** | Swyx & Alessio | AI engineers | Technical deep-dive on Tauri + multi-model architecture |
| **Practical AI** | Daniel Whitenack | AI practitioners | Practical tool for daily AI use |
| **AI Breakdown** | Nathaniel Whittemore | AI curious | What makes a great AI interface |
| **Hard Fork** | Kevin Roose & Casey Newton | Tech mainstream | Consumer take on AI tools |
| **Acquired** | Ben Gilbert & David Rosenthal | Tech business | Open source business model |
| **Syntax** | Wes Bos & Scott Tolinski | Web developers | Building desktop apps with Tauri |
| **Changelog** | Adam Stacoviak | Developers | Open source story |
| **Software Engineering Daily** | Various | Engineers | Desktop app architecture |
| **Indie Hackers** | Courtland Allen | Bootstrappers | Building in public |
| **My First Million** | Sam Parr & Shaan Puri | Entrepreneurs | AI tools market opportunity |

### Pitch Template for Podcasts

**Subject:** Guest pitch: Creator of Molt (native AI chat client)

Hi [Host Name],

I'm David, creator of Molt—the first native desktop app that lets you chat with ChatGPT, Claude, and Gemini in one interface.

**Why your audience would care:**
- [Tailored angle based on podcast]
- Built with Tauri (10MB binary vs 300MB Electron)
- Open source, privacy-first approach

**What I can discuss:**
- Why native apps still matter in 2025
- Building a multi-model AI client
- The future of AI interfaces

Happy to share more. Love the show!

Best,
David

---

## YouTube Reviewers

### App Reviewers & Tech Channels

| Channel | Subscriber Range | Focus | Contact Method |
|---------|-----------------|-------|----------------|
| **Marques Brownlee (MKBHD)** | 18M+ | Tech reviews | Twitter DM / mgmt |
| **Linus Tech Tips** | 15M+ | Tech, software | linus@linusmediagroup.com |
| **Fireship** | 2M+ | Dev tools | Twitter: @firikiship |
| **ThePrimeagen** | 500K+ | Dev tools, Rust | Twitter: @ThePrimeagen |
| **NetworkChuck** | 3M+ | IT, productivity | networkchuck@gmail.com |
| **Jeff Su** | 1M+ | Productivity apps | Business inquiries via YouTube |
| **Thomas Frank** | 2.5M+ | Productivity | thomas@collegeinfogeek.com |
| **Ali Abdaal** | 5M+ | Productivity | team@aliabdaal.com |
| **Matt Wolfe** | 600K+ | AI tools | Twitter: @maborwolfe |
| **All About AI** | 200K+ | AI tools/tutorials | Business inquiries via YouTube |
| **AI Explained** | 500K+ | AI deep dives | Twitter: @ai_explained_ |
| **David Shapiro** | 150K+ | AI philosophy/tools | Twitter: @DavidShapiroAI |

### Developer Tool Channels

| Channel | Focus | Why Relevant |
|---------|-------|--------------|
| **Theo (t3.gg)** | Web dev, TypeScript | Tauri + React stack |
| **Ben Awad** | Dev tools, startups | Indie dev story |
| **Traversy Media** | Web dev tutorials | Tutorial potential |
| **Jack Herrington** | React, frontend | React architecture |
| **James Q Quick** | Dev tools | Tool reviews |

---

# 5. Social Media Kit

## Twitter/X Announcement Templates

### Launch Day Tweet Thread

**Tweet 1 (Main announcement):**
```
🦞 Introducing Molt — the AI chat client for power users

One app. Every AI. Native speed.

✅ ChatGPT, Claude, Gemini in one interface
✅ 10MB binary (not 300MB like Electron)
✅ Encrypted local storage
✅ Open source

Free download 👇
https://github.com/dokterdok/molt-client

🧵
```

**Tweet 2:**
```
Why I built Molt:

I was drowning in browser tabs. ChatGPT here, Claude there, Gemini somewhere else.

My laptop fan screaming. RAM maxed out.

I wanted ONE fast app for ALL my AI conversations.

So I built it.
```

**Tweet 3:**
```
The tech behind Molt:

• Tauri (Rust) — not Electron
• ~50MB RAM vs ~500MB
• Native OS webview
• AES-256 encryption
• Stores credentials in OS keychain

Performance matters.
```

**Tweet 4:**
```
Features shipping in v1.0:

✅ Real-time streaming
✅ Full-text search
✅ Conversation pinning
✅ Dark/light themes
✅ Keyboard shortcuts
✅ Model picker (10+ models)
✅ Windows, macOS, Linux

Coming soon: voice, file attachments, export
```

**Tweet 5:**
```
Molt is open source (MIT license).

No tracking. No telemetry. No BS.

Your conversations stay on YOUR device.

Star us on GitHub: github.com/dokterdok/molt-client

🦞
```

### Alternative Launch Tweets

**Short & punchy:**
```
🦞 Just shipped Molt

ChatGPT + Claude + Gemini in one native app

10MB binary. 50MB RAM. <1s startup.

Open source.

github.com/dokterdok/molt-client
```

**Problem-focused:**
```
Browser tabs are where AI productivity goes to die.

Today I'm launching Molt — a single desktop app for ChatGPT, Claude, and Gemini.

Native speed. Local encryption. Actually fast.

🦞 github.com/dokterdok/molt-client
```

**Technical audience:**
```
New OSS project: Molt

A multi-model AI chat client built with:
• Tauri v2 (Rust backend)
• React 18 + TypeScript
• IndexedDB + AES-GCM encryption
• Zustand state management

10MB binary. Ships to Win/Mac/Linux.

github.com/dokterdok/molt-client
```

---

## LinkedIn Post Templates

### Launch Announcement

```
🚀 Excited to announce the launch of Molt — a project I've been building for the past several months.

**The problem:** Using AI for work means juggling ChatGPT, Claude, and other tools across multiple browser tabs. It's slow, cluttered, and resource-heavy.

**The solution:** Molt is a native desktop app that brings all your AI conversations into one fast, unified interface.

Key features:
• Multi-model support (GPT-4, Claude, Gemini, and more)
• Native performance (~50MB RAM vs 500MB for Electron apps)
• End-to-end encrypted local storage
• Keyboard-first design for power users
• Open source (MIT license)

I built Molt because I wanted a tool that gets out of the way and lets me focus on the conversation, not the interface.

Available now for Windows, macOS, and Linux:
https://github.com/dokterdok/molt-client

Would love to hear your feedback! 🦞

#AI #Productivity #OpenSource #DesktopApps #ChatGPT #Claude #DeveloperTools
```

### Shorter LinkedIn Post

```
Just shipped something I've been working on:

🦞 Molt — a native desktop client for ChatGPT, Claude, and Gemini

Why? Because power users deserve better than browser tabs.

• One app for all your AI conversations
• 10x lighter than Electron alternatives
• Encrypted local storage
• Open source

Free download: github.com/dokterdok/molt-client

Feedback welcome!

#AI #Productivity #OpenSource
```

### Technical LinkedIn Post

```
Built something new with an interesting tech stack:

🦞 Molt — Native AI chat client

The architecture:
• Tauri v2 (Rust) instead of Electron → 10MB vs 300MB binary
• React 18 + TypeScript frontend
• IndexedDB with AES-GCM encryption at rest
• OS keychain integration (macOS Keychain, Windows Credential Manager)
• WebSocket connection to AI gateway

The result: A ChatGPT-style interface that uses 50MB RAM instead of 500MB.

Open source, MIT licensed.

If you're interested in desktop app development or the future of AI interfaces, I'd love to connect.

github.com/dokterdok/molt-client

#SoftwareEngineering #Rust #React #AI #DesktopDevelopment
```

---

## Product Hunt

### Tagline Options

**Primary (recommended):**
> "The AI chat client for power users"

**Alternatives:**
> "ChatGPT + Claude + Gemini in one native app"

> "One interface for every AI model"

> "The 10MB ChatGPT alternative (yes, really)"

> "Native-speed AI conversations"

> "Your AI, your device, your privacy"

### Product Hunt Description

**Tagline:** The AI chat client for power users

**Description:**
```
Molt is a native desktop app that unifies your AI conversations. Chat with ChatGPT, Claude, Gemini, and more from a single, lightning-fast interface.

🚀 **Why Molt?**
• **Multi-model:** Switch between AI providers with one click
• **Native speed:** ~10MB binary, ~50MB RAM (not another Electron app)
• **Private:** End-to-end encrypted local storage
• **Power tools:** Keyboard shortcuts, search, conversation management
• **Open source:** MIT licensed, community-driven

💡 **Built for:**
Developers, researchers, writers, and anyone who uses AI daily and wants a better experience than browser tabs.

🔧 **Tech stack:**
Tauri v2 (Rust) + React + TypeScript + IndexedDB

Free for Windows, macOS, and Linux.
```

### First Comment (Maker's Comment)

```
Hey Product Hunt! 👋

I'm David, creator of Molt. I built this because I was frustrated with the AI tool experience:

1. Too many browser tabs (ChatGPT, Claude, Gemini...)
2. Electron apps eating my RAM
3. No good way to search across conversations
4. Privacy concerns with cloud-stored chats

Molt solves all of these with a native-speed, privacy-first approach.

I'd love your feedback! Especially interested in:
- What features would make you switch?
- Any models or integrations you'd want supported?

And yes, the name "Molt" is a play on "multi-model" + the lobster emoji represents shedding (molting) the old browser-based experience. 🦞

Happy to answer any questions!
```

### Product Hunt Assets

**Thumbnail (240x240):**
- Molt icon on gradient background

**Gallery Images (1270x760):**
1. Hero shot — Main conversation interface
2. Multi-model — Model picker dropdown
3. Performance — Comparison chart vs Electron
4. Dark mode — Full app in dark theme
5. Search — Search functionality
6. Code — Syntax highlighted code block

**Video (optional):**
- 60-90 second demo showing:
  - Starting a conversation
  - Switching models
  - Search functionality
  - Keyboard shortcuts
  - Dark/light mode toggle

---

## Hacker News

### Show HN Post

**Title:**
```
Show HN: Molt – Native multi-model AI chat client (ChatGPT + Claude + Gemini)
```

**Body:**
```
Hey HN,

I built Molt because I was tired of juggling browser tabs for different AI services and watching Electron apps eat my RAM.

Molt is a native desktop client (Windows/macOS/Linux) that lets you chat with ChatGPT, Claude, Gemini, and other AI models from a single interface.

Tech stack:
- Tauri v2 (Rust backend) instead of Electron
- React 18 + TypeScript frontend
- IndexedDB with AES-GCM encryption
- ~10MB binary, ~50MB RAM usage

Key features:
- Multi-model support with easy switching
- Full-text search across all conversations
- Keyboard-first design
- Local-only storage (no cloud sync)
- MIT licensed

GitHub: https://github.com/dokterdok/molt-client
Direct download: https://github.com/dokterdok/molt-client/releases

Would love feedback, especially on:
1. What models/providers should I prioritize?
2. Any features that would make you switch from browser?
3. Interest in local model support (Ollama/LM Studio)?

Happy to answer technical questions about the Tauri architecture!
```

---

## Reddit Posts

### r/ChatGPT

```
**Title:** I built a native desktop app that combines ChatGPT, Claude, and Gemini in one interface

**Body:**
After months of juggling browser tabs between different AI services, I built Molt — a lightweight desktop client that lets you use all major AI models from one app.

**What it does:**
- Switch between GPT-4, Claude, Gemini, etc. with one click
- All conversations stored locally (encrypted)
- 10MB download, ~50MB RAM (not another Electron memory hog)
- Full-text search across all your chats
- Keyboard shortcuts for everything

**What it's NOT:**
- Not a new AI model (it connects to existing services)
- Not trying to replace the web interfaces
- Not collecting your data (open source, MIT license)

Free download: [github link]

Built this for my own workflow but figured others might find it useful. Happy to answer questions!
```

### r/ClaudeAI

```
**Title:** Made a native desktop client that supports Claude + other AI models

**Body:**
Hey r/ClaudeAI!

I built Molt because I use both Claude and ChatGPT daily, and switching between browser tabs was driving me crazy.

It's a native desktop app (Tauri, not Electron) that gives you a ChatGPT-style interface for multiple AI providers.

**Why Claude users might care:**
- Use Claude alongside GPT for comparison
- All conversations encrypted locally
- Actually fast (sub-second startup)
- Keyboard-first (Cmd/Ctrl+K for search, etc.)

Open source: [github link]

Would love feedback from fellow Claude users!
```

### r/LocalLLaMA

```
**Title:** Molt: Native AI chat client with planned Ollama/local model support

**Body:**
Just launched Molt, a native desktop chat client built with Tauri.

Currently supports cloud models (GPT, Claude, Gemini), but local model support is on the roadmap.

**Why post here:**
- Looking for feedback on local model integration priorities
- Considering Ollama and LM Studio support
- Interested in what features matter for local model users

**Current state:**
- ~10MB binary, ~50MB RAM
- Encrypted local storage
- Multi-model switching

Would you use a native GUI for your local models? What would make it worth switching from Ollama's web UI?

GitHub: [link]
```

---

## Asset Checklist

### Required Before Launch

- [ ] Logo variations (SVG, PNG at multiple sizes)
- [ ] App icons (all platforms)
- [ ] 5+ high-quality screenshots (each platform)
- [ ] Social preview image (1200x630)
- [ ] Product Hunt assets (thumbnail, gallery)
- [ ] README social preview (GitHub)
- [ ] Demo video (60-90 seconds)

### Nice to Have

- [ ] Animated GIF demos
- [ ] Comparison infographic
- [ ] Feature highlight images
- [ ] Testimonial graphics (post-launch)
- [ ] Press kit PDF download

---

## Contact Information

**Press Inquiries:**  
press@molt.dev

**General Contact:**  
hello@molt.dev

**Creator:**  
David de Wit  
Twitter: [@dokterdok](https://twitter.com/dokterdok)  
GitHub: [@dokterdok](https://github.com/dokterdok)

**Resources:**  
- Website: https://molt.dev
- GitHub: https://github.com/dokterdok/molt-client
- Press Kit: https://molt.dev/press

---

*This press kit is maintained by the Molt team. For the latest version, visit https://github.com/dokterdok/molt-client/blob/main/PRESS_KIT.md*
