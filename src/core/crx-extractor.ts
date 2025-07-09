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
