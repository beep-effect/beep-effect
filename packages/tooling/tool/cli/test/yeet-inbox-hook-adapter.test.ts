import { fileURLToPath } from "node:url";
import {
  YeetAckClearedResolution,
  YeetAckReceipt,
  YeetAckReceiptJson,
  YeetHookSessionStateJson,
  YeetInboxObservedRowKind,
  YeetInboxWaveExemptRowKind,
} from "@beep/repo-cli/test/Yeet";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Order, Path, pipe, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import { ChildProcess } from "effect/process";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
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

describe("Yeet inbox hook first-seen stamps", () => {
  itEffect(
    "stamps each row's first injection once and keeps the session file's shape",
    () =>
      withInbox(({ root }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const sessionsDir = path.join(root, ".beep", "inbox", "sessions");
          const sessionFile = Effect.gen(function* () {
            const names = A.filter(yield* fs.readDirectory(sessionsDir), (name) => !Str.startsWith(".")(name));
            expect(names).toHaveLength(1);
            return path.join(sessionsDir, A.getUnsafe(names, 0));
          });
          const readState = Effect.gen(function* () {
            const text = yield* fs.readFileString(yield* sessionFile);
            expect(yield* decodeObject(text)).toMatchObject({ schemaVersion: "yeet-hook-session/v1" });
            return yield* YeetHookSessionStateJson.decode(text);
          });
          const tool = {
            cwd: root,
            hook_event_name: "PreToolUse",
            session_id: "stamp-session",
            tool_input: {},
            tool_name: "Read",
          };

          // A P0 reaches the session at PreToolUse without entering seenIds; its
          // first injection is still stamped.
          yield* runHookUntil(root, "claude", tool, (result) => result.stdout !== "");
          const first = yield* readState;
          expect(first.seenIds).toStrictEqual([]);
          expect(R.keys(first.firstSeenAt)).toStrictEqual(["coverage-live"]);
          const coverageSeen = first.firstSeenAt["coverage-live"];
          expect(coverageSeen).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);

          // A later injection of the same row never moves its stamp.
          yield* Effect.sleep("1100 millis");
          yield* runHook(root, "claude", tool);
          expect((yield* readState).firstSeenAt["coverage-live"]).toBe(coverageSeen);

          // mark_seen stamps only the ids not already stamped.
          yield* runHook(root, "claude", {
            cwd: root,
            hook_event_name: "UserPromptSubmit",
            session_id: "stamp-session",
          });
          const marked = yield* readState;
          expect(marked.seenIds).toStrictEqual(["coverage-live", "thread-live"]);
          expect(marked.firstSeenAt["coverage-live"]).toBe(coverageSeen);
          expect(marked.firstSeenAt["thread-live"] ?? "").not.toBe(coverageSeen);

          // A file written before the map existed gains it additively: seenIds
          // and schemaVersion are kept, nothing is pruned.
          yield* fs.writeFileString(
            yield* sessionFile,
            '{"schemaVersion":"yeet-hook-session/v1","incidentId":null,"seenIds":["coverage-live","thread-live"]}\n'
          );
          yield* runHook(root, "claude", { cwd: root, hook_event_name: "SessionStart", session_id: "stamp-session" });
          const upgraded = yield* readState;
          expect(upgraded.seenIds).toStrictEqual(["coverage-live", "drift-live", "thread-live"]);
          expect(R.keys(upgraded.firstSeenAt)).toStrictEqual(["drift-live"]);
        })
      ).pipe(provideTestLayer),
    15_000
  );
});

const hookExemptMarker = "# yeet-inbox: wave-exempt-kinds (parity-tested)";
const HookExemptKinds = S.String.pipe(S.Array, S.fromJsonString);
const decodeHookExemptKinds = S.decodeUnknownOption(HookExemptKinds);

// The JSON array on the one line under the marker, sorted. Any other shape,
// including a missing marker or a second line, reads as None.
const hookExemptKindsIn = (hookText: string): O.Option<ReadonlyArray<string>> => {
  const lines = Str.split(hookText, "\n");
  return pipe(
    A.findFirstIndex(lines, (line) => line === hookExemptMarker),
    O.flatMap((index) => A.get(lines, index + 1)),
    O.flatMap(Str.match(/^wave_exempt_kinds='(\[.*\])'$/)),
    O.flatMap((match) => O.fromUndefinedOr(match[1])),
    O.flatMap(decodeHookExemptKinds),
    O.map(A.sort(Order.String))
  );
};

const kitExemptKinds = A.sort(
  [...YeetInboxWaveExemptRowKind.Options, ...YeetInboxObservedRowKind.Options],
  Order.String
);

describe("Yeet inbox hook wave-exempt kinds", () => {
  itEffect("carries exactly the wave-exempt and observed kits on its one marked literal line", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const hookText = yield* fs.readFileString(hookPath);
      expect(A.filter(Str.split(hookText, "\n"), (line) => line === hookExemptMarker)).toHaveLength(1);
      expect(hookExemptKindsIn(hookText)).toStrictEqual(O.some(kitExemptKinds));
      // The same parse notices drift on either side: a kind missing from the hook,
      // or a kind the hook carries that no kit has.
      const dropped = Str.replace('"review-thread"', '"review-threads"')(hookText);
      expect(hookExemptKindsIn(dropped)).not.toStrictEqual(O.some(kitExemptKinds));
      const extra = Str.replace('["pr-comment",', '["base-drift","pr-comment",')(hookText);
      expect(hookExemptKindsIn(extra)).not.toStrictEqual(O.some(kitExemptKinds));
    }).pipe(provideTestLayer)
  );

  itEffect(
    "keeps review threads and comments across a push, drops superseded drift and conflicts, and honours a cleared ack",
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-yeet-hook-exempt-" });
        const inbox = path.join(root, ".beep", "inbox");
        yield* fs.makeDirectory(path.join(root, ".git"), { recursive: true });
        yield* fs.makeDirectory(path.join(inbox, "acks"), { recursive: true });
        const onHead = (headSha: string) => ({ headSha, prNumber: 900 });
        const row = (kind: string, id: string, severity: string, capsule: object) => ({
          schemaVersion: "yeet-inbox/v1",
          kind,
          id,
          severity,
          checkout: root,
          ts: "2026-09-25T00:00:00Z",
          capsule,
        });
        const conflict = (headSha: string) => ({
          ...onHead(headSha),
          base: "origin/main",
          link: "https://github.com/beep/beep/pull/900",
          mergeable: "CONFLICTING",
          mergeStateStatus: "DIRTY",
        });
        const rows = [
          row("review-thread", "thread-old", "P1", { ...onHead("old111"), threadId: "PRRT_1", link: null }),
          row("pr-comment", "comment-old", "P1", {
            ...onHead("old111"),
            author: "reviewer",
            link: "https://github.com/beep/beep/pull/900#issuecomment-1",
          }),
          row("base-drift", "drift-old", "P2", { ...onHead("old111"), base: "origin/main" }),
          row("base-conflict", "conflict-old", "P0", conflict("old111")),
          row("base-conflict", "conflict-new", "P0", conflict("new222")),
        ];
        const encodedRows = yield* Effect.forEach(rows, (value) => encodeUnknown(value));
        yield* fs.writeFileString(path.join(inbox, "failures.ndjson"), `${A.join(encodedRows, "\n")}\n`);
        yield* fs.writeFileString(
          path.join(inbox, "dispatch.json"),
          yield* encodeUnknown({
            schemaVersion: "yeet-dispatch/v1",
            capsuleIds: ["conflict-new"],
            headSha: "new222",
            prNumber: 900,
            sessionStartedAt: "2026-09-25T00:00:00Z",
            updatedAt: "2026-09-25T00:00:00Z",
          })
        );

        const started = yield* runHookUntil(
          root,
          "claude",
          { cwd: root, hook_event_name: "SessionStart", session_id: "exempt-session" },
          (result) => result.stdout !== ""
        );
        expect(started.exitCode).toBe(0);
        expect(started.stdout).toContain("[thread-old]");
        // A comment row renders its PR and comment URL through the hook's generic
        // label, with no comment-specific branch in the hook.
        expect(started.stdout).toContain(
          "P1 pr-comment [comment-old] PR #900 https://github.com/beep/beep/pull/900#issuecomment-1"
        );
        expect(started.stdout).toContain("P0 origin/main [conflict-new] PR #900 https://github.com/beep/beep/pull/900");
        expect(started.stdout).not.toContain("drift-old");
        expect(started.stdout).not.toContain("conflict-old");

        const blocked = yield* decodeObject(
          (yield* runHook(root, "claude", { cwd: root, hook_event_name: "Stop", session_id: "exempt-session" })).stdout
        );
        expect(blocked).toMatchObject({ decision: "block", reason: expect.stringContaining("conflict-new") });

        // The monitor's cleared receipt acknowledges the row like any closing move.
        const receipt = YeetAckReceipt.make({
          ackedAt: "2026-09-25T00:05:00Z",
          id: "conflict-new",
          resolution: YeetAckClearedResolution.make({
            headSha: "new222",
            mergeable: "MERGEABLE",
            mergeStateStatus: "CLEAN",
            jobId: O.none(),
            unit: O.none(),
          }),
        });
        yield* fs.writeFileString(
          path.join(inbox, "acks", "conflict-new"),
          `${yield* YeetAckReceiptJson.encode(receipt)}\n`
        );
        const stopped = yield* decodeObject(
          (yield* runHook(root, "claude", { cwd: root, hook_event_name: "Stop", session_id: "exempt-session" })).stdout
        );
        expect(stopped).toStrictEqual({});
      }).pipe(Effect.scoped, provideTestLayer),
    15_000
  );
});
