import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(name, [Arbitrary.schema(schema)], ([value]) => Effect.gen(function* () {
    const encoded = yield* S.encodeEffect(schema)(value);
    const decoded = yield* S.decodeEffect(schema)(encoded);
    assert.isTrue(S.toEquivalence(schema)(decoded, value));
    assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
  }), runs);
};
import { PackageJsonReadError, PackageJsonNotFoundError, PackageJsonParseError, PackageJsonWriteError } from "../../effected/package-json/PackageJsonFile.ts";
describe("PackageJsonFile property floor", () => {
  roundTrips("PackageJsonReadError", PackageJsonReadError);
  roundTrips("PackageJsonNotFoundError", PackageJsonNotFoundError);
  roundTrips("PackageJsonParseError", PackageJsonParseError);
  roundTrips("PackageJsonWriteError", PackageJsonWriteError);
});
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as FileSystem from "effect/FileSystem";
import { MemoryFileSystem } from "../../effected/memfs/index.ts";
import { Package } from "../../effected/package-json/Package.ts";
import { PackageJsonFile } from "../../effected/package-json/PackageJsonFile.ts";
const FileSample = S.Struct({
  name: S.Literal("property-package"),
  version: S.Literals(["1.0.0", "2.0.0"]),
  description: S.String,
  keywords: S.Array(S.String),
  dependencies: S.Struct({lib: S.Literal("workspace:*")}),
  "x-data": S.Json,
});
const FileLayer = PackageJsonFile.layer.pipe(Layer.provideMerge(Layer.mergeAll(MemoryFileSystem.layerWith({}), Path.layer)));
it.layer(FileLayer, {timeout: "30 seconds"})((it) => {
  it.effect.prop("file read/write fidelity preserves unknown data and unresolved dependencies and stabilizes text", [Arbitrary.schema(FileSample)], ([wire]) => Effect.gen(function* () {
    const file = yield* PackageJsonFile;
    const fs = yield* FileSystem.FileSystem;
    const pkg = yield* Package.decode(wire);
    yield* file.write("/property/package.json", pkg);
    const text = yield* fs.readFileString("/property/package.json");
    const read = yield* file.read("/property/package.json");
    assert.isTrue(S.toEquivalence(Package)(pkg, read));
    yield* file.write("/property/package.json", read);
    assert.strictEqual(yield* fs.readFileString("/property/package.json"), text);
  }), runs);
});
