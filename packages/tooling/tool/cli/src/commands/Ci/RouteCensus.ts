/**
 * Layers behind the verification route contracts: `VerificationRoute` (the
 * plan for one change) and `RouteCensusReader` (the loss census and the
 * recall replay over a pinned corpus of hosted runs).
 *
 * **Details**
 *
 * The route selects lanes and never reorders them: lanes with a pre-push twin
 * (`quality:<lane>`) keep `WaveOrder`'s order, and selected lanes without one
 * follow in lane-id order. The census and the replay classify each
 * pull-request head's merge-base diff through `ChangeClassifier` and read git
 * through {@link RouteGit}, so tests stub both and run no command.
 *
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { ChangeDetector } from "@beep/repo-workspaces/ChangeDetector";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { runRepoCommandCapture, runRepoCommandCaptureRaw } from "../../internal/repo-run/index.ts";
import { sha256Hex } from "../Goals/PacketCore/PacketDigest.ts";
import { githubCheckPrePushLanes } from "../Quality/internal/GithubChecks.ts";
import { DEFAULT_GATE_ORDER_SEED, WaveOrder } from "../Yeet/internal/WaveOrder.ts";
import { CI_LANE_DESCRIPTORS, CI_LANE_ID_VALUES, CiLaneId } from "./CiLane.ts";
import {
  CHANGE_ATOM_KIND_VALUES,
  ChangeAtom,
  ChangeAtomKind,
  RouteCensus,
  RouteCensusRow,
  RouteError,
  RouteLaneCost,
  RoutePlan,
  RouteReplay,
  RouteReplayHead,
  RouteSelection,
} from "./Route.schemas.ts";
import { ChangeClassifier, ClassifyInput, RouteCensusReader, VerificationRoute } from "./Route.service.ts";
import { requiredLanes, routeFootprintCanonicalJson, skippedLanes } from "./RouteFootprints.ts";
import type * as Crypto from "effect/Crypto";
import type * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import type { GithubCheckLaneSpec } from "../Quality/Quality.schemas.ts";
import type { WaveOrderShape } from "../Yeet/internal/WaveOrder.ts";
import type { ChangeSet, HostedJob, HostedRun } from "./Route.schemas.ts";
import type { RouteCensusShape, RouteCorpusLoaded, VerificationRouteShape } from "./Route.service.ts";

const $I = $RepoCliId.create("commands/Ci/RouteCensus");

const PRE_PUSH_LANE_PREFIX = "quality:";
// The pre-push specs are read for their ids and declaration order only; no
// step runs, so the repository root they would run in is a placeholder.
const PRE_PUSH_SPEC_ROOT = ".";
// Partitioned hosted jobs report as `<context> (<partition>)`, e.g. `Lint (lint-a)`.
const PARTITION_SUFFIX = / \([^()]*\)$/;
// Heads classified at once; each classification spawns git.
const ROUTE_HEAD_CONCURRENCY = 4;
// Missing head commits fetched by sha at once.
const ROUTE_FETCH_CONCURRENCY = 4;
// Shas per `git cat-file --batch-check` call, keeping argv and output small.
const ROUTE_BATCH_CHECK_CHUNK = 500;
// A head whose commit cannot be fetched is routed as one unknown atom at this path.
const UNRESOLVED_HEAD_PATH = "<unresolved head>";
const UNRESOLVED_MERGE_BASE = "<unresolved>";

const isCiLaneId = S.is(CiLaneId);
const isUnknownKind = (atom: ChangeAtom): boolean => Str.Equivalence(atom.kind, "unknown");
const shareOf = (part: number, whole: number): number => (whole === 0 ? 0 : part / whole);

/**
 * The pre-push lane id of a hosted lane: `quality:<lane>`.
 *
 * **Example** (Name the pre-push twin of a lane)
 *
 * ```ts
 * import { prePushLaneId } from "@beep/repo-cli/commands/Ci/RouteCensus"
 *
 * console.log(prePushLaneId("lint")) // "quality:lint"
 * ```
 *
 * @param lane - The hosted lane.
 * @returns The id of its pre-push lane.
 * @category utilities
 * @since 0.0.0
 */
export const prePushLaneId = (lane: CiLaneId): string => `${PRE_PUSH_LANE_PREFIX}${lane}`;

/**
 * The hosted lane a pre-push lane id dispatches, when the id is
 * `quality:<lane>` and `<lane>` is a {@link CiLaneId}.
 *
 * **Example** (Join a pre-push id to its lane)
 *
 * ```ts
 * import { ciLaneOfPrePushLaneId } from "@beep/repo-cli/commands/Ci/RouteCensus"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(ciLaneOfPrePushLaneId("quality:check"))) // "check"
 * console.log(O.isNone(ciLaneOfPrePushLaneId("quality:cache-policy"))) // true
 * ```
 *
 * @param id - A pre-push lane id.
 * @returns The lane it dispatches, or `None` for any other id.
 * @category utilities
 * @since 0.0.0
 */
export const ciLaneOfPrePushLaneId = (id: string): O.Option<CiLaneId> =>
  pipe(
    O.liftPredicate(id, Str.startsWith(PRE_PUSH_LANE_PREFIX)),
    O.map(Str.slice(Str.length(PRE_PUSH_LANE_PREFIX))),
    O.filter(isCiLaneId)
  );

const LANE_BY_CONTEXT: HashMap.HashMap<string, CiLaneId> = HashMap.fromIterable(
  A.getSomes(
    A.map(CI_LANE_DESCRIPTORS, (descriptor) =>
      O.map(O.liftPredicate(descriptor.id, isCiLaneId), (lane) => [descriptor.contextName, lane] as const)
    )
  )
);

/**
 * The lane a hosted job belongs to, joined on the lane descriptor's
 * `contextName`.
 *
 * **Details**
 *
 * A partition job (`Lint (lint-a)`) joins through its context without the
 * partition suffix. Descriptors whose id is not a {@link CiLaneId}
 * (`pr-size`, `dependency-review`) never match, so `Security` is the
 * `security` lane.
 *
 * **Example** (Join hosted job names to lanes)
 *
 * ```ts
 * import { jobNameToLane } from "@beep/repo-cli/commands/Ci/RouteCensus"
 * import * as O from "effect/Option"
 *
 * console.log(O.getOrNull(jobNameToLane("Heavy / Check"))) // "check"
 * console.log(O.getOrNull(jobNameToLane("Lint (lint-a)"))) // "lint"
 * console.log(O.isNone(jobNameToLane("PR Size Label"))) // true
 * ```
 *
 * @param name - The hosted job name.
 * @returns The job's lane, or `None` for a job outside every lane.
 * @category utilities
 * @since 0.0.0
 */
export const jobNameToLane = (name: string): O.Option<CiLaneId> =>
  pipe(
    HashMap.get(LANE_BY_CONTEXT, name),
    O.orElse(() => HashMap.get(LANE_BY_CONTEXT, Str.replace(PARTITION_SUFFIX, "")(name)))
  );

/**
 * The machine time of one hosted job in milliseconds, when both timestamps
 * are present and ordered.
 *
 * **Example** (Measure a job)
 *
 * ```ts
 * import { hostedJobCostMs } from "@beep/repo-cli/commands/Ci/RouteCensus"
 * import { HostedJob } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const job = HostedJob.make({
 *   name: "Lint",
 *   startedAt: O.some("2026-10-28T00:00:00Z"),
 *   completedAt: O.some("2026-10-28T00:01:00Z"),
 * })
 * console.log(O.getOrNull(hostedJobCostMs(job))) // 60000
 * ```
 *
 * @param job - A captured job with optional start and completion timestamps.
 * @returns Its duration in milliseconds, or `None` when untimed or misordered.
 * @category utilities
 * @since 0.0.0
 */
export const hostedJobCostMs = (job: HostedJob): O.Option<number> =>
  pipe(
    O.all([O.flatMap(job.startedAt, DateTime.make), O.flatMap(job.completedAt, DateTime.make)]),
    O.map(([started, completed]) => DateTime.toEpochMillis(completed) - DateTime.toEpochMillis(started)),
    O.filter(Num.isGreaterThanOrEqualTo(0))
  );

/**
 * Every job of the given runs that belongs to a lane, paired with that lane,
 * in run then job order; jobs with no lane are dropped.
 *
 * **Example** (Keep only lane jobs)
 *
 * ```ts
 * import { hostedLaneJobs } from "@beep/repo-cli/commands/Ci/RouteCensus"
 * import { HostedJob, HostedRun } from "@beep/repo-cli/commands/Ci"
 *
 * const run = HostedRun.make({
 *   runId: 1,
 *   workflow: "Check",
 *   event: "pull_request",
 *   headBranch: "feat/x",
 *   headSha: "abcd",
 *   createdAt: "2026-10-28T00:00:00Z",
 *   attempt: 1,
 *   jobs: [HostedJob.make({ name: "Lint" }), HostedJob.make({ name: "PR Size Label" })],
 * })
 * console.log(hostedLaneJobs([run]).length) // 1
 * ```
 *
 * @param runs - Captured runs whose jobs are joined to lanes.
 * @returns Each lane job paired with its lane.
 * @category utilities
 * @since 0.0.0
 */
export const hostedLaneJobs = (runs: ReadonlyArray<HostedRun>): ReadonlyArray<readonly [CiLaneId, HostedJob]> =>
  A.flatMap(runs, (run) =>
    A.getSomes(A.map(run.jobs, (job) => O.map(jobNameToLane(job.name), (lane) => [lane, job] as const)))
  );

/**
 * Order a selected lane set for execution without reordering beyond
 * `WaveOrder`.
 *
 * **Details**
 *
 * The pre-push specs whose `quality:<lane>` id names a selected lane run
 * through `order` (the `WaveOrder` service's `order`); selected lanes with no
 * pre-push spec follow in lane-id declaration order. Unselected lanes never
 * appear.
 *
 * **Example** (Order a selection with the identity order)
 *
 * ```ts
 * import type { CiLaneId } from "@beep/repo-cli/commands/Ci"
 * import { orderSelectedLanes } from "@beep/repo-cli/commands/Ci/RouteCensus"
 * import { githubCheckPrePushLanes } from "@beep/repo-cli/test/Quality"
 * import * as HashSet from "effect/HashSet"
 *
 * const selected: ReadonlyArray<CiLaneId> = ["labs", "lint"]
 * const ordered = orderSelectedLanes(
 *   HashSet.fromIterable(selected),
 *   (lanes) => lanes,
 *   githubCheckPrePushLanes("/repo", [])
 * )
 * console.log(ordered) // ["lint", "labs"]
 * ```
 *
 * @param selected - The lanes the route selected.
 * @param order - The wave order applied to the selected lanes' pre-push specs.
 * @param specs - The pre-push lane specs in declaration order.
 * @returns The selected lanes in execution order.
 * @category utilities
 * @since 0.0.0
 */
export const orderSelectedLanes: {
  (
    order: WaveOrderShape["order"],
    specs: ReadonlyArray<GithubCheckLaneSpec>
  ): (selected: HashSet.HashSet<CiLaneId>) => ReadonlyArray<CiLaneId>;
  (
    selected: HashSet.HashSet<CiLaneId>,
    order: WaveOrderShape["order"],
    specs: ReadonlyArray<GithubCheckLaneSpec>
  ): ReadonlyArray<CiLaneId>;
} = dual(
  3,
  (
    selected: HashSet.HashSet<CiLaneId>,
    order: WaveOrderShape["order"],
    specs: ReadonlyArray<GithubCheckLaneSpec>
  ): ReadonlyArray<CiLaneId> => {
    const isSelected = (lane: CiLaneId): boolean => HashSet.has(selected, lane);
    const twins = A.filter(specs, (spec) => O.exists(ciLaneOfPrePushLaneId(spec.id), isSelected));
    const waved = A.dedupe(A.getSomes(A.map(order(twins), (spec) => ciLaneOfPrePushLaneId(spec.id))));
    return A.appendAll(
      waved,
      A.filter(CI_LANE_ID_VALUES, (lane) => isSelected(lane) && !A.contains(waved, lane))
    );
  }
);

/**
 * The sha256 hex digest of the footprint record's canonical JSON.
 *
 * **Example** (Build the digest effect)
 *
 * ```ts
 * import { routeFootprintDigest } from "@beep/repo-cli/commands/Ci/RouteCensus"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(routeFootprintDigest)) // true
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const routeFootprintDigest: Effect.Effect<string, RouteError, Crypto.Crypto> = Effect.suspend(() =>
  sha256Hex(routeFootprintCanonicalJson())
).pipe(Effect.mapError(RouteError.mapError("footprint", "Failed to digest the footprint record.")));

/**
 * The workspace packages a commit range affects, by package name.
 *
 * @category services
 * @since 0.0.0
 */
export type RouteAffectedPackages = (base: string, head: string) => Effect.Effect<ReadonlyArray<string>, RouteError>;

/**
 * {@link RouteAffectedPackages} over `@beep/repo-workspaces`'s
 * `ChangeDetector`: the changed packages plus their transitive dependents.
 *
 * **Gotchas**
 *
 * Owners and dependents come from the checkout's workspace graph, not the
 * graph at `head`, so a historical head whose packages were since renamed or
 * re-wired reports today's names. The list only labels the plan in slice 1; no
 * lane is selected from it (`goals/verification-route` Decision Log).
 *
 * **Example** (Read the production affected-packages function)
 *
 * ```ts
 * import { changeDetectorAffectedPackages } from "@beep/repo-cli/commands/Ci/RouteCensus"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(changeDetectorAffectedPackages)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const changeDetectorAffectedPackages: Effect.Effect<RouteAffectedPackages, never, ChangeDetector> = Effect.gen(
  function* () {
    const detector = yield* ChangeDetector;
    const affected: RouteAffectedPackages = (base, head) =>
      detector
        .affectedPackages({ base, head })
        .pipe(
          Effect.map(A.map((pkg) => pkg.name)),
          Effect.mapError(RouteError.mapError("workspace", `Failed to compute the packages ${base}...${head} affects.`))
        );
    return affected;
  }
).pipe(Effect.withSpan("RouteCensus.changeDetectorAffectedPackages"));

const selectedKinds = (
  required: HashMap.HashMap<CiLaneId, HashSet.HashSet<ChangeAtomKind>>,
  lane: CiLaneId
): ReadonlyArray<ChangeAtomKind> =>
  pipe(
    HashMap.get(required, lane),
    O.map((kinds) => A.filter(CHANGE_ATOM_KIND_VALUES, (kind) => HashSet.has(kinds, kind))),
    O.getOrElse(A.empty<ChangeAtomKind>)
  );

/**
 * Build the route over an affected-packages function, the `WaveOrder`
 * service and the footprint record.
 *
 * **Example** (Build the route with no affected packages)
 *
 * ```ts
 * import { makeVerificationRoute } from "@beep/repo-cli/commands/Ci/RouteCensus"
 * import * as Effect from "effect/Effect"
 *
 * const route = makeVerificationRoute(() => Effect.succeed([]))
 * console.log(Effect.isEffect(route)) // true
 * ```
 *
 * @param affected - Computes the affected packages of the plan's range.
 * @returns The route service implementation.
 * @category constructors
 * @since 0.0.0
 */
export const makeVerificationRoute = Effect.fn("VerificationRoute.make")(function* (
  affected: RouteAffectedPackages
): Effect.fn.Return<VerificationRouteShape, RouteError, WaveOrder | Crypto.Crypto> {
  const waveOrder = yield* WaveOrder;
  const footprintDigest = yield* routeFootprintDigest;
  const specs = githubCheckPrePushLanes(PRE_PUSH_SPEC_ROOT, A.empty<GithubCheckLaneSpec>());

  const plan = Effect.fn("VerificationRoute.plan")(function* (changeSet: ChangeSet) {
    const required = requiredLanes(changeSet.atoms);
    const ordered = pipe(required, HashMap.keys, HashSet.fromIterable, orderSelectedLanes(waveOrder.order, specs));
    const affectedPackages = yield* affected(changeSet.base, changeSet.head);
    yield* Effect.annotateCurrentSpan({ "route.atoms": changeSet.atoms.length, "route.selected": ordered.length });
    return RoutePlan.make({
      base: changeSet.base,
      head: changeSet.head,
      atoms: changeSet.atoms,
      affectedPackages,
      selected: A.map(ordered, (lane) => RouteSelection.make({ lane, selectedBy: selectedKinds(required, lane) })),
      skipped: skippedLanes(required),
      footprintDigest,
    });
  });

  return VerificationRoute.of({ plan });
});

/**
 * The route layer over an injected affected-packages function.
 *
 * **Example** (Build a route layer with a stubbed affected set)
 *
 * ```ts
 * import { verificationRouteLayer } from "@beep/repo-cli/commands/Ci/RouteCensus"
 * import * as Effect from "effect/Effect"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(verificationRouteLayer(() => Effect.succeed(["@beep/repo-cli"])))) // true
 * ```
 *
 * @param affected - Computes the affected packages of the plan's range.
 * @returns A layer providing {@link VerificationRoute}.
 * @category services
 * @since 0.0.0
 */
export const verificationRouteLayer = (
  affected: RouteAffectedPackages
): Layer.Layer<VerificationRoute, RouteError, WaveOrder | Crypto.Crypto> =>
  Layer.effect(VerificationRoute, makeVerificationRoute(affected));

/**
 * The production route layer: affected packages from `ChangeDetector`.
 *
 * **Details**
 *
 * The caller provides `WaveOrder` (normally `WaveOrder.Default`), `Crypto`
 * and `ChangeDetector` with its `Git` and `WorkspaceDiscovery` layers.
 *
 * **Example** (Reference the production layer)
 *
 * ```ts
 * import { VerificationRouteLive } from "@beep/repo-cli/commands/Ci/RouteCensus"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(VerificationRouteLive)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const VerificationRouteLive: Layer.Layer<
  VerificationRoute,
  RouteError,
  WaveOrder | Crypto.Crypto | ChangeDetector
> = Layer.effect(VerificationRoute, Effect.flatMap(changeDetectorAffectedPackages, makeVerificationRoute));

/**
 * The shas `git cat-file --batch-check` did not report as commits.
 *
 * **Details**
 *
 * A present commit prints `<sha> commit <size>`; a missing or ambiguous name
 * prints `<name> missing` or `<name> ambiguous`, and any other object type is
 * not a head, so every sha without a `commit` line counts as missing.
 *
 * **Example** (Read a batch-check report)
 *
 * ```ts
 * import { missingFromBatchCheck } from "@beep/repo-cli/commands/Ci/RouteCensus"
 *
 * console.log(missingFromBatchCheck(["aa", "bb"], "aa commit 250\nbb missing\n")) // ["bb"]
 * ```
 *
 * @param shas - The shas that were checked, in order.
 * @param output - The batch-check stdout.
 * @returns The checked shas with no `commit` line, in input order.
 * @category utilities
 * @since 0.0.0
 */
export const missingFromBatchCheck: {
  (output: string): (shas: ReadonlyArray<string>) => ReadonlyArray<string>;
  (shas: ReadonlyArray<string>, output: string): ReadonlyArray<string>;
} = dual(2, (shas: ReadonlyArray<string>, output: string): ReadonlyArray<string> => {
  const commits = HashSet.fromIterable(
    A.getSomes(
      A.map(Str.split(output, "\n"), (line) => {
        const fields = Str.split(Str.trim(line), " ");
        return pipe(
          A.get(fields, 1),
          O.filter((type) => Str.Equivalence(type, "commit")),
          O.flatMap(() => A.get(fields, 0))
        );
      })
    )
  );
  return A.filter(shas, (sha) => !HashSet.has(commits, sha));
});

/**
 * The git primitives {@link ensureRouteHeads} composes.
 *
 * @category services
 * @since 0.0.0
 */
export interface RouteHeadFetchShape {
  /** Fetch one commit by sha; a commit the remote no longer serves is logged, not failed. */
  readonly fetchCommit: (sha: string) => Effect.Effect<void, RouteError>;
  /** Fetch every `refs/pull/<n>/head` into `refs/remotes/pull/<n>`. */
  readonly fetchPullHeads: Effect.Effect<void, RouteError>;
  /** The given shas that are not commits in the local object store, in input order. */
  readonly missingCommits: (shas: ReadonlyArray<string>) => Effect.Effect<ReadonlyArray<string>, RouteError>;
}

/**
 * Make pull-request heads present and report the ones that stay missing.
 *
 * **Details**
 *
 * Heads already in the object store need no fetch, so a report over local
 * commits runs offline. Otherwise one pull-ref fetch brings every head a
 * `refs/pull/<n>/head` still names. A
 * head a force-push replaced has no such ref, so each head still missing is
 * fetched by its own sha, and whatever is missing after that is returned: the
 * census routes those heads as `unknown` rather than failing.
 *
 * **Example** (Nothing to fetch for no heads)
 *
 * ```ts
 * import { ensureRouteHeads } from "@beep/repo-cli/commands/Ci/RouteCensus"
 * import * as Effect from "effect/Effect"
 *
 * const ensure = ensureRouteHeads({
 *   fetchCommit: () => Effect.void,
 *   fetchPullHeads: Effect.void,
 *   missingCommits: (shas) => Effect.succeed(shas),
 * })
 * console.log(Effect.isEffect(ensure([]))) // true
 * ```
 *
 * @param git - The fetch and object-store primitives.
 * @returns A function from head shas to the heads still missing.
 * @category constructors
 * @since 0.0.0
 */
export const ensureRouteHeads = (
  git: RouteHeadFetchShape
): ((shas: ReadonlyArray<string>) => Effect.Effect<ReadonlyArray<string>, RouteError>) =>
  Effect.fn("RouteGit.ensureHeads")(function* (shas: ReadonlyArray<string>) {
    if (A.isReadonlyArrayEmpty(shas)) {
      return A.empty<string>();
    }
    // Every head already local means no network at all: a local report runs offline.
    if (A.isReadonlyArrayEmpty(yield* git.missingCommits(shas))) {
      return A.empty<string>();
    }
    yield* git.fetchPullHeads;
    const missing = yield* git.missingCommits(shas);
    if (A.isReadonlyArrayEmpty(missing)) {
      return missing;
    }
    yield* Effect.forEach(missing, git.fetchCommit, { concurrency: ROUTE_FETCH_CONCURRENCY, discard: true });
    const unresolved = yield* git.missingCommits(missing);
    yield* Effect.annotateCurrentSpan({
      "route.heads": shas.length,
      "route.fetchedBySha": missing.length,
      "route.unresolved": unresolved.length,
    });
    return unresolved;
  });

/**
 * The git reads the census and the replay need, bound to one checkout.
 *
 * @category services
 * @since 0.0.0
 */
export interface RouteGitShape {
  /**
   * Make the given pull-request heads present locally, including heads of deleted branches and heads a
   * force-push left unreferenced; returns the heads still missing afterwards.
   */
  readonly ensureHeads: (shas: ReadonlyArray<string>) => Effect.Effect<ReadonlyArray<string>, RouteError>;
  /** `git merge-base --is-ancestor <ancestor> <descendant>`: exit 0 is true, exit 1 is false. */
  readonly isAncestor: (ancestor: string, descendant: string) => Effect.Effect<boolean, RouteError>;
  /** `git merge-base origin/main <head>`. */
  readonly mergeBase: (head: string) => Effect.Effect<string, RouteError>;
  /** The checkout the classifier diffs in. */
  readonly repoRoot: Effect.Effect<string>;
}

/**
 * The git service of the census and the replay.
 *
 * **Example** (Read the service)
 *
 * ```ts
 * import { RouteGit } from "@beep/repo-cli/commands/Ci/RouteCensus"
 * import * as Effect from "effect/Effect"
 *
 * const program = Effect.gen(function* () {
 *   const git = yield* RouteGit
 *   return git.repoRoot
 * })
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class RouteGit extends Context.Service<RouteGit, RouteGitShape>()($I`RouteGit`) {}

/**
 * The production {@link RouteGitShape} over the repo command capture.
 *
 * **Details**
 *
 * `ensureHeads` is {@link ensureRouteHeads} over git: one quiet `git fetch` of
 * every `refs/pull/<n>/head` into `refs/remotes/pull/<n>` (GitHub keeps those
 * refs after a branch is deleted), then `git cat-file --batch-check` over the
 * heads, then `git fetch origin <sha>` for each head still missing (a head a
 * force-push replaced has no pull ref but stays fetchable by sha). `mergeBase`
 * reads stdout only, so a git warning on stderr never becomes part of the sha.
 *
 * **Example** (Build the git reads for a checkout)
 *
 * ```ts
 * import { makeRouteGit } from "@beep/repo-cli/commands/Ci/RouteCensus"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeRouteGit("/repo"))) // true
 * ```
 *
 * @param repoRoot - The checkout git runs in.
 * @returns The git reads bound to that checkout.
 * @category constructors
 * @since 0.0.0
 */
export const makeRouteGit = Effect.fn("RouteGit.make")(function* (
  repoRoot: string
): Effect.fn.Return<RouteGitShape, never, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> {
  const context = yield* Effect.context<Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner>();
  const spawnFailed = (args: ReadonlyArray<string>) =>
    RouteError.mapError("git", `Failed to spawn git ${A.join(args, " ")}.`);
  const git = (args: ReadonlyArray<string>) =>
    runRepoCommandCapture("git", args, repoRoot).pipe(Effect.provide(context), Effect.mapError(spawnFailed(args)));
  const gitStdout = (args: ReadonlyArray<string>) =>
    runRepoCommandCaptureRaw("git", args, repoRoot).pipe(Effect.provide(context), Effect.mapError(spawnFailed(args)));
  // The capture cannot feed stdin, so `sh` prints the shas (passed as positional
  // arguments, never interpolated) into `git cat-file --batch-check`.
  const batchCheckMissing = Effect.fnUntraced(function* (shas: ReadonlyArray<string>) {
    const args = ["-c", 'printf "%s\\n" "$@" | git cat-file --batch-check', "route-batch-check", ...shas];
    const result = yield* runRepoCommandCaptureRaw("sh", args, repoRoot).pipe(
      Effect.provide(context),
      Effect.mapError(RouteError.mapError("git", "Failed to spawn git cat-file --batch-check."))
    );
    if (result.exitCode !== 0 || result.truncated) {
      return yield* RouteError.new("git", `git cat-file --batch-check exited ${result.exitCode}.`);
    }
    return missingFromBatchCheck(shas, result.output);
  });

  return RouteGit.of({
    repoRoot: Effect.succeed(repoRoot),
    mergeBase: Effect.fn("RouteGit.mergeBase")(function* (head: string) {
      const result = yield* gitStdout(["merge-base", "origin/main", head]);
      const sha = Str.trim(result.output);
      if (result.exitCode !== 0 || Str.isEmpty(sha)) {
        return yield* RouteError.new("git", `git merge-base origin/main ${head} exited ${result.exitCode}.`);
      }
      return sha;
    }),
    isAncestor: Effect.fn("RouteGit.isAncestor")(function* (ancestor: string, descendant: string) {
      const result = yield* git(["merge-base", "--is-ancestor", ancestor, descendant]);
      return yield* Match.value(result.exitCode).pipe(
        Match.when(0, () => Effect.succeed(true)),
        Match.when(1, () => Effect.succeed(false)),
        Match.orElse((exitCode) =>
          Effect.fail(
            RouteError.new("git", `git merge-base --is-ancestor ${ancestor} ${descendant} exited ${exitCode}.`)
          )
        )
      );
    }),
    ensureHeads: ensureRouteHeads({
      fetchCommit: Effect.fn("RouteGit.fetchCommit")(function* (sha: string) {
        const result = yield* git(["fetch", "--quiet", "--no-write-fetch-head", "origin", sha]);
        if (result.exitCode !== 0) {
          yield* Effect.logWarning("Route head is not fetchable by sha").pipe(
            Effect.annotateLogs({ "route.head": sha, "git.exitCode": result.exitCode })
          );
        }
      }),
      fetchPullHeads: Effect.gen(function* () {
        const result = yield* git(["fetch", "--quiet", "origin", "+refs/pull/*/head:refs/remotes/pull/*"]);
        if (result.exitCode !== 0) {
          return yield* RouteError.new("git", `git fetch of pull-request heads exited ${result.exitCode}.`);
        }
      }).pipe(Effect.withSpan("RouteGit.fetchPullHeads")),
      missingCommits: Effect.fn("RouteGit.missingCommits")(function* (shas: ReadonlyArray<string>) {
        const missing = yield* Effect.forEach(A.chunksOf(shas, ROUTE_BATCH_CHECK_CHUNK), (chunk) =>
          batchCheckMissing(chunk)
        );
        return A.flatten(missing);
      }),
    }),
  });
});

/**
 * The production {@link RouteGit} layer for one checkout.
 *
 * **Example** (Build the git layer)
 *
 * ```ts
 * import { routeGitLayer } from "@beep/repo-cli/commands/Ci/RouteCensus"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(routeGitLayer("/repo"))) // true
 * ```
 *
 * @param repoRoot - The checkout git runs in.
 * @returns A layer providing {@link RouteGit}.
 * @category services
 * @since 0.0.0
 */
export const routeGitLayer = (
  repoRoot: string
): Layer.Layer<RouteGit, never, Crypto.Crypto | ChildProcessSpawner.ChildProcessSpawner> =>
  Layer.effect(RouteGit, makeRouteGit(repoRoot));

const isPullRequestRun = (run: HostedRun): boolean => Str.Equivalence(run.event, "pull_request");
const isMainPushRun = (run: HostedRun): boolean =>
  Str.Equivalence(run.event, "push") && Str.Equivalence(run.headBranch, "main");

const medianMs = (values: ReadonlyArray<number>): O.Option<number> => {
  const sorted = A.sort(values, Order.Number);
  return pipe(
    O.all([A.get(sorted, Math.floor((sorted.length - 1) / 2)), A.get(sorted, Math.floor(sorted.length / 2))]),
    O.map(([low, high]) => Num.round((low + high) / 2, 0))
  );
};

/**
 * The census cost estimate of every lane, in lane-id order.
 *
 * **Details**
 *
 * A lane whose `quality:<lane>` twin has a row in the A1 gate-order seed
 * costs that row's P50 (`gate-order-seed`, sourced at the row's duration
 * pointer); otherwise the median of the corpus's measured jobs for the lane
 * (`hosted-median`); otherwise nothing (`none`).
 *
 * **Example** (Cost every lane over an empty corpus)
 *
 * ```ts
 * import { routeLaneCosts } from "@beep/repo-cli/commands/Ci/RouteCensus"
 * import * as A from "effect/Array"
 *
 * const costs = routeLaneCosts([])
 * console.log(A.every(costs, (cost) => cost.basis !== "hosted-median")) // true
 * ```
 *
 * @param runs - The corpus runs whose job durations back the hosted median.
 * @returns One cost per lane id.
 * @category queries
 * @since 0.0.0
 */
export const routeLaneCosts = (runs: ReadonlyArray<HostedRun>): ReadonlyArray<RouteLaneCost> => {
  const seeds = HashMap.fromIterable(A.map(DEFAULT_GATE_ORDER_SEED.lanes, (row) => [row.laneId, row] as const));
  const measured = A.getSomes(
    A.map(hostedLaneJobs(runs), ([lane, job]) => O.map(hostedJobCostMs(job), (ms) => [lane, ms] as const))
  );
  const hostedMedian = (lane: CiLaneId): O.Option<RouteLaneCost> => {
    const durations = A.map(
      A.filter(measured, ([measuredLane]) => Str.Equivalence(measuredLane, lane)),
      ([, ms]) => ms
    );
    return O.map(medianMs(durations), (p50Ms) =>
      RouteLaneCost.make({
        lane,
        basis: "hosted-median",
        p50Ms: O.some(p50Ms),
        source: O.some(`corpus median of ${durations.length} hosted jobs`),
      })
    );
  };
  return A.map(CI_LANE_ID_VALUES, (lane) =>
    pipe(
      HashMap.get(seeds, prePushLaneId(lane)),
      O.map((row) =>
        RouteLaneCost.make({
          lane,
          basis: "gate-order-seed",
          p50Ms: O.some(Num.round(row.costP50Seconds * 1000, 0)),
          source: O.some(row.durationPointer),
        })
      ),
      O.orElse(() => hostedMedian(lane)),
      O.getOrElse(() => RouteLaneCost.make({ lane, basis: "none" }))
    )
  );
};

type HeadEvidence = {
  readonly headSha: string;
  readonly mergeBase: string;
  readonly atoms: ReadonlyArray<ChangeAtom>;
  readonly jobs: ReadonlyArray<readonly [CiLaneId, HostedJob]>;
  readonly resolved: boolean;
};

// Sound by totality: `unknown` reaches every lane, so the route runs everything for the head.
const unresolvedHeadAtom = (headSha: string): ChangeAtom =>
  ChangeAtom.make({
    kind: "unknown",
    path: UNRESOLVED_HEAD_PATH,
    detail: O.some(`head ${headSha} is missing after fetching refs/pull/*/head and the sha itself`),
    digest: headSha,
  });

const pullRequestHeads = (
  runs: ReadonlyArray<HostedRun>
): ReadonlyArray<readonly [headSha: string, runs: ReadonlyArray<HostedRun>]> => {
  const pullRequestRuns = A.filter(runs, isPullRequestRun);
  const byHead = A.reduce(pullRequestRuns, HashMap.empty<string, ReadonlyArray<HostedRun>>(), (acc, run) =>
    HashMap.set(acc, run.headSha, A.append(O.getOrElse(HashMap.get(acc, run.headSha), A.empty<HostedRun>), run))
  );
  return A.map(A.dedupe(A.map(pullRequestRuns, (run) => run.headSha)), (headSha) => [
    headSha,
    O.getOrElse(HashMap.get(byHead, headSha), A.empty<HostedRun>),
  ]);
};

const laneMsOfHead = (head: HeadEvidence): ReadonlyArray<readonly [CiLaneId, number]> => {
  const totals = A.reduce(head.jobs, HashMap.empty<CiLaneId, number>(), (acc, [lane, job]) =>
    pipe(
      hostedJobCostMs(job),
      O.map((ms) => HashMap.set(acc, lane, O.getOrElse(HashMap.get(acc, lane), () => 0) + ms)),
      O.getOrElse(() => acc)
    )
  );
  return A.getSomes(A.map(CI_LANE_ID_VALUES, (lane) => O.map(HashMap.get(totals, lane), (ms) => [lane, ms] as const)));
};

const headKinds = (atoms: ReadonlyArray<ChangeAtom>): ReadonlyArray<ChangeAtomKind> => {
  const present = HashSet.fromIterable(A.map(atoms, (atom) => atom.kind));
  return A.filter(CHANGE_ATOM_KIND_VALUES, (kind) => HashSet.has(present, kind));
};

const emptyRow = (kind: ChangeAtomKind, lane: CiLaneId): RouteCensusRow =>
  RouteCensusRow.make({ kind, lane, pureHeads: 0, pureMs: 0, mixedHeads: 0, mixedMs: 0 });

const addHeadToRow = (row: RouteCensusRow, pure: boolean, ms: number): RouteCensusRow =>
  pure
    ? RouteCensusRow.make({ ...row, pureHeads: row.pureHeads + 1, pureMs: row.pureMs + ms })
    : RouteCensusRow.make({ ...row, mixedHeads: row.mixedHeads + 1, mixedMs: row.mixedMs + ms });

const CENSUS_ROW_ORDER: Order.Order<RouteCensusRow> = Order.combineAll([
  Order.mapInput(Order.flip(Order.Number), (row: RouteCensusRow) => row.pureMs),
  Order.mapInput(Order.flip(Order.Number), (row: RouteCensusRow) => row.mixedMs),
  Order.mapInput(Order.String, (row: RouteCensusRow) => row.kind),
  Order.mapInput(Order.String, (row: RouteCensusRow) => row.lane),
]);

// Each head adds its per-lane machine time to the (kind, lane) row of every
// kind it contains, as pure or mixed time. Purity is judged over the tree
// kinds K' (the head's kinds without `commits`, which nearly every head
// carries): a tree kind is pure when K' is exactly that kind, and `commits`
// is pure only on a head with no tree kind at all (an empty-tree head).
// Otherwise the time is mixed, so `commits` still shows mixed time on every
// head with tree changes. A head counts once per row however many jobs or
// attempts the lane ran.
const censusRows = (heads: ReadonlyArray<HeadEvidence>): ReadonlyArray<RouteCensusRow> => {
  const rows = A.reduce(heads, HashMap.empty<string, RouteCensusRow>(), (acc, head) => {
    const kinds = headKinds(head.atoms);
    const treeKinds = A.filter(kinds, (kind) => !ChangeAtomKind.is.commits(kind));
    const isPure = (kind: ChangeAtomKind): boolean =>
      ChangeAtomKind.is.commits(kind) ? A.isReadonlyArrayEmpty(treeKinds) : treeKinds.length === 1;
    return A.reduce(laneMsOfHead(head), acc, (laneAcc, [lane, ms]) =>
      A.reduce(kinds, laneAcc, (kindAcc, kind) => {
        const key = `${kind} ${lane}`;
        return HashMap.set(
          kindAcc,
          key,
          addHeadToRow(
            O.getOrElse(HashMap.get(kindAcc, key), () => emptyRow(kind, lane)),
            isPure(kind),
            ms
          )
        );
      })
    );
  });
  return A.sort(HashMap.toValues(rows), CENSUS_ROW_ORDER);
};

const lanesConcluded = (
  jobs: ReadonlyArray<readonly [CiLaneId, HostedJob]>,
  conclusion: string
): HashSet.HashSet<CiLaneId> =>
  HashSet.fromIterable(
    A.map(
      A.filter(jobs, ([, job]) => O.exists(job.conclusion, (value) => Str.Equivalence(value, conclusion))),
      ([lane]) => lane
    )
  );

const NEWEST_FIRST: Order.Order<HostedRun> = Order.mapInput(
  Order.flip(Order.String),
  (run: HostedRun) => run.createdAt
);

/**
 * Build the census and replay reader over `ChangeClassifier`, {@link RouteGit}
 * and the footprint record.
 *
 * **Details**
 *
 * Pull-request heads are the corpus runs with event `pull_request`, grouped
 * by head sha in corpus order; the base candidates are the `push` runs on
 * `main`. Both methods first make every head present (`ensureHeads`), then
 * classify each head against its merge base. The replay's base run is the
 * `main` push run of the merge base itself, else the latest `main` push run
 * whose head is an ancestor of the merge base; a lane is green there when one
 * of its jobs succeeded. With no base run every skipped red counts
 * (fail-closed) and the head is base-unknown. A head still missing after
 * `ensureHeads` is unresolved: it is neither classified nor merge-based but
 * routed as one `unknown` atom (every lane selected, base unknown) and
 * counted in `unresolvedHeads`.
 *
 * **Example** (Reference the reader constructor)
 *
 * ```ts
 * import { makeRouteCensusReader } from "@beep/repo-cli/commands/Ci/RouteCensus"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(makeRouteCensusReader)) // true
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeRouteCensusReader: Effect.Effect<
  RouteCensusShape,
  RouteError,
  ChangeClassifier | RouteGit | Crypto.Crypto
> = Effect.gen(function* () {
  const classifier = yield* ChangeClassifier;
  const git = yield* RouteGit;
  const footprintDigest = yield* routeFootprintDigest;

  const headEvidence = Effect.fn("RouteCensusReader.headEvidence")(function* (corpus: RouteCorpusLoaded) {
    const heads = pullRequestHeads(corpus.runs);
    const unresolved = HashSet.fromIterable(yield* git.ensureHeads(A.map(heads, ([headSha]) => headSha)));
    if (HashSet.size(unresolved) > 0) {
      yield* Effect.logWarning("Route heads unresolvable after fetching; routing them as unknown").pipe(
        Effect.annotateLogs({ "route.unresolved": HashSet.size(unresolved) })
      );
    }
    return yield* Effect.forEach(
      heads,
      Effect.fnUntraced(function* ([headSha, runs]: readonly [string, ReadonlyArray<HostedRun>]) {
        const jobs = hostedLaneJobs(runs);
        if (HashSet.has(unresolved, headSha)) {
          const evidence: HeadEvidence = {
            headSha,
            mergeBase: UNRESOLVED_MERGE_BASE,
            atoms: [unresolvedHeadAtom(headSha)],
            jobs,
            resolved: false,
          };
          return evidence;
        }
        const mergeBase = yield* git.mergeBase(headSha);
        const changeSet = yield* classifier.classify(
          ClassifyInput.make({ repoRoot: yield* git.repoRoot, base: mergeBase, head: headSha })
        );
        const evidence: HeadEvidence = { headSha, mergeBase, atoms: changeSet.atoms, jobs, resolved: true };
        return evidence;
      }),
      { concurrency: ROUTE_HEAD_CONCURRENCY }
    );
  });

  const census = Effect.fn("RouteCensusReader.census")(function* (corpus: RouteCorpusLoaded) {
    const heads = yield* headEvidence(corpus);
    const atoms = A.flatMap(heads, (head) => head.atoms);
    const report = RouteCensus.make({
      schemaVersion: "route-census/v1",
      corpusSha256: corpus.receipt.sha256,
      footprintDigest,
      heads: heads.length,
      classifiedHeads: A.filter(heads, (head) => A.isReadonlyArrayNonEmpty(head.atoms)).length,
      unknownAtomShare: shareOf(A.filter(atoms, isUnknownKind).length, atoms.length),
      unresolvedHeads: A.filter(heads, (head) => !head.resolved).length,
      rows: censusRows(heads),
      costs: routeLaneCosts(corpus.runs),
    });
    yield* Effect.logDebug("Route census computed").pipe(
      Effect.annotateLogs({ "route.heads": report.heads, "route.rows": report.rows.length })
    );
    return report;
  });

  const replay = Effect.fn("RouteCensusReader.replay")(function* (corpus: RouteCorpusLoaded) {
    const heads = yield* headEvidence(corpus);
    const mainRuns = A.filter(corpus.runs, isMainPushRun);
    const mainShasNewestFirst = A.dedupe(A.map(A.sort(mainRuns, NEWEST_FIRST), (run) => run.headSha));
    const mainRunsAt = (sha: string): ReadonlyArray<HostedRun> =>
      A.filter(mainRuns, (run) => Str.Equivalence(run.headSha, sha));

    const baseRuns = Effect.fnUntraced(function* (mergeBase: string) {
      const exact = mainRunsAt(mergeBase);
      if (A.isReadonlyArrayNonEmpty(exact)) {
        return O.some(exact);
      }
      const ancestor = yield* Effect.findFirst(mainShasNewestFirst, (sha) => git.isAncestor(sha, mergeBase));
      return O.map(ancestor, mainRunsAt);
    });

    const perHead = yield* Effect.forEach(
      heads,
      Effect.fnUntraced(function* (head: HeadEvidence) {
        const required = requiredLanes(head.atoms);
        const skipped = skippedLanes(required);
        const base = head.resolved ? yield* baseRuns(head.mergeBase) : O.none<ReadonlyArray<HostedRun>>();
        const red = lanesConcluded(head.jobs, "failure");
        const baseGreen = O.map(base, (runs) => lanesConcluded(hostedLaneJobs(runs), "success"));
        const baseRed = O.map(base, (runs) => lanesConcluded(hostedLaneJobs(runs), "failure"));
        return RouteReplayHead.make({
          headSha: head.headSha,
          mergeBase: head.mergeBase,
          selected: A.filter(CI_LANE_ID_VALUES, (lane) => HashMap.has(required, lane)),
          skipped,
          skippedReds: A.filter(skipped, (lane) => HashSet.has(red, lane) && !O.exists(baseRed, HashSet.has(lane))),
          baseUnknown:
            O.isNone(base) ||
            A.some(
              skipped,
              (lane) =>
                HashSet.has(red, lane) &&
                !O.exists(baseGreen, HashSet.has(lane)) &&
                !O.exists(baseRed, HashSet.has(lane))
            ),
        });
      }),
      { concurrency: ROUTE_HEAD_CONCURRENCY }
    );

    const skippedLaneRuns = Num.sumAll(A.map(perHead, (head) => head.skipped.length));
    const skippedReds = Num.sumAll(A.map(perHead, (head) => head.skippedReds.length));
    const report = RouteReplay.make({
      schemaVersion: "route-replay/v1",
      corpusSha256: corpus.receipt.sha256,
      footprintDigest,
      heads: perHead.length,
      skippedLaneRuns,
      skippedReds,
      baseUnknownHeads: A.filter(perHead, (head) => head.baseUnknown).length,
      unresolvedHeads: A.filter(heads, (head) => !head.resolved).length,
      recall: 1 - shareOf(skippedReds, skippedLaneRuns),
      perHead,
    });
    yield* Effect.logDebug("Route replay computed").pipe(
      Effect.annotateLogs({ "route.heads": report.heads, "route.recall": report.recall })
    );
    return report;
  });

  return RouteCensusReader.of({ census, replay });
}).pipe(Effect.withSpan("RouteCensusReader.make"));

/**
 * The census and replay reader layer.
 *
 * **Details**
 *
 * The caller provides `ChangeClassifier`, {@link RouteGit} (production:
 * {@link routeGitLayer}) and `Crypto`.
 *
 * **Example** (Reference the reader layer)
 *
 * ```ts
 * import { RouteCensusReaderLive } from "@beep/repo-cli/commands/Ci/RouteCensus"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(RouteCensusReaderLive)) // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export const RouteCensusReaderLive: Layer.Layer<
  RouteCensusReader,
  RouteError,
  ChangeClassifier | RouteGit | Crypto.Crypto
> = Layer.effect(RouteCensusReader, makeRouteCensusReader);
