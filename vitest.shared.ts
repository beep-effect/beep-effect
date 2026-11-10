// The include list must exist before vitest boots, and Effect's Node FileSystem
// is async, so this config-time scan uses the synchronous Node builtins. This file is one of the
// two declared directive exemptions in `beep quality tsgo-rules` (Quality.command.ts).
// @effect-diagnostics nodeBuiltinImport:skip-file

import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { A, P, Str, Struct } from "@beep/utils";
import * as Doctest from "@effect/doctest/Plugin";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Tuple from "effect/Tuple";
import { mergeConfig } from "vitest/config";
import { BaseSequencer } from "vitest/node";
import { appSourceAlias } from "./vite.shared.ts";
import generatedAliasPaths from "./vitest.aliases.generated.json" with { type: "json" };
import type { Plugin } from "vite";
import type { ViteUserConfig } from "vitest/config";
import type { TestSpecification } from "vitest/node";

type AliasEntry = {
  readonly find: RegExp | string;
  readonly replacement: string;
};

const projectRootDirectory = new URL("./", import.meta.url);
const setupFileUrl = new URL("./vitest.setup.ts", import.meta.url);
// V8 inspector coverage is unsupported on Bun and can falsely cover untouched
// branches. Use source instrumentation for explicit Bun coverage runs. Canonical
// local coverage commands retain Node/V8; hosted Unit shards qualify Bun/Istanbul
// reports against the same per-file ratchet before the CI producer is retired.
const coverageProvider = P.isUndefined(process.versions.bun) ? "v8" : "istanbul";

// Vite treats an explicit `.ts` suffix as an exact filename, while the repository
// convention intentionally uses `.ts` specifiers for both `.ts` and `.tsx` sources.
const resolveUniformTypeScriptSourceSpecifiers = (): Plugin => ({
  name: "beep:resolve-uniform-typescript-source-specifiers",
  enforce: "pre",
  resolveId(source, importer, options) {
    if (importer === undefined || !Str.startsWith(".")(source) || !Str.endsWith(".ts")(source)) {
      return null;
    }

    return this.resolve(source, importer, { ...options, skipSelf: true }).then((exactSource) =>
      exactSource === null
        ? this.resolve(Str.replace(/\.ts$/, ".tsx")(source), importer, { ...options, skipSelf: true })
        : exactSource
    );
  },
});

const configStringEqualsSync = (name: string, expected: string): boolean =>
  Config.String(name).pipe(
    Config.option,
    Effect.runSync,
    O.exists((value) => value === expected)
  );
/**
 * Selects package-local in-source tests without ordinary test includes.
 *
 * **Example** (Preserve the doctest selector in a package config)
 *
 * ```ts
 * import { vitestDoctestActive } from "./vitest.shared.ts"
 * const include = vitestDoctestActive ? [] : ["test/example.test.ts"]
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const vitestDoctestActive = configStringEqualsSync("BEEP_VITEST_DOCTEST", "1");
export const vitestCoverageReportOnly = configStringEqualsSync("VITEST_COVERAGE_REPORT_ONLY", "1");
// Env flags do not survive every spawn chain (root script -> turbo ->
// package script -> vitest); the vitest process's own argv is authoritative.
// Exported so per-package configs can honor the same coverage-aware timeout
// policy instead of clamping it back to a coverage-unaware constant.
export const vitestCoverageRunActive =
  vitestCoverageReportOnly ||
  configStringEqualsSync("VITEST_COVERAGE_RATCHET", "1") ||
  process.argv.includes("--coverage");

// one-round-loop P1: an active BEEP_FC_NUM_RUNS floor marks a deep
// property sweep (PR lane at 400, nightly at 1000+). Read via Config
// like the coverage flags above (boot-snapshot semantics are exactly
// what the lane wants — CI exports the floor before vitest starts).
const parsedFcNumRuns = Config.String("BEEP_FC_NUM_RUNS").pipe(
  Config.option,
  Effect.runSync,
  O.map(Number),
  O.getOrElse(() => 0)
);
export const fcDeepSweepActive = Number.isInteger(parsedFcNumRuns) && parsedFcNumRuns > 0;

// Per-test ceiling every doctest owner inherits in doctest mode. The first example of a file
// pays the module transform, which exceeded 30 s under the fleet's 4-way task concurrency on a
// 4-vCPU runner (C3.4 hosted round 1). The doctest guard asserts this value per owner.
const vitestDoctestTestTimeoutMs = 120_000;

/**
 * Resolve a package's per-test timeout without losing the shared doctest and instrumentation
 * ceilings. Package configs merge after this one, so a literal `testTimeout` there would clamp
 * doctest mode back to the focused value.
 *
 * **Example** (Keep focused headroom while doctests and coverage keep their ceilings)
 *
 * ```ts
 * import { packageTestTimeout } from "./vitest.shared.ts"
 * const testTimeout = packageTestTimeout(60_000)
 * ```
 */
export const packageTestTimeout = (focusedMs: number): number =>
  vitestDoctestActive ? vitestDoctestTestTimeoutMs : vitestCoverageRunActive || fcDeepSweepActive ? 300_000 : focusedMs;

// Quality-lane audit A1 (D10): the deep sweep only changes the behaviour of
// tests that draw from an arbitrary, so under an active floor selection runs at
// two levels. Everything it drops already ran in the unit lane at the default
// run count; replaying it at 400-1000 runs with rotating seeds cannot change
// its outcome, because the floor reaches a test only through `fcRuns()` options
// or an inline property call.
// 1. File level (config time, below): `include` is resolved to the test files
//    that match `propertyTestMarker`. The scan is a cheap synchronous walk of
//    `test/` under the vitest root (the package cwd).
// 2. Test level (`propertySweepPlainLines` + vitest.property-runner.ts): a
//    matched file whose relative-import graph runs a property inline
//    (`Arbitrary.checkEffect`/`sampleEffect`, `FastCheck`, `fc.assert`,
//    `assertSchemaArbitraryDecodesToSelf`, or `fcRuns` used anywhere but as a
//    `.prop` `arbitrary:` option) keeps every test. In any other matched file
//    a test is skipped only when the source line at its task location is
//    positively a plain `it(...)`/`it.effect(...)` registration; `.prop`
//    registrations and every unrecognised shape keep running, and suites left
//    with no runnable test skip their hooks. The pure rules live in
//    `@beep/fc-runs/PropertySelection`, which carries their unit tests.
// The snapshot's native Arbitrary model replaced the fast-check bridge: property
// files now import `effect/Arbitrary` and call `it.prop`,
// `it.effect.prop`, `Arbitrary.checkEffect`, or `Arbitrary.sampleEffect`.
// The shared assertion helper also runs native properties without a direct Arbitrary
// import at the call site, so helper-only files must remain in the deep sweep.
// The legacy FastCheck/fc shapes stay matched so an unmigrated straggler is still
// swept rather than silently dropped from the deep lane.
const propertyTestMarker =
  /\bFastCheck\b|\bfast-check\b|\bit\.prop\b|\bit\.effect\.prop\b|\bassertSchemaArbitraryDecodesToSelf\b|\bArbitrary\.(?:checkEffect|sampleEffect|schema)\b|\bunstable\/arbitrary\/Arbitrary\b|\bfc\.(?:property|asyncProperty|assert|sample|check)\b/;
const testFilePattern = /\.test\.tsx?$/;
const scanSkippedDirectories: ReadonlyArray<string> = ["node_modules", ".context", "fixtures"];
const listTestFiles = (directory: string): ReadonlyArray<string> => {
  try {
    return pipe(
      NodeFS.readdirSync(directory, { withFileTypes: true }),
      A.flatMap(
        (entry): ReadonlyArray<string> =>
          entry.isDirectory()
            ? A.contains(scanSkippedDirectories, entry.name)
              ? []
              : listTestFiles(NodePath.join(directory, entry.name))
            : testFilePattern.test(entry.name)
              ? [NodePath.join(directory, entry.name)]
              : []
      )
    );
  } catch {
    return [];
  }
};
const toPosixRelative = (root: string, file: string): string =>
  A.join(Str.split(NodePath.relative(root, file), NodePath.sep), "/");
const readSourceSync = (file: string): O.Option<string> => {
  try {
    return O.some(NodeFS.readFileSync(file, "utf8"));
  } catch {
    return O.none();
  }
};
const propertyTestFiles = (packageRoot: string): ReadonlyArray<string> =>
  pipe(
    listTestFiles(NodePath.join(packageRoot, "test")),
    A.filter((file) => O.exists(readSourceSync(file), (source) => propertyTestMarker.test(source))),
    A.sort(Order.String)
  );
const propertySweepFiles = fcDeepSweepActive ? propertyTestFiles(process.cwd()) : [];
const propertySweepInclude = A.map(propertySweepFiles, (file) => toPosixRelative(process.cwd(), file));
// Package-relative test file -> 1-based lines that are plain registrations. Inline files are
// absent, which keeps every test. Loaded only under an active floor so other runs never read it.
const propertySweepPlainLines = (
  files: ReadonlyArray<string>,
  Selection: typeof import("@beep/fc-runs/PropertySelection")
): Readonly<Record<string, ReadonlyArray<number>>> => {
  const sources = MutableHashMap.empty<string, O.Option<string>>();
  const read = (file: string): O.Option<string> =>
    O.getOrElse(MutableHashMap.get(sources, file), () => {
      const source = readSourceSync(file);
      MutableHashMap.set(sources, file, source);
      return source;
    });
  const resolve = (importer: string, specifier: string): ReadonlyArray<string> =>
    A.map(Selection.relativeImportCandidates(specifier), (candidate) =>
      NodePath.resolve(NodePath.dirname(importer), candidate)
    );
  return pipe(
    files,
    A.flatMap((file) =>
      Selection.moduleGraphRunsPropertiesInline({ entry: file, readSource: read, resolveCandidates: resolve })
        ? []
        : A.map(O.toArray(read(file)), (source) =>
            Tuple.make(toPosixRelative(process.cwd(), file), Selection.plainRegistrationLines(source))
          )
    ),
    R.fromEntries
  );
};
const propertySweepSelection = fcDeepSweepActive
  ? await Effect.runPromise(
      Effect.promise(() => import("@beep/fc-runs/PropertySelection")).pipe(
        Effect.map((Selection) => propertySweepPlainLines(propertySweepFiles, Selection))
      )
    )
  : {};
const propertySweepRunner = new URL("./vitest.property-runner.ts", import.meta.url);
// Fixed global coverage floors are retired (quality-gate-ratchets, 2026-07-06):
// the committed per-package baseline compare (standards/coverage.regression-baseline.jsonc,
// fail-on-drop) is the sole coverage judge. Package-local floors (e.g.
// workspace/tables' 100% proof contract) remain package decisions.
const coverageThresholds = undefined;

const escapeRegExp = Str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toAliasEntry = (find: string, replacement: string): AliasEntry => {
  const replacementUrl = new URL(replacement, projectRootDirectory);
  // DOM-backed test workers can expose this module through an HTTP URL.
  const absoluteReplacement =
    replacementUrl.protocol === "file:" ? NodeURL.fileURLToPath(replacementUrl) : replacementUrl.pathname;

  if (!Str.includes("*")(find)) {
    return {
      find: new RegExp(`^${escapeRegExp(find)}$`),
      replacement: absoluteReplacement,
    };
  }

  return {
    find: new RegExp(`^${Str.replace("\\*", "(.*)")(escapeRegExp(find))}$`),
    replacement: Str.replaceAll("*", "$1")(absoluteReplacement),
  };
};

const rootTsconfigPathEntries = Struct.entries(generatedAliasPaths);

const rootTsconfigAliases = A.flatMap(
  A.sortWith(rootTsconfigPathEntries, ([find]) => find.length, Order.flip(Order.Number)),
  ([find, replacements]: [string, readonly string[]]) =>
    A.map(replacements, (replacement) => toAliasEntry(find, replacement))
);

const config: ViteUserConfig = {
  plugins: [resolveUniformTypeScriptSourceSpecifiers(), ...(vitestDoctestActive ? [Doctest.plugin()] : [])],
  oxc: {
    // The repository's Node 24 and Bun runtimes both execute top-level await.
    // Keeping Vitest's transform at ESNext avoids Oxc lowering/parsing warnings
    // for the ESM CLI entrypoints exercised by the coverage lane.
    target: "esnext",
  },
  optimizeDeps: {
    exclude: ["bun:sqlite"],
  },
  resolve: {
    alias: rootTsconfigAliases,
    tsconfigPaths: true,
  },
  server: {
    watch: {
      ignored: ["**/.context/**"],
    },
  },
  test: {
    // Tests run globally concurrent (see `sequence.concurrent` below), so a
    // full monorepo run (e.g. a many-package PR, or push-to-main) saturates the
    // CI runner's CPU and can starve otherwise-fast tests — property-based
    // (FastCheck) and WASM-backed (PGlite) suites especially — past vitest's 5s
    // default, surfacing as flaky "Test timed out in 5000ms" failures under load
    // even though they finish in well under a second in isolation. Use a
    // generous global cap; a genuine hang still fails well within each lane's
    // job timeout, and packages may still override per-test where needed.
    // Coverage instrumentation (v8 under node) slows heavy schema decodes
    // 10x+ on small CI runners; instrumented runs get generous timeouts —
    // the coverage ratchet judges coverage, not latency.
    // Deep property sweeps (BEEP_FC_NUM_RUNS raises fast-check run counts
    // 8-20x for the property lane and nightly sweep) scale test wall time
    // the same way instrumentation does; give them the same generous cap.
    // In doctest mode the first example of a file pays the module transform; under the fleet's
    // 4-way task concurrency on a 4-vCPU runner that exceeded 30 s (C3.4 hosted round 1).
    // Persist Vite transform output and reuse it across reruns. Measured 2026-09-24 on
    // @beep/documents-use-cases: warm reruns fell from 3.0s to 1.6s under Bun and from 5.2s to 3.8s
    // under Node (transform share 55% -> 19%). The key is the absolute module id, file content,
    // plugin names, and the config file contents, so doctest mode (extra plugin) and unit mode keep
    // separate entries; a `bun.lock` change clears the whole cache.
    fsModuleCache: true,
    // Each package keeps its own cache directory. Vitest's default is one directory at the workspace
    // root, and the lockfile-change clear is an unlocked `rm -rf` of it: after a `bun.lock` change
    // the first vitest process of a turbo fan-out wiped the directory while sibling packages were
    // reading entries, failing their suites with `ENOENT ... node_modules/.vitest-cache/<key>`.
    // The vitest root is the package directory (the scripts run vitest from there).
    fsModuleCachePath: NodePath.join(process.cwd(), "node_modules", ".vitest-cache"),
    // The coverage producers pin `--maxWorkers=1` (2 for a sharded partition), so with isolation every test file
    // re-evaluates the shared module graph inside that one worker. Measured 2026-09-24 on
    // @beep/schema under the coverage topology: 69s isolated vs 13s shared, 717 tests passing either
    // way and an identical per-file coverage summary. Unit and doctest runs keep the default
    // isolation; packages whose tests mock modules, stub globals, or change the working directory
    // override this back to `true` in their own config.
    isolate: !vitestCoverageRunActive,
    testTimeout: packageTestTimeout(30_000),
    hookTimeout: vitestCoverageRunActive || fcDeepSweepActive ? 300_000 : 10_000,
    // Baseline generation/regeneration must tolerate test-less packages;
    // the ratchet compare, not vitest, decides coverage outcomes.
    // The property sweep's content-based include may be empty for a package
    // whose manifest still carries `test:property`; that is a no-op, not a red.
    passWithNoTests: !vitestDoctestActive && (vitestCoverageRunActive || fcDeepSweepActive),
    exclude: [
      "**/.context/**",
      "**/node_modules/**",
      ...(vitestDoctestActive ? ["**/test/fixtures/**", "**/*.d.ts"] : []),
    ],
    setupFiles: [setupFileUrl.protocol === "file:" ? NodeURL.fileURLToPath(setupFileUrl) : setupFileUrl.pathname],
    // V8 gates Float16Array behind --js-float16array below Node 24 and rejects
    // that flag inside NODE_OPTIONS, so the coverage lane's Node 22 runtime can
    // only receive it as real argv. Granting it to forked test workers scopes
    // the flag to test execution; a job-wide node wrapper is off the table
    // because Next.js builds copy parent execArgv into worker NODE_OPTIONS.
    // The predicate is version-based, not capability-based: vitest hands the
    // pool an explicit execArgv (overriding fork inheritance), so a flagged
    // main process with an unflagged worker list would strand the workers.
    execArgv:
      process.versions.bun === undefined && Number(Str.split(process.versions.node, ".")[0]) < 24
        ? ["--js-float16array"]
        : [],
    sequence: {
      concurrent: !vitestDoctestActive,
    },
    // One doctest owner per worker pair keeps 4 concurrent Turbo tasks inside the runner's CPU.
    ...(vitestDoctestActive ? { maxWorkers: 2 } : {}),
    // Test-level property selection (see `propertyTestMarker`). Only the deep sweep sets these keys,
    // so unit, coverage and doctest configs are unchanged.
    ...(fcDeepSweepActive && !vitestDoctestActive
      ? {
          runner:
            propertySweepRunner.protocol === "file:"
              ? NodeURL.fileURLToPath(propertySweepRunner)
              : propertySweepRunner.pathname,
          includeTaskLocation: true,
          provide: { beepPropertySweepPlainLines: propertySweepSelection },
        }
      : {}),
    include: vitestDoctestActive ? [] : fcDeepSweepActive ? [...propertySweepInclude] : ["test/**/*.test.{ts,tsx}"],
    includeSource: vitestDoctestActive ? ["src/**/*.{ts,tsx}"] : [],
    coverage: {
      provider: coverageProvider,
      include: ["src/**/*.{ts,tsx}"],
      reporter: ["text", "html", "lcov", "json-summary"],
      reportsDirectory: "coverage",
      exclude: [
        "node_modules/",
        "dist/",
        "benchmark/",
        "bundle/",
        "build/",
        "coverage/",
        "test/utils/",
        "**/test/fixtures/**",
        "**/*.d.ts",
        "**/*.config.*",
        "**/vitest.setup.*",
        "**/vitest.shared.*",
      ],
      ...(P.isUndefined(coverageThresholds) ? {} : { thresholds: coverageThresholds }),
    },
  },
};

/** Shared DOM-test defaults for browser applications with a local source alias. */
export const browserTestConfig = (moduleUrl: string): ViteUserConfig =>
  mergeConfig(config, {
    resolve: { alias: appSourceAlias(moduleUrl) },
    test: {
      environment: "jsdom",
      include: vitestDoctestActive ? [] : ["test/**/*.test.{ts,tsx}"],
    },
  });

export default config;

/**
 * The committed shape of a package's `vitest.shards.json`.
 *
 * **Details**
 *
 * `shards[i]` lists the package-relative test files hosted shard `i + 1` runs. The other fields
 * are provenance and the measured estimate behind the assignment; `beep ci partitions rebalance`
 * owns them and the sequencer reads only `shards`. The sequencer lives in this file, which every
 * Vitest Turbo task already hashes, so a scheduling change invalidates cached shard results.
 *
 * **Example** (A two-shard plan)
 *
 * ```ts
 * import type { MeasuredShardPlan } from "./vitest.shared.ts"
 * const plan: MeasuredShardPlan = { shards: [["test/a.test.ts"], ["test/b.test.ts"]] }
 * ```
 */
export interface MeasuredShardPlan {
  readonly shards: ReadonlyArray<ReadonlyArray<string>>;
}

// The one-based shard a package-relative test file is planned into.
const plannedShardIndex = (plan: MeasuredShardPlan, relativeFile: string): O.Option<number> =>
  A.findFirstIndex(plan.shards, (entries) => A.contains(entries, relativeFile)).pipe(O.map((index) => index + 1));

/**
 * Build the Vitest sequencer class that applies a committed measured shard plan.
 *
 * **Details**
 *
 * The plan applies only when `--shard=<index>/<count>` names exactly `plan.shards.length` shards,
 * so every hosted runner of the lane sees the same assignment. Files the plan does not know use
 * Vitest's own hash partition over that unknown set, so a new test still runs exactly once; files
 * the plan names but the package no longer has never enter collection. Other shard counts keep
 * Vitest's default behaviour unchanged. Sorting within a shard is untouched: the plan changes
 * scheduling only, never selection or assertions.
 *
 * **Example** (Install the sequencer)
 *
 * ```ts
 * import { makeMeasuredSequencer } from "./vitest.shared.ts"
 * import plan from "./vitest.shards.json" with { type: "json" }
 * const sequencer = makeMeasuredSequencer(plan)
 * ```
 */
export const makeMeasuredSequencer = (plan: MeasuredShardPlan): typeof BaseSequencer =>
  class MeasuredSequencer extends BaseSequencer {
    override shard(files: TestSpecification[]): Promise<TestSpecification[]> {
      const shard = this.ctx.config.shard;
      if (shard === undefined || shard.count !== plan.shards.length) return super.shard(files);
      const assignment = (file: TestSpecification) =>
        plannedShardIndex(plan, toPosixRelative(this.ctx.config.root, file.moduleId));
      return Effect.promise(() => super.shard(A.filter(files, (file) => O.isNone(assignment(file))))).pipe(
        Effect.map((unknown) =>
          A.appendAll(
            A.filter(files, (file) => O.contains(assignment(file), shard.index)),
            unknown
          )
        ),
        Effect.runPromise
      );
    }
  };
