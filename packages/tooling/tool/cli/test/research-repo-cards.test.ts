import { ScriptedSpawner } from "@beep/commands/ScriptedSpawner";
import { inspectClone, listStarredRepos } from "@beep/repo-cli/test/Research";
import { GithubTransportFetch } from "@beep/repo-cli/test/SharedInternals";
import { expect, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import { NodeTestLayer } from "./support/CommandTest.ts";
import { completionFetch } from "./support/CompletionFetch.ts";
import { provideSpawner } from "./support/ScriptedProcess.ts";

it.layer(NodeTestLayer, { timeout: "30 seconds" })("repo card kit observations", (it) => {
  it.effect("reads clone origin and the latest commit, formatting its offset as UTC", () =>
    Effect.gen(function* () {
      const root = yield* FileSystem.FileSystem.use((fs) => fs.makeTempDirectoryScoped({ prefix: "repo-card-kit-" }));
      const at = "2026-11-03T03:00:00+03:00";
      const git = ScriptedSpawner.make((_command, args) => ({
        stdout:
          args[0] === "remote"
            ? "git@github.com:example/repo.git\n"
            : `\0abc\0${at}\0${at}\0Ada\0ada@example.com\0subject\0`,
      }));
      const info = yield* inspectClone(root).pipe(provideSpawner(git));
      expect(O.getOrThrow(info.remoteUrl)).toBe("https://github.com/example/repo");
      expect(O.getOrThrow(info.lastCommitIso)).toBe("2026-11-03T00:00:00.000Z");
    })
  );
  it.effect("failed git observations retain absent clone facts", () =>
    Effect.gen(function* () {
      const root = yield* FileSystem.FileSystem.use((fs) => fs.makeTempDirectoryScoped({ prefix: "repo-card-kit-" }));
      const info = yield* inspectClone(root).pipe(
        provideSpawner(ScriptedSpawner.make(() => ({ exit: 1, stderr: "refused" })))
      );
      assertNone(info.remoteUrl);
      assertNone(info.lastCommitIso);
    })
  );
  it.effect("stars follows page two with the gh login, and refuses HTTP or schema failures", () =>
    Effect.gen(function* () {
      const transport = completionFetch((url) => ({
        body: [
          { full_name: url.searchParams.get("page") === "2" ? "b/two" : "a/one", html_url: "https://github.com/a/one" },
        ],
        next: !url.searchParams.has("page"),
      }));
      const auth = ScriptedSpawner.make(() => ({ stdout: "fixture-token" }));
      const stars = yield* listStarredRepos(".").pipe(
        Effect.provideService(GithubTransportFetch, O.some(transport.fetch)),
        provideSpawner(auth)
      );
      expect(A.map(stars, (star) => star.full_name)).toEqual(["a/one", "b/two"]);
      expect(A.map(auth.spawns, (spawn) => spawn.args)).toEqual([["auth", "token"]]);
      for (const reply of [{ status: 403, body: { message: "Forbidden" } }, { body: [{ malformed: true }] }]) {
        const failed = completionFetch(() => reply);
        const error = yield* listStarredRepos(".").pipe(
          Effect.provideService(GithubTransportFetch, O.some(failed.fetch)),
          provideSpawner(auth),
          Effect.flip
        );
        expect(error._tag).toBe("ResearchCommandError");
      }
    })
  );
});
