/** Source-native literal reference templates from eyecite 2.7.6 find.py/regexes.py.
 * BSD-2-Clause; Python escaping differs from JavaScript regex escaping.
 * @internal @packageDocumentation @since 0.0.0
 */
import { $LawPracticeServerId } from "@beep/identity/packages";
import { CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { LiteralKit } from "@beep/schema";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as HashSet from "effect/HashSet";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Tuple from "effect/Tuple";
import { copyCitationMetadataPatterns, fingerprintCitationMetadataPattern } from "./MetadataComposition.ts";
import { citationMetadataWhitespaceBoundary } from "./MetadataStrings.ts";
import { CitationPythonUnicodeStorage } from "./PythonHash.ts";
import {
  citationPythonPointAt,
  concatCitationPythonRanges,
  makeCitationPythonUnicode,
  measureCitationPythonSlice,
} from "./PythonUnicode.ts";
import { makeCitationReferenceNames } from "./ReferenceNames.ts";
import { CitationRegexPatternDescriptor, CitationRegexPatternProfile } from "./RegexDescriptors.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import { CitationTextBudget } from "./TextBudget.ts";
import type { CitationCaseMetadataFields } from "./CaseMetadata.ts";

const $I = $LawPracticeServerId.create("internal/Citation/ReferencePatterns");
const Patterns = S.Struct({
  pinPrefix: CitationPythonUnicodeStorage,
  pinSuffix: CitationPythonUnicodeStorage,
  markupPrefix: CitationPythonUnicodeStorage,
  markupSuffix: CitationPythonUnicodeStorage,
  rejection: CitationPythonUnicodeStorage,
}).pipe(
  $I.annoteSchema("Patterns", {
    description: "Observed original literal insertion boundaries and post-markup rejection pattern.",
  })
);
const fingerprints = {
  pinPrefix: "f05f37f87d02bbe45229894caa73b6317b0486a2d508146201b4f35c1c6c251d",
  pinSuffix: "8ee4892bf195dd713ba72730ac40c6bbdde503c99c9590517d29f0126cce70bd",
  markupPrefix: "f0f340e35268610c1309941971355a6c07439deac6727eef92c032e35a65e80b",
  markupSuffix: "bc1aedc5fed943172e81a9f95918b689282c42d87e0a4fc275fe0214be0c74d7",
  rejection: "a1998f568b2110925d35e901011d2232114e3a806df1b585d239e3fda2a1a540",
};
const Mode = LiteralKit(["pin", "markup", "rejection"]).pipe(
  $I.annoteSchema("Mode", { description: "Closed original reference-pattern families." })
);
const Reason = LiteralKit(["invalid-policy", "invalid-configuration"]).pipe(
  $I.annoteSchema("Reason", { description: "Closed literal reference-pattern preparation failures." })
);
/** @internal @category errors @since 0.0.0 */
export class CitationReferencePatternFailure extends S.TaggedError<
  CitationReferencePatternFailure,
  { readonly brand: unique symbol }
>($I`CitationReferencePatternFailure`)(
  "CitationReferencePatternFailure",
  { reason: Reason },
  $I.annoteError<CitationReferencePatternFailure>("CitationReferencePatternFailure", {
    description: "Reference template preparation failed without names, patterns or nested causes.",
  })
) {}
/** @internal @category models @since 0.0.0 */
export class CitationReferencePatternConfiguration extends S.Opaque<
  CitationReferencePatternConfiguration,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    patterns: Patterns,
    disallowedNames: S.Array(S.String.check(S.isBetweenLength(1, 64))).check(S.isBetweenLength(93, 93)),
  }).pipe(
    $I.annoteSchema("CitationReferencePatternConfiguration", {
      description: "Source-authenticated templates and original name exclusions; trusted installation data only.",
    })
  )
) {}
/** Prepared original pattern and independently derived template profile; execution still uses the owned worker.
 * @internal @category models @since 0.0.0
 */
export class CitationReferencePattern extends S.Opaque<CitationReferencePattern, { readonly brand: unique symbol }>()(
  S.Struct({ mode: Mode, pattern: CitationPythonUnicodeStorage, descriptor: CitationRegexPatternDescriptor }).pipe(
    $I.annoteSchema("CitationReferencePattern", {
      description: "Native literal template expansion with exact source identity and capture layout.",
    })
  )
) {}
const Configuration = S.toType(CitationReferencePatternConfiguration);
const fail = (reason: typeof Reason.Type) => CitationReferencePatternFailure.make({ reason });
const safety = () => CitationSafetyLimitExceeded.make({ operation: "extract", limit: "patternUtf16" });
// Exhaustive CPython 3.11.15 re.escape single-point capture, not JavaScript escaping.
const escapes = HashSet.fromIterable([
  9, 10, 11, 12, 13, 32, 35, 36, 38, 40, 41, 42, 43, 45, 46, 63, 91, 92, 93, 94, 123, 124, 125, 126,
]);
type Range = { readonly source: CitationPythonUnicodeStorage; readonly start: number; readonly end: number };
const range = (source: CitationPythonUnicodeStorage, start = 0, end = source.bytes.length / source.width): Range => ({
  source,
  start,
  end,
});
const words = Effect.fn("Citation.referenceMarkupWords")(function* (value: CitationPythonUnicodeStorage) {
  const output = A.empty<Range>();
  let start = 0;
  const length = value.bytes.length / value.width;
  for (let index = 0; index <= length; index++) {
    if (index % 256 === 0) yield* Effect.yieldNow;
    if (index !== length && !citationMetadataWhitespaceBoundary(citationPythonPointAt(value, index))) continue;
    if (start < index) output.push(range(value, start, index));
    start = index + 1;
  }
  return output;
});
/** Literal-only expansion retains Python point identity, including surrogate words.
 * Shared Unicode assembly preflights output before allocating. The enclosing
 * extraction owner supplies the text authority; methods require R=never.
 * @internal @category operations @since 0.0.0
 */
export const makeCitationReferencePatterns = Effect.fn("Citation.makeReferencePatterns")(function* (
  policy: unknown,
  configurationInput: unknown
) {
  const limits = yield* decodeCitationRegexPolicy(policy, () => fail("invalid-policy"));
  const config = yield* S.decodeUnknownEffect(Configuration)(configurationInput).pipe(
    Effect.mapError(() => fail("invalid-configuration"))
  );
  const budget = yield* CitationTextBudget;
  if (budget.maximum > limits.producedTextUtf16) return yield* fail("invalid-policy");
  const copiedPatterns = yield* copyCitationMetadataPatterns(limits, config.patterns, fingerprints, () =>
    fail("invalid-configuration")
  );
  const patterns = yield* S.decodeUnknownEffect(Patterns)(copiedPatterns).pipe(
    Effect.mapError(() => fail("invalid-configuration"))
  );
  const digest = yield* Digest.Digest;
  const names = yield* makeCitationReferenceNames(limits, config.disallowedNames);
  const unicode = yield* makeCitationPythonUnicode(limits);
  const timing = yield* makeCitationRegexTiming(limits, true);
  const ascii = Effect.fnUntraced(function* (text: string) {
    return (yield* unicode.fromTextReserved(text, budget.reserve)).storage;
  });
  const slash = yield* ascii("\\");
  const close = yield* ascii(")");
  const bar = yield* ascii("|");
  const whitespace = yield* ascii("\\s+");
  const assemble = Effect.fnUntraced(function* (parts: ReadonlyArray<Range>) {
    return yield* concatCitationPythonRanges(parts, (layout) => {
      if (layout.utf16Units > limits.patternUtf16) return Effect.fail(safety());
      return budget.reserve(layout.utf16Units);
    });
  });
  const escaped = Effect.fnUntraced(function* (source: Range) {
    const measured = yield* measureCitationPythonSlice(source.source, source.start, source.end);
    if (measured.utf16Units > limits.patternUtf16) return yield* safety();
    const parts = A.empty<Range>();
    let cursor = source.start;
    for (let index = source.start; index < source.end; index++) {
      if (index % 256 === 0) yield* Effect.yieldNow;
      if (!HashSet.has(escapes, citationPythonPointAt(source.source, index))) continue;
      if (cursor < index) parts.push(range(source.source, cursor, index));
      parts.push(range(slash));
      cursor = index;
    }
    parts.push(range(source.source, cursor, source.end));
    return yield* assemble(parts);
  });
  const literal = Effect.fnUntraced(function* (value: CitationPythonUnicodeStorage, markup: boolean) {
    const sections = markup ? yield* words(value) : [range(value)];
    const parts = A.empty<Range>();
    for (const [index, section] of A.map(sections, (section, index) => Tuple.make(index, section))) {
      if (index > 0) parts.push(range(whitespace));
      const escapedSection = yield* escaped(section);
      parts.push(range(escapedSection));
    }
    return {
      value: yield* assemble(parts),
      minimum: A.reduce(sections, 0, (n, section) => n + section.end - section.start) + Num.max(0, sections.length - 1),
    };
  });
  const build = Effect.fn("Citation.buildLiteralReferencePattern")(
    function* (metadata: CitationCaseMetadataFields, mode: "pin" | "markup") {
      const selected = yield* names.collect(metadata);
      if (selected.length === 0) return O.none<CitationReferencePattern>();
      const markup = mode === "markup";
      const alternatives = yield* Effect.forEach(
        selected,
        Effect.fnUntraced(function* (name) {
          const open = yield* ascii(`(?P<${name.field}>`);
          const escapedName = yield* literal(name.value, markup);
          return {
            field: name.field,
            minimum: escapedName.minimum,
            parts: [range(open), range(escapedName.value), range(close)],
          };
        }),
        { concurrency: 1 }
      );
      const minimum = A.reduce(alternatives, limits.patternUtf16, (n, item) => Num.min(n, item.minimum));
      const captureNames = R.fromEntries(
        A.map(alternatives, (item, index) => Tuple.make(item.field, index + (markup ? 2 : 1)))
      );
      const captures = markup ? captureNames : R.set(captureNames, "pin_cite", selected.length + 1);
      const parts = [
        range(markup ? patterns.markupPrefix : patterns.pinPrefix),
        ...A.flatten(
          A.intersperse(
            A.map(alternatives, (item) => item.parts),
            [range(bar)]
          )
        ),
        range(markup ? patterns.markupSuffix : patterns.pinSuffix),
      ];
      const pattern = yield* assemble(parts);
      const patternSha256 = yield* fingerprintCitationMetadataPattern(pattern, () => fail("invalid-configuration"));
      const descriptor = CitationRegexPatternDescriptor.make({
        patternSha256,
        flags: markup ? 0 : 64,
        profile: CitationRegexPatternProfile.make({
          groups: selected.length + 1,
          names: captures,
          minimumWidthFloor: minimum + (markup ? 7 : 2),
          repeatedCaptures: false,
          nullableMultiRepeat: false,
        }),
      });
      return O.some(CitationReferencePattern.make({ mode, pattern, descriptor }));
    },
    Effect.provideService(Digest.Digest, digest),
    timing.timed
  );
  const rejection = CitationReferencePattern.make({
    mode: "rejection",
    pattern: patterns.rejection,
    descriptor: CitationRegexPatternDescriptor.make({
      patternSha256: yield* fingerprintCitationMetadataPattern(patterns.rejection, () => fail("invalid-configuration")),
      flags: 0,
      profile: CitationRegexPatternProfile.make({
        groups: 1,
        names: {},
        minimumWidthFloor: 3,
        repeatedCaptures: false,
        nullableMultiRepeat: false,
      }),
    }),
  });
  return { build, rejection };
});
