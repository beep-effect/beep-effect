import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertFalse, assertSuccess, assertTrue } from "@effect/vitest/utils";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { InvalidRepoRefError, Repo, RepoRef } from "../../effected/github/Repo.ts";

const JsonString = S.fromJsonString(S.String);

const ref = RepoRef.make({ owner: "acme", repo: "widget" });

describe("Repo parsing and provisioning", () => {
  it.effect("rejects slashes in either coordinate segment through construction and decoding", () => Effect.gen(function* () {
    for (const segment of ["/", "/extra", "extra/", "acme/extra", "extra/\n"]) {
      for (const fields of [{ owner: segment, repo: "widget" }, { owner: "acme", repo: segment }]) {
        assertFalse(S.is(RepoRef)(fields));
        assert.throws(() => RepoRef.make(fields));
        assertTrue(yield* S.decodeEffect(RepoRef)(fields).pipe(Effect.result, Effect.map(Result.isFailure)));
      }
    }
  }));
  it.effect("retains whitespace, punctuation, Unicode and control characters other than slash", () => Effect.gen(function* () {
    const fields = { owner: " .@\\é💫\n\u0000 ", repo: "\t?:#\\仓库\r\n " };
    const decoded = yield* S.decodeEffect(RepoRef)(fields);
    assert.deepStrictEqual(yield* S.encodeEffect(RepoRef)(decoded), fields);
    assert.deepStrictEqual(yield* RepoRef.parse(decoded.slug), decoded);
    assert.deepStrictEqual(RepoRef.make(fields), decoded);
  }));
  it.effect("parses exactly two nonempty segments and preserves invalid input in its error", () => Effect.gen(function* () {
    assertSuccess(RepoRef.parseResult("acme/widget"), ref);
    assert.deepStrictEqual(yield* RepoRef.parse("acme/widget"), ref);
    assert.strictEqual(ref.slug, "acme/widget");
    for (const slug of ["", "widget", "/widget", "acme/", "acme/widget/extra"]) {
      const error = InvalidRepoRefError.make({ input: slug });
      assertFailure(RepoRef.parseResult(slug), error);
      assertFailure(yield* Effect.result(RepoRef.parse(slug)), error);
      assert.strictEqual(error.message, `not an owner/repo slug: ${(yield* S.encodeEffect(JsonString)(slug))}`);
    }
  }));
  it.layer(Repo.layerFromSlug("acme/widget"), { timeout: "30 seconds" })((it) => {
    it.effect("layerFromSlug supplies the parsed value and provide redirects an operation", () => Effect.gen(function* () {
      assert.deepStrictEqual(yield* Repo, ref);
      const other = RepoRef.make({ owner: "other", repo: "docs" });
      assert.strictEqual(yield* Effect.map(Repo, (value) => value.slug).pipe(Repo.provide(other)), "other/docs");
      assert.deepStrictEqual(yield* Repo, ref);
    }));
  });
  const provider = ConfigProvider.layer(ConfigProvider.fromUnknown({ GITHUB_REPOSITORY: "acme/widget", TARGET: "other/docs" }));
  it.layer(Repo.layerFromConfig().pipe(Layer.provide(provider)), { timeout: "30 seconds" })((it) => {
    it.effect("configuration defaults to GITHUB_REPOSITORY", () => Effect.gen(function* () {
      assert.deepStrictEqual(yield* Repo, ref);
    }));
  });
  it.layer(Repo.layerFromConfig({ name: "TARGET" }).pipe(Layer.provide(provider)), { timeout: "30 seconds" })((it) => {
    it.effect("configuration honors a caller-supplied key", () => Effect.gen(function* () {
      assert.strictEqual((yield* Repo).slug, "other/docs");
    }));
  });
});
