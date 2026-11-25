/**
 * Shared read and append rules for CLI claim ledgers that mix frozen v1 rows with v2 core events.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ValidTime } from "@beep/epistemics/Claim";
import { ClaimId } from "@beep/epistemics/ClaimCore.schema";
import {
  ClaimImportLedger,
  ClaimReference,
  claimReferenceKey,
  MissingClaimCreationFact,
} from "@beep/epistemics/ClaimImport.schema";
import { ClaimLogEntry, checkClaimLog } from "@beep/epistemics/ClaimLog";
import { ClaimKnowledgeInterval } from "@beep/epistemics/ClaimLog.schema";
import { $RepoCliId } from "@beep/identity/packages";
import { ActivityStartFields, mintActivityId } from "@beep/jsonc/ActivityStart";
import { ActivityId, ContentHash } from "@beep/schema/ContentHash";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliId.create("internal/claims/ClaimHistory");

const ClaimHistoryRefusal = LiteralKit([
  "duplicate-claim",
  "missing-predecessor",
  "cyclic-predecessor",
  "supersession-fork",
  "conflicting-predecessor",
  "predecessor-key-mismatch",
  "claim-key-mismatch",
  "activity-mismatch",
  "log-violation",
  "unknown-target",
  "inverted-knowledge",
]).pipe($I.annoteSchema("ClaimHistoryRefusal", { description: "Why a claim history cannot be read or appended." }));

/**
 * A claim history that cannot be read or extended without truncation or invention.
 *
 * @category errors
 * @since 0.0.0
 */
export class ClaimHistoryRefused extends S.TaggedError<ClaimHistoryRefused, { readonly brand: unique symbol }>(
  $I`ClaimHistoryRefused`
)(
  "ClaimHistoryRefused",
  { ledger: ClaimImportLedger, claim: S.String, reason: ClaimHistoryRefusal },
  $I.annoteError<ClaimHistoryRefused>("ClaimHistoryRefused", {
    description: "An explicit refusal naming the namespaced claim reference and the broken rule.",
  })
) {}

/**
 * Creation facts no frozen v1 claim row can establish.
 *
 * @category constants
 * @since 0.0.0
 */
export const legacyMissingFacts = HashSet.fromIterable(MissingClaimCreationFact.literals);

/**
 * Hash the stored bytes of one line, exactly as read and without its line break.
 *
 * @category utilities
 * @since 0.0.0
 */
export const lineDigest = Effect.fnUntraced(function* (line: string) {
  const digest = yield* Digest.Digest;
  const hex = yield* digest.digestHex(Digest.sha256, new TextEncoder().encode(line));
  return ContentHash.make(`sha256:${hex}`);
});

/**
 * Split stored content into its non-blank lines, keeping each line's bytes.
 *
 * @category utilities
 * @since 0.0.0
 */
export const storedLines = (content: string): ReadonlyArray<string> =>
  A.filter(Str.split(content, "\n"), (line) => Str.isNonEmpty(Str.trim(line)));

/**
 * The key a stored line names its format under, and the exact version it must carry.
 *
 * @category models
 * @since 0.0.0
 */
export class LineFormat extends S.Opaque<LineFormat, { readonly brand: unique symbol }>()(
  S.Struct({
    key: S.NonEmptyString.annotateKey({ description: "Property that names the stored format." }),
    version: S.NonEmptyString.annotateKey({ description: "Exact format version the property must hold." }),
  }).pipe(
    $I.annoteSchema("LineFormat", { description: "The key and exact version that identify one stored line format." })
  )
) {}

/**
 * Whether a parsed line declares one exact versioned format under a key.
 *
 * @param format - Key and exact version the line must declare.
 * @returns A guard over parsed JSON lines.
 * @category guards
 * @since 0.0.0
 */
export const declaresFormat = (format: LineFormat): ((json: unknown) => boolean) =>
  S.is(S.Struct({ [format.key]: S.tag(format.version) }));

/**
 * Whether a parsed line names any format under a key, whatever version it carries.
 *
 * **Details**
 * A frozen untagged row never carries the key, so a line that names it must decode under the
 * exact current version and an unsupported version is refused instead of read as untagged.
 *
 * @param key - Property that names the stored format.
 * @returns A guard over parsed JSON lines.
 * @category guards
 * @since 0.0.0
 */
export const namesFormat = (key: string): ((json: unknown) => boolean) => S.is(S.Struct({ [key]: S.Unknown }));

/**
 * Historical facts the join reads from an imported row.
 *
 * @category models
 * @since 0.0.0
 */
export interface ImportedFacts<Review, Signals> {
  readonly challengeRefs: ReadonlyArray<string>;
  readonly logicalKey: string;
  readonly oldId: string;
  readonly originalKnowledge: { readonly recordedAt: DateTime.Utc; readonly expiredAt: O.Option<DateTime.Utc> };
  readonly predecessor: O.Option<string>;
  readonly review: Review;
  readonly signals: Signals;
  readonly supportRefs: ReadonlyArray<string>;
  readonly validTime: ValidTime;
}

const NativeFactsFields = {
  activity: S.Struct(ActivityStartFields),
  generatedAt: S.DateTimeUtc,
  record: S.Struct({
    claim: ClaimId,
    core: S.Struct({
      logicalKey: S.String,
      scope: S.Union([S.String, S.Finite]),
      supersedes: S.Option(ClaimId),
      derivedFrom: S.HashSet(ClaimId),
      knowledgeStart: S.DateTimeUtc,
      generatedBy: ActivityId,
      valid: ValidTime,
    }),
  }),
};

const CoreEventFactsFields = { ...NativeFactsFields, event: S.tag("Core") };

/**
 * Native creation facts the join and append law read from a v2 core event.
 *
 * @category models
 * @since 0.0.0
 */
export type NativeFacts = S.Struct.Type<typeof NativeFactsFields>;

/**
 * One stored claim entry, in file order.
 *
 * @category models
 * @since 0.0.0
 */
export type ClaimEntry<Imported, Native> =
  | { readonly _tag: "Imported"; readonly row: Imported }
  | { readonly _tag: "Native"; readonly row: Native };

/**
 * Claim-local v2 records that never alter a core's identity.
 *
 * @category models
 * @since 0.0.0
 */
export type SideRecord<Review, Signals> =
  | {
      readonly event: "Evidence";
      readonly claim: ClaimReference;
      readonly supportedBy: ReadonlyArray<string>;
      readonly challengedBy: ReadonlyArray<string>;
    }
  | { readonly event: "Review"; readonly claim: ClaimReference; readonly review: Review }
  | { readonly event: "Signals"; readonly claim: ClaimReference; readonly signals: Signals }
  | { readonly event: "Succession"; readonly claim: ClaimId; readonly predecessor: ClaimReference };

/**
 * The read-time join of one stored claim with its separate records.
 *
 * @category models
 * @since 0.0.0
 */
export interface JoinedClaim<Imported, Native, Review, Signals> {
  readonly entry: ClaimEntry<Imported, Native>;
  readonly evidence: { readonly supportedBy: ReadonlyArray<string>; readonly challengedBy: ReadonlyArray<string> };
  readonly knowledge: { readonly start: DateTime.Utc; readonly end: O.Option<DateTime.Utc> };
  readonly logicalKey: string;
  readonly predecessor: O.Option<ClaimReference>;
  readonly reference: ClaimReference;
  readonly review: Review;
  readonly signals: O.Option<Signals>;
  readonly valid: ValidTime;
}

/**
 * One decoded claims.jsonl line: a stored claim or a separate claim-local record.
 *
 * @category models
 * @since 0.0.0
 */
export type ClaimLine<Imported, Native, Review, Signals> =
  | { readonly _tag: "Claim"; readonly entry: ClaimEntry<Imported, Native> }
  | { readonly _tag: "Record"; readonly record: SideRecord<Review, Signals> };

/**
 * Native creation facts as stored by a v2 core event.
 *
 * @category models
 * @since 0.0.0
 */
export type CoreEventFacts = S.Struct.Type<typeof CoreEventFactsFields>;

const isCoreEvent = <Native extends CoreEventFacts, Review, Signals>(
  event: Native | SideRecord<Review, Signals>
): event is Native => event.event === "Core";

/**
 * Place one v2 event in the history: a core is a stored claim, anything else a separate record.
 *
 * @category utilities
 * @since 0.0.0
 */
export const eventLine = <Imported, Native extends CoreEventFacts, Review, Signals>(
  event: Native | SideRecord<Review, Signals>
): ClaimLine<Imported, Native, Review, Signals> =>
  isCoreEvent(event) ? { _tag: "Claim", entry: { _tag: "Native", row: event } } : { _tag: "Record", record: event };

const refuse = (ledger: ClaimImportLedger, claim: ClaimReference, reason: typeof ClaimHistoryRefusal.Type) =>
  ClaimHistoryRefused.make({ ledger, claim: claimReferenceKey(claim), reason });

const importedReference = (ledger: ClaimImportLedger, oldId: string) =>
  ClaimReference.cases.Imported.make({ ledger, oldId });

const nativeReference = (claim: ClaimId) => ClaimReference.cases.Native.make({ claim });

const entryReference =
  (ledger: ClaimImportLedger) =>
  <Imported extends ImportedFacts<unknown, unknown>, Native extends NativeFacts>(
    entry: ClaimEntry<Imported, Native>
  ): ClaimReference =>
    entry._tag === "Imported" ? importedReference(ledger, entry.row.oldId) : nativeReference(entry.row.record.claim);

const partitionLines = <Imported, Native, Review, Signals>(
  lines: ReadonlyArray<ClaimLine<Imported, Native, Review, Signals>>
) => ({
  entries: A.flatMap(lines, (line) => (line._tag === "Claim" ? [line.entry] : [])),
  records: A.flatMap(lines, (line) => (line._tag === "Record" ? [line.record] : [])),
});

const nativesOf = <Imported, Native>(entries: ReadonlyArray<ClaimEntry<Imported, Native>>): ReadonlyArray<Native> =>
  A.flatMap(entries, (entry) => (entry._tag === "Native" ? [entry.row] : []));

const toLogEntry = (native: NativeFacts): ClaimLogEntry =>
  ClaimLogEntry.make({
    claim: native.record.claim,
    scope: native.record.core.scope,
    logicalKey: native.record.core.logicalKey,
    supersedes: native.record.core.supersedes,
    derivedFrom: native.record.core.derivedFrom,
    knowledgeStart: native.record.core.knowledgeStart,
    generatedAt: native.generatedAt,
    valid: native.record.core.valid,
  });

const followChain = (
  ledger: ClaimImportLedger,
  predecessors: HashMap.HashMap<string, O.Option<string>>,
  start: string
): Result.Result<void, ClaimHistoryRefused> => {
  let seen = HashSet.make(start);
  let cursor = O.flatten(HashMap.get(predecessors, start));
  while (O.isSome(cursor)) {
    if (!HashMap.has(predecessors, cursor.value))
      return Result.fail(refuse(ledger, importedReference(ledger, start), "missing-predecessor"));
    if (HashSet.has(seen, cursor.value))
      return Result.fail(refuse(ledger, importedReference(ledger, start), "cyclic-predecessor"));
    seen = HashSet.add(seen, cursor.value);
    cursor = O.flatten(HashMap.get(predecessors, cursor.value));
  }
  return Result.succeed(undefined);
};

const checkImportedChains = (
  ledger: ClaimImportLedger,
  imported: ReadonlyArray<{ readonly oldId: string; readonly predecessor: O.Option<string> }>
): Result.Result<void, ClaimHistoryRefused> => {
  let predecessors = HashMap.empty<string, O.Option<string>>();
  for (const row of imported) {
    if (HashMap.has(predecessors, row.oldId))
      return Result.fail(refuse(ledger, importedReference(ledger, row.oldId), "duplicate-claim"));
    predecessors = HashMap.set(predecessors, row.oldId, row.predecessor);
  }
  for (const row of imported) {
    const checked = followChain(ledger, predecessors, row.oldId);
    if (Result.isFailure(checked)) return checked;
  }
  return Result.succeed(undefined);
};

const verifyNativeCore = Effect.fnUntraced(function* <Native extends NativeFacts, E, R>(
  ledger: ClaimImportLedger,
  native: Native,
  mint: (core: Native["record"]["core"]) => Effect.Effect<ClaimId, E, R>
) {
  const reference = nativeReference(native.record.claim);
  const claim = yield* Effect.option(mint(native.record.core));
  if (!O.contains(claim, native.record.claim)) return yield* refuse(ledger, reference, "claim-key-mismatch");
  const activity = yield* Effect.orDie(mintActivityId(native.activity));
  if (
    !Eq.equals(activity, native.record.core.generatedBy) ||
    DateTime.isGreaterThan(native.activity.started, native.generatedAt)
  )
    return yield* refuse(ledger, reference, "activity-mismatch");
});

const latestBy = <T>(records: ReadonlyArray<T>, key: (record: T) => string): HashMap.HashMap<string, T> =>
  A.reduce(records, HashMap.empty<string, T>(), (map, record) => HashMap.set(map, key(record), record));

type Succession = Extract<SideRecord<unknown, unknown>, { readonly event: "Succession" }>;
type AnyEntry = ClaimEntry<ImportedFacts<unknown, unknown>, NativeFacts>;

const recordTarget = (record: SideRecord<unknown, unknown>): ClaimReference =>
  record.event === "Succession" ? nativeReference(record.claim) : record.claim;

const checkTargets = (
  ledger: ClaimImportLedger,
  records: ReadonlyArray<SideRecord<unknown, unknown>>,
  known: (target: ClaimReference) => boolean
): Result.Result<void, ClaimHistoryRefused> =>
  O.match(
    A.findFirst(A.map(records, recordTarget), (target) => !known(target)),
    {
      onNone: () => Result.succeed(undefined),
      onSome: (target) => Result.fail(refuse(ledger, target, "unknown-target")),
    }
  );

const storedPredecessor =
  (ledger: ClaimImportLedger) =>
  (entry: AnyEntry): O.Option<ClaimReference> =>
    entry._tag === "Imported"
      ? O.map(entry.row.predecessor, (oldId) => importedReference(ledger, oldId))
      : O.map(entry.row.record.core.supersedes, nativeReference);

const storedPredecessors = (
  ledger: ClaimImportLedger,
  entries: ReadonlyArray<AnyEntry>
): HashMap.HashMap<string, ClaimReference> => {
  const reference = entryReference(ledger);
  const predecessorOf = storedPredecessor(ledger);
  return HashMap.fromIterable(
    A.flatMap(entries, (entry) =>
      A.map(
        O.toArray(predecessorOf(entry)),
        (predecessor) => [claimReferenceKey(reference(entry)), predecessor] as const
      )
    )
  );
};

const addSuccession =
  (ledger: ClaimImportLedger, known: (target: ClaimReference) => boolean) =>
  (
    predecessors: HashMap.HashMap<string, ClaimReference>,
    succession: Succession
  ): Result.Result<HashMap.HashMap<string, ClaimReference>, ClaimHistoryRefused> => {
    const own = nativeReference(succession.claim);
    if (HashMap.has(predecessors, claimReferenceKey(own)) || succession.predecessor._tag !== "Imported")
      return Result.fail(refuse(ledger, own, "conflicting-predecessor"));
    if (!known(succession.predecessor))
      return Result.fail(refuse(ledger, succession.predecessor, "missing-predecessor"));
    return Result.succeed(HashMap.set(predecessors, claimReferenceKey(own), succession.predecessor));
  };

const addSuccessions = (
  ledger: ClaimImportLedger,
  known: (target: ClaimReference) => boolean,
  stored: HashMap.HashMap<string, ClaimReference>,
  successions: ReadonlyArray<Succession>
): Result.Result<HashMap.HashMap<string, ClaimReference>, ClaimHistoryRefused> => {
  const start: Result.Result<HashMap.HashMap<string, ClaimReference>, ClaimHistoryRefused> = Result.succeed(stored);
  return A.reduce(successions, start, (acc, succession) =>
    Result.flatMap(acc, (predecessors) => addSuccession(ledger, known)(predecessors, succession))
  );
};

const successorIndex = (
  predecessors: HashMap.HashMap<string, ClaimReference>
): HashMap.HashMap<string, ReadonlyArray<string>> =>
  A.reduce(
    HashMap.toEntries(predecessors),
    HashMap.empty<string, ReadonlyArray<string>>(),
    (map, [successor, predecessor]) =>
      HashMap.set(
        map,
        claimReferenceKey(predecessor),
        A.append(O.getOrElse(HashMap.get(map, claimReferenceKey(predecessor)), A.empty<string>), successor)
      )
  );

const checkForks = (
  ledger: ClaimImportLedger,
  successors: HashMap.HashMap<string, ReadonlyArray<string>>
): Result.Result<void, ClaimHistoryRefused> =>
  O.match(
    A.findFirst(HashMap.toEntries(successors), ([, list]) => A.length(list) > 1),
    {
      onNone: () => Result.succeed(undefined),
      onSome: ([claim]) => Result.fail(ClaimHistoryRefused.make({ ledger, claim, reason: "supersession-fork" })),
    }
  );

const entryLogicalKey = (entry: AnyEntry): string =>
  entry._tag === "Imported" ? entry.row.logicalKey : entry.row.record.core.logicalKey;

const checkSuccessionKeys = (
  ledger: ClaimImportLedger,
  byKey: HashMap.HashMap<string, AnyEntry>,
  successions: ReadonlyArray<Succession>
): Result.Result<void, ClaimHistoryRefused> => {
  const keyAt = (target: ClaimReference) => O.map(HashMap.get(byKey, claimReferenceKey(target)), entryLogicalKey);
  return O.match(
    A.findFirst(
      successions,
      (succession) => !Eq.equals(keyAt(succession.predecessor), keyAt(nativeReference(succession.claim)))
    ),
    {
      onNone: () => Result.succeed(undefined),
      onSome: (succession) => Result.fail(refuse(ledger, succession.predecessor, "predecessor-key-mismatch")),
    }
  );
};

const checkNativeLog = (
  ledger: ClaimImportLedger,
  natives: ReadonlyArray<NativeFacts>
): Result.Result<void, ClaimHistoryRefused> =>
  A.isReadonlyArrayNonEmpty(checkClaimLog(A.map(natives, toLogEntry)))
    ? Result.fail(ClaimHistoryRefused.make({ ledger, claim: "native-log", reason: "log-violation" }))
    : Result.succeed(undefined);

const recordsOf = <Review, Signals, Event extends SideRecord<Review, Signals>["event"]>(
  records: ReadonlyArray<SideRecord<Review, Signals>>,
  event: Event
): ReadonlyArray<Extract<SideRecord<Review, Signals>, { readonly event: Event }>> =>
  A.filter(
    records,
    (record): record is Extract<SideRecord<Review, Signals>, { readonly event: Event }> => record.event === event
  );

type EvidenceRecord<Review, Signals> = Extract<SideRecord<Review, Signals>, { readonly event: "Evidence" }>;

const evidenceByClaim = <Review, Signals>(
  records: ReadonlyArray<EvidenceRecord<Review, Signals>>
): HashMap.HashMap<string, ReadonlyArray<EvidenceRecord<Review, Signals>>> =>
  A.reduce(records, HashMap.empty<string, ReadonlyArray<EvidenceRecord<Review, Signals>>>(), (map, record) => {
    const key = claimReferenceKey(record.claim);
    return HashMap.set(map, key, A.append(O.getOrElse(HashMap.get(map, key), A.empty), record));
  });

interface JoinContext<Review, Signals> {
  readonly evidence: HashMap.HashMap<string, ReadonlyArray<EvidenceRecord<Review, Signals>>>;
  readonly predecessors: HashMap.HashMap<string, ClaimReference>;
  readonly proposed: Review;
  readonly reference: (entry: AnyEntry) => ClaimReference;
  readonly reviews: HashMap.HashMap<string, Extract<SideRecord<Review, Signals>, { readonly event: "Review" }>>;
  readonly signals: HashMap.HashMap<string, Extract<SideRecord<Review, Signals>, { readonly event: "Signals" }>>;
  readonly successorStart: (key: string) => O.Option<DateTime.Utc>;
}

const joinEntry =
  <Imported extends ImportedFacts<Review, Signals>, Native extends NativeFacts, Review, Signals>(
    context: JoinContext<Review, Signals>
  ) =>
  (entry: ClaimEntry<Imported, Native>): JoinedClaim<Imported, Native, Review, Signals> => {
    const own = context.reference(entry);
    const key = claimReferenceKey(own);
    const linked = O.getOrElse(HashMap.get(context.evidence, key), A.empty);
    const extraSupport = A.flatMap(linked, (record) => record.supportedBy);
    const extraChallenge = A.flatMap(linked, (record) => record.challengedBy);
    const reviewed = O.map(HashMap.get(context.reviews, key), (record) => record.review);
    const observed = O.map(HashMap.get(context.signals, key), (record) => record.signals);
    const shared = { entry, reference: own, predecessor: HashMap.get(context.predecessors, key) };
    if (entry._tag === "Imported") {
      const row = entry.row;
      return {
        ...shared,
        logicalKey: row.logicalKey,
        knowledge: {
          start: row.originalKnowledge.recordedAt,
          end: O.orElse(row.originalKnowledge.expiredAt, () => context.successorStart(key)),
        },
        valid: row.validTime,
        evidence: {
          supportedBy: A.dedupe(A.appendAll(row.supportRefs, extraSupport)),
          challengedBy: A.dedupe(A.appendAll(row.challengeRefs, extraChallenge)),
        },
        review: O.getOrElse(reviewed, () => row.review),
        signals: O.orElse(observed, () => O.some(row.signals)),
      };
    }
    const core = entry.row.record.core;
    return {
      ...shared,
      logicalKey: core.logicalKey,
      knowledge: { start: core.knowledgeStart, end: context.successorStart(key) },
      valid: core.valid,
      evidence: { supportedBy: A.dedupe(extraSupport), challengedBy: A.dedupe(extraChallenge) },
      review: O.getOrElse(reviewed, () => context.proposed),
      signals: observed,
    };
  };

const isOrderedKnowledge = S.is(ClaimKnowledgeInterval);

const checkKnowledgeOrder = <Imported, Native, Review, Signals>(
  ledger: ClaimImportLedger,
  joined: ReadonlyArray<JoinedClaim<Imported, Native, Review, Signals>>,
  successorStart: (key: string) => O.Option<DateTime.Utc>
): Result.Result<ReadonlyArray<JoinedClaim<Imported, Native, Review, Signals>>, ClaimHistoryRefused> =>
  O.match(
    A.findFirst(
      joined,
      (claim) =>
        !isOrderedKnowledge(claim.knowledge) ||
        O.exists(successorStart(claimReferenceKey(claim.reference)), DateTime.isLessThan(claim.knowledge.start))
    ),
    {
      onNone: () => Result.succeed(joined),
      onSome: (claim) => Result.fail(refuse(ledger, claim.reference, "inverted-knowledge")),
    }
  );

const joinClaimHistory = <
  Imported extends ImportedFacts<Review, Signals>,
  Native extends NativeFacts,
  Review,
  Signals,
>(options: {
  readonly ledger: ClaimImportLedger;
  readonly entries: ReadonlyArray<ClaimEntry<Imported, Native>>;
  readonly records: ReadonlyArray<SideRecord<Review, Signals>>;
  readonly proposed: Review;
}): Result.Result<ReadonlyArray<JoinedClaim<Imported, Native, Review, Signals>>, ClaimHistoryRefused> =>
  Result.gen(function* () {
    const { ledger, entries, records } = options;
    const reference = entryReference(ledger);
    const natives = nativesOf(entries);
    yield* checkImportedChains(
      ledger,
      A.flatMap(entries, (entry) => (entry._tag === "Imported" ? [entry.row] : []))
    );
    yield* checkNativeLog(ledger, natives);
    const byKey = HashMap.fromIterable(
      A.map(entries, (entry) => [claimReferenceKey(reference(entry)), entry] as const)
    );
    const known = (target: ClaimReference) => HashMap.has(byKey, claimReferenceKey(target));
    const successions = recordsOf(records, "Succession");
    yield* checkTargets(ledger, records, known);
    const predecessors = yield* addSuccessions(ledger, known, storedPredecessors(ledger, entries), successions);
    const successors = successorIndex(predecessors);
    yield* checkForks(ledger, successors);
    yield* checkSuccessionKeys(ledger, byKey, successions);
    const nativeStart = HashMap.fromIterable(
      A.map(
        natives,
        (row) => [claimReferenceKey(nativeReference(row.record.claim)), row.record.core.knowledgeStart] as const
      )
    );
    const successorStart = (key: string) =>
      O.flatMap(O.flatMap(HashMap.get(successors, key), A.head), (successor) => HashMap.get(nativeStart, successor));
    const joined = A.map(
      entries,
      joinEntry<Imported, Native, Review, Signals>({
        reference,
        predecessors,
        evidence: evidenceByClaim(recordsOf(records, "Evidence")),
        reviews: latestBy(recordsOf(records, "Review"), (record) => claimReferenceKey(record.claim)),
        signals: latestBy(recordsOf(records, "Signals"), (record) => claimReferenceKey(record.claim)),
        successorStart,
        proposed: options.proposed,
      })
    );
    return yield* checkKnowledgeOrder(ledger, joined, successorStart);
  });

/**
 * Verify every native core, resolve the whole history and join each claim with its records.
 *
 * **Details**
 * Imported knowledge keeps its original expiry; a native successor closes an open imported
 * interval at its own knowledge start. A successor that starts before its predecessor was
 * recorded, whatever the predecessor's own expiry, and any joined interval whose end precedes
 * its start are refused as `inverted-knowledge` before any interval is built. The latest review or signal record replaces the stored
 * one; native claims without a review record are proposed.
 *
 * @category projections
 * @since 0.0.0
 */
export const readClaimHistory = Effect.fnUntraced(function* <
  Imported extends ImportedFacts<Review, Signals>,
  Native extends NativeFacts,
  Review,
  Signals,
  E,
  R,
>(options: {
  readonly ledger: ClaimImportLedger;
  readonly lines: ReadonlyArray<ClaimLine<Imported, Native, Review, Signals>>;
  readonly proposed: Review;
  readonly mint: (core: Native["record"]["core"]) => Effect.Effect<ClaimId, E, R>;
}) {
  const { ledger, proposed } = options;
  const { entries, records } = partitionLines(options.lines);
  yield* Effect.forEach(nativesOf(entries), (native) => verifyNativeCore(ledger, native, options.mint), {
    concurrency: 1,
    discard: true,
  });
  return yield* Effect.fromResult(joinClaimHistory({ ledger, entries, records, proposed }));
});

/**
 * Check v2 events against the whole existing history before any line is written.
 *
 * **Details**
 * Every existing native core is verified as a later read would verify it, so an append never
 * succeeds onto a history that read refuses. Each new core is verified and folded through the
 * owner's append law in order; the extended history must then join under the same rules.
 *
 * @category validation
 * @since 0.0.0
 */
export const checkAppend = Effect.fnUntraced(function* <
  Imported extends ImportedFacts<Review, Signals>,
  Native extends NativeFacts,
  Review,
  Signals,
  E1,
  R1,
  E2,
  R2,
>(options: {
  readonly ledger: ClaimImportLedger;
  readonly existing: ReadonlyArray<ClaimLine<Imported, Native, Review, Signals>>;
  readonly added: ReadonlyArray<ClaimLine<Imported, Native, Review, Signals>>;
  readonly proposed: Review;
  readonly mint: (core: Native["record"]["core"]) => Effect.Effect<ClaimId, E1, R1>;
  readonly appendClaim: (
    log: ReadonlyArray<ClaimLogEntry>,
    record: Native["record"],
    generation: { readonly activity: ActivityId; readonly at: DateTime.Utc }
  ) => Effect.Effect<{ readonly _tag: "Appended" | "Refused"; readonly log: ReadonlyArray<ClaimLogEntry> }, E2, R2>;
}) {
  const { ledger, proposed } = options;
  const existing = partitionLines(options.existing);
  const added = partitionLines(options.added);
  yield* Effect.forEach(nativesOf(existing.entries), (native) => verifyNativeCore(ledger, native, options.mint), {
    concurrency: 1,
    discard: true,
  });
  let log: ReadonlyArray<ClaimLogEntry> = A.map(nativesOf(existing.entries), toLogEntry);
  for (const native of nativesOf(added.entries)) {
    yield* verifyNativeCore(ledger, native, options.mint);
    const generation = { activity: native.record.core.generatedBy, at: native.generatedAt };
    const appended = yield* Effect.orDie(options.appendClaim(log, native.record, generation));
    if (appended._tag === "Refused")
      return yield* refuse(ledger, nativeReference(native.record.claim), "log-violation");
    log = appended.log;
  }
  return yield* Effect.fromResult(
    joinClaimHistory({
      ledger,
      entries: A.appendAll(existing.entries, added.entries),
      records: A.appendAll(existing.records, added.records),
      proposed,
    })
  );
});
