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
