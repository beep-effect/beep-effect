/**
 * Durable telemetry-v2 active-session lease store.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { PathSafety } from "@beep/file-processing";
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Defect, LiteralKit, NonNegativeInt, PosInt, Sha256Hex } from "@beep/schema";
import { Context, Duration, Effect, FileSystem, Layer, Path, Semaphore } from "effect";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { HookPulseLeaseProjection } from "./hook-pulse-lease-emitter.ts";
import { withAiMetricsFileLock } from "./internal/file-lock.ts";
import { hashPublicTextSha256 } from "./privacy.ts";
import {
  reconcileExpiredSessionLease,
  SessionLease,
  SessionLeaseExpiryCandidate,
  SessionLeaseReconciliation,
  SessionLeaseTransition,
  transitionSessionLease,
} from "./session-lease.ts";
import { TelemetryV2ArtifactReceipt, TelemetryV2Store } from "./telemetry-v2-store.ts";
import type { AiMetricsAbsoluteDataRoot } from "./data-root.ts";
import type { SessionLeaseEvent, SessionLeaseReconciliationEvidence } from "./session-lease.ts";
import type { TelemetryV2StoreError } from "./telemetry-v2-store.ts";

const $I = $RepoAiMetricsId.create("session-lease-store");
const expiryScanSchemaVersion = "telemetry-v2/session-lease-expiry-scan/v1";
const storeLockMaxRetries = 50;
const storeLockRetryDelay = Duration.millis(20);

/**
 * Deterministic query for expired active session leases.
 *
 * **Example** (Require a positive TTL)
 *
 * ```ts
 * import { SessionLeaseExpiryScanInput } from "@beep/repo-ai-metrics"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(SessionLeaseExpiryScanInput)({ ttlMs: 0 })) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionLeaseExpiryScanInput extends S.Class<SessionLeaseExpiryScanInput>($I`SessionLeaseExpiryScanInput`)(
  {
    evaluatedAt: S.DateTimeUtcFromString,
    ttlMs: PosInt,
  },
  $I.annote("SessionLeaseExpiryScanInput", {
    description: "Explicit evaluation instant and positive TTL for an active-lease scan.",
  })
) {}

/**
 * Complete result of scanning the active-lease directory once.
 *
 * **Details**
 *
 * `openLeaseCount` is the exact number of active lease files inspected. The
 * candidate array is only a subset; consumers must not mistake it for a
 * denominator or synthesize terminals without source reconciliation.
 *
 * **Example** (Inspect the denominator field)
 *
 * ```ts
 * import { SessionLeaseExpiryScan } from "@beep/repo-ai-metrics"
 *
 * console.log(SessionLeaseExpiryScan.fields.openLeaseCount)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionLeaseExpiryScan extends S.Class<SessionLeaseExpiryScan>($I`SessionLeaseExpiryScan`)(
  S.Struct({
    schemaVersion: S.Literal(expiryScanSchemaVersion),
    evaluatedAt: S.DateTimeUtcFromString,
    ttlMs: PosInt,
    openLeaseCount: NonNegativeInt,
    candidates: S.Array(SessionLeaseExpiryCandidate),
  }).check(
    S.makeFilter((input) => A.length(input.candidates) <= input.openLeaseCount, {
      identifier: "SessionLeaseExpiryScanCountInvariant",
      title: "Session-lease expiry-scan count invariant",
      description: "Requires the expired candidate subset not to exceed the inspected active-lease denominator.",
      message: "Expected candidate count to be no larger than openLeaseCount",
    })
  ),
  $I.annote("SessionLeaseExpiryScan", {
    description: "Exact active-lease denominator plus TTL-expired candidates awaiting reconciliation.",
  })
) {}

/**
 * Durable result of applying one liveness event.
 *
 * **Example** (Inspect the transition receipt)
 *
 * ```ts
 * import { SessionLeaseStoreApplyResult } from "@beep/repo-ai-metrics"
 *
 * console.log(SessionLeaseStoreApplyResult.fields.transitionReceipt)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionLeaseStoreApplyResult extends S.Class<SessionLeaseStoreApplyResult>(
  $I`SessionLeaseStoreApplyResult`
)(
  {
    transition: SessionLeaseTransition,
    transitionReceipt: TelemetryV2ArtifactReceipt,
  },
  $I.annote("SessionLeaseStoreApplyResult", {
    description: "Applied or quarantined lease transition and its content-addressed durable receipt.",
  })
) {}

/**
 * Durable result of reconciling one expired lease candidate.
 *
 * **Example** (Inspect the reconciliation receipt)
 *
 * ```ts
 * import { SessionLeaseStoreReconcileResult } from "@beep/repo-ai-metrics"
 *
 * console.log(SessionLeaseStoreReconcileResult.fields.reconciliationReceipt)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionLeaseStoreReconcileResult extends S.Class<SessionLeaseStoreReconcileResult>(
  $I`SessionLeaseStoreReconcileResult`
)(
  {
    reconciliation: SessionLeaseReconciliation,
    reconciliationReceipt: TelemetryV2ArtifactReceipt,
  },
  $I.annote("SessionLeaseStoreReconcileResult", {
    description: "Source-gated lease reconciliation and its content-addressed durable receipt.",
  })
) {}

/**
 * Durable result of replacing one active lease from a complete hook projection.
 *
 * **Details**
 *
 * A quarantined projection has no transitions and never changes the active
 * pointer. Accepted histories persist the projection and every reducer
 * transition before the final active pointer is advanced or retired.
 *
 * **Example** (Inspect projection and transition receipts)
 *
 * ```ts
 * import { SessionLeaseStoreProjectionResult } from "@beep/repo-ai-metrics"
 *
 * console.log(SessionLeaseStoreProjectionResult.fields.projectionReceipt)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SessionLeaseStoreProjectionResult extends S.Class<SessionLeaseStoreProjectionResult>(
  $I`SessionLeaseStoreProjectionResult`
)(
  S.Struct({
    projection: HookPulseLeaseProjection,
    projectionReceipt: TelemetryV2ArtifactReceipt,
    transitions: S.Array(SessionLeaseTransition),
    transitionReceipts: S.Array(TelemetryV2ArtifactReceipt),
  }).check(
    S.makeFilter(
      (input) =>
        A.length(input.transitions) === A.length(input.transitionReceipts) &&
        (input.projection.status === "accepted"
          ? A.length(input.transitions) === A.length(input.projection.events)
          : !A.isReadonlyArrayNonEmpty(input.transitions)),
      {
        identifier: "SessionLeaseStoreProjectionResultCountInvariant",
        title: "Session-lease projection receipt-count invariant",
        description: "Requires one durable receipt per accepted event and none for a quarantined projection.",
        message: "Expected transition and receipt counts to match the projection status",
      }
    )
  ),
  $I.annote("SessionLeaseStoreProjectionResult", {
    description: "Durable hook projection plus its exact reducer transitions and content-addressed receipts.",
  })
) {}

const SessionLeaseStoreOperation = LiteralKit([
  "prepare-root",
  "acquire-lock",
  "resolve-active-lease",
  "read-active-lease",
  "decode-active-lease",
  "encode-active-lease",
  "write-active-lease",
  "remove-active-lease",
  "enumerate-active-leases",
  "hash-active-lease",
  "append-transition",
  "append-projection",
  "append-reconciliation",
]);

/**
 * Typed active-lease persistence or scan failure.
 *
 * **Example** (Name a decode failure)
 *
 * ```ts
 * import { SessionLeaseStoreError } from "@beep/repo-ai-metrics"
 *
 * const error = SessionLeaseStoreError.make({
 *   cause: "invalid lease",
 *   message: "Failed to decode an active session lease.",
 *   operation: "decode-active-lease"
 * })
 * console.log(error.operation)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class SessionLeaseStoreError extends S.TaggedError<SessionLeaseStoreError>($I`SessionLeaseStoreError`)(
  "SessionLeaseStoreError",
  {
    cause: Defect({ includeStack: true }),
    message: S.String,
    operation: SessionLeaseStoreOperation,
  },
  $I.annoteError<SessionLeaseStoreError>("SessionLeaseStoreError", {
    description: "Typed active-lease preparation, persistence, decoding, hashing, or transition-write failure.",
  })
) {}

/**
 * Effect service contract for active session leases.
 *
 * **Details**
 *
 * Every transition is durably content-addressed before its active pointer is
 * advanced or retired. `scanExpired` reads only the active directory, so its
 * work is O(open leases), and it returns candidates rather than tombstones.
 *
 * **Example** (Name the service dependency)
 *
 * ```ts
 * import { SessionLeaseStore } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   return yield* SessionLeaseStore
 * })
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface SessionLeaseStoreShape {
  readonly apply: (event: SessionLeaseEvent) => Effect.Effect<SessionLeaseStoreApplyResult, SessionLeaseStoreError>;
  readonly reconcile: (
    candidate: SessionLeaseExpiryCandidate,
    evidence: SessionLeaseReconciliationEvidence
  ) => Effect.Effect<SessionLeaseStoreReconcileResult, SessionLeaseStoreError>;
  readonly replaceProjection: (
    projection: HookPulseLeaseProjection
  ) => Effect.Effect<SessionLeaseStoreProjectionResult, SessionLeaseStoreError>;
  readonly scanExpired: (
    input: SessionLeaseExpiryScanInput
  ) => Effect.Effect<SessionLeaseExpiryScan, SessionLeaseStoreError>;
}

const storeFailure = (
  operation: typeof SessionLeaseStoreOperation.Type,
  message: string,
  cause: unknown
): SessionLeaseStoreError => SessionLeaseStoreError.make({ cause, message, operation });

const textEncoder = new TextEncoder();
const decodeSessionId = S.decodeEffect(Sha256Hex);
const activeLeaseDirectory = "telemetry-v2/session-leases/active";
const activeLeaseRelativePath = (sessionId: SessionLease["sessionId"]): string =>
  `${activeLeaseDirectory}/${sessionId}.json`;

const makeSessionLeaseStore = Effect.fnUntraced(function* (dataRoot: AiMetricsAbsoluteDataRoot) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const telemetry = yield* TelemetryV2Store;
  const gate = yield* Semaphore.make(1);

  yield* fs
    .makeDirectory(dataRoot, { recursive: true })
    .pipe(Effect.mapError((cause) => storeFailure("prepare-root", "Failed to prepare the session-lease root.", cause)));
  const canonicalRoot = yield* fs
    .realPath(dataRoot)
    .pipe(Effect.mapError((cause) => storeFailure("prepare-root", "Failed to pin the session-lease root.", cause)));
  const lockPath = path.join(canonicalRoot, "telemetry-v2/session-leases/lease-store.lock");
  const withStoreLock = <A2, E, R>(use: Effect.Effect<A2, E, R>) =>
    gate.withPermits(1)(
      withAiMetricsFileLock({
        lockPath,
        maxRetries: storeLockMaxRetries,
        onClaimFailure: (cause: unknown) =>
          storeFailure("acquire-lock", "Failed to acquire the session-lease store lock.", cause),
        onTimeout: (staleLockPath: string) =>
          storeFailure(
            "acquire-lock",
            "Timed out waiting for the session-lease store lock. Remove it only after confirming no writer is active.",
            staleLockPath
          ),
        retryDelay: storeLockRetryDelay,
      })(use).pipe(Effect.provideService(FileSystem.FileSystem, fs), Effect.provideService(Path.Path, path))
    );

  const resolveActiveLeasePath = (sessionId: SessionLease["sessionId"]) =>
    PathSafety.resolvePathWithinCanonicalRoot({
      canonicalRoot,
      candidate: activeLeaseRelativePath(sessionId),
    }).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path),
      Effect.mapError((cause) =>
        storeFailure("resolve-active-lease", "Failed to resolve an active session-lease path.", cause)
      )
    );

  const readActiveLease = Effect.fnUntraced(function* (sessionId: SessionLease["sessionId"]) {
    const target = yield* resolveActiveLeasePath(sessionId);
    const exists = yield* fs
      .exists(target)
      .pipe(
        Effect.mapError((cause) =>
          storeFailure("read-active-lease", "Failed to inspect an active session lease.", cause)
        )
      );
    if (!exists) return O.none<SessionLease>();

    const raw = yield* fs
      .readFileString(target)
      .pipe(
        Effect.mapError((cause) => storeFailure("read-active-lease", "Failed to read an active session lease.", cause))
      );
    const lease = yield* SessionLease.decodeJsonEffect(raw).pipe(
      Effect.mapError((cause) =>
        storeFailure("decode-active-lease", "Failed to decode an active session lease.", cause)
      )
    );
    if (lease.sessionId !== sessionId) {
      return yield* storeFailure(
        "decode-active-lease",
        "The active lease path does not match its decoded session identity.",
        "active-lease-session-mismatch"
      );
    }
    return O.some(lease);
  });

  const encodeActiveLease = (lease: SessionLease) =>
    SessionLease.encodeJsonEffect(lease).pipe(
      Effect.mapError((cause) =>
        storeFailure("encode-active-lease", "Failed to encode an active session lease.", cause)
      )
    );

  const writeActiveLease = Effect.fnUntraced(function* (lease: SessionLease) {
    const json = yield* encodeActiveLease(lease);
    yield* PathSafety.writeFileWithinCanonicalRootAtomically({
      canonicalRoot,
      candidate: activeLeaseRelativePath(lease.sessionId),
      bytes: textEncoder.encode(`${json}\n`),
    }).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path),
      Effect.mapError((cause) => storeFailure("write-active-lease", "Failed to write an active session lease.", cause))
    );
  });

  const removeActiveLease = Effect.fnUntraced(function* (sessionId: SessionLease["sessionId"]) {
    const target = yield* resolveActiveLeasePath(sessionId);
    yield* fs
      .remove(target, { force: true })
      .pipe(
        Effect.mapError((cause) =>
          storeFailure("remove-active-lease", "Failed to retire an active session lease.", cause)
        )
      );
  });

  const apply = Effect.fn("SessionLeaseStore.apply")((event: SessionLeaseEvent) =>
    withStoreLock(
      Effect.gen(function* () {
        const current = yield* readActiveLease(event.sessionId);
        const transition = transitionSessionLease(current, event);
        const transitionReceipt = yield* telemetry
          .appendSessionLeaseTransition(transition)
          .pipe(
            Effect.mapError((cause) =>
              storeFailure("append-transition", "Failed to append a durable session-lease transition.", cause)
            )
          );

        yield* SessionLeaseTransition.match({
          active: ({ lease }) => writeActiveLease(lease),
          ended: ({ finalLease }) => removeActiveLease(finalLease.sessionId),
          quarantined: () => Effect.void,
        })(transition);

        return SessionLeaseStoreApplyResult.make({ transition, transitionReceipt });
      })
    )
  );

  const replaceProjection = Effect.fn("SessionLeaseStore.replaceProjection")((projection: HookPulseLeaseProjection) =>
    withStoreLock(
      Effect.gen(function* () {
        const projectionReceipt = yield* telemetry
          .appendHookPulseLeaseProjection(projection)
          .pipe(
            Effect.mapError((cause) =>
              storeFailure("append-projection", "Failed to append a durable hook-pulse lease projection.", cause)
            )
          );

        if (projection.status === "quarantined") {
          return SessionLeaseStoreProjectionResult.make({
            projection,
            projectionReceipt,
            transitions: [],
            transitionReceipts: [],
          });
        }

        const replay = yield* Effect.reduce(
          projection.events,
          () => ({
            current: O.none<SessionLease>(),
            transitions: A.empty<SessionLeaseTransition>(),
            transitionReceipts: A.empty<TelemetryV2ArtifactReceipt>(),
          }),
          (state, event) => {
            const transition = transitionSessionLease(state.current, event);
            return telemetry.appendSessionLeaseTransition(transition).pipe(
              Effect.mapError((cause) =>
                storeFailure("append-transition", "Failed to append a projected session-lease transition.", cause)
              ),
              Effect.map((transitionReceipt) => ({
                current: SessionLeaseTransition.match({
                  active: ({ lease }) => O.some(lease),
                  ended: () => O.none<SessionLease>(),
                  quarantined: () => state.current,
                })(transition),
                transitions: A.append(state.transitions, transition),
                transitionReceipts: A.append(state.transitionReceipts, transitionReceipt),
              }))
            );
          }
        );

        if (!A.some(replay.transitions, (transition) => transition.status === "quarantined")) {
          yield* O.match(replay.current, {
            onNone: () => removeActiveLease(projection.sessionId),
            onSome: writeActiveLease,
          });
        }

        return SessionLeaseStoreProjectionResult.make({
          projection,
          projectionReceipt,
          transitions: replay.transitions,
          transitionReceipts: replay.transitionReceipts,
        });
      })
    )
  );

  const readActiveLeaseEntries = Effect.fnUntraced(function* () {
    const directory = yield* PathSafety.resolvePathWithinCanonicalRoot({
      canonicalRoot,
      candidate: activeLeaseDirectory,
    }).pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.provideService(Path.Path, path),
      Effect.mapError((cause) =>
        storeFailure("enumerate-active-leases", "Failed to resolve the active session-lease directory.", cause)
      )
    );
    const exists = yield* fs
      .exists(directory)
      .pipe(
        Effect.mapError((cause) =>
          storeFailure("enumerate-active-leases", "Failed to inspect the active session-lease directory.", cause)
        )
      );
    if (!exists) return A.empty<string>();

    return yield* fs.readDirectory(directory).pipe(
      Effect.map(A.filter(Str.endsWith(".json"))),
      Effect.map(A.sort(Str.Order)),
      Effect.mapError((cause) =>
        storeFailure("enumerate-active-leases", "Failed to enumerate active session leases.", cause)
      )
    );
  });

  const hashActiveLease = Effect.fnUntraced(function* (lease: SessionLease) {
    const json = yield* encodeActiveLease(lease);
    return yield* hashPublicTextSha256(`session-lease\u0000${json}`).pipe(
      Effect.mapError((cause) => storeFailure("hash-active-lease", "Failed to hash an active session lease.", cause))
    );
  });

  const reconcile = Effect.fn("SessionLeaseStore.reconcile")(
    (candidate: SessionLeaseExpiryCandidate, evidence: SessionLeaseReconciliationEvidence) =>
      withStoreLock(
        Effect.gen(function* () {
          const current = yield* readActiveLease(candidate.lease.sessionId);
          const currentLeaseDigest = yield* O.match(current, {
            onNone: () => Effect.succeed(O.none<Sha256Hex>()),
            onSome: (lease) => Effect.asSome(hashActiveLease(lease)),
          });
          const reconciliation = reconcileExpiredSessionLease(candidate, currentLeaseDigest, evidence);
          const reconciliationReceipt = yield* telemetry
            .appendSessionLeaseReconciliation(reconciliation)
            .pipe(
              Effect.mapError((cause) =>
                storeFailure("append-reconciliation", "Failed to append a durable session-lease reconciliation.", cause)
              )
            );

          yield* SessionLeaseReconciliation.match({
            deferred: () => Effect.void,
            tombstoned: ({ tombstone }) => removeActiveLease(tombstone.sessionId),
          })(reconciliation);

          return SessionLeaseStoreReconcileResult.make({ reconciliation, reconciliationReceipt });
        })
      )
  );

  const scanExpired = Effect.fn("SessionLeaseStore.scanExpired")((input: SessionLeaseExpiryScanInput) =>
    withStoreLock(
      Effect.gen(function* () {
        const entries = yield* readActiveLeaseEntries();
        const leases = yield* Effect.forEach(
          entries,
          (entry) =>
            decodeSessionId(Str.slice(0, -5)(entry)).pipe(
              Effect.mapError((cause) =>
                storeFailure(
                  "enumerate-active-leases",
                  "An active session-lease filename does not contain a canonical session id.",
                  cause
                )
              ),
              Effect.flatMap(readActiveLease)
            ),
          { concurrency: 4 }
        );
        const activeLeases = A.getSomes(leases);
        const candidates = yield* Effect.forEach(
          activeLeases,
          (lease) => {
            const idleMs = DateTime.toEpochMillis(input.evaluatedAt) - DateTime.toEpochMillis(lease.lastObservedAt);
            if (idleMs < input.ttlMs) return Effect.succeed(O.none<SessionLeaseExpiryCandidate>());
            return Effect.map(hashActiveLease(lease), (leaseDigest) =>
              O.some(
                SessionLeaseExpiryCandidate.make({
                  schemaVersion: "telemetry-v2/session-lease-expiry-candidate/v1",
                  lease,
                  leaseDigest,
                  evaluatedAt: input.evaluatedAt,
                  ttlMs: input.ttlMs,
                  idleMs: NonNegativeInt.make(idleMs),
                })
              )
            );
          },
          { concurrency: 4 }
        );

        return SessionLeaseExpiryScan.make({
          schemaVersion: expiryScanSchemaVersion,
          evaluatedAt: input.evaluatedAt,
          ttlMs: input.ttlMs,
          openLeaseCount: NonNegativeInt.make(A.length(activeLeases)),
          candidates: A.getSomes(candidates),
        });
      })
    )
  );

  const service: SessionLeaseStoreShape = { apply, reconcile, replaceProjection, scanExpired };
  return service;
});

/**
 * Durable active-session lease store and O(open leases) expiry scanner.
 *
 * **Example** (Construct the live layer)
 *
 * ```ts
 * import { AiMetricsAbsoluteDataRoot, SessionLeaseStore } from "@beep/repo-ai-metrics"
 * import { Effect } from "effect"
 *
 * const root = Effect.runSync(AiMetricsAbsoluteDataRoot.decodeEffect("/var/lib/beep/ai-metrics"))
 * console.log(SessionLeaseStore.layer(root))
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SessionLeaseStore extends Context.Service<SessionLeaseStore, SessionLeaseStoreShape>()(
  $I`SessionLeaseStore`
) {
  /**
   * Build the active-lease store over a validated absolute AI-metrics root.
   *
   * **Example** (Type the live layer)
   *
   * ```ts
   * import { AiMetricsAbsoluteDataRoot, SessionLeaseStore } from "@beep/repo-ai-metrics"
   * import { Effect } from "effect"
   *
   * const root = Effect.runSync(AiMetricsAbsoluteDataRoot.decodeEffect("/var/lib/beep/ai-metrics"))
   * console.log(SessionLeaseStore.layer(root))
   * ```
   *
   * @param dataRoot - Validated absolute root beneath which active session leases are written.
   * @returns A layer that builds the active-session lease store.
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = (
    dataRoot: AiMetricsAbsoluteDataRoot
  ): Layer.Layer<
    SessionLeaseStore,
    SessionLeaseStoreError | TelemetryV2StoreError,
    FileSystem.FileSystem | Path.Path
  > =>
    Layer.effect(SessionLeaseStore, Effect.map(makeSessionLeaseStore(dataRoot), SessionLeaseStore.of)).pipe(
      Layer.provide(TelemetryV2Store.layer(dataRoot))
    );
}
