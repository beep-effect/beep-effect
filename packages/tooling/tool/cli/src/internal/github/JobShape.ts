/**
 * Infrastructure-failure classes readable from a GitHub job record alone.
 *
 * Some hosted failures are decidable without downloading a single log line,
 * because the *shape* of the job record already proves that the repository's
 * own work never started. Three such classes have live evidence in this repo:
 * GitHub's control plane failing to resolve action download info during the
 * implicit setup step, a runner that stopped reporting mid-job, and dependency
 * installation dying before any lane ran.
 *
 * **Details**
 *
 * Both are read from the fields `gh run view --json jobs` and the REST
 * `/actions/runs/{id}/jobs` endpoint already return, so a caller that has the
 * job list has the classification for free. That matters twice over: the merge
 * loop avoids a log fetch it would often fail anyway, and the lane-timings
 * collector can separate infrastructure failures from code failures across
 * hundreds of jobs without touching the log API.
 *
 * **Gotchas**
 *
 * This module answers "did the infrastructure fail before the repo ran", not
 * "is this failure flaky". A caller deciding to rerun owns that policy and the
 * budget that bounds it.
 *
 * @internal
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliId.create("internal/github/JobShape");

/**
 * Infrastructure-failure classes decidable from a job record without its log.
 *
 * **Details**
 *
 * `setup-5xx` is the implicit `Set up job` (or `Set up runner`) step itself
 * concluding `failure` — the shape GitHub produces when it cannot resolve
 * action download info, observed across three consecutive attempts during a
 * confirmed Actions incident. `runner-loss` is a job that concluded `failure`
 * while not one of its steps ever reached a conclusion, which is a runner that
 * stopped reporting rather than a step that failed. `install-failure` is
 * dependency installation dying before any lane ran.
 *
 * **Gotchas**
 *
 * `install-failure` is the weakest of the three, and deliberately so. The other
 * two *prove* no repository code was consulted; an install failure can also be
 * a genuinely broken lockfile, which no rerun will fix. It is included anyway
 * because the observed population is dominated by network flakes — the live
 * instance was a keytar prebuild download timing out, falling back to a
 * node-gyp source build, and dying on absent `libsecret-1-dev` headers — and
 * because a caller's rerun budget is bounded per job, so a real lockfile break
 * costs exactly one rerun before it reports as spent.
 *
 * **Example** (List the shape classes)
 *
 * ```ts
 * import { GithubJobShapeClass } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(GithubJobShapeClass.Options)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const GithubJobShapeClass = LiteralKit(["setup-5xx", "runner-loss", "install-failure"]).pipe(
  $I.annoteSchema("GithubJobShapeClass", {
    title: "GitHub Job Shape Class",
    description: "An infrastructure-failure class decidable from a GitHub job record without downloading its log.",
  })
);

/**
 * Infrastructure-failure classes decidable from a job record without its log.
 *
 * @category type-level
 * @since 0.0.0
 */
export type GithubJobShapeClass = typeof GithubJobShapeClass.Type;

/**
 * One step of a GitHub job, in the shape both job APIs return.
 *
 * **Details**
 *
 * `conclusion` is `null` for every step that never reached a terminal state,
 * which is exactly the signal `runner-loss` reads. Decoding it as nullable
 * rather than dropping it keeps that absence observable.
 *
 * **Example** (Describe a step the runner never concluded)
 *
 * ```ts
 * import { GithubJobStepRecord } from "@beep/repo-cli/test/SharedInternals"
 *
 * const step = GithubJobStepRecord.make({ name: "Run bun run check", conclusion: null })
 * console.log(step.conclusion)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubJobStepRecord extends S.Class<GithubJobStepRecord>($I`GithubJobStepRecord`)(
  {
    name: S.String,
    conclusion: S.NullOr(S.String),
  },
  $I.annote("GithubJobStepRecord", {
    description: "One step of a GitHub job, carrying the conclusion it reached or null when it never did.",
  })
) {}

/**
 * The fields of a GitHub job record the shape classes are read from.
 *
 * **Details**
 *
 * `steps` defaults to empty so a payload from a `gh` version that omits the
 * field still decodes. An empty step list is also why the shape classes refuse
 * to classify: absent steps and steps that never concluded are different facts,
 * and only the second one is runner loss.
 *
 * **Example** (Describe a job whose setup step failed)
 *
 * ```ts
 * import { GithubJobRecord, GithubJobStepRecord } from "@beep/repo-cli/test/SharedInternals"
 *
 * const job = GithubJobRecord.make({
 *   conclusion: "failure",
 *   databaseId: 991,
 *   name: "Test Unit",
 *   status: "completed",
 *   steps: [GithubJobStepRecord.make({ name: "Set up job", conclusion: "failure" })],
 * })
 * console.log(job.steps.length)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GithubJobRecord extends S.Class<GithubJobRecord>($I`GithubJobRecord`)(
  {
    conclusion: S.NullOr(S.String),
    databaseId: S.Finite,
    name: S.String,
    status: S.String,
    steps: S.Array(GithubJobStepRecord).pipe(SchemaUtils.withKeyDefaults([])),
  },
  $I.annote("GithubJobRecord", {
    description: "The fields of a GitHub job record from which infrastructure-failure shape classes are read.",
  })
) {}

const SETUP_STEP_NAME_PATTERN = /^set up (?:job|runner)\b/u;

/**
 * Lower-case a nullable GitHub conclusion, keeping absence as `None`.
 *
 * **Example** (Read an absent conclusion)
 *
 * ```ts
 * import { githubConclusion } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(githubConclusion(null))
 * ```
 *
 * @param conclusion - Conclusion string as returned by a GitHub job API.
 * @returns The lower-cased conclusion, or `None` when it was null.
 * @category utilities
 * @since 0.0.0
 */
export const githubConclusion = (conclusion: string | null): O.Option<string> =>
  pipe(O.fromNullishOr(conclusion), O.map(Str.toLowerCase));

const INSTALL_STEP_NAME_PATTERN = /^(?:install dependencies|bun install|install)\b/u;
const CLEANUP_STEP_NAME_PATTERN = /^(?:post\s|complete job$)/u;

const normalizedStepName = (step: GithubJobStepRecord): string => Str.toLowerCase(Str.trim(step.name));

const stepIsFailedSetup = (step: GithubJobStepRecord): boolean =>
  SETUP_STEP_NAME_PATTERN.test(normalizedStepName(step)) &&
  O.exists(githubConclusion(step.conclusion), (value) => value === "failure");

const stepIsFailedInstall = (step: GithubJobStepRecord): boolean =>
  INSTALL_STEP_NAME_PATTERN.test(normalizedStepName(step)) &&
  O.exists(githubConclusion(step.conclusion), (value) => value === "failure");

/**
 * A step that carries no evidence about whether the repository's work ran.
 *
 * Runner cleanup — GitHub's `Post <action>` unwinds and the trailing
 * `Complete job` — concludes `success` even on a job that died at install, so
 * treating those as "a later step ran" would refuse every real install failure.
 * A `skipped` step is likewise the absence of work, not work that happened.
 */
const stepIsInconsequentialAfterFailure = (step: GithubJobStepRecord): boolean =>
  CLEANUP_STEP_NAME_PATTERN.test(normalizedStepName(step)) ||
  O.match(githubConclusion(step.conclusion), { onNone: () => true, onSome: (value) => value === "skipped" });

const installFailedBeforeAnyLane = (steps: ReadonlyArray<GithubJobStepRecord>): boolean =>
  pipe(
    A.findFirstIndex(steps, stepIsFailedInstall),
    O.exists((index) => A.every(A.drop(steps, index + 1), stepIsInconsequentialAfterFailure))
  );

/**
 * Classify a job record against the infrastructure-failure shape classes.
 *
 * **When to use**
 *
 * Use before fetching any log. Every class describes a job whose repository
 * work never started, so the log a caller would download is either absent or
 * carries nothing but infrastructure noise.
 *
 * **Details**
 *
 * Classes are tried in the order the job would have hit them — setup, then
 * install, then the all-null shape — so the earliest phase that failed is the
 * one reported. A setup failure leaves install `null`, so an unordered check
 * would let the vaguer class shadow the precise one.
 *
 * **Gotchas**
 *
 * A job with no steps at all is refused rather than read as runner loss: an
 * absent `steps` field is missing evidence, not evidence of absence.
 *
 * Only a job-level `failure` is considered. A `cancelled` job has the same
 * all-null step shape as runner loss — fail-fast cancellation stops every step
 * before it concludes — so the job-level conclusion is the only thing that
 * separates them.
 *
 * A deterministic setup failure, such as a workflow naming an action version
 * that does not exist, matches `setup-5xx` too, and a broken lockfile matches
 * `install-failure`. Callers that rerun on a match must bound the rerun; this
 * function reports shape, not flakiness.
 *
 * **Example** (Recognize a control-plane setup failure)
 *
 * ```ts
 * import { detectGithubJobShapeClass, GithubJobRecord, GithubJobStepRecord } from "@beep/repo-cli/test/SharedInternals"
 *
 * const job = GithubJobRecord.make({
 *   conclusion: "failure",
 *   databaseId: 991,
 *   name: "Test Unit",
 *   status: "completed",
 *   steps: [GithubJobStepRecord.make({ name: "Set up job", conclusion: "failure" })],
 * })
 * console.log(detectGithubJobShapeClass(job))
 * ```
 *
 * @param job - One job record from either GitHub job API.
 * @returns The matched shape class, or `None` when the record proves neither.
 * @category detection
 * @since 0.0.0
 */
export const detectGithubJobShapeClass = (job: GithubJobRecord): O.Option<GithubJobShapeClass> => {
  if (!O.exists(githubConclusion(job.conclusion), (value) => value === "failure")) {
    return O.none();
  }
  if (A.some(job.steps, stepIsFailedSetup)) {
    return O.some(GithubJobShapeClass.Enum["setup-5xx"]);
  }
  if (A.isReadonlyArrayEmpty(job.steps)) {
    return O.none();
  }
  if (installFailedBeforeAnyLane(job.steps)) {
    return O.some(GithubJobShapeClass.Enum["install-failure"]);
  }
  return A.every(job.steps, (step) => O.isNone(githubConclusion(step.conclusion)))
    ? O.some(GithubJobShapeClass.Enum["runner-loss"])
    : O.none();
};

/**
 * The one-line evidence an operator needs to act on a shape class.
 *
 * **When to use**
 *
 * Use when reporting a match. The class name says what shape was seen; this
 * says what that shape has historically meant, which is what decides whether an
 * operator investigates or waits out a rerun.
 *
 * **Example** (Explain an install failure)
 *
 * ```ts
 * import { githubJobShapeEvidence } from "@beep/repo-cli/test/SharedInternals"
 *
 * console.log(githubJobShapeEvidence("install-failure"))
 * ```
 *
 * @param shapeClass - The matched shape class.
 * @returns A single sentence naming the observed mechanism.
 * @category formatting
 * @since 0.0.0
 */
export const githubJobShapeEvidence = (shapeClass: GithubJobShapeClass): string =>
  GithubJobShapeClass.$match(shapeClass, {
    "setup-5xx": () => "GitHub could not resolve action download info; no repo command ran",
    "runner-loss": () => "the job failed while no step ever concluded; the runner stopped reporting",
    "install-failure": () =>
      "dependency install failed before any lane ran (observed: keytar prebuild download timeout, node-gyp fallback, absent libsecret-1-dev headers)",
  });
