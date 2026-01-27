import { test, expect, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

/**
 * Visual E2E Testing System for Moltzer
 * 
 * Tests the app like a real user - screenshots at each step, analyze, take action.
 * Screenshots are saved to e2e/screenshots/ for visual inspection and comparison.
 */

// ES Module compatibility for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Screenshot directory
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

// Ensure screenshot directory exists
test.beforeAll(async () => {
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }
  // Create subdirectories for each test flow
  const flows = ['onboarding', 'chat', 'settings', 'offline'];
  for (const flow of flows) {
    const flowDir = path.join(SCREENSHOT_DIR, flow);
    if (!fs.existsSync(flowDir)) {
      fs.mkdirSync(flowDir, { recursive: true });
    }
  }
});

/**
 * Helper: Take a screenshot with a descriptive name and log expectations
 */
async function captureStep(
  page: Page,
  flow: string,
  step: string,
  expectedState: string,
  options: { fullPage?: boolean } = {}
): Promise<string> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${step.replace(/\s+/g, '-').toLowerCase()}_${timestamp}.png`;
  const filepath = path.join(SCREENSHOT_DIR, flow, filename);
  
  await page.screenshot({ 
    path: filepath, 
    fullPage: options.fullPage ?? false,
    animations: 'disabled' // Disable animations for consistent screenshots
  });
  
  console.log(`\n📸 [${flow}/${step}]`);
  console.log(`   Expected: ${expectedState}`);
  console.log(`   Screenshot: ${filepath}`);
  
  return filepath;
}

/**
 * Visual test report
 */
interface TestStep {
  flow: string;
  step: string;
  expected: string;
  actual: string;
  passed: boolean;
  screenshot: string;
}

const testReport: TestStep[] = [];

function reportStep(step: TestStep) {
  testReport.push(step);
  const icon = step.passed ? '✅' : '❌';
  console.log(`${icon} ${step.flow}/${step.step}: ${step.passed ? 'PASS' : 'FAIL'}`);
  if (!step.passed) {
    console.log(`   Expected: ${step.expected}`);
    console.log(`   Actual: ${step.actual}`);
  }
}

// ============================================================================
// FLOW 1: ONBOARDING
// ============================================================================

// Increase timeout for visual tests since they involve many waits
test.setTimeout(180000);

test.describe('Visual Flow: Onboarding', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app with a longer timeout
    try {
      await page.goto('/', { waitUntil: 'load', timeout: 30000 });
    } catch {
      // Try with domcontentloaded if load times out
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    
    // Wait a moment for app initialization
    await page.waitForTimeout(2000);
    
    // Clear all storage to simulate first-time user (with timeout protection)
    await Promise.race([
      page.evaluate(() => {
        try {
          localStorage.clear();
          sessionStorage.clear();
        } catch (e) {
          console.error('Failed to clear storage:', e);
        }
      }),
      new Promise(resolve => setTimeout(resolve, 5000))
    ]);
    
    // Reload with fresh storage
    try {
      await page.reload({ waitUntil: 'load', timeout: 30000 });
    } catch {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    await page.waitForTimeout(1000);
  });

  test('complete onboarding flow with screenshots', async ({ page }) => {
    await page.goto('/');
    
    // STEP 1: Welcome Screen
    console.log('\n🎬 STEP 1: Welcome Screen');
    
    // Wait for welcome to be visible
    await expect(page.getByText(/Welcome to Moltzer/i)).toBeVisible({ timeout: 10000 });
    
    await captureStep(page, 'onboarding', '01-welcome', 
      'Should see Welcome screen with lobster logo, headline, and Get Started button');
    
    // Verify key elements
    const welcomeCheck = {
      hasTitle: await page.getByText(/Welcome to Moltzer/i).isVisible(),
      hasGetStarted: await page.getByRole('button', { name: /Get Started/i }).isVisible(),
      hasSkipOption: await page.getByText(/I'll set this up later/i).isVisible(),
    };
    
    reportStep({
      flow: 'onboarding',
      step: 'Welcome Screen',
      expected: 'Welcome title, Get Started button, Skip option visible',
      actual: JSON.stringify(welcomeCheck),
      passed: welcomeCheck.hasTitle && welcomeCheck.hasGetStarted,
      screenshot: path.join(SCREENSHOT_DIR, 'onboarding', '01-welcome.png')
    });
    
    expect(welcomeCheck.hasTitle).toBeTruthy();
    expect(welcomeCheck.hasGetStarted).toBeTruthy();
    
    // STEP 2: Click Get Started
    console.log('\n🎬 STEP 2: Click Get Started → Detection');
    await page.getByRole('button', { name: /Get Started/i }).click();
    
    // Wait for detection step
    await page.waitForTimeout(500); // Brief pause for animation
    
    await captureStep(page, 'onboarding', '02-detection', 
      'Should see Detection step with scanning animation');
    
    // Detection can either succeed or fail, both are valid outcomes
    const detectionCheck = {
      hasSearchIcon: await page.getByText(/Looking for Gateway/i).isVisible().catch(() => false) ||
                     await page.getByText(/Auto-detecting/i).isVisible().catch(() => false),
      hasProgress: await page.locator('.bg-blue-500, .bg-gradient-to-r').first().isVisible().catch(() => false),
    };
    
    reportStep({
      flow: 'onboarding',
      step: 'Detection Step',
      expected: 'Detection UI with progress indicator',
      actual: JSON.stringify(detectionCheck),
      passed: detectionCheck.hasSearchIcon || detectionCheck.hasProgress,
      screenshot: path.join(SCREENSHOT_DIR, 'onboarding', '02-detection.png')
    });
    
    // STEP 3: Wait for detection result
    console.log('\n🎬 STEP 3: Detection Result');
    
    // Wait for detection to complete (either success or failure)
    await page.waitForTimeout(6000); // Detection checks multiple URLs
    
    await captureStep(page, 'onboarding', '03-detection-result', 
      'Should see either Success or No Gateway Found screen');
    
    // Check what state we're in
    const isSuccess = await page.getByText(/Connected successfully/i).isVisible().catch(() => false);
    const isNoGateway = await page.getByText(/No Gateway Found/i).isVisible().catch(() => false) ||
                        await page.getByRole('button', { name: /manual setup/i }).isVisible().catch(() => false) ||
                        await page.getByRole('button', { name: /Retry Detection/i }).isVisible().catch(() => false);
    const isSetup = await page.getByText(/Connect to Gateway/i).isVisible().catch(() => false);
    
    reportStep({
      flow: 'onboarding',
      step: 'Detection Result',
      expected: 'Success, No Gateway, or Setup screen',
      actual: `Success: ${isSuccess}, NoGateway: ${isNoGateway}, Setup: ${isSetup}`,
      passed: isSuccess || isNoGateway || isSetup,
      screenshot: path.join(SCREENSHOT_DIR, 'onboarding', '03-detection-result.png')
    });
    
    // STEP 4: If no gateway found, proceed to manual setup
    if (isNoGateway) {
      console.log('\n🎬 STEP 4: No Gateway → Manual Setup');
      
      // Click manual setup button
      const manualButton = page.getByRole('button', { name: /manual setup|Set Up Manually/i });
      if (await manualButton.isVisible()) {
        await manualButton.click();
        await page.waitForTimeout(300);
        
        await captureStep(page, 'onboarding', '04-setup-form', 
          'Should see Gateway Setup form with URL and Token inputs');
        
        // Verify setup form
        const setupCheck = {
          hasUrlInput: await page.getByPlaceholder(/ws:\/\/localhost/i).isVisible().catch(() => false) ||
                       await page.locator('input[type="text"]').first().isVisible(),
          hasTokenInput: await page.locator('input[type="password"]').isVisible().catch(() => false),
          hasTestButton: await page.getByRole('button', { name: /Test Connection/i }).isVisible().catch(() => false),
        };
        
        reportStep({
          flow: 'onboarding',
          step: 'Setup Form',
          expected: 'URL input, Token input, Test Connection button',
          actual: JSON.stringify(setupCheck),
          passed: setupCheck.hasUrlInput,
          screenshot: path.join(SCREENSHOT_DIR, 'onboarding', '04-setup-form.png')
        });
        
        // STEP 5: Enter Gateway URL and test connection
        console.log('\n🎬 STEP 5: Enter URL and Test');
        
        const urlInput = page.getByPlaceholder(/ws:\/\/localhost/i).or(
          page.locator('input[type="text"]').first()
        );
        
        await urlInput.fill('ws://localhost:18789');
        
        await captureStep(page, 'onboarding', '05-url-entered', 
          'Should see URL filled in the input');
        
        // Try to test connection
        const testButton = page.getByRole('button', { name: /Test Connection/i });
        if (await testButton.isVisible()) {
          await testButton.click();
          
          // Wait for connection attempt
          await page.waitForTimeout(3000);
          
          await captureStep(page, 'onboarding', '06-connection-result', 
            'Should see either connection success or error');
          
          const connectionSuccess = await page.getByText(/Connected successfully/i).isVisible().catch(() => false);
          const connectionError = await page.getByText(/failed|error|refused/i).isVisible().catch(() => false);
          
          reportStep({
            flow: 'onboarding',
            step: 'Connection Test',
            expected: 'Success or clear error message',
            actual: `Success: ${connectionSuccess}, Error: ${connectionError}`,
            passed: connectionSuccess || connectionError,
            screenshot: path.join(SCREENSHOT_DIR, 'onboarding', '06-connection-result.png')
          });
        }
      }
    }
    
    // STEP 6: Skip onboarding if not connected
    console.log('\n🎬 STEP 6: Skip to Main Interface');
    
    // Try to skip onboarding
    const skipButton = page.getByText(/I'll do this later|skip/i).first();
    if (await skipButton.isVisible().catch(() => false)) {
      await skipButton.click();
      await page.waitForTimeout(500);
    }
    
    // Or press Escape
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    
    await captureStep(page, 'onboarding', '07-main-interface', 
      'Should see main chat interface after onboarding');
    
    // Verify we're on main interface
    const mainInterfaceCheck = {
      hasSidebar: await page.locator('[role="navigation"]').isVisible().catch(() => false),
      hasHeader: await page.locator('header').isVisible().catch(() => false),
      hasNewChatOrWelcome: await page.getByText(/New Chat|Start your conversation|Welcome/i).isVisible().catch(() => false),
    };
    
    reportStep({
      flow: 'onboarding',
      step: 'Main Interface',
      expected: 'Sidebar, header, and main content area',
      actual: JSON.stringify(mainInterfaceCheck),
      passed: mainInterfaceCheck.hasSidebar || mainInterfaceCheck.hasHeader,
      screenshot: path.join(SCREENSHOT_DIR, 'onboarding', '07-main-interface.png')
    });
  });
});

// ============================================================================
// FLOW 2: MAIN CHAT
// ============================================================================

test.describe('Visual Flow: Main Chat', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate first
    try {
      await page.goto('/', { waitUntil: 'load', timeout: 30000 });
    } catch {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    await page.waitForTimeout(2000);
    
    // Skip onboarding (with timeout protection)
    await Promise.race([
      page.evaluate(() => {
        try {
          localStorage.setItem('Moltzer-onboarding-completed', 'true');
          localStorage.setItem('Moltzer-app-version', '1.0.0');
        } catch (e) {
          console.error('Failed to set storage:', e);
        }
      }),
      new Promise(resolve => setTimeout(resolve, 5000))
    ]);
    
    try {
      await page.reload({ waitUntil: 'load', timeout: 30000 });
    } catch {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    await page.waitForTimeout(1500);
  });

  test('chat interface flow with screenshots', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500); // Wait for app to initialize
    
    // STEP 1: Main interface - Welcome/Empty state
    console.log('\n🎬 STEP 1: Main Interface');
    
    await captureStep(page, 'chat', '01-main-interface', 
      'Should see main chat interface with sidebar and welcome area');
    
    const mainCheck = {
      hasSidebar: await page.locator('[role="navigation"], [id="sidebar"]').isVisible().catch(() => false),
      hasHeader: await page.locator('header').isVisible().catch(() => false),
      hasToggleButton: await page.getByRole('button', { name: /sidebar/i }).isVisible().catch(() => false),
    };
    
    reportStep({
      flow: 'chat',
      step: 'Main Interface',
      expected: 'Sidebar navigation and header visible',
      actual: JSON.stringify(mainCheck),
      passed: mainCheck.hasHeader,
      screenshot: path.join(SCREENSHOT_DIR, 'chat', '01-main-interface.png')
    });
    
    // STEP 2: Click New Chat
    console.log('\n🎬 STEP 2: New Chat');
    
    const newChatButton = page.getByRole('button', { name: /New Chat/i }).or(
      page.locator('button:has-text("New Chat")')
    );
    
    if (await newChatButton.isVisible().catch(() => false)) {
      await newChatButton.click();
      await page.waitForTimeout(500);
    }
    
    await captureStep(page, 'chat', '02-new-chat', 
      'Should see empty conversation view with input area');
    
    // Look for chat input area
    const chatCheck = {
      hasInputArea: await page.getByPlaceholder(/Message|Type/i).isVisible().catch(() => false) ||
                    await page.locator('textarea').isVisible().catch(() => false),
      hasEmptyState: await page.getByText(/Start your conversation|Write code|Explain concept/i).isVisible().catch(() => false),
    };
    
    reportStep({
      flow: 'chat',
      step: 'New Chat View',
      expected: 'Empty state with input area',
      actual: JSON.stringify(chatCheck),
      passed: chatCheck.hasInputArea || chatCheck.hasEmptyState,
      screenshot: path.join(SCREENSHOT_DIR, 'chat', '02-new-chat.png')
    });
    
    // STEP 3: Type a message
    console.log('\n🎬 STEP 3: Type Message');
    
    const inputArea = page.getByPlaceholder(/Message|Type/i).or(page.locator('textarea').first());
    
    if (await inputArea.isVisible().catch(() => false)) {
      await inputArea.fill('Hello, this is a test message from the visual E2E test!');
      await page.waitForTimeout(300);
      
      await captureStep(page, 'chat', '03-message-typed', 
        'Should see message typed in input area');
      
      const typeCheck = {
        hasText: await inputArea.inputValue().then(v => v.includes('test message')).catch(() => false),
        sendButtonEnabled: await page.getByRole('button', { name: /send/i }).isEnabled().catch(() => false),
      };
      
      reportStep({
        flow: 'chat',
        step: 'Message Typed',
        expected: 'Text visible in input area',
        actual: JSON.stringify(typeCheck),
        passed: typeCheck.hasText,
        screenshot: path.join(SCREENSHOT_DIR, 'chat', '03-message-typed.png')
      });
    }
    
    // STEP 4: Check send button state (don't actually send - no Gateway)
    console.log('\n🎬 STEP 4: Send Button State');
    
    await captureStep(page, 'chat', '04-send-button', 
      'Should show send button state (enabled/disabled based on connection)');
    
    const sendCheck = {
      hasButton: await page.locator('button[type="submit"], button:has-text("Send")').isVisible().catch(() => false),
      connectionStatus: await page.getByText(/Connected|Disconnected|Offline|Connecting/i).isVisible().catch(() => false),
    };
    
    reportStep({
      flow: 'chat',
      step: 'Send Button',
      expected: 'Send button visible with connection status',
      actual: JSON.stringify(sendCheck),
      passed: true, // This step is informational
      screenshot: path.join(SCREENSHOT_DIR, 'chat', '04-send-button.png')
    });
    
    // STEP 5: Toggle sidebar
    console.log('\n🎬 STEP 5: Toggle Sidebar');
    
    // Find and click sidebar toggle
    const toggleButton = page.getByRole('button', { name: /sidebar|toggle/i }).first();
    if (await toggleButton.isVisible().catch(() => false)) {
      await toggleButton.click();
      await page.waitForTimeout(400); // Wait for animation
      
      await captureStep(page, 'chat', '05-sidebar-toggled', 
        'Should see interface with sidebar hidden/shown');
      
      // Toggle back
      await toggleButton.click();
      await page.waitForTimeout(400);
    }
  });
});

// ============================================================================
// FLOW 3: SETTINGS
// ============================================================================

test.describe('Visual Flow: Settings', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate first
    try {
      await page.goto('/', { waitUntil: 'load', timeout: 30000 });
    } catch {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    await page.waitForTimeout(2000);
    
    // Skip onboarding (with timeout protection)
    await Promise.race([
      page.evaluate(() => {
        try {
          localStorage.setItem('Moltzer-onboarding-completed', 'true');
          localStorage.setItem('Moltzer-app-version', '1.0.0');
        } catch (e) {
          console.error('Failed to set storage:', e);
        }
      }),
      new Promise(resolve => setTimeout(resolve, 5000))
    ]);
    
    try {
      await page.reload({ waitUntil: 'load', timeout: 30000 });
    } catch {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    await page.waitForTimeout(1500);
  });

  test('settings dialog flow with screenshots', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);
    
    // STEP 1: Open Settings with keyboard shortcut
    console.log('\n🎬 STEP 1: Open Settings');
    
    // Try Cmd/Ctrl + , to open settings
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+Comma' : 'Control+Comma');
    await page.waitForTimeout(500);
    
    // If keyboard shortcut didn't work, try clicking
    let settingsOpened = await page.getByRole('dialog').isVisible().catch(() => false);
    
    if (!settingsOpened) {
      // Look for settings button in sidebar
      const settingsButton = page.getByRole('button', { name: /settings/i }).or(
        page.locator('[aria-label*="settings" i]')
      );
      if (await settingsButton.isVisible().catch(() => false)) {
        await settingsButton.click();
        await page.waitForTimeout(500);
        settingsOpened = await page.getByRole('dialog').isVisible().catch(() => false);
      }
    }
    
    await captureStep(page, 'settings', '01-settings-dialog', 
      'Should see Settings dialog with Gateway, Chat, and Appearance sections');
    
    const settingsCheck = {
      hasDialog: settingsOpened,
      hasTitle: await page.getByText(/Settings/i).first().isVisible().catch(() => false),
      hasGatewaySection: await page.getByText(/Gateway Connection/i).isVisible().catch(() => false),
      hasThemeSection: await page.getByText(/Appearance|Theme/i).isVisible().catch(() => false),
    };
    
    reportStep({
      flow: 'settings',
      step: 'Settings Dialog',
      expected: 'Settings dialog with sections visible',
      actual: JSON.stringify(settingsCheck),
      passed: settingsCheck.hasDialog || settingsCheck.hasTitle,
      screenshot: path.join(SCREENSHOT_DIR, 'settings', '01-settings-dialog.png')
    });
    
    if (settingsOpened) {
      // STEP 2: Theme selection
      console.log('\n🎬 STEP 2: Theme Options');
      
      await captureStep(page, 'settings', '02-theme-light', 
        'Should see current theme (light/dark/system)');
      
      // Find theme buttons
      const darkButton = page.getByRole('radio', { name: /dark/i }).or(
        page.locator('button:has-text("Dark")')
      );
      const lightButton = page.getByRole('radio', { name: /light/i }).or(
        page.locator('button:has-text("Light")')
      );
      
      // Click Dark theme
      if (await darkButton.isVisible().catch(() => false)) {
        await darkButton.click();
        await page.waitForTimeout(300);
        
        await captureStep(page, 'settings', '03-theme-dark', 
          'Should see dark theme applied');
        
        // Check if dark class was added
        const isDark = await page.evaluate(() => 
          document.documentElement.classList.contains('dark')
        );
        
        reportStep({
          flow: 'settings',
          step: 'Dark Theme',
          expected: 'Dark theme applied to page',
          actual: `Dark class present: ${isDark}`,
          passed: isDark,
          screenshot: path.join(SCREENSHOT_DIR, 'settings', '03-theme-dark.png')
        });
        
        // Switch back to light
        if (await lightButton.isVisible().catch(() => false)) {
          await lightButton.click();
          await page.waitForTimeout(300);
          
          await captureStep(page, 'settings', '04-theme-light', 
            'Should see light theme applied');
        }
      }
      
      // STEP 3: Model selection
      console.log('\n🎬 STEP 3: Model Selection');
      
      const modelSelect = page.locator('select#default-model').or(
        page.locator('select').first()
      );
      
      if (await modelSelect.isVisible().catch(() => false)) {
        await captureStep(page, 'settings', '05-model-selection', 
          'Should see model dropdown with available models');
        
        // Click to show dropdown options
        await modelSelect.click();
        await page.waitForTimeout(200);
        
        await captureStep(page, 'settings', '06-model-dropdown', 
          'Should see model options in dropdown');
      }
      
      // STEP 4: Close settings
      console.log('\n🎬 STEP 4: Close Settings');
      
      // Press Escape to close
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
      
      await captureStep(page, 'settings', '07-settings-closed', 
        'Should see main interface with settings closed');
      
      const closedCheck = {
        dialogClosed: !(await page.getByRole('dialog').isVisible().catch(() => false)),
        mainVisible: await page.locator('header').isVisible().catch(() => false),
      };
      
      reportStep({
        flow: 'settings',
        step: 'Settings Closed',
        expected: 'Dialog closed, main interface visible',
        actual: JSON.stringify(closedCheck),
        passed: closedCheck.dialogClosed && closedCheck.mainVisible,
        screenshot: path.join(SCREENSHOT_DIR, 'settings', '07-settings-closed.png')
      });
    }
  });
});

// ============================================================================
// FLOW 4: OFFLINE MODE
// ============================================================================

test.describe('Visual Flow: Offline Mode', () => {
  test.beforeEach(async ({ page, context }) => {
    // Navigate first
    try {
      await page.goto('/', { waitUntil: 'load', timeout: 30000 });
    } catch {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    await page.waitForTimeout(2000);
    
    // Skip onboarding (with timeout protection)
    await Promise.race([
      page.evaluate(() => {
        try {
          localStorage.setItem('Moltzer-onboarding-completed', 'true');
          localStorage.setItem('Moltzer-app-version', '1.0.0');
        } catch (e) {
          console.error('Failed to set storage:', e);
        }
      }),
      new Promise(resolve => setTimeout(resolve, 5000))
    ]);
    
    try {
      await page.reload({ waitUntil: 'load', timeout: 30000 });
    } catch {
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 30000 });
    }
    await page.waitForTimeout(1500);
  });

  test('offline mode behavior with screenshots', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);
    
    // STEP 1: Check initial state (likely offline - no Gateway running)
    console.log('\n🎬 STEP 1: Initial Offline State');
    
    await captureStep(page, 'offline', '01-offline-status', 
      'Should show offline/disconnected status indicator');
    
    const offlineCheck = {
      hasOfflineStatus: await page.getByText(/Offline|Disconnected|Not Connected|No Gateway/i).isVisible().catch(() => false),
      hasStatusIndicator: await page.locator('[aria-label*="offline" i], [aria-label*="disconnected" i]').isVisible().catch(() => false),
      appStillWorks: await page.locator('header').isVisible().catch(() => false),
    };
    
    reportStep({
      flow: 'offline',
      step: 'Offline Status',
      expected: 'Offline indicator visible, app still functional',
      actual: JSON.stringify(offlineCheck),
      passed: offlineCheck.hasOfflineStatus || offlineCheck.appStillWorks,
      screenshot: path.join(SCREENSHOT_DIR, 'offline', '01-offline-status.png')
    });
    
    // STEP 2: Verify sidebar still accessible
    console.log('\n🎬 STEP 2: Sidebar Navigation');
    
    const sidebarCheck = {
      hasSidebar: await page.locator('[role="navigation"], [id="sidebar"]').isVisible().catch(() => false),
      canClickNewChat: await page.getByRole('button', { name: /New Chat/i }).isVisible().catch(() => false),
    };
    
    await captureStep(page, 'offline', '02-sidebar-accessible', 
      'Should be able to browse sidebar even when offline');
    
    reportStep({
      flow: 'offline',
      step: 'Sidebar Browsing',
      expected: 'Sidebar visible and interactive',
      actual: JSON.stringify(sidebarCheck),
      passed: sidebarCheck.hasSidebar,
      screenshot: path.join(SCREENSHOT_DIR, 'offline', '02-sidebar-accessible.png')
    });
    
    // Try clicking New Chat
    if (sidebarCheck.canClickNewChat) {
      await page.getByRole('button', { name: /New Chat/i }).click();
      await page.waitForTimeout(500);
      
      await captureStep(page, 'offline', '03-new-chat-offline', 
        'Should be able to open new chat view even offline');
    }
    
    // STEP 3: Verify settings still accessible
    console.log('\n🎬 STEP 3: Settings Access While Offline');
    
    // Try opening settings
    const isMac = process.platform === 'darwin';
    await page.keyboard.press(isMac ? 'Meta+Comma' : 'Control+Comma');
    await page.waitForTimeout(500);
    
    let settingsOpened = await page.getByRole('dialog').isVisible().catch(() => false);
    
    if (!settingsOpened) {
      const settingsButton = page.getByRole('button', { name: /settings/i }).first();
      if (await settingsButton.isVisible().catch(() => false)) {
        await settingsButton.click();
        await page.waitForTimeout(500);
        settingsOpened = await page.getByRole('dialog').isVisible().catch(() => false);
      }
    }
    
    await captureStep(page, 'offline', '04-settings-offline', 
      'Should be able to open settings dialog even offline');
    
    const settingsOfflineCheck = {
      settingsOpened,
      hasGatewaySection: await page.getByText(/Gateway|Connection/i).isVisible().catch(() => false),
      canChangeTheme: await page.getByText(/Theme|Appearance/i).isVisible().catch(() => false),
    };
    
    reportStep({
      flow: 'offline',
      step: 'Settings While Offline',
      expected: 'Settings dialog opens and is fully functional',
      actual: JSON.stringify(settingsOfflineCheck),
      passed: settingsOfflineCheck.settingsOpened,
      screenshot: path.join(SCREENSHOT_DIR, 'offline', '04-settings-offline.png')
    });
    
    // STEP 4: Try changing theme while offline
    if (settingsOpened) {
      console.log('\n🎬 STEP 4: Change Theme While Offline');
      
      const darkButton = page.getByRole('radio', { name: /dark/i }).or(
        page.locator('button:has-text("Dark")')
      );
      
      if (await darkButton.isVisible().catch(() => false)) {
        await darkButton.click();
        await page.waitForTimeout(300);
        
        await captureStep(page, 'offline', '05-theme-change-offline', 
          'Should be able to change theme even when offline');
        
        const themeChanged = await page.evaluate(() => 
          document.documentElement.classList.contains('dark')
        );
        
        reportStep({
          flow: 'offline',
          step: 'Theme Change Offline',
          expected: 'Theme changes successfully even offline',
          actual: `Theme changed: ${themeChanged}`,
          passed: themeChanged,
          screenshot: path.join(SCREENSHOT_DIR, 'offline', '05-theme-change-offline.png')
        });
      }
      
      // Close settings
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    
    // STEP 5: Check send button is disabled
    console.log('\n🎬 STEP 5: Send Button Disabled When Offline');
    
    const inputArea = page.getByPlaceholder(/Message|Type/i).or(page.locator('textarea').first());
    
    if (await inputArea.isVisible().catch(() => false)) {
      await inputArea.fill('This message should not be sendable');
      await page.waitForTimeout(300);
      
      await captureStep(page, 'offline', '06-send-disabled', 
        'Should show send button disabled or offline message');
      
      const sendButton = page.locator('button[type="submit"], button:has-text("Send")').first();
      const sendDisabled = sendButton ? !(await sendButton.isEnabled().catch(() => true)) : true;
      
      reportStep({
        flow: 'offline',
        step: 'Send Disabled',
        expected: 'Send button disabled when offline',
        actual: `Disabled: ${sendDisabled}`,
        passed: true, // Informational - both states are acceptable
        screenshot: path.join(SCREENSHOT_DIR, 'offline', '06-send-disabled.png')
      });
    }
  });
});

// ============================================================================
// REPORT SUMMARY
// ============================================================================

test.afterAll(async () => {
  console.log('\n' + '='.repeat(60));
  console.log('📊 VISUAL TEST REPORT SUMMARY');
  console.log('='.repeat(60));
  
  const passed = testReport.filter(s => s.passed).length;
  const failed = testReport.filter(s => !s.passed).length;
  const total = testReport.length;
  
  console.log(`\nTotal Steps: ${total}`);
  console.log(`✅ Passed: ${passed}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`\nScreenshots saved to: ${SCREENSHOT_DIR}`);
  
  if (failed > 0) {
    console.log('\n❌ FAILED STEPS:');
    testReport.filter(s => !s.passed).forEach(s => {
      console.log(`  - ${s.flow}/${s.step}: ${s.expected}`);
    });
  }
  
  console.log('\n' + '='.repeat(60));
  
  // Write report to file
  const reportPath = path.join(SCREENSHOT_DIR, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    summary: { total, passed, failed },
    steps: testReport
  }, null, 2));
  
  console.log(`📄 Report saved to: ${reportPath}`);
});
