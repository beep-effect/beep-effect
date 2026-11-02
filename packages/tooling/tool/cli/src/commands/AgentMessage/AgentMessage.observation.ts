/**
 * Explicit observation enrollment for the existing managed-session owner.
 * @packageDocumentation
 * @since 0.0.0
 */

import { AiProviderCliSession, ManagedLaunchProfile, ManagedSessionError } from "@beep/ai-provider-cli";
import { $RepoCliId } from "@beep/identity/packages";
import {
  ObservationClaimPopulationRequest,
  readObservationClaimPopulation,
} from "@beep/repo-ai-metrics/observation-claim-population";
import { isPrivateObservationFile } from "@beep/repo-ai-metrics/observation-file";
import {
  initializeObservationClaims,
  makeObservationClaims,
  ObservationClaimPolicy,
  ObservationLaunchOutbox,
} from "@beep/repo-ai-metrics/observation-launch-claims";
import {
  makeObservationLaunchClient,
  ObservationLaunchClientPolicy,
} from "@beep/repo-ai-metrics/observation-launch-client";
import { ObservationLaunchFact, ObservationLaunchIdentity } from "@beep/repo-ai-metrics/observation-launch-facts";
import { ObservationLaunchSubmission } from "@beep/repo-ai-metrics/observation-launch-http";
import {
  AI_METRICS_LOCAL_INSECURE_HASH_SALT,
  hashPrivateIdentifier,
  resolveAiMetricsHashSaltStatus,
} from "@beep/repo-ai-metrics/privacy";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { ManagedSessionIdentity, ManagedSessionProcess } from "@beep/ai-provider-cli";

const $I = $RepoCliId.create("commands/AgentMessage/AgentMessage.observation");
/**
 * Private inputs binding observation enrollment to the actual managed owner.
 * **Example** (Inspect owner binding)
 * ```ts
 * import { AgentObservationOwner } from "@beep/repo-cli/commands/AgentMessage/AgentMessage.observation"
 * console.log(typeof AgentObservationOwner.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentObservationOwner extends S.Opaque<AgentObservationOwner, { readonly brand: unique symbol }>()(
  S.Struct({
    endpointId: S.NonEmptyString.check(S.isMaxLength(512)),
    ownerId: S.NonEmptyString.check(S.isMaxLength(512)),
    generation: S.Natural,
    repositoryScope: S.NonEmptyString.check(S.isMaxLength(1024)),
    workspace: S.NonEmptyString.check(S.isMaxLength(4096)),
    provider: ManagedLaunchProfile.fields.provider,
  }).pipe(
    $I.annoteSchema("AgentObservationOwner", {
      description: "Private endpoint occurrence inputs; only their salted binding is exported.",
    })
  )
) {}
/**
 * Existing independent store and exact immutable submission for one owner.
 * **Details** Provisioning is separate. No secret, automatic epoch selection or
 * store creation is accepted here. The owner and attempt digests are rederived.
 * **Example** (Inspect enrollment)
 * ```ts
 * import { AgentObservationEnrollment } from "@beep/repo-cli/commands/AgentMessage/AgentMessage.observation"
 * console.log(typeof AgentObservationEnrollment.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentObservationEnrollment extends S.Opaque<
  AgentObservationEnrollment,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    version: S.tag("agent-message-observation/v1"),
    ownerBinding: Sha256Hex,
    claims: ObservationClaimPolicy,
    destination: ObservationLaunchClientPolicy,
    submission: ObservationLaunchSubmission,
  }).pipe(
    $I.annoteSchema("AgentObservationEnrollment", {
      description: "Explicit metadata-only producer enrollment bound to an existing launch fence.",
    })
  )
) {}
/**
 * Managed open request with an optional explicitly provisioned observation directory.
 * **Example** (Inspect the request boundary)
 * ```ts
 * import { AgentObservationRequest } from "@beep/repo-cli/commands/AgentMessage/AgentMessage.observation"
 * console.log(typeof AgentObservationRequest.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentObservationRequest extends S.Opaque<AgentObservationRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    profile: ManagedLaunchProfile,
    owner: AgentObservationOwner,
    enrollmentDirectory: S.Option(S.String),
  }).pipe(
    $I.annoteSchema("AgentObservationRequest", {
      description: "Caller-owned session profile and optional observation enrollment.",
    })
  )
) {}
/**
 * Content-free producer enrollment or durability failure.
 * **Example** (Inspect refusal)
 * ```ts
 * import { AgentObservationError } from "@beep/repo-cli/commands/AgentMessage/AgentMessage.observation"
 * console.log(AgentObservationError.make({ reason: "identity" }).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class AgentObservationError extends S.TaggedError<AgentObservationError, { readonly brand: unique symbol }>(
  $I`AgentObservationError`
)(
  "AgentObservationError",
  { reason: S.Literals(["configuration", "identity", "claim", "write", "cleanup", "recovery"]) },
  $I.annote("AgentObservationError", { description: "Safe failure without profile, path, secret or source content." })
) {}
const failure = (reason: AgentObservationError["reason"]) => AgentObservationError.make({ reason });
const currentOwnerUid = () => process.geteuid?.() ?? -1;
const readPrivateDocument = Effect.fn("AgentObservation.readPrivateDocument")(
  function* <T, I>(
    directory: string,
    name: "enrollment.json" | "request.json" | "population.json",
    schema: S.Codec<T, I>
  ) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const uid = currentOwnerUid();
    if (!path.isAbsolute(directory) || path.normalize(directory) !== directory || directory === "/")
      return yield* failure("configuration");
    const root = yield* fs.lstat(directory);
    if (
      root.type !== "Directory" ||
      (root.mode & 0o777) !== 0o700 ||
      !O.contains(root.uid, uid) ||
      (yield* fs.realPath(directory)) !== directory
    )
      return yield* failure("configuration");
    const filename = path.join(directory, name);
    const before = yield* fs.lstat(filename);
    if (before.type !== "File") return yield* failure("configuration");
    const body = yield* Effect.scoped(
      Effect.gen(function* () {
        const file = yield* fs.open(filename, { flag: "r", noFollow: true });
        const info = yield* file.stat;
        if (
          !isPrivateObservationFile(info, uid) ||
          info.dev !== before.dev ||
          !O.exists(info.ino, (inode) => O.contains(before.ino, inode))
        )
          return yield* failure("configuration");
        const bytes = new Uint8Array(32769);
        let length = 0;
        while (length < bytes.length) {
          const n = yield* file.read(bytes.subarray(length));
          if (n === 0) break;
          length += n;
        }
        if (length === 0 || length > 32768) return yield* failure("configuration");
        return yield* Effect.try({
          try: () => new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, length)),
          catch: () => failure("configuration"),
        });
      })
    );
    return yield* S.decodeEffect(S.fromJsonString(schema), { onExcessProperty: "error" })(body);
  },
  Effect.mapError(() => failure("configuration"))
);

const readEnrollment = (directory: string) =>
  readPrivateDocument(directory, "enrollment.json", AgentObservationEnrollment);
const privateHasher = Effect.gen(function* () {
  const salt = yield* Config.Redacted("BEEP_AI_METRICS_HASH_SALT").pipe(
    Effect.mapError(() => failure("configuration"))
  );
  const hashSalt = salt.pipe(Redacted.value, O.some);
  if (
    resolveAiMetricsHashSaltStatus(hashSalt) !== "provided" ||
    Redacted.value(salt) === AI_METRICS_LOCAL_INSECURE_HASH_SALT
  )
    return yield* failure("configuration");
  return (value: string) => hashPrivateIdentifier(value, hashSalt);
});
const ownerHarness = (provider: AgentObservationOwner["provider"]) =>
  Match.value(provider).pipe(
    Match.when("codex", () => "codex-cli"),
    Match.when("claude", () => "claude-code"),
    Match.when("grok", () => "grok"),
    Match.when("cursor", () => "cursor-agent"),
    Match.exhaustive
  );

/**
 * Private explicit provisioning request; epoch and attribution are never guessed.
 * **Example** (Inspect provisioning input)
 * ```ts
 * import { AgentObservationProvisioning } from "@beep/repo-cli/commands/AgentMessage/AgentMessage.observation"
 * console.log(typeof AgentObservationProvisioning.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentObservationProvisioning extends S.Opaque<
  AgentObservationProvisioning,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    version: S.tag("agent-message-observation-provisioning/v1"),
    owner: AgentObservationOwner,
    claims: ObservationClaimPolicy,
    destination: ObservationLaunchClientPolicy,
    evidenceEpoch: S.Natural,
    identity: ObservationLaunchIdentity,
  }).pipe(
    $I.annoteSchema("AgentObservationProvisioning", {
      description: "Private setup inputs for an explicit owner, independent fence and collector destination.",
    })
  )
) {}

/**
 * Metadata-only setup acknowledgment; neither operation launches a process.
 * **Example** (Inspect the setup receipt)
 * ```ts
 * import { AgentObservationProvisioned } from "@beep/repo-cli/commands/AgentMessage/AgentMessage.observation"
 * console.log(typeof AgentObservationProvisioned.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentObservationProvisioned extends S.Opaque<
  AgentObservationProvisioned,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    version: S.tag("agent-message-observation-provisioned/v1"),
    operation: S.Literals(["initialize-claims", "enroll"]),
    launchId: Sha256Hex,
    fenceId: Sha256Hex,
    hostId: Sha256Hex,
    namespaceId: Sha256Hex,
    evidenceEpoch: S.Natural,
  }).pipe(
    $I.annoteSchema("AgentObservationProvisioned", {
      description: "Durable setup acknowledgment without paths, owner names, secrets or coverage claims.",
    })
  )
) {}
const encodeAgentObservationOwnerJson = S.encodeEffect(S.fromJsonString(AgentObservationOwner));

const prepareEnrollment = Effect.fn("AgentObservation.prepareEnrollment")(function* (directory: string) {
  const request = yield* readPrivateDocument(directory, "request.json", AgentObservationProvisioning);
  const hash = yield* privateHasher;
  const fs = yield* FileSystem.FileSystem;
  const namespace = yield* hash("ai-metrics-hash-salt-namespace/v1");
  if (
    (yield* fs.realPath(request.owner.workspace).pipe(Effect.mapError(() => failure("identity")))) !==
      request.owner.workspace ||
    request.identity.harness !== ownerHarness(request.owner.provider) ||
    request.identity.surface !== "cli" ||
    request.claims.anchor.namespaceId !== namespace ||
    request.destination.namespaceId !== namespace ||
    request.claims.anchor.hostId !== request.destination.hostId ||
    request.claims.journalDirectory !== request.destination.directory
  )
    return yield* failure("identity");
  const ownerBinding = yield* hash(
    `agent-message-observation-owner/v1:${yield* encodeAgentObservationOwnerJson(request.owner)}`
  );
  const launchId = yield* hash(`agent-message-observation-attempt/v1:${ownerBinding}`);
  return AgentObservationEnrollment.make({
    ownerBinding,
    claims: request.claims,
    destination: request.destination,
    submission: ObservationLaunchSubmission.make({
      hostId: request.destination.hostId,
      namespaceId: namespace,
      evidenceEpoch: request.evidenceEpoch,
      fact: ObservationLaunchFact.cases.Prepared.make({ launchId, identity: request.identity }),
    }),
  });
});
const provisioned = (enrollment: AgentObservationEnrollment, operation: AgentObservationProvisioned["operation"]) =>
  AgentObservationProvisioned.make({
    operation,
    launchId: enrollment.submission.fact.launchId,
    fenceId: enrollment.claims.anchor.fenceId,
    hostId: enrollment.submission.hostId,
    namespaceId: enrollment.submission.namespaceId,
    evidenceEpoch: enrollment.submission.evidenceEpoch,
  });

/**
 * Explicitly create a new claim store; existing or partial stores are preserved.
 * **Details** This is never a startup or recovery fallback. Store loss/rollback
 * requires an independent recovery hold; creating another store is not recovery.
 * **Example** (Inspect explicit initialization)
 * ```ts
 * import { initializeAgentObservationClaims } from "@beep/repo-cli/commands/AgentMessage/AgentMessage.observation"
 * console.log(typeof initializeAgentObservationClaims)
 * ```
 * @category services
 * @since 0.0.0
 */
export const initializeAgentObservationClaims = Effect.fn("AgentObservation.initializeClaims")(function* (
  requestDirectory: string
) {
  const enrollment = yield* prepareEnrollment(requestDirectory);
  yield* initializeObservationClaims(enrollment.claims, currentOwnerUid()).pipe(
    Effect.mapError(() => failure("claim"))
  );
  return provisioned(enrollment, "initialize-claims");
});
const encodeAgentObservationEnrollmentJson = S.encodeEffect(S.fromJsonString(AgentObservationEnrollment));

const checkEnrollmentSeparation = Effect.fnUntraced(function* (
  enrollment: AgentObservationEnrollment,
  directory: string
) {
  for (const existing of [enrollment.claims.directory, enrollment.destination.directory]) {
    if (
      directory === existing ||
      Str.startsWith(`${directory}/`)(existing) ||
      Str.startsWith(`${existing}/`)(directory)
    )
      return yield* failure("configuration");
  }
});

const prepareEnrollmentParent = Effect.fnUntraced(function* (
  enrollment: AgentObservationEnrollment,
  directory: string,
  uid: number
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  if (!path.isAbsolute(directory) || path.normalize(directory) !== directory || directory === "/")
    return yield* failure("configuration");
  yield* checkEnrollmentSeparation(enrollment, directory);
  const parent = path.dirname(directory);
  const parentInfo = yield* fs.lstat(parent);
  if (
    parentInfo.type !== "Directory" ||
    (parentInfo.mode & 0o777) !== 0o700 ||
    !O.contains(parentInfo.uid, uid) ||
    (yield* fs.realPath(parent)) !== parent
  )
    return yield* failure("configuration");
  return parent;
});

/**
 * Durably create a new private enrollment against an existing independent store.
 * **Details** Refuses existing targets, consumed attempts and nested evidence
 * stores. Exclusive file creation and file/directory sync precede acknowledgment.
 * Interrupted partial output is preserved and never overwritten or auto-repaired.
 * **Example** (Inspect enrollment creation)
 * ```ts
 * import { enrollAgentObservation } from "@beep/repo-cli/commands/AgentMessage/AgentMessage.observation"
 * console.log(typeof enrollAgentObservation)
 * ```
 * @category services
 * @since 0.0.0
 */
export const enrollAgentObservation = Effect.fn("AgentObservation.enroll")(function* (
  requestDirectory: string,
  directory: string
) {
  const enrollment = yield* prepareEnrollment(requestDirectory);
  const uid = currentOwnerUid();
  const claims = yield* makeObservationClaims(enrollment.claims, uid).pipe(Effect.mapError(() => failure("claim")));
  if (A.some(yield* claims.snapshot, (claim) => claim.submission.fact.launchId === enrollment.submission.fact.launchId))
    return yield* failure("claim");
  yield* Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const parent = yield* prepareEnrollmentParent(enrollment, directory, uid);
    const body = new TextEncoder().encode(yield* encodeAgentObservationEnrollmentJson(enrollment));
    if (body.byteLength > 32768) return yield* failure("configuration");
    yield* fs.makeDirectory(directory, { mode: 0o700 });
    yield* Effect.scoped(
      Effect.gen(function* () {
        const file = yield* fs.open(path.join(directory, "enrollment.json"), {
          flag: "wx",
          mode: 0o600,
          noFollow: true,
        });
        yield* file.writeAll(body);
        yield* file.sync;
      })
    );
    for (const target of [directory, parent])
      yield* Effect.scoped(
        Effect.gen(function* () {
          const handle = yield* fs.open(target, { flag: "r", noFollow: true });
          yield* handle.sync;
        })
      );
    // Re-read through the same owner/mode/descriptor checks used by serving.
    if (!S.toEquivalence(AgentObservationEnrollment)(yield* readEnrollment(directory), enrollment))
      return yield* failure("write");
  }).pipe(Effect.mapError(() => failure("write")));
  return provisioned(enrollment, "enroll");
});

/**
 * Publish one explicitly bounded independent claim cohort through existing enrollment.
 * **Details** population.json declares managed routes and a claim-creation window.
 * No collector contact, secret read, store creation, process spawn or epoch change
 * occurs. The report retains uncertain starts and unobserved events as unknown.
 * **Example** (Inspect the population adapter)
 * ```ts
 * import { readAgentObservationPopulation } from "@beep/repo-cli/commands/AgentMessage/AgentMessage.observation"
 * console.log(typeof readAgentObservationPopulation)
 * ```
 * @category services
 * @since 0.0.0
 */
export const readAgentObservationPopulation = Effect.fn("AgentObservation.population")(function* (
  enrollmentDirectory: string,
  requestDirectory: string
) {
  const enrollment = yield* readEnrollment(enrollmentDirectory);
  const request = yield* readPrivateDocument(requestDirectory, "population.json", ObservationClaimPopulationRequest);
  // Reuse the same exact enrollment/retained-claim identity checks as recovery.
  const state = yield* recoverAgentObservation(enrollmentDirectory, "status");
  if (
    !S.toEquivalence(ObservationLaunchSubmission)(enrollment.submission, state.outbox.claim.submission) ||
    enrollment.claims.anchor.fenceId !== state.outbox.claim.fenceId
  )
    return yield* failure("identity");
  return yield* readObservationClaimPopulation(
    enrollment.claims,
    ObservationClaimPopulationRequest.make(request),
    currentOwnerUid()
  );
});

/**
 * Bounded recovery evidence; acknowledgments never imply current backend visibility.
 * **Example** (Inspect recovery evidence)
 * ```ts
 * import { AgentObservationRecovery } from "@beep/repo-cli/commands/AgentMessage/AgentMessage.observation"
 * console.log(typeof AgentObservationRecovery.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class AgentObservationRecovery extends S.Opaque<AgentObservationRecovery, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("agent-message-observation-recovery/v1"),
    operation: S.Literals(["status", "reconcile"]),
    outbox: ObservationLaunchOutbox,
    backendVisibility: S.tag("unknown"),
    processLiveness: S.tag("unknown"),
  }).pipe(
    $I.annoteSchema("AgentObservationRecovery", {
      description: "Original durable facts and receipts without inferred process or backend state.",
    })
  )
) {}

/**
 * Inspect or replay one existing enrollment without process-launch authority.
 * **Details** No salt, profile, launch grant, epoch selection or claim creation is
 * involved. The exact Prepared submission must match the retained claim before
 * any transport. Reconciliation sends at most four facts within ten seconds and
 * retains partial acknowledgments on failure. Missing or damaged state refuses.
 * **Example** (Inspect the recovery boundary)
 * ```ts
 * import { recoverAgentObservation } from "@beep/repo-cli/commands/AgentMessage/AgentMessage.observation"
 * console.log(typeof recoverAgentObservation)
 * ```
 * @category services
 * @since 0.0.0
 */
export const recoverAgentObservation = Effect.fn("AgentObservation.recover")(function* (
  directory: string,
  operation: AgentObservationRecovery["operation"]
) {
  const enrollment = yield* readEnrollment(directory);
  const { submission, claims: policy, destination } = enrollment;
  if (
    submission.fact._tag !== "Prepared" ||
    submission.hostId !== policy.anchor.hostId ||
    submission.namespaceId !== policy.anchor.namespaceId ||
    submission.hostId !== destination.hostId ||
    submission.namespaceId !== destination.namespaceId ||
    policy.journalDirectory !== destination.directory
  )
    return yield* failure("identity");
  const uid = currentOwnerUid();
  const claims = yield* makeObservationClaims(policy, uid).pipe(Effect.mapError(() => failure("claim")));
  const before = yield* claims.readOutbox(submission.fact.launchId).pipe(Effect.mapError(() => failure("claim")));
  if (!S.toEquivalence(ObservationLaunchSubmission)(before.claim.submission, submission))
    return yield* failure("identity");
  if (operation === "reconcile") {
    yield* Effect.scoped(
      Effect.gen(function* () {
        const client = yield* makeObservationLaunchClient(destination, uid);
        yield* claims.reconcile(submission.fact.launchId, client.submit);
      })
    ).pipe(Effect.mapError(() => failure("recovery")));
  }
  const outbox = yield* claims.readOutbox(submission.fact.launchId).pipe(Effect.mapError(() => failure("claim")));
  return AgentObservationRecovery.make({ operation, outbox });
});

/**
 * Open the existing managed adapter with local durable observations when enrolled.
 * **Details** A fresh synced claim precedes spawn. Callbacks never contact the
 * collector. One scoped reconciliation activity starts after binding and stops
 * before close; it cannot relaunch. Finalization closes the actual child before
 * recording a conservative process outcome. Missing state is never success.
 * Without enrollment, existing adapter behavior is preserved and no coverage is
 * claimed. Enrollment never provisions or repairs a missing claim store.
 * **Example** (Inspect the integration boundary)
 * ```ts
 * import { openAgentMessageSession } from "@beep/repo-cli/commands/AgentMessage/AgentMessage.observation"
 * console.log(typeof openAgentMessageSession)
 * ```
 * @category services
 * @since 0.0.0
 */
export const openAgentMessageSession = Effect.fn("AgentObservation.open")(function* (request: AgentObservationRequest) {
  const sessions = yield* AiProviderCliSession;
  if (O.isNone(request.enrollmentDirectory)) return yield* sessions.open(request.profile);
  const enrollment = yield* readEnrollment(request.enrollmentDirectory.value);
  const fs = yield* FileSystem.FileSystem;
  const hash = yield* privateHasher;
  const canonicalWorkspace = yield* fs
    .realPath(request.profile.workspace)
    .pipe(Effect.mapError(() => failure("identity")));
  if (request.owner.provider !== request.profile.provider || request.owner.workspace !== canonicalWorkspace)
    return yield* failure("identity");
  const ownerBinding = yield* hash(
    `agent-message-observation-owner/v1:${yield* encodeAgentObservationOwnerJson(request.owner)}`
  );
  const launchId = yield* hash(`agent-message-observation-attempt/v1:${ownerBinding}`);
  const namespace = yield* hash("ai-metrics-hash-salt-namespace/v1");
  const submission = enrollment.submission;
  const harness = ownerHarness(request.profile.provider);
  if (
    ownerBinding !== enrollment.ownerBinding ||
    submission.fact._tag !== "Prepared" ||
    submission.fact.launchId !== launchId ||
    submission.fact.identity.harness !== harness ||
    submission.fact.identity.surface !== "cli" ||
    namespace !== submission.namespaceId ||
    namespace !== enrollment.claims.anchor.namespaceId ||
    namespace !== enrollment.destination.namespaceId ||
    submission.hostId !== enrollment.claims.anchor.hostId ||
    submission.hostId !== enrollment.destination.hostId ||
    enrollment.claims.journalDirectory !== enrollment.destination.directory
  )
    return yield* failure("identity");
  const uid = currentOwnerUid();
  const claims = yield* makeObservationClaims(enrollment.claims, uid).pipe(Effect.mapError(() => failure("claim")));
  const append = (fact: ObservationLaunchFact) =>
    claims.appendObservation(ObservationLaunchSubmission.make({ ...submission, fact })).pipe(
      Effect.asVoid,
      Effect.mapError(() => failure("write"))
    );
  const transportFailed = yield* Ref.make(false);
  const flush = Effect.gen(function* () {
    const client = yield* makeObservationLaunchClient(enrollment.destination, uid);
    yield* claims.reconcile(launchId, client.submit);
    if (yield* Ref.getAndSet(transportFailed, false)) yield* Effect.logInfo("Agent observation delivery recovered.");
  }).pipe(
    Effect.scoped,
    Effect.catch(
      Effect.fnUntraced(function* () {
        if (!(yield* Ref.getAndSet(transportFailed, true)))
          yield* Effect.logWarning(
            "Agent observation delivery unresolved; durable metadata retained for reconciliation."
          );
      })
    )
  );
  return yield* claims.runOnce(
    submission,
    Effect.fnUntraced(function* () {
      const child = yield* Ref.make(O.none<ManagedSessionProcess>());
      const observeError = () =>
        ManagedSessionError.make({
          reason: "transport",
          operation: "observation",
          message: "Local observation failed; retain the attempt for reconciliation.",
        });
      const session = yield* sessions
        .open(request.profile, {
          started: Effect.fn("AgentObservation.started")(function* (process: ManagedSessionProcess) {
            yield* Ref.set(child, O.some(process));
            yield* append(
              ObservationLaunchFact.cases.Started.make({
                launchId,
                processInstanceId: yield* hash(`managed-process/v1:${launchId}:${process.pid}`),
              })
            );
          }, Effect.mapError(observeError)),
          bound: Effect.fn("AgentObservation.bound")(function* (identity: ManagedSessionIdentity) {
            yield* append(
              ObservationLaunchFact.cases.SessionBound.make({
                launchId,
                sourceSessionId: yield* hash(identity.sessionId),
              })
            );
          }, Effect.mapError(observeError)),
        })
        .pipe(
          Effect.onExit((exit) =>
            Exit.isFailure(exit)
              ? Effect.gen(function* () {
                  const observed = yield* Ref.get(child);
                  if (O.isSome(observed) && (yield* observed.value.isRunning)) return yield* failure("cleanup");
                  yield* append(ObservationLaunchFact.cases.Finished.make({ launchId, outcome: "unknown" }));
                }).pipe(Effect.catch(() => Effect.logWarning("Agent observation closure unresolved; claim retained.")))
              : Effect.void
          )
        );
      // Lifecycle callbacks have finished before reconciliation may hold the local permit.
      const delivery = yield* flush.pipe(Effect.repeat(Schedule.spaced("60 seconds")), Effect.forkScoped);
      const close = yield* Effect.cached(
        Effect.gen(function* () {
          yield* Fiber.interrupt(delivery);
          const running = yield* session.process.isRunning;
          const closed = yield* Effect.exit(session.close);
          if (yield* session.process.isRunning) return yield* failure("cleanup");
          const outcome = running
            ? Exit.isSuccess(closed)
              ? "cancelled"
              : "unknown"
            : yield* session.process.exitCode.pipe(
                Effect.map((code) => (code === 0 ? ("succeeded" as const) : ("failed" as const))),
                Effect.orElseSucceed(() => "unknown" as const)
              );
          yield* append(ObservationLaunchFact.cases.Finished.make({ launchId, outcome }));
          yield* flush.pipe(Effect.timeoutOption("2 seconds"));
        })
      );
      yield* Effect.addFinalizer(() =>
        close.pipe(
          Effect.catch(() => Effect.logWarning("Agent observation finalization unresolved; durable evidence retained."))
        )
      );
      return { ...session, close: close.pipe(Effect.mapError(observeError)) };
    })
  );
});
