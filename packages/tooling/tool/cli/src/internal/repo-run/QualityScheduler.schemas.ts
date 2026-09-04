/**
 * Schemas for the machine-wide weighted admission scheduler (ship-velocity D1).
 *
 * One admission token approximates 5 GiB of schedulable memory. Heavy repo
 * work (full proofs, merged previews, review-fix loops) holds a lease worth
 * its token weight; contenders wait in a durable on-disk queue instead of
 * failing fast. Evidence and policy: `goals/ship-velocity/SPEC.md` D1 and
 * `goals/ship-velocity/research/c5-concurrency-policy.md`.
 *
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Defect, LiteralKit, SchemaUtils } from "@beep/schema";
import { UUID } from "@beep/schema/String";
import * as O from "@beep/utils/Option";
import { Effect, Runtime } from "effect";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import { RunScopeRecord } from "./RunScope.schemas.ts";

const $I = $RepoCliId.create("internal/repo-run/QualityScheduler.schemas");

/**
 * Kind of heavy repository work admitted through the machine-wide scheduler.
 *
 * **Example** (Match on an admission kind)
 *
 * ```ts
 * import { AdmissionWorkKind } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(AdmissionWorkKind.is["full-proof"]("full-proof")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionWorkKind = LiteralKit(["full-proof", "merged-preview", "review-fix", "publish"]).pipe(
  $I.annoteSchema("AdmissionWorkKind", {
    description: "Class of heavyweight repository work admitted through the machine-wide scheduler.",
  })
);

/**
 * Class of heavyweight repository work admitted through the scheduler.
 *
 * @category models
 * @since 0.0.0
 */
export type AdmissionWorkKind = typeof AdmissionWorkKind.Type;

/**
 * Queue ordering class for one admission request.
 *
 * Publish-priority tickets order ahead of verify tickets because a publish's
 * final proof unlocks push and hosted feedback; a verify ticket ages up to
 * publish priority after the configured aging window so nothing starves.
 *
 * **Example** (Inspect priority options)
 *
 * ```ts
 * import { AdmissionPriority } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(AdmissionPriority.Options.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionPriority = LiteralKit(["publish", "verify"]).pipe(
  $I.annoteSchema("AdmissionPriority", {
    description: "Queue ordering class for one admission request.",
  })
);

/**
 * Queue ordering class for one admission request.
 *
 * @category models
 * @since 0.0.0
 */
export type AdmissionPriority = typeof AdmissionPriority.Type;

/**
 * Origin-coordination protocol understood by one scheduler ticket or lease.
 *
 * **Details**
 *
 * Newly constructed tickets and leases default to `scheduler-origin-concurrency/v1`.
 * Decoding a persisted record without the additive field defaults to
 * `legacy-origin-lock/v1`, so prior-version state drains before migration.
 *
 * **Example** (Detect current scheduler coordination)
 *
 * ```ts
 * import { AdmissionCoordinationProtocol } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(
 *   AdmissionCoordinationProtocol.is["scheduler-origin-concurrency/v1"]("scheduler-origin-concurrency/v1")
 * ) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionCoordinationProtocol = LiteralKit([
  "legacy-origin-lock/v1",
  "scheduler-origin-concurrency/v1",
]).pipe(
  $I.annoteSchema("AdmissionCoordinationProtocol", {
    description: "Mixed-version coordination protocol used by one scheduler ticket or lease.",
  })
);

/**
 * Mixed-version coordination protocol used by one scheduler ticket or lease.
 *
 * @category models
 * @since 0.0.0
 */
export type AdmissionCoordinationProtocol = typeof AdmissionCoordinationProtocol.Type;

/**
 * Yeet local proof tier carried by attempt and admission facts.
 *
 * **Example** (Recognize a review-fix tier)
 *
 * ```ts
 * import { YeetProofTier } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(YeetProofTier.is["review-fix"]("review-fix")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const YeetProofTier = LiteralKit(["full", "cheap-gates", "review-fix"]).pipe(
  $I.annoteSchema("YeetProofTier", {
    description: "Local proof tier selected for a Yeet verification attempt.",
  })
);

/**
 * Local proof tier selected for a Yeet verification attempt.
 *
 * @category models
 * @since 0.0.0
 */
export type YeetProofTier = typeof YeetProofTier.Type;

/**
 * Environment posture carried by attempt and admission facts.
 *
 * **Example** (Recognize PR posture)
 *
 * ```ts
 * import { ProofEnvProfile } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(ProofEnvProfile.is["pr-posture"]("pr-posture")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProofEnvProfile = LiteralKit(["local", "pr-posture", "hosted"]).pipe(
  $I.annoteSchema("ProofEnvProfile", {
    description: "Environment posture a lane executed under: local workstation, PR posture, or hosted CI.",
  })
);

/**
 * Environment posture carried by attempt and admission facts.
 *
 * @category models
 * @since 0.0.0
 */
export type ProofEnvProfile = typeof ProofEnvProfile.Type;

/**
 * Verification stage carried by attempt and admission facts.
 *
 * **Example** (Recognize the pre-push stage)
 *
 * ```ts
 * import { ProofStage } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(ProofStage.is["pre-push"]("pre-push")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProofStage = LiteralKit(["repair-loop", "pre-push", "merged-preview", "hosted"]).pipe(
  $I.annoteSchema("ProofStage", {
    description: "Verification stage that produced an attempt fact.",
  })
);

/**
 * Verification stage that produced an attempt fact.
 *
 * @category models
 * @since 0.0.0
 */
export type ProofStage = typeof ProofStage.Type;

/**
 * Shared schema fields for immutable facts recorded at attempt start.
 *
 * **Example** (Reuse the fact field group)
 *
 * ```ts
 * import { attemptInputFactFields } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log("resolvedHeadSha" in attemptInputFactFields) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const attemptInputFactFields = {
  resolvedHeadSha: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  diffFingerprint: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  proofTier: YeetProofTier.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  envProfile: ProofEnvProfile.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  stage: ProofStage.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
};

/**
 * Token weight for each admission kind, in 5 GiB token units (SPEC D1).
 *
 * The publish weight covers only the post-proof mutation phase; a publish's
 * embedded full proof is requested as `full-proof` with publish priority, so
 * no caller requests the `publish` kind yet (reserved with `hotPaths` for the
 * chartered follow-ups; see goals/ship-velocity/research/d1-admission-scheduler.md).
 *
 * **Example** (Read the full-proof weight)
 *
 * ```ts
 * import { admissionTokenWeight } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(admissionTokenWeight("full-proof")) // 3
 * ```
 *
 * @param kind - Admission work kind to weigh.
 * @returns The token weight charged while a lease of this kind is held.
 * @category models
 * @since 0.0.0
 */
export const admissionTokenWeight = (kind: AdmissionWorkKind): number =>
  AdmissionWorkKind.$match(kind, {
    "full-proof": () => 3,
    "merged-preview": () => 5,
    "review-fix": () => 1,
    publish: () => 1,
  });

const admissionOwnerFields = {
  attemptId: UUID.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
  ...attemptInputFactFields,
  pid: S.Finite,
  procStart: S.String,
  kind: AdmissionWorkKind,
  weightTokens: S.Finite,
  priority: AdmissionPriority,
  originKey: S.String,
  checkoutRoot: S.String,
  branch: S.String,
  coordinationProtocol: AdmissionCoordinationProtocol.pipe(
    S.withConstructorDefault(Effect.succeed(AdmissionCoordinationProtocol.Enum["scheduler-origin-concurrency/v1"])),
    S.withDecodingDefault(Effect.succeed(AdmissionCoordinationProtocol.Enum["legacy-origin-lock/v1"]))
  ),
};

/**
 * One active admission lease: heavy work currently charged against capacity.
 *
 * `pid` plus `procStart` (procfs on Linux, otherwise a prefixed platform
 * process-start representation) identify the owner across pid reuse; leases
 * are reaped only when the pid is dead or the recorded identity no longer
 * matches. The lease retains the originating
 * ticket identity (`nonce`) and queue instant (`enqueuedAtMillis`); legacy
 * lease files decode those fields with `""` and `0` sentinels.
 *
 * **Example** (Construct a lease value)
 *
 * ```ts
 * import { YeetAdmissionLease } from "@beep/repo-cli/test/RepoRun"
 *
 * const lease = YeetAdmissionLease.make({
 *   schemaVersion: "yeet-admission-lease/v1",
 *   pid: 1234,
 *   procStart: "8241991",
 *   kind: "full-proof",
 *   weightTokens: 3,
 *   priority: "verify",
 *   originKey: "aaaabbbbcccc",
 *   checkoutRoot: "/repo",
 *   branch: "feat/x",
 *   command: "bun run beep yeet verify",
 *   startedAt: "2026-08-27T14:00:00Z",
 *   admittedAtMillis: 0,
 *   heartbeatAtMillis: 0,
 *   enqueuedAtMillis: 0,
 *   nonce: "d0a7b0dc-54ec-4b51-95c7-6fafdc18d206"
 * })
 * console.log(lease.weightTokens) // 3
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetAdmissionLease extends S.Class<YeetAdmissionLease>($I`YeetAdmissionLease`)(
  {
    schemaVersion: S.Literal("yeet-admission-lease/v1"),
    ...admissionOwnerFields,
    command: S.String,
    startedAt: S.String,
    admittedAtMillis: S.Finite,
    heartbeatAtMillis: S.Finite,
    enqueuedAtMillis: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefault(Effect.succeed(0))
    ),
    nonce: S.String.pipe(S.withConstructorDefault(Effect.succeed("")), S.withDecodingDefault(Effect.succeed(""))),
    hotPaths: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<string>())),
      S.withDecodingDefault(Effect.succeed(A.empty<string>()))
    ),
    runScope: S.optionalKey(RunScopeRecord),
  },
  $I.annote("YeetAdmissionLease", {
    description: "One machine-wide admission lease charging heavy repository work against memory capacity.",
  })
) {}

/**
 * Encoded form of {@link YeetAdmissionLease}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace YeetAdmissionLease {
  /**
   * Encoded form of {@link YeetAdmissionLease}.
   *
   * @since 0.0.0
   */
  export type Encoded = typeof YeetAdmissionLease.Encoded;
}

/**
 * One durable queue ticket: a contender waiting for admission.
 *
 * **Example** (Construct a ticket value)
 *
 * ```ts
 * import { YeetAdmissionTicket } from "@beep/repo-cli/test/RepoRun"
 *
 * const ticket = YeetAdmissionTicket.make({
 *   schemaVersion: "yeet-admission-ticket/v1",
 *   pid: 1234,
 *   procStart: "8241991",
 *   kind: "review-fix",
 *   weightTokens: 1,
 *   priority: "verify",
 *   originKey: "aaaabbbbcccc",
 *   checkoutRoot: "/repo",
 *   branch: "feat/x",
 *   enqueuedAtMillis: 0,
 *   heartbeatAtMillis: 0,
 *   nonce: "d0a7b0dc-54ec-4b51-95c7-6fafdc18d206"
 * })
 * console.log(ticket.kind) // "review-fix"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetAdmissionTicket extends S.Class<YeetAdmissionTicket>($I`YeetAdmissionTicket`)(
  {
    schemaVersion: S.Literal("yeet-admission-ticket/v1"),
    ...admissionOwnerFields,
    enqueuedAtMillis: S.Finite,
    heartbeatAtMillis: S.Finite,
    blockedOnOriginAtMillis: S.Finite.pipe(
      S.withConstructorDefault(Effect.succeed(0)),
      S.withDecodingDefault(Effect.succeed(0))
    ),
    nonce: S.String,
  },
  $I.annote("YeetAdmissionTicket", {
    description: "One durable admission-queue ticket owned by a waiting contender process.",
  })
) {}

/**
 * Encoded form of {@link YeetAdmissionTicket}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace YeetAdmissionTicket {
  /**
   * Encoded form of {@link YeetAdmissionTicket}.
   *
   * @since 0.0.0
   */
  export type Encoded = typeof YeetAdmissionTicket.Encoded;
}

/**
 * Durable acknowledgement state for one admission-reap output sink.
 *
 * **Example** (Recognize a protocol-deferred sink)
 *
 * ```ts
 * import { AdmissionClaimSinkState } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(AdmissionClaimSinkState.is["pending-protocol-off"]("pending-protocol-off")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionClaimSinkState = LiteralKit(["pending", "pending-protocol-off", "complete"]).pipe(
  $I.annoteSchema("AdmissionClaimSinkState", {
    description: "Durable acknowledgement state for one admission-reap output sink.",
  })
);

/**
 * Durable acknowledgement state for one admission-reap output sink.
 *
 * @category models
 * @since 0.0.0
 */
export type AdmissionClaimSinkState = typeof AdmissionClaimSinkState.Type;

const admissionReapClaimFields = {
  schemaVersion: S.Literal("yeet-admission-reap-claim/v1"),
  sourcePath: S.String,
  nonce: S.String,
  claimedAtMillis: S.Finite,
  attemptJournal: AdmissionClaimSinkState,
  admissionJournal: AdmissionClaimSinkState,
};

/**
 * Recoverable outbox for one dead admission lease lifecycle.
 *
 * **Example** (Construct a lease reap claim)
 *
 * ```ts
 * import { AdmissionLeaseReapClaim, YeetAdmissionLease } from "@beep/repo-cli/test/RepoRun"
 *
 * const lease = YeetAdmissionLease.make({
 *   schemaVersion: "yeet-admission-lease/v1",
 *   pid: 1234,
 *   procStart: "8241991",
 *   kind: "full-proof",
 *   weightTokens: 3,
 *   priority: "verify",
 *   originKey: "aaaabbbbcccc",
 *   checkoutRoot: "/repo",
 *   branch: "feat/x",
 *   command: "bun run beep yeet verify",
 *   startedAt: "2026-09-03T14:00:00Z",
 *   admittedAtMillis: 1,
 *   heartbeatAtMillis: 1,
 *   enqueuedAtMillis: 0,
 *   nonce: "d0a7b0dc-54ec-4b51-95c7-6fafdc18d206"
 * })
 * const claim = AdmissionLeaseReapClaim.make({
 *   schemaVersion: "yeet-admission-reap-claim/v1",
 *   _tag: "lease",
 *   sourcePath: "/runtime/lease.json",
 *   nonce: lease.nonce,
 *   claimedAtMillis: 2,
 *   attemptJournal: "pending",
 *   admissionJournal: "pending",
 *   lease
 * })
 * console.log(claim._tag) // "lease"
 * ```
 *
 * @category coordination
 * @since 0.0.0
 */
export class AdmissionLeaseReapClaim extends S.Class<AdmissionLeaseReapClaim>($I`AdmissionLeaseReapClaim`)(
  {
    ...admissionReapClaimFields,
    _tag: S.Literal("lease"),
    lease: YeetAdmissionLease,
  },
  $I.annote("AdmissionLeaseReapClaim", {
    description: "Recoverable per-sink outbox for one verified dead admission lease.",
  })
) {}

/**
 * Recoverable outbox for one dead admission queue-ticket lifecycle.
 *
 * **Example** (Reference the ticket claim class)
 *
 * ```ts
 * import { AdmissionTicketReapClaim } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof AdmissionTicketReapClaim) // "function"
 * ```
 *
 * @category coordination
 * @since 0.0.0
 */
export class AdmissionTicketReapClaim extends S.Class<AdmissionTicketReapClaim>($I`AdmissionTicketReapClaim`)(
  {
    ...admissionReapClaimFields,
    _tag: S.Literal("ticket"),
    ticket: YeetAdmissionTicket,
  },
  $I.annote("AdmissionTicketReapClaim", {
    description: "Recoverable per-sink outbox for one verified dead admission queue ticket.",
  })
) {}

/**
 * Recoverable outbox for one claimed dead admission lifecycle.
 *
 * **Example** (Recognize a lease claim)
 *
 * ```ts
 * import { AdmissionReapClaim } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof AdmissionReapClaim.guards.lease) // "function"
 * ```
 *
 * @category coordination
 * @since 0.0.0
 */
export const AdmissionReapClaim = S.Union([AdmissionLeaseReapClaim, AdmissionTicketReapClaim]).pipe(
  S.toTaggedUnion("_tag"),
  $I.annoteSchema("AdmissionReapClaim", {
    description: "Recoverable per-sink outbox for one claimed dead admission lifecycle.",
  })
);

/**
 * Recoverable outbox for one claimed dead admission lifecycle.
 *
 * @category models
 * @since 0.0.0
 */
export type AdmissionReapClaim = typeof AdmissionReapClaim.Type;

/**
 * Durable phase of a ticket-to-lease promotion transition.
 *
 * **Example** (Recognize a published lease phase)
 *
 * ```ts
 * import { AdmissionPromotionPhase } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(AdmissionPromotionPhase.is["lease-published"]("lease-published")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const AdmissionPromotionPhase = LiteralKit([
  "prepared",
  "lease-published",
  "ticket-removed",
  "admission-journaled",
]).pipe(
  $I.annoteSchema("AdmissionPromotionPhase", {
    description: "Durable recovery phase of one ticket-to-lease promotion transition.",
  })
);

/**
 * Durable recovery phase of one ticket-to-lease promotion transition.
 *
 * @category models
 * @since 0.0.0
 */
export type AdmissionPromotionPhase = typeof AdmissionPromotionPhase.Type;

/**
 * Recoverable transition tying one queue ticket to its active lease.
 *
 * **Example** (Reference the promotion transition class)
 *
 * ```ts
 * import { AdmissionPromotionTransition } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(typeof AdmissionPromotionTransition) // "function"
 * ```
 *
 * @category coordination
 * @since 0.0.0
 */
export class AdmissionPromotionTransition extends S.Class<AdmissionPromotionTransition>(
  $I`AdmissionPromotionTransition`
)(
  {
    schemaVersion: S.Literal("yeet-admission-promotion/v1"),
    nonce: S.String,
    ticketPath: S.String,
    leasePath: S.String,
    ticket: YeetAdmissionTicket,
    lease: YeetAdmissionLease,
    phase: AdmissionPromotionPhase,
    createdAtMillis: S.Finite,
  },
  $I.annote("AdmissionPromotionTransition", {
    description: "Recoverable nonce-keyed transition tying one admission ticket to its promoted lease.",
  })
) {}

/**
 * Admission policy knobs with the chartered production defaults.
 *
 * Defaults come verbatim from ship-velocity SPEC D1 / research c5: 5 GiB
 * tokens, capacity `min(10, floor((MemAvailableGiB - 10) / 5))`, hard floor
 * 15 GiB, heartbeat 5s, progress 15s, publish aging 120s, review-fix class
 * cap 3.
 *
 * **Example** (Construct the default config)
 *
 * ```ts
 * import { AdmissionConfig } from "@beep/repo-cli/test/RepoRun"
 *
 * const config = AdmissionConfig.make({})
 * console.log(config.slotSizeGib) // 5
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AdmissionConfig extends S.Class<AdmissionConfig>($I`AdmissionConfig`)(
  {
    slotSizeGib: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(5))),
    reserveGib: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(10))),
    capacityMaxTokens: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(10))),
    hardFloorGib: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(15))),
    heartbeatSeconds: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(5))),
    suspectAfterSeconds: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(30))),
    progressSeconds: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(15))),
    publishAgingSeconds: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(120))),
    reviewFixClassCap: S.Finite.pipe(S.withConstructorDefault(Effect.succeed(3))),
  },
  $I.annote("AdmissionConfig", {
    description: "Machine-wide admission policy knobs with chartered ship-velocity D1 defaults.",
  })
) {}

/**
 * One admission request derived from a Yeet run mode.
 *
 * **Example** (Build a full-proof request)
 *
 * ```ts
 * import { AdmissionRequest } from "@beep/repo-cli/test/RepoRun"
 *
 * const request = AdmissionRequest.make({
 *   kind: "full-proof",
 *   weightTokens: 3,
 *   priority: "verify",
 *   originKey: "aaaabbbbcccc",
 *   checkoutRoot: "/repo",
 *   branch: "feat/x",
 *   command: "bun run beep yeet verify"
 * })
 * console.log(request.priority) // "verify"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AdmissionRequest extends S.Class<AdmissionRequest>($I`AdmissionRequest`)(
  {
    attemptId: UUID.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    ...attemptInputFactFields,
    kind: AdmissionWorkKind,
    weightTokens: S.Finite,
    priority: AdmissionPriority,
    originKey: S.String,
    checkoutRoot: S.String,
    branch: S.String,
    command: S.String,
  },
  $I.annote("AdmissionRequest", {
    description: "One admission request for heavyweight repository work.",
  })
) {}

/**
 * Point-in-time view of the machine-wide admission state.
 *
 * **Example** (Construct an empty snapshot)
 *
 * ```ts
 * import { AdmissionSnapshot } from "@beep/repo-cli/test/RepoRun"
 *
 * const snapshot = AdmissionSnapshot.make({
 *   capacityTokens: 8,
 *   activeTokens: 0,
 *   memAvailableGib: 50,
 *   hardFloorEngaged: false,
 *   leases: [],
 *   tickets: [],
 *   dead: [],
 *   quarantined: []
 * })
 * console.log(snapshot.capacityTokens) // 8
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class AdmissionSnapshot extends S.Class<AdmissionSnapshot>($I`AdmissionSnapshot`)(
  {
    capacityTokens: S.Finite,
    activeTokens: S.Finite,
    memAvailableGib: S.Finite,
    hardFloorEngaged: S.Boolean,
    leases: S.Array(YeetAdmissionLease),
    tickets: S.Array(YeetAdmissionTicket),
    dead: S.Array(S.String),
    quarantined: S.Array(S.String),
  },
  $I.annote("AdmissionSnapshot", {
    description: "Point-in-time view of machine-wide admission leases, queue, and capacity.",
  })
) {}

/**
 * Encoded form of {@link AdmissionSnapshot}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace AdmissionSnapshot {
  /**
   * Encoded form of {@link AdmissionSnapshot}.
   *
   * @since 0.0.0
   */
  export type Encoded = typeof AdmissionSnapshot.Encoded;
}

const DeadLeaseRetentionReason = LiteralKit([
  "legacy-nonce-missing",
  "recorded-unit-mismatch",
  "live-unit-conflict",
]).pipe(
  $I.annoteSchema("DeadLeaseRetentionReason", {
    description: "Reason a verified dead admission lease must remain for retry or operator inspection.",
  })
);

/**
 * Conservative action chosen for one verified dead admission lease.
 *
 * **Details**
 *
 * A `stop` plan is allowed only when the lease nonce identifies a scope that
 * no live lease represents. `reap` proves no stop is needed, while `retain`
 * preserves ambiguous evidence for a later operator or retry.
 *
 * **Example** (Retain ambiguous legacy authority)
 *
 * ```ts
 * import { DeadLeaseScopePlan } from "@beep/repo-cli/test/RepoRun"
 *
 * const plan: typeof DeadLeaseScopePlan.Type = {
 *   _tag: "retain",
 *   leasePath: "/runtime/legacy.lease.json",
 *   reason: "legacy-nonce-missing"
 * }
 * console.log(DeadLeaseScopePlan.guards.retain(plan)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const DeadLeaseScopePlan = S.TaggedUnion({
  retain: { leasePath: S.String, reason: DeadLeaseRetentionReason },
  reap: { leasePath: S.String },
  stop: { leasePath: S.String, unitName: S.String },
}).pipe(
  $I.annoteSchema("DeadLeaseScopePlan", {
    description: "Conservative stop, reap, or retain decision for one verified dead admission lease.",
  })
);

/**
 * Conservative action chosen for one verified dead admission lease.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DeadLeaseScopePlan = typeof DeadLeaseScopePlan.Type;

interface QualitySchedulerErrorOptions {
  readonly exitCode?: number;
  readonly reason?: QualitySchedulerErrorReason;
}

const QualitySchedulerErrorReason = LiteralKit(["journal-lock-lost", "journal-lock-retry-exhausted"]);

type QualitySchedulerErrorReason = typeof QualitySchedulerErrorReason.Type;

/**
 * Failure raised while coordinating machine-wide admission.
 *
 * **Example** (Construct a scheduler error)
 *
 * ```ts
 * import { QualitySchedulerError } from "@beep/repo-cli/test/RepoRun"
 *
 * const error = QualitySchedulerError.make({ message: "admission directory is not owned by this user" })
 * console.log(error.message.length > 0) // true
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class QualitySchedulerError extends S.TaggedError<QualitySchedulerError>($I`QualitySchedulerError`)(
  "QualitySchedulerError",
  {
    message: S.String,
    exitCode: S.optionalKey(S.Finite),
    reason: S.optionalKey(QualitySchedulerErrorReason),
    cause: S.optionalKey(Defect({ includeStack: true })),
  },
  $I.annoteError<QualitySchedulerError>("QualitySchedulerError", {
    description: "Failure raised while coordinating machine-wide quality admission.",
  })
) {
  /** Process exit code reported when this error reaches the runtime boundary. */
  override readonly [Runtime.errorExitCode] = this.exitCode ?? 1;

  /**
   * Curried constructor pairing a message with an unknown cause.
   *
   * @since 0.0.0
   */
  static readonly new: {
    (cause: unknown, message: string, opts?: QualitySchedulerErrorOptions): QualitySchedulerError;
    (message: string, opts?: QualitySchedulerErrorOptions): (cause: unknown) => QualitySchedulerError;
  } = dual(
    3,
    (cause: unknown, message: string, { exitCode, reason }: QualitySchedulerErrorOptions = {}): QualitySchedulerError =>
      QualitySchedulerError.make({
        cause,
        message,
        ...O.getSomesStruct({
          exitCode: O.fromUndefinedOr(exitCode),
          reason: O.fromUndefinedOr(reason),
        }),
      })
  );
}
