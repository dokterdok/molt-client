# Code Signing Guide for Moltzer client

This guide explains how to set up code signing for macOS, Windows, and Linux releases of the Moltzer client.

## Table of Contents

- [Why Code Signing?](#why-code-signing)
- [macOS Code Signing](#macos-code-signing)
- [Windows Code Signing](#windows-code-signing)
- [Tauri Updater Signing](#tauri-updater-signing)
- [GitHub Secrets Configuration](#github-secrets-configuration)
- [Testing Signed Builds](#testing-signed-builds)

---

## Why Code Signing?

Code signing provides:

1. **User Trust**: Operating systems won't show scary warnings
2. **Security**: Users know the app comes from you and hasn't been tampered with
3. **Gatekeeper/SmartScreen Bypass**: Seamless installation experience
4. **Auto-Updates**: Required for Tauri's built-in updater to work securely

---

## macOS Code Signing

### Prerequisites

1. **Apple Developer Account** ($99/year)
2. **Developer ID Certificate** for distribution outside the Mac App Store

### Step 1: Generate Certificate

1. Go to [Apple Developer Certificates](https://developer.apple.com/account/resources/certificates/list)
2. Click **+** to create a new certificate
3. Select **Developer ID Application**
4. Follow the instructions to generate a Certificate Signing Request (CSR) using Keychain Access
5. Upload the CSR and download your certificate
6. Double-click to install it in your Keychain

### Step 2: Export Certificate for CI

1. Open **Keychain Access**
2. Find your "Developer ID Application" certificate
3. Right-click → **Export**
4. Save as `.p12` file with a strong password
5. Convert to base64 for GitHub Actions:

```bash
base64 -i certificate.p12 -o certificate-base64.txt
```

### Step 3: Get App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com/)
2. Sign in → **Security** → **App-Specific Passwords**
3. Generate a new password for "Moltzer CI"
4. Save this password securely

### Step 4: Configure GitHub Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

```
APPLE_CERTIFICATE              # Base64-encoded .p12 file
APPLE_CERTIFICATE_PASSWORD     # Password for the .p12 file
APPLE_SIGNING_IDENTITY         # "Developer ID Application: Your Name (TEAM_ID)"
APPLE_ID                       # Your Apple ID email
APPLE_PASSWORD                 # App-specific password
APPLE_TEAM_ID                  # Your 10-character Team ID
```

### Finding Your Signing Identity

```bash
security find-identity -v -p codesigning
```

Look for a line like:
```
1) ABC123DEF456 "Developer ID Application: John Doe (XYZ789)"
```

The string in quotes is your `APPLE_SIGNING_IDENTITY`.

### Finding Your Team ID

1. Go to [Apple Developer Membership](https://developer.apple.com/account/#/membership/)
2. Your Team ID is shown under your name (10 characters, e.g., `XYZ789`)

---

## Windows Code Signing

### Prerequisites

1. **Code Signing Certificate** from a trusted CA:
   - DigiCert
   - Sectigo
   - GlobalSign
   - Others listed in Microsoft's [trusted root program](https://docs.microsoft.com/en-us/security/trusted-root/program-requirements)

2. Certificates typically cost $100-$400/year

### Step 1: Obtain Certificate

1. Purchase a code signing certificate from a CA
2. Complete the validation process (can take 3-7 days)
3. Download your certificate (usually a `.pfx` or `.p12` file)

### Step 2: Export Certificate for CI

If you have a `.pfx` file, convert it to base64:

```powershell
# PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("certificate.pfx")) | Out-File certificate-base64.txt
```

```bash
# Linux/macOS
base64 -i certificate.pfx -o certificate-base64.txt
```

### Step 3: Configure GitHub Secrets

Add these secrets:

```
WINDOWS_CERTIFICATE              # Base64-encoded .pfx file
WINDOWS_CERTIFICATE_PASSWORD     # Password for the .pfx file
```

### Alternative: Azure Key Vault (Recommended for Teams)

For better security, store your certificate in Azure Key Vault:

1. Create an Azure Key Vault
2. Upload your certificate
3. Create a service principal with access
4. Add these secrets instead:

```
AZURE_KEY_VAULT_URI
AZURE_CLIENT_ID
AZURE_CLIENT_SECRET
AZURE_TENANT_ID
AZURE_CERT_NAME
```

Update `.github/workflows/release.yml` to use Azure Key Vault signing.

---

## Tauri Updater Signing

Tauri's auto-updater requires signing update packages to ensure they haven't been tampered with.

### Step 1: Generate Updater Keys

```bash
# Install Tauri CLI if not already installed
npm install -g @tauri-apps/cli

# Generate a new key pair
tauri signer generate
```

This generates:
- **Private key**: Keep this SECRET! Used in CI to sign updates
- **Public key**: Add to `tauri.conf.json` (safe to commit)

### Step 2: Add Public Key to Config

The public key is already referenced in `src-tauri/tauri.conf.json`:

```json
{
  "plugins": {
    "updater": {
      "pubkey": "YOUR_PUBLIC_KEY_HERE"
    }
  }
}
```

Replace `YOUR_PUBLIC_KEY_HERE` with the public key from step 1.

### Step 3: Add Private Key to GitHub Secrets

```
TAURI_SIGNING_PRIVATE_KEY           # The private key (entire content)
TAURI_SIGNING_PRIVATE_KEY_PASSWORD  # Password if you set one (optional)
```

**Security Note**: The private key should ONLY exist in GitHub Secrets and your local secure storage. Never commit it!

---

## GitHub Secrets Configuration

### Required Secrets Summary

| Secret | Platform | Required? | Description |
|--------|----------|-----------|-------------|
| `APPLE_CERTIFICATE` | macOS | Yes | Base64-encoded .p12 certificate |
| `APPLE_CERTIFICATE_PASSWORD` | macOS | Yes | Password for .p12 file |
| `APPLE_SIGNING_IDENTITY` | macOS | Yes | Full signing identity string |
| `APPLE_ID` | macOS | Yes | Your Apple ID email |
| `APPLE_PASSWORD` | macOS | Yes | App-specific password |
| `APPLE_TEAM_ID` | macOS | Yes | 10-character team ID |
| `WINDOWS_CERTIFICATE` | Windows | Yes | Base64-encoded .pfx certificate |
| `WINDOWS_CERTIFICATE_PASSWORD` | Windows | Yes | Password for .pfx file |
| `TAURI_SIGNING_PRIVATE_KEY` | All | Yes | Updater private key |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | All | Optional | Updater key password |
| `CODECOV_TOKEN` | CI | Optional | For test coverage upload |

### Adding Secrets to GitHub

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add each secret one by one

---

## Testing Signed Builds

### Testing Locally

#### macOS

```bash
# Build the app
npm run tauri build

# Check signature
codesign -dvv src-tauri/target/release/bundle/macos/Moltzer.app

# Verify signature
spctl -a -vv src-tauri/target/release/bundle/macos/Moltzer.app
```

Successful output should show:
```
accepted
source=Developer ID
```

#### Windows

```powershell
# Build the app
npm run tauri build

# Check signature
Get-AuthenticodeSignature "src-tauri\target\release\bundle\msi\moltzer_1.0.0_x64.msi"
```

Status should be `Valid`.

### Testing in CI

1. Push a tag to trigger a release:

```bash
git tag v1.0.0-beta.1
git push origin v1.0.0-beta.1
```

2. Go to **Actions** tab on GitHub
3. Watch the **Release** workflow
4. Download artifacts to test signed builds

### Verifying Auto-Updates

1. Release version `v1.0.0`
2. Install it on your machine
3. Release version `v1.0.1`
4. Open the app - it should prompt to update

---

## Troubleshooting

### macOS: "code object is not signed at all"

**Problem**: Certificate not properly imported or wrong identity specified.

**Solution**:
1. Verify certificate is in your keychain
2. Check `APPLE_SIGNING_IDENTITY` matches exactly: `security find-identity -v -p codesigning`

### macOS: "resource fork, Finder information, or similar detritus"

**Problem**: Build artifacts have extended attributes.

**Solution**: Clean before building:
```bash
xattr -cr src-tauri/target/release/bundle/
```

### Windows: "certificate not trusted"

**Problem**: Using a self-signed certificate or one not trusted by Windows.

**Solution**: 
- Purchase a certificate from a Windows-trusted CA
- For testing only: Add certificate to Windows Trusted Root

### Updater: "signature verification failed"

**Problem**: Public key doesn't match private key, or artifact wasn't signed.

**Solution**:
1. Regenerate keys: `tauri signer generate`
2. Update public key in `tauri.conf.json`
3. Update private key in GitHub Secrets
4. Rebuild and release

### CI: "security: command not found" (macOS workflow)

**Problem**: `security` commands failing on macOS runner.

**Solution**: Ensure you're running on `macos-latest` runner and commands are only executed when certificate exists:

```yaml
if: matrix.platform == 'macos-latest' && env.APPLE_CERTIFICATE != ''
```

---

## Cost Summary

| Item | Annual Cost | Required For |
|------|-------------|--------------|
| Apple Developer Program | $99 | macOS signing & notarization |
| Windows Code Signing Certificate | $100-$400 | Windows signing |
| Tauri Updater Keys | Free | Auto-updates (all platforms) |

**Total**: ~$200-$500/year for full cross-platform signing

---

## Additional Resources

- [Tauri Code Signing Docs](https://tauri.app/v1/guides/distribution/sign-macos)
- [Apple Code Signing Guide](https://developer.apple.com/support/code-signing/)
- [Microsoft Code Signing](https://docs.microsoft.com/en-us/windows/win32/seccrypto/cryptography-tools)
- [Tauri Updater Docs](https://tauri.app/v1/guides/distribution/updater)

---

## Quick Start (No Signing)

If you want to test releases without signing:

1. **Skip code signing secrets** - workflows will build unsigned
2. **Remove updater config** - comment out the `updater` section in `tauri.conf.json`
3. **Build and distribute manually** - users will see OS warnings

This is fine for:
- Internal testing
- Beta releases to trusted users
- Development builds

For production releases, proper code signing is strongly recommended.
