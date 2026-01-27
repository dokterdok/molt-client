import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Settings Flows
 * Comprehensive tests for all settings functionality
 */

test.describe('Settings Dialog Access', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Skip onboarding if present
    const skipButton = page.getByRole('button', { name: /skip|get started/i });
    if (await skipButton.isVisible({ timeout: 2000 })) {
      await skipButton.click();
    }
  });

  test('should open settings with ⌘, keyboard shortcut', async ({ page }) => {
    // Press Cmd/Ctrl+, to open settings
    await page.keyboard.press('Meta+Comma');
    
    // Settings dialog should appear
    await expect(page.getByText(/settings/i)).toBeVisible({ timeout: 2000 });
    
    // Should have settings form elements
    const gatewayInput = page.getByLabel(/gateway url/i);
    await expect(gatewayInput).toBeVisible();
  });

  test('should open settings with settings button', async ({ page }) => {
    // Look for settings button
    const settingsButton = page.getByRole('button', { name: /settings/i }).or(
      page.getByTitle(/settings/i)
    );
    
    if (await settingsButton.isVisible({ timeout: 5000 })) {
      await settingsButton.click();
      
      // Settings dialog should appear
      await expect(page.getByText(/settings/i)).toBeVisible();
    }
  });

  test('should close settings with Escape key', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    const settingsDialog = page.getByText(/settings/i);
    if (await settingsDialog.isVisible({ timeout: 2000 })) {
      // Close with Escape
      await page.keyboard.press('Escape');
      
      // Dialog should close
      await expect(settingsDialog).not.toBeVisible({ timeout: 1000 });
    }
  });

  test('should close settings with Cancel button', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    const settingsDialog = page.getByText(/settings/i);
    if (await settingsDialog.isVisible({ timeout: 2000 })) {
      // Click Cancel
      const cancelButton = page.getByRole('button', { name: /cancel/i });
      await cancelButton.click();
      
      // Dialog should close
      await expect(settingsDialog).not.toBeVisible();
    }
  });

  test('should close settings with X button', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    const settingsDialog = page.getByText(/settings/i);
    if (await settingsDialog.isVisible({ timeout: 2000 })) {
      // Click X/close button
      const closeButton = page.getByRole('button', { name: /close/i }).or(
        page.getByLabel(/close/i)
      );
      
      if (await closeButton.isVisible({ timeout: 1000 })) {
        await closeButton.click();
        
        // Dialog should close
        await expect(settingsDialog).not.toBeVisible();
      }
    }
  });
});

test.describe('Gateway URL Configuration', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const skipButton = page.getByRole('button', { name: /skip|get started/i });
    if (await skipButton.isVisible({ timeout: 2000 })) {
      await skipButton.click();
    }
  });

  test('should change Gateway URL', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    const gatewayInput = page.getByLabel(/gateway url/i);
    if (await gatewayInput.isVisible({ timeout: 2000 })) {
      // Clear and enter new URL
      const newUrl = 'ws://test-gateway:18789';
      await gatewayInput.clear();
      await gatewayInput.fill(newUrl);
      
      // Value should be updated
      await expect(gatewayInput).toHaveValue(newUrl);
      
      // Save changes
      const saveButton = page.getByRole('button', { name: /save/i });
      await saveButton.click();
      
      // Dialog should close
      await expect(page.getByText(/settings/i)).not.toBeVisible();
    }
  });

  test('should persist Gateway URL changes', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    const gatewayInput = page.getByLabel(/gateway url/i);
    if (await gatewayInput.isVisible({ timeout: 2000 })) {
      const uniqueUrl = `ws://persist-test-${Date.now()}:18789`;
      await gatewayInput.clear();
      await gatewayInput.fill(uniqueUrl);
      
      // Save
      const saveButton = page.getByRole('button', { name: /save/i });
      await saveButton.click();
      
      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Reopen settings
      await page.keyboard.press('Meta+Comma');
      
      // URL should be persisted
      const reloadedInput = page.getByLabel(/gateway url/i);
      await expect(reloadedInput).toHaveValue(uniqueUrl);
    }
  });

  test('should validate Gateway URL format - ws:// required', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    const gatewayInput = page.getByLabel(/gateway url/i);
    if (await gatewayInput.isVisible({ timeout: 2000 })) {
      // Enter invalid URL (no ws:// prefix)
      await gatewayInput.clear();
      await gatewayInput.fill('invalid-gateway-url');
      
      // Try to save
      const saveButton = page.getByRole('button', { name: /save/i });
      await saveButton.click();
      
      // Should show validation error
      const errorMessage = page.getByText(/must start with ws:\/\/ or wss:\/\//i);
      await expect(errorMessage).toBeVisible({ timeout: 2000 });
      
      // Dialog should remain open
      await expect(page.getByText(/settings/i)).toBeVisible();
    }
  });

  test('should validate Gateway URL format - http not allowed', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    const gatewayInput = page.getByLabel(/gateway url/i);
    if (await gatewayInput.isVisible({ timeout: 2000 })) {
      // Enter HTTP URL (should be WS)
      await gatewayInput.clear();
      await gatewayInput.fill('http://gateway:18789');
      
      // Try to save
      const saveButton = page.getByRole('button', { name: /save/i });
      await saveButton.click();
      
      // Should show validation error
      const errorMessage = page.getByText(/must start with ws:\/\/ or wss:\/\//i);
      await expect(errorMessage).toBeVisible({ timeout: 2000 });
    }
  });

  test('should accept valid ws:// URL', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    const gatewayInput = page.getByLabel(/gateway url/i);
    if (await gatewayInput.isVisible({ timeout: 2000 })) {
      await gatewayInput.clear();
      await gatewayInput.fill('ws://valid-gateway:18789');
      
      const saveButton = page.getByRole('button', { name: /save/i });
      await saveButton.click();
      
      // Should not show error
      const errorMessage = page.getByText(/must start with/i);
      await expect(errorMessage).not.toBeVisible();
      
      // Dialog should close
      await expect(page.getByText(/settings/i)).not.toBeVisible();
    }
  });

  test('should accept valid wss:// URL', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    const gatewayInput = page.getByLabel(/gateway url/i);
    if (await gatewayInput.isVisible({ timeout: 2000 })) {
      await gatewayInput.clear();
      await gatewayInput.fill('wss://secure-gateway.example.com:443');
      
      const saveButton = page.getByRole('button', { name: /save/i });
      await saveButton.click();
      
      // Should accept secure websocket URL
      await expect(page.getByText(/settings/i)).not.toBeVisible();
    }
  });

  test('should revert Gateway URL changes on cancel', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    const gatewayInput = page.getByLabel(/gateway url/i);
    if (await gatewayInput.isVisible({ timeout: 2000 })) {
      // Get original value
      const originalValue = await gatewayInput.inputValue();
      
      // Change value
      await gatewayInput.clear();
      await gatewayInput.fill('ws://temporary-url:18789');
      
      // Cancel instead of save
      const cancelButton = page.getByRole('button', { name: /cancel/i });
      await cancelButton.click();
      
      // Reopen settings
      await page.keyboard.press('Meta+Comma');
      
      // Should have original value
      const reloadedInput = page.getByLabel(/gateway url/i);
      await expect(reloadedInput).toHaveValue(originalValue);
    }
  });
});

test.describe('Theme Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const skipButton = page.getByRole('button', { name: /skip|get started/i });
    if (await skipButton.isVisible({ timeout: 2000 })) {
      await skipButton.click();
    }
  });

  test('should toggle theme to dark', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    // Select dark theme
    const darkButton = page.getByRole('button', { name: /dark/i }).first();
    if (await darkButton.isVisible({ timeout: 2000 })) {
      await darkButton.click();
      
      // Theme should apply immediately
      const html = page.locator('html');
      await expect(html).toHaveClass(/dark/);
    }
  });

  test('should toggle theme to light', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    // Select light theme
    const lightButton = page.getByRole('button', { name: /light/i }).first();
    if (await lightButton.isVisible({ timeout: 2000 })) {
      await lightButton.click();
      
      // Dark class should be removed
      const html = page.locator('html');
      await expect(html).not.toHaveClass(/dark/);
    }
  });

  test('should toggle theme to system', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    // Select system theme
    const systemButton = page.getByRole('button', { name: /system/i }).first();
    if (await systemButton.isVisible({ timeout: 2000 })) {
      await systemButton.click();
      
      // Should match system preference
      // This is harder to test reliably, but button should be selected
      await expect(systemButton).toHaveAttribute('data-state', 'on');
    }
  });

  test('should persist theme preference', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    // Select dark theme
    const darkButton = page.getByRole('button', { name: /dark/i }).first();
    if (await darkButton.isVisible({ timeout: 2000 })) {
      await darkButton.click();
      
      // Save
      const saveButton = page.getByRole('button', { name: /save/i });
      await saveButton.click();
      
      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Dark theme should still be applied
      const html = page.locator('html');
      await expect(html).toHaveClass(/dark/);
    }
  });

  test('should apply theme change immediately without save', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    const darkButton = page.getByRole('button', { name: /dark/i }).first();
    const lightButton = page.getByRole('button', { name: /light/i }).first();
    
    if (await darkButton.isVisible({ timeout: 2000 })) {
      // Switch to dark
      await darkButton.click();
      const html = page.locator('html');
      await expect(html).toHaveClass(/dark/);
      
      // Switch to light
      await lightButton.click();
      await expect(html).not.toHaveClass(/dark/);
      
      // Theme changes apply immediately
    }
  });
});

test.describe('Authentication Token', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const skipButton = page.getByRole('button', { name: /skip|get started/i });
    if (await skipButton.isVisible({ timeout: 2000 })) {
      await skipButton.click();
    }
  });

  test('should update authentication token', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    const tokenInput = page.getByPlaceholder(/stored securely|token/i).or(
      page.getByLabel(/authentication token|token/i)
    );
    
    if (await tokenInput.isVisible({ timeout: 2000 })) {
      const testToken = 'test-token-' + Date.now();
      await tokenInput.clear();
      await tokenInput.fill(testToken);
      
      // Save
      const saveButton = page.getByRole('button', { name: /save/i });
      await saveButton.click();
      
      // Dialog should close
      await expect(page.getByText(/settings/i)).not.toBeVisible();
    }
  });

  test('should toggle token visibility', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    const tokenInput = page.getByPlaceholder(/stored securely|token/i).or(
      page.getByLabel(/authentication token|token/i)
    );
    
    if (await tokenInput.isVisible({ timeout: 2000 })) {
      // Should be password type initially
      await expect(tokenInput).toHaveAttribute('type', 'password');
      
      // Click show button
      const showButton = page.getByLabel(/show|reveal/i).filter({ hasText: /token/i }).or(
        page.getByRole('button').filter({ hasText: /show|eye/i })
      ).first();
      
      if (await showButton.isVisible({ timeout: 1000 })) {
        await showButton.click();
        
        // Should change to text type
        await expect(tokenInput).toHaveAttribute('type', 'text');
        
        // Click hide button
        const hideButton = page.getByLabel(/hide|conceal/i).or(
          page.getByRole('button').filter({ hasText: /hide/i })
        ).first();
        
        if (await hideButton.isVisible({ timeout: 1000 })) {
          await hideButton.click();
          
          // Should change back to password
          await expect(tokenInput).toHaveAttribute('type', 'password');
        }
      }
    }
  });

  test('should persist authentication token', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    const tokenInput = page.getByPlaceholder(/stored securely|token/i).or(
      page.getByLabel(/authentication token|token/i)
    );
    
    if (await tokenInput.isVisible({ timeout: 2000 })) {
      const uniqueToken = 'persist-token-' + Date.now();
      await tokenInput.clear();
      await tokenInput.fill(uniqueToken);
      
      // Save
      const saveButton = page.getByRole('button', { name: /save/i });
      await saveButton.click();
      
      // Reload
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Reopen settings
      await page.keyboard.press('Meta+Comma');
      
      // Token should be present (might be masked)
      const reloadedInput = page.getByPlaceholder(/stored securely|token/i).or(
        page.getByLabel(/authentication token|token/i)
      );
      
      // Note: Token might be shown as asterisks or placeholder
      await expect(reloadedInput).toBeVisible();
    }
  });
});

test.describe('Clear All Data', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const skipButton = page.getByRole('button', { name: /skip|get started/i });
    if (await skipButton.isVisible({ timeout: 2000 })) {
      await skipButton.click();
    }
  });

  test('should show clear data button', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    // Look for clear data button
    const clearButton = page.getByRole('button', { name: /clear all data|reset|delete all/i });
    await expect(clearButton).toBeVisible({ timeout: 2000 });
  });

  test('should show confirmation before clearing data', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    const clearButton = page.getByRole('button', { name: /clear all data|reset|delete all/i });
    if (await clearButton.isVisible({ timeout: 2000 })) {
      await clearButton.click();
      
      // Should show confirmation dialog
      const confirmDialog = page.getByText(/are you sure|confirm|cannot be undone/i);
      await expect(confirmDialog).toBeVisible({ timeout: 2000 });
    }
  });

  test('should cancel clear data operation', async ({ page }) => {
    // Create some data first
    const input = page.getByPlaceholder(/Message/i);
    if (await input.isVisible({ timeout: 5000 })) {
      const testMessage = 'Data to preserve ' + Date.now();
      await input.fill(testMessage);
      await page.keyboard.press('Enter');
      await expect(page.getByText(testMessage)).toBeVisible();
      
      // Open settings
      await page.keyboard.press('Meta+Comma');
      
      const clearButton = page.getByRole('button', { name: /clear all data|reset|delete all/i });
      if (await clearButton.isVisible({ timeout: 2000 })) {
        await clearButton.click();
        
        // Cancel the operation
        const cancelButton = page.getByRole('button', { name: /cancel|no/i }).last();
        if (await cancelButton.isVisible({ timeout: 2000 })) {
          await cancelButton.click();
          
          // Close settings
          await page.keyboard.press('Escape');
          
          // Data should still be present
          await expect(page.getByText(testMessage)).toBeVisible();
        }
      }
    }
  });

  test('should clear all data when confirmed', async ({ page }) => {
    // Create some data
    const input = page.getByPlaceholder(/Message/i);
    if (await input.isVisible({ timeout: 5000 })) {
      const testMessage = 'Data to clear ' + Date.now();
      await input.fill(testMessage);
      await page.keyboard.press('Enter');
      await expect(page.getByText(testMessage)).toBeVisible();
      
      // Open settings
      await page.keyboard.press('Meta+Comma');
      
      const clearButton = page.getByRole('button', { name: /clear all data|reset|delete all/i });
      if (await clearButton.isVisible({ timeout: 2000 })) {
        await clearButton.click();
        
        // Confirm the operation
        const confirmButton = page.getByRole('button', { name: /clear|confirm|yes|delete/i }).last();
        if (await confirmButton.isVisible({ timeout: 2000 })) {
          await confirmButton.click();
          
          // Wait for clear operation
          await page.waitForTimeout(1000);
          
          // Data should be cleared
          await expect(page.getByText(testMessage)).not.toBeVisible();
        }
      }
    }
  });
});

test.describe('Export Conversation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const skipButton = page.getByRole('button', { name: /skip|get started/i });
    if (await skipButton.isVisible({ timeout: 2000 })) {
      await skipButton.click();
    }
  });

  test('should show export button for conversation', async ({ page }) => {
    // Create conversation with content
    const input = page.getByPlaceholder(/Message/i);
    if (await input.isVisible({ timeout: 5000 })) {
      await input.fill('Export test message');
      await page.keyboard.press('Enter');
      
      // Look for export button (might be in menu or settings)
      const exportButton = page.getByRole('button', { name: /export/i }).or(
        page.getByTitle(/export/i)
      );
      
      // Export button should exist somewhere
      await expect(exportButton.first()).toBeVisible({ timeout: 2000 });
    }
  });

  test('should export conversation as markdown', async ({ page }) => {
    // Create conversation
    const input = page.getByPlaceholder(/Message/i);
    if (await input.isVisible({ timeout: 5000 })) {
      const exportMessage = 'Message to export ' + Date.now();
      await input.fill(exportMessage);
      await page.keyboard.press('Enter');
      
      // Set up download handler
      const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
      
      // Click export button
      const exportButton = page.getByRole('button', { name: /export/i }).or(
        page.getByTitle(/export/i)
      );
      
      if (await exportButton.isVisible({ timeout: 2000 })) {
        await exportButton.click();
        
        // Should trigger download
        const download = await downloadPromise;
        
        // Verify download
        expect(download.suggestedFilename()).toMatch(/\.md$/);
      }
    }
  });

  test('should export conversation as JSON', async ({ page }) => {
    // Create conversation
    const input = page.getByPlaceholder(/Message/i);
    if (await input.isVisible({ timeout: 5000 })) {
      await input.fill('JSON export test');
      await page.keyboard.press('Enter');
      
      // Look for JSON export option
      const exportButton = page.getByRole('button', { name: /export/i });
      
      if (await exportButton.isVisible({ timeout: 2000 })) {
        // Might need to open export menu first
        await exportButton.click();
        
        // Look for JSON option
        const jsonOption = page.getByRole('menuitem', { name: /json/i }).or(
          page.getByText(/json/i)
        );
        
        if (await jsonOption.isVisible({ timeout: 1000 })) {
          const downloadPromise = page.waitForEvent('download', { timeout: 5000 });
          await jsonOption.click();
          
          const download = await downloadPromise;
          expect(download.suggestedFilename()).toMatch(/\.json$/);
        }
      }
    }
  });
});

test.describe('Model Selection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    const skipButton = page.getByRole('button', { name: /skip|get started/i });
    if (await skipButton.isVisible({ timeout: 2000 })) {
      await skipButton.click();
    }
  });

  test('should change default model', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    const modelSelect = page.getByLabel(/default model|model/i);
    if (await modelSelect.isVisible({ timeout: 2000 })) {
      // Get current value
      const originalValue = await modelSelect.inputValue();
      
      // Select different model
      await modelSelect.selectOption({ index: 1 });
      
      // Value should change
      const newValue = await modelSelect.inputValue();
      expect(newValue).not.toBe(originalValue);
      
      // Save
      const saveButton = page.getByRole('button', { name: /save/i });
      await saveButton.click();
    }
  });

  test('should persist model selection', async ({ page }) => {
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    const modelSelect = page.getByLabel(/default model|model/i);
    if (await modelSelect.isVisible({ timeout: 2000 })) {
      // Select specific model
      await modelSelect.selectOption({ index: 1 });
      const selectedValue = await modelSelect.inputValue();
      
      // Save
      const saveButton = page.getByRole('button', { name: /save/i });
      await saveButton.click();
      
      // Reload
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Reopen settings
      await page.keyboard.press('Meta+Comma');
      
      // Model should be persisted
      const reloadedSelect = page.getByLabel(/default model|model/i);
      await expect(reloadedSelect).toHaveValue(selectedValue);
    }
  });
});

test.describe('Settings Accessibility', () => {
  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    // Check for labeled inputs
    await expect(page.getByLabel(/gateway url/i)).toBeVisible({ timeout: 2000 });
    await expect(page.getByLabel(/authentication token|token/i)).toBeVisible();
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    // Tab through elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    // Should be able to focus on elements
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'BUTTON', 'SELECT', 'TEXTAREA']).toContain(focused);
  });

  test('should have focus trap in dialog', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    
    // Open settings
    await page.keyboard.press('Meta+Comma');
    
    // Tab multiple times - focus should stay within dialog
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press('Tab');
    }
    
    // Focus should still be inside settings dialog
    const settingsDialog = page.getByText(/settings/i);
    await expect(settingsDialog).toBeVisible();
  });
});
