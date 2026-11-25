import { StreamingToolkit, StreamingToolkitHandlersLive } from "@beep/nlp-mcp";
import { isUrl, loadJson, loadJsonl, loadLines, loadText } from "@beep/nlp-mcp/Streaming/DatasetLoader";
import { readJsonl, streamJsonl } from "@beep/nlp-mcp/Streaming/Jsonl";
import { processFile } from "@beep/nlp-mcp/Streaming/Pipeline";
import {
  computeStats,
  countLines,
  fileExists,
  getFileSize,
  head,
  readLines,
  StreamingAllowedRoots,
  sampleLines,
  streamLines,
  tail,
} from "@beep/nlp-mcp/Streaming/TextStream";
import { it } from "@beep/test-runner";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { assert } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const TestLayer = Layer.merge(NodeFileSystem.layer, NodePath.layer);

it.layer(TestLayer)("streaming function dispatch", (it) => {
  it.effect(
    "supports data-last text and JSONL operations",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      yield* Effect.acquireUseRelease(
        fs.makeTempDirectory(),
        (dir) =>
          Effect.gen(function* () {
            const textFile = path.join(dir, "lines.txt");
            const jsonlFile = path.join(dir, "records.jsonl");
            yield* fs.writeFileString(textFile, " alpha \nbeta\n");
            yield* fs.writeFileString(jsonlFile, '{"id":1}\ninvalid\n{"id":2}\n');

            const lines = yield* readLines({ trim: true })(textFile);
            const streamedLines = yield* Stream.runCollect(streamLines({ trim: true })(textFile));
            const lineCount = yield* countLines()(textFile);
            const stats = yield* computeStats()(textFile);
            const records = yield* readJsonl({ skipInvalid: true })(jsonlFile);
            const streamedRecords = yield* Stream.runCollect(streamJsonl({ skipInvalid: true })(jsonlFile));

            assert.deepStrictEqual(lines, ["alpha", "beta"]);
            assert.deepStrictEqual(Array.from(streamedLines), ["alpha", "beta"]);
            assert.strictEqual(lineCount, 2);
            assert.strictEqual(stats.totalLines, 2);
            assert.deepStrictEqual(records, [{ id: 1 }, { id: 2 }]);
            assert.deepStrictEqual(Array.from(streamedRecords), [{ id: 1 }, { id: 2 }]);
          }).pipe(Effect.provideService(StreamingAllowedRoots, [dir])),
        (dir) => Effect.orDie(fs.remove(dir, { force: true, recursive: true }))
      );
    })
  );
});

it.layer(StreamingToolkitHandlersLive.pipe(Layer.provideMerge(TestLayer), Layer.provideMerge(FetchHttpClient.layer)), {
  timeout: "30 seconds",
})("streaming pattern validation", (it) => {
  it.effect(
    "returns structured failures for malformed and oversized caller-supplied regexes",
    Effect.fnUntraced(function* () {
      const toolkit = yield* StreamingToolkit;
      for (const pattern of ["[", Str.repeat(1001)("a")]) {
        const stream = yield* toolkit.handle("stream_filter_lines", { path: "unused.txt", pattern });
        const results = yield* Stream.runCollect(stream);
        const first = results[0];
        assert.isDefined(first);
        assert.strictEqual(first.isFailure, true);
      }
    })
  );
});

it.layer(Layer.mergeAll(TestLayer, FetchHttpClient.layer))("local dataset loading", (it) => {
  it.effect(
    "loads text, lines, JSON and JSONL datasets and runs a line pipeline from a local file",
    Effect.fnUntraced(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const scratch = yield* fs.makeTempDirectoryScoped();
      const dir = yield* fs.realPath(scratch);
      const textFile = path.join(dir, "lines.txt");
      const jsonFile = path.join(dir, "record.json");
      const jsonlFile = path.join(dir, "records.jsonl");
      yield* fs.writeFileString(textFile, " Alpha, One \n\nBeta  Two\ngamma\n");
      yield* fs.writeFileString(jsonFile, '{"id":1}');
      yield* fs.writeFileString(jsonlFile, '{"id":1}\n{"id":2}\n');

      yield* Effect.gen(function* () {
        const text = yield* loadText(textFile);
        const lines = yield* loadLines(textFile, { skipEmpty: true, trim: true });
        const json = yield* loadJson(jsonFile);
        const jsonl = yield* loadJsonl(jsonlFile);
        const processed = yield* processFile(
          textFile,
          ["trim", "normalizeWhitespace", "removePunctuation", "lowercase"],
          {
            skipEmpty: true,
          }
        );
        const first = yield* head(textFile, { n: 1 });
        const last = yield* tail(textFile, { n: 1 });
        const sample = yield* sampleLines(textFile, 10);
        const exists = yield* fileExists(textFile);
        const size = yield* getFileSize(textFile);
        const refused = yield* loadText("http://127.0.0.1/private.txt").pipe(Effect.exit);

        assert.strictEqual(text.meta.sourceType, "file");
        assert.deepStrictEqual(lines.data, ["Alpha, One", "Beta  Two", "gamma"]);
        assert.deepStrictEqual(json.data, { id: 1 });
        assert.strictEqual(jsonl.meta.format, "jsonl");
        assert.deepStrictEqual(processed.results, ["alpha one", "beta two", "gamma"]);
        assert.strictEqual(first.length, 1);
        assert.strictEqual(last.length, 1);
        assert.isTrue(sample.length >= 3);
        assert.isTrue(exists);
        assert.isTrue(size > 0);
        assert.isTrue(isUrl("https://example.test/data.txt"));
        assert.isFalse(isUrl(textFile));
        assert.isTrue(refused._tag === "Failure");
      }).pipe(Effect.provideService(StreamingAllowedRoots, [dir]));
    })
  );
});
