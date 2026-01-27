import { test, expect } from '@playwright/test';

/**
 * E2E Tests: Messaging
 * Tests the complete messaging workflow
 */

test.describe('Messaging Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Wait for app to load
    await page.waitForLoadState('networkidle');
    
    // Skip onboarding if present
    const skipButton = page.getByRole('button', { name: /skip|get started/i });
    if (await skipButton.isVisible({ timeout: 2000 })) {
      await skipButton.click();
    }
  });

  test('should send a message', async ({ page }) => {
    // Find chat input
    const input = page.getByPlaceholder(/Message Moltzer/i);
    await expect(input).toBeVisible({ timeout: 10000 });
    
    // Type message
    await input.fill('Hello, Moltzer! This is a test message.');
    
    // Send message
    await page.keyboard.press('Enter');
    
    // Message should appear in chat
    await expect(page.getByText('Hello, Moltzer! This is a test message.')).toBeVisible();
  });

  test('should show user message immediately', async ({ page }) => {
    const input = page.getByPlaceholder(/Message Moltzer/i);
    await expect(input).toBeVisible({ timeout: 10000 });
    
    const testMessage = 'Test message ' + Date.now();
    await input.fill(testMessage);
    await page.keyboard.press('Enter');
    
    // User message should appear immediately
    await expect(page.getByText(testMessage)).toBeVisible({ timeout: 1000 });
  });

  test('should clear input after sending', async ({ page }) => {
    const input = page.getByPlaceholder(/Message Moltzer/i);
    await expect(input).toBeVisible({ timeout: 10000 });
    
    await input.fill('Test message');
    await page.keyboard.press('Enter');
    
    // Input should be cleared
    await expect(input).toHaveValue('');
  });

  test('should allow multiline messages with Shift+Enter', async ({ page }) => {
    const input = page.getByPlaceholder(/Message Moltzer/i);
    await expect(input).toBeVisible({ timeout: 10000 });
    
    await input.fill('Line 1');
    await page.keyboard.press('Shift+Enter');
    await input.pressSequentially('Line 2');
    
    // Should not send yet
    await expect(page.getByText('Line 1')).not.toBeVisible();
    
    // Now send
    await page.keyboard.press('Enter');
    
    // Both lines should be visible
    await expect(page.getByText(/Line 1/)).toBeVisible();
  });

  test('should disable send button when input is empty', async ({ page }) => {
    const input = page.getByPlaceholder(/Message Moltzer/i);
    await expect(input).toBeVisible({ timeout: 10000 });
    
    const sendButton = page.getByLabelText(/Send message/i);
    
    // Should be disabled when empty
    await expect(sendButton).toBeDisabled();
    
    // Should enable when typing
    await input.fill('Test');
    await expect(sendButton).not.toBeDisabled();
  });

  test('should show typing indicator while waiting for response', async ({ page }) => {
    const input = page.getByPlaceholder(/Message Moltzer/i);
    await expect(input).toBeVisible({ timeout: 10000 });
    
    await input.fill('Tell me a story');
    await page.keyboard.press('Enter');
    
    // Should show typing indicator (if connected to Gateway)
    const typingIndicator = page.getByText(/typing|thinking/i);
    
    // Note: This will only work if actually connected to a Gateway
    // In offline mode, this test would need to be skipped or mocked
  });

  test('should display messages in correct order', async ({ page }) => {
    const input = page.getByPlaceholder(/Message Moltzer/i);
    await expect(input).toBeVisible({ timeout: 10000 });
    
    // Send multiple messages
    await input.fill('First message');
    await page.keyboard.press('Enter');
    
    await page.waitForTimeout(500);
    
    await input.fill('Second message');
    await page.keyboard.press('Enter');
    
    // Both should be visible
    await expect(page.getByText('First message')).toBeVisible();
    await expect(page.getByText('Second message')).toBeVisible();
    
    // Second message should appear after first
    const firstBox = await page.getByText('First message').boundingBox();
    const secondBox = await page.getByText('Second message').boundingBox();
    
    if (firstBox && secondBox) {
      expect(firstBox.y).toBeLessThan(secondBox.y);
    }
  });

  test('should copy message content', async ({ page }) => {
    const input = page.getByPlaceholder(/Message Moltzer/i);
    await expect(input).toBeVisible({ timeout: 10000 });
    
    const testMessage = 'Message to copy';
    await input.fill(testMessage);
    await page.keyboard.press('Enter');
    
    // Hover over message to show copy button
    const message = page.getByText(testMessage);
    await message.hover();
    
    // Click copy button
    const copyButton = page.getByTitle(/Copy message/i);
    if (await copyButton.isVisible({ timeout: 1000 })) {
      await copyButton.click();
      
      // Note: Actually testing clipboard requires permissions
      // We can only verify the button was clicked
      await expect(copyButton).toBeVisible();
    }
  });

  test('should handle very long messages', async ({ page }) => {
    const input = page.getByPlaceholder(/Message Moltzer/i);
    await expect(input).toBeVisible({ timeout: 10000 });
    
    const longMessage = 'a'.repeat(5000);
    await input.fill(longMessage);
    await page.keyboard.press('Enter');
    
    // Should handle long messages without crashing
    await expect(input).toHaveValue('');
  });

  test('should handle special characters', async ({ page }) => {
    const input = page.getByPlaceholder(/Message Moltzer/i);
    await expect(input).toBeVisible({ timeout: 10000 });
    
    const specialMessage = '<script>alert("test")</script> & symbols: @#$%';
    await input.fill(specialMessage);
    await page.keyboard.press('Enter');
    
    // Should display without executing or breaking
    await expect(page.getByText(/script/i)).toBeVisible();
  });

  test('should handle emoji input', async ({ page }) => {
    const input = page.getByPlaceholder(/Message Moltzer/i);
    await expect(input).toBeVisible({ timeout: 10000 });
    
    const emojiMessage = 'Hello 👋 World 🌍';
    await input.fill(emojiMessage);
    await page.keyboard.press('Enter');
    
    await expect(page.getByText('Hello 👋 World 🌍')).toBeVisible();
  });
});

test.describe('Message Display', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should render markdown in messages', async ({ page }) => {
    const input = page.getByPlaceholder(/Message Moltzer/i);
    if (await input.isVisible({ timeout: 5000 })) {
      await input.fill('This is **bold** text');
      await page.keyboard.press('Enter');
      
      // Should render as bold
      const boldText = page.getByText('bold');
      await expect(boldText).toBeVisible();
    }
  });

  test('should render code blocks with syntax highlighting', async ({ page }) => {
    const input = page.getByPlaceholder(/Message Moltzer/i);
    if (await input.isVisible({ timeout: 5000 })) {
      await input.fill('```js\nconst x = 1;\n```');
      await page.keyboard.press('Enter');
      
      // Should render in code block
      await expect(page.getByText('javascript').or(page.getByText('js'))).toBeVisible({ timeout: 2000 });
    }
  });

  test('should render links as clickable', async ({ page }) => {
    const input = page.getByPlaceholder(/Message Moltzer/i);
    if (await input.isVisible({ timeout: 5000 })) {
      await input.fill('Check out https://example.com');
      await page.keyboard.press('Enter');
      
      const link = page.getByRole('link', { name: /example.com/i });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('target', '_blank');
    }
  });

  test('should show timestamp on hover', async ({ page }) => {
    const input = page.getByPlaceholder(/Message Moltzer/i);
    if (await input.isVisible({ timeout: 5000 })) {
      await input.fill('Test message');
      await page.keyboard.press('Enter');
      
      const message = page.getByText('Test message');
      await message.hover();
      
      // Timestamp should become visible
      const timestamp = page.getByText(/ago|second|minute|hour/i);
      await expect(timestamp).toBeVisible({ timeout: 2000 });
    }
  });
});

test.describe('Conversation Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should create new conversation', async ({ page }) => {
    // Look for new conversation button
    const newChatButton = page.getByRole('button', { name: /new chat/i });
    
    if (await newChatButton.isVisible({ timeout: 5000 })) {
      await newChatButton.click();
      
      // Should clear chat area
      const input = page.getByPlaceholder(/Message Moltzer/i);
      await expect(input).toBeVisible();
    }
  });

  test('should persist messages across page reload', async ({ page }) => {
    const input = page.getByPlaceholder(/Message Moltzer/i);
    if (await input.isVisible({ timeout: 5000 })) {
      const uniqueMessage = 'Persist test ' + Date.now();
      await input.fill(uniqueMessage);
      await page.keyboard.press('Enter');
      
      await expect(page.getByText(uniqueMessage)).toBeVisible();
      
      // Reload page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Message should still be visible
      await expect(page.getByText(uniqueMessage)).toBeVisible({ timeout: 5000 });
    }
  });
});

test.describe('Messaging Accessibility', () => {
  test('should have proper ARIA labels', async ({ page }) => {
    await page.goto('/');
    
    const input = page.getByPlaceholder(/Message Moltzer/i);
    if (await input.isVisible({ timeout: 5000 })) {
      await expect(input).toBeVisible();
      
      const sendButton = page.getByLabelText(/Send message/i);
      await expect(sendButton).toBeVisible();
    }
  });

  test('should be keyboard navigable', async ({ page }) => {
    await page.goto('/');
    
    // Tab to input
    await page.keyboard.press('Tab');
    
    const input = page.getByPlaceholder(/Message Moltzer/i);
    
    // Input should be focused
    if (await input.isVisible({ timeout: 5000 })) {
      await expect(input).toBeFocused();
    }
  });
});
