import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { assert, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as Fs from "effect/FileSystem";

// Exercise the shared platform implementation under both actual Node and Bun.
// The layer is shared; each test owns its temporary file and open descriptor.
it.layer(NodeFileSystem.layer)("FileSystem write compatibility", (it) => {
  it.effect(
    "writeAll honors a backward seek and advances by the full payload",
    Effect.fnUntraced(function* () {
      const fs = yield* Fs.FileSystem;
      const path = yield* fs.makeTempFileScoped();
      const file = yield* fs.open(path, { flag: "w+" });

      yield* file.writeAll(new TextEncoder().encode("abcdefghij"));
      assert.strictEqual(yield* file.seek(BigInt(0), "current"), BigInt(10));
      assert.strictEqual(yield* file.seek(BigInt(-7), "current"), BigInt(3));

      yield* file.writeAll(new TextEncoder().encode("XYZ12"));
      assert.strictEqual(yield* fs.readFileString(path), "abcXYZ12ij");
      assert.strictEqual((yield* file.stat).size, BigInt(10));
      assert.strictEqual(yield* file.seek(BigInt(0), "current"), BigInt(8));

      const remaining = new Uint8Array(2);
      assert.strictEqual(yield* file.read(remaining), 2);
      assert.deepStrictEqual(A.fromIterable(remaining), [105, 106]);
      assert.strictEqual(yield* file.seek(BigInt(0), "current"), BigInt(10));
    })
  );

  it.effect(
    "write and writeAll write only the bytes of offset Uint8Array views",
    Effect.fnUntraced(function* () {
      const fs = yield* Fs.FileSystem;
      const path = yield* fs.makeTempFileScoped();
      const file = yield* fs.open(path, { flag: "w+" });
      const backing = new Uint8Array([255, 65, 66, 67, 254]);
      const view = new Uint8Array(backing.buffer, 1, 3);

      assert.strictEqual(yield* file.write(view), 3);
      assert.deepStrictEqual(A.fromIterable(yield* fs.readFile(path)), [65, 66, 67]);
      assert.strictEqual(yield* file.seek(BigInt(0), "current"), BigInt(3));

      const replacementBacking = new Uint8Array([253, 120, 121, 122, 252]);
      const replacement = new Uint8Array(replacementBacking.buffer, 1, 3);
      assert.strictEqual(yield* file.seek(BigInt(-2), "current"), BigInt(1));
      yield* file.writeAll(replacement);

      assert.deepStrictEqual(A.fromIterable(yield* fs.readFile(path)), [65, 120, 121, 122]);
      assert.strictEqual((yield* file.stat).size, BigInt(4));
      assert.strictEqual(yield* file.seek(BigInt(0), "current"), BigInt(4));
    })
  );

  it.effect(
    "append write and writeAll preserve the independent read cursor",
    Effect.fnUntraced(function* () {
      const fs = yield* Fs.FileSystem;
      const path = yield* fs.makeTempFileScoped();
      yield* fs.writeFileString(path, "abcdef");
      const file = yield* fs.open(path, { flag: "a+" });

      const first = new Uint8Array(2);
      assert.strictEqual(yield* file.read(first), 2);
      assert.deepStrictEqual(A.fromIterable(first), [97, 98]);
      assert.strictEqual(yield* file.seek(BigInt(-1), "current"), BigInt(1));

      assert.strictEqual(yield* file.write(new TextEncoder().encode("XY")), 2);
      assert.strictEqual(yield* fs.readFileString(path), "abcdefXY");
      assert.strictEqual(yield* file.seek(BigInt(0), "current"), BigInt(1));

      const second = new Uint8Array(2);
      assert.strictEqual(yield* file.read(second), 2);
      assert.deepStrictEqual(A.fromIterable(second), [98, 99]);
      assert.strictEqual(yield* file.seek(BigInt(0), "current"), BigInt(3));

      yield* file.writeAll(new TextEncoder().encode("Z12"));
      assert.strictEqual(yield* fs.readFileString(path), "abcdefXYZ12");
      assert.strictEqual((yield* file.stat).size, BigInt(11));
      assert.strictEqual(yield* file.seek(BigInt(0), "current"), BigInt(3));

      const third = new Uint8Array(3);
      assert.strictEqual(yield* file.read(third), 3);
      assert.deepStrictEqual(A.fromIterable(third), [100, 101, 102]);
      const appended = new Uint8Array(5);
      assert.strictEqual(yield* file.read(appended), 5);
      assert.deepStrictEqual(A.fromIterable(appended), [88, 89, 90, 49, 50]);
      assert.strictEqual(yield* file.seek(BigInt(0), "current"), BigInt(11));
    })
  );
});
