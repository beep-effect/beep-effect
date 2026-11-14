import * as NodeURL from "node:url";
import { Git } from "@beep/git/Git";
import { sessionCommand } from "@beep/repo-cli";
import { parseProcStatStartTime } from "@beep/repo-cli/commands/Worktree";
import {
  ClaudePeerRoute,
  capturePresence,
  claimsFor,
  latestPresence,
  layerSessionLedgerMemory,
  layerSessionPresenceStoreMemory,
  layerSessionResolver,
  layerSessionRouteProbeLive,
  localT3EnvironmentId,
  makeSessionPresenceStoreLive,
  makeSessionRouteProbeLive,
  PrRepository,
  RouteReading,
  recordPresence,
  renderPeerSend,
  renderSessionResolution,
  renderT3Send,
  SessionLedger,
  SessionLedgerRow,
  SessionPresence,
  SessionPresenceJson,
  SessionPresenceStore,
  SessionResolution,
  SessionResolutionJson,
  SessionResolveInput,
  SessionResolver,
  SessionRoute,
  sessionPresenceFileName,
  T3ThreadRoute,
  t3HomeDirectory,
  UnroutableRoute,
  ViaParentRoute,
} from "@beep/repo-cli/test/Session";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Command from "effect/cli/Command";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Predicate from "effect/Predicate";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as TestConsole from "effect/testing/TestConsole";

const repository = PrRepository.make({ host: "github.com", owner: "beep-effect", name: "beep-effect" });
const hookPath = NodeURL.fileURLToPath(new URL("../../../../../.claude/hooks/session-ledger.sh", import.meta.url));
const decodeRoute = S.decodeUnknownEffect(SessionRoute);
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const encodeRouteJson = S.encodeEffect(S.fromJsonString(SessionRoute));
const decodeRouteJson = S.decodeEffect(S.fromJsonString(SessionRoute));
const routeEquivalence = S.toEquivalence(SessionRoute);
const presenceEquivalence = S.toEquivalence(SessionPresence);
const LOCAL_ENV = "env-local";
const DEAD_PID = 4_194_311;

const testLayer = Layer.provideMerge(
  Git.layer,
  Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, TestConsole.layer)
);

const ledgerRow = (overrides: {
  readonly checkout: string;
  readonly at: number;
  readonly sessionId?: string;
  readonly harness?: SessionLedgerRow["harness"];
  readonly pr?: number;
  readonly branch?: string;
  readonly state?: SessionLedgerRow["state"];
}) =>
  SessionLedgerRow.make({
    schemaVersion: "session-ledger/v1",
    repository,
    clone: "/work/beep-effect",
    checkout: overrides.checkout,
    lane: O.getOrElse(A.last(Str.split(overrides.checkout, "/")), () => "lane"),
    branch: overrides.branch ?? "feat/outbox-draft-basis",
    state: overrides.state ?? "open",
    next: "keep going",
    summary: O.none(),
    pr: O.fromUndefinedOr(overrides.pr),
    harness: overrides.harness ?? "claude-code",
    sessionId: O.fromUndefinedOr(overrides.sessionId),
    recordedAt: DateTime.makeUnsafe(overrides.at),
  });

const presenceRow = (sessionId: string, routes: ReadonlyArray<SessionRoute>, harness: SessionPresence["harness"]) =>
  SessionPresence.make({
    schemaVersion: "session-presence/v1",
    repository,
    harness,
    entrypoint: "unknown",
    sessionId,
    routes,
    checkout: "/work/beep-effect",
    branch: "main",
    recordedAt: DateTime.makeUnsafe(10),
  });

type ThreadFixture = {
  readonly id: string;
  readonly status: string;
  readonly archived: boolean;
  readonly parent?: string;
};

/** A temp HOME with a fixture Claude live index and a fixture `t3` CLI that answers from files. */
const makeFixture = Effect.fn("SessionRouteResolverTest.makeFixture")(function* (options: {
  readonly liveIndex?: ReadonlyArray<{ readonly file: string; readonly content: string | object }>;
  readonly threads?: ReadonlyArray<ThreadFixture>;
  readonly environments?: ReadonlyArray<object>;
  readonly malformedThread?: string;
  readonly failingThread?: string;
  readonly environmentsFail?: boolean;
}) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "session-route-resolver-" });
  const sessions = path.join(root, "claude", "sessions");
  yield* fs.makeDirectory(sessions, { recursive: true });
  yield* Effect.forEach(
    options.liveIndex ?? [],
    (entry) =>
      (Predicate.isString(entry.content) ? Effect.succeed(entry.content) : encodeJson(entry.content)).pipe(
        Effect.flatMap((content) => fs.writeFileString(path.join(sessions, entry.file), content))
      ),
    {
      discard: true,
    }
  );
  const t3 = path.join(root, "t3");
  yield* fs.makeDirectory(path.join(t3, "userdata"), { recursive: true });
  yield* fs.makeDirectory(path.join(t3, "threads"), { recursive: true });
  yield* fs.writeFileString(path.join(t3, "userdata", "environment-id"), `${LOCAL_ENV}\n`);
  const environmentsFile = path.join(t3, "environments.json");
  const environments = yield* encodeJson(options.environments ?? []);
  yield* fs.writeFileString(environmentsFile, environments);
  const cases = yield* Effect.forEach(options.threads ?? [], (thread, index) =>
    Effect.gen(function* () {
      const file = path.join(t3, "threads", `${index}.json`);
      const show = yield* encodeJson({
        thread: {
          threadId: thread.id,
          status: thread.status,
          archived: thread.archived,
          parentThreadId: thread.parent ?? null,
        },
      });
      yield* fs.writeFileString(file, show);
      return `  '${thread.id}') cat '${file}' ;;`;
    })
  );
  const malformed = O.match(O.fromUndefinedOr(options.malformedThread), {
    onNone: () => "",
    onSome: (id) => `  '${id}') echo 'not json' ;;`,
  });
  const cli = path.join(t3, "bin", "t3");
  yield* fs.makeDirectory(path.dirname(cli), { recursive: true });
  yield* fs.writeFileString(
    cli,
    A.join(
      [
        "#!/bin/sh",
        options.environmentsFail === true
          ? `if [ "$1" = environment ]; then echo 'link store unavailable' >&2; exit 3; fi`
          : `if [ "$1" = environment ]; then cat '${environmentsFile}'; exit 0; fi`,
        'case "$3" in',
        ...cases,
        malformed,
        O.match(O.fromUndefinedOr(options.failingThread), {
          onNone: () => "",
          onSome: (id) => `  '${id}') echo 'server error' >&2; exit 2 ;;`,
        }),
        '  *) echo "Thread $3 is no longer available." >&2; exit 1 ;;',
        "esac",
        "",
      ],
      "\n"
    )
  );
  yield* fs.chmod(cli, 0o755);
  return {
    root,
    env: {
      HOME: root,
      CLAUDE_CONFIG_DIR: path.join(root, "claude"),
      T3CODE_HOME: t3,
      T3CODE_CLI_PATH: cli,
      BEEP_SESSION_STATE_ROOT: path.join(root, "state"),
    },
  };
});

const procDenied = (path: string) =>
  Effect.fail(
    PlatformError.systemError({
      _tag: "PermissionDenied",
      module: "FileSystem",
      method: "readFileString",
      pathOrDescriptor: path,
    })
  );

const liveIndexEntry = (pid: number, procStart: string, sessionId: string, name: string) => ({
  pid,
  procStart,
  sessionId,
  name,
  entrypoint: "claude-desktop",
  status: "idle",
});

const ownStart = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const stat = yield* fs.readFileString(`/proc/${process.pid}/stat`);
  return O.getOrThrow(parseProcStatStartTime(stat));
});

const resolveWith = Effect.fn("SessionRouteResolverTest.resolveWith")(function* (input: {
  readonly env: Record<string, string>;
  readonly rows: ReadonlyArray<SessionLedgerRow>;
  readonly presence?: ReadonlyArray<SessionPresence>;
  readonly query: string;
  readonly cwd?: string;
}) {
  const layer = layerSessionResolver.pipe(
    Layer.provideMerge(
      Layer.mergeAll(layerSessionLedgerMemory, layerSessionPresenceStoreMemory, layerSessionRouteProbeLive)
    )
  );
  const config = ConfigProvider.fromEnv({ env: input.env });
  const context = yield* Layer.build(layer).pipe(Effect.provideService(ConfigProvider.ConfigProvider, config));
  return yield* Effect.gen(function* () {
    const ledger = yield* SessionLedger;
    const presence = yield* SessionPresenceStore;
    yield* Effect.forEach(input.rows, ledger.append, { discard: true });
    yield* Effect.forEach(input.presence ?? [], presence.append, { discard: true });
    const resolver = yield* SessionResolver;
    return yield* resolver.resolve(
      SessionResolveInput.make({ repository, query: input.query, cwd: input.cwd ?? "/work" })
    );
  }).pipe(Effect.provideContext(context), Effect.provideService(ConfigProvider.ConfigProvider, config));
});

const liveness = (resolution: SessionResolution) =>
  A.map(resolution.routes, (reading) => [reading.route._tag, reading.liveness]);

describe("session route schemas", () => {
  it.effect("decodes every route kind, including a nested via-parent route", () =>
    Effect.gen(function* () {
      const t3 = yield* decodeRoute({
        _tag: "t3-thread",
        environmentId: "env",
        threadId: "thread:subagent:abc",
        provider: "codex",
      });
      const peer = yield* decodeRoute({ _tag: "claude-peer", sessionId: "sid", nameHint: "name" });
      const unroutable = yield* decodeRoute({
        _tag: "unroutable",
        harness: "junie",
        nativeId: null,
        reason: "no inbound route",
      });
      const nested = yield* decodeRoute({
        _tag: "via-parent",
        childKind: "workflow",
        parent: {
          _tag: "via-parent",
          childKind: "t3-child",
          parent: { _tag: "claude-peer", sessionId: "sid", nameHint: null },
        },
      });
      expect(A.map([t3, peer, unroutable, nested], (route) => route._tag)).toStrictEqual([
        "t3-thread",
        "claude-peer",
        "unroutable",
        "via-parent",
      ]);
      expect(SessionRoute.guards["via-parent"](nested) && nested.parent._tag).toBe("via-parent");
      const rejected = yield* decodeRoute({ _tag: "relay", target: "x" }).pipe(Effect.flip);
      expect(rejected._tag).toBe("SchemaError");
    })
  );

  it.effect.prop(
    "round-trips every generated route and presence row through JSON",
    { route: SessionRoute, presence: SessionPresence },
    ({ route, presence: generated }) =>
      Effect.gen(function* () {
        const presence = SessionPresence.make(generated);
        const routeJson = yield* encodeRouteJson(route);
        const decodedRoute = yield* decodeRouteJson(routeJson);
        expect(routeEquivalence(decodedRoute, route)).toBe(true);
        const line = yield* SessionPresenceJson.encode(presence);
        const decodedPresence = yield* SessionPresenceJson.decode(line);
        expect(presenceEquivalence(decodedPresence, presence)).toBe(true);
      }),
    { arbitrary: fcRuns(25) }
  );

  it.effect("round-trips presence and resolution JSON, keeping long opaque thread ids verbatim", () =>
    Effect.gen(function* () {
      const threadId = `thread:delegated-task:command%3Amcp%3A${Str.repeat(110)("%25")}`;
      const presence = presenceRow(
        "sid",
        [T3ThreadRoute.make({ environmentId: "env", threadId, provider: "codex" })],
        "codex"
      );
      const line = yield* SessionPresenceJson.encode(presence);
      const decoded = SessionPresenceJson.decodeOption(line);
      assertSome(
        O.map(decoded, (value) => value.routes),
        presence.routes
      );
      expect(threadId.length).toBeGreaterThan(300);
      const resolution = SessionResolution.make({
        schemaVersion: "session-resolution/v1",
        query: "1",
        repository,
        owner: O.none(),
        superseded: [],
        routes: [
          RouteReading.make({
            route: ViaParentRoute.make({
              parent: ClaudePeerRoute.make({ sessionId: "s", nameHint: O.none() }),
              childKind: "cli-worker",
            }),
            liveness: "unknown",
            detail: "d",
            currentName: O.none(),
            send: O.none(),
          }),
        ],
        steps: [],
      });
      const encoded = yield* SessionResolutionJson.encode(resolution);
      assertSome(
        O.map(SessionResolutionJson.decodeOption(encoded), (value) => value.routes.length),
        1
      );
    })
  );

  it("renders send calls with both T3 ids and the current peer name", () => {
    expect(renderT3Send(T3ThreadRoute.make({ environmentId: "e", threadId: "t", provider: "codex" }))).toBe(
      't3_thread_send({ threadId: "t", environmentId: "e", message: "<message>" })'
    );
    expect(renderPeerSend('say "hi"')).toBe('SendMessage({ to: "say \\"hi\\"", message: "<message>" })');
    expect(renderPeerSend("C:\\work\\lane\nnext")).toBe(
      'SendMessage({ to: "C:\\\\work\\\\lane\\nnext", message: "<message>" })'
    );
  });
});

describe("session claims", () => {
  it("finds the newest claim, lists older ones as superseded, and drops done checkouts", () => {
    const rows = [
      ledgerRow({ checkout: "/work/a", at: 1, pr: 3172, sessionId: "old" }),
      ledgerRow({ checkout: "/work/a", at: 2, sessionId: "old" }),
      ledgerRow({ checkout: "/work/b", at: 5, pr: 3172, sessionId: "taker" }),
      ledgerRow({ checkout: "/work/c", at: 9, pr: 3172, state: "done" }),
      ledgerRow({ checkout: "/work/d", at: 9, pr: 99, branch: "feat/other" }),
    ];
    const claims = claimsFor(rows, { query: "3172", pr: O.some(3172), checkout: "/x/3172" });
    expect(
      A.map(claims, (claim) => [claim.checkout, claim.matchedBy, DateTime.toEpochMillis(claim.claimedAt)])
    ).toStrictEqual([
      ["/work/b", ["pr"], 5],
      ["/work/a", ["pr"], 1],
    ]);
    expect(claimsFor({ query: "nothing", pr: O.none(), checkout: "/nothing" })(rows)).toStrictEqual([]);
    const renamed = claimsFor(
      [
        ledgerRow({ checkout: "/work/e", at: 1, pr: 77 }),
        ledgerRow({ checkout: "/work/e", at: 4, pr: 77 }),
        ledgerRow({ checkout: "/work/e", at: 2, pr: 77 }),
      ],
      { query: "77", pr: O.some(77), checkout: "/x/77" }
    );
    expect(A.map(renamed, (claim) => DateTime.toEpochMillis(claim.claimedAt))).toStrictEqual([4]);
  });

  it("stops matching a PR once the checkout's newest row names a different one", () => {
    const rows = [ledgerRow({ checkout: "/work/a", at: 1, pr: 1 }), ledgerRow({ checkout: "/work/a", at: 2, pr: 2 })];
    expect(claimsFor(rows, { query: "1", pr: O.some(1), checkout: "/1" })).toStrictEqual([]);
  });
});

describe("session presence", () => {
  it.layer(Layer.fresh(testLayer), { timeout: "30 seconds" })((it) => {
    const facts = {
      repository,
      clone: "/work/beep-effect",
      checkout: "/work/beep-effect",
      lane: "beep-effect",
      branch: "main",
    };
    const capture = (env: Record<string, string>) =>
      capturePresence(facts).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }))
      );

    it.effect("records the routes each harness exposes from its own environment", () =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture({});
        const t3Claude = yield* capture({
          ...fixture.env,
          CLAUDE_CODE_SESSION_ID: "claude-1",
          CLAUDE_CODE_ENTRYPOINT: "t3-code",
          T3CODE_THREAD_ID: "mcp:launch:abc",
        });
        assertSome(
          O.map(t3Claude, (row) => [row.entrypoint, row.routes]),
          [
            "t3-code",
            [
              T3ThreadRoute.make({ environmentId: LOCAL_ENV, threadId: "mcp:launch:abc", provider: "claude-code" }),
              ClaudePeerRoute.make({ sessionId: "claude-1", nameHint: O.none() }),
            ],
          ]
        );
        const desktop = yield* capture({
          ...fixture.env,
          CLAUDE_CODE_SESSION_ID: "claude-2",
          CLAUDE_CODE_ENTRYPOINT: "claude-desktop",
        });
        assertSome(
          O.map(desktop, (row) => A.map(row.routes, (route) => route._tag)),
          ["claude-peer"]
        );
        const t3Codex = yield* capture({ ...fixture.env, CODEX_THREAD_ID: "codex-1", T3CODE_THREAD_ID: "thread-9" });
        assertSome(
          O.map(t3Codex, (row) => [row.harness, row.entrypoint, A.map(row.routes, (route) => route._tag)]),
          ["codex", "t3-code", ["t3-thread"]]
        );
        const codex = yield* capture({ ...fixture.env, CODEX_THREAD_ID: "codex-2" });
        assertSome(
          O.map(codex, (row) => row.routes),
          [
            UnroutableRoute.make({
              harness: "codex",
              nativeId: O.some("codex-2"),
              reason: "Codex outside T3 accepts no inbound message",
            }),
          ]
        );
        const outside = yield* capture(fixture.env);
        assertNone(outside);
      })
    );

    it.effect("fails a presence write it cannot make instead of reporting no session", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeFixture({});
        const blocked = path.join(fixture.root, "state-is-a-file");
        yield* fs.writeFileString(blocked, "");
        const config = ConfigProvider.fromEnv({
          env: { ...fixture.env, BEEP_SESSION_STATE_ROOT: blocked, CLAUDE_CODE_SESSION_ID: "claude-1" },
        });
        const store = yield* makeSessionPresenceStoreLive().pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, config)
        );
        const error = yield* recordPresence(facts).pipe(
          Effect.provideService(SessionPresenceStore, store),
          Effect.provideService(ConfigProvider.ConfigProvider, config),
          Effect.flip
        );
        expect(error._tag).toBe("SessionLedgerError");
      })
    );

    it.effect("keeps the newest presence row per session", () =>
      Effect.sync(() => {
        const older = presenceRow("s", [], "codex");
        const newer = SessionPresence.make({ ...older, branch: "newer", recordedAt: DateTime.makeUnsafe(20) });
        assertSome(
          O.map(latestPresence([newer, older], "s"), (row) => row.branch),
          "newer"
        );
        assertNone(latestPresence("missing")([older]));
      })
    );

    it.effect("the SessionStart hook appends presence rows that decode as SessionPresence", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeFixture({});
        const repo = path.join(fixture.root, "repo");
        yield* fs.makeDirectory(repo, { recursive: true });
        const git = Effect.fn("SessionRouteResolverTest.git")(function* (args: ReadonlyArray<string>) {
          const handle = yield* ChildProcess.make("git", args, {
            cwd: repo,
            stdin: "ignore",
            stdout: "ignore",
            stderr: "ignore",
          });
          const exitCode = yield* handle.exitCode;
          expect(exitCode).toBe(0);
        });
        yield* git(["init", "-q", "-b", "feat/hook"]);
        yield* git(["remote", "add", "origin", "https://github.com/beep-effect/beep-effect.git"]);
        const base = {
          PATH: "/usr/bin:/bin",
          HOME: fixture.root,
          T3CODE_HOME: fixture.env.T3CODE_HOME,
          BEEP_SESSION_STATE_ROOT: fixture.env.BEEP_SESSION_STATE_ROOT,
          BEEP_PALANTIRI_STATE_ROOT: path.join(fixture.root, "palantiri"),
          CLAUDE_PROJECT_DIR: repo,
        };
        const runHook = Effect.fn("SessionRouteResolverTest.runHook")(function* (
          args: ReadonlyArray<string>,
          env: Record<string, string>,
          stdin: string
        ) {
          const handle = yield* ChildProcess.make("bash", [hookPath, ...args], {
            cwd: repo,
            env: { ...base, ...env },
            extendEnv: false,
            stdin: Stream.make(stdin).pipe(Stream.encodeText),
            stdout: "ignore",
            stderr: "ignore",
          });
          const exitCode = yield* handle.exitCode;
          expect(exitCode).toBe(0);
        });
        yield* runHook(
          [],
          { CLAUDE_CODE_SESSION_ID: "claude-1", CLAUDE_CODE_ENTRYPOINT: "t3-code", T3CODE_THREAD_ID: "mcp:launch:abc" },
          "{}"
        );
        yield* runHook([], { CLAUDE_CODE_ENTRYPOINT: "something-new" }, '{"session_id":"from-stdin"}');
        yield* runHook(["codex"], { CODEX_THREAD_ID: "codex-1" }, "{}");
        yield* runHook(["codex"], { CODEX_THREAD_ID: "worker", CLAUDE_CODE_SESSION_ID: "launcher" }, "{}");
        const content = yield* fs.readFileString(
          path.join(fixture.env.BEEP_SESSION_STATE_ROOT, sessionPresenceFileName(repository))
        );
        const rows = A.map(A.filter(Str.split(content, "\n"), Str.isNonEmpty), (line) =>
          O.getOrThrow(SessionPresenceJson.decodeOption(line))
        );
        expect(
          A.map(rows, (row) => [
            row.harness,
            row.entrypoint,
            row.sessionId,
            row.branch,
            A.map(row.routes, (route) => route._tag),
          ])
        ).toStrictEqual([
          ["claude-code", "t3-code", "claude-1", "feat/hook", ["t3-thread", "claude-peer"]],
          ["claude-code", "unknown", "from-stdin", "feat/hook", ["claude-peer"]],
          ["codex", "unknown", "codex-1", "feat/hook", ["unroutable"]],
        ]);
        expect(rows[0]?.routes[0]).toStrictEqual(
          T3ThreadRoute.make({ environmentId: LOCAL_ENV, threadId: "mcp:launch:abc", provider: "claude-code" })
        );
      })
    );
  });
});

describe("session resolve", () => {
  it.layer(Layer.fresh(testLayer), { timeout: "30 seconds" })((it) => {
    it.effect("resolves a Desktop-owned PR to its live peer, its current name and a SendMessage call", () =>
      Effect.gen(function* () {
        const start = yield* ownStart;
        const fixture = yield* makeFixture({
          liveIndex: [
            {
              file: `${process.pid}.json`,
              content: liveIndexEntry(process.pid, start, "desk-1", "outbox draft basis"),
            },
          ],
        });
        const resolution = yield* resolveWith({
          env: fixture.env,
          rows: [ledgerRow({ checkout: "/work/outbox", at: 1, pr: 3172, sessionId: "desk-1" })],
          query: "3172",
        });
        assertSome(
          O.map(resolution.owner, (owner) => owner.lane),
          "outbox"
        );
        expect(liveness(resolution)).toStrictEqual([["claude-peer", "live"]]);
        assertSome(resolution.routes[0]?.currentName ?? O.none(), "outbox draft basis");
        expect(A.map(resolution.steps, (step) => [step.rung, step.instruction])).toStrictEqual([
          ["send", 'SendMessage({ to: "outbox draft basis", message: "<message>" })'],
        ]);
        expect(renderSessionResolution(resolution)).toContain('route claude-peer "outbox draft basis": live');
      })
    );

    it.effect("reports a dead Desktop owner and falls back to the PR comment and a takeover", () =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture({
          liveIndex: [{ file: `${DEAD_PID}.json`, content: liveIndexEntry(DEAD_PID, "1", "desk-1", "gone") }],
        });
        const resolution = yield* resolveWith({
          env: fixture.env,
          rows: [ledgerRow({ checkout: "/work/outbox", at: 1, pr: 3172, sessionId: "desk-1" })],
          query: "#3172",
        });
        expect(liveness(resolution)).toStrictEqual([["claude-peer", "dead"]]);
        assertNone(resolution.routes[0]?.send ?? O.some("missing"));
        expect(A.map(resolution.steps, (step) => step.rung)).toStrictEqual(["pr-comment", "takeover"]);
        expect(resolution.steps[0]?.instruction).toBe('bun run beep yeet gh pr comment 3172 --body "<message>"');
      })
    );

    it.effect("resolves a T3-owned PR to t3_thread_send with both ids, dormant while the thread is idle", () =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture({ threads: [{ id: "mcp:launch:t3", status: "idle", archived: false }] });
        const route = T3ThreadRoute.make({ environmentId: LOCAL_ENV, threadId: "mcp:launch:t3", provider: "codex" });
        const resolution = yield* resolveWith({
          env: fixture.env,
          rows: [ledgerRow({ checkout: "/work/t3", at: 1, pr: 3195, sessionId: "codex-9", harness: "codex" })],
          presence: [presenceRow("codex-9", [route], "codex")],
          query: "3195",
        });
        expect(liveness(resolution)).toStrictEqual([["t3-thread", "dormant"]]);
        assertSome(resolution.routes[0]?.send ?? O.none(), renderT3Send(route));
        expect(A.map(resolution.steps, (step) => step.rung)).toStrictEqual(["wake"]);
      })
    );

    it.effect("maps T3 thread states to live, dead and unknown, and routes a child through its parent", () =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture({
          threads: [
            { id: "running", status: "running", archived: false },
            { id: "archived", status: "idle", archived: true },
            { id: "child", status: "completed", archived: false, parent: "running" },
          ],
          malformedThread: "garbled",
        });
        const routeOf = (threadId: string) =>
          T3ThreadRoute.make({ environmentId: LOCAL_ENV, threadId, provider: "codex" });
        const resolution = yield* resolveWith({
          env: fixture.env,
          rows: [ledgerRow({ checkout: "/work/t3", at: 1, pr: 7, sessionId: "codex-9", harness: "codex" })],
          presence: [
            presenceRow("codex-9", A.map(["running", "archived", "missing", "garbled", "child"], routeOf), "codex"),
          ],
          query: "7",
        });
        expect(liveness(resolution)).toStrictEqual([
          ["t3-thread", "live"],
          ["t3-thread", "dead"],
          ["t3-thread", "dead"],
          ["t3-thread", "unknown"],
          ["via-parent", "live"],
          ["t3-thread", "dormant"],
        ]);
        expect(resolution.routes[4]?.route).toStrictEqual(
          ViaParentRoute.make({ parent: routeOf("running"), childKind: "t3-child" })
        );
        expect(A.map(resolution.steps, (step) => step.rung)).toStrictEqual(["send"]);
      })
    );

    it.effect("wakes an idle parent rather than a finished child thread", () =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture({
          threads: [
            { id: "parent", status: "idle", archived: false },
            { id: "child", status: "completed", archived: false, parent: "parent" },
          ],
        });
        const child = T3ThreadRoute.make({ environmentId: LOCAL_ENV, threadId: "child", provider: "codex" });
        const parent = T3ThreadRoute.make({ environmentId: LOCAL_ENV, threadId: "parent", provider: "codex" });
        const resolution = yield* resolveWith({
          env: fixture.env,
          rows: [ledgerRow({ checkout: "/work/t3", at: 1, pr: 8, sessionId: "codex-9", harness: "codex" })],
          presence: [presenceRow("codex-9", [child], "codex")],
          query: "8",
        });
        expect(liveness(resolution)).toStrictEqual([
          ["via-parent", "dormant"],
          ["t3-thread", "dormant"],
        ]);
        expect(A.map(resolution.steps, (step) => [step.rung, step.instruction])).toStrictEqual([
          ["wake", `${renderT3Send(parent)}  # wakes the idle thread`],
        ]);
        assertNone(resolution.routes[1]?.send ?? O.some("missing"));
      })
    );

    it.effect("never sends to a finished child whose parent cannot be read", () =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture({
          threads: [{ id: "orphan-child", status: "completed", archived: false, parent: "garbled-parent" }],
          malformedThread: "garbled-parent",
        });
        const child = T3ThreadRoute.make({ environmentId: LOCAL_ENV, threadId: "orphan-child", provider: "codex" });
        const resolution = yield* resolveWith({
          env: fixture.env,
          rows: [ledgerRow({ checkout: "/work/t3", at: 1, pr: 9, sessionId: "codex-9", harness: "codex" })],
          presence: [presenceRow("codex-9", [child], "codex")],
          query: "9",
        });
        expect(liveness(resolution)).toStrictEqual([
          ["via-parent", "unknown"],
          ["t3-thread", "dormant"],
        ]);
        const parent = T3ThreadRoute.make({ environmentId: LOCAL_ENV, threadId: "garbled-parent", provider: "codex" });
        expect(A.map(resolution.steps, (step) => [step.rung, step.instruction])).toStrictEqual([
          ["send", `${renderT3Send(parent)}  # liveness unknown: send, then confirm with t3_thread_read`],
          ["pr-comment", 'bun run beep yeet gh pr comment 9 --body "<message>"'],
          ["takeover", resolution.steps[2]?.instruction ?? ""],
        ]);
      })
    );

    it.effect("reads a remote environment's link status: unreachable when down, unknown when up", () =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture({
          environments: [
            { environmentId: "env-down", label: "grok-bot", status: "unreachable", urls: [] },
            { environmentId: "env-up", label: "tbk-worker", status: "reachable" },
          ],
        });
        const routes = A.map(["env-down", "env-up"], (environmentId) =>
          T3ThreadRoute.make({ environmentId, threadId: "remote", provider: "codex" })
        );
        const resolution = yield* resolveWith({
          env: fixture.env,
          rows: [ledgerRow({ checkout: "/work/t3", at: 1, pr: 7, sessionId: "codex-9", harness: "codex" })],
          presence: [presenceRow("codex-9", routes, "codex")],
          query: "7",
        });
        expect(liveness(resolution)).toStrictEqual([
          ["t3-thread", "unreachable"],
          ["t3-thread", "unknown"],
        ]);
        expect(A.map(resolution.steps, (step) => step.rung)).toStrictEqual(["send", "retry", "pr-comment", "takeover"]);
      })
    );

    it.effect("returns the same owner for the PR, branch, lane and checkout path", () =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture({});
        const rows = [
          ledgerRow({ checkout: "/work/outbox-draft-basis", at: 1, pr: 3172, sessionId: "desk-1" }),
          ledgerRow({ checkout: "/work/other", at: 2, pr: 3000, branch: "feat/other", sessionId: "other" }),
        ];
        const owners = yield* Effect.forEach(
          [
            { query: "3172", cwd: "/work" },
            { query: "feat/outbox-draft-basis", cwd: "/work" },
            { query: "outbox-draft-basis", cwd: "/elsewhere" },
            { query: "/work/outbox-draft-basis", cwd: "/elsewhere" },
            { query: "./outbox-draft-basis/", cwd: "/work" },
          ],
          ({ query, cwd }) =>
            resolveWith({ env: fixture.env, rows, query, cwd }).pipe(
              Effect.map((resolution) =>
                O.match(resolution.owner, {
                  onNone: () => "no owner",
                  onSome: (owner) => `${owner.checkout} ${O.getOrElse(owner.sessionId, () => "no session")}`,
                })
              )
            )
        );
        expect(A.dedupe(owners)).toStrictEqual(["/work/outbox-draft-basis desk-1"]);
      })
    );

    it.effect("after a takeover, resolves to the taker and lists the previous owner as superseded", () =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture({});
        const resolution = yield* resolveWith({
          env: fixture.env,
          rows: [
            ledgerRow({ checkout: "/work/dead-lane", at: 1, pr: 3171, sessionId: "dead" }),
            ledgerRow({
              checkout: "/work/takeover-3171",
              at: 5,
              pr: 3171,
              sessionId: "taker",
              branch: "takeover/3171",
            }),
          ],
          query: "3171",
        });
        assertSome(
          O.flatMap(resolution.owner, (owner) => owner.sessionId),
          "taker"
        );
        expect(A.map(resolution.superseded, (claim) => claim.checkout)).toStrictEqual(["/work/dead-lane"]);
        expect(renderSessionResolution(resolution)).toContain("superseded: dead-lane");
      })
    );

    it.effect("an unreadable or malformed Claude index is unknown, never dead", () =>
      Effect.gen(function* () {
        const malformed = yield* makeFixture({ liveIndex: [{ file: "123.json", content: "{ torn" }] });
        const rows = [ledgerRow({ checkout: "/work/x", at: 1, pr: 5, sessionId: "desk-1" })];
        const torn = yield* resolveWith({ env: malformed.env, rows, query: "5" });
        expect(liveness(torn)).toStrictEqual([["claude-peer", "unknown"]]);
        const missing = yield* resolveWith({
          env: { ...malformed.env, CLAUDE_CONFIG_DIR: `${malformed.root}/no-such-dir` },
          rows,
          query: "5",
        });
        expect(liveness(missing)).toStrictEqual([["claude-peer", "unknown"]]);
        expect(A.map(missing.steps, (step) => step.rung)).toStrictEqual(["pr-comment", "takeover"]);
      })
    );

    it.effect("prints the linked-environment search plan and exits zero when nothing local owns the key", () =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture({
          environments: [{ environmentId: "env-tbk", label: "tbk-worker", status: "reachable" }],
        });
        yield* Command.runWith(sessionCommand, { version: "0.0.0" })(["resolve", "3122", "--json"]).pipe(
          Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env: fixture.env }))
        );
        const lines = yield* TestConsole.logLines;
        const resolution = O.getOrThrow(
          SessionResolutionJson.decodeOption(String(A.last(lines).pipe(O.getOrElse(() => ""))))
        );
        assertNone(resolution.owner);
        expect(A.map(resolution.steps, (step) => [step.rung, step.instruction])).toStrictEqual([
          ["search-environments", `this host: t3_thread_search({ query: "3122", environmentId: "${LOCAL_ENV}" })`],
          [
            "search-environments",
            'tbk-worker (reachable): t3_thread_search({ query: "3122", environmentId: "env-tbk" })',
          ],
          ["pr-comment", 'bun run beep yeet gh pr comment 3122 --body "<message>"'],
          ["takeover", resolution.steps[3]?.instruction ?? ""],
        ]);
        expect(resolution.steps[3]?.instruction).toContain("--pr 3122");
      })
    );
  });
});

describe("session presence and resolve commands", () => {
  it.layer(Layer.fresh(testLayer), { timeout: "60 seconds" })((it) => {
    const runSession = Command.runWith(sessionCommand, { version: "0.0.0" });
    const withEnv = (env: Record<string, string>) =>
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }));
    const loggedAll = Effect.map(TestConsole.logLines, (lines) => A.map(lines, String));
    const erroredAll = Effect.map(TestConsole.errorLines, (lines) => A.map(lines, String));

    it.effect("session presence records this session's routes as text and JSON", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeFixture({});
        const env = { ...fixture.env, CLAUDE_CODE_SESSION_ID: "presence-cmd-1", CLAUDE_CODE_ENTRYPOINT: "cli" };
        yield* runSession(["presence"]).pipe(withEnv(env));
        yield* runSession(["presence", "--json"]).pipe(withEnv(env));
        const lines = yield* loggedAll;
        expect(lines).toContain("[session] presence for claude-code session presence-cmd-1: claude-peer");
        const json = O.getOrThrow(A.findLast(lines, Str.includes('"presence-cmd-1"')));
        assertSome(
          O.map(SessionPresenceJson.decodeOption(json), (row) => [row.entrypoint, row.sessionId]),
          ["cli", "presence-cmd-1"]
        );
        const files = yield* fs.readDirectory(fixture.env.BEEP_SESSION_STATE_ROOT);
        expect(A.filter(files, Str.endsWith(".presence.jsonl")).length).toBe(1);
        const content = yield* fs.readFileString(path.join(fixture.env.BEEP_SESSION_STATE_ROOT, files[0] ?? ""));
        expect(A.filter(Str.split(content, "\n"), Str.isNonEmpty).length).toBe(2);
      })
    );

    it.effect("session presence records nothing outside a harness session", () =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture({});
        yield* runSession(["presence"]).pipe(withEnv(fixture.env));
        const lines = yield* loggedAll;
        expect(lines).toContain("[session] no harness session id in this environment; nothing recorded");
      })
    );

    it.effect("session presence reports a failed write as a session error", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeFixture({});
        const blocked = path.join(fixture.root, "state-file");
        yield* fs.writeFileString(blocked, "");
        const failure = yield* runSession(["presence"]).pipe(
          withEnv({ ...fixture.env, BEEP_SESSION_STATE_ROOT: blocked, CLAUDE_CODE_SESSION_ID: "presence-cmd-2" }),
          Effect.flip
        );
        expect(String(failure)).toContain("[session]");
        const errors = yield* erroredAll;
        expect(A.some(errors, Str.startsWith("[session] "))).toBe(true);
      })
    );

    it.effect("session resolve prints the text report and refuses a blank key", () =>
      Effect.gen(function* () {
        const fixture = yield* makeFixture({});
        yield* runSession(["resolve", "4242"]).pipe(withEnv(fixture.env));
        const lines = yield* loggedAll;
        expect(A.some(lines, Str.startsWith("[session:resolve] 4242: no owner on this host"))).toBe(true);
        const failure = yield* runSession(["resolve", "  "]).pipe(withEnv(fixture.env), Effect.flip);
        expect(String(failure)).toContain("resolve needs a PR, branch, lane or checkout");
      })
    );

    it.effect(
      "the presence store fails typed on a row it cannot encode, and recordPresence skips a process with no id",
      () =>
        Effect.gen(function* () {
          const fixture = yield* makeFixture({});
          const config = ConfigProvider.fromEnv({ env: fixture.env });
          const store = yield* makeSessionPresenceStoreLive().pipe(
            Effect.provideService(ConfigProvider.ConfigProvider, config)
          );
          const invalid = SessionPresence.make(
            { ...presenceRow("valid", [], "codex"), sessionId: "" },
            { disableChecks: true }
          );
          const error = yield* store.append(invalid).pipe(Effect.flip);
          expect([error._tag, error.reason]).toStrictEqual(["SessionLedgerError", "decode"]);
          const none = yield* recordPresence({
            repository,
            clone: "/work/beep-effect",
            checkout: "/work/beep-effect",
            lane: "beep-effect",
            branch: "main",
          }).pipe(
            Effect.provideService(SessionPresenceStore, store),
            Effect.provideService(ConfigProvider.ConfigProvider, config)
          );
          assertNone(none);
        })
    );
  });
});

describe("route probe and resolver edges", () => {
  it.layer(Layer.fresh(testLayer), { timeout: "60 seconds" })((it) => {
    const withEnv = (env: Record<string, string>) =>
      Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnv({ env }));
    const route = (environmentId: string, threadId: string) =>
      T3ThreadRoute.make({ environmentId, threadId, provider: "codex" });

    it.effect("falls back to $HOME for the T3 home and reads none without either", () =>
      Effect.gen(function* () {
        const fromHome = yield* t3HomeDirectory.pipe(withEnv({ HOME: "/home/alice" }));
        assertSome(fromHome, "/home/alice/.t3");
        const neither = yield* t3HomeDirectory.pipe(withEnv({}));
        assertNone(neither);
        const environmentId = yield* localT3EnvironmentId.pipe(withEnv({}));
        assertNone(environmentId);
      })
    );

    it.effect("derives the Claude index and t3 CLI from $HOME when they are not configured", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeFixture({ threads: [{ id: "home-thread", status: "running", archived: false }] });
        // Mirror the fixture under $HOME's default names.
        yield* fs.symlink(path.join(fixture.root, "claude"), path.join(fixture.root, ".claude"));
        yield* fs.symlink(fixture.env.T3CODE_HOME, path.join(fixture.root, ".t3"));
        const probe = yield* makeSessionRouteProbeLive().pipe(withEnv({ HOME: fixture.root }));
        const peer = yield* probe.claudePeer("nobody");
        expect(peer.liveness).toBe("dead");
        const thread = yield* probe.t3Thread(route(LOCAL_ENV, "home-thread"));
        expect(thread.liveness).toBe("live");
      })
    );

    it.effect("finds the t3 CLI on PATH when neither T3CODE_CLI_PATH nor the T3 home has it", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const fixture = yield* makeFixture({ threads: [{ id: "path-thread", status: "running", archived: false }] });
        const bareHome = path.join(fixture.root, "bare-t3");
        yield* fs.makeDirectory(path.join(bareHome, "userdata"), { recursive: true });
        yield* fs.writeFileString(path.join(bareHome, "userdata", "environment-id"), LOCAL_ENV);
        const probe = yield* makeSessionRouteProbeLive().pipe(
          withEnv({
            HOME: fixture.root,
            T3CODE_HOME: bareHome,
            PATH: `${path.dirname(fixture.env.T3CODE_CLI_PATH)}:/usr/bin:/bin`,
          })
        );
        const thread = yield* probe.t3Thread(route(LOCAL_ENV, "path-thread"));
        expect([thread.liveness, thread.detail]).toStrictEqual(["live", "thread is running"]);
        const missing = yield* probe.t3Thread(route(LOCAL_ENV, "gone"));
        expect(missing.liveness).toBe("dead");
      })
    );

    it.effect("reads unknown everywhere when nothing is configured", () =>
      Effect.gen(function* () {
        const probe = yield* makeSessionRouteProbeLive().pipe(withEnv({}));
        const peer = yield* probe.claudePeer("nobody");
        expect([peer.liveness, peer.detail]).toStrictEqual([
          "unknown",
          "no Claude config directory (HOME and CLAUDE_CONFIG_DIR unset)",
        ]);
        const thread = yield* probe.t3Thread(route("env-x", "t"));
        expect([thread.liveness, thread.detail]).toStrictEqual([
          "unknown",
          "environment is not this host; linked environments could not be listed",
        ]);
      })
    );

    it.effect("separates a failing link listing, an unknown environment, an unrunnable CLI and a server error", () =>
      Effect.gen(function* () {
        const failing = yield* makeFixture({ environmentsFail: true });
        const noLinks = yield* makeSessionRouteProbeLive().pipe(withEnv(failing.env));
        const environments = yield* noLinks.environments;
        assertNone(environments);
        const linked = yield* makeFixture({
          environments: [{ environmentId: "env-other", label: "other", status: "reachable" }],
          failingThread: "flaky",
        });
        const probe = yield* makeSessionRouteProbeLive().pipe(withEnv(linked.env));
        const stranger = yield* probe.t3Thread(route("env-stranger", "t"));
        expect([stranger.liveness, stranger.detail]).toStrictEqual([
          "unknown",
          "environment is neither this host nor a linked one",
        ]);
        const flaky = yield* probe.t3Thread(route(LOCAL_ENV, "flaky"));
        expect([flaky.liveness, flaky.detail]).toStrictEqual([
          "unreachable",
          "the local T3 server did not answer (exit 2)",
        ]);
        const noCli = yield* makeSessionRouteProbeLive().pipe(
          withEnv({ ...linked.env, T3CODE_CLI_PATH: `${linked.root}/missing-t3` })
        );
        const unrunnable = yield* noCli.t3Thread(route(LOCAL_ENV, "flaky"));
        expect([unrunnable.liveness, unrunnable.detail]).toStrictEqual(["unknown", "the t3 CLI could not be run"]);
      })
    );

    it.effect("reads unknown, not dead, when /proc cannot be read", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const fixture = yield* makeFixture({
          liveIndex: [{ file: "1.json", content: liveIndexEntry(1, "1", "desk-1", "desk") }],
        });
        const noProc = FileSystem.FileSystem.of({
          ...fs,
          readFileString: Effect.fn("SessionRouteResolverTest.noProcRead")(function* (path: string, encoding?: string) {
            return Str.startsWith("/proc/")(path) ? yield* procDenied(path) : yield* fs.readFileString(path, encoding);
          }),
        });
        const probe = yield* makeSessionRouteProbeLive().pipe(
          withEnv(fixture.env),
          Effect.provideService(FileSystem.FileSystem, noProc)
        );
        const peer = yield* probe.claudePeer("desk-1");
        expect([peer.liveness, peer.detail]).toStrictEqual([
          "unknown",
          "/proc is unreadable, so the pid cannot be checked",
        ]);
      })
    );

    it.effect("resolves unnamed live peers, unroutable owners and non-PR keys with unreadable links", () =>
      Effect.gen(function* () {
        const start = yield* ownStart;
        const fixture = yield* makeFixture({
          liveIndex: [
            {
              file: `${process.pid}.json`,
              content: { pid: process.pid, procStart: start, sessionId: "unnamed", status: "busy" },
            },
          ],
          environmentsFail: true,
        });
        const rows = [
          ledgerRow({ checkout: "/work/unnamed", at: 1, pr: 11, sessionId: "unnamed" }),
          ledgerRow({ checkout: "/work/codex", at: 1, pr: 12, sessionId: "codex-1", harness: "codex" }),
          ledgerRow({ checkout: "/work/feat", at: 1, branch: "feat" }),
        ];
        const unnamed = yield* resolveWith({ env: fixture.env, rows, query: "11" });
        expect(liveness(unnamed)).toStrictEqual([["claude-peer", "live"]]);
        expect(unnamed.routes[0]?.detail).toContain("the session has no display name yet");
        assertNone(unnamed.routes[0]?.send ?? O.some("missing"));
        const codex = yield* resolveWith({ env: fixture.env, rows, query: "12" });
        expect(liveness(codex)).toStrictEqual([["unroutable", "unknown"]]);
        const twoKinds = yield* resolveWith({ env: fixture.env, rows, query: "feat" });
        assertSome(
          O.map(twoKinds.owner, (owner) => owner.matchedBy),
          ["branch", "lane", "checkout"]
        );
        const rendered = renderSessionResolution(twoKinds);
        expect(rendered).toContain("feat (feat) open by claude-code session unknown");
        expect(rendered).toContain("routes: none recorded (the claim has no session id)");
        const nobody = yield* resolveWith({ env: fixture.env, rows, query: "fix/nobody" });
        expect(A.map(nobody.steps, (step) => step.rung)).toStrictEqual([
          "search-environments",
          "pr-comment",
          "takeover",
        ]);
        expect(nobody.steps[0]?.instruction).toContain("List the linked environments with t3_environment_links");
        expect(nobody.steps[1]?.instruction).toContain("No PR is recorded for this key");
        expect(nobody.steps[2]?.instruction).toContain(
          "takeover-lane --branch takeover/lane --base origin/<pr branch>"
        );
      })
    );
  });
});
