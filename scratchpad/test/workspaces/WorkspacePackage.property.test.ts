import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { Package } from "../../effected/package-json/Package.ts";
import * as S from "effect/Schema";
import { PublishConfig, WorkspaceManifestError, WorkspacePackage } from "../../effected/workspaces/WorkspacePackage.ts";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(
    name,
    [Arbitrary.schema(schema)],
    ([value]) =>
      Effect.gen(function* () {
        const encoded = yield* S.encodeEffect(schema)(value);
        const decoded = yield* S.decodeEffect(schema)(encoded);
        assert.isTrue(S.toEquivalence(schema)(decoded, value));
        assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
      }),
    runs,
  );
};

describe("WorkspacePackage schema fidelity", () => {
  roundTrips("PublishConfig: decode(encode(x)) equals x and never fails", PublishConfig);
  roundTrips("WorkspaceManifestError: decode(encode(x)) equals x and never fails", WorkspaceManifestError);
  roundTrips("WorkspacePackage: decode(encode(x)) equals x and never fails", WorkspacePackage);
});

// The manifest reader's parse/stringify/parse law also preserves fields outside
// discovery's tolerant projection, through the strict Package wire codec.
const ManifestDocument = S.Struct({
  name: S.Literals(["@scope/member", "member"]),
  version: S.Literals(["1.2.3", "2.0.0-beta.1"]),
  dependencies: S.Record(S.String, S.Literals(["^1.2.3", "workspace:*", "catalog:"])),
  scripts: S.Record(S.String, S.String),
  custom: S.Json,
});
const located = WorkspacePackage.make({
  name: "member",
  path: "/repo",
  packageJsonPath: "/repo/package.json",
  relativePath: ".",
  workspaceRoot: "/repo",
});
const ManifestText = S.fromJsonString(ManifestDocument);

it.layer(MemoryFileSystem.layerWith({}), { timeout: "30 seconds" })((it) => {
  it.effect.prop(
    "manifest parse/stringify fidelity and serialization idempotence",
    [Arbitrary.schema(ManifestDocument)],
    ([document]) =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory("/repo", { recursive: true });
        yield* fs.writeFileString(located.packageJsonPath, yield* S.encodeEffect(ManifestText)(document));
        const first = yield* located.manifest();
        const original = yield* S.encodeEffect(Package.schema)(first);
        const text = first.toJsonString();
        yield* fs.writeFileString(located.packageJsonPath, text);
        const second = yield* located.manifest();
        assert.isTrue(S.toEquivalence(Package.schema)(first, second));
        assert.strictEqual(second.toJsonString(), text);
        const encoded = yield* S.encodeEffect(Package.schema)(second);
        assert.deepStrictEqual(encoded.custom, original.custom);
        assert.deepStrictEqual(encoded.scripts ?? {}, document.scripts);
      }),
    runs,
  );
});
