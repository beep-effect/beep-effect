/**
 * Shared filesystem, digest, JSONL, and path helpers for Corpus command pipelines.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export {
  appendCorpusJsonLines,
  basenameOf,
  dedupeBySha256,
  extensionOf,
  fileMtimeFields,
  hashFileSha256,
  jsonlContent,
  labelPathKey,
  parentDirOf,
  resolveWithinRoot,
  sanitizeSegment,
  validatePathSegment,
  writeCorpusStringFile,
} from "./ServicePrograms.js";
