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
import { assertNone, assertSome, assertTrue, deepStrictEqual } from "@effect/vitest/utils";
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
import * as P from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const GitKitOverNodeSpawner = Layer.provideMerge(Git.layer, NodeServices.layer);

const fileURLToPathPercentDecodesSoASpaceOrHashStaysSpawnable = NodeURL.fileURLToPath;
const repoRoot = fileURLToPathPercentDecodesSoASpaceOrHashStaysSpawnable(new URL("../../../../../", import.meta.url));
const decodeHookPulseRefusalJson = S.decodeEffect(S.fromJsonString(HookPulseRefusal));
const writerPath = `${repoRoot}.claude/hooks/hook-pulse.sh`;
const codexWriterPath = `${repoRoot}.codex/hooks/hook-pulse.sh`;
const cursorWriterPath = `${repoRoot}.cursor/hooks/hook-pulse.sh`;
const notifierPath = `${repoRoot}.claude/hooks/sequence-break-notifier.sh`;
const switchPath = `${repoRoot}.claude/hooks/hook-pulse-switch.sh`;

const isHookPulseAgentKind = S.is(HookPulseAgentKind);

// decision: hook-pulse-writer-test-spawns-through-effect-child-process
const stdinOrIgnoredWhenAGuardExitsBeforeReading = (
  stdin: string,
  options: { readonly agentKind?: string | undefined; readonly disarmSentinel?: string | undefined }
) =>
  O.isNone(O.fromUndefinedOr(options.disarmSentinel)) &&
  isHookPulseAgentKind(options.agentKind ?? HookPulseAgentKind.Enum["claude-code"])
    ? ({ stream: Stream.encodeText(Stream.make(stdin)), endOnDone: true } as const)
    : ("ignore" as const);

const CANARY = "CANARY-SECRET-VALUE";

const OPERATOR_SALT = "hook-pulse-writer-operator-salt";

const typeScriptOraclePrivateDigest = (value: string) => hashPrivateIdentifier(value, O.none());

const SALT_SHARED_BY_WRITER_AND_CODEC = "hook-pulse-writer-codec-parity-salt";

const withPinnedSaltProviderNotAmbientEnv = <A, E, R>(env: Record<string, string>, effect: Effect.Effect<A, E, R>) =>
  Effect.provideService(effect, ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }));

const decodeHookPulseFromRaw = S.decodeUnknownEffect(HookPulseV1FromRawEvent);
const decodeHookPulseRow = HookPulseV1.decodeJsonEffect;
const decodeRowKeys = S.decodeUnknownEffect(S.fromJsonString(S.Record(S.String, S.Unknown)));
const decodeRowString = S.decodeUnknownEffect(S.String);
const hookPulseEquivalent = S.toEquivalence(HookPulseV1);
const encodeRawHarnessJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

const handStatedCanonicalRowKeys = [
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
  "agentId",
];

const jqAllowlistOrEmptyWhenExtractionFails = (source: string, definition: string): ReadonlyArray<string> =>
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

const assertAdapterStamp = Effect.fnUntraced(function* (
  run: WriterRun,
  agentKind: HookPulseAgentKind,
  stdout: string,
  harnessHash: string
) {
  const refusals = yield* Effect.forEach(run.refusals, (row) => decodeHookPulseRefusalJson(row), { concurrency: 1 });
  const diagnostics = yield* encodeRawHarnessJson({
    agentKind,
    exitCode: run.exitCode,
    stderr: run.stderr,
    refusalReasons: A.map(refusals, (refusal) => refusal.reason),
  });
  const diagnosticsSurvivingTestConsoleCapture = `${agentKind} stamp diagnostics: ${diagnostics}`;
  expect(run.stdout, diagnosticsSurvivingTestConsoleCapture).toBe(stdout);
  expect(run.rows, diagnosticsSurvivingTestConsoleCapture).toHaveLength(1);
  const decoded = yield* decodeHookPulseRow(pipe(A.head(run.rows), O.getOrThrow));
  expect(O.isSome(decoded.harnessHash), diagnosticsSurvivingTestConsoleCapture).toBe(true);
  assertSome(decoded.harnessHash, harnessHash);
  expect(decoded.agentKind, diagnosticsSurvivingTestConsoleCapture).toBe(agentKind);
});

const readWriterLines = Effect.fnUntraced(function* (directory: string, files: ReadonlyArray<string>) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const forEach1 = yield* Effect.forEach(
    files,
    (entry) =>
      fs
        .readFileString(path.join(directory, entry))
        .pipe(Effect.map((contents) => A.filter(Str.split("\n")(contents), (line) => line.length > 0))),
    { concurrency: 1 }
  );
  return A.flatten(forEach1);
});

const UNSET_FALLS_THROUGH_TO_WRITER_DEFAULT = "";

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
  readonly lastSpreadEnvOverrides?: Readonly<Record<string, string>>;
};

const saltEnvironmentClearedUnlessACaseSetsIt = (stateHome: string, options: WriterOptions) => ({
  BEEP_HOOK_PULSE_HASH_SALT: options.hashSalt ?? UNSET_FALLS_THROUGH_TO_WRITER_DEFAULT,
  BEEP_AI_METRICS_HASH_SALT: options.aiMetricsHashSalt ?? UNSET_FALLS_THROUGH_TO_WRITER_DEFAULT,
  BEEP_HOOK_PULSE_NAMESPACE_PROJECTION: options.namespaceProjection ?? UNSET_FALLS_THROUGH_TO_WRITER_DEFAULT,
  XDG_CACHE_HOME: `${stateHome}/.cache`,
});
const LOG_ONLY_NOTIFIER_REV_PINNED_FOR_LEGACY_FIXTURES = "log-only-0";
const CURSOR_WRITER_CAP_LIFTED_FROM_3S_FOR_LOADED_HOSTS = "60s";
const writerFallbackCwdPinnedOverInheritedPwd = repoRoot;

const writerEnvironment = (stateHome: string, evidenceRoot: string, options: WriterOptions) => ({
  HOME: stateHome,
  XDG_STATE_HOME: stateHome,
  XDG_CONFIG_HOME: `${stateHome}/.config`,
  PWD: writerFallbackCwdPinnedOverInheritedPwd,
  BEEP_AGENT_EVIDENCE_ROOT: options.viaXdgFallback === true ? UNSET_FALLS_THROUGH_TO_WRITER_DEFAULT : evidenceRoot,
  BEEP_HOOK_PULSE_DISARM_SENTINEL: UNSET_FALLS_THROUGH_TO_WRITER_DEFAULT,
  BEEP_HOOK_PULSE_NOTIFIER_REV: LOG_ONLY_NOTIFIER_REV_PINNED_FOR_LEGACY_FIXTURES,
  BEEP_HOOK_PULSE_INSTRUMENT_CLASS: UNSET_FALLS_THROUGH_TO_WRITER_DEFAULT,
  BEEP_HOOK_PULSE_AGENT_KIND: options.agentKind ?? UNSET_FALLS_THROUGH_TO_WRITER_DEFAULT,
  BEEP_CURSOR_HOOK_PULSE_WRITER_CAP: CURSOR_WRITER_CAP_LIFTED_FROM_3S_FOR_LOADED_HOSTS,
  BEEP_HOOK_PULSE_WRITER_CAP: options.writerCap ?? "60s",
  BEEP_HOOK_PULSE_STAMP_CAP: options.stampCap ?? "60s",
  ...saltEnvironmentClearedUnlessACaseSetsIt(stateHome, options),
  BEEP_HOOK_PULSE_ATTEMPT_UTC: options.attemptUtc ?? UNSET_FALLS_THROUGH_TO_WRITER_DEFAULT,
  BEEP_AGENT_HOST: UNSET_FALLS_THROUGH_TO_WRITER_DEFAULT,
  ...(options.executablePath !== undefined ? { PATH: options.executablePath } : {}),
  ...options.lastSpreadEnvOverrides,
});

const runWriter = Effect.fnUntraced(function* (stdin: string, options: WriterOptions = {}) {
  const fs = yield* FileSystem.FileSystem;
  const stateHome = yield* fs.makeTempDirectoryScoped({
    prefix: "beep-hook-pulse-",
  });
  const isolatedEvidenceRoot = agentEvidenceRoot(stateHome);
  const ledgerDirFromExportedPathHelpers = hookPulseLedgerDir(isolatedEvidenceRoot);
  if (options.defaultProjectionDocument !== undefined) {
    const projectionDir = `${stateHome}/.cache/beep/telemetry`;
    yield* fs.makeDirectory(projectionDir, { recursive: true });
    yield* fs.writeFileString(`${projectionDir}/namespace-projection.json`, options.defaultProjectionDocument);
  }

  if (O.isSome(O.fromUndefinedOr(options.disarmSentinel))) {
    yield* fs.makeDirectory(isolatedEvidenceRoot, { recursive: true });
    yield* fs.writeFileString(hookPulseDisarmSentinelPath(isolatedEvidenceRoot), `${options.disarmSentinel}\n`);
  }

  const childStdin = stdinOrIgnoredWhenAGuardExitsBeforeReading(stdin, options);

  // decision: hook-pulse-writer-test-spawns-through-effect-child-process
  const handle = yield* ChildProcess.make(
    options.writerPath ?? writerPath,
    options.writerArgs ?? (options.registeredEvent !== undefined ? ["--event", options.registeredEvent] : []),
    {
      cwd: repoRoot,
      extendEnv: true,
      env: writerEnvironment(stateHome, isolatedEvidenceRoot, options),
      stdin: childStdin,
      stdout: "pipe",
      stderr: "pipe",
    }
  );

  const [stdout, stderr, exitCode] = yield* Effect.all(
    [
      handle.stdout.pipe(Stream.decodeText, Stream.mkString),
      handle.stderr.pipe(Stream.decodeText, Stream.mkString),
      handle.exitCode,
    ],
    { concurrency: "unbounded" }
  );

  const files = yield* fs.readDirectory(ledgerDirFromExportedPathHelpers).pipe(Effect.orElseSucceed(A.empty<string>));
  const rows = yield* readWriterLines(ledgerDirFromExportedPathHelpers, files);
  const refusalFiles = yield* fs
    .readDirectory(isolatedEvidenceRoot)
    .pipe(
      Effect.orElseSucceed(A.empty<string>),
      Effect.map(A.filter((name) => Str.startsWith("hook-pulse-refusals-")(name)))
    );
  const refusals = yield* readWriterLines(isolatedEvidenceRoot, refusalFiles);
  return { exitCode, files, stderr, stdout, rows, refusals, refusalFiles, stateHome };
});

const session = "ccd-session-writer";
const baseFields = {
  cwd: "/worktrees/beep-effect2",
  prompt_id: "prompt-writer-1",
  session_id: session,
  transcript_path: "/tmp/claude/session-writer.jsonl",
};

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

const unmeasuredToollessPermissionRequestPayload = {
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

const permissionDeniedClosingDeniedWaitPayload = {
  ...baseFields,
  hook_event_name: HookPulseEvent.Enum.PermissionDenied,
  permission_mode: "default",
  permission_suggestions: [{ rule: CANARY }],
  reason: CANARY,
  tool_input: { command: CANARY },
  tool_name: "Bash",
  tool_use_id: "toolu_writer_1",
};

const nonFiniteDurationSplicedIntoRawStdinText = Effect.map(
  encodeRawHarnessJson(R.remove(postToolUsePayload, "duration_ms")),
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
    payload: unmeasuredToollessPermissionRequestPayload,
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
    payload: permissionDeniedClosingDeniedWaitPayload,
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
  expect(
    run.stdout,
    "PermissionRequest reads hook stdout as its decision, so any output risks auto-approving the tool call"
  ).toBe("");
  expect(run.rows).toHaveLength(1);
  const [row] = run.rows;
  expect(row).toBeDefined();
  return `${row}`;
};

const expectSilentRefusal = (run: WriterRun): void => {
  expect(run.exitCode).toBe(0);
  expect(run.stdout, "a no-row path must keep the decision hook's stdout silent too").toBe("");
  expect(run.rows).toEqual([]);
};

const notifierHostEnvWithSynchronousStubCalls = (host: string, notifierRev: string) => ({
  BEEP_AGENT_HOST: host,
  BEEP_HOOK_PULSE_NOTIFIER_REV: notifierRev,
  BEEP_SEQUENCE_BREAK_FOREGROUND: "1",
});

const makeWriterCopyBesideCallLoggingNotifierStub = Effect.fnUntraced(function* () {
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
  const callsOrEmptyWhenLogAbsent = Effect.gen(function* () {
    return (yield* fs.exists(callLog)) ? yield* readWriterLines(directory, ["notifier-calls.log"]) : A.empty<string>();
  });
  return { calls: callsOrEmptyWhenLogAbsent, writerPath: stubWriterPath };
});

const makeHarnessFixtureRootHittingEveryMirroredWalkRule = Effect.fnUntraced(function* () {
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

const typescriptOracleHarnessHash = Effect.fnUntraced(function* (root: string) {
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

it.layer(GitKitOverNodeSpawner, { timeout: "30 seconds" })("hook-pulse writer conformance", (it) => {
  it.effect("tags Codex hook rows as codex-cli", () =>
    Effect.gen(function* () {
      const encodedJson = yield* encodeRawHarnessJson(preToolUsePayload);
      const run = yield* runWriter(encodedJson, { writerPath: codexWriterPath });
      const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

      expect(decoded.agentKind).toBe(HookPulseAgentKind.Enum["codex-cli"]);
    })
  );

  it.effect(
    "tags Cursor hook rows as cursor-cli and prints a permission decision, since Cursor blocks the tool on an empty stdout",
    () =>
      Effect.gen(function* () {
        const cursorSnakeCasePayloadWithCamelCaseEvent = {
          ...preToolUsePayload,
          conversation_id: "cursor-conversation-writer-1",
          cursor_version: "2026.09.10",
          generation_id: "cursor-generation-writer-1",
          hook_event_name: "preToolUse",
          model: "composer-2.5",
          workspace_roots: [baseFields.cwd],
        };
        const encodedJson3 = yield* encodeRawHarnessJson(cursorSnakeCasePayloadWithCamelCaseEvent);
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

  const claudeRootTranscript = "/home/dev/.claude/projects/repo/12345678-1234-1234-1234-123456789abc.jsonl";
  const codexRolloutTranscript =
    "/home/dev/.codex/sessions/2026/11/06/rollout-2026-11-06T12-00-00-12345678-1234-1234-1234-123456789abc.jsonl";
  const roleCases: ReadonlyArray<{
    readonly label: string;
    readonly agentKind: HookPulseAgentKind;
    readonly writer: string;
    readonly payload: Record<string, unknown>;
    readonly role: O.Option<string>;
  }> = [
    {
      label: "a Claude subagent hook on the root transcript",
      agentKind: "claude-code",
      writer: writerPath,
      payload: { ...preToolUsePayload, transcript_path: claudeRootTranscript, agent_id: "agent-writer-1" },
      role: O.some("subagent"),
    },
    {
      label: "a Claude root hook",
      agentKind: "claude-code",
      writer: writerPath,
      payload: { ...preToolUsePayload, transcript_path: claudeRootTranscript },
      role: O.some("primary"),
    },
    {
      label: "a Codex root rollout",
      agentKind: "codex-cli",
      writer: codexWriterPath,
      payload: { ...preToolUsePayload, transcript_path: codexRolloutTranscript },
      role: O.some("primary"),
    },
    {
      label: "a Codex subagent hook",
      agentKind: "codex-cli",
      writer: codexWriterPath,
      payload: { ...preToolUsePayload, transcript_path: codexRolloutTranscript, agent_id: "thread-writer-2" },
      role: O.some("subagent"),
    },
    {
      label: "a Cursor hook without an ancestry signal",
      agentKind: "cursor-cli",
      writer: cursorWriterPath,
      payload: { ...preToolUsePayload, hook_event_name: "preToolUse" },
      role: O.some("unknown"),
    },
  ];
  A.forEach(roleCases, ({ label, agentKind, writer, payload, role }) => {
    it.effect(
      `derives the same session role in the writer's jq table and the codec's deriveSessionRole for ${label}`,
      () =>
        Effect.gen(function* () {
          const stdin = yield* encodeRawHarnessJson(payload);
          const run = yield* runWriter(stdin, { writerPath: writer });
          expect(run.rows, "read the row directly: Cursor answers its permission protocol on stdout").toHaveLength(1);
          const line = pipe(A.head(run.rows), O.getOrThrow);
          const writerRow = yield* decodeHookPulseRow(line);
          const codecRow = yield* withPinnedSaltProviderNotAmbientEnv(
            {},
            decodeHookPulseFromRaw({
              event: { ...payload, hook_event_name: HookPulseEvent.Enum.PreToolUse },
              notifierRev: "log-only-0",
              instrumentClass: HookPulseInstrumentClass.Enum.production,
              agentKind,
              evidenceTier: HookPulseEvidenceTier.Enum.derived,
              ts: "2026-08-01T06:40:07.000Z",
            })
          );

          expect(writerRow.sessionRole).toEqual(role);
          expect(codecRow.sessionRole).toEqual(writerRow.sessionRole);
          expect(codecRow.agentId).toEqual(writerRow.agentId);
          const raw = O.filter(O.fromNullishOr(payload.agent_id), P.isString);
          const expectedAgentId = yield* Effect.transposeOption(O.map(raw, typeScriptOraclePrivateDigest));
          expect(writerRow.agentId).toEqual(expectedAgentId);
          A.forEach(A.getSomes([raw]), (agentId) =>
            expect(line, "only the salted digest of the private raw agent id is written").not.toContain(agentId)
          );
        })
    );
  });

  it.effect("drops a Cursor event delivered through the Claude hook entry without a claude-code refusal", () =>
    Effect.gen(function* () {
      const cursorStdin = yield* encodeRawHarnessJson({
        ...preToolUsePayload,
        conversation_id: "cursor-conversation-writer-2",
        cursor_version: "2026.11.05",
        hook_event_name: "sessionStart",
      });
      const run = yield* runWriter(cursorStdin);
      expect(run.exitCode).toBe(0);
      expect(
        run.rows,
        "Cursor's Claude-compatibility loader replays each event through the Claude entry; the Cursor adapter owns it"
      ).toHaveLength(0);
      expect(run.refusals).toHaveLength(0);
      const claudeStdin = yield* encodeRawHarnessJson({
        ...preToolUsePayload,
        tool_input: { command: '"cursor_version"' },
      });
      const claude = yield* runWriter(claudeStdin);
      expect(
        claude.rows,
        "a Claude payload that only mentions cursor_version inside content is still recorded"
      ).toHaveLength(1);
    })
  );

  it.effect("writes nothing for an agent kind outside HookPulseAgentKind", () =>
    Effect.gen(function* () {
      const encodedJson4 = yield* encodeRawHarnessJson(preToolUsePayload);
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
      const fs = yield* FileSystem.FileSystem;
      const source = yield* fs.readFileString(writerPath);
      const arm = O.fromNullishOr(/case "\$\{agent_kind\}" in\s*\n\s*([^)\n]+)\)\s*;;/.exec(source)?.[1]);
      const admitted = O.match(arm, {
        onNone: () => A.empty<string>(),
        onSome: (body) => A.map(Str.split("|")(body), (kind) => Str.trim(kind)),
      });

      const guardAdmitsExactlySchemaKinds =
        "the writer copies BEEP_HOOK_PULSE_AGENT_KIND into every row, so its case guard must admit exactly the schema kinds";
      expect(A.difference(admitted, HookPulseAgentKind.literals), guardAdmitsExactlySchemaKinds).toEqual([]);
      expect(A.difference(HookPulseAgentKind.literals, admitted), guardAdmitsExactlySchemaKinds).toEqual([]);
    })
  );

  it.effect("keeps the sequence-break notifier agent-kind allowlist and title map in lockstep", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const source = yield* fs.readFileString(notifierPath);
      const arm = O.fromNullishOr(/case "\$\{agent_kind\}" in\s*\n\s*([^)\n]+)\)\s*;;/.exec(source)?.[1]);
      const admitted = O.match(arm, {
        onNone: () => A.empty<string>(),
        onSome: (body) => A.map(Str.split("|")(body), (kind) => Str.trim(kind)),
      });
      const agentKindTitleArmNotTheTargetTitleArm = O.fromNullishOr(
        /case "\$\{agent_kind\}" in((?:\s*[a-z-]+\) title="[^"]+" ;;)+)\s*esac/.exec(source)?.[1]
      );
      const titled = O.match(agentKindTitleArmNotTheTargetTitleArm, {
        onNone: () => A.empty<string>(),
        onSome: (body) =>
          A.getSomes(
            A.map(A.fromIterable(Str.matchAll(/([a-z-]+)\) title=/g)(body)), (match) => O.fromNullishOr(match[1]))
          ),
      });
      const schemaKinds = HookPulseAgentKind.literals;

      expect(
        A.difference(admitted, schemaKinds),
        "the notifier admission arm hand-duplicates HookPulseAgentKind"
      ).toEqual([]);
      expect(A.difference(schemaKinds, admitted), "a kind missing from the admission arm is silently dropped").toEqual(
        []
      );
      expect(A.difference(titled, schemaKinds), "the notifier title map hand-duplicates HookPulseAgentKind").toEqual(
        []
      );
      expect(
        A.difference(schemaKinds, titled),
        "a kind missing from the title map is admitted with an empty title"
      ).toEqual([]);
    })
  );

  A.forEach(measuredPayloads, ({ label, payload, permissionMode, waitReason }) => {
    it.effect(`emits one HookPulseV1 row for the measured 2.1.220 ${label} payload`, () =>
      Effect.gen(function* () {
        const encodedJson5 = yield* encodeRawHarnessJson(payload);
        const run = yield* runWriter(encodedJson5);
        const row = expectSingleRow(run);
        const decoded = yield* decodeHookPulseRow(row);

        expect(S.is(HookPulseV1)(decoded)).toBe(true);
        expect(decoded.schemaVersion).toBe(HookPulseSchemaVersion.Enum["hook-pulse/v1"]);
        expect(decoded.agentKind).toBe(HookPulseAgentKind.Enum["claude-code"]);
        expect(decoded.instrumentClass).toBe(HookPulseInstrumentClass.Enum.production);
        const pseudonymizedNotRaw =
          "sessionId, cwd and transcriptPath are Sha256Hex oracle digests, never the raw value";
        const expectation1 = expect(decoded.sessionId, pseudonymizedNotRaw);
        const privateDigest1 = yield* typeScriptOraclePrivateDigest(session);
        expectation1.toBe(privateDigest1);
        const expectation2 = expect(decoded.cwd, pseudonymizedNotRaw);
        const privateDigest2 = yield* typeScriptOraclePrivateDigest(baseFields.cwd);
        expectation2.toBe(privateDigest2);
        expect(decoded.notifierRev).toBe("log-only-0");
        expect(decoded.waitReason).toBe(waitReason);
        const transcriptDigest = yield* typeScriptOraclePrivateDigest(baseFields.transcript_path);
        deepStrictEqual(
          decoded.transcriptPath,
          O.some(transcriptDigest),
          "transcriptPath is forwarded since a row without it cannot be re-encoded for replay"
        );
        assertSome(decoded.promptId, baseFields.prompt_id);
        expect(
          decoded.permissionMode,
          "permissionMode is stated per payload: the harness omits it on Notification and SessionEnd"
        ).toEqual(permissionMode);
        expect(
          decoded.evidenceTier,
          "waitReason is derived and clampDerivedEvidenceTier maps observed to derived, so the writer stamps derived"
        ).toBe(HookPulseEvidenceTier.Enum.derived);
      })
    );

    it.effect(`writes no measured content, raw or hashed, for ${label}`, () =>
      Effect.gen(function* () {
        const encodedJson7 = yield* encodeRawHarnessJson(payload);
        const run = yield* runWriter(encodedJson7);
        const row = expectSingleRow(run);

        expect(row).not.toContain(CANARY);
        const argument = expect(row, "a digest of a content field is still content-derived").not;
        const privateDigest3 = yield* typeScriptOraclePrivateDigest(CANARY);
        argument.toContain(privateDigest3);
        const decodedRowKeys = yield* decodeRowKeys(row);
        expect(A.difference(R.keys(decodedRowKeys), handStatedCanonicalRowKeys)).toEqual([]);
      })
    );
  });

  it("declares exactly the canonical HookPulseV1 encoded surface, so the hand-stated allowlist cannot license a leak", () => {
    const schemaKeys = R.keys(HookPulseV1.fields);

    expect(A.difference(handStatedCanonicalRowKeys, schemaKeys)).toEqual([]);
    expect(A.difference(schemaKeys, handStatedCanonicalRowKeys)).toEqual([]);
  });

  it.effect.prop(
    "keeps every schema-inhabitable canonical row inside the declared ledger surface",
    [HookPulseV1Arbitrary],
    Effect.fnUntraced(function* ([value]) {
      const line = yield* HookPulseV1.encodeJsonEffect(value);

      const keys = yield* decodeRowKeys(line);

      const decoded = yield* HookPulseV1.decodeJsonEffect(line);

      expect(A.difference(R.keys(keys), handStatedCanonicalRowKeys)).toEqual([]);

      pipe(hookPulseEquivalent(decoded, value), assertTrue);
    }),
    { arbitrary: fcRuns(50) }
  );

  it.effect("keeps the hand-duplicated jq allowlists set-equal to the schema literal domains", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const source = yield* fs.readFileString(writerPath);
      const events = jqAllowlistOrEmptyWhenExtractionFails(source, "hook_events");
      const notificationTypes = jqAllowlistOrEmptyWhenExtractionFails(source, "notification_types");

      const jqOnlyFailsDecode = "a name only in jq reaches the ledger and then fails to decode";
      const schemaOnlyIsDropped = "a name only in the schema is silently dropped wholesale by the writer";
      expect(A.difference(events, HookPulseEvent.literals), jqOnlyFailsDecode).toEqual([]);
      expect(A.difference(HookPulseEvent.literals, events), schemaOnlyIsDropped).toEqual([]);
      expect(A.difference(notificationTypes, HookPulseNotificationType.literals), jqOnlyFailsDecode).toEqual([]);
      expect(A.difference(HookPulseNotificationType.literals, notificationTypes), schemaOnlyIsDropped).toEqual([]);
    })
  );

  it.effect("shards the ledger by UTC day and hashed session id", () =>
    Effect.gen(function* () {
      const encodedJson8 = yield* encodeRawHarnessJson(preToolUsePayload);
      const run = yield* runWriter(encodedJson8);
      const row = expectSingleRow(run);
      const keys = yield* decodeRowKeys(row);
      const ts = yield* decodeRowString(keys.ts);
      const sessionDigest = yield* typeScriptOraclePrivateDigest(session);

      expect(
        run.files,
        "per-session shards keep sessions from interleaving, and the exact digest keeps raw session ids out of file names"
      ).toEqual([`hook-pulse-${Str.slice(0, 10)(ts)}-${sessionDigest}.ndjson`]);
    })
  );

  it.effect(
    "hashes private identifiers to the TypeScript oracle digests, so a shell preimage that loses the salt-value NUL fails",
    () =>
      Effect.gen(function* () {
        const encodedJson9 = yield* encodeRawHarnessJson(preToolUsePayload);
        const run = yield* runWriter(encodedJson9);
        const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

        const expectation3 = expect(decoded.sessionId);
        const privateDigest4 = yield* typeScriptOraclePrivateDigest(session);
        expectation3.toBe(privateDigest4);
        const expectation4 = expect(decoded.cwd);
        const privateDigest5 = yield* typeScriptOraclePrivateDigest(baseFields.cwd);
        expectation4.toBe(privateDigest5);
        const privateDigest10 = yield* typeScriptOraclePrivateDigest(baseFields.transcript_path);
        assertSome(decoded.transcriptPath, privateDigest10);
      })
  );

  it.effect("hashes context surfaces to the digests the TypeScript codec derives", () =>
    Effect.gen(function* () {
      const surfacePayloadAtCwdAbsentOnDisk = (toolName: string, toolInput: unknown) => ({
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
        {
          payload: surfacePayloadAtCwdAbsentOnDisk("Skill", { skill: `/${CANARY}` }),
          key: O.some(`skill:${CANARY}`),
        },
        {
          payload: surfacePayloadAtCwdAbsentOnDisk("mcp__notion__search", { query: CANARY }),
          key: O.some("mcp-server:notion"),
        },
        {
          payload: surfacePayloadAtCwdAbsentOnDisk("Read", {
            file_path: `${baseFields.cwd}/.claude/hooks/${CANARY}.sh`,
          }),
          key: O.some(`hook:${CANARY}.sh`),
        },
        ...A.map([".agents", ".codex", ".cursor"], (root) => ({
          payload: surfacePayloadAtCwdAbsentOnDisk("Read", {
            file_path: `${baseFields.cwd}/${root}/skills/${CANARY}/SKILL.md`,
          }),
          key: O.some(`skill:${CANARY}`),
        })),
        {
          payload: surfacePayloadAtCwdAbsentOnDisk("Read", { file_path: "packages/foo/src/x.ts" }),
          key: O.none<string>(),
        },
        {
          payload: surfacePayloadAtCwdAbsentOnDisk("mcp__notion__search", { path: ["a", "b"] }),
          key: O.some("mcp-server:notion"),
        },
        {
          payload: surfacePayloadAtCwdAbsentOnDisk("mcp__notion__search", { path: { nested: true } }),
          key: O.some("mcp-server:notion"),
        },
        { payload: surfacePayloadAtCwdAbsentOnDisk("mcp__notion__search", 7), key: O.some("mcp-server:notion") },
        { payload: surfacePayloadAtCwdAbsentOnDisk("Read", null), key: O.none<string>() },
        { payload: surfacePayloadAtCwdAbsentOnDisk("Read", ["path"]), key: O.none<string>() },
        {
          payload: surfacePayloadAtCwdAbsentOnDisk("Read", {
            file_path: `${baseFields.cwd}/.claude/hooks/${CANARY}.sh`,
            path: ["a"],
          }),
          key: O.some(`hook:${CANARY}.sh`),
        },
        ...A.map([".", "repo", "repo/subdir"], (cwd) => ({
          payload: { ...surfacePayloadAtCwdAbsentOnDisk("Read", { file_path: ".claude/hooks/pulse.sh" }), cwd },
          key: O.none<string>(),
        })),
      ];

      yield* Effect.forEach(
        cases,
        Effect.fnUntraced(function* ({ payload, key }) {
          const encodedJson11 = yield* encodeRawHarnessJson(payload);
          const run = yield* runWriter(encodedJson11);
          const row = expectSingleRow(run);
          const writerRow = yield* decodeHookPulseRow(row);
          const codecRow = yield* withPinnedSaltProviderNotAmbientEnv(
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

          expect(writerRow.surface, "the shell surface_program must match the pinned key's digest").toEqual(expected);
          expect(codecRow.surface, "hookPulseContextSurfaceKey must match the pinned key's digest").toEqual(expected);
          expect(row, "the raw skill or hook name never reaches the row").not.toContain(CANARY);
        }),
        { concurrency: 1, discard: true }
      );
    })
  );

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
        const root = yield* makeHarnessFixtureRootHittingEveryMirroredWalkRule();
        const oracle = yield* typescriptOracleHarnessHash(root);
        const encodedJson12 = yield* encodeRawHarnessJson({
          ...sessionStartPayload(root),
          hook_event_name: adapter.hookEvent,
        });
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
        const root = yield* makeHarnessFixtureRootHittingEveryMirroredWalkRule();
        const oracle = yield* typescriptOracleHarnessHash(root);
        const bin = yield* fs.makeTempDirectoryScoped();
        const fakeDateJumping1000To4000Ms = path.join(bin, "date");
        yield* fs.writeFileString(
          fakeDateJumping1000To4000Ms,
          `#!/usr/bin/env bash
if [ "$*" = '+%s%3N' ]; then
  if [ -e "${fakeDateJumping1000To4000Ms}.started" ]; then
    printf '4000\\n'
  else
    touch "${fakeDateJumping1000To4000Ms}.started"
    printf '1000\\n'
  fi
else
  command -p date "$@"
fi
`
        );
        yield* fs.chmod(fakeDateJumping1000To4000Ms, 0o755);
        const executablePath = `${bin}:${yield* Config.String("PATH")}`;
        for (const stampCap of ["60s", ""]) {
          yield* fs.remove(`${fakeDateJumping1000To4000Ms}.started`, { force: true });
          const encodedJson13 = yield* encodeRawHarnessJson({
            ...sessionStartPayload(root),
            hook_event_name: adapter.hookEvent,
          });
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
        const root = yield* makeHarnessFixtureRootHittingEveryMirroredWalkRule();
        const oracle = yield* typescriptOracleHarnessHash(root);
        yield* fs.symlink("loop.md", path.join(root, ".claude/loop.md"));
        const indexLoopLink = yield* ChildProcess.make("git", ["add", ".claude/loop.md"], { cwd: root });
        const exitCode14 = yield* indexLoopLink.exitCode;
        expect(exitCode14).toBe(0);
        const encodedJson15 = yield* encodeRawHarnessJson({
          ...sessionStartPayload(root),
          hook_event_name: adapter.hookEvent,
        });
        const run = yield* runWriter(encodedJson15, {
          writerPath: adapter.writerPath,
          ...(adapter.registeredEvent === undefined ? {} : { registeredEvent: adapter.registeredEvent }),
        });
        expect(run.rows).toHaveLength(1);
        deepStrictEqual(
          (yield* decodeHookPulseRow(pipe(A.head(run.rows), O.getOrThrow))).harnessHash,
          O.none(),
          "an indexed symlink loop refuses the stamp, even when the writer runs as root"
        );
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
      const encodedJson86 = yield* encodeRawHarnessJson(sessionStartPayload(root));
      const resultWriter = yield* runWriter(encodedJson86);
      const decoded = yield* decodeHookPulseRow(expectSingleRow(resultWriter));
      const oracle = yield* typescriptOracleHarnessHash(root);
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
      const root = yield* makeHarnessFixtureRootHittingEveryMirroredWalkRule();
      const blocked = path.join(root, ".claude/zz-blocked");
      yield* fs.makeDirectory(blocked);
      yield* fs.writeFileString(path.join(blocked, "config.json"), "{}\n");
      const add = yield* ChildProcess.make("git", ["add", ".claude/zz-blocked"], { cwd: root });
      const exitCode18 = yield* add.exitCode;
      expect(exitCode18).toBe(0);
      yield* fs.chmod(blocked, 0o000);
      const encodedJson19 = yield* encodeRawHarnessJson(sessionStartPayload(root));
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
      const root = yield* makeHarnessFixtureRootHittingEveryMirroredWalkRule();
      yield* fs.symlink("missing.md", path.join(root, ".claude/dangling.md"));
      const addDangling = yield* ChildProcess.make("git", ["add", ".claude/dangling.md"], { cwd: root });
      const exitCode20 = yield* addDangling.exitCode;
      expect(exitCode20).toBe(0);
      const encodedJson21 = yield* encodeRawHarnessJson(sessionStartPayload(root));
      const dangling = yield* runWriter(encodedJson21);
      assertSome(
        (yield* decodeHookPulseRow(expectSingleRow(dangling))).harnessHash,
        (yield* typescriptOracleHarnessHash(root)).harnessHash
      );
      yield* fs.symlink("loop.md", path.join(root, ".claude/loop.md"));
      const addLoop = yield* ChildProcess.make("git", ["add", ".claude/loop.md"], { cwd: root });
      const exitCode22 = yield* addLoop.exitCode;
      expect(exitCode22).toBe(0);
      const encodedJson23 = yield* encodeRawHarnessJson(sessionStartPayload(root));
      const loop = yield* runWriter(encodedJson23);
      assertNone((yield* decodeHookPulseRow(expectSingleRow(loop))).harnessHash);
      expect(
        Result.getOrThrow(HookPulseRefusal.decodeJsonResult(pipe(A.head(loop.refusals), O.getOrThrow))).reason
      ).toBe("stamp-failed");
    })
  );

  it.effect("records a timeout refusal before the harness deadline", () =>
    Effect.gen(function* () {
      const encodedJson24 = yield* encodeRawHarnessJson(preToolUsePayload);
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
      const encodedJson25 = yield* encodeRawHarnessJson(sessionStartPayload(repoRoot));
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
      const encodedJson87 = yield* encodeRawHarnessJson(payload);
      const resultWriter26 = yield* runWriter(encodedJson87);
      const decoded = yield* decodeHookPulseRow(expectSingleRow(resultWriter26));
      expect(decoded.hookEvent).toBe("PreToolUse");
      assertNone(decoded.sessionStartSource);
    })
  );

  it.effect("stamps SessionStart with the harness hash the TypeScript snapshot derives", () =>
    Effect.gen(function* () {
      const root = yield* makeHarnessFixtureRootHittingEveryMirroredWalkRule();
      const path = yield* Path.Path;
      const cwdBelowRootWalkedUpToNearestAgentsMdAndGit = path.join(root, "packages", "foo");
      const encodedJson27 = yield* encodeRawHarnessJson(
        sessionStartPayload(cwdBelowRootWalkedUpToNearestAgentsMdAndGit)
      );
      const run = yield* runWriter(encodedJson27);
      const row = expectSingleRow(run);
      const decoded = yield* decodeHookPulseRow(row);
      const oracle = yield* typescriptOracleHarnessHash(root);
      const relativePaths = A.map(oracle.snapshot.files, (file) => file.relativePath);

      expect(decoded.hookEvent).toBe(HookPulseEvent.Enum.SessionStart);
      assertSome(decoded.sessionStartSource, "startup");
      expect(decoded.waitReason).toBe(HookPulseWaitReason.Enum.none);
      assertSome(decoded.harnessHash, oracle.harnessHash);
      expect(row).not.toContain(CANARY);
      expect(oracle.snapshot.bounds.excludedNestedRootPaths, "the fixture excludes both nested roots").toEqual([
        ".claude/worktrees/wt1",
        "packages/bar",
      ]);
      expect(relativePaths, "the fixture hashes the symlinked CLAUDE.md, the binary and the BOM file").toEqual([
        ".claude/hooks/pulse.sh",
        ".claude/settings.json",
        ".claude/skills/alpha/SKILL.md",
        ".claude/skills/alpha/logo.png",
        ".codex/config.toml",
        "AGENTS.md",
        "CLAUDE.md",
        "packages/foo/AGENTS.md",
      ]);
      expect(A.dedupe(A.map(oracle.snapshot.files, (file) => file.scope)), "the fixture populates both scopes").toEqual(
        ["baseline", "session"]
      );
    })
  );

  it.effect("stamps only SessionStart and refuses to stamp what it cannot mirror", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* makeHarnessFixtureRootHittingEveryMirroredWalkRule();
      const stampOf = Effect.fnUntraced(function* (payload: unknown) {
        const encodedJson28 = yield* encodeRawHarnessJson(payload);
        const run = yield* runWriter(encodedJson28);
        return (yield* decodeHookPulseRow(expectSingleRow(run))).harnessHash;
      });

      const nonSessionStartEventStamp = yield* stampOf({ ...preToolUsePayload, cwd: root });
      assertNone(nonSessionStartEventStamp);
      const stampWithNoRepoRootAboveCwdButStillARow = yield* stampOf(sessionStartPayload(baseFields.cwd));
      assertNone(stampWithNoRepoRootAboveCwdButStillARow);

      yield* fs.makeDirectory(path.join(root, ".claude", "skills", "caf\u00e9"), { recursive: true });
      yield* fs.writeFileString(path.join(root, ".claude", "skills", "caf\u00e9", "SKILL.md"), "# cafe\n");
      const indexed1 = yield* ChildProcess.make("git", ["add", "--", ".claude/skills/café/SKILL.md"], {
        cwd: root,
        stdout: "ignore",
        stderr: "ignore",
      });
      const exitCode31 = yield* indexed1.exitCode;
      expect(exitCode31).toBe(0);
      yield* typescriptOracleHarnessHash(root);
      const nonAsciiStamp = yield* stampOf(sessionStartPayload(root));
      deepStrictEqual(
        nonAsciiStamp,
        O.none(),
        "a non-ASCII path stamp is refused since JS and C sort orders may disagree"
      );
      yield* fs.remove(path.join(root, ".claude", "skills", "caf\u00e9"), { recursive: true });

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
      pipe((yield* typescriptOracleHarnessHash(root)).snapshot.bounds.truncationReason, O.isSome, assertTrue);
      const truncatedStamp = yield* stampOf(sessionStartPayload(root));
      deepStrictEqual(
        truncatedStamp,
        O.none(),
        "the stamp is refused rather than guessing the TypeScript 1000-file truncation"
      );
    })
  );

  it.effect("rejects skipped malformed Git metadata beneath an ancestor checkout through a newline path alias", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* makeHarnessFixtureRootHittingEveryMirroredWalkRule();
      const invalidRoot = path.join(root, "broken\n");
      yield* fs.makeDirectory(path.join(invalidRoot, ".git"), { recursive: true });
      yield* fs.writeFileString(path.join(invalidRoot, ".git/HEAD"), "ref: refs/heads/main\n");
      yield* fs.writeFileString(path.join(invalidRoot, "AGENTS.md"), "# nested fixture\n");
      const aliasRoot = yield* fs.makeTempDirectoryScoped();
      const alias = path.join(aliasRoot, "scan");
      yield* fs.symlink(invalidRoot, alias);
      const failure = yield* typescriptOracleHarnessHash(alias).pipe(Effect.flip);
      expect(failure.message).toContain("Git");
      const encodedJson35 = yield* encodeRawHarnessJson(sessionStartPayload(alias));
      const run = yield* runWriter(encodedJson35);
      assertNone((yield* decodeHookPulseRow(expectSingleRow(run))).harnessHash);
    })
  );

  it.effect("preserves a checkout name ending in a carriage return", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* makeHarnessFixtureRootHittingEveryMirroredWalkRule();
      const parent = yield* fs.makeTempDirectoryScoped();
      const renamed = path.join(parent, "checkout\r");
      yield* fs.rename(root, renamed);
      yield* Effect.gen(function* () {
        const oracle = yield* typescriptOracleHarnessHash(renamed);
        const encodedJson36 = yield* encodeRawHarnessJson(sessionStartPayload(renamed));
        const run = yield* runWriter(encodedJson36);
        assertSome((yield* decodeHookPulseRow(expectSingleRow(run))).harnessHash, oracle.harnessHash);
      }).pipe(Effect.ensuring(fs.rename(renamed, root).pipe(Effect.orDie)));
    })
  );

  it.effect("discovers physical checkout ownership through a symlink in another checkout", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const outer = yield* makeHarnessFixtureRootHittingEveryMirroredWalkRule();
      const inner = yield* makeHarnessFixtureRootHittingEveryMirroredWalkRule();
      yield* fs.writeFileString(path.join(inner, ".claude/settings.local.json"), '{"model":"inner-fixture"}');
      const subdirectory = path.join(inner, "nested\n");
      yield* fs.makeDirectory(subdirectory);
      const alias = path.join(outer, "alias");
      yield* fs.symlink(subdirectory, alias);
      const oracle = yield* typescriptOracleHarnessHash(inner);
      const encodedJson37 = yield* encodeRawHarnessJson(sessionStartPayload(alias));
      const run = yield* runWriter(encodedJson37);
      assertSome((yield* decodeHookPulseRow(expectSingleRow(run))).harnessHash, oracle.harnessHash);
    })
  );

  it.effect("withholds the outer stamp when nearer Git metadata has no root guide", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const outer = yield* makeHarnessFixtureRootHittingEveryMirroredWalkRule();
      const inner = path.join(outer, "nearer");
      yield* fs.makeDirectory(path.join(inner, ".git"), { recursive: true });
      const encodedJson38 = yield* encodeRawHarnessJson(sessionStartPayload(inner));
      const run = yield* runWriter(encodedJson38);
      assertNone((yield* decodeHookPulseRow(expectSingleRow(run))).harnessHash);
    })
  );

  it.effect("rejects an invalid inherited refusal date and partitions valid dates by the attempt", () =>
    Effect.gen(function* () {
      const invalid = yield* runWriter("", {
        writerArgs: ["--refuse", "timeout"],
        attemptUtc: "2026-02-30T00:00:00Z",
      });
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
      const root = yield* makeHarnessFixtureRootHittingEveryMirroredWalkRule();
      const failure = yield* typescriptOracleHarnessHash(root).pipe(
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
      const encodedJson39 = yield* encodeRawHarnessJson(sessionStartPayload(root));
      const run = yield* runWriter(encodedJson39, { executablePath });
      assertNone((yield* decodeHookPulseRow(expectSingleRow(run))).harnessHash);
    })
  );

  it.effect(
    "carries an operator salt into every private digest, which no default-salt case can tell from a hardcoded fallback",
    () =>
      Effect.gen(function* () {
        const encodedJson40 = yield* encodeRawHarnessJson(preToolUsePayload);
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
        const privateDigest8 = yield* typeScriptOraclePrivateDigest(session);
        argument1.toBe(privateDigest8);
      })
  );

  it.effect("treats a whitespace-only salt as unset, exactly as resolveAiMetricsHashSaltValue does", () =>
    Effect.gen(function* () {
      const encodedJson41 = yield* encodeRawHarnessJson(preToolUsePayload);
      const run = yield* runWriter(encodedJson41, {
        hashSalt: "   ",
      });
      const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

      const expectation7 = expect(decoded.sessionId);
      const privateDigest9 = yield* typeScriptOraclePrivateDigest(session);
      expectation7.toBe(privateDigest9);
    })
  );

  it.effect("omits notificationType when the raw value is outside the enum", () =>
    Effect.gen(function* () {
      const encodedJson42 = yield* encodeRawHarnessJson(futureNotificationPayload);
      const run = yield* runWriter(encodedJson42);
      const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

      expect(
        decoded.hookEvent,
        "a jq capture() no-match must omit the optional key, never drop the row as the spike writer did"
      ).toBe(HookPulseEvent.Enum.Notification);
      assertNone(decoded.notificationType);
      expect(decoded.waitReason).toBe(HookPulseWaitReason.Enum.unknown);
    })
  );

  it.effect("keeps notificationType when the raw value is inside the enum", () =>
    Effect.gen(function* () {
      const encodedJson43 = yield* encodeRawHarnessJson(permissionPromptNotificationPayload);
      const run = yield* runWriter(encodedJson43);
      const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

      assertSome(decoded.notificationType, HookPulseNotificationType.Enum.permission_prompt);
    })
  );

  it.effect("carries sessionEndReason only on SessionEnd", () =>
    Effect.gen(function* () {
      const encodedJson44 = yield* encodeRawHarnessJson(sessionEndPayload);
      const ended = yield* runWriter(encodedJson44);
      const encodedJson45 = yield* encodeRawHarnessJson(stopPayload);
      const stopped = yield* runWriter(encodedJson45);
      const encodedJson46 = yield* encodeRawHarnessJson(permissionDeniedClosingDeniedWaitPayload);
      const denied = yield* runWriter(encodedJson46);
      const decodedEnd = yield* decodeHookPulseRow(expectSingleRow(ended));
      const decodedStop = yield* decodeHookPulseRow(expectSingleRow(stopped));
      const decodedDenied = yield* decodeHookPulseRow(expectSingleRow(denied));

      assertSome(decodedEnd.sessionEndReason, "prompt_input_exit");
      assertNone(decodedStop.sessionEndReason);
      const deniedEndReason = decodedDenied.sessionEndReason;
      deepStrictEqual(deniedEndReason, O.none(), "a permission-denied reason is content, not a session-end reason");
    })
  );

  it.effect("carries durationMs from PostToolUse and pairs tool ids", () =>
    Effect.gen(function* () {
      const encodedJson47 = yield* encodeRawHarnessJson(postToolUsePayload);
      const run = yield* runWriter(encodedJson47);
      const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

      assertSome(decoded.durationMs, 477);
      assertSome(decoded.toolUseId, "toolu_writer_1");
    })
  );

  it.effect(
    "drops a non-finite durationMs rather than writing an undecodable row that poisons replay of its shard",
    () =>
      Effect.gen(function* () {
        const nonFiniteDurationStdin48 = yield* nonFiniteDurationSplicedIntoRawStdinText;
        const run = yield* runWriter(nonFiniteDurationStdin48);
        const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

        assertNone(decoded.durationMs);
        expect(decoded.hookEvent).toBe(HookPulseEvent.Enum.PostToolUse);
      })
  );

  it.effect("invents no toolUseId for PermissionRequest, since the P4 two-hop join relies on its absence", () =>
    Effect.gen(function* () {
      const encodedJson49 = yield* encodeRawHarnessJson(permissionRequestPlanPayload);
      const run = yield* runWriter(encodedJson49);
      const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

      assertNone(decoded.toolUseId);
      assertSome(decoded.toolName, "ExitPlanMode");
    })
  );

  it.effect("writes nothing and exits 0 when the kill-switch sentinel exists", () =>
    Effect.gen(function* () {
      const encodedJson50 = yield* encodeRawHarnessJson(permissionRequestPlanPayload);
      const run = yield* runWriter(encodedJson50, {
        disarmSentinel: '{"disarmedAt":"2026-08-05T00:00:00Z","reason":"test","evidenceTier":"unknown"}',
      });

      expectSilentRefusal(run);
      expect(run.refusals).toHaveLength(1);
      const refusal = yield* decodeHookPulseRefusalJson(pipe(A.head(run.refusals), O.getOrThrow));
      expect(refusal.reason).toBe("disabled");
    })
  );

  A.forEach(
    [
      { label: "cloud host, desktop notifier", host: "cloud", notifierRev: "desktop-ntfy-1", notified: false },
      { label: "unset host, desktop notifier", host: "", notifierRev: "desktop-ntfy-1", notified: true },
      { label: "a non-cloud host value", host: "workstation", notifierRev: "desktop-ntfy-1", notified: true },
      { label: "cloud host, log-only opt-out", host: "cloud", notifierRev: "log-only-0", notified: false },
      { label: "unset host, log-only opt-out", host: "", notifierRev: "log-only-0", notified: false },
    ],
    ({ label, host, notifierRev, notified }) => {
      it.effect(`writes one row and ${notified ? "runs" : "skips"} the stub desktop notifier for ${label}`, () =>
        Effect.gen(function* () {
          const stub = yield* makeWriterCopyBesideCallLoggingNotifierStub();
          const encodedJson51 = yield* encodeRawHarnessJson(permissionRequestToolPayload);
          const run = yield* runWriter(encodedJson51, {
            writerPath: stub.writerPath,
            lastSpreadEnvOverrides: notifierHostEnvWithSynchronousStubCalls(host, notifierRev),
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
        stdin: encodeRawHarnessJson(permissionRequestToolPayload),
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
          const stub = yield* makeWriterCopyBesideCallLoggingNotifierStub();
          const stdin53 = yield* stdin;
          const run = yield* runWriter(stdin53, {
            writerPath: stub.writerPath,
            lastSpreadEnvOverrides: notifierHostEnvWithSynchronousStubCalls("cloud", "desktop-ntfy-1"),
            ...(disarmed
              ? { disarmSentinel: '{"disarmedAt":"2026-11-01T00:00:00Z","reason":"test","evidenceTier":"unknown"}' }
              : {}),
          });

          expectSilentRefusal(run);
          expect(run.stderr).toBe("");
          const refusals = yield* Effect.forEach(run.refusals, (row) => decodeHookPulseRefusalJson(row), {
            concurrency: 1,
          });
          expect(
            A.map(refusals, (refusal) => refusal.reason),
            "each path leaves a payload-free refusal row"
          ).toEqual([reason]);
          const calls54 = yield* stub.calls;
          expect(calls54, "the payload-free refusal row is the only trace either path leaves").toHaveLength(0);
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
        stdin: encodeRawHarnessJson({ ...stopPayload, session_id: undefined }),
      },
      {
        label: "a payload with an unknown hook_event_name",
        stdin: encodeRawHarnessJson({
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

  it.effect("carries the bracket-closing toolUseId, durationMs and isInterrupt on PostToolUseFailure", () =>
    Effect.gen(function* () {
      const encodedJson56 = yield* encodeRawHarnessJson(postToolUseFailurePayload(true));
      const interrupted = yield* runWriter(encodedJson56);
      const encodedJson57 = yield* encodeRawHarnessJson(postToolUseFailurePayload(false));
      const errored = yield* runWriter(encodedJson57);
      const decodedInterrupted = yield* decodeHookPulseRow(expectSingleRow(interrupted));
      const decodedErrored = yield* decodeHookPulseRow(expectSingleRow(errored));

      deepStrictEqual(
        decodedInterrupted.toolUseId,
        O.some("toolu_writer_1"),
        "PostToolUseFailure ends a call in place of PostToolUse, so it carries the bracket-closing id"
      );
      assertSome(decodedInterrupted.durationMs, 12);
      assertSome(decodedInterrupted.isInterrupt, true);
      const toolErroredRatherThanTheHumanHittingEscape = false;
      assertSome(decodedErrored.isInterrupt, toolErroredRatherThanTheHumanHittingEscape);
    })
  );

  it.effect(
    "carries isInterrupt only on PostToolUseFailure, since HookPulseEventOwnedFieldInvariant rejects it elsewhere",
    () =>
      Effect.gen(function* () {
        const encodedJson58 = yield* encodeRawHarnessJson({ ...postToolUsePayload, is_interrupt: true });
        const run = yield* runWriter(encodedJson58);
        const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

        expect(decoded.hookEvent).toBe(HookPulseEvent.Enum.PostToolUse);
        assertNone(decoded.isInterrupt);
      })
  );

  it.effect("resolves the ledger path through the XDG fallback rung to the directory hookPulseLedgerDir derives", () =>
    Effect.gen(function* () {
      const encodedJson59 = yield* encodeRawHarnessJson(permissionRequestPlanPayload);
      const run = yield* runWriter(encodedJson59, {
        viaXdgFallback: true,
      });
      const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

      expect(decoded.waitReason).toBe(HookPulseWaitReason.Enum["plan-approval"]);
    })
  );

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
      writerOptions: { hashSalt: SALT_SHARED_BY_WRITER_AND_CODEC },
      codecEnv: { BEEP_HOOK_PULSE_HASH_SALT: SALT_SHARED_BY_WRITER_AND_CODEC },
      expectedSalt: SALT_SHARED_BY_WRITER_AND_CODEC,
    },
    {
      label: "the ai-metrics rung",
      writerOptions: { aiMetricsHashSalt: SALT_SHARED_BY_WRITER_AND_CODEC },
      codecEnv: { BEEP_AI_METRICS_HASH_SALT: SALT_SHARED_BY_WRITER_AND_CODEC },
      expectedSalt: SALT_SHARED_BY_WRITER_AND_CODEC,
    },
  ];

  A.forEach(codecParityCases, ({ codecEnv, expectedSalt, label, writerOptions }) => {
    it.effect(`reproduces the shell writer's private digests in the TypeScript codec through ${label}`, () =>
      Effect.gen(function* () {
        const encodedJson60 = yield* encodeRawHarnessJson(preToolUsePayload);
        const run = yield* runWriter(encodedJson60, writerOptions);
        const writerRow = yield* decodeHookPulseRow(expectSingleRow(run));
        const tsThatEntersNoDigest = "2026-08-01T06:40:07.000Z";
        const codecRow = yield* withPinnedSaltProviderNotAmbientEnv(
          codecEnv,
          decodeHookPulseFromRaw({
            event: preToolUsePayload,
            notifierRev: "log-only-0",
            instrumentClass: HookPulseInstrumentClass.Enum.production,
            agentKind: HookPulseAgentKind.Enum["claude-code"],
            evidenceTier: HookPulseEvidenceTier.Enum.derived,
            ts: tsThatEntersNoDigest,
          })
        );

        expect(codecRow.sessionId).toBe(writerRow.sessionId);
        expect(codecRow.cwd).toBe(writerRow.cwd);
        expect(codecRow.transcriptPath).toEqual(writerRow.transcriptPath);
        const expectation8 = expect(
          codecRow.sessionId,
          "the rung's own digest separates reproducing the writer from both halves hardcoding the fallback"
        );
        const hashPrivateIdentifier10 = yield* hashPrivateIdentifier(session, O.fromUndefinedOr(expectedSalt));
        expectation8.toBe(hashPrivateIdentifier10);
        const expectation9 = expect(codecRow.cwd);
        const hashPrivateIdentifier11 = yield* hashPrivateIdentifier(baseFields.cwd, O.fromUndefinedOr(expectedSalt));
        expectation9.toBe(hashPrivateIdentifier11);
      })
    );
  });

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
  const projectionDocument = encodeRawHarnessJson(projectionFields);

  it.effect("reproduces the writer's private digests through the projection rung, above the ai-metrics rung", () =>
    Effect.gen(function* () {
      const projectionDocument61 = yield* projectionDocument;
      const { file } = yield* writeProjection(projectionDocument61);
      const encodedJson62 = yield* encodeRawHarnessJson(preToolUsePayload);
      const run = yield* runWriter(encodedJson62, {
        namespaceProjection: file,
        aiMetricsHashSalt: SALT_SHARED_BY_WRITER_AND_CODEC,
      });
      const writerRow = yield* decodeHookPulseRow(expectSingleRow(run));
      const expectation10 = expect(writerRow.sessionId);
      const hashPrivateIdentifier12 = yield* hashPrivateIdentifier(session, O.some(PROJECTION_SALT));
      expectation10.toBe(hashPrivateIdentifier12);
      const expectation11 = expect(writerRow.cwd);
      const hashPrivateIdentifier13 = yield* hashPrivateIdentifier(baseFields.cwd, O.some(PROJECTION_SALT));
      expectation11.toBe(hashPrivateIdentifier13);
      const namespace = yield* withPinnedSaltProviderNotAmbientEnv(
        { BEEP_HOOK_PULSE_NAMESPACE_PROJECTION: file, BEEP_AI_METRICS_HASH_SALT: SALT_SHARED_BY_WRITER_AND_CODEC },
        hookPulseNamespace
      );
      expect(namespace.source).toBe("projection");
      const hashPrivateIdentifier63 = yield* hashPrivateIdentifier(session, namespace.hashSalt);
      expect(hashPrivateIdentifier63).toBe(writerRow.sessionId);
      const encodedJson64 = yield* encodeRawHarnessJson(preToolUsePayload);
      const overridden = yield* runWriter(encodedJson64, {
        namespaceProjection: file,
        hashSalt: SALT_SHARED_BY_WRITER_AND_CODEC,
      });
      const overriddenRow = yield* decodeHookPulseRow(expectSingleRow(overridden));
      const expectation12 = expect(overriddenRow.sessionId, "the instrument override wins over the projection");
      const hashPrivateIdentifier14 = yield* hashPrivateIdentifier(session, O.some(SALT_SHARED_BY_WRITER_AND_CODEC));
      expectation12.toBe(hashPrivateIdentifier14);
      const overriddenNamespace = yield* withPinnedSaltProviderNotAmbientEnv(
        { BEEP_HOOK_PULSE_NAMESPACE_PROJECTION: file, BEEP_HOOK_PULSE_HASH_SALT: SALT_SHARED_BY_WRITER_AND_CODEC },
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
        const encodedJson65 = yield* encodeRawHarnessJson(fields);
        const { file } = yield* writeProjection(encodedJson65);
        const encodedJson66 = yield* encodeRawHarnessJson(preToolUsePayload);
        const run = yield* runWriter(encodedJson66, { namespaceProjection: file });
        const row = yield* decodeHookPulseRow(expectSingleRow(run));
        const namespace = yield* withPinnedSaltProviderNotAmbientEnv(
          { BEEP_HOOK_PULSE_NAMESPACE_PROJECTION: file },
          hookPulseNamespace
        );
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
          const encodedJson67 = yield* encodeRawHarnessJson(preToolUsePayload);
          const run = yield* runWriter(encodedJson67, rung.options);
          expect(run.rows).toHaveLength(0);
          expect(run.refusals).toHaveLength(1);
          const error = yield* withPinnedSaltProviderNotAmbientEnv({ [rung.name]: salt }, hookPulseNamespace).pipe(
            Effect.flip
          );
          expect(error._tag).toBe("HookPulseNamespaceError");
        }
      }
    })
  );

  it.effect("uses the same temporary XDG and HOME default projection paths", () =>
    Effect.gen(function* () {
      for (const cacheOverride of [undefined, ""]) {
        const encodedJson68 = yield* encodeRawHarnessJson(preToolUsePayload);
        const run = yield* runWriter(encodedJson68, {
          defaultProjectionDocument: yield* projectionDocument,
          ...(cacheOverride === undefined ? {} : { lastSpreadEnvOverrides: { XDG_CACHE_HOME: cacheOverride } }),
        });
        const row = yield* decodeHookPulseRow(expectSingleRow(run));
        const namespace = yield* withPinnedSaltProviderNotAmbientEnv(
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
      const invalidDocuments = yield* Effect.forEach(invalidFields, (fields) => encodeRawHarnessJson(fields), {
        concurrency: 1,
      });
      const validDocument = yield* projectionDocument;
      for (const text of [...invalidDocuments, `${validDocument}\n${validDocument}`, "null", "[]"]) {
        const { file } = yield* writeProjection(text);
        const encodedJson69 = yield* encodeRawHarnessJson(preToolUsePayload);
        const run = yield* runWriter(encodedJson69, { namespaceProjection: file });
        expect(run.rows).toHaveLength(0);
        expect(run.refusals).toHaveLength(1);
        const refusal = yield* decodeHookPulseRefusalJson(A.getUnsafe(run.refusals, 0));
        expect(refusal.reason).toBe("namespace-projection-invalid");
        const error = yield* withPinnedSaltProviderNotAmbientEnv(
          { BEEP_HOOK_PULSE_NAMESPACE_PROJECTION: file },
          hookPulseNamespace
        ).pipe(Effect.flip);
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
          { namespaceProjection: `${dir}/absent.json`, aiMetricsHashSalt: SALT_SHARED_BY_WRITER_AND_CODEC },
          { namespaceProjection: `${dir}/absent.json` },
        ];
        for (const options of cases) {
          const encodedJson70 = yield* encodeRawHarnessJson(preToolUsePayload);
          const run = yield* runWriter(encodedJson70, options);
          const row = yield* decodeHookPulseRow(expectSingleRow(run));
          const namespace = yield* withPinnedSaltProviderNotAmbientEnv(
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
      const encodedJson71 = yield* encodeRawHarnessJson({ version: 1, hashSalt: "   " });
      const blank = yield* writeProjection(encodedJson71);
      const encodedJson72 = yield* encodeRawHarnessJson({ version: 2, hashSalt: PROJECTION_SALT });
      const wrongVersion = yield* writeProjection(encodedJson72);
      const projectionDocument73 = yield* projectionDocument;
      const linked = yield* writeProjection(projectionDocument73);
      const link = path.join(linked.dir, "link.json");
      yield* fs.symlink(linked.file, link);
      const dangling = path.join(linked.dir, "dangling.json");
      yield* fs.symlink(path.join(linked.dir, "missing.json"), dangling);
      for (const projection of [malformed.file, blank.file, wrongVersion.file, link, dangling, linked.dir]) {
        const encodedJson74 = yield* encodeRawHarnessJson(preToolUsePayload);
        const run = yield* runWriter(encodedJson74, {
          namespaceProjection: projection,
          aiMetricsHashSalt: SALT_SHARED_BY_WRITER_AND_CODEC,
        });
        expect(run.exitCode).toBe(0);
        expect(run.rows).toHaveLength(0);
        expect(run.refusals).toHaveLength(1);
        const refusal = yield* decodeHookPulseRefusalJson(A.getUnsafe(run.refusals, 0));
        expect(refusal.reason).toBe("namespace-projection-invalid");
        const resolved = yield* withPinnedSaltProviderNotAmbientEnv(
          {
            BEEP_HOOK_PULSE_NAMESPACE_PROJECTION: projection,
            BEEP_AI_METRICS_HASH_SALT: SALT_SHARED_BY_WRITER_AND_CODEC,
          },
          hookPulseNamespace
        ).pipe(Effect.flip);
        expect(
          resolved._tag,
          "the link is read before exists, which follows a link and would hide a dangling one"
        ).toBe("HookPulseNamespaceError");
      }
    })
  );
});

const decodeDisarmSentinel = HookPulseDisarmSentinel.decodeJsonEffect;
const decodeDisarmWindow = HookPulseDisarmWindow.decodeJsonEffect;

const isoUtcSecondAsDateUPrintsIt = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

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

const makeSwitchStoreSharedAcrossInvocations = Effect.fnUntraced(function* () {
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

// decision: hook-pulse-writer-test-spawns-through-effect-child-process
const runSwitch = Effect.fnUntraced(function* (store: SwitchStore, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make(switchPath, args, {
    cwd: repoRoot,
    extendEnv: true,
    env: {
      HOME: store.stateHome,
      XDG_STATE_HOME: store.stateHome,
      BEEP_AGENT_EVIDENCE_ROOT: store.evidenceRoot,
      BEEP_HOOK_PULSE_DISARM_SENTINEL: UNSET_FALLS_THROUGH_TO_WRITER_DEFAULT,
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

const SEEDED_DISARM_OLDER_THAN_ANY_DATE_U_SECOND = {
  disarmedAt: "2026-08-05T00:00:00Z",
  evidenceTier: HookPulseEvidenceTier.Enum.unknown,
  reason: "seeded-first-window",
};
const seededSentinelJson = Effect.map(
  encodeRawHarnessJson(SEEDED_DISARM_OLDER_THAN_ANY_DATE_U_SECOND),
  (json) => `${json}\n`
);

const expectSingleWindow = (rows: ReadonlyArray<string>): string => {
  expect(rows).toHaveLength(1);
  const [row] = rows;
  expect(row).toBeDefined();
  return `${row}`;
};

const expectSwitchOk = (run: SwitchRun): void => {
  expect(run.exitCode).toBe(0);
  expect(
    run.stderr,
    "every success path stays silent on stderr; the interesting half is the sentinel and the ledger"
  ).toBe("");
};

it.layer(GitKitOverNodeSpawner, { timeout: "30 seconds" })("hook-pulse kill-switch conformance", (it) => {
  it.effect("keeps the first disarm's window start and reason when disarm runs again", () =>
    Effect.gen(function* () {
      const store = yield* makeSwitchStoreSharedAcrossInvocations();
      const first = yield* runSwitch(store, ["disarm", "first-reason"]);
      const afterFirst = yield* readSentinel(store);
      const second = yield* runSwitch(store, ["disarm", "second-reason"]);
      const afterSecond = yield* readSentinel(store);

      expectSwitchOk(first);
      expectSwitchOk(second);
      expect(
        afterSecond,
        "byte-identity: the reason changes on the second call, so an overwrite shows even within one clock second"
      ).toEqual(afterFirst);

      const decoded = yield* afterSecond.pipe(O.getOrThrow, decodeDisarmSentinel);

      expect(decoded.reason).toBe("first-reason");
      expect(decoded.evidenceTier).toBe(HookPulseEvidenceTier.Enum.unknown);
      expect(
        second.stdout,
        "the switch is an operator command, so stdout is a status line rather than hook silence; re-running disarm reports which window it is still inside"
      ).toContain(`already disarmed since ${decoded.disarmedAt}`);
    })
  );

  it.effect("never moves an existing window start forward, across any elapsed time", () =>
    Effect.gen(function* () {
      const store = yield* makeSwitchStoreSharedAcrossInvocations();
      const seededSentinelJson75 = yield* seededSentinelJson;
      yield* seedSentinel(store, seededSentinelJson75);

      const run = yield* runSwitch(store, ["disarm", "a-much-later-reason"]);

      expectSwitchOk(run);
      const readSentinel76 = yield* readSentinel(store);
      const seed = yield* seededSentinelJson;
      deepStrictEqual(
        readSentinel76,
        O.some(seed),
        "the sentinel stays byte-identical to the seed, with its reason, timestamp and trailing newline"
      );
      expect(run.stdout).toContain(SEEDED_DISARM_OLDER_THAN_ANY_DATE_U_SECOND.disarmedAt);
    })
  );

  it.effect("fails loudly when a dangling sentinel prevents disarm", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const store = yield* makeSwitchStoreSharedAcrossInvocations();
      yield* fs.makeDirectory(store.evidenceRoot, { recursive: true });
      yield* fs.symlink(path.join(store.evidenceRoot, "missing-sentinel-target"), store.sentinelPath);

      const run = yield* runSwitch(store, ["disarm", "privacy-stop"]);

      expect(run.exitCode).not.toBe(0);
      expect(run.stdout).toBe("");
      expect(run.stderr).toContain("sentinel was not published");
    })
  );

  it.effect(
    "closes the ledger window at the FIRST disarm, not the latest, so a re-disarm cannot shorten the recorded gap",
    () =>
      Effect.gen(function* () {
        const store = yield* makeSwitchStoreSharedAcrossInvocations();
        const seededSentinelJson77 = yield* seededSentinelJson;
        yield* seedSentinel(store, seededSentinelJson77);
        yield* runSwitch(store, ["disarm", "a-much-later-reason"]);

        const armed = yield* runSwitch(store, ["arm"]);
        const readWindowRows78 = yield* readWindowRows(store);
        const window = yield* decodeDisarmWindow(expectSingleWindow(readWindowRows78));

        expectSwitchOk(armed);
        expect(window.schemaVersion).toBe(HookPulseDisarmWindowSchemaVersion.Enum["hook-pulse-disarm-window/v1"]);
        assertSome(window.disarmedAt, SEEDED_DISARM_OLDER_THAN_ANY_DATE_U_SECOND.disarmedAt);
        assertSome(window.reason, SEEDED_DISARM_OLDER_THAN_ANY_DATE_U_SECOND.reason);
        expect(window.evidenceTier, "no hook rows exist for the window, so it is uninstrumented by construction").toBe(
          HookPulseEvidenceTier.Enum.unknown
        );
        expect(window.rearmedAt).toMatch(isoUtcSecondAsDateUPrintsIt);
        expect(
          window.rearmedAt > SEEDED_DISARM_OLDER_THAN_ANY_DATE_U_SECOND.disarmedAt,
          "fixed-width ISO UTC sorts lexicographically, so a window must close after it opens"
        ).toBe(true);
        const sentinelTheWriterTestsForIsGoneOnceArmed = yield* readSentinel(store);
        assertNone(sentinelTheWriterTestsForIsGoneOnceArmed);
      })
  );

  A.forEach(
    [
      { contents: "", label: "an empty `touch`-created sentinel" },
      { contents: "{not json", label: "a sentinel holding invalid JSON" },
    ],
    ({ contents, label }) => {
      it.effect(`records an unknown window start for ${label}, which a jq // alternative cannot rescue`, () =>
        Effect.gen(function* () {
          const store = yield* makeSwitchStoreSharedAcrossInvocations();
          yield* seedSentinel(store, contents);

          const disarmed = yield* runSwitch(store, ["disarm", "later-reason"]);

          expectSwitchOk(disarmed);
          expect(
            disarmed.stderr,
            "jq diagnostics on a mangled sentinel are handled and never reach stderr, so operators are not trained to ignore the channel that reports real trouble"
          ).toBe("");
          const keptSentinel = yield* readSentinel(store);
          deepStrictEqual(
            keptSentinel,
            O.some(contents),
            "an unparseable sentinel is still a sentinel, with no invented start"
          );

          const armed = yield* runSwitch(store, ["arm"]);
          const readWindowRows81 = yield* readWindowRows(store);
          const window = yield* decodeDisarmWindow(expectSingleWindow(readWindowRows81));

          expectSwitchOk(armed);
          const disarmedAt = window.disarmedAt;
          deepStrictEqual(
            disarmedAt,
            O.none(),
            "disarmedAt is null, never the rearm instant that would read as zero-length coverage"
          );
          assertNone(window.reason);
          expect(window.rearmedAt).toMatch(isoUtcSecondAsDateUPrintsIt);
          const readSentinel82 = yield* readSentinel(store);
          assertNone(readSentinel82);
        })
      );
    }
  );

  it.effect("appends nothing when arm runs while already armed", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const store = yield* makeSwitchStoreSharedAcrossInvocations();

      const run = yield* runSwitch(store, ["arm"]);

      expectSwitchOk(run);
      expect(run.stdout).toContain("already armed");
      const readWindowRows83 = yield* readWindowRows(store);
      expect(
        readWindowRows83,
        "the window ledger is append-only, so a phantom window could never be retracted"
      ).toEqual([]);
      const exists84 = yield* fs.exists(store.windowsPath);
      expect(exists84, "no file keeps 'no windows yet' apart from a window with empty fields").toBe(false);
    })
  );

  it.effect("reports the sentinel document the writer tests for on status and stops reporting it once armed", () =>
    Effect.gen(function* () {
      const store = yield* makeSwitchStoreSharedAcrossInvocations();
      const seededSentinelJson85 = yield* seededSentinelJson;
      yield* seedSentinel(store, seededSentinelJson85);

      const disarmed = yield* runSwitch(store, ["status"]);
      yield* runSwitch(store, ["arm"]);
      const armed = yield* runSwitch(store, ["status"]);

      expectSwitchOk(disarmed);
      expectSwitchOk(armed);
      expect(disarmed.stdout).toContain(store.sentinelPath);
      expect(disarmed.stdout).toContain(SEEDED_DISARM_OLDER_THAN_ANY_DATE_U_SECOND.disarmedAt);
      expect(disarmed.stdout).toContain(SEEDED_DISARM_OLDER_THAN_ANY_DATE_U_SECOND.reason);
      expect(armed.stdout).toContain("armed (no sentinel");
      expect(armed.stdout).not.toContain(SEEDED_DISARM_OLDER_THAN_ANY_DATE_U_SECOND.disarmedAt);
    })
  );

  it.effect("exits 2 with usage on an unknown subcommand, the non-zero anchor for every exit-0 case", () =>
    Effect.gen(function* () {
      const store = yield* makeSwitchStoreSharedAcrossInvocations();

      const run = yield* runSwitch(store, ["bogus"]);

      expect(run.exitCode).toBe(2);
      expect(run.stderr).toContain("usage:");
      expect(run.stdout, "usage goes to stderr so a stdout pipe never reads it as a status line").toBe("");
    })
  );
});
