/**
 * `RunnerSweep`: a delete-only Alchemy resource that, when the fleet is
 * destroyed, terminates the instances and deregisters the runners the
 * scale-up Lambda created at runtime, which Alchemy never tracked.
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
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { Ec2Fleet } from "./Ec2Fleet.service.ts";
import { RunnerOwner } from "./GitHubRunners.models.ts";
import { RunnerFilter } from "./RunnerInstance.models.ts";
import { RunnerType } from "./RunnerPool.models.ts";
import { SsmStore } from "./SsmStore.service.ts";
import { deregisterRunner } from "./TerminationWatcher.program.ts";
import type { InputProps } from "alchemy/Input";
import type { GitHubAppAuth, GitHubRunners } from "./GitHubApp.service.ts";

const $I = $AlchemyGithubRunnersId.create("RunnerSweep");

const isRunnerType = S.is(RunnerType);

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
 * deregistration then succeeds; a runner GitHub no longer knows counts as
 * done. Idempotent: a second sweep finds nothing.
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
 * @returns The sweep report.
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
      onNone: () => Effect.succeed(false),
      onSome: ({ owner, type }) =>
        deregisterRunner({ instanceId: runner.instanceId, owner: RunnerOwner.make({ type, owner }) }).pipe(
          Effect.map((outcome) => outcome === "deregistered"),
          Effect.orElseSucceed(() => false)
        ),
    })
  );
  const tokens = yield* Effect.forEach(input.tokenPaths, ssm.listByPath);
  const tokenNames = A.map(A.flatten(tokens), (entry) => entry.name);
  yield* Effect.forEach(tokenNames, ssm.delete, { discard: true });
  return SweepReport.make({
    terminated: A.map(runners, (runner) => runner.instanceId),
    deregistered: A.filter(outcomes, (done) => done).length,
    tokensDeleted: tokenNames.length,
  });
});

/**
 * Props of {@link RunnerSweep}.
 *
 * **Details**
 *
 * `dependsOn` lists the scale-up function names. Alchemy deletes dependents
 * first, so the sweep runs before the Lambdas that launch runners are removed;
 * a runner launched in that window is the next destroy's to sweep.
 *
 * @category models
 * @since 0.0.0
 */
export interface RunnerSweepProps {
  readonly dependsOn: ReadonlyArray<string>;
  readonly environments: ReadonlyArray<string>;
  readonly tokenPaths: ReadonlyArray<string>;
}

/**
 * Attributes of {@link RunnerSweep}: the props echoed back.
 *
 * @category models
 * @since 0.0.0
 */
export interface RunnerSweepAttributes {
  readonly environments: ReadonlyArray<string>;
  readonly tokenPaths: ReadonlyArray<string>;
}

/**
 * The delete-only sweep resource type.
 *
 * @category resources
 * @since 0.0.0
 */
export type RunnerSweep = Resource<"BeepGitHubRunners.RunnerSweep", RunnerSweepProps, RunnerSweepAttributes>;

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
 * const sweep = declareRunnerSweep({
 *   id: "Sweep",
 *   props: { environments: ["beep-ci-heavy"], tokenPaths: ["/beep-ci/heavy/tokens"], dependsOn: [] },
 * })
 * console.log(sweep)
 * ```
 *
 * @param input - Logical id and props.
 * @returns The resource declaration effect.
 * @category resources
 * @since 0.0.0
 */
export const declareRunnerSweep = (input: { readonly id: string; readonly props: InputProps<RunnerSweepProps> }) =>
  RunnerSweepResource(input.id, input.props);

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
