/**
 * Runtime configuration models for the Stately inspector bridge.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $XstateId } from "@beep/identity/packages";
import { LiteralKit, URLStr } from "@beep/schema";
import { Config, Effect, pipe } from "effect";
import * as S from "effect/Schema";

const $I = $XstateId.create("StatelyInspector.config");

/**
 * How the inspector UI is opened once the relay accepts the producer.
 *
 * **Example** (Inspect launch options)
 *
 * ```ts
 * import { StatelyInspectorLaunch } from "@beep/xstate"
 *
 * console.log(StatelyInspectorLaunch.literals) // ["none", "browser"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const StatelyInspectorLaunch = LiteralKit(["none", "browser"]).pipe(
  $I.annoteSchema("StatelyInspectorLaunch", {
    description: "Whether the SDK opens the inspector UI in the default browser after registering.",
  })
);

/**
 * Runtime type decoded by {@link StatelyInspectorLaunch}.
 *
 * @category models
 * @since 0.0.0
 */
export type StatelyInspectorLaunch = typeof StatelyInspectorLaunch.Type;

const launchDefault: StatelyInspectorLaunch = StatelyInspectorLaunch.Enum.none;

/**
 * Runtime configuration accepted by {@link StatelyInspector.makeLayer}.
 *
 * **Details**
 *
 * The inspector is disabled unless `enabled` is set, so production layers stay
 * inert by default. `relayUrl` overrides the hosted `wss://sky.stately.ai`
 * relay for self-hosted inspectors.
 *
 * **Example** (Enable a browser-launching inspector)
 *
 * ```ts
 * import { StatelyInspectorConfig } from "@beep/xstate"
 *
 * const config = StatelyInspectorConfig.make({ enabled: true, launch: "browser" })
 * console.log(config.launch) // "browser"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StatelyInspectorConfig extends S.Class<StatelyInspectorConfig>($I`StatelyInspectorConfig`)(
  {
    enabled: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultTypeKey(Effect.succeed(false))
    ).annotateKey({
      description: "Whether actors are forwarded to the Stately inspector relay at all.",
    }),
    launch: StatelyInspectorLaunch.pipe(
      S.withConstructorDefault(Effect.succeed(launchDefault)),
      S.withDecodingDefaultTypeKey(Effect.succeed(launchDefault))
    ).annotateKey({
      description: "Whether the SDK opens the inspector UI in the default browser.",
    }),
    relayUrl: S.OptionFromOptionalKey(URLStr).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "WebSocket relay base URL; omitted means the hosted Stately relay.",
    }),
    name: S.OptionFromOptionalKey(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description: "Display name for the inspected system in the visualizer.",
    }),
  },
  $I.annote("StatelyInspectorConfig", {
    description: "Runtime configuration for the Stately inspector bridge.",
  })
) {}

/**
 * Reads {@link StatelyInspectorConfig} from the environment.
 *
 * **Details**
 *
 * | Variable | Field |
 * | --- | --- |
 * | `STATELY_INSPECT` | `enabled` |
 * | `STATELY_INSPECT_LAUNCH` | `launch` |
 * | `STATELY_INSPECT_URL` | `relayUrl` |
 * | `STATELY_INSPECT_NAME` | `name` |
 *
 * **Example** (Resolve the inspector configuration)
 *
 * ```ts
 * import { StatelyInspectorConfigFromEnv } from "@beep/xstate"
 * import { Effect } from "effect"
 *
 * const program = Effect.map(StatelyInspectorConfigFromEnv, (config) => config.enabled)
 * console.log(program)
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const StatelyInspectorConfigFromEnv: Config.Config<StatelyInspectorConfig> = pipe(
  Config.all({
    enabled: pipe(Config.Boolean("STATELY_INSPECT"), Config.withDefault(false)),
    launch: pipe(
      Config.Literals(StatelyInspectorLaunch.literals, "STATELY_INSPECT_LAUNCH"),
      Config.withDefault(launchDefault)
    ),
    relayUrl: Config.option(Config.schema(URLStr, "STATELY_INSPECT_URL")),
    name: Config.option(Config.NonEmptyString("STATELY_INSPECT_NAME")),
  }),
  Config.map((fields) => StatelyInspectorConfig.make(fields))
);
