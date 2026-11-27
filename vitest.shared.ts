// The include list must exist before vitest boots, and Effect's Node FileSystem
// is async, so this config-time scan uses the synchronous Node builtins. This file is one of the
// two declared directive exemptions in `beep quality tsgo-rules` (Quality.command.ts).
// @effect-diagnostics nodeBuiltinImport:skip-file

import * as NodeFS from "node:fs";
import * as NodePath from "node:path";
import * as NodeURL from "node:url";
import { parseFcSeed } from "@beep/fc-runs/FastCheckRuns";
import { A, P, Str, Struct } from "@beep/utils";
import * as Doctest from "@effect/doctest/Plugin";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Tuple from "effect/Tuple";
import { configDefaults, mergeConfig } from "vitest/config";
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
const coverageProvider = P.isUndefined(process.versions.bun) ? "v8" : "istanbul";

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

const bootSnapshotEnvProvider = ConfigProvider.fromEnv();
const readEnv = (name: string): O.Option<string> =>
  Config.String(name).pipe(
    Config.option,
    Effect.provideService(ConfigProvider.ConfigProvider, bootSnapshotEnvProvider),
    Effect.runSync
  );

const configStringEqualsSync = (name: string, expected: string): boolean =>
  O.exists(readEnv(name), (value) => value === expected);
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
/**
 * Whether this vitest process is a coverage run.
 *
 * **Details**
 *
 * True under `VITEST_COVERAGE_REPORT_ONLY=1`, `VITEST_COVERAGE_RATCHET=1` or a `--coverage`
 * argument. The process's own argv is authoritative because environment flags do not survive
 * every spawn chain (root script, turbo, package script, vitest). A package config reads this
 * flag to keep the coverage-aware timeout and isolation policy instead of clamping it back to a
 * coverage-unaware constant.
 *
 * **Gotchas**
 *
 * A test that stubs a variable after importing this module (`vi.stubEnv`) changes none of the
 * flags it exports.
 *
 * **Example** (Keep a package timeout coverage-aware)
 *
 * ```ts
 * import { vitestCoverageRunActive } from "./vitest.shared.ts"
 * const hookTimeout = vitestCoverageRunActive ? 300_000 : 10_000
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const vitestCoverageRunActive =
  vitestCoverageReportOnly ||
  configStringEqualsSync("VITEST_COVERAGE_RATCHET", "1") ||
  process.argv.includes("--coverage");

const parsedFcNumRuns = readEnv("BEEP_FC_NUM_RUNS").pipe(
  O.map(Number),
  O.getOrElse(() => 0)
);
/**
 * Whether this run is a deep property sweep.
 *
 * **Details**
 *
 * True when `BEEP_FC_NUM_RUNS` holds a positive integer run floor. The property lane and the
 * nightly sweep export it before vitest starts.
 *
 * **Example** (Skip a slow setup outside the sweep)
 *
 * ```ts
 * import { fcDeepSweepActive } from "./vitest.shared.ts"
 * const retry = fcDeepSweepActive ? 0 : 1
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const fcDeepSweepActive = Number.isInteger(parsedFcNumRuns) && parsedFcNumRuns > 0;

const COVERAGE_PROPERTY_SEED = 20260708;
const parsedFcSeed = readEnv("BEEP_FC_SEED").pipe(O.getOrUndefined, parseFcSeed);
const propertySeedEnvironment = pipe(
  O.orElse(parsedFcSeed, () => (vitestCoverageRunActive ? O.some(COVERAGE_PROPERTY_SEED) : O.none<number>())),
  O.match({ onNone: () => ({}), onSome: (seed) => ({ BEEP_FC_SEED: `${seed}` }) })
);

const vitestDoctestTestTimeoutMs = 120_000;

/**
 * Resolve a package's per-test timeout without losing the shared doctest and instrumentation
 * ceilings. Package configs merge after this one, so a literal `testTimeout` there would clamp
 * doctest mode back to the focused value.
 *
 * **Details**
 *
 * Doctest mode gets 120 s, because the first example of a file pays the module transform, and a
 * doctest guard asserts that value per owner. Coverage runs and deep property sweeps get 300 s:
 * instrumentation and raised run counts scale wall time, and the coverage ratchet judges
 * coverage, not latency. Any other run gets `focusedMs`; the shared config passes 30 s because
 * tests run globally concurrent and a saturated runner pushes fast suites past vitest's 5 s
 * default.
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

const propertySelectionModule = fcDeepSweepActive
  ? O.some(await Effect.runPromise(Effect.promise(() => import("@beep/fc-runs/PropertySelection"))))
  : O.none<typeof import("@beep/fc-runs/PropertySelection")>();
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
const propertyTestFiles = (packageRoot: string, marker: RegExp): ReadonlyArray<string> =>
  pipe(
    listTestFiles(NodePath.join(packageRoot, "test")),
    A.filter((file) => O.exists(readSourceSync(file), (source) => marker.test(source))),
    A.sort(Order.String)
  );
const propertySweepFiles = O.match(propertySelectionModule, {
  onNone: A.empty<string>,
  onSome: (selection) => propertyTestFiles(process.cwd(), selection.propertyTestMarker),
});
const propertySweepInclude = A.map(propertySweepFiles, (file) => toPosixRelative(process.cwd(), file));
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
const propertySweepSelection = O.match(propertySelectionModule, {
  onNone: (): Readonly<Record<string, ReadonlyArray<number>>> => ({}),
  onSome: (selection) => propertySweepPlainLines(propertySweepFiles, selection),
});
const propertySweepRunner = new URL("./vitest.property-runner.ts", import.meta.url);
const propertySweepReporter = new URL("./vitest.property-reporter.ts", import.meta.url);
const modulePath = (url: URL): string => (url.protocol === "file:" ? NodeURL.fileURLToPath(url) : url.pathname);
const exactPropertySweepInclude = (): Plugin => ({
  name: "beep:exact-property-sweep-include",
  config(userConfig: ViteUserConfig) {
    if (userConfig.test !== undefined) userConfig.test.include = [...propertySweepInclude];
  },
});
const coverageThresholds = undefined;

const escapeRegExp = Str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toAliasEntry = (find: string, replacement: string): AliasEntry => {
  const replacementUrl = new URL(replacement, projectRootDirectory);
  const filePathOrHttpUrlPathname =
    replacementUrl.protocol === "file:" ? NodeURL.fileURLToPath(replacementUrl) : replacementUrl.pathname;

  if (!Str.includes("*")(find)) {
    return {
      find: new RegExp(`^${escapeRegExp(find)}$`),
      replacement: filePathOrHttpUrlPathname,
    };
  }

  return {
    find: new RegExp(`^${Str.replace("\\*", "(.*)")(escapeRegExp(find))}$`),
    replacement: Str.replaceAll("*", "$1")(filePathOrHttpUrlPathname),
  };
};

const rootTsconfigPathEntries = Struct.entries(generatedAliasPaths);

const rootTsconfigAliases = A.flatMap(
  A.sortWith(rootTsconfigPathEntries, ([find]) => find.length, Order.flip(Order.Number)),
  ([find, replacements]: [string, readonly string[]]) =>
    A.map(replacements, (replacement) => toAliasEntry(find, replacement))
);

const GATE_REPORTER = "@beep/repo-gate-vitest/Vitest.reporter";
const gateReporterActive = !vitestDoctestActive && !fcDeepSweepActive;

/**
 * The shared Vitest config every package config merges.
 *
 * **Details**
 *
 * Vitest runs from the package directory. Relative `.ts` specifiers also resolve `.tsx` sources,
 * because Vite reads an explicit suffix as an exact filename. Coverage uses V8 under Node and
 * Istanbul under Bun, where V8 inspector coverage is unsupported and can falsely cover untouched
 * branches. No global coverage thresholds are set: the per-package baseline compare in
 * `standards/coverage.regression-baseline.jsonc` judges coverage, and a package-local floor is a
 * package decision. When the run pins a property seed (`BEEP_FC_SEED`, else a fixed seed for a
 * coverage run so instrumentation compares between runs), `test.env` hands it to the workers,
 * whose argv does not carry `--coverage`; vitest.setup.ts applies it.
 * The Oxc transform targets ESNext: the Node 24 and Bun runtimes both run top-level await, and a
 * lower target makes Oxc warn on the coverage lane's ESM CLI entrypoints.
 *
 * Reporters are Vitest's defaults plus the gate adapter, registered by package specifier, which
 * writes the package's `test` record under `.beep/gates/test/`. Doctest and deep-sweep runs add
 * no adapter, so they never overwrite that record, and a command-line `--reporter` (the coverage
 * planner) replaces the whole list. Coverage runs and deep sweeps pass with no tests: a test-less
 * package or an empty sweep selection is a no-op there, and the ratchet decides coverage.
 *
 * `isolate` is false under coverage, where the producers pin one or two workers and isolation
 * would re-evaluate the shared module graph for every file; unit and doctest runs keep the
 * default isolation. A package whose tests mock modules, stub globals or change the working
 * directory sets `isolate: true` in its own config. Doctest mode runs two workers, so one doctest
 * owner per worker pair keeps four concurrent Turbo tasks inside the runner's CPUs.
 *
 * **Gotchas**
 *
 * `fsModuleCachePath` is per package. The cache clear after a `bun.lock` change is an unlocked
 * `rm -rf`, so one shared directory let the first process of a turbo fan-out wipe entries that
 * sibling packages were reading (`ENOENT` failures). On Node below 24 the forked workers receive
 * `--js-float16array` as real argv, because V8 rejects that flag inside `NODE_OPTIONS`; a package
 * config that sets its own `execArgv` must keep it. A job-wide node wrapper cannot carry the flag
 * instead, because Next.js builds copy the parent execArgv into worker `NODE_OPTIONS`.
 * Under a deep property sweep the merged `include` is set once more to the selected files, so a
 * package config's own `include` (merged by concatenation) does not add its files back.
 *
 * **Example** (Opt a package back into isolation)
 *
 * ```ts
 * import shared from "./vitest.shared.ts"
 * import { mergeConfig } from "vitest/config"
 * export default mergeConfig(shared, { test: { isolate: true } })
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
const config: ViteUserConfig = {
  plugins: [
    resolveUniformTypeScriptSourceSpecifiers(),
    ...(vitestDoctestActive ? [Doctest.plugin()] : []),
    ...(fcDeepSweepActive && !vitestDoctestActive ? [exactPropertySweepInclude()] : []),
  ],
  oxc: {
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
    ...(gateReporterActive ? { reporters: [...configDefaults.reporters, GATE_REPORTER] } : {}),
    fsModuleCache: true,
    fsModuleCachePath: NodePath.join(process.cwd(), "node_modules", ".vitest-cache"),
    isolate: !vitestCoverageRunActive,
    testTimeout: packageTestTimeout(30_000),
    hookTimeout: vitestCoverageRunActive || fcDeepSweepActive ? 300_000 : 10_000,
    passWithNoTests: !vitestDoctestActive && (vitestCoverageRunActive || fcDeepSweepActive),
    exclude: [
      "**/.context/**",
      "**/node_modules/**",
      ...(vitestDoctestActive ? ["**/test/fixtures/**", "**/*.d.ts"] : []),
    ],
    setupFiles: [setupFileUrl.protocol === "file:" ? NodeURL.fileURLToPath(setupFileUrl) : setupFileUrl.pathname],
    // The predicate is version-based, not capability-based: vitest hands the
    // pool an explicit execArgv (overriding fork inheritance), so a flagged
    // main process with an unflagged worker list would strand the workers.
    execArgv:
      process.versions.bun === undefined && Number(Str.split(process.versions.node, ".")[0]) < 24
        ? ["--js-float16array"]
        : [],
    env: propertySeedEnvironment,
    sequence: {
      concurrent: !vitestDoctestActive,
    },
    ...(vitestDoctestActive ? { maxWorkers: 2 } : {}),
    ...(fcDeepSweepActive && !vitestDoctestActive
      ? {
          runner: modulePath(propertySweepRunner),
          reporters: [...configDefaults.reporters, modulePath(propertySweepReporter)],
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
