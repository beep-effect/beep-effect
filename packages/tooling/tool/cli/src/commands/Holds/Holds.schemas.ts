/**
 * Hold ledger models: a hold is a falsifiable claim that a temporary repo
 * decision (a held dependency, an exact pin, an override, a patch, an OSV
 * exception) is still needed, with the probe that would disprove it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { makeClaimEnvelope } from "@beep/epistemics/Claim";
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("commands/Holds/Holds.schemas");

/**
 * Stable kebab-case identifier of a hold; anchors in config files cite it.
 *
 * **Example** (Decode a hold id)
 *
 * ```ts
 * import { HoldId } from "@beep/repo-cli/commands/Holds"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(HoldId)("jsdom-vitest-eventtarget")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HoldId = S.String.check(S.isPattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)).pipe(
  S.brand("HoldId"),
  $I.annoteSchema("HoldId", { description: "Kebab-case hold identifier cited by config anchors." })
);

/**
 * Decoded type of {@link HoldId}.
 *
 * @category models
 * @since 0.0.0
 */
export type HoldId = typeof HoldId.Type;

/**
 * Where a dependency-shaped hold is enforced (wave 1 of the hold ledger).
 *
 * **Example** (Narrow a hold kind)
 *
 * ```ts
 * import { HoldKind } from "@beep/repo-cli/commands/Holds"
 *
 * console.log(HoldKind.is["syncpack-held"]("syncpack-held")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HoldKind = LiteralKit(["syncpack-held", "exact-pin", "override", "patch", "osv-exception"]).pipe(
  $I.annoteSchema("HoldKind", { description: "The config surface that enforces a dependency-shaped hold." })
);

/**
 * Decoded type of {@link HoldKind}.
 *
 * @category models
 * @since 0.0.0
 */
export type HoldKind = typeof HoldKind.Type;

/**
 * One place in a tracked config file that enforces the hold.
 *
 * @category models
 * @since 0.0.0
 */
export class HoldAnchor extends S.Opaque<HoldAnchor, { readonly brand: unique symbol }>()(
  S.Struct({
    file: S.NonEmptyString,
    key: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("HoldAnchor", {
      description: "A tracked file and the key or entry inside it that enforces the hold.",
    })
  )
) {}

/**
 * What a hold governs: the packages held together and every anchor enforcing it.
 *
 * @category models
 * @since 0.0.0
 */
export class HoldSubject extends S.Opaque<HoldSubject, { readonly brand: unique symbol }>()(
  S.Struct({
    packages: S.NonEmptyArray(S.NonEmptyString),
    anchors: S.NonEmptyArray(HoldAnchor),
  }).pipe(
    $I.annoteSchema("HoldSubject", {
      description: "Packages held as one group (lockstep families share a hold) and their config anchors.",
    })
  )
) {}

/**
 * The runtime a scripted probe must run under; a probe on the wrong runtime proves nothing.
 *
 * @category models
 * @since 0.0.0
 */
export const ProbeRuntime = LiteralKit(["bun", "node", "vitest-bun", "vitest-node"]).pipe(
  $I.annoteSchema("ProbeRuntime", { description: "Pinned runtime a scripted probe executes under." })
);

/**
 * Decoded type of {@link ProbeRuntime}.
 *
 * @category models
 * @since 0.0.0
 */
export type ProbeRuntime = typeof ProbeRuntime.Type;

/**
 * How a hold could be disproved.
 *
 * **Details**
 *
 * `Scripted` runs a command twice in a scratch install: once with the known-bad
 * control version, which must still reproduce `failureSignature`, and once with
 * the candidate version. `Judgement` holds cannot be scripted; a judge run over
 * the diff since the last version is their probe.
 *
 * **Example** (A scripted falsifier)
 *
 * ```ts
 * import { HoldFalsifier } from "@beep/repo-cli/commands/Holds"
 *
 * const scripted = HoldFalsifier.cases.Scripted.make({
 *   runtime: "vitest-bun",
 *   command: ["bunx", "vitest", "run", "--bun", "probe.test.ts"],
 *   controlVersion: "30.1.0",
 *   candidate: "latest",
 *   failureSignature: "not a valid instance of EventTarget",
 * })
 * console.log(scripted._tag) // "Scripted"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const HoldFalsifier = S.TaggedUnion({
  Scripted: {
    runtime: ProbeRuntime,
    command: S.NonEmptyArray(S.NonEmptyString),
    controlVersion: S.NonEmptyString,
    candidate: S.NonEmptyString,
    failureSignature: S.NonEmptyString,
  },
  Judgement: {
    question: S.NonEmptyString,
    rubric: S.NonEmptyString,
  },
}).pipe($I.annoteSchema("HoldFalsifier", { description: "The probe that would disprove a hold." }));

/**
 * Decoded type of {@link HoldFalsifier}.
 *
 * @category models
 * @since 0.0.0
 */
export type HoldFalsifier = typeof HoldFalsifier.Type;

/**
 * An upstream signal that makes a hold worth re-checking before its deadline.
 *
 * @category models
 * @since 0.0.0
 */
export const HoldWatchTarget = S.TaggedUnion({
  NpmVersion: { packageName: S.NonEmptyString, distTag: S.NonEmptyString },
  GithubIssueClosed: { repository: S.NonEmptyString, number: S.Int.check(S.isGreaterThan(0)) },
  GithubRelease: { repository: S.NonEmptyString },
}).pipe($I.annoteSchema("HoldWatchTarget", { description: "Upstream signal that wakes a hold re-check." }));

/**
 * Decoded type of {@link HoldWatchTarget}.
 *
 * @category models
 * @since 0.0.0
 */
export type HoldWatchTarget = typeof HoldWatchTarget.Type;

/**
 * What a lane does when the hold's probe flips or its lifetime runs out.
 *
 * @category models
 * @since 0.0.0
 */
export const HoldExitAction = S.TaggedUnion({
  Unpin: {},
  Rewrite: { path: S.NonEmptyString },
  EscalateToGoal: { slug: S.NonEmptyString },
}).pipe($I.annoteSchema("HoldExitAction", { description: "The change made when a hold ends." }));

/**
 * Decoded type of {@link HoldExitAction}.
 *
 * @category models
 * @since 0.0.0
 */
export type HoldExitAction = typeof HoldExitAction.Type;

/**
 * The proposition a hold claim asserts.
 *
 * @category models
 * @since 0.0.0
 */
export const HoldProposition = S.TaggedStruct("Hold", {
  holdId: HoldId,
  kind: HoldKind,
  subject: HoldSubject,
  assertion: S.NonEmptyString,
  falsifier: HoldFalsifier,
  watch: S.Array(HoldWatchTarget),
  exitAction: HoldExitAction,
}).pipe(
  $I.annoteSchema("HoldProposition", {
    description: "A temporary repo decision, why it exists, and the probe that would disprove it.",
  })
);

/**
 * Decoded type of {@link HoldProposition}.
 *
 * @category models
 * @since 0.0.0
 */
export type HoldProposition = typeof HoldProposition.Type;

/**
 * Identifier of one immutable hold claim version.
 *
 * @category models
 * @since 0.0.0
 */
export const HoldVersionId = S.NonEmptyString.pipe(
  S.brand("HoldVersionId"),
  $I.annoteSchema("HoldVersionId", { description: "Identifier of one hold claim version." })
);

/**
 * Identifier of one recorded probe run, cited by a version's `supportedBy`.
 *
 * @category models
 * @since 0.0.0
 */
export const ProbeRunId = S.NonEmptyString.pipe(
  S.brand("ProbeRunId"),
  $I.annoteSchema("ProbeRunId", { description: "Identifier of one recorded probe run." })
);

/**
 * Decoded type of {@link ProbeRunId}.
 *
 * @category models
 * @since 0.0.0
 */
export type ProbeRunId = typeof ProbeRunId.Type;

/**
 * Identifier of the activity that produced a version (an admit, a renewal, a sweep).
 *
 * @category models
 * @since 0.0.0
 */
export const HoldActivityId = S.NonEmptyString.pipe(
  S.brand("HoldActivityId"),
  $I.annoteSchema("HoldActivityId", { description: "Identifier of the activity that produced a hold version." })
);

/**
 * Identifier of the agent or person responsible for a version.
 *
 * @category models
 * @since 0.0.0
 */
export const HoldPrincipalId = S.NonEmptyString.pipe(
  S.brand("HoldPrincipalId"),
  $I.annoteSchema("HoldPrincipalId", { description: "Agent or person responsible for a hold version." })
);

const HoldEnvelope = makeClaimEnvelope({
  $I: $RepoCliId.create("commands/Holds/HoldClaim"),
  proposition: HoldProposition,
  logicalKey: (proposition) => `hold:${proposition.holdId}`,
  ids: {
    claimVersion: HoldVersionId,
    assertion: ProbeRunId,
    activity: HoldActivityId,
    principal: HoldPrincipalId,
  },
});

/**
 * One immutable hold claim version. A renewal appends a new version whose
 * `supersedes` names the previous one; `validTime.validTo` is the lease end.
 *
 * @category models
 * @since 0.0.0
 */
export const HoldClaimVersion = HoldEnvelope.ClaimVersion;

/**
 * Decoded type of {@link HoldClaimVersion}.
 *
 * @category models
 * @since 0.0.0
 */
export type HoldClaimVersion = typeof HoldClaimVersion.Type;

/**
 * Result of running the probe command against one version.
 *
 * **Details**
 *
 * `Reproduced` means the failure signature appeared, `Passed` means the command
 * exited 0 without it, and `Inconclusive` covers every other outcome (a
 * non-zero exit without the signature, a timeout, an install failure). An
 * inconclusive run never counts as a pass.
 *
 * @category models
 * @since 0.0.0
 */
export const ProbeOutcome = S.TaggedUnion({
  Reproduced: {},
  Passed: {},
  Inconclusive: { detail: S.NonEmptyString },
}).pipe($I.annoteSchema("ProbeOutcome", { description: "Result of one probe command run." }));

/**
 * Decoded type of {@link ProbeOutcome}.
 *
 * @category models
 * @since 0.0.0
 */
export type ProbeOutcome = typeof ProbeOutcome.Type;

/**
 * Verdict of a single probe run, before confirmation across runs.
 *
 * @category models
 * @since 0.0.0
 */
export const ProbeRunVerdict = LiteralKit(["still-holds", "candidate-passed", "probe-broken", "inconclusive"]).pipe(
  $I.annoteSchema("ProbeRunVerdict", { description: "What one control-plus-candidate probe run shows." })
);

/**
 * Decoded type of {@link ProbeRunVerdict}.
 *
 * @category models
 * @since 0.0.0
 */
export type ProbeRunVerdict = typeof ProbeRunVerdict.Type;

/**
 * One recorded probe run: the control and candidate outcomes and the verdict
 * they yield. Probe runs are the assertions a hold version is `supportedBy`.
 *
 * @category models
 * @since 0.0.0
 */
export class ProbeRun extends S.Opaque<ProbeRun, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("hold-probe-run/v1"),
    id: ProbeRunId,
    holdId: HoldId,
    ranAt: S.DateTimeUtcFromMillis,
    commitSha: S.String.check(S.isPattern(/^[0-9a-f]{40}$/)),
    runtime: ProbeRuntime,
    controlVersion: S.NonEmptyString,
    control: ProbeOutcome,
    candidateVersion: S.NonEmptyString,
    candidate: ProbeOutcome,
    verdict: ProbeRunVerdict,
  }).pipe(
    $I.annoteSchema("ProbeRun", {
      description: "One control-plus-candidate probe run recorded as evidence for a hold.",
    })
  )
) {}

/**
 * Verdict across a hold's recent runs: whether it is safe to act.
 *
 * **Details**
 *
 * `Flipped` needs the two most recent runs to both be `candidate-passed`. A
 * single passing run is `Unconfirmed`. Any `probe-broken` among the most recent
 * run escalates as `ProbeBroken` and never unpins.
 *
 * @category models
 * @since 0.0.0
 */
export const HoldVerdict = LiteralKit(["StillHolds", "Unconfirmed", "Flipped", "ProbeBroken", "Inconclusive"]).pipe(
  $I.annoteSchema("HoldVerdict", { description: "Whether a hold's probe history is safe to act on." })
);

/**
 * Decoded type of {@link HoldVerdict}.
 *
 * @category models
 * @since 0.0.0
 */
export type HoldVerdict = typeof HoldVerdict.Type;
