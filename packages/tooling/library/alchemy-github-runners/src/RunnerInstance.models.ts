/**
 * The `ghr:*` EC2 tag vocabulary and the runner inventory row.
 *
 * Tag keys are upstream's (github-aws-runners/terraform-aws-github-runner
 * v7.10.1, MIT; see the package README), so tooling written for the upstream
 * module reads these instances unchanged.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyGithubRunnersId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const $I = $AlchemyGithubRunnersId.create("RunnerInstance.models");

/**
 * EC2 tag keys the fleet writes and reads.
 *
 * **Details**
 *
 * `application` marks every fleet instance (`github-action-runner`);
 * `environment` names the pool; `type` and `owner` are the registration scope;
 * `githubRunnerId` is written after JIT registration; `orphan` is set by
 * scale-down on instances that never registered; `bypassRemoval` lets an
 * operator keep an instance out of scale-down; `ssmConfigPath`, `tokenPath`
 * and `runnerNamePrefix` are read by the runner's user data through instance
 * metadata tags.
 *
 * **Example** (Read a tag key)
 *
 * ```ts
 * import { RunnerTag } from "@beep/alchemy-github-runners/RunnerInstance.models"
 *
 * console.log(RunnerTag.owner) // "ghr:Owner"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const RunnerTag = {
  application: "ghr:Application",
  createdBy: "ghr:created_by",
  environment: "ghr:environment",
  type: "ghr:Type",
  owner: "ghr:Owner",
  githubRunnerId: "ghr:github_runner_id",
  orphan: "ghr:orphan",
  bypassRemoval: "ghr:bypass-removal",
  tokenPath: "ghr:token_path",
  runnerNamePrefix: "ghr:runner_name_prefix",
} as const;

/**
 * Value of the {@link RunnerTag.application} tag on every fleet instance.
 *
 * **Example** (Filter value)
 *
 * ```ts
 * import { runnerApplicationTagValue } from "@beep/alchemy-github-runners/RunnerInstance.models"
 *
 * console.log(runnerApplicationTagValue) // "github-action-runner"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const runnerApplicationTagValue = "github-action-runner";

/**
 * One fleet instance as the inventory reports it.
 *
 * **Details**
 *
 * `owner` and `type` are `None` when the tags are missing, which scale-down
 * treats as "not ours to evaluate". `launchTime` is epoch milliseconds.
 *
 * **Example** (A registered runner)
 *
 * ```ts
 * import { RunnerInstance } from "@beep/alchemy-github-runners/RunnerInstance.models"
 * import * as O from "effect/Option"
 *
 * const runner = RunnerInstance.make({
 *   instanceId: "i-0123456789abcdef0",
 *   launchTime: O.some(0),
 *   owner: O.some("beep-effect"),
 *   type: O.some("Org"),
 *   githubRunnerId: O.some("17"),
 * })
 * console.log(runner.orphan) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunnerInstance extends S.Opaque<RunnerInstance, { readonly brand: unique symbol }>()(
  S.Struct({
    instanceId: S.String,
    launchTime: S.Option(S.Finite).annotateKey({ description: "Launch time in epoch milliseconds." }),
    owner: S.Option(S.String),
    type: S.Option(S.String),
    githubRunnerId: S.Option(S.String),
    orphan: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    bypassRemoval: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
  }).pipe(
    $I.annoteSchema("RunnerInstance", {
      description: "One fleet instance as the inventory reports it.",
    })
  )
) {}

/**
 * Inventory filter: which fleet instances to list.
 *
 * **Details**
 *
 * The application tag is always applied. `states` defaults to running and
 * pending.
 *
 * **Example** (A pool's orphans)
 *
 * ```ts
 * import { RunnerFilter } from "@beep/alchemy-github-runners/RunnerInstance.models"
 * import * as O from "effect/Option"
 *
 * const filter = RunnerFilter.make({ environment: O.some("beep-ci-heavy"), orphan: true })
 * console.log(filter.states)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunnerFilter extends S.Opaque<RunnerFilter, { readonly brand: unique symbol }>()(
  S.Struct({
    environment: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    type: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    owner: S.Option(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
    orphan: S.Boolean.pipe(S.withConstructorDefault(Effect.succeed(false))),
    states: S.Array(S.String).pipe(
      S.withConstructorDefault(Effect.succeed<ReadonlyArray<string>>(["running", "pending"]))
    ),
  }).pipe(
    $I.annoteSchema("RunnerFilter", {
      description: "Inventory filter: which fleet instances to list.",
    })
  )
) {}
