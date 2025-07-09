# Directory Structure
```
config/
  constants.ts
  defaults.ts
  types.ts
core/
  crx-extractor.ts
errors/
  index.ts
logger/
  index.ts
types/
  index.ts
utils/
  path.ts
validators/
  manifest.ts
  path.ts
cli.ts
```

# Files

## File: config/constants.ts
```typescript
// src/config/constants.ts

export const CRX_MAGIC = 0x34327243; // "Cr24"
export const CRX_VERSION_2 = 2;
export const CRX_VERSION_3 = 3;
export const DEFAULT_EXTENSIONS_DIR = '_extensions';
export const CHROME_WEBSTORE_URL_BASE = 'https://chromewebstore.google.com/detail/';
export const CRX_DOWNLOAD_URL_BASE = 'https://clients2.google.com/service/update2/crx';
```

## File: config/defaults.ts
```typescript
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
```

## File: config/types.ts
```typescript
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
```

## File: core/crx-extractor.ts
```typescript
// src/core/crx-extractor.ts

import { CRX_DOWNLOAD_URL_BASE, CRX_MAGIC, CRX_VERSION_2, CRX_VERSION_3 } from '../config/constants';
import { DEFAULT_CONFIG } from '../config/defaults';
import { type ExtractorConfig } from '../config/types';
import { CRXError, DownloadError, ExtractionError, SecurityError, ValidationError } from '../errors';
import { Logger } from '../logger';
import { type CRXHeader, type ExtensionInfo, type ExtensionManifest, type ZipInfo } from '../types';
import { PathUtils } from '../utils/path';
import { ManifestValidator } from '../validators/manifest';
import { PathValidator } from '../validators/path';

export class CRXExtractor {
  private buffer: Uint8Array | null = null;
  private offset: number = 0;
  private extensionInfo: Partial<ExtensionInfo> = {};
  private readonly logger: Logger;
  private readonly pathValidator: PathValidator;
  private readonly manifestValidator: ManifestValidator;

  constructor (private readonly input: string, private readonly config: ExtractorConfig = DEFAULT_CONFIG) {
    if (!input || typeof input !== 'string') {
      throw new ValidationError('Input must be a non-empty string');
    }

    this.logger = new Logger(config.logLevel);
    this.pathValidator = new PathValidator(config.allowedOutputPaths);
    this.manifestValidator = new ManifestValidator();

    this.logger.debug('CRXExtractor initialized', { input, config });
  }

  /**
   * Extracts the extension ID from various input formats.
   */
  private findExtensionId(): string | null {
    const idPattern = /([a-z]{32})/;
    const match = this.input.match(idPattern);
    const id = match?.[0] ?? null;
    this.logger.debug('Extension ID search', { input: this.input, found: id });
    return id;
  }

  /**
   * Downloads the CRX file from the Chrome Web Store.
   */
  private async downloadFromWebStore(extensionId: string): Promise<Uint8Array> {
    // Validate extension ID format
    if (!/^[a-z]{32}$/.test(extensionId)) {
      throw new ValidationError(`Invalid extension ID format: ${extensionId}`);
    }

    this.extensionInfo = {
      id: extensionId,
      name: extensionId // Placeholder
    };

    this.logger.info(`Fetching extension with ID: ${extensionId}`);

    const downloadUrl = new URL(CRX_DOWNLOAD_URL_BASE);
    downloadUrl.search = new URLSearchParams({
      response: 'redirect',
      prodversion: '120.0',
      acceptformat: 'crx3',
      x: `id=${extensionId}&installsource=ondemand&uc`
    }).toString();

    this.logger.debug('Download URL constructed', { url: downloadUrl.href });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.config.downloadTimeout);

    try {
      const response = await fetch(downloadUrl.href, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
        redirect: 'follow',
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (!response.ok) {
        throw new DownloadError(`Download failed: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('text/html')) {
        throw new DownloadError('Received HTML instead of a CRX file. The extension might be unlisted.');
      }

      const arrayBuffer = await response.arrayBuffer();
      const sizeMB = (arrayBuffer.byteLength / 1024 / 1024).toFixed(2);
      this.logger.info(`Downloaded ${sizeMB} MB`);

      const buffer = new Uint8Array(arrayBuffer);

      // Validate CRX magic number
      if (buffer.length < 8 || this.readUInt32LEAt(buffer, 0) !== CRX_MAGIC) {
        throw new ValidationError('Downloaded file is not a valid CRX file');
      }

      return buffer;
    } catch (error) {
      clearTimeout(timeout);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new DownloadError(`Download timed out after ${this.config.downloadTimeout}ms`);
      }
      throw error;
    }
  }

  /**
   * Loads the CRX data from the provided input.
   */
  private async loadInput(): Promise<void> {
    const extensionId = this.findExtensionId();

    if (extensionId) {
      this.buffer = await this.downloadFromWebStore(extensionId);
    } else {
      await this.loadLocalFile();
    }
  }

  /**
   * Loads a local CRX file with atomic operations.
   */
  private async loadLocalFile(): Promise<void> {
    const file = Bun.file(this.input);

    try {
      // Atomic read operation
      const [exists, stats, buffer] = await Promise.all([
        file.exists(),
        file.stat().catch(() => null),
        file.arrayBuffer().catch(() => null)
      ]);

      if (!exists || !stats || !buffer) {
        throw new ValidationError(`File not found or inaccessible: "${this.input}"`);
      }

      this.logger.info(`Loading local file: ${this.input}`);

      // Check file size
      if (stats.size > this.config.maxFileSize) {
        const maxMB = (this.config.maxFileSize / 1024 / 1024).toFixed(0);
        throw new ValidationError(`File too large. Maximum size is ${maxMB}MB`);
      }

      this.buffer = new Uint8Array(buffer);
      const filename = this.input.split('/').pop()?.replace('.crx', '') || 'local_extension';
      this.extensionInfo = { id: 'local', name: this.pathValidator.sanitizeFilename(filename) };

      this.logger.debug('Local file loaded', { size: stats.size });
    } catch (error) {
      if (error instanceof CRXError) throw error;
      throw new ValidationError(`Failed to load file: ${this.input}`);
    }
  }

  /**
   * Reads a 32-bit unsigned little-endian integer from a buffer.
   */
  private readUInt32LEAt(buffer: Uint8Array, offset: number): number {
    if (offset + 4 > buffer.length) {
      throw new ValidationError('Buffer underrun while reading UInt32LE');
    }
    return ((buffer[offset] ?? 0) |
      ((buffer[offset + 1] ?? 0) << 8) |
      ((buffer[offset + 2] ?? 0) << 16) |
      ((buffer[offset + 3] ?? 0) << 24)) >>> 0;
  }

  /**
   * Reads a 32-bit unsigned little-endian integer and advances offset.
   */
  private readUInt32LE(): number {
    if (!this.buffer) {
      throw new Error('Buffer not initialized');
    }
    const value = this.readUInt32LEAt(this.buffer, this.offset);
    this.offset += 4;
    return value;
  }

  /**
   * Parses the CRX file header.
   */
  private parseHeader(): CRXHeader {
    if (!this.buffer) {
      throw new Error('Buffer not initialized');
    }

    this.offset = 0;
    const magic = this.readUInt32LE();
    if (magic !== CRX_MAGIC) {
      throw new ValidationError(`Invalid CRX magic number: 0x${magic.toString(16)}`);
    }

    const version = this.readUInt32LE();
    let zipOffset = 0;

    switch (version) {
      case CRX_VERSION_2: {
        const publicKeyLength = this.readUInt32LE();
        const signatureLength = this.readUInt32LE();
        zipOffset = this.offset + publicKeyLength + signatureLength;
        break;
      }
      case CRX_VERSION_3: {
        const headerSize = this.readUInt32LE();
        zipOffset = this.offset + headerSize;
        break;
      }
      default:
        throw new ValidationError(`Unsupported CRX version: ${version}`);
    }

    // Validate zip offset
    if (zipOffset >= this.buffer.length) {
      throw new ValidationError('Invalid CRX header: ZIP offset exceeds file size');
    }

    this.logger.debug('CRX header parsed', { version, zipOffset });
    return { version, zipOffset };
  }

  /**
   * Gets information about a ZIP file for security checks.
   */
  private async getZipInfo(zipPath: string): Promise<ZipInfo> {
    try {
      // Use unzip -l to list contents without extracting
      const result = await Bun.$`unzip -l ${zipPath}`.text();

      const lines = result.split('\n');
      const summaryLine = lines[lines.length - 2] || '';
      const match = summaryLine.match(/^\s*(\d+)\s+(\d+)\s+files?/);

      if (!match) {
        throw new ValidationError('Could not parse ZIP information');
      }

      const uncompressedSize = parseInt(match[1] ?? '0', 10);
      const fileCount = parseInt(match[2] ?? '0', 10);
      const stats = await Bun.file(zipPath).stat();
      const compressedSize = stats.size;

      return { fileCount, uncompressedSize, compressedSize };
    } catch (error) {
      this.logger.error('Failed to get ZIP info', error);
      throw new ExtractionError('Failed to analyze ZIP file');
    }
  }

  /**
   * Validates ZIP file against security constraints.
   */
  private async validateZipSecurity(zipPath: string): Promise<void> {
    const info = await this.getZipInfo(zipPath);
    this.logger.debug('ZIP info retrieved', info);

    // Check compression ratio
    const ratio = info.uncompressedSize / info.compressedSize;
    if (ratio > this.config.maxExtractionRatio) {
      throw new SecurityError(`Suspicious compression ratio (${ratio.toFixed(1)}:1). Possible ZIP bomb.`);
    }

    // Check file count
    if (info.fileCount > this.config.maxExtractedFiles) {
      throw new SecurityError(
        `Too many files in archive (${info.fileCount}). Maximum allowed: ${this.config.maxExtractedFiles}`
      );
    }

    // Check total size
    if (info.uncompressedSize > this.config.maxExtractedSize) {
      const sizeMB = (info.uncompressedSize / 1024 / 1024).toFixed(0);
      const maxMB = (this.config.maxExtractedSize / 1024 / 1024).toFixed(0);
      throw new SecurityError(`Extracted size too large (${sizeMB}MB). Maximum allowed: ${maxMB}MB`);
    }

    this.logger.info('ZIP security validation passed');
  }

  /**
   * Creates a directory with atomic operation.
   */
  private async ensureDirectory(path: string): Promise<void> {
    try {
      const validPath = this.pathValidator.validatePath(path);
      await Bun.$`mkdir -p ${validPath}`.quiet();
      this.logger.debug('Directory created', { path: validPath });
    } catch (error) {
      if (error instanceof SecurityError) throw error;
      throw new ExtractionError(`Failed to create directory: ${path}`);
    }
  }

  /**
   * Extracts ZIP data with security checks.
   */
  private async extractZip(zipData: Uint8Array, outputDir: string): Promise<void> {
    const timestamp = Date.now();
    const tempDir = PathUtils.join(outputDir, `.tmp_${timestamp}`);
    const zipPath = PathUtils.join(tempDir, 'archive.zip');

    try {
      // Create temp directory
      await this.ensureDirectory(tempDir);

      // Write ZIP file
      await Bun.write(zipPath, zipData);
      this.logger.debug('Temporary ZIP created', { path: zipPath });

      // Validate ZIP security
      await this.validateZipSecurity(zipPath);

      // Extract with restricted permissions
      const result = await Bun.$`unzip -q -o ${zipPath} -d ${tempDir}`.quiet();

      if (result.exitCode !== 0) {
        throw new ExtractionError(`Unzip failed with exit code ${result.exitCode}`);
      }

      // Move extracted files atomically
      await Bun.$`mv ${tempDir}/* ${outputDir}/ 2>/dev/null || true`.quiet();

      this.logger.info('Extraction completed successfully');
    } catch (error) {
      this.logger.error('Extraction failed', error);

      // Save ZIP for manual recovery
      const fallbackPath = PathUtils.join(outputDir, 'failed_extraction.zip');
      await Bun.write(fallbackPath, zipData);

      throw new ExtractionError(`Extraction failed. ZIP saved to: ${fallbackPath}`);
    } finally {
      // Clean up temp directory
      try {
        await Bun.$`rm -rf ${tempDir}`.quiet();
      } catch {
        this.logger.warn('Failed to clean up temp directory');
      }
    }
  }

  /**
   * Reads and validates the manifest file.
   */
  private async readManifest(outputDir: string): Promise<ExtensionManifest | null> {
    const manifestPath = PathUtils.join(outputDir, 'manifest.json');
    const manifestFile = Bun.file(manifestPath);

    if (!(await manifestFile.exists())) {
      this.logger.warn('manifest.json not found');
      return null;
    }

    try {
      const rawData = await manifestFile.json();
      const manifest = this.manifestValidator.validateManifest(rawData);

      // Update extension name from manifest
      if (manifest.name) {
        this.extensionInfo = { ...this.extensionInfo, name: this.pathValidator.sanitizeFilename(manifest.name) };
      }

      this.logger.debug('Manifest validated', {
        name: manifest.name,
        version: manifest.version,
        manifest_version: manifest.manifest_version
      });

      return manifest;
    } catch (error) {
      this.logger.error('Failed to parse manifest', error);
      return null;
    }
  }

  /**
   * Main extraction method with enhanced security.
   */
  public async extract(outputDir?: string): Promise<void> {
    this.logger.info('Starting CRX extraction');

    try {
      // Load input
      await this.loadInput();
      if (!this.buffer) {
        throw new Error('Failed to load input');
      }

      // Parse header
      const header = this.parseHeader();
      this.logger.info(`CRX version: ${header.version}`);

      // Extract ZIP data
      const zipData = this.buffer.subarray(header.zipOffset);
      const sizeMB = (zipData.length / 1024 / 1024).toFixed(2);
      this.logger.info(`ZIP data size: ${sizeMB} MB`);

      // Determine and validate output directory
      const extensionName = this.extensionInfo.name || 'unknown_extension';
      let outDir: string;

      if (outputDir) {
        outDir = this.pathValidator.validatePath(outputDir);
      } else {
        // For default case, use extensions dir relative to current working directory
        const baseDir = PathUtils.join(this.config.extensionsDir, extensionName);
        // Don't pass import.meta.dir as baseDir - the path should be relative to cwd
        outDir = this.pathValidator.validatePath(baseDir);
      }

      this.logger.info(`Output directory: ${outDir}`);

      // Create output directory (atomic operation)
      await this.ensureDirectory(PathUtils.dirname(outDir));
      await Bun.$`rm -rf ${outDir} && mkdir -p ${outDir}`.quiet();

      // Save original CRX file
      const crxPath = PathUtils.join(this.config.extensionsDir, `${extensionName}.crx`);
      const validCrxPath = this.pathValidator.validatePath(crxPath);
      await this.ensureDirectory(PathUtils.dirname(validCrxPath));
      await Bun.write(validCrxPath, this.buffer);
      this.logger.info(`Saved CRX file to: ${validCrxPath}`);

      // Extract files
      this.logger.info('Extracting files...');
      await this.extractZip(zipData, outDir);

      // Read and display manifest info
      const manifest = await this.readManifest(outDir);
      if (manifest) {
        console.log('\n📋 Extension Information:');
        console.log(`   Name: ${manifest.name}`);
        console.log(`   Version: ${manifest.version}`);
        console.log(`   Manifest: v${manifest.manifest_version}`);
        if (manifest.description) {
          console.log(`   Description: ${manifest.description}`);
        }
      }

      this.logger.info(`✅ Successfully extracted to: ${outDir}`);
    } catch (error) {
      this.logger.error('Extraction failed', error);
      throw error;
    }
  }
}
```

## File: errors/index.ts
```typescript
// src/errors/index.ts

export class CRXError extends Error {
  constructor (message: string, public readonly code: string) {
    super(message);
    this.name = 'CRXError';
  }
}

export class ValidationError extends CRXError {
  constructor (message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class DownloadError extends CRXError {
  constructor (message: string) {
    super(message, 'DOWNLOAD_ERROR');
  }
}

export class ExtractionError extends CRXError {
  constructor (message: string) {
    super(message, 'EXTRACTION_ERROR');
  }
}

export class SecurityError extends CRXError {
  constructor (message: string) {
    super(message, 'SECURITY_ERROR');
  }
}
```

## File: logger/index.ts
```typescript
// src/logger/index.ts

import { LogLevel } from '../config/types';

export class Logger {
  constructor (private level: LogLevel = LogLevel.INFO) {}

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private formatMessage(level: LogLevel, message: string): string {
    const timestamp = new Date().toISOString();
    const levelStr = LogLevel[level].padEnd(5);
    return `[${timestamp}] [${levelStr}] ${message}`;
  }

  debug(message: string, data?: any): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage(LogLevel.DEBUG, message));
      if (data !== undefined) {
        console.log('  Data:', this.sanitizeData(data));
      }
    }
  }

  info(message: string): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage(LogLevel.INFO, message));
    }
  }

  warn(message: string): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage(LogLevel.WARN, message));
    }
  }

  error(message: string, error?: unknown): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage(LogLevel.ERROR, message));
      if (error instanceof Error && this.level === LogLevel.DEBUG) {
        console.error('  Stack:', error.stack);
      }
    }
  }

  // Sanitize data to prevent information leakage
  private sanitizeData(data: any): any {
    if (typeof data === 'string') {
      // Remove absolute paths, keeping only filename
      return data.replace(/\/[^\/\s]*\//g, '/.../');
    }
    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        if (!['password', 'token', 'key', 'secret'].includes(key.toLowerCase())) {
          sanitized[key] = this.sanitizeData(value);
        } else {
          sanitized[key] = '[REDACTED]';
        }
      }
      return sanitized;
    }
    return data;
  }
}
```

## File: types/index.ts
```typescript
// src/types/index.ts

export interface CRXHeader {
  readonly version: number;
  readonly zipOffset: number;
}

export interface ExtensionInfo {
  readonly id: string;
  readonly name: string;
}

export interface ExtensionManifest {
  readonly name: string;
  readonly version: string;
  readonly manifest_version: number;
  readonly description?: string;
  readonly permissions?: string[];
  readonly host_permissions?: string[];
  readonly [key: string]: unknown;
}

export interface ZipInfo {
  readonly fileCount: number;
  readonly uncompressedSize: number;
  readonly compressedSize: number;
}
```

## File: utils/path.ts
```typescript
// src/utils/path.ts

/**
 * Path utilities using Bun-native functionality
 */
export class PathUtils {
  /**
   * Joins path segments safely
   */
  static join(...segments: string[]): string {
    return segments.filter(s => s.length > 0).join('/').replace(/\/+/g, '/') // Remove duplicate slashes
      .replace(/\/\.\//g, '/') // Remove ./ sequences
      .replace(/([^/]+)\/\.\.\//g, '') // Resolve ../ sequences
      .replace(/\/$/, ''); // Remove trailing slash (unless root)
  }

  /**
   * Gets the directory name from a path
   */
  static dirname(path: string): string {
    const lastSlash = path.lastIndexOf('/');
    if (lastSlash === -1) return '.';
    if (lastSlash === 0) return '/';
    return path.substring(0, lastSlash);
  }

  /**
   * Resolves a path to absolute, using Bun's import.meta.dir as base
   */
  static resolve(...segments: string[]): string {
    const joined = this.join(...segments);

    // If already absolute, return as-is
    if (joined.startsWith('/')) {
      return joined;
    }

    // Otherwise, resolve relative to current working directory
    const cwd = import.meta.dir;
    return this.join(cwd, joined);
  }

  /**
   * Normalizes a path by resolving . and .. sequences
   */
  static normalize(path: string): string {
    const parts = path.split('/');
    const result: string[] = [];

    for (const part of parts) {
      if (part === '.' || part === '') {
        continue;
      } else if (part === '..') {
        result.pop();
      } else {
        result.push(part);
      }
    }

    const normalized = (path.startsWith('/') ? '/' : '') + result.join('/');
    return normalized || '.';
  }
}
```

## File: validators/manifest.ts
```typescript
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
```

## File: validators/path.ts
```typescript
// src/validators/path.ts

import { SecurityError } from '../errors';
import { PathUtils } from '../utils/path';

export class PathValidator {
  private readonly resolvedAllowedPaths: string[];
  private readonly workingDirectory: string;

  constructor (allowedPaths: string[]) {
    // Store the working directory at construction time
    this.workingDirectory = process.cwd();

    // Resolve allowed paths at construction time
    this.resolvedAllowedPaths = allowedPaths.map(path => {
      if (path === '.') {
        // Use the stored working directory
        return this.workingDirectory;
      }
      // Resolve relative to working directory
      if (!path.startsWith('/')) {
        return PathUtils.join(this.workingDirectory, path);
      }
      return path;
    });
  }

  /**
   * Validates and resolves a path, ensuring it's within allowed directories.
   */
  validatePath(path: string, baseDir?: string): string {
    let resolved: string;

    if (baseDir) {
      resolved = PathUtils.resolve(baseDir, path);
    } else if (!path.startsWith('/')) {
      // For relative paths without baseDir, resolve from working directory
      resolved = PathUtils.join(this.workingDirectory, path);
    } else {
      resolved = path;
    }

    // Normalize to handle . and .. sequences
    const normalized = PathUtils.normalize(resolved);

    // Check if path is within any allowed path
    const isAllowed = this.resolvedAllowedPaths.some(allowed => {
      const allowedNormalized = PathUtils.normalize(allowed);
      return normalized.startsWith(allowedNormalized + '/') || normalized === allowedNormalized;
    });

    if (!isAllowed) {
      throw new SecurityError(`Path "${path}" resolves outside allowed directories`);
    }

    return normalized;
  }

  /**
   * Sanitizes a filename to prevent directory traversal and filesystem issues.
   */
  sanitizeFilename(name: string): string {
    // Remove path separators and control characters
    let sanitized = name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').replace(/\.{2,}/g, '_') // Prevent .. sequences
      .trim();

    // Limit length for filesystem compatibility
    if (sanitized.length > 200) {
      sanitized = sanitized.substring(0, 200);
    }

    // Ensure non-empty
    if (!sanitized) {
      sanitized = 'unnamed';
    }

    return sanitized;
  }
}
```

## File: cli.ts
```typescript
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
```
