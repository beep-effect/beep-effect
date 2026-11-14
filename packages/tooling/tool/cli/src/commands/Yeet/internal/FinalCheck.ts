/**
 * `yeet final-check`: replay, scoped to the diff, every hosted gate that the
 * push-first cheap tier skips, before a lane may call its pull request final.
 *
 * **Details**
 *
 * Push-first publish proves only the cheap tier locally and leaves the rest to
 * hosted CI. On 2026-10-23/24 that let lanes call PRs final that then redded
 * `main` on gates only hosted CI ran: a GritQL law (#2187), a deprecated
 * TypeScript API (#2189), root docs oxlint (#2186), schema-first and the
 * schema catalog (#2207), Fallow health (#2215), a dropped `Crypto`
 * requirement (#2208), Effect diagnostics (#2197, #2221), and a test rewritten
 * to match broken output (#2215). Each gate below replays the hosted body
 * through the same command hosted CI runs (`beep ci lane <id>` via
 * {@link ciLaneDispatchStep}, the single argv source `beep ci local` shares),
 * narrowed to the merge base with Turbo's `--affected`, or a repo-wide sweep
 * where that sweep is cheap (root docs oxlint ~10 s, deprecated APIs ~1 min).
 * Steps run one at a time and every lane body carries its own Turbo
 * concurrency cap (2-4), so the whole run fits a 4-core worker.
 *
 * A full run writes the head-pinned receipt `.beep/yeet/final-check/<head>.json`.
 * `yeet ready` refuses to flip a draft whose head has no complete passing
 * receipt. A gate that cannot run locally is skipped only with a recorded
 * reason (`--skip <gate>=<reason>`), which the receipt and the flip both show.
 * A `--gates` subset run never writes the head receipt: each writes its own
 * file under `.beep/yeet/final-check/subsets/<head>/`, so it neither replaces
 * a complete receipt on the head nor an earlier subset run's receipt.
 *
 * Every run on a clean tree is also journaled as one attempt in the branch's
 * Yeet attempt journal (`.beep/yeet/runs/<runId>/attempts.ndjson`, mode
 * `final-check`), with the receipt it wrote. The head receipt is overwritten
 * by each full run on that head; the journal keeps every run for economics.
 * `yeet ready` reads only the head receipt.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { Git } from "@beep/git/Git";
import { GitCommand } from "@beep/git/GitCommand";
import { QualityTaskStep, runToExit } from "@beep/repo-cli-kit/process/index";
import { findRepoRoot } from "@beep/repo-utils";
import * as O from "@beep/utils/Option";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Console from "effect/Console";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { constant, dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  COMPUTE_PROFILE_WORKER_SKIP_REASON,
  gateRouteFor,
  workerForcedRefusal,
} from "../../../internal/repo-run/GateRoute.schemas.ts";
import { processStartIdentityForPid } from "../../../internal/repo-run/ProcessIdentity.ts";
import { AdmissionRoute } from "../../../internal/repo-run/QualityScheduler.schemas.ts";
import { QualityScheduler } from "../../../internal/repo-run/QualityScheduler.service.ts";
import { repoRunArtifactId } from "../../../internal/repo-run/RepoRunArtifacts.ts";
import { CiLocalStepPlan, ciLaneDispatchStep } from "../../Ci/CiLane.ts";
import { ChangeAtomKind, RouteSentinel } from "../../Ci/Route.schemas.ts";
import { ChangeClassifier, ClassifyInput } from "../../Ci/Route.service.ts";
import { ChangeClassifierLive } from "../../Ci/RouteClassify.ts";
import { routeFootprintCanonicalJson, routeLaneDecision } from "../../Ci/RouteFootprints.ts";
import { sha256Hex } from "../../Goals/PacketCore/PacketDigest.ts";
import { isEffectVitestScopePath } from "../../Lint/Lint.schemas.ts";
import { CoverageSelectedScope } from "../../Quality/internal/CoverageScope.ts";
import {
  hasReusableLaneProof,
  persistLaneProofs,
  prepareLaneProofSession,
} from "../../Quality/internal/LaneProofReuse.ts";
import { resolveLintPolicyScope } from "../../Quality/internal/LintPolicyScope.ts";
import { GithubCheckLaneSpec } from "../../Quality/Quality.schemas.ts";
import { readLintPolicySweeps, resolveAffectedCoverageScope } from "../../Quality/Tasks.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import {
  appendYeetAttemptJournalEventForCheckout,
  generateYeetAttemptId,
  YeetAttemptFinished,
  YeetAttemptStarted,
  YeetAttemptTerminated,
} from "./AttemptJournal.ts";
import { readYeetComputeProfile } from "./ComputeProfileRead.ts";
import { collectExpectationRewrites, verifyExpectationRewrites } from "./ExpectationRewrite.ts";
import {
  FINAL_CHECK_GATE_SET_DIGEST,
  FINAL_CHECK_RECEIPT_VERSION,
  FinalCheckGate,
  FinalCheckPlannedStep,
  FinalCheckReceipt,
  FinalCheckRoute,
  FinalCheckRouteGate,
  FinalCheckSkip,
  FinalCheckStepResult,
} from "./FinalCheck.schemas.ts";
import {
  changedYeetPaths,
  currentYeetBranch,
  resolveYeetMergeBase,
  resolveYeetRev,
  YeetChangedPathsQuery,
  yeetGitKitError,
} from "./GitExec.ts";
import {
  appendYeetInboxRowOnce,
  YeetLocalShardFailedRow,
  YeetLocalShardFailureCapsule,
  yeetLocalShardFailedRowId,
} from "./Inbox.ts";
import { YeetFailureKind, YeetVerdict, YeetVerdictLane } from "./Verdict.ts";
import type * as Digest from "effect/crypto/Digest";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { ComputeProfile } from "../../../internal/repo-run/ComputeProfile.schemas.ts";
import type { AdmissionRouteOutcome } from "../../../internal/repo-run/QualityScheduler.schemas.ts";
import type { CiLaneId } from "../../Ci/CiLane.ts";
import type { ChangeAtom } from "../../Ci/Route.schemas.ts";
import type { CoverageAffectedScope } from "../../Quality/internal/CoverageScope.ts";
import type { LaneProofSession } from "../../Quality/internal/LaneProofReuse.ts";
import type { LintPolicySweeps } from "../../Quality/Quality.schemas.ts";
import type { ExpectationRewriteVerdict, YeetFinalCheckOptions } from "./FinalCheck.schemas.ts";

/**
 * The command a lane runs to produce a final-check receipt.
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_FINAL_CHECK_COMMAND = "bun run beep yeet final-check";

/**
 * The `mode` a `yeet final-check` run records on its attempt-journal rows and
 * verdict, beside the Yeet run modes (`verify`, `publish`, ...).
 *
 * **Example** (Recognise a final-check attempt)
 *
 * ```ts
 * import { FINAL_CHECK_ATTEMPT_MODE } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(FINAL_CHECK_ATTEMPT_MODE) // "final-check"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FINAL_CHECK_ATTEMPT_MODE = "final-check";

/**
 * The reason a `--resume` step records when it reused a completed proof
 * instead of running; its journal lane reads `reused`.
 *
 * **Example** (Read the reuse reason)
 *
 * ```ts
 * import { FINAL_CHECK_REUSED_STEP_REASON } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(FINAL_CHECK_REUSED_STEP_REASON.startsWith("reused")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FINAL_CHECK_REUSED_STEP_REASON =
  "reused completed step with matching source, head, base, command and environment";

const gateSetDiff = (recorded: string): string => {
  const before = Str.split(",")(recorded);
  const added = A.filter(FinalCheckGate.literals, (gate) => !A.contains(before, gate));
  const removed = A.filter(before, (gate) => !A.contains(FinalCheckGate.literals, gate));
  return A.join(
    [
      ...(A.isReadonlyArrayNonEmpty(added) ? [`added ${A.join(added, ", ")}`] : []),
      ...(A.isReadonlyArrayNonEmpty(removed) ? [`removed ${A.join(removed, ", ")}`] : []),
    ],
    "; "
  );
};

/**
 * Refuse a receipt written under another schema version or gate set.
 *
 * **Details**
 *
 * Every path that admits a flip on a receipt, the head's own or one carried
 * from an ancestor or across an unchanged rewrite, runs this first through
 * {@link finalCheckRefusal}. A `yeet-final-check/v1` receipt predates the
 * gate-set digest; a v2 receipt whose digest differs was written before the
 * gate set grew or shrank.
 *
 * **Example** (Accept a receipt under the current gate set)
 *
 * ```ts
 * import { FINAL_CHECK_GATE_SET_DIGEST, finalCheckGateSetRefusal } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const current = { schemaVersion: "yeet-final-check/v2", gateSetDigest: FINAL_CHECK_GATE_SET_DIGEST } as const
 * console.log(O.isNone(finalCheckGateSetRefusal(current))) // true
 * ```
 *
 * @param receipt - The receipt's version and recorded gate-set digest.
 * @returns The refusal detail when the receipt was written under another gate set.
 * @category policies
 * @since 0.0.0
 */
export const finalCheckGateSetRefusal = (
  receipt: Pick<FinalCheckReceipt, "schemaVersion" | "gateSetDigest">
): O.Option<string> => {
  if (receipt.schemaVersion !== FINAL_CHECK_RECEIPT_VERSION) {
    return O.some(
      `the final-check receipt is ${receipt.schemaVersion}, written before receipts recorded their gate set; re-run \`${YEET_FINAL_CHECK_COMMAND}\` on the committed head`
    );
  }
  if (receipt.gateSetDigest === undefined) {
    return O.some(
      `the final-check receipt records no gate set; re-run \`${YEET_FINAL_CHECK_COMMAND}\` on the committed head`
    );
  }
  if (receipt.gateSetDigest !== FINAL_CHECK_GATE_SET_DIGEST) {
    return O.some(
      `the final-check receipt was written under another gate set (${gateSetDiff(receipt.gateSetDigest)}); re-run \`${YEET_FINAL_CHECK_COMMAND}\` on the committed head`
    );
  }
  return O.none();
};

/**
 * Repo-relative directory holding head-pinned final-check receipts.
 *
 * @category constants
 * @since 0.0.0
 */
export const FINAL_CHECK_RECEIPT_DIR = ".beep/yeet/final-check";

/**
 * Repo-relative directory holding the receipts of `--gates` subset runs: one
 * directory per head, one file per run.
 *
 * **Details**
 *
 * A subset run writes `subsets/<head>/<ulid>.json`, a {@link FinalCheckReceipt}
 * marked incomplete, and never the head receipt `<head>.json`. A complete
 * receipt already on the head therefore keeps admitting `yeet ready`, and a
 * later subset run on the same head adds a file that sorts after the earlier
 * one instead of replacing it. `yeet ready`, `yeet open` and the refresh rule
 * read only `<head>.json` entries of {@link FINAL_CHECK_RECEIPT_DIR}; this
 * directory is not one, so a subset receipt never admits a flip.
 *
 * **Example** (Locate a head's subset receipts)
 *
 * ```ts
 * import { FINAL_CHECK_SUBSET_RECEIPT_DIR } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(`${FINAL_CHECK_SUBSET_RECEIPT_DIR}/${"a".repeat(40)}`.startsWith(".beep/yeet/final-check/subsets/")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FINAL_CHECK_SUBSET_RECEIPT_DIR = `${FINAL_CHECK_RECEIPT_DIR}/subsets`;

const decodeRouteSentinelText = S.decodeUnknownEffect(S.fromJsonString(RouteSentinel));

const gateLane = {
  "expectation-rewrite": "none",
  "cheap-gates": "none",
  "lint-policy": "lint-policy",
  lint: "lint",
  "repo-sanity": "repo-sanity",
  check: "check",
  docgen: "docgen",
  fallow: "fallow",
  coverage: "coverage",
} as const satisfies Record<FinalCheckGate, CiLaneId | "none">;

const selectedRouteGate = (gate: FinalCheckGate, reason: string) =>
  FinalCheckRouteGate.make({ gate, lane: gateLane[gate], decision: "selected", refinements: [], reason });

const atomCounts = (atoms: ReadonlyArray<ChangeAtom>) =>
  R.map(ChangeAtomKind.Enum, (_value, kind) => A.length(A.filter(atoms, (atom) => atom.kind === kind)));

/**
 * Build final-check gate evidence from the shared refinement registry.
 *
 * **Example** (Always select the cheap guard)
 * ```ts
 * import { planFinalCheckRoute } from "@beep/repo-cli/test/Yeet"
 * planFinalCheckRoute([], "digest", []).gates[1]?.decision // => "selected"
 * ```
 * @category planning
 * @since 0.0.0
 */
export const planFinalCheckRoute: {
  (atoms: ReadonlyArray<ChangeAtom>, footprintDigest: string, revoked: ReadonlyArray<string>): FinalCheckRoute;
  (footprintDigest: string, revoked: ReadonlyArray<string>): (atoms: ReadonlyArray<ChangeAtom>) => FinalCheckRoute;
} = dual(
  3,
  (atoms: ReadonlyArray<ChangeAtom>, footprintDigest: string, revoked: ReadonlyArray<string>): FinalCheckRoute =>
    FinalCheckRoute.make({
      footprintDigest,
      atomsByKind: atomCounts(atoms),
      reason: "classified",
      shadowMisses: [],
      gates: A.map(FinalCheckGate.literals, (gate) => {
        const lane = gateLane[gate];
        if (lane === "none") return selectedRouteGate(gate, "always-selected");
        const verdict = routeLaneDecision(atoms, lane, revoked);
        return FinalCheckRouteGate.make({
          gate,
          ...verdict,
          reason: verdict.decision === "selected" ? "required-lane" : `route:${A.join(verdict.refinements, ",")}`,
          ...(verdict.decision === "selected" ? {} : { proofKey: "key-change" }),
        });
      }),
    })
);

/**
 * Classify the requested head and read its revocation sentinel, selecting every gate on route errors.
 *
 * **Example** (Build a head-pinned classification)
 * ```ts
 * import { collectFinalCheckRoute } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 * Effect.isEffect(collectFinalCheckRoute("/repo", "base", "head")) // => true
 * ```
 * @category io
 * @since 0.0.0
 */
export const collectFinalCheckRoute = Effect.fn("Yeet.collectFinalCheckRoute")(
  function* (repoRoot: string, mergeBase: string, headSha: string) {
    const classifier = yield* ChangeClassifier;
    const changeSet = yield* classifier.classify(ClassifyInput.make({ repoRoot, base: mergeBase, head: headSha }));
    const git = yield* Git;
    const sentinelText = yield* git.show(repoRoot, headSha, "standards/verification-route.sentinel.json");
    const sentinel = yield* O.match(sentinelText, {
      onNone: () => Effect.succeed({ revoked: [] }),
      onSome: decodeRouteSentinelText,
    });
    const digest = yield* sha256Hex(routeFootprintCanonicalJson());
    return planFinalCheckRoute(
      changeSet.atoms,
      digest,
      A.map(sentinel.revoked, (entry) => entry.id)
    );
  },
  Effect.catchCause(() =>
    Effect.succeed(
      FinalCheckRoute.make({
        footprintDigest: "unavailable",
        atomsByKind: atomCounts([]),
        gates: A.map(FinalCheckGate.literals, (gate) => selectedRouteGate(gate, "route-unavailable")),
        shadowMisses: [],
        reason: "route-unavailable",
      })
    )
  )
);

const EXPECTATION_REWRITE_CONTEXT = "Test Unit (expectations edited to match new output)";

/**
 * Plan the subprocess steps for every subprocess-backed final-check gate.
 *
 * **Details**
 *
 * `expectation-rewrite` is evaluated in process and has no step here. Hosted
 * lanes dispatch through {@link ciLaneDispatchStep} with the pull-request
 * `--affected --base <merge-base>` shape, so the argv cannot drift from what
 * `beep ci local` and hosted CI run. Lint Policy keeps its affected law tasks
 * (`beep lint policy --base`) and adds the two repo-wide sweeps that the
 * affected local scope omits but the hosted `--full` lane runs: root docs
 * oxlint and the deprecated-API oxlint sweep. A caller that resolved full scope
 * supplies the existing sweep configuration: the policy command explicitly
 * runs `--full`, owns root docs once, and owns the full deprecated-API sweep
 * when its configured engine is oxlint. Unknown/affected scope retains the
 * standalone sweeps. Lint adds the pre-commit Biome
 * pass over the diff's changed files, because package `lint` tasks never see
 * paths outside a workspace package (#2187 landed an EF-40 GritQL violation in
 * `goals/` that no hosted lane flagged and lefthook then rejected on every
 * later commit staging the file). Coverage runs the per-file
 * ratchet (`beep-cli coverage --affected`), which also runs the affected
 * packages' unit tests.
 *
 * **Example** (Plan the final-check steps)
 *
 * ```ts
 * import { planFinalCheckSteps } from "@beep/repo-cli/test/Yeet"
 *
 * const steps = planFinalCheckSteps("/repo", "abc123", ["goals/x/ops/check.ts"])
 * console.log(steps.map((step) => step.gate).includes("check")) // true
 * ```
 *
 * @param repoRoot - Checkout root used as every subprocess working directory.
 * @param mergeBase - Merge base of the branch with its base ref.
 * @param changedFiles - Files the diff adds or modifies, repo-relative.
 * @param fullLintPolicySweeps - Validated sweep configuration when planning an explicit full policy run.
 * @returns Planned steps in gate order.
 * @category planning
 * @since 0.0.0
 */
export const planFinalCheckSteps: {
  (
    repoRoot: string,
    mergeBase: string,
    changedFiles: ReadonlyArray<string>,
    fullLintPolicySweeps?: LintPolicySweeps
  ): ReadonlyArray<FinalCheckPlannedStep>;
  (
    mergeBase: string,
    changedFiles: ReadonlyArray<string>,
    fullLintPolicySweeps?: LintPolicySweeps
  ): (repoRoot: string) => ReadonlyArray<FinalCheckPlannedStep>;
} = dual(
  (args: IArguments) => Str.isString(args[1]),
  (
    repoRoot: string,
    mergeBase: string,
    changedFiles: ReadonlyArray<string>,
    fullLintPolicySweeps?: LintPolicySweeps
  ): ReadonlyArray<FinalCheckPlannedStep> => {
    const fullPolicy = O.fromUndefinedOr(fullLintPolicySweeps);
    const plan = CiLocalStepPlan.make({ affected: true, base: mergeBase, onMainBranch: false });
    const lane = (gate: FinalCheckGate, hostedContext: string, laneId: CiLaneId) =>
      FinalCheckPlannedStep.make({
        gate,
        hostedContext,
        step: ciLaneDispatchStep(repoRoot, `final-check:${gate}`, laneId, plan),
      });
    const command = (
      gate: FinalCheckGate,
      hostedContext: string,
      label: string,
      argv: readonly [string, ...Array<string>],
      env: Record<string, string> = {}
    ) =>
      FinalCheckPlannedStep.make({
        gate,
        hostedContext,
        step: QualityTaskStep.make({
          label: `final-check:${label}`,
          command: argv[0],
          args: A.drop(argv, 1),
          cwd: repoRoot,
          env,
        }),
      });
    return [
      command(
        "cheap-gates",
        "Repo Sanity, JSDoc Ratchet, Lint Policy (cheap tier: catalogs, schema-first, oxlint)",
        "cheap-gates",
        ["bun", "run", "beep", "quality", "github-checks", "cheap-gates"]
      ),
      command(
        "lint-policy",
        O.isSome(fullPolicy)
          ? "Heavy / Lint Policy (full law tasks and root sweeps)"
          : "Heavy / Lint Policy (affected law tasks)",
        "lint-policy:laws",
        ["bun", "run", "beep", "lint", "policy", ...(O.isSome(fullPolicy) ? ["--full"] : []), "--base", mergeBase]
      ),
      ...(O.isSome(fullPolicy)
        ? []
        : [
            command("lint-policy", "Heavy / Lint Policy (root docs oxlint)", "lint-policy:docs", [
              "bunx",
              "oxlint",
              ".",
              "--config",
              ".oxlintrc.docs.json",
              "--max-warnings=0",
            ]),
          ]),
      ...(O.exists(fullPolicy, (sweeps) => sweeps.deprecatedApis === "oxlint")
        ? []
        : [
            command("lint-policy", "Heavy / Lint Policy (deprecated APIs)", "lint-policy:deprecated-apis", [
              "bun",
              "run",
              "beep",
              "lint",
              "deprecated-apis",
              "--full",
            ]),
          ]),
      lane("lint", "Lint (package Biome, GritQL laws)", "lint"),
      ...(A.isReadonlyArrayEmpty(changedFiles)
        ? []
        : [
            command(
              "lint",
              "pre-commit Biome over the diff's files (goals/, scripts/ and other non-package paths)",
              "lint:changed-files",
              ["bunx", "biome", "check", "--files-ignore-unknown=true", "--no-errors-on-unmatched", ...changedFiles]
            ),
          ]),
      lane("repo-sanity", "Repo Sanity", "repo-sanity"),
      lane("check", "Heavy / Check", "check"),
      lane("docgen", "Heavy / Docgen", "docgen"),
      lane("fallow", "Fallow Advisory Envelopes", "fallow"),
      command(
        "coverage",
        "Heavy / Coverage Regression, Test Unit (affected packages)",
        "coverage",
        ["bun", "run", "coverage", "--affected"],
        { TURBO_SCM_BASE: mergeBase }
      ),
    ];
  }
);

// Resolve scope before planning, then force --full so the child cannot silently
// downgrade. A missing/failed probe keeps both standalone root guards.
const resolveFullLintPolicySweeps = Effect.fn("Yeet.resolveFullLintPolicySweeps")(
  function* (repoRoot: string, base: string) {
    const scope = yield* resolveLintPolicyScope(repoRoot, base);
    return scope._tag === "full" ? yield* Effect.asSome(readLintPolicySweeps(repoRoot)) : O.none<LintPolicySweeps>();
  },
  Effect.catch((error) =>
    Console.log(
      `[yeet] final-check lint-policy: scope probe unavailable; retaining standalone root sweeps (${error.message})`
    ).pipe(Effect.as(O.none<LintPolicySweeps>()))
  )
);

// The receipt reason for a coverage gate whose affected plan is noop. The step passes rather
// than skips: `yeet ready` requires every skipped gate to be named in the PR body.
const FINAL_CHECK_COVERAGE_NOOP_REASON = "no affected packages";

// Same planner, base and changed-file collection as the coverage subprocess (Tasks.ts), so a
// noop here is the subprocess's noop. Never pass final-check's own changedFiles: they drop
// deletions. A failed probe leaves the subprocess to plan for itself.
const resolveFinalCheckCoverageScope = Effect.fn("Yeet.resolveFinalCheckCoverageScope")(
  function* (repoRoot: string, base: string) {
    const scope = yield* resolveAffectedCoverageScope(repoRoot, base);
    return O.some(scope);
  },
  Effect.catch((error) =>
    Console.log(
      `[yeet] final-check coverage: scope probe unavailable; the coverage step plans for itself (${error.message})`
    ).pipe(Effect.as(O.none<CoverageAffectedScope>()))
  )
);

const renderCommand = (step: QualityTaskStep): string =>
  A.join(
    [
      ...(step.env?.TURBO_SCM_BASE === undefined ? [] : [`TURBO_SCM_BASE=${step.env.TURBO_SCM_BASE}`]),
      step.command,
      ...step.args,
    ],
    " "
  );

const isFinalCheckGate = S.is(FinalCheckGate);

/**
 * Parse `--gates` values into a gate selection; empty means every gate.
 *
 * **Example** (Select two gates)
 *
 * ```ts
 * import { parseFinalCheckGates } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(parseFinalCheckGates(["check,docgen"]))) // true
 * ```
 *
 * @param values - Raw `--gates` values, comma separated or repeated.
 * @returns The selected gates in run order.
 * @category parsers
 * @since 0.0.0
 */
export const parseFinalCheckGates = Effect.fn("Yeet.parseFinalCheckGates")(function* (values: ReadonlyArray<string>) {
  const entries = pipe(values, A.flatMap(Str.split(",")), A.map(Str.trim), A.filter(Str.isNonEmpty));
  const unknown = A.filter(entries, (entry) => !isFinalCheckGate(entry));
  if (A.isReadonlyArrayNonEmpty(unknown)) {
    return yield* YeetCommandError.make({
      message: `Unknown final-check gate(s): ${A.join(unknown, ", ")}. Valid gates: ${A.join(FinalCheckGate.literals, ", ")}.`,
      exitCode: 2,
    });
  }
  return A.isReadonlyArrayEmpty(entries)
    ? FinalCheckGate.literals
    : A.filter(FinalCheckGate.literals, (gate) => A.contains(entries, gate));
});

/**
 * Parse `--skip <gate>=<reason>` values.
 *
 * **Example** (Skip coverage with a reason)
 *
 * ```ts
 * import { parseFinalCheckSkips } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(parseFinalCheckSkips(["coverage=admission waited 10 minutes"]))) // true
 * ```
 *
 * @param values - Raw `--skip` values.
 * @returns The recorded skips.
 * @category parsers
 * @since 0.0.0
 */
export const parseFinalCheckSkips = Effect.fn("Yeet.parseFinalCheckSkips")(function* (values: ReadonlyArray<string>) {
  return yield* Effect.forEach(values, (value) => {
    const separator = Str.indexOf("=")(value);
    const gate = O.match(separator, { onNone: () => value, onSome: (index) => Str.trim(Str.slice(0, index)(value)) });
    const reason = O.match(separator, { onNone: () => "", onSome: (index) => Str.trim(Str.slice(index + 1)(value)) });
    return isFinalCheckGate(gate) && Str.isNonEmpty(reason)
      ? Effect.succeed(FinalCheckSkip.make({ gate, reason }))
      : Effect.fail(
          YeetCommandError.make({
            message: `--skip must be "<gate>=<reason>" with a known gate and a non-empty reason; got "${value}". Valid gates: ${A.join(FinalCheckGate.literals, ", ")}.`,
            exitCode: 2,
          })
        );
  });
});

// The requested gates the profile routes to hosted CI, less those an operator skip already names.
const profileRoutedGates = (
  gates: ReadonlyArray<FinalCheckGate>,
  operatorSkips: ReadonlyArray<FinalCheckSkip>,
  profile: ComputeProfile
): ReadonlyArray<FinalCheckGate> =>
  A.filter(
    gates,
    (gate) => gateRouteFor(gate, profile) === "hosted-only" && !A.some(operatorSkips, (skip) => skip.gate === gate)
  );

// Forced coverage measures the diff's own packages only when its affected plan selected them (or
// none): a whole-workspace fallback, or a plan the probe could not read, may cover the whole repo,
// which has no measured worker budget (goals/compute-profile-gate-routing, 2026-11-13 decision).
const forcedCoverageScopeRefusal = (scope: O.Option<CoverageAffectedScope>): O.Option<string> =>
  O.match(scope, {
    onNone: () =>
      O.some(
        "its affected plan could not be read, so the run may cover the whole workspace: no measured worker budget"
      ),
    onSome: (planned) =>
      planned._tag === "full"
        ? O.some(
            `its affected plan falls back to the whole workspace (${A.join(planned.reasons, "; ")}): no measured worker budget`
          )
        : O.none(),
  });

// The routing input of a final-check run on its compute profile. `coverageScope` is the affected
// coverage plan the run probed, present only when the coverage gate is requested and not skipped;
// `O.none()` means the probe could not read it. `routeSkipped` names the gates the change route
// skips: they never run, so they are never forced.
type FinalCheckProfileRouting = {
  readonly gates: ReadonlyArray<FinalCheckGate>;
  readonly operatorSkips: ReadonlyArray<FinalCheckSkip>;
  readonly profile: ComputeProfile;
  readonly forceLocal: boolean;
  readonly coverageScope?: O.Option<CoverageAffectedScope>;
  readonly routeSkipped?: ReadonlyArray<FinalCheckGate>;
};

const forcedRefusalFor =
  (coverageScope: O.Option<CoverageAffectedScope> | undefined) =>
  (gate: FinalCheckGate): O.Option<string> =>
    gate === "coverage" && coverageScope !== undefined
      ? forcedCoverageScopeRefusal(coverageScope)
      : workerForcedRefusal(gate);

// The profile-routed gates `--force-local` does not refuse. The profile skips are their
// complement; a gate the change route skips stays out of the skips and is not forced either.
const forceableWorkerGates = ({
  gates,
  operatorSkips,
  profile,
  forceLocal,
  coverageScope,
}: FinalCheckProfileRouting): ReadonlyArray<FinalCheckGate> =>
  forceLocal
    ? A.filter(profileRoutedGates(gates, operatorSkips, profile), (gate) =>
        O.isNone(forcedRefusalFor(coverageScope)(gate))
      )
    : [];

/**
 * The hosted-only gates `--force-local` actually runs on this host.
 *
 * **Details**
 *
 * Empty without `--force-local` and off `worker`. On `worker` these are the
 * profile-routed gates that are neither operator-skipped, skipped by the
 * change route, nor refused ({@link workerForcedRefusal}); coverage is also
 * refused when its probed affected plan is not a selected set of packages.
 * The receipt records `forceLocal: true` and final-check prints the
 * concurrency line only when this list is non-empty.
 *
 * **Example** (Force coverage, refuse fallow)
 *
 * ```ts
 * import { forcedWorkerGates } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(forcedWorkerGates({ gates: ["fallow", "coverage"], operatorSkips: [], profile: "worker", forceLocal: true })) // [ "coverage" ]
 * ```
 *
 * @param input - The run's routing input.
 * @returns The forced gates, in gate order.
 * @category utilities
 * @since 0.0.0
 */
export const forcedWorkerGates = (input: FinalCheckProfileRouting): ReadonlyArray<FinalCheckGate> =>
  A.difference(forceableWorkerGates(input), input.routeSkipped ?? []);

/**
 * The skips the compute profile adds to a final-check run.
 *
 * **Details**
 *
 * Every requested gate that is hosted-only on `profile` and has no operator
 * `--skip` is skipped with reason `compute-profile=worker`; an operator skip
 * for the same gate wins and keeps its own reason. With `forceLocal` only the
 * gates a worker refuses to force stay skipped: those whose measured run did
 * not complete inside the worker slice or that have no measured budget
 * ({@link workerForcedRefusal}), and coverage whose probed affected plan is
 * not a selected set of packages. The rest run here.
 *
 * **Example** (Defer check on a worker)
 *
 * ```ts
 * import { computeProfileFinalCheckSkips } from "@beep/repo-cli/test/Yeet"
 *
 * const skips = computeProfileFinalCheckSkips({ gates: ["lint", "check"], operatorSkips: [], profile: "worker", forceLocal: false })
 * console.log(skips.map((skip) => `${skip.gate}=${skip.reason}`)) // [ "check=compute-profile=worker" ]
 * ```
 *
 * @param input - The planned gates, the parsed `--skip` values, the resolved
 *   profile, whether `--force-local` was passed and the probed coverage plan.
 * @returns The profile skips, in gate order.
 * @category utilities
 * @since 0.0.0
 */
export const computeProfileFinalCheckSkips = (input: FinalCheckProfileRouting): ReadonlyArray<FinalCheckSkip> => {
  const forced = forceableWorkerGates(input);
  return pipe(
    profileRoutedGates(input.gates, input.operatorSkips, input.profile),
    A.filter((gate) => !A.contains(forced, gate)),
    A.map((gate) => FinalCheckSkip.make({ gate, reason: COMPUTE_PROFILE_WORKER_SKIP_REASON }))
  );
};

const FORCED_REFUSAL_ROUTE = "push with `bun run beep yeet open --body-file <md>` and let hosted CI prove it";

const isSelectedCoverageScope = S.is(CoverageSelectedScope);

/**
 * The lines `yeet final-check --force-local` prints on a `worker` host.
 *
 * **Details**
 *
 * A forced gate on `worker` runs one task at a time (concurrency 1), and
 * forced coverage names the packages its affected plan measures. A gate
 * whose measured run did not fit the worker slice, or that has no measured
 * budget, is refused and stays with hosted CI: the line names the
 * measurement and tells the operator to push and let hosted CI prove it.
 * `repo-sanity` keeps its changeset status narrowing. Nothing is printed
 * without `--force-local` or off `worker`.
 *
 * **Example** (Force coverage and check on a worker)
 *
 * ```ts
 * import { forcedWorkerFinalCheckLines } from "@beep/repo-cli/test/Yeet"
 *
 * const lines = forcedWorkerFinalCheckLines({ gates: ["check", "coverage"], operatorSkips: [], profile: "worker", forceLocal: true })
 * console.log(lines.length) // 2
 * ```
 *
 * @param input - The planned gates, the parsed `--skip` values, the resolved
 *   profile, whether `--force-local` was passed and the probed coverage plan.
 * @returns The refusal lines, then the concurrency and coverage-scope lines, in gate order.
 * @category utilities
 * @since 0.0.0
 */
export const forcedWorkerFinalCheckLines = (input: FinalCheckProfileRouting): ReadonlyArray<string> => {
  const { gates, operatorSkips, profile, forceLocal, coverageScope } = input;
  if (!forceLocal || profile !== "worker") return [];
  const requested = A.filter(gates, (gate) => !A.some(operatorSkips, (skip) => skip.gate === gate));
  const refused = A.getSomes(
    A.map(requested, (gate) =>
      O.map(
        forcedRefusalFor(coverageScope)(gate),
        (reason) =>
          `[yeet] final-check --force-local refused ${gate} on the worker profile: ${reason}; ${FORCED_REFUSAL_ROUTE}`
      )
    )
  );
  const measures = pipe(
    O.fromUndefinedOr(coverageScope),
    O.flatten,
    O.toArray,
    A.filter(isSelectedCoverageScope),
    A.map(
      (scope) =>
        `[yeet] final-check --force-local measures coverage for ${A.join(scope.packageNames, ", ")} (this diff's affected plan)`
    )
  );
  return A.appendAll(
    refused,
    A.match(forcedWorkerGates(input), {
      onEmpty: () => [],
      onNonEmpty: (forced) => [
        `[yeet] final-check --force-local on the worker profile runs ${A.join(forced, ", ")} one task at a time (concurrency 1)`,
        ...measures,
      ],
    })
  );
};

// What a forced gate adds to its argv on `worker` to run one task at a time: coverage's prebuild,
// shard group and Turbo graph one task at a time. Fallow is refused (GateRoute.schemas.ts).
const FORCED_WORKER_SERIAL_ARGS = HashMap.make<ReadonlyArray<readonly [FinalCheckGate, ReadonlyArray<string>]>>([
  "coverage",
  ["--concurrency=1"],
]);

const appendStepArgs = (entry: FinalCheckPlannedStep, args: ReadonlyArray<string>): FinalCheckPlannedStep =>
  FinalCheckPlannedStep.make({
    ...entry,
    step: QualityTaskStep.make({ ...entry.step, args: A.appendAll(entry.step.args, args) }),
  });

const workerStep =
  (forceLocal: boolean) =>
  (entry: FinalCheckPlannedStep): FinalCheckPlannedStep =>
    entry.gate === "repo-sanity"
      ? FinalCheckPlannedStep.make({
          ...entry,
          step: QualityTaskStep.make({
            label: entry.step.label,
            command: "bun",
            args: ["run", "beep", "quality", "changeset-status", "--since", "origin/main"],
            cwd: entry.step.cwd,
          }),
        })
      : forceLocal
        ? O.match(HashMap.get(FORCED_WORKER_SERIAL_ARGS, entry.gate), {
            onNone: () => entry,
            onSome: (args) => appendStepArgs(entry, args),
          })
        : entry;

const FINAL_CHECK_EFFECT_VITEST_FILES_CONTEXT =
  "Heavy / Lint Policy (lint:effect-vitest over the diff's test files; the rest of Lint Policy is hosted-only on worker)";

const effectVitestFilesStep = (cwd: string, files: A.NonEmptyReadonlyArray<string>): FinalCheckPlannedStep =>
  FinalCheckPlannedStep.make({
    gate: "lint",
    hostedContext: FINAL_CHECK_EFFECT_VITEST_FILES_CONTEXT,
    step: QualityTaskStep.make({
      label: "final-check:lint:effect-vitest-files",
      command: "bun",
      args: ["run", "beep", "lint", "effect-vitest", ...A.flatMap(files, (file) => ["--files", file])],
      cwd,
    }),
  });

/**
 * Narrow the planned steps to what the compute profile may run locally.
 *
 * **Details**
 *
 * The `repo-sanity` lane runs the whole-repo schema catalog scan, which
 * holds about 5 GB on a host whose worker slice is capped at 7 GiB. On `worker`
 * the gate therefore runs only its changeset status check (D6), with or
 * without `--force-local`, and hosted Repo Sanity proves the rest. The
 * decision lives here rather than in `beep ci lane` because hosted runners
 * execute that same lane and must keep the full scan. With `--force-local` on
 * `worker`, coverage runs its prebuild, shards and Turbo graph one task at a
 * time (`--concurrency=1`). Lint Policy never
 * runs on `worker`, so the `lint` gate gains `lint effect-vitest --files` over
 * the diff's files in the effect-vitest scope: the part of Lint Policy that
 * costs one syntax parse per file. `workstation` keeps the plan unchanged.
 *
 * **Example** (Narrow repo-sanity on a worker)
 *
 * ```ts
 * import { planFinalCheckSteps, routeFinalCheckStepsForProfile } from "@beep/repo-cli/test/Yeet"
 * import * as A from "effect/Array"
 * import * as O from "effect/Option"
 *
 * const planned = routeFinalCheckStepsForProfile({
 *   planned: planFinalCheckSteps("/repo", "abc123", []),
 *   profile: "worker",
 *   forceLocal: false,
 * })
 * const step = A.findFirst(planned, (entry) => entry.gate === "repo-sanity")
 * console.log(O.map(step, (entry) => entry.step.args.join(" "))) // Some("run beep quality changeset-status --since origin/main")
 * ```
 *
 * @param input - The planned steps, the resolved profile, whether
 *   `--force-local` was passed, and the diff's added or modified files.
 * @returns The steps to run on this host, in plan order.
 * @category policies
 * @since 0.0.0
 */
export const routeFinalCheckStepsForProfile = ({
  planned,
  profile,
  forceLocal,
  changedFiles = [],
}: {
  readonly planned: ReadonlyArray<FinalCheckPlannedStep>;
  readonly profile: ComputeProfile;
  readonly forceLocal: boolean;
  readonly changedFiles?: ReadonlyArray<string>;
}): ReadonlyArray<FinalCheckPlannedStep> => {
  if (profile !== "worker") return planned;
  const routed = A.map(planned, workerStep(forceLocal));
  const lastLint = A.findLastIndex(routed, (entry) => entry.gate === "lint");
  return A.match(A.filter(changedFiles, isEffectVitestScopePath), {
    onEmpty: () => routed,
    onNonEmpty: (files) =>
      A.flatMap(routed, (entry, index) =>
        O.contains(lastLint, index) ? [entry, effectVitestFilesStep(entry.step.cwd, files)] : [entry]
      ),
  });
};

/**
 * The line `yeet final-check` prints when the profile deferred gates to hosted CI.
 *
 * **Example** (Print the route line)
 *
 * ```ts
 * import { FINAL_CHECK_WORKER_ROUTE_LINE } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(FINAL_CHECK_WORKER_ROUTE_LINE.startsWith("worker profile")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const FINAL_CHECK_WORKER_ROUTE_LINE =
  "worker profile: hosted-only gates deferred; publish with `bun run beep yeet open --body-file <md>` and let hosted CI prove them";

/**
 * Resolve the compute profile and the skips it adds to a final-check run.
 *
 * **Details**
 *
 * Reads `ComputeProfileProbe` once; an unreadable
 * `BEEP_COMPUTE_PROFILE` override fails the run (exit 2) instead of silently
 * running hosted-only gates.
 *
 * **Example** (Build the resolution effect)
 *
 * ```ts
 * import { resolveFinalCheckProfileSkips } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(resolveFinalCheckProfileSkips(["check"], [], false))) // true
 * ```
 *
 * @param gates - The gates the run plans.
 * @param operatorSkips - The parsed `--skip` values.
 * @param forceLocal - Whether `--force-local` keeps every gate local.
 * @returns The resolved profile and the skips it adds.
 * @category use-cases
 * @since 0.0.0
 */
export const resolveFinalCheckProfileSkips = Effect.fn("Yeet.resolveFinalCheckProfileSkips")(function* (
  gates: ReadonlyArray<FinalCheckGate>,
  operatorSkips: ReadonlyArray<FinalCheckSkip>,
  forceLocal: boolean
) {
  const computeProfile = yield* readYeetComputeProfile("yeet final-check");
  return {
    computeProfile,
    profileSkips: computeProfileFinalCheckSkips({ gates, operatorSkips, profile: computeProfile, forceLocal }),
  };
});

const renderProfileSkips = (skips: ReadonlyArray<FinalCheckSkip>): string =>
  `[yeet] final-check deferred to hosted CI (${COMPUTE_PROFILE_WORKER_SKIP_REASON}): ${A.join(
    A.map(skips, (skip) => skip.gate),
    ", "
  )}\n[yeet] ${FINAL_CHECK_WORKER_ROUTE_LINE}`;

const printProfileSkips = (skips: ReadonlyArray<FinalCheckSkip>) =>
  A.isReadonlyArrayEmpty(skips) ? Effect.void : Console.log(renderProfileSkips(skips));

/**
 * Decide whether a receipt admits the draft-to-ready flip of a head.
 *
 * **Details**
 *
 * Returns the refusal detail, or none when the receipt is a
 * `yeet-final-check/v2` receipt written under the current gate set
 * ({@link finalCheckGateSetRefusal}), for this exact head, complete (every
 * gate ran or was skipped with a reason), and passing.
 *
 * **Example** (Refuse a missing receipt)
 *
 * ```ts
 * import { finalCheckRefusal } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * console.log(O.isSome(finalCheckRefusal(O.none(), "abc"))) // true
 * ```
 *
 * @param receipt - The receipt read for the head, if any.
 * @param headSha - Head the flip would mark ready.
 * @returns The refusal detail when the flip must wait.
 * @category policies
 * @since 0.0.0
 */
export const finalCheckRefusal: {
  (receipt: O.Option<FinalCheckReceipt>, headSha: string): O.Option<string>;
  (headSha: string): (receipt: O.Option<FinalCheckReceipt>) => O.Option<string>;
} = dual(
  2,
  (receipt: O.Option<FinalCheckReceipt>, headSha: string): O.Option<string> =>
    O.match(receipt, {
      onNone: () =>
        O.some(
          `no final-check receipt for head ${Str.slice(0, 12)(headSha)}; run \`${YEET_FINAL_CHECK_COMMAND}\` on the committed head`
        ),
      onSome: (found) =>
        O.orElse(finalCheckGateSetRefusal(found), () =>
          found.headSha !== headSha
            ? O.some(
                `the final-check receipt is for ${Str.slice(0, 12)(found.headSha)}, not head ${Str.slice(0, 12)(headSha)}`
              )
            : !found.complete
              ? O.some(
                  "the final-check receipt covers a --gates subset; run every gate (skip one only with --skip <gate>=<reason>)"
                )
              : found.verdict !== "pass"
                ? O.some(
                    `final-check failed on ${A.join(
                      A.dedupe(
                        A.map(
                          A.filter(found.steps, (step) => step.status === "failed"),
                          (step) => step.gate
                        )
                      ),
                      ", "
                    )}; fix the reds and re-run \`${YEET_FINAL_CHECK_COMMAND}\``
                  )
                : O.none()
        ),
    })
);

const receiptPath = Effect.fnUntraced(function* (repoRoot: string, headSha: string) {
  const path = yield* Path.Path;
  return path.join(repoRoot, FINAL_CHECK_RECEIPT_DIR, `${headSha}.json`);
});

const decodeReceipt = S.decodeUnknownEffect(S.fromJsonString(FinalCheckReceipt));
const encodeReceipt = S.encodeUnknownEffect(S.fromJsonString(FinalCheckReceipt));

/**
 * Read the final-check receipt recorded for a head, if one exists and decodes.
 *
 * **Example** (Build the read effect)
 *
 * ```ts
 * import { readFinalCheckReceipt } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readFinalCheckReceipt("/repo", "abc"))) // true
 * ```
 *
 * @param repoRoot - Checkout holding `.beep/yeet/final-check/`.
 * @param headSha - Head whose receipt is read.
 * @returns The receipt, or none when absent or malformed.
 * @category io
 * @since 0.0.0
 */
export const readFinalCheckReceipt = Effect.fn("Yeet.readFinalCheckReceipt")(function* (
  repoRoot: string,
  headSha: string
): Effect.fn.Return<O.Option<FinalCheckReceipt>, never, FileSystem.FileSystem | Path.Path> {
  const fs = yield* FileSystem.FileSystem;
  const file = yield* receiptPath(repoRoot, headSha);
  return yield* fs
    .readFileString(file)
    .pipe(Effect.flatMap(decodeReceipt), Effect.asSome, Effect.orElseSucceed(O.none<FinalCheckReceipt>));
});

// `--gates` naming fewer than every gate; naming all of them is a full run.
const isGateSubset = (gates: ReadonlyArray<FinalCheckGate>): boolean =>
  A.length(gates) < A.length(FinalCheckGate.literals);

// A full run owns the head receipt. A subset run gets a file of its own, named by a ULID so a
// later run on the head sorts after it and leaves it readable.
const receiptTarget = Effect.fnUntraced(function* (repoRoot: string, headSha: string, subset: boolean) {
  if (!subset) return yield* receiptPath(repoRoot, headSha);
  const path = yield* Path.Path;
  const random = yield* SecureRandom.SecureRandom;
  return path.join(repoRoot, FINAL_CHECK_SUBSET_RECEIPT_DIR, headSha, `${yield* random.ulid}.json`);
});

const writeReceipt = Effect.fn("Yeet.writeFinalCheckReceipt")(
  function* (repoRoot: string, receipt: FinalCheckReceipt, subset: boolean) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const file = yield* receiptTarget(repoRoot, receipt.headSha, subset);
    yield* fs.makeDirectory(path.dirname(file), { recursive: true });
    yield* fs.writeFileString(file, `${yield* encodeReceipt(receipt)}\n`);
    return file;
  },
  Effect.mapError(YeetCommandError.new("Failed to write the final-check receipt."))
);

const nowIso = Effect.map(DateTime.now, DateTime.formatIso);

const runStep = Effect.fn("Yeet.runFinalCheckStep")(function* (planned: FinalCheckPlannedStep) {
  const command = renderCommand(planned.step);
  yield* Console.log(`[yeet] final-check ${planned.gate}: ${command}`);
  const started = yield* Clock.currentTimeMillis;
  const exitCode = yield* runToExit({
    command: planned.step.command,
    args: planned.step.args,
    cwd: planned.step.cwd,
    stdio: "inherit",
    env: planned.step.env,
    extendEnv: true,
  }).pipe(
    Effect.catch((cause) =>
      Console.error(`[yeet] final-check ${planned.gate}: could not start ${command}: ${cause.message}`).pipe(
        Effect.as(-1)
      )
    )
  );
  const durationMs = (yield* Clock.currentTimeMillis) - started;
  return FinalCheckStepResult.make({
    gate: planned.gate,
    label: planned.step.label,
    hostedContext: planned.hostedContext,
    command,
    status: exitCode === 0 ? "passed" : "failed",
    durationMs,
    ...(exitCode === 0 ? {} : { reason: exitCode === -1 ? "the step could not be started" : `exit ${exitCode}` }),
  });
});

// Composite sanity/cheap gates include live external checks, which cannot be reused.
// Expectation rewrites remain an in-process replay and never enter this path.
const reusableFinalCheckGate = FinalCheckGate.pick(["lint-policy", "lint", "check", "docgen", "fallow", "coverage"]);

const finalCheckProofLane = (planned: FinalCheckPlannedStep) =>
  GithubCheckLaneSpec.make({
    id: planned.step.label,
    tier: "pre-push",
    stage: "repo-quality",
    wave: "heavy",
    blockedBy: [],
    // runStep inherits the ambient environment; hash it as part of the proof too.
    step: QualityTaskStep.make({ ...planned.step, useLocalEnv: true }),
  });

// This runner belongs to one sequential final-check invocation. A post-command
// session fences that command and identifies the following command's start.
const makeFinalCheckStepRunner = (planned: ReadonlyArray<FinalCheckPlannedStep>, resume: boolean) => {
  const lanes = pipe(
    planned,
    A.filter((entry) => S.is(reusableFinalCheckGate)(entry.gate)),
    A.map(finalCheckProofLane)
  );
  let session = O.none<LaneProofSession>();
  const prepare = () =>
    prepareLaneProofSession(lanes, resume ? "active" : "shadow").pipe(
      Effect.mapError(YeetCommandError.new("Failed to prepare final-check step proof."))
    );
  const invalidate = Effect.sync(() => {
    session = O.none();
  });
  const execute = Effect.fn("Yeet.runFinalCheckStepWithProof")(function* (entry: FinalCheckPlannedStep) {
    if (!S.is(reusableFinalCheckGate)(entry.gate)) {
      yield* invalidate;
      return yield* runStep(entry);
    }
    const lane = finalCheckProofLane(entry);
    if (O.isNone(session)) session = yield* prepare();
    const started = session;
    if (O.isSome(started) && resume && hasReusableLaneProof(started.value, lane.id)) {
      // A reused step executes no command, so there is no intervening command
      // boundary to re-identify before the next reuse decision.
      const reason = FINAL_CHECK_REUSED_STEP_REASON;
      yield* Console.log(`[yeet] final-check ${entry.gate}: ${reason}`);
      return FinalCheckStepResult.make({
        gate: entry.gate,
        label: entry.step.label,
        hostedContext: entry.hostedContext,
        command: renderCommand(entry.step),
        status: "passed",
        durationMs: 0,
        reason,
      });
    }
    const result = yield* runStep(entry);
    // A failed command can also move the tree or environment. Discard its
    // start snapshot; a subsequent step must prepare a fresh boundary.
    yield* invalidate;
    if (O.isSome(started) && result.status === "passed") {
      session = yield* prepare();
      if (O.isSome(session)) {
        yield* persistLaneProofs(started.value, [[lane, result.durationMs]], session.value).pipe(
          Effect.ignore({ log: "Warn", message: "[yeet] final-check completed step could not be saved for resume" })
        );
      }
    }
    return result;
  });
  return { execute, invalidate };
};

/**
 * Execute one planned step, recording a successful exact-input proof for a later resume.
 *
 * **Example** (Inspect a resumable step)
 *
 * ```ts
 * import { planFinalCheckSteps, runFinalCheckStep } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 * const step = planFinalCheckSteps("/repo", "base", [])[0]
 * if (step) console.log(Effect.isEffect(runFinalCheckStep(step, true)))
 * ```
 *
 * **Details**
 * A failed command never saves proof. Live external checks always execute. The enclosing
 * final-check command still owns clean-tree checks and the complete head-pinned receipt.
 *
 * @category execution
 * @since 0.0.0
 */
export const runFinalCheckStep = Effect.fn("Yeet.runFinalCheckStepWithProof")(function* (
  planned: FinalCheckPlannedStep,
  resume: boolean
) {
  return yield* makeFinalCheckStepRunner([planned], resume).execute(planned);
});

const runExpectationRewriteGate = Effect.fn("Yeet.runExpectationRewriteGate")(function* (
  repoRoot: string,
  mergeBase: string
) {
  const started = yield* Clock.currentTimeMillis;
  const command = `git diff --unified=0 ${Str.slice(0, 12)(mergeBase)} HEAD -- <each modified or renamed test file>; replay rewritten tests on the merge base`;
  const rewrites = yield* collectExpectationRewrites(repoRoot, mergeBase);
  yield* Console.log(`[yeet] final-check expectation-rewrite: ${A.length(rewrites)} rewritten expectation(s)`);
  const verdicts = yield* verifyExpectationRewrites(repoRoot, mergeBase, rewrites);
  const blocking = A.filter(verdicts, (verdict) => verdict.classification !== "follows-diff");
  yield* Effect.forEach(
    verdicts,
    (verdict) =>
      Console.log(
        `[yeet] final-check expectation-rewrite ${verdict.testFile}: ${verdict.classification} (${verdict.detail})`
      ),
    { discard: true }
  );
  const step = FinalCheckStepResult.make({
    gate: "expectation-rewrite",
    label: "final-check:expectation-rewrite",
    hostedContext: EXPECTATION_REWRITE_CONTEXT,
    command,
    status: A.isReadonlyArrayEmpty(blocking) ? "passed" : "failed",
    durationMs: (yield* Clock.currentTimeMillis) - started,
    ...(A.isReadonlyArrayEmpty(blocking)
      ? {}
      : {
          reason: A.join(
            A.map(blocking, (verdict) => `${verdict.testFile}: ${verdict.classification}`),
            "; "
          ),
        }),
  });
  return { step, verdicts };
});

const skippedStep = (skip: FinalCheckSkip, hostedContext: string): FinalCheckStepResult =>
  FinalCheckStepResult.make({
    gate: skip.gate,
    label: `final-check:${skip.gate}`,
    hostedContext,
    command: "(skipped)",
    status: "skipped",
    durationMs: 0,
    reason: skip.reason,
  });

const receiptHeadline = (receipt: FinalCheckReceipt): string =>
  `final-check ${receipt.verdict} for ${Str.slice(0, 12)(receipt.headSha)} (merge base ${Str.slice(0, 12)(receipt.mergeBase)}${receipt.complete ? "" : ", gate subset"})`;

const renderSummary = (receipt: FinalCheckReceipt): string =>
  A.join(
    [
      `[yeet] ${receiptHeadline(receipt)}`,
      ...A.map(
        receipt.steps,
        (step) =>
          `  ${step.status} ${step.label} (${Duration.format(Duration.millis(step.durationMs))}): ${step.hostedContext}${step.reason === undefined ? "" : ` — ${step.reason}`}`
      ),
    ],
    "\n"
  );

type FinalCheckRun = {
  readonly repoRoot: string;
  readonly mergeBase: string;
  readonly planned: ReadonlyArray<FinalCheckPlannedStep>;
  readonly skips: ReadonlyArray<FinalCheckSkip>;
  readonly resume: boolean;
  readonly route?: FinalCheckRoute;
  readonly headSha?: string;
  readonly coverageScope?: CoverageAffectedScope;
};

type GateOutcome = {
  readonly steps: ReadonlyArray<FinalCheckStepResult>;
  readonly verdicts: ReadonlyArray<ExpectationRewriteVerdict>;
  readonly shadowMisses: ReadonlyArray<FinalCheckRouteGate>;
};

const plannedFor = (run: FinalCheckRun, gate: FinalCheckGate) => A.filter(run.planned, (entry) => entry.gate === gate);

const hostedContextFor = (run: FinalCheckRun, gate: FinalCheckGate): string =>
  gate === "expectation-rewrite"
    ? EXPECTATION_REWRITE_CONTEXT
    : A.join(
        A.map(plannedFor(run, gate), (entry) => entry.hostedContext),
        "; "
      );

const routeFor = (run: FinalCheckRun, gate: FinalCheckGate) =>
  O.fromUndefinedOr(run.route).pipe(O.flatMap((route) => A.findFirst(route.gates, (entry) => entry.gate === gate)));

const routeSkipFor = (run: FinalCheckRun, gate: FinalCheckGate) =>
  routeFor(run, gate).pipe(
    O.filter((entry) => entry.decision === "skipped"),
    O.map((entry) => FinalCheckSkip.make({ gate, reason: entry.reason }))
  );

const skipFor = (run: FinalCheckRun, gate: FinalCheckGate) =>
  A.findFirst(run.skips, (entry) => entry.gate === gate).pipe(O.orElse(() => routeSkipFor(run, gate)));

// The coverage gate's affected plan selected nothing: the step passes without spawning. A skip
// is decided before this (C5), so it only applies when `skipFor` returned None.
const plansNoCoverage = (run: FinalCheckRun, gate: FinalCheckGate): boolean =>
  gate === "coverage" && run.coverageScope?._tag === "noop";

const noopCoverageStep = (entry: FinalCheckPlannedStep): FinalCheckStepResult =>
  FinalCheckStepResult.make({
    gate: entry.gate,
    label: entry.step.label,
    hostedContext: entry.hostedContext,
    command: renderCommand(entry.step),
    status: "passed",
    durationMs: 0,
    reason: FINAL_CHECK_COVERAGE_NOOP_REASON,
  });

const printGatePlan = (run: FinalCheckRun, gate: FinalCheckGate) =>
  O.match(skipFor(run, gate), {
    onSome: (skip) => Console.log(`  skip ${gate}: ${skip.reason}`),
    onNone: () =>
      Match.value(gate).pipe(
        Match.when("expectation-rewrite", () =>
          Console.log(`  ${gate}: scan the diff's test files and snapshots; replay rewritten tests on the merge base`)
        ),
        Match.when(
          (candidate: FinalCheckGate) => plansNoCoverage(run, candidate),
          () => Console.log(`  ${gate}: ${FINAL_CHECK_COVERAGE_NOOP_REASON} (planner noop); nothing runs`)
        ),
        Match.orElse(() =>
          Effect.forEach(plannedFor(run, gate), (entry) => Console.log(`  ${gate}: ${renderCommand(entry.step)}`), {
            discard: true,
          })
        )
      ),
  });

const runGate = (run: FinalCheckRun, gate: FinalCheckGate, runner: ReturnType<typeof makeFinalCheckStepRunner>) =>
  O.match(skipFor(run, gate), {
    onSome: (skip): Effect.Effect<GateOutcome> =>
      Effect.succeed({ steps: [skippedStep(skip, hostedContextFor(run, gate))], verdicts: [], shadowMisses: [] }),
    onNone: () =>
      Match.value(gate).pipe(
        Match.when("expectation-rewrite", () =>
          Effect.map(
            runner.invalidate.pipe(Effect.andThen(runExpectationRewriteGate(run.repoRoot, run.mergeBase))),
            (result): GateOutcome => ({
              steps: [result.step],
              verdicts: result.verdicts,
              shadowMisses: [],
            })
          )
        ),
        // Spawns nothing and moves no tree, so it writes no lane proof and needs no invalidate;
        // a `--resume` run probes again.
        Match.when(
          (candidate: FinalCheckGate) => plansNoCoverage(run, candidate),
          () =>
            Console.log(`[yeet] final-check ${gate}: ${FINAL_CHECK_COVERAGE_NOOP_REASON} (planner noop)`).pipe(
              Effect.as<GateOutcome>({
                steps: A.map(plannedFor(run, gate), noopCoverageStep),
                verdicts: [],
                shadowMisses: [],
              })
            )
        ),
        Match.orElse(() =>
          Effect.map(
            Effect.forEach(plannedFor(run, gate), runner.execute),
            (steps): GateOutcome => ({
              steps,
              verdicts: [],
              shadowMisses: [],
            })
          )
        )
      ),
  });

const isFailedStep = (step: FinalCheckStepResult): boolean => step.status === "failed";

const hasFailure = (steps: ReadonlyArray<FinalCheckStepResult>): boolean => A.some(steps, isFailedStep);

// A shadow-skipped gate failed: one P0 inbox row per responsible refinement, naming the sentinel
// revocation that turns the refinement off.
const reportShadowMiss = Effect.fnUntraced(function* (
  run: FinalCheckRun,
  gate: FinalCheckGate,
  refinements: ReadonlyArray<string>
) {
  for (const refinement of refinements) {
    const capsule = YeetLocalShardFailureCapsule.make({
      headSha: run.headSha ?? run.mergeBase,
      shard: `route-shadow-miss:${refinement}:${gate}`,
      command: `Revoke refinement ${refinement} in standards/verification-route.sentinel.json; final-check ${gate} failed`,
      exitCode: 1,
    });
    const id = yield* yeetLocalShardFailedRowId(capsule);
    yield* appendYeetInboxRowOnce(
      run.repoRoot,
      YeetLocalShardFailedRow.make({
        capsule,
        id,
        checkout: run.repoRoot,
        severity: "P0",
        ts: yield* nowIso,
      })
    );
  }
});

const runGates = Effect.fn("Yeet.runFinalCheckGates")(function* (
  run: FinalCheckRun,
  gates: ReadonlyArray<FinalCheckGate>,
  failFast: boolean
) {
  const runner = makeFinalCheckStepRunner(
    A.filter(run.planned, (entry) => A.contains(gates, entry.gate) && O.isNone(skipFor(run, entry.gate))),
    run.resume
  );
  let outcome: GateOutcome = { steps: [], verdicts: [], shadowMisses: [] };
  for (const gate of gates) {
    if (failFast && hasFailure(outcome.steps)) break;
    const next = yield* runGate(run, gate, runner);
    const miss = routeFor(run, gate).pipe(
      O.filter((entry) => entry.decision === "shadow-skipped" && hasFailure(next.steps))
    );
    yield* Effect.forEach(O.toArray(miss), (entry) => reportShadowMiss(run, gate, entry.refinements), {
      discard: true,
    });
    outcome = {
      steps: A.appendAll(outcome.steps, next.steps),
      verdicts: A.appendAll(outcome.verdicts, next.verdicts),
      shadowMisses: A.appendAll(outcome.shadowMisses, O.toArray(miss)),
    };
  }
  return outcome;
});

/**
 * Exercise the sequential final-check gate runner with controlled subprocess plans.
 *
 * **Example** (Run an empty controlled plan)
 *
 * ```ts
 * import { runFinalCheckGatesForTesting } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 * const run = { repoRoot: "/repo", mergeBase: "base", planned: [], skips: [], resume: true }
 * console.log(Effect.isEffect(runFinalCheckGatesForTesting(run, [], false))) // true
 * ```
 *
 * @category testing
 * @since 0.0.0
 */
export const runFinalCheckGatesForTesting = runGates;

// Untracked, non-ignored files count: the gates read them (check typechecks
// every file), so a receipt for the committed head cannot cover them.
const dirtyTree = Effect.fn("Yeet.finalCheckDirtyTree")(function* (repoRoot: string) {
  const git = yield* Git;
  const entries = yield* git
    .status(repoRoot, { untrackedFiles: "all" })
    .pipe(Effect.mapError(yeetGitKitError(GitCommand.status({ untrackedFiles: "all" }))));
  return A.isReadonlyArrayNonEmpty(entries);
});

const refuseDirtyTree = Effect.fn("Yeet.refuseDirtyFinalCheckTree")(function* (repoRoot: string) {
  if (yield* dirtyTree(repoRoot)) {
    return yield* YeetCommandError.make({
      message:
        "yeet final-check refused: the tree has uncommitted changes or untracked files; commit or remove them first, the receipt pins the committed head.",
      exitCode: 2,
    });
  }
});

// The gates run for tens of minutes against the working tree. A commit or an
// uncommitted edit landing meanwhile (another session, an editor save) means
// they checked bytes the pinned head does not hold, so no receipt is written.
const refuseMovedTree = Effect.fn("Yeet.refuseMovedFinalCheckTree")(function* (repoRoot: string, headSha: string) {
  const liveHead = yield* resolveYeetRev(repoRoot, "HEAD");
  if (liveHead !== headSha || (yield* dirtyTree(repoRoot))) {
    return yield* YeetCommandError.make({
      message: `yeet final-check refused: the checkout changed while the gates ran (head ${Str.slice(0, 12)(headSha)} -> ${Str.slice(0, 12)(liveHead)}, or uncommitted edits or untracked files); no receipt was written. Commit, then re-run \`${YEET_FINAL_CHECK_COMMAND}\`.`,
      exitCode: 2,
    });
  }
});

const failedLabels = (steps: ReadonlyArray<FinalCheckStepResult>): string =>
  A.join(
    A.map(A.filter(steps, isFailedStep), (step) => step.label),
    ", "
  );

// One journal lane per receipt step: the phase is the gate family, and a
// resumed step that reused its proof reads `reused`, as in a Yeet verdict.
const finalCheckVerdictLane = (step: FinalCheckStepResult): YeetVerdictLane =>
  YeetVerdictLane.make({
    id: step.label,
    label: step.label,
    phase: step.gate,
    status: step.status === "passed" && step.reason === FINAL_CHECK_REUSED_STEP_REASON ? "reused" : step.status,
    durationMs: step.durationMs,
  });

type FinalCheckFailureFacts = Pick<YeetVerdict, "failureKind" | "failedStepId">;

// A written receipt means a gate went red (`step-exit`, naming the first failed
// step); none means the run refused or failed before it wrote one.
const finalCheckFailureFacts = (written: O.Option<FinalCheckReceipt>): FinalCheckFailureFacts =>
  O.match(written, {
    onNone: () => ({ failureKind: YeetFailureKind.Enum["handler-error"] }),
    onSome: (receipt) => ({
      failureKind: YeetFailureKind.Enum["step-exit"],
      ...O.getSomesStruct({ failedStepId: O.map(A.findFirst(receipt.steps, isFailedStep), (step) => step.label) }),
    }),
  });

/**
 * Build the terminal attempt-journal row for one `yeet final-check` run.
 *
 * **Details**
 *
 * A run that returned its passing receipt, or failed through the command
 * error channel, ends in an `attempt-finished` row. Its verdict has mode
 * {@link FINAL_CHECK_ATTEMPT_MODE} and one lane per step (phase = gate). A
 * failure after the receipt was written, a red gate, is a `step-exit` failure
 * naming the first failed step; one before it (the tree moved, the receipt
 * could not be written) is a `handler-error` and carries no receipt. The
 * written receipt rides the row as `finalCheckReceipt`. An interrupt ends in
 * `attempt-terminated` with reason `interrupted`, a defect with
 * `unrecorded-failure`; neither carries a verdict.
 *
 * **Example** (Journal an interrupted run)
 *
 * ```ts
 * import { FINAL_CHECK_ATTEMPT_MODE, finalCheckAttemptTerminal, YeetAttemptStarted } from "@beep/repo-cli/test/Yeet"
 * import { UUID } from "@beep/repo-cli/test/SharedInternals"
 * import * as Exit from "effect/Exit"
 * import * as O from "effect/Option"
 *
 * const attempt = YeetAttemptStarted.make({
 *   schemaVersion: "yeet-attempt-journal/v1",
 *   _tag: "attempt-started",
 *   attemptId: UUID.make("7c9f5b1e-2d4a-4f6b-9a8c-1e2d3f4a5b6c"),
 *   runId: "feature-0123456789ab",
 *   branch: "feature",
 *   base: "origin/main",
 *   head: "a".repeat(40),
 *   mode: FINAL_CHECK_ATTEMPT_MODE,
 *   startedAt: "2026-11-12T00:00:00.000Z",
 * })
 * const row = finalCheckAttemptTerminal({
 *   attempt,
 *   exit: Exit.interrupt(),
 *   steps: [],
 *   receipt: O.none(),
 *   recordedAt: "2026-11-12T00:05:00.000Z",
 *   elapsedMs: 300_000,
 *   failFast: false,
 * })
 * console.log(row._tag) // "attempt-terminated"
 * ```
 *
 * @param input - The started row, how the run ended, the steps and receipt it
 *   recorded before it ended, the end instant, the elapsed time and the
 *   `--fail-fast` flag.
 * @returns The `attempt-finished` or `attempt-terminated` row for the journal.
 * @category utilities
 * @since 0.0.0
 */
export const finalCheckAttemptTerminal = ({
  attempt,
  exit,
  steps,
  receipt,
  recordedAt,
  elapsedMs,
  failFast,
}: {
  readonly attempt: YeetAttemptStarted;
  readonly exit: Exit.Exit<FinalCheckReceipt, YeetCommandError>;
  readonly steps: ReadonlyArray<FinalCheckStepResult>;
  readonly receipt: O.Option<FinalCheckReceipt>;
  readonly recordedAt: string;
  readonly elapsedMs: number;
  readonly failFast: boolean;
}): YeetAttemptFinished | YeetAttemptTerminated => {
  const finished = (
    written: O.Option<FinalCheckReceipt>,
    ran: ReadonlyArray<FinalCheckStepResult>,
    outcome: YeetVerdict["outcome"],
    message: string,
    failure: FinalCheckFailureFacts
  ) =>
    YeetAttemptFinished.make({
      schemaVersion: "yeet-attempt-journal/v1",
      _tag: "attempt-finished",
      attemptId: attempt.attemptId,
      recordedAt,
      verdict: YeetVerdict.make({
        schemaVersion: "yeet-verdict/v2",
        attemptId: O.some(attempt.attemptId),
        base: attempt.base,
        branch: attempt.branch,
        committed: false,
        createdAt: recordedAt,
        failurePolicy: failFast ? "fail-fast" : "collect-all",
        head: attempt.head,
        lanes: A.map(ran, finalCheckVerdictLane),
        message,
        mode: attempt.mode,
        outcome,
        packetPaths: [],
        pushed: false,
        runId: attempt.runId,
        resolvedHeadSha: attempt.resolvedHeadSha,
        startedAt: O.some(attempt.startedAt),
        endedAt: O.some(recordedAt),
        elapsedMs: O.some(elapsedMs),
        ...failure,
      }),
      resolvedHeadSha: attempt.resolvedHeadSha,
      envProfile: attempt.envProfile,
      computeProfile: attempt.computeProfile,
      finalCheckReceipt: written,
    });
  const terminated = (reason: YeetAttemptTerminated["reason"]) =>
    YeetAttemptTerminated.make({
      schemaVersion: "yeet-attempt-journal/v1",
      _tag: "attempt-terminated",
      attemptId: attempt.attemptId,
      recordedAt,
      reason,
      resolvedHeadSha: attempt.resolvedHeadSha,
      envProfile: attempt.envProfile,
      computeProfile: attempt.computeProfile,
    });
  return Exit.match(exit, {
    onSuccess: (written) => finished(O.some(written), written.steps, "success", `yeet ${receiptHeadline(written)}`, {}),
    onFailure: (cause) =>
      O.match(Cause.findErrorOption(cause), {
        onSome: (error) => finished(receipt, steps, "failure", error.message, finalCheckFailureFacts(receipt)),
        onNone: () => terminated(Cause.hasInterruptsOnly(cause) ? "interrupted" : "unrecorded-failure"),
      }),
  });
};

// What a run recorded before it ended: the steps once the gates ran, and the
// receipt once it was written.
type FinalCheckRan = {
  readonly steps: ReadonlyArray<FinalCheckStepResult>;
  readonly receipt: O.Option<FinalCheckReceipt>;
};

type OpenFinalCheckAttempt = {
  readonly attempt: YeetAttemptStarted;
  readonly branch: string;
  readonly startedMillis: number;
};

// The journal is measurement: a row that cannot be written is reported and
// never fails, delays or changes the run, its receipt or its exit.
const reportJournalFailure = (error: YeetCommandError) =>
  Console.error(`[yeet] final-check attempt journal not written: ${error.message}`);

// The run's start row, in the branch journal Yeet attempts use. Without it no
// terminal row is written either, so the journal never holds a lone terminal.
const openFinalCheckAttempt = Effect.fn("Yeet.openFinalCheckAttempt")(
  function* (repoRoot: string, options: YeetFinalCheckOptions, headSha: string, computeProfile: ComputeProfile) {
    const branch = yield* currentYeetBranch(repoRoot);
    const now = yield* DateTime.now;
    const attempt = YeetAttemptStarted.make({
      schemaVersion: "yeet-attempt-journal/v1",
      _tag: "attempt-started",
      attemptId: yield* generateYeetAttemptId(),
      runId: yield* repoRunArtifactId(branch),
      branch,
      base: options.base,
      head: headSha,
      mode: FINAL_CHECK_ATTEMPT_MODE,
      startedAt: DateTime.formatIso(now),
      ownerPid: O.some(process.pid),
      ownerProcStart: yield* processStartIdentityForPid(process.pid),
      resolvedHeadSha: O.some(headSha),
      envProfile: O.some("local"),
      computeProfile: O.some(computeProfile),
      forceLocal: options.forceLocal ? O.some(true) : O.none(),
    });
    yield* appendYeetAttemptJournalEventForCheckout(repoRoot, branch, attempt);
    return O.some<OpenFinalCheckAttempt>({ attempt, branch, startedMillis: DateTime.toEpochMillis(now) });
  },
  Effect.catch((error) => reportJournalFailure(error).pipe(Effect.as(O.none<OpenFinalCheckAttempt>())))
);

const closeFinalCheckAttempt = Effect.fn("Yeet.closeFinalCheckAttempt")(function* (
  repoRoot: string,
  open: OpenFinalCheckAttempt,
  ran: Ref.Ref<FinalCheckRan>,
  exit: Exit.Exit<FinalCheckReceipt, YeetCommandError>,
  failFast: boolean
) {
  const now = yield* DateTime.now;
  const { steps, receipt } = yield* Ref.get(ran);
  const row = finalCheckAttemptTerminal({
    attempt: open.attempt,
    exit,
    steps,
    receipt,
    recordedAt: DateTime.formatIso(now),
    elapsedMs: DateTime.toEpochMillis(now) - open.startedMillis,
    failFast,
  });
  yield* appendYeetAttemptJournalEventForCheckout(repoRoot, open.branch, row).pipe(Effect.catch(reportJournalFailure));
});

// A worker run never takes a ticket: each selected gate's routing decision is one admission
// fact, `refusal` when the profile left it to hosted CI and `bypass` when it runs here. Gates an
// operator or the change route skipped were not routed by the profile. Off `worker`, none.
const finalCheckWorkerRoutes = (
  run: FinalCheckRun,
  gates: ReadonlyArray<FinalCheckGate>,
  profileSkips: ReadonlyArray<FinalCheckSkip>,
  profile: ComputeProfile
): ReadonlyArray<readonly [FinalCheckGate, AdmissionRouteOutcome]> =>
  profile === "worker"
    ? A.getSomes(
        A.map(gates, (gate) =>
          A.some(profileSkips, (skip) => skip.gate === gate)
            ? O.some([gate, "refusal"] as const)
            : O.isSome(skipFor(run, gate))
              ? O.none()
              : O.some([gate, "bypass"] as const)
        )
      )
    : [];

// Every skip (operator, compute profile, route) decides before the coverage probe (C5), so a
// skipped coverage gate stays skipped. A forced worker run then re-routes with the probed plan:
// coverage whose plan is not a selected set of packages is refused like a measured gate, and a
// gate the change route skips is never counted as forced.
const routeFinalCheckRun = Effect.fnUntraced(function* (plannedRun: FinalCheckRun, routing: FinalCheckProfileRouting) {
  const probesCoverage = A.contains(routing.gates, "coverage") && O.isNone(skipFor(plannedRun, "coverage"));
  const coverageScope = probesCoverage
    ? yield* resolveFinalCheckCoverageScope(plannedRun.repoRoot, plannedRun.mergeBase)
    : O.none<CoverageAffectedScope>();
  const routeSkipped = A.filter(routing.gates, (gate) => O.isSome(routeSkipFor(plannedRun, gate)));
  const scoped: FinalCheckProfileRouting = { ...routing, routeSkipped, ...(probesCoverage ? { coverageScope } : {}) };
  const profileSkips = computeProfileFinalCheckSkips(scoped);
  const run: FinalCheckRun = {
    ...plannedRun,
    skips: A.appendAll(routing.operatorSkips, profileSkips),
    ...O.getSomesStruct({ coverageScope }),
  };
  return {
    run,
    profileSkips,
    forcedLines: forcedWorkerFinalCheckLines(scoped),
    forced: A.isReadonlyArrayNonEmpty(forcedWorkerGates(scoped)),
    workerRoutes: finalCheckWorkerRoutes(run, routing.gates, profileSkips, routing.profile),
  };
});

/**
 * Route a planned final-check run on its compute profile, as `yeet final-check` does.
 *
 * **Details**
 *
 * Probes the affected coverage plan when coverage is requested and not
 * skipped, then returns the run with its profile skips, the `--force-local`
 * lines, whether any gate is actually forced (the receipt's `forceLocal`)
 * and the worker admission routes. A gate the change route skips is never
 * forced and gets no admission row.
 *
 * **Example** (Build the routing effect)
 *
 * ```ts
 * import { routeFinalCheckRunForTesting } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const run = { repoRoot: "/repo", mergeBase: "base", planned: [], skips: [], resume: false }
 * const routing = { gates: [], operatorSkips: [], profile: "worker" as const, forceLocal: true }
 * console.log(Effect.isEffect(routeFinalCheckRunForTesting(run, routing))) // true
 * ```
 *
 * @param plannedRun - The planned run, its change route included.
 * @param routing - The requested gates, operator skips, profile and `--force-local`.
 * @returns The routed run, its profile skips, forced lines, forced flag and admission routes.
 * @category testing
 * @since 0.0.0
 */
export const routeFinalCheckRunForTesting = routeFinalCheckRun;

// Best effort like the attempt journal: a row that cannot be written warns and changes nothing.
const recordWorkerFinalCheckRoutes = (
  repoRoot: string,
  opened: O.Option<OpenFinalCheckAttempt>,
  routes: ReadonlyArray<readonly [FinalCheckGate, AdmissionRouteOutcome]>,
  forceLocal: boolean
) =>
  A.match(routes, {
    onEmpty: () => Effect.void,
    onNonEmpty: Effect.fnUntraced(function* (decided) {
      const scheduler = yield* QualityScheduler;
      const branch = yield* currentYeetBranch(repoRoot).pipe(Effect.orElseSucceed(constant("")));
      yield* Effect.forEach(
        decided,
        ([gate, outcome]) =>
          scheduler.recordRoute(
            AdmissionRoute.make({
              checkoutRoot: repoRoot,
              branch,
              command: YEET_FINAL_CHECK_COMMAND,
              attemptId: O.map(opened, (open) => open.attempt.attemptId),
              envProfile: O.some("local"),
              computeProfile: "worker",
              forceLocal,
              gateRoute: O.some(gate),
              outcome,
            })
          ),
        { discard: true }
      );
    }),
  });

/**
 * Run `yeet final-check` on the committed head and write its receipt.
 *
 * **Details**
 *
 * Refuses a dirty tree, because the receipt pins the committed head, and
 * re-reads HEAD and the tree after the gates: a commit or uncommitted edit
 * that landed during the run means no receipt is written. Gates run
 * in {@link FinalCheckGate} order; every gate runs unless `--fail-fast` stops
 * after the first red. A `--gates` subset (fewer than every gate) writes its
 * receipt, marked incomplete, to a file of its own under
 * {@link FINAL_CHECK_SUBSET_RECEIPT_DIR} and leaves the head receipt as it
 * was: a complete receipt already on the head still admits `yeet ready`, the
 * subset receipt never does, and a later subset run on the head keeps it.
 * A full run writes the head receipt. `--dry-run` prints the plan and runs
 * nothing.
 *
 * A run past the dirty-tree refusal appends a start row and a terminal row
 * ({@link finalCheckAttemptTerminal}) to the branch attempt journal. A journal
 * that cannot be written is reported on stderr and changes nothing else.
 *
 * **Example** (Build the command effect)
 *
 * ```ts
 * import { runYeetFinalCheck, YeetFinalCheckOptions } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const options = YeetFinalCheckOptions.make({ base: "origin/main", gates: [], skip: [], dryRun: true, failFast: false })
 * console.log(Effect.isEffect(runYeetFinalCheck(options))) // true
 * ```
 *
 * @param options - Base ref, gate subset, recorded skips, dry run and fail-fast flags.
 * @returns The receipt the run wrote (the head receipt, or a subset run's own
 * file); fails when the verdict is not pass.
 * @category use-cases
 * @since 0.0.0
 */
export const runYeetFinalCheck = Effect.fn("Yeet.runYeetFinalCheck")(function* (
  options: YeetFinalCheckOptions
): Effect.fn.Return<
  O.Option<FinalCheckReceipt>,
  YeetCommandError,
  | SecureRandom.SecureRandom
  | Digest.Digest
  | FileSystem.FileSystem
  | Path.Path
  | ChildProcessSpawner.ChildProcessSpawner
  | Git
  | QualityScheduler
> {
  const repoRoot = yield* findRepoRoot().pipe(Effect.mapError(YeetCommandError.new("Failed to locate repo root.")));
  const gates = yield* parseFinalCheckGates(options.gates);
  const operatorSkips = yield* parseFinalCheckSkips(options.skip);
  // Resolved once per run: the profile decides which gates defer to hosted CI.
  const { computeProfile, profileSkips } = yield* resolveFinalCheckProfileSkips(
    gates,
    operatorSkips,
    options.forceLocal
  );
  const skips = A.appendAll(operatorSkips, profileSkips);
  const headSha = yield* resolveYeetRev(repoRoot, "HEAD");
  const mergeBase = yield* resolveYeetMergeBase(repoRoot, options.base, "HEAD");
  const changedFiles = yield* changedYeetPaths(
    repoRoot,
    YeetChangedPathsQuery.make({ base: mergeBase, head: "HEAD", diffFilter: "d" })
  );
  const fullPolicySweeps =
    A.contains(gates, "lint-policy") && !A.some(skips, (skip) => skip.gate === "lint-policy")
      ? yield* resolveFullLintPolicySweeps(repoRoot, mergeBase)
      : O.none<LintPolicySweeps>();
  const route = yield* Effect.scopedWith((scope) =>
    Layer.buildWithScope(ChangeClassifierLive, scope).pipe(
      Effect.flatMap((context) =>
        collectFinalCheckRoute(repoRoot, mergeBase, headSha).pipe(Effect.provideContext(context))
      )
    )
  );
  const plannedRun: FinalCheckRun = {
    repoRoot,
    mergeBase,
    planned: routeFinalCheckStepsForProfile({
      planned: planFinalCheckSteps(repoRoot, mergeBase, changedFiles, O.getOrUndefined(fullPolicySweeps)),
      profile: computeProfile,
      forceLocal: options.forceLocal,
      changedFiles,
    }),
    skips,
    resume: options.resume,
    route,
    headSha,
  };
  // The probe runs before `--dry-run` returns, so the plan matches.
  const {
    run,
    profileSkips: routedSkips,
    forcedLines,
    forced,
    workerRoutes,
  } = yield* routeFinalCheckRun(plannedRun, {
    gates,
    operatorSkips,
    profile: computeProfile,
    forceLocal: options.forceLocal,
  });

  if (options.dryRun) {
    yield* Console.log(
      `[yeet] final-check plan for ${Str.slice(0, 12)(headSha)} (merge base ${Str.slice(0, 12)(mergeBase)}):`
    );
    yield* Effect.forEach(gates, (gate) => printGatePlan(run, gate), { discard: true });
    yield* printProfileSkips(routedSkips);
    yield* Effect.forEach(forcedLines, (line) => Console.log(line), { discard: true });
    return O.none();
  }

  yield* refuseDirtyTree(repoRoot);
  const ran = yield* Ref.make<FinalCheckRan>({ steps: [], receipt: O.none() });
  const execute = Effect.gen(function* () {
    const startedAt = yield* nowIso;
    yield* Effect.forEach(forcedLines, (line) => Console.log(line), { discard: true });
    const { steps, verdicts, shadowMisses } = yield* runGates(run, gates, options.failFast);
    yield* Ref.set(ran, { steps, receipt: O.none() });
    yield* refuseMovedTree(repoRoot, headSha);
    const ranGates = A.dedupe(A.map(steps, (step) => step.gate));
    const receipt = FinalCheckReceipt.make({
      schemaVersion: FINAL_CHECK_RECEIPT_VERSION,
      gateSetDigest: FINAL_CHECK_GATE_SET_DIGEST,
      headSha,
      mergeBase,
      base: options.base,
      complete: A.every(FinalCheckGate.literals, (gate) => A.contains(ranGates, gate)),
      verdict: hasFailure(steps) ? "fail" : "pass",
      startedAt,
      finishedAt: yield* nowIso,
      steps,
      expectationRewrites: verdicts,
      route: FinalCheckRoute.make({ ...route, shadowMisses }),
      computeProfile,
      forceLocal: forced,
    });
    const file = yield* writeReceipt(repoRoot, receipt, isGateSubset(gates));
    yield* Ref.set(ran, { steps, receipt: O.some(receipt) });
    yield* Console.log(renderSummary(receipt));
    yield* printProfileSkips(routedSkips);
    yield* Console.log(`[yeet] final-check receipt: ${file}`);
    if (receipt.verdict === "fail") {
      return yield* YeetCommandError.make({
        message: `yeet final-check failed: ${failedLabels(steps)}. These gates red hosted CI too; fix them before calling the pull request final.`,
        exitCode: 1,
      });
    }
    return receipt;
  });
  // The run is journaled as one attempt; the head receipt above stays the only
  // thing `yeet ready` reads.
  const receipt = yield* Effect.acquireUseRelease(
    openFinalCheckAttempt(repoRoot, options, headSha, computeProfile),
    (opened) =>
      recordWorkerFinalCheckRoutes(repoRoot, opened, workerRoutes, options.forceLocal).pipe(Effect.andThen(execute)),
    (opened, exit) =>
      O.match(opened, {
        onNone: constant(Effect.void),
        onSome: (open) => closeFinalCheckAttempt(repoRoot, open, ran, exit, options.failFast),
      })
  );
  return O.some(receipt);
});
