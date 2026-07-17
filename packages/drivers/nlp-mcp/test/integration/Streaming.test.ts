import { StreamingToolkit, StreamingToolkitHandlersLive } from "@beep/nlp-mcp";
import { StreamingAllowedRoots } from "@beep/nlp-mcp/Streaming/TextStream";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { assert, describe, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Stream from "effect/Stream";
import { FetchHttpClient } from "effect/unstable/http";
import type { PlatformError } from "effect/PlatformError";

const TestLayer = StreamingToolkitHandlersLive.pipe(
  Layer.provideMerge(NodeFileSystem.layer),
  Layer.provideMerge(NodePath.layer),
  Layer.provideMerge(FetchHttpClient.layer)
);

const withTempFixture = <A, E, R>(
  name: string,
  content: string,
  use: (file: string) => Effect.Effect<A, E, R>
): Effect.Effect<A, E | PlatformError, R | FileSystem.FileSystem | Path.Path> =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    return yield* Effect.acquireUseRelease(
      fs.makeTempDirectory(),
      (dir) =>
        Effect.gen(function* () {
          const file = path.join(dir, name);
          yield* fs.writeFileString(file, content);
          // Configure the fixture's temp directory as the streaming tools' only
          // allowed read root, so the path-safety guard is exercised against a
          // legitimate in-root read rather than blocking the test's temp file.
          return yield* use(file).pipe(Effect.provideService(StreamingAllowedRoots, [dir]));
        }),
      (dir) => Effect.orDie(fs.remove(dir, { force: true, recursive: true }))
    );
  });

describe("StreamingToolkit integration", () => {
  layer(TestLayer)("file-backed streaming handlers", (it) => {
    it.effect("stream_read_lines returns lines from a temp file", () =>
      withTempFixture("read.txt", "alpha\nbeta\ngamma\n", (file) =>
        Effect.gen(function* () {
          const tk = yield* StreamingToolkit;
          const stream = yield* tk.handle("stream_read_lines", { path: file });
          const results = yield* Stream.runCollect(stream);
          const first = results[0];
          assert.isDefined(first);
          assert.strictEqual(first.isFailure, false);
          const output = first.encodedResult as { count: number; lines: ReadonlyArray<string>; truncated: boolean };
          assert.strictEqual(output.count, 3);
          assert.deepStrictEqual(output.lines, ["alpha", "beta", "gamma"]);
        })
      )
    );

    it.effect("stream_count_lines counts lines in a temp file", () =>
      withTempFixture("count.txt", "one\ntwo\nthree\nfour\n", (file) =>
        Effect.gen(function* () {
          const tk = yield* StreamingToolkit;
          const stream = yield* tk.handle("stream_count_lines", { path: file });
          const results = yield* Stream.runCollect(stream);
          const first = results[0];
          assert.isDefined(first);
          assert.strictEqual(first.isFailure, false);
          const output = first.encodedResult as { count: number };
          assert.strictEqual(output.count, 4);
        })
      )
    );

    it.effect("stream_text_stats reports aggregate statistics", () =>
      withTempFixture("stats.txt", "ab\ncdef\n\n", (file) =>
        Effect.gen(function* () {
          const tk = yield* StreamingToolkit;
          const stream = yield* tk.handle("stream_text_stats", { path: file });
          const results = yield* Stream.runCollect(stream);
          const first = results[0];
          assert.isDefined(first);
          assert.strictEqual(first.isFailure, false);
          const output = first.encodedResult as {
            maxLineLength: number;
            nonEmptyLines: number;
            totalLines: number;
          };
          assert.strictEqual(output.totalLines, 3);
          assert.strictEqual(output.nonEmptyLines, 2);
          assert.strictEqual(output.maxLineLength, 4);
        })
      )
    );

    it.effect("stream_read_jsonl skips an invalid line when skipInvalid is set", () =>
      withTempFixture("data.jsonl", '{"id":1}\nnot json\n{"id":2}\n', (file) =>
        Effect.gen(function* () {
          const tk = yield* StreamingToolkit;
          const stream = yield* tk.handle("stream_read_jsonl", { options: { skipInvalid: true }, path: file });
          const results = yield* Stream.runCollect(stream);
          const first = results[0];
          assert.isDefined(first);
          assert.strictEqual(first.isFailure, false);
          const output = first.encodedResult as { count: number; records: ReadonlyArray<unknown> };
          assert.strictEqual(output.count, 2);
          assert.deepStrictEqual(output.records, [{ id: 1 }, { id: 2 }]);
        })
      )
    );

    it.effect("stream_jsonl_stats counts success and error lines", () =>
      withTempFixture("stats.jsonl", '{"id":1}\nbroken\n{"id":2}\n', (file) =>
        Effect.gen(function* () {
          const tk = yield* StreamingToolkit;
          const stream = yield* tk.handle("stream_jsonl_stats", { path: file });
          const results = yield* Stream.runCollect(stream);
          const first = results[0];
          assert.isDefined(first);
          assert.strictEqual(first.isFailure, false);
          const output = first.encodedResult as { errorCount: number; successCount: number; totalLines: number };
          assert.strictEqual(output.totalLines, 3);
          assert.strictEqual(output.successCount, 2);
          assert.strictEqual(output.errorCount, 1);
        })
      )
    );

    it.effect("stream_process_file lowercases each line", () =>
      withTempFixture("process.txt", "Hello\nWORLD\n", (file) =>
        Effect.gen(function* () {
          const tk = yield* StreamingToolkit;
          const stream = yield* tk.handle("stream_process_file", { path: file, stages: ["lowercase"] });
          const results = yield* Stream.runCollect(stream);
          const first = results[0];
          assert.isDefined(first);
          assert.strictEqual(first.isFailure, false);
          const output = first.encodedResult as { processed: number; results: ReadonlyArray<unknown> };
          assert.strictEqual(output.processed, 2);
          assert.deepStrictEqual(output.results, ["hello", "world"]);
        })
      )
    );

    it.effect("stream_filter_lines keeps only matching lines", () =>
      withTempFixture("filter.txt", "apple\nbanana\napricot\n", (file) =>
        Effect.gen(function* () {
          const tk = yield* StreamingToolkit;
          const stream = yield* tk.handle("stream_filter_lines", { path: file, pattern: "^ap" });
          const results = yield* Stream.runCollect(stream);
          const first = results[0];
          assert.isDefined(first);
          assert.strictEqual(first.isFailure, false);
          const output = first.encodedResult as { count: number; lines: ReadonlyArray<string> };
          assert.strictEqual(output.count, 2);
          assert.deepStrictEqual(output.lines, ["apple", "apricot"]);
        })
      )
    );

    it.effect("stream_load_text loads a local file", () =>
      withTempFixture("load.txt", "loaded content", (file) =>
        Effect.gen(function* () {
          const tk = yield* StreamingToolkit;
          const stream = yield* tk.handle("stream_load_text", { location: file });
          const results = yield* Stream.runCollect(stream);
          const first = results[0];
          assert.isDefined(first);
          assert.strictEqual(first.isFailure, false);
          const output = first.encodedResult as { data: unknown; meta: { sourceType: string } };
          assert.strictEqual(output.data, "loaded content");
          assert.strictEqual(output.meta.sourceType, "file");
        })
      )
    );

    it.effect(
      "stream_load_text rejects IPv4-mapped internal URLs",
      Effect.fnUntraced(function* () {
        const tk = yield* StreamingToolkit;
        const assertBlocked = Effect.fn("assertBlocked")(function* (location: string) {
          const stream = yield* tk.handle("stream_load_text", { location });
          const results = yield* Stream.runCollect(stream);
          const first = results[0];
          assert.isDefined(first);
          assert.strictEqual(first.isFailure, true);
        });

        yield* assertBlocked("http://[::ffff:127.0.0.1]/data.txt");
        yield* assertBlocked("http://[::ffff:169.254.169.254]/latest/meta-data");
      })
    );

    it.effect("stream_file_info reports existence and line count", () =>
      withTempFixture("info.txt", "a\nbb\nccc\n", (file) =>
        Effect.gen(function* () {
          const tk = yield* StreamingToolkit;
          const stream = yield* tk.handle("stream_file_info", { path: file });
          const results = yield* Stream.runCollect(stream);
          const first = results[0];
          assert.isDefined(first);
          assert.strictEqual(first.isFailure, false);
          const output = first.encodedResult as { exists: boolean; lineCount?: number };
          assert.strictEqual(output.exists, true);
          assert.strictEqual(output.lineCount, 3);
        })
      )
    );

    it.effect("stream_sample_lines samples up to the requested size", () =>
      withTempFixture("sample.txt", "l1\nl2\nl3\nl4\nl5\n", (file) =>
        Effect.gen(function* () {
          const tk = yield* StreamingToolkit;
          const stream = yield* tk.handle("stream_sample_lines", { path: file, sampleSize: 3 });
          const results = yield* Stream.runCollect(stream);
          const first = results[0];
          assert.isDefined(first);
          assert.strictEqual(first.isFailure, false);
          const output = first.encodedResult as { count: number; lines: ReadonlyArray<string> };
          assert.strictEqual(output.count, 3);
          assert.strictEqual(output.lines.length, 3);
        })
      )
    );

    it.effect("stream_validate_jsonl returns records and collected errors", () =>
      withTempFixture("validate.jsonl", '{"id":1}\nbroken\n{"id":2}\n', (file) =>
        Effect.gen(function* () {
          const tk = yield* StreamingToolkit;
          const stream = yield* tk.handle("stream_validate_jsonl", { path: file });
          const results = yield* Stream.runCollect(stream);
          const first = results[0];
          assert.isDefined(first);
          assert.strictEqual(first.isFailure, false);
          const output = first.encodedResult as {
            count: number;
            errors?: ReadonlyArray<{ lineNumber: number }>;
            records: ReadonlyArray<unknown>;
            truncated: boolean;
          };
          assert.strictEqual(output.count, 2);
          assert.strictEqual(output.errors?.length, 1);
          assert.strictEqual(output.truncated, false);
        })
      )
    );

    it.effect("stream_validate_jsonl caps returned records and errors", () =>
      withTempFixture("validate-capped.jsonl", '{"id":1}\nbroken\n{"id":2}\nstill broken\n{"id":3}\n', (file) =>
        Effect.gen(function* () {
          const tk = yield* StreamingToolkit;
          const stream = yield* tk.handle("stream_validate_jsonl", {
            options: { maxErrors: 1, maxRecords: 2 },
            path: file,
          });
          const results = yield* Stream.runCollect(stream);
          const first = results[0];
          assert.isDefined(first);
          assert.strictEqual(first.isFailure, false);
          const output = first.encodedResult as {
            count: number;
            errors?: ReadonlyArray<{ lineNumber: number }>;
            records: ReadonlyArray<unknown>;
            truncated: boolean;
          };
          assert.strictEqual(output.count, 2);
          assert.deepStrictEqual(output.records, [{ id: 1 }, { id: 2 }]);
          assert.strictEqual(output.errors?.length, 1);
          assert.strictEqual(output.truncated, true);
        })
      )
    );

    it.effect("stream_sample_jsonl samples up to the requested size", () =>
      withTempFixture("sample.jsonl", '{"n":1}\n{"n":2}\n{"n":3}\n{"n":4}\n', (file) =>
        Effect.gen(function* () {
          const tk = yield* StreamingToolkit;
          const stream = yield* tk.handle("stream_sample_jsonl", {
            options: { skipInvalid: true },
            path: file,
            sampleSize: 2,
          });
          const results = yield* Stream.runCollect(stream);
          const first = results[0];
          assert.isDefined(first);
          assert.strictEqual(first.isFailure, false);
          const output = first.encodedResult as { count: number; records: ReadonlyArray<unknown> };
          assert.strictEqual(output.count, 2);
          assert.strictEqual(output.records.length, 2);
        })
      )
    );

    it.effect("stream_load_lines loads lines from a local file", () =>
      withTempFixture("load-lines.txt", "x\ny\nz\n", (file) =>
        Effect.gen(function* () {
          const tk = yield* StreamingToolkit;
          const stream = yield* tk.handle("stream_load_lines", { location: file, options: { skipEmpty: true } });
          const results = yield* Stream.runCollect(stream);
          const first = results[0];
          assert.isDefined(first);
          assert.strictEqual(first.isFailure, false);
          const output = first.encodedResult as { data: ReadonlyArray<string>; meta: { sourceType: string } };
          assert.deepStrictEqual(output.data, ["x", "y", "z"]);
          assert.strictEqual(output.meta.sourceType, "file");
        })
      )
    );

    it.effect("stream_load_jsonl loads JSONL records from a local file", () =>
      withTempFixture("load.jsonl", '{"a":1}\n{"a":2}\n', (file) =>
        Effect.gen(function* () {
          const tk = yield* StreamingToolkit;
          const stream = yield* tk.handle("stream_load_jsonl", { location: file });
          const results = yield* Stream.runCollect(stream);
          const first = results[0];
          assert.isDefined(first);
          assert.strictEqual(first.isFailure, false);
          const output = first.encodedResult as { data: ReadonlyArray<unknown>; meta: { format: string } };
          assert.deepStrictEqual(output.data, [{ a: 1 }, { a: 2 }]);
          assert.strictEqual(output.meta.format, "jsonl");
        })
      )
    );

    it.effect("stream_load_json loads and parses a local JSON document", () =>
      withTempFixture("load.json", '{"hello":"world"}', (file) =>
        Effect.gen(function* () {
          const tk = yield* StreamingToolkit;
          const stream = yield* tk.handle("stream_load_json", { location: file });
          const results = yield* Stream.runCollect(stream);
          const first = results[0];
          assert.isDefined(first);
          assert.strictEqual(first.isFailure, false);
          const output = first.encodedResult as { data: unknown; meta: { format: string } };
          assert.deepStrictEqual(output.data, { hello: "world" });
          assert.strictEqual(output.meta.format, "json");
        })
      )
    );

    it.effect("stream_extract_matches extracts regex matches", () =>
      withTempFixture("matches.txt", "cat\ndog\ncar\n", (file) =>
        Effect.gen(function* () {
          const tk = yield* StreamingToolkit;
          const stream = yield* tk.handle("stream_extract_matches", { path: file, pattern: "ca" });
          const results = yield* Stream.runCollect(stream);
          const first = results[0];
          assert.isDefined(first);
          assert.strictEqual(first.isFailure, false);
          const output = first.encodedResult as { count: number; lines: ReadonlyArray<string> };
          assert.strictEqual(output.count, 2);
          assert.deepStrictEqual(output.lines, ["ca", "ca"]);
        })
      )
    );

    it.effect("stream_count_jsonl counts valid records and reports errors", () =>
      withTempFixture("count.jsonl", '{"a":1}\nbad\n{"a":2}\n', (file) =>
        Effect.gen(function* () {
          const tk = yield* StreamingToolkit;
          const stream = yield* tk.handle("stream_count_jsonl", { options: { skipInvalid: true }, path: file });
          const results = yield* Stream.runCollect(stream);
          const first = results[0];
          assert.isDefined(first);
          assert.strictEqual(first.isFailure, false);
          const output = first.encodedResult as { count: number; errors?: number };
          assert.strictEqual(output.count, 2);
          assert.strictEqual(output.errors, 1);
        })
      )
    );

    it.effect("stream_filter_lines returns a structured failure for an invalid pattern", () =>
      withTempFixture("invalid.txt", "x\ny\n", (file) =>
        Effect.gen(function* () {
          const tk = yield* StreamingToolkit;
          const stream = yield* tk.handle("stream_filter_lines", { path: file, pattern: "[" });
          const results = yield* Stream.runCollect(stream);
          const first = results[0];
          assert.isDefined(first);
          assert.strictEqual(first.isFailure, true);
        })
      )
    );
  });
});
