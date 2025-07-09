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
