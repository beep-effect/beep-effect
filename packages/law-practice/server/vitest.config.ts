import * as NodeURL from "node:url";
import { A, Str } from "@beep/utils";
import { pipe } from "effect/Function";
import { defineConfig, mergeConfig } from "vitest/config";
import shared, { fcDeepSweepActive, makeMeasuredSequencer, vitestDoctestActive } from "../../../vitest.shared.ts";
import shardPlan from "./vitest.shards.json" with { type: "json" };

/**
 * Test files that keep the #2511 two-worker cap.
 *
 * Unit files: the twelve that spawn real native workers through `CitationNativeSpawner.fixtures.ts`
 * with no manual, sleep or fixed clock in their fixture closure, so a cold worker load under a
 * saturated runner can consume a production deadline. Every other unit file drives its deadlines
 * through `makeCitationNativeManualClock` / `makeCitationNativeSleepClock`
 * (`test/CitationTokenizer.fixtures.ts`) or spawns nothing, so it runs at Vitest's default width.
 *
 * Integration files: all of them. The canonical replays substitute `regexDeadline` only; their
 * `extractDeadline` and `operationDeadline` run on the real clock, and PR #3007's first heavy run at
 * Vitest's default width (seven workers plus native children on the 8-vCPU runner) failed them with
 * `CitationSafetyLimitExceeded`. The integration lane therefore keeps its proven two-worker shape.
 *
 * Membership of the unit entries is mechanical (`test/vitest-shards-plan.test.ts` re-derives it).
 */
const nativeWallclockSuites = [
  "test/CitationBuiltinCleaners.test.ts",
  "test/CitationCleanerCustomCorpus.test.ts",
  "test/CitationCleanerNamedCorpus.test.ts",
  "test/CitationCleanerPipelineCoverage.test.ts",
  "test/CitationDocumentCleanerProtocols.test.ts",
  "test/CitationHtmlBytes.test.ts",
  "test/CitationHtmlCleanerStage.test.ts",
  "test/CitationHtmlNativeInput.test.ts",
  "test/CitationHtmlWorkerCorpus.test.ts",
  "test/CitationLiteralUnicodeComposition.test.ts",
  "test/CitationNativeProcess.test.ts",
  "test/CitationNativeSocket.test.ts",
  "test/integration/**/*.test.{ts,tsx}",
];

// Vitest 5.1 forwards only a fixed list of CLI options to project configs (`maxWorkers`,
// `isolate`, `passWithNoTests`, ...); `--exclude` is not among them, so the unit scripts'
// `--exclude=test/integration/**` and `--exclude=test/PartyContactSource.boundary.test.ts` would
// stop applying once the files are selected by projects. Read the CLI excludes here (the package
// scripts use the `--exclude=<glob>` form) and add them to every project so the scripts keep their
// meaning; hosted shards on PR #3007 ran integration replays inside unit shards before this.
const cliExcludes = pipe(
  process.argv,
  A.filter(Str.startsWith("--exclude=")),
  A.map(Str.slice(Str.length("--exclude=")))
);

const config = mergeConfig(
  shared,
  defineConfig({
    // Test-only aliases reach private subjects without publishing package exports.
    resolve: {
      alias: [
        {
          find: /^@beep\/law-practice-server\/internal\/(.+)$/,
          replacement: NodeURL.fileURLToPath(new URL("./src/internal/$1.ts", import.meta.url)),
        },
      ],
    },
    test: {
      // Hosted Test Unit runs `--shard=<i>/<n>` with `n` equal to the plan length; the committed
      // LPT plan keeps every law-practice shard's file time near the others (run 42554761567
      // measured sha1 shards at 1274 / 1779 / 1267 s). `beep ci partitions rebalance` refreshes it.
      sequence: { sequencer: makeMeasuredSequencer(shardPlan) },
    },
  })
);

// Doctest mode collects `src/**` through `includeSource` and the property sweep resolves its own
// include list, so both keep the single config with the package-wide cap; splitting would re-add
// `test/**` to the projects and run every doctest twice (repo-cli guards the same way).
const splitProjects = !vitestDoctestActive && !fcDeepSweepActive;

// Projects that extend the root concatenate `include`, so the root include is cleared after the
// merge (which would concatenate it back) and each project names its own files.
export default splitProjects
  ? {
      ...config,
      test: {
        ...config.test,
        include: [],
        projects: [
          {
            extends: true,
            test: {
              name: "native-wallclock",
              include: nativeWallclockSuites,
              exclude: cliExcludes,
              // Real native worker tests include cold module loading. Bound the test runner fan-out
              // so it does not consume the production deadline itself (#2511). The hosted coverage
              // producer's `--maxWorkers=1` still overrides this: Vitest applies the CLI flag to
              // every project. Each native owner still enforces its configured queue/execution limits.
              maxWorkers: 2,
              maxConcurrency: 2,
              sequence: { groupOrder: 0 },
            },
          },
          {
            extends: true,
            test: {
              name: "replay",
              include: ["test/**/*.test.{ts,tsx}"],
              exclude: [...nativeWallclockSuites, ...cliExcludes],
              // Distinct group order: projects with different worker caps cannot share one group, and
              // the wall-clock group drains before the replay group widens to the default worker count.
              sequence: { groupOrder: 1 },
            },
          },
        ],
      },
    }
  : // Doctests and the deep property sweep keep the #2511 package-wide cap.
    mergeConfig(config, { test: { maxWorkers: 2, maxConcurrency: 2 } });
