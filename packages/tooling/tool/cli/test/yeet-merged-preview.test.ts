import { Git } from "@beep/git/Git";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  createYeetMergePreview,
  defaultYeetRunOptions,
  gitObjectIdFromOutput,
  parseYeetMergeTreeResult,
  RepoRunContext,
  renderYeetMergePreviewConflict,
  validateMonitorGuards,
  YEET_MERGED_PREVIEW_COMMIT_MESSAGE,
  YEET_MERGED_PREVIEW_DIR_NAME,
  YeetMergePreview,
  YeetMergeTreeConflicted,
  yeetMergedPreviewContext,
} from "@beep/repo-cli/test/Yeet";
import * as BunCrypto from "@effect/platform-bun/BunCrypto";
import { NodeChildProcessSpawner, NodeCrypto, NodeServices } from "@effect/platform-node";
import * as NodePath from "@effect/platform-node/NodePath";
import { describe, expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const TREE_SHA = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const BASE_SHA = "1111111111111111111111111111111111111111";
const HEAD_SHA = "2222222222222222222222222222222222222222";
const COMMIT_SHA = "3333333333333333333333333333333333333333";

const PlatformLayer = Git.layer.pipe(
  Layer.provideMerge(NodeChildProcessSpawner.layer),
  Layer.provideMerge(Layer.mergeAll(BunCrypto.layer, MemoryFileSystem.layer, NodePath.layer))
);

const context = RepoRunContext.make({
  base: "origin/main",
  branch: "feat/speed-loop-wrapup-widgets",
  cwd: "/repo",
  head: "HEAD",
  originalArgv: [],
  packetDir: ".beep/yeet",
  repoRoot: "/repo",
  turbo: { graphHealthStatus: "ok", graphHealthWarnings: [], tasks: [] },
});

const preview = YeetMergePreview.make({
  baseRef: "origin/main",
  baseSha: BASE_SHA,
  commitSha: COMMIT_SHA,
  headSha: HEAD_SHA,
  treeSha: TREE_SHA,
  worktreePath: "/repo/.beep/yeet/merged-preview",
});

// `git merge-tree --write-tree` prints the written tree, then — on conflict —
// one `<mode> <object> <stage>\t<path>` line per merge stage, then its own
// messages. These fixtures keep that exact layout.
const conflictedOutput = A.join(
  [
    TREE_SHA,
    `100644 ${BASE_SHA} 1\tgoals/INDEX.md`,
    `100644 ${HEAD_SHA} 2\tgoals/INDEX.md`,
    `100644 ${COMMIT_SHA} 3\tgoals/INDEX.md`,
    "",
    "Auto-merging goals/INDEX.md",
    "CONFLICT (content): Merge conflict in goals/INDEX.md",
  ],
  "\n"
);

describe("yeet merge-tree parsing", () => {
  it("reads a clean merge as the written tree object", () => {
    const result = parseYeetMergeTreeResult(0, `${TREE_SHA}\n`);

    expect(result.status).toBe("merged");
    expect(result.status === "merged" ? result.treeSha : "").toBe(TREE_SHA);
  });

  it("reads exit 1 as conflicts and names every conflicted path once", () => {
    // The same path appears once per merge stage. Three stages are one
    // conflict, not three, so the paths are deduplicated.
    const result = parseYeetMergeTreeResult(1, conflictedOutput);

    expect(result.status).toBe("conflicted");
    expect(result.status === "conflicted" ? result.paths : []).toStrictEqual(["goals/INDEX.md"]);
    expect(result.status === "conflicted" ? result.messages : []).toStrictEqual([
      "CONFLICT (content): Merge conflict in goals/INDEX.md",
    ]);
  });

  it("reads any other exit code as git declining to compute the merge", () => {
    // Exit 128 is git refusing outright — an unknown ref, a corrupt object. It
    // must never read as "no conflicts", which is what an output-only parse of
    // the same empty stdout would conclude.
    const result = parseYeetMergeTreeResult(128, "fatal: not a valid object name: origin/main");

    expect(result.status).toBe("unavailable");
    expect(result.status === "unavailable" ? result.detail : "").toContain("not a valid object name");
  });

  it("refuses a zero exit whose output carries no tree object", () => {
    expect(parseYeetMergeTreeResult(0, "").status).toBe("unavailable");
  });

  it("finds the tree object past git's own diagnostics", () => {
    // Yeet captures git with stdout and stderr merged, and git writes advisory
    // lines to stderr while still succeeding. Trimming the whole capture would
    // hand that prose back as an object id.
    const noisy = `warning: something advisory\n${TREE_SHA}\n`;

    expect(parseYeetMergeTreeResult(0, noisy).status).toBe("merged");
    assertSome(gitObjectIdFromOutput(noisy), TREE_SHA);
  });

  it("reads no object id out of a capture that carries only prose", () => {
    // `error: duplicate parent <sha> ignored` embeds a 40-hex id mid-line;
    // requiring the id to own its line is what keeps that out of the result.
    assertNone(gitObjectIdFromOutput(`error: duplicate parent ${BASE_SHA} ignored`));
  });

  it("renders a conflict refusal that names a merge, not a rebase", () => {
    // The preview models what hosted CI runs, and hosted CI merges. Telling the
    // operator to rebase would ask them to rewrite pushed history to resolve a
    // merge that has not happened yet.
    const rendered = renderYeetMergePreviewConflict(
      "origin/main",
      YeetMergeTreeConflicted.make({ paths: ["goals/INDEX.md"], messages: [] })
    );

    expect(rendered).toContain("conflicted: goals/INDEX.md");
    expect(rendered).toContain("git merge origin/main");
    expect(rendered).not.toContain("git rebase");
  });
});

describe("yeet merged preview context", () => {
  it("uses a conventional subject for the synthetic preview commit", () => {
    expect(YEET_MERGED_PREVIEW_COMMIT_MESSAGE).toBe("chore(yeet): verify merged preview");
    expect(YEET_MERGED_PREVIEW_COMMIT_MESSAGE.length).toBeLessThanOrEqual(100);
  });

  it("isolates the preview directory by process", () => {
    expect(YEET_MERGED_PREVIEW_DIR_NAME).toBe(`merged-preview-${process.pid}`);
  });

  it("moves the tree the proof runs on without moving the run identity", () => {
    const derived = yeetMergedPreviewContext(context, preview, "/repo/.beep/yeet");

    expect(derived.repoRoot).toBe(preview.worktreePath);
    expect(derived.cwd).toBe(preview.worktreePath);
    expect(derived.head).toBe(COMMIT_SHA);
    // Branch and base are the run's identity, not its location: keeping them
    // keeps artifacts landing under the same run id as an ordinary verify.
    expect(derived.branch).toBe(context.branch);
    expect(derived.base).toBe(context.base);
  });

  it("keeps artifacts in the primary worktree, which outlives the preview", () => {
    // The preview directory is removed as soon as the proof finishes. A
    // relative packet dir would put the failing proof's issue artifacts inside
    // it and delete exactly the evidence the run exists to produce.
    const derived = yeetMergedPreviewContext(context, preview, "/repo/.beep/yeet");

    expect(derived.packetDir).toBe("/repo/.beep/yeet");
    expect(Str.startsWith(preview.worktreePath)(derived.packetDir)).toBe(false);
  });
});

it.layer(PlatformLayer, { timeout: "30 seconds" })("yeet merged tier guards", (it) => {
  it.effect("refuses --merged outside verify", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        validateMonitorGuards(context, defaultYeetRunOptions({ merged: true, mode: "publish" }))
      );

      exit.pipe(Exit.isFailure, assertTrue);
    })
  );

  it.effect("refuses --merged on a review-fix tier", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        validateMonitorGuards(context, defaultYeetRunOptions({ merged: true, mode: "verify", tier: "review-fix" }))
      );

      exit.pipe(Exit.isFailure, assertTrue);
    })
  );

  it.effect("accepts --merged on a full verify", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        validateMonitorGuards(context, defaultYeetRunOptions({ merged: true, mode: "verify", tier: "full" }))
      );

      exit.pipe(Exit.isSuccess, assertTrue);
    })
  );

  it.effect("accepts --ci-parity on a full verify", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        validateMonitorGuards(context, defaultYeetRunOptions({ ciParity: true, mode: "verify", tier: "full" }))
      );

      exit.pipe(Exit.isSuccess, assertTrue);
    })
  );

  it.effect("refuses --ci-parity outside full verify", () =>
    Effect.gen(function* () {
      const publishExit = yield* Effect.exit(
        validateMonitorGuards(context, defaultYeetRunOptions({ ciParity: true, mode: "publish" }))
      );
      const mergedExit = yield* Effect.exit(
        validateMonitorGuards(context, defaultYeetRunOptions({ ciParity: true, merged: true, mode: "verify" }))
      );

      publishExit.pipe(Exit.isFailure, assertTrue);
      mergedExit.pipe(Exit.isFailure, assertTrue);
    })
  );
});

const scratchGit = Effect.fn("YeetMergedPreviewTest.scratchGit")(function* (cwd: string, args: ReadonlyArray<string>) {
  const handle = yield* ChildProcess.make("git", [...args], { cwd, stdin: "ignore", stdout: "pipe", stderr: "ignore" });
  const output = yield* handle.stdout.pipe(Stream.decodeText(), Stream.mkString);
  const exitCode1 = yield* handle.exitCode;
  expect(exitCode1).toBe(0);
  return Str.trim(output);
});

// The preview worktree is added through `Git.worktreeAdd` (W2b); these drive the whole
// materialization against a real repository, so the add, the leftover removal before it and the
// conflict refusal all run for real.
it.layer(Layer.provideMerge(Git.layer, Layer.mergeAll(NodeServices.layer, NodeCrypto.layer)), {
  timeout: "30 seconds",
})("yeet merge preview materialization", (it) => {
  const scratchRepo = Effect.fn("YeetMergedPreviewTest.scratchRepo")(function* (conflict: boolean) {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const repo = yield* fs.makeTempDirectoryScoped({ prefix: "yeet-merged-preview-" });
    yield* scratchGit(repo, ["init", "--quiet", "-b", "main"]);
    for (const [key, value] of [
      ["user.email", "preview@example.com"],
      ["user.name", "Preview"],
      ["commit.gpgsign", "false"],
    ] as const)
      yield* scratchGit(repo, ["config", key, value]);
    yield* fs.writeFileString(path.join(repo, "README.md"), "base\n");
    yield* scratchGit(repo, ["add", "README.md"]);
    yield* scratchGit(repo, ["commit", "--quiet", "-m", "base"]);
    yield* scratchGit(repo, ["checkout", "--quiet", "-b", "feature"]);
    yield* fs.writeFileString(path.join(repo, conflict ? "README.md" : "feature.md"), "feature\n");
    yield* scratchGit(repo, ["add", "-A"]);
    yield* scratchGit(repo, ["commit", "--quiet", "-m", "feature"]);
    yield* scratchGit(repo, ["checkout", "--quiet", "main"]);
    yield* fs.writeFileString(path.join(repo, conflict ? "README.md" : "main.md"), "main\n");
    yield* scratchGit(repo, ["add", "-A"]);
    yield* scratchGit(repo, ["commit", "--quiet", "-m", "main"]);
    yield* scratchGit(repo, ["checkout", "--quiet", "feature"]);
    return RepoRunContext.make({
      ...context,
      base: "main",
      cwd: repo,
      packetDir: path.join(repo, ".beep", "yeet"),
      repoRoot: repo,
    });
  });

  it.effect("materializes the merge as a detached worktree, replacing a leftover preview", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoContext = yield* scratchRepo(false);
      const first = yield* createYeetMergePreview(repoContext);
      yield* fs.writeFileString(path.join(first.worktreePath, "leftover-only.txt"), "stale preview\n");
      // Synthetic commit metadata may change between materializations.
      yield* scratchGit(repoContext.repoRoot, ["config", "user.name", "Preview recreated"]);
      // A second run removes the first run's preview before adding its own.
      const preview = yield* createYeetMergePreview(repoContext);
      expect(preview.commitSha).not.toBe(first.commitSha);
      expect(preview.treeSha).toBe(first.treeSha);
      expect(preview.baseSha).toBe(first.baseSha);
      expect(preview.headSha).toBe(first.headSha);
      expect(preview.worktreePath).toBe(first.worktreePath);
      const exists2 = yield* fs.exists(path.join(preview.worktreePath, "leftover-only.txt"));
      expect(exists2).toBe(false);
      const exists3 = yield* fs.exists(path.join(preview.worktreePath, "feature.md"));
      expect(exists3).toBe(true);
      const exists4 = yield* fs.exists(path.join(preview.worktreePath, "main.md"));
      expect(exists4).toBe(true);
      const scratchGit5 = yield* scratchGit(preview.worktreePath, ["rev-parse", "HEAD"]);
      expect(scratchGit5).toBe(preview.commitSha);
      const scratchGit6 = yield* scratchGit(preview.worktreePath, ["rev-parse", "HEAD^{tree}"]);
      expect(scratchGit6).toBe(preview.treeSha);
      const scratchGit7 = yield* scratchGit(preview.worktreePath, ["show", "--no-patch", "--format=%P", "HEAD"]);
      expect(scratchGit7).toBe(`${preview.baseSha} ${preview.headSha}`);
      const scratchGit8 = yield* scratchGit(preview.worktreePath, ["rev-parse", "--abbrev-ref", "HEAD"]);
      expect(scratchGit8).toBe("HEAD");
    })
  );

  it.effect("refuses a merge that conflicts, naming the conflicted path", () =>
    Effect.gen(function* () {
      const repoContext = yield* scratchRepo(true);
      const error = yield* Effect.flip(createYeetMergePreview(repoContext));
      expect(error.message).toContain("README.md");
    })
  );
});
