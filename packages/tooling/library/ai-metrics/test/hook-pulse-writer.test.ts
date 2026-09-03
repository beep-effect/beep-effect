import * as NodeURL from "node:url";
import {
  agentEvidenceRoot,
  HookPulseAgentKind,
  HookPulseDisarmSentinel,
  HookPulseDisarmWindow,
  HookPulseDisarmWindowSchemaVersion,
  HookPulseEvent,
  HookPulseEvidenceTier,
  HookPulseInstrumentClass,
  HookPulseNotificationType,
  HookPulseSchemaVersion,
  HookPulseV1,
  HookPulseV1FromRawEvent,
  HookPulseWaitReason,
  hashPrivateIdentifier,
  hookPulseDisarmSentinelPath,
  hookPulseDisarmWindowsPath,
  hookPulseLedgerDir,
} from "@beep/repo-ai-metrics";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { fcRuns } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { ConfigProvider, Effect, FileSystem, Path, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { ChildProcess } from "effect/unstable/process";

// The writer is shell, so the only honest conformance test spawns the real
// script and decodes what it wrote. `HookPulseV1` carries the
// `HookPulseWaitReasonInvariant` filter, so a jq derivation that ever drifts
// from the TypeScript `deriveWaitReason` fails the decode rather than silently
// producing a wrong ledger.
// `fileURLToPath`, not `URL.pathname`: the latter is percent-encoded, so a
// checkout path containing a space or `#` would yield an unspawnable writer path.
const repoRoot = NodeURL.fileURLToPath(new URL("../../../../../", import.meta.url));
const writerPath = `${repoRoot}.claude/hooks/hook-pulse.sh`;
const codexWriterPath = `${repoRoot}.codex/hooks/hook-pulse.sh`;
// The operator half of the same instrument: the switch writes the sentinel the
// writer tests for, so the two scripts have to agree about where it lives.
const switchPath = `${repoRoot}.claude/hooks/hook-pulse-switch.sh`;

// A distinctive marker planted in every content-bearing raw key measured by the
// P1 spike. Amendment 6 is only actually enforced if this never reaches disk —
// in the clear *or* hashed. A raw leak is the obvious failure, but a writer that
// decided to pseudonymize a content field instead of dropping it would still
// have put content-derived material in the ledger, so both forms are asserted.
const CANARY = "CANARY-SECRET-VALUE";

// A salt no clone would have configured, used to prove the salt actually enters
// the preimage. Every default-salt assertion in this file also passes for a
// writer that ignored the operator salt entirely, because the fallback constant
// is what such a writer would have used anyway.
const OPERATOR_SALT = "hook-pulse-writer-operator-salt";

// The cross-implementation oracle. `sessionId`, `cwd`, and `transcriptPath` are
// `Sha256Hex` on the schema side, so no assertion can compare against a raw
// value any more — and a shape assertion alone is worthless here, because the
// most likely way to get this wrong produces a perfectly well-formed digest.
// Bash cannot hold a NUL in a variable and strips it from a heredoc, so a writer
// that assembles `salt<NUL>value` as a shell value hashes `saltvalue` instead
// and emits 64 lowercase hex characters that decode cleanly and are simply
// wrong. Recomputing the expected digest with the same `hashPrivateIdentifier`
// the codecs use is what makes the two halves provably agree, exactly as the
// `HookPulseWaitReasonInvariant` filter does for the wait derivation.
const privateDigest = (value: string) => hashPrivateIdentifier(value, O.none());

// One salt for the writer child and the codec provider alike, so a parity case
// reads as "both halves were told the same thing" rather than as two constants
// that happen to match.
const CODEC_PARITY_SALT = "hook-pulse-writer-codec-parity-salt";

// The workstation that owns this instrument exports a real operator salt into
// the environment vitest inherits, so a codec decode that read the ambient
// provider would assert one thing here and another in CI — and would print that
// salt into a failure diff. Every parity case pins its own provider, the cleared
// one included. Mutating `process.env` is not an alternative: `fromEnv`
// snapshots the environment once per process and `Context.Reference` memoizes
// its default, so the first read freezes it.
const withSaltEnv = <A, E, R>(env: Record<string, string>, effect: Effect.Effect<A, E, R>) =>
  Effect.provideService(effect, ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }));

const decodeHookPulseFromRaw = HookPulseV1FromRawEvent.decodeUnknownEffect;
const decodeHookPulseRow = HookPulseV1.decodeJsonEffect;
const decodeRowKeys = S.decodeUnknownSync(S.fromJsonString(S.Record(S.String, S.Unknown)));
const decodeRowString = S.decodeUnknownSync(S.String);
const encodeHookPulseRow = HookPulseV1.encodeJsonSync;
const decodeHookPulseRowSync = HookPulseV1.decodeJsonSync;
const hookPulseEquivalent = S.toEquivalence(HookPulseV1);
// Fixture payloads are raw harness shapes, not a schema this package owns, so the
// unknown-shaped encoder is the right rung: it renders stdin without pretending the
// content-bearing keys we deliberately never model are part of the contract.
const encodeJson = UnknownFromJsonString.encodeUnknownSync;

// Exactly the canonical `HookPulseV1` encoded surface. Any other key on a row is
// a leak or a drift, whichever it turns out to be. Stated by hand so the leak
// assertion below reads as an allowlist rather than as a tautology against the
// schema — and asserted set-equal to `HookPulseV1.fields` by
// "declares exactly the canonical HookPulseV1 encoded surface", so adding a name
// here that no schema field carries cannot quietly license a real leak.
const canonicalRowKeys = [
  "schemaVersion",
  "ts",
  "sessionId",
  "agentKind",
  "hookEvent",
  "cwd",
  "notifierRev",
  "instrumentClass",
  "evidenceTier",
  "waitReason",
  "toolName",
  "toolUseId",
  "promptId",
  "transcriptPath",
  "permissionMode",
  "notificationType",
  "durationMs",
  "sessionEndReason",
  "isInterrupt",
];

// Pulls a `def <name>: [ "a", "b" ];` allowlist back out of the writer. The
// script hand-duplicates two literal domains that only the schema really owns,
// and nothing in shell can detect a typo in them: a mistyped event name drops
// 100% of that event's rows while every example fixture for the other events
// stays green. Reading the definitions back turns that duplication into a
// checked one. A failed extraction yields an empty list, which fails the
// set-equality assertion rather than passing vacuously.
const jqAllowlist = (source: string, definition: string): ReadonlyArray<string> =>
  O.match(O.fromNullishOr(new RegExp(`def ${definition}:\\s*\\[([^\\]]*)\\];`).exec(source)?.[1]), {
    onNone: () => A.empty<string>(),
    onSome: (body) =>
      A.getSomes(A.map(A.fromIterable(body.matchAll(/"([^"]*)"/g)), (match) => O.fromNullishOr(match[1]))),
  });

interface WriterRun {
  readonly exitCode: number;
  readonly files: ReadonlyArray<string>;
  readonly rows: ReadonlyArray<string>;
  readonly stderr: string;
  readonly stdout: string;
}

// Runs the real hook against an isolated evidence root so the live ledger — which
// already holds the committed 2026-08-01 spike corpus — can never receive a
// synthetic fixture row. The expected output location is derived from the
// exported path helpers rather than restated, so the shell writer and the
// TypeScript reader fail this test the moment they disagree about where the
// ledger lives.
const runWriter = Effect.fnUntraced(function* (
  stdin: string,
  options: {
    readonly aiMetricsHashSalt?: string;
    readonly disarmSentinel?: string;
    readonly hashSalt?: string;
    readonly viaXdgFallback?: boolean;
    readonly writerPath?: string;
  } = {}
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const stateHome = yield* fs.makeTempDirectoryScoped({
    prefix: "beep-hook-pulse-",
  });
  const evidenceRoot = agentEvidenceRoot(stateHome);
  const storeDir = hookPulseLedgerDir(evidenceRoot);

  if (O.isSome(O.fromUndefinedOr(options.disarmSentinel))) {
    yield* fs.makeDirectory(evidenceRoot, { recursive: true });
    yield* fs.writeFileString(hookPulseDisarmSentinelPath(evidenceRoot), `${options.disarmSentinel}\n`);
  }

  const childStdin = O.match(O.fromUndefinedOr(options.disarmSentinel), {
    // The kill-switch guard exits before the writer reads stdin. Ignoring the pipe in
    // that case avoids racing a payload write against the child's intentional exit.
    onSome: () => "ignore" as const,
    onNone: () => ({ stream: Stream.encodeText(Stream.make(stdin)), endOnDone: true }) as const,
  });

  // Effect's `ChildProcess`, deliberately, and neither `Bun.spawn*` nor
  // `node:child_process`. Measured: inside a vitest worker under the coverage script
  // (`bunx vitest run --coverage`, a different runtime from `bunx --bun vitest run`),
  // Bun's spawn does not deliver stdin from a TypedArray at all — a `cat` probe echoed
  // "". Its async form additionally never closed stdin, so the writer's
  // `payload="$(cat)"` blocked on EOF forever: that is the 40-minute CI hang, reaped as
  // 8 orphan `bash` + 8 orphan `cat`. `yeet verify` runs each package's `test` script
  // and never the `coverage` one, so no local proof could reach it. The spawner behind
  // `ChildProcess` delivers stdin and closes it under both runtimes, and it is what the
  // repo's `nodeBuiltinImport` law names as the replacement for `node:child_process`.
  const handle = yield* ChildProcess.make(options.writerPath ?? writerPath, [], {
    cwd: repoRoot,
    // Inherited, not restated. The writer shells out to `jq`, `sha256sum`, `date`, and
    // `cat`, so it needs `PATH`, and without `extendEnv` a provided `env` *replaces* the
    // child environment rather than extending it. Letting the spawner inherit also keeps
    // a `process.env` read out of this file, which the repo's `processEnvInEffect` law
    // forbids.
    //
    // Note for anyone debugging a future empty-store failure: an earlier revision here
    // blamed a dropped `PATH` for exactly that symptom. That was wrong. `extendEnv` is
    // implemented as `{ ...globalThis.process.env, ...options.env }`
    // (`NodeChildProcessSpawner`) — the very spread the old comment accused — and it
    // works. The real cause was that Bun's spawn never delivered stdin in this worker at
    // all, so the writer parsed nothing and took its fail-open exit. Empty store means
    // "the writer bailed"; it does not tell you which guard bailed. Instrument before
    // concluding — a two-minute `cat`-echo probe settled it after two wrong theories.
    extendEnv: true,
    env: {
      HOME: stateHome,
      XDG_STATE_HOME: stateHome,
      // The writer reads `$PWD` as its `fallbackCwd`, and `cwd` above does not rewrite
      // the inherited `PWD` — bash would correct it at startup, but the correction is
      // not this test's to assume now that the environment is inherited rather than
      // rebuilt.
      PWD: repoRoot,
      // Empty values fall through to the writer's own `:-` defaults, so ambient
      // developer configuration cannot change what this test asserts. Clearing
      // BEEP_AGENT_EVIDENCE_ROOT exercises the XDG_STATE_HOME fallback rung of
      // the precedence chain and must resolve to the same place.
      BEEP_AGENT_EVIDENCE_ROOT: options.viaXdgFallback === true ? "" : evidenceRoot,
      BEEP_HOOK_PULSE_DISARM_SENTINEL: "",
      // The production fallback is now the post-baseline notifier revision.
      // Legacy writer fixtures pin log-only explicitly so their assertion stays
      // about projection semantics rather than the current intervention state.
      BEEP_HOOK_PULSE_NOTIFIER_REV: "log-only-0",
      BEEP_HOOK_PULSE_INSTRUMENT_CLASS: "",
      // Both salt rungs are cleared unless a case sets one, so a developer who
      // exports a real ai-metrics salt cannot change what these digests are.
      // Cleared, they exercise the insecure-default fallback that keeps an
      // unconfigured clone byte-identical to `hashPrivateIdentifier(value, O.none())`.
      // The second rung is settable so the codec-parity cases can prove both
      // halves walk the *same* chain rather than only its first link.
      BEEP_HOOK_PULSE_HASH_SALT: options.hashSalt ?? "",
      BEEP_AI_METRICS_HASH_SALT: options.aiMetricsHashSalt ?? "",
    },
    // `endOnDone` is stated rather than left to its `true` default: closing stdin once
    // the payload is written is the whole reason this run terminates, so it is part of
    // what the helper promises and not an incidental default someone may retune.
    stdin: childStdin,
    stdout: "pipe",
    stderr: "pipe",
  });

  // Drained concurrently with the exit wait, never after it: a child that filled a pipe
  // buffer while the parent sat blocked on `exitCode` is the other shape of the same
  // hang. A signal death fails `handle.exitCode` with a `PlatformError` naming the
  // signal instead of yielding a code, which for this always-exits-0 writer is itself
  // the bug worth failing on, so it is left to propagate rather than coerced to success.
  const [stdout, stderr, exitCode] = yield* Effect.all(
    [
      Stream.mkString(Stream.decodeText(handle.stdout)),
      Stream.mkString(Stream.decodeText(handle.stderr)),
      handle.exitCode,
    ],
    { concurrency: "unbounded" }
  );

  const storeExists = yield* fs.exists(storeDir);
  const files = storeExists ? yield* fs.readDirectory(storeDir) : A.empty<string>();
  const rows = yield* Effect.map(
    Effect.forEach(files, (entry) =>
      Effect.map(fs.readFileString(path.join(storeDir, entry)), (contents) =>
        A.filter(contents.split("\n"), (line) => line.length > 0)
      )
    ),
    A.flatten
  );

  return { exitCode, files, stderr, stdout, rows };
});

const session = "ccd-session-writer";
const baseFields = {
  cwd: "/worktrees/beep-effect2",
  prompt_id: "prompt-writer-1",
  session_id: session,
  transcript_path: "/tmp/claude/session-writer.jsonl",
};

// Raw key sets below are the measured 2.1.220 ground truth from
// `goals/coding-agent-effectiveness-evidence-loop/research/2026-08-01-p1-hook-semantics-spike.md`,
// with every content-bearing key filled with the canary.
const preToolUsePayload = {
  ...baseFields,
  hook_event_name: HookPulseEvent.Enum.PreToolUse,
  permission_mode: "default",
  tool_input: { command: CANARY },
  tool_name: "Bash",
  tool_use_id: "toolu_writer_1",
};

const permissionRequestPlanPayload = {
  ...baseFields,
  hook_event_name: HookPulseEvent.Enum.PermissionRequest,
  permission_mode: "plan",
  permission_suggestions: [{ rule: CANARY }],
  tool_input: { plan: CANARY },
  tool_name: "ExitPlanMode",
};

const permissionRequestToolPayload = {
  ...baseFields,
  hook_event_name: HookPulseEvent.Enum.PermissionRequest,
  permission_mode: "default",
  permission_suggestions: [{ rule: CANARY }],
  tool_input: { command: CANARY },
  tool_name: "Bash",
};

// `PermissionRequest` with no `tool_name` was never measured, but the codec
// derives `unknown` for it, so the writer must agree rather than guess.
const permissionRequestToollessPayload = {
  ...baseFields,
  hook_event_name: HookPulseEvent.Enum.PermissionRequest,
  permission_mode: "default",
  tool_input: { command: CANARY },
};

const postToolUsePayload = {
  ...baseFields,
  duration_ms: 477,
  hook_event_name: HookPulseEvent.Enum.PostToolUse,
  permission_mode: "default",
  tool_input: { command: CANARY },
  tool_name: "Bash",
  tool_response: { stdout: CANARY },
  tool_use_id: "toolu_writer_1",
};

// Verified against the 2.1.223 bundle's zod schema for this event:
// `{...base, hook_event_name, tool_name, tool_input, tool_use_id, error,
//   is_interrupt?, duration_ms?}`. `error` is content and must never be read.
const postToolUseFailurePayload = (isInterrupt: boolean) => ({
  ...baseFields,
  duration_ms: 12,
  error: CANARY,
  hook_event_name: HookPulseEvent.Enum.PostToolUseFailure,
  is_interrupt: isInterrupt,
  permission_mode: "default",
  tool_input: { command: CANARY },
  tool_name: "Bash",
  tool_use_id: "toolu_writer_1",
});

// The terminal of a denied-permission wait: without a row here the two-hop join
// can never close the bracket a `PermissionRequest` opened when the human said
// no, so a denial is indistinguishable from a session that simply stopped.
const permissionDeniedPayload = {
  ...baseFields,
  hook_event_name: HookPulseEvent.Enum.PermissionDenied,
  permission_mode: "default",
  permission_suggestions: [{ rule: CANARY }],
  reason: CANARY,
  tool_input: { command: CANARY },
  tool_name: "Bash",
  tool_use_id: "toolu_writer_1",
};

// `1e400` cannot survive a JavaScript round-trip: it *is* `Infinity` in JS, and
// `JSON.stringify` renders that as `null`. The harness on the other end of this
// pipe is not JavaScript, so the literal is spliced into the stdin text directly
// — which is exactly how an out-of-range duration would actually arrive.
const nonFiniteDurationStdin = `{"duration_ms":1e400,${encodeJson(R.remove(postToolUsePayload, "duration_ms")).slice(1)}`;

const notificationPayload = (notificationType: O.Option<string>) => ({
  ...baseFields,
  hook_event_name: HookPulseEvent.Enum.Notification,
  message: CANARY,
  ...O.match(notificationType, {
    onNone: () => ({}),
    onSome: (value) => ({ notification_type: value }),
  }),
});

// Hoisted so the call sites stay one level deep; nesting them under `encodeJson`
// trips `missedPipeableOpportunity`.
const idleNotificationPayload = notificationPayload(O.some(HookPulseNotificationType.Enum.idle_prompt));
const permissionPromptNotificationPayload = notificationPayload(
  O.some(HookPulseNotificationType.Enum.permission_prompt)
);
const futureNotificationPayload = notificationPayload(O.some("some_future_notification"));
const typelessNotificationPayload = notificationPayload(O.none());

const userPromptSubmitPayload = {
  ...baseFields,
  hook_event_name: HookPulseEvent.Enum.UserPromptSubmit,
  permission_mode: "default",
  prompt: CANARY,
};

const stopPayload = {
  ...baseFields,
  background_tasks: [{ description: CANARY }],
  hook_event_name: HookPulseEvent.Enum.Stop,
  last_assistant_message: CANARY,
  permission_mode: "default",
  session_crons: [{ prompt: CANARY }],
  stop_hook_active: false,
};

const sessionEndPayload = {
  ...baseFields,
  hook_event_name: HookPulseEvent.Enum.SessionEnd,
  reason: "prompt_input_exit",
};

// `permissionMode` is stated per payload rather than derived from it: the
// harness omits `permission_mode` on `Notification` and `SessionEnd`, and a
// writer that invented one — or dropped every real one — would otherwise pass.
const measuredPayloads = [
  {
    label: "PreToolUse",
    payload: preToolUsePayload,
    permissionMode: O.some("default"),
    waitReason: HookPulseWaitReason.Enum.none,
  },
  {
    label: "PermissionRequest{ExitPlanMode}",
    payload: permissionRequestPlanPayload,
    permissionMode: O.some("plan"),
    waitReason: HookPulseWaitReason.Enum["plan-approval"],
  },
  {
    label: "PermissionRequest{Bash}",
    payload: permissionRequestToolPayload,
    permissionMode: O.some("default"),
    waitReason: HookPulseWaitReason.Enum["tool-permission"],
  },
  {
    label: "PermissionRequest{no tool_name}",
    payload: permissionRequestToollessPayload,
    permissionMode: O.some("default"),
    waitReason: HookPulseWaitReason.Enum.unknown,
  },
  {
    label: "PostToolUse",
    payload: postToolUsePayload,
    permissionMode: O.some("default"),
    waitReason: HookPulseWaitReason.Enum.none,
  },
  {
    label: "PostToolUseFailure{is_interrupt: true}",
    payload: postToolUseFailurePayload(true),
    permissionMode: O.some("default"),
    waitReason: HookPulseWaitReason.Enum.none,
  },
  {
    label: "PostToolUseFailure{is_interrupt: false}",
    payload: postToolUseFailurePayload(false),
    permissionMode: O.some("default"),
    waitReason: HookPulseWaitReason.Enum.none,
  },
  {
    label: "PermissionDenied",
    payload: permissionDeniedPayload,
    permissionMode: O.some("default"),
    waitReason: HookPulseWaitReason.Enum.none,
  },
  {
    label: "Notification{idle_prompt}",
    payload: idleNotificationPayload,
    permissionMode: O.none(),
    waitReason: HookPulseWaitReason.Enum["idle-input"],
  },
  {
    label: "Notification{permission_prompt}",
    payload: permissionPromptNotificationPayload,
    permissionMode: O.none(),
    waitReason: HookPulseWaitReason.Enum.unknown,
  },
  {
    label: "Notification{unrecognized notification_type}",
    payload: futureNotificationPayload,
    permissionMode: O.none(),
    waitReason: HookPulseWaitReason.Enum.unknown,
  },
  {
    label: "Notification{absent notification_type}",
    payload: typelessNotificationPayload,
    permissionMode: O.none(),
    waitReason: HookPulseWaitReason.Enum.unknown,
  },
  {
    label: "UserPromptSubmit",
    payload: userPromptSubmitPayload,
    permissionMode: O.some("default"),
    waitReason: HookPulseWaitReason.Enum.none,
  },
  {
    label: "Stop",
    payload: stopPayload,
    permissionMode: O.some("default"),
    waitReason: HookPulseWaitReason.Enum.none,
  },
  {
    label: "SessionEnd",
    payload: sessionEndPayload,
    permissionMode: O.none(),
    waitReason: HookPulseWaitReason.Enum.none,
  },
];

const expectSingleRow = (run: WriterRun): string => {
  expect(run.exitCode).toBe(0);
  expect(run.stderr).toBe("");
  // `PermissionRequest` is a decision hook: the harness reads hook stdout into
  // the permission outcome. Anything on stdout risks auto-approving a tool call,
  // which would both bypass gating and record a zero-length human wait.
  expect(run.stdout).toBe("");
  expect(run.rows).toHaveLength(1);
  const [row] = run.rows;
  expect(row).toBeDefined();
  return `${row}`;
};

// The same stdout guarantee on the paths where nothing is written at all. These
// are exactly where a stray `echo` gets added during debugging, and the negative
// tests would otherwise pass on `rows: []` alone while the decision hook leaked.
const expectSilentRefusal = (run: WriterRun): void => {
  expect(run.exitCode).toBe(0);
  expect(run.stdout).toBe("");
  expect(run.rows).toEqual([]);
};

layer(NodeServices.layer)("hook-pulse writer conformance", (it) => {
  it.effect("tags Codex hook rows as codex-cli", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const run = yield* runWriter(encodeJson(preToolUsePayload), { writerPath: codexWriterPath });
        const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

        expect(decoded.agentKind).toBe(HookPulseAgentKind.Enum["codex-cli"]);
      })
    )
  );

  A.forEach(measuredPayloads, ({ label, payload, permissionMode, waitReason }) => {
    it.effect(`emits one HookPulseV1 row for ${label}`, () =>
      Effect.scoped(
        Effect.gen(function* () {
          const run = yield* runWriter(encodeJson(payload));
          const row = expectSingleRow(run);
          const decoded = yield* decodeHookPulseRow(row);

          expect(decoded).toBeInstanceOf(HookPulseV1);
          expect(decoded.schemaVersion).toBe(HookPulseSchemaVersion.Enum["hook-pulse/v1"]);
          expect(decoded.agentKind).toBe(HookPulseAgentKind.Enum["claude-code"]);
          expect(decoded.instrumentClass).toBe(HookPulseInstrumentClass.Enum.production);
          // Pseudonymized, not raw: these three carry `Sha256Hex`, so the
          // expectation is the oracle digest rather than the identifier itself.
          expect(decoded.sessionId).toBe(yield* privateDigest(session));
          expect(decoded.cwd).toBe(yield* privateDigest(baseFields.cwd));
          expect(decoded.notifierRev).toBe("log-only-0");
          expect(decoded.waitReason).toBe(waitReason);
          // `transcriptPath` is the one forwarded field the codec cannot do
          // without: `HookPulseRawEvent.transcript_path` is required, so a row
          // missing it still decodes but can never be re-encoded — a replay
          // break that only surfaces in P4, long after the evidence is gone.
          expect(decoded.transcriptPath).toEqual(O.some(yield* privateDigest(baseFields.transcript_path)));
          expect(decoded.promptId).toEqual(O.some(baseFields.prompt_id));
          expect(decoded.permissionMode).toEqual(permissionMode);
          // Weakest-link: `waitReason` is derived, and the codec's
          // `clampDerivedEvidenceTier` maps `observed` to `derived`. A writer
          // stamping `observed` would make P4's replay-twice-diff disagree.
          expect(decoded.evidenceTier).toBe(HookPulseEvidenceTier.Enum.derived);
        })
      )
    );

    it.effect(`writes no measured content for ${label}`, () =>
      Effect.scoped(
        Effect.gen(function* () {
          const run = yield* runWriter(encodeJson(payload));
          const row = expectSingleRow(run);

          expect(row).not.toContain(CANARY);
          // Hashing is what the writer now does to the identifiers it cannot
          // drop, which makes "hash it instead" a newly plausible way to keep a
          // content field. A digest of the canary is still derived from content
          // and still belongs nowhere in the ledger.
          expect(row).not.toContain(yield* privateDigest(CANARY));
          expect(A.difference(R.keys(decodeRowKeys(row)), canonicalRowKeys)).toEqual([]);
        })
      )
    );
  });

  it("declares exactly the canonical HookPulseV1 encoded surface", () => {
    // Without this the allowlist is a claim, not a check: a name added to
    // `canonicalRowKeys` that no schema field carries would license a real leak
    // of exactly that name, and every content assertion above would still pass.
    const schemaKeys = R.keys(HookPulseV1.fields);

    expect(A.difference(canonicalRowKeys, schemaKeys)).toEqual([]);
    expect(A.difference(schemaKeys, canonicalRowKeys)).toEqual([]);
  });

  it("keeps every schema-inhabitable canonical row inside the declared ledger surface", () => {
    // The fixtures above only reach the key combinations the measured harness
    // emits. This walks the whole space `HookPulseV1` admits, so a future field
    // — or an encoder that starts emitting one conditionally — cannot slip past
    // the leak allowlist just because no fixture happens to populate it. The
    // round-trip half proves the NDJSON line the ledger stores is lossless for
    // every such row, which is what P4 replay actually depends on.
    fc.assert(
      fc.property(S.toArbitrary(HookPulseV1)(fc), (value) => {
        const line = encodeHookPulseRow(value);

        expect(A.difference(R.keys(decodeRowKeys(line)), canonicalRowKeys)).toEqual([]);
        expect(hookPulseEquivalent(decodeHookPulseRowSync(line), value)).toBe(true);
      }),
      fcRuns(50)
    );
  });

  it.effect("keeps the jq allowlists set-equal to the schema literal domains", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const source = yield* fs.readFileString(writerPath);
      const events = jqAllowlist(source, "hook_events");
      const notificationTypes = jqAllowlist(source, "notification_types");

      // A name only in the schema is an event the writer silently drops
      // wholesale; a name only in jq is an event that reaches the ledger and
      // then fails to decode. Neither shows up in any example fixture, because
      // fixtures only ever exercise names both halves already agree on.
      expect(A.difference(events, HookPulseEvent.Options)).toEqual([]);
      expect(A.difference(HookPulseEvent.Options, events)).toEqual([]);
      expect(A.difference(notificationTypes, HookPulseNotificationType.Options)).toEqual([]);
      expect(A.difference(HookPulseNotificationType.Options, notificationTypes)).toEqual([]);
    })
  );

  it.effect("shards the ledger by UTC day and hashed session id", () =>
    Effect.scoped(
      Effect.gen(function* () {
        // The script claims per-session sharding makes cross-session
        // interleaving structurally impossible. The runner globs the whole
        // directory, so dropping the session suffix would keep every other test
        // green while quietly restoring that hazard. The suffix is the digest,
        // not the raw session id: a filename is as readable as a row, so a
        // ledger whose rows are pseudonymized while its directory listing spells
        // out every session UUID has pseudonymized nothing.
        const run = yield* runWriter(encodeJson(preToolUsePayload));
        const row = expectSingleRow(run);
        const ts = decodeRowString(decodeRowKeys(row).ts);
        const sessionDigest = yield* privateDigest(session);

        // Exact equality against the oracle digest, so the raw session id cannot
        // reappear in the name under any spelling.
        expect(run.files).toEqual([`hook-pulse-${ts.slice(0, 10)}-${sessionDigest}.ndjson`]);
      })
    )
  );

  it.effect("hashes private identifiers to the digests the TypeScript oracle computes", () =>
    Effect.scoped(
      Effect.gen(function* () {
        // The shell writer and `hashPrivateIdentifier` are two implementations
        // of one contract, and every other assertion in this file is satisfied
        // by any 64-hex string. This is the only one that fails when the shell
        // hashes the right value the wrong way — the NUL-through-a-variable trap
        // described above being the way it actually happens.
        const run = yield* runWriter(encodeJson(preToolUsePayload));
        const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

        expect(decoded.sessionId).toBe(yield* privateDigest(session));
        expect(decoded.cwd).toBe(yield* privateDigest(baseFields.cwd));
        expect(decoded.transcriptPath).toEqual(O.some(yield* privateDigest(baseFields.transcript_path)));
      })
    )
  );

  it.effect("carries an operator salt into every private digest", () =>
    Effect.scoped(
      Effect.gen(function* () {
        // The oracle above still passes for a writer that never reads the salt
        // at all, because the insecure default is what such a writer would have
        // used anyway. Only a run under an operator salt separates "resolves the
        // salt" from "hardcodes the fallback".
        const run = yield* runWriter(encodeJson(preToolUsePayload), {
          hashSalt: OPERATOR_SALT,
        });
        const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

        expect(decoded.sessionId).toBe(yield* hashPrivateIdentifier(session, O.some(OPERATOR_SALT)));
        expect(decoded.cwd).toBe(yield* hashPrivateIdentifier(baseFields.cwd, O.some(OPERATOR_SALT)));
        expect(decoded.sessionId).not.toBe(yield* privateDigest(session));
      })
    )
  );

  it.effect("treats a whitespace-only salt as unset, exactly as resolveAiMetricsHashSaltValue does", () =>
    Effect.scoped(
      Effect.gen(function* () {
        // `${VAR:-default}` accepts `"   "` as a value while
        // `resolveAiMetricsHashSaltValue` trims first and falls back. That lone
        // input is where the two halves can disagree with both looking correct,
        // so the shell trims too and this pins it.
        const run = yield* runWriter(encodeJson(preToolUsePayload), {
          hashSalt: "   ",
        });
        const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

        expect(decoded.sessionId).toBe(yield* privateDigest(session));
      })
    )
  );

  it.effect("omits notificationType when the raw value is outside the enum", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const run = yield* runWriter(encodeJson(futureNotificationPayload));
        const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

        // The spike's jq `capture()` defect dropped exactly this row while still
        // exiting 0. A no-match must omit the optional key, never annihilate the
        // object.
        expect(decoded.hookEvent).toBe(HookPulseEvent.Enum.Notification);
        expect(decoded.notificationType).toEqual(O.none());
        expect(decoded.waitReason).toBe(HookPulseWaitReason.Enum.unknown);
      })
    )
  );

  it.effect("keeps notificationType when the raw value is inside the enum", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const run = yield* runWriter(encodeJson(permissionPromptNotificationPayload));
        const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

        expect(decoded.notificationType).toEqual(O.some(HookPulseNotificationType.Enum.permission_prompt));
      })
    )
  );

  it.effect("carries sessionEndReason only on SessionEnd", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const ended = yield* runWriter(encodeJson(sessionEndPayload));
        const stopped = yield* runWriter(encodeJson(stopPayload));
        const denied = yield* runWriter(encodeJson(permissionDeniedPayload));
        const decodedEnd = yield* decodeHookPulseRow(expectSingleRow(ended));
        const decodedStop = yield* decodeHookPulseRow(expectSingleRow(stopped));
        const decodedDenied = yield* decodeHookPulseRow(expectSingleRow(denied));

        expect(decodedEnd.sessionEndReason).toEqual(O.some("prompt_input_exit"));
        expect(decodedStop.sessionEndReason).toEqual(O.none());
        // `PermissionDenied` carries its own `reason`, and it is content.
        expect(decodedDenied.sessionEndReason).toEqual(O.none());
      })
    )
  );

  it.effect("carries durationMs from PostToolUse and pairs tool ids", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const run = yield* runWriter(encodeJson(postToolUsePayload));
        const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

        expect(decoded.durationMs).toEqual(O.some(477));
        expect(decoded.toolUseId).toEqual(O.some("toolu_writer_1"));
      })
    )
  );

  it.effect("drops a non-finite durationMs rather than writing an undecodable row", () =>
    Effect.scoped(
      Effect.gen(function* () {
        // jq carries `1e400` through as `1E+400`, which parses back to
        // `Infinity` and fails `NonNegNum`'s `S.Finite`. Keeping it would put an
        // undecodable line in a shard, which poisons replay for every row that
        // shard holds — strictly worse than dropping one optional field.
        const run = yield* runWriter(nonFiniteDurationStdin);
        const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

        expect(decoded.durationMs).toEqual(O.none());
        expect(decoded.hookEvent).toBe(HookPulseEvent.Enum.PostToolUse);
      })
    )
  );

  it.effect("invents no toolUseId for PermissionRequest", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const run = yield* runWriter(encodeJson(permissionRequestPlanPayload));
        const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

        // The two-hop join in P4 depends on this absence being real.
        expect(decoded.toolUseId).toEqual(O.none());
        expect(decoded.toolName).toEqual(O.some("ExitPlanMode"));
      })
    )
  );

  it.effect("writes nothing and exits 0 when the kill-switch sentinel exists", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const run = yield* runWriter(encodeJson(permissionRequestPlanPayload), {
          disarmSentinel: '{"disarmedAt":"2026-08-05T00:00:00Z","reason":"test","evidenceTier":"unknown"}',
        });

        expectSilentRefusal(run);
      })
    )
  );

  A.forEach(
    [
      { label: "unparseable stdin", stdin: "not json at all {{{" },
      { label: "empty stdin", stdin: "" },
      {
        label: "a payload with no session_id",
        stdin: encodeJson({ ...stopPayload, session_id: undefined }),
      },
      {
        label: "a payload with an unknown hook_event_name",
        stdin: encodeJson({
          ...stopPayload,
          hook_event_name: "SomeFutureEvent",
        }),
      },
    ],
    ({ label, stdin }) => {
      it.effect(`writes no partial line for ${label}`, () =>
        Effect.scoped(
          Effect.gen(function* () {
            const run = yield* runWriter(stdin);

            expectSilentRefusal(run);
          })
        )
      );
    }
  );

  // Amendment 8: a tool call ends in PostToolUse OR PostToolUseFailure, never
  // both, so a bracket that only closes on PostToolUse drops every
  // approved-then-failed wait — a biased loss, since failures are where retry
  // storms live. The closing evidence P4 needs is tool_use_id + durationMs.
  it.effect("carries bracket-closing evidence and isInterrupt on PostToolUseFailure", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const interrupted = yield* runWriter(encodeJson(postToolUseFailurePayload(true)));
        const errored = yield* runWriter(encodeJson(postToolUseFailurePayload(false)));
        const decodedInterrupted = yield* decodeHookPulseRow(expectSingleRow(interrupted));
        const decodedErrored = yield* decodeHookPulseRow(expectSingleRow(errored));

        expect(decodedInterrupted.toolUseId).toEqual(O.some("toolu_writer_1"));
        expect(decodedInterrupted.durationMs).toEqual(O.some(12));
        // `false` is a value, not an absence — omitting it would erase the
        // distinction between "the tool errored" and "the human hit escape".
        expect(decodedInterrupted.isInterrupt).toEqual(O.some(true));
        expect(decodedErrored.isInterrupt).toEqual(O.some(false));
      })
    )
  );

  it.effect("carries isInterrupt only on PostToolUseFailure", () =>
    Effect.scoped(
      Effect.gen(function* () {
        // `is_interrupt` on a foreign event is owned by PostToolUseFailure, so
        // emitting it would fail HookPulseEventOwnedFieldInvariant on decode.
        const run = yield* runWriter(encodeJson({ ...postToolUsePayload, is_interrupt: true }));
        const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

        expect(decoded.hookEvent).toBe(HookPulseEvent.Enum.PostToolUse);
        expect(decoded.isInterrupt).toEqual(O.none());
      })
    )
  );

  it.effect("resolves the ledger path through the XDG fallback rung too", () =>
    Effect.scoped(
      Effect.gen(function* () {
        // With BEEP_AGENT_EVIDENCE_ROOT cleared, the writer must land in the
        // same directory `agentEvidenceRoot`/`hookPulseLedgerDir` compute — the
        // runner reads back from exactly that derived path.
        const run = yield* runWriter(encodeJson(permissionRequestPlanPayload), {
          viaXdgFallback: true,
        });
        const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

        expect(decoded.waitReason).toBe(HookPulseWaitReason.Enum["plan-approval"]);
      })
    )
  );

  // The writer is shell and the codec is TypeScript, so the only honest parity
  // proof runs the real script and derives a row from the same raw payload under
  // the matching `ConfigProvider`, then compares digests rather than shapes.
  // Every other assertion in this file is satisfied by any 64-hex string, and
  // the two halves used to disagree on exactly these three fields whenever
  // either salt was exported.
  const codecParityCases: ReadonlyArray<{
    readonly label: string;
    readonly writerOptions: {
      readonly aiMetricsHashSalt?: string;
      readonly hashSalt?: string;
    };
    readonly codecEnv: Record<string, string>;
    readonly expectedSalt: string | undefined;
  }> = [
    {
      label: "neither salt configured",
      writerOptions: {},
      codecEnv: {},
      expectedSalt: undefined,
    },
    {
      label: "the hook-pulse rung",
      writerOptions: { hashSalt: CODEC_PARITY_SALT },
      codecEnv: { BEEP_HOOK_PULSE_HASH_SALT: CODEC_PARITY_SALT },
      expectedSalt: CODEC_PARITY_SALT,
    },
    {
      label: "the ai-metrics rung",
      writerOptions: { aiMetricsHashSalt: CODEC_PARITY_SALT },
      codecEnv: { BEEP_AI_METRICS_HASH_SALT: CODEC_PARITY_SALT },
      expectedSalt: CODEC_PARITY_SALT,
    },
  ];

  A.forEach(codecParityCases, ({ codecEnv, expectedSalt, label, writerOptions }) => {
    it.effect(`reproduces the writer's private digests through ${label}`, () =>
      Effect.scoped(
        Effect.gen(function* () {
          const run = yield* runWriter(encodeJson(preToolUsePayload), writerOptions);
          const writerRow = yield* decodeHookPulseRow(expectSingleRow(run));
          // `ts`, `notifierRev`, `instrumentClass`, `agentKind`, and
          // `evidenceTier` enter no digest, so a literal `ts` here avoids
          // re-encoding the writer's own `DateTimeUtc` for no gain.
          const codecRow = yield* withSaltEnv(
            codecEnv,
            decodeHookPulseFromRaw({
              event: preToolUsePayload,
              notifierRev: "log-only-0",
              instrumentClass: HookPulseInstrumentClass.Enum.production,
              agentKind: HookPulseAgentKind.Enum["claude-code"],
              evidenceTier: HookPulseEvidenceTier.Enum.derived,
              ts: "2026-08-01T06:40:07.000Z",
            })
          );

          expect(codecRow.sessionId).toBe(writerRow.sessionId);
          expect(codecRow.cwd).toBe(writerRow.cwd);
          expect(codecRow.transcriptPath).toEqual(writerRow.transcriptPath);
          // Non-vacuity: two halves that both ignored the salt would agree
          // too — on the fallback constant. Naming the rung's own digest is
          // what separates "reproduces the writer" from "both hardcode the
          // default", and it fails on the salted rows if either half stops
          // reading its variable.
          expect(codecRow.sessionId).toBe(yield* hashPrivateIdentifier(session, O.fromUndefinedOr(expectedSalt)));
          expect(codecRow.cwd).toBe(yield* hashPrivateIdentifier(baseFields.cwd, O.fromUndefinedOr(expectedSalt)));
        })
      )
    );
  });
});

// The switch's two artifacts, stated as schemas rather than as inline object
// shapes so a field it stops emitting fails the decode instead of passing an
// assertion that never looked for it. Neither is a `HookPulseV1` row and neither
// belongs under `hook-events/`: `HookPulseEvent` has no member for "the
// instrument was off", so representing a disarm window in the canonical ledger
// would mean inventing a hook event. Keeping the window in a sibling file is
// what lets P4 replay treat `hook-events/` as exactly one schema.
const decodeDisarmSentinel = HookPulseDisarmSentinel.decodeJsonEffect;
const decodeDisarmWindow = HookPulseDisarmWindow.decodeJsonEffect;

// An ISO-8601 UTC instant at second resolution, which is all `date -u
// +%Y-%m-%dT%H:%M:%SZ` can express. Asserted on `rearmedAt` so a window closed
// with an empty or malformed stamp fails here rather than decoding as a string.
const isoSecond = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

interface SwitchRun {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}

interface SwitchStore {
  readonly evidenceRoot: string;
  readonly sentinelPath: string;
  readonly stateHome: string;
  readonly windowsPath: string;
}

// One isolated evidence root shared by every invocation in a case. The
// regression this file pins only exists *across* invocations — `disarm`,
// `disarm`, `arm` is the whole shape of it — so a helper that minted a fresh
// temp root per call, as `runWriter` does, could not express it at all.
const makeSwitchStore = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const stateHome = yield* fs.makeTempDirectoryScoped({
    prefix: "beep-hook-pulse-switch-",
  });
  const evidenceRoot = agentEvidenceRoot(stateHome);

  return {
    evidenceRoot,
    sentinelPath: hookPulseDisarmSentinelPath(evidenceRoot),
    stateHome,
    windowsPath: hookPulseDisarmWindowsPath(evidenceRoot),
  };
});

// Same `ChildProcess` wiring as `runWriter`, with one difference that matters:
// the switch is argv-driven and reads no stdin, so its stdin is `"ignore"`
// rather than a stream. Leaving a pipe open for a process that never reads it is
// how the writer test hung for 40 minutes; `"ignore"` cannot reproduce that.
const runSwitch = Effect.fnUntraced(function* (store: SwitchStore, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make(switchPath, args, {
    cwd: repoRoot,
    // As in `runWriter`: inherited so `jq` and `date` stay on `PATH` without this
    // file reading `process.env`, which the `processEnvInEffect` law forbids.
    extendEnv: true,
    env: {
      HOME: store.stateHome,
      XDG_STATE_HOME: store.stateHome,
      BEEP_AGENT_EVIDENCE_ROOT: store.evidenceRoot,
      // Cleared so the switch derives the sentinel path from the evidence root
      // through the same rung `hook-pulse.sh` uses. An override here would let
      // the two scripts disagree about the path while this suite stayed green,
      // which is precisely the failure the sentinel cannot afford: the writer
      // would keep writing against a switch that thinks it is disarmed.
      BEEP_HOOK_PULSE_DISARM_SENTINEL: "",
    },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });

  const [stdout, stderr, exitCode] = yield* Effect.all(
    [
      Stream.mkString(Stream.decodeText(handle.stdout)),
      Stream.mkString(Stream.decodeText(handle.stderr)),
      handle.exitCode,
    ],
    { concurrency: "unbounded" }
  );

  return { exitCode, stderr, stdout };
});

const readSentinel = Effect.fnUntraced(function* (store: SwitchStore) {
  const fs = yield* FileSystem.FileSystem;

  return (yield* fs.exists(store.sentinelPath))
    ? O.some(yield* fs.readFileString(store.sentinelPath))
    : O.none<string>();
});

const readWindowRows = Effect.fnUntraced(function* (store: SwitchStore) {
  const fs = yield* FileSystem.FileSystem;
  const contents = (yield* fs.exists(store.windowsPath)) ? yield* fs.readFileString(store.windowsPath) : "";

  return A.filter(contents.split("\n"), (line) => line.length > 0);
});

const seedSentinel = Effect.fnUntraced(function* (store: SwitchStore, contents: string) {
  const fs = yield* FileSystem.FileSystem;
  yield* fs.makeDirectory(store.evidenceRoot, { recursive: true });
  yield* fs.writeFileString(store.sentinelPath, contents);
});

// A sentinel stamped at an instant no test run can collide with. `date -u` has
// one-second resolution, so two disarms inside the same second produce equal
// timestamps and a naive "the timestamp did not change" assertion passes against
// the bug. Seeding an unmistakably older start removes that race outright —
// preferable to sleeping past a second boundary, which would both slow the suite
// and put a wall-clock wait inside `it.effect`, whose clock is the `TestClock`.
const SEEDED_DISARM = {
  disarmedAt: "2026-08-05T00:00:00Z",
  evidenceTier: HookPulseEvidenceTier.Enum.unknown,
  reason: "seeded-first-window",
};
const seededSentinelJson = `${encodeJson(SEEDED_DISARM)}\n`;

const expectSingleWindow = (rows: ReadonlyArray<string>): string => {
  expect(rows).toHaveLength(1);
  const [row] = rows;
  expect(row).toBeDefined();
  return `${row}`;
};

// Every command below is expected to succeed silently on stderr, so the pair is
// asserted through one helper: the interesting half of each case is what it did
// to the sentinel and the ledger, not that it exited.
const expectSwitchOk = (run: SwitchRun): void => {
  expect(run.exitCode).toBe(0);
  expect(run.stderr).toBe("");
};

// The switch is an operator command rather than a hook, so — unlike the writer —
// its stdout is a feature and is asserted for content instead of for silence.
// stderr is still expected empty on every success path: `jq` failing to parse a
// hand-mangled sentinel is handled, and letting its diagnostics through would
// train operators to ignore the one channel that reports real trouble.
layer(NodeServices.layer)("hook-pulse kill-switch conformance", (it) => {
  it.effect("keeps the first disarm's window start and reason when disarm runs again", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const store = yield* makeSwitchStore();
        const first = yield* runSwitch(store, ["disarm", "first-reason"]);
        const afterFirst = yield* readSentinel(store);
        const second = yield* runSwitch(store, ["disarm", "second-reason"]);
        const afterSecond = yield* readSentinel(store);

        expectSwitchOk(first);
        expectSwitchOk(second);
        // Byte-identity, because the timestamps alone cannot separate "preserved"
        // from "rewritten within the same second". The reason changes on the
        // second call, so a `disarm` that overwrites moves these two apart even
        // when the clock does not.
        expect(afterSecond).toEqual(afterFirst);

        const decoded = yield* afterSecond.pipe(O.getOrThrow, decodeDisarmSentinel);

        expect(decoded.reason).toBe("first-reason");
        expect(decoded.evidenceTier).toBe(HookPulseEvidenceTier.Enum.unknown);
        // Reported back to the operator, not silently swallowed: re-running
        // `disarm` has to say which window it is still inside, or the human has
        // no way to notice the instrument went down earlier than they think.
        expect(second.stdout).toContain(`already disarmed since ${decoded.disarmedAt}`);
      })
    )
  );

  it.effect("never moves an existing window start forward, across any elapsed time", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const store = yield* makeSwitchStore();
        yield* seedSentinel(store, seededSentinelJson);

        const run = yield* runSwitch(store, ["disarm", "a-much-later-reason"]);

        expectSwitchOk(run);
        // Byte-identical to what was seeded: not the reason, not the timestamp,
        // not the trailing newline. The seeded start is far enough in the past
        // that an overwrite is unambiguous rather than clock-resolution noise.
        expect(yield* readSentinel(store)).toEqual(O.some(seededSentinelJson));
        expect(run.stdout).toContain(SEEDED_DISARM.disarmedAt);
      })
    )
  );

  it.effect("fails loudly when a dangling sentinel prevents disarm", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const store = yield* makeSwitchStore();
        yield* fs.makeDirectory(store.evidenceRoot, { recursive: true });
        yield* fs.symlink(path.join(store.evidenceRoot, "missing-sentinel-target"), store.sentinelPath);

        const run = yield* runSwitch(store, ["disarm", "privacy-stop"]);

        expect(run.exitCode).not.toBe(0);
        expect(run.stdout).toBe("");
        expect(run.stderr).toContain("sentinel was not published");
      })
    )
  );

  it.effect("closes the ledger window at the FIRST disarm, not the latest", () =>
    Effect.scoped(
      Effect.gen(function* () {
        // This is the assertion that encodes why the overwrite mattered. `arm`
        // copies the sentinel's `disarmedAt` into the append-only window ledger,
        // so a re-disarm that moved it forward recorded a *shorter* gap than
        // actually occurred — silently reclassifying uninstrumented time as
        // covered. Nothing downstream can detect that: the ledger still looks
        // complete, and the window it describes is simply wrong.
        const store = yield* makeSwitchStore();
        yield* seedSentinel(store, seededSentinelJson);
        yield* runSwitch(store, ["disarm", "a-much-later-reason"]);

        const armed = yield* runSwitch(store, ["arm"]);
        const window = yield* decodeDisarmWindow(expectSingleWindow(yield* readWindowRows(store)));

        expectSwitchOk(armed);
        expect(window.schemaVersion).toBe(HookPulseDisarmWindowSchemaVersion.Enum["hook-pulse-disarm-window/v1"]);
        expect(window.disarmedAt).toEqual(O.some(SEEDED_DISARM.disarmedAt));
        expect(window.reason).toEqual(O.some(SEEDED_DISARM.reason));
        // Self-labelled `unknown`: no hook rows exist for the window, so anything
        // computed across it is uninstrumented by construction.
        expect(window.evidenceTier).toBe(HookPulseEvidenceTier.Enum.unknown);
        expect(window.rearmedAt).toMatch(isoSecond);
        // ISO-8601 UTC at fixed width sorts lexicographically, so this is a real
        // ordering check: a window that closes before it opens is not a window.
        expect(window.rearmedAt > SEEDED_DISARM.disarmedAt).toBe(true);
        // The switch is armed again only if the sentinel is actually gone — the
        // writer tests for its existence and nothing else.
        expect(yield* readSentinel(store)).toEqual(O.none());
      })
    )
  );

  A.forEach(
    [
      { contents: "", label: "an empty `touch`-created sentinel" },
      { contents: "{not json", label: "a sentinel holding invalid JSON" },
    ],
    ({ contents, label }) => {
      it.effect(`records an unknown window start for ${label}`, () =>
        Effect.scoped(
          Effect.gen(function* () {
            // `touch`ing the sentinel path is a documented manual disarm, so both
            // of these are reachable in production. jq's `//` cannot rescue them:
            // on empty input jq emits nothing and still exits 0, so neither the
            // alternative nor `||` fires — the same empty-output trap that made
            // the writer's `capture()` drop whole rows.
            const store = yield* makeSwitchStore();
            yield* seedSentinel(store, contents);

            const disarmed = yield* runSwitch(store, ["disarm", "later-reason"]);

            expectSwitchOk(disarmed);
            // Idempotent here too: a sentinel it cannot parse is still a
            // sentinel, and stamping a fresh timestamp onto it would invent a
            // window start where the honest answer is that there isn't one.
            expect(yield* readSentinel(store)).toEqual(O.some(contents));

            const armed = yield* runSwitch(store, ["arm"]);
            const window = yield* decodeDisarmWindow(expectSingleWindow(yield* readWindowRows(store)));

            expectSwitchOk(armed);
            // `null`, never the rearm instant: a window whose start defaulted to
            // "now" would read as a zero-length gap, which is worse than an
            // admitted unknown because it looks like coverage.
            expect(window.disarmedAt).toEqual(O.none());
            expect(window.reason).toEqual(O.none());
            expect(window.rearmedAt).toMatch(isoSecond);
            expect(yield* readSentinel(store)).toEqual(O.none());
          })
        )
      );
    }
  );

  it.effect("appends nothing when arm runs while already armed", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const store = yield* makeSwitchStore();

        const run = yield* runSwitch(store, ["arm"]);

        expectSwitchOk(run);
        expect(run.stdout).toContain("already armed");
        // The ledger is append-only, so a no-op that appended anything would be
        // permanent: a phantom window nothing can retract. Not creating the file
        // at all also keeps "no windows yet" distinguishable from "a window whose
        // fields all came out empty".
        expect(yield* readWindowRows(store)).toEqual([]);
        expect(yield* fs.exists(store.windowsPath)).toBe(false);
      })
    )
  );

  it.effect("reports the sentinel document on status and stops reporting it once armed", () =>
    Effect.scoped(
      Effect.gen(function* () {
        // `status` is how an operator answers "is the instrument recording right
        // now", so it has to read the same sentinel the writer tests for rather
        // than a second opinion about it.
        const store = yield* makeSwitchStore();
        yield* seedSentinel(store, seededSentinelJson);

        const disarmed = yield* runSwitch(store, ["status"]);
        yield* runSwitch(store, ["arm"]);
        const armed = yield* runSwitch(store, ["status"]);

        expectSwitchOk(disarmed);
        expectSwitchOk(armed);
        expect(disarmed.stdout).toContain(store.sentinelPath);
        expect(disarmed.stdout).toContain(SEEDED_DISARM.disarmedAt);
        expect(disarmed.stdout).toContain(SEEDED_DISARM.reason);
        expect(armed.stdout).toContain("armed (no sentinel");
        expect(armed.stdout).not.toContain(SEEDED_DISARM.disarmedAt);
      })
    )
  );

  it.effect("exits 2 with usage on an unknown subcommand", () =>
    Effect.scoped(
      Effect.gen(function* () {
        // Also the non-vacuity anchor for every `exitCode` assertion above: they
        // all expect 0, so without one case that does not, a `runSwitch` that
        // silently reported success would satisfy the whole block.
        const store = yield* makeSwitchStore();

        const run = yield* runSwitch(store, ["bogus"]);

        expect(run.exitCode).toBe(2);
        expect(run.stderr).toContain("usage:");
        // Diagnostics on stderr, so a caller piping stdout cannot mistake a
        // usage error for a status line.
        expect(run.stdout).toBe("");
      })
    )
  );
});
