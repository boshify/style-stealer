/**
 * Polyfills for Node.js build environment
 * Provides browser APIs that the Anthropic SDK expects
 */

// Prevent unhandled promise rejections from crashing the process
process.on('unhandledRejection', (reason) => {
  console.error('[Process] Unhandled promise rejection:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('[Process] Uncaught exception:', error);
  // Don't exit - let the process continue serving requests
});

// Polyfill for File API (used by Anthropic SDK)
if (typeof globalThis.File === 'undefined') {
  globalThis.File = class File {
    constructor(bits, name, options) {
      this.bits = bits;
      this.name = name;
      this.options = options || {};
      this.type = this.options.type || '';
      this.lastModified = this.options.lastModified || Date.now();
    }
  };
}

// Polyfill for Blob if needed
if (typeof globalThis.Blob === 'undefined') {
  globalThis.Blob = class Blob {
    constructor(bits, options) {
      this.bits = bits;
      this.options = options || {};
      this.type = this.options.type || '';
    }
  };
}
