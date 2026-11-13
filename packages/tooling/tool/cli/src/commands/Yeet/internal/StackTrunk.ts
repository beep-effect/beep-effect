/**
 * Whether the trunk's required checks are green enough to open a native stack.
 *
 * **Details**
 *
 * A stack is opened only while the trunk is green (decision
 * `2026-11-10-stack-only-on-green-main`). The trunk lands a pull request every
 * few minutes and each push cancels the run before it, so the newest commits
 * often carry no completed required run at all: the verdict walks first-parent
 * history newest to oldest and takes each required context's newest completed
 * evidence wherever it is.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Git } from "@beep/git/Git";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual, flow, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { GithubRest } from "../../../internal/github/GithubRest.ts";
import { MergeGateCheckRun, mergeGateGoodConclusion } from "./MergeGate.schemas.ts";
import { YeetTrunkCommitChecks, YeetTrunkHealth } from "./Stack.schemas.ts";
import type { GithubCheckRunRecord } from "../../../internal/github/GithubRest.ts";
import type { RepoRunContext } from "../../../internal/repo-run/index.ts";

/**
 * How many first-parent trunk commits a trunk-health read walks at most.
 *
 * **Details**
 *
 * Measured on `main`: each push cancels the previous run of the required
 * workflow, so the newest completed evidence for a required context can sit
 * fifteen or more commits back. The read stops earlier as soon as every
 * required context has evidence.
 *
 * **Example** (Read the limit)
 *
 * ```ts
 * import { YEET_TRUNK_HEALTH_COMMIT_LIMIT } from "@beep/repo-cli/test/Yeet"
 *
 * console.log(YEET_TRUNK_HEALTH_COMMIT_LIMIT) // 30
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const YEET_TRUNK_HEALTH_COMMIT_LIMIT = 30;

const shortSha = Str.slice(0, 10);

// A superseded trunk run is cancelled (or marked stale) and says nothing about the trunk.
const isSilentConclusion = S.is(S.Literals(["cancelled", "stale"]));

const isEvidence = (run: MergeGateCheckRun): boolean =>
  run.status === "completed" && P.isNotNull(run.conclusion) && !isSilentConclusion(run.conclusion);

const byRunId = Order.mapInput(Order.Number, (run: MergeGateCheckRun) => run.id);

// The newest run of one context on one commit (highest id): a re-run replaces the attempt before it.
const newestRunOf =
  (name: string) =>
  (commit: YeetTrunkCommitChecks): O.Option<MergeGateCheckRun> =>
    A.match(
      A.filter(commit.runs, (run) => run.name === name),
      { onEmpty: O.none, onNonEmpty: flow(A.max(byRunId), O.some) }
    );

interface ContextEvidence {
  readonly name: string;
  readonly run: O.Option<MergeGateCheckRun>;
}

// Each required context's newest completed evidence, commits newest first.
const trunkEvidence = (
  required: ReadonlyArray<string>,
  commits: ReadonlyArray<YeetTrunkCommitChecks>
): ReadonlyArray<ContextEvidence> =>
  A.map(A.dedupe(A.filter(required, Str.isNonEmpty)), (name) => ({
    name,
    run: A.findFirst(commits, flow(newestRunOf(name), O.filter(isEvidence))),
  }));

const namesWhere = (
  evidence: ReadonlyArray<ContextEvidence>,
  keep: (entry: ContextEvidence) => boolean
): ReadonlyArray<string> =>
  A.sort(
    A.map(A.filter(evidence, keep), (entry) => entry.name),
    Order.String
  );

const hasNoEvidence = (entry: ContextEvidence): boolean => O.isNone(entry.run);

const unknownHealth = (detail: string): YeetTrunkHealth => YeetTrunkHealth.cases.Unknown.make({ detail });

const healthOf = (evidence: ReadonlyArray<ContextEvidence>, commits: ReadonlyArray<YeetTrunkCommitChecks>) =>
  O.match(A.head(commits), {
    onNone: () => unknownHealth("no trunk commit was read"),
    onSome: ({ sha }): YeetTrunkHealth =>
      pipe(
        O.firstSomeOf([
          O.map(
            O.liftPredicate(
              namesWhere(evidence, (entry) => O.exists(entry.run, (run) => !mergeGateGoodConclusion(run.conclusion))),
              A.isReadonlyArrayNonEmpty
            ),
            (contexts): YeetTrunkHealth => YeetTrunkHealth.cases.Red.make({ sha, contexts })
          ),
          O.map(O.liftPredicate(namesWhere(evidence, hasNoEvidence), A.isReadonlyArrayNonEmpty), (missing) =>
            unknownHealth(
              `no completed run of ${A.join(missing, ", ")} in the newest ${A.length(commits)} trunk commit(s)`
            )
          ),
        ]),
        O.getOrElse((): YeetTrunkHealth => YeetTrunkHealth.cases.Green.make({ sha }))
      ),
  });

/**
 * Decide whether the trunk's required checks are green from the check runs of
 * its newest commits.
 *
 * **Details**
 *
 * `commits` is first-parent trunk history, newest first. For each required
 * context the newest commit whose newest run of that name (highest id)
 * completed with a conclusion other than `cancelled` or `stale` holds its
 * evidence; a cancelled run says nothing, so older evidence counts instead.
 * Any context whose evidence did not pass is `Red`, naming every such context.
 * Otherwise a context with no evidence in the commits read is `Unknown`, and
 * every context passing is `Green`. No required context, or no commit, is
 * `Unknown`.
 *
 * **Example** (A cancelled run defers to older evidence)
 *
 * ```ts
 * import { decideYeetTrunkHealth, MergeGateCheckRun, YeetTrunkCommitChecks } from "@beep/repo-cli/test/Yeet"
 *
 * const run = (id: number, conclusion: string) =>
 *   MergeGateCheckRun.make({ id, name: "Test Unit", status: "completed", conclusion })
 * const health = decideYeetTrunkHealth(
 *   ["Test Unit"],
 *   [
 *     YeetTrunkCommitChecks.make({ sha: "new", runs: [run(2, "cancelled")] }),
 *     YeetTrunkCommitChecks.make({ sha: "old", runs: [run(1, "success")] }),
 *   ]
 * )
 * console.log(health._tag) // "Green"
 * ```
 *
 * @param required - The required status contexts the trunk's rulesets declare.
 * @param commits - The check runs of the trunk's newest commits, newest first.
 * @returns Green or red at the trunk head, or unknown with the reason.
 * @category decisions
 * @since 0.0.0
 */
export const decideYeetTrunkHealth: {
  (required: ReadonlyArray<string>, commits: ReadonlyArray<YeetTrunkCommitChecks>): YeetTrunkHealth;
  (commits: ReadonlyArray<YeetTrunkCommitChecks>): (required: ReadonlyArray<string>) => YeetTrunkHealth;
} = dual(2, (required: ReadonlyArray<string>, commits: ReadonlyArray<YeetTrunkCommitChecks>): YeetTrunkHealth => {
  const evidence = trunkEvidence(required, commits);
  return A.isReadonlyArrayEmpty(evidence)
    ? unknownHealth("the trunk's rulesets declare no required status context")
    : healthOf(evidence, commits);
});

// The kit's check-run record in the gate's shape; a nameless run is no context's evidence.
const toTrunkCheckRuns = (runs: ReadonlyArray<GithubCheckRunRecord>): ReadonlyArray<MergeGateCheckRun> =>
  pipe(
    A.filter(runs, (run) => Str.isNonEmpty(run.name)),
    A.map((run) =>
      MergeGateCheckRun.make({
        id: run.id,
        name: run.name,
        status: run.status,
        conclusion: O.getOrNull(run.conclusion),
      })
    )
  );

/**
 * Read whether the trunk's required checks are green.
 *
 * **Details**
 *
 * Reads the trunk's required contexts from its rulesets, lists at most
 * {@link YEET_TRUNK_HEALTH_COMMIT_LIMIT} first-parent commits of
 * `origin/<trunk>` from the local clone (the publish path has just refreshed
 * it), then reads check runs one commit at a time and stops once every
 * required context has evidence, so a red verdict names every red context.
 * It never fails: a read that fails is `Unknown` with the reason, and unknown
 * never opens a stack.
 *
 * **Example** (Read the health of main)
 *
 * ```ts
 * import { readYeetTrunkHealth, RepoRunContext } from "@beep/repo-cli/test/Yeet"
 * import * as Effect from "effect/Effect"
 *
 * const context = RepoRunContext.make({
 *   base: "origin/main",
 *   branch: "feat/child",
 *   cwd: ".",
 *   head: "HEAD",
 *   originalArgv: [],
 *   packetDir: ".beep/yeet",
 *   repoRoot: ".",
 *   turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] }
 * })
 * const health = readYeetTrunkHealth(context, "main").pipe(Effect.map((verdict) => verdict._tag))
 * console.log(Effect.isEffect(health)) // true
 * ```
 *
 * @param context - The checkout whose `origin/<trunk>` history is walked.
 * @param trunk - The trunk branch, such as `main`.
 * @returns Green, red with the failing contexts, or unknown with the reason; it never fails.
 * @category workflows
 * @since 0.0.0
 */
export const readYeetTrunkHealth = Effect.fn("Yeet.readTrunkHealth")(function* (
  context: RepoRunContext,
  trunk: string
): Effect.fn.Return<YeetTrunkHealth, never, GithubRest | Git> {
  const rest = yield* GithubRest;
  const required = yield* Effect.result(rest.requiredStatusContexts(trunk));
  if (Result.isFailure(required)) {
    return unknownHealth(`${trunk}'s required status contexts could not be read: ${required.failure.message}`);
  }
  if (A.isReadonlyArrayEmpty(trunkEvidence(required.success, []))) {
    return decideYeetTrunkHealth(required.success, []);
  }
  const git = yield* Git;
  const shas = yield* Effect.result(
    git.revList(context.repoRoot, `origin/${trunk}`, { limit: YEET_TRUNK_HEALTH_COMMIT_LIMIT, firstParent: true })
  );
  if (Result.isFailure(shas)) {
    return unknownHealth(`origin/${trunk}'s first-parent history could not be listed: ${shas.failure.message}`);
  }
  let commits = A.empty<YeetTrunkCommitChecks>();
  for (const sha of shas.success) {
    const runs = yield* Effect.result(rest.checkRuns(sha));
    if (Result.isFailure(runs)) {
      return unknownHealth(
        `the check runs of ${trunk} commit ${shortSha(sha)} could not be read: ${runs.failure.message}`
      );
    }
    commits = A.append(commits, YeetTrunkCommitChecks.make({ sha, runs: toTrunkCheckRuns(runs.success) }));
    // Older commits cannot change a context's newest evidence, so stop once every context has some.
    if (!A.some(trunkEvidence(required.success, commits), hasNoEvidence)) break;
  }
  return decideYeetTrunkHealth(required.success, commits);
});
