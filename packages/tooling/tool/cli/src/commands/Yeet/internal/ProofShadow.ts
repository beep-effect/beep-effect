import { $RepoCliId } from "@beep/identity/packages";
import { FsUtilsLive, findRepoRoot } from "@beep/repo-utils";
import { Console, DateTime, Duration, Effect, FileSystem, Layer, pipe } from "effect";
import * as A from "effect/Array";
import { constFalse, dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as MutableHashMap from "effect/MutableHashMap";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runRepoCommandCapture } from "../../../internal/repo-run/index.ts";
import { ProofEnvProfile, ProofStage, YeetProofTier } from "../../../internal/repo-run/QualityScheduler.schemas.ts";
import { JsonStringCodec } from "../../../internal/schema/JsonCodec.ts";
import { changedPackageNamesForPaths, collectWorkspaces } from "../../Quality/internal/PackageVerify.ts";
import { GithubCheckLaneRunStatus } from "../../Quality/Quality.schemas.ts";
import { YeetCommandError } from "../Yeet.errors.ts";
import { proofLedgerPathForCheckout } from "./ArtifactPaths.ts";
import { collectProofEpoch, proofCommandDigest, proofInputKey } from "./ProofDigest.ts";
import {
  PROOF_FACT_SCHEMA_VERSION,
  ProofFact,
  ProofInputDigest,
  ProofInputSource,
  ProofLedgerFactRow,
  ProofLedgerShadowRow,
  ProofMissReason,
  ProofOutcome,
  ProofProvenance,
  ProofReuseHit,
  ProofReuseMiss,
} from "./ProofFact.ts";
import { ProofLedger } from "./ProofLedger.ts";
import { captureRepoCommandStrict, readYeetChangedPathsStrict } from "./Settle.ts";
import type { Crypto, Path } from "effect";
import type { ChildProcessSpawner } from "effect/process";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";
import type { QualityTaskLaneRun, QualityTaskLaneRunReport } from "../../Quality/Quality.schemas.ts";
import type { YeetAttemptStarted } from "./AttemptJournal.ts";
import type { ProofEpoch, ProofReuseDecision } from "./ProofFact.ts";
import type { ProofChangedPackageTripwire } from "./ProofLedger.ts";

const $I = $RepoCliId.create("commands/Yeet/internal/ProofShadow");

/**
 * Schema version of the shadow disagreement report.
 *
 * @category constants
 * @since 0.0.0
 */
export const PROOF_SHADOW_REPORT_SCHEMA_VERSION = "proof-shadow-report/v1";

/**
 * How long a recorded fact stays reusable before it expires (orchestrator
 * default recorded with the C1 rulings: the remote cache's lifecycle).
 *
 * @category constants
 * @since 0.0.0
 */
export const PROOF_FACT_TTL = Duration.days(30);

/**
 * Placeholder input digest for a lane that declared no inputs; the reuse key
 * still needs a non-empty digest, and `inputSource: "undeclared"` makes the
 * ledger refuse to reuse it (ruling 1).
 *
 * @category constants
 * @since 0.0.0
 */
export const UNDECLARED_INPUT_DIGEST = "undeclared";

// Plain non-negative integer counts: the report is derived, never decoded from
// operator input, so an unbranded count keeps the builders free of brand casts.
const ProofCount = S.Int.check(S.isGreaterThanOrEqualTo(0));

const isHit = S.is(ProofReuseHit);
const isMiss = S.is(ProofReuseMiss);
const isPassed = ProofOutcome.is.passed;

/**
 * The event-count bar shadow mode must clear before the attempt-to-attempt
 * pair is enforced (ruling 7).
 *
 * **Example** (Read the ratified bar)
 *
 * ```ts
 * import { ProofShadowEnforcementBar } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(ProofShadowEnforcementBar.ratified.attempts) // 200
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofShadowEnforcementBar extends S.Class<ProofShadowEnforcementBar>($I`ProofShadowEnforcementBar`)(
  {
    attempts: ProofCount,
    branches: ProofCount,
    disagreements: ProofCount,
  },
  $I.annote("ProofShadowEnforcementBar", {
    description:
      "Minimum attempts and distinct branches, and the maximum disagreements, shadow mode must record before enforcement.",
  })
) {
  static readonly ratified = ProofShadowEnforcementBar.make({ attempts: 200, branches: 10, disagreements: 0 });
}

/**
 * One shadow disagreement: the ledger would have reused a passed fact, and the
 * lane failed when it actually ran.
 *
 * **Example** (Construct a disagreement row)
 *
 * ```ts
 * import { ProofShadowDisagreement } from "@beep/repo-cli/test/Yeet"
 *
 * const row = ProofShadowDisagreement.make({
 *   attemptId: "attempt-1",
 *   laneId: "quality:coverage",
 *   branch: "feat/example",
 *   stage: "pre-push",
 *   key: "k3",
 *   recordedAt: "2026-09-03T12:05:00.000Z",
 * })
 * console.log(row.laneId) // "quality:coverage"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofShadowDisagreement extends S.Class<ProofShadowDisagreement>($I`ProofShadowDisagreement`)(
  {
    attemptId: S.NonEmptyString,
    laneId: S.NonEmptyString,
    branch: S.NonEmptyString,
    stage: ProofStage,
    key: S.NonEmptyString,
    recordedAt: S.NonEmptyString,
  },
  $I.annote("ProofShadowDisagreement", {
    description: "A lane the ledger would have reused that failed when it actually ran.",
  })
) {}

/**
 * How many shadow lookups missed for one reason.
 *
 * @category models
 * @since 0.0.0
 */
export class ProofShadowMissCount extends S.Class<ProofShadowMissCount>($I`ProofShadowMissCount`)(
  {
    reason: ProofMissReason,
    count: ProofCount,
  },
  $I.annote("ProofShadowMissCount", {
    description: "Shadow lookups that missed for one reuse-miss reason.",
  })
) {}

/**
 * The shadow disagreement report `yeet proof-report` prints (ruling 64).
 *
 * **Details**
 *
 * Every count comes from the checkout's proof ledger alone: `attempts` and
 * `branches` are distinct attempt ids and branches across all shadow rows,
 * `wouldReuse` is the hit decisions, `reusableMs` is the observed duration of
 * the hits whose lane passed (the time enforcement would have saved). The bar
 * is judged on the first enforced pair only (ruling 2): `barAttempts`,
 * `barBranches` and `barDisagreements` count the rows whose stage and env
 * profile equal `barStage` / `barEnvProfile`, and `enforcementReady` is the
 * ratified bar applied to those, so merged-preview rows can never flip the
 * pre-push gate.
 *
 * **Example** (Recognise a not-ready report)
 *
 * ```ts
 * import { ProofShadowEnforcementBar, ProofShadowReport } from "@beep/repo-cli/test/Yeet"
 *
 * const report = ProofShadowReport.make({
 *   schemaVersion: "proof-shadow-report/v1",
 *   generatedAt: "2026-09-21T00:00:00.000Z",
 *   ledgerPath: "/repo/.beep/yeet/proof-ledger.ndjson",
 *   shadowRows: 0,
 *   attempts: 0,
 *   branches: 0,
 *   wouldReuse: 0,
 *   reusableMs: 0,
 *   misses: [],
 *   disagreements: [],
 *   facts: 0,
 *   expiredFacts: 0,
 *   malformedRows: 0,
 *   bar: ProofShadowEnforcementBar.ratified,
 *   barStage: "pre-push",
 *   barEnvProfile: "local",
 *   barAttempts: 0,
 *   barBranches: 0,
 *   barDisagreements: 0,
 *   enforcementReady: false,
 * })
 * console.log(report.enforcementReady) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofShadowReport extends S.Class<ProofShadowReport>($I`ProofShadowReport`)(
  {
    schemaVersion: S.Literal(PROOF_SHADOW_REPORT_SCHEMA_VERSION),
    generatedAt: S.NonEmptyString,
    ledgerPath: S.NonEmptyString,
    shadowRows: ProofCount,
    attempts: ProofCount,
    branches: ProofCount,
    wouldReuse: ProofCount,
    reusableMs: S.Finite.check(S.isGreaterThanOrEqualTo(0)),
    misses: S.Array(ProofShadowMissCount),
    disagreements: S.Array(ProofShadowDisagreement),
    facts: ProofCount,
    expiredFacts: ProofCount,
    malformedRows: ProofCount,
    bar: ProofShadowEnforcementBar,
    barStage: ProofStage,
    barEnvProfile: ProofEnvProfile,
    barAttempts: ProofCount,
    barBranches: ProofCount,
    barDisagreements: ProofCount,
    enforcementReady: S.Boolean,
  },
  $I.annote("ProofShadowReport", {
    description:
      "Shadow-mode disagreement report: sample size, would-have-reused decisions, misses by reason, disagreements, ledger health, and the enforcement bar verdict over the first enforced pair's stage and env profile.",
  })
) {}

/**
 * JSON codec for {@link ProofShadowReport}.
 *
 * @category codecs
 * @since 0.0.0
 */
export const ProofShadowReportJson = JsonStringCodec(ProofShadowReport);

/**
 * What one attempt's shadow pass recorded.
 *
 * **Example** (An attempt with nothing to shadow)
 *
 * ```ts
 * import { ProofShadowAttemptSummary } from "@beep/repo-cli/test/Yeet"
 *
 * const summary = ProofShadowAttemptSummary.make({
 *   attemptId: "attempt-1",
 *   recorded: 0,
 *   wouldReuse: 0,
 *   disagreements: 0,
 *   undeclared: 0,
 * })
 * console.log(summary.recorded) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofShadowAttemptSummary extends S.Class<ProofShadowAttemptSummary>($I`ProofShadowAttemptSummary`)(
  {
    attemptId: S.NonEmptyString,
    recorded: ProofCount,
    wouldReuse: ProofCount,
    disagreements: ProofCount,
    undeclared: ProofCount,
    tripped: ProofCount.pipe(S.withConstructorDefault(Effect.succeed(0))),
  },
  $I.annote("ProofShadowAttemptSummary", {
    description: "Lanes shadowed for one attempt, how many the ledger would have reused, and how many disagreed.",
  })
) {}

/**
 * Attempt facts the shadow pass needs, resolved from the attempt-started row.
 *
 * **Example** (Describe a pre-push attempt)
 *
 * ```ts
 * import { ProofShadowAttemptFacts } from "@beep/repo-cli/test/Yeet"
 *
 * const facts = ProofShadowAttemptFacts.make({
 *   attemptId: "attempt-1",
 *   runId: "run-1",
 *   branch: "feat/example",
 *   headSha: "88fa371cb0",
 *   tier: "full",
 *   stage: "pre-push",
 *   envProfile: "local",
 * })
 * console.log(facts.stage) // "pre-push"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofShadowAttemptFacts extends S.Class<ProofShadowAttemptFacts>($I`ProofShadowAttemptFacts`)(
  {
    attemptId: S.NonEmptyString,
    runId: S.NonEmptyString,
    branch: S.NonEmptyString,
    headSha: S.NonEmptyString,
    tier: YeetProofTier,
    stage: ProofStage,
    envProfile: ProofEnvProfile,
  },
  $I.annote("ProofShadowAttemptFacts", {
    description: "Attempt identity, branch, head, tier, stage and env profile the shadow pass records against.",
  })
) {}

/**
 * Resolve the shadow pass inputs from an attempt-started journal row.
 *
 * **Details**
 *
 * Missing optional facts fall back to the pre-push defaults the planner uses
 * (`full` tier, `pre-push` stage, `local` profile); the resolved head SHA wins
 * over the symbolic head when it was recorded.
 *
 * **Example** (Resolve facts from an attempt row)
 *
 * ```ts
 * import { proofShadowAttemptFacts, YeetAttemptStarted } from "@beep/repo-cli/test/Yeet"
 * import { UUID } from "@beep/schema/String"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const facts = proofShadowAttemptFacts(
 *   YeetAttemptStarted.make({
 *     schemaVersion: "yeet-attempt-journal/v1",
 *     _tag: "attempt-started",
 *     attemptId: S.decodeSync(UUID)("7c9f5b1e-2d4a-4f6b-9a8c-1e2d3f4a5b6c"),
 *     runId: "run-1",
 *     branch: "feat/example",
 *     base: "main",
 *     head: "feat/example",
 *     mode: "verify",
 *     startedAt: "2026-09-21T00:00:00.000Z",
 *     resolvedHeadSha: O.some("88fa371cb0"),
 *   })
 * )
 * console.log(facts.headSha) // "88fa371cb0"
 * ```
 *
 * @param attempt - The attempt-started journal row of the running attempt.
 * @returns The facts the shadow pass records, with pre-push defaults filled in.
 * @category utilities
 * @since 0.0.0
 */
export const proofShadowAttemptFacts = (attempt: YeetAttemptStarted): ProofShadowAttemptFacts =>
  ProofShadowAttemptFacts.make({
    attemptId: attempt.attemptId,
    runId: attempt.runId,
    branch: attempt.branch,
    headSha: O.getOrElse(attempt.resolvedHeadSha, () => attempt.head),
    tier: O.getOrElse(attempt.proofTier, () => "full" as const),
    stage: O.getOrElse(attempt.stage, () => "pre-push" as const),
    envProfile: O.getOrElse(attempt.envProfile, () => "local" as const),
  });

/**
 * The workspace packages an attempt's change touches.
 *
 * **Example** (Two packages across three paths)
 *
 * ```ts
 * import { ProofChangedPackagesKnown } from "@beep/repo-cli/test/Yeet"
 *
 * const changed = ProofChangedPackagesKnown.make({
 *   kind: "known",
 *   packages: ["@beep/x", "@beep/y"],
 *   paths: 3,
 * })
 * console.log(changed.packages.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofChangedPackagesKnown extends S.Class<ProofChangedPackagesKnown>($I`ProofChangedPackagesKnown`)(
  {
    kind: S.tag("known"),
    packages: S.Array(S.String),
    paths: ProofCount,
  },
  $I.annote("ProofChangedPackagesKnown", {
    description: "Workspace packages an attempt's changed paths touch, with how many paths were mapped.",
  })
) {}

/**
 * The attempt's changed packages could not be read.
 *
 * **Example** (A failed workspace read)
 *
 * ```ts
 * import { ProofChangedPackagesUnavailable } from "@beep/repo-cli/test/Yeet"
 *
 * const changed = ProofChangedPackagesUnavailable.make({
 *   kind: "unavailable",
 *   reason: "the workspace list could not be read",
 * })
 * console.log(changed.kind) // "unavailable"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofChangedPackagesUnavailable extends S.Class<ProofChangedPackagesUnavailable>(
  $I`ProofChangedPackagesUnavailable`
)(
  {
    kind: S.tag("unavailable"),
    reason: S.NonEmptyString,
  },
  $I.annote("ProofChangedPackagesUnavailable", {
    description: "Why an attempt's changed package set could not be read.",
  })
) {}

/**
 * What the shadow pass knows about the packages an attempt's change touches.
 *
 * **Details**
 *
 * The two states decide the changed-package tripwire's answer for a lane whose
 * package scope is non-empty (ruling 70): `known` fires only on a real
 * intersection, and `unavailable` fires for every scoped lane, because a
 * changed set that could not be read is not evidence that nothing changed. A
 * lane with an empty scope — a root-task-only lane — is decided by its digest
 * alone in both states.
 *
 * **Example** (Match on what is known)
 *
 * ```ts
 * import { ProofChangedPackages, ProofChangedPackagesKnown } from "@beep/repo-cli/test/Yeet"
 *
 * const line = ProofChangedPackages.match(
 *   ProofChangedPackagesKnown.make({ kind: "known", packages: ["@beep/x"], paths: 1 }),
 *   {
 *     known: (changed) => `${changed.packages.length} package(s)`,
 *     unavailable: (changed) => changed.reason,
 *   }
 * )
 * console.log(line) // "1 package(s)"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ProofChangedPackages = S.Union([ProofChangedPackagesKnown, ProofChangedPackagesUnavailable]).pipe(
  $I.annoteSchema("ProofChangedPackages", {
    description: "The workspace packages an attempt's change touches, or why they could not be read.",
  }),
  S.toTaggedUnion("kind")
);

/**
 * {@inheritDoc ProofChangedPackages}
 *
 * @category type-level
 * @since 0.0.0
 */
export type ProofChangedPackages = typeof ProofChangedPackages.Type;

// `git status --porcelain=v1 -z` writes `XY <path>\0` per entry, and for a rename
// or copy the original path follows as the next NUL-separated token.
const PORCELAIN_RENAME_CODES = ["R", "C"];

const porcelainEntryPath = (entry: string): string => Str.slice(3)(entry);

const isPorcelainEntry = (entry: string): boolean =>
  Str.length(entry) > 3 && Str.Equivalence(Str.slice(2, 3)(entry), " ");

const isPorcelainRenameEntry = (entry: string): boolean =>
  A.some(PORCELAIN_RENAME_CODES, (code) => pipe(Str.slice(0, 2)(entry), Str.includes(code)));

type PorcelainScan = {
  readonly paths: ReadonlyArray<string>;
  readonly expectOriginalPath: boolean;
};

const scanPorcelainToken = (scan: PorcelainScan, token: string): PorcelainScan => {
  if (scan.expectOriginalPath) {
    return { paths: A.append(scan.paths, token), expectOriginalPath: false };
  }
  return isPorcelainEntry(token)
    ? { paths: A.append(scan.paths, porcelainEntryPath(token)), expectOriginalPath: isPorcelainRenameEntry(token) }
    : { paths: scan.paths, expectOriginalPath: false };
};

/**
 * Every path `git status --porcelain=v1 -z --untracked-files=all` reports.
 *
 * **Details**
 *
 * Entries are NUL-separated rather than newline-separated, so a path carrying
 * a space, a quote or a newline survives verbatim. A rename or copy entry is
 * followed by its original path as the next token, and both sides are kept:
 * the attempt verified the tree where the new path exists and the old one does
 * not, and both may belong to packages the lanes covered. Ignored files never
 * appear, because the read does not pass `--ignored`.
 *
 * **Example** (A modified file and a staged rename)
 *
 * ```ts
 * import { porcelainChangedPaths } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(
 *   porcelainChangedPaths(" M packages/x/src/a.ts\0R  packages/x/src/c.ts\0packages/x/src/b.ts\0")
 * ) // [ 'packages/x/src/a.ts', 'packages/x/src/c.ts', 'packages/x/src/b.ts' ]
 * ```
 *
 * @param output - The raw `git status --porcelain=v1 -z` capture.
 * @returns The repo-relative paths the status reports, in entry order, both sides of a rename.
 * @category utilities
 * @since 0.0.0
 */
export const porcelainChangedPaths = (output: string): ReadonlyArray<string> =>
  A.reduce(
    A.filter(Str.split(output, "\0"), Str.isNonEmpty),
    { paths: A.empty<string>(), expectOriginalPath: false },
    scanPorcelainToken
  ).paths;

const WORKTREE_STATUS_ARGS = ["status", "--porcelain=v1", "-z", "--untracked-files=all"];

const readWorktreeChangedPaths = Effect.fn("Yeet.ProofShadow.readWorktreeChangedPaths")(function* (
  context: RepoRunContext,
  capture: typeof runRepoCommandCapture
): Effect.fn.Return<ReadonlyArray<string>, YeetCommandError, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
  const output = yield* captureRepoCommandStrict({
    repoRoot: context.repoRoot,
    command: "git",
    args: WORKTREE_STATUS_ARGS,
    onSpawnFailure: `Failed to read the working-tree status of ${context.repoRoot}.`,
    capture,
  });
  return porcelainChangedPaths(output);
});

const readChangedPackages = Effect.fn("Yeet.ProofShadow.readChangedPackages")(function* (
  context: RepoRunContext,
  capture: typeof runRepoCommandCapture
): Effect.fn.Return<
  ProofChangedPackages,
  YeetCommandError,
  Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> {
  const fs = yield* FileSystem.FileSystem;
  // The workspace reader canonicalises every directory it returns, so the root
  // the changed paths resolve against has to be canonical too: a checkout
  // reached through a symlink would otherwise compare symlinked paths against
  // canonical workspace directories, match nothing, and read as "no package
  // changed" — a silent fail-open for every lane.
  const repoRoot = yield* fs
    .realPath(context.repoRoot)
    .pipe(Effect.mapError(YeetCommandError.new(`Failed to resolve the checkout path ${context.repoRoot}.`)));
  // `FsUtils` is a layer the CLI builds at its entry point, but the verdict
  // writer's requirement set is fixed by its callers; build it for this one
  // workspace read and let the scope discard it, so nothing upstream widens.
  const workspaces = yield* Effect.scoped(
    Layer.build(FsUtilsLive).pipe(
      Effect.flatMap((fsUtils) => collectWorkspaces(repoRoot).pipe(Effect.provide(fsUtils)))
    )
  ).pipe(Effect.mapError(YeetCommandError.new("Failed to read the workspace list.")));
  // A catalog that read cleanly but names no workspace maps every path to
  // nothing, which is indistinguishable from "nothing changed" and would leave
  // the tripwire inert. This repository always has workspaces, so an empty one
  // is an unreadable one.
  if (A.isReadonlyArrayEmpty(workspaces)) {
    return ProofChangedPackagesUnavailable.make({ kind: "unavailable", reason: "workspace list was empty" });
  }
  const committed = yield* readYeetChangedPathsStrict(context, capture);
  const worktree = yield* readWorktreeChangedPaths(context, capture);
  const paths = A.dedupe([...committed, ...worktree]);
  return ProofChangedPackagesKnown.make({
    kind: "known",
    packages: changedPackageNamesForPaths(repoRoot, workspaces, paths),
    paths: A.length(paths),
  });
});

/**
 * The packages one attempt's change touches, read once per attempt (ruling 69).
 *
 * **Details**
 *
 * The change is the branch's own diff against its base
 * (`git diff --name-only <base>...HEAD`) unioned with the working tree the
 * attempt verified — every staged, unstaged and untracked path, read from one
 * `git status --porcelain=v1 -z --untracked-files=all` snapshot so a path the
 * attempt ran against cannot fall out of the set between collection and
 * mapping. Each path maps to the deepest workspace containing it; paths under
 * no workspace contribute nothing, because root config is already the proof
 * epoch (ruling 4) and documentation is not package source.
 *
 * It never fails: a failed or truncated git read, or a workspace list that
 * could not be resolved, yields `unavailable` carrying the reason, and the
 * tripwire then fails closed for every lane with a package scope. The verdict
 * writer logs the outcome and proceeds either way.
 *
 * **Example** (Build the reader effect)
 *
 * ```ts
 * import { changedPackagesForAttempt, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feature/tripwire",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * console.log(Effect.isEffect(changedPackagesForAttempt(context))) // true
 * ```
 *
 * @param context - Repo context naming the checkout and its base ref.
 * @param capture - The command capture to run `git` through; the repo capture by default.
 * @returns The changed package set, or why it could not be read.
 * @category services
 * @since 0.0.0
 */
export const changedPackagesForAttempt = Effect.fn("Yeet.changedPackagesForAttempt")(function* (
  context: RepoRunContext,
  capture: typeof runRepoCommandCapture = runRepoCommandCapture
): Effect.fn.Return<
  ProofChangedPackages,
  never,
  Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner | FileSystem.FileSystem | Path.Path
> {
  return yield* readChangedPackages(context, capture).pipe(
    Effect.catch((error) =>
      Effect.succeed(ProofChangedPackagesUnavailable.make({ kind: "unavailable", reason: error.message }))
    )
  );
});

/**
 * Render the one-line changed-package note the verdict path logs.
 *
 * **Example** (Render a known set)
 *
 * ```ts
 * import { ProofChangedPackagesKnown, renderProofChangedPackages } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(
 *   renderProofChangedPackages(
 *     ProofChangedPackagesKnown.make({ kind: "known", packages: ["@beep/x"], paths: 2 })
 *   )
 * ) // "proof shadow changed packages: @beep/x (2 path(s))"
 * ```
 *
 * @param changed - What the attempt knows about its changed packages.
 * @returns The one-line note the verdict path logs.
 * @category rendering
 * @since 0.0.0
 */
export const renderProofChangedPackages = (changed: ProofChangedPackages): string =>
  ProofChangedPackages.match(changed, {
    known: (known) =>
      `proof shadow changed packages: ${A.match(known.packages, {
        onEmpty: () => "none",
        onNonEmpty: (names) => A.join(names, ", "),
      })} (${known.paths} path(s))`,
    unavailable: (unavailable) =>
      `proof shadow changed packages unavailable: ${unavailable.reason}; tripwire fails closed`,
  });

// Lane id to the union of the package scopes its reports carry: one attempt can
// journal the same lane id more than once, and the union is the conservative read.
const laneInputScopes = (
  reports: ReadonlyArray<QualityTaskLaneRunReport>
): HashMap.HashMap<string, HashSet.HashSet<string>> =>
  A.reduce(
    A.flatMap(reports, (report) => report.lanes),
    HashMap.empty<string, HashSet.HashSet<string>>(),
    (scopes, lane) =>
      HashMap.modifyAt(scopes, lane.id, (existing) =>
        O.some(HashSet.union(O.getOrElse(existing, HashSet.empty<string>), HashSet.fromIterable(lane.inputPackages)))
      )
  );

/**
 * Build the ledger's changed-package tripwire from one attempt's own reports
 * and its changed package set (ruling 70).
 *
 * **Details**
 *
 * A lane's package scope is the union of the `inputPackages` its reports carry
 * for that lane id. When the changed set is `known` the tripwire fires only on
 * a non-empty intersection, so a repo-wide lane that verified `@beep/x` is
 * refused when `@beep/x` changed and served when only `@beep/y` did. When the
 * changed set is `unavailable` it fires for every lane with a non-empty scope,
 * which is the conservative side of an unknown. A root-task-only lane has an
 * empty scope and is decided by its digest alone in both cases, because that
 * digest already spans every input Turbo declares for the root task. Undeclared
 * lanes never reach the tripwire: the ledger refuses them as
 * `undeclared-inputs` first.
 *
 * A failed lane also carries an empty scope, because `resolveLaneInputDigest`
 * short-circuits on failure before it reads any Turbo digest. Nothing is lost:
 * every production lane tuple declares no digest, so a failed lane's key is
 * `undeclared` and the ledger refuses it as `undeclared-inputs` before the
 * tripwire runs. A lane whose digest the executor declared has no Turbo ledger
 * to derive a scope from on either outcome.
 *
 * **Example** (A scoped lane trips on its own package)
 *
 * ```ts
 * import { QualityTaskLaneRun, QualityTaskLaneRunReport } from "@beep/repo-cli/commands/Quality"
 * import { changedPackageTripwireFor, ProofChangedPackagesKnown, ProofInputDigest } from "@beep/repo-cli/test/Yeet"
 * import * as O from "effect/Option"
 *
 * const reports = [
 *   QualityTaskLaneRunReport.make({
 *     schemaVersion: "quality-task-lane-run/v1",
 *     lanes: [
 *       QualityTaskLaneRun.make({
 *         id: "quality:check",
 *         label: "quality:check",
 *         status: "passed",
 *         inputDigest: O.some("d1"),
 *         inputPackages: ["@beep/x"]
 *       })
 *     ]
 *   })
 * ]
 * const key = ProofInputDigest.make({
 *   laneId: "quality:check",
 *   laneClass: "cli-runnable",
 *   commandDigest: "c1",
 *   envProfile: "local",
 *   inputDigest: "d1",
 *   inputSource: "turbo-task-hash",
 *   epochDigest: "e1",
 *   key: "k1"
 * })
 *
 * const changed = ProofChangedPackagesKnown.make({ kind: "known", packages: ["@beep/x"], paths: 1 })
 * console.log(changedPackageTripwireFor(reports, changed)(key)) // true
 * ```
 *
 * @param reports - Durable inner-lane reports of the running attempt.
 * @param changed - What the attempt knows about its changed packages.
 * @returns The predicate the ledger consults before it reads any fact.
 * @category utilities
 * @since 0.0.0
 */
export const changedPackageTripwireFor: {
  (changed: ProofChangedPackages): (reports: ReadonlyArray<QualityTaskLaneRunReport>) => ProofChangedPackageTripwire;
  (reports: ReadonlyArray<QualityTaskLaneRunReport>, changed: ProofChangedPackages): ProofChangedPackageTripwire;
} = dual(2, (reports: ReadonlyArray<QualityTaskLaneRunReport>, changed: ProofChangedPackages) => {
  const scopes = laneInputScopes(reports);
  const scopeFor = (laneId: string): HashSet.HashSet<string> =>
    O.getOrElse(HashMap.get(scopes, laneId), HashSet.empty<string>);
  return ProofChangedPackages.match(changed, {
    known: (known): ProofChangedPackageTripwire => {
      const changedPackages = HashSet.fromIterable(known.packages);
      return (key) => !HashSet.isEmpty(HashSet.intersection(scopeFor(key.laneId), changedPackages));
    },
    unavailable: (): ProofChangedPackageTripwire => (key) => !HashSet.isEmpty(scopeFor(key.laneId)),
  });
});

/**
 * A lane that ran to a terminal outcome and can be shadowed.
 */
type ShadowableLane = {
  readonly lane: QualityTaskLaneRun;
  readonly observed: ProofOutcome;
  readonly commandText: string;
};

const observedOutcome = (lane: QualityTaskLaneRun): O.Option<ProofOutcome> =>
  GithubCheckLaneRunStatus.$match(lane.status, {
    passed: () => O.some<ProofOutcome>("passed"),
    failed: () => O.some<ProofOutcome>("failed"),
    reused: O.none<ProofOutcome>,
    "not-run-early-stop": O.none<ProofOutcome>,
  });

const shadowableLane = (lane: QualityTaskLaneRun): O.Option<ShadowableLane> =>
  O.all({
    lane: O.some(lane),
    observed: observedOutcome(lane),
    commandText: O.filter(lane.commandText, Str.isNonEmpty),
  });

/**
 * Select the inner lanes an attempt can shadow: lanes that ran to `passed` or
 * `failed` with a command line; reused and skipped lanes carry no new evidence.
 *
 * **Example** (Nothing shadowable in an empty wave)
 *
 * ```ts
 * import { shadowableLaneRuns } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(shadowableLaneRuns([]).length) // 0
 * ```
 *
 * @param reports - Durable inner-lane reports of one attempt.
 * @returns The lanes that ran to `passed` or `failed` with their outcome and command line.
 * @category utilities
 * @since 0.0.0
 */
export const shadowableLaneRuns = (
  reports: ReadonlyArray<QualityTaskLaneRunReport>
): ReadonlyArray<{
  readonly lane: QualityTaskLaneRun;
  readonly observed: ProofOutcome;
  readonly commandText: string;
}> =>
  A.getSomes(
    pipe(
      reports,
      A.flatMap((report) => report.lanes),
      A.map(shadowableLane)
    )
  );

const shadowInputDigest = Effect.fn("Yeet.ProofShadow.inputDigest")(function* (
  candidate: ShadowableLane,
  facts: ProofShadowAttemptFacts,
  epoch: ProofEpoch
): Effect.fn.Return<ProofInputDigest, YeetCommandError, Crypto.Crypto> {
  const commandDigest = yield* proofCommandDigest(candidate.commandText);
  const declared = O.filter(candidate.lane.inputDigest, Str.isNonEmpty);
  const inputDigest = O.getOrElse(declared, () => UNDECLARED_INPUT_DIGEST);
  const components = {
    laneId: candidate.lane.id,
    commandDigest,
    envProfile: facts.envProfile,
    inputDigest,
    epochDigest: epoch.digest,
  };
  const key = yield* proofInputKey(components);
  return ProofInputDigest.make({
    ...components,
    laneClass: "cli-runnable",
    inputSource: O.isSome(declared) ? "turbo-task-hash" : "undeclared",
    key,
  });
});

const shadowFact = (
  key: ProofInputDigest,
  epoch: ProofEpoch,
  candidate: ShadowableLane,
  facts: ProofShadowAttemptFacts,
  repoRoot: string,
  now: DateTime.Utc
): ProofFact =>
  ProofFact.make({
    schemaVersion: PROOF_FACT_SCHEMA_VERSION,
    key,
    epoch,
    outcome: candidate.observed,
    durationMs: O.getOrElse(candidate.lane.durationMs, () => 0),
    provenance: ProofProvenance.make({
      runId: facts.runId,
      attemptId: facts.attemptId,
      originKey: repoRoot,
      tier: facts.tier,
      stage: facts.stage,
      headSha: facts.headSha,
      hostedRunId: null,
    }),
    recordedAt: DateTime.formatIso(now),
    expiresAt: DateTime.formatIso(DateTime.addDuration(now, PROOF_FACT_TTL)),
  });

const shadowRow = (
  decision: ProofReuseDecision,
  candidate: ShadowableLane,
  facts: ProofShadowAttemptFacts,
  now: DateTime.Utc
): ProofLedgerShadowRow =>
  ProofLedgerShadowRow.make({
    schemaVersion: PROOF_FACT_SCHEMA_VERSION,
    attemptId: facts.attemptId,
    laneId: candidate.lane.id,
    branch: facts.branch,
    stage: facts.stage,
    envProfile: facts.envProfile,
    decision,
    observed: candidate.observed,
    durationMs: O.getOrElse(candidate.lane.durationMs, () => 0),
    recordedAt: DateTime.formatIso(now),
  });

const isDisagreement = (row: ProofLedgerShadowRow): boolean => isHit(row.decision) && !isPassed(row.observed);

const isTripwireMiss = (row: ProofLedgerShadowRow): boolean =>
  isMiss(row.decision) && ProofMissReason.is["changed-package-tripwire"](row.decision.reason);

/**
 * Shadow one attempt's inner lanes against the checkout proof ledger (ruling 63).
 *
 * **Details**
 *
 * For every lane that ran to `passed` or `failed`, in report order: derive the
 * tier-independent reuse key, ask the ledger what it would have decided, append
 * that decision next to the observed outcome as a shadow row, then append the
 * lane's own fact so the next attempt can hit it. All keys are decided against
 * one ledger snapshot taken before anything is written, so a lane never
 * "reuses" the fact it is about to write, and every row of the attempt lands in
 * one append (shadow row then fact, per lane, in report order), so a fault
 * mid-attempt leaves no half-recorded lane. Nothing is skipped or
 * short-circuited: shadow mode only observes.
 *
 * The lookup runs behind the changed-package tripwire (ruling 70), built from
 * the attempt's own reports and its changed package set: a lane whose package
 * scope intersects the change is refused as `changed-package-tripwire` before
 * any fact is read, and every scoped lane is refused when the changed set is
 * `unavailable`. The tripwire only ever turns a would-be hit into a miss, so
 * it cannot make the shadow pass claim reuse it has not earned.
 *
 * **Example** (Build the shadow pass effect)
 *
 * ```ts
 * import { ProofChangedPackagesKnown, recordProofShadowForAttempt } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * const facts = {
 *   attemptId: "attempt-1",
 *   runId: "run-1",
 *   branch: "feat/example",
 *   headSha: "88fa371cb0",
 *   tier: "full" as const,
 *   stage: "pre-push" as const,
 *   envProfile: "local" as const,
 * }
 * const changed = ProofChangedPackagesKnown.make({ kind: "known", packages: [], paths: 0 })
 * console.log(Effect.isEffect(recordProofShadowForAttempt("/repo", facts, [], changed))) // true
 * ```
 *
 * @param repoRoot - Checkout whose ledger receives the rows.
 * @param facts - Attempt identity, branch, head, tier, stage and env profile.
 * @param reports - Durable inner-lane reports the wrappers wrote for this attempt.
 * @param changed - What the attempt knows about the packages its change touches.
 * @returns Counts of what the pass recorded.
 * @category services
 * @since 0.0.0
 */
export const recordProofShadowForAttempt = Effect.fn("Yeet.recordProofShadowForAttempt")(function* (
  repoRoot: string,
  facts: ProofShadowAttemptFacts,
  reports: ReadonlyArray<QualityTaskLaneRunReport>,
  changed: ProofChangedPackages
): Effect.fn.Return<ProofShadowAttemptSummary, YeetCommandError, Crypto.Crypto | FileSystem.FileSystem | Path.Path> {
  const candidates = shadowableLaneRuns(reports);
  if (A.isReadonlyArrayEmpty(candidates)) {
    return ProofShadowAttemptSummary.make({
      attemptId: facts.attemptId,
      recorded: 0,
      wouldReuse: 0,
      disagreements: 0,
      undeclared: 0,
    });
  }
  const epoch = yield* collectProofEpoch(repoRoot);
  const ledger = yield* ProofLedger.make(repoRoot, changedPackageTripwireFor(reports, changed));
  const now = yield* DateTime.now;
  const keys = yield* Effect.forEach(candidates, (candidate) => shadowInputDigest(candidate, facts, epoch));
  const decisions = yield* ledger.lookupAll(keys, now);
  const rows = A.map(A.zip(A.zip(candidates, keys), decisions), ([[candidate, key], decision]) => ({
    row: shadowRow(decision, candidate, facts, now),
    fact: shadowFact(key, epoch, candidate, facts, repoRoot, now),
    undeclared: ProofInputSource.is.undeclared(key.inputSource),
  }));
  yield* ledger.appendAll(
    A.flatMap(rows, ({ row, fact }) => [
      row,
      ProofLedgerFactRow.make({ schemaVersion: PROOF_FACT_SCHEMA_VERSION, fact }),
    ])
  );
  return ProofShadowAttemptSummary.make({
    attemptId: facts.attemptId,
    recorded: A.length(rows),
    wouldReuse: A.length(A.filter(rows, ({ row }) => isHit(row.decision))),
    disagreements: A.length(A.filter(rows, ({ row }) => isDisagreement(row))),
    undeclared: A.length(A.filter(rows, ({ undeclared }) => undeclared)),
    tripped: A.length(A.filter(rows, ({ row }) => isTripwireMiss(row))),
  });
});

/**
 * Render the one-line attempt summary the verdict path logs.
 *
 * **Example** (Render a summary)
 *
 * ```ts
 * import { ProofShadowAttemptSummary, renderProofShadowAttemptSummary } from "@beep/repo-cli/test/Yeet"
 *
 * const line = renderProofShadowAttemptSummary(
 *   ProofShadowAttemptSummary.make({
 *     attemptId: "a",
 *     recorded: 3,
 *     wouldReuse: 1,
 *     disagreements: 0,
 *     undeclared: 2,
 *     tripped: 1,
 *   })
 * )
 * // "proof shadow: 3 lane(s) recorded; would reuse 1; disagreements 0; undeclared inputs 2; tripwire 1"
 * console.log(line)
 * ```
 *
 * @param summary - What one attempt's shadow pass recorded.
 * @returns The one-line summary the verdict path logs.
 * @category rendering
 * @since 0.0.0
 */
export const renderProofShadowAttemptSummary = (summary: ProofShadowAttemptSummary): string =>
  `proof shadow: ${summary.recorded} lane(s) recorded; would reuse ${summary.wouldReuse}; disagreements ${summary.disagreements}; undeclared inputs ${summary.undeclared}; tripwire ${summary.tripped}`;

const missCounts = (rows: ReadonlyArray<ProofLedgerShadowRow>): ReadonlyArray<ProofShadowMissCount> => {
  const counts = MutableHashMap.empty<ProofMissReason, number>();
  for (const row of rows) {
    if (!isHit(row.decision)) {
      const reason = row.decision.reason;
      MutableHashMap.set(counts, reason, O.getOrElse(MutableHashMap.get(counts, reason), () => 0) + 1);
    }
  }
  return A.getSomes(
    A.map(ProofMissReason.Options, (reason) =>
      O.map(MutableHashMap.get(counts, reason), (count) => ProofShadowMissCount.make({ reason, count }))
    )
  );
};

const distinctCount = (
  rows: ReadonlyArray<ProofLedgerShadowRow>,
  pick: (row: ProofLedgerShadowRow) => string
): number => HashSet.size(HashSet.fromIterable(A.map(rows, pick)));

/**
 * The first enforced pair (ruling 2): attempt-to-attempt within pre-push, on
 * the local profile. Only rows from this stage and profile count toward the
 * enforcement bar.
 *
 * @category constants
 * @since 0.0.0
 */
export const PROOF_SHADOW_BAR_SAMPLE = { stage: "pre-push", envProfile: "local" } as const satisfies {
  readonly stage: ProofStage;
  readonly envProfile: ProofEnvProfile;
};

const inBarSample = (row: ProofLedgerShadowRow): boolean =>
  ProofStage.is[PROOF_SHADOW_BAR_SAMPLE.stage](row.stage) &&
  ProofEnvProfile.is[PROOF_SHADOW_BAR_SAMPLE.envProfile](row.envProfile);

/**
 * Inputs {@link buildProofShadowReport} folds: the ledger's shadow rows and
 * health counts, plus an optional bar override for fixtures.
 *
 * **Example** (Describe an empty ledger)
 *
 * ```ts
 * import { ProofShadowReportInput } from "@beep/repo-cli/test/Yeet"
 *
 * const input = ProofShadowReportInput.make({
 *   generatedAt: "2026-09-21T00:00:00.000Z",
 *   ledgerPath: "/repo/.beep/yeet/proof-ledger.ndjson",
 *   rows: [],
 *   facts: 0,
 *   expiredFacts: 0,
 *   malformedRows: 0,
 * })
 * console.log(input.rows.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProofShadowReportInput extends S.Class<ProofShadowReportInput>($I`ProofShadowReportInput`)(
  {
    generatedAt: S.NonEmptyString,
    ledgerPath: S.NonEmptyString,
    rows: S.Array(ProofLedgerShadowRow),
    facts: ProofCount,
    expiredFacts: ProofCount,
    malformedRows: ProofCount,
    bar: S.optionalKey(ProofShadowEnforcementBar),
  },
  $I.annote("ProofShadowReportInput", {
    description: "Shadow rows, ledger health counts, and an optional enforcement-bar override to fold into a report.",
  })
) {}

/**
 * Fold shadow rows and ledger health into the disagreement report.
 *
 * **Details**
 *
 * The headline counts fold every shadow row; the enforcement verdict folds only
 * the rows in {@link PROOF_SHADOW_BAR_SAMPLE}, so a ledger full of
 * merged-preview rows reads `not ready` for the pre-push pair.
 *
 * **Example** (An empty ledger is not ready)
 *
 * ```ts
 * import { buildProofShadowReport, ProofShadowReportInput } from "@beep/repo-cli/test/Yeet"
 *
 * const report = buildProofShadowReport(
 *   ProofShadowReportInput.make({
 *     generatedAt: "2026-09-21T00:00:00.000Z",
 *     ledgerPath: "/repo/.beep/yeet/proof-ledger.ndjson",
 *     rows: [],
 *     facts: 0,
 *     expiredFacts: 0,
 *     malformedRows: 0,
 *   })
 * )
 * console.log(report.enforcementReady) // false
 * ```
 *
 * @param input - Shadow rows, ledger health counts, and an optional bar override.
 * @returns The report with headline counts over every row and the bar verdict over the enforced pair.
 * @category utilities
 * @since 0.0.0
 */
export const buildProofShadowReport = (input: ProofShadowReportInput): ProofShadowReport => {
  const bar = input.bar ?? ProofShadowEnforcementBar.ratified;
  const hits = A.filter(input.rows, (row) => isHit(row.decision));
  const disagreements = pipe(
    input.rows,
    A.filter(isDisagreement),
    A.map((row) =>
      ProofShadowDisagreement.make({
        attemptId: row.attemptId,
        laneId: row.laneId,
        branch: row.branch,
        stage: row.stage,
        key: row.decision.key,
        recordedAt: row.recordedAt,
      })
    )
  );
  const attempts = distinctCount(input.rows, (row) => row.attemptId);
  const branches = distinctCount(input.rows, (row) => row.branch);
  const barRows = A.filter(input.rows, inBarSample);
  const barAttempts = distinctCount(barRows, (row) => row.attemptId);
  const barBranches = distinctCount(barRows, (row) => row.branch);
  const barDisagreements = A.length(A.filter(barRows, isDisagreement));
  return ProofShadowReport.make({
    schemaVersion: PROOF_SHADOW_REPORT_SCHEMA_VERSION,
    generatedAt: input.generatedAt,
    ledgerPath: input.ledgerPath,
    shadowRows: A.length(input.rows),
    attempts,
    branches,
    wouldReuse: A.length(hits),
    reusableMs: pipe(
      hits,
      A.filter((row) => isPassed(row.observed)),
      A.map((row) => row.durationMs),
      Num.sumAll
    ),
    misses: missCounts(input.rows),
    disagreements,
    facts: input.facts,
    expiredFacts: input.expiredFacts,
    malformedRows: input.malformedRows,
    bar,
    barStage: PROOF_SHADOW_BAR_SAMPLE.stage,
    barEnvProfile: PROOF_SHADOW_BAR_SAMPLE.envProfile,
    barAttempts,
    barBranches,
    barDisagreements,
    enforcementReady:
      barAttempts >= bar.attempts && barBranches >= bar.branches && barDisagreements <= bar.disagreements,
  });
};

const formatMinutes = (ms: number): string => `${(ms / 60_000).toFixed(1)} min`;

/**
 * Render the disagreement report for the terminal.
 *
 * **Example** (Render an empty report)
 *
 * ```ts
 * import { buildProofShadowReport, ProofShadowReportInput, renderProofShadowReport } from "@beep/repo-cli/test/Yeet"
 *
 * const text = renderProofShadowReport(
 *   buildProofShadowReport(
 *     ProofShadowReportInput.make({
 *       generatedAt: "2026-09-21T00:00:00.000Z",
 *       ledgerPath: "/repo/.beep/yeet/proof-ledger.ndjson",
 *       rows: [],
 *       facts: 0,
 *       expiredFacts: 0,
 *       malformedRows: 0,
 *     })
 *   )
 * )
 * console.log(text.startsWith("proof shadow report")) // true
 * ```
 *
 * @param report - The folded disagreement report.
 * @returns The multi-line terminal rendering.
 * @category rendering
 * @since 0.0.0
 */
export const renderProofShadowReport = (report: ProofShadowReport): string => {
  const misses = A.isReadonlyArrayEmpty(report.misses)
    ? ["misses by reason: none"]
    : ["misses by reason:", ...A.map(report.misses, (miss) => `  ${miss.reason}: ${miss.count}`)];
  const disagreements = A.isReadonlyArrayEmpty(report.disagreements)
    ? ["disagreements: none"]
    : [
        `disagreements: ${A.length(report.disagreements)}`,
        ...A.map(
          report.disagreements,
          (row) => `  ${row.laneId} on ${row.branch} (${row.stage}, attempt ${row.attemptId}) at ${row.recordedAt}`
        ),
      ];
  const bar = report.bar;
  return A.join(
    [
      `proof shadow report (${report.ledgerPath})`,
      `shadow rows: ${report.shadowRows} across ${report.attempts} attempt(s) on ${report.branches} branch(es)`,
      `would reuse: ${report.wouldReuse} lane run(s), ${formatMinutes(report.reusableMs)} of passed lane time`,
      ...misses,
      ...disagreements,
      `facts: ${report.facts} recorded, ${report.expiredFacts} expired; malformed rows: ${report.malformedRows}`,
      `enforcement (attempt-to-attempt, ${report.barStage}, ${report.barEnvProfile}): ${report.enforcementReady ? "ready" : "not ready"} — attempts ${report.barAttempts}/${bar.attempts}, branches ${report.barBranches}/${bar.branches}, disagreements ${report.barDisagreements}/${bar.disagreements}`,
    ],
    "\n"
  );
};

/**
 * Options for `yeet proof-report`.
 *
 * **Example** (Ask for JSON)
 *
 * ```ts
 * import { YeetProofReportOptions } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YeetProofReportOptions.make({ json: true }).json) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class YeetProofReportOptions extends S.Class<YeetProofReportOptions>($I`YeetProofReportOptions`)(
  { json: S.Boolean },
  $I.annote("YeetProofReportOptions", {
    description: "Parsed `yeet proof-report` flags: whether to print the report as JSON.",
  })
) {}

/**
 * The `yeet proof-report` command handler: decode the parsed flags and run the
 * report from the working directory's checkout.
 *
 * **Example** (Build the handler effect)
 *
 * ```ts
 * import { runYeetProofReportCommand } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(runYeetProofReportCommand({ json: true }))) // true
 * ```
 *
 * @param options - Parsed `yeet proof-report` flags.
 * @returns Void once the report was printed.
 * @category services
 * @since 0.0.0
 */
export const runYeetProofReportCommand = (
  options: Parameters<typeof YeetProofReportOptions.make>[0]
): Effect.Effect<void, YeetCommandError, FileSystem.FileSystem | Path.Path> =>
  runYeetProofReport(YeetProofReportOptions.make(options));

const locateRepoRoot: Effect.Effect<string, YeetCommandError, FileSystem.FileSystem> = findRepoRoot().pipe(
  Effect.mapError(YeetCommandError.new("Failed to locate repo root."))
);

/**
 * Build the disagreement report for one checkout from its proof ledger.
 *
 * **Example** (Build the report effect)
 *
 * ```ts
 * import { loadProofShadowReport } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(loadProofShadowReport("/repo"))) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const loadProofShadowReport = Effect.fn("Yeet.loadProofShadowReport")(function* (
  repoRoot: string
): Effect.fn.Return<ProofShadowReport, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const ledger = yield* ProofLedger.make(repoRoot, constFalse);
  const now = yield* DateTime.now;
  // One load: the rows and every count describe the same instant even when an
  // attempt is appending to the ledger while the report runs.
  const snapshot = yield* ledger.snapshot(now);
  const ledgerPath = yield* proofLedgerPathForCheckout(repoRoot);
  return buildProofShadowReport(
    ProofShadowReportInput.make({
      generatedAt: DateTime.formatIso(now),
      ledgerPath,
      rows: snapshot.shadowRows,
      facts: snapshot.facts,
      expiredFacts: snapshot.expiredFacts,
      malformedRows: snapshot.malformedRows,
    })
  );
});

/**
 * Run one `yeet proof-report` pass: load the ledger, print the report.
 *
 * **Example** (Build the runner effect)
 *
 * ```ts
 * import { runYeetProofReport, YeetProofReportOptions } from "@beep/repo-cli/test/Yeet"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(runYeetProofReport(YeetProofReportOptions.make({ json: false })))) // true
 * ```
 *
 * @param options - Parsed `yeet proof-report` flags.
 * @param repoRoot - Where the checkout root comes from; defaults to the git root of the working directory.
 * @returns Void once the report was printed.
 * @category services
 * @since 0.0.0
 */
export const runYeetProofReport = Effect.fn("Yeet.runProofReportCommand")(function* (
  options: YeetProofReportOptions,
  repoRoot: Effect.Effect<string, YeetCommandError, FileSystem.FileSystem> = locateRepoRoot
): Effect.fn.Return<void, YeetCommandError, FileSystem.FileSystem | Path.Path> {
  const report = yield* loadProofShadowReport(yield* repoRoot);
  if (options.json) {
    const json = yield* ProofShadowReportJson.encode(report).pipe(
      Effect.mapError(YeetCommandError.new("Failed to encode the proof shadow report."))
    );
    yield* Console.log(json);
    return;
  }
  yield* Console.log(renderProofShadowReport(report));
});
