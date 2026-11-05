import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { GitHubRelease, ReleaseAsset, ReleaseInfo } from "@beep/github/GitHubRelease";
import { Repo } from "@beep/github/Repo";
import { PageOptions } from "@beep/github/Rest";
import { assert, describe, it } from "@effect/vitest";
import { assertFailure, assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as P from "effect/Predicate";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { harness, REPO } from "./support/harness.ts";

const release = ReleaseInfo.make({
  id: 1,
  tag: "v1",
  name: "One",
  body: "Notes",
  draft: false,
  prerelease: true,
  url: "web",
  uploadUrl: "upload",
});
const asset = ReleaseAsset.make({ id: 2, name: "a.zip", url: "download", size: 3 });
const raw = {
  id: 1,
  tag_name: "v1",
  name: "One",
  body: "Notes",
  draft: false,
  prerelease: true,
  html_url: "web",
  upload_url: "upload",
};
const rawAsset = { id: 2, name: "a.zip", browser_download_url: "download", size: 3 };
const JsonObject = S.fromJsonString(S.Record(S.String, S.Unknown));

describe("GitHubRelease coverage", () => {
  it.layer(Layer.mergeAll(GitHubRelease.layerTest(), Repo.layer(REPO)), { timeout: "30 seconds" })((it) => {
    it.effect("every unstubbed member names itself; overrides and layer defaults are honored", () =>
      Effect.gen(function* () {
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
        for (const [name, call] of calls)
          assert.throws(call, `GitHubRelease.makeTest: ${name}() was called but not stubbed`);
        const stub = GitHubRelease.makeTest({
          create: () => Effect.succeed(release),
          getByTag: () => Effect.succeed(release),
          getByTagOption: () => Effect.succeedSome(release),
          list: () => Effect.succeed([release]),
          update: dual(2, (_id: number, _patch: object) => Effect.succeed(release)),
          uploadAsset: dual(2, (_release: ReleaseInfo, _asset: object) => Effect.succeed(asset)),
          listAssets: dual(
            (args) => P.isNumber(args[0]),
            (_id: number, _options?: object) => Effect.succeed([asset])
          ),
        });
        const created = yield* stub.create({ tag: "v1" });
        assert.deepStrictEqual(created, release);
        const gotByTag = yield* stub.getByTag("v1");
        assert.deepStrictEqual(gotByTag, release);
        const gotByTagOption = yield* stub.getByTagOption("v1");
        assertSome(gotByTagOption, release);
        const list1 = yield* stub.list();
        assert.deepStrictEqual(list1, [release]);
        const update2 = yield* stub.update(1, {});
        assert.deepStrictEqual(update2, release);
        const uploadAsset3 = yield* stub.uploadAsset(release, { name: "a", data: "x", contentType: "text/plain" });
        assert.deepStrictEqual(uploadAsset3, asset);
        const listAssets4 = yield* stub.listAssets(1);
        assert.deepStrictEqual(listAssets4, [asset]);
        const defaults = yield* GitHubRelease;
        assert.throws(() => defaults.list(), "GitHubRelease.makeTest: list()");
      })
    );
  });

  const { base, script } = harness([
    { status: 201, body: raw },
    { status: 201, body: { ...raw, name: null, body: null } },
    { status: 200, body: raw },
    { status: 404, body: { message: "Not Found" } },
    { status: 401, body: { message: "Bad credentials" } },
    { status: 200, body: [raw] },
    { status: 200, body: [raw] },
    { status: 200, body: raw },
    { status: 200, body: { ...raw, name: null, body: null } },
    { status: 201, body: rawAsset },
    { status: 201, body: rawAsset },
    { status: 200, body: [rawAsset] },
    { status: 200, body: [rawAsset] },
  ]);
  const bodyAt = (index: number) => S.decodeEffect(JsonObject)(script.calls[index]?.body || "{}");
  it.layer(GitHubRelease.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect("projects releases and assets, forwards optional fields and pagination, and only swallows absence", () =>
      Effect.gen(function* () {
        const service = yield* GitHubRelease;
        const created5 = yield* service.create({
          tag: "v1",
          name: "One",
          body: "Notes",
          draft: false,
          prerelease: true,
          generateReleaseNotes: false,
        });
        assert.deepStrictEqual(created5, release);
        const bodyAt6 = yield* bodyAt(0);
        assert.deepStrictEqual(bodyAt6, {
          tag_name: "v1",
          name: "One",
          body: "Notes",
          draft: false,
          prerelease: true,
          generate_release_notes: false,
        });
        const minimal = yield* service.create({ tag: "v1" });
        assert.strictEqual(minimal.name, "");
        assert.strictEqual(minimal.body, "");
        const bodyAt7 = yield* bodyAt(1);
        assert.deepStrictEqual(bodyAt7, { tag_name: "v1" });
        const gotByTagOption8 = yield* service.getByTagOption("v1");
        assertSome(gotByTagOption8, release);
        const gotByTagOption9 = yield* service.getByTagOption("absent");
        assertNone(gotByTagOption9);
        const result10 = yield* Effect.result(service.getByTagOption("private"));
        assertFailure(
          Result.mapError(result10, (error) => error.kind),
          "unauthorized"
        );
        const list11 = yield* service.list();
        assert.deepStrictEqual(list11, [release]);
        const list12 = yield* service.list({ page: PageOptions.make({ perPage: 7, maxPages: 1 }) });
        assert.deepStrictEqual(list12, [release]);
        assert.strictEqual(script.queryOf(6).get("per_page"), "7");
        const update13 = yield* service.update(1, { name: "One", body: "Notes", draft: false, prerelease: true });
        assert.deepStrictEqual(update13, release);
        const bodyAt14 = yield* bodyAt(7);
        assert.deepStrictEqual(bodyAt14, {
          name: "One",
          body: "Notes",
          draft: false,
          prerelease: true,
        });
        assert.strictEqual((yield* service.update(1, {})).body, "");
        const bodyAt15 = yield* bodyAt(8);
        assert.deepStrictEqual(bodyAt15, {});
        const uploadAsset16 = yield* service.uploadAsset(release, {
          name: "a.zip",
          data: "abc",
          contentType: "text/plain",
        });
        assert.deepStrictEqual(uploadAsset16, asset);
        const uploadAsset17 = yield* service.uploadAsset(release, {
          name: "a.zip",
          data: new Uint8Array([1, 2, 3]),
          contentType: "application/zip",
          label: "Archive",
        });
        assert.deepStrictEqual(uploadAsset17, asset);
        assert.strictEqual(script.queryOf(9).get("name"), "a.zip");
        assert.strictEqual(script.queryOf(9).has("label"), false);
        assert.strictEqual(script.queryOf(10).get("label"), "Archive");
        assert.strictEqual(new URL(script.calls[9]?.url ?? "https://invalid").host, "uploads.github.com");
        const listAssets18 = yield* service.listAssets(1);
        assert.deepStrictEqual(listAssets18, [asset]);
        const listAssets19 = yield* service.listAssets(1, { page: PageOptions.make({ perPage: 9, maxPages: 1 }) });
        assert.deepStrictEqual(listAssets19, [asset]);
        assert.strictEqual(script.queryOf(12).get("per_page"), "9");
      })
    );
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
    it.effect(`returns operation-specific release decode failures for invalid ${field}=${value}`, () =>
      Effect.gen(function* () {
        const service = yield* GitHubRelease;
        const result20 = yield* Effect.result(service.getByTag("v1"));
        assertFailure(
          Result.mapError(result20, (error) => ({
            tag: error._tag,
            kind: error.kind,
            operation: error.operation,
          })),
          { tag: "GitHubError", kind: "decode", operation: "GitHubRelease.getByTag" }
        );
        const result21 = yield* Effect.result(service.create({ tag: "v1" }));
        assertFailure(
          Result.mapError(result21, (error) => ({
            tag: error._tag,
            kind: error.kind,
            operation: error.operation,
          })),
          { tag: "GitHubError", kind: "decode", operation: "GitHubRelease.create" }
        );
        const result22 = yield* Effect.result(service.list());
        assertFailure(
          Result.mapError(result22, (error) => ({
            tag: error._tag,
            kind: error.kind,
            operation: error.operation,
          })),
          { tag: "GitHubError", kind: "decode", operation: "GitHubRelease.list" }
        );
        const result23 = yield* Effect.result(service.update(1, {}));
        assertFailure(
          Result.mapError(result23, (error) => ({
            tag: error._tag,
            kind: error.kind,
            operation: error.operation,
          })),
          { tag: "GitHubError", kind: "decode", operation: "GitHubRelease.update" }
        );
        const result24 = yield* Effect.result(service.getByTagOption("v1"));
        assertFailure(
          Result.mapError(result24, (error) => ({
            tag: error._tag,
            kind: error.kind,
            operation: error.operation,
          })),
          { tag: "GitHubError", kind: "decode", operation: "GitHubRelease.getByTag" }
        );
      })
    );
  });
}

for (const size of [1.5, "3", null]) {
  const { base } = harness([{ status: 200, body: [rawAsset, { ...rawAsset, size }] }]);
  it.layer(GitHubRelease.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
    it.effect(`returns a typed asset decode failure for invalid size=${size}`, () =>
      Effect.gen(function* () {
        const service = yield* GitHubRelease;
        const result25 = yield* Effect.result(service.listAssets(1));
        assertFailure(
          Result.mapError(result25, (error) => ({
            tag: error._tag,
            kind: error.kind,
            operation: error.operation,
          })),
          { tag: "GitHubError", kind: "decode", operation: "GitHubRelease.listAssets" }
        );
      })
    );
  });
}

describe("ReleaseInfo schema-derived properties", () => {
  it.effect.prop(
    "ReleaseInfo round-trips through its codec",
    [Arbitrary.schema(ReleaseInfo)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(ReleaseInfo)(value);
        const decoded = yield* S.decodeEffect(ReleaseInfo)(encoded);
        assert.isTrue(S.toEquivalence(ReleaseInfo)(decoded, value));
      }),
    { arbitrary: fcRuns(50) }
  );
});
