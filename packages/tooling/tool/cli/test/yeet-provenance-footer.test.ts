import {
  BuildYeetVerdictInput,
  buildYeetVerdictForTesting,
  detectPrRepository,
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
import { ConfigProvider, Console, Effect, FileSystem, Layer, pipe, Ref, Result } from "effect";
import * as A from "effect/Array";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeRecord, PlatformLayer, repository } from "./yeet-pr-fixtures.ts";
import type { YeetExecutedStep } from "@beep/repo-cli/test/Yeet";

const footer = renderPrProvenance(toPublicPrProvenance([makeRecord()], O.some(42), true));
const GhBody = S.Struct({ body: S.String, updatedAt: S.String });
const GhBodyEdit = S.Struct({ editedAt: S.String, editor: S.NullOr(S.Struct({ login: S.String })), diff: S.String });
const GhBodyEditsDocument = S.Struct({
  data: S.Struct({
    repository: S.Struct({ pullRequest: S.Struct({ userContentEdits: S.Struct({ nodes: S.Array(GhBodyEdit) }) }) }),
  }),
});
type GhBodyEdit = typeof GhBodyEdit.Type;
const editedAt = "2026-09-03T12:01:00Z";
// The `gh pr view --json` fields gh 2.99 exposes that the stamp may ask for.
// A field outside this set is exactly what shipped the `lastEditedAt` skip, so
// the fake refuses it the way gh does instead of returning a snapshot anyway.
const GhPrViewJsonFields = HashSet.make("body", "createdAt", "updatedAt", "number", "title", "url", "state");
const unsupportedGhPrViewField = (args: ReadonlyArray<string>): O.Option<string> =>
  pipe(
    A.findFirstIndex(args, (arg) => arg === "--json"),
    O.flatMap((index) => A.get(args, index + 1)),
    O.flatMap((fields) => A.findFirst(Str.split(fields, ","), (field) => !HashSet.has(GhPrViewJsonFields, field)))
  );
interface GhCaptureResult {
  readonly exitCode: number;
  readonly output: string;
  readonly truncated: boolean;
}
const ghUnknownJsonField = (field: string): GhCaptureResult => ({
  exitCode: 1,
  output: `Unknown JSON field: "${field}"\nAvailable fields:\n  body\n  createdAt\n  updatedAt`,
  truncated: false,
});
// Answers a `gh pr view --json …` call the way gh does: refuse an unsupported
// field before serving the snapshot the fake would otherwise return.
const ghPrView = <E, R>(
  args: ReadonlyArray<string>,
  snapshot: Effect.Effect<GhCaptureResult, E, R>
): Effect.Effect<GhCaptureResult, E, R> =>
  O.match(unsupportedGhPrViewField(args), {
    onNone: () => snapshot,
    onSome: (field) => Effect.succeed(ghUnknownJsonField(field)),
  });
const encodeGhBody = (body: string, updatedAt: string = editedAt): string =>
  Result.getOrThrow(S.encodeUnknownResult(S.fromJsonString(GhBody))({ body, updatedAt }));
const encodeGhBodyEdits = (nodes: ReadonlyArray<GhBodyEdit>): string =>
  Result.getOrThrow(
    S.encodeUnknownResult(S.fromJsonString(GhBodyEditsDocument))({
      data: { repository: { pullRequest: { userContentEdits: { nodes } } } },
    })
  );
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
  afterWrite: (body: string) => string = (body) => body,
  editHistory: (writtenBodies: ReadonlyArray<string>, read: number) => ReadonlyArray<GhBodyEdit> = (writtenBodies) => [
    {
      diff: O.getOrElse(A.last(writtenBodies), () => ""),
      editedAt: "2026-09-03T12:03:00Z",
      editor: { login: "yeet" },
    },
  ],
  freshUpdatedAt: string = editedAt
) {
  const views = yield* Ref.make(0);
  const writes = yield* Ref.make(0);
  const written = yield* Ref.make("");
  const writtenBodies = yield* Ref.make<ReadonlyArray<string>>([]);
  const historyReads = yield* Ref.make(0);
  const capture = Effect.fn("test.fakeGhRunner")(function* (
    _command: string,
    args: ReadonlyArray<string>,
    _cwd: string,
    _env: Record<string, string | undefined> | undefined = undefined
  ) {
    if (args[1] === "view") {
      return yield* ghPrView(
        args,
        Effect.gen(function* () {
          const view = yield* Ref.getAndUpdate(views, (count) => count + 1);
          const current = view === 0 ? initialBody : view === 1 ? freshBody : afterWrite(yield* Ref.get(written));
          return { exitCode: 0, output: encodeGhBody(current, freshUpdatedAt), truncated: false };
        })
      );
    }
    if (args[1] === "graphql") {
      const read = yield* Ref.getAndUpdate(historyReads, (count) => count + 1);
      return {
        exitCode: 0,
        output: encodeGhBodyEdits(editHistory(yield* Ref.get(writtenBodies), read)),
        truncated: false,
      };
    }
    const bodyPath = O.getOrElse(A.last(args), () => "");
    const body = yield* fs.readFileString(bodyPath).pipe(Effect.orDie);
    yield* Ref.set(written, body);
    yield* Ref.update(writtenBodies, A.append(body));
    yield* Ref.update(writes, (count) => count + 1);
    return { exitCode: 0, output: "", truncated: false };
  });
  return { capture, historyReads, views, writes, written, writtenBodies };
});

const runStamp = Effect.fn("test.runStamp")(function* (
  initialBody: string,
  freshBody: string,
  afterWrite?: (body: string) => string,
  editHistory?: (writtenBodies: ReadonlyArray<string>, read: number) => ReadonlyArray<GhBodyEdit>,
  freshUpdatedAt?: string
) {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectory();
  yield* configureRepo(root);
  const provider = ConfigProvider.fromEnv({ env: { HOME: root, PWD: root, BEEP_YEET_STATE_ROOT: root } });
  const registry = yield* makePrSessionRegistryLive().pipe(
    Effect.provideService(ConfigProvider.ConfigProvider, provider)
  );
  yield* registry.append(makeRecord());
  const runner = yield* makeGhRunner(fs, initialBody, freshBody, afterWrite, editHistory, freshUpdatedAt);
  yield* ensureProvenanceFooter(context(root), repository, 42, runner.capture).pipe(
    Effect.provideService(ConfigProvider.ConfigProvider, provider)
  );
  return {
    body: yield* Ref.get(runner.written),
    bodies: yield* Ref.get(runner.writtenBodies),
    historyReads: yield* Ref.get(runner.historyReads),
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
    if (args[1] === "view") {
      return yield* ghPrView(
        args,
        Effect.map(Ref.get(body), (current) => ({ exitCode: 0, output: encodeGhBody(current), truncated: false }))
      );
    }
    if (args[1] === "graphql") {
      return {
        exitCode: 0,
        output: encodeGhBodyEdits([
          {
            diff: yield* Ref.get(body),
            editedAt: "2026-09-03T12:03:00Z",
            editor: { login: "yeet" },
          },
        ]),
        truncated: false,
      };
    }
    const bodyPath = O.getOrElse(A.last(args), () => "");
    yield* Ref.set(body, yield* fs.readFileString(bodyPath).pipe(Effect.orDie));
    return { exitCode: 0, output: "", truncated: false };
  });
  return { body, capture, createBody };
});

describe("Yeet provenance footer splice", () => {
  it("refuses gh pr view fields the CLI does not expose, as gh does", () => {
    expect(unsupportedGhPrViewField(["pr", "view", "42", "--json", "body,createdAt,lastEditedAt"])).toStrictEqual(
      O.some("lastEditedAt")
    );
    expect(unsupportedGhPrViewField(["pr", "view", "42", "--json", "body,updatedAt"])).toStrictEqual(O.none());
    expect(unsupportedGhPrViewField(["pr", "view", "42", "--json", "body"])).toStrictEqual(O.none());
  });

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

  it.effect("repairs a foreign edit between the fresh read and first write", () =>
    Effect.gen(function* () {
      let warnings = A.empty<unknown>();
      const currentConsole = yield* Console.Console;
      const warningConsole: Console.Console = {
        ...currentConsole,
        warn: (...args) => {
          warnings = A.appendAll(warnings, args);
        },
      };
      const result = yield* runStamp("Original body", "Original body", undefined, (bodies) => [
        { diff: "Older foreign body", editedAt: "2026-09-03T12:01:30Z", editor: { login: "earlier-editor" } },
        { diff: "Foreign body", editedAt: "2026-09-03T12:02:00Z", editor: null },
        {
          diff: O.getOrElse(A.head(bodies), () => ""),
          editedAt: "2026-09-03T12:03:00Z",
          editor: { login: "yeet" },
        },
        ...O.match(A.get(bodies, 1), {
          onNone: A.empty,
          onSome: (diff) => [{ diff, editedAt: "2026-09-03T12:04:00Z", editor: { login: "yeet" } }],
        }),
      ]).pipe(Effect.provideService(Console.Console, warningConsole));
      expect(result.writes).toBe(2);
      expect(result.historyReads).toBe(2);
      expect(result.body).toContain("Foreign body");
      expect(result.body).toContain("<!-- yeet-provenance:start -->");
      expect(warnings).toHaveLength(1);
      expect(A.join(A.map(warnings, globalThis.String), "\n")).toContain("PR #42");
      expect(A.join(A.map(warnings, globalThis.String), "\n")).toContain("an unknown editor");
      expect(A.join(A.map(warnings, globalThis.String), "\n")).toContain("preserved");
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("writes once without warning when edit history has no foreign edit", () =>
    Effect.gen(function* () {
      let warnings = A.empty<unknown>();
      const currentConsole = yield* Console.Console;
      const warningConsole: Console.Console = {
        ...currentConsole,
        warn: (...args) => {
          warnings = A.appendAll(warnings, args);
        },
      };
      const result = yield* runStamp("Original body", "Original body").pipe(
        Effect.provideService(Console.Console, warningConsole)
      );
      expect(result.views).toBe(3);
      expect(result.writes).toBe(1);
      expect(result.historyReads).toBe(1);
      expect(warnings).toHaveLength(0);
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("reconciles two rounds of contention and preserves the newest foreign body", () =>
    Effect.gen(function* () {
      let warnings = A.empty<unknown>();
      const currentConsole = yield* Console.Console;
      const warningConsole: Console.Console = {
        ...currentConsole,
        warn: (...args) => {
          warnings = A.appendAll(warnings, args);
        },
      };
      const result = yield* runStamp("Original body", "Original body", undefined, (bodies, read) => {
        const firstWrite = O.getOrElse(A.head(bodies), () => "");
        const firstHistory: ReadonlyArray<GhBodyEdit> = [
          { diff: "First foreign body", editedAt: "2026-09-03T12:02:00Z", editor: { login: "alice" } },
          { diff: firstWrite, editedAt: "2026-09-03T12:03:00Z", editor: { login: "yeet" } },
        ];
        if (read === 0) return firstHistory;
        const firstRepair = O.getOrElse(A.get(bodies, 1), () => "");
        const secondHistory: ReadonlyArray<GhBodyEdit> = [
          ...firstHistory,
          { diff: firstRepair, editedAt: "2026-09-03T12:04:00Z", editor: { login: "yeet" } },
          {
            diff: "First foreign body\n\nSecond foreign edit",
            editedAt: "2026-09-03T12:05:00Z",
            editor: { login: "bob" },
          },
        ];
        if (read === 1) return secondHistory;
        return [
          ...secondHistory,
          {
            diff: O.getOrElse(A.get(bodies, 2), () => ""),
            editedAt: "2026-09-03T12:06:00Z",
            editor: { login: "yeet" },
          },
        ];
      }).pipe(Effect.provideService(Console.Console, warningConsole));
      expect(result.writes).toBe(3);
      expect(result.historyReads).toBe(3);
      expect(result.body).toContain("First foreign body");
      expect(result.body).toContain("Second foreign edit");
      expect(result.body).toContain("<!-- yeet-provenance:start -->");
      expect(warnings).toHaveLength(1);
      expect(A.join(A.map(warnings, globalThis.String), "\n")).toContain("PR #42");
      expect(A.join(A.map(warnings, globalThis.String), "\n")).toContain("bob");
      expect(A.join(A.map(warnings, globalThis.String), "\n")).toContain("preserved");
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("repairs an edit that landed between a history read and the next reconcile write", () =>
    Effect.gen(function* () {
      let warnings = A.empty<unknown>();
      const currentConsole = yield* Console.Console;
      const warningConsole: Console.Console = {
        ...currentConsole,
        warn: (...args) => {
          warnings = A.appendAll(warnings, args);
        },
      };
      const result = yield* runStamp("Original body", "Original body", undefined, (bodies, read) => {
        const firstWrite = O.getOrElse(A.head(bodies), () => "");
        const firstHistory: ReadonlyArray<GhBodyEdit> = [
          { diff: "First foreign body", editedAt: "2026-09-03T12:02:00Z", editor: { login: "alice" } },
          { diff: firstWrite, editedAt: "2026-09-03T12:03:00Z", editor: { login: "yeet" } },
        ];
        if (read === 0) return firstHistory;
        // Bob's edit lands after the first history read but before the repair
        // write overtakes it, so it is older than the stamp's own edit.
        const firstRepair = O.getOrElse(A.get(bodies, 1), () => "");
        const secondHistory: ReadonlyArray<GhBodyEdit> = [
          ...firstHistory,
          {
            diff: "First foreign body\n\nSlipped in before the repair",
            editedAt: "2026-09-03T12:03:30Z",
            editor: { login: "bob" },
          },
          { diff: firstRepair, editedAt: "2026-09-03T12:04:00Z", editor: { login: "yeet" } },
        ];
        if (read === 1) return secondHistory;
        return [
          ...secondHistory,
          {
            diff: O.getOrElse(A.get(bodies, 2), () => ""),
            editedAt: "2026-09-03T12:05:00Z",
            editor: { login: "yeet" },
          },
        ];
      }).pipe(Effect.provideService(Console.Console, warningConsole));
      expect(result.writes).toBe(3);
      expect(result.historyReads).toBe(3);
      expect(result.body).toContain("Slipped in before the repair");
      expect(result.body).toContain("<!-- yeet-provenance:start -->");
      expect(warnings).toHaveLength(1);
      expect(A.join(A.map(warnings, globalThis.String), "\n")).toContain("bob");
      expect(A.join(A.map(warnings, globalThis.String), "\n")).toContain("preserved");
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("treats an edit recorded in the same second as the baseline as foreign", () =>
    Effect.gen(function* () {
      const result = yield* runStamp("Original body", "Original body", undefined, (bodies, read) => {
        const firstWrite = O.getOrElse(A.head(bodies), () => "");
        const firstHistory: ReadonlyArray<GhBodyEdit> = [
          { diff: "First foreign body", editedAt: "2026-09-03T12:02:00Z", editor: { login: "alice" } },
          { diff: firstWrite, editedAt: "2026-09-03T12:03:00Z", editor: { login: "yeet" } },
        ];
        if (read === 0) return firstHistory;
        const firstRepair = O.getOrElse(A.get(bodies, 1), () => "");
        const secondHistory: ReadonlyArray<GhBodyEdit> = [
          ...firstHistory,
          {
            diff: "First foreign body\n\nSame second as the baseline",
            editedAt: "2026-09-03T12:02:00Z",
            editor: { login: "carol" },
          },
          { diff: firstRepair, editedAt: "2026-09-03T12:04:00Z", editor: { login: "yeet" } },
        ];
        if (read === 1) return secondHistory;
        return [
          ...secondHistory,
          {
            diff: O.getOrElse(A.get(bodies, 2), () => ""),
            editedAt: "2026-09-03T12:05:00Z",
            editor: { login: "yeet" },
          },
        ];
      });
      expect(result.writes).toBe(3);
      expect(result.body).toContain("Same second as the baseline");
      expect(result.body).toContain("<!-- yeet-provenance:start -->");
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("restores the edit its final write overtook when contention outlasts the bound", () =>
    Effect.gen(function* () {
      let warnings = A.empty<unknown>();
      const currentConsole = yield* Console.Console;
      const warningConsole: Console.Console = {
        ...currentConsole,
        warn: (...args) => {
          warnings = A.appendAll(warnings, args);
        },
      };
      const foreignBodies = A.make("Foreign one", "Foreign two", "Foreign three", "Newest foreign body");
      const ownMinutes = A.make("03", "05", "07", "09");
      const foreignMinutes = A.make("04", "06", "08", "10");
      const result = yield* runStamp("Original body", "Original body", undefined, (bodies, read) => {
        const written = O.getOrElse(A.get(bodies, read), () => "");
        return [
          {
            diff: written,
            editedAt: `2026-09-03T12:${O.getOrElse(A.get(ownMinutes, read), () => "09")}:00Z`,
            editor: { login: "yeet" },
          },
          {
            diff: O.getOrElse(A.get(foreignBodies, read), () => "Newest foreign body"),
            editedAt: `2026-09-03T12:${O.getOrElse(A.get(foreignMinutes, read), () => "10")}:00Z`,
            editor: { login: read === 3 ? "dana" : "concurrent-editor" },
          },
        ];
      }).pipe(Effect.provideService(Console.Console, warningConsole));
      expect(result.writes).toBe(5);
      expect(result.body).toBe("Newest foreign body");
      expect(result.body).not.toContain("yeet-provenance");
      expect(warnings).toHaveLength(1);
      expect(A.join(A.map(warnings, globalThis.String), "\n")).toContain("PR #42");
      expect(A.join(A.map(warnings, globalThis.String), "\n")).toContain("dana");
      expect(A.join(A.map(warnings, globalThis.String), "\n")).toContain("yeet monitor");
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("leaves a newer edit untouched when it lands after the final reconcile write", () =>
    Effect.gen(function* () {
      let warnings = A.empty<unknown>();
      const currentConsole = yield* Console.Console;
      const warningConsole: Console.Console = {
        ...currentConsole,
        warn: (...args) => {
          warnings = A.appendAll(warnings, args);
        },
      };
      const foreignBodies = A.make("Foreign one", "Foreign two", "Foreign three", "Newest foreign body");
      const ownMinutes = A.make("03", "05", "07", "09");
      const foreignMinutes = A.make("04", "06", "08", "10");
      const result = yield* runStamp(
        "Original body",
        "Original body",
        () => "Even newer edit",
        (bodies, read) => {
          const written = O.getOrElse(A.get(bodies, read), () => "");
          return [
            {
              diff: written,
              editedAt: `2026-09-03T12:${O.getOrElse(A.get(ownMinutes, read), () => "09")}:00Z`,
              editor: { login: "yeet" },
            },
            {
              diff: O.getOrElse(A.get(foreignBodies, read), () => "Newest foreign body"),
              editedAt: `2026-09-03T12:${O.getOrElse(A.get(foreignMinutes, read), () => "10")}:00Z`,
              editor: { login: "concurrent-editor" },
            },
          ];
        }
      ).pipe(Effect.provideService(Console.Console, warningConsole));
      expect(result.writes).toBe(4);
      expect(warnings).toHaveLength(1);
      expect(A.join(A.map(warnings, globalThis.String), "\n")).toContain("left the newer concurrent body edit");
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("ignores an edit older than the snapshot's updatedAt whose body the snapshot already carries", () =>
    Effect.gen(function* () {
      let warnings = A.empty<unknown>();
      const currentConsole = yield* Console.Console;
      const warningConsole: Console.Console = {
        ...currentConsole,
        warn: (...args) => {
          warnings = A.appendAll(warnings, args);
        },
      };
      const result = yield* runStamp(
        "Original body",
        "Original body",
        undefined,
        (bodies) => [
          { diff: "Original body", editedAt: "2026-09-03T12:00:30Z", editor: { login: "alice" } },
          { diff: O.getOrElse(A.head(bodies), () => ""), editedAt: "2026-09-03T12:03:00Z", editor: { login: "yeet" } },
        ],
        "2026-09-03T12:01:00Z"
      ).pipe(Effect.provideService(Console.Console, warningConsole));
      expect(result.writes).toBe(1);
      expect(result.historyReads).toBe(1);
      expect(warnings).toHaveLength(0);
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("re-splices an edit stamped in the same second as the snapshot's updatedAt", () =>
    Effect.gen(function* () {
      const result = yield* runStamp(
        "Original body",
        "Original body",
        undefined,
        (bodies, read) => {
          const firstWrite = O.getOrElse(A.head(bodies), () => "");
          const history: ReadonlyArray<GhBodyEdit> = [
            { diff: "Edited in the snapshot's second", editedAt: "2026-09-03T12:01:00Z", editor: { login: "bob" } },
            { diff: firstWrite, editedAt: "2026-09-03T12:03:00Z", editor: { login: "yeet" } },
          ];
          return read === 0
            ? history
            : [
                ...history,
                {
                  diff: O.getOrElse(A.get(bodies, 1), () => ""),
                  editedAt: "2026-09-03T12:04:00Z",
                  editor: { login: "yeet" },
                },
              ];
        },
        "2026-09-03T12:01:00Z"
      );
      expect(result.writes).toBe(2);
      expect(result.body).toContain("Edited in the snapshot's second");
      expect(result.body).toContain("<!-- yeet-provenance:start -->");
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

  it.effect("lowercases a mixed-case origin so URL and origin lookups share one registry partition", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectory();
      yield* configureRepo(root);
      yield* Effect.sync(() => {
        const result = Bun.spawnSync(
          ["git", "remote", "set-url", "origin", "https://github.com/Beep-Effect/Beep-Effect.git"],
          { cwd: root, stderr: "pipe", stdout: "pipe" }
        );
        if (!result.success) assert.fail("fixture origin update failed");
      });
      const detected = yield* detectPrRepository(root);
      expect(detected.owner).toBe("beep-effect");
      expect(detected.name).toBe("beep-effect");
    }).pipe(provideScopedLayer(PlatformLayer))
  );

  it.effect("skips stamping without calling GitHub when the registry has no rows", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectory();
      const registry = yield* PrSessionRegistry;
      const calls = yield* Ref.make(0);
      const capture = Effect.fn("test.unexpectedGhRunner")(function* () {
        yield* Ref.update(calls, (count) => count + 1);
        return { exitCode: 0, output: "", truncated: false };
      });
      const warning = yield* ensureProvenanceFooter(context(root), repository, 42, capture, registry);
      expect(O.isSome(warning)).toBe(true);
      expect(yield* Ref.get(calls)).toBe(0);
    }).pipe(provideScopedLayer(Layer.mergeAll(PlatformLayer, layerPrSessionRegistryMemory)))
  );

  it.effect("keeps initial and pre-write GitHub read failures non-fatal", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const root = yield* fs.makeTempDirectory();
      const registry = yield* PrSessionRegistry;
      yield* registry.append(makeRecord());
      const initialFailure = Effect.fn("test.initialReadFailure")(function* () {
        return { exitCode: 1, output: "initial read denied", truncated: false };
      });
      const initialWarning = yield* ensureProvenanceFooter(context(root), repository, 42, initialFailure, registry);
      expect(O.getOrElse(initialWarning, () => "")).toContain("initial read denied");

      const calls = yield* Ref.make(0);
      const snapshotFailure = Effect.fn("test.snapshotReadFailure")(function* () {
        const call = yield* Ref.getAndUpdate(calls, (count) => count + 1);
        return call === 0
          ? { exitCode: 0, output: encodeGhBody("Body"), truncated: false }
          : { exitCode: 1, output: "snapshot read denied", truncated: false };
      });
      const snapshotWarning = yield* ensureProvenanceFooter(context(root), repository, 42, snapshotFailure, registry);
      expect(O.getOrElse(snapshotWarning, () => "")).toContain("snapshot read denied");
    }).pipe(provideScopedLayer(Layer.mergeAll(PlatformLayer, layerPrSessionRegistryMemory)))
  );
});
