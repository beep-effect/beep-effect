import { MemoryFileSystem } from "@beep/memfs/MemoryFileSystem";
import {
  allocateUniqueName,
  appendContainedFileString,
  bytesEqual,
  createContainedFileString,
  dedupeBySha256,
  hashFileSha256,
  preflightOverwritableFile,
  readContainedFileBytesNoFollow,
  readContainedFileStringNoFollow,
  validateDirectory,
  validatePathSegment,
  writeContainedFileString,
} from "@beep/repo-cli/test/Cli";
import { it } from "@beep/test-runner";
import { describe, expect, vi } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as S from "effect/Schema";

const FsLayer = Layer.mergeAll(MemoryFileSystem.layer, Path.layer);

class GuardProbeError extends S.TaggedError<GuardProbeError, { readonly brand: unique symbol }>()("GuardProbeError", {
  message: S.String,
}) {}

const probe = (message: string) => GuardProbeError.make({ message });

const systemError = (
  method: string,
  pathOrDescriptor: string,
  tag: "PermissionDenied" | "AlreadyExists" = "PermissionDenied"
) => PlatformError.systemError({ _tag: tag, module: "FileSystem", method, pathOrDescriptor });

const directoryErrors = {
  onStatError: (_cause: unknown, entry: string) => probe(`stat: ${entry}`),
  onNotDirectory: (entry: string) => probe(`not directory: ${entry}`),
  onRealPathError: (_cause: unknown, entry: string) => probe(`real path: ${entry}`),
};

const preflightOptions = (overwrite: boolean) => ({
  description: "manifest",
  overwrite,
  onInspectError: (_cause: unknown, filePath: string, description: string) =>
    probe(`inspect ${description}: ${filePath}`),
  onRefuseNonFile: (filePath: string, description: string) => probe(`non-file ${description}: ${filePath}`),
  onRefuseOverwrite: (filePath: string, description: string) => probe(`refuse ${description}: ${filePath}`),
  onStatError: (_cause: unknown, filePath: string, description: string) => probe(`stat ${description}: ${filePath}`),
});

const makeRoot = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const root = yield* fs.makeTempDirectoryScoped();
  return { fs, path, root };
});

const restoreOnExit = (spy: { readonly mockRestore: () => void }) =>
  Effect.addFinalizer(() => Effect.sync(() => spy.mockRestore()));

describe("internal/cli/FsGuards contained writes", () => {
  it.layer(FsLayer, { timeout: "30 seconds" })((it) => {
    it.effect("writes, creates parents, and overwrites a regular file atomically", () =>
      Effect.gen(function* () {
        const { fs, path, root } = yield* makeRoot;
        const written = yield* writeContainedFileString(root, "a/b/value.txt", "one");
        expect(written).toBe(path.join(root, "a", "b", "value.txt"));
        expect(yield* fs.readFileString(written)).toBe("one");
        yield* writeContainedFileString(root, written, "two");
        expect(yield* fs.readFileString(written)).toBe("two");
      })
    );

    it.effect("refuses targets outside the root or equal to it", () =>
      Effect.gen(function* () {
        const { root } = yield* makeRoot;
        const escape = yield* writeContainedFileString(root, "../escape.txt", "x").pipe(Effect.flip);
        expect(escape.reason).toBe("outside-root");
        assertNone(escape.cause);
        const self = yield* writeContainedFileString(root, ".", "x").pipe(Effect.flip);
        expect(self.reason).toBe("outside-root");
      })
    );

    it.effect("refuses a missing root and a symlinked root", () =>
      Effect.gen(function* () {
        const { fs, path, root } = yield* makeRoot;
        const missing = yield* writeContainedFileString(path.join(root, "missing"), "x.txt", "x").pipe(Effect.flip);
        expect(missing.reason).toBe("root-not-directory");

        const real = path.join(root, "real");
        yield* fs.makeDirectory(real);
        const linked = path.join(root, "linked");
        yield* fs.symlink(real, linked);
        const symlinkRoot = yield* writeContainedFileString(linked, "x.txt", "x").pipe(Effect.flip);
        expect(symlinkRoot.reason).toBe("symlink");
        expect(symlinkRoot.path).toBe(linked);
      })
    );

    it.effect("refuses a parent that is a file or a symlink", () =>
      Effect.gen(function* () {
        const { fs, path, root } = yield* makeRoot;
        yield* fs.writeFileString(path.join(root, "plain"), "file");
        const fileParent = yield* writeContainedFileString(root, "plain/x.txt", "x").pipe(Effect.flip);
        expect(fileParent.reason).toBe("parent-not-directory");
        expect(fileParent.path).toBe(path.join(root, "plain"));

        yield* fs.makeDirectory(path.join(root, "dir"));
        yield* fs.symlink(path.join(root, "dir"), path.join(root, "via"));
        const linkParent = yield* writeContainedFileString(root, "via/x.txt", "x").pipe(Effect.flip);
        expect(linkParent.reason).toBe("symlink");
        expect(linkParent.path).toBe(path.join(root, "via"));
      })
    );

    it.effect("refuses a symlinked or directory final target", () =>
      Effect.gen(function* () {
        const { fs, path, root } = yield* makeRoot;
        yield* fs.writeFileString(path.join(root, "real.txt"), "real");
        yield* fs.symlink(path.join(root, "real.txt"), path.join(root, "link.txt"));
        const link = yield* writeContainedFileString(root, "link.txt", "x").pipe(Effect.flip);
        expect(link.reason).toBe("symlink");
        expect(yield* fs.readFileString(path.join(root, "real.txt"))).toBe("real");

        yield* fs.makeDirectory(path.join(root, "folder"));
        const folder = yield* writeContainedFileString(root, "folder", "x").pipe(Effect.flip);
        expect(folder.reason).toBe("target-not-file");
      })
    );

    it.effect("maps an inspection failure that is not NotFound to filesystem-failure", () =>
      Effect.gen(function* () {
        const { fs, path, root } = yield* makeRoot;
        const target = path.join(root, "x.txt");
        const original = fs.stat;
        const stat = vi
          .spyOn(fs, "stat")
          .mockImplementation((entry) =>
            entry === target ? Effect.fail(systemError("stat", entry)) : original(entry)
          );
        yield* restoreOnExit(stat);
        const error = yield* writeContainedFileString(root, "x.txt", "x").pipe(Effect.flip);
        expect(error.reason).toBe("filesystem-failure");
        expect(error.path).toBe(target);
        assertTrue(error.cause.pipe(O.isSome));
      })
    );

    it.effect("maps root and parent canonicalisation failures", () =>
      Effect.gen(function* () {
        const { fs, path, root } = yield* makeRoot;
        const original = fs.realPath;
        const failRoot = vi
          .spyOn(fs, "realPath")
          .mockImplementationOnce((entry) => Effect.fail(systemError("realPath", entry)));
        const rootError = yield* writeContainedFileString(root, "x.txt", "x").pipe(Effect.flip);
        failRoot.mockRestore();
        expect(rootError.reason).toBe("filesystem-failure");
        expect(rootError.path).toBe(root);

        const failParent = vi
          .spyOn(fs, "realPath")
          .mockImplementation((entry) =>
            entry === root ? original(entry) : Effect.fail(systemError("realPath", entry))
          );
        yield* restoreOnExit(failParent);
        const parentError = yield* writeContainedFileString(root, "sub/x.txt", "x").pipe(Effect.flip);
        expect(parentError.reason).toBe("filesystem-failure");
        expect(parentError.path).toBe(path.join(root, "sub"));
      })
    );

    it.effect("refuses a parent whose canonical path escapes the canonical root", () =>
      Effect.gen(function* () {
        const { fs, path, root } = yield* makeRoot;
        const original = fs.realPath;
        const escape = vi
          .spyOn(fs, "realPath")
          .mockImplementation((entry) => (entry === root ? original(entry) : Effect.succeed("/elsewhere")));
        yield* restoreOnExit(escape);
        const error = yield* writeContainedFileString(root, "sub/x.txt", "x").pipe(Effect.flip);
        expect(error.reason).toBe("outside-root");
        expect(error.path).toBe(path.join(root, "sub"));
      })
    );

    it.effect("maps temporary-file, write, and rename failures", () =>
      Effect.gen(function* () {
        const { fs, path, root } = yield* makeRoot;
        const target = path.join(root, "x.txt");

        const temp = vi
          .spyOn(fs, "makeTempFileScoped")
          .mockImplementationOnce(() => Effect.fail(systemError("makeTempFileScoped", root)));
        const tempError = yield* writeContainedFileString(root, "x.txt", "x").pipe(Effect.flip);
        temp.mockRestore();
        expect(tempError.reason).toBe("filesystem-failure");
        expect(tempError.path).toBe(root);

        const chmod = vi.spyOn(fs, "chmod").mockImplementationOnce((entry) => Effect.fail(systemError("chmod", entry)));
        const writeError = yield* writeContainedFileString(root, "x.txt", "x").pipe(Effect.flip);
        chmod.mockRestore();
        expect(writeError.reason).toBe("filesystem-failure");
        expect(writeError.message).toContain("temporary file");

        const rename = vi
          .spyOn(fs, "rename")
          .mockImplementationOnce((from) => Effect.fail(systemError("rename", from)));
        const renameError = yield* writeContainedFileString(root, "x.txt", "x").pipe(Effect.flip);
        rename.mockRestore();
        expect(renameError.reason).toBe("filesystem-failure");
        expect(renameError.path).toBe(target);
        expect(yield* fs.exists(target)).toBe(false);
      })
    );

    it.effect("reports a parent that disappears before the guarded write commits", () =>
      Effect.gen(function* () {
        const { fs, path, root } = yield* makeRoot;
        const parent = path.join(root, "sub");
        const original = fs.readLink;
        let calls = 0;
        const readLink = vi.spyOn(fs, "readLink").mockImplementation((entry) => {
          if (entry === parent) {
            calls += 1;
          }
          return original(entry);
        });
        yield* restoreOnExit(readLink);
        const originalStat = fs.stat;
        const stat = vi.spyOn(fs, "stat").mockImplementation((entry) =>
          entry === parent && calls >= 3
            ? Effect.fail(
                PlatformError.systemError({
                  _tag: "NotFound",
                  module: "FileSystem",
                  method: "stat",
                  pathOrDescriptor: entry,
                })
              )
            : originalStat(entry)
        );
        yield* restoreOnExit(stat);
        const error = yield* writeContainedFileString(root, "sub/x.txt", "x").pipe(Effect.flip);
        expect(error.reason).toBe("parent-not-directory");
        expect(error.message).toContain("disappeared");
      })
    );
  });
});

describe("internal/cli/FsGuards exclusive create and append", () => {
  it.layer(FsLayer, { timeout: "30 seconds" })((it) => {
    it.effect("creates a file exclusively and refuses an existing one", () =>
      Effect.gen(function* () {
        const { fs, root } = yield* makeRoot;
        const created = yield* createContainedFileString(root, "new/file.txt", "fresh");
        expect(yield* fs.readFileString(created)).toBe("fresh");
        const error = yield* createContainedFileString(root, "new/file.txt", "again").pipe(Effect.flip);
        expect(error.reason).toBe("filesystem-failure");
        expect(yield* fs.readFileString(created)).toBe("fresh");
      })
    );

    it.effect("creates a missing append target, then appends through a hard-link alias", () =>
      Effect.gen(function* () {
        const { fs, root } = yield* makeRoot;
        const target = yield* appendContainedFileString(root, "logs/events.ndjson", "a\n");
        yield* appendContainedFileString(root, "logs/events.ndjson", "b\n");
        expect(yield* fs.readFileString(target)).toBe("a\nb\n");
      })
    );

    it.effect("refuses to append to a symlink or a directory", () =>
      Effect.gen(function* () {
        const { fs, path, root } = yield* makeRoot;
        yield* fs.writeFileString(path.join(root, "real.txt"), "real");
        yield* fs.symlink(path.join(root, "real.txt"), path.join(root, "link.txt"));
        const link = yield* appendContainedFileString(root, "link.txt", "x").pipe(Effect.flip);
        expect(link.reason).toBe("symlink");

        yield* fs.makeDirectory(path.join(root, "folder"));
        const folder = yield* appendContainedFileString(root, "folder", "x").pipe(Effect.flip);
        expect(folder.reason).toBe("target-not-file");
      })
    );

    it.effect("falls through to the alias append when exclusive creation loses a race", () =>
      Effect.gen(function* () {
        const { fs, path, root } = yield* makeRoot;
        const target = path.join(root, "race.txt");
        const original = fs.writeFileString;
        const write = vi
          .spyOn(fs, "writeFileString")
          .mockImplementationOnce((entry, _contents, _options) =>
            original(entry, "winner\n").pipe(
              Effect.andThen(Effect.fail(systemError("writeFile", entry, "AlreadyExists")))
            )
          );
        yield* restoreOnExit(write);
        yield* appendContainedFileString(root, "race.txt", "late\n");
        expect(yield* fs.readFileString(target)).toBe("winner\nlate\n");
      })
    );

    it.effect("maps exclusive-create, temp-directory, link, alias, and append failures", () =>
      Effect.gen(function* () {
        const { fs, path, root } = yield* makeRoot;
        const target = path.join(root, "events.txt");

        const create = vi
          .spyOn(fs, "writeFileString")
          .mockImplementationOnce((entry) => Effect.fail(systemError("writeFile", entry)));
        const createError = yield* appendContainedFileString(root, "events.txt", "x").pipe(Effect.flip);
        create.mockRestore();
        expect(createError.reason).toBe("filesystem-failure");
        expect(createError.message).toContain("exclusively create");

        yield* fs.writeFileString(target, "seed\n");

        const tempDir = vi
          .spyOn(fs, "makeTempDirectoryScoped")
          .mockImplementationOnce(() => Effect.fail(systemError("makeTempDirectory", root)));
        const tempError = yield* appendContainedFileString(root, "events.txt", "x").pipe(Effect.flip);
        tempDir.mockRestore();
        expect(tempError.path).toBe(root);

        const link = vi.spyOn(fs, "link").mockImplementationOnce((from) => Effect.fail(systemError("link", from)));
        const linkError = yield* appendContainedFileString(root, "events.txt", "x").pipe(Effect.flip);
        link.mockRestore();
        expect(linkError.reason).toBe("filesystem-failure");
        expect(linkError.message).toContain("no-follow alias");

        const aliasSymlink = vi.spyOn(fs, "link").mockImplementationOnce((from, to) => fs.symlink(from, to));
        const aliasError = yield* appendContainedFileString(root, "events.txt", "x").pipe(Effect.flip);
        aliasSymlink.mockRestore();
        expect(aliasError.reason).toBe("symlink");

        const aliasMissing = vi.spyOn(fs, "link").mockImplementationOnce(() => Effect.void);
        const missingError = yield* appendContainedFileString(root, "events.txt", "x").pipe(Effect.flip);
        aliasMissing.mockRestore();
        expect(missingError.reason).toBe("target-not-file");

        const append = vi
          .spyOn(fs, "writeFileString")
          .mockImplementationOnce((entry) => Effect.fail(systemError("writeFile", entry)));
        const appendError = yield* appendContainedFileString(root, "events.txt", "x").pipe(Effect.flip);
        append.mockRestore();
        expect(appendError.message).toContain("append through");
        expect(yield* fs.readFileString(target)).toBe("seed\n");
      })
    );
  });
});

describe("internal/cli/FsGuards contained reads", () => {
  it.layer(FsLayer, { timeout: "30 seconds" })((it) => {
    it.effect("reads text and distinguishes missing, non-file, and symlinked entries", () =>
      Effect.gen(function* () {
        const { fs, path, root } = yield* makeRoot;
        yield* fs.makeDirectory(path.join(root, "dir"));
        yield* fs.writeFileString(path.join(root, "dir", "a.txt"), "alpha");
        yield* fs.symlink(path.join(root, "dir", "a.txt"), path.join(root, "dir", "link.txt"));

        const present = yield* readContainedFileStringNoFollow(root, "dir/a.txt");
        expect(present.exists).toBe(true);
        assertSome(present.contents, "alpha");

        const missingParent = yield* readContainedFileStringNoFollow(root, "nope/a.txt");
        expect(missingParent.exists).toBe(false);
        const missing = yield* readContainedFileStringNoFollow(root, "dir/b.txt");
        expect(missing.exists).toBe(false);

        const directory = yield* readContainedFileStringNoFollow(root, "dir");
        expect(directory.exists).toBe(true);
        assertNone(directory.contents);

        const link = yield* readContainedFileStringNoFollow(root, "dir/link.txt").pipe(Effect.flip);
        expect(link.reason).toBe("symlink");
      })
    );

    it.effect("reads bounded bytes and refuses oversize, symlinked, and invalid-limit reads", () =>
      Effect.gen(function* () {
        const { fs, path, root } = yield* makeRoot;
        yield* fs.writeFileString(path.join(root, "a.bin"), "abcd");
        yield* fs.makeDirectory(path.join(root, "dir"));
        yield* fs.symlink(path.join(root, "a.bin"), path.join(root, "link.bin"));

        const read = yield* readContainedFileBytesNoFollow(root, "a.bin", 4);
        expect(read.exists).toBe(true);
        assertSome(
          O.map(read.contents, (bytes) => new TextDecoder().decode(bytes)),
          "abcd"
        );

        const empty = yield* readContainedFileBytesNoFollow(root, "a.bin", 16);
        assertSome(
          O.map(empty.contents, (bytes) => bytes.length),
          4
        );

        const oversize = yield* readContainedFileBytesNoFollow(root, "a.bin", 3).pipe(Effect.flip);
        expect(oversize.message).toContain("exceeds");

        const invalid = yield* readContainedFileBytesNoFollow(root, "a.bin", -1).pipe(Effect.flip);
        expect(invalid.message).toContain("non-negative integer");

        const missingParent = yield* readContainedFileBytesNoFollow(root, "nope/a.bin", 4);
        expect(missingParent.exists).toBe(false);
        const missing = yield* readContainedFileBytesNoFollow(root, "b.bin", 4);
        expect(missing.exists).toBe(false);
        const directory = yield* readContainedFileBytesNoFollow(root, "dir", 4);
        expect(directory.exists).toBe(true);
        assertNone(directory.contents);
        const link = yield* readContainedFileBytesNoFollow(root, "link.bin", 4).pipe(Effect.flip);
        expect(link.reason).toBe("symlink");

        const open = vi.spyOn(fs, "open").mockImplementationOnce((entry) => Effect.fail(systemError("open", entry)));
        yield* restoreOnExit(open);
        const openError = yield* readContainedFileBytesNoFollow(root, "a.bin", 4).pipe(Effect.flip);
        expect(openError.message).toContain("Cannot read bounded file bytes");
      })
    );
  });
});

describe("internal/cli/FsGuards validation helpers", () => {
  it.layer(FsLayer, { timeout: "30 seconds" })((it) => {
    it.effect("validates directories, refusing files and canonicalisation failures", () =>
      Effect.gen(function* () {
        const { fs, path, root } = yield* makeRoot;
        const file = path.join(root, "file.txt");
        yield* fs.writeFileString(file, "x");
        const viaLast = yield* validateDirectory(directoryErrors)(root);
        expect(viaLast.directory).toBe(root);

        const notDirectory = yield* validateDirectory(file, directoryErrors).pipe(Effect.flip);
        expect(notDirectory.message).toBe(`not directory: ${file}`);

        const realPath = vi
          .spyOn(fs, "realPath")
          .mockImplementationOnce((entry) => Effect.fail(systemError("realPath", entry)));
        yield* restoreOnExit(realPath);
        const realPathError = yield* validateDirectory(root, directoryErrors).pipe(Effect.flip);
        expect(realPathError.message).toBe(`real path: ${root}`);
      })
    );

    it.effect("preflights overwrites across missing, refused, file, directory, and failing inspections", () =>
      Effect.gen(function* () {
        const { fs, path, root } = yield* makeRoot;
        const file = path.join(root, "out.json");
        yield* fs.writeFileString(file, "{}");

        yield* preflightOverwritableFile(path.join(root, "missing.json"), preflightOptions(false));
        yield* preflightOverwritableFile(preflightOptions(true))(file);

        const refused = yield* preflightOverwritableFile(file, preflightOptions(false)).pipe(Effect.flip);
        expect(refused.message).toBe(`refuse manifest: ${file}`);

        const nonFile = yield* preflightOverwritableFile(root, preflightOptions(true)).pipe(Effect.flip);
        expect(nonFile.message).toBe(`non-file manifest: ${root}`);

        const exists = vi
          .spyOn(fs, "exists")
          .mockImplementationOnce((entry) => Effect.fail(systemError("access", entry)));
        const inspectError = yield* preflightOverwritableFile(file, preflightOptions(true)).pipe(Effect.flip);
        exists.mockRestore();
        expect(inspectError.message).toBe(`inspect manifest: ${file}`);

        const stat = vi.spyOn(fs, "stat").mockImplementationOnce((entry) => Effect.fail(systemError("stat", entry)));
        yield* restoreOnExit(stat);
        const statError = yield* preflightOverwritableFile(file, preflightOptions(true)).pipe(Effect.flip);
        expect(statError.message).toBe(`stat manifest: ${file}`);
      })
    );

    it.effect("hashes a file data-last", () =>
      Effect.gen(function* () {
        const { fs, path, root } = yield* makeRoot;
        const file = path.join(root, "abc.txt");
        yield* fs.writeFileString(file, "abc");
        const digest = yield* hashFileSha256((_cause: unknown, entry: string) => probe(entry))(file);
        expect(digest).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
      })
    );

    it.effect("accepts single path segments and rejects traversal or separators", () =>
      Effect.gen(function* () {
        const options = { onInvalid: (label: string, value: string) => probe(`${label}=${value}`) };
        yield* validatePathSegment("name", "photo.webp", options);
        yield* validatePathSegment("photo.webp", options)("name");
        for (const bad of [".", "..", "a/b", "a\\b"]) {
          const error = yield* validatePathSegment("name", bad, options).pipe(Effect.flip);
          expect(error.message).toBe(`name=${bad}`);
        }
      })
    );
  });

  it("compares byte arrays of differing length and content", () => {
    expect(bytesEqual(new Uint8Array([1, 2]), new Uint8Array([1]))).toBe(false);
    expect(bytesEqual(new Uint8Array([1, 3]), new Uint8Array([1, 2]))).toBe(false);
    expect(bytesEqual(new Uint8Array([]), new Uint8Array([]))).toBe(true);
  });

  it("keeps the first record per sha256 digest and counts the skipped duplicates", () => {
    const result = dedupeBySha256([
      { name: "a", sha256: "1" },
      { name: "b", sha256: "1" },
      { name: "c", sha256: "2" },
    ]);
    expect(result.duplicatesSkipped).toBe(1);
    expect(A.map(result.kept, (record) => record.name)).toStrictEqual(["a", "c"]);
  });

  it("suffixes case-insensitive name collisions, data-first and data-last", () => {
    const used = HashSet.make("Photo.webp", "photo_01.webp");
    const first = allocateUniqueName("photo", ".webp", used);
    expect(first.targetName).toBe("photo_02.webp");
    const second = allocateUniqueName(".webp", first.usedTargetNames)("photo");
    expect(second.targetName).toBe("photo_03.webp");
    expect(HashSet.has(second.usedTargetNames, "photo_02.webp")).toBe(true);
  });
});
