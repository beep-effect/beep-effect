/**
 * The console service: one renderer for every gate. It dispatches a report
 * to the model's console document, fits it to the budget, maps its lines
 * onto `@beep/cli-kit` documents and renders them for the audience: the
 * plain agent projection, or the terminal projection with colour and a live
 * progress line rewritten in place.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { Doc } from "@beep/cli-kit/Doc";
import { Render } from "@beep/cli-kit/Render";
import {
  CapLine,
  ConsoleBudget,
  ConsoleDocument,
  ConsoleEntry,
  PointerTable,
  RecordPaths,
  RunDelta,
} from "@beep/gate-report/ConsoleDocument";
import { ConsoleInput, dispatch } from "@beep/gate-report/Dispatch";
import { formatDuration } from "@beep/gate-report/Format";
import { GateReport } from "@beep/gate-report/GateReport";
import { fitDocument, projectLines } from "@beep/gate-report/PlainText";
import { Count, DurationMs, Text } from "@beep/gate-report/Scalars";
import { RunReason } from "@beep/gate-report/Vocabulary";
import { $RepoGateRunId } from "@beep/identity/packages";
import { AudienceKind } from "@beep/runtime-env/Audience";
import { ColorLevel } from "@beep/runtime-env/ColorLevel";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { foldFixesFor } from "./ConsoleDefaults.ts";
import { ProjectionKind, projectionFor } from "./GateAudience.ts";
import { Omission, omissionLines } from "./Omission.ts";
import { repoPointerTable } from "./RepoPointers.ts";
import type { TokenName } from "@beep/cli-kit/Token";

const $I = $RepoGateRunId.create("GateConsole");

/**
 * The agent console budget: 8,000 characters for the whole console, 240 per
 * line, 12 diff lines per failure entry.
 *
 * **Details**
 *
 * Claude Code keeps about 10,000 characters of a failing command inline and
 * Codex cuts the middle of a larger output, so 8,000 leaves 2,000 for what
 * prints outside the renderer in the same command.
 *
 * **Example** (Read the budget)
 *
 * ```ts
 * import { agentBudget } from "@beep/repo-gate-run/GateConsole";
 *
 * console.log(agentBudget.maxChars); // 8000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const agentBudget: ConsoleBudget = ConsoleBudget.make({ maxChars: 8000, maxLineChars: 240, maxDiffLines: 12 });

/**
 * The ANSI sequence that returns to the start of the line and clears it,
 * which rewrites the live progress line in place.
 *
 * **Example** (Read the sequence length)
 *
 * ```ts
 * import { CLEAR_LINE } from "@beep/repo-gate-run/GateConsole";
 *
 * console.log(CLEAR_LINE.length); // 5
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CLEAR_LINE = "\r\u001b[2K";

/**
 * How the console renders: for whom, at what colour level, under which
 * budget and with which pointer table.
 *
 * **Details**
 *
 * The budget defaults to the agent budget and the pointer table to the
 * repo's. The colour level only paints the terminal projection.
 *
 * **Example** (Settings for an agent)
 *
 * ```ts
 * import { ConsoleSettings } from "@beep/repo-gate-run/GateConsole";
 *
 * console.log(ConsoleSettings.make({ audience: "agent" }).budget.maxChars); // 8000
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ConsoleSettings extends S.Opaque<ConsoleSettings, { readonly brand: unique symbol }>()(
  S.Struct({
    audience: AudienceKind,
    color: ColorLevel.pipe(S.withConstructorDefault(Effect.succeed("none" as const))),
    budget: ConsoleBudget.pipe(S.withConstructorDefault(Effect.succeed(agentBudget))),
    pointers: PointerTable.pipe(S.withConstructorDefault(Effect.succeed(repoPointerTable))),
  }).pipe(
    $I.annoteSchema("ConsoleSettings", {
      description: "For whom the console renders, its colour level, its budget and its pointer table.",
    })
  )
) {}

/**
 * What one console renders: the report, where its record and log were
 * written, the delta history gave, and what could not be written or read.
 *
 * **Details**
 *
 * `pointers`, when given, replaces the settings' pointer table for this
 * console: the caller pins the next-step commands to the record it wrote.
 *
 * **Example** (Request a console)
 *
 * ```ts
 * import { GateReport, Totals } from "@beep/gate-report/GateReport";
 * import { ConsoleRequest } from "@beep/repo-gate-run/GateConsole";
 * import * as DateTime from "effect/DateTime";
 *
 * const report = GateReport.make({
 *   gate: "test", subject: "@beep/glob", itemKind: "test", runId: "r1",
 *   startedAt: DateTime.makeUnsafe(0), durationMs: 0, inputFingerprint: "x",
 *   reason: "passed", outcome: "all-pass", units: [], items: [], totals: Totals.make({ collected: 1, passed: 1 }),
 * });
 * console.log(ConsoleRequest.make({ report }).omissions.length); // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ConsoleRequest extends S.Opaque<ConsoleRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    report: GateReport,
    paths: S.OptionFromOptionalKey(RecordPaths).pipe(S.withConstructorDefault(Effect.succeedNone)),
    delta: S.OptionFromOptionalKey(RunDelta).pipe(S.withConstructorDefault(Effect.succeedNone)),
    omissions: S.Array(Omission).pipe(S.withConstructorDefault(Effect.succeed([]))),
    pointers: S.OptionFromOptionalKey(PointerTable).pipe(S.withConstructorDefault(Effect.succeedNone)),
  }).pipe(
    $I.annoteSchema("ConsoleRequest", {
      description:
        "A report with its record paths, history delta, omissions and pointer table, to render as one console.",
    })
  )
) {}

/**
 * **Example** (Build an output)
 *
 * ```ts
 * import { ConsoleOutput } from "@beep/repo-gate-run/GateConsole";
 *
 * console.log(ConsoleOutput.make({ projection: "agent", text: "test @beep/glob: PASSED" }).projection); // agent
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ConsoleOutput extends S.Opaque<ConsoleOutput, { readonly brand: unique symbol }>()(
  S.Struct({
    projection: ProjectionKind,
    text: S.String,
  }).pipe(
    $I.annoteSchema("ConsoleOutput", {
      description: "A rendered console: its projection and the text to write.",
    })
  )
) {}

/**
 * Where a running gate is: what it has finished and failed so far, and how
 * long it has run.
 *
 * **Example** (Build a snapshot)
 *
 * ```ts
 * import { ProgressSnapshot } from "@beep/repo-gate-run/GateConsole";
 *
 * console.log(ProgressSnapshot.make({ gate: "test", subject: "@beep/glob", done: 12, failed: 1, elapsedMs: 3400 }).done); // 12
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class ProgressSnapshot extends S.Opaque<ProgressSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    gate: Text,
    subject: Text,
    done: Count,
    failed: Count,
    elapsedMs: DurationMs,
  }).pipe(
    $I.annoteSchema("ProgressSnapshot", {
      description: "A running gate's finished and failed counts and elapsed time.",
    })
  )
) {}

type Tone = O.Option<TokenName>;

const tone = (name: TokenName): Tone => O.some(name);
const plain: Tone = O.none();

const verdictTone = (reason: RunReason): Tone =>
  tone(
    RunReason.match(reason, {
      passed: (): TokenName => "success",
      failed: (): TokenName => "failure",
      errored: (): TokenName => "error",
      cancelled: (): TokenName => "warning",
    })
  );

const diffTone = (line: string): Tone =>
  pipe(
    O.as(O.liftPredicate(line, Str.startsWith("+")), "success" as const),
    O.orElse(() => O.as(O.liftPredicate(line, Str.startsWith("-")), "failure" as const))
  );

const entryTones =
  (budget: ConsoleBudget) =>
  (entry: ConsoleEntry): ReadonlyArray<Tone> =>
    ConsoleEntry.match(entry, {
      FailureEntry: (failure) => [
        tone("failure"),
        ...A.fromOption(O.as(failure.message, plain)),
        ...A.map(A.take(failure.diff, budget.maxDiffLines), diffTone),
      ],
      NoteEntry: (note) => A.map(note.lines, () => tone("warning")),
    });

const bodyTones = (document: ConsoleDocument, budget: ConsoleBudget): ReadonlyArray<Tone> => [
  ...A.flatMap(document.entries, entryTones(budget)),
  ...A.map(document.folds, () => tone("warning")),
  ...A.fromOption(O.as(document.cap, tone("muted"))),
  ...A.fromOption(O.as(document.delta, tone("muted"))),
  ...A.fromOption(O.as(document.path, tone("muted"))),
  ...A.fromOption(O.as(document.pointer, tone("accent"))),
];

const fitNotice =
  (budget: ConsoleBudget) =>
  (text: string): string => {
    const line = Str.replace(/[\u0000-\u001f\u007f]/gu, " ")(text);
    return line.length <= budget.maxLineChars ? line : `${Str.takeLeft(line, budget.maxLineChars - 3)}...`;
  };

const sizeOf = (lines: ReadonlyArray<string>): number => A.reduce(lines, 0, (total, line) => total + line.length + 1);

type Fit = { readonly document: ConsoleDocument; readonly budget: ConsoleBudget };

const frameOnly = (document: ConsoleDocument): ConsoleDocument => {
  const dropped = A.filter(document.entries, ConsoleEntry.guards.FailureEntry).length + document.folds.length;
  return ConsoleDocument.make({
    ...document,
    entries: [],
    folds: [],
    cap: dropped > 0 ? CapLine.makeOption({ dropped }) : O.none(),
  });
};

const reservedFit = (document: ConsoleDocument, budget: ConsoleBudget, notices: ReadonlyArray<string>): Fit =>
  A.isReadonlyArrayEmpty(notices)
    ? { document, budget }
    : pipe(
        ConsoleBudget.makeOption({
          ...budget,
          maxChars: budget.maxChars - sizeOf(notices) - (budget.maxLineChars + 1),
        }),
        O.match({
          onSome: (reserved): Fit => ({ document, budget: reserved }),
          onNone: (): Fit => ({ document: frameOnly(document), budget }),
        })
      );

type TonedLine = { readonly text: string; readonly tone: Tone };

const consoleLines = (settings: ConsoleSettings, request: ConsoleRequest): ReadonlyArray<TonedLine> => {
  const notices = A.map(omissionLines(request.omissions), fitNotice(settings.budget));
  const dispatched = dispatch(
    ConsoleInput.make({
      report: request.report,
      pointers: O.getOrElse(request.pointers, () => settings.pointers),
      fixes: foldFixesFor(request.report.subject),
      paths: request.paths,
      delta: request.delta,
    })
  );
  const { document, budget } = reservedFit(dispatched, settings.budget, notices);
  const lines = projectLines({ document, budget });
  const verdict: TonedLine = { text: lines[0] ?? "", tone: verdictTone(request.report.reason) };
  const body = A.zipWith(
    A.drop(A.dropRight(lines, 1), 1),
    bodyTones(fitDocument({ document, budget }), budget),
    (text, tone) => ({
      text,
      tone,
    })
  );
  const middle = [...body, ...A.map(notices, (text) => ({ text, tone: tone("warning") }))];
  return A.isReadonlyArrayNonEmpty(middle) ? [verdict, ...middle, verdict] : [verdict];
};

const toDoc = (lines: ReadonlyArray<TonedLine>) =>
  A.map(lines, (line) => Doc.line(Doc.text(line.text, O.getOrUndefined(line.tone)), { wrap: false }));

const progressText = (snapshot: ProgressSnapshot): string =>
  `${snapshot.gate} ${snapshot.subject}: running, ${snapshot.done} done, ${snapshot.failed} failed (${formatDuration(snapshot.elapsedMs)})`;

/**
 * The console service's operations.
 *
 * **Details**
 *
 * `render` gives the whole console of a finished run: for the agent
 * projection the plain lines, for the terminal projection the same lines
 * painted, after a sequence that clears the progress line. `progress` gives
 * one progress frame to write without a newline, for the terminal projection
 * only; the agent projection prints nothing while a gate runs.
 *
 * **Gotchas**
 *
 * `render` never drops an omission notice to fit the budget: the notices,
 * and the closing verdict a lone verdict line gains beside them, are taken
 * off the budget before the body is fitted. When the rest is too small to be
 * a budget, the body goes and the frame (both verdict lines, cap, delta, path
 * and pointer) stays, with the cap counting the failure entries and folds
 * dropped; the frame and two notices are eight lines, which every budget holds.
 *
 * **Example** (Use the shape)
 *
 * ```ts
 * import type { GateConsoleShape } from "@beep/repo-gate-run/GateConsole";
 *
 * const renderOf = (console: GateConsoleShape) => console.render;
 * console.log(typeof renderOf); // function
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface GateConsoleShape {
  readonly progress: (snapshot: ProgressSnapshot) => O.Option<string>;
  readonly render: (request: ConsoleRequest) => ConsoleOutput;
}

/**
 * Build the console operations for some settings.
 *
 * **Example** (Render a green agent console)
 *
 * ```ts
 * import { GateReport, Totals } from "@beep/gate-report/GateReport";
 * import { ConsoleRequest, ConsoleSettings, makeGateConsole } from "@beep/repo-gate-run/GateConsole";
 * import * as DateTime from "effect/DateTime";
 *
 * const report = GateReport.make({
 *   gate: "test", subject: "@beep/glob", itemKind: "test", runId: "r1",
 *   startedAt: DateTime.makeUnsafe(0), durationMs: 10, inputFingerprint: "x",
 *   reason: "passed", outcome: "all-pass", units: [], items: [], totals: Totals.make({ collected: 3, passed: 3 }),
 * });
 * const console_ = makeGateConsole(ConsoleSettings.make({ audience: "agent" }));
 * console.log(console_.render(ConsoleRequest.make({ report })).text); // test @beep/glob: PASSED, 3/3 passed (10ms)
 * ```
 *
 * @param settings - the audience, colour level, budget and pointer table to render with
 * @returns the render and progress operations for those settings
 * @category constructors
 * @since 0.0.0
 */
export const makeGateConsole = (settings: ConsoleSettings): GateConsoleShape => {
  const projection = projectionFor(settings.audience);
  const terminal = Render.contextOf({ audience: "human", color: settings.color });
  const agent = Render.contextOf({ audience: settings.audience });
  return {
    render: (request) => {
      const doc = toDoc(consoleLines(settings, request));
      return ConsoleOutput.make({
        projection,
        text: ProjectionKind.match(projection, {
          agent: () => Render.plain(doc, agent),
          terminal: () => `${CLEAR_LINE}${Render.ansi(doc, terminal)}`,
        }),
      });
    },
    progress: (snapshot) =>
      O.as(
        O.liftPredicate(projection, ProjectionKind.is.terminal),
        `${CLEAR_LINE}${Render.ansi(toDoc([{ text: progressText(snapshot), tone: tone("muted") }]), terminal)}`
      ),
  };
};

/**
 * The console service.
 *
 * **Example** (Provide a terminal console)
 *
 * ```ts
 * import { ConsoleSettings, GateConsole } from "@beep/repo-gate-run/GateConsole";
 * import * as Layer from "effect/Layer";
 *
 * console.log(Layer.isLayer(GateConsole.layer(ConsoleSettings.make({ audience: "human", color: "basic" })))); // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GateConsole extends Context.Service<GateConsole, GateConsoleShape>()($I`GateConsole`) {
  /**
   * The console for some settings.
   *
   * **Example** (Provide an agent console)
   *
   * ```ts
   * import { ConsoleSettings, GateConsole } from "@beep/repo-gate-run/GateConsole";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(GateConsole.layer(ConsoleSettings.make({ audience: "agent" })))); // true
   * ```
   *
   * @param settings - for whom, at what colour, under which budget and pointer table
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = (settings: ConsoleSettings): Layer.Layer<GateConsole> =>
    Layer.succeed(GateConsole, GateConsole.of(makeGateConsole(settings)));
}
