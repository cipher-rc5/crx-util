// tests/cli.test.ts

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { runCLI } from '../src/cli';
import { CRXExtractor } from '../src/core/crx-extractor';

describe('CLI', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;
  let extractorMock: any;

  beforeEach(() => {
    consoleLogSpy = mock(() => {});
    consoleErrorSpy = mock(() => {});
    processExitSpy = mock(() => {});
    extractorMock = mock(() => {});

    console.log = consoleLogSpy;
    console.error = consoleErrorSpy;
    process.exit = processExitSpy as any;
    CRXExtractor.prototype.extract = extractorMock;
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    processExitSpy.mockRestore();
    extractorMock.mockRestore();
  });

  describe('help display', () => {
    test('should show help when no args provided', async () => {
      await runCLI([]);

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('Usage:');
      expect(output).toContain('Examples:');
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });

    test('should show help with --help flag', async () => {
      await runCLI(['--help']);

      expect(consoleLogSpy).toHaveBeenCalled();
      expect(processExitSpy).toHaveBeenCalledWith(0);
    });
  });

  describe('argument parsing', () => {
    test('should parse input argument', async () => {
      extractorMock.mockResolvedValue(undefined);

      await runCLI(['test.crx']);

      expect(extractorMock).toHaveBeenCalledWith(undefined);
    });

    test('should parse output directory', async () => {
      extractorMock.mockResolvedValue(undefined);

      await runCLI(['test.crx', './output']);

      expect(extractorMock).toHaveBeenCalledWith('./output');
    });

    test('should parse --debug flag', async () => {
      extractorMock.mockResolvedValue(undefined);

      await runCLI(['test.crx', '--debug']);

      // Config would have LogLevel.DEBUG
      expect(extractorMock).toHaveBeenCalled();
    });

    test('should parse --quiet flag', async () => {
      extractorMock.mockResolvedValue(undefined);

      await runCLI(['test.crx', '--quiet']);

      // Config would have LogLevel.ERROR
      expect(extractorMock).toHaveBeenCalled();
    });

    test('should handle multiple arguments', async () => {
      extractorMock.mockResolvedValue(undefined);

      await runCLI(['test.crx', './output', '--debug']);

      expect(extractorMock).toHaveBeenCalledWith('./output');
    });
  });

  describe('error handling', () => {
    test('should handle CRXError', async () => {
      const { ValidationError } = await import('../src/errors');
      extractorMock.mockRejectedValue(new ValidationError('Test error'));

      await runCLI(['test.crx']);

      expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ VALIDATION_ERROR: Test error');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    test('should handle generic Error', async () => {
      extractorMock.mockRejectedValue(new Error('Generic error'));

      await runCLI(['test.crx']);

      expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ Unexpected error: Generic error');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });

    test('should show stack trace in debug mode', async () => {
      const error = new Error('Test error');
      extractorMock.mockRejectedValue(error);

      await runCLI(['test.crx', '--debug']);

      expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
      expect(consoleErrorSpy.mock.calls[1][0]).toContain('Error: Test error');
    });

    test('should handle unknown errors', async () => {
      extractorMock.mockRejectedValue('Not an error object');

      await runCLI(['test.crx']);

      expect(consoleErrorSpy).toHaveBeenCalledWith('\n❌ Unknown error occurred');
      expect(processExitSpy).toHaveBeenCalledWith(1);
    });
  });

  describe('successful extraction', () => {
    test('should complete without error', async () => {
      extractorMock.mockResolvedValue(undefined);

      await runCLI(['test.crx']);

      expect(processExitSpy).not.toHaveBeenCalled();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
  });
});
