import * as Subject from "@beep/test-utils/MemoryFileSystem";
import { assert, it } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Deferred from "effect/Deferred";
import * as Fiber from "effect/Fiber";
import * as Fs from "effect/FileSystem";
import * as O from "effect/Option";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import type * as PlatformError from "effect/PlatformError";

const encoder = new TextEncoder();
const decode = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

const assertFailure = (
  error: PlatformError.PlatformError,
  tag: PlatformError.SystemErrorTag,
  method: string,
  path: string | number
): void => {
  assert.strictEqual(error.reason._tag, tag);
  assert(error.reason._tag !== "BadArgument");
  assert.strictEqual(error.reason.module, "FileSystem");
  assert.strictEqual(error.reason.method, method);
  assert.strictEqual(error.reason.pathOrDescriptor, path);
};

const assertDescriptorFailure = (error: PlatformError.PlatformError, method: string): void => {
  assert(error.reason._tag === "BadResource");
  assert.strictEqual(error.reason.module, "FileSystem");
  assert.strictEqual(error.reason.method, method);
  assert.isNumber(error.reason.pathOrDescriptor);
};

const assertArgument = (error: PlatformError.PlatformError, method: string): void => {
  assert.strictEqual(error.reason._tag, "BadArgument");
  assert.strictEqual(error.reason.module, "FileSystem");
  assert.strictEqual(error.reason.method, method);
};

// Each use acquires a separate namespace in the current test's resource scope.
const testDirectory = Effect.gen(function* () {
  const fs = yield* Fs.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped();
  return { fs, root };
});

it.layer(Subject.layer)("MemoryFileSystem public operation boundaries", (it) => {
  it.effect(
    "rejects reads and writes after seeking beyond safe numeric positions",
    Effect.fnUntraced(function* () {
      const { fs, root } = yield* testDirectory;
      const path = `${root}/position`;
      yield* fs.writeFileString(path, "unchanged");
      const file = yield* fs.open(path, { flag: "r+" });
      yield* file.seek(BigInt(Number.MAX_SAFE_INTEGER) + 1n, "start");
      assertDescriptorFailure(yield* Effect.flip(file.read(new Uint8Array(1))), "read");
      assertDescriptorFailure(yield* Effect.flip(file.write(encoder.encode("x"))), "write");
      assert.strictEqual(yield* fs.readFileString(path), "unchanged");
    })
  );

  it.effect(
    "copy clones symbolic links and merges trees without removing destination-only entries",
    Effect.fnUntraced(function* () {
      const { fs, root } = yield* testDirectory;
      const source = `${root}/source`;
      const destination = `${root}/destination`;
      yield* fs.makeDirectory(`${source}/nested`, { recursive: true });
      yield* fs.writeFileString(`${source}/nested/shared`, "new");
      yield* fs.writeFileString(`${source}/added`, "added");
      yield* fs.symlink("nested/shared", `${source}/alias`);
      yield* fs.chmod(`${source}/nested/shared`, 0o640);
      yield* fs.copy(source, destination);
      assert.strictEqual(yield* fs.readLink(`${destination}/alias`), "nested/shared");
      assert.strictEqual((yield* fs.stat(`${destination}/nested/shared`)).mode, 0o100640);
      yield* fs.writeFileString(`${destination}/nested/shared`, "old");
      yield* fs.writeFileString(`${destination}/nested/kept`, "keep");
      yield* fs.remove(`${destination}/added`);
      yield* fs.copy(source, destination, { overwrite: true });
      assert.strictEqual(yield* fs.readFileString(`${destination}/nested/shared`), "new");
      assert.strictEqual(yield* fs.readFileString(`${destination}/nested/kept`), "keep");
      assert.strictEqual(yield* fs.readFileString(`${destination}/added`), "added");
      assert.strictEqual(yield* fs.readLink(`${destination}/alias`), "nested/shared");
      yield* fs.writeFileString(`${source}/nested/shared`, "source changed");
      assert.strictEqual(yield* fs.readFileString(`${destination}/alias`), "new");
    })
  );

  it.effect(
    "copy validates nested file-directory conflicts before changing any destination bytes",
    Effect.fnUntraced(function* () {
      const { fs, root } = yield* testDirectory;
      const source = `${root}/source`;
      const destination = `${root}/destination`;
      yield* fs.makeDirectory(`${source}/z-conflict`, { recursive: true });
      yield* fs.makeDirectory(destination);
      yield* fs.writeFileString(`${source}/a-first`, "new");
      yield* fs.writeFileString(`${destination}/a-first`, "old");
      yield* fs.writeFileString(`${destination}/z-conflict`, "keep");
      assertFailure(
        yield* Effect.flip(fs.copy(source, destination, { overwrite: true })),
        "BadResource",
        "copy",
        destination
      );
      assert.strictEqual(yield* fs.readFileString(`${destination}/a-first`), "old");
      assert.strictEqual(yield* fs.readFileString(`${destination}/z-conflict`), "keep");
      assert.deepStrictEqual(yield* fs.readDirectory(`${source}/z-conflict`), []);
      yield* fs.remove(`${source}/z-conflict`);
      yield* fs.writeFileString(`${source}/z-conflict`, "file");
      yield* fs.remove(`${destination}/z-conflict`);
      yield* fs.makeDirectory(`${destination}/z-conflict`);
      assertFailure(
        yield* Effect.flip(fs.copy(source, destination, { overwrite: true })),
        "BadResource",
        "copy",
        destination
      );
      assert.strictEqual(yield* fs.readFileString(`${destination}/a-first`), "old");
      assert.deepStrictEqual(yield* fs.readDirectory(`${destination}/z-conflict`), []);
    })
  );

  it.effect(
    "copy rejects top-level type conflicts, self copies and copying into a descendant atomically",
    Effect.fnUntraced(function* () {
      const { fs, root } = yield* testDirectory;
      const file = `${root}/file`;
      const tree = `${root}/tree`;
      yield* fs.writeFileString(file, "keep");
      yield* fs.makeDirectory(`${tree}/child`, { recursive: true });
      assertFailure(yield* Effect.flip(fs.copy(tree, file, { overwrite: true })), "BadResource", "copy", file);
      assertFailure(yield* Effect.flip(fs.copy(file, tree, { overwrite: true })), "BadResource", "copy", tree);
      assertFailure(yield* Effect.flip(fs.copy(tree, tree, { overwrite: true })), "BadResource", "copy", tree);
      assertFailure(
        yield* Effect.flip(fs.copy(tree, `${tree}/child/copy`)),
        "BadResource",
        "copy",
        `${tree}/child/copy`
      );
      assertFailure(
        yield* Effect.flip(fs.copy(`${root}/missing`, `${root}/absent`)),
        "NotFound",
        "copy",
        `${root}/missing`
      );
      yield* fs.link(file, `${root}/alias`);
      yield* fs.copy(file, `${root}/alias`, { overwrite: true });
      assert.strictEqual(yield* fs.readFileString(file), "keep");
      assertSome((yield* fs.stat(file)).nlink, 2);
      assert.deepStrictEqual(yield* fs.readDirectory(tree), ["child"]);
      assert.isFalse(yield* fs.exists(`${root}/absent`));
    })
  );

  it.effect(
    "copy replacement detaches the old inode while an open handle can still read it",
    Effect.fnUntraced(function* () {
      const { fs, root } = yield* testDirectory;
      const source = `${root}/source`;
      const destination = `${root}/destination`;
      yield* fs.writeFileString(source, "new");
      yield* fs.writeFileString(destination, "old");
      const old = yield* fs.open(destination);
      const oldInode = yield* Effect.fromOption((yield* old.stat).ino);
      yield* fs.copy(source, destination, { overwrite: true });
      assert.strictEqual(yield* fs.readFileString(destination), "new");
      assertSome(O.map(yield* old.readAlloc(3), decode), "old");
      assertSome((yield* old.stat).nlink, 0);
      assert.notStrictEqual(yield* Effect.fromOption((yield* fs.stat(destination)).ino), oldInode);
    })
  );

  it.effect(
    "copyFile overwrites the existing inode and follows live and dangling destination links",
    Effect.fnUntraced(function* () {
      const { fs, root } = yield* testDirectory;
      const source = `${root}/source`;
      const target = `${root}/target`;
      yield* fs.writeFileString(source, "new");
      yield* fs.chmod(source, 0o600);
      yield* fs.writeFileString(target, "old");
      yield* fs.link(target, `${root}/hard`);
      yield* fs.symlink("target", `${root}/live`);
      const inode = yield* Effect.fromOption((yield* fs.stat(target)).ino);
      yield* fs.copyFile(source, `${root}/live`);
      assert.strictEqual(yield* fs.readFileString(`${root}/hard`), "new");
      assertSome((yield* fs.stat(target)).ino, inode);
      assert.strictEqual((yield* fs.stat(target)).mode, 0o100600);
      yield* fs.copyFile(target, `${root}/hard`);
      assertSome((yield* fs.stat(target)).nlink, 2);
      yield* fs.symlink("relative-target", `${root}/relative`);
      yield* fs.symlink(`${root}/absolute-target`, `${root}/absolute`);
      yield* fs.copyFile(source, `${root}/relative`);
      yield* fs.copyFile(source, `${root}/absolute`);
      assert.strictEqual(yield* fs.readFileString(`${root}/relative-target`), "new");
      assert.strictEqual(yield* fs.readFileString(`${root}/absolute-target`), "new");
      assert.strictEqual(yield* fs.readLink(`${root}/relative`), "relative-target");
      assert.strictEqual(yield* fs.readLink(`${root}/absolute`), `${root}/absolute-target`);
    })
  );

  it.effect(
    "copyFile attributes invalid sources and destinations without changing existing data",
    Effect.fnUntraced(function* () {
      const { fs, root } = yield* testDirectory;
      const file = `${root}/file`;
      const directory = `${root}/directory`;
      yield* fs.writeFileString(file, "keep");
      yield* fs.makeDirectory(directory);
      assertFailure(
        yield* Effect.flip(fs.copyFile(`${root}/missing`, file)),
        "NotFound",
        "copyFile",
        `${root}/missing`
      );
      assertFailure(yield* Effect.flip(fs.copyFile(directory, file)), "BadResource", "copyFile", directory);
      assertFailure(yield* Effect.flip(fs.copyFile(file, directory)), "BadResource", "copyFile", directory);
      assertFailure(
        yield* Effect.flip(fs.copyFile(file, `${root}/absent/child`)),
        "NotFound",
        "copyFile",
        `${root}/absent/child`
      );
      assertFailure(yield* Effect.flip(fs.copyFile(file, `${file}/child`)), "BadResource", "copyFile", `${file}/child`);
      yield* fs.symlink("cycle", `${root}/cycle`);
      assertFailure(yield* Effect.flip(fs.copyFile(file, `${root}/cycle`)), "BadResource", "copyFile", `${root}/cycle`);
      assert.strictEqual(yield* fs.readFileString(file), "keep");
      assert.deepStrictEqual(yield* fs.readDirectory(directory), []);
      assert.isFalse(yield* fs.exists(`${root}/absent`));
    })
  );

  it.effect(
    "rename replaces files and empty directories across parents while preserving open victims",
    Effect.fnUntraced(function* () {
      const { fs, root } = yield* testDirectory;
      yield* fs.makeDirectory(`${root}/left/subtree`, { recursive: true });
      yield* fs.makeDirectory(`${root}/right/empty`, { recursive: true });
      yield* fs.writeFileString(`${root}/left/source`, "new");
      yield* fs.writeFileString(`${root}/right/victim`, "old");
      yield* fs.writeFileString(`${root}/left/subtree/child`, "nested");
      const victim = yield* fs.open(`${root}/right/victim`);
      const sourceInode = yield* Effect.fromOption((yield* fs.stat(`${root}/left/source`)).ino);
      yield* fs.rename(`${root}/left/source`, `${root}/right/victim`);
      assertSome((yield* fs.stat(`${root}/right/victim`)).ino, sourceInode);
      assert.strictEqual(yield* fs.readFileString(`${root}/right/victim`), "new");
      assertSome(O.map(yield* victim.readAlloc(3), decode), "old");
      assertSome((yield* victim.stat).nlink, 0);
      yield* fs.rename(`${root}/left/subtree`, `${root}/right/empty`);
      assert.strictEqual(yield* fs.readFileString(`${root}/right/empty/child`), "nested");
      assertSome((yield* fs.stat(`${root}/left`)).nlink, 2);
      assertSome((yield* fs.stat(`${root}/right`)).nlink, 3);
      assert.deepStrictEqual(yield* fs.readDirectory(`${root}/left`), []);
    })
  );

  it.effect(
    "rename failures preserve both trees and normalized self rename is a no-op",
    Effect.fnUntraced(function* () {
      const { fs, root } = yield* testDirectory;
      const file = `${root}/file`;
      const source = `${root}/source`;
      const occupied = `${root}/occupied`;
      yield* fs.writeFileString(file, "keep");
      yield* fs.makeDirectory(`${source}/child`, { recursive: true });
      yield* fs.makeDirectory(occupied);
      yield* fs.writeFileString(`${occupied}/kept`, "old");
      assertFailure(yield* Effect.flip(fs.rename(source, file)), "BadResource", "rename", file);
      assertFailure(yield* Effect.flip(fs.rename(file, source)), "BadResource", "rename", source);
      assertFailure(yield* Effect.flip(fs.rename(source, occupied)), "BadResource", "rename", occupied);
      assertFailure(
        yield* Effect.flip(fs.rename(source, `${source}/child/moved`)),
        "BadResource",
        "rename",
        `${source}/child/moved`
      );
      yield* fs.rename(file, `${root}/./file`);
      assert.strictEqual(yield* fs.readFileString(file), "keep");
      assert.strictEqual(yield* fs.readFileString(`${occupied}/kept`), "old");
      assert.deepStrictEqual(yield* fs.readDirectory(source), ["child"]);
    })
  );

  it.effect(
    "link and symlink reject invalid names, occupied destinations and directories atomically",
    Effect.fnUntraced(function* () {
      const { fs, root } = yield* testDirectory;
      const file = `${root}/file`;
      yield* fs.writeFileString(file, "keep");
      assertFailure(
        yield* Effect.flip(fs.link(root, `${root}/directory-link`)),
        "PermissionDenied",
        "link",
        `${root}/directory-link`
      );
      assertFailure(
        yield* Effect.flip(fs.link(`${root}/missing`, `${root}/link`)),
        "NotFound",
        "link",
        `${root}/missing`
      );
      assertFailure(yield* Effect.flip(fs.link(file, file)), "AlreadyExists", "link", file);
      assertFailure(yield* Effect.flip(fs.link(file, `${root}/.`)), "InvalidData", "link", `${root}/.`);
      assertFailure(yield* Effect.flip(fs.link(file, `${file}/child`)), "BadResource", "link", `${file}/child`);
      assertFailure(yield* Effect.flip(fs.symlink("other", file)), "AlreadyExists", "symlink", file);
      assertArgument(yield* Effect.flip(fs.symlink("bad\0target", `${root}/bad`)), "symlink");
      assertSome((yield* fs.stat(file)).nlink, 1);
      assert.strictEqual(yield* fs.readFileString(file), "keep");
      assert.deepStrictEqual(yield* fs.readDirectory(root), ["file"]);
    })
  );

  it.effect(
    "path resolution follows absolute links and rejects cycles and wrong node kinds",
    Effect.fnUntraced(function* () {
      const { fs, root } = yield* testDirectory;
      const file = `${root}/file`;
      yield* fs.writeFileString(file, "keep");
      yield* fs.symlink(file, `${root}/absolute`);
      assert.strictEqual(yield* fs.realPath(`${root}/absolute`), file);
      assert.strictEqual(yield* fs.readFileString(`${root}/absolute`), "keep");
      yield* fs.symlink("loop", `${root}/loop`);
      assertFailure(yield* Effect.flip(fs.realPath(`${root}/loop`)), "BadResource", "realPath", `${root}/loop`);
      assertFailure(yield* Effect.flip(fs.readLink(file)), "BadResource", "readLink", file);
      assertFailure(yield* Effect.flip(fs.readDirectory(file)), "BadResource", "readDirectory", file);
      assertFailure(yield* Effect.flip(fs.readFile(root)), "BadResource", "readFile", root);
      assertFailure(yield* Effect.flip(fs.truncate(root)), "BadResource", "truncate", root);
      assertFailure(yield* Effect.flip(fs.makeDirectory(file)), "AlreadyExists", "makeDirectory", file);
      assertFailure(yield* Effect.flip(fs.makeDirectory(root)), "AlreadyExists", "makeDirectory", root);
      yield* fs.remove(`${root}/missing`, { force: true });
      assertFailure(yield* Effect.flip(fs.remove(root)), "BadResource", "remove", root);
      for (const invalid of ["", "/", `${root}/trailing/`, "bad\0name"]) {
        assertFailure(yield* Effect.flip(fs.link(file, invalid)), "BadResource", "link", invalid);
      }
      assertFailure(yield* Effect.flip(fs.stat("")), "NotFound", "stat", "");
      assertFailure(yield* Effect.flip(fs.readFile("bad\0name")), "NotFound", "readFile", "bad\0name");
      assert.strictEqual(yield* fs.readFileString(file), "keep");
    })
  );

  it.effect(
    "open creates dangling symlink targets but preserves links on read and cycle failures",
    Effect.fnUntraced(function* () {
      const { fs, root } = yield* testDirectory;
      yield* fs.symlink("target", `${root}/relative`);
      assertFailure(yield* Effect.flip(fs.open(`${root}/relative`)), "NotFound", "open", `${root}/relative`);
      const relative = yield* fs.open(`${root}/relative`, { flag: "w", mode: 0o620 });
      yield* relative.writeAll(encoder.encode("relative"));
      assert.strictEqual((yield* fs.stat(`${root}/target`)).mode, 0o100620);
      yield* fs.symlink(`${root}/absolute-target`, `${root}/absolute`);
      const absolute = yield* fs.open(`${root}/absolute`, { flag: "a+" });
      yield* absolute.writeAll(encoder.encode("absolute"));
      assert.strictEqual(yield* fs.readFileString(`${root}/absolute-target`), "absolute");
      assert.strictEqual(yield* fs.readLink(`${root}/relative`), "target");
      yield* fs.symlink("cycle", `${root}/cycle`);
      assertFailure(
        yield* Effect.flip(fs.open(`${root}/cycle`, { flag: "w" })),
        "BadResource",
        "open",
        `${root}/cycle`
      );
      assertFailure(yield* Effect.flip(fs.open(`${root}/missing`)), "NotFound", "open", `${root}/missing`);
      assertFailure(yield* Effect.flip(fs.open(root, { flag: "w" })), "BadResource", "open", root);
      assertFailure(
        yield* Effect.flip(fs.open(`${root}/target/child`, { flag: "w" })),
        "BadResource",
        "open",
        `${root}/target/child`
      );
      assert.strictEqual(yield* fs.readFileString(`${root}/target`), "relative");
    })
  );

  it.effect(
    "exclusive create flags fail without truncating a previously created file",
    Effect.fnUntraced(function* () {
      const { fs, root } = yield* testDirectory;
      const flags: ReadonlyArray<Fs.OpenFlag> = ["wx", "wx+", "ax", "ax+"];
      for (const flag of flags) {
        const path = `${root}/${flag}`;
        const file = yield* fs.open(path, { flag, mode: 0o600 });
        yield* file.writeAll(encoder.encode("keep"));
        assertFailure(yield* Effect.flip(fs.open(path, { flag })), "AlreadyExists", "open", path);
        assert.strictEqual(yield* fs.readFileString(path), "keep");
        assert.strictEqual((yield* fs.stat(path)).mode, 0o100600);
      }
    })
  );

  it.effect(
    "read-only and write-only descriptors reject incompatible IO without advancing or changing buffers",
    Effect.fnUntraced(function* () {
      const { fs, root } = yield* testDirectory;
      const path = `${root}/file`;
      yield* fs.writeFileString(path, "abc");
      const readOnly = yield* fs.open(path);
      assertDescriptorFailure(yield* Effect.flip(readOnly.write(encoder.encode("x"))), "write");
      assertDescriptorFailure(yield* Effect.flip(readOnly.writeAll(encoder.encode("x"))), "writeAll");
      assertDescriptorFailure(yield* Effect.flip(readOnly.truncate()), "truncate");
      assert.strictEqual(yield* readOnly.seek(BigInt(0), "current"), BigInt(0));
      assertSome(O.map(yield* readOnly.readAlloc(3), decode), "abc");
      yield* readOnly.sync;
      const appendOnly = yield* fs.open(path, { flag: "a" });
      const output = new Uint8Array([99]);
      assertDescriptorFailure(yield* Effect.flip(appendOnly.read(output)), "read");
      assertDescriptorFailure(yield* Effect.flip(appendOnly.readAlloc(1)), "readAlloc");
      assert.deepStrictEqual(A.fromIterable(output), [99]);
      assert.strictEqual(yield* appendOnly.seek(BigInt(0), "current"), BigInt(0));
      assert.strictEqual(yield* appendOnly.write(encoder.encode("!")), 1);
      assert.strictEqual(yield* fs.readFileString(path), "abc!");
      const readWrite = yield* fs.open(path, { flag: "r+" });
      yield* readWrite.writeAll(encoder.encode("A"));
      const appendRead = yield* fs.open(path, { flag: "a+" });
      yield* appendRead.writeAll(encoder.encode("?"));
      assertSome(O.map(yield* appendRead.readAlloc(1), decode), "A");
      assert.strictEqual(yield* fs.readFileString(path), "Abc!?");
    })
  );

  it.effect(
    "unlinked open files retain bytes and metadata until the test-owned handle scope closes",
    Effect.fnUntraced(function* () {
      const { fs, root } = yield* testDirectory;
      const path = `${root}/file`;
      yield* fs.writeFileString(path, "abc");
      yield* fs.link(path, `${root}/alias`);
      const file = yield* Effect.scoped(
        Effect.gen(function* () {
          const file = yield* fs.open(path, { flag: "r+" });
          yield* fs.remove(path);
          assertSome((yield* file.stat).nlink, 1);
          yield* fs.remove(`${root}/alias`);
          assertSome((yield* file.stat).nlink, 0);
          assertSome(O.map(yield* file.readAlloc(3), decode), "abc");
          yield* file.seek(BigInt(5), "start");
          yield* file.writeAll(encoder.encode("Z"));
          assert.strictEqual((yield* file.stat).size, BigInt(6));
          yield* file.seek(BigInt(0), "start");
          assertSome(O.map(yield* file.readAlloc(6), A.fromIterable), [97, 98, 99, 0, 0, 90]);
          yield* file.sync;
          return file;
        })
      );
      assert.isFalse(yield* fs.exists(path));
      assert.isFalse(yield* fs.exists(`${root}/alias`));
      assertDescriptorFailure(yield* Effect.flip(file.stat), "stat");
      assertDescriptorFailure(yield* Effect.flip(file.sync), "sync");
      assertDescriptorFailure(yield* Effect.flip(file.writeAll(encoder.encode("x"))), "writeAll");
      assertDescriptorFailure(yield* Effect.flip(file.truncate()), "truncate");
    })
  );

  it.effect(
    "read allocation and truncation failures preserve bytes and descriptor progress",
    Effect.fnUntraced(function* () {
      const { fs, root } = yield* testDirectory;
      const path = `${root}/file`;
      yield* fs.writeFileString(path, "abc");
      const file = yield* fs.open(path, { flag: "r+" });
      yield* file.seek(BigInt(1), "start");
      assertSome(O.map(yield* file.readAlloc(10), decode), "bc");
      assert.strictEqual(yield* file.seek(BigInt(0), "current"), BigInt(3));
      yield* file.seek(BigInt(1), "start");
      for (const size of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
        assertArgument(yield* Effect.flip(file.readAlloc(size)), "readAlloc");
      }
      // This valid safe-integer request exceeds the runtime's typed-array limit;
      // it fails before reserving a backing store, without simulating memory state.
      assertDescriptorFailure(yield* Effect.flip(file.readAlloc(Number.MAX_SAFE_INTEGER)), "readAlloc");
      assertDescriptorFailure(yield* Effect.flip(file.truncate(Number.MAX_SAFE_INTEGER)), "truncate");
      assertFailure(yield* Effect.flip(fs.truncate(path, Number.MAX_SAFE_INTEGER)), "BadResource", "truncate", path);
      assert.strictEqual(yield* file.seek(BigInt(0), "current"), BigInt(1));
      assert.strictEqual(yield* fs.readFileString(path), "abc");
      assertArgument(yield* Effect.flip(fs.writeFileString(path, "replacement", { mode: -1 })), "writeFile");
      assert.strictEqual(yield* fs.readFileString(path), "abc");
      yield* file.truncate();
      assert.strictEqual((yield* file.stat).size, BigInt(0));
      assert.strictEqual(yield* file.seek(BigInt(0), "current"), BigInt(0));
      assert.isTrue(O.isNone(yield* file.readAlloc(1)));
    })
  );

  it.effect(
    "temporary resources honor prefixes and suffixes and tolerate explicit removal before finalization",
    Effect.fnUntraced(function* () {
      const { fs, root } = yield* testDirectory;
      const file = yield* Effect.scoped(
        Effect.gen(function* () {
          const path = yield* fs.makeTempFileScoped({ directory: root, prefix: "owned-", suffix: ".txt" });
          assert.isTrue(Str.startsWith(`${root}/owned-`)(path));
          assert.isTrue(Str.endsWith(".txt")(path));
          yield* fs.writeFileString(path, "temporary");
          assert.strictEqual(yield* fs.readFileString(path), "temporary");
          yield* fs.remove(path);
          return path;
        })
      );
      assert.isFalse(yield* fs.exists(file));
      assert.deepStrictEqual(yield* fs.readDirectory(root), []);
      const directory = yield* Effect.scoped(
        Effect.gen(function* () {
          const path = yield* fs.makeTempDirectoryScoped({ directory: root, prefix: "dir-" });
          yield* fs.remove(path);
          return path;
        })
      );
      assert.isFalse(yield* fs.exists(directory));
    })
  );

  it.effect(
    "temporary creation validates fragments and parent kinds without leaving partial directories",
    Effect.fnUntraced(function* () {
      const { fs, root } = yield* testDirectory;
      const parent = `${root}/file`;
      yield* fs.writeFileString(parent, "keep");
      assertFailure(
        yield* Effect.flip(fs.makeTempDirectory({ directory: parent })),
        "BadResource",
        "makeTempDirectory",
        parent
      );
      assertFailure(yield* Effect.flip(fs.makeTempFile({ directory: parent })), "BadResource", "makeTempFile", parent);
      assertFailure(
        yield* Effect.flip(fs.makeTempFile({ directory: `${root}/missing` })),
        "NotFound",
        "makeTempFile",
        `${root}/missing`
      );
      for (const fragment of ["bad/name", "bad\0name"]) {
        assertArgument(
          yield* Effect.flip(fs.makeTempDirectory({ directory: root, prefix: fragment })),
          "makeTempDirectory"
        );
        assertArgument(yield* Effect.flip(fs.makeTempFile({ directory: root, suffix: fragment })), "makeTempFile");
      }
      assert.deepStrictEqual(yield* fs.readDirectory(root), ["file"]);
      assert.strictEqual(yield* fs.readFileString(parent), "keep");
    })
  );

  it.effect(
    "utimes validates both epoch numbers and Date inputs before mutating either timestamp",
    Effect.fnUntraced(function* () {
      const { fs, root } = yield* testDirectory;
      const path = `${root}/file`;
      yield* fs.writeFileString(path, "keep");
      yield* fs.symlink("file", `${root}/alias`);
      yield* fs.chmod(`${root}/alias`, 0o640);
      yield* fs.chown(`${root}/alias`, 12, 34);
      yield* fs.utimes(`${root}/alias`, 1.25, DateTime.toDateUtc(DateTime.makeUnsafe(2500)));
      const before = yield* fs.stat(path);
      assertSome(before.atime, DateTime.toDateUtc(DateTime.makeUnsafe(1250)));
      assertSome(before.mtime, DateTime.toDateUtc(DateTime.makeUnsafe(2500)));
      assertSome(before.uid, 12);
      assertSome(before.gid, 34);
      assert.strictEqual(before.mode, 0o100640);
      const invalidDate = DateTime.toDateUtc(DateTime.makeUnsafe(0));
      invalidDate.setTime(Number.NaN);
      for (const value of [Number.NaN, Number.POSITIVE_INFINITY, 9e12, invalidDate]) {
        assertArgument(yield* Effect.flip(fs.utimes(path, value, 4)), "utimes");
        assertArgument(yield* Effect.flip(fs.utimes(path, 3, value)), "utimes");
        assert.deepStrictEqual(yield* fs.stat(path), before);
      }
      assert.strictEqual(yield* fs.readFileString(path), "keep");
    })
  );

  it.effect(
    "glob question marks, exclusions and comma-free nested braces select only matching public paths",
    Effect.fnUntraced(function* () {
      const { fs, root } = yield* testDirectory;
      yield* fs.makeDirectory(`${root}/dir`);
      for (const name of ["a.txt", "ab.txt", "b.txt", ".x.txt", "{a}.txt", "{b}.txt", "literal{", "{solo}"]) {
        yield* fs.writeFileString(`${root}/${name}`, name);
      }
      yield* fs.writeFileString(`${root}/dir/a.txt`, "nested");
      assert.deepStrictEqual(yield* fs.glob("?.txt", { root }), ["a.txt", "b.txt"]);
      assert.deepStrictEqual(
        yield* fs.glob("**/*.txt", { root, exclude: ["**/a.txt", "{ab,b}.txt", "{\\{a\\},\\{b\\}}.txt"] }),
        []
      );
      assert.deepStrictEqual(yield* fs.glob("{{a,b}}.txt", { root }), ["{a}.txt", "{b}.txt"]);
      assert.deepStrictEqual(yield* fs.glob("literal{", { root }), ["literal{"]);
      assert.deepStrictEqual(yield* fs.glob("{solo}", { root }), ["{solo}"]);
      assert.deepStrictEqual(yield* fs.glob("dir/", { root }), ["dir"]);
      assertFailure(
        yield* Effect.flip(fs.glob("*", { root: `${root}/a.txt` })),
        "BadResource",
        "glob",
        `${root}/a.txt`
      );
    })
  );

  it.effect(
    "invalid glob syntax reports typed argument errors without changing the directory",
    Effect.fnUntraced(function* () {
      const { fs, root } = yield* testDirectory;
      yield* fs.writeFileString(`${root}/keep`, "keep");
      for (const pattern of ["", "/absolute", "bad\0name", "a//b", ".", "a/../b", "[abc", "[]", "\\"]) {
        assertArgument(yield* Effect.flip(fs.glob(pattern, { root })), "glob");
      }
      assertArgument(yield* Effect.flip(fs.glob("*", { root, exclude: ["/invalid"] })), "glob");
      assert.deepStrictEqual(yield* fs.readDirectory(root), ["keep"]);
      assert.strictEqual(yield* fs.readFileString(`${root}/keep`), "keep");
    })
  );

  it.effect(
    "watch continues delivering after the first event confirms registration",
    Effect.fnUntraced(function* () {
      const { fs, root } = yield* testDirectory;
      const path = `${root}/file`;
      yield* fs.writeFileString(path, "initial");
      const first = yield* Deferred.make<void>();
      const events = yield* fs.watch(path).pipe(
        Stream.tap(() => Deferred.succeed(first, undefined)),
        Stream.take(2),
        Stream.runCollect,
        Effect.forkChild({ startImmediately: true })
      );
      yield* fs.writeFileString(path, "one");
      yield* Deferred.await(first);
      yield* fs.writeFileString(path, "two");
      assert.deepStrictEqual(A.fromIterable(yield* Fiber.join(events)), [
        { _tag: "Update", path },
        { _tag: "Update", path },
      ]);
      assert.strictEqual(yield* fs.readFileString(path), "two");
    })
  );
});

it.effect(
  "deep merge validation and recursive removal fail atomically at the public tree bound",
  Effect.fnUntraced(function* () {
    // Independent public volumes prevent an intentionally over-deep tree from
    // becoming a shared fixture or requiring a failing recursive finalizer.
    const fs = yield* Subject.make;
    const suffix = A.join(
      A.makeBy(258, (index) => `level-${index}`),
      "/"
    );
    yield* fs.makeDirectory(`/source/${suffix}`, { recursive: true });
    yield* fs.makeDirectory(`/destination/${suffix}`, { recursive: true });
    yield* fs.writeFileString("/source/first", "new");
    yield* fs.writeFileString("/destination/first", "old");
    yield* fs.writeFileString(`/source/${suffix}/leaf`, "source leaf");
    assertFailure(
      yield* Effect.flip(fs.copy("/source", "/destination", { overwrite: true })),
      "BadResource",
      "copy",
      "/destination"
    );
    assert.strictEqual(yield* fs.readFileString("/destination/first"), "old");
    assert.strictEqual(yield* fs.readFileString(`/source/${suffix}/leaf`), "source leaf");
    assert.isFalse(yield* fs.exists(`/destination/${suffix}/leaf`));
    assertFailure(yield* Effect.flip(fs.remove("/source", { recursive: true })), "BadResource", "remove", "/source");
    assert.strictEqual(yield* fs.readFileString("/source/first"), "new");
    assert.strictEqual(yield* fs.readFileString(`/source/${suffix}/leaf`), "source leaf");
  })
);

it.effect(
  "relative paths, recursive directory modes and root-inclusive globs use the virtual root",
  Effect.fnUntraced(function* () {
    const fs = yield* Subject.make;
    yield* fs.makeDirectory("relative/child", { recursive: true, mode: 0o711 });
    assert.strictEqual((yield* fs.stat("/relative/child")).mode, 0o40711);
    yield* fs.makeDirectory("relative/child", { recursive: true, mode: 0o700 });
    assert.strictEqual((yield* fs.stat("relative/child")).mode, 0o40711);
    assertFailure(yield* Effect.flip(fs.makeDirectory("missing/child")), "NotFound", "makeDirectory", "missing/child");
    assertFailure(yield* Effect.flip(fs.makeDirectory("")), "BadResource", "makeDirectory", "");
    assertFailure(yield* Effect.flip(fs.makeDirectory("bad\0name")), "BadResource", "makeDirectory", "bad\0name");
    assert.isFalse(yield* fs.exists("missing"));
    yield* fs.writeFileString("source", "content");
    yield* fs.symlink("target", "/link");
    yield* fs.copyFile("source", "link");
    assert.strictEqual(yield* fs.readFileString("target"), "content");
    assert.strictEqual(yield* fs.readLink("link"), "target");
    assert.deepStrictEqual(yield* fs.glob("source"), ["source"]);
    assert.include(yield* fs.glob("**"), ".");
    assert.deepStrictEqual(yield* fs.glob("**", { exclude: ["**"] }), []);
  })
);

it.effect(
  "root directory watches deliver metadata and direct child events",
  Effect.fnUntraced(function* () {
    const fs = yield* Subject.make;
    const event = yield* fs
      .watch("/")
      .pipe(Stream.take(2), Stream.runCollect, Effect.forkChild({ startImmediately: true }));
    yield* fs.chmod("/", 0o700);
    yield* fs.writeFileString("/child", "content");
    assert.deepStrictEqual(A.fromIterable(yield* Fiber.join(event)), [
      { _tag: "Update", path: "/" },
      { _tag: "Create", path: "/child" },
    ]);
    yield* fs.chown("/", 12, 34);
    const info = yield* fs.stat("/");
    assert.strictEqual(info.mode, 0o40700);
    assertSome(info.uid, 12);
    assertSome(info.gid, 34);
  })
);

it.effect(
  "temporary allocation preserves pre-existing names and reports a removed default parent",
  Effect.fnUntraced(function* () {
    // Observe a candidate through an independent public volume. No token or
    // counter is inspected or reconstructed to populate the occupied namespace.
    const reference = yield* Subject.make;
    const occupied = yield* reference.makeTempDirectory({ prefix: "occupied-" });
    const fs = yield* Subject.make;
    yield* fs.makeDirectory(occupied);
    yield* fs.writeFileString(`${occupied}/marker`, "keep");
    const created = yield* fs.makeTempDirectory({ prefix: "occupied-" });
    assert.notStrictEqual(created, occupied);
    assert.strictEqual(yield* fs.readFileString(`${occupied}/marker`), "keep");
    assert.deepStrictEqual(yield* fs.readDirectory(created), []);
    yield* fs.remove("/tmp", { recursive: true });
    assertFailure(yield* Effect.flip(fs.makeTempFile()), "NotFound", "makeTempFile", "/tmp");
    assertFailure(yield* Effect.flip(fs.makeTempDirectory()), "NotFound", "makeTempDirectory", "/tmp");
    assert.deepStrictEqual(yield* fs.readDirectory("/"), []);
  })
);

it.layer(Subject.layer)("MemoryFileSystem glob character boundaries", (it) => {
  it.effect(
    "classes distinguish literal hyphens and reject descending or incomplete ranges",
    Effect.fnUntraced(function* () {
      const { fs, root } = yield* testDirectory;
      for (const name of ["-.txt", "a.txt", "z.txt", "back\\q"]) {
        yield* fs.writeFileString(`${root}/${name}`, name);
      }
      assert.deepStrictEqual(yield* fs.glob("[a--].txt", { root }), ["-.txt", "a.txt"]);
      assert.deepStrictEqual(yield* fs.glob("back\\q", { root }), ["back\\q"]);
      assertArgument(yield* Effect.flip(fs.glob("[z-a].txt", { root })), "glob");
      assertArgument(yield* Effect.flip(fs.glob("[a\\", { root })), "glob");
      assert.deepStrictEqual(yield* fs.readDirectory(root), ["-.txt", "a.txt", "back\\q", "z.txt"]);
      assert.strictEqual(yield* fs.readFileString(`${root}/a.txt`), "a.txt");
    })
  );
});
