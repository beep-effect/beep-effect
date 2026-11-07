import { DocumentContentDigest } from "@beep/documents-domain/aggregates/Document";
import { makeVaultSyncFileStore } from "@beep/documents-server/aggregates/Sync";
import { it } from "@beep/test-runner";
import * as BunFileSystem from "@effect/platform-bun/BunFileSystem";
import * as BunPath from "@effect/platform-bun/BunPath";
import { describe, expect } from "@effect/vitest";
import { assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ByteSize from "effect/ByteSize";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as Str from "effect/String";

type FileSystemFault = (fs: FileSystem.FileSystem) => Partial<FileSystem.FileSystem>;
const targetName = "private.txt";
const isTarget = Str.endsWith(targetName);
const failure = (method: string) =>
  Effect.fail(
    PlatformError.badArgument({
      module: "FileSystem",
      method,
      description: "injected vault filesystem failure",
    })
  );

const changeOpenedFile =
  (change: (file: FileSystem.File) => FileSystem.File): FileSystemFault =>
  (fs) => ({
    open: Effect.fn("VaultFileStoreTest.open")((...args: Parameters<FileSystem.FileSystem["open"]>) =>
      fs.open(...args).pipe(Effect.map(change))
    ),
  });
const changeOpenedInfo = (change: (info: FileSystem.File.Info) => FileSystem.File.Info): FileSystemFault =>
  changeOpenedFile((file) => ({ ...file, stat: Effect.map(file.stat, change) }));

const failRealPathAt =
  (occurrence: number): FileSystemFault =>
  (fs) => {
    let calls = 0;
    return {
      realPath: Effect.fn("VaultFileStoreTest.realPath")((candidate: string) =>
        isTarget(candidate) && ++calls === occurrence ? failure("realPath") : fs.realPath(candidate)
      ),
    };
  };
const failStatAt =
  (occurrence: number): FileSystemFault =>
  (fs) => {
    let calls = 0;
    return {
      stat: Effect.fn("VaultFileStoreTest.stat")((candidate: string) =>
        isTarget(candidate) && ++calls === occurrence ? failure("stat") : fs.stat(candidate)
      ),
    };
  };
const becomeSymlinkAt = (occurrence: number) => {
  let calls = 0;
  let opens = 0;
  let descriptorStats = 0;
  let pathStats = 0;
  let injected = false;
  const fault: FileSystemFault = (fs) => ({
    readLink: Effect.fn("VaultFileStoreTest.readLink")((candidate: string) => {
      if (isTarget(candidate) && ++calls === occurrence) {
        injected = true;
        return Effect.succeed("/outside/private.txt");
      }
      return fs.readLink(candidate);
    }),
    open: Effect.fn("VaultFileStoreTest.observeOpen")(function* (...args: Parameters<FileSystem.FileSystem["open"]>) {
      const file = yield* fs.open(...args);
      if (!isTarget(args[0])) return file;
      opens++;
      return {
        ...file,
        stat: Effect.tap(file.stat, () => Effect.sync(() => descriptorStats++)),
      };
    }),
    stat: Effect.fn("VaultFileStoreTest.observeStat")(function* (candidate: string) {
      const info = yield* fs.stat(candidate);
      if (isTarget(candidate)) pathStats++;
      return info;
    }),
  });
  return {
    fault,
    verify: () => {
      // Equal error messages cannot distinguish these stages. Pin the actual
      // injection and whether descriptor/path validation completed before it.
      const opened = occurrence === 2 ? 0 : 1;
      expect({ injected, calls, opens, descriptorStats, pathStats }).toEqual({
        injected: true,
        calls: occurrence,
        opens: opened,
        descriptorStats: opened,
        pathStats: opened + 1,
      });
    },
  };
};

const cases: ReadonlyArray<{
  readonly name: string;
  readonly reason: string;
  readonly fault: FileSystemFault;
  readonly verify?: () => void;
}> = [
  {
    name: "directory enumeration failure",
    reason: "vault scan could not read directory",
    fault: () => ({ readDirectory: () => failure("readDirectory") }),
  },
  { name: "scan path resolution failure", reason: "vault scan could not resolve", fault: failRealPathAt(1) },
  { name: "scan stat failure", reason: "vault scan could not stat", fault: failStatAt(1) },
  {
    name: "open failure",
    reason: "vault sync could not open local file private.txt",
    fault: () => ({ open: () => failure("open") }),
  },
  {
    name: "descriptor stat failure",
    reason: "vault sync could not inspect open local file private.txt",
    fault: changeOpenedFile((file) => ({ ...file, stat: failure("stat") })),
  },
  {
    name: "opened path resolution failure",
    reason: "vault sync could not resolve open local file private.txt",
    fault: failRealPathAt(2),
  },
  {
    name: "opened path stat failure",
    reason: "vault sync could not inspect local file private.txt",
    fault: failStatAt(2),
  },
  {
    name: "descriptor read failure",
    reason: "vault sync could not read local file private.txt",
    fault: changeOpenedFile((file) => ({ ...file, stat: file.stat, readAlloc: () => failure("readAlloc") })),
  },
  {
    name: "unsafe allocation size",
    reason: "vault sync could not safely allocate local file private.txt",
    fault: changeOpenedInfo((info) => ({ ...info, size: ByteSize.bytes(9007199254740992n) })),
  },
  {
    name: "non-regular opened descriptor",
    reason: "vault sync refused non-regular file private.txt",
    fault: changeOpenedInfo((info) => ({ ...info, type: "Directory" })),
  },
  {
    name: "device identity change",
    reason: "vault sync refused changed local file private.txt",
    fault: changeOpenedInfo((info) => ({ ...info, dev: info.dev + 1n })),
  },
  {
    name: "inode identity change",
    reason: "vault sync refused changed local file private.txt",
    fault: changeOpenedInfo((info) => ({ ...info, ino: O.map(info.ino, (ino) => ino + 1n) })),
  },
  {
    name: "symlink installed before open",
    reason: "vault sync refused symbolic link private.txt",
    ...becomeSymlinkAt(2),
  },
  {
    name: "symlink installed after descriptor validation",
    reason: "vault sync refused symbolic link private.txt",
    ...becomeSymlinkAt(3),
  },
  {
    name: "scan path escapes root",
    reason: "vault scan refused path outside the configured vault",
    fault: (fs) => ({
      realPath: Effect.fn("VaultFileStoreTest.escape")((candidate: string) =>
        isTarget(candidate) ? Effect.succeed("/outside/private.txt") : fs.realPath(candidate)
      ),
    }),
  },
  {
    name: "opened path escapes root",
    reason: "vault sync refused file outside the configured vault private.txt",
    fault: (fs) => {
      let calls = 0;
      let original = "";
      return {
        realPath: Effect.fn("VaultFileStoreTest.escapeAfterOpen")((candidate: string) => {
          if (isTarget(candidate) && ++calls === 2) {
            original = candidate;
            return Effect.succeed("/outside/private.txt");
          }
          return fs.realPath(candidate);
        }),
        stat: Effect.fn("VaultFileStoreTest.sameDescriptor")((candidate: string) =>
          fs.stat(candidate === "/outside/private.txt" ? original : candidate)
        ),
      };
    },
  },
  {
    name: "resolved file changes kind",
    reason: "vault sync refused changed local file private.txt",
    fault: (fs) => {
      let calls = 0;
      return {
        stat: Effect.fn("VaultFileStoreTest.changedKind")((candidate: string) =>
          isTarget(candidate) && ++calls === 2
            ? Effect.map(fs.stat(candidate), (info): FileSystem.File.Info => ({ ...info, type: "Directory" }))
            : fs.stat(candidate)
        ),
      };
    },
  },
];

const testLayer = (fault: FileSystemFault) =>
  Layer.effect(
    FileSystem.FileSystem,
    Effect.map(FileSystem.FileSystem, (fs) => FileSystem.FileSystem.of({ ...fs, ...fault(fs) }))
  ).pipe(Layer.provide(BunFileSystem.layer), Layer.provideMerge(BunPath.layer));

/** Scan a fresh vault holding one target file through the faulted filesystem. */
const scanWith = Effect.fnUntraced(function* (contents: string) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const files = yield* makeVaultSyncFileStore();
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "beep-vault-file-store-" });
  const target = path.join(root, targetName);
  yield* fs.writeFileString(target, contents);
  const canonicalRoot = yield* fs.realPath(root);
  return { scan: files.scan(canonicalRoot), target };
});

describe("Vault filesystem boundary failures", () => {
  for (const testCase of cases) {
    it.layer(Layer.fresh(testLayer(testCase.fault)), { timeout: "10 seconds" })((it) => {
      it.effect(
        testCase.name,
        Effect.fnUntraced(function* () {
          const fs = yield* FileSystem.FileSystem;
          const { scan, target } = yield* scanWith("private content");
          const error = yield* Effect.flip(scan);
          expect(error).toMatchObject({ _tag: "VaultScanFailed", reason: expect.stringContaining(testCase.reason) });
          testCase.verify?.();
          const readFileString1 = yield* fs.readFileString(target);
          expect(readFileString1).toBe("private content");
        })
      );
    });
  }
});

const nonRegularEntry: FileSystemFault = (fs) => ({
  stat: Effect.fn("VaultFileStoreTest.nonRegularEntry")((candidate: string) =>
    fs
      .stat(candidate)
      .pipe(Effect.map((info): FileSystem.File.Info => (isTarget(candidate) ? { ...info, type: "Socket" } : info)))
  ),
});

describe("Vault filesystem boundary empty observations", () => {
  it.layer(Layer.fresh(testLayer(nonRegularEntry)), { timeout: "10 seconds" })((it) => {
    it.effect(
      "ignores non-regular directory entries without observing them",
      Effect.fnUntraced(function* () {
        const { scan } = yield* scanWith("not a regular entry");
        const observation = yield* scan;
        expect(observation.files).toEqual([]);
        expect(observation.folders).toEqual([]);
      })
    );
  });
  it.layer(Layer.fresh(testLayer(() => ({}))), { timeout: "10 seconds" })((it) => {
    it.effect(
      "observes an empty file when its descriptor read reaches EOF",
      Effect.fnUntraced(function* () {
        const { scan } = yield* scanWith("");
        const observation = yield* scan;
        expect(observation.files).toHaveLength(1);
        assertSome(
          O.map(A.head(observation.files), (file) => file.digest),
          DocumentContentDigest.make("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
        );
        assertSome(
          O.map(A.head(observation.files), (file) => file.sizeBytes),
          0
        );
      })
    );
  });
});
