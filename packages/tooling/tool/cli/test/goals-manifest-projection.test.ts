import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import {
  GoalExplorationPathState,
  goalPacketFindings,
  makeGoalPacketWorkingTreeReader,
} from "@beep/repo-cli/commands/Goals/Doctor";
import { GoalResearchReportPath } from "@beep/repo-cli/commands/Goals/Goals.schemas";
import { GoalPacketRecord } from "@beep/repo-cli/commands/Goals/Inventory";
import {
  biomeManifestFormatter,
  collectManifestProjectionRows,
  goalsManifestCommand,
  runGoalsManifest,
} from "@beep/repo-cli/commands/Goals/Manifest";
import { GoalManifestFormatter } from "@beep/repo-cli/commands/Goals/Manifest.service";
import {
  diffResearchReports,
  listedManifestStrings,
  planResearchProjection,
  projectResearchReports,
  ResearchReportsDrift,
  renderResearchReportsDrift,
} from "@beep/repo-cli/commands/Goals/ManifestProjection";
import { CliReportedExit } from "@beep/repo-cli-kit/cli/ExitCodeError";
import { it } from "@beep/test-runner";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { assert, describe } from "@effect/vitest";
import { assertFalse, assertInstanceOf, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Command from "effect/cli/Command";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as ChildProcessSpawner from "effect/process/ChildProcessSpawner";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { temporaryWorkingDirectory, writeProjectFile } from "./support/CommandTest.ts";
import { provideSpawner } from "./support/ScriptedProcess.ts";
import type { GoalPacketReader } from "@beep/repo-cli/commands/Goals/Doctor";

const encodeJson = flow(S.encodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);
const decodeJson = flow(S.decodeUnknownResult(S.fromJsonString(S.Unknown)), Result.getOrThrow);

const COMPLETION_GATE = {
  operator: "yeet",
  requiresPullRequest: true,
  requiresMergeable: true,
  statement: "Ship via yeet.",
  grandfathered: false,
};

const manifestText = (extra: Readonly<Record<string, unknown>>): string =>
  encodeJson({
    schemaVersion: "initiative-manifest/v2",
    initiative: { id: "demo", status: "active" },
    lifecycle: "active",
    completionGate: COMPLETION_GATE,
    ...extra,
  });

const record = (text: string): GoalPacketRecord =>
  GoalPacketRecord.make({
    slug: "demo",
    packetPath: "goals/demo",
    manifestPath: "goals/demo/ops/manifest.json",
    readmePath: "goals/demo/README.md",
    manifestText: text,
  });

const stubReader = (researchFiles: ReadonlyArray<string>): GoalPacketReader<never, never> => ({
  decisionFiles: () => Effect.succeed(A.empty<string>()),
  readDecision: () => Effect.succeed(""),
  readDocument: () => Effect.succeedNone,
  explorationPath: () => Effect.succeed(GoalExplorationPathState.Enum.present),
  opsFiles: () => Effect.succeed(A.empty<string>()),
  researchFiles: () => Effect.succeed(researchFiles),
  readReflection: () => Effect.succeed(""),
  reflectionFiles: () => Effect.succeed(A.empty<string>()),
});

const driftKeys = (findings: ReadonlyArray<{ readonly key: string }>): ReadonlyArray<string> =>
  A.filter(
    A.map(findings, (finding) => finding.key),
    (key) => Str.includes(" research-reports-drift")(key)
  );

describe("goal manifest researchReports projection", () => {
  it("admits packet-relative paths under research/ and refuses escapes and dot segments", () => {
    for (const path of ["research/SOURCES.md", "research/evidence/run-1.json", "research/a_b/c.d.e"]) {
      assertTrue(S.is(GoalResearchReportPath)(path));
    }
    for (const path of [
      "SOURCES.md",
      "research/",
      "research/.gitkeep",
      "research/.scratch/x.md",
      "research/../SPEC.md",
      "../../explorations/x/RESEARCH.md",
      "history/p1.md",
      "ops/research/x.md",
      "research//x.md",
    ]) {
      assertFalse(S.is(GoalResearchReportPath)(path));
    }
  });

  it("projects a listing sorted, deduplicated, with hidden segments dropped", () => {
    assert.deepStrictEqual(
      projectResearchReports([
        "research/b.md",
        "research/.gitkeep",
        "research/a/x.json",
        "research/b.md",
        "research/.scratch/probe.md",
        "ops/manifest.json",
      ]),
      ["research/a/x.json", "research/b.md"]
    );
    assert.deepStrictEqual(projectResearchReports([]), []);
  });

  it("diffs an array against the projection", () => {
    assertNone(diffResearchReports(["research/a.md", "research/b.md"], ["research/a.md", "research/b.md"]));
    assertNone(diffResearchReports(undefined, []));
    const drift = diffResearchReports(
      ["research/b.md", "research/gone.md", "../../explorations/x/RESEARCH.md", "history/p1.md"],
      ["research/a.md", "research/b.md"]
    );
    assertSome(
      drift,
      ResearchReportsDrift.make({
        missing: ["research/gone.md"],
        unlisted: ["research/a.md"],
        references: ["../../explorations/x/RESEARCH.md", "history/p1.md"],
        reordered: false,
      })
    );
    const reordered = diffResearchReports(
      ["research/b.md", "research/a.md", "research/a.md"],
      ["research/a.md", "research/b.md"]
    );
    assertSome(reordered, ResearchReportsDrift.make({ missing: [], unlisted: [], references: [], reordered: true }));
    const absentKey = diffResearchReports(undefined, ["research/a.md"]);
    assertSome(
      absentKey,
      ResearchReportsDrift.make({ missing: [], unlisted: ["research/a.md"], references: [], reordered: false })
    );
    const staleKey = diffResearchReports(["research/a.md"], []);
    assertSome(
      staleKey,
      ResearchReportsDrift.make({ missing: ["research/a.md"], unlisted: [], references: [], reordered: false })
    );
  });

  it("renders a drift with capped samples", () => {
    const drift = diffResearchReports(
      ["research/z.md", "history/p1.md"],
      ["research/a.md", "research/b.md", "research/c.md", "research/d.md"]
    );
    const line = drift.pipe(O.getOrThrow, renderResearchReportsDrift);
    assert.strictEqual(
      line,
      "researchReports drifts from research/: +4 unlisted (research/a.md, research/b.md, research/c.md, +1 more); -1 missing (research/z.md); 1 outside research/ (history/p1.md)"
    );
    assert.strictEqual(
      renderResearchReportsDrift(
        ResearchReportsDrift.make({ missing: [], unlisted: [], references: [], reordered: true })
      ),
      "researchReports drifts from research/: unsorted or duplicated entries"
    );
  });

  it("renders reordered entries with no unlisted or missing paths", () => {
    const line = renderResearchReportsDrift(
      ResearchReportsDrift.make({ missing: [], unlisted: [], references: [], reordered: true })
    );
    assert.strictEqual(line, "researchReports drifts from research/: unsorted or duplicated entries");
  });

  it.layer(NodeCrypto.layer)((it) => {
    it.effect("the retained formatter requests only the rewritten paths", () =>
      Effect.gen(function* () {
        const spawner = ScriptedSpawner.make(() => ({ exit: 0 }));
        yield* biomeManifestFormatter
          .format("/fixture", ["goals/demo/ops/manifest.json"])
          .pipe(provideSpawner(spawner));
        assert.strictEqual(spawner.spawns.length, 1);
        const call = O.getOrThrow(A.head(spawner.spawns));
        assert.strictEqual(call.command, "bunx");
        assert.strictEqual(call.cwd, "/fixture");
        assert.deepStrictEqual(call.args, ["biome", "format", "--write", "goals/demo/ops/manifest.json"]);
      })
    );
    it.effect("formatter nonzero exit refuses the rewrite result", () =>
      Effect.gen(function* () {
        const spawner = ScriptedSpawner.make(() => ({ exit: 2 }));
        const error = yield* biomeManifestFormatter
          .format("/fixture", ["manifest.json"])
          .pipe(provideSpawner(spawner), Effect.flip);
        assertInstanceOf(error, CliReportedExit);
        assertTrue(Str.includes("biome format failed")(error.message));
      })
    );
    it.effect("a missing formatter is a reported failure instead of a successful rewrite", () =>
      Effect.gen(function* () {
        const spawner = ScriptedSpawner.make(() => ScriptedSpawner.notFound("bunx"));
        const error = yield* biomeManifestFormatter
          .format("/fixture", ["manifest.json"])
          .pipe(provideSpawner(spawner), Effect.flip);
        assertInstanceOf(error, CliReportedExit);
        assert.strictEqual(spawner.spawns.length, 1);
      })
    );
  });

  it("reads string arrays from a raw manifest", () => {
    assert.deepStrictEqual(listedManifestStrings({ researchReports: ["research/a.md", 1, null] }, "researchReports"), [
      "research/a.md",
    ]);
    assert.strictEqual(listedManifestStrings({ researchReports: "research/a.md" }, "researchReports"), undefined);
    assert.strictEqual(listedManifestStrings({}, "researchReports"), undefined);
  });

  it("plans the rewrite: projection lands, references move, key order and other keys survive", () => {
    const text = manifestText({
      researchReports: ["research/SOURCES.md", "../../explorations/x/RESEARCH.md", "research/gone.md"],
      agentLaunchers: [],
      researchReferences: ["history/p0.md"],
    });
    const next = O.getOrThrow(planResearchProjection(text, ["research/SOURCES.md", "research/review.json"]));
    const parsed = decodeJson(next) as Readonly<Record<string, unknown>>;
    assert.deepStrictEqual(parsed.researchReports, ["research/SOURCES.md", "research/review.json"]);
    assert.deepStrictEqual(parsed.researchReferences, ["../../explorations/x/RESEARCH.md", "history/p0.md"]);
    assert.deepStrictEqual(parsed.agentLaunchers, []);
    assert.deepStrictEqual(parsed.completionGate, COMPLETION_GATE);
    assert.deepStrictEqual(R.keys(parsed), [
      "schemaVersion",
      "initiative",
      "lifecycle",
      "completionGate",
      "researchReports",
      "agentLaunchers",
      "researchReferences",
    ]);
    assertTrue(Str.endsWith("\n")(next) === Str.endsWith("\n")(text));
  });

  it("exposes pipeable forms and refuses a non-object manifest", () => {
    assertNone(planResearchProjection(["research/a.md"])(manifestText({ researchReports: ["research/a.md"] })));
    assertNone(planResearchProjection("[]", ["research/a.md"]));
    assertNone(diffResearchReports(["research/a.md"])(["research/a.md"]));
    assert.deepStrictEqual(listedManifestStrings("researchReports")({ researchReports: ["research/a.md"] }), [
      "research/a.md",
    ]);
  });

  it("plans nothing when the array already matches, and deletes the key for an empty projection", () => {
    assertNone(planResearchProjection(manifestText({ researchReports: ["research/a.md"] }), ["research/a.md"]));
    assertNone(planResearchProjection(manifestText({}), []));
    assertNone(planResearchProjection("not json", ["research/a.md"]));
    const next = O.getOrThrow(planResearchProjection(manifestText({ researchReports: ["research/a.md"] }), []));
    const parsed = decodeJson(next) as Readonly<Record<string, unknown>>;
    assertFalse("researchReports" in parsed);
    assertFalse("researchReferences" in parsed);
    const added = O.getOrThrow(planResearchProjection(manifestText({}), ["research/a.md"]));
    const addedParsed = decodeJson(added) as Readonly<Record<string, unknown>>;
    assert.deepStrictEqual(addedParsed.researchReports, ["research/a.md"]);
  });

  it.layer(Layer.mergeAll(NodeServices.layer, NodeCrypto.layer), { timeout: "30 seconds" })((it) => {
    it.effect("the working-tree reader drops git-ignored files and keeps untracked ones", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-goals-worktree-reader-" });
        const handle = yield* spawner.spawn(ChildProcess.make("git", ["init", "-q"], { cwd: root }));
        const initExit = yield* handle.exitCode;
        assert.strictEqual(initExit, 0);
        const packet = path.join(root, "goals", "demo");
        yield* fs.makeDirectory(path.join(packet, "research", "__pycache__"), { recursive: true });
        yield* fs.makeDirectory(path.join(packet, "ops"), { recursive: true });
        yield* fs.writeFileString(path.join(root, ".gitignore"), "__pycache__/\n*.log\n");
        yield* fs.writeFileString(path.join(packet, "research", "SOURCES.md"), "");
        yield* fs.writeFileString(path.join(packet, "research", "untracked.md"), "");
        yield* fs.writeFileString(path.join(packet, "research", "__pycache__", "x.cpython-314.pyc"), "");
        yield* fs.writeFileString(path.join(packet, "research", "run.log"), "");
        yield* fs.writeFileString(path.join(packet, "ops", "probe.log"), "");
        yield* fs.writeFileString(path.join(packet, "ops", "bench.ts"), "");
        const reader = yield* makeGoalPacketWorkingTreeReader(root);
        const researchFiles = yield* reader.researchFiles(packet);
        assert.deepStrictEqual(researchFiles, ["research/SOURCES.md", "research/untracked.md"]);
        const opsFiles = yield* reader.opsFiles(packet);
        assert.deepStrictEqual(opsFiles, ["ops/bench.ts"]);
      })
    );

    it.effect("write uses the retained formatter when no formatter override is supplied", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-manifest-default-formatter-" });
        const packet = path.join(root, "goals", "demo");
        yield* fs.makeDirectory(path.join(packet, "ops"), { recursive: true });
        yield* fs.makeDirectory(path.join(packet, "research"), { recursive: true });
        yield* fs.writeFileString(path.join(packet, "research", "SOURCES.md"), "");
        const manifest = path.join(packet, "ops", "manifest.json");
        yield* fs.writeFileString(manifest, manifestText({ researchReports: ["research/gone.md"] }));
        const spawner = ScriptedSpawner.make(() => ({ exit: 0, stdout: "" }));
        yield* runGoalsManifest({ write: true, check: false }, root).pipe(provideSpawner(spawner));
        const calls = A.filter(spawner.spawns, (call) => call.command === "bunx");
        assert.strictEqual(calls.length, 1);
        assert.deepStrictEqual(O.getOrThrow(A.head(calls)).args, ["biome", "format", "--write", manifest]);
        const rewritten = yield* fs.readFileString(manifest);
        const parsed = Result.getOrThrow(
          S.decodeUnknownResult(S.fromJsonString(S.Struct({ researchReports: S.Array(S.String) })))(rewritten)
        );
        assert.deepStrictEqual(parsed.researchReports, ["research/SOURCES.md"]);
      })
    );

    it.effect("goals manifest reports drift, rewrites it with --write, and is then clean", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-goals-manifest-command-" });
        const handle = yield* spawner.spawn(ChildProcess.make("git", ["init", "-q"], { cwd: root }));
        const initExit = yield* handle.exitCode;
        assert.strictEqual(initExit, 0);
        const formatted: Array<string> = [];
        const formatter = {
          format: (_root: string, paths: ReadonlyArray<string>) => Effect.sync(() => void formatted.push(...paths)),
        };
        const packet = (slug: string) => path.join(root, "goals", slug);
        // drifted: lists a stale row and a cross-packet pointer, misses two files on disk
        yield* fs.makeDirectory(path.join(packet("drifted"), "research", "evidence"), { recursive: true });
        yield* fs.makeDirectory(path.join(packet("drifted"), "ops"), { recursive: true });
        yield* fs.writeFileString(path.join(packet("drifted"), "research", "SOURCES.md"), "");
        yield* fs.writeFileString(path.join(packet("drifted"), "research", "evidence", "run.json"), "{}");
        yield* fs.writeFileString(
          path.join(packet("drifted"), "ops", "manifest.json"),
          manifestText({ researchReports: ["research/SOURCES.md", "research/gone.md", "history/p1.md"] })
        );
        // in sync
        yield* fs.makeDirectory(path.join(packet("clean"), "research"), { recursive: true });
        yield* fs.makeDirectory(path.join(packet("clean"), "ops"), { recursive: true });
        yield* fs.writeFileString(path.join(packet("clean"), "research", "SOURCES.md"), "");
        yield* fs.writeFileString(
          path.join(packet("clean"), "ops", "manifest.json"),
          manifestText({ researchReports: ["research/SOURCES.md"] })
        );
        // unparsable manifest: the doctor's finding, skipped here
        yield* fs.makeDirectory(path.join(packet("broken"), "ops"), { recursive: true });
        yield* fs.writeFileString(path.join(packet("broken"), "ops", "manifest.json"), "{ not json");

        const rows = yield* collectManifestProjectionRows(root);
        assert.deepStrictEqual(
          A.map(rows, (row) => row.slug),
          ["drifted"]
        );
        assert.deepStrictEqual(rows[0]?.drift.unlisted, ["research/evidence/run.json"]);
        assert.deepStrictEqual(rows[0]?.drift.missing, ["research/gone.md"]);
        assert.deepStrictEqual(rows[0]?.drift.references, ["history/p1.md"]);

        const both = yield* runGoalsManifest({ write: true, check: true }, root).pipe(Effect.flip);
        assertInstanceOf(both, CliReportedExit);
        const checked = yield* runGoalsManifest({ write: false, check: true }, root).pipe(Effect.flip);
        assertInstanceOf(checked, CliReportedExit);
        assertTrue(Str.includes("goals manifest --write")(checked.message));

        yield* runGoalsManifest({ write: true, check: false }, root).pipe(
          Effect.provideService(GoalManifestFormatter, formatter)
        );
        assert.deepStrictEqual(formatted, [path.join(packet("drifted"), "ops", "manifest.json")]);
        const rewrittenText = yield* fs.readFileString(path.join(packet("drifted"), "ops", "manifest.json"));
        const rewritten = decodeJson(rewrittenText) as Readonly<Record<string, unknown>>;
        assert.deepStrictEqual(rewritten.researchReports, ["research/SOURCES.md", "research/evidence/run.json"]);
        assert.deepStrictEqual(rewritten.researchReferences, ["history/p1.md"]);

        yield* runGoalsManifest({ write: false, check: false }, root);
        const after = yield* collectManifestProjectionRows(root);
        assert.deepStrictEqual(after, []);
      })
    );

    it.effect("the biome formatter reports a failed format as a reported exit", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-goals-manifest-biome-" });
        // Biome resolves from the repository the test runs in; the missing manifest fails the format.
        const failed = yield* biomeManifestFormatter
          .format(process.cwd(), [path.join(root, "missing", "manifest.json")])
          .pipe(Effect.flip);
        assertInstanceOf(failed, CliReportedExit);
        const missingCwd = yield* biomeManifestFormatter
          .format(path.join(root, "missing"), ["manifest.json"])
          .pipe(Effect.flip);
        assertInstanceOf(missingCwd, CliReportedExit);
        const manifest = path.join(root, "manifest.json");
        yield* fs.writeFileString(manifest, manifestText({}));
        yield* biomeManifestFormatter.format(root, ["manifest.json"]);
      })
    );

    it.effect("goals manifest runs as a command against the working directory", () =>
      Effect.gen(function* () {
        yield* temporaryWorkingDirectory;
        const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
        const handle = yield* spawner.spawn(ChildProcess.make("git", ["init", "-q"]));
        const exitCode = yield* handle.exitCode;
        assert.strictEqual(exitCode, 0);
        yield* writeProjectFile("goals/demo/research/SOURCES.md", "");
        yield* writeProjectFile(
          "goals/demo/ops/manifest.json",
          manifestText({ researchReports: ["research/SOURCES.md", "research/gone.md"] })
        );
        const run = Command.runWith(goalsManifestCommand, { version: "0.0.0" });
        const exclusive = yield* Effect.exit(run(["--write", "--check"]));
        exclusive.pipe(Exit.isFailure, assertTrue);
        const checked = yield* Effect.exit(run(["--check"]));
        checked.pipe(Exit.isFailure, assertTrue);
        const rows = yield* collectManifestProjectionRows();
        assert.strictEqual(rows.length, 1);
        yield* run(["--write"]);
        yield* run(["--check"]);
      })
    );
  });

  it.effect("goals doctor reports drift as one blocking finding per packet and is clean when in sync", () =>
    Effect.gen(function* () {
      const files = ["research/SOURCES.md", "research/review.json", "research/.gitkeep"];
      const drifted = yield* goalPacketFindings(
        record(manifestText({ researchReports: ["research/SOURCES.md"] })),
        stubReader(files)
      );
      assert.deepStrictEqual(driftKeys(drifted.findings), ["demo research-reports-drift"]);
      const [finding] = A.filter(drifted.findings, (item) => item.kind === "research-reports-drift");
      assert.strictEqual(finding?.severity, "blocking");
      assertTrue(Str.includes("bun run beep goals manifest --write")(finding?.message ?? ""));

      const absent = yield* goalPacketFindings(record(manifestText({})), stubReader(files));
      assert.deepStrictEqual(driftKeys(absent.findings), ["demo research-reports-drift"]);

      const clean = yield* goalPacketFindings(
        record(manifestText({ researchReports: ["research/SOURCES.md", "research/review.json"] })),
        stubReader(files)
      );
      assert.deepStrictEqual(driftKeys(clean.findings), []);

      const empty = yield* goalPacketFindings(record(manifestText({})), stubReader([]));
      assert.deepStrictEqual(driftKeys(empty.findings), []);
    })
  );
});
