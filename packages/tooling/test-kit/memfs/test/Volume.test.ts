import { MemoryFileSystem } from "@beep/memfs";
import * as internal from "@beep/memfs/internal/volume";
import { assert, describe, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { denied } from "./helpers.ts";

const encoder = new TextEncoder();

describe("MemoryFileSystem.layer — Volume, a synchronous read-only view of the volume backing FileSystem", () => {
  it.layer(MemoryFileSystem.layer, { timeout: "30 seconds" })((it) => {
    it.effect("THE INVARIANT: within one build, Volume inspects the same volume backing FileSystem", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const volume = yield* MemoryFileSystem.Volume;

        yield* fs.makeDirectory("/managed", { recursive: true });
        yield* fs.writeFileString("/managed/output.txt", "written through fs");
        assert.strictEqual(
          volume.text("/managed/output.txt"),
          "written through fs",
          "a write through FileSystem is immediately visible to Volume: one volume, two views"
        );
        assert.isTrue(volume.has("/managed"));

        yield* fs.remove("/managed/output.txt");
        assert.isUndefined(volume.text("/managed/output.txt"), "the view is live, not a copy taken at build");
        assert.isFalse(volume.has("/managed/output.txt"));
      })
    );
  });

  it.effect("per-build semantics hold — two provides are two volumes, each pair internally consistent", () =>
    Effect.gen(function* () {
      const probe = Effect.fnUntraced(function* () {
        const context = yield* Layer.build(MemoryFileSystem.layer);
        const fs = Context.get(context, FileSystem.FileSystem);
        const volume = Context.get(context, MemoryFileSystem.Volume);
        assert.isFalse(volume.has("/scratch.txt"), "the other build's write is absent: a fresh volume");
        yield* fs.writeFileString("/scratch.txt", "mine");
        assert.strictEqual(volume.text("/scratch.txt"), "mine", "this build's own write is present: a consistent pair");
      });

      yield* probe();
      yield* probe();
    })
  );
});

describe("MemoryFileSystem.layerWith — Volume", () => {
  const Seeded = MemoryFileSystem.layerWith({
    "/repo/package.json": `{ "name": "fixture" }`,
    "/repo/bin/run.sh": MemoryFileSystem.file("#!/bin/sh\n", { mode: 0o755 }),
    "/repo/empty": MemoryFileSystem.directory(),
    "/repo/latest": MemoryFileSystem.symlink("/repo/package.json"),
    "/repo/dangling": MemoryFileSystem.symlink("/repo/absent"),
  });

  it.layer(Seeded, { timeout: "30 seconds" })((it) => {
    it.effect("seed parity with layerWith — every entry kind lands, inspectable and readable", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const volume = yield* MemoryFileSystem.Volume;

        assert.strictEqual(
          volume.text("/repo/package.json"),
          `{ "name": "fixture" }`,
          "seeded files answer through both views"
        );
        const readFileString1 = yield* fs.readFileString("/repo/package.json");
        assert.strictEqual(readFileString1, `{ "name": "fixture" }`);
        assert.strictEqual((yield* fs.stat("/repo/bin/run.sh")).mode & 0o777, 0o755);

        assert.isTrue(volume.has("/repo/package.json"));
        assert.isTrue(volume.has("/repo/empty"));
        assert.isTrue(volume.has("/repo/latest"));
        assert.isTrue(volume.has("/repo/dangling"), "has() counts the symlink itself; its target is never consulted");
        assert.isFalse(volume.has("/repo/absent"));

        assert.isUndefined(
          volume.text("/repo/latest"),
          "the literal view: a symlink has no content of its own; reading through it is FileSystem's job"
        );
        assert.isUndefined(volume.bytes("/repo/empty"), "a directory has no content either");
        const readFileString2 = yield* fs.readFileString("/repo/latest");
        assert.strictEqual(readFileString2, `{ "name": "fixture" }`);
      })
    );
  });

  it.layer(Seeded, { timeout: "30 seconds" })((it) => {
    it.effect("snapshot and paths list regular files only — seeded AND written, sorted, no dirs or symlinks", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const volume = yield* MemoryFileSystem.Volume;

        yield* fs.writeFileString("/repo/written.txt", "later");

        const snapshot = volume.snapshot();
        assert.deepStrictEqual(R.keys(snapshot).sort(), [
          "/repo/bin/run.sh",
          "/repo/package.json",
          "/repo/written.txt",
        ]);
        assert.deepStrictEqual(snapshot["/repo/written.txt"], encoder.encode("later"));

        assert.deepStrictEqual(
          volume.paths(),
          ["/repo/bin/run.sh", "/repo/package.json", "/repo/written.txt"],
          "paths() is exactly snapshot's key set, sorted lexicographically"
        );
      })
    );
  });

  it.layer(MemoryFileSystem.layer, { timeout: "30 seconds" })((it) => {
    it.effect("honest absence — undefined for absent paths, '' only for a genuinely empty file", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const volume = yield* MemoryFileSystem.Volume;

        assert.isUndefined(
          volume.text("/absent/changesets/config.json"),
          'the honest-absence contract on the sync view: absence is undefined, never a fabricated ""'
        );
        assert.isUndefined(volume.bytes("/absent.bin"));

        yield* fs.writeFileString("/empty.txt", "");
        assert.strictEqual(volume.text("/empty.txt"), "", '"" round-trips for a real empty file, distinct from absent');
        assert.deepStrictEqual(volume.bytes("/empty.txt"), new Uint8Array());
      })
    );
  });

  it.layer(MemoryFileSystem.layer, { timeout: "30 seconds" })((it) => {
    it.effect("queries normalize lexically — '//', '.', '..' and relative paths resolve, symlinks stay literal", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const volume = yield* MemoryFileSystem.Volume;
        yield* fs.makeDirectory("/a/b", { recursive: true });
        yield* fs.writeFileString("/a/b/c.txt", "found");

        assert.strictEqual(volume.text("/a//b/./c.txt"), "found");
        assert.strictEqual(volume.text("/a/x/../b/c.txt"), "found");
        assert.strictEqual(
          volume.text("a/b/c.txt"),
          "found",
          "relative paths resolve from the virtual root, matching the engine"
        );
        yield* fs.symlink("/a/b", "/link");
        assert.isTrue(volume.has("/link"));
        assert.isFalse(volume.isDirectory("/link"));
        assert.isFalse(
          volume.has("/link/c.txt"),
          "symlinks stay literal, never followed even mid-path: nothing lives under the link in this view"
        );
        assert.isUndefined(volume.text("/link/c.txt"));
        assert.isUndefined(volume.readDirectory("/link"));
      })
    );
  });

  it.layer(MemoryFileSystem.layer, { timeout: "30 seconds" })((it) => {
    it.effect("returned byte arrays are defensive copies — mutating them cannot corrupt the volume", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const volume = yield* MemoryFileSystem.Volume;
        yield* fs.writeFileString("/data.bin", "abc");

        const stolen = volume.bytes("/data.bin");
        assert.isDefined(stolen);
        stolen?.fill(0);
        assert.strictEqual(volume.text("/data.bin"), "abc");
        const readFileString3 = yield* fs.readFileString("/data.bin");
        assert.strictEqual(readFileString3, "abc");
      })
    );
  });

  it.effect("a contradictory seed dies — a wiring bug, mirroring layerWith", () =>
    Effect.gen(function* () {
      const exit = yield* MemoryFileSystem.layerWith({ "/a": "file", "/a/b": "child" }).pipe(Layer.build, Effect.exit);
      assert.isTrue(exit._tag === "Failure");
    })
  );
});

describe("inspection composed under fault injection", () => {
  it.layer(
    MemoryFileSystem.layerFaulty({
      writeFileString: (path) => (path === "/blocked.txt" ? Effect.fail(denied("writeFileString", path)) : undefined),
    }).pipe(Layer.provideMerge(MemoryFileSystem.layerWith({ "/seed.txt": "seeded" }))),
    { timeout: "30 seconds" }
  )((it) => {
    it.effect("delegated writes land in the volume; a faulted write does not", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const volume = yield* MemoryFileSystem.Volume;

        yield* fs.writeFileString("/allowed.txt", "landed");
        assert.strictEqual(volume.text("/allowed.txt"), "landed", "the delegating branch really writes, as a spy must");

        const error = yield* Effect.flip(fs.writeFileString("/blocked.txt", "never"));
        assert.strictEqual(error.reason._tag, "PermissionDenied");
        assert.isFalse(volume.has("/blocked.txt"), "the faulted branch fails typed and leaves no trace in the volume");
        assert.deepStrictEqual(volume.paths(), ["/allowed.txt", "/seed.txt"]);
      })
    );
  });
});

describe("the templates-fixture acceptance sketch", () => {
  it.layer(MemoryFileSystem.layer, { timeout: "30 seconds" })((it) => {
    it.effect("write-then-read-back assertions become vol.text(path)", () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const vol = yield* MemoryFileSystem.Volume;

        const path = "/repo/.github/workflows/release.yml";
        yield* fs.makeDirectory("/repo/.github/workflows", { recursive: true });
        yield* fs.writeFileString(path, "# BEGIN managed\njobs: {}\n# END managed\n");

        assert.strictEqual(
          vol.text(path),
          "# BEGIN managed\njobs: {}\n# END managed\n",
          "the managed file's final content reads synchronously, replacing a hand-rolled Map double's files.get"
        );
        assert.isTrue(vol.has("/repo/.github"));
        assert.deepStrictEqual(vol.paths(), [path]);
      })
    );
  });
});

describe("MemoryFileSystemVolume.mtime: a seedable mtime read synchronously, as a signature-diff test needs", () => {
  it.effect("a seeded mtime is readable, and distinct files keep distinct times", () =>
    Effect.gen(function* () {
      const { volume } = yield* MemoryFileSystem.makeHandle({
        "/pkg/src/old.ts": MemoryFileSystem.file("old", { mtime: 1_000 }),
        "/pkg/src/new.ts": MemoryFileSystem.file("new", { mtime: 9_000 }),
      });
      assert.strictEqual(volume.mtime("/pkg/src/old.ts"), 1_000);
      assert.strictEqual(volume.mtime("/pkg/src/new.ts"), 9_000);
    })
  );

  it.effect("HONEST ABSENCE: an absent path is undefined, never a 1970 timestamp", () =>
    Effect.gen(function* () {
      const { volume } = yield* MemoryFileSystem.makeHandle({
        "/epoch.txt": MemoryFileSystem.file("at the epoch", { mtime: 0 }),
      });
      assert.strictEqual(volume.mtime("/epoch.txt"), 0, "0 is a real modification time");
      assert.strictEqual(
        volume.mtime("/absent.txt"),
        undefined,
        "a signature over mtimes must tell 0 from absent; conflating them is a silent green"
      );
    })
  );

  it.effect("a write restamps the entry from the Effect Clock — which under test starts at the epoch", () =>
    Effect.gen(function* () {
      const { fileSystem, volume } = yield* MemoryFileSystem.makeHandle({
        "/tracked.txt": MemoryFileSystem.file("before", { mtime: 1_000 }),
      });
      assert.strictEqual(volume.mtime("/tracked.txt"), 1_000);

      yield* fileSystem.writeFileString("/tracked.txt", "after");
      assert.strictEqual(
        volume.mtime("/tracked.txt"),
        0,
        "writes stamp the Effect Clock, not Date.now(): at the test epoch a write reads 0 and a seeded 1_000 is the future"
      );

      yield* TestClock.adjust("5 seconds");
      yield* fileSystem.writeFileString("/tracked.txt", "later");
      assert.strictEqual(volume.mtime("/tracked.txt"), 5_000, "the next write lands where the clock was moved to");
    })
  );

  it.effect("utimes through the FileSystem is visible to the view", () =>
    Effect.gen(function* () {
      const { fileSystem, volume } = yield* MemoryFileSystem.makeHandle({
        "/a.txt": "contents",
      });
      yield* fileSystem.utimes("/a.txt", 5_000, 5_000);
      assert.strictEqual(
        volume.mtime("/a.txt"),
        5_000_000,
        "utimes reads a number as Unix seconds: the unit trap the seed option converts away from"
      );
      const stamp = DateTime.toDateUtc(DateTime.makeUnsafe(1_234_567));
      yield* fileSystem.utimes("/a.txt", stamp, stamp);
      assert.strictEqual(volume.mtime("/a.txt"), 1_234_567, "a Date is unambiguous and round-trips in milliseconds");
    })
  );

  it.effect("mtime agrees with what stat reports through the FileSystem", () =>
    Effect.gen(function* () {
      const { fileSystem, volume } = yield* MemoryFileSystem.makeHandle({
        "/a.txt": MemoryFileSystem.file("contents", { mtime: 4_242 }),
      });
      const info = yield* fileSystem.stat("/a.txt");
      const fromStat = O.getOrThrow(info.mtime).getTime();
      assert.strictEqual(
        volume.mtime("/a.txt"),
        fromStat,
        "one clock, two views: the sync accessor must not drift from stat"
      );
    })
  );

  it.effect("directories carry an mtime too", () =>
    Effect.gen(function* () {
      const { volume } = yield* MemoryFileSystem.makeHandle({
        "/dir": MemoryFileSystem.directory(),
      });
      assert.isDefined(volume.mtime("/dir"));
    })
  );
});

describe("engine snapshot size", () => {
  it.effect("reports file bytes, symlink target length and 0 for directories", () =>
    Effect.gen(function* () {
      const { fileSystem, entries } = yield* internal.makeInspectableWith(
        internal.EngineOptions.make({ caseSensitive: true })
      );
      yield* fileSystem.makeDirectory("/d");
      yield* fileSystem.writeFileString("/d/f.txt", "héllo");
      yield* fileSystem.symlink("/d/f.txt", "/d/l");
      const byPath = HashMap.fromIterable(A.map(entries(), (e) => [e.path, e] as const));
      const sizeAt = (path: string) => O.getOrUndefined(HashMap.get(byPath, path))?.size;
      assert.strictEqual(sizeAt("/d/f.txt"), 6);
      assert.strictEqual(sizeAt("/d/l"), 8);
      assert.strictEqual(sizeAt("/d"), 0);
    })
  );
});

describe("engine name ordering", () => {
  it.effect("directory and glob names retain default UTF-16 ordering", () =>
    Effect.gen(function* () {
      const handle = yield* MemoryFileSystem.makeHandle({
        "/mixed/ä": "umlaut",
        "/mixed/a": "lower",
        "/mixed/Z": "upper",
      });
      const readDirectory4 = yield* handle.fileSystem.readDirectory("/mixed");
      assert.deepStrictEqual(readDirectory4, ["Z", "a", "ä"]);
      const glob5 = yield* handle.fileSystem.glob("*", { root: "/mixed" });
      assert.deepStrictEqual(glob5, ["Z", "a", "ä"]);
      assert.deepStrictEqual(handle.volume.readDirectory("/mixed"), ["Z", "a", "ä"]);
    })
  );

  it.effect("new-tree and existing-directory copies retain localeCompare traversal order", () =>
    Effect.gen(function* () {
      const fs = yield* MemoryFileSystem.makeWith({
        "/source/Z": "upper",
        "/source/ä": "umlaut",
        "/source/a": "lower",
        "/existing": MemoryFileSystem.directory(),
      });
      yield* fs.copy("/source", "/new");
      yield* fs.copy("/source", "/existing", { overwrite: true });
      const upstreamComparatorOrder = ["Z", "ä", "a"].sort((left, right) => Str.localeCompare(right)(left));
      for (const destination of ["/new", "/existing"]) {
        let previous = BigInt(-1);
        for (const name of upstreamComparatorOrder) {
          const inode = (yield* fs.stat(`${destination}/${name}`)).ino;
          if (O.isNone(inode)) return assert.fail("copied entries must carry inode numbers");
          assert.isTrue(inode.value > previous, `inode ${inode.value} must be above ${previous}`);
          previous = inode.value;
        }
      }
    })
  );
});
