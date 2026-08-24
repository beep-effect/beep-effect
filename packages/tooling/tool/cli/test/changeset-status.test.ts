import {
  ChangesetGraphPackageReference,
  ChangesetStatusPartition,
  ChangesetStatusWorkspacePackage,
  changesetStatusVerdict,
  githubCheckChangesetStatusLane,
  partitionChangedFilesForStatus,
  runChangesetStatus,
  uncoveredWorkspacePackageNames,
} from "@beep/repo-cli/test/Quality";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, Sink, Stream } from "effect";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as TestConsole from "effect/testing/TestConsole";
import { ChildProcessSpawner } from "effect/unstable/process";

const REPO_ROOT = "/repo";
const fixtureWorkspaceDirs: ReadonlyArray<string> = ["packages/demo", "apps/labs/cognee"];
const encoder = new TextEncoder();

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const encodeJson = S.encodeUnknownSync(S.fromJsonString(S.Unknown));

const makeHandle = (output: string) =>
  ChildProcessSpawner.makeHandle({
    pid: ChildProcessSpawner.ProcessId(1),
    exitCode: Effect.succeed(ChildProcessSpawner.ExitCode(0)),
    isRunning: Effect.succeed(false),
    kill: () => Effect.void,
    stdin: Sink.drain,
    stdout: Stream.make(encoder.encode(output)),
    stderr: Stream.empty,
    all: Stream.make(encoder.encode(output)),
    getInputFd: () => Sink.drain,
    getOutputFd: () => Stream.empty,
    unref: Effect.succeed(Effect.void),
  });

const gitFixtureLayer = (
  changedFiles: ReadonlyArray<string>,
  addedChangesets: ReadonlyArray<string>,
  spawned: Array<string>
) =>
  Layer.succeed(
    ChildProcessSpawner.ChildProcessSpawner,
    ChildProcessSpawner.make((command) =>
      Effect.sync(() => {
        if (command._tag !== "StandardCommand") {
          return makeHandle("");
        }
        const args = command.args;
        spawned.push(A.join([command.command, ...args], " "));
        const output = A.contains(args, "--diff-filter=ACMRTUXBD")
          ? A.join(changedFiles, "\u0000")
          : A.contains(args, "--diff-filter=A")
            ? A.join(addedChangesets, "\u0000")
            : A.contains(args, "ls-files")
              ? A.join(["packages/demo/package.json", "apps/labs/cognee/package.json"], "\u0000")
              : "";
        return makeHandle(output);
      })
    )
  );

const withTempRepo = <A2, E, R>(
  changedFiles: ReadonlyArray<string>,
  addedChangesets: ReadonlyArray<string>,
  spawned: Array<string>,
  use: (tmpDir: string) => Effect.Effect<A2, E, R>
) =>
  Effect.scoped(
    Effect.acquireUseRelease(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const tmpDir = yield* fs.makeTempDirectory();

        return { fs, tmpDir } as const;
      }),
      ({ tmpDir }) => use(tmpDir),
      ({ fs, tmpDir }) => fs.remove(tmpDir, { recursive: true, force: true })
    ).pipe(
      provideScopedLayer(
        Layer.mergeAll(NodeServices.layer, TestConsole.layer, gitFixtureLayer(changedFiles, addedChangesets, spawned))
      )
    )
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
    it("classifies a lab-only diff as lab-exempt", () => {
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
    });

    it("classifies a mixed lab/product diff as enforced", () => {
      const partition = partitionChangedFilesForStatus(
        ["apps/labs/cognee/src/main.ts", "packages/demo/src/index.ts"],
        fixtureWorkspaceDirs
      );

      expect([...partition.labPaths]).toEqual(["apps/labs/cognee/src/main.ts"]);
      expect([...partition.productWorkspaceDirs]).toEqual(["packages/demo"]);

      const verdict = changesetStatusVerdict(partition);
      expect(verdict).toBe("enforced");
    });

    it("routes a root-only diff to in-process enforcement", () => {
      const partition = partitionChangedFilesForStatus(["package.json"], fixtureWorkspaceDirs);

      expect([...partition.blockingPaths]).toEqual(["package.json"]);

      const verdict = changesetStatusVerdict(partition);
      expect(verdict).toBe("enforced");
    });

    it("classifies deleted and renamed lab paths as lab without a live owner", () => {
      const partition = partitionChangedFilesForStatus(
        ["apps/labs/cognee/package.json", "apps/labs/cognee2/package.json"],
        ["packages/demo"]
      );

      expect([...partition.labPaths]).toEqual(["apps/labs/cognee/package.json", "apps/labs/cognee2/package.json"]);
      expect(changesetStatusVerdict(partition)).toBe("lab-exempt");
    });

    it("treats a lab path renamed into product space as enforced", () => {
      const partition = partitionChangedFilesForStatus(
        ["apps/labs/cognee/src/main.ts", "packages/demo/src/main.ts"],
        fixtureWorkspaceDirs
      );

      expect(changesetStatusVerdict(partition)).toBe("enforced");
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
      expect(changesetStatusVerdict(partition)).toBe("enforced");
    });

    it("routes an empty diff to in-process enforcement", () => {
      expect(changesetStatusVerdict(partitionChangedFilesForStatus([], fixtureWorkspaceDirs))).toBe("enforced");
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

  describe("runChangesetStatus with captured git fixtures", () => {
    it("exempts a lab-only branch without consulting changesets", () =>
      Effect.runPromise(
        withTempRepo(
          ["apps/labs/cognee/src/main.ts"],
          [],
          [],
          Effect.fn(function* (tmpDir) {
            yield* writeStatusFixtureRepo(tmpDir);
            yield* writeLabApp(tmpDir);

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

    it("does not count a base-backlog changeset as product coverage", () =>
      Effect.runPromise(
        withTempRepo(
          ["packages/demo/src/index.ts"],
          [],
          [],
          Effect.fn(function* (tmpDir) {
            yield* writeStatusFixtureRepo(tmpDir);
            yield* writeRepoFile(
              tmpDir,
              ".changeset/base-backlog.md",
              `---
"@beep/demo": patch
---

Base backlog coverage must not count.
`
            );

            const error = yield* Effect.flip(runChangesetStatus(tmpDir, O.some("main")));

            expect(error._tag).toBe("CliReportedExit");
            const errors = yield* TestConsole.errorLines;
            expect(A.some(errors, (line) => P.isString(line) && line.includes("@beep/demo"))).toBe(true);
          })
        )
      ));

    it("fails the product-only path in-process when no in-range changeset covers it", () =>
      Effect.runPromise(
        withTempRepo(
          ["packages/demo/src/index.ts"],
          [],
          [],
          Effect.fn(function* (tmpDir) {
            yield* writeStatusFixtureRepo(tmpDir);
            yield* writeRepoFile(tmpDir, "packages/demo/src/index.ts", "export const demo = 2;\n");

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

    it("passes the product-only path when an in-range-added changeset covers it", () =>
      Effect.runPromise(
        withTempRepo(
          ["packages/demo/src/index.ts", ".changeset/demo-change.md"],
          [".changeset/demo-change.md"],
          [],
          Effect.fn(function* (tmpDir) {
            yield* writeStatusFixtureRepo(tmpDir);
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

            yield* runChangesetStatus(tmpDir, O.some("main"));

            const logs = yield* TestConsole.logLines;
            expect(
              A.some(
                logs,
                (line) =>
                  P.isString(line) && line.includes("every changed product workspace is named by a changeset added")
              )
            ).toBe(true);
          })
        )
      ));

    it("defaults an absent --since value to origin/main without spawning stock changesets", () => {
      const spawned: Array<string> = [];
      return Effect.runPromise(
        withTempRepo(
          ["packages/demo/src/index.ts", ".changeset/demo-change.md"],
          [".changeset/demo-change.md"],
          spawned,
          Effect.fn(function* (tmpDir) {
            yield* writeStatusFixtureRepo(tmpDir);
            yield* writeRepoFile(
              tmpDir,
              ".changeset/demo-change.md",
              `---
"@beep/demo": patch
---

Patch demo.
`
            );

            yield* runChangesetStatus(tmpDir, O.none());

            expect(A.some(spawned, (command) => command.includes("origin/main...HEAD"))).toBe(true);
            expect(A.every(spawned, (command) => !command.includes("bunx changeset status"))).toBe(true);
          })
        )
      );
    });
  });
});
