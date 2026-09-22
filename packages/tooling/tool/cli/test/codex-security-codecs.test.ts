import { GitHubRepoSlugFromRemote, securityRepositoryFromRemote } from "@beep/repo-cli/test/Codex";
import { expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as S from "effect/Schema";

const encodeRemote = S.encodeEffect(GitHubRepoSlugFromRemote);

it.effect(
  "canonicalizes accepted GitHub transports through the public codec",
  Effect.fnUntraced(function* () {
    for (const remote of [
      "git@github.com:example/project.git",
      "ssh://git@github.com/example/project.git",
      "https://github.com/example/project/",
      "http://GitHub.com/example/project",
    ]) {
      const slug = yield* securityRepositoryFromRemote(remote);
      expect(slug).toBe("example/project");
      expect(yield* encodeRemote(slug)).toBe("https://github.com/example/project.git");
    }
  })
);

it.effect(
  "rejects non-GitHub and credential-bearing remotes with a fixed safe message",
  Effect.fnUntraced(function* () {
    for (const remote of ["https://example.com/owner/repo", "https://fixture:credential@github.com/owner/repo.git"]) {
      const error = yield* securityRepositoryFromRemote(remote).pipe(Effect.flip);
      expect(error.message).toBe("Repository remote is not a credential-free GitHub slug.");
      expect(error.message).not.toContain(remote);
    }
  })
);
