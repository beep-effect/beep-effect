import * as NodeURL from "node:url";
import {
  agentEvidenceRoot,
  CircuitBreakerEventV1,
  circuitBreakerEventLedgerDir,
  circuitBreakerRoot,
  HookPulseV1,
  hashPrivateIdentifier,
  hookPulseDisarmSentinelPath,
  hookPulseLedgerDir,
  SequenceBreakDampingV1,
  SequenceBreakNotificationV1,
  sequenceBreakDampingDir,
  sequenceBreakNotificationLedgerDir,
  sequenceBreakRoot,
} from "@beep/repo-ai-metrics";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { fcRuns } from "@beep/test-utils";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { Effect, FileSystem, Path, Result, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import { ChildProcess } from "effect/unstable/process";

const repoRoot = NodeURL.fileURLToPath(new URL("../../../../../", import.meta.url));
const notifierPath = `${repoRoot}.claude/hooks/sequence-break-notifier.sh`;
const writerPath = `${repoRoot}.claude/hooks/hook-pulse.sh`;

const SESSION_ID = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const CWD_ID = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
const TOOL_USE_ID = "toolu_sequence_break_1";
const AMBIGUOUS_TOOL_USE_ID = "toolu_sequence_break_2";
const PRE_TS = "2026-09-03T12:00:00.000Z";
const REQUEST_TS = "2026-09-03T12:00:00.001Z";
const POST_TS = "2026-09-03T12:00:00.002Z";
const CANARY = "SEQUENCE-BREAK-CONTENT-CANARY";
const encodeJson = UnknownFromJsonString.encodeUnknownEffect;

const canonicalNotificationKeys = [
  "schemaVersion",
  "ts",
  "requestTs",
  "sessionId",
  "agentKind",
  "notifierRev",
  "target",
  "waitReason",
  "stage",
  "ageMs",
  "evidenceTier",
  "transport",
  "delivery",
];

const canonicalDampingKeys = [
  "schemaVersion",
  "sessionId",
  "target",
  "notifierRev",
  "claimedEpochMs",
  "expiresEpochMs",
];

const decodeHookPulse = S.decodeUnknownSync(HookPulseV1);
const hookPulseLine = (input: unknown): string => HookPulseV1.encodeJsonSync(decodeHookPulse(input));

const preToolUseLine = (sessionId = SESSION_ID, cwd = CWD_ID, ts = PRE_TS, toolUseId = TOOL_USE_ID): string =>
  hookPulseLine({
    schemaVersion: "hook-pulse/v1",
    ts,
    sessionId,
    agentKind: "claude-code",
    hookEvent: "PreToolUse",
    cwd,
    notifierRev: "desktop-ntfy-1",
    instrumentClass: "production",
    evidenceTier: "derived",
    waitReason: "none",
    toolName: "AskUserQuestion",
    toolUseId,
  });

const permissionRequestLine = hookPulseLine({
  schemaVersion: "hook-pulse/v1",
  ts: REQUEST_TS,
  sessionId: SESSION_ID,
  agentKind: "claude-code",
  hookEvent: "PermissionRequest",
  cwd: CWD_ID,
  notifierRev: "desktop-ntfy-1",
  instrumentClass: "production",
  evidenceTier: "derived",
  waitReason: "tool-permission",
  toolName: "AskUserQuestion",
});

const postToolUseLine = hookPulseLine({
  schemaVersion: "hook-pulse/v1",
  ts: POST_TS,
  sessionId: SESSION_ID,
  agentKind: "claude-code",
  hookEvent: "PostToolUse",
  cwd: CWD_ID,
  notifierRev: "desktop-ntfy-1",
  instrumentClass: "production",
  evidenceTier: "derived",
  waitReason: "none",
  toolName: "AskUserQuestion",
  toolUseId: TOOL_USE_ID,
});

const ambiguousPostToolUseLine = hookPulseLine({
  schemaVersion: "hook-pulse/v1",
  ts: POST_TS,
  sessionId: SESSION_ID,
  agentKind: "claude-code",
  hookEvent: "PostToolUse",
  cwd: CWD_ID,
  notifierRev: "desktop-ntfy-1",
  instrumentClass: "production",
  evidenceTier: "derived",
  waitReason: "none",
  toolName: "AskUserQuestion",
  toolUseId: AMBIGUOUS_TOOL_USE_ID,
});

interface NotifierStore {
  readonly circuitEventDir: string;
  readonly dampingPath: string;
  readonly evidenceRoot: string;
  readonly fakeBin: string;
  readonly hookPath: string;
  readonly notificationDir: string;
  readonly stateHome: string;
}

const makeNotifierStore = Effect.fnUntraced(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const stateHome = yield* fs.makeTempDirectoryScoped({ prefix: "beep-sequence-break-" });
  const evidenceRoot = agentEvidenceRoot(stateHome);
  const hookDir = hookPulseLedgerDir(evidenceRoot);
  const stateRoot = sequenceBreakRoot(evidenceRoot);
  const fakeBin = path.join(stateHome, "bin");
  const fakeCurl = path.join(fakeBin, "curl");
  const fakeNotifySend = path.join(fakeBin, "notify-send");

  yield* fs.makeDirectory(hookDir, { recursive: true });
  yield* fs.makeDirectory(fakeBin, { recursive: true });
  yield* fs.writeFileString(fakeCurl, "#!/usr/bin/env bash\ncat >/dev/null\nexit 0\n");
  yield* fs.writeFileString(fakeNotifySend, "#!/usr/bin/env bash\nexit 0\n");
  yield* fs.chmod(fakeCurl, 0o755);
  yield* fs.chmod(fakeNotifySend, 0o755);

  return {
    circuitEventDir: circuitBreakerEventLedgerDir(circuitBreakerRoot(evidenceRoot)),
    dampingPath: path.join(sequenceBreakDampingDir(stateRoot), `${SESSION_ID}-human-input.json`),
    evidenceRoot,
    fakeBin,
    hookPath: path.join(hookDir, `hook-pulse-2026-09-03-${SESSION_ID}.ndjson`),
    notificationDir: sequenceBreakNotificationLedgerDir(stateRoot),
    stateHome,
  } satisfies NotifierStore;
});

const runNotifier = Effect.fnUntraced(function* (store: NotifierStore, ntfyTopic = "", ntfyToken = "") {
  const handle = yield* ChildProcess.make(
    notifierPath,
    ["claude-code", SESSION_ID, REQUEST_TS, "tool-permission", "human-input", "AskUserQuestion", "desktop-ntfy-1"],
    {
      cwd: repoRoot,
      extendEnv: true,
      env: {
        HOME: store.stateHome,
        PATH: `${store.fakeBin}:/usr/bin:/bin`,
        XDG_STATE_HOME: store.stateHome,
        DBUS_SESSION_BUS_ADDRESS: "stub:test-only",
        BEEP_AGENT_EVIDENCE_ROOT: store.evidenceRoot,
        BEEP_HOOK_PULSE_DISARM_SENTINEL: "",
        BEEP_SEQUENCE_BREAK_DESKTOP_ENABLED: "1",
        BEEP_SEQUENCE_BREAK_MAX_STAGE: "initial",
        BEEP_SEQUENCE_BREAK_NTFY_TOPIC: ntfyTopic,
        BEEP_SEQUENCE_BREAK_NTFY_TOKEN: ntfyToken,
      },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    }
  );

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

const runWriter = Effect.fnUntraced(function* (store: NotifierStore, stdin: string) {
  const handle = yield* ChildProcess.make(writerPath, [], {
    cwd: repoRoot,
    extendEnv: true,
    env: {
      HOME: store.stateHome,
      PATH: `${store.fakeBin}:/usr/bin:/bin`,
      PWD: repoRoot,
      XDG_STATE_HOME: store.stateHome,
      DBUS_SESSION_BUS_ADDRESS: "stub:test-only",
      BEEP_AGENT_EVIDENCE_ROOT: store.evidenceRoot,
      BEEP_AI_METRICS_HASH_SALT: "",
      BEEP_HOOK_PULSE_DISARM_SENTINEL: "",
      BEEP_HOOK_PULSE_HASH_SALT: "",
      BEEP_HOOK_PULSE_INSTRUMENT_CLASS: "production",
      BEEP_HOOK_PULSE_NOTIFIER_REV: "desktop-ntfy-1",
      BEEP_SEQUENCE_BREAK_DESKTOP_ENABLED: "1",
      BEEP_SEQUENCE_BREAK_FOREGROUND: "1",
      BEEP_SEQUENCE_BREAK_MAX_STAGE: "initial",
      BEEP_SEQUENCE_BREAK_NTFY_TOPIC: "",
    },
    stdin: { stream: Stream.encodeText(Stream.make(stdin)), endOnDone: true },
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

const notificationRows = Effect.fnUntraced(function* (store: NotifierStore) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const exists = yield* fs.exists(store.notificationDir);
  if (!exists) return A.empty<string>();

  const files = yield* fs.readDirectory(store.notificationDir);
  const rows = yield* Effect.forEach(files, (file) =>
    Effect.map(fs.readFileString(path.join(store.notificationDir, file)), (contents) =>
      A.filter(contents.split("\n"), (line) => line.length > 0)
    )
  );

  return A.flatten(rows);
});

const decodedNotifications = Effect.fnUntraced(function* (store: NotifierStore) {
  return yield* Effect.forEach(yield* notificationRows(store), (row) =>
    SequenceBreakNotificationV1.decodeJsonEffect(row)
  );
});

const breakerEventRows = Effect.fnUntraced(function* (store: NotifierStore) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files = yield* fs.readDirectory(store.circuitEventDir);
  const rows = yield* Effect.forEach(files, (file) =>
    Effect.map(fs.readFileString(path.join(store.circuitEventDir, file)), (contents) =>
      A.filter(contents.split("\n"), (line) => line.length > 0)
    )
  );

  return A.flatten(rows);
});

const decodedBreakerEvents = Effect.fnUntraced(function* (store: NotifierStore) {
  return yield* Effect.forEach(yield* breakerEventRows(store), (row) => CircuitBreakerEventV1.decodeJsonEffect(row));
});

const expectSilentSuccess = (run: { readonly exitCode: number; readonly stderr: string; readonly stdout: string }) => {
  expect(run.exitCode).toBe(0);
  expect(run.stderr).toBe("");
  expect(run.stdout).toBe("");
};

layer(NodeServices.layer)("sequence-break notification contracts", (it) => {
  it("declares exactly the two content-free persisted surfaces", () => {
    expect(A.difference(R.keys(SequenceBreakNotificationV1.fields), canonicalNotificationKeys)).toEqual([]);
    expect(A.difference(canonicalNotificationKeys, R.keys(SequenceBreakNotificationV1.fields))).toEqual([]);
    expect(A.difference(R.keys(SequenceBreakDampingV1.fields), canonicalDampingKeys)).toEqual([]);
    expect(A.difference(canonicalDampingKeys, R.keys(SequenceBreakDampingV1.fields))).toEqual([]);
  });

  it("rejects mismatched wait attribution and reversed damping intervals", () => {
    const notification = {
      schemaVersion: "sequence-break-notification/v1",
      ts: POST_TS,
      requestTs: REQUEST_TS,
      sessionId: SESSION_ID,
      agentKind: "claude-code",
      notifierRev: "desktop-ntfy-1",
      target: "plan-approval",
      waitReason: "tool-permission",
      stage: "initial",
      ageMs: 1,
      evidenceTier: "derived",
      transport: "desktop",
      delivery: { status: "sent" },
    };
    const damping = {
      schemaVersion: "sequence-break-damping/v1",
      sessionId: SESSION_ID,
      target: "human-input",
      notifierRev: "desktop-ntfy-1",
      claimedEpochMs: 2,
      expiresEpochMs: 1,
    };

    expect(Result.isFailure(SequenceBreakNotificationV1.decodeResult(notification))).toBe(true);
    expect(Result.isFailure(SequenceBreakDampingV1.decodeResult(damping))).toBe(true);
  });

  it("round-trips schema-derived notification and damping states", () => {
    const encodeNotification = S.encodeResult(SequenceBreakNotificationV1);
    const decodeNotification = S.decodeUnknownResult(SequenceBreakNotificationV1);
    const notificationEquivalent = S.toEquivalence(SequenceBreakNotificationV1);
    const encodeDamping = S.encodeResult(SequenceBreakDampingV1);
    const decodeDamping = S.decodeUnknownResult(SequenceBreakDampingV1);
    const dampingEquivalent = S.toEquivalence(SequenceBreakDampingV1);

    fc.assert(
      fc.property(
        S.toArbitrary(SequenceBreakNotificationV1)(fc),
        S.toArbitrary(SequenceBreakDampingV1)(fc),
        (notification, damping) => {
          const decodedNotification = Result.getOrThrow(
            decodeNotification(Result.getOrThrow(encodeNotification(notification)))
          );
          const decodedDamping = Result.getOrThrow(decodeDamping(Result.getOrThrow(encodeDamping(damping))));

          expect(notificationEquivalent(decodedNotification, notification)).toBe(true);
          expect(dampingEquivalent(decodedDamping, damping)).toBe(true);
        }
      ),
      fcRuns(25)
    );
  });

  it.effect("sends one desktop stage, damps its duplicate, and stops after exact bracket resolution", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const store = yield* makeNotifierStore();
        yield* fs.writeFileString(store.hookPath, `${preToolUseLine()}\n${permissionRequestLine}\n`);

        expectSilentSuccess(yield* runNotifier(store));
        const initial = yield* decodedNotifications(store);
        expect(A.map(initial, ({ delivery, transport }) => `${transport}:${delivery.status}`)).toEqual([
          "desktop:sent",
          "ntfy:skipped",
        ]);
        expect(initial[1]?.delivery).toMatchObject({ status: "skipped", reason: "transport-unconfigured" });

        const damping = yield* SequenceBreakDampingV1.decodeJsonEffect(yield* fs.readFileString(store.dampingPath));
        expect(damping.sessionId).toBe(SESSION_ID);
        expect(damping.target).toBe("human-input");

        expectSilentSuccess(yield* runNotifier(store));
        const damped = yield* decodedNotifications(store);
        expect(A.map(A.takeRight(damped, 2), ({ delivery }) => delivery)).toEqual([
          { status: "skipped", reason: "storm-damped" },
          { status: "skipped", reason: "storm-damped" },
        ]);

        yield* fs.writeFileString(store.hookPath, `${postToolUseLine}\n`, { flag: "a" });
        expectSilentSuccess(yield* runNotifier(store));
        const resolved = yield* decodedNotifications(store);
        expect(A.map(A.takeRight(resolved, 2), ({ delivery }) => delivery)).toEqual([
          { status: "skipped", reason: "bracket-resolved" },
          { status: "skipped", reason: "bracket-resolved" },
        ]);
        expect(A.every(yield* notificationRows(store), (row) => !row.includes(CANARY))).toBe(true);
      })
    )
  );

  it.effect("refuses equal-time same-tool candidates even when one candidate later closes", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const store = yield* makeNotifierStore();
        yield* fs.writeFileString(
          store.hookPath,
          `${preToolUseLine()}\n${preToolUseLine(SESSION_ID, CWD_ID, PRE_TS, AMBIGUOUS_TOOL_USE_ID)}\n${permissionRequestLine}\n${ambiguousPostToolUseLine}\n`
        );

        expectSilentSuccess(yield* runNotifier(store));
        const notifications = yield* decodedNotifications(store);
        expect(A.map(notifications, ({ delivery }) => delivery)).toEqual([
          { status: "skipped", reason: "bracket-unattributed" },
          { status: "skipped", reason: "bracket-unattributed" },
        ]);
        expect(yield* fs.exists(store.dampingPath)).toBe(false);
      })
    )
  );

  it.effect("launches the notifier from the durable PermissionRequest writer path", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const store = yield* makeNotifierStore();
        const rawSessionId = "sequence-break-writer-session";
        const rawCwd = "/workspace/sequence-break-writer";
        const sessionDigest = yield* hashPrivateIdentifier(rawSessionId, O.none());
        const cwdDigest = yield* hashPrivateIdentifier(rawCwd, O.none());
        const preLine = preToolUseLine(sessionDigest, cwdDigest, "2020-01-01T00:00:00.000Z");
        const prePath = store.hookPath.replace(SESSION_ID, sessionDigest);
        yield* fs.writeFileString(prePath, `${preLine}\n`);

        const run = yield* runWriter(
          { ...store, hookPath: prePath },
          yield* encodeJson({
            session_id: rawSessionId,
            cwd: rawCwd,
            transcript_path: "/tmp/sequence-break-writer.jsonl",
            hook_event_name: "PermissionRequest",
            permission_mode: "default",
            tool_name: "AskUserQuestion",
            tool_input: { question: CANARY },
          })
        );
        expectSilentSuccess(run);

        const notifications = yield* decodedNotifications(store);
        expect(A.map(notifications, ({ delivery, transport }) => `${transport}:${delivery.status}`)).toEqual([
          "desktop:sent",
          "ntfy:skipped",
        ]);
        expect(A.every(yield* notificationRows(store), (row) => !row.includes(CANARY))).toBe(true);
      })
    )
  );

  it.effect("routes configured ntfy delivery through the shared network breaker", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const store = yield* makeNotifierStore();
        yield* fs.writeFileString(store.hookPath, `${preToolUseLine()}\n${permissionRequestLine}\n`);

        expectSilentSuccess(yield* runNotifier(store, CANARY));
        const notifications = yield* decodedNotifications(store);
        expect(A.map(notifications, ({ delivery, transport }) => `${transport}:${delivery.status}`)).toEqual([
          "desktop:sent",
          "ntfy:sent",
        ]);

        const breakerEvents = yield* decodedBreakerEvents(store);
        expect(A.map(breakerEvents, ({ outcome, probe }) => `${probe}:${outcome.status}`)).toEqual([
          "network:probe-succeeded",
        ]);
        expect(A.every(yield* notificationRows(store), (row) => !row.includes(CANARY))).toBe(true);
        expect(A.every(yield* breakerEventRows(store), (row) => !row.includes(CANARY))).toBe(true);
      })
    )
  );

  it.effect("keeps ntfy secrets out of child environments while delivering the token by descriptor", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const store = yield* makeNotifierStore();
        const fakeCurl = `${store.fakeBin}/curl`;
        yield* fs.writeFileString(store.hookPath, `${preToolUseLine()}\n${permissionRequestLine}\n`);
        yield* fs.writeFileString(
          fakeCurl,
          `#!/usr/bin/env bash
if [ -n "\${BEEP_SEQUENCE_BREAK_NTFY_TOPIC:-}\${BEEP_SEQUENCE_BREAK_NTFY_TOKEN:-}" ]; then
  exit 97
fi
case " $* " in
  *" --request POST "*)
    header_path=""
    for argument in "$@"; do
      case "\${argument}" in @/dev/fd/*) header_path="\${argument#@}" ;; esac
    done
    [ -n "\${header_path}" ] || exit 98
    IFS= read -r header <"\${header_path}" || exit 99
    [ "\${header}" = "Authorization: Bearer private-token" ] || exit 100
    ;;
esac
cat >/dev/null
exit 0
`
        );
        yield* fs.chmod(fakeCurl, 0o755);

        expectSilentSuccess(yield* runNotifier(store, "private-topic", "private-token"));
        const notifications = yield* decodedNotifications(store);
        expect(A.map(notifications, ({ delivery, transport }) => `${transport}:${delivery.status}`)).toEqual([
          "desktop:sent",
          "ntfy:sent",
        ]);
      })
    )
  );

  it.effect("honors a disarm raised during the network probe before phone delivery", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const store = yield* makeNotifierStore();
        const curlCallsPath = path.join(store.evidenceRoot, "curl-calls");
        const fakeCurl = path.join(store.fakeBin, "curl");
        yield* fs.writeFileString(store.hookPath, `${preToolUseLine()}\n${permissionRequestLine}\n`);
        yield* fs.writeFileString(
          fakeCurl,
          `#!/usr/bin/env bash
case " $* " in
  *" --request POST "*) printf 'post\\n' >>"${curlCallsPath}"; cat >/dev/null ;;
  *) printf 'disarmed\\n' >"${hookPulseDisarmSentinelPath(store.evidenceRoot)}" ;;
esac
exit 0
`
        );
        yield* fs.chmod(fakeCurl, 0o755);

        expectSilentSuccess(yield* runNotifier(store, CANARY));
        const notifications = yield* decodedNotifications(store);
        expect(A.map(notifications, ({ delivery, transport }) => `${transport}:${delivery.status}`)).toEqual([
          "desktop:sent",
        ]);
        expect(yield* fs.exists(curlCallsPath)).toBe(false);
        expect(yield* fs.exists(hookPulseDisarmSentinelPath(store.evidenceRoot))).toBe(true);
      })
    )
  );

  it.effect("creates neither delivery nor damping state while the shared instrument is disarmed", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const store = yield* makeNotifierStore();
        yield* fs.writeFileString(store.hookPath, `${preToolUseLine()}\n${permissionRequestLine}\n`);
        yield* fs.writeFileString(hookPulseDisarmSentinelPath(store.evidenceRoot), "disarmed\n");

        expectSilentSuccess(yield* runNotifier(store));
        expect(yield* notificationRows(store)).toEqual([]);
        expect(yield* fs.exists(store.dampingPath)).toBe(false);
      })
    )
  );
});
