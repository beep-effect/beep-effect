import {
  collectPackageVerifyChangedFilesForTesting,
  PackageVerifyReport,
  PackageVerifyStepResult,
  PackageVerifyStepSpec,
  PackageVerifyWorkspace,
  packageVerifyStepPlanForTesting,
  packageVerifyStepSpecsForTesting,
  QualityTaskStep,
  readPackageWorkspaceForTesting,
  recordPackageVerifyInboxForTesting,
  renderPackageVerifyReportForTesting,
  runPackageVerify,
  runPackageVerifyAtRootForTesting,
  runPackageVerifyCli,
  runPackageVerifyStepPlanForTesting,
  selectPackageVerifyTargetForTesting,
} from "@beep/repo-cli/test/Quality";
import { loadYeetInboxView } from "@beep/repo-cli/test/Yeet";
import { FsUtilsLive } from "@beep/repo-utils/FsUtils";
import { UnknownFromJsonString } from "@beep/schema/Unknown";
import { provideScopedLayer } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { Cause, Effect, Exit, FileSystem, Layer, Path } from "effect";
import * as O from "effect/Option";
import { describe, expect, it, vi } from "vitest";

const FileSystemLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const PlatformLayer = Layer.mergeAll(
  FileSystemLayer,
  NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(FileSystemLayer)),
  FsUtilsLive.pipe(Layer.provideMerge(FileSystemLayer))
);
const encodeJson = UnknownFromJsonString.encodeUnknownEffect;

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

const seedWorkspaceRepository = Effect.fn("seedWorkspaceRepository")(function* (
  repoRoot: string,
  scripts: Readonly<Record<string, string>>,
  options: { readonly commit?: boolean } = {}
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const packageDir = path.join(repoRoot, "packages/demo");
  yield* fs.makeDirectory(packageDir, { recursive: true });
  yield* fs.writeFileString(
    path.join(repoRoot, "package.json"),
    yield* encodeJson({ name: "verify-root", private: true, workspaces: ["packages/*"] })
  );
  yield* fs.writeFileString(
    path.join(packageDir, "package.json"),
    yield* encodeJson({ name: "@beep/demo", private: true, scripts })
  );
  yield* runGit(repoRoot, ["init", "--quiet"]);
  yield* runGit(repoRoot, ["config", "user.email", "codex@example.invalid"]);
  yield* runGit(repoRoot, ["config", "user.name", "Codex"]);
  if (options.commit !== false) {
    yield* runGit(repoRoot, ["add", "."]);
    yield* runGit(repoRoot, ["commit", "--quiet", "-m", "initial"]);
  }
  return packageDir;
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

  it("builds upstream audit dependencies through Turbo before the package script", () => {
    const plan = packageVerifyStepPlanForTesting(
      "/repo",
      demoWorkspace,
      PackageVerifyStepSpec.make({ step: "audit", script: "beep:audit" })
    );

    expect(A.map(plan, ({ args, command, cwd, label }) => ({ args, command, cwd, label }))).toEqual([
      {
        label: "audit:build-closure",
        command: "bun",
        args: ["x", "turbo", "run", "build", "--filter=@beep/demo^..."],
        cwd: "/repo",
      },
      {
        label: "audit",
        command: "bun",
        args: ["run", "beep:audit"],
        cwd: "/repo/packages/demo",
      },
    ]);
  });

  it("does not run the package audit when its closure build fails", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const markerPath = path.join(tmpDir, "audit-ran");
          const result = yield* runPackageVerifyStepPlanForTesting([
            QualityTaskStep.make({
              label: "audit:build-closure",
              command: "sh",
              args: ["-c", "printf build-failed; exit 7"],
              cwd: tmpDir,
            }),
            QualityTaskStep.make({
              label: "audit",
              command: "sh",
              args: ["-c", "touch audit-ran"],
              cwd: tmpDir,
            }),
          ]);

          expect(result.exitCode).toBe(7);
          expect(result.output).toContain("build-failed");
          expect(result.output).not.toContain("touch audit-ran");
          expect(yield* fs.exists(markerPath)).toBe(false);
        })
      )
    ));

  it("refreshes environment-only stale upstream output before running the audit", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const distStatePath = path.join(tmpDir, "dist-state");
          yield* fs.writeFileString(distStatePath, "stale");

          const result = yield* runPackageVerifyStepPlanForTesting([
            QualityTaskStep.make({
              label: "audit:build-closure",
              command: "sh",
              args: ["-c", "printf fresh > dist-state"],
              cwd: tmpDir,
            }),
            QualityTaskStep.make({
              label: "audit",
              command: "sh",
              args: ["-c", 'test "$(cat dist-state)" = fresh && printf audit-ok'],
              cwd: tmpDir,
            }),
          ]);

          expect(result.exitCode).toBe(0);
          expect(result.output).toContain("audit-ok");
          expect(yield* fs.readFileString(distStatePath)).toBe("fresh");
        })
      )
    ));

  it("runs the audit when Turbo skips fresh upstream builds from cache", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const markerPath = path.join(tmpDir, "audit-ran");
          const result = yield* runPackageVerifyStepPlanForTesting([
            QualityTaskStep.make({
              label: "audit:build-closure",
              command: "sh",
              args: ["-c", "printf 'cache hit, replaying logs'"],
              cwd: tmpDir,
            }),
            QualityTaskStep.make({
              label: "audit",
              command: "sh",
              args: ["-c", "printf audit-ran > audit-ran"],
              cwd: tmpDir,
            }),
          ]);

          expect(result.exitCode).toBe(0);
          expect(result.output).toContain("cache hit, replaying logs");
          expect(yield* fs.exists(markerPath)).toBe(true);
        })
      )
    ));

  it("attributes an audit failure after a successful dependency build", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const result = yield* runPackageVerifyStepPlanForTesting([
            QualityTaskStep.make({
              label: "audit:build-closure",
              command: "sh",
              args: ["-c", "printf closure-ok"],
              cwd: tmpDir,
            }),
            QualityTaskStep.make({
              label: "audit",
              command: "sh",
              args: ["-c", "printf audit-failed; exit 9"],
              cwd: tmpDir,
            }),
          ]);

          expect(result.exitCode).toBe(9);
          expect(result.output).toContain("closure-ok");
          expect(result.output).toContain("audit-failed");
          expect(result.output).toContain("sh -c printf audit-failed; exit 9");
        })
      )
    ));

  it("maps dependency-build spawn failures to the package-verify error surface", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        runPackageVerifyStepPlanForTesting([
          QualityTaskStep.make({
            label: "audit:build-closure",
            command: "missing-package-verify-command",
            args: ["build"],
            cwd: tmpDir,
          }),
        ]).pipe(
          Effect.flip,
          Effect.map((error) => {
            expect(error.message).toContain("Failed to spawn missing-package-verify-command build");
            expect(error.command).toBe("missing-package-verify-command build");
          })
        )
      )
    ));

  it("runs quick verification and records the repository head", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.acquireUseRelease(
          Effect.sync(() => vi.spyOn(process, "cwd").mockReturnValue(tmpDir)),
          () =>
            Effect.gen(function* () {
              const fs = yield* FileSystem.FileSystem;
              const path = yield* Path.Path;
              yield* seedWorkspaceRepository(tmpDir, { "beep:lint": "true", "beep:check": "true" });

              const report = yield* runPackageVerify({ packageName: O.some("@beep/demo"), quick: true });

              expect(report.packageName).toBe("@beep/demo");
              expect(report.headSha).toMatch(/^[0-9a-f]{40}$/u);
              expect(A.map(report.results, (result) => result.ok)).toEqual([true, true]);

              yield* fs.writeFileString(path.join(tmpDir, ".beep"), "block inbox creation");
              yield* runPackageVerifyCli({ packageArgs: ["@beep/demo"], quick: true });
            }),
          (cwdSpy) => Effect.sync(() => cwdSpy.mockRestore())
        )
      )
    ));

  it("skips the dependency build when the package has no audit script", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          yield* seedWorkspaceRepository(tmpDir, { docgen: "true" });

          const report = yield* runPackageVerifyAtRootForTesting(tmpDir, {
            packageName: O.some("@beep/demo"),
            quick: false,
          });

          expect(report.results).toHaveLength(2);
          expect(report.results[0]).toMatchObject({
            step: "audit",
            skipped: true,
            ok: true,
            output: "(no beep:audit script)",
          });
          expect(report.results[1]).toMatchObject({ step: "docgen", skipped: false, ok: true });
        })
      )
    ));

  it("surfaces malformed workspace manifests", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const packageDir = path.join(tmpDir, "packages/demo");
          yield* fs.makeDirectory(packageDir, { recursive: true });
          yield* fs.writeFileString(path.join(packageDir, "package.json"), "{not-json");

          const error = yield* readPackageWorkspaceForTesting("@beep/demo", packageDir).pipe(Effect.flip);

          expect(error.message).toContain(`Failed to decode ${path.join(packageDir, "package.json")}`);

          yield* fs.writeFileString(path.join(packageDir, "package.json"), yield* encodeJson({ name: "@beep/demo" }));
          const workspace = yield* readPackageWorkspaceForTesting("@beep/demo", packageDir);
          expect(workspace.scripts).toEqual({});
        })
      )
    ));

  it("surfaces a missing repository HEAD after verification", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          yield* seedWorkspaceRepository(tmpDir, { "beep:lint": "true", "beep:check": "true" }, { commit: false });

          const error = yield* runPackageVerifyAtRootForTesting(tmpDir, {
            packageName: O.some("@beep/demo"),
            quick: true,
          }).pipe(Effect.flip);

          expect(error.message).toContain("git rev-parse HEAD failed with exit code");
          expect(error.command).toBe("git rev-parse HEAD");
        })
      )
    ));

  it("rejects more than one package argument before discovery", () =>
    Effect.runPromise(
      runPackageVerifyCli({ packageArgs: ["@beep/a", "@beep/b"], quick: true }).pipe(
        Effect.flip,
        Effect.map((error) => {
          expect(error.message).toContain("expected at most one package argument");
        }),
        provideScopedLayer(PlatformLayer)
      )
    ));

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
          expect(failed.entries[0]?.row.severity).toBe("P0");
          expect(failed.entries[0]?.ack.acked).toBe(false);

          yield* recordPackageVerifyInboxForTesting(report(true));
          const repaired = yield* loadYeetInboxView(tmpDir);
          expect(repaired.entries[0]?.ack.acked).toBe(true);

          const withoutExit = (step: "lint" | "check", ok: boolean) =>
            PackageVerifyStepResult.make({
              step,
              script: `beep:${step}`,
              skipped: false,
              ok,
              durationMillis: 1,
              exitCode: O.none(),
              output: "",
            });
          yield* recordPackageVerifyInboxForTesting(
            PackageVerifyReport.make({
              headSha: "abc123",
              packageName: "@beep/no-exit",
              packageDir: `${tmpDir}/packages/no-exit`,
              quick: true,
              repoRoot: tmpDir,
              results: [withoutExit("lint", true), withoutExit("check", false)],
            })
          );
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

  it("records the Turbo closure build in a genuine audit failure capsule", () =>
    Effect.runPromise(
      withTempDirectory((tmpDir) =>
        Effect.gen(function* () {
          yield* recordPackageVerifyInboxForTesting(
            PackageVerifyReport.make({
              headSha: "abc123",
              packageName: "@beep/demo",
              packageDir: `${tmpDir}/packages/demo`,
              quick: false,
              repoRoot: tmpDir,
              results: [
                PackageVerifyStepResult.make({
                  step: "audit",
                  script: "beep:audit",
                  skipped: false,
                  ok: false,
                  durationMillis: 20,
                  exitCode: O.some(1),
                  output: "build failed",
                }),
              ],
            })
          );

          const inbox = yield* loadYeetInboxView(tmpDir);
          const row = inbox.entries[0]?.row;
          expect(row?.kind).toBe("local-shard-failed");
          if (row?.kind === "local-shard-failed") {
            expect(row.severity).toBe("P0");
            expect(row.capsule.command).toBe("bun x turbo run build --filter=@beep/demo^... && bun run beep:audit");
          }
        })
      )
    ));
});
