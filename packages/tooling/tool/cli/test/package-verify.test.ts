import {
  collectPackageVerifyChangedFilesForTesting,
  PackageVerifyReport,
  PackageVerifyStepResult,
  PackageVerifyWorkspace,
  packageVerifyStepSpecsForTesting,
  recordPackageVerifyInboxForTesting,
  renderPackageVerifyReportForTesting,
  selectPackageVerifyTargetForTesting,
} from "@beep/repo-cli/test/Quality";
import { loadYeetInboxView } from "@beep/repo-cli/test/Yeet";
import { provideScopedLayer } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { Cause, Effect, Exit, FileSystem, Layer, Path } from "effect";
import * as O from "effect/Option";
import { describe, expect, it } from "vitest";

const FileSystemLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const PlatformLayer = Layer.mergeAll(
  FileSystemLayer,
  NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(FileSystemLayer))
);

const demoWorkspace = PackageVerifyWorkspace.make({
  name: "@beep/demo",
  dir: "/repo/packages/demo",
  scripts: {
    "beep:check": "tsgo -p tsconfig.check.json",
    "beep:lint": "biome check .",
  },
});

const appWorkspace = PackageVerifyWorkspace.make({
  name: "@beep/app",
  dir: "/repo/apps/app",
  scripts: {
    "beep:test": "vitest run",
  },
});

const runGit = (cwd: string, args: ReadonlyArray<string>) =>
  Effect.sync(() => {
    const result = Bun.spawnSync(["git", ...args], {
      cwd,
      stderr: "pipe",
      stdout: "pipe",
    });

    if (result.exitCode !== 0) {
      throw new Error(`git ${A.join(args, " ")} failed: ${result.stderr.toString()}`);
    }
  });

const withTempDirectory = <Result, Error, Requirements>(
  use: (tmpDir: string) => Effect.Effect<Result, Error, Requirements>
) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory();
    }),
    use,
    (tmpDir) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(tmpDir, { recursive: true });
      })
  ).pipe(provideScopedLayer(PlatformLayer));

describe("package verify", () => {
  it("builds quick and default step specs", () => {
    expect(A.map(packageVerifyStepSpecsForTesting(true), (spec) => spec.step)).toEqual(["lint", "check"]);
    expect(A.map(packageVerifyStepSpecsForTesting(false), (spec) => spec.step)).toEqual(["audit", "docgen"]);
  });

  it("selects an explicit workspace package", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const selected = yield* selectPackageVerifyTargetForTesting({
          changedFiles: [],
          packageName: O.some("@beep/demo"),
          repoRoot: "/repo",
          workspaces: [demoWorkspace, appWorkspace],
        });

        expect(selected.name).toBe("@beep/demo");
      })
    ));

  it("fails when changed files span multiple packages", () =>
    Effect.runPromise(
      Effect.gen(function* () {
        const exit = yield* Effect.exit(
          selectPackageVerifyTargetForTesting({
            changedFiles: ["packages/demo/src/index.ts", "apps/app/src/main.ts"],
            packageName: O.none(),
            repoRoot: "/repo",
            workspaces: [demoWorkspace, appWorkspace],
          })
        );

        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          const error = Cause.squash(exit.cause);
          expect(error).toMatchObject({
            message: "pkg-verify: changed files span multiple packages: @beep/app, @beep/demo.",
          });
        }
      })
    ));

  it("collects deleted package paths for workspace auto-detection", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const sourceFile = path.join(tmpDir, "packages/demo/src/index.ts");

          yield* runGit(tmpDir, ["init", "--quiet"]);
          yield* runGit(tmpDir, ["config", "user.email", "codex@example.invalid"]);
          yield* runGit(tmpDir, ["config", "user.name", "Codex"]);
          yield* fs.makeDirectory(path.dirname(sourceFile), { recursive: true });
          yield* fs.writeFileString(sourceFile, "export const demo = true;\n");
          yield* runGit(tmpDir, ["add", "."]);
          yield* runGit(tmpDir, ["commit", "--quiet", "-m", "initial"]);
          yield* fs.remove(sourceFile);

          const changedFiles = yield* collectPackageVerifyChangedFilesForTesting(tmpDir);

          expect(changedFiles).toEqual(["packages/demo/src/index.ts"]);
        })
      )
    ));

  it("renders compact summaries and failed step output", () => {
    const lines = renderPackageVerifyReportForTesting(
      PackageVerifyReport.make({
        headSha: "abc123",
        packageName: "@beep/demo",
        packageDir: "/repo/packages/demo",
        quick: true,
        repoRoot: "/repo",
        results: [
          PackageVerifyStepResult.make({
            step: "lint",
            script: "beep:lint",
            skipped: false,
            ok: true,
            durationMillis: 15,
            exitCode: O.some(0),
            output: "",
          }),
          PackageVerifyStepResult.make({
            step: "check",
            script: "beep:check",
            skipped: false,
            ok: false,
            durationMillis: 20,
            exitCode: O.some(1),
            output: "type error",
          }),
        ],
      })
    );

    const rendered = A.join(lines, "\n");
    expect(rendered).toContain("pkg-verify @beep/demo (/repo/packages/demo) [quick]");
    expect(rendered).toContain("ok lint");
    expect(rendered).toContain("fail check");
    expect(rendered).toContain("-------- check (failed) --------");
    expect(Str.endsWith("type error\n")(rendered)).toBe(true);
  });

  it("writes package failures to the shared inbox and clears them on success", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const result = (ok: boolean) =>
            PackageVerifyStepResult.make({
              step: "check",
              script: "beep:check",
              skipped: false,
              ok,
              durationMillis: 20,
              exitCode: O.some(ok ? 0 : 1),
              output: ok ? "" : "type error",
            });
          const report = (ok: boolean) =>
            PackageVerifyReport.make({
              headSha: "abc123",
              packageName: "@beep/demo",
              packageDir: `${tmpDir}/packages/demo`,
              quick: true,
              repoRoot: tmpDir,
              results: [result(ok)],
            });

          yield* recordPackageVerifyInboxForTesting(report(false));
          const failed = yield* loadYeetInboxView(tmpDir);
          expect(failed.entries).toHaveLength(1);
          expect(failed.entries[0]?.row.kind).toBe("local-shard-failed");
          expect(failed.entries[0]?.ack.acked).toBe(false);

          yield* recordPackageVerifyInboxForTesting(report(true));
          const repaired = yield* loadYeetInboxView(tmpDir);
          expect(repaired.entries[0]?.ack.acked).toBe(true);
        })
      )
    ));

  it("clears quick lint and check poison after a successful full audit", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const step = (name: "lint" | "check" | "audit", ok: boolean) =>
            PackageVerifyStepResult.make({
              step: name,
              script: `beep:${name}`,
              skipped: false,
              ok,
              durationMillis: 20,
              exitCode: O.some(ok ? 0 : 1),
              output: ok ? "" : `${name} failed`,
            });
          const report = (quick: boolean, results: ReadonlyArray<PackageVerifyStepResult>) =>
            PackageVerifyReport.make({
              headSha: "abc123",
              packageName: "@beep/demo",
              packageDir: `${tmpDir}/packages/demo`,
              quick,
              repoRoot: tmpDir,
              results,
            });

          yield* recordPackageVerifyInboxForTesting(report(true, [step("lint", false), step("check", false)]));
          yield* recordPackageVerifyInboxForTesting(report(false, [step("audit", true)]));

          const repaired = yield* loadYeetInboxView(tmpDir);
          expect(repaired.entries).toHaveLength(2);
          expect(repaired.entries.every((entry) => entry.ack.acked)).toBe(true);
        })
      )
    ));
});
