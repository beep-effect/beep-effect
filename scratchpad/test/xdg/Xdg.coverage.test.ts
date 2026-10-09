import { assert, describe, it, vi } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { CurrentPlatform, Xdg } from "../../effected/xdg/Xdg.ts";

describe("Xdg fallback coverage", () => {
  it.effect("defaults colon-only search paths instead of returning an empty list", () =>
    Effect.scopedWith((scope) => Effect.gen(function* () {
      const layer = Xdg.layer.pipe(Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({
        HOME: "/home/test", XDG_CONFIG_DIRS: ":::", XDG_DATA_DIRS: ":",
      }))));
      const context = yield* Layer.buildWithScope(layer, scope);
      const paths = yield* Xdg.pipe(Effect.provideContext(context));
      assert.deepStrictEqual(paths.configDirs, ["/etc/xdg"]);
      assert.deepStrictEqual(paths.dataDirs, ["/usr/local/share", "/usr/share"]);
    })),
  );

  it.effect("uses Linux conventions when process is absent or reports an unknown platform", () =>
    Effect.gen(function* () {
      try {
        vi.stubGlobal("process", undefined);
        assert.strictEqual(CurrentPlatform.defaultValue(), "linux");
        vi.stubGlobal("process", { platform: "unknown-os" });
        assert.strictEqual(CurrentPlatform.defaultValue(), "linux");
        vi.stubGlobal("process", { platform: "darwin" });
        assert.strictEqual(CurrentPlatform.defaultValue(), "darwin");
      } finally {
        vi.unstubAllGlobals();
      }
    }),
  );
});
