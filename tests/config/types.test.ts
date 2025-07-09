// tests/config/types.test.ts

import { describe, expect, test } from 'bun:test';
import { LogLevel } from '../../src/config/types';

describe('LogLevel enum', () => {
  test('should have correct values', () => {
    expect(LogLevel.DEBUG).toBe(0);
    expect(LogLevel.INFO).toBe(1);
    expect(LogLevel.WARN).toBe(2);
    expect(LogLevel.ERROR).toBe(3);
  });

  test('should be comparable', () => {
    expect(LogLevel.ERROR > LogLevel.INFO).toBe(true);
    expect(LogLevel.DEBUG < LogLevel.WARN).toBe(true);
  });
});
