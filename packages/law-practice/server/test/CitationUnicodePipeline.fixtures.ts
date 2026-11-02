/**
 * Shared trusted Unicode-history runtime and integrity-bound source loader.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeURL from "node:url";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { Sha256HexFromBytes } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import { ChildProcessSpawner } from "effect/process/ChildProcessSpawner";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeCitationBuiltinCleaners } from "../src/internal/Citation/BuiltinCleaners.ts";
import {
  CitationCleanerFailure,
  CitationCleanerRuntime,
  makeCitationCleanerPipeline,
} from "../src/internal/Citation/CleanerPipeline.ts";
import { CitationCleanerValues, makeCitationCleanerValues } from "../src/internal/Citation/CleanerValues.ts";
import { CitationPythonUnicodeStorage } from "../src/internal/Citation/PythonHash.ts";
import type { CitationCleanerObject, CitationCleanerWork } from "../src/internal/Citation/CleanerPipeline.ts";

const Snapshot = S.Struct({
  codepoints: S.Array(S.Natural),
  width: S.Literals([1, 2, 4]),
  nativeHex: S.String,
  hash: S.BigIntFromString,
  pythonLength: S.Natural,
  utf16Units: S.Natural,
});
const CorpusJson = S.fromJsonString(
  S.Struct({
    cases: S.Array(
      S.Struct({
        name: S.String,
        steps: S.Array(S.String),
        failure: S.NullOr(S.Literal("ParserError")),
        events: S.Array(S.Struct({ value: Snapshot, sameAs: S.Array(S.Natural) })),
      })
    ),
  })
);
/** Load the exact portable source histories without normalizing their bytes.
 * @internal @category testing @since 0.0.0
 */
export const loadCitationUnicodeHistories = Effect.fn("UnicodePipelineTest.load")(function* () {
  const raw = yield* (yield* FileSystem.FileSystem).readFileString(
    NodeURL.fileURLToPath(new URL("../../use-cases/test/fixtures/eyecite/cleaner-unicode.json", import.meta.url))
  );
  expect(yield* S.decodeEffect(Sha256HexFromBytes)(new TextEncoder().encode(raw))).toBe(
    "0c314524ff16f1a8689b8aaf50d235a5c2439187f1e168c84b84d700160aead0"
  );
  return yield* S.decodeEffect(CorpusJson)(raw);
});
/** Capture the real value owner, builtin dispatcher and reservation ledger.
 * Native processes are forbidden unless the hosted integration caller opts in.
 * @internal @category testing @since 0.0.0
 */
export const makeCitationUnicodePipelineHarness = Effect.fn("UnicodePipelineTest.harness")(function* (
  allowNative: boolean
) {
  const base = (yield* defaultCitationEnginePolicy).limits;
  const limits = allowNative
    ? { ...base, cleanDeadline: Duration.seconds(30), operationDeadline: Duration.seconds(60) }
    : base;
  let spawned = 0;
  let confirmed = 0;
  const values = yield* makeCitationCleanerValues(limits);
  const real = yield* ChildProcessSpawner;
  const builtins = yield* makeCitationBuiltinCleaners(limits, {
    executable: process.execPath,
    cwd: process.cwd(),
    workerFile: NodeURL.fileURLToPath(new URL("../src/internal/Citation/HtmlWorker.entry.ts", import.meta.url)),
  }).pipe(
    Effect.provideService(CitationCleanerValues, values),
    Effect.provideService(ChildProcessSpawner, {
      ...real,
      spawn: Effect.fn("UnicodePipelineTest.spawn")((command: Parameters<typeof real.spawn>[0]) =>
        allowNative
          ? real.spawn(command).pipe(
              Effect.map((handle) => {
                spawned++;
                let seen = false;
                return {
                  ...handle,
                  isRunning: handle.isRunning.pipe(
                    Effect.tap((running) =>
                      Effect.sync(() => {
                        if (!running && !seen) {
                          expect(() => process.kill(handle.pid, 0)).toThrow();
                          confirmed++;
                          seen = true;
                        }
                      })
                    )
                  ),
                };
              })
            )
          : Effect.die("Literal composition must not start a native worker.")
      ),
    })
  );
  let initial = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array() });
  let useText = false;
  let steps = A.empty<string>();
  let retained = A.empty<CitationCleanerObject>();
  let lastWork = O.none<CitationCleanerWork>();
  const runtime = CitationCleanerRuntime.of({
    fromText: Effect.fn("LiteralUnicodeTest.captureSource")(function* (text: string) {
      const value = yield* useText ? values.sourceText(text) : values.sourceUnicode(initial);
      retained = [value];
      return value;
    }),
    assertOwned: values.assertOwned,
    textUnits: Effect.fn("LiteralUnicodeTest.units")((value) =>
      values.getText(value).pipe(Effect.map(O.map((text) => Str.length(text.text))))
    ),
    open: Effect.fn("LiteralUnicodeTest.open")(function* (_plan, _initial, work) {
      lastWork = O.some(work);
      const callables = yield* Effect.forEach(steps, values.retainHost, { concurrency: 1 });
      let cursor = 0;
      return { next: Effect.sync(() => A.get(callables, cursor++)) };
    }),
    contains: Effect.fn("LiteralUnicodeTest.contains")(() => Effect.succeed(false)),
    get: Effect.fn("LiteralUnicodeTest.get")(() =>
      Effect.fail(CitationCleanerFailure.make({ reason: "lookup-key-missing" }))
    ),
    callable: Effect.fn("LiteralUnicodeTest.callable")(() => Effect.succeed(true)),
    invoke: Effect.fn("LiteralUnicodeTest.invoke")(function* (callable, input, work) {
      lastWork = O.some(work);
      const produced = yield* builtins.invoke(
        yield* Effect.fromOption(yield* values.getHost(callable), () =>
          CitationCleanerFailure.make({ reason: "invalid-input" })
        ),
        input,
        work
      );
      retained = A.append(retained, produced.value);
      return produced;
    }),
  });
  const pipeline = yield* makeCitationCleanerPipeline(limits).pipe(
    Effect.provideService(CitationCleanerRuntime, runtime)
  );
  return {
    values,
    runtime,
    pipeline,
    select: (storage: CitationPythonUnicodeStorage, plan: ReadonlyArray<string>) => {
      initial = storage;
      useText = false;
      steps = A.fromIterable(plan);
      retained = [];
    },
    selectText: (plan: ReadonlyArray<string>) => {
      useText = true;
      steps = A.fromIterable(plan);
      retained = [];
    },
    references: Effect.sync(() => retained),
    lastWork: Effect.sync(() => lastWork),
    nativeCounts: Effect.sync(() => ({ spawned, confirmed })),
  };
});
