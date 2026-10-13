import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { GitBranch } from "../../effected/github/GitBranch.ts";
import { GitHubClient, type RecordedCall } from "../../effected/github/GitHubClient.ts";
import { Repo, RepoRef } from "../../effected/github/Repo.ts";

const runs = { arbitrary: fcRuns(100) };
const Name = S.String.check(S.isPattern(/^[a-z][a-z0-9]{0,20}$/));
const requested: RecordedCall[] = [];
const base = Layer.mergeAll(
  GitHubClient.layerFixture({
    request: {
      "POST /repos/{owner}/{repo}/git/refs": Result.succeed({
        ref: "refs/heads/fixture",
        node_id: "ref-id",
        url: "https://api.github.test/ref",
        object: { type: "commit", sha: "sha", url: "https://api.github.test/commit" },
      }),
      "DELETE /repos/{owner}/{repo}/git/refs/{ref}": Result.succeed(""),
    },
    requested,
  }),
  Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" }))
);
it.layer(GitBranch.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
  it.effect.prop(
    "branch ref formatting is idempotent for all accepted qualifications",
    [Arbitrary.schema(Name)],
    ([name]) =>
      Effect.gen(function* () {
        requested.length = 0;
        const branch = yield* GitBranch;
        yield* branch.create(name, "sha");
        yield* branch.create(`heads/${name}`, "sha");
        yield* branch.create(`refs/heads/${name}`, "sha");
        assert.deepStrictEqual(
          requested.map((call) => call.params),
          [
            { owner: "acme", repo: "widget", ref: `refs/heads/${name}`, sha: "sha" },
            { owner: "acme", repo: "widget", ref: `refs/heads/${name}`, sha: "sha" },
            { owner: "acme", repo: "widget", ref: `refs/heads/${name}`, sha: "sha" },
          ]
        );
      }),
    runs
  );

  it.effect.prop(
    "parsing a formatted branch ref preserves the branch for deletion and reformatting",
    [Arbitrary.schema(Name)],
    ([name]) =>
      Effect.gen(function* () {
        requested.length = 0;
        const branch = yield* GitBranch;
        yield* branch.create(name, "sha");
        const fullRef = yield* S.decodeUnknownEffect(S.String)(requested[0]?.params.ref);
        yield* branch.delete(fullRef);
        const shortRef = yield* S.decodeUnknownEffect(S.String)(requested[1]?.params.ref);
        assert.strictEqual(shortRef, `heads/${name}`);
        yield* branch.create(shortRef, "sha");
        assert.deepStrictEqual(requested[2]?.params, requested[0]?.params);
      }),
    runs
  );
});
