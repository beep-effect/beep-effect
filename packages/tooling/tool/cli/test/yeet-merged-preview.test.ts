import {
  defaultYeetRunOptions,
  gitObjectIdFromOutput,
  parseYeetMergeTreeResult,
  RepoRunContext,
  renderYeetMergePreviewConflict,
  validateMonitorGuards,
  YeetMergePreview,
  YeetMergeTreeConflicted,
  yeetMergedPreviewContext,
} from "@beep/repo-cli/test/Yeet";
import { describe, expect, it } from "@effect/vitest";
import { Effect, Exit } from "effect";
import * as O from "effect/Option";

const TREE_SHA = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
const BASE_SHA = "1111111111111111111111111111111111111111";
const HEAD_SHA = "2222222222222222222222222222222222222222";
const COMMIT_SHA = "3333333333333333333333333333333333333333";

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
const conflictedOutput = [
  TREE_SHA,
  `100644 ${BASE_SHA} 1\tgoals/INDEX.md`,
  `100644 ${HEAD_SHA} 2\tgoals/INDEX.md`,
  `100644 ${COMMIT_SHA} 3\tgoals/INDEX.md`,
  "",
  "Auto-merging goals/INDEX.md",
  "CONFLICT (content): Merge conflict in goals/INDEX.md",
].join("\n");

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
    expect(gitObjectIdFromOutput(noisy)).toStrictEqual(O.some(TREE_SHA));
  });

  it("reads no object id out of a capture that carries only prose", () => {
    // `error: duplicate parent <sha> ignored` embeds a 40-hex id mid-line;
    // requiring the id to own its line is what keeps that out of the result.
    expect(gitObjectIdFromOutput(`error: duplicate parent ${BASE_SHA} ignored`)).toStrictEqual(O.none());
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
    expect(derived.packetDir.startsWith(preview.worktreePath)).toBe(false);
  });
});

describe("yeet merged tier guards", () => {
  it.effect("refuses --merged outside verify", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        validateMonitorGuards(context, defaultYeetRunOptions({ merged: true, mode: "publish" }))
      );

      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it.effect("refuses --merged on a review-fix tier", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        validateMonitorGuards(context, defaultYeetRunOptions({ merged: true, mode: "verify", tier: "review-fix" }))
      );

      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  it.effect("accepts --merged on a full verify", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        validateMonitorGuards(context, defaultYeetRunOptions({ merged: true, mode: "verify", tier: "full" }))
      );

      expect(Exit.isSuccess(exit)).toBe(true);
    })
  );
});
