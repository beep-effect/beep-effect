/**
 * Idempotency Key Utilities
 *
 * **Details**
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
import { Effect, Inspectable, Order, pipe } from "effect";
import * as A from "effect/Array";
import { flow } from "effect/Function";
import * as P from "effect/Predicate";
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
 * **Details**
 *
 * Only parameters that change the extraction result should be included.
 *
 * **Example** (Validate extraction params)
 *
 * ```ts
 * import { ExtractionParams } from "@effect-ontology/Utils/IdempotencyKey"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(ExtractionParams)({}))
 * ```
 *
 * @category schemas
 * @since 0.0.0
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

/**
 * Describes the extraction params data exposed by this module.
 *
 * **Example** (Decode ExtractionParams)
 *
 * ```ts
 * import { ExtractionParams } from "@effect-ontology/Utils/IdempotencyKey"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const summarizeExtractionParams = (_value: ExtractionParams): string => "valid extraction params"
 *
 * console.log(O.map(S.decodeUnknownOption(ExtractionParams)({}), summarizeExtractionParams))
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ExtractionParams = typeof ExtractionParams.Type;

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Normalize text for consistent hashing
 *
 * **Details**
 *
 * Applies deterministic transformations to ensure same logical content
 * produces same hash regardless of whitespace or formatting differences.
 *
 * **Example** (Inspect normalize text)
 *
 * ```ts
 * import { normalizeText } from "@effect-ontology/Utils/IdempotencyKey"
 *
 * console.log(normalizeText)
 * ```
 *
 * @param text - Raw input text
 * @returns Normalized text suitable for hashing
 * @category normalization
 * @since 0.0.0
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
 * **Details**
 *
 * Sorts keys and stringifies deterministically to ensure
 * same parameters produce same hash regardless of object key order.
 *
 * **Example** (Inspect hash params)
 *
 * ```ts
 * import { hashParams } from "@effect-ontology/Utils/IdempotencyKey"
 *
 * console.log(hashParams)
 * ```
 *
 * @param params - Extraction parameters
 * @returns 16-character hex hash of parameters
 * @category utilities
 * @since 0.0.0
 */
export const hashParams = (params: ExtractionParams): string => {
  const defined = pipe(
    Struct.entries(params),
    A.filter(([, value]) => P.isNotUndefined(value))
  );
  const sortedDefined = A.sort(
    defined,
    Order.mapInput(Order.String, (entry: (typeof defined)[number]) => entry[0])
  );
  return A.match(sortedDefined, {
    onEmpty: () => Str.repeat(16)("0"),
    onNonEmpty: flow(
      A.map(([key, value]) => `${key}:${Inspectable.toStringUnknown(value)}`),
      A.join("|"),
      sha256Sync
    ),
  });
};

/**
 * Compute ontology version from content
 *
 * **Details**
 *
 * Uses content-based hashing so ontology changes invalidate cached results.
 * This is more reliable than URL-based versioning.
 *
 * **Example** (Inspect compute ontology version)
 *
 * ```ts
 * import { computeOntologyVersion } from "@effect-ontology/Utils/IdempotencyKey"
 *
 * console.log(computeOntologyVersion)
 * ```
 *
 * @param ontologyContent - Serialized ontology content (Turtle, JSON-LD, etc.)
 * @returns 16-character hex hash of ontology content
 * @category utilities
 * @since 0.0.0
 */
export const computeOntologyVersion = (ontologyContent: string): string => sha256Sync(ontologyContent);

/**
 * Compute unified idempotency key
 *
 * **Details**
 *
 * This is THE key formula used everywhere:
 * - RPC primaryKey
 * - Cluster entity ID
 * - Cache lookup key
 * - Persistence directory name
 *
 * **Example** (Use computeIdempotencyKey)
 *
 * ```ts
 * import { computeIdempotencyKey, ExtractionParams } from "@effect-ontology/Utils/IdempotencyKey"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const key = O.map(
 *   S.decodeUnknownOption(ExtractionParams)({ temperature: 0.1 }),
 *   (params) => computeIdempotencyKey("John works at Apple.", "foaf", "abc123", params)
 * )
 * console.log(O.isSome(key)) // true
 * ```
 *
 * @param text - Source text for extraction
 * @param ontologyId - Ontology identifier
 * @param ontologyVersion - Content-based version hash
 * @param params - Extraction parameters (optional)
 * @returns SHA-256 idempotency key
 * @category utilities
 * @since 0.0.0
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
 * **Details**
 *
 * Useful when you need to compose with other Effects.
 *
 * **Example** (Inspect compute idempotency key effect)
 *
 * ```ts
 * import { computeIdempotencyKeyEffect } from "@effect-ontology/Utils/IdempotencyKey"
 *
 * console.log(computeIdempotencyKeyEffect)
 * ```
 *
 * @param text - Source text
 * @param ontologyId - Ontology identifier
 * @param ontologyVersion - Content-based version hash
 * @param params - Extraction parameters
 * @returns Effect yielding IdempotencyKey
 * @category utilities
 * @since 0.0.0
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
 * **Example** (Inspect is valid idempotency key)
 *
 * ```ts
 * import { isValidIdempotencyKey } from "@effect-ontology/Utils/IdempotencyKey"
 *
 * console.log(isValidIdempotencyKey)
 * ```
 *
 * @param value - String to validate
 * @returns true if valid idempotency key format
 * @category predicates
 * @since 0.0.0
 */
export const isValidIdempotencyKey = IdempotencyKey.is;

/**
 * Parse string to IdempotencyKey with validation
 *
 * **Example** (Inspect parse idempotency key)
 *
 * ```ts
 * import { parseIdempotencyKey } from "@effect-ontology/Utils/IdempotencyKey"
 *
 * console.log(parseIdempotencyKey)
 * ```
 *
 * @param input - Unknown value decoded as an idempotency key.
 * @returns Effect yielding IdempotencyKey or failing with ParseError
 * @category parsing
 * @since 0.0.0
 */
export const parseIdempotencyKey = (input: unknown) => IdempotencyKey.decodeUnknownEffect(input);

// =============================================================================
// Short Key (for display/logging)
// =============================================================================

/**
 * Get short version of key for display purposes
 *
 * **Example** (Inspect short key)
 *
 * ```ts
 * import { shortKey } from "@effect-ontology/Utils/IdempotencyKey"
 *
 * console.log(shortKey)
 * ```
 *
 * @param key - Full idempotency key
 * @returns First 12 characters of key
 * @category utilities
 * @since 0.0.0
 */
export const shortKey: (key: IdempotencyKey) => string = Str.slice(0, 12);

/**
 * Format key for logging with prefix
 *
 * **Example** (Inspect format key for log)
 *
 * ```ts
 * import { formatKeyForLog } from "@effect-ontology/Utils/IdempotencyKey"
 *
 * console.log(formatKeyForLog)
 * ```
 *
 * @param key - Full idempotency key
 * @returns Formatted string like "run-abc123def456"
 * @category formatting
 * @since 0.0.0
 */
export const formatKeyForLog = (key: IdempotencyKey): string => `run-${shortKey(key)}`;
