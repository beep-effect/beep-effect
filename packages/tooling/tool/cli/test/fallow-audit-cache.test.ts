import {
  DEFAULT_FALLOW_AUDIT_CACHE_MAX_AGE_DAYS,
  ensureFallowAuditCacheRoot,
  FALLOW_AUDIT_CACHE_MAX_AGE_ENV,
  FALLOW_AUDIT_CACHE_ROOT_ENV,
  FALLOW_AUDIT_CACHE_SEGMENTS,
  FallowAuditCacheSettings,
  fallowAuditCacheEnv,
  fallowAuditCacheRemoveArgs,
  resolveFallowAuditCacheSettings,
} from "@beep/repo-cli/test/RepoRun";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";

const withEnvironment = (environment: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown(environment));

describe("fallow audit cache", () => {
  it.layer(NodeServices.layer, { concurrent: false, timeout: "30 seconds" })((it) => {
    it.effect("resolves the disk-backed root under the beep cache root by default", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const settings = yield* resolveFallowAuditCacheSettings().pipe(
          withEnvironment({ XDG_CACHE_HOME: "/var/cache/dev" })
        );
        expect(settings.root).toBe(path.join("/var/cache/dev", ...FALLOW_AUDIT_CACHE_SEGMENTS));
        expect(settings.maxAgeDays).toBe(DEFAULT_FALLOW_AUDIT_CACHE_MAX_AGE_DAYS);
      })
    );

    it.effect("honors the explicit root override and Fallow's own age threshold", () =>
      Effect.gen(function* () {
        const settings = yield* resolveFallowAuditCacheSettings().pipe(
          withEnvironment({
            [FALLOW_AUDIT_CACHE_ROOT_ENV]: "/srv/fallow-cache/",
            [FALLOW_AUDIT_CACHE_MAX_AGE_ENV]: "5",
            XDG_CACHE_HOME: "/var/cache/dev",
          })
        );
        expect(settings.root).toBe("/srv/fallow-cache");
        expect(settings.maxAgeDays).toBe(5);
      })
    );

    it.effect("ignores a relative override, a negative age, and a non-numeric age", () =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const negative = yield* resolveFallowAuditCacheSettings().pipe(
          withEnvironment({
            [FALLOW_AUDIT_CACHE_ROOT_ENV]: "relative/cache",
            [FALLOW_AUDIT_CACHE_MAX_AGE_ENV]: "-3",
            XDG_CACHE_HOME: "/var/cache/dev",
          })
        );
        expect(negative.root).toBe(path.join("/var/cache/dev", ...FALLOW_AUDIT_CACHE_SEGMENTS));
        expect(negative.maxAgeDays).toBe(DEFAULT_FALLOW_AUDIT_CACHE_MAX_AGE_DAYS);

        const malformed = yield* resolveFallowAuditCacheSettings().pipe(
          withEnvironment({ [FALLOW_AUDIT_CACHE_MAX_AGE_ENV]: "soon", XDG_CACHE_HOME: "/var/cache/dev" })
        );
        expect(malformed.maxAgeDays).toBe(DEFAULT_FALLOW_AUDIT_CACHE_MAX_AGE_DAYS);
      })
    );

    it.effect("creates the cache root so Fallow can place snapshots inside it", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const parent = yield* fs.makeTempDirectoryScoped({ prefix: "fallow-audit-cache-test-" });
        const root = path.join(parent, "beep", "fallow");
        const settings = yield* ensureFallowAuditCacheRoot(FallowAuditCacheSettings.make({ root, maxAgeDays: 0 }));
        expect(settings.root).toBe(root);
        expect(yield* fs.exists(root)).toBe(true);
      })
    );

    it.effect("projects TMPDIR and the age threshold into the Fallow child environment", () =>
      Effect.sync(() => {
        const env = fallowAuditCacheEnv(FallowAuditCacheSettings.make({ root: "/srv/fallow-cache", maxAgeDays: 3 }));
        expect(env).toEqual({ TMPDIR: "/srv/fallow-cache", [FALLOW_AUDIT_CACHE_MAX_AGE_ENV]: "3" });
        expect(fallowAuditCacheRemoveArgs("/lanes/feature-x")).toEqual([
          "run",
          "fallow",
          "--",
          "audit-cache",
          "remove",
          "--root",
          "/lanes/feature-x",
          "--format",
          "json",
          "--yes",
        ]);
      })
    );
  });
});
