import { fcRuns } from "@beep/fc-runs/FastCheckRuns";
import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import { assert, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";

const runs = { arbitrary: fcRuns(100) };
it.effect.prop(
  "snapshot reseeding preserves bytes and inspection returns defensive copies",
  [Arbitrary.schema(S.Uint8Array)],
  ([bytes]) =>
    Effect.gen(function* () {
      const handle = yield* MemoryFileSystem.makeHandle({ "/file": bytes });
      const snapshot = handle.volume.snapshot();
      const copy = yield* MemoryFileSystem.makeHandle(snapshot);
      assert.deepStrictEqual(copy.volume.snapshot(), snapshot);
      assert.deepStrictEqual(handle.volume.bytes("/file"), bytes);
      const observed = handle.volume.bytes("/file");
      assert.isDefined(observed);
      if (observed === undefined) return assert.fail("seeded file must have bytes");
      observed.fill(255);
      assert.deepStrictEqual(handle.volume.bytes("/file"), bytes);
      assert.deepStrictEqual(handle.volume.paths(), ["/file"]);
    }),
  runs
);

it.effect.prop(
  "UTF-8 seed content agrees across the literal, synchronous and Effect views",
  [Arbitrary.schema(S.String)],
  ([text]) =>
    Effect.gen(function* () {
      const handle = yield* MemoryFileSystem.makeHandle({ "/text": text });
      const expected = new TextDecoder().decode(new TextEncoder().encode(text));
      assert.strictEqual(handle.volume.text("/text"), expected);
      assert.strictEqual(handle.sync.readFile("/text"), expected);
      const readFileString1 = yield* handle.fileSystem.readFileString("/text");
      assert.strictEqual(readFileString1, expected);
    }),
  runs
);
