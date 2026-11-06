import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { Git } from "@beep/git/Git";
import {
  collectRemoteChecksForTesting,
  collectYeetStatus,
  collectYeetWatchSnapshot,
  dispatchYeetCheckFailure,
  GhStatusCheck,
  RepoRunContext,
  YeetCheckSignal,
  YeetHeadRed,
  YeetInboxRowJson,
  YeetWatchCheck,
  yeetCheckRecordInstant,
  yeetCheckRecordText,
  yeetFirstRed,
  yeetInboxPaths,
} from "@beep/repo-cli/test/Yeet";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow, identity } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import { provideLegacyGh } from "./support/YeetGithub.ts";

const decodeGhStatusChecks = S.decodeUnknownEffect(S.fromJsonString(S.Array(GhStatusCheck)));
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
const at = "2026-09-25T12:00:00.000Z";
const link = "https://github.com/beep/beep/actions/runs/9/job/9";

const contextFor = (root: string) =>
  RepoRunContext.make({
    base: "origin/main",
    branch: "feature/fidelity",
    cwd: root,
    head: "HEAD",
    originalArgv: [],
    packetDir: ".beep/yeet",
    repoRoot: root,
    turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
  });

// One pull request both collectors read: the union of the fields `yeet status`
// and `yeet monitor --watch` ask gh pr view for.
const pullRequestJson = Result.getOrThrowWith(
  S.encodeUnknownResult(S.fromJsonString(S.Unknown))({
    headRefOid: "abc123def456",
    id: "PR_fidelity",
    isDraft: false,
    labels: [],
    mergeable: "MERGEABLE",
    mergeStateStatus: "BLOCKED",
    number: 754,
    reviewDecision: null,
    state: "OPEN",
    url: "https://github.com/beep/beep/pull/754",
  }),
  identity
);

// The full seven-field gh record. The external status carries gh's zero time
// and an empty workflow, as Vercel and CodeRabbit do on a live PR.
const checksJson = Result.getOrThrowWith(
  S.encodeUnknownResult(S.fromJsonString(S.Unknown))([
    {
      bucket: "fail",
      completedAt: "2026-09-25T11:53:05Z",
      link,
      name: "Check / Coverage",
      startedAt: "2026-09-25T11:27:04Z",
      state: "FAILURE",
      workflow: "Check",
    },
    {
      bucket: "fail",
      completedAt: "0001-01-01T00:00:00Z",
      link: "",
      name: "Vercel",
      startedAt: "0001-01-01T00:00:00Z",
      state: "FAILURE",
      workflow: "",
    },
  ]),
  identity
);
const requiredChecksJson = Result.getOrThrowWith(
  S.encodeUnknownResult(S.fromJsonString(S.Unknown))([
    {
      bucket: "fail",
      completedAt: "2026-09-25T11:53:05Z",
      link,
      name: "Check / Coverage",
      startedAt: "2026-09-25T11:27:04Z",
      state: "FAILURE",
      workflow: "Check",
    },
  ]),
  identity
);
const threadsJson = Result.getOrThrowWith(
  S.encodeUnknownResult(S.fromJsonString(S.Unknown))({
    data: {
      node: {
        author: { login: "author" },
        reviewThreads: { nodes: [], pageInfo: { endCursor: null, hasNextPage: false } },
      },
    },
  }),
  identity
);

const isPrChecks = (args: ReadonlyArray<string>) => args[0] === "pr" && args[1] === "checks";

// Answers every read of both collectors; each `gh pr checks` argv stays in `spawns`.
const fidelitySpawner = () =>
  ScriptedSpawner.make((command, args) => {
    if (command === "git") return {};
    if (args[0] === "pr" && args[1] === "view") return { stdout: pullRequestJson };
    if (isPrChecks(args)) return { stdout: A.contains(args, "--required") ? requiredChecksJson : checksJson };
    return { stdout: args[0] === "api" ? threadsJson : "[]" };
  });

const checkArgsOf = (spawner: ScriptedSpawner) =>
  A.map(
    A.filter(spawner.spawns, (spawn) => isPrChecks(spawn.args)),
    (spawn) => spawn.args
  );

const withGh = (spawner: ScriptedSpawner) =>
  flow(provideLegacyGh, Effect.provideServiceEffect(Git, Git.make), provideSpawner(spawner));

const FileSystemLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const PlatformLayer = Layer.mergeAll(BunCrypto.layer, FileSystemLayer);

const tempRoot = Effect.fn("checkFidelityTest.tempRoot")(function* () {
  const fs = yield* FileSystem.FileSystem;
  return yield* fs.makeTempDirectoryScoped({ prefix: "yeet-check-fidelity-" });
});

const readRows = Effect.fn("checkFidelityTest.readRows")(function* (root: string) {
  const fs = yield* FileSystem.FileSystem;
  const paths = yield* yeetInboxPaths(root);
  const text = yield* fs.readFileString(paths.failuresPath);
  return yield* Effect.forEach(A.filter(Str.split(text, "\n"), Str.isNonEmpty), (line) =>
    YeetInboxRowJson.decode(line)
  );
});

describe("check record normalization", () => {
  it("reads gh's zero time, null, empty, and missing instants as absent", () => {
    assertNone(yeetCheckRecordInstant("0001-01-01T00:00:00Z"));
    assertNone(yeetCheckRecordInstant(null));
    assertNone(yeetCheckRecordInstant(undefined));
    assertNone(yeetCheckRecordInstant(""));
    assertNone(yeetCheckRecordInstant("not a time"));
    assertSome(yeetCheckRecordInstant("2026-09-25T11:53:05Z"), "2026-09-25T11:53:05Z");
  });

  it("reads an empty or missing link and workflow as absent", () => {
    assertNone(yeetCheckRecordText(""));
    assertNone(yeetCheckRecordText(null));
    assertNone(yeetCheckRecordText(undefined));
    assertSome(yeetCheckRecordText("Check"), "Check");
  });

  it.effect("decodes census rows with the four new fields absent, null, or present", () =>
    Effect.gen(function* () {
      const encodedJson = yield* encodeJson([
        { bucket: "pass", name: "Lint", state: "SUCCESS" },
        {
          bucket: "pass",
          completedAt: null,
          link: null,
          name: "Status",
          startedAt: null,
          state: "SUCCESS",
          workflow: null,
        },
        {
          bucket: "fail",
          completedAt: "2026-09-25T11:53:05Z",
          link,
          name: "Check",
          state: "FAILURE",
          workflow: "Check",
        },
      ]);
      const rows = yield* decodeGhStatusChecks(encodedJson);
      expect(A.map(rows, (row) => row.name)).toEqual(["Lint", "Status", "Check"]);
      expect(rows[0]?.completedAt).toBeUndefined();
      expect(rows[1]?.completedAt).toBeNull();
      expect(rows[2]?.completedAt).toBe("2026-09-25T11:53:05Z");
    })
  );

  it("orders an invalid completion after a known failing instant", () => {
    const unknown = YeetWatchCheck.make({ name: "Unknown", outcome: "fail", completedAt: O.some("not-an-instant") });
    const known = YeetWatchCheck.make({ name: "Check", outcome: "fail", completedAt: O.some("2026-09-25T12:01:00Z") });
    const expected = YeetHeadRed.make({ at: "2026-09-25T12:01:00Z", lane: "Check" });
    assertSome(yeetFirstRed([unknown, known]), expected);
    assertSome(yeetFirstRed([known, unknown]), expected);
  });

  it("names the earliest required failing completion as the head's first red", () => {
    const record = (name: string, outcome: "fail" | "pass", completedAt: O.Option<string>, required = true) =>
      YeetWatchCheck.make({ name, outcome, required, completedAt });
    assertSome(
      yeetFirstRed([
        record("Lint", "fail", O.some("2026-09-25T12:05:00Z")),
        record("Build", "pass", O.some("2026-09-25T11:00:00Z")),
        record("Vercel", "fail", O.none()),
        record("Preview", "fail", O.some("2026-09-25T11:30:00Z"), false),
        record("Check", "fail", O.some("2026-09-25T12:01:00Z")),
      ]),
      YeetHeadRed.make({ at: "2026-09-25T12:01:00Z", lane: "Check" })
    );
    // Equal instants keep the rollup's order, so the lane always names the red.
    assertSome(
      yeetFirstRed([
        record("Lint", "fail", O.some("2026-09-25T12:01:00Z")),
        record("Check", "fail", O.some("2026-09-25T12:01:00Z")),
      ]),
      YeetHeadRed.make({ at: "2026-09-25T12:01:00Z", lane: "Lint" })
    );
    assertNone(yeetFirstRed([record("Vercel", "fail", O.none())]));
    // An optional red never stamps the head's red, however early it completes.
    assertNone(yeetFirstRed([record("Preview", "fail", O.some("2026-09-25T11:30:00Z"), false)]));
  });
});

it.layer(PlatformLayer, { timeout: "30 seconds" })("--until-ready check fidelity", (it) => {
  it.effect("requests all seven check fields and keeps each check's whole record", () =>
    Effect.gen(function* () {
      const root = yield* tempRoot();
      const spawner = fidelitySpawner();
      const status = yield* collectYeetStatus(contextFor(root), true).pipe(withGh(spawner));
      const census = yield* collectRemoteChecksForTesting(contextFor(root), false).pipe(withGh(spawner));

      const requested = checkArgsOf(spawner);
      expect(A.length(requested)).toBe(3);
      expect(A.map(requested, A.last)).toStrictEqual(
        A.replicate(O.some("name,state,bucket,link,workflow,completedAt,startedAt,description"), 3)
      );
      assertSome(
        O.map(
          census,
          A.map((row) => row.completedAt)
        ),
        ["2026-09-25T11:53:05Z", "0001-01-01T00:00:00Z"]
      );
      expect(status.remote.checks).toStrictEqual([
        YeetWatchCheck.make({
          name: "Check / Coverage",
          outcome: "fail",
          required: true,
          link,
          signal: YeetCheckSignal.make({ bucket: "fail", state: "FAILURE" }),
          workflow: "Check",
          startedAt: O.some("2026-09-25T11:27:04Z"),
          completedAt: O.some("2026-09-25T11:53:05Z"),
        }),
        YeetWatchCheck.make({
          name: "Vercel",
          outcome: "fail",
          required: false,
          link: null,
          signal: YeetCheckSignal.make({ bucket: "fail", state: "FAILURE" }),
          workflow: null,
        }),
      ]);
    })
  );

  it.effect("writes a check-failed capsule equal, field for field, to the one --watch writes", () =>
    Effect.gen(function* () {
      const gh = withGh(fidelitySpawner());
      const [watchRows, statusRows] = yield* Effect.all([
        Effect.gen(function* () {
          const root = yield* tempRoot();
          const watch = yield* collectYeetWatchSnapshot(contextFor(root)).pipe(gh);
          const failing = A.filter(watch.checks, (check) => check.outcome === "fail");
          yield* Effect.forEach(failing, (check) => dispatchYeetCheckFailure(root, watch, check, at));
          return yield* readRows(root);
        }),
        Effect.gen(function* () {
          const root = yield* tempRoot();
          // The capsule's PR coordinates come from the snapshot argument and
          // are the same in both loops; the check record is what differs.
          const watch = yield* collectYeetWatchSnapshot(contextFor(root)).pipe(gh);
          const status = yield* collectYeetStatus(contextFor(root), true).pipe(gh);
          const failing = A.filter(status.remote.checks, (check) => check.outcome === "fail");
          yield* Effect.forEach(failing, (check) => dispatchYeetCheckFailure(root, watch, check, at));
          return yield* readRows(root);
        }),
      ]);

      const capsulesOf = (rows: typeof watchRows) =>
        A.filterMap(rows, (row) => (row.kind === "check-failed" ? Result.succeed(row.capsule) : Result.failVoid));
      // Same id, tier, kind, and stamp: only `checkout` differs, by construction.
      const identityOf = A.map((row: (typeof watchRows)[number]) => [row.id, row.kind, row.severity, row.ts]);
      expect(A.length(watchRows)).toBe(2);
      expect(identityOf(statusRows)).toStrictEqual(identityOf(watchRows));
      expect(capsulesOf(statusRows)).toStrictEqual(capsulesOf(watchRows));
      expect(
        A.map(capsulesOf(statusRows), (capsule) => [
          capsule.lane,
          capsule.link,
          capsule.workflow,
          capsule.bucket,
          capsule.state,
        ])
      ).toStrictEqual([
        ["Check / Coverage", link, "Check", "fail", "FAILURE"],
        ["Vercel", null, null, "fail", "FAILURE"],
      ]);
    })
  );
});
