// tests/errors/index.test.ts

import { describe, expect, test } from 'bun:test';
import { CRXError, DownloadError, ExtractionError, SecurityError, ValidationError } from '../../src/errors';

describe('Error classes', () => {
  describe('CRXError', () => {
    test('should create error with message and code', () => {
      const error = new CRXError('Test message', 'TEST_CODE');
      expect(error.message).toBe('Test message');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('CRXError');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('ValidationError', () => {
    test('should create error with VALIDATION_ERROR code', () => {
      const error = new ValidationError('Invalid input');
      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error instanceof CRXError).toBe(true);
    });
  });

  describe('DownloadError', () => {
    test('should create error with DOWNLOAD_ERROR code', () => {
      const error = new DownloadError('Download failed');
      expect(error.message).toBe('Download failed');
      expect(error.code).toBe('DOWNLOAD_ERROR');
      expect(error instanceof CRXError).toBe(true);
    });
  });

  describe('ExtractionError', () => {
    test('should create error with EXTRACTION_ERROR code', () => {
      const error = new ExtractionError('Extraction failed');
      expect(error.message).toBe('Extraction failed');
      expect(error.code).toBe('EXTRACTION_ERROR');
      expect(error instanceof CRXError).toBe(true);
    });
  });

  describe('SecurityError', () => {
    test('should create error with SECURITY_ERROR code', () => {
      const error = new SecurityError('Security violation');
      expect(error.message).toBe('Security violation');
      expect(error.code).toBe('SECURITY_ERROR');
      expect(error instanceof CRXError).toBe(true);
    });
  });
});
