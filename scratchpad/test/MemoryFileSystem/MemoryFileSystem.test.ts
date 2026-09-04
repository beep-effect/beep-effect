import { MemoryFileSystem } from "@beep/scratchpad/memfs"
import { assert, describe, it } from "@effect/vitest"
import { Effect, Fiber, FileSystem, Option, type PlatformError, Result, Stream } from "effect"
import * as A from "effect/Array"
import { TestClock } from "effect/testing"

const encoder = new TextEncoder()

const watchEvents = Effect.fnUntraced(function*(
  path: string,
  count: number,
  mutation: Effect.Effect<void, PlatformError.PlatformError>,
  options?: FileSystem.WatchOptions
) {
  const fs = yield* FileSystem.FileSystem
  const events = yield* fs.watch(path, options).pipe(
    Stream.take(count),
    Stream.runCollect,
    Effect.forkChild({ startImmediately: true })
  )

  yield* mutation
  return Array.from(yield* Fiber.join(events))
})

// TODO: Add when the FileSystemTest suite is available
// FileSystemTest.suite("memory", MemoryFileSystem.layer)

describe("fresh MemoryFileSystem test layers", () => {
  it.layer(MemoryFileSystem.layer)("first virtual volume", (it) => {
    it.effect("writes to its virtual volume",
      Effect.fnUntraced(function*() {
        const fs = yield* FileSystem.FileSystem
        yield* fs.writeFileString("/shared.txt", "shared")
        assert.strictEqual(yield* fs.readFileString("/shared.txt"), "shared")
      }))
  })

  it.layer(MemoryFileSystem.layer)("second virtual volume", (it) => {
    it.effect("starts empty",
      Effect.fnUntraced(function*() {
        const fs = yield* FileSystem.FileSystem
        assert.isFalse(yield* fs.exists("/shared.txt"))
      }))
  })
})

it.layer(MemoryFileSystem.layer)("FileSystem (memory-specific)", (it) => {
  describe("POSIX filesystem profile", () => {
    it.effect("should resolve dot, dot-dot, and repeated separators",
      Effect.fnUntraced(function*() {
        const fs = yield* FileSystem.FileSystem
        yield* fs.makeDirectory("/paths/child", { recursive: true })
        yield* fs.writeFileString("/paths/parent.txt", "parent")
        yield* fs.writeFileString("/paths/child/./file.txt", "child")

        assert.strictEqual(
          yield* fs.realPath("/paths/child/../parent.txt"),
          "/paths/parent.txt"
        )
        assert.strictEqual(
          yield* fs.realPath("/paths//child//file.txt"),
          "/paths/child/file.txt"
        )
      }))

    it.effect("should operate on a final symbolic link itself when removing or renaming it",
      Effect.fnUntraced(function*() {
        const fs = yield* FileSystem.FileSystem
        yield* fs.writeFileString("/target.txt", "target")
        yield* fs.symlink("target.txt", "/link.txt")

        yield* fs.rename("/link.txt", "/renamed-link.txt")
        assert.strictEqual(yield* fs.readLink("/renamed-link.txt"), "target.txt")
        assert.strictEqual(yield* fs.readFileString("/target.txt"), "target")

        yield* fs.remove("/renamed-link.txt")
        assert.strictEqual(yield* fs.readFileString("/target.txt"), "target")
      }))

    it.effect("should follow a final symbolic link for ordinary file operations",
      Effect.fnUntraced(function*() {
        const fs = yield* FileSystem.FileSystem
        yield* fs.writeFileString("/follow-target.txt", "before")
        yield* fs.symlink("follow-target.txt", "/follow-link.txt")

        yield* fs.writeFileString("/follow-link.txt", "after")

        assert.strictEqual(yield* fs.readLink("/follow-link.txt"), "follow-target.txt")
        assert.strictEqual(yield* fs.readFileString("/follow-target.txt"), "after")
        assert.strictEqual(yield* fs.realPath("/follow-link.txt"), "/follow-target.txt")
      }))

    it.effect("should fail when removing a missing path with force disabled",
      Effect.fnUntraced(function*() {
        const fs = yield* FileSystem.FileSystem
        const result = yield* Effect.result(fs.remove("/missing-without-force.txt", { force: false }))

        assert.isTrue(Result.isFailure(result))
        if (Result.isFailure(result)) {
          assert.strictEqual(result.failure.reason._tag, "NotFound")
          if (result.failure.reason._tag === "NotFound") {
            assert.strictEqual(result.failure.reason.pathOrDescriptor, "/missing-without-force.txt")
          }
        }
      }))

    it.effect("should reject exclusive creation when a dangling symbolic link exists",
      Effect.fnUntraced(function*() {
        const fs = yield* FileSystem.FileSystem
        yield* fs.symlink("missing.txt", "/dangling-link.txt")

        const result = yield* Effect.result(fs.writeFileString("/dangling-link.txt", "content", { flag: "wx" }))

        assert.isTrue(Result.isFailure(result))
        assert.strictEqual(yield* fs.readLink("/dangling-link.txt"), "missing.txt")
        assert.isFalse(yield* fs.exists("/missing.txt"))
      }))

    it.effect("should leave both names unchanged when renaming one hard link over another",
      Effect.fnUntraced(function*() {
        const fs = yield* FileSystem.FileSystem
        yield* fs.writeFileString("/source.txt", "content")
        yield* fs.link("/source.txt", "/destination.txt")

        yield* fs.rename("/source.txt", "/destination.txt")

        assert.strictEqual(yield* fs.readFileString("/source.txt"), "content")
        assert.strictEqual(yield* fs.readFileString("/destination.txt"), "content")
      }))

    it.effect("should report the destination path when copy overwrite is disabled",
      Effect.fnUntraced(function*() {
        const fs = yield* FileSystem.FileSystem
        yield* fs.writeFileString("/copy-source.txt", "source")
        yield* fs.writeFileString("/copy-destination.txt", "destination")

        const result = yield* Effect.result(
          fs.copy("/copy-source.txt", "/copy-destination.txt", { overwrite: false })
        )

        assert.isTrue(Result.isFailure(result))
        if (Result.isFailure(result)) {
          assert.strictEqual(result.failure.reason._tag, "AlreadyExists")
          if (result.failure.reason._tag === "AlreadyExists") {
            assert.strictEqual(result.failure.reason.pathOrDescriptor, "/copy-destination.txt")
          }
        }
        assert.strictEqual(yield* fs.readFileString("/copy-destination.txt"), "destination")
      }))
  })

  it.effect("should serialize concurrent appends and exclusive creates",
    Effect.fnUntraced(function*() {
      const fs = yield* FileSystem.FileSystem
      const appendPath = "/concurrent-append.txt"
      const createPath = "/exclusive-create.txt"
      yield* fs.writeFileString(appendPath, "")
      const first = yield* fs.open(appendPath, { flag: "a" })
      const second = yield* fs.open(appendPath, { flag: "a" })

      yield* Effect.all([
        first.writeAll(encoder.encode("A")),
        second.writeAll(encoder.encode("B"))
      ], { concurrency: "unbounded", discard: true })

      const creates = yield* Effect.all([
        fs.writeFileString(createPath, "first", { flag: "wx" }).pipe(Effect.result),
        fs.writeFileString(createPath, "second", { flag: "wx" }).pipe(Effect.result)
      ], { concurrency: "unbounded" })

      const contents = yield* fs.readFileString(appendPath)
      assert.isTrue(contents === "AB" || contents === "BA")
      assert.strictEqual(creates.filter(Result.isSuccess).length, 1)
      assert.strictEqual(creates.filter(Result.isFailure).length, 1)
    }))

  it.effect("should leave bytes unchanged when file-size mutations are invalid",
    Effect.fnUntraced(function*() {
      const fs = yield* FileSystem.FileSystem
      const path = "/invalid-size.txt"
      yield* fs.writeFileString(path, "content")
      const file = yield* fs.open(path, { flag: "r+" })

      yield* file.seek(Number.MAX_SAFE_INTEGER, "start")
      assert.isTrue(Result.isFailure(yield* Effect.result(file.writeAll(new Uint8Array([1])))))

      for (const size of [-1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
        const result = yield* Effect.result(file.truncate(size))
        assert.isTrue(Result.isFailure(result))
        if (Result.isFailure(result)) {
          assert.strictEqual(result.failure.reason._tag, "BadArgument")
          assert.strictEqual(result.failure.reason.method, "truncate")
        }
      }

      assert.strictEqual(yield* fs.readFileString(path), "content")
    }))

  it.effect("should store POSIX metadata without enforcing a virtual user identity",
    Effect.fnUntraced(function*() {
      const fs = yield* FileSystem.FileSystem
      yield* TestClock.setTime(1_000)
      yield* fs.writeFileString("/metadata.txt", "content")
      yield* fs.chmod("/metadata.txt", 0o000)
      yield* fs.chown("/metadata.txt", 42, 84)
      yield* fs.utimes("/metadata.txt", 1, 2)

      const info = yield* fs.stat("/metadata.txt")
      assert.strictEqual(info.mode & 0o7777, 0o000)
      assert.strictEqual(Option.getOrThrow(info.uid), 42)
      assert.strictEqual(Option.getOrThrow(info.gid), 84)
      assert.strictEqual(Option.getOrThrow(info.atime).getTime(), 1_000)
      assert.strictEqual(Option.getOrThrow(info.mtime).getTime(), 2_000)

      yield* fs.access("/metadata.txt", { readable: true, writable: true })
    }))

  it.effect("should not traverse directory symbolic links while globbing",
    Effect.fnUntraced(function*() {
      const fs = yield* FileSystem.FileSystem
      yield* fs.makeDirectory("/glob/real", { recursive: true })
      yield* fs.writeFileString("/glob/real/file.ts", "content")
      yield* fs.symlink("real", "/glob/linked")

      assert.deepStrictEqual(
        yield* fs.glob("**/*.ts", { root: "/glob" }),
        ["real/file.ts"]
      )
    }))

  it.effect("should fail through the typed channel when copying a directory beyond the nesting bound",
    Effect.fnUntraced(function*() {
      const fs = yield* FileSystem.FileSystem
      const nestedPath = `/bounded-source/${A.join(A.makeBy(258, (index) => `level-${index}`), "/")}`
      yield* fs.makeDirectory(nestedPath, { recursive: true })

      const result = yield* Effect.result(fs.copy("/bounded-source", "/bounded-copy"))

      assert.isTrue(Result.isFailure(result))
      if (Result.isFailure(result)) {
        assert.strictEqual(result.failure.reason._tag, "BadResource")
        assert.strictEqual(result.failure.reason.method, "copy")
      }
      assert.isFalse(yield* fs.exists("/bounded-copy"))
    }))

  it.effect("should publish committed normalized events for memory mutations",
    Effect.fnUntraced(function*() {
      const fs = yield* FileSystem.FileSystem
      yield* fs.makeDirectory("/watch-events")

      const events = yield* watchEvents(
        "/watch-events",
        6,
        Effect.gen(function*() {
          yield* fs.writeFileString("/watch-events/file.txt", "content")
          yield* fs.writeFileString("/watch-events/file.txt", "updated")
          yield* fs.remove("/watch-events/file.txt")
          yield* fs.writeFileString("/watch-events/old.txt", "content")
          yield* fs.rename("/watch-events/old.txt", "/watch-events/new.txt")
        })
      )

      assert.deepStrictEqual(events, [
        { _tag: "Create", path: "/watch-events/file.txt" },
        { _tag: "Update", path: "/watch-events/file.txt" },
        { _tag: "Remove", path: "/watch-events/file.txt" },
        { _tag: "Create", path: "/watch-events/old.txt" },
        { _tag: "Remove", path: "/watch-events/old.txt" },
        { _tag: "Create", path: "/watch-events/new.txt" }
      ])
    }))

  it.effect("should publish updates through every current hard-link path",
    Effect.fnUntraced(function*() {
      const fs = yield* FileSystem.FileSystem
      yield* fs.writeFileString("/original.txt", "content")
      yield* fs.link("/original.txt", "/alias.txt")

      const events = yield* watchEvents(
        "/alias.txt",
        1,
        fs.writeFileString("/original.txt", "updated")
      )

      assert.deepStrictEqual(events, [{ _tag: "Update", path: "/alias.txt" }])
    }))

  it.effect("should distinguish non-recursive and recursive directory watches",
    Effect.fnUntraced(function*() {
      const fs = yield* FileSystem.FileSystem
      yield* fs.makeDirectory("/watch-tree/nested", { recursive: true })

      const directEvents = yield* watchEvents(
        "/watch-tree",
        1,
        Effect.gen(function*() {
          yield* fs.writeFileString("/watch-tree/nested/ignored.txt", "nested")
          yield* fs.writeFileString("/watch-tree/direct.txt", "direct")
        }),
        { recursive: false }
      )
      const recursiveEvents = yield* watchEvents(
        "/watch-tree",
        2,
        Effect.gen(function*() {
          yield* fs.writeFileString("/watch-tree/nested/included.txt", "nested")
          yield* fs.writeFileString("/watch-tree/also-direct.txt", "direct")
        }),
        { recursive: true }
      )

      assert.deepStrictEqual(directEvents, [
        { _tag: "Create", path: "/watch-tree/direct.txt" }
      ])
      assert.deepStrictEqual(recursiveEvents, [
        { _tag: "Create", path: "/watch-tree/nested/included.txt" },
        { _tag: "Create", path: "/watch-tree/also-direct.txt" }
      ])
    }))
})
