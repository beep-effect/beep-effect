import { NodeSyncFileSystem } from "@beep/memfs/NodeSyncFileSystem";
import { assert, it, vi } from "@effect/vitest";
import { assertExitFailure, assertNone, assertSome } from "@effect/vitest/utils";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as P from "effect/Predicate";
import * as Stream from "effect/Stream";
import { deliberatelyInvalid } from "./deliberatelyInvalid.ts";

const node = process.getBuiltinModule("node:fs");
const fs = NodeSyncFileSystem.fileSystem;

it.effect("access combines readable and writable flags", () =>
  Effect.gen(function* () {
    const spy = vi.spyOn(node, "accessSync").mockImplementation(() => undefined);
    try {
      yield* fs.access("/virtual", { readable: true, writable: true });
      assert.deepStrictEqual(spy.mock.calls, [["/virtual", node.constants.R_OK | node.constants.W_OK]]);
    } finally {
      spy.mockRestore();
    }
  })
);

for (const kind of [
  "File",
  "Directory",
  "SymbolicLink",
  "BlockDevice",
  "CharacterDevice",
  "FIFO",
  "Socket",
  "Unknown",
] as const) {
  it.effect(`stat preserves ${kind} type and absent optional metadata`, () =>
    Effect.gen(function* () {
      const stat = {
        ...node.statSync(import.meta.filename, { bigint: true }),
        isFile: () => kind === "File",
        isDirectory: () => kind === "Directory",
        isSymbolicLink: () => kind === "SymbolicLink",
        isBlockDevice: () => kind === "BlockDevice",
        isCharacterDevice: () => kind === "CharacterDevice",
        isFIFO: () => kind === "FIFO",
        isSocket: () => kind === "Socket",
        rdev: undefined,
        ino: 9007199254740992n,
        nlink: undefined,
        uid: undefined,
        gid: undefined,
        blksize: undefined,
        blocks: undefined,
      };
      const spy = vi
        .spyOn(node, "statSync")
        .mockReturnValue(deliberatelyInvalid<ReturnType<typeof node.statSync>>(stat));
      try {
        const info = yield* fs.stat("/virtual");
        assert.strictEqual(info.type, kind);
        assert.strictEqual(info.dev, stat.dev);
        assertNone(info.rdev);
        assertSome(info.ino, stat.ino);
        assertNone(info.nlink);
        assertNone(info.uid);
        assertNone(info.gid);
        assertNone(info.blksize);
        assertNone(info.blocks);
      } finally {
        spy.mockRestore();
      }
    })
  );
}

it.effect("stat rejects numeric mode metadata outside the safe integer range", () =>
  Effect.gen(function* () {
    const stat = node.statSync(import.meta.filename, { bigint: true });
    stat.mode = 9007199254740992n;
    const spy = vi.spyOn(node, "statSync").mockReturnValue(deliberatelyInvalid<ReturnType<typeof node.statSync>>(stat));
    try {
      const error = yield* Effect.flip(fs.stat("/virtual"));
      assert.strictEqual(error.reason._tag, "BadArgument");
      if (error.reason._tag === "BadArgument")
        assert.include(error.reason.description, "mode exceeds the safe integer range");
    } finally {
      spy.mockRestore();
    }
  })
);

it.effect("stat preserves a non-Error conversion failure description", () =>
  Effect.gen(function* () {
    const stat = node.statSync(import.meta.filename, { bigint: true });
    const spy = vi.spyOn(node, "statSync").mockReturnValue(
      deliberatelyInvalid<ReturnType<typeof node.statSync>>({
        ...stat,
        isFile: () => {
          throw "conversion failed";
        },
      })
    );
    try {
      const error = yield* Effect.flip(fs.stat("/virtual"));
      assert.strictEqual(error.reason._tag, "BadArgument");
      if (error.reason._tag === "BadArgument") assert.strictEqual(error.reason.description, undefined);
    } finally {
      spy.mockRestore();
    }
  })
);

it.effect("stat preserves a message-bearing non-Error conversion failure description", () =>
  Effect.gen(function* () {
    const stat = node.statSync(import.meta.filename, { bigint: true });
    const spy = vi.spyOn(node, "statSync").mockReturnValue(
      deliberatelyInvalid<ReturnType<typeof node.statSync>>({
        ...stat,
        isFile: () => {
          throw { message: "busy" };
        },
      })
    );
    try {
      const error = yield* Effect.flip(fs.stat("/virtual"));
      assert.strictEqual(error.reason._tag, "BadArgument");
      if (error.reason._tag === "BadArgument") assert.strictEqual(error.reason.description, "busy");
    } finally {
      spy.mockRestore();
    }
  })
);

const hasNumericErrno = (thrown: unknown) => P.hasProperty(thrown, "errno") && P.isNumber(thrown.errno);
const hasDefinedSyscall = (thrown: unknown) => P.hasProperty(thrown, "syscall") && thrown.syscall !== undefined;
const isSystemThrown = (thrown: unknown) => hasNumericErrno(thrown) || hasDefinedSyscall(thrown);
const thrownSyscall = (thrown: unknown) =>
  P.hasProperty(thrown, "syscall") && P.isString(thrown.syscall) ? thrown.syscall : undefined;

for (const thrown of [
  "failure",
  { message: 42 },
  { errno: "invalid" },
  { syscall: undefined },
  { syscall: "access" },
  { errno: -5, code: 42, syscall: 42 },
] as const) {
  it.effect(`read boundary classifies ${String(thrown)} without assuming an Error`, () =>
    Effect.gen(function* () {
      const spy = vi.spyOn(node, "accessSync").mockImplementation(() => {
        throw thrown;
      });
      try {
        const error = yield* Effect.flip(fs.access("/virtual"));
        assert.strictEqual(error.reason._tag, isSystemThrown(thrown) ? "Unknown" : "BadArgument");
        if (error.reason._tag === "BadArgument") assert.strictEqual(error.reason.description, String(thrown));
        else {
          assert.strictEqual(error.reason.cause, thrown);
          assert.strictEqual(error.reason.syscall, thrownSyscall(thrown));
        }
      } finally {
        spy.mockRestore();
      }
    })
  );
}

it.effect("watch defects instead of reporting a recoverable filesystem error", () =>
  Effect.gen(function* () {
    const exit = yield* Stream.runDrain(fs.watch("/virtual")).pipe(Effect.exit);
    assertExitFailure(exit, Exit.isFailure(exit) ? exit.cause : Cause.empty);
    assert.isTrue(Cause.hasDies(exit.cause));
    assert.isFalse(Cause.hasFails(exit.cause));
    assert.include(Cause.pretty(exit.cause), "NodeSyncFileSystem is read-only: watch is not supported");
  })
);

it.effect("the utility class has no instance state even under reflective construction", () =>
  Effect.sync(() => {
    assert.strictEqual(Object.getPrototypeOf(Reflect.construct(NodeSyncFileSystem, [])), NodeSyncFileSystem.prototype);
  })
);

it.effect("lstat reports a symbolic link without following it", () =>
  Effect.gen(function* () {
    const stat = {
      ...node.lstatSync(import.meta.filename, { bigint: true }),
      isFile: () => false,
      isDirectory: () => false,
      isSymbolicLink: () => true,
      isBlockDevice: () => false,
      isCharacterDevice: () => false,
      isFIFO: () => false,
      isSocket: () => false,
    };
    const lstatSpy = vi
      .spyOn(node, "lstatSync")
      .mockReturnValue(deliberatelyInvalid<ReturnType<typeof node.lstatSync>>(stat));
    const statSpy = vi.spyOn(node, "statSync");
    try {
      const info = yield* fs.lstat("/virtual");
      assert.strictEqual(info.type, "SymbolicLink");
      assert.deepStrictEqual(lstatSpy.mock.calls, [["/virtual", { bigint: true }]]);
      assert.strictEqual(statSpy.mock.calls.length, 0);
    } finally {
      lstatSpy.mockRestore();
      statSpy.mockRestore();
    }
  })
);
