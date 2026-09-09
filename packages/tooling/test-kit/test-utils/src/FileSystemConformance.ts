/**
 * Filesystem conformance cases pinned to Effect 4.0.0-rc.112.
 *
 * @packageDocumentation
 * @category testing
 * @since 0.0.0
 */

/*
 * Adapted from Effect-TS/effect packages/effect/test/FileSystem.test-utils.ts
 * Commit: 2600f62f4532026928454dcea8d1c48557b3f942
 * Source SHA256: 8725010039e5ef2cee8b9b4fbcdb076f4099e8a44fe393a8e032c5fd89808abe
 *
 * MIT License
 *
 * Copyright (c) 2023 Effectful Technologies Inc
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

// Conformance tests build each subject layer independently; resources close before that layer.
// This entrypoint is the explicit D14 provision exception, limited to the rule below.
// @effect-diagnostics strictEffectProvide:skip-file

import { $TestUtilsId } from "@beep/identity/packages";
import { assert, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as Fs from "effect/FileSystem";
import { constant, dual } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const $I = $TestUtilsId.create("FileSystemConformance");

class TestLayerSettings extends S.Class<TestLayerSettings>($I`TestLayerSettings`)(
  {
    accessOnDirectory: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      $I.annoteKey("TestLayerSettings.accessOnDirectory", {
        description: "Whether writable access to a directory is supported; defaults to true.",
      })
    ),
    tempFileScopedRemovesDirectory: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(true)),
      $I.annoteKey("TestLayerSettings.tempFileScopedRemovesDirectory", {
        description: "Whether a scoped temporary file removes its containing directory; defaults to true.",
      })
    ),
  },
  $I.annote("TestLayerSettings", {
    description: "Resolved platform capabilities for the pinned filesystem conformance suite.",
  })
) {}

/**
 * Structural options accepted by the pinned filesystem suite, with both flags optional and defaulting to true.
 *
 * **Details**
 *
 * Setting `accessOnDirectory` to false skips writable-directory access, as required
 * by Deno's open-based access check. Setting `tempFileScopedRemovesDirectory` to
 * false omits only the containing-directory removal assertion; file removal is
 * still required. Empty options and individually omitted flags retain the defaults.
 *
 * @category configuration
 * @since 0.0.0
 */
export type TestLayerOptions = S.Struct.MakeIn<typeof TestLayerSettings.fields>;

// Exact bytes of the pinned Node/Deno text fixtures. Each use allocates through
// the subject filesystem; no host path, host read or public seed API is involved.
const textFixture = Effect.gen(function* () {
  const fs = yield* Fs.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped();
  const path = `${root}/text.txt`;
  yield* fs.writeFileString(path, "lorem ipsum dolar sit amet\n");
  return path;
});

// These fixtures register cleanup in the caller's scope. They never close a
// scope themselves, so each test controls when its resources are released.
const temporaryDirectory = Effect.gen(function* () {
  const fs = yield* Fs.FileSystem;
  return yield* Effect.acquireRelease(fs.makeTempDirectory(), (directory) =>
    fs.remove(directory, { recursive: true }).pipe(Effect.orDie)
  );
});

const writtenFile = Effect.fnUntraced(function* (text: string) {
  const fs = yield* Fs.FileSystem;
  const root = yield* fs.makeTempDirectoryScoped();
  const path = yield* fs.makeTempFile({ directory: root });
  yield* fs.writeFileString(path, text);
  return path;
});

const openTextFixture = Effect.gen(function* () {
  const fs = yield* Fs.FileSystem;
  const path = yield* textFixture;
  return yield* fs.open(path);
});

const openTemporaryFile = Effect.fnUntraced(function* (flag: Fs.OpenFlag) {
  const fs = yield* Fs.FileSystem;
  const path = yield* fs.makeTempFileScoped();
  const file = yield* fs.open(path, { flag });
  return { path, file };
});

// Preserve readAlloc's missing-chunk failure and File.write's single-write
// behavior; neither operation adds retries or changes cursor handling.
const readText = Effect.fnUntraced(function* (file: Fs.File, size: Fs.Size) {
  return yield* file.readAlloc(size).pipe(
    Effect.flatMap(Effect.fromOption),
    Effect.map((_) => new TextDecoder().decode(_))
  );
});

const writeText = Effect.fnUntraced(function* (file: Fs.File, text: string) {
  return yield* file.write(new TextEncoder().encode(text));
});

/**
 * Register all pinned Effect filesystem conformance cases against a subject layer, with a fresh build per test.
 *
 * **Details**
 *
 * D14 exception: the filesystem layer's lifecycle and isolation are under test.
 * Every case provides the subject independently; sharing `it.layer` would share
 * a memory volume across cases. A scope inside that provision releases temporary
 * resources before the subject layer is released. Shorter inner scopes retain
 * the assertions about resources surviving or disappearing after their release.
 *
 * Both `testLayer(layer, options)` and `testLayer(options)(layer)` register the
 * same suite. Options may be omitted in either form; a curried call registers
 * its tests only when it receives the subject layer.
 *
 * **Gotchas**
 *
 * Read fixtures are written through the subject, so fixture creation also requires
 * working scoped directories and writes. The upstream copy failure assertion still
 * requires the source path; a destination-path implementation fails that assertion.
 *
 * **Example** (Register the Node filesystem suite)
 *
 * ```ts
 * import { testLayer } from "@beep/test-utils/FileSystemConformance"
 * import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
 * import { describe } from "@effect/vitest"
 *
 * describe("Node filesystem conformance", () => {
 *   testLayer(NodeFileSystem.layer)
 * })
 * ```
 *
 * **Example** (Pipe a filesystem layer into the suite)
 *
 * ```ts
 * import { testLayer } from "@beep/test-utils/FileSystemConformance"
 * import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem"
 * import { describe } from "@effect/vitest"
 * import { pipe } from "effect/Function"
 *
 * describe("Curried filesystem conformance", () => {
 *   pipe(NodeFileSystem.layer, testLayer())
 * })
 * ```
 *
 * @effects Registers Vitest tests that create, read, write and remove subject-local temporary resources.
 * @category testing
 * @since 0.0.0
 */
export const testLayer: {
  (options?: TestLayerOptions): <E>(layer: Layer.Layer<Fs.FileSystem, E>) => void;
  <E>(layer: Layer.Layer<Fs.FileSystem, E>, options?: TestLayerOptions): void;
} = dual(
  (args) => Layer.isLayer(args[0]),
  <E>(layer: Layer.Layer<Fs.FileSystem, E>, options: TestLayerOptions = {}): void => {
    const settings = TestLayerSettings.make(options);

    it.effect("readFile", () =>
      Effect.gen(function* () {
        const fs = yield* Fs.FileSystem;
        const path = yield* textFixture;
        const data = yield* fs.readFile(path);
        const text = new TextDecoder().decode(data);
        expect(Str.trim(text)).toEqual("lorem ipsum dolar sit amet");
      }).pipe(Effect.scoped, Effect.provide(layer))
    );

    it.effect("makeTempDirectory", () =>
      Effect.gen(function* () {
        const fs = yield* Fs.FileSystem;
        const testScope = yield* Effect.scope;
        let dir = "";
        yield* Effect.scoped(
          Effect.gen(function* () {
            // Keep the default unscoped call in the shorter scope. Register cleanup
            // on the enclosing test-resource scope without changing its lifetime.
            dir = yield* fs.makeTempDirectory().pipe(
              Effect.tap((directory) =>
                Scope.addFinalizer(testScope, fs.remove(directory, { recursive: true }).pipe(Effect.orDie))
              ),
              Effect.uninterruptible
            );
            const stat = yield* fs.stat(dir);
            expect(stat.type).toEqual("Directory");
          })
        );
        const stat = yield* fs.stat(dir);
        expect(stat.type).toEqual("Directory");
      }).pipe(Effect.scoped, Effect.provide(layer))
    );

    it.effect("makeTempDirectoryScoped", () =>
      Effect.gen(function* () {
        const fs = yield* Fs.FileSystem;
        let dir = "";
        yield* Effect.scoped(
          Effect.gen(function* () {
            dir = yield* fs.makeTempDirectoryScoped();
            const stat = yield* fs.stat(dir);
            expect(stat.type).toEqual("Directory");
          })
        );
        const error = yield* Effect.flip(fs.stat(dir));
        assert(error.reason._tag === "NotFound");
      }).pipe(Effect.provide(layer))
    );

    it.effect.skipIf(settings.accessOnDirectory === false)("access on a writable directory", () =>
      Effect.gen(function* () {
        const fs = yield* Fs.FileSystem;
        yield* Effect.scoped(
          Effect.gen(function* () {
            const dir = yield* fs.makeTempDirectoryScoped();
            yield* fs.access(dir, { writable: true });
          })
        );
      }).pipe(Effect.provide(layer))
    );

    it.effect("makeTempFileScoped cleans up", () =>
      Effect.gen(function* () {
        const fs = yield* Fs.FileSystem;
        yield* Effect.scoped(
          Effect.gen(function* () {
            const root = yield* fs.makeTempDirectoryScoped();
            let file = "";
            let dir = "";
            yield* Effect.scoped(
              Effect.gen(function* () {
                file = yield* fs.makeTempFileScoped({ directory: root });
                const separator = Num.max(
                  Str.lastIndexOf("/")(file).pipe(O.getOrElse(constant(-1))),
                  Str.lastIndexOf("\\")(file).pipe(O.getOrElse(constant(-1)))
                );
                assert(separator > 0, "Expected temp file path to contain a directory separator");
                dir = Str.slice(0, separator)(file);
                const stat = yield* fs.stat(dir);
                expect(stat.type).toEqual("Directory");
              })
            );
            const fileError = yield* Effect.flip(fs.stat(file));
            assert(fileError.reason._tag === "NotFound");
            if (settings.tempFileScopedRemovesDirectory !== false) {
              const directoryError = yield* Effect.flip(fs.stat(dir));
              assert(directoryError.reason._tag === "NotFound");
            }
          })
        );
      }).pipe(Effect.provide(layer))
    );

    it.effect("truncate", () =>
      Effect.gen(function* () {
        const fs = yield* Fs.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped();
        const file = yield* fs.makeTempFile({ directory: root });

        const text = "hello world";
        yield* fs.writeFile(file, new TextEncoder().encode(text));

        const before = yield* Effect.map(fs.readFile(file), (_) => new TextDecoder().decode(_));
        expect(before).toEqual(text);

        yield* fs.truncate(file);

        const after = yield* Effect.map(fs.readFile(file), (_) => new TextDecoder().decode(_));
        expect(after).toEqual("");
      }).pipe(Effect.scoped, Effect.provide(layer))
    );

    it.effect("writeFile with r+ overwrites without truncating", () =>
      Effect.gen(function* () {
        const fs = yield* Fs.FileSystem;
        const path = yield* writtenFile("abcdef");
        yield* fs.writeFileString(path, "xy", { flag: "r+" });

        assert.strictEqual(yield* fs.readFileString(path), "xycdef");
      }).pipe(Effect.scoped, Effect.provide(layer))
    );

    it.effect("writeFile with empty data honors the flag", () =>
      Effect.gen(function* () {
        const fs = yield* Fs.FileSystem;
        const path = yield* writtenFile("abc");
        yield* fs.writeFileString(path, "");
        assert.strictEqual(yield* fs.readFileString(path), "");

        yield* fs.writeFileString(path, "abc");
        yield* fs.writeFileString(path, "", { flag: "r+" });
        assert.strictEqual(yield* fs.readFileString(path), "abc");
      }).pipe(Effect.scoped, Effect.provide(layer))
    );

    it.effect("writeFile with r rejects writes", () =>
      Effect.gen(function* () {
        const fs = yield* Fs.FileSystem;
        const root = yield* fs.makeTempDirectoryScoped();
        const path = yield* fs.makeTempFile({ directory: root });

        const error = yield* fs.writeFileString(path, "data", { flag: "r" }).pipe(Effect.flip);

        assert(error.reason._tag !== "BadArgument");
        assert.strictEqual(error.reason.method, "writeFile");
        assert.strictEqual(error.reason.pathOrDescriptor, path);
        assert.strictEqual(yield* fs.readFileString(path), "");
      }).pipe(Effect.scoped, Effect.provide(layer))
    );

    it.effect("writeFile with a appends", () =>
      Effect.gen(function* () {
        const fs = yield* Fs.FileSystem;
        const path = yield* writtenFile("abc");
        yield* fs.writeFileString(path, "def", { flag: "a" });

        assert.strictEqual(yield* fs.readFileString(path), "abcdef");
      }).pipe(Effect.scoped, Effect.provide(layer))
    );

    it.effect("writeFile with wx exclusively creates", () =>
      Effect.gen(function* () {
        const fs = yield* Fs.FileSystem;
        const root = yield* temporaryDirectory;
        const path = `${root}/file.txt`;

        yield* fs.writeFileString(path, "first", { flag: "wx" });
        yield* fs.writeFileString(path, "second", { flag: "wx" }).pipe(Effect.flip);

        assert.strictEqual(yield* fs.readFileString(path), "first");
      }).pipe(Effect.scoped, Effect.provide(layer))
    );

    it.effect("copy with overwrite false creates a destination and preserves an existing destination", () =>
      Effect.gen(function* () {
        const fs = yield* Fs.FileSystem;
        const root = yield* temporaryDirectory;
        const source = `${root}/source.txt`;
        const destination = `${root}/destination.txt`;
        yield* fs.writeFileString(source, "source");
        assert.strictEqual(yield* fs.exists(destination), false);
        yield* fs.copy(source, destination, { overwrite: false });
        assert.strictEqual(yield* fs.readFileString(destination), "source");
        yield* fs.writeFileString(destination, "destination");

        const result = yield* Effect.result(fs.copy(source, destination, { overwrite: false }));

        if (Result.isFailure(result)) {
          assert(result.failure.reason._tag === "AlreadyExists");
          assert.strictEqual(result.failure.reason.method, "copy");
          assert.strictEqual(result.failure.reason.pathOrDescriptor, source);
        }
        assert.strictEqual(yield* fs.readFileString(source), "source");
        assert.strictEqual(yield* fs.readFileString(destination), "destination");
      }).pipe(Effect.scoped, Effect.provide(layer))
    );

    it.effect("should track the cursor position when reading", () =>
      Effect.gen(function* () {
        const fs = yield* Fs.FileSystem;

        yield* Effect.gen(function* () {
          let text: string;
          const path = yield* textFixture;
          const file = yield* fs.open(path);

          text = yield* readText(file, Fs.Size(5));
          expect(text).toBe("lorem");

          yield* file.seek(Fs.Size(7), "current");
          text = yield* readText(file, Fs.Size(5));
          expect(text).toBe("dolar");

          yield* file.seek(Fs.Size(1), "current");
          text = yield* readText(file, Fs.Size(8));
          expect(text).toBe("sit amet");

          yield* file.seek(Fs.Size(0), "start");
          text = yield* readText(file, Fs.Size(11));
          expect(text).toBe("lorem ipsum");

          text = yield* fs.stream(path, { offset: Fs.Size(6), bytesToRead: Fs.Size(5) }).pipe(
            Stream.map((_) => new TextDecoder().decode(_)),
            Stream.runCollect,
            Effect.map(A.join(""))
          );
          expect(text).toBe("ipsum");
        }).pipe(Effect.scoped);
      }).pipe(Effect.provide(layer))
    );

    it.effect("should read from a backwards seek", () =>
      Effect.gen(function* () {
        const file = yield* openTextFixture;

        const first = yield* readText(file, Fs.Size(5));
        expect(first).toBe("lorem");

        yield* file.seek(Fs.Size(-3), "current");
        const second = yield* readText(file, Fs.Size(3));
        expect(second).toBe("rem");
      }).pipe(Effect.scoped, Effect.provide(layer))
    );

    it.effect("should read sequentially without an intervening seek", () =>
      Effect.gen(function* () {
        const file = yield* openTextFixture;

        const first = yield* readText(file, Fs.Size(5));
        expect(first).toBe("lorem");

        const second = yield* readText(file, Fs.Size(6));
        expect(second).toBe(" ipsum");
      }).pipe(Effect.scoped, Effect.provide(layer))
    );

    it.effect("should track the cursor position when writing", () =>
      Effect.gen(function* () {
        const fs = yield* Fs.FileSystem;

        yield* Effect.gen(function* () {
          let text: string;
          const { path, file } = yield* openTemporaryFile("w+");

          yield* writeText(file, "lorem ipsum");
          yield* writeText(file, " ");
          yield* writeText(file, "dolor sit amet");
          text = yield* fs.readFileString(path);
          expect(text).toBe("lorem ipsum dolor sit amet");

          yield* file.seek(Fs.Size(-4), "current");
          yield* writeText(file, "hello world");
          text = yield* fs.readFileString(path);
          expect(text).toBe("lorem ipsum dolor sit hello world");

          yield* file.seek(Fs.Size(6), "start");
          yield* writeText(file, "blabl");
          text = yield* fs.readFileString(path);
          expect(text).toBe("lorem blabl dolor sit hello world");
        }).pipe(Effect.scoped);
      }).pipe(Effect.provide(layer))
    );

    it.effect("should maintain a read cursor in append mode", () =>
      Effect.gen(function* () {
        const fs = yield* Fs.FileSystem;

        yield* Effect.gen(function* () {
          let text: string;
          const { path, file } = yield* openTemporaryFile("a+");

          yield* writeText(file, "foo");
          yield* file.seek(Fs.Size(0), "start");

          yield* writeText(file, "bar");
          text = yield* fs.readFileString(path);
          expect(text).toBe("foobar");

          text = yield* readText(file, Fs.Size(3));
          expect(text).toBe("foo");

          yield* writeText(file, "baz");
          text = yield* fs.readFileString(path);
          expect(text).toBe("foobarbaz");

          text = yield* readText(file, Fs.Size(6));
          expect(text).toBe("barbaz");
        }).pipe(Effect.scoped);
      }).pipe(Effect.provide(layer))
    );

    it.effect("should restore the read cursor after an append write", () =>
      Effect.gen(function* () {
        const { file } = yield* openTemporaryFile("a+");

        yield* writeText(file, "foo");
        yield* file.seek(Fs.Size(0), "start");

        const first = yield* readText(file, Fs.Size(1));
        expect(first).toBe("f");

        yield* writeText(file, "bar");
        const second = yield* readText(file, Fs.Size(2));
        expect(second).toBe("oo");
      }).pipe(Effect.scoped, Effect.provide(layer))
    );

    it.effect("should keep the current cursor if truncating doesn't affect it", () =>
      Effect.gen(function* () {
        const { file } = yield* openTemporaryFile("w+");

        yield* writeText(file, "lorem ipsum dolor sit amet");
        yield* file.seek(Fs.Size(6), "start");
        yield* file.truncate(Fs.Size(11));

        const cursor = yield* file.seek(Fs.Size(0), "current");
        expect(cursor).toBe(Fs.Size(6));
      }).pipe(Effect.scoped, Effect.provide(layer))
    );

    it.effect("should update the current cursor if truncating affects it", () =>
      Effect.gen(function* () {
        const { file } = yield* openTemporaryFile("w+");

        yield* writeText(file, "lorem ipsum dolor sit amet");
        yield* file.truncate(Fs.Size(11));

        const cursor = yield* file.seek(Fs.Size(0), "current");
        expect(cursor).toBe(Fs.Size(11));
      }).pipe(Effect.scoped, Effect.provide(layer))
    );

    it.effect("should read from the clamped cursor after truncating", () =>
      Effect.gen(function* () {
        const fs = yield* Fs.FileSystem;

        yield* Effect.gen(function* () {
          const { path, file } = yield* openTemporaryFile("w+");

          yield* writeText(file, "abcdefghij");
          yield* file.truncate(Fs.Size(5));
          yield* fs.writeFile(path, new TextEncoder().encode("xyz"), { flag: "a" });

          const text = yield* readText(file, Fs.Size(3));
          expect(text).toBe("xyz");
        }).pipe(Effect.scoped);
      }).pipe(Effect.provide(layer))
    );
  }
);
