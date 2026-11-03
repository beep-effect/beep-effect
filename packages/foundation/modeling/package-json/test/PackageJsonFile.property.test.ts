import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

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
        const value1 = yield* S.encodeEffect(schema)(decoded);
        assert.deepStrictEqual(value1, encoded);
      }),
    runs
  );
};

import {
  PackageJsonNotFoundError,
  PackageJsonParseError,
  PackageJsonReadError,
  PackageJsonWriteError,
} from "@beep/package-json/PackageJsonFile";

describe("PackageJsonFile property floor", () => {
  roundTrips("PackageJsonReadError", PackageJsonReadError);
  roundTrips("PackageJsonNotFoundError", PackageJsonNotFoundError);
  roundTrips("PackageJsonParseError", PackageJsonParseError);
  roundTrips("PackageJsonWriteError", PackageJsonWriteError);
});

import { MemoryFileSystem } from "@beep/memfs";
import { Package } from "@beep/package-json/Package";
import { PackageJsonFile } from "@beep/package-json/PackageJsonFile";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";

const FileSample = S.Struct({
  name: S.tag("property-package"),
  version: S.Literals(["1.0.0", "2.0.0"]),
  description: S.String,
  keywords: S.Array(S.String),
  dependencies: S.Struct({ lib: S.tag("workspace:*") }),
  "x-data": S.Json,
});
const FileLayer = PackageJsonFile.layer.pipe(
  Layer.provideMerge(Layer.mergeAll(MemoryFileSystem.layerWith({}), Path.layer))
);
it.layer(FileLayer, { timeout: "30 seconds" })((it) => {
  it.effect.prop(
    "file read/write fidelity preserves unknown data and unresolved dependencies and stabilizes text",
    [Arbitrary.schema(FileSample)],
    ([wire]) =>
      Effect.gen(function* () {
        const file = yield* PackageJsonFile;
        const fs = yield* FileSystem.FileSystem;
        const pkg = yield* Package.decode(wire);
        yield* file.write("/property/package.json", pkg);
        const text = yield* fs.readFileString("/property/package.json");
        const read = yield* file.read("/property/package.json");
        assert.isTrue(S.toEquivalence(Package)(pkg, read));
        yield* file.write("/property/package.json", read);
        const readFileString2 = yield* fs.readFileString("/property/package.json");
        assert.strictEqual(readFileString2, text);
      }),
    runs
  );
});
