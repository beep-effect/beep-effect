/** Original attribute criteria and reuse of existing production model operations.
 * get_comparison_attrs derives from eyecite 2.7.6 tests/test_FindTest.py,
 * Free Law Project, BSD-2-Clause; see THIRD_PARTY_NOTICES.md.
 * @internal @packageDocumentation @since 0.0.0
 */
import { Citation } from "@beep/law-practice-domain/values";
import { makeCitationMetadataYearFromBound } from "@beep/law-practice-server/internal/Citation/MetadataYear";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import {
  CitationResourceCorrectionInput,
  makeCitationResourceCorrection,
} from "@beep/law-practice-server/internal/Citation/ResourceCorrection";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { projectCitationSemanticMetadata } from "./CitationSemanticExtraction.fixtures.ts";
import type { FullCitation, ShortFormCaseCitation } from "@beep/law-practice-domain/values";
import type { CitationPythonUnicodeStorage } from "@beep/law-practice-use-cases/server";
import type { installCitationSourceDocumentConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";

const Fields = S.Record(S.String, S.NullOr(S.String));
const Attributes = S.Struct({
  groups: Fields,
  metadata: S.Struct({ pythonType: S.String, fields: Fields }),
  corrected_reporter: S.String.pipe(S.NullOr, S.optionalKey),
  year: S.Int.pipe(S.NullOr, S.optionalKey),
});
const Frame = S.Struct({ functionId: S.String, invocationOrdinal: S.Natural, iterationIds: S.Array(S.String) });
const Header = S.fromJsonString(
  S.Struct({
    context: S.Struct({
      frames: S.Array(Frame).check(S.isMinLength(1)),
      values: S.Struct({
        q: S.String,
        kwargs: S.JsonObject,
        tokenizer: S.Struct({ tokenizer: S.String }),
        cites_found: S.JsonObject.pipe(S.Array, S.optionalKey),
      }),
    }),
  })
);
const Operand = S.Struct({ kind: S.tag("value"), value: Attributes });
const Criterion = S.fromJsonString(
  S.Struct({
    passed: S.tag(true),
    relation: S.Struct({ kind: S.tag("comparison"), equal: S.tag(true) }),
    operands: S.Tuple([Operand, Operand, S.Struct({ kind: S.tag("value"), value: S.String })]),
    context: S.Struct({ values: S.Struct({ expected_attrs: Attributes }) }),
  })
);
const Event = S.Struct({ id: S.String, payload: S.String });
const Attribute = S.Struct({ id: S.String, index: S.Natural, expected: Attributes });
const Key = S.Struct({ id: S.String, q: S.String, kwargs: S.JsonObject, frame: Frame });
const Link = S.Struct({ key: Key, attributes: S.Array(Attribute) });
const sameAttributes = S.toEquivalence(Attributes);
const names: Readonly<Record<string, string>> = {
  pin_cite: "pinCite",
  antecedent_guess: "antecedentGuess",
  extra: "additionalText",
  resolved_case_name: "caseName",
  resolved_case_name_short: "shortCaseName",
};
/** Normalize represented metadata names; coordinate fields have separate proof.
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const projectCitationCanonicalExpectedMetadata = (fields: typeof Fields.Type) =>
  R.fromEntries(
    A.map(
      A.filter(R.toEntries(fields), ([key]) => key !== "pin_cite_span_start" && key !== "pin_cite_span_end"),
      ([key, value]) => [names[key] ?? key, value] as const
    )
  );
const linkAttribute = Effect.fn("CanonicalAttributesTest.link")(function* (
  event: typeof Event.Type,
  header: typeof Header.Type,
  previous: typeof Link.Type
) {
  const frame = A.getUnsafe(header.context.frames, 0);
  const key = previous.key;
  expect(
    [header.context.values.q, header.context.values.kwargs, frame.functionId, frame.invocationOrdinal],
    event.id
  ).toEqual([key.q, key.kwargs, key.frame.functionId, key.frame.invocationOrdinal]);
  expect(A.take(frame.iterationIds, key.frame.iterationIds.length), event.id).toEqual(key.frame.iterationIds);
  const criterion = yield* S.decodeEffect(Criterion)(event.payload);
  const expected = criterion.operands[1].value;
  expect(sameAttributes(expected, criterion.context.values.expected_attrs), event.id).toBe(true);
  expect(sameAttributes(expected, criterion.operands[0].value), event.id).toBe(true);
  return Link.make({
    key,
    attributes: A.append(
      previous.attributes,
      Attribute.make({ id: event.id, index: previous.attributes.length, expected })
    ),
  });
});
/** Link original zip-loop assertions to their count invocation and list position.
 * Source frames, raw arguments, both operands and explicit assertion success
 * are checked before any target comparison. Other tokenizers stay separate.
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const readCitationCanonicalAttributeLinks = Effect.fn("CanonicalAttributesTest.read")(function* (
  events: ReadonlyArray<typeof Event.Type>
) {
  let links = HashMap.empty<string, typeof Link.Type>();
  let active = O.none<string>();
  for (const event of events) {
    const header = yield* S.decodeEffect(Header)(event.payload);
    const values = header.context.values;
    if (values.tokenizer.tokenizer !== "Tokenizer") continue;
    if (values.cites_found !== undefined) {
      const key = Key.make({
        id: event.id,
        q: values.q,
        kwargs: values.kwargs,
        frame: A.getUnsafe(header.context.frames, 0),
      });
      links = HashMap.set(links, event.id, Link.make({ key, attributes: [] }));
      active = O.some(event.id);
      continue;
    }
    const id = yield* Effect.fromOption(active);
    const previous = yield* Effect.fromOption(HashMap.get(links, id));
    const linked = yield* linkAttribute(event, header, previous);
    links = HashMap.set(links, id, linked);
  }
  return HashMap.map(links, (value) => value.attributes);
});
/** Reuse source-derived correction/year kernels on actual public semantic data.
 * No expected model is passed to those kernels; scalar results are compared
 * with the independent original assertion operand.
 *
 * **Example** (Preparing a fresh canonical replay dependency)
 * ```ts
 * import * as Effect from "effect/Effect";
 * import { installCitationSourceDocumentConfigurationFixture } from "./CitationDefaultConfiguration.fixtures.ts";
 * import { makeCitationCanonicalAttributeAssertion } from "./CitationCanonicalAttributes.fixtures.ts";
 * const assertion = Effect.gen(function* () {
 *   const installed = yield* installCitationSourceDocumentConfigurationFixture("bun");
 *   return yield* makeCitationCanonicalAttributeAssertion(installed);
 * });
 * ```
 * @internal
 * @category testing
 * @since 0.0.0
 */
export const makeCitationCanonicalAttributeAssertion = Effect.fn("CanonicalAttributesTest.make")(function* (
  installed: Pick<
    Effect.Success<ReturnType<typeof installCitationSourceDocumentConfigurationFixture>>,
    "setup" | "provided" | "defaultConfiguration"
  >
) {
  const { setup, provided, defaultConfiguration } = installed;
  // Every kernel captures the installation's Clock, as the engine's own owners do. On the default
  // Clock the year kernel's 997 ms extract budget ran in real time and failed hosted replays
  // (PR #3013 lps-int-12: `extractDeadline` from `getMetadataYear`). On the installation's manual
  // clock that 997 ms wait never fires here and these assertions run after `engine.extract`, so a
  // hung kernel is bounded only by the Vitest timeout; CitationMetadataYear.test.ts keeps the
  // `extractDeadline` expiry coverage.
  const unicode = yield* makeCitationPythonUnicode(setup.limits).pipe(Effect.provideContext(provided));
  const correction = yield* makeCitationResourceCorrection(setup.limits).pipe(Effect.provideContext(provided));
  const bound = defaultConfiguration.extraction.extraction.loop.full.case.post.highestValidYear;
  const years = yield* makeCitationMetadataYearFromBound(setup.limits, bound).pipe(Effect.provideContext(provided));
  const toStorage = Effect.fnUntraced(function* (text: string | null) {
    return text === null ? null : (yield* unicode.fromText(text)).storage;
  });
  const toText = Effect.fnUntraced(function* (storage: CitationPythonUnicodeStorage | null) {
    return storage === null ? null : (yield* unicode.fromStorage(storage)).text;
  });
  const resource = Effect.fn("CanonicalAttributesTest.resource")(function* (
    citation: FullCitation | ShortFormCaseCitation
  ) {
    const encoded = yield* S.encodeEffect(Citation)(citation);
    const reporter = R.get(encoded.components, "reporter");
    const fields = O.isNone(reporter) ? {} : { reporter: yield* toStorage(reporter.value) };
    const corrected = yield* correction.reporter(
      CitationResourceCorrectionInput.make({
        ...fields,
        editionGuess: O.getOrNull(citation.publication.selectedEdition),
      })
    );
    const correctedReporter = yield* toText(corrected);
    let year: number | null = null;
    if (O.isSome(citation.metadata.year)) {
      const native = yield* unicode.fromText(citation.metadata.year.value);
      const value = yield* years.getYear(native.storage);
      year = O.getOrNull(value);
    }
    return { correctedReporter, year };
  });
  return Effect.fn("CanonicalAttributesTest.compare")(function* (citation: Citation, original: typeof Attribute.Type) {
    const encoded = yield* S.encodeEffect(Citation)(citation);
    const expected = original.expected;
    expect(encoded.components, original.id).toEqual(expected.groups);
    for (const key of ["pin_cite_span_start", "pin_cite_span_end"])
      expect(O.getOrNull(R.get(expected.metadata.fields, key)), original.id).toBe(null);
    const actualMetadata = yield* projectCitationSemanticMetadata(citation);
    expect(actualMetadata, original.id).toEqual(projectCitationCanonicalExpectedMetadata(expected.metadata.fields));
    if ("publication" in citation) {
      const actual = yield* resource(citation);
      expect(actual.correctedReporter, original.id).toBe(expected.corrected_reporter);
      expect(actual.year, original.id).toBe(expected.year);
    } else {
      expect(expected.corrected_reporter, original.id).toBeUndefined();
      expect(expected.year, original.id).toBeUndefined();
    }
  });
});
