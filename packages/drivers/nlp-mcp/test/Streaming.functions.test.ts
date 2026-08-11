import { readJsonl, streamJsonl } from "@beep/nlp-mcp/Streaming/Jsonl";
import {
  computeStats,
  countLines,
  readLines,
  StreamingAllowedRoots,
  streamLines,
} from "@beep/nlp-mcp/Streaming/TextStream";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as NodePath from "@effect/platform-node/NodePath";
import { assert, layer } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Stream from "effect/Stream";

const TestLayer = Layer.merge(NodeFileSystem.layer, NodePath.layer);

layer(TestLayer)("streaming function dispatch", (it) => {
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
