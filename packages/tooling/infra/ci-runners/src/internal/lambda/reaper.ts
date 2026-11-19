/**
 * Reaper Lambda entry (EventBridge schedule). Alchemy bundles this file.
 *
 * @internal
 */

import { ec2FleetLive } from "@beep/alchemy-github-runners/Aws.layer";
import { runtimeConfigEnvName } from "@beep/alchemy-github-runners/RunnerRuntime.models";
import * as AwsCredentials from "@distilled.cloud/aws/Credentials";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as S from "effect/Schema";
import { ReaperRuntimeConfig, reapExpiredRunners } from "../../Reaper.ts";

const runtime = ManagedRuntime.make(
  ec2FleetLive.pipe(Layer.provide(Layer.mergeAll(FetchHttpClient.layer, AwsCredentials.fromEnv())))
);

const runtimeConfig = Config.schema(S.fromJsonString(ReaperRuntimeConfig), runtimeConfigEnvName);

/**
 * One reaper pass from the environment: read the runtime configuration, reap
 * and log the report. Exported for tests, which provide a fake `Ec2Fleet`.
 *
 * @internal
 */
export const reaperPass = Effect.gen(function* () {
  const config = yield* runtimeConfig;
  const report = yield* reapExpiredRunners(config);
  yield* Effect.logInfo("reaper pass", report);
  return { inspected: report.inspected, reaped: report.reaped };
});

/**
 * The Lambda entry point: one reaper pass. A pass that cannot read its
 * configuration or list instances fails the invocation, so the failure shows
 * as a Lambda error metric instead of a silent success.
 *
 * @internal
 */
export const handler = (): Promise<{ readonly inspected: number; readonly reaped: ReadonlyArray<string> }> =>
  runtime.runPromise(reaperPass);
