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
 * Optional extraction knobs that change output and therefore enter the
 * idempotency key: max tokens, temperature, confidence, and grounding
 * threshold.
 *
 * **Example** (Accept a temperature and reject a non-finite)
 *
 * ```ts
 * import { ExtractionParams } from "@effect-ontology/Utils/IdempotencyKey"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * console.log(O.isSome(S.decodeUnknownOption(ExtractionParams)({ temperature: 0.1 }))) // true
 * console.log(O.isNone(S.decodeUnknownOption(ExtractionParams)({ temperature: Number.NaN }))) // true
 * ```
 *
 * @see {@link computeIdempotencyKey} for hashing these params into a run key.
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
 * Decoded extraction knobs produced by {@link ExtractionParams}.
 *
 * @see {@link ExtractionParams} for the runtime schema and optional-key decoding.
 * @category type-level
 * @since 0.0.0
 */
export type ExtractionParams = typeof ExtractionParams.Type;

// =============================================================================
// Core Functions
// =============================================================================

/**
 * Trims, lowercases, and collapses whitespace so logically identical source
 * text hashes to the same idempotency key.
 *
 * **Example** (Normalize mixed whitespace)
 *
 * ```ts
 * import { normalizeText } from "@effect-ontology/Utils/IdempotencyKey"
 *
 * console.log(normalizeText("  Ada\nLovelace  ")) // "ada lovelace"
 * ```
 *
 * @see {@link computeIdempotencyKey} for the constructor that hashes this normalized text.
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
 * Hashes defined extraction parameters into a 16-character hex digest.
 *
 * **Details**
 *
 * Keys are sorted so object insertion order cannot change the digest. An
 * empty parameter set hashes to sixteen zeros.
 *
 * **Example** (Hash empty and temperature params)
 *
 * ```ts
 * import { ExtractionParams, hashParams } from "@effect-ontology/Utils/IdempotencyKey"
 * import * as S from "effect/Schema"
 *
 * const empty = S.decodeUnknownSync(ExtractionParams)({})
 * const withTemp = S.decodeUnknownSync(ExtractionParams)({ temperature: 0.1 })
 * console.log(hashParams(empty).length) // 16
 * console.log(hashParams(withTemp) !== hashParams(empty)) // true
 * ```
 *
 * @returns 16-character hex hash of sorted defined parameters.
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
 * Content-hashes serialized ontology text into a 16-character version token.
 *
 * **Example** (Version Turtle content)
 *
 * ```ts
 * import { computeOntologyVersion } from "@effect-ontology/Utils/IdempotencyKey"
 *
 * const version = computeOntologyVersion("@prefix foaf: <http://xmlns.com/foaf/0.1/> .")
 * console.log(version.length) // 16
 * ```
 *
 * @returns 16-character hex hash of ontology content.
 * @see {@link computeIdempotencyKey} for combining this version with source text.
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
 * @see {@link computeIdempotencyKeyEffect} for the Effect-returning twin.
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
 * Effect-returning twin of {@link computeIdempotencyKey}.
 *
 * **Example** (Match the synchronous constructor)
 *
 * ```ts
 * import { computeIdempotencyKey, computeIdempotencyKeyEffect, ExtractionParams } from "@effect-ontology/Utils/IdempotencyKey"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const params = S.decodeUnknownSync(ExtractionParams)({ temperature: 0.1 })
 * const syncKey = computeIdempotencyKey("Ada works at Apple.", "foaf", "abc123", params)
 * const effectKey = Effect.runSync(
 *   computeIdempotencyKeyEffect("Ada works at Apple.", "foaf", "abc123", params)
 * )
 * console.log(syncKey === effectKey) // true
 * ```
 *
 * @see {@link computeIdempotencyKey} for the synchronous constructor.
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
 * Returns whether a string is a 64-character SHA-256 idempotency key.
 *
 * **Example** (Guard a computed key)
 *
 * ```ts
 * import { computeIdempotencyKey, ExtractionParams, isValidIdempotencyKey } from "@effect-ontology/Utils/IdempotencyKey"
 * import * as S from "effect/Schema"
 *
 * const key = computeIdempotencyKey(
 *   "Ada works at Apple.",
 *   "foaf",
 *   "abc123",
 *   S.decodeUnknownSync(ExtractionParams)({})
 * )
 * console.log(isValidIdempotencyKey(key)) // true
 * console.log(isValidIdempotencyKey("not-a-key")) // false
 * ```
 *
 * @see {@link parseIdempotencyKey} for Effect decoding that fails on invalid input.
 * @category predicates
 * @since 0.0.0
 */
export const isValidIdempotencyKey = IdempotencyKey.is;

/**
 * Decodes an unknown value as a branded {@link IdempotencyKey}.
 *
 * **Example** (Parse a computed key)
 *
 * ```ts
 * import { computeIdempotencyKey, ExtractionParams, parseIdempotencyKey } from "@effect-ontology/Utils/IdempotencyKey"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const key = computeIdempotencyKey(
 *   "Ada works at Apple.",
 *   "foaf",
 *   "abc123",
 *   S.decodeUnknownSync(ExtractionParams)({})
 * )
 * console.log(Effect.runSync(parseIdempotencyKey(key)) === key) // true
 * ```
 *
 * @see {@link isValidIdempotencyKey} for the boolean guard.
 * @category parsing
 * @since 0.0.0
 */
export const parseIdempotencyKey = (input: unknown) => IdempotencyKey.decodeUnknownEffect(input);

// =============================================================================
// Short Key (for display/logging)
// =============================================================================

/**
 * Takes the first 12 characters of an idempotency key for compact display.
 *
 * **Example** (Shorten a 64-character key)
 *
 * ```ts
 * import { computeIdempotencyKey, ExtractionParams, shortKey } from "@effect-ontology/Utils/IdempotencyKey"
 * import * as S from "effect/Schema"
 *
 * const key = computeIdempotencyKey(
 *   "Ada works at Apple.",
 *   "foaf",
 *   "abc123",
 *   S.decodeUnknownSync(ExtractionParams)({})
 * )
 * console.log(shortKey(key).length) // 12
 * console.log(key.startsWith(shortKey(key))) // true
 * ```
 *
 * @see {@link formatKeyForLog} for the `run-` prefixed log form.
 * @category utilities
 * @since 0.0.0
 */
export const shortKey: (key: IdempotencyKey) => string = Str.slice(0, 12);

/**
 * Formats an idempotency key as `run-` plus the 12-character short form.
 *
 * **Example** (Prefix a short key for logs)
 *
 * ```ts
 * import { computeIdempotencyKey, ExtractionParams, formatKeyForLog, shortKey } from "@effect-ontology/Utils/IdempotencyKey"
 * import * as S from "effect/Schema"
 *
 * const key = computeIdempotencyKey(
 *   "Ada works at Apple.",
 *   "foaf",
 *   "abc123",
 *   S.decodeUnknownSync(ExtractionParams)({})
 * )
 * console.log(formatKeyForLog(key) === `run-${shortKey(key)}`) // true
 * console.log(formatKeyForLog(key).startsWith("run-")) // true
 * ```
 *
 * @see {@link shortKey} for the unprefixed 12-character slice.
 * @category formatting
 * @since 0.0.0
 */
export const formatKeyForLog = (key: IdempotencyKey): string => `run-${shortKey(key)}`;
