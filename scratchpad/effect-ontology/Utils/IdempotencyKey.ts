/**
 * Idempotency Key Utilities
 *
 * Provides a unified idempotency key that propagates through all layers:
 * RPC → Cluster Entity → Cache → Persistence
 *
 * Key formula: sha256(normalizedText + ontologyId + ontologyVersion + paramsHash)
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { PosInt } from "@beep/schema/Int";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as Struct from "@beep/utils/Struct";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { IdempotencyKey } from "../Domain/Identity.ts";
import { dual4 } from "./Dual.ts";
import { sha256Sync, sha256SyncFull } from "./Hash.ts";

const $I = $ScratchpadId.create("effect-ontology/Utils/IdempotencyKey");

// =============================================================================
// Types
// =============================================================================

export { IdempotencyKey };

/**
 * Extraction parameters that affect output
 *
 * Only parameters that change the extraction result should be included.
 */
export const ExtractionParams = S.Struct({
  maxTokens: PosInt.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  temperature: S.Finite.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  includeConfidence: S.optionalKey(S.Boolean),
  groundingThreshold: UnitInterval.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
}).pipe(
  $I.annoteSchema("ExtractionParams", {
    description: "Parameters that affect extraction output",
  })
);

export type ExtractionParams = typeof ExtractionParams.Type;

const encodeUnknownJson = S.encodeSync(S.fromJsonString(S.Unknown));

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Normalize text for consistent hashing
 *
 * Applies deterministic transformations to ensure same logical content
 * produces same hash regardless of whitespace or formatting differences.
 *
 * @param text - Raw input text
 * @returns Normalized text suitable for hashing
 */
export const normalizeText = flow(
  Str.trim,
  Str.toLowerCase,
  Str.replace(/\s+/g, " "), // Collapse whitespace
  Str.replace(/[\r\n]+/g, " ") // Normalize line endings
);

/**
 * Create stable hash of extraction parameters
 *
 * Sorts keys and stringifies deterministically to ensure
 * same parameters produce same hash regardless of object key order.
 *
 * @param params - Extraction parameters
 * @returns 16-character hex hash of parameters
 */
export const hashParams = (params: ExtractionParams): string => {
  // Only include defined values
  const defined = Struct.entries(params)
    .filter(([_, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b));

  if (defined.length === 0) {
    return "0".repeat(16);
  }

  const sorted = defined.map(([k, v]) => `${k}:${encodeUnknownJson(v)}`).join("|");

  return sha256Sync(sorted);
};

/**
 * Compute ontology version from content
 *
 * Uses content-based hashing so ontology changes invalidate cached results.
 * This is more reliable than URL-based versioning.
 *
 * @param ontologyContent - Serialized ontology content (Turtle, JSON-LD, etc.)
 * @returns 16-character hex hash of ontology content
 */
export const computeOntologyVersion = (ontologyContent: string): string => sha256Sync(ontologyContent);

/**
 * Compute unified idempotency key
 *
 * This is THE key formula used everywhere:
 * - RPC primaryKey
 * - Cluster entity ID
 * - Cache lookup key
 * - Persistence directory name
 *
 * @param text - Source text for extraction
 * @param ontologyId - Ontology identifier
 * @param ontologyVersion - Content-based version hash
 * @param params - Extraction parameters (optional)
 * @returns SHA-256 idempotency key
 *
 * **Example** (Use computeIdempotencyKey)
 * ```ts
 * const key = computeIdempotencyKey(
 *   "John works at Apple.",
 *   "foaf",
 *   "abc123...",
 *   { temperature: 0.1 }
 * )
 * // Returns: "7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069"
 * ```
 */
export const computeIdempotencyKey = dual4(
  (text: string, ontologyId: string, ontologyVersion: string, params: ExtractionParams): IdempotencyKey => {
    const normalized = normalizeText(text);
    const paramsHash = hashParams(params);

    const input = `${normalized}|${ontologyId}|${ontologyVersion}|${paramsHash}`;
    const hash = sha256SyncFull(input);

    return IdempotencyKey.make(hash);
  }
);

/**
 * Compute idempotency key as Effect
 *
 * Useful when you need to compose with other Effects.
 *
 * @param text - Source text
 * @param ontologyId - Ontology identifier
 * @param ontologyVersion - Content-based version hash
 * @param params - Extraction parameters
 * @returns Effect yielding IdempotencyKey
 */
export const computeIdempotencyKeyEffect = dual4(
  (
    text: string,
    ontologyId: string,
    ontologyVersion: string,
    params: ExtractionParams
  ): Effect.Effect<IdempotencyKey> =>
    Effect.sync(() => computeIdempotencyKey(text, ontologyId, ontologyVersion, params))
);

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate that a string is a valid idempotency key
 *
 * @param value - String to validate
 * @returns true if valid idempotency key format
 */
export const isValidIdempotencyKey = IdempotencyKey.is;

/**
 * Parse string to IdempotencyKey with validation
 *
 * @param value - String to parse
 * @returns Effect yielding IdempotencyKey or failing with ParseError
 */
export const parseIdempotencyKey = (input: unknown) => S.decodeUnknownEffect(IdempotencyKey)(input);

// =============================================================================
// Short Key (for display/logging)
// =============================================================================

/**
 * Get short version of key for display purposes
 *
 * @param key - Full idempotency key
 * @returns First 12 characters of key
 */
export const shortKey: (key: IdempotencyKey) => string = Str.slice(0, 12);

/**
 * Format key for logging with prefix
 *
 * @param key - Full idempotency key
 * @returns Formatted string like "run-abc123def456"
 */
export const formatKeyForLog = (key: IdempotencyKey): string => `run-${shortKey(key)}`;
