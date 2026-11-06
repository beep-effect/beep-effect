import { ArtifactMetadata, StorageRecordInput } from "@beep/github/ArtifactMetadata";
import { Repo, RepoRef } from "@beep/github/Repo";
import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import { harness } from "./support/harness.ts";

const JsonBody = S.fromJsonString(S.Unknown);

const input = StorageRecordInput.make({
  name: "pkg:npm/widget",
  digest: "sha256:abc",
  registryUrl: "https://registry.example",
  repository: "widget",
});
it.layer(Repo.layer(RepoRef.make({ owner: "acme", repo: "widget" })), { timeout: "30 seconds" })((it) => {
  it.effect("unstubbed storage calls identify their member", () =>
    Effect.sync(() => {
      assert.throws(
        () => ArtifactMetadata.makeTest().createStorageRecord(input),
        /ArtifactMetadata.makeTest: createStorageRecord/
      );
    })
  );
  it.layer(ArtifactMetadata.layerTest(), { timeout: "30 seconds" })((it) => {
    it.effect("default layer retains fail-loud behavior", () =>
      Effect.gen(function* () {
        const service = yield* ArtifactMetadata;
        assert.throws(() => service.createStorageRecord(input), /createStorageRecord/);
      })
    );
  });
  it.layer(ArtifactMetadata.layerTest({ createStorageRecord: () => Effect.succeed([17]) }), { timeout: "30 seconds" })(
    (it) => {
      it.effect("layer uses its supplied override", () =>
        Effect.gen(function* () {
          const createdStorageRecord = yield* (yield* ArtifactMetadata).createStorageRecord(input);
          assert.deepStrictEqual(createdStorageRecord, [17]);
        })
      );
    }
  );
});
const { base, script } = harness([
  { status: 201, body: {} },
  { status: 201, body: { storage_records: [{ id: 17 }, {}, { id: "invalid" }, { id: 0 }] } },
]);
it.layer(ArtifactMetadata.layer.pipe(Layer.provideMerge(base)), { timeout: "30 seconds" })((it) => {
  it.effect("missing records produce an empty list; only numeric IDs survive", () =>
    Effect.gen(function* () {
      const service = yield* ArtifactMetadata;
      const createdStorageRecord1 = yield* service.createStorageRecord(input);
      assert.deepStrictEqual(createdStorageRecord1, []);
      const createdStorageRecord2 = yield* service.createStorageRecord(
        StorageRecordInput.make({ ...input, artifactUrl: "https://artifact.example", path: "dist/file" })
      );
      assert.deepStrictEqual(createdStorageRecord2, [17, 0]);
      assert.strictEqual(script.calls[0]?.path, "/orgs/acme/artifacts/metadata/storage-record");
      const value = yield* S.decodeEffect(JsonBody)(script.calls[1]?.body ?? "{}");
      assert.deepStrictEqual(value, {
        name: input.name,
        digest: input.digest,
        registry_url: input.registryUrl,
        repository: input.repository,
        artifact_url: "https://artifact.example",
        path: "dist/file",
      });
    })
  );
});
