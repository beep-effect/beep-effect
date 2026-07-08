/**
 * Box driver configuration models and Layers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BoxId } from "@beep/identity";
import { SchemaUtils } from "@beep/schema";
import { Config, Context, Effect, Layer } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { BoxError } from "./Box.errors.ts";
import type { Redacted } from "effect";

const $I = $BoxId.create("Box.config");

/**
 * Developer-token configuration for local Box access.
 *
 * @example
 * ```ts
 * import { BoxDeveloperTokenConfig } from "@beep/box"
 * import { Redacted } from "effect"
 *
 * const config = BoxDeveloperTokenConfig.make({ token: Redacted.make("box-token") })
 * console.log(config)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxDeveloperTokenConfig extends S.Class<BoxDeveloperTokenConfig>($I`BoxDeveloperTokenConfig`)(
  {
    token: S.Redacted(S.String),
  },
  $I.annote("BoxDeveloperTokenConfig", {
    description: "Developer-token configuration for the Box technical driver.",
  })
) {}

/**
 * Client Credentials Grant configuration for enterprise Box access.
 *
 * @example
 * ```ts
 * import { BoxCcgConfig } from "@beep/box"
 * import { Redacted } from "effect"
 * import * as O from "effect/Option"
 *
 * const config = BoxCcgConfig.make({
 *   clientId: "client-id",
 *   clientSecret: Redacted.make("client-secret"),
 *   enterpriseId: O.some("enterprise-id")
 * })
 * console.log(O.getOrUndefined(config.enterpriseId))
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxCcgConfig extends S.Class<BoxCcgConfig>($I`BoxCcgConfig`)(
  S.Struct({
    clientId: S.String,
    clientSecret: S.Redacted(S.String),
    enterpriseId: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
    userId: S.OptionFromOptionalKey(S.String).pipe(SchemaUtils.withNoneDefault),
  }).check(
    S.makeFilter((config) => O.isSome(config.enterpriseId) || O.isSome(config.userId), {
      identifier: $I`BoxCcgSubjectCheck`,
      title: "Box CCG subject",
      description: "Requires either an enterprise id or user id for Box Client Credentials Grant auth.",
      message: "Expected enterpriseId or userId for Box CCG auth",
    })
  ),
  $I.annote("BoxCcgConfig", {
    description: "Client Credentials Grant configuration for the Box technical driver.",
  })
) {}

/**
 * Box developer-token configuration service.
 *
 * @example
 * ```ts
 * import { BoxConfig, BoxDeveloperTokenConfig } from "@beep/box"
 * import { Effect, Layer, Redacted } from "effect"
 *
 * const ConfigLive = Layer.succeed(
 *   BoxConfig,
 *   BoxDeveloperTokenConfig.make({ token: Redacted.make("box-token") })
 * )
 *
 * const token = Effect.runSync(
 *   BoxConfig.pipe(
 *     Effect.map((config) => Redacted.value(config.token)),
 *     Effect.provide(ConfigLive)
 *   )
 * )
 * console.log(token)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class BoxConfig extends Context.Service<BoxConfig, BoxDeveloperTokenConfig>()($I`BoxConfig`) {}

/**
 * Live developer-token configuration layer backed by `CLOUD_BOX_TOKEN`.
 *
 * @example
 * ```ts
 * import { BoxConfig, BoxConfigLayer } from "@beep/box"
 * import { ConfigProvider, Effect, Redacted } from "effect"
 *
 * const ConfigLive = ConfigProvider.layer(
 *   ConfigProvider.fromUnknown({ CLOUD_BOX_TOKEN: "box-token" })
 * )
 *
 * const token = Effect.runSync(
 *   BoxConfig.pipe(
 *     Effect.map((config) => Redacted.value(config.token)),
 *     Effect.provide(BoxConfigLayer),
 *     Effect.provide(ConfigLive)
 *   )
 * )
 * console.log(token)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const BoxConfigLayer = Layer.effect(
  BoxConfig,
  Effect.gen(function* () {
    const token = yield* Config.redacted("CLOUD_BOX_TOKEN").pipe(
      Effect.mapError((cause) =>
        BoxError.fromReason("config", {
          cause,
        })
      )
    );
    return BoxDeveloperTokenConfig.make({ token });
  })
);

/**
 * Backward-compatible alias for {@link BoxConfigLayer}.
 *
 * @example
 * ```ts
 * import { BoxConfig, layer } from "@beep/box"
 * import { ConfigProvider, Effect, Redacted } from "effect"
 *
 * const ConfigLive = ConfigProvider.layer(
 *   ConfigProvider.fromUnknown({ CLOUD_BOX_TOKEN: "box-token" })
 * )
 *
 * const token = Effect.runSync(
 *   BoxConfig.pipe(
 *     Effect.map((config) => Redacted.value(config.token)),
 *     Effect.provide(layer),
 *     Effect.provide(ConfigLive)
 *   )
 * )
 * console.log(token)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layer = BoxConfigLayer;

/**
 * Construct a developer-token configuration layer from an explicit token.
 *
 * @example
 * ```ts
 * import { BoxConfig, layerConfig } from "@beep/box"
 * import { Effect, Redacted } from "effect"
 *
 * const ConfigLive = layerConfig(Redacted.make("box-token"))
 * const token = Effect.runSync(
 *   BoxConfig.pipe(
 *     Effect.map((config) => Redacted.value(config.token)),
 *     Effect.provide(ConfigLive)
 *   )
 * )
 * console.log(token)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const layerConfig = (token: Redacted.Redacted<string>): Layer.Layer<BoxConfig> =>
  Layer.succeed(BoxConfig, BoxDeveloperTokenConfig.make({ token }));
