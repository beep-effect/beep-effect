/**
 * Shared harness for the write path suites: a store whose projector and
 * admission share one memory log and one SQLite client.
 */
import {
  Admission,
  MarkdownProjector,
  MarkdownProjectorLayer,
  MemoryLog,
  MemoryLogLayer,
  makeAdmissionLayer,
  makeMemorySqlClientLayer,
} from "@beep/agent-memory-store";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import type { StatusFields } from "@beep/agent-memory-store";

/** The SQLite options a write path store opens with. */
export type WritingStoreDatabase = Parameters<typeof makeMemorySqlClientLayer>[0];

// The services a write path test runs on: admission and the projector over one log.
const writingStoreLayer = (database: WritingStoreDatabase, statusFields: StatusFields) =>
  Layer.mergeAll(MarkdownProjectorLayer, makeAdmissionLayer(statusFields)).pipe(
    Layer.provideMerge(MemoryLogLayer),
    Layer.provideMerge(makeMemorySqlClientLayer(database)),
    Layer.provide(NodeFileSystem.layer)
  );

/** A fresh in-memory store for one test block: admission and the projector over one log. */
export const memoryWritingStoreLayer = (statusFields: StatusFields) =>
  writingStoreLayer({ filename: ":memory:" }, statusFields);

/** A store opened on one database: the log, the projector and admission. */
export const openWritingStore = Effect.fnUntraced(function* (
  database: string | WritingStoreDatabase,
  statusFields: StatusFields
) {
  const context = yield* Layer.build(
    writingStoreLayer(typeof database === "string" ? { filename: database } : database, statusFields)
  );
  return {
    admission: Context.get(context, Admission),
    context,
    log: Context.get(context, MemoryLog),
    projector: Context.get(context, MarkdownProjector),
  };
});
