import {
  decodePrSessionRegistry,
  makePrSessionRegistryLive,
  PrSessionRegistryError,
  prSessionRegistryFileName,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import { assert, describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, FileSystem, Path } from "effect";
import { makeRecord, PlatformLayer, repository } from "./yeet-pr-fixtures.ts";

describe("Yeet PR session registry", () => {
  it.effect("appends, looks up two PRs, applies private modes, and skips corrupt lines", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectory();
      const registry = yield* makePrSessionRegistryLive().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnv({ env: { BEEP_YEET_STATE_ROOT: root, HOME: root } })
        )
      );
      yield* registry.append(makeRecord({ pr: 42 }));
      yield* registry.append(makeRecord({ pr: 43, sessionId: "same-session" }));
      const file = path.join(root, "pr-sessions", prSessionRegistryFileName(repository));
      yield* fs.writeFileString(file, "not-json\n", { flag: "a" });
      expect(decodePrSessionRegistry(yield* fs.readFileString(file)).corruptLineCount).toBe(1);
      expect(yield* registry.lookup(repository, 42)).toHaveLength(1);
      expect(yield* registry.lookup(repository, 43)).toHaveLength(1);
      expect(yield* registry.list(repository)).toHaveLength(2);
      expect((yield* fs.stat(file)).mode & 0o777).toBe(0o600);
      expect((yield* fs.stat(path.dirname(file))).mode & 0o777).toBe(0o700);
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("returns a typed error when the state root cannot contain a directory", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempFile();
      const registry = yield* makePrSessionRegistryLive().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnv({ env: { BEEP_YEET_STATE_ROOT: root, HOME: root } })
        )
      );
      const error = yield* registry.append(makeRecord()).pipe(Effect.flip);
      assert.instanceOf(error, PrSessionRegistryError);
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("treats missing and empty registry files as empty history", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectory();
      const registry = yield* makePrSessionRegistryLive().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnv({ env: { BEEP_YEET_STATE_ROOT: root, HOME: root } })
        )
      );
      expect(yield* registry.list(repository)).toStrictEqual([]);
      const directory = path.join(root, "pr-sessions");
      yield* fs.makeDirectory(directory, { recursive: true });
      yield* fs.writeFileString(path.join(directory, prSessionRegistryFileName(repository)), "");
      expect(yield* registry.list(repository)).toStrictEqual([]);
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("resolves XDG and HOME fallback state roots", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectory();
      const xdg = path.join(root, "xdg");
      const xdgRegistry = yield* makePrSessionRegistryLive().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnv({ env: { XDG_STATE_HOME: xdg, HOME: root } })
        )
      );
      yield* xdgRegistry.append(makeRecord());
      expect(
        yield* fs.exists(path.join(xdg, "beep", "yeet", "pr-sessions", prSessionRegistryFileName(repository)))
      ).toBe(true);
      const homeRegistry = yield* makePrSessionRegistryLive().pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: { HOME: root } }))
      );
      yield* homeRegistry.append(makeRecord({ sessionId: "home-fallback" }));
      expect(
        yield* fs.exists(
          path.join(root, ".local", "state", "beep", "yeet", "pr-sessions", prSessionRegistryFileName(repository))
        )
      ).toBe(true);
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("classifies a fixture permission denial as denied", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectory();
      const registry = yield* makePrSessionRegistryLive().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnv({ env: { BEEP_YEET_STATE_ROOT: root, HOME: root } })
        )
      );
      yield* fs.chmod(root, 0o500);
      const error = yield* registry.append(makeRecord()).pipe(Effect.ensuring(fs.chmod(root, 0o700)), Effect.flip);
      assert.instanceOf(error, PrSessionRegistryError);
      expect(error.reason).toBe("denied");
    }).pipe(provideScopedLayer(PlatformLayer))
  );
});
