/** Original HTML helper mutations through prepared geometry and owned workers.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import {
  CitationHtmlCaseNameConfiguration,
  makeCitationHtmlCaseName as makeOwnedCitationHtmlCaseName,
} from "@beep/law-practice-server/internal/Citation/HtmlCaseName";
import { CitationInvocation } from "@beep/law-practice-server/internal/Citation/Invocation";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Scope from "effect/Scope";
import { installCitationOwnedTestStage } from "./CitationConfigurationOwnership.fixtures.ts";
import { installCitationHtmlGeometryFixture } from "./CitationHtmlGeometryPreparation.fixtures.ts";
import { makeCitationTestInvocationBinding, withCitationTestInvocation } from "./CitationInvocation.fixtures.ts";
import {
  assertCitationWorkerCompositionReleased,
  readCitationOracleFixture,
  setupCitationMetadataRuntime,
} from "./CitationRegexWorker.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";
import type { CitationHtmlTagGeometryInput } from "@beep/law-practice-server/internal/Citation/HtmlTagGeometry";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const makeCitationHtmlCaseName = installCitationOwnedTestStage({
  schema: CitationHtmlCaseNameConfiguration,
  install: makeOwnedCitationHtmlCaseName,
});

const $I = $LawPracticeServerId.create("test/CitationHtmlCaseName");
const Native = CitationNativeUnicodeHex;
const Snapshot = S.Struct({
  metadata: S.Struct({
    plaintiff: Native.pipe(S.NullOr, S.optionalKey),
    defendant: Native.pipe(S.NullOr, S.optionalKey),
    antecedent_guess: Native.pipe(S.NullOr, S.optionalKey),
  }),
  fullSpanStart: S.NullOr(S.Int),
  span: S.Tuple([S.Int, S.Int]),
});
const Corpus = S.fromJsonString(
  S.Struct({
    schemaVersion: S.tag("citation-html-case-names/v1"),
    cases: S.Array(
      S.Struct({
        id: S.Natural,
        markup: Native,
        plain: Native,
        index: S.Int,
        short: S.Boolean,
        words: S.Array(
          S.Struct({
            kind: S.String,
            text: Native,
            start: S.NullOr(S.Int),
            groups: S.Record(S.String, S.NullOr(Native)),
          })
        ),
        before: Snapshot,
        after: Snapshot,
        calls: S.Array(S.Struct({ operation: S.String, name: S.optionalKey(S.String) })),
      })
    ).check(S.isBetweenLength(128, 128)),
  })
).pipe(
  $I.annoteSchema("Corpus", {
    description: "Byte-sealed original HTML helper input and before/after mutation observations.",
  })
);
const Pattern = S.fromJsonString(
  S.Struct({
    configuration: S.Struct({
      patterns: S.Struct({ splitV: Native }),
      bindings: CitationHtmlCaseNameConfiguration.fields.bindings,
    }),
  })
);
const Cleaner = S.fromJsonString(
  S.Struct({
    configuration: S.Struct({
      patterns: S.Struct({ stopWords: Native, leadingIn: Native }),
      bindings: CitationHtmlCaseNameConfiguration.fields.cleaner.fields.bindings,
    }),
  })
);
/** Read the sealed original corpus and reusable native helper configuration. */
export const readCitationHtmlCaseNameCorpus = Effect.fn("HtmlCaseNameTest.load")(function* () {
  const corpus = yield* readCitationOracleFixture(
    "html-case-names",
    "e6231633d7a3d4115295517539aecda42045ce2a8253f565f9db86dacfcf1670"
  ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
  const pattern = yield* readCitationOracleFixture(
    "html-case-name-pattern",
    "4fd9710564c5d2ee74e298f3db7f1f4d08bb3d9543ab598afff340323a9dc0c4"
  ).pipe(Effect.flatMap(S.decodeEffect(Pattern)));
  const cleaner = yield* readCitationOracleFixture(
    "stop-word-patterns",
    "98bdf393eb38077254b0a241767ef935ee4adaf04184c0d29b08565b1c5fa1ae"
  ).pipe(Effect.flatMap(S.decodeEffect(Cleaner)));
  return { corpus, configuration: { ...pattern.configuration, cleaner: cleaner.configuration } };
});

type Row = (typeof Corpus.Type.cases)[number];
const requestOf = (row: Row, geometry: CitationHtmlTagGeometryInput) => ({
  words: A.map(row.words, (word) => ({
    kind: word.kind === "str" ? "Text" : word.kind,
    data: word.text,
    start: word.start,
    stopWord: O.getOrElse(O.fromUndefinedOr(word.groups.stop_word), () => null),
  })),
  index: row.index,
  short: row.short,
  spanStart: row.before.span[0],
  geometry,
});
const install = Effect.fn("HtmlCaseNameTest.install")(function* (kind: CitationNativeRuntimeKind) {
  const original = yield* readCitationHtmlCaseNameCorpus();
  const setup = yield* setupCitationMetadataRuntime(kind);
  const prepare = yield* installCitationHtmlGeometryFixture(kind, setup);
  const stage = yield* makeCitationHtmlCaseName(setup.limits, setup.runtime, original.configuration).pipe(
    Effect.flatMap((stage) =>
      makeCitationTestInvocationBinding(setup.limits).pipe(
        Effect.map((bind) => ({ ...stage, extract: bind(stage.extract) }))
      )
    ),
    Effect.provideContext(setup.provided)
  );
  return { original, setup, prepare, stage };
});

/** Smoke reaches all five branches and every helper-call shape; the full source replay retired 2026-11-09. */
export const replayCitationHtmlCaseName = Effect.fn("HtmlCaseNameTest.replay")(function* (
  kind: CitationNativeRuntimeKind,
  full: boolean
) {
  const { original, setup, prepare, stage } = yield* install(kind);
  const rows = A.filter(
    original.corpus.cases,
    (row) => full || A.contains([0, 4, 9, 10, 28, 36, 50, 54, 66, 98, 114], row.id)
  );
  let expectedChildren = 0;
  for (const row of rows) {
    const prepared = yield* prepare.prepare({ plain: row.plain, markup: row.markup });
    const invocation = stage.extract(requestOf(row, prepared.geometry));
    const closed: Effect.Effect<Effect.Success<typeof invocation>, Effect.Error<typeof invocation>> = invocation;
    const result = yield* closed;
    expect(
      O.getOrElse(result.patch.plaintiff, () => row.before.metadata.plaintiff),
      `${kind}:${row.id}:plaintiff`
    ).toEqual(row.after.metadata.plaintiff);
    expect(
      O.getOrElse(result.patch.defendant, () => row.before.metadata.defendant),
      `${kind}:${row.id}:defendant`
    ).toEqual(row.after.metadata.defendant);
    expect(
      O.getOrElse(result.patch.antecedentGuess, () => row.before.metadata.antecedent_guess),
      `${kind}:${row.id}:antecedent`
    ).toEqual(row.after.metadata.antecedent_guess);
    expect(
      O.getOrElse(result.patch.fullSpanStart, () => row.before.fullSpanStart),
      `${kind}:${row.id}:start`
    ).toEqual(row.after.fullSpanStart);
    expectedChildren +=
      4 +
      3 * A.filter(row.calls, (call) => call.operation === "clean").length +
      A.filter(row.calls, (call) => call.name === "_extract_from_single_html_element").length;
  }
  expect(rows).toHaveLength(full ? 128 : 11);
  yield* assertCitationWorkerCompositionReleased(
    setup.operation,
    setup.admission,
    setup.observed.snapshot,
    expectedChildren
  );
});

/** Invalid input and an exhausted captured budget publish no helper result or child. */
export const assertCitationHtmlCaseNameRefusal = Effect.fn("HtmlCaseNameTest.refusal")(function* () {
  const { original, setup, prepare, stage } = yield* install("bun");
  const invalid = yield* stage.extract(null).pipe(Effect.flip);
  expect(invalid).toMatchObject({ _tag: "CitationHtmlCaseNameFailure", reason: "invalid-input" });
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, 0);
  const row = A.getUnsafe(original.corpus.cases, 0);
  const prepared = yield* prepare.prepare({ plain: row.plain, markup: row.markup });
  yield* withCitationTestInvocation(
    Effect.gen(function* () {
      const { budget } = yield* CitationInvocation;
      const tight = yield* makeCitationHtmlCaseName(setup.limits, setup.runtime, original.configuration).pipe(
        Effect.flatMap((stage) =>
          makeCitationTestInvocationBinding(setup.limits).pipe(
            Effect.map((bind) => ({ ...stage, extract: bind(stage.extract) }))
          )
        ),
        Effect.provideContext(setup.provided)
      );
      const refused = yield* tight.extract(requestOf(row, prepared.geometry)).pipe(Effect.flip);
      expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "producedTextUtf16" });
      const used = yield* budget.snapshot;
      expect(used).toBe(0);
    }),
    { ...setup.limits, producedTextUtf16: 1 }
  );
  yield* assertCitationWorkerCompositionReleased(setup.operation, setup.admission, setup.observed.snapshot, 4);
});
/** A valid prepared request cannot start native work after its installed owner closes. */
export const assertCitationHtmlCaseNameLifetime = Effect.fn("HtmlCaseNameTest.lifetime")(function* () {
  const owner = yield* Scope.make();
  const installed = yield* install("bun").pipe(Effect.provideService(Scope.Scope, owner));
  const row = A.getUnsafe(installed.original.corpus.cases, 0);
  const prepared = yield* installed.prepare.prepare({ plain: row.plain, markup: row.markup });
  const before = yield* installed.setup.observed.snapshot;
  yield* Scope.close(owner, Exit.void);
  const closed = yield* installed.stage.extract(null).pipe(Effect.flip);
  expect(closed).toMatchObject({ _tag: "CitationAdmissionFailure", reason: "closed" });
  const failure = yield* withCitationTestInvocation(
    installed.stage.extract(requestOf(row, prepared.geometry)),
    installed.setup.limits
  ).pipe(Effect.flip);
  expect(failure).toMatchObject({ reason: "closed" });
  const after = yield* installed.setup.observed.snapshot;
  expect(after).toEqual(before);
});
