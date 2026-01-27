# CI/CD Pipeline Verification Checklist

Use this checklist to verify that the CI/CD pipeline is working correctly on GitHub.

## ✅ Pre-Push Verification (Local)

- [x] All workflow files created
  - [x] `.github/workflows/ci.yml`
  - [x] `.github/workflows/e2e.yml`
  - [x] `.github/workflows/release.yml`
  - [x] `.github/workflows/dependabot-automerge.yml`
- [x] Test configurations created
  - [x] `vitest.config.ts`
  - [x] `playwright.config.ts`
- [x] ESLint configuration created
  - [x] `eslint.config.js`
- [x] Dependencies installed
  - [x] Playwright (`@playwright/test`)
  - [x] ESLint globals (`globals`)
  - [x] ESLint JS (`@eslint/js`)
- [x] Documentation created
  - [x] `TESTING.md`
  - [x] `CI_CD_SETUP_SUMMARY.md`
  - [x] `src/components/README_TESTS.md`
- [x] Changes committed and pushed to GitHub

## 🔍 Post-Push Verification (GitHub)

After pushing, verify on GitHub:

### 1. Workflows Appear
- [ ] Go to `https://github.com/dokterdok/molt-client/actions`
- [ ] Verify all 4 workflows are visible:
  - [ ] CI
  - [ ] E2E Tests
  - [ ] Release
  - [ ] Dependabot Auto-Merge

### 2. CI Workflow Runs
- [ ] Check that CI workflow was triggered by the push
- [ ] Verify all jobs are running/completed:
  - [ ] Frontend Lint & Format
  - [ ] Frontend Tests
  - [ ] Rust Lint & Format
  - [ ] Rust Tests
  - [ ] Security Audit
  - [ ] Build Test (macOS)
  - [ ] Build Test (Ubuntu)
  - [ ] Build Test (Windows)
  - [ ] CI Success

### 3. E2E Workflow Runs
- [ ] Check that E2E workflow was triggered
- [ ] Verify E2E tests run on all platforms:
  - [ ] E2E Tests (ubuntu-latest)
  - [ ] E2E Tests (windows-latest)
  - [ ] E2E Tests (macos-latest)

### 4. Dependabot Configuration
- [ ] Go to `https://github.com/dokterdok/molt-client/network/updates`
- [ ] Verify Dependabot is active
- [ ] Check for any pending dependency updates

### 5. Pull Request Protection (Optional but Recommended)
- [ ] Go to repository Settings > Branches
- [ ] Add branch protection rule for `master`:
  - [ ] Require status checks to pass before merging
  - [ ] Select required status checks:
    - [ ] CI Success
    - [ ] E2E Tests (optional, may be slow)
  - [ ] Require branches to be up to date before merging
  - [ ] Require linear history (optional)

## 🐛 Troubleshooting

### Workflows Don't Appear
1. Check `.github/workflows/` directory exists in repository
2. Verify YAML files are valid (no syntax errors)
3. Refresh the Actions page
4. Check repository settings - Actions must be enabled

### Workflows Fail
1. Check the workflow run logs on GitHub Actions page
2. Look for red X marks and click for details
3. Common issues:
   - **Dependencies not installed**: npm ci failed
   - **Linting errors**: Check ESLint output
   - **Test failures**: Check test logs
   - **Build errors**: Check TypeScript compilation

### E2E Tests Timeout
1. Increase timeout in `playwright.config.ts`
2. Check that dev server starts correctly
3. Verify network connectivity in CI environment

### Dependabot PRs Don't Auto-Merge
1. Verify workflow has correct permissions
2. Check that branch protection allows auto-merge
3. Ensure CI passes before auto-merge attempts
4. Check workflow logs for errors

## 🎯 Expected Outcomes

### On Every Push
1. **CI workflow** should run automatically
2. All linting should pass (or show existing warnings)
3. All tests should run
4. Builds should succeed on all platforms

### On Pull Requests
1. Same as push, plus:
2. Status checks appear on PR
3. PR cannot merge if CI fails (with branch protection)

### On Dependabot PRs
1. CI runs automatically
2. If minor/patch update: Auto-approves and auto-merges
3. If major update: Adds comment but doesn't auto-merge

### On Release Tags
1. Release workflow triggers
2. Builds for all platforms
3. Creates GitHub release (draft)
4. Uploads platform-specific artifacts

## 📝 Manual Tests

### Test 1: Create a Pull Request
```bash
git checkout -b test-ci
echo "# Test" >> README.md
git add README.md
git commit -m "test: verify CI pipeline"
git push origin test-ci
```
Then create a PR on GitHub and verify CI runs.

### Test 2: Trigger a Manual E2E Test
1. Go to Actions > E2E Tests
2. Click "Run workflow"
3. Select branch
4. Click "Run workflow"
5. Verify it runs successfully

### Test 3: Test Release Workflow (Optional)
⚠️ Only if you want to test releases (creates a draft):
```bash
git tag v1.0.0-test
git push origin v1.0.0-test
```
Check Actions for release build. Delete tag after testing:
```bash
git tag -d v1.0.0-test
git push origin :refs/tags/v1.0.0-test
```

## ✨ Success Criteria

The CI/CD pipeline is successfully set up when:
- ✅ All workflows appear in GitHub Actions
- ✅ CI runs automatically on push
- ✅ All jobs complete (pass or fail with actionable errors)
- ✅ Dependabot creates PRs
- ✅ E2E tests can run (even if some fail initially)
- ✅ Release workflow exists and is configured

## 📚 Next Steps After Verification

1. Fix any pre-existing code issues caught by CI
2. Write more component and E2E tests
3. Configure code signing secrets (for releases)
4. Set up branch protection rules
5. Configure code coverage tracking
6. Add status badges to README

---

**Last Updated**: CI/CD pipeline setup completed
**Repository**: https://github.com/dokterdok/molt-client
