/** Original callback invocation and join-failure replay; native string profile.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationAnnotationAnnotator,
  CitationAnnotationCallbackFailure,
  CitationAnnotationCallbackResult,
} from "@beep/law-practice-server/internal/Citation/AnnotationCallback";
import { makeCitationSkipAnnotationSpans } from "@beep/law-practice-server/internal/Citation/AnnotationSkip";
import {
  makeCitationAnnotationWrap,
  makeCitationWrapAnnotationSpans,
} from "@beep/law-practice-server/internal/Citation/AnnotationWrap";
import { concatCitationPythonRanges } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { CitationXmlBalance } from "@beep/law-practice-server/internal/Citation/XmlWorker";
import { CitationPythonUnicodeStorage, CitationTextBudget } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import {
  CitationAnnotationReplayReplacement,
  makeCitationAnnotationReplay,
} from "./CitationAnnotationReplay.fixtures.ts";
import { makeCitationTestScaffoldBinding } from "./CitationInvocation.fixtures.ts";
import { assertCitationWorkerCompositionReleased, readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";
import { installCitationXmlWorker } from "./CitationXmlWorker.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationAnnotationCallback");
const Program = LiteralKit([
  "join",
  "empty",
  "span",
  "reverse",
  "bad-first",
  "bad-then-raise",
  "raise-second",
  "subclass",
]).pipe(
  $I.annoteSchema("Program", {
    description: "Synthetic callable definitions supplied as original-source test input, never product request modes.",
  })
);
const Trace = S.Struct({
  before: CitationNativeUnicodeHex,
  span: CitationNativeUnicodeHex,
  after: CitationNativeUnicodeHex,
}).pipe(
  $I.annoteSchema("Trace", { description: "Actual invocation arguments after source overlap/markup decisions." })
);
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-annotation-callback/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    producerSha256: S.tag("154a982c40642bab1d11c2fb5b331fc2268b1bb32d79cbb015efa4fda0adc03f"),
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        source: CitationNativeUnicodeHex,
        mode: S.Literals(["unchecked", "skip", "wrap"]),
        program: Program,
        input: S.Array(CitationAnnotationReplayReplacement),
        trace: S.Array(Trace),
        checks: S.Array(S.Struct({ fast: S.Boolean })),
        wrapped: S.Array(S.Struct({ text: CitationNativeUnicodeHex })),
        coercions: S.Array(S.String).check(S.isMaxLength(0)),
        result: S.TaggedUnion({
          Success: { text: CitationNativeUnicodeHex },
          Failure: { kind: S.Literals(["TypeError", "ValueError"]) },
        }),
      })
    ).check(S.isBetweenLength(144, 144)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Actual original callback traces and final outcomes across all annotation modes.",
  })
);
const empty = CitationPythonUnicodeStorage.make({ width: 1, bytes: new Uint8Array() });
const segments = (values: ReadonlyArray<CitationPythonUnicodeStorage>) =>
  A.map(values, (source) => ({ source, start: 0, end: source.bytes.length / source.width }));
const outputText = Effect.fn("AnnotationCallbackTest.output")(function* (
  program: typeof Program.Type,
  before: CitationPythonUnicodeStorage,
  span: CitationPythonUnicodeStorage,
  after: CitationPythonUnicodeStorage,
  budget: CitationTextBudget["Service"]
) {
  if (program === "join")
    return yield* concatCitationPythonRanges(segments([before, span, after]), (layout) =>
      budget.reserve(layout.utf16Units)
    );
  if (program === "empty") return empty;
  if (program !== "reverse") return span;
  const ranges = segments([after]);
  for (let index = span.bytes.length / span.width - 1; index >= 0; index--)
    ranges.push({ source: span, start: index, end: index + 1 });
  ranges.push(...segments([before]));
  return yield* concatCitationPythonRanges(ranges, (layout) => budget.reserve(layout.utf16Units));
});
const selectRows = (
  rows: ReadonlyArray<(typeof Corpus.Type)["cases"][number]>,
  full: boolean,
  uncheckedOnly: boolean
) => {
  if (uncheckedOnly) return A.filter(rows, (row) => row.mode === "unchecked");
  if (full) return rows;
  return A.filter(
    rows,
    (row) => row.mode !== "unchecked" && A.contains(["join", "bad-first", "bad-then-raise"], row.program)
  );
};
/** @internal @category testing @since 0.0.0 */
export const replayCitationAnnotationCallbacks = Effect.fn("AnnotationCallbackTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean,
  uncheckedOnly?: boolean
) {
  const corpus = yield* readCitationOracleFixture(
    "annotation-callback",
    "b212c0289337730e0c0196b596c846a01c1cfba8ca0565d6f9226e2bcaeade09"
  ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
  const setup = yield* installCitationXmlWorker(kind);
  const rows = selectRows(corpus.cases, full, uncheckedOnly ?? false);
  let children = 0;
  for (const row of rows) {
    yield* Effect.logInfo("Citation callback replay row started").pipe(
      Effect.annotateLogs({ runtime: kind, row: row.id, mode: row.mode, program: row.program })
    );
    const observed = yield* Ref.make<ReadonlyArray<typeof Trace.Type>>([]);
    const port = CitationAnnotationAnnotator.of({
      annotate: Effect.fn("AnnotationCallbackTest.annotate")(function* (before, span, after) {
        const previous = yield* Ref.getAndUpdate(observed, A.append(Trace.make({ before, span, after })));
        const index = previous.length + 1;
        if ((row.program === "bad-then-raise" || row.program === "raise-second") && index === 2)
          return yield* CitationAnnotationCallbackFailure.make({ reason: "callback-failed" });
        if ((row.program === "bad-first" || row.program === "bad-then-raise") && index === 1)
          return CitationAnnotationCallbackResult.cases.NonText.make({});
        const text = yield* outputText(row.program, before, span, after, setup.budget);
        return CitationAnnotationCallbackResult.cases.Text.make({ text });
      }),
    });
    const processor = yield* Match.value(row.mode).pipe(
      Match.when("unchecked", () => Effect.succeedNone),
      Match.when("skip", () => makeCitationSkipAnnotationSpans().pipe(Effect.asSome)),
      Match.when("wrap", () =>
        makeCitationWrapAnnotationSpans(
          setup.limits,
          makeCitationAnnotationWrap(setup.limits, setup.regexRuntime)
        ).pipe(Effect.asSome)
      ),
      Match.exhaustive,
      Effect.provideContext(setup.provided),
      Effect.provideService(CitationTextBudget, setup.budget),
      Effect.provideService(CitationXmlBalance, setup.worker.raw)
    );
    const replay = yield* makeCitationAnnotationReplay(setup.limits, setup.budget, O.getOrUndefined(processor)).pipe(
      Effect.flatMap((stage) =>
        makeCitationTestScaffoldBinding(setup.limits, "annotate").pipe(
          Effect.map((bind) => ({ ...stage, assemble: bind(stage.assemble) }))
        )
      ),
      Effect.provideService(CitationAnnotationAnnotator, port)
    );
    const output = replay.assemble(row.source, row.input);
    if (row.result._tag === "Failure") {
      const error = yield* Effect.flip(output);
      expect(error, `${kind}:${row.id}`).toEqual(
        CitationAnnotationCallbackFailure.make({
          reason: row.result.kind === "TypeError" ? "invalid-result" : "callback-failed",
        })
      );
    } else {
      const value = yield* output;
      expect(value, `${kind}:${row.id}`).toEqual(row.result.text);
    }
    const actual = yield* Ref.get(observed);
    expect(actual, `${kind}:${row.id}:trace`).toEqual(row.trace);
    children += A.filter(row.checks, (check) => !check.fast).length + row.wrapped.length;
    const counts = yield* setup.observed.snapshot;
    yield* Effect.logInfo("Citation callback replay row completed").pipe(
      Effect.annotateLogs({ runtime: kind, row: row.id, spawned: counts.spawned, confirmed: counts.confirmed })
    );
  }
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, children);
});
