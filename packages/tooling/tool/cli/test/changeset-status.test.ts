import {
  ChangesetGraphPackageReference,
  ChangesetStatusPartition,
  ChangesetStatusWorkspacePackage,
  changesetStatusPassthroughSteps,
  changesetStatusPlanSteps,
  changesetStatusVerdict,
  githubCheckChangesetStatusLane,
  partitionChangedFilesForStatus,
  runChangesetStatus,
  uncoveredWorkspacePackageNames,
} from "@beep/repo-cli/test/Quality";
import { Unknown } from "@beep/schema/Unknown";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as TestConsole from "effect/testing/TestConsole";
import { ChildProcess } from "effect/unstable/process";

const REPO_ROOT = "/repo";

const fixtureWorkspaceDirs: ReadonlyArray<string> = ["packages/demo", "apps/labs/cognee"];

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const testLayer = Layer.mergeAll(NodeServices.layer, TestConsole.layer);
const encodeJson = Unknown.encodeUnknownSyncFromJsonString;

const runGit = Effect.fn("ChangesetStatusTest.runGit")(function* (repoRoot: string, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", ["-c", "commit.gpgsign=false", ...args], {
    cwd: repoRoot,
    stdin: "ignore",
    stdout: "ignore",
    stderr: "ignore",
  });
  const exitCode = yield* handle.exitCode;
  expect(exitCode).toBe(0);
});

const withTempRepo = <A2, E, R>(use: (tmpDir: string) => Effect.Effect<A2, E, R>) =>
  Effect.scoped(
    Effect.acquireUseRelease(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();

        return { fs, tmpDir } as const;
      }),
      ({ tmpDir }) => use(tmpDir),
      ({ fs, tmpDir }) => fs.remove(tmpDir, { recursive: true, force: true })
    ).pipe(provideScopedLayer(testLayer))
  );

const writeRepoFile = Effect.fn("ChangesetStatusTest.writeRepoFile")(function* (
  repoRoot: string,
  relativePath: string,
  content: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const absolutePath = path.join(repoRoot, relativePath);

  yield* fs.makeDirectory(path.dirname(absolutePath), { recursive: true });
  yield* fs.writeFileString(absolutePath, content);
});

const writePackageJson = (repoRoot: string, relativePath: string, document: unknown) =>
  writeRepoFile(repoRoot, relativePath, `${encodeJson(document)}\n`);

const commitAll = Effect.fn("ChangesetStatusTest.commitAll")(function* (repoRoot: string, message: string) {
  yield* runGit(repoRoot, ["add", "."]);
  yield* runGit(repoRoot, ["commit", "-m", message]);
});

const writeStatusFixtureRepo = Effect.fn("ChangesetStatusTest.writeStatusFixtureRepo")(function* (repoRoot: string) {
  yield* writePackageJson(repoRoot, "package.json", {
    private: true,
    workspaces: ["packages/*", "apps/labs/*"],
  });
  yield* writePackageJson(repoRoot, "packages/demo/package.json", {
    name: "@beep/demo",
    version: "0.0.0",
  });
  yield* writeRepoFile(repoRoot, "packages/demo/src/index.ts", "export const demo = 1;\n");
  yield* writeRepoFile(repoRoot, ".changeset/README.md", "# Changesets\n");
  yield* writePackageJson(repoRoot, ".changeset/config.json", { ignore: [] });
  yield* runGit(repoRoot, ["init", "-b", "main"]);
  yield* runGit(repoRoot, ["config", "user.email", "beep@example.com"]);
  yield* runGit(repoRoot, ["config", "user.name", "beep"]);
  yield* commitAll(repoRoot, "base");
  yield* runGit(repoRoot, ["checkout", "-b", "feature"]);
});

const writeLabApp = Effect.fn("ChangesetStatusTest.writeLabApp")(function* (repoRoot: string) {
  yield* writePackageJson(repoRoot, "apps/labs/cognee/package.json", {
    name: "@beep/cognee",
    version: "0.0.0",
  });
  yield* writeRepoFile(repoRoot, "apps/labs/cognee/src/main.ts", "export const lab = 1;\n");
});

describe("changeset status wrapper", () => {
  describe("partition + verdict", () => {
    it("classifies a lab-only diff as lab-exempt with no planned steps", () => {
      const partition = partitionChangedFilesForStatus(["apps/labs/cognee/src/main.ts"], fixtureWorkspaceDirs);

      expect(partition).toEqual(
        ChangesetStatusPartition.make({
          labPaths: ["apps/labs/cognee/src/main.ts"],
          productWorkspaceDirs: [],
          neutralPaths: [],
          blockingPaths: [],
        })
      );

      const verdict = changesetStatusVerdict(partition);
      expect(verdict).toBe("lab-exempt");
      expect(changesetStatusPlanSteps(REPO_ROOT, verdict, "origin/main")).toEqual([]);
    });

    it("classifies a mixed lab/product diff as mixed-reimplemented without spawning stock", () => {
      const partition = partitionChangedFilesForStatus(
        ["apps/labs/cognee/src/main.ts", "packages/demo/src/index.ts"],
        fixtureWorkspaceDirs
      );

      expect([...partition.labPaths]).toEqual(["apps/labs/cognee/src/main.ts"]);
      expect([...partition.productWorkspaceDirs]).toEqual(["packages/demo"]);

      const verdict = changesetStatusVerdict(partition);
      expect(verdict).toBe("mixed-reimplemented");
      expect(changesetStatusPlanSteps(REPO_ROOT, verdict, "origin/main")).toEqual([]);
    });

    it("routes a root-only diff to stock parity with one stock step", () => {
      const partition = partitionChangedFilesForStatus(["package.json"], fixtureWorkspaceDirs);

      expect([...partition.blockingPaths]).toEqual(["package.json"]);

      const verdict = changesetStatusVerdict(partition);
      expect(verdict).toBe("stock-parity");

      const steps = changesetStatusPlanSteps(REPO_ROOT, verdict, "origin/main");
      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        command: "bunx",
        args: ["changeset", "status", "--since=origin/main"],
        cwd: REPO_ROOT,
      });
    });

    it("classifies deleted and renamed lab paths as lab without a live owner", () => {
      const partition = partitionChangedFilesForStatus(
        ["apps/labs/cognee/package.json", "apps/labs/cognee2/package.json"],
        ["packages/demo"]
      );

      expect([...partition.labPaths]).toEqual(["apps/labs/cognee/package.json", "apps/labs/cognee2/package.json"]);
      expect(changesetStatusVerdict(partition)).toBe("lab-exempt");
    });

    it("treats a lab path renamed into product space as mixed-reimplemented", () => {
      const partition = partitionChangedFilesForStatus(
        ["apps/labs/cognee/src/main.ts", "packages/demo/src/main.ts"],
        fixtureWorkspaceDirs
      );

      expect(changesetStatusVerdict(partition)).toBe("mixed-reimplemented");
    });

    it("keeps neutral prefixes and the identity companion file out of the exemption gate", () => {
      const partition = partitionChangedFilesForStatus(
        [
          "apps/labs/cognee/src/main.ts",
          ".changeset/lucky-dogs-run.md",
          "docs/guides/labs.md",
          "explorations/idea.md",
          "goals/lab-apps-lifecycle/SPEC.md",
          "packages/foundation/modeling/identity/src/packages.ts",
          "research/packet/claims.jsonl",
        ],
        [...fixtureWorkspaceDirs, "packages/foundation/modeling/identity"]
      );

      expect(partition.productWorkspaceDirs).toEqual([]);
      expect(partition.blockingPaths).toEqual([]);
      expect(partition.neutralPaths).toHaveLength(6);
      expect(changesetStatusVerdict(partition)).toBe("lab-exempt");
    });

    it("keeps non-companion identity files inside workspace ownership", () => {
      const partition = partitionChangedFilesForStatus(
        ["apps/labs/cognee/src/main.ts", "packages/foundation/modeling/identity/src/index.ts"],
        [...fixtureWorkspaceDirs, "packages/foundation/modeling/identity"]
      );

      expect([...partition.productWorkspaceDirs]).toEqual(["packages/foundation/modeling/identity"]);
      expect(changesetStatusVerdict(partition)).toBe("mixed-reimplemented");
    });

    it("routes an empty diff to stock parity", () => {
      expect(changesetStatusVerdict(partitionChangedFilesForStatus([], fixtureWorkspaceDirs))).toBe("stock-parity");
    });
  });

  describe("plan steps", () => {
    it("plans a stock passthrough step without --since when the flag is absent", () => {
      const steps = changesetStatusPassthroughSteps(REPO_ROOT);

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        command: "bunx",
        args: ["changeset", "status"],
        cwd: REPO_ROOT,
      });
    });

    it("plans no steps for the exempt and reimplemented verdicts", () => {
      expect(changesetStatusPlanSteps(REPO_ROOT, "lab-exempt", "origin/main")).toEqual([]);
      expect(changesetStatusPlanSteps(REPO_ROOT, "mixed-reimplemented", "origin/main")).toEqual([]);
    });
  });

  describe("reimplemented coverage check", () => {
    const demo = ChangesetStatusWorkspacePackage.make({
      dir: "packages/demo",
      name: "@beep/demo",
      version: O.some("0.0.0"),
    });

    it("fails a versioned product workspace without a pending changeset", () => {
      expect(uncoveredWorkspacePackageNames([demo], [], [])).toEqual(["@beep/demo"]);
    });

    it("passes a product workspace named by a pending changeset", () => {
      const reference = ChangesetGraphPackageReference.make({
        file: ".changeset/demo.md",
        packageName: "@beep/demo",
      });

      expect(uncoveredWorkspacePackageNames([demo], [], [reference])).toEqual([]);
    });

    it("passes ignored package names without coverage", () => {
      const cli = ChangesetStatusWorkspacePackage.make({
        dir: "packages/tooling/tool/cli",
        name: "@beep/repo-cli",
        version: O.some("0.0.0"),
      });

      expect(uncoveredWorkspacePackageNames([cli], ["@beep/repo-cli"], [])).toEqual([]);
    });

    it("passes versionless workspaces without coverage", () => {
      const versionless = ChangesetStatusWorkspacePackage.make({
        dir: "packages/anon",
        name: "@beep/anon",
        version: O.none(),
      });

      expect(uncoveredWorkspacePackageNames([versionless], [], [])).toEqual([]);
    });
  });

  describe("github check lane", () => {
    it("routes the preflight lane through the path-aware wrapper", () => {
      const lane = githubCheckChangesetStatusLane(REPO_ROOT);

      expect(lane.id).toBe("quality:changeset-status");
      expect(lane.stage).toBe("repo-quality");
      expect(lane.wave).toBe("preflight");
      expect(lane.step.label).toBe("quality:changeset-status");
      expect(lane.step.command).toBe("bun");
      expect([...lane.step.args]).toEqual(["run", "beep", "quality", "changeset-status", "--since", "origin/main"]);
    });
  });

  describe("runChangesetStatus over a real merge-base diff", () => {
    it("exempts a lab-only branch without consulting changesets", () =>
      Effect.runPromise(
        withTempRepo((tmpDir) =>
          Effect.gen(function* () {
            yield* writeStatusFixtureRepo(tmpDir);
            yield* writeLabApp(tmpDir);
            yield* commitAll(tmpDir, "add lab");

            yield* runChangesetStatus(tmpDir, O.some("main"));

            const logs = yield* TestConsole.logLines;
            expect(
              A.some(
                logs,
                (line) => P.isString(line) && line.includes("changeset ceremony exempt: lab-only change set")
              )
            ).toBe(true);
          })
        )
      ));

    it("keeps a pending changeset naming a deleted lab as graph-lane business", () =>
      Effect.runPromise(
        withTempRepo((tmpDir) =>
          Effect.gen(function* () {
            yield* writeStatusFixtureRepo(tmpDir);
            yield* writeLabApp(tmpDir);
            yield* writeRepoFile(
              tmpDir,
              ".changeset/dead-lab.md",
              `---
"@beep/dead-lab": patch
---

Reference a deleted lab.
`
            );
            yield* commitAll(tmpDir, "add lab and stale changeset");

            yield* runChangesetStatus(tmpDir, O.some("main"));

            const logs = yield* TestConsole.logLines;
            expect(A.some(logs, (line) => P.isString(line) && line.includes("verdict=lab-exempt"))).toBe(true);
          })
        )
      ));

    it("fails a mixed branch whose product workspace lacks a pending changeset", () =>
      Effect.runPromise(
        withTempRepo((tmpDir) =>
          Effect.gen(function* () {
            yield* writeStatusFixtureRepo(tmpDir);
            yield* writeLabApp(tmpDir);
            yield* writeRepoFile(tmpDir, "packages/demo/src/index.ts", "export const demo = 2;\n");
            yield* commitAll(tmpDir, "mixed change without changeset");

            const error = yield* Effect.flip(runChangesetStatus(tmpDir, O.some("main")));

            expect(error._tag).toBe("CliReportedExit");
            if (error._tag === "CliReportedExit") {
              expect(error.exitCode).toBe(1);
            }

            const errors = yield* TestConsole.errorLines;
            expect(A.some(errors, (line) => P.isString(line) && line.includes("@beep/demo"))).toBe(true);
          })
        )
      ));

    it("passes a mixed branch whose product workspace is named by a pending changeset", () =>
      Effect.runPromise(
        withTempRepo((tmpDir) =>
          Effect.gen(function* () {
            yield* writeStatusFixtureRepo(tmpDir);
            yield* writeLabApp(tmpDir);
            yield* writeRepoFile(tmpDir, "packages/demo/src/index.ts", "export const demo = 2;\n");
            yield* writeRepoFile(
              tmpDir,
              ".changeset/demo-change.md",
              `---
"@beep/demo": patch
---

Patch demo.
`
            );
            yield* commitAll(tmpDir, "mixed change with changeset");

            yield* runChangesetStatus(tmpDir, O.some("main"));

            const logs = yield* TestConsole.logLines;
            expect(
              A.some(
                logs,
                (line) =>
                  P.isString(line) && line.includes("every changed product workspace is named by a pending changeset")
              )
            ).toBe(true);
          })
        )
      ));
  });
});
