import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { PdfTools, UndecodableStream } from "@beep/pdf-tools";
import {
  CRITIC_CLAUDE_LIMITS,
  CRITIC_TIME_LIMIT_EXIT_CODE,
  CriticFinding,
  CriticFindingRelation,
  CriticMeasurements,
  CriticPackManifest,
  CriticPackRequest,
  CriticPdfMeasurements,
  CriticReport,
  CriticReportSource,
  CriticReviewer,
  CriticRunRecord,
  CriticRunRequest,
  CriticSeatLimit,
  CriticSeatUnavailable,
  CriticZoom,
  claudeOutputLimit,
  criticInvocation,
  criticReportJsonSchema,
  criticRunLine,
  DEFAULT_CRITIC_REVIEWERS,
  DRAWING_CRITIC_PROMPT_TEMPLATE,
  DrawingCritics,
  DrawingsCommandError,
  decodeCriticLoopRecord,
  decodeCriticMeasurements,
  decodeCriticReport,
  encodeCriticMeasurements,
  encodeCriticPackManifest,
  encodeCriticReport,
  extractReportText,
  figureMeasurements,
  grokSandboxRefusal,
  measurementsMarkdown,
  parsePdfFonts,
  parsePdfInfoBoxes,
  parseZoomFlag,
  priorIdsMarkdown,
  priorSummaryMarkdown,
  selectReviewers,
  strokeTableMarkdown,
} from "@beep/repo-cli/commands/Drawings";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertExitFailure, assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as Struct from "effect/Struct";
import * as TestClock from "effect/testing/TestClock";
import { commandArgs } from "./support/commandArgs.ts";

const UnknownJson = S.fromJsonString(S.Unknown);
const encodeJson = S.encodeUnknownEffect(UnknownJson);
const decodeJson = S.decodeUnknownEffect(UnknownJson);

const accept = (reviewer: string): CriticReport =>
  CriticReport.make({
    reviewer,
    verdict: "accept",
    blockers: [],
    priorAssessment: [],
    findings: [],
    couldNotAssess: [],
  });

const finding = (id: string, of: O.Option<string> = O.none()): CriticFinding =>
  CriticFinding.make({
    id,
    relation: CriticFindingRelation.make({ kind: O.isSome(of) ? "extends" : "new", of }),
    severity: "P1",
    scope: "this-render",
    category: "shading",
    figures: [2, 4],
    location: "left wall, strokes at x = 111.2 mm",
    basis: "37 CFR 1.84(m)",
    observation: "The band sits at the lit end.",
    proposedFix: "Anchor the band at the shadow end.",
    confidence: 0.9,
  });

describe("critic report contract", () => {
  it.effect(
    "round-trips a report with a new and an extending finding through JSON",
    Effect.fnUntraced(function* () {
      const report = CriticReport.make({
        ...accept("grok-4.7"),
        priorAssessment: [{ id: "A-01", stance: "confirm", note: "Measured 1.50 mm." }],
        findings: [finding("G-01"), finding("G-02", O.some("A-01"))],
      });
      const text = yield* encodeJson({
        reviewer: "grok-4.7",
        verdict: "accept",
        blockers: [],
        priorAssessment: [{ id: "A-01", stance: "confirm", note: "Measured 1.50 mm." }],
        findings: [
          { ...finding("G-01"), relation: { kind: "new", of: null } },
          { ...finding("G-02"), relation: { kind: "extends", of: "A-01" } },
        ],
        couldNotAssess: [],
      });
      const decoded = yield* decodeCriticReport(text);
      expect(decoded).toStrictEqual(report);
      assertNone(decoded.findings[0]?.relation.of ?? O.none());
      assertSome(decoded.findings[1]?.relation.of ?? O.none(), "A-01");
    })
  );

  it.effect(
    "derives a JSON Schema in which every key is required and no excess property is allowed",
    Effect.fnUntraced(function* () {
      const schema = yield* decodeJson(criticReportJsonSchema());
      expect(schema).toHaveProperty("required", [
        "reviewer",
        "verdict",
        "blockers",
        "priorAssessment",
        "findings",
        "couldNotAssess",
      ]);
      expect(schema).toHaveProperty("additionalProperties", false);
      expect(schema).toHaveProperty("properties.findings.items.required", expect.arrayContaining(["relation"]));
      // The strict structured-output modes refuse an optional key; `of` is required and nullable.
      expect(schema).toHaveProperty("properties.findings.items.properties.relation.required", ["kind", "of"]);
      expect(criticReportJsonSchema()).not.toMatch(/"(allOf|minLength|title|minimum|maximum|\$ref)"/);
    })
  );

  it.effect(
    "rejects a report whose finding carries an unknown category",
    Effect.fnUntraced(function* () {
      const text = yield* encodeJson({
        ...accept("x"),
        findings: [{ ...finding("X-01"), relation: { kind: "new", of: null }, category: "taste" }],
      });
      const exit = yield* Effect.exit(decodeCriticReport(text));
      // The decoder fails on exactly the offending key, naming the category domain it expected.
      assertSome(
        O.map(Exit.findErrorOption(exit), (error) => error.message),
        'Expected @beep/repo-cli/commands/Drawings/Drawings.critics.schemas/CriticCategory\n  at ["findings"][0]["category"]'
      );
    })
  );
});

describe("extractReportText", () => {
  const document = '{"reviewer":"x","verdict":"accept"}';

  it.effect(
    "reads a Grok wrapper's structuredOutput, or its text when absent",
    Effect.fnUntraced(function* () {
      assertSome(
        extractReportText({
          route: "grok",
          text: yield* encodeJson({ text: "", structuredOutput: { reviewer: "x", verdict: "accept" } }),
        }),
        document
      );
      assertSome(
        extractReportText({ route: "grok", text: yield* encodeJson({ text: `Here: ${document}` }) }),
        document
      );
    })
  );

  it.effect(
    "reads the report out of the single result envelope claude -p prints with --output-format json",
    Effect.fnUntraced(function* () {
      const report = accept("claude-opus-5.5");
      const reportText = yield* encodeCriticReport(report);
      const envelope = yield* encodeJson({
        type: "result",
        subtype: "success",
        is_error: false,
        duration_ms: 1200,
        num_turns: 4,
        result: `Review complete.\n\n${reportText}\n`,
        session_id: "00000000-0000-0000-0000-000000000000",
        total_cost_usd: 0.42,
      });
      const extracted = extractReportText({ route: "claude", text: envelope });
      assertSome(extracted, reportText);
      // The extracted text is the reviewer's report, not the envelope around it.
      expect(yield* extracted.pipe(O.getOrThrow, decodeCriticReport)).toStrictEqual(report);
    })
  );

  it.effect(
    "reads the last result event of a claude -p --verbose event array, an absent is_error meaning success",
    Effect.fnUntraced(function* () {
      const events = yield* encodeJson([
        { type: "system", subtype: "init" },
        { type: "result", result: "not this one {}" },
        { type: "result", result: `Final:\n${document}\n` },
      ]);
      assertSome(extractReportText({ route: "claude", text: events }), document);
    })
  );

  it.effect(
    "reads the last result event of claude -p stream-json output, one event per line",
    Effect.fnUntraced(function* () {
      const lines = (events: ReadonlyArray<unknown>) =>
        Effect.map(
          Effect.forEach(events, (event) => encodeJson(event)),
          (encoded) => `${A.join(encoded, "\n")}\n`
        );
      const stream = yield* lines([
        { type: "system", subtype: "init", session_id: "00000000-0000-0000-0000-000000000000" },
        { type: "assistant", message: { content: [{ type: "text", text: "Reading the sheets {}" }] } },
        { type: "result", subtype: "success", is_error: false, result: `Final:\n${document}\n` },
      ]);
      // Not one JSON value: the events are read line by line, never as the outermost braces of the text.
      assertSome(extractReportText({ route: "claude", text: stream }), document);
      const failed = yield* lines([
        { type: "system", subtype: "init" },
        { type: "result", subtype: "success", is_error: true, result: `API Error ${document}` },
      ]);
      assertNone(extractReportText({ route: "claude", text: failed }));
      // A stream cut off before its result event holds no report.
      const cut = yield* lines([{ type: "system", subtype: "init" }]);
      assertNone(extractReportText({ route: "claude", text: `${cut}{"type":"assistant","message":{"con` }));
    })
  );

  it.effect(
    "finds no report in a claude -p envelope flagged is_error or carrying no result",
    Effect.fnUntraced(function* () {
      const failed = yield* encodeJson({
        type: "result",
        subtype: "success",
        is_error: true,
        result: 'API Error: 500 {"type":"error","error":{"type":"api_error"}}',
      });
      assertNone(extractReportText({ route: "claude", text: failed }));
      const maxTurns = yield* encodeJson({ type: "result", subtype: "error_max_turns", is_error: false });
      assertNone(extractReportText({ route: "claude", text: maxTurns }));
    })
  );

  it("reads the outermost braces of cursor and codex text, and none when there are none", () => {
    assertSome(extractReportText({ route: "cursor", text: `prose ${document} trailing` }), document);
    assertSome(extractReportText({ route: "codex", text: document }), document);
    assertNone(extractReportText({ route: "cursor", text: "no json here" }));
  });
});

describe("prior summaries", () => {
  it("lists every finding, stance and could-not-assess line of the earlier reviewers", () => {
    const reports = [
      CriticReport.make({
        ...accept("codex-gpt-6-astra"),
        findings: [finding("A-01")],
        couldNotAssess: ["No Guide pages."],
      }),
      CriticReport.make({
        ...accept("grok-4.7"),
        priorAssessment: [{ id: "A-01", stance: "refute", note: "Measured 2.1 mm." }],
      }),
    ];
    const summary = priorSummaryMarkdown(reports);
    expect(summary).toContain("**A-01** P1 this-render shading FIG [2,4]");
    expect(summary).toContain("on A-01: refute — Measured 2.1 mm.");
    expect(summary).toContain("could_not_assess: No Guide pages.");
  });

  it("gives a synthetic-scope reviewer ids and categories only", () => {
    const ids = priorIdsMarkdown([CriticReport.make({ ...accept("codex-gpt-6-astra"), findings: [finding("A-01")] })]);
    expect(ids).toContain("- A-01 P1 shading — basis: 37 CFR 1.84(m)");
    expect(ids).not.toContain("111.2 mm");
  });
});

describe("stroke table", () => {
  it("measures every shading stroke of a figure SVG in mm with its direction, offset and length", () => {
    // Two vertical strokes 1.5 mm apart (in PDF points: 1.5 mm = 4.2520 pt) and one horizontal stroke.
    const svg = A.join(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" width="612pt" height="792pt">',
        '<path id="label-outlines" d="M1 1L2 2"/>',
        '<path stroke-width="0.567" d="M283.465 283.465L283.465 311.811M287.717 283.465L287.717 311.811M283.465 340.157L311.811 340.157"/>',
        '<path stroke-width="0.992" d="M0 0L10 10"/>',
        "</svg>",
      ],
      ""
    );
    const table = strokeTableMarkdown({
      title: "Crate",
      sheetSetSha256: Str.repeat(64)("0"),
      specSha256: Str.repeat(64)("1"),
      figures: [{ figure: 1, view: "front", svg, coverage: "{}" }],
    });
    expect(table).toContain("FIG 1 (front) — 3 shading strokes");
    expect(table).toContain("| 0 | 120 | 10 | 100 | 120 | 110 | 120 |");
    expect(table).toContain("| 90 | 100 | 10 | 100 | 100 | 100 | 110 |");
    expect(table).toContain("| 90 | 101.5 | 10 | 101.5 | 100 | 101.5 | 110 |");
  });
});

describe("invocations", () => {
  const env = { HOME: "/home/x", CLAUDECODE: "1", ANTHROPIC_BASE_URL: "http://proxy" };
  const base = {
    packDir: "/pack",
    prompt: "review",
    images: ["/pack/render/pg-1.png"],
    schemaPath: "/pack/findings.schema.json",
    schemaText: "{}",
    reportPath: "/loop/r.json",
    workspace: O.some("/lane"),
    syntheticPack: O.some("/crate"),
    env,
  };

  it("builds the four routes with their model, effort, read-only mode and report source", () => {
    const byName = (name: string) => A.findFirst(DEFAULT_CRITIC_REVIEWERS, (r) => r.name === name);
    const astra = criticInvocation({ ...base, reviewer: O.getOrThrow(byName("codex-gpt-6-astra")) });
    expect(astra.executable).toBe("codex");
    expect(astra.args).toContain('model_reasoning_effort="xhigh"');
    expect(astra.args).toContain("read-only");
    expect(astra.args).toContain("/pack/render/pg-1.png");
    // codex writes its report to the file it was handed; the other routes print it on stdout
    expect(astra.reportFrom).toStrictEqual(CriticReportSource.cases.file.make({ kind: "file", path: base.reportPath }));
    const grok = criticInvocation({ ...base, reviewer: O.getOrThrow(byName("grok-4.7")) });
    expect(grok.args).toContain("--json-schema");
    expect(grok.reportFrom).toStrictEqual(CriticReportSource.cases.stdout.make({ kind: "stdout" }));
    const fable = criticInvocation({ ...base, reviewer: O.getOrThrow(byName("claude-fable-5.1")) });
    expect(fable.args).toContain("claude-fable-5-1");
    // session variables scrubbed; the seat's output and thinking caps added
    expect(fable.env).toStrictEqual({
      HOME: "/home/x",
      CLAUDE_CODE_MAX_OUTPUT_TOKENS: "96000",
      MAX_THINKING_TOKENS: "48000",
    });
    const kimi = criticInvocation({ ...base, reviewer: O.getOrThrow(byName("kimi-k3")) });
    expect(kimi.cwd).toBe("/lane");
    expect(kimi.args).toContain("--add-dir");
    expect(kimi.args).toContain("/crate");
    expect(kimi.args).toContain("enabled");
    expect(kimi.args).not.toContain("disabled");
  });

  it("confines lower-trust Grok and Claude critics to read-only tools", () => {
    const byName = (name: string) =>
      O.getOrThrow(A.findFirst(DEFAULT_CRITIC_REVIEWERS, (reviewer) => reviewer.name === name));
    const flagValue = (args: ReadonlyArray<string>, flag: string) =>
      args[O.getOrThrow(A.findFirstIndex(args, (arg) => arg === flag)) + 1];
    const grok = criticInvocation({ ...base, reviewer: byName("grok-4.7") });
    expect(flagValue(grok.args, "--permission-mode")).toBe("dontAsk");
    expect(flagValue(grok.args, "--sandbox")).toBe("strict");
    expect(A.zip(grok.args, A.drop(grok.args, 1))).toEqual(
      expect.arrayContaining([
        ["--allow", "Read"],
        ["--allow", "Grep"],
        ["--deny", "Bash"],
        ["--deny", "Edit"],
        ["--deny", "MCPTool"],
        ["--deny", "WebFetch"],
        ["--deny", "WebSearch"],
      ])
    );
    expect(grok.args).toEqual(expect.arrayContaining(["--disable-web-search", "--no-subagents", "--no-memory"]));
    expect(grok.args).not.toContain("bypassPermissions");

    const claude = criticInvocation({ ...base, reviewer: byName("claude-fable-5.1") });
    expect(flagValue(claude.args, "--permission-mode")).toBe("dontAsk");
    expect(flagValue(claude.args, "--permission-prompts")).toBe("none");
    expect(flagValue(claude.args, "--tools")).toBe("Read");
    expect(claude.args).toContain("--restricted");
    expect(claude.args).not.toContain("bypassPermissions");
  });

  it("keeps a Claude output or thinking cap the operator already set, and adds none to other routes", () => {
    const byName = (name: string) =>
      O.getOrThrow(A.findFirst(DEFAULT_CRITIC_REVIEWERS, (reviewer) => reviewer.name === name));
    const opus = criticInvocation({
      ...base,
      reviewer: byName("claude-opus-5.5"),
      env: { HOME: "/home/x", CLAUDE_CODE_MAX_OUTPUT_TOKENS: "128000" },
    });
    expect(opus.env).toStrictEqual({
      HOME: "/home/x",
      CLAUDE_CODE_MAX_OUTPUT_TOKENS: "128000",
      MAX_THINKING_TOKENS: "48000",
    });
    const grok = criticInvocation({ ...base, reviewer: byName("grok-4.7") });
    expect(grok.env).toStrictEqual(env);
  });

  it.effect(
    "selects reviewers by name in the order given and refuses an unknown one",
    Effect.fnUntraced(function* () {
      const two = yield* selectReviewers(["claude-opus-5.5", "grok-4.7"]);
      expect(A.map(two, (r) => r.idPrefix)).toStrictEqual(["O", "G"]);
      const unknown = yield* Effect.exit(selectReviewers(["gpt-3"]));
      assertExitFailure(
        unknown,
        Cause.fail(
          DrawingsCommandError.make({
            message:
              '"gpt-3" is not a known reviewer; known: codex-gpt-6-astra, grok-4.7, claude-fable-5.1, kimi-k3, claude-opus-5.5.',
          })
        )
      );
    })
  );

  it.effect(
    "parses a zoom flag and refuses a malformed one",
    Effect.fnUntraced(function* () {
      const zoom = yield* parseZoomFlag("1:500,1500,1700,1400:walls");
      expect([zoom.figure, zoom.x, zoom.y, zoom.width, zoom.height, zoom.label]).toStrictEqual([
        1,
        500,
        1500,
        1700,
        1400,
        "walls",
      ]);
      const bad = yield* Effect.exit(parseZoomFlag("1:500,1500:walls"));
      assertExitFailure(
        bad,
        Cause.fail(DrawingsCommandError.make({ message: '"1:500,1500:walls" is not fig:x,y,width,height:label.' }))
      );
    })
  );

  it("names a reviewer's model and scope in the default sequence", () => {
    const kimi = A.findFirst(DEFAULT_CRITIC_REVIEWERS, (r) => r.route === "cursor");
    assertSome(
      O.map(kimi, (r) => r.scope),
      "synthetic"
    );
    expect(A.map(DEFAULT_CRITIC_REVIEWERS, (r) => r.idPrefix)).toStrictEqual(["A", "G", "F", "K", "O"]);
    assertNone(
      CriticReviewer.make({ name: "x", idPrefix: "X", route: "grok", model: "grok-4.7", scope: "matter" }).effort
    );
  });

  it("builds pack and run requests through their schemas, absent directories as none", () => {
    const pack = CriticPackRequest.make({
      manifestPath: "render/manifest.json",
      outDir: "packs/loop-1",
      briefPath: "BRIEF.md",
      imagesDirs: ["markup"],
      zooms: [CriticZoom.make({ figure: 1, label: "walls", x: 500, y: 1500, width: 1700, height: 1400 })],
    });
    assertNone(pack.contextDir);
    const run = CriticRunRequest.make({
      loop: 2,
      loopDir: "loops/2",
      packDir: "packs/loop-1",
      reviewers: DEFAULT_CRITIC_REVIEWERS,
      timeoutMinutes: 90,
    });
    assertNone(run.workspace);
    assertNone(run.syntheticPack);
    // loop numbers and timeouts start at 1, as the loop record requires
    assertNone(CriticRunRequest.makeOption({ ...run, loop: 0 }));
    assertNone(CriticRunRequest.makeOption({ ...run, timeoutMinutes: 0 }));
  });
});

// The refusal grok prints when its strict sandbox cannot resolve a runtime-socket deny path (synthetic path).
const sandboxRefusal = (deniedPath: string) =>
  A.join(
    [
      `Error: sandbox profile resolve failed: socket deny resolution failed: could not resolve runtime-socket deny path${deniedPath}: Permission denied (os error 13)`,
      "error: this sandbox could not enforce its deny list on Linux: the required bwrap plan could not be prepared; see the error above for the specific cause. Refusing to start with denied paths unprotected.",
      "",
    ],
    "\n"
  );

describe("grokSandboxRefusal", () => {
  it("recognises the strict-sandbox refusal and the deny path it names", () => {
    const seat = grokSandboxRefusal(sandboxRefusal(" /run/example/runtime.sock"));
    assertSome(
      O.map(seat, (s) => s.reason),
      "sandbox-deny-path-unresolved"
    );
    assertSome(
      O.flatMap(seat, (s) => s.path),
      "/run/example/runtime.sock"
    );
    assertSome(
      O.map(seat, (s) => s.detail),
      "grok refused to start: its --sandbox strict profile could not resolve the runtime-socket deny path /run/example/runtime.sock on this host"
    );
  });

  it("recognises the refusal when the message names no path", () => {
    const seat = grokSandboxRefusal(sandboxRefusal(""));
    assertSome(
      O.map(seat, (s) => s.reason),
      "sandbox-deny-path-unresolved"
    );
    assertNone(O.flatMap(seat, (s) => s.path));
    assertSome(
      O.map(seat, (s) => s.detail),
      "grok refused to start: its --sandbox strict profile could not resolve a runtime-socket deny path on this host (the message names no path)"
    );
  });

  it("does not swallow any other grok failure", () => {
    assertNone(grokSandboxRefusal("Error: 401 Unauthorized: run grok login again\n"));
    // the same deny-list refusal for another cause is not the runtime-socket failure
    assertNone(
      grokSandboxRefusal(
        "error: sandbox deny-glob expansion failed; refusing to start\nerror: this sandbox could not enforce its deny list on Linux: the required bwrap plan could not be prepared. Refusing to start with denied paths unprotected.\n"
      )
    );
    // the deny-path line without the refusal to start is not a startup failure
    assertNone(
      grokSandboxRefusal(
        "warning: could not resolve runtime-socket deny path /run/example/runtime.sock: Permission denied\n"
      )
    );
  });
});

// What `claude -p` prints when one response runs past the output-token cap: the CLI's own message.
const OUTPUT_CAP_MESSAGE =
  "API Error: Claude's response exceeded the 64000 output token maximum. To configure this behavior, set the CLAUDE_CODE_MAX_OUTPUT_TOKENS environment variable.";

const outputCapEnvelope = (result: string) => ({
  type: "result",
  subtype: "success",
  is_error: true,
  api_error_status: null,
  api_error: "max_output_tokens",
  terminal_reason: "api_error",
  num_turns: 61,
  result,
});

describe("claudeOutputLimit", () => {
  it.effect(
    "recognises a run that ended at the output-token cap, and the cap its message names",
    Effect.fnUntraced(function* () {
      const seat = claudeOutputLimit(yield* encodeJson(outputCapEnvelope(OUTPUT_CAP_MESSAGE)));
      assertSome(
        O.map(seat, (s) => s.reason),
        "output-limit"
      );
      assertSome(
        O.flatMap(seat, (s) => s.limit),
        CriticSeatLimit.make({ amount: 64000, unit: "output-tokens" })
      );
      assertSome(
        O.map(seat, (s) => s.detail),
        "claude ended the run with api_error max_output_tokens: one response ran past the 64000 output-token cap"
      );
      // the same stop as the last event of a stream-json run
      const stream = A.join(
        [yield* encodeJson({ type: "system", subtype: "init" }), yield* encodeJson(outputCapEnvelope("API Error"))],
        "\n"
      );
      assertSome(
        O.map(claudeOutputLimit(stream), (s) => s.detail),
        "claude ended the run with api_error max_output_tokens: one response ran past its output-token cap (the message names no cap)"
      );
      assertNone(O.flatMap(claudeOutputLimit(stream), (s) => s.limit));
    })
  );

  it.effect(
    "does not take a finished run or any other API error for the output limit",
    Effect.fnUntraced(function* () {
      assertNone(
        claudeOutputLimit(
          yield* encodeJson({ type: "result", subtype: "success", is_error: false, result: opusReport })
        )
      );
      assertNone(
        claudeOutputLimit(
          yield* encodeJson({ type: "result", subtype: "success", is_error: true, result: "API Error: 500" })
        )
      );
      assertNone(claudeOutputLimit("not json"));
    })
  );
});

const seatRun = (unavailable: O.Option<CriticSeatUnavailable>) =>
  CriticRunRecord.make({
    order: 3,
    reviewer: CriticReviewer.make({
      name: "claude-fable-5.1",
      idPrefix: "F",
      route: "claude",
      model: "claude-fable-5-1",
      effort: O.some("xhigh"),
      scope: "matter",
    }),
    exitCode: 1,
    report: O.none(),
    reportSha256: O.none(),
    findings: 0,
    startedAt: "2026-10-15T00:00:00.000Z",
    finishedAt: "2026-10-15T01:30:00.000Z",
    unavailable,
  });

describe("criticRunLine", () => {
  it("prints a seat's outcome: its exit and findings, or why it ended without a report", () => {
    expect(criticRunLine(seatRun(O.none()))).toBe("3. claude-fable-5.1: exit 1, 0 finding(s) (no report)");
    const stopped = flow(
      (reason: CriticSeatUnavailable["reason"]) =>
        CriticSeatUnavailable.make({ reason, path: O.none(), detail: "detail" }),
      O.some,
      seatRun,
      criticRunLine
    );
    expect(stopped("sandbox-deny-path-unresolved")).toBe(
      "3. claude-fable-5.1: seat unavailable on this host, skipped (detail)"
    );
    expect(stopped("time-limit")).toBe("3. claude-fable-5.1: stopped at its time limit, no report (detail)");
    expect(stopped("output-limit")).toBe("3. claude-fable-5.1: stopped at its output-token cap, no report (detail)");
  });

  it.effect(
    "decodes a seat record written before seats carried a limit with no limit",
    Effect.fnUntraced(function* () {
      const text = yield* encodeJson({
        schemaVersion: "drawing-critic-loop/v1",
        loop: 3,
        sheetSetSha256: Str.repeat(64)("a"),
        runs: [
          {
            order: 1,
            reviewer: { name: "grok-4.7", idPrefix: "G", route: "grok", model: "grok-4.7", scope: "matter" },
            exitCode: 1,
            report: null,
            reportSha256: null,
            findings: 0,
            startedAt: "2026-10-15T00:00:00.000Z",
            finishedAt: "2026-10-15T00:00:01.000Z",
            unavailable: { reason: "sandbox-deny-path-unresolved", path: null, detail: "grok refused to start" },
          },
        ],
      });
      const record = yield* decodeCriticLoopRecord(text);
      assertNone(O.flatMap(A.head(record.runs), (run) => O.flatMap(run.unavailable, (seat) => seat.limit)));
    })
  );
});

const textStream = (text: string) => (text === "" ? Stream.empty : Stream.make(new TextEncoder().encode(text)));

type SeatOutput = { readonly stdout: string; readonly stderr: string; readonly exitCode: number };

// A seat that prints its output and exits, once `exited` has run.
const seatHandle = ({ stdout, stderr, exitCode }: SeatOutput, exited: Effect.Effect<void> = Effect.void) =>
  ChildProcessSpawner.makeHandle({
    all: Stream.empty,
    stdout: textStream(stdout),
    stderr: textStream(stderr),
    stdin: Sink.drain,
    exitCode: Effect.as(exited, ChildProcessSpawner.ExitCode(exitCode)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    pid: ChildProcessSpawner.ProcessId(1),
    unref: Effect.succeed(Effect.void),
  });

// A seat that never prints and never exits, until the harness stops it.
const stuckHandle = ChildProcessSpawner.makeHandle({
  all: Stream.never,
  stdout: Stream.never,
  stderr: Stream.never,
  stdin: Sink.drain,
  exitCode: Effect.never,
  getInputFd: () => Sink.drain,
  getOutputFd: () => Stream.never,
  isRunning: Effect.succeed(true),
  kill: () => Effect.void,
  pid: ChildProcessSpawner.ProcessId(2),
  unref: Effect.succeed(Effect.void),
});

// What the stalled seat prints before it stalls: two progress lines, and a whole report envelope with one
// finding, which the harness must keep in the seat's .raw and never read as the seat's report. Each arrives in
// two pieces, as a pipe may split it, so the kept text shows the pieces were joined in order.
const stalledStderrPieces = ["reading render/pg-1.png\n", "reading render/fig-1.svg\n"];
const stalledStderr = A.join(stalledStderrPieces, "");
const stalledStdout = JSON.stringify({
  type: "result",
  subtype: "success",
  is_error: false,
  result: JSON.stringify({
    reviewer: "claude-fable-5.1",
    verdict: "reject",
    blockers: [],
    priorAssessment: [],
    findings: [{ ...finding("F-01"), relation: { kind: "new", of: null } }],
    couldNotAssess: [],
  }),
});
const stalledStdoutPieces = [Str.slice(0, 40)(stalledStdout), Str.slice(40)(stalledStdout)];

// The pieces as a byte stream that then never ends, as a process that printed them and stalled.
const stalledStream = (pieces: ReadonlyArray<string>) =>
  Stream.concat(Stream.fromIterable(A.map(pieces, (piece) => new TextEncoder().encode(piece))), Stream.never);

// A seat that prints, then never prints again and never exits, until the harness stops it.
const stalledHandle = ChildProcessSpawner.makeHandle({
  all: Stream.never,
  stdout: stalledStream(stalledStdoutPieces),
  stderr: stalledStream(stalledStderrPieces),
  stdin: Sink.drain,
  exitCode: Effect.never,
  getInputFd: () => Sink.drain,
  getOutputFd: () => Stream.never,
  isRunning: Effect.succeed(true),
  kill: () => Effect.void,
  pid: ChildProcessSpawner.ProcessId(3),
  unref: Effect.succeed(Effect.void),
});

const opusReport = JSON.stringify({
  reviewer: "claude-opus-5.5",
  verdict: "accept",
  blockers: [],
  priorAssessment: [],
  findings: [],
  couldNotAssess: [],
});

const flagValue = (args: ReadonlyArray<string>, flag: string) =>
  O.flatMap(
    A.findFirstIndex(args, (arg) => arg === flag),
    (index) => A.get(args, index + 1)
  );

// Every spawn the fake seats received, keyed by "<cwd> <executable>": its arguments and its environment.
const spawned = MutableHashMap.empty<string, ReadonlyArray<string>>();
const spawnedEnv = MutableHashMap.empty<string, Readonly<Record<string, string | undefined>>>();
// The SIGKILL escalation each spawn asked for, keyed the same way.
const spawnedForceKill = MutableHashMap.empty<string, ChildProcess.CommandOptions["forceKillAfter"]>();

// Fake reviewer CLIs: the grok model name picks the failure; the claude model name picks an accept
// report or a run that ended at the output-token cap.
const seatOutput = (command: ChildProcess.StandardCommand): SeatOutput =>
  Match.value(command.command).pipe(
    Match.when("grok", () =>
      O.contains(flagValue(commandArgs(command), "-m"), "grok-sandbox-refused")
        ? { stdout: "", stderr: sandboxRefusal(" /run/example/runtime.sock"), exitCode: 1 }
        : { stdout: "", stderr: "Error: 401 Unauthorized: run grok login again\n", exitCode: 1 }
    ),
    Match.when("claude", () =>
      O.contains(flagValue(commandArgs(command), "--model"), "claude-output-capped")
        ? { stdout: JSON.stringify(outputCapEnvelope(OUTPUT_CAP_MESSAGE)), stderr: "", exitCode: 1 }
        : {
            stdout: JSON.stringify({ type: "result", subtype: "success", is_error: false, result: opusReport }),
            stderr: "",
            exitCode: 0,
          }
    ),
    Match.orElse(() => ({ stdout: "", stderr: `unexpected ${command.command}`, exitCode: 127 }))
  );

// The handle a fake seat runs as, by the model it is spawned with: a seat that never exits, one that prints and
// then stalls, one that reports after four of its five minutes, or the output its route and model pick.
const fakeSeatHandle = (command: ChildProcess.StandardCommand) =>
  Match.value(O.getOrElse(flagValue(commandArgs(command), "--model"), () => "")).pipe(
    Match.when("claude-stuck", () => stuckHandle),
    Match.when("claude-stalled", () => stalledHandle),
    Match.when("claude-slow", () => seatHandle(seatOutput(command), Effect.sleep("4 minutes"))),
    Match.orElse(() => command.pipe(seatOutput, seatHandle))
  );

const fakeSeats = ChildProcessSpawner.make((command) =>
  ChildProcess.isStandardCommand(command)
    ? Effect.sync(() => {
        const key = `${command.options.cwd ?? ""} ${command.command}`;
        MutableHashMap.set(spawned, key, commandArgs(command));
        MutableHashMap.set(spawnedEnv, key, command.options.env ?? {});
        MutableHashMap.set(spawnedForceKill, key, command.options.forceKillAfter);
        return fakeSeatHandle(command);
      })
    : Effect.die("unexpected piped command")
);

const SeatsLayer = DrawingCritics.layer.pipe(
  Layer.provide(PdfTools.makeLayer()),
  Layer.provide(Layer.succeed(ChildProcessSpawner.ChildProcessSpawner, fakeSeats)),
  Layer.provideMerge(Layer.mergeAll(MemoryFileSystem.layer, Path.layer))
);

const grokSeat = (model: string) =>
  CriticReviewer.make({
    name: "grok-4.7",
    idPrefix: "G",
    route: "grok",
    model,
    effort: O.some("xhigh"),
    scope: "matter",
  });

const fableSeat = (model: string) =>
  CriticReviewer.make({
    name: "claude-fable-5.1",
    idPrefix: "F",
    route: "claude",
    model,
    effort: O.some("xhigh"),
    scope: "matter",
  });

const opusSeat = CriticReviewer.make({
  name: "claude-opus-5.5",
  idPrefix: "O",
  route: "claude",
  model: "claude-opus-5-5",
  effort: O.some("xhigh"),
  scope: "matter",
});

// A repository root holding the critic prompt, and a pack and loop directory for one scenario, all in memory.
const seatScenario = Effect.fnUntraced(function* (name: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = path.resolve(".");
  const template = path.join(root, DRAWING_CRITIC_PROMPT_TEMPLATE);
  yield* fs.makeDirectory(path.join(root, ".git"), { recursive: true });
  yield* fs.makeDirectory(path.dirname(template), { recursive: true });
  yield* fs.writeFileString(template, "Review the drawing set. Read prior/SUMMARY.md first.\n");
  const packDir = path.join("/work", name, "pack");
  const loopDir = path.join("/work", name, "loop-1");
  yield* fs.makeDirectory(packDir, { recursive: true });
  const pack = yield* encodeCriticPackManifest(
    CriticPackManifest.make({
      schemaVersion: "drawing-critic-pack/v1",
      title: "Synthetic bracket",
      sheetSetSha256: Sha256Hex.make(Str.repeat(64)("a")),
      specSha256: Sha256Hex.make(Str.repeat(64)("b")),
      sheets: ["render/pg-1.png"],
      zooms: [],
      svgs: ["render/fig-1.svg"],
      images: [],
      strokeTable: "render/RENDER.md",
      measurements: O.some("render/MEASUREMENTS.md"),
      brief: "BRIEF.md",
    })
  );
  yield* fs.writeFileString(path.join(packDir, "pack.json"), pack);
  return { packDir, loopDir };
});

// The last argument (the prompt) a fake seat was spawned with.
const promptOf = (args: O.Option<ReadonlyArray<string>>) =>
  O.getOrElse(
    O.flatMap(args, (all) => A.last(all)),
    () => ""
  );

// The most test minutes a seat sequence may take before the test fails instead of waiting on it.
const SEQUENCE_TEST_MINUTES = 120;

// Moves the test clock on a minute at a time until the sequence ends. TestClock.adjust only fires sleeps
// already registered, so the clock keeps moving for as long as the fiber runs, however late a seat registers
// its time limit. Between steps the sequence gets up to 20 ms of real time for the work the test clock does not
// drive (a report digest is a real promise). A sequence still running after SEQUENCE_TEST_MINUTES fails.
const finishSequence = <A, E>(fiber: Fiber.Fiber<A, E>, minutesLeft: number): Effect.Effect<A, E> =>
  Fiber.await(fiber).pipe(
    Effect.timeoutOption("20 millis"),
    TestClock.withLive,
    Effect.flatMap(
      O.match({
        onSome: () => Fiber.join(fiber),
        onNone: () =>
          minutesLeft === 0
            ? Effect.die(`the critic sequence was still running after ${SEQUENCE_TEST_MINUTES} test minutes`)
            : TestClock.adjust("1 minute").pipe(Effect.andThen(finishSequence(fiber, minutesLeft - 1))),
      })
    )
  );

// Runs the sequence with a 5-minute seat limit while the test clock moves on until it ends, so a stuck seat
// reaches its limit whenever its run starts.
const runSeats = Effect.fnUntraced(function* (name: string, reviewers: ReadonlyArray<CriticReviewer>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const critics = yield* DrawingCritics;
  const { packDir, loopDir } = yield* seatScenario(name);
  const fiber = yield* critics
    .runSequence(CriticRunRequest.make({ loop: 1, loopDir, packDir, reviewers, timeoutMinutes: 5 }))
    .pipe(Effect.forkChild);
  const record = yield* finishSequence(fiber, SEQUENCE_TEST_MINUTES);
  const outcomes = A.map(record.runs, (run) => [run.reviewer.name, run.exitCode, O.getOrNull(run.report)] as const);
  const priorFiles = A.sort(yield* fs.readDirectory(path.join(loopDir, "prior")), Order.String);
  const allFindings = yield* fs.readFileString(path.join(loopDir, "ALL-FINDINGS.md"));
  const loop = yield* fs.readFileString(path.join(loopDir, "loop.json")).pipe(Effect.flatMap(decodeCriticLoopRecord));
  const summary = yield* critics.summary(loopDir);
  const opusPrompt = promptOf(MutableHashMap.get(spawned, `${packDir} claude`));
  const opusEnv = O.getOrElse(MutableHashMap.get(spawnedEnv, `${packDir} claude`), () => ({}));
  return { record, outcomes, priorFiles, allFindings, loop, summary, opusPrompt, opusEnv, packDir, loopDir };
});

describe("critic sequence seats", () => {
  it.layer(SeatsLayer, { timeout: "30 seconds" })((it) => {
    it.effect(
      "skips a Grok seat whose strict sandbox cannot start, records why, and runs the next reviewer",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const run = yield* runSeats("refused", [grokSeat("grok-sandbox-refused"), opusSeat]);
        // the sequence went on: grok exited 1 without a report, opus reported
        expect(run.outcomes).toStrictEqual([
          ["grok-4.7", 1, null],
          ["claude-opus-5.5", 0, "claude-opus-5.5.json"],
        ]);
        assertSome(
          O.flatMap(A.head(run.record.runs), (grok) => O.flatMap(grok.unavailable, (seat) => seat.path)),
          "/run/example/runtime.sock"
        );
        assertNone(O.flatMap(A.last(run.record.runs), (opus) => opus.unavailable));
        // loop.json states which seat was missing and why
        expect(run.loop.runs).toEqual(run.record.runs);
        const missing =
          "grok-4.7 (ids G-…) did not run: grok refused to start: its --sandbox strict profile could not resolve the runtime-socket deny path /run/example/runtime.sock on this host.";
        expect(run.allFindings).toContain(missing);
        expect(run.summary).toContain(missing);
        // the summary opus read names the missing seat; nothing points it at a grok report
        expect(yield* fs.readFileString(path.join(run.packDir, "prior", "SUMMARY.md"))).toContain(missing);
        expect(run.opusPrompt).toContain("Review the drawing set.");
        expect(run.opusPrompt).not.toContain("grok-4.7.json");
        expect(run.opusPrompt).toContain("render/MEASUREMENTS.md");
        expect(run.priorFiles).toStrictEqual(["2-claude-opus-5.5.json"]);
      })
    );

    it.effect(
      "keeps any other Grok failure a plain failed run",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const run = yield* runSeats("unauthorized", [grokSeat("grok-4.7"), opusSeat]);
        expect(run.outcomes).toStrictEqual([
          ["grok-4.7", 1, null],
          ["claude-opus-5.5", 0, "claude-opus-5.5.json"],
        ]);
        assertNone(O.flatMap(A.head(run.record.runs), (grok) => grok.unavailable));
        expect(run.allFindings).not.toContain("did not run");
        expect(run.summary).not.toContain("did not run");
        expect(yield* fs.readFileString(path.join(run.loopDir, "grok-4.7.log"))).toContain("401 Unauthorized");
      })
    );

    it.effect(
      "records a seat that runs past its time limit and runs the next reviewer",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const run = yield* runSeats("time-limit", [fableSeat("claude-stuck"), opusSeat]);
        // the stuck seat was stopped and recorded; the sequence went on to opus
        expect(run.outcomes).toStrictEqual([
          ["claude-fable-5.1", CRITIC_TIME_LIMIT_EXIT_CODE, null],
          ["claude-opus-5.5", 0, "claude-opus-5.5.json"],
        ]);
        const fable = O.getOrThrow(A.head(run.record.runs));
        assertSome(
          O.map(fable.unavailable, (seat) => seat.reason),
          "time-limit"
        );
        assertSome(
          O.flatMap(fable.unavailable, (seat) => seat.limit),
          CriticSeatLimit.make({ amount: 5, unit: "minutes" })
        );
        expect(run.loop.runs).toEqual(run.record.runs);
        const missing =
          "claude-fable-5.1 (ids F-…) did not finish: the seat ran past its 5-minute limit and was stopped. It wrote no report; there are no F- findings to assess.";
        expect(run.allFindings).toContain(missing);
        expect(run.summary).toContain(missing);
        expect(yield* fs.readFileString(path.join(run.packDir, "prior", "SUMMARY.md"))).toContain(missing);
        expect(criticRunLine(fable)).toBe(
          "1. claude-fable-5.1: stopped at its time limit, no report (the seat ran past its 5-minute limit and was stopped)"
        );
        expect(run.priorFiles).toStrictEqual(["2-claude-opus-5.5.json"]);
        // a seat that ignores SIGTERM is killed, so stopping it cannot hold the sequence
        assertSome(MutableHashMap.get(spawnedForceKill, `${run.packDir} claude`), "30 seconds");
        // the stopped seat's log and raw output are written even though it printed nothing
        expect(yield* fs.readFileString(path.join(run.loopDir, "claude-fable-5.1.log"))).toBe("");
        expect(yield* fs.readFileString(path.join(run.loopDir, "claude-fable-5.1.raw"))).toBe("");
      })
    );

    it.effect(
      "keeps what a seat printed before its time limit, and does not read it as a report",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const run = yield* runSeats("stalled", [fableSeat("claude-stalled"), opusSeat]);
        expect(run.outcomes).toStrictEqual([
          ["claude-fable-5.1", CRITIC_TIME_LIMIT_EXIT_CODE, null],
          ["claude-opus-5.5", 0, "claude-opus-5.5.json"],
        ]);
        const fable = O.getOrThrow(A.head(run.record.runs));
        assertSome(
          O.map(fable.unavailable, (seat) => seat.reason),
          "time-limit"
        );
        expect(fable.findings).toBe(0);
        assertNone(fable.reportSha256);
        // what the seat printed before it stalled is kept, in order, named as an exited seat's output is
        expect(yield* fs.readFileString(path.join(run.loopDir, "claude-fable-5.1.log"))).toBe(stalledStderr);
        expect(yield* fs.readFileString(path.join(run.loopDir, "claude-fable-5.1.raw"))).toBe(stalledStdout);
        // what it printed is a whole report with F-01, so only the time limit keeps it out of the loop
        const printed = yield* extractReportText({ route: "claude", text: stalledStdout }).pipe(
          O.getOrThrow,
          decodeCriticReport
        );
        expect(A.map(printed.findings, (found) => found.id)).toStrictEqual(["F-01"]);
        // the report envelope it printed was never decoded: no report file, nothing in prior/, no F-01
        expect(yield* fs.exists(path.join(run.loopDir, "claude-fable-5.1.json"))).toBe(false);
        expect(run.priorFiles).toStrictEqual(["2-claude-opus-5.5.json"]);
        expect(run.allFindings).not.toContain("F-01");
        expect(run.opusPrompt).not.toContain("F-01");
        expect(yield* fs.readFileString(path.join(run.packDir, "prior", "SUMMARY.md"))).not.toContain("F-01");
      })
    );

    it.effect(
      "stops a seat at its time limit however late in the sequence its run starts",
      Effect.fnUntraced(function* () {
        // three seats that each report after four of their five minutes
        const slowSeat = CriticReviewer.make({ ...opusSeat, model: "claude-slow" });
        const run = yield* runSeats("late-limit", [slowSeat, slowSeat, slowSeat, fableSeat("claude-stuck")]);
        expect(run.outcomes).toStrictEqual([
          ["claude-opus-5.5", 0, "claude-opus-5.5.json"],
          ["claude-opus-5.5", 0, "claude-opus-5.5.json"],
          ["claude-opus-5.5", 0, "claude-opus-5.5.json"],
          ["claude-fable-5.1", CRITIC_TIME_LIMIT_EXIT_CODE, null],
        ]);
        expect(run.priorFiles).toStrictEqual([
          "1-claude-opus-5.5.json",
          "2-claude-opus-5.5.json",
          "3-claude-opus-5.5.json",
        ]);
        // Measure from this sequence; earlier tests may already have advanced the shared clock.
        const first = O.getOrThrow(A.head(run.record.runs));
        const stuck = O.getOrThrow(A.last(run.record.runs));
        const elapsed =
          DateTime.toEpochMillis(DateTime.makeUnsafe(stuck.startedAt)) -
          DateTime.toEpochMillis(DateTime.makeUnsafe(first.startedAt));
        expect(elapsed).toBeGreaterThanOrEqual(Duration.toMillis("12 minutes"));
      })
    );

    it.effect(
      "records a Claude seat that ends at its output-token cap and runs the next reviewer",
      Effect.fnUntraced(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const run = yield* runSeats("output-limit", [fableSeat("claude-output-capped"), opusSeat]);
        expect(run.outcomes).toStrictEqual([
          ["claude-fable-5.1", 1, null],
          ["claude-opus-5.5", 0, "claude-opus-5.5.json"],
        ]);
        const fable = O.getOrThrow(A.head(run.record.runs));
        assertSome(
          O.map(fable.unavailable, (seat) => seat.reason),
          "output-limit"
        );
        assertSome(
          O.flatMap(fable.unavailable, (seat) => seat.limit),
          CriticSeatLimit.make({ amount: 64000, unit: "output-tokens" })
        );
        const missing =
          "claude-fable-5.1 (ids F-…) did not finish: claude ended the run with api_error max_output_tokens: one response ran past the 64000 output-token cap. It wrote no report; there are no F- findings to assess.";
        expect(run.allFindings).toContain(missing);
        expect(run.summary).toContain(missing);
        expect(yield* fs.readFileString(path.join(run.packDir, "prior", "SUMMARY.md"))).toContain(missing);
        // the raw output stays beside the record for the operator
        expect(yield* fs.readFileString(path.join(run.loopDir, "claude-fable-5.1.raw"))).toContain("max_output_tokens");
        // every claude seat runs with an output and a thinking cap
        expect(R.keys(run.opusEnv)).toEqual(expect.arrayContaining(R.keys(CRITIC_CLAUDE_LIMITS)));
      })
    );
  });
});

// A Letter sheet in points: a 100 × 140 mm outline from (50, 60) mm, a dashed broken line inside it, six
// shading strokes (three parallel 1.5 mm apart, one collinear piece, one far parallel, one horizontal), a
// stroked label above the top margin, an outlined label, and one text label.
const syntheticSheet = A.join(
  [
    '<svg xmlns="http://www.w3.org/2000/svg" width="612.000pt" height="792.000pt" viewBox="0 0 612.000 792.000">',
    '<path id="labels" d="M300 60L312 60" fill="none" stroke="#000000" stroke-width="0.992"/>',
    '<path id="label-outlines" d="M290 740Q295 730 300 740Z" fill="#000000" stroke="none"/>',
    '<path id="shading" d="M170.079 226.772L170.079 283.465M174.331 226.772L174.331 283.465M178.583 226.772L178.583 283.465M198.425 425.197L198.425 453.543M170.079 289.134L170.079 294.803M283.465 340.157L311.811 340.157" fill="none" stroke="#000000" stroke-width="0.567"/>',
    '<path id="broken" d="M200 300L300 300" fill="none" stroke="#000000" stroke-width="0.992" stroke-dasharray="8.504 4.252"/>',
    '<path id="figure" d="M141.732 170.079L425.197 170.079L425.197 566.929L141.732 566.929Z" fill="none" stroke="#000000" stroke-width="0.992"/>',
    '<text x="306" y="760" font-family="DejaVu Sans" font-size="12" text-anchor="middle" fill="#000000">FIG. 1 &amp; 2</text>',
    "</svg>",
  ],
  "\n"
);

describe("figure measurements", () => {
  it("measures the ink boxes against the 1.84(g) margins, the path layers, the shading, and the labels", () => {
    const figure = figureMeasurements({ figure: 1, view: "front", svgFile: "render/fig-1.svg", svg: syntheticSheet });
    expect([figure.sheetWidthMm, figure.sheetHeightMm]).toStrictEqual([215.9, 279.4]);
    // the view's box: the outline widened by half its 0.35 mm stroke
    assertSome(
      O.map(figure.drawing, (box) => [box.minXMm, box.minYMm, box.maxXMm, box.maxYMm]),
      [49.825, 59.825, 150.175, 200.175]
    );
    assertSome(
      O.map(figure.drawing, (box) => [box.top.meets, box.left.meets, box.right.meets, box.bottom.meets]),
      [true, true, true, true]
    );
    assertSome(
      O.map(figure.drawing, (box) => [box.right.distanceMm, box.right.minimumMm]),
      [65.725, 15]
    );
    // the stroked label sits 20.99 mm from the top edge: inside the 2.5 cm top margin
    assertSome(
      O.map(figure.ink, (box) => [box.top.distanceMm, box.top.minimumMm, box.top.meets]),
      [20.992, 25, false]
    );
    assertSome(
      O.map(figure.ink, (box) => [box.bottom.distanceMm, box.bottom.meets]),
      [18.344, true]
    );
    const layers = A.map(figure.layers, (layer) => [
      layer.id,
      O.getOrNull(layer.strokeWidthMm),
      layer.dashArrayMm,
      layer.segments,
    ]);
    expect(layers).toStrictEqual([
      ["labels", 0.35, [], 1],
      ["label-outlines", null, [], 2],
      ["shading", 0.2, [], 6],
      ["broken", 0.35, [3, 1.5], 1],
      ["figure", 0.35, [], 4],
    ]);
    const outlineLength = O.getOrElse(
      O.map(
        A.findFirst(figure.layers, (layer) => layer.id === "figure"),
        (layer) => layer.lengthMm
      ),
      () => 0
    );
    expect(outlineLength).toBeCloseTo(480, 2);
    const shading = [
      figure.shading.count,
      O.getOrNull(figure.shading.minLengthMm),
      O.getOrNull(figure.shading.medianLengthMm),
      O.getOrNull(figure.shading.maxLengthMm),
      O.getOrNull(figure.shading.minParallelGapMm),
    ];
    expect(shading).toStrictEqual([6, 2, 15, 20, 1.5]);
    expect(figure.labels).toEqual([
      { text: "FIG. 1 & 2", fontFamily: "DejaVu Sans", sizePt: 12, xMm: 107.95, yMm: 268.111, anchor: "middle" },
    ]);
  });

  it("pairs the converging hatch strokes of a two-point face and measures their gap across the strokes", () => {
    // Eleven 40 mm strokes start 2 mm apart at x = 50 mm, all aimed at one vanishing point 200 mm to the right:
    // each turns about 0.57° from the next, across 0° (a direction wraps at 180°), and half-way along they stand
    // 1.8 mm apart. A twelfth stroke 8° off the band crosses its last stroke and is no parallel neighbour.
    const strokes = [
      "M141.732 283.465L254.977 289.127",
      "M141.732 289.134L255.028 293.666",
      "M141.732 294.803L255.067 298.203",
      "M141.732 300.472L255.095 302.74",
      "M141.732 306.142L255.112 307.276",
      "M141.732 311.811L255.118 311.811",
      "M141.732 317.48L255.112 316.347",
      "M141.732 323.15L255.095 320.882",
      "M141.732 328.819L255.067 325.419",
      "M141.732 334.488L255.028 329.956",
      "M141.732 340.157L254.977 334.495",
      "M141.732 342.992L254.015 327.212",
    ];
    const svg = A.join(
      [
        '<svg xmlns="http://www.w3.org/2000/svg" width="612.000pt" height="792.000pt" viewBox="0 0 612.000 792.000">',
        `<path id="shading" d="${A.join(strokes, " ")}" fill="none" stroke="#000000" stroke-width="0.567"/>`,
        "</svg>",
      ],
      "\n"
    );
    const figure = figureMeasurements({ figure: 1, view: "top-perspective", svgFile: "render/fig-1.svg", svg });
    expect(figure.shading.count).toBe(12);
    assertSome(figure.shading.minLengthMm, 40);
    assertSome(figure.shading.minParallelGapMm, 1.8);
  });

  it("reports no box, no layers and no shading for an empty sheet", () => {
    const figure = figureMeasurements({
      figure: 2,
      view: "rear",
      svgFile: "render/fig-2.svg",
      svg: '<svg width="612pt" height="792pt" viewBox="0 0 612 792"></svg>',
    });
    assertNone(figure.ink);
    assertNone(figure.drawing);
    expect(figure.layers).toStrictEqual([]);
    assertNone(figure.shading.minParallelGapMm);
    expect(figure.shading.count).toBe(0);
  });
});

describe("PDF tool output", () => {
  it("reads every page's MediaBox and CropBox from pdfinfo -box", () => {
    const text = A.join(
      [
        "Producer:        cairo 1.18.6",
        "Pages:           2",
        "Page    1 size:  612 x 792 pts (letter)",
        "Page    1 MediaBox:      0.00     0.00   612.00   792.00",
        "Page    1 CropBox:       0.00     0.00   612.00   792.00",
        "Page    1 BleedBox:      0.00     0.00   612.00   792.00",
        "Page    2 MediaBox:      0.00     0.00   612.00   792.00",
        "Page    2 CropBox:      10.00    20.00   602.00   772.00",
        "PDF version:     1.6",
      ],
      "\n"
    );
    const pages = parsePdfInfoBoxes(text);
    expect(A.map(pages, (page) => page.page)).toStrictEqual([1, 2]);
    expect(A.map(pages, (page) => [page.mediaBox.widthMm, page.mediaBox.heightMm])).toStrictEqual([
      [215.9, 279.4],
      [215.9, 279.4],
    ]);
    expect(A.map(pages, (page) => [page.cropBox.leftPt, page.cropBox.bottomPt, page.cropBox.widthMm])).toStrictEqual([
      [0, 0, 215.9],
      [10, 20, 208.844],
    ]);
    // a page that lists no CropBox gets its MediaBox
    const mediaOnly = parsePdfInfoBoxes("Page    1 MediaBox:      0.00     0.00   612.00   792.00\n");
    expect(A.map(mediaOnly, (page) => page.cropBox.heightPt)).toStrictEqual([792]);
  });

  it("reads each pdffonts row from the right, so a type with a space parses", () => {
    const text = A.join(
      [
        "name                                 type              encoding         emb sub uni object ID",
        "------------------------------------ ----------------- ---------------- --- --- --- ---------",
        "KKISDR+DejaVuSans                    TrueType          WinAnsi          yes yes yes      7  0",
        "ABCDEF+LiberationSans-Bold           CID TrueType      Identity-H       yes yes yes     12  0",
        "Helvetica                            Type 1            Standard         no  no  no      15  0",
        "",
      ],
      "\n"
    );
    expect(A.map(parsePdfFonts(text), (font) => [font.name, font.type, font.embedded, font.subset])).toStrictEqual([
      ["KKISDR+DejaVuSans", "TrueType", true, true],
      ["ABCDEF+LiberationSans-Bold", "CID TrueType", true, true],
      ["Helvetica", "Type 1", false, false],
    ]);
    expect(parsePdfFonts("name type encoding emb sub uni object ID\n--- --- ---\n")).toStrictEqual([]);
  });
});

describe("PDF measurements codec properties", () => {
  it.effect.prop(
    "preserves schema-generated discovery outcomes and defaults legacy payloads",
    [Arbitrary.schema(CriticPdfMeasurements)],
    Effect.fnUntraced(function* ([pdf]) {
      const codec = S.fromJsonString(CriticPdfMeasurements);
      const equivalent = S.toEquivalence(CriticPdfMeasurements);
      const roundTrip = yield* S.decodeEffect(codec)(yield* S.encodeEffect(codec)(pdf));
      expect(equivalent(roundTrip, pdf)).toBe(true);
      expect(roundTrip.containerDiscovery).toBe(pdf.containerDiscovery);
      const encoded = yield* S.encodeEffect(CriticPdfMeasurements)(pdf);
      const legacy = yield* S.decodeEffect(CriticPdfMeasurements)(Struct.omit(encoded, ["containerDiscovery"]));
      expect(legacy.containerDiscovery).toBe("complete");
      expect(equivalent(legacy, CriticPdfMeasurements.make({ ...pdf, containerDiscovery: "complete" }))).toBe(true);
    }),
    { arbitrary: fcRuns(25) }
  );
});

describe("MEASUREMENTS.md", () => {
  it.effect(
    "renders the PDF facts and every figure, and round-trips measurements.json",
    Effect.fnUntraced(function* () {
      const measurements = CriticMeasurements.make({
        schemaVersion: "drawing-critic-measurements/v1",
        title: "Synthetic bracket",
        sheetSetSha256: Sha256Hex.make(Str.repeat(64)("a")),
        specSha256: Sha256Hex.make(Str.repeat(64)("b")),
        pdf: CriticPdfMeasurements.make({
          file: "render/sheets.pdf",
          version: "1.6",
          pageCount: 1,
          pages: parsePdfInfoBoxes(
            "Page    1 MediaBox:      0.00     0.00   612.00   792.00\nPage    1 CropBox:       0.00     0.00   612.00   792.00\n"
          ),
          fonts: parsePdfFonts(
            "name type encoding emb sub uni object ID\n--- ---\nKKISDR+DejaVuSans TrueType WinAnsi yes yes yes 7 0\n"
          ),
          undecodableStreams: [
            UndecodableStream.make({ objectNumber: 52, generation: 0, reason: "unexpected end of file" }),
          ],
          streamCheck: "complete",
        }),
        figures: [figureMeasurements({ figure: 1, view: "front", svgFile: "render/fig-1.svg", svg: syntheticSheet })],
      });
      const markdown = measurementsMarkdown(measurements);
      expect(markdown).toContain("PDF version: 1.6; pages: 1; FlateDecode stream check: complete.");
      expect(markdown).toContain("- object 52 0 R: unexpected end of file");
      expect(markdown).toContain("| 1 | 0 0 612 792 | 215.9 × 279.4 | 0 0 612 792 | 215.9 × 279.4 |");
      expect(markdown).toContain("| KKISDR+DejaVuSans | TrueType | yes | yes |");
      expect(markdown).toContain("## FIG 1 (front) — render/fig-1.svg");
      expect(markdown).toContain("| top | 20.992 | 25 | no |");
      expect(markdown).toContain("| broken | 0.35 | 3 1.5 | 1 |");
      expect(markdown).toContain(
        "Shading strokes: 6; length min 2 / median 15 / max 20 mm; smallest gap between parallel neighbours (directions within 2.5°) 1.5 mm."
      );
      expect(markdown).toContain("| FIG. 1 & 2 | DejaVu Sans | 12 | 107.95 | 268.111 | middle |");
      const json = yield* encodeCriticMeasurements(measurements);
      expect(yield* decodeCriticMeasurements(json)).toEqual(measurements);
      expect(measurements.pdf.containerDiscovery).toBe("complete");
      const legacyPdf = yield* S.decodeEffect(CriticPdfMeasurements)({
        file: "render/sheets.pdf",
        version: "1.6",
        pageCount: 0,
        pages: [],
        fonts: [],
        undecodableStreams: [],
        streamCheck: "complete",
      });
      expect(legacyPdf.containerDiscovery).toBe("complete");
      const inflateLimited = CriticMeasurements.make({
        ...measurements,
        pdf: CriticPdfMeasurements.make({ ...measurements.pdf, undecodableStreams: [], streamCheck: "limit-reached" }),
      });
      expect(measurementsMarkdown(inflateLimited)).toContain("global stream inspection is incomplete");

      for (const containerDiscovery of ["complete", "limit-reached", "encrypted"] as const) {
        const incomplete = CriticMeasurements.make({
          ...measurements,
          pdf: CriticPdfMeasurements.make({ ...measurements.pdf, undecodableStreams: [], containerDiscovery }),
        });
        const report = measurementsMarkdown(incomplete);
        expect(report).toContain(`PDF container discovery: ${containerDiscovery}.`);
        expect(report).toContain(
          containerDiscovery === "complete"
            ? "Undecodable streams: none."
            : "Undecodable streams: none among inspected streams; global stream inspection is incomplete."
        );
        expect(yield* decodeCriticMeasurements(yield* encodeCriticMeasurements(incomplete))).toEqual(incomplete);
      }
    })
  );
});
