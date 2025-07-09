#!/usr/bin/env bun

// examples/custom-config.ts

/**
 * Example of using custom configuration for different scenarios
 */

import { CRXExtractor, type ExtractorConfig, LogLevel } from '../index';
import { DEFAULT_CONFIG } from '../src/config/defaults';

// Configuration for development - extracts to a dev directory
const devConfig: ExtractorConfig = {
  ...DEFAULT_CONFIG,
  extensionsDir: '_extensions_dev',
  logLevel: LogLevel.DEBUG,
  allowedOutputPaths: ['.', './dev'] // Allow dev directory
};

// Configuration for production - more restrictive
const prodConfig: ExtractorConfig = {
  ...DEFAULT_CONFIG,
  maxFileSize: 100 * 1024 * 1024, // 100MB limit
  maxExtractedFiles: 5000, // Fewer files allowed
  logLevel: LogLevel.ERROR, // Only errors
  extensionsDir: '_extensions_prod'
};

// Configuration for testing - uses temp directory
const testConfig: ExtractorConfig = {
  ...DEFAULT_CONFIG,
  extensionsDir: '/tmp/crx-test',
  allowedOutputPaths: ['.', '/tmp'],
  logLevel: LogLevel.WARN
};

// Configuration for CI/CD environments
const ciConfig: ExtractorConfig = {
  ...DEFAULT_CONFIG,
  downloadTimeout: 60000, // Longer timeout for CI
  extensionsDir: process.env.CI_EXTENSIONS_DIR || '_extensions_ci',
  allowedOutputPaths: ['.', process.env.CI_OUTPUT_DIR || '.'],
  logLevel: LogLevel.INFO
};

async function main() {
  const args = Bun.argv.slice(2);
  const mode = args[0] || 'dev';
  const extensionId = args[1];

  if (!extensionId) {
    console.log(`
Usage: bun run examples/custom-config.ts <mode> <extension-id>

Modes:
  dev   - Development mode with debug logging
  prod  - Production mode with stricter limits
  test  - Test mode using temp directory
  ci    - CI/CD mode with environment variables

Example:
  bun run examples/custom-config.ts dev nkbihfbeogaeaoehlefnkodbefgpgknn
    `);
    process.exit(1);
  }

  let config: ExtractorConfig;
  switch (mode) {
    case 'prod':
      config = prodConfig;
      break;
    case 'test':
      config = testConfig;
      break;
    case 'ci':
      config = ciConfig;
      break;
    case 'dev':
    default:
      config = devConfig;
  }

  console.log(`🚀 Running in ${mode} mode`);
  console.log(`📁 Extensions directory: ${config.extensionsDir}`);
  console.log(`📊 Log level: ${LogLevel[config.logLevel]}`);

  try {
    const extractor = new CRXExtractor(extensionId, config);
    await extractor.extract();
    console.log(`✅ Successfully extracted in ${mode} mode`);
  } catch (error) {
    console.error(`❌ Failed in ${mode} mode:`, error);
    process.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
