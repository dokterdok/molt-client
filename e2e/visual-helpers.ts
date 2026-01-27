import { Page, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

/**
 * Visual Testing Helpers for Moltzer E2E Tests
 * 
 * Provides utilities for consistent screenshot capture, comparison,
 * and visual verification across test flows.
 */

// ES Module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Screenshot configuration
export const SCREENSHOT_CONFIG = {
  baseDir: path.join(__dirname, 'screenshots'),
  animations: 'disabled' as const,
  scale: 'css' as const,
  fullPage: false,
};

// Ensure screenshot directories exist
export function ensureScreenshotDirs(flows: string[]): void {
  if (!fs.existsSync(SCREENSHOT_CONFIG.baseDir)) {
    fs.mkdirSync(SCREENSHOT_CONFIG.baseDir, { recursive: true });
  }
  for (const flow of flows) {
    const flowDir = path.join(SCREENSHOT_CONFIG.baseDir, flow);
    if (!fs.existsSync(flowDir)) {
      fs.mkdirSync(flowDir, { recursive: true });
    }
  }
}

// Visual step capture with logging
export interface VisualStep {
  flow: string;
  name: string;
  expected: string;
  screenshot: string;
  timestamp: string;
}

export async function captureVisualStep(
  page: Page,
  flow: string,
  stepName: string,
  expectedState: string,
  options: { fullPage?: boolean; timeout?: number } = {}
): Promise<VisualStep> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const sanitizedName = stepName.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
  const filename = `${sanitizedName}_${timestamp}.png`;
  const screenshotPath = path.join(SCREENSHOT_CONFIG.baseDir, flow, filename);
  
  // Wait a brief moment for any animations
  await page.waitForTimeout(options.timeout ?? 200);
  
  await page.screenshot({
    path: screenshotPath,
    fullPage: options.fullPage ?? SCREENSHOT_CONFIG.fullPage,
    animations: SCREENSHOT_CONFIG.animations,
    scale: SCREENSHOT_CONFIG.scale,
  });
  
  const step: VisualStep = {
    flow,
    name: stepName,
    expected: expectedState,
    screenshot: screenshotPath,
    timestamp,
  };
  
  console.log(`📸 [${flow}] ${stepName}`);
  console.log(`   Expected: ${expectedState}`);
  console.log(`   File: ${screenshotPath}`);
  
  return step;
}

// Clear app state for fresh start
export async function clearAppState(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
    // Clear IndexedDB databases
    if ('indexedDB' in window) {
      indexedDB.databases().then(dbs => {
        dbs.forEach(db => {
          if (db.name) {
            indexedDB.deleteDatabase(db.name);
          }
        });
      });
    }
  });
}

// Skip onboarding for tests that don't need it
export async function skipOnboarding(page: Page): Promise<void> {
  await page.evaluate(() => {
    localStorage.setItem('Moltzer-onboarding-completed', 'true');
    localStorage.setItem('Moltzer-app-version', '1.0.0');
  });
}

// Wait for app to be ready
export async function waitForAppReady(page: Page, options: { timeout?: number } = {}): Promise<void> {
  const timeout = options.timeout ?? 10000;
  
  // Wait for either main interface or onboarding
  await Promise.race([
    page.waitForSelector('header', { timeout }),
    page.waitForSelector('[data-testid="onboarding"]', { timeout }).catch(() => null),
    page.getByText(/Welcome to Moltzer/i).waitFor({ timeout }).catch(() => null),
  ]);
}

// Check for key UI elements
export interface UICheck {
  element: string;
  visible: boolean;
  enabled?: boolean;
  text?: string;
}

export async function checkUIElements(
  page: Page,
  checks: Array<{ name: string; selector: string; expectText?: string }>
): Promise<UICheck[]> {
  const results: UICheck[] = [];
  
  for (const check of checks) {
    const locator = page.locator(check.selector);
    const visible = await locator.isVisible().catch(() => false);
    const text = visible && check.expectText 
      ? await locator.textContent().catch(() => null)
      : undefined;
    
    results.push({
      element: check.name,
      visible,
      text: text ?? undefined,
    });
  }
  
  return results;
}

// Take comparison screenshots (before/after)
export async function captureBeforeAfter(
  page: Page,
  flow: string,
  actionName: string,
  action: () => Promise<void>,
  options: { fullPage?: boolean } = {}
): Promise<{ before: VisualStep; after: VisualStep }> {
  const before = await captureVisualStep(
    page,
    flow,
    `${actionName}-before`,
    `State before: ${actionName}`,
    options
  );
  
  await action();
  
  const after = await captureVisualStep(
    page,
    flow,
    `${actionName}-after`,
    `State after: ${actionName}`,
    options
  );
  
  return { before, after };
}

// Keyboard shortcuts helper
export const shortcuts = {
  openSettings: async (page: Page) => {
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+Comma' : 'Control+Comma');
  },
  toggleSidebar: async (page: Page) => {
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+Backslash' : 'Control+Backslash');
  },
  escape: async (page: Page) => {
    await page.keyboard.press('Escape');
  },
  submit: async (page: Page) => {
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+Enter' : 'Control+Enter');
  },
};

// Verify connection status
export async function getConnectionStatus(page: Page): Promise<'connected' | 'disconnected' | 'connecting' | 'unknown'> {
  const indicators = {
    connected: page.getByText(/^Connected$/i),
    disconnected: page.getByText(/Disconnected|Offline/i),
    connecting: page.getByText(/Connecting|Reconnecting/i),
  };
  
  for (const [status, locator] of Object.entries(indicators)) {
    if (await locator.isVisible().catch(() => false)) {
      return status as 'connected' | 'disconnected' | 'connecting';
    }
  }
  
  return 'unknown';
}

// Generate test report
export interface TestReport {
  timestamp: string;
  duration: number;
  flows: {
    name: string;
    steps: VisualStep[];
    passed: boolean;
    errors: string[];
  }[];
  summary: {
    totalSteps: number;
    passedFlows: number;
    failedFlows: number;
  };
}

export function generateReport(
  steps: Map<string, VisualStep[]>,
  errors: Map<string, string[]>,
  startTime: Date
): TestReport {
  const flows: TestReport['flows'] = [];
  
  for (const [flowName, flowSteps] of steps) {
    const flowErrors = errors.get(flowName) ?? [];
    flows.push({
      name: flowName,
      steps: flowSteps,
      passed: flowErrors.length === 0,
      errors: flowErrors,
    });
  }
  
  return {
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime.getTime(),
    flows,
    summary: {
      totalSteps: flows.reduce((sum, f) => sum + f.steps.length, 0),
      passedFlows: flows.filter(f => f.passed).length,
      failedFlows: flows.filter(f => !f.passed).length,
    },
  };
}

// Write report to file
export function saveReport(report: TestReport, filename: string = 'visual-test-report.json'): void {
  const reportPath = path.join(SCREENSHOT_CONFIG.baseDir, filename);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 Report saved: ${reportPath}`);
}

// Print summary to console
export function printSummary(report: TestReport): void {
  console.log('\n' + '═'.repeat(60));
  console.log('📊 VISUAL TEST SUMMARY');
  console.log('═'.repeat(60));
  
  console.log(`\n⏱️  Duration: ${(report.duration / 1000).toFixed(2)}s`);
  console.log(`📸 Total Steps: ${report.summary.totalSteps}`);
  console.log(`✅ Passed Flows: ${report.summary.passedFlows}`);
  console.log(`❌ Failed Flows: ${report.summary.failedFlows}`);
  
  if (report.summary.failedFlows > 0) {
    console.log('\n❌ FAILED FLOWS:');
    for (const flow of report.flows.filter(f => !f.passed)) {
      console.log(`\n  ${flow.name}:`);
      for (const error of flow.errors) {
        console.log(`    - ${error}`);
      }
    }
  }
  
  console.log('\n' + '═'.repeat(60));
}
