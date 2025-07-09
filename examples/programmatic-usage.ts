#!/usr/bin/env bun

// examples/programmatic-usage.ts
/**
 * Example of using CRX Extractor programmatically
 */

import { CRXError, CRXExtractor, DownloadError, type ExtractorConfig, LogLevel, ValidationError } from '../index';

// Example 1: Extract with custom configuration
async function extractWithCustomConfig() {
  const config: ExtractorConfig = {
    maxFileSize: 200 * 1024 * 1024, // 200MB
    downloadTimeout: 60000, // 60 seconds
    maxExtractionRatio: 50, // More conservative than default
    maxExtractedFiles: 5000,
    maxExtractedSize: 500 * 1024 * 1024, // 500MB
    allowedOutputPaths: ['.', '/tmp'], // Allow current working dir and /tmp
    logLevel: LogLevel.DEBUG,
    extensionsDir: 'my-extensions'
  };

  try {
    const extractor = new CRXExtractor('nkbihfbeogaeaoehlefnkodbefgpgknn', config);
    await extractor.extract('./output/metamask');
    console.log('✅ Extraction completed successfully');
  } catch (error) {
    handleError(error);
  }
}

// Example 2: Batch extraction
async function batchExtract(extensionIds: string[]) {
  const config: ExtractorConfig = {
    maxFileSize: 100 * 1024 * 1024,
    downloadTimeout: 30000,
    maxExtractionRatio: 100,
    maxExtractedFiles: 10000,
    maxExtractedSize: 1024 * 1024 * 1024,
    allowedOutputPaths: ['.'],
    logLevel: LogLevel.INFO,
    extensionsDir: '_extensions' // Uses default _extensions directory
  };

  for (const id of extensionIds) {
    console.log(`\n📦 Processing extension: ${id}`);

    try {
      const extractor = new CRXExtractor(id, config);
      await extractor.extract();
      console.log(`✅ ${id} extracted successfully`);
    } catch (error) {
      console.error(`❌ Failed to extract ${id}:`);
      handleError(error);
    }
  }
}

// Example 3: Extract local CRX file with validation
async function extractLocalFile(filePath: string) {
  try {
    // Use quiet mode for minimal output
    const config: ExtractorConfig = {
      maxFileSize: 500 * 1024 * 1024,
      downloadTimeout: 30000,
      maxExtractionRatio: 100,
      maxExtractedFiles: 10000,
      maxExtractedSize: 1024 * 1024 * 1024,
      allowedOutputPaths: ['.'],
      logLevel: LogLevel.ERROR, // Only show errors
      extensionsDir: 'local-extensions'
    };

    const extractor = new CRXExtractor(filePath, config);
    await extractor.extract('./extracted');

    // Read the manifest to get extension info
    const manifestFile = Bun.file('./extracted/manifest.json');
    if (await manifestFile.exists()) {
      const manifest = await manifestFile.json();
      console.log('📋 Extension Info:');
      console.log(`   Name: ${manifest.name}`);
      console.log(`   Version: ${manifest.version}`);
      console.log(`   Description: ${manifest.description || 'N/A'}`);
    }
  } catch (error) {
    handleError(error);
  }
}

// Error handling helper
function handleError(error: unknown) {
  if (error instanceof ValidationError) {
    console.error('Validation Error:', error.message);
  } else if (error instanceof DownloadError) {
    console.error('Download Error:', error.message);
  } else if (error instanceof CRXError) {
    console.error(`${error.code}:`, error.message);
  } else if (error instanceof Error) {
    console.error('Unexpected Error:', error.message);
  } else {
    console.error('Unknown error occurred');
  }
}

// Run examples based on command line arguments
async function main() {
  const args = Bun.argv.slice(2);
  const command = args[0];

  switch (command) {
    case 'custom':
      await extractWithCustomConfig();
      break;

    case 'batch':
      // Example extension IDs
      const ids = [
        'nkbihfbeogaeaoehlefnkodbefgpgknn', // MetaMask
        'aeblfdkhhhdcdjpifhhbdiojplfjncoa', // 1Password
        'cjpalhdlnbpafiamejdnhcphjbkeiagm' // uBlock Origin
      ];
      await batchExtract(ids);
      break;

    case 'local':
      const filePath = args[1];
      if (!filePath) {
        console.error('Please provide a file path');
        process.exit(1);
      }
      await extractLocalFile(filePath);
      break;

    default:
      console.log(`
Usage: bun run examples/programmatic-usage.ts <command> [args]

Commands:
  custom        - Extract with custom configuration
  batch         - Batch extract multiple extensions
  local <file>  - Extract a local CRX file

Examples:
  bun run examples/programmatic-usage.ts custom
  bun run examples/programmatic-usage.ts batch
  bun run examples/programmatic-usage.ts local ./extension.crx
      `);
  }
}

if (import.meta.main) {
  await main();
}
