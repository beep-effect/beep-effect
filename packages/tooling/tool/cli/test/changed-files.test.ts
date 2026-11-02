import { Git, GitCommandError } from "@beep/git/Git";
import { collectBaseRangeChangedFiles, collectDirtyWorktreeFiles } from "@beep/repo-cli/test/SharedInternals";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";

const REPO_ROOT = "/repo";
const BASE_RANGE = { base: "origin/main", head: "HEAD", diffFilter: "ACMR", pathspecs: ["*.ts"] };
const BASE_RANGE_COMMAND_LINE = "git diff --name-only -z --no-relative --diff-filter=ACMR origin/main...HEAD -- *.ts";
const STAGED_COMMAND_LINE = "git diff --name-only -z --no-relative --cached --diff-filter=ACMR";

// A spawn failure carries a `detail` and no exit code; a git refusal carries the exit code (SPEC D-10).
const spawnFailure = GitCommandError.make({
  kind: "failed",
  args: ["diff"],
  cwd: REPO_ROOT,
  stderr: "",
  detail: "spawn git ENOENT",
});
const exitFailure = GitCommandError.make({
  kind: "failed",
  args: ["diff"],
  cwd: REPO_ROOT,
  exitCode: 128,
  stderr: "fatal: bad revision 'origin/main...HEAD'\n",
});

describe("collectBaseRangeChangedFiles", () => {
  it.effect("normalizes the kit's paths into trimmed forward-slash entries", () =>
    collectBaseRangeChangedFiles(REPO_ROOT, BASE_RANGE).pipe(
      Effect.tap((paths) => Effect.sync(() => expect(paths).toEqual(["src/a.ts", "src/win/b.ts"]))),
      Effect.provideService(
        Git,
        Git.makeTest({ changedFiles: () => Effect.succeed([" src/a.ts ", "src\\win\\b.ts", "  "]) })
      )
    )
  );

  it.effect("reports a git that never ran with the kit's command line and the spawn cause", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(collectBaseRangeChangedFiles(REPO_ROOT, BASE_RANGE));

      expect(error._tag).toBe("DomainError");
      expect(error.message).toBe(`${BASE_RANGE_COMMAND_LINE} failed to run.`);
      expect(error.cause).toBe(spawnFailure);
    }).pipe(Effect.provideService(Git, Git.makeTest({ changedFiles: () => Effect.fail(spawnFailure) })))
  );

  it.effect("reports a refused diff with its exit code and trimmed stderr", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(collectBaseRangeChangedFiles(REPO_ROOT, BASE_RANGE));

      expect(error._tag).toBe("DomainError");
      expect(error.message).toBe(
        `${BASE_RANGE_COMMAND_LINE} failed with exit code 128: fatal: bad revision 'origin/main...HEAD'`
      );
    }).pipe(Effect.provideService(Git, Git.makeTest({ changedFiles: () => Effect.fail(exitFailure) })))
  );
});

describe("collectDirtyWorktreeFiles", () => {
  // The staged probe cannot spawn git while the other two probes answer.
  const brokenStagedProbe = Git.makeTest({
    unstagedChanges: () => Effect.succeed(["src/unstaged.ts"]),
    stagedChanges: () => Effect.fail(spawnFailure),
    untrackedFiles: () => Effect.succeed(["src/untracked.ts"]),
  });

  it.effect("fails the scan on a probe that cannot spawn git when the policy is fail", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        collectDirtyWorktreeFiles(REPO_ROOT, { diffFilter: "ACMR", pathspecs: [], onProbeFailure: "fail" })
      );

      expect(error._tag).toBe("DomainError");
      expect(error.message).toBe(`Unable to resolve dirty worktree files via "${STAGED_COMMAND_LINE}".`);
      expect(error.cause).toMatchObject({ _tag: "DomainError", message: `${STAGED_COMMAND_LINE} failed to run.` });
    }).pipe(Effect.provideService(Git, brokenStagedProbe))
  );

  it.effect("degrades a probe that cannot spawn git to no files when the policy is ignore", () =>
    Effect.gen(function* () {
      const paths = yield* collectDirtyWorktreeFiles(REPO_ROOT, {
        diffFilter: "ACMR",
        pathspecs: [],
        onProbeFailure: "ignore",
      });

      expect(paths).toEqual(["src/unstaged.ts", "src/untracked.ts"]);
    }).pipe(Effect.provideService(Git, brokenStagedProbe))
  );
});
