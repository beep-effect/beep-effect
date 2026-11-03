import { Jsonc } from "@beep/jsonc/Jsonc";
import {
  renderCacheIdentityLintProfile,
  verifyCacheIdentityLintProfile,
  writeCacheIdentityLintProfile,
} from "@beep/repo-cli/test/Cache";
import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as S from "effect/Schema";

const source =
  '{"root":true,"files":{"includes":["**","!**/*.gen.*","!!vendor"],"maxSize":4096},"plugins":["./rules/custom.grit"],"linter":{"enabled":true},"overrides":[{"includes":["**/test/**"],"formatter":{"enabled":false}}]}';
const decodeJson = Jsonc.bind(S.JsonObject).decode;

it.layer(NodeServices.layer)("identity lint profile projection", (it) => {
  it.effect("retains exclusion order, scanner settings, plugins, rules and overrides", () =>
    Effect.gen(function* () {
      const rendered = yield* renderCacheIdentityLintProfile(source);
      const profile = yield* decodeJson(rendered);
      expect(profile).toEqual({
        root: true,
        files: {
          includes: [
            "packages/foundation/modeling/identity/**",
            "packages/foundation/primitive/types/**",
            "!**/*.gen.*",
            "!!vendor",
          ],
          maxSize: 4096,
        },
        plugins: ["./rules/custom.grit"],
        linter: { enabled: true },
        overrides: [{ includes: ["**/test/**"], formatter: { enabled: false } }],
      });
      const renderCacheIdentityLintProfile1 = yield* renderCacheIdentityLintProfile(`// root comments\n${source}`);
      expect(renderCacheIdentityLintProfile1).toBe(rendered);
    })
  );

  it.effect("rejects unsupported roots and selectors instead of silently changing their meaning", () =>
    Effect.gen(function* () {
      for (const invalid of [
        "{",
        '{"files":{"includes":["**"]}}',
        '{"root":false,"files":{"includes":["**"]}}',
        '{"root":true,"extends":[],"files":{"includes":["**"]}}',
        '{"root":true,"files":{"includes":["packages/**"]}}',
        '{"root":true,"files":{"includes":["**","src/**"]}}',
        '{"root":true,"files":{"includes":["**","!"]}}',
        '{"root":true,"files":{"includes":[]}}',
      ]) {
        const pipe1 = yield* renderCacheIdentityLintProfile(invalid).pipe(Effect.isFailure);
        expect(pipe1).toBe(true);
      }
    })
  );

  it.effect("requires regeneration after root rule changes and detects edited output", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-profile-" });
      yield* fs.writeFileString(path.join(root, "biome.jsonc"), source);
      const pipe2 = yield* verifyCacheIdentityLintProfile(root).pipe(Effect.isFailure);
      expect(pipe2).toBe(true);
      yield* writeCacheIdentityLintProfile(root);
      yield* verifyCacheIdentityLintProfile(root);
      yield* fs.writeFileString(
        path.join(root, "biome.jsonc"),
        '{"root":true,"files":{"includes":["**","!**/src/index.ts"]},"linter":{"enabled":false}}'
      );
      const pipe3 = yield* verifyCacheIdentityLintProfile(root).pipe(Effect.isFailure);
      expect(pipe3).toBe(true);
      yield* writeCacheIdentityLintProfile(root);
      yield* verifyCacheIdentityLintProfile(root);
      yield* fs.writeFileString(path.join(root, "biome.identity.jsonc"), "{}\n");
      const pipe4 = yield* verifyCacheIdentityLintProfile(root).pipe(Effect.isFailure);
      expect(pipe4).toBe(true);
    })
  );

  it.effect("refuses output symlinks without changing their targets", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-profile-" });
      yield* fs.writeFileString(path.join(root, "biome.jsonc"), source);
      const target = path.join(root, "preserved.txt");
      yield* fs.writeFileString(target, "preserve");
      yield* fs.symlink("preserved.txt", path.join(root, "biome.identity.jsonc"));
      const pipe5 = yield* writeCacheIdentityLintProfile(root).pipe(Effect.isFailure);
      expect(pipe5).toBe(true);
      const pipe6 = yield* verifyCacheIdentityLintProfile(root).pipe(Effect.isFailure);
      expect(pipe6).toBe(true);
      const readFileString7 = yield* fs.readFileString(target);
      expect(readFileString7).toBe("preserve");
    })
  );
});
