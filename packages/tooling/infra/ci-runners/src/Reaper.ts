/**
 * The fleet reaper: a scheduled Lambda that terminates every runner older
 * than the fleet TTL, whatever state its job is in.
 *
 * @packageDocumentation
 * @category resources
 * @since 0.0.0
 */

import * as EventBridge from "@alchemy.run/aws/EventBridge";
import * as Lambda from "@alchemy.run/aws/Lambda";
import { Ec2Fleet } from "@beep/alchemy-github-runners/Ec2Fleet.service";
import { RunnerFilter, RunnerTag } from "@beep/alchemy-github-runners/RunnerInstance.models";
import { runtimeConfigEnvName } from "@beep/alchemy-github-runners/RunnerRuntime.models";
import { $InfraCiRunnersId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { RunnerInstance } from "@beep/alchemy-github-runners/RunnerInstance.models";

const $I = $InfraCiRunnersId.create("Reaper");

/**
 * Runtime configuration of the reaper Lambda, one JSON environment variable.
 *
 * **Details**
 *
 * `environments` are the fleet's pool `ghr:environment` values; the reaper
 * lists only instances carrying one of them, and its role may terminate
 * only those, so it can never touch the live fleet or another stage.
 *
 * **Example** (Build a reaper config)
 *
 * ```ts
 * import { ReaperRuntimeConfig } from "@beep/infra-ci-runners/Reaper"
 *
 * const config = ReaperRuntimeConfig.make({ environments: ["beep-fleet-prod-heavy"], ttlMinutes: 90 })
 * console.log(config.ttlMinutes) // 90
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReaperRuntimeConfig extends S.Opaque<ReaperRuntimeConfig, { readonly brand: unique symbol }>()(
  S.Struct({
    environments: S.NonEmptyArray(S.String),
    ttlMinutes: S.Int.check(S.isGreaterThan(0)),
  }).pipe($I.annoteSchema("ReaperRuntimeConfig", { description: "Pool environments and TTL of the fleet reaper." }))
) {}

const encodeReaperJson = S.encodeEffect(S.fromJsonString(ReaperRuntimeConfig));
const encodeReaperConfig = (config: ReaperRuntimeConfig) => encodeReaperJson(config).pipe(Effect.orDie);

/**
 * What one reaper pass did.
 *
 * **Example** (An empty pass)
 *
 * ```ts
 * import { ReaperReport } from "@beep/infra-ci-runners/Reaper"
 *
 * console.log(ReaperReport.make({ inspected: 0, reaped: [] }).reaped) // []
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ReaperReport extends S.Opaque<ReaperReport, { readonly brand: unique symbol }>()(
  S.Struct({
    inspected: S.Int,
    reaped: S.Array(S.String),
  }).pipe($I.annoteSchema("ReaperReport", { description: "Instances inspected and terminated by one pass." }))
) {}

/**
 * Instance states the reaper lists: everything a runner can be in before it
 * is terminated.
 *
 * **Example** (Read the states)
 *
 * ```ts
 * import { reapableStates } from "@beep/infra-ci-runners/Reaper"
 *
 * console.log(reapableStates.length) // 4
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const reapableStates: ReadonlyArray<string> = ["pending", "running", "stopping", "stopped"];

/**
 * Whether an instance launched before the cutoff. An instance without a
 * launch time is kept: the reaper never terminates what it cannot date.
 *
 * **Example** (An old runner)
 *
 * ```ts
 * import { RunnerInstance } from "@beep/alchemy-github-runners/RunnerInstance.models"
 * import { isExpired } from "@beep/infra-ci-runners/Reaper"
 * import * as O from "effect/Option"
 *
 * const runner = RunnerInstance.make({
 *   instanceId: "i-1",
 *   launchTime: O.some(0),
 *   owner: O.none(),
 *   type: O.none(),
 *   githubRunnerId: O.none(),
 * })
 * console.log(isExpired(runner, 1)) // true
 * ```
 *
 * @param instance - The runner instance.
 * @param cutoffMillis - Epoch milliseconds; instances launched earlier expire.
 * @returns `true` when the instance is older than the TTL.
 * @category use-cases
 * @since 0.0.0
 */
export const isExpired: {
  (cutoffMillis: number): (instance: RunnerInstance) => boolean;
  (instance: RunnerInstance, cutoffMillis: number): boolean;
} = dual(2, (instance: RunnerInstance, cutoffMillis: number): boolean =>
  O.exists(instance.launchTime, (launched) => launched < cutoffMillis)
);

/**
 * One reaper pass: list every runner of each environment, terminate those
 * launched more than `ttlMinutes` ago.
 *
 * **Details**
 *
 * Scale-down already removes idle runners and orphans; the reaper is the
 * backstop for a runner whose job, boot or shutdown hangs. A failed
 * termination is logged and the pass continues, so one stuck instance does
 * not shield the rest.
 *
 * **Example** (Reference the program)
 *
 * ```ts
 * import { reapExpiredRunners, ReaperRuntimeConfig } from "@beep/infra-ci-runners/Reaper"
 *
 * const pass = reapExpiredRunners(ReaperRuntimeConfig.make({ environments: ["beep-fleet-prod-heavy"], ttlMinutes: 90 }))
 * console.log(typeof pass) // "object"
 * ```
 *
 * @param config - The reaper's runtime configuration.
 * @returns The pass report.
 * @category use-cases
 * @since 0.0.0
 */
export const reapExpiredRunners = Effect.fn("CiRunners.reapExpiredRunners")(function* (config: ReaperRuntimeConfig) {
  const ec2 = yield* Ec2Fleet;
  const now = yield* Clock.currentTimeMillis;
  const cutoff = now - Duration.toMillis(Duration.minutes(config.ttlMinutes));
  const listed = yield* Effect.forEach(config.environments, (environment) =>
    ec2.listRunners(RunnerFilter.make({ environment: O.some(environment), states: reapableStates }))
  );
  const instances = A.flatten(listed);
  const expired = pipe(
    instances,
    A.filter(isExpired(cutoff)),
    A.map((instance) => instance.instanceId)
  );
  const reaped = yield* Effect.filter(expired, (instanceId) =>
    ec2.terminate(instanceId).pipe(
      Effect.as(true),
      Effect.catch((error) => Effect.logWarning("reaper could not terminate", instanceId, error).pipe(Effect.as(false)))
    )
  );
  return ReaperReport.make({ inspected: instances.length, reaped });
});

/**
 * Declare the reaper: the function, a five-minute schedule and the
 * permission for EventBridge to invoke it.
 *
 * **Details**
 *
 * The role may describe instances and terminate only instances tagged
 * with one of the fleet's pool environments. The function name is pinned.
 *
 * **Example** (Declare a reaper)
 *
 * ```ts
 * import { declareReaper, ReaperRuntimeConfig } from "@beep/infra-ci-runners/Reaper"
 *
 * const reaper = declareReaper({
 *   functionName: "beep-fleet-prod-reaper",
 *   config: ReaperRuntimeConfig.make({ environments: ["beep-fleet-prod-heavy"], ttlMinutes: 90 }),
 * })
 * console.log(typeof reaper) // "object"
 * ```
 *
 * @param input - The pinned function name and the runtime configuration.
 * @returns The reaper function.
 * @category resources
 * @since 0.0.0
 */
export const declareReaper = Effect.fn("CiRunners.declareReaper")(function* (input: {
  readonly functionName: string;
  readonly config: ReaperRuntimeConfig;
}) {
  const runtimeConfig = yield* encodeReaperConfig(input.config);
  const reaper = yield* Lambda.Function("Reaper", {
    functionName: input.functionName,
    main: `${import.meta.dirname}/internal/lambda/reaper.ts`,
    handler: "handler",
    functionUrl: false,
    timeout: Duration.seconds(60),
    memorySize: 256,
    logging: { retention: "14 days" },
    env: { [runtimeConfigEnvName]: runtimeConfig },
  });
  const schedule = yield* EventBridge.Rule("ReaperSchedule", {
    scheduleExpression: "rate(5 minutes)",
    targets: [{ Id: "Reaper", Arn: reaper.functionArn }],
  });
  yield* Lambda.Permission("ReaperInvoke", {
    action: "lambda:InvokeFunction",
    functionName: reaper.functionName,
    principal: "events.amazonaws.com",
    sourceArn: schedule.ruleArn,
  });
  yield* reaper.bind("Reaper", {
    policyStatements: [
      { Effect: "Allow", Action: ["ec2:DescribeInstances"], Resource: ["*"] },
      {
        Effect: "Allow",
        Action: ["ec2:TerminateInstances"],
        Resource: ["*"],
        Condition: {
          StringEquals: { [`ec2:ResourceTag/${RunnerTag.environment}`]: A.copy(input.config.environments) },
        },
      },
    ],
  });
  return reaper;
});
