/**
 * Shared trusted Unicode-history runtime and integrity-bound source loader.
 * @internal @packageDocumentation @since 0.0.0
 */
import * as NodeURL from "node:url";
import {
  CitationBuiltinCleaners,
  makeCitationBuiltinCleaners,
} from "@beep/law-practice-server/internal/Citation/BuiltinCleaners";
import {
  CitationCleanerFailure,
  CitationCleanerRuntime,
  makeCitationCleanerPipeline,
} from "@beep/law-practice-server/internal/Citation/CleanerPipeline";
import {
  CitationCleanerProtocols,
  makeCitationCleanerRegistry,
} from "@beep/law-practice-server/internal/Citation/CleanerRegistry";
import {
  CitationCleanerValues,
  makeCitationCleanerValues,
} from "@beep/law-practice-server/internal/Citation/CleanerValues";
import { CitationPythonUnicodeStorage } from "@beep/law-practice-server/internal/Citation/PythonHash";
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
import type {
  CitationCleanerObject,
  CitationCleanerWork,
} from "@beep/law-practice-server/internal/Citation/CleanerPipeline";

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
  const registry = yield* makeCitationCleanerRegistry(limits).pipe(
    Effect.provideService(CitationCleanerValues, values),
    Effect.provideService(CitationBuiltinCleaners, builtins),
    Effect.provideService(CitationCleanerProtocols, {
      hash: Effect.fn("UnicodePipelineTest.unexpectedHash")(() =>
        Effect.fail(CitationCleanerFailure.make({ reason: "callback-failed" }))
      ),
      equal: Effect.fn("UnicodePipelineTest.unexpectedEqual")(() =>
        Effect.fail(CitationCleanerFailure.make({ reason: "callback-failed" }))
      ),
      callable: Effect.fn("UnicodePipelineTest.notCallable")(() => Effect.succeed(false)),
      invoke: Effect.fn("UnicodePipelineTest.unexpectedInvoke")(() =>
        Effect.fail(CitationCleanerFailure.make({ reason: "callback-failed" }))
      ),
      open: Effect.fn("UnicodePipelineTest.open")(function* (_plan, _initial, work) {
        lastWork = O.some(work);
        let cursor = 0;
        return {
          next: Effect.suspend(() => {
            const name = A.get(steps, cursor++);
            return O.isSome(name) ? values.builtinName(name.value).pipe(Effect.asSome) : Effect.succeedNone;
          }),
        };
      }),
    })
  );
  const runtime = CitationCleanerRuntime.of({
    ...registry.runtime,
    fromText: Effect.fn("UnicodePipelineTest.captureSource")(function* (text: string) {
      const value = yield* useText ? values.sourceText(text) : values.sourceUnicode(initial);
      retained = [value];
      return value;
    }),
    invoke: Effect.fn("UnicodePipelineTest.observeInvoke")((callable, input, work) =>
      registry.runtime.invoke(callable, input, work).pipe(
        Effect.tap((produced) =>
          Effect.sync(() => {
            retained = A.append(retained, produced.value);
          })
        )
      )
    ),
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
