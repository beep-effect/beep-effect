import { MemoryFileSystem } from "@beep/memfs";
import { NodeServices } from "@effect/platform-node";
import { assert, describe, layer } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ErrnoFields } from "../helpers.ts";

const { existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, statSync, symlinkSync, writeFileSync } =
  process.getBuiltinModule("node:fs");
const join = (...segments: ReadonlyArray<string>) => A.join(segments, "/");

interface StatLike {
  isDirectory(): boolean;
  isFile(): boolean;
  isSymbolicLink(): boolean;
  size: number;
}

const isStatLike = (value: StatLike | string | ReadonlyArray<string>): value is StatLike =>
  typeof value === "object" && value !== null && "isSymbolicLink" in value;

const statKind = (s: StatLike) => (s.isSymbolicLink() ? "symlink" : s.isDirectory() ? "directory" : "file");

const uncomparedHostDefinedSize = -1;

const valueOutcome = (value: StatLike | string | ReadonlyArray<string>) =>
  isStatLike(value)
    ? { kind: statKind(value), size: value.isFile() ? value.size : uncomparedHostDefinedSize }
    : { value };

const errorOutcome = (host: string, e: unknown) => {
  assert(S.is(ErrnoFields)(e));
  const error = e;
  assert(P.isString(error.message));
  return {
    code: error.code,
    syscall: error.syscall,
    message: A.join(Str.split(host)(error.message), "/r"),
    path: error.path === undefined ? undefined : A.join(Str.split(host)(error.path), "/r"),
  };
};

const outcome = (host: string, f: () => StatLike | string | ReadonlyArray<string>) => {
  try {
    return valueOutcome(f());
  } catch (e) {
    return errorOutcome(host, e);
  }
};

const unnormalizedHostPath = (host: string, name: string) => `${host}/${name}`;

const directoryAssertingCases = ["file.txt/", "dir/", "to-dir/"];

const cases = [
  "file.txt",
  "dir",
  "to-dir",
  "dangling",
  "loop-a",
  "file.txt/child",
  "nope",
  "bad-link",
  "to-dir/inner.txt",
  "dir/..",
  "file.txt/..",
  "nc-a",
  ...directoryAssertingCases,
];

const seed = {
  "/r/file.txt": "hello",
  "/r/dir/inner.txt": "x",
  "/r/to-dir": MemoryFileSystem.symlink("/r/dir"),
  "/r/dangling": MemoryFileSystem.symlink("/r/missing"),
  "/r/loop-a": MemoryFileSystem.symlink("/r/loop-b"),
  "/r/loop-b": MemoryFileSystem.symlink("/r/loop-a"),
  "/r/bad-link": MemoryFileSystem.symlink("/r/file.txt/child"),
  "/r/nc-a": MemoryFileSystem.symlink("/r/nc-b/x"),
  "/r/nc-b": MemoryFileSystem.symlink("/r/nc-a"),
};

layer(NodeServices.layer, { timeout: "30 seconds" })((it) => {
  const hostTree = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const host = yield* fs.makeTempDirectoryScoped({ prefix: "memfs-ports-" });
    yield* fs.writeFileString(join(host, "file.txt"), "hello");
    yield* fs.makeDirectory(join(host, "dir"));
    yield* fs.writeFileString(join(host, "dir", "inner.txt"), "x");
    yield* fs.symlink(join(host, "dir"), join(host, "to-dir"));
    yield* fs.symlink(join(host, "missing"), join(host, "dangling"));
    yield* fs.symlink(join(host, "loop-b"), join(host, "loop-a"));
    yield* fs.symlink(join(host, "loop-a"), join(host, "loop-b"));
    yield* fs.symlink(join(host, "file.txt", "child"), join(host, "bad-link"));
    yield* fs.symlink(join(host, "nc-b", "x"), join(host, "nc-a"));
    yield* fs.symlink(join(host, "nc-a"), join(host, "nc-b"));
    return host;
  });

  const hostBase = (prefix: string) =>
    Effect.flatMap(FileSystem.FileSystem, (fs) => fs.makeTempDirectoryScoped({ prefix }));

  describe("sync port parity with node:fs, the synchronous API and errno shapes Effect's FileSystem lacks", () => {
    it.effect("agrees with statSync, lstatSync, readFileSync and readdirSync on every case", () =>
      Effect.gen(function* () {
        const host = yield* hostTree;
        const { volume } = yield* MemoryFileSystem.makeHandle(seed);
        const sync = MemoryFileSystem.syncFileSystem(volume);
        for (const c of cases) {
          assert.deepStrictEqual(
            outcome(host, () => sync.stat(`/r/${c}`)),
            outcome(host, () => statSync(unnormalizedHostPath(host, c))),
            `stat ${c}: code, syscall, path and "<CODE>: <description>, <syscall> '<path>'" message, host prefix as /r`
          );
          assert.deepStrictEqual(
            outcome(host, () => sync.lstat(`/r/${c}`)),
            outcome(host, () => lstatSync(unnormalizedHostPath(host, c))),
            `lstat ${c}: a trailing slash follows the final link even here, ENOTDIR for a non-directory`
          );
          assert.deepStrictEqual(
            outcome(host, () => sync.readFile(`/r/${c}`)),
            outcome(host, () => readFileSync(unnormalizedHostPath(host, c), "utf8")),
            `readFile ${c}: an unnormalized path, so file.txt/.. keeps the kernel ENOTDIR path.join would fold away`
          );
          assert.deepStrictEqual(
            outcome(host, () => [...sync.readDirectory(`/r/${c}`)].sort()),
            outcome(host, () => readdirSync(unnormalizedHostPath(host, c)).sort()),
            `readDirectory ${c}: a trailing slash asserts a directory and lists it`
          );
        }
      })
    );

    it.effect("the promises port agrees with readdir, stat and readFile, dirents included", () =>
      Effect.gen(function* () {
        const host = yield* hostTree;
        const { volume } = yield* MemoryFileSystem.makeHandle(seed);
        const fsp = MemoryFileSystem.promisesFileSystem(volume);
        const settled = (f: () => Promise<unknown>) =>
          Effect.promise(() =>
            f().then(
              (value) => ({ value }),
              (e: { code: string; syscall: string }) => ({ code: e.code, syscall: e.syscall })
            )
          );
        const kinds = (d: { name: string; isFile(): boolean; isDirectory(): boolean; isSymbolicLink(): boolean }) => [
          d.name,
          d.isSymbolicLink() ? "symlink" : d.isDirectory() ? "directory" : d.isFile() ? "file" : "other",
        ];
        const memory = yield* Effect.promise(() => fsp.readdir("/r", { withFileTypes: true }));
        const real = readdirSync(host, { withFileTypes: true });
        assert.deepStrictEqual(A.map(memory, kinds).sort(), A.map(real, kinds).sort());
        for (const c of cases) {
          const memoryBytes = yield* settled(() => fsp.readFile(`/r/${c}`).then((b) => [...b]));
          const realBytes = yield* settled(() =>
            Promise.resolve().then(() => [...readFileSync(unnormalizedHostPath(host, c))])
          );
          assert.deepStrictEqual(
            memoryBytes,
            realBytes,
            `promises readFile without an encoding: bytes on both sides ${c}`
          );
          const memoryStat = yield* settled(() => fsp.stat(`/r/${c}`).then((s) => s.isFile()));
          const realStat = yield* settled(() =>
            Promise.resolve().then(() => statSync(unnormalizedHostPath(host, c)).isFile())
          );
          assert.deepStrictEqual(memoryStat, realStat, `promises stat ${c}`);
          const memoryDir = yield* settled(() => fsp.readdir(`/r/${c}`).then((names) => [...names].sort()));
          const realDir = yield* settled(() =>
            Promise.resolve().then(() => readdirSync(unnormalizedHostPath(host, c)).sort())
          );
          assert.deepStrictEqual(memoryDir, realDir, `promises readdir ${c}`);
        }
      })
    );
  });

  describe("handle mutators resolve '..' after links, as the host does", () => {
    it.effect("a write through link/.. lands where the link leads, on the host and in memfs", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const base = yield* hostBase("memfs-dotdot-");
        yield* fs.makeDirectory(join(base, "elsewhere", "dir"), { recursive: true });
        yield* fs.makeDirectory(join(base, "r"));
        yield* fs.symlink(join(base, "elsewhere", "dir"), join(base, "r", "link"));
        writeFileSync(`${base}/r/link/../abs.txt`, "h");
        assert.isTrue(existsSync(join(base, "elsewhere", "abs.txt")), "host: lands under elsewhere");
        assert.isFalse(existsSync(join(base, "r", "abs.txt")), "host: not under r");
        const vol = MemoryFileSystem.makeSync({ link: MemoryFileSystem.symlink("/elsewhere/dir") }, { root: "/r" });
        vol.mkdir("/elsewhere/dir");
        vol.write("/r/link/../abs.txt", "m");
        vol.write("link/../rel.txt", "m");
        assert.isTrue(vol.volume.has("/elsewhere/abs.txt"));
        assert.isTrue(vol.volume.has("/elsewhere/rel.txt"));
        assert.isFalse(vol.volume.has("/r/rel.txt"));
      })
    );
  });

  describe("handle mutators under a dangling or looping parent link, as the host reports", () => {
    it.effect("dangling parent: ENOENT on open; loop parent: ELOOP — host and memfs", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const base = yield* hostBase("memfs-parentlink-");
        const hostCode = (f: () => void) => {
          try {
            f();
            return "ok";
          } catch (e) {
            assert(S.is(ErrnoFields)(e));
            return e.code;
          }
        };
        const hostCall = (f: () => void) => {
          try {
            f();
            return "ok";
          } catch (e) {
            assert(S.is(ErrnoFields)(e));
            const { code, syscall } = e;
            return `${code} ${syscall}`;
          }
        };
        yield* fs.symlink(join(base, "missing"), join(base, "dang"));
        yield* fs.symlink(join(base, "loop"), join(base, "loop"));
        assert.strictEqual(
          hostCode(() => writeFileSync(`${base}/dang/x.txt`, "")),
          "ENOENT"
        );
        assert.strictEqual(
          hostCode(() => writeFileSync(`${base}/loop/x.txt`, "")),
          "ELOOP"
        );
        assert.strictEqual(
          hostCall(() => writeFileSync(`${base}/dang/sub/x.txt`, "")),
          "ENOENT open",
          "a dangling link above the direct parent"
        );
        assert.strictEqual(
          hostCall(() => writeFileSync(`${base}/loop/sub/x.txt`, "")),
          "ELOOP open",
          "a looping link above the direct parent"
        );
        assert.strictEqual(
          hostCall(() => symlinkSync("t", `${base}/dang/sub/x.txt`)),
          "ENOENT symlink"
        );
        assert.strictEqual(
          hostCall(() => symlinkSync("t", `${base}/loop/sub/x.txt`)),
          "ELOOP symlink"
        );
        const vol = MemoryFileSystem.makeSync(
          { dang: MemoryFileSystem.symlink("/r/missing"), loop: MemoryFileSystem.symlink("/r/loop") },
          { root: "/r" }
        );
        const memCode = (f: () => void) => {
          try {
            f();
            return "ok";
          } catch (e) {
            assert(S.is(ErrnoFields)(e));
            return e.code;
          }
        };
        assert.strictEqual(
          memCode(() => vol.write("dang/x.txt", "")),
          "ENOENT"
        );
        assert.strictEqual(
          memCode(() => vol.write("loop/x.txt", "")),
          "ELOOP"
        );
        const memCall = (f: () => void) => {
          try {
            f();
            return "ok";
          } catch (e) {
            assert(S.is(ErrnoFields)(e));
            const { code, syscall } = e;
            return `${code} ${syscall}`;
          }
        };
        assert.strictEqual(
          memCall(() => vol.write("dang/sub/x.txt", "")),
          "ENOENT open"
        );
        assert.strictEqual(
          memCall(() => vol.write("loop/sub/x.txt", "")),
          "ELOOP open"
        );
        assert.strictEqual(
          memCall(() => vol.symlink("t", "dang/sub/x.txt")),
          "ENOENT symlink"
        );
        assert.strictEqual(
          memCall(() => vol.symlink("t", "loop/sub/x.txt")),
          "ELOOP symlink"
        );
      })
    );
  });

  // decision: engine-errno-reference-is-adapter-callback
  describe("handle mkdir through links, as mkdirSync(p, { recursive: true }) reports, not the adapter's fs.mkdir", () => {
    const paths = [
      "dang",
      "dang/a/b",
      "loop",
      "loop/a/b",
      "file",
      "file/a/b",
      "filesym",
      "filesym/a/b",
      "dirsym",
      "dirsym/a/b",
    ] as const;
    const call = (f: () => void) => {
      try {
        f();
        return "ok";
      } catch (e) {
        assert(S.is(ErrnoFields)(e));
        const { code, syscall } = e;
        return `${code} ${syscall}`;
      }
    };
    it.effect("every path answers the host's code and syscall", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const base = yield* hostBase("memfs-mkdirlink-");
        const host = new Map<string, string>();
        for (const path of paths) {
          const root = yield* fs.makeTempDirectory({ directory: base, prefix: "case-" });
          yield* fs.symlink(join(root, "missing"), join(root, "dang"));
          yield* fs.symlink(join(root, "loop"), join(root, "loop"));
          yield* fs.writeFileString(join(root, "file"), "x");
          yield* fs.symlink(join(root, "file"), join(root, "filesym"));
          yield* fs.makeDirectory(join(root, "dir"));
          yield* fs.symlink(join(root, "dir"), join(root, "dirsym"));
          host.set(
            path,
            call(() => mkdirSync(`${root}/${path}`, { recursive: true }))
          );
        }
        for (const path of paths) {
          const vol = MemoryFileSystem.makeSync(
            {
              dang: MemoryFileSystem.symlink("/r/missing"),
              loop: MemoryFileSystem.symlink("/r/loop"),
              file: "x",
              filesym: MemoryFileSystem.symlink("/r/file"),
              "dir/.keep": "",
              dirsym: MemoryFileSystem.symlink("/r/dir"),
            },
            { root: "/r" }
          );
          assert.strictEqual(
            call(() => vol.mkdir(path)),
            host.get(path),
            path
          );
        }
        assert.deepStrictEqual(
          A.map(paths, (path) => host.get(path)),
          [
            "ENOENT mkdir",
            "ENOENT mkdir",
            "ELOOP mkdir",
            "ELOOP mkdir",
            "EEXIST mkdir",
            "ENOTDIR mkdir",
            "EEXIST mkdir",
            "ENOTDIR mkdir",
            "ok",
            "ok",
          ]
        );
      })
    );
  });
});
