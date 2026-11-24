/**
 * The recorder: persists one finished gate run. It writes the raw tool
 * stream to the log in full while keeping a bounded excerpt, settles the
 * report (the excerpt feeds the errored fallback item), writes the record,
 * and returns the record paths with the log's size. A write that fails is
 * returned as an omission, never as a failure, so the console still renders.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { RecordPaths } from "@beep/gate-report/ConsoleDocument";
import { GateEvent } from "@beep/gate-report/GateEvent";
import { GateRecord } from "@beep/gate-report/GateRecord";
import { GateReport } from "@beep/gate-report/GateReport";
import { reduceEvents } from "@beep/gate-report/Reducer";
import { $RepoGateRunId } from "@beep/identity/packages";
import { boundedChunkReducer, emptyBoundedOutput } from "@beep/repo-cli-kit/process/OutputBound";
import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import { dual, pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { excerptBound } from "./Excerpt.ts";
import { Omission } from "./Omission.ts";
import type { IncompleteRunError } from "@beep/gate-report/Reducer";
import type { OutputBound } from "@beep/repo-cli-kit/process/OutputBound";
import type { GateRecordWriteError } from "@beep/repo-gate-record/GateRecordFile";
import type { GateRecordStoreShape, WrittenFile } from "@beep/repo-gate-record/GateRecordStore";

const $I = $RepoGateRunId.create("GateRecorder");

/**
 * **Example** (Wrap events)
 *
 * ```ts
 * import { RunSource } from "@beep/repo-gate-run/GateRecorder";
 *
 * console.log(RunSource.cases.RunEvents.make({ events: [] })._tag); // RunEvents
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RunSource = S.TaggedUnion({
  RunEvents: { events: S.Array(GateEvent) },
  FinishedReport: { report: GateReport },
}).pipe(
  $I.annoteSchema("RunSource", {
    description: "What a gate run produced: adapter events or a finished report.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type RunSource = typeof RunSource.Type;

const withExcerpt =
  (excerpt: string) =>
  (event: GateEvent): GateEvent =>
    GateEvent.guards.RunFinished(event) && O.isNone(event.logExcerpt)
      ? GateEvent.cases.RunFinished.make({ ...event, logExcerpt: O.some(excerpt) })
      : event;

/**
 * Settle a run's report: reduce its events, giving a `RunFinished` that has
 * no log excerpt the recorder's excerpt, or take the finished report as it
 * is.
 *
 * **Example** (Settle a finished report)
 *
 * ```ts
 * import { GateReport, Totals } from "@beep/gate-report/GateReport";
 * import { RunSource, settleSource } from "@beep/repo-gate-run/GateRecorder";
 * import * as DateTime from "effect/DateTime";
 * import * as O from "effect/Option";
 * import * as Result from "effect/Result";
 *
 * const report = GateReport.make({
 *   gate: "test", subject: "@beep/glob", itemKind: "test", runId: "r1",
 *   startedAt: DateTime.makeUnsafe(0), durationMs: 0, inputFingerprint: "x",
 *   reason: "passed", outcome: "all-pass", units: [], items: [], totals: Totals.make({ collected: 1, passed: 1 }),
 * });
 * const settled = settleSource(RunSource.cases.FinishedReport.make({ report }), O.none());
 * console.log(Result.isSuccess(settled)); // true
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const settleSource: {
  (source: RunSource, excerpt: O.Option<string>): Result.Result<GateReport, IncompleteRunError>;
  (excerpt: O.Option<string>): (source: RunSource) => Result.Result<GateReport, IncompleteRunError>;
} = dual(
  2,
  (source: RunSource, excerpt: O.Option<string>): Result.Result<GateReport, IncompleteRunError> =>
    RunSource.match(source, {
      RunEvents: (run) =>
        reduceEvents(
          O.match(excerpt, {
            onNone: () => run.events,
            onSome: (text) => A.map(run.events, withExcerpt(text)),
          })
        ),
      FinishedReport: (finished) => Result.succeed(finished.report),
    })
);

/**
 * What the recorder is asked to persist: whose record, and the run's source.
 *
 * **Example** (Request a package record)
 *
 * ```ts
 * import { RecordTarget } from "@beep/repo-gate-record/GatePaths";
 * import { RecordRequest, RunSource } from "@beep/repo-gate-run/GateRecorder";
 *
 * const request = RecordRequest.make({
 *   target: RecordTarget.cases.PackageTarget.make({ packageDir: "packages/glob", gate: "test" }),
 *   source: RunSource.cases.RunEvents.make({ events: [] }),
 * });
 * console.log(request.target._tag); // PackageTarget
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class RecordRequest extends S.Opaque<RecordRequest, { readonly brand: unique symbol }>()(
  S.Struct({
    target: RecordTarget,
    source: RunSource,
  }).pipe(
    $I.annoteSchema("RecordRequest", {
      description: "Whose record to write and the run's events or finished report.",
    })
  )
) {}

/**
 * What the recorder produced: the settled report, the record paths with the
 * log's size when both files were written, and what could not be written.
 *
 * **Example** (Build a result)
 *
 * ```ts
 * import { GateReport, Totals } from "@beep/gate-report/GateReport";
 * import { Recorded } from "@beep/repo-gate-run/GateRecorder";
 * import * as DateTime from "effect/DateTime";
 *
 * const report = GateReport.make({
 *   gate: "test", subject: "@beep/glob", itemKind: "test", runId: "r1",
 *   startedAt: DateTime.makeUnsafe(0), durationMs: 0, inputFingerprint: "x",
 *   reason: "passed", outcome: "all-pass", units: [], items: [], totals: Totals.make({ collected: 1, passed: 1 }),
 * });
 * console.log(Recorded.make({ report }).omissions.length); // 0
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class Recorded extends S.Opaque<Recorded, { readonly brand: unique symbol }>()(
  S.Struct({
    report: GateReport,
    paths: S.OptionFromOptionalKey(RecordPaths).pipe(S.withConstructorDefault(Effect.succeedNone)),
    omissions: S.Array(Omission).pipe(S.withConstructorDefault(Effect.succeed([]))),
  }).pipe(
    $I.annoteSchema("Recorded", {
      description: "The settled report, the record paths with the log size, and what was not written.",
    })
  )
) {}

/**
 * The recorder itself failed, as opposed to one of its writes.
 *
 * **Example** (Build the error)
 *
 * ```ts
 * import { GateRecorderError } from "@beep/repo-gate-run/GateRecorder";
 *
 * console.log(GateRecorderError.make({ message: "recorder unavailable" })._tag); // GateRecorderError
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class GateRecorderError extends S.TaggedError<GateRecorderError, { readonly brand: unique symbol }>(
  $I`GateRecorderError`
)(
  "GateRecorderError",
  { message: S.String },
  $I.annoteError<GateRecorderError>("GateRecorderError", {
    description: "The gate recorder could not run at all.",
  })
) {}

/**
 * The recorder's operations.
 *
 * **Details**
 *
 * `record` reads the raw stream once: every chunk goes to the log file and
 * into the bounded excerpt. A stream failure fails the call; a failed write
 * of the log or the record is returned as an {@link Omission}, and then the
 * paths are absent. When the log write fails part way, the excerpt holds
 * what was read before it. Malformed events fail with `IncompleteRunError`.
 *
 * **Example** (Use the shape)
 *
 * ```ts
 * import type { GateRecorderShape } from "@beep/repo-gate-run/GateRecorder";
 *
 * const record = (recorder: GateRecorderShape) => recorder.record;
 * console.log(typeof record); // function
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface GateRecorderShape {
  readonly record: <E, R>(
    request: RecordRequest,
    log: Stream.Stream<Uint8Array, E, R>
  ) => Effect.Effect<Recorded, IncompleteRunError | GateRecorderError | E, R>;
}

const isWriteError = (error: unknown): error is GateRecordWriteError => P.isTagged(error, "GateRecordWriteError");

const written = <E, R>(effect: Effect.Effect<WrittenFile, GateRecordWriteError | E, R>) =>
  effect.pipe(
    Effect.map(Result.succeed),
    Effect.catchIf(isWriteError, (error) => Effect.succeed(Result.fail(error.message)))
  );

const omissionOf = (part: Omission["part"], outcome: Result.Result<WrittenFile, string>) =>
  pipe(
    Result.getFailure(outcome),
    O.map((reason) => Omission.make({ part, reason })),
    A.fromOption
  );

const pathsOf = (log: Result.Result<WrittenFile, string>, record: Result.Result<WrittenFile, string>) =>
  pipe(
    O.all([Result.getSuccess(log), Result.getSuccess(record)]),
    O.map(([logFile, recordFile]) =>
      RecordPaths.make({ record: recordFile.path, log: logFile.path, logBytes: logFile.bytes })
    )
  );

const makeRecorder = (store: GateRecordStoreShape, bound: OutputBound): GateRecorderShape => ({
  record: Effect.fnUntraced(function* <E, R>(request: RecordRequest, log: Stream.Stream<Uint8Array, E, R>) {
    const decoder = new TextDecoder();
    const excerpt = yield* Ref.make(emptyBoundedOutput);
    const fold = boundedChunkReducer(bound);
    const logged = yield* written(
      store.writeLog(
        request.target,
        Stream.tap(log, (chunk) => Ref.update(excerpt, (state) => fold(state, decoder.decode(chunk, { stream: true }))))
      )
    );
    const kept = yield* Ref.get(excerpt);
    const report = yield* Effect.fromResult(settleSource(request.source, O.liftPredicate(kept.text, Str.isNonEmpty)));
    const generatedAt = yield* DateTime.now;
    const recorded = yield* written(store.writeRecord(request.target, GateRecord.make({ generatedAt, report })));
    return Recorded.make({
      report,
      paths: pathsOf(logged, recorded),
      omissions: [...omissionOf("log", logged), ...omissionOf("record", recorded)],
    });
  }),
});

/**
 * The recorder service.
 *
 * **Example** (Provide the recorder over the memory store)
 *
 * ```ts
 * import { GateRecordStore } from "@beep/repo-gate-record/GateRecordStore";
 * import { GateRecorder } from "@beep/repo-gate-run/GateRecorder";
 * import * as Layer from "effect/Layer";
 *
 * const layer = GateRecorder.layer.pipe(Layer.provide(GateRecordStore.layerMemory));
 * console.log(Layer.isLayer(layer)); // true
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class GateRecorder extends Context.Service<GateRecorder, GateRecorderShape>()($I`GateRecorder`) {
  /**
   * The recorder over the record store, with the 8 KiB excerpt bound.
   *
   * **Example** (Reference the layer)
   *
   * ```ts
   * import { GateRecorder } from "@beep/repo-gate-run/GateRecorder";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(GateRecorder.layer)); // true
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<GateRecorder, never, GateRecordStore> = Layer.effect(
    GateRecorder,
    GateRecordStore.use((store) => Effect.succeed(GateRecorder.of(makeRecorder(store, excerptBound))))
  );

  /**
   * A recorder that cannot run at all, for tests: every call fails with
   * {@link GateRecorderError}.
   *
   * **Example** (Fail every record)
   *
   * ```ts
   * import { GateRecorder } from "@beep/repo-gate-run/GateRecorder";
   * import * as Layer from "effect/Layer";
   *
   * console.log(Layer.isLayer(GateRecorder.layerFailing("recorder unavailable"))); // true
   * ```
   *
   * @param message - the failure every call reports
   * @category layers
   * @since 0.0.0
   */
  static readonly layerFailing = (message: string): Layer.Layer<GateRecorder> =>
    Layer.succeed(
      GateRecorder,
      GateRecorder.of({
        record: Effect.fn("GateRecorder.record")(function* () {
          return yield* GateRecorderError.make({ message });
        }),
      })
    );
}
