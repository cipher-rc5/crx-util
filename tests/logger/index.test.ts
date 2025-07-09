// tests/logger/index.test.ts

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { LogLevel } from '../../src/config/types';
import { Logger } from '../../src/logger';

describe('Logger', () => {
  let consoleLogSpy: any;
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    consoleLogSpy = mock(() => {});
    consoleWarnSpy = mock(() => {});
    consoleErrorSpy = mock(() => {});
    console.log = consoleLogSpy;
    console.warn = consoleWarnSpy;
    console.error = consoleErrorSpy;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('log level filtering', () => {
    test('should only log at or above configured level', () => {
      const logger = new Logger(LogLevel.WARN);

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(0);
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });

    test('should log all levels when set to DEBUG', () => {
      const logger = new Logger(LogLevel.DEBUG);

      logger.debug('debug message');
      logger.info('info message');
      logger.warn('warn message');
      logger.error('error message');

      expect(consoleLogSpy).toHaveBeenCalledTimes(2); // debug + info
      expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('message formatting', () => {
    test('should format messages with timestamp and level', () => {
      const logger = new Logger(LogLevel.INFO);
      logger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const call = consoleLogSpy.mock.calls[0][0];
      expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
      expect(call).toContain('[INFO ]');
      expect(call).toContain('Test message');
    });
  });

  describe('debug data logging', () => {
    test('should log data when provided', () => {
      const logger = new Logger(LogLevel.DEBUG);
      const data = { key: 'value' };
      logger.debug('Debug message', data);

      expect(consoleLogSpy).toHaveBeenCalledTimes(2);
      expect(consoleLogSpy.mock.calls[1][0]).toBe('  Data:');
      expect(consoleLogSpy.mock.calls[1][1]).toEqual(data);
    });

    test('should sanitize sensitive data', () => {
      const logger = new Logger(LogLevel.DEBUG);
      const data = { password: 'secret123', token: 'abc123', key: 'private-key', secret: 'hidden', normal: 'visible' };
      logger.debug('Debug message', data);

      const loggedData = consoleLogSpy.mock.calls[1][1];
      expect(loggedData.password).toBe('[REDACTED]');
      expect(loggedData.token).toBe('[REDACTED]');
      expect(loggedData.key).toBe('[REDACTED]');
      expect(loggedData.secret).toBe('[REDACTED]');
      expect(loggedData.normal).toBe('visible');
    });

    test('should sanitize paths in strings', () => {
      const logger = new Logger(LogLevel.DEBUG);
      logger.debug('Debug message', '/home/user/project/file.txt');

      const loggedData = consoleLogSpy.mock.calls[1][1];
      expect(loggedData).toBe('/.../file.txt');
    });
  });

  describe('error logging', () => {
    test('should log error stack in debug mode', () => {
      const logger = new Logger(LogLevel.DEBUG);
      const error = new Error('Test error');
      logger.error('Error occurred', error);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy.mock.calls[1][0]).toBe('  Stack:');
      expect(consoleErrorSpy.mock.calls[1][1]).toContain('Error: Test error');
    });

    test('should not log error stack in non-debug mode', () => {
      const logger = new Logger(LogLevel.ERROR);
      const error = new Error('Test error');
      logger.error('Error occurred', error);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    });
  });
});
