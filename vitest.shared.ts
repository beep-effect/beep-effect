import { A, P, Str, Struct } from "@beep/utils";
import { Config, Effect, pipe } from "effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import generatedAliasPaths from "./vitest.aliases.generated.json" with { type: "json" };
import type { Plugin } from "vite";
import type { ViteUserConfig } from "vitest/config";

type AliasEntry = {
  readonly find: RegExp | string;
  readonly replacement: string;
};

const projectRootDirectory = new URL("./", import.meta.url);
const coverageProvider = "v8";

// Vite treats an explicit `.ts` suffix as an exact filename, while the repository
// convention intentionally uses `.ts` specifiers for both `.ts` and `.tsx` sources.
const resolveUniformTypeScriptSourceSpecifiers = (): Plugin => ({
  name: "beep:resolve-uniform-typescript-source-specifiers",
  enforce: "pre",
  resolveId(source, importer, options) {
    if (importer === undefined || !source.startsWith(".") || !source.endsWith(".ts")) {
      return null;
    }

    return this.resolve(source, importer, { ...options, skipSelf: true }).then((exactSource) =>
      exactSource === null
        ? this.resolve(source.replace(/\.ts$/, ".tsx"), importer, { ...options, skipSelf: true })
        : exactSource
    );
  },
});

const configStringOptionSync = (name: string): O.Option<string> => Effect.runSync(Config.option(Config.string(name)));
const configStringEqualsSync = (name: string, expected: string): boolean =>
  pipe(
    configStringOptionSync(name),
    O.exists((value) => value === expected)
  );
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
const parsedFcNumRuns = pipe(
  Effect.runSync(Config.option(Config.string("BEEP_FC_NUM_RUNS"))),
  O.map(Number),
  O.getOrElse(() => 0)
);
export const fcDeepSweepActive = Number.isInteger(parsedFcNumRuns) && parsedFcNumRuns > 0;
// Fixed global coverage floors are retired (quality-gate-ratchets, 2026-07-06):
// the committed per-package baseline compare (standards/coverage.regression-baseline.jsonc,
// fail-on-drop) is the sole coverage judge. Package-local floors (e.g.
// workspace/tables' 100% proof contract) remain package decisions.
const coverageThresholds = undefined;

const escapeRegExp = Str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const toAliasEntry = (find: string, replacement: string): AliasEntry => {
  const absoluteReplacement = new URL(replacement, projectRootDirectory).pathname;

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
  plugins: [resolveUniformTypeScriptSourceSpecifiers()],
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
    testTimeout: vitestCoverageRunActive || fcDeepSweepActive ? 300_000 : 30_000,
    hookTimeout: vitestCoverageRunActive || fcDeepSweepActive ? 300_000 : 10_000,
    // Baseline generation/regeneration must tolerate test-less packages;
    // the ratchet compare, not vitest, decides coverage outcomes.
    passWithNoTests: vitestCoverageRunActive,
    exclude: ["**/.context/**", "**/node_modules/**"],
    setupFiles: [new URL("./vitest.setup.ts", import.meta.url).pathname],
    sequence: {
      concurrent: true,
    },
    include: ["test/**/*.test.{ts,tsx}"],
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

export default config;
