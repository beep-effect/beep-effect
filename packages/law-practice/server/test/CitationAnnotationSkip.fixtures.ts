/** Original skip annotation replay with actual XML/style/assembly capabilities.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { makeCitationSkipAnnotationSpans } from "@beep/law-practice-server/internal/Citation/AnnotationSkip";
import {
  CitationAnnotationSpanDecision,
  CitationAnnotationSpanProcessor,
} from "@beep/law-practice-server/internal/Citation/AnnotationSpan";
import { CitationXmlBalance } from "@beep/law-practice-server/internal/Citation/XmlWorker";
import { CitationTextBudget } from "@beep/law-practice-use-cases/server";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import {
  CitationAnnotationReplayReplacement,
  makeCitationAnnotationReplay,
  makeCitationAnnotationXmlTrace,
} from "./CitationAnnotationReplay.fixtures.ts";
import { assertCitationWorkerCompositionReleased, readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";
import { installCitationXmlWorker } from "./CitationXmlWorker.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const $I = $LawPracticeServerId.create("test/CitationAnnotationSkip");
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
        input: S.Array(CitationAnnotationReplayReplacement),
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
  const skipped = yield* Ref.make(0);
  const observedXml = yield* makeCitationAnnotationXmlTrace(setup.worker);
  const processor = yield* makeCitationSkipAnnotationSpans().pipe(
    Effect.provideService(CitationTextBudget, setup.budget),
    Effect.provideService(CitationXmlBalance, observedXml.xml)
  );
  const observed = CitationAnnotationSpanProcessor.of({
    prepare: Effect.fn("AnnotationSkipTest.observeDecision")(function* (source, replacement) {
      const decision = yield* processor.prepare(source, replacement);
      if (CitationAnnotationSpanDecision.guards.Skip(decision)) yield* Ref.update(skipped, (count) => count + 1);
      return decision;
    }),
  });
  const assembly = yield* makeCitationAnnotationReplay(setup.limits, setup.budget, observed);
  const rows = full ? corpus.cases : A.filter(corpus.cases, (row) => row.id % 7 === 2 || row.id % 7 === 5);
  let children = 0;
  for (const row of rows) {
    yield* observedXml.reset;
    yield* Ref.set(skipped, 0);
    const result = yield* assembly.assemble(row.source, row.input);
    expect(result, `${kind}:${row.id}`).toEqual(row.result);
    const expected = A.filter(row.checks, (check) => !check.fast);
    const actual = yield* observedXml.snapshot;
    expect(actual, `${kind}:${row.id}:checks`).toEqual(expected);
    const warnings = yield* Ref.get(skipped);
    expect(warnings).toBe(row.warnings.length);
    children += expected.length;
  }
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, children);
});
