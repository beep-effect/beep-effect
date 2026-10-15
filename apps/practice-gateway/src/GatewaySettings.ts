/**
 * Process-level settings of the practice gateway: where it keeps its own
 * data, which platform it runs on, and the folders the extension settings
 * point at.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $PracticeGatewayId } from "@beep/identity/packages";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $PracticeGatewayId.create("GatewaySettings");

/**
 * Resolved gateway settings.
 *
 * **Details**
 *
 * `bundleDir`, `corpusRoot` and `m365ClientId` come from the extension's
 * `user_config` (`BUNDLE_DIR`, `PRACTICE_KG_CORPUS_ROOT`, `M365_CLIENT_ID`);
 * all are optional. `dataDir` holds the saved practice profile and the
 * DPAPI-protected Microsoft 365 token cache. It never holds secrets in clear.
 *
 * **Example** (Build settings for a test)
 *
 * ```ts
 * import { GatewaySettingsValues } from "@beep/practice-gateway/GatewaySettings"
 * import * as O from "effect/Option"
 *
 * const settings = GatewaySettingsValues.make({
 *   dataDir: "/tmp/gateway",
 *   isWindows: false,
 *   bundleDir: O.none(),
 *   corpusRoot: O.none(),
 * })
 * console.log(settings.isWindows) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class GatewaySettingsValues extends S.Opaque<GatewaySettingsValues, { readonly brand: unique symbol }>()(
  S.Struct({
    dataDir: S.NonEmptyString.annotateKey({ description: "Directory the gateway keeps its own data in." }),
    isWindows: S.Boolean.annotateKey({ description: "True when the gateway runs on Windows." }),
    bundleDir: S.Option(S.NonEmptyString).annotateKey({
      description: "Practice knowledge-graph bundle directory from the extension settings.",
    }),
    corpusRoot: S.Option(S.NonEmptyString).annotateKey({
      description: "Optional corpus root for practice knowledge-graph click-through.",
    }),
    m365ClientId: S.Option(S.NonEmptyString).pipe(S.withConstructorDefault(Effect.succeedNone)).annotateKey({
      description:
        "Microsoft 365 app (client) id from the extension settings; Microsoft 365 is unconfigured without it.",
    }),
  }).pipe(
    $I.annoteSchema("GatewaySettingsValues", {
      description: "Resolved process-level settings of the practice gateway.",
    })
  )
) {}

/**
 * Service carrying the resolved {@link GatewaySettingsValues}.
 *
 * **Example** (Provide fixed settings)
 *
 * ```ts
 * import { GatewaySettings, GatewaySettingsValues } from "@beep/practice-gateway/GatewaySettings"
 * import * as O from "effect/Option"
 *
 * const layer = GatewaySettings.layerFixed(
 *   GatewaySettingsValues.make({ dataDir: "/tmp/gateway", isWindows: false, bundleDir: O.none(), corpusRoot: O.none() })
 * )
 * console.log(typeof layer)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GatewaySettings extends Context.Service<GatewaySettings, GatewaySettingsValues>()($I`GatewaySettings`) {
  /**
   * Settings read from the process environment.
   *
   * **Details**
   *
   * The data directory is `PRACTICE_GATEWAY_DATA_DIR` when set, otherwise
   * `%LOCALAPPDATA%\beep\practice-gateway` on Windows and
   * `$XDG_DATA_HOME/beep/practice-gateway` (falling back to
   * `~/.local/share`) elsewhere. Claude Desktop substitutes an unset optional
   * `user_config` value with an empty string or leaves the `${user_config…}`
   * placeholder, so both read as absent.
   *
   * **Example** (Read settings from the environment)
   *
   * ```ts
   * import { GatewaySettings } from "@beep/practice-gateway/GatewaySettings"
   *
   * console.log(typeof GatewaySettings.layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = Layer.effect(
    GatewaySettings,
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const platform = yield* Config.String("PRACTICE_GATEWAY_PLATFORM").pipe(
        Config.withDefault(globalThis.process.platform)
      );
      const isWindows = platform === "win32";
      const dataDir = yield* resolveDataDir(path, isWindows);
      const bundleDir = O.firstSomeOf([
        yield* configuredSetting("BUNDLE_DIR"),
        yield* configuredSetting("PRACTICE_KG_BUNDLE_DIR"),
      ]);
      const corpusRoot = yield* configuredSetting("PRACTICE_KG_CORPUS_ROOT");
      const m365ClientId = yield* configuredSetting("M365_CLIENT_ID");
      return GatewaySettingsValues.make({ dataDir, isWindows, bundleDir, corpusRoot, m365ClientId });
    })
  );

  /**
   * Fixed settings, for tests and embedding.
   *
   * **Example** (Fix the data directory)
   *
   * ```ts
   * import { GatewaySettings, GatewaySettingsValues } from "@beep/practice-gateway/GatewaySettings"
   * import * as O from "effect/Option"
   *
   * const layer = GatewaySettings.layerFixed(
   *   GatewaySettingsValues.make({ dataDir: "/data", isWindows: true, bundleDir: O.some("/bundle"), corpusRoot: O.none() })
   * )
   * console.log(typeof layer)
   * ```
   *
   * @param values - Settings to serve.
   * @category layers
   * @since 0.0.0
   */
  static readonly layerFixed = (values: GatewaySettingsValues) => Layer.succeed(GatewaySettings, values);
}

const isUsableSetting = (value: string): boolean =>
  Str.isNonEmpty(Str.trim(value)) && !Str.startsWith("${")(Str.trim(value));

const configuredSetting = (name: string) =>
  Config.option(Config.String(name)).pipe(Effect.map(flow(O.map(Str.trim), O.filter(isUsableSetting))));

const resolveDataDir = Effect.fnUntraced(function* (path: Path.Path, isWindows: boolean) {
  const override = yield* configuredSetting("PRACTICE_GATEWAY_DATA_DIR");
  if (O.isSome(override)) {
    return override.value;
  }
  if (isWindows) {
    const localAppData = yield* Config.String("LOCALAPPDATA");
    return path.join(localAppData, "beep", "practice-gateway");
  }
  const xdg = yield* configuredSetting("XDG_DATA_HOME");
  const base = yield* O.match(xdg, {
    onNone: () => Config.String("HOME").pipe(Effect.map((home) => path.join(home, ".local", "share"))),
    onSome: Effect.succeed,
  });
  return path.join(base, "beep", "practice-gateway");
});
