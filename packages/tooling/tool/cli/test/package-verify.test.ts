import { Git } from "@beep/git/Git";
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
import { it } from "@beep/test-runner";
import { A, Str } from "@beep/utils";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { NodeChildProcessSpawner } from "@effect/platform-node";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, vi } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as TestClock from "effect/testing/TestClock";
import * as TestConsole from "effect/testing/TestConsole";

const FileSystemLayer = Layer.mergeAll(NodeFileSystem.layer, NodePath.layer);
const SpawnerLayer = NodeChildProcessSpawner.layer.pipe(Layer.provideMerge(FileSystemLayer));
const PlatformLayer = Layer.mergeAll(
  BunCrypto.layer,
  FileSystemLayer,
  SpawnerLayer,
  // `Git` rides beside the platform services: the verify's `HEAD` read takes it from the context (W2).
  Git.layer.pipe(Layer.provide(SpawnerLayer)),
  FsUtilsLive.pipe(Layer.provideMerge(FileSystemLayer))
);
const encodeJson = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));

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
  const argument1 = path.join(repoRoot, "package.json");
  const encodedJson = yield* encodeJson({
    name: "verify-root",
    private: true,
    workspaces: ["packages/*"],
  });
  yield* fs.writeFileString(argument1, encodedJson);
  const argument2 = path.join(packageDir, "package.json");
  const encodedJson1 = yield* encodeJson({ name: "@beep/demo", private: true, scripts });
  yield* fs.writeFileString(argument2, encodedJson1);
  if ("docgen" in scripts) {
    yield* fs.makeDirectory(path.join(packageDir, "src"), { recursive: true });
    const argument3 = path.join(packageDir, "docgen.json");
    const encodedJson2 = yield* encodeJson({ srcDir: "src" });
    yield* fs.writeFileString(argument3, encodedJson2);
    yield* fs.writeFileString(
      path.join(packageDir, "src/index.ts"),
      "/**\n * Fixture module.\n * @packageDocumentation\n * @since 0.0.0\n */\n/**\n * Fixture constant.\n * @category constants\n * @since 0.0.0\n */\nexport const demo = 1;\n"
    );
  }
  yield* runGit(repoRoot, ["init", "--quiet"]);
  yield* runGit(repoRoot, ["config", "user.email", "codex@example.invalid"]);
  yield* runGit(repoRoot, ["config", "user.name", "Codex"]);
  yield* runGit(repoRoot, ["config", "commit.gpgsign", "false"]);
  if (options.commit !== false) {
    yield* runGit(repoRoot, ["add", "."]);
    yield* runGit(repoRoot, ["commit", "--quiet", "-m", "initial"]);
  }
  return packageDir;
});

const temporaryDirectory = Effect.acquireRelease(
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    return yield* fs.makeTempDirectory();
  }),
  (tmpDir) =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      yield* fs.remove(tmpDir, { recursive: true });
    }).pipe(Effect.orDie)
);

it.layer(PlatformLayer, { concurrent: false, timeout: "5 seconds" })((it) => {
  describe("package verify", () => {
    it("builds quick and default step specs", () => {
      expect(A.map(packageVerifyStepSpecsForTesting(true), (spec) => spec.step)).toEqual(["lint", "check"]);
      expect(A.map(packageVerifyStepSpecsForTesting(false), (spec) => spec.step)).toEqual(["lint", "audit", "docgen"]);
    });

    it("delegates the audit to the root command with the selected workspace filter", () => {
      const plan = packageVerifyStepPlanForTesting(
        "/repo",
        demoWorkspace,
        PackageVerifyStepSpec.make({ step: "audit", script: "audit" })
      );

      expect(A.map(plan, ({ args, command, cwd, label }) => ({ args, command, cwd, label }))).toEqual([
        {
          label: "audit",
          command: "bun",
          args: ["run", "audit", "--filter=@beep/demo"],
          cwd: "/repo",
        },
      ]);
    });

    // The quick check typechecks against built dependency declarations too; without the closure
    // build a stale or missing dependency build reported errors hosted Check never sees.
    it("builds upstream check dependencies through Turbo before the package script", () => {
      const plan = packageVerifyStepPlanForTesting(
        "/repo",
        demoWorkspace,
        PackageVerifyStepSpec.make({ step: "check", script: "beep:check" })
      );

      expect(A.map(plan, ({ args, command, cwd, label }) => ({ args, command, cwd, label }))).toEqual([
        {
          label: "check:build-closure",
          command: "bun",
          args: ["x", "turbo", "run", "build", "--filter=@beep/demo^..."],
          cwd: "/repo",
        },
        {
          label: "check",
          command: "bun",
          args: ["run", "beep:check"],
          cwd: "/repo/packages/demo",
        },
      ]);
    });

    it.effect("does not run the package audit when its closure build fails", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
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
          const exists1 = yield* fs.exists(markerPath);
          expect(exists1).toBe(false);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("refreshes environment-only stale upstream output before running the audit", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
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
          const readFileString2 = yield* fs.readFileString(distStatePath);
          expect(readFileString2).toBe("fresh");
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("runs the audit when Turbo skips fresh upstream builds from cache", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
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
          const exists3 = yield* fs.exists(markerPath);
          expect(exists3).toBe(true);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("attributes an audit failure after a successful dependency build", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
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
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("maps dependency-build spawn failures to the package-verify error surface", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
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
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("runs quick verification and records the repository head", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
        Effect.acquireUseRelease(
          Effect.sync(() => vi.spyOn(process, "cwd").mockReturnValue(tmpDir)),
          () =>
            Effect.gen(function* () {
              const fs = yield* FileSystem.FileSystem;
              const path = yield* Path.Path;
              yield* seedWorkspaceRepository(tmpDir, { "beep:lint": "true", "beep:check": "true" });
              // The quick check builds the upstream closure through the workspace's Turbo first.
              const turbo = path.join(tmpDir, "node_modules/.bin/turbo");
              yield* fs.makeDirectory(path.dirname(turbo), { recursive: true });
              yield* fs.writeFileString(turbo, "#!/bin/sh\nexit 0\n");
              yield* fs.chmod(turbo, 0o755);

              const report = yield* runPackageVerify({ packageName: O.some("@beep/demo"), quick: true });

              expect(report.packageName).toBe("@beep/demo");
              expect(report.headSha).toMatch(/^[0-9a-f]{40}$/u);
              expect(A.map(report.results, (result) => result.ok)).toEqual([true, true]);

              yield* fs.writeFileString(path.join(tmpDir, ".beep"), "block inbox creation");
              yield* runPackageVerifyCli({ packageArgs: ["@beep/demo"], quick: true });
            }),
          (cwdSpy) => Effect.sync(() => cwdSpy.mockRestore())
        )
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("stops before audit and docgen when the package lint preflight fails", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const packageDir = yield* seedWorkspaceRepository(tmpDir, {
            "beep:lint": "sh -c 'printf lint-failed; exit 7'",
            docgen: "touch docgen-ran",
          });
          const rootManifest = yield* encodeJson({
            name: "verify-root",
            private: true,
            workspaces: ["packages/*"],
            scripts: { audit: "touch audit-ran" },
          });
          yield* fs.writeFileString(path.join(tmpDir, "package.json"), rootManifest);
          const report = yield* runPackageVerifyAtRootForTesting(tmpDir, {
            packageName: O.some("@beep/demo"),
            quick: false,
          });
          expect(A.map(report.results, ({ step, skipped, ok }) => ({ step, skipped, ok }))).toEqual([
            { step: "lint", skipped: false, ok: false },
            { step: "audit", skipped: true, ok: true },
            { step: "docgen", skipped: true, ok: true },
          ]);
          expect(report.results[0]?.output).toContain("lint-failed");
          const auditRan = yield* fs.exists(path.join(tmpDir, "audit-ran"));
          const docgenRan = yield* fs.exists(path.join(packageDir, "docgen-ran"));
          expect([auditRan, docgenRan]).toEqual([false, false]);
          yield* recordPackageVerifyInboxForTesting(report);
          const inbox = yield* loadYeetInboxView(tmpDir);
          expect(inbox.entries).toHaveLength(1);
          const failure = inbox.entries[0]?.row;
          expect(failure?.kind).toBe("local-shard-failed");
          if (failure?.kind === "local-shard-failed") {
            expect(failure.capsule.command).toBe("bun run beep:lint");
          }
          expect(A.join(renderPackageVerifyReportForTesting(report), "\n")).toContain("skip audit");
          const cliFailure = yield* Effect.acquireUseRelease(
            Effect.sync(() => vi.spyOn(process, "cwd").mockReturnValue(tmpDir)),
            () => runPackageVerifyCli({ packageArgs: ["@beep/demo"], quick: false }).pipe(Effect.flip),
            (cwdSpy) => Effect.sync(() => cwdSpy.mockRestore())
          );
          expect(cliFailure.exitCode).toBe(1);
          const auditRanAfterCli = yield* fs.exists(path.join(tmpDir, "audit-ran"));
          const docgenRanAfterCli = yield* fs.exists(path.join(packageDir, "docgen-ran"));
          expect([auditRanAfterCli, docgenRanAfterCli]).toEqual([false, false]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("retains the full audit, its final lint and docgen after a green preflight", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const packageDir = yield* seedWorkspaceRepository(tmpDir, {
            "beep:lint": "printf l >> lint-ran",
            docgen: "printf d >> docgen-ran",
          });
          const rootManifest = yield* encodeJson({
            name: "verify-root",
            private: true,
            workspaces: ["packages/*"],
            scripts: { audit: "printf a >> audit-ran; bun run --cwd packages/demo beep:lint" },
          });
          yield* fs.writeFileString(path.join(tmpDir, "package.json"), rootManifest);
          const report = yield* runPackageVerifyAtRootForTesting(tmpDir, {
            packageName: O.some("@beep/demo"),
            quick: false,
          });
          expect(A.map(report.results, ({ step, skipped, ok }) => ({ step, skipped, ok }))).toEqual([
            { step: "lint", skipped: false, ok: true },
            { step: "audit", skipped: false, ok: true },
            { step: "docgen", skipped: false, ok: true },
          ]);
          const lintMarkers = yield* fs.readFileString(path.join(packageDir, "lint-ran"));
          const auditMarkers = yield* fs.readFileString(path.join(tmpDir, "audit-ran"));
          const docgenMarkers = yield* fs.readFileString(path.join(packageDir, "docgen-ran"));
          expect({ lintMarkers, auditMarkers, docgenMarkers }).toEqual({
            lintMarkers: "ll",
            auditMarkers: "a",
            docgenMarkers: "d",
          });
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("rejects an invalid category before running the package docgen script", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const packageDir = yield* seedWorkspaceRepository(tmpDir, { docgen: "touch docgen-ran" });
          yield* fs.writeFileString(
            path.join(packageDir, "src/index.ts"),
            `/**
 * A fully documented export with a category outside the vocabulary.
 *
 * **Example** (Read the fixture)
 *
 * \`\`\`ts
 * console.log(1)
 * \`\`\`
 *
 * @category claim
 * @since 0.0.0
 */
export const invalidCategory = 1;
`
          );
          const report = yield* runPackageVerifyAtRootForTesting(tmpDir, {
            packageName: O.some("@beep/demo"),
            quick: false,
          });
          expect(report.results[2]).toMatchObject({ step: "docgen", skipped: false, ok: false });
          expect(report.results[2]?.output).toContain("invalid category");
          const exists4 = yield* fs.exists(path.join(packageDir, "docgen-ran"));
          expect(exists4).toBe(false);
        })
      ).pipe(TestClock.withLive)
    );

    it.effect("runs the root audit for the selected package without a package audit wrapper", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          yield* seedWorkspaceRepository(tmpDir, { docgen: "true" });
          const argument4 = path.join(tmpDir, "package.json");
          const encodedJson3 = yield* encodeJson({
            name: "verify-root",
            private: true,
            workspaces: ["packages/*"],
            scripts: { audit: "printf '%s' \"$PWD\" > audit-cwd; printf '%s' > audit-args" },
          });
          yield* fs.writeFileString(argument4, encodedJson3);

          const report = yield* runPackageVerifyAtRootForTesting(tmpDir, {
            packageName: O.some("@beep/demo"),
            quick: false,
          });

          expect(report.results).toHaveLength(3);
          expect(report.results[0]).toMatchObject({ step: "lint", skipped: true, ok: true });
          expect(report.results[1]).toMatchObject({
            step: "audit",
            skipped: false,
            ok: true,
          });
          const readFileString5 = yield* fs.readFileString(path.join(tmpDir, "audit-cwd"));
          expect(readFileString5).toBe(tmpDir);
          const readFileString6 = yield* fs.readFileString(path.join(tmpDir, "audit-args"));
          expect(readFileString6).toBe("--filter=@beep/demo");
          expect(report.results[2]).toMatchObject({ step: "docgen", skipped: false, ok: true });
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("reports a root audit failure even when the package has no audit wrapper", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const packageDir = yield* seedWorkspaceRepository(tmpDir, {
            "beep:lint": "true",
            docgen: "printf d >> docgen-ran",
          });
          const argument5 = path.join(tmpDir, "package.json");
          const encodedJson4 = yield* encodeJson({
            name: "verify-root",
            private: true,
            workspaces: ["packages/*"],
            scripts: { audit: "sh -c 'printf audit-failed; exit 7' --" },
          });
          yield* fs.writeFileString(argument5, encodedJson4);
          const report = yield* runPackageVerifyAtRootForTesting(tmpDir, {
            packageName: O.some("@beep/demo"),
            quick: false,
          });
          expect(report.results[0]).toMatchObject({ step: "lint", skipped: false, ok: true });
          expect(report.results[1]).toMatchObject({ step: "audit", skipped: false, ok: false });
          expect(report.results[2]).toMatchObject({ step: "docgen", skipped: false, ok: true });
          const docgenMarker = yield* fs.readFileString(path.join(packageDir, "docgen-ran"));
          expect(docgenMarker).toBe("d");
          assertSome(
            O.flatMap(
              A.findFirst(report.results, (result) => result.step === "audit"),
              (result) => result.exitCode
            ),
            7
          );
          expect(report.results[1]?.output).toContain("audit-failed");
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("fails instead of silently skipping a missing root audit command", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
        Effect.gen(function* () {
          yield* seedWorkspaceRepository(tmpDir, {});
          const report = yield* runPackageVerifyAtRootForTesting(tmpDir, {
            packageName: O.some("@beep/demo"),
            quick: false,
          });
          expect(report.results[1]).toMatchObject({ step: "audit", skipped: false, ok: false });
          expect(report.results[1]?.output).toContain('Script not found "audit"');
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("surfaces malformed workspace manifests", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const packageDir = path.join(tmpDir, "packages/demo");
          yield* fs.makeDirectory(packageDir, { recursive: true });
          yield* fs.writeFileString(path.join(packageDir, "package.json"), "{not-json");

          const error = yield* readPackageWorkspaceForTesting("@beep/demo", packageDir).pipe(Effect.flip);

          expect(error.message).toContain(`Failed to decode ${path.join(packageDir, "package.json")}`);

          // The retired projection required `name`; the lenient read keeps that verdict.
          const argument6 = path.join(packageDir, "package.json");
          const encodedJson5 = yield* encodeJson({ private: true });
          yield* fs.writeFileString(argument6, encodedJson5);
          const nameless = yield* readPackageWorkspaceForTesting("@beep/demo", packageDir).pipe(Effect.flip);
          expect(nameless.message).toContain(`Failed to decode ${path.join(packageDir, "package.json")}`);
          expect(String(nameless.cause)).toContain("does not declare a package name");

          const argument7 = path.join(packageDir, "package.json");
          const encodedJson6 = yield* encodeJson({ name: "@beep/demo" });
          yield* fs.writeFileString(argument7, encodedJson6);
          const workspace = yield* readPackageWorkspaceForTesting("@beep/demo", packageDir);
          expect(workspace.scripts).toEqual({});
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("surfaces a missing repository HEAD after verification", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
        Effect.gen(function* () {
          yield* seedWorkspaceRepository(tmpDir, { "beep:lint": "true", "beep:check": "true" }, { commit: false });

          const error = yield* runPackageVerifyAtRootForTesting(tmpDir, {
            packageName: O.some("@beep/demo"),
            quick: true,
          }).pipe(Effect.flip);

          expect(error.message).toContain("git rev-parse --verify HEAD failed with exit code");
          expect(error.command).toBe("git rev-parse --verify HEAD");
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("finishes later packages after a diagnostic failure and deduplicates names", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
        Effect.acquireUseRelease(
          Effect.sync(() => vi.spyOn(process, "cwd").mockReturnValue(tmpDir)),
          () =>
            Effect.gen(function* () {
              const fs = yield* FileSystem.FileSystem;
              const path = yield* Path.Path;
              yield* seedWorkspaceRepository(tmpDir, { "beep:lint": "false", "beep:check": "true" });
              const second = path.join(tmpDir, "packages/second");
              yield* fs.makeDirectory(second, { recursive: true });
              const manifest = yield* encodeJson({
                name: "@beep/second",
                private: true,
                scripts: { "beep:lint": "printf checked >> checked", "beep:check": "true" },
              });
              yield* fs.writeFileString(path.join(second, "package.json"), manifest);
              const turbo = path.join(tmpDir, "node_modules/.bin/turbo");
              yield* fs.makeDirectory(path.dirname(turbo), { recursive: true });
              yield* fs.writeFileString(turbo, "#!/bin/sh\nexit 0\n");
              yield* fs.chmod(turbo, 0o755);
              const error = yield* runPackageVerifyCli({
                packageArgs: ["@beep/demo", "@beep/second", "@beep/second"],
                quick: true,
              }).pipe(Effect.flip);
              expect(error.message).toBe("pkg-verify failed.");
              const checked = yield* fs.readFileString(path.join(second, "checked"));
              expect(checked).toBe("checked");
            }),
          (cwdSpy) => Effect.sync(() => cwdSpy.mockRestore())
        )
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

    it.effect("selects an explicit workspace package", () =>
      Effect.gen(function* () {
        const selected = yield* selectPackageVerifyTargetForTesting({
          changedFiles: [],
          packageName: O.some("@beep/demo"),
          repoRoot: "/repo",
          workspaces: [demoWorkspace, appWorkspace],
        });

        expect(selected.name).toBe("@beep/demo");
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("fails when changed files span multiple packages", () =>
      Effect.gen(function* () {
        const exit = yield* Effect.exit(
          selectPackageVerifyTargetForTesting({
            changedFiles: ["packages/demo/src/index.ts", "apps/app/src/main.ts"],
            packageName: O.none(),
            repoRoot: "/repo",
            workspaces: [demoWorkspace, appWorkspace],
          })
        );

        exit.pipe(Exit.isFailure, assertTrue);
        if (Exit.isFailure(exit)) {
          const error = Cause.squash(exit.cause);
          expect(error).toMatchObject({
            message: "pkg-verify: changed files span multiple packages: @beep/app, @beep/demo.",
          });
        }
      }).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("collects deleted package paths for workspace auto-detection", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const path = yield* Path.Path;
          const sourceFile = path.join(tmpDir, "packages/demo/src/index.ts");

          yield* runGit(tmpDir, ["init", "--quiet"]);
          yield* runGit(tmpDir, ["config", "user.email", "codex@example.invalid"]);
          yield* runGit(tmpDir, ["config", "user.name", "Codex"]);
          yield* runGit(tmpDir, ["config", "commit.gpgsign", "false"]);
          yield* fs.makeDirectory(path.dirname(sourceFile), { recursive: true });
          yield* fs.writeFileString(sourceFile, "export const demo = true;\n");
          yield* runGit(tmpDir, ["add", "."]);
          yield* runGit(tmpDir, ["commit", "--quiet", "-m", "initial"]);
          yield* fs.remove(sourceFile);

          const changedFiles = yield* collectPackageVerifyChangedFilesForTesting(tmpDir);

          expect(changedFiles).toEqual(["packages/demo/src/index.ts"]);
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make), TestClock.withLive)
    );

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

    it.effect("writes package failures to the shared inbox and clears them on success", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
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
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("clears quick lint and check poison after a successful full audit", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
        Effect.gen(function* () {
          const step = (name: "lint" | "check" | "audit", ok: boolean) =>
            PackageVerifyStepResult.make({
              step: name,
              script: name === "audit" ? "audit" : `beep:${name}`,
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
          yield* recordPackageVerifyInboxForTesting(report(false, [step("lint", true)]));
          const preflightOnly = yield* loadYeetInboxView(tmpDir);
          expect(A.map(preflightOnly.entries, (entry) => entry.ack.acked)).toEqual([false, false]);
          yield* recordPackageVerifyInboxForTesting(report(false, [step("lint", true), step("audit", false)]));
          const failedAudit = yield* loadYeetInboxView(tmpDir);
          expect(A.map(failedAudit.entries, (entry) => entry.ack.acked)).toEqual([false, false, false]);
          yield* recordPackageVerifyInboxForTesting(report(false, [step("lint", true), step("audit", true)]));

          const repaired = yield* loadYeetInboxView(tmpDir);
          expect(repaired.entries).toHaveLength(3);
          assertTrue(A.every(repaired.entries, (entry) => entry.ack.acked));
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("records the selected root audit command in a genuine failure capsule", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
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
                  script: "audit",
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
            expect(row.capsule.command).toBe("bun run audit --filter=@beep/demo");
          }
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );

    it.effect("records the Turbo closure build in a quick check failure capsule", () =>
      Effect.flatMap(temporaryDirectory, (tmpDir) =>
        Effect.gen(function* () {
          yield* recordPackageVerifyInboxForTesting(
            PackageVerifyReport.make({
              headSha: "abc123",
              packageName: "@beep/demo",
              packageDir: `${tmpDir}/packages/demo`,
              quick: true,
              repoRoot: tmpDir,
              results: [
                PackageVerifyStepResult.make({
                  step: "check",
                  script: "beep:check",
                  skipped: false,
                  ok: false,
                  durationMillis: 20,
                  exitCode: O.some(2),
                  output: "type error",
                }),
              ],
            })
          );

          const inbox = yield* loadYeetInboxView(tmpDir);
          const row = inbox.entries[0]?.row;
          expect(row?.kind).toBe("local-shard-failed");
          if (row?.kind === "local-shard-failed") {
            expect(row.capsule.command).toBe("bun x turbo run build --filter=@beep/demo^... && bun run beep:check");
          }
        })
      ).pipe(Effect.provideServiceEffect(Console.Console, TestConsole.make))
    );
  });
});
