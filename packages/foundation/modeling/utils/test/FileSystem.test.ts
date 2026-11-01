import * as NodeModule from "node:module";
import * as NodeOS from "node:os";
import { it } from "@beep/test-runner";
import { FileSystem, Path } from "@beep/utils";
import { AppendFileSyncOptions, RmSyncOptions } from "@beep/utils/FileSystem";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodePath from "@effect/platform-node/NodePath";
import { expect, vi } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as SecureRandom from "effect/crypto/SecureRandom";
import * as Effect from "effect/Effect";
import * as PlatformFileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Option from "effect/Option";
import * as P from "effect/Predicate";
import * as Stream from "effect/Stream";

const NFS: typeof import("node:fs") = NodeModule.createRequire(import.meta.url)("node:fs");

const makeTempDir = Effect.fn("FileSystemTest.makeTempDir")(function* () {
  const crypto = yield* SecureRandom.SecureRandom;
  const uuid = yield* crypto.uuidV4();
  const dir = Path.join(NodeOS.tmpdir(), `beep-fs-${uuid}`);
  return yield* Effect.acquireRelease(
    Effect.sync(() => {
      NFS.mkdirSync(dir, { recursive: true });
      return dir;
    }),
    (directory) => Effect.sync(() => NFS.rmSync(directory, { recursive: true, force: true }))
  );
});

it.layer(NodePath.layer)("FileSystem watch wrapper", (it) =>
  it.effect(
    "makeWaitForFile ignores other basenames and supports both call forms",
    Effect.fnUntraced(function* () {
      const directory = "/watched";
      const event: PlatformFileSystem.WatchEvent = { _tag: "Create", path: "/watched/target.txt" };
      const fs = PlatformFileSystem.makeNoop({
        watch: (path) => {
          expect(path).toBe(directory);
          return Stream.fromIterable([
            { _tag: "Update", path: "/watched/other.txt" },
            event,
            { _tag: "Remove", path: "/watched/target.txt" },
          ] satisfies ReadonlyArray<PlatformFileSystem.WatchEvent>);
        },
      });
      const waitForFile = yield* FileSystem.makeWaitForFile.pipe(
        Effect.provideService(PlatformFileSystem.FileSystem, fs)
      );

      assertSome(yield* waitForFile(directory, "target.txt"), event);
      assertSome(yield* pipe(directory, waitForFile("target.txt")), event);
      assertNone(yield* waitForFile(directory, "missing.txt"));
    })
  )
);

it.layer(NodeCrypto.layer, { timeout: "5 seconds" })("FileSystem sync wrappers", (it) => {
  it.effect(
    "appendFileSync appends to a file, creating it",
    Effect.fnUntraced(function* () {
      const dir = yield* makeTempDir();
      const file = Path.join(dir, "log.txt");
      yield* FileSystem.appendFileSync(file, "a");
      yield* FileSystem.appendFileSync(file, "b");
      yield* pipe(file, FileSystem.appendFileSync("c", AppendFileSyncOptions.make({ flag: "a" })));
      expect(NFS.readFileSync(file, "utf8")).toBe("abc");
    })
  );

  it.effect(
    "existsSync reports presence without a failure channel",
    Effect.fnUntraced(function* () {
      const dir = yield* makeTempDir();
      const file = Path.join(dir, "present.txt");
      yield* FileSystem.appendFileSync(file, "x");
      expect(yield* FileSystem.existsSync(file)).toBe(true);
      expect(yield* FileSystem.existsSync(Path.join(dir, "absent.txt"))).toBe(false);
    })
  );

  it.effect(
    "statSync returns a File.Info with branded bigint size",
    Effect.fnUntraced(function* () {
      const dir = yield* makeTempDir();
      const file = Path.join(dir, "data.txt");
      yield* FileSystem.appendFileSync(file, "hello");
      const fileInfo = yield* FileSystem.statSync(file);
      expect(fileInfo.type).toBe("File");
      expect(typeof fileInfo.size).toBe("bigint");
      expect(fileInfo.size).toBe(5n);
      assertSome(fileInfo.nlink, 1n);
      fileInfo.ino.pipe(Option.isSome, assertTrue);
      assertTrue(P.isBigInt(fileInfo.dev));
      assertTrue(fileInfo.mtime.pipe(Option.isSome));

      const dirInfo = yield* FileSystem.statSync(dir);
      expect(dirInfo.type).toBe("Directory");
    })
  );

  it.effect(
    "readdirSync lists names, and Dirent entries with { withFileTypes: true }",
    Effect.fnUntraced(function* () {
      const dir = yield* makeTempDir();
      yield* FileSystem.appendFileSync(Path.join(dir, "file.txt"), "x");
      NFS.mkdirSync(Path.join(dir, "sub"));

      const names = yield* FileSystem.readdirSync(dir);
      expect([...names].sort()).toEqual(["file.txt", "sub"]);

      const entries = yield* FileSystem.readdirSync(dir, { withFileTypes: true });
      const subEntry = A.findFirst(entries, (entry) => entry.name === "sub");
      pipe(
        subEntry,
        Option.exists((entry) => entry.isDirectory()),
        assertTrue
      );
    })
  );

  it.effect(
    "renameSync moves a path",
    Effect.fnUntraced(function* () {
      const dir = yield* makeTempDir();
      const from = Path.join(dir, "old.txt");
      const to = Path.join(dir, "new.txt");
      yield* FileSystem.appendFileSync(from, "x");
      yield* FileSystem.renameSync(from, to);
      expect(yield* FileSystem.existsSync(from)).toBe(false);
      expect(yield* FileSystem.existsSync(to)).toBe(true);

      const movedAgain = Path.join(dir, "again.txt");
      yield* pipe(to, FileSystem.renameSync(movedAgain));
      expect(yield* FileSystem.existsSync(to)).toBe(false);
      expect(yield* FileSystem.existsSync(movedAgain)).toBe(true);
    })
  );

  it.effect(
    "rmSync removes a populated directory with { recursive, force }",
    Effect.fnUntraced(function* () {
      const dir = yield* makeTempDir();
      const target = Path.join(dir, "tree");
      NFS.mkdirSync(target);
      yield* FileSystem.appendFileSync(Path.join(target, "leaf.txt"), "x");
      yield* FileSystem.rmSync(target, RmSyncOptions.make({ recursive: true, force: true }));
      expect(yield* FileSystem.existsSync(target)).toBe(false);
    })
  );

  it.effect(
    "maps ENOENT to a PlatformError whose reason is NotFound",
    Effect.fnUntraced(function* () {
      const crypto = yield* SecureRandom.SecureRandom;
      const uuid = yield* crypto.uuidV4();
      const error = yield* Effect.flip(FileSystem.statSync(Path.join(NodeOS.tmpdir(), `beep-missing-${uuid}`)));
      expect(error.reason._tag).toBe("NotFound");
      expect(error.reason.module).toBe("FileSystem");
      expect(error.reason.method).toBe("statSync");
    })
  );

  it.effect(
    "statSync classifies socket metadata from the Node backend",
    Effect.fnUntraced(function* () {
      const dir = yield* makeTempDir();
      const stats = NFS.statSync(dir);
      const directory = vi.spyOn(stats, "isDirectory").mockReturnValue(false);
      const socket = vi.spyOn(stats, "isSocket").mockReturnValue(true);
      const stat = vi.spyOn(NFS, "statSync").mockReturnValue(stats);
      try {
        expect((yield* FileSystem.statSync("socket")).type).toBe("Socket");
      } finally {
        stat.mockRestore();
        socket.mockRestore();
        directory.mockRestore();
      }
    })
  );

  it.effect(
    "maps failures without an errno code to Unknown and preserves their cause",
    Effect.fnUntraced(function* () {
      const cause = new Error("File-system backend unavailable");
      const stat = vi.spyOn(NFS, "statSync").mockImplementation(() => {
        throw cause;
      });
      try {
        const error = yield* Effect.flip(FileSystem.statSync("unavailable.txt"));
        expect(error.reason._tag).toBe("Unknown");
        expect(error.reason.method).toBe("statSync");
        expect(error.reason.cause).toBe(cause);
      } finally {
        stat.mockRestore();
      }
    })
  );
});
