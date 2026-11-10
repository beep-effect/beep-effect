/**
 * Opt-in AC-1 byte identity over the whole live `goals/**` Markdown tree.
 *
 * Skipped by default: the tree is about 3,600 files and 30 MB, too slow for
 * the unit lane, and a test that reads outside its package is invisible to the
 * Turbo input hash. Run it from the package directory with
 *
 *   BEEP_TEST_AGENT_MEMORY_FULL_TREE=1 bunx --bun vitest run test/MarkdownProjector.full-tree.test.ts
 *
 * It imports the repository's `goals` folder (the import never writes to it),
 * rebuilds every file from the log alone into an empty folder and compares
 * the bytes. Labeller: the agent-memory-store-p1 lane; the live tree is its
 * own fixture and carries no labels.
 */
import { LogCursor } from "@beep/agent-memory-store";
import { PosixPath } from "@beep/schema";
import { describe, expect, it } from "@effect/vitest";
import * as A from "effect/Array";
import * as Clock from "effect/Clock";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as TestClock from "effect/testing/TestClock";
import {
  importedFiles,
  isBunRuntime,
  openStore,
  report,
  snapshotFolder,
  TestPlatform,
  tempDirectory,
} from "./projector-support.ts";

const enabled = isBunRuntime && P.isNotUndefined(Bun.env.BEEP_TEST_AGENT_MEMORY_FULL_TREE);

describe.skipIf(!enabled)("MarkdownProjector AC-1 over the live goals tree (opt-in)", () => {
  it.layer(TestPlatform, { timeout: "900 seconds" })("live goals tree", (it) => {
    it.effect(
      "AC-1 byte identity on the live goals tree: a rebuild from the log alone reproduces every Markdown file",
      Effect.fnUntraced(function* () {
        const path = yield* Path.Path;
        const goalsFolder = yield* path.fromFileUrl(new URL("../../../../../goals", import.meta.url));
        const workspace = yield* tempDirectory("beep-ac1-full-tree-");
        const store = yield* openStore(`${workspace}/memory.db`);
        const importStart = yield* TestClock.withLive(Clock.currentTimeMillis);
        const imported = yield* store.projector.importFolder(PosixPath.make(goalsFolder));
        const importEnd = yield* TestClock.withLive(Clock.currentTimeMillis);

        const rebuilt = `${workspace}/rebuilt`;
        const fresh = yield* openStore(`${workspace}/memory.db`);
        yield* fresh.projector.exportFolder(PosixPath.make(rebuilt));
        const exportEnd = yield* TestClock.withLive(Clock.currentTimeMillis);

        const source = yield* snapshotFolder(goalsFolder);
        const output = yield* snapshotFolder(rebuilt);
        const rebuiltBytes = HashMap.fromIterable(A.map(output, (file) => [file.path, file.bytes] as const));
        const importedPaths = HashSet.fromIterable(A.map(imported.files, (record) => record.path as string));
        const markdown = A.filter(source, (file) => HashSet.has(importedPaths, file.path));
        const identical = A.filter(markdown, (file) =>
          O.exists(HashMap.get(rebuiltBytes, file.path), (bytes) => Buffer.compare(bytes, file.bytes) === 0)
        );
        const entries = yield* fresh.log.entriesAfter(LogCursor.make(0));
        const records = yield* importedFiles(entries);
        const bytes = A.reduce(markdown, 0, (total, file) => total + file.bytes.length);
        const nodes = A.reduce(records, 0, (total, record) => total + record.nodeCount);

        yield* report(
          `AC-1 full tree: ${identical.length}/${markdown.length} files identical, ${bytes} bytes, ${nodes} nodes, ` +
            `${entries.length} entries; import ${importEnd - importStart} ms in one transaction, rebuild ${exportEnd - importEnd} ms`
        );
        expect(markdown.length).toBe(imported.files.length);
        expect(records).toHaveLength(markdown.length);
        expect(identical).toHaveLength(markdown.length);
      }),
      { timeout: 900_000 }
    );
  });
});
