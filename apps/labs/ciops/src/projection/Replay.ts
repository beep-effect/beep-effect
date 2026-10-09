/**
 * Golden-journal differential replay for the S7 admission projection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CiopsId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Sha256Hex } from "@beep/schema/Sha256";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Eq from "effect/Equal";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { projectSchedule } from "./Engine.ts";
import { PosInt } from "./PosInt.ts";
import {
  AdmissionCoordinationProtocol,
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
 * replayed ledger cannot see (P2 Ruling 9). `activeGrantNonces` defaults to
 * empty; replay fills it with the grants active in the replayed ledger at the
 * grant instant, sorted, before this grant joins it.
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
    activeGrantNonces: S.Array(S.String).pipe(S.withConstructorDefault(Effect.succeed([]))),
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
 * import * as DateTime from "effect/DateTime";
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
 * import * as Effect from "effect/Effect";
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
 * import * as Effect from "effect/Effect";
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
    const activeGrantNonces = ledger.activeGrants.pipe(HashMap.keys, A.fromIterable, A.sort(Order.String));
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
        activeGrantNonces,
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
          activeGrantNonces,
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
 * import * as Effect from "effect/Effect";
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
 * The two arms of CQ-009, as the pinned query binds them in `?arm`.
 *
 * **Example** (Recognize the same-checkout arm)
 *
 * ```ts
 * import { Cq009Arm } from "@/projection/Replay"
 *
 * console.log(Cq009Arm.is["same-checkout"]("same-checkout")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Cq009Arm = LiteralKit(["same-checkout", "legacy-origin-drain"]).pipe(
  $I.annoteSchema("Cq009Arm", {
    description: "One arm of CQ-009: the same-checkout exclusion or the legacy-origin drain.",
  })
);

/**
 * Decoded arm accepted by {@link Cq009Arm}.
 *
 * @see {@link Cq009Arm} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type Cq009Arm = typeof Cq009Arm.Type;

/**
 * What the replayed journal says about one CQ-009 arm.
 *
 * **Details**
 *
 * `holds`: the arm was evaluated and returned no in-scope pair. `violated`:
 * at least one in-scope pair. `unobservable`: the journal does not record what
 * the arm reads, so it is neither held nor violated.
 *
 * **Example** (Recognize an unobservable arm)
 *
 * ```ts
 * import { Cq009ArmStatus } from "@/projection/Replay"
 *
 * console.log(Cq009ArmStatus.is.unobservable("unobservable")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Cq009ArmStatus = LiteralKit(["holds", "violated", "unobservable"]).pipe(
  $I.annoteSchema("Cq009ArmStatus", {
    description: "Whether one CQ-009 arm holds, is violated, or cannot be observed in the journal.",
  })
);

/**
 * Decoded arm status accepted by {@link Cq009ArmStatus}.
 *
 * @see {@link Cq009ArmStatus} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type Cq009ArmStatus = typeof Cq009ArmStatus.Type;

/**
 * Whether a same-checkout pair falls inside the arm's scope.
 *
 * **Details**
 *
 * `drain-window`: either grant records `legacy-origin-lock/v1` by value. The
 * pre-#929 release admits such pairs during the legacy drain, so they are
 * lawful drain-window state, never violations. `in-scope`: every other pair,
 * including one whose protocol the journal does not record; an absent
 * protocol is never read as legacy.
 *
 * **Example** (Recognize drain-window state)
 *
 * ```ts
 * import { Cq009PairRegime } from "@/projection/Replay"
 *
 * console.log(Cq009PairRegime.is["drain-window"]("drain-window")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const Cq009PairRegime = LiteralKit(["in-scope", "drain-window"]).pipe(
  $I.annoteSchema("Cq009PairRegime", {
    description: "Whether a same-checkout pair is in the arm's scope or legacy drain-window state.",
  })
);

/**
 * Decoded pair regime accepted by {@link Cq009PairRegime}.
 *
 * @see {@link Cq009PairRegime} for runtime decoding and literal helpers.
 * @category models
 * @since 0.0.0
 */
export type Cq009PairRegime = typeof Cq009PairRegime.Type;

/**
 * Two concurrently active grants that hold the same checkout.
 *
 * **Details**
 *
 * `holderNonce` was active in the replayed ledger when `entrantNonce` was
 * admitted at `eventIndex`, so the overlap begins at the entrant's
 * `overlapBeginsAtMillis`.
 *
 * **Example** (Describe one same-checkout overlap)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Cq009SameCheckoutPair } from "@/projection/Replay"
 *
 * const pair = Cq009SameCheckoutPair.make({
 *   eventIndex: S.Natural.make(3),
 *   holderNonce: "holder",
 *   entrantNonce: "entrant",
 *   checkoutRoot: "<fleet>/fixture",
 *   overlapBeginsAtMillis: S.Natural.make(1200),
 *   regime: "in-scope"
 * })
 * console.log(pair.regime) // "in-scope"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class Cq009SameCheckoutPair extends S.Class<Cq009SameCheckoutPair>($I`Cq009SameCheckoutPair`)(
  {
    eventIndex: S.Natural,
    holderNonce: S.NonEmptyString,
    entrantNonce: S.NonEmptyString,
    checkoutRoot: S.String,
    overlapBeginsAtMillis: S.Natural,
    regime: Cq009PairRegime,
  },
  $I.annote("Cq009SameCheckoutPair", {
    description: "Two concurrently active replayed grants on one checkout and the instant their overlap begins.",
  })
) {}

/**
 * CQ-009's same-checkout arm evaluated over the replayed active grant set.
 *
 * **Details**
 *
 * `pairs` lists every same-checkout overlap, in-scope or drain-window; the
 * arm is `violated` exactly when one is in scope. A grant's checkout is joined
 * by nonce from its own chain's rows; a grant whose chain carries none is
 * counted in `grantsWithoutCheckout`, never given one. `grantsWithoutProtocol`
 * counts the evaluated grants whose chain records no protocol by value.
 *
 * **Example** (Describe a holding arm)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Cq009SameCheckoutArm } from "@/projection/Replay"
 *
 * const arm = Cq009SameCheckoutArm.make({
 *   status: "holds",
 *   pairs: [],
 *   evaluatedGrants: S.Natural.make(2),
 *   grantsWithoutCheckout: S.Natural.make(0),
 *   grantsWithoutProtocol: S.Natural.make(2)
 * })
 * console.log(arm.arm) // "same-checkout"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class Cq009SameCheckoutArm extends S.Class<Cq009SameCheckoutArm>($I`Cq009SameCheckoutArm`)(
  {
    arm: S.tag(Cq009Arm.Enum["same-checkout"]),
    status: Cq009ArmStatus.pick(["holds", "violated"]),
    pairs: S.Array(Cq009SameCheckoutPair),
    evaluatedGrants: S.Natural,
    grantsWithoutCheckout: S.Natural,
    grantsWithoutProtocol: S.Natural,
  },
  $I.annote("Cq009SameCheckoutArm", {
    description: "Same-checkout arm of CQ-009 over the replayed active grant set, with its pairs and gaps.",
  })
) {}

/**
 * CQ-009's legacy-origin-drain arm: unobservable in the journal, with its census.
 *
 * **Details**
 *
 * The arm reads each grant's coordination protocol, which the deployed journal
 * writer does not record, and the pinned query reads the decoded value, under
 * which a missing field would be a false green. Its status is therefore always
 * `unobservable`. `sharedOriginActivePairs` counts concurrently active replayed
 * grant pairs that share a non-empty `originKey`: a journal fact, never this
 * arm's answer, because current-protocol same-origin grants are capacity peers.
 *
 * **Example** (Describe the census of an unrecorded journal)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { Cq009LegacyDrainArm } from "@/projection/Replay"
 *
 * const arm = Cq009LegacyDrainArm.make({
 *   status: "unobservable",
 *   grantsWithOriginKey: S.Natural.make(1),
 *   rowsWithProtocol: S.Natural.make(0),
 *   rowsWithoutProtocol: S.Natural.make(4),
 *   sharedOriginActivePairs: S.Natural.make(0)
 * })
 * console.log(arm.status) // "unobservable"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class Cq009LegacyDrainArm extends S.Class<Cq009LegacyDrainArm>($I`Cq009LegacyDrainArm`)(
  {
    arm: S.tag(Cq009Arm.Enum["legacy-origin-drain"]),
    status: Cq009ArmStatus.pick(["unobservable"]),
    grantsWithOriginKey: S.Natural,
    rowsWithProtocol: S.Natural,
    rowsWithoutProtocol: S.Natural,
    sharedOriginActivePairs: S.Natural,
  },
  $I.annote("Cq009LegacyDrainArm", {
    description: "Legacy-origin-drain arm of CQ-009, unobservable in the journal, with its protocol census.",
  })
) {}

/**
 * What the CQ-009 evaluation over a retained journal window cannot see.
 *
 * **Details**
 *
 * Rows outside the retained window; the pre-v3 chains; the ledger-censored
 * verdicts; withdrawn and ticket-evicted requests, which never became grants;
 * grants active before the first retained row (outside the replayed set) and
 * grants still active at the last retained row (later overlaps unseen).
 *
 * **Example** (Describe an uncensored window)
 *
 * ```ts
 * import * as DateTime from "effect/DateTime";
 * import * as S from "effect/Schema"
 * import { Cq009Censorship } from "@/projection/Replay"
 *
 * const zero = S.Natural.make(0)
 * const censorship = Cq009Censorship.make({
 *   firstRetainedInstant: DateTime.makeUnsafe(0),
 *   lastRetainedInstant: DateTime.makeUnsafe(0),
 *   preV3Chains: zero,
 *   ledgerCensoredVerdicts: zero,
 *   withdrawnRows: zero,
 *   ticketEvictedRows: zero,
 *   grantsActiveAtFirstEdge: [],
 *   grantsActiveAtLastEdge: []
 * })
 * console.log(censorship.grantsActiveAtLastEdge.length) // 0
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class Cq009Censorship extends S.Class<Cq009Censorship>($I`Cq009Censorship`)(
  {
    firstRetainedInstant: S.DateTimeUtcFromString,
    lastRetainedInstant: S.DateTimeUtcFromString,
    preV3Chains: S.Natural,
    ledgerCensoredVerdicts: S.Natural,
    withdrawnRows: S.Natural,
    ticketEvictedRows: S.Natural,
    grantsActiveAtFirstEdge: S.Array(S.String),
    grantsActiveAtLastEdge: S.Array(S.String),
  },
  $I.annote("Cq009Censorship", {
    description: "Window edges, pre-v3 chains, censored verdicts and never-granted requests CQ-009 cannot see.",
  })
) {}

/**
 * Typed CQ-009 verdict over a replayed live journal, arm by arm.
 *
 * **Details**
 *
 * Supersedes the "temporally out of scope" reading (P3 Ruling 15). There is
 * no overall pass or failure: the same-checkout arm holds or is violated, the
 * legacy-origin-drain arm is unobservable, and the censorship says what
 * neither arm can see.
 *
 * **Example** (Read the arms of a verdict)
 *
 * ```ts
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import * as DateTime from "effect/DateTime";
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
 * const { cq009 } = buildLiveReplayReport([], report, window)
 * console.log(cq009.sameCheckout.status, cq009.legacyOriginDrain.status) // "holds" "unobservable"
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class Cq009Verdict extends S.Class<Cq009Verdict>($I`Cq009Verdict`)(
  {
    sameCheckout: Cq009SameCheckoutArm,
    legacyOriginDrain: Cq009LegacyDrainArm,
    censorship: Cq009Censorship,
  },
  $I.annote("Cq009Verdict", {
    description: "CQ-009 arm by arm over a replayed journal: same-checkout, legacy drain and censorship.",
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
 * from admitted rows only. `cq009` is the typed {@link Cq009Verdict}.
 *
 * **Example** (Wrap an empty replay)
 *
 * ```ts
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import * as DateTime from "effect/DateTime";
 * import * as S from "effect/Schema"
 * import {
 *   buildLiveReplayReport,
 *   CustodyCensus,
 *   FirstChoiceAgreement,
 *   LiveReplayReport,
 *   ReplayReport,
 *   ReplayWindow
 * } from "@/projection/Replay"
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
 * const live = LiveReplayReport.make({
 *   report,
 *   window,
 *   agreement: FirstChoiceAgreement.make({ agreed: zero, total: zero }),
 *   attributedMismatches: [],
 *   enqueueLessAdmissions: zero,
 *   withdrawnRows: zero,
 *   ticketEvictedRows: zero,
 *   custody: CustodyCensus.make({ live: zero, surrogate: zero, redacted: zero }),
 *   cq009: buildLiveReplayReport([], report, window).cq009
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
    cq009: Cq009Verdict,
  },
  $I.annote("LiveReplayReport", {
    description: "Replay report over a live pin with agreement, attributions, censorship and custody census.",
  })
) {}

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

// Each verdict pairs its admitted grant (the entrant) with every grant the
// replayed ledger held at that instant (the holders): one row per overlap.
type ActiveOverlap = readonly [verdict: ReplayEventVerdict, holderNonce: string];

const activeOverlaps = (verdicts: ReadonlyArray<ReplayEventVerdict>): ReadonlyArray<ActiveOverlap> =>
  A.flatMap(verdicts, (verdict) => A.map(verdict.activeGrantNonces, (holder): ActiveOverlap => [verdict, holder]));

const protocolOf = (event: AdmissionJournalEvent): O.Option<AdmissionCoordinationProtocol> =>
  "coordinationProtocol" in event ? event.coordinationProtocol : O.none();

// A grant's protocol is joined by nonce from its own chain's rows, read by value only.
const protocolsByNonce = (
  events: ReadonlyArray<AdmissionJournalEvent>
): HashMap.HashMap<string, AdmissionCoordinationProtocol> =>
  A.reduce(events, HashMap.empty<string, AdmissionCoordinationProtocol>(), (protocols, event) =>
    O.match(protocolOf(event), {
      onNone: () => protocols,
      onSome: (protocol) => HashMap.set(protocols, event.nonce, protocol),
    })
  );

const recordsLegacy = (protocols: HashMap.HashMap<string, AdmissionCoordinationProtocol>, nonce: string): boolean =>
  O.exists(HashMap.get(protocols, nonce), AdmissionCoordinationProtocol.is["legacy-origin-lock/v1"]);

const pairRegime = (
  protocols: HashMap.HashMap<string, AdmissionCoordinationProtocol>,
  holderNonce: string,
  entrantNonce: string
): Cq009PairRegime =>
  recordsLegacy(protocols, holderNonce) || recordsLegacy(protocols, entrantNonce)
    ? Cq009PairRegime.Enum["drain-window"]
    : Cq009PairRegime.Enum["in-scope"];

const sameCheckoutPair =
  (roots: HashMap.HashMap<string, string>, protocols: HashMap.HashMap<string, AdmissionCoordinationProtocol>) =>
  ([verdict, holderNonce]: ActiveOverlap): O.Option<Cq009SameCheckoutPair> =>
    pipe(
      HashMap.get(roots, verdict.expectedNonce),
      O.filter((root) => O.exists(HashMap.get(roots, holderNonce), Eq.equals(root))),
      O.map((checkoutRoot) =>
        Cq009SameCheckoutPair.make({
          eventIndex: verdict.eventIndex,
          holderNonce,
          entrantNonce: verdict.expectedNonce,
          checkoutRoot,
          overlapBeginsAtMillis: verdict.admittedAtMillis,
          regime: pairRegime(protocols, holderNonce, verdict.expectedNonce),
        })
      )
    );

const grantsMissing = <V>(verdicts: ReadonlyArray<ReplayEventVerdict>, joined: HashMap.HashMap<string, V>) =>
  S.Natural.make(A.countBy(verdicts, (verdict) => !HashMap.has(joined, verdict.expectedNonce)));

const sameCheckoutArm = (
  events: ReadonlyArray<AdmissionJournalEvent>,
  verdicts: ReadonlyArray<ReplayEventVerdict>
): Cq009SameCheckoutArm => {
  const roots = checkoutRootsByNonce(events);
  const protocols = protocolsByNonce(events);
  const pairs = A.getSomes(A.map(activeOverlaps(verdicts), sameCheckoutPair(roots, protocols)));
  return Cq009SameCheckoutArm.make({
    status: A.some(pairs, (pair) => Cq009PairRegime.is["in-scope"](pair.regime))
      ? Cq009ArmStatus.Enum.violated
      : Cq009ArmStatus.Enum.holds,
    pairs,
    evaluatedGrants: S.Natural.make(A.length(verdicts)),
    grantsWithoutCheckout: grantsMissing(verdicts, roots),
    grantsWithoutProtocol: grantsMissing(verdicts, protocols),
  });
};

const originKeysByNonce = (events: ReadonlyArray<AdmissionJournalEvent>): HashMap.HashMap<string, string> =>
  HashMap.fromIterable(A.map(admittedRows(events), (admitted) => [admitted.nonce, admitted.originKey] as const));

const sharesNonEmptyOrigin =
  (origins: HashMap.HashMap<string, string>) =>
  ([verdict, holderNonce]: ActiveOverlap): boolean =>
    O.exists(
      HashMap.get(origins, verdict.expectedNonce),
      (origin) => Str.isNonEmpty(origin) && O.exists(HashMap.get(origins, holderNonce), Eq.equals(origin))
    );

const legacyDrainArm = (
  events: ReadonlyArray<AdmissionJournalEvent>,
  verdicts: ReadonlyArray<ReplayEventVerdict>
): Cq009LegacyDrainArm => {
  const rowsWithProtocol = A.countBy(events, (event) => O.isSome(protocolOf(event)));
  return Cq009LegacyDrainArm.make({
    status: Cq009ArmStatus.Enum.unobservable,
    grantsWithOriginKey: S.Natural.make(
      A.countBy(admittedRows(events), (admitted) => Str.isNonEmpty(admitted.originKey))
    ),
    rowsWithProtocol: S.Natural.make(rowsWithProtocol),
    rowsWithoutProtocol: S.Natural.make(A.length(events) - rowsWithProtocol),
    sharedOriginActivePairs: S.Natural.make(
      A.countBy(activeOverlaps(verdicts), sharesNonEmptyOrigin(originKeysByNonce(events)))
    ),
  });
};

// Grants admitted in the window with no terminal row in it and no inferred eviction.
const grantsActiveAtLastEdge = (
  events: ReadonlyArray<AdmissionJournalEvent>,
  report: ReplayReport
): ReadonlyArray<string> => {
  const closed = HashSet.union(
    HashSet.union(noncesTagged(events, "admission-released"), noncesTagged(events, "admission-lease-evicted")),
    HashSet.fromIterable(A.map(report.evictions, (eviction) => eviction.evictedNonce))
  );
  return A.filter(
    A.map(report.verdicts, (verdict) => verdict.expectedNonce),
    (nonce) => !HashSet.has(closed, nonce)
  );
};

const cq009Censorship = (
  events: ReadonlyArray<AdmissionJournalEvent>,
  report: ReplayReport,
  window: ReplayWindow
): Cq009Censorship =>
  Cq009Censorship.make({
    firstRetainedInstant: window.firstRetainedInstant,
    lastRetainedInstant: window.lastRetainedInstant,
    preV3Chains: window.preV3Chains,
    ledgerCensoredVerdicts: S.Natural.make(A.countBy(report.verdicts, (verdict) => verdict.ledgerCensored)),
    withdrawnRows: rowsTagged(events, "admission-withdrawn"),
    ticketEvictedRows: rowsTagged(events, "admission-ticket-evicted"),
    grantsActiveAtFirstEdge: A.dedupe(A.map(report.skippedRows, (row) => row.nonce)),
    grantsActiveAtLastEdge: grantsActiveAtLastEdge(events, report),
  });

const cq009Verdict = (
  events: ReadonlyArray<AdmissionJournalEvent>,
  report: ReplayReport,
  window: ReplayWindow
): Cq009Verdict =>
  Cq009Verdict.make({
    sameCheckout: sameCheckoutArm(events, report.verdicts),
    legacyOriginDrain: legacyDrainArm(events, report.verdicts),
    censorship: cq009Censorship(events, report, window),
  });

/**
 * Wraps a windowed replay report with the live agreement and census.
 *
 * **Details**
 *
 * Agreement counts `pass` verdicts out of all verdicts, the golden unit.
 * Every disagreement is attributed by joining nonces to the pinned rows'
 * `checkoutRoot`: when the projected head's checkout equals an active grant's
 * checkout, the deployed #929 same-checkout skip explains it. CQ-009 is
 * evaluated over the replayed active set each verdict records: the
 * same-checkout arm holds or is violated, the legacy-origin-drain arm is
 * unobservable with its census, and the censorship states the window's
 * blind spots. Censuses are computed in fixed literal order, so the result
 * is byte-deterministic.
 *
 * **Example** (Wrap an empty replay)
 *
 * ```ts
 * import { Sha256Hex } from "@beep/schema/Sha256"
 * import * as DateTime from "effect/DateTime";
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
 * console.log(buildLiveReplayReport([], report, window).cq009.sameCheckout.status) // "holds"
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
      cq009: cq009Verdict(events, report, window),
    });
  }
);
