# Changelog

All notable changes to Moltzer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Comprehensive troubleshooting section in README
- Detailed code style guidelines in CONTRIBUTING.md
- Test coverage requirements and examples

### Changed
- Rebranded from "Molt" to "Moltzer" across all documentation
- Updated CONTRIBUTING.md with enhanced developer guidelines

### Fixed
- Typography errors in README and CONTRIBUTING files

## [1.0.0] - 2024-01-15

### Added
- 🎉 Initial release of Moltzer
- Native desktop application for Windows, macOS, and Linux
- Real-time chat interface with streaming responses
- End-to-end encryption for all conversations (AES-GCM 256-bit)
- Local IndexedDB storage for unlimited conversation history
- Full-text search across all messages with highlighting
- Multiple AI model support (Claude, GPT, Gemini, etc.)
- Dark/Light/System theme support
- Keyboard shortcuts for power users
- Conversation management (create, delete, pin, search)
- Settings dialog with Gateway configuration
- Auto-generated conversation titles
- Rich markdown rendering with syntax highlighting
- OS keychain integration for secure credential storage
- Tauri v2 framework for tiny binaries (~10MB)
- Comprehensive test suite (unit, integration, E2E)

### Security
- End-to-end encryption with Web Crypto API (AES-GCM)
- Master key storage in OS keychain/credential manager
- Secure WebSocket connections with wss:// fallback
- Zero cloud storage - all data stays on device

### Developer Experience
- TypeScript for full type safety
- React 18 with modern hooks and concurrent rendering
- Zustand for lightweight state management
- Dexie for powerful IndexedDB interactions
- Playwright for E2E testing
- Vitest for unit testing
- ESLint and Prettier for code quality
- Hot-reload development mode
- Cross-platform build system

## [0.9.0-beta] - 2024-01-01

### Added
- Beta release for early testers
- Core chat functionality
- Basic conversation management
- WebSocket connection to Clawdbot Gateway
- Message history persistence

### Known Issues
- File attachments UI exists but not functional
- Voice input not yet implemented
- No conversation export functionality

## [0.1.0-alpha] - 2023-12-15

### Added
- Initial proof of concept
- Basic Tauri app structure
- Simple chat interface
- WebSocket client implementation

---

## Release Links

- [Unreleased changes](https://github.com/dokterdok/molt-client/compare/v1.0.0...HEAD)
- [1.0.0](https://github.com/dokterdok/molt-client/releases/tag/v1.0.0)
- [0.9.0-beta](https://github.com/dokterdok/molt-client/releases/tag/v0.9.0-beta)
- [0.1.0-alpha](https://github.com/dokterdok/molt-client/releases/tag/v0.1.0-alpha)

## Changelog Categories

We use the following categories in this changelog:

- **Added** - New features
- **Changed** - Changes to existing functionality
- **Deprecated** - Soon-to-be removed features
- **Removed** - Removed features
- **Fixed** - Bug fixes
- **Security** - Security improvements or fixes
- **Developer Experience** - Changes for contributors
