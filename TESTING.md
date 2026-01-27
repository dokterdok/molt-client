# Testing Guide

This project uses a comprehensive testing strategy with multiple layers of tests.

## Test Stack

- **Unit & Component Tests**: Vitest + React Testing Library
- **E2E Tests**: Playwright
- **Linting**: ESLint with TypeScript support
- **Type Checking**: TypeScript strict mode

## Running Tests

### Unit and Component Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:ui

# Run with coverage
npm test -- --coverage
```

### E2E Tests

```bash
# Run E2E tests
npm run test:e2e

# Run E2E tests with UI
npm run test:e2e:ui

# Debug E2E tests
npm run test:e2e:debug
```

### Linting and Type Checking

```bash
# Run linter
npm run lint

# Run TypeScript compiler
npm run build

# Format code
npm run format
```

## Writing Tests

### Component Tests

Component tests are located next to the components they test:

```
src/
  components/
    Button.tsx
    Button.test.tsx
```

Example:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Button from './Button';

describe('Button', () => {
  it('should render text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });
});
```

### E2E Tests

E2E tests are in the `e2e/` directory:

```
e2e/
  basic.spec.ts
  chat.spec.ts
```

Example:

```typescript
import { test, expect } from '@playwright/test';

test('should load app', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Moltzer/);
});
```

## CI/CD

Tests run automatically on:
- Every push to main/master
- Every pull request
- Before releases

### CI Workflows

- **ci.yml**: Runs linting, tests, and builds on all platforms
- **e2e.yml**: Runs end-to-end tests
- **release.yml**: Builds and publishes releases
- **dependabot-automerge.yml**: Auto-merges minor/patch dependency updates

## Coverage Thresholds

The project maintains these minimum coverage thresholds:
- Lines: 60%
- Functions: 60%
- Branches: 60%
- Statements: 60%

## Test Philosophy

1. **Test behavior, not implementation** - Focus on what users experience
2. **Keep tests simple** - Each test should verify one thing
3. **Use meaningful names** - Test names should describe what they test
4. **Avoid test interdependence** - Tests should work in any order
5. **Mock external dependencies** - Tests should be fast and reliable

## Debugging Tests

### Vitest

```bash
# Run specific test file
npm test -- Button.test.tsx

# Run tests matching pattern
npm test -- --grep "Button"

# Update snapshots
npm test -- -u
```

### Playwright

```bash
# Run in headed mode
npm run test:e2e -- --headed

# Run specific test
npm run test:e2e -- basic.spec.ts

# Generate code
npx playwright codegen http://localhost:5173
```

## Troubleshooting

### Tests fail in CI but pass locally

- Ensure you're using the same Node version (check `.nvmrc` or CI config)
- Run tests with `CI=true npm test` to simulate CI environment
- Check for timing issues - add appropriate waits

### Playwright tests timeout

- Increase timeout in `playwright.config.ts`
- Check that dev server is starting correctly
- Verify network conditions

### Coverage not generated

- Run `npm test -- --coverage`
- Check `vitest.config.ts` for coverage configuration
- Ensure `@vitest/coverage-v8` is installed
