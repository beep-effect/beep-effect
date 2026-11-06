import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const JsonValue = S.fromJsonString(S.Unknown);

const runs = { arbitrary: fcRuns(100) };
const roundTrip = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    `${name}: decoding encoded values succeeds and preserves the value`,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assert.isTrue(S.toEquivalence(schema)(decoded, value));
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

import {
  PackageNotFoundError,
  WorkspaceDiscoveryError,
  WorkspaceInfo,
  WorkspacePatternError,
} from "@beep/repo-workspaces/WorkspaceDiscovery";

describe("WorkspaceDiscovery property floor", () => {
  roundTrip("WorkspaceDiscoveryError", WorkspaceDiscoveryError);
  roundTrip("WorkspacePatternError", WorkspacePatternError);
  roundTrip("PackageNotFoundError", PackageNotFoundError);
  roundTrip("WorkspaceInfo", WorkspaceInfo);
});

import { MemoryFileSystem } from "@beep/memfs";
import { WorkspaceDiscovery } from "@beep/repo-workspaces/WorkspaceDiscovery";
import { WorkspaceRoot } from "@beep/repo-workspaces/WorkspaceRoot";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

const discoveryFiles = MemoryFileSystem.layerWith({ "/repo/package.json": '{"name":"initial","workspaces":[]}' });
it.layer(
  WorkspaceDiscovery.layer({ cwd: "/repo" }).pipe(
    Layer.provide(Layer.mergeAll(WorkspaceRoot.layerTest("/repo"), Path.layer)),
    Layer.provideMerge(discoveryFiles)
  ),
  { timeout: "10 seconds" }
)((it) => {
  it.effect.prop(
    "manifest discovery preserves unknown fields through parse, stringify and reparse",
    [
      Arbitrary.schema(
        S.Struct({ name: S.String.check(S.isMinLength(1)), version: S.String.check(S.isMinLength(1)), custom: S.Json })
      ),
    ],
    ([manifest]) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const discovery = yield* WorkspaceDiscovery;
        const text = yield* S.encodeEffect(JsonValue)(manifest);
        yield* fs.writeFileString("/repo/package.json", text);
        yield* discovery.refresh;
        const first = yield* discovery.getPackage(manifest.name);
        const value2 = yield* S.decodeEffect(JsonValue)(text);
        assert.deepStrictEqual(first.manifestRecord, value2);
        assert.strictEqual(first.name, manifest.name);
        assert.strictEqual(first.version, manifest.version);
        const value3 = yield* S.encodeEffect(JsonValue)(first.manifestRecord);
        yield* fs.writeFileString("/repo/package.json", value3);
        yield* discovery.refresh;
        const second = yield* discovery.getPackage(manifest.name);
        assert.deepStrictEqual(second.manifestRecord, first.manifestRecord);
        assert.strictEqual(second.name, first.name);
        assert.strictEqual(second.version, first.version);
      }),
    runs
  );
});

it.effect.prop(
  "discovery messages preserve the failing path and kind through codec normalization",
  [Arbitrary.schema(WorkspaceDiscoveryError)],
  ([error]) =>
    Effect.gen(function* () {
      const argument = S.decodeEffect(WorkspaceDiscoveryError);
      const value4 = yield* S.encodeEffect(WorkspaceDiscoveryError)(error);
      const decoded = yield* argument(value4);
      assert.strictEqual(error.message, `Workspace discovery failed at ${error.path} (${error.kind})`);
      assert.strictEqual(decoded.message, error.message);
      const argument1 = S.decodeEffect(WorkspaceDiscoveryError);
      const value5 = yield* S.encodeEffect(WorkspaceDiscoveryError)(decoded);
      const twice = yield* argument1(value5);
      assert.strictEqual(twice.message, decoded.message);
    }),
  runs
);

it.effect.prop(
  "pattern messages preserve the pattern, failure kind and detail through normalization",
  [Arbitrary.schema(WorkspacePatternError)],
  ([error]) =>
    Effect.gen(function* () {
      const argument2 = S.decodeEffect(WorkspacePatternError);
      const value6 = yield* S.encodeEffect(WorkspacePatternError)(error);
      const decoded = yield* argument2(value6);
      assert.strictEqual(
        error.message,
        `Workspace pattern "${error.pattern}" could not be enumerated (${error.kind}: ${error.detail})`
      );
      assert.strictEqual(decoded.message, error.message);
      const argument3 = S.decodeEffect(WorkspacePatternError);
      const value7 = yield* S.encodeEffect(WorkspacePatternError)(decoded);
      const twice = yield* argument3(value7);
      assert.strictEqual(twice.message, decoded.message);
    }),
  runs
);

it.effect.prop(
  "missing package messages preserve the requested name through normalization",
  [Arbitrary.schema(PackageNotFoundError)],
  ([error]) =>
    Effect.gen(function* () {
      const argument4 = S.decodeEffect(PackageNotFoundError);
      const value8 = yield* S.encodeEffect(PackageNotFoundError)(error);
      const decoded = yield* argument4(value8);
      assert.strictEqual(error.message, `No workspace package named "${error.packageName}"`);
      // D-24: the requested name no longer shadows the error's own `name`.
      assert.strictEqual(error.name, "@beep/repo-workspaces/WorkspaceDiscovery/PackageNotFoundError");
      assert.strictEqual(decoded.message, error.message);
      const argument5 = S.decodeEffect(PackageNotFoundError);
      const value9 = yield* S.encodeEffect(PackageNotFoundError)(decoded);
      const twice = yield* argument5(value9);
      assert.strictEqual(twice.message, decoded.message);
    }),
  runs
);
