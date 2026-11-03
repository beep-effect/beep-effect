// Ported from Effect-TS/effect PR #6555 "test: add file system test suite"
// (https://github.com/Effect-TS/effect/pull/6555), pinned head
// 2492ba9df1c0fd25a2119aace82dafb2b7b8e77c, by lloydrichards.
// Upstream source: packages/effect/test/FileSystemTest.ts.
// Copyright: Effectful Technologies Inc.
// License: MIT (https://github.com/Effect-TS/effect/blob/main/LICENSE)
//
// Port notes: the suite body is upstream's, house-formatted. The one deliberate
// change is the harness entry — upstream's top-level `it.layer(...)` becomes
// the kit's suite-boundary `layer(...)` from @effect/vitest. The suite is the
// contract oracle: it runs unchanged against BOTH MemoryFileSystem.layer
// (MemoryFileSystem.contract.test.ts) and the real @effect/platform-node
// filesystem (integration/node.int.test.ts), which is what proves the port
// matches real semantics on the installed beta. Every path it touches lives
// under a scoped temp directory, so the node run stays confined to os.tmpdir().

import { assert, describe, layer } from "@effect/vitest";
import { assertExitFailure, assertExitSuccess, assertNone } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import * as PlatformError from "effect/PlatformError";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import type { Vitest } from "@effect/vitest";
import type * as Layer from "effect/Layer";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const makeTestContext = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "effect-filesystem-test-" });
  return {
    fs,
    path: (...segments: ReadonlyArray<string>) => A.join([root, ...segments], "/"),
  };
});

// The nested source tree the directory-listing cases read back.
const writeSourceTree = Effect.fnUntraced(function* (
  fs: FileSystem.FileSystem,
  path: (...segments: ReadonlyArray<string>) => string
) {
  yield* fs.makeDirectory(path("src", "features"), { recursive: true });
  yield* fs.writeFileString(path("src", "index.ts"), "export {}");
  yield* fs.writeFileString(path("src", "features", "chat.ts"), "export {}");
});

const fillBuffer = Effect.fnUntraced(function* (file: FileSystem.File, buffer: Uint8Array) {
  let offset = 0;
  while (offset < buffer.length) {
    const bytesRead = yield* file.read(buffer.subarray(offset));
    assert.isTrue(bytesRead >= 0);
    assert.isTrue(bytesRead <= buffer.length - offset);
    if (bytesRead === 0) {
      break;
    }
    offset += bytesRead;
  }
  return offset;
});

const readAllocUpTo = Effect.fnUntraced(function* (file: FileSystem.File, size: number) {
  const bytes = new Uint8Array(size);
  let offset = 0;
  while (offset < size) {
    const chunk = yield* file.readAlloc(size - offset);
    if (O.isNone(chunk)) {
      break;
    }
    assert.isTrue(chunk.value.length > 0);
    assert.isTrue(chunk.value.length <= size - offset);
    bytes.set(chunk.value, offset);
    offset += chunk.value.length;
  }
  return bytes.subarray(0, offset);
});

const writeUsingWrite = Effect.fnUntraced(function* (file: FileSystem.File, bytes: Uint8Array) {
  let offset = 0;
  while (offset < bytes.length) {
    const write1 = yield* file.write(bytes.subarray(offset));
    const bytesWritten = Number(write1);
    assert.isTrue(bytesWritten > 0);
    assert.isTrue(bytesWritten <= bytes.length - offset);
    offset += bytesWritten;
  }
});

const assertSystemError = (
  error: PlatformError.PlatformError,
  expected: {
    readonly tag?: PlatformError.SystemErrorTag | undefined;
    readonly method?: string | undefined;
    readonly pathOrDescriptor?: string | number | undefined;
  }
): PlatformError.SystemError => {
  assert.strictEqual(error._tag, "PlatformError");
  if (!(error.reason instanceof PlatformError.SystemError)) {
    return assert.fail("Expected a SystemError");
  }
  assert.strictEqual(error.reason.module, "FileSystem");
  if (expected.method !== undefined) {
    assert.strictEqual(error.reason.method, expected.method);
  }
  if (expected.pathOrDescriptor !== undefined) {
    assert.strictEqual(error.reason.pathOrDescriptor, expected.pathOrDescriptor);
  }
  if (expected.tag !== undefined) {
    assert.strictEqual(error.reason._tag, expected.tag);
  }
  return error.reason;
};

// The contract's cases, registered into a harness that already serves
// `FileSystem.FileSystem` — the suite's own `layer`, or a reference harness
// that provides a wider platform layer.
export const fileSystemCases = (it: Vitest.MethodsNonLive<FileSystem.FileSystem>): void => {
  describe("path operations", () => {
    it.effect("should preserve binary bytes when reading and writing files", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const file = path("binary.dat");
        const expected = new Uint8Array([0, 42, 128, 255]);
        const input = expected.slice();

        yield* fs.writeFile(file, input);
        input[1] = 0;

        const firstRead = yield* fs.readFile(file);
        assert.deepStrictEqual(firstRead, expected);
        firstRead[2] = 0;
        const readFile2 = yield* fs.readFile(file);
        assert.deepStrictEqual(readFile2, expected);
      })
    );

    it.effect("should preserve UTF-8 text when reading and writing files", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const file = path("utf8.txt");
        const text = "héllo 👋";

        yield* fs.writeFileString(file, text);

        const readFileString3 = yield* fs.readFileString(file);
        assert.strictEqual(readFileString3, text);
      })
    );

    it.effect("should list directory entries and metadata when creating nested directories", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        yield* writeSourceTree(fs, path);

        assert.deepStrictEqual((yield* fs.readDirectory(path("src"))).sort(), ["features", "index.ts"]);
        assert.strictEqual((yield* fs.stat(path("src"))).type, "Directory");
        assert.strictEqual((yield* fs.stat(path("src", "index.ts"))).type, "File");
        assert.strictEqual((yield* fs.stat(path("src", "index.ts"))).size, ByteSize.bytes(9));
      })
    );

    it.effect("should include nested files when listing directories recursively", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        yield* writeSourceTree(fs, path);

        const readDirectory4 = yield* fs.readDirectory(path("src"), { recursive: true });
        const entries = A.map(readDirectory4, (path) => Str.replaceAll("\\", "/")(path)).sort();

        assert.isTrue(entries.includes("features/chat.ts"));
        assert.isTrue(entries.includes("index.ts"));
      })
    );

    it.effect("should require parent directories when creation is not recursive", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const directory = path("missing", "nested");
        const file = path("missing", "file.txt");

        const directoryError = yield* Effect.flip(fs.makeDirectory(directory));
        assertSystemError(directoryError, {
          tag: "NotFound",
          method: "makeDirectory",
          pathOrDescriptor: directory,
        });

        const fileError = yield* Effect.flip(fs.writeFile(file, encoder.encode("content")));
        assertSystemError(fileError, { tag: "NotFound", method: "writeFile", pathOrDescriptor: file });

        yield* fs.makeDirectory(directory, { recursive: true });
        assert.strictEqual((yield* fs.stat(directory)).type, "Directory");
      })
    );

    it.effect("should keep recursive directory creation idempotent when the path is a directory", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const directory = path("nested", "directory");
        const file = path("file.txt");

        yield* fs.makeDirectory(directory, { recursive: true });
        yield* fs.makeDirectory(directory, { recursive: true });
        assert.strictEqual((yield* fs.stat(directory)).type, "Directory");

        yield* fs.writeFileString(file, "content");
        const error = yield* Effect.flip(fs.makeDirectory(file, { recursive: true }));
        assertSystemError(error, { tag: "AlreadyExists", method: "makeDirectory", pathOrDescriptor: file });
        const readFileString5 = yield* fs.readFileString(file);
        assert.strictEqual(readFileString5, "content");
      })
    );

    it.effect("should report existence when a path is created and removed", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const file = path("exists.txt");

        const exists6 = yield* fs.exists(file);
        assert.isFalse(exists6);
        yield* fs.writeFileString(file, "exists");
        const exists7 = yield* fs.exists(file);
        assert.isTrue(exists7);
        yield* fs.remove(file);
        const exists8 = yield* fs.exists(file);
        assert.isFalse(exists8);
      })
    );

    it.effect("should access existing paths and reject missing paths when checking access", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const existing = path("existing.txt");
        const missing = path("missing.txt");

        yield* fs.writeFileString(existing, "content");
        yield* fs.access(existing);

        const error = yield* Effect.flip(fs.access(missing));
        assertSystemError(error, { tag: "NotFound", method: "access", pathOrDescriptor: missing });
      })
    );

    it.effect("should remove non-empty directories when removal is recursive", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const directory = path("nested");
        yield* fs.makeDirectory(path("nested", "child"), { recursive: true });
        yield* fs.writeFileString(path("nested", "child", "file.txt"), "content");

        yield* fs.remove(directory, { recursive: true });

        const exists9 = yield* fs.exists(directory);
        assert.isFalse(exists9);
      })
    );

    it.effect("should reject non-empty directories when removal is not recursive", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const directory = path("non-empty");
        const file = path("non-empty", "file.txt");
        yield* fs.makeDirectory(directory);
        yield* fs.writeFileString(file, "content");

        const error = yield* Effect.flip(fs.remove(directory));
        assertSystemError(error, { method: "remove", pathOrDescriptor: directory });

        const readFileString10 = yield* fs.readFileString(file);
        assert.strictEqual(readFileString10, "content");
      })
    );

    it.effect("should ignore missing paths only when removal is forced", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const missing = path("missing");

        const error = yield* Effect.flip(fs.remove(missing));
        assertSystemError(error, { tag: "NotFound", method: "remove", pathOrDescriptor: missing });

        yield* fs.remove(missing, { force: true });
      })
    );

    it.effect("should apply truncating, appending, and exclusive flags when writing files", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const file = path("write-flags.txt");
        yield* fs.writeFileString(file, "original");

        yield* fs.writeFileString(file, "replacement");
        yield* fs.writeFileString(file, " appended", { flag: "a" });
        const readFileString11 = yield* fs.readFileString(file);
        assert.strictEqual(readFileString11, "replacement appended");

        const error = yield* Effect.flip(fs.writeFile(file, encoder.encode("exclusive"), { flag: "wx" }));
        assertSystemError(error, { tag: "AlreadyExists", method: "writeFile", pathOrDescriptor: file });
        const readFileString12 = yield* fs.readFileString(file);
        assert.strictEqual(readFileString12, "replacement appended");
      })
    );

    it.effect("should honor write flags when writing empty data", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const file = path("empty-write-flags.txt");

        yield* fs.writeFileString(file, "content");
        yield* fs.writeFileString(file, "");
        const readFileString13 = yield* fs.readFileString(file);
        assert.strictEqual(readFileString13, "");

        yield* fs.writeFileString(file, "content");
        yield* fs.writeFileString(file, "", { flag: "r+" });
        const readFileString14 = yield* fs.readFileString(file);
        assert.strictEqual(readFileString14, "content");
      })
    );

    it.effect("should copy independent file and directory-tree contents when copying paths", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        yield* fs.makeDirectory(path("source", "nested"), { recursive: true });
        yield* fs.writeFileString(path("source", "file.txt"), "file");
        yield* fs.writeFileString(path("source", "nested", "child.txt"), "child");

        yield* fs.copyFile(path("source", "file.txt"), path("copy.txt"));
        yield* fs.copy(path("source"), path("copy"));

        yield* fs.writeFileString(path("source", "file.txt"), "changed file");
        yield* fs.writeFileString(path("source", "nested", "child.txt"), "changed child");

        const readFileString15 = yield* fs.readFileString(path("copy.txt"));
        assert.strictEqual(readFileString15, "file");
        const readFileString16 = yield* fs.readFileString(path("copy", "file.txt"));
        assert.strictEqual(readFileString16, "file");
        const readFileString17 = yield* fs.readFileString(path("copy", "nested", "child.txt"));
        assert.strictEqual(readFileString17, "child");
      })
    );

    it.effect("should replace an existing copy destination when overwrite is requested", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const source = path("source.txt");
        const destination = path("copy.txt");
        yield* fs.writeFileString(source, "source");
        yield* fs.writeFileString(destination, "old copy");

        yield* fs.copy(source, destination, { overwrite: true });

        const readFileString18 = yield* fs.readFileString(destination);
        assert.strictEqual(readFileString18, "source");
      })
    );

    it.effect("should move files and directories when renaming paths", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        yield* fs.makeDirectory(path("before", "nested"), { recursive: true });
        yield* fs.writeFileString(path("before", "nested", "file.txt"), "content");

        yield* fs.rename(path("before"), path("after"));
        yield* fs.rename(path("after", "nested", "file.txt"), path("after", "nested", "renamed.txt"));

        const exists19 = yield* fs.exists(path("before"));
        assert.isFalse(exists19);
        const exists20 = yield* fs.exists(path("after", "nested", "file.txt"));
        assert.isFalse(exists20);
        const readFileString21 = yield* fs.readFileString(path("after", "nested", "renamed.txt"));
        assert.strictEqual(readFileString21, "content");
      })
    );

    it.effect("should truncate and zero-extend files when changing their size", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const file = path("truncate.txt");
        yield* fs.writeFileString(file, "hello world");

        yield* fs.truncate(file, 5);
        const readFileString22 = yield* fs.readFileString(file);
        assert.strictEqual(readFileString22, "hello");

        yield* fs.truncate(file, 8);
        const readFile23 = yield* fs.readFile(file);
        assert.deepStrictEqual(readFile23, encoder.encode("hello\0\0\0"));

        yield* fs.truncate(file);
        const readFile24 = yield* fs.readFile(file);
        assert.deepStrictEqual(readFile24, new Uint8Array(0));
      })
    );

    it.effect("should normalize stable filesystem errors when path operations fail", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const missingPath = path("missing.txt");
        const missing = yield* Effect.flip(fs.readFile(missingPath));
        assertSystemError(missing, { tag: "NotFound", method: "readFile", pathOrDescriptor: missingPath });

        const directory = path("existing");
        yield* fs.makeDirectory(directory);
        const existing = yield* Effect.flip(fs.makeDirectory(directory));
        assertSystemError(existing, { tag: "AlreadyExists", method: "makeDirectory", pathOrDescriptor: directory });

        const file = path("file.txt");
        yield* fs.writeFileString(file, "content");
        const badResource = yield* Effect.flip(fs.readDirectory(file));
        assertSystemError(badResource, { tag: "BadResource", method: "readDirectory", pathOrDescriptor: file });
      })
    );
  });

  describe("temporary resources", () => {
    it.effect("should clean up scoped temporary resources when their scope closes", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const directory = yield* Effect.scoped(
          Effect.gen(function* () {
            const directory = yield* fs.makeTempDirectory({ directory: path() });
            assert.strictEqual((yield* fs.stat(directory)).type, "Directory");
            return directory;
          })
        );
        assert.strictEqual((yield* fs.stat(directory)).type, "Directory");
        yield* fs.remove(directory, { recursive: true });

        const file = yield* fs.makeTempFile({ directory: path() });
        assert.strictEqual((yield* fs.stat(file)).type, "File");
        yield* fs.remove(file);

        const suffixedFile = yield* fs.makeTempFile({ directory: path(), prefix: "plain-", suffix: ".txt" });
        assert.strictEqual((yield* fs.stat(suffixedFile)).type, "File");
        assert.isTrue(Str.endsWith(".txt")(suffixedFile));

        const scopedDirectory = yield* Effect.scoped(
          Effect.gen(function* () {
            const directory = yield* fs.makeTempDirectoryScoped({ directory: path(), prefix: "scoped-" });
            yield* fs.makeDirectory(`${directory}/nested`);
            yield* fs.writeFileString(`${directory}/nested/file.txt`, "content");
            assert.strictEqual((yield* fs.stat(directory)).type, "Directory");
            return directory;
          })
        );
        const scopedDirectoryError = yield* Effect.flip(fs.stat(scopedDirectory));
        assertSystemError(scopedDirectoryError, {
          tag: "NotFound",
          method: "stat",
          pathOrDescriptor: scopedDirectory,
        });

        const scopedFile = yield* Effect.scoped(
          Effect.gen(function* () {
            const file = yield* fs.makeTempFileScoped({
              directory: path(),
              prefix: "scoped-",
              suffix: ".txt",
            });
            assert.strictEqual((yield* fs.stat(file)).type, "File");
            assert.isTrue(Str.endsWith(".txt")(file));
            return file;
          })
        );
        const scopedFileError = yield* Effect.flip(fs.stat(scopedFile));
        assertSystemError(scopedFileError, { tag: "NotFound", method: "stat", pathOrDescriptor: scopedFile });
      })
    );
  });

  describe("streaming", () => {
    it.effect("should stream bounded file ranges when offsets and chunk sizes are configured", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const file = path("stream.txt");
        yield* fs.writeFileString(file, "0123456789");

        const defaultChunks = yield* fs
          .stream(file, {
            offset: 6,
            bytesToRead: 3,
          })
          .pipe(Stream.runCollect);
        const chunks = yield* fs
          .stream(file, {
            offset: 2,
            bytesToRead: 5,
            chunkSize: 2,
          })
          .pipe(Stream.runCollect);

        assert.strictEqual(
          A.join(
            A.map(defaultChunks, (d) => decoder.decode(d)),
            ""
          ),
          "678"
        );
        assert.isTrue(A.every(chunks, (chunk) => chunk.length > 0 && chunk.length <= 2));
        assert.strictEqual(
          A.join(
            A.map(chunks, (d) => decoder.decode(d)),
            ""
          ),
          "23456"
        );
      })
    );

    it.effect("should write stream chunks when using a file sink", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const file = path("sink.txt");
        yield* fs.writeFileString(file, "old content");

        yield* Stream.run(Stream.make(encoder.encode("new "), encoder.encode("content")), fs.sink(file));

        const readFileString25 = yield* fs.readFileString(file);
        assert.strictEqual(readFileString25, "new content");
      })
    );

    it.effect("should append stream chunks when a file sink uses the append flag", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const file = path("append-sink.txt");
        yield* fs.writeFileString(file, "seed");

        yield* Stream.run(Stream.make(encoder.encode(" appended")), fs.sink(file, { flag: "a" }));

        const readFileString26 = yield* fs.readFileString(file);
        assert.strictEqual(readFileString26, "seed appended");
      })
    );
  });

  describe("file handles and open modes", () => {
    it.effect("should keep read cursors independent when a file has multiple handles", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const file = path("cursors.txt");
        yield* fs.writeFileString(file, "0123456789");

        const first = yield* fs.open(file);
        const second = yield* fs.open(file);

        const buffer = new Uint8Array(2);
        const fillBuffer27 = yield* fillBuffer(first, buffer);
        assert.strictEqual(fillBuffer27, 2);
        assert.strictEqual(decoder.decode(buffer), "01");
        const readAllocUpTo28 = yield* readAllocUpTo(second, 2);
        assert.strictEqual(decoder.decode(readAllocUpTo28), "01");
        yield* first.seek(BigInt(3), "current");
        const readAllocUpTo29 = yield* readAllocUpTo(first, 2);
        assert.strictEqual(decoder.decode(readAllocUpTo29), "56");
        yield* first.seek(BigInt(0), "start");
        const readAllocUpTo30 = yield* readAllocUpTo(first, 2);
        assert.strictEqual(decoder.decode(readAllocUpTo30), "01");
      })
    );

    it.effect("should advance and seek the write cursor when writing through a file handle", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const filePath = path("write-cursor.txt");
        const file = yield* fs.open(filePath, { flag: "w+" });

        yield* writeUsingWrite(file, encoder.encode("abc"));
        yield* writeUsingWrite(file, encoder.encode("def"));
        const readFileString31 = yield* fs.readFileString(filePath);
        assert.strictEqual(readFileString31, "abcdef");

        yield* file.seek(BigInt(-2), "current");
        yield* writeUsingWrite(file, encoder.encode("WXYZ"));
        const readFileString32 = yield* fs.readFileString(filePath);
        assert.strictEqual(readFileString32, "abcdWXYZ");

        yield* file.seek(BigInt(2), "start");
        yield* writeUsingWrite(file, encoder.encode("!!"));
        yield* file.sync;

        assert.strictEqual((yield* file.stat).size, ByteSize.bytes(8));
        const readFileString33 = yield* fs.readFileString(filePath);
        assert.strictEqual(readFileString33, "ab!!WXYZ");
      })
    );

    it.effect("should append primitive writes when a handle uses the append flag", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const filePath = path("append-write.txt");
        yield* fs.writeFileString(filePath, "seed");
        const file = yield* fs.open(filePath, { flag: "a+" });

        yield* file.seek(BigInt(0), "start");
        yield* writeUsingWrite(file, encoder.encode("xy"));

        const readFileString34 = yield* fs.readFileString(filePath);
        assert.strictEqual(readFileString34, "seedxy");
      })
    );

    it.effect("should truncate and extend files when using a file handle", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const filePath = path("handle-truncate.txt");
        yield* fs.writeFileString(filePath, "abcdef");
        const file = yield* fs.open(filePath, { flag: "r+" });

        yield* file.truncate(3);
        assert.strictEqual((yield* file.stat).size, ByteSize.bytes(3));
        const readFileString35 = yield* fs.readFileString(filePath);
        assert.strictEqual(readFileString35, "abc");

        yield* file.truncate(5);
        assert.strictEqual((yield* file.stat).size, ByteSize.bytes(5));
        const readFile36 = yield* fs.readFile(filePath);
        assert.deepStrictEqual(readFile36, encoder.encode("abc\0\0"));
      })
    );

    it.effect("should return partial reads and EOF when reading beyond file contents", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const filePath = path("eof.txt");
        yield* fs.writeFileString(filePath, "abc");
        const file = yield* fs.open(filePath);

        const contents = yield* readAllocUpTo(file, 10);
        assert.strictEqual(decoder.decode(contents), "abc");
        const readAlloc37 = yield* file.readAlloc(1);
        assertNone(readAlloc37);
      })
    );

    const openFlags = [
      { flag: "r", access: "read", existing: "seed", missing: "rejects", expectedContent: "seed" },
      { flag: "r+", access: "read-write", existing: "seed", missing: "rejects", expectedContent: "xeed" },
      { flag: "w", access: "write", existing: "", missing: "creates", expectedContent: "x" },
      { flag: "wx", access: "write", existing: "rejects", missing: "creates", expectedContent: "x" },
      { flag: "w+", access: "read-write", existing: "", missing: "creates", expectedContent: "x" },
      { flag: "wx+", access: "read-write", existing: "rejects", missing: "creates", expectedContent: "x" },
      { flag: "a", access: "write", existing: "seed", missing: "creates", expectedContent: "seedx" },
      { flag: "ax", access: "write", existing: "rejects", missing: "creates", expectedContent: "x" },
      { flag: "a+", access: "read-write", existing: "seed", missing: "creates", expectedContent: "seedx" },
      { flag: "ax+", access: "read-write", existing: "rejects", missing: "creates", expectedContent: "x" },
    ] as const;

    type OpenFlagCase = (typeof openFlags)[number];

    const assertExistingRejected = Effect.fnUntraced(function* (
      fs: FileSystem.FileSystem,
      { existing: existingBehavior, flag }: OpenFlagCase,
      existing: string
    ) {
      if (existingBehavior !== "rejects") return;
      const error = yield* Effect.flip(fs.open(existing, { flag }));
      assertSystemError(error, { tag: "AlreadyExists", method: "open", pathOrDescriptor: existing });
      const readFileString38 = yield* fs.readFileString(existing);
      assert.strictEqual(readFileString38, "seed");
    });

    const assertMissingRejected = Effect.fnUntraced(function* (
      fs: FileSystem.FileSystem,
      { flag, missing }: OpenFlagCase,
      created: string
    ) {
      if (missing !== "rejects") return;
      const error = yield* Effect.flip(fs.open(created, { flag }));
      assertSystemError(error, { tag: "NotFound", method: "open", pathOrDescriptor: created });
    });

    const assertWriteAccess = Effect.fnUntraced(function* (file: FileSystem.File, { access }: OpenFlagCase) {
      if (access !== "read") {
        yield* file.writeAll(encoder.encode("x"));
        return;
      }
      const error = yield* Effect.flip(file.writeAll(encoder.encode("x")));
      assertSystemError(error, { method: "writeAll" });
    });

    const assertReadAccess = Effect.fnUntraced(function* (
      file: FileSystem.File,
      { access, expectedContent }: OpenFlagCase
    ) {
      if (access !== "write") {
        yield* file.seek(BigInt(0), "start");
        const readAllocUpTo39 = yield* readAllocUpTo(file, 1);
        assert.strictEqual(decoder.decode(readAllocUpTo39), Str.slice(0, 1)(expectedContent));
        return;
      }
      const error = yield* Effect.flip(file.readAlloc(1));
      assertSystemError(error, { method: "readAlloc" });
    });

    const assertCreatesMissing = Effect.fnUntraced(function* (
      fs: FileSystem.FileSystem,
      { existing: existingBehavior, flag, missing }: OpenFlagCase,
      created: string
    ) {
      if (existingBehavior === "rejects" || missing !== "creates") return;
      yield* fs.open(created, { flag });
      const exists40 = yield* fs.exists(created);
      assert.isTrue(exists40);
    });

    it.effect.each(openFlags)("supports the $flag open flag", (row) =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const existing = path("existing.txt");
        const created = path("created.txt");
        yield* fs.writeFileString(existing, "seed");

        yield* assertExistingRejected(fs, row, existing);
        yield* assertMissingRejected(fs, row, created);

        const rejectsExisting = row.existing === "rejects";
        const filePath = rejectsExisting ? created : existing;
        const file = yield* fs.open(filePath, { flag: row.flag });

        const readFileString41 = yield* fs.readFileString(filePath);
        assert.strictEqual(readFileString41, rejectsExisting ? "" : row.existing);

        yield* assertWriteAccess(file, row);
        const readFileString42 = yield* fs.readFileString(filePath);
        assert.strictEqual(readFileString42, row.expectedContent);
        yield* assertReadAccess(file, row);
        yield* assertCreatesMissing(fs, row, created);
      })
    );

    it.effect("should reject traversal through a file when a child path targets it", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const parent = path("file.txt");
        const child = path("file.txt", "child.txt");
        yield* fs.writeFileString(parent, "content");

        const writeError = yield* Effect.flip(fs.writeFileString(child, "child"));
        assertSystemError(writeError, { tag: "BadResource", method: "writeFile", pathOrDescriptor: child });

        const statError = yield* Effect.flip(fs.stat(child));
        assertSystemError(statError, { tag: "BadResource", method: "stat", pathOrDescriptor: child });
        const readFileString43 = yield* fs.readFileString(parent);
        assert.strictEqual(readFileString43, "content");
      })
    );

    it.effect("should apply open flags consistently when high-level writes target existing and missing paths", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const cases = [
          { flag: "r", existing: "rejects", missing: "rejects" },
          { flag: "r+", existing: "xeed", missing: "rejects" },
          { flag: "w", existing: "x", missing: "x" },
          { flag: "wx", existing: "rejects", missing: "x" },
          { flag: "w+", existing: "x", missing: "x" },
          { flag: "wx+", existing: "rejects", missing: "x" },
          { flag: "a", existing: "seedx", missing: "x" },
          { flag: "ax", existing: "rejects", missing: "x" },
          { flag: "a+", existing: "seedx", missing: "x" },
          { flag: "ax+", existing: "rejects", missing: "x" },
        ] as const;

        for (const { existing: expectedExisting, flag, missing: expectedMissing } of cases) {
          const existing = path(`${Str.replace("+", "plus")(flag)}-existing.txt`);
          const missing = path(`${Str.replace("+", "plus")(flag)}-missing.txt`);
          yield* fs.writeFileString(existing, "seed");

          const existingResult = yield* Effect.exit(fs.writeFileString(existing, "x", { flag }));
          if (expectedExisting === "rejects") {
            const error = existingResult.pipe(Exit.findError, Result.getOrThrow);
            assertExitFailure(existingResult, Cause.fail(error));
            assertSystemError(error, { method: "writeFile", pathOrDescriptor: existing });
            const readFileString44 = yield* fs.readFileString(existing);
            assert.strictEqual(readFileString44, "seed");
          } else {
            assertExitSuccess(existingResult, undefined);
            const readFileString45 = yield* fs.readFileString(existing);
            assert.strictEqual(readFileString45, expectedExisting);
          }

          const missingResult = yield* Effect.exit(fs.writeFileString(missing, "x", { flag }));
          if (expectedMissing === "rejects") {
            const error = missingResult.pipe(Exit.findError, Result.getOrThrow);
            assertExitFailure(missingResult, Cause.fail(error));
            assertSystemError(error, {
              tag: "NotFound",
              method: "writeFile",
              pathOrDescriptor: missing,
            });
          } else {
            assertExitSuccess(missingResult, undefined);
            const readFileString46 = yield* fs.readFileString(missing);
            assert.strictEqual(readFileString46, expectedMissing);
          }
        }
      })
    );
  });

  describe("open file state", () => {
    it.effect("should zero-fill gaps when sparse writes extend a file", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const filePath = path("sparse.bin");
        const file = yield* fs.open(filePath, { flag: "w+" });

        yield* file.seek(BigInt(4), "start");
        yield* file.writeAll(new Uint8Array([42, 255]));

        const readFile47 = yield* fs.readFile(filePath);
        assert.deepStrictEqual(readFile47, new Uint8Array([0, 0, 0, 0, 42, 255]));
      })
    );

    it.effect("should keep open handles attached when their file is renamed", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const before = path("before.txt");
        const after = path("after.txt");
        yield* fs.writeFileString(before, "content");
        const file = yield* fs.open(before, { flag: "r+" });

        yield* fs.rename(before, after);
        yield* file.seek(BigInt(0), "start");
        yield* file.writeAll(encoder.encode("renamed"));

        const exists48 = yield* fs.exists(before);
        assert.isFalse(exists48);
        const readFileString49 = yield* fs.readFileString(after);
        assert.strictEqual(readFileString49, "renamed");
      })
    );

    it.effect("should preserve both open handles when renaming over an existing destination", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const source = path("rename-source.txt");
        const destination = path("rename-destination.txt");
        yield* fs.writeFileString(source, "source");
        yield* fs.writeFileString(destination, "destination");
        const sourceHandle = yield* fs.open(source);
        const destinationHandle = yield* fs.open(destination);

        yield* fs.rename(source, destination);

        const exists50 = yield* fs.exists(source);
        assert.isFalse(exists50);
        const readFileString51 = yield* fs.readFileString(destination);
        assert.strictEqual(readFileString51, "source");
        const readAllocUpTo52 = yield* readAllocUpTo(sourceHandle, 6);
        assert.strictEqual(decoder.decode(readAllocUpTo52), "source");
        const readAllocUpTo53 = yield* readAllocUpTo(destinationHandle, 11);
        assert.strictEqual(decoder.decode(readAllocUpTo53), "destination");
      })
    );

    it.effect("should keep unlinked contents accessible when a file handle remains open", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const filePath = path("unlinked.txt");
        yield* fs.writeFileString(filePath, "content");
        const file = yield* fs.open(filePath, { flag: "r+" });

        yield* fs.remove(filePath);
        const exists54 = yield* fs.exists(filePath);
        assert.isFalse(exists54);
        const readAllocUpTo55 = yield* readAllocUpTo(file, 7);
        assert.strictEqual(decoder.decode(readAllocUpTo55), "content");
        assert.strictEqual((yield* file.stat).size, ByteSize.bytes(7));
      })
    );

    it.effect("should preserve the read cursor when appending through a handle", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const filePath = path("append-cursor.txt");
        const file = yield* fs.open(filePath, { flag: "a+" });

        yield* file.writeAll(encoder.encode("foo"));
        yield* file.seek(BigInt(0), "start");
        yield* file.writeAll(encoder.encode("bar"));
        const readAllocUpTo56 = yield* readAllocUpTo(file, 3);
        assert.strictEqual(decoder.decode(readAllocUpTo56), "foo");

        yield* file.writeAll(encoder.encode("baz"));
        const readAllocUpTo57 = yield* readAllocUpTo(file, 6);
        assert.strictEqual(decoder.decode(readAllocUpTo57), "barbaz");
        const readFileString58 = yield* fs.readFileString(filePath);
        assert.strictEqual(readFileString58, "foobarbaz");
      })
    );

    it.effect("should return the resulting cursor when seeking", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const file = yield* fs.open(path("seek-cursor.txt"), { flag: "w+" });

        const seek59 = yield* file.seek(BigInt(6), "start");
        assert.strictEqual(seek59, BigInt(6));
        const seek60 = yield* file.seek(BigInt(-2), "current");
        assert.strictEqual(seek60, BigInt(4));
      })
    );

    it.effect("should preserve or clamp a file-handle cursor based on the truncated length", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const filePath = path("truncate-cursor.txt");
        const file = yield* fs.open(filePath, { flag: "w+" });
        yield* file.writeAll(encoder.encode("lorem ipsum dolor sit amet"));

        yield* file.seek(BigInt(6), "start");
        yield* file.truncate(11);
        yield* file.writeAll(encoder.encode("!"));
        const readFileString61 = yield* fs.readFileString(filePath);
        assert.strictEqual(readFileString61, "lorem !psum");

        yield* file.truncate(5);
        yield* file.writeAll(encoder.encode("?"));
        const readFileString62 = yield* fs.readFileString(filePath);
        assert.strictEqual(readFileString62, "lorem?");
      })
    );

    it.effect("should read appended bytes from a cursor clamped by truncation", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const filePath = path("truncate-append-cursor.txt");
        const file = yield* fs.open(filePath, { flag: "w+" });

        yield* file.writeAll(encoder.encode("abcdefghij"));
        yield* file.truncate(5);
        yield* fs.writeFile(filePath, encoder.encode("xyz"), { flag: "a" });

        const readAllocUpTo63 = yield* readAllocUpTo(file, 3);
        assert.strictEqual(decoder.decode(readAllocUpTo63), "xyz");
      })
    );
  });

  describe("copy and rename", () => {
    it.effect("should preserve existing destinations when source-based mutations fail", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const missing = path("missing");
        const copyDestination = path("copy-destination.txt");
        const renameDestination = path("rename-destination.txt");
        yield* fs.writeFileString(copyDestination, "copy destination");
        yield* fs.writeFileString(renameDestination, "rename destination");

        const copyError = yield* Effect.flip(fs.copy(missing, copyDestination, { overwrite: true }));
        assertSystemError(copyError, { tag: "NotFound", method: "copy", pathOrDescriptor: missing });
        const renameError = yield* Effect.flip(fs.rename(missing, renameDestination));
        assertSystemError(renameError, { tag: "NotFound", method: "rename", pathOrDescriptor: missing });

        const readFileString64 = yield* fs.readFileString(copyDestination);
        assert.strictEqual(readFileString64, "copy destination");
        const readFileString65 = yield* fs.readFileString(renameDestination);
        assert.strictEqual(readFileString65, "rename destination");
      })
    );

    it.effect("should replace existing file destinations when copying or renaming files", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const copySource = path("copy-source.txt");
        const copyDestination = path("copy-destination.txt");
        const renameSource = path("rename-source.txt");
        const renameDestination = path("rename-destination.txt");
        yield* fs.writeFileString(copySource, "copied");
        yield* fs.writeFileString(copyDestination, "old copy");
        yield* fs.writeFileString(renameSource, "renamed");
        yield* fs.writeFileString(renameDestination, "old rename");

        yield* fs.copyFile(copySource, copyDestination);
        yield* fs.rename(renameSource, renameDestination);

        const readFileString66 = yield* fs.readFileString(copySource);
        assert.strictEqual(readFileString66, "copied");
        const readFileString67 = yield* fs.readFileString(copyDestination);
        assert.strictEqual(readFileString67, "copied");
        const exists68 = yield* fs.exists(renameSource);
        assert.isFalse(exists68);
        const readFileString69 = yield* fs.readFileString(renameDestination);
        assert.strictEqual(readFileString69, "renamed");
      })
    );

    it.effect("should preserve existing destination links and handles when copying file contents", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const source = path("copy-source.txt");
        const destination = path("copy-destination.txt");
        const alias = path("copy-destination-alias.txt");
        yield* fs.writeFileString(source, "source");
        yield* fs.writeFileString(destination, "destination");
        yield* fs.link(destination, alias);
        const destinationHandle = yield* fs.open(destination);

        yield* fs.copyFile(source, destination);

        const readFileString70 = yield* fs.readFileString(destination);
        assert.strictEqual(readFileString70, "source");
        const readFileString71 = yield* fs.readFileString(alias);
        assert.strictEqual(readFileString71, "source");
        const readAllocUpTo72 = yield* readAllocUpTo(destinationHandle, 6);
        assert.strictEqual(decoder.decode(readAllocUpTo72), "source");
      })
    );

    // TODO: Define whether overwrite: false succeeds without changing an existing destination or fails with AlreadyExists.
    // PORT NOTE: upstream asserted `pathOrDescriptor: source` here, matching an
    // upstream 6573 engine bug (the one conflict arm blaming the source). The
    // port fixes the engine to report the DESTINATION — the entry that
    // actually conflicts — so the conditional assertion names it. The node
    // adapter never enters this branch: node's `fs.cp` with `force: false`
    // silently preserves the destination instead of failing.
    it.effect("should preserve an existing copy destination when overwrite is false", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const source = path("copy-source.txt");
        const destination = path("copy-existing.txt");
        yield* fs.writeFileString(source, "source");
        yield* fs.writeFileString(destination, "destination");

        const result = yield* Effect.result(fs.copy(source, destination, { overwrite: false }));
        if (Result.isFailure(result)) {
          assertSystemError(result.failure, {
            tag: "AlreadyExists",
            method: "copy",
            pathOrDescriptor: destination,
          });
        }

        const readFileString73 = yield* fs.readFileString(source);
        assert.strictEqual(readFileString73, "source");
        const readFileString74 = yield* fs.readFileString(destination);
        assert.strictEqual(readFileString74, "destination");
      })
    );
  });

  describe("temporary resource lifecycle", () => {
    it.effect("should create uniquely named temporary resources when prefixes and suffixes are requested", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const firstDirectory = yield* fs.makeTempDirectory({ directory: path(), prefix: "directory-" });
        const secondDirectory = yield* fs.makeTempDirectory({ directory: path(), prefix: "directory-" });
        const firstFile = yield* fs.makeTempFile({ directory: path(), prefix: "file-", suffix: ".txt" });
        const secondFile = yield* fs.makeTempFile({ directory: path(), prefix: "file-", suffix: ".txt" });

        assert.notStrictEqual(firstDirectory, secondDirectory);
        assert.notStrictEqual(firstFile, secondFile);
        assert.isTrue(Str.startsWith(path("directory-"))(firstDirectory));
        assert.isTrue(Str.startsWith(path("directory-"))(secondDirectory));
        assert.isTrue(Str.startsWith(path("file-"))(firstFile) && Str.endsWith(".txt")(firstFile));
        assert.isTrue(Str.startsWith(path("file-"))(secondFile) && Str.endsWith(".txt")(secondFile));
      })
    );

    it.effect("should clean up scoped temporary resources when their scope fails", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const directory = yield* fs.makeTempDirectoryScoped({ directory: path(), prefix: "failed-" });
            yield* fs.writeFileString(`${directory}/file.txt`, "content");
            return yield* Effect.fail({ _tag: "ExpectedScopeFailure" as const, directory });
          })
        ).pipe(Effect.result);
        if (Result.isSuccess(result)) {
          return assert.fail("Expected the scoped operation to fail");
        }
        if (result.failure._tag === "PlatformError") {
          return yield* result.failure;
        }
        const directory = result.failure.directory;

        const error = yield* Effect.flip(fs.stat(directory));
        assertSystemError(error, { tag: "NotFound", method: "stat", pathOrDescriptor: directory });
      })
    );
  });

  describe("stream lifecycle", () => {
    it.effect("should stream no chunks when files are empty or offsets are beyond EOF", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const populated = path("populated.txt");
        const empty = path("empty.txt");
        yield* fs.writeFileString(populated, "content");
        yield* fs.writeFile(empty, new Uint8Array(0));

        const whole = yield* fs.stream(populated, { chunkSize: 2 }).pipe(Stream.runCollect);
        const emptyChunks = yield* fs.stream(empty).pipe(Stream.runCollect);
        const pastEnd = yield* fs.stream(populated, { offset: 20 }).pipe(Stream.runCollect);

        assert.strictEqual(
          A.join(
            A.map(whole, (d) => decoder.decode(d)),
            ""
          ),
          "content"
        );
        assert.strictEqual(emptyChunks.length, 0);
        assert.strictEqual(pastEnd.length, 0);
      })
    );

    it.effect("should preserve the original path when opening a file stream fails", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const missing = path("missing-stream.txt");

        const error = yield* fs.stream(missing).pipe(Stream.runDrain, Effect.flip);

        assertSystemError(error, { tag: "NotFound", method: "open", pathOrDescriptor: missing });
      })
    );

    // TODO: Add a deterministic synchronization point before covering stream and sink finalization after interruption.
    it.effect("should finalize derived stream and sink handles when their operations succeed or fail", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const streamed = path("finalized-stream.txt");
        const sunk = path("finalized-sink.txt");
        const failed = path("failed-sink.txt");
        const finalized = yield* Ref.make<Array<string>>([]);
        const trackedFs = FileSystem.make({
          ...fs,
          open: (path, options) =>
            Effect.acquireRelease(fs.open(path, options), () => Ref.update(finalized, (paths) => [...paths, path])),
        });
        yield* fs.writeFileString(streamed, "content");

        yield* trackedFs.stream(streamed).pipe(Stream.runDrain);
        yield* Stream.run(Stream.make(encoder.encode("content")), trackedFs.sink(sunk));
        const failedResult = yield* Stream.make(encoder.encode("content")).pipe(
          Stream.concat(Stream.fail("expected failure")),
          Stream.run(trackedFs.sink(failed)),
          Effect.exit
        );

        assertExitFailure(failedResult, Cause.fail("expected failure"));
        const got = yield* Ref.get(finalized);
        assert.deepStrictEqual(got, [streamed, sunk, failed]);
      })
    );
  });

  describe("adapter capabilities", () => {
    // TODO: Define the public working-directory contract. Decide separately whether the memory adapter defaults to virtual `/`.
    // it.effect("should resolve relative paths when the adapter working directory is defined", () => {})

    it.effect("should normalize missing-path errors when primitive path operations fail", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const missing = path("missing-primitive");
        const destination = path("destination");
        const operations = [
          ["chmod", fs.chmod(missing, 0o600)],
          ["chown", fs.chown(missing, 0, 0)],
          ["copy", fs.copy(missing, destination)],
          ["copyFile", fs.copyFile(missing, destination)],
          ["link", fs.link(missing, destination)],
          ["readDirectory", fs.readDirectory(missing)],
          ["readLink", fs.readLink(missing)],
          ["realPath", fs.realPath(missing)],
          ["rename", fs.rename(missing, destination)],
          ["stat", fs.stat(missing)],
          ["truncate", fs.truncate(missing)],
          // TODO: Decide whether FileSystem.utimes failures report `utimes` or the host's `utime`. Node reports `utime`.
          [undefined, fs.utimes(missing, 0, 0)],
        ] as const;

        for (const [method, operation] of operations) {
          const error = yield* Effect.flip(operation);
          assertSystemError(error, { tag: "NotFound", method, pathOrDescriptor: missing });
        }
      })
    );

    // TODO: Define what ok, readable, and writable mean for adapters without user identity or permission state.
    it.effect("should check readable and writable access when no virtual identity is available", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const existing = path("accessible.txt");
        const missing = path("inaccessible.txt");
        yield* fs.writeFileString(existing, "content");

        yield* fs.access(existing, { ok: true, readable: true, writable: true });
        const error = yield* Effect.flip(fs.access(missing, { ok: true, readable: true, writable: true }));

        assertSystemError(error, { tag: "NotFound", method: "access", pathOrDescriptor: missing });
      })
    );

    it.effect("should share contents and metadata when creating hard links", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const source = path("hard-link-source.txt");
        const linked = path("hard-link.txt");
        yield* fs.writeFileString(source, "source");

        yield* fs.link(source, linked);
        yield* fs.writeFileString(linked, "linked");

        const readFileString75 = yield* fs.readFileString(source);
        assert.strictEqual(readFileString75, "linked");
        const sourceInfo = yield* fs.stat(source);
        const linkedInfo = yield* fs.stat(linked);
        if (O.isSome(sourceInfo.ino) && O.isSome(linkedInfo.ino)) {
          assert.strictEqual(sourceInfo.ino.value, linkedInfo.ino.value);
        }
        if (O.isSome(sourceInfo.nlink)) {
          assert.strictEqual(sourceInfo.nlink.value, 2n);
        }
        if (O.isSome(linkedInfo.nlink)) {
          assert.strictEqual(linkedInfo.nlink.value, 2n);
        }
      })
    );

    it.effect("should preserve contents through remaining links and handles when hard links are removed", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const source = path("hard-link-lifecycle-source.txt");
        const alias = path("hard-link-lifecycle-alias.txt");
        yield* fs.writeFileString(source, "original");
        yield* fs.link(source, alias);
        const handle = yield* fs.open(source, { flag: "r+" });

        yield* fs.remove(source);

        const exists76 = yield* fs.exists(source);
        assert.isFalse(exists76);
        const readFileString77 = yield* fs.readFileString(alias);
        assert.strictEqual(readFileString77, "original");
        const linkedInfo = yield* fs.stat(alias);
        if (O.isSome(linkedInfo.nlink)) {
          assert.strictEqual(linkedInfo.nlink.value, 1n);
        }

        yield* fs.remove(alias);
        yield* fs.writeFileString(source, "replacement");
        yield* handle.seek(BigInt(0), "start");
        yield* handle.writeAll(encoder.encode("retained"));

        const readFileString78 = yield* fs.readFileString(source);
        assert.strictEqual(readFileString78, "replacement");
        yield* handle.seek(BigInt(0), "start");
        const readAllocUpTo79 = yield* readAllocUpTo(handle, 8);
        assert.strictEqual(decoder.decode(readAllocUpTo79), "retained");
      })
    );

    it.effect("should resolve symbolic links when targets are relative or absolute", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const target = path("target.txt");
        const relativeLink = path("relative-link.txt");
        const absoluteLink = path("absolute-link.txt");
        yield* fs.writeFileString(target, "content");

        yield* fs.symlink("target.txt", relativeLink);
        yield* fs.symlink(target, absoluteLink);

        const readLink80 = yield* fs.readLink(relativeLink);
        assert.strictEqual(readLink80, "target.txt");
        const readLink81 = yield* fs.readLink(absoluteLink);
        assert.strictEqual(readLink81, target);
        const realPath82 = yield* fs.realPath(relativeLink);
        const realPath87 = yield* fs.realPath(target);
        assert.strictEqual(realPath82, realPath87);
        const realPath83 = yield* fs.realPath(absoluteLink);
        const realPath88 = yield* fs.realPath(target);
        assert.strictEqual(realPath83, realPath88);
        const readFileString84 = yield* fs.readFileString(relativeLink);
        assert.strictEqual(readFileString84, "content");
        const readFileString85 = yield* fs.readFileString(absoluteLink);
        assert.strictEqual(readFileString85, "content");
      })
    );

    it.effect("should preserve error context when symbolic links form a loop", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const first = path("first-link");
        const second = path("second-link");
        yield* fs.symlink("second-link", first);
        yield* fs.symlink("first-link", second);

        const error = yield* Effect.flip(fs.realPath(first));

        assertSystemError(error, { method: "realPath", pathOrDescriptor: first });
      })
    );

    // TODO: Add positive chmod and chown conformance in a POSIX-only metadata capability suite.
    // it.effect("should change file permissions and ownership when POSIX metadata is supported", () => {})

    it.effect("should report updated access and modification timestamps when metadata is available", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const file = path("times.txt");
        const atime = DateTime.toDateUtc(DateTime.makeUnsafe("2001-02-03T04:05:06.000Z"));
        const mtime = DateTime.toDateUtc(DateTime.makeUnsafe("2002-03-04T05:06:07.000Z"));
        yield* fs.writeFileString(file, "content");

        yield* fs.utimes(file, atime, mtime);
        const info = yield* fs.stat(file);

        if (O.isSome(info.atime)) {
          assert.strictEqual(info.atime.value.getTime(), atime.getTime());
        }
        if (O.isSome(info.mtime)) {
          assert.strictEqual(info.mtime.value.getTime(), mtime.getTime());
        }
      })
    );

    // TODO: Define whether preserveTimestamps guarantees only mtime or both atime and mtime. Node preserves mtime but resets atime.
    it.effect("should preserve the modification timestamp when copying with metadata preservation", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const source = path("timestamp-source.txt");
        const destination = path("timestamp-copy.txt");
        const atime = DateTime.toDateUtc(DateTime.makeUnsafe("2001-02-03T04:05:06.000Z"));
        const mtime = DateTime.toDateUtc(DateTime.makeUnsafe("2002-03-04T05:06:07.000Z"));
        yield* fs.writeFileString(source, "content");
        yield* fs.utimes(source, atime, mtime);

        yield* fs.copy(source, destination, { preserveTimestamps: true });
        const info = yield* fs.stat(destination);

        if (O.isSome(info.mtime)) {
          assert.strictEqual(info.mtime.value.getTime(), mtime.getTime());
        }
      })
    );

    it.effect("should exclude matching entries when globbing from a root", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const root = path("glob");
        yield* fs.makeDirectory(`${root}/src`, { recursive: true });
        yield* fs.writeFileString(`${root}/src/index.ts`, "export {}");
        yield* fs.writeFileString(`${root}/src/index.test.ts`, "export {}");
        yield* fs.writeFileString(`${root}/src/readme.md`, "readme");

        const glob86 = yield* fs.glob("**/*.ts", {
          root,
          exclude: ["**/*.test.ts"],
        });
        const matches = A.map(glob86, (entry) => Str.replaceAll("\\", "/")(entry)).sort();

        assert.strictEqual(matches.length, 1);
        assert.isTrue((matches[0] === undefined ? undefined : Str.endsWith("src/index.ts")(matches[0])) === true);
      })
    );

    // TODO: Add deterministic watcher-registration and subscription-control hooks before specifying event ordering,
    // normalized paths, or watcher cleanup.
    // it.effect("should emit normalized events when watching registered paths", () => {})

    it.effect("should preserve error context when watching a missing path", () =>
      Effect.gen(function* () {
        const { fs, path } = yield* makeTestContext;
        const missing = path("missing-watch");

        const error = yield* fs.watch(missing).pipe(Stream.runDrain, Effect.flip);

        assertSystemError(error, { tag: "NotFound", method: "stat", pathOrDescriptor: missing });
      })
    );
  });
};

export const suite: {
  <E>(fsLayer: Layer.Layer<FileSystem.FileSystem, E>): (name: string) => void;
  <E>(name: string, fsLayer: Layer.Layer<FileSystem.FileSystem, E>): void;
} = dual(2, <E>(name: string, fsLayer: Layer.Layer<FileSystem.FileSystem, E>) =>
  layer(fsLayer, { timeout: { seconds: 30 } })(`FileSystem (${name})`, fileSystemCases)
);
