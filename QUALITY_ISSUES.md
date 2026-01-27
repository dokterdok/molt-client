# Quality Issues Report - Moltzer Rebrand Audit

Generated: 2025-01-27
Auditor: Claude (360° Quality Review Subagent)

## Summary

✅ **No "Moltzerzer" typos found** - The double-zer issue has been addressed.

⚠️ **15 issues found** - All require fixing (see below)

---

## 🔴 CRITICAL: Branding Issues (Old "Molt" References)

### Issue #1: Bug Report Template - Wrong Product Name
**File:** `.github/ISSUE_TEMPLATE/bug_report.yml`
**Lines:** 64-65
**Problem:** Uses "Molt Version" and "Molt" instead of "Moltzer"
**Fix:** Change to "Moltzer Version" and "Moltzer"

### Issue #2: Question Template - Wrong Product Name  
**File:** `.github/ISSUE_TEMPLATE/question.yml`
**Lines:** 2, 45-46
**Problem:** Uses "Molt" throughout instead of "Moltzer"
**Fix:** Change all "Molt" references to "Moltzer"

### Issue #3: Release Workflow - Wrong Product Name in Release Names
**File:** `.github/workflows/release.yml`
**Lines:** 44, 49, 55, 67, 172
**Problem:** Release names show "Molt X.X.X" instead of "Moltzer X.X.X"
**Fix:** Change "Molt" to "Moltzer" in release name templates

### Issue #4: Code Signing Docs - Wrong Product Name
**File:** `.github/CODE_SIGNING.md`
**Lines:** 59, 240, 243
**Problem:** References "Molt CI" and "Molt.app" instead of "Moltzer"
**Fix:** Change to "Moltzer CI" and "Moltzer.app"

### Issue #5: Funding Configuration - Wrong Product Name
**File:** `.github/FUNDING.yml`
**Line:** 1
**Problem:** Comment says "Sponsor Molt development"
**Fix:** Change to "Sponsor Moltzer development"

### Issue #6: Discovery Module - Old Config File Name
**File:** `src-tauri/src/discovery.rs`
**Line:** 137
**Problem:** Looks for "molt.config.json" config file
**Fix:** Change to "moltzer.config.json"

### Issue #7: Gateway Module - Old Client ID
**File:** `src-tauri/src/gateway.rs`
**Lines:** 584, 601, 1133, 1147
**Problem:** Client identifies as "molt" and user agent shows "molt/X.X.X"
**Fix:** Change to "moltzer" and "moltzer/X.X.X"

---

## 🟡 MINOR: Placeholder URLs in Documentation

### Issue #8: Roadmap Placeholder Discord Link
**File:** `docs/ROADMAP.md`
**Line:** 493
**Problem:** Placeholder Discord link `discord.gg/Moltzer` (not a real link)
**Recommendation:** Either create the Discord server and update, or remove the placeholder

### Issue #9: Roadmap Placeholder Email
**File:** `docs/ROADMAP.md`
**Line:** 494
**Problem:** Placeholder email `feedback@Moltzer.app`
**Recommendation:** Set up this email or remove the placeholder

---

## ✅ VERIFIED: No Issues Found

1. **"Moltzerzer" typos** - None found ✅
2. **"Moltzter" typos** - None found ✅
3. **"Moltser" typos** - None found ✅
4. **Lorem ipsum** - None found ✅
5. **Capitalization consistency** - "Moltzer" properly capitalized throughout ✅
6. **"Moltbot" (Gateway name)** - Correctly preserved where needed ✅
7. **Package names** - Consistent ✅
8. **Console.log in production** - All found instances are in tests/debug code ✅

---

## Files Changed by This Audit

After fixes applied:
- `.github/ISSUE_TEMPLATE/bug_report.yml`
- `.github/ISSUE_TEMPLATE/question.yml`
- `.github/workflows/release.yml`
- `.github/CODE_SIGNING.md`
- `.github/FUNDING.yml`
- `src-tauri/src/discovery.rs`
- `src-tauri/src/gateway.rs`

---

## Notes

1. **Repository URL**: The repo is currently named `molt-client` on GitHub. David will rename it to `molt-client`. References in docs have been noted but the actual repo rename is a manual step.

2. **Build artifacts**: Files in `src-tauri/target/` contain old "molt-client" references but these are generated during build and will be regenerated correctly once the source files are fixed.

3. **The Rust code client ID**: Changing from "molt" to "moltzer" in gateway.rs is important for proper client identification with the Gateway server.
