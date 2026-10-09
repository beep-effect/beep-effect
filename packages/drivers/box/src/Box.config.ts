/**
 * Box driver configuration models and Layers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BoxId } from "@beep/identity";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { BoxError } from "./Box.errors.ts";
import type * as Redacted from "effect/Redacted";

const $I = $BoxId.create("Box.config");

const BoxCcgConfigShape = S.Struct({
  clientId: S.String,
  clientSecret: S.Redacted(S.String),
  enterpriseId: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
  userId: S.OptionFromOptionalKey(S.String).pipe(S.withConstructorDefault(Effect.succeedNone)),
}).check(
  S.makeFilter((config) => O.isSome(config.enterpriseId) !== O.isSome(config.userId), {
    identifier: $I`BoxCcgSubjectCheck`,
    title: "Box CCG subject",
    description: "Requires exactly one enterprise id or user id for Box Client Credentials Grant auth.",
    message: "Expected exactly one of enterpriseId or userId for Box CCG auth",
  })
);

/**
 * Developer-token configuration for local Box access.
 *
 * **Example** (Make developer token config)
 *
 * ```ts
 * import { BoxDeveloperTokenConfig } from "@beep/box"
 * import * as Redacted from "effect/Redacted";
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
 * **Gotchas**
 *
 * Exactly one subject must be configured. `enterpriseId` authenticates the
 * application's service account; `userId` authenticates as that Box user.
 *
 * **Example** (Make CCG enterprise config)
 *
 * ```ts
 * import { BoxCcgConfig } from "@beep/box"
 * import * as Redacted from "effect/Redacted";
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
  BoxCcgConfigShape,
  $I.annote("BoxCcgConfig", {
    description: "Client Credentials Grant configuration for the Box technical driver.",
  })
) {}

/**
 * Box developer-token configuration service.
 *
 * **Example** (Provide config service layer)
 *
 * ```ts
 * import { BoxConfig, BoxDeveloperTokenConfig } from "@beep/box"
 * import * as Effect from "effect/Effect";
 * import * as Layer from "effect/Layer";
 * import * as Redacted from "effect/Redacted";
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
 * **Example** (Read token from env)
 *
 * ```ts
 * import { BoxConfig, BoxConfigLayer } from "@beep/box"
 * import * as ConfigProvider from "effect/ConfigProvider";
 * import * as Effect from "effect/Effect";
 * import * as Redacted from "effect/Redacted";
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
    const token = yield* Config.Redacted("CLOUD_BOX_TOKEN").pipe(
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
 * **Example** (Use layer alias)
 *
 * ```ts
 * import { BoxConfig, layer } from "@beep/box"
 * import * as ConfigProvider from "effect/ConfigProvider";
 * import * as Effect from "effect/Effect";
 * import * as Redacted from "effect/Redacted";
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
 * **Example** (Layer from explicit token)
 *
 * ```ts
 * import { BoxConfig, layerConfig } from "@beep/box"
 * import * as Effect from "effect/Effect";
 * import * as Redacted from "effect/Redacted";
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
