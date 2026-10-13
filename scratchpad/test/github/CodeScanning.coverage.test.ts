import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { GitHubClient, type RecordedCall } from "../../effected/github/GitHubClient.ts";
import { Repo, RepoRef } from "../../effected/github/Repo.ts";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { CodeScanning } from "../../effected/github/CodeScanning.ts";

const UnstubbedError = S.TaggedStruct("UnstubbedError", { message: S.String });

describe("CodeScanning test doubles", () => {
  it.layer(Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" })), { timeout: "30 seconds" })((it) => {
    it.effect("default methods identify the missing override", () =>
      Effect.gen(function* () {
        const service = CodeScanning.makeTest();
        assert.throws(() => service.configure({}), /CodeScanning\.makeTest: configure\(\) was called but not stubbed/);
        const defect = yield* service.languages.pipe(Effect.catchDefect(Effect.succeed));
        const error = yield* S.decodeUnknownEffect(UnstubbedError)(defect);
        assert.strictEqual(
          error.message,
          "CodeScanning.makeTest: languages() was called but not stubbed — pass an override."
        );
      })
    );
    it.layer(CodeScanning.layerTest(), { timeout: "30 seconds" })((it) => {
      it.effect("default layer exposes the same fail-loud double", () =>
        Effect.gen(function* () {
          const service = yield* CodeScanning;
          assert.throws(() => service.configure({}), /CodeScanning\.makeTest: configure/);
        })
      );
    });
    it.layer(CodeScanning.layerTest({ configure: () => Effect.void, languages: Effect.succeed(["Go"]) }), {
      timeout: "30 seconds",
    })((it) => {
      it.effect("layer preserves all supplied overrides", () =>
        Effect.gen(function* () {
          const service = yield* CodeScanning;
          assert.strictEqual(yield* service.configure({}), undefined);
          assert.deepStrictEqual(yield* service.languages, ["Go"]);
        })
      );
    });
  });
});

const requested: RecordedCall[] = [];
it.layer(
  CodeScanning.layer.pipe(
    Layer.provideMerge(
      Layer.mergeAll(
        GitHubClient.layerFixture({
          request: { "PATCH /repos/{owner}/{repo}/code-scanning/default-setup": Result.succeed({}) },
          requested,
        }),
        Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" }))
      )
    )
  ),
  { timeout: "30 seconds" }
)((it) => {
  it.effect("an empty setup leaves every setting alone", () =>
    Effect.gen(function* () {
      const service = yield* CodeScanning;
      yield* service.configure({});
      assert.deepStrictEqual(requested, [
        {
          kind: "request",
          route: "PATCH /repos/{owner}/{repo}/code-scanning/default-setup",
          params: { owner: "acme", repo: "widget" },
        },
      ]);
    })
  );
});
