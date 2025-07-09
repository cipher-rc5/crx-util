// src/cli.ts

import { CHROME_WEBSTORE_URL_BASE } from './config/constants';
import { DEFAULT_CONFIG } from './config/defaults';
import { type ExtractorConfig, LogLevel } from './config/types';
import { CRXExtractor } from './core/crx-extractor';
import { CRXError } from './errors';

export async function runCLI(args: string[]): Promise<void> {
  if (args.length === 0 || args.includes('--help')) {
    console.log(`
Usage: bun run index.ts <input> [output-dir] [options]

Extracts a Chrome extension (CRX) file securely.

Input can be:
  - Chrome Web Store URL
  - Extension ID (32 lowercase letters)
  - Local .crx file path

Options:
  output-dir    Directory to extract files into (default: ./extensions/<name>)
  --debug       Enable debug logging
  --quiet       Minimal output (errors only)

Security features:
  - Path traversal protection (files only written to current directory by default)
  - ZIP bomb detection
  - Size and file count limits
  - Secure extraction process

Examples:
  bun run index.ts ${CHROME_WEBSTORE_URL_BASE}nkbihfbeogaeaoehlefnkodbefgpgknn
  bun run index.ts nkbihfbeogaeaoehlefnkodbefgpgknn
  bun run index.ts ./my-extension.crx ./output
  bun run index.ts nkbihfbeogaeaoehlefnkodbefgpgknn --debug

Note: By default, files are extracted to ./extensions/<extension-name>/ in the current directory.
    `);
    process.exit(0);
  }

  // Parse arguments
  const input = args[0];
  if (!input) {
    console.error('\n❌ No input provided');
    process.exit(1);
  }

  let outputDir: string | undefined;
  let logLevel = LogLevel.INFO;

  for (let i = 1;i < args.length;i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg === '--debug') {
      logLevel = LogLevel.DEBUG;
    } else if (arg === '--quiet') {
      logLevel = LogLevel.ERROR;
    } else if (!outputDir && !arg.startsWith('--')) {
      outputDir = arg;
    }
  }

  // Create config with CLI options
  const config: ExtractorConfig = { ...DEFAULT_CONFIG, logLevel };

  try {
    const extractor = new CRXExtractor(input, config);
    await extractor.extract(outputDir);
  } catch (error) {
    if (error instanceof CRXError) {
      console.error(`\n❌ ${error.code}: ${error.message}`);
    } else if (error instanceof Error) {
      console.error(`\n❌ Unexpected error: ${error.message}`);
      if (logLevel === LogLevel.DEBUG) {
        console.error(error.stack);
      }
    } else {
      console.error(`\n❌ Unknown error occurred`);
    }
    process.exit(1);
  }
}
