# Development Guide

Complete guide to setting up your development environment and building Moltzer from source.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Running Locally](#running-locally)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Debugging](#debugging)
- [Building for Production](#building-for-production)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

| Tool | Version | Purpose |
|------|---------|---------|
| **Node.js** | ≥18.0.0 | JavaScript runtime |
| **npm** | ≥9.0.0 | Package manager |
| **Rust** | Latest stable | Tauri backend |
| **Git** | Any recent | Version control |

### Platform-Specific Requirements

**macOS:**
```bash
# Install Xcode Command Line Tools
xcode-select --install

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

**Windows:**
```powershell
# Install Rust from https://rustup.rs/
# Install WebView2 from https://go.microsoft.com/fwlink/p/?LinkId=2124703

# Install Visual Studio Build Tools
# https://visualstudio.microsoft.com/downloads/
# Select "Desktop development with C++"
```

**Linux (Ubuntu/Debian):**
```bash
# Install system dependencies
sudo apt update
sudo apt install libwebkit2gtk-4.0-dev \
  build-essential \
  curl \
  wget \
  libssl-dev \
  libgtk-3-dev \
  libayatana-appindicator3-dev \
  librsvg2-dev

# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

---

## Environment Setup

### 1. Clone the Repository

```bash
git clone https://github.com/dokterdok/molt-client.git
cd molt-client
```

### 2. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Verify Rust installation
rustc --version
cargo --version
```

**Expected output:**
```
rustc 1.75.0 (stable)
cargo 1.75.0
```

### 3. Configure Environment

Create a `.env.local` file (optional):

```bash
# .env.local
VITE_GATEWAY_URL=ws://localhost:18789
VITE_AUTH_TOKEN=your-dev-token
VITE_DEBUG=true
```

**Note:** Never commit `.env.local` — it's in `.gitignore`

### 4. Verify Setup

```bash
# Run development build
npm run tauri dev
```

The app should launch successfully. If not, see [Troubleshooting](#troubleshooting).

---

## Running Locally

### Development Mode

**Hot-reload development:**
```bash
npm run tauri dev
```

This will:
1. Start Vite dev server (React with HMR)
2. Build Rust backend
3. Launch the app
4. Watch for file changes and reload

**Fast iteration workflow:**
- **Frontend changes:** Auto-reload in ~100ms
- **Rust changes:** Rebuild and restart app (~10-30s)

### Separate Frontend & Backend

For faster frontend development:

```bash
# Terminal 1: Frontend only
npm run dev

# Terminal 2: Tauri in dev mode
npm run tauri dev
```

Access the web UI directly at `http://localhost:5173/` for debugging in browser DevTools.

---

## Project Structure

```
molt-client/
├── src/                          # React frontend
│   ├── components/               # UI components
│   │   ├── ChatView.tsx
│   │   ├── Sidebar.tsx
│   │   ├── MessageBubble.tsx
│   │   └── ui/                   # Radix UI primitives
│   ├── stores/                   # Zustand state management
│   │   └── store.ts
│   ├── lib/                      # Core logic & utilities
│   │   ├── db.ts                 # IndexedDB (Dexie)
│   │   ├── encryption.ts         # Web Crypto API
│   │   ├── persistence.ts        # Data sync
│   │   └── utils.ts              # Helper functions
│   ├── hooks/                    # Custom React hooks
│   ├── test/                     # Test utilities
│   ├── App.tsx                   # Root component
│   ├── main.tsx                  # Entry point
│   └── index.css                 # Global styles
│
├── src-tauri/                    # Rust backend
│   ├── src/
│   │   ├── lib.rs                # Tauri app setup
│   │   ├── gateway.rs            # WebSocket client
│   │   └── keychain.rs           # OS credential storage
│   ├── Cargo.toml                # Rust dependencies
│   ├── tauri.conf.json           # Tauri configuration
│   └── icons/                    # App icons
│
├── e2e/                          # End-to-end tests (Playwright)
│   ├── basic.spec.ts
│   ├── messaging.spec.ts
│   └── onboarding.spec.ts
│
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md
│   ├── PROTOCOL.md
│   └── DEVELOPMENT.md (this file)
│
├── .github/                      # GitHub Actions CI/CD
├── dist/                         # Build output (gitignored)
├── node_modules/                 # npm packages (gitignored)
│
├── package.json                  # Node.js dependencies & scripts
├── tsconfig.json                 # TypeScript config
├── vite.config.ts                # Vite config
├── tailwind.config.js            # Tailwind CSS config
├── eslint.config.js              # ESLint rules
└── vitest.config.ts              # Vitest config
```

### Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Root React component, app initialization |
| `src/stores/store.ts` | Global state (Zustand) |
| `src/lib/db.ts` | IndexedDB schema and queries |
| `src-tauri/src/lib.rs` | Tauri app setup, IPC commands |
| `src-tauri/src/gateway.rs` | WebSocket client for Gateway communication |
| `src-tauri/tauri.conf.json` | Tauri config (window settings, permissions, etc.) |
| `vite.config.ts` | Vite bundler config |
| `package.json` | Scripts, dependencies, metadata |

---

## Development Workflow

### Making Changes

**1. Create a feature branch:**
```bash
git checkout -b feature/my-awesome-feature
```

**2. Make your changes:**
- Edit code in `src/` or `src-tauri/src/`
- The app will auto-reload (frontend) or rebuild (Rust)

**3. Test your changes:**
```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e
```

**4. Lint and format:**
```bash
# Check for issues
npm run lint

# Auto-fix issues
npm run format
```

**5. Commit:**
```bash
git add .
git commit -m "feat: add awesome feature"
```

**6. Push and create PR:**
```bash
git push origin feature/my-awesome-feature
# Open PR on GitHub
```

### Code Style

Follow the guidelines in [CONTRIBUTING.md](../CONTRIBUTING.md):
- TypeScript for all new code
- ESLint + Prettier for formatting
- JSDoc comments for exported functions
- Conventional Commits for commit messages

---

## Testing

### Unit Tests (Vitest)

**Run all tests:**
```bash
npm run test
```

**Run specific test file:**
```bash
npm run test -- db.test.ts
```

**Run with UI:**
```bash
npm run test:ui
```

**Watch mode:**
```bash
npm run test -- --watch
```

**Coverage report:**
```bash
npm run test -- --coverage
```

### Integration Tests

Test components with React Testing Library:

```typescript
// Example: src/components/MessageBubble.test.tsx
import { render, screen } from '@testing-library/react';
import { MessageBubble } from './MessageBubble';

test('renders user message', () => {
  render(<MessageBubble 
    message={{ 
      role: 'user', 
      content: 'Hello!' 
    }} 
  />);
  
  expect(screen.getByText('Hello!')).toBeInTheDocument();
});
```

### End-to-End Tests (Playwright)

**Run E2E tests:**
```bash
npm run test:e2e
```

**Run with UI (debug mode):**
```bash
npm run test:e2e:ui
```

**Run in debug mode:**
```bash
npm run test:e2e:debug
```

**Run specific test:**
```bash
npm run test:e2e -- onboarding.spec.ts
```

### Writing E2E Tests

```typescript
// Example: e2e/messaging.spec.ts
import { test, expect } from '@playwright/test';

test('send message', async ({ page }) => {
  await page.goto('http://localhost:5173');
  
  // Wait for app to load
  await page.waitForSelector('[data-testid="chat-input"]');
  
  // Type and send message
  await page.fill('[data-testid="chat-input"]', 'Hello, Claude!');
  await page.press('[data-testid="chat-input"]', 'Enter');
  
  // Verify message appears
  await expect(page.locator('.message-user')).toContainText('Hello, Claude!');
});
```

---

## Debugging

### React DevTools

1. Run in development mode: `npm run tauri dev`
2. Open DevTools: **F12** or **Right-click → Inspect**
3. Use React DevTools extension (install from browser store)

### Rust Debugging

**Print debugging:**
```rust
println!("Debug: {:?}", variable);
```

**Proper logging:**
```rust
use log::{info, warn, error};

info!("Connected to Gateway");
warn!("Connection unstable");
error!("Failed to send message: {}", err);
```

View logs in terminal running `npm run tauri dev`.

**Advanced debugging:**
```bash
# Attach debugger (VS Code with rust-analyzer)
# Set breakpoints in Rust code
# Launch "Debug Tauri" configuration
```

### VS Code Setup

Install extensions:
- **rust-analyzer** - Rust language support
- **Tauri** - Tauri development tools
- **ESLint** - JavaScript linting
- **Prettier** - Code formatting

**Recommended `launch.json`:**
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "lldb",
      "request": "launch",
      "name": "Debug Tauri",
      "cargo": {
        "args": ["build", "--manifest-path=./src-tauri/Cargo.toml"]
      },
      "preLaunchTask": "ui:dev"
    }
  ]
}
```

### Network Debugging

**Inspect WebSocket traffic:**
```bash
# Use browser DevTools
# Network tab → WS filter
# See all messages sent/received
```

**Mock Gateway responses:**
```typescript
// src/lib/__mocks__/gateway.ts
export const mockGatewayClient = {
  send: vi.fn(),
  on: vi.fn(),
  connect: vi.fn().mockResolvedValue(undefined)
};
```

---

## Building for Production

### Build for Current Platform

```bash
npm run tauri build
```

Output location:
- **macOS:** `src-tauri/target/release/bundle/dmg/`
- **Windows:** `src-tauri/target/release/bundle/msi/`
- **Linux:** `src-tauri/target/release/bundle/appimage/`

### Build Options

**Debug build (faster, larger):**
```bash
cargo build
```

**Release build (optimized, smaller):**
```bash
cargo build --release
```

**Cross-compilation:**
```bash
# macOS → Windows (requires setup)
rustup target add x86_64-pc-windows-msvc
cargo build --target x86_64-pc-windows-msvc
```

### Build Configurations

Edit `src-tauri/tauri.conf.json`:

```json
{
  "build": {
    "devPath": "http://localhost:5173",
    "distDir": "../dist",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "package": {
    "productName": "Moltzer",
    "version": "1.0.0"
  },
  "bundle": {
    "identifier": "com.moltzer.client",
    "icon": [
      "icons/icon.icns",
      "icons/icon.ico",
      "icons/icon.png"
    ]
  }
}
```

---

## Troubleshooting

### Common Issues

#### "command not found: tauri"

**Fix:**
```bash
npm install
```

The Tauri CLI is installed as a dev dependency, accessed via `npm run tauri`.

#### "Rust compiler not found"

**Fix:**
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Restart terminal
source $HOME/.cargo/env
```

#### "WebView2 not found" (Windows)

**Fix:**
Download and install WebView2 Runtime:
https://go.microsoft.com/fwlink/p/?LinkId=2124703

#### "Cannot connect to Gateway"

**Fix:**
1. Verify Gateway is running:
   ```bash
   clawdbot gateway status
   ```

2. Check Gateway URL in Settings (default: `ws://localhost:18789`)

3. Check firewall isn't blocking port 18789

#### Build fails with "out of memory"

**Fix:**
```bash
# Increase Node memory limit
export NODE_OPTIONS=--max_old_space_size=4096
npm run tauri build
```

#### Hot-reload not working

**Fix:**
1. Stop the dev server (Ctrl+C)
2. Clear cache: `rm -rf node_modules/.vite`
3. Restart: `npm run tauri dev`

### Getting Help

1. **Check logs:**
   - Terminal output
   - Browser console (F12)
   - Rust logs in terminal

2. **Search existing issues:**
   https://github.com/dokterdok/molt-client/issues

3. **Ask for help:**
   - [GitHub Discussions](https://github.com/dokterdok/molt-client/discussions)
   - [Discord](https://discord.gg/moltzer) (if available)
   - Email: dev@moltzer.dev

---

## CI/CD

### GitHub Actions

The project uses GitHub Actions for:
- **CI:** Run tests on every PR
- **Release:** Build binaries for all platforms
- **Lint:** Check code style

**Workflows:**
- `.github/workflows/ci.yml` - Run tests
- `.github/workflows/release.yml` - Build and publish releases

### Running CI Locally

```bash
# Run the same checks as CI
npm run lint
npm run test
npm run test:e2e
npm run build
```

---

## Performance Tips

### Development

- Use `npm run dev` (no Tauri) for fast frontend iteration
- Use incremental Rust builds (enabled by default)
- Close unused browser tabs/apps to save memory

### Production Builds

- Use `--release` flag for optimized Rust code
- Enable LTO (Link-Time Optimization) in `Cargo.toml`:
  ```toml
  [profile.release]
  lto = true
  codegen-units = 1
  ```

---

## Resources

- **Tauri Docs:** https://tauri.app/v1/guides/
- **React Docs:** https://react.dev/
- **Vite Docs:** https://vitejs.dev/
- **Rust Book:** https://doc.rust-lang.org/book/
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/

---

## Next Steps

1. Read [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
2. Read [PROTOCOL.md](./PROTOCOL.md) for Gateway communication
3. Check [CONTRIBUTING.md](../CONTRIBUTING.md) for contribution guidelines
4. Join the community and start building!

---

**Last Updated:** 2024-01-15  
**Target Audience:** Developers contributing to Moltzer
