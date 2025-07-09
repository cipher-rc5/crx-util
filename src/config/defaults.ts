// src/config/defaults.ts

import { DEFAULT_EXTENSIONS_DIR } from './constants';
import { type ExtractorConfig, LogLevel } from './types';

export const DEFAULT_CONFIG: ExtractorConfig = {
  maxFileSize: 500 * 1024 * 1024, // 500MB
  downloadTimeout: 30000, // 30 seconds
  maxExtractionRatio: 100, // Max 100:1 compression ratio
  maxExtractedFiles: 10000, // Max 10k files
  maxExtractedSize: 1024 * 1024 * 1024, // 1GB max extracted
  allowedOutputPaths: ['.'], // Current working directory (where the command is run)
  logLevel: LogLevel.INFO,
  extensionsDir: DEFAULT_EXTENSIONS_DIR // _extensions (outside src directory)
};
