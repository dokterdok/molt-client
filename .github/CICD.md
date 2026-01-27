# CI/CD Pipeline Documentation

This document describes the CI/CD setup for the Moltzer client, including workflows, automated testing, releases, and dependency management.

## Overview

The Moltzer client uses GitHub Actions for continuous integration and deployment with the following workflows:

1. **CI Workflow** (`ci.yml`) - Runs on every push and PR
2. **Release Workflow** (`release.yml`) - Builds and publishes releases on tags
3. **Dependabot** (`dependabot.yml`) - Automated dependency updates

---

## CI Workflow

**Trigger**: Push to `master`/`main`, pull requests, manual dispatch

**File**: `.github/workflows/ci.yml`

### Jobs

#### 1. `lint-frontend`
- Runs ESLint on TypeScript/React code
- Checks code formatting with Prettier
- **Fails on**: Lint errors or formatting issues

#### 2. `test-frontend`
- Runs Vitest test suite with coverage
- Uploads coverage to Codecov
- **Fails on**: Test failures

#### 3. `lint-rust`
- Runs `cargo fmt` to check Rust formatting
- Runs `cargo clippy` for linting
- **Fails on**: Formatting issues or clippy warnings

#### 4. `test-rust`
- Runs `cargo test` for Rust unit and integration tests
- Tests all features
- **Fails on**: Test failures

#### 5. `audit`
- Runs `npm audit` for JavaScript security vulnerabilities
- Runs `cargo audit` for Rust security vulnerabilities
- **Warns on**: High-severity vulnerabilities (doesn't fail build)

#### 6. `build-test`
- Smoke test builds for all platforms (macOS, Linux, Windows)
- Ensures app builds successfully
- Runs in parallel after all tests pass
- **Fails on**: Build errors

#### 7. `ci-success`
- Summary job that checks all previous jobs
- Required status check for PRs
- **Fails if**: Any previous job failed

### Platform Coverage

| Platform | Architecture | Runner |
|----------|-------------|---------|
| macOS | Apple Silicon (ARM64) | `macos-latest` |
| Linux | x86_64 | `ubuntu-22.04` |
| Windows | x86_64 | `windows-latest` |

### Running CI Locally

To replicate CI checks locally:

```bash
# Frontend lint & tests
npm run lint
npm run format
npm test -- --run

# Rust lint & tests
cd src-tauri
cargo fmt --all -- --check
cargo clippy --all-targets --all-features -- -D warnings
cargo test --all-features

# Build
cd ..
npm run build
npm run tauri build
```

---

## Release Workflow

**Trigger**: Git tags matching `v*.*.*` (e.g., `v1.0.0`), manual dispatch

**File**: `.github/workflows/release.yml`

### Process Flow

```
Create Tag (v1.0.0)
    ↓
Create GitHub Release (draft)
    ↓
Build for all platforms in parallel
    ├─ macOS (ARM64)
    ├─ macOS (Intel)
    ├─ Linux (x86_64)
    └─ Windows (x86_64)
    ↓
Sign binaries (if certificates configured)
    ↓
Generate updater JSON
    ↓
Upload all artifacts to release
    ↓
Finalize release (publish)
```

### Release Artifacts

Each release produces:

#### macOS
- `moltzer_1.0.0_aarch64.dmg` - Apple Silicon installer
- `moltzer_1.0.0_x64.dmg` - Intel installer
- Signed and notarized (if configured)

#### Windows
- `moltzer_1.0.0_x64.msi` - MSI installer
- Signed (if configured)

#### Linux
- `moltzer_1.0.0_amd64.AppImage` - AppImage bundle
- `moltzer_1.0.0_amd64.deb` - Debian package

#### Updater Files
- `latest.json` - Update manifest
- `*.sig` - Update signatures

### Creating a Release

#### Automated (Recommended)

```bash
# Bump version in package.json and Cargo.toml
npm version 1.0.0

# Create and push tag
git tag v1.0.0
git push origin v1.0.0

# GitHub Actions will automatically:
# 1. Create a draft release
# 2. Build all platforms
# 3. Upload artifacts
# 4. Publish release
```

#### Manual

1. Go to **Actions** → **Release**
2. Click **Run workflow**
3. Enter tag (e.g., `v1.0.0`)
4. Click **Run workflow**

### Release Checklist

- [ ] Update version in `package.json`
- [ ] Update version in `src-tauri/Cargo.toml`
- [ ] Update version in `src-tauri/tauri.conf.json`
- [ ] Update `CHANGELOG.md` (if you have one)
- [ ] Commit changes: `git commit -am "chore: bump version to 1.0.0"`
- [ ] Create tag: `git tag v1.0.0`
- [ ] Push: `git push && git push --tags`
- [ ] Monitor GitHub Actions
- [ ] Test downloads from release page
- [ ] Publish release (un-draft)

---

## Auto-Updates

The Moltzer client uses Tauri's built-in updater for seamless updates.

### How It Works

1. App checks for updates on startup
2. Compares local version with `latest.json` from GitHub releases
3. If newer version exists, prompts user to update
4. Downloads and verifies signature
5. Installs update and restarts app

### Configuration

**Location**: `src-tauri/tauri.conf.json`

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "dialog": true,
      "endpoints": [
        "https://github.com/dokterdok/molt-client/releases/latest/download/latest.json"
      ],
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```

### Setup

See [CODE_SIGNING.md](./CODE_SIGNING.md) for complete setup instructions.

Quick setup:

```bash
# Generate updater keys
npm run tauri signer generate

# Output:
# Public key: dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6...
# Private key: (shown separately, KEEP SECRET!)

# Add public key to tauri.conf.json
# Add private key to GitHub Secrets: TAURI_SIGNING_PRIVATE_KEY
```

### Testing Updates

1. Install version `v1.0.0` on your machine
2. Create and publish version `v1.0.1`
3. Open the app
4. Should see update prompt
5. Click "Update" - app downloads, installs, and restarts

### Disabling Updates

If you want to disable auto-updates (e.g., for enterprise deployments):

```json
{
  "plugins": {
    "updater": {
      "active": false
    }
  }
}
```

Or set `dialog: false` to check silently without prompting.

---

## Dependabot

**Configuration**: `.github/dependabot.yml`

Dependabot automatically creates PRs to update dependencies on a weekly schedule (Mondays at 9:00 AM).

### Ecosystems Monitored

#### NPM (JavaScript/TypeScript)
- Checks weekly
- Groups related updates:
  - `tauri-plugins` - All Tauri packages together
  - `react` - React and React-related packages
  - `testing` - Test frameworks
  - `dev-dependencies` - Minor/patch dev deps
- Limits: 10 open PRs max
- Labels: `dependencies`, `javascript`

#### Cargo (Rust)
- Checks weekly
- Groups related updates:
  - `tauri-core` - Tauri framework packages
  - `security` - Security-related crates
- Limits: 10 open PRs max
- Labels: `dependencies`, `rust`

#### GitHub Actions
- Checks weekly
- Groups all action updates together
- Labels: `dependencies`, `github-actions`

### Ignored Updates

Dependabot will NOT auto-update:

- **React major versions** - Breaking changes require manual review
- **Tauri major versions** - Breaking changes require manual migration

These will still be flagged but won't auto-create PRs.

### Handling Dependabot PRs

1. Dependabot creates PR with changes
2. CI runs automatically
3. Review changes and CI results
4. Merge if tests pass or click "Rebase" if needed

**Auto-merge** (optional): You can enable auto-merge for patch updates:

```bash
gh pr merge <PR_NUMBER> --auto --squash
```

Or enable in repository settings for trusted updates.

---

## Environment Variables & Secrets

### Required for CI

| Variable | Required | Description |
|----------|----------|-------------|
| `GITHUB_TOKEN` | ✅ | Automatically provided by GitHub Actions |

### Required for Releases

| Variable | Required | Description |
|----------|----------|-------------|
| `TAURI_SIGNING_PRIVATE_KEY` | ✅ | Private key for update signing |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | ⬜ | Password if private key is encrypted |

### Optional (Code Signing)

| Variable | Platform | Description |
|----------|----------|-------------|
| `APPLE_CERTIFICATE` | macOS | Base64-encoded .p12 certificate |
| `APPLE_CERTIFICATE_PASSWORD` | macOS | Certificate password |
| `APPLE_SIGNING_IDENTITY` | macOS | "Developer ID Application: ..." |
| `APPLE_ID` | macOS | Apple ID for notarization |
| `APPLE_PASSWORD` | macOS | App-specific password |
| `APPLE_TEAM_ID` | macOS | 10-character team ID |
| `WINDOWS_CERTIFICATE` | Windows | Base64-encoded .pfx certificate |
| `WINDOWS_CERTIFICATE_PASSWORD` | Windows | Certificate password |

### Optional (Integrations)

| Variable | Service | Description |
|----------|---------|-------------|
| `CODECOV_TOKEN` | Codecov | For test coverage reports |

**See**: [CODE_SIGNING.md](./CODE_SIGNING.md) for detailed setup instructions.

---

## Caching Strategy

Both workflows use caching to speed up builds:

### NPM Cache
- Managed by `actions/setup-node@v4`
- Caches `node_modules` based on `package-lock.json`
- Shared across branches

### Rust Cache
- Managed by `Swatinem/rust-cache@v2`
- Caches:
  - Cargo registry
  - Cargo index
  - Target directory (compiled dependencies)
- Keyed by:
  - Cargo.lock
  - Rust version
  - Platform
- Per-platform caching for cross-compilation

### Cache Invalidation

Caches are automatically invalidated when:
- `package-lock.json` changes (NPM)
- `Cargo.lock` changes (Rust)
- Rust version changes

Manual cache clearing:
1. Go to **Settings** → **Actions** → **Caches**
2. Delete specific caches if needed

---

## Troubleshooting

### CI Fails on `lint-frontend`

**Problem**: Code doesn't meet style guidelines

**Solution**:
```bash
npm run format      # Auto-fix formatting
npm run lint        # Check remaining issues
```

### CI Fails on `test-rust`

**Problem**: Rust tests failing

**Solution**:
```bash
cd src-tauri
cargo test --all-features -- --nocapture  # See test output
```

### Release Builds Failing

**Problem**: Platform-specific build errors

**Solution**:
1. Check Actions logs for specific error
2. Test locally on that platform
3. Common issues:
   - Missing system dependencies (Linux)
   - Certificate issues (macOS/Windows)
   - Disk space (runners have limited space)

### Dependabot PRs Failing CI

**Problem**: Dependency update breaks tests

**Solution**:
1. Check which dependency caused the issue
2. Review changelog for breaking changes
3. Either:
   - Fix code to work with new version
   - Add to `ignore` list in `dependabot.yml`

### Update Check Failing in App

**Problem**: App can't check for updates

**Solution**:
1. Verify `latest.json` exists in latest release
2. Check network connectivity
3. Verify public key matches private key used for signing
4. Check browser console for error messages

---

## Best Practices

### Versioning

Use [Semantic Versioning](https://semver.org/):

- `v1.0.0` - Major release (breaking changes)
- `v1.1.0` - Minor release (new features, backwards compatible)
- `v1.1.1` - Patch release (bug fixes)

### Branch Protection

Recommended settings for `main`/`master` branch:

- ✅ Require status checks to pass (`ci-success` job)
- ✅ Require branches to be up to date
- ✅ Require pull request reviews (1 reviewer)
- ✅ Dismiss stale reviews on push
- ⬜ Allow force pushes (disabled)

### Commit Messages

Use conventional commits for automatic changelog generation:

```
feat: add dark mode support
fix: resolve WebSocket reconnection issue
docs: update installation instructions
chore: bump dependencies
ci: improve build caching
```

Prefixes:
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `style:` - Code style/formatting
- `refactor:` - Code refactoring
- `test:` - Tests
- `chore:` - Maintenance
- `ci:` - CI/CD changes

### Release Cadence

Suggested schedule:
- **Patch releases**: As needed for critical bugs
- **Minor releases**: Every 2-4 weeks
- **Major releases**: Every 3-6 months

---

## Monitoring

### GitHub Actions Usage

Check usage limits:
1. Go to **Settings** → **Billing**
2. View Actions usage

**Free tier limits**:
- Public repos: Unlimited
- Private repos: 2,000 minutes/month

**Average consumption per workflow**:
- CI: ~10 minutes
- Release: ~45 minutes (all platforms)

### Build Status Badge

Add to README.md:

```markdown
[![CI](https://github.com/dokterdok/molt-client/actions/workflows/ci.yml/badge.svg)](https://github.com/dokterdok/molt-client/actions/workflows/ci.yml)
```

---

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Tauri GitHub Action](https://github.com/tauri-apps/tauri-action)
- [Dependabot Configuration](https://docs.github.com/en/code-security/dependabot)
- [CODE_SIGNING.md](./CODE_SIGNING.md) - Code signing setup
- [Tauri Distribution Guide](https://tauri.app/v1/guides/distribution/)

---

## Questions?

If you encounter issues not covered here:

1. Check [GitHub Actions logs](../../actions)
2. Review [Tauri documentation](https://tauri.app/)
3. Search [Tauri discussions](https://github.com/tauri-apps/tauri/discussions)
4. Open an issue with:
   - Workflow run link
   - Error messages
   - Platform details
