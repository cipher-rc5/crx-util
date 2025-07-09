#!/usr/bin/env bun

// index.ts

import { runCLI } from './src/cli';

// Export all public APIs for library usage
export { type ExtractorConfig, LogLevel } from './src/config/types';
export { CRXExtractor } from './src/core/crx-extractor';
export { CRXError, DownloadError, ExtractionError, SecurityError, ValidationError } from './src/errors';
export { Logger } from './src/logger';

// Run CLI if this is the main module
if (import.meta.main) {
  await runCLI(Bun.argv.slice(2));
}
