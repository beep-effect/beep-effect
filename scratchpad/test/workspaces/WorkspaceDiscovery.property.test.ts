import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
const JsonValue = S.fromJsonString(S.Unknown);

const runs = { arbitrary: fcRuns(100) };
const roundTrip = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: decoding encoded values succeeds and preserves the value`, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
import { WorkspaceDiscoveryError, WorkspacePatternError, PackageNotFoundError, WorkspaceInfo } from "../../effected/workspaces/WorkspaceDiscovery.ts";
describe("WorkspaceDiscovery property floor", () => {
  roundTrip("WorkspaceDiscoveryError", WorkspaceDiscoveryError);
  roundTrip("WorkspacePatternError", WorkspacePatternError);
  roundTrip("PackageNotFoundError", PackageNotFoundError);
  roundTrip("WorkspaceInfo", WorkspaceInfo);
});

import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { WorkspaceDiscovery } from "../../effected/workspaces/WorkspaceDiscovery.ts";
import { WorkspaceRoot } from "../../effected/workspaces/WorkspaceRoot.ts";

const discoveryFiles = MemoryFileSystem.layerWith({ "/repo/package.json": '{"name":"initial","workspaces":[]}' });
it.layer(WorkspaceDiscovery.layer({ cwd: "/repo" }).pipe(Layer.provide(Layer.mergeAll(WorkspaceRoot.layerTest("/repo"), Path.layer)), Layer.provideMerge(discoveryFiles)), { timeout: "10 seconds" })((it) => {
  it.effect.prop("manifest discovery preserves unknown fields through parse, stringify and reparse", [Arbitrary.schema(S.Struct({ name: S.String.check(S.isMinLength(1)), version: S.String.check(S.isMinLength(1)), custom: S.Json }))], ([manifest]) => Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const discovery = yield* WorkspaceDiscovery;
    const text = yield* S.encodeEffect(JsonValue)(manifest);
    yield* fs.writeFileString("/repo/package.json", text);
    yield* discovery.refresh;
    const first = yield* discovery.getPackage(manifest.name);
    assert.deepStrictEqual(first.manifestRecord, yield* S.decodeEffect(JsonValue)(text));
    assert.strictEqual(first.name, manifest.name);
    assert.strictEqual(first.version, manifest.version);
    yield* fs.writeFileString("/repo/package.json", yield* S.encodeEffect(JsonValue)(first.manifestRecord));
    yield* discovery.refresh;
    const second = yield* discovery.getPackage(manifest.name);
    assert.deepStrictEqual(second.manifestRecord, first.manifestRecord);
    assert.strictEqual(second.name, first.name);
    assert.strictEqual(second.version, first.version);
  }), runs);
});

it.effect.prop("discovery messages preserve the failing path and kind through codec normalization", [Arbitrary.schema(WorkspaceDiscoveryError)], ([error]) => Effect.gen(function* () {
  const decoded = yield* S.decodeEffect(WorkspaceDiscoveryError)(yield* S.encodeEffect(WorkspaceDiscoveryError)(error));
  assert.strictEqual(error.message, `Workspace discovery failed at ${error.path} (${error.kind})`);
  assert.strictEqual(decoded.message, error.message);
  const twice = yield* S.decodeEffect(WorkspaceDiscoveryError)(yield* S.encodeEffect(WorkspaceDiscoveryError)(decoded));
  assert.strictEqual(twice.message, decoded.message);
}), runs);

it.effect.prop("pattern messages preserve the pattern, failure kind and detail through normalization", [Arbitrary.schema(WorkspacePatternError)], ([error]) => Effect.gen(function* () {
  const decoded = yield* S.decodeEffect(WorkspacePatternError)(yield* S.encodeEffect(WorkspacePatternError)(error));
  assert.strictEqual(error.message, `Workspace pattern "${error.pattern}" could not be enumerated (${error.kind}: ${error.detail})`);
  assert.strictEqual(decoded.message, error.message);
  const twice = yield* S.decodeEffect(WorkspacePatternError)(yield* S.encodeEffect(WorkspacePatternError)(decoded));
  assert.strictEqual(twice.message, decoded.message);
}), runs);

it.effect.prop("missing package messages preserve the requested name through normalization", [Arbitrary.schema(PackageNotFoundError)], ([error]) => Effect.gen(function* () {
  const decoded = yield* S.decodeEffect(PackageNotFoundError)(yield* S.encodeEffect(PackageNotFoundError)(error));
  assert.strictEqual(error.message, `No workspace package named "${error.name}"`);
  assert.strictEqual(decoded.message, error.message);
  const twice = yield* S.decodeEffect(PackageNotFoundError)(yield* S.encodeEffect(PackageNotFoundError)(decoded));
  assert.strictEqual(twice.message, decoded.message);
}), runs);
