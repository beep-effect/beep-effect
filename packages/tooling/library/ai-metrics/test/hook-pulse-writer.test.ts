import {
  agentEvidenceRoot,
  HookPulseAgentKind,
  HookPulseEvent,
  HookPulseEvidenceTier,
  HookPulseInstrumentClass,
  HookPulseNotificationType,
  HookPulseSchemaVersion,
  HookPulseV1,
  HookPulseWaitReason,
  hookPulseLedgerDir,
} from "@beep/repo-ai-metrics";
import { NodeServices } from "@effect/platform-node";
import { expect, layer } from "@effect/vitest";
import { Effect, FileSystem, Path } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";

// The writer is shell, so the only honest conformance test spawns the real
// script and decodes what it wrote. `HookPulseV1` carries the
// `HookPulseWaitReasonInvariant` filter, so a jq derivation that ever drifts
// from the TypeScript `deriveWaitReason` fails the decode rather than silently
// producing a wrong ledger.
const repoRoot = new URL("../../../../../", import.meta.url).pathname;
const writerPath = `${repoRoot}.claude/hooks/hook-pulse.sh`;

// A distinctive marker planted in every content-bearing raw key measured by the
// P1 spike. Amendment 6 is only actually enforced if this never reaches disk.
const CANARY = "CANARY-SECRET-VALUE";

const decodeHookPulseRow = S.decodeUnknownEffect(S.fromJsonString(HookPulseV1));
const decodeRowKeys = S.decodeUnknownSync(S.fromJsonString(S.Record(S.String, S.Unknown)));
// Fixture payloads are raw harness shapes, not a schema this package owns, so the
// unknown-shaped encoder is the right rung: it renders stdin without pretending the
// content-bearing keys we deliberately never model are part of the contract.
const encodeJson = S.encodeUnknownSync(S.UnknownFromJsonString);

// Exactly the canonical `HookPulseV1` encoded surface. Any other key on a row is
// a leak or a drift, whichever it turns out to be.
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

interface WriterRun {
  readonly exitCode: number;
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
  options: { readonly disarmSentinel?: string; readonly viaXdgFallback?: boolean } = {}
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const stateHome = yield* fs.makeTempDirectoryScoped({ prefix: "beep-hook-pulse-" });
  const evidenceRoot = agentEvidenceRoot(stateHome);
  const storeDir = hookPulseLedgerDir(evidenceRoot);

  if (O.isSome(O.fromUndefinedOr(options.disarmSentinel))) {
    yield* fs.makeDirectory(evidenceRoot, { recursive: true });
    yield* fs.writeFileString(path.join(evidenceRoot, "hook-pulse.disarmed"), `${options.disarmSentinel}\n`);
  }

  const child = Bun.spawn([writerPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      HOME: stateHome,
      XDG_STATE_HOME: stateHome,
      // Empty values fall through to the writer's own `:-` defaults, so ambient
      // developer configuration cannot change what this test asserts. Clearing
      // BEEP_AGENT_EVIDENCE_ROOT exercises the XDG_STATE_HOME fallback rung of
      // the precedence chain and must resolve to the same place.
      BEEP_AGENT_EVIDENCE_ROOT: options.viaXdgFallback === true ? "" : evidenceRoot,
      BEEP_HOOK_PULSE_DISARM_SENTINEL: "",
      BEEP_HOOK_PULSE_NOTIFIER_REV: "",
      BEEP_HOOK_PULSE_INSTRUMENT_CLASS: "",
    },
    stdin: new TextEncoder().encode(stdin),
    stdout: "pipe",
    stderr: "pipe",
  });

  const exitCode = yield* Effect.promise(() => child.exited);
  const stderr = yield* Effect.promise(() => new Response(child.stderr).text());
  const stdout = yield* Effect.promise(() => new Response(child.stdout).text());

  const storeExists = yield* fs.exists(storeDir);
  const rows = storeExists
    ? yield* Effect.map(
        Effect.forEach(yield* fs.readDirectory(storeDir), (entry) =>
          Effect.map(fs.readFileString(path.join(storeDir, entry)), (contents) =>
            A.filter(contents.split("\n"), (line) => line.length > 0)
          )
        ),
        A.flatten
      )
    : A.empty<string>();

  return { exitCode, stderr, stdout, rows };
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

const notificationPayload = (notificationType: O.Option<string>) => ({
  ...baseFields,
  hook_event_name: HookPulseEvent.Enum.Notification,
  message: CANARY,
  ...O.match(notificationType, {
    onNone: () => ({}),
    onSome: (value) => ({ notification_type: value }),
  }),
});

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
  { label: "PreToolUse", payload: preToolUsePayload, waitReason: HookPulseWaitReason.Enum.none },
  {
    label: "PermissionRequest{ExitPlanMode}",
    payload: permissionRequestPlanPayload,
    waitReason: HookPulseWaitReason.Enum["plan-approval"],
  },
  {
    label: "PermissionRequest{Bash}",
    payload: permissionRequestToolPayload,
    waitReason: HookPulseWaitReason.Enum["tool-permission"],
  },
  {
    label: "PermissionRequest{no tool_name}",
    payload: permissionRequestToollessPayload,
    waitReason: HookPulseWaitReason.Enum.unknown,
  },
  { label: "PostToolUse", payload: postToolUsePayload, waitReason: HookPulseWaitReason.Enum.none },
  {
    label: "PostToolUseFailure{is_interrupt: true}",
    payload: postToolUseFailurePayload(true),
    waitReason: HookPulseWaitReason.Enum.none,
  },
  {
    label: "PostToolUseFailure{is_interrupt: false}",
    payload: postToolUseFailurePayload(false),
    waitReason: HookPulseWaitReason.Enum.none,
  },
  {
    label: "Notification{idle_prompt}",
    payload: notificationPayload(O.some(HookPulseNotificationType.Enum.idle_prompt)),
    waitReason: HookPulseWaitReason.Enum["idle-input"],
  },
  {
    label: "Notification{permission_prompt}",
    payload: notificationPayload(O.some(HookPulseNotificationType.Enum.permission_prompt)),
    waitReason: HookPulseWaitReason.Enum.unknown,
  },
  {
    label: "Notification{unrecognized notification_type}",
    payload: notificationPayload(O.some("some_future_notification")),
    waitReason: HookPulseWaitReason.Enum.unknown,
  },
  {
    label: "Notification{absent notification_type}",
    payload: notificationPayload(O.none()),
    waitReason: HookPulseWaitReason.Enum.unknown,
  },
  { label: "UserPromptSubmit", payload: userPromptSubmitPayload, waitReason: HookPulseWaitReason.Enum.none },
  { label: "Stop", payload: stopPayload, waitReason: HookPulseWaitReason.Enum.none },
  { label: "SessionEnd", payload: sessionEndPayload, waitReason: HookPulseWaitReason.Enum.none },
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

layer(NodeServices.layer)("hook-pulse writer conformance", (it) => {
  A.forEach(measuredPayloads, ({ label, payload, waitReason }) => {
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
          expect(decoded.sessionId).toBe(session);
          expect(decoded.cwd).toBe(baseFields.cwd);
          expect(decoded.notifierRev).toBe("log-only-0");
          expect(decoded.waitReason).toBe(waitReason);
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
          expect(A.difference(R.keys(decodeRowKeys(row)), canonicalRowKeys)).toEqual([]);
        })
      )
    );
  });

  it.effect("omits notificationType when the raw value is outside the enum", () =>
    Effect.scoped(
      Effect.gen(function* () {
        const run = yield* runWriter(encodeJson(notificationPayload(O.some("some_future_notification"))));
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
        const run = yield* runWriter(
          encodeJson(notificationPayload(O.some(HookPulseNotificationType.Enum.permission_prompt)))
        );
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
        const decodedEnd = yield* decodeHookPulseRow(expectSingleRow(ended));
        const decodedStop = yield* decodeHookPulseRow(expectSingleRow(stopped));

        expect(decodedEnd.sessionEndReason).toEqual(O.some("prompt_input_exit"));
        expect(decodedStop.sessionEndReason).toEqual(O.none());
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

        expect(run.exitCode).toBe(0);
        expect(run.rows).toEqual([]);
      })
    )
  );

  A.forEach(
    [
      { label: "unparseable stdin", stdin: "not json at all {{{" },
      { label: "empty stdin", stdin: "" },
      { label: "a payload with no session_id", stdin: encodeJson({ ...stopPayload, session_id: undefined }) },
      {
        label: "a payload with an unknown hook_event_name",
        stdin: encodeJson({ ...stopPayload, hook_event_name: "SomeFutureEvent" }),
      },
    ],
    ({ label, stdin }) => {
      it.effect(`writes no partial line for ${label}`, () =>
        Effect.scoped(
          Effect.gen(function* () {
            const run = yield* runWriter(stdin);

            expect(run.exitCode).toBe(0);
            expect(run.rows).toEqual([]);
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
        const run = yield* runWriter(encodeJson(permissionRequestPlanPayload), { viaXdgFallback: true });
        const decoded = yield* decodeHookPulseRow(expectSingleRow(run));

        expect(decoded.waitReason).toBe(HookPulseWaitReason.Enum["plan-approval"]);
      })
    )
  );
});
