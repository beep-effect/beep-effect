/**
 * Fail-closed search contract for `knowledge_ledger.v1` rows.
 *
 * `current` searches open, intent-backed rows. Unslotted facts are searchable
 * but are not profile inputs. Documents expose their handle and triggers
 * expose their description, never a private payload. `history` is an explicit
 * fact-only surface for closed rows and preserved generated legacy data.
 * Rejected rows are audit-only and must be requested. Provider hits stay
 * candidates until the caller hydrates the authoritative row.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("beep/KnowledgeLedgerSearch");

/**
 * Index metadata version shared by keyword and vector projections.
 *
 * **Example** (Read the index version)
 *
 * ```ts
 * import { LEDGER_INDEX_VERSION } from "@beep/scratchpad/beep/KnowledgeLedgerSearch"
 *
 * console.log(LEDGER_INDEX_VERSION) // 1
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LEDGER_INDEX_VERSION = 1;

const ledgerKinds = HashSet.make("fact", "document", "trigger");

const restrictedLabels = HashSet.make(
  "credential",
  "secret",
  "financial",
  "health",
  "intimate",
  "minor",
  "minors",
  "workplace_confidential",
  "identity_authentication",
);

/**
 * Ledger kinds that may be indexed.
 *
 * **Example** (See that facts are searchable)
 *
 * ```ts
 * import * as HashSet from "effect/HashSet"
 * import { LEDGER_SEARCH_KINDS } from "@beep/scratchpad/beep/KnowledgeLedgerSearch"
 *
 * console.log(HashSet.has(LEDGER_SEARCH_KINDS, "fact")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const LEDGER_SEARCH_KINDS: HashSet.HashSet<string> = ledgerKinds;

/**
 * Ledger retrieval surface.
 *
 * **Details**
 *
 * `current` is the default open surface. `history` is fact-only and includes
 * closed or explicitly requested rejected rows.
 *
 * **Example** (Decode history)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { LedgerSearchSurface } from "@beep/scratchpad/beep/KnowledgeLedgerSearch"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(LedgerSearchSurface)("history"))
 * console.log(decoded) // "history"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LedgerSearchSurface = LiteralKit(["current", "history"]).pipe(
  $I.annoteSchema("LedgerSearchSurface", {
    description: "Ledger retrieval surface. current is open rows; history is the explicit fact-only surface.",
  }),
);

/**
 * Decoded ledger search surface.
 *
 * @see {@link LedgerSearchSurface} for the runtime literals.
 * @category type-level
 * @since 0.0.0
 */
export type LedgerSearchSurface = typeof LedgerSearchSurface.Type;

/**
 * Index state written beside a projection.
 *
 * **Example** (Decode a closed row)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { LedgerRowIndexState } from "@beep/scratchpad/beep/KnowledgeLedgerSearch"
 *
 * const decoded = Effect.runSync(S.decodeUnknownEffect(LedgerRowIndexState)("closed"))
 * console.log(decoded) // "closed"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const LedgerRowIndexState = LiteralKit(["not_ledger", "open", "closed"]).pipe(
  $I.annoteSchema("LedgerRowIndexState", {
    description: "Projection index state: not a ledger row, open on the current surface, or closed.",
  }),
);

/**
 * Decoded ledger row index state.
 *
 * @see {@link LedgerRowIndexState} for the runtime literals.
 * @category type-level
 * @since 0.0.0
 */
export type LedgerRowIndexState = typeof LedgerRowIndexState.Type;

/**
 * Kinds passed to ledger search were empty or outside fact, document, and trigger.
 *
 * **Example** (Reject an unknown kind)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import { InvalidLedgerKinds, validateLedgerKinds } from "@beep/scratchpad/beep/KnowledgeLedgerSearch"
 *
 * const exit = Effect.runSyncExit(validateLedgerKinds(["note"]))
 * console.log(exit._tag === "Failure") // true
 * console.log(InvalidLedgerKinds.make({ message: "kinds must contain only fact, document, or trigger" }).message) // "kinds must contain only fact, document, or trigger"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class InvalidLedgerKinds extends S.TaggedError<InvalidLedgerKinds>()(
  "InvalidLedgerKinds",
  { message: S.String },
  $I.annoteError<InvalidLedgerKinds>("InvalidLedgerKinds", {
    description: "Ledger search kinds must be a non-empty subset of fact, document, and trigger.",
  }),
) {}

const invalidLedgerKinds = (): InvalidLedgerKinds =>
  InvalidLedgerKinds.make({ message: "kinds must contain only fact, document, or trigger" });

/**
 * Encoded invalid-kinds error.
 *
 * @see {@link InvalidLedgerKinds} for the runtime error.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace InvalidLedgerKinds {
  export type Encoded = S.Codec.Encoded<typeof InvalidLedgerKinds>;
}

const read = (row: object, key: string): unknown => (key in row ? Reflect.get(row, key) : undefined);

const unwrap = (value: unknown): unknown => (O.isOption(value) ? O.getOrNull(value) : value);

const textOf = (value: unknown): string => {
  const unwrapped = unwrap(value);
  if (P.isString(unwrapped)) return unwrapped;
  if (P.hasProperty(unwrapped, "value")) {
    const inner = Reflect.get(unwrapped, "value");
    if (P.isString(inner)) return inner;
  }
  if (unwrapped === null || unwrapped === undefined) return "";
  if (P.isNumber(unwrapped) || P.isBoolean(unwrapped)) return String(unwrapped);
  return "";
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  P.isObject(value);

const promotion = (row: object): Record<string, unknown> => {
  const value = unwrap(read(row, "promotion"));
  return isRecord(value) ? value : {};
};

/**
 * String form of a row's ledger kind.
 *
 * **Example** (Read a fact kind)
 *
 * ```ts
 * import { ledgerKindValue } from "@beep/scratchpad/beep/KnowledgeLedgerSearch"
 *
 * console.log(ledgerKindValue({ kind: "fact" })) // "fact"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const ledgerKindValue = (row: object): string => textOf(read(row, "kind"));

/**
 * Returns whether the row uses `knowledge_ledger.v1`.
 *
 * **Example** (Accept the current schema)
 *
 * ```ts
 * import { ledgerSchemaIsCurrent } from "@beep/scratchpad/beep/KnowledgeLedgerSearch"
 *
 * console.log(ledgerSchemaIsCurrent({ ledgerSchemaVersion: "knowledge_ledger.v1" })) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const ledgerSchemaIsCurrent = (row: object): boolean => read(row, "ledgerSchemaVersion") === "knowledge_ledger.v1";

/**
 * Returns whether the row or its promotion is locked.
 *
 * **Details**
 *
 * A lock is exactly boolean true. A missing promotion is not locked.
 *
 * **Example** (Read a locked promotion)
 *
 * ```ts
 * import { ledgerRowIsLocked } from "@beep/scratchpad/beep/KnowledgeLedgerSearch"
 *
 * console.log(ledgerRowIsLocked({ promotion: { isLocked: true } })) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const ledgerRowIsLocked = (row: object): boolean =>
  read(row, "isLocked") === true || promotion(row).isLocked === true;

/**
 * Returns whether the user rejected the row.
 *
 * **Details**
 *
 * Rejection is exactly boolean false on `userReview` or `promotion.userReview`.
 * Missing review is not a rejection.
 *
 * **Example** (Read a rejected review)
 *
 * ```ts
 * import { ledgerRowIsRejected } from "@beep/scratchpad/beep/KnowledgeLedgerSearch"
 *
 * console.log(ledgerRowIsRejected({ userReview: false })) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const ledgerRowIsRejected = (row: object): boolean =>
  read(row, "userReview") === false || promotion(row).userReview === false;

/**
 * Returns whether any sensitivity label is restricted.
 *
 * **Example** (Reject a health label)
 *
 * ```ts
 * import { ledgerRowHasRestrictedSensitivity } from "@beep/scratchpad/beep/KnowledgeLedgerSearch"
 *
 * console.log(ledgerRowHasRestrictedSensitivity({ sensitivityLabels: ["health"] })) // true
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const ledgerRowHasRestrictedSensitivity = (row: object): boolean => {
  const labels = read(row, "sensitivityLabels");
  if (!A.isArray(labels)) return false;
  return A.some(labels, (label) => P.isString(label) && HashSet.has(restrictedLabels, label));
};

/**
 * Returns whether source state and evidence still allow a read.
 *
 * **Details**
 *
 * Tombstoned or purged sources are unreadable. An active source with an
 * evidence list must contain an active entry unless the row is a direct user
 * assertion. A missing evidence field is allowed, because MemoryDB
 * compatibility rows do not carry evidence.
 *
 * **Example** (Reject a purged source)
 *
 * ```ts
 * import { ledgerRowSourceIsReadable } from "@beep/scratchpad/beep/KnowledgeLedgerSearch"
 *
 * console.log(ledgerRowSourceIsReadable({ sourceState: "purged" })) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const ledgerRowSourceIsReadable = (row: object): boolean => {
  const sourceState = textOf(read(row, "sourceState"));
  if (sourceState === "tombstoned" || sourceState === "purged") return false;
  const evidence = read(row, "evidence");
  if (sourceState === "active" && A.isArray(evidence) && read(row, "userAsserted") !== true) {
    return A.some(evidence, (entry) => P.isObject(entry) && textOf(read(entry, "sourceState")) === "active");
  }
  return true;
};

const isActiveStatus = (row: object): boolean => {
  const status = read(row, "status");
  if (status === null || status === undefined) {
    return read(row, "invalidAt") == null && !isTruthy(read(row, "supersededBy"));
  }
  return textOf(status) === "active";
};

const isTruthy = (value: unknown): boolean => {
  const unwrapped = unwrap(value);
  return unwrapped !== null && unwrapped !== undefined && unwrapped !== false && unwrapped !== 0 && unwrapped !== "";
};

const isClosedStatus = (row: object): boolean =>
  textOf(read(row, "status")) === "superseded" ||
  read(row, "invalidAt") != null ||
  read(row, "validTo") != null ||
  isTruthy(read(row, "supersededBy"));

const isProcessed = (row: object): boolean => {
  const state = read(row, "processingState");
  return state === null || state === undefined || textOf(state) === "processed";
};

const isHiddenOrTombstoned = (row: object): boolean => {
  const status = textOf(read(row, "status"));
  return status === "hidden" || status === "tombstoned";
};

const isLegacyMigrated = (row: object): boolean =>
  read(row, "intentBacked") !== true && textOf(read(row, "writeReason")) === "legacy_migration";

const kindAllowed = (row: object, kinds: HashSet.HashSet<string>): boolean => HashSet.has(kinds, ledgerKindValue(row));

/**
 * Returns whether one authoritative row may enter a ledger search.
 *
 * **Details**
 *
 * The owner check is mandatory. A missing owner, unknown schema or kind,
 * blank content, lock, restricted label, unreadable source, unprocessed row,
 * or hidden/tombstoned status fails closed. The current surface also requires
 * intent backing, an active open row, and no rejection. Documents on that
 * surface must be `primary_user`. History admits only facts that are
 * intent-backed or legacy-migrated, and only when they are migrated, rejected
 * (if requested), or closed.
 *
 * **Gotchas**
 *
 * Attribute names are the camelCase port of the Python row (`ledger_schema_version`
 * is `ledgerSchemaVersion`). Promotion flags are `isLocked` and `userReview`.
 * A boolean false is a rejection; a missing review is not. Short-term,
 * Long-term, and Archive are layers, not this search surface. Category is not
 * a layer and is not read here.
 *
 * **Example** (Reject a row with no owner)
 *
 * ```ts
 * import { isLedgerRowAdmissible } from "@beep/scratchpad/beep/KnowledgeLedgerSearch"
 *
 * console.log(isLedgerRowAdmissible({ row: { content: "Ada" }, uid: "user-1", surface: "current" })) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isLedgerRowAdmissible = (input: {
  readonly row: object;
  readonly uid: string | null;
  readonly surface: LedgerSearchSurface;
  readonly kinds?: HashSet.HashSet<string>;
  readonly includeRejected?: boolean;
}): boolean => {
  const row = input.row;
  const uid = input.uid ?? "";
  if (uid.length === 0 || read(row, "uid") !== uid) return false;
  const kinds = input.kinds ?? LEDGER_SEARCH_KINDS;
  if (!ledgerSchemaIsCurrent(row) || !kindAllowed(row, kinds)) return false;
  if (Str.trim(textOf(read(row, "content"))).length === 0) return false;
  if (ledgerRowIsLocked(row) || ledgerRowHasRestrictedSensitivity(row)) return false;
  if (!ledgerRowSourceIsReadable(row) || !isProcessed(row) || isHiddenOrTombstoned(row)) return false;
  if (input.surface === "current") {
    if (read(row, "intentBacked") !== true || !isActiveStatus(row)) return false;
    if (read(row, "validTo") != null || read(row, "invalidAt") != null) return false;
    if (isTruthy(read(row, "supersededBy"))) return false;
    if (ledgerRowIsRejected(row)) return false;
    if (ledgerKindValue(row) === "document" && textOf(read(row, "subjectScope")) !== "primary_user") return false;
    return true;
  }
  if (ledgerKindValue(row) !== "fact") return false;
  if (!(read(row, "intentBacked") === true || isLegacyMigrated(row))) return false;
  if (!(input.includeRejected ?? false) && ledgerRowIsRejected(row)) return false;
  return isLegacyMigrated(row) || ledgerRowIsRejected(row) || isClosedStatus(row);
};

/**
 * Classifies projection metadata for one row.
 *
 * **Details**
 *
 * Rows outside the current schema or the fact/document/trigger set are
 * `not_ledger`. Otherwise the row is `open` when it is admissible on the
 * current surface for its own uid, and `closed` when it is not.
 *
 * **Example** (Classify a non-ledger row)
 *
 * ```ts
 * import { ledgerRowIndexState } from "@beep/scratchpad/beep/KnowledgeLedgerSearch"
 *
 * console.log(ledgerRowIndexState({ ledgerSchemaVersion: "other", kind: "fact" })) // "not_ledger"
 * ```
 *
 * @category getters
 * @since 0.0.0
 */
export const ledgerRowIndexState = (row: object): LedgerRowIndexState => {
  if (!ledgerSchemaIsCurrent(row) || !kindAllowed(row, LEDGER_SEARCH_KINDS)) return "not_ledger";
  const uid = read(row, "uid");
  return isLedgerRowAdmissible({ row, uid: P.isString(uid) ? uid : null, surface: "current" })
    ? "open"
    : "closed";
};

/**
 * Non-content metadata shared by keyword and vector projections.
 *
 * @see {@link buildLedgerIndexMetadata} for the projection that fills this shape.
 * @category type-level
 * @since 0.0.0
 */
export interface LedgerIndexMetadata {
  readonly ledgerIndexVersion: number;
  readonly ledgerSchemaVersion: string;
  readonly ledgerKind: string;
  readonly ledgerRowState: LedgerRowIndexState;
  readonly ledgerHasSlot: boolean;
  readonly ledgerSubjectScope: string;
}

/**
 * Returns projection metadata, or an empty object when the row is not a ledger row.
 *
 * **Details**
 *
 * A slot counts only when it is a non-blank string. Subject scope uses the
 * string value, or empty when it is missing.
 *
 * **Example** (Skip a non-ledger row)
 *
 * ```ts
 * import { buildLedgerIndexMetadata } from "@beep/scratchpad/beep/KnowledgeLedgerSearch"
 *
 * console.log(Object.keys(buildLedgerIndexMetadata({ kind: "fact" })).length) // 0
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const buildLedgerIndexMetadata = (row: object): LedgerIndexMetadata | Record<string, never> => {
  if (!ledgerSchemaIsCurrent(row) || !kindAllowed(row, LEDGER_SEARCH_KINDS)) return {};
  const slot = read(row, "slot");
  return {
    ledgerIndexVersion: LEDGER_INDEX_VERSION,
    ledgerSchemaVersion: "knowledge_ledger.v1",
    ledgerKind: ledgerKindValue(row),
    ledgerRowState: ledgerRowIndexState(row),
    ledgerHasSlot: P.isString(slot) && Str.trim(slot).length > 0,
    ledgerSubjectScope: textOf(read(row, "subjectScope")),
  };
};

/**
 * Parses a caller kind filter.
 *
 * **Details**
 *
 * Values are trimmed and lowercased. Blank entries are dropped. The result
 * must be a non-empty subset of fact, document, and trigger.
 *
 * **Example** (Accept a fact filter)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as HashSet from "effect/HashSet"
 * import { validateLedgerKinds } from "@beep/scratchpad/beep/KnowledgeLedgerSearch"
 *
 * const kinds = Effect.runSync(validateLedgerKinds([" Fact "]))
 * console.log(HashSet.has(kinds, "fact")) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateLedgerKinds = Effect.fn("validateLedgerKinds")(function* (kinds: ReadonlyArray<string>) {
  const parsed = A.reduce(kinds, HashSet.empty<string>(), (acc, kind) => {
    const normalized = Str.toLowerCase(Str.trim(kind));
    return normalized.length === 0 ? acc : HashSet.add(acc, normalized);
  });
  if (HashSet.size(parsed) === 0 || !A.every(A.fromIterable(parsed), (kind) => HashSet.has(ledgerKinds, kind))) {
    return yield* invalidLedgerKinds();
  }
  return parsed;
});
