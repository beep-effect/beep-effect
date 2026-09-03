/**
 * Proof facts: the reusable unit of verification evidence.
 *
 * **Details**
 *
 * A proof is a fact about a lane's inputs at an epoch, never about a branch
 * or a git SHA. The time-to-certainty packet (decisions.md rulings 1–7) fixes
 * the shape: the reuse key is a tier-independent action digest over the lane
 * command, the sorted env profile, the lane's input digest, and the epoch
 * salt; the ledger is a per-checkout append-only NDJSON file; enforcement
 * starts with attempt-to-attempt reuse inside the pre-push tier and only
 * after shadow mode records zero disagreements over a ratified sample.
 *
 * This module carries the schemas only. The ledger service, the shadow
 * recorder, and the reuse decision live beside it and decode through these
 * classes; nothing here performs I/O.
 *
 * **Gotchas**
 *
 * The existing `YeetLaneProofState` (ProofState.ts) keys a lane on its
 * command hash plus a whole-tree diff fingerprint, so any edit anywhere
 * invalidates every lane. `ProofInputDigest` replaces the tree fingerprint
 * with per-lane inputs; the two coexist until the ledger migrates the
 * shadow records.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { CiLaneClass, CiLaneId } from "../../Ci/CiLane.ts";
import { YeetProofTier } from "./Planner.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/ProofFact");

/**
 * Schema version carried by every proof fact and ledger row.
 *
 * **Example** (Pin the version when writing a row)
 *
 * ```ts
 * import { PROOF_FACT_SCHEMA_VERSION } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(PROOF_FACT_SCHEMA_VERSION) // "proof-fact/v1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROOF_FACT_SCHEMA_VERSION = "proof-fact/v1";

/**
 * The env profile a lane ran under; part of the reuse key because PR-posture
 * env (blank DB secrets, pinned concurrency) and local env produce different
 * outcomes for the same inputs.
 *
 * **Example** (Check a profile literal)
 *
 * ```ts
 * import { ProofEnvProfile } from "@beep/repo-cli/test/Yeet"
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
 * Type of {@link ProofEnvProfile}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProofEnvProfile = typeof ProofEnvProfile.Type;

/**
 * The stage of the verification episode that produced a fact. Distinct from
 * the local `YeetProofTier`, which names the proof recipe, not the stage.
 *
 * **Example** (Check a stage literal)
 *
 * ```ts
 * import { ProofStage } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(ProofStage.is["pre-push"]("pre-push")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProofStage = LiteralKit(["repair-loop", "pre-push", "merged-preview", "hosted"]).pipe(
  $I.annoteSchema("ProofStage", {
    description: "Verification stage that produced the fact: repair loop, pre-push wave, merged preview, or hosted.",
  })
);

/**
 * Type of {@link ProofStage}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProofStage = typeof ProofStage.Type;

/**
 * Terminal outcome a fact records. Pending or interrupted lanes never become
 * facts; they stay attempt-journal rows.
 *
 * **Example** (Check an outcome literal)
 *
 * ```ts
 * import { ProofOutcome } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(ProofOutcome.is.passed("passed")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProofOutcome = LiteralKit(["passed", "failed"]).pipe(
  $I.annoteSchema("ProofOutcome", {
    description: "Terminal lane outcome recorded by a proof fact.",
  })
);

/**
 * Type of {@link ProofOutcome}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProofOutcome = typeof ProofOutcome.Type;

/**
 * How a lane's input digest was obtained. `turbo-task-hash` is Turbo's own
 * task hash (one hashing engine, ruling 5); `declared-inputs` is reserved for
 * a lane that cannot be a Turbo task and declares its inputs explicitly; a
 * lane with neither is `undeclared` and is never reusable.
 *
 * **Example** (Check an input source literal)
 *
 * ```ts
 * import { ProofInputSource } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(ProofInputSource.is["turbo-task-hash"]("turbo-task-hash")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProofInputSource = LiteralKit(["turbo-task-hash", "declared-inputs", "undeclared"]).pipe(
  $I.annoteSchema("ProofInputSource", {
    description: "Origin of a lane's input digest: Turbo task hash, declared inputs, or undeclared (never reusable).",
  })
);

/**
 * Type of {@link ProofInputSource}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProofInputSource = typeof ProofInputSource.Type;

/**
 * The epoch salt: everything whose change invalidates every fact at once
 * (ruling 4). `digest` is the SHA-256 over the component digests in field
 * order and is the only member that enters the reuse key.
 *
 * **Example** (Build an epoch record)
 *
 * ```ts
 * import { ProofEpoch } from "@beep/repo-cli/test/Yeet"
 *
 * const epoch = ProofEpoch.make({
 *   lockfileDigest: "a1",
 *   bunVersion: "1.4.0",
 *   nodeVersion: "24.19.0",
 *   rootTurboConfigDigest: "b2",
 *   rootTsconfigDigest: "c3",
 *   policyPackVersion: "0.0.0",
 *   digest: "d4",
 * })
 * console.log(epoch.digest) // "d4"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofEpoch extends S.Class<ProofEpoch>($I`ProofEpoch`)(
  {
    lockfileDigest: S.NonEmptyString,
    bunVersion: S.NonEmptyString,
    nodeVersion: S.NonEmptyString,
    rootTurboConfigDigest: S.NonEmptyString,
    rootTsconfigDigest: S.NonEmptyString,
    policyPackVersion: S.NonEmptyString,
    digest: S.NonEmptyString,
  },
  $I.annote("ProofEpoch", {
    description:
      "Epoch salt components (lockfile, toolchain pins, root Turbo and TypeScript config, policy-pack version) and their combined digest.",
  })
) {}

/**
 * The reuse key (ruling 1): a tier-independent action digest. `key` is the
 * SHA-256 over `laneId`, `commandDigest`, `envProfile`, `inputDigest`, and
 * `epochDigest` in that order; two facts with equal keys describe the same
 * verification of the same inputs regardless of branch, SHA, or stage.
 *
 * **Example** (Build a reuse key)
 *
 * ```ts
 * import { ProofInputDigest } from "@beep/repo-cli/test/Yeet"
 *
 * const key = ProofInputDigest.make({
 *   laneId: "coverage",
 *   laneClass: "cli-runnable",
 *   commandDigest: "c0",
 *   envProfile: "local",
 *   inputDigest: "i1",
 *   inputSource: "turbo-task-hash",
 *   epochDigest: "e2",
 *   key: "k3",
 * })
 * console.log(key.laneId) // "coverage"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofInputDigest extends S.Class<ProofInputDigest>($I`ProofInputDigest`)(
  {
    laneId: CiLaneId,
    laneClass: CiLaneClass,
    commandDigest: S.NonEmptyString,
    envProfile: ProofEnvProfile,
    inputDigest: S.NonEmptyString,
    inputSource: ProofInputSource,
    epochDigest: S.NonEmptyString,
    key: S.NonEmptyString,
  },
  $I.annote("ProofInputDigest", {
    description:
      "Tier-independent reuse key: lane identity, command digest, env profile, lane input digest, epoch digest, and their combined key.",
  })
) {}

/**
 * Where a fact came from. Provenance never enters the reuse key; it is what
 * an auditor reads when a reused proof is questioned.
 *
 * **Example** (Build provenance for a local pre-push lane)
 *
 * ```ts
 * import { ProofProvenance } from "@beep/repo-cli/test/Yeet"
 *
 * const provenance = ProofProvenance.make({
 *   runId: "run-1",
 *   attemptId: "attempt-1",
 *   originKey: "origin-1",
 *   tier: "full",
 *   stage: "pre-push",
 *   headSha: "88fa371cb0",
 *   hostedRunId: null,
 * })
 * console.log(provenance.stage) // "pre-push"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofProvenance extends S.Class<ProofProvenance>($I`ProofProvenance`)(
  {
    runId: S.NonEmptyString,
    attemptId: S.NonEmptyString,
    originKey: S.NonEmptyString,
    tier: YeetProofTier,
    stage: ProofStage,
    headSha: S.NonEmptyString,
    hostedRunId: S.NullOr(S.NonEmptyString),
  },
  $I.annote("ProofProvenance", {
    description:
      "Origin of a proof fact: run and attempt ids, checkout origin key, local proof tier, stage, head SHA, and the hosted run id when known.",
  })
) {}

/**
 * One reusable verification fact.
 *
 * **Example** (Build a passed fact)
 *
 * ```ts
 * import { ProofEpoch, ProofFact, ProofInputDigest, ProofProvenance } from "@beep/repo-cli/test/Yeet"
 *
 * const fact = ProofFact.make({
 *   schemaVersion: "proof-fact/v1",
 *   key: ProofInputDigest.make({
 *     laneId: "coverage",
 *     laneClass: "cli-runnable",
 *     commandDigest: "c0",
 *     envProfile: "local",
 *     inputDigest: "i1",
 *     inputSource: "turbo-task-hash",
 *     epochDigest: "e2",
 *     key: "k3",
 *   }),
 *   epoch: ProofEpoch.make({
 *     lockfileDigest: "a1",
 *     bunVersion: "1.4.0",
 *     nodeVersion: "24.19.0",
 *     rootTurboConfigDigest: "b2",
 *     rootTsconfigDigest: "c3",
 *     policyPackVersion: "0.0.0",
 *     digest: "e2",
 *   }),
 *   outcome: "passed",
 *   durationMs: 1200,
 *   provenance: ProofProvenance.make({
 *     runId: "run-1",
 *     attemptId: "attempt-1",
 *     originKey: "origin-1",
 *     tier: "full",
 *     stage: "pre-push",
 *     headSha: "88fa371cb0",
 *     hostedRunId: null,
 *   }),
 *   recordedAt: "2026-09-03T12:00:00.000Z",
 *   expiresAt: "2026-10-03T12:00:00.000Z",
 * })
 * console.log(fact.outcome) // "passed"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofFact extends S.Class<ProofFact>($I`ProofFact`)(
  {
    schemaVersion: S.Literal(PROOF_FACT_SCHEMA_VERSION),
    key: ProofInputDigest,
    epoch: ProofEpoch,
    outcome: ProofOutcome,
    durationMs: S.Finite.check(S.isGreaterThanOrEqualTo(0)),
    provenance: ProofProvenance,
    recordedAt: S.NonEmptyString,
    expiresAt: S.NonEmptyString,
  },
  $I.annote("ProofFact", {
    description:
      "One reusable verification fact: reuse key, epoch, terminal outcome, non-negative duration, provenance, and expiry bounded by the epoch's lifetime.",
  })
) {}

/**
 * Why a lookup did not reuse a fact. Every miss reason is a must-fail fixture
 * in shadow and enforcement tests (ruling 6 for the tripwire).
 *
 * **Example** (Check a miss reason literal)
 *
 * ```ts
 * import { ProofMissReason } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(ProofMissReason.is["changed-package-tripwire"]("changed-package-tripwire")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProofMissReason = LiteralKit([
  "no-fact",
  "prior-failed",
  "epoch-changed",
  "profile-mismatch",
  "changed-package-tripwire",
  "undeclared-inputs",
  "expired",
]).pipe(
  $I.annoteSchema("ProofMissReason", {
    description: "Reason a ledger lookup refused to reuse a fact.",
  })
);

/**
 * Type of {@link ProofMissReason}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProofMissReason = typeof ProofMissReason.Type;

/**
 * A lookup that found a reusable passed fact.
 *
 * **Example** (Build a hit)
 *
 * ```ts
 * import { ProofReuseHit } from "@beep/repo-cli/test/Yeet"
 *
 * const hit = ProofReuseHit.make({ key: "k3", factRecordedAt: "2026-09-03T12:00:00.000Z" })
 * console.log(hit.kind) // "hit"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofReuseHit extends S.Class<ProofReuseHit>($I`ProofReuseHit`)(
  {
    kind: S.tag("hit"),
    key: S.NonEmptyString,
    factRecordedAt: S.NonEmptyString,
  },
  $I.annote("ProofReuseHit", {
    description: "Ledger lookup outcome: a passed fact with the same reuse key exists and is valid.",
  })
) {}

/**
 * A lookup that must run the lane, with the reason.
 *
 * **Example** (Build a miss)
 *
 * ```ts
 * import { ProofReuseMiss } from "@beep/repo-cli/test/Yeet"
 *
 * const miss = ProofReuseMiss.make({ key: "k3", reason: "no-fact" })
 * console.log(miss.kind) // "miss"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofReuseMiss extends S.Class<ProofReuseMiss>($I`ProofReuseMiss`)(
  {
    kind: S.tag("miss"),
    key: S.NonEmptyString,
    reason: ProofMissReason,
  },
  $I.annote("ProofReuseMiss", {
    description: "Ledger lookup outcome: the lane must run, with the reason reuse was refused.",
  })
) {}

/**
 * Result of a ledger lookup.
 *
 * **Example** (Narrow a decision)
 *
 * ```ts
 * import { ProofReuseDecision, ProofReuseMiss } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const decision = ProofReuseMiss.make({ key: "k3", reason: "expired" })
 * console.log(S.is(ProofReuseDecision)(decision)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProofReuseDecision = S.Union([ProofReuseHit, ProofReuseMiss]).pipe(
  $I.annoteSchema("ProofReuseDecision", {
    title: "Proof Reuse Decision",
    description: "Hit (reuse the fact) or miss (run the lane) for one reuse key.",
  })
);

/**
 * Type of {@link ProofReuseDecision}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProofReuseDecision = typeof ProofReuseDecision.Type;

/**
 * Ledger row: a fact was recorded.
 *
 * **Example** (Decode a fact row from JSON)
 *
 * ```ts
 * import { ProofLedgerFactRow } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 *
 * const decode = S.decodeUnknownEffect(S.fromJsonString(ProofLedgerFactRow))
 * console.log(Effect.isEffect(decode("{}"))) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofLedgerFactRow extends S.Class<ProofLedgerFactRow>($I`ProofLedgerFactRow`)(
  {
    kind: S.tag("fact"),
    schemaVersion: S.Literal(PROOF_FACT_SCHEMA_VERSION),
    fact: ProofFact,
  },
  $I.annote("ProofLedgerFactRow", {
    description: "Append-only ledger row carrying one recorded proof fact.",
  })
) {}

/**
 * Ledger row: shadow mode recorded what it would have decided for a lane that
 * still ran. `observed` is the lane's real outcome; a `hit` decision paired
 * with an observed `failed` is a disagreement and blocks enforcement (ruling 7).
 *
 * **Example** (Recognise a disagreement)
 *
 * ```ts
 * import { ProofLedgerShadowRow, ProofReuseHit } from "@beep/repo-cli/test/Yeet"
 *
 * const row = ProofLedgerShadowRow.make({
 *   schemaVersion: "proof-fact/v1",
 *   attemptId: "attempt-2",
 *   decision: ProofReuseHit.make({ key: "k3", factRecordedAt: "2026-09-03T12:00:00.000Z" }),
 *   observed: "failed",
 *   recordedAt: "2026-09-03T12:05:00.000Z",
 * })
 * console.log(row.decision.kind === "hit" && row.observed === "failed") // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofLedgerShadowRow extends S.Class<ProofLedgerShadowRow>($I`ProofLedgerShadowRow`)(
  {
    kind: S.tag("shadow"),
    schemaVersion: S.Literal(PROOF_FACT_SCHEMA_VERSION),
    attemptId: S.NonEmptyString,
    decision: ProofReuseDecision,
    observed: ProofOutcome,
    recordedAt: S.NonEmptyString,
  },
  $I.annote("ProofLedgerShadowRow", {
    description: "Shadow-mode row: the decision the ledger would have made and the outcome the lane actually produced.",
  })
) {}

/**
 * Any row of the per-checkout proof ledger.
 *
 * **Example** (Decode a ledger row)
 *
 * ```ts
 * import { ProofLedgerRow, ProofReuseMiss, ProofLedgerShadowRow } from "@beep/repo-cli/test/Yeet"
 * import * as S from "effect/Schema"
 *
 * const row = ProofLedgerShadowRow.make({
 *   schemaVersion: "proof-fact/v1",
 *   attemptId: "attempt-2",
 *   decision: ProofReuseMiss.make({ key: "k3", reason: "no-fact" }),
 *   observed: "passed",
 *   recordedAt: "2026-09-03T12:05:00.000Z",
 * })
 * console.log(S.is(ProofLedgerRow)(row)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProofLedgerRow = S.Union([ProofLedgerFactRow, ProofLedgerShadowRow]).pipe(
  $I.annoteSchema("ProofLedgerRow", {
    title: "Proof Ledger Row",
    description: "One append-only row of the per-checkout proof ledger: a recorded fact or a shadow decision.",
  })
);

/**
 * Type of {@link ProofLedgerRow}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProofLedgerRow = typeof ProofLedgerRow.Type;
