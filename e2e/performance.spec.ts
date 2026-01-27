/**
 * Performance Benchmarks E2E Tests
 * 
 * These tests measure critical performance metrics to prevent regressions.
 * Run with: npm run test:e2e -- performance.spec.ts
 */

import { test, expect, Page } from '@playwright/test';

// Performance thresholds
const THRESHOLDS = {
  LOAD_TIME_MS: 2000,         // Initial page load
  INTERACTIVE_TIME_MS: 2500,  // Time to interactive
  INPUT_LATENCY_MS: 100,      // Input responsiveness
  RENDER_TIME_MS: 16,         // Single frame (60fps)
  SEARCH_TIME_MS: 500,        // Search query execution
  SCROLL_FPS: 55,             // Minimum FPS during scroll
};

test.describe('Performance Benchmarks', () => {
  test.describe.configure({ mode: 'serial' });

  test('P1: Initial page load under 2 seconds', async ({ page }) => {
    const start = performance.now();
    
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    const domContentLoaded = performance.now() - start;
    console.log(`DOM Content Loaded: ${domContentLoaded.toFixed(0)}ms`);
    
    // Wait for React to render
    await page.waitForSelector('[data-testid="welcome-view"], [data-testid="chat-view"]', {
      timeout: THRESHOLDS.LOAD_TIME_MS,
    });
    
    const interactive = performance.now() - start;
    console.log(`Time to Interactive: ${interactive.toFixed(0)}ms`);
    
    expect(interactive).toBeLessThan(THRESHOLDS.INTERACTIVE_TIME_MS);
  });

  test('P2: Chat input is responsive', async ({ page }) => {
    await page.goto('/');
    await page.waitForSelector('[data-testid="chat-input"], textarea');
    
    const input = page.locator('[data-testid="chat-input"], textarea').first();
    
    // Measure input latency
    const testString = 'Hello, this is a performance test message!';
    const start = performance.now();
    
    await input.focus();
    await input.fill(testString);
    
    const inputTime = performance.now() - start;
    console.log(`Input fill time: ${inputTime.toFixed(0)}ms`);
    
    // Verify text was entered
    const value = await input.inputValue();
    expect(value).toBe(testString);
    
    // Input should be near-instant
    expect(inputTime).toBeLessThan(THRESHOLDS.INPUT_LATENCY_MS * 2);
  });

  test('P3: Sidebar renders without jank', async ({ page }) => {
    await page.goto('/');
    
    // Create multiple conversations by triggering new chat
    const newChatButton = page.locator('[data-testid="new-chat-button"], button:has-text("New")').first();
    
    if (await newChatButton.isVisible()) {
      for (let i = 0; i < 5; i++) {
        await newChatButton.click();
        await page.waitForTimeout(100);
      }
    }
    
    // Measure sidebar scroll performance
    const sidebar = page.locator('[data-testid="sidebar"], [role="navigation"]').first();
    
    if (await sidebar.isVisible()) {
      const scrollStart = performance.now();
      
      // Scroll the sidebar
      await sidebar.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      
      await sidebar.evaluate((el) => {
        el.scrollTop = 0;
      });
      
      const scrollTime = performance.now() - scrollStart;
      console.log(`Sidebar scroll time: ${scrollTime.toFixed(0)}ms`);
      
      // Should be smooth
      expect(scrollTime).toBeLessThan(500);
    }
  });

  test('P4: Theme toggle is instant', async ({ page }) => {
    await page.goto('/');
    
    // Try to find settings button
    const settingsButton = page.locator('[data-testid="settings-button"], button:has([data-testid="settings-icon"]), button[aria-label*="Settings"]').first();
    
    if (await settingsButton.isVisible()) {
      await settingsButton.click();
      
      // Find theme toggle
      const themeSwitch = page.locator('[data-testid="theme-switch"], [role="switch"]').first();
      
      if (await themeSwitch.isVisible()) {
        const start = performance.now();
        await themeSwitch.click();
        
        // Wait for theme to apply
        await page.waitForFunction(() => {
          return document.documentElement.classList.contains('dark') || 
                 document.documentElement.classList.contains('light');
        }, { timeout: 500 });
        
        const themeTime = performance.now() - start;
        console.log(`Theme toggle time: ${themeTime.toFixed(0)}ms`);
        
        expect(themeTime).toBeLessThan(200);
      }
    }
  });

  test('P5: Memory usage stays reasonable', async ({ page }) => {
    await page.goto('/');
    
    // Get initial memory
    const initialMetrics = await page.evaluate(() => {
      if ('memory' in performance) {
        return (performance as any).memory;
      }
      return null;
    });
    
    if (initialMetrics) {
      const usedMB = initialMetrics.usedJSHeapSize / 1024 / 1024;
      const totalMB = initialMetrics.totalJSHeapSize / 1024 / 1024;
      
      console.log(`Initial JS Heap: ${usedMB.toFixed(1)} MB / ${totalMB.toFixed(1)} MB`);
      
      // Interact with the app to trigger allocations
      const newChatButton = page.locator('[data-testid="new-chat-button"], button:has-text("New")').first();
      
      if (await newChatButton.isVisible()) {
        for (let i = 0; i < 10; i++) {
          await newChatButton.click();
          await page.waitForTimeout(50);
        }
      }
      
      // Get memory after interactions
      const afterMetrics = await page.evaluate(() => {
        if ('memory' in performance) {
          return (performance as any).memory;
        }
        return null;
      });
      
      if (afterMetrics) {
        const afterUsedMB = afterMetrics.usedJSHeapSize / 1024 / 1024;
        console.log(`After interactions JS Heap: ${afterUsedMB.toFixed(1)} MB`);
        
        // Memory shouldn't grow excessively
        const growth = afterUsedMB - usedMB;
        console.log(`Memory growth: ${growth.toFixed(1)} MB`);
        
        expect(afterUsedMB).toBeLessThan(100); // Should stay under 100MB
      }
    } else {
      console.log('Memory API not available (expected in non-Chrome)');
    }
  });

  test('P6: Lighthouse metrics (if available)', async ({ page }) => {
    await page.goto('/');
    
    // Collect performance timing
    const timing = await page.evaluate(() => {
      const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      
      const fcp = paint.find(p => p.name === 'first-contentful-paint');
      const lcp = performance.getEntriesByType('largest-contentful-paint').pop();
      
      return {
        // Navigation timing
        domContentLoaded: nav?.domContentLoadedEventEnd - nav?.fetchStart,
        loadComplete: nav?.loadEventEnd - nav?.fetchStart,
        // Paint timing
        firstPaint: paint.find(p => p.name === 'first-paint')?.startTime,
        firstContentfulPaint: fcp?.startTime,
        largestContentfulPaint: (lcp as any)?.startTime,
      };
    });
    
    console.log('Performance Timing:');
    console.log(`  DOM Content Loaded: ${timing.domContentLoaded?.toFixed(0) || 'N/A'}ms`);
    console.log(`  Load Complete: ${timing.loadComplete?.toFixed(0) || 'N/A'}ms`);
    console.log(`  First Paint: ${timing.firstPaint?.toFixed(0) || 'N/A'}ms`);
    console.log(`  First Contentful Paint: ${timing.firstContentfulPaint?.toFixed(0) || 'N/A'}ms`);
    console.log(`  Largest Contentful Paint: ${timing.largestContentfulPaint?.toFixed(0) || 'N/A'}ms`);
    
    // Assert reasonable values
    if (timing.firstContentfulPaint) {
      expect(timing.firstContentfulPaint).toBeLessThan(1500);
    }
    if (timing.largestContentfulPaint) {
      expect(timing.largestContentfulPaint).toBeLessThan(2500);
    }
  });
});

// Helper to measure render performance
async function measureRenderTime(page: Page, action: () => Promise<void>): Promise<number> {
  const start = await page.evaluate(() => performance.now());
  await action();
  const end = await page.evaluate(() => performance.now());
  return end - start;
}
