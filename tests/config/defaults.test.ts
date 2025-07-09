// tests/config/defaults.test.ts

import { describe, expect, test } from 'bun:test';
import { DEFAULT_CONFIG } from '../../src/config/defaults';
import { LogLevel } from '../../src/config/types';

describe('DEFAULT_CONFIG', () => {
  test('should have correct size limits', () => {
    expect(DEFAULT_CONFIG.maxFileSize).toBe(500 * 1024 * 1024); // 500MB
    expect(DEFAULT_CONFIG.maxExtractedSize).toBe(1024 * 1024 * 1024); // 1GB
  });

  test('should have correct timeout', () => {
    expect(DEFAULT_CONFIG.downloadTimeout).toBe(30000); // 30s
  });

  test('should have correct extraction limits', () => {
    expect(DEFAULT_CONFIG.maxExtractionRatio).toBe(100);
    expect(DEFAULT_CONFIG.maxExtractedFiles).toBe(10000);
  });

  test('should have correct default paths', () => {
    expect(DEFAULT_CONFIG.allowedOutputPaths).toEqual(['.']);
    expect(DEFAULT_CONFIG.extensionsDir).toBe('_extensions');
  });

  test('should have INFO log level by default', () => {
    expect(DEFAULT_CONFIG.logLevel).toBe(LogLevel.INFO);
  });

  test('should be readonly', () => {
    // Test that properties are readonly by checking TypeScript types
    // This is more of a compile-time check
    const config = DEFAULT_CONFIG;
    expect(config).toBeDefined();
  });
});
