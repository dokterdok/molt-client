# Security Policy

## 🔒 Security Overview

Moltzer takes security and privacy seriously. This document outlines our security practices and how to report vulnerabilities.

## 🛡️ Security Features

### End-to-End Encryption

All conversations stored in Moltzer are encrypted using **AES-GCM 256-bit** encryption:

- **At Rest:** All messages in the local IndexedDB database are encrypted
- **Master Key:** Stored securely in your OS's credential manager:
  - **macOS:** Keychain
  - **Windows:** Credential Manager
  - **Linux:** Secret Service (libsecret)
- **Zero Cloud Storage:** Your data never leaves your device

### Secure Communication

- **WebSocket Security:** Automatic fallback from `ws://` to `wss://` for secure connections
- **Auth Tokens:** Optional authentication tokens stored in OS keychain
- **No Telemetry:** Moltzer doesn't collect or transmit usage data

### Code Security

- **Rust Backend:** Memory-safe language prevents common vulnerabilities
- **Tauri Framework:** Sandboxed environment with minimal attack surface
- **Dependency Scanning:** Automated security audits via Dependabot
- **No Eval:** No dynamic code execution or `eval()` usage

## 📋 Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## 🚨 Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

### How to Report

1. **Email:** Send details to **security@moltzer.dev** (or create a private security advisory on GitHub)
2. **Include:**
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)
3. **Timeline:**
   - We'll acknowledge receipt within **48 hours**
   - We'll send updates every **5-7 days**
   - We aim to fix critical issues within **30 days**

### What Happens Next

1. We'll investigate and validate the report
2. We'll develop a fix
3. We'll release a security patch
4. We'll credit you in the release notes (unless you prefer to remain anonymous)

## 🔍 Security Best Practices for Users

### Protect Your Master Key

- **Never share** your encryption master key
- If you suspect compromise, regenerate keys via Settings
- Use a strong OS password (protects keychain access)

### Gateway Security

- **Run Gateway locally** when possible (`localhost`)
- **Use wss://** for remote connections
- **Enable authentication** on your Gateway
- **Keep Gateway updated** to the latest version

### General Security

- Download Moltzer only from official sources:
  - [GitHub Releases](https://github.com/dokterdok/moltzer-client/releases)
  - Official package managers (when available)
- Verify checksums of downloaded binaries
- Keep Moltzer and your OS updated
- Don't install untrusted plugins or extensions

## 🔐 Encryption Details

### Algorithm

- **Cipher:** AES-GCM (Galois/Counter Mode)
- **Key Size:** 256 bits
- **IV/Nonce:** 96 bits (randomly generated per message)
- **Authentication:** Built-in authenticated encryption

### Key Management

- **Master Key:** Randomly generated 256-bit key (per device)
- **Key Storage:** OS-native credential storage (encrypted by OS)
- **Key Derivation:** PBKDF2 with 100,000 iterations (when password-based)

### Implementation

- Uses **Web Crypto API** (browser-native cryptography)
- See `src/lib/encryption.ts` for implementation details

## 📦 Dependency Security

- **Automated Scanning:** Dependabot runs daily
- **Dependency Pinning:** All dependencies locked in `package-lock.json` and `Cargo.lock`
- **Minimal Dependencies:** We avoid unnecessary packages
- **Trusted Sources:** Only use well-maintained, audited libraries

## 🏗️ Build Security

### Code Signing

- **macOS:** Binaries are code-signed (Developer ID)
- **Windows:** Binaries are Authenticode signed
- **Linux:** GPG signatures available for AppImages

### Reproducible Builds

- CI/CD builds are reproducible from source
- Build scripts are open and auditable
- See `.github/workflows/release.yml` for build process

## 🔄 Security Updates

We'll announce security updates via:

- GitHub Security Advisories
- Release notes
- Project README

Subscribe to **Watch → Custom → Security alerts** on GitHub to get notified.

## 📚 Further Reading

- [ENCRYPTION.md](./ENCRYPTION.md) - Detailed encryption documentation
- [Tauri Security](https://tauri.app/v1/references/architecture/security/) - Framework security model
- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) - Browser cryptography

## ✅ Security Audit

Moltzer has not yet undergone a formal third-party security audit. If you're interested in sponsoring an audit, please reach out to security@moltzer.dev.

## 🙏 Acknowledgments

We're grateful to security researchers who responsibly disclose vulnerabilities. Contributors will be credited in release notes (with permission).

---

**Last Updated:** January 2026

For questions about this policy, contact: security@moltzer.dev
