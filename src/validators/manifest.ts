// src/validators/manifest.ts

import { ValidationError } from '../errors';
import { type ExtensionManifest } from '../types';

export class ManifestValidator {
  validateManifest(data: unknown): ExtensionManifest {
    if (typeof data !== 'object' || data === null) {
      throw new ValidationError('Manifest must be an object');
    }

    const manifest = data as Record<string, unknown>;

    // Required fields validation
    if (typeof manifest.name !== 'string' || !manifest.name.trim()) {
      throw new ValidationError('Manifest missing required "name" field');
    }

    if (typeof manifest.version !== 'string' || !manifest.version) {
      throw new ValidationError('Manifest missing required "version" field');
    }

    if (typeof manifest.manifest_version !== 'number') {
      throw new ValidationError('Manifest missing required "manifest_version" field');
    }

    // Optional fields validation
    if (manifest.description !== undefined && typeof manifest.description !== 'string') {
      throw new ValidationError('Manifest "description" must be a string');
    }

    if (manifest.permissions !== undefined) {
      if (!Array.isArray(manifest.permissions) || !manifest.permissions.every(p => typeof p === 'string')) {
        throw new ValidationError('Manifest "permissions" must be an array of strings');
      }
    }

    return manifest as ExtensionManifest;
  }
}
