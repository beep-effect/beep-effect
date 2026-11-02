/**
 * Independent, bounded, append-only launch-attempt claims.
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Str from "effect/String";
import { isPrivateObservationFile } from "./observation-file.ts";
import {
  ObservationLaunchFact,
  ObservationLaunchReceipt,
  observationLaunchReceiptId,
} from "./observation-launch-facts.ts";
import { ObservationLaunchSubmission } from "./observation-launch-http.ts";
import { hashPublicTextSha256 } from "./privacy.ts";

const $I = $RepoAiMetricsId.create("observation-launch-claims");
/**
 * Explicit enrollment identity and fixed capacity of an independent claim store.
 * **Example** (Inspect enrollment)
 * ```ts
 * import { ObservationClaimAnchor } from "@beep/repo-ai-metrics/observation-launch-claims"
 * console.log(typeof ObservationClaimAnchor.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ObservationClaimAnchor extends S.Opaque<ObservationClaimAnchor, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("observation-claim-anchor/v1"),
    fenceId: Sha256Hex,
    hostId: Sha256Hex,
    namespaceId: Sha256Hex,
    maxClaims: S.Int.check(S.isBetween({ minimum: 1, maximum: 256 })),
  }).pipe(
    $I.annoteSchema("ObservationClaimAnchor", {
      description: "Pinned enrollment, never inferred from a restored collector database.",
    })
  )
) {}
/**
 * Private claim location kept disjoint from the collector journal directory.
 * **Example** (Inspect policy)
 * ```ts
 * import { ObservationClaimPolicy } from "@beep/repo-ai-metrics/observation-launch-claims"
 * console.log(typeof ObservationClaimPolicy.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ObservationClaimPolicy extends S.Opaque<ObservationClaimPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    directory: S.NonEmptyString.check(S.isMaxLength(240)),
    journalDirectory: S.NonEmptyString.check(S.isMaxLength(240)),
    anchor: ObservationClaimAnchor,
  }).pipe(
    $I.annoteSchema("ObservationClaimPolicy", { description: "Explicit independent storage and expected enrollment." })
  )
) {}
/**
 * Durable intention to attempt one launch; it is not evidence of a running child.
 * **Details** Reading this value never grants permission to launch. The same
 * launch ID is consumed across collector epochs. Keep the store outside collector
 * restore/retirement and preserve it on failure; loss or rollback requires a hold.
 * **Example** (Inspect a claim)
 * ```ts
 * import { ObservationLaunchClaim } from "@beep/repo-ai-metrics/observation-launch-claims"
 * console.log(typeof ObservationLaunchClaim.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ObservationLaunchClaim extends S.Opaque<ObservationLaunchClaim, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("observation-launch-claim/v1"),
    fenceId: Sha256Hex,
    submission: ObservationLaunchSubmission,
    claimedAt: S.Natural,
  }).pipe(
    $I.annoteSchema("ObservationLaunchClaim", {
      description: "Immutable prepared metadata before any process-start effect.",
    })
  )
) {}
/**
 * Content-free refusal. A storage failure may leave a consumed or torn claim.
 * **Example** (Inspect a refusal)
 * ```ts
 * import { ObservationClaimError } from "@beep/repo-ai-metrics/observation-launch-claims"
 * console.log(ObservationClaimError.make({ reason: "claimed" }).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class ObservationClaimError extends S.TaggedError<ObservationClaimError, { readonly brand: unique symbol }>(
  $I`ObservationClaimError`
)(
  "ObservationClaimError",
  {
    reason: S.Literals([
      "configuration",
      "integrity",
      "claimed",
      "capacity",
      "contended",
      "storage",
      "conflict",
      "unclaimed",
      "ambiguous",
    ]),
  },
  $I.annote("ObservationClaimError", { description: "No unsafe fallback, cleanup or launch retry." })
) {}
/**
 * Immutable producer observations and historical local-commit acknowledgments.
 * **Details** Missing observations are unknown, not proof of an unstarted or
 * successful process. A receipt does not establish current backend visibility.
 * **Example** (Inspect a snapshot)
 * ```ts
 * import { ObservationLaunchOutbox } from "@beep/repo-ai-metrics/observation-launch-claims"
 * console.log(typeof ObservationLaunchOutbox.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ObservationLaunchOutbox extends S.Opaque<ObservationLaunchOutbox, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("observation-launch-outbox/v1"),
    claim: ObservationLaunchClaim,
    submissions: S.Array(ObservationLaunchSubmission).check(S.isMaxLength(4)),
    receipts: S.Array(ObservationLaunchReceipt).check(S.isMaxLength(4)),
  }).pipe(
    $I.annoteSchema("ObservationLaunchOutbox", {
      description: "Bounded evidence to reconcile without process-launch authority.",
    })
  )
) {}
const OutboxEnvelope = S.Struct({ payload: S.String, digest: Sha256Hex }).pipe(
  $I.annoteSchema("OutboxEnvelope", { description: "Checksummed immutable producer metadata." })
);
const encodeOutboxEnvelope = S.encodeEffect(S.fromJsonString(OutboxEnvelope));
const decodeOutboxEnvelope = S.decodeEffect(S.fromJsonString(OutboxEnvelope), { onExcessProperty: "error" });
const encodeSubmission = S.encodeEffect(S.fromJsonString(ObservationLaunchSubmission));
const decodeSubmission = S.decodeEffect(S.fromJsonString(ObservationLaunchSubmission), { onExcessProperty: "error" });
const encodeReceipt = S.encodeEffect(S.fromJsonString(ObservationLaunchReceipt));
const decodeReceipt = S.decodeEffect(S.fromJsonString(ObservationLaunchReceipt), { onExcessProperty: "error" });
const equalSubmission = S.toEquivalence(ObservationLaunchSubmission);
const equalReceipt = S.toEquivalence(ObservationLaunchReceipt);
const factPhase = ObservationLaunchFact.match({
  Prepared: () => 0,
  Started: () => 1,
  SessionBound: () => 2,
  Finished: () => 3,
});
const fail = (reason: ObservationClaimError["reason"]) => ObservationClaimError.make({ reason });
const safe = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  effect.pipe(Effect.mapError((error) => (S.is(ObservationClaimError)(error) ? error : fail("storage"))));
const Envelope = S.Struct({ claim: ObservationLaunchClaim, digest: Sha256Hex }).pipe(
  $I.annoteSchema("ClaimEnvelope", { description: "Integrity-checked bounded claim record." })
);
const encodeClaim = S.encodeEffect(S.fromJsonString(ObservationLaunchClaim));
const encodeEnvelope = S.encodeEffect(S.fromJsonString(Envelope));
const encodeAnchor = S.encodeEffect(S.fromJsonString(ObservationClaimAnchor));
const decodeEnvelope = S.decodeEffect(S.fromJsonString(Envelope), { onExcessProperty: "error" });
const decodeAnchor = S.decodeEffect(S.fromJsonString(ObservationClaimAnchor), { onExcessProperty: "error" });
const sameAnchor = S.toEquivalence(ObservationClaimAnchor);

const paths = Effect.fn("ObservationClaims.paths")(function* (policy: ObservationClaimPolicy) {
  const path = yield* Path.Path;
  for (const directory of [policy.directory, policy.journalDirectory]) {
    if (!path.isAbsolute(directory) || path.normalize(directory) !== directory || directory === "/")
      return yield* fail("configuration");
  }
  if (
    policy.directory === policy.journalDirectory ||
    Str.startsWith(`${policy.directory}/`)(policy.journalDirectory) ||
    Str.startsWith(`${policy.journalDirectory}/`)(policy.directory)
  )
    return yield* fail("configuration");
  return path;
});
const directoryIdentity = Effect.fn("ObservationClaims.directoryIdentity")(function* (directory: string, uid: number) {
  const fs = yield* FileSystem.FileSystem;
  const info = yield* fs.lstat(directory);
  if (
    info.type !== "Directory" ||
    (info.mode & 0o777) !== 0o700 ||
    !O.contains(info.uid, uid) ||
    O.isNone(info.ino) ||
    (yield* fs.realPath(directory)) !== directory
  )
    return yield* fail("configuration");
  return { dev: info.dev, ino: info.ino.value };
});
const syncDirectory = Effect.fn("ObservationClaims.syncDirectory")((directory: string) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const handle = yield* fs.open(directory, { flag: "r", noFollow: true });
      yield* handle.sync;
    })
  )
);
const writeExclusive = Effect.fn("ObservationClaims.writeExclusive")((file: string, text: string) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const bytes = new TextEncoder().encode(text);
      if (bytes.byteLength > 8192) return yield* fail("capacity");
      const handle = yield* fs
        .open(file, { flag: "wx", mode: 0o600, noFollow: true })
        .pipe(Effect.mapError((error) => fail(error.reason._tag === "AlreadyExists" ? "contended" : "storage")));
      yield* handle.writeAll(bytes);
      yield* handle.sync;
    })
  )
);
const readVerifiedClaimText = Effect.fnUntraced(function* (handle: FileSystem.File) {
  const bytes = new Uint8Array(8193);
  let offset = 0;
  while (offset < bytes.length) {
    const count = yield* handle.read(bytes.subarray(offset));
    if (count === 0) break;
    offset += count;
  }
  if (offset === 0 || offset > 8192) return yield* fail("integrity");
  return O.some(
    yield* Effect.try({
      try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, offset)),
      catch: () => fail("integrity"),
    })
  );
});
// Read through the checked descriptor; the path-stream helper cannot request noFollow.
const readSlot = Effect.fn("ObservationClaims.readSlot")((file: string, uid: number) =>
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const before = yield* fs.lstat(file).pipe(
        Effect.asSome,
        Effect.catchIf(
          (error) => error.reason._tag === "NotFound",
          () => Effect.succeedNone
        )
      );
      if (O.isNone(before)) return O.none<string>();
      if (before.value.type !== "File") return yield* fail("integrity");
      const opened = yield* fs.open(file, { flag: "r", noFollow: true }).pipe(
        Effect.asSome,
        Effect.catchIf(
          (error) => error.reason._tag === "NotFound",
          () => Effect.succeedNone
        )
      );
      if (O.isNone(opened)) return O.none<string>();
      const handle = opened.value;
      const info = yield* handle.stat;
      if (!isPrivateObservationFile(info, uid)) return yield* fail("integrity");
      return yield* readVerifiedClaimText(handle);
    })
  )
);

/**
 * Provision a new independent claim directory once, syncing file and directories.
 * **Details** Never call this as a missing-store fallback. Existing or partially
 * initialized directories are refused and preserved. The parent and collector
 * directory must be canonical owner-only directories. No existing file is changed.
 * **Example** (Inspect provisioning)
 * ```ts
 * import { initializeObservationClaims } from "@beep/repo-ai-metrics/observation-launch-claims"
 * console.log(typeof initializeObservationClaims)
 * ```
 * @category services
 * @since 0.0.0
 */
export const initializeObservationClaims = Effect.fn("AiMetrics.initializeObservationClaims")(
  (policy: ObservationClaimPolicy, uid: number) =>
    safe(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* paths(policy);
        yield* directoryIdentity(path.dirname(policy.directory), uid);
        yield* directoryIdentity(policy.journalDirectory, uid);
        yield* fs.makeDirectory(policy.directory, { mode: 0o700 });
        yield* directoryIdentity(policy.directory, uid);
        yield* writeExclusive(path.join(policy.directory, "anchor.json"), yield* encodeAnchor(policy.anchor));
        yield* syncDirectory(policy.directory);
        yield* syncDirectory(path.dirname(policy.directory));
      })
    )
);

/**
 * Execute an operation only after a fresh, durably synced exclusive attempt claim.
 * **Details** Fixed slots bound owned claim data to maxClaims times 8192 bytes plus
 * one anchor. Optional lifecycle outbox adds three fact and four receipt slots per
 * claim, each at most 8192 bytes. There is no directory enumeration or automatic reclamation. Claims
 * survive operation failure and collector restoration. Concurrent processes race
 * on exclusive creation: losers never run their operation. Torn, corrupt, replaced
 * or missing stores hold launches. This does not detect rollback of the claim store
 * itself; that store must be independently preserved and held during its recovery.
 * A snapshot is evidence of intention, never permission to run or proof of spawn.
 * appendObservation durably records immutable producer facts before transport.
 * reconcile explicitly replays at most four exact facts within ten seconds and
 * checks retained receipts; it has no process-launch capability. One owning
 * controller supplies lifecycle observations. Failures leave claims consumed and
 * incomplete observations unresolved; no automatic outcome or epoch change exists.
 * **Example** (Inspect the factory)
 * ```ts
 * import { makeObservationClaims } from "@beep/repo-ai-metrics/observation-launch-claims"
 * console.log(typeof makeObservationClaims)
 * ```
 * @category services
 * @since 0.0.0
 */
export const makeObservationClaims = Effect.fn("AiMetrics.makeObservationClaims")(function* (
  policy: ObservationClaimPolicy,
  uid: number
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* paths(policy);
  yield* directoryIdentity(policy.journalDirectory, uid).pipe(safe);
  const original = yield* directoryIdentity(policy.directory, uid).pipe(safe);
  const inspect = safe(
    Effect.gen(function* () {
      const current = yield* directoryIdentity(policy.directory, uid);
      if (current.dev !== original.dev || current.ino !== original.ino) return yield* fail("configuration");
      const text = yield* readSlot(path.join(policy.directory, "anchor.json"), uid);
      if (O.isNone(text) || !sameAnchor(yield* decodeAnchor(text.value), policy.anchor))
        return yield* fail("configuration");
    })
  ).pipe(Effect.provideService(FileSystem.FileSystem, fs));
  yield* inspect;
  const slotPath = (index: number) => path.join(policy.directory, `claim-${index}.json`);
  const snapshot = safe(
    Effect.gen(function* () {
      yield* inspect;
      const records = yield* Effect.forEach(
        A.range(0, policy.anchor.maxClaims - 1),
        Effect.fnUntraced(function* (index) {
          const text = yield* readSlot(slotPath(index), uid);
          if (O.isNone(text)) return O.none<ObservationLaunchClaim>();
          const value = yield* decodeEnvelope(text.value).pipe(Effect.mapError(() => fail("integrity")));
          const claim = value.claim;
          if (
            claim.fenceId !== policy.anchor.fenceId ||
            claim.submission.hostId !== policy.anchor.hostId ||
            claim.submission.namespaceId !== policy.anchor.namespaceId ||
            claim.submission.fact._tag !== "Prepared" ||
            (yield* hashPublicTextSha256(yield* encodeClaim(claim))) !== value.digest
          )
            return yield* fail("integrity");
          return O.some(claim);
        }),
        { concurrency: 1 }
      );
      const launchIds = A.map(A.getSomes(records), (claim) => claim.submission.fact.launchId);
      if (A.dedupe(launchIds).length !== launchIds.length) return yield* fail("integrity");
      yield* inspect;
      return records;
    })
  ).pipe(Effect.provideService(FileSystem.FileSystem, fs));
  const permit = yield* Semaphore.make(1);
  const persist = Effect.fn("ObservationClaims.persist")((submission: ObservationLaunchSubmission) =>
    safe(
      Effect.gen(function* () {
        if (
          submission.hostId !== policy.anchor.hostId ||
          submission.namespaceId !== policy.anchor.namespaceId ||
          submission.fact._tag !== "Prepared"
        )
          return yield* fail("configuration");
        const rows = yield* snapshot;
        if (A.some(rows, (row) => O.isSome(row) && row.value.submission.fact.launchId === submission.fact.launchId))
          return yield* fail("claimed");
        const free = A.findFirstIndex(rows, (row: O.Option<ObservationLaunchClaim>) => O.isNone(row));
        if (O.isNone(free)) return yield* fail("capacity");
        const claim = ObservationLaunchClaim.make({
          fenceId: policy.anchor.fenceId,
          submission,
          claimedAt: yield* Clock.currentTimeMillis,
        });
        yield* writeExclusive(
          slotPath(free.value),
          yield* encodeEnvelope({ claim, digest: yield* hashPublicTextSha256(yield* encodeClaim(claim)) })
        );
        yield* syncDirectory(policy.directory);
        yield* inspect;
        return claim;
      })
    ).pipe(Effect.provideService(FileSystem.FileSystem, fs))
  );
  const runOnce = Effect.fn("ObservationClaims.runOnce")(function* <A, E, R>(
    submission: ObservationLaunchSubmission,
    operation: (claim: ObservationLaunchClaim) => Effect.Effect<A, E, R>
  ) {
    const result = yield* permit.withPermitsIfAvailable(1)(persist(submission));
    if (O.isNone(result)) return yield* fail("contended");
    return yield* Effect.suspend(() => operation(result.value));
  });
  const locate = Effect.fn("ObservationClaims.locate")(function* (launchId: Sha256Hex) {
    const rows = yield* snapshot;
    const index = A.findFirstIndex(rows, (row) => O.isSome(row) && row.value.submission.fact.launchId === launchId);
    if (O.isNone(index)) return yield* fail("unclaimed");
    const row = rows[index.value];
    if (row === undefined || O.isNone(row)) return yield* fail("integrity");
    return { index: index.value, claim: row.value };
  });
  const syncFile = Effect.fn("ObservationClaims.syncFile")((file: string) =>
    Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* fs.open(file, { flag: "r", noFollow: true });
        yield* handle.sync;
      })
    )
  );
  const factPath = (index: number, phase: number) => path.join(policy.directory, `fact-${index}-${phase}.json`);
  const receiptPath = (index: number, phase: number) => path.join(policy.directory, `receipt-${index}-${phase}.json`);
  const readPayload = Effect.fn("ObservationClaims.readPayload")(function* (file: string) {
    const text = yield* readSlot(file, uid);
    if (O.isNone(text)) return O.none<string>();
    const value = yield* decodeOutboxEnvelope(text.value);
    if ((yield* hashPublicTextSha256(value.payload)) !== value.digest) return yield* fail("integrity");
    return O.some(value.payload);
  });
  const writePayload = Effect.fn("ObservationClaims.writePayload")(function* (file: string, payload: string) {
    yield* writeExclusive(file, yield* encodeOutboxEnvelope({ payload, digest: yield* hashPublicTextSha256(payload) }));
    yield* syncDirectory(policy.directory);
    yield* inspect;
  });
  const matches = (submission: ObservationLaunchSubmission, claim: ObservationLaunchClaim) =>
    submission.hostId === claim.submission.hostId &&
    submission.namespaceId === claim.submission.namespaceId &&
    submission.evidenceEpoch === claim.submission.evidenceEpoch &&
    submission.fact.launchId === claim.submission.fact.launchId;
  const validReceipt = Effect.fn("ObservationClaims.validReceipt")(function* (
    receipt: ObservationLaunchReceipt,
    submission: ObservationLaunchSubmission
  ) {
    return (
      equalSubmission(
        ObservationLaunchSubmission.make({
          hostId: receipt.hostId,
          namespaceId: receipt.namespaceId,
          evidenceEpoch: receipt.evidenceEpoch,
          fact: receipt.fact,
        }),
        submission
      ) &&
      receipt.receiptId ===
        (yield* observationLaunchReceiptId(
          submission.hostId,
          submission.namespaceId,
          submission.evidenceEpoch,
          submission.fact
        ))
    );
  });
  const readObservationsAt = Effect.fn("ObservationClaims.readObservationsAt")(
    (index: number, claim: ObservationLaunchClaim) =>
      safe(
        Effect.gen(function* () {
          let submissions: ReadonlyArray<ObservationLaunchSubmission> = [claim.submission];
          for (const phase of [1, 2, 3]) {
            const payload = yield* readPayload(factPath(index, phase));
            if (O.isNone(payload)) continue;
            const submission = yield* decodeSubmission(payload.value);
            if (!matches(submission, claim) || factPhase(submission.fact) !== phase) return yield* fail("integrity");
            submissions = A.append(submissions, submission);
          }
          const started = A.some(submissions, (entry) => entry.fact._tag === "Started");
          if (
            A.some(
              submissions,
              (entry) =>
                (entry.fact._tag === "SessionBound" ||
                  (entry.fact._tag === "Finished" && entry.fact.outcome === "succeeded")) &&
                !started
            )
          )
            return yield* fail("integrity");
          yield* inspect;
          return { index, claim, submissions };
        })
      ).pipe(Effect.provideService(FileSystem.FileSystem, fs))
  );
  const readOutboxAt = Effect.fn("ObservationClaims.readOutboxAt")((index: number, claim: ObservationLaunchClaim) =>
    safe(
      Effect.gen(function* () {
        const { submissions } = yield* readObservationsAt(index, claim);
        let receipts: ReadonlyArray<ObservationLaunchReceipt> = [];
        for (const phase of [0, 1, 2, 3]) {
          const payload = yield* readPayload(receiptPath(index, phase));
          if (O.isNone(payload)) continue;
          const receipt = yield* decodeReceipt(payload.value);
          const submission = A.findFirst(submissions, (entry) => factPhase(entry.fact) === phase);
          if (O.isNone(submission) || !(yield* validReceipt(receipt, submission.value)))
            return yield* fail("integrity");
          receipts = A.append(receipts, receipt);
        }
        yield* inspect;
        return ObservationLaunchOutbox.make({ claim, submissions, receipts });
      })
    ).pipe(Effect.provideService(FileSystem.FileSystem, fs))
  );
  const readObservations = Effect.fn("ObservationClaims.readObservations")((launchId: Sha256Hex) =>
    locate(launchId).pipe(Effect.flatMap(({ index, claim }) => readObservationsAt(index, claim)))
  );
  const readOutbox = Effect.fn("ObservationClaims.readOutbox")((launchId: Sha256Hex) =>
    locate(launchId).pipe(Effect.flatMap(({ index, claim }) => readOutboxAt(index, claim)))
  );
  const scanOutboxes = Effect.gen(function* () {
    const slots = yield* snapshot;
    return yield* Effect.forEach(
      slots,
      (claim, index) => (O.isSome(claim) ? readOutboxAt(index, claim.value).pipe(Effect.asSome) : Effect.succeedNone),
      { concurrency: 1 }
    ).pipe(Effect.map(A.getSomes));
  });
  // Fixed slots are scanned twice without repeated per-row whole-store searches.
  // This is an interval snapshot, not a lock against another producer or rollback.
  const snapshotOutboxes = Effect.gen(function* () {
    const first = yield* scanOutboxes;
    const second = yield* scanOutboxes;
    if (!S.toEquivalence(S.Array(ObservationLaunchOutbox))(first, second)) return yield* fail("contended");
    return second;
  }).pipe(Effect.timeoutOrElse({ duration: "10 seconds", orElse: () => Effect.fail(fail("ambiguous")) }));
  const resyncSubmission = Effect.fnUntraced(function* (
    existing: ObservationLaunchSubmission,
    submission: ObservationLaunchSubmission
  ) {
    if (!equalSubmission(existing, submission)) return yield* fail("conflict");
    // A previous caller may have lost the sync result. Resync before acknowledging the exact record.
    const { index } = yield* locate(submission.fact.launchId);
    const file = submission.fact._tag === "Prepared" ? slotPath(index) : factPath(index, factPhase(submission.fact));
    yield* syncFile(file);
    yield* syncDirectory(policy.directory);
    yield* inspect;
    return existing;
  });
  const conflictsWithSubmissionHistory = (
    submission: ObservationLaunchSubmission,
    submissions: ReadonlyArray<ObservationLaunchSubmission>
  ) => {
    const started = A.some(submissions, (entry) => entry.fact._tag === "Started");
    return (
      A.some(submissions, (entry) => entry.fact._tag === "Finished") ||
      (submission.fact._tag === "SessionBound" && !started) ||
      (submission.fact._tag === "Finished" && submission.fact.outcome === "succeeded" && !started)
    );
  };
  const appendObservation = Effect.fn("ObservationClaims.appendObservation")(
    (submission: ObservationLaunchSubmission) =>
      safe(
        Effect.gen(function* () {
          const accepted = yield* permit.withPermitsIfAvailable(1)(
            Effect.gen(function* () {
              const state = yield* readObservations(submission.fact.launchId);
              if (!matches(submission, state.claim)) return yield* fail("configuration");
              const existing = A.findFirst(
                state.submissions,
                (entry) => factPhase(entry.fact) === factPhase(submission.fact)
              );
              if (O.isSome(existing)) return yield* resyncSubmission(existing.value, submission);
              if (conflictsWithSubmissionHistory(submission, state.submissions)) return yield* fail("conflict");
              const { index } = yield* locate(submission.fact.launchId);
              yield* writePayload(factPath(index, factPhase(submission.fact)), yield* encodeSubmission(submission));
              return submission;
            })
          );
          return O.isSome(accepted) ? accepted.value : yield* fail("contended");
        })
      ).pipe(Effect.provideService(FileSystem.FileSystem, fs))
  );
  const persistReconciledReceipt = Effect.fnUntraced(function* (
    index: number,
    submission: ObservationLaunchSubmission,
    receipt: ObservationLaunchReceipt,
    previous: O.Option<ObservationLaunchReceipt>
  ) {
    if (O.isSome(previous)) {
      if (!equalReceipt(previous.value, receipt)) return yield* fail("conflict");
      yield* safe(syncFile(receiptPath(index, factPhase(submission.fact))));
      yield* safe(syncDirectory(policy.directory));
      yield* inspect;
    } else {
      yield* safe(writePayload(receiptPath(index, factPhase(submission.fact)), yield* safe(encodeReceipt(receipt))));
    }
  });
  const reconcile = Effect.fn("ObservationClaims.reconcile")(function* <E, R>(
    launchId: Sha256Hex,
    deliver: (submission: ObservationLaunchSubmission) => Effect.Effect<ObservationLaunchReceipt, E, R>
  ) {
    const result = yield* permit.withPermitsIfAvailable(1)(
      Effect.gen(function* () {
        const state = yield* readOutbox(launchId);
        const { index } = yield* locate(launchId);
        let receipts: ReadonlyArray<ObservationLaunchReceipt> = [];
        // Explicit bounded replay of at most four exact immutable facts, including historical acknowledgments.
        for (const submission of state.submissions) {
          yield* inspect;
          const receipt = yield* deliver(submission);
          if (!(yield* safe(validReceipt(receipt, submission)))) return yield* fail("conflict");
          const previous = A.findFirst(state.receipts, (entry) => factPhase(entry.fact) === factPhase(submission.fact));
          yield* persistReconciledReceipt(index, submission, receipt, previous);
          receipts = A.append(receipts, receipt);
        }
        return receipts;
      }).pipe(
        Effect.provideService(FileSystem.FileSystem, fs),
        Effect.timeoutOrElse({ duration: "10 seconds", orElse: () => Effect.fail(fail("ambiguous")) })
      )
    );
    return O.isSome(result) ? result.value : yield* fail("contended");
  });
  return {
    runOnce,
    snapshot: snapshot.pipe(Effect.map(A.getSomes)),
    snapshotOutboxes,
    readOutbox,
    appendObservation,
    reconcile,
  };
});
