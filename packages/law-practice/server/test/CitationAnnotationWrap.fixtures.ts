/** Actual native tag matching and full wrap annotation source replay.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  makeCitationAnnotationWrap,
  makeCitationWrapAnnotationSpans,
} from "@beep/law-practice-server/internal/Citation/AnnotationWrap";
import { CitationXmlBalance } from "@beep/law-practice-server/internal/Citation/XmlWorker";
import { CitationPythonUnicodeStorage, CitationTextBudget } from "@beep/law-practice-use-cases/server";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as S from "effect/Schema";
import {
  assertCitationAnnotationOutcome,
  CitationAnnotationReplayReplacement,
  makeCitationAnnotationReplay,
  makeCitationAnnotationXmlTrace,
} from "./CitationAnnotationReplay.fixtures.ts";
import { readCitationAnnotationWrapCorpus } from "./CitationAnnotationTemplate.fixtures.ts";
import { makeCitationRegexTestRuntime } from "./CitationNativeSpawner.fixtures.ts";
import {
  assertCitationWorkerCompositionReleased,
  readCitationOracleFixture,
  setupCitationMetadataRuntime,
} from "./CitationRegexWorker.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";
import { installCitationXmlWorker } from "./CitationXmlWorker.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

/** @internal @category testing @since 0.0.0 */
export const replayCitationNativeWrap = Effect.fn("AnnotationWrapTest.native")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const corpus = yield* readCitationAnnotationWrapCorpus;
  const setup = yield* setupCitationMetadataRuntime(kind, undefined, true);
  const wrapper = yield* makeCitationAnnotationWrap(setup.limits, setup.runtime).pipe(
    Effect.provideContext(setup.provided),
    Effect.provideService(CitationTextBudget, setup.budget)
  );
  const rows = full
    ? corpus.cases
    : A.filter(corpus.cases, (row) => row.id % 110 === 0 || row.id % 110 === 34 || row.id % 110 === 16);
  let children = 0;
  for (const row of rows) {
    const output = wrapper.wrap(
      CitationPythonUnicodeStorage.make(row.source),
      CitationPythonUnicodeStorage.make(row.before),
      CitationPythonUnicodeStorage.make(row.after)
    );
    yield* assertCitationAnnotationOutcome(output, row.result, `${kind}:${row.id}`);
    if (row.result._tag === "Success") children++;
  }
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, children);
});
const $I = $LawPracticeServerId.create("test/CitationAnnotationWrap");
const Check = S.Struct({ text: CitationNativeUnicodeHex, fast: S.Boolean, value: S.Boolean }).pipe(
  $I.annoteSchema("Check", { description: "Actual original XML check in execution order." })
);
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-annotation-wrap-composition/v1"),
    oracleCommit: S.tag("04d82c032ad5fd0f9ab72a61c87110c46ee8f52e"),
    producerSha256: S.tag("4277edbb6d168dd9fdd6373e9ef0533b16cdeebdcfcc7a1c6ab47b796918cfff"),
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        source: CitationNativeUnicodeHex,
        input: S.Array(CitationAnnotationReplayReplacement),
        checks: S.Array(Check),
        wrapped: S.Array(S.Struct({ success: S.Boolean })),
        result: S.TaggedUnion({
          Success: { text: CitationNativeUnicodeHex },
          Failure: { kind: S.Literals(["error", "IndexError"]) },
        }),
      })
    ).check(S.isBetweenLength(162, 162)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Original complete wrap dispatch outputs/refusals and actual parser/wrap calls.",
  })
);
/** @internal @category testing @since 0.0.0 */
export const replayCitationWrapComposition = Effect.fn("AnnotationWrapTest.composition")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const corpus = yield* readCitationOracleFixture(
    "annotation-wrap-composition",
    "c91c4ec5e74e1ac4d80846218b5c6ed7dd181df138690d845da9081a04d13b6a"
  ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
  const setup = yield* installCitationXmlWorker(kind);
  const fs = yield* FileSystem.FileSystem;
  const regexDirectory = yield* fs.makeTempDirectoryScoped({ prefix: "citation-wrap-regex-" });
  const runtime = yield* makeCitationRegexTestRuntime(kind, regexDirectory);
  const observedXml = yield* makeCitationAnnotationXmlTrace(setup.worker);
  const processor = yield* makeCitationWrapAnnotationSpans(setup.limits, runtime).pipe(
    Effect.provideContext(setup.provided),
    Effect.provideService(CitationTextBudget, setup.budget),
    Effect.provideService(CitationXmlBalance, observedXml.xml)
  );
  const assembly = yield* makeCitationAnnotationReplay(setup.limits, setup.budget, processor);
  const rows = full ? corpus.cases : A.filter(corpus.cases, (row) => row.id % 9 === 2 || row.id % 9 === 8);
  let children = 0;
  for (const row of rows) {
    yield* observedXml.reset;
    const output = assembly.assemble(row.source, row.input);
    yield* assertCitationAnnotationOutcome(output, row.result, `${kind}:${row.id}`);
    const expected = A.filter(row.checks, (check) => !check.fast);
    const actual = yield* observedXml.snapshot;
    expect(actual, `${kind}:${row.id}:xml`).toEqual(expected);
    children += expected.length + A.filter(row.wrapped, (call) => call.success).length;
  }
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, children);
});
