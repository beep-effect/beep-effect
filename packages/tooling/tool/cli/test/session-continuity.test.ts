import {
  ClaudeContinuityInput,
  ContinuityInput,
  PermissionContinuity,
  PermissionContinuityLive,
  PermissionTuple,
  sessionCommand,
} from "@beep/repo-cli/test/Session";
import { fcRuns } from "@beep/test-utils";
import * as MemoryFileSystem from "@beep/test-utils/MemoryFileSystem";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stdio from "effect/Stdio";
import * as Terminal from "effect/Terminal";

const expected = PermissionTuple.make({ approval: "never", sandbox: "danger-full-access", profile: "disabled" });
const encode = S.encodeEffect(S.fromJsonString(S.Unknown));
const tupleJson = PermissionTuple.pipe(S.fromJsonString);
const encodeContinuityInputJson = S.encodeEffect(S.fromJsonString(ContinuityInput));

const meta = (id = "thread", family = "family") => ({ type: "session_meta", payload: { id, session_id: family } });
const turn = (timestamp: string, sandbox = "danger-full-access", approval = "never", profile = "disabled") => ({
  timestamp,
  type: "turn_context",
  payload: { approval_policy: approval, sandbox_policy: { type: sandbox }, permission_profile: { type: profile } },
});
const at = (second: number) => `2026-10-14T00:00:0${second}Z`;

const fixture = Effect.fn("ContinuityTest.fixture")(function* (
  rollouts: ReadonlyArray<ReadonlyArray<unknown>>,
  configs: ReadonlyArray<string> = [],
  app: unknown = undefined,
  transcript: ReadonlyArray<unknown> = []
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = path.resolve(import.meta.dirname, "../../../../../.beep");
  yield* fs.makeDirectory(directory, { recursive: true });
  const root = yield* fs.makeTempDirectoryScoped({ directory, prefix: "h4-synthetic-" });
  const writeJsonLines = Effect.fnUntraced(function* (name: string, rows: ReadonlyArray<unknown>) {
    const texts = yield* Effect.forEach(rows, (row) => encode(row), { concurrency: 1 });
    yield* fs.writeFileString(path.join(root, name), A.join(texts, "\n"));
    return name;
  });
  const files = yield* Effect.forEach(rollouts, (rows, i) => writeJsonLines(`segment-${i}.jsonl`, rows), {
    concurrency: 1,
  });
  const configFiles = yield* Effect.forEach(
    configs,
    Effect.fnUntraced(function* (text, i) {
      const name = `config-${i}.toml`;
      yield* fs.writeFileString(path.join(root, name), text);
      return name;
    }),
    { concurrency: 1 }
  );
  let claude = A.empty<ClaudeContinuityInput>();
  if (app !== undefined) {
    yield* fs.writeFileString(path.join(root, "app.json"), yield* encode(app));
    yield* writeJsonLines("claude.jsonl", transcript);
    claude = A.append(
      claude,
      ClaudeContinuityInput.make({
        id: "claude-fixture",
        app: "app.json",
        transcript: "claude.jsonl",
        expectedMode: "bypassPermissions",
      })
    );
  }
  const input = ContinuityInput.make({
    route: "dormant-relaunch",
    expected,
    rollouts: files,
    configs: configFiles,
    claude,
  });
  const manifest = path.join(root, "input.json");
  yield* fs.writeFileString(manifest, yield* encodeContinuityInputJson(input));
  const read = yield* PermissionContinuity;
  return yield* read.read(manifest);
});
// Command.runWith requires the CLI environment even for this non-interactive subcommand.
// Files stay virtual; unexpected terminal input or process execution fails the test.
const commandEnvironment = Layer.mergeAll(
  MemoryFileSystem.layer,
  Path.layer,
  NodeCrypto.layer,
  Stdio.layerTest({}),
  Layer.succeed(
    Terminal.Terminal,
    Terminal.make({
      columns: Effect.succeed(80),
      rows: Effect.succeed(24),
      readInput: Effect.die("Unexpected terminal input"),
      readLine: Effect.die("Unexpected terminal input"),
      display: () => Effect.void,
    })
  ),
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make(() => Effect.die("Unexpected process execution"))
  )
);
it.layer(PermissionContinuityLive.pipe(Layer.provideMerge(commandEnvironment)), {
  timeout: "30 seconds",
})("permission continuity census", (it) => {
  it.prop(
    "round trips generated effective permission tuples through JSON",
    { input: Arbitrary.schema(PermissionTuple) },
    ({ input }) => {
      const json = Result.getOrThrow(S.encodeResult(tupleJson)(input));
      const output = Result.getOrThrow(S.decodeResult(tupleJson)(json));
      expect(S.toEquivalence(PermissionTuple)(input, output)).toBe(true);
    },
    { arbitrary: fcRuns(100) }
  );
  it.effect("runs the wired CLI command and emits a JSON metadata report", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const directory = path.resolve(import.meta.dirname, "../../../../../.beep");
      yield* fs.makeDirectory(directory, { recursive: true });
      const root = yield* fs.makeTempDirectoryScoped({ directory, prefix: "h4-cli-" });
      const manifest = path.join(root, "input.json");
      const input = ContinuityInput.make({ route: "fresh", expected, rollouts: [], configs: [], claude: [] });
      yield* fs.writeFileString(manifest, yield* encodeContinuityInputJson(input));
      const current = yield* Console.Console;
      let output = A.empty<unknown>();
      yield* Command.runWith(sessionCommand, { version: "0.0.0" })(["continuity", "--input", manifest]).pipe(
        Effect.provideService(Console.Console, {
          ...current,
          log: (...values: ReadonlyArray<unknown>) => {
            output = A.appendAll(output, values);
          },
        })
      );
      expect(output).toEqual(["[]"]);
    })
  );
  it.effect("joins segments by first metadata id, orders turns and detects an across-boundary downgrade", () =>
    Effect.gen(function* () {
      const rows = yield* fixture([
        [meta(), turn(at(3), "workspace-write", "on-request", "managed")],
        [meta(), turn(at(1)), { type: "event_msg", timestamp: at(2), payload: { type: "thread_settings_applied" } }],
      ]);
      expect(rows).toHaveLength(1);
      expect(rows[0]?.id).toBe("thread");
      expect(rows[0]?.family).toBe("family");
      expect(rows[0]?.verdict).toBe("unsatisfied");
      expect(rows[0]?.boundaries).toBe(2);
      expect(rows[0]?.tuples).toEqual(["never/danger-full-access/disabled", "on-request/workspace-write/managed"]);
    })
  );
  it.effect("keeps own subagent identity despite copied embedded parent metadata", () =>
    Effect.gen(function* () {
      const rows = yield* fixture([
        [meta("parent"), turn(at(1))],
        [meta("child"), meta("parent"), turn(at(2))],
      ]);
      expect(A.map(rows, (row) => [row.id, row.family, row.verdict])).toEqual([
        ["parent", "family", "verified"],
        ["child", "family", "verified"],
      ]);
    })
  );
  it.effect("marks settings without a subsequent effective turn unknown", () =>
    Effect.gen(function* () {
      const rows = yield* fixture([
        [meta(), turn(at(1)), { type: "event_msg", timestamp: at(2), payload: { type: "thread_settings_applied" } }],
      ]);
      expect(rows[0]?.verdict).toBe("unknown");
    })
  );
  it.effect("does not verify an empty segment or absent permission profile", () =>
    Effect.gen(function* () {
      const empty = yield* fixture([[meta(), turn(at(1))], [meta()]]);
      expect(empty[0]?.verdict).toBe("unknown");
      const missing = yield* fixture([
        [
          meta(),
          {
            type: "turn_context",
            timestamp: at(1),
            payload: { approval_policy: "never", sandbox_policy: { type: "danger-full-access" } },
          },
        ],
      ]);
      expect(missing[0]?.verdict).toBe("unknown");
    })
  );
  it.effect("does not invent thread or family identity", () =>
    Effect.gen(function* () {
      const missing = yield* fixture([
        [turn(at(1))],
        [{ type: "session_meta", payload: { id: "thread" } }, turn(at(1))],
      ]);
      expect(A.map(missing, (row) => row.verdict)).toEqual(["unknown", "unknown"]);
    })
  );
  it.effect("flags only top-level profile plus legacy coexistence without leaking values", () =>
    Effect.gen(function* () {
      const rows = yield* fixture(
        [],
        [
          'default_permissions = ":danger-full-access"\nsandbox_mode = "danger-full-access"\nsecret = "sensitive-canary"',
          'default_permissions = ":danger-full-access"\n[profiles.fixture]\nsandbox_mode = "workspace-write"',
          '# sandbox_mode = "danger-full-access"\ndefault_permissions = ":danger-full-access"',
        ]
      );
      expect(A.map(rows, (row) => row.verdict)).toEqual(["unsatisfied", "unknown", "unknown"]);
      expect(yield* encode(rows)).not.toContain("sensitive-canary");
    })
  );
  it.effect("compares app mode with last CLI user mode, never an assistant's mode", () =>
    Effect.gen(function* () {
      const rows = yield* fixture([], [], { permissionMode: "bypassPermissions", cliSessionId: "cli" }, [
        { type: "user", sessionId: "cli", permissionMode: "default" },
        { type: "user", sessionId: "cli", permissionMode: "bypassPermissions" },
        { type: "assistant", sessionId: "cli", permissionMode: "default" },
      ]);
      expect(rows[0]?.verdict).toBe("verified");
      expect(rows[0]?.tuples).toEqual(["bypassPermissions", "bypassPermissions"]);
    })
  );
  it.effect("stops at a Claude mismatch and marks missing or wrong transcript identity unknown", () =>
    Effect.gen(function* () {
      const mismatch = yield* fixture([], [], { permissionMode: "bypassPermissions", cliSessionId: "cli" }, [
        { type: "user", sessionId: "cli", permissionMode: "default" },
      ]);
      expect(mismatch[0]?.verdict).toBe("unsatisfied");
      const wrong = yield* fixture([], [], { permissionMode: "bypassPermissions", cliSessionId: "cli" }, [
        { type: "user", sessionId: "other", permissionMode: "bypassPermissions" },
      ]);
      expect(wrong[0]?.verdict).toBe("unknown");
      const missing = yield* fixture([], [], { permissionMode: "bypassPermissions" }, []);
      expect(missing[0]?.verdict).toBe("unknown");
    })
  );
  it.effect("retains known mismatch even when another boundary lacks evidence", () =>
    Effect.gen(function* () {
      const rows = yield* fixture([
        [meta(), turn(at(1), "workspace-write"), { type: "thread_settings_applied", timestamp: at(2), payload: {} }],
      ]);
      expect(rows[0]?.verdict).toBe("unsatisfied");
    })
  );
  it.effect("does not count a preceding equal-timestamp turn as post-settings evidence", () =>
    Effect.gen(function* () {
      const rows = yield* fixture([
        [
          meta(),
          turn(at(0)),
          turn(at(1)),
          { type: "event_msg", timestamp: at(1), payload: { type: "thread_settings_applied" } },
        ],
      ]);
      expect(rows[0]?.verdict).toBe("unknown");
    })
  );
  it.effect("requires the last mode-bearing row to carry the paired CLI identity", () =>
    Effect.gen(function* () {
      const rows = yield* fixture([], [], { permissionMode: "bypassPermissions", cliSessionId: "cli" }, [
        { type: "user", sessionId: "cli", permissionMode: "bypassPermissions" },
        { type: "user", permissionMode: "bypassPermissions" },
      ]);
      expect(rows[0]?.verdict).toBe("unknown");
    })
  );
  it.effect("returns no invented verified row for an empty manifest", () =>
    Effect.gen(function* () {
      expect(yield* fixture([])).toEqual([]);
    })
  );

  it.effect("retains a known downgrade in an unidentified segment", () =>
    Effect.gen(function* () {
      const rows = yield* fixture([[meta(), turn(at(0))], [turn(at(1), "workspace-write", "on-request", "managed")]]);
      expect(rows[0]?.id).toBe("unidentified-1");
      expect(rows[0]?.verdict).toBe("unsatisfied");
      expect(rows[0]?.tuples).toEqual(["on-request/workspace-write/managed"]);
      expect(rows[1]?.verdict).toBe("verified");
    })
  );
  it.effect("retains known mismatches when turn timestamps are absent or malformed", () =>
    Effect.gen(function* () {
      const payload = {
        approval_policy: "on-request",
        sandbox_policy: { type: "workspace-write" },
        permission_profile: { type: "managed" },
      };
      const observations = yield* Effect.all([
        fixture([[meta(), { type: "turn_context", payload }]]),
        fixture([[meta(), { type: "turn_context", timestamp: "invalid", payload }]]),
        fixture([[{ type: "turn_context", payload }]]),
      ]);
      expect(A.map(observations, (rows) => rows[0]?.verdict)).toEqual(["unsatisfied", "unsatisfied", "unsatisfied"]);
      expect(A.map(observations, (rows) => rows[0]?.tuples)).toEqual([
        ["on-request/workspace-write/managed"],
        ["on-request/workspace-write/managed"],
        ["on-request/workspace-write/managed"],
      ]);
    })
  );
  it.effect("does not use manifest order as evidence for cross-segment timestamp ties", () =>
    Effect.gen(function* () {
      const boundarySegment = [
        meta(),
        turn(at(0)),
        { type: "event_msg", timestamp: at(1), payload: { type: "thread_settings_applied" } },
      ];
      const tiedSegment = [meta(), turn(at(1))];
      const ambiguous = yield* Effect.all([
        fixture([boundarySegment, tiedSegment]),
        fixture([tiedSegment, boundarySegment]),
      ]);
      expect(A.map(ambiguous, (rows) => rows[0]?.verdict)).toEqual(["unknown", "unknown"]);
      const supportedSegment = [meta(), turn(at(1)), turn(at(2))];
      const supported = yield* Effect.all([
        fixture([boundarySegment, supportedSegment]),
        fixture([supportedSegment, boundarySegment]),
      ]);
      expect(A.map(supported, (rows) => rows[0]?.verdict)).toEqual(["verified", "verified"]);
    })
  );
});
