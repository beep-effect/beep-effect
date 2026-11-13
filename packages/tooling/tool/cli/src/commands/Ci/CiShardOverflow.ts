/**
 * Shard overflow routing: which planned Test Unit partitions a Check run sends
 * to the self-hosted overflow pool instead of the GitHub-hosted queue.
 *
 * **Details**
 *
 * Operator decision 2026-11-13 (goals/ci-lane-economics): shards stay on
 * GitHub-hosted runners, and a shard runs on the self-hosted pool only when
 * the hosted wait would pass ten minutes. Test Plan decides once per run, when
 * its partition plan is ready, from the one signal that job can read with its
 * own `GITHUB_TOKEN`: how many jobs wait for a hosted runner across this
 * repository's queued and in-progress workflow runs. The predicted wait is that
 * count times the measured mean hosted body divided by the hosted concurrency
 * ({@link predictedHostedWaitSeconds}); the replay in
 * `research/shard-overflow-routing-2026-11-13.md` calibrates it.
 *
 * The same listing counts the overflow jobs already queued or running, so a
 * run routes only into free overflow VMs and keeps the rest of its partitions
 * hosted. A routed shard therefore never waits behind a full pool, which is
 * what keeps the rule from doing worse than staying hosted.
 *
 * {@link decideShardOverflow} is the whole decision and is pure; the command
 * only reads the queue (spawning `gh api`) and writes the outputs. Every way
 * the decision can fail to route keeps every partition hosted: the switch is
 * off, the event is not trusted, the overflow workflow is not yet pinned to
 * `main`, the queue cannot be read, a tuning variable is malformed, the wait is
 * under the limit, or the pool is full.
 *
 * **Gotchas**
 *
 * The command belongs to the pre-toolchain bootstrap set, so it runs from the
 * compiled CI binary on push runs, where Test Plan installs nothing. A pinned
 * binary that predates it does not have the command; `check.yml` therefore
 * runs the step only while the `BEEP_SHARD_OVERFLOW` variable is `on`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { CiCommandError } from "./Ci.errors.ts";

const $I = $RepoCliId.create("commands/Ci/CiShardOverflow");

/**
 * The runner label a routed shard requests: the overflow pool's only label.
 *
 * **Example** (Print the overflow label)
 *
 * ```ts
 * import { SHARD_OVERFLOW_RUNNER_LABEL } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(SHARD_OVERFLOW_RUNNER_LABEL) // "beep-shard-overflow"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SHARD_OVERFLOW_RUNNER_LABEL = "beep-shard-overflow";

/**
 * The overflow pool's VM cap: 48 eight-vCPU `.2xlarge` workers, 384 vCPU.
 *
 * **Details**
 *
 * The account's standard Spot quota is 512 vCPU and the heavy pool draws on
 * it too; `infra/src/CiShardOverflowPool.ts` checks the sum.
 *
 * **Example** (Print the pool size)
 *
 * ```ts
 * import { SHARD_OVERFLOW_POOL_SIZE } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(SHARD_OVERFLOW_POOL_SIZE) // 48
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SHARD_OVERFLOW_POOL_SIZE = 48;

/**
 * The predicted hosted wait above which a run routes: the operator's ten minutes.
 *
 * **Example** (Print the default limit)
 *
 * ```ts
 * import { SHARD_OVERFLOW_WAIT_LIMIT_SECONDS } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(SHARD_OVERFLOW_WAIT_LIMIT_SECONDS) // 600
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SHARD_OVERFLOW_WAIT_LIMIT_SECONDS = 600;

/**
 * Concurrent GitHub-hosted jobs the organization's plan admits.
 *
 * **Example** (Print the hosted concurrency)
 *
 * ```ts
 * import { SHARD_OVERFLOW_HOSTED_CONCURRENCY } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(SHARD_OVERFLOW_HOSTED_CONCURRENCY) // 60
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SHARD_OVERFLOW_HOSTED_CONCURRENCY = 60;

/**
 * Mean hosted job body in seconds over the 2026-11-10..13 Check runs.
 *
 * **Example** (Print the mean hosted body)
 *
 * ```ts
 * import { SHARD_OVERFLOW_HOSTED_BODY_SECONDS } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(SHARD_OVERFLOW_HOSTED_BODY_SECONDS) // 330
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SHARD_OVERFLOW_HOSTED_BODY_SECONDS = 330;

/**
 * Most workflow runs whose jobs one decision lists: a bound on its API calls.
 *
 * **Details**
 *
 * The listing costs two run reads plus one jobs read per run. The busiest hour
 * of 2026-11-10..13 had at most 17 other Check runs in flight; at 40 runs the
 * hosted queue is saturated and the newest 40 already carry the verdict.
 *
 * **Example** (Print the run bound)
 *
 * ```ts
 * import { SHARD_OVERFLOW_MAX_RUNS_READ } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(SHARD_OVERFLOW_MAX_RUNS_READ) // 40
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SHARD_OVERFLOW_MAX_RUNS_READ = 40;

const GITHUB_HOSTED_LABEL_PATTERN = /^(?:ubuntu|windows|macos)-/u;
const JOBS_READ_CONCURRENCY = 8;

/**
 * How `check.yml` calls the overflow workflow, which decides who may route.
 *
 * **Details**
 *
 * The overflow runner group admits only `shard-overflow.yml` at
 * `refs/heads/main`. A `local` call (`./.github/workflows/shard-overflow.yml`)
 * resolves to that ref only on a push to `main`; on a pull request it resolves
 * to the pull request's merge ref, which the group refuses, so a `local`
 * caller routes push runs only. A `pinned` call (`...@main`) resolves to `main`
 * for every caller.
 *
 * **Example** (Check a callee form)
 *
 * ```ts
 * import { ShardOverflowCallee } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(ShardOverflowCallee.is.pinned("pinned")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ShardOverflowCallee = LiteralKit(["local", "pinned"]).pipe(
  $I.annoteSchema("ShardOverflowCallee", {
    description: "How check.yml calls the overflow reusable workflow: by local path or pinned to main.",
  })
);

/**
 * How `check.yml` calls the overflow workflow.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ShardOverflowCallee = typeof ShardOverflowCallee.Type;

/**
 * Why a run did or did not route partitions to the overflow pool.
 *
 * **Details**
 *
 * `routed` is the only reason with overflow partitions. The others follow the
 * gate order: `disabled` (the switch is not `on`), `no-partitions`,
 * `untrusted-event` (neither a push nor a pull request from this repository),
 * `callee-not-pinned` (a pull request while the caller still uses the local
 * path), `invalid-setting` (a tuning variable that is not a whole number),
 * `queue-unreadable`, `below-limit` and `pool-full`.
 *
 * **Example** (Check a reason)
 *
 * ```ts
 * import { ShardOverflowReason } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(ShardOverflowReason.is["below-limit"]("below-limit")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ShardOverflowReason = LiteralKit([
  "disabled",
  "no-partitions",
  "untrusted-event",
  "callee-not-pinned",
  "invalid-setting",
  "queue-unreadable",
  "below-limit",
  "pool-full",
  "routed",
]).pipe(
  $I.annoteSchema("ShardOverflowReason", {
    description: "Why a Check run did or did not route Test Unit partitions to the overflow pool.",
  })
);

/**
 * Why a run did or did not route partitions to the overflow pool.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ShardOverflowReason = typeof ShardOverflowReason.Type;

const NonNegativeInt = S.Int.check(S.isGreaterThanOrEqualTo(0));
const PositiveInt = S.Int.check(S.isGreaterThanOrEqualTo(1));
const Partitions = S.Array(S.NonEmptyString);

/**
 * What one read of the Actions API says about both runner queues.
 *
 * **Example** (Describe a busy queue)
 *
 * ```ts
 * import { ShardOverflowQueue } from "@beep/repo-cli/commands/Ci"
 *
 * const queue = ShardOverflowQueue.make({ queuedHostedJobs: 120, overflowJobs: 12, runsRead: 14 })
 * console.log(queue.queuedHostedJobs) // 120
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShardOverflowQueue extends S.Opaque<ShardOverflowQueue, { readonly brand: unique symbol }>()(
  S.Struct({
    queuedHostedJobs: NonNegativeInt,
    overflowJobs: NonNegativeInt,
    runsRead: NonNegativeInt,
  }).pipe(
    $I.annoteSchema("ShardOverflowQueue", {
      description:
        "Jobs waiting for a GitHub-hosted runner, and overflow jobs queued or running, across the runs read.",
    })
  )
) {}

/**
 * Everything the routing decision reads, gathered by the command.
 *
 * **Details**
 *
 * `enabled` is the `BEEP_SHARD_OVERFLOW` repository variable read as `on`.
 * `headRepository` is the pull request head's `owner/name` and empty on a
 * push. `partitions` is the run's Test Unit plan, in plan order. `queue` is
 * `None` when the Actions API could not be read. `waitLimitSeconds` and
 * `poolSize` are `None` when their variable is malformed.
 *
 * **Example** (Describe a pushed main run)
 *
 * ```ts
 * import { ShardOverflowFacts, ShardOverflowQueue } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const facts = ShardOverflowFacts.make({
 *   enabled: true,
 *   callee: "local",
 *   eventName: "push",
 *   ref: "refs/heads/main",
 *   repository: "beep-effect/beep-effect",
 *   headRepository: "",
 *   partitions: ["repo-cli-1", "unit-a"],
 *   queue: O.some(ShardOverflowQueue.make({ queuedHostedJobs: 120, overflowJobs: 0, runsRead: 9 })),
 *   waitLimitSeconds: O.some(600),
 *   poolSize: O.some(48),
 * })
 * console.log(facts.partitions.length) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShardOverflowFacts extends S.Opaque<ShardOverflowFacts, { readonly brand: unique symbol }>()(
  S.Struct({
    enabled: S.Boolean,
    callee: ShardOverflowCallee,
    eventName: S.String,
    ref: S.String,
    repository: S.String,
    headRepository: S.String,
    partitions: Partitions,
    queue: S.Option(ShardOverflowQueue),
    waitLimitSeconds: S.Option(NonNegativeInt),
    poolSize: S.Option(PositiveInt),
  }).pipe(
    $I.annoteSchema("ShardOverflowFacts", {
      description: "Event, switch, plan and queue facts the shard overflow decision reads.",
    })
  )
) {}

/**
 * Which partitions stay hosted, which are routed, and why.
 *
 * **Details**
 *
 * `hosted` and `overflow` partition the plan: together they hold every planned
 * partition exactly once, in plan order. `predictedWaitSeconds` and `freeVms`
 * are present once the queue was read.
 *
 * **Example** (Describe a run that stayed hosted)
 *
 * ```ts
 * import { ShardOverflowDecision } from "@beep/repo-cli/commands/Ci"
 *
 * const decision = ShardOverflowDecision.make({ reason: "disabled", hosted: ["unit-a"], overflow: [] })
 * console.log(decision.overflow.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShardOverflowDecision extends S.Opaque<ShardOverflowDecision, { readonly brand: unique symbol }>()(
  S.Struct({
    reason: ShardOverflowReason,
    hosted: Partitions,
    overflow: Partitions,
    predictedWaitSeconds: S.Finite.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
    freeVms: S.Int.pipe(S.OptionFromOptionalKey, S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("ShardOverflowDecision", {
      description: "The hosted and overflow halves of a Test Unit plan and the reason for the split.",
    })
  )
) {}

/**
 * One job of the Actions jobs listing, reduced to what the queue count reads.
 *
 * **Example** (Describe a queued hosted job)
 *
 * ```ts
 * import { ShardOverflowJob } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(ShardOverflowJob.make({ status: "queued", labels: ["ubuntu-24.04"] }).status) // "queued"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShardOverflowJob extends S.Opaque<ShardOverflowJob, { readonly brand: unique symbol }>()(
  S.Struct({
    status: S.String,
    labels: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("ShardOverflowJob", {
      description: "A workflow job's status and requested runner labels.",
    })
  )
) {}

/**
 * Predicted wait in seconds for a job joining a hosted queue of `queued` jobs.
 *
 * **Details**
 *
 * The hosted pool drains about {@link SHARD_OVERFLOW_HOSTED_CONCURRENCY} jobs
 * per {@link SHARD_OVERFLOW_HOSTED_BODY_SECONDS}, so each queued job ahead adds
 * 5.5 seconds; 110 queued jobs is a ten-minute wait.
 *
 * **Example** (Predict the wait behind 120 queued jobs)
 *
 * ```ts
 * import { predictedHostedWaitSeconds } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(predictedHostedWaitSeconds(120)) // 660
 * ```
 *
 * @param queued - Jobs waiting for a hosted runner.
 * @returns How long the job waits for a runner, assuming the queue drains at the measured rate.
 * @category utilities
 * @since 0.0.0
 */
export const predictedHostedWaitSeconds = (queued: number): number =>
  (queued * SHARD_OVERFLOW_HOSTED_BODY_SECONDS) / SHARD_OVERFLOW_HOSTED_CONCURRENCY;

/**
 * Whether the event may ever reach a self-hosted runner.
 *
 * **Details**
 *
 * Mirrors the job condition of `shard-overflow.yml`: a push, or a pull request
 * whose head repository is this repository. A fork's pull request, and any
 * other event, stays hosted.
 *
 * **Example** (Refuse a fork)
 *
 * ```ts
 * import { isShardOverflowTrustedEvent } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(
 *   isShardOverflowTrustedEvent({
 *     eventName: "pull_request",
 *     headRepository: "someone/beep-effect",
 *     repository: "beep-effect/beep-effect",
 *   })
 * ) // false
 * ```
 *
 * @param event - `GITHUB_EVENT_NAME`, the pull request head's `owner/name` and `GITHUB_REPOSITORY`.
 * @returns `true` for a push or a same-repository pull request.
 * @category predicates
 * @since 0.0.0
 */
export const isShardOverflowTrustedEvent = (
  event: Pick<ShardOverflowFacts, "eventName" | "headRepository" | "repository">
): boolean =>
  event.eventName === "push" ||
  (event.eventName === "pull_request" && Str.isNonEmpty(event.repository) && event.headRepository === event.repository);

/**
 * Count the hosted queue and the overflow pool's load from a jobs listing.
 *
 * **Details**
 *
 * A hosted job waits when its status is `queued` and a label names a
 * GitHub-hosted image. An overflow job holds or is about to hold a VM while it
 * is `queued` or `in_progress` with the overflow label.
 *
 * **Example** (Count two jobs)
 *
 * ```ts
 * import { ShardOverflowJob, shardOverflowQueueOf } from "@beep/repo-cli/commands/Ci"
 *
 * const queue = shardOverflowQueueOf(
 *   [
 *     ShardOverflowJob.make({ status: "queued", labels: ["ubuntu-24.04"] }),
 *     ShardOverflowJob.make({ status: "in_progress", labels: ["beep-shard-overflow"] }),
 *   ],
 *   1
 * )
 * console.log(queue.queuedHostedJobs, queue.overflowJobs) // 1 1
 * ```
 *
 * @param jobs - Every job of the runs read.
 * @param runsRead - How many runs the listing covered.
 * @returns The queue counts.
 * @category utilities
 * @since 0.0.0
 */
export const shardOverflowQueueOf: {
  (runsRead: number): (jobs: ReadonlyArray<ShardOverflowJob>) => ShardOverflowQueue;
  (jobs: ReadonlyArray<ShardOverflowJob>, runsRead: number): ShardOverflowQueue;
} = dual(
  2,
  (jobs: ReadonlyArray<ShardOverflowJob>, runsRead: number): ShardOverflowQueue =>
    ShardOverflowQueue.make({
      queuedHostedJobs: A.length(
        A.filter(
          jobs,
          (job) => job.status === "queued" && A.some(job.labels, (label) => GITHUB_HOSTED_LABEL_PATTERN.test(label))
        )
      ),
      overflowJobs: A.length(
        A.filter(
          jobs,
          (job) =>
            (job.status === "queued" || job.status === "in_progress") &&
            A.contains(job.labels, SHARD_OVERFLOW_RUNNER_LABEL)
        )
      ),
      runsRead,
    })
);

const stayHosted = (
  facts: ShardOverflowFacts,
  reason: ShardOverflowReason,
  measured: Pick<ShardOverflowDecision, "predictedWaitSeconds" | "freeVms"> = {
    predictedWaitSeconds: O.none(),
    freeVms: O.none(),
  }
): ShardOverflowDecision =>
  ShardOverflowDecision.make({ reason, hosted: facts.partitions, overflow: A.empty(), ...measured });

// The refusals that need no queue reading, in ShardOverflowReason order; the first that holds decides.
const shardOverflowGates: ReadonlyArray<readonly [ShardOverflowReason, (facts: ShardOverflowFacts) => boolean]> = [
  ["disabled", (facts) => !facts.enabled],
  ["no-partitions", (facts) => A.isReadonlyArrayEmpty(facts.partitions)],
  ["untrusted-event", (facts) => !isShardOverflowTrustedEvent(facts)],
  // A local call resolves to refs/heads/main, which the runner group admits, only on a push to main.
  [
    "callee-not-pinned",
    (facts) => facts.callee === "local" && !(facts.eventName === "push" && facts.ref === "refs/heads/main"),
  ],
  ["invalid-setting", (facts) => O.isNone(facts.waitLimitSeconds) || O.isNone(facts.poolSize)],
];

const routeIntoFreeVms = (
  facts: ShardOverflowFacts,
  read: { readonly queue: ShardOverflowQueue; readonly poolSize: number; readonly waitLimit: number }
): ShardOverflowDecision => {
  const predictedWaitSeconds = predictedHostedWaitSeconds(read.queue.queuedHostedJobs);
  const freeVms = Math.max(0, read.poolSize - read.queue.overflowJobs);
  const measured = { predictedWaitSeconds: O.some(predictedWaitSeconds), freeVms: O.some(freeVms) };
  if (predictedWaitSeconds <= read.waitLimit) return stayHosted(facts, "below-limit", measured);
  if (freeVms === 0) return stayHosted(facts, "pool-full", measured);
  const [overflow, hosted] = A.splitAt(facts.partitions, freeVms);
  return ShardOverflowDecision.make({ reason: "routed", hosted, overflow, ...measured });
};

/**
 * Split a run's Test Unit plan between the hosted queue and the overflow pool.
 *
 * **Details**
 *
 * The gates run in {@link ShardOverflowReason} order and every refusal keeps
 * the whole plan hosted. Past them, the run routes the first
 * `min(partitions, free VMs)` partitions in plan order, where the free VMs are
 * the pool size less the overflow jobs already queued or running.
 *
 * **Example** (Route a busy pushed run into a half-full pool)
 *
 * ```ts
 * import { decideShardOverflow, ShardOverflowFacts, ShardOverflowQueue } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const decision = decideShardOverflow(
 *   ShardOverflowFacts.make({
 *     enabled: true,
 *     callee: "local",
 *     eventName: "push",
 *     ref: "refs/heads/main",
 *     repository: "beep-effect/beep-effect",
 *     headRepository: "",
 *     partitions: ["repo-cli-1", "repo-cli-2", "unit-a"],
 *     queue: O.some(ShardOverflowQueue.make({ queuedHostedJobs: 130, overflowJobs: 46, runsRead: 12 })),
 *     waitLimitSeconds: O.some(600),
 *     poolSize: O.some(48),
 *   })
 * )
 * console.log(decision.reason, decision.overflow, decision.hosted) // routed ["repo-cli-1","repo-cli-2"] ["unit-a"]
 * ```
 *
 * @param facts - The run's switch, event, plan and queue.
 * @returns The hosted and overflow partitions and the reason.
 * @category use-cases
 * @since 0.0.0
 */
export const decideShardOverflow = (facts: ShardOverflowFacts): ShardOverflowDecision =>
  O.match(
    A.findFirst(shardOverflowGates, ([, refuses]) => refuses(facts)),
    {
      onSome: ([reason]) => stayHosted(facts, reason),
      onNone: () =>
        O.match(O.all({ queue: facts.queue, poolSize: facts.poolSize, waitLimit: facts.waitLimitSeconds }), {
          onNone: () => stayHosted(facts, "queue-unreadable"),
          onSome: (read) => routeIntoFreeVms(facts, read),
        }),
    }
  );

const minutesAndSeconds = (seconds: number): string => {
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}m${Str.padStart(2, "0")(`${whole % 60}`)}s`;
};

/**
 * The one-line log summary of a decision.
 *
 * **Example** (Summarise a routed run)
 *
 * ```ts
 * import { renderShardOverflowSummary, ShardOverflowDecision } from "@beep/repo-cli/commands/Ci"
 * import * as O from "effect/Option"
 *
 * const decision = ShardOverflowDecision.make({
 *   reason: "routed",
 *   hosted: ["unit-a"],
 *   overflow: ["repo-cli-1"],
 *   predictedWaitSeconds: O.some(660),
 *   freeVms: O.some(1),
 * })
 * console.log(renderShardOverflowSummary(decision))
 * // shard-overflow: routed; 1 of 2 Test Unit partitions to beep-shard-overflow (predicted hosted wait 11m00s; 1 overflow VMs free)
 * ```
 *
 * @param decision - The decision to describe.
 * @returns The summary line.
 * @category formatting
 * @since 0.0.0
 */
export const renderShardOverflowSummary = (decision: ShardOverflowDecision): string => {
  const total = A.length(decision.hosted) + A.length(decision.overflow);
  const measured = pipe(
    O.zipWith(
      decision.predictedWaitSeconds,
      decision.freeVms,
      (wait, free) => ` (predicted hosted wait ${minutesAndSeconds(wait)}; ${free} overflow VMs free)`
    ),
    O.getOrElse(() => "")
  );
  return `shard-overflow: ${decision.reason}; ${A.length(decision.overflow)} of ${total} Test Unit partitions to ${SHARD_OVERFLOW_RUNNER_LABEL}${measured}`;
};

const encodePartitions = S.encodeEffect(S.fromJsonString(Partitions));

/**
 * The `GITHUB_OUTPUT` lines `check.yml` reads from a decision.
 *
 * **Example** (Render the outputs of a hosted run)
 *
 * ```ts
 * import { renderShardOverflowOutputs, ShardOverflowDecision } from "@beep/repo-cli/commands/Ci"
 *
 * import * as Effect from "effect/Effect"
 *
 * const decision = ShardOverflowDecision.make({ reason: "below-limit", hosted: ["unit-a"], overflow: [] })
 * console.log(Effect.isEffect(renderShardOverflowOutputs(decision))) // true
 * // succeeds with: test_unit_hosted=["unit-a"], test_unit_overflow=[], shard_overflow_reason=below-limit
 * ```
 *
 * @param decision - The decision to publish.
 * @returns The newline-terminated `name=value` lines.
 * @category formatting
 * @since 0.0.0
 */
export const renderShardOverflowOutputs = Effect.fn("Ci.renderShardOverflowOutputs")(function* (
  decision: ShardOverflowDecision
) {
  const hosted = yield* encodePartitions(decision.hosted);
  const overflow = yield* encodePartitions(decision.overflow);
  return A.join(
    [`test_unit_hosted=${hosted}`, `test_unit_overflow=${overflow}`, `shard_overflow_reason=${decision.reason}`, ""],
    "\n"
  );
}, CiCommandError.mapError("shard-overflow: could not encode the partition split"));

const decodeRunIdLine = S.decodeUnknownOption(S.FiniteFromString);
const decodeJobLine = S.decodeUnknownOption(S.fromJsonString(ShardOverflowJob));

const ghLines = Effect.fn("Ci.shardOverflowGhLines")(function* (args: ReadonlyArray<string>) {
  const gh = yield* ChildProcessSpawner.ChildProcessSpawner.use((spawner) =>
    spawner.spawn(ChildProcess.make("gh", args, { stdin: "ignore", stderr: "inherit" }))
  );
  const lines = gh.stdout.pipe(Stream.decodeText, Stream.splitLines, Stream.filter(Str.isNonEmpty), Stream.runCollect);
  const [collected, exit] = yield* Effect.zip(lines, gh.exitCode, { concurrent: true });
  return exit === 0 ? A.fromIterable(collected) : yield* Effect.fail(`gh ${A.join(args, " ")} exited ${exit}`);
}, Effect.scoped);

const runIdsWithStatus = (status: string) =>
  ghLines([
    "api",
    "--method",
    "GET",
    "repos/{owner}/{repo}/actions/runs",
    "-f",
    `status=${status}`,
    "-f",
    "per_page=100",
    "--jq",
    ".workflow_runs[].id",
  ]).pipe(
    Effect.flatMap((lines) =>
      Effect.forEach(lines, (line) => Effect.fromOption(decodeRunIdLine(line), () => `unexpected run id ${line}`))
    )
  );

const runJobs = (runId: number) =>
  ghLines([
    "api",
    "--method",
    "GET",
    "--paginate",
    `repos/{owner}/{repo}/actions/runs/${runId}/jobs`,
    "-f",
    "filter=latest",
    "-f",
    "per_page=100",
    "--jq",
    ".jobs[] | {status, labels}",
  ]).pipe(
    Effect.flatMap((lines) =>
      Effect.forEach(lines, (line) => Effect.fromOption(decodeJobLine(line), () => `unexpected job ${line}`))
    )
  );

/**
 * Read both queues through `gh api` with the job's `GITHUB_TOKEN`.
 *
 * **Details**
 *
 * Lists this repository's in-progress and queued workflow runs (two calls),
 * keeps the newest {@link SHARD_OVERFLOW_MAX_RUNS_READ}, and lists each one's
 * latest jobs (one call per run, eight at a time). `gh` resolves
 * `{owner}/{repo}` from `GH_REPO` and authenticates with `GH_TOKEN`. Any
 * failed call, non-zero exit or unexpected line yields `None`, which keeps the
 * whole plan hosted.
 *
 * **Example** (Build the queue read)
 *
 * ```ts
 * import { readShardOverflowQueue } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(readShardOverflowQueue)) // true
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const readShardOverflowQueue: Effect.Effect<
  O.Option<ShardOverflowQueue>,
  never,
  ChildProcessSpawner.ChildProcessSpawner
> = Effect.gen(function* () {
  const inProgress = yield* runIdsWithStatus("in_progress");
  const queued = yield* runIdsWithStatus("queued");
  const runIds = A.take(A.dedupe(A.appendAll(inProgress, queued)), SHARD_OVERFLOW_MAX_RUNS_READ);
  const jobs = yield* Effect.forEach(runIds, runJobs, { concurrency: JOBS_READ_CONCURRENCY });
  return shardOverflowQueueOf(A.flatten(jobs), A.length(runIds));
}).pipe(
  Effect.asSome,
  Effect.catch((failure) =>
    Console.error(`shard-overflow: the Actions queue could not be read (${String(failure)}); staying hosted`).pipe(
      Effect.as(O.none<ShardOverflowQueue>())
    )
  )
);

const decodePlan = S.decodeUnknownEffect(S.fromJsonString(Partitions));
const optionalText = (name: string) => Config.String(name).pipe(Config.withDefault(""));
const decodeWholeNumber = S.decodeUnknownOption(S.FiniteFromString.check(S.isInt()));
const setting = (raw: string, fallback: number): O.Option<number> =>
  Str.isEmpty(Str.trim(raw)) ? O.some(fallback) : O.filter(decodeWholeNumber(Str.trim(raw)), (value) => value >= 0);

/**
 * Gather the facts, decide, and publish the split to `GITHUB_OUTPUT`.
 *
 * **Details**
 *
 * Reads `BEEP_SHARD_OVERFLOW` (`on` enables), `BEEP_SHARD_OVERFLOW_WAIT_SECONDS`
 * and `BEEP_SHARD_OVERFLOW_POOL_SIZE` (empty takes the default),
 * `GITHUB_EVENT_NAME`, `GITHUB_REF`, `GITHUB_REPOSITORY` and
 * `BEEP_CI_HEAD_REPOSITORY`. The queue is read only once every cheaper gate
 * passed, so a disabled, untrusted or unpinned run makes no API call. A plan
 * that is not a JSON array of unique partition ids fails the command.
 *
 * **Example** (Build the routing program)
 *
 * ```ts
 * import { runShardOverflow } from "@beep/repo-cli/commands/Ci"
 * import * as Effect from "effect/Effect"
 *
 * console.log(Effect.isEffect(runShardOverflow({ partitions: '["unit-a"]', callee: "local" }))) // true
 * ```
 *
 * @param input - The plan JSON and the caller's callee form.
 * @returns The published decision.
 * @category use-cases
 * @since 0.0.0
 */
export const runShardOverflow = Effect.fn("Ci.runShardOverflow")(function* (input: {
  readonly partitions: string;
  readonly callee: ShardOverflowCallee;
}) {
  const partitions = yield* decodePlan(input.partitions).pipe(
    CiCommandError.mapError("shard-overflow: --partitions must be a JSON array of partition ids")
  );
  if (A.length(A.dedupe(partitions)) !== A.length(partitions)) {
    return yield* CiCommandError.make({ message: "shard-overflow: --partitions repeats a partition id" });
  }
  const switchValue = yield* optionalText("BEEP_SHARD_OVERFLOW");
  const eventName = yield* optionalText("GITHUB_EVENT_NAME");
  const ref = yield* optionalText("GITHUB_REF");
  const repository = yield* optionalText("GITHUB_REPOSITORY");
  const headRepository = yield* optionalText("BEEP_CI_HEAD_REPOSITORY");
  const waitLimit = yield* optionalText("BEEP_SHARD_OVERFLOW_WAIT_SECONDS");
  const poolSize = yield* optionalText("BEEP_SHARD_OVERFLOW_POOL_SIZE");
  const gates = ShardOverflowFacts.make({
    enabled: Str.trim(switchValue) === "on",
    callee: input.callee,
    eventName,
    ref,
    repository,
    headRepository,
    partitions,
    queue: O.none(),
    waitLimitSeconds: setting(waitLimit, SHARD_OVERFLOW_WAIT_LIMIT_SECONDS),
    poolSize: O.filter(setting(poolSize, SHARD_OVERFLOW_POOL_SIZE), (size) => size >= 1),
  });
  const gated = decideShardOverflow(gates);
  // The queue is read only once every cheaper gate passed: a disabled, untrusted or unpinned run makes no call.
  const queue = gated.reason === "queue-unreadable" ? yield* readShardOverflowQueue : O.none<ShardOverflowQueue>();
  const decision = O.isSome(queue) ? decideShardOverflow(ShardOverflowFacts.make({ ...gates, queue })) : gated;
  const target = yield* optionalText("GITHUB_OUTPUT");
  if (Str.isNonEmpty(target)) {
    const fs = yield* FileSystem.FileSystem;
    const outputs = yield* renderShardOverflowOutputs(decision);
    yield* fs
      .writeFileString(target, outputs, { flag: "a" })
      .pipe(CiCommandError.mapError(`shard-overflow: could not append to ${target}`));
  }
  yield* Console.log(renderShardOverflowSummary(decision));
  return decision;
});

/**
 * `beep ci shard-overflow`: split the Test Unit plan between hosted runners and the overflow pool.
 *
 * **Example** (Register the command)
 *
 * ```ts
 * import { ciShardOverflowCommand } from "@beep/repo-cli/commands/Ci"
 *
 * console.log(ciShardOverflowCommand.name) // "shard-overflow"
 * ```
 *
 * @category cli-commands
 * @since 0.0.0
 */
export const ciShardOverflowCommand = Command.make(
  "shard-overflow",
  {
    partitions: Flag.String("partitions").pipe(Flag.withDescription("The run's Test Unit plan, a JSON array")),
    callee: Flag.Literals("callee", ShardOverflowCallee.literals).pipe(
      Flag.withDescription("How check.yml calls shard-overflow.yml: local path or pinned to main")
    ),
  },
  (input) => runShardOverflow(input).pipe(Effect.asVoid)
).pipe(
  Command.withDescription("Route Test Unit partitions to the self-hosted overflow pool when the hosted queue is long")
);
