import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { GitHubError } from "../../effected/github/GitHubError.ts";
import { Repo, RepoRef } from "../../effected/github/Repo.ts";
import * as S from "effect/Schema";
import { GitHubRepository, type GitHubRepositoryShape } from "../../effected/github/GitHubRepository.ts";
import { repositoryFixture } from "./fixtures.ts";

const DefectMessage = S.Struct({ message: S.String });

it.layer(Layer.merge(GitHubRepository.layerTest(), Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" }))), { timeout: "30 seconds" })((it) => {
it.effect("unstubbed repository members identify the missing override", () => Effect.gen(function* () {
  const repository = yield* GitHubRepository;
  const direct = GitHubRepository.makeTest();
  const reads: ReadonlyArray<readonly [string, Effect.Effect<unknown, GitHubError, Repo>]> = [
    ["settings", repository.settings], ["defaultBranch", direct.defaultBranch],
    ["nodeId", direct.nodeId], ["ownerType", direct.ownerType],
  ];
  for (const [member, effect] of reads) {
    const defect = yield* effect.pipe(Effect.catchDefect(Effect.succeed));
    const error = yield* S.decodeUnknownEffect(DefectMessage)(defect);
    assert.strictEqual(error.message, `GitHubRepository.makeTest: ${member} was read but not stubbed — pass an override.`);
  }
  assert.throws(() => direct.updateSettings({}), /updateSettings was read but not stubbed/);
  assert.throws(() => direct.applySettings({}), /applySettings was read but not stubbed/);
}));
});

const payload = repositoryFixture({ default_branch: "next", node_id: "node" });
const overrides: GitHubRepositoryShape = {
    settings: Effect.succeed(payload), updateSettings: () => Effect.succeed(payload),
    defaultBranch: Effect.succeed("next"), nodeId: Effect.succeed("node"), ownerType: Effect.succeed("Organization"),
    applySettings: (settings) => Effect.succeed({ rest: Object.keys(settings), graphql: [] }),
};
it.layer(Layer.merge(GitHubRepository.layerTest(overrides), Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" }))), { timeout: "30 seconds" })((it) => {
it.effect("repository doubles preserve every explicit override", () => Effect.gen(function* () {
  const direct = GitHubRepository.makeTest(overrides);
  const repository = yield* GitHubRepository;
  assert.strictEqual(repository.settings, overrides.settings);
  assert.strictEqual(direct.updateSettings, overrides.updateSettings);
  assert.deepStrictEqual(yield* repository.settings, payload);
  assert.deepStrictEqual(yield* direct.updateSettings({ has_wiki: true }), payload);
  assert.strictEqual(yield* repository.defaultBranch, "next");
  assert.strictEqual(yield* repository.nodeId, "node");
  assert.strictEqual(yield* repository.ownerType, "Organization");
  assert.deepStrictEqual(yield* repository.applySettings({ has_wiki: false }), { rest: ["has_wiki"], graphql: [] });
}));

});
