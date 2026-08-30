import { fileURLToPath } from "node:url";
import { parseProcStatStartTime } from "@beep/repo-cli/commands/Worktree";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { NodeServices } from "@effect/platform-node";
import { Effect, FileSystem, Layer, Path, Stream } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { ChildProcess } from "effect/unstable/process";
import { describe, expect, it } from "vitest";
import type * as PlatformError from "effect/PlatformError";

const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const hookPath = `${repoRoot}.claude/hooks/yeet-inbox.sh`;

const JsonObject = S.fromJsonString(S.Record(S.String, S.Unknown));
const decodeObject = S.decodeUnknownSync(JsonObject);
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
    "fences a live non-owner and CAS-takes over a dead published-PR owner without inbox evidence",
    () =>
      withInbox(({ ack, root }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const leasePath = path.join(root, ".beep", "inbox", "pr-lease.json");
          const liveOtherStat = yield* fs.readFileString("/proc/1/stat");
          const liveOtherStart = O.getOrThrow(parseProcStatStartTime(liveOtherStat));
          const lease = (pid: number, procStart: string, sessionId: string, generationId: string) => ({
            schemaVersion: "yeet-pr-lease/v1",
            generationId,
            sessionId,
            pid,
            procStart,
            checkoutRoot: root,
            branch: "feature/lease",
            headSha: "abc123",
            prNumber: 900,
            acquiredAt: "2026-08-27T00:00:00Z",
            refreshedAt: "2026-08-27T00:00:00Z",
          });

          const liveLease = yield* encodeUnknown(lease(1, liveOtherStart, "other", "live"));
          yield* fs.writeFileString(leasePath, `${liveLease}\n`);
          const fenced = decodeObject(
            (yield* runHook(root, "codex", {
              cwd: root,
              hook_event_name: "PreToolUse",
              session_id: "zombie",
              tool_input: { command: "git commit -m zombie" },
              tool_name: "Bash",
            })).stdout
          );
          expect(fenced).toMatchObject({
            hookSpecificOutput: { permissionDecision: "deny" },
          });
          expect(fenced).toHaveProperty(
            "hookSpecificOutput.permissionDecisionReason",
            expect.stringContaining("lost lease generation live")
          );
          const shellWrite = decodeObject(
            (yield* runHook(root, "codex", {
              cwd: root,
              hook_event_name: "PreToolUse",
              session_id: "zombie",
              tool_input: { command: "cp source.ts target.ts" },
              tool_name: "Bash",
            })).stdout
          );
          expect(shellWrite).toMatchObject({
            hookSpecificOutput: { permissionDecision: "deny" },
          });
          expect(shellWrite).toHaveProperty(
            "hookSpecificOutput.permissionDecisionReason",
            expect.stringContaining("lost lease generation live")
          );

          yield* ack("coverage-live");
          yield* ack("thread-live");
          yield* ack("drift-live");
          const deadLease = yield* encodeUnknown(lease(999_999, "dead", "gone", "dead-owner"));
          yield* fs.writeFileString(leasePath, `${deadLease}\n`);
          const takeover = yield* runHook(root, "claude", {
            cwd: root,
            hook_event_name: "SessionStart",
            session_id: "warm-fixer",
          });
          const updated = decodeObject(yield* fs.readFileString(leasePath));
          expect(takeover).toMatchObject({ exitCode: 0, stderr: "", stdout: "" });
          expect(updated).toMatchObject({
            sessionId: "claude:warm-fixer",
            takeoverOf: "dead-owner",
            takeoverReason: "stale-dead-or-frozen",
          });
        })
      ).pipe(provideTestLayer),
    15_000
  );

  itEffect(
    "applies a generation-fenced retirement request before fencing a repair session",
    () =>
      withInbox(({ ack, root }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const inbox = path.join(root, ".beep", "inbox");
          const leasePath = path.join(inbox, "pr-lease.json");
          const retirementQueue = path.join(inbox, "pr-lease-retirements");
          const liveOtherStat = yield* fs.readFileString("/proc/1/stat");
          const liveOtherStart = O.getOrThrow(parseProcStatStartTime(liveOtherStat));
          const lease = yield* encodeUnknown({
            schemaVersion: "yeet-pr-lease/v1",
            generationId: "retirement-requested",
            sessionId: "codex:still-live-owner",
            pid: 1,
            procStart: liveOtherStart,
            checkoutRoot: root,
            branch: "feature/lease",
            headSha: "abc123",
            prNumber: 900,
            acquiredAt: "2026-08-27T00:00:00Z",
            refreshedAt: "2026-08-27T00:00:00Z",
            status: "active",
          });
          const retirementRequest = yield* encodeUnknown({
            schemaVersion: "yeet-pr-lease-retirement/v1",
            generationId: "retirement-requested",
            headSha: "abc123",
            prNumber: 900,
            reason: "start-pr-early-failed",
            requestedAt: "2026-08-27T00:00:01Z",
          });
          yield* Effect.all([
            fs.writeFileString(leasePath, `${lease}\n`),
            fs.makeDirectory(retirementQueue, { recursive: true }),
            ack("coverage-live"),
            ack("thread-live"),
            ack("drift-live"),
          ]);
          yield* fs.writeFileString(path.join(retirementQueue, "request.json"), `${retirementRequest}\n`);

          const result = yield* runHook(root, "codex", {
            cwd: root,
            hook_event_name: "PreToolUse",
            session_id: "repair-session",
            tool_input: { command: "git commit -m repair" },
            tool_name: "Bash",
          });

          expect(result).toMatchObject({ exitCode: 0, stderr: "", stdout: "" });
          expect(decodeObject(yield* fs.readFileString(leasePath))).toMatchObject({
            generationId: "retirement-requested",
            status: "retired",
            retireReason: "requested:start-pr-early-failed",
          });
          expect(yield* fs.readDirectory(retirementQueue)).toEqual([]);
        })
      ).pipe(provideTestLayer),
    15_000
  );

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
          expect(second.stdout).toBe("");
        })
      ).pipe(provideTestLayer),
    15_000
  );

  itEffect(
    "fails closed for non-owner mutation while an active lease mutex is contended",
    () =>
      withInbox(({ root }) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const inbox = path.join(root, ".beep", "inbox");
          const stat = yield* fs.readFileString("/proc/1/stat");
          const procStart = O.getOrThrow(parseProcStatStartTime(stat));
          const lease = yield* encodeUnknown({
            schemaVersion: "yeet-pr-lease/v1",
            generationId: "busy-active",
            sessionId: "codex:owner",
            pid: 1,
            procStart,
            checkoutRoot: root,
            branch: "feature/lease",
            headSha: "abc123",
            prNumber: 900,
            acquiredAt: "2026-08-27T00:00:00Z",
            refreshedAt: "2026-08-27T00:00:00Z",
            status: "active",
          });
          yield* fs.writeFileString(path.join(inbox, "pr-lease.json"), `${lease}\n`);
          const holder = yield* ChildProcess.make("flock", [path.join(inbox, "hook-mutex.lock"), "sleep", "5"], {
            cwd: root,
            stdin: "ignore",
            stdout: "ignore",
            stderr: "ignore",
          });
          yield* Effect.sleep("100 millis");

          const result = decodeObject(
            (yield* runHook(root, "codex", {
              cwd: root,
              hook_event_name: "PreToolUse",
              session_id: "zombie",
              tool_input: { command: "git commit -m zombie" },
              tool_name: "Bash",
            })).stdout
          );
          expect(result).toMatchObject({
            hookSpecificOutput: { permissionDecision: "deny" },
          });
          expect(result).toHaveProperty(
            "hookSpecificOutput.permissionDecisionReason",
            expect.stringContaining("mutex is busy")
          );
          const stop = decodeObject(
            (yield* runHook(root, "codex", {
              cwd: root,
              hook_event_name: "Stop",
              session_id: "owner",
            })).stdout
          );
          expect(stop).toMatchObject({ decision: "block" });
          yield* holder.kill({ forceKillAfter: "100 millis" }).pipe(Effect.ignore);
        })
      ).pipe(provideTestLayer),
    15_000
  );

  itEffect(
    "denies the first P0 tool, permits repair, rearms on unrelated work, and blocks stop",
    () =>
      withInbox(({ ack, root }) =>
        Effect.gen(function* () {
          const payload = {
            cwd: root,
            hook_event_name: "PreToolUse",
            session_id: "repair-session",
            tool_input: { command: "bun run test" },
            tool_name: "Bash",
          };
          const first = decodeObject(
            (yield* runHookUntil(root, "codex", payload, (result) => result.stdout !== "")).stdout
          );
          const second = decodeObject((yield* runHook(root, "codex", payload)).stdout);
          const unrelated = decodeObject(
            (yield* runHook(root, "codex", {
              ...payload,
              tool_input: { command: "git switch -c unrelated" },
            })).stdout
          );
          const stop = decodeObject(
            (yield* runHook(root, "codex", {
              cwd: root,
              hook_event_name: "Stop",
              session_id: "repair-session",
            })).stdout
          );

          expect(first).toMatchObject({
            hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny" },
          });
          expect(second).toMatchObject({
            hookSpecificOutput: { hookEventName: "PreToolUse" },
          });
          expect(second).not.toHaveProperty("hookSpecificOutput.permissionDecision");
          expect(unrelated).toMatchObject({
            hookSpecificOutput: { hookEventName: "PreToolUse", permissionDecision: "deny" },
          });
          expect(stop).toMatchObject({ decision: "block" });

          yield* ack("coverage-live");
          const clearStop = decodeObject(
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
          const expiredStop = decodeObject(
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

          const stop = decodeObject(
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
