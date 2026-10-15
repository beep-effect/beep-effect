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
import { flow, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { collectText } from "../../internal/process/StepExec.ts";
import {
  CriticLoopRecord,
  CriticPackManifest,
  CriticReviewer,
  CriticRunRecord,
  CriticZoom,
  criticReportJsonSchema,
  decodeCriticPackManifest,
  decodeCriticReport,
  encodeCriticLoopRecord,
  encodeCriticPackManifest,
  encodeCriticReport,
} from "./Drawings.critics.schemas.ts";
import { DrawingsCommandError } from "./Drawings.errors.ts";
import type { CriticReport, CriticRoute } from "./Drawings.critics.schemas.ts";

const $I = $RepoCliId.create("commands/Drawings/Drawings.critics");

const decodeManifest = S.decodeEffect(S.fromJsonString(RenderManifest));
const sha256 = flow(sha256Hex, Effect.map(Sha256Hex.make));
const fail = (message: string) => (cause: unknown) => DrawingsCommandError.new(cause, message);
const encoder = new TextEncoder();

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
const PT_PER_MM = 72 / 25.4;
const SHADING_STROKE_PT = "0.567";
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

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests)
// ---------------------------------------------------------------------------

/**
 * A reviewer's invocation: what to spawn, where, with which environment, and
 * how its report comes back.
 *
 * @category models
 * @since 0.0.0
 */
export interface CriticInvocation {
  readonly args: ReadonlyArray<string>;
  readonly cwd: string;
  readonly env: Readonly<Record<string, string>>;
  readonly executable: string;
  /** Where the route writes its report: a file it was told to write, or its stdout. */
  readonly reportFrom: { readonly kind: "file"; readonly path: string } | { readonly kind: "stdout" };
}

// The stroke row of one drawn segment of the shading path, in sheet millimetres; none for a zero-length segment.
const rowOf = (from: readonly [number, number], to: readonly [number, number]): O.Option<StrokeRow> => {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.hypot(dx, dy);
  if (!(length > 0)) {
    return O.none();
  }
  const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 180) % 180;
  const normal = angle >= 90 ? ([dy / length, -dx / length] as const) : ([-dy / length, dx / length] as const);
  return O.some({
    angle: round(angle, 1),
    offset: round(x1 * normal[0] + y1 * normal[1], 2),
    length: round(length, 2),
    x1: round(x1, 1),
    y1: round(y1, 1),
    x2: round(x2, 1),
    y2: round(y2, 1),
  });
};

// The stroke rows of a shading path's move/line data: each line command draws from the current point.
const rowsOfPath = (data: string): ReadonlyArray<StrokeRow> =>
  pipe(
    A.fromIterable(data.matchAll(/([ML])\s*([-\d.]+)[ ,]([-\d.]+)/g)),
    A.reduce(
      { current: O.none<readonly [number, number]>(), rows: A.empty<StrokeRow>() },
      (
        state: { readonly current: O.Option<readonly [number, number]>; readonly rows: ReadonlyArray<StrokeRow> },
        m
      ) => {
        const point = [Number(m[2]) / PT_PER_MM, Number(m[3]) / PT_PER_MM] as const;
        if (m[1] === "M") {
          return { current: O.some(point), rows: state.rows };
        }
        return O.match(state.current, {
          onNone: () => state,
          onSome: (from) => ({
            current: O.some(point),
            rows: O.match(rowOf(from, point), {
              onNone: () => state.rows,
              onSome: (row) => A.append(state.rows, row),
            }),
          }),
        });
      }
    ),
    (state) => state.rows
  );

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

interface StrokeRow {
  readonly angle: number;
  readonly length: number;
  readonly offset: number;
  readonly x1: number;
  readonly x2: number;
  readonly y1: number;
  readonly y2: number;
}

const round = (value: number, digits: number) => Number(value.toFixed(digits));

// The shading path of a figure SVG: every `M x y L x y` pair in PDF points,
// converted to mm from the page's top-left corner.
const shadingSegmentsMm = (svg: string): ReadonlyArray<StrokeRow> => {
  const paths = pipe(
    A.fromIterable(svg.matchAll(/<path[^>]*>/g)),
    A.map((m) => m[0])
  );
  const shading = A.findFirst(paths, Str.includes(SHADING_STROKE_PT));
  return O.match(shading, {
    onNone: () => A.empty<StrokeRow>(),
    onSome: (element) => {
      const d = O.fromNullishOr(/\sd="([^"]*)"/.exec(element)?.[1]);
      return O.match(d, {
        onNone: () => A.empty<StrokeRow>(),
        onSome: rowsOfPath,
      });
    },
  });
};

const byAngleThenOffset = Order.combine(
  Order.mapInput(Order.Number, (row: StrokeRow) => row.angle),
  Order.mapInput(Order.Number, (row: StrokeRow) => row.offset)
);

/**
 * The stroke table a text-only reviewer measures from: every shading stroke
 * of every figure with its direction, perpendicular offset (same family =
 * parallel lines; consecutive offsets give the gaps), length, and endpoints,
 * all in mm from the page's top-left corner.
 *
 * **Example** (A figure with no shading path)
 *
 * ```ts
 * import { strokeTableMarkdown } from "@beep/repo-cli/commands/Drawings"
 *
 * const table = strokeTableMarkdown({ title: "Crate", sheetSetSha256: "0".repeat(64), specSha256: "1".repeat(64), figures: [{ figure: 1, view: "front", svg: "<svg></svg>", coverage: "{}" }] })
 * console.log(table.includes("FIG 1 (front) — 0 shading strokes")) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const strokeTableMarkdown = (input: {
  readonly title: string;
  readonly sheetSetSha256: string;
  readonly specSha256: string;
  readonly figures: ReadonlyArray<{
    readonly figure: number;
    readonly view: string;
    readonly svg: string;
    readonly coverage: string;
  }>;
}): string => {
  const sections = A.map(input.figures, (figure) => {
    const rows = pipe(shadingSegmentsMm(figure.svg), A.sort(byAngleThenOffset));
    const lengths = pipe(
      rows,
      A.map((row) => row.length),
      A.sort(Order.Number)
    );
    const extremes =
      A.length(lengths) === 0
        ? ""
        : `\nShortest strokes: ${JSON.stringify(A.take(lengths, 5))}; longest: ${JSON.stringify(A.takeRight(lengths, 3))}.\n`;
    return [
      `\n## FIG ${figure.figure} (${figure.view}) — ${A.length(rows)} shading strokes; coverage ${figure.coverage}\n`,
      "Strokes grouped by direction (angle from the page x axis), with the perpendicular offset of each line (mm, same family = parallel lines; consecutive offsets give the gaps), length (mm), and endpoints (mm from the page's top-left):\n",
      "| angle | offset | length | x1 | y1 | x2 | y2 |",
      "| --- | --- | --- | --- | --- | --- | --- |",
      ...A.map(rows, (r) => `| ${r.angle} | ${r.offset} | ${r.length} | ${r.x1} | ${r.y1} | ${r.x2} | ${r.y2} |`),
      extremes,
    ].join("\n");
  });
  return [
    `# RENDER.md — measurements of "${input.title}"\n`,
    `sheet-set sha256 ${input.sheetSetSha256}; spec sha256 ${input.specSha256}. Shading strokes are drawn 0.2 mm wide (0.567 pt); visible outlines 0.35 mm (0.992 pt); 72 pt = 25.4 mm.\n`,
    ...sections,
  ].join("\n");
};

/**
 * The markdown summary of earlier reports a later reviewer dedupes against:
 * every finding with its id, severity, scope, category, figures, location,
 * observation, basis, and fix, plus each reviewer's stance on the findings
 * before it.
 *
 * **Example** (No earlier reports)
 *
 * ```ts
 * import { priorSummaryMarkdown } from "@beep/repo-cli/commands/Drawings"
 *
 * console.log(priorSummaryMarkdown([]).startsWith("# Findings already reported")) // true
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const priorSummaryMarkdown = (reports: ReadonlyArray<CriticReport>): string => {
  const sections = A.map(reports, (report) => {
    const findings = A.map(
      report.findings,
      (f) =>
        `- **${f.id}** ${f.severity} ${f.scope} ${f.category} FIG ${JSON.stringify(f.figures)} — ${f.location} — ${f.observation} — basis: ${f.basis} — fix: ${f.proposedFix} (confidence ${f.confidence})`
    );
    const stances = A.map(report.priorAssessment, (p) => `  - on ${p.id}: ${p.stance} — ${p.note}`);
    const unassessed =
      A.length(report.couldNotAssess) === 0 ? [] : [`  - could_not_assess: ${A.join(report.couldNotAssess, " | ")}`];
    return [
      `\n## ${report.reviewer} — verdict ${report.verdict} — blockers: ${JSON.stringify(report.blockers)}\n`,
      ...findings,
      ...stances,
      ...unassessed,
    ].join("\n");
  });
  return [
    "# Findings already reported in this loop (dedupe against these; confirm or refute each)\n",
    ...sections,
    "",
  ].join("\n");
};

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
 * @category formatting
 * @since 0.0.0
 */
export const priorIdsMarkdown = (reports: ReadonlyArray<CriticReport>): string =>
  [
    "# Finding ids already reported by earlier reviewers (categories only; the matter set is not shown to you)\n",
    ...pipe(
      reports,
      A.flatMap((report) => report.findings),
      A.map((f) => `- ${f.id} ${f.severity} ${f.category} — basis: ${f.basis}`)
    ),
    "",
  ].join("\n");

const parseJson = S.decodeUnknownOption(S.fromJsonString(S.Unknown));

/**
 * Pull the report JSON out of what a route returned.
 *
 * **Details**
 *
 * `codex` writes the file it was told to write. `grok` prints a wrapper whose
 * `structuredOutput` (or `text`) holds the document. `claude -p` prints a
 * stream-json array whose last `result` entry carries the final message.
 * `cursor-agent` prints the final message as text. The last two are read as
 * the outermost `{ … }` of that message.
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
 * @category parsing
 * @since 0.0.0
 */
export const extractReportText = (input: { readonly route: CriticRoute; readonly text: string }): O.Option<string> => {
  const outermost = (text: string): O.Option<string> => {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    return start >= 0 && end > start ? O.some(text.slice(start, end + 1)) : O.none();
  };
  const field = (value: unknown, key: string): O.Option<unknown> =>
    typeof value === "object" && value !== null && key in value
      ? O.fromNullishOr((value as Record<string, unknown>)[key])
      : O.none();
  return Match.value(input.route).pipe(
    Match.when("codex", () => outermost(input.text)),
    Match.when("grok", () =>
      pipe(
        parseJson(input.text),
        O.flatMap((wrapper) =>
          field(wrapper, "structuredOutput").pipe(
            O.map((structured) => JSON.stringify(structured)),
            O.orElse(() =>
              field(wrapper, "text").pipe(
                O.filter((t): t is string => typeof t === "string"),
                O.flatMap(outermost)
              )
            )
          )
        ),
        O.orElse(() => outermost(input.text))
      )
    ),
    Match.when("claude", () =>
      pipe(
        parseJson(input.text),
        O.filter((events): events is ReadonlyArray<unknown> => Array.isArray(events)),
        O.flatMap((events) =>
          pipe(
            events,
            A.findLast((event) => O.contains(field(event, "type"), "result" as unknown)),
            O.flatMap((event) => field(event, "result")),
            O.filter((t): t is string => typeof t === "string"),
            O.flatMap(outermost)
          )
        ),
        O.orElse(() => outermost(input.text))
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
 * believe it is this one, and `cursor-agent` runs inside its sandbox with the
 * repository's `.cursor/cli.json` deny list.
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
  return Match.value(input.reviewer.route).pipe(
    Match.when(
      "codex",
      (): CriticInvocation => ({
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
        reportFrom: { kind: "file", path: input.reportPath },
      })
    ),
    Match.when(
      "grok",
      (): CriticInvocation => ({
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
        reportFrom: { kind: "stdout" },
      })
    ),
    Match.when(
      "claude",
      (): CriticInvocation => ({
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
        env: R.filter(input.env, (_, key) => !HashSet.has(SCRUBBED_ENV, key)),
        reportFrom: { kind: "stdout" },
      })
    ),
    Match.when(
      "cursor",
      (): CriticInvocation => ({
        executable: "cursor-agent",
        args: [
          "-p",
          "--trust",
          "--force",
          "--sandbox",
          "enabled",
          "--workspace",
          cwd,
          ...O.match(input.syntheticPack, { onNone: () => A.empty<string>(), onSome: (dir) => ["--add-dir", dir] }),
          "--model",
          input.reviewer.model,
          "--output-format",
          "text",
          input.prompt,
        ],
        cwd,
        env: input.env,
        reportFrom: { kind: "stdout" },
      })
    ),
    Match.exhaustive
  );
};

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

/**
 * A request to build a critic pack from a render manifest.
 *
 * @category models
 * @since 0.0.0
 */
export interface CriticPackRequest {
  readonly briefPath: string;
  readonly contextDir: O.Option<string>;
  readonly imagesDirs: ReadonlyArray<string>;
  readonly manifestPath: string;
  readonly outDir: string;
  readonly zooms: ReadonlyArray<CriticZoom>;
}

/**
 * A request to run reviewers on a pack.
 *
 * @category models
 * @since 0.0.0
 */
export interface CriticRunRequest {
  readonly loop: number;
  readonly loopDir: string;
  readonly packDir: string;
  readonly reviewers: ReadonlyArray<CriticReviewer>;
  readonly syntheticPack: O.Option<string>;
  readonly timeoutMinutes: number;
  readonly workspace: O.Option<string>;
}

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

  // A 300 dpi crop through pdftoppm, which pdf-tools already depends on.
  const cropZoom = (pdfPath: string, zoom: CriticZoom, outPrefix: string) =>
    Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* spawner
          .spawn(
            ChildProcess.make(
              "pdftoppm",
              [
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
              ],
              { stdin: "ignore", stdout: "pipe", stderr: "pipe" }
            )
          )
          .pipe(Effect.mapError(fail("Could not run pdftoppm; is poppler installed?")));
        const [, stderr, exitCode] = yield* Effect.all(
          [collectText(handle.stdout), collectText(handle.stderr), handle.exitCode],
          { concurrency: "unbounded" }
        ).pipe(Effect.mapError(fail("pdftoppm did not finish.")));
        if (exitCode !== 0) {
          return yield* DrawingsCommandError.make({ message: `pdftoppm exited ${exitCode}: ${Str.trim(stderr)}` });
        }
      })
    );

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
    const images = yield* Effect.forEach(request.imagesDirs, (dir) =>
      Effect.gen(function* () {
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

  const runReviewer = Effect.fn("DrawingCritics.runReviewer")(function* (input: {
    readonly request: CriticRunRequest;
    readonly pack: CriticPackManifest;
    readonly reviewer: CriticReviewer;
    readonly order: number;
    readonly template: string;
    readonly extra: O.Option<string>;
  }) {
    const { request, reviewer, pack } = input;
    const packDir = path.resolve(request.packDir);
    const loopDir = path.resolve(request.loopDir);
    const prior = yield* priorReports(loopDir);
    const startedAt = DateTime.formatIso(yield* DateTime.now);
    const prompt = yield* Match.value(reviewer.scope).pipe(
      Match.when("matter", () =>
        Effect.gen(function* () {
          yield* mkdir(path.join(packDir, "prior"));
          yield* write(path.join(packDir, "prior", "SUMMARY.md"), priorSummaryMarkdown(prior));
          const hint = Match.value(reviewer.route).pipe(
            Match.when(
              "codex",
              () =>
                `The images attached to this message are, in order: ${A.join([...pack.sheets, ...pack.zooms, ...pack.images], ", ")}.`
            ),
            Match.when(
              "grok",
              () =>
                "Use your file tools to read the files named above (paths are relative to the current directory) and to look at the PNG and JPG images if you can; the SVGs and render/RENDER.md carry the same shading geometry as numbers."
            ),
            Match.when(
              "claude",
              () =>
                "Use the Read tool to view the PNG and JPG images and the text files. The SVGs and render/RENDER.md carry the shading geometry as numbers."
            ),
            Match.when(
              "cursor",
              () => "Read the files named above; the SVGs and render/RENDER.md carry the shading geometry as numbers."
            ),
            Match.exhaustive
          );
          return [
            input.template,
            `You are reviewer "${reviewer.name}": ids ${reviewer.idPrefix}-01, ${reviewer.idPrefix}-02, …`,
            hint,
            CRITIC_HARD_RULES,
            O.getOrElse(input.extra, () => ""),
          ].join("\n");
        })
      ),
      Match.when("synthetic", () =>
        Effect.gen(function* () {
          const syntheticPack = yield* Effect.fromOption(request.syntheticPack).pipe(
            Effect.mapError(() =>
              DrawingsCommandError.make({
                message: `Reviewer "${reviewer.name}" has synthetic scope; pass --synthetic-pack.`,
              })
            )
          );
          yield* write(path.join(syntheticPack, "prior-ids.md"), priorIdsMarkdown(prior));
          const brief = yield* read(path.join(syntheticPack, "BRIEF-synthetic.md"));
          return [brief, CRITIC_HARD_RULES].join("\n");
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
    const { stdout, stderr, exitCode } = yield* Effect.scoped(
      Effect.gen(function* () {
        const handle = yield* spawner
          .spawn(
            ChildProcess.make(invocation.executable, invocation.args, {
              cwd: invocation.cwd,
              env: invocation.env,
              extendEnv: false,
              stdin: "ignore",
              stdout: "pipe",
              stderr: "pipe",
            })
          )
          .pipe(Effect.mapError(fail(`Could not run ${invocation.executable}; is it installed and signed in?`)));
        return yield* Effect.all(
          { stdout: collectText(handle.stdout), stderr: collectText(handle.stderr), exitCode: handle.exitCode },
          { concurrency: "unbounded" }
        ).pipe(
          Effect.mapError(fail(`${invocation.executable} did not finish.`)),
          Effect.timeoutOrElse({
            duration: `${request.timeoutMinutes} minutes`,
            orElse: () =>
              Effect.fail(
                DrawingsCommandError.make({
                  message: `${reviewer.name} exceeded ${request.timeoutMinutes} minutes and was stopped.`,
                })
              ),
          })
        );
      })
    );
    yield* write(path.join(loopDir, `${reviewer.name}.log`), stderr);
    yield* write(path.join(loopDir, `${reviewer.name}.raw`), stdout);
    const rawReport = yield* Match.value(invocation.reportFrom).pipe(
      Match.when({ kind: "file" }, ({ path: file }) =>
        fs.exists(file).pipe(
          Effect.mapError(fail(`Could not stat "${file}".`)),
          Effect.flatMap((exists) => (exists ? read(file).pipe(Effect.asSome) : Effect.succeedNone))
        )
      ),
      Match.when({ kind: "stdout" }, () => Effect.succeedSome(stdout)),
      Match.exhaustive
    );
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
      yield* write(reportPath, `${json}\n`);
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
      exitCode,
      report: written.file,
      reportSha256: written.sha,
      findings: written.findings,
      startedAt,
      finishedAt,
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
    const runs: Array<CriticRunRecord> = [];
    for (const [index, reviewer] of A.entries(request.reviewers)) {
      yield* Effect.logInfo(
        `critics: ${index + 1}/${A.length(request.reviewers)} ${reviewer.name} (${reviewer.route})`
      );
      const run = yield* runReviewer({ request, pack, reviewer, order: index + 1, template, extra });
      runs.push(run);
      yield* Effect.logInfo(
        `critics: ${reviewer.name} exit ${run.exitCode}, ${run.findings} finding(s)${O.isNone(run.report) ? ", no report" : ""}`
      );
    }
    const record = CriticLoopRecord.make({
      schemaVersion: "drawing-critic-loop/v1",
      loop: request.loop,
      sheetSetSha256: pack.sheetSetSha256,
      runs,
    });
    const json = yield* encodeCriticLoopRecord(record).pipe(Effect.mapError(fail("Could not encode loop.json.")));
    yield* write(path.join(loopDir, "loop.json"), `${json}\n`);
    const all = yield* priorReports(loopDir);
    yield* write(path.join(loopDir, "ALL-FINDINGS.md"), priorSummaryMarkdown(all));
    return record;
  });

  const summary = Effect.fn("DrawingCritics.summary")(function* (loopDir: string) {
    const reports = yield* priorReports(path.resolve(loopDir));
    return priorSummaryMarkdown(reports);
  });

  return { buildPack, runSequence, summary } satisfies DrawingCriticsShape;
});

// The process environment as a string record; undefined entries dropped. The
// reviewers are external CLIs that read their own sign-in from it.
const processEnvironment = (): Readonly<Record<string, string>> =>
  R.filterMap(
    (globalThis as unknown as { readonly process?: { readonly env?: Readonly<Record<string, string | undefined>> } })
      .process?.env ?? {},
    (value) => (typeof value === "string" ? Result.succeed(value) : Result.fail(undefined))
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
