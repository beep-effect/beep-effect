/**
 * The scale-down Lambda's program: sweep orphans, then deregister and
 * terminate idle runners past their minimum running time.
 *
 * **Details**
 *
 * Ported from `lambdas/functions/control-plane/src/scale-runners/scale-down.ts`
 * of github-aws-runners/terraform-aws-github-runner v7.10.1 (MIT); see the
 * package README for the license notice.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AlchemyGithubRunnersId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Ec2Fleet } from "./Ec2Fleet.service.ts";
import { GitHubRunners } from "./GitHubApp.service.ts";
import { RunnerOwner } from "./GitHubRunners.models.ts";
import { installationTokenFor } from "./internal/Installation.ts";
import { RunnerFilter, RunnerTag } from "./RunnerInstance.models.ts";
import { RunnerType } from "./RunnerPool.models.ts";
import type { InstallationToken, SelfHostedRunner } from "./GitHubRunners.models.ts";
import type { RunnerInstance } from "./RunnerInstance.models.ts";
import type { PoolRuntimeConfig } from "./RunnerRuntime.models.ts";

const $I = $AlchemyGithubRunnersId.create("ScaleDown.program");

const minuteMillis = 60_000;

const isRunnerType = S.is(RunnerType);

// Whether `minutes` have passed since launch; a runner without a launch time counts as launched now.
const minutesElapsed = (input: {
  readonly launchTime: O.Option<number>;
  readonly minutes: number;
  readonly now: number;
}): boolean => O.getOrElse(input.launchTime, () => input.now) + input.minutes * minuteMillis < input.now;

const ownerOfRunner = (runner: RunnerInstance): O.Option<RunnerOwner> =>
  O.flatMap(O.all({ owner: runner.owner, type: runner.type }), ({ owner, type }) =>
    isRunnerType(type) ? O.some(RunnerOwner.make({ owner, type })) : O.none()
  );

/**
 * What scale-down did with one instance.
 *
 * **Example** (A termination)
 *
 * ```ts
 * import { ScaleDownAction } from "@beep/alchemy-github-runners/ScaleDown.program"
 *
 * console.log(ScaleDownAction.is.terminated("terminated")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ScaleDownAction = LiteralKit([
  "terminated",
  "kept-idle",
  "busy",
  "orphaned",
  "unorphaned",
  "skipped",
]).pipe($I.annoteSchema("ScaleDownAction", { description: "What scale-down did with one instance." }));

/**
 * Runtime type for {@link ScaleDownAction}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ScaleDownAction = typeof ScaleDownAction.Type;

/**
 * One scale-down decision, for logs and tests.
 *
 * **Example** (A kept-idle runner)
 *
 * ```ts
 * import { ScaleDownDecision } from "@beep/alchemy-github-runners/ScaleDown.program"
 *
 * console.log(ScaleDownDecision.make({ instanceId: "i-1", action: "kept-idle" }).action)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ScaleDownDecision extends S.Opaque<ScaleDownDecision, { readonly brand: unique symbol }>()(
  S.Struct({ instanceId: S.String, action: ScaleDownAction }).pipe(
    $I.annoteSchema("ScaleDownDecision", { description: "One scale-down decision." })
  )
) {}

const decide = (instanceId: string, action: ScaleDownAction) => ScaleDownDecision.make({ instanceId, action });

const removeRunner = Effect.fn("ScaleDown.removeRunner")(function* (input: {
  readonly runner: RunnerInstance;
  readonly owner: RunnerOwner;
  readonly token: InstallationToken;
  readonly githubRunners: ReadonlyArray<SelfHostedRunner>;
}) {
  const github = yield* GitHubRunners;
  const ec2 = yield* Ec2Fleet;
  const states = yield* Effect.forEach(input.githubRunners, (runner) =>
    github.getRunner(input.token, input.owner, runner.id).pipe(Effect.map(O.exists((state) => state.busy)))
  );
  if (A.some(states, (busy) => busy)) {
    return "busy" as const;
  }
  const deleted = yield* Effect.forEach(input.githubRunners, (runner) =>
    github.deleteRunner(input.token, input.owner, runner.id).pipe(
      Effect.as(true),
      Effect.orElseSucceed(() => false)
    )
  );
  if (!A.every(deleted, (ok) => ok)) {
    return "skipped" as const;
  }
  yield* ec2.terminate(input.runner.instanceId);
  return "terminated" as const;
});

const sweepOrphans = Effect.fn("ScaleDown.sweepOrphans")(function* (config: PoolRuntimeConfig) {
  const ec2 = yield* Ec2Fleet;
  const github = yield* GitHubRunners;
  const orphans = yield* ec2.listRunners(RunnerFilter.make({ environment: O.some(config.environment), orphan: true }));
  return yield* Effect.forEach(orphans, (runner) =>
    Effect.gen(function* () {
      if (runner.bypassRemoval) {
        return decide(runner.instanceId, "skipped");
      }
      const registered = O.all({ owner: ownerOfRunner(runner), runnerId: runner.githubRunnerId });
      if (O.isNone(registered)) {
        yield* ec2.terminate(runner.instanceId);
        return decide(runner.instanceId, "terminated");
      }
      const token = yield* installationTokenFor(registered.value.owner, 0);
      const state = yield* github.getRunner(token, registered.value.owner, Number(registered.value.runnerId));
      const orphaned = O.match(state, { onNone: () => true, onSome: (s) => s.status === "offline" && s.busy });
      if (orphaned) {
        yield* ec2.terminate(runner.instanceId);
        return decide(runner.instanceId, "terminated");
      }
      yield* ec2.untag(runner.instanceId, [RunnerTag.orphan]);
      return decide(runner.instanceId, "unorphaned");
    }).pipe(Effect.orElseSucceed(() => decide(runner.instanceId, "skipped")))
  );
});

const evaluateRunner = Effect.fn("ScaleDown.evaluateRunner")(function* (input: {
  readonly config: PoolRuntimeConfig;
  readonly runner: RunnerInstance;
  readonly owner: RunnerOwner;
  readonly token: InstallationToken;
  readonly list: ReadonlyArray<SelfHostedRunner>;
  readonly now: number;
  readonly idleBudget: Ref.Ref<number>;
}) {
  const { config, runner, now } = input;
  if (runner.bypassRemoval) {
    return O.some(decide(runner.instanceId, "skipped"));
  }
  const githubRunners = A.filter(input.list, (gh) => Str.endsWith(runner.instanceId)(gh.name));
  if (A.isReadonlyArrayEmpty(githubRunners)) {
    if (!minutesElapsed({ launchTime: runner.launchTime, minutes: config.pool.bootTimeMinutes, now })) {
      return O.none();
    }
    const ec2 = yield* Ec2Fleet;
    yield* ec2.tag(runner.instanceId, { [RunnerTag.orphan]: "true" }).pipe(Effect.ignore);
    return O.some(decide(runner.instanceId, "orphaned"));
  }
  if (!minutesElapsed({ launchTime: runner.launchTime, minutes: config.pool.minimumRunningTimeMinutes, now })) {
    return O.none();
  }
  const keptIdle = yield* Ref.modify(input.idleBudget, (left) => (left > 0 ? [true, left - 1] : [false, left]));
  if (keptIdle) {
    return O.some(decide(runner.instanceId, "kept-idle"));
  }
  const action = yield* removeRunner({ runner, owner: input.owner, token: input.token, githubRunners }).pipe(
    Effect.orElseSucceed(() => "skipped" as const)
  );
  return O.some(decide(runner.instanceId, action));
});

/**
 * Runs one scale-down pass over a pool and returns the decision per instance.
 *
 * **Details**
 *
 * First the orphan sweep: an orphan without a GitHub runner id is
 * terminated; one with an id is terminated when GitHub no longer knows it or
 * reports it offline and busy, and is un-tagged otherwise. Then, per owner
 * and in eviction order (`oldest_first` removes the oldest and keeps the
 * newest idle), each registered runner past the minimum running time is kept
 * while the idle budget lasts and otherwise deregistered and terminated
 * unless busy; termination happens only after every GitHub deregistration
 * succeeded. An instance with no GitHub runner past its boot time is tagged
 * `ghr:orphan` for the next pass. Failures for one instance never stop the
 * pass.
 *
 * **Example** (Wire the program)
 *
 * ```ts
 * import { handleScaleDown } from "@beep/alchemy-github-runners/ScaleDown.program"
 *
 * console.log(typeof handleScaleDown)
 * ```
 *
 * @param config - The pool runtime config.
 * @returns One decision per instance considered.
 * @category use-cases
 * @since 0.0.0
 */
export const handleScaleDown = Effect.fn("ScaleDown.handle")(function* (config: PoolRuntimeConfig) {
  const ec2 = yield* Ec2Fleet;
  const github = yield* GitHubRunners;
  const now = yield* Clock.currentTimeMillis;
  const orphanDecisions = yield* sweepOrphans(config);

  const listed = yield* ec2.listRunners(RunnerFilter.make({ environment: O.some(config.environment) }));
  const runners = A.filter(listed, (runner) => !runner.orphan && O.isSome(ownerOfRunner(runner)));
  const byLaunch = Order.mapInput(Order.Number, (runner: RunnerInstance) => O.getOrElse(runner.launchTime, () => now));
  const evictionOrder = config.pool.evictionStrategy === "oldest_first" ? Order.flip(byLaunch) : byLaunch;
  const groups = A.groupBy(runners, (runner) => O.getOrElse(runner.owner, () => ""));

  const idleBudget = yield* Ref.make(config.pool.idleCount);
  const decisions = yield* Effect.forEach(
    R.values(groups),
    Effect.fnUntraced(function* (group) {
      const owner = O.getOrThrow(ownerOfRunner(group[0]));
      const registry = yield* installationTokenFor(owner, 0).pipe(
        Effect.flatMap((token) => github.listRunners(token, owner).pipe(Effect.map((list) => ({ token, list })))),
        Effect.option
      );
      if (O.isNone(registry)) {
        return [];
      }
      const evaluated = yield* Effect.forEach(A.sort(group, evictionOrder), (runner) =>
        evaluateRunner({ config, runner, owner, now, idleBudget, ...registry.value })
      );
      return A.getSomes(evaluated);
    })
  );
  return A.appendAll(orphanDecisions, A.flatten(decisions));
});
