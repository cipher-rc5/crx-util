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
