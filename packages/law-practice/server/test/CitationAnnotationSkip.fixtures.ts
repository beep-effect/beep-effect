/** Original skip annotation replay with actual XML/style/assembly capabilities.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationAnnotationReplacement,
  makeCitationAnnotationAssembly,
} from "@beep/law-practice-server/internal/Citation/AnnotationAssembly";
import { prepareCitationAnnotations } from "@beep/law-practice-server/internal/Citation/AnnotationPreparation";
import { makeCitationSkipAnnotationSpans } from "@beep/law-practice-server/internal/Citation/AnnotationSkip";
import {
  CitationAnnotationSpanDecision,
  CitationAnnotationSpanProcessor,
} from "@beep/law-practice-server/internal/Citation/AnnotationSpan";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { CitationXmlBalance } from "@beep/law-practice-server/internal/Citation/XmlWorker";
import { CitationPythonUnicodeStorage, CitationTextBudget } from "@beep/law-practice-use-cases/server";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import { assertCitationWorkerCompositionReleased, readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";
import { installCitationXmlWorker } from "./CitationXmlWorker.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationAnnotationSkip");
const Replacement = S.Struct({
  ...CitationAnnotationReplacement.fields,
  before: CitationNativeUnicodeHex,
  after: CitationNativeUnicodeHex,
}).pipe(
  $I.annoteSchema("Replacement", {
    description: "Original primitive annotation tuple before sorting and overlap handling.",
  })
);
const Check = S.Struct({ text: CitationNativeUnicodeHex, fast: S.Boolean, value: S.Boolean }).pipe(
  $I.annoteSchema("Check", {
    description: "Original XML/helper check in execution order, without parser instrumentation side effects.",
  })
);
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-annotation-skip/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    producerSha256: S.tag("23ae7e96a26ede3a3f5984e9ff562f7b64d7a53822f1ad6d834aefb4b62504f3"),
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        source: CitationNativeUnicodeHex,
        input: S.Array(Replacement),
        checks: S.Array(Check),
        warnings: S.Array(S.Literal("WARNING")),
        result: CitationNativeUnicodeHex,
      })
    ).check(S.isBetweenLength(126, 126)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Pinned original skip outputs, exact XML inputs/results and warning counts.",
  })
);
/** @internal @category testing @since 0.0.0 */
export const replayCitationSkipAnnotations = Effect.fn("AnnotationSkipTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const corpus = yield* readCitationOracleFixture(
    "annotation-skip",
    "b36159a80d90ef8ad8daeb58ee65b02728f262f12f98f33ef978e25429660e1a"
  ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
  const setup = yield* installCitationXmlWorker(kind);
  const unicode = yield* makeCitationPythonUnicode(setup.limits, "annotate");
  const trace = yield* Ref.make<ReadonlyArray<typeof Check.Type>>([]);
  const skipped = yield* Ref.make(0);
  const xml = CitationXmlBalance.of({
    balance: Effect.fn("AnnotationSkipTest.observeXml")(function* (source) {
      const value = yield* setup.worker.balance(source);
      yield* Ref.update(trace, A.append(Check.make({ text: source, fast: false, value })));
      return value;
    }),
  });
  const processor = yield* makeCitationSkipAnnotationSpans().pipe(
    Effect.provideService(CitationTextBudget, setup.budget),
    Effect.provideService(CitationXmlBalance, xml)
  );
  const observed = CitationAnnotationSpanProcessor.of({
    prepare: Effect.fn("AnnotationSkipTest.observeDecision")(function* (source, replacement) {
      const decision = yield* processor.prepare(source, replacement);
      if (CitationAnnotationSpanDecision.guards.Skip(decision)) yield* Ref.update(skipped, (count) => count + 1);
      return decision;
    }),
  });
  const assembly = yield* makeCitationAnnotationAssembly(setup.limits).pipe(
    Effect.provideService(CitationTextBudget, setup.budget),
    Effect.provideService(CitationAnnotationSpanProcessor, observed)
  );
  const rows = full ? corpus.cases : A.filter(corpus.cases, (row) => row.id % 7 === 2 || row.id % 7 === 5);
  let children = 0;
  for (const row of rows) {
    yield* Ref.set(trace, []);
    yield* Ref.set(skipped, 0);
    const source = yield* unicode.fromStorage(row.source);
    const replacements = A.map(row.input, (value) =>
      CitationAnnotationReplacement.make({
        ...value,
        before: CitationPythonUnicodeStorage.make(value.before),
        after: CitationPythonUnicodeStorage.make(value.after),
      })
    );
    const ordered = yield* prepareCitationAnnotations(setup.limits, replacements);
    const result = yield* assembly.assemble(source, ordered);
    expect(result, `${kind}:${row.id}`).toEqual(row.result);
    const expected = A.filter(row.checks, (check) => !check.fast);
    const actual = yield* Ref.get(trace);
    expect(actual, `${kind}:${row.id}:checks`).toEqual(expected);
    const warnings = yield* Ref.get(skipped);
    expect(warnings).toBe(row.warnings.length);
    children += expected.length;
  }
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, children);
});
