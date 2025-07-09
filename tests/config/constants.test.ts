// tests/config/constants.test.ts

import { describe, expect, test } from 'bun:test';
import { CHROME_WEBSTORE_URL_BASE, CRX_DOWNLOAD_URL_BASE, CRX_MAGIC, CRX_VERSION_2, CRX_VERSION_3, DEFAULT_EXTENSIONS_DIR } from '../../src/config/constants';

describe('constants', () => {
  test('CRX_MAGIC should be correct value', () => {
    expect(CRX_MAGIC).toBe(0x34327243); // "Cr24"
  });

  test('CRX versions should be defined', () => {
    expect(CRX_VERSION_2).toBe(2);
    expect(CRX_VERSION_3).toBe(3);
  });

  test('DEFAULT_EXTENSIONS_DIR should be _extensions', () => {
    expect(DEFAULT_EXTENSIONS_DIR).toBe('_extensions');
  });

  test('URLs should be properly formatted', () => {
    expect(CHROME_WEBSTORE_URL_BASE).toBe('https://chromewebstore.google.com/detail/');
    expect(CRX_DOWNLOAD_URL_BASE).toBe('https://clients2.google.com/service/update2/crx');
  });
});
