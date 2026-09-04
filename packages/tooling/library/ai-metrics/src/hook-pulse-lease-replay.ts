/**
 * Enumerate-before-read replay of HookPulseV1 ledgers into active leases.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Defect, LiteralKit, NonNegativeInt, PosInt } from "@beep/schema";
import { Context, Effect, FileSystem, Layer, MutableHashMap, Order, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AiMetricsAbsoluteDataRoot } from "./data-root.ts";
import { HookPulseV1, hookPulseLedgerDir } from "./hook-pulse.ts";
import { HookPulseLeaseProjectionInput, projectHookPulseLease } from "./hook-pulse-lease-emitter.ts";
import { collectNdjsonFiles } from "./internal/jsonl-discovery.ts";
import { SessionLeaseReconciliationEvidence } from "./session-lease.ts";
import { SessionLeaseExpiryScanInput, SessionLeaseStore } from "./session-lease-store.ts";
import { OipTaint } from "./telemetry-v2.ts";
import type { Sha256Hex } from "@beep/schema";
import type { Path } from "effect";
import type { SessionLeaseExpiryCandidate } from "./session-lease.ts";
import type { SessionLeaseStoreProjectionResult } from "./session-lease-store.ts";

const $I = $RepoAiMetricsId.create("hook-pulse-lease-replay");
const replaySchemaVersion = "telemetry-v2/hook-pulse-lease-replay/v1";

/**
 * Canonical store, evidence root, and source taint for one hook-ledger replay.
 *
 * **Example** (Inspect the explicit evidence root)
 *
 * ```ts
 * import { HookPulseLeaseReplayInput } from "@beep/repo-ai-metrics"
 *
 * console.log(HookPulseLeaseReplayInput.fields.evidenceRoot)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HookPulseLeaseReplayInput extends S.Class<HookPulseLeaseReplayInput>($I`HookPulseLeaseReplayInput`)(
  {
    dataRoot: AiMetricsAbsoluteDataRoot,
    evaluatedAt: S.DateTimeUtcFromString,
    evidenceRoot: S.String,
    oipTaint: OipTaint,
    ttlMs: PosInt,
  },
  $I.annote("HookPulseLeaseReplayInput", {
    description: "Canonical store and privacy-safe hook-ledger root consumed by one lease replay.",
  })
) {}

/**
 * Count-only receipt for one complete hook-ledger lease replay.
 *
 * **Details**
 *
 * `enumeratedFileCount` is fixed before any file is opened. Decoder failures
 * remain explicit in `rejectedLineCount`; session-level attribution failures
 * are durably persisted by the lease store and counted as quarantines.
 *
 * **Example** (Inspect the pre-read denominator)
 *
 * ```ts
 * import { HookPulseLeaseReplayResult } from "@beep/repo-ai-metrics"
 *
 * console.log(HookPulseLeaseReplayResult.fields.enumeratedFileCount)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class HookPulseLeaseReplayResult extends S.Class<HookPulseLeaseReplayResult>($I`HookPulseLeaseReplayResult`)(
  S.Struct({
    schemaVersion: S.Literal(replaySchemaVersion),
    acceptedSessionCount: NonNegativeInt,
    decodedRowCount: NonNegativeInt,
    deferredTombstoneCount: NonNegativeInt,
    enumeratedFileCount: NonNegativeInt,
    expiryCandidateCount: NonNegativeInt,
    missingReconciliationEvidenceCount: NonNegativeInt,
    openLeaseCount: NonNegativeInt,
    quarantinedSessionCount: NonNegativeInt,
    reconciledCandidateCount: NonNegativeInt,
    rejectedLineCount: NonNegativeInt,
    sessionCount: NonNegativeInt,
    tombstonedSessionCount: NonNegativeInt,
    transitionCount: NonNegativeInt,
  }).check(
    S.makeFilterGroup(
      [
        S.makeFilter((input) => input.sessionCount === input.acceptedSessionCount + input.quarantinedSessionCount, {
          identifier: "HookPulseLeaseReplaySessionCountInvariant",
          title: "Hook-pulse lease replay session-count invariant",
          description: "Requires every grouped session to be accepted or quarantined exactly once.",
          message: "Expected accepted and quarantined counts to equal sessionCount",
        }),
        S.makeFilter((input) => input.transitionCount <= input.decodedRowCount, {
          identifier: "HookPulseLeaseReplayTransitionCountInvariant",
          title: "Hook-pulse lease replay transition-count invariant",
          description: "Requires emitted lease transitions not to exceed decoded source rows.",
          message: "Expected transitionCount not to exceed decodedRowCount",
        }),
        S.makeFilter(
          (input) =>
            input.expiryCandidateCount === input.reconciledCandidateCount + input.missingReconciliationEvidenceCount,
          {
            identifier: "HookPulseLeaseReplayCandidateCountInvariant",
            title: "Hook-pulse lease replay candidate-count invariant",
            description: "Requires every expiry candidate to be reconciled or counted as lacking source evidence.",
            message: "Expected reconciled and missing-evidence counts to equal expiryCandidateCount",
          }
        ),
        S.makeFilter(
          (input) => input.reconciledCandidateCount === input.deferredTombstoneCount + input.tombstonedSessionCount,
          {
            identifier: "HookPulseLeaseReplayReconciliationCountInvariant",
            title: "Hook-pulse lease replay reconciliation-count invariant",
            description: "Requires every reconciled candidate to be deferred or tombstoned exactly once.",
            message: "Expected deferred and tombstoned counts to equal reconciledCandidateCount",
          }
        ),
        S.makeFilter((input) => input.expiryCandidateCount <= input.openLeaseCount, {
          identifier: "HookPulseLeaseReplayOpenLeaseCountInvariant",
          title: "Hook-pulse lease replay open-lease count invariant",
          description: "Requires the expired subset not to exceed the exact active-lease denominator.",
          message: "Expected expiryCandidateCount not to exceed openLeaseCount",
        }),
      ],
      {
        identifier: "HookPulseLeaseReplayResultInvariants",
        title: "Hook-pulse lease replay result invariants",
        description: "Checks exact session dispositions and bounded transition counts.",
      }
    )
  ),
  $I.annote("HookPulseLeaseReplayResult", {
    description: "Count-only denominator, decode, disposition, and transition receipt for a hook-ledger replay.",
  })
) {
  static readonly decodeJsonEffect = S.decodeUnknownEffect(S.fromJsonString(HookPulseLeaseReplayResult));
  static readonly encodeJsonEffect = S.encodeUnknownEffect(S.fromJsonString(HookPulseLeaseReplayResult));
}

const HookPulseLeaseReplayOperation = LiteralKit([
  "read-ledger",
  "project-session",
  "persist-projection",
  "scan-expired",
  "reconcile-expired",
]);

/**
 * Typed read, projection, or persistence failure for hook-ledger replay.
 *
 * @category errors
 * @since 0.0.0
 */
export class HookPulseLeaseReplayError extends S.TaggedError<HookPulseLeaseReplayError>($I`HookPulseLeaseReplayError`)(
  "HookPulseLeaseReplayError",
  {
    cause: Defect({ includeStack: true }),
    message: S.String,
    operation: HookPulseLeaseReplayOperation,
  },
  $I.annoteError<HookPulseLeaseReplayError>("HookPulseLeaseReplayError", {
    description: "Typed HookPulseV1 ledger read, lease projection, or durable persistence failure.",
  })
) {}

interface DecodedLedgerFile {
  readonly rejectedLineCount: number;
  readonly rows: ReadonlyArray<HookPulseV1>;
}

interface SessionRows {
  readonly rows: A.NonEmptyReadonlyArray<HookPulseV1>;
  readonly sessionId: Sha256Hex;
}

interface CandidateEvidence {
  readonly candidate: SessionLeaseExpiryCandidate;
  readonly evidence: SessionLeaseReconciliationEvidence;
}

const replayFailure = (
  operation: typeof HookPulseLeaseReplayOperation.Type,
  message: string,
  cause: unknown
): HookPulseLeaseReplayError => HookPulseLeaseReplayError.make({ cause, message, operation });

const readLedgerFile = Effect.fn("HookPulseLeaseReplay.readLedgerFile")(function* (filePath: string) {
  const fs = yield* FileSystem.FileSystem;
  const content = yield* fs
    .readFileString(filePath)
    .pipe(Effect.mapError((cause) => replayFailure("read-ledger", "Failed to read a hook-pulse ledger shard.", cause)));
  const lines = pipe(Str.split(content, "\n"), A.filter(Str.isNonEmpty));
  const decoded = yield* Effect.forEach(lines, (line) => Effect.result(HookPulseV1.decodeJsonEffect(line)), {
    concurrency: 8,
  });
  return {
    rejectedLineCount: pipe(decoded, A.filter(Result.isFailure), A.length),
    rows: pipe(decoded, A.map(Result.getSuccess), A.getSomes),
  } satisfies DecodedLedgerFile;
});

const groupSessionRows = (rows: ReadonlyArray<HookPulseV1>): ReadonlyArray<SessionRows> => {
  const grouped = MutableHashMap.empty<Sha256Hex, ReadonlyArray<HookPulseV1>>();
  for (const row of rows) {
    const existing = pipe(MutableHashMap.get(grouped, row.sessionId), O.getOrElse(A.empty<HookPulseV1>));
    MutableHashMap.set(grouped, row.sessionId, A.append(existing, row));
  }
  const options: ReadonlyArray<O.Option<SessionRows>> = pipe(
    A.fromIterable(grouped),
    A.map(
      ([sessionId, sessionRows]): O.Option<SessionRows> =>
        A.match(sessionRows, {
          onEmpty: () => O.none<SessionRows>(),
          onNonEmpty: (nonEmptyRows) => O.some({ rows: nonEmptyRows, sessionId } satisfies SessionRows),
        })
    )
  );
  const sessions: ReadonlyArray<SessionRows> = A.getSomes(options);
  return A.sort(
    sessions,
    Order.mapInput(Order.String, (session: SessionRows) => session.sessionId)
  );
};

const reconciliationEvidenceFor = (
  candidate: SessionLeaseExpiryCandidate,
  results: ReadonlyArray<SessionLeaseStoreProjectionResult>
): O.Option<CandidateEvidence> =>
  pipe(
    results,
    A.findFirst((result) => result.projection.sessionId === candidate.lease.sessionId),
    O.flatMap((result) => {
      if (result.projection.status !== "accepted") return O.none<CandidateEvidence>();
      return pipe(
        A.last(result.transitions),
        O.flatMap((transition) => {
          if (transition.status !== "active") return O.none<CandidateEvidence>();
          return O.some({
            candidate,
            evidence: SessionLeaseReconciliationEvidence.make({
              sessionId: result.projection.sessionId,
              sourceLastObservedAt: transition.lease.lastObservedAt,
              sourceEvidenceDigest: result.projection.projectionDigest,
              sourceOpenWaitIds: A.map(transition.lease.openWaits, (wait) => wait.waitId),
              evidenceTier: result.projection.evidenceTier,
              oipTaint: result.projection.oipTaint,
            }),
          });
        })
      );
    })
  );

/**
 * Enumerate every hook shard before reading and replace each session's lease projection.
 *
 * **Details**
 *
 * The replay is deterministic and idempotent: projections and transitions are
 * content-addressed, while the final active pointer is replaced from the full
 * observed history. Missing `SessionStart`, mixed identity, or ambiguous waits
 * produce durable quarantines and never alter an existing active pointer.
 *
 * **Example** (Run the replay through the platform layer)
 *
 * ```ts
 * import { replayHookPulseLeases } from "@beep/repo-ai-metrics"
 *
 * console.log(replayHookPulseLeases)
 * ```
 *
 * @param input - Canonical store, evidence root, and source taint.
 * @returns Count-only replay evidence with an exact pre-read file denominator.
 * @category services
 * @since 0.0.0
 */
export const replayHookPulseLeases: (
  input: HookPulseLeaseReplayInput
) => Effect.Effect<HookPulseLeaseReplayResult, HookPulseLeaseReplayError, FileSystem.FileSystem | Path.Path> =
  Effect.fn("HookPulseLeaseReplay.replayHookPulseLeases")(function* (input) {
    const files = pipe(yield* collectNdjsonFiles(hookPulseLedgerDir(input.evidenceRoot)), A.sort(Order.String));
    const decodedFiles = yield* Effect.forEach(files, readLedgerFile, { concurrency: 4 });
    const rows = A.flatMap(decodedFiles, (file) => file.rows);
    const sessions = groupSessionRows(rows);
    const durable = yield* Effect.scoped(
      Layer.build(SessionLeaseStore.layer(input.dataRoot)).pipe(
        Effect.flatMap((context) => {
          const store = Context.get(context, SessionLeaseStore);
          return Effect.gen(function* () {
            const projectionResults = yield* Effect.forEach(
              sessions,
              ({ rows: sessionRows }) =>
                projectHookPulseLease(
                  HookPulseLeaseProjectionInput.make({ rows: sessionRows, oipTaint: input.oipTaint })
                ).pipe(
                  Effect.mapError((cause) =>
                    replayFailure("project-session", "Failed to project one hook-pulse session.", cause)
                  ),
                  Effect.flatMap((projection) =>
                    store
                      .replaceProjection(projection)
                      .pipe(
                        Effect.mapError((cause) =>
                          replayFailure(
                            "persist-projection",
                            "Failed to persist one hook-pulse lease projection.",
                            cause
                          )
                        )
                      )
                  )
                ),
              { concurrency: 1 }
            );
            const expiryScan = yield* store
              .scanExpired(
                SessionLeaseExpiryScanInput.make({
                  evaluatedAt: input.evaluatedAt,
                  ttlMs: input.ttlMs,
                })
              )
              .pipe(
                Effect.mapError((cause) =>
                  replayFailure("scan-expired", "Failed to scan active hook-pulse session leases.", cause)
                )
              );
            const candidateEvidence = A.getSomes(
              A.map(expiryScan.candidates, (candidate) => reconciliationEvidenceFor(candidate, projectionResults))
            );
            const reconciliations = yield* Effect.forEach(
              candidateEvidence,
              ({ candidate, evidence }) =>
                store
                  .reconcile(candidate, evidence)
                  .pipe(
                    Effect.mapError((cause) =>
                      replayFailure("reconcile-expired", "Failed to reconcile an expired hook-pulse lease.", cause)
                    )
                  ),
              { concurrency: 1 }
            );
            return { candidateEvidence, expiryScan, projectionResults, reconciliations };
          });
        })
      )
    ).pipe(
      Effect.mapError((cause) =>
        replayFailure("persist-projection", "Failed to prepare or persist hook-pulse lease projections.", cause)
      )
    );

    return HookPulseLeaseReplayResult.make({
      schemaVersion: replaySchemaVersion,
      acceptedSessionCount: NonNegativeInt.make(
        pipe(
          durable.projectionResults,
          A.filter((result) => result.projection.status === "accepted"),
          A.length
        )
      ),
      decodedRowCount: NonNegativeInt.make(A.length(rows)),
      deferredTombstoneCount: NonNegativeInt.make(
        pipe(
          durable.reconciliations,
          A.filter((result) => result.reconciliation.status === "deferred"),
          A.length
        )
      ),
      enumeratedFileCount: NonNegativeInt.make(A.length(files)),
      expiryCandidateCount: NonNegativeInt.make(A.length(durable.expiryScan.candidates)),
      missingReconciliationEvidenceCount: NonNegativeInt.make(
        A.length(durable.expiryScan.candidates) - A.length(durable.candidateEvidence)
      ),
      openLeaseCount: durable.expiryScan.openLeaseCount,
      quarantinedSessionCount: NonNegativeInt.make(
        pipe(
          durable.projectionResults,
          A.filter((result) => result.projection.status === "quarantined"),
          A.length
        )
      ),
      reconciledCandidateCount: NonNegativeInt.make(A.length(durable.reconciliations)),
      rejectedLineCount: NonNegativeInt.make(
        pipe(
          decodedFiles,
          A.map((file) => file.rejectedLineCount),
          A.reduce(0, (total, count) => total + count)
        )
      ),
      sessionCount: NonNegativeInt.make(A.length(sessions)),
      tombstonedSessionCount: NonNegativeInt.make(
        pipe(
          durable.reconciliations,
          A.filter((result) => result.reconciliation.status === "tombstoned"),
          A.length
        )
      ),
      transitionCount: NonNegativeInt.make(
        pipe(
          durable.projectionResults,
          A.map((result) => A.length(result.transitions)),
          A.reduce(0, (total, count) => total + count)
        )
      ),
    });
  });
