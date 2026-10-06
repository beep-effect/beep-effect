/**
 * Disk-backed home for Fallow's reusable audit base-snapshot caches.
 *
 * `fallow audit` materializes the base commit as a private Git checkout named
 * `fallow-audit-base-cache-<key>-root-<key>` (with `.lock`, `.sha` and
 * `.last-used` sidecars) under the process `TMPDIR`. The key is a hash of the
 * project root, so every lane owns one ~600 MB snapshot that Fallow reuses
 * across runs and rebuilds in place when the base SHA moves. On this
 * workstation `/tmp` is zram-backed tmpfs, so idle snapshots became swap. This
 * module chooses the disk-backed root (`~/.cache/beep/fallow` by default) and
 * the environment that points Fallow at it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import * as O from "@beep/utils/Option";
import { Effect, FileSystem, Number as N, Path, pipe } from "effect";
import * as S from "effect/Schema";
import { configuredPath, resolveBeepCacheRoot } from "./BeepCacheRoot.ts";

const $I = $RepoCliId.create("internal/repo-run/FallowAuditCache");

/**
 * Environment variable that overrides the Fallow audit cache root.
 *
 * **Example** (Name the override variable)
 *
 * ```ts
 * import { FALLOW_AUDIT_CACHE_ROOT_ENV } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(FALLOW_AUDIT_CACHE_ROOT_ENV) // "BEEP_FALLOW_CACHE_ROOT"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const FALLOW_AUDIT_CACHE_ROOT_ENV = "BEEP_FALLOW_CACHE_ROOT" as const;

/**
 * Fallow's own age threshold variable for its silent per-run cache GC.
 *
 * **Example** (Name Fallow's threshold variable)
 *
 * ```ts
 * import { FALLOW_AUDIT_CACHE_MAX_AGE_ENV } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(FALLOW_AUDIT_CACHE_MAX_AGE_ENV) // "FALLOW_AUDIT_CACHE_MAX_AGE_DAYS"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const FALLOW_AUDIT_CACHE_MAX_AGE_ENV = "FALLOW_AUDIT_CACHE_MAX_AGE_DAYS" as const;

/**
 * Path segments under the beep cache root that hold Fallow audit caches.
 *
 * **Example** (Join the segments)
 *
 * ```ts
 * import { FALLOW_AUDIT_CACHE_SEGMENTS } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(FALLOW_AUDIT_CACHE_SEGMENTS.join("/")) // "beep/fallow"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const FALLOW_AUDIT_CACHE_SEGMENTS: ReadonlyArray<string> = ["beep", "fallow"];

/**
 * Default age, in days, after which Fallow's own GC reclaims an owned idle cache.
 *
 * **Example** (Read the default)
 *
 * ```ts
 * import { DEFAULT_FALLOW_AUDIT_CACHE_MAX_AGE_DAYS } from "@beep/repo-cli/test/RepoRun"
 *
 * console.log(DEFAULT_FALLOW_AUDIT_CACHE_MAX_AGE_DAYS) // 2
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const DEFAULT_FALLOW_AUDIT_CACHE_MAX_AGE_DAYS = 2;

/**
 * Resolved location and GC policy for Fallow audit base-snapshot caches.
 *
 * **Details**
 *
 * `root` is the absolute directory handed to Fallow as `TMPDIR`; Fallow keys
 * each snapshot inside it by project root, so concurrent lanes share the root
 * without sharing snapshots. `maxAgeDays` is forwarded to Fallow's silent
 * per-run GC (`FALLOW_AUDIT_CACHE_MAX_AGE_DAYS`), which reclaims the invoking
 * project's own idle snapshot and every snapshot whose recorded owner root no
 * longer exists.
 *
 * **Example** (Describe a cache policy)
 *
 * ```ts
 * import { FallowAuditCacheSettings } from "@beep/repo-cli/test/RepoRun"
 *
 * const settings = FallowAuditCacheSettings.make({ root: "/home/dev/.cache/beep/fallow", maxAgeDays: 2 })
 * console.log(settings.maxAgeDays) // 2
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class FallowAuditCacheSettings extends S.Class<FallowAuditCacheSettings>($I`FallowAuditCacheSettings`)(
  {
    root: S.String,
    maxAgeDays: S.Int.pipe(S.check(S.isGreaterThanOrEqualTo(0))),
  },
  $I.annote("FallowAuditCacheSettings", {
    description: "Disk-backed root and Fallow GC age threshold for audit base-snapshot caches.",
  })
) {}

const isCacheMaxAgeDays = S.is(FallowAuditCacheSettings.fields.maxAgeDays);

/**
 * Resolve where Fallow audit caches live and how old an idle one may grow.
 *
 * **Details**
 *
 * A non-empty absolute `BEEP_FALLOW_CACHE_ROOT` wins; otherwise the root is
 * `<beep cache root>/beep/fallow`, where the beep cache root follows
 * `XDG_CACHE_HOME`, then `$HOME/.cache`. `FALLOW_AUDIT_CACHE_MAX_AGE_DAYS`
 * overrides the default GC age when it parses as a non-negative integer.
 *
 * **Example** (Build the resolution effect)
 *
 * ```ts
 * import { resolveFallowAuditCacheSettings } from "@beep/repo-cli/test/RepoRun"
 * import { Effect } from "effect"
 *
 * console.log(Effect.isEffect(resolveFallowAuditCacheSettings())) // true
 * ```
 *
 * @returns The resolved cache settings.
 * @category configuration
 * @since 0.0.0
 */
export const resolveFallowAuditCacheSettings = Effect.fn("FallowAuditCache.resolveFallowAuditCacheSettings")(
  function* (): Effect.fn.Return<FallowAuditCacheSettings, never, Path.Path> {
    const pathService = yield* Path.Path;
    const override = O.filter(yield* configuredPath(FALLOW_AUDIT_CACHE_ROOT_ENV), pathService.isAbsolute);
    const root = yield* O.match(override, {
      onNone: () =>
        resolveBeepCacheRoot().pipe(
          Effect.orDie,
          Effect.map((cacheRoot) => pathService.join(cacheRoot, ...FALLOW_AUDIT_CACHE_SEGMENTS))
        ),
      onSome: (value) => Effect.succeed(pathService.resolve(value)),
    });
    const maxAgeDays = pipe(
      yield* configuredPath(FALLOW_AUDIT_CACHE_MAX_AGE_ENV),
      O.flatMap(N.parse),
      O.filter(isCacheMaxAgeDays),
      O.getOrElse(() => DEFAULT_FALLOW_AUDIT_CACHE_MAX_AGE_DAYS)
    );
    return FallowAuditCacheSettings.make({ root, maxAgeDays });
  }
);

/**
 * Create the Fallow audit cache root so Fallow can place snapshots inside it.
 *
 * **Example** (Build the ensure effect)
 *
 * ```ts
 * import { ensureFallowAuditCacheRoot, FallowAuditCacheSettings } from "@beep/repo-cli/test/RepoRun"
 * import { Effect } from "effect"
 *
 * const settings = FallowAuditCacheSettings.make({ root: "/home/dev/.cache/beep/fallow", maxAgeDays: 2 })
 * console.log(Effect.isEffect(ensureFallowAuditCacheRoot(settings))) // true
 * ```
 *
 * @param settings - Resolved cache settings.
 * @returns The settings, once the root directory exists.
 * @category configuration
 * @since 0.0.0
 */
export const ensureFallowAuditCacheRoot = Effect.fn("FallowAuditCache.ensureFallowAuditCacheRoot")(function* (
  settings: FallowAuditCacheSettings
) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(settings.root, { recursive: true });
  return settings;
});

/**
 * Environment overrides that steer a Fallow child process at the cache root.
 *
 * **Details**
 *
 * Fallow derives its cache root from `TMPDIR`, so the root is exported under
 * that name for the child only; the parent's `TMPDIR` is untouched.
 *
 * **Example** (Project the child environment)
 *
 * ```ts
 * import { fallowAuditCacheEnv, FallowAuditCacheSettings } from "@beep/repo-cli/test/RepoRun"
 *
 * const env = fallowAuditCacheEnv(FallowAuditCacheSettings.make({ root: "/cache/beep/fallow", maxAgeDays: 2 }))
 * console.log(env.TMPDIR, env.FALLOW_AUDIT_CACHE_MAX_AGE_DAYS) // "/cache/beep/fallow" "2"
 * ```
 *
 * @param settings - Resolved cache settings.
 * @returns Environment entries to merge into the Fallow child process.
 * @category configuration
 * @since 0.0.0
 */
export const fallowAuditCacheEnv = (settings: FallowAuditCacheSettings): Record<string, string> => ({
  TMPDIR: settings.root,
  [FALLOW_AUDIT_CACHE_MAX_AGE_ENV]: `${settings.maxAgeDays}`,
});

/**
 * Bun argv that deletes the audit caches one project root owns.
 *
 * **Example** (Build the removal argv)
 *
 * ```ts
 * import { fallowAuditCacheRemoveArgs } from "@beep/repo-cli/test/RepoRun"
 *
 * const args = fallowAuditCacheRemoveArgs("/repo-worktrees/feature-x")
 * console.log(args.includes("audit-cache"), args[args.length - 1]) // true "--yes"
 * ```
 *
 * @param projectRoot - Absolute project root whose snapshot should go.
 * @returns Ordered Bun argv for `fallow audit-cache remove`.
 * @category configuration
 * @since 0.0.0
 */
export const fallowAuditCacheRemoveArgs = (projectRoot: string): ReadonlyArray<string> => [
  "run",
  "fallow",
  "--",
  "audit-cache",
  "remove",
  "--root",
  projectRoot,
  "--format",
  "json",
  "--yes",
];
