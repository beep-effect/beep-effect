/**
 * Offline owner-checkpoint state and evidence contracts. No runtime is activated.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { FinalCheckReceipt } from "./FinalCheck.schemas.ts";
import { MergeGateCheckRun, MergeGateRead } from "./MergeGate.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/OwnerCheckpoint.schemas");
const Revision = S.Int.check(S.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER - 1 }));
const PositiveId = S.Int.check(S.isGreaterThan(0));
/**
 * Full immutable Git commit identity; shortened merge assertions are refused.
 *
 * **Example** (Inspect OwnerCheckpointHead)
 * ```ts
 * import { OwnerCheckpointHead } from "@beep/repo-cli/test/Yeet"
 * console.log(OwnerCheckpointHead.make("a".repeat(40)).length) // 40
 * ```
 * @category models
 * @since 0.0.0
 */
export const OwnerCheckpointHead = S.String.check(S.isPattern(/^[a-f0-9]{40}$/u)).pipe(
  $I.annoteSchema("OwnerCheckpointHead", { description: "Full immutable Git commit identity." })
);

/**
 * PR-specific owner binding independent of a SHA-scoped GitHub check.
 *
 * **Example** (Inspect OwnerCheckpointBinding)
 * ```ts
 * import { OwnerCheckpointBinding } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof OwnerCheckpointBinding.make) // "function"
 * ```
 * @category models
 * @since 0.0.0
 */
export class OwnerCheckpointBinding extends S.Opaque<OwnerCheckpointBinding, { readonly brand: unique symbol }>()(
  S.Struct({
    repository: S.String.check(S.isPattern(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/u)),
    prNumber: PositiveId,
    owner: Sha256Hex,
    head: OwnerCheckpointHead,
    generation: Revision,
  }).pipe(
    $I.annoteSchema("OwnerCheckpointBinding", {
      description: "PR-specific owner binding independent of a SHA-scoped GitHub check.",
    })
  )
) {}

const BaseProvenance = S.Struct({
  repository: OwnerCheckpointBinding.fields.repository,
  ref: S.NonEmptyString,
  sha: OwnerCheckpointHead,
}).pipe(
  $I.annoteSchema("BaseProvenance", { description: "Authenticated actual base git ref at prerequisite observation." })
);

/**
 * Finite owner and merge lifecycle; uncertainty never authorizes another dispatch.
 *
 * **Example** (Inspect OwnerCheckpointState)
 * ```ts
 * import { OwnerCheckpointState } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof OwnerCheckpointState.cases) // "object"
 * ```
 * @category models
 * @since 0.0.0
 */
export const OwnerCheckpointState = S.TaggedUnion({
  Held: { reason: S.Literals(["registered", "synchronized", "revoked"]) },
  Released: { releaseId: Sha256Hex, evidenceDigest: Sha256Hex, base: BaseProvenance },
  Claimed: { releaseId: Sha256Hex, claimId: Sha256Hex },
  Uncertain: { releaseId: Sha256Hex, claimId: Sha256Hex },
  Merged: { claimId: Sha256Hex, mergeCommit: S.OptionFromNullOr(OwnerCheckpointHead) },
}).pipe(
  $I.annoteSchema("OwnerCheckpointState", {
    description: "Finite owner and merge lifecycle; uncertainty never authorizes another dispatch.",
  })
);
/**
 * Runtime type of {@link OwnerCheckpointState}.
 * @category type-level
 * @since 0.0.0
 */
export type OwnerCheckpointState = typeof OwnerCheckpointState.Type;

/**
 * Durable compare-and-set owner state.
 *
 * **Example** (Inspect OwnerCheckpointRecord)
 * ```ts
 * import { OwnerCheckpointRecord } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof OwnerCheckpointRecord.make) // "function"
 * ```
 * @category models
 * @since 0.0.0
 */
export class OwnerCheckpointRecord extends S.Opaque<OwnerCheckpointRecord, { readonly brand: unique symbol }>()(
  S.Struct({
    binding: OwnerCheckpointBinding,
    revision: Revision,
    state: OwnerCheckpointState,
  }).pipe($I.annoteSchema("OwnerCheckpointRecord", { description: "Durable compare-and-set owner state." }))
) {}

/**
 * One classic status on the exact head; latest native identity wins.
 *
 * **Example** (Inspect OwnerCheckpointClassicStatus)
 * ```ts
 * import { OwnerCheckpointClassicStatus } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof OwnerCheckpointClassicStatus.make) // "function"
 * ```
 * @category models
 * @since 0.0.0
 */
const VercelContext = S.Literals(["Vercel – oip-web", "Vercel – oip-web-staging", "Vercel – todox"]);
const VercelDescription = S.Literals(["Deployment rate limited — retry in 24 hours."]);
const VercelTarget = S.Literals(["https://vercel.com/kriegclouds-projects?upgradeToPro=build-rate-limit"]);
/**
 * Finite native status classification bound to its exact status ID and context.
 * **Example** (Ordinary statuses have no exception evidence)
 * ```ts
 * import { OwnerCheckpointStatusEvidence } from "@beep/repo-cli/test/Yeet"
 * console.log(OwnerCheckpointStatusEvidence.cases.Ordinary.make({})._tag) // Ordinary
 * ```
 * @category models
 * @since 0.0.0
 */
export const OwnerCheckpointStatusEvidence = S.TaggedUnion({
  Ordinary: {},
  VercelBuildRateLimit: {
    statusId: PositiveId,
    context: VercelContext,
    producer: S.Literals(["vercel[bot]"]),
    description: VercelDescription,
    targetUrl: VercelTarget,
  },
}).pipe($I.annoteSchema("OwnerCheckpointStatusEvidence", { description: "Finite bound vendor status evidence." }));
/**
 * Exact-head classic status with finite vendor evidence and native update time.
 *
 * **Example** (Inspect the classic status schema)
 * ```ts
 * import { OwnerCheckpointClassicStatus } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof OwnerCheckpointClassicStatus) // "function"
 * ```
 * @category models
 * @since 0.0.0
 */
export class OwnerCheckpointClassicStatus extends S.Opaque<
  OwnerCheckpointClassicStatus,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    id: PositiveId,
    context: S.NonEmptyString,
    state: S.Literals(["success", "pending", "failure", "error"]),
    diagnostic: OwnerCheckpointStatusEvidence,
    updatedAt: S.DateTimeUtc,
  }).pipe(
    $I.annoteSchema("OwnerCheckpointClassicStatus", {
      description: "One classic status on the exact head; latest native identity wins.",
    })
  )
) {}

/**
 * The sole App-bound check excluded from its own prerequisite gate.
 *
 * **Example** (Inspect OwnerCheckpointSelfCheck)
 * ```ts
 * import { OwnerCheckpointSelfCheck } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof OwnerCheckpointSelfCheck.make) // "function"
 * ```
 * @category models
 * @since 0.0.0
 */
export class OwnerCheckpointSelfCheck extends S.Opaque<OwnerCheckpointSelfCheck, { readonly brand: unique symbol }>()(
  S.Struct({
    id: PositiveId,
    applicationId: PositiveId,
    run: MergeGateCheckRun,
  }).pipe(
    $I.annoteSchema("OwnerCheckpointSelfCheck", {
      description: "The sole App-bound check excluded from its own prerequisite gate.",
    })
  )
) {}

/**
 * Fresh upstream PR snapshot including classic statuses and the own-check identity.
 *
 * **Example** (Inspect OwnerCheckpointSnapshot)
 * ```ts
 * import { OwnerCheckpointSnapshot } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof OwnerCheckpointSnapshot.make) // "function"
 * ```
 * @category models
 * @since 0.0.0
 */
export class OwnerCheckpointSnapshot extends S.Opaque<OwnerCheckpointSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    repository: OwnerCheckpointBinding.fields.repository,
    base: BaseProvenance,
    state: S.Literals(["open", "closed", "merged"]),
    read: MergeGateRead,
    selfCheck: OwnerCheckpointSelfCheck,
    statuses: S.Array(OwnerCheckpointClassicStatus),
  }).pipe(
    $I.annoteSchema("OwnerCheckpointSnapshot", {
      description: "Fresh upstream PR snapshot including classic statuses and the own-check identity.",
    })
  )
) {}

/**
 * Finalized upstream-only observer evidence; never a fabricated full merge-ready receipt.
 *
 * **Example** (Inspect OwnerCheckpointObserver)
 * ```ts
 * import { OwnerCheckpointObserver } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof OwnerCheckpointObserver.make) // "function"
 * ```
 * @category models
 * @since 0.0.0
 */
export class OwnerCheckpointObserver extends S.Opaque<OwnerCheckpointObserver, { readonly brand: unique symbol }>()(
  S.Struct({
    mode: S.tag("upstream-owner-prerequisites"),
    phase: S.tag("finished"),
    outcome: S.tag("success"),
    finalizedAt: S.DateTimeUtc,
    snapshot: OwnerCheckpointSnapshot,
    digest: Sha256Hex,
  }).pipe(
    $I.annoteSchema("OwnerCheckpointObserver", {
      description: "Finalized upstream-only observer evidence; never a fabricated full merge-ready receipt.",
    })
  )
) {}

/**
 * Decoded prerequisite metadata supplied by a future trusted receipt verifier.
 *
 * **Example** (Inspect OwnerCheckpointEvidence)
 * ```ts
 * import { OwnerCheckpointEvidence } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof OwnerCheckpointEvidence.make) // "function"
 * ```
 * @category models
 * @since 0.0.0
 */
export class OwnerCheckpointEvidence extends S.Opaque<OwnerCheckpointEvidence, { readonly brand: unique symbol }>()(
  S.Struct({
    observer: OwnerCheckpointObserver,
    classic: OwnerCheckpointSnapshot,
    finalCheck: FinalCheckReceipt,
    digest: Sha256Hex,
  }).pipe(
    $I.annoteSchema("OwnerCheckpointEvidence", {
      description: "Decoded prerequisite metadata supplied by a future trusted receipt verifier.",
    })
  )
) {}

/**
 * Finite owner-check identity and freshness policy without a disable switch.
 *
 * **Example** (Inspect OwnerCheckpointPolicy)
 * ```ts
 * import { OwnerCheckpointPolicy } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof OwnerCheckpointPolicy.make) // "function"
 * ```
 * @category models
 * @since 0.0.0
 */
export class OwnerCheckpointPolicy extends S.Opaque<OwnerCheckpointPolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    applicationId: PositiveId,
    context: S.tag("Owner checkpoint"),
    maxAgeMillis: S.Int.check(S.isBetween({ minimum: 1, maximum: 300000 })),
  }).pipe(
    $I.annoteSchema("OwnerCheckpointPolicy", {
      description: "Finite owner-check identity and freshness policy without a disable switch.",
    })
  )
) {}

/**
 * Explicit domain transitions; no generic runtime dispatcher or implicit merge retry.
 *
 * **Example** (Inspect OwnerCheckpointCommand)
 * ```ts
 * import { OwnerCheckpointCommand } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof OwnerCheckpointCommand.cases) // "object"
 * ```
 * @category models
 * @since 0.0.0
 */
export const OwnerCheckpointCommand = S.TaggedUnion({
  Release: { releaseId: Sha256Hex, evidence: OwnerCheckpointEvidence },
  Synchronize: { head: OwnerCheckpointHead },
  Revoke: {},
  Claim: { claimId: Sha256Hex, snapshot: OwnerCheckpointSnapshot },
  Unknown: { claimId: Sha256Hex },
  Confirm: { claimId: Sha256Hex, mergeCommit: S.OptionFromNullOr(OwnerCheckpointHead) },
}).pipe(
  $I.annoteSchema("OwnerCheckpointCommand", {
    description: "Explicit domain transitions; no generic runtime dispatcher or implicit merge retry.",
  })
);
/**
 * Runtime type of {@link OwnerCheckpointCommand}.
 * @category type-level
 * @since 0.0.0
 */
export type OwnerCheckpointCommand = typeof OwnerCheckpointCommand.Type;

/**
 * Exact generation and revision assertions for one owner transition.
 *
 * **Example** (Inspect OwnerCheckpointRequest)
 * ```ts
 * import { OwnerCheckpointRequest } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof OwnerCheckpointRequest.make) // "function"
 * ```
 * @category models
 * @since 0.0.0
 */
export class OwnerCheckpointRequest extends S.Opaque<OwnerCheckpointRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    binding: OwnerCheckpointBinding,
    expectedRevision: Revision,
    command: OwnerCheckpointCommand,
  }).pipe(
    $I.annoteSchema("OwnerCheckpointRequest", {
      description: "Exact generation and revision assertions for one owner transition.",
    })
  )
) {}

/**
 * Transactionally committed external metadata or merge intent.
 *
 * **Example** (Inspect OwnerCheckpointIntent)
 * ```ts
 * import { OwnerCheckpointIntent } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof OwnerCheckpointIntent.cases) // "object"
 * ```
 * @category models
 * @since 0.0.0
 */
export const OwnerCheckpointIntent = S.TaggedUnion({
  CheckHeld: {},
  CheckReleased: { releaseId: Sha256Hex, base: BaseProvenance },
  Merge: { claimId: Sha256Hex },
}).pipe(
  $I.annoteSchema("OwnerCheckpointIntent", {
    description: "Transactionally committed external metadata or merge intent.",
  })
);
/**
 * Runtime type of {@link OwnerCheckpointIntent}.
 * @category type-level
 * @since 0.0.0
 */
export type OwnerCheckpointIntent = typeof OwnerCheckpointIntent.Type;

/**
 * Outbox publication or dispatch state; pending intent is not execution.
 *
 * **Example** (Inspect OwnerCheckpointDelivery)
 * ```ts
 * import { OwnerCheckpointDelivery } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof OwnerCheckpointDelivery.cases) // "object"
 * ```
 * @category models
 * @since 0.0.0
 */
export const OwnerCheckpointDelivery = S.TaggedUnion({
  Pending: {},
  Published: { checkRunId: PositiveId },
  Dispatched: {},
  Uncertain: {},
  Confirmed: {},
}).pipe(
  $I.annoteSchema("OwnerCheckpointDelivery", {
    description: "Outbox publication or dispatch state; pending intent is not execution.",
  })
);
/**
 * Runtime type of {@link OwnerCheckpointDelivery}.
 * @category type-level
 * @since 0.0.0
 */
export type OwnerCheckpointDelivery = typeof OwnerCheckpointDelivery.Type;

/**
 * Durable intent in the same transaction as the owner state change.
 *
 * **Example** (Inspect OwnerCheckpointOutbox)
 * ```ts
 * import { OwnerCheckpointOutbox } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof OwnerCheckpointOutbox.make) // "function"
 * ```
 * @category models
 * @since 0.0.0
 */
export class OwnerCheckpointOutbox extends S.Opaque<OwnerCheckpointOutbox, { readonly brand: unique symbol }>()(
  S.Struct({
    binding: OwnerCheckpointBinding,
    revision: Revision,
    intent: OwnerCheckpointIntent,
    delivery: OwnerCheckpointDelivery,
  }).pipe(
    $I.annoteSchema("OwnerCheckpointOutbox", {
      description: "Durable intent in the same transaction as the owner state change.",
    })
  )
) {}

/**
 * One indivisible owner-record and outbox mutation.
 *
 * **Example** (Inspect OwnerCheckpointMutation)
 * ```ts
 * import { OwnerCheckpointMutation } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof OwnerCheckpointMutation.make) // "function"
 * ```
 * @category models
 * @since 0.0.0
 */
export class OwnerCheckpointMutation extends S.Opaque<OwnerCheckpointMutation, { readonly brand: unique symbol }>()(
  S.Struct({
    record: OwnerCheckpointRecord,
    outbox: OwnerCheckpointOutbox,
  }).pipe(
    $I.annoteSchema("OwnerCheckpointMutation", { description: "One indivisible owner-record and outbox mutation." })
  )
) {}

/**
 * Finite content-free refusal; raw API and storage failures are discarded.
 *
 * **Example** (Inspect OwnerCheckpointError)
 * ```ts
 * import { OwnerCheckpointError } from "@beep/repo-cli/test/Yeet"
 * console.log(OwnerCheckpointError.make({ reason: "conflict" }).reason) // conflict
 * ```
 * @category models
 * @since 0.0.0
 */
export class OwnerCheckpointError extends S.TaggedError<OwnerCheckpointError, { readonly brand: unique symbol }>(
  $I`OwnerCheckpointError`
)(
  "OwnerCheckpointError",
  {
    reason: S.Literals([
      "conflict",
      "missing",
      "state",
      "binding",
      "evidence",
      "freshness",
      "gate",
      "publication",
      "storage",
      "uncertain",
    ]),
  },
  $I.annoteError<OwnerCheckpointError>("OwnerCheckpointError", {
    description: "Content-free owner checkpoint refusal.",
  })
) {}
/**
 * Native merge observation separated from durable recording success.
 * **Example** (Inspect the outcome constructors)
 * ```ts
 * import { OwnerCheckpointMergeOutcome } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof OwnerCheckpointMergeOutcome.cases) // "object"
 * ```
 * @category models
 * @since 0.0.0
 */
export const OwnerCheckpointMergeOutcome = S.TaggedUnion({
  Confirmed: { mergeCommit: S.OptionFromNullOr(OwnerCheckpointHead), recording: S.Literals(["recorded", "pending"]) },
  Uncertain: { recording: S.Literals(["recorded", "pending"]) },
}).pipe(
  $I.annoteSchema("OwnerCheckpointMergeOutcome", {
    description: "Native merge observation separated from durable recording success.",
  })
);
/**
 * Runtime type of {@link OwnerCheckpointMergeOutcome}.
 * @category type-level
 * @since 0.0.0
 */
export type OwnerCheckpointMergeOutcome = typeof OwnerCheckpointMergeOutcome.Type;

const NativeSelfCheck = S.Struct({
  id: PositiveId,
  name: S.NonEmptyString,
  status: S.String,
  conclusion: S.NullOr(S.String),
  app: S.Struct({ id: PositiveId }),
});
const NativeClassicStatus = S.Struct({
  id: PositiveId,
  context: S.NonEmptyString,
  state: OwnerCheckpointClassicStatus.fields.state,
  description: S.NullOr(S.String.check(S.isMaxLength(1024))),
  target_url: S.NullOr(S.String.check(S.isMaxLength(2048))),
  creator: S.Struct({ login: S.String.check(S.isMaxLength(128)) }),
  updated_at: S.DateTimeUtcFromString,
});
/**
 * Project the App identity from the same native row as the own check metadata.
 * **Details** A future trusted authenticated reader must verify response origin;
 * arbitrary caller JSON does not establish GitHub authenticity.
 * **Example** (Inspect native row projection)
 * ```ts
 * import { projectOwnerCheckpointSelfCheck } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof projectOwnerCheckpointSelfCheck) // "function"
 * ```
 * @param input - One native check-run response row.
 * @returns Bound finite metadata, ignoring any caller-supplied applicationId field.
 * @category parsing
 * @since 0.0.0
 */
export const projectOwnerCheckpointSelfCheck = (input: unknown) =>
  S.decodeUnknownEffect(NativeSelfCheck)(input).pipe(
    Effect.mapBoth({
      onSuccess: (row) =>
        OwnerCheckpointSelfCheck.make({
          id: row.id,
          applicationId: row.app.id,
          run: MergeGateCheckRun.make({ id: row.id, name: row.name, status: row.status, conclusion: row.conclusion }),
        }),
      onFailure: () => OwnerCheckpointError.make({ reason: "evidence" }),
    })
  );
/**
 * Retain only the exact known vendor build-rate-limit exception, never arbitrary Vercel failures.
 * **Example** (Inspect finite status projection)
 * ```ts
 * import { projectOwnerCheckpointClassicStatus } from "@beep/repo-cli/test/Yeet"
 * console.log(typeof projectOwnerCheckpointClassicStatus) // "function"
 * ```
 * @param input - Native status row from an authenticated exact-head read.
 * @returns Ordinary status or exact finite rate-limit evidence; raw text is discarded.
 * @category parsing
 * @since 0.0.0
 */
export const projectOwnerCheckpointClassicStatus = (input: unknown) =>
  S.decodeUnknownEffect(NativeClassicStatus)(input).pipe(
    Effect.mapBoth({
      onSuccess: (row) =>
        OwnerCheckpointClassicStatus.make({
          id: row.id,
          context: row.context,
          state: row.state,
          updatedAt: row.updated_at,
          diagnostic:
            row.state === "failure" &&
            S.is(VercelContext)(row.context) &&
            row.creator.login === "vercel[bot]" &&
            S.is(VercelDescription)(row.description) &&
            S.is(VercelTarget)(row.target_url)
              ? OwnerCheckpointStatusEvidence.cases.VercelBuildRateLimit.make({
                  statusId: row.id,
                  context: row.context,
                  producer: row.creator.login,
                  description: row.description,
                  targetUrl: row.target_url,
                })
              : OwnerCheckpointStatusEvidence.cases.Ordinary.make({}),
        }),
      onFailure: () => OwnerCheckpointError.make({ reason: "evidence" }),
    })
  );
