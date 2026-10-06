/**
 * Golden-journal differential replay for the S7 admission projection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CiopsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Sha256Hex } from "@beep/schema/Sha256";
import { DateTime, Effect, HashMap, HashSet, Match, Order, pipe } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { projectSchedule } from "./Engine.ts";
import { PosInt } from "./PosInt.ts";
import {
  AdmissionJournalEvent,
  AdmissionRowCustody,
  AdmissionWorkKind,
  admissionRowCustody,
  emptyTokenLedger,
  PendingRequest,
  PolicyDecodeError,
  ProjectionInput,
  ProjectionMismatch,
  ReplayMismatchError,
  TokenLedgerState,
} from "./Schemas.ts";
import type { AdmissionJournalAdmitted, AdmissionPolicyParams } from "./Schemas.ts";

const decodeAdmissionJournalEventJson = S.decodeEffect(S.fromJsonString(AdmissionJournalEvent));

const $I = $CiopsId.create("projection/Replay");

/**
 * Per-event outcome labels emitted by differential replay.
 *
 * **Example** (Recognize a passing verdict)
 *
 * ```ts
 * import { ReplayEventOutcome } from "@/projection/Replay"
 *
 * console.log(ReplayEventOutcome.is.pass("pass")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReplayEventOutcome = LiteralKit(["pass", "mismatch"]).pipe(
  $I.annoteSchema("ReplayEventOutcome", {
    description: "Whether one actual admission equals the projection's first prescribed admission.",
  })
);

/**
 * Decoded replay-event outcome accepted by {@link ReplayEventOutcome}.
 *
 * @see {@link ReplayEventOutcome} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type ReplayEventOutcome = typeof ReplayEventOutcome.Type;

/**
 * Differential verdict recorded for one admitted journal transition.
 *
 * **Details**
 *
 * `ledgerCensored` defaults to `false`. A windowed replay sets it on every
 * verdict before the last terminal row it skipped: until that row, the
 * deployed ledger held a grant admitted before the retained window, which the
 * replayed ledger cannot see (P2 Ruling 9).
 *
 * **Example** (Construct a passing event verdict)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ReplayEventVerdict } from "@/projection/Replay"
 *
 * const verdict = ReplayEventVerdict.make({
 *   eventIndex: S.Natural.make(0),
 *   admittedAtMillis: S.Natural.make(1000),
 *   expectedNonce: "request-1",
 *   projectedNonce: "request-1",
 *   pendingCount: S.Natural.make(1),
 *   activeTokenTotal: S.Natural.make(0),
 *   outcome: "pass"
 * })
 * console.log(verdict.outcome) // "pass"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class ReplayEventVerdict extends S.Class<ReplayEventVerdict>($I`ReplayEventVerdict`)(
  {
    eventIndex: S.Natural,
    admittedAtMillis: S.Natural,
    expectedNonce: S.NonEmptyString,
    projectedNonce: S.String,
    pendingCount: S.Natural,
    activeTokenTotal: S.Natural,
    outcome: ReplayEventOutcome,
    ledgerCensored: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
  },
  $I.annote("ReplayEventVerdict", {
    description: "Expected and projected first admission at one golden-journal grant instant.",
  })
) {}

/**
 * Census entry for a provably phantom grant removed from the replay ledger.
 *
 * **Details**
 *
 * Replay records an eviction only when the journal contains no later release
 * for the active grant and a recorded admission proves that retaining its
 * charge would make the deployed transition infeasible.
 *
 * **Example** (Record an inferred eviction)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { InferredLeaseEviction } from "@/projection/Replay"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 *
 * const eviction = InferredLeaseEviction.make({
 *   eventIndex: S.Natural.make(66),
 *   evictedNonce: "1813f29f-example",
 *   weightTokens: PosInt.make(5),
 *   activeTokenTotalBefore: S.Natural.make(10),
 *   activeTokenTotalAfter: S.Natural.make(5)
 * })
 * console.log(eviction.activeTokenTotalAfter) // 5
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class InferredLeaseEviction extends S.Class<InferredLeaseEviction>($I`InferredLeaseEviction`)(
  {
    eventIndex: S.Natural,
    evictedNonce: S.NonEmptyString,
    weightTokens: PosInt,
    activeTokenTotalBefore: S.Natural,
    activeTokenTotalAfter: S.Natural,
  },
  $I.annote("InferredLeaseEviction", {
    description: "A never-released active grant evicted when a recorded admission proves its lease had died.",
  })
) {}

/**
 * Ledger-releasing journal tags a windowed replay may skip.
 *
 * **Example** (Recognize a release tag)
 *
 * ```ts
 * import { ReplayTerminalTag } from "@/projection/Replay"
 *
 * console.log(ReplayTerminalTag.is["admission-released"]("admission-released")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReplayTerminalTag = LiteralKit(["admission-released", "admission-lease-evicted"]).pipe(
  $I.annoteSchema("ReplayTerminalTag", {
    description: "Journal tags that release an active admission charge during replay.",
  })
);

/**
 * Decoded terminal tag accepted by {@link ReplayTerminalTag}.
 *
 * @see {@link ReplayTerminalTag} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type ReplayTerminalTag = typeof ReplayTerminalTag.Type;

/**
 * Terminal row a windowed replay skipped because its admission precedes the
 * retained window.
 *
 * **Details**
 *
 * The row keeps its source `eventIndex`: replay skips inside the fold, never
 * by pre-filtering, so later episode ids are unchanged. Its grant was active
 * before the window's first retained row.
 *
 * **Example** (Record a skipped release)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ReplaySkippedRow } from "@/projection/Replay"
 *
 * const row = ReplaySkippedRow.make({
 *   eventIndex: S.Natural.make(10),
 *   nonce: "trimmed-grant",
 *   tag: "admission-released",
 *   terminalAtMillis: S.Natural.make(1000)
 * })
 * console.log(row.eventIndex) // 10
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class ReplaySkippedRow extends S.Class<ReplaySkippedRow>($I`ReplaySkippedRow`)(
  {
    eventIndex: S.Natural,
    nonce: S.String,
    tag: ReplayTerminalTag,
    terminalAtMillis: S.Natural,
  },
  $I.annote("ReplaySkippedRow", {
    description: "Release or lease eviction whose admission lies before the retained journal window.",
  })
) {}

/**
 * Complete deterministic outcome of replaying one admission journal.
 *
 * **Details**
 *
 * `skippedRows` defaults to empty; only a windowed replay fills it. Skipped
 * rows count in `eventCount` but not in `releasedCount`.
 *
 * **Example** (Construct an empty replay report)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ReplayReport } from "@/projection/Replay"
 *
 * const report = ReplayReport.make({
 *   eventCount: S.Natural.make(0),
 *   admittedCount: S.Natural.make(0),
 *   releasedCount: S.Natural.make(0),
 *   verdicts: [],
 *   mismatches: [],
 *   evictions: [],
 *   passed: true
 * })
 * console.log(report.passed) // true
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class ReplayReport extends S.Class<ReplayReport>($I`ReplayReport`)(
  {
    eventCount: S.Natural,
    admittedCount: S.Natural,
    releasedCount: S.Natural,
    verdicts: S.Array(ReplayEventVerdict),
    mismatches: S.Array(ProjectionMismatch),
    evictions: S.Array(InferredLeaseEviction),
    passed: S.Boolean,
    skippedRows: S.Array(ReplaySkippedRow).pipe(S.withConstructorDefault(Effect.succeed([]))),
  },
  $I.annote("ReplayReport", {
    description: "Event counts and first-choice verdicts from deterministic differential replay.",
  })
) {}

const isOrderedWindow = (window: {
  readonly firstRetainedInstant: DateTime.Utc;
  readonly lastRetainedInstant: DateTime.Utc;
}): boolean =>
  DateTime.toEpochMillis(window.firstRetainedInstant) <= DateTime.toEpochMillis(window.lastRetainedInstant);

/**
 * Retained-window facts of one ring-trimmed admission journal pin.
 *
 * **Details**
 *
 * The live-evidence script supplies these as typed constants and asserts them
 * against the pinned bytes (P2 Ruling 9). The instants bound every row
 * instant of the retained journal. `preV3Chains` is the manifest's pre-v3
 * class count: chains with no retained enqueue row.
 *
 * **Gotchas**
 *
 * The `run4-fleet` manifest spells the pre-v3 count `released_only_chains`,
 * but it counts enqueue-less admitted→released pairs as well as release-only
 * chains; replay compares it with that class, never with the skip count alone.
 *
 * **Example** (Describe a retained window)
 *
 * ```ts
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { DateTime } from "effect"
 * import * as S from "effect/Schema"
 * import { ReplayWindow } from "@/projection/Replay"
 *
 * const window = ReplayWindow.make({
 *   firstRetainedInstant: DateTime.makeUnsafe("2026-10-01T09:32:09.602Z"),
 *   lastRetainedInstant: DateTime.makeUnsafe("2026-10-06T01:51:50.495Z"),
 *   preV3Chains: S.Natural.make(3),
 *   journalSha256: Sha256Hex.make("b691253cee4b7859dea4b3b40f339dfd7c68c6cbdfc0326e594230a6aac5df6d"),
 *   manifestSha256: Sha256Hex.make("7d22f37b879ce6e43d6dc41c5c388ea53f837e07abf1c2ad4e5a21cfeda5be6c")
 * })
 * console.log(window.preV3Chains) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReplayWindow extends S.Class<ReplayWindow>($I`ReplayWindow`)(
  S.Struct({
    firstRetainedInstant: S.DateTimeUtcFromString,
    lastRetainedInstant: S.DateTimeUtcFromString,
    preV3Chains: S.Natural,
    journalSha256: Sha256Hex,
    manifestSha256: Sha256Hex,
  }).check(S.makeFilter(isOrderedWindow, { message: "The first retained instant must not follow the last" })),
  $I.annote("ReplayWindow", {
    description: "Retained instants, pre-v3 chain count and pinned digests of one ring-trimmed journal.",
  })
) {}

/**
 * Optional replay inputs; the default replays the frozen golden unchanged.
 *
 * **Details**
 *
 * Without a `window`, a release whose admission is absent fails typed, as the
 * golden path always has. With one, such a terminal row is skipped and
 * counted in place, and the window guard runs after the fold.
 *
 * **Example** (Use the golden defaults)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { ReplayOptions } from "@/projection/Replay"
 *
 * console.log(O.isNone(ReplayOptions.make({}).window)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReplayOptions extends S.Class<ReplayOptions>($I`ReplayOptions`)(
  { window: ReplayWindow.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)) },
  $I.annote("ReplayOptions", {
    description: "Optional retained window for replaying a ring-trimmed live journal.",
  })
) {}

/**
 * Typed failure for a replay window or pin fact that disagrees with the bytes.
 *
 * **Example** (Describe a pre-v3 count disagreement)
 *
 * ```ts
 * import { ReplayWindowError } from "@/projection/Replay"
 *
 * const error = ReplayWindowError.make({
 *   message: "Replay window member preV3Chains expected 3, found 2.",
 *   member: "preV3Chains",
 *   expected: "3",
 *   actual: "2"
 * })
 * console.log(error._tag) // "ReplayWindowError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ReplayWindowError extends S.TaggedError<ReplayWindowError>($I`ReplayWindowError`)(
  "ReplayWindowError",
  { message: S.String, member: S.String, expected: S.String, actual: S.String },
  $I.annoteError<ReplayWindowError>("ReplayWindowError", {
    description: "A supplied replay window or pinned digest disagrees with the replayed bytes.",
  })
) {}

const windowDisagreement = (member: string, expected: string, actual: string) =>
  ReplayWindowError.make({
    message: `Replay window member ${member} expected ${expected}, found ${actual}.`,
    member,
    expected,
    actual,
  });

const defaultReplayOptions = ReplayOptions.make({});

const replayInputFailure = (message: string) => PolicyDecodeError.make({ message });

const decodeJournalLine = Effect.fnUntraced(function* (
  line: string,
  lineIndex: number
): Effect.fn.Return<AdmissionJournalEvent, PolicyDecodeError> {
  return yield* decodeAdmissionJournalEventJson(line).pipe(
    Effect.mapError(() => replayInputFailure(`Admission journal line ${lineIndex + 1} did not match its schema.`))
  );
});

/**
 * Schema-decodes every non-empty NDJSON record in source order.
 *
 * **Example** (Decode an empty journal)
 *
 * ```ts
 * import { decodeAdmissionJournal } from "@/projection/Replay"
 * import { Effect } from "effect"
 *
 * console.log(Effect.runSync(decodeAdmissionJournal("")).length) // 0
 * ```
 *
 * @category decoding
 * @since 0.0.0
 */
export const decodeAdmissionJournal = Effect.fn("Replay.decodeAdmissionJournal")(function* (
  source: string
): Effect.fn.Return<ReadonlyArray<AdmissionJournalEvent>, PolicyDecodeError> {
  const lines = pipe(Str.split(source, "\n"), A.filter(Str.isNonEmpty));
  return yield* Effect.forEach(lines, decodeJournalLine, { concurrency: 1 });
});

const requestFromAdmission = (event: AdmissionJournalAdmitted): PendingRequest =>
  PendingRequest.make({
    nonce: event.nonce,
    kind: event.kind,
    priority: event.priority,
    weightTokens: event.weightTokens,
    originKey: event.originKey,
    enqueuedAtMillis: event.enqueuedAtMillis,
  });

const pendingAtAdmission = (
  admittedEvents: ReadonlyArray<AdmissionJournalAdmitted>,
  actual: AdmissionJournalAdmitted
): ReadonlyArray<PendingRequest> =>
  pipe(
    admittedEvents,
    A.filter(
      (candidate) =>
        candidate.enqueuedAtMillis <= actual.admittedAtMillis &&
        (Eq.equals(candidate.nonce, actual.nonce) || actual.admittedAtMillis < candidate.admittedAtMillis)
    ),
    A.map(requestFromAdmission)
  );

const phantomGrantNonces = (events: ReadonlyArray<AdmissionJournalEvent>): HashSet.HashSet<string> =>
  HashSet.fromIterable(
    A.getSomes(
      A.map(
        events,
        (event, eventIndex): O.Option<string> =>
          Match.value(event).pipe(
            Match.tag("admission-admitted", (admitted) =>
              A.some(
                A.drop(events, eventIndex + 1),
                Match.type<AdmissionJournalEvent>().pipe(
                  Match.tag("admission-admitted", () => false),
                  Match.tag("admission-released", (released) => Eq.equals(released.nonce, admitted.nonce)),
                  Match.tag("admission-lease-evicted", (evicted) => Eq.equals(evicted.nonce, admitted.nonce)),
                  Match.tag("admission-ticket-evicted", () => false),
                  Match.tag("admission-enqueued", () => false),
                  Match.tag("admission-withdrawn", () => false),
                  Match.exhaustive
                )
              )
                ? O.none<string>()
                : O.some(admitted.nonce)
            ),
            Match.tag("admission-released", O.none<string>),
            Match.tag("admission-lease-evicted", O.none<string>),
            Match.tag("admission-ticket-evicted", O.none<string>),
            Match.tag("admission-enqueued", O.none<string>),
            Match.tag("admission-withdrawn", O.none<string>),
            Match.exhaustive
          )
      )
    )
  );

const admitToLedger = Effect.fnUntraced(function* (
  ledger: TokenLedgerState,
  event: AdmissionJournalAdmitted
): Effect.fn.Return<TokenLedgerState, PolicyDecodeError> {
  if (HashMap.has(ledger.activeGrants, event.nonce)) {
    return yield* replayInputFailure(`Admission nonce "${event.nonce}" became active twice without a release.`);
  }
  return TokenLedgerState.make({
    activeGrants: HashMap.set(ledger.activeGrants, event.nonce, event.weightTokens),
    activeReviewFixNonces: AdmissionWorkKind.is["review-fix"](event.kind)
      ? HashSet.add(ledger.activeReviewFixNonces, event.nonce)
      : ledger.activeReviewFixNonces,
    activeTokenTotal: S.Natural.make(ledger.activeTokenTotal + event.weightTokens),
  });
});

const releaseFromLedger = Effect.fnUntraced(function* (
  ledger: TokenLedgerState,
  nonce: string
): Effect.fn.Return<TokenLedgerState, PolicyDecodeError> {
  const releasedWeight = yield* pipe(
    HashMap.get(ledger.activeGrants, nonce),
    Effect.fromOption(() => replayInputFailure(`Release nonce "${nonce}" had no active admitted pair.`))
  );
  return TokenLedgerState.make({
    activeGrants: HashMap.remove(ledger.activeGrants, nonce),
    activeReviewFixNonces: HashSet.remove(ledger.activeReviewFixNonces, nonce),
    activeTokenTotal: S.Natural.make(ledger.activeTokenTotal - releasedWeight),
  });
});

const noncesTagged = (
  events: ReadonlyArray<AdmissionJournalEvent>,
  tag: AdmissionJournalEvent["_tag"]
): HashSet.HashSet<string> =>
  HashSet.fromIterable(
    A.map(
      A.filter(events, (event) => Eq.equals(event._tag, tag)),
      (event) => event.nonce
    )
  );

type JournalTag = AdmissionJournalEvent["_tag"];

const admittedRows = (events: ReadonlyArray<AdmissionJournalEvent>): ReadonlyArray<AdmissionJournalAdmitted> =>
  A.getSomes(
    A.map(events, (event) => (event._tag === "admission-admitted" ? O.some(event) : O.none<AdmissionJournalAdmitted>()))
  );

// Chains with a retained admitted or enqueued row: their terminal rows must pair, never skip.
const retainedChainNonces = (events: ReadonlyArray<AdmissionJournalEvent>): HashSet.HashSet<string> =>
  HashSet.union(noncesTagged(events, "admission-admitted"), noncesTagged(events, "admission-enqueued"));

// P2 Ruling 9: under a window, only a terminal row of a chain with neither an admitted nor
// an enqueued retained row is skipped; any other unpaired terminal row fails typed.
const isTrimmedTerminal = (options: ReplayOptions, retainedChains: HashSet.HashSet<string>, nonce: string): boolean =>
  O.isSome(options.window) && !HashSet.has(retainedChains, nonce);

const chainTerminalTags = HashSet.fromIterable<JournalTag>([
  "admission-released",
  "admission-withdrawn",
  "admission-lease-evicted",
  "admission-ticket-evicted",
]);

const preV3ExcludedTags = HashSet.fromIterable<JournalTag>([
  "admission-enqueued",
  "admission-lease-evicted",
  "admission-ticket-evicted",
]);

const chainTagsByNonce = (
  events: ReadonlyArray<AdmissionJournalEvent>
): HashMap.HashMap<string, ReadonlyArray<JournalTag>> =>
  A.reduce(events, HashMap.empty<string, ReadonlyArray<JournalTag>>(), (chains, event) =>
    HashMap.set(chains, event.nonce, A.append(O.getOrElse(HashMap.get(chains, event.nonce), A.empty), event._tag))
  );

// The pin manifest's `classify_chain` pre-v3 class: no retained enqueue, an admitted or
// released row, at most one terminal row and no eviction row.
const isPreV3Chain = (tags: ReadonlyArray<JournalTag>): boolean =>
  A.countBy(tags, (tag) => HashSet.has(chainTerminalTags, tag)) <= 1 &&
  !A.some(tags, (tag) => HashSet.has(preV3ExcludedTags, tag)) &&
  (A.contains(tags, "admission-admitted") || A.contains(tags, "admission-released"));

const preV3ChainNonces = (events: ReadonlyArray<AdmissionJournalEvent>): HashSet.HashSet<string> =>
  HashSet.fromIterable(HashMap.keys(HashMap.filter(chainTagsByNonce(events), isPreV3Chain)));

// Pre-v3 chains that kept an admitted row, so they replay instead of skipping.
const replayedPreV3Chains = (events: ReadonlyArray<AdmissionJournalEvent>): HashSet.HashSet<string> =>
  HashSet.intersection(preV3ChainNonces(events), noncesTagged(events, "admission-admitted"));

// Every instant a decoded row records about its own chain, in milliseconds.
const eventInstants = (event: AdmissionJournalEvent): ReadonlyArray<number> =>
  Match.value(event).pipe(
    Match.tag("admission-admitted", (admitted) => [admitted.enqueuedAtMillis, admitted.admittedAtMillis]),
    Match.tag("admission-released", (released) => [released.releasedAtMillis]),
    Match.tag("admission-lease-evicted", (evicted) => [evicted.evictedAtMillis]),
    Match.tag("admission-ticket-evicted", (evicted) => [evicted.evictedAtMillis]),
    Match.tag("admission-enqueued", (enqueued) => [enqueued.enqueuedAtMillis]),
    Match.tag("admission-withdrawn", (withdrawn) => [withdrawn.enqueuedAtMillis, withdrawn.withdrawnAtMillis]),
    Match.exhaustive
  );

const instantText = (millis: number): string => DateTime.formatIso(DateTime.makeUnsafe(millis));

const checkWindowBound = (member: string, expected: DateTime.Utc, actual: O.Option<number>) =>
  O.exists(actual, (millis) => millis === DateTime.toEpochMillis(expected))
    ? Effect.void
    : Effect.fail(
        windowDisagreement(
          member,
          DateTime.formatIso(expected),
          O.match(actual, { onNone: () => "an empty journal", onSome: instantText })
        )
      );

// Skipped releases whose chain the manifest classifier would not count as pre-v3.
const unclassifiedSkips = (
  preV3: HashSet.HashSet<string>,
  skippedRows: ReadonlyArray<ReplaySkippedRow>
): ReadonlyArray<string> =>
  A.dedupe(
    A.map(
      A.filter(
        skippedRows,
        (row) => ReplayTerminalTag.is["admission-released"](row.tag) && !HashSet.has(preV3, row.nonce)
      ),
      (row) => row.nonce
    )
  );

const checkPreV3Chains = Effect.fnUntraced(function* (
  window: ReplayWindow,
  events: ReadonlyArray<AdmissionJournalEvent>,
  skippedRows: ReadonlyArray<ReplaySkippedRow>
): Effect.fn.Return<void, ReplayWindowError> {
  const preV3 = preV3ChainNonces(events);
  if (HashSet.size(preV3) !== window.preV3Chains) {
    return yield* windowDisagreement("preV3Chains", `${window.preV3Chains}`, `${HashSet.size(preV3)}`);
  }
  const unclassified = unclassifiedSkips(preV3, skippedRows);
  if (A.length(unclassified) > 0) {
    return yield* windowDisagreement(
      "skippedRows",
      "every skipped release closes a pre-v3 chain",
      `unclassified chain(s) ${A.join(unclassified, ", ")}`
    );
  }
});

const checkReplayWindow = Effect.fnUntraced(function* (
  window: ReplayWindow,
  events: ReadonlyArray<AdmissionJournalEvent>,
  journalDigest: string,
  skippedRows: ReadonlyArray<ReplaySkippedRow>
): Effect.fn.Return<void, ReplayWindowError> {
  if (!Eq.equals(window.journalSha256, journalDigest)) {
    return yield* windowDisagreement("journalSha256", window.journalSha256, journalDigest);
  }
  yield* checkPreV3Chains(window, events, skippedRows);
  const instants = A.flatMap(events, eventInstants);
  yield* checkWindowBound(
    "firstRetainedInstant",
    window.firstRetainedInstant,
    A.match(instants, { onEmpty: O.none, onNonEmpty: (all) => O.some(A.min(all, Order.Number)) })
  );
  yield* checkWindowBound(
    "lastRetainedInstant",
    window.lastRetainedInstant,
    A.match(instants, { onEmpty: O.none, onNonEmpty: (all) => O.some(A.max(all, Order.Number)) })
  );
});

// Verdicts before the last skipped terminal row ran on a ledger missing a pre-window grant.
const censorVerdicts = (
  verdicts: ReadonlyArray<ReplayEventVerdict>,
  skippedRows: ReadonlyArray<ReplaySkippedRow>
): ReadonlyArray<ReplayEventVerdict> =>
  O.match(A.last(skippedRows), {
    onNone: () => verdicts,
    onSome: (lastSkipped) =>
      A.map(verdicts, (verdict) =>
        verdict.eventIndex < lastSkipped.eventIndex
          ? ReplayEventVerdict.make({ ...verdict, ledgerCensored: true })
          : verdict
      ),
  });

/**
 * Replays every grant instant against the projection's first prescribed step.
 *
 * **Details**
 *
 * Before folding the current grant, replay reconstructs requests whose enqueue
 * instant has arrived and whose later admission has not. The current request
 * is included until its grant transition commits; every other candidate uses
 * the binding strict `t < admittedAtMillis` boundary. Releases remove the
 * exact active charge paired by nonce.
 * Each grant verification is a bounded episode identified by
 * `replay-${journalDigest}-${eventIndex}` (zero-based source event index).
 * Replaying the same pinned journal preserves that occurrence identity.
 *
 * With `options.window` (P2 Ruling 9), a release or lease eviction whose
 * chain has neither an admitted nor an enqueued row in the journal is skipped
 * in place and recorded in `skippedRows`; any other unpaired terminal row
 * still fails typed, and enqueue-less admitted→released pairs replay
 * normally. After the fold the window guard requires the journal digest, the
 * pre-v3 chain count (classified as the pin manifest's `classify_chain`
 * does: no retained enqueue, an admitted or released row, at most one
 * terminal row and no eviction row), every skipped release to close such a
 * chain, and the first and last row instants to equal the window, failing
 * `ReplayWindowError` otherwise. Verdicts before the last skipped row are
 * marked `ledgerCensored`.
 *
 * **Example** (Replay an empty event stream)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { replayAdmissionJournal } from "@/projection/Replay"
 * import { AdmissionPolicyParams, AdmissionTokenWeights } from "@/projection/Schemas"
 * import { Effect } from "effect"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 *
 * const policy = AdmissionPolicyParams.make({
 *   capacityMaxTokens: PosInt.make(10),
 *   slotSizeGib: PosInt.make(5),
 *   reserveGib: PosInt.make(10),
 *   hardFloorGib: PosInt.make(15),
 *   heartbeatSeconds: PosInt.make(5),
 *   publishAgingSeconds: PosInt.make(120),
 *   reviewFixClassCap: PosInt.make(3),
 *   weights: AdmissionTokenWeights.make({
 *     fullProof: PosInt.make(3),
 *     mergedPreview: PosInt.make(5),
 *     reviewFix: PosInt.make(1),
 *     publish: PosInt.make(1)
 *   }),
 *   priorityOrder: ["publish", "verify"]
 * })
 * const report = Effect.runSync(replayAdmissionJournal(policy, [], "policy", "journal"))
 * console.log(report.passed) // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const replayAdmissionJournal = Effect.fn("Replay.replayAdmissionJournal")(function* (
  policy: AdmissionPolicyParams,
  events: ReadonlyArray<AdmissionJournalEvent>,
  policyDigest: string,
  journalDigest: string,
  options: ReplayOptions = defaultReplayOptions
): Effect.fn.Return<ReplayReport, PolicyDecodeError | ReplayWindowError> {
  const admittedEvents = admittedRows(events);
  const phantomNonces = phantomGrantNonces(events);
  const retainedChains = retainedChainNonces(events);
  let ledger = emptyTokenLedger;
  let admittedCount = 0;
  let releasedCount = 0;
  let eventIndex = 0;
  let verdicts = A.empty<ReplayEventVerdict>();
  let mismatches = A.empty<ProjectionMismatch>();
  let evictions = A.empty<InferredLeaseEviction>();
  let skippedRows = A.empty<ReplaySkippedRow>();

  const replayAdmitted = Effect.fn("Replay.admitted")(function* (
    admitted: AdmissionJournalAdmitted
  ): Effect.fn.Return<void, PolicyDecodeError> {
    while (ledger.activeTokenTotal + admitted.weightTokens > policy.capacityMaxTokens) {
      const activePhantomAdmissions = A.filter(
        admittedEvents,
        (candidate) => HashSet.has(phantomNonces, candidate.nonce) && HashMap.has(ledger.activeGrants, candidate.nonce)
      );
      const candidateCount = A.length(activePhantomAdmissions);
      if (candidateCount === 0) {
        break;
      }
      // The recorded admission proves capacity was freed, not which grant died:
      // evict only when the phantom attribution is unique, never by guessing.
      if (candidateCount > 1) {
        return yield* replayInputFailure(
          `Ambiguous dead-lease censorship at event ${eventIndex}: ${candidateCount} active never-released grants (${A.join(
            A.map(activePhantomAdmissions, (candidate) => candidate.nonce),
            ", "
          )}); refusing to attribute the eviction.`
        );
      }
      const phantom = yield* A.head(activePhantomAdmissions).pipe(
        Effect.fromOption(() => replayInputFailure("Phantom candidate set became empty mid-eviction."))
      );
      const weightTokens = yield* HashMap.get(ledger.activeGrants, phantom.nonce).pipe(
        Effect.fromOption(() => replayInputFailure(`Phantom admission nonce "${phantom.nonce}" was not active.`))
      );
      const activeTokenTotalBefore = ledger.activeTokenTotal;
      const activeTokenTotalAfter = S.Natural.make(activeTokenTotalBefore - weightTokens);
      ledger = TokenLedgerState.make({
        activeGrants: HashMap.remove(ledger.activeGrants, phantom.nonce),
        activeReviewFixNonces: HashSet.remove(ledger.activeReviewFixNonces, phantom.nonce),
        activeTokenTotal: activeTokenTotalAfter,
      });
      evictions = A.append(
        evictions,
        InferredLeaseEviction.make({
          eventIndex: S.Natural.make(eventIndex),
          evictedNonce: phantom.nonce,
          weightTokens,
          activeTokenTotalBefore,
          activeTokenTotalAfter,
        })
      );
    }
    const pending = pendingAtAdmission(admittedEvents, admitted);
    const proposal = yield* projectSchedule(
      ProjectionInput.make({
        episodeId: `replay-${journalDigest}-${eventIndex}`,
        policy,
        pending,
        ledger,
        projectionInstantMillis: admitted.admittedAtMillis,
        policyDigest,
        journalPrefixDigest: `${journalDigest}-${eventIndex}`,
      })
    );
    const projectedNonce = pipe(
      A.head(proposal.steps),
      O.map((step) => step.request.nonce),
      O.getOrElse(() => Str.empty)
    );
    const passed = Eq.equals(projectedNonce, admitted.nonce);
    verdicts = A.append(
      verdicts,
      ReplayEventVerdict.make({
        eventIndex: S.Natural.make(eventIndex),
        admittedAtMillis: admitted.admittedAtMillis,
        expectedNonce: admitted.nonce,
        projectedNonce,
        pendingCount: S.Natural.make(A.length(pending)),
        activeTokenTotal: ledger.activeTokenTotal,
        outcome: passed ? "pass" : "mismatch",
      })
    );
    if (!passed) {
      mismatches = A.append(
        mismatches,
        ProjectionMismatch.make({
          eventIndex: S.Natural.make(eventIndex),
          admittedAtMillis: admitted.admittedAtMillis,
          expectedNonce: admitted.nonce,
          projectedNonce,
          pendingCount: S.Natural.make(A.length(pending)),
          activeTokenTotal: ledger.activeTokenTotal,
          requestWeightTokens: admitted.weightTokens,
          wouldBeActiveTokenTotal: PosInt.make(ledger.activeTokenTotal + admitted.weightTokens),
          capacityMaxTokens: policy.capacityMaxTokens,
          activeGrantNonces: ledger.activeGrants.pipe(HashMap.keys, A.fromIterable, A.sort(Order.String)),
        })
      );
    }
    ledger = yield* admitToLedger(ledger, admitted);
    admittedCount += 1;
  });

  const replayTerminal = Effect.fn("Replay.terminal")(function* (
    nonce: string,
    tag: ReplayTerminalTag,
    terminalAtMillis: number
  ): Effect.fn.Return<void, PolicyDecodeError> {
    // Skipped in place (its index still advances), never pre-filtered.
    if (isTrimmedTerminal(options, retainedChains, nonce)) {
      skippedRows = A.append(
        skippedRows,
        ReplaySkippedRow.make({ eventIndex: S.Natural.make(eventIndex), nonce, tag, terminalAtMillis })
      );
      return;
    }
    ledger = yield* releaseFromLedger(ledger, nonce);
    releasedCount += 1;
  });

  for (const event of events) {
    yield* Match.value(event).pipe(
      Match.tag("admission-admitted", replayAdmitted),
      Match.tag("admission-released", (released) =>
        replayTerminal(released.nonce, ReplayTerminalTag.Enum["admission-released"], released.releasedAtMillis)
      ),
      Match.tag("admission-lease-evicted", (evicted) =>
        replayTerminal(evicted.nonce, ReplayTerminalTag.Enum["admission-lease-evicted"], evicted.evictedAtMillis)
      ),
      Match.tag("admission-ticket-evicted", () => Effect.void),
      Match.tag("admission-enqueued", () => Effect.void),
      Match.tag("admission-withdrawn", () => Effect.void),
      Match.exhaustive
    );
    // Every decoded row counts, including ledger-neutral queue transitions.
    // This remains the zero-based source-event index used by episode provenance.
    eventIndex += 1;
  }

  if (O.isSome(options.window)) {
    yield* checkReplayWindow(options.window.value, events, journalDigest, skippedRows);
  }

  return ReplayReport.make({
    eventCount: S.Natural.make(A.length(events)),
    admittedCount: S.Natural.make(admittedCount),
    releasedCount: S.Natural.make(releasedCount),
    verdicts: censorVerdicts(verdicts, skippedRows),
    mismatches,
    evictions,
    passed: A.length(mismatches) === 0,
    skippedRows,
  });
});

/**
 * Converts a replay report's mismatch census into a typed gating failure.
 *
 * **Example** (Accept an empty replay report)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ReplayReport, requireReplayMatch } from "@/projection/Replay"
 * import { Effect } from "effect"
 *
 * const report = ReplayReport.make({
 *   eventCount: S.Natural.make(0),
 *   admittedCount: S.Natural.make(0),
 *   releasedCount: S.Natural.make(0),
 *   verdicts: [],
 *   mismatches: [],
 *   evictions: [],
 *   passed: true
 * })
 * console.log(Effect.runSync(requireReplayMatch(report)).passed) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const requireReplayMatch = Effect.fn("Replay.requireReplayMatch")(function* (
  report: ReplayReport
): Effect.fn.Return<ReplayReport, ReplayMismatchError> {
  if (!report.passed) {
    return yield* ReplayMismatchError.make({
      message: `Differential replay found ${A.length(report.mismatches)} mismatch(es).`,
      mismatches: report.mismatches,
    });
  }
  return report;
});

/**
 * Renders the deterministic packet evidence artifact for one replay run.
 *
 * **Example** (Render a pass summary)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { ReplayReport, renderReplayEvidence } from "@/projection/Replay"
 *
 * const report = ReplayReport.make({
 *   eventCount: S.Natural.make(0),
 *   admittedCount: S.Natural.make(0),
 *   releasedCount: S.Natural.make(0),
 *   verdicts: [],
 *   mismatches: [],
 *   evictions: [],
 *   passed: true
 * })
 * console.log(renderReplayEvidence(report, "abc123").includes("PASS")) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const renderReplayEvidence: {
  (report: ReplayReport, journalDigest: string): string;
  (journalDigest: string): (report: ReplayReport) => string;
} = dual(2, (report: ReplayReport, journalDigest: string): string => {
  const verdictBody = report.passed
    ? `PASS — all ${report.admittedCount} admitted events matched the projection's first prescribed admission.`
    : A.join(
        [
          `FAIL — ${A.length(report.mismatches)} admitted event(s) diverged.`,
          "",
          "| Event index | Instant ms | Expected nonce | Projected nonce | Pending | Charge | Active / would-be / cap | Active nonces |",
          "| ---: | ---: | --- | --- | ---: | ---: | ---: | --- |",
          ...A.map(
            report.mismatches,
            (mismatch) =>
              `| ${mismatch.eventIndex} | ${mismatch.admittedAtMillis} | \`${mismatch.expectedNonce}\` | \`${mismatch.projectedNonce}\` | ${mismatch.pendingCount} | ${mismatch.requestWeightTokens} | ${mismatch.activeTokenTotal} / ${mismatch.wouldBeActiveTokenTotal} / ${mismatch.capacityMaxTokens} | ${A.join(mismatch.activeGrantNonces, ", ")} |`
          ),
        ],
        "\n"
      );
  const evictionBody = A.match(report.evictions, {
    onEmpty: () => "None.",
    onNonEmpty: (evictions) =>
      A.join(
        [
          "| Event index | Evicted nonce | Weight | Active before | Active after |",
          "| ---: | --- | ---: | ---: | ---: |",
          ...A.map(
            evictions,
            (eviction) =>
              `| ${eviction.eventIndex} | \`${eviction.evictedNonce}\` | ${eviction.weightTokens} | ${eviction.activeTokenTotalBefore} | ${eviction.activeTokenTotalAfter} |`
          ),
        ],
        "\n"
      ),
  });
  return `${A.join(
    [
      "# S7 Differential Replay Evidence",
      "",
      "> GENERATED by `apps/labs/ciops/scripts/generate-replay-evidence.ts`; do not hand-edit.",
      "",
      "## Frozen input",
      "",
      "- Journal: `ontology/extraction/s6/snapshot/raw/journal.ndjson`",
      `- SHA-256: \`${journalDigest}\``,
      `- Events: ${report.eventCount} (${report.admittedCount} admitted, ${report.releasedCount} released)`,
      "",
      "## Differential verdict",
      "",
      verdictBody,
      "",
      "The replay decodes every NDJSON row through `AdmissionJournalEvent`, folds admitted plus v1 release and v2 lease-eviction token deltas by nonce, reconstructs the pending set at each grant boundary, and compares the projection's first admission with the recorded grant.",
      "",
      "## Inferred dead-lease evictions",
      "",
      evictionBody,
      "",
      "V1 journals did not record lease death, so replay still infers a provably phantom grant only when a later admission proves the deployed ledger no longer contained it and the attribution is unique. V2 lease-eviction rows fold directly as releases; they become reliable fleet evidence only after unknown-row preservation has rolled out to every live writer.",
    ],
    "\n"
  )}\n`;
});

/**
 * Diagnostic attribution of one live first-choice disagreement.
 *
 * **Details**
 *
 * `same-checkout-active-lease`: the projected head's checkout already held an
 * active grant, which the deployed scheduler skips since #929 and admission v1
 * does not model (contract §8.3, §3.4 delta). `unattributed`: no such join.
 * The attribution is reported, never fed back into the engine.
 *
 * **Example** (Recognize the same-checkout attribution)
 *
 * ```ts
 * import { MismatchAttribution } from "@/projection/Replay"
 *
 * console.log(MismatchAttribution.is["same-checkout-active-lease"]("same-checkout-active-lease")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MismatchAttribution = LiteralKit(["same-checkout-active-lease", "unattributed"]).pipe(
  $I.annoteSchema("MismatchAttribution", {
    description: "Diagnostic cause class of one live replay first-choice disagreement.",
  })
);

/**
 * Decoded attribution accepted by {@link MismatchAttribution}.
 *
 * @see {@link MismatchAttribution} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type MismatchAttribution = typeof MismatchAttribution.Type;

/**
 * One live disagreement with its diagnostic attribution.
 *
 * **Example** (Attribute a disagreement)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { AttributedMismatch } from "@/projection/Replay"
 * import { ProjectionMismatch } from "@/projection/Schemas"
 *
 * const PosInt = S.Int.check(S.isGreaterThan(0))
 *
 * const attributed = AttributedMismatch.make({
 *   mismatch: ProjectionMismatch.make({
 *     eventIndex: S.Natural.make(4),
 *     admittedAtMillis: S.Natural.make(1000),
 *     expectedNonce: "actual",
 *     projectedNonce: "projected",
 *     pendingCount: S.Natural.make(2),
 *     activeTokenTotal: S.Natural.make(1),
 *     requestWeightTokens: PosInt.make(1),
 *     wouldBeActiveTokenTotal: PosInt.make(2),
 *     capacityMaxTokens: PosInt.make(10),
 *     activeGrantNonces: ["holder"]
 *   }),
 *   attribution: "same-checkout-active-lease",
 *   sharedCheckoutRoot: O.some("<fleet>/fixture")
 * })
 * console.log(attributed.attribution) // "same-checkout-active-lease"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class AttributedMismatch extends S.Class<AttributedMismatch>($I`AttributedMismatch`)(
  {
    mismatch: ProjectionMismatch,
    attribution: MismatchAttribution,
    sharedCheckoutRoot: S.OptionFromOptionalKey(S.String),
  },
  $I.annote("AttributedMismatch", {
    description: "Live replay disagreement with the checkout join that explains it, if any.",
  })
) {}

/**
 * First-choice agreement over the replay unit: one admitted journal row.
 *
 * **Example** (Count the golden agreement)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { FirstChoiceAgreement } from "@/projection/Replay"
 *
 * const agreement = FirstChoiceAgreement.make({ agreed: S.Natural.make(41), total: S.Natural.make(41) })
 * console.log(agreement.agreed === agreement.total) // true
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class FirstChoiceAgreement extends S.Class<FirstChoiceAgreement>($I`FirstChoiceAgreement`)(
  { agreed: S.Natural, total: S.Natural },
  $I.annote("FirstChoiceAgreement", {
    description: "Passing verdicts out of all admitted-row verdicts; integers, never a ratio.",
  })
) {}

/**
 * Row counts per {@link AdmissionRowCustody} reading.
 *
 * **Example** (Describe an all-surrogate journal)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CustodyCensus } from "@/projection/Replay"
 *
 * const census = CustodyCensus.make({
 *   live: S.Natural.make(0),
 *   surrogate: S.Natural.make(689),
 *   redacted: S.Natural.make(0)
 * })
 * console.log(census.surrogate) // 689
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class CustodyCensus extends S.Class<CustodyCensus>($I`CustodyCensus`)(
  { live: S.Natural, surrogate: S.Natural, redacted: S.Natural },
  $I.annote("CustodyCensus", {
    description: "Live, surrogate and redacted row counts of one decoded admission journal.",
  })
) {}

/**
 * Temporal scope reading of CQ-009 over a replayed journal.
 *
 * **Details**
 *
 * Since #929 concurrent same-origin admissions are legal (graduation
 * Ruling 9), so CQ-009 is in scope only for rows before that cut. The lab
 * never evaluates CQ-009; it reports the scope, never a pass or a failure.
 *
 * **Example** (Recognize the out-of-scope reading)
 *
 * ```ts
 * import { Cq009Scope } from "@/projection/Replay"
 *
 * console.log(Cq009Scope.is["temporally-out-of-scope"]("temporally-out-of-scope")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Cq009Scope = LiteralKit(["temporally-out-of-scope", "pre-929-rows-present"]).pipe(
  $I.annoteSchema("Cq009Scope", {
    description: "Whether any replayed row precedes the #929 cut that bounds CQ-009's temporal scope.",
  })
);

/**
 * Decoded CQ-009 scope accepted by {@link Cq009Scope}.
 *
 * @see {@link Cq009Scope} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type Cq009Scope = typeof Cq009Scope.Type;

/**
 * CQ-009 scope census: rows before the #929 cut out of all replayed rows.
 *
 * **Example** (Describe an all-post-#929 journal)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Cq009Reading } from "@/projection/Replay"
 *
 * const reading = Cq009Reading.make({
 *   scope: "temporally-out-of-scope",
 *   preCutRows: S.Natural.make(0),
 *   totalRows: S.Natural.make(689)
 * })
 * console.log(reading.preCutRows) // 0
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class Cq009Reading extends S.Class<Cq009Reading>($I`Cq009Reading`)(
  { scope: Cq009Scope, preCutRows: S.Natural, totalRows: S.Natural },
  $I.annote("Cq009Reading", {
    description: "Count of replayed rows that precede #929 and the resulting CQ-009 temporal scope.",
  })
) {}

/**
 * Live differential replay outcome: the replay report plus its live census.
 *
 * **Details**
 *
 * Wraps {@link ReplayReport} (P2 Ruling 9). `enqueueLessAdmissions` counts the
 * pre-v3 chains that replayed; the skipped ones are `report.skippedRows`.
 * `withdrawnRows` and `ticketEvictedRows` count the requests the pending-set
 * reconstruction never lets compete, because it rebuilds pending requests
 * from admitted rows only.
 *
 * **Example** (Wrap an empty replay)
 *
 * ```ts
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { DateTime } from "effect"
 * import * as S from "effect/Schema"
 * import {
 *   Cq009Reading,
 *   CustodyCensus,
 *   FirstChoiceAgreement,
 *   LiveReplayReport,
 *   ReplayReport,
 *   ReplayWindow
 * } from "@/projection/Replay"
 *
 * const zero = S.Natural.make(0)
 * const live = LiveReplayReport.make({
 *   report: ReplayReport.make({
 *     eventCount: zero,
 *     admittedCount: zero,
 *     releasedCount: zero,
 *     verdicts: [],
 *     mismatches: [],
 *     evictions: [],
 *     passed: true
 *   }),
 *   window: ReplayWindow.make({
 *     firstRetainedInstant: DateTime.makeUnsafe(0),
 *     lastRetainedInstant: DateTime.makeUnsafe(0),
 *     preV3Chains: zero,
 *     journalSha256: Sha256Hex.make("a".repeat(64)),
 *     manifestSha256: Sha256Hex.make("b".repeat(64))
 *   }),
 *   agreement: FirstChoiceAgreement.make({ agreed: zero, total: zero }),
 *   attributedMismatches: [],
 *   enqueueLessAdmissions: zero,
 *   withdrawnRows: zero,
 *   ticketEvictedRows: zero,
 *   custody: CustodyCensus.make({ live: zero, surrogate: zero, redacted: zero }),
 *   cq009: Cq009Reading.make({ scope: "temporally-out-of-scope", preCutRows: zero, totalRows: zero })
 * })
 * console.log(live.agreement.total) // 0
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class LiveReplayReport extends S.Class<LiveReplayReport>($I`LiveReplayReport`)(
  {
    report: ReplayReport,
    window: ReplayWindow,
    agreement: FirstChoiceAgreement,
    attributedMismatches: S.Array(AttributedMismatch),
    enqueueLessAdmissions: S.Natural,
    withdrawnRows: S.Natural,
    ticketEvictedRows: S.Natural,
    custody: CustodyCensus,
    cq009: Cq009Reading,
  },
  $I.annote("LiveReplayReport", {
    description: "Replay report over a live pin with agreement, attributions, censorship and custody census.",
  })
) {}

// #929 (`e76c4db079`) committer instant: since then same-origin concurrent admission is legal.
const issue929CutMillis = DateTime.toEpochMillis(DateTime.makeUnsafe("2026-08-31T08:20:45Z"));

const checkoutRootOf = (event: AdmissionJournalEvent): O.Option<string> =>
  "checkoutRoot" in event ? event.checkoutRoot : O.none();

const checkoutRootsByNonce = (events: ReadonlyArray<AdmissionJournalEvent>): HashMap.HashMap<string, string> =>
  A.reduce(events, HashMap.empty<string, string>(), (roots, event) =>
    O.match(checkoutRootOf(event), {
      onNone: () => roots,
      onSome: (root) => HashMap.set(roots, event.nonce, root),
    })
  );

const attributeMismatch = (
  roots: HashMap.HashMap<string, string>,
  mismatch: ProjectionMismatch
): AttributedMismatch => {
  const sharedCheckoutRoot = O.filter(HashMap.get(roots, mismatch.projectedNonce), (root) =>
    A.some(mismatch.activeGrantNonces, (nonce) => O.exists(HashMap.get(roots, nonce), (held) => Eq.equals(held, root)))
  );
  return AttributedMismatch.make({
    mismatch,
    attribution: O.isSome(sharedCheckoutRoot)
      ? MismatchAttribution.Enum["same-checkout-active-lease"]
      : MismatchAttribution.Enum.unattributed,
    sharedCheckoutRoot,
  });
};

const rowsTagged = (events: ReadonlyArray<AdmissionJournalEvent>, tag: AdmissionJournalEvent["_tag"]) =>
  S.Natural.make(A.countBy(events, (event) => Eq.equals(event._tag, tag)));

const custodyCount = (events: ReadonlyArray<AdmissionJournalEvent>, custody: AdmissionRowCustody) =>
  S.Natural.make(A.countBy(events, (event) => Eq.equals(admissionRowCustody(event), custody)));

const cq009Reading = (events: ReadonlyArray<AdmissionJournalEvent>): Cq009Reading => {
  const preCutRows = A.countBy(events, (event) => A.some(eventInstants(event), (millis) => millis < issue929CutMillis));
  return Cq009Reading.make({
    scope: preCutRows === 0 ? Cq009Scope.Enum["temporally-out-of-scope"] : Cq009Scope.Enum["pre-929-rows-present"],
    preCutRows: S.Natural.make(preCutRows),
    totalRows: S.Natural.make(A.length(events)),
  });
};

/**
 * Wraps a windowed replay report with the live agreement and census.
 *
 * **Details**
 *
 * Agreement counts `pass` verdicts out of all verdicts, the golden unit.
 * Every disagreement is attributed by joining nonces to the pinned rows'
 * `checkoutRoot`: when the projected head's checkout equals an active grant's
 * checkout, the deployed #929 same-checkout skip explains it. Censuses are
 * computed in fixed literal order, so the result is byte-deterministic.
 *
 * **Example** (Wrap an empty replay)
 *
 * ```ts
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import { DateTime } from "effect"
 * import * as S from "effect/Schema"
 * import { buildLiveReplayReport, ReplayReport, ReplayWindow } from "@/projection/Replay"
 *
 * const zero = S.Natural.make(0)
 * const report = ReplayReport.make({
 *   eventCount: zero,
 *   admittedCount: zero,
 *   releasedCount: zero,
 *   verdicts: [],
 *   mismatches: [],
 *   evictions: [],
 *   passed: true
 * })
 * const window = ReplayWindow.make({
 *   firstRetainedInstant: DateTime.makeUnsafe(0),
 *   lastRetainedInstant: DateTime.makeUnsafe(0),
 *   preV3Chains: zero,
 *   journalSha256: Sha256Hex.make("a".repeat(64)),
 *   manifestSha256: Sha256Hex.make("b".repeat(64))
 * })
 * console.log(buildLiveReplayReport([], report, window).cq009.scope) // "temporally-out-of-scope"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export const buildLiveReplayReport: {
  (events: ReadonlyArray<AdmissionJournalEvent>, report: ReplayReport, window: ReplayWindow): LiveReplayReport;
  (report: ReplayReport, window: ReplayWindow): (events: ReadonlyArray<AdmissionJournalEvent>) => LiveReplayReport;
} = dual(
  3,
  (events: ReadonlyArray<AdmissionJournalEvent>, report: ReplayReport, window: ReplayWindow): LiveReplayReport => {
    const roots = checkoutRootsByNonce(events);
    return LiveReplayReport.make({
      report,
      window,
      agreement: FirstChoiceAgreement.make({
        agreed: S.Natural.make(A.countBy(report.verdicts, (verdict) => ReplayEventOutcome.is.pass(verdict.outcome))),
        total: S.Natural.make(A.length(report.verdicts)),
      }),
      attributedMismatches: A.map(report.mismatches, (mismatch) => attributeMismatch(roots, mismatch)),
      enqueueLessAdmissions: S.Natural.make(HashSet.size(replayedPreV3Chains(events))),
      withdrawnRows: rowsTagged(events, "admission-withdrawn"),
      ticketEvictedRows: rowsTagged(events, "admission-ticket-evicted"),
      custody: CustodyCensus.make({
        live: custodyCount(events, AdmissionRowCustody.Enum.live),
        surrogate: custodyCount(events, AdmissionRowCustody.Enum.surrogate),
        redacted: custodyCount(events, AdmissionRowCustody.Enum.redacted),
      }),
      cq009: cq009Reading(events),
    });
  }
);
