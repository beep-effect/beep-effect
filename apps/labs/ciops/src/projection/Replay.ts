/**
 * Golden-journal differential replay for the S7 admission projection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $CiopsId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt, PosInt } from "@beep/schema";
import { Effect, HashMap, HashSet, Order, pipe } from "effect";
import * as A from "effect/Array";
import * as Eq from "effect/Equal";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { projectSchedule } from "./Engine.ts";
import {
  AdmissionJournalEvent,
  AdmissionWorkKind,
  emptyTokenLedger,
  PendingRequest,
  PolicyDecodeError,
  ProjectionInput,
  ProjectionMismatch,
  ReplayMismatchError,
  TokenLedgerState,
} from "./Schemas.ts";
import type {
  AdmissionJournalAdmitted,
  AdmissionJournalLeaseEvicted,
  AdmissionJournalReleased,
  AdmissionPolicyParams,
} from "./Schemas.ts";

const $I = $CiopsId.create("projection/Replay");

/**
 * Per-event outcome labels emitted by differential replay.
 *
 * **Example** (Recognize a passing verdict)
 *
 * ```ts
 * import { ReplayEventOutcome } from "@beep/ciops/src/projection/Replay"
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
 * **Example** (Construct a passing event verdict)
 *
 * ```ts
 * import { ReplayEventVerdict } from "@beep/ciops/src/projection/Replay"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const verdict = ReplayEventVerdict.make({
 *   eventIndex: NonNegativeInt.make(0),
 *   admittedAtMillis: NonNegativeInt.make(1000),
 *   expectedNonce: "request-1",
 *   projectedNonce: "request-1",
 *   pendingCount: NonNegativeInt.make(1),
 *   activeTokenTotal: NonNegativeInt.make(0),
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
    eventIndex: NonNegativeInt,
    admittedAtMillis: NonNegativeInt,
    expectedNonce: S.NonEmptyString,
    projectedNonce: S.String,
    pendingCount: NonNegativeInt,
    activeTokenTotal: NonNegativeInt,
    outcome: ReplayEventOutcome,
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
 * import { InferredLeaseEviction } from "@beep/ciops/src/projection/Replay"
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 *
 * const eviction = InferredLeaseEviction.make({
 *   eventIndex: NonNegativeInt.make(66),
 *   evictedNonce: "1813f29f-example",
 *   weightTokens: PosInt.make(5),
 *   activeTokenTotalBefore: NonNegativeInt.make(10),
 *   activeTokenTotalAfter: NonNegativeInt.make(5)
 * })
 * console.log(eviction.activeTokenTotalAfter) // 5
 * ```
 *
 * @category diagnostics
 * @since 0.0.0
 */
export class InferredLeaseEviction extends S.Class<InferredLeaseEviction>($I`InferredLeaseEviction`)(
  {
    eventIndex: NonNegativeInt,
    evictedNonce: S.NonEmptyString,
    weightTokens: PosInt,
    activeTokenTotalBefore: NonNegativeInt,
    activeTokenTotalAfter: NonNegativeInt,
  },
  $I.annote("InferredLeaseEviction", {
    description: "A never-released active grant evicted when a recorded admission proves its lease had died.",
  })
) {}

/**
 * Complete deterministic outcome of replaying one admission journal.
 *
 * **Example** (Construct an empty replay report)
 *
 * ```ts
 * import { ReplayReport } from "@beep/ciops/src/projection/Replay"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const report = ReplayReport.make({
 *   eventCount: NonNegativeInt.make(0),
 *   admittedCount: NonNegativeInt.make(0),
 *   releasedCount: NonNegativeInt.make(0),
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
    eventCount: NonNegativeInt,
    admittedCount: NonNegativeInt,
    releasedCount: NonNegativeInt,
    verdicts: S.Array(ReplayEventVerdict),
    mismatches: S.Array(ProjectionMismatch),
    evictions: S.Array(InferredLeaseEviction),
    passed: S.Boolean,
  },
  $I.annote("ReplayReport", {
    description: "Event counts and first-choice verdicts from deterministic differential replay.",
  })
) {}

const replayInputFailure = (message: string) => PolicyDecodeError.make({ message });

const decodeJournalLine = Effect.fnUntraced(function* (
  line: string,
  lineIndex: number
): Effect.fn.Return<AdmissionJournalEvent, PolicyDecodeError> {
  return yield* S.decodeEffect(S.fromJsonString(AdmissionJournalEvent))(line).pipe(
    Effect.mapError(() => replayInputFailure(`Admission journal line ${lineIndex + 1} did not match its schema.`))
  );
});

/**
 * Schema-decodes every non-empty NDJSON record in source order.
 *
 * **Example** (Decode an empty journal)
 *
 * ```ts
 * import { decodeAdmissionJournal } from "@beep/ciops/src/projection/Replay"
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
          AdmissionJournalEvent.match(event, {
            "admission-admitted": (admitted) =>
              A.some(
                A.drop(events, eventIndex + 1),
                AdmissionJournalEvent.match({
                  "admission-admitted": () => false,
                  "admission-released": (released) => Eq.equals(released.nonce, admitted.nonce),
                  "admission-lease-evicted": (evicted) => Eq.equals(evicted.nonce, admitted.nonce),
                  "admission-ticket-evicted": () => false,
                })
              )
                ? O.none<string>()
                : O.some(admitted.nonce),
            "admission-released": O.none<string>,
            "admission-lease-evicted": O.none<string>,
            "admission-ticket-evicted": O.none<string>,
          })
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
    activeTokenTotal: NonNegativeInt.make(ledger.activeTokenTotal + event.weightTokens),
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
    activeTokenTotal: NonNegativeInt.make(ledger.activeTokenTotal - releasedWeight),
  });
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
 *
 * **Example** (Replay an empty event stream)
 *
 * ```ts
 * import { replayAdmissionJournal } from "@beep/ciops/src/projection/Replay"
 * import { AdmissionPolicyParams, AdmissionTokenWeights } from "@beep/ciops/src/projection/Schemas"
 * import { PosInt } from "@beep/schema"
 * import { Effect } from "effect"
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
  journalDigest: string
): Effect.fn.Return<ReplayReport, PolicyDecodeError> {
  const admittedEvents: ReadonlyArray<AdmissionJournalAdmitted> = A.getSomes(
    A.map(
      events,
      (event): O.Option<AdmissionJournalAdmitted> =>
        AdmissionJournalEvent.match(event, {
          "admission-admitted": (admitted) => O.some(admitted),
          "admission-released": O.none<AdmissionJournalAdmitted>,
          "admission-lease-evicted": O.none<AdmissionJournalAdmitted>,
          "admission-ticket-evicted": O.none<AdmissionJournalAdmitted>,
        })
    )
  );
  const phantomNonces = phantomGrantNonces(events);
  let ledger = emptyTokenLedger;
  let admittedCount = 0;
  let releasedCount = 0;
  let eventIndex = 0;
  let verdicts = A.empty<ReplayEventVerdict>();
  let mismatches = A.empty<ProjectionMismatch>();
  let evictions = A.empty<InferredLeaseEviction>();

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
      const activeTokenTotalAfter = NonNegativeInt.make(activeTokenTotalBefore - weightTokens);
      ledger = TokenLedgerState.make({
        activeGrants: HashMap.remove(ledger.activeGrants, phantom.nonce),
        activeReviewFixNonces: HashSet.remove(ledger.activeReviewFixNonces, phantom.nonce),
        activeTokenTotal: activeTokenTotalAfter,
      });
      evictions = A.append(
        evictions,
        InferredLeaseEviction.make({
          eventIndex: NonNegativeInt.make(eventIndex),
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
        eventIndex: NonNegativeInt.make(eventIndex),
        admittedAtMillis: admitted.admittedAtMillis,
        expectedNonce: admitted.nonce,
        projectedNonce,
        pendingCount: NonNegativeInt.make(A.length(pending)),
        activeTokenTotal: ledger.activeTokenTotal,
        outcome: passed ? "pass" : "mismatch",
      })
    );
    if (!passed) {
      mismatches = A.append(
        mismatches,
        ProjectionMismatch.make({
          eventIndex: NonNegativeInt.make(eventIndex),
          admittedAtMillis: admitted.admittedAtMillis,
          expectedNonce: admitted.nonce,
          projectedNonce,
          pendingCount: NonNegativeInt.make(A.length(pending)),
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

  const replayReleased = Effect.fn("Replay.released")(function* (
    released: AdmissionJournalReleased
  ): Effect.fn.Return<void, PolicyDecodeError> {
    ledger = yield* releaseFromLedger(ledger, released.nonce);
    releasedCount += 1;
  });

  const replayLeaseEvicted = Effect.fn("Replay.leaseEvicted")(function* (
    evicted: AdmissionJournalLeaseEvicted
  ): Effect.fn.Return<void, PolicyDecodeError> {
    ledger = yield* releaseFromLedger(ledger, evicted.nonce);
    releasedCount += 1;
  });

  for (const event of events) {
    yield* AdmissionJournalEvent.match(event, {
      "admission-admitted": replayAdmitted,
      "admission-released": replayReleased,
      "admission-lease-evicted": replayLeaseEvicted,
      "admission-ticket-evicted": () => Effect.void,
    });
    eventIndex += 1;
  }

  return ReplayReport.make({
    eventCount: NonNegativeInt.make(A.length(events)),
    admittedCount: NonNegativeInt.make(admittedCount),
    releasedCount: NonNegativeInt.make(releasedCount),
    verdicts,
    mismatches,
    evictions,
    passed: A.length(mismatches) === 0,
  });
});

/**
 * Converts a replay report's mismatch census into a typed gating failure.
 *
 * **Example** (Accept an empty replay report)
 *
 * ```ts
 * import { ReplayReport, requireReplayMatch } from "@beep/ciops/src/projection/Replay"
 * import { NonNegativeInt } from "@beep/schema"
 * import { Effect } from "effect"
 *
 * const report = ReplayReport.make({
 *   eventCount: NonNegativeInt.make(0),
 *   admittedCount: NonNegativeInt.make(0),
 *   releasedCount: NonNegativeInt.make(0),
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
 * import { ReplayReport, renderReplayEvidence } from "@beep/ciops/src/projection/Replay"
 * import { NonNegativeInt } from "@beep/schema"
 *
 * const report = ReplayReport.make({
 *   eventCount: NonNegativeInt.make(0),
 *   admittedCount: NonNegativeInt.make(0),
 *   releasedCount: NonNegativeInt.make(0),
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
