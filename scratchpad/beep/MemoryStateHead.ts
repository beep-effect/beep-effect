/**
 * Trusted canonical fields on a `memory_state/head` document.
 *
 * **Details**
 *
 * The head also carries legacy-ledger metadata. Writers must preserve these
 * fields instead of replacing the document with only their own metadata.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  Model,
  NonNegativeInt,
  nonNegativeIntCheck,
  pg,
  textBoundsCheck,
} from "./Kit.ts";

const $I = $ScratchpadId.create("beep/MemoryStateHead");

/**
 * Schema version stored on a trusted memory state head.
 *
 * **Example** (Read the version)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { MEMORY_STATE_HEAD_SCHEMA_VERSION } from "./MemoryStateHead.ts"
 *
 * Effect.runSync(Effect.log(MEMORY_STATE_HEAD_SCHEMA_VERSION)) // 1
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MEMORY_STATE_HEAD_SCHEMA_VERSION = 1;

/**
 * Source marker stored on a trusted memory state head.
 *
 * **Example** (Read the source)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { MEMORY_STATE_HEAD_SOURCE } from "./MemoryStateHead.ts"
 *
 * Effect.runSync(Effect.log(MEMORY_STATE_HEAD_SOURCE)) // "memory_state_head"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const MEMORY_STATE_HEAD_SOURCE = "memory_state_head";

const nonNegativeInteger = (value: unknown): value is number =>
  P.isNumber(value) && !P.isBoolean(value) && Number.isInteger(value) && value >= 0;

const readKey = (record: {
  readonly [key: string]: unknown
}, snake: string, camel: string): unknown =>
  P.hasProperty(record, snake) ? record[snake] : P.hasProperty(record, camel) ? record[camel] : undefined;

/**
 * Trusted canonical fields preserved on `memory_state/head`.
 *
 * **Details**
 *
 * The state-head document also carries legacy-ledger metadata. Writers must
 * preserve these trusted fields rather than replacing the whole document with
 * only their own metadata. A returned value always has schema version
 * {@link MEMORY_STATE_HEAD_SCHEMA_VERSION} and source {@link MEMORY_STATE_HEAD_SOURCE}.
 *
 * **Example** (Construct a trusted head)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { TrustedMemoryStateHead } from "./MemoryStateHead.ts"
 *
 * const head = TrustedMemoryStateHead.make({
 *   schemaVersion: 1,
 *   uid: "user-1",
 *   source: "memory_state_head",
 *   accountGeneration: 1,
 *   headCommitId: "commit-1",
 *   commitSequence: 2,
 * })
 * Effect.runSync(Effect.log(head.headCommitId)) // "commit-1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TrustedMemoryStateHead extends Model<TrustedMemoryStateHead>("TrustedMemoryStateHead")(
  {
    schemaVersion: S.Literal(MEMORY_STATE_HEAD_SCHEMA_VERSION)
      .annotateKey({ description: "Trusted head schema version. The only legal value is 1." })
      .pipe(pg.integer(), pg.columnName("schema_version")),
    uid: S.String.check(S.isMinLength(1))
      .annotateKey({ description: "Account uid. Empty is rejected; surrounding spaces are preserved." })
      .pipe(pg.text(), pg.columnName("uid")),
    source: S.Literal(MEMORY_STATE_HEAD_SOURCE)
      .annotateKey({ description: "Trusted head source marker." })
      .pipe(pg.text(), pg.columnName("source")),
    accountGeneration: NonNegativeInt.annotateKey({
      description: "Account generation. Booleans and negative numbers are rejected.",
    }).pipe(pg.integer(), pg.columnName("account_generation")),
    headCommitId: S.String.check(S.isMinLength(1))
      .annotateKey({ description: "Canonical head commit id. Empty is rejected." })
      .pipe(pg.text(), pg.columnName("head_commit_id")),
    commitSequence: NonNegativeInt.annotateKey({
      description: "Commit sequence at the head. Booleans and negative numbers are rejected.",
    }).pipe(pg.integer(), pg.columnName("commit_sequence")),
  },
  $I.annote("TrustedMemoryStateHead", {
    description: "Trusted canonical fields preserved on a memory state head document.",
  }),
  (columns) => [
    textBoundsCheck("uid", { minLength: 1 })(columns.uid),
    textBoundsCheck("head_commit_id", { minLength: 1 })(columns.headCommitId),
    nonNegativeIntCheck("account_generation")(columns.accountGeneration),
    nonNegativeIntCheck("commit_sequence")(columns.commitSequence),
  ],
) {
}

/**
 * Encoded form of {@link TrustedMemoryStateHead}.
 *
 * @see {@link TrustedMemoryStateHead} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TrustedMemoryStateHead {
  export type Encoded = S.Codec.Encoded<typeof TrustedMemoryStateHead>;
}

/**
 * Build trusted head fields when every argument satisfies the shared contract.
 *
 * **Details**
 *
 * Returns `None` unless `uid` is non-empty, both counters are non-boolean
 * integers greater than or equal to zero, and `headCommitId` is a non-empty
 * string. Whitespace-only ids are accepted because the Python contract uses
 * truthiness, not stripping. The returned record stamps the shared schema
 * version and source.
 *
 * **Example** (Reject a boolean generation)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { trustedMemoryStateHeadFields } from "./MemoryStateHead.ts"
 *
 * const head = trustedMemoryStateHeadFields({
 *   uid: "user-1",
 *   accountGeneration: true,
 *   headCommitId: "commit-1",
 *   commitSequence: 0,
 * })
 * Effect.runSync(Effect.log(O.isNone(head))) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const trustedMemoryStateHeadFields = (input: {
  readonly uid: string;
  readonly accountGeneration: unknown;
  readonly headCommitId: unknown;
  readonly commitSequence: unknown;
}): O.Option<TrustedMemoryStateHead> => {
  if (Str.isEmpty(input.uid)) return O.none();
  if (!nonNegativeInteger(input.accountGeneration)) return O.none();
  if (!P.isString(input.headCommitId) || Str.isEmpty(input.headCommitId)) return O.none();
  if (!nonNegativeInteger(input.commitSequence)) return O.none();
  return O.some(
    TrustedMemoryStateHead.make({
      schemaVersion: MEMORY_STATE_HEAD_SCHEMA_VERSION,
      uid: input.uid,
      source: MEMORY_STATE_HEAD_SOURCE,
      accountGeneration: input.accountGeneration,
      headCommitId: input.headCommitId,
      commitSequence: input.commitSequence,
    }),
  );
};

/**
 * Validate and extract trusted fields from a state-head document.
 *
 * **Details**
 *
 * The document must already carry schema version 1, the same uid, and source
 * `memory_state_head`. Stored documents use Python snake_case keys; camelCase
 * keys are accepted as a fallback. This does not repair a mismatched document.
 *
 * **Example** (Match a stored head)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { trustedMemoryStateHeadFieldsFromState } from "./MemoryStateHead.ts"
 *
 * const head = trustedMemoryStateHeadFieldsFromState(
 *   {
 *     schema_version: 1,
 *     uid: "user-1",
 *     source: "memory_state_head",
 *     account_generation: 1,
 *     head_commit_id: "commit-1",
 *     commit_sequence: 2,
 *   },
 *   "user-1",
 * )
 * Effect.runSync(Effect.log(O.isSome(head))) // true
 * ```
 *
 * @see {@link trustedMemoryStateHeadFields} for the field contract.
 * @category constructors
 * @since 0.0.0
 */
export const trustedMemoryStateHeadFieldsFromState: {
  (uid: string): (state: unknown) => O.Option<TrustedMemoryStateHead>
  (state: unknown, uid: string): O.Option<TrustedMemoryStateHead>
} = dual(2, (state: unknown, uid: string): O.Option<TrustedMemoryStateHead> => {
  if (!P.isObject(state)) return O.none();
  if (readKey(state, "schema_version", "schemaVersion") !== MEMORY_STATE_HEAD_SCHEMA_VERSION) return O.none();
  if (readKey(state, "uid", "uid") !== uid) return O.none();
  if (readKey(state, "source", "source") !== MEMORY_STATE_HEAD_SOURCE) return O.none();
  return trustedMemoryStateHeadFields({
    uid,
    accountGeneration: readKey(state, "account_generation", "accountGeneration"),
    headCommitId: readKey(state, "head_commit_id", "headCommitId"),
    commitSequence: readKey(state, "commit_sequence", "commitSequence"),
  });
});

/**
 * Build trusted fields from a canonical apply-control record for repair.
 *
 * **Details**
 *
 * The control uid must match. Schema version and source are not read from the
 * control document; a successful repair stamps the trusted head constants.
 * Snake_case and camelCase keys are both accepted.
 *
 * **Example** (Repair from control)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import { trustedMemoryStateHeadFieldsFromControl } from "./MemoryStateHead.ts"
 *
 * const head = trustedMemoryStateHeadFieldsFromControl(
 *   { uid: "user-1", account_generation: 0, head_commit_id: "commit-1", commit_sequence: 0 },
 *   "user-1",
 * )
 * Effect.runSync(Effect.log(O.isSome(head))) // true
 * ```
 *
 * @see {@link trustedMemoryStateHeadFieldsFromState} for the stricter document path.
 * @category constructors
 * @since 0.0.0
 */
export const trustedMemoryStateHeadFieldsFromControl: {
  (uid: string): (control: unknown) => O.Option<TrustedMemoryStateHead>
  (control: unknown, uid: string): O.Option<TrustedMemoryStateHead>
} = dual(2, (
  control: unknown,
  uid: string,
): O.Option<TrustedMemoryStateHead> => {
  if (!P.isObject(control)) return O.none();
  if (readKey(control, "uid", "uid") !== uid) return O.none();
  return trustedMemoryStateHeadFields({
    uid,
    accountGeneration: readKey(control, "account_generation", "accountGeneration"),
    headCommitId: readKey(control, "head_commit_id", "headCommitId"),
    commitSequence: readKey(control, "commit_sequence", "commitSequence"),
  });
});
