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
});
