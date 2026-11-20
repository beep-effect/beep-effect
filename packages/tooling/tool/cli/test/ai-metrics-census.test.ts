import { CensusBaselineFile, CensusReport } from "@beep/repo-ai-metrics/census-report";
import { censusCorpusCanaries, writeCensusCorpus } from "@beep/repo-ai-metrics/test/census-corpus";
import { CensusCommandOptions, makeCensusProgram } from "@beep/repo-cli/commands/AIMetrics/internal/Census";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

const decodeReport = S.decodeEffect(S.fromJsonString(CensusReport));
const decodeBaseline = S.decodeEffect(S.fromJsonString(CensusBaselineFile));

// The census reads a real directory tree (modification times included), so the fixture lives on disk.
const fixture = Effect.fn("CensusCommandTest.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const home = yield* fs.makeTempDirectoryScoped({ prefix: "home-HOMECANARY-" });
  const corpus = yield* writeCensusCorpus(home);
  return { home, corpus };
});

const options = (
  window: { readonly since: DateTime.Utc; readonly until: DateTime.Utc },
  overrides: Partial<CensusCommandOptions> = {}
) =>
  CensusCommandOptions.make({
    since: O.some(window.since.pipe(DateTime.formatIso)),
    until: O.some(window.until.pipe(DateTime.formatIso)),
    claudeRoot: O.none(),
    codexRoot: O.none(),
    baselineDirectory: O.none(),
    repository: "beep-effect",
    json: false,
    writeBaseline: false,
    ...overrides,
  });

// Run the program with HOME at the fixture's home directory and collect what it printed.
const runCensus = Effect.fn("CensusCommandTest.run")(function* (home: string, input: CensusCommandOptions) {
  const exit = yield* makeCensusProgram(input).pipe(
    Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromUnknown({ HOME: home })),
    Effect.exit
  );
  const logs = yield* TestConsole.logLines;
  const errors = yield* TestConsole.errorLines;
  const out = A.join(A.filter(logs, P.isString), "\n");
  const err = A.join(A.filter(errors, P.isString), "\n");
  return { exit, out, err };
});

const expectPrivate = (text: string, home: string) => {
  for (const canary of [...censusCorpusCanaries, "HOMECANARY"]) expect(Str.includes(canary)(text)).toBe(false);
  expect(Str.includes(home)(text)).toBe(false);
  expect(Str.includes("/Users/")(text)).toBe(false);
};

const sectionTitles = [
  "Corpus",
  "Totals",
  "Where tool output goes",
  "Verification output by kind",
  "How agents filter verification runs",
  "What the turns cost",
  "Line classes of verification output",
  "Chars per token",
  "Headline rows",
];

it.layer(NodeServices.layer, { excludeTestServices: true, timeout: "30 seconds" })((it) => {
  describe("ai-metrics census", () => {
    it.effect("prints the tables in the audit's order with the headline rows last (AC3, AC6)", () =>
      Effect.gen(function* () {
        const { home, corpus } = yield* fixture();
        const { exit, out } = yield* runCensus(home, options(corpus.window));
        expect(exit._tag).toBe("Success");
        const positions = A.map(sectionTitles, (title) => Str.indexOf(title)(out));
        expect(A.length(A.getSomes(positions))).toBe(A.length(sectionTitles));
        const offsets = A.getSomes(positions);
        expect(offsets).toEqual(A.sort(offsets, Order.Number));
        for (const row of [
          "verification runs piped through a filter",
          "log digs per verification run",
          "turns per verdict",
          "Chars per run",
          "ts6305-unbuilt-output",
          "tests-passed-line",
          "Log digs after a run",
          "rerun-no-edit",
          "search-read",
        ])
          expect(Str.includes(row)(out)).toBe(true);
        expect(Str.includes("Roots: Claude ~/.claude/projects, Codex ~/.codex/sessions.")(out)).toBe(true);
        expectPrivate(out, home);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("prints the encoded report with --json (AC2, AC3)", () =>
      Effect.gen(function* () {
        const { home, corpus } = yield* fixture();
        const { exit, out } = yield* runCensus(home, options(corpus.window, { json: true }));
        expect(exit._tag).toBe("Success");
        const report = yield* decodeReport(out);
        expect(report.version).toBe("agent-output-census/v1");
        expect(report.corpus.claude).toMatchObject({ _tag: "Present", sessions: 1, subagents: 1 });
        expectPrivate(out, home);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("adds one baseline file per run and refuses to overwrite it (AC2, AC5)", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { home, corpus } = yield* fixture();
        const directory = yield* fs.makeTempDirectoryScoped({ prefix: "census-runs-" });
        const input = options(corpus.window, { writeBaseline: true, baselineDirectory: O.some(directory) });
        const first = yield* runCensus(home, input);
        expect(first.exit._tag).toBe("Success");
        const files = yield* fs.readDirectory(directory);
        expect(files).toEqual(["2026-11-18T00-00-00Z--census-rules-2026-11-18.json"]);
        expect(Str.includes(`Census baseline written: ${files[0]}`)(first.err)).toBe(true);
        const text = yield* fs.readFileString(path.join(directory, files[0] ?? ""));
        const baseline = yield* decodeBaseline(text);
        expect(baseline.report.window.until).toEqual(corpus.window.until);
        expectPrivate(text, home);
        const second = yield* runCensus(home, input);
        expect(second.exit._tag).toBe("Failure");
        const after = yield* fs.readFileString(path.join(directory, files[0] ?? ""));
        expect(after).toBe(text);
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("fails on an empty corpus after printing it, and on a malformed window", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const home = yield* fs.makeTempDirectoryScoped({ prefix: "home-empty-" });
        const window = {
          since: DateTime.makeUnsafe("2026-11-11T00:00:00Z"),
          until: DateTime.makeUnsafe("2026-11-18T00:00:00Z"),
        };
        const empty = yield* runCensus(home, options(window));
        expect(empty.exit._tag).toBe("Failure");
        expect(Str.includes("absent")(empty.out)).toBe(true);
        const malformed = yield* runCensus(home, options(window, { until: O.some("not-a-time") }));
        expect(malformed.exit._tag).toBe("Failure");
        const reversed = yield* runCensus(
          home,
          options({ since: window.until, until: window.since }, { claudeRoot: O.some(home), codexRoot: O.some(home) })
        );
        expect(reversed.exit._tag).toBe("Failure");
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });
});
