# Moltzer client - CI/CD

This directory contains the complete CI/CD configuration for the Moltzer client.

## 🚀 Quick Links

- **[SETUP.md](./SETUP.md)** - ⭐ Start here! Next steps to complete setup
- **[CICD.md](./CICD.md)** - Complete CI/CD documentation
- **[CODE_SIGNING.md](./CODE_SIGNING.md)** - Code signing guide
- **[CI_SUMMARY.md](./CI_SUMMARY.md)** - What was implemented

## 📋 Quick Reference

### Workflows

| Workflow | Trigger | Purpose | Duration |
|----------|---------|---------|----------|
| **[ci.yml](./workflows/ci.yml)** | Push, PR | Tests, linting, builds | ~10-15 min |
| **[release.yml](./workflows/release.yml)** | Tag `v*.*.*` | Release binaries | ~45 min |

### Configuration Files

| File | Purpose |
|------|---------|
| **[dependabot.yml](./dependabot.yml)** | Automated dependency updates |

## ⚡ Common Tasks

### Create a Release

```bash
# Bump version
npm version patch  # or minor, major

# Create and push tag
git tag v1.0.0
git push origin v1.0.0

# GitHub Actions will:
# 1. Build for all platforms
# 2. Sign binaries (if configured)
# 3. Create GitHub Release (draft)
# 4. Upload installers
```

### Run CI Locally

```bash
# Frontend
npm run lint
npm run format
npm test

# Rust
cd src-tauri
cargo fmt --check
cargo clippy -- -D warnings
cargo test
```

### Generate Updater Keys

```bash
npm run tauri signer generate

# Add public key to: src-tauri/tauri.conf.json
# Add private key to: GitHub Secrets → TAURI_SIGNING_PRIVATE_KEY
```

## 🎯 Setup Status

### ✅ Completed
- CI workflow with testing and linting
- Release workflow for multi-platform builds
- Dependabot configuration
- Auto-update infrastructure
- Comprehensive documentation

### ⏳ Needs Configuration
- [ ] Generate Tauri updater keys
- [ ] Update `tauri.conf.json` with public key
- [ ] Add `TAURI_SIGNING_PRIVATE_KEY` to GitHub Secrets
- [ ] (Optional) Configure macOS code signing
- [ ] (Optional) Configure Windows code signing

**See [SETUP.md](./SETUP.md) for detailed instructions**

## 🔒 Required GitHub Secrets

### Minimum (Auto-Updates)
- `TAURI_SIGNING_PRIVATE_KEY` - For update signature verification

### Optional (Code Signing)

**macOS:**
- `APPLE_CERTIFICATE`
- `APPLE_CERTIFICATE_PASSWORD`
- `APPLE_SIGNING_IDENTITY`
- `APPLE_ID`
- `APPLE_PASSWORD`
- `APPLE_TEAM_ID`

**Windows:**
- `WINDOWS_CERTIFICATE`
- `WINDOWS_CERTIFICATE_PASSWORD`

## 📊 CI Status

Check build status: [Actions Tab](../../actions)

Add badge to main README:
```markdown
[![CI](https://github.com/dokterdok/molt-client/actions/workflows/ci.yml/badge.svg)](https://github.com/dokterdok/molt-client/actions/workflows/ci.yml)
```

## 🐛 Troubleshooting

**CI failing?** → Check [CICD.md Troubleshooting](./CICD.md#troubleshooting)

**Release not building?** → Review [release workflow logs](../../actions/workflows/release.yml)

**Auto-updates not working?** → See [CODE_SIGNING.md Troubleshooting](./CODE_SIGNING.md#troubleshooting)

## 📚 Documentation Map

```
.github/
├── README.md           ← You are here
├── SETUP.md            ← Next steps guide
├── CICD.md             ← Complete reference
├── CODE_SIGNING.md     ← Signing setup
├── CI_SUMMARY.md       ← Implementation summary
├── dependabot.yml      ← Dependency config
└── workflows/
    ├── ci.yml          ← CI workflow
    └── release.yml     ← Release workflow
```

## 🎓 Learning Resources

- [GitHub Actions Docs](https://docs.github.com/en/actions)
- [Tauri Distribution Guide](https://tauri.app/v1/guides/distribution/)
- [Dependabot Config](https://docs.github.com/en/code-security/dependabot)

---

**Ready to ship!** 🚢 Follow [SETUP.md](./SETUP.md) to complete configuration.
