import { GatewaySettings } from "@beep/practice-gateway/GatewaySettings";
import { it } from "@beep/test-runner";
import { HostProcessPlatform } from "@beep/utils";
import * as NodePath from "@effect/platform-node/NodePath";
import { expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

it.layer(
  GatewaySettings.layer.pipe(
    Layer.provide(NodePath.layer),
    Layer.provide(Layer.succeed(HostProcessPlatform, "linux")),
    Layer.provide(
      Layer.succeed(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromUnknown({
          HOME: "/home/synthetic",
          PRACTICE_GATEWAY_DATA_DIR: "${user_config.data_dir}",
          BUNDLE_DIR: "  /bundle  ",
          PRACTICE_KG_CORPUS_ROOT: "  ",
        })
      )
    )
  ),
  { timeout: "30 seconds" }
)("gateway Linux environment settings", (it) => {
  it.effect("ignores unresolved placeholders and trims optional directory settings", () =>
    Effect.gen(function* () {
      const settings = yield* GatewaySettings;
      expect(settings.dataDir).toBe("/home/synthetic/.local/share/beep/practice-gateway");
      assertSome(settings.bundleDir, "/bundle");
      assertNone(settings.corpusRoot);
      expect(settings.isWindows).toBe(false);
    })
  );
});

it.layer(
  GatewaySettings.layer.pipe(
    Layer.provide(NodePath.layer),
    Layer.provide(Layer.succeed(HostProcessPlatform, "win32")),
    Layer.provide(
      Layer.succeed(
        ConfigProvider.ConfigProvider,
        ConfigProvider.fromUnknown({ LOCALAPPDATA: "/local-app-data", PRACTICE_KG_BUNDLE_DIR: "/legacy-bundle" })
      )
    )
  ),
  { timeout: "30 seconds" }
)("gateway Windows environment settings", (it) => {
  it.effect("uses local application data and the legacy bundle setting when needed", () =>
    Effect.gen(function* () {
      const settings = yield* GatewaySettings;
      expect(settings.dataDir).toBe("/local-app-data/beep/practice-gateway");
      assertSome(settings.bundleDir, "/legacy-bundle");
      expect(settings.isWindows).toBe(true);
    })
  );
});
