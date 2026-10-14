import { assert, describe, it } from "@effect/vitest";
import { assertNone, assertSome, assertFailure } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Result from "effect/Result";
import { GitHubRelease, ReleaseInfo, ReleaseAsset } from "../../effected/github/GitHubRelease.ts";
import { PageOptions } from "../../effected/github/Rest.ts";
import { Repo } from "../../effected/github/Repo.ts";
import { REPO, harness } from "./harness.ts";

const release = ReleaseInfo.make({ id: 1, tag: "v1", name: "One", body: "Notes", draft: false, prerelease: true, url: "web", uploadUrl: "upload" });
const asset = ReleaseAsset.make({ id: 2, name: "a.zip", url: "download", size: 3 });
const raw = { id: 1, tag_name: "v1", name: "One", body: "Notes", draft: false, prerelease: true, html_url: "web", upload_url: "upload" };
const rawAsset = { id: 2, name: "a.zip", browser_download_url: "download", size: 3 };
const JsonObject = S.fromJsonString(S.Record(S.String, S.Unknown));

describe("GitHubRelease coverage", () => {
  it.layer(Layer.mergeAll(GitHubRelease.layerTest(), Repo.layer(REPO)), { timeout: "30 seconds" })((it) => {
  it.effect("every unstubbed member names itself; overrides and layer defaults are honored", () => Effect.gen(function* () {
    const service = GitHubRelease.makeTest();
    const calls = [
      ["create", () => service.create({ tag: "v1" })],
      ["getByTag", () => service.getByTag("v1")],
      ["getByTagOption", () => service.getByTagOption("v1")],
      ["list", () => service.list()],
      ["update", () => service.update(1, {})],
      ["uploadAsset", () => service.uploadAsset(release, { name: "a", data: "x", contentType: "text/plain" })],
      ["listAssets", () => service.listAssets(1)],
    ] as const;
    for (const [name, call] of calls) assert.throws(call, `GitHubRelease.makeTest: ${name}() was called but not stubbed`);
    const stub = GitHubRelease.makeTest({ create: () => Effect.succeed(release), getByTag: () => Effect.succeed(release), getByTagOption: () => Effect.succeedSome(release), list: () => Effect.succeed([release]), update: () => Effect.succeed(release), uploadAsset: () => Effect.succeed(asset), listAssets: () => Effect.succeed([asset]) });
    assert.deepStrictEqual(yield* stub.create({ tag: "v1" }), release);
    assert.deepStrictEqual(yield* stub.getByTag("v1"), release);
    assertSome(yield* stub.getByTagOption("v1"), release);
    assert.deepStrictEqual(yield* stub.list(), [release]);
    assert.deepStrictEqual(yield* stub.update(1, {}), release);
    assert.deepStrictEqual(yield* stub.uploadAsset(release, { name: "a", data: "x", contentType: "text/plain" }), asset);
    assert.deepStrictEqual(yield* stub.listAssets(1), [asset]);
    const defaults = yield* GitHubRelease;
    assert.throws(() => defaults.list(), "GitHubRelease.makeTest: list()");
  }));
  });

  const { base, script } = harness([
    { status: 201, body: raw }, { status: 201, body: { ...raw, name: null, body: null } },
    { status: 200, body: raw }, { status: 404, body: { message: "Not Found" } }, { status: 401, body: { message: "Bad credentials" } },
    { status: 200, body: [raw] }, { status: 200, body: [raw] },
    { status: 200, body: raw }, { status: 200, body: { ...raw, name: null, body: null } },
    { status: 201, body: rawAsset }, { status: 201, body: rawAsset },
    { status: 200, body: [rawAsset] }, { status: 200, body: [rawAsset] },
  ]);
  it.layer(GitHubRelease.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect("projects releases and assets, forwards optional fields and pagination, and only swallows absence", () => Effect.gen(function* () {
      const service = yield* GitHubRelease;
      assert.deepStrictEqual(yield* service.create({ tag: "v1", name: "One", body: "Notes", draft: false, prerelease: true, generateReleaseNotes: false }), release);
      assert.deepStrictEqual(yield* S.decodeEffect(JsonObject)(script.calls[0]?.body ?? "{}"), { tag_name: "v1", name: "One", body: "Notes", draft: false, prerelease: true, generate_release_notes: false });
      const minimal = yield* service.create({ tag: "v1" });
      assert.strictEqual(minimal.name, ""); assert.strictEqual(minimal.body, "");
      assert.deepStrictEqual(yield* S.decodeEffect(JsonObject)(script.calls[1]?.body ?? "{}"), { tag_name: "v1" });
      assertSome(yield* service.getByTagOption("v1"), release);
      assertNone(yield* service.getByTagOption("absent"));
      assertFailure(Result.mapError(yield* Effect.result(service.getByTagOption("private")), (error) => error.kind), "unauthorized");
      assert.deepStrictEqual(yield* service.list(), [release]);
      assert.deepStrictEqual(yield* service.list({ page: PageOptions.make({ perPage: 7, maxPages: 1 }) }), [release]);
      assert.strictEqual(script.queryOf(6).get("per_page"), "7");
      assert.deepStrictEqual(yield* service.update(1, { name: "One", body: "Notes", draft: false, prerelease: true }), release);
      assert.deepStrictEqual(yield* S.decodeEffect(JsonObject)(script.calls[7]?.body ?? "{}"), { name: "One", body: "Notes", draft: false, prerelease: true });
      assert.strictEqual((yield* service.update(1, {})).body, "");
      assert.deepStrictEqual(yield* S.decodeEffect(JsonObject)(script.calls[8]?.body || "{}"), {});
      assert.deepStrictEqual(yield* service.uploadAsset(release, { name: "a.zip", data: "abc", contentType: "text/plain" }), asset);
      assert.deepStrictEqual(yield* service.uploadAsset(release, { name: "a.zip", data: new Uint8Array([1, 2, 3]), contentType: "application/zip", label: "Archive" }), asset);
      assert.strictEqual(script.queryOf(9).get("name"), "a.zip");
      assert.strictEqual(script.queryOf(9).has("label"), false);
      assert.strictEqual(script.queryOf(10).get("label"), "Archive");
      assert.strictEqual(new URL(script.calls[9]?.url ?? "https://invalid").host, "uploads.github.com");
      assert.deepStrictEqual(yield* service.listAssets(1), [asset]);
      assert.deepStrictEqual(yield* service.listAssets(1, { page: PageOptions.make({ perPage: 9, maxPages: 1 }) }), [asset]);
      assert.strictEqual(script.queryOf(12).get("per_page"), "9");
    }));
  });
});

for (const [field, value] of [
  ["id", 1.5],
  ["draft", "false"],
  ["prerelease", 1],
  ["name", false],
  ["body", 42],
] as const) {
  const invalid = { ...raw, [field]: value };
  const { base } = harness([
    { status: 200, body: invalid },
    { status: 201, body: invalid },
    { status: 200, body: [raw, invalid] },
    { status: 200, body: invalid },
    { status: 200, body: invalid },
  ]);
  it.layer(GitHubRelease.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect(`returns operation-specific release decode failures for invalid ${field}=${value}`, () => Effect.gen(function* () {
      const service = yield* GitHubRelease;
      assertFailure(Result.mapError(yield* Effect.result(service.getByTag("v1")), (error) => ({
        tag: error._tag, kind: error.kind, operation: error.operation,
      })), { tag: "GitHubError", kind: "decode", operation: "GitHubRelease.getByTag" });
      assertFailure(Result.mapError(yield* Effect.result(service.create({ tag: "v1" })), (error) => ({
        tag: error._tag, kind: error.kind, operation: error.operation,
      })), { tag: "GitHubError", kind: "decode", operation: "GitHubRelease.create" });
      assertFailure(Result.mapError(yield* Effect.result(service.list()), (error) => ({
        tag: error._tag, kind: error.kind, operation: error.operation,
      })), { tag: "GitHubError", kind: "decode", operation: "GitHubRelease.list" });
      assertFailure(Result.mapError(yield* Effect.result(service.update(1, {})), (error) => ({
        tag: error._tag, kind: error.kind, operation: error.operation,
      })), { tag: "GitHubError", kind: "decode", operation: "GitHubRelease.update" });
      assertFailure(Result.mapError(yield* Effect.result(service.getByTagOption("v1")), (error) => ({
        tag: error._tag, kind: error.kind, operation: error.operation,
      })), { tag: "GitHubError", kind: "decode", operation: "GitHubRelease.getByTag" });
    }));
  });
}

for (const size of [1.5, "3", null]) {
  const { base } = harness([{ status: 200, body: [rawAsset, { ...rawAsset, size }] }]);
  it.layer(GitHubRelease.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect(`returns a typed asset decode failure for invalid size=${size}`, () => Effect.gen(function* () {
      const service = yield* GitHubRelease;
      assertFailure(Result.mapError(yield* Effect.result(service.listAssets(1)), (error) => ({
        tag: error._tag, kind: error.kind, operation: error.operation,
      })), { tag: "GitHubError", kind: "decode", operation: "GitHubRelease.listAssets" });
    }));
  });
}
