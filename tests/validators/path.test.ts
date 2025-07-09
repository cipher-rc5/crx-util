// tests/validators/path.test.ts

import { beforeEach, describe, expect, test } from 'bun:test';
import { SecurityError } from '../../src/errors';
import { PathValidator } from '../../src/validators/path';

describe('PathValidator', () => {
  describe('validatePath', () => {
    test('should allow paths within allowed directories', () => {
      const validator = new PathValidator(['.']);
      const cwd = process.cwd();

      expect(validator.validatePath('test.txt')).toBe(`${cwd}/test.txt`);
      expect(validator.validatePath('./subdir/file.txt')).toBe(`${cwd}/subdir/file.txt`);
    });

    test('should handle absolute allowed paths', () => {
      const validator = new PathValidator(['/tmp', '/var/log']);

      expect(validator.validatePath('/tmp/file.txt')).toBe('/tmp/file.txt');
      expect(validator.validatePath('/var/log/app.log')).toBe('/var/log/app.log');
    });

    test('should reject paths outside allowed directories', () => {
      const validator = new PathValidator(['.']);

      expect(() => validator.validatePath('../outside.txt')).toThrow(SecurityError);
      expect(() => validator.validatePath('/etc/passwd')).toThrow(SecurityError);
    });

    test('should handle baseDir parameter', () => {
      const validator = new PathValidator(['.']);
      const cwd = process.cwd();

      expect(validator.validatePath('file.txt', `${cwd}/subdir`)).toBe(`${cwd}/subdir/file.txt`);
    });

    test('should normalize paths with . and ..', () => {
      const validator = new PathValidator(['.']);
      const cwd = process.cwd();

      expect(validator.validatePath('./a/./b/../c/file.txt')).toBe(`${cwd}/a/c/file.txt`);
    });

    test('should handle multiple allowed paths', () => {
      const validator = new PathValidator(['.', './output', '/tmp']);
      const cwd = process.cwd();

      expect(validator.validatePath('file.txt')).toBe(`${cwd}/file.txt`);
      expect(validator.validatePath('output/result.txt')).toBe(`${cwd}/output/result.txt`);
      expect(validator.validatePath('/tmp/temp.txt')).toBe('/tmp/temp.txt');
    });

    test('should reject directory traversal attempts', () => {
      const validator = new PathValidator(['./safe']);

      expect(() => validator.validatePath('../../../etc/passwd')).toThrow(SecurityError);
      expect(() => validator.validatePath('./safe/../../../etc/passwd')).toThrow(SecurityError);
    });
  });

  describe('sanitizeFilename', () => {
    let validator: PathValidator;

    beforeEach(() => {
      validator = new PathValidator(['.']);
    });

    test('should remove invalid characters', () => {
      expect(validator.sanitizeFilename('file<>:"/\\|?*.txt')).toBe('file_________.txt');
    });

    test('should remove control characters', () => {
      expect(validator.sanitizeFilename('file\x00\x1f\x7f.txt')).toBe('file___.txt');
    });

    test('should prevent directory traversal', () => {
      expect(validator.sanitizeFilename('../../../etc/passwd')).toBe('_/_/etc/passwd');
      expect(validator.sanitizeFilename('file...txt')).toBe('file_.txt');
    });

    test('should trim whitespace', () => {
      expect(validator.sanitizeFilename('  file.txt  ')).toBe('file.txt');
    });

    test('should limit filename length', () => {
      const longName = 'a'.repeat(250) + '.txt';
      const result = validator.sanitizeFilename(longName);
      expect(result.length).toBe(200);
      expect(result).toBe('a'.repeat(200));
    });

    test('should handle empty names', () => {
      expect(validator.sanitizeFilename('')).toBe('unnamed');
      expect(validator.sanitizeFilename('   ')).toBe('unnamed');
      expect(validator.sanitizeFilename('***')).toBe('___');
    });

    test('should preserve valid characters', () => {
      expect(validator.sanitizeFilename('my-file_123.test.txt')).toBe('my-file_123.test.txt');
    });
  });
});
