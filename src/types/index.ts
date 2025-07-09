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
