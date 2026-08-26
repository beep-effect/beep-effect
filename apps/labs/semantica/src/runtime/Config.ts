import { $SemanticaId } from "@beep/identity/packages";
import { Config, Context, Layer } from "effect";
import * as S from "effect/Schema";

const $I = $SemanticaId.create("runtime/Config");

class LabConfigValue extends S.Class<LabConfigValue>($I`LabConfigValue`)(
  {
    corpusRoot: S.OptionFromNullOr(S.NonEmptyString),
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
 * directory, and `SEMANTICA_OFFLINE` defaults to `false`.
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
  offline: Config.boolean("SEMANTICA_OFFLINE").pipe(Config.withDefault(false)),
  providerCacheDirectory: Config.nonEmptyString("SEMANTICA_PROVIDER_CACHE_DIR").pipe(
    Config.withDefault(".beep/semantica/provider-cache")
  ),
}).pipe(Config.map((config) => LabConfigValue.make(config)));

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
