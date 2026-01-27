/**
 * Optimized Vite Configuration with Bundle Splitting
 * 
 * Copy this to vite.config.ts to enable performance optimizations.
 * See PERFORMANCE_BENCHMARKS.md for details.
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  
  // Prevent vite from obscuring Rust errors
  clearScreen: false,
  
  // Tauri expects a fixed port
  server: {
    port: 5173,
    strictPort: true,
  },
  
  // Env prefix for Tauri
  envPrefix: ["VITE_", "TAURI_"],
  
  build: {
    // Tauri uses Chromium on Windows and WebKit on macOS/Linux
    target: process.env.TAURI_PLATFORM === "windows" ? "chrome105" : "safari13",
    
    // Don't minify for debug builds
    minify: !process.env.TAURI_DEBUG ? "esbuild" : false,
    
    // Produce sourcemaps for debug builds
    sourcemap: !!process.env.TAURI_DEBUG,
    
    // === PERFORMANCE OPTIMIZATIONS ===
    
    rollupOptions: {
      output: {
        // Bundle splitting for better caching and initial load
        manualChunks: (id) => {
          // React core - rarely changes, cache long
          if (id.includes('react') || id.includes('react-dom') || id.includes('scheduler')) {
            return 'react-vendor';
          }
          
          // Markdown rendering - only needed when messages exist
          if (
            id.includes('react-markdown') ||
            id.includes('remark-') ||
            id.includes('rehype-') ||
            id.includes('unified') ||
            id.includes('mdast-') ||
            id.includes('hast-') ||
            id.includes('micromark') ||
            id.includes('highlight.js')
          ) {
            return 'markdown';
          }
          
          // UI components - Radix UI
          if (id.includes('@radix-ui')) {
            return 'ui';
          }
          
          // Utilities - state, storage, dates
          if (
            id.includes('zustand') ||
            id.includes('dexie') ||
            id.includes('date-fns')
          ) {
            return 'utils';
          }
          
          // Icons - potentially large
          if (id.includes('lucide-react')) {
            return 'icons';
          }
        },
        
        // Chunk naming for debugging
        chunkFileNames: (chunkInfo) => {
          const name = chunkInfo.name || 'chunk';
          return `assets/${name}-[hash].js`;
        },
      },
    },
    
    // Report compressed sizes
    reportCompressedSize: true,
    
    // Warn on large chunks
    chunkSizeWarningLimit: 300, // KB
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'zustand',
      'dexie',
      'dexie-react-hooks',
    ],
    // Exclude heavy deps from pre-bundling if they're lazy loaded
    exclude: [],
  },
});
