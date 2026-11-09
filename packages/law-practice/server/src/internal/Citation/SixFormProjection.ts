/** Verified original UTF-16 projection into existing semantic citation owners.
 * @internal @packageDocumentation @since 0.0.0
 */
import { EyeciteRawRange, EyeciteRecognizeOutput } from "@beep/eyecite";
import { $LawPracticeServerId } from "@beep/identity/packages";
import { Citation } from "@beep/law-practice-domain/values";
import { CourtReporterArtifact } from "@beep/law-practice-domain/values/CourtReporterVocabulary";
import { CitationInputError, CitationSafetyLimitExceeded } from "@beep/law-practice-use-cases/server";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import {
  VerifyTextAnchorAgainstVerifiedSourceInput,
  verifyTextAnchorAgainstVerifiedSource,
} from "@beep/provenance/VerifiedTextAnchor";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeCitationMention } from "./Mention.ts";
import { decodeCitationRegexPolicy, makeCitationRegexTiming } from "./RegexPolicy.ts";
import type { EyeciteRecognition } from "@beep/eyecite";
import type { CitationMention } from "@beep/law-practice-domain/values";
import type { CourtReporterArtifactVersion } from "@beep/law-practice-domain/values/CourtReporterVocabulary";
import type { VerifiedSourceText, VerifiedTextAnchor } from "@beep/provenance/VerifiedTextAnchor";
import type { Sha256Hex } from "@beep/schema";

const $I = $LawPracticeServerId.create("internal/Citation/SixFormProjection");
const invalid = () => CitationInputError.make({ operation: "extract" });
const decode = S.decodeUnknownEffect(Citation);
const outputType = S.toType(EyeciteRecognizeOutput);
const componentRange = (token: EyeciteRecognition, name: string) =>
  O.map(
    A.findFirst(token.components, (component) => component.name === name),
    (component) => component.range
  );
const read = (text: string, range: EyeciteRawRange) => Str.slice(range.start, range.end)(text);
const pinRange = (token: EyeciteRecognition) =>
  O.orElse(componentRange(token, "pincite"), () => componentRange(token, "subsection"));
const locator = (text: string, token: EyeciteRecognition) => ({
  pinCite: O.getOrNull(O.map(pinRange(token), (range) => read(text, range))),
  parenthetical: null,
});
const semantic = (text: string, token: EyeciteRecognition, vocabularyVersion: string) => {
  const metadata = locator(text, token);
  const dated = { ...metadata, year: token.type === "case" ? token.year : null, month: null, day: null };
  const publication = { vocabularyVersion, editions: [], selectedEdition: null };
  return Match.value(token).pipe(
    Match.when({ type: "case" }, (token) => ({
      type: "case",
      components: { volume: token.volume, reporter: token.reporter, page: token.page },
      publication,
      metadata: {
        ...dated,
        court: null,
        plaintiff: token.plaintiff,
        defendant: token.defendant,
        caseName: token.caseName,
        additionalText: null,
        antecedentGuess: null,
        shortCaseName: null,
      },
    })),
    Match.when({ type: "shortFormCase" }, (token) => ({
      type: "shortFormCase",
      components: { volume: token.volume, reporter: token.reporter },
      publication,
      metadata: { ...dated, court: null, antecedentGuess: null, plaintiff: null },
    })),
    Match.when({ type: "id" }, () => ({ type: "id", components: {}, metadata })),
    Match.when({ type: "supra" }, (token) => ({
      type: "supra",
      components: {},
      metadata: { ...metadata, antecedentGuess: token.partyName, volume: null },
    })),
    Match.whenOr({ type: "statute" }, { type: "regulation" }, (token) => ({
      type: "law",
      components: {
        title: `${token.title}`,
        reporter: token.type === "statute" ? "U.S.C." : "C.F.R.",
        section: token.section,
      },
      publication: { editions: [], selectedEdition: null },
      metadata: { ...dated, publisher: null },
    })),
    Match.exhaustive
  );
};
type NamedRange = { readonly name: string; readonly range: EyeciteRawRange };
const partyRange = Effect.fnUntraced(function* (
  text: string,
  token: Extract<EyeciteRecognition, { readonly type: "supra" }>,
  end: number
) {
  if (token.partyName === null) return [];
  const prefix = Str.slice(token.range.start, end)(text);
  const found = Str.indexOf(token.partyName)(prefix);
  if (O.isNone(found)) return yield* invalid();
  const at = found.value;
  if (O.isSome(Str.indexOf(token.partyName)(Str.slice(at + 1)(prefix)))) return yield* invalid();
  return [
    {
      name: "antecedent",
      range: EyeciteRawRange.make({
        start: token.range.start + at,
        end: token.range.start + at + Str.length(token.partyName),
      }),
    },
  ];
});
const supraRanges = Effect.fnUntraced(function* (
  text: string,
  token: Extract<EyeciteRecognition, { readonly type: "supra" }>
) {
  const local = read(text, token.range);
  const at = yield* Effect.fromOption(Str.search(local, /\bsupra\b/i), invalid);
  if (O.isSome(Str.search(Str.slice(at + 5)(local), /\bsupra\b/i))) return yield* invalid();
  const start = token.range.start + at;
  const party = yield* partyRange(text, token, start);
  return {
    primary: EyeciteRawRange.make({ start, end: token.range.end }),
    components: A.prepend(party, { name: "lexicalCore", range: EyeciteRawRange.make({ start, end: start + 5 }) }),
  };
});
const idRanges = Effect.fnUntraced(function* (
  text: string,
  token: Extract<EyeciteRecognition, { readonly type: "id" }>
) {
  const local = Str.toLowerCase(read(text, token.range));
  const length = Str.startsWith("id.")(local) ? 3 : Str.startsWith("ibid.")(local) ? 5 : 0;
  if (length === 0) return yield* invalid();
  return {
    primary: token.range,
    components: [
      {
        name: "lexicalCore",
        range: EyeciteRawRange.make({ start: token.range.start, end: token.range.start + length }),
      },
    ],
  };
});
const referenceRanges = (text: string, token: EyeciteRecognition) =>
  Match.value(token).pipe(
    Match.when({ type: "supra" }, (token) => supraRanges(text, token)),
    Match.when({ type: "id" }, (token) => idRanges(text, token)),
    Match.orElse((token) => Effect.succeed({ primary: token.range, components: A.empty<NamedRange>() }))
  );
const Input = S.Struct({ output: outputType }).pipe(
  $I.annoteSchema("Input", { description: "Decoded bounded raw observations without source-verification authority." })
);
interface CitationSixFormProjectionResult {
  readonly excludedAnchors: ReadonlyArray<VerifiedTextAnchor>;
  readonly mentions: ReadonlyArray<CitationMention>;
}
const advanceSupportedToken = (tokens: ReadonlyArray<EyeciteRecognition>, from: number, start: number) => {
  let index = from;
  while (index < A.length(tokens) && A.getUnsafe(tokens, index).range.end <= start) index++;
  return index;
};
interface CitationSixFormProjection {
  readonly project: (
    source: VerifiedSourceText,
    engineArtifact: Sha256Hex,
    raw: unknown
  ) => Effect.Effect<CitationSixFormProjectionResult, CitationInputError | CitationSafetyLimitExceeded>;
  readonly vocabularyVersion: CourtReporterArtifactVersion;
}
/** Capture the policy and canonical vocabulary identity. Each original range is
 * verified against the genuine source before the existing mention owner assigns
 * its identity. Pins and antecedents can lie outside the primary locator.
 * @internal @category constructors @since 0.0.0
 */
export const makeCitationSixFormProjection = Effect.fn("Citation.makeSixFormProjection")(function* (policy: unknown) {
  const limits = yield* decodeCitationRegexPolicy(policy, invalid);
  const timing = yield* makeCitationRegexTiming(limits, true);
  const digest = yield* Digest.Digest;
  const safety = (limit: CitationSafetyLimitExceeded["limit"]) =>
    CitationSafetyLimitExceeded.make({ operation: "extract", limit });
  const artifact = yield* Effect.fromResult(CourtReporterArtifact).pipe(Effect.mapError(invalid));
  const project = Effect.fn("Citation.projectSixForms")(
    function* (source: VerifiedSourceText, engineArtifact: Sha256Hex, raw: unknown) {
      const { output } = yield* S.decodeUnknownEffect(Input)({ output: raw }).pipe(Effect.mapError(invalid));
      if (A.length(output.tokens) + A.length(output.excludedRanges) > limits.candidates)
        return yield* timing.failSafety(safety("candidates"));
      if (A.length(output.tokens) > limits.mentions) return yield* timing.failSafety(safety("mentions"));
      const text = source.sourceText;
      let quotedUtf16 = 0;
      const bounded = (range: EyeciteRawRange) => range.start < range.end && range.end <= Str.length(text);
      const verify = Effect.fnUntraced(function* (range: EyeciteRawRange) {
        if (!bounded(range)) return yield* invalid();
        const length = range.end - range.start;
        if (quotedUtf16 + length > limits.producedTextUtf16)
          return yield* timing.failSafety(safety("producedTextUtf16"));
        quotedUtf16 += length;
        const anchor = TextAnchor.make({ startChar: range.start, endChar: range.end, quote: read(text, range) });
        return yield* verifyTextAnchorAgainstVerifiedSource(
          VerifyTextAnchorAgainstVerifiedSourceInput.make({ verifiedSource: source, anchor })
        ).pipe(Effect.mapError(invalid));
      });
      const projectOne = Effect.fnUntraced(function* (token: EyeciteRecognition) {
        const ranges = yield* referenceRanges(text, token);
        const components: Array<{ readonly name: string; readonly anchor: VerifiedTextAnchor }> = [];
        const rawComponents = A.map(token.components, (component) => ({
          name: component.name === "pincite" || component.name === "subsection" ? "pin" : component.name,
          range: component.range,
        }));
        for (const component of A.appendAll(rawComponents, ranges.components)) {
          components.push({ name: component.name, anchor: yield* verify(component.range) });
        }
        const citation = yield* decode(semantic(text, token, artifact.artifactVersion)).pipe(Effect.mapError(invalid));
        const anchor = yield* verify(ranges.primary);
        return yield* makeCitationMention({
          citation,
          engineArtifact,
          anchor,
          components,
          signal: O.none(),
          warnings: [],
          evidenceConfidence: O.none(),
          footnote: O.none(),
        }).pipe(Effect.mapError(invalid));
      });
      const mentions: Array<CitationMention> = [];
      let previousEnd = 0;
      for (const token of output.tokens) {
        yield* Effect.yieldNow;
        if (!bounded(token.range) || token.range.start < previousEnd) return yield* invalid();
        previousEnd = token.range.end;
        const mention = yield* projectOne(token);
        mentions.push(mention);
      }
      const projectExcluded = Effect.fnUntraced(function* () {
        const anchors: Array<VerifiedTextAnchor> = [];
        let previousEnd = 0;
        let supportedIndex = 0;
        for (const range of output.excludedRanges) {
          yield* Effect.yieldNow;
          if (range.start < previousEnd) return yield* invalid();
          previousEnd = range.end;
          supportedIndex = advanceSupportedToken(output.tokens, supportedIndex, range.start);
          if (O.exists(A.get(output.tokens, supportedIndex), (token) => token.range.start < range.end))
            return yield* invalid();
          const anchor = yield* verify(range);
          anchors.push(anchor);
        }
        return anchors;
      });
      const excludedAnchors = yield* projectExcluded();
      return { mentions, excludedAnchors };
    },
    Effect.provideService(Digest.Digest, digest),
    timing.timed
  );
  const service: CitationSixFormProjection = { project, vocabularyVersion: artifact.artifactVersion };
  return service;
});
