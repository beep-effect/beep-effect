// The differential oracle for NodeSyncFileSystem: every read member it serves
// must agree with @effect/platform-node's NodeFileSystem on the same real
// directory — success values identical, failures identical in tag, method and
// errno. The node adapter is the reference; a mismatch is a NodeSyncFileSystem
// bug. Each case builds its own fixture under a scoped host temp directory.

import { NodeSyncFileSystem } from "@beep/memfs/NodeSyncFileSystem";
import { NodeServices } from "@effect/platform-node";
import { assert, layer } from "@effect/vitest";
import { assertExitFailure, assertExitSuccess } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import { deliberatelyInvalid } from "../deliberatelyInvalid.ts";
import type * as PlatformError from "effect/PlatformError";

// Fixture paths are plain POSIX segments under a scoped temp directory.
const join = (...segments: ReadonlyArray<string>) => A.join(segments, "/");

// The subject, built once per use; its reads are compared with the harness's
// own FileSystem, which NodeServices serves from @effect/platform-node's
// NodeFileSystem — the reference implementation.
const nodeSync = Effect.map(Layer.build(NodeSyncFileSystem.layer), Context.get(FileSystem.FileSystem));

const failureShape = (exit: Exit.Exit<unknown, PlatformError.PlatformError>) => {
  if (Exit.isSuccess(exit)) return "success";
  const failure = O.getOrUndefined(A.findFirst(exit.cause.reasons, Cause.isFailReason));
  const error = failure?.error;
  const cause = error?.reason.cause;
  return {
    kind: error?._tag,
    reasonTag: error?.reason._tag,
    method: error?.reason.method,
    code: P.hasProperty(cause, "code") ? cause.code : undefined,
    syscall: P.hasProperty(cause, "syscall") ? cause.syscall : undefined,
  };
};

layer(NodeServices.layer, { timeout: "30 seconds" })("NodeSyncFileSystem agrees with NodeFileSystem", (it) => {
  // One fixture per case, under a scoped host temp directory, built through
  // the reference FileSystem itself.
  const fixture = Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const d = yield* fs.makeTempDirectoryScoped({ prefix: "memfs-node-sync-" });
    yield* fs.writeFileString(join(d, "f.txt"), "hello");
    yield* fs.makeDirectory(join(d, "dir"));
    yield* fs.writeFileString(join(d, "dir", "inner.txt"), "x");
    yield* fs.symlink(join(d, "dir"), join(d, "to-dir"));
    yield* fs.symlink(join(d, "missing"), join(d, "dangling"));
    return { fs, d };
  });

  // Runs `op` against the reference (the harness FileSystem) and the subject.
  const both = Effect.fnUntraced(function* <A>(
    op: (fs: FileSystem.FileSystem) => Effect.Effect<A, PlatformError.PlatformError>
  ) {
    const reference = yield* FileSystem.FileSystem;
    const subject = yield* nodeSync;
    return [yield* Effect.exit(op(reference)), yield* Effect.exit(op(subject))] as const;
  });

  // Paths under test: fixture entries, plus two argument errors node rejects
  // before any syscall (a NUL byte, a non-string) — BadArgument, not errno.
  const paths: ReadonlyArray<readonly [label: string, path: (d: string) => string]> = [
    ...A.map(
      ["f.txt", "dir", "to-dir", "dangling", "nope", "f.txt/child"],
      (p) => [p, (d: string) => join(d, p)] as const
    ),
    ["NUL byte", (d: string) => join(d, "a\0b")],
    ["non-string", () => deliberatelyInvalid<string>(42)],
  ];
  for (const [p, path] of paths) {
    it.effect(`stat ${p}: File.Info or failure identical`, () =>
      Effect.gen(function* () {
        const { d } = yield* fixture;
        const [a, b] = yield* both((fs) => fs.stat(path(d)));
        if (Exit.isSuccess(a)) assert.deepStrictEqual(Exit.isSuccess(b) ? b.value : b, a.value);
        else assert.deepStrictEqual(failureShape(b), failureShape(a));
      })
    );
    it.effect(`exists ${p}`, () =>
      Effect.gen(function* () {
        const { d } = yield* fixture;
        const [a, b] = yield* both((fs) => fs.exists(path(d)));
        if (Exit.isSuccess(a)) assert.deepStrictEqual(b, a);
        else assert.deepStrictEqual(failureShape(b), failureShape(a));
      })
    );
    it.effect(`readFile ${p}`, () =>
      Effect.gen(function* () {
        const { d } = yield* fixture;
        const [a, b] = yield* both((fs) => fs.readFile(path(d)));
        if (Exit.isSuccess(a)) assert.deepStrictEqual(b, a);
        else assert.deepStrictEqual(failureShape(b), failureShape(a));
      })
    );
    it.effect(`readDirectory ${p}`, () =>
      Effect.gen(function* () {
        const { d } = yield* fixture;
        const [a, b] = yield* both((fs) => fs.readDirectory(path(d)));
        if (Exit.isSuccess(a) && Exit.isSuccess(b)) assert.deepStrictEqual([...b.value].sort(), [...a.value].sort());
        else assert.deepStrictEqual(failureShape(b), failureShape(a));
      })
    );
    it.effect(`readFileString ${p}`, () =>
      Effect.gen(function* () {
        const { d } = yield* fixture;
        const [a, b] = yield* both((fs) => fs.readFileString(path(d)));
        if (Exit.isSuccess(a)) assert.deepStrictEqual(b, a);
        else assert.deepStrictEqual(failureShape(b), failureShape(a));
      })
    );
    it.effect(`readLink ${p}`, () =>
      Effect.gen(function* () {
        const { d } = yield* fixture;
        const [a, b] = yield* both((fs) => fs.readLink(path(d)));
        if (Exit.isSuccess(a)) assert.deepStrictEqual(b, a);
        else assert.deepStrictEqual(failureShape(b), failureShape(a));
      })
    );
    it.effect(`realPath ${p}`, () =>
      Effect.gen(function* () {
        const { d } = yield* fixture;
        const [a, b] = yield* both((fs) => fs.realPath(path(d)));
        if (Exit.isSuccess(a)) assert.deepStrictEqual(b, a);
        else assert.deepStrictEqual(failureShape(b), failureShape(a));
      })
    );
  }

  it.effect("readDirectory, plain and recursive", () =>
    Effect.gen(function* () {
      const { d } = yield* fixture;
      for (const options of [undefined, { recursive: true }] as const) {
        const [a, b] = yield* both((fs) => fs.readDirectory(d, options));
        assertExitSuccess(a, Exit.isSuccess(a) ? a.value : undefined);
        assertExitSuccess(b, Exit.isSuccess(b) ? b.value : undefined);
        assert.deepStrictEqual([...b.value].sort(), [...a.value].sort());
      }
    })
  );

  it.effect("readDirectory of a missing directory fails identically", () =>
    Effect.gen(function* () {
      const { d } = yield* fixture;
      const [a, b] = yield* both((fs) => fs.readDirectory(join(d, "nope")));
      assert.deepStrictEqual(failureShape(b), failureShape(a));
      assert.notStrictEqual(failureShape(a), "success");
    })
  );

  it.effect("realPath through a link", () =>
    Effect.gen(function* () {
      const { d } = yield* fixture;
      const [a, b] = yield* both((fs) => fs.realPath(join(d, "to-dir", "inner.txt")));
      assertExitSuccess(a, Exit.isSuccess(a) ? a.value : undefined);
      assert.deepStrictEqual(b, a);
    })
  );

  // The node adapter wraps the JS `fs.realpath`, which never canonicalizes
  // case; `realpathSync.native` would. On a case-folding host (default APFS)
  // this pins the JS form; on a case-sensitive host both fail NotFound alike.
  it.effect("realPath keeps the queried case, like the node adapter", () =>
    Effect.gen(function* () {
      const { d } = yield* fixture;
      const [a, b] = yield* both((fs) => fs.realPath(join(d, "DIR", "INNER.txt")));
      if (Exit.isSuccess(a)) assert.deepStrictEqual(b, a);
      else assert.deepStrictEqual(failureShape(b), failureShape(a));
    })
  );

  it.effect("the fileSystem value reads directly, without a layer", () =>
    Effect.gen(function* () {
      const { d } = yield* fixture;
      const viaValue = yield* NodeSyncFileSystem.fileSystem.readFileString(join(d, "f.txt"));
      assert.strictEqual(viaValue, "hello");
    })
  );

  it.effect("builds and reads without an asynchronous boundary", () =>
    Effect.gen(function* () {
      const { d } = yield* fixture;
      const program = Effect.gen(function* () {
        const context = yield* Layer.build(NodeSyncFileSystem.layer);
        return yield* Context.get(context, FileSystem.FileSystem).readFileString(join(d, "f.txt"));
      });
      // Effect.runSync's own criterion: a fiber started immediately has already
      // exited, because nothing in the build or the read ever suspended.
      const fiber = yield* Effect.forkChild(program, { startImmediately: true });
      const exit = fiber.pollUnsafe();
      if (exit === undefined) return assert.fail("expected the build and read to finish without suspending");
      assertExitSuccess(exit, "hello");
    })
  );

  for (const [member, run] of [
    ["writeFileString", (fs: FileSystem.FileSystem, d: string) => fs.writeFileString(join(d, "w.txt"), "")],
    ["makeDirectory", (fs: FileSystem.FileSystem, d: string) => fs.makeDirectory(join(d, "new"))],
    ["remove", (fs: FileSystem.FileSystem, d: string) => fs.remove(join(d, "f.txt"))],
    ["rename", (fs: FileSystem.FileSystem, d: string) => fs.rename(join(d, "f.txt"), join(d, "g.txt"))],
    ["copyFile", (fs: FileSystem.FileSystem, d: string) => fs.copyFile(join(d, "f.txt"), join(d, "g.txt"))],
    ["makeTempDirectory", (fs: FileSystem.FileSystem) => fs.makeTempDirectory()],
  ] as const) {
    it.effect(`${member} is a defect, not a typed failure, and touches nothing`, () =>
      Effect.gen(function* () {
        const { fs, d } = yield* fixture;
        const subject = yield* nodeSync;
        const before = (yield* fs.readDirectory(d)).sort();
        const exit = yield* Effect.exit(run(subject, d));
        assertExitFailure(exit, Exit.isFailure(exit) ? exit.cause : Cause.empty);
        assert.isTrue(Cause.hasDies(exit.cause));
        assert.isFalse(Cause.hasFails(exit.cause));
        assert.deepStrictEqual((yield* fs.readDirectory(d)).sort(), before);
        const readFileString1 = yield* fs.readFileString(join(d, "f.txt"), "utf8");
        assert.strictEqual(readFileString1, "hello");
      })
    );
  }
});
