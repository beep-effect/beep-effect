/**
 * Read-only goal completion verification and explicit workstation-scoped receipt refresh.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { appendContainedFileString, readContainedFileStringNoFollow } from "@beep/repo-cli-kit/cli/FsGuards";
import { JsonStringCodec } from "@beep/repo-cli-kit/schema/JsonCodec";
import { UUID } from "@beep/repo-cli-kit/schema/Uuid";
import { findRepoRoot } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Context from "effect/Context";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { identity } from "effect/Function";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { repoRunArtifactId } from "../../internal/repo-run/RepoRunArtifacts.ts";
import { resolveProofLedgerLocation } from "../Yeet/internal/ArtifactPaths.ts";
import { deriveYeetMergeReady } from "../Yeet/internal/MergeReadiness.policy.ts";
import { ProofJobRecord } from "../Yeet/internal/ProofJob.ts";
import { decideYeetReviewWindow, YEET_REVIEW_WINDOW_DEFAULT, YeetReviewWindow } from "../Yeet/internal/ReviewWindow.ts";
import { YeetMergeReadyFromEncoded, YeetVerdict } from "../Yeet/internal/Verdict.ts";
import { YeetWatchCheck } from "../Yeet/internal/WatchStream.ts";
import { YeetCommandError } from "../Yeet/Yeet.errors.ts";
import { GoalCompletionEvidenceInput, GoalMergeTimeEvidenceRequest } from "./CompletionEvidence.schemas.ts";
import {
  decideGoalCompletionEvidence,
  describeGoalCompletionEvidence,
  goalCompletionIo,
  readGoalCompletion,
  readGoalMergeTimeEvidence,
} from "./CompletionEvidence.ts";
import {
  goalCompletionReceiptStore,
  GoalCompletionReceiptJson as ReceiptJson,
} from "./CompletionReceiptStore.service.ts";
import {
  GoalAcceptanceEvidenceRef,
  GoalCheckConclusion,
  GoalCloseoutView,
  GoalCompletionReceipt,
  GoalEvidenceCheck,
  GoalManifest,
  GoalMergeResult,
  GoalNonRequiredRed,
  GoalRequiredCheckFact,
  GoalRequiredCheckSnapshot,
  goalCloseoutVerification,
  goalPullRequestRefs,
} from "./Goals.schemas.ts";
import { listGoalPackets, parseGoalManifestText } from "./Inventory.ts";
import { canonicalJsonText, sha256Hex } from "./PacketCore/PacketDigest.ts";
import type { FsGuardError } from "@beep/repo-cli-kit/cli/FsGuards";
import type * as FileSystem from "effect/FileSystem";
import type { GoalObservedCheckRun } from "./CompletionEvidence.schemas.ts";
import type { GoalCompletionEvidenceVerdict, GoalCompletionOutcome, GoalPullRequestRef } from "./Goals.schemas.ts";
import type { GoalPacketRecord } from "./Inventory.ts";

const $I = $RepoCliId.create("commands/Goals/Completion");
const hostedRef = GoalAcceptanceEvidenceRef.make({ kind: "hosted-required-checks", ref: "required", gating: true });

/**
 * Pure verification input: absence is explicit and cannot become a success by default.
 *
 * **Example** (Inspect the observation boundary)
 *
 * ```ts
 * import { GoalCompletionObservation } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(GoalCompletionObservation.fields.merged)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GoalCompletionObservation extends S.Opaque<GoalCompletionObservation, { readonly brand: unique symbol }>()(
  S.Struct({
    repository: S.NonEmptyString,
    packet: S.NonEmptyString,
    declarationDigest: S.NonEmptyString,
    acceptedDeclarationDigest: S.Option(S.NonEmptyString),
    requiredChecks: S.Option(GoalRequiredCheckSnapshot).pipe(S.withConstructorDefault(Effect.succeedNone)),
    finalPullRequest: S.Int.check(S.isGreaterThan(0)),
    acceptedHead: S.Option(S.NonEmptyString),
    merged: S.Option(S.Boolean),
    merge: S.Option(GoalMergeResult),
    grandfathered: S.Boolean,
    evidence: S.Array(GoalEvidenceCheck),
    requiredCheckFacts: S.Array(GoalRequiredCheckFact).pipe(
      S.withConstructorDefault(Effect.succeed(A.empty<GoalRequiredCheckFact>()))
    ),
    nonRequiredReds: S.Array(GoalNonRequiredRed),
    subClaims: S.Array(GoalEvidenceCheck),
    verifiedAt: S.DateTimeUtcFromString,
  }).pipe(
    $I.annoteSchema("GoalCompletionObservation", {
      description: "Facts observed once for a declared final PR, separate from the pure completion decision.",
    })
  )
) {}

/**
 * Decides the merge-time evidence verdict for an observation or stored receipt.
 *
 * **Details**
 *
 * The verdict is re-derived from the stored rule-suite inventory and head-bound
 * facts every time, so a persisted `verified` outcome or `inventoryComplete`
 * flag cannot bypass incomplete evidence.
 *
 * **Example** (Inspect the verdict reader)
 *
 * ```ts
 * import { goalCompletionVerdict } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(typeof goalCompletionVerdict)
 * ```
 *
 * @param observation - Observation or receipt holding merge, head, inventory and facts.
 * @returns The verified, unsatisfied or unknown evidence verdict.
 * @category validation
 * @since 0.0.0
 */
export const goalCompletionVerdict = (
  observation: Pick<GoalCompletionObservation, "merge" | "acceptedHead" | "requiredChecks" | "requiredCheckFacts">
): GoalCompletionEvidenceVerdict =>
  decideGoalCompletionEvidence(
    GoalCompletionEvidenceInput.make({
      acceptedHead: observation.acceptedHead,
      mergeCommit: O.map(observation.merge, (merge) => merge.mergeCommit),
      requiredChecks: observation.requiredChecks,
      facts: observation.requiredCheckFacts,
    })
  );

/**
 * Names every reason a non-unsatisfied observation or receipt is not verified.
 *
 * **Details**
 *
 * Empty exactly when the merge facts, accepted head, accepted-head declaration
 * digest, every declared gating evidence check and the merge-time evidence
 * verdict are all present and verified. Doctor prints these reasons instead of
 * the merge-time verdict, so an unknown completion never reads as verified.
 *
 * **Example** (A receipt with no facts names what is missing)
 *
 * ```ts
 * import { goalCompletionUnknownReasons } from "@beep/repo-cli/commands/Goals/Completion"
 * import * as O from "effect/Option"
 *
 * const reasons = goalCompletionUnknownReasons({
 *   merge: O.none(),
 *   acceptedHead: O.none(),
 *   acceptedDeclarationDigest: O.none(),
 *   evidence: [],
 *   requiredChecks: O.none(),
 *   requiredCheckFacts: [],
 * })
 * console.log(reasons.length > 0) // true
 * ```
 *
 * @param observation - Observation or receipt facts.
 * @returns Plain reasons, empty when every gating fact is verified.
 * @category validation
 * @since 0.0.0
 */
export const goalCompletionUnknownReasons = (
  observation: Pick<
    GoalCompletionObservation,
    "merge" | "acceptedHead" | "acceptedDeclarationDigest" | "evidence" | "requiredChecks" | "requiredCheckFacts"
  >
): ReadonlyArray<string> => {
  const gating = A.filter(observation.evidence, (check) => check.ref.gating);
  const verdict = goalCompletionVerdict(observation);
  return [
    ...(O.isNone(observation.merge) ? ["merge facts unobserved"] : []),
    ...(O.isNone(observation.acceptedHead) ? ["accepted head unobserved"] : []),
    ...(O.isNone(observation.acceptedDeclarationDigest)
      ? ["accepted-head declaration digest unobserved (the packet manifest at the accepted head could not be read)"]
      : []),
    ...(A.isReadonlyArrayEmpty(gating) ? ["no gating acceptance evidence"] : []),
    ...A.map(
      A.filter(gating, (check) => check.outcome === "unknown" || O.isNone(check.observedHead)),
      (check) => `gating evidence ${check.ref.kind} "${check.ref.ref}" unknown`
    ),
    ...(verdict._tag === "unknown" ? [`merge-time evidence gaps: ${A.join(verdict.gaps, ", ")}`] : []),
  ];
};

const overallOutcome = (observation: GoalCompletionObservation): GoalCompletionOutcome => {
  if (observation.grandfathered) return "verified";
  if (O.contains(false)(observation.merged)) return "unsatisfied";
  const verdict = goalCompletionVerdict(observation);
  const gating = A.filter(observation.evidence, (check) => check.ref.gating);
  if (
    verdict._tag === "unsatisfied" ||
    A.some(
      gating,
      (check) =>
        check.outcome === "unsatisfied" ||
        O.exists(check.observedHead, (head) => !O.contains(head)(observation.acceptedHead))
    )
  )
    return "unsatisfied";
  if (O.isNone(observation.merged) || A.isReadonlyArrayNonEmpty(goalCompletionUnknownReasons(observation)))
    return "unknown";
  return "verified";
};

/**
 * Resolves observations without IO; substitutes cleanly in fixtures and offline callers.
 *
 * **Example** (Inspect the verifier service)
 *
 * ```ts
 * import { GoalCompletionVerifier } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(typeof GoalCompletionVerifier.of)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GoalCompletionVerifier extends Context.Service<
  GoalCompletionVerifier,
  {
    readonly resolve: (observation: GoalCompletionObservation) => Effect.Effect<GoalCompletionReceipt>;
  }
>()($I`GoalCompletionVerifier`) {
  /**
   * Resolve a receipt from a complete, typed observation.
   *
   * **Example** (Inspect the pure resolver)
   *
   * ```ts
   * import { GoalCompletionVerifier } from "@beep/repo-cli/commands/Goals/Completion"
   * console.log(typeof GoalCompletionVerifier.resolve)
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly resolve = Effect.fn("Goals.Completion.resolve")((observation: GoalCompletionObservation) =>
    Effect.succeed(
      GoalCompletionReceipt.make({
        schemaVersion: "goal-completion-receipt/v1",
        repository: observation.repository,
        packet: observation.packet,
        declarationDigest: observation.declarationDigest,
        acceptedDeclarationDigest: observation.acceptedDeclarationDigest,
        requiredChecks: observation.requiredChecks,
        finalPullRequest: observation.finalPullRequest,
        acceptedHead: observation.acceptedHead,
        merge: observation.merge,
        evidence: observation.evidence,
        requiredCheckFacts: observation.requiredCheckFacts,
        nonRequiredReds: observation.nonRequiredReds,
        subClaims: observation.subClaims,
        outcome: overallOutcome(observation),
        verifiedAt: observation.verifiedAt,
      })
    )
  );
}

const equivalentReceipt = S.toEquivalence(GoalCompletionReceipt);
/**
 * Digests the decoded completion declaration, initiative identity and packet identity canonically.
 *
 * **Details**
 *
 * A committed `closeout` record digests in the proposal's slot, so adopting a
 * verified proposal through `goals set-status` keeps the digest, and with it the
 * receipt that verified the closeout, unchanged.
 *
 * **Example** (Inspect the digest operation)
 *
 * ```ts
 * import { goalCompletionDeclarationDigest } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(typeof goalCompletionDeclarationDigest)
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const goalCompletionDeclarationDigest = Effect.fn("Goals.Completion.declarationDigest")(function* (
  manifest: GoalManifest
) {
  const gate = yield* S.encodeEffect(GoalManifest)(manifest);
  return yield* sha256Hex(
    canonicalJsonText({
      initiative: { id: manifest.initiative.id },
      packetId: manifest.initiative.packetId,
      completionGate: gate.completionGate,
      proposedCloseout: gate.proposedCloseout ?? gate.closeout,
      pullRequests: goalPullRequestRefs(manifest),
    })
  );
});
const evidenceCheck = (
  ref: GoalAcceptanceEvidenceRef,
  outcome: GoalCompletionOutcome,
  head: O.Option<string>,
  detail: string
) => GoalEvidenceCheck.make({ ref, outcome, observedHead: head, detail });

// Explicit recovery never rewrites the declared verdict: the receipt retains
// that reference and records which independently validated producer proved readiness.
const Recovery = S.Struct({
  jobId: UUID,
  prNumber: S.Int,
  mergedAt: S.DateTimeUtcFromString,
}).pipe(
  $I.annoteSchema("ReadinessRecovery", {
    description: "Explicit merged-PR readiness recovery bound to a terminal monitor job.",
  })
);
// Status keeps legacy summaries decodable; recovery requires explicit facts
// rather than letting legacy missing counters be interpreted as zero.
const RecoveryFacts = S.Struct({
  schemaVersion: S.tag("yeet-status/v1"),
  base: S.String,
  branch: S.String,
  runId: S.String,
  statusPath: S.String,
  createdAt: S.String,
  mergeReady: YeetMergeReadyFromEncoded.pipe(S.OptionFromOptionalKey),
  remote: S.Struct({
    available: S.Boolean,
    checked: S.Boolean,
    readFailure: YeetCommandError.pipe(S.OptionFromOptionalKey),
    number: S.Int,
    state: S.String,
    isDraft: S.Boolean,
    mergeable: S.String,
    mergeStateStatus: S.String,
    reviewDecision: S.optionalKey(S.String),
    headSha: S.String.pipe(S.OptionFromOptionalKey),
    reviewWindow: YeetReviewWindow.pipe(S.OptionFromOptionalKey),
    checks: S.Array(YeetWatchCheck),
    checkCount: S.Natural,
    failingCheckCount: S.Natural,
    pendingCheckCount: S.Natural,
    requiredCheckCount: S.Natural,
    failingRequiredCheckCount: S.Natural,
    pendingRequiredCheckCount: S.Natural,
    optionalCheckCount: S.Natural,
    failingOptionalCheckCount: S.Natural,
    pendingOptionalCheckCount: S.Natural,
    unresolvedReviewThreadCount: S.Natural,
    followUpThreadCount: S.Natural,
  }),
  closeout: S.Struct({
    issueCount: S.Natural,
    gateIssues: S.Array(S.String),
    path: S.String,
    state: S.tag("present"),
    reviewedHeadSha: S.String.pipe(S.OptionFromOptionalKey),
    greptileScore: S.String.pipe(S.OptionFromOptionalKey),
  }),
}).pipe(
  $I.annoteSchema("RecoveryFacts", {
    description: "Complete nonnegative hard-gate counters required for historical readiness recovery.",
  })
);
const decodeRecoveryStatus = JsonStringCodec(RecoveryFacts).decode;
const decodeJob = JsonStringCodec(ProofJobRecord).decode;
const decodeRecoveryTime = S.decodeUnknownEffect(S.DateTimeUtcFromString);
const decodeRecoveryJobId = S.decodeUnknownEffect(UUID);

const recoverReadiness = Effect.fn("Goals.Completion.recoverReadiness")(function* (
  root: string,
  ref: GoalAcceptanceEvidenceRef,
  head: string,
  branch: string,
  recovery: typeof Recovery.Type
) {
  const path = yield* Path.Path;
  const runId = yield* repoRunArtifactId(branch);
  const runRoot = path.join(root, ".beep", "yeet", "runs", runId);
  if (path.resolve(root, ref.ref) !== path.join(runRoot, "verdict.json")) {
    return yield* YeetCommandError.make({ message: "Declared verdict path is not canonical for its branch." });
  }
  const jobFile = path.join(root, ".beep", "yeet", "jobs", `${recovery.jobId}.json`);
  const jobRead = yield* readContainedFileStringNoFollow(root, jobFile);
  const statusFile = path.join(runRoot, "status.json");
  const statusRead = yield* readContainedFileStringNoFollow(root, statusFile);
  const pipe1 = yield* Effect.fromOption(jobRead.contents).pipe(
    Effect.mapError(() =>
      YeetCommandError.make({
        message: jobRead.exists
          ? "canonical job artifact is unreadable or not a file"
          : "canonical job artifact is absent",
      })
    )
  );
  const job = yield* decodeJob(pipe1);
  const pipe2 = yield* Effect.fromOption(statusRead.contents).pipe(
    Effect.mapError(() =>
      YeetCommandError.make({
        message: statusRead.exists
          ? "canonical status artifact is unreadable or not a file"
          : "canonical status artifact is absent",
      })
    )
  );
  const status = yield* decodeRecoveryStatus(pipe2);
  const runner = yield* Effect.fromOption(job.runner).pipe(
    Effect.mapError(() => YeetCommandError.make({ message: "job runner receipt is absent" }))
  );
  const outcome = yield* Effect.fromOption(job.outcome).pipe(
    Effect.mapError(() => YeetCommandError.make({ message: "job outcome receipt is absent" }))
  );
  const systemd = yield* Effect.fromOption(job.systemd).pipe(
    Effect.mapError(() => YeetCommandError.make({ message: "job service finalization receipt is absent" }))
  );
  const start = yield* decodeRecoveryTime(runner.startedAt);
  const observed = yield* decodeRecoveryTime(status.createdAt);
  const end = yield* decodeRecoveryTime(outcome.endedAt);
  const submitted = yield* decodeRecoveryTime(job.submittedAt);
  const finalized = yield* decodeRecoveryTime(systemd.finalizedAt);
  const millis = DateTime.toEpochMillis;
  const checks: ReadonlyArray<readonly [string, boolean]> = [
    ["job ID mismatch", job.jobId === recovery.jobId],
    ["job is not finished", job.phase === "finished"],
    ["job outcome is not successful", outcome.verdictOutcome === "success"],
    ["service finalization is not successful", systemd.serviceResult === "success"],
    ["service did not exit normally", O.contains("exited")(systemd.exitCode)],
    ["service exit status is not zero", O.contains("0")(systemd.exitStatus)],
    ["job was terminated", O.isNone(job.terminationReason)],
    ["job cancellation was requested", O.isNone(job.cancelRequestedAt)],
    ["job is not a monitor", job.request.mode === "monitor"],
    ["job did not request until-ready", A.contains(job.request.argv, "--until-ready")],
    [
      "job requested an incompatible monitor mode",
      !A.some(job.request.argv, (arg) => arg === "--until-merged" || arg === "--watch"),
    ],
    ["job checkout mismatch", path.resolve(job.request.checkout) === path.resolve(root)],
    ["job branch mismatch", job.request.branch === branch],
    ["job base mismatch", job.request.base === status.base],
    ["job PR number mismatch", O.contains(recovery.prNumber)(job.prNumber)],
    ["job unit name mismatch", job.unit.unitName === `beep-proof-${recovery.jobId}.service`],
    ["job log path mismatch", job.unit.logPath === path.join(root, ".beep", "yeet", "jobs", `${recovery.jobId}.log`)],
    ["status run ID mismatch", status.runId === runId],
    ["status branch mismatch", status.branch === branch],
    ["status path mismatch", status.statusPath === statusFile],
    ["status PR number mismatch", status.remote.number === recovery.prNumber],
    ["status head mismatch", O.contains(head)(status.remote.headSha)],
    ["closeout head mismatch", O.contains(head)(status.closeout.reviewedHeadSha)],
    ["closeout path mismatch", status.closeout.path === path.join(runRoot, "pr-closeout.json")],
    ["job started before submission", millis(submitted) <= millis(start)],
    ["status predates job start", millis(start) <= millis(observed)],
    ["status was recorded after job end", millis(observed) <= millis(end)],
    ["job finalized before its end", millis(end) <= millis(finalized)],
    ["job finalized after PR merge", millis(finalized) <= millis(recovery.mergedAt)],
    ["recorded readiness is absent or false", O.exists(status.mergeReady, (ready) => ready.ready)],
    [
      "derived hard readiness criteria are not satisfied",
      O.exists(deriveYeetMergeReady(status.closeout, status.remote), (ready) => ready.ready),
    ],
  ];
  const refusal = A.findFirst(checks, ([, holds]) => !holds);
  if (O.isSome(refusal)) {
    return yield* YeetCommandError.make({ message: refusal.value[0] });
  }
  return true;
});

const readinessRecoveryRefusal = (verdict: YeetVerdict, head: string): O.Option<string> => {
  const checks: ReadonlyArray<readonly [string, boolean]> = [
    ["declared verdict is not a publish result", verdict.mode === "publish"],
    ["declared publish verdict is not successful", verdict.outcome === "success"],
    ["declared verdict head mismatch", O.contains(head)(verdict.resolvedHeadSha)],
    ["declared verdict already records readiness", O.isNone(verdict.mergeReady)],
  ];
  return O.map(
    A.findFirst(checks, ([, holds]) => !holds),
    ([reason]) => reason
  );
};

const readLocalEvidence = Effect.fn("Goals.Completion.localEvidence")(function* (
  root: string,
  ref: GoalAcceptanceEvidenceRef,
  head: string,
  recovery: O.Option<typeof Recovery.Type>
) {
  if (ref.kind !== "yeet-verdict")
    return evidenceCheck(
      ref,
      "unknown",
      O.none(),
      `${ref.kind} reference needs an independently head-bound provider; no evidence inferred from its path.`
    );
  const read = yield* readContainedFileStringNoFollow(root, ref.ref).pipe(Effect.option);
  const verdict =
    O.isSome(read) && O.isSome(read.value.contents)
      ? yield* JsonStringCodec(YeetVerdict).decode(read.value.contents.value).pipe(Effect.option)
      : O.none<YeetVerdict>();
  if (O.isNone(verdict)) return evidenceCheck(ref, "unknown", O.none(), "Yeet verdict absent, invalid or unreadable.");
  const observedHead = verdict.value.resolvedHeadSha;
  const ready = O.map(verdict.value.mergeReady, (value) => value.ready);
  const refusal = readinessRecoveryRefusal(verdict.value, head);
  if (O.isSome(recovery) && O.isNone(refusal)) {
    return yield* recoverReadiness(root, ref, head, verdict.value.branch, recovery.value).pipe(
      Effect.map(() =>
        evidenceCheck(
          ref,
          "verified",
          O.some(head),
          `Readiness recovered from canonical status.json and successful monitor job ${recovery.value.jobId}; verdict bytes unchanged.`
        )
      ),
      Effect.catch((error) =>
        Effect.succeed(evidenceCheck(ref, "unknown", observedHead, `Readiness recovery refused: ${error.message}`))
      )
    );
  }
  const outcome = Match.value({ observedHead, ready }).pipe(
    Match.when(
      ({ observedHead, ready }) => O.exists(observedHead, (value) => value !== head) || O.contains(false)(ready),
      (): GoalCompletionOutcome => "unsatisfied"
    ),
    Match.when(
      ({ observedHead, ready }) => O.isSome(ready) && O.isSome(observedHead),
      (): GoalCompletionOutcome => "verified"
    ),
    Match.orElse((): GoalCompletionOutcome => "unknown")
  );
  return evidenceCheck(
    ref,
    outcome,
    observedHead,
    Match.value({ recovery: O.isSome(recovery), outcome }).pipe(
      Match.when({ recovery: false }, () => "Yeet verdict checked against resolvedHeadSha and mergeReady.ready."),
      Match.when(
        { outcome: "verified" },
        () => "Readiness recovery unnecessary: declared verdict already verifies the resolved head and readiness."
      ),
      Match.orElse(
        () => `Readiness recovery refused: ${O.getOrElse(refusal, () => "declared verdict does not permit recovery")}.`
      )
    )
  );
});

const readAcceptedManifest = Effect.fn("Goals.Completion.acceptedManifest")(function* (
  root: string,
  head: string,
  slug: string
) {
  const io = yield* goalCompletionIo();
  const path = `goals/${slug}/ops/manifest.json`;
  const local = yield* io.manifestAtHead(root, head, path).pipe(Effect.orElseSucceed(O.none<string>));
  const acceptedText = O.isSome(local)
    ? local
    : yield* io.hostedManifest(root, head, path).pipe(Effect.orElseSucceed(O.none<string>));
  const acceptedParsed = O.flatMap(acceptedText, parseGoalManifestText);
  const acceptedManifest = O.isSome(acceptedParsed)
    ? yield* S.decodeUnknownEffect(GoalManifest)(acceptedParsed.value).pipe(Effect.option)
    : O.none<GoalManifest>();
  return acceptedManifest;
});

const readDeclaredEvidence = Effect.fn("Goals.Completion.declaredEvidence")(function* (
  root: string,
  manifest: GoalManifest,
  head: string,
  gatingOutcome: GoalCompletionOutcome,
  initial: ReadonlyArray<GoalEvidenceCheck>,
  recovery: O.Option<typeof Recovery.Type>
) {
  let evidence = initial;
  for (const ref of manifest.completionGate.acceptanceEvidence ?? []) {
    evidence = A.append(
      evidence,
      ref.kind === "hosted-required-checks"
        ? evidenceCheck(ref, gatingOutcome, O.some(head), "Hosted required checks at accepted head.")
        : yield* readLocalEvidence(root, ref, head, recovery)
    );
  }
  return evidence;
});

// The hosted check records what the head-bound required facts show (a red, a
// missing result, or all green). Overall verification separately needs the
// complete merge-time inventory, so newer green facts can clear an older red to
// unknown without verifying an incomplete inventory.
const hostedRequiredOutcome = (
  verdict: GoalCompletionEvidenceVerdict,
  required: O.Option<ReadonlyArray<string>>,
  facts: ReadonlyArray<GoalRequiredCheckFact>
): GoalCompletionOutcome => {
  if (verdict._tag === "unsatisfied") return "unsatisfied";
  return O.isNone(required) || A.isReadonlyArrayEmpty(facts) || A.some(facts, (fact) => fact.outcome !== "verified")
    ? "unknown"
    : "verified";
};

/**
 * Observes a final PR on GitHub without writing receipt or manifest state.
 *
 * **Details**
 *
 * `readinessJob` explicitly permits recovery from the same run's retained status
 * snapshot and a successfully finalized monitor job. It never alters the
 * declared evidence reference or verdict bytes, and does not bypass hosted
 * merge-time checks. The snapshot's remote head, rather than the submission
 * head (a monitor may follow pushes), must match the accepted head.
 *
 * **Example** (Inspect the read-only adapter)
 *
 * ```ts
 * import { observeGoalCompletion } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(typeof observeGoalCompletion)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const observeGoalCompletion = Effect.fn("Goals.Completion.observe")(function* (
  root: string,
  slug: string,
  manifest: GoalManifest,
  final: GoalPullRequestRef,
  readinessJob: O.Option<string> = O.none()
) {
  const providedVerifier = yield* Effect.serviceOption(GoalCompletionVerifier);
  const resolve = O.getOrElse(
    O.map(providedVerifier, (verifier) => verifier.resolve),
    () => GoalCompletionVerifier.resolve
  );
  const digest = yield* goalCompletionDeclarationDigest(manifest);
  const verifiedAt = yield* DateTime.now;
  const initial = GoalCompletionObservation.make({
    repository: "unobserved",
    packet: slug,
    declarationDigest: digest,
    acceptedDeclarationDigest: O.none(),
    finalPullRequest: final.number,
    acceptedHead: O.none(),
    merged: O.none(),
    merge: O.none(),
    grandfathered: manifest.completionGate.grandfathered,
    evidence: [],
    nonRequiredReds: [],
    subClaims: [],
    verifiedAt,
  });
  if (initial.grandfathered) return yield* resolve(initial);
  const pullRead = yield* readGoalCompletion(root, (io, root) => io.pullRequest(root, final.number)).pipe(
    Effect.option
  );
  if (O.isNone(pullRead)) return yield* resolve(initial);
  const pull = pullRead.value;
  const head = pull.head.sha;
  const known = GoalCompletionObservation.make({
    ...initial,
    repository: pull.base.repo.full_name,
    acceptedHead: O.some(head),
    merged: O.some(pull.merged),
  });
  if (!pull.merged) {
    return yield* resolve(known);
  }
  const reads = yield* Effect.gen(function* () {
    const mergeSha = yield* Effect.fromOption(pull.merge_commit_sha).pipe(
      Effect.mapError(() => YeetCommandError.make({ message: "Merged PR has no merge result" }))
    );
    const mergedAt = yield* Effect.fromOption(pull.merged_at).pipe(
      Effect.mapError(() => YeetCommandError.make({ message: "Merged PR has no merge time" }))
    );
    // Project only the decoded fields: a large merge commit's file patches would
    // otherwise truncate the captured response and lose the merge facts.
    const mergeCommit = yield* readGoalCompletion(root, (io, root) => io.commit(root, mergeSha));
    // GitHub binds this merge result to this PR head for all three workflows. A single-parent
    // result cannot distinguish squash from rebase reliably; retain method=None rather than guess.
    const merge = GoalMergeResult.make({
      mergeCommit: mergeSha,
      tree: mergeCommit.commit.tree.sha,
      mergedAt,
      method: A.length(mergeCommit.parents) === 2 ? O.some("merge") : O.none(),
      baseRef: pull.base.ref,
    });
    const acceptedManifest = yield* readAcceptedManifest(root, head, slug);
    const acceptedDeclarationDigest = O.isSome(acceptedManifest)
      ? yield* Effect.asSome(goalCompletionDeclarationDigest(acceptedManifest.value))
      : O.none<string>();
    const pages = yield* readGoalCompletion(root, (io, root) => io.checkRuns(root, head));
    const checks = A.flatMap(pages, (page) => page.check_runs);
    const mergeTime = yield* readGoalMergeTimeEvidence(
      root,
      GoalMergeTimeEvidenceRequest.make({
        base: pull.base.ref,
        mergeCommit: mergeSha,
        mergedAt,
        acceptedHead: head,
        checkRuns: checks,
      })
    );
    const requiredChecks = mergeTime.requiredChecks;
    const required = O.map(requiredChecks, (snapshot) => snapshot.contexts);
    const verdict = goalCompletionVerdict({
      merge: O.some(merge),
      acceptedHead: O.some(head),
      requiredChecks,
      requiredCheckFacts: mergeTime.facts,
    });
    const gatingOutcome = hostedRequiredOutcome(verdict, required, mergeTime.facts);
    const hostedEvidence = A.of(
      evidenceCheck(
        hostedRef,
        gatingOutcome,
        O.some(head),
        `Required contexts observed at accepted head before merge; ${O.getOrElse(O.map(required, A.length), () => 0)} contexts. ${describeGoalCompletionEvidence(verdict)} The merge-push rule suite supplies the merge-time ruleset inventory, including rulesets deleted since then; GitHub lists rule suites for one month.`
      )
    );
    const recovery = yield* O.match(readinessJob, {
      onNone: () => Effect.succeedNone,
      onSome: (jobId) =>
        decodeRecoveryJobId(jobId).pipe(
          Effect.map((jobId) => Recovery.make({ jobId, prNumber: final.number, mergedAt })),
          Effect.option
        ),
    });
    const evidence = yield* readDeclaredEvidence(root, manifest, head, gatingOutcome, hostedEvidence, recovery);
    const conclusion = (check: GoalObservedCheckRun, atMerge: boolean): GoalCheckConclusion =>
      atMerge &&
      !O.exists(check.completed_at, (time) => DateTime.toEpochMillis(time) <= DateTime.toEpochMillis(mergedAt))
        ? "pending"
        : S.is(GoalCheckConclusion)(check.conclusion)
          ? check.conclusion
          : check.status === "completed"
            ? "unknown"
            : "pending";
    const nonRequiredReds = O.match(required, {
      onNone: A.empty<GoalNonRequiredRed>,
      onSome: (contexts) =>
        A.getSomes(
          A.map(A.dedupe(A.map(checks, (check) => check.name)), (name) => {
            if (A.contains(contexts, name)) return O.none<GoalNonRequiredRed>();
            const matching = A.filter(checks, (check) => check.name === name && check.head_sha === head);
            const final = A.reduce(matching, O.none<GoalObservedCheckRun>(), (found, check) =>
              O.isNone(found) || check.id > found.value.id ? O.some(check) : found
            );
            const beforeMerge = A.filter(matching, (check) =>
              O.exists(check.started_at, (time) => DateTime.toEpochMillis(time) <= DateTime.toEpochMillis(mergedAt))
            );
            const atMerge = A.reduce(beforeMerge, O.none<GoalObservedCheckRun>(), (found, check) =>
              O.isNone(found) || check.id > found.value.id ? O.some(check) : found
            );
            if (O.isNone(final)) return O.none<GoalNonRequiredRed>();
            const conclusionFinal = conclusion(final.value, false);
            if (conclusionFinal === "success" || conclusionFinal === "neutral" || conclusionFinal === "skipped")
              return O.none<GoalNonRequiredRed>();
            return O.some(
              GoalNonRequiredRed.make({
                lane: name,
                conclusionAtMerge: O.isSome(atMerge) ? conclusion(atMerge.value, true) : "unknown",
                conclusionFinal,
                attribution: "unknown",
              })
            );
          })
        ),
    });
    const timeline = yield* readGoalCompletion(root, (io, root) => io.timeline(root, final.number)).pipe(Effect.option);
    const events = O.getOrElse(O.map(timeline, A.flatten), A.empty);
    const readyTimes = A.getSomes(
      A.map(
        A.filter(events, (event) => event.event === "ready_for_review"),
        (event) => O.fromUndefinedOr(event.created_at)
      )
    );
    const lastReady = A.reduce(readyTimes, O.none<DateTime.Utc>(), (found, time) =>
      O.isNone(found) || DateTime.toEpochMillis(time) > DateTime.toEpochMillis(found.value) ? O.some(time) : found
    );
    const suites = yield* readGoalCompletion(root, (io, root) => io.checkSuites(root, head)).pipe(Effect.option);
    const received = O.flatMap(suites, (pages) =>
      A.reduce(
        A.flatMap(pages, (page) => page.check_suites),
        O.none<DateTime.Utc>(),
        (found, suite) =>
          O.isNone(found) ? O.some(suite.created_at) : O.some(DateTime.min(found.value, suite.created_at))
      )
    );
    const forced = A.getSomes(
      A.map(
        A.filter(events, (event) => event.event === "head_ref_force_pushed"),
        (event) => O.fromUndefinedOr(event.created_at)
      )
    );
    const pushedAt = O.map(received, (first) =>
      A.reduce(forced, first, (left, right) => DateTime.toUtc(DateTime.max(left, right)))
    );
    const readyAt = O.orElse(lastReady, () => (O.isSome(timeline) ? O.some(pull.created_at) : O.none()));
    const window = O.map(O.all({ pushedAt, readyAt }), (instants) =>
      decideYeetReviewWindow({
        ...instants,
        now: mergedAt,
        readyAnchor: O.isSome(lastReady) ? "ready-for-review" : "pr-opened",
        window: YEET_REVIEW_WINDOW_DEFAULT,
      })
    );
    const acceptedDeclaration = O.map(acceptedManifest, (value) => ({
      id: value.initiative.id,
      packetId: value.initiative.packetId,
      operator: value.completionGate.operator,
      requiresPullRequest: value.completionGate.requiresPullRequest,
      requiresMergeable: value.completionGate.requiresMergeable,
      grandfathered: value.completionGate.grandfathered,
      statement: value.completionGate.statement,
    }));
    const currentDeclaration = {
      id: manifest.initiative.id,
      packetId: manifest.initiative.packetId,
      operator: manifest.completionGate.operator,
      requiresPullRequest: manifest.completionGate.requiresPullRequest,
      requiresMergeable: manifest.completionGate.requiresMergeable,
      grandfathered: manifest.completionGate.grandfathered,
      statement: manifest.completionGate.statement,
    };
    const declarationOutcome = O.match(acceptedDeclaration, {
      onNone: (): GoalCompletionOutcome => "unknown",
      onSome: (value): GoalCompletionOutcome =>
        canonicalJsonText(value) === canonicalJsonText(currentDeclaration) ? "verified" : "unsatisfied",
    });
    const subClaims = [
      evidenceCheck(
        GoalAcceptanceEvidenceRef.make({ kind: "packet-history", ref: "accepted-declaration", gating: false }),
        declarationOutcome,
        O.some(head),
        "Accepted-head declaration compared with current identity and gate, excluding retrospective PR/evidence references. Changes are historical sub-claims and never reset lifecycle."
      ),
      evidenceCheck(
        GoalAcceptanceEvidenceRef.make({ kind: "packet-history", ref: "draft-to-ready", gating: false }),
        O.isNone(timeline) ? "unknown" : O.isSome(lastReady) ? "verified" : "unsatisfied",
        O.some(head),
        "ready_for_review event proves transition from draft; caller identity does not prove yeet invocation."
      ),
      evidenceCheck(
        GoalAcceptanceEvidenceRef.make({ kind: "packet-history", ref: "review-window", gating: false }),
        O.match(window, {
          onNone: (): GoalCompletionOutcome => "unknown",
          onSome: (value): GoalCompletionOutcome => (value._tag === "elapsed" ? "verified" : "unsatisfied"),
        }),
        O.some(head),
        O.match(window, {
          onNone: () => "Timeline or GitHub head receipt time unavailable.",
          onSome: (value) =>
            `Review window at merge: ${value._tag}; anchor ${value.anchoredAt}. Check-suite first receipt plus force-push events use Yeet semantics.`,
        })
      ),
      evidenceCheck(
        GoalAcceptanceEvidenceRef.make({ kind: "yeet-verdict", ref: "merge-ready", gating: false }),
        "unknown",
        O.none(),
        "No head-bound Yeet verdict inferred from timeline or successful checks."
      ),
    ];
    return GoalCompletionObservation.make({
      ...known,
      merge: O.some(merge),
      acceptedDeclarationDigest,
      requiredChecks,
      evidence,
      requiredCheckFacts: mergeTime.facts,
      nonRequiredReds,
      subClaims,
    });
  }).pipe(Effect.option);
  return yield* resolve(O.getOrElse(reads, () => known));
});

const receiptLocation = Effect.fn("Goals.Completion.receiptLocation")(function* (root: string) {
  const path = yield* Path.Path;
  const { ledgerRoot } = yield* resolveProofLedgerLocation(root);
  return { ledgerRoot, file: path.join(ledgerRoot, ".beep", "goals", "completion-receipts.ndjson") };
});

const readReceiptRepository = Effect.fn("Goals.Completion.receiptRepository")(function* (root: string) {
  const remote = yield* Effect.flatMap(goalCompletionIo(), (io) => io.originUrl(root)).pipe(
    Effect.orElseSucceed(O.none<string>)
  );
  return O.flatMap(remote, (text) =>
    O.flatMap(Str.match(/github\.com[:/]([^/\s]+\/[^/\s]+?)(?:\.git)?\s*$/u)(text), (match) => A.get(match, 1))
  );
});

const readLegacyReceipts = Effect.fn("Goals.Completion.legacyReceipts")(function* (root: string) {
  const location = yield* receiptLocation(root);
  const read = yield* readContainedFileStringNoFollow(location.ledgerRoot, location.file);
  const text = O.getOrElse(read.contents, () => "");
  const lines = Str.split(text, "\n");
  const complete = Str.endsWith("\n")(text) ? lines : A.dropRight(lines, 1);
  return A.getSomes(A.map(complete, ReceiptJson.decodeOption));
});

const readSharedReceipts = Effect.fn("Goals.Completion.sharedReceipts")(
  function* (repository: O.Option<string>) {
    if (O.isNone(repository)) return A.empty<GoalCompletionReceipt>();
    const store = yield* goalCompletionReceiptStore();
    return yield* store.list(repository.value);
  },
  Effect.catchTag("YeetCommandError", (error) =>
    Effect.logWarning(`[goals:completion] shared receipt store unreadable: ${error.message}`).pipe(
      Effect.as(A.empty<GoalCompletionReceipt>())
    )
  )
);

const newestReceipt = (receipts: ReadonlyArray<GoalCompletionReceipt>): O.Option<GoalCompletionReceipt> =>
  A.reduce(receipts, O.none<GoalCompletionReceipt>(), (found, receipt) =>
    O.isNone(found) || DateTime.isGreaterThan(receipt.verifiedAt, found.value.verifiedAt) ? O.some(receipt) : found
  );

/**
 * Reads the latest matching receipt; changed declarations cannot reuse an older verdict.
 *
 * **Details**
 *
 * Reads the union of the workstation store shared by every clone of the
 * repository and the owning clone's legacy
 * `.beep/goals/completion-receipts.ndjson`, dropping identical rows. Only
 * rows for this packet, declaration digest, final PR and `origin` repository
 * match. The newest definite match wins, else the newest match, except that
 * a verified receipt is sticky: when that pick is `unknown` and a matching
 * `verified` receipt exists, the newest `verified` one is selected instead,
 * so a degraded refresh can never regress a goal another clone verified.
 * A newer definite `unknown` still replaces an older `unsatisfied` receipt.
 * An unreadable shared store degrades to the legacy rows with a warning.
 *
 * **Example** (Inspect the receipt reader)
 *
 * ```ts
 * import { storedGoalCompletion } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(typeof storedGoalCompletion)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const storedGoalCompletion = Effect.fn("Goals.Completion.stored")(function* (
  root: string,
  slug: string,
  manifest: GoalManifest,
  final: GoalPullRequestRef
) {
  const digest = yield* goalCompletionDeclarationDigest(manifest);
  const legacy = yield* readLegacyReceipts(root);
  const repository = yield* readReceiptRepository(root);
  const shared = yield* readSharedReceipts(repository);
  const receipts = A.dedupeWith(A.appendAll(shared, legacy), equivalentReceipt);
  const matching = A.filter(
    receipts,
    (receipt) =>
      receipt.packet === slug &&
      receipt.declarationDigest === digest &&
      receipt.finalPullRequest === final.number &&
      O.contains(receipt.repository)(repository)
  );
  const definite = A.filter(
    matching,
    (receipt) =>
      receipt.outcome !== "unknown" ||
      (O.isSome(receipt.merge) &&
        O.exists(receipt.requiredChecks, (snapshot) => snapshot.rulesetReadsComplete) &&
        A.some(
          receipt.evidence,
          (check) => check.ref.kind === "hosted-required-checks" && check.ref.gating && check.outcome !== "unknown"
        ))
  );
  const candidates = A.isReadonlyArrayNonEmpty(definite) ? definite : matching;
  const verified = A.filter(candidates, (receipt) => receipt.outcome === "verified");
  const picked = newestReceipt(candidates);
  const newest =
    O.exists(picked, (receipt) => receipt.outcome === "unknown") && A.isReadonlyArrayNonEmpty(verified)
      ? newestReceipt(verified)
      : picked;
  if (O.isNone(newest)) return newest;
  const receipt = newest.value;
  const resolved3 = yield* GoalCompletionVerifier.resolve(
    GoalCompletionObservation.make({
      ...receipt,
      merged: O.isSome(receipt.merge) ? O.some(true) : O.none(),
      grandfathered: manifest.completionGate.grandfathered,
    })
  );
  return O.some(resolved3);
});

/**
 * Projects operative lifecycle from a proposal and a matching, revalidated receipt.
 *
 * **Details**
 *
 * Never trusts the receipt outcome flag alone. Packet, final PR and current
 * declaration must match; merge facts, exact-head hosted evidence and the
 * merge-time required-check inventory must independently verify.
 *
 * **Example** (Build an offline lifecycle projection)
 *
 * ```ts
 * import { projectGoalLifecycle } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(typeof projectGoalLifecycle)
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const projectGoalLifecycle = Effect.fn("Goals.Completion.projectLifecycle")(function* (
  manifest: GoalManifest,
  receipt: O.Option<GoalCompletionReceipt>
) {
  const proposal = manifest.proposedCloseout;
  if (proposal === undefined || O.isNone(receipt)) return manifest.initiative.status;
  const row = receipt.value;
  const digest = yield* goalCompletionDeclarationDigest(manifest);
  if (
    A.some(
      [
        row.packet !== manifest.initiative.id,
        row.finalPullRequest !== proposal.finalPullRequest,
        row.declarationDigest !== digest,
        !O.contains(digest)(row.acceptedDeclarationDigest),
      ],
      identity
    )
  )
    return manifest.initiative.status;
  const verified = yield* GoalCompletionVerifier.resolve(
    GoalCompletionObservation.make({
      ...row,
      merged: O.isSome(row.merge) ? O.some(true) : O.none(),
      grandfathered: false,
    })
  );
  const hosted = A.some(row.evidence, (check) =>
    A.every(
      [
        check.ref.kind === "hosted-required-checks",
        check.ref.gating,
        check.outcome === "verified",
        O.exists(check.observedHead, (head) => O.contains(head)(row.acceptedHead)),
      ],
      identity
    )
  );
  const declared = manifest.completionGate.acceptanceEvidence ?? [];
  const readiness =
    A.some(declared, (ref) => ref.kind === "yeet-verdict" && ref.gating) &&
    A.every(
      A.filter(declared, (ref) => ref.gating),
      (ref) =>
        A.some(
          row.evidence,
          (check) =>
            check.ref.kind === ref.kind &&
            check.ref.ref === ref.ref &&
            check.ref.gating &&
            check.outcome === "verified" &&
            O.isSome(row.acceptedHead) &&
            O.exists(check.observedHead, (head) => O.contains(head)(row.acceptedHead))
        )
    );
  return verified.outcome === "verified" && hosted && readiness ? proposal.status : manifest.initiative.status;
});

/**
 * Reads stored completion facts for lifecycle views without network writes.
 *
 * **Example** (Inspect the lifecycle reader)
 *
 * ```ts
 * import { readGoalLifecycle } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(typeof readGoalLifecycle)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const readGoalLifecycle = Effect.fn("Goals.Completion.readLifecycle")(function* (
  root: string,
  slug: string,
  manifest: GoalManifest
) {
  const proposal = manifest.proposedCloseout;
  if (proposal === undefined) return manifest.initiative.status;
  const final = A.findFirst(goalPullRequestRefs(manifest), (ref) => ref.role === "final");
  if (O.isNone(final)) return manifest.initiative.status;
  const receipt = yield* storedGoalCompletion(root, slug, manifest, final.value).pipe(Effect.orElseSucceed(O.none));
  return yield* projectGoalLifecycle(manifest, receipt).pipe(Effect.orElseSucceed(() => manifest.initiative.status));
});

/**
 * Builds the operator-facing closeout view of one packet from a manifest and an optional receipt.
 *
 * **Details**
 *
 * Pure over its inputs: the lifecycle comes from {@link projectGoalLifecycle},
 * and `verification` records whether that projection adopted the proposal. A
 * manifest without a `proposedCloseout` has no view. Readers that hold the
 * clone-scoped receipt ({@link readGoalCloseoutView}) feed it here; tests feed
 * fixtures directly.
 *
 * **Example** (Inspect the view builder)
 *
 * ```ts
 * import { goalCloseoutView } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(typeof goalCloseoutView)
 * ```
 *
 * @param slug - The packet directory name.
 * @param manifest - The decoded manifest.
 * @param receipt - The newest matching clone receipt, when one exists.
 * @returns The view, or none when the manifest proposes no closeout.
 * @category projections
 * @since 0.0.0
 */
export const goalCloseoutView = Effect.fn("Goals.Completion.closeoutView")(function* (
  slug: string,
  manifest: GoalManifest,
  receipt: O.Option<GoalCompletionReceipt>
) {
  const proposal = manifest.proposedCloseout;
  if (proposal === undefined) return O.none<GoalCloseoutView>();
  const operativeStatus = yield* projectGoalLifecycle(manifest, receipt).pipe(
    Effect.orElseSucceed(() => manifest.initiative.status)
  );
  return O.some(
    GoalCloseoutView.make({
      packet: slug,
      proposedCloseout: proposal,
      operativeStatus,
      verification: goalCloseoutVerification(proposal, operativeStatus),
    })
  );
});

/**
 * Reads one packet's closeout view against this clone's completion receipts.
 *
 * **Example** (Inspect the single-packet reader)
 *
 * ```ts
 * import { readGoalCloseoutView } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(typeof readGoalCloseoutView)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const readGoalCloseoutView = Effect.fn("Goals.Completion.readCloseoutView")(function* (
  root: string,
  slug: string,
  manifest: GoalManifest
) {
  if (manifest.proposedCloseout === undefined) return O.none<GoalCloseoutView>();
  const final = A.findFirst(goalPullRequestRefs(manifest), (ref) => ref.role === "final");
  const receipt = O.isNone(final)
    ? O.none<GoalCompletionReceipt>()
    : yield* storedGoalCompletion(root, slug, manifest, final.value).pipe(Effect.orElseSucceed(O.none));
  return yield* goalCloseoutView(slug, manifest, receipt);
});

/**
 * Collects this checkout's prospective closeouts for session resume views.
 *
 * **Example** (Inspect the read-only session query)
 *
 * ```ts
 * import { readGoalCloseoutViews } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(typeof readGoalCloseoutViews)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const readGoalCloseoutViews = Effect.fn("Goals.Completion.closeoutViews")(function* (root: string) {
  const records = yield* listGoalPackets(root);
  const views = yield* Effect.forEach(
    records,
    Effect.fnUntraced(function* (record) {
      const parsed = O.flatMap(O.fromUndefinedOr(record.manifestText), parseGoalManifestText);
      if (O.isNone(parsed)) return O.none<GoalCloseoutView>();
      const manifest = yield* S.decodeUnknownEffect(GoalManifest)(parsed.value).pipe(Effect.option);
      if (O.isNone(manifest)) return O.none<GoalCloseoutView>();
      return yield* readGoalCloseoutView(root, record.slug, manifest.value);
    }),
    { concurrency: 1 }
  );
  return A.getSomes(views);
});

const readRefreshManifest = Effect.fn("Goals.Completion.refreshManifest")(function* (record: GoalPacketRecord) {
  const parsed = yield* Effect.fromOption(
    O.flatMap(O.fromUndefinedOr(record.manifestText), parseGoalManifestText)
  ).pipe(Effect.mapError(() => YeetCommandError.make({ message: "Requested goal manifest is missing or invalid" })));
  return yield* S.decodeUnknownEffect(GoalManifest)(parsed).pipe(
    Effect.mapError(() => YeetCommandError.make({ message: "Requested goal manifest cannot decode" }))
  );
});
// Verification is proof, not closeout: the packet finishes only when its
// committed closeout record merges, so name that step at the moment it opens.
const adoptionHint = (slug: string, manifest: GoalManifest, receipt: GoalCompletionReceipt) =>
  receipt.outcome === "verified" && manifest.proposedCloseout !== undefined
    ? Console.log(
        `[goals:completion] next: bun run beep goals set-status ${slug} ${manifest.proposedCloseout.status}, then merge that packet-state PR`
      )
    : Effect.void;
const refreshRecord = Effect.fn("Goals.Completion.refreshRecord")(function* (
  root: string,
  record: GoalPacketRecord,
  explicit: boolean,
  write: (
    receipt: GoalCompletionReceipt
  ) => Effect.Effect<void, YeetCommandError | FsGuardError | S.SchemaError, FileSystem.FileSystem | Path.Path>,
  readinessJob: O.Option<string>
) {
  const decoded = readRefreshManifest(record);
  const manifest = yield* explicit ? decoded.pipe(Effect.asSome) : decoded.pipe(Effect.option);
  if (O.isNone(manifest)) return;
  if (manifest.value.completionGate.grandfathered) {
    if (explicit) {
      yield* Console.log(`[goals:completion] ${record.slug}: grandfathered (no receipt needed)`);
    }
    return;
  }
  const finalRead = Effect.fromOption(
    A.findFirst(goalPullRequestRefs(manifest.value), (ref) => ref.role === "final")
  ).pipe(Effect.mapError(() => YeetCommandError.make({ message: "Requested goal has no final pull request" })));
  const final = yield* explicit ? finalRead.pipe(Effect.asSome) : finalRead.pipe(Effect.option);
  if (O.isNone(final)) return;
  const receipt = yield* observeGoalCompletion(root, record.slug, manifest.value, final.value, readinessJob);
  if (O.isNone(receipt.merge)) {
    yield* Console.log(
      `[goals:completion] ${record.slug} #${final.value.number}: ${receipt.outcome} (no post-merge receipt written)`
    );
    return;
  }
  yield* write(receipt);
  yield* Console.log(`[goals:completion] ${record.slug} #${final.value.number}: ${receipt.outcome}`);
  yield* adoptionHint(record.slug, manifest.value, receipt);
});
const refresh = Effect.fn("Goals.Completion.refresh")(function* (
  slug: O.Option<string>,
  readinessJob: O.Option<string>
) {
  if (O.isSome(readinessJob) && O.isNone(slug)) {
    return yield* YeetCommandError.make({ message: "--readiness-job requires --slug" });
  }
  if (O.isSome(readinessJob)) {
    yield* decodeRecoveryJobId(readinessJob.value).pipe(
      Effect.mapError(() => YeetCommandError.make({ message: "--readiness-job must be a job UUID" }))
    );
  }
  const root = yield* findRepoRoot();
  const records = yield* listGoalPackets(root);
  const location = yield* receiptLocation(root);
  const repository = yield* readReceiptRepository(root);
  // The workstation store is shared by every clone of the repository; without
  // a resolvable github.com origin the owning clone's legacy file still records it.
  const store = O.isSome(repository) ? yield* Effect.asSome(goalCompletionReceiptStore()) : O.none();
  const write = (receipt: GoalCompletionReceipt) =>
    O.match(store, {
      onSome: (shared) => shared.append(receipt),
      onNone: () =>
        ReceiptJson.encode(receipt).pipe(
          Effect.flatMap((text) => appendContainedFileString(location.ledgerRoot, location.file, `${text}\n`)),
          Effect.asVoid
        ),
    });
  if (O.exists(slug, (value) => !A.some(records, (record) => record.slug === value))) {
    return yield* YeetCommandError.make({ message: "Requested goal packet does not exist" });
  }
  const selected = O.match(slug, {
    onNone: () => records,
    onSome: (value) => A.filter(records, (record) => record.slug === value),
  });
  yield* Effect.forEach(selected, (record) => refreshRecord(root, record, O.isSome(slug), write, readinessJob));
});
/**
 * Explicit sole writer for derived completion receipts; doctor never calls this command.
 *
 * **Example** (Inspect the completion command)
 *
 * ```ts
 * import { goalsCompletionCommand } from "@beep/repo-cli/commands/Goals/Completion"
 * console.log(goalsCompletionCommand.name)
 * ```
 *
 * @category commands
 * @since 0.0.0
 */
export const goalsCompletionCommand = Command.make("completion").pipe(
  Command.withSubcommands([
    Command.make(
      "refresh",
      {
        slug: Flag.String("slug").pipe(Flag.optional),
        readinessJob: Flag.String("readiness-job").pipe(
          Flag.withDescription(
            "Recover pre-merge readiness from a retained successful --until-ready job and canonical status snapshot; requires --slug"
          ),
          Flag.optional
        ),
      },
      ({ slug, readinessJob }) => refresh(slug, readinessJob)
    ).pipe(Command.withDescription("Explicitly observe GitHub and append workstation-scoped goal completion receipts")),
  ])
);
