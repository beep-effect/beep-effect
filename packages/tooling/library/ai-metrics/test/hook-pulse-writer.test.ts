import * as NodeURL from "node:url";
import { Git } from "@beep/git/Git";
import {
  AI_METRICS_LOCAL_INSECURE_HASH_SALT,
  AiMetricsConfigSnapshotInput,
  agentEvidenceRoot,
  deriveHarnessHash,
  HarnessFingerprintInput,
  HookPulseAgentKind,
  HookPulseDisarmSentinel,
  HookPulseDisarmWindow,
  HookPulseDisarmWindowSchemaVersion,
  HookPulseEvent,
  HookPulseEvidenceTier,
  HookPulseInstrumentClass,
  HookPulseNotificationType,
  HookPulseRawEvent,
  HookPulseRefusal,
  HookPulseSchemaVersion,
  HookPulseV1,
  HookPulseV1Arbitrary,
  HookPulseV1FromRawEvent,
  HookPulseWaitReason,
  hashPrivateIdentifier,
  hashPublicTextSha256,
  hookPulseDisarmSentinelPath,
  hookPulseDisarmWindowsPath,
  hookPulseLedgerDir,
  hookPulseNamespace,
  makeAiMetricsConfigSnapshot,
  makeHarnessFingerprint,
} from "@beep/repo-ai-metrics";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Config from "effect/Config";
import * as ConfigProvider from "effect/ConfigProvider";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

// `Git` rides over the platform spawner: the snapshot reads the index through the kit (W2b).
const GitNodeServices = Layer.provideMerge(Git.layer, NodeServices.layer);

// The writer is shell, so the only honest conformance test spawns the real
// script and decodes what it wrote. `HookPulseV1` carries the
// `HookPulseWaitReasonInvariant` filter, so a jq derivation that ever drifts
// from the TypeScript `deriveWaitReason` fails the decode rather than silently
// producing a wrong ledger.
// `fileURLToPath`, not `URL.pathname`: the latter is percent-encoded, so a
// checkout path containing a space or `#` would yield an unspawnable writer path.
const repoRoot = NodeURL.fileURLToPath(new URL("../../../../../", import.meta.url));
const decodeHookPulseRefusalJson = S.decodeEffect(S.fromJsonString(HookPulseRefusal));
const writerPath = `${repoRoot}.claude/hooks/hook-pulse.sh`;
const codexWriterPath = `${repoRoot}.codex/hooks/hook-pulse.sh`;
// The Cursor adapter renames camelCase events into the ledger vocabulary, tags rows
// `cursor-cli`, and — unlike the Claude writer — MUST print a permission decision, because
// Cursor treats an empty stdout on a permission hook as malformed JSON and blocks the tool.
const cursorWriterPath = `${repoRoot}.cursor/hooks/hook-pulse.sh`;
const notifierPath = `${repoRoot}.claude/hooks/sequence-break-notifier.sh`;
// The operator half of the same instrument: the switch writes the sentinel the
// writer tests for, so the two scripts have to agree about where it lives.
const switchPath = `${repoRoot}.claude/hooks/hook-pulse-switch.sh`;

// Module scope: the compiled guard is built once, as the oxlint hoist rule requires.
const isHookPulseAgentKind = S.is(HookPulseAgentKind);

// Two guards exit before the writer reads stdin: the kill switch and an agent kind
// outside `HookPulseAgentKind`. Ignoring the pipe in those cases avoids racing a payload
// write against the child's intentional exit. With the pipe attached, the parent's write
// can land on a reader that has already gone, and Bun's fs-backed stdin stream reports
// that EPIPE from its post-`finish` destroy — after the sink has released its error
// listener — as an unhandled error that fails the run with every test passing (hosted
// Property Laws on this branch; main's nightly sweep of 2026-09-20).
const writerStdinFor = (
  stdin: string,
  options: { readonly agentKind?: string | undefined; readonly disarmSentinel?: string | undefined }
) =>
  O.isNone(O.fromUndefinedOr(options.disarmSentinel)) &&
  isHookPulseAgentKind(options.agentKind ?? HookPulseAgentKind.Enum["claude-code"])
    ? ({ stream: Stream.encodeText(Stream.make(stdin)), endOnDone: true } as const)
    : ("ignore" as const);

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

const decodeHookPulseFromRaw = S.decodeUnknownEffect(HookPulseV1FromRawEvent);
const decodeHookPulseRow = HookPulseV1.decodeJsonEffect;
const decodeRowKeys = S.decodeUnknownEffect(S.fromJsonString(S.Record(S.String, S.Unknown)));
const decodeRowString = S.decodeUnknownEffect(S.String);
const hookPulseEquivalent = S.toEquivalence(HookPulseV1);
// Fixture payloads are raw harness shapes, not a schema this package owns, so the
// unknown-shaped encoder is the right rung: it renders stdin without pretending the
// content-bearing keys we deliberately never model are part of the contract.
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

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
  "surface",
  "harnessHash",
  "sessionRole",
  "sessionStartSource",
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
      A.getSomes(A.map(A.fromIterable(Str.matchAll(/"([^"]*)"/g)(body)), (match) => O.fromNullishOr(match[1]))),
  });

interface WriterRun {
  readonly exitCode: number;
  readonly files: ReadonlyArray<string>;
  readonly refusals: ReadonlyArray<string>;
  readonly rows: ReadonlyArray<string>;
  readonly stderr: string;
  readonly stdout: string;
}

// Assertion messages survive TestConsole capture and include zero-row failures.
const assertAdapterStamp = Effect.fnUntraced(function* (
  run: WriterRun,
  agentKind: HookPulseAgentKind,
  stdout: string,
  harnessHash: string
) {
  const refusals = yield* Effect.forEach(run.refusals, (row) => decodeHookPulseRefusalJson(row));
  const diagnostics = yield* encodeJson({
    agentKind,
    exitCode: run.exitCode,
    stderr: run.stderr,
    refusalReasons: A.map(refusals, (refusal) => refusal.reason),
  });
  const message = `${agentKind} stamp diagnostics: ${diagnostics}`;
  expect(run.stdout, message).toBe(stdout);
  expect(run.rows, message).toHaveLength(1);
  const decoded = yield* decodeHookPulseRow(pipe(A.head(run.rows), O.getOrThrow));
  expect(O.isSome(decoded.harnessHash), message).toBe(true);
  assertSome(decoded.harnessHash, harnessHash);
  expect(decoded.agentKind, message).toBe(agentKind);
});

// Runs the real hook against an isolated evidence root so the live ledger — which
// already holds the committed 2026-08-01 spike corpus — can never receive a
// synthetic fixture row. The expected output location is derived from the
// exported path helpers rather than restated, so the shell writer and the
// TypeScript reader fail this test the moment they disagree about where the
// ledger lives.
const readWriterLines = Effect.fnUntraced(function* (directory: string, files: ReadonlyArray<string>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const forEach1 = yield* Effect.forEach(files, (entry) =>
    fs
      .readFileString(path.join(directory, entry))
      .pipe(Effect.map((contents) => A.filter(Str.split("\n")(contents), (line) => line.length > 0)))
  );
  return A.flatten(forEach1);
});

type WriterOptions = {
  readonly agentKind?: string;
  readonly aiMetricsHashSalt?: string;
  readonly disarmSentinel?: string;
  readonly hashSalt?: string;
  readonly namespaceProjection?: string;
  readonly defaultProjectionDocument?: string;
  readonly viaXdgFallback?: boolean;
  readonly writerPath?: string;
  readonly writerCap?: string;
  readonly stampCap?: string;
  readonly registeredEvent?: string;
  readonly writerArgs?: ReadonlyArray<string>;
  readonly attemptUtc?: string;
  readonly executablePath?: string;
  // Host and notifier knobs for the D3 host-guard cases; spread last so a case
  // can opt into the desktop notifier revision the legacy fixtures pin off.
  readonly extraEnv?: Readonly<Record<string, string>>;
};

// Every salt rung is cleared unless a case sets one, so a developer who
// exports a real ai-metrics salt cannot change what these digests are.
// Cleared, they exercise the insecure-default fallback that keeps an
// unconfigured clone byte-identical to `hashPrivateIdentifier(value, O.none())`.
// The later rungs are settable so the codec-parity cases can prove both
// halves walk the *same* chain rather than only its first link. The projection
// rung sits between the two variables: cleared, the writer falls to its XDG
// default under the temp HOME, where no projection exists, so an applied
// workstation projection can never leak into these digests; a case that
// exercises the rung names its fixture file explicitly.
const saltEnvironment = (stateHome: string, options: WriterOptions) => ({
  BEEP_HOOK_PULSE_HASH_SALT: options.hashSalt ?? "",
  BEEP_AI_METRICS_HASH_SALT: options.aiMetricsHashSalt ?? "",
  BEEP_HOOK_PULSE_NAMESPACE_PROJECTION: options.namespaceProjection ?? "",
  XDG_CACHE_HOME: `${stateHome}/.cache`,
});

const writerEnvironment = (stateHome: string, evidenceRoot: string, options: WriterOptions) => ({
  HOME: stateHome,
  XDG_STATE_HOME: stateHome,
  XDG_CONFIG_HOME: `${stateHome}/.config`,
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
  // Cleared unless a case sets it, so an ambient adapter value cannot retag rows;
  // empty falls through to the writer's `claude-code` default.
  BEEP_HOOK_PULSE_AGENT_KIND: options.agentKind ?? "",
  // The Cursor adapter caps the writer at 3 s. Measured 2026-09-16: at load average ~300
  // the cap killed the writer and this suite saw no row, so the conformance run lifts it.
  BEEP_CURSOR_HOOK_PULSE_WRITER_CAP: "60s",
  BEEP_HOOK_PULSE_WRITER_CAP: options.writerCap ?? "60s",
  BEEP_HOOK_PULSE_STAMP_CAP: options.stampCap ?? "60s",
  ...saltEnvironment(stateHome, options),
  BEEP_HOOK_PULSE_ATTEMPT_UTC: options.attemptUtc ?? "",
  // Cleared so an ambient cloud container's `BEEP_AGENT_HOST=cloud` cannot
  // change which writer branch a case exercises.
  BEEP_AGENT_HOST: "",
  ...(options.executablePath !== undefined ? { PATH: options.executablePath } : {}),
  ...options.extraEnv,
});

const runWriter = Effect.fnUntraced(function* (stdin: string, options: WriterOptions = {}) {
  const fs = yield* FileSystem.FileSystem;
  const stateHome = yield* fs.makeTempDirectoryScoped({
    prefix: "beep-hook-pulse-",
  });
  const evidenceRoot = agentEvidenceRoot(stateHome);
  const storeDir = hookPulseLedgerDir(evidenceRoot);
  if (options.defaultProjectionDocument !== undefined) {
    const projectionDir = `${stateHome}/.cache/beep/telemetry`;
    yield* fs.makeDirectory(projectionDir, { recursive: true });
    yield* fs.writeFileString(`${projectionDir}/namespace-projection.json`, options.defaultProjectionDocument);
  }

  if (O.isSome(O.fromUndefinedOr(options.disarmSentinel))) {
    yield* fs.makeDirectory(evidenceRoot, { recursive: true });
    yield* fs.writeFileString(hookPulseDisarmSentinelPath(evidenceRoot), `${options.disarmSentinel}\n`);
  }

  const childStdin = writerStdinFor(stdin, options);

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
  const handle = yield* ChildProcess.make(
    options.writerPath ?? writerPath,
    options.writerArgs ?? (options.registeredEvent !== undefined ? ["--event", options.registeredEvent] : []),
    {
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
      env: writerEnvironment(stateHome, evidenceRoot, options),
      // `endOnDone` is stated rather than left to its `true` default: closing stdin once
      // the payload is written is the whole reason this run terminates, so it is part of
      // what the helper promises and not an incidental default someone may retune.
      stdin: childStdin,
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  // Drained concurrently with the exit wait, never after it: a child that filled a pipe
  // buffer while the parent sat blocked on `exitCode` is the other shape of the same
  // hang. A signal death fails `handle.exitCode` with a `PlatformError` naming the
  // signal instead of yielding a code, which for this always-exits-0 writer is itself
  // the bug worth failing on, so it is left to propagate rather than coerced to success.
  const [stdout, stderr, exitCode] = yield* Effect.all(
    [
      handle.stdout.pipe(Stream.decodeText, Stream.mkString),
      handle.stderr.pipe(Stream.decodeText, Stream.mkString),
      handle.exitCode,
    ],
    { concurrency: "unbounded" }
  );

  const files = yield* fs.readDirectory(storeDir).pipe(Effect.orElseSucceed(A.empty<string>));
  const rows = yield* readWriterLines(storeDir, files);
  const refusalFiles = yield* fs
    .readDirectory(evidenceRoot)
    .pipe(
      Effect.orElseSucceed(A.empty<string>),
      Effect.map(A.filter((name) => Str.startsWith("hook-pulse-refusals-")(name)))
    );
  const refusals = yield* readWriterLines(evidenceRoot, refusalFiles);
  return { exitCode, files, stderr, stdout, rows, refusals, refusalFiles, stateHome };
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
const nonFiniteDurationStdin = Effect.map(
  encodeJson(R.remove(postToolUsePayload, "duration_ms")),
  (json) => `{"duration_ms":1e400,${Str.slice(1)(json)}`
);

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

// The notifier knobs a D3 case varies. Foreground keeps the stub call synchronous,
// so the call log is complete when the writer exits instead of racing `setsid -f`.
const notifierHostEnv = (host: string, notifierRev: string) => ({
  BEEP_AGENT_HOST: host,
  BEEP_HOOK_PULSE_NOTIFIER_REV: notifierRev,
  BEEP_SEQUENCE_BREAK_FOREGROUND: "1",
});

// A temp copy of the real writer beside a stub `sequence-break-notifier.sh` that
// appends one line per call to a log in the same scoped directory.
const makeNotifierStubWriter = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fs.makeTempDirectoryScoped({ prefix: "beep-hook-pulse-notifier-stub-" });
  const stubWriterPath = path.join(directory, "hook-pulse.sh");
  const stubNotifierPath = path.join(directory, "sequence-break-notifier.sh");
  const callLog = path.join(directory, "notifier-calls.log");
  yield* fs.copyFile(writerPath, stubWriterPath);
  yield* fs.writeFileString(stubNotifierPath, `#!/usr/bin/env bash\nprintf 'call %s\\n' "$#" >>'${callLog}'\n`);
  yield* fs.chmod(stubWriterPath, 0o755);
  yield* fs.chmod(stubNotifierPath, 0o755);
  // An absent log means no call; any other read failure fails the case.
  const calls = Effect.gen(function* () {
    return (yield* fs.exists(callLog)) ? yield* readWriterLines(directory, ["notifier-calls.log"]) : A.empty<string>();
  });
  return { calls, writerPath: stubWriterPath };
});

// A repo root shaped to hit every rule the shell harness-hash walk mirrors from
// `makeAiMetricsConfigSnapshot`: a root `AGENTS.md` with `CLAUDE.md` symlinked to
// it, a nested agent doc the root walk reaches, both session-scope and
// baseline-scope config files, a nested git root under `.claude` and another
// under `packages` (both must drop out with everything beneath them), excluded
// directory names, a non-UTF-8 binary, and a byte-order-marked script (both
// hashed through the decoder TypeScript's `readFileString` applies).
const makeHarnessFixtureRoot = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-hook-pulse-harness-" });
  const writeBytes = Effect.fnUntraced(function* (relative: string, content: Uint8Array) {
    const file = path.join(root, relative);
    yield* fs.makeDirectory(path.dirname(file), { recursive: true });
    yield* fs.writeFile(file, content);
  });
  const write = (relative: string, content: string) => writeBytes(relative, new TextEncoder().encode(content));
  yield* write("AGENTS.md", "# Fixture guide\n");
  yield* fs.symlink("AGENTS.md", path.join(root, "CLAUDE.md"));

  yield* write("packages/foo/AGENTS.md", "# foo guide\n");
  yield* write("packages/foo/README.md", "# not an agent doc\n");
  yield* write("packages/bar/.git", "gitdir: /elsewhere/bar\n");
  yield* write("packages/bar/AGENTS.md", "# nested checkout guide\n");
  yield* write("dist/AGENTS.md", "# excluded by name\n");
  yield* write(".claude/settings.json", '{ "hooks": {} }\n');
  yield* write(".claude/skills/alpha/SKILL.md", "# alpha\n");
  yield* writeBytes(
    ".claude/skills/alpha/logo.png",
    new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0xff, 0x00, 0xc3])
  );
  yield* writeBytes(
    ".claude/hooks/pulse.sh",
    new Uint8Array([0xef, 0xbb, 0xbf, 0x23, 0x21, 0x2f, 0x62, 0x69, 0x6e, 0x0a])
  );
  yield* write(".claude/worktrees/wt1/.git", "gitdir: /elsewhere/wt1\n");
  yield* write(".claude/worktrees/wt1/AGENTS.md", "# nested worktree guide\n");
  yield* write(".claude/worktrees/wt1/.claude/settings.json", "{}\n");
  yield* write(".claude/node_modules/pkg/index.js", "module.exports = 1\n");
  yield* write(".claude/logs/session.log", "log line\n");
  yield* write(".codex/config.toml", 'model = "fixture"\n');
  yield* fs.remove(path.join(root, "packages/bar/.git"));
  yield* fs.remove(path.join(root, ".claude/worktrees/wt1/.git"));
  for (const args of [
    ["init", "-q"],
    ["add", "--all"],
  ]) {
    const child = yield* ChildProcess.make("git", args, { cwd: root, stdout: "ignore", stderr: "ignore" });
    const exitCode2 = yield* child.exitCode;
    expect(exitCode2).toBe(0);
  }
  yield* write("packages/bar/.git", "gitdir: /elsewhere/bar\n");
  yield* write(".claude/worktrees/wt1/.git", "gitdir: /elsewhere/wt1\n");
  return root;
});

// The TypeScript oracle for the shell stamp: the same snapshot the harness ledger
// fingerprints, reduced to the harness hash.
const typescriptHarnessHash = Effect.fnUntraced(function* (root: string) {
  const snapshot = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot: root }));
  const madeHarnessFingerprint = yield* makeHarnessFingerprint(HarnessFingerprintInput.make({ snapshot }));
  return {
    snapshot,
    harnessHash: yield* deriveHarnessHash(madeHarnessFingerprint),
  };
});

const sessionStartPayload = (cwd: string) => ({
  ...baseFields,
  cwd,
  hook_event_name: HookPulseEvent.Enum.SessionStart,
  model: CANARY,
  source: "startup",
});

it.layer(GitNodeServices, { timeout: "30 seconds" })("hook-pulse writer conformance", (it) => {
  it.effect("tags Codex hook rows as codex-cli", () =>
    Effect.gen(function* () {
      const encodedJson = yield* encodeJson(preToolUsePayload);
      const run = yield* runWriter(encodedJson, { writerPath: codexWriterPath });
      const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

      expect(decoded.agentKind).toBe(HookPulseAgentKind.Enum["codex-cli"]);
    })
  );

  it.effect("tags Cursor hook rows as cursor-cli and answers the permission protocol", () =>
    Effect.gen(function* () {
      // Cursor's stdin: the same snake_case keys, a camelCase event name.
      const cursorPayload = {
        ...preToolUsePayload,
        conversation_id: "cursor-conversation-writer-1",
        cursor_version: "2026.09.10",
        generation_id: "cursor-generation-writer-1",
        hook_event_name: "preToolUse",
        model: "composer-2.5",
        workspace_roots: [baseFields.cwd],
      };
      const encodedJson3 = yield* encodeJson(cursorPayload);
      const run = yield* runWriter(encodedJson3, { writerPath: cursorWriterPath });

      expect(run.exitCode).toBe(0);
      expect(run.stderr).toBe("");
      expect(run.stdout).toBe('{"permission":"allow"}\n');
      expect(run.rows).toHaveLength(1);
      const [row] = run.rows;
      expect(row).toBeDefined();
      const decoded = yield* decodeHookPulseRow(`${row}`);

      expect(decoded.agentKind).toBe(HookPulseAgentKind.Enum["cursor-cli"]);
      expect(decoded.hookEvent).toBe(HookPulseEvent.Enum.PreToolUse);
    })
  );

  it.effect("writes nothing for an agent kind outside HookPulseAgentKind", () =>
    Effect.gen(function* () {
      const encodedJson4 = yield* encodeJson(preToolUsePayload);
      const run = yield* runWriter(encodedJson4, { agentKind: "other" });
      expectSilentRefusal(run);
      expect(run.refusals).toHaveLength(1);
      const refusal = yield* decodeHookPulseRefusalJson(pipe(A.head(run.refusals), O.getOrThrow));
      expect(refusal.agentKind).toBe("unknown");
      expect(refusal.reason).toBe("unknown-agent-kind");
      expect(pipe(A.head(run.refusals), O.getOrThrow)).not.toContain(CANARY);
    })
  );

  it.effect("keeps the writer's agent-kind guard set-equal to HookPulseAgentKind", () =>
    Effect.gen(function* () {
      // The writer copies `BEEP_HOOK_PULSE_AGENT_KIND` into every row, so its guard `case`
      // is the only thing keeping an undecodable kind out of the ledger.
      const fs = yield* FileSystem.FileSystem;
      const source = yield* fs.readFileString(writerPath);
      const arm = O.fromNullishOr(/case "\$\{agent_kind\}" in\s*\n\s*([^)\n]+)\)\s*;;/.exec(source)?.[1]);
      const admitted = O.match(arm, {
        onNone: () => A.empty<string>(),
        onSome: (body) => A.map(Str.split("|")(body), (kind) => Str.trim(kind)),
      });

      expect(A.difference(admitted, HookPulseAgentKind.literals)).toEqual([]);
      expect(A.difference(HookPulseAgentKind.literals, admitted)).toEqual([]);
    })
  );

  it.effect("keeps the sequence-break notifier agent-kind allowlist and title map in lockstep", () =>
    Effect.gen(function* () {
      // `HookPulseAgentKind` is the schema; the notifier hand-duplicates it twice — the
      // admission `case` arm and the desktop title map. Without this check a new kind
      // (as `cursor-cli` was) reaches the ledger but is silently dropped by the notifier,
      // or is admitted with an empty title (" needs your input"). Same drift class the
      // `hook_events` allowlist sync above protects against, so the same set-equality.
      const fs = yield* FileSystem.FileSystem;
      const source = yield* fs.readFileString(notifierPath);
      const arm = O.fromNullishOr(/case "\$\{agent_kind\}" in\s*\n\s*([^)\n]+)\)\s*;;/.exec(source)?.[1]);
      const admitted = O.match(arm, {
        onNone: () => A.empty<string>(),
        onSome: (body) => A.map(Str.split("|")(body), (kind) => Str.trim(kind)),
      });
      // Anchored to the agent-kind title `case`: the target `case` below it also has
      // `<name>) title="..." ;;` arms (human-input, plan-approval, tool-permission).
      const titleArm = O.fromNullishOr(
        /case "\$\{agent_kind\}" in((?:\s*[a-z-]+\) title="[^"]+" ;;)+)\s*esac/.exec(source)?.[1]
      );
      const titled = O.match(titleArm, {
        onNone: () => A.empty<string>(),
        onSome: (body) =>
          A.getSomes(
            A.map(A.fromIterable(Str.matchAll(/([a-z-]+)\) title=/g)(body)), (match) => O.fromNullishOr(match[1]))
          ),
      });
      const schemaKinds = HookPulseAgentKind.literals;

      expect(A.difference(admitted, schemaKinds)).toEqual([]);
      expect(A.difference(schemaKinds, admitted)).toEqual([]);
      expect(A.difference(titled, schemaKinds)).toEqual([]);
      expect(A.difference(schemaKinds, titled)).toEqual([]);
    })
  );

  A.forEach(measuredPayloads, ({ label, payload, permissionMode, waitReason }) => {
    it.effect(`emits one HookPulseV1 row for ${label}`, () =>
      Effect.gen(function* () {
        const encodedJson5 = yield* encodeJson(payload);
        const run = yield* runWriter(encodedJson5);
        const row = expectSingleRow(run);
        const decoded = yield* decodeHookPulseRow(row);

        expect(S.is(HookPulseV1)(decoded)).toBe(true);
        expect(decoded.schemaVersion).toBe(HookPulseSchemaVersion.Enum["hook-pulse/v1"]);
        expect(decoded.agentKind).toBe(HookPulseAgentKind.Enum["claude-code"]);
        expect(decoded.instrumentClass).toBe(HookPulseInstrumentClass.Enum.production);
        // Pseudonymized, not raw: these three carry `Sha256Hex`, so the
        // expectation is the oracle digest rather than the identifier itself.
        const expectation1 = expect(decoded.sessionId);
        const privateDigest1 = yield* privateDigest(session);
        expectation1.toBe(privateDigest1);
        const expectation2 = expect(decoded.cwd);
        const privateDigest2 = yield* privateDigest(baseFields.cwd);
        expectation2.toBe(privateDigest2);
        expect(decoded.notifierRev).toBe("log-only-0");
        expect(decoded.waitReason).toBe(waitReason);
        // `transcriptPath` is the one forwarded field the codec cannot do
        // without: `HookPulseRawEvent.transcript_path` is required, so a row
        // missing it still decodes but can never be re-encoded — a replay
        // break that only surfaces in P4, long after the evidence is gone.
        const privateDigest6 = yield* privateDigest(baseFields.transcript_path);
        assertSome(decoded.transcriptPath, privateDigest6);
        assertSome(decoded.promptId, baseFields.prompt_id);
        expect(decoded.permissionMode).toEqual(permissionMode);
        // Weakest-link: `waitReason` is derived, and the codec's
        // `clampDerivedEvidenceTier` maps `observed` to `derived`. A writer
        // stamping `observed` would make P4's replay-twice-diff disagree.
        expect(decoded.evidenceTier).toBe(HookPulseEvidenceTier.Enum.derived);
      })
    );

    it.effect(`writes no measured content for ${label}`, () =>
      Effect.gen(function* () {
        const encodedJson7 = yield* encodeJson(payload);
        const run = yield* runWriter(encodedJson7);
        const row = expectSingleRow(run);

        expect(row).not.toContain(CANARY);
        // Hashing is what the writer now does to the identifiers it cannot
        // drop, which makes "hash it instead" a newly plausible way to keep a
        // content field. A digest of the canary is still derived from content
        // and still belongs nowhere in the ledger.
        const argument = expect(row).not;
        const privateDigest3 = yield* privateDigest(CANARY);
        argument.toContain(privateDigest3);
        const decodedRowKeys = yield* decodeRowKeys(row);
        expect(A.difference(R.keys(decodedRowKeys), canonicalRowKeys)).toEqual([]);
      })
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

  it.effect.prop(
    "keeps every schema-inhabitable canonical row inside the declared ledger surface",
    [HookPulseV1Arbitrary],
    Effect.fnUntraced(function* ([value]) {
      const line = yield* HookPulseV1.encodeJsonEffect(value);

      const keys = yield* decodeRowKeys(line);

      const decoded = yield* HookPulseV1.decodeJsonEffect(line);

      expect(A.difference(R.keys(keys), canonicalRowKeys)).toEqual([]);

      pipe(hookPulseEquivalent(decoded, value), assertTrue);
    }),
    { arbitrary: fcRuns(50) }
  );

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
      expect(A.difference(events, HookPulseEvent.literals)).toEqual([]);
      expect(A.difference(HookPulseEvent.literals, events)).toEqual([]);
      expect(A.difference(notificationTypes, HookPulseNotificationType.literals)).toEqual([]);
      expect(A.difference(HookPulseNotificationType.literals, notificationTypes)).toEqual([]);
    })
  );

  it.effect("shards the ledger by UTC day and hashed session id", () =>
    Effect.gen(function* () {
      // The script claims per-session sharding makes cross-session
      // interleaving structurally impossible. The runner globs the whole
      // directory, so dropping the session suffix would keep every other test
      // green while quietly restoring that hazard. The suffix is the digest,
      // not the raw session id: a filename is as readable as a row, so a
      // ledger whose rows are pseudonymized while its directory listing spells
      // out every session UUID has pseudonymized nothing.
      const encodedJson8 = yield* encodeJson(preToolUsePayload);
      const run = yield* runWriter(encodedJson8);
      const row = expectSingleRow(run);
      const keys = yield* decodeRowKeys(row);
      const ts = yield* decodeRowString(keys.ts);
      const sessionDigest = yield* privateDigest(session);

      // Exact equality against the oracle digest, so the raw session id cannot
      // reappear in the name under any spelling.
      expect(run.files).toEqual([`hook-pulse-${Str.slice(0, 10)(ts)}-${sessionDigest}.ndjson`]);
    })
  );

  it.effect("hashes private identifiers to the digests the TypeScript oracle computes", () =>
    Effect.gen(function* () {
      // The shell writer and `hashPrivateIdentifier` are two implementations
      // of one contract, and every other assertion in this file is satisfied
      // by any 64-hex string. This is the only one that fails when the shell
      // hashes the right value the wrong way — the NUL-through-a-variable trap
      // described above being the way it actually happens.
      const encodedJson9 = yield* encodeJson(preToolUsePayload);
      const run = yield* runWriter(encodedJson9);
      const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

      const expectation3 = expect(decoded.sessionId);
      const privateDigest4 = yield* privateDigest(session);
      expectation3.toBe(privateDigest4);
      const expectation4 = expect(decoded.cwd);
      const privateDigest5 = yield* privateDigest(baseFields.cwd);
      expectation4.toBe(privateDigest5);
      const privateDigest10 = yield* privateDigest(baseFields.transcript_path);
      assertSome(decoded.transcriptPath, privateDigest10);
    })
  );

  it.effect("hashes context surfaces to the digests the TypeScript codec derives", () =>
    Effect.gen(function* () {
      // The shell `surface_program` and `hookPulseContextSurfaceKey` are two
      // implementations of one classification. Each payload runs through both,
      // and each digest is also pinned to its expected key, so a rule that
      // drifted on both sides the same way still fails. The skill name and the
      // hook file name are the canary: only their digest may reach the row.
      // The fixture cwd does not exist on disk, so the writer's root walk
      // finds nothing and falls back to cwd, which is also the codec default.
      const surfacePayload = (toolName: string, toolInput: unknown) => ({
        ...baseFields,
        duration_ms: 3,
        hook_event_name: HookPulseEvent.Enum.PostToolUse,
        permission_mode: "default",
        tool_input: toolInput,
        tool_name: toolName,
        tool_response: { stdout: CANARY },
        tool_use_id: "toolu_writer_surface",
      });
      const cases = [
        { payload: surfacePayload("Skill", { skill: `/${CANARY}` }), key: O.some(`skill:${CANARY}`) },
        { payload: surfacePayload("mcp__notion__search", { query: CANARY }), key: O.some("mcp-server:notion") },
        {
          payload: surfacePayload("Read", { file_path: `${baseFields.cwd}/.claude/hooks/${CANARY}.sh` }),
          key: O.some(`hook:${CANARY}.sh`),
        },
        ...A.map([".agents", ".codex", ".cursor"], (root) => ({
          payload: surfacePayload("Read", { file_path: `${baseFields.cwd}/${root}/skills/${CANARY}/SKILL.md` }),
          key: O.some(`skill:${CANARY}`),
        })),
        { payload: surfacePayload("Read", { file_path: "packages/foo/src/x.ts" }), key: O.none<string>() },
        { payload: surfacePayload("mcp__notion__search", { path: ["a", "b"] }), key: O.some("mcp-server:notion") },
        {
          payload: surfacePayload("mcp__notion__search", { path: { nested: true } }),
          key: O.some("mcp-server:notion"),
        },
        { payload: surfacePayload("mcp__notion__search", 7), key: O.some("mcp-server:notion") },
        { payload: surfacePayload("Read", null), key: O.none<string>() },
        { payload: surfacePayload("Read", ["path"]), key: O.none<string>() },
        {
          payload: surfacePayload("Read", { file_path: `${baseFields.cwd}/.claude/hooks/${CANARY}.sh`, path: ["a"] }),
          key: O.some(`hook:${CANARY}.sh`),
        },
        ...A.map([".", "repo", "repo/subdir"], (cwd) => ({
          payload: { ...surfacePayload("Read", { file_path: ".claude/hooks/pulse.sh" }), cwd },
          key: O.none<string>(),
        })),
      ];

      yield* Effect.forEach(
        cases,
        Effect.fnUntraced(function* ({ payload, key }) {
          const encodedJson11 = yield* encodeJson(payload);
          const run = yield* runWriter(encodedJson11);
          const row = expectSingleRow(run);
          const writerRow = yield* decodeHookPulseRow(row);
          const codecRow = yield* withSaltEnv(
            {},
            decodeHookPulseFromRaw({
              event: payload,
              notifierRev: "log-only-0",
              instrumentClass: HookPulseInstrumentClass.Enum.production,
              agentKind: HookPulseAgentKind.Enum["claude-code"],
              evidenceTier: HookPulseEvidenceTier.Enum.derived,
              ts: "2026-08-01T06:40:07.000Z",
            })
          );
          const expected = yield* O.match(key, {
            onNone: () => Effect.succeedNone,
            onSome: (value) => Effect.asSome(hashPublicTextSha256(value)),
          });

          expect(writerRow.surface).toEqual(expected);
          expect(codecRow.surface).toEqual(expected);
          expect(row).not.toContain(CANARY);
        }),
        { discard: true }
      );
    })
  );

  // Keep adapters as separate cases so a hosted failure identifies its boundary.
  // Both use the synthetic indexed harness and runWriter's empty temporary HOME.
  for (const adapter of [
    {
      writerPath: codexWriterPath,
      agentKind: HookPulseAgentKind.Enum["codex-cli"],
      hookEvent: "SessionStart",
      registeredEvent: undefined,
      stdout: "",
    },
    {
      writerPath: cursorWriterPath,
      agentKind: HookPulseAgentKind.Enum["cursor-cli"],
      hookEvent: undefined,
      registeredEvent: "sessionStart",
      stdout: "{}\n",
    },
  ]) {
    it.effect(`${adapter.agentKind} SessionStart adapter preserves the shared stamp`, () =>
      Effect.gen(function* () {
        const root = yield* makeHarnessFixtureRoot();
        const oracle = yield* typescriptHarnessHash(root);
        const encodedJson12 = yield* encodeJson({ ...sessionStartPayload(root), hook_event_name: adapter.hookEvent });
        const run = yield* runWriter(encodedJson12, {
          writerPath: adapter.writerPath,
          ...(adapter.registeredEvent === undefined ? {} : { registeredEvent: adapter.registeredEvent }),
        });
        yield* assertAdapterStamp(run, adapter.agentKind, adapter.stdout, oracle.harnessHash);
      })
    );

    it.effect(`${adapter.agentKind} honors the explicit stamp cap after 3000ms of startup work`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* makeHarnessFixtureRoot();
        const oracle = yield* typescriptHarnessHash(root);
        const bin = yield* fs.makeTempDirectoryScoped();
        const date = path.join(bin, "date");
        // Pin the counterexample without sleeping or depending on runner load:
        // the body starts at 1000ms and reaches the stamp gate at 4000ms.
        yield* fs.writeFileString(
          date,
          `#!/usr/bin/env bash
if [ "$*" = '+%s%3N' ]; then
  if [ -e "${date}.started" ]; then
    printf '4000\\n'
  else
    touch "${date}.started"
    printf '1000\\n'
  fi
else
  command -p date "$@"
fi
`
        );
        yield* fs.chmod(date, 0o755);
        const executablePath = `${bin}:${yield* Config.String("PATH")}`;
        for (const stampCap of ["60s", ""]) {
          yield* fs.remove(`${date}.started`, { force: true });
          const encodedJson13 = yield* encodeJson({ ...sessionStartPayload(root), hook_event_name: adapter.hookEvent });
          const run = yield* runWriter(encodedJson13, {
            writerPath: adapter.writerPath,
            ...(adapter.registeredEvent === undefined ? {} : { registeredEvent: adapter.registeredEvent }),
            executablePath,
            stampCap,
          });
          if (stampCap === "60s") {
            yield* assertAdapterStamp(run, adapter.agentKind, adapter.stdout, oracle.harnessHash);
            expect(run.refusals).toHaveLength(0);
          } else {
            expect(run.stdout).toBe(adapter.stdout);
            expect(run.rows).toHaveLength(1);
            assertNone((yield* decodeHookPulseRow(A.getUnsafe(run.rows, 0))).harnessHash);
            expect((yield* decodeHookPulseRefusalJson(A.getUnsafe(run.refusals, 0))).reason).toBe("stamp-failed");
          }
        }
      })
    );

    it.effect(`${adapter.agentKind} stamp assertion reports refusals for None stamps and missing rows`, () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* makeHarnessFixtureRoot();
        const oracle = yield* typescriptHarnessHash(root);
        // An indexed symlink loop deterministically refuses the stamp, even as root.
        yield* fs.symlink("loop.md", path.join(root, ".claude/loop.md"));
        const addLoop = yield* ChildProcess.make("git", ["add", ".claude/loop.md"], { cwd: root });
        const exitCode14 = yield* addLoop.exitCode;
        expect(exitCode14).toBe(0);
        const encodedJson15 = yield* encodeJson({ ...sessionStartPayload(root), hook_event_name: adapter.hookEvent });
        const run = yield* runWriter(encodedJson15, {
          writerPath: adapter.writerPath,
          ...(adapter.registeredEvent === undefined ? {} : { registeredEvent: adapter.registeredEvent }),
        });
        expect(run.rows).toHaveLength(1);
        assertNone((yield* decodeHookPulseRow(pipe(A.head(run.rows), O.getOrThrow))).harnessHash);
        for (const failedRun of [run, { ...run, rows: A.empty<string>() }]) {
          const failure = yield* assertAdapterStamp(
            failedRun,
            adapter.agentKind,
            adapter.stdout,
            oracle.harnessHash
          ).pipe(Effect.exit);
          pipe(failure, Exit.isFailure, assertTrue);
          if (Exit.isFailure(failure)) {
            const message = Cause.pretty(failure.cause);
            expect(message).toContain(adapter.agentKind);
            expect(message).toContain("stamp-failed");
            expect(message).toContain('"exitCode":0');
            expect(message).toContain('"stderr":');
          }
        }
      })
    );
  }

  it.effect("preserves git stamp parity with nested docs, symlinks and unrelated quoted names", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* fs.makeTempDirectoryScoped({ prefix: "h3-index-" });
      yield* fs.makeDirectory(path.join(root, "packages/foo"), { recursive: true });
      yield* fs.makeDirectory(path.join(root, "packages/nested"), { recursive: true });
      yield* fs.writeFileString(path.join(root, "packages/nested/AGENTS.md"), "# Nested checkout\n");
      yield* fs.makeDirectory(path.join(root, ".ai"));
      yield* fs.makeDirectory(path.join(root, ".aiassistant"));
      yield* fs.makeDirectory(path.join(root, ".claude/a/b/c/d/e/f/g"), { recursive: true });
      yield* fs.writeFileString(path.join(root, ".claude/a/b/c/d/e/f/g/config.json"), "{}\n");
      yield* fs.writeFileString(path.join(root, "AGENTS.md"), "# Indexed fixture\n");
      yield* fs.symlink("AGENTS.md", path.join(root, "CLAUDE.md"));
      yield* fs.writeFileString(path.join(root, "packages/foo/AGENTS.md"), "# Nested fixture\n");
      yield* fs.makeDirectory(path.join(root, "stat: fixture"));
      yield* fs.writeFileString(path.join(root, "stat: fixture/AGENTS.md"), "# Diagnostic-shaped path\n");
      yield* fs.makeDirectory(path.join(root, ".claude/batch"));
      yield* Effect.forEach(
        A.range(0, 149),
        (index) => fs.writeFileString(path.join(root, `.claude/batch/long-inspection-path-${index}.md`), "batch\n"),
        { concurrency: 4, discard: true }
      );
      yield* fs.writeFileString(path.join(root, ".ai/config.json"), "{}\n");
      yield* fs.writeFileString(path.join(root, ".aiassistant/config.json"), "{}\n");
      yield* fs.writeFileString(path.join(root, 'unrelated"name.txt'), "fixture\n");
      for (const args of [
        ["init", "--quiet"],
        ["add", "."],
      ]) {
        const command = yield* ChildProcess.make("git", args, { cwd: root, stdout: "ignore", stderr: "ignore" });
        const exitCode16 = yield* command.exitCode;
        expect(exitCode16).toBe(0);
      }
      yield* fs.writeFileString(path.join(root, "packages/nested/.git"), "gitdir: /fixture/missing\n");
      yield* fs.makeDirectory(path.join(root, ".claude/scratch"), { recursive: true });
      yield* fs.writeFileString(path.join(root, ".claude/scratch/naïve.md"), "ignored fixture\n");
      yield* Effect.forEach(
        A.range(0, 1000),
        (index) => fs.writeFileString(path.join(root, `.claude/scratch/noise-${index}.txt`), "ignored fixture\n"),
        { concurrency: 4, discard: true }
      );
      yield* fs.makeDirectory(path.join(root, ".claude/node_modules"), { recursive: true });
      yield* fs.writeFileString(path.join(root, '.claude/node_modules/bad"name.txt'), "excluded");
      yield* fs.writeFileString(path.join(root, ".claude/logs"), "excluded filename");
      yield* fs.makeDirectory(path.join(root, ".codex"), { recursive: true });
      yield* fs.writeFileString(path.join(root, ".codex/deleted.toml"), "deleted indexed config");
      yield* fs.writeFileString(path.join(root, ".claude/naïve.md"), "deleted unusual path");
      const addExcluded = yield* ChildProcess.make(
        "git",
        ["add", "-f", ".claude/node_modules", ".claude/logs", ".codex/deleted.toml", ".claude/naïve.md"],
        { cwd: root }
      );
      const exitCode17 = yield* addExcluded.exitCode;
      expect(exitCode17).toBe(0);
      yield* fs.remove(path.join(root, ".codex/deleted.toml"));
      yield* fs.remove(path.join(root, ".claude/naïve.md"));
      const encodedJson86 = yield* encodeJson(sessionStartPayload(root));
      const resultWriter = yield* runWriter(encodedJson86);
      const decoded = yield* decodeHookPulseRow(expectSingleRow(resultWriter));
      const oracle = yield* typescriptHarnessHash(root);
      assertSome(decoded.harnessHash, oracle.harnessHash);
      expect(oracle.snapshot.bounds.excludedNestedRootPaths).toContain("packages/nested");
      expect(A.map(oracle.snapshot.files, (file) => file.relativePath)).not.toContain("packages/nested/AGENTS.md");
      expect(A.map(oracle.snapshot.files, (file) => file.relativePath)).toContain("packages/foo/AGENTS.md");
      expect(A.map(oracle.snapshot.files, (file) => file.relativePath)).toContain("stat: fixture/AGENTS.md");
      expect(A.map(oracle.snapshot.files, (file) => file.relativePath)).toContain("CLAUDE.md");
      expect(A.map(oracle.snapshot.files, (file) => file.relativePath)).toContain(".ai/config.json");
      expect(A.map(oracle.snapshot.files, (file) => file.relativePath)).toContain(".claude/a/b/c/d/e/f/g/config.json");
    })
  );

  it.effect("refuses indexed metadata permission errors after successful batch entries", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* makeHarnessFixtureRoot();
      const blocked = path.join(root, ".claude/zz-blocked");
      yield* fs.makeDirectory(blocked);
      yield* fs.writeFileString(path.join(blocked, "config.json"), "{}\n");
      const add = yield* ChildProcess.make("git", ["add", ".claude/zz-blocked"], { cwd: root });
      const exitCode18 = yield* add.exitCode;
      expect(exitCode18).toBe(0);
      yield* fs.chmod(blocked, 0o000);
      const encodedJson19 = yield* encodeJson(sessionStartPayload(root));
      const run = yield* runWriter(encodedJson19).pipe(Effect.ensuring(fs.chmod(blocked, 0o755).pipe(Effect.orDie)));
      assertNone((yield* decodeHookPulseRow(expectSingleRow(run))).harnessHash);
      expect(
        Result.getOrThrow(HookPulseRefusal.decodeJsonResult(pipe(A.head(run.refusals), O.getOrThrow))).reason
      ).toBe("stamp-failed");
    })
  );

  it.effect("preserves dangling-link parity and refuses indexed symlink loops", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* makeHarnessFixtureRoot();
      yield* fs.symlink("missing.md", path.join(root, ".claude/dangling.md"));
      const addDangling = yield* ChildProcess.make("git", ["add", ".claude/dangling.md"], { cwd: root });
      const exitCode20 = yield* addDangling.exitCode;
      expect(exitCode20).toBe(0);
      const encodedJson21 = yield* encodeJson(sessionStartPayload(root));
      const dangling = yield* runWriter(encodedJson21);
      assertSome(
        (yield* decodeHookPulseRow(expectSingleRow(dangling))).harnessHash,
        (yield* typescriptHarnessHash(root)).harnessHash
      );
      yield* fs.symlink("loop.md", path.join(root, ".claude/loop.md"));
      const addLoop = yield* ChildProcess.make("git", ["add", ".claude/loop.md"], { cwd: root });
      const exitCode22 = yield* addLoop.exitCode;
      expect(exitCode22).toBe(0);
      const encodedJson23 = yield* encodeJson(sessionStartPayload(root));
      const loop = yield* runWriter(encodedJson23);
      assertNone((yield* decodeHookPulseRow(expectSingleRow(loop))).harnessHash);
      expect(
        Result.getOrThrow(HookPulseRefusal.decodeJsonResult(pipe(A.head(loop.refusals), O.getOrThrow))).reason
      ).toBe("stamp-failed");
    })
  );

  it.effect("records a timeout refusal before the harness deadline", () =>
    Effect.gen(function* () {
      const encodedJson24 = yield* encodeJson(preToolUsePayload);
      const run = yield* runWriter(encodedJson24, { writerCap: "0.001s" });
      expect(run.exitCode).toBe(0);
      expect(run.stdout).toBe("");
      expect(run.rows).toHaveLength(0);
      const refusal = yield* pipe(A.head(run.refusals), O.getOrThrow, decodeHookPulseRefusalJson);
      expect(refusal.reason).toBe("timeout");
    })
  );

  it.effect("disarmed Cursor preserves protocol without reading its payload", () =>
    Effect.gen(function* () {
      for (const [registeredEvent, stdout] of [
        ["preToolUse", '{"permission":"allow"}\n'],
        ["beforeSubmitPrompt", '{"continue":true}\n'],
        ["sessionStart", "{}\n"],
      ]) {
        const run = yield* runWriter("not JSON", {
          writerPath: cursorWriterPath,
          disarmSentinel: "disarmed",
          ...(registeredEvent === undefined ? {} : { registeredEvent }),
        });
        expect(run.stdout).toBe(stdout);
        expect(run.rows).toHaveLength(0);
        expect(run.refusals).toHaveLength(1);
      }
    })
  );

  it.effect("preserves an unstamped startup when its fingerprint deadline expires", () =>
    Effect.gen(function* () {
      const encodedJson25 = yield* encodeJson(sessionStartPayload(repoRoot));
      const run = yield* runWriter(encodedJson25, { stampCap: "0.001s" });
      const row = yield* decodeHookPulseRow(expectSingleRow(run));
      assertNone(row.harnessHash);
      expect(run.stdout).toBe("");
      const refusals = A.map(run.refusals, (line) => HookPulseRefusal.decodeJsonResult(line));
      expect(
        A.some(refusals, (decoded) => decoded._tag === "Success" && decoded.success.reason === "stamp-failed")
      ).toBe(true);
    })
  );

  it.effect("drops a malformed source field without dropping its event", () =>
    Effect.gen(function* () {
      const payload = { ...preToolUsePayload, source: 42 };
      const raw = yield* HookPulseRawEvent.decodeEffect(payload);
      assertNone(raw.source);
      const encodedJson87 = yield* encodeJson(payload);
      const resultWriter26 = yield* runWriter(encodedJson87);
      const decoded = yield* decodeHookPulseRow(expectSingleRow(resultWriter26));
      expect(decoded.hookEvent).toBe("PreToolUse");
      assertNone(decoded.sessionStartSource);
    })
  );

  it.effect("stamps SessionStart with the harness hash the TypeScript snapshot derives", () =>
    Effect.gen(function* () {
      const root = yield* makeHarnessFixtureRoot();
      const path = yield* Path.Path;
      // A cwd below the root: the writer walks up to the nearest AGENTS.md + .git.
      const encodedJson27 = yield* encodeJson(sessionStartPayload(path.join(root, "packages", "foo")));
      const run = yield* runWriter(encodedJson27);
      const row = expectSingleRow(run);
      const decoded = yield* decodeHookPulseRow(row);
      const oracle = yield* typescriptHarnessHash(root);
      const relativePaths = A.map(oracle.snapshot.files, (file) => file.relativePath);

      expect(decoded.hookEvent).toBe(HookPulseEvent.Enum.SessionStart);
      assertSome(decoded.sessionStartSource, "startup");
      expect(decoded.waitReason).toBe(HookPulseWaitReason.Enum.none);
      assertSome(decoded.harnessHash, oracle.harnessHash);
      expect(row).not.toContain(CANARY);
      // The fixture exercises what it claims to: both nested roots are excluded,
      // the symlinked CLAUDE.md, the binary, and the BOM file are all hashed, and
      // both scopes are populated.
      expect(oracle.snapshot.bounds.excludedNestedRootPaths).toEqual([".claude/worktrees/wt1", "packages/bar"]);
      expect(relativePaths).toEqual([
        ".claude/hooks/pulse.sh",
        ".claude/settings.json",
        ".claude/skills/alpha/SKILL.md",
        ".claude/skills/alpha/logo.png",
        ".codex/config.toml",
        "AGENTS.md",
        "CLAUDE.md",
        "packages/foo/AGENTS.md",
      ]);
      expect(A.dedupe(A.map(oracle.snapshot.files, (file) => file.scope))).toEqual(["baseline", "session"]);
    })
  );

  it.effect("stamps only SessionStart and refuses to stamp what it cannot mirror", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* makeHarnessFixtureRoot();
      const stampOf = Effect.fnUntraced(function* (payload: unknown) {
        const encodedJson28 = yield* encodeJson(payload);
        const run = yield* runWriter(encodedJson28);
        return (yield* decodeHookPulseRow(expectSingleRow(run))).harnessHash;
      });

      // Owned by SessionStart: the same root on any other event carries no stamp.
      const stampOf29 = yield* stampOf({ ...preToolUsePayload, cwd: root });
      assertNone(stampOf29);
      // No repo root above cwd: no fallback root, no stamp, but still a row.
      const stampOf30 = yield* stampOf(sessionStartPayload(baseFields.cwd));
      assertNone(stampOf30);

      // A path outside printable ASCII: JS and C sort orders may disagree, so the
      // shell refuses even though TypeScript can hash it.
      yield* fs.makeDirectory(path.join(root, ".claude", "skills", "caf\u00e9"), { recursive: true });
      yield* fs.writeFileString(path.join(root, ".claude", "skills", "caf\u00e9", "SKILL.md"), "# cafe\n");
      const indexed1 = yield* ChildProcess.make("git", ["add", "--", ".claude/skills/café/SKILL.md"], {
        cwd: root,
        stdout: "ignore",
        stderr: "ignore",
      });
      const exitCode31 = yield* indexed1.exitCode;
      expect(exitCode31).toBe(0);
      yield* typescriptHarnessHash(root);
      const stampOf32 = yield* stampOf(sessionStartPayload(root));
      assertNone(stampOf32);
      yield* fs.remove(path.join(root, ".claude", "skills", "caf\u00e9"), { recursive: true });

      // The file budget: TypeScript truncates at 1000 collected files, so the
      // shell refuses rather than guess which files the truncation kept.
      yield* fs.makeDirectory(path.join(root, ".claude", "bulk"), { recursive: true });
      yield* Effect.forEach(
        A.makeBy(1000, (index) => index),
        (index) => fs.writeFileString(path.join(root, ".claude", "bulk", `f${index}.md`), "x\n"),
        { concurrency: 32, discard: true }
      );
      const indexed2 = yield* ChildProcess.make("git", ["add", "--", ".claude/bulk"], {
        cwd: root,
        stdout: "ignore",
        stderr: "ignore",
      });
      const exitCode33 = yield* indexed2.exitCode;
      expect(exitCode33).toBe(0);
      pipe((yield* typescriptHarnessHash(root)).snapshot.bounds.truncationReason, O.isSome, assertTrue);
      const stampOf34 = yield* stampOf(sessionStartPayload(root));
      assertNone(stampOf34);
    })
  );

  it.effect("rejects skipped malformed Git metadata beneath an ancestor checkout through a newline path alias", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* makeHarnessFixtureRoot();
      const invalidRoot = path.join(root, "broken\n");
      yield* fs.makeDirectory(path.join(invalidRoot, ".git"), { recursive: true });
      yield* fs.writeFileString(path.join(invalidRoot, ".git/HEAD"), "ref: refs/heads/main\n");
      yield* fs.writeFileString(path.join(invalidRoot, "AGENTS.md"), "# nested fixture\n");
      const aliasRoot = yield* fs.makeTempDirectoryScoped();
      const alias = path.join(aliasRoot, "scan");
      yield* fs.symlink(invalidRoot, alias);
      const failure = yield* typescriptHarnessHash(alias).pipe(Effect.flip);
      expect(failure.message).toContain("Git");
      const encodedJson35 = yield* encodeJson(sessionStartPayload(alias));
      const run = yield* runWriter(encodedJson35);
      assertNone((yield* decodeHookPulseRow(expectSingleRow(run))).harnessHash);
    })
  );

  it.effect("preserves a checkout name ending in a carriage return", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* makeHarnessFixtureRoot();
      const parent = yield* fs.makeTempDirectoryScoped();
      const renamed = path.join(parent, "checkout\r");
      yield* fs.rename(root, renamed);
      yield* Effect.gen(function* () {
        const oracle = yield* typescriptHarnessHash(renamed);
        const encodedJson36 = yield* encodeJson(sessionStartPayload(renamed));
        const run = yield* runWriter(encodedJson36);
        assertSome((yield* decodeHookPulseRow(expectSingleRow(run))).harnessHash, oracle.harnessHash);
      }).pipe(Effect.ensuring(fs.rename(renamed, root).pipe(Effect.orDie)));
    })
  );

  it.effect("discovers physical checkout ownership through a symlink in another checkout", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const outer = yield* makeHarnessFixtureRoot();
      const inner = yield* makeHarnessFixtureRoot();
      yield* fs.writeFileString(path.join(inner, ".claude/settings.local.json"), '{"model":"inner-fixture"}');
      const subdirectory = path.join(inner, "nested\n");
      yield* fs.makeDirectory(subdirectory);
      const alias = path.join(outer, "alias");
      yield* fs.symlink(subdirectory, alias);
      const oracle = yield* typescriptHarnessHash(inner);
      const encodedJson37 = yield* encodeJson(sessionStartPayload(alias));
      const run = yield* runWriter(encodedJson37);
      assertSome((yield* decodeHookPulseRow(expectSingleRow(run))).harnessHash, oracle.harnessHash);
    })
  );

  it.effect("withholds the outer stamp when nearer Git metadata has no root guide", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const outer = yield* makeHarnessFixtureRoot();
      const inner = path.join(outer, "nearer");
      yield* fs.makeDirectory(path.join(inner, ".git"), { recursive: true });
      const encodedJson38 = yield* encodeJson(sessionStartPayload(inner));
      const run = yield* runWriter(encodedJson38);
      assertNone((yield* decodeHookPulseRow(expectSingleRow(run))).harnessHash);
    })
  );

  it.effect("rejects an invalid inherited refusal date and partitions valid dates by the attempt", () =>
    Effect.gen(function* () {
      const invalid = yield* runWriter("", { writerArgs: ["--refuse", "timeout"], attemptUtc: "2026-02-30T00:00:00Z" });
      expect(invalid.refusals).toHaveLength(1);
      const row = yield* decodeHookPulseRefusalJson(A.getUnsafe(invalid.refusals, 0));
      expect(DateTime.formatIso(row.ts)).not.toBe("2026-03-02T00:00:00.000Z");
      const valid = yield* runWriter("", { writerArgs: ["--refuse", "timeout"], attemptUtc: "2026-08-01T23:59:59Z" });
      expect(valid.refusalFiles).toEqual(["hook-pulse-refusals-2026-08-01.ndjson"]);
      expect(valid.refusals).toHaveLength(1);
      const validRow = yield* decodeHookPulseRefusalJson(A.getUnsafe(valid.refusals, 0));
      expect(DateTime.formatIso(validRow.ts)).toBe("2026-08-01T23:59:59.000Z");
    })
  );

  it.effect("rejects an empty Git toplevel in both snapshot routes", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
      const root = yield* makeHarnessFixtureRoot();
      const failure = yield* typescriptHarnessHash(root).pipe(
        Effect.provideService(ChildProcessSpawner.ChildProcessSpawner, {
          ...spawner,
          string: () => Effect.succeed("\n"),
        }),
        Effect.flip
      );
      expect(failure.message).toContain("no indexed checkout root");
      const bin = yield* fs.makeTempDirectoryScoped();
      const git = path.join(bin, "git");
      yield* fs.writeFileString(
        git,
        "#!/usr/bin/env bash\ncase \"$*\" in *--is-inside-work-tree*) printf 'true\\n';; *--show-toplevel*) printf '\\n';; esac\n"
      );
      yield* fs.chmod(git, 0o755);
      const executablePath = `${bin}:${yield* Config.String("PATH")}`;
      const encodedJson39 = yield* encodeJson(sessionStartPayload(root));
      const run = yield* runWriter(encodedJson39, { executablePath });
      assertNone((yield* decodeHookPulseRow(expectSingleRow(run))).harnessHash);
    })
  );

  it.effect("carries an operator salt into every private digest", () =>
    Effect.gen(function* () {
      // The oracle above still passes for a writer that never reads the salt
      // at all, because the insecure default is what such a writer would have
      // used anyway. Only a run under an operator salt separates "resolves the
      // salt" from "hardcodes the fallback".
      const encodedJson40 = yield* encodeJson(preToolUsePayload);
      const run = yield* runWriter(encodedJson40, {
        hashSalt: OPERATOR_SALT,
      });
      const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

      const expectation5 = expect(decoded.sessionId);
      const hashPrivateIdentifier6 = yield* hashPrivateIdentifier(session, O.some(OPERATOR_SALT));
      expectation5.toBe(hashPrivateIdentifier6);
      const expectation6 = expect(decoded.cwd);
      const hashPrivateIdentifier7 = yield* hashPrivateIdentifier(baseFields.cwd, O.some(OPERATOR_SALT));
      expectation6.toBe(hashPrivateIdentifier7);
      const argument1 = expect(decoded.sessionId).not;
      const privateDigest8 = yield* privateDigest(session);
      argument1.toBe(privateDigest8);
    })
  );

  it.effect("treats a whitespace-only salt as unset, exactly as resolveAiMetricsHashSaltValue does", () =>
    Effect.gen(function* () {
      // `${VAR:-default}` accepts `"   "` as a value while
      // `resolveAiMetricsHashSaltValue` trims first and falls back. That lone
      // input is where the two halves can disagree with both looking correct,
      // so the shell trims too and this pins it.
      const encodedJson41 = yield* encodeJson(preToolUsePayload);
      const run = yield* runWriter(encodedJson41, {
        hashSalt: "   ",
      });
      const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

      const expectation7 = expect(decoded.sessionId);
      const privateDigest9 = yield* privateDigest(session);
      expectation7.toBe(privateDigest9);
    })
  );

  it.effect("omits notificationType when the raw value is outside the enum", () =>
    Effect.gen(function* () {
      const encodedJson42 = yield* encodeJson(futureNotificationPayload);
      const run = yield* runWriter(encodedJson42);
      const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

      // The spike's jq `capture()` defect dropped exactly this row while still
      // exiting 0. A no-match must omit the optional key, never annihilate the
      // object.
      expect(decoded.hookEvent).toBe(HookPulseEvent.Enum.Notification);
      assertNone(decoded.notificationType);
      expect(decoded.waitReason).toBe(HookPulseWaitReason.Enum.unknown);
    })
  );

  it.effect("keeps notificationType when the raw value is inside the enum", () =>
    Effect.gen(function* () {
      const encodedJson43 = yield* encodeJson(permissionPromptNotificationPayload);
      const run = yield* runWriter(encodedJson43);
      const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

      assertSome(decoded.notificationType, HookPulseNotificationType.Enum.permission_prompt);
    })
  );

  it.effect("carries sessionEndReason only on SessionEnd", () =>
    Effect.gen(function* () {
      const encodedJson44 = yield* encodeJson(sessionEndPayload);
      const ended = yield* runWriter(encodedJson44);
      const encodedJson45 = yield* encodeJson(stopPayload);
      const stopped = yield* runWriter(encodedJson45);
      const encodedJson46 = yield* encodeJson(permissionDeniedPayload);
      const denied = yield* runWriter(encodedJson46);
      const decodedEnd = yield* decodeHookPulseRow(expectSingleRow(ended));
      const decodedStop = yield* decodeHookPulseRow(expectSingleRow(stopped));
      const decodedDenied = yield* decodeHookPulseRow(expectSingleRow(denied));

      assertSome(decodedEnd.sessionEndReason, "prompt_input_exit");
      assertNone(decodedStop.sessionEndReason);
      // `PermissionDenied` carries its own `reason`, and it is content.
      assertNone(decodedDenied.sessionEndReason);
    })
  );

  it.effect("carries durationMs from PostToolUse and pairs tool ids", () =>
    Effect.gen(function* () {
      const encodedJson47 = yield* encodeJson(postToolUsePayload);
      const run = yield* runWriter(encodedJson47);
      const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

      assertSome(decoded.durationMs, 477);
      assertSome(decoded.toolUseId, "toolu_writer_1");
    })
  );

  it.effect("drops a non-finite durationMs rather than writing an undecodable row", () =>
    Effect.gen(function* () {
      // jq carries `1e400` through as `1E+400`, which parses back to
      // `Infinity` and fails `NonNegNum`'s `S.Finite`. Keeping it would put an
      // undecodable line in a shard, which poisons replay for every row that
      // shard holds — strictly worse than dropping one optional field.
      const nonFiniteDurationStdin48 = yield* nonFiniteDurationStdin;
      const run = yield* runWriter(nonFiniteDurationStdin48);
      const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

      assertNone(decoded.durationMs);
      expect(decoded.hookEvent).toBe(HookPulseEvent.Enum.PostToolUse);
    })
  );

  it.effect("invents no toolUseId for PermissionRequest", () =>
    Effect.gen(function* () {
      const encodedJson49 = yield* encodeJson(permissionRequestPlanPayload);
      const run = yield* runWriter(encodedJson49);
      const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

      // The two-hop join in P4 depends on this absence being real.
      assertNone(decoded.toolUseId);
      assertSome(decoded.toolName, "ExitPlanMode");
    })
  );

  it.effect("writes nothing and exits 0 when the kill-switch sentinel exists", () =>
    Effect.gen(function* () {
      const encodedJson50 = yield* encodeJson(permissionRequestPlanPayload);
      const run = yield* runWriter(encodedJson50, {
        disarmSentinel: '{"disarmedAt":"2026-08-05T00:00:00Z","reason":"test","evidenceTier":"unknown"}',
      });

      expectSilentRefusal(run);
      expect(run.refusals).toHaveLength(1);
      const refusal = yield* decodeHookPulseRefusalJson(pipe(A.head(run.refusals), O.getOrThrow));
      expect(refusal.reason).toBe("disabled");
    })
  );

  // cloud-agent-readiness D3: `BEEP_AGENT_HOST=cloud` suppresses only the desktop
  // notifier; the privacy-safe row still lands. The writer resolves the notifier as
  // its own sibling, so each case runs a temp copy of the real writer beside a stub
  // that records each call and touches nothing else: no notification, no network.
  // The non-cloud cases are the controls that prove the stub is reachable, so a
  // silent stub under cloud means the guard held rather than that nothing ran.
  A.forEach(
    [
      { label: "cloud host, desktop notifier", host: "cloud", notifierRev: "desktop-ntfy-1", notified: false },
      { label: "unset host, desktop notifier", host: "", notifierRev: "desktop-ntfy-1", notified: true },
      { label: "a non-cloud host value", host: "workstation", notifierRev: "desktop-ntfy-1", notified: true },
      { label: "cloud host, log-only opt-out", host: "cloud", notifierRev: "log-only-0", notified: false },
      { label: "unset host, log-only opt-out", host: "", notifierRev: "log-only-0", notified: false },
    ],
    ({ label, host, notifierRev, notified }) => {
      it.effect(`writes one row and ${notified ? "runs" : "skips"} the notifier for ${label}`, () =>
        Effect.gen(function* () {
          const stub = yield* makeNotifierStubWriter();
          const encodedJson51 = yield* encodeJson(permissionRequestToolPayload);
          const run = yield* runWriter(encodedJson51, {
            writerPath: stub.writerPath,
            extraEnv: notifierHostEnv(host, notifierRev),
          });

          const decoded = yield* decodeHookPulseRow(expectSingleRow(run));
          expect(decoded.hookEvent).toBe(HookPulseEvent.Enum.PermissionRequest);
          expect(decoded.waitReason).toBe(HookPulseWaitReason.Enum["tool-permission"]);
          expect(decoded.notifierRev).toBe(notifierRev);
          const calls52 = yield* stub.calls;
          expect(calls52).toHaveLength(notified ? 1 : 0);
        })
      );
    }
  );

  A.forEach(
    [
      {
        label: "a disarmed writer",
        stdin: encodeJson(permissionRequestToolPayload),
        disarmed: true,
        reason: "disabled",
      },
      {
        label: "malformed stdin",
        stdin: Effect.succeed("not json at all {{{"),
        disarmed: false,
        reason: "encode-failed",
      },
    ],
    ({ label, stdin, disarmed, reason }) => {
      it.effect(`writes no row and never notifies under the cloud host for ${label}`, () =>
        Effect.gen(function* () {
          const stub = yield* makeNotifierStubWriter();
          const stdin53 = yield* stdin;
          const run = yield* runWriter(stdin53, {
            writerPath: stub.writerPath,
            extraEnv: notifierHostEnv("cloud", "desktop-ntfy-1"),
            ...(disarmed
              ? { disarmSentinel: '{"disarmedAt":"2026-11-01T00:00:00Z","reason":"test","evidenceTier":"unknown"}' }
              : {}),
          });

          expectSilentRefusal(run);
          expect(run.stderr).toBe("");
          // The payload-free refusal row is the only trace either path leaves.
          const refusals = yield* Effect.forEach(run.refusals, (row) => decodeHookPulseRefusalJson(row));
          expect(A.map(refusals, (refusal) => refusal.reason)).toEqual([reason]);
          const calls54 = yield* stub.calls;
          expect(calls54).toHaveLength(0);
        })
      );
    }
  );

  A.forEach(
    [
      { label: "unparseable stdin", stdin: Effect.succeed("not json at all {{{") },
      { label: "empty stdin", stdin: Effect.succeed("") },
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
        Effect.gen(function* () {
          const stdin55 = yield* stdin;
          const run = yield* runWriter(stdin55);

          expectSilentRefusal(run);
        })
      );
    }
  );

  // Amendment 8: a tool call ends in PostToolUse OR PostToolUseFailure, never
  // both, so a bracket that only closes on PostToolUse drops every
  // approved-then-failed wait — a biased loss, since failures are where retry
  // storms live. The closing evidence P4 needs is tool_use_id + durationMs.
  it.effect("carries bracket-closing evidence and isInterrupt on PostToolUseFailure", () =>
    Effect.gen(function* () {
      const encodedJson56 = yield* encodeJson(postToolUseFailurePayload(true));
      const interrupted = yield* runWriter(encodedJson56);
      const encodedJson57 = yield* encodeJson(postToolUseFailurePayload(false));
      const errored = yield* runWriter(encodedJson57);
      const decodedInterrupted = yield* decodeHookPulseRow(expectSingleRow(interrupted));
      const decodedErrored = yield* decodeHookPulseRow(expectSingleRow(errored));

      assertSome(decodedInterrupted.toolUseId, "toolu_writer_1");
      assertSome(decodedInterrupted.durationMs, 12);
      // `false` is a value, not an absence — omitting it would erase the
      // distinction between "the tool errored" and "the human hit escape".
      assertSome(decodedInterrupted.isInterrupt, true);
      assertSome(decodedErrored.isInterrupt, false);
    })
  );

  it.effect("carries isInterrupt only on PostToolUseFailure", () =>
    Effect.gen(function* () {
      // `is_interrupt` on a foreign event is owned by PostToolUseFailure, so
      // emitting it would fail HookPulseEventOwnedFieldInvariant on decode.
      const encodedJson58 = yield* encodeJson({ ...postToolUsePayload, is_interrupt: true });
      const run = yield* runWriter(encodedJson58);
      const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

      expect(decoded.hookEvent).toBe(HookPulseEvent.Enum.PostToolUse);
      assertNone(decoded.isInterrupt);
    })
  );

  it.effect("resolves the ledger path through the XDG fallback rung too", () =>
    Effect.gen(function* () {
      // With BEEP_AGENT_EVIDENCE_ROOT cleared, the writer must land in the
      // same directory `agentEvidenceRoot`/`hookPulseLedgerDir` compute — the
      // runner reads back from exactly that derived path.
      const encodedJson59 = yield* encodeJson(permissionRequestPlanPayload);
      const run = yield* runWriter(encodedJson59, {
        viaXdgFallback: true,
      });
      const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

      expect(decoded.waitReason).toBe(HookPulseWaitReason.Enum["plan-approval"]);
    })
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
      Effect.gen(function* () {
        const encodedJson60 = yield* encodeJson(preToolUsePayload);
        const run = yield* runWriter(encodedJson60, writerOptions);
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
        const expectation8 = expect(codecRow.sessionId);
        const hashPrivateIdentifier10 = yield* hashPrivateIdentifier(session, O.fromUndefinedOr(expectedSalt));
        expectation8.toBe(hashPrivateIdentifier10);
        const expectation9 = expect(codecRow.cwd);
        const hashPrivateIdentifier11 = yield* hashPrivateIdentifier(baseFields.cwd, O.fromUndefinedOr(expectedSalt));
        expectation9.toBe(hashPrivateIdentifier11);
      })
    );
  });

  // The global projection (issue #1865) is the writer's second rung. It must beat
  // the repo-wide ai-metrics variable and lose only to the instrument override,
  // and `hookPulseNamespace` must resolve the same salt from the same file.
  const PROJECTION_SALT = "hook-pulse-writer-projection-salt";
  const writeProjection = Effect.fnUntraced(function* (text: string) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const dir = yield* fs.makeTempDirectoryScoped({ prefix: "hook-pulse-projection-" });
    const file = path.join(dir, "namespace-projection.json");
    yield* fs.writeFileString(file, text);
    return { dir, file };
  });
  const projectionFields = {
    version: 1,
    cutoverUtc: "2026-11-02T04:00:00.000Z",
    hashSalt: PROJECTION_SALT,
    previousRegime: "library-default",
  };
  const projectionDocument = encodeJson(projectionFields);

  it.effect("reproduces the writer's private digests through the projection rung, above the ai-metrics rung", () =>
    Effect.gen(function* () {
      const projectionDocument61 = yield* projectionDocument;
      const { file } = yield* writeProjection(projectionDocument61);
      const encodedJson62 = yield* encodeJson(preToolUsePayload);
      const run = yield* runWriter(encodedJson62, {
        namespaceProjection: file,
        aiMetricsHashSalt: CODEC_PARITY_SALT,
      });
      const writerRow = yield* decodeHookPulseRow(expectSingleRow(run));
      const expectation10 = expect(writerRow.sessionId);
      const hashPrivateIdentifier12 = yield* hashPrivateIdentifier(session, O.some(PROJECTION_SALT));
      expectation10.toBe(hashPrivateIdentifier12);
      const expectation11 = expect(writerRow.cwd);
      const hashPrivateIdentifier13 = yield* hashPrivateIdentifier(baseFields.cwd, O.some(PROJECTION_SALT));
      expectation11.toBe(hashPrivateIdentifier13);
      const namespace = yield* withSaltEnv(
        { BEEP_HOOK_PULSE_NAMESPACE_PROJECTION: file, BEEP_AI_METRICS_HASH_SALT: CODEC_PARITY_SALT },
        hookPulseNamespace
      );
      expect(namespace.source).toBe("projection");
      const hashPrivateIdentifier63 = yield* hashPrivateIdentifier(session, namespace.hashSalt);
      expect(hashPrivateIdentifier63).toBe(writerRow.sessionId);
      // The instrument override still wins over the projection on both halves.
      const encodedJson64 = yield* encodeJson(preToolUsePayload);
      const overridden = yield* runWriter(encodedJson64, {
        namespaceProjection: file,
        hashSalt: CODEC_PARITY_SALT,
      });
      const overriddenRow = yield* decodeHookPulseRow(expectSingleRow(overridden));
      const expectation12 = expect(overriddenRow.sessionId);
      const hashPrivateIdentifier14 = yield* hashPrivateIdentifier(session, O.some(CODEC_PARITY_SALT));
      expectation12.toBe(hashPrivateIdentifier14);
      const overriddenNamespace = yield* withSaltEnv(
        { BEEP_HOOK_PULSE_NAMESPACE_PROJECTION: file, BEEP_HOOK_PULSE_HASH_SALT: CODEC_PARITY_SALT },
        hookPulseNamespace
      );
      expect(overriddenNamespace.source).toBe("hook-pulse-env");
    })
  );

  it.effect("matches accepted projection salts byte for byte, including significant spaces and extra keys", () =>
    Effect.gen(function* () {
      for (const fields of [
        { ...projectionFields, hashSalt: "  significant spaces  " },
        { ...projectionFields, cutoverUtc: "2024-02-29T23:59:59Z" },
        { ...projectionFields, extra: "ignored forward-compatible metadata" },
        { ...projectionFields, hashSalt: AI_METRICS_LOCAL_INSECURE_HASH_SALT },
      ]) {
        const encodedJson65 = yield* encodeJson(fields);
        const { file } = yield* writeProjection(encodedJson65);
        const encodedJson66 = yield* encodeJson(preToolUsePayload);
        const run = yield* runWriter(encodedJson66, { namespaceProjection: file });
        const row = yield* decodeHookPulseRow(expectSingleRow(run));
        const namespace = yield* withSaltEnv({ BEEP_HOOK_PULSE_NAMESPACE_PROJECTION: file }, hookPulseNamespace);
        const expectation13 = expect(row.sessionId);
        const hashPrivateIdentifier15 = yield* hashPrivateIdentifier(session, namespace.hashSalt);
        expectation13.toBe(hashPrivateIdentifier15);
        const expectation14 = expect(row.cwd);
        const hashPrivateIdentifier16 = yield* hashPrivateIdentifier(baseFields.cwd, namespace.hashSalt);
        expectation14.toBe(hashPrivateIdentifier16);
        expect(run.refusals).toHaveLength(0);
      }
    })
  );

  it.effect("refuses environment salts containing controls on both readers and writers", () =>
    Effect.gen(function* () {
      for (const salt of ["salt\n", "salt\r", "salt\t", "salt\u0001", "salt\u007f", "salt\u0085"]) {
        for (const rung of [
          { name: "BEEP_HOOK_PULSE_HASH_SALT", options: { hashSalt: salt } },
          { name: "BEEP_AI_METRICS_HASH_SALT", options: { aiMetricsHashSalt: salt } },
        ]) {
          const encodedJson67 = yield* encodeJson(preToolUsePayload);
          const run = yield* runWriter(encodedJson67, rung.options);
          expect(run.rows).toHaveLength(0);
          expect(run.refusals).toHaveLength(1);
          const error = yield* withSaltEnv({ [rung.name]: salt }, hookPulseNamespace).pipe(Effect.flip);
          expect(error._tag).toBe("HookPulseNamespaceError");
        }
      }
    })
  );

  it.effect("uses the same temporary XDG and HOME default projection paths", () =>
    Effect.gen(function* () {
      for (const cacheOverride of [undefined, ""]) {
        const encodedJson68 = yield* encodeJson(preToolUsePayload);
        const run = yield* runWriter(encodedJson68, {
          defaultProjectionDocument: yield* projectionDocument,
          ...(cacheOverride === undefined ? {} : { extraEnv: { XDG_CACHE_HOME: cacheOverride } }),
        });
        const row = yield* decodeHookPulseRow(expectSingleRow(run));
        const namespace = yield* withSaltEnv(
          {
            HOME: run.stateHome,
            XDG_CACHE_HOME: cacheOverride ?? `${run.stateHome}/.cache`,
            BEEP_HOOK_PULSE_NAMESPACE_PROJECTION: "",
          },
          hookPulseNamespace
        );
        expect(namespace.source).toBe("projection");
        const expectation15 = expect(row.sessionId);
        const hashPrivateIdentifier17 = yield* hashPrivateIdentifier(session, namespace.hashSalt);
        expectation15.toBe(hashPrivateIdentifier17);
      }
    })
  );

  it.effect("rejects the same malformed projection documents before writing any row", () =>
    Effect.gen(function* () {
      const invalidFields = [
        { ...projectionFields, cutoverUtc: undefined },
        { ...projectionFields, cutoverUtc: null },
        { ...projectionFields, cutoverUtc: "not-a-date" },
        { ...projectionFields, cutoverUtc: "2026-11-02T04:00:00.000Z\n" },
        { ...projectionFields, cutoverUtc: "2026-02-29T04:00:00.000Z" },
        { ...projectionFields, cutoverUtc: "2026-04-31T04:00:00.000Z" },
        { ...projectionFields, cutoverUtc: "2026-11-02T24:00:00.000Z" },
        { ...projectionFields, previousRegime: undefined },
        { ...projectionFields, previousRegime: "unsupported" },
        { ...projectionFields, version: "1" },
        { ...projectionFields, version: 2 },
        { ...projectionFields, hashSalt: 123 },
        ...A.map(
          ["", "   ", "salt\u0000", "salt\n", "salt\r", "salt\t", "salt\u0001", "salt\u007f", "salt\u0085"],
          (hashSalt) => ({ ...projectionFields, hashSalt })
        ),
      ];
      const invalidDocuments = yield* Effect.forEach(invalidFields, (fields) => encodeJson(fields));
      const validDocument = yield* projectionDocument;
      for (const text of [...invalidDocuments, `${validDocument}\n${validDocument}`, "null", "[]"]) {
        const { file } = yield* writeProjection(text);
        const encodedJson69 = yield* encodeJson(preToolUsePayload);
        const run = yield* runWriter(encodedJson69, { namespaceProjection: file });
        expect(run.rows).toHaveLength(0);
        expect(run.refusals).toHaveLength(1);
        const refusal = yield* decodeHookPulseRefusalJson(A.getUnsafe(run.refusals, 0));
        expect(refusal.reason).toBe("namespace-projection-invalid");
        const error = yield* withSaltEnv({ BEEP_HOOK_PULSE_NAMESPACE_PROJECTION: file }, hookPulseNamespace).pipe(
          Effect.flip
        );
        expect(error._tag).toBe("HookPulseNamespaceError");
      }
    })
  );

  it.effect(
    "bypasses a malformed projection for a supported instrument override and falls through an absent path",
    () =>
      Effect.gen(function* () {
        const { dir, file } = yield* writeProjection("{broken");
        const cases: ReadonlyArray<WriterOptions> = [
          { namespaceProjection: file, hashSalt: "  explicit override  " },
          { namespaceProjection: `${dir}/absent.json`, aiMetricsHashSalt: CODEC_PARITY_SALT },
          { namespaceProjection: `${dir}/absent.json` },
        ];
        for (const options of cases) {
          const encodedJson70 = yield* encodeJson(preToolUsePayload);
          const run = yield* runWriter(encodedJson70, options);
          const row = yield* decodeHookPulseRow(expectSingleRow(run));
          const namespace = yield* withSaltEnv(
            {
              BEEP_HOOK_PULSE_NAMESPACE_PROJECTION: options.namespaceProjection ?? "",
              BEEP_HOOK_PULSE_HASH_SALT: options.hashSalt ?? "",
              BEEP_AI_METRICS_HASH_SALT: options.aiMetricsHashSalt ?? "",
            },
            hookPulseNamespace
          );
          const expectation16 = expect(row.sessionId);
          const hashPrivateIdentifier18 = yield* hashPrivateIdentifier(session, namespace.hashSalt);
          expectation16.toBe(hashPrivateIdentifier18);
        }
      })
  );

  it.effect("refuses the row with namespace-projection-invalid when the projection cannot be trusted", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const malformed = yield* writeProjection("{not json");
      const encodedJson71 = yield* encodeJson({ version: 1, hashSalt: "   " });
      const blank = yield* writeProjection(encodedJson71);
      const encodedJson72 = yield* encodeJson({ version: 2, hashSalt: PROJECTION_SALT });
      const wrongVersion = yield* writeProjection(encodedJson72);
      const projectionDocument73 = yield* projectionDocument;
      const linked = yield* writeProjection(projectionDocument73);
      const link = path.join(linked.dir, "link.json");
      yield* fs.symlink(linked.file, link);
      const dangling = path.join(linked.dir, "dangling.json");
      yield* fs.symlink(path.join(linked.dir, "missing.json"), dangling);
      for (const projection of [malformed.file, blank.file, wrongVersion.file, link, dangling, linked.dir]) {
        const encodedJson74 = yield* encodeJson(preToolUsePayload);
        const run = yield* runWriter(encodedJson74, {
          namespaceProjection: projection,
          aiMetricsHashSalt: CODEC_PARITY_SALT,
        });
        expect(run.exitCode).toBe(0);
        expect(run.rows).toHaveLength(0);
        expect(run.refusals).toHaveLength(1);
        const refusal = yield* decodeHookPulseRefusalJson(A.getUnsafe(run.refusals, 0));
        expect(refusal.reason).toBe("namespace-projection-invalid");
        const resolved = yield* withSaltEnv(
          { BEEP_HOOK_PULSE_NAMESPACE_PROJECTION: projection, BEEP_AI_METRICS_HASH_SALT: CODEC_PARITY_SALT },
          hookPulseNamespace
        ).pipe(Effect.flip);
        expect(resolved._tag).toBe("HookPulseNamespaceError");
      }
    })
  );
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
      handle.stdout.pipe(Stream.decodeText, Stream.mkString),
      handle.stderr.pipe(Stream.decodeText, Stream.mkString),
      handle.exitCode,
    ],
    { concurrency: "unbounded" }
  );

  return { exitCode, stderr, stdout };
});

const readSentinel = Effect.fnUntraced(function* (store: SwitchStore) {
  const fs = yield* FileSystem.FileSystem;

  return (yield* fs.exists(store.sentinelPath))
    ? yield* Effect.asSome(fs.readFileString(store.sentinelPath))
    : O.none<string>();
});

const readWindowRows = Effect.fnUntraced(function* (store: SwitchStore) {
  const fs = yield* FileSystem.FileSystem;
  const contents = (yield* fs.exists(store.windowsPath)) ? yield* fs.readFileString(store.windowsPath) : "";

  return A.filter(Str.split("\n")(contents), (line) => line.length > 0);
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
const seededSentinelJson = Effect.map(encodeJson(SEEDED_DISARM), (json) => `${json}\n`);

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
it.layer(GitNodeServices, { timeout: "30 seconds" })("hook-pulse kill-switch conformance", (it) => {
  it.effect("keeps the first disarm's window start and reason when disarm runs again", () =>
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
  );

  it.effect("never moves an existing window start forward, across any elapsed time", () =>
    Effect.gen(function* () {
      const store = yield* makeSwitchStore();
      const seededSentinelJson75 = yield* seededSentinelJson;
      yield* seedSentinel(store, seededSentinelJson75);

      const run = yield* runSwitch(store, ["disarm", "a-much-later-reason"]);

      expectSwitchOk(run);
      // Byte-identical to what was seeded: not the reason, not the timestamp,
      // not the trailing newline. The seeded start is far enough in the past
      // that an overwrite is unambiguous rather than clock-resolution noise.
      const readSentinel76 = yield* readSentinel(store);
      const seededSentinelJson88 = yield* seededSentinelJson;
      assertSome(readSentinel76, seededSentinelJson88);
      expect(run.stdout).toContain(SEEDED_DISARM.disarmedAt);
    })
  );

  it.effect("fails loudly when a dangling sentinel prevents disarm", () =>
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
  );

  it.effect("closes the ledger window at the FIRST disarm, not the latest", () =>
    Effect.gen(function* () {
      // This is the assertion that encodes why the overwrite mattered. `arm`
      // copies the sentinel's `disarmedAt` into the append-only window ledger,
      // so a re-disarm that moved it forward recorded a *shorter* gap than
      // actually occurred — silently reclassifying uninstrumented time as
      // covered. Nothing downstream can detect that: the ledger still looks
      // complete, and the window it describes is simply wrong.
      const store = yield* makeSwitchStore();
      const seededSentinelJson77 = yield* seededSentinelJson;
      yield* seedSentinel(store, seededSentinelJson77);
      yield* runSwitch(store, ["disarm", "a-much-later-reason"]);

      const armed = yield* runSwitch(store, ["arm"]);
      const readWindowRows78 = yield* readWindowRows(store);
      const window = yield* decodeDisarmWindow(expectSingleWindow(readWindowRows78));

      expectSwitchOk(armed);
      expect(window.schemaVersion).toBe(HookPulseDisarmWindowSchemaVersion.Enum["hook-pulse-disarm-window/v1"]);
      assertSome(window.disarmedAt, SEEDED_DISARM.disarmedAt);
      assertSome(window.reason, SEEDED_DISARM.reason);
      // Self-labelled `unknown`: no hook rows exist for the window, so anything
      // computed across it is uninstrumented by construction.
      expect(window.evidenceTier).toBe(HookPulseEvidenceTier.Enum.unknown);
      expect(window.rearmedAt).toMatch(isoSecond);
      // ISO-8601 UTC at fixed width sorts lexicographically, so this is a real
      // ordering check: a window that closes before it opens is not a window.
      pipe(window.rearmedAt > SEEDED_DISARM.disarmedAt, assertTrue);
      // The switch is armed again only if the sentinel is actually gone — the
      // writer tests for its existence and nothing else.
      const readSentinel79 = yield* readSentinel(store);
      assertNone(readSentinel79);
    })
  );

  A.forEach(
    [
      { contents: "", label: "an empty `touch`-created sentinel" },
      { contents: "{not json", label: "a sentinel holding invalid JSON" },
    ],
    ({ contents, label }) => {
      it.effect(`records an unknown window start for ${label}`, () =>
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
          const readSentinel80 = yield* readSentinel(store);
          assertSome(readSentinel80, contents);

          const armed = yield* runSwitch(store, ["arm"]);
          const readWindowRows81 = yield* readWindowRows(store);
          const window = yield* decodeDisarmWindow(expectSingleWindow(readWindowRows81));

          expectSwitchOk(armed);
          // `null`, never the rearm instant: a window whose start defaulted to
          // "now" would read as a zero-length gap, which is worse than an
          // admitted unknown because it looks like coverage.
          assertNone(window.disarmedAt);
          assertNone(window.reason);
          expect(window.rearmedAt).toMatch(isoSecond);
          const readSentinel82 = yield* readSentinel(store);
          assertNone(readSentinel82);
        })
      );
    }
  );

  it.effect("appends nothing when arm runs while already armed", () =>
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
      const readWindowRows83 = yield* readWindowRows(store);
      expect(readWindowRows83).toEqual([]);
      const exists84 = yield* fs.exists(store.windowsPath);
      pipe(exists84, assertFalse);
    })
  );

  it.effect("reports the sentinel document on status and stops reporting it once armed", () =>
    Effect.gen(function* () {
      // `status` is how an operator answers "is the instrument recording right
      // now", so it has to read the same sentinel the writer tests for rather
      // than a second opinion about it.
      const store = yield* makeSwitchStore();
      const seededSentinelJson85 = yield* seededSentinelJson;
      yield* seedSentinel(store, seededSentinelJson85);

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
  );

  it.effect("exits 2 with usage on an unknown subcommand", () =>
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
  );
});
