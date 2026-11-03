import { HostProcessPlatform } from "@beep/utils/HostProcess";
import { currentPlatform, Xdg } from "@beep/xdg/Xdg";
import { assert, describe, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

describe("Xdg fallback coverage", () => {
  it.effect("defaults colon-only search paths instead of returning an empty list", () =>
    Effect.scopedWith((scope) =>
      Effect.gen(function* () {
        const layer = Xdg.layer.pipe(
          Layer.provide(
            ConfigProvider.layer(
              ConfigProvider.fromUnknown({
                HOME: "/home/test",
                XDG_CONFIG_DIRS: ":::",
                XDG_DATA_DIRS: ":",
              })
            )
          )
        );
        const context = yield* Layer.buildWithScope(layer, scope);
        const paths = yield* Xdg.pipe(Effect.provideContext(context));
        assert.deepStrictEqual(paths.configDirs, ["/etc/xdg"]);
        assert.deepStrictEqual(paths.dataDirs, ["/usr/local/share", "/usr/share"]);
      })
    )
  );

  it.effect("uses Linux conventions when the host reports no process or an unknown platform", () =>
    Effect.gen(function* () {
      const on = (platform: string) => currentPlatform.pipe(Effect.provideService(HostProcessPlatform, platform));
      // HostProcessPlatform reads "browser" when there is no `process` at all.
      const on1 = yield* on("browser");
      assert.strictEqual(on1, "linux");
      const on2 = yield* on("unknown-os");
      assert.strictEqual(on2, "linux");
      const on3 = yield* on("darwin");
      assert.strictEqual(on3, "darwin");
      const on4 = yield* on("win32");
      assert.strictEqual(on4, "win32");
    })
  );
});
