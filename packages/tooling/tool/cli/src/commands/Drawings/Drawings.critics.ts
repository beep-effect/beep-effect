/**
 * The sequential multi-model critic loop: build a pack from a render, run an
 * ordered list of reviewers on it (each seeing the earlier reports), and
 * summarise the loop for the judge.
 *
 * **Details**
 *
 * Reviewers are external CLIs (`codex exec`, `grok`, `claude -p`,
 * `cursor-agent`) spawned read-only in the pack directory. The pack and the
 * loop records are plain files under the directory the operator names, so a
 * matter's packs stay under the corpus root while synthetic packs may live
 * anywhere. Nothing here sends mail or touches git.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoCliId } from "@beep/identity/packages";
import { PdfTools, PngRequest } from "@beep/pdf-tools";
import { findRepoRoot } from "@beep/repo-utils/Root";
import { Sha256Hex } from "@beep/schema";
import { RenderManifest, sha256Hex } from "@beep/technical-drawing";
import { A, O, Str } from "@beep/utils";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { constant, flow, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Num from "effect/Number";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import { collectText } from "../../internal/process/StepExec.ts";
import {
  CriticClaudeEvent,
  CriticClaudeOutputLimitStop,
  CriticClaudeResult,
  CriticInvocation,
  CriticLoopRecord,
  CriticPackManifest,
  CriticReportSource,
  CriticReviewer,
  CriticRunRecord,
  CriticSeatLimit,
  CriticSeatUnavailable,
  CriticSeatUnavailableReason,
  CriticZoom,
  criticReportJsonSchema,
  decodeCriticLoopRecord,
  decodeCriticPackManifest,
  decodeCriticReport,
  encodeCriticLoopRecord,
  encodeCriticPackManifest,
  encodeCriticReport,
} from "./Drawings.critics.schemas.ts";
import { DrawingsCommandError } from "./Drawings.errors.ts";
import {
  CriticMeasurements,
  CriticPdfMeasurements,
  encodeCriticMeasurements,
} from "./Drawings.measurements.schemas.ts";
import {
  figureMeasurements,
  measurementsMarkdown,
  parsePdfFonts,
  parsePdfInfoBoxes,
  strokeTableMarkdown,
} from "./Drawings.measurements.ts";
import type { CriticPackRequest, CriticReport, CriticRoute, CriticRunRequest } from "./Drawings.critics.schemas.ts";
import type { CriticPdfPage } from "./Drawings.measurements.schemas.ts";

const $I = $RepoCliId.create("commands/Drawings/Drawings.critics");

const decodeManifest = S.decodeEffect(S.fromJsonString(RenderManifest));
const sha256 = flow(sha256Hex, Effect.map(Sha256Hex.make));
const fail = (message: string) => (cause: unknown) => DrawingsCommandError.new(cause, message);
const encoder = new TextEncoder();

// Appends a byte stream's text to `printed` as it arrives, so a run stopped mid-stream keeps what came before.
const collectInto = <E>(stream: Stream.Stream<Uint8Array, E>, printed: Ref.Ref<string>) =>
  stream.pipe(
    Stream.decodeText(),
    Stream.runForEach((chunk) => Ref.update(printed, Str.concat(chunk)))
  );

/**
 * Repository-relative path of the generic critic prompt every matter reviewer
 * receives ahead of the pack's brief.
 *
 * **Example** (Reference the template)
 *
 * ```ts
 * import { DRAWING_CRITIC_PROMPT_TEMPLATE } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(DRAWING_CRITIC_PROMPT_TEMPLATE)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DRAWING_CRITIC_PROMPT_TEMPLATE = ".claude/skills/browser-qa-loop/resources/drawing-critic-prompt.md";

const SHEET_DPI = 150;
const ZOOM_DPI = 300;
const IMAGE_EXTENSIONS = HashSet.fromIterable([".png", ".jpg", ".jpeg", ".webp"]);
// Variables that would make a nested `claude -p` believe it runs inside this
// session, or route it through a proxy the operator did not choose.
const SCRUBBED_ENV = HashSet.fromIterable([
  "CLAUDECODE",
  "CLAUDE_CODE_ENTRYPOINT",
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_AUTH_TOKEN",
]);

/**
 * The hard rules appended to every reviewer prompt.
 *
 * **Example** (Every reviewer runs read-only)
 *
 * ```ts
 * import { CRITIC_HARD_RULES } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(CRITIC_HARD_RULES.startsWith("Hard rules for this run: read only")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CRITIC_HARD_RULES =
  "Hard rules for this run: read only; do not create, modify or delete any file; do not run git or browse the web. Your final message must be the JSON document itself: no prose, no fences.";

/**
 * The output-token and thinking-token caps every `claude -p` seat runs with,
 * unless the operator's environment already sets them.
 *
 * **Details**
 *
 * A review seat at `xhigh` effort ran single responses past 64,000 output
 * tokens, the CLI's default cap, and then past 128,000, and each time ended
 * with `api_error` `max_output_tokens` and no report. A 48,000-token thinking
 * cap bounds what one response spends on thinking, and a 96,000-token output
 * cap leaves room for the final report after it. A value already in the
 * operator's environment wins, so a seat reruns with other caps by exporting
 * them.
 *
 * **Example** (The defaults)
 *
 * ```ts
 * import { CRITIC_CLAUDE_LIMITS } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(CRITIC_CLAUDE_LIMITS.CLAUDE_CODE_MAX_OUTPUT_TOKENS) // "96000"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CRITIC_CLAUDE_LIMITS: Readonly<Record<"CLAUDE_CODE_MAX_OUTPUT_TOKENS" | "MAX_THINKING_TOKENS", string>> = {
  CLAUDE_CODE_MAX_OUTPUT_TOKENS: "96000",
  MAX_THINKING_TOKENS: "48000",
};

/**
 * The exit code recorded for a seat the harness stopped at its time limit:
 * the process never exited on its own, so the record carries 124, the
 * `timeout(1)` convention.
 *
 * **Example** (The recorded code)
 *
 * ```ts
 * import { CRITIC_TIME_LIMIT_EXIT_CODE } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(CRITIC_TIME_LIMIT_EXIT_CODE) // 124
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CRITIC_TIME_LIMIT_EXIT_CODE = 124;

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests)
// ---------------------------------------------------------------------------

/**
 * Parse one `--zoom` flag value `fig:x,y,width,height:label` into a
 * {@link CriticZoom}.
 *
 * **Example** (A wall crop of FIG. 1)
 *
 * ```ts
 * import { parseZoomFlag } from "@beep/repo-cli/commands/Drawings"
 * import * as Effect from "effect/Effect"
 *
 * Effect.runPromise(parseZoomFlag("1:500,1500,1700,1400:walls")).then((zoom) => console.log(zoom.label)) // "walls"
 * ```
 *
 * @param text - One zoom flag in fig:x,y,width,height:label form, using pixel coordinates.
 * @returns An effect yielding a validated zoom, or a command error for malformed or invalid values.
 * @category parsing
 * @since 0.0.0
 */
export const parseZoomFlag = (text: string): Effect.Effect<CriticZoom, DrawingsCommandError> =>
  pipe(
    O.fromNullishOr(/^(\d+):(\d+),(\d+),(\d+),(\d+):([A-Za-z0-9-]+)$/.exec(text)),
    Effect.fromOption,
    Effect.mapError(() => DrawingsCommandError.make({ message: `"${text}" is not fig:x,y,width,height:label.` })),
    Effect.flatMap((m) =>
      S.decodeEffect(CriticZoom)({
        figure: Number(m[1]),
        label: m[6] ?? "",
        x: Number(m[2]),
        y: Number(m[3]),
        width: Number(m[4]),
        height: Number(m[5]),
      }).pipe(Effect.mapError(fail(`"${text}" is not a valid zoom.`)))
    )
  );

const GROK_DENY_PATH = "could not resolve runtime-socket deny path";
const GROK_DENY_LIST = "this sandbox could not enforce its deny list on Linux";
const GROK_REFUSING = "refusing to start";

/**
 * Recognise the one Grok startup failure that means the seat cannot run on
 * this host: `--sandbox strict` could not resolve a runtime-socket path it
 * must deny, so the CLI refused to start without that protection.
 *
 * **Details**
 *
 * Matches only stderr that says the runtime-socket deny path could not be
 * resolved and that the sandbox could not enforce its deny list on Linux and
 * refused to start. The path is the token after `deny path`, without a
 * trailing colon; the result carries no path when the message names none.
 * Every other failure (auth, quota, a crash, another sandbox refusal) is not
 * matched, so its run is recorded as it always was.
 *
 * **Example** (The refusal Grok prints)
 *
 * ```ts
 * import { grokSandboxRefusal } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const stderr = [
 *   "Error: sandbox profile resolve failed: socket deny resolution failed: could not resolve runtime-socket deny path /run/example/runtime.sock: Permission denied (os error 13)",
 *   "error: this sandbox could not enforce its deny list on Linux: the required bwrap plan could not be prepared; see the error above for the specific cause. Refusing to start with denied paths unprotected.",
 * ].join("\n")
 * console.log(O.flatMap(grokSandboxRefusal(stderr), (seat) => seat.path)) // Some("/run/example/runtime.sock")
 * ```
 *
 * @param stderr - Everything the Grok CLI wrote to stderr for one failed run.
 * @returns The unavailable-seat record with the denied path when one is named, or None for any other failure.
 * @category parsing
 * @since 0.0.0
 */
export const grokSandboxRefusal = (stderr: string): O.Option<CriticSeatUnavailable> =>
  Str.includes(GROK_DENY_PATH)(stderr) &&
  Str.includes(GROK_DENY_LIST)(stderr) &&
  pipe(stderr, Str.toLowerCase, Str.includes(GROK_REFUSING))
    ? O.some(
        pipe(
          O.fromNullishOr(/could not resolve runtime-socket deny path (\S+)/.exec(stderr)),
          O.flatMap((m) => O.fromUndefinedOr(m[1])),
          O.map(Str.replace(/:$/, "")),
          O.filter(Str.isNonEmpty),
          (path) =>
            CriticSeatUnavailable.make({
              reason: "sandbox-deny-path-unresolved",
              path,
              detail: O.match(path, {
                onNone: () =>
                  "grok refused to start: its --sandbox strict profile could not resolve a runtime-socket deny path on this host (the message names no path)",
                onSome: (denied) =>
                  `grok refused to start: its --sandbox strict profile could not resolve the runtime-socket deny path ${denied} on this host`,
              }),
            })
        )
      )
    : O.none();

// How a summary and the command name a seat that ended without a report.
const seatOutcome = (seat: CriticSeatUnavailable) =>
  CriticSeatUnavailableReason.match(seat.reason, {
    "sandbox-deny-path-unresolved": () => ({ verb: "did not run", line: "seat unavailable on this host, skipped" }),
    "time-limit": () => ({ verb: "did not finish", line: "stopped at its time limit, no report" }),
    "output-limit": () => ({ verb: "did not finish", line: "stopped at its output-token cap, no report" }),
  });

// A seat the harness stopped at the run's time limit.
const timeLimitSeat = (minutes: number): CriticSeatUnavailable =>
  CriticSeatUnavailable.make({
    reason: "time-limit",
    path: O.none(),
    limit: O.some(CriticSeatLimit.make({ amount: minutes, unit: "minutes" })),
    detail: `the seat ran past its ${minutes}-minute limit and was stopped`,
  });

const missingSeatLines = (runs: ReadonlyArray<CriticRunRecord>): ReadonlyArray<string> =>
  pipe(
    runs,
    A.map((run) =>
      O.map(
        run.unavailable,
        (seat) =>
          `- ${run.reviewer.name} (ids ${run.reviewer.idPrefix}-…) ${seatOutcome(seat).verb}: ${seat.detail}. It wrote no report; there are no ${run.reviewer.idPrefix}- findings to assess.`
      )
    ),
    A.getSomes
  );

/**
 * One line of `beep drawings critics run` output for a seat's run: its exit
 * code and findings, or why it ended without a report.
 *
 * **Example** (A seat stopped at its time limit)
 *
 * ```ts
 * import { CriticReviewer, CriticRunRecord, CriticSeatLimit, CriticSeatUnavailable, criticRunLine } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const run = CriticRunRecord.make({
 *   order: 3,
 *   reviewer: CriticReviewer.make({ name: "claude-fable-5.1", idPrefix: "F", route: "claude", model: "claude-fable-5-1", scope: "matter" }),
 *   exitCode: 124,
 *   report: O.none(),
 *   reportSha256: O.none(),
 *   findings: 0,
 *   startedAt: "2026-10-15T00:00:00.000Z",
 *   finishedAt: "2026-10-15T01:30:00.000Z",
 *   unavailable: O.some(
 *     CriticSeatUnavailable.make({
 *       reason: "time-limit",
 *       path: O.none(),
 *       limit: O.some(CriticSeatLimit.make({ amount: 90, unit: "minutes" })),
 *       detail: "the seat ran past its 90-minute limit and was stopped",
 *     })
 *   ),
 * })
 * console.log(criticRunLine(run)) // "3. claude-fable-5.1: stopped at its time limit, no report (the seat ran past its 90-minute limit and was stopped)"
 * ```
 *
 * @param run - One seat's run record from a loop.
 * @returns The seat's order, name, and either its exit code and finding count or the reason it ended without a report.
 * @category formatting
 * @since 0.0.0
 */
export const criticRunLine = (run: CriticRunRecord): string =>
  O.match(run.unavailable, {
    onNone: () =>
      `${run.order}. ${run.reviewer.name}: exit ${run.exitCode}, ${run.findings} finding(s)${O.isNone(run.report) ? " (no report)" : ""}`,
    onSome: (seat) => `${run.order}. ${run.reviewer.name}: ${seatOutcome(seat).line} (${seat.detail})`,
  });

/**
 * The markdown summary of a loop so far: every seat that could not run on
 * this host or stopped at a limit, and why, then every finding of the earlier reports with its id,
 * severity, scope, category, figures, location, observation, basis, and fix,
 * plus each reviewer's stance on the findings before it.
 *
 * **Details**
 *
 * Naming the missing seats first keeps a later reviewer, and the judge, from
 * looking for a report that does not exist.
 *
 * **Example** (A loop whose Grok seat could not start)
 *
 * ```ts
 * import { CriticReviewer, CriticRunRecord, CriticSeatUnavailable, loopSummaryMarkdown } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const grok = CriticRunRecord.make({
 *   order: 1,
 *   reviewer: CriticReviewer.make({ name: "grok-4.7", idPrefix: "G", route: "grok", model: "grok-4.7", scope: "matter" }),
 *   exitCode: 1,
 *   report: O.none(),
 *   reportSha256: O.none(),
 *   findings: 0,
 *   startedAt: "2026-10-15T00:00:00.000Z",
 *   finishedAt: "2026-10-15T00:00:01.000Z",
 *   unavailable: O.some(
 *     CriticSeatUnavailable.make({ reason: "sandbox-deny-path-unresolved", path: O.none(), detail: "grok refused to start" })
 *   ),
 * })
 * console.log(loopSummaryMarkdown({ reports: [], runs: [grok] }).includes("grok-4.7 (ids G-…) did not run")) // true
 * ```
 *
 * @param input - The reports written so far, in seat order, and the run records of the loop's seats.
 * @returns Markdown naming each seat that did not run or did not finish, then every earlier finding, stance, and unassessed item.
 * @category formatting
 * @since 0.0.0
 */
export const loopSummaryMarkdown = (input: {
  readonly reports: ReadonlyArray<CriticReport>;
  readonly runs: ReadonlyArray<CriticRunRecord>;
}): string => {
  const missing = missingSeatLines(input.runs);
  const seats = A.isReadonlyArrayEmpty(missing)
    ? []
    : ["\n## Seats that did not run or did not finish in this loop\n", ...missing];
  const sections = A.map(input.reports, (report) => {
    const findings = A.map(
      report.findings,
      (f) =>
        `- **${f.id}** ${f.severity} ${f.scope} ${f.category} FIG ${JSON.stringify(f.figures)} — ${f.location} — ${f.observation} — basis: ${f.basis} — fix: ${f.proposedFix} (confidence ${f.confidence})`
    );
    const stances = A.map(report.priorAssessment, (p) => `  - on ${p.id}: ${p.stance} — ${p.note}`);
    const unassessed =
      A.length(report.couldNotAssess) === 0 ? [] : [`  - could_not_assess: ${A.join(report.couldNotAssess, " | ")}`];
    return A.join(
      [
        `\n## ${report.reviewer} — verdict ${report.verdict} — blockers: ${JSON.stringify(report.blockers)}\n`,
        ...findings,
        ...stances,
        ...unassessed,
      ],
      "\n"
    );
  });
  return A.join(
    [
      "# Findings already reported in this loop (dedupe against these; confirm or refute each)\n",
      ...seats,
      ...sections,
      "",
    ],
    "\n"
  );
};

/**
 * The markdown summary of earlier reports a later reviewer dedupes against:
 * every finding with its id, severity, scope, category, figures, location,
 * observation, basis, and fix, plus each reviewer's stance on the findings
 * before it. {@link loopSummaryMarkdown} adds the seats that could not run.
 *
 * **Example** (No earlier reports)
 *
 * ```ts
 * import { priorSummaryMarkdown } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(priorSummaryMarkdown([]).startsWith("# Findings already reported")) // true
 * ```
 *
 * @param reports - Earlier reviewer reports in the order later reviewers should read them.
 * @returns Markdown preserving findings, prior assessments, and unassessed items in report order, with no missing-seat section.
 * @category formatting
 * @since 0.0.0
 */
export const priorSummaryMarkdown = (reports: ReadonlyArray<CriticReport>): string =>
  loopSummaryMarkdown({ reports, runs: [] });

/**
 * The id-and-category view of earlier reports a synthetic-scope reviewer gets
 * instead of the full summary, so no matter detail reaches it.
 *
 * **Example** (No earlier reports)
 *
 * ```ts
 * import { priorIdsMarkdown } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(priorIdsMarkdown([]).startsWith("# Finding ids already reported")) // true
 * ```
 *
 * @param reports - Earlier reports whose finding identifiers and categories may reach synthetic reviewers.
 * @returns Markdown listing finding ids, categories, and bases while excluding the full matter summary.
 * @category formatting
 * @since 0.0.0
 */
export const priorIdsMarkdown = (reports: ReadonlyArray<CriticReport>): string =>
  A.join(
    [
      "# Finding ids already reported by earlier reviewers (categories only; the matter set is not shown to you)\n",
      ...pipe(
        reports,
        A.flatMap((report) => report.findings),
        A.map((f) => `- ${f.id} ${f.severity} ${f.category} — basis: ${f.basis}`)
      ),
      "",
    ],
    "\n"
  );

const parseJson = S.decodeUnknownOption(S.fromJsonString(S.Unknown));

const decodeClaudeResult = S.decodeUnknownOption(CriticClaudeResult);

// A `claude -p` event: a JSON object with a string `type`.
const isClaudeEvent = S.is(CriticClaudeEvent);

const decodeOutputLimitStop = S.decodeUnknownOption(CriticClaudeOutputLimitStop);

// The events `claude -p` printed: one JSON value (an envelope, or an array of events), or one event per line.
const claudeEvents = (text: string): O.Option<ReadonlyArray<unknown>> =>
  pipe(
    parseJson(text),
    O.map(A.ensure),
    // `--output-format stream-json` prints one event per line.
    O.orElse(
      (): O.Option<ReadonlyArray<unknown>> =>
        pipe(
          Str.split(text, "\n"),
          A.flatMap((line) => pipe(parseJson(line), O.filter(isClaudeEvent), A.fromOption)),
          O.liftPredicate(A.isReadonlyArrayNonEmpty)
        )
    )
  );

const OUTPUT_CAP = /exceeded the (\d+) output token maximum/;

/**
 * Recognise a `claude -p` run that ended because one response ran past the
 * output-token cap: its last `result` event carries `api_error`
 * `max_output_tokens`.
 *
 * **Details**
 *
 * Reads the same output shapes as {@link extractReportText} (one envelope,
 * an event array, or one event per line). The cap is the number the CLI's
 * message names; the result carries no limit when the message names none.
 * A finished run, or a run that ended on any other API error, is not matched.
 *
 * **Example** (The stop the CLI prints)
 *
 * ```ts
 * import { claudeOutputLimit } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const stdout = '{"type":"result","is_error":true,"api_error":"max_output_tokens","terminal_reason":"api_error","result":"API Error: Claude\'s response exceeded the 64000 output token maximum."}'
 * console.log(O.flatMap(claudeOutputLimit(stdout), (seat) => seat.limit)) // Some({ amount: 64000, unit: "output-tokens" })
 * ```
 *
 * @param stdout - Everything `claude -p` wrote to stdout for one run.
 * @returns The seat record with the cap its message names, or None for any other ending.
 * @category parsing
 * @since 0.0.0
 */
export const claudeOutputLimit = (stdout: string): O.Option<CriticSeatUnavailable> =>
  pipe(
    claudeEvents(stdout),
    // A lambda, not a direct ref: findLast's index must not reach the decoder as parse options.
    O.flatMap(A.findLast((event: unknown) => O.isSome(decodeClaudeResult(event)))),
    O.flatMap((event) => decodeOutputLimitStop(event)),
    O.map((stop) => {
      const limit = pipe(
        stop.result,
        O.flatMap((message) => O.fromNullishOr(OUTPUT_CAP.exec(message))),
        O.flatMap((m) => O.fromUndefinedOr(m[1])),
        O.flatMap(Num.parse),
        O.flatMap((amount) => CriticSeatLimit.makeOption({ amount, unit: "output-tokens" }))
      );
      return CriticSeatUnavailable.make({
        reason: "output-limit",
        path: O.none(),
        limit,
        detail: O.match(limit, {
          onNone: () =>
            "claude ended the run with api_error max_output_tokens: one response ran past its output-token cap (the message names no cap)",
          onSome: (cap) =>
            `claude ended the run with api_error max_output_tokens: one response ran past the ${cap.amount} output-token cap`,
        }),
      });
    })
  );

// The recognised reason a seat that exited non-zero wrote no report: Grok's strict sandbox could not start,
// or claude ended at its output-token cap. Any other failure stays a plain failed run.
const seatStop = (
  route: CriticRoute,
  output: { readonly stdout: string; readonly stderr: string; readonly exitCode: number }
): O.Option<CriticSeatUnavailable> =>
  output.exitCode === 0
    ? O.none()
    : Match.value(route).pipe(
        Match.when("grok", () => grokSandboxRefusal(output.stderr)),
        Match.when("claude", () => claudeOutputLimit(output.stdout)),
        Match.orElse(O.none<CriticSeatUnavailable>)
      );

/**
 * Pull the report JSON out of what a route returned.
 *
 * **Details**
 *
 * `codex` writes the file it was told to write. `grok` prints a wrapper whose
 * `structuredOutput` (or `text`) holds the document. `claude -p` prints one
 * `result` envelope (`--output-format json`), a JSON array of events
 * (`--output-format json --verbose`), or one event per line
 * (`--output-format stream-json --verbose`); the last `result` event carries
 * the final message, and one flagged `is_error` carries no report.
 * `cursor-agent` prints the final message as text. The last two are read as
 * the outermost `{ … }` of that message.
 *
 * **Gotchas**
 *
 * When `claude -p` printed JSON, as one value or as one event per line, only
 * its `result` event is searched: the events' own braces are never taken for a
 * report. The outermost-braces fallback applies only when the output is neither
 * JSON nor has a line that is a JSON object with a string `type`.
 *
 * **Example** (A Grok wrapper)
 *
 * ```ts
 * import { extractReportText } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const wrapper = JSON.stringify({ text: "", structuredOutput: { reviewer: "grok-4.7" } })
 * console.log(O.getOrElse(extractReportText({ route: "grok", text: wrapper }), () => "")) // {"reviewer":"grok-4.7"}
 * ```
 *
 * **Example** (A claude -p json envelope)
 *
 * ```ts
 * import { extractReportText } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const envelope = JSON.stringify({ type: "result", subtype: "success", is_error: false, result: 'Done.\n{"reviewer":"x"}' })
 * console.log(O.getOrElse(extractReportText({ route: "claude", text: envelope }), () => "")) // {"reviewer":"x"}
 * ```
 *
 * @param input - Reviewer route and its captured output, including any route-specific wrapper.
 * @returns The extracted report JSON text, or None when no report document can be located.
 * @category parsing
 * @since 0.0.0
 */
export const extractReportText = (input: { readonly route: CriticRoute; readonly text: string }): O.Option<string> => {
  const outermost = (text: string): O.Option<string> => {
    const start = O.getOrElse(Str.indexOf("{")(text), constant(-1));
    const end = O.getOrElse(Str.lastIndexOf("}")(text), constant(-1));
    return start >= 0 && end > start ? O.some(Str.slice(start, end + 1)(text)) : O.none();
  };
  const field = (value: unknown, key: string): O.Option<unknown> =>
    P.hasProperty(value, key) ? O.fromNullishOr(value[key]) : O.none();
  return Match.value(input.route).pipe(
    Match.when("codex", () => outermost(input.text)),
    Match.when("grok", () =>
      pipe(
        parseJson(input.text),
        O.flatMap((wrapper) =>
          field(wrapper, "structuredOutput").pipe(
            O.map((structured) => JSON.stringify(structured)),
            O.orElse(() => field(wrapper, "text").pipe(O.filter(P.isString), O.flatMap(outermost)))
          )
        ),
        O.orElse(() => outermost(input.text))
      )
    ),
    Match.when("claude", () =>
      pipe(
        claudeEvents(input.text),
        O.match({
          onNone: () => outermost(input.text),
          onSome: flow(
            // A lambda, not a direct ref: findLast's index must not reach the decoder as parse options.
            A.findLast((event: unknown) => decodeClaudeResult(event)),
            O.filter((event) => !event.is_error),
            O.flatMap((event) => event.result),
            O.flatMap(outermost)
          ),
        })
      )
    ),
    Match.when("cursor", () => outermost(input.text)),
    Match.exhaustive
  );
};

/**
 * The command line, working directory, and environment that run one reviewer
 * on a pack.
 *
 * **Details**
 *
 * Every route is read-only by instruction, and `codex` by sandbox. `claude`
 * runs with the session variables scrubbed so a nested session does not
 * believe it is this one, and with {@link CRITIC_CLAUDE_LIMITS} added where
 * the environment sets no cap of its own; `cursor-agent` runs inside its
 * sandbox with the repository's `.cursor/cli.json` deny list.
 *
 * **Gotchas**
 *
 * `packDir`, `reportPath`, and the `workspace` a synthetic-scope reviewer runs
 * in must be non-empty paths. The result is built with `CriticInvocation.make`,
 * which throws on an empty one instead of failing in a typed channel. The
 * critics run resolves every path before it calls this, so only a direct
 * caller can hit that throw.
 *
 * **Example** (The Grok route reads the schema inline)
 *
 * ```ts
 * import { CriticReviewer, criticInvocation } from "@beep/repo-cli/commands/Drawings"
 * import * as O from "effect/Option"
 *
 * const grok = CriticReviewer.make({ name: "grok-4.7", idPrefix: "G", route: "grok", model: "grok-4.7", effort: O.some("xhigh"), scope: "matter" })
 * const invocation = criticInvocation({ reviewer: grok, packDir: "/pack", prompt: "…", images: [], schemaPath: "/pack/findings.schema.json", schemaText: "{}", reportPath: "/loop/grok.json", workspace: O.none(), syntheticPack: O.none(), env: {} })
 * console.log(invocation.executable) // "grok"
 * ```
 *
 * @param input - Reviewer configuration, pack paths, prompt, attachments, workspace choices, and environment.
 * @returns The executable, arguments, working directory, environment, and report source for the selected reviewer route.
 * @category constructors
 * @since 0.0.0
 */
export const criticInvocation = (input: {
  readonly reviewer: CriticReviewer;
  readonly packDir: string;
  readonly prompt: string;
  readonly images: ReadonlyArray<string>;
  readonly schemaPath: string;
  readonly schemaText: string;
  readonly reportPath: string;
  readonly workspace: O.Option<string>;
  readonly syntheticPack: O.Option<string>;
  readonly env: Readonly<Record<string, string>>;
}): CriticInvocation => {
  const effort = O.getOrElse(input.reviewer.effort, () => "medium");
  const cwd = input.reviewer.scope === "synthetic" ? O.getOrElse(input.workspace, () => input.packDir) : input.packDir;
  const stdout = CriticReportSource.cases.stdout.make({ kind: "stdout" });
  return Match.value(input.reviewer.route).pipe(
    Match.when("codex", () =>
      CriticInvocation.make({
        executable: "codex",
        args: [
          "exec",
          "-m",
          input.reviewer.model,
          "-c",
          `model_reasoning_effort="${effort}"`,
          "-s",
          "read-only",
          "--skip-git-repo-check",
          "-C",
          cwd,
          ...A.flatMap(input.images, (image) => ["-i", image]),
          "--output-schema",
          input.schemaPath,
          "-o",
          input.reportPath,
          input.prompt,
        ],
        cwd,
        env: input.env,
        reportFrom: CriticReportSource.cases.file.make({ kind: "file", path: input.reportPath }),
      })
    ),
    Match.when("grok", () =>
      CriticInvocation.make({
        executable: "grok",
        args: [
          "-m",
          input.reviewer.model,
          "--effort",
          effort,
          "--permission-mode",
          "dontAsk",
          "--allow",
          "Read",
          "--allow",
          "Grep",
          "--deny",
          "Bash",
          "--deny",
          "Edit",
          "--deny",
          "MCPTool",
          "--deny",
          "WebFetch",
          "--deny",
          "WebSearch",
          "--disable-web-search",
          "--no-subagents",
          "--no-memory",
          "--sandbox",
          "strict",
          "--cwd",
          cwd,
          "--max-turns",
          "120",
          "--output-format",
          "json",
          "--json-schema",
          input.schemaText,
          "-p",
          input.prompt,
        ],
        cwd,
        env: input.env,
        reportFrom: stdout,
      })
    ),
    Match.when("claude", () =>
      CriticInvocation.make({
        executable: "claude",
        args: [
          "-p",
          "--model",
          input.reviewer.model,
          "--effort",
          effort,
          "--max-turns",
          "150",
          "--permission-mode",
          "dontAsk",
          "--permission-prompts",
          "none",
          "--restricted",
          "--tools",
          "Read",
          "--strict-mcp-config",
          "--mcp-config",
          '{"mcpServers":{}}',
          "--output-format",
          "json",
          input.prompt,
        ],
        cwd,
        // the seat's caps unless the operator's environment sets its own
        env: { ...CRITIC_CLAUDE_LIMITS, ...R.filter(input.env, (_, key) => !HashSet.has(SCRUBBED_ENV, key)) },
        reportFrom: stdout,
      })
    ),
    Match.when("cursor", () =>
      CriticInvocation.make({
        executable: "cursor-agent",
        args: [
          "-p",
          "--trust",
          "--force",
          "--sandbox",
          "enabled",
          "--workspace",
          cwd,
          ...O.match(input.syntheticPack, { onNone: A.empty<string>, onSome: (dir) => ["--add-dir", dir] }),
          "--model",
          input.reviewer.model,
          "--output-format",
          "text",
          input.prompt,
        ],
        cwd,
        env: input.env,
        reportFrom: stdout,
      })
    ),
    Match.exhaustive
  );
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * What the critic service does.
 *
 * @category services
 * @since 0.0.0
 */
export interface DrawingCriticsShape {
  readonly buildPack: (request: CriticPackRequest) => Effect.Effect<CriticPackManifest, DrawingsCommandError>;
  readonly runSequence: (request: CriticRunRequest) => Effect.Effect<CriticLoopRecord, DrawingsCommandError>;
  readonly summary: (loopDir: string) => Effect.Effect<string, DrawingsCommandError>;
}

const makeService = Effect.fn("DrawingCritics.make")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const tools = yield* PdfTools;
  const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;

  const imagesIn = Effect.fn("DrawingCritics.imagesIn")(function* (dir: string) {
    const names = yield* fs.readDirectory(dir).pipe(Effect.mapError(fail(`Could not list "${dir}".`)));
    return pipe(
      names,
      A.filter((name) => HashSet.has(IMAGE_EXTENSIONS, Str.toLowerCase(path.extname(name)))),
      A.sort(Order.String),
      A.map((name) => path.join(dir, name))
    );
  });

  const write = (file: string, text: string) =>
    fs.writeFileString(file, text).pipe(Effect.mapError(fail(`Could not write "${file}".`)));
  const read = (file: string) => fs.readFileString(file).pipe(Effect.mapError(fail(`Could not read "${file}".`)));
  const mkdir = (dir: string) =>
    fs.makeDirectory(dir, { recursive: true }).pipe(Effect.mapError(fail(`Could not create "${dir}".`)));
  const copy = (from: string, to: string) =>
    fs.copyFile(from, to).pipe(Effect.mapError(fail(`Could not copy "${from}".`)));

  // One poppler tool (pdftoppm, pdfinfo, pdffonts: the package pdf-tools already depends on); its stdout.
  const runPoppler = Effect.fnUntraced(function* (executable: string, args: ReadonlyArray<string>) {
    const handle = yield* spawner
      .spawn(ChildProcess.make(executable, args, { stdin: "ignore", stdout: "pipe", stderr: "pipe" }))
      .pipe(Effect.mapError(fail(`Could not run ${executable}; is poppler installed?`)));
    const [stdout, stderr, exitCode] = yield* Effect.all(
      [collectText(handle.stdout), collectText(handle.stderr), handle.exitCode],
      { concurrency: "unbounded" }
    ).pipe(Effect.mapError(fail(`${executable} did not finish.`)));
    if (exitCode !== 0) {
      return yield* DrawingsCommandError.make({ message: `${executable} exited ${exitCode}: ${Str.trim(stderr)}` });
    }
    return stdout;
  }, Effect.scoped);

  // A 300 dpi crop through pdftoppm.
  const cropZoom = (pdfPath: string, zoom: CriticZoom, outPrefix: string) =>
    runPoppler("pdftoppm", [
      "-r",
      `${ZOOM_DPI}`,
      "-png",
      "-f",
      `${zoom.figure}`,
      "-l",
      `${zoom.figure}`,
      "-x",
      `${zoom.x}`,
      "-y",
      `${zoom.y}`,
      "-W",
      `${zoom.width}`,
      "-H",
      `${zoom.height}`,
      pdfPath,
      outPrefix,
    ]);

  // The PDF facts a read-only reviewer cannot get itself: version, pages and their boxes, fonts, and
  // the streams a strict reader refuses.
  const measurePdf = Effect.fn("DrawingCritics.measurePdf")(function* (pdfPath: string) {
    const structure = yield* tools.inspect(pdfPath).pipe(Effect.mapError(fail(`Could not inspect "${pdfPath}".`)));
    const pageCount = A.length(structure.pages);
    const pages =
      pageCount === 0
        ? A.empty<CriticPdfPage>()
        : parsePdfInfoBoxes(yield* runPoppler("pdfinfo", ["-box", "-f", "1", "-l", `${pageCount}`, pdfPath]));
    const fonts = parsePdfFonts(yield* runPoppler("pdffonts", [pdfPath]));
    return CriticPdfMeasurements.make({
      file: "render/sheets.pdf",
      version: structure.headerVersion,
      pageCount,
      pages,
      fonts,
      undecodableStreams: structure.undecodableStreams,
      streamCheck: structure.streamCheck,
      containerDiscovery: structure.containerDiscovery,
    });
  });

  const copyContext = (packDir: string) =>
    Effect.fn("DrawingCritics.copyContext")(function* (dir: string) {
      yield* mkdir(path.join(packDir, "context"));
      const names = yield* fs.readDirectory(dir).pipe(Effect.mapError(fail(`Could not list "${dir}".`)));
      yield* Effect.forEach(names, (name) => copy(path.join(dir, name), path.join(packDir, "context", name)));
    });

  const buildPack = Effect.fn("DrawingCritics.buildPack")(function* (request: CriticPackRequest) {
    const manifestPath = path.resolve(request.manifestPath);
    const manifestDir = path.dirname(manifestPath);
    const manifest = yield* read(manifestPath).pipe(
      Effect.flatMap(decodeManifest),
      Effect.mapError(fail(`Could not decode the render manifest "${manifestPath}".`))
    );
    const packDir = path.resolve(request.outDir);
    const renderDir = path.join(packDir, "render");
    yield* mkdir(renderDir);
    const pdfPath = path.join(manifestDir, manifest.pdfFile);
    yield* copy(pdfPath, path.join(renderDir, "sheets.pdf"));
    yield* copy(manifestPath, path.join(renderDir, "manifest.json"));
    const svgs = yield* Effect.forEach(manifest.figures, (figure) =>
      copy(path.join(manifestDir, figure.svgFile), path.join(renderDir, figure.svgFile)).pipe(
        Effect.as(`render/${figure.svgFile}`)
      )
    );
    const sheets = yield* Effect.forEach(manifest.figures, (figure) =>
      tools
        .renderPng(
          PngRequest.make({
            pdfPath,
            page: figure.figure,
            dpi: SHEET_DPI,
            outputPath: path.join(renderDir, `pg-${figure.figure}.png`),
          })
        )
        .pipe(
          Effect.mapError(fail(`Could not render FIG. ${figure.figure}.`)),
          Effect.as(`render/pg-${figure.figure}.png`)
        )
    );
    const zooms = yield* Effect.forEach(request.zooms, (zoom) => {
      const prefix = path.join(renderDir, `zoom-${zoom.figure}-${zoom.label}`);
      // pdftoppm appends -<page> to the prefix; rename to the bare name.
      return cropZoom(pdfPath, zoom, prefix).pipe(
        Effect.andThen(
          fs
            .rename(`${prefix}-${zoom.figure}.png`, `${prefix}.png`)
            .pipe(Effect.mapError(fail(`Could not name the zoom "${prefix}.png".`)))
        ),
        Effect.as(`render/zoom-${zoom.figure}-${zoom.label}.png`)
      );
    });
    const figureSvgs = yield* Effect.forEach(manifest.figures, (figure) =>
      read(path.join(manifestDir, figure.svgFile)).pipe(
        Effect.map((svg) => ({
          figure: figure.figure,
          view: figure.view,
          svgFile: `render/${figure.svgFile}`,
          svg,
          coverage: JSON.stringify(O.getOrElse(figure.shadingCoverage, () => null)),
        }))
      )
    );
    yield* write(
      path.join(renderDir, "RENDER.md"),
      strokeTableMarkdown({
        title: manifest.title,
        sheetSetSha256: manifest.pdfSha256,
        specSha256: manifest.specSha256,
        figures: figureSvgs,
      })
    );
    const measurements = CriticMeasurements.make({
      schemaVersion: "drawing-critic-measurements/v1",
      title: manifest.title,
      sheetSetSha256: Sha256Hex.make(manifest.pdfSha256),
      specSha256: Sha256Hex.make(manifest.specSha256),
      pdf: yield* measurePdf(path.join(renderDir, "sheets.pdf")),
      figures: A.map(figureSvgs, (figure) => figureMeasurements(figure)),
    });
    const measurementsJson = yield* encodeCriticMeasurements(measurements).pipe(
      Effect.mapError(fail("Could not encode measurements.json."))
    );
    yield* write(path.join(renderDir, "measurements.json"), `${measurementsJson}\n`);
    yield* write(path.join(renderDir, "MEASUREMENTS.md"), measurementsMarkdown(measurements));
    const images = yield* Effect.forEach(
      request.imagesDirs,
      Effect.fnUntraced(function* (dir) {
        const name = path.basename(dir);
        yield* mkdir(path.join(packDir, "images", name));
        const files = yield* imagesIn(dir);
        return yield* Effect.forEach(files, (file) =>
          copy(file, path.join(packDir, "images", name, path.basename(file))).pipe(
            Effect.as(`images/${name}/${path.basename(file)}`)
          )
        );
      })
    ).pipe(Effect.map(A.flatten));
    yield* O.match(request.contextDir, { onNone: () => Effect.void, onSome: copyContext(packDir) });
    yield* copy(path.resolve(request.briefPath), path.join(packDir, "BRIEF.md"));
    yield* write(path.join(packDir, "findings.schema.json"), `${criticReportJsonSchema()}\n`);
    const pack = CriticPackManifest.make({
      schemaVersion: "drawing-critic-pack/v1",
      title: manifest.title,
      sheetSetSha256: Sha256Hex.make(manifest.pdfSha256),
      specSha256: Sha256Hex.make(manifest.specSha256),
      sheets,
      zooms,
      svgs,
      images,
      strokeTable: "render/RENDER.md",
      measurements: O.some("render/MEASUREMENTS.md"),
      brief: "BRIEF.md",
    });
    const json = yield* encodeCriticPackManifest(pack).pipe(Effect.mapError(fail("Could not encode pack.json.")));
    yield* write(path.join(packDir, "pack.json"), `${json}\n`);
    return pack;
  });

  const readPack = (packDir: string) =>
    read(path.join(packDir, "pack.json")).pipe(
      Effect.flatMap(decodeCriticPackManifest),
      Effect.mapError(fail(`"${packDir}" holds no readable pack.json; build the pack first.`))
    );

  const priorReports = Effect.fn("DrawingCritics.priorReports")(function* (loopDir: string) {
    const priorDir = path.join(loopDir, "prior");
    yield* mkdir(priorDir);
    const names = yield* fs.readDirectory(priorDir).pipe(Effect.mapError(fail(`Could not list "${priorDir}".`)));
    const files = pipe(
      names,
      A.filter((name) => Str.endsWith(name, ".json")),
      A.sort(Order.String)
    );
    return yield* Effect.forEach(files, (name) =>
      read(path.join(priorDir, name)).pipe(
        Effect.flatMap(decodeCriticReport),
        Effect.mapError(fail(`"${name}" is not a critic report.`))
      )
    );
  });

  // One reviewer CLI run: what it printed on stdout and stderr, and its exit code, or None when it ran past the
  // time limit (closing the scope stops the process: SIGTERM to its group, then SIGKILL if it is still alive 30
  // seconds later, so a seat that ignores SIGTERM cannot hold the sequence). The output gathers in Refs as it
  // arrives, which the interruption at the limit leaves alone, so a stopped seat still hands back what it printed.
  const runInvocation = Effect.fn("DrawingCritics.runInvocation")(function* (
    invocation: CriticInvocation,
    minutes: number
  ) {
    const handle = yield* spawner
      .spawn(
        ChildProcess.make(invocation.executable, invocation.args, {
          cwd: invocation.cwd,
          env: invocation.env,
          extendEnv: false,
          stdin: "ignore",
          stdout: "pipe",
          stderr: "pipe",
          forceKillAfter: "30 seconds",
        })
      )
      .pipe(Effect.mapError(fail(`Could not run ${invocation.executable}; is it installed and signed in?`)));
    const stdout = yield* Ref.make("");
    const stderr = yield* Ref.make("");
    const exited = yield* Effect.all(
      [collectInto(handle.stdout, stdout), collectInto(handle.stderr, stderr), handle.exitCode],
      { concurrency: "unbounded" }
    ).pipe(
      Effect.mapError(fail(`${invocation.executable} did not finish.`)),
      Effect.timeoutOption(`${minutes} minutes`)
    );
    return {
      stdout: yield* Ref.get(stdout),
      stderr: yield* Ref.get(stderr),
      exitCode: O.map(exited, ([, , exitCode]) => exitCode),
    };
  }, Effect.scoped);

  // The record of a seat that ended without a report: why, and when.
  const stoppedRun = Effect.fn("DrawingCritics.stoppedRun")(function* (input: {
    readonly order: number;
    readonly reviewer: CriticReviewer;
    readonly startedAt: string;
    readonly exitCode: number;
    readonly stop: CriticSeatUnavailable;
  }) {
    const { name } = input.reviewer;
    yield* Effect.logWarning(
      `critics: ${name} ${seatOutcome(input.stop).line}: ${input.stop.detail}; what it printed is in ${name}.log and ${name}.raw; continuing with the remaining reviewers.`
    );
    return CriticRunRecord.make({
      order: input.order,
      reviewer: input.reviewer,
      exitCode: input.exitCode,
      report: O.none(),
      reportSha256: O.none(),
      findings: 0,
      startedAt: input.startedAt,
      finishedAt: DateTime.formatIso(yield* DateTime.now),
      unavailable: O.some(input.stop),
    });
  });

  // A seat that exited: a recognised stop or its report.
  const recordRun = Effect.fn("DrawingCritics.recordRun")(function* (input: {
    readonly order: number;
    readonly reviewer: CriticReviewer;
    readonly startedAt: string;
    readonly invocation: CriticInvocation;
    readonly loopDir: string;
    readonly reportPath: string;
    readonly output: { readonly stdout: string; readonly stderr: string; readonly exitCode: number };
  }) {
    const { reviewer, loopDir, output } = input;
    const stop = seatStop(reviewer.route, output);
    if (O.isSome(stop)) {
      return yield* stoppedRun({ ...input, exitCode: output.exitCode, stop: stop.value });
    }
    const rawReport = yield* CriticReportSource.match(input.invocation.reportFrom, {
      file: ({ path: file }) =>
        fs.exists(file).pipe(
          Effect.mapError(fail(`Could not stat "${file}".`)),
          Effect.flatMap((exists) => (exists ? read(file).pipe(Effect.asSome) : Effect.succeedNone))
        ),
      stdout: () => Effect.succeedSome(output.stdout),
    });
    const report = yield* pipe(
      rawReport,
      O.flatMap((text) => extractReportText({ route: reviewer.route, text })),
      O.match({
        onNone: () => Effect.succeedNone,
        onSome: (text) =>
          decodeCriticReport(text).pipe(
            Effect.asSome,
            Effect.catchCause((cause) =>
              Effect.logWarning(`${reviewer.name} returned a document that is not a critic report.`, cause).pipe(
                Effect.as(O.none<CriticReport>())
              )
            )
          ),
      })
    );
    const finishedAt = DateTime.formatIso(yield* DateTime.now);
    const persist = Effect.fn("DrawingCritics.persistReport")(function* (r: CriticReport) {
      const json = yield* encodeCriticReport(r).pipe(Effect.mapError(fail("Could not encode the report.")));
      yield* write(input.reportPath, `${json}\n`);
      yield* write(path.join(loopDir, "prior", `${input.order}-${reviewer.name}.json`), `${json}\n`);
      const sha = yield* sha256(encoder.encode(`${json}\n`));
      return { file: O.some(`${reviewer.name}.json`), sha: O.some(sha), findings: A.length(r.findings) };
    });
    const written = yield* O.match(report, {
      onNone: () => Effect.succeed({ file: O.none<string>(), sha: O.none<Sha256Hex>(), findings: 0 }),
      onSome: persist,
    });
    return CriticRunRecord.make({
      order: input.order,
      reviewer,
      exitCode: output.exitCode,
      report: written.file,
      reportSha256: written.sha,
      findings: written.findings,
      startedAt: input.startedAt,
      finishedAt,
    });
  });

  const runReviewer = Effect.fn("DrawingCritics.runReviewer")(function* (input: {
    readonly request: CriticRunRequest;
    readonly pack: CriticPackManifest;
    readonly reviewer: CriticReviewer;
    readonly order: number;
    readonly template: string;
    readonly extra: O.Option<string>;
    // The runs of this loop so far, so the summary names a seat that could not run.
    readonly earlier: ReadonlyArray<CriticRunRecord>;
  }) {
    const { request, reviewer, pack } = input;
    const packDir = path.resolve(request.packDir);
    const loopDir = path.resolve(request.loopDir);
    const prior = yield* priorReports(loopDir);
    const startedAt = DateTime.formatIso(yield* DateTime.now);
    const prompt = yield* Match.value(reviewer.scope).pipe(
      Match.when(
        "matter",
        Effect.fnUntraced(function* () {
          yield* mkdir(path.join(packDir, "prior"));
          yield* write(
            path.join(packDir, "prior", "SUMMARY.md"),
            loopSummaryMarkdown({ reports: prior, runs: input.earlier })
          );
          const measured = O.match(pack.measurements, {
            onNone: () => "",
            onSome: (file) =>
              ` ${file} (the same numbers in measurements.json beside it) holds what the harness measured: the PDF version, page boxes, fonts and undecodable streams, and per figure the ink box against the 1.84(g) margins, the path layers, the shading statistics and the text labels. Read it before you measure anything yourself.`,
          });
          const hint = Match.value(reviewer.route).pipe(
            Match.when(
              "codex",
              () =>
                `The images attached to this message are, in order: ${A.join([...pack.sheets, ...pack.zooms, ...pack.images], ", ")}.${measured}`
            ),
            Match.when(
              "grok",
              () =>
                `Use your file tools to read the files named above (paths are relative to the current directory) and to look at the PNG and JPG images if you can; the SVGs and render/RENDER.md carry the same shading geometry as numbers.${measured}`
            ),
            Match.when("claude", () =>
              O.match(pack.measurements, {
                onNone: () =>
                  "Use the Read tool to view the PNG and JPG images and the text files. The SVGs and render/RENDER.md carry the shading geometry as numbers.",
                onSome: () =>
                  `Use the Read tool to view the PNG and JPG images and the text files. The SVGs and render/RENDER.md carry the shading geometry as numbers. You cannot run pdfinfo, pdffonts or any other tool here.${measured}`,
              })
            ),
            Match.when(
              "cursor",
              () =>
                `Read the files named above; the SVGs and render/RENDER.md carry the shading geometry as numbers.${measured}`
            ),
            Match.exhaustive
          );
          return A.join(
            [
              input.template,
              `You are reviewer "${reviewer.name}": ids ${reviewer.idPrefix}-01, ${reviewer.idPrefix}-02, …`,
              hint,
              CRITIC_HARD_RULES,
              O.getOrElse(input.extra, () => ""),
            ],
            "\n"
          );
        })
      ),
      Match.when(
        "synthetic",
        Effect.fnUntraced(function* () {
          const syntheticPack = yield* Effect.fromOption(request.syntheticPack).pipe(
            Effect.mapError(() =>
              DrawingsCommandError.make({
                message: `Reviewer "${reviewer.name}" has synthetic scope; pass --synthetic-pack.`,
              })
            )
          );
          yield* write(path.join(syntheticPack, "prior-ids.md"), priorIdsMarkdown(prior));
          const brief = yield* read(path.join(syntheticPack, "BRIEF-synthetic.md"));
          return A.join([brief, CRITIC_HARD_RULES], "\n");
        })
      ),
      Match.exhaustive
    );
    const schemaText = criticReportJsonSchema();
    const reportPath = path.join(loopDir, `${reviewer.name}.json`);
    const invocation = criticInvocation({
      reviewer,
      packDir,
      prompt,
      images: A.map([...pack.sheets, ...pack.zooms, ...pack.images], (file) => path.join(packDir, file)),
      schemaPath: path.join(packDir, "findings.schema.json"),
      schemaText,
      reportPath,
      workspace: request.workspace,
      syntheticPack: request.syntheticPack,
      env: processEnvironment(),
    });
    const { stdout, stderr, exitCode } = yield* runInvocation(invocation, request.timeoutMinutes);
    // What the seat printed is kept beside its record however it ended, so a seat stopped at its time limit
    // leaves what it printed before then. Only a seat that exited is read for a report.
    yield* write(path.join(loopDir, `${reviewer.name}.log`), stderr);
    yield* write(path.join(loopDir, `${reviewer.name}.raw`), stdout);
    const seat = { order: input.order, reviewer, startedAt };
    // A seat stopped at its time limit is recorded like one that could not start, and the sequence goes on.
    return yield* O.match(exitCode, {
      onNone: () =>
        stoppedRun({ ...seat, exitCode: CRITIC_TIME_LIMIT_EXIT_CODE, stop: timeLimitSeat(request.timeoutMinutes) }),
      onSome: (code) =>
        recordRun({ ...seat, invocation, loopDir, reportPath, output: { stdout, stderr, exitCode: code } }),
    });
  });

  const runSequence = Effect.fn("DrawingCritics.runSequence")(function* (request: CriticRunRequest) {
    const packDir = path.resolve(request.packDir);
    const loopDir = path.resolve(request.loopDir);
    const pack = yield* readPack(packDir);
    yield* mkdir(path.join(loopDir, "prior"));
    const repoRoot = yield* findRepoRoot().pipe(
      Effect.provideService(FileSystem.FileSystem, fs),
      Effect.mapError(fail("Could not find the repository root."))
    );
    const template = yield* read(path.join(repoRoot, DRAWING_CRITIC_PROMPT_TEMPLATE));
    const extraPath = path.join(loopDir, "extra.md");
    const extra = yield* fs.exists(extraPath).pipe(
      Effect.mapError(fail(`Could not stat "${extraPath}".`)),
      Effect.flatMap((exists) => (exists ? read(extraPath).pipe(Effect.asSome) : Effect.succeedNone))
    );
    // Each seat runs after the ones before it and reads their runs, so a seat that could not run is named.
    const runs = yield* Effect.reduce(
      request.reviewers,
      (): ReadonlyArray<CriticRunRecord> => A.empty(),
      Effect.fnUntraced(function* (earlier, reviewer, index) {
        yield* Effect.logInfo(
          `critics: ${index + 1}/${A.length(request.reviewers)} ${reviewer.name} (${reviewer.route})`
        );
        const run = yield* runReviewer({ request, pack, reviewer, order: index + 1, template, extra, earlier });
        yield* Effect.logInfo(`critics: ${criticRunLine(run)}`);
        return A.append(earlier, run);
      })
    );
    const record = CriticLoopRecord.make({
      schemaVersion: "drawing-critic-loop/v1",
      loop: request.loop,
      sheetSetSha256: pack.sheetSetSha256,
      runs,
    });
    const json = yield* encodeCriticLoopRecord(record).pipe(Effect.mapError(fail("Could not encode loop.json.")));
    yield* write(path.join(loopDir, "loop.json"), `${json}\n`);
    const all = yield* priorReports(loopDir);
    yield* write(path.join(loopDir, "ALL-FINDINGS.md"), loopSummaryMarkdown({ reports: all, runs }));
    return record;
  });

  // The runs of a finished loop, when its loop.json exists.
  const loopRuns = Effect.fn("DrawingCritics.loopRuns")(function* (loopDir: string) {
    const loopPath = path.join(loopDir, "loop.json");
    const exists = yield* fs.exists(loopPath).pipe(Effect.mapError(fail(`Could not stat "${loopPath}".`)));
    return exists
      ? yield* read(loopPath).pipe(
          Effect.flatMap(decodeCriticLoopRecord),
          Effect.mapBoth({
            onFailure: fail(`"${loopPath}" is not a critic loop record.`),
            onSuccess: (record) => record.runs,
          })
        )
      : A.empty<CriticRunRecord>();
  });

  const summary = Effect.fn("DrawingCritics.summary")(function* (loopDir: string) {
    const dir = path.resolve(loopDir);
    const reports = yield* priorReports(dir);
    return loopSummaryMarkdown({ reports, runs: yield* loopRuns(dir) });
  });

  return { buildPack, runSequence, summary } satisfies DrawingCriticsShape;
});

// The process environment as a string record; undefined entries dropped. The
// reviewers are external CLIs that read their own sign-in from it.
const processEnvironment = (): Readonly<Record<string, string>> =>
  R.filterMap(
    (globalThis as unknown as { readonly process?: { readonly env?: Readonly<Record<string, string | undefined>> } })
      .process?.env ?? {},
    (value) => (P.isString(value) ? Result.succeed(value) : Result.fail(undefined))
  );

/**
 * The critic-loop service.
 *
 * **Example** (Reference the service)
 *
 * ```ts
 * import { DrawingCritics } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(DrawingCritics)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class DrawingCritics extends Context.Service<DrawingCritics, DrawingCriticsShape>()($I`DrawingCritics`) {
  /**
   * Live layer over PDF tools, the file system, paths, and a process spawner.
   *
   * **Example** (Reference the layer)
   *
   * ```ts
   * import { DrawingCritics } from "@beep/repo-cli/commands/Drawings"
   *
   * console.log(DrawingCritics.layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<
    DrawingCritics,
    never,
    PdfTools | FileSystem.FileSystem | Path.Path | ChildProcessSpawner.ChildProcessSpawner
  > = Layer.effect(DrawingCritics, Effect.map(makeService(), DrawingCritics.of));
}

/**
 * The five-reviewer sequence the operator ruled on 2026-10-14, in order:
 * Codex gpt-6-astra, Grok 4.7, Claude Fable 5.1, Kimi K3 (synthetic scope),
 * Claude Opus 5.5, every route at its highest effort.
 *
 * **Example** (The default order)
 *
 * ```ts
 * import { DEFAULT_CRITIC_REVIEWERS } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(DEFAULT_CRITIC_REVIEWERS.map((r) => r.idPrefix)) // ["A", "G", "F", "K", "O"]
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DEFAULT_CRITIC_REVIEWERS: ReadonlyArray<CriticReviewer> = [
  CriticReviewer.make({
    name: "codex-gpt-6-astra",
    idPrefix: "A",
    route: "codex",
    model: "gpt-6-astra",
    effort: O.some("xhigh"),
    scope: "matter",
  }),
  CriticReviewer.make({
    name: "grok-4.7",
    idPrefix: "G",
    route: "grok",
    model: "grok-4.7",
    effort: O.some("xhigh"),
    scope: "matter",
  }),
  CriticReviewer.make({
    name: "claude-fable-5.1",
    idPrefix: "F",
    route: "claude",
    model: "claude-fable-5-1",
    effort: O.some("xhigh"),
    scope: "matter",
  }),
  CriticReviewer.make({
    name: "kimi-k3",
    idPrefix: "K",
    route: "cursor",
    model: "kimi-k3-max",
    effort: O.none(),
    scope: "synthetic",
  }),
  CriticReviewer.make({
    name: "claude-opus-5.5",
    idPrefix: "O",
    route: "claude",
    model: "claude-opus-5-5",
    effort: O.some("xhigh"),
    scope: "matter",
  }),
];

/**
 * Resolve `--reviewers` names against the default sequence.
 *
 * **Example** (Two of the five)
 *
 * ```ts
 * import { selectReviewers } from "@beep/repo-cli/commands/Drawings"
 * import * as Effect from "effect/Effect"
 *
 * Effect.runPromise(selectReviewers(["grok-4.7", "claude-opus-5.5"])).then((rs) => console.log(rs.length)) // 2
 * ```
 *
 * @param names - Reviewer names in the desired execution order; every name must match a default reviewer.
 * @returns An effect yielding reviewers in requested order, or a command error naming an unknown reviewer.
 * @category constructors
 * @since 0.0.0
 */
export const selectReviewers = (
  names: ReadonlyArray<string>
): Effect.Effect<ReadonlyArray<CriticReviewer>, DrawingsCommandError> =>
  Effect.forEach(names, (name) =>
    Effect.fromOption(A.findFirst(DEFAULT_CRITIC_REVIEWERS, (reviewer) => reviewer.name === name)).pipe(
      Effect.mapError(() =>
        DrawingsCommandError.make({
          message: `"${name}" is not a known reviewer; known: ${A.join(
            A.map(DEFAULT_CRITIC_REVIEWERS, (r) => r.name),
            ", "
          )}.`,
        })
      )
    )
  );
