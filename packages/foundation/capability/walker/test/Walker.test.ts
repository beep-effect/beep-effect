import { MemoryFileSystem } from "@beep/memfs";
import { AscendOptions, DepthCap, Walker } from "@beep/walker/Walker";
import { assert, describe, it, layer } from "@effect/vitest";
import { assertExitFailure, assertNone, assertSome } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as PlatformError from "effect/PlatformError";
import * as R from "effect/Record";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import { platformWith } from "./support/fixtures.ts";

layer(Path.layer, { timeout: "10 seconds" })("Walker.ascend", (it) => {
  it.effect("the depth schema and ascent accept the same positive finite integers", () =>
    Effect.gen(function* () {
      for (const { maxDepth, valid } of [
        { maxDepth: 1, valid: true },
        { maxDepth: 256, valid: true },
        { maxDepth: 2 ** 53, valid: true },
        { maxDepth: Number.MAX_VALUE, valid: true },
        { maxDepth: 0, valid: false },
        { maxDepth: -1, valid: false },
        { maxDepth: -2.5, valid: false },
        { maxDepth: 2.5, valid: false },
        { maxDepth: Number.NaN, valid: false },
        { maxDepth: Number.POSITIVE_INFINITY, valid: false },
        { maxDepth: Number.NEGATIVE_INFINITY, valid: false },
      ]) {
        assert.strictEqual(S.is(DepthCap)(maxDepth), valid);
        const decoded = yield* Effect.option(S.decodeEffect(AscendOptions)({ maxDepth }));
        assert.strictEqual(O.isSome(decoded), valid);
        const exit = yield* Effect.exit(Walker.ascend("/", { maxDepth }));
        assert.strictEqual(Exit.isSuccess(exit), valid);
        if (Exit.isSuccess(exit)) assert.deepStrictEqual(exit.value, ["/"]);
      }
    })
  );

  it.effect("yields each directory from start to the root, nearest first", () =>
    Effect.gen(function* () {
      const dirs = yield* Walker.ascend("/a/b/c");
      assert.deepStrictEqual(dirs, ["/a/b/c", "/a/b", "/a", "/"]);
    })
  );

  it.effect("stops a parent-relative start at its last '..' instead of stepping to '.'", () =>
    Effect.gen(function* () {
      const ascend1 = yield* Walker.ascend("../x");
      assert.deepStrictEqual(ascend1, ["../x", ".."]);
      const ascend2 = yield* Walker.ascend("../../a");
      assert.deepStrictEqual(ascend2, ["../../a", "../.."]);
      const ascend3 = yield* Walker.ascend("..");
      assert.deepStrictEqual(ascend3, [".."]);
    })
  );

  it.effect("terminates at the root fixpoint without exhausting maxDepth", () =>
    Effect.gen(function* () {
      const dirs = yield* Walker.ascend("/a");
      assert.deepStrictEqual(dirs, ["/a", "/"]);
    })
  );

  it.effect("stops at stopAt, inclusive", () =>
    Effect.gen(function* () {
      const dirs = yield* Walker.ascend("/a/b/c", { stopAt: "/a" });
      assert.deepStrictEqual(dirs, ["/a/b/c", "/a/b", "/a"]);
    })
  );

  it.effect("stops at a ceiling with a trailing separator", () =>
    Effect.gen(function* () {
      const dirs = yield* Walker.ascend("/a/b/c", { stopAt: "/a/" });
      assert.deepStrictEqual(dirs, ["/a/b/c", "/a/b", "/a"]);
    })
  );

  it.effect("stops at a ceiling carrying a dot segment", () =>
    Effect.gen(function* () {
      const dirs = yield* Walker.ascend("/a/b/c", { stopAt: "/a/./b" });
      assert.deepStrictEqual(dirs, ["/a/b/c", "/a/b"]);
    })
  );

  it.effect("stops at a ceiling carrying a parent segment", () =>
    Effect.gen(function* () {
      const dirs = yield* Walker.ascend("/a/b/c", { stopAt: "/a/b/x/.." });
      assert.deepStrictEqual(dirs, ["/a/b/c", "/a/b"]);
    })
  );

  it.effect("dies on a relative ceiling rather than resolving it against the working directory", () =>
    Effect.gen(function* () {
      const defect = yield* Effect.catchCause(Walker.ascend("/a/b/c", { stopAt: "b" }), (cause) =>
        cause.pipe(Cause.squash, Effect.succeed)
      );
      assert.instanceOf(defect, Error);
      assert.match(defect.message, /stopAt must be an absolute path/);
      assert.match(
        defect.message,
        /"b"/,
        "the ceiling is echoed as supplied; a normalized echo hides the caller's spelling"
      );
      assert.match(defect.message, /"\/a\/b\/c"/);
    })
  );

  it.effect("survives an absorbing caller that catches every typed failure", () =>
    Effect.gen(function* () {
      const absorb = <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.orElseSucceed(effect, () => ["absorbed"]);
      const absorbed = absorb(Walker.ascend("/a/b/c", { stopAt: "b" }));
      const exit = yield* Effect.exit(absorbed);
      assertExitFailure(exit, Exit.isFailure(exit) ? exit.cause : Cause.empty);
    })
  );

  it.effect("dies on every relative ceiling shape", () =>
    Effect.gen(function* () {
      for (const stopAt of ["pkgs", "./pkgs", "../pkgs", ".", "..", ""]) {
        const exit = yield* Effect.exit(Walker.ascend("/a/b/c", { stopAt }));
        assertExitFailure(exit, Exit.isFailure(exit) ? exit.cause : Cause.empty);
      }
    })
  );

  it.effect("still ascends from a relative start when no ceiling is given", () =>
    Effect.gen(function* () {
      const dirs = yield* Walker.ascend("a/b");
      assert.deepStrictEqual(dirs, ["a/b", "a", "."]);
    })
  );

  it.effect("leaves an already-resolved ceiling unchanged", () =>
    Effect.gen(function* () {
      const path = yield* Path.Path;
      const ceiling = path.resolve("/fixture/repo");
      assert.strictEqual(ceiling, "/fixture/repo");
      const dirs = yield* Walker.ascend("/fixture/repo/packages/a", { stopAt: ceiling });
      assert.deepStrictEqual(dirs, ["/fixture/repo/packages/a", "/fixture/repo/packages", "/fixture/repo"]);
    })
  );

  it.effect("stops sanely when both start and the ceiling are the filesystem root", () =>
    Effect.gen(function* () {
      const ascend4 = yield* Walker.ascend("/", { stopAt: "/" });
      assert.deepStrictEqual(ascend4, ["/"], "at the root the ceiling break and the dirname fixpoint coincide");
      const ascend5 = yield* Walker.ascend("/a/b", { stopAt: "/" });
      assert.deepStrictEqual(ascend5, ["/a/b", "/a", "/"]);
    })
  );

  it.effect("yields the chain lexically even when the ceiling needed normalizing", () =>
    Effect.gen(function* () {
      const dirs = yield* Walker.ascend("/a/b/./c", { stopAt: "/a/" });
      assert.deepStrictEqual(dirs, ["/a/b/./c", "/a/b/.", "/a/b", "/a"]);
    })
  );

  it.effect("runs to the root when the ceiling names no ancestor", () =>
    Effect.gen(function* () {
      const dirs = yield* Walker.ascend("/a/b/c", { stopAt: "/x/y" });
      assert.deepStrictEqual(
        dirs,
        ["/a/b/c", "/a/b", "/a", "/"],
        "the control: the ceiling tests above stop for the right reason"
      );
    })
  );

  it.effect("truncates a chain longer than maxDepth", () =>
    Effect.gen(function* () {
      const dirs = yield* Walker.ascend("/a/b/c", { maxDepth: 2 });
      assert.deepStrictEqual(dirs, ["/a/b/c", "/a/b"]);
    })
  );

  it.effect("dies when maxDepth is below 1, rather than returning an empty chain", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(Walker.ascend("/a", { maxDepth: 0 }));
      assertExitFailure(exit, Exit.isFailure(exit) ? exit.cause : Cause.empty);
    })
  );

  it.effect("dies when maxDepth is NaN, rather than returning an empty chain", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(Walker.ascend("/a", { maxDepth: Number.NaN }));
      assertExitFailure(exit, Exit.isFailure(exit) ? exit.cause : Cause.empty);
    })
  );

  it.effect("dies when maxDepth is not an integer", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(Walker.ascend("/a", { maxDepth: 2.5 }));
      assertExitFailure(exit, Exit.isFailure(exit) ? exit.cause : Cause.empty);
    })
  );
});

describe("Walker.firstMatch", () => {
  it.effect("returns the first candidate whose predicate reports true", () =>
    Effect.gen(function* () {
      const found = yield* Walker.firstMatch(["a", "b", "c"], (c) => Effect.succeed(c === "b"));
      assertSome(found, "b");
    })
  );

  it.effect("returns none when nothing matches", () =>
    Effect.gen(function* () {
      const found = yield* Walker.firstMatch(["a", "b"], () => Effect.succeed(false));
      assertNone(found);
    })
  );

  it.effect("returns none for an empty candidate list", () =>
    Effect.gen(function* () {
      const found = yield* Walker.firstMatch([], () => Effect.succeed(true));
      assertNone(found);
    })
  );

  it.effect("absorbs a failing predicate per candidate and keeps scanning", () =>
    Effect.gen(function* () {
      const probed = yield* Ref.make<ReadonlyArray<string>>([]);
      const predicate = Effect.fn("predicate")(function* (c: string) {
        yield* Ref.update(probed, (seen) => [...seen, c]);
        if (c === "b") return yield* Effect.fail("EACCES");
        return c === "c";
      });

      const found = yield* Walker.firstMatch(["a", "b", "c"], predicate);

      assertSome(found, "c");
      const got = yield* Ref.get(probed);
      assert.deepStrictEqual(got, ["a", "b", "c"], "a failing probe must never abort the scan");
    })
  );

  it.effect("short-circuits at the first match and probes no further", () =>
    Effect.gen(function* () {
      const probed = yield* Ref.make<ReadonlyArray<string>>([]);
      const predicate = Effect.fn("predicate")(function* (c: string) {
        yield* Ref.update(probed, (seen) => [...seen, c]);
        return c === "b";
      });

      const found = yield* Walker.firstMatch(["a", "b", "c"], predicate);

      assertSome(found, "b");
      const got6 = yield* Ref.get(probed);
      assert.deepStrictEqual(got6, ["a", "b"], "an exhaustive probe-then-select would also probe c");
    })
  );

  it.effect("matches the very first candidate", () =>
    Effect.gen(function* () {
      const probed = yield* Ref.make<ReadonlyArray<string>>([]);
      const predicate = Effect.fn("predicate")(function* (c: string) {
        yield* Ref.update(probed, (seen) => [...seen, c]);
        return c === "a";
      });

      const found = yield* Walker.firstMatch(["a", "b"], predicate);

      assertSome(found, "a");
      const got7 = yield* Ref.get(probed);
      assert.deepStrictEqual(got7, ["a"], "the only test where index 0 wins; dropping it passes every other test");
    })
  );

  it.effect("propagates a defect rather than absorbing it", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        Walker.firstMatch(["a", "b"], (c) => (c === "b" ? Effect.die(new Error("boom")) : Effect.succeed(false)))
      );
      assertExitFailure(exit, Exit.isFailure(exit) ? exit.cause : Cause.empty);
    })
  );
});

const FsWith = (present: ReadonlyArray<string>) =>
  MemoryFileSystem.layerWith(R.fromEntries(A.map(present, (path) => [path, ""] as const)));

const FsDenying = (denied: string, present: ReadonlyArray<string>) =>
  MemoryFileSystem.layerWith(R.fromEntries(A.map(present, (path) => [path, ""] as const)), {
    faults: {
      exists: (path: string) =>
        path === denied
          ? Effect.fail(
              PlatformError.systemError({
                _tag: "PermissionDenied",
                module: "FileSystem",
                method: "exists",
                pathOrDescriptor: path,
              })
            )
          : undefined,
    },
  });

describe("Walker.findUpward callback contract", () => {
  it.effect("passes exactly one directory argument and preserves upstream probe order", () =>
    Effect.gen(function* () {
      let calls: ReadonlyArray<ReadonlyArray<string>> = [];
      const probed = yield* Ref.make<ReadonlyArray<string>>([]);
      const fs = FileSystem.makeNoop({
        exists: Effect.fn("exists")(function* (candidate: string) {
          yield* Ref.update(probed, (seen) => [...seen, candidate]);
          return candidate === "/far/.apprc" || candidate === "0/.apprc";
        }),
      });
      const found = yield* Walker.findUpward(["/near", "/far"], (...dirs: Array<string>) => {
        calls = [...calls, dirs];
        return A.map(dirs, (dir) => `${dir}/.apprc`);
      }).pipe(Effect.provideService(FileSystem.FileSystem, fs));
      assert.deepStrictEqual(calls, [["/near"], ["/far"]]);
      const got8 = yield* Ref.get(probed);
      assert.deepStrictEqual(got8, ["/near/.apprc", "/far/.apprc"]);
      assertSome(found, "/far/.apprc");
    })
  );
});

layer(FsWith(["/a/b/.apprc", "/a/.apprc"]), { timeout: "10 seconds" })(
  "findUpward, config in both directories",
  (it) => {
    it.effect("prefers the nearer directory", () =>
      Effect.gen(function* () {
        const found = yield* Walker.findUpward(["/a/b", "/a"], (dir) => [`${dir}/.apprc`]);
        assertSome(found, "/a/b/.apprc");
      })
    );
  }
);

layer(FsWith(["/a/.apprc"]), { timeout: "10 seconds" })("findUpward, config only in the further directory", (it) => {
  it.effect("falls through to the further directory", () =>
    Effect.gen(function* () {
      const found = yield* Walker.findUpward(["/a/b", "/a"], (dir) => [`${dir}/.apprc`]);
      assertSome(found, "/a/.apprc");
    })
  );
});

layer(FsWith(["/a/second.json"]), { timeout: "10 seconds" })("findUpward, only the second candidate exists", (it) => {
  it.effect("honours candidate order within a single directory", () =>
    Effect.gen(function* () {
      const found = yield* Walker.findUpward(["/a"], (dir) => [`${dir}/first.json`, `${dir}/second.json`]);
      assertSome(found, "/a/second.json");
    })
  );
});

layer(FsWith([]), { timeout: "10 seconds" })("findUpward, empty filesystem", (it) => {
  it.effect("returns none when no candidate exists", () =>
    Effect.gen(function* () {
      const found = yield* Walker.findUpward(["/a/b", "/a"], (dir) => [`${dir}/.apprc`]);
      assertNone(found);
    })
  );
});

layer(FsWith(["/a/b/config/.apprc", "/a/.apprc"]), { timeout: "10 seconds" })(
  "findUpward, near subpath vs far root file",
  (it) => {
    it.effect(
      "exhausts the nearer directory's candidates before ascending, so a far .apprc never beats a near config/.apprc",
      () =>
        Effect.gen(function* () {
          const found = yield* Walker.findUpward(["/a/b", "/a"], (dir) => [`${dir}/.apprc`, `${dir}/config/.apprc`]);
          assertSome(found, "/a/b/config/.apprc");
        })
    );
  }
);

layer(FsDenying("/a/b/.apprc", ["/a/b/.apprc", "/a/.apprc"]), { timeout: "10 seconds" })(
  "findUpward, unreadable nearer candidate",
  (it) => {
    it.effect("absorbs a denied probe on a present nearer candidate and keeps ascending", () =>
      Effect.gen(function* () {
        const found = yield* Walker.findUpward(["/a/b", "/a"], (dir) => [`${dir}/.apprc`]);
        assertSome(found, "/a/.apprc");
      })
    );
  }
);

describe("Walker.findRoot", () => {
  it.effect("returns the nearest directory the marker predicate accepts", () =>
    Effect.gen(function* () {
      const found = yield* Walker.findRoot(["/a/b/c", "/a/b", "/a"], (dir) => Effect.succeed(dir === "/a/b"));
      assertSome(found, "/a/b");
    })
  );

  it.effect("does not let an unreadable ancestor hide a valid root above it", () =>
    Effect.gen(function* () {
      const isRoot = (dir: string) => (dir === "/a/b" ? Effect.fail("EACCES" as const) : Effect.succeed(dir === "/a"));
      const found = yield* Walker.findRoot(["/a/b/c", "/a/b", "/a", "/"], isRoot);
      assertSome(found, "/a");
    })
  );

  it.effect("returns none when no directory is a root", () =>
    Effect.gen(function* () {
      const found = yield* Walker.findRoot(["/a/b", "/a"], () => Effect.succeed(false));
      assertNone(found);
    })
  );

  it.effect("prefers the nearest directory when multiple directories accept, never the last match", () =>
    Effect.gen(function* () {
      const found = yield* Walker.findRoot(["/a/b", "/a"], () => Effect.succeed(true));
      assertSome(found, "/a/b");
    })
  );

  it.effect("stops probing at the first accepting directory", () =>
    Effect.gen(function* () {
      const probed = yield* Ref.make<ReadonlyArray<string>>([]);
      const isRoot = Effect.fn("isRoot")(function* (dir: string) {
        yield* Ref.update(probed, (seen) => [...seen, dir]);
        return dir === "/a/b";
      });

      const found = yield* Walker.findRoot(["/a/b/c", "/a/b", "/a"], isRoot);

      assertSome(found, "/a/b");
      const got9 = yield* Ref.get(probed);
      assert.deepStrictEqual(
        got9,
        ["/a/b/c", "/a/b"],
        "a marker predicate can be expensive, so no ancestor above the root is probed"
      );
    })
  );
});

const linkedRepo = platformWith({ "/real/repo/packages/foo/x.txt": "x" }, { symlinks: { "/link": "/real" } });

layer(linkedRepo, { timeout: "10 seconds" })("Walker.ascendWithin", (it) => {
  it.effect("ascend's lexical stopAt misses the physical ceiling behind a symlink", () =>
    Effect.gen(function* () {
      const dirs = yield* Walker.ascend("/link/repo/packages/foo", { stopAt: "/real/repo" });
      assert.strictEqual(
        dirs.at(-1),
        "/",
        "the control: a chain through /link never spells the physical /real/repo, so ascend fails open"
      );
    })
  );

  it.effect("stops at the lexical ancestor whose real path is the physical ceiling", () =>
    Effect.gen(function* () {
      const dirs = yield* Walker.ascendWithin("/link/repo/packages/foo", O.some("/real/repo"));
      assert.deepStrictEqual(dirs, ["/link/repo/packages/foo", "/link/repo/packages", "/link/repo"]);
    })
  );

  it.effect("stops at a ceiling spelled lexically, like ascend", () =>
    Effect.gen(function* () {
      const dirs = yield* Walker.ascendWithin("/link/repo/packages/foo", O.some("/link/repo/"));
      assert.deepStrictEqual(dirs, ["/link/repo/packages/foo", "/link/repo/packages", "/link/repo"]);
    })
  );

  it.effect("stops at the ceiling when no symlink is involved", () =>
    Effect.gen(function* () {
      const dirs = yield* Walker.ascendWithin("/real/repo/packages/foo", O.some("/real/repo"));
      assert.deepStrictEqual(dirs, ["/real/repo/packages/foo", "/real/repo/packages", "/real/repo"]);
    })
  );

  it.effect("runs to the root when the ceiling names no ancestor", () =>
    Effect.gen(function* () {
      const dirs = yield* Walker.ascendWithin("/link/repo/packages/foo", O.some("/elsewhere"));
      assert.deepStrictEqual(dirs, ["/link/repo/packages/foo", "/link/repo/packages", "/link/repo", "/link", "/"]);
    })
  );

  it.effect("truncates a chain longer than maxDepth", () =>
    Effect.gen(function* () {
      const dirs = yield* Walker.ascendWithin("/link/repo/packages/foo", O.some("/real/repo"), { maxDepth: 2 });
      assert.deepStrictEqual(dirs, ["/link/repo/packages/foo", "/link/repo/packages"]);
    })
  );

  it.effect("ascends to the root, exactly as ascend does, when there is no ceiling", () =>
    Effect.gen(function* () {
      const dirs = yield* Walker.ascendWithin("/link/repo/packages/foo", O.none());
      const ascend10 = yield* Walker.ascend("/link/repo/packages/foo");
      assert.deepStrictEqual(dirs, ascend10);
      assert.strictEqual(dirs.at(-1), "/");
    })
  );

  it.effect("honours maxDepth when there is no ceiling", () =>
    Effect.gen(function* () {
      const dirs = yield* Walker.ascendWithin("/link/repo/packages/foo", O.none(), { maxDepth: 2 });
      assert.deepStrictEqual(dirs, ["/link/repo/packages/foo", "/link/repo/packages"]);
    })
  );

  it.effect("dies on a relative ceiling, like ascend", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(Walker.ascendWithin("/link/repo/packages/foo", O.some("real/repo")));
      assertExitFailure(exit, Exit.isFailure(exit) ? exit.cause : Cause.empty);
      assert.isTrue(Cause.hasDies(exit.cause));
    })
  );
});

layer(
  platformWith(
    { "/real/repo/packages/foo/x.txt": "x" },
    { symlinks: { "/link": "/real" }, unresolvable: { "/link/repo/packages": "PermissionDenied" } }
  ),
  { timeout: "10 seconds" }
)("Walker.ascendWithin, an ancestor that cannot be resolved", (it) => {
  it.effect("absorbs the failed probe and still stops at the ceiling above it", () =>
    Effect.gen(function* () {
      const dirs = yield* Walker.ascendWithin("/link/repo/packages/foo", O.some("/real/repo"));
      assert.deepStrictEqual(dirs, ["/link/repo/packages/foo", "/link/repo/packages", "/link/repo"]);
    })
  );
});
