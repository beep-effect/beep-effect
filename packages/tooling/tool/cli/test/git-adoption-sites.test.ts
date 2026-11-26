import { isRegisteredWorktree, removeGitWorktree, runRepoCommandCapture } from "@beep/repo-cli/test/RepoRun";
import { readAtMergeBase } from "@beep/repo-cli/test/Skills";
import { detectCheckoutRepository, detectPrRepository, readProvenanceLabels } from "@beep/repo-cli/test/Yeet";
import { expect, it } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Str from "effect/String";
import { PlatformLayer } from "./yeet-pr-fixtures.ts";

// The R10 adoption sites (`@beep/git` behind `readAtMergeBase`, the worktree
// probes and the provenance origin read), each pinned against a real git.

const runGit = Effect.fn("GitAdoptionSitesTest.runGit")(function* (cwd: string, args: ReadonlyArray<string>) {
  const result = yield* runRepoCommandCapture("git", args, cwd);
  expect(result.exitCode, result.output).toBe(0);
  return result.output;
});

const commit = Effect.fn("GitAdoptionSitesTest.commit")(function* (
  repoRoot: string,
  file: string,
  text: string,
  message: string
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  yield* fs.writeFileString(path.join(repoRoot, file), text);
  yield* runGit(repoRoot, ["add", file]);
  yield* runGit(repoRoot, ["commit", "--quiet", "-m", message]);
});

// A scratch repository: `main` carries `OWNERS` at its first commit, and the
// checked-out `feature` branch rewrites it, so the merge-base still holds the
// original text.
const withRepository = <A, E, R>(use: (root: string, repoRoot: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      return yield* fs.makeTempDirectory({ prefix: "git-adoption-sites-" });
    }),
    Effect.fnUntraced(function* (root) {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const repoRoot = path.join(root, "repo");
      yield* fs.makeDirectory(repoRoot);
      yield* runGit(repoRoot, ["init", "--quiet", "-b", "main"]);
      yield* runGit(repoRoot, ["config", "user.email", "git-adoption@example.invalid"]);
      yield* runGit(repoRoot, ["config", "user.name", "Git Adoption Test"]);
      yield* runGit(repoRoot, ["config", "commit.gpgsign", "false"]);
      yield* commit(repoRoot, "OWNERS", "* @base\n", "base");
      yield* runGit(repoRoot, ["switch", "--quiet", "-c", "feature"]);
      yield* commit(repoRoot, "OWNERS", "* @self-approved\n", "feature");
      return yield* use(root, repoRoot);
    }),
    (root) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.remove(root, { force: true, recursive: true });
      })
  );

it.layer(PlatformLayer, { timeout: "30 seconds" })("git adoption sites", (it) => {
  it.effect("reads a file as the merge-base holds it, not as the branch rewrote it", () =>
    withRepository((_root, repoRoot) =>
      Effect.gen(function* () {
        const resultGit = yield* runGit(repoRoot, ["rev-parse", "main"]);
        const mainSha = Str.trim(resultGit);
        const read = yield* readAtMergeBase(repoRoot, "main", "OWNERS", "the test");
        expect(read.base).toBe(mainSha);
        assertSome(read.text, "* @base\n");
      })
    )
  );

  it.effect("answers None for a file the merge-base does not carry", () =>
    withRepository((_root, repoRoot) =>
      Effect.gen(function* () {
        const read = yield* readAtMergeBase(repoRoot, "main", "MISSING.md", "the test");
        assertNone(read.text);
      })
    )
  );

  it.effect("fails typed, naming the purpose, when the base ref does not resolve", () =>
    withRepository((_root, repoRoot) =>
      Effect.gen(function* () {
        const error = yield* readAtMergeBase(repoRoot, "origin/absent", "OWNERS", "patch ownership").pipe(Effect.flip);
        expect(error._tag).toBe("SkillsCommandError");
        assertTrue(Str.includes("for patch ownership")(error.message));
        expect(error.file).toBe(repoRoot);
      })
    )
  );

  it.effect("fails closed, not None, when the merge-base carries the file but git cannot read it", () =>
    withRepository((_root, repoRoot) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const path = yield* Path.Path;
        const resultGit1 = yield* runGit(repoRoot, ["rev-parse", "main:OWNERS"]);
        const blob = Str.trim(resultGit1);
        yield* fs.remove(path.join(repoRoot, ".git", "objects", Str.slice(0, 2)(blob), Str.slice(2)(blob)));
        const error = yield* readAtMergeBase(repoRoot, "main", "OWNERS", "the test").pipe(Effect.flip);
        expect(error._tag).toBe("SkillsCommandError");
        assertTrue(Str.includes("Cannot read OWNERS at the merge-base")(error.message));
      })
    )
  );

  it.effect("refuses an option-like base ref before spawning git", () =>
    withRepository((_root, repoRoot) =>
      Effect.gen(function* () {
        const error = yield* readAtMergeBase(repoRoot, "--all", "OWNERS", "the test").pipe(Effect.flip);
        expect(error._tag).toBe("SkillsCommandError");
      })
    )
  );

  it.effect("fails typed when HEAD and the base share no history", () =>
    withRepository((_root, repoRoot) =>
      Effect.gen(function* () {
        yield* runGit(repoRoot, ["switch", "--quiet", "--orphan", "island"]);
        yield* commit(repoRoot, "OWNERS", "* @island\n", "island");
        const error = yield* readAtMergeBase(repoRoot, "main", "OWNERS", "the test").pipe(Effect.flip);
        expect(error._tag).toBe("SkillsCommandError");
      })
    )
  );

  it.effect("keeps a directory whose path looks like an option instead of handing it to git", () =>
    withRepository((_root, repoRoot) =>
      Effect.gen(function* () {
        const removeGitWorktree2 = yield* removeGitWorktree(repoRoot, "--help");
        expect(removeGitWorktree2).toBe(false);
        const isRegisteredWorktree3 = yield* isRegisteredWorktree(repoRoot, repoRoot);
        assertSome(isRegisteredWorktree3, true);
      })
    )
  );

  it.effect("reads the configured origin URL, not an insteadOf rewrite of it", () =>
    withRepository((_root, repoRoot) =>
      Effect.gen(function* () {
        yield* runGit(repoRoot, ["remote", "add", "origin", "https://github.com/Owner/Repo.git"]);
        yield* runGit(repoRoot, ["config", "url.https://mirror.invalid/.insteadOf", "https://github.com/"]);
        const detected = yield* detectPrRepository(repoRoot);
        expect(detected.owner).toBe("owner");
        expect(detected.name).toBe("repo");
      })
    )
  );

  it.effect("fails typed when the checkout has no origin or a non-GitHub origin", () =>
    withRepository((_root, repoRoot) =>
      Effect.gen(function* () {
        const missing = yield* detectPrRepository(repoRoot).pipe(Effect.flip);
        expect(missing.message).toBe("Expected a github.com origin URL.");
        yield* runGit(repoRoot, ["remote", "add", "origin", "https://gitlab.invalid/owner/repo.git"]);
        const foreign = yield* detectPrRepository(repoRoot).pipe(Effect.flip);
        expect(foreign.message).toBe("Expected a github.com origin URL.");
      })
    )
  );

  it.effect("takes the GitHub repository a mirror origin pushes to", () =>
    withRepository((_root, repoRoot) =>
      Effect.gen(function* () {
        const mirror = "git@mirror.invalid:owner/repo.git";
        yield* runGit(repoRoot, ["remote", "add", "origin", mirror]);
        yield* runGit(repoRoot, ["remote", "set-url", "--push", "origin", mirror]);
        yield* runGit(repoRoot, ["remote", "set-url", "--add", "--push", "origin", "git@github.com:Owner/Repo.git"]);
        yield* runGit(repoRoot, ["remote", "set-url", "--add", "--push", "origin", "https://github.com/owner/repo"]);
        const detected = yield* detectPrRepository(repoRoot);
        expect([detected.owner, detected.name]).toEqual(["owner", "repo"]);
      })
    )
  );

  it.effect("prefers a GitHub fetch URL over GitHub push URLs", () =>
    withRepository((_root, repoRoot) =>
      Effect.gen(function* () {
        yield* runGit(repoRoot, ["remote", "add", "origin", "https://github.com/Owner/Repo.git"]);
        yield* runGit(repoRoot, ["remote", "set-url", "--push", "origin", "https://github.com/other/fork.git"]);
        const detected = yield* detectPrRepository(repoRoot);
        expect([detected.owner, detected.name]).toEqual(["owner", "repo"]);
      })
    )
  );

  it.effect("fails typed when a mirror origin pushes to two GitHub repositories", () =>
    withRepository((_root, repoRoot) =>
      Effect.gen(function* () {
        yield* runGit(repoRoot, ["remote", "add", "origin", "https://gitlab.invalid/owner/repo.git"]);
        yield* runGit(repoRoot, ["remote", "set-url", "--push", "origin", "https://github.com/owner/repo.git"]);
        yield* runGit(repoRoot, [
          "remote",
          "set-url",
          "--add",
          "--push",
          "origin",
          "https://github.com/other/fork.git",
        ]);
        const ambiguous = yield* detectPrRepository(repoRoot).pipe(Effect.flip);
        expect(ambiguous.message).toBe("Expected origin's push URLs to name one github.com repository.");
      })
    )
  );

  it.effect("reads the checkout repository from origin's fetch URL on any host", () =>
    withRepository((_root, repoRoot) =>
      Effect.gen(function* () {
        const detect = (url: string) =>
          runGit(repoRoot, ["remote", "set-url", "origin", url]).pipe(
            Effect.andThen(detectCheckoutRepository(repoRoot)),
            Effect.map((repository) => [repository.host, repository.owner, repository.name])
          );
        yield* runGit(repoRoot, ["remote", "add", "origin", "git@github.com:Owner/Repo.git"]);
        const githubSsh = yield* detect("git@github.com:Owner/Repo.git");
        expect(githubSsh).toEqual(["github.com", "owner", "repo"]);
        const githubHttps = yield* detect("https://github.com/Owner/Repo");
        expect(githubHttps).toEqual(["github.com", "owner", "repo"]);
        const gitlabScp = yield* detect("git@GitLab.Example.com:Team/App.git");
        expect(gitlabScp).toEqual(["gitlab.example.com", "team", "app"]);
        const sshPort = yield* detect("ssh://git@gitlab.example.com:2222/team/app.git");
        expect(sshPort).toEqual(["gitlab.example.com", "team", "app"]);
      })
    )
  );

  it.effect("keys the checkout by its fetch URL, not a GitHub push URL or an insteadOf rewrite", () =>
    withRepository((_root, repoRoot) =>
      Effect.gen(function* () {
        yield* runGit(repoRoot, ["remote", "add", "origin", "git@gitlab.example.com:team/app.git"]);
        yield* runGit(repoRoot, ["remote", "set-url", "--push", "origin", "git@github.com:owner/app.git"]);
        yield* runGit(repoRoot, ["config", "url.https://mirror.invalid/.insteadOf", "git@gitlab.example.com:"]);
        const checkout = yield* detectCheckoutRepository(repoRoot);
        expect([checkout.host, checkout.owner, checkout.name]).toEqual(["gitlab.example.com", "team", "app"]);
        const pullRequests = yield* detectPrRepository(repoRoot);
        expect([pullRequests.host, pullRequests.owner, pullRequests.name]).toEqual(["github.com", "owner", "app"]);
      })
    )
  );

  it.effect("fails typed when the checkout has no origin or an unparsable one", () =>
    withRepository((_root, repoRoot) =>
      Effect.gen(function* () {
        const missing = yield* detectCheckoutRepository(repoRoot).pipe(Effect.flip);
        expect(missing.message).toBe("Expected an origin remote URL.");
        yield* runGit(repoRoot, ["remote", "add", "origin", "/srv/git/app.git"]);
        const localPath = yield* detectCheckoutRepository(repoRoot).pipe(Effect.flip);
        expect(localPath.message).toBe("Expected the origin URL to name host/owner/name.");
        yield* runGit(repoRoot, ["remote", "set-url", "origin", "git@gitlab.example.com:group/subgroup/app.git"]);
        const nested = yield* detectCheckoutRepository(repoRoot).pipe(Effect.flip);
        expect(nested._tag).toBe("YeetCommandError");
      })
    )
  );

  it.effect("turns the provenance labels off only for an off value", () =>
    withRepository((root, repoRoot) =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const readProvenanceLabels4 = yield* readProvenanceLabels(repoRoot);
        assertTrue(readProvenanceLabels4);
        yield* runGit(repoRoot, ["config", "beep.provenance.labels", "off"]);
        const readProvenanceLabels5 = yield* readProvenanceLabels(repoRoot);
        assertFalse(readProvenanceLabels5);
        yield* runGit(repoRoot, ["config", "beep.provenance.labels", " off "]);
        const readProvenanceLabels6 = yield* readProvenanceLabels(repoRoot);
        assertFalse(readProvenanceLabels6);
        yield* runGit(repoRoot, ["config", "beep.provenance.labels", "OFF"]);
        const readProvenanceLabels7 = yield* readProvenanceLabels(repoRoot);
        assertTrue(readProvenanceLabels7);
        yield* runGit(repoRoot, ["config", "beep.provenance.labels", "on"]);
        const readProvenanceLabels8 = yield* readProvenanceLabels(repoRoot);
        assertTrue(readProvenanceLabels8);
        const readProvenanceLabels9 = yield* readProvenanceLabels(path.join(root, "vanished"));
        assertTrue(readProvenanceLabels9);
      })
    )
  );

  it.effect("wraps a git failure reading the origin URL as a typed Yeet error", () =>
    withRepository((root) =>
      Effect.gen(function* () {
        const path = yield* Path.Path;
        const error = yield* detectPrRepository(path.join(root, "vanished")).pipe(Effect.flip);
        expect(error.command).toBe("git config --get remote.origin.url");
      })
    )
  );
});
