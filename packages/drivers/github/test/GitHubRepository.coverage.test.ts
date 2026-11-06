import { AppliedSettings, GitHubRepository } from "@beep/github/GitHubRepository";
import { Repo, RepoRef } from "@beep/github/Repo";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { repositoryFixture } from "./support/fixtures.ts";
import type { GitHubError } from "@beep/github/GitHubError";
import type { GitHubRepositoryShape } from "@beep/github/GitHubRepository";

const DefectMessage = S.Struct({ message: S.String });

it.layer(Layer.merge(GitHubRepository.layerTest(), Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" }))), {
  timeout: "30 seconds",
})((it) => {
  it.effect("unstubbed repository members identify the missing override", () =>
    Effect.gen(function* () {
      const repository = yield* GitHubRepository;
      const direct = GitHubRepository.makeTest();
      const reads: ReadonlyArray<readonly [string, Effect.Effect<unknown, GitHubError, Repo>]> = [
        ["settings", repository.settings],
        ["defaultBranch", direct.defaultBranch],
        ["nodeId", direct.nodeId],
        ["ownerType", direct.ownerType],
      ];
      for (const [member, effect] of reads) {
        const defect = yield* effect.pipe(Effect.catchDefect(Effect.succeed));
        const error = yield* S.decodeUnknownEffect(DefectMessage)(defect);
        assert.strictEqual(
          error.message,
          `GitHubRepository.makeTest: ${member} was read but not stubbed — pass an override.`
        );
      }
      assert.throws(() => direct.updateSettings({}), /updateSettings was read but not stubbed/);
      assert.throws(() => direct.applySettings({}), /applySettings was read but not stubbed/);
    })
  );
});

const payload = repositoryFixture({ default_branch: "next", node_id: "node" });
const overrides: GitHubRepositoryShape = {
  settings: Effect.succeed(payload),
  updateSettings: () => Effect.succeed(payload),
  defaultBranch: Effect.succeed("next"),
  nodeId: Effect.succeed("node"),
  ownerType: Effect.succeed("Organization"),
  applySettings: (settings) => Effect.succeed(AppliedSettings.make({ rest: R.keys(settings), graphql: [] })),
};
it.layer(
  Layer.merge(GitHubRepository.layerTest(overrides), Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" }))),
  { timeout: "30 seconds" }
)((it) => {
  it.effect("repository doubles preserve every explicit override", () =>
    Effect.gen(function* () {
      const direct = GitHubRepository.makeTest(overrides);
      const repository = yield* GitHubRepository;
      assert.strictEqual(repository.settings, overrides.settings);
      assert.strictEqual(direct.updateSettings, overrides.updateSettings);
      const settings1 = yield* repository.settings;
      assert.deepStrictEqual(settings1, payload);
      const updateSettings2 = yield* direct.updateSettings({ has_wiki: true });
      assert.deepStrictEqual(updateSettings2, payload);
      const defaultBranch3 = yield* repository.defaultBranch;
      assert.strictEqual(defaultBranch3, "next");
      const nodeId4 = yield* repository.nodeId;
      assert.strictEqual(nodeId4, "node");
      const ownerType5 = yield* repository.ownerType;
      assert.strictEqual(ownerType5, "Organization");
      const applySettings6 = yield* repository.applySettings({ has_wiki: false });
      assert.deepStrictEqual(applySettings6, AppliedSettings.make({ rest: ["has_wiki"], graphql: [] }));
    })
  );
});
