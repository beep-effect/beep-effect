import { fileURLToPath } from "node:url";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, Stream } from "effect";
import * as A from "effect/Array";
import { ChildProcess } from "effect/process";
import * as S from "effect/Schema";
import type * as PlatformError from "effect/PlatformError";

const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const hookPath = `${repoRoot}.claude/hooks/yeet-inbox.sh`;
const environmentOnlyAckForm = '--environment-only --reason "<text>"';
const wontfixAckForm = '--wontfix --reason "<text>"';

const JsonObject = S.fromJsonString(S.Record(S.String, S.Unknown));
const decodeObject = S.decodeUnknownEffect(JsonObject);
const encodeUnknown = UnknownFromJsonString.encodeUnknownEffect;
const itEffect = <E>(name: string, program: () => Effect.Effect<unknown, E>, timeout?: number): void =>
  it(name, () => Effect.runPromise(program()), timeout);

interface HookResult {
  readonly exitCode: number;
  readonly stderr: string;
  readonly stdout: string;
}

const runHook = Effect.fn("YeetInboxHookAdapterTest.runHook")(function* (
  root: string,
  harness: "claude" | "codex" | "grok",
  payload: object,
  env: Readonly<Record<string, string>> = {}
) {
  const payloadJson = yield* encodeUnknown(payload);
  const handle = yield* ChildProcess.make(hookPath, [harness], {
    cwd: root,
    env: { ...env, BEEP_YEET_HOOK_ROOT: root },
    extendEnv: true,
    stdin: {
      stream: Stream.encodeText(Stream.make(payloadJson)),
      endOnDone: true,
    },
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

  return { exitCode, stderr, stdout } satisfies HookResult;
});

const runHookUntil = Effect.fn("YeetInboxHookAdapterTest.runHookUntil")(function* (
  root: string,
  harness: "claude" | "codex" | "grok",
  payload: object,
  accept: (result: HookResult) => boolean
) {
  let result = yield* runHook(root, harness, payload);
  for (let attempt = 0; attempt < 20 && !accept(result); attempt += 1) {
    yield* Effect.sleep("250 millis");
    result = yield* runHook(root, harness, payload);
  }
  return result;
});

const withInbox = Effect.fn("YeetInboxHookAdapterTest.withInbox")(function* <Value, Failure, Requirements>(
  use: (fixture: {
    readonly ack: (id: string, contents?: string) => Effect.Effect<void, PlatformError.PlatformError>;
    readonly root: string;
  }) => Effect.Effect<Value, Failure, Requirements>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectory({ prefix: "beep-yeet-hook-" });
  const inbox = path.join(root, ".beep", "inbox");
  const acks = path.join(inbox, "acks");
  yield* fs.makeDirectory(path.join(root, ".git"), { recursive: true });
  yield* fs.makeDirectory(acks, { recursive: true });

  const rows = [
    {
      schemaVersion: "yeet-inbox/v1",
      kind: "check-failed",
      id: "coverage-live",
      severity: "P0",
      checkout: root,
      ts: "2026-08-27T00:00:00Z",
      capsule: {
        bucket: "fail",
        headSha: "abc123",
        lane: "Check / Coverage",
        link: "https://github.com/beep/beep/actions/runs/1/job/2",
        observedAt: "2026-08-27T00:00:00Z",
        prNumber: 900,
        state: "FAILURE",
        workflow: "Check",
      },
    },
    {
      schemaVersion: "yeet-inbox/v1",
      kind: "review-thread",
      id: "thread-live",
      severity: "P1",
      checkout: root,
      ts: "2026-08-27T00:00:01Z",
      capsule: {
        headSha: "abc123",
        prNumber: 900,
        threadId: "thread-1",
        link: "https://github.com/beep/beep/pull/900#discussion_r1",
      },
    },
    {
      schemaVersion: "yeet-inbox/v1",
      kind: "base-drift",
      id: "drift-live",
      severity: "P2",
      checkout: root,
      ts: "2026-08-27T00:00:02Z",
      capsule: {
        base: "origin/main",
        headSha: "abc123",
        prNumber: 900,
      },
    },
    {
      schemaVersion: "yeet-inbox/v1",
      kind: "check-failed",
      id: "lint-stale",
      severity: "P0",
      checkout: root,
      ts: "2026-08-26T00:00:00Z",
      capsule: {
        bucket: "fail",
        headSha: "old456",
        lane: "Check / Lint",
        link: null,
        observedAt: "2026-08-26T00:00:00Z",
        prNumber: 899,
        state: "FAILURE",
        workflow: "Check",
      },
    },
  ];

  const encodedRows = yield* Effect.forEach(rows, (row) => encodeUnknown(row));
  yield* fs.writeFileString(path.join(inbox, "failures.ndjson"), `${A.join(encodedRows, "\n")}\n`);
  const encodedDispatch = yield* encodeUnknown({
    schemaVersion: "yeet-dispatch/v1",
    capsuleIds: ["coverage-live"],
    headSha: "abc123",
    prNumber: 900,
    sessionStartedAt: "2026-08-27T00:00:00Z",
    updatedAt: "2026-08-27T00:00:00Z",
  });
  yield* fs.writeFileString(path.join(inbox, "dispatch.json"), encodedDispatch);

  return yield* use({
    ack: (id, contents = "{}\n") => fs.writeFileString(path.join(acks, id), contents),
    root,
  }).pipe(Effect.ensuring(fs.remove(root, { recursive: true }).pipe(Effect.orDie)));
});

const TestLayer = NodeServices.layer;
const provideTestLayer = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.scoped(Layer.build(TestLayer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

describe("Yeet inbox harness adapter", () => {
  itEffect(
    "injects each severity at the intended Claude session boundary and deduplicates it",
    () =>
      withInbox(({ root }) =>
        Effect.gen(function* () {
          const payload = { cwd: root, hook_event_name: "SessionStart", session_id: "session-start" };
          const first = yield* runHookUntil(root, "claude", payload, (result) => result.stdout !== "");
          const second = yield* runHook(root, "claude", payload);

          expect(first.exitCode).toBe(0);
          expect(first.stderr).toBe("");
          expect(first.stdout).toContain("P0 Check / Coverage [coverage-live]");
          expect(first.stdout).toContain("P1 thread-1 [thread-live]");
          expect(first.stdout).toContain("P2 origin/main [drift-live]");
          expect(first.stdout).not.toContain("lint-stale");
          expect(yield* decodeObject(first.stdout)).toMatchObject({
            hookSpecificOutput: { additionalContext: expect.stringContaining(wontfixAckForm) },
          });
          expect(second.stdout).toBe("");
        })
      ).pipe(provideTestLayer),
    15_000
  );

  itEffect(
    "keeps every P0 PreToolUse path context-only and blocks Stop until acknowledgement",
    () =>
      withInbox(({ ack, root }) =>
        Effect.gen(function* () {
          for (const toolName of ["Read", "Skill", "EnterPlanMode", "ToolSearch", "mcp__x__y"]) {
            const available = yield* decodeObject(
              (yield* runHook(root, "codex", {
                cwd: root,
                hook_event_name: "PreToolUse",
                session_id: "repair-session",
                tool_input: {},
                tool_name: toolName,
              })).stdout
            );
            expect(available).toMatchObject({
              hookSpecificOutput: { additionalContext: expect.stringContaining("coverage-live") },
            });
            expect(available).not.toHaveProperty("hookSpecificOutput.permissionDecision");
          }

          for (const toolName of ["Bash", "Write", "Edit", "NotebookEdit", "MultiEdit", "apply_patch"]) {
            const payload = {
              cwd: root,
              hook_event_name: "PreToolUse",
              session_id: `repair-${toolName}`,
              tool_input: { command: "bun run test" },
              tool_name: toolName,
            };
            const first = yield* decodeObject((yield* runHook(root, "codex", payload)).stdout);
            const second = yield* decodeObject((yield* runHook(root, "codex", payload)).stdout);
            expect(first).toMatchObject({
              hookSpecificOutput: {
                hookEventName: "PreToolUse",
                additionalContext: expect.stringContaining("[p0-attention]"),
              },
            });
            expect(first).not.toHaveProperty("hookSpecificOutput.permissionDecision");
            expect(second).toMatchObject({
              hookSpecificOutput: {
                hookEventName: "PreToolUse",
                additionalContext: expect.stringContaining("coverage-live"),
              },
            });
            expect(second).not.toHaveProperty("hookSpecificOutput.permissionDecision");
          }

          for (const [index, newWorkInput] of [
            { toolInput: { command: "git switch -c unrelated" }, toolName: "Bash" },
            { toolInput: {}, toolName: "Agent" },
            { toolInput: {}, toolName: "Task" },
            { toolInput: {}, toolName: "spawn_agent" },
          ].entries()) {
            const sessionId = `new-work-${index}`;
            const newWorkResult = yield* decodeObject(
              (yield* runHook(root, "codex", {
                cwd: root,
                hook_event_name: "PreToolUse",
                session_id: sessionId,
                tool_input: newWorkInput.toolInput,
                tool_name: newWorkInput.toolName,
              })).stdout
            );
            expect(newWorkResult).toMatchObject({
              hookSpecificOutput: {
                hookEventName: "PreToolUse",
                additionalContext: expect.stringContaining("[p0-new-work]"),
              },
            });
            expect(newWorkResult).not.toHaveProperty("hookSpecificOutput.permissionDecision");

            const repair = yield* decodeObject(
              (yield* runHook(root, "codex", {
                cwd: root,
                hook_event_name: "PreToolUse",
                session_id: sessionId,
                tool_input: { command: "bun run test" },
                tool_name: "Bash",
              })).stdout
            );
            expect(repair).toMatchObject({
              hookSpecificOutput: {
                hookEventName: "PreToolUse",
                additionalContext: expect.stringContaining("coverage-live"),
              },
            });
            expect(repair).not.toHaveProperty("hookSpecificOutput.permissionDecision");
          }

          const stop = yield* decodeObject(
            (yield* runHook(root, "codex", {
              cwd: root,
              hook_event_name: "Stop",
              session_id: "repair-session",
            })).stdout
          );

          expect(stop).toMatchObject({
            decision: "block",
            reason: expect.stringContaining(wontfixAckForm),
          });
          expect(stop).toMatchObject({
            reason: expect.stringContaining(environmentOnlyAckForm),
          });

          yield* ack("coverage-live");
          const clearStop = yield* decodeObject(
            (yield* runHook(root, "codex", {
              cwd: root,
              hook_event_name: "Stop",
              session_id: "repair-session",
            })).stdout
          );
          expect(clearStop).toStrictEqual({});

          const expiredAck = yield* encodeUnknown({
            schemaVersion: "yeet-ack/v1",
            id: "coverage-live",
            ackedAt: "2000-01-01T00:00:00Z",
            resolution: {
              kind: "waive",
              actor: "operator",
              expiresAt: "2000-01-01T01:00:00Z",
              reason: "temporary outage",
              shard: "Coverage",
            },
          });
          yield* ack("coverage-live", expiredAck);
          const expiredStop = yield* decodeObject(
            (yield* runHook(root, "codex", {
              cwd: root,
              hook_event_name: "Stop",
              session_id: "repair-session",
            })).stdout
          );
          expect(expiredStop).toMatchObject({ decision: "block" });
        })
      ).pipe(provideTestLayer),
    15_000
  );

  itEffect(
    "honors an active waiver with BSD date semantics",
    () =>
      withInbox(({ ack, root }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const bin = path.join(root, "bin");
          yield* fs.makeDirectory(bin);
          const datePath = path.join(bin, "date");
          yield* fs.writeFileString(
            datePath,
            `#!/usr/bin/env bash
case "$*" in
  *" -d "*) exit 1 ;;
  *" -j "*) printf '200' ;;
  *"+%s"*) printf '100' ;;
  *) exec /usr/bin/date "$@" ;;
esac
`
          );
          yield* fs.chmod(datePath, 0o755);
          const waiver = yield* encodeUnknown({
            schemaVersion: "yeet-ack/v1",
            id: "coverage-live",
            ackedAt: "2026-08-27T00:00:00Z",
            resolution: {
              kind: "waive",
              actor: "operator",
              expiresAt: "2026-08-27T01:00:00Z",
              reason: "temporary outage",
              shard: "Coverage",
            },
          });
          yield* ack("coverage-live", waiver);

          const stop = yield* decodeObject(
            (yield* runHook(
              root,
              "codex",
              { cwd: root, hook_event_name: "Stop", session_id: "bsd-date" },
              { PATH: `${bin}:${Bun.env.PATH ?? ""}` }
            )).stdout
          );
          expect(stop).toStrictEqual({});
        })
      ).pipe(provideTestLayer),
    15_000
  );

  itEffect(
    "renders a liveness-filtered Grok tail",
    () =>
      withInbox(({ root }) =>
        Effect.gen(function* () {
          const result = yield* runHookUntil(
            root,
            "grok",
            {
              cwd: root,
              hook_event_name: "GrokTail",
              session_id: "grok-monitor",
            },
            (observed) => observed.stdout.includes("coverage-live")
          );

          expect(result.exitCode).toBe(0);
          expect(result.stdout).toContain("[yeet] inbox");
          expect(result.stdout).toContain("coverage-live");
          expect(result.stdout).toContain("thread-live");
          expect(result.stdout).toContain("drift-live");
          expect(result.stdout).not.toContain("lint-stale");
        })
      ).pipe(provideTestLayer),
    15_000
  );
});

itEffect("renders merge-ready as good news with a PR ack and no denial", () =>
  withInbox(({ root }) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const row = yield* encodeUnknown({
        schemaVersion: "yeet-inbox/v1",
        kind: "pr-merge-ready",
        id: "ready-7-head",
        severity: "P1",
        checkout: root,
        ts: "2026-09-16T00:00:00Z",
        capsule: {
          prNumber: 7,
          headSha: "head",
          url: "https://github.com/beep/repo/pull/7",
          readyAt: "2026-09-16T00:00:00Z",
          pushedAt: null,
          settledAt: null,
          closeoutAt: null,
          pushToReadyMs: null,
        },
      });
      yield* fs.writeFileString(`${root}/.beep/inbox/failures.ndjson`, `${row}\n`);
      yield* fs.remove(`${root}/.beep/inbox/dispatch.json`);
      const result = yield* runHook(root, "codex", {
        cwd: root,
        hook_event_name: "PreToolUse",
        session_id: "ready-test",
        tool_name: "Read",
        tool_input: {},
      });
      expect(result.exitCode).toBe(0);
      const output = yield* decodeObject(result.stdout);
      expect(output).toMatchObject({
        hookSpecificOutput: { additionalContext: expect.stringContaining("Good news, not incident work:") },
      });
      expect(result.stdout).toContain("P1 merge-ready [ready-7-head] PR #7");
      expect(result.stdout).toContain("--thread-url https://github.com/beep/repo/pull/7");
      expect(result.stdout).not.toContain("Fix this now");
      expect(output).not.toHaveProperty("hookSpecificOutput.permissionDecision");
    })
  ).pipe(provideTestLayer)
);

itEffect(
  "surfaces P2 jobs at SessionStart and P1 jobs at PreToolUse without denial",
  () =>
    withInbox(
      Effect.fnUntraced(function* ({ root }) {
        const fs = yield* FileSystem.FileSystem;
        const rows = [
          {
            schemaVersion: "yeet-inbox/v1",
            kind: "proof-job-finished",
            id: "proof-job-green",
            severity: "P2",
            checkout: root,
            ts: "2026-09-15T00:00:00Z",
            capsule: { jobId: "green" },
          },
          {
            schemaVersion: "yeet-inbox/v1",
            kind: "proof-job-finished",
            id: "proof-job-red",
            severity: "P1",
            checkout: root,
            ts: "2026-09-15T00:00:00Z",
            capsule: { jobId: "red" },
          },
        ];
        const encoded = yield* Effect.forEach(rows, (row) => encodeUnknown(row));
        yield* fs.writeFileString(`${root}/.beep/inbox/failures.ndjson`, `${A.join(encoded, "\n")}\n`);
        const start = yield* runHookUntil(
          root,
          "claude",
          { cwd: root, hook_event_name: "SessionStart", session_id: "job-start" },
          (result) => result.stdout !== ""
        );
        expect(start.stdout).toContain("P2 green [proof-job-green]");
        expect(start.stdout).toContain("--observed");
        const tool = yield* runHookUntil(
          root,
          "claude",
          { cwd: root, hook_event_name: "PreToolUse", session_id: "job-tool", tool_name: "Read", tool_input: {} },
          (result) => result.stdout !== ""
        );
        expect(tool.exitCode).toBe(0);
        expect(tool.stdout).toContain("P1 red [proof-job-red]");
        expect(tool.stdout).not.toContain("proof-job-green");
        expect(tool.stdout).not.toContain('"deny"');
      })
    ).pipe(provideTestLayer),
  15000
);
