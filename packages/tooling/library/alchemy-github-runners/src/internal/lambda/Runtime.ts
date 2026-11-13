/**
 * The Lambda boundary shared by every fleet handler: runtime-config decode,
 * the live service runtime and the AWS event envelopes.
 *
 * @internal
 */

import { $AlchemyGithubRunnersId } from "@beep/identity/packages";
import * as AwsCredentials from "@distilled.cloud/aws/Credentials";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ec2FleetLive, messageQueueLive, runnerBinariesLive, ssmStoreLive } from "../../Aws.layer.ts";
import { GitHubLiveOptions, gitHubAppAuthLive, gitHubRunnersLive } from "../../GitHubApp.layer.ts";
import { RuntimeConfigError } from "../../RunnerFleet.errors.ts";
import { runtimeConfigEnvName } from "../../RunnerRuntime.models.ts";
import type { PoolRuntimeConfig, TerminationWatcherRuntimeConfig } from "../../RunnerRuntime.models.ts";

const $I = $AlchemyGithubRunnersId.create("internal/lambda/Runtime");

/**
 * Decodes the Lambda's runtime config from its environment.
 *
 * @internal
 */
export const loadRuntimeConfig = Effect.fn("LambdaRuntime.loadRuntimeConfig")(function* <
  SC extends S.Codec<unknown, unknown, never, never>,
>(schema: SC) {
  const raw = yield* Config.String(runtimeConfigEnvName).pipe(
    Effect.mapError(() => RuntimeConfigError.make({ message: `${runtimeConfigEnvName} is not set` }))
  );
  return yield* S.decodeEffect(S.fromJsonString(schema))(raw).pipe(
    Effect.mapError((error) => RuntimeConfigError.make({ message: error.message }))
  );
});

const platform = Layer.mergeAll(FetchHttpClient.layer, AwsCredentials.fromEnv());

/**
 * AWS services backed by distilled, with Lambda credentials from the environment.
 *
 * @internal
 */
export const awsLive = Layer.mergeAll(ec2FleetLive, ssmStoreLive, messageQueueLive, runnerBinariesLive).pipe(
  Layer.provideMerge(platform)
);

/**
 * Every service a GitHub-facing Lambda needs.
 *
 * @internal
 */
export const fleetLive = ({ app, ghesApiUrl }: PoolRuntimeConfig | TerminationWatcherRuntimeConfig) => {
  const options = GitHubLiveOptions.make({
    app,
    apiBaseUrl: O.getOrElse(ghesApiUrl, () => "https://api.github.com"),
    userAgent: "beep-alchemy-github-runners",
  });
  return Layer.mergeAll(gitHubAppAuthLive(options), gitHubRunnersLive(options)).pipe(Layer.provideMerge(awsLive));
};

/**
 * An SQS event as Lambda delivers it.
 *
 * @internal
 */
export class SqsEvent extends S.Opaque<SqsEvent, { readonly brand: unique symbol }>()(
  S.Struct({
    Records: S.Array(S.Struct({ messageId: S.String, body: S.String, eventSource: S.optionalKey(S.String) })),
  }).pipe($I.annoteSchema("SqsEvent", { description: "An SQS event as Lambda delivers it." }))
) {}

/**
 * A function-URL (payload 2.0) request as Lambda delivers it.
 *
 * @internal
 */
export class FunctionUrlEvent extends S.Opaque<FunctionUrlEvent, { readonly brand: unique symbol }>()(
  S.Struct({
    headers: S.optionalKey(S.Record(S.String, S.UndefinedOr(S.String))),
    body: S.optionalKey(S.String),
    isBase64Encoded: S.optionalKey(S.Boolean),
  }).pipe($I.annoteSchema("FunctionUrlEvent", { description: "A function-URL (payload 2.0) request." }))
) {}

/**
 * A Lambda: its runtime-config schema, live layer, per-event program and the
 * answer it gives when the config is unusable or the program fails.
 *
 * @internal
 */
export interface LambdaDefinition<SC extends S.Codec<unknown, unknown, never, never>, ROut, Out, E> {
  readonly config: SC;
  /** Where the runtime config is read from; the process environment unless set (tests). */
  readonly configProvider?: ConfigProvider.ConfigProvider | undefined;
  readonly fallback: (event: unknown) => Out;
  readonly layer: (config: SC["Type"]) => Layer.Layer<ROut>;
  readonly run: (config: SC["Type"], event: unknown) => Effect.Effect<Out, E, ROut>;
}

/**
 * Types a Lambda definition so its `run` can be tested apart from its live layer.
 *
 * @internal
 */
export const defineLambda = <SC extends S.Codec<unknown, unknown, never, never>, ROut, Out, E>(
  definition: LambdaDefinition<SC, ROut, Out, E>
): LambdaDefinition<SC, ROut, Out, E> => definition;

/**
 * Builds the Lambda handler from a definition.
 *
 * @internal
 */
export const lambdaHandler = <SC extends S.Codec<unknown, unknown, never, never>, ROut, Out, E>(
  options: LambdaDefinition<SC, ROut, Out, E>
): ((event: unknown) => Promise<Out>) => {
  const loaded = loadRuntimeConfig(options.config).pipe(
    Effect.provideService(ConfigProvider.ConfigProvider, options.configProvider ?? ConfigProvider.fromEnv()),
    Effect.result,
    Effect.runSync
  );
  if (loaded._tag === "Failure") {
    const failure = loaded.failure;
    return (event) =>
      Effect.runPromise(
        Effect.logError("runtime config unusable", failure.message).pipe(Effect.as(options.fallback(event)))
      );
  }
  const config = loaded.success;
  const runtime = ManagedRuntime.make(options.layer(config));
  return (event) =>
    runtime.runPromise(
      options
        .run(config, event)
        .pipe(
          Effect.catchCause((cause) =>
            Effect.logError("handler failed", cause).pipe(Effect.as(options.fallback(event)))
          )
        )
    );
};

/**
 * An SQS partial batch response: the records SQS must redeliver.
 *
 * @internal
 */
export const batchItemFailures = (messageIds: ReadonlyArray<string>) => ({
  batchItemFailures: A.map(messageIds, (itemIdentifier) => ({ itemIdentifier })),
});

/**
 * Runs `handle` on each record and reports the records that failed, so SQS
 * redelivers them and their dead-letter queue takes them after
 * `maxReceiveCount` attempts.
 *
 * @internal
 */
export const processRecords = Effect.fn("LambdaRuntime.processRecords")(function* <E, R>(
  event: SqsEvent,
  handle: (body: string) => Effect.Effect<unknown, E, R>
) {
  const failed = yield* Effect.forEach(event.Records, (record) =>
    handle(record.body).pipe(
      Effect.as(O.none<string>()),
      Effect.catchCause((cause) =>
        Effect.logWarning("record failed; SQS will redeliver it", record.messageId, cause).pipe(
          Effect.as(O.some(record.messageId))
        )
      )
    )
  );
  return batchItemFailures(A.getSomes(failed));
});

/**
 * Every record of an SQS event, for a fallback that must fail the whole batch.
 *
 * @internal
 */
export const allMessageIds = (raw: unknown): ReadonlyArray<string> =>
  O.match(S.decodeUnknownOption(SqsEvent)(raw), {
    onNone: () => [],
    onSome: (event) => A.map(event.Records, (record) => record.messageId),
  });
