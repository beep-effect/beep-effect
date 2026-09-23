import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { FileSystem, Path } from "@beep/utils";
import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import { expect, it } from "@effect/vitest";
import { Effect, Option, pipe } from "effect";
import * as Crypto from "effect/Crypto";

const NFS: typeof import("node:fs") = createRequire(import.meta.url)("node:fs");

const makeTempDir = Effect.fn("FileSystemTest.makeTempDir")(function* () {
  const crypto = yield* Crypto.Crypto;
  const uuid = yield* crypto.randomUUIDv4;
  const dir = Path.join(tmpdir(), `beep-fs-${uuid}`);
  NFS.mkdirSync(dir, { recursive: true });
  return dir;
});

const cleanup = (dir: string): void => NFS.rmSync(dir, { recursive: true, force: true });

it.layer(NodeCrypto.layer)("FileSystem sync wrappers", (it) => {
  it.effect(
    "appendFileSync appends to a file, creating it",
    Effect.fnUntraced(function* () {
      const dir = yield* makeTempDir();
      try {
        const file = Path.join(dir, "log.txt");
        yield* FileSystem.appendFileSync(file, "a");
        yield* FileSystem.appendFileSync(file, "b");
        yield* pipe(file, FileSystem.appendFileSync("c", { flag: "a" }));
        expect(NFS.readFileSync(file, "utf8")).toBe("abc");
      } finally {
        cleanup(dir);
      }
    })
  );

  it.effect(
    "existsSync reports presence without a failure channel",
    Effect.fnUntraced(function* () {
      const dir = yield* makeTempDir();
      try {
        const file = Path.join(dir, "present.txt");
        yield* FileSystem.appendFileSync(file, "x");
        expect(yield* FileSystem.existsSync(file)).toBe(true);
        expect(yield* FileSystem.existsSync(Path.join(dir, "absent.txt"))).toBe(false);
      } finally {
        cleanup(dir);
      }
    })
  );

  it.effect(
    "statSync returns a File.Info with branded bigint size",
    Effect.fnUntraced(function* () {
      const dir = yield* makeTempDir();
      try {
        const file = Path.join(dir, "data.txt");
        yield* FileSystem.appendFileSync(file, "hello");
        const fileInfo = yield* FileSystem.statSync(file);
        expect(fileInfo.type).toBe("File");
        expect(typeof fileInfo.size).toBe("bigint");
        expect(fileInfo.size).toBe(5n);
        expect(Option.isSome(fileInfo.mtime)).toBe(true);

        const dirInfo = yield* FileSystem.statSync(dir);
        expect(dirInfo.type).toBe("Directory");
      } finally {
        cleanup(dir);
      }
    })
  );

  it.effect(
    "readdirSync lists names, and Dirent entries with { withFileTypes: true }",
    Effect.fnUntraced(function* () {
      const dir = yield* makeTempDir();
      try {
        yield* FileSystem.appendFileSync(Path.join(dir, "file.txt"), "x");
        NFS.mkdirSync(Path.join(dir, "sub"));

        const names = yield* FileSystem.readdirSync(dir);
        expect([...names].sort()).toEqual(["file.txt", "sub"]);

        const entries = yield* FileSystem.readdirSync(dir, { withFileTypes: true });
        const subEntry = entries.find((entry) => entry.name === "sub");
        expect(Option.isSome(Option.fromNullishOr(subEntry))).toBe(true);
        expect(subEntry?.isDirectory()).toBe(true);
      } finally {
        cleanup(dir);
      }
    })
  );

  it.effect(
    "renameSync moves a path",
    Effect.fnUntraced(function* () {
      const dir = yield* makeTempDir();
      try {
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
      } finally {
        cleanup(dir);
      }
    })
  );

  it.effect(
    "rmSync removes a populated directory with { recursive, force }",
    Effect.fnUntraced(function* () {
      const dir = yield* makeTempDir();
      try {
        const target = Path.join(dir, "tree");
        NFS.mkdirSync(target);
        yield* FileSystem.appendFileSync(Path.join(target, "leaf.txt"), "x");
        yield* FileSystem.rmSync(target, { recursive: true, force: true });
        expect(yield* FileSystem.existsSync(target)).toBe(false);
      } finally {
        cleanup(dir);
      }
    })
  );

  it.effect(
    "maps ENOENT to a PlatformError whose reason is NotFound",
    Effect.fnUntraced(function* () {
      const crypto = yield* Crypto.Crypto;
      const uuid = yield* crypto.randomUUIDv4;
      const error = yield* Effect.flip(FileSystem.statSync(Path.join(tmpdir(), `beep-missing-${uuid}`)));
      expect(error.reason._tag).toBe("NotFound");
      expect(error.reason.module).toBe("FileSystem");
      expect(error.reason.method).toBe("statSync");
    })
  );
});
