import {
  decodePrSessionRegistry,
  makePrSessionRegistryLive,
  PrSessionRegistryError,
  prSessionRegistryFileName,
} from "@beep/repo-cli/test/Yeet";
import { it } from "@beep/test-runner";
import { assert, expect } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import { makeRecord, PlatformLayer, repository } from "./yeet-pr-fixtures.ts";

it.layer(PlatformLayer, { timeout: "30 seconds" })("Yeet PR session registry", (it) => {
  it.effect("appends, looks up two PRs, applies private modes, and skips corrupt lines", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
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
      const readFileString1 = yield* fs.readFileString(file);
      expect(decodePrSessionRegistry(readFileString1).corruptLineCount).toBe(1);
      const lookup2 = yield* registry.lookup(repository, 42);
      expect(lookup2).toHaveLength(1);
      const lookup3 = yield* registry.lookup(repository, 43);
      expect(lookup3).toHaveLength(1);
      const list4 = yield* registry.list(repository);
      expect(list4).toHaveLength(2);
      expect((yield* fs.stat(file)).mode & 0o777).toBe(0o600);
      expect((yield* fs.stat(path.dirname(file))).mode & 0o777).toBe(0o700);
    })
  );

  it.effect("returns a typed error when the state root cannot contain a directory", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempFileScoped();
      const registry = yield* makePrSessionRegistryLive().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnv({ env: { BEEP_YEET_STATE_ROOT: root, HOME: root } })
        )
      );
      const error = yield* registry.append(makeRecord()).pipe(Effect.flip);
      assert.instanceOf(error, PrSessionRegistryError);
    })
  );

  it.effect("treats missing and empty registry files as empty history", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      const registry = yield* makePrSessionRegistryLive().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnv({ env: { BEEP_YEET_STATE_ROOT: root, HOME: root } })
        )
      );
      const list5 = yield* registry.list(repository);
      expect(list5).toStrictEqual([]);
      const directory = path.join(root, "pr-sessions");
      yield* fs.makeDirectory(directory, { recursive: true });
      yield* fs.writeFileString(path.join(directory, prSessionRegistryFileName(repository)), "");
      const list6 = yield* registry.list(repository);
      expect(list6).toStrictEqual([]);
    })
  );

  it.effect("resolves XDG and HOME fallback state roots", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped();
      const xdg = path.join(root, "xdg");
      const xdgRegistry = yield* makePrSessionRegistryLive().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnv({ env: { XDG_STATE_HOME: xdg, HOME: root } })
        )
      );
      yield* xdgRegistry.append(makeRecord());
      const exists7 = yield* fs.exists(
        path.join(xdg, "beep", "yeet", "pr-sessions", prSessionRegistryFileName(repository))
      );
      expect(exists7).toBe(true);
      const homeRegistry = yield* makePrSessionRegistryLive().pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: { HOME: root } }))
      );
      yield* homeRegistry.append(makeRecord({ sessionId: "home-fallback" }));
      const exists8 = yield* fs.exists(
        path.join(root, ".local", "state", "beep", "yeet", "pr-sessions", prSessionRegistryFileName(repository))
      );
      expect(exists8).toBe(true);
    })
  );

  it.effect("classifies a fixture permission denial as denied", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      const registry = yield* makePrSessionRegistryLive().pipe(
        Effect.provideService(
          ConfigProvider.ConfigProvider,
          ConfigProvider.fromEnv({ env: { BEEP_YEET_STATE_ROOT: root, HOME: root } })
        )
      );
      const error = yield* Effect.acquireUseRelease(
        fs.chmod(root, 0o500),
        () => registry.append(makeRecord()),
        () => Effect.orDie(fs.chmod(root, 0o700))
      ).pipe(Effect.flip);
      assert.instanceOf(error, PrSessionRegistryError);
      expect(error.reason).toBe("denied");
    })
  );
});
