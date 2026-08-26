import { $SemanticaId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import { Config, Context, Layer } from "effect";
import * as Bool from "effect/Boolean";
import * as S from "effect/Schema";

const $I = $SemanticaId.create("runtime/Config");

/**
 * Provider execution modes supported by the lab runtime.
 *
 * **Example** (Check replay mode)
 *
 * ```ts
 * import { RuntimeMode } from "@/runtime/Config"
 *
 * console.log(RuntimeMode.is.replay("replay")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RuntimeMode = LiteralKit(["live", "replay"]).pipe(
  $I.annoteSchema("RuntimeMode", {
    description: "Explicit live-provider or cache-only runtime selection.",
  })
);

class LabConfigValue extends S.Class<LabConfigValue>($I`LabConfigValue`)(
  {
    corpusRoot: S.OptionFromNullOr(S.NonEmptyString),
    extractorModel: S.NonEmptyString,
    goldDirectory: S.NonEmptyString,
    goldModel: S.NonEmptyString,
    ledgerRoot: S.NonEmptyString,
    mode: RuntimeMode,
    offline: S.Boolean,
    providerCacheDirectory: S.NonEmptyString,
  },
  $I.annote("LabConfigValue", {
    description: "Environment-decoded configuration used by the headless Semantica runtime.",
  })
) {}

/**
 * App-local configuration available to Semantica canary services.
 *
 * **Details**
 *
 * `SEMANTICA_CORPUS_ROOT` is optional so the shell can start in a typed degraded
 * mode. `SEMANTICA_PROVIDER_CACHE_DIR` defaults to the repository-local cache
 * directory, `SEMANTICA_XAI_MODEL` defaults to `grok-4`, and
 * `SEMANTICA_OFFLINE` selects explicit `replay` mode when true.
 *
 * **Example** (Read runtime configuration)
 *
 * ```ts
 * import { LabConfig } from "@/runtime/Config"
 * import { Effect } from "effect"
 *
 * const readOffline = LabConfig.pipe(Effect.map((config) => config.offline))
 * console.log(Effect.isEffect(readOffline)) // true
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export class LabConfig extends Context.Service<LabConfig, LabConfigValue>()($I`LabConfig`) {}

const labConfig = Config.all({
  corpusRoot: Config.option(Config.nonEmptyString("SEMANTICA_CORPUS_ROOT")),
  extractorModel: Config.nonEmptyString("AI_ANTHROPIC_MODEL").pipe(Config.withDefault("claude-sonnet-4-5-20250929")),
  goldDirectory: Config.nonEmptyString("SEMANTICA_GOLD_DIR").pipe(Config.withDefault("fixtures/gold/v1")),
  goldModel: Config.nonEmptyString("SEMANTICA_XAI_MODEL").pipe(Config.withDefault("grok-4")),
  ledgerRoot: Config.nonEmptyString("SEMANTICA_LEDGER_ROOT").pipe(Config.withDefault(".beep/semantica/ledger")),
  offline: Config.boolean("SEMANTICA_OFFLINE").pipe(Config.withDefault(false)),
  providerCacheDirectory: Config.nonEmptyString("SEMANTICA_PROVIDER_CACHE_DIR").pipe(
    Config.withDefault(".beep/semantica/provider-cache")
  ),
}).pipe(
  Config.map((config) =>
    LabConfigValue.make({
      ...config,
      mode: Bool.match(config.offline, {
        onFalse: () => "live" as const,
        onTrue: () => "replay" as const,
      }),
    })
  )
);

/**
 * Decodes {@link LabConfig} from the active Effect ConfigProvider.
 *
 * **Example** (Inspect the configuration layer)
 *
 * ```ts
 * import { LabConfigLive } from "@/runtime/Config"
 * import { Layer } from "effect"
 *
 * console.log(Layer.isLayer(LabConfigLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const LabConfigLive = Layer.effect(LabConfig, labConfig);
