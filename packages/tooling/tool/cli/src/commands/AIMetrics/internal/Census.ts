/**
 * The `ai-metrics census` program: run the agent output census for one window, print its tables or the
 * encoded report, and optionally record the run as a baseline file.
 *
 * **Details**
 *
 * The census itself is `@beep/repo-ai-metrics/census`; this module parses the window, resolves the default
 * harness roots, renders the report through `@beep/cli-kit` and writes the baseline. Everything it prints is
 * an aggregate: the report holds no text, and roots are shown relative to the home directory.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Doc } from "@beep/cli-kit/Doc";
import { Render } from "@beep/cli-kit/Render";
import { $RepoCliId } from "@beep/identity/packages";
import { Census, CensusRequest, makeCensus } from "@beep/repo-ai-metrics/census";
import {
  CensusBaselineFile,
  CensusReport,
  CensusWindow,
  censusBaselineFileName,
} from "@beep/repo-ai-metrics/census-report";
import { CensusSelectionRules } from "@beep/repo-ai-metrics/census-rules";
import { findRepoRoot } from "@beep/repo-utils";
import * as A from "effect/Array";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Console from "effect/Console";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AiMetricsCommandError } from "../AIMetrics.errors.ts";
import type { Block } from "@beep/cli-kit/Doc";
import type { CensusCorpus, CensusTotals, OutputVolume } from "@beep/repo-ai-metrics/census-report";

const $I = $RepoCliId.create("commands/AIMetrics/internal/Census");

/**
 * Inputs of one `ai-metrics census` run.
 *
 * **Details**
 *
 * `until` defaults to now and `since` to seven days before `until`. Roots default to `~/.claude/projects` and
 * `~/.codex/sessions`. `baselineDirectory` defaults to `standards/agent-output-census/runs` under the
 * repository root and is only read when `writeBaseline` is set. `repoRoot` is where the repository root is
 * searched from; the working directory by default.
 *
 * **Example** (Configure a JSON census of the default window)
 *
 * ```ts
 * import { CensusCommandOptions } from "@beep/repo-cli/commands/AIMetrics/internal/Census"
 * import * as O from "effect/Option"
 * const options = CensusCommandOptions.make({
 *   since: O.none(), until: O.none(), claudeRoot: O.none(), codexRoot: O.none(), baselineDirectory: O.none(), repoRoot: O.none(),
 *   repository: "beep-effect", json: true, writeBaseline: false,
 * })
 * console.log(options.json) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CensusCommandOptions extends S.Opaque<CensusCommandOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    since: S.Option(S.String),
    until: S.Option(S.String),
    claudeRoot: S.Option(S.String),
    codexRoot: S.Option(S.String),
    baselineDirectory: S.Option(S.String),
    repoRoot: S.Option(S.String),
    repository: S.NonEmptyString,
    json: S.Boolean,
    writeBaseline: S.Boolean,
  }).pipe(
    $I.annoteSchema("CensusCommandOptions", {
      description: "Window, harness roots, repository, output format and baseline flag of one census run.",
    })
  )
) {}

const integer = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const scales: ReadonlyArray<readonly [number, string, number]> = [
  [1e9, "B", 2],
  [1e6, "M", 1],
  [1e3, "k", 1],
];

const compact = (value: number): string =>
  pipe(
    A.findFirst(scales, ([scale]) => value >= scale),
    O.match({
      onNone: () => integer.format(value),
      onSome: ([scale, suffix, digits]) => `${(value / scale).toFixed(digits)}${suffix}`,
    })
  );

const count = (value: number): string => integer.format(value);
const percent = (share: O.Option<number>): string =>
  O.match(share, { onNone: () => "n/a", onSome: (value) => `${(value * 100).toFixed(1)}%` });
const decimal = (value: O.Option<number>, digits: number): string =>
  O.match(value, { onNone: () => "n/a", onSome: (number) => number.toFixed(digits) });

const right = (header: string) => ({ header, align: "right" as const });

const section = (title: string, blocks: ReadonlyArray<Block>) => Doc.section(title, blocks);

const corpusSection = (corpus: CensusCorpus) => {
  const claude = corpus.claude;
  const codex = corpus.codex;
  const present = [...(claude._tag === "Present" ? [claude] : []), ...(codex._tag === "Present" ? [codex] : [])];
  const oversized = A.reduce(present, 0, (total, entry) => total + entry.oversizedLines);
  const unreadable = A.reduce(present, 0, (total, entry) => total + entry.unreadableFiles);
  return section("Corpus", [
    Doc.table(
      [{ header: "Harness" }, right("Files scanned"), right("Active contexts"), right("Sessions"), right("Subagents")],
      [
        claude._tag === "Present"
          ? [
              "Claude Code",
              count(claude.filesScanned),
              count(claude.contextsActive),
              count(claude.sessions),
              count(claude.subagents),
            ]
          : ["Claude Code", "absent", "", "", ""],
        codex._tag === "Present"
          ? ["Codex", count(codex.filesScanned), count(codex.sessions), count(codex.sessions), "-"]
          : ["Codex", "absent", "", "", ""],
      ]
    ),
    Doc.paragraph(
      `${
        claude._tag === "Present"
          ? `Compaction boundaries: ${count(claude.compactionBoundaries)}.`
          : "Claude Code root absent."
      } Lines over the page bound: ${count(oversized)}. Unreadable files: ${count(unreadable)}.`
    ),
  ]);
};

const totalsSection = (totals: CensusTotals) => {
  const claudeRow = (label: string, value: CensusTotals["claudeSessions"]) =>
    O.match(value, {
      onNone: () => [label, "absent", "", ""],
      onSome: (entry) => [label, count(entry.apiCalls), compact(entry.contextTokens), compact(entry.toolOutputChars)],
    });
  return section("Totals", [
    Doc.table(
      [{ header: "Harness" }, right("API calls"), right("Context tokens read"), right("Tool output chars")],
      [
        claudeRow("Claude sessions", totals.claudeSessions),
        claudeRow("Claude subagents", totals.claudeSubagents),
        O.match(totals.codex, {
          onNone: () => ["Codex", "absent", "", ""],
          onSome: (entry) => [
            "Codex",
            "n/a",
            `${compact(entry.inputTokens)} input (${compact(entry.cachedInputTokens)} cached)`,
            compact(entry.toolOutputChars),
          ],
        }),
      ]
    ),
  ]);
};

const volumeCells = (volume: OutputVolume) => [
  compact(volume.chars),
  percent(volume.shareOfToolOutput),
  compact(volume.carriedCharTurns),
  percent(volume.shareOfContextRead),
];

const toolOutputSection = (report: CensusReport) =>
  section("Where tool output goes (Claude sessions plus subagents; Codex chars)", [
    Doc.table(
      [
        { header: "Class" },
        right("Chars"),
        right("Share of tool output"),
        right("Carried char-turns"),
        right("Share of context read"),
        right("Codex chars"),
      ],
      [
        ...A.map(report.toolOutput.rows, (row) => [
          row.toolOutputClass,
          ...volumeCells(row.claude),
          compact(row.codex.chars),
        ]),
        [
          "verification, all kinds",
          ...volumeCells(report.toolOutput.verification.claude),
          compact(report.toolOutput.verification.codex.chars),
        ],
        ["all tool output", ...volumeCells(report.toolOutput.all.claude), compact(report.toolOutput.all.codex.chars)],
      ]
    ),
  ]);

const verificationSection = (report: CensusReport) =>
  section("Verification output by kind", [
    Doc.table(
      [
        { header: "Kind" },
        right("Claude chars"),
        right("Share of verification"),
        right("Share of context read"),
        right("Codex chars"),
      ],
      A.map(report.verificationByKind, (row) => [
        row.kind,
        compact(row.claudeChars),
        percent(row.claudeShareOfVerification),
        percent(row.claudeShareOfContextRead),
        compact(row.codexChars),
      ])
    ),
    Doc.table(
      [{ header: "Yeet sub-command" }, right("Results"), right("Chars")],
      pipe(
        report.yeetSubcommands,
        A.filter((row) => row.results > 0),
        A.map((row) => [row.subcommand, count(row.results), compact(row.chars)])
      )
    ),
  ]);

const habitShare = (runs: number, habits: ReadonlyArray<{ readonly habit: string; readonly runs: number }>) =>
  A.map(["tail", "head", "grep", "unfiltered", "redirect"], (habit) =>
    percent(
      pipe(
        A.findFirst(habits, (entry) => entry.habit === habit),
        O.flatMap((entry) => (runs > 0 ? O.some(entry.runs / runs) : O.none()))
      )
    )
  );

const filterSection = (report: CensusReport) =>
  section("How agents filter verification runs (both harnesses)", [
    Doc.table(
      [
        { header: "Kind" },
        right("Runs"),
        right("tail"),
        right("head"),
        right("grep"),
        right("Unfiltered"),
        right("Redirect"),
      ],
      [
        ...A.map(report.filterHabits.rows, (row) => [row.kind, count(row.runs), ...habitShare(row.runs, row.habits)]),
        [
          "all verification runs",
          count(report.filterHabits.allRuns),
          ...habitShare(report.filterHabits.allRuns, report.filterHabits.allHabits),
        ],
      ]
    ),
  ]);

const turnsSection = (report: CensusReport) => {
  const turns = report.turns;
  const followUp = turns.digFollowUp;
  return section("What the turns cost (Claude)", [
    Doc.table(
      [
        { header: "Turn class" },
        right("Turns"),
        right("Share of turns"),
        right("Share of context read"),
        right("Result chars"),
      ],
      A.map(turns.rows, (row) => [
        row.turnClass,
        count(row.turns),
        percent(row.shareOfTurns),
        percent(row.shareOfContextRead),
        compact(row.resultChars),
      ])
    ),
    Doc.paragraph(
      `Verification runs ${count(turns.verificationRuns)}; redirected to a file ${count(turns.redirectedRuns)}; ` +
        `re-run with no edit since ${count(turns.rerunsNoEdit)} (${count(turns.rerunsSameCommand)} byte-identical); ` +
        `log digs ${count(turns.logDigs)}; CI log fetches ${count(turns.ciLogFetches)}.`
    ),
    Doc.table(
      [{ header: "Log digs after a run" }, right("Runs")],
      [
        ["0", count(followUp.zero)],
        ["1", count(followUp.one)],
        ["2", count(followUp.two)],
        ["3 or more", count(followUp.threeOrMore)],
        ["max", count(followUp.max)],
        ["mean", decimal(followUp.mean, 2)],
      ]
    ),
  ]);
};

const lineSection = (report: CensusReport) =>
  section(`Line classes of verification output (${compact(report.lineClasses.totalChars)} chars, both harnesses)`, [
    Doc.table(
      [{ header: "Line class" }, right("Chars"), right("Share")],
      A.map(report.lineClasses.classes, (row) => [row.lineClass, compact(row.chars), percent(row.share)])
    ),
    Doc.table(
      [{ header: "Offender" }, right("Lines"), right("Chars"), right("Share of its kinds")],
      A.map(report.lineClasses.offenders, (row) => [
        row.offender,
        count(row.lines),
        compact(row.chars),
        percent(row.share),
      ])
    ),
  ]);

const calibrationSection = (report: CensusReport) => {
  const calibration = report.calibration;
  return section("Chars per token", [
    Doc.paragraph(
      `${decimal(calibration.charsPerToken, 2)} chars per token: tokens = ${decimal(calibration.intercept, 0)} + ` +
        `${decimal(calibration.slope, 4)} x chars, over ${count(calibration.samples)} samples.`
    ),
    Doc.table(
      [{ header: "Result size" }, right("Samples"), right("Median"), right("p25"), right("p75")],
      A.map(calibration.bins, (row) => [
        row.bin,
        count(row.samples),
        decimal(row.median, 2),
        decimal(row.p25, 2),
        decimal(row.p75, 2),
      ])
    ),
  ]);
};

const headlineSection = (report: CensusReport) => {
  const headline = report.headline;
  return section("Headline rows", [
    Doc.table(
      [{ header: "Row" }, right("Value")],
      [
        ["verification runs filtered (piped, discarded or redirected)", percent(headline.filteredRunShare)],
        ["log digs per verification run", decimal(headline.logDigsPerRun, 3)],
        ["turns per verdict", decimal(headline.turnsPerVerdict, 3)],
      ]
    ),
    Doc.table(
      [{ header: "Kind" }, right("Runs"), right("Chars"), right("Chars per run")],
      A.map(headline.verificationCharsPerRun, (row) => [
        row.kind,
        count(row.runs),
        compact(row.chars),
        decimal(row.charsPerRun, 0),
      ])
    ),
  ]);
};

/**
 * Render a census report as plain-text tables, in the audit's order: corpus first, headline rows last.
 *
 * **Example** (Render a decoded report)
 *
 * ```ts
 * import { renderCensusReport } from "@beep/repo-cli/commands/AIMetrics/internal/Census"
 * console.log(typeof renderCensusReport) // "function"
 * ```
 *
 * @param report - the run whose sections become the tables
 * @param header - lines printed above the tables (the window and the roots)
 * @returns Plain text with one titled table group per report section, laid out without a width limit.
 * @category formatting
 * @since 0.0.0
 */
export const renderCensusReport: {
  (report: CensusReport, header: ReadonlyArray<string>): string;
  (header: ReadonlyArray<string>): (report: CensusReport) => string;
} = dual(2, (report: CensusReport, header: ReadonlyArray<string>): string =>
  Render.plain(
    [
      Doc.section(undefined, [
        ...A.map(header, (line) => Doc.paragraph(line)),
        corpusSection(report.corpus),
        totalsSection(report.totals),
        toolOutputSection(report),
        verificationSection(report),
        filterSection(report),
        turnsSection(report),
        lineSection(report),
        calibrationSection(report),
        headlineSection(report),
      ]),
    ],
    Render.contextOf({ audience: "agent", width: Number.POSITIVE_INFINITY })
  )
);

const commandError = (message: string) => AiMetricsCommandError.make({ message, cause: message });

const IsoInstant = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/;

const calendarDate = (value: string): O.Option<string> =>
  pipe(
    Str.match(IsoInstant)(value),
    O.flatMap(A.get(1)),
    O.filter((date) => O.exists(DateTime.make(`${date}T00:00:00Z`), (day) => DateTime.formatIsoDateUtc(day) === date))
  );

const parseInstant = (label: string, value: string) =>
  Effect.fromOption(
    O.map(
      O.flatMap(calendarDate(value), () => DateTime.make(value)),
      DateTime.toUtc
    )
  ).pipe(Effect.mapError(() => commandError(`--${label} must be an ISO timestamp.`)));

const resolveWindow = Effect.fn("AIMetrics.census.window")(function* (options: CensusCommandOptions) {
  const until = O.isSome(options.until) ? yield* parseInstant("until", options.until.value) : yield* DateTime.now;
  const since = O.isSome(options.since)
    ? yield* parseInstant("since", options.since.value)
    : DateTime.subtractDuration(until, Duration.days(7));
  return CensusWindow.make({ since, until });
});

const resolveHome = Effect.fn("AIMetrics.census.home")(function* () {
  const home = yield* ConfigProvider.ConfigProvider.use(pipe(Config.String("HOME"), Config.option).parse).pipe(
    Effect.option
  );
  return O.filter(O.flatten(home), Str.isNonEmpty);
});

const displayRoot = (home: O.Option<string>, root: string): string =>
  O.match(
    O.filter(home, (value) => root === value || Str.startsWith(`${value}/`)(root)),
    { onNone: () => "(custom root)", onSome: (value) => `~${Str.slice(Str.length(value))(root)}` }
  );

const defaultRoot = Effect.fn("AIMetrics.census.root")(function* (
  supplied: O.Option<string>,
  home: O.Option<string>,
  relative: string,
  flag: string
) {
  const path = yield* Path.Path;
  if (O.isSome(supplied)) return path.resolve(supplied.value);
  return yield* O.match(home, {
    onNone: () => Effect.fail(commandError(`Unable to resolve a home directory. Pass --${flag} explicitly.`)),
    onSome: (value) => Effect.succeed(path.join(value, relative)),
  });
});

const isEmpty = (report: CensusReport) =>
  (report.corpus.claude._tag === "Absent" || report.corpus.claude.contextsActive === 0) &&
  (report.corpus.codex._tag === "Absent" || report.corpus.codex.sessions === 0);

const encodeReport = S.encodeEffect(S.fromJsonString(CensusReport));
const encodeBaseline = S.encodeEffect(S.fromJsonString(CensusBaselineFile, { space: 2 }));

const writeBaseline = Effect.fn("AIMetrics.census.writeBaseline")(function* (
  report: CensusReport,
  options: CensusCommandOptions
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const located = options.repoRoot.pipe(O.getOrUndefined, findRepoRoot);
  const root = O.isSome(options.baselineDirectory)
    ? yield* located.pipe(Effect.option)
    : yield* located.pipe(
        Effect.asSome,
        Effect.mapError(() => commandError("Unable to locate the repository root. Pass --baseline-dir."))
      );
  const target = pipe(
    options.baselineDirectory,
    O.orElse(() => O.map(root, (value) => path.join(value, "standards", "agent-output-census", "runs"))),
    O.map(path.resolve),
    O.getOrThrow
  );
  const name = censusBaselineFileName(report.window.until, report.ruleVersion);
  const file = path.join(target, name);
  const recordedAt = yield* DateTime.now;
  const text = yield* encodeBaseline(
    CensusBaselineFile.make({ version: "agent-output-census-baseline/v1", recordedAt, report })
  ).pipe(Effect.orDie);
  yield* fs.makeDirectory(target, { recursive: true }).pipe(
    Effect.andThen(fs.writeFileString(file, `${text}\n`, { flag: "wx" })),
    Effect.mapError(() =>
      commandError("A census baseline file for this window end and rule version already exists, or cannot be written.")
    )
  );
  return pipe(
    root,
    O.map((value) => path.relative(value, file)),
    O.filter((shown) => !Str.startsWith("..")(shown)),
    O.getOrElse(() => name)
  );
});

/**
 * Run the census, print the tables (or the encoded report with `json`), and with `writeBaseline` add the
 * run's baseline file.
 *
 * **Details**
 *
 * An empty corpus (no harness root present, or no activity in the window) prints the report and then fails,
 * so a mistyped window or root never reads as zero activity.
 *
 * `since` and `until` must be zoned ISO timestamps on real calendar dates: `02-30` is refused, not
 * rolled into March. Without a usable HOME the Claude and Codex roots must be passed explicitly. A
 * root under the home directory prints with `~`; any other root prints as `(custom root)`. An
 * explicit baseline directory works outside a checkout, and the printed baseline path is relative
 * to the repository, or the bare file name outside it, never absolute.
 *
 * **Example** (Build a census program)
 *
 * ```ts
 * import { CensusCommandOptions, makeCensusProgram } from "@beep/repo-cli/commands/AIMetrics/internal/Census"
 * import * as O from "effect/Option"
 * const program = makeCensusProgram(
 *   CensusCommandOptions.make({
 *     since: O.none(), until: O.none(), claudeRoot: O.none(), codexRoot: O.none(), baselineDirectory: O.none(), repoRoot: O.none(),
 *     repository: "beep-effect", json: false, writeBaseline: false,
 *   })
 * )
 * console.log(program)
 * ```
 *
 * @param options - the window, roots, repository and output choices
 * @returns An effect that prints the census, fails on an empty corpus, and writes the baseline when asked.
 * @category programs
 * @since 0.0.0
 */
export const makeCensusProgram = Effect.fn("AIMetrics.makeCensusProgram")(
  function* (options: CensusCommandOptions) {
    const window = yield* resolveWindow(options);
    const home = yield* resolveHome();
    const claudeRoot = yield* defaultRoot(options.claudeRoot, home, ".claude/projects", "claude-root");
    const codexRoot = yield* defaultRoot(options.codexRoot, home, ".codex/sessions", "codex-root");
    const census = yield* Census;
    const report = yield* census
      .report(CensusRequest.make({ window, claudeRoot, codexRoot, repository: options.repository }))
      .pipe(Effect.mapError((error) => commandError(error.message)));
    if (options.json) {
      yield* encodeReport(report).pipe(Effect.orDie, Effect.flatMap(Console.log));
    } else {
      yield* Console.log(
        renderCensusReport(report, [
          `Agent output census ${report.version}, rules ${report.ruleVersion}, repository ${
            options.repository === CensusSelectionRules.referenceRepository ? options.repository : "(other)"
          }.`,
          `Window: ${DateTime.formatIso(window.since)} to ${DateTime.formatIso(window.until)}.`,
          `Roots: Claude ${displayRoot(home, claudeRoot)}, Codex ${displayRoot(home, codexRoot)}.`,
        ])
      );
    }
    if (isEmpty(report)) return yield* commandError("The census found no activity in the window.");
    if (!options.writeBaseline) return;
    const written = yield* writeBaseline(report, options);
    yield* Console.error(`Census baseline written: ${written}`);
  },
  Effect.provideServiceEffect(Census, makeCensus)
);
