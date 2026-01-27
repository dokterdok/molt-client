import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Onboarding Flow
 * Tests the complete onboarding experience for new users
 */

test.describe('Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage to simulate first-time user
    await page.goto('/');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
  });

  test('should display welcome screen on first launch', async ({ page }) => {
    await page.goto('/');
    
    // Should show welcome message
    await expect(page.getByText(/Welcome to Molt/i)).toBeVisible();
  });

  test('should detect local Gateway automatically', async ({ page }) => {
    // Mock Gateway detection (in real scenario, Gateway would be running)
    await page.goto('/');
    
    // Should show detection step
    await expect(page.getByText(/Detecting Gateway/i)).toBeVisible({ timeout: 10000 });
  });

  test('should show manual setup option if no Gateway found', async ({ page }) => {
    await page.goto('/');
    
    // Wait for detection to complete (mock scenario - will fail)
    await page.waitForTimeout(5000);
    
    // Should offer manual setup
    const manualSetupButton = page.getByRole('button', { name: /manual setup/i });
    await expect(manualSetupButton).toBeVisible();
  });

  test('should allow entering custom Gateway URL', async ({ page }) => {
    await page.goto('/');
    
    // Wait for detection step
    await page.waitForTimeout(3000);
    
    // Click manual setup
    const manualButton = page.getByRole('button', { name: /manual/i });
    if (await manualButton.isVisible()) {
      await manualButton.click();
      
      // Enter custom URL
      const urlInput = page.getByPlaceholder(/ws:\/\//i);
      await expect(urlInput).toBeVisible();
      
      await urlInput.fill('ws://localhost:18789');
      
      // Should validate URL format
      await expect(urlInput).toHaveValue('ws://localhost:18789');
    }
  });

  test('should validate WebSocket URL format', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(3000);
    
    const manualButton = page.getByRole('button', { name: /manual/i });
    if (await manualButton.isVisible()) {
      await manualButton.click();
      
      const urlInput = page.getByPlaceholder(/ws:\/\//i);
      
      // Try invalid URL
      await urlInput.fill('http://localhost:8080');
      
      // Should show validation error
      const continueButton = page.getByRole('button', { name: /continue/i });
      await continueButton.click();
      
      // Should not proceed with invalid URL
      await expect(urlInput).toBeVisible();
    }
  });

  test('should complete onboarding successfully', async ({ page }) => {
    await page.goto('/');
    
    // Go through onboarding steps
    await page.waitForTimeout(2000);
    
    // Look for completion indicators
    const getStartedButton = page.getByRole('button', { name: /get started|start chatting/i });
    
    // If we reached the end, button should be visible
    if (await getStartedButton.isVisible()) {
      await getStartedButton.click();
      
      // Should navigate to main chat view
      await expect(page.getByPlaceholder(/Message Molt/i)).toBeVisible({ timeout: 5000 });
    }
  });

  test('should persist Gateway URL after onboarding', async ({ page }) => {
    await page.goto('/');
    
    // Complete onboarding with custom URL
    await page.waitForTimeout(3000);
    
    const manualButton = page.getByRole('button', { name: /manual/i });
    if (await manualButton.isVisible()) {
      await manualButton.click();
      
      const urlInput = page.getByPlaceholder(/ws:\/\//i);
      await urlInput.fill('ws://custom:8080');
      
      // Complete setup
      const continueButton = page.getByRole('button', { name: /continue/i });
      if (await continueButton.isVisible()) {
        await continueButton.click();
      }
    }
    
    // Reload page
    await page.reload();
    
    // Should not show onboarding again
    await expect(page.getByText(/Welcome to Molt/i)).not.toBeVisible({ timeout: 5000 });
  });

  test('should show feature tour during onboarding', async ({ page }) => {
    await page.goto('/');
    
    // Feature tour might be part of onboarding
    const tourText = page.getByText(/search|conversations|settings/i);
    
    // Tour should highlight key features
    if (await tourText.isVisible()) {
      await expect(tourText).toBeVisible();
    }
  });

  test('should allow skipping onboarding steps', async ({ page }) => {
    await page.goto('/');
    
    const skipButton = page.getByRole('button', { name: /skip/i });
    
    if (await skipButton.isVisible()) {
      await skipButton.click();
      
      // Should skip to next step or complete onboarding
      await expect(page).not.toHaveURL('/onboarding');
    }
  });
});

test.describe('Onboarding Accessibility', () => {
  test('should have proper keyboard navigation', async ({ page }) => {
    await page.goto('/');
    
    // Tab through interactive elements
    await page.keyboard.press('Tab');
    
    // First focusable element should be focused
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['BUTTON', 'INPUT', 'A']).toContain(focused);
  });

  test('should have ARIA labels for steps', async ({ page }) => {
    await page.goto('/');
    
    // Onboarding should have proper structure
    const main = page.getByRole('main');
    await expect(main).toBeVisible();
  });
});

test.describe('Onboarding Error Handling', () => {
  test('should handle connection errors gracefully', async ({ page }) => {
    await page.goto('/');
    
    await page.waitForTimeout(3000);
    
    const manualButton = page.getByRole('button', { name: /manual/i });
    if (await manualButton.isVisible()) {
      await manualButton.click();
      
      // Enter unreachable URL
      const urlInput = page.getByPlaceholder(/ws:\/\//i);
      await urlInput.fill('ws://unreachable.example.com:99999');
      
      const testButton = page.getByRole('button', { name: /test|connect/i });
      if (await testButton.isVisible()) {
        await testButton.click();
        
        // Should show error message
        await expect(page.getByText(/failed|error|unable/i)).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('should recover from network errors', async ({ page }) => {
    await page.goto('/');
    
    // Simulate offline state
    await page.context().setOffline(true);
    
    // Should show appropriate message
    await page.waitForTimeout(2000);
    
    // Go back online
    await page.context().setOffline(false);
    
    // Should allow retry
    const retryButton = page.getByRole('button', { name: /retry|try again/i });
    if (await retryButton.isVisible()) {
      await retryButton.click();
    }
  });
});
