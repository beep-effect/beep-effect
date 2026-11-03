import { CommitRef, GitCommit } from "@beep/github/GitCommit";
import { Repo, RepoRef } from "@beep/github/Repo";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import { harness } from "./support/harness.ts";

const repoLayer = Repo.layer(RepoRef.make({ owner: "o", repo: "r" }));

const ref = CommitRef.make({ sha: "commit", treeSha: "tree", parents: [] });
const overrides = {
  get: () => Effect.succeed(ref),
  createTree: () => Effect.succeed("tree"),
  createCommit: () => Effect.succeed("commit"),
  commitFiles: () => Effect.succeed("commit"),
};
describe("GitCommit test double contract", () => {
  it.effect("names every unstubbed operation", () =>
    Effect.sync(() => {
      const double = GitCommit.makeTest();
      assert.throws(() => double.get("sha"), /GitCommit.makeTest: get\(\)/);
      assert.throws(() => double.createTree({ changes: [] }), /GitCommit.makeTest: createTree\(\)/);
      assert.throws(
        () => double.createCommit({ message: "m", tree: "t", parents: [] }),
        /GitCommit.makeTest: createCommit\(\)/
      );
      assert.throws(
        () => double.commitFiles({ branch: "main", message: "m", changes: [] }),
        /GitCommit.makeTest: commitFiles\(\)/
      );
    })
  );
  it.layer(repoLayer, { timeout: "30 seconds" })("repository context", (it) => {
    it.effect("preserves all supplied operations", () =>
      Effect.gen(function* () {
        const double = GitCommit.makeTest(overrides);
        const got = yield* double.get("sha");
        assert.strictEqual(got, ref);
        const createdTree = yield* double.createTree({ changes: [] });
        assert.strictEqual(createdTree, "tree");
        const createdCommit = yield* double.createCommit({ message: "m", tree: "t", parents: [] });
        assert.strictEqual(createdCommit, "commit");
        const commitFiles1 = yield* double.commitFiles({ branch: "main", message: "m", changes: [] });
        assert.strictEqual(commitFiles1, "commit");
      })
    );
  });
  it.layer(GitCommit.layerTest(), { timeout: "30 seconds" })("default layer", (it) => {
    it.effect("provides the same unstubbed contract", () =>
      Effect.gen(function* () {
        const double = yield* GitCommit;
        assert.throws(() => double.get("sha"), /not stubbed/);
      })
    );
  });
  it.layer(Layer.merge(GitCommit.layerTest(overrides), repoLayer), { timeout: "30 seconds" })(
    "configured layer",
    (it) => {
      it.effect("provides the supplied operation", () =>
        Effect.gen(function* () {
          const double = yield* GitCommit;
          const got2 = yield* double.get("sha");
          assert.strictEqual(got2, ref);
        })
      );
    }
  );
});

for (const [name, invalid] of [
  ["parent sha", { sha: "commit", tree: { sha: "tree" }, parents: [{ sha: null }] }],
  ["null parent", { sha: "commit", tree: { sha: "tree" }, parents: [null] }],
  ["missing tree", { sha: "commit", parents: [] }],
  ["null tree", { sha: "commit", tree: null, parents: [] }],
  ["missing parents", { sha: "commit", tree: { sha: "tree" } }],
] as const) {
  const { base } = harness([{ status: 200, body: invalid }]);
  it.layer(GitCommit.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect(`returns a typed Git Database commit decode failure for invalid ${name}`, () =>
      Effect.gen(function* () {
        const service = yield* GitCommit;
        const result3 = yield* Effect.result(service.get("commit"));
        assertFailure(
          Result.mapError(result3, (error) => ({
            tag: error._tag,
            kind: error.kind,
            operation: error.operation,
          })),
          { tag: "GitHubError", kind: "decode", operation: "GitCommit.get" }
        );
      })
    );
  });
}
