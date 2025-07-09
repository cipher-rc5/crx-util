// tests/validators/manifest.test.ts

import { beforeEach, describe, expect, test } from 'bun:test';
import { ValidationError } from '../../src/errors';
import { ManifestValidator } from '../../src/validators/manifest';

describe('ManifestValidator', () => {
  let validator: ManifestValidator;

  beforeEach(() => {
    validator = new ManifestValidator();
  });

  describe('validateManifest', () => {
    test('should validate a valid manifest', () => {
      const validManifest = {
        name: 'Test Extension',
        version: '1.0.0',
        manifest_version: 3,
        description: 'A test extension',
        permissions: ['storage', 'tabs']
      };

      const result = validator.validateManifest(validManifest);
      expect(result).toEqual(validManifest);
    });

    test('should reject non-object input', () => {
      expect(() => validator.validateManifest(null)).toThrow(ValidationError);
      expect(() => validator.validateManifest('string')).toThrow(ValidationError);
      expect(() => validator.validateManifest(123)).toThrow(ValidationError);
      expect(() => validator.validateManifest([])).toThrow(ValidationError);
    });

    test('should require name field', () => {
      const manifest = { version: '1.0.0', manifest_version: 3 };
      expect(() => validator.validateManifest(manifest)).toThrow('Manifest missing required "name" field');
    });

    test('should reject empty name', () => {
      const manifest = { name: '   ', version: '1.0.0', manifest_version: 3 };
      expect(() => validator.validateManifest(manifest)).toThrow('Manifest missing required "name" field');
    });

    test('should require version field', () => {
      const manifest = { name: 'Test', manifest_version: 3 };
      expect(() => validator.validateManifest(manifest)).toThrow('Manifest missing required "version" field');
    });

    test('should require manifest_version field', () => {
      const manifest = { name: 'Test', version: '1.0.0' };
      expect(() => validator.validateManifest(manifest)).toThrow('Manifest missing required "manifest_version" field');
    });

    test('should validate description type', () => {
      const manifest = { name: 'Test', version: '1.0.0', manifest_version: 3, description: 123 };
      expect(() => validator.validateManifest(manifest)).toThrow('Manifest "description" must be a string');
    });

    test('should validate permissions array', () => {
      const manifest = { name: 'Test', version: '1.0.0', manifest_version: 3, permissions: 'not-an-array' };
      expect(() => validator.validateManifest(manifest)).toThrow('Manifest "permissions" must be an array of strings');
    });

    test('should validate permissions array contains strings', () => {
      const manifest = { name: 'Test', version: '1.0.0', manifest_version: 3, permissions: ['storage', 123, 'tabs'] };
      expect(() => validator.validateManifest(manifest)).toThrow('Manifest "permissions" must be an array of strings');
    });

    test('should allow optional fields to be undefined', () => {
      const manifest = { name: 'Test', version: '1.0.0', manifest_version: 3 };
      const result = validator.validateManifest(manifest);
      expect(result).toEqual(manifest);
    });

    test('should preserve unknown fields', () => {
      const manifest = {
        name: 'Test',
        version: '1.0.0',
        manifest_version: 3,
        custom_field: 'custom_value',
        icons: { '16': 'icon.png' }
      };
      const result = validator.validateManifest(manifest);
      expect(result.custom_field).toBe('custom_value');
      expect(result.icons).toEqual({ '16': 'icon.png' });
    });
  });
});
