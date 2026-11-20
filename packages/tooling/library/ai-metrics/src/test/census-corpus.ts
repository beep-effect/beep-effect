/**
 * A synthetic Claude Code and Codex transcript corpus for census tests, with planted canary strings.
 *
 * **Details**
 *
 * Every transcript here is invented. Canaries sit in prompt text, command text, tool output, file and
 * directory names under the home directory, and session identifiers, so a test can prove that no census
 * output carries any of them. The corpus exercises compaction, a subagent context, carried cost, two
 * calibration samples, every turn class, re-run detection, log digs, the named offenders, the window
 * bounds, and Codex call shapes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { CensusWindow } from "../census-report.ts";

const encodeRecord = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

/**
 * The canary strings planted in the corpus; none may appear in any census output.
 *
 * **Example** (Check output for canaries)
 *
 * ```ts
 * import { censusCorpusCanaries } from "@beep/repo-ai-metrics/test/census-corpus"
 * console.log(censusCorpusCanaries.some((canary) => "a clean report".includes(canary))) // false
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const censusCorpusCanaries = [
  "PROMPTCANARY",
  "CMDCANARY",
  "OUTPUTCANARY",
  "PATHCANARY",
  "SESSIONCANARY",
  "SUBCANARY",
  "SUMMARYCANARY",
  "CODEXCANARY",
  "LATECANARY",
] as const;

const sessionId = "session-0f1e-SESSIONCANARY";
const project = "-home-PATHCANARY-beep-effect";

/**
 * The tool output texts of the corpus, exported so tests can derive sizes from them.
 *
 * **Example** (Read the size of the first check output)
 *
 * ```ts
 * import { censusCorpusTexts } from "@beep/repo-ai-metrics/test/census-corpus"
 * console.log(censusCorpusTexts.checkFailure.length) // 4000
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const censusCorpusTexts = (() => {
  const unbuilt = "error TS6305: Output file OUTPUTCANARY.d.ts has not been built from source file";
  const gateRow = "#12\tready\tmain\tabc1234\tclean\tok=3/3";
  const envelope = '{"schemaVersion":1,"job":"j"}';
  return {
    unbuilt,
    checkFailure: `${unbuilt}\n${Str.repeat(4000 - Str.length(unbuilt) - 1)("x")}`,
    capturedLog: Str.repeat(500)("y"),
    testsPassed: "Test Files  2 passed (2)\n     Tests  12 passed (12)",
    edited: "ok",
    failed: "FAIL x",
    search: Str.repeat(6000)("q"),
    gateRow,
    envelope,
    gateTable: `${gateRow}\n${gateRow}\n${envelope}`,
    helpUsage: "USAGE",
    helpFlags: ["GLOBAL FLAGS", "  --help, -h  Show help", "  --version  Show version"],
    help: "USAGE\n  beep yeet open\n\nGLOBAL FLAGS\n  --help, -h  Show help\n  --version  Show version\n\nDESCRIPTION done",
    persisted: "<persisted-output>\nPreview (first 2KB)\nstuff",
    ciLog: "ok",
    dig: "error: boom",
    codexTest: "FAIL OUTPUTCANARY\nTests  1 passed",
  } as const;
})();

const texts = censusCorpusTexts;

const assistant = (
  timestamp: string,
  id: string,
  usage: Readonly<Record<string, number>>,
  content: ReadonlyArray<unknown>
) => ({ type: "assistant", timestamp, sessionId, message: { id, role: "assistant", usage, content } });
const bash = (id: string, command: string) => ({ type: "tool_use", id, name: "Bash", input: { command } });
const result = (timestamp: string, toolUseId: string, content: unknown) => ({
  type: "user",
  timestamp,
  sessionId,
  message: { role: "user", content: [{ type: "tool_result", tool_use_id: toolUseId, content }] },
});
const at = (time: string) => `2026-11-12T${time}Z`;
const sub = (time: string) => `2026-11-13T${time}Z`;

const sessionRecords = [
  assistant("2026-11-10T09:00:00Z", "m0", { input_tokens: 999, output_tokens: 9 }, [
    { type: "text", text: "PROMPTCANARY early" },
  ]),
  {
    type: "user",
    timestamp: at("10:00:00"),
    sessionId,
    cwd: "/home/PATHCANARY/beep-effect",
    message: { content: "PROMPTCANARY check" },
  },
  assistant(at("10:01:00"), "m1", { input_tokens: 100, output_tokens: 10 }, [
    bash("t1", "cd /home/PATHCANARY && bun run check > /tmp/CMDCANARY-check.log 2>&1"),
  ]),
  result(at("10:02:00"), "t1", texts.checkFailure),
  assistant(
    at("10:03:00"),
    "m2",
    { input_tokens: 50, cache_creation_input_tokens: 1000, cache_read_input_tokens: 1050, output_tokens: 20 },
    [{ type: "tool_use", id: "t2", name: "Read", input: { file_path: "/tmp/CMDCANARY-check.log" } }]
  ),
  result(at("10:04:00"), "t2", [{ type: "text", text: texts.capturedLog }]),
  assistant(at("10:05:00"), "m3", { input_tokens: 10, cache_read_input_tokens: 2600, output_tokens: 5 }, [
    bash("t3", "cd /home/PATHCANARY && bun run check | tail -5"),
  ]),
  result(at("10:06:00"), "t3", texts.testsPassed),
  { type: "system", subtype: "compact_boundary", timestamp: at("11:00:00"), content: "compacted" },
  { type: "user", isCompactSummary: true, timestamp: at("11:00:01"), message: { content: "SUMMARYCANARY summary" } },
  assistant(at("11:01:00"), "m4", { input_tokens: 5, cache_read_input_tokens: 100, output_tokens: 1 }, [
    {
      type: "tool_use",
      id: "t4",
      name: "Edit",
      input: { file_path: "/home/PATHCANARY/x.ts", old_string: "CMDCANARY" },
    },
  ]),
  result(at("11:02:00"), "t4", texts.edited),
  assistant(at("11:03:00"), "m5", { input_tokens: 200, output_tokens: 2 }, [bash("t5", "bun run check")]),
  result(at("11:04:00"), "t5", texts.failed),
  assistant("2026-11-19T00:00:00Z", "m6", { input_tokens: 7777 }, [bash("t6", "gh run view 1 --log")]),
  result("2026-11-19T00:00:01Z", "t6", "late OUTPUTCANARY"),
  { type: "user", message: { content: [{ type: "tool_result", tool_use_id: "t6", content: Str.repeat(100)("z") }] } },
];

const subagentRecords = [
  assistant(sub("10:00:00"), "s1", { input_tokens: 1000, output_tokens: 0 }, [bash("u1", "rg SUBCANARY src")]),
  result(sub("10:00:01"), "u1", texts.search),
  assistant(sub("10:01:00"), "s2", { cache_read_input_tokens: 4000, output_tokens: 0 }, [
    bash("u2", "bun run beep yeet gate-table"),
  ]),
  result(sub("10:01:01"), "u2", texts.gateTable),
  assistant(sub("10:02:00"), "s3", { input_tokens: 10, output_tokens: 1 }, [
    bash("u3", "bun run beep yeet open --help"),
  ]),
  result(sub("10:02:01"), "u3", texts.help),
  assistant(sub("10:03:00"), "s4", { input_tokens: 5 }, [{ type: "text", text: "PROMPTCANARY done" }]),
  assistant(sub("10:04:00"), "s5", { input_tokens: 3 }, [
    { type: "tool_use", id: "u5", name: "Read", input: { file_path: "/home/PATHCANARY/tool-results/abc.txt" } },
  ]),
  result(sub("10:04:01"), "u5", texts.persisted),
  assistant(sub("10:05:00"), "s6", { input_tokens: 2 }, [bash("u6", "gh run view 99 --log > /tmp/ci-CMDCANARY.log")]),
  result(sub("10:05:01"), "u6", texts.ciLog),
  assistant(sub("10:06:00"), "s7", { input_tokens: 1 }, [bash("u7", "rg error /tmp/ci-CMDCANARY.log")]),
  result(sub("10:06:01"), "u7", texts.dig),
];

const response = (time: string, payload: unknown) => ({ type: "response_item", timestamp: at(time), payload });
const call = (time: string, callId: string, name: string, argumentsText: string | undefined) =>
  response(time, {
    type: "function_call",
    name,
    call_id: callId,
    ...(argumentsText === undefined ? {} : { arguments: argumentsText }),
  });
const output = (time: string, callId: string, value: unknown) =>
  response(time, { type: "function_call_output", call_id: callId, output: value });
const tokens = (timestamp: string, info: unknown) => ({
  type: "event_msg",
  timestamp,
  payload: { type: "token_count", info },
});

const codexRecords = [
  {
    type: "session_meta",
    timestamp: at("09:00:00"),
    payload: { id: "SESSIONCANARY-codex", cwd: "/home/PATHCANARY/beep-effect" },
  },
  call("09:01:00", "c1", "exec_command", '{"cmd":"bunx vitest run CMDCANARY | grep FAIL"}'),
  output("09:02:00", "c1", texts.codexTest),
  call("09:03:00", "c3", "shell", '{"command":["bash","-lc","git status"]}'),
  output("09:04:00", "c3", { content: [{ type: "text", text: "clean" }] }),
  call("09:05:00", "c5", "view_image", '{"path":"CMDCANARY.png"}'),
  output("09:06:00", "c5", {}),
  response("09:07:00", {
    type: "custom_tool_call",
    name: "apply_patch",
    call_id: "c7",
    input: "*** Begin Patch CMDCANARY",
  }),
  response("09:08:00", { type: "custom_tool_call_output", call_id: "c7", output: "Done!" }),
  response("09:09:00", { type: "local_shell_call", call_id: "c9", action: { type: "exec", command: ["ls", "-la"] } }),
  output("09:10:00", "c9", "a\nb"),
  output("09:11:00", "nope", "orphan"),
  call("09:12:00", "c12", "exec_command", "not json CMDCANARY"),
  output("09:13:00", "c12", "x"),
  call("09:14:00", "c14", "exec_command", undefined),
  output("09:15:00", "c14", ""),
  call("09:16:00", "c16", "exec_command", '{"cmd":7}'),
  output("09:17:00", "c16", { other: true }),
  tokens(at("09:30:00"), { total_token_usage: { input_tokens: 1000, cached_input_tokens: 800, output_tokens: 50 } }),
  tokens(at("09:31:00"), null),
  {
    type: "response_item",
    timestamp: "2026-11-10T00:00:00Z",
    payload: { type: "function_call_output", call_id: "c1", output: "old" },
  },
  tokens("2026-11-19T00:00:00Z", {
    total_token_usage: { input_tokens: 9999, cached_input_tokens: 9999, output_tokens: 9999 },
  }),
];

const writeRecords = Effect.fnUntraced(function* (file: string, records: ReadonlyArray<unknown>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const lines = yield* Effect.forEach(records, (record) => encodeRecord(record), { concurrency: 1 });
  yield* fs.makeDirectory(path.dirname(file), { recursive: true });
  yield* fs.writeFileString(file, `${A.join(lines, "\n")}\n`);
});

/**
 * Where the synthetic corpus was written and the window its expectations assume.
 *
 * **Example** (Inspect the corpus fields)
 *
 * ```ts
 * import { CensusCorpusFixture } from "@beep/repo-ai-metrics/test/census-corpus"
 * console.log(Object.keys(CensusCorpusFixture.fields)) // ["claudeRoot", "codexRoot", "window"]
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CensusCorpusFixture extends S.Opaque<CensusCorpusFixture, { readonly brand: unique symbol }>()(
  S.Struct({ claudeRoot: S.String, codexRoot: S.String, window: CensusWindow })
) {}

/**
 * Write the synthetic corpus under a home directory.
 *
 * **Details**
 *
 * Writes the main Claude session, its subagent, a file in a skipped `tool-results` directory, a project of
 * another repository, a file older than the window and one that starts after it, and three Codex files
 * (one matching session, one of another repository, one with no session record).
 *
 * **Example** (Write the corpus under a temporary home)
 *
 * ```ts
 * import { writeCensusCorpus } from "@beep/repo-ai-metrics/test/census-corpus"
 * console.log(typeof writeCensusCorpus) // "function"
 * ```
 *
 * @param home - the fake home directory; the roots are its `.claude/projects` and `.codex/sessions`
 * @returns The roots and the window.
 * @category constructors
 * @since 0.0.0
 */
export const writeCensusCorpus = Effect.fn("CensusCorpus.write")(function* (home: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const claudeRoot = path.join(home, ".claude", "projects");
  const codexRoot = path.join(home, ".codex", "sessions");
  const projectDir = path.join(claudeRoot, project);
  const inWindow = [assistant(at("12:00:00"), "h1", { input_tokens: 1 }, [])];
  yield* writeRecords(path.join(projectDir, `${sessionId}.jsonl`), sessionRecords);
  yield* writeRecords(path.join(projectDir, sessionId, "subagents", "agent-SUBCANARY.jsonl"), subagentRecords);
  yield* writeRecords(path.join(projectDir, sessionId, "tool-results", "hidden.jsonl"), inWindow);
  yield* writeRecords(path.join(claudeRoot, "other-repo", "x.jsonl"), inWindow);
  yield* writeRecords(path.join(projectDir, "late-LATECANARY.jsonl"), [
    assistant("2026-11-20T00:00:00Z", "l1", { input_tokens: 1 }, []),
    assistant(at("12:00:00"), "l2", { input_tokens: 1 }, []),
  ]);
  const old = path.join(projectDir, "old.jsonl");
  yield* writeRecords(old, inWindow);
  const long = DateTime.toDateUtc(DateTime.makeUnsafe("2026-11-01T00:00:00Z"));
  yield* fs.utimes(old, long, long);
  const codexDay = path.join(codexRoot, "2026", "11", "12");
  yield* writeRecords(path.join(codexDay, "rollout-CODEXCANARY.jsonl"), codexRecords);
  yield* writeRecords(path.join(codexDay, "rollout-other.jsonl"), [
    {
      type: "session_meta",
      timestamp: at("09:00:00"),
      payload: { cwd: "/home/x/other-repo", runtime_workspace_roots: ["/home/x/other-repo"] },
    },
  ]);
  yield* writeRecords(
    path.join(codexDay, "rollout-noise.jsonl"),
    A.makeBy(8, () => tokens(at("09:00:00"), null))
  );
  return CensusCorpusFixture.make({
    claudeRoot,
    codexRoot,
    window: CensusWindow.make({
      since: DateTime.makeUnsafe("2026-11-11T00:00:00Z"),
      until: DateTime.makeUnsafe("2026-11-18T00:00:00Z"),
    }),
  });
});
