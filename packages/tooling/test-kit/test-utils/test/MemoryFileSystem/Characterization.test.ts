import * as Subject from "@beep/test-utils/MemoryFileSystem";
import { describe, it } from "@effect/vitest";
import { assertFalse, assertSome, assertTrue, deepStrictEqual, strictEqual } from "@effect/vitest/utils";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as Fs from "effect/FileSystem";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type * as PlatformError from "effect/PlatformError";

const assertPositionError = (error: PlatformError.PlatformError, method: string, fd: number): void => {
  strictEqual(error._tag, "PlatformError");
  assertTrue(error.reason._tag === "BadResource");
  strictEqual(error.reason.module, "FileSystem");
  strictEqual(error.reason.method, method);
  strictEqual(error.reason.pathOrDescriptor, fd);
  strictEqual(error.reason.description, "Invalid file position");
};

// These two cases prove sharing across test-body scopes. Sequence is local to
// this suite; all other tests remain independent of this deliberately shared file.
describe.sequential("ordered sharing characterization", () => {
  it.layer(Subject.layer)("same layer block", (it) => {
    it.effect(
      "01 writes a marker in one test body",
      Effect.fnUntraced(function* () {
        const fs = yield* Fs.FileSystem;
        assertFalse(yield* fs.exists("/block-marker.txt"));
        yield* fs.writeFileString("/block-marker.txt", "first body");
        strictEqual(yield* fs.readFileString("/block-marker.txt"), "first body");
      })
    );

    it.effect(
      "02 reads and updates the previous body's marker",
      Effect.fnUntraced(function* () {
        const fs = yield* Fs.FileSystem;
        strictEqual(yield* fs.readFileString("/block-marker.txt"), "first body");
        yield* fs.writeFileString("/block-marker.txt", "+second body", { flag: "a" });
        strictEqual(yield* fs.readFileString("/block-marker.txt"), "first body+second body");
      })
    );
  });
});

it.effect(
  "03 separate make acquisitions isolate observable files",
  Effect.fnUntraced(function* () {
    const first = yield* Subject.make;
    const second = yield* Subject.make;
    yield* first.writeFileString("/independent.txt", "first");
    assertFalse(yield* second.exists("/independent.txt"));
    yield* second.writeFileString("/independent.txt", "second");
    strictEqual(yield* first.readFileString("/independent.txt"), "first");
    strictEqual(yield* second.readFileString("/independent.txt"), "second");
  })
);

it.layer(Subject.layer)("public core characterization", (it) => {
  it.effect(
    "04 writes and reads own their byte buffers",
    Effect.fnUntraced(function* () {
      const fs = yield* Fs.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      const path = `${root}/bytes`;
      const backing = new Uint8Array([88, 65, 66, 67, 89]);
      const view = backing.subarray(1, 4);
      yield* fs.writeFile(path, view);
      backing.set([90, 90, 90], 1);
      deepStrictEqual(A.fromIterable(yield* fs.readFile(path)), [65, 66, 67]);
      const read = yield* fs.readFile(path);
      read.set([120, 121, 122]);
      strictEqual(yield* fs.readFileString(path), "ABC");
      const file = yield* fs.open(path, { flag: "r+" });
      const allocated = yield* file.readAlloc(2);
      assertSome(O.map(allocated, A.fromIterable), [65, 66]);
      yield* Effect.map(Effect.fromOption(allocated), (bytes) => bytes.set([1, 2]));
      strictEqual(yield* fs.readFileString(path), "ABC");
      yield* file.seek(0, "start");
      const replacement = new Uint8Array([68]);
      strictEqual(yield* file.write(replacement), Fs.Size(1));
      replacement.set([69]);
      strictEqual(yield* fs.readFileString(path), "DBC");
    })
  );

  it.effect(
    "05 hard links share inodes and bytes while copies do not",
    Effect.fnUntraced(function* () {
      const fs = yield* Fs.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      const source = `${root}/source`;
      const alias = `${root}/alias`;
      const copy = `${root}/copy`;
      yield* fs.writeFileString(source, "before");
      yield* fs.link(source, alias);
      yield* fs.copyFile(source, copy);
      const sourceInfo = yield* fs.stat(source);
      const sourceInode = yield* Effect.fromOption(sourceInfo.ino);
      assertSome((yield* fs.stat(alias)).ino, sourceInode);
      const copyInode = yield* Effect.fromOption((yield* fs.stat(copy)).ino);
      assertTrue(sourceInode !== copyInode);
      assertSome(sourceInfo.nlink, 2);
      assertSome((yield* fs.stat(copy)).nlink, 1);
      yield* fs.writeFileString(alias, "changed");
      strictEqual(yield* fs.readFileString(source), "changed");
      strictEqual(yield* fs.readFileString(copy), "before");
    })
  );

  it.effect(
    "06 fresh root tmp and file modes and owners are exact",
    Effect.fnUntraced(function* () {
      const fs = yield* Subject.make;
      for (const path of ["/", "/tmp"]) {
        const info = yield* fs.stat(path);
        strictEqual(info.type, "Directory");
        strictEqual(info.mode, 0o40755);
        assertSome(info.uid, 0);
        assertSome(info.gid, 0);
      }
      deepStrictEqual(yield* fs.readDirectory("/"), ["tmp"]);
      yield* fs.writeFileString("/default-file", "content");
      const info = yield* fs.stat("/default-file");
      strictEqual(info.type, "File");
      strictEqual(info.mode, 0o100644);
      assertSome(info.uid, 0);
      assertSome(info.gid, 0);
      assertSome(info.nlink, 1);
    })
  );

  it.effect(
    "07 signed seek defers errors and zero-length IO preserves the cursor",
    Effect.fnUntraced(function* () {
      const fs = yield* Subject.make;
      const root = yield* fs.makeTempDirectoryScoped();
      const path = `${root}/cursor`;
      yield* fs.writeFileString(path, "content");
      const file = yield* fs.open(path, { flag: "r+" });
      strictEqual(yield* file.seek(-1, "start"), Fs.Size(-1));
      strictEqual(yield* file.seek(-2, "current"), Fs.Size(-3));
      const output = new Uint8Array([99]);
      assertPositionError(yield* Effect.flip(file.read(output)), "read", 4);
      deepStrictEqual(A.fromIterable(output), [99]);
      assertPositionError(yield* Effect.flip(file.readAlloc(1)), "readAlloc", 4);
      assertPositionError(yield* Effect.flip(file.write(new Uint8Array([65]))), "write", 4);
      assertPositionError(yield* Effect.flip(file.writeAll(new Uint8Array([65]))), "writeAll", 4);
      strictEqual(yield* file.read(new Uint8Array()), Fs.Size(0));
      strictEqual(yield* file.write(new Uint8Array()), Fs.Size(0));
      strictEqual(yield* file.seek(0, "current"), Fs.Size(-3));
      strictEqual(yield* fs.readFileString(path), "content");
      strictEqual(yield* file.seek(0, "start"), Fs.Size(0));
      const recovered = yield* file.readAlloc(7);
      assertSome(
        O.map(recovered, (bytes) => new TextDecoder().decode(bytes)),
        "content"
      );
    })
  );

  it.effect(
    "08 mode and owner numeric boundaries preserve data on failure",
    Effect.fnUntraced(function* () {
      const fs = yield* Fs.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      const path = `${root}/metadata`;
      yield* fs.writeFileString(path, "content");
      for (const value of [-1, 1.5, 0x1_0000_0000, Number.NaN, Number.POSITIVE_INFINITY]) {
        const mode = yield* Effect.flip(fs.chmod(path, value));
        strictEqual(mode.reason._tag, "BadArgument");
        strictEqual(mode.reason.module, "FileSystem");
        strictEqual(mode.reason.method, "chmod");
        strictEqual(mode.reason.description, "mode must be an unsigned 32-bit integer");
        const owner = yield* Effect.flip(fs.chown(path, value, 0));
        strictEqual(owner.reason._tag, "BadArgument");
        strictEqual(owner.reason.module, "FileSystem");
        strictEqual(owner.reason.method, "chown");
        strictEqual(owner.reason.description, "uid must be an unsigned 32-bit integer");
        const group = yield* Effect.flip(fs.chown(path, 0, value));
        strictEqual(group.reason._tag, "BadArgument");
        strictEqual(group.reason.method, "chown");
        strictEqual(group.reason.description, "gid must be an unsigned 32-bit integer");
      }
      const unchanged = yield* fs.stat(path);
      strictEqual(unchanged.mode, 0o100644);
      assertSome(unchanged.uid, 0);
      assertSome(unchanged.gid, 0);
      strictEqual(yield* fs.readFileString(path), "content");
      yield* fs.chmod(path, 0xffff_ffff);
      strictEqual((yield* fs.stat(path)).mode, 0o107777);
      yield* fs.chown(path, 0xffff_ffff, 0xffff_ffff);
      assertSome((yield* fs.stat(path)).uid, 0xffff_ffff);
      assertSome((yield* fs.stat(path)).gid, 0xffff_ffff);
    })
  );

  it.effect(
    "09 recursive listing order differs from locale-ordered clone allocation",
    Effect.fnUntraced(function* () {
      const fs = yield* Fs.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      const source = `${root}/source`;
      yield* fs.makeDirectory(source);
      for (const directory of ["é", "a", "Z"]) {
        yield* fs.makeDirectory(`${source}/${directory}`);
        for (const file of ["é.txt", "a.txt", "Z.txt"]) {
          yield* fs.writeFileString(`${source}/${directory}/${file}`, file);
        }
      }
      deepStrictEqual(yield* fs.readDirectory(source, { recursive: true }), [
        "Z",
        "Z/Z.txt",
        "Z/a.txt",
        "Z/é.txt",
        "a",
        "a/Z.txt",
        "a/a.txt",
        "a/é.txt",
        "é",
        "é/Z.txt",
        "é/a.txt",
        "é/é.txt",
      ]);
      const destination = `${root}/copied`;
      yield* fs.copy(source, destination);
      const copiedRootInode = yield* Effect.fromOption((yield* fs.stat(destination)).ino);
      const relativeIds = yield* Effect.forEach(
        [
          "a",
          "a/a.txt",
          "a/é.txt",
          "a/Z.txt",
          "é",
          "é/a.txt",
          "é/é.txt",
          "é/Z.txt",
          "Z",
          "Z/a.txt",
          "Z/é.txt",
          "Z/Z.txt",
        ],
        Effect.fnUntraced(function* (path) {
          const inode = yield* Effect.fromOption((yield* fs.stat(`${destination}/${path}`)).ino);
          return inode - copiedRootInode;
        })
      );
      deepStrictEqual(relativeIds, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
      deepStrictEqual(yield* fs.glob("**/*.txt", { root: destination }), [
        "Z/Z.txt",
        "Z/a.txt",
        "Z/é.txt",
        "a/Z.txt",
        "a/a.txt",
        "a/é.txt",
        "é/Z.txt",
        "é/a.txt",
        "é/é.txt",
      ]);
    })
  );

  it.effect(
    "10 glob escapes and classes match literal names",
    Effect.fnUntraced(function* () {
      const fs = yield* Fs.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      for (const name of ["star*.txt", "ask?.txt", "a.txt", "b.txt", "c.txt", "-.txt", "back\\slash.txt"]) {
        yield* fs.writeFileString(`${root}/${name}`, name);
      }
      deepStrictEqual(yield* fs.glob("star\\*.txt", { root }), ["star*.txt"]);
      deepStrictEqual(yield* fs.glob("ask\\?.txt", { root }), ["ask?.txt"]);
      deepStrictEqual(yield* fs.glob("back\\\\slash.txt", { root }), ["back\\slash.txt"]);
      deepStrictEqual(yield* fs.glob("[a-b].txt", { root }), ["a.txt", "b.txt"]);
      deepStrictEqual(yield* fs.glob("[!a-b].txt", { root }), ["-.txt", "c.txt"]);
      deepStrictEqual(yield* fs.glob("[\\-].txt", { root }), ["-.txt"]);
    })
  );

  it.effect(
    "11 glob braces and explicit dot segments preserve hidden-file behavior",
    Effect.fnUntraced(function* () {
      const fs = yield* Fs.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      yield* fs.makeDirectory(`${root}/.hidden`);
      yield* fs.makeDirectory(`${root}/visible`);
      for (const path of [
        "a.txt",
        "b.txt",
        "c.md",
        ".dot.txt",
        ".hidden/secret.txt",
        "visible/.dot.txt",
        "visible/open.txt",
      ]) {
        yield* fs.writeFileString(`${root}/${path}`, path);
      }
      deepStrictEqual(yield* fs.glob("{a,{b,c}}.{txt,md}", { root }), ["a.txt", "b.txt", "c.md"]);
      deepStrictEqual(yield* fs.glob("**/*.txt", { root }), ["a.txt", "b.txt", "visible/open.txt"]);
      deepStrictEqual(yield* fs.glob(".*.txt", { root }), [".dot.txt"]);
      deepStrictEqual(yield* fs.glob("[.]dot.txt", { root }), [".dot.txt"]);
      deepStrictEqual(yield* fs.glob(".hidden/*.txt", { root }), [".hidden/secret.txt"]);
      deepStrictEqual(yield* fs.glob("**/.*.txt", { root }), [".dot.txt", "visible/.dot.txt"]);
    })
  );

  it.effect(
    "12 glob accepts 256 alternatives and rejects 257 without mutation",
    Effect.fnUntraced(function* () {
      const fs = yield* Fs.FileSystem;
      const root = yield* fs.makeTempDirectoryScoped();
      yield* fs.writeFileString(`${root}/item0.txt`, "zero");
      yield* fs.writeFileString(`${root}/item255.txt`, "last");
      const alternatives = A.makeBy(256, (index) => `item${index}`);
      deepStrictEqual(yield* fs.glob(`{${A.join(alternatives, ",")}}.txt`, { root }), ["item0.txt", "item255.txt"]);
      const error = yield* Effect.flip(fs.glob(`{${A.join(A.append(alternatives, "item256"), ",")}}.txt`, { root }));
      strictEqual(error.reason._tag, "BadArgument");
      strictEqual(error.reason.module, "FileSystem");
      strictEqual(error.reason.method, "glob");
      strictEqual(error.reason.description, "brace expansion exceeds 256 alternatives");
      const nested = `${Str.repeat(257)("{")}item0${Str.repeat(257)("}")}.txt`;
      const depth = yield* Effect.flip(fs.glob(nested, { root }));
      strictEqual(depth.reason._tag, "BadArgument");
      strictEqual(depth.reason.method, "glob");
      strictEqual(depth.reason.description, "brace nesting exceeds 256 levels");
      deepStrictEqual(yield* fs.readDirectory(root), ["item0.txt", "item255.txt"]);
      strictEqual(yield* fs.readFileString(`${root}/item0.txt`), "zero");
      strictEqual(yield* fs.readFileString(`${root}/item255.txt`), "last");
    })
  );
});
