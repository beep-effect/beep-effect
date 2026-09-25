/**
 * Extraction and durable-patch contracts.
 *
 * **Details**
 *
 * L1 archive items are pipeline artifacts, not the product Archive layer.
 * Working observations are short-term candidates. `LifecycleState.working` is
 * in-flight extraction, not a stored layer, and `context_only` is not a tier.
 *
 * @since 0.0.0
 */
import { createHash } from "node:crypto";
import { sql } from "drizzle-orm";
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import type { ExtraConfigColumn } from "drizzle-orm/pg-core";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Predicate from "effect/Predicate";
import * as Rec from "effect/Record";
import * as S from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { Model, UtcTimestamp, optionalNull, optionalTimestamp, pg } from "./Kit.ts";

const isJson = S.is(S.Json);
const isJsonObject = S.is(S.JsonObject);

const $I = $ScratchpadId.create("beep/MemoryContracts");

const described = <Sch extends S.Top>(schema: Sch, description: string) => schema.annotateKey({ description });

const stringOrder = Order.make<string>((self, that) => {
  if (self < that) return -1;
  if (that < self) return 1;
  return 0;
});

const blank = (value: string): boolean => Str.isEmpty(Str.trim(value));

const strippedText = S.String.pipe(
  S.decodeTo(S.String.check(S.isMinLength(1)), {
    decode: SchemaGetter.transform((value: string) => Str.trim(value)),
    encode: SchemaGetter.transform((value: string) => value),
  }),
);

const textDefault = (column: string, value: string) =>
  S.String.pipe(S.withConstructorDefault(Effect.succeed(value)), pg.text(), pg.columnName(column));

const stringList = (column: string) =>
  S.Array(S.String).pipe(S.withConstructorDefault(Effect.succeed([])), pg.jsonb(), pg.columnName(column));

const jsonList = (column: string) =>
  S.Array(S.JsonObject).pipe(S.withConstructorDefault(Effect.succeed([])), pg.jsonb(), pg.columnName(column));

const jsonDefault = (column: string) =>
  S.JsonObject.pipe(S.withConstructorDefault(Effect.succeed({})), pg.jsonb(), pg.columnName(column));

const betweenCheck = (column: ExtraConfigColumn, name: string, minimum: number, maximum: number) =>
  pg.Table.check(name)(
    sql<boolean>`${column} >= ${sql.raw(String(minimum))} and ${column} <= ${sql.raw(String(maximum))}`,
  );

const instant = (column: string) =>
  UtcTimestamp.pipe(pg.timestamp({ mode: "string", withTimezone: true }), pg.columnName(column));

const optionalInstant = optionalTimestamp;

const closed = <const L extends readonly [string, ...ReadonlyArray<string>]>(
  literals: L,
  name: string,
  description: string,
) => LiteralKit(literals).pipe($I.annoteSchema(name, { description }));

const kitDefault = (literals: ReadonlyArray<string>, value: string, column: string) => {
  const allowed = HashSet.fromIterable(literals);
  return S.String.check(
    S.makeFilter((input: string) => HashSet.has(allowed, input), {
      identifier: `Closed_${column}`,
      title: column,
      message: `${column} is not an allowed value`,
    }),
  ).pipe(S.withConstructorDefault(Effect.succeed(value)), pg.text(), pg.columnName(column));
};

const aliasTo = (
  aliases: Rec.ReadonlyRecord<string, string>,
  allowed: HashSet.HashSet<string>,
  fallback: string,
) =>
  (value: string): string => {
    const normalized = Str.toLowerCase(Str.trim(Str.isEmpty(value) ? fallback : value));
    const mapped = Rec.get(aliases, normalized);
    const candidate = O.getOrElse(mapped, () => normalized);
    return HashSet.has(allowed, candidate) ? candidate : fallback;
  };

const hex4 = (code: number): string => Str.padStart(4, "0")(code.toString(16));

const jsonString = (value: string): string => {
  const codes: Array<number> = [];
  let index = 0;
  while (index < value.length) {
    const code = value.codePointAt(index);
    if (Predicate.isUndefined(code)) break;
    codes.push(code);
    index = index + (code > 65535 ? 2 : 1);
  }
  return `"${A.join("")(
    A.map(codes, (code) => {
      if (Equal.equals(code, 34)) return "\\\"";
      if (Equal.equals(code, 92)) return "\\\\";
      if (Equal.equals(code, 8)) return "\\b";
      if (Equal.equals(code, 12)) return "\\f";
      if (Equal.equals(code, 10)) return "\\n";
      if (Equal.equals(code, 13)) return "\\r";
      if (Equal.equals(code, 9)) return "\\t";
      if (code < 32 || code > 126) {
        if (code > 65535) {
          const shifted = code - 65536;
          const high = 55296 + Math.floor(shifted / 1024);
          const low = 56320 + (shifted % 1024);
          return `\\u${hex4(high)}\\u${hex4(low)}`;
        }
        return `\\u${hex4(code)}`;
      }
      return String.fromCodePoint(code);
    }),
  )}"`;
};

const jsonNumber = (value: number): string => (Number.isFinite(value) ? String(value) : "null");

const jsonChild = (found: unknown): S.Json => (isJson(found) ? found : null);

/**
 * Compact JSON with sorted object keys.
 *
 * **Details**
 *
 * This is the byte format behind {@link deterministicContractId}. `null`,
 * booleans, numbers, strings, arrays, and objects are encoded without spaces. Array order is preserved, and non-finite numbers
 * and non-JSON children encode as `null`.
 *
 * **Example** (Sort object keys)
 *
 * ```ts
 * import { canonicalJson } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * console.log(canonicalJson({ b: 1, a: "x" })) // {"a":"x","b":1}
 * console.log(canonicalJson({ tags: ["z", "a"], ok: true })) // {"ok":true,"tags":["z","a"]}
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const canonicalJson = (value: S.Json): string => {
  if (Predicate.isNull(value)) return "null";
  if (Predicate.isBoolean(value)) return value ? "true" : "false";
  if (Predicate.isNumber(value)) return jsonNumber(value);
  if (Predicate.isString(value)) return jsonString(value);
  if (A.isArray(value)) return `[${A.join(",")(A.map(value, (item) => canonicalJson(jsonChild(item))))}]`;
  if (!Predicate.isObject(value)) return "null";
  const keys = A.sort(Rec.keys(value), stringOrder);
  return `{${A.join(",")(
    A.map(keys, (key) => {
      const child = O.match(Rec.get(value, key), { onNone: () => null, onSome: jsonChild });
      return `${jsonString(key)}:${canonicalJson(child)}`;
    }),
  )}}`;
};

const secretFlags = HashSet.make("secret", "credential", "pii_secret", "security_sensitive");

const hasSecret = (flags: ReadonlyArray<string>): boolean =>
  HashSet.size(HashSet.intersection(secretFlags, HashSet.fromIterable(A.map(flags, Str.toLowerCase)))) > 0;

const medium = "medium";
const general = "general";
const working = "working";
const shortTerm = "short_term";
const fact = "fact";
const primaryUser = "primary_user";
const unclear = "unclear";
const unknown = "unknown";
const literalLevel = "literal";
const semantic = "semantic";
const sessionLocal = "session-local";
const archiveLabel = "archived_evidence_not_stable_memory";
const privateVisibility = "private";

/**
 * Neutral fact-source string for durable-patch ledger writes.
 *
 * **Example** (Read the frozen source name)
 *
 * ```ts
 * import { DURABLE_MEMORY_PATCH_FACT_SOURCE } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * console.log(DURABLE_MEMORY_PATCH_FACT_SOURCE) // "durable_memory_patch"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DURABLE_MEMORY_PATCH_FACT_SOURCE = "durable_memory_patch";

/**
 * Ledger content cap copied from product memory.
 *
 * **Example** (Read the content cap)
 *
 * ```ts
 * import { MAX_LEDGER_CONTENT_CHARACTERS } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * console.log(MAX_LEDGER_CONTENT_CHARACTERS) // 4000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_LEDGER_CONTENT_CHARACTERS = 4000;

/**
 * Ledger document body cap.
 *
 * **Example** (Read the body cap)
 *
 * ```ts
 * import { MAX_LEDGER_PLAYBOOK_BODY_CHARACTERS } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * console.log(MAX_LEDGER_PLAYBOOK_BODY_CHARACTERS) // 24000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_LEDGER_PLAYBOOK_BODY_CHARACTERS = 24000;

/**
 * Ledger slot cap.
 *
 * **Example** (Read the slot cap)
 *
 * ```ts
 * import { MAX_LEDGER_SLOT_CHARACTERS } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * console.log(MAX_LEDGER_SLOT_CHARACTERS) // 64
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_LEDGER_SLOT_CHARACTERS = 64;

/**
 * Ledger trigger-condition key cap, including one action object.
 *
 * **Example** (Read the key cap)
 *
 * ```ts
 * import { MAX_LEDGER_TRIGGER_CONDITION_KEYS } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * console.log(MAX_LEDGER_TRIGGER_CONDITION_KEYS) // 13
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_LEDGER_TRIGGER_CONDITION_KEYS = 13;

/**
 * Serialized ledger trigger-condition cap.
 *
 * **Example** (Read the serialized cap)
 *
 * ```ts
 * import { MAX_LEDGER_TRIGGER_CONDITION_CHARACTERS } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * console.log(MAX_LEDGER_TRIGGER_CONDITION_CHARACTERS) // 8000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MAX_LEDGER_TRIGGER_CONDITION_CHARACTERS = 8000;

/**
 * Legacy product tier wire used by patches and candidates.
 *
 * **Details**
 *
 * Direct `long_term` creation is rejected unless the patch is a knowledge-ledger
 * row. Promotion, not this field, is how a short-term item becomes long-term.
 *
 * **Example** (Decode short-term)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MemoryTier } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(MemoryTier)("short_term"))
 * console.log(decoded) // "short_term"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryTier = closed(["short_term", "long_term", "archive"], "MemoryTier", "Legacy product tier wire.");

/**
 * Decoded legacy tier.
 *
 * @see {@link MemoryTier} for why long-term is not a create-time option.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryTier = typeof MemoryTier.Type;

/**
 * Knowledge-ledger kind. Not a product layer.
 *
 * **Example** (Decode a fact)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MemoryKind } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(MemoryKind)("fact"))
 * console.log(decoded) // "fact"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemoryKind = closed(["fact", "document", "trigger"], "MemoryKind", "Knowledge-ledger kind.");

/**
 * Decoded ledger kind.
 *
 * @see {@link MemoryKind} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type MemoryKind = typeof MemoryKind.Type;

/**
 * Who a ledger row is about.
 *
 * **Example** (Decode the primary user)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { MemorySubjectScope } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(MemorySubjectScope)("primary_user"))
 * console.log(decoded) // "primary_user"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MemorySubjectScope = closed(
  ["primary_user", "user_owned_project", "user_relationship", "third_party"],
  "MemorySubjectScope",
  "Ledger subject scope.",
);

/**
 * Decoded subject scope.
 *
 * @see {@link MemorySubjectScope} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type MemorySubjectScope = typeof MemorySubjectScope.Type;

/**
 * Why a ledger row was written.
 *
 * **Example** (Decode a legacy migration)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { LedgerWriteReason } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(LedgerWriteReason)("legacy_migration"))
 * console.log(decoded) // "legacy_migration"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LedgerWriteReason = closed(
  [
    "direct_user_statement",
    "explicit_remember",
    "agent_reusable_conclusion",
    "recurring_workflow",
    "standing_trigger",
    "onboarding",
    "daily_reconciliation",
    "legacy_migration",
  ],
  "LedgerWriteReason",
  "Why a knowledge-ledger row was written.",
);

/**
 * Decoded ledger write reason.
 *
 * @see {@link LedgerWriteReason} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type LedgerWriteReason = typeof LedgerWriteReason.Type;

/**
 * In-flight and settled extraction status.
 *
 * **Details**
 *
 * `working` is in-flight extraction, not a stored product layer. `context_only`
 * is not a tier. On a durable patch, `active` and `review` require evidence.
 *
 * **Example** (Decode working)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { LifecycleState } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(LifecycleState)("working"))
 * console.log(decoded) // "working"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LifecycleState = closed(
  ["working", "active", "context_only", "review", "superseded", "rejected", "hidden"],
  "LifecycleState",
  "Extraction lifecycle. working is in-flight, not a product layer.",
);

/**
 * Decoded lifecycle state.
 *
 * @see {@link LifecycleState} for why working is not a layer.
 * @category type-level
 * @since 0.0.0
 */
export type LifecycleState = typeof LifecycleState.Type;

const isLifecycleState = S.is(LifecycleState);

/**
 * What a durable patch proposes to do.
 *
 * **Details**
 *
 * `merge`, `update`, `add_evidence`, and `skip_duplicate` require a target id.
 * `add` requires text or a new id. The other decisions do not add fields.
 *
 * **Example** (Decode an add)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { DurablePatchDecision } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(DurablePatchDecision)("add"))
 * console.log(decoded) // "add"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DurablePatchDecision = closed(
  ["add", "update", "merge", "add_evidence", "keep_both", "skip_duplicate", "context_only", "reject", "review"],
  "DurablePatchDecision",
  "Durable patch decision. Some decisions require a target or text.",
);

/**
 * Decoded patch decision.
 *
 * @see {@link DurablePatchDecision} for which decisions require a target.
 * @category type-level
 * @since 0.0.0
 */
export type DurablePatchDecision = typeof DurablePatchDecision.Type;

/**
 * Coarse confidence word shared by archive items, observations, and routes.
 *
 * **Example** (Decode medium)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { ConfidenceBand } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(ConfidenceBand)("medium"))
 * console.log(decoded) // "medium"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ConfidenceBand = closed(["high", "medium", "low"], "ConfidenceBand", "high, medium, or low confidence.");

/**
 * Decoded confidence band.
 *
 * @see {@link ConfidenceBand} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type ConfidenceBand = typeof ConfidenceBand.Type;

/**
 * Pipeline archive class. Not the product Archive layer.
 *
 * **Example** (Decode general)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { L1MemoryArchiveClass } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(L1MemoryArchiveClass)("general"))
 * console.log(decoded) // "general"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const L1MemoryArchiveClass = closed(
  ["general", "sensitive"],
  "L1MemoryArchiveClass",
  "Pipeline archive class. Not the product Archive layer.",
);

/**
 * Decoded pipeline archive class.
 *
 * @see {@link L1MemoryArchiveClass} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type L1MemoryArchiveClass = typeof L1MemoryArchiveClass.Type;

/**
 * Why a consolidation route drops a candidate.
 *
 * **Example** (Decode a duplicate drop)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { L2DropReason } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(L2DropReason)("duplicate"))
 * console.log(decoded) // "duplicate"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const L2DropReason = closed(
  [
    "ephemeral_chatter",
    "third_party_or_unknown_speaker",
    "ui_or_ocr_context",
    "unsupported_or_too_noisy",
    "secret_or_security_sensitive",
    "duplicate",
    "not_future_useful",
    "missing_user_tie",
  ],
  "L2DropReason",
  "Why a discard or hidden consolidation route drops a candidate.",
);

/**
 * Decoded drop reason.
 *
 * @see {@link L2DropReason} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type L2DropReason = typeof L2DropReason.Type;

/**
 * Strict extraction failed before a valid batch.
 *
 * **Details**
 *
 * Callers can handle this without an LLM client. The working-observation
 * failure is a separate tag with the same idea, not a subclass.
 *
 * **Example** (Name the extractor)
 *
 * ```ts
 * import { memoryExtractionError } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const error = memoryExtractionError("batch")
 * console.log(error.extractor) // "batch"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MemoryExtractionError extends S.TaggedError<MemoryExtractionError>()(
  "MemoryExtractionError",
  { extractor: S.String, message: S.String },
  $I.annoteError<MemoryExtractionError>("MemoryExtractionError", {
    description: "A strict memory extraction failed before a valid batch.",
  }),
) {}

/**
 * Encoded form of {@link MemoryExtractionError}.
 *
 * @see {@link MemoryExtractionError} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryExtractionError {
  export type Encoded = S.Codec.Encoded<typeof MemoryExtractionError>;
}

/**
 * Build a strict extraction failure.
 *
 * **Details**
 *
 * Leave `options.message` out to get the default
 * `<extractor> failed before producing a valid extraction result` message.
 * The options sit in an object, not a bare string, so the data-last form
 * (options first, extractor piped in) stays distinguishable from the
 * data-first call.
 *
 * **Example** (Use the default message)
 *
 * ```ts
 * import { memoryExtractionError } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * console.log(memoryExtractionError("batch").message) // "batch failed before producing a valid extraction result"
 * ```
 *
 * **Example** (Pipe an extractor name with a custom message)
 *
 * ```ts
 * import { pipe } from "effect/Function"
 * import { memoryExtractionError } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const error = pipe("batch", memoryExtractionError({ message: "no JSON object" }))
 * console.log(error.extractor) // "batch"
 * console.log(error.message) // "no JSON object"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const memoryExtractionError: {
  (options?: { readonly message?: string }): (extractor: string) => MemoryExtractionError;
  (extractor: string, options?: { readonly message?: string }): MemoryExtractionError;
} = dual(
  (args) => Predicate.isString(args[0]),
  (extractor: string, options?: { readonly message?: string }): MemoryExtractionError => {
    const message = options?.message;
    return MemoryExtractionError.make({
      extractor,
      message: Predicate.isString(message) ? message : `${extractor} failed before producing a valid extraction result`,
    });
  },
);

/**
 * A strict L1 extraction failed before a valid batch.
 *
 * **Details**
 *
 * This is the working-observation failure. The extractor name stays
 * `working_observation_extractor`.
 *
 * **Example** (Name the stage)
 *
 * ```ts
 * import { workingObservationExtractionError } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * console.log(workingObservationExtractionError("parse").stage) // "parse"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class WorkingObservationExtractionError extends S.TaggedError<WorkingObservationExtractionError>()(
  "WorkingObservationExtractionError",
  { stage: S.String, extractor: S.String, message: S.String },
  $I.annoteError<WorkingObservationExtractionError>("WorkingObservationExtractionError", {
    description: "A strict working-observation extraction failed before a valid batch.",
  }),
) {}

/**
 * Encoded form of {@link WorkingObservationExtractionError}.
 *
 * @see {@link WorkingObservationExtractionError} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace WorkingObservationExtractionError {
  export type Encoded = S.Codec.Encoded<typeof WorkingObservationExtractionError>;
}

/**
 * Build an L1 extraction failure for one stage.
 *
 * **Example** (Include the stage in the message)
 *
 * ```ts
 * import { workingObservationExtractionError } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const error = workingObservationExtractionError("parse")
 * console.log(error.extractor) // "working_observation_extractor"
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const workingObservationExtractionError = (stage: string): WorkingObservationExtractionError =>
  WorkingObservationExtractionError.make({
    stage,
    extractor: "working_observation_extractor",
    message: `working observation extraction failed during ${stage}`,
  });

/**
 * Contract rule that failed.
 *
 * **Example** (Build a contract error)
 *
 * ```ts
 * import { MemoryContractError } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * console.log(MemoryContractError.make({ message: "unknown lifecycle status" }).message) // "unknown lifecycle status"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MemoryContractError extends S.TaggedError<MemoryContractError>()(
  "MemoryContractError",
  { message: S.String },
  $I.annoteError<MemoryContractError>("MemoryContractError", {
    description: "A memory contract rule rejected the value.",
  }),
) {}

/**
 * Encoded form of {@link MemoryContractError}.
 *
 * @see {@link MemoryContractError} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace MemoryContractError {
  export type Encoded = S.Codec.Encoded<typeof MemoryContractError>;
}

/**
 * Map a lifecycle status and risk flags to an allowed-use string.
 *
 * **Details**
 *
 * A secret risk flag, or `hidden`, yields `hidden`. Otherwise the stable map
 * is `read_with_status`, `stable_profile_fact`, `context_only`, `review_only`,
 * `history_only`, or `audit_only`.
 *
 * **Example** (Hide a credential)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { deriveAllowedUse } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * console.log(Effect.runSync(deriveAllowedUse("active", ["credential"]))) // "hidden"
 * ```
 *
 * @category mapping
 * @since 0.0.0
 */
export const deriveAllowedUse = Effect.fn("MemoryContracts.deriveAllowedUse")(function* (
  status: string,
  riskFlags: ReadonlyArray<string> = [],
) {
  if (!isLifecycleState(status)) {
    return yield* MemoryContractError.make({ message: `unknown lifecycle status: ${status}` });
  }
  if (Equal.equals(status, "hidden") || hasSecret(riskFlags)) return "hidden";
  if (Equal.equals(status, "working")) return "read_with_status";
  if (Equal.equals(status, "active")) return "stable_profile_fact";
  if (Equal.equals(status, "context_only")) return "context_only";
  if (Equal.equals(status, "review")) return "review_only";
  if (Equal.equals(status, "superseded")) return "history_only";
  if (Equal.equals(status, "rejected")) return "audit_only";
  return "hidden";
});

/**
 * SHA-256 hex of `namespace|canonicalJson(payload)`.
 *
 * **Details**
 *
 * Object keys are sorted. `null`, booleans, numbers, strings, arrays, and
 * objects follow compact JSON. This is the shared id primitive for commits,
 * outbox rows, archive ids, and content hashes.
 *
 * **Example** (Hash a sorted object)
 *
 * ```ts
 * import { deterministicContractId } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const digest = deterministicContractId("ns", { b: 1, a: ["x", { c: true, d: null }] })
 * console.log(digest) // "7e1ebfaf1e083d7d76033d7199cc8f81eabd84525bdee981115eea2a4daac83a"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const deterministicContractId: {
  (payload: S.JsonObject): (namespace: string) => string;
  (namespace: string, payload: S.JsonObject): string;
} = dual(
  2,
  (namespace: string, payload: S.JsonObject): string =>
    createHash("sha256").update(`${namespace}|${canonicalJson(payload)}`, "utf8").digest("hex"),
);

/**
 * One evidence pointer carried on a durable patch.
 *
 * **Example** (Omit the quote)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { EvidenceRef } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(EvidenceRef)({ evidenceId: "ev-1", quote: null, artifactRef: {} }))
 * console.log(O.isNone(decoded.quote)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EvidenceRef extends Model<EvidenceRef>("EvidenceRef")(
  {
    evidenceId: described(S.String, "Evidence id.").pipe(pg.text(), pg.columnName("evidence_id")),
    sourceId: optionalNull(S.String).pipe(pg.text(), pg.columnName("source_id")),
    sourceType: optionalNull(S.String).pipe(pg.text(), pg.columnName("source_type")),
    quote: optionalNull(S.String).pipe(pg.text(), pg.columnName("quote")),
    artifactRef: jsonDefault("artifact_ref"),
  },
  $I.annote("EvidenceRef", { description: "Evidence pointer on a durable patch." }),
) {}

/**
 * Encoded form of {@link EvidenceRef}.
 *
 * @see {@link EvidenceRef} for the runtime pointer.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace EvidenceRef {
  export type Encoded = S.Codec.Encoded<typeof EvidenceRef>;
}

const confidenceColumn = () => kitDefault(["high", "medium", "low"], medium, "confidence");

/**
 * Pipeline archive item, also called a working-observation archive item.
 *
 * **Details**
 *
 * This is an extraction artifact. It is not product `layer=archive`. Secret
 * risk flags force the sensitive class. The id is `l1_` plus 20 hex characters
 * when the caller leaves it blank. `class` is the serialized name of
 * `archiveClass`; `archive_class` is also accepted on input.
 *
 * **Gotchas**
 *
 * `subjectScope`, `beliefClass`, `halfLifeDays`, and `validTo` are hidden from
 * the Python JSON schema and stay optional here. Empty `about` means the
 * subject is uncertain, not that the item is about the user.
 *
 * **Example** (Trim the archive text)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { L1MemoryArchiveItem } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const wire = S.encodeSync(L1MemoryArchiveItem)(L1MemoryArchiveItem.make({ text: "a fact" }))
 * const decoded = S.decodeUnknownSync(L1MemoryArchiveItem)({ ...wire, text: "  a fact  " })
 *
 * console.log(decoded.text) // "a fact"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class L1MemoryArchiveItem extends Model<L1MemoryArchiveItem>("L1MemoryArchiveItem")(
  {
    schemaVersion: textDefault("schema_version", "l1_memory_archive_item.v1"),
    archiveId: textDefault("archive_id", ""),
    userId: textDefault("user_id", ""),
    sourceId: textDefault("source_id", ""),
    sourceType: textDefault("source_type", ""),
    text: described(strippedText, "Archive text. Required after trimming.").pipe(pg.text(), pg.columnName("text")),
    archiveClass: described(L1MemoryArchiveClass, "Pipeline class. Wire name is class, not the product Archive layer.").pipe(
      S.withConstructorDefault(Effect.succeed(general)),
      pg.text(),
      pg.columnName("archive_class"),
    ),
    sourceRefs: jsonList("source_refs"),
    evidenceQuotes: stringList("evidence_quotes"),
    speakerLabel: optionalNull(S.String).pipe(pg.text(), pg.columnName("speaker_label")),
    speakerScope: textDefault("speaker_scope", sessionLocal),
    about: described(S.String, "Free-text subject. Empty means uncertain, not the user.").pipe(
      S.withConstructorDefault(Effect.succeed("")),
      pg.text(),
      pg.columnName("about"),
    ),
    subjectScope: optionalNull(S.String).pipe(pg.text(), pg.columnName("subject_scope")),
    beliefClass: optionalNull(S.String).pipe(pg.text(), pg.columnName("belief_class")),
    halfLifeDays: optionalNull(S.Finite).pipe(pg.doublePrecision(), pg.columnName("half_life_days")),
    validTo: optionalInstant("valid_to"),
    confidence: confidenceColumn(),
    riskFlags: stringList("risk_flags"),
    allowedUse: optionalNull(S.String).pipe(pg.text(), pg.columnName("allowed_use")),
    normalSearchAllowed: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      pg.boolean(),
      pg.columnName("normal_search_allowed"),
    ),
    isStableProfileFact: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      pg.boolean(),
      pg.columnName("is_stable_profile_fact"),
    ),
    searchResultLabel: textDefault("search_result_label", archiveLabel),
    extractorVersion: textDefault("extractor_version", "short_term_archive_llm_v1"),
  },
  $I.annote("L1MemoryArchiveItem", {
    description: "Working-observation archive artifact. Not the product Archive layer.",
  }),
) {}

/**
 * Encoded form of {@link L1MemoryArchiveItem}.
 *
 * @see {@link L1MemoryArchiveItem} for the pipeline-versus-product split.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace L1MemoryArchiveItem {
  export type Encoded = S.Codec.Encoded<typeof L1MemoryArchiveItem>;
}

/**
 * {@link L1MemoryArchiveItem} wire that serializes `archiveClass` as `class`.
 *
 * **Example** (Encode the class key)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { L1MemoryArchiveItem, L1MemoryArchiveItemWire } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const item = L1MemoryArchiveItem.make({ text: "fact" })
 * const encoded = Effect.runSync(S.encodeEffect(L1MemoryArchiveItemWire)(item))
 * console.log(encoded.class) // "general"
 * ```
 *
 * @see {@link L1MemoryArchiveItem} for the decoded field name.
 * @category schemas
 * @since 0.0.0
 */
export const L1MemoryArchiveItemWire = L1MemoryArchiveItem.pipe(S.encodeKeys({ archiveClass: "class" }));

const decodeL1MemoryArchiveItemWire = S.decodeUnknownEffect(L1MemoryArchiveItemWire);

/**
 * Apply archive policy and fill a blank archive id.
 *
 * **Details**
 *
 * Secret risk flags force `sensitive`. Sensitive rows are not normally
 * searchable and use `restricted_archive_only`. General rows use
 * `archive_search`. Stable-profile is forced false.
 *
 * **Example** (Force a secret row to sensitive)
 *
 * ```ts
 * import { L1MemoryArchiveItem, deriveArchivePolicy } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const item = deriveArchivePolicy(L1MemoryArchiveItem.make({ text: "secret", riskFlags: ["Secret"] }))
 * console.log(item.archiveClass) // "sensitive"
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const deriveArchivePolicy = (item: L1MemoryArchiveItem): L1MemoryArchiveItem => {
  const sensitive = hasSecret(item.riskFlags) || Equal.equals(item.archiveClass, "sensitive");
  const archiveId = blank(item.archiveId)
    ? `l1_${Str.takeLeft(20)(
        deterministicContractId("l1-archive-item", {
          user_id: item.userId,
          source_id: item.sourceId,
          source_type: item.sourceType,
          text: item.text,
          evidence_quotes: item.evidenceQuotes,
        }),
      )}`
    : item.archiveId;
  return L1MemoryArchiveItem.make({
    ...item,
    archiveClass: sensitive ? "sensitive" : "general",
    normalSearchAllowed: !sensitive,
    allowedUse: O.some(sensitive ? "restricted_archive_only" : "archive_search"),
    isStableProfileFact: false,
    searchResultLabel: archiveLabel,
    archiveId,
  });
};

const renameArchiveClass = (input: unknown): unknown => {
  if (!isJsonObject(input) || Rec.has(input, "class") || !Rec.has(input, "archive_class")) return input;
  const alias = Rec.get(input, "archive_class");
  if (O.isNone(alias)) return input;
  return Rec.set(Rec.remove(input, "archive_class"), "class", alias.value);
};

/**
 * Decode an archive item from `class` or `archive_class`, then apply policy.
 *
 * **Example** (Accept the archive_class alias)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import {
 *   decodeL1MemoryArchiveItem,
 *   L1MemoryArchiveItem,
 *   L1MemoryArchiveItemWire,
 * } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const { class: archiveClass, ...wire } = S.encodeSync(L1MemoryArchiveItemWire)(
 *   L1MemoryArchiveItem.make({ text: "fact", archiveClass: "sensitive" }),
 * )
 * const decoded = Effect.runSync(decodeL1MemoryArchiveItem({ ...wire, archive_class: archiveClass }))
 *
 * console.log(decoded.archiveClass) // "sensitive"
 * console.log(decoded.normalSearchAllowed) // false
 * ```
 *
 * @see {@link deriveArchivePolicy} for the policy overwrite.
 * @category decoding
 * @since 0.0.0
 */
export const decodeL1MemoryArchiveItem = Effect.fn("MemoryContracts.decodeL1MemoryArchiveItem")(function* (
  input: unknown,
) {
  const decoded = yield* decodeL1MemoryArchiveItemWire(renameArchiveClass(input));
  return deriveArchivePolicy(decoded);
});

/**
 * Keep general archive items that normal search allows, optionally ranked by query.
 *
 * **Details**
 *
 * Query terms are unique lowercase words. Score is how many terms occur in the
 * text plus quotes. Zero scores drop. Sort is score, then archive id, descending.
 *
 * **Example** (Drop a sensitive row)
 *
 * ```ts
 * import { L1MemoryArchiveItem, deriveArchivePolicy, filterL1ArchiveForNormalSearch } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const kept = filterL1ArchiveForNormalSearch([
 *   deriveArchivePolicy(L1MemoryArchiveItem.make({ text: "cats", riskFlags: ["secret"] })),
 *   deriveArchivePolicy(L1MemoryArchiveItem.make({ text: "cats" })),
 * ])
 * console.log(kept.length) // 1
 * ```
 *
 * **Example** (Rank by query in a pipe)
 *
 * ```ts
 * import { pipe } from "effect/Function"
 * import { L1MemoryArchiveItem, deriveArchivePolicy, filterL1ArchiveForNormalSearch } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const ranked = pipe(
 *   [
 *     deriveArchivePolicy(L1MemoryArchiveItem.make({ archiveId: "a", text: "cats" })),
 *     deriveArchivePolicy(L1MemoryArchiveItem.make({ archiveId: "b", text: "cats and dogs" })),
 *   ],
 *   filterL1ArchiveForNormalSearch("cats dogs"),
 * )
 * console.log(ranked.map((item) => item.archiveId)) // ["b", "a"]
 * ```
 *
 * @category filtering
 * @since 0.0.0
 */
export const filterL1ArchiveForNormalSearch: {
  (query?: string): (items: ReadonlyArray<L1MemoryArchiveItem>) => ReadonlyArray<L1MemoryArchiveItem>;
  (items: ReadonlyArray<L1MemoryArchiveItem>, query?: string): ReadonlyArray<L1MemoryArchiveItem>;
} = dual((args) => A.isArray(args[0]), (
  items: ReadonlyArray<L1MemoryArchiveItem>,
  query?: string,
): ReadonlyArray<L1MemoryArchiveItem> => {
  const terms = A.dedupe(
    A.filter(A.map(Str.split(/\s+/u)(Str.toLowerCase(query ?? "")), Str.trim), (term) => !Str.isEmpty(term)),
  );
  const eligible = A.filter(
    items,
    (item) => Equal.equals(item.archiveClass, "general") && item.normalSearchAllowed,
  );
  if (A.isArrayEmpty(terms)) return eligible;
  const score = (item: L1MemoryArchiveItem): number => {
    const haystack = Str.toLowerCase(`${item.text} ${A.join(" ")(item.evidenceQuotes)}`);
    return A.reduce(terms, 0, (total, term) => (Str.includes(term)(haystack) ? total + 1 : total));
  };
  const matched = A.filter(eligible, (item) => score(item) > 0);
  return A.sort(
    matched,
    Order.combine(
      Order.mapInput(Order.flip(Order.Number), score),
      Order.mapInput(Order.flip(stringOrder), (item: L1MemoryArchiveItem) => item.archiveId),
    ),
  );
});

const speakerAllowed = HashSet.make("primary_user", "non_primary_speaker", "assistant", "unknown");
const sourceModeAllowed = HashSet.make(
  "conversation",
  "assistant_response",
  "media_or_tutorial",
  "ui_or_ocr",
  "game_or_story",
  "document",
  "unclear",
);
const relationshipAllowed = HashSet.make(
  "self",
  "owned_work",
  "adopted",
  "asking_about",
  "encountered",
  "other_speaker",
  "unclear",
);
const interpretationAllowed = HashSet.make("literal", "light_inference", "heavy_inference");

const normalizeSpeaker = aliasTo(
  { user: "primary_user", primary: "primary_user", non_primary: "non_primary_speaker", other: "non_primary_speaker", ai: "assistant" },
  speakerAllowed,
  unknown,
);
const normalizeSourceMode = aliasTo(
  {
    chat: "conversation",
    voice: "conversation",
    tutorial: "media_or_tutorial",
    media: "media_or_tutorial",
    ocr: "ui_or_ocr",
    ui: "ui_or_ocr",
    game: "game_or_story",
    story: "game_or_story",
  },
  sourceModeAllowed,
  unclear,
);
const normalizeRelationship = aliasTo(
  {
    primary_user: "self",
    user: "self",
    user_owned_project: "owned_work",
    owned_project: "owned_work",
    question: "asking_about",
    asked_about: "asking_about",
    watched: "encountered",
    heard: "encountered",
    other: "other_speaker",
    third_party: "other_speaker",
  },
  relationshipAllowed,
  unclear,
);
const normalizeInterpretation = aliasTo(
  { light: "light_inference", heavy: "heavy_inference", inferred: "light_inference" },
  interpretationAllowed,
  literalLevel,
);

const normalizeSubject = (value: string): string => {
  const normalized = Str.trim(Str.isEmpty(value) ? unclear : value);
  if (blank(normalized)) return unclear;
  const aliases: Rec.ReadonlyRecord<string, string> = {
    user: "self",
    primary_user: "self",
    project: "owned_project",
    relationship: "person",
    third_party: "other",
    generic: "general",
  };
  return O.getOrElse(Rec.get(aliases, Str.toLowerCase(normalized)), () => normalized);
};

const closedFromAlias = (normalize: (value: string) => string) =>
  S.String.pipe(
    S.decodeTo(S.String, {
      decode: SchemaGetter.transform(normalize),
      encode: SchemaGetter.transform((value: string) => value),
    }),
  );

/**
 * Working observation, also called a short-term candidate.
 *
 * **Details**
 *
 * Speaker, source mode, relationship, and interpretation close through alias
 * tables. `subject` stays free text. `deriveReadPolicy` overwrites `allowedUse`
 * from status and risk flags. `working` is the default status and is not a
 * product layer.
 *
 * **Example** (Alias a speaker)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { WorkingMemoryObservation } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const wire = S.encodeSync(WorkingMemoryObservation)(WorkingMemoryObservation.make({ content: "My name is Ada" }))
 * const decoded = S.decodeUnknownSync(WorkingMemoryObservation)({ ...wire, speakerAttribution: "ai" })
 *
 * console.log(decoded.speakerAttribution) // "assistant"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class WorkingMemoryObservation extends Model<WorkingMemoryObservation>("WorkingMemoryObservation")(
  {
    schemaVersion: textDefault("schema_version", "working_memory_observation.v1"),
    observationId: textDefault("observation_id", ""),
    packetId: optionalNull(S.String).pipe(pg.text(), pg.columnName("packet_id")),
    content: described(S.String, "Observation text.").pipe(pg.text(), pg.columnName("content")),
    evidenceIds: stringList("evidence_ids"),
    sourceRefs: jsonList("source_refs"),
    subjectEntityId: optionalNull(S.String).pipe(pg.text(), pg.columnName("subject_entity_id")),
    subjectScope: textDefault("subject_scope", primaryUser),
    literalObservation: optionalNull(S.String).pipe(pg.text(), pg.columnName("literal_observation")),
    speakerAttribution: closedFromAlias(normalizeSpeaker).pipe(
      S.withConstructorDefault(Effect.succeed(unknown)),
      pg.text(),
      pg.columnName("speaker_attribution"),
    ),
    sourceMode: closedFromAlias(normalizeSourceMode).pipe(
      S.withConstructorDefault(Effect.succeed(unclear)),
      pg.text(),
      pg.columnName("source_mode"),
    ),
    relationshipToUser: closedFromAlias(normalizeRelationship).pipe(
      S.withConstructorDefault(Effect.succeed(unclear)),
      pg.text(),
      pg.columnName("relationship_to_user"),
    ),
    subject: closedFromAlias(normalizeSubject).pipe(
      S.withConstructorDefault(Effect.succeed(unclear)),
      pg.text(),
      pg.columnName("subject"),
    ),
    interpretationLevel: closedFromAlias(normalizeInterpretation).pipe(
      S.withConstructorDefault(Effect.succeed(literalLevel)),
      pg.text(),
      pg.columnName("interpretation_level"),
    ),
    whyCaptured: optionalNull(S.String).pipe(pg.text(), pg.columnName("why_captured")),
    status: LifecycleState.pipe(S.withConstructorDefault(Effect.succeed(working)), pg.text(), pg.columnName("status")),
    confidence: confidenceColumn(),
    riskFlags: stringList("risk_flags"),
    routeHint: optionalNull(S.String).pipe(pg.text(), pg.columnName("route_hint")),
    allowedUse: optionalNull(S.String).pipe(pg.text(), pg.columnName("allowed_use")),
    predicate: optionalNull(S.String).pipe(pg.text(), pg.columnName("predicate")),
    arguments: jsonDefault("arguments"),
    qualifiers: jsonDefault("qualifiers"),
    extractorVersion: textDefault("extractor_version", "short_term_llm_observation_extractor_v1"),
  },
  $I.annote("WorkingMemoryObservation", {
    description: "Working observation or short-term candidate. Not a stored product layer.",
  }),
) {}

/**
 * Encoded form of {@link WorkingMemoryObservation}.
 *
 * @see {@link WorkingMemoryObservation} for alias normalization.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace WorkingMemoryObservation {
  export type Encoded = S.Codec.Encoded<typeof WorkingMemoryObservation>;
}

/**
 * Canonical name for {@link WorkingMemoryObservation}.
 *
 * **Example** (Construct a working observation)
 *
 * ```ts
 * import { WorkingObservation } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const observation = WorkingObservation.make({ content: "Lives in Lisbon" })
 *
 * console.log(observation.status) // "working"
 * console.log(observation.speakerAttribution) // "unknown"
 * ```
 *
 * @see {@link WorkingMemoryObservation} for the observation model.
 * @category models
 * @since 0.0.0
 */
export const WorkingObservation = WorkingMemoryObservation;

/**
 * Canonical name for {@link L1MemoryArchiveItem}.
 *
 * **Gotchas**
 *
 * This alias is still the pipeline archive artifact, not product Archive.
 *
 * **Example** (Construct an archive item)
 *
 * ```ts
 * import { WorkingObservationArchiveItem } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const item = WorkingObservationArchiveItem.make({ text: "Allergic to peanuts" })
 *
 * console.log(item.archiveClass) // "general"
 * console.log(item.normalSearchAllowed) // true
 * ```
 *
 * @see {@link L1MemoryArchiveItem} for the artifact model.
 * @category models
 * @since 0.0.0
 */
export const WorkingObservationArchiveItem = L1MemoryArchiveItem;

/**
 * Set `allowedUse` from status and risk flags.
 *
 * **Example** (Hide a secret observation)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { WorkingMemoryObservation, deriveReadPolicy } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const item = Effect.runSync(
 *   deriveReadPolicy(WorkingMemoryObservation.make({ content: "secret", riskFlags: ["pii_secret"] })),
 * )
 * console.log(O.getOrNull(item.allowedUse)) // "hidden"
 * ```
 *
 * @see {@link deriveAllowedUse} for the status map.
 * @category utilities
 * @since 0.0.0
 */
export const deriveReadPolicy = Effect.fn("MemoryContracts.deriveReadPolicy")(function* (
  observation: WorkingMemoryObservation,
) {
  const allowedUse = yield* deriveAllowedUse(observation.status, observation.riskFlags);
  return WorkingMemoryObservation.make({ ...observation, allowedUse: O.some(allowedUse) });
});

/**
 * Source-backed short-term candidate.
 *
 * **Details**
 *
 * Any tier other than `archive` is rewritten to `short_term`, the archive id is
 * cleared, and default access is denied when a secret risk flag is present.
 * Archive keeps its id and is not a default-access candidate. `expiresAt` must
 * be after `capturedAt`.
 *
 * **Example** (Rewrite long-term back to short-term)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as DateTime from "effect/DateTime"
 * import { SourceBackedMemoryCandidate, normalizeSourceBackedCandidate } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const capturedAt = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z")
 * const expiresAt = DateTime.makeUnsafe("2020-01-03T03:04:05.000Z")
 * const candidate = SourceBackedMemoryCandidate.make({
 *   candidateId: "c1",
 *   userId: "u1",
 *   sourceId: "s1",
 *   sourceType: "conversation",
 *   sourceVersion: "v1",
 *   text: "fact",
 *   capturedAt,
 *   expiresAt,
 *   initialTier: "long_term",
 * })
 * console.log(Effect.runSync(normalizeSourceBackedCandidate(candidate)).initialTier) // "short_term"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SourceBackedMemoryCandidate extends Model<SourceBackedMemoryCandidate>("SourceBackedMemoryCandidate")(
  {
    schemaVersion: textDefault("schema_version", "source_backed_memory_candidate.v1"),
    candidateId: strippedText.pipe(pg.text(), pg.columnName("candidate_id")),
    userId: strippedText.pipe(pg.text(), pg.columnName("user_id")),
    sourceId: strippedText.pipe(pg.text(), pg.columnName("source_id")),
    sourceType: strippedText.pipe(pg.text(), pg.columnName("source_type")),
    sourceVersion: strippedText.pipe(pg.text(), pg.columnName("source_version")),
    text: strippedText.pipe(pg.text(), pg.columnName("text")),
    evidenceIds: stringList("evidence_ids"),
    sourceRefs: jsonList("source_refs"),
    capturedAt: instant("captured_at"),
    expiresAt: instant("expires_at"),
    initialTier: MemoryTier.pipe(
      S.withConstructorDefault(Effect.succeed(shortTerm)),
      pg.text(),
      pg.columnName("initial_tier"),
    ),
    archiveId: optionalNull(S.String).pipe(pg.text(), pg.columnName("archive_id")),
    defaultAccessCandidate: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      pg.boolean(),
      pg.columnName("default_access_candidate"),
    ),
    riskFlags: stringList("risk_flags"),
    extractorVersion: textDefault("extractor_version", "source_backed_candidate_v1"),
  },
  $I.annote("SourceBackedMemoryCandidate", {
    description: "Source-backed candidate. Non-archive tiers are rewritten to short-term.",
  }),
) {}

/**
 * Encoded form of {@link SourceBackedMemoryCandidate}.
 *
 * @see {@link SourceBackedMemoryCandidate} for tier coercion.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SourceBackedMemoryCandidate {
  export type Encoded = S.Codec.Encoded<typeof SourceBackedMemoryCandidate>;
}

/**
 * Coerce candidate tier and reject an expiry that is not after capture.
 *
 * **Example** (Reject a backwards expiry)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime"
 * import * as Effect from "effect/Effect"
 * import { SourceBackedMemoryCandidate, normalizeSourceBackedCandidate } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const instant = DateTime.makeUnsafe("2020-01-02T03:04:05.000Z")
 * const candidate = SourceBackedMemoryCandidate.make({
 *   candidateId: "c1",
 *   userId: "u1",
 *   sourceId: "s1",
 *   sourceType: "conversation",
 *   sourceVersion: "v1",
 *   text: "fact",
 *   capturedAt: instant,
 *   expiresAt: instant,
 * })
 * console.log(Effect.runSyncExit(normalizeSourceBackedCandidate(candidate))._tag) // "Failure"
 * ```
 *
 * @see {@link SourceBackedMemoryCandidate} for the stored shape.
 * @category utilities
 * @since 0.0.0
 */
export const normalizeSourceBackedCandidate = Effect.fn("MemoryContracts.normalizeSourceBackedCandidate")(function* (
  candidate: SourceBackedMemoryCandidate,
) {
  if (DateTime.isLessThanOrEqualTo(candidate.expiresAt, candidate.capturedAt)) {
    return yield* MemoryContractError.make({ message: "expires_at must be after captured_at" });
  }
  if (Equal.equals(candidate.initialTier, "archive")) {
    return SourceBackedMemoryCandidate.make({ ...candidate, defaultAccessCandidate: false });
  }
  return SourceBackedMemoryCandidate.make({
    ...candidate,
    initialTier: shortTerm,
    archiveId: O.none(),
    defaultAccessCandidate: !hasSecret(candidate.riskFlags),
  });
});

/**
 * One L2 search request inside a plan.
 *
 * **Example** (Reject six results)
 *
 * ```ts
 * import * as Exit from "effect/Exit"
 * import * as S from "effect/Schema"
 * import { L2SearchRequest } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const wire = S.encodeSync(L2SearchRequest)(L2SearchRequest.make({ query: "tea preference", reason: "confirm habit" }))
 *
 * console.log(wire.maxResults) // 5
 * console.log(Exit.isFailure(S.decodeUnknownExit(L2SearchRequest)({ ...wire, maxResults: 6 }))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class L2SearchRequest extends Model<L2SearchRequest>("L2SearchRequest")(
  {
    query: strippedText.pipe(pg.text(), pg.columnName("query")),
    reason: strippedText.pipe(pg.text(), pg.columnName("reason")),
    searchType: textDefault("search_type", semantic),
    maxResults: S.Int.check(S.isBetween({ minimum: 1, maximum: 5 })).pipe(
      S.withConstructorDefault(Effect.succeed(5)),
      pg.integer(),
      pg.columnName("max_results"),
    ),
  },
  $I.annote("L2SearchRequest", { description: "One planned search. maxResults is 1 through 5." }),
  (columns) => [betweenCheck(columns.maxResults, "max_results_range", 1, 5)],
) {}

/**
 * Encoded form of {@link L2SearchRequest}.
 *
 * @see {@link L2SearchRequest} for the result cap.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace L2SearchRequest {
  export type Encoded = S.Codec.Encoded<typeof L2SearchRequest>;
}

const routeVersion = textDefault("schema_version", "l2_memory_route.v1");
const routeReason = S.String.pipe(pg.text(), pg.columnName("reason"));
const requiredQuotes = S.Array(S.String)
  .check(S.isMinLength(1))
  .pipe(pg.jsonb(), pg.columnName("evidence_quotes"));

/**
 * Durable or review consolidation route.
 *
 * **Details**
 *
 * `memoryText` is required and `evidenceQuotes` is non-empty. `dropReason` is
 * not a field, so an excess drop reason is rejected when excess properties error.
 *
 * **Example** (Read the durable tag)
 *
 * ```ts
 * import { L2MemoryRouteDurable } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * console.log(L2MemoryRouteDurable.make({ memoryText: "fact", evidenceQuotes: ["q"], reason: "keep" }).route) // "durable"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class L2MemoryRouteDurable extends Model<L2MemoryRouteDurable>("L2MemoryRouteDurable")(
  {
    schemaVersion: routeVersion,
    route: S.tag("durable").pipe(pg.text(), pg.columnName("route")),
    memoryText: strippedText.pipe(pg.text(), pg.columnName("memory_text")),
    evidenceQuotes: requiredQuotes,
    confidence: confidenceColumn(),
    reason: routeReason,
  },
  $I.annote("L2MemoryRouteDurable", { description: "Consolidation route that keeps memory text and quotes." }),
) {}

/**
 * Encoded form of {@link L2MemoryRouteDurable}.
 *
 * @see {@link L2MemoryRouteDurable} for the required quotes.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace L2MemoryRouteDurable {
  export type Encoded = S.Codec.Encoded<typeof L2MemoryRouteDurable>;
}

/**
 * Review consolidation route.
 *
 * **Example** (Read the review tag)
 *
 * ```ts
 * import { L2MemoryRouteReview } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * console.log(L2MemoryRouteReview.make({ memoryText: "fact", evidenceQuotes: ["q"], reason: "check" }).route) // "review"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class L2MemoryRouteReview extends Model<L2MemoryRouteReview>("L2MemoryRouteReview")(
  {
    schemaVersion: textDefault("schema_version", "l2_memory_route.v1"),
    route: S.tag("review").pipe(pg.text(), pg.columnName("route")),
    memoryText: strippedText.pipe(pg.text(), pg.columnName("memory_text")),
    evidenceQuotes: S.Array(S.String).check(S.isMinLength(1)).pipe(pg.jsonb(), pg.columnName("evidence_quotes")),
    confidence: confidenceColumn(),
    reason: S.String.pipe(pg.text(), pg.columnName("reason")),
  },
  $I.annote("L2MemoryRouteReview", { description: "Consolidation route that holds memory text for review." }),
) {}

/**
 * Encoded form of {@link L2MemoryRouteReview}.
 *
 * @see {@link L2MemoryRouteReview} for the review tag.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace L2MemoryRouteReview {
  export type Encoded = S.Codec.Encoded<typeof L2MemoryRouteReview>;
}

/**
 * Discard consolidation route.
 *
 * **Example** (Require a drop reason)
 *
 * ```ts
 * import { L2MemoryRouteDiscard } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * console.log(L2MemoryRouteDiscard.make({ reason: "noise", dropReason: "duplicate" }).route) // "discard"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class L2MemoryRouteDiscard extends Model<L2MemoryRouteDiscard>("L2MemoryRouteDiscard")(
  {
    schemaVersion: textDefault("schema_version", "l2_memory_route.v1"),
    route: S.tag("discard").pipe(pg.text(), pg.columnName("route")),
    memoryText: optionalNull(S.String).pipe(pg.text(), pg.columnName("memory_text")),
    evidenceQuotes: stringList("evidence_quotes"),
    confidence: confidenceColumn(),
    reason: S.String.pipe(pg.text(), pg.columnName("reason")),
    dropReason: L2DropReason.pipe(pg.text(), pg.columnName("drop_reason")),
  },
  $I.annote("L2MemoryRouteDiscard", { description: "Consolidation route that drops a candidate for a named reason." }),
) {}

/**
 * Encoded form of {@link L2MemoryRouteDiscard}.
 *
 * @see {@link L2MemoryRouteDiscard} for the drop reason.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace L2MemoryRouteDiscard {
  export type Encoded = S.Codec.Encoded<typeof L2MemoryRouteDiscard>;
}

/**
 * Hidden consolidation route.
 *
 * **Details**
 *
 * The only drop reason is `secret_or_security_sensitive`.
 *
 * **Example** (Pin the secret drop reason)
 *
 * ```ts
 * import { L2MemoryRouteHidden } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * console.log(L2MemoryRouteHidden.make({ reason: "secret" }).dropReason) // "secret_or_security_sensitive"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class L2MemoryRouteHidden extends Model<L2MemoryRouteHidden>("L2MemoryRouteHidden")(
  {
    schemaVersion: textDefault("schema_version", "l2_memory_route.v1"),
    route: S.tag("hidden").pipe(pg.text(), pg.columnName("route")),
    memoryText: optionalNull(S.String).pipe(pg.text(), pg.columnName("memory_text")),
    evidenceQuotes: stringList("evidence_quotes"),
    confidence: confidenceColumn(),
    reason: S.String.pipe(pg.text(), pg.columnName("reason")),
    dropReason: kitDefault(
      ["secret_or_security_sensitive"],
      "secret_or_security_sensitive",
      "drop_reason",
    ),
  },
  $I.annote("L2MemoryRouteHidden", { description: "Consolidation route hidden for secret or security content." }),
) {}

/**
 * Encoded form of {@link L2MemoryRouteHidden}.
 *
 * @see {@link L2MemoryRouteHidden} for the pinned drop reason.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace L2MemoryRouteHidden {
  export type Encoded = S.Codec.Encoded<typeof L2MemoryRouteHidden>;
}

const L2RouteKit = LiteralKit(["durable", "review", "discard", "hidden"]);

/**
 * Consolidation route. The `route` field chooses the member shape.
 *
 * **Details**
 *
 * Durable and review require text and at least one quote and forbid a drop
 * reason. Discard requires a drop reason. Hidden requires the secret drop reason.
 *
 * **Gotchas**
 *
 * This is a promotion proposal, not a product layer. `context_only` is not a member.
 *
 * **Example** (Decode a discard route)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { L2MemoryRoute, L2MemoryRouteDiscard } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const wire = S.encodeSync(L2MemoryRouteDiscard)(
 *   L2MemoryRouteDiscard.make({ reason: "already stored", dropReason: "duplicate" }),
 * )
 * const decoded = S.decodeUnknownSync(L2MemoryRoute)(wire)
 *
 * console.log(decoded.route) // "discard"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const L2MemoryRoute = L2RouteKit.mapMembers(
  Tuple.evolve([() => L2MemoryRouteDurable, () => L2MemoryRouteReview, () => L2MemoryRouteDiscard, () => L2MemoryRouteHidden]),
).pipe(
  S.toTaggedUnion("route"),
  $I.annoteSchema("L2MemoryRoute", {
    description: "Consolidation route. route selects durable, review, discard, or hidden.",
  }),
);

/**
 * Decoded consolidation route.
 *
 * @see {@link L2MemoryRoute} for the four member shapes.
 * @category type-level
 * @since 0.0.0
 */
export type L2MemoryRoute = typeof L2MemoryRoute.Type;

/**
 * One L2 search result bound to a route.
 *
 * **Example** (Decode a durable result)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { L2SearchResult } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const decoded = Effect.runSync(
 *   S.decodeUnknownEffect(L2SearchResult)({
 *     resultId: "r1",
 *     contentHash: "h1",
 *     status: "active",
 *     source: "chat",
 *     score: null,
 *     metadata: {},
 *   }),
 * )
 * console.log(decoded.status) // "active"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class L2SearchResult extends Model<L2SearchResult>("L2SearchResult")(
  {
    resultId: S.String.pipe(pg.text(), pg.columnName("result_id")),
    contentHash: S.String.pipe(pg.text(), pg.columnName("content_hash")),
    status: LifecycleState.pipe(pg.text(), pg.columnName("status")),
    source: S.String.pipe(pg.text(), pg.columnName("source")),
    score: optionalNull(S.Finite).pipe(pg.doublePrecision(), pg.columnName("score")),
    content: optionalNull(S.String).pipe(pg.text(), pg.columnName("content")),
    metadata: jsonDefault("metadata"),
  },
  $I.annote("L2SearchResult", { description: "One search hit. The consolidation route is a separate contract." }),
) {}

/**
 * Encoded form of {@link L2SearchResult}.
 *
 * @see {@link L2SearchResult} for the nested route.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace L2SearchResult {
  export type Encoded = S.Codec.Encoded<typeof L2SearchResult>;
}

/**
 * Bounded, same-user, read-only search plan.
 *
 * **Details**
 *
 * `searchBudget` is 0 through 3. The number of searches cannot exceed it.
 * `sameUserOnly` and `readOnly` must stay true.
 *
 * **Example** (Reject an over-budget plan)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { CheckedL2SearchPlan } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const exit = Effect.runSyncExit(
 *   S.decodeUnknownEffect(CheckedL2SearchPlan)({
 *     packetId: "p1",
 *     searchBudget: 0,
 *     searches: [{ query: "q", reason: "r" }],
 *   }),
 * )
 * console.log(exit._tag) // "Failure"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class L2SearchPlan extends Model<L2SearchPlan>("L2SearchPlan")(
  {
    schemaVersion: textDefault("schema_version", "l2_custom_search_plan.v1"),
    packetId: strippedText.pipe(pg.text(), pg.columnName("packet_id")),
    searchBudget: S.Int.check(S.isBetween({ minimum: 0, maximum: 3 })).pipe(
      S.withConstructorDefault(Effect.succeed(3)),
      pg.integer(),
      pg.columnName("search_budget"),
    ),
    searches: S.Array(L2SearchRequest).pipe(S.withConstructorDefault(Effect.succeed([])), pg.jsonb(), pg.columnName("searches")),
    sameUserOnly: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(true)), pg.boolean(), pg.columnName("same_user_only")),
    readOnly: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(true)), pg.boolean(), pg.columnName("read_only")),
  },
  $I.annote("L2SearchPlan", { description: "Read-only same-user search plan. Budget is 0 through 3." }),
  (columns) => [betweenCheck(columns.searchBudget, "search_budget_range", 0, 3)],
) {}

/**
 * Encoded form of {@link L2SearchPlan}.
 *
 * @see {@link L2SearchPlan} for the budget.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace L2SearchPlan {
  export type Encoded = S.Codec.Encoded<typeof L2SearchPlan>;
}

/**
 * Explain why a search plan is illegal, if it is.
 *
 * **Example** (Flag a write-capable plan)
 *
 * ```ts
 * import { L2SearchPlan, l2SearchPlanIssue } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const plan = L2SearchPlan.make({ packetId: "p1", readOnly: false })
 * console.log(l2SearchPlanIssue(plan)) // "read_only must be true"
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const l2SearchPlanIssue = (plan: L2SearchPlan): string | undefined => {
  if (plan.searches.length > plan.searchBudget) return "searches exceed search_budget";
  if (!plan.sameUserOnly) return "same_user_only must be true";
  if (!plan.readOnly) return "read_only must be true";
  return undefined;
};

/**
 * {@link L2SearchPlan} decoder that enforces the budget and read-only flags.
 *
 * **Example** (Accept an empty plan)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CheckedL2SearchPlan, L2SearchPlan } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const wire = S.encodeSync(L2SearchPlan)(L2SearchPlan.make({ packetId: "p1", searchBudget: 0 }))
 * const decoded = S.decodeUnknownSync(CheckedL2SearchPlan)(wire)
 *
 * console.log(decoded.searches.length) // 0
 * ```
 *
 * @see {@link l2SearchPlanIssue} for the predicate.
 * @category schemas
 * @since 0.0.0
 */
export const CheckedL2SearchPlan = L2SearchPlan.check(
  S.makeFilter((plan: L2SearchPlan) => l2SearchPlanIssue(plan), {
    identifier: "L2SearchPlanBudget",
    title: "L2 search plan budget",
    message: "L2 search plan is illegal",
  }),
);

/**
 * Decoded legal search plan.
 *
 * @see {@link CheckedL2SearchPlan} for the checked decoder.
 * @category type-level
 * @since 0.0.0
 */
export type CheckedL2SearchPlan = typeof CheckedL2SearchPlan.Type;

/**
 * Target visibility a patch may set.
 *
 * **Example** (Decode private)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { TargetVisibility } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(TargetVisibility)("private"))
 * console.log(decoded) // "private"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TargetVisibility = closed(["private", "public", "shared"], "TargetVisibility", "Patch target visibility.");

/**
 * Decoded target visibility.
 *
 * @see {@link TargetVisibility} for the runtime kit.
 * @category type-level
 * @since 0.0.0
 */
export type TargetVisibility = typeof TargetVisibility.Type;

const zero = 0;

/**
 * Server-owned durable memory patch.
 *
 * **Details**
 *
 * `decision`, `resultStatus`, `kind`, and `initialTier` overlap. They stay
 * separate fields. Direct long-term creation is rejected unless
 * `ledgerSchemaVersion` is `knowledge_ledger.v1`. `observedHeadCommitId` is
 * required and may be null. `active` and `review` results need evidence ids or
 * refs. Merge, update, add-evidence, and skip-duplicate need a target.
 *
 * **Gotchas**
 *
 * Ledger documents need a body. Only facts may have a slot. Only triggers may
 * have a trigger condition, and a trigger must have one. A non-intent-backed
 * ledger row must use `legacy_migration`.
 *
 * **Example** (Construct a working patch)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { DurableMemoryPatch } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const patch = DurableMemoryPatch.make({
 *   patchId: "p1",
 *   packetId: "pkt",
 *   runId: "run",
 *   idempotencyKey: "k1",
 *   decision: "add",
 *   resultStatus: "working",
 *   memoryText: O.some("Prefers tea"),
 *   observedHeadCommitId: O.none(),
 * })
 *
 * console.log(patch.initialTier) // "short_term"
 * console.log(patch.visibility) // "private"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DurableMemoryPatch extends Model<DurableMemoryPatch>("DurableMemoryPatch")(
  {
    schemaVersion: textDefault("schema_version", "durable_memory_patch.v1"),
    patchId: S.String.pipe(pg.text(), pg.columnName("patch_id")),
    packetId: S.String.pipe(pg.text(), pg.columnName("packet_id")),
    runId: S.String.pipe(pg.text(), pg.columnName("run_id")),
    idempotencyKey: S.String.pipe(pg.text(), pg.columnName("idempotency_key")),
    decision: DurablePatchDecision.pipe(pg.text(), pg.columnName("decision")),
    memoryText: optionalNull(S.String).pipe(pg.text(), pg.columnName("memory_text")),
    newMemoryId: optionalNull(S.String).pipe(pg.text(), pg.columnName("new_memory_id")),
    targetMemoryId: optionalNull(S.String).pipe(pg.text(), pg.columnName("target_memory_id")),
    evidenceIds: stringList("evidence_ids"),
    evidenceRefs: S.Array(EvidenceRef).pipe(S.withConstructorDefault(Effect.succeed([])), pg.jsonb(), pg.columnName("evidence_refs")),
    resultStatus: LifecycleState.pipe(pg.text(), pg.columnName("result_status")),
    confidence: confidenceColumn(),
    visibility: textDefault("visibility", privateVisibility),
    userAsserted: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false)), pg.boolean(), pg.columnName("user_asserted")),
    initialTier: MemoryTier.pipe(
      S.withConstructorDefault(Effect.succeed(shortTerm)),
      pg.text(),
      pg.columnName("initial_tier"),
    ),
    supersedes: stringList("supersedes"),
    subjectEntityId: optionalNull(S.String).pipe(pg.text(), pg.columnName("subject_entity_id")),
    predicate: optionalNull(S.String).pipe(pg.text(), pg.columnName("predicate")),
    arguments: jsonDefault("arguments"),
    rationale: optionalNull(S.String).pipe(pg.text(), pg.columnName("rationale")),
    relationshipToUser: kitDefault(
      ["self", "owned_work", "adopted", "asking_about", "encountered", "other_speaker", "unclear"],
      unclear,
      "relationship_to_user",
    ),
    subjectLabel: optionalNull(S.String).pipe(pg.text(), pg.columnName("subject_label")),
    aboutness: kitDefault(
      ["primary_user", "user_owned_project", "user_relationship", "third_party", "unclear"],
      unclear,
      "aboutness",
    ),
    validFrom: optionalInstant("valid_from"),
    validTo: optionalInstant("valid_to"),
    targetTier: optionalNull(MemoryTier).pipe(pg.text(), pg.columnName("target_tier")),
    targetVisibility: optionalNull(TargetVisibility).pipe(pg.text(), pg.columnName("target_visibility")),
    targetUserAsserted: optionalNull(S.Boolean).pipe(pg.boolean(), pg.columnName("target_user_asserted")),
    clearGraphAssertion: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      pg.boolean(),
      pg.columnName("clear_graph_assertion"),
    ),
    mutationMetadata: optionalNull(S.JsonObject).pipe(pg.jsonb(), pg.columnName("mutation_metadata")),
    observedHeadCommitId: described(
      S.OptionFromNullOr(S.String),
      "Required head the writer observed. Null means the writer saw an empty head.",
    ).pipe(pg.text(), pg.columnName("observed_head_commit_id")),
    halfLifeDays: optionalNull(S.Finite).pipe(pg.doublePrecision(), pg.columnName("half_life_days")),
    beliefClass: optionalNull(S.String).pipe(pg.text(), pg.columnName("belief_class")),
    curationWeight: S.Int.pipe(S.withConstructorDefault(Effect.succeed(zero)), pg.integer(), pg.columnName("curation_weight")),
    ledgerSchemaVersion: optionalNull(S.String).pipe(pg.text(), pg.columnName("ledger_schema_version")),
    kind: MemoryKind.pipe(S.withConstructorDefault(Effect.succeed(fact)), pg.text(), pg.columnName("kind")),
    subjectScope: MemorySubjectScope.pipe(
      S.withConstructorDefault(Effect.succeed(primaryUser)),
      pg.text(),
      pg.columnName("subject_scope"),
    ),
    slot: optionalNull(S.String).pipe(pg.text(), pg.columnName("slot")),
    body: optionalNull(S.String).pipe(pg.text(), pg.columnName("body")),
    triggerCondition: jsonDefault("trigger_condition"),
    writeReason: optionalNull(LedgerWriteReason).pipe(pg.text(), pg.columnName("write_reason")),
    intentBacked: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false)), pg.boolean(), pg.columnName("intent_backed")),
  },
  $I.annote("DurableMemoryPatch", {
    description: "Durable patch. Decision, result, kind, and tier stay separate fields.",
  }),
) {}

/**
 * Encoded form of {@link DurableMemoryPatch}.
 *
 * @see {@link DurableMemoryPatch} for the overlapping decisions.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace DurableMemoryPatch {
  export type Encoded = S.Codec.Encoded<typeof DurableMemoryPatch>;
}

const hasText = (value: O.Option<string>): boolean => O.isSome(value) && !Str.isEmpty(value.value);

const needsTarget = (decision: DurablePatchDecision): boolean =>
  Equal.equals(decision, "merge") ||
  Equal.equals(decision, "update") ||
  Equal.equals(decision, "add_evidence") ||
  Equal.equals(decision, "skip_duplicate");

/**
 * Explain why a durable patch breaks its decision or ledger contract.
 *
 * **Example** (Flag an add with no text)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { DurableMemoryPatch, durablePatchIssue } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const patch = DurableMemoryPatch.make({
 *   patchId: "p1",
 *   idempotencyKey: "k1",
 *   packetId: "pkt",
 *   runId: "run",
 *   decision: "add",
 *   resultStatus: "working",
 *   observedHeadCommitId: O.none(),
 * })
 * console.log(durablePatchIssue(patch)) // "add decisions require memory_text or new_memory_id"
 * ```
 *
 * @see {@link CheckedDurableMemoryPatch} for the same rule on decode.
 * @category predicates
 * @since 0.0.0
 */
export const durablePatchIssue = (patch: DurableMemoryPatch): string | undefined => {
  const ledger = O.getOrElse(patch.ledgerSchemaVersion, () => "");
  if (Equal.equals(patch.initialTier, "long_term") && !Equal.equals(ledger, "knowledge_ledger.v1")) {
    return "Long-term memory cannot be created directly; promote an existing Short-term item";
  }
  if (needsTarget(patch.decision) && !hasText(patch.targetMemoryId)) {
    return "target_memory_id is required for merge/update/add_evidence/skip_duplicate decisions";
  }
  if (Equal.equals(patch.decision, "add") && !hasText(patch.memoryText) && !hasText(patch.newMemoryId)) {
    return "add decisions require memory_text or new_memory_id";
  }
  if (
    (Equal.equals(patch.resultStatus, "active") || Equal.equals(patch.resultStatus, "review")) &&
    patch.evidenceIds.length < 1 &&
    patch.evidenceRefs.length < 1
  ) {
    return "active/review patches require exact supporting evidence ids or refs";
  }
  if (!Equal.equals(ledger, "knowledge_ledger.v1")) return undefined;
  if (Equal.equals(patch.decision, "add") && !Equal.equals(patch.initialTier, "long_term")) {
    return "knowledge ledger rows use the long_term compatibility projection";
  }
  if (Equal.equals(patch.decision, "update") && O.isSome(patch.targetTier) && !Equal.equals(patch.targetTier.value, "long_term")) {
    return "knowledge ledger updates may not enter the short_term lifecycle";
  }
  if (O.isNone(patch.writeReason) || (!patch.intentBacked && !Equal.equals(patch.writeReason.value, "legacy_migration"))) {
    return "knowledge ledger rows require an intent-backed write reason";
  }
  if (O.getOrElse(patch.memoryText, () => "").length > MAX_LEDGER_CONTENT_CHARACTERS) {
    return "knowledge ledger content exceeds the ledger limit";
  }
  if (O.getOrElse(patch.slot, () => "").length > MAX_LEDGER_SLOT_CHARACTERS) {
    return "knowledge ledger slot exceeds the ledger limit";
  }
  if (Equal.equals(patch.kind, "document")) {
    const body = O.getOrElse(patch.body, () => "");
    if (blank(body)) return "ledger documents require a non-empty body";
    if (body.length > MAX_LEDGER_PLAYBOOK_BODY_CHARACTERS) return "ledger document body exceeds the ledger limit";
  } else if (O.isSome(patch.body)) {
    return "ledger body is only valid for document rows";
  }
  if (!Equal.equals(patch.kind, "fact") && O.isSome(patch.slot)) return "only fact ledger rows may define a slot";
  if (Equal.equals(patch.kind, "trigger") && Rec.isEmptyRecord(patch.triggerCondition)) {
    return "trigger ledger rows require trigger_condition";
  }
  if (!Equal.equals(patch.kind, "trigger") && !Rec.isEmptyRecord(patch.triggerCondition)) {
    return "trigger_condition is only valid for trigger ledger rows";
  }
  if (Rec.keys(patch.triggerCondition).length > MAX_LEDGER_TRIGGER_CONDITION_KEYS) {
    return "ledger trigger condition exceeds the ledger key limit";
  }
  if (canonicalJson(patch.triggerCondition).length > MAX_LEDGER_TRIGGER_CONDITION_CHARACTERS) {
    return "ledger trigger condition exceeds the serialized limit";
  }
  return undefined;
};

/**
 * {@link DurableMemoryPatch} decoder that enforces the decision and ledger contract.
 *
 * **Example** (Accept a short-term add)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { CheckedDurableMemoryPatch, DurableMemoryPatch } from "@beep/scratchpad/beep/MemoryContracts"
 *
 * const patch = DurableMemoryPatch.make({
 *   patchId: "p1",
 *   packetId: "pkt",
 *   runId: "run",
 *   idempotencyKey: "k1",
 *   decision: "add",
 *   resultStatus: "working",
 *   memoryText: O.some("Prefers tea"),
 *   observedHeadCommitId: O.none(),
 * })
 * const decoded = S.decodeUnknownSync(CheckedDurableMemoryPatch)(S.encodeSync(DurableMemoryPatch)(patch))
 *
 * console.log(decoded.initialTier) // "short_term"
 * ```
 *
 * @see {@link durablePatchIssue} for the predicate.
 * @category schemas
 * @since 0.0.0
 */
export const CheckedDurableMemoryPatch = DurableMemoryPatch.check(
  S.makeFilter((patch: DurableMemoryPatch) => durablePatchIssue(patch), {
    identifier: "DurablePatchContract",
    title: "Durable patch contract",
    message: "durable memory patch is illegal",
  }),
);

/**
 * Decoded legal durable patch.
 *
 * @see {@link CheckedDurableMemoryPatch} for the checked decoder.
 * @category type-level
 * @since 0.0.0
 */
export type CheckedDurableMemoryPatch = typeof CheckedDurableMemoryPatch.Type;

