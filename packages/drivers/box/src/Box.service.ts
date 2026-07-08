/**
 * Effect service boundary for the Box Node SDK.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BoxId } from "@beep/identity";
import * as O from "@beep/utils/Option";
import { BoxCcgAuth, BoxClient, BoxDeveloperTokenAuth, CcgConfig } from "box-node-sdk";
import { Context, Effect, Layer, Redacted } from "effect";
import { makeGeneratedOperations } from "./_generated/Box.operations.gen.ts";
import { BoxConfig, BoxConfigLayer } from "./Box.config.ts";
import { BoxError } from "./Box.errors.ts";
import { makeStreamingOperations } from "./Box.streaming.ts";
import { BOX_SDK_VERSION } from "./internal/Box.constants.ts";
import { acquireSdkCallController, decodeWith, logDriverFailure } from "./internal/Box.runtime.ts";
import type { BoxGeneratedOperations, BoxRunSdkCall } from "./_generated/Box.operations.gen.ts";
import type { BoxCcgConfig, BoxDeveloperTokenConfig } from "./Box.config.ts";
import type { BoxStreamingOperations } from "./Box.streaming.ts";

const $I = $BoxId.create("Box.service");

/**
 * Public Box service shape.
 *
 * @example
 * ```ts
 * import type { BoxShape } from "@beep/box"
 *
 * type Managers = keyof BoxShape
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export type BoxShape = BoxGeneratedOperations & BoxStreamingOperations;

const runSdkCall: BoxRunSdkCall = (manager, method, methodName, payloadSchema, successSchema, payload, invoke) =>
  acquireSdkCallController({
    methodName,
    payloadSchema,
    payload,
    use: (decoded, controller) =>
      Effect.tryPromise({
        try: () => invoke(decoded, controller.signal),
        catch: (cause) => BoxError.fromUnknown(methodName, cause),
      }).pipe(
        Effect.flatMap((result) =>
          decodeWith(successSchema, result, { method: methodName, reason: "response decoding" })
        ),
        Effect.tapError(logDriverFailure("box.driver_failure")),
        Effect.withSpan(`box.${manager}.${method}`, {
          attributes: {
            "box.manager": manager,
            "box.method": methodName,
            "box.sdk.version": BOX_SDK_VERSION,
          },
        })
      ),
    release: (controller) => Effect.sync(() => controller.abort()),
  });

const makeService = (client: unknown): BoxShape => {
  const generated = makeGeneratedOperations(client, runSdkCall);
  const streaming = makeStreamingOperations(client);

  return {
    ...generated,
    avatars: { ...generated.avatars, ...streaming.avatars },
    chunkedUploads: { ...generated.chunkedUploads, ...streaming.chunkedUploads },
    downloads: { ...generated.downloads, ...streaming.downloads },
    events: { ...generated.events, ...streaming.events },
    files: { ...generated.files, ...streaming.files },
    uploads: { ...generated.uploads, ...streaming.uploads },
    zipDownloads: { ...generated.zipDownloads, ...streaming.zipDownloads },
  };
};

const makeDeveloperTokenClient = (config: BoxDeveloperTokenConfig): BoxClient =>
  new BoxClient({
    auth: new BoxDeveloperTokenAuth({
      token: Redacted.value(config.token),
    }),
  });

const makeCcgClient = (config: BoxCcgConfig): BoxClient =>
  new BoxClient({
    auth: new BoxCcgAuth({
      config: new CcgConfig({
        clientId: config.clientId,
        clientSecret: Redacted.value(config.clientSecret),
        ...O.getSomesStruct({
          enterpriseId: config.enterpriseId,
          userId: config.userId,
        }),
      }),
    }),
  });

/**
 * Effect service for the Box Node SDK.
 *
 * @example
 * ```ts
 * import { Box, BoxDeveloperTokenConfig } from "@beep/box"
 * import { Redacted } from "effect"
 *
 * const layer = Box.makeLayer(BoxDeveloperTokenConfig.make({ token: Redacted.make("box-token") }))
 * console.log(layer)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Box extends Context.Service<Box, BoxShape>()($I`Box`) {
  /**
   * Build a Box layer from explicit developer-token configuration.
   *
   * @example
   * ```ts
   * import { Box, BoxDeveloperTokenConfig } from "@beep/box"
   * import { Redacted } from "effect"
   *
   * const layer = Box.makeLayer(BoxDeveloperTokenConfig.make({ token: Redacted.make("box-token") }))
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayer = (config: BoxDeveloperTokenConfig): Layer.Layer<Box> =>
    Layer.succeed(Box, Box.of(makeService(makeDeveloperTokenClient(config))));

  /**
   * Build a Box layer from explicit Client Credentials Grant configuration.
   *
   * @example
   * ```ts
   * import { Box, BoxCcgConfig } from "@beep/box"
   * import { Redacted } from "effect"
   * import * as O from "effect/Option"
   *
   * const layer = Box.makeCcgLayer(BoxCcgConfig.make({
   *   clientId: "client-id",
   *   clientSecret: Redacted.make("client-secret"),
   *   enterpriseId: O.some("enterprise-id")
   * }))
   * console.log(layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeCcgLayer = (config: BoxCcgConfig): Layer.Layer<Box, BoxError> =>
    Layer.succeed(Box, Box.of(makeService(makeCcgClient(config))));

  /**
   * Build a Box layer from a pre-authenticated SDK client.
   *
   * @example
   * ```ts
   * import { Box } from "@beep/box"
   *
   * const makeLayer = (client: unknown) => Box.makeLayerFromClient(client)
   * console.log(makeLayer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly makeLayerFromClient = (client: unknown): Layer.Layer<Box> =>
    Layer.succeed(Box, Box.of(makeService(client)));

  /**
   * Live developer-token layer backed by `CLOUD_BOX_TOKEN`.
   *
   * @example
   * ```ts
   * import { Box } from "@beep/box"
   *
   * console.log(Box.layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<Box, BoxError> = Layer.effect(
    Box,
    BoxConfig.pipe(Effect.map((config) => Box.of(makeService(makeDeveloperTokenClient(config)))))
  ).pipe(Layer.provide(BoxConfigLayer));
}
