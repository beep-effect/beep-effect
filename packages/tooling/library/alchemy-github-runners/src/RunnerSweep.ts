/**
 * `RunnerSweep`: a delete-only Alchemy resource that, when the fleet is
 * destroyed, terminates the instances and deregisters the runners the
 * scale-up Lambda created at runtime, which Alchemy never tracked.
 *
 * **Details**
 *
 * The delete-only pattern follows t3code's `PreviewTunnelSweep`
 * (`goals/infra-alchemy-rebuild/research/t3code-stack-patterns.md`).
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyGithubRunnersId } from "@beep/identity/packages";
import * as Provider from "alchemy/Provider";
import { Resource } from "alchemy/Resource";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as Schedule from "effect/Schedule";
import * as S from "effect/Schema";
import { Ec2Fleet } from "./Ec2Fleet.service.ts";
import { RunnerOwner } from "./GitHubRunners.models.ts";
import { GitHubApiError, RunnerSweepIncomplete } from "./RunnerFleet.errors.ts";
import { RunnerFilter } from "./RunnerInstance.models.ts";
import { RunnerType } from "./RunnerPool.models.ts";
import { SsmStore } from "./SsmStore.service.ts";
import { deregisterRunner } from "./TerminationWatcher.program.ts";
import type { InputProps } from "alchemy/Input";
import type { GitHubAppAuth, GitHubRunners } from "./GitHubApp.service.ts";

const $I = $AlchemyGithubRunnersId.create("RunnerSweep");

const isRunnerType = S.is(RunnerType);

const isBusy = (error: { readonly _tag: string }): boolean =>
  S.is(GitHubApiError)(error) && O.contains(error.status, 422);

// A runner still finishing a job answers 422 right after TerminateInstances; it goes
// idle once the instance stops, so the sweep retries for about two minutes.
const busyRetry = { schedule: Schedule.spaced("15 seconds"), times: 8, while: isBusy };

const deregisterIdle = (input: Parameters<typeof deregisterRunner>[0]) =>
  deregisterRunner(input).pipe(
    Effect.filterOrFail(
      (outcome): outcome is Exclude<typeof outcome, "busy"> => outcome !== "busy",
      () => GitHubApiError.make({ operation: "deleteRunner", status: O.some(422), message: "runner is busy" })
    ),
    Effect.retry(busyRetry)
  );

/**
 * Every instance state a runtime-created runner can be in before it is gone.
 *
 * **Example** (States swept)
 *
 * ```ts
 * import { sweptInstanceStates } from "@beep/alchemy-github-runners/RunnerSweep"
 *
 * console.log(sweptInstanceStates)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const sweptInstanceStates: ReadonlyArray<string> = ["pending", "running", "stopping", "stopped"];

/**
 * What one sweep did.
 *
 * **Example** (An empty fleet)
 *
 * ```ts
 * import { SweepReport } from "@beep/alchemy-github-runners/RunnerSweep"
 *
 * console.log(SweepReport.make({ terminated: [], deregistered: 0, tokensDeleted: 0 }).deregistered)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SweepReport extends S.Opaque<SweepReport, { readonly brand: unique symbol }>()(
  S.Struct({
    terminated: S.Array(S.String),
    deregistered: S.Int,
    tokensDeleted: S.Int,
  }).pipe($I.annoteSchema("SweepReport", { description: "What one sweep did." }))
) {}

/**
 * Terminates every runner instance of the given pool environments,
 * deregisters their GitHub runners and deletes unconsumed tokens.
 *
 * **Details**
 *
 * Instances are terminated first, so a busy runner goes offline and its
 * deregistration then succeeds; a runner still busy (422) is retried every 15
 * seconds, up to 8 times. A runner GitHub no longer knows counts as done.
 * Tokens are deleted either way; then, if any deregistration failed, the sweep
 * fails with `RunnerSweepIncomplete` naming those instances, so a destroy stops
 * instead of leaving offline registrations behind. Idempotent: a second sweep
 * finds nothing.
 *
 * **Example** (Wire the sweep)
 *
 * ```ts
 * import { sweepRunners } from "@beep/alchemy-github-runners/RunnerSweep"
 *
 * console.log(typeof sweepRunners)
 * ```
 *
 * @param input - Pool `ghr:environment` values and token paths.
 * @returns The sweep report; fails with `RunnerSweepIncomplete` when a runner stays registered.
 * @category use-cases
 * @since 0.0.0
 */
export const sweepRunners = Effect.fn("RunnerSweep.sweep")(function* (input: {
  readonly environments: ReadonlyArray<string>;
  readonly tokenPaths: ReadonlyArray<string>;
}) {
  const ec2 = yield* Ec2Fleet;
  const ssm = yield* SsmStore;
  const listed = yield* Effect.forEach(input.environments, (environment) =>
    ec2.listRunners(RunnerFilter.make({ environment: O.some(environment), states: sweptInstanceStates }))
  );
  const runners = A.flatten(listed);
  yield* Effect.forEach(runners, (runner) => ec2.terminate(runner.instanceId), { discard: true });
  const outcomes = yield* Effect.forEach(runners, (runner) =>
    O.match(O.all({ owner: runner.owner, type: O.filter(runner.type, isRunnerType) }), {
      onNone: () => Effect.succeed("skipped" as const),
      onSome: ({ owner, type }) =>
        deregisterIdle({ instanceId: runner.instanceId, owner: RunnerOwner.make({ type, owner }) }).pipe(
          Effect.match({
            onFailure: () => "failed" as const,
            onSuccess: (outcome) => (outcome === "deregistered" ? ("deregistered" as const) : ("skipped" as const)),
          })
        ),
    })
  );
  const tokens = yield* Effect.forEach(input.tokenPaths, ssm.listByPath);
  const tokenNames = A.map(A.flatten(tokens), (entry) => entry.name);
  yield* Effect.forEach(tokenNames, ssm.delete, { discard: true });
  const failed = A.flatMap(A.zip(runners, outcomes), ([runner, outcome]) =>
    outcome === "failed" ? [runner.instanceId] : []
  );
  if (A.isReadonlyArrayNonEmpty(failed)) {
    return yield* RunnerSweepIncomplete.make({
      instanceIds: failed,
      message: `${failed.length} runner(s) left registered after the sweep terminated their instances`,
    });
  }
  return SweepReport.make({
    terminated: A.map(runners, (runner) => runner.instanceId),
    deregistered: A.filter(outcomes, (outcome) => outcome === "deregistered").length,
    tokensDeleted: tokenNames.length,
  });
});

/**
 * Props of {@link RunnerSweep}.
 *
 * **Details**
 *
 * `dependsOn` lists everything the sweep reads or races at delete time: the
 * scale-up function names, the termination watcher, the App id and key
 * parameters and their KMS key. Alchemy deletes dependents first, so the sweep
 * runs while those still exist; a runner launched in that window is the next
 * destroy's to sweep.
 *
 * **Example** (Sweep one pool)
 *
 * ```ts
 * import { RunnerSweepProps } from "@beep/alchemy-github-runners/RunnerSweep"
 *
 * const props = RunnerSweepProps.make({
 *   environments: ["beep-ci-heavy"],
 *   tokenPaths: ["/beep-ci/heavy/tokens"],
 *   dependsOn: [],
 * })
 * console.log(props.environments) // ["beep-ci-heavy"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunnerSweepProps extends S.Opaque<RunnerSweepProps, { readonly brand: unique symbol }>()(
  S.Struct({
    dependsOn: S.Array(S.String),
    environments: S.Array(S.String),
    tokenPaths: S.Array(S.String),
  }).pipe($I.annoteSchema("RunnerSweepProps", { description: "Props of the delete-only runner sweep." }))
) {}

/**
 * Encoded side of {@link RunnerSweepProps}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace RunnerSweepProps {
  /**
   * The plain shape a stack passes as the resource props.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof RunnerSweepProps.Encoded;
}

/**
 * Attributes of {@link RunnerSweep}: the props echoed back.
 *
 * **Example** (Read the echoed token paths)
 *
 * ```ts
 * import { RunnerSweepAttributes } from "@beep/alchemy-github-runners/RunnerSweep"
 *
 * const attributes = RunnerSweepAttributes.make({ environments: ["beep-ci-heavy"], tokenPaths: ["/beep-ci/heavy/tokens"] })
 * console.log(attributes.tokenPaths) // ["/beep-ci/heavy/tokens"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RunnerSweepAttributes extends S.Opaque<RunnerSweepAttributes, { readonly brand: unique symbol }>()(
  S.Struct({
    environments: S.Array(S.String),
    tokenPaths: S.Array(S.String),
  }).pipe(
    $I.annoteSchema("RunnerSweepAttributes", { description: "Attributes of the runner sweep: its props echoed back." })
  )
) {}

/**
 * Encoded side of {@link RunnerSweepAttributes}.
 *
 * @category models
 * @since 0.0.0
 */
export declare namespace RunnerSweepAttributes {
  /**
   * The plain shape the provider reports.
   *
   * @category models
   * @since 0.0.0
   */
  export type Encoded = typeof RunnerSweepAttributes.Encoded;
}

/**
 * The delete-only sweep resource type.
 *
 * @category resources
 * @since 0.0.0
 */
export type RunnerSweep = Resource<
  "BeepGitHubRunners.RunnerSweep",
  RunnerSweepProps.Encoded,
  RunnerSweepAttributes.Encoded
>;

const RunnerSweepResource = Resource<RunnerSweep>("BeepGitHubRunners.RunnerSweep");

/**
 * Declares the sweep inside a stack.
 *
 * **Details**
 *
 * Creating or updating it changes nothing in the cloud; destroying it runs
 * {@link sweepRunners}. `list` is empty, so `alchemy nuke` never sweeps a
 * fleet it did not destroy.
 *
 * **Example** (Declare the sweep)
 *
 * ```ts
 * import { declareRunnerSweep } from "@beep/alchemy-github-runners/RunnerSweep"
 *
 * const sweep = declareRunnerSweep("Sweep", {
 *   environments: ["beep-ci-heavy"],
 *   tokenPaths: ["/beep-ci/heavy/tokens"],
 *   dependsOn: [],
 * })
 * console.log(sweep)
 * ```
 *
 * @param id - Logical id of the sweep.
 * @param props - Pool environments, token paths and the resources the sweep reads at delete time.
 * @returns The resource declaration effect.
 * @category resources
 * @since 0.0.0
 */
export const declareRunnerSweep: {
  (
    props: InputProps<RunnerSweepProps.Encoded>
  ): (id: string) => Effect.Effect<RunnerSweep, never, Provider.Provider<RunnerSweep>>;
  (
    id: string,
    props: InputProps<RunnerSweepProps.Encoded>
  ): Effect.Effect<RunnerSweep, never, Provider.Provider<RunnerSweep>>;
} = dual(2, (id: string, props: InputProps<RunnerSweepProps.Encoded>) => RunnerSweepResource(id, props));

/**
 * The sweep's provider; it needs the fleet services to run the sweep on delete.
 *
 * **Example** (Provide it with live services)
 *
 * ```ts
 * import { RunnerSweepProvider } from "@beep/alchemy-github-runners/RunnerSweep"
 *
 * console.log(RunnerSweepProvider)
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
export const RunnerSweepProvider = Provider.effect(
  RunnerSweepResource,
  Effect.gen(function* () {
    const services = yield* Effect.context<Ec2Fleet | SsmStore | GitHubAppAuth | GitHubRunners>();
    return RunnerSweepResource.Provider.of({
      reconcile: Effect.fn("RunnerSweep.reconcile")(function* ({ news }) {
        return { environments: news.environments, tokenPaths: news.tokenPaths };
      }),
      read: Effect.fn("RunnerSweep.read")(function* ({ output }) {
        return output;
      }),
      list: Effect.fn("RunnerSweep.list")(function* () {
        return [];
      }),
      delete: Effect.fn("RunnerSweep.delete")(function* ({ output, session }) {
        const report = yield* sweepRunners(output).pipe(Effect.provideContext(services), Effect.orDie);
        yield* session.note(
          `Swept ${report.terminated.length} instances, ${report.deregistered} runners, ${report.tokensDeleted} tokens`
        );
      }),
    });
  })
);
