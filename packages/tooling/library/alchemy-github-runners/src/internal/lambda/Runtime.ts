/**
 * The Lambda boundary shared by every fleet handler: runtime-config decode,
 * the live service runtime and the AWS event envelopes.
 *
 * @internal
 */

import * as AwsCredentials from "@distilled.cloud/aws/Credentials";
import * as Config from "effect/Config";
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
import type { AppParameterNames } from "../../SsmParameters.models.ts";

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
export const fleetLive = ({
  app,
  ghesApiUrl,
}: {
  readonly app: AppParameterNames;
  readonly ghesApiUrl: O.Option<string>;
}) => {
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
export const SqsEvent = S.Struct({
  Records: S.Array(S.Struct({ messageId: S.String, body: S.String, eventSource: S.optionalKey(S.String) })),
});

/**
 * A function-URL (payload 2.0) request as Lambda delivers it.
 *
 * @internal
 */
export const FunctionUrlEvent = S.Struct({
  headers: S.optionalKey(S.Record(S.String, S.UndefinedOr(S.String))),
  body: S.optionalKey(S.String),
  isBase64Encoded: S.optionalKey(S.Boolean),
});

/**
 * Builds a Lambda handler: decode the runtime config once, build the live
 * runtime once, run the program per event, and answer `fallback` when the
 * config is unusable or the program fails unexpectedly.
 *
 * @internal
 */
export const lambdaHandler = <SC extends S.Codec<unknown, unknown, never, never>, ROut, Out, E>(options: {
  readonly config: SC;
  readonly layer: (config: SC["Type"]) => Layer.Layer<ROut>;
  readonly run: (config: SC["Type"], event: unknown) => Effect.Effect<Out, E, ROut>;
  readonly fallback: (event: unknown) => Out;
}): ((event: unknown) => Promise<Out>) => {
  const loaded = loadRuntimeConfig(options.config).pipe(Effect.result, Effect.runSync);
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
