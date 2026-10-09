import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
const roundTrips = <T, E>(name: string, schema: S.Codec<T, E>): void => {
  it.effect.prop(`${name}: encoded values decode without failure and preserve their value`, [Arbitrary.schema(schema)],
    ([value]) => Effect.gen(function* () {
      const encoded = yield* S.encodeEffect(schema)(value);
      const decoded = yield* S.decodeEffect(schema)(encoded);
      assert.isTrue(S.toEquivalence(schema)(decoded, value));
      assert.deepStrictEqual(yield* S.encodeEffect(schema)(decoded), encoded);
    }), runs);
};
import { InvalidFaultCountError, MemoryFileSystemVolumeStat, MemoryFileSystemSeedFile, MemoryFileSystemSeedDirectory, MemoryFileSystemSeedSymlink, MemoryFileSystemSeedEntry, MemoryFileSystemSeed } from "../../effected/memfs/MemoryFileSystem.ts";

describe("MemoryFileSystem schema properties", () => {
  roundTrips("InvalidFaultCountError", InvalidFaultCountError);
  roundTrips("MemoryFileSystemVolumeStat", MemoryFileSystemVolumeStat);
  roundTrips("MemoryFileSystemSeedFile", MemoryFileSystemSeedFile);
  roundTrips("MemoryFileSystemSeedDirectory", MemoryFileSystemSeedDirectory);
  roundTrips("MemoryFileSystemSeedSymlink", MemoryFileSystemSeedSymlink);
  roundTrips("MemoryFileSystemSeedEntry", MemoryFileSystemSeedEntry);
  roundTrips("MemoryFileSystemSeed", MemoryFileSystemSeed);
});
