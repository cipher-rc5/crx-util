// tests/types/index.test.ts

import { describe, expect, test } from 'bun:test';
import type { CRXHeader, ExtensionInfo, ExtensionManifest, ZipInfo } from '../../src/types';

describe('Type interfaces', () => {
  test('CRXHeader should have required properties', () => {
    const header: CRXHeader = { version: 3, zipOffset: 1024 };
    expect(header.version).toBe(3);
    expect(header.zipOffset).toBe(1024);
  });

  test('ExtensionInfo should have required properties', () => {
    const info: ExtensionInfo = { id: 'abc123', name: 'Test Extension' };
    expect(info.id).toBe('abc123');
    expect(info.name).toBe('Test Extension');
  });

  test('ExtensionManifest should have required and optional properties', () => {
    const manifest: ExtensionManifest = {
      name: 'Test',
      version: '1.0.0',
      manifest_version: 3,
      description: 'Test description',
      permissions: ['storage'],
      host_permissions: ['https://*/*']
    };
    expect(manifest.name).toBe('Test');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.manifest_version).toBe(3);
    expect(manifest.description).toBe('Test description');
    expect(manifest.permissions).toEqual(['storage']);
    expect(manifest.host_permissions).toEqual(['https://*/*']);
  });

  test('ZipInfo should have required properties', () => {
    const info: ZipInfo = { fileCount: 10, uncompressedSize: 1000000, compressedSize: 500000 };
    expect(info.fileCount).toBe(10);
    expect(info.uncompressedSize).toBe(1000000);
    expect(info.compressedSize).toBe(500000);
  });
});
