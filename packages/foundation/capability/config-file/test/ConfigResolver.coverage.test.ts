import { ConfigResolver } from "@beep/config-file/ConfigResolver";
import { MemoryFileSystem } from "@beep/memfs";
import { HostProcessPlatform } from "@beep/utils/HostProcess";
import { afterEach, assert, describe, it, vi } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

afterEach(() => vi.unstubAllGlobals());
const platform = Layer.mergeAll(MemoryFileSystem.layerWith({ "/config": "{}", "/package.json": "null" }), Path.layer);

it.layer(platform, { timeout: "30 seconds" })((it) => {
  describe("resolver host fallbacks", () => {
    it.effect("uses root when process is absent", () =>
      Effect.gen(function* () {
        vi.stubGlobal("process", undefined);
        const resolved = yield* ConfigResolver.upwardWalk({ filename: "config" }).resolve;
        assertSome(resolved, "/config");
        const resolved1 = yield* ConfigResolver.workspaceRoot({ filename: "config" }).resolve;
        assertNone(resolved1);
        const resolved2 = yield* ConfigResolver.systemEtc({ app: "absent", filename: "config" }).resolve;
        assertNone(resolved2);
      })
    );
    it.effect("uses root when process has no cwd", () =>
      Effect.gen(function* () {
        vi.stubGlobal("process", {});
        const resolved3 = yield* ConfigResolver.upwardWalk({ filename: "config" }).resolve;
        assertSome(resolved3, "/config");
      })
    );
    it.effect("skips etc on Windows, read from HostProcessPlatform rather than the process global", () =>
      Effect.gen(function* () {
        // Conformance shift (W3-e): the platform is the `HostProcessPlatform`
        // reference, so a test pins it with `provideService` instead of stubbing
        // `globalThis.process`.
        const etc = ConfigResolver.systemEtc({ app: "app", filename: "config", dir: "/" });
        const windows = yield* Effect.provideService(
          etc.resolveProbe ?? Effect.die("no probe"),
          HostProcessPlatform,
          "win32"
        );
        assertNone(windows.match);
        assert.deepStrictEqual(windows.probed, []);
        const linux = yield* Effect.provideService(
          etc.resolveProbe ?? Effect.die("no probe"),
          HostProcessPlatform,
          "linux"
        );
        assert.deepStrictEqual(linux.probed, ["/app/config"]);
      })
    );
    it.effect("uses the host cwd when no cwd is supplied", () =>
      Effect.gen(function* () {
        vi.stubGlobal("process", { cwd: () => "/", platform: "linux" });
        const resolved4 = yield* ConfigResolver.upwardWalk({ filename: "config" }).resolve;
        assertSome(resolved4, "/config");
      })
    );
  });
});

// The workspace-root markers and a present system config, as unit cases on
// memfs: the integration suite covers them on a real tree, and these keep the
// coverage lane (which excludes test/integration) at full branch coverage.
const markers = Layer.mergeAll(
  MemoryFileSystem.layerWith({
    "/npm/package.json": `{"workspaces":["packages/*"]}`,
    "/npm/.apprc": "{}",
    "/npm/sub/keep": "",
    "/pnpm/pnpm-workspace.yaml": "packages: []\n",
    "/pnpm/.apprc": "{}",
    "/plain/package.json": `{"name":"plain"}`,
    "/plain/.apprc": "{}",
    "/broken/package.json": "{not json",
    "/broken/.apprc": "{}",
    "/etc-root/app/config": "{}",
  }),
  Path.layer
);

it.layer(markers, { timeout: "30 seconds" })((it) => {
  describe("workspace-root markers and a present system config", () => {
    it.effect("a package.json with workspaces marks the root, from a nested cwd", () =>
      Effect.gen(function* () {
        const resolved5 = yield* ConfigResolver.workspaceRoot({ filename: ".apprc", cwd: "/npm/sub" }).resolve;
        assertSome(resolved5, "/npm/.apprc");
      })
    );
    it.effect("pnpm-workspace.yaml marks the root", () =>
      Effect.gen(function* () {
        const resolved6 = yield* ConfigResolver.workspaceRoot({ filename: ".apprc", cwd: "/pnpm" }).resolve;
        assertSome(resolved6, "/pnpm/.apprc");
      })
    );
    it.effect("a package.json without workspaces, or one that is not JSON, marks nothing", () =>
      Effect.gen(function* () {
        const resolved7 = yield* ConfigResolver.workspaceRoot({ filename: ".apprc", cwd: "/plain" }).resolve;
        assertNone(resolved7);
        const resolved8 = yield* ConfigResolver.workspaceRoot({ filename: ".apprc", cwd: "/broken" }).resolve;
        assertNone(resolved8);
      })
    );
    it.effect("systemEtc finds a config that exists under its root", () =>
      Effect.gen(function* () {
        const etc = ConfigResolver.systemEtc({ app: "app", filename: "config", dir: "/etc-root" });
        const provideService9 = yield* Effect.provideService(etc.resolve, HostProcessPlatform, "linux");
        assertSome(provideService9, "/etc-root/app/config");
      })
    );
  });
});

it.effect("the exported resolver facade is constructible for JavaScript consumers", () =>
  Effect.sync(() => {
    assert.isTrue(Reflect.construct(ConfigResolver, []) instanceof ConfigResolver);
  })
);
