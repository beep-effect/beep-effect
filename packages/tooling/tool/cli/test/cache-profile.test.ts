import {
  renderCacheIdentityLintProfile,
  verifyCacheIdentityLintProfile,
  writeCacheIdentityLintProfile,
} from "@beep/repo-cli/test/Cache";
import { decodeJsoncTextAs } from "@beep/schema/Jsonc";
import { provideScopedLayer } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import * as S from "effect/Schema";

const source =
  '{"root":true,"files":{"includes":["**","!**/*.gen.*","!!vendor"],"maxSize":4096},"plugins":["./rules/custom.grit"],"linter":{"enabled":true},"overrides":[{"includes":["**/test/**"],"formatter":{"enabled":false}}]}';
const decodeJson = decodeJsoncTextAs(S.JsonObject);

describe("identity lint profile projection", () => {
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
      expect(yield* renderCacheIdentityLintProfile(`// root comments\n${source}`)).toBe(rendered);
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
      ])
        expect(yield* renderCacheIdentityLintProfile(invalid).pipe(Effect.isFailure)).toBe(true);
    })
  );

  it.effect("requires regeneration after root rule changes and detects edited output", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-profile-" });
      yield* fs.writeFileString(path.join(root, "biome.jsonc"), source);
      expect(yield* verifyCacheIdentityLintProfile(root).pipe(Effect.isFailure)).toBe(true);
      yield* writeCacheIdentityLintProfile(root);
      yield* verifyCacheIdentityLintProfile(root);
      yield* fs.writeFileString(
        path.join(root, "biome.jsonc"),
        '{"root":true,"files":{"includes":["**","!**/src/index.ts"]},"linter":{"enabled":false}}'
      );
      expect(yield* verifyCacheIdentityLintProfile(root).pipe(Effect.isFailure)).toBe(true);
      yield* writeCacheIdentityLintProfile(root);
      yield* verifyCacheIdentityLintProfile(root);
      yield* fs.writeFileString(path.join(root, "biome.identity.jsonc"), "{}\n");
      expect(yield* verifyCacheIdentityLintProfile(root).pipe(Effect.isFailure)).toBe(true);
    }).pipe(provideScopedLayer(NodeServices.layer))
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
      expect(yield* writeCacheIdentityLintProfile(root).pipe(Effect.isFailure)).toBe(true);
      expect(yield* verifyCacheIdentityLintProfile(root).pipe(Effect.isFailure)).toBe(true);
      expect(yield* fs.readFileString(target)).toBe("preserve");
    }).pipe(provideScopedLayer(NodeServices.layer))
  );
});
