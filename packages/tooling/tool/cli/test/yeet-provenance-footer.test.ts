import {
  BuildYeetVerdictInput,
  buildYeetVerdictForTesting,
  ensureProvenanceFooter,
  ensurePullRequest,
  GhPrView,
  layerPrSessionRegistryMemory,
  makePrSessionRegistryLive,
  PrSessionRegistry,
  persistPrSessionRecord,
  RepoPlanStep,
  RepoRunContext,
  recordMonitoredPrSession,
  recordPrProvenanceStampLane,
  renderPrProvenance,
  runYeetMergeLoop,
  runYeetWatchLoop,
  splicePrProvenanceFooter,
  toPublicPrProvenance,
  YeetWatchEnded,
} from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import { assert, describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Console, Effect, FileSystem, Layer, Ref, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { makeRecord, PlatformLayer, repository } from "./yeet-pr-fixtures.ts";
import type { YeetExecutedStep } from "@beep/repo-cli/test/Yeet";

const footer = renderPrProvenance(toPublicPrProvenance([makeRecord()], O.some(42), true));
const GhBody = S.Struct({ body: S.String });
const encodeGhBody = (body: string): string =>
  Result.getOrThrow(S.encodeUnknownResult(S.fromJsonString(GhBody))({ body }));
const context = (root: string) =>
  RepoRunContext.make({
    base: "origin/main",
    branch: "feat/yeet-pr-resume-footer",
    cwd: root,
    head: "HEAD",
    originalArgv: [],
    packetDir: ".beep/yeet",
    repoRoot: root,
    turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
  });
const configureRepo = (cwd: string) =>
  Effect.sync(() => {
    const commands = [
      ["git", "init", "-q"],
      ["git", "config", "user.email", "yeet@example.test"],
      ["git", "config", "user.name", "Yeet Test"],
      ["git", "config", "commit.gpgsign", "false"],
      ["git", "remote", "add", "origin", "git@github.com:beep-effect/beep-effect.git"],
      ["git", "commit", "--allow-empty", "-q", "-m", "feat(repo-cli): fixture"],
    ];
    if (!A.every(commands, (command) => Bun.spawnSync(command, { cwd, stderr: "pipe", stdout: "pipe" }).success))
      assert.fail("fixture git repository setup failed");
  });

const prStep = (id: string, label: string) =>
  RepoPlanStep.make({
    args: ["pr", "edit"],
    command: "gh",
    cwd: ".",
    id,
    label,
    mutability: "write",
    phase: "publish",
    resume: "never",
    scope: "repo",
  });

const prCreateStep = prStep("publish:02-pr-create", "publish:pr-create");
const provenanceStampStep = prStep("publish:03-pr-provenance-stamp", "publish:pr-provenance-stamp");

const makeGhRunner = Effect.fn("test.makeGhRunner")(function* (
  fs: FileSystem.FileSystem,
  initialBody: string,
  freshBody: string,
  afterWrite: (body: string) => string = (body) => body
) {
  const views = yield* Ref.make(0);
  const writes = yield* Ref.make(0);
  const written = yield* Ref.make("");
  const capture = Effect.fn("test.fakeGhRunner")(function* (
    _command: string,
    args: ReadonlyArray<string>,
    _cwd: string,
    _env: Record<string, string | undefined> | undefined = undefined
  ) {
    if (args[1] === "view") {
      const view = yield* Ref.getAndUpdate(views, (count) => count + 1);
      const current = view === 0 ? initialBody : view === 1 ? freshBody : afterWrite(yield* Ref.get(written));
      return { exitCode: 0, output: encodeGhBody(current), truncated: false };
    }
    const bodyPath = O.getOrElse(A.last(args), () => "");
    const body = yield* fs.readFileString(bodyPath).pipe(Effect.orDie);
    yield* Ref.set(written, body);
    yield* Ref.update(writes, (count) => count + 1);
    return { exitCode: 0, output: "", truncated: false };
  });
  return { capture, views, writes, written };
});

const runStamp = Effect.fn("test.runStamp")(function* (
  initialBody: string,
  freshBody: string,
  afterWrite?: (body: string) => string
) {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectory();
  yield* configureRepo(root);
  const provider = ConfigProvider.fromEnv({ env: { HOME: root, PWD: root, BEEP_YEET_STATE_ROOT: root } });
  const registry = yield* makePrSessionRegistryLive().pipe(
    Effect.provideService(ConfigProvider.ConfigProvider, provider)
  );
  yield* registry.append(makeRecord());
  const runner = yield* makeGhRunner(fs, initialBody, freshBody, afterWrite);
  yield* ensureProvenanceFooter(context(root), repository, 42, runner.capture).pipe(
    Effect.provideService(ConfigProvider.ConfigProvider, provider)
  );
  return {
    body: yield* Ref.get(runner.written),
    views: yield* Ref.get(runner.views),
    writes: yield* Ref.get(runner.writes),
  };
});

const makePublishGhRunner = Effect.fn("test.makePublishGhRunner")(function* (fs: FileSystem.FileSystem) {
  const body = yield* Ref.make("Pull request summary");
  const createBody = yield* Ref.make("");
  const capture = Effect.fn("test.fakePublishGhRunner")(function* (
    _command: string,
    args: ReadonlyArray<string>,
    _cwd: string,
    _env: Record<string, string | undefined> | undefined = undefined
  ) {
    if (args[1] === "create") {
      const bodyPath = O.getOrElse(A.last(args), () => "");
      yield* Ref.set(createBody, yield* fs.readFileString(bodyPath).pipe(Effect.orDie));
      return { exitCode: 0, output: "https://github.com/beep-effect/beep-effect/pull/42", truncated: false };
    }
    if (args[1] === "view") return { exitCode: 0, output: encodeGhBody(yield* Ref.get(body)), truncated: false };
    const bodyPath = O.getOrElse(A.last(args), () => "");
    yield* Ref.set(body, yield* fs.readFileString(bodyPath).pipe(Effect.orDie));
    return { exitCode: 0, output: "", truncated: false };
  });
  return { body, capture, createBody };
});

describe("Yeet provenance footer splice", () => {
  it("is idempotent for current markers", () => {
    const once = splicePrProvenanceFooter("Body", footer);
    expect(splicePrProvenanceFooter(once, footer)).toBe(once);
  });

  it("replaces a legacy v1 block", () => {
    const legacy =
      'Body\n\n---\n\n## Provenance\n\n- Branch: <code>old</code>\n- Harness: `codex`\n\n<!-- yeet-provenance\n{"schemaVersion":1,"branch":"old","harness":"codex"}\n-->\n';
    const next = splicePrProvenanceFooter(legacy, footer);
    expect(next).not.toContain('"schemaVersion":1');
    expect(next).toContain('"schemaVersion": 2');
  });

  it("preserves foreign trailing text", () => {
    const existing = `${splicePrProvenanceFooter("Body", footer)}\nForeign tail\n`;
    expect(splicePrProvenanceFooter(existing, footer)).toContain("Foreign tail");
  });

  it.effect("splices from the fresh body so a foreign pre-write edit survives", () =>
    Effect.gen(function* () {
      const result = yield* runStamp("Original body", "Original body\n\nForeign edit");
      expect(result.writes).toBe(1);
      expect(result.views).toBe(3);
      expect(result.body).toContain("Foreign edit");
      expect(result.body).toContain("<!-- yeet-provenance:start -->");
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("does not write when the fresh body already has the identical footer", () =>
    Effect.gen(function* () {
      const fresh = splicePrProvenanceFooter("Foreign edit", footer);
      const result = yield* runStamp("Original body", fresh);
      expect(result.views).toBe(2);
      expect(result.writes).toBe(0);
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("warns once and never rewrites after a post-write mismatch", () =>
    Effect.gen(function* () {
      let warnings = A.empty<unknown>();
      const currentConsole = yield* Console.Console;
      const warningConsole: Console.Console = {
        ...currentConsole,
        warn: (...args) => {
          warnings = A.appendAll(warnings, args);
        },
      };
      const result = yield* runStamp("Original body", "Original body", (body) => `${body}\nConcurrent edit`).pipe(
        Effect.provideService(Console.Console, warningConsole)
      );
      expect(result.views).toBe(3);
      expect(result.writes).toBe(1);
      expect(A.join(A.map(warnings, globalThis.String), "\n")).toContain("PR #42");
      expect(A.join(A.map(warnings, globalThis.String), "\n")).toContain("concurrent body edit");
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("mirrors when registry append is denied", () =>
    Effect.gen(function* () {
      const result = yield* persistPrSessionRecord(repository, Effect.fail("append denied"), Effect.void);
      expect(result.registryRowExists).toBe(false);
      expect(result.mirrorWritten).toBe(true);
      expect(result.repository).toStrictEqual(repository);
    })
  );

  it.effect("retains a registry row when mirroring fails", () =>
    Effect.gen(function* () {
      const result = yield* persistPrSessionRecord(repository, Effect.void, Effect.fail("mirror failed"));
      expect(result.registryRowExists).toBe(true);
      expect(result.mirrorWritten).toBe(false);
      expect(result.repository).toStrictEqual(repository);
    })
  );

  it.effect("records a successful early-PR create stamp in the verdict and starts from a fence-less body", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectory();
      yield* configureRepo(root);
      const registry = yield* PrSessionRegistry;
      const runner = yield* makePublishGhRunner(fs);
      const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>([]);
      const provider = ConfigProvider.fromEnv({ env: { HOME: root, PWD: root } });
      yield* ensurePullRequest(context(root), recorder, O.some(prCreateStep), O.some(provenanceStampStep), {
        capture: runner.capture,
        findOpen: () => Effect.succeedNone,
        registry,
        view: () => Effect.succeed(GhPrView.make({ headRefName: context(root).branch, number: 42, state: "OPEN" })),
      }).pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider));
      const createBody = yield* Ref.get(runner.createBody);
      expect(createBody).not.toContain("yeet-provenance");
      const rows = yield* registry.lookup(repository, 42);
      expect(rows[0]?.role).toBe("created");
      const executed = yield* Ref.get(recorder);
      const verdict = buildYeetVerdictForTesting(
        BuildYeetVerdictInput.make({
          base: "origin/main",
          branch: context(root).branch,
          createdAt: "2026-09-03T12:00:00.000Z",
          executed,
          head: "HEAD",
          message: "yeet publish succeeded.",
          mode: "publish",
          outcome: "success",
          packetPaths: [],
          planned: [prCreateStep, provenanceStampStep],
          runId: "fixture",
        })
      );
      expect(A.findFirst(verdict.lanes, (lane) => lane.id === provenanceStampStep.id)).toMatchObject({
        _tag: "Some",
        value: { status: "passed" },
      });
    }).pipe(provideScopedLayer(Layer.mergeAll(PlatformLayer, layerPrSessionRegistryMemory)))
  );

  it.effect("records pushed provenance and re-stamps an existing pull request", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectory();
      yield* configureRepo(root);
      const registry = yield* PrSessionRegistry;
      const runner = yield* makePublishGhRunner(fs);
      const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>([]);
      const existing = GhPrView.make({ headRefName: context(root).branch, number: 42, state: "OPEN" });
      const provider = ConfigProvider.fromEnv({ env: { HOME: root, PWD: root } });
      yield* ensurePullRequest(context(root), recorder, O.some(prCreateStep), O.some(provenanceStampStep), {
        capture: runner.capture,
        findOpen: () => Effect.succeedSome(existing),
        registry,
      }).pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider));
      const rows = yield* registry.lookup(repository, 42);
      expect(rows[0]?.role).toBe("pushed");
      expect(yield* Ref.get(runner.body)).toContain("yeet-provenance:start");
    }).pipe(provideScopedLayer(Layer.mergeAll(PlatformLayer, layerPrSessionRegistryMemory)))
  );

  it.effect("records failed and skipped provenance stamp outcomes without failing the publish", () =>
    Effect.gen(function* () {
      const recorder = yield* Ref.make<ReadonlyArray<YeetExecutedStep>>([]);
      yield* recordPrProvenanceStampLane(recorder, O.some(provenanceStampStep), O.some(42), O.some("footer warning"));
      yield* recordPrProvenanceStampLane(recorder, O.some(provenanceStampStep), O.none(), O.none());
      const executed = yield* Ref.get(recorder);
      expect(executed[0]).toMatchObject({ status: "failed", result: { exitCode: 1, output: "footer warning" } });
      expect(executed[1]).toMatchObject({ status: "skipped", result: { exitCode: 0 } });
    })
  );

  it.effect("records and stamps monitored provenance once for the classic monitor route", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectory();
      yield* configureRepo(root);
      const registry = yield* PrSessionRegistry;
      const runner = yield* makeGhRunner(fs, "Body", "Body");
      const provider = ConfigProvider.fromEnv({ env: { HOME: root, PWD: root } });
      yield* recordMonitoredPrSession(context(root), 42, runner.capture, registry).pipe(
        Effect.provideService(ConfigProvider.ConfigProvider, provider)
      );
      expect(yield* registry.lookup(repository, 42)).toHaveLength(1);
      expect(yield* Ref.get(runner.writes)).toBe(1);
    }).pipe(provideScopedLayer(Layer.mergeAll(PlatformLayer, layerPrSessionRegistryMemory)))
  );

  it.effect("records and stamps monitored provenance once before the watch route polls", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectory();
      yield* configureRepo(root);
      const registry = yield* PrSessionRegistry;
      const runner = yield* makeGhRunner(fs, "Body", "Body");
      const routeContext = context(root);
      const provider = ConfigProvider.fromEnv({ env: { HOME: root, PWD: root } });
      yield* runYeetWatchLoop({ base: "origin/main", head: "HEAD", packetDir: ".beep/yeet" }, false, {
        capture: runner.capture,
        hydrate: () => Effect.succeed(routeContext),
        registry,
        view: () => Effect.succeed(GhPrView.make({ headRefName: routeContext.branch, number: 42, state: "OPEN" })),
        watchStream: () =>
          Effect.succeed(
            YeetWatchEnded.make({
              at: "2026-09-03T12:00:00.000Z",
              failing: 0,
              headSha: "abcdef123456",
              reason: "all-terminal",
            })
          ),
      }).pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider));
      expect(yield* registry.lookup(repository, 42)).toHaveLength(1);
      expect(yield* Ref.get(runner.writes)).toBe(1);
    }).pipe(provideScopedLayer(Layer.mergeAll(PlatformLayer, layerPrSessionRegistryMemory)))
  );

  it.effect("records and stamps monitored provenance once before the until-merged route polls", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectory();
      yield* configureRepo(root);
      const registry = yield* PrSessionRegistry;
      const runner = yield* makeGhRunner(fs, "Body", "Body");
      const routeContext = context(root);
      const provider = ConfigProvider.fromEnv({ env: { HOME: root, PWD: root } });
      const terminal = yield* runYeetMergeLoop(
        { base: "origin/main", head: "HEAD", packetDir: ".beep/yeet" },
        {
          capture: runner.capture,
          hydrate: () => Effect.succeed(routeContext),
          mergeLoop: () => Effect.succeed("closed"),
          registry,
          view: () => Effect.succeed(GhPrView.make({ headRefName: routeContext.branch, number: 42, state: "OPEN" })),
        }
      ).pipe(Effect.provideService(ConfigProvider.ConfigProvider, provider));
      expect(terminal).toBe("closed");
      expect(yield* registry.lookup(repository, 42)).toHaveLength(1);
      expect(yield* Ref.get(runner.writes)).toBe(1);
    }).pipe(provideScopedLayer(Layer.mergeAll(PlatformLayer, layerPrSessionRegistryMemory)))
  );
});
