import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { Repo, RepoRef } from "../../effected/github/Repo.ts";
import { assertSome } from "@effect/vitest/utils";
import { GitBranch } from "../../effected/github/GitBranch.ts";

describe("GitBranch test doubles", () => {
  it.layer(Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" })), { timeout: "30 seconds" })((it) => {
    it.effect("default methods identify the missing override", () =>
      Effect.gen(function* () {
        const service = GitBranch.makeTest();
        assert.throws(
          () => service.create("main", "sha"),
          /GitBranch\.makeTest: create\(\) was called but not stubbed/
        );
        assert.throws(
          () => service.upsert("main", "sha"),
          /GitBranch\.makeTest: upsert\(\) was called but not stubbed/
        );
        assert.throws(() => service.exists("main"), /GitBranch\.makeTest: exists\(\) was called but not stubbed/);
        assert.throws(() => service.sha("main"), /GitBranch\.makeTest: sha\(\) was called but not stubbed/);
        assert.throws(() => service.shaOption("main"), /GitBranch\.makeTest: shaOption\(\) was called but not stubbed/);
        assert.throws(() => service.reset("main", "sha"), /GitBranch\.makeTest: reset\(\) was called but not stubbed/);
        assert.throws(() => service.delete("main"), /GitBranch\.makeTest: delete\(\) was called but not stubbed/);
        assert.throws(
          () => service.createLinked({ issueNodeId: "issue", repositoryNodeId: "repo", name: "main", sha: "sha" }),
          /GitBranch\.makeTest: createLinked\(\) was called but not stubbed/
        );
      })
    );
    it.layer(GitBranch.layerTest(), { timeout: "30 seconds" })((it) => {
      it.effect("default layer exposes the same fail-loud double", () =>
        Effect.gen(function* () {
          const service = yield* GitBranch;
          assert.throws(() => service.sha("main"), /GitBranch\.makeTest: sha/);
        })
      );
    });
    it.layer(
      GitBranch.layerTest({
        create: () => Effect.void,
        upsert: () => Effect.succeed("created"),
        exists: () => Effect.succeed(true),
        sha: () => Effect.succeed("sha"),
        shaOption: () => Effect.succeedSome("sha"),
        reset: () => Effect.void,
        delete: () => Effect.void,
        createLinked: () => Effect.void,
      }),
      { timeout: "30 seconds" }
    )((it) => {
      it.effect("layer preserves all supplied overrides", () =>
        Effect.gen(function* () {
          const service = yield* GitBranch;
          assert.strictEqual(yield* service.create("main", "sha"), undefined);
          assert.strictEqual(yield* service.upsert("main", "sha"), "created");
          assert.strictEqual(yield* service.exists("main"), true);
          assert.strictEqual(yield* service.sha("main"), "sha");
          assertSome(yield* service.shaOption("main"), "sha");
          assert.strictEqual(yield* service.reset("main", "sha"), undefined);
          assert.strictEqual(yield* service.delete("main"), undefined);
          assert.strictEqual(
            yield* service.createLinked({ issueNodeId: "issue", repositoryNodeId: "repo", name: "main", sha: "sha" }),
            undefined
          );
        })
      );
    });
  });
});
