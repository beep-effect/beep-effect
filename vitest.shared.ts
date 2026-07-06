import { A, P, Str, Struct } from "@beep/utils";
import { Config, Effect, pipe } from "effect";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import ts from "typescript";
import type { ViteUserConfig } from "vitest/config";

type AliasEntry = {
  readonly find: RegExp | string;
  readonly replacement: string;
};

const projectRootDirectory = new URL("./", import.meta.url);
const rootTsconfigPath = new URL("./tsconfig.json", import.meta.url).pathname;
const coverageProvider = "v8";
const configStringOptionSync = (name: string): O.Option<string> => Effect.runSync(Config.option(Config.string(name)));
const configStringEqualsSync = (name: string, expected: string): boolean =>
  pipe(
    configStringOptionSync(name),
    O.exists((value) => value === expected)
  );
export const vitestCoverageReportOnly = configStringEqualsSync("VITEST_COVERAGE_REPORT_ONLY", "1");
const vitestCoverageRatchet = configStringEqualsSync("VITEST_COVERAGE_RATCHET", "1");
const shouldUseCoverageRatchetMode = vitestCoverageReportOnly || vitestCoverageRatchet;
const coverageThresholds = shouldUseCoverageRatchetMode
  ? undefined
  : {
      branches: 80,
      functions: 60,
      lines: 30,
      statements: 30,
    };

const escapeRegExp = Str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const readRootTsconfigPaths = (): Readonly<Record<string, readonly string[]>> => {
  const fileText = ts.sys.readFile(rootTsconfigPath);

  if (P.isUndefined(fileText)) {
    return {};
  }

  const parsed = ts.parseConfigFileTextToJson(rootTsconfigPath, fileText);

  if (
    typeof parsed.config !== "object" ||
    P.isNull(parsed.config) ||
    typeof parsed.config.compilerOptions !== "object" ||
    P.isNull(parsed.config.compilerOptions) ||
    typeof parsed.config.compilerOptions.paths !== "object" ||
    P.isNull(parsed.config.compilerOptions.paths)
  ) {
    return {};
  }

  return parsed.config.compilerOptions.paths as Record<string, readonly string[]>;
};

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

const rootTsconfigPathEntries = Struct.entries(readRootTsconfigPaths());

const rootTsconfigAliases = A.flatMap(
  A.sortWith(rootTsconfigPathEntries, ([find]) => find.length, Order.flip(Order.Number)),
  ([find, replacements]: [string, readonly string[]]) =>
    A.map(replacements, (replacement) => toAliasEntry(find, replacement))
);

const config: ViteUserConfig = {
  oxc: {
    target: "es2020",
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
    testTimeout: 30_000,
    passWithNoTests: shouldUseCoverageRatchetMode,
    exclude: ["**/.context/**", "**/node_modules/**"],
    setupFiles: [new URL("./vitest.setup.ts", import.meta.url).pathname],
    fakeTimers: {
      toFake: undefined,
    },
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
        "**/dtslint/**",
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
