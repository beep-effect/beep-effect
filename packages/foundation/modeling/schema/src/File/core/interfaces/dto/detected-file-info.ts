import type { FileSignature } from "../../types/index.ts";

/**
 * Information about a detected file based on its signature
 */
export interface DetectedFileInfo {
  description: string;
  extension: string;
  mimeType: string;
  signature: FileSignature;
}
