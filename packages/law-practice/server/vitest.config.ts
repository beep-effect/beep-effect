import * as NodeOS from "node:os";
import * as NodeURL from "node:url";
import { A, Str } from "@beep/utils";
import { pipe } from "effect/Function";
import * as Num from "effect/Number";
import { defineConfig, mergeConfig } from "vitest/config";
import shared, { fcDeepSweepActive, vitestDoctestActive } from "../../../vitest.shared.ts";
import { LawPracticeSequencer } from "./vitest.integration.sequencer.ts";

// decision: native-wallclock-vitest-project
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

// decision: replay-project-eight-worker-cap
const replayMaxWorkers = Num.clamp(NodeOS.availableParallelism() - 1, { minimum: 1, maximum: 8 });

const cliExcludes = pipe(
  process.argv,
  A.filter(Str.startsWith("--exclude=")),
  A.map(Str.slice(Str.length("--exclude=")))
);

const privateSubjectTestAlias = {
  find: /^@beep\/law-practice-server\/internal\/(.+)$/,
  replacement: NodeURL.fileURLToPath(new URL("./src/internal/$1.ts", import.meta.url)),
};

const config = mergeConfig(
  shared,
  defineConfig({
    resolve: { alias: [privateSubjectTestAlias] },
    test: {
      sequence: { sequencer: LawPracticeSequencer },
    },
  })
);

// decision: native-wallclock-vitest-project
const splitProjects = !vitestDoctestActive && !fcDeepSweepActive;

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
              maxWorkers: replayMaxWorkers,
              sequence: { groupOrder: 1 },
            },
          },
        ],
      },
    }
  : mergeConfig(config, { test: { maxWorkers: 2, maxConcurrency: 2 } });
