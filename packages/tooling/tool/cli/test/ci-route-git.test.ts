import { Git, GitCommandError, NotARepositoryError, UnknownRefError } from "@beep/git/Git";
import { makeRouteGit } from "@beep/repo-cli/commands/Ci/RouteCensus";
import { runRepoCommandCapture } from "@beep/repo-cli/test/RepoRun";
import { expect, it } from "@effect/vitest";
import { assertInclude } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { NodeCommandTestLayer } from "./support/CommandTest.ts";

const GIT_ENV = { GIT_CONFIG_NOSYSTEM: "1", GIT_CONFIG_GLOBAL: "/dev/null" };
const GIT_IDENTITY = [
  "-c",
  "user.name=Route Fixture",
  "-c",
  "user.email=route@example.invalid",
  "-c",
  "commit.gpgsign=false",
];
const ABSENT = Str.repeat(40)("f");

// An origin whose main has c0 -> c1, plus a pull-request head p1 on c0 that only
// refs/pull/1/head names (its branch is gone), and a work clone that has fetched main only.
const fixture = Effect.fn("RouteGitTest.fixture")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "ci-route-git-" });
  const origin = path.join(root, "origin");
  const work = path.join(root, "work");
  yield* fs.makeDirectory(origin);
  yield* fs.makeDirectory(work);
  const git = Effect.fn("RouteGitTest.git")(function* (cwd: string, ...args: ReadonlyArray<string>) {
    const result = yield* runRepoCommandCapture("git", [...GIT_IDENTITY, ...args], cwd, GIT_ENV);
    expect(result.exitCode).toBe(0);
    return Str.trim(result.output);
  });
  const commit = Effect.fn("RouteGitTest.commit")(function* (file: string) {
    yield* fs.writeFileString(path.join(origin, file), `${file}\n`);
    yield* git(origin, "add", "--all");
    yield* git(origin, "commit", "--quiet", "--no-verify", "-m", file);
    return yield* git(origin, "rev-parse", "HEAD");
  });

  yield* git(origin, "init", "--quiet", "--template=", "--initial-branch=main", ".");
  const c0 = yield* commit("base.txt");
  yield* git(origin, "switch", "--quiet", "-c", "feature");
  const p1 = yield* commit("feature.txt");
  yield* git(origin, "update-ref", "refs/pull/1/head", p1);
  yield* git(origin, "switch", "--quiet", "main");
  yield* git(origin, "branch", "--quiet", "-D", "feature");
  const c1 = yield* commit("next.txt");

  yield* git(work, "init", "--quiet", "--template=", "--initial-branch=main", ".");
  yield* git(work, "remote", "add", "origin", origin);
  yield* git(work, "fetch", "--quiet", "origin");
  return { root, work, c0, c1, p1, git };
});

it.layer(NodeCommandTestLayer, { timeout: "60 seconds" })("route git over a real checkout", (it) => {
  it.effect("fetches a pull-request head, then answers merge bases and ancestry", () =>
    Effect.gen(function* () {
      const { work, c0, c1, p1 } = yield* fixture();
      const git = yield* makeRouteGit(work);

      expect(yield* git.repoRoot).toBe(work);
      // p1 is only reachable through refs/pull/1/head; c1 is already local.
      expect(yield* git.ensureHeads([p1, c1])).toEqual([]);
      expect(yield* git.mergeBase(p1)).toBe(c0);
      expect(yield* git.isAncestor(c0, c1)).toBe(true);
      expect(yield* git.isAncestor(c1, c0)).toBe(false);

      const unknownAncestor = yield* Effect.flip(git.isAncestor(ABSENT, c1));
      expect(unknownAncestor.reason).toBe("git");
      assertInclude(unknownAncestor.message, `git merge-base --is-ancestor ${ABSENT} ${c1} exited`);
      const unknownBase = yield* Effect.flip(git.mergeBase(ABSENT));
      assertInclude(unknownBase.message, `git merge-base origin/main ${ABSENT} exited`);
    })
  );

  it.effect("returns a head the remote cannot serve instead of failing", () =>
    Effect.gen(function* () {
      const { work } = yield* fixture();
      const git = yield* makeRouteGit(work);
      expect(yield* git.ensureHeads([ABSENT])).toEqual([ABSENT]);
    })
  );

  it.effect("fails when the pull-request refs cannot be fetched", () =>
    Effect.gen(function* () {
      const { root, work, git: run } = yield* fixture();
      yield* run(work, "remote", "set-url", "origin", `${root}/no-such-origin`);
      const git = yield* makeRouteGit(work);
      const error = yield* Effect.flip(git.ensureHeads([ABSENT]));
      expect(error.reason).toBe("git");
      assertInclude(error.message, "git fetch of pull-request heads exited");
    })
  );
});

// The kit's typed failures each render their own `exited …` wording in the route error (W0, SPEC D-07):
// git's exit code when it ran, the pre-spawn refusal otherwise, and the two typed repository answers.
const isAncestorFailure = (error: GitCommandError | NotARepositoryError | UnknownRefError) =>
  Effect.gen(function* () {
    const git = yield* makeRouteGit("/repo");
    return yield* Effect.flip(git.isAncestor("a1", "b2"));
  }).pipe(Effect.provideService(Git, Git.makeTest({ isAncestor: () => Effect.fail(error) })));

it.layer(NodeCommandTestLayer, { timeout: "30 seconds" })("route git over the kit's typed failures", (it) => {
  it.effect("names git's exit code when the probe ran and failed", () =>
    Effect.gen(function* () {
      const failure = yield* isAncestorFailure(
        GitCommandError.make({ kind: "failed", args: ["merge-base"], cwd: "/repo", exitCode: 1, stderr: "noisy" })
      );
      expect(failure.reason).toBe("git");
      assertInclude(failure.message, "git merge-base --is-ancestor a1 b2 exited 1.");
    })
  );

  it.effect("names a pre-spawn refusal, which has no exit code", () =>
    Effect.gen(function* () {
      const failure = yield* isAncestorFailure(
        GitCommandError.make({ kind: "refused", args: ["merge-base"], cwd: "/repo", stderr: "", detail: "option-like" })
      );
      assertInclude(failure.message, "exited before spawning (");
    })
  );

  it.effect("names a working directory outside a repository", () =>
    Effect.gen(function* () {
      const failure = yield* isAncestorFailure(NotARepositoryError.make({ cwd: "/repo" }));
      assertInclude(failure.message, "exited outside a repository.");
    })
  );

  it.effect("names the unknown object", () =>
    Effect.gen(function* () {
      const failure = yield* isAncestorFailure(UnknownRefError.make({ ref: "a1", cwd: "/repo" }));
      assertInclude(failure.message, "exited with an unknown object (a1).");
    })
  );
});

// `mergeBase` keeps the capture's two wordings over the kit (W7b, SPEC D-19): a spawn failure, or git's exit code.
const mergeBaseFailure = (error: GitCommandError | NotARepositoryError | UnknownRefError) =>
  Effect.gen(function* () {
    const git = yield* makeRouteGit("/repo");
    return yield* Effect.flip(git.mergeBase("b2"));
  }).pipe(Effect.provideService(Git, Git.makeTest({ mergeBase: () => Effect.fail(error) })));

it.layer(NodeCommandTestLayer, { timeout: "30 seconds" })("route merge base over the kit's typed failures", (it) => {
  it.effect("names a spawn failure with the kit's argv", () =>
    Effect.gen(function* () {
      const failure = yield* mergeBaseFailure(
        GitCommandError.make({ kind: "refused", args: ["merge-base"], cwd: "/repo", stderr: "", detail: "option-like" })
      );
      expect(failure.reason).toBe("git");
      assertInclude(failure.message, "Failed to spawn git merge-base origin/main b2.");
    })
  );

  it.effect("names git's exit code, 128 for an unknown object", () =>
    Effect.gen(function* () {
      const failed = yield* mergeBaseFailure(
        GitCommandError.make({ kind: "failed", args: ["merge-base"], cwd: "/repo", exitCode: 1, stderr: "" })
      );
      assertInclude(failed.message, "git merge-base origin/main b2 exited 1.");
      const unknown = yield* mergeBaseFailure(UnknownRefError.make({ ref: "b2", cwd: "/repo" }));
      assertInclude(unknown.message, "git merge-base origin/main b2 exited 128.");
    })
  );
});
