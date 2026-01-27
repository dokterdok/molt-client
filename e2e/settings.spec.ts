import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Settings
 * Tests settings functionality and persistence
 */

test.describe('Settings Dialog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Skip onboarding if present
    const skipButton = page.getByRole('button', { name: /skip|get started/i });
    if (await skipButton.isVisible({ timeout: 2000 })) {
      await skipButton.click();
    }
  });

  test('should open settings dialog', async ({ page }) => {
    // Look for settings button
    const settingsButton = page.getByRole('button', { name: /settings/i });
    
    if (await settingsButton.isVisible({ timeout: 5000 })) {
      await settingsButton.click();
      
      // Settings dialog should appear
      await expect(page.getByText('Settings')).toBeVisible();
    }
  });

  test('should close settings with Cancel button', async ({ page }) => {
    const settingsButton = page.getByRole('button', { name: /settings/i });
    
    if (await settingsButton.isVisible({ timeout: 5000 })) {
      await settingsButton.click();
      
      const cancelButton = page.getByRole('button', { name: /cancel/i });
      await cancelButton.click();
      
      // Dialog should close
      await expect(page.getByText('Settings')).not.toBeVisible();
    }
  });

  test('should close settings with Escape key', async ({ page }) => {
    const settingsButton = page.getByRole('button', { name: /settings/i });
    
    if (await settingsButton.isVisible({ timeout: 5000 })) {
      await settingsButton.click();
      
      await page.keyboard.press('Escape');
      
      // Dialog should close
      await expect(page.getByText('Settings')).not.toBeVisible({ timeout: 2000 });
    }
  });

  test('should update Gateway URL', async ({ page }) => {
    const settingsButton = page.getByRole('button', { name: /settings/i });
    
    if (await settingsButton.isVisible({ timeout: 5000 })) {
      await settingsButton.click();
      
      const urlInput = page.getByLabel('Gateway URL');
      await urlInput.clear();
      await urlInput.fill('ws://custom-gateway:8080');
      
      const saveButton = page.getByRole('button', { name: /save/i });
      await saveButton.click();
      
      // Dialog should close
      await expect(page.getByText('Settings')).not.toBeVisible({ timeout: 2000 });
    }
  });

  test('should persist settings changes', async ({ page }) => {
    const settingsButton = page.getByRole('button', { name: /settings/i });
    
    if (await settingsButton.isVisible({ timeout: 5000 })) {
      await settingsButton.click();
      
      // Change theme to dark
      const darkButton = page.getByRole('button', { name: /dark/i }).first();
      await darkButton.click();
      
      const saveButton = page.getByRole('button', { name: /save/i });
      await saveButton.click();
      
      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Should have dark theme applied
      const html = page.locator('html');
      await expect(html).toHaveClass(/dark/);
    }
  });

  test('should validate Gateway URL format', async ({ page }) => {
    const settingsButton = page.getByRole('button', { name: /settings/i });
    
    if (await settingsButton.isVisible({ timeout: 5000 })) {
      await settingsButton.click();
      
      const urlInput = page.getByLabel('Gateway URL');
      await urlInput.clear();
      await urlInput.fill('invalid-url');
      
      const saveButton = page.getByRole('button', { name: /save/i });
      await saveButton.click();
      
      // Should show validation error
      await expect(page.getByText(/URL must start with ws:\/\/ or wss:\/\//i)).toBeVisible();
      
      // Dialog should not close
      await expect(page.getByText('Settings')).toBeVisible();
    }
  });

  test('should toggle token visibility', async ({ page }) => {
    const settingsButton = page.getByRole('button', { name: /settings/i });
    
    if (await settingsButton.isVisible({ timeout: 5000 })) {
      await settingsButton.click();
      
      const tokenInput = page.getByPlaceholderText(/Stored securely/i);
      
      // Should be password type initially
      await expect(tokenInput).toHaveAttribute('type', 'password');
      
      // Click show button
      const showButton = page.getByLabelText(/Show token/i);
      await showButton.click();
      
      // Should change to text type
      await expect(tokenInput).toHaveAttribute('type', 'text');
      
      // Click hide button
      const hideButton = page.getByLabelText(/Hide token/i);
      await hideButton.click();
      
      // Should change back to password
      await expect(tokenInput).toHaveAttribute('type', 'password');
    }
  });

  test('should change default model', async ({ page }) => {
    const settingsButton = page.getByRole('button', { name: /settings/i });
    
    if (await settingsButton.isVisible({ timeout: 5000 })) {
      await settingsButton.click();
      
      const modelSelect = page.getByLabel('Default Model');
      await modelSelect.selectOption({ index: 1 });
      
      const saveButton = page.getByRole('button', { name: /save/i });
      await saveButton.click();
      
      // Reopen settings
      await page.waitForTimeout(500);
      await settingsButton.click();
      
      // Selection should be persisted
      const selectedValue = await modelSelect.inputValue();
      expect(selectedValue).toBeTruthy();
    }
  });

  test('should toggle thinking default', async ({ page }) => {
    const settingsButton = page.getByRole('button', { name: /settings/i });
    
    if (await settingsButton.isVisible({ timeout: 5000 })) {
      await settingsButton.click();
      
      const thinkingSwitch = page.getByRole('switch');
      const initialState = await thinkingSwitch.isChecked();
      
      await thinkingSwitch.click();
      
      const saveButton = page.getByRole('button', { name: /save/i });
      await saveButton.click();
      
      // Reopen settings
      await page.waitForTimeout(500);
      await settingsButton.click();
      
      // State should be toggled
      const newState = await thinkingSwitch.isChecked();
      expect(newState).not.toBe(initialState);
    }
  });

  test('should apply theme change immediately', async ({ page }) => {
    const settingsButton = page.getByRole('button', { name: /settings/i });
    
    if (await settingsButton.isVisible({ timeout: 5000 })) {
      await settingsButton.click();
      
      // Select dark theme
      const darkButton = page.getByRole('button', { name: /dark/i }).first();
      await darkButton.click();
      
      // Theme should apply immediately (without saving)
      const html = page.locator('html');
      await expect(html).toHaveClass(/dark/);
      
      // Select light theme
      const lightButton = page.getByRole('button', { name: /light/i }).first();
      await lightButton.click();
      
      // Should remove dark class
      await expect(html).not.toHaveClass(/dark/);
    }
  });
});

test.describe('Settings Persistence', () => {
  test('should persist Gateway URL across sessions', async ({ page, context }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const settingsButton = page.getByRole('button', { name: /settings/i });
    
    if (await settingsButton.isVisible({ timeout: 5000 })) {
      await settingsButton.click();
      
      const uniqueUrl = `ws://test-${Date.now()}:18789`;
      const urlInput = page.getByLabel('Gateway URL');
      await urlInput.clear();
      await urlInput.fill(uniqueUrl);
      
      const saveButton = page.getByRole('button', { name: /save/i });
      await saveButton.click();
      
      // Close and reopen browser
      await page.close();
      const newPage = await context.newPage();
      await newPage.goto('/');
      await newPage.waitForLoadState('networkidle');
      
      // Open settings again
      const newSettingsButton = newPage.getByRole('button', { name: /settings/i });
      if (await newSettingsButton.isVisible({ timeout: 5000 })) {
        await newSettingsButton.click();
        
        const urlInput = newPage.getByLabel('Gateway URL');
        await expect(urlInput).toHaveValue(uniqueUrl);
      }
    }
  });

  test('should persist theme preference', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const settingsButton = page.getByRole('button', { name: /settings/i });
    
    if (await settingsButton.isVisible({ timeout: 5000 })) {
      await settingsButton.click();
      
      const darkButton = page.getByRole('button', { name: /dark/i }).first();
      await darkButton.click();
      
      const saveButton = page.getByRole('button', { name: /save/i });
      await saveButton.click();
      
      // Reload
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Dark theme should still be applied
      const html = page.locator('html');
      await expect(html).toHaveClass(/dark/);
    }
  });
});

test.describe('Settings Accessibility', () => {
  test('should have proper labels for all inputs', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const settingsButton = page.getByRole('button', { name: /settings/i });
    
    if (await settingsButton.isVisible({ timeout: 5000 })) {
      await settingsButton.click();
      
      await expect(page.getByLabel('Gateway URL')).toBeVisible();
      await expect(page.getByLabel(/Authentication Token/i)).toBeVisible();
      await expect(page.getByLabel('Default Model')).toBeVisible();
    }
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const settingsButton = page.getByRole('button', { name: /settings/i });
    
    if (await settingsButton.isVisible({ timeout: 5000 })) {
      await settingsButton.click();
      
      // Tab through elements
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      
      // Should be able to navigate
      const focused = await page.evaluate(() => document.activeElement?.tagName);
      expect(['INPUT', 'BUTTON', 'SELECT']).toContain(focused);
    }
  });
});
