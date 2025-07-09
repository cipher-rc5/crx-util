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
