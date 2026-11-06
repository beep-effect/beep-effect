/** Exact original dynamic reference patterns and source-independent compiler checks.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationPythonUnicodeStorage } from "@beep/law-practice-server/internal/Citation/PythonHash";
import { makeCitationPythonUnicode } from "@beep/law-practice-server/internal/Citation/PythonUnicode";
import { makeCitationReferencePatterns } from "@beep/law-practice-server/internal/Citation/ReferencePatterns";
import {
  CitationRegexPatternDescriptor,
  makeCitationRegexDescriptorRegistry,
} from "@beep/law-practice-server/internal/Citation/RegexDescriptors";
import { CitationTextBudget, makeCitationTextBudget } from "@beep/law-practice-server/internal/Citation/TextBudget";
import { defaultCitationEnginePolicy } from "@beep/law-practice-use-cases/test";
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { makeCitationReferenceNameMetadata } from "./CitationReferenceNames.fixtures.ts";
import { readCitationOracleFixture } from "./CitationRegexWorker.fixtures.ts";
import { CitationNativeUnicodeHex } from "./CitationTokenSeed.fixtures.ts";
import type { CitationReferencePattern } from "@beep/law-practice-server/internal/Citation/ReferencePatterns";

const $I = $LawPracticeServerId.create("test/CitationReferencePatterns");
const Names = S.Struct({
  plaintiff: CitationNativeUnicodeHex.pipe(S.NullOr, S.optionalKey),
  defendant: CitationNativeUnicodeHex.pipe(S.NullOr, S.optionalKey),
  resolved_case_name_short: CitationNativeUnicodeHex.pipe(S.NullOr, S.optionalKey),
  resolved_case_name: CitationNativeUnicodeHex.pipe(S.NullOr, S.optionalKey),
}).pipe(
  $I.annoteSchema("Names", { description: "Original controlled four-name metadata; missing law fields remain absent." })
);
const Corpus = S.fromJsonString(
  S.Struct({
    disallowedNames: S.Array(S.String),
    patterns: S.Array(
      S.Struct({ ...CitationRegexPatternDescriptor.fields, pattern: CitationNativeUnicodeHex, id: S.String })
    ),
    cases: S.Array(
      S.Struct({ citation: S.Struct({ metadata: Names }), calls: S.Array(S.Struct({ pattern: S.String })) })
    ),
  })
).pipe($I.annoteSchema("Corpus", { description: "Original generated-reference patterns, name state and call order." }));
const Template = S.fromJsonString(
  S.Struct({
    literalCases: S.Array(
      S.Struct({
        mode: S.Literals(["pin", "markup"]),
        name: CitationNativeUnicodeHex,
        pattern: CitationNativeUnicodeHex,
        flags: S.Natural,
        profile: CitationRegexPatternDescriptor.fields.profile,
      })
    ).check(S.isBetweenLength(278, 278)),
    patterns: S.Struct({
      pinPrefix: CitationNativeUnicodeHex,
      pinSuffix: CitationNativeUnicodeHex,
      markupPrefix: CitationNativeUnicodeHex,
      markupSuffix: CitationNativeUnicodeHex,
      rejection: CitationNativeUnicodeHex,
    }),
  })
).pipe(
  $I.annoteSchema("Template", {
    description: "Observed original insertion boundaries, authenticated again by production.",
  })
);
const ownName = (value: CitationNativeUnicodeHex | null | undefined) =>
  value === null || value === undefined ? null : CitationPythonUnicodeStorage.make(value);
/** Compare every actually observed dynamic source pattern/profile and bind its compiler facts.
 * @internal @category testing @since 0.0.0
 */
export const replayCitationReferencePatterns = Effect.fn("ReferencePatternsTest.replay")(function* () {
  const corpus = yield* readCitationOracleFixture(
    "generated-references",
    "a741045d3c71ca4437c54e3af1781063c5ec66c091bfdfc4a4dbb2abce5d4006"
  ).pipe(Effect.flatMap(S.decodeEffect(Corpus)));
  const template = yield* readCitationOracleFixture(
    "reference-template",
    "25b2e91fac26f724a24f9822d299169cdc2dde8cd55cb91f1210b01f97ff9e68"
  ).pipe(Effect.flatMap(S.decodeEffect(Template)));
  const limits = (yield* defaultCitationEnginePolicy).limits;
  const budget = yield* makeCitationTextBudget(limits);
  const configuration = { patterns: template.patterns, disallowedNames: corpus.disallowedNames };
  const builder = yield* makeCitationReferencePatterns(limits, configuration).pipe(
    Effect.provideService(CitationTextBudget, budget)
  );
  const expected = HashMap.fromIterable(A.map(corpus.patterns, (row) => Tuple.make(row.id, row)));
  let bound = HashSet.empty<string>();
  yield* Effect.forEach(
    corpus.cases,
    Effect.fnUntraced(function* (row) {
      const m = row.citation.metadata;
      const metadata = makeCitationReferenceNameMetadata({
        plaintiff: ownName(m.plaintiff),
        defendant: ownName(m.defendant),
        resolvedCaseNameShort: ownName(m.resolved_case_name_short),
        resolvedCaseName: ownName(m.resolved_case_name),
      });
      yield* Effect.forEach(
        row.calls,
        Effect.fnUntraced(function* (call) {
          const original = yield* Effect.fromOption(HashMap.get(expected, call.pattern));
          const actual: CitationReferencePattern =
            call.pattern === `${builder.rejection.descriptor.patternSha256}:0`
              ? builder.rejection
              : yield* builder
                  .build(metadata, original.flags === 64 ? "pin" : "markup")
                  .pipe(Effect.flatMap(Effect.fromOption));
          expect(actual.pattern).toEqual(original.pattern);
          expect(actual.descriptor).toEqual({
            patternSha256: original.patternSha256,
            flags: original.flags,
            profile: original.profile,
          });
          if (HashSet.has(bound, call.pattern)) return;
          const registry = yield* makeCitationRegexDescriptorRegistry(limits, [actual.descriptor]);
          const checked = yield* registry.bind(actual.pattern, actual.descriptor.flags);
          expect(checked.descriptor).toEqual(actual.descriptor);
          bound = HashSet.add(bound, call.pattern);
        }),
        { concurrency: 1, discard: true }
      );
    }),
    { concurrency: 1, discard: true }
  );
  expect(HashSet.size(bound)).toBe(65);
  yield* Effect.forEach(
    template.literalCases,
    Effect.fnUntraced(function* (row) {
      const name = CitationPythonUnicodeStorage.make(row.name);
      const metadata = makeCitationReferenceNameMetadata({
        plaintiff: name,
        defendant: null,
        resolvedCaseNameShort: null,
        resolvedCaseName: null,
      });
      const built = yield* builder.build(metadata, row.mode).pipe(Effect.flatMap(Effect.fromOption));
      expect(built.pattern).toEqual(row.pattern);
      expect(built.descriptor.flags).toBe(row.flags);
      expect(built.descriptor.profile).toEqual(row.profile);
      const registry = yield* makeCitationRegexDescriptorRegistry(limits, [built.descriptor]);
      const checked = yield* registry.bind(built.pattern, row.flags);
      expect(checked.descriptor).toEqual(built.descriptor);
    }),
    { concurrency: 1, discard: true }
  );
  const empty = makeCitationReferenceNameMetadata({
    plaintiff: null,
    defendant: null,
    resolvedCaseNameShort: null,
    resolvedCaseName: null,
  });
  const absent = yield* builder.build(empty, "pin");
  expect(O.isNone(absent)).toBe(true);
  const maximum = A.reduce(R.values(template.patterns), 0, (n, p) => Num.max(n, p.bytes.length / p.width)) + 32;
  const small = yield* makeCitationReferencePatterns({ ...limits, patternUtf16: maximum }, configuration).pipe(
    Effect.provideService(CitationTextBudget, budget)
  );
  const unicode = yield* makeCitationPythonUnicode(limits);
  const long = yield* unicode.fromText(`A${Str.repeat(maximum - 2)("#")}`);
  const refused = yield* small
    .build(makeCitationReferenceNameMetadata({ ...empty, plaintiff: long.storage }), "pin")
    .pipe(Effect.flip);
  expect(refused).toMatchObject({ _tag: "CitationSafetyLimitExceeded", limit: "patternUtf16" });
});
