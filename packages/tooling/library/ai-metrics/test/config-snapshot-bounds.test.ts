import {
  AiMetricsConfigScope,
  AiMetricsConfigSnapshotBoundsReport,
  AiMetricsConfigSnapshotBudget,
  AiMetricsConfigSnapshotInput,
  AiMetricsConfigSnapshotResult,
  AiMetricsConfigSnapshotStage,
  AiMetricsConfigSnapshotTruncationReason,
  makeAiMetricsConfigSnapshot,
} from "@beep/repo-ai-metrics/config-snapshot";
import { fcRuns } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { Effect, FileSystem, Layer, Path, pipe, Ref } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

const encodeConfigSnapshotBoundsReport = S.encodeUnknownEffect(AiMetricsConfigSnapshotBoundsReport);
const encodeConfigSnapshotInput = S.encodeUnknownEffect(AiMetricsConfigSnapshotInput);
const encodeUnknownJson = S.encodeUnknownEffect(S.UnknownFromJsonString);

const legitimatePaths = [
  ".claude/settings.json",
  ".claude/skills/a/SKILL.md",
  ".codex/config.toml",
  "AGENTS.md",
  "CLAUDE.md",
  "packages/p/AGENTS.md",
];

const legacyLatest = {
  diff: { addedPaths: [], modifiedPaths: [], removedPaths: [], unchangedPaths: [] },
  excludedDirectoryNames: [".git", "node_modules"],
  fileCount: 2,
  files: [
    { contentHash: "legacy-agents-hash", relativePath: "AGENTS.md", sizeBytes: 9 },
    { contentHash: "legacy-gone-hash", relativePath: ".claude/worktrees/wt1/AGENTS.md", sizeBytes: 5 },
  ],
  snapshot: {
    changedPaths: [],
    configHash: "legacy-config-hash",
    includedPaths: ["AGENTS.md", ".claude/worktrees/wt1/AGENTS.md"],
    label: "repo-local-agent-config",
    snapshotId: "config-legacy",
  },
};

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A2, E, R>(effect: Effect.Effect<A2, E, R>): Effect.Effect<A2, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const withTempDirectory = <A2, E, R>(use: (tmpDir: string) => Effect.Effect<A2, E, R>) =>
  Effect.acquireUseRelease(
    Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectory()),
    use,
    (tmpDir) => Effect.flatMap(FileSystem.FileSystem, (fs) => fs.remove(tmpDir, { recursive: true, force: true }))
  );

const writeText = Effect.fn("configSnapshotBoundsTest.writeText")(function* (filePath: string, content: string) {
  const fs = yield* FileSystem.FileSystem;
  const pathApi = yield* Path.Path;
  yield* fs.makeDirectory(pathApi.dirname(filePath), { recursive: true });
  yield* fs.writeFileString(filePath, content);
});

const makeFixtureRepo = Effect.fn("configSnapshotBoundsTest.makeFixtureRepo")(function* (
  repoRoot: string,
  options?: { readonly nestedWorktreeFileCount?: number }
) {
  const pathApi = yield* Path.Path;
  yield* writeText(pathApi.join(repoRoot, "AGENTS.md"), "root agents\n");
  yield* writeText(pathApi.join(repoRoot, "CLAUDE.md"), "root claude\n");
  yield* writeText(pathApi.join(repoRoot, ".codex/config.toml"), "model = 'sol'\n");
  yield* writeText(pathApi.join(repoRoot, ".claude/settings.json"), '{"theme":"dark"}\n');
  yield* writeText(pathApi.join(repoRoot, ".claude/skills/a/SKILL.md"), "skill a\n");
  yield* writeText(pathApi.join(repoRoot, "packages/p/AGENTS.md"), "package agents\n");

  const worktreeRoot = pathApi.join(repoRoot, ".claude/worktrees/wt1");
  yield* writeText(pathApi.join(worktreeRoot, ".git"), `gitdir: ${pathApi.join(repoRoot, ".git/worktrees/wt1")}\n`);
  yield* Effect.forEach(
    A.range(1, options?.nestedWorktreeFileCount ?? 50),
    (index) => writeText(pathApi.join(worktreeRoot, `pkg-${index}/AGENTS.md`), `nested ${index}\n`),
    { discard: true }
  );

  const vendorRoot = pathApi.join(repoRoot, "vendor/sub");
  yield* writeText(pathApi.join(vendorRoot, ".git/HEAD"), "ref: refs/heads/main\n");
  yield* writeText(pathApi.join(vendorRoot, "AGENTS.md"), "vendored agents\n");
  yield* writeText(pathApi.join(vendorRoot, ".claude/settings.json"), '{"theme":"light"}\n');
});

const snapshotPaths = (files: ReadonlyArray<{ readonly relativePath: string }>): ReadonlyArray<string> =>
  A.map(files, (file) => file.relativePath);

describe("@beep/repo-ai-metrics bounded config snapshots", () => {
  it("generates only canonical truncation reasons", () =>
    fc.assert(
      fc.property(
        S.toArbitrary(AiMetricsConfigSnapshotTruncationReason)(fc),
        S.is(AiMetricsConfigSnapshotTruncationReason)
      ),
      fcRuns(25)
    ));

  it.effect("stops at every nested git root and records it instead of walking into it", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const repoRoot = pathApi.join(tmpDir, "repo");
        yield* makeFixtureRepo(repoRoot);

        const result = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot }));
        const paths = snapshotPaths(result.files);

        expect(A.some(paths, (path) => pipe(path, Str.startsWith(".claude/worktrees/")))).toBe(false);
        expect(A.some(paths, (path) => pipe(path, Str.startsWith("vendor/sub")))).toBe(false);
        expect(result.bounds.excludedNestedRootPaths).toContain(".claude/worktrees/wt1");
        expect(result.bounds.excludedNestedRootPaths).toContain("vendor/sub");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("includes exactly the legitimate agent-configuration surface", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const repoRoot = pathApi.join(tmpDir, "repo");
        yield* makeFixtureRepo(repoRoot);

        const result = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot }));

        expect(snapshotPaths(result.files)).toEqual(legitimatePaths);
        expect(result.fileCount).toBe(A.length(legitimatePaths));
        expect(result.bounds.truncated).toBe(false);
        expect(O.isNone(result.bounds.truncationReason)).toBe(true);
        expect(result.bounds.skippedOversizeFileCount).toBe(0);
        expect(result.bounds.totalBytes).toBeGreaterThan(0);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("tags the session-effective files and leaves everything else baseline", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const repoRoot = pathApi.join(tmpDir, "repo");
        yield* makeFixtureRepo(repoRoot);

        const result = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot }));
        const sessionPaths = pipe(
          A.filter(result.files, (file) => file.scope === AiMetricsConfigScope.Enum.session),
          snapshotPaths
        );
        const baselinePaths = pipe(
          A.filter(result.files, (file) => file.scope === AiMetricsConfigScope.Enum.baseline),
          snapshotPaths
        );

        expect(sessionPaths).toEqual([".claude/settings.json", ".codex/config.toml", "AGENTS.md", "CLAUDE.md"]);
        expect(baselinePaths).toEqual([".claude/skills/a/SKILL.md", "packages/p/AGENTS.md"]);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("moves the session hash only for session files and the baseline hash only for baseline files", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const repoRoot = pathApi.join(tmpDir, "repo");
        yield* makeFixtureRepo(repoRoot);

        const before = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot }));

        yield* writeText(pathApi.join(repoRoot, "AGENTS.md"), "root agents changed\n");
        const afterSession = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot }));
        expect(afterSession.sessionHash).not.toBe(before.sessionHash);
        expect(afterSession.baselineHash).toBe(before.baselineHash);

        yield* writeText(pathApi.join(repoRoot, ".claude/skills/a/SKILL.md"), "skill a changed\n");
        const afterBaseline = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot }));
        expect(afterBaseline.baselineHash).not.toBe(afterSession.baselineHash);
        expect(afterBaseline.sessionHash).toBe(afterSession.sessionHash);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("produces a stable config hash across two runs on an unchanged tree", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const repoRoot = pathApi.join(tmpDir, "repo");
        yield* makeFixtureRepo(repoRoot);

        const first = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot }));
        const second = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot }));

        expect(second.snapshot.configHash).toBe(first.snapshot.configHash);
        expect(second.snapshot.snapshotId).toBe(first.snapshot.snapshotId);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("truncates deterministically at the file-count budget", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const repoRoot = pathApi.join(tmpDir, "repo");
        yield* makeFixtureRepo(repoRoot);
        const input = AiMetricsConfigSnapshotInput.make({
          budget: AiMetricsConfigSnapshotBudget.make({ maxFiles: 3 }),
          repoRoot,
        });

        const first = yield* makeAiMetricsConfigSnapshot(input);
        const second = yield* makeAiMetricsConfigSnapshot(input);

        expect(first.bounds.truncated).toBe(true);
        expect(first.bounds.truncationReason).toEqual(
          O.some(AiMetricsConfigSnapshotTruncationReason.Enum["max-files"])
        );
        expect(first.fileCount).toBe(3);
        expect(snapshotPaths(second.files)).toEqual(snapshotPaths(first.files));
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  // A bulky non-git directory under a config root must not be able to spend the whole file budget
  // before the repo-root agent docs are reached. Losing `AGENTS.md`/`CLAUDE.md` is not ordinary
  // truncation: they are session-scope, so their absence silently moves `sessionHash`.
  it.effect("never starves the root agent docs when a config root exhausts the file budget", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const repoRoot = pathApi.join(tmpDir, "repo");
        yield* makeFixtureRepo(repoRoot);
        yield* Effect.forEach(
          A.range(1, 20),
          (index) => writeText(pathApi.join(repoRoot, `.claude/leftover/note-${index}.md`), `leftover ${index}\n`),
          { discard: true }
        );

        const result = yield* makeAiMetricsConfigSnapshot(
          AiMetricsConfigSnapshotInput.make({
            budget: AiMetricsConfigSnapshotBudget.make({ maxFiles: 4 }),
            repoRoot,
          })
        );
        const paths = snapshotPaths(result.files);

        expect(paths).toContain("AGENTS.md");
        expect(paths).toContain("CLAUDE.md");
        expect(result.bounds.truncated).toBe(true);
        expect(result.bounds.truncationReason).toEqual(
          O.some(AiMetricsConfigSnapshotTruncationReason.Enum["max-files"])
        );
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("reports the byte and depth budgets with their own reasons", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const repoRoot = pathApi.join(tmpDir, "repo");
        yield* makeFixtureRepo(repoRoot);

        const byBytes = yield* makeAiMetricsConfigSnapshot(
          AiMetricsConfigSnapshotInput.make({
            budget: AiMetricsConfigSnapshotBudget.make({ maxTotalBytes: 20 }),
            repoRoot,
          })
        );
        expect(byBytes.bounds.truncated).toBe(true);
        expect(byBytes.bounds.truncationReason).toEqual(
          O.some(AiMetricsConfigSnapshotTruncationReason.Enum["max-total-bytes"])
        );

        const byDepth = yield* makeAiMetricsConfigSnapshot(
          AiMetricsConfigSnapshotInput.make({
            budget: AiMetricsConfigSnapshotBudget.make({ maxDepth: 1 }),
            repoRoot,
          })
        );
        expect(byDepth.bounds.truncated).toBe(true);
        expect(byDepth.bounds.truncationReason).toEqual(
          O.some(AiMetricsConfigSnapshotTruncationReason.Enum["max-depth"])
        );
        expect(snapshotPaths(byDepth.files)).not.toContain(".claude/skills/a/SKILL.md");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("skips and counts a file above the per-file byte budget", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const repoRoot = pathApi.join(tmpDir, "repo");
        yield* makeFixtureRepo(repoRoot);
        yield* writeText(pathApi.join(repoRoot, ".claude/skills/a/SKILL.md"), pipe("x", Str.repeat(4096)));

        const result = yield* makeAiMetricsConfigSnapshot(
          AiMetricsConfigSnapshotInput.make({
            budget: AiMetricsConfigSnapshotBudget.make({ maxFileBytes: 1024 }),
            repoRoot,
          })
        );

        expect(result.bounds.skippedOversizeFileCount).toBe(1);
        expect(snapshotPaths(result.files)).not.toContain(".claude/skills/a/SKILL.md");
        expect(result.bounds.truncated).toBe(false);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("emits one timing per measured pipeline stage and none for the write it does not perform", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const repoRoot = pathApi.join(tmpDir, "repo");
        yield* makeFixtureRepo(repoRoot);

        const result = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot }));

        expect(A.map(result.stageTimings, (timing) => timing.stage)).toEqual([
          AiMetricsConfigSnapshotStage.Enum.enumerate,
          AiMetricsConfigSnapshotStage.Enum.read,
          AiMetricsConfigSnapshotStage.Enum.hash,
          AiMetricsConfigSnapshotStage.Enum.diff,
        ]);
        expect(A.every(result.stageTimings, (timing) => timing.durationMillis >= 0)).toBe(true);
        expect(A.every(result.stageTimings, (timing) => timing.byteCount >= 0)).toBe(true);
        expect(A.every(result.stageTimings, (timing) => timing.fileCount === result.fileCount)).toBe(true);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("decodes a pre-bounding latest.json and diffs against it", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const pathApi = yield* Path.Path;
        const repoRoot = pathApi.join(tmpDir, "repo");
        const previousSnapshotPath = pathApi.join(tmpDir, "store/config-snapshots/latest.json");
        yield* makeFixtureRepo(repoRoot);
        yield* writeText(previousSnapshotPath, yield* encodeUnknownJson(legacyLatest));

        const result = yield* makeAiMetricsConfigSnapshot(
          AiMetricsConfigSnapshotInput.make({ previousSnapshotPath: O.some(previousSnapshotPath), repoRoot })
        );

        expect(result.previousSnapshotId).toEqual(O.some("config-legacy"));
        expect(result.diff.modifiedPaths).toContain("AGENTS.md");
        expect(result.diff.removedPaths).toContain(".claude/worktrees/wt1/AGENTS.md");
        expect(result.diff.addedPaths).toContain(".claude/skills/a/SKILL.md");
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );

  it.effect("preserves optional-key encoding while carrying absence as Option", () =>
    Effect.gen(function* () {
      const input = AiMetricsConfigSnapshotInput.make({ repoRoot: "/repo" });
      const encodedInput = yield* encodeConfigSnapshotInput(input);
      expect(encodedInput).toEqual({
        budget: { maxDepth: 8, maxFileBytes: 524288, maxFiles: 1000, maxTotalBytes: 8388608 },
        label: "repo-local-agent-config",
        repoRoot: "/repo",
      });

      const bounds = AiMetricsConfigSnapshotBoundsReport.make({
        excludedNestedRootPaths: [],
        skippedOversizeFileCount: 0,
        totalBytes: 0,
        truncated: false,
      });
      expect(yield* encodeConfigSnapshotBoundsReport(bounds)).toEqual({
        budget: { maxDepth: 8, maxFileBytes: 524288, maxFiles: 1000, maxTotalBytes: 8388608 },
        excludedNestedRootPaths: [],
        skippedOversizeFileCount: 0,
        totalBytes: 0,
        truncated: false,
      });

      const result = AiMetricsConfigSnapshotResult.make({
        excludedDirectoryNames: [],
        diff: {
          addedPaths: [],
          modifiedPaths: [],
          removedPaths: [],
          unchangedPaths: [],
        },
        fileCount: 0,
        files: [],
        snapshot: {
          changedPaths: [],
          configHash: "config-hash",
          label: "repo-local-agent-config",
          snapshotId: "config-1",
        },
      });
      expect(yield* AiMetricsConfigSnapshotResult.encodeJsonEffect(result)).not.toContain('"previousSnapshotId"');
    })
  );

  it.effect("never stats the contents of a nested worktree", () =>
    withTempDirectory(
      Effect.fnUntraced(function* (tmpDir) {
        const fs = yield* FileSystem.FileSystem;
        const pathApi = yield* Path.Path;
        const repoRoot = pathApi.join(tmpDir, "repo");
        yield* makeFixtureRepo(repoRoot, { nestedWorktreeFileCount: 400 });

        const statCount = yield* Ref.make(0);
        const countingFs: FileSystem.FileSystem = {
          ...fs,
          stat: (path: string) => Ref.update(statCount, (count) => count + 1).pipe(Effect.flatMap(() => fs.stat(path))),
        };

        const result = yield* makeAiMetricsConfigSnapshot(AiMetricsConfigSnapshotInput.make({ repoRoot })).pipe(
          Effect.provideService(FileSystem.FileSystem, countingFs)
        );

        expect(result.fileCount).toBe(A.length(legitimatePaths));
        expect(yield* Ref.get(statCount)).toBeLessThan(100);
      })
    ).pipe(provideScopedLayer(NodeServices.layer))
  );
});
