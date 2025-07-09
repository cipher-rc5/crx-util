// tests/utils/path.test.ts

import { describe, expect, test } from 'bun:test';
import { PathUtils } from '../../src/utils/path';

describe('PathUtils', () => {
  describe('join', () => {
    test('should join path segments', () => {
      expect(PathUtils.join('a', 'b', 'c')).toBe('a/b/c');
      expect(PathUtils.join('/a', 'b', 'c')).toBe('/a/b/c');
    });

    test('should handle empty segments', () => {
      expect(PathUtils.join('a', '', 'b')).toBe('a/b');
      expect(PathUtils.join('', 'a', 'b')).toBe('a/b');
    });

    test('should remove duplicate slashes', () => {
      expect(PathUtils.join('a//b', 'c')).toBe('a/b/c');
      expect(PathUtils.join('a/', '/b')).toBe('a/b');
    });

    test('should resolve ./ sequences', () => {
      expect(PathUtils.join('a', './b', 'c')).toBe('a/b/c');
      expect(PathUtils.join('./a', 'b')).toBe('a/b');
    });

    test('should resolve ../ sequences', () => {
      expect(PathUtils.join('a/b', '../c')).toBe('a/c');
      expect(PathUtils.join('a/b/c', '../../d')).toBe('a/d');
    });

    test('should handle trailing slashes', () => {
      expect(PathUtils.join('a/b/')).toBe('a/b');
      expect(PathUtils.join('/')).toBe('/');
    });
  });

  describe('dirname', () => {
    test('should return directory name', () => {
      expect(PathUtils.dirname('/a/b/c')).toBe('/a/b');
      expect(PathUtils.dirname('a/b/c')).toBe('a/b');
      expect(PathUtils.dirname('/a')).toBe('/');
    });

    test('should handle edge cases', () => {
      expect(PathUtils.dirname('file.txt')).toBe('.');
      expect(PathUtils.dirname('/')).toBe('/');
      expect(PathUtils.dirname('')).toBe('.');
    });
  });

  describe('resolve', () => {
    test('should return absolute paths as-is', () => {
      expect(PathUtils.resolve('/absolute/path')).toBe('/absolute/path');
    });

    test('should resolve relative paths', () => {
      const resolved = PathUtils.resolve('relative/path');
      expect(resolved).toContain('/relative/path');
      expect(resolved.startsWith('/')).toBe(true);
    });

    test('should join multiple segments', () => {
      const resolved = PathUtils.resolve('a', 'b', 'c');
      expect(resolved).toContain('/a/b/c');
    });
  });

  describe('normalize', () => {
    test('should normalize paths with . and ..', () => {
      expect(PathUtils.normalize('a/./b')).toBe('a/b');
      expect(PathUtils.normalize('a/../b')).toBe('b');
      expect(PathUtils.normalize('a/b/../c')).toBe('a/c');
    });

    test('should handle absolute paths', () => {
      expect(PathUtils.normalize('/a/./b')).toBe('/a/b');
      expect(PathUtils.normalize('/a/../b')).toBe('/b');
    });

    test('should handle empty segments', () => {
      expect(PathUtils.normalize('a//b')).toBe('a/b');
      expect(PathUtils.normalize('a///b')).toBe('a/b');
    });

    test('should handle edge cases', () => {
      expect(PathUtils.normalize('')).toBe('.');
      expect(PathUtils.normalize('.')).toBe('.');
      expect(PathUtils.normalize('..')).toBe('.');
    });

    test('should not go above root', () => {
      expect(PathUtils.normalize('/../a')).toBe('/a');
      expect(PathUtils.normalize('/a/../../b')).toBe('/b');
    });
  });
});
