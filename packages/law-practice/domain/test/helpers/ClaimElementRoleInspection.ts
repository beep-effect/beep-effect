import {
  ClaimInputCollection,
  ClaimInputRecord,
  ClaimLexicalEvidence,
  ClaimLexicalToken,
  decomposePreparedClaimRoles,
  inspectClaimInput,
  inspectPreparedClaimRoles,
  prepareClaimInspection,
} from "@beep/law-practice-domain/values/ClaimElement";
import { TextAnchor } from "@beep/provenance/TextAnchor";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Str from "effect/String";

// Explicit injected lexical controls; not a runtime dictionary or trained data.
const lexical = HashMap.make(
  ["a", ["DET", "a"]],
  ["an", ["DET", "an"]],
  ["the", ["DET", "the"]],
  ["said", ["DET", "said"]],
  ["this", ["DET", "this"]],
  ["one", ["NUM", "one"]],
  ["two", ["NUM", "two"]],
  ["comprising", ["VERB", "comprise"]],
  ["is", ["AUX", "be"]],
  ["are", ["AUX", "be"]],
  ["mounted", ["VERB", "mount"]],
  ["formed", ["VERB", "form"]],
  ["coupled", ["VERB", "couple"]],
  ["of", ["ADP", "of"]],
  ["to", ["ADP", "to"]],
  ["on", ["ADP", "on"]],
  ["and", ["CCONJ", "and"]],
  ["or", ["CCONJ", "or"]],
  ["wherein", ["SCONJ", "wherein"]]
);

const tokensOf = (text: string): ReadonlyArray<ClaimLexicalToken> =>
  A.map(A.fromIterable(Str.matchAll(/[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*|[^\s\p{L}\p{N}]/gu)(text)), (match) => {
    const lower = Str.toLowerCase(match[0]);
    const [pos, lemma] = O.getOrElse(HashMap.get(lexical, lower), () => [
      O.isSome(Str.match(/^\p{N}+$/u)(lower)) ? "NUM" : O.isSome(Str.match(/^\p{L}/u)(lower)) ? "NOUN" : "PUNCT",
      lower,
    ]);
    const startChar = O.getOrThrow(O.fromUndefinedOr(match.index));
    return ClaimLexicalToken.make({
      anchor: TextAnchor.make({ startChar, endChar: startChar + match[0].length, quote: match[0] }),
      pos,
      lemma: O.some(lemma),
    });
  });

/** Aligned injected lexical evidence for each numbered claim text. */
const evidenceOf = (sourceKey: string, texts: ReadonlyArray<string>): ReadonlyArray<ClaimLexicalEvidence> =>
  A.map(texts, (text, index) =>
    ClaimLexicalEvidence.cases.aligned.make({
      sourceKey,
      sourceOrdinal: index + 1,
      qualifiedText: text,
      provider: "explicit-source-control",
      assetDigest: "test-only",
      tokens: tokensOf(text),
    })
  );

const sourceKey = "role-inspection-control";

/** Reuses the source-only lexical fixture paired with this helper's prepared inputs. */
export const roleEvidenceOf = (texts: ReadonlyArray<string>): ReadonlyArray<ClaimLexicalEvidence> =>
  evidenceOf(sourceKey, texts);
const inputOf = (texts: A.NonEmptyReadonlyArray<string>): ClaimInputCollection =>
  ClaimInputCollection.make({
    sourceKey,
    records: A.map(texts, (text, index) =>
      ClaimInputRecord.cases.text.make({
        sourceOrdinal: index + 1,
        numberText: O.some(`${index + 1}`),
        sourceText: text,
        canonicalText: text,
      })
    ),
  });

/**
 * Inspects numbered claim texts through the role-aware policy with injected,
 * deterministic lexical evidence (unknown words are nouns).
 */
export const inspectRoleTexts = Effect.fn("ClaimElementRoleInspection.inspect")(function* (
  texts: A.NonEmptyReadonlyArray<string>
) {
  const prepared = yield* prepareClaimInspection(inputOf(texts));
  return yield* inspectPreparedClaimRoles(prepared, evidenceOf(sourceKey, texts));
});

/** Compiles source-role plans for numbered claim texts with the same injected evidence. */
export const rolePlansOf = Effect.fn("ClaimElementRoleInspection.plans")(function* (
  texts: A.NonEmptyReadonlyArray<string>
) {
  const prepared = yield* prepareClaimInspection(inputOf(texts));
  return yield* decomposePreparedClaimRoles(prepared, evidenceOf(sourceKey, texts));
});

/** Inspects numbered claim texts without lexical evidence, through the inspection grammar only. */
export const inspectPlainTexts = (texts: A.NonEmptyReadonlyArray<string>) => inspectClaimInput(inputOf(texts));
