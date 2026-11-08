/**
 * Bounded source-aligned clause/nominal role compiler.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { TextAnchor } from "@beep/provenance/TextAnchor";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as Graph from "effect/Graph";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { rawClaimTransitionScope } from "../PatentDocument/PatentDocument.transition.ts";
import {
  ClaimArgumentCoverage,
  ClaimClauseRolePlan,
  ClaimClauseSpan,
  ClaimFiniteSourceProof,
  ClaimHeadTerminalEvidence,
  ClaimNominalCandidateState,
  ClaimNominalSpan,
  ClaimOpaqueSelection,
  ClaimOperatorHeadWitness,
  ClaimOriginalQualifiedScopes,
  ClaimPredicateSpan,
  ClaimPrivateBasisCandidate,
  ClaimSourceProof,
  ClaimSourceProofOrdinal,
  ClaimSourceProofRef,
  ClaimSourceProofSlot,
  OriginalLexicalTokenOrdinal,
} from "./ClaimClauseRole.model.ts";
import {
  ClaimIntrinsicNounWitness,
  ClaimLexicalEvidence,
  ClaimLexicalSourceIdentity,
} from "./ClaimLexicalEvidence.model.ts";
import type { PatentClaim } from "../PatentDocument/PatentDocument.model.ts";
import type { ClaimCitationWitness, ClaimNominalPolicyRole } from "./ClaimClauseRole.model.ts";
import type { ClaimTermDeterminer } from "./ClaimElement.model.ts";
import type { ClaimLexicalToken } from "./ClaimLexicalEvidence.model.ts";

/**
 * Closed existing dependency introducers shared by construction and validation.
 *
 * **Example** (Find a complete source citation introducer)
 *
 * ```ts
 * import { claimCitationIntroducers } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as A from "effect/Array"
 *
 * console.log(A.some(claimCitationIntroducers, (words) => A.join(words, " ") === "according to")) // true
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const claimCitationIntroducers: ReadonlyArray<ReadonlyArray<string>> = [
  ["as", "set", "forth", "in"],
  ["as", "recited", "in"],
  ["as", "claimed", "in"],
  ["in", "accordance", "with"],
  ["according", "to"],
  ["of"],
];
const knownTags = HashSet.make(
  "ADJ",
  "ADP",
  "ADV",
  "AUX",
  "CCONJ",
  "DET",
  "INTJ",
  "NOUN",
  "NUM",
  "PART",
  "PRON",
  "PROPN",
  "PUNCT",
  "SCONJ",
  "SYM",
  "VERB"
);
const nominalTags = HashSet.make("NOUN", "PROPN", "PRON");
const modifierTags = HashSet.make("ADJ", "NUM");
const auxiliaries = HashSet.make(
  "is",
  "are",
  "was",
  "were",
  "be",
  "been",
  "being",
  "can",
  "may",
  "must",
  "shall",
  "will",
  "would",
  "should",
  "could",
  "has",
  "have",
  "had"
);
const clauseWords = HashSet.make("that", "which", "wherein", "whereby", "when", "whether", "if", "while", "because");
const articleWords = HashSet.make("a", "an", "the", "said", "its", "their", "this", "these", "those", "such", "each");
const connectors = HashSet.make("and", "or", "and/or");
const cardinalWords = HashSet.make("two", "three", "four", "five", "six", "seven", "eight", "nine", "ten");
const cardinalAt = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean =>
  tagAt(tokens, index) === "NUM" &&
  (HashSet.has(cardinalWords, wordAt(tokens, index)) ||
    O.isSome(Str.match(/^(?:[2-9]\d*|1\d+)$/u)(wordAt(tokens, index))));
const stopWords = HashSet.make(
  "of",
  "in",
  "on",
  "at",
  "with",
  "from",
  "to",
  "for",
  "by",
  "into",
  "onto",
  "than",
  "through",
  "between",
  "as",
  "per",
  "via"
);
const punctuation = HashSet.make(",", ";", ":", ".", "(", ")", "[", "]");
const word = (token: ClaimLexicalToken): string => Str.toLowerCase(token.anchor.quote);
const at = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): O.Option<ClaimLexicalToken> =>
  A.get(tokens, index);
const wordAt = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): string =>
  O.match(at(tokens, index), { onNone: () => "", onSome: word });
const tagAt = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): string =>
  O.match(at(tokens, index), { onNone: () => "", onSome: (token) => token.pos });
const anchor = (text: string, startChar: number, endChar: number): TextAnchor =>
  TextAnchor.make({ startChar, endChar, quote: Str.slice(startChar, endChar)(text) });
const normalized = (text: string): string => Str.trim(Str.replace(/\s+/gu, " ")(Str.toLowerCase(text)));
/**
 * Validate exact monotonic UTF-16 source coverage, without repairing provider output.
 *
 * @category validation
 * @since 0.0.0
 */
const validTokenSpan = (text: string, token: ClaimLexicalToken, end: number): boolean => {
  const span = token.anchor;
  return (
    HashSet.has(knownTags, token.pos) &&
    span.startChar >= end &&
    span.endChar > span.startChar &&
    span.endChar <= text.length &&
    Str.slice(span.startChar, span.endChar)(text) === span.quote &&
    Str.trim(Str.slice(end, span.startChar)(text)) === ""
  );
};
const validTokens = (text: string, tokens: ReadonlyArray<ClaimLexicalToken>): boolean => {
  let end = 0;
  if (tokens.length === 0) return false;
  for (const token of tokens) {
    if (!validTokenSpan(text, token, end)) return false;
    end = token.anchor.endChar;
  }
  return Str.trim(Str.slice(end)(text)) === "";
};
const regularPlural = (token: ClaimLexicalToken): boolean =>
  token.pos === "NOUN" &&
  O.exists(token.lemma, (lemma) => {
    const head = word(token);
    const base = Str.toLowerCase(lemma);
    return (
      base !== head &&
      (head === `${base}s` ||
        head === `${base}es` ||
        (Str.endsWith("y")(base) && head === `${Str.slice(0, -1)(base)}ies`))
    );
  });
const quoteRanges = (text: string) =>
  A.fromIterable(Str.matchAll(/"(?:\\.|[^"\\])*"|“[^”]*”|‘(?:[^’]|’(?=[\p{L}\p{N}]))*’/gu)(text));
const protectedTokens = (
  ranges: ReturnType<typeof quoteRanges>,
  tokens: ReadonlyArray<ClaimLexicalToken>
): ReadonlyArray<boolean> =>
  A.map(tokens, (token) =>
    A.some(
      ranges,
      (match) =>
        match.index !== undefined &&
        token.anchor.startChar >= match.index &&
        token.anchor.startChar < match.index + match[0].length
    )
  );
const surface = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number, phrase: string): boolean =>
  A.every(Str.split(phrase, " "), (part, offset) => wordAt(tokens, index + offset) === part);
const quantityDeterminer = (
  tokens: ReadonlyArray<ClaimLexicalToken>,
  index: number
): O.Option<readonly [ClaimTermDeterminer, number, number]> => {
  if (surface(tokens, index, "a plurality of")) return O.some(["plurality-of", 3, 3]);
  if (surface(tokens, index, "at least one") || surface(tokens, index, "one or more"))
    return O.some(["at-least-one", 3, 3]);
  return O.none();
};
const demonstrativeThat = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean =>
  wordAt(tokens, index) === "that" &&
  tagAt(tokens, index) === "DET" &&
  HashSet.has(HashSet.make("VERB", "ADP"), tagAt(tokens, index - 1)) &&
  HashSet.has(nominalTags, tagAt(tokens, index + 1));
const plainArticle = (word: string): O.Option<ClaimTermDeterminer> => {
  if (word === "a") return O.some("a");
  if (word === "an") return O.some("an");
  if (word === "the") return O.some("the");
  return word === "said" ? O.some("said") : O.none();
};
const articleDeterminer = (
  tokens: ReadonlyArray<ClaimLexicalToken>,
  index: number
): readonly [ClaimTermDeterminer, number, number] => {
  if (surface(tokens, index, "the said")) return ["the", 2, 2];
  const article = plainArticle(wordAt(tokens, index));
  const width = surface(tokens, index + 1, "one or more") ? 4 : 1;
  if (O.isSome(article)) return [article.value, width, width];
  if (tagAt(tokens, index) === "NUM") return ["bare", 0, 0];
  const prefix = HashSet.has(articleWords, wordAt(tokens, index)) || demonstrativeThat(tokens, index) ? 1 : 0;
  return ["bare", prefix, prefix];
};
const determiner = (
  tokens: ReadonlyArray<ClaimLexicalToken>,
  index: number
): readonly [ClaimTermDeterminer, number, number] =>
  O.getOrElse(quantityDeterminer(tokens, index), () => articleDeterminer(tokens, index));
const beforeAdjuncts = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): number => {
  let before = index - 1;
  while (tagAt(tokens, before) === "ADV" || HashSet.has(HashSet.make("not", "n't"), wordAt(tokens, before))) before--;
  return before;
};
const relativeSubjectAt = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean => {
  const before = beforeAdjuncts(tokens, index);
  return (
    HashSet.has(HashSet.make("that", "which"), wordAt(tokens, before)) &&
    HashSet.has(nominalTags, tagAt(tokens, before - 1))
  );
};
const singularLexicalSubject = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean =>
  O.exists(
    at(tokens, beforeAdjuncts(tokens, index)),
    (token) =>
      token.pos === "NOUN" &&
      O.exists(token.lemma, (lemma) => normalized(lemma) === word(token)) &&
      !Str.endsWith("s")(word(token))
  );
const inflectedNounPredicate = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean => {
  if (!at(tokens, index).pipe(O.getOrThrow, regularPlural)) return false;
  if (singularLexicalSubject(tokens, index) && HashSet.has(articleWords, wordAt(tokens, index + 1))) return true;
  return (
    relativeSubjectAt(tokens, index) &&
    (HashSet.has(nominalTags, tagAt(tokens, index + 1)) ||
      HashSet.has(articleWords, wordAt(tokens, index + 1)) ||
      (tagAt(tokens, index + 1) === "ADP" && HashSet.has(articleWords, wordAt(tokens, index + 2))))
  );
};
const hasInfinitiveComplement = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean =>
  wordAt(tokens, index + 1) === "to" && tagAt(tokens, index + 1) === "PART" && tagAt(tokens, index + 2) === "VERB";
const auxiliaryBefore = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean => {
  let cursor = index - 1;
  // Each adverb/negation chain is visited only by its following grammatical
  // head; the compiler's initial per-token reservation covers these walks.
  while (tagAt(tokens, cursor) === "ADV" || HashSet.has(HashSet.make("not", "n't"), wordAt(tokens, cursor))) cursor--;
  return HashSet.has(auxiliaries, wordAt(tokens, cursor)) || tagAt(tokens, cursor) === "AUX";
};
const namingPredicate = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean =>
  HashSet.has(HashSet.make("named", "called", "designated"), wordAt(tokens, index)) &&
  (tagAt(tokens, index + 1) === "PROPN" || HashSet.has(HashSet.make('"', "“", "‘"), wordAt(tokens, index + 1)));
const adjectivePredicate = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean => {
  if (HashSet.has(HashSet.make("NOUN", "PROPN", "ADJ", "NUM"), tagAt(tokens, index + 1))) return false;
  return (
    auxiliaryBefore(tokens, index) ||
    (hasInfinitiveComplement(tokens, index) && HashSet.has(nominalTags, tagAt(tokens, index - 1)))
  );
};
const infinitiveBefore = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean => {
  const toIndex = tagAt(tokens, index - 1) === "ADV" ? index - 2 : index - 1;
  return wordAt(tokens, toIndex) === "to" && tagAt(tokens, toIndex) === "PART";
};
const adjectiveNominalBefore = (tokens: ReadonlyArray<ClaimLexicalToken>, before: number): boolean => {
  if (tagAt(tokens, before) !== "ADJ") return false;
  let cursor = before;
  while (tagAt(tokens, cursor) === "ADJ") cursor--;
  const participle = at(tokens, cursor);
  if (
    O.exists(
      participle,
      (t) =>
        t.pos === "VERB" &&
        O.exists(t.lemma, (lemma) => word(t) === `${normalized(lemma)}ed` || word(t) === `${normalized(lemma)}d`)
    )
  )
    cursor--;
  return HashSet.has(articleWords, wordAt(tokens, cursor));
};
const finitePosition = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean => {
  const before = beforeAdjuncts(tokens, index);
  if (HashSet.has(HashSet.make("that", "which"), wordAt(tokens, before))) return true;
  if (HashSet.has(nominalTags, tagAt(tokens, before))) return true;
  if (adjectiveNominalBefore(tokens, before)) return true;
  return (
    surface(tokens, index - 1, ")") &&
    wordAt(tokens, index - 3) === "(" &&
    HashSet.has(nominalTags, tagAt(tokens, index - 4))
  );
};
const coordinatedSubject = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean =>
  wordAt(tokens, index - 2) === "and" &&
  HashSet.has(nominalTags, tagAt(tokens, index - 3)) &&
  HashSet.has(articleWords, wordAt(tokens, index - 4));
const finiteInflection = (token: ClaimLexicalToken): boolean =>
  O.exists(token.lemma, (lemma) => word(token) === `${normalized(lemma)}s` || word(token) === `${normalized(lemma)}es`);
const finiteFrameProof = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean => {
  if (HashSet.has(articleWords, wordAt(tokens, index + 1))) return true;
  if (relativeSubjectAt(tokens, index) || coordinatedSubject(tokens, index)) return true;
  if (
    O.exists(at(tokens, index - 1), regularPlural) &&
    lexicalObjectAfter(tokens, index) &&
    O.exists(at(tokens, index), (token) => O.exists(token.lemma, (lemma) => normalized(lemma) === word(token)))
  )
    return true;
  return singularLexicalSubject(tokens, index) && O.exists(at(tokens, index), finiteInflection);
};
const gerundPosition = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean => {
  const before = tagAt(tokens, index - 1) === "ADV" ? index - 2 : index - 1;
  return HashSet.has(HashSet.make("for", "by"), wordAt(tokens, before));
};
const predicateWhen = (
  kind: typeof ClaimPredicateSpan.Type.kind,
  proof: boolean
): O.Option<typeof ClaimPredicateSpan.Type.kind> => (proof ? O.some(kind) : O.none());
const verbalPredicate = (
  tokens: ReadonlyArray<ClaimLexicalToken>,
  index: number
): O.Option<typeof ClaimPredicateSpan.Type.kind> => {
  const token = O.getOrThrow(at(tokens, index));
  if (auxiliaryBefore(tokens, index)) return O.some("auxiliary");
  if (infinitiveBefore(tokens, index))
    return predicateWhen(
      "infinitive",
      O.exists(token.lemma, (lemma) => normalized(lemma) === word(token))
    );
  if (gerundPosition(tokens, index)) return predicateWhen("gerund", lexicalObjectAfter(tokens, index));
  if (finitePosition(tokens, index))
    return predicateWhen("finite", finiteFrameProof(tokens, index) && unambiguousFiniteForm(tokens, index));
  return predicateWhen(
    "gerund",
    HashSet.has(punctuation, wordAt(tokens, index - 1)) && HashSet.has(articleWords, wordAt(tokens, index + 1))
  );
};
const lexicalObjectAfter = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean =>
  HashSet.has(articleWords, wordAt(tokens, index + 1)) || O.exists(at(tokens, index + 1), regularPlural);
const unambiguousFiniteForm = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean => {
  const spelling = wordAt(tokens, index);
  const participial = Str.endsWith("ing")(spelling) || Str.endsWith("ed")(spelling);
  return !participial || HashSet.has(articleWords, wordAt(tokens, index + 1));
};
const coordinatedAuxiliary = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean => {
  if (!HashSet.has(connectors, wordAt(tokens, index - 1))) return false;
  let cursor = index + 1;
  while (tagAt(tokens, cursor) === "ADV" || HashSet.has(HashSet.make("not", "n't"), wordAt(tokens, cursor))) cursor++;
  return HashSet.has(HashSet.make("VERB", "AUX"), tagAt(tokens, cursor));
};
const auxiliaryPosition = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean =>
  finitePosition(tokens, index) ||
  auxiliaryBefore(tokens, index) ||
  infinitiveBefore(tokens, index) ||
  coordinatedAuxiliary(tokens, index);
const lexicalPredicateKinds = HashMap.make(
  [
    "AUX",
    (tokens: ReadonlyArray<ClaimLexicalToken>, index: number) =>
      predicateWhen("auxiliary-head", auxiliaryPosition(tokens, index)),
  ],
  [
    "ADJ",
    (tokens: ReadonlyArray<ClaimLexicalToken>, index: number) =>
      predicateWhen("adjectival", adjectivePredicate(tokens, index)),
  ],
  [
    "NOUN",
    (tokens: ReadonlyArray<ClaimLexicalToken>, index: number) =>
      predicateWhen("finite", inflectedNounPredicate(tokens, index)),
  ],
  ["VERB", verbalPredicate]
);
const licensedGovernor = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean =>
  HashSet.has(HashSet.make("configured", "adapted", "operable", "arranged"), wordAt(tokens, index)) &&
  hasInfinitiveComplement(tokens, index);
const predicateKind = (
  tokens: ReadonlyArray<ClaimLexicalToken>,
  index: number
): O.Option<typeof ClaimPredicateSpan.Type.kind> => {
  if (namingPredicate(tokens, index)) return O.some("adjectival");
  if (licensedGovernor(tokens, index)) return O.some("auxiliary");
  if (
    HashSet.has(HashSet.make("configured", "adapted", "operable", "arranged"), wordAt(tokens, index)) &&
    wordAt(tokens, index + 1) === "to"
  )
    return O.some("auxiliary-head");
  return O.flatMap(HashMap.get(lexicalPredicateKinds, tagAt(tokens, index)), (rule) => rule(tokens, index));
};
const isExplicitName = (tokens: ReadonlyArray<ClaimLexicalToken>, start: number, end: number): boolean =>
  HashSet.has(HashSet.make("named", "called", "designated"), wordAt(tokens, start - 1)) ||
  (HashSet.has(HashSet.make('"', "“", "‘"), wordAt(tokens, start)) &&
    HashSet.has(HashSet.make('"', "”", "’"), wordAt(tokens, end - 1)));
const isObjectSlot = (
  tokens: ReadonlyArray<ClaimLexicalToken>,
  start: number,
  predicates: HashSet.HashSet<number>
): boolean =>
  HashSet.has(predicates, start - 1) ||
  HashSet.has(
    HashSet.make("comprising", "comprises", "including", "includes", "containing", "contains", "has", "have"),
    wordAt(tokens, start - 1)
  );
const singularAgreement = (token: ClaimLexicalToken): boolean =>
  (token.pos === "AUX" && HashSet.has(HashSet.make("is", "was", "has"), word(token))) ||
  (HashSet.has(HashSet.make("VERB", "AUX"), token.pos) && finiteInflection(token));
const objectRole = (tokens: ReadonlyArray<ClaimLexicalToken>, start: number, end: number): ClaimNominalPolicyRole => {
  if (
    HashSet.has(
      HashSet.make("first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"),
      wordAt(tokens, start)
    )
  )
    return "unknown";
  if (tagAt(tokens, start) === "NUM")
    return cardinalAt(tokens, start) && O.exists(at(tokens, end - 1), regularPlural)
      ? "quantified-introduction"
      : "unknown";
  return O.exists(at(tokens, end - 1), regularPlural) ? "generic-plural" : "unknown";
};
const nominalRole = (
  claim: PatentClaim,
  tokens: ReadonlyArray<ClaimLexicalToken>,
  start: number,
  headStart: number,
  end: number,
  kind: ClaimTermDeterminer,
  predicates: HashSet.HashSet<number>
): ClaimNominalPolicyRole => {
  if (HashSet.has(HashSet.make("this", "these", "those", "such", "that"), wordAt(tokens, start)))
    return "demonstrative-reference";
  if (kind !== "bare") return "unknown";
  // Possessive/distributive determiner slots are not articleless generic NPs.
  // Demonstratives were retained as references above, never introductions.
  if (HashSet.has(articleWords, wordAt(tokens, start))) return "unknown";
  if (start === 0 && claim.claimType === "independent") return "preamble-introduction";
  if (isExplicitName(tokens, start, end)) return "explicit-name";
  return isObjectSlot(tokens, start, predicates) ? objectRole(tokens, headStart, end) : "unknown";
};

const rawFinitePredicate = (
  tokens: ReadonlyArray<ClaimLexicalToken>,
  index: number,
  token: ClaimLexicalToken
): boolean =>
  token.pos === "VERB" &&
  (finiteInflection(token) ||
    (finitePosition(tokens, index) && finiteFrameProof(tokens, index) && unambiguousFiniteForm(tokens, index)));
const rawReducedPredicate = (
  tokens: ReadonlyArray<ClaimLexicalToken>,
  index: number,
  token: ClaimLexicalToken
): boolean =>
  (token.pos === "ADJ" || rawRegularParticiple(token)) &&
  (tagAt(tokens, index + 1) === "ADP" || hasInfinitiveComplement(tokens, index));
const rawFunctionalBoundary = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean =>
  O.exists(at(tokens, index), (token) => {
    const finite = rawFinitePredicate(tokens, index, token);
    const reduced = rawReducedPredicate(tokens, index, token);
    return (
      token.pos === "AUX" ||
      HashSet.has(auxiliaries, word(token)) ||
      finite ||
      inflectedNounPredicate(tokens, index) ||
      reduced
    );
  });
const rawRegularParticiple = (token: ClaimLexicalToken): boolean =>
  token.pos === "VERB" &&
  O.exists(token.lemma, (lemma) => word(token) === `${normalized(lemma)}ed` || word(token) === `${normalized(lemma)}d`);
const intrinsicInputNoun = (token: ClaimLexicalToken): boolean =>
  token.pos === "ADJ" &&
  token.intrinsicNoun.status === "known" &&
  token.intrinsicNoun.baseNoun &&
  !token.intrinsicNoun.oov &&
  token.intrinsicNoun.rawForm === token.anchor.quote &&
  sourceAnchorEqual(token.intrinsicNoun.anchor, token.anchor);
const finiteProofReferences = (proof: ClaimFiniteSourceProof): ReadonlyArray<ClaimSourceProofRef> =>
  ClaimFiniteSourceProof.match(proof, {
    token: () => [],
    scope: () => [],
    "intrinsic-noun": () => [],
    boundary: (p) => [p.token, p.scope, ...O.toArray(p.successor)],
    "citation-boundary": (p) => [p.token, p.scope, p.witness.keyword, ...p.witness.tokens],
    "verbal-boundary": (p) => [p.token, p.governor, p.scope],
    opening: (p) => [p.scope, ...p.evidence],
    closure: (p) => [p.scope, ...O.toArray(p.boundary)],
    head: (p) =>
      p.terminalEvidence.kind === "lexical-terminal"
        ? [p.terminal, p.opening, p.closure, ...p.tokens]
        : [
            p.terminal,
            p.opening,
            p.closure,
            ...p.tokens,
            p.terminalEvidence.intrinsicNoun,
            p.terminalEvidence.rawAuxiliary,
            ...p.terminalEvidence.nonfiniteModifiers,
            ...p.terminalEvidence.orderedModifiers,
          ],
    operator: (p) => [p.head.token, ...p.lexical, ...O.toArray(p.subject), ...O.toArray(p.position)],
    "ordered-arguments": (p) => [
      p.operator,
      p.adposition,
      p.pp,
      p.ppEnd,
      p.renewal,
      p.direct,
      p.directEnd,
      ...A.flatMap(p.coverage, (c) => (c.kind === "token" ? [c.proof] : [])),
    ],
    description: (p) => [p.operator, p.introducer, p.candidate],
    selection: (p) => [p.operator, p.linkage, ...O.toArray(p.owner), ...p.selector, ...p.branches],
    "opaque-core": (p) => [p.selection],
    attachment: (p) => [p.operator, ...p.arguments, ...O.toArray(p.inherited)],
  });
const finiteProofReferenceCount = (proof: ClaimFiniteSourceProof): number =>
  ClaimFiniteSourceProof.match(proof, {
    token: () => 0,
    scope: () => 0,
    "intrinsic-noun": () => 0,
    "citation-boundary": (p) => p.witness.tokens.length + 3,
    "verbal-boundary": () => 3,
    boundary: () => 3,
    opening: (p) => p.evidence.length + 1,
    closure: () => 2,
    head: (p) =>
      p.tokens.length +
      3 +
      (p.terminalEvidence.kind === "lexical-terminal"
        ? 0
        : p.terminalEvidence.nonfiniteModifiers.length + p.terminalEvidence.orderedModifiers.length + 2),
    operator: (p) => p.lexical.length + 3,
    "ordered-arguments": (p) => p.coverage.length + 8,
    description: () => 3,
    selection: (p) => p.selector.length + p.branches.length + 3,
    "opaque-core": () => 1,
    attachment: (p) => p.arguments.length + 2,
  });
const finiteProofSlot = (proof: ClaimFiniteSourceProof): ClaimSourceProofRef["slot"] =>
  ClaimFiniteSourceProof.match(proof, {
    token: () => ClaimSourceProofSlot.Enum.token,
    "intrinsic-noun": () => ClaimSourceProofSlot.Enum["intrinsic-noun"],
    scope: () => ClaimSourceProofSlot.Enum.scope,
    boundary: () => ClaimSourceProofSlot.Enum.boundary,
    opening: () => ClaimSourceProofSlot.Enum.opening,
    "citation-boundary": () => ClaimSourceProofSlot.Enum.boundary,
    "verbal-boundary": () => ClaimSourceProofSlot.Enum.boundary,
    closure: () => ClaimSourceProofSlot.Enum.closure,
    head: () => ClaimSourceProofSlot.Enum.core,
    operator: () => ClaimSourceProofSlot.Enum.operator,
    "ordered-arguments": () => ClaimSourceProofSlot.Enum.argument,
    description: () => ClaimSourceProofSlot.Enum.argument,
    selection: () => ClaimSourceProofSlot.Enum.argument,
    "opaque-core": () => ClaimSourceProofSlot.Enum.core,
    attachment: () => ClaimSourceProofSlot.Enum.attachment,
  });
const finiteProofRank = (proof: ClaimFiniteSourceProof): number =>
  ClaimFiniteSourceProof.match(proof, {
    token: () => -3,
    scope: () => -3,
    "intrinsic-noun": () => -3,
    boundary: () => -2,
    "citation-boundary": () => -2,
    "verbal-boundary": () => -2,
    opening: () => -1,
    closure: () => -1,
    head: () => 0,
    operator: () => 1,
    "ordered-arguments": () => 2,
    description: () => 2,
    selection: () => 2,
    "opaque-core": () => 3,
    attachment: () => 3,
  });
const containsScope = (scope: TextAnchor, token: TextAnchor): boolean =>
  scope.startChar <= token.startChar && token.endChar <= scope.endChar;
const sourceAnchorEqual = (left: TextAnchor, right: TextAnchor): boolean =>
  left.startChar === right.startChar && left.endChar === right.endChar && left.quote === right.quote;
const finitePreambleScopeMatches = (claim: PatentClaim, extent: TextAnchor): boolean =>
  extent.startChar === 0 && extent.endChar === claim.preamble.length && extent.quote === claim.preamble;
const finiteBodyScopeMatches = (claim: PatentClaim, extent: TextAnchor): boolean =>
  extent.startChar === claim.claimText.length - claim.body.length &&
  extent.endChar === claim.claimText.length &&
  extent.quote === claim.body;
const finiteTransitionScopeMatches = (
  claim: PatentClaim,
  extent: TextAnchor,
  charge: (amount: number) => boolean
): boolean => O.exists(rawClaimTransitionScope(claim, charge), (raw) => sourceAnchorEqual(raw, extent));
const finiteScopeMatches = (
  claim: PatentClaim,
  proof: Extract<ClaimFiniteSourceProof, { readonly kind: "scope" }>,
  charge: (amount: number) => boolean
): boolean => {
  if (proof.role === "preamble") return finitePreambleScopeMatches(claim, proof.extent);
  if (proof.role === "body") return finiteBodyScopeMatches(claim, proof.extent);
  return finiteTransitionScopeMatches(claim, proof.extent, charge);
};

/**
 * Validate a complete raw qualified dependency witness without derived grammar premises.
 * @category validation
 * @since 0.0.0
 */
type CitationWitnessToken = Extract<ClaimFiniteSourceProof, { readonly kind: "token" }>;
const citationWitnessExpectedReferences = (
  references: HashSet.HashSet<number>,
  witnessReferences: ReadonlyArray<number>,
  claimReferences: ReadonlyArray<number>
): boolean => {
  const expected = HashSet.fromIterable(witnessReferences);
  if (
    HashSet.size(references) === 0 ||
    HashSet.size(references) !== HashSet.size(expected) ||
    !A.every(claimReferences, (n) => HashSet.has(expected, n)) ||
    claimReferences.length !== HashSet.size(expected)
  )
    return false;
  for (const reference of references) if (!HashSet.has(expected, reference)) return false;
  return true;
};
const citationWitnessContinuationValid = (
  next: CitationWitnessToken,
  following: O.Option<CitationWitnessToken>,
  preambleEnd: number
): boolean => {
  if (O.exists(following, (p) => HashSet.has(HashSet.make("claim", "claims"), Str.toLowerCase(p.token.anchor.quote))))
    return false;
  if (
    next.token.anchor.quote !== "," &&
    !O.exists(following, (p) => p.token.anchor.startChar < preambleEnd && p.token.pos !== "PUNCT")
  )
    return false;
  if (O.exists(following, (p) => O.isSome(Str.match(/^[1-9][0-9]*$/u)(p.token.anchor.quote)))) return false;
  return true;
};
const citationWitnessFollowingSource = (
  raw: ReadonlyArray<CitationWitnessToken>,
  last: CitationWitnessToken,
  preambleEnd: number
): boolean => {
  const next = A.get(raw, last.tokenOrdinal);
  if (O.isNone(next)) return true;
  if (
    !(
      next.value.token.anchor.startChar < preambleEnd &&
      HashSet.has(HashSet.make(",", "and", "or"), Str.toLowerCase(next.value.token.anchor.quote))
    )
  )
    return true;
  const following = A.get(raw, last.tokenOrdinal + 1);
  return citationWitnessContinuationValid(next.value, following, preambleEnd);
};
const citationWitnessGap = (
  qualifiedText: string,
  tokens: ReadonlyArray<CitationWitnessToken>,
  index: number,
  token: TextAnchor,
  charge: (amount: number) => boolean
): boolean => {
  if (index === 0) return true;
  const left = O.getOrThrow(A.get(tokens, index - 1)).token.anchor;
  if (
    !charge(token.startChar - left.endChar + 1) ||
    Str.trim(Str.slice(left.endChar, token.startChar)(qualifiedText)) !== ""
  )
    return false;
  return true;
};
const citationWitnessQuotesAndGaps = (
  qualifiedText: string,
  tokens: ReadonlyArray<CitationWitnessToken>,
  charge: (amount: number) => boolean
): boolean => {
  const quotes = A.fromIterable(
    Str.matchAll(/"(?:\\.|[^"\\])*"|“[^”]*”|‘(?:[^’]|’(?=[\p{L}\p{N}]))*’/gu)(qualifiedText)
  );
  if (!charge(quotes.length * tokens.length + tokens.length + 2)) return false;
  for (let i = 0; i < tokens.length; i++) {
    const token = O.getOrThrow(A.get(tokens, i)).token.anchor;
    if (!citationWitnessGap(qualifiedText, tokens, i, token, charge)) return false;
    if (
      A.some(
        quotes,
        (quote) =>
          quote.index !== undefined && token.startChar < quote.index + quote[0].length && token.endChar > quote.index
      )
    )
      return false;
  }
  return true;
};

const citationWitnessReadTokens = (
  witness: ClaimCitationWitness,
  resolve: (ref: ClaimSourceProofRef) => O.Option<ClaimFiniteSourceProof>,
  tokens: Array<CitationWitnessToken>
): number => {
  let previous = 0;
  let keyword = -1;
  for (const ref of witness.tokens) {
    const token = resolve(ref);
    if (
      ref.slot !== "token" ||
      O.isNone(token) ||
      token.value.kind !== "token" ||
      (previous > 0 && token.value.tokenOrdinal !== previous + 1)
    )
      return -2;
    if (ref.ordinal === witness.keyword.ordinal) keyword = tokens.length;
    tokens.push(token.value);
    previous = token.value.tokenOrdinal;
  }
  return keyword;
};
const citationWitnessExtentValid = (
  preambleEnd: number,
  extent: TextAnchor,
  keyword: number,
  first: O.Option<CitationWitnessToken>,
  last: O.Option<CitationWitnessToken>
): last is O.Some<CitationWitnessToken> => {
  if (
    keyword < 0 ||
    O.isNone(first) ||
    O.isNone(last) ||
    first.value.token.anchor.startChar !== extent.startChar ||
    last.value.token.anchor.endChar !== extent.endChar ||
    extent.endChar > preambleEnd
  )
    return false;
  return true;
};
const citationWitnessIntroducerValid = (
  tokens: ReadonlyArray<CitationWitnessToken>,
  spelling: (index: number) => string,
  keyword: number,
  charge: (amount: number) => boolean
): boolean => {
  if (!HashSet.has(HashSet.make("claim", "claims"), spelling(keyword))) return false;
  const prefix = A.take(tokens, keyword);
  if (!charge(claimCitationIntroducers.length * (prefix.length + 1) + 2)) return false;
  if (
    prefix.length > 0 &&
    !A.some(
      claimCitationIntroducers,
      (words) => words.length === prefix.length && A.every(words, (word, i) => spelling(i) === word)
    )
  )
    return false;
  return true;
};

const citationWitnessClaimValid = (
  claim: PatentClaim,
  qualifiedText: string,
  certificates: ReadonlyArray<ClaimFiniteSourceProof>,
  witness: ClaimCitationWitness,
  charge: (amount: number) => boolean
): claim is Extract<PatentClaim, { readonly claimType: "dependent" }> => {
  if (
    claim.claimType !== "dependent" ||
    claim.claimText !== qualifiedText ||
    !charge(
      certificates.length +
        witness.tokens.length * 8 +
        claim.claimText.length * 2 +
        claim.claimReferences.length * 8 +
        8
    )
  )
    return false;
  return true;
};
const citationWitnessReferenceNumberValid = (
  spelling: (index: number) => string,
  cursor: number,
  charge: (amount: number) => boolean
): boolean => {
  if (!charge(spelling(cursor).length + 4) || O.isNone(Str.match(/^[1-9][0-9]*$/u)(spelling(cursor)))) return false;
  return true;
};
const citationWitnessNextReference = (spelling: (index: number) => string, cursor: number, length: number): number => {
  if (cursor === length) return cursor;
  if (!HashSet.has(HashSet.make(",", "and", "or"), spelling(cursor))) return -1;
  cursor++;
  if (HashSet.has(HashSet.make("claim", "claims"), spelling(cursor))) cursor++;
  if (cursor === length) return -1;
  return cursor;
};
const citationWitnessCompleteReferences = (
  spelling: (index: number) => string,
  start: number,
  length: number,
  charge: (amount: number) => boolean
): HashSet.HashSet<number> => {
  const empty = HashSet.empty<number>();
  let references = empty;
  let cursor = start;
  // A failed list never returns a partial reference set. The original final
  // reference guard rejects an empty set; reuse the seed without allocating
  // another result object or doing work after a failed reservation.
  while (cursor < length) {
    if (!citationWitnessReferenceNumberValid(spelling, cursor, charge)) return empty;
    references = HashSet.add(references, Number(spelling(cursor)));
    cursor = citationWitnessNextReference(spelling, cursor + 1, length);
    if (cursor < 0) return empty;
  }
  return references;
};

const completeClaimCitationWitness = (
  qualifiedText: string,
  certificates: ReadonlyArray<ClaimFiniteSourceProof>,
  extent: TextAnchor,
  claimReferences: ReadonlyArray<number>,
  witness: ClaimCitationWitness,
  charge: (amount: number) => boolean
): boolean => {
  const resolve = (ref: ClaimSourceProofRef) =>
    O.filter(A.get(certificates, ref.ordinal - 1), (p) => p.ordinal === ref.ordinal && finiteProofSlot(p) === ref.slot);
  const claim = witness.claim;
  if (!citationWitnessClaimValid(claim, qualifiedText, certificates, witness, charge)) return false;
  if (!O.exists(resolve(witness.keyword), (p) => p.kind === "token")) return false;
  const raw = A.filter(certificates, (p) => p.kind === "token");
  const tokens: Array<Extract<ClaimFiniteSourceProof, { readonly kind: "token" }>> = [];
  const keyword = citationWitnessReadTokens(witness, resolve, tokens);
  if (keyword === -2) return false;
  const first = A.head(tokens);
  const last = A.last(tokens);
  if (!citationWitnessExtentValid(claim.preamble.length, extent, keyword, first, last)) return false;
  const spelling = (index: number): string =>
    O.match(A.get(tokens, index), { onNone: () => "", onSome: (p) => Str.toLowerCase(p.token.anchor.quote) });
  if (!citationWitnessIntroducerValid(tokens, spelling, keyword, charge)) return false;
  const references = citationWitnessCompleteReferences(spelling, keyword + 1, tokens.length, charge);
  if (HashSet.size(references) === 0) return false;
  if (!citationWitnessExpectedReferences(references, claim.claimReferences, claimReferences)) return false;
  // Check the *actual following* source tokens: the witness may not certify a
  // prefix of a dangling or repeated-keyword continuation.
  if (!citationWitnessFollowingSource(raw, last.value, claim.preamble.length)) return false;
  return citationWitnessQuotesAndGaps(claim.claimText, tokens, charge);
};
/**
 * Check a source-aligned complete raw citation independently of derived roles.
 *
 * **Example** (Keep an undecodable citation witness unavailable)
 *
 * ```ts
 * import { ClaimCitationWitness, validateClaimCitationWitness } from "@beep/law-practice-domain/values/ClaimElement"
 * import { TextAnchor } from "@beep/provenance/TextAnchor"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(ClaimCitationWitness)({})
 * const checked = O.map(decoded, witness => validateClaimCitationWitness([], TextAnchor.make({ startChar: 0, endChar: 6, quote: "sensor" }), [], witness, () => true)("sensor"))
 * console.log(O.isNone(checked)) // true: no witness is invented from incomplete raw input
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateClaimCitationWitness: {
  (
    certificates: ReadonlyArray<ClaimFiniteSourceProof>,
    extent: TextAnchor,
    claimReferences: ReadonlyArray<number>,
    witness: ClaimCitationWitness,
    charge: (amount: number) => boolean
  ): (qualifiedText: string) => boolean;
  (
    qualifiedText: string,
    certificates: ReadonlyArray<ClaimFiniteSourceProof>,
    extent: TextAnchor,
    claimReferences: ReadonlyArray<number>,
    witness: ClaimCitationWitness,
    charge: (amount: number) => boolean
  ): boolean;
} = dual(6, completeClaimCitationWitness);

type FiniteProofValidationContext = {
  scopes: HashSet.HashSet<"preamble" | "body" | "transition">;
  readonly claim: PatentClaim;
  readonly tokens: ReadonlyArray<ClaimLexicalToken>;
  readonly proofs: ReadonlyArray<ClaimFiniteSourceProof>;
  readonly sourceProofs: ReadonlyArray<ClaimSourceProof>;
  readonly originalInput: O.Option<ClaimLexicalEvidence>;
  readonly originalScopes: O.Option<ClaimOriginalQualifiedScopes>;
  readonly charge: (amount: number) => boolean;
  readonly resolve: (ref: ClaimSourceProofRef) => O.Option<ClaimFiniteSourceProof>;
};

const originalQualifiedScopes = (
  claim: PatentClaim,
  charge: (amount: number) => boolean
): O.Option<ClaimOriginalQualifiedScopes> => {
  const transition = rawClaimTransitionScope(claim, charge);
  if (O.isNone(transition) || !charge(claim.preamble.length + claim.body.length + 48)) return O.none();
  return O.some(
    ClaimOriginalQualifiedScopes.make({
      preamble: TextAnchor.make({ startChar: 0, endChar: claim.preamble.length, quote: claim.preamble }),
      transition: transition.value,
      body: TextAnchor.make({
        startChar: claim.claimText.length - claim.body.length,
        endChar: claim.claimText.length,
        quote: claim.body,
      }),
    })
  );
};
const intrinsicSourceIdentityEqual = S.toEquivalence(ClaimLexicalSourceIdentity);
const intrinsicWitnessEqual = S.toEquivalence(ClaimIntrinsicNounWitness);
const strictIntrinsicLeaf = S.decodeUnknownResult(S.toType(ClaimFiniteSourceProof.cases["intrinsic-noun"]), {
  onExcessProperty: "error",
});
const strictHeadTerminal = S.decodeUnknownResult(S.toType(ClaimHeadTerminalEvidence), { onExcessProperty: "error" });
const intrinsicOriginalScopeCount = (scopes: ClaimOriginalQualifiedScopes, extent: TextAnchor): number => {
  let count = 0;
  if (containsScope(scopes.preamble, extent)) count++;
  if (containsScope(scopes.transition, extent)) count++;
  if (containsScope(scopes.body, extent)) count++;
  return count;
};
type IntrinsicRawProof = Extract<ClaimFiniteSourceProof, { readonly kind: "intrinsic-noun" }>;
const intrinsicWitnessMatches = (token: ClaimLexicalToken, proof: IntrinsicRawProof): boolean => {
  const witness = token.intrinsicNoun;
  return (
    witness.status === "known" &&
    witness.baseNoun &&
    !witness.oov &&
    witness.rawForm === proof.rawForm &&
    sourceAnchorEqual(witness.anchor, token.anchor)
  );
};
const validateIntrinsicSourceWitness = (
  context: FiniteProofValidationContext,
  proof: IntrinsicRawProof,
  identity: Extract<ClaimLexicalEvidence, { readonly status: "aligned" }>,
  token: ClaimLexicalToken
): boolean => {
  if (
    !context.charge(
      identity.sourceKey.length * 2 +
        identity.provider.length * 2 +
        identity.assetDigest.length * 2 +
        token.anchor.quote.length * 6 +
        24
    )
  )
    return false;
  const expected = ClaimLexicalSourceIdentity.make({
    sourceKey: identity.sourceKey,
    sourceOrdinal: identity.sourceOrdinal,
    provider: identity.provider,
    assetDigest: identity.assetDigest,
  });
  if (!intrinsicSourceIdentityEqual(proof.source, expected)) return false;
  if (
    !sourceAnchorEqual(token.anchor, proof.anchor) ||
    proof.rawForm !== token.anchor.quote ||
    intrinsicOriginalScopeCount(O.getOrThrow(context.originalScopes), proof.anchor) !== 1
  )
    return false;
  return intrinsicWitnessMatches(token, proof);
};
const validateFiniteIntrinsicFact = (context: FiniteProofValidationContext, proof: IntrinsicRawProof): boolean => {
  if (!context.charge(32) || Result.isFailure(strictIntrinsicLeaf(proof))) return false;
  const input = context.originalInput;
  if (O.isNone(input) || input.value.status !== "aligned" || O.isNone(context.originalScopes)) return false;
  const original = A.get(input.value.tokens, proof.originalTokenDataOrdinal - 1);
  if (O.isNone(original) || original.value.pos !== "ADJ") return false;
  return validateIntrinsicSourceWitness(context, proof, input.value, original.value);
};
const validateFiniteTokenProof = (
  context: FiniteProofValidationContext,
  proof: Extract<ClaimFiniteSourceProof, { readonly kind: "token" }>
): boolean => {
  const { tokens } = context;
  const original = A.get(tokens, proof.tokenOrdinal - 1);
  const witnessWork = proof.token.intrinsicNoun.status === "known" ? proof.token.anchor.quote.length * 3 + 12 : 1;
  if (!context.charge(witnessWork)) return false;
  if (
    !O.exists(
      original,
      (t) =>
        sourceAnchorEqual(t.anchor, proof.token.anchor) &&
        t.pos === proof.token.pos &&
        O.getOrElse(t.lemma, () => "") === O.getOrElse(proof.token.lemma, () => "") &&
        intrinsicWitnessEqual(t.intrinsicNoun, proof.token.intrinsicNoun)
    )
  )
    return false;
  return true;
};

type FiniteBoundaryProof = Extract<ClaimFiniteSourceProof, { readonly kind: "boundary" }>;
type FiniteTokenProof = Extract<ClaimFiniteSourceProof, { readonly kind: "token" }>;

const advanceFiniteAdjuncts = (
  tokens: ReadonlyArray<ClaimLexicalToken>,
  start: number,
  charge: (amount: number) => boolean
): number => {
  let after = start;
  while (tagAt(tokens, after) === "ADV" || HashSet.has(HashSet.make("not", "n't"), wordAt(tokens, after))) {
    if (!charge(2)) return -1;
    after++;
  }
  return after;
};
const finiteAdjunctSuccessor = (
  context: FiniteProofValidationContext,
  proof: FiniteBoundaryProof,
  after: number,
  scopeEnd: number
): boolean =>
  O.exists(
    O.flatMap(proof.successor, context.resolve),
    (p) => p.kind === "token" && p.tokenOrdinal === after + 1 && p.token.anchor.endChar <= scopeEnd
  );
const finiteRelativeSuccessor = (
  next: O.Option<ClaimFiniteSourceProof>,
  after: number,
  scopeEnd: number,
  tokens: ReadonlyArray<ClaimLexicalToken>
): boolean =>
  O.exists(
    next,
    (p) =>
      p.kind === "token" &&
      p.tokenOrdinal === after + 1 &&
      p.token.anchor.endChar <= scopeEnd &&
      (HashSet.has(HashSet.make("VERB", "AUX"), p.token.pos) || inflectedNounPredicate(tokens, after))
  );
const validateFiniteAdjunctBoundary = (
  context: FiniteProofValidationContext,
  proof: FiniteBoundaryProof,
  raw: FiniteTokenProof,
  scopeEnd: number
): boolean => {
  const { tokens, charge } = context;
  const index = raw.tokenOrdinal - 1;
  const after = advanceFiniteAdjuncts(tokens, index, charge);
  if (
    after < 0 ||
    after === index ||
    !charge((after - index) * 4 + 8) ||
    !rawFunctionalBoundary(tokens, after) ||
    !finiteAdjunctSuccessor(context, proof, after, scopeEnd)
  )
    return false;
  return true;
};
const validateFiniteRelativeBoundary = (
  context: FiniteProofValidationContext,
  proof: FiniteBoundaryProof,
  raw: FiniteTokenProof,
  scopeEnd: number
): boolean => {
  const { tokens, charge, resolve } = context;
  const index = raw.tokenOrdinal - 1;
  const token = raw.token;
  const next = O.flatMap(proof.successor, resolve);
  const after = advanceFiniteAdjuncts(tokens, index + 1, charge);
  if (after < 0) return false;
  if (
    !charge(6) ||
    !HashSet.has(HashSet.make("that", "which"), word(token)) ||
    !finiteRelativeSuccessor(next, after, scopeEnd, tokens)
  )
    return false;
  return true;
};
const finiteVerbBoundary = (
  tokens: ReadonlyArray<ClaimLexicalToken>,
  token: ClaimLexicalToken,
  index: number
): boolean =>
  (token.pos === "VERB" &&
    (finiteInflection(token) ||
      (finitePosition(tokens, index) && finiteFrameProof(tokens, index) && unambiguousFiniteForm(tokens, index)))) ||
  inflectedNounPredicate(tokens, index);
const finiteReducedBoundary = (
  tokens: ReadonlyArray<ClaimLexicalToken>,
  token: ClaimLexicalToken,
  index: number
): boolean =>
  (token.pos === "ADJ" ||
    (token.pos === "VERB" &&
      O.exists(
        token.lemma,
        (lemma) => word(token) === `${normalized(lemma)}ed` || word(token) === `${normalized(lemma)}d`
      ))) &&
  (tagAt(tokens, index + 1) === "ADP" || hasInfinitiveComplement(tokens, index));
const finiteDeclarationBoundary = (
  tokens: ReadonlyArray<ClaimLexicalToken>,
  token: ClaimLexicalToken,
  index: number
): boolean =>
  HashSet.has(HashSet.make("comprising", "including", "comprises", "includes", "having"), word(token)) &&
  wordAt(tokens, index + 1) === ":";
const finiteReferenceLabelBoundary = (
  tokens: ReadonlyArray<ClaimLexicalToken>,
  token: ClaimLexicalToken,
  index: number
): boolean => word(token) === "(" && tagAt(tokens, index + 1) === "NUM" && wordAt(tokens, index + 2) === ")";
const finitePrepositionBoundary = (
  tokens: ReadonlyArray<ClaimLexicalToken>,
  token: ClaimLexicalToken,
  index: number
): boolean =>
  token.pos === "ADP" ||
  (word(token) === "to" && token.pos === "PART" && HashSet.has(articleWords, wordAt(tokens, index + 1)));
const finiteAuxiliaryBoundary = (token: ClaimLexicalToken): boolean =>
  token.pos === "AUX" || HashSet.has(auxiliaries, word(token));
const finiteDeterminerBoundary = (token: ClaimLexicalToken): boolean =>
  token.pos === "DET" || HashSet.has(articleWords, word(token));
const finiteTerminalBoundary = (token: ClaimLexicalToken): boolean => token.pos === "PUNCT" && word(token) === ".";
type FiniteSimpleBoundaryMode = Exclude<
  FiniteBoundaryProof["mode"],
  "finite" | "reduced" | "adjunct" | "relative" | "qualified-end"
>;
const validateFiniteSimpleBoundary = (
  tokens: ReadonlyArray<ClaimLexicalToken>,
  mode: FiniteSimpleBoundaryMode,
  token: ClaimLexicalToken,
  index: number
): boolean => {
  if (mode === "auxiliary") {
    return finiteAuxiliaryBoundary(token);
  }
  if (mode === "declaration") {
    return finiteDeclarationBoundary(tokens, token, index);
  }
  if (mode === "reference-label") {
    return finiteReferenceLabelBoundary(tokens, token, index);
  }
  if (mode === "preposition") {
    return finitePrepositionBoundary(tokens, token, index);
  }
  if (mode === "determiner") {
    return finiteDeterminerBoundary(token);
  }
  if (mode === "separator") {
    return HashSet.has(HashSet.make(",", ";", ":", "and", "or", "and/or"), word(token));
  }
  return finiteTerminalBoundary(token);
};
const validateFiniteBoundaryMode = (
  context: FiniteProofValidationContext,
  proof: FiniteBoundaryProof,
  raw: FiniteTokenProof,
  scopeEnd: number
): boolean => {
  const token = raw.token;
  const index = raw.tokenOrdinal - 1;
  if (proof.mode === "qualified-end") return context.charge(2) && token.anchor.endChar === scopeEnd;
  if (proof.mode === "finite") {
    return finiteVerbBoundary(context.tokens, token, index);
  }
  if (proof.mode === "reduced") {
    return finiteReducedBoundary(context.tokens, token, index);
  }
  if (proof.mode === "adjunct") {
    return validateFiniteAdjunctBoundary(context, proof, raw, scopeEnd);
  }
  if (proof.mode === "relative") {
    return validateFiniteRelativeBoundary(context, proof, raw, scopeEnd);
  }
  return validateFiniteSimpleBoundary(context.tokens, proof.mode, token, index);
};

// Only for this record's direct refs, after validateFiniteProofEdges and before any charge callback.
const checkedFiniteReference = (
  context: FiniteProofValidationContext,
  ref: ClaimSourceProofRef
): ClaimFiniteSourceProof => O.getOrThrow(context.resolve(ref));
const validateFiniteBoundaryProof = (context: FiniteProofValidationContext, proof: FiniteBoundaryProof): boolean => {
  const raw = checkedFiniteReference(context, proof.token);
  const scope = checkedFiniteReference(context, proof.scope);
  if (raw.kind !== "token" || scope.kind !== "scope") return false;
  const token = raw.token;
  if (token.anchor.startChar < scope.extent.startChar || token.anchor.endChar > scope.extent.endChar) return false;
  return validateFiniteBoundaryMode(context, proof, raw, scope.extent.endChar);
};

type FiniteVerbalBoundaryProof = Extract<ClaimFiniteSourceProof, { readonly kind: "verbal-boundary" }>;
type FiniteScopeProof = Extract<ClaimFiniteSourceProof, { readonly kind: "scope" }>;
const isFiniteTokenProofOption = (proof: O.Option<ClaimFiniteSourceProof>): proof is O.Some<FiniteTokenProof> =>
  O.isSome(proof) && proof.value.kind === "token";
const validateFiniteVerbalScope = (
  context: FiniteProofValidationContext,
  scope: FiniteScopeProof,
  raw: FiniteTokenProof,
  witness: FiniteTokenProof
): boolean => {
  if (
    !context.charge(raw.token.anchor.quote.length + witness.token.anchor.quote.length + 6) ||
    !containsScope(scope.extent, raw.token.anchor) ||
    !containsScope(scope.extent, witness.token.anchor)
  )
    return false;
  return true;
};
const finiteInfinitiveIntroducerMatches = (
  tokens: ReadonlyArray<ClaimLexicalToken>,
  raw: FiniteTokenProof,
  witness: FiniteTokenProof
): boolean =>
  !(
    raw.token.pos !== "PART" ||
    word(raw.token) !== "to" ||
    witness.token.pos !== "VERB" ||
    witness.tokenOrdinal <= raw.tokenOrdinal ||
    witness.tokenOrdinal > raw.tokenOrdinal + 2 ||
    !infinitiveBefore(tokens, witness.tokenOrdinal - 1) ||
    !O.exists(witness.token.lemma, (lemma) => normalized(lemma) === word(witness.token))
  );
const retreatFiniteAdjuncts = (
  tokens: ReadonlyArray<ClaimLexicalToken>,
  start: number,
  charge: (amount: number) => boolean
): number => {
  let before = start;
  while (tagAt(tokens, before) === "ADV" || HashSet.has(HashSet.make("not", "n't"), wordAt(tokens, before))) {
    if (!charge(2)) return -2;
    before--;
  }
  return before;
};
const finiteInfinitiveComplementMatches = (
  tokens: ReadonlyArray<ClaimLexicalToken>,
  raw: FiniteTokenProof,
  witness: FiniteTokenProof
): boolean =>
  witness.token.pos === "PART" &&
  word(witness.token) === "to" &&
  infinitiveBefore(tokens, raw.tokenOrdinal - 1) &&
  O.exists(raw.token.lemma, (lemma) => normalized(lemma) === word(raw.token));
const validateFiniteVerbalComplement = (
  context: FiniteProofValidationContext,
  proof: FiniteVerbalBoundaryProof,
  raw: FiniteTokenProof,
  witness: FiniteTokenProof
): boolean => {
  if (raw.token.pos !== "VERB") return false;
  const before = retreatFiniteAdjuncts(context.tokens, raw.tokenOrdinal - 2, context.charge);
  if (before < -1) return false;
  if (witness.tokenOrdinal !== before + 1) return false;
  return proof.mode === "auxiliary-complement"
    ? finiteAuxiliaryBoundary(witness.token)
    : finiteInfinitiveComplementMatches(context.tokens, raw, witness);
};
const validateFiniteVerbalBoundaryProof = (
  context: FiniteProofValidationContext,
  proof: FiniteVerbalBoundaryProof
): boolean => {
  const raw = checkedFiniteReference(context, proof.token);
  const governor = checkedFiniteReference(context, proof.governor);
  const scope = checkedFiniteReference(context, proof.scope);
  if (raw.kind !== "token" || governor.kind !== "token" || scope.kind !== "scope") return false;
  if (!validateFiniteVerbalScope(context, scope, raw, governor)) return false;
  if (proof.mode === "infinitive-introducer") return finiteInfinitiveIntroducerMatches(context.tokens, raw, governor);
  return validateFiniteVerbalComplement(context, proof, raw, governor);
};

const finiteCitationQualificationMatches = (claim: PatentClaim, witness: ClaimCitationWitness): boolean =>
  witness.claim.claimNumber === claim.claimNumber &&
  witness.claim.preamble === claim.preamble &&
  witness.claim.body === claim.body &&
  witness.claim.transition === claim.transition;
const validateFiniteCitationBoundaryProof = (
  context: FiniteProofValidationContext,
  proof: Extract<ClaimFiniteSourceProof, { readonly kind: "citation-boundary" }>
): boolean => {
  const { claim, proofs, charge, resolve } = context;
  const scope = resolve(proof.scope);
  const token = resolve(proof.token);
  if (
    claim.claimType !== "dependent" ||
    !finiteCitationQualificationMatches(claim, proof.witness) ||
    !O.exists(scope, (p) => p.kind === "scope" && p.role === "preamble") ||
    !O.exists(token, (p) => p.kind === "token" && p.token.anchor.startChar === proof.extent.startChar) ||
    !O.exists(A.head(proof.witness.tokens), (ref) => ref.ordinal === proof.token.ordinal) ||
    !validateClaimCitationWitness(claim.claimText, proofs, proof.extent, claim.claimReferences, proof.witness, charge)
  )
    return false;
  return true;
};

type FiniteOpeningProof = Extract<ClaimFiniteSourceProof, { readonly kind: "opening" }>;
const finiteAdjunctAt = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean =>
  tagAt(tokens, index) === "ADV" || HashSet.has(HashSet.make("not", "n't"), wordAt(tokens, index));
const finiteOpeningBoundaryMatches = (mode: "lexical-object" | "list-item", proof: ClaimFiniteSourceProof): boolean => {
  if (proof.kind === "boundary") {
    if (mode === "list-item") return proof.mode === "separator";
    return proof.mode === "finite" || proof.mode === "auxiliary";
  }
  return mode === "lexical-object" && proof.kind === "verbal-boundary" && proof.mode !== "infinitive-introducer";
};
const finiteOpeningRawToken = (
  context: FiniteProofValidationContext,
  first: O.Option<ClaimFiniteSourceProof>
): O.Option<FiniteTokenProof> => {
  if (O.isNone(first) || (first.value.kind !== "boundary" && first.value.kind !== "verbal-boundary")) return O.none();
  return O.filter(context.resolve(first.value.token), ClaimFiniteSourceProof.guards.token);
};
const finiteOpeningDeclaredAdjunct = (
  context: FiniteProofValidationContext,
  proof: FiniteOpeningProof,
  member: number,
  next: number
): boolean => {
  if (!context.charge(4)) return false;
  const declared = O.flatMap(A.get(proof.evidence, member), context.resolve);
  return O.exists(declared, (p) => p.kind === "token" && p.tokenOrdinal === next + 1);
};
const validateFiniteLexicalOpening = (
  context: FiniteProofValidationContext,
  proof: FiniteOpeningProof,
  first: O.Option<ClaimFiniteSourceProof>
): boolean => {
  const raw = finiteOpeningRawToken(context, first);
  if (O.isNone(raw)) return false;
  let next = raw.value.tokenOrdinal;
  let member = 1;
  while (finiteAdjunctAt(context.tokens, next)) {
    if (!finiteOpeningDeclaredAdjunct(context, proof, member, next)) return false;
    member++;
    next++;
  }
  if (
    !context.charge(3) ||
    member !== proof.evidence.length ||
    !O.exists(A.get(context.tokens, next), (token) => token.anchor.startChar === proof.coreStart)
  )
    return false;
  return true;
};
const finiteOpeningTokenMatches = (proof: FiniteOpeningProof, first: O.Option<ClaimFiniteSourceProof>): boolean =>
  O.exists(
    first,
    (p) =>
      p.kind === "token" &&
      (proof.mode === "preposition-object"
        ? p.token.pos === "ADP" && p.token.anchor.endChar < proof.coreStart
        : p.token.anchor.startChar === proof.coreStart)
  );
const validateFiniteOpeningMode = (
  context: FiniteProofValidationContext,
  proof: FiniteOpeningProof,
  scope: Extract<ClaimFiniteSourceProof, { readonly kind: "scope" }>,
  first: O.Option<ClaimFiniteSourceProof>
): boolean => {
  if (proof.mode === "qualified-start")
    return proof.coreStart === scope.extent.startChar && O.exists(first, (p) => p.ordinal === scope.ordinal);
  if (proof.mode === "lexical-object" || proof.mode === "list-item") {
    const mode = proof.mode;
    if (!O.exists(first, (p) => finiteOpeningBoundaryMatches(mode, p))) return false;
    if (proof.mode === "lexical-object") return validateFiniteLexicalOpening(context, proof, first);
    return true;
  }
  return finiteOpeningTokenMatches(proof, first);
};
const validateFiniteOpeningProof = (context: FiniteProofValidationContext, proof: FiniteOpeningProof): boolean => {
  const scope = context.resolve(proof.scope);
  if (
    O.isNone(scope) ||
    scope.value.kind !== "scope" ||
    proof.coreStart < scope.value.extent.startChar ||
    proof.coreStart >= scope.value.extent.endChar ||
    proof.evidence.length === 0
  )
    return false;
  const first = O.flatMap(A.head(proof.evidence), context.resolve);
  return validateFiniteOpeningMode(context, proof, scope.value, first);
};

type FiniteClosureProof = Extract<ClaimFiniteSourceProof, { readonly kind: "closure" }>;
const finiteBoundaryClosingPosition = (
  context: FiniteProofValidationContext,
  boundary: Extract<ClaimFiniteSourceProof, { readonly kind: "boundary" | "citation-boundary" | "verbal-boundary" }>,
  token: FiniteTokenProof,
  scopeEnd: number
): number => {
  if (boundary.kind !== "boundary" || boundary.mode !== "qualified-end") return token.token.anchor.startChar;
  return context.charge(2) ? scopeEnd : -1;
};
const finiteClosureBoundaryStart = (
  context: FiniteProofValidationContext,
  proof: FiniteClosureProof,
  scopeEnd: number
): number => {
  if (O.isNone(proof.boundary)) return scopeEnd;
  const boundary = context.resolve(proof.boundary.value);
  if (
    O.isNone(boundary) ||
    (boundary.value.kind !== "boundary" &&
      boundary.value.kind !== "citation-boundary" &&
      boundary.value.kind !== "verbal-boundary") ||
    boundary.value.scope.ordinal !== proof.scope.ordinal
  )
    return -1;
  const token = context.resolve(boundary.value.token);
  if (O.isNone(token) || token.value.kind !== "token") return -1;
  return finiteBoundaryClosingPosition(context, boundary.value, token.value, scopeEnd);
};
const validateFiniteClosureGap = (
  context: FiniteProofValidationContext,
  proof: FiniteClosureProof,
  gapEnd: number
): boolean => {
  const { claim, charge } = context;
  if (
    gapEnd < proof.coreEnd ||
    !charge((gapEnd - proof.coreEnd) * 3 + 2) ||
    Str.trim(Str.slice(proof.coreEnd, gapEnd)(claim.claimText)) !== ""
  )
    return false;
  if (
    gapEnd === proof.coreEnd
      ? O.isSome(proof.gap)
      : !O.exists(
          proof.gap,
          (a) =>
            a.startChar === proof.coreEnd &&
            a.endChar === gapEnd &&
            a.quote === Str.slice(proof.coreEnd, gapEnd)(claim.claimText)
        )
  )
    return false;
  return true;
};
const validateFiniteClosureProof = (context: FiniteProofValidationContext, proof: FiniteClosureProof): boolean => {
  const scope = context.resolve(proof.scope);
  if (
    O.isNone(scope) ||
    scope.value.kind !== "scope" ||
    proof.coreEnd <= scope.value.extent.startChar ||
    proof.coreEnd > scope.value.extent.endChar
  )
    return false;
  const gapEnd = finiteClosureBoundaryStart(context, proof, scope.value.extent.endChar);
  if (gapEnd < 0) return false;
  return validateFiniteClosureGap(context, proof, gapEnd);
};

type FiniteHeadProof = Extract<ClaimFiniteSourceProof, { readonly kind: "head" }>;
const finiteHeadCoreMatches = (claim: PatentClaim, proof: FiniteHeadProof): boolean =>
  !(
    proof.core.startChar < 0 ||
    proof.core.endChar > claim.claimText.length ||
    proof.core.startChar >= proof.core.endChar ||
    proof.core.quote !== Str.slice(proof.core.startChar, proof.core.endChar)(claim.claimText)
  );
const finiteHeadAnchorMatches = (claim: PatentClaim, proof: FiniteHeadProof): boolean =>
  !(
    proof.head.startChar < proof.core.startChar ||
    proof.head.endChar > proof.core.endChar ||
    proof.head.startChar >= proof.head.endChar ||
    proof.head.quote !== Str.slice(proof.head.startChar, proof.head.endChar)(claim.claimText)
  );
const finiteHeadScopesMatch = (
  opening: O.Option<ClaimFiniteSourceProof>,
  closing: O.Option<ClaimFiniteSourceProof>
): boolean =>
  O.exists(
    opening,
    (p) => p.kind === "opening" && O.exists(closing, (q) => q.kind === "closure" && q.scope.ordinal === p.scope.ordinal)
  );
const finiteHeadTerminalMatches = (proof: FiniteHeadProof, terminal: O.Option<ClaimFiniteSourceProof>): boolean =>
  O.exists(
    terminal,
    (p) =>
      p.kind === "token" &&
      p.token.anchor.startChar >= proof.head.startChar &&
      p.token.anchor.endChar <= proof.head.endChar &&
      (proof.terminalEvidence.kind === "lexical-terminal"
        ? HashSet.has(nominalTags, p.token.pos)
        : p.token.pos === "ADJ")
  );
const finiteHeadEdgesMatch = (
  proof: FiniteHeadProof,
  opening: O.Option<ClaimFiniteSourceProof>,
  closing: O.Option<ClaimFiniteSourceProof>,
  terminal: O.Option<ClaimFiniteSourceProof>
): boolean =>
  O.exists(opening, (p) => p.kind === "opening" && p.coreStart === proof.core.startChar) &&
  O.exists(closing, (p) => p.kind === "closure" && p.coreEnd === proof.core.endChar) &&
  finiteHeadTerminalMatches(proof, terminal);
const validateFiniteHeadTokens = (context: FiniteProofValidationContext, proof: FiniteHeadProof): boolean => {
  let ordinal = 0;
  for (const ref of proof.tokens) {
    const t = context.resolve(ref);
    if (
      O.isNone(t) ||
      t.value.kind !== "token" ||
      (ordinal > 0 && t.value.tokenOrdinal !== ordinal + 1) ||
      t.value.token.anchor.startChar < proof.core.startChar ||
      t.value.token.anchor.endChar > proof.core.endChar
    )
      return false;
    ordinal = t.value.tokenOrdinal;
  }
  return true;
};
const finiteHeadEndpointsMatch = (context: FiniteProofValidationContext, proof: FiniteHeadProof): boolean => {
  const first = O.flatMap(A.head(proof.tokens), context.resolve);
  const last = O.flatMap(A.last(proof.tokens), context.resolve);
  if (
    !O.exists(first, (p) => p.kind === "token" && p.token.anchor.startChar === proof.core.startChar) ||
    !O.exists(last, (p) => p.kind === "token" && p.token.anchor.endChar === proof.core.endChar)
  )
    return false;
  return true;
};
type IntrinsicHeadArm = Extract<ClaimHeadTerminalEvidence, { readonly kind: "intrinsic-noun-terminal" }>;
const intrinsicModifierAllowed = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean => {
  const token = at(tokens, index);
  if (O.isNone(token)) return false;
  if (HashSet.has(modifierTags, token.value.pos) || rawRegularParticiple(token.value)) return true;
  return (
    token.value.pos === "ADV" &&
    (tagAt(tokens, index + 1) === "ADJ" || O.exists(at(tokens, index + 1), rawRegularParticiple))
  );
};
const intrinsicModifierWork = (token: ClaimLexicalToken): number =>
  token.anchor.quote.length * 4 +
  O.getOrElse(
    O.map(token.lemma, (lemma) => lemma.length),
    () => 0
  ) *
    4 +
  6;
const validateIntrinsicOrderedModifiers = (
  context: FiniteProofValidationContext,
  arm: IntrinsicHeadArm,
  first: FiniteTokenProof
): boolean => {
  for (let i = 0; i < arm.orderedModifiers.length; i++) {
    const token = context.resolve(O.getOrThrow(A.get(arm.orderedModifiers, i)));
    if (!isFiniteTokenProofOption(token) || token.value.tokenOrdinal !== first.tokenOrdinal + i + 1) return false;
    const t = token.value.token;
    if (
      !context.charge(intrinsicModifierWork(t)) ||
      !intrinsicModifierAllowed(context.tokens, token.value.tokenOrdinal - 1)
    )
      return false;
  }
  return true;
};
const validateIntrinsicNonfiniteModifiers = (
  context: FiniteProofValidationContext,
  arm: IntrinsicHeadArm,
  first: FiniteTokenProof,
  terminal: FiniteTokenProof
): boolean => {
  let previous = 0;
  for (const ref of arm.nonfiniteModifiers) {
    const token = context.resolve(ref);
    if (
      !isFiniteTokenProofOption(token) ||
      token.value.tokenOrdinal <= previous ||
      token.value.tokenOrdinal <= first.tokenOrdinal ||
      token.value.tokenOrdinal >= terminal.tokenOrdinal
    )
      return false;
    const t = token.value.token;
    if (!context.charge(intrinsicModifierWork(t)) || !rawRegularParticiple(t)) return false;
    previous = token.value.tokenOrdinal;
  }
  return true;
};
const validateIntrinsicModifierRefs = (
  context: FiniteProofValidationContext,
  proof: FiniteHeadProof,
  arm: IntrinsicHeadArm,
  first: FiniteTokenProof,
  terminal: FiniteTokenProof
): boolean => {
  const expected = terminal.tokenOrdinal - first.tokenOrdinal - 1;
  if (
    !context.charge(arm.orderedModifiers.length * 5 + arm.nonfiniteModifiers.length * 5 + 4) ||
    expected < 1 ||
    arm.orderedModifiers.length !== expected
  )
    return false;
  if (!validateIntrinsicOrderedModifiers(context, arm, first)) return false;
  if (!validateIntrinsicNonfiniteModifiers(context, arm, first, terminal)) return false;
  return (
    arm.nonfiniteModifiers.length > 0 &&
    proof.head.startChar === O.getOrThrow(A.get(context.tokens, first.tokenOrdinal)).anchor.startChar &&
    proof.head.endChar === terminal.token.anchor.endChar
  );
};
const intrinsicClosingAuxiliary = (
  context: FiniteProofValidationContext,
  closure: FiniteClosureProof,
  auxiliary: FiniteBoundaryProof,
  firstAfter: number
): boolean => {
  const boundary = O.flatMap(closure.boundary, context.resolve);
  if (O.isNone(boundary) || boundary.value.kind !== "boundary") return false;
  const rawAuxiliary = context.resolve(auxiliary.token);
  if (!isFiniteTokenProofOption(rawAuxiliary)) return false;
  if (boundary.value.mode === "auxiliary")
    return boundary.value.ordinal === auxiliary.ordinal && firstAfter === rawAuxiliary.value.tokenOrdinal;
  return (
    boundary.value.mode === "adjunct" &&
    O.exists(boundary.value.successor, (ref) => ref.ordinal === auxiliary.token.ordinal)
  );
};
const intrinsicArticleOpening = (opening: FiniteOpeningProof, first: FiniteTokenProof): boolean =>
  opening.mode === "determiner" &&
  HashSet.has(HashSet.make("a", "an"), word(first.token)) &&
  first.token.pos === "DET" &&
  opening.evidence.length === 1 &&
  O.exists(A.head(opening.evidence), (ref) => ref.ordinal === first.ordinal && ref.slot === "token");
const validateIntrinsicHeadContinuation = (
  context: FiniteProofValidationContext,
  proof: FiniteHeadProof,
  arm: IntrinsicHeadArm,
  terminal: FiniteTokenProof,
  first: FiniteTokenProof,
  opening: FiniteOpeningProof,
  closing: FiniteClosureProof,
  auxiliary: FiniteBoundaryProof
): boolean => {
  if (!intrinsicArticleOpening(opening, first)) return false;
  if (auxiliary.scope.ordinal !== opening.scope.ordinal) return false;
  const after = advanceFiniteAdjuncts(context.tokens, terminal.tokenOrdinal, context.charge);
  const rawAux = context.resolve(auxiliary.token);
  if (
    after < 0 ||
    !isFiniteTokenProofOption(rawAux) ||
    rawAux.value.tokenOrdinal !== after + 1 ||
    !finiteAuxiliaryBoundary(rawAux.value.token)
  )
    return false;
  if (!intrinsicClosingAuxiliary(context, closing, auxiliary, after + 1)) return false;
  return validateIntrinsicModifierRefs(context, proof, arm, first, terminal);
};
const isIntrinsicRawFact = (proof: O.Option<ClaimFiniteSourceProof>): proof is O.Some<IntrinsicRawProof> =>
  O.isSome(proof) && proof.value.kind === "intrinsic-noun";
const isHeadOpeningProof = (proof: O.Option<ClaimFiniteSourceProof>): proof is O.Some<FiniteOpeningProof> =>
  O.isSome(proof) && proof.value.kind === "opening";
const isHeadClosureProof = (proof: O.Option<ClaimFiniteSourceProof>): proof is O.Some<FiniteClosureProof> =>
  O.isSome(proof) && proof.value.kind === "closure";
const isRawAuxiliaryProof = (proof: O.Option<ClaimFiniteSourceProof>): proof is O.Some<FiniteBoundaryProof> =>
  O.isSome(proof) && proof.value.kind === "boundary" && proof.value.mode === "auxiliary";
const intrinsicTerminalMatches = (terminal: FiniteTokenProof, fact: IntrinsicRawProof): boolean =>
  terminal.tokenOrdinal === fact.originalTokenDataOrdinal &&
  sourceAnchorEqual(terminal.token.anchor, fact.anchor) &&
  intrinsicInputNoun(terminal.token);
const validateFiniteIntrinsicHead = (
  context: FiniteProofValidationContext,
  proof: FiniteHeadProof,
  arm: IntrinsicHeadArm
): boolean => {
  if (!context.charge(24)) return false;
  const terminal = context.resolve(proof.terminal);
  const fact = context.resolve(arm.intrinsicNoun);
  const auxiliary = context.resolve(arm.rawAuxiliary);
  const opening = context.resolve(proof.opening);
  const closing = context.resolve(proof.closure);
  const first = O.flatMap(A.head(proof.tokens), context.resolve);
  if (!isFiniteTokenProofOption(terminal) || !isFiniteTokenProofOption(first) || !isIntrinsicRawFact(fact))
    return false;
  if (!isHeadOpeningProof(opening) || !isHeadClosureProof(closing) || !isRawAuxiliaryProof(auxiliary)) return false;
  if (!intrinsicTerminalMatches(terminal.value, fact.value)) return false;
  return validateIntrinsicHeadContinuation(
    context,
    proof,
    arm,
    terminal.value,
    first.value,
    opening.value,
    closing.value,
    auxiliary.value
  );
};
const finiteHeadSourceAnchorsMatch = (claim: PatentClaim, proof: FiniteHeadProof): boolean =>
  finiteHeadCoreMatches(claim, proof) && finiteHeadAnchorMatches(claim, proof);
const finiteHeadSourceMembership = (
  proof: FiniteHeadProof,
  opening: O.Option<ClaimFiniteSourceProof>,
  closing: O.Option<ClaimFiniteSourceProof>,
  terminal: O.Option<ClaimFiniteSourceProof>
): boolean =>
  finiteHeadScopesMatch(opening, closing) &&
  A.some(proof.tokens, (ref) => ref.ordinal === proof.terminal.ordinal) &&
  finiteHeadEdgesMatch(proof, opening, closing, terminal);
const validateFiniteHeadProof = (context: FiniteProofValidationContext, proof: FiniteHeadProof): boolean => {
  const opening = context.resolve(proof.opening);
  const closing = context.resolve(proof.closure);
  const terminal = context.resolve(proof.terminal);
  if (!context.charge(proof.core.quote.length * 2 + proof.head.quote.length * 2 + proof.tokens.length + 4))
    return false;
  if (!finiteHeadSourceAnchorsMatch(context.claim, proof)) return false;
  if (!finiteHeadSourceMembership(proof, opening, closing, terminal)) return false;
  if (!validateFiniteHeadTokens(context, proof) || !finiteHeadEndpointsMatch(context, proof)) return false;
  if (!context.charge(4) || Result.isFailure(strictHeadTerminal(proof.terminalEvidence))) return false;
  return (
    proof.terminalEvidence.kind === "lexical-terminal" ||
    validateFiniteIntrinsicHead(context, proof, proof.terminalEvidence)
  );
};

type FiniteOperatorProof = Extract<ClaimFiniteSourceProof, { readonly kind: "operator" }>;
type FiniteDerivedOperatorHead = Exclude<ClaimOperatorHeadWitness, { readonly kind: "singleton" }>;
const finiteOperatorLexicalSpan = (head: FiniteDerivedOperatorHead, proof: ClaimSourceProof): O.Option<TextAnchor> => {
  if (head.kind === "finite-pp") {
    return proof.kind === "finite-pp" ? O.some(proof.lexicalPredicate) : O.none();
  }
  if (head.kind === "scalar") {
    return proof.kind === "scalar-auxiliary" ? O.some(proof.participle) : O.none();
  }
  return proof.kind === "reduced-adjective" || proof.kind === "reduced-participle" ? O.some(proof.operator) : O.none();
};
const finiteOperatorSpanAgrees = (
  proof: ClaimSourceProof,
  extent: TextAnchor,
  span: TextAnchor,
  lexicalHead: TextAnchor
): boolean => {
  if (
    !(
      proof.kind === "finite-pp" ||
      proof.kind === "scalar-auxiliary" ||
      proof.kind === "reduced-adjective" ||
      proof.kind === "reduced-participle"
    )
  )
    return false;
  if (!sourceAnchorEqual(proof.operator, extent) || !sourceAnchorEqual(span, lexicalHead)) return false;
  return true;
};
const validateFiniteDerivedOperatorHead = (
  context: FiniteProofValidationContext,
  proof: FiniteOperatorProof,
  head: FiniteDerivedOperatorHead,
  lexicalHead: FiniteTokenProof
): boolean => {
  if (!context.charge(proof.extent.quote.length * 2 + 8)) return false;
  const source = A.get(context.sourceProofs, head.proof - 1);
  if (O.isNone(source)) return false;
  const span = finiteOperatorLexicalSpan(head, source.value);
  if (O.isNone(span)) return false;
  return finiteOperatorSpanAgrees(source.value, proof.extent, span.value, lexicalHead.token.anchor);
};
const validateFiniteOperatorHead = (
  context: FiniteProofValidationContext,
  proof: FiniteOperatorProof,
  lexicalHead: FiniteTokenProof
): boolean => {
  if (proof.head.kind === "singleton")
    return proof.lexical.length === 1 && sourceAnchorEqual(lexicalHead.token.anchor, proof.extent);
  return validateFiniteDerivedOperatorHead(context, proof, proof.head, lexicalHead);
};
const validateFiniteOperatorTokens = (context: FiniteProofValidationContext, proof: FiniteOperatorProof): boolean => {
  for (const ref of proof.lexical) {
    const raw = context.resolve(ref);
    if (
      !O.exists(
        raw,
        (p) =>
          p.kind === "token" &&
          p.token.anchor.startChar >= proof.extent.startChar &&
          p.token.anchor.endChar <= proof.extent.endChar
      )
    )
      return false;
  }
  return true;
};
const finiteOperatorTransitionMatches = (
  context: FiniteProofValidationContext,
  proof: FiniteOperatorProof
): boolean => {
  for (const scope of context.proofs) {
    if (!context.charge(1)) return false;
    if (scope.kind === "scope" && scope.role === "transition") return sourceAnchorEqual(scope.extent, proof.extent);
  }
  return false;
};
const validateFiniteOperatorMode = (context: FiniteProofValidationContext, proof: FiniteOperatorProof): boolean => {
  if (proof.mode === "finite" && O.isNone(proof.subject)) return false;
  if (proof.mode === "qualified-transition") return finiteOperatorTransitionMatches(context, proof);
  return true;
};
const validateFiniteOperatorProof = (context: FiniteProofValidationContext, proof: FiniteOperatorProof): boolean => {
  if (proof.lexical.length === 0 || !A.some(proof.lexical, (ref) => ref.ordinal === proof.head.token.ordinal))
    return false;
  const lexicalHead = context.resolve(proof.head.token);
  if (O.isNone(lexicalHead) || lexicalHead.value.kind !== "token") return false;
  if (!validateFiniteOperatorHead(context, proof, lexicalHead.value)) return false;
  if (!validateFiniteOperatorTokens(context, proof)) return false;
  return validateFiniteOperatorMode(context, proof);
};

type FiniteOrderedArgumentsProof = Extract<ClaimFiniteSourceProof, { readonly kind: "ordered-arguments" }>;
const validateFiniteArgumentMember = (
  proof: FiniteOrderedArgumentsProof,
  part: Extract<ClaimArgumentCoverage, { readonly kind: "token" }>,
  target: ClaimFiniteSourceProof
): boolean => {
  if (part.role === "adposition") {
    return part.proof.ordinal === proof.adposition.ordinal;
  }
  if (part.role === "pp") {
    return part.proof.ordinal === proof.pp.ordinal;
  }
  if (part.role === "direct") {
    return part.proof.ordinal === proof.direct.ordinal;
  }
  if (part.role === "operator") {
    return part.proof.ordinal === proof.operator.ordinal;
  }
  return (
    target.kind === "token" &&
    (target.token.pos === "ADV" || HashSet.has(HashSet.make("not", "n't"), word(target.token)))
  );
};
const finiteArgumentPartSource = (
  context: FiniteProofValidationContext,
  part: ClaimArgumentCoverage,
  cursor: number
): boolean =>
  !(
    part.anchor.startChar !== cursor ||
    part.anchor.endChar <= cursor ||
    part.anchor.quote !== Str.slice(part.anchor.startChar, part.anchor.endChar)(context.claim.claimText)
  );
const validateFiniteArgumentPartProof = (
  context: FiniteProofValidationContext,
  proof: FiniteOrderedArgumentsProof,
  part: ClaimArgumentCoverage
): boolean => {
  if (part.kind === "gap") return Str.trim(part.anchor.quote) === "";
  const target = context.resolve(part.proof);
  if (O.isNone(target)) return false;
  return validateFiniteArgumentMember(proof, part, target.value);
};
const validateFiniteArgumentPartition = (
  context: FiniteProofValidationContext,
  proof: FiniteOrderedArgumentsProof
): boolean => {
  let cursor = proof.extent.startChar;
  for (const part of proof.coverage) {
    if (!context.charge(part.anchor.quote.length * 3 + 2)) return false;
    if (!finiteArgumentPartSource(context, part, cursor)) return false;
    cursor = part.anchor.endChar;
    if (!validateFiniteArgumentPartProof(context, proof, part)) return false;
  }
  return cursor === proof.extent.endChar;
};

const isFiniteHeadProofOption = (proof: O.Option<ClaimFiniteSourceProof>): proof is O.Some<FiniteHeadProof> =>
  O.isSome(proof) && proof.value.kind === "head";
const isFiniteOperatorProofOption = (proof: O.Option<ClaimFiniteSourceProof>): proof is O.Some<FiniteOperatorProof> =>
  O.isSome(proof) && proof.value.kind === "operator";
const isFiniteAdpositionProofOption = (proof: O.Option<ClaimFiniteSourceProof>): proof is O.Some<FiniteTokenProof> =>
  isFiniteTokenProofOption(proof) && proof.value.token.pos === "ADP";
const isFiniteDeterminerProofOption = (proof: O.Option<ClaimFiniteSourceProof>): proof is O.Some<FiniteTokenProof> =>
  isFiniteTokenProofOption(proof) && proof.value.token.pos === "DET";
const validateFiniteArgumentClosures = (
  context: FiniteProofValidationContext,
  proof: FiniteOrderedArgumentsProof,
  pp: FiniteHeadProof,
  direct: FiniteHeadProof
): boolean => {
  const ppClose = context.resolve(proof.ppEnd);
  const directClose = context.resolve(proof.directEnd);
  if (
    proof.ppEnd.ordinal !== pp.closure.ordinal ||
    proof.directEnd.ordinal !== direct.closure.ordinal ||
    !O.exists(ppClose, (p) => p.kind === "closure") ||
    !O.exists(directClose, (p) => p.kind === "closure")
  )
    return false;
  return true;
};
const finiteArgumentExtentMatches = (
  proof: FiniteOrderedArgumentsProof,
  renewal: FiniteTokenProof,
  operator: FiniteOperatorProof,
  direct: FiniteHeadProof
): boolean =>
  !(
    renewal.token.anchor.startChar !== direct.core.startChar ||
    proof.extent.startChar !== operator.extent.startChar ||
    proof.extent.endChar !== direct.core.endChar
  );
const finiteDerivedExtentMatches = (context: FiniteProofValidationContext, extent: TextAnchor): boolean =>
  context.charge(extent.quote.length + 4) &&
  extent.endChar <= context.claim.claimText.length &&
  extent.quote === Str.slice(extent.startChar, extent.endChar)(context.claim.claimText);

const validateFiniteOrderedArgumentsProof = (
  context: FiniteProofValidationContext,
  proof: FiniteOrderedArgumentsProof
): boolean => {
  if (!finiteDerivedExtentMatches(context, proof.extent)) return false;
  const pp = context.resolve(proof.pp);
  const direct = context.resolve(proof.direct);
  const adposition = context.resolve(proof.adposition);
  const renewal = context.resolve(proof.renewal);
  const operator = context.resolve(proof.operator);
  if (
    !isFiniteHeadProofOption(pp) ||
    !isFiniteHeadProofOption(direct) ||
    !isFiniteAdpositionProofOption(adposition) ||
    !isFiniteDeterminerProofOption(renewal) ||
    !isFiniteOperatorProofOption(operator)
  )
    return false;
  if (!validateFiniteArgumentClosures(context, proof, pp.value, direct.value)) return false;
  if (!finiteArgumentExtentMatches(proof, renewal.value, operator.value, direct.value)) return false;
  return validateFiniteArgumentPartition(context, proof);
};

const validateFiniteDescriptionProof = (
  context: FiniteProofValidationContext,
  proof: Extract<ClaimFiniteSourceProof, { readonly kind: "description" }>
): boolean => {
  if (!finiteDerivedExtentMatches(context, proof.extent)) return false;
  const { resolve } = context;
  const seed = resolve(proof.candidate);
  const operator = resolve(proof.operator);
  const intro = resolve(proof.introducer);
  if (
    !O.exists(seed, (p) => p.kind === "head") ||
    !O.exists(operator, (p) => p.kind === "operator") ||
    !O.exists(
      intro,
      (p) => p.kind === "token" && p.token.pos === "ADP" && HashSet.has(HashSet.make("of", "from"), word(p.token))
    )
  )
    return false;
  return true;
};

const validateFiniteSelectionProof = (
  context: FiniteProofValidationContext,
  proof: Extract<ClaimFiniteSourceProof, { readonly kind: "selection" }>
): boolean => {
  const { resolve } = context;
  if (proof.selector.length !== 2 || proof.branches.length < 2) return false;
  const one = O.flatMap(A.get(proof.selector, 0), resolve);
  const of = O.flatMap(A.get(proof.selector, 1), resolve);
  if (
    !O.exists(one, (p) => p.kind === "token" && word(p.token) === "one") ||
    !O.exists(of, (p) => p.kind === "token" && p.token.pos === "ADP" && word(p.token) === "of")
  )
    return false;
  for (const ref of proof.branches)
    if (
      !O.exists(
        resolve(ref),
        (p) =>
          p.kind === "head" && p.core.startChar >= proof.content.startChar && p.core.endChar <= proof.content.endChar
      )
    )
      return false;
  return true;
};

const validateFiniteOpaqueCoreProof = (
  context: FiniteProofValidationContext,
  proof: Extract<ClaimFiniteSourceProof, { readonly kind: "opaque-core" }>
): boolean => {
  const { resolve } = context;
  const selection = resolve(proof.selection);
  if (
    !sourceAnchorEqual(proof.core, proof.head) ||
    !O.exists(selection, (p) => p.kind === "selection" && sourceAnchorEqual(p.content, proof.core))
  )
    return false;
  return true;
};

type FiniteDerivedProof = Extract<
  ClaimFiniteSourceProof,
  { readonly kind: "head" | "operator" | "ordered-arguments" | "description" | "selection" | "opaque-core" }
>;
const validateFiniteDerivedProof = (context: FiniteProofValidationContext, proof: FiniteDerivedProof): boolean => {
  if (proof.kind === "head") {
    return validateFiniteHeadProof(context, proof);
  }
  if (proof.kind === "operator") {
    return validateFiniteOperatorProof(context, proof);
  }
  if (proof.kind === "ordered-arguments") {
    return validateFiniteOrderedArgumentsProof(context, proof);
  }
  if (proof.kind === "description") {
    return validateFiniteDescriptionProof(context, proof);
  }
  if (proof.kind === "selection") {
    return validateFiniteSelectionProof(context, proof);
  }
  return validateFiniteOpaqueCoreProof(context, proof);
};
type FiniteRawRecord = Extract<ClaimFiniteSourceProof, { readonly kind: "token" | "intrinsic-noun" | "attachment" }>;
const isFiniteRawRecord = (proof: ClaimFiniteSourceProof): proof is FiniteRawRecord =>
  proof.kind === "token" || proof.kind === "intrinsic-noun" || proof.kind === "attachment";
const validateFiniteRawRecord = (context: FiniteProofValidationContext, proof: FiniteRawRecord): boolean => {
  if (proof.kind === "attachment") {
    return true;
  }
  if (proof.kind === "token") {
    return validateFiniteTokenProof(context, proof);
  }
  return validateFiniteIntrinsicFact(context, proof);
};
const validateFiniteProofRecord = (
  context: FiniteProofValidationContext,
  proof: Exclude<ClaimFiniteSourceProof, { readonly kind: "scope" }>
): boolean => {
  if (isFiniteRawRecord(proof)) return validateFiniteRawRecord(context, proof);
  if (proof.kind === "boundary") {
    return validateFiniteBoundaryProof(context, proof);
  }
  if (proof.kind === "verbal-boundary") {
    return validateFiniteVerbalBoundaryProof(context, proof);
  }
  if (proof.kind === "citation-boundary") {
    return validateFiniteCitationBoundaryProof(context, proof);
  }
  if (proof.kind === "opening") {
    return validateFiniteOpeningProof(context, proof);
  }
  if (proof.kind === "closure") {
    return validateFiniteClosureProof(context, proof);
  }
  return validateFiniteDerivedProof(context, proof);
};

const reserveFiniteProofRegistry = (
  claim: PatentClaim,
  tokens: ReadonlyArray<ClaimLexicalToken>,
  proofs: ReadonlyArray<ClaimFiniteSourceProof>,
  charge: (amount: number) => boolean
): boolean => {
  let edges = 0;
  for (const proof of proofs) {
    if (!charge(1)) return false;
    edges += finiteProofReferenceCount(proof);
  }
  // Reserve lookup/member validation, actual graph nodes/edges and traversal
  // before allocating any reference list or graph structure.
  if (!charge(proofs.length * 8 + edges * 12 + claim.claimText.length * 3 + tokens.length * 4 + 4)) return false;
  if (!validTokens(claim.claimText, tokens)) return false;
  return true;
};

const validateFiniteProofEdges = (
  context: FiniteProofValidationContext,
  proof: ClaimFiniteSourceProof,
  graph: Graph.MutableDirectedGraph<ClaimFiniteSourceProof, ClaimSourceProofRef["slot"]>,
  nodes: ReadonlyArray<Graph.NodeIndex>
): boolean => {
  for (const ref of finiteProofReferences(proof)) {
    const target = context.resolve(ref);
    if (O.isNone(target) || target.value.rank >= proof.rank) return false;
    Graph.addEdge(
      graph,
      O.getOrThrow(A.get(nodes, proof.ordinal - 1)),
      O.getOrThrow(A.get(nodes, ref.ordinal - 1)),
      ref.slot
    );
  }
  return true;
};

const validateFiniteScopeProof = (
  context: FiniteProofValidationContext,
  proof: Extract<ClaimFiniteSourceProof, { readonly kind: "scope" }>
): boolean => {
  if (HashSet.has(context.scopes, proof.role) || !finiteScopeMatches(context.claim, proof, context.charge))
    return false;
  context.scopes = HashSet.add(context.scopes, proof.role);
  return true;
};
const validateFiniteRegistryMember = (
  context: FiniteProofValidationContext,
  proof: ClaimFiniteSourceProof,
  ordinal: number,
  graph: Graph.MutableDirectedGraph<ClaimFiniteSourceProof, ClaimSourceProofRef["slot"]>,
  nodes: ReadonlyArray<Graph.NodeIndex>
): boolean => {
  if (proof.ordinal !== ordinal || proof.rank !== finiteProofRank(proof)) return false;
  if (!validateFiniteProofEdges(context, proof, graph, nodes)) return false;
  if (proof.kind === "scope") return validateFiniteScopeProof(context, proof);
  return validateFiniteProofRecord(context, proof);
};

const originalInputMatches = (
  claim: PatentClaim,
  tokens: ReadonlyArray<ClaimLexicalToken>,
  input: ClaimLexicalEvidence,
  charge: (amount: number) => boolean
): boolean => {
  if (!charge(input.qualifiedText.length + claim.claimText.length + 4)) return false;
  return input.status === "aligned" && input.tokens === tokens && input.qualifiedText === claim.claimText;
};
const optionalOriginalInputMatches = (
  claim: PatentClaim,
  tokens: ReadonlyArray<ClaimLexicalToken>,
  input: O.Option<ClaimLexicalEvidence>,
  charge: (amount: number) => boolean
): boolean => O.isNone(input) || originalInputMatches(claim, tokens, input.value, charge);
const originalScopeAvailable = (
  input: O.Option<ClaimLexicalEvidence>,
  scopes: O.Option<ClaimOriginalQualifiedScopes>
): boolean => O.isNone(input) || O.isSome(scopes);
const validateFiniteRegistryMembers = (
  context: FiniteProofValidationContext,
  graph: Graph.MutableDirectedGraph<ClaimFiniteSourceProof, ClaimSourceProofRef["slot"]>,
  nodes: ReadonlyArray<Graph.NodeIndex>
): boolean => {
  for (let i = 0; i < context.proofs.length; i++) {
    const proof = O.getOrThrow(A.get(context.proofs, i));
    if (!validateFiniteRegistryMember(context, proof, i + 1, graph, nodes)) return false;
  }
  return true;
};
const validateFiniteProofRegistry = (
  claim: PatentClaim,
  tokens: ReadonlyArray<ClaimLexicalToken>,
  proofs: ReadonlyArray<ClaimFiniteSourceProof>,
  sourceProofs: ReadonlyArray<ClaimSourceProof>,
  charge: (amount: number) => boolean,
  originalInput: O.Option<ClaimLexicalEvidence> = O.none()
): boolean => {
  if (!optionalOriginalInputMatches(claim, tokens, originalInput, charge)) return false;
  if (!reserveFiniteProofRegistry(claim, tokens, proofs, charge)) return false;
  const graph = Graph.beginMutation(Graph.directed<ClaimFiniteSourceProof, ClaimSourceProofRef["slot"]>());
  const nodes = A.map(proofs, (proof) => Graph.addNode(graph, proof));
  const resolve = (ref: ClaimSourceProofRef): O.Option<ClaimFiniteSourceProof> =>
    O.filter(
      A.get(proofs, ref.ordinal - 1),
      (proof) => proof.ordinal === ref.ordinal && finiteProofSlot(proof) === ref.slot
    );
  // The extracted validator context is one new source-local allocation.
  if (!charge(1)) return false;
  const originalScopes = O.isSome(originalInput)
    ? originalQualifiedScopes(claim, charge)
    : O.none<ClaimOriginalQualifiedScopes>();
  if (!originalScopeAvailable(originalInput, originalScopes)) return false;
  const context: FiniteProofValidationContext = {
    claim,
    tokens,
    proofs,
    sourceProofs,
    charge,
    resolve,
    originalInput,
    originalScopes,
    scopes: HashSet.empty<"preamble" | "body" | "transition">(),
  };
  if (!validateFiniteRegistryMembers(context, graph, nodes)) return false;
  return HashSet.size(context.scopes) === 3 && Graph.isAcyclic(graph);
};

type FiniteSourceOperator = Extract<
  ClaimSourceProof,
  { readonly kind: "finite-pp" | "scalar-auxiliary" | "reduced-adjective" | "reduced-participle" }
>;
const isFiniteSourceOperator = (proof: ClaimSourceProof): proof is FiniteSourceOperator =>
  proof.kind === "finite-pp" ||
  proof.kind === "scalar-auxiliary" ||
  proof.kind === "reduced-adjective" ||
  proof.kind === "reduced-participle";
const finiteSourceOperatorSpan = (proof: FiniteSourceOperator): TextAnchor =>
  proof.kind === "finite-pp"
    ? proof.lexicalPredicate
    : proof.kind === "scalar-auxiliary"
      ? proof.participle
      : proof.operator;
const finiteSourceOperatorHead = (
  proof: FiniteSourceOperator,
  fields: { readonly token: ClaimSourceProofRef; readonly proof: number }
): ClaimOperatorHeadWitness =>
  proof.kind === "finite-pp"
    ? ClaimOperatorHeadWitness.cases["finite-pp"].make(fields)
    : proof.kind === "scalar-auxiliary"
      ? ClaimOperatorHeadWitness.cases.scalar.make(fields)
      : ClaimOperatorHeadWitness.cases.reduced.make(fields);

const noOpeningEvidence: ReadonlyArray<ClaimSourceProofRef> = [];
const finiteLexicalOpeningBoundary = (proof: ClaimFiniteSourceProof): boolean =>
  (proof.kind === "boundary" && (proof.mode === "finite" || proof.mode === "auxiliary")) ||
  (proof.kind === "verbal-boundary" && proof.mode !== "infinitive-introducer");

const isDescriptionNominal = (nominal: O.Option<ClaimNominalSpan>): nominal is O.Some<ClaimNominalSpan> =>
  O.isSome(nominal) &&
  nominal.value.determiner === "bare" &&
  nominal.value.role !== "explicit-name" &&
  nominal.value.role !== "quantified-introduction";
const privateCandidateSourceOrder = (
  left: ClaimPrivateBasisCandidate,
  right: ClaimPrivateBasisCandidate
): -1 | 0 | 1 => (left.core.startChar < right.core.startChar ? -1 : left.core.startChar > right.core.startChar ? 1 : 0);

const headSourcePositions = (
  start: O.Option<number>,
  end: O.Option<number>,
  scope: O.Option<ClaimSourceProofRef>
): boolean => O.isSome(start) && O.isSome(end) && O.isSome(scope) && start.value < end.value;
const finiteSourceOperatorMatches = (
  proof: ClaimSourceProof,
  predicate: ClaimPredicateSpan
): proof is FiniteSourceOperator =>
  isFiniteSourceOperator(proof) && sourceAnchorEqual(proof.operator, predicate.anchor);
const operatorWitnessAgrees = (previous: O.Option<ClaimOperatorHeadWitness>, next: ClaimOperatorHeadWitness): boolean =>
  O.isNone(previous) || previous.value.token.ordinal === next.token.ordinal;
const isAlignedLexicalInput = (
  input: O.Option<ClaimLexicalEvidence>
): input is O.Some<Extract<ClaimLexicalEvidence, { readonly status: "aligned" }>> =>
  O.isSome(input) && input.value.status === "aligned";
// Operational parser state owns one source and one shared reservation. It is not
// persisted domain data; emitted data is constructed through the schemas above.
class RoleCompiler {
  private remaining = 262_144;
  private quotes: ReadonlyArray<boolean> = [];
  private brackets = HashSet.empty<number>();
  private predicateIndexes = HashSet.empty<number>();
  private adjunctIndexes = HashSet.empty<number>();
  private names = HashSet.empty<number>();
  private predicates: Array<ClaimPredicateSpan> = [];
  private nominals: Array<ClaimNominalSpan> = [];
  private descriptionNominals: Array<ClaimNominalSpan> = [];
  private descriptionOperators = HashMap.empty<number, readonly [number, number]>();
  private readonly clauses: Array<ClaimClauseSpan> = [];
  private readonly proofs: Array<ClaimSourceProof> = [];
  private readonly certificates: Array<ClaimFiniteSourceProof> = [];
  private readonly candidateStates: Array<ClaimNominalCandidateState> = [];
  private privateCandidates: Array<ClaimPrivateBasisCandidate> = [];
  private readonly opaqueSelections: Array<ClaimOpaqueSelection> = [];
  private directActionStarts = HashMap.empty<number, number>();
  private supported = true;
  private firstAction = O.none<Extract<ClaimSourceProof, { readonly kind: "action" }>>();
  private previousActionObjectEnd = -1;
  private clauseStart = 0;
  private clauseKind: typeof ClaimClauseSpan.Type.kind = "main";
  private introducer = O.none<TextAnchor>();
  private readonly claim: PatentClaim;
  private readonly tokens: ReadonlyArray<ClaimLexicalToken>;
  private readonly originalInput: O.Option<ClaimLexicalEvidence>;
  private intrinsicFactsProduced = false;
  constructor(
    claim: PatentClaim,
    tokens: ReadonlyArray<ClaimLexicalToken>,
    originalInput: O.Option<ClaimLexicalEvidence> = O.none()
  ) {
    this.claim = claim;
    this.tokens = tokens;
    this.originalInput = originalInput;
    this.remaining =
      262_144 -
      O.getOrElse(
        O.map(O.filter(originalInput, ClaimLexicalEvidence.guards.aligned), (input) => input.lexicalWorkConsumed),
        () => 0
      );
  }
  private tokenCertificates: Array<ClaimSourceProofRef> = [];
  private scopeCertificates = HashMap.empty<"preamble" | "transition" | "body", ClaimSourceProofRef>();
  private boundaryCertificates = HashMap.empty<number, ClaimSourceProofRef>();
  private headCertificates = HashMap.empty<number, ClaimSourceProofRef>();
  private operatorCertificates = HashMap.empty<number, ClaimSourceProofRef>();
  private tokenPositions = HashMap.empty<number, number>();
  private endPositions = HashMap.empty<number, number>();
  private sourceFactsReady = false;
  private certificate = (
    slot: ClaimSourceProofRef["slot"],
    cost: number,
    build: (ordinal: ClaimSourceProofOrdinal) => ClaimFiniteSourceProof
  ): O.Option<ClaimSourceProofRef> => {
    if (!this.charge(cost + 4)) return O.none();
    const ordinal = ClaimSourceProofOrdinal.make(this.certificates.length + 1);
    this.certificates.push(build(ordinal));
    return O.some(ClaimSourceProofRef.make({ ordinal, slot }));
  };
  private rawToken = (index: number): O.Option<ClaimSourceProofRef> => A.get(this.tokenCertificates, index);
  private sourceScope = (span: TextAnchor): O.Option<ClaimSourceProofRef> => {
    if (!this.charge(3)) return O.none();
    for (const role of ["preamble", "body"] as const) {
      const reference = HashMap.get(this.scopeCertificates, role);
      const proof = O.flatMap(reference, (r) => A.get(this.certificates, r.ordinal - 1));
      if (
        O.exists(
          proof,
          (p) => p.kind === "scope" && span.startChar >= p.extent.startChar && span.endChar <= p.extent.endChar
        )
      )
        return reference;
    }
    return O.none();
  };
  private readSourceScopes = (
    preambleEnd: number,
    transitionStart: number,
    transitionEnd: number,
    bodyStart: number
  ): boolean => {
    const scopes = [
      ["preamble", 0, preambleEnd],
      ["transition", transitionStart, transitionEnd],
      ["body", bodyStart, this.claim.claimText.length],
    ] as const;
    for (const [role, start, end] of scopes) {
      const extent = anchor(this.claim.claimText, start, end);
      const proof = this.certificate("scope", 4, (ordinal) =>
        ClaimFiniteSourceProof.cases.scope.make({ ordinal, role, extent })
      );
      if (O.isNone(proof)) return false;
      this.scopeCertificates = HashMap.set(this.scopeCertificates, role, proof.value);
    }
    return true;
  };
  private readSourceTokens = (): boolean => {
    for (let index = 0; index < this.tokens.length; index++) {
      const token = O.getOrThrow(at(this.tokens, index));
      const proof = this.certificate("token", 8, (ordinal) =>
        ClaimFiniteSourceProof.cases.token.make({
          ordinal,
          tokenOrdinal: OriginalLexicalTokenOrdinal.make(index + 1),
          token,
        })
      );
      if (O.isNone(proof)) return false;
      this.tokenCertificates.push(proof.value);
      this.tokenPositions = HashMap.set(this.tokenPositions, token.anchor.startChar, index);
      this.endPositions = HashMap.set(this.endPositions, token.anchor.endChar, index + 1);
    }
    return true;
  };
  private readSourceFacts = (): boolean => {
    const text = this.claim.claimText;
    const preambleEnd = this.claim.preamble.length;
    const bodyStart = text.length - this.claim.body.length;
    const gapLength = Num.max(0, bodyStart - preambleEnd);
    // The resolver performs and reserves the envelope comparison once. On valid
    // disjoint fields these reservations retain the previous total plus 16.
    if (!this.charge(gapLength + this.tokens.length * 8 + 8)) return false;
    const transition = rawClaimTransitionScope(this.claim, this.charge);
    if (O.isNone(transition)) return false;
    if (
      !this.readSourceScopes(preambleEnd, transition.value.startChar, transition.value.endChar, bodyStart) ||
      !this.readSourceTokens()
    )
      return false;
    this.sourceFactsReady = true;
    return true;
  };
  private verbalBoundaryProof(
    mode: "auxiliary-complement" | "infinitive-complement" | "infinitive-introducer",
    governor: number,
    raw: ClaimSourceProofRef,
    scope: ClaimSourceProofRef
  ): O.Option<ClaimSourceProofRef> {
    const witness = this.rawToken(governor);
    if (O.isNone(witness)) return O.none();
    return this.certificate("boundary", 6, (ordinal) =>
      ClaimFiniteSourceProof.cases["verbal-boundary"].make({
        ordinal,
        mode,
        token: raw,
        governor: witness.value,
        scope,
      })
    );
  }
  private infinitiveIntroducerGovernor(index: number): number {
    const after = tagAt(this.tokens, index + 1) === "ADV" ? index + 2 : index + 1;
    const lexical = at(this.tokens, after);
    return O.exists(lexical, (t) => t.pos === "VERB" && O.exists(t.lemma, (lemma) => normalized(lemma) === word(t))) &&
      infinitiveBefore(this.tokens, after)
      ? after
      : -1;
  }
  private verbalComplementBoundary(
    index: number,
    token: ClaimLexicalToken,
    raw: ClaimSourceProofRef,
    scope: ClaimSourceProofRef
  ): O.Option<ClaimSourceProofRef> {
    const before = this.skipAdjuncts(index - 1, -1);
    if (this.remaining < 0) return O.none();
    const previous = at(this.tokens, before);
    if (O.exists(previous, (t) => t.pos === "AUX" || HashSet.has(auxiliaries, word(t))))
      return this.verbalBoundaryProof("auxiliary-complement", before, raw, scope);
    if (
      O.exists(previous, (t) => t.pos === "PART" && word(t) === "to") &&
      infinitiveBefore(this.tokens, index) &&
      O.exists(token.lemma, (lemma) => normalized(lemma) === word(token))
    )
      return this.verbalBoundaryProof("infinitive-complement", before, raw, scope);
    return O.none();
  }
  private rawVerbalBoundary = (
    index: number,
    token: ClaimLexicalToken,
    raw: ClaimSourceProofRef,
    scope: ClaimSourceProofRef
  ): O.Option<ClaimSourceProofRef> => {
    if (!this.charge(4)) return O.none();
    if (token.pos === "PART" && word(token) === "to") {
      const governor = this.infinitiveIntroducerGovernor(index);
      return governor < 0 ? O.none() : this.verbalBoundaryProof("infinitive-introducer", governor, raw, scope);
    }
    return token.pos === "VERB" ? this.verbalComplementBoundary(index, token, raw, scope) : O.none();
  };
  private numericReferenceLabel(index: number): boolean {
    return (
      wordAt(this.tokens, index) === "(" &&
      tagAt(this.tokens, index + 1) === "NUM" &&
      wordAt(this.tokens, index + 2) === ")"
    );
  }
  private finishRawBoundary(
    index: number,
    raw: ClaimSourceProofRef,
    scope: ClaimSourceProofRef,
    mode: import("./ClaimClauseRole.model.ts").ClaimHeadBoundary,
    successor: O.Option<ClaimSourceProofRef> = O.none()
  ): O.Option<ClaimSourceProofRef> {
    const proof = this.certificate("boundary", 6, (ordinal) =>
      ClaimFiniteSourceProof.cases.boundary.make({ ordinal, mode, token: raw, scope, successor })
    );
    if (O.isSome(proof)) this.boundaryCertificates = HashMap.set(this.boundaryCertificates, index, proof.value);
    return proof;
  }
  private reducedRawBoundary(index: number, token: ClaimLexicalToken): boolean {
    return (
      (token.pos === "ADJ" || this.regularParticiple(index)) &&
      (tagAt(this.tokens, index + 1) === "ADP" || hasInfinitiveComplement(this.tokens, index))
    );
  }
  private selectRawBoundary(
    index: number,
    token: ClaimLexicalToken,
    raw: ClaimSourceProofRef,
    scope: ClaimSourceProofRef,
    numericLabel: boolean
  ): O.Option<ClaimSourceProofRef> {
    const spelling = word(token);
    if (numericLabel) return this.finishRawBoundary(index, raw, scope, "reference-label", this.rawToken(index + 2));
    if (
      HashSet.has(HashSet.make("comprising", "including", "comprises", "includes", "having"), spelling) &&
      wordAt(this.tokens, index + 1) === ":"
    )
      return this.finishRawBoundary(index, raw, scope, "declaration", this.rawToken(index + 1));
    if (token.pos === "AUX" || HashSet.has(auxiliaries, spelling))
      return this.finishRawBoundary(index, raw, scope, "auxiliary");
    if (finiteVerbBoundary(this.tokens, token, index)) return this.finishRawBoundary(index, raw, scope, "finite");
    if (this.reducedRawBoundary(index, token))
      return this.finishRawBoundary(index, raw, scope, "reduced", this.rawToken(index + 1));
    return this.selectRawBoundaryTail(index, token, raw, scope, spelling);
  }
  private rawPreposition(index: number, token: ClaimLexicalToken, spelling: string): boolean {
    return (
      token.pos === "ADP" ||
      (spelling === "to" && token.pos === "PART" && HashSet.has(articleWords, wordAt(this.tokens, index + 1)))
    );
  }
  private adjunctRawBoundary(
    index: number,
    raw: ClaimSourceProofRef,
    scope: ClaimSourceProofRef
  ): O.Option<ClaimSourceProofRef> {
    const after = this.skipAdjuncts(index, 1);
    if (this.remaining < 0 || !this.charge((after - index) * 4 + 8) || !rawFunctionalBoundary(this.tokens, after))
      return O.none();
    return this.finishRawBoundary(index, raw, scope, "adjunct", this.rawToken(after));
  }
  private relativeRawBoundary(
    index: number,
    raw: ClaimSourceProofRef,
    scope: ClaimSourceProofRef
  ): O.Option<ClaimSourceProofRef> {
    const after = this.skipAdjuncts(index + 1, 1);
    if (
      this.remaining < 0 ||
      !(
        HashSet.has(HashSet.make("VERB", "AUX"), tagAt(this.tokens, after)) ||
        inflectedNounPredicate(this.tokens, after)
      )
    )
      return O.none();
    return this.finishRawBoundary(index, raw, scope, "relative", this.rawToken(after));
  }
  private separatorRawBoundary(
    index: number,
    token: ClaimLexicalToken,
    raw: ClaimSourceProofRef,
    scope: ClaimSourceProofRef,
    spelling: string
  ): O.Option<ClaimSourceProofRef> {
    if (HashSet.has(HashSet.make(",", ";", ":", "and", "or", "and/or"), spelling))
      return this.finishRawBoundary(index, raw, scope, "separator");
    if (spelling === "." && token.pos === "PUNCT") return this.finishRawBoundary(index, raw, scope, "terminal");
    return O.none();
  }
  private selectRawBoundaryTail(
    index: number,
    token: ClaimLexicalToken,
    raw: ClaimSourceProofRef,
    scope: ClaimSourceProofRef,
    spelling: string
  ): O.Option<ClaimSourceProofRef> {
    if (this.adjunctSlot(index)) return this.adjunctRawBoundary(index, raw, scope);
    if (HashSet.has(HashSet.make("that", "which"), spelling)) return this.relativeRawBoundary(index, raw, scope);
    if (token.pos === "DET" || HashSet.has(articleWords, spelling))
      return this.finishRawBoundary(index, raw, scope, "determiner");
    if (this.rawPreposition(index, token, spelling)) return this.finishRawBoundary(index, raw, scope, "preposition");
    return this.separatorRawBoundary(index, token, raw, scope, spelling);
  }
  private rawBoundaryBlocked(index: number, numericLabel: boolean): boolean {
    return this.quoted(index) || (this.protected(index) && !numericLabel);
  }
  private rawBoundary = (index: number): O.Option<ClaimSourceProofRef> => {
    if (!this.charge(4)) return O.none();
    const cached = HashMap.get(this.boundaryCertificates, index);
    if (O.isSome(cached)) return cached;
    const token = at(this.tokens, index);
    const numericLabel = this.numericReferenceLabel(index);
    if (O.isNone(token) || this.rawBoundaryBlocked(index, numericLabel)) return O.none();
    const raw = this.rawToken(index);
    const scope = this.sourceScope(token.value.anchor);
    if (O.isNone(raw) || O.isNone(scope)) return O.none();
    const verbal = this.rawVerbalBoundary(index, token.value, raw.value, scope.value);
    if (O.isSome(verbal)) {
      this.boundaryCertificates = HashMap.set(this.boundaryCertificates, index, verbal.value);
      return verbal;
    }
    if (this.remaining < 0) return O.none();
    return this.selectRawBoundary(index, token.value, raw.value, scope.value, numericLabel);
  };
  private issueOpening = (
    mode: import("./ClaimClauseRole.model.ts").ClaimHeadOpening,
    evidence: ReadonlyArray<ClaimSourceProofRef>,
    core: TextAnchor,
    scope: ClaimSourceProofRef
  ): O.Option<ClaimSourceProofRef> => {
    if (evidence.length === 0) return O.none();
    return this.certificate("opening", evidence.length + 4, (ordinal) =>
      ClaimFiniteSourceProof.cases.opening.make({ ordinal, mode, coreStart: core.startChar, scope, evidence })
    );
  };
  private lexicalOpeningEvidence = (start: number): ReadonlyArray<ClaimSourceProofRef> => {
    const lexical = this.skipAdjuncts(start - 1, -1);
    if (this.remaining < 0) return noOpeningEvidence;
    const before = this.rawBoundary(lexical);
    const proof = O.flatMap(before, (r) => A.get(this.certificates, r.ordinal - 1));
    if (!O.exists(proof, finiteLexicalOpeningBoundary)) return noOpeningEvidence;
    if (!this.charge(start - lexical + 2)) return noOpeningEvidence;
    return [
      ...O.toArray(before),
      ...(lexical + 1 < start ? A.map(A.range(lexical + 1, start - 1), (i) => O.getOrThrow(this.rawToken(i))) : []),
    ];
  };
  private contextualOpening = (
    start: number,
    core: TextAnchor,
    scope: ClaimSourceProofRef
  ): O.Option<ClaimSourceProofRef> => {
    const source = O.getOrThrow(A.get(this.certificates, scope.ordinal - 1));
    if (source.kind === "scope" && core.startChar === source.extent.startChar)
      return this.issueOpening("qualified-start", [scope], core, scope);
    if (tagAt(this.tokens, start - 1) === "ADP")
      return this.issueOpening("preposition-object", O.toArray(this.rawToken(start - 1)), core, scope);
    if (
      HashSet.has(connectors, wordAt(this.tokens, start - 1)) ||
      HashSet.has(HashSet.make(",", ";"), wordAt(this.tokens, start - 1))
    )
      return this.issueOpening("list-item", O.toArray(this.rawBoundary(start - 1)), core, scope);
    return this.issueOpening("lexical-object", this.lexicalOpeningEvidence(start), core, scope);
  };
  private independentOpening = (
    start: number,
    core: TextAnchor,
    scope: ClaimSourceProofRef
  ): O.Option<ClaimSourceProofRef> => {
    if (!this.charge(8)) return O.none();
    const token = O.getOrThrow(at(this.tokens, start));
    const raw = O.getOrThrow(this.rawToken(start));
    const quantity = quantityDeterminer(this.tokens, start);
    if (O.isSome(quantity))
      return this.issueOpening(
        "quantity",
        A.map(A.range(start, start + quantity.value[1] - 1), (i) => O.getOrThrow(this.rawToken(i))),
        core,
        scope
      );
    if (HashSet.has(HashSet.make("a", "an", "the", "said", "each", "this", "these", "those"), word(token)))
      return this.issueOpening("determiner", [raw], core, scope);
    if (token.pos === "NUM") return this.issueOpening("unknown-number", [raw], core, scope);
    if (HashSet.has(HashSet.make("its", "their"), word(token)))
      return this.issueOpening("possessive", [raw], core, scope);
    return this.contextualOpening(start, core, scope);
  };
  private intrinsicInputAt = (index: number): boolean => {
    if (!this.charge(4)) return false;
    const token = at(this.tokens, index);
    const original = this.originalInput;
    if (
      O.isNone(token) ||
      O.isNone(original) ||
      original.value.status !== "aligned" ||
      original.value.tokens !== this.tokens ||
      this.protected(index)
    )
      return false;
    if (!this.charge(token.value.anchor.quote.length * 5 + 12)) return false;
    return intrinsicInputNoun(token.value);
  };
  private intrinsicOpeningEligible = (start: number, end: number, width: number): boolean =>
    this.charge(8) &&
    width === 1 &&
    HashSet.has(HashSet.make("a", "an"), wordAt(this.tokens, start)) &&
    end > start + 2 &&
    this.intrinsicInputAt(end - 1);
  private intrinsicModifierAt = (index: number): number => {
    if (!this.charge(4)) return -1;
    const token = O.getOrThrow(at(this.tokens, index));
    if (
      this.protected(index) ||
      !this.charge(
        token.anchor.quote.length * 4 +
          O.getOrElse(
            O.map(token.lemma, (lemma) => lemma.length),
            () => 0
          ) *
            4 +
          6
      )
    )
      return -1;
    if (!intrinsicModifierAllowed(this.tokens, index)) return -1;
    return rawRegularParticiple(token) ? 1 : 0;
  };
  private intrinsicModifierRange = (start: number, end: number, width: number): number => {
    let nonfinite = 0;
    for (let i = start + width; i < end - 1; i++) {
      const result = this.intrinsicModifierAt(i);
      if (result < 0) return -1;
      if (result > 0) nonfinite = 1;
    }
    return nonfinite;
  };
  private intrinsicComplete = (start: number, end: number, width: number): boolean => {
    if (!this.intrinsicOpeningEligible(start, end, width)) return false;
    const nonfinite = this.intrinsicModifierRange(start, end, width);
    if (nonfinite < 0) return false;
    const after = advanceFiniteAdjuncts(this.tokens, end, this.charge);
    return nonfinite > 0 && after >= end && O.exists(at(this.tokens, after), finiteAuxiliaryBoundary);
  };
  private intrinsicRawAuxiliary = (end: number): O.Option<ClaimSourceProofRef> => {
    const after = advanceFiniteAdjuncts(this.tokens, end, this.charge);
    const auxiliary = this.rawBoundary(after);
    const rawAuxiliary = O.flatMap(auxiliary, (ref) => A.get(this.certificates, ref.ordinal - 1));
    return O.isSome(auxiliary) &&
      O.exists(rawAuxiliary, (proof) => proof.kind === "boundary" && proof.mode === "auxiliary")
      ? auxiliary
      : O.none();
  };
  private collectIntrinsicModifiers = (
    start: number,
    end: number,
    ordered: Array<ClaimSourceProofRef>,
    nonfinite: Array<ClaimSourceProofRef>
  ): void => {
    for (let i = start + 1; i < end - 1; i++) {
      const ref = O.getOrThrow(this.rawToken(i));
      ordered.push(ref);
      const rawToken = at(this.tokens, i).pipe(O.getOrThrow);
      if (rawRegularParticiple(rawToken)) nonfinite.push(ref);
    }
  };
  private intrinsicTerminalEvidence = (
    start: number,
    end: number,
    closure: ClaimSourceProofRef
  ): O.Option<ClaimHeadTerminalEvidence> => {
    if (!this.intrinsicComplete(start, end, 1) || !this.charge(1)) return O.none();
    const closureProof = A.get(this.certificates, closure.ordinal - 1);
    if (!O.exists(closureProof, (proof) => proof.kind === "closure" && O.isSome(proof.boundary))) return O.none();
    const input = this.originalInput;
    if (!isAlignedLexicalInput(input)) return O.none();
    const terminal = O.getOrThrow(at(this.tokens, end - 1));
    const auxiliary = this.intrinsicRawAuxiliary(end);
    if (O.isNone(auxiliary)) return O.none();
    if (
      !this.charge(
        (end - start) * 8 +
          input.value.sourceKey.length +
          input.value.provider.length +
          input.value.assetDigest.length +
          24
      )
    )
      return O.none();
    const orderedModifiers: Array<ClaimSourceProofRef> = [];
    const nonfiniteModifiers: Array<ClaimSourceProofRef> = [];
    this.collectIntrinsicModifiers(start, end, orderedModifiers, nonfiniteModifiers);
    if (!A.isArrayNonEmpty(nonfiniteModifiers)) return O.none();
    const source = ClaimLexicalSourceIdentity.make({
      sourceKey: input.value.sourceKey,
      sourceOrdinal: input.value.sourceOrdinal,
      provider: input.value.provider,
      assetDigest: input.value.assetDigest,
    });
    const fact = this.certificate("intrinsic-noun", terminal.anchor.quote.length * 2 + 16, (ordinal) =>
      ClaimFiniteSourceProof.cases["intrinsic-noun"].make({
        ordinal,
        source,
        originalTokenDataOrdinal: OriginalLexicalTokenOrdinal.make(end),
        anchor: terminal.anchor,
        rawForm: terminal.anchor.quote,
      })
    );
    if (O.isNone(fact)) return O.none();
    this.intrinsicFactsProduced = true;
    return O.some(
      ClaimHeadTerminalEvidence.cases["intrinsic-noun-terminal"].make({
        intrinsicNoun: fact.value,
        rawAuxiliary: auxiliary.value,
        nonfiniteModifiers,
        orderedModifiers,
      })
    );
  };
  private certifyHeadClosure = (
    nominal: ClaimNominalSpan,
    start: number,
    end: number,
    scope: ClaimSourceProofRef
  ): O.Option<ClaimSourceProofRef> => {
    const scopeProof = O.getOrThrow(A.get(this.certificates, scope.ordinal - 1));
    if (scopeProof.kind !== "scope") return O.none();
    const atEnd = nominal.anchor.endChar === scopeProof.extent.endChar;
    const boundary = atEnd ? O.none<ClaimSourceProofRef>() : this.rawBoundary(end);
    if (!atEnd && O.isNone(boundary)) return O.none();
    const gapEnd = atEnd ? scopeProof.extent.endChar : O.getOrThrow(at(this.tokens, end)).anchor.startChar;
    if (!this.charge(gapEnd - nominal.anchor.endChar + end - start + 4)) return O.none();
    const gapText = Str.slice(nominal.anchor.endChar, gapEnd)(this.claim.claimText);
    if (Str.trim(gapText) !== "") return O.none();
    const gap =
      gapEnd > nominal.anchor.endChar ? O.some(anchor(this.claim.claimText, nominal.anchor.endChar, gapEnd)) : O.none();
    const closure = this.certificate("closure", 6, (ordinal) =>
      ClaimFiniteSourceProof.cases.closure.make({ ordinal, coreEnd: nominal.anchor.endChar, scope, boundary, gap })
    );
    return closure;
  };
  private collectHeadTokens = (
    nominal: ClaimNominalSpan,
    start: number,
    end: number,
    tokens: Array<ClaimSourceProofRef>
  ): O.Option<ClaimSourceProofRef> => {
    let terminal = O.none<ClaimSourceProofRef>();
    for (let i = start; i < end; i++) {
      const token = O.getOrThrow(at(this.tokens, i));
      const raw = O.getOrThrow(this.rawToken(i));
      tokens.push(raw);
      if (
        HashSet.has(HashSet.make("NOUN", "PROPN", "PRON"), token.pos) &&
        token.anchor.startChar >= nominal.head.startChar
      )
        terminal = O.some(raw);
    }
    return terminal;
  };
  private rememberHead = (start: number, proof: O.Option<ClaimSourceProofRef>): O.Option<ClaimSourceProofRef> => {
    if (O.isSome(proof)) this.headCertificates = HashMap.set(this.headCertificates, start, proof.value);
    return proof;
  };
  private certifyHeadRecord = (
    nominal: ClaimNominalSpan,
    terminal: O.Option<ClaimSourceProofRef>,
    opening: ClaimSourceProofRef,
    closure: ClaimSourceProofRef,
    tokens: ReadonlyArray<ClaimSourceProofRef>,
    terminalEvidence: ClaimHeadTerminalEvidence
  ): O.Option<ClaimSourceProofRef> => {
    if (O.isNone(terminal)) return O.none();
    const lexical = terminal.value;
    const proof = this.certificate("core", tokens.length + 8, (ordinal) =>
      ClaimFiniteSourceProof.cases.head.make({
        ordinal,
        core: nominal.anchor,
        head: nominal.head,
        terminal: lexical,
        opening,
        closure,
        tokens,
        terminalEvidence,
      })
    );
    return this.rememberHead(nominal.anchor.startChar, proof);
  };
  private certifyHead = (nominal: ClaimNominalSpan): O.Option<ClaimSourceProofRef> => {
    if (!this.charge(6)) return O.none();
    const cached = HashMap.get(this.headCertificates, nominal.anchor.startChar);
    if (O.isSome(cached)) return cached;
    const start = HashMap.get(this.tokenPositions, nominal.anchor.startChar);
    const end = HashMap.get(this.endPositions, nominal.anchor.endChar);
    const scope = this.sourceScope(nominal.anchor);
    if (!headSourcePositions(start, end, scope)) return O.none();
    const first = O.getOrThrow(start);
    const last = O.getOrThrow(end);
    const source = O.getOrThrow(scope);
    // The complete candidate must independently reach a positive raw boundary;
    // neither an operator reservation nor its successful/failed result is used.
    const opening = this.independentOpening(first, nominal.anchor, source);
    if (O.isNone(opening)) return O.none();
    const closure = this.certifyHeadClosure(nominal, first, last, source);
    if (O.isNone(closure)) return O.none();
    const tokens: Array<ClaimSourceProofRef> = [];
    let terminal = this.collectHeadTokens(nominal, first, last, tokens);
    let terminalEvidence: ClaimHeadTerminalEvidence = ClaimHeadTerminalEvidence.cases["lexical-terminal"].make({});
    if (O.isNone(terminal)) {
      const intrinsic = this.intrinsicTerminalEvidence(first, last, closure.value);
      if (O.isNone(intrinsic)) return O.none();
      terminalEvidence = intrinsic.value;
      terminal = this.rawToken(last - 1);
    }
    return this.certifyHeadRecord(nominal, terminal, opening.value, closure.value, tokens, terminalEvidence);
  };
  private subjectGapAllowed = (end: number, start: number): boolean => {
    for (let i = end; i < start; i++) {
      if (
        wordAt(this.tokens, i) === "(" &&
        tagAt(this.tokens, i + 1) === "NUM" &&
        wordAt(this.tokens, i + 2) === ")" &&
        i + 2 < start
      ) {
        i += 2;
        continue;
      }
      if (!this.adjunctSlot(i) && !HashSet.has(HashSet.make("that", "which"), wordAt(this.tokens, i))) return false;
    }
    return true;
  };
  private seedSubject = (predicate: ClaimPredicateSpan): O.Option<ClaimSourceProofRef> => {
    if (!this.charge(this.nominals.length + 2)) return O.none();
    const candidate = A.findLast(this.nominals, (n) => n.anchor.endChar <= predicate.anchor.startChar);
    if (O.isNone(candidate)) return O.none();
    const end = HashMap.get(this.endPositions, candidate.value.anchor.endChar);
    const start = HashMap.get(this.tokenPositions, predicate.anchor.startChar);
    if (O.isNone(end) || O.isNone(start) || !this.charge(start.value - end.value + 1)) return O.none();
    if (!this.subjectGapAllowed(end.value, start.value)) return O.none();
    return HashMap.get(this.headCertificates, candidate.value.anchor.startChar);
  };
  private sourceOperatorHead = (
    proof: FiniteSourceOperator,
    proofOrdinal: number
  ): O.Option<ClaimOperatorHeadWitness> => {
    const span = finiteSourceOperatorSpan(proof);
    const index = HashMap.get(this.tokenPositions, span.startChar);
    const token = O.flatMap(index, (j) => at(this.tokens, j));
    const raw = O.flatMap(index, this.rawToken);
    if (O.isNone(token) || O.isNone(raw) || !sourceAnchorEqual(token.value.anchor, span)) return O.none();
    const fields = { token: raw.value, proof: proofOrdinal };
    return O.some(finiteSourceOperatorHead(proof, fields));
  };
  private fallbackOperatorHead = (
    witness: O.Option<ClaimOperatorHeadWitness>,
    start: number,
    end: number
  ): O.Option<ClaimOperatorHeadWitness> => {
    if (O.isSome(witness)) return witness;
    return end === start + 1
      ? O.map(this.rawToken(start), (token) => ClaimOperatorHeadWitness.cases.singleton.make({ token }))
      : O.none();
  };
  private operatorHead = (
    predicate: ClaimPredicateSpan,
    start: number,
    end: number
  ): O.Option<ClaimOperatorHeadWitness> => {
    if (!this.charge(this.proofs.length * 3 + 5)) return O.none();
    let witness = O.none<ClaimOperatorHeadWitness>();
    for (let i = 0; i < this.proofs.length; i++) {
      const proof = O.getOrThrow(A.get(this.proofs, i));
      if (!finiteSourceOperatorMatches(proof, predicate)) continue;
      const next = this.sourceOperatorHead(proof, i + 1);
      if (O.isNone(next)) return O.none();
      if (!operatorWitnessAgrees(witness, next.value)) return O.none();
      witness = next;
    }
    return this.fallbackOperatorHead(witness, start, end);
  };
  private gerundOperatorLicense = (start: number): import("./ClaimClauseRole.model.ts").ClaimOperatorLicense =>
    gerundPosition(this.tokens, start)
      ? "event"
      : O.isSome(this.actionGovernor(start))
        ? "first-action"
        : "continued-action";
  private operatorLicense = (
    predicate: ClaimPredicateSpan,
    start: number
  ): import("./ClaimClauseRole.model.ts").ClaimOperatorLicense => {
    if (predicate.kind === "finite" || predicate.kind === "possession") return "finite";
    if (predicate.kind === "infinitive") return "infinitive";
    if (predicate.kind === "gerund") return this.gerundOperatorLicense(start);
    if (predicate.kind === "adjectival") return "reduced";
    return "auxiliary";
  };
  private continuedOperatorLicense = (
    mode: import("./ClaimClauseRole.model.ts").ClaimOperatorLicense,
    subject: O.Option<ClaimSourceProofRef>,
    start: number
  ): import("./ClaimClauseRole.model.ts").ClaimOperatorLicense | false => {
    if (mode !== "finite" || O.isSome(subject)) return mode;
    return this.inheritedPredicate(start) ? "continued-finite" : false;
  };
  private isQualifiedTransitionOperator = (predicate: ClaimPredicateSpan): boolean => {
    const transition = HashMap.get(this.scopeCertificates, "transition");
    const transitionProof = O.flatMap(transition, (r) => A.get(this.certificates, r.ordinal - 1));
    return O.exists(
      transitionProof,
      (p) =>
        p.kind === "scope" &&
        p.extent.startChar === predicate.anchor.startChar &&
        p.extent.endChar === predicate.anchor.endChar
    );
  };
  private operatorRangeReserved = (start: O.Option<number>, end: O.Option<number>): boolean =>
    O.isSome(start) && O.isSome(end) && this.charge(end.value - start.value + 8);
  private rememberOperator = (start: number, proof: O.Option<ClaimSourceProofRef>): O.Option<ClaimSourceProofRef> => {
    if (O.isSome(proof)) this.operatorCertificates = HashMap.set(this.operatorCertificates, start, proof.value);
    return proof;
  };
  private certifyOperator = (predicate: ClaimPredicateSpan): O.Option<ClaimSourceProofRef> => {
    if (!this.charge(5)) return O.none();
    const start = HashMap.get(this.tokenPositions, predicate.anchor.startChar);
    const end = HashMap.get(this.endPositions, predicate.anchor.endChar);
    if (!this.operatorRangeReserved(start, end)) return O.none();
    const first = O.getOrThrow(start);
    const last = O.getOrThrow(end);
    let mode = this.operatorLicense(predicate, first);
    const subject =
      mode === "finite" || mode === "auxiliary" ? this.seedSubject(predicate) : O.none<ClaimSourceProofRef>();
    // The qualified transition is the one positive source exception to a local subject.
    if (this.isQualifiedTransitionOperator(predicate)) mode = "qualified-transition";
    const completedMode = this.continuedOperatorLicense(mode, subject, first);
    if (completedMode === false) return O.none();
    const lexical = A.map(A.range(first, last - 1), (i) => O.getOrThrow(this.rawToken(i)));
    const position = this.rawToken(first - 1);
    const head = this.operatorHead(predicate, first, last);
    if (O.isNone(head)) return O.none();
    const headRole = predicate.kind === "auxiliary-head" ? "auxiliary" : "predicate";
    const proof = this.certificate("operator", lexical.length + 6, (ordinal) =>
      ClaimFiniteSourceProof.cases.operator.make({
        ordinal,
        mode: completedMode,
        extent: predicate.anchor,
        head: head.value,
        headRole,
        lexical,
        subject,
        position,
      })
    );
    return this.rememberOperator(predicate.anchor.startChar, proof);
  };
  private appendArgumentToken = (
    coverage: Array<ClaimArgumentCoverage>,
    token: ClaimLexicalToken,
    role: Extract<ClaimArgumentCoverage, { readonly kind: "token" }>["role"],
    proof: ClaimSourceProofRef
  ): boolean => {
    coverage.push(ClaimArgumentCoverage.cases.token.make({ anchor: token.anchor, role, proof }));
    return true;
  };
  private appendOrderedToken = (
    coverage: Array<ClaimArgumentCoverage>,
    index: number,
    token: ClaimLexicalToken,
    operatorEnd: number,
    operator: ClaimSourceProofRef,
    adposition: number,
    pp: FiniteHeadProof,
    ppRef: O.Option<ClaimSourceProofRef>,
    direct: FiniteHeadProof,
    directRef: O.Option<ClaimSourceProofRef>
  ): boolean => {
    if (index < operatorEnd) return this.appendArgumentToken(coverage, token, "operator", operator);
    if (index === adposition)
      return this.appendArgumentToken(coverage, token, "adposition", O.getOrThrow(this.rawToken(index)));
    if (token.anchor.startChar >= direct.core.startChar)
      return this.appendArgumentToken(coverage, token, "direct", O.getOrThrow(directRef));
    if (token.anchor.startChar >= pp.core.startChar)
      return this.appendArgumentToken(coverage, token, "pp", O.getOrThrow(ppRef));
    if (!this.adjunctSlot(index)) return false;
    return this.appendArgumentToken(coverage, token, "adjunct", O.getOrThrow(this.rawToken(index)));
  };
  private appendOrderedCoverage = (
    coverage: Array<ClaimArgumentCoverage>,
    first: number,
    last: number,
    cursor: number,
    operatorEnd: number,
    operator: ClaimSourceProofRef,
    adposition: number,
    pp: FiniteHeadProof,
    ppRef: O.Option<ClaimSourceProofRef>,
    direct: FiniteHeadProof,
    directRef: O.Option<ClaimSourceProofRef>
  ): boolean => {
    for (let index = first; index < last; index++) {
      const token = O.getOrThrow(at(this.tokens, index));
      if (token.anchor.startChar > cursor)
        coverage.push(
          ClaimArgumentCoverage.cases.gap.make({ anchor: anchor(this.claim.claimText, cursor, token.anchor.startChar) })
        );
      if (
        !this.appendOrderedToken(
          coverage,
          index,
          token,
          operatorEnd,
          operator,
          adposition,
          pp,
          ppRef,
          direct,
          directRef
        )
      )
        return false;
      cursor = token.anchor.endChar;
    }
    return true;
  };
  private certifyArgumentCoverage = (
    predicate: ClaimPredicateSpan,
    operatorEnd: number,
    operator: ClaimSourceProofRef,
    adposition: number,
    pp: FiniteHeadProof,
    ppRef: O.Option<ClaimSourceProofRef>,
    direct: FiniteHeadProof,
    directRef: O.Option<ClaimSourceProofRef>,
    directStart: number
  ): boolean => {
    const first = HashMap.get(this.tokenPositions, predicate.anchor.startChar);
    const last = HashMap.get(this.endPositions, direct.core.endChar);
    if (O.isNone(first) || O.isNone(last)) return false;
    const length = direct.core.endChar - predicate.anchor.startChar;
    if (!this.charge(length * 2 + (last.value - first.value) * 12 + 8)) return false;
    const coverage: Array<ClaimArgumentCoverage> = [];
    if (
      !this.appendOrderedCoverage(
        coverage,
        first.value,
        last.value,
        predicate.anchor.startChar,
        operatorEnd,
        operator,
        adposition,
        pp,
        ppRef,
        direct,
        directRef
      )
    )
      return false;
    const extent = anchor(this.claim.claimText, predicate.anchor.startChar, direct.core.endChar);
    return O.isSome(
      this.certificate("argument", coverage.length + 12, (ordinal) =>
        ClaimFiniteSourceProof.cases["ordered-arguments"].make({
          ordinal,
          extent,
          operator,
          adposition: O.getOrThrow(this.rawToken(adposition)),
          pp: O.getOrThrow(ppRef),
          ppEnd: pp.closure,
          renewal: O.getOrThrow(this.rawToken(directStart)),
          direct: O.getOrThrow(directRef),
          directEnd: direct.closure,
          coverage,
        })
      )
    );
  };
  private orderedDirectArgument = (
    predicate: ClaimPredicateSpan,
    operatorEnd: number,
    operator: ClaimSourceProofRef,
    adposition: number,
    pp: FiniteHeadProof,
    ppRef: O.Option<ClaimSourceProofRef>
  ): boolean => {
    const directStart = HashMap.get(this.endPositions, pp.core.endChar);
    if (O.isNone(directStart) || tagAt(this.tokens, directStart.value) !== "DET") return true;
    const directToken = O.getOrThrow(at(this.tokens, directStart.value));
    const directRef = HashMap.get(this.headCertificates, directToken.anchor.startChar);
    const direct = O.flatMap(directRef, (r) => A.get(this.certificates, r.ordinal - 1));
    if (!isFiniteHeadProofOption(direct)) return true;
    return this.certifyArgumentCoverage(
      predicate,
      operatorEnd,
      operator,
      adposition,
      pp,
      ppRef,
      direct.value,
      directRef,
      directStart.value
    );
  };
  private orderedArgumentAdposition = (end: number): number => {
    let adposition = end;
    while (this.adjunctSlot(adposition)) {
      if (!this.charge(1)) return -1;
      adposition++;
    }
    return adposition;
  };
  private orderedArgumentProof = (predicate: ClaimPredicateSpan): boolean => {
    if (!this.charge(8)) return false;
    const end = HashMap.get(this.endPositions, predicate.anchor.endChar);
    const operator = HashMap.get(this.operatorCertificates, predicate.anchor.startChar);
    if (O.isNone(end) || O.isNone(operator)) return true;
    const adposition = this.orderedArgumentAdposition(end.value);
    if (adposition < 0) return false;
    if (tagAt(this.tokens, adposition) !== "ADP") return true;
    const ppStart = at(this.tokens, adposition + 1);
    if (O.isNone(ppStart)) return true;
    const ppRef = HashMap.get(this.headCertificates, ppStart.value.anchor.startChar);
    const pp = O.flatMap(ppRef, (r) => A.get(this.certificates, r.ordinal - 1));
    if (!isFiniteHeadProofOption(pp)) return true;
    return this.orderedDirectArgument(predicate, end.value, operator.value, adposition, pp.value, ppRef);
  };
  private opaqueCandidates: Array<readonly [number, number, number, number, ReadonlyArray<ClaimNominalSpan>]> = [];
  private opaqueGroupAt = HashMap.empty<number, readonly [ClaimNominalSpan, number]>();
  private opaqueBranchEnd(start: number): number {
    let end = start;
    let noun = false;
    while (end < this.tokens.length && HashSet.has(HashSet.make("NOUN", "ADJ"), tagAt(this.tokens, end))) {
      if (!this.charge(1) || this.protected(end)) return -1;
      noun = noun || tagAt(this.tokens, end) === "NOUN";
      end++;
    }
    return !noun || tagAt(this.tokens, end - 1) !== "NOUN" ? -1 : end;
  }
  private opaqueBranch = (start: number): O.Option<readonly [ClaimNominalSpan, number]> => {
    if (
      !this.charge(4) ||
      this.protected(start) ||
      !HashSet.has(HashSet.make("NOUN", "ADJ"), tagAt(this.tokens, start))
    )
      return O.none();
    const end = this.opaqueBranchEnd(start);
    if (end < 0) return O.none();
    const core = this.tokenSpan(start, end);
    return O.some([ClaimNominalSpan.make({ anchor: core, head: core, determiner: "bare", role: "unknown" }), end]);
  };
  private opaqueOwnerStart(index: number): number {
    let owner = index - 2;
    while (owner >= 0 && HashSet.has(HashSet.make("NOUN", "ADJ", "PROPN"), tagAt(this.tokens, owner))) {
      if (!this.charge(1)) return -3;
      owner--;
    }
    return owner;
  }
  private opaqueOwnerComplement(owner: number, index: number): number {
    if (!this.charge(this.predicates.length + 2)) return -3;
    if (!isObjectSlot(this.tokens, owner, this.predicateIndexes) && !this.coordinatedObjectSlot(owner)) return -2;
    return O.contains(this.headedComplement(owner), index - 1) ? owner : -2;
  }
  private opaqueCandidateOwner(index: number): number {
    if (isObjectSlot(this.tokens, index, this.predicateIndexes) || this.coordinatedObjectSlot(index)) return -1;
    if (tagAt(this.tokens, index - 1) !== "ADP" || wordAt(this.tokens, index - 1) !== "of") return -2;
    const owner = this.opaqueOwnerStart(index);
    if (owner === -3) return -3;
    if (!HashSet.has(HashSet.make("a", "an", "the", "said"), wordAt(this.tokens, owner))) return -2;
    return this.opaqueOwnerComplement(owner, index);
  }
  private appendOpaqueBranch(cursor: number, branches: Array<ClaimNominalSpan>): number {
    const branch = this.opaqueBranch(cursor);
    if (O.isNone(branch)) return -1;
    branches.push(branch.value[0]);
    return branch.value[1];
  }
  private opaqueSeparatorAccepted(separator: string, finalOr: boolean): boolean {
    return !finalOr && HashSet.has(HashSet.make(",", "or"), separator);
  }
  private opaqueFinalOr(finalOr: boolean, separator: string): boolean {
    return separator === "or" ? true : finalOr;
  }
  private opaqueBranchesComplete(
    branches: ReadonlyArray<ClaimNominalSpan>,
    cursor: number,
    index: number,
    finalOr: boolean
  ): boolean {
    return branches.length >= 2 && finalOr && this.charge(branches.length * 4 + cursor - index + 8);
  }
  private opaqueBranchesEnd(index: number, branches: Array<ClaimNominalSpan>): number {
    let cursor = this.appendOpaqueBranch(index + 2, branches);
    if (cursor < 0) return -1;
    let finalOr = false;
    let separator = wordAt(this.tokens, cursor);
    while (separator !== ".") {
      if (!this.opaqueSeparatorAccepted(separator, finalOr)) return -1;
      finalOr = this.opaqueFinalOr(finalOr, separator);
      cursor = this.appendOpaqueBranch(cursor + 1, branches);
      if (cursor < 0) return -1;
      separator = wordAt(this.tokens, cursor);
    }
    return this.opaqueBranchesComplete(branches, cursor, index, finalOr) ? cursor : -1;
  }
  private retainOpaqueCandidate(
    index: number,
    cursor: number,
    owner: number,
    branches: ReadonlyArray<ClaimNominalSpan>
  ): void {
    const core = this.tokenSpan(index + 2, cursor);
    const nominal = ClaimNominalSpan.make({ anchor: core, head: core, determiner: "bare", role: "unknown" });
    this.opaqueCandidates.push([index, index + 2, cursor, owner, branches]);
    this.opaqueGroupAt = HashMap.set(this.opaqueGroupAt, index + 2, [nominal, cursor]);
    this.adjunctIndexes = HashSet.add(HashSet.add(this.adjunctIndexes, index), index + 1);
  }
  private opaqueCandidateAt = (index: number): boolean => {
    if (!this.charge(8) || this.protected(index)) return this.remaining >= 0;
    if (!surface(this.tokens, index, "one of") || tagAt(this.tokens, index + 1) !== "ADP") return true;
    const owner = this.opaqueCandidateOwner(index);
    if (owner === -3) return false;
    if (owner === -2) return true;
    const branches: Array<ClaimNominalSpan> = [];
    const cursor = this.opaqueBranchesEnd(index, branches);
    if (cursor < 0) {
      this.supported = false;
      return this.remaining >= 0;
    }
    this.retainOpaqueCandidate(index, cursor, owner, branches);
    return true;
  };
  private readOpaqueCandidates = (): boolean => {
    for (let index = 0; index < this.tokens.length; index++)
      if (!this.charge(1) || !this.opaqueCandidateAt(index)) return false;
    return this.supported;
  };
  private opaqueGovernorEligible(predicate: ClaimPredicateSpan, ownerToken: ClaimLexicalToken): boolean {
    return (
      predicate.anchor.endChar <= ownerToken.anchor.startChar &&
      (HashSet.has(HashSet.make("finite", "possession", "auxiliary"), predicate.kind) ||
        O.exists(
          O.flatMap(HashMap.get(this.operatorCertificates, predicate.anchor.startChar), (ref) =>
            A.get(this.certificates, ref.ordinal - 1)
          ),
          (proof) => proof.kind === "operator" && proof.mode === "qualified-transition"
        ))
    );
  }
  private opaqueSelectionOperator(ownerToken: ClaimLexicalToken): O.Option<ClaimSourceProofRef> {
    const governor = A.findLast(this.predicates, (predicate) => this.opaqueGovernorEligible(predicate, ownerToken));
    return O.flatMap(governor, (predicate) => HashMap.get(this.operatorCertificates, predicate.anchor.startChar));
  }
  private certifyOpaqueBranchSeeds(
    branches: ReadonlyArray<ClaimNominalSpan>,
    seeds: Array<ClaimSourceProofRef>
  ): boolean {
    for (const branch of branches) {
      const proof = this.certifyHead(branch);
      if (O.isNone(proof)) return false;
      seeds.push(proof.value);
    }
    return true;
  }
  private retainOpaqueSelection(
    candidate: readonly [number, number, number, number, ReadonlyArray<ClaimNominalSpan>],
    seeds: ReadonlyArray<ClaimSourceProofRef>,
    content: TextAnchor,
    selection: ClaimSourceProofRef,
    group: ClaimSourceProofRef
  ): void {
    const [index, start, , , branches] = candidate;
    const candidates = A.map(branches, (branch, i) =>
      ClaimPrivateBasisCandidate.make({
        core: branch.anchor,
        head: branch.head,
        outer: branch.anchor,
        origin: "opaque-branch",
        seed: O.getOrThrow(A.get(seeds, i)),
        certificate: selection,
      })
    );
    this.privateCandidates.push(...candidates);
    for (let i = 0; i < branches.length; i++)
      this.candidateStates.push(
        ClaimNominalCandidateState.cases.proved.make({
          nominal: O.getOrThrow(A.get(branches, i)),
          proof: O.getOrThrow(A.get(seeds, i)),
          use: "branch",
        })
      );
    const nominal = O.getOrThrow(HashMap.get(this.opaqueGroupAt, start))[0];
    this.candidateStates.push(ClaimNominalCandidateState.cases.proved.make({ nominal, proof: group, use: "opaque" }));
    this.opaqueSelections.push(
      ClaimOpaqueSelection.make({
        operator: this.tokenSpan(index, index + 2),
        core: content,
        head: content,
        proof: selection,
        group,
        branches: candidates,
      })
    );
    this.headCertificates = HashMap.set(this.headCertificates, content.startChar, group);
  }
  private finishOpaqueSelection(
    candidate: readonly [number, number, number, number, ReadonlyArray<ClaimNominalSpan>],
    owner: O.Option<ClaimSourceProofRef>,
    operator: ClaimSourceProofRef,
    seeds: ReadonlyArray<ClaimSourceProofRef>
  ): boolean {
    const [index, start, end, ownerStart, branches] = candidate;
    const content = this.tokenSpan(start, end);
    const selection = this.certificate("argument", seeds.length + 10, (ordinal) =>
      ClaimFiniteSourceProof.cases.selection.make({
        ordinal,
        content,
        operator,
        linkage: O.getOrThrow(this.rawToken(index - 1)),
        selector: [O.getOrThrow(this.rawToken(index)), O.getOrThrow(this.rawToken(index + 1))],
        mode: ownerStart < 0 ? "direct-argument" : "nominal-complement",
        owner,
        branches: seeds,
      })
    );
    if (O.isNone(selection)) return false;
    const group = this.certificate("core", 6, (ordinal) =>
      ClaimFiniteSourceProof.cases["opaque-core"].make({
        ordinal,
        core: content,
        head: content,
        selection: selection.value,
      })
    );
    if (O.isNone(group) || !this.charge(branches.length * 4 + 6)) return false;
    this.retainOpaqueSelection(candidate, seeds, content, selection.value, group.value);
    return true;
  }
  private certifyOpaqueSelection(
    candidate: readonly [number, number, number, number, ReadonlyArray<ClaimNominalSpan>]
  ): boolean {
    const [index, , , ownerStart, branches] = candidate;
    if (!this.charge(this.predicates.length + branches.length * 6 + 8)) return false;
    const ownerToken = O.getOrThrow(at(this.tokens, ownerStart < 0 ? index : ownerStart));
    const owner =
      ownerStart < 0 ? O.none<ClaimSourceProofRef>() : HashMap.get(this.headCertificates, ownerToken.anchor.startChar);
    const operator = this.opaqueSelectionOperator(ownerToken);
    if ((ownerStart >= 0 && O.isNone(owner)) || O.isNone(operator)) return false;
    const seeds: Array<ClaimSourceProofRef> = [];
    if (!this.certifyOpaqueBranchSeeds(branches, seeds)) return false;
    return this.finishOpaqueSelection(candidate, owner, operator.value, seeds);
  }
  private certifyOpaqueSelections = (): boolean => {
    for (const candidate of this.opaqueCandidates) if (!this.certifyOpaqueSelection(candidate)) return false;
    return true;
  };
  private descriptionTrigger = (index: number): boolean =>
    this.charge(8) && !this.protected(index) && wordAt(this.tokens, index) === "formed";
  private descriptionOperatorLicensed = (index: number, token: ClaimLexicalToken): boolean =>
    (this.regularParticiple(index) || token.pos === "ADJ") &&
    HashSet.has(HashSet.make("of", "from"), wordAt(this.tokens, index + 1)) &&
    tagAt(this.tokens, index + 1) === "ADP";
  private descriptionAuxiliary = (index: number): boolean => {
    const before = this.skipAdjuncts(index - 1, -1);
    return O.exists(
      at(this.tokens, before),
      (t) => t.pos === "AUX" && O.exists(t.lemma, (lemma) => normalized(lemma) === "be")
    );
  };
  private descriptionEndpoint = (nominal: ClaimNominalSpan): O.Option<number> => {
    const end = HashMap.get(this.endPositions, nominal.anchor.endChar);
    return O.isSome(end) && HashSet.has(HashSet.make(".", ";"), wordAt(this.tokens, end.value)) ? end : O.none();
  };
  private descriptionTokensComplete = (start: number, end: number): boolean => {
    for (let cursor = start; cursor < end; cursor++)
      if (!HashSet.has(HashSet.make("NOUN", "ADJ"), tagAt(this.tokens, cursor)) || this.protected(cursor)) return false;
    return true;
  };
  private commitDescriptionNominal = (nominal: ClaimNominalSpan, index: number): boolean => {
    this.descriptionNominals.push(nominal);
    this.descriptionOperators = HashMap.set(this.descriptionOperators, nominal.anchor.startChar, [index, index + 1]);
    if (!this.charge(this.nominals.length * 2 + 1)) return false;
    this.nominals = A.filter(this.nominals, (n) => n.anchor.startChar !== nominal.anchor.startChar);
    return true;
  };
  private descriptionAt = (index: number): boolean => {
    if (!this.descriptionTrigger(index)) return this.remaining >= 0;
    const token = O.getOrThrow(at(this.tokens, index));
    if (!this.descriptionOperatorLicensed(index, token) || !this.descriptionAuxiliary(index)) return true;
    if (!this.charge(this.nominals.length + 2)) return false;
    const first = at(this.tokens, index + 2);
    const nominal = O.flatMap(first, (t) =>
      A.findFirst(this.nominals, (n) => n.anchor.startChar === t.anchor.startChar)
    );
    if (!isDescriptionNominal(nominal)) return true;
    const end = this.descriptionEndpoint(nominal.value);
    if (O.isNone(end)) return true;
    const start = index + 2;
    if (!this.charge(end.value - start + 5)) return false;
    if (!this.descriptionTokensComplete(start, end.value)) return true;
    return this.commitDescriptionNominal(nominal.value, index);
  };
  private readDescriptions = (): boolean => {
    for (let index = 0; index < this.tokens.length; index++) {
      if (!this.charge(1) || !this.descriptionAt(index)) return false;
    }
    return true;
  };
  private certifyDescription = (nominal: ClaimNominalSpan): boolean => {
    if (!this.charge(6)) return false;
    const positions = HashMap.get(this.descriptionOperators, nominal.anchor.startChar);
    const seed = this.certifyHead(nominal);
    if (O.isNone(positions) || O.isNone(seed)) return false;
    const [index, adposition] = positions.value;
    const operator = HashMap.get(this.operatorCertificates, O.getOrThrow(at(this.tokens, index)).anchor.startChar);
    if (O.isNone(operator)) return false;
    const source = this.tokenSpan(index - 1, adposition + 1);
    const certificate = this.certificate("argument", 8, (ordinal) =>
      ClaimFiniteSourceProof.cases.description.make({
        ordinal,
        extent: source,
        operator: operator.value,
        introducer: O.getOrThrow(this.rawToken(adposition)),
        candidate: seed.value,
      })
    );
    if (O.isNone(certificate) || !this.charge(4)) return false;
    this.privateCandidates.push(
      ClaimPrivateBasisCandidate.make({
        core: nominal.anchor,
        head: nominal.head,
        outer: nominal.anchor,
        origin: "description",
        seed: seed.value,
        certificate: certificate.value,
      })
    );
    this.candidateStates.push(
      ClaimNominalCandidateState.cases.proved.make({
        nominal: ClaimNominalSpan.make({ ...nominal, role: "unknown" }),
        proof: seed.value,
        use: "description",
      })
    );
    return true;
  };
  private certifyDescriptions = (): boolean => {
    for (const nominal of this.descriptionNominals) if (!this.certifyDescription(nominal)) return false;
    return true;
  };
  private certifyPublicCandidate = (nominal: ClaimNominalSpan): boolean => {
    if (!this.charge(4)) return false;
    const start = HashMap.get(this.tokenPositions, nominal.anchor.startChar);
    if (O.exists(start, (i) => HashMap.has(this.opaqueGroupAt, i))) return true;
    const proof = this.certifyHead(nominal);
    if (this.remaining < 0) return false;
    this.candidateStates.push(
      O.isSome(proof)
        ? ClaimNominalCandidateState.cases.proved.make({ nominal, proof: proof.value, use: "public" })
        : ClaimNominalCandidateState.cases.unproved.make({ nominal })
    );
    return true;
  };
  private certifyPublicCandidates = (): boolean => {
    for (const nominal of this.nominals) if (!this.certifyPublicCandidate(nominal)) return false;
    return true;
  };
  private certifyOperators = (): boolean => {
    for (const predicate of this.predicates)
      if (predicate.kind !== "adjunct" && O.isNone(this.certifyOperator(predicate))) return false;
    return true;
  };
  private certifyPrivateSource = (): boolean => this.certifyDescriptions() && this.certifyOpaqueSelections();
  private certifyOrderedArguments = (): boolean => {
    for (const predicate of this.predicates)
      if (predicate.kind !== "adjunct" && !this.orderedArgumentProof(predicate)) return false;
    return true;
  };
  private certifySource = (): boolean => {
    if (!this.sourceFactsReady || !this.charge(this.nominals.length + this.predicates.length + 2)) return false;
    if (!this.certifyPublicCandidates()) return false;
    if (!this.certifyOperators()) return false;
    if (!this.certifyPrivateSource()) return false;
    if (!this.certifyOrderedArguments()) return false;
    if (!this.charge(this.privateCandidates.length ** 2 + this.privateCandidates.length + 2)) return false;
    this.privateCandidates = A.sort(this.privateCandidates, privateCandidateSourceOrder);
    return this.remaining >= 0;
  };
  private charge = (amount: number): boolean => {
    this.remaining -= amount;
    return this.remaining >= 0;
  };
  private quoted = (index: number): boolean => O.getOrElse(A.get(this.quotes, index), () => false);
  private protected = (index: number): boolean => this.quoted(index) || HashSet.has(this.brackets, index);
  private readQuotes = (): boolean => {
    const ranges = quoteRanges(this.claim.claimText);
    if (!this.charge(this.tokens.length * (ranges.length + 1))) return false;
    this.quotes = protectedTokens(ranges, this.tokens);
    return !A.some(
      this.tokens,
      (token, index) => HashSet.has(HashSet.make('"', "“", "”", "‘", "’"), token.anchor.quote) && !this.quoted(index)
    );
  };
  private readBrackets = (): boolean => {
    const stack: Array<string> = [];
    for (let index = 0; index < this.tokens.length; index++) {
      if (!this.charge(1)) return false;
      if (this.quoted(index)) continue;
      if (!this.bracketToken(index, stack)) return false;
    }
    return stack.length === 0;
  };
  private bracketToken = (index: number, stack: Array<string>): boolean => {
    const spelling = wordAt(this.tokens, index);
    if (spelling === "(" || spelling === "[") {
      stack.push(spelling);
      if (stack.length > 128) return false;
    }
    if (stack.length > 0) this.brackets = HashSet.add(this.brackets, index);
    if (spelling !== ")" && spelling !== "]") return true;
    return stack.pop() === (spelling === ")" ? "(" : "[");
  };
  private readPredicates = (): boolean => {
    for (let index = 0; index < this.tokens.length; index++) {
      if (!this.charge(1)) return false;
      if (this.protected(index) || HashSet.has(this.predicateIndexes, index)) continue;
      O.map(predicateKind(this.tokens, index), (kind) => {
        if (kind === "finite" && !this.independentSubjectSlot(index)) return;
        this.predicates.push(ClaimPredicateSpan.make({ anchor: O.getOrThrow(at(this.tokens, index)).anchor, kind }));
        this.predicateIndexes = HashSet.add(this.predicateIndexes, index);
      });
    }
    return true;
  };
  private compositionDeclaration = (index: number): boolean =>
    HashSet.has(
      HashSet.make("comprising", "including", "comprises", "includes", "having"),
      wordAt(this.tokens, index)
    ) &&
    finitePosition(this.tokens, index) &&
    this.independentSubjectSlot(index);
  private readCompositionDeclarations = (): boolean => {
    for (let index = 1; index < this.tokens.length; index++) {
      if (!this.charge(2)) return false;
      if (this.protected(index) || HashSet.has(this.predicateIndexes, index) || wordAt(this.tokens, index + 1) !== ":")
        continue;
      if (this.compositionDeclaration(index)) this.markPredicate(index, index + 1, "auxiliary-head");
    }
    return true;
  };
  private tokenSpan = (start: number, end: number): TextAnchor => {
    const first = O.getOrThrow(at(this.tokens, start)).anchor;
    const last = O.getOrThrow(at(this.tokens, end - 1)).anchor;
    if (!this.charge(last.endChar - first.startChar + 2)) return first;
    return anchor(this.claim.claimText, first.startChar, last.endChar);
  };
  private regularParticiple = (index: number): boolean =>
    O.exists(
      at(this.tokens, index),
      (token) =>
        token.pos === "VERB" &&
        O.exists(
          token.lemma,
          (lemma) => word(token) === `${normalized(lemma)}ed` || word(token) === `${normalized(lemma)}d`
        )
    );
  private headedComplement = (start: number): O.Option<number> => {
    const [, width] = determiner(this.tokens, start);
    return this.nominalEnd(start, width);
  };
  private markPredicate = (start: number, end: number, kind: ClaimPredicateSpan["kind"]): void => {
    this.predicates.push(ClaimPredicateSpan.make({ anchor: this.tokenSpan(start, end), kind }));
    for (let index = start; index < end; index++) this.predicateIndexes = HashSet.add(this.predicateIndexes, index);
  };
  private numericLabelEnd = (index: number): boolean =>
    wordAt(this.tokens, index) === ")" &&
    wordAt(this.tokens, index - 2) === "(" &&
    tagAt(this.tokens, index - 1) === "NUM";
  private finitePPSubject = (index: number): O.Option<readonly [number, number]> => {
    let subject = this.skipAdjuncts(index - 1, -1);
    if (this.numericLabelEnd(subject)) subject -= 3;
    if (!O.exists(at(this.tokens, subject), regularPlural)) return O.none();
    let start = subject;
    while (start > 0 && HashSet.has(HashSet.make("ADJ", "NOUN", "PROPN", "NUM"), tagAt(this.tokens, start - 1))) {
      if (!this.charge(1)) return O.none();
      start--;
    }
    if (HashSet.has(articleWords, wordAt(this.tokens, start - 1))) start--;
    if (tagAt(this.tokens, start - 1) === "ADP") return O.none();
    return O.some([start, subject]);
  };
  private baseVerbalPP = (index: number): boolean => {
    const token = O.getOrThrow(at(this.tokens, index));
    return (
      token.pos === "VERB" &&
      O.exists(token.lemma, (lemma) => normalized(lemma) === word(token)) &&
      tagAt(this.tokens, index + 1) === "ADP"
    );
  };
  private finitePP = (index: number): boolean => {
    const token = O.getOrThrow(at(this.tokens, index));
    if (!this.baseVerbalPP(index)) return true;
    const subjectSlot = this.finitePPSubject(index);
    if (O.isNone(subjectSlot)) return this.remaining >= 0;
    const [start, subject] = subjectSlot.value;
    const end = this.headedComplement(index + 2);
    if (O.isNone(end)) return true;
    const first = this.skipAdjuncts(index - 1, -1) + 1;
    if (!this.charge((index - first) * 3 + 5)) return false;
    const labels = subject + 1 < first ? [this.tokenSpan(subject + 1, first)] : [];
    const adjuncts = A.map(
      A.filter(A.range(first, index - 1), (i) => this.adjunctSlot(i)),
      (i) => O.getOrThrow(at(this.tokens, i)).anchor
    );
    this.markPredicate(first, index + 1, "finite");
    this.proofs.push(
      ClaimSourceProof.cases["finite-pp"].make({
        operator: this.tokenSpan(first, index + 1),
        lexicalPredicate: token.anchor,
        subject: this.tokenSpan(start, subject + 1),
        complement: this.tokenSpan(index + 2, end.value),
        introducer: O.getOrThrow(at(this.tokens, index + 1)).anchor,
        labels,
        adjuncts,
      })
    );
    return true;
  };
  private readFinitePPs = (): boolean => {
    for (let index = 0; index < this.tokens.length; index++) {
      if (!this.charge(1)) return false;
      if (this.protected(index) || HashSet.has(this.predicateIndexes, index)) continue;
      if (!this.finitePP(index)) return false;
    }
    return true;
  };
  private scalarHead = (index: number): boolean => {
    const auxiliary = O.getOrThrow(at(this.tokens, index));
    return (
      auxiliary.pos === "AUX" &&
      O.exists(auxiliary.lemma, (lemma) => normalized(lemma) === "be") &&
      (surface(this.tokens, index + 1, "at least") || surface(this.tokens, index + 1, "at most"))
    );
  };
  private scalarAt = (index: number): boolean => {
    const auxiliary = O.getOrThrow(at(this.tokens, index));
    if (!this.scalarHead(index)) return true;
    const participle = this.skipAdjuncts(index + 3, 1);
    if (this.remaining < 0) return false;
    if (!this.regularParticiple(participle) || tagAt(this.tokens, participle + 1) !== "ADP") return true;
    const end = this.headedComplement(participle + 2);
    if (O.isNone(end)) return false;
    if (!this.charge((participle - index) * 3 + 4)) return false;
    const scalar = this.tokenSpan(index + 1, index + 3);
    this.markPredicate(index, index + 1, "auxiliary-head");
    this.markPredicate(participle, participle + 1, "auxiliary");
    this.predicates.push(ClaimPredicateSpan.make({ anchor: scalar, kind: "adjunct" }));
    for (let cursor = index + 1; cursor < index + 3; cursor++)
      this.adjunctIndexes = HashSet.add(this.adjunctIndexes, cursor);
    this.proofs.push(
      ClaimSourceProof.cases["scalar-auxiliary"].make({
        operator: this.tokenSpan(index, participle + 1),
        auxiliary: auxiliary.anchor,
        scalar,
        participle: O.getOrThrow(at(this.tokens, participle)).anchor,
        adjuncts: A.map(A.range(index + 3, participle - 1), (i) => O.getOrThrow(at(this.tokens, i)).anchor),
        complement: this.tokenSpan(participle + 2, end.value),
        introducer: O.getOrThrow(at(this.tokens, participle + 1)).anchor,
      })
    );
    return true;
  };
  private readScalars = (): boolean => {
    for (let index = 0; index < this.tokens.length; index++) {
      if (!this.charge(1)) return false;
      if (!this.protected(index) && !this.scalarAt(index)) return false;
    }
    return true;
  };
  private actionGovernor = (index: number): O.Option<TextAnchor> => {
    let cursor = index - 1;
    if (wordAt(this.tokens, cursor) === ":") cursor--;
    if (surface(this.tokens, cursor - 2, "the steps of")) cursor -= 3;
    if (
      HashSet.has(
        HashSet.make("comprising", "including", "comprises", "includes", "having"),
        wordAt(this.tokens, cursor)
      )
    )
      return O.map(at(this.tokens, cursor), (token) => token.anchor);
    return O.none();
  };
  private lexicalAction = (index: number): boolean => {
    const token = O.getOrThrow(at(this.tokens, index));
    return token.pos === "VERB" && this.gerundForm(token);
  };
  private actionContinuation = (index: number): boolean =>
    O.isSome(this.firstAction) && index - 1 === this.previousActionObjectEnd;
  private unknownAction = (token: ClaimLexicalToken): boolean =>
    token.pos === "NOUN" && Str.endsWith("ing")(word(token)) && token.anchor.quote === word(token);
  private actionSlot = (index: number): O.Option<"first" | "coordinate" | "declaration"> => {
    const lexical = this.lexicalAction(index);
    if (lexical && O.isSome(this.actionGovernor(index))) return O.some("first");
    if (!this.actionContinuation(index)) return O.none();
    const before = wordAt(this.tokens, index - 1);
    if (lexical && before === ";") return O.some("declaration");
    if (!HashSet.has(connectors, before)) return O.none();
    const token = O.getOrThrow(at(this.tokens, index));
    const unknown = this.unknownAction(token);
    return lexical || unknown ? O.some("coordinate") : O.none();
  };
  private firstActionProof = (index: number, end: number): boolean => {
    const governor = O.getOrThrow(this.actionGovernor(index));
    if (!this.charge(this.tokens.length + index + 1)) return false;
    const governorIndex = A.findFirstIndex(this.tokens, (token) => token.anchor.startChar === governor.startChar);
    if (O.isSome(governorIndex) && surface(this.tokens, governorIndex.value + 1, "the steps of"))
      for (let cursor = governorIndex.value + 1; cursor < index; cursor++)
        this.adjunctIndexes = HashSet.add(this.adjunctIndexes, cursor);
    const proof = ClaimSourceProof.cases.action.make({
      operator: O.getOrThrow(at(this.tokens, index)).anchor,
      governor,
      object: this.tokenSpan(
        O.getOrElse(HashMap.get(this.directActionStarts, index), () => index + 1),
        end
      ),
    });
    this.proofs.push(proof);
    this.firstAction = O.some(proof);
    return true;
  };
  private continuedActionProof = (index: number, end: number, declaration: boolean): void => {
    const first = O.getOrThrow(this.firstAction);
    const fields = {
      operator: O.getOrThrow(at(this.tokens, index)).anchor,
      governor: first.governor,
      object: this.tokenSpan(
        O.getOrElse(HashMap.get(this.directActionStarts, index), () => index + 1),
        end
      ),
    };
    this.proofs.push(
      declaration
        ? ClaimSourceProof.cases.action.make(fields)
        : ClaimSourceProof.cases["coordinated-action"].make({
            ...fields,
            firstAction: first.operator,
            coordinator: O.getOrThrow(at(this.tokens, index - 1)).anchor,
          })
    );
  };
  private recordActionProof = (index: number, end: number, slot: "first" | "coordinate" | "declaration"): boolean => {
    if (slot === "first") return this.firstActionProof(index, end);
    this.continuedActionProof(index, end, slot === "declaration");
    return true;
  };
  private actionObject = (index: number): O.Option<readonly [number, number]> => {
    let start = index + 1;
    if (!this.charge(2)) return O.none();
    if (tagAt(this.tokens, start) === "ADP") {
      const pp = this.headedComplement(start + 1);
      if (O.isNone(pp) || !HashSet.has(articleWords, wordAt(this.tokens, pp.value))) return O.none();
      start = pp.value;
    }
    if (!HashSet.has(articleWords, wordAt(this.tokens, start))) return O.none();
    return O.map(this.headedComplement(start), (end) => [start, end]);
  };
  private readActionAt = (index: number): boolean => {
    const slot = this.actionSlot(index);
    if (O.isNone(slot)) return true;
    const object = this.actionObject(index);
    if (O.isNone(object)) return this.remaining >= 0;
    const [start, end] = object.value;
    if (!this.charge(5)) return false;
    this.directActionStarts = HashMap.set(this.directActionStarts, index, start);
    if (!HashSet.has(this.predicateIndexes, index)) this.markPredicate(index, index + 1, "gerund");
    if (!this.recordActionProof(index, end, slot.value)) return false;
    this.previousActionObjectEnd = end;
    return true;
  };
  private readActions = (): boolean => {
    for (let index = 0; index < this.tokens.length; index++) {
      if (!this.charge(2)) return false;
      if (!this.protected(index) && !this.readActionAt(index)) return false;
    }
    return true;
  };
  private reducedStart = (index: number): O.Option<number> => {
    let cursor = index - 1;
    if (!HashSet.has(nominalTags, tagAt(this.tokens, cursor))) return O.none();
    while (cursor > 0 && HashSet.has(HashSet.make("NOUN", "PROPN", "ADJ", "NUM"), tagAt(this.tokens, cursor - 1))) {
      if (!this.charge(1)) return O.none();
      cursor--;
    }
    if (HashSet.has(articleWords, wordAt(this.tokens, cursor - 1))) cursor--;
    return O.some(cursor);
  };
  private reducedGovernor = (start: number): O.Option<O.Option<TextAnchor>> => {
    const before = wordAt(this.tokens, start - 1);
    if (O.isSome(this.actionGovernor(start)) || HashSet.has(punctuation, before)) return O.some(O.none());
    if (tagAt(this.tokens, start - 1) !== "ADP") return O.none();
    // A modifier's PP does not reopen its object's NP as a unique secondary
    // predicate owner. Only direct adjacency to an actual VP proves this slot.
    const preceding = at(this.tokens, start - 2);
    if (O.isNone(preceding)) return O.none();
    const operator = A.findFirst(
      this.predicates,
      (p) =>
        p.anchor.endChar === preceding.value.anchor.endChar &&
        HashSet.has(HashSet.make("auxiliary", "adjectival"), p.kind)
    );
    return O.map(operator, (p) => O.some(p.anchor));
  };
  private reducedCandidate = (index: number): boolean =>
    (tagAt(this.tokens, index) === "ADJ" || this.regularParticiple(index)) &&
    tagAt(this.tokens, index + 1) === "ADP" &&
    !HashSet.has(this.predicateIndexes, index);
  private reducedAt = (index: number): boolean => {
    const token = O.getOrThrow(at(this.tokens, index));
    if (!this.reducedCandidate(index)) return true;
    const start = this.reducedStart(index);
    if (O.isNone(start)) return true;
    const end = this.headedComplement(index + 2);
    if (O.isNone(end)) return false;
    if (!this.charge(this.predicates.length + 5)) return false;
    const governor = this.reducedGovernor(start.value);
    if (O.isNone(governor)) return false;
    this.markPredicate(index, index + 1, "adjectival");
    const fields = {
      operator: token.anchor,
      nominal: this.tokenSpan(start.value, index),
      complement: this.tokenSpan(index + 2, end.value),
      introducer: O.getOrThrow(at(this.tokens, index + 1)).anchor,
      governingPredicate: governor.value,
    };
    this.proofs.push(
      token.pos === "ADJ"
        ? ClaimSourceProof.cases["reduced-adjective"].make(fields)
        : ClaimSourceProof.cases["reduced-participle"].make(fields)
    );
    return true;
  };
  private readReduced = (): boolean => {
    for (let index = 1; index < this.tokens.length; index++) {
      if (!this.charge(1)) return false;
      if (!this.protected(index) && !this.reducedAt(index)) return false;
    }
    return true;
  };
  private readQualifiedTransition = (): boolean => {
    if (!this.charge(this.claim.claimText.length * 2 + this.tokens.length * 2)) return false;
    const preamble = Str.indexOf(this.claim.preamble)(this.claim.claimText);
    if (O.isNone(preamble)) return false;
    const from = preamble.value + this.claim.preamble.length;
    const body = Str.indexOf(this.claim.body)(Str.slice(from)(this.claim.claimText));
    if (O.isNone(body)) return false;
    const to = from + body.value;
    // Qualified governing syntax is an independently proved function region,
    // even when its object is bare and no article follows the operator.
    for (let index = 0; index < this.tokens.length; index++) {
      const token = O.getOrThrow(at(this.tokens, index));
      if (token.anchor.startChar < from || token.anchor.endChar > to || token.pos === "PUNCT") continue;
      this.predicateIndexes = HashSet.add(this.predicateIndexes, index);
      this.predicates.push(ClaimPredicateSpan.make({ anchor: token.anchor, kind: "auxiliary-head" }));
    }
    return true;
  };
  private gerundForm = (token: ClaimLexicalToken): boolean =>
    O.exists(token.lemma, (lemma) => {
      const base = normalized(lemma);
      return (
        word(token) === `${base}ing` || (Str.endsWith("e")(base) && word(token) === `${Str.slice(0, -1)(base)}ing`)
      );
    });
  private adjunctSlot = (index: number): boolean =>
    tagAt(this.tokens, index) === "ADV" || HashSet.has(HashSet.make("not", "n't"), wordAt(this.tokens, index));
  private skipAdjuncts = (index: number, step: -1 | 1): number => {
    let cursor = index;
    while (this.adjunctSlot(cursor)) {
      if (!this.charge(1)) return cursor;
      cursor += step;
    }
    return cursor;
  };
  private inheritedPredicate = (index: number): boolean => {
    const before = this.skipAdjuncts(index - 1, -1);
    if (!this.charge(this.predicates.length + 1)) return false;
    const token = O.getOrThrow(at(this.tokens, index));
    const preceding = A.findLast(
      this.predicates,
      (p) => p.anchor.endChar <= token.anchor.startChar && p.kind !== "adjunct"
    );
    if (!HashSet.has(connectors, wordAt(this.tokens, before)) || O.isNone(preceding)) return false;
    const gap = Str.slice(preceding.value.anchor.endChar, token.anchor.startChar)(this.claim.claimText);
    return this.charge(gap.length) && O.isNone(Str.match(/[;:]|\b(?:that|which|wherein|if|when)\b/iu)(gap));
  };
  private finiteToken = (token: ClaimLexicalToken): boolean =>
    token.pos === "VERB" &&
    O.exists(token.lemma, (lemma) => normalized(lemma) === word(token) || finiteInflection(token));
  private continuationKind = (index: number): O.Option<typeof ClaimPredicateSpan.Type.kind> => {
    const token = O.getOrThrow(at(this.tokens, index));
    if (!HashSet.has(HashSet.make("VERB", "NOUN"), token.pos)) return O.none();
    const gerund = this.gerundForm(token);
    const governor = wordAt(this.tokens, index - 1);
    const governed =
      token.pos === "VERB" &&
      gerund &&
      HashSet.has(HashSet.make("includes", "including", "comprises", "comprising", "contains", "containing"), governor);
    const inherited = this.inheritedPredicate(index);
    if (this.remaining < 0) return O.none();
    if (governed) return O.some("gerund");
    if (!inherited) return O.none();
    if (gerund) return O.some("gerund");
    return predicateWhen("finite", this.finiteToken(token));
  };
  private continuationAt = (index: number): void => {
    if (this.protected(index) || HashSet.has(this.predicateIndexes, index) || !lexicalObjectAfter(this.tokens, index))
      return;
    const kind = this.continuationKind(index);
    if (O.isNone(kind)) return;
    this.predicates.push(
      ClaimPredicateSpan.make({ anchor: O.getOrThrow(at(this.tokens, index)).anchor, kind: kind.value })
    );
    this.predicateIndexes = HashSet.add(this.predicateIndexes, index);
  };
  private readContinuations = (): boolean => {
    for (let index = 0; index < this.tokens.length; index++) {
      if (!this.charge(1)) return false;
      this.continuationAt(index);
    }
    if (!this.charge(this.predicates.length ** 2)) return false;
    this.predicates = A.sort(this.predicates, (left: ClaimPredicateSpan, right: ClaimPredicateSpan) =>
      left.anchor.startChar < right.anchor.startChar ? -1 : left.anchor.startChar > right.anchor.startChar ? 1 : 0
    );
    return this.remaining >= 0;
  };
  private independentSubjectSlot = (index: number): boolean => {
    if (relativeSubjectAt(this.tokens, index)) return true;
    let cursor = index - 1;
    while (cursor >= 0 && HashSet.has(HashSet.make("NOUN", "PROPN", "ADJ", "NUM"), tagAt(this.tokens, cursor))) {
      if (!this.charge(1)) return false;
      cursor--;
    }
    if (HashSet.has(articleWords, wordAt(this.tokens, cursor))) cursor--;
    // A PP's NP is not an independent subject. In particular, a verb-tagged
    // regular plural in `on the side surfaces of ...` stays nominal.
    return tagAt(this.tokens, cursor) !== "ADP";
  };
  private discourseAdjunct = (index: number): boolean =>
    surface(this.tokens, index - 1, "in response") &&
    HashSet.has(HashSet.make(",", "to"), wordAt(this.tokens, index + 1));
  private adjunct = (index: number): boolean => {
    if (!this.adjunctSlot(index)) return this.discourseAdjunct(index);
    const left = this.skipAdjuncts(index - 1, -1);
    const right = this.skipAdjuncts(index + 1, 1);
    if (this.remaining < 0) return false;
    return (
      HashSet.has(this.predicateIndexes, left) ||
      HashSet.has(this.predicateIndexes, right) ||
      this.discourseAdjunct(index)
    );
  };
  private readAdjuncts = (): boolean => {
    for (let index = 0; index < this.tokens.length; index++) {
      if (!this.charge(1)) return false;
      if (this.protected(index) || HashSet.has(this.adjunctIndexes, index) || !this.adjunct(index)) continue;
      if (!this.charge(1)) return false;
      this.adjunctIndexes = HashSet.add(this.adjunctIndexes, index);
      this.predicates.push(
        ClaimPredicateSpan.make({ anchor: O.getOrThrow(at(this.tokens, index)).anchor, kind: "adjunct" })
      );
    }
    return true;
  };
  private readNames = (): boolean => {
    for (let index = 1; index < this.tokens.length; index++) {
      if (!this.charge(1)) return false;
      const copular = HashSet.has(HashSet.make("is", "are", "was", "were"), wordAt(this.tokens, index - 1));
      if (copular && tagAt(this.tokens, index) === "PROPN" && !this.nameList(index)) return false;
    }
    return true;
  };
  private nameList = (index: number): boolean => {
    let cursor = index;
    let names = HashSet.empty<number>();
    let entries = 0;
    let expectingName = true;
    while (this.nameToken(cursor, expectingName) !== "stop") {
      if (!this.charge(1)) return false;
      const isName = tagAt(this.tokens, cursor) === "PROPN";
      entries += isName && expectingName ? 1 : 0;
      if (isName) names = HashSet.add(names, cursor);
      expectingName = !isName;
      cursor++;
    }
    this.acceptNameList(cursor, entries, expectingName, names);
    return true;
  };
  private acceptNameList = (
    cursor: number,
    entries: number,
    expectingName: boolean,
    names: HashSet.HashSet<number>
  ): void => {
    const complete = cursor === this.tokens.length || HashSet.has(HashSet.make(";", "."), wordAt(this.tokens, cursor));
    if (entries >= 2 && !expectingName && complete) this.names = HashSet.union(this.names, names);
  };
  private nameToken = (index: number, expecting: boolean): string => {
    if (this.protected(index)) return "stop";
    if (tagAt(this.tokens, index) === "PROPN") return "name";
    return !expecting && HashSet.has(HashSet.make(",", "and", "or"), wordAt(this.tokens, index)) ? "separator" : "stop";
  };
  private nominalBarrier = (index: number): boolean =>
    HashSet.has(this.predicateIndexes, index) ||
    HashSet.has(this.adjunctIndexes, index) ||
    A.some([auxiliaries, clauseWords, articleWords, stopWords, punctuation, connectors], (words) =>
      HashSet.has(words, wordAt(this.tokens, index))
    );
  private aliasAt = (index: number): boolean =>
    wordAt(this.tokens, index) === "(" &&
    O.exists(at(this.tokens, index + 1), (token) => O.isSome(Str.match(/^[A-Z][A-Z0-9-]+$/u)(token.anchor.quote))) &&
    wordAt(this.tokens, index + 2) === ")";
  private verbModifierHead = (index: number): boolean => {
    if (HashSet.has(nominalTags, tagAt(this.tokens, index + 1))) return true;
    let cursor = index + 1;
    while (tagAt(this.tokens, cursor) === "ADJ") {
      if (!this.charge(1)) return false;
      cursor++;
    }
    return cursor > index + 1 && HashSet.has(this.predicateIndexes, cursor);
  };
  private adverbModifierComplement = (index: number, width: number, start: number): boolean =>
    tagAt(this.tokens, index + 1) === "ADJ" ||
    (this.regularParticiple(index + 1) &&
      (HashSet.has(nominalTags, tagAt(this.tokens, index + 2)) || this.intrinsicComplete(start, index + 3, width)));
  private modifierAt = (index: number, width: number, start: number): boolean => {
    const tag = tagAt(this.tokens, index);
    if (HashSet.has(modifierTags, tag)) return true;
    if (tag === "ADV" && this.adverbModifierComplement(index, width, start)) return true;
    return tag === "VERB" && width > 0 && !HashSet.has(this.predicateIndexes, index) && this.verbModifierHead(index);
  };
  private nominalVerbHead = (index: number, start: number, width: number): boolean =>
    width > 0 &&
    tagAt(this.tokens, start - 1) === "ADP" &&
    HashSet.has(nominalTags, tagAt(this.tokens, index - 1)) &&
    tagAt(this.tokens, index) === "VERB" &&
    !HashSet.has(this.predicateIndexes, index) &&
    tagAt(this.tokens, index + 1) === "ADP" &&
    O.exists(at(this.tokens, index), finiteInflection);
  private cliticWidth = (index: number, hasNoun: boolean): number => {
    if (!hasNoun) return 0;
    const following = (offset: number): boolean =>
      HashSet.has(HashSet.make("NOUN", "PROPN", "ADJ"), tagAt(this.tokens, index + offset));
    if (HashSet.has(HashSet.make("'s", "’s"), wordAt(this.tokens, index)) && following(1)) return 1;
    return HashSet.has(HashSet.make("'", "’"), wordAt(this.tokens, index)) &&
      wordAt(this.tokens, index + 1) === "s" &&
      following(2)
      ? 2
      : 0;
  };
  private hyphenModifier = (index: number): boolean =>
    wordAt(this.tokens, index) === "-" &&
    index > 0 &&
    HashSet.has(HashSet.make("NOUN", "PROPN", "ADJ"), tagAt(this.tokens, index + 1));
  private nounAt = (index: number, hasNoun: boolean, width: number, start: number): boolean =>
    HashSet.has(nominalTags, tagAt(this.tokens, index)) || (hasNoun && this.nominalVerbHead(index, start, width));
  private nominalAdvance = (
    index: number,
    hasNoun: boolean,
    width: number,
    start: number
  ): readonly [number, boolean] => {
    if (this.quoted(index)) return [1, true];
    if (this.aliasAt(index)) return [3, false];
    if (this.hyphenModifier(index)) return [1, false];
    const clitic = this.cliticWidth(index, hasNoun);
    if (clitic > 0) return [clitic, false];
    if (this.nominalBarrier(index)) return [0, false];
    if (this.nounAt(index, hasNoun, width, start)) return [1, true];
    return [this.modifierAt(index, width, start) ? 1 : 0, false];
  };
  private nominalComplete = (start: number, end: number, width: number, hasNoun: boolean): boolean => {
    if (end <= start + width) return false;
    return (
      hasNoun ||
      (width > 0 && tagAt(this.tokens, end - 1) === "ADJ" && HashSet.has(this.predicateIndexes, end)) ||
      this.intrinsicComplete(start, end, width)
    );
  };
  private nominalEnd = (start: number, width: number): O.Option<number> => {
    let end = start + width;
    let hasNoun = false;
    while (end < this.tokens.length) {
      if (!this.charge(1)) return O.none();
      const [advance, noun] = this.nominalAdvance(end, hasNoun, width, start);
      if (advance === 0) break;
      hasNoun = hasNoun || noun;
      end += advance;
    }
    return this.nominalComplete(start, end, width, hasNoun) ? O.some(end) : O.none();
  };
  private coordinatedPlural = (start: number, end: number): boolean =>
    O.exists(
      A.last(this.nominals),
      (previous) =>
        previous.role === "generic-plural" &&
        O.exists(at(this.tokens, end - 1), regularPlural) &&
        O.isSome(
          Str.match(/^[\s,]*(?:(?:and|or)\s*)?$/u)(
            Str.slice(
              previous.anchor.endChar,
              O.getOrThrow(at(this.tokens, start)).anchor.startChar
            )(this.claim.claimText)
          )
        )
    );
  private contradictoryPluralRelative = (end: number): boolean => {
    if (!relativeSubjectAt(this.tokens, end + 1)) return false;
    let cursor = end + 1;
    // Traverse only adjuncts already admitted by the predicate pass. Each
    // visit is charged; a protected span, intervening NP or unlicensed token
    // stops attachment proof. Exhaustion declines the entire atomic plan.
    while (HashSet.has(this.adjunctIndexes, cursor)) {
      if (!this.charge(1)) return false;
      cursor++;
    }
    if (!this.charge(1) || !HashSet.has(this.predicateIndexes, cursor)) return false;
    return O.exists(at(this.tokens, cursor), (token) => singularAgreement(token) || finiteInflection(token));
  };
  private proofNominalRole = (first: number, initial: ClaimNominalPolicyRole): ClaimNominalPolicyRole => {
    let role = initial;
    if (O.isSome(A.findFirst(this.proofs, (p) => p.kind === "nominal-coordination" && p.core.startChar === first)))
      role = "unknown";
    if (A.some(this.proofs, (p) => p.kind === "quantity" && p.mode === "cardinal" && p.core.startChar === first))
      role = "quantified-introduction";
    return role;
  };
  private bareNominalRole = (
    start: number,
    end: number,
    kind: ClaimTermDeterminer,
    initial: ClaimNominalPolicyRole
  ): ClaimNominalPolicyRole => {
    let role = initial;
    if (kind === "bare" && HashSet.has(this.names, start)) role = "explicit-name";
    if (kind === "bare" && role === "unknown" && this.coordinatedPlural(start, end)) role = "generic-plural";
    return role;
  };
  private resolvedNominalRole = (
    start: number,
    end: number,
    kind: ClaimTermDeterminer,
    width: number
  ): ClaimNominalPolicyRole => {
    const first = O.getOrThrow(at(this.tokens, start)).anchor.startChar;
    let role = nominalRole(this.claim, this.tokens, start, start + width, end, kind, this.predicateIndexes);
    role = this.bareNominalRole(start, end, kind, role);
    // NUM alone never falls through to a generic/preamble introduction. Only
    // the independently proved cardinal marker below can restore its role.
    if (tagAt(this.tokens, start) === "NUM") role = "unknown";
    role = this.proofNominalRole(first, role);
    if (role === "generic-plural" && this.contradictoryPluralRelative(end)) role = "unknown";
    return role;
  };
  private appendNominal = (
    start: number,
    end: number,
    kind: ClaimTermDeterminer,
    headWidth: number,
    width: number
  ): void => {
    const first = O.getOrThrow(at(this.tokens, start)).anchor.startChar;
    const last = O.getOrThrow(at(this.tokens, end - 1)).anchor.endChar;
    const head = O.getOrThrow(at(this.tokens, start + headWidth)).anchor.startChar;
    const role = this.resolvedNominalRole(start, end, kind, width);
    if (this.remaining < 0) return;
    this.nominals.push(
      ClaimNominalSpan.make({
        anchor: anchor(this.claim.claimText, first, last),
        head: anchor(this.claim.claimText, head, last),
        determiner: kind,
        role,
      })
    );
  };
  private quantityReference = (index: number): boolean =>
    HashSet.has(HashSet.make("the", "said"), wordAt(this.tokens, index)) &&
    surface(this.tokens, index + 1, "plurality of");
  private sharedModifier = (index: number, width: number): boolean =>
    width === 0 &&
    tagAt(this.tokens, index) === "ADJ" &&
    HashSet.has(connectors, wordAt(this.tokens, index + 1)) &&
    tagAt(this.tokens, index + 2) === "ADJ";
  private cardinalNominal = (index: number, end: number, kind: ClaimTermDeterminer): boolean =>
    kind === "bare" &&
    cardinalAt(this.tokens, index) &&
    O.exists(at(this.tokens, end - 1), regularPlural) &&
    (isObjectSlot(this.tokens, index, this.predicateIndexes) || this.coordinatedObjectSlot(index));
  private alternativeEnd = (index: number, end: number, width: number, headWidth: number): number => {
    if (width === 0 || wordAt(this.tokens, end) !== "or" || HashSet.has(articleWords, wordAt(this.tokens, end + 1)))
      return end;
    const right = this.nominalEnd(end + 1, 0);
    if (O.isNone(right) || !this.charge(4)) return end;
    // The admitted production has two complete alternatives. Mixed or further
    // unrenewed members need their own complete grouping proof; a supported-a
    // prefix must never escape from that unresolved larger constituent.
    if (this.alternativeContinuation(right.value)) this.supported = false;
    this.proofs.push(
      ClaimSourceProof.cases["nominal-coordination"].make({
        core: this.tokenSpan(index, right.value),
        head: this.tokenSpan(index + headWidth, right.value),
        branches: [this.tokenSpan(index + headWidth, end), this.tokenSpan(end + 1, right.value)],
        mode: "alternative",
      })
    );
    return right.value;
  };
  private numericLabelOpening = (index: number): boolean =>
    wordAt(this.tokens, index) === "(" &&
    tagAt(this.tokens, index + 1) === "NUM" &&
    wordAt(this.tokens, index + 2) === ")";
  private alternativeLabelEnd = (end: number): number => {
    let cursor = end;
    while (this.numericLabelOpening(cursor)) {
      if (!this.charge(3)) return cursor;
      cursor += 3;
    }
    return cursor;
  };
  private alternativeContinuation = (end: number): boolean => {
    let cursor = this.alternativeLabelEnd(end);
    if (this.remaining < 0) return true;
    let comma = false;
    while (wordAt(this.tokens, cursor) === ",") {
      if (!this.charge(1)) return true;
      comma = true;
      cursor++;
    }
    if (HashSet.has(connectors, wordAt(this.tokens, cursor))) return true;
    if (!comma || HashSet.has(articleWords, wordAt(this.tokens, cursor))) return false;
    return O.isSome(this.nominalEnd(cursor, 0));
  };
  private nominalQuantityProof = (
    index: number,
    end: number,
    headWidth: number,
    reference: boolean,
    cardinal: boolean
  ): void => {
    this.proofs.push(
      ClaimSourceProof.cases.quantity.make({
        core: this.tokenSpan(index, end),
        head: this.tokenSpan(index + headWidth, end),
        mode: reference ? "reference" : cardinal ? "cardinal" : "introduction",
      })
    );
  };
  private nominalModifierProof = (start: number, end: number, from: number, to: number): void => {
    this.proofs.push(
      ClaimSourceProof.cases["nominal-modifier"].make({
        core: this.tokenSpan(start, end),
        operator: this.tokenSpan(from, to),
        head: O.getOrThrow(at(this.tokens, end - 1)).anchor,
      })
    );
  };
  private prenominalParticiple = (modifier: number, end: number, width: number): boolean =>
    width > 0 &&
    tagAt(this.tokens, modifier) === "ADV" &&
    this.regularParticiple(modifier + 1) &&
    (HashSet.has(nominalTags, tagAt(this.tokens, end - 1)) || this.intrinsicInputAt(end - 1));
  private compoundModifier = (index: number, width: number): boolean =>
    width > 0 &&
    tagAt(this.tokens, index) === "VERB" &&
    HashSet.has(nominalTags, tagAt(this.tokens, index - 1)) &&
    HashSet.has(nominalTags, tagAt(this.tokens, index + 1));
  private nominalModifierProofs = (index: number, end: number, width: number): boolean => {
    const modifier = index + width;
    if (this.prenominalParticiple(modifier, end, width)) this.nominalModifierProof(index, end, modifier, modifier + 2);
    if (!this.charge((end - index) * 6)) return false;
    for (let cursor = modifier + 1; cursor + 1 < end; cursor++)
      if (this.compoundModifier(cursor, width)) this.nominalModifierProof(index, end, cursor, cursor + 1);
    return true;
  };
  private sharedModifierProof = (index: number, end: number): void => {
    this.proofs.push(
      ClaimSourceProof.cases["nominal-coordination"].make({
        core: this.tokenSpan(index, end),
        head: this.tokenSpan(index, end),
        branches: [],
        mode: "shared-head",
      })
    );
  };
  private validateQuantityReference = (reference: boolean, end: number): void => {
    if (reference && !O.exists(at(this.tokens, end - 1), regularPlural)) this.supported = false;
  };
  private quantityProofNeeded = (reference: boolean, kind: ClaimTermDeterminer, cardinal: boolean): boolean =>
    reference || kind === "plurality-of" || kind === "at-least-one" || cardinal;
  private finishNominal = (
    index: number,
    initialEnd: number,
    settings: readonly [ClaimTermDeterminer, number, number],
    shared: boolean,
    reference: boolean
  ): number => {
    const [kind, width, initialHeadWidth] = settings;
    const cardinal = this.cardinalNominal(index, initialEnd, kind);
    const headWidth = cardinal ? 1 : initialHeadWidth;
    const end = this.alternativeEnd(index, initialEnd, width, headWidth);
    if (shared) this.sharedModifierProof(index, end);
    if (this.quantityProofNeeded(reference, kind, cardinal))
      this.nominalQuantityProof(index, end, headWidth, reference, cardinal);
    if (!this.nominalModifierProofs(index, end, width)) return index + 1;
    this.appendNominal(index, end, kind, headWidth, width);
    return end;
  };
  private validateSharedExtent = (shared: boolean, extent: O.Option<number>): void => {
    if (shared && O.isNone(extent)) this.supported = false;
  };
  private nominalCandidate = (index: number, settings: readonly [ClaimTermDeterminer, number, number]): number => {
    const [kind, initialWidth, initialHeadWidth] = settings;
    const reference = this.quantityReference(index);
    const width = reference ? 3 : initialWidth;
    const headWidth = reference ? 1 : initialHeadWidth;
    const shared = this.sharedModifier(index, width);
    const initialEnd = shared ? this.nominalEnd(index + 2, 0) : this.nominalEnd(index, width);
    this.validateSharedExtent(shared, initialEnd);
    if (O.isNone(initialEnd) || !this.charge(this.proofs.length * 2 + 6)) return index + 1;
    this.validateQuantityReference(reference, initialEnd.value);
    return this.finishNominal(index, initialEnd.value, [kind, width, headWidth], shared, reference);
  };
  private readNominalAt = (index: number): number => {
    if (!this.charge(1)) return index + 1;
    const opaque = HashMap.get(this.opaqueGroupAt, index);
    if (O.isSome(opaque)) {
      this.nominals.push(opaque.value[0]);
      return opaque.value[1];
    }
    const settings = determiner(this.tokens, index);
    if (this.protected(index) && !this.quoted(index)) return index + 1;
    if (settings[1] === 0 && this.nominalBarrier(index)) return index + 1;
    return this.nominalCandidate(index, settings);
  };
  private coordinatedObjectSlot = (index: number): boolean => {
    if (!HashSet.has(connectors, wordAt(this.tokens, index - 1))) return false;
    if (!this.charge(this.predicates.length + this.nominals.length + 1)) return false;
    const token = O.getOrThrow(at(this.tokens, index));
    const predicate = A.findLast(
      this.predicates,
      (p) => p.kind === "finite" && p.anchor.endChar < token.anchor.startChar
    );
    if (O.isNone(predicate) || !A.some(this.nominals, (n) => n.anchor.startChar > predicate.value.anchor.endChar))
      return false;
    const length = token.anchor.startChar - predicate.value.anchor.endChar;
    return (
      this.charge(length) &&
      O.isNone(
        Str.match(/[;:]|\b(?:that|which|wherein|if|when)\b/iu)(
          Str.slice(predicate.value.anchor.endChar, token.anchor.startChar)(this.claim.claimText)
        )
      )
    );
  };
  private readNominals = (): boolean => {
    for (let index = 0; index < this.tokens.length; ) {
      if (!this.charge(1)) return false;
      index = this.readNominalAt(index);
    }
    return this.remaining >= 0 && this.supported;
  };
  private lexicalPossession = (predicate: ClaimPredicateSpan): boolean => {
    if (!HashSet.has(HashSet.make("has", "have", "had"), Str.toLowerCase(predicate.anchor.quote))) return false;
    if (!this.charge(this.nominals.length + 1)) return false;
    const complement = A.findFirst(this.nominals, ({ anchor }) => anchor.startChar >= predicate.anchor.endChar);
    if (O.isNone(complement)) return false;
    if (!this.charge(complement.value.anchor.startChar - predicate.anchor.endChar)) return false;
    return (
      Str.trim(Str.slice(predicate.anchor.endChar, complement.value.anchor.startChar)(this.claim.claimText)) === ""
    );
  };
  private readPossession = (): boolean => {
    if (!this.charge(this.predicates.length)) return false;
    // A directly adjacent complete NP proves lexical have+NP, independently of
    // Wink choosing AUX or VERB. Have+participle retains its separate head and
    // lexical predicate. Neither role is evidence of physical part ownership.
    this.predicates = A.map(this.predicates, (predicate) =>
      this.lexicalPossession(predicate) ? ClaimPredicateSpan.make({ ...predicate, kind: "possession" }) : predicate
    );
    return this.remaining >= 0;
  };
  private complementary = (index: number): boolean => {
    if (!HashSet.has(this.predicateIndexes, index - 1)) return false;
    const opening = wordAt(this.tokens, index);
    if (HashSet.has(HashSet.make("when", "whether"), opening)) return true;
    return opening === "that" && this.clausalThat(index);
  };
  private relative = (index: number): boolean =>
    HashSet.has(HashSet.make("wherein", "whereby"), wordAt(this.tokens, index)) ||
    (relativeSubjectAt(this.tokens, index + 1) && !HashSet.has(this.predicateIndexes, index - 1));
  private clauseAt = (index: number): O.Option<typeof ClaimClauseSpan.Type.kind> => {
    const opening = wordAt(this.tokens, index);
    if (opening === ";") return O.some("main");
    if (this.complementary(index)) return O.some("complement");
    if (this.relative(index)) return O.some("relative");
    return HashSet.has(HashSet.make("if", "while", "when", "whether"), opening) ? O.some("conditional") : O.none();
  };
  private clausalThat = (index: number): boolean =>
    HashSet.has(articleWords, wordAt(this.tokens, index + 1)) ||
    tagAt(this.tokens, index + 1) === "PRON" ||
    HashSet.has(this.predicateIndexes, index + 1);
  private finishClause = (end: number): boolean => {
    if (end <= this.clauseStart) return true;
    if (!this.charge(this.nominals.length + this.predicates.length + 1)) return false;
    const span = anchor(
      this.claim.claimText,
      O.getOrThrow(at(this.tokens, this.clauseStart)).anchor.startChar,
      O.getOrThrow(at(this.tokens, end - 1)).anchor.endChar
    );
    const owns = ({ anchor }: { readonly anchor: TextAnchor }): boolean =>
      anchor.startChar >= span.startChar && anchor.endChar <= span.endChar;
    this.clauses.push(
      ClaimClauseSpan.make({
        anchor: span,
        kind: this.clauseKind,
        introducer: this.introducer,
        predicates: A.map(A.filter(this.predicates, owns), ({ anchor }) => anchor),
        nominals: A.map(A.filter(this.nominals, owns), ({ anchor }) => anchor),
      })
    );
    return true;
  };
  private beginClause = (index: number, kind: typeof ClaimClauseSpan.Type.kind): void => {
    const separator = wordAt(this.tokens, index) === ";";
    this.clauseStart = separator ? index + 1 : index;
    this.clauseKind = kind;
    this.introducer = separator ? O.none() : O.some(O.getOrThrow(at(this.tokens, index)).anchor);
  };
  private clauseTransition = (index: number): boolean => {
    if (this.protected(index)) return true;
    const kind = this.clauseAt(index);
    if (O.isNone(kind)) return true;
    if (!this.finishClause(index)) return false;
    this.beginClause(index, kind.value);
    return true;
  };
  private readClauses = (): boolean => {
    for (let index = 0; index < this.tokens.length; index++) {
      if (!this.charge(1)) return false;
      if (!this.clauseTransition(index)) return false;
    }
    return this.finishClause(this.tokens.length);
  };
  run = (): O.Option<ClaimClauseRolePlan> => {
    if (!this.charge(this.tokens.length * 32 + this.claim.claimText.length)) return O.none();
    const passes = [
      this.readQuotes,
      this.readBrackets,
      this.readSourceFacts,
      this.readQualifiedTransition,
      this.readScalars,
      this.readPredicates,
      this.readCompositionDeclarations,
      this.readFinitePPs,
      this.readActions,
      this.readContinuations,
      this.readReduced,
      this.readAdjuncts,
      this.readNames,
      this.readOpaqueCandidates,
      this.readNominals,
      this.readDescriptions,
      this.readPossession,
      this.readClauses,
      this.certifySource,
    ];
    if (!A.every(passes, (pass) => pass())) return O.none();
    if (this.intrinsicFactsProduced && !this.charge(this.tokens.length * 16 + 24)) return O.none();
    return O.some(
      ClaimClauseRolePlan.make({
        qualifiedText: this.claim.claimText,
        qualifiedClaim: O.some(this.claim),
        originalLexicalInput: this.intrinsicFactsProduced ? this.originalInput : O.none(),
        stage: "candidates",
        remainingWork: this.remaining,
        nominals: this.nominals,
        predicates: this.predicates,
        clauses: this.clauses,
        proofs: this.proofs,
        certificates: this.certificates,
        candidateStates: this.candidateStates,
        privateCandidates: this.privateCandidates,
        opaqueSelections: this.opaqueSelections,
      })
    );
  };
}
const compileRoles = (claim: PatentClaim, evidence: ClaimLexicalEvidence): O.Option<ClaimClauseRolePlan> => {
  if (evidence.status !== "aligned" || evidence.qualifiedText !== claim.claimText) return O.none();
  if (claim.claimText.length > 32_768 || evidence.tokens.length > 8_192) return O.none();
  // Reserve the initial source/token work before validating any provider span.
  if (evidence.tokens.length * 32 + claim.claimText.length > 262_144 - evidence.lexicalWorkConsumed) return O.none();
  if (!validClaimLexicalTokens(claim.claimText, evidence.tokens)) return O.none();
  return new RoleCompiler(claim, evidence.tokens, O.some(evidence)).run();
};
/**
 * Normalize an anchored nominal's lexical head without inventing source.
 *
 * **Example** (Normalize the supplied anchored head)
 *
 * ```ts
 * import { ClaimNominalSpan, clauseNominalHead } from "@beep/law-practice-domain/values/ClaimElement"
 * import { TextAnchor } from "@beep/provenance/TextAnchor"
 *
 * const nominal = ClaimNominalSpan.make({
 *   anchor: TextAnchor.make({ startChar: 0, endChar: 8, quote: "a SENSOR" }),
 *   head: TextAnchor.make({ startChar: 2, endChar: 8, quote: "SENSOR" }),
 *   determiner: "a",
 *   role: "legacy"
 * })
 * console.log(clauseNominalHead(nominal)) // sensor
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const clauseNominalHead = (nominal: ClaimNominalSpan): string => normalized(nominal.head.quote);
/**
 * Validate exact provider spans.
 *
 * **Example** (Check an exact provider span without asserting a semantic role)
 *
 * ```ts
 * import { ClaimLexicalToken, validClaimLexicalTokens } from "@beep/law-practice-domain/values/ClaimElement"
 * import { TextAnchor } from "@beep/provenance/TextAnchor"
 * import * as O from "effect/Option"
 *
 * const token = ClaimLexicalToken.make({
 *   anchor: TextAnchor.make({ startChar: 0, endChar: 6, quote: "sensor" }),
 *   pos: "NOUN",
 *   lemma: O.some("sensor")
 * })
 * console.log(validClaimLexicalTokens("sensor", [token])) // true
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validClaimLexicalTokens: {
  (tokens: ReadonlyArray<ClaimLexicalToken>): (text: string) => boolean;
  (text: string, tokens: ReadonlyArray<ClaimLexicalToken>): boolean;
} = dual(2, validTokens);
/**
 * Compile an atomic source role plan.
 *
 * **Example** (Decline when the provider supplied no lexical evidence)
 *
 * ```ts
 * import { ClaimLexicalEvidence, compileClaimClauseRoles } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as O from "effect/Option"
 * import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument"
 *
 * const claim = PatentClaim.cases.independent.make({ claimNumber: 1, claimText: "A system comprising a sensor.", preamble: "A system", transition: "comprising", body: "a sensor." })
 * const unavailable = ClaimLexicalEvidence.cases.unavailable.make({ sourceKey: "example", sourceOrdinal: 1, qualifiedText: claim.claimText, reason: "tokenization-failed" })
 * console.log(O.isNone(compileClaimClauseRoles(claim, unavailable))) // true
 * ```
 *
 * @category parsing
 * @since 0.0.0
 */
export const compileClaimClauseRoles: {
  (evidence: ClaimLexicalEvidence): (claim: PatentClaim) => O.Option<ClaimClauseRolePlan>;
  (claim: PatentClaim, evidence: ClaimLexicalEvidence): O.Option<ClaimClauseRolePlan>;
} = dual(2, compileRoles);

/**
 * Validate actual finite proof fields and source scope before atomic projection.
 *
 * **Example** (Reject proof validation when no work is available)
 *
 * ```ts
 * import { validateClaimFiniteSourceProofs } from "@beep/law-practice-domain/values/ClaimElement"
 * import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument"
 *
 * const claim = PatentClaim.cases.independent.make({ claimNumber: 1, claimText: "A system comprising a sensor.", preamble: "A system", transition: "comprising", body: "a sensor." })
 * console.log(validateClaimFiniteSourceProofs(claim, [], [], [], () => false)) // false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateClaimFiniteSourceProofs: {
  (
    tokens: ReadonlyArray<ClaimLexicalToken>,
    proofs: ReadonlyArray<ClaimFiniteSourceProof>,
    sourceProofs: ReadonlyArray<ClaimSourceProof>,
    charge: (amount: number) => boolean
  ): (claim: PatentClaim) => boolean;
  (
    claim: PatentClaim,
    tokens: ReadonlyArray<ClaimLexicalToken>,
    proofs: ReadonlyArray<ClaimFiniteSourceProof>,
    sourceProofs: ReadonlyArray<ClaimSourceProof>,
    charge: (amount: number) => boolean
  ): boolean;
} = dual(5, validateFiniteProofRegistry);

/**
 * Validate against the immutable original aligned input; raw intrinsic facts cannot use reconstructed tokens.
 *
 * **Example** (Reject unavailable original lexical input)
 *
 * ```ts
 * import { ClaimLexicalEvidence, validateClaimFiniteSourceProofsFromOriginalInput } from "@beep/law-practice-domain/values/ClaimElement"
 * import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument"
 *
 * const claim = PatentClaim.cases.independent.make({ claimNumber: 1, claimText: "A system comprising a sensor.", preamble: "A system", transition: "comprising", body: "a sensor." })
 * const unavailable = ClaimLexicalEvidence.cases.unavailable.make({ sourceKey: "example", sourceOrdinal: 1, qualifiedText: claim.claimText, reason: "alignment-failed" })
 * console.log(validateClaimFiniteSourceProofsFromOriginalInput(claim, unavailable, [], [], () => true)) // false
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const validateClaimFiniteSourceProofsFromOriginalInput: {
  (
    input: ClaimLexicalEvidence,
    proofs: ReadonlyArray<ClaimFiniteSourceProof>,
    sourceProofs: ReadonlyArray<ClaimSourceProof>,
    charge: (amount: number) => boolean
  ): (claim: PatentClaim) => boolean;
  (
    claim: PatentClaim,
    input: ClaimLexicalEvidence,
    proofs: ReadonlyArray<ClaimFiniteSourceProof>,
    sourceProofs: ReadonlyArray<ClaimSourceProof>,
    charge: (amount: number) => boolean
  ): boolean;
} = dual(
  5,
  (
    claim: PatentClaim,
    input: ClaimLexicalEvidence,
    proofs: ReadonlyArray<ClaimFiniteSourceProof>,
    sourceProofs: ReadonlyArray<ClaimSourceProof>,
    charge: (amount: number) => boolean
  ) =>
    input.status === "aligned" &&
    charge(1) &&
    validateFiniteProofRegistry(claim, input.tokens, proofs, sourceProofs, charge, O.some(input))
);

/**
 * Resolve the finite role intrinsic to one source certificate variant.
 *
 * **Example** (Read the slot of a decoded raw scope variant)
 *
 * ```ts
 * import { ClaimFiniteSourceProof, claimFiniteSourceProofSlot } from "@beep/law-practice-domain/values/ClaimElement"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 *
 * const decoded = S.decodeUnknownOption(ClaimFiniteSourceProof)({ kind: "scope", ordinal: 1, rank: -3, role: "body", extent: { startChar: 0, endChar: 6, quote: "sensor" } })
 * console.log(O.getOrElse(O.map(decoded, claimFiniteSourceProofSlot), () => "unavailable")) // scope
 * // Slot inspection does not validate this record against a qualified claim.
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const claimFiniteSourceProofSlot = finiteProofSlot;
