/** Original full-opinion long-diff assertion from eyecite 2.7.6, BSD-2-Clause.
 * @internal @packageDocumentation @since 0.0.0
 */
import { ResolvedSourceText, SourceTextResolver } from "@beep/file-processing/SourceText";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import {
  CitationAnnotationReplacement,
  CitationBuiltinCleanerName,
  CitationEngineAnnotationInput,
  CitationEngineCleanInput,
} from "@beep/law-practice-use-cases/server";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { readCitationCanonicalCaptures } from "./CitationCanonicalCaptures.fixtures.ts";
import { installCitationDefaultConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
import { buildCitationDefaultEngineFixture } from "./CitationEngineLayer.fixtures.ts";
import { citationFixtureSourceProof } from "./CitationOccurrenceProjection.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";

const prefix = "tests.test_AnnotateTest.AnnotateTest.test_long_diff::tests/test_AnnotateTest.py:";
const Word = S.Struct({ kind: S.tag("value"), value: S.String });
const Criterion = S.Struct({
  operands: S.Tuple([Word, Word]),
  context: S.Struct({
    values: S.Struct({
      opinion_text: S.String,
      cleaned_text: S.String,
      annotated_text: S.String,
    }),
  }),
  relation: S.Struct({ kind: S.tag("membership"), contains: S.tag(true) }),
  passed: S.tag(true),
}).pipe(S.fromJsonString);
const Annotation = S.Struct({
  annotations: S.Array(S.Tuple([S.Tuple([S.Int, S.Int]), S.String, S.String])),
  annotator: S.Null,
  offset_updater: S.Null,
  use_dmp: S.tag(true),
  unbalanced_tags: S.tag("unchecked"),
});
const readCase = Effect.fn("CanonicalLongDiffTest.read")(function* () {
  const { operations, assertions } = yield* readCitationCanonicalCaptures();
  const rows = A.filter(operations.cases, (row) => Str.startsWith(prefix)(row.id));
  expect(rows).toHaveLength(2);
  const clean = yield* Effect.fromOption(A.findFirst(rows, (row) => row.id === `${prefix}301:23:clean_text::1`));
  const annotate = yield* Effect.fromOption(
    A.findFirst(rows, (row) => row.id === `${prefix}302:25:annotate_citations::1`)
  );
  if (clean.operation !== "clean_text" || annotate.operation !== "annotate_citations")
    return yield* Effect.die("Expected original clean and annotation calls");
  const cleaner = clean.payload.value;
  const annotation = annotate.payload.value;
  if (cleaner.outcome.kind !== "success" || annotation.outcome.kind !== "success")
    return yield* Effect.die("Expected successful original workflow");
  const steps = yield* S.decodeUnknownEffect(OriginalCleanerSteps)(cleaner.input.steps);
  expect(steps).toEqual(["all_whitespace"]);
  const options = yield* S.decodeUnknownEffect(Annotation)(annotation.input);
  const id = `${prefix}305:8:caseDeclaration::1`;
  const captured = yield* Effect.fromOption(HashMap.get(assertions, id));
  const criterion = yield* S.decodeEffect(Criterion)(captured.payload);
  expect(annotation.input.plain_text, id).toBe(cleaner.outcome.value);
  expect(annotation.input.source_text, id).toBe(cleaner.input.text);
  expect(criterion.context.values.opinion_text, id).toBe(cleaner.input.text);
  expect(criterion.context.values.cleaned_text, id).toBe(cleaner.outcome.value);
  expect(criterion.context.values.annotated_text, id).toBe(annotation.outcome.value);
  expect(criterion.operands[1].value, id).toBe(annotation.outcome.value);
  expect(criterion.operands[0].value, id).toBe("~FOO~539\n  U. S. 306~BAR~");
  return {
    id,
    raw: cleaner.input.text,
    plain: cleaner.outcome.value,
    expected: annotation.outcome.value,
    needle: criterion.operands[0].value,
    steps,
    options,
  };
});

/** Execute the original standalone clean/annotate workflow with genuine host source proofs.
 * A cleaned native value is registered by the fixture host as a separate source;
 * clean itself does not mint a verified derived manifestation.
 * @internal @category testing @since 0.0.0
 */
export const replayCitationCanonicalLongDiff = Effect.fn("CanonicalLongDiffTest.replay")(function* (
  kind: CitationNativeRuntimeKind
) {
  const original = yield* readCase();
  const installed = yield* installCitationDefaultConfigurationFixture(kind);
  const raw = yield* citationFixtureSourceProof(original.raw);
  const sources = yield* Ref.make<ReadonlyArray<typeof raw>>([raw]);
  const resolver = SourceTextResolver.of({
    resolve: Effect.fn("CanonicalLongDiffTest.source")(function* (request) {
      const available = yield* Ref.get(sources);
      const proof = yield* Effect.fromOption(
        A.findFirst(available, (value) => value.source.textDigest === request.identity.textDigest)
      ).pipe(Effect.orDie);
      return ResolvedSourceText.make({ identity: proof.source, text: proof.sourceText });
    }),
  });
  const built = yield* buildCitationDefaultEngineFixture(installed, resolver);
  const steps = yield* built.adapter.create({ kind: "list", names: original.steps });
  const plan = yield* built.adapter.document.plan(steps);
  const cleaned = yield* built.engine.clean(
    CitationEngineCleanInput.make({ source: raw.source, sourceText: raw.sourceText, plan })
  );
  const unicode = yield* makeCitationPythonUnicode(installed.setup.limits, "annotate");
  const cleanedStorage = yield* Effect.fromOption(cleaned.text);
  const plain = yield* unicode.fromStorage(cleanedStorage);
  expect(plain.text, original.id).toBe(original.plain);
  const cleanedProof = yield* citationFixtureSourceProof(plain.text);
  yield* Ref.update(sources, (values) => A.append(values, cleanedProof));
  const replacements = yield* Effect.forEach(
    original.options.annotations,
    Effect.fnUntraced(function* ([range, beforeText, afterText]) {
      const { before, after } = yield* Effect.all({
        before: unicode.fromText(beforeText),
        after: unicode.fromText(afterText),
      });
      return CitationAnnotationReplacement.make({
        start: range[0],
        end: range[1],
        before: before.storage,
        after: after.storage,
      });
    })
  );
  const result = yield* built.engine
    .annotate(
      CitationEngineAnnotationInput.make({
        plain: { source: cleanedProof.source, sourceText: cleanedProof.sourceText },
        markup: { source: raw.source, sourceText: raw.sourceText },
        replacements,
        mode: original.options.unbalanced_tags,
        useDmp: original.options.use_dmp,
      })
    )
    .pipe(
      Effect.tapError((error) =>
        Effect.logWarning("Original long-diff workflow refused").pipe(
          Effect.annotateLogs({
            runtime: kind,
            caseId: original.id,
            failure: error._tag,
            limit: error._tag === "CitationSafetyLimitExceeded" ? error.limit : "none",
          })
        )
      )
    );
  const expected = yield* unicode.fromText(original.expected);
  expect(result.text, original.id).toEqual(expected.storage);
  const output = yield* unicode.fromStorage(result.text);
  expect(Str.includes(original.needle)(output.text), original.id).toBe(true);
  const operations = yield* built.operation.snapshot;
  expect(operations).toMatchObject({ active: 0, queued: 0 });
  const counts = yield* installed.setup.observed.snapshot;
  expect(counts.confirmed).toBe(counts.spawned);
});

const OriginalCleanerSteps = S.Array(CitationBuiltinCleanerName);
