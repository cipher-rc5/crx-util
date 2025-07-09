// src/config/types.ts

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export interface ExtractorConfig {
  readonly maxFileSize: number;
  readonly downloadTimeout: number;
  readonly maxExtractionRatio: number;
  readonly maxExtractedFiles: number;
  readonly maxExtractedSize: number;
  readonly allowedOutputPaths: string[];
  readonly logLevel: LogLevel;
  readonly extensionsDir: string;
}
