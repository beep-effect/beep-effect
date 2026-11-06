import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import { assert, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
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
      const seek1 = yield* file.seek(BigInt(0), "current");
      assert.strictEqual(seek1, BigInt(10));
      const seek2 = yield* file.seek(BigInt(-7), "current");
      assert.strictEqual(seek2, BigInt(3));

      yield* file.writeAll(new TextEncoder().encode("XYZ12"));
      const readFileString3 = yield* fs.readFileString(path);
      assert.strictEqual(readFileString3, "abcXYZ12ij");
      assert.strictEqual((yield* file.stat).size, BigInt(10));
      const seek4 = yield* file.seek(BigInt(0), "current");
      assert.strictEqual(seek4, BigInt(8));

      const remaining = new Uint8Array(2);
      const read5 = yield* file.read(remaining);
      assert.strictEqual(read5, 2);
      assert.deepStrictEqual(A.fromIterable(remaining), [105, 106]);
      const seek6 = yield* file.seek(BigInt(0), "current");
      assert.strictEqual(seek6, BigInt(10));
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

      const write7 = yield* file.write(view);
      assert.strictEqual(write7, 3);
      const readFile8 = yield* fs.readFile(path);
      assert.deepStrictEqual(A.fromIterable(readFile8), [65, 66, 67]);
      const seek9 = yield* file.seek(BigInt(0), "current");
      assert.strictEqual(seek9, BigInt(3));

      const replacementBacking = new Uint8Array([253, 120, 121, 122, 252]);
      const replacement = new Uint8Array(replacementBacking.buffer, 1, 3);
      const seek10 = yield* file.seek(BigInt(-2), "current");
      assert.strictEqual(seek10, BigInt(1));
      yield* file.writeAll(replacement);

      const readFile11 = yield* fs.readFile(path);
      assert.deepStrictEqual(A.fromIterable(readFile11), [65, 120, 121, 122]);
      assert.strictEqual((yield* file.stat).size, BigInt(4));
      const seek12 = yield* file.seek(BigInt(0), "current");
      assert.strictEqual(seek12, BigInt(4));
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
      const read13 = yield* file.read(first);
      assert.strictEqual(read13, 2);
      assert.deepStrictEqual(A.fromIterable(first), [97, 98]);
      const seek14 = yield* file.seek(BigInt(-1), "current");
      assert.strictEqual(seek14, BigInt(1));

      const write15 = yield* file.write(new TextEncoder().encode("XY"));
      assert.strictEqual(write15, 2);
      const readFileString16 = yield* fs.readFileString(path);
      assert.strictEqual(readFileString16, "abcdefXY");
      const seek17 = yield* file.seek(BigInt(0), "current");
      assert.strictEqual(seek17, BigInt(1));

      const second = new Uint8Array(2);
      const read18 = yield* file.read(second);
      assert.strictEqual(read18, 2);
      assert.deepStrictEqual(A.fromIterable(second), [98, 99]);
      const seek19 = yield* file.seek(BigInt(0), "current");
      assert.strictEqual(seek19, BigInt(3));

      yield* file.writeAll(new TextEncoder().encode("Z12"));
      const readFileString20 = yield* fs.readFileString(path);
      assert.strictEqual(readFileString20, "abcdefXYZ12");
      assert.strictEqual((yield* file.stat).size, BigInt(11));
      const seek21 = yield* file.seek(BigInt(0), "current");
      assert.strictEqual(seek21, BigInt(3));

      const third = new Uint8Array(3);
      const read22 = yield* file.read(third);
      assert.strictEqual(read22, 3);
      assert.deepStrictEqual(A.fromIterable(third), [100, 101, 102]);
      const appended = new Uint8Array(5);
      const read23 = yield* file.read(appended);
      assert.strictEqual(read23, 5);
      assert.deepStrictEqual(A.fromIterable(appended), [88, 89, 90, 49, 50]);
      const seek24 = yield* file.seek(BigInt(0), "current");
      assert.strictEqual(seek24, BigInt(11));
    })
  );
});
