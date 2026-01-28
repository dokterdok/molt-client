# Setting Up Code Signing for Auto-Updates

This guide walks you through setting up code signing for Moltzer's auto-update system.

## Prerequisites

- Tauri CLI installed: `npm install -g @tauri-apps/cli`
- GitHub repository with Actions enabled
- Admin access to GitHub repository settings

## Step 1: Generate Signing Keys

Open a terminal and run:

```bash
# Create a directory for your keys (keep this SECURE!)
mkdir -p ~/.tauri

# Generate the signing keypair
tauri signer generate -w ~/.tauri/moltzer.key
```

This will output:
```
Your keypair was generated successfully
Private: (a long base64 string)
Public: (a shorter base64 string)

Key path: ~/.tauri/moltzer.key
Password: (empty if you didn't set one)
```

**IMPORTANT:**
- ⚠️ **Save both keys immediately!**
- 🔒 **Never commit the private key to git**
- 📋 **Copy the public key to a safe place**
- 🔑 **If you lose the private key, you cannot sign updates**

## Step 2: Update tauri.conf.json

1. Open `src-tauri/tauri.conf.json`
2. Find the `plugins.updater.pubkey` field
3. Replace `YOUR_PUBLIC_KEY_HERE` with the **public key** from Step 1

Example:
```json
{
  "plugins": {
    "updater": {
      "active": true,
      "dialog": false,
      "endpoints": [
        "https://github.com/AlixHQ/moltzer-community/releases/latest/download/latest.json"
      ],
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6..."
    }
  }
}
```

4. Commit this change:
```bash
git add src-tauri/tauri.conf.json
git commit -m "Configure updater public key"
git push
```

## Step 3: Configure GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions

### Add Required Secrets

Click "New repository secret" and add:

1. **TAURI_SIGNING_PRIVATE_KEY**
   - Name: `TAURI_SIGNING_PRIVATE_KEY`
   - Value: The **private key** from Step 1 (the long base64 string)

2. **TAURI_SIGNING_PRIVATE_KEY_PASSWORD**
   - Name: `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
   - Value: The password you set (or leave empty if you didn't set one)
   - If you didn't set a password, you can skip this secret

### For macOS Code Signing (Optional but Recommended)

If you want to distribute macOS builds without security warnings:

1. **Get an Apple Developer Account** ($99/year)
   - Sign up at https://developer.apple.com

2. **Create a Developer ID Certificate**
   - Go to Certificates, Identifiers & Profiles
   - Create a "Developer ID Application" certificate
   - Download the .cer file

3. **Export Certificate as .p12**
   - Open Keychain Access on macOS
   - Find your Developer ID certificate
   - Right-click → Export
   - Choose .p12 format
   - Set a password
   - Save as `certificate.p12`

4. **Convert to Base64**
   ```bash
   base64 -i certificate.p12 | pbcopy
   ```

5. **Add macOS Secrets to GitHub:**
   - `APPLE_CERTIFICATE` - The base64 string you just copied
   - `APPLE_CERTIFICATE_PASSWORD` - The password you set for the .p12
   - `APPLE_SIGNING_IDENTITY` - Your signing identity (e.g., "Developer ID Application: Your Name (TEAM_ID)")
   - `APPLE_ID` - Your Apple ID email
   - `APPLE_PASSWORD` - An app-specific password (create at appleid.apple.com)
   - `APPLE_TEAM_ID` - Your 10-character Team ID

## Step 4: Test the Setup

### Local Test (Without Signing)

```bash
# Build in debug mode to test compilation
npm install
npm run tauri build
```

If this succeeds, your code compiles correctly.

### Test GitHub Actions

1. Create a test tag:
   ```bash
   git tag v0.0.1-test
   git push origin v0.0.1-test
   ```

2. Go to GitHub → Actions
3. Watch the "Release" workflow run
4. Check for errors in each job

If successful:
- Builds complete for all platforms
- Artifacts are signed
- Release is created (draft)

5. Delete the test release and tag:
   ```bash
   git tag -d v0.0.1-test
   git push origin :refs/tags/v0.0.1-test
   ```

## Step 5: First Real Release

When ready for your first release:

1. **Update version numbers** in:
   - `package.json`
   - `src-tauri/Cargo.toml`
   - `src-tauri/tauri.conf.json`

2. **Commit and tag:**
   ```bash
   git add .
   git commit -m "Release v1.0.0"
   git tag v1.0.0
   git push origin main --tags
   ```

3. **Wait for GitHub Actions to complete**
   - This builds for all platforms
   - Takes 15-30 minutes

4. **Publish the release:**
   - Go to GitHub → Releases
   - Find the draft release
   - Edit and add release notes
   - Click "Publish release"

5. **Test the updater:**
   - Install the old version
   - Increment version and create another release
   - Run the old version
   - Wait for update notification
   - Test "Update Now" flow

## Troubleshooting

### "Invalid signature" error during update

**Cause:** Public key in tauri.conf.json doesn't match the private key used to sign

**Fix:**
1. Verify the public key in tauri.conf.json
2. Check GitHub secret `TAURI_SIGNING_PRIVATE_KEY`
3. Regenerate keys if needed (but this breaks old releases)

### GitHub Actions fails with "TAURI_SIGNING_PRIVATE_KEY not set"

**Cause:** Secret not configured correctly

**Fix:**
1. Go to repository Settings → Secrets → Actions
2. Verify `TAURI_SIGNING_PRIVATE_KEY` exists
3. Check there are no extra spaces or newlines
4. Re-add the secret if needed

### macOS build unsigned / shows warning

**Cause:** Missing Apple Developer certificate or secrets

**Options:**
1. Get Apple Developer account and set up certificates (recommended)
2. Distribute as unsigned (users must right-click → Open)
3. Use ad-hoc signing (limited distribution)

### Build succeeds but updater doesn't detect updates

**Cause:** Endpoint URL or manifest file issue

**Fix:**
1. Check `endpoints` in tauri.conf.json
2. Verify release is published (not draft)
3. Check that `latest.json` exists at the endpoint URL
4. Test manually: `curl https://github.com/AlixHQ/moltzer-community/releases/latest/download/latest.json`

## Security Best Practices

✅ **DO:**
- Store private key in GitHub Secrets only
- Use a password for the private key
- Rotate keys periodically (every 1-2 years)
- Keep a secure backup of the private key
- Use different keys for production/testing
- Enable 2FA on GitHub account

❌ **DON'T:**
- Commit private key to git
- Share private key via email/Slack
- Use the same key across multiple projects
- Store keys in plaintext on disk
- Give others access to GitHub Secrets

## Key Rotation

If you need to rotate keys:

1. Generate new keypair
2. Update tauri.conf.json with new public key
3. Update GitHub secret with new private key
4. Build and release a transition version:
   - Include both old and new public keys (if supported)
   - Or document that users must reinstall
5. After all users update, remove old key

Note: Rotating keys may break auto-update for users on old versions. Plan carefully.

## Resources

- [Tauri Signing Docs](https://tauri.app/v1/guides/distribution/sign-android)
- [GitHub Actions Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Apple Code Signing](https://developer.apple.com/support/code-signing/)
