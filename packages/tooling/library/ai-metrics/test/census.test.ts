import { Census, CensusError, CensusRequest } from "@beep/repo-ai-metrics/census";
import { CensusReport, CensusWindow } from "@beep/repo-ai-metrics/census-report";
import { censusCorpusCanaries, censusCorpusTexts, writeCensusCorpus } from "@beep/repo-ai-metrics/test/census-corpus";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import { describe, expect } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { ToolOutputClass, TurnClass } from "@beep/repo-ai-metrics/census-rules";

const layer = Layer.provideMerge(Census.layer, NodeServices.layer);
const encodeReport = S.encodeEffect(S.fromJsonString(CensusReport));
const decodeReport = S.decodeEffect(S.fromJsonString(CensusReport));
const texts = censusCorpusTexts;
const length = Str.length;

const census = Effect.fn("CensusTest.census")(function* (fixture: {
  readonly claudeRoot: string;
  readonly codexRoot: string;
  readonly window: CensusWindow;
}) {
  const service = yield* Census;
  return yield* service.report(CensusRequest.make({ ...fixture, repository: "beep-effect" }));
});

const corpus = Effect.fn("CensusTest.corpus")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const home = yield* fs.makeTempDirectoryScoped({ prefix: "home-HOMECANARY-" });
  return { home, fixture: yield* writeCensusCorpus(home) };
});

const row = (report: CensusReport, toolOutputClass: ToolOutputClass) =>
  pipe(
    A.findFirst(report.toolOutput.rows, (entry) => entry.toolOutputClass === toolOutputClass),
    O.getOrThrow
  );
const turn = (report: CensusReport, turnClass: TurnClass) =>
  pipe(
    A.findFirst(report.turns.rows, (entry) => entry.turnClass === turnClass),
    O.getOrThrow
  );

const gate = length(texts.gateTable);
const help = length(texts.help);
const persisted = length(texts.persisted);
const calibrationPoint = (chars: number, tokens: number) => ({ chars, tokens });
const lowerCorpusCalibrationPoint = calibrationPoint(4000, 1990);
const upperCorpusCalibrationPoint = calibrationPoint(6000, 3000);
const slope =
  (upperCorpusCalibrationPoint.tokens - lowerCorpusCalibrationPoint.tokens) /
  (upperCorpusCalibrationPoint.chars - lowerCorpusCalibrationPoint.chars);
const corpusSessionM1ToM5ContextTokens = 5115;
const corpusSubagentS1ToS7ContextTokens = 5021;
const contextTokens = corpusSessionM1ToM5ContextTokens + corpusSubagentS1ToS7ContextTokens;

it.layer(layer, { excludeTestServices: true, timeout: "30 seconds" })((it) => {
  describe("census over the synthetic corpus", () => {
    it.effect("counts the corpus, totals and compaction boundaries", () =>
      Effect.gen(function* () {
        const { fixture } = yield* corpus();
        const report = yield* census(fixture);
        expect(report.corpus.claude).toEqual({
          _tag: "Present",
          filesScanned: 2,
          contextsActive: 2,
          sessions: 1,
          subagents: 1,
          compactionBoundaries: 1,
          oversizedLines: 0,
          oversizedBytes: 0,
          unreadableFiles: 0,
        });
        expect(report.corpus.codex).toEqual({
          _tag: "Present",
          filesScanned: 3,
          sessions: 1,
          oversizedLines: 0,
          oversizedBytes: 0,
          unreadableFiles: 0,
        });
        const sessions = O.getOrThrow(report.totals.claudeSessions);
        expect([
          sessions.apiCalls,
          sessions.inputTokens,
          sessions.cacheCreationTokens,
          sessions.cacheReadTokens,
        ]).toEqual([5, 365, 1000, 3750]);
        expect([
          sessions.outputTokens,
          sessions.contextTokens,
          sessions.toolOutputChars,
          sessions.verificationChars,
        ]).toEqual([38, 5115, 4559, 4057]);
        const subagents = O.getOrThrow(report.totals.claudeSubagents);
        expect([subagents.apiCalls, subagents.contextTokens, subagents.outputTokens]).toEqual([7, 5021, 1]);
        expect(subagents.toolOutputChars).toBe(6000 + gate + help + persisted + 2 + 11);
        expect(subagents.verificationChars).toBe(gate + help + 2);
        const codex = O.getOrThrow(report.totals.codex);
        expect([codex.inputTokens, codex.cachedInputTokens, codex.outputTokens]).toEqual([1000, 800, 50]);
        expect(codex.toolOutputChars).toBe(length(texts.codexTest) + 5 + 2 + 5 + 3 + 6 + 1 + 0 + 14);
        expect(codex.verificationChars).toBe(length(texts.codexTest));
        expect(report.repository).toBe("reference");
      })
    );

    it.effect("attributes tool output and carried cost across compaction", () =>
      Effect.gen(function* () {
        const { fixture } = yield* corpus();
        const report = yield* census(fixture);
        const check = row(report, "check").claude;
        expect([check.results, check.chars, check.carriedCharTurns, check.filteredResults]).toEqual([3, 4057, 8000, 2]);
        expect(O.getOrThrow(check.shareOfContextRead)).toBeCloseTo((8000 * slope) / contextTokens, 10);
        expect(row(report, "read-tool").claude.carriedCharTurns).toBe(500);
        expect(row(report, "other-tool").claude.carriedCharTurns).toBe(2);
        expect(row(report, "search-read").claude).toMatchObject({ results: 2, chars: 6011, carriedCharTurns: 36_000 });
        expect(row(report, "yeet").claude.carriedCharTurns).toBe(5 * gate + 4 * help);
        expect(row(report, "persisted-reread").claude).toMatchObject({ chars: persisted, persistedResults: 1 });
        expect(row(report, "ci-logs").claude).toMatchObject({ chars: 2, carriedCharTurns: 2, filteredResults: 1 });
        expect(row(report, "test").codex).toMatchObject({ results: 1, filteredResults: 1 });
        expect(row(report, "git").codex.chars).toBe(5);
        expect(row(report, "other-shell").codex).toMatchObject({ results: 4, chars: 5 + 1 + 0 + 14 });
        expect(row(report, "search-read").codex.chars).toBe(3);
        expect(row(report, "other-tool").codex.chars).toBe(2);
        expect(row(report, "unmatched-result").codex.chars).toBe(6);
        assertNone(row(report, "check").codex.shareOfContextRead);
        const all = report.toolOutput.all.claude;
        expect(all.chars).toBe(4559 + 6000 + gate + help + persisted + 13);
        expect(report.toolOutput.verification.claude.chars).toBe(4057 + gate + help + 2);
        const yeet = A.filter(report.yeetSubcommands, (entry) => entry.results > 0);
        expect(yeet).toEqual([
          expect.objectContaining({ subcommand: "open", results: 1, chars: help }),
          expect.objectContaining({ subcommand: "gate-table", results: 1, chars: gate }),
        ]);
        const byKind = A.filter(report.verificationByKind, (entry) => entry.claudeChars + entry.codexChars > 0);
        expect(A.map(byKind, (entry) => entry.kind)).toEqual(["yeet", "test", "check", "ci-logs"]);
      })
    );

    it.effect("fits chars per token from single large results", () =>
      Effect.gen(function* () {
        const { fixture } = yield* corpus();
        const { calibration } = yield* census(fixture);
        expect(calibration.samples).toBe(2);
        expect(O.getOrThrow(calibration.slope)).toBeCloseTo(slope, 12);
        expect(O.getOrThrow(calibration.intercept)).toBeCloseTo(-30, 9);
        expect(O.getOrThrow(calibration.charsPerToken)).toBeCloseTo(1 / slope, 12);
        expect(A.map(calibration.bins, (bin) => [bin.bin, bin.samples, O.getOrNull(bin.median)])).toEqual([
          ["3k-6k", 1, 4000 / 1990],
          ["6k-12k", 1, 2],
          ["12k-20k", 0, null],
          ["20k-plus", 0, null],
        ]);
      })
    );

    it.effect("classifies turns, re-runs and log digs", () =>
      Effect.gen(function* () {
        const { fixture } = yield* corpus();
        const report = yield* census(fixture);
        const { turns } = report;
        expect([turns.turns, turns.contextTokens]).toEqual([12, contextTokens]);
        expect(turn(report, "run-verification")).toMatchObject({ turns: 2, contextTokens: 300, resultChars: 4006 });
        expect(turn(report, "rerun-no-edit")).toMatchObject({ turns: 1, contextTokens: 2610, resultChars: 51 });
        expect(turn(report, "dig-captured-log")).toMatchObject({
          turns: 3,
          contextTokens: 2104,
          resultChars: 500 + persisted + 11,
        });
        expect(turn(report, "fetch-ci-log")).toMatchObject({ turns: 1, contextTokens: 2, resultChars: 2 });
        expect(turn(report, "edit")).toMatchObject({ turns: 1, contextTokens: 105 });
        expect(turn(report, "other-tool")).toMatchObject({ turns: 3, contextTokens: 5010 });
        expect(turn(report, "no-tool")).toMatchObject({ turns: 1, contextTokens: 5 });
        expect(O.getOrThrow(turn(report, "edit").shareOfTurns)).toBeCloseTo(1 / 12, 12);
        expect([turns.verificationRuns, turns.redirectedRuns, turns.rerunsNoEdit, turns.rerunsSameCommand]).toEqual([
          3, 1, 1, 0,
        ]);
        expect([turns.logDigs, turns.ciLogFetches]).toEqual([3, 1]);
        expect(turns.digFollowUp).toMatchObject({ runs: 3, zero: 2, one: 1, two: 0, threeOrMore: 0, max: 1 });
        expect(O.getOrThrow(report.headline.logDigsPerRun)).toBeCloseTo(1 / 3, 12);
        expect(O.getOrThrow(report.headline.turnsPerVerdict)).toBe((2 + 1 + 3 + 1) / 2);
      })
    );

    it.effect("measures filter habits, line classes and offenders", () =>
      Effect.gen(function* () {
        const { fixture } = yield* corpus();
        const report = yield* census(fixture);
        const runsThenTailHeadGrepUnfilteredRedirect = (kind: string) =>
          pipe(
            A.findFirst(report.filterHabits.rows, (entry) => entry.kind === kind),
            O.map((entry) => [entry.runs, ...A.map(entry.habits, (habit) => habit.runs)]),
            O.getOrThrow
          );
        expect(runsThenTailHeadGrepUnfilteredRedirect("check")).toEqual([3, 1, 0, 0, 1, 1]);
        expect(runsThenTailHeadGrepUnfilteredRedirect("yeet")).toEqual([2, 0, 0, 0, 2, 0]);
        expect(runsThenTailHeadGrepUnfilteredRedirect("test")).toEqual([1, 0, 0, 1, 0, 0]);
        expect(runsThenTailHeadGrepUnfilteredRedirect("ci-logs")).toEqual([1, 0, 0, 0, 0, 1]);
        expect(report.filterHabits.allRuns).toBe(7);
        expect(O.getOrThrow(report.headline.filteredRunShare)).toBeCloseTo(4 / 7, 12);
        const check = pipe(
          A.findFirst(report.lineClasses.byKind, (entry) => entry.kind === "check"),
          O.getOrThrow
        );
        const chars = (lineClass: string) =>
          pipe(
            A.findFirst(check.classes, (entry) => entry.lineClass === lineClass),
            O.map((entry) => entry.chars),
            O.getOrThrow
          );
        const unbuilt = length(texts.unbuilt) + 1;
        expect(check.totalChars).toBe(4057);
        expect([chars("signal"), chars("other"), chars("runner-chrome")]).toEqual([unbuilt + 7, 4001 - unbuilt, 52]);
        const offenders = A.map(report.lineClasses.offenders, (entry) => [entry.offender, entry.lines, entry.chars]);
        expect(offenders).toEqual([
          ["ts6305-unbuilt-output", 1, unbuilt],
          ["gate-table-repeat", 1, length(texts.gateRow) + 1],
          ["json-envelope", 1, length(texts.envelope) + 1],
          ["help-global-flags", 3, A.reduce(texts.helpFlags, 0, (total, line) => total + length(line) + 1)],
          ["tests-passed-line", 3, 52 + length("Tests  1 passed") + 1],
        ]);
        expect(report.lineClasses.totalChars).toBe(4057 + gate + help + 2 + length(texts.codexTest));
        const runSizes = A.filter(report.headline.verificationCharsPerRun, (entry) => entry.runs > 0);
        expect(A.map(runSizes, (entry) => [entry.kind, entry.runs, O.getOrThrow(entry.charsPerRun)])).toEqual([
          ["yeet", 2, (gate + help) / 2],
          ["test", 1, length(texts.codexTest)],
          ["check", 3, 4057 / 3],
          ["ci-logs", 1, 2],
        ]);
      })
    );

    it.effect("never carries a canary, the home directory or a macOS home path (AC2)", () =>
      Effect.gen(function* () {
        const { home, fixture } = yield* corpus();
        const report = yield* census(fixture);
        const json = yield* encodeReport(report);
        for (const needle of [...censusCorpusCanaries, "HOMECANARY", home, "/Users/"]) {
          expect(Str.includes(needle)(json)).toBe(false);
        }
        const decoded = yield* decodeReport(json);
        expect(decoded).toEqual(report);
      })
    );
  });

  describe("census corpus edges", () => {
    it.effect("reports absent roots as absent and counts nothing", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const home = yield* fs.makeTempDirectoryScoped();
        const report = yield* census({
          claudeRoot: `${home}/missing-claude`,
          codexRoot: `${home}/missing-codex`,
          window: CensusWindow.make({
            since: DateTime.makeUnsafe("2026-11-11T00:00:00Z"),
            until: DateTime.makeUnsafe("2026-11-18T00:00:00Z"),
          }),
        });
        expect(report.corpus).toEqual({ claude: { _tag: "Absent" }, codex: { _tag: "Absent" } });
        assertNone(report.totals.claudeSessions);
        assertNone(report.totals.codex);
        assertNone(report.calibration.slope);
        assertNone(report.headline.turnsPerVerdict);
      })
    );

    it.effect("refuses a window that ends before it starts", () =>
      Effect.gen(function* () {
        const error = yield* census({
          claudeRoot: "/nonexistent",
          codexRoot: "/nonexistent",
          window: CensusWindow.make({
            since: DateTime.makeUnsafe("2026-11-18T00:00:00Z"),
            until: DateTime.makeUnsafe("2026-11-11T00:00:00Z"),
          }),
        }).pipe(Effect.flip);
        expect(error).toEqual(CensusError.make({ reason: "invalid-window" }));
        expect(error.message).toBe("Census window start is after its end.");
      })
    );

    it.effect("fails on a root that exists but cannot be listed, and counts unreadable files", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const { fixture } = yield* corpus();
        const session = path.join(
          fixture.claudeRoot,
          "-home-alice-PATHCANARY-beep-effect",
          "session-0f1e-SESSIONCANARY.jsonl"
        );
        const rollout = path.join(fixture.codexRoot, "2026", "11", "12", "rollout-CODEXCANARY.jsonl");
        yield* fs.chmod(session, 0o000);
        yield* fs.chmod(rollout, 0o000);
        const report = yield* census(fixture);
        expect(report.corpus.claude).toMatchObject({ filesScanned: 1, unreadableFiles: 1 });
        expect(report.corpus.codex).toMatchObject({ filesScanned: 2, sessions: 0, unreadableFiles: 1 });
        yield* fs.chmod(fixture.codexRoot, 0o000);
        const error = yield* census(fixture).pipe(Effect.flip);
        yield* fs.chmod(fixture.codexRoot, 0o700);
        expect(error.reason).toBe("unreadable-root");
        yield* fs.chmod(fixture.claudeRoot, 0o000);
        const claudeError = yield* census(fixture).pipe(Effect.flip);
        yield* fs.chmod(fixture.claudeRoot, 0o700);
        expect(claudeError.reason).toBe("unreadable-root");
        expect(error.message).toBe("Census could not read a harness root that exists, or the root is not a directory.");
      })
    );

    it.effect("counts a message once, keeps in-window usage, and stages each file", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const home = yield* fs.makeTempDirectoryScoped();
        const claudeRoot = path.join(home, "projects");
        const codexRoot = path.join(home, "codex");
        const project = path.join(claudeRoot, "staged-beep-effect");
        yield* fs.makeDirectory(project, { recursive: true });
        yield* fs.makeDirectory(codexRoot, { recursive: true });
        const at = (time: string) => `"timestamp":"2026-11-12T${time}Z"`;
        const openingCallAndResult = [
          `{"type":"assistant",${at("10:00:00")},"message":{"id":"a0","usage":{"input_tokens":3},"content":[{"type":"tool_use","id":"e1","name":"Bash","input":{"command":"ls"}}]}}`,
          `{"type":"user",${at("10:00:01")},"message":{"content":[{"type":"tool_result","tool_use_id":"e1","content":"four"}]}}`,
        ];
        const oneApiCallInTwoRecordsFirstWithoutUsage = [
          `{"type":"assistant",${at("10:00:02")},"message":{"id":"a1","content":[]}}`,
          `{"type":"assistant",${at("10:00:03")},"message":{"id":"a1","usage":{"input_tokens":5},"content":[]}}`,
        ];
        const largeResultSmallerContext = [
          `{"type":"assistant",${at("10:00:04")},"message":{"id":"a2","usage":{"input_tokens":7},"content":[{"type":"tool_use","id":"e2","name":"Bash","input":{"command":"true"}}]}}`,
          `{"type":"user",${at("10:00:05")},"message":{"content":[{"type":"tool_result","tool_use_id":"e2","content":"${Str.repeat(3001)("x")}"}]}}`,
          `{"type":"assistant",${at("10:00:06")},"message":{"id":"a3","usage":{"input_tokens":1},"content":[]}}`,
        ];
        const nonTextUserContent = `{"type":"user",${at("10:00:07")},"message":{"content":{"other":1}}}`;
        const callWithoutUsage = `{"type":"assistant",${at("10:00:08")},"message":{"id":"a4","content":[]}}`;
        const secondRecordUsage = [
          `{"type":"assistant",${at("10:00:08")},"message":{"id":"b0","usage":{"input_tokens":10},"content":[{"type":"tool_use","id":"e3","name":"Bash","input":{"command":"true"}}]}}`,
          `{"type":"user",${at("10:00:08")},"message":{"content":[{"type":"tool_result","tool_use_id":"e3","content":"${Str.repeat(3001)("y")}"}]}}`,
          `{"type":"assistant",${at("10:00:08")},"message":{"id":"b1","content":[]}}`,
          `{"type":"assistant",${at("10:00:08")},"message":{"id":"b1","usage":{"input_tokens":2000},"content":[]}}`,
        ];
        const twoBoundariesThenSummaryAreTwoCompactions = [
          `{"type":"system","subtype":"compact_boundary",${at("10:00:09")}}`,
          `{"type":"system","subtype":"compact_boundary",${at("10:00:10")}}`,
          `{"type":"user","isCompactSummary":true,${at("10:00:11")},"message":{"content":"summary"}}`,
        ];
        const sameCallAfterWindow =
          '{"type":"assistant","timestamp":"2026-11-19T00:00:00Z","message":{"id":"a1","usage":{"input_tokens":900},"content":[{"type":"tool_use","id":"late","name":"Bash","input":{"command":"bun run check"}}]}}';
        const session = [
          ...openingCallAndResult,
          ...oneApiCallInTwoRecordsFirstWithoutUsage,
          ...largeResultSmallerContext,
          nonTextUserContent,
          callWithoutUsage,
          ...secondRecordUsage,
          ...twoBoundariesThenSummaryAreTwoCompactions,
          sameCallAfterWindow,
        ];
        const afterWindowOnly = [
          '{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"none","content":"leak"}]}}',
          '{"type":"assistant","timestamp":"2026-11-19T00:00:00Z","message":{"id":"x","usage":{"input_tokens":1},"content":[]}}',
        ];
        yield* fs.writeFileString(path.join(project, "a.jsonl"), A.join(session, "\n"));
        yield* fs.writeFileString(path.join(project, "b.jsonl"), A.join(afterWindowOnly, "\n"));
        const nonTranscriptFile = path.join(project, "notes.txt");
        const uninspectableDanglingTranscript = path.join(project, "dangling.jsonl");
        const unlistableDirectory = path.join(project, "locked");
        const fileNamedLikeRepositoryIsNoProjectDirectory = path.join(claudeRoot, "beep-effect-notes.txt");
        yield* fs.writeFileString(nonTranscriptFile, "not a transcript");
        yield* fs.writeFileString(fileNamedLikeRepositoryIsNoProjectDirectory, "not a project");
        yield* fs.symlink(path.join(project, "missing-target"), uninspectableDanglingTranscript);
        yield* fs.makeDirectory(unlistableDirectory);
        yield* fs.chmod(unlistableDirectory, 0o000);
        const window = CensusWindow.make({
          since: DateTime.makeUnsafe("2026-11-11T00:00:00Z"),
          until: DateTime.makeUnsafe("2026-11-18T00:00:00Z"),
        });
        const service = yield* Census;
        const report = yield* service.report(
          CensusRequest.make({ claudeRoot, codexRoot, repository: "beep-effect", window })
        );
        yield* fs.chmod(unlistableDirectory, 0o700);
        const sessions = O.getOrThrow(report.totals.claudeSessions);
        expect(
          [sessions.apiCalls, sessions.inputTokens],
          "a call without usage on any record is still one API call"
        ).toEqual([7, 2026]);
        expect(
          report.corpus.claude,
          "every boundary counts, and a summary only when it does not follow another marker"
        ).toMatchObject({ compactionBoundaries: 2 });
        expect(
          [report.turns.verificationRuns, turn(report, "run-verification").turns],
          "the same call after the window end keeps the call but adds no tool to the turn"
        ).toEqual([0, 0]);
        expect(report.turns.contextTokens).toBe(2026);
        expect(
          row(report, "search-read").claude,
          "user content that is neither text nor blocks contributes nothing; an API call counts once per message whatever its records"
        ).toMatchObject({ results: 1, chars: 4, carriedCharTurns: 24 });
        expect(
          report.calibration.samples,
          "a large result then a smaller context is no calibration sample; usage on a second record still calibrates the preceding result"
        ).toBe(1);
        expect(report.corpus.claude).toMatchObject({ unreadableFiles: 2 });
        expect(
          row(report, "unmatched-result").claude,
          "a file opened by mtime whose only timestamp is after the window counts nothing"
        ).toMatchObject({ results: 0, chars: 0 });
        expect(report.corpus.claude).toMatchObject({ filesScanned: 1, contextsActive: 1 });
        const error = yield* service
          .report(
            CensusRequest.make({
              claudeRoot,
              codexRoot: path.join(project, "a.jsonl"),
              repository: "beep-effect",
              window,
            })
          )
          .pipe(Effect.flip);
        expect(error.reason, "a root that is a file is an error, not an absent harness").toBe("unreadable-root");
        const sealed = path.join(home, "sealed");
        yield* fs.makeDirectory(path.join(sealed, "root"), { recursive: true });
        yield* fs.chmod(sealed, 0o000);
        const denied = yield* service
          .report(
            CensusRequest.make({ claudeRoot, codexRoot: path.join(sealed, "root"), repository: "beep-effect", window })
          )
          .pipe(Effect.flip);
        yield* fs.chmod(sealed, 0o700);
        expect(denied.reason, "a root that exists but cannot be inspected is an error too").toBe("unreadable-root");
      })
    );

    it.effect("reads every record shape the projection tolerates", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const home = yield* fs.makeTempDirectoryScoped();
        const claudeRoot = path.join(home, "projects");
        const codexRoot = path.join(home, "codex");
        const t = (minute: number) => `"timestamp":"2026-11-12T10:${minute < 10 ? "0" : ""}${minute}:00Z"`;
        const bash = (id: string, command: string) =>
          `{"type":"tool_use","id":"${id}","name":"Bash","input":{"command":"${command}"}}`;
        const turn = (minute: number, id: string, tools: string, usage = '{"input_tokens":1}') =>
          `{"type":"assistant",${t(minute)},"message":{"id":"${id}","usage":${usage},"content":[${tools}]}}`;
        const results = (minute: number, ...pairs: ReadonlyArray<readonly [string, string]>) =>
          `{"type":"user",${t(minute)},"message":{"content":[${A.join(
            A.map(pairs, ([id, content]) => `{"type":"tool_result","tool_use_id":"${id}","content":${content}}`),
            ","
          )}]}}`;
        const huge = Str.repeat(99_800)("a");
        const claude = [
          '{"type":"summary","summary":"leading record without a timestamp"}',
          `{"type":"assistant",${t(1)},"uuid":"u-1","message":{"usage":{"input_tokens":1,"output_tokens":1},"content":"plain"}}`,
          turn(2, "r1", bash("e1", "bun run lint --fix | head -3"), '{"input_tokens":10}'),
          turn(2, "r1", bash("e2", "bun run beep yeet"), '{"input_tokens":10}'),
          `{"type":"user",${t(3)},"message":{"content":[{"type":"text","text":"hi"},{"type":"tool_result","tool_use_id":"e1","content":["plain",7,{"type":"image"},{"type":"other"},{"type":"text","text":"\\u001b[31mFAIL\\u001b[0m"},{"type":"text","text":"@beep/schema:check: ok"}]},{"type":"tool_result","tool_use_id":"e2","content":{"text":"obj"}},{"type":"tool_result","content":"no id"},{"type":"tool_result","tool_use_id":"e2","content":{"other":1}},{"type":"tool_result","tool_use_id":"e2"},{"type":"tool_use","id":"x","name":"Bash"}]}}`,
          turn(
            4,
            "r2",
            A.join(
              [
                '{"type":"tool_use","id":"e3","name":"Read","input":{"file_path":"/repo/README.md"}}',
                '{"type":"tool_use","id":"e4","name":"Grep","input":{"pattern":"x"}}',
                bash("e5", "git commit -m wip"),
                bash("e6", "bun run beep yeet frobnicate"),
                '{"type":"tool_use","name":"Glob"}',
              ],
              ","
            )
          ),
          results(5, ["e3", '"r"'], ["e4", '"g"'], ["e5", '"c"'], ["e6", '"y"']),
          turn(6, "r3", bash("e7", "bun run check > /tmp/edge-a.log")),
          results(6, ["e7", '"x"']),
          turn(7, "r4", bash("e8", "tail /tmp/edge-a.log")),
          turn(8, "r5", '{"type":"tool_use","id":"e9","name":"Read","input":{"file_path":"/tmp/edge-a.log"}}'),
          turn(9, "r6", bash("e10", "bun run check > /tmp/edge-a.log")),
          turn(10, "r7", bash("e11", "grep x /tmp/edge-a.log")),
          turn(11, "r8", bash("e12", "grep y /tmp/edge-a.log")),
          turn(12, "r9", bash("e13", "grep z /tmp/edge-a.log")),
          `{"type":"system","subtype":"informational","isCompactSummary":true,${t(13)}}`,
          `{"type":"attachment",${t(14)},"message":{"content":"x"}}`,
          turn(15, "r10", bash("e14", "cat big.txt"), '{"input_tokens":100}'),
          results(16, ["e14", `"${huge}"`]),
          turn(17, "r11", "", '{"input_tokens":100,"cache_read_input_tokens":60000}'),
        ];
        const codex = [
          '{"type":"session_meta","timestamp":"2026-11-12T09:00:00Z","payload":{"cwd":"/w/edge-repo"}}',
          "not json",
          '{"type":"response_item","timestamp":"2026-11-12T09:01:00Z"}',
          '{"type":"response_item","timestamp":"2026-11-12T09:01:00Z","payload":"text"}',
          '{"type":"event_msg","timestamp":"2026-11-12T09:01:00Z","payload":{"type":"agent_message"}}',
          '{"type":"response_item","timestamp":"2026-11-12T09:02:00Z","payload":{"type":"function_call","name":"exec_command","call_id":"k1","arguments":{"cmd":"ls"}}}',
          '{"type":"response_item","timestamp":"2026-11-12T09:02:00Z","payload":{"type":"function_call","name":"exec_command","call_id":"k2","arguments":"42"}}',
          '{"type":"response_item","timestamp":"2026-11-12T09:02:00Z","payload":{"type":"custom_tool_call","name":"apply_patch","call_id":"k3"}}',
          '{"type":"response_item","timestamp":"2026-11-12T09:03:00Z","payload":{"type":"function_call_output","call_id":"k1"}}',
        ];
        yield* fs.makeDirectory(path.join(claudeRoot, "edge-beep-effect"), { recursive: true });
        yield* fs.makeDirectory(codexRoot, { recursive: true });
        yield* fs.writeFileString(path.join(claudeRoot, "edge-beep-effect", "a.jsonl"), A.join(claude, "\n"));
        yield* fs.writeFileString(path.join(claudeRoot, "edge-beep-effect", "b.jsonl"), '{"type":"summary"}\n');
        yield* fs.writeFileString(path.join(codexRoot, "x.jsonl"), A.join(codex, "\n"));
        yield* fs.writeFileString(
          path.join(codexRoot, "late.jsonl"),
          '{"type":"session_meta","timestamp":"2026-11-20T00:00:00Z","payload":{"cwd":"/w/edge-repo"}}\n'
        );
        const service = yield* Census;
        const report = yield* service.report(
          CensusRequest.make({
            claudeRoot,
            codexRoot,
            repository: "edge",
            window: CensusWindow.make({
              since: DateTime.makeUnsafe("2026-11-11T00:00:00Z"),
              until: DateTime.makeUnsafe("2026-11-18T00:00:00Z"),
            }),
          })
        );
        expect(report.repository).toBe("other");
        expect(
          report.corpus.claude,
          "b.jsonl has no timestamped record, so it never touches the window and is not scanned"
        ).toMatchObject({ filesScanned: 1, compactionBoundaries: 1, oversizedLines: 0 });
        expect(report.corpus.codex).toMatchObject({ filesScanned: 1, sessions: 1 });
        expect(report.turns.digFollowUp).toMatchObject({ runs: 3, zero: 1, two: 1, threeOrMore: 1, max: 3 });
        expect([report.turns.rerunsNoEdit, report.turns.rerunsSameCommand]).toEqual([1, 1]);
        expect(report.calibration.samples).toBe(1);
        expect(A.map(report.calibration.bins, (bin) => bin.samples)).toEqual([0, 0, 0, 1]);
        const lint = pipe(
          A.findFirst(report.lineClasses.byKind, (entry) => entry.kind === "lint"),
          O.getOrThrow
        );
        const lineChars = (lineClass: string) =>
          pipe(
            A.findFirst(lint.classes, (entry) => entry.lineClass === lineClass),
            O.map((entry) => entry.chars),
            O.getOrThrow
          );
        expect([lineChars("ansi"), lineChars("turbo-prefix")]).toEqual([9, length("@beep/schema:check: ")]);
        expect(row(report, "unmatched-result").claude.chars).toBe(length("no id"));
        expect(
          A.map(
            A.filter(report.yeetSubcommands, (entry) => entry.results > 0),
            (entry) => entry.subcommand
          )
        ).toEqual(["other", "none"]);
        expect(row(report, "search-read").codex.results).toBe(1);
      })
    );

    it.effect("counts a line over the page reader bound by size and class (AC7)", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const home = yield* fs.makeTempDirectoryScoped();
        const claudeRoot = path.join(home, "projects");
        const big = Str.repeat(300_000)("b");
        const lines = [
          '{"type":"assistant","timestamp":"2026-11-12T10:00:00Z","message":{"id":"a","usage":{"input_tokens":1},"content":[{"type":"tool_use","id":"t","name":"Bash","input":{"command":"cat big.txt"}}]}}',
          `{"type":"user","timestamp":"2026-11-12T10:00:01Z","message":{"content":[{"type":"tool_result","tool_use_id":"t","content":"${big}"}]}}`,
          "not json",
          "",
        ];
        yield* fs.makeDirectory(path.join(claudeRoot, "x-beep-effect"), { recursive: true });
        yield* fs.writeFileString(path.join(claudeRoot, "x-beep-effect", "s.jsonl"), A.join(lines, "\n"));
        const report = yield* census({
          claudeRoot,
          codexRoot: path.join(home, "codex"),
          window: CensusWindow.make({
            since: DateTime.makeUnsafe("2026-11-11T00:00:00Z"),
            until: DateTime.makeUnsafe("2026-11-18T00:00:00Z"),
          }),
        });
        expect(report.corpus.claude).toMatchObject({
          oversizedLines: 1,
          oversizedBytes: length(A.getUnsafe(lines, 1)),
        });
        expect(row(report, "search-read").claude).toMatchObject({ results: 1, chars: 300_000 });
      })
    );
  });
});
