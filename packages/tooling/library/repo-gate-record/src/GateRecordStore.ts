/**
 * The record store: writes a gate run's raw log and record, reads records
 * back, lists a gate's root runs and keeps the newest twenty of them.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $RepoGateRecordId } from "@beep/identity/packages";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Sink from "effect/Sink";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { RecordTarget, RunId, recordLocation, rootGateDir } from "./GatePaths.ts";
import { GateRecordFile, GateRecordReadError, GateRecordWriteError } from "./GateRecordFile.ts";
import { memoryFiles, platformFiles } from "./internal/files.ts";
import { expiredRuns, newestFirst } from "./RunId.ts";
import type { GateRecord } from "@beep/gate-report/GateRecord";
import type * as FileSystem from "effect/FileSystem";
import type * as Path from "effect/Path";
import type { GateName } from "./GatePaths.ts";
import type { RecordFiles } from "./internal/files.ts";

const $I = $RepoGateRecordId.create("GateRecordStore");

/**
 * **Example** (Build a written file)
 *
 * ```ts
 * import { WrittenFile } from "@beep/repo-gate-record/GateRecordStore";
 *
 * console.log(WrittenFile.make({ path: ".beep/gates/test/r1.log", bytes: 12 }).bytes); // 12
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class WrittenFile extends S.Opaque<WrittenFile, { readonly brand: unique symbol }>()(
  S.Struct({
    path: S.NonEmptyString,
    bytes: S.Int.check(S.isGreaterThanOrEqualTo(0)),
  }).pipe(
    $I.annoteSchema("WrittenFile", {
      description: "A file the record store wrote: its repository-relative path and size in bytes.",
    })
  )
) {}

/**
 * The record store's operations.
 *
 * **Details**
 *
 * `writeLog` writes the whole raw stream and counts its bytes; a stream
 * failure is returned as it is, a file failure as
 * {@link GateRecordWriteError}. `writeRecord` writes the record file whole
 * and, for a root run, then removes the gate's runs past the newest twenty;
 * that removal is best effort: when it fails, the record still counts as
 * written and the next root write removes what is left. A removal deletes
 * a run's log before its record, since runs are found by their record, so
 * `listRuns` can name a run whose log a failed removal already deleted.
 * `readRecord` returns the record as written, its run id included, so a
 * restored record is recognizable as a replay. `listRuns` names a gate's
 * root runs, newest first.
 *
 * **Example** (Use the store shape)
 *
 * ```ts
 * import type { GateRecordStoreShape } from "@beep/repo-gate-record/GateRecordStore";
 *
 * const runs = (store: GateRecordStoreShape) => store.listRuns("test");
 * console.log(typeof runs); // function
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface GateRecordStoreShape {
  readonly listRuns: (gate: GateName) => Effect.Effect<ReadonlyArray<RunId>, GateRecordReadError>;
  readonly readRecord: (target: RecordTarget) => Effect.Effect<GateRecord, GateRecordReadError>;
  readonly writeLog: <E, R>(
    target: RecordTarget,
    log: Stream.Stream<Uint8Array, E, R>
  ) => Effect.Effect<WrittenFile, GateRecordWriteError | E, R>;
  readonly writeRecord: (target: RecordTarget, record: GateRecord) => Effect.Effect<WrittenFile, GateRecordWriteError>;
}

const writeFailure = (path: string, message: string) => (cause: { readonly message: string }) =>
  GateRecordWriteError.make({ path, message: `${message}: ${cause.message}`, cause });

const readFailure =
  (path: string, reason: GateRecordReadError["reason"], message: string) => (cause: { readonly message: string }) =>
    GateRecordReadError.make({ path, reason, message: `${message}: ${cause.message}`, cause });

const encodeRecord = S.encodeEffect(GateRecordFile);
const decodeRecord = S.decodeUnknownEffect(GateRecordFile);
const isRunId = S.is(RunId);
const utf8Length = (text: string): number => new TextEncoder().encode(text).length;

const runIdOf: (name: string) => O.Option<RunId> = flow(
  O.liftPredicate(Str.endsWith(".json")),
  O.map(Str.slice(0, -".json".length)),
  O.filter(isRunId)
);

const runIdsOf: (names: ReadonlyArray<string>) => ReadonlyArray<RunId> = flow(A.map(runIdOf), A.getSomes, newestFirst);

const makeStore = (files: RecordFiles): GateRecordStoreShape => {
  const listRuns = (gate: GateName) =>
    files.listNames(rootGateDir(gate)).pipe(
      Effect.mapBoth({
        onSuccess: runIdsOf,
        onFailure: readFailure(rootGateDir(gate), "unreadable", `could not list the ${gate} gate's runs`),
      })
    );

  const removeRun = (gate: GateName) => (runId: RunId) => {
    const location = recordLocation(RecordTarget.cases.RootTarget.make({ gate, runId }));
    return Effect.andThen(files.remove(location.log), files.remove(location.record));
  };

  const prune = (gate: GateName) =>
    files.listNames(rootGateDir(gate)).pipe(
      Effect.flatMap((names) =>
        Effect.forEach(expiredRuns(runIdsOf(names)), removeRun(gate), { concurrency: 1, discard: true })
      ),
      Effect.ignore
    );

  const retain: (target: RecordTarget) => Effect.Effect<void> = RecordTarget.match({
    PackageTarget: () => Effect.void,
    RootTarget: (root) => prune(root.gate),
  });

  return {
    writeLog: Effect.fnUntraced(function* <E, R>(target: RecordTarget, log: Stream.Stream<Uint8Array, E, R>) {
      const path = recordLocation(target).log;
      const bytes = yield* Ref.make(0);
      yield* log.pipe(
        Stream.tap((chunk) => Ref.update(bytes, (total) => total + chunk.length)),
        Stream.run(Sink.mapError(files.sink(path), writeFailure(path, "could not write the raw log")))
      );
      return WrittenFile.make({ path, bytes: yield* Ref.get(bytes) });
    }),
    writeRecord: Effect.fnUntraced(function* (target: RecordTarget, record: GateRecord) {
      const path = recordLocation(target).record;
      const text = yield* Effect.mapError(encodeRecord(record), writeFailure(path, "could not encode the record"));
      yield* Effect.mapError(files.writeText(path, `${text}\n`), writeFailure(path, "could not write the record"));
      yield* retain(target);
      return WrittenFile.make({ path, bytes: utf8Length(text) + 1 });
    }),
    readRecord: Effect.fnUntraced(function* (target: RecordTarget) {
      const path = recordLocation(target).record;
      const text = yield* Effect.mapError(
        files.readText(path),
        readFailure(path, "unreadable", "could not read the record")
      );
      return yield* pipe(
        text,
        O.match({
          onNone: () => Effect.fail(GateRecordReadError.make({ path, reason: "missing", message: "no record" })),
          onSome: flow(decodeRecord, Effect.mapError(readFailure(path, "invalid", "not a gate-report/v1 record"))),
        })
      );
    }),
    listRuns,
  };
};

const emptyFiles = () => Ref.make(HashMap.empty<string, ReadonlyArray<Uint8Array>>());

/**
 * The record store service.
 *
 * **Example** (Provide the memory store)
 *
 * ```ts
 * import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
 * import * as Effect from "effect/Effect";
 *
 * const program = GateRecordStore.use((store) => store.listRuns("test")).pipe(Effect.provide(GateRecordStore.layerMemory));
 * console.log(Effect.isEffect(program)); // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GateRecordStore extends Context.Service<GateRecordStore, GateRecordStoreShape>()($I`GateRecordStore`) {
  /**
   * Build the store over the platform file system, with paths resolved
   * against the repository root, for a caller that holds it directly (a
   * Vitest reporter outside a layer, or a test).
   *
   * **Example** (Build a store effect)
   *
   * ```ts
   * import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
   * import * as Effect from "effect/Effect";
   *
   * console.log(Effect.isEffect(GateRecordStore.make("/repo"))); // true
   * ```
   *
   * @param repoRoot - the absolute repository root
   * @category constructors
   * @since 0.0.0
   */
  static readonly make = (
    repoRoot: string
  ): Effect.Effect<GateRecordStoreShape, never, FileSystem.FileSystem | Path.Path> =>
    Effect.map(platformFiles(repoRoot), makeStore);

  /**
   * The store over the platform file system, with paths resolved against the
   * repository root.
   *
   * **Details**
   *
   * The caller supplies `FileSystem` and `Path` (for example
   * `NodeServices.layer`), so this package names no platform.
   *
   * **Example** (Build the live layer)
   *
   * ```ts
   * import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(GateRecordStore.layer("/repo"))); // true
   * ```
   *
   * @param repoRoot - the absolute repository root
   * @category layers
   * @since 0.0.0
   */
  static readonly layer = (repoRoot: string): Layer.Layer<GateRecordStore, never, FileSystem.FileSystem | Path.Path> =>
    Layer.effect(GateRecordStore, Effect.map(GateRecordStore.make(repoRoot), GateRecordStore.of));

  /**
   * A store over memory, for tests: the same rules, no file system.
   *
   * **Example** (Build the memory layer)
   *
   * ```ts
   * import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(GateRecordStore.layerMemory)); // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layerMemory: Layer.Layer<GateRecordStore> = Layer.effect(
    GateRecordStore,
    Effect.map(emptyFiles(), (files) => GateRecordStore.of(makeStore(memoryFiles({ files, failWrites: O.none() }))))
  );

  /**
   * A memory store whose writes all fail, for tests of what a caller does
   * when nothing can be written.
   *
   * **Example** (Build a failing layer)
   *
   * ```ts
   * import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(GateRecordStore.layerFailingWrites("disk full"))); // true
   * ```
   *
   * @param reason - the failure every write reports
   * @category layers
   * @since 0.0.0
   */
  static readonly layerFailingWrites = (reason: string): Layer.Layer<GateRecordStore> =>
    Layer.effect(
      GateRecordStore,
      Effect.map(emptyFiles(), (files) =>
        GateRecordStore.of(makeStore(memoryFiles({ files, failWrites: O.some(reason) })))
      )
    );
}
