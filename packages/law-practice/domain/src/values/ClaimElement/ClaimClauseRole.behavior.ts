/**
 * Bounded source-aligned clause/nominal role compiler.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { TextAnchor } from "@beep/provenance/TextAnchor";
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Str from "effect/String";
import {
  ClaimClauseRolePlan,
  ClaimClauseSpan,
  ClaimNominalSpan,
  ClaimPredicateSpan,
  ClaimSourceProof,
} from "./ClaimClauseRole.model.ts";
import type { PatentClaim } from "../PatentDocument/PatentDocument.model.ts";
import type { ClaimNominalPolicyRole } from "./ClaimClauseRole.model.ts";
import type { ClaimTermDeterminer } from "./ClaimElement.model.ts";
import type { ClaimLexicalEvidence, ClaimLexicalToken } from "./ClaimLexicalEvidence.model.ts";

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
  private readonly nominals: Array<ClaimNominalSpan> = [];
  private readonly clauses: Array<ClaimClauseSpan> = [];
  private readonly proofs: Array<ClaimSourceProof> = [];
  private supported = true;
  private firstAction = O.none<Extract<ClaimSourceProof, { readonly kind: "action" }>>();
  private previousActionObjectEnd = -1;
  private clauseStart = 0;
  private clauseKind: typeof ClaimClauseSpan.Type.kind = "main";
  private introducer = O.none<TextAnchor>();
  private readonly claim: PatentClaim;
  private readonly tokens: ReadonlyArray<ClaimLexicalToken>;
  constructor(claim: PatentClaim, tokens: ReadonlyArray<ClaimLexicalToken>) {
    this.claim = claim;
    this.tokens = tokens;
  }
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
      object: this.tokenSpan(index + 1, end),
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
      object: this.tokenSpan(index + 1, end),
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
  private readActionAt = (index: number): boolean => {
    const slot = this.actionSlot(index);
    if (O.isNone(slot) || !HashSet.has(articleWords, wordAt(this.tokens, index + 1))) return true;
    const end = this.headedComplement(index + 1);
    if (O.isNone(end)) return true;
    if (!this.charge(4)) return false;
    if (!HashSet.has(this.predicateIndexes, index)) this.markPredicate(index, index + 1, "gerund");
    if (!this.recordActionProof(index, end.value, slot.value)) return false;
    this.previousActionObjectEnd = end.value;
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
  private modifierAt = (index: number, width: number): boolean => {
    const tag = tagAt(this.tokens, index);
    if (HashSet.has(modifierTags, tag)) return true;
    if (
      tag === "ADV" &&
      (tagAt(this.tokens, index + 1) === "ADJ" ||
        (this.regularParticiple(index + 1) && HashSet.has(nominalTags, tagAt(this.tokens, index + 2))))
    )
      return true;
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
    return [this.modifierAt(index, width) ? 1 : 0, false];
  };
  private nominalComplete = (start: number, end: number, width: number, hasNoun: boolean): boolean => {
    if (end <= start + width) return false;
    return hasNoun || (width > 0 && tagAt(this.tokens, end - 1) === "ADJ" && HashSet.has(this.predicateIndexes, end));
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
    HashSet.has(nominalTags, tagAt(this.tokens, end - 1));
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
      this.readNominals,
      this.readPossession,
      this.readClauses,
    ];
    if (!A.every(passes, (pass) => pass())) return O.none();
    return O.some(
      ClaimClauseRolePlan.make({
        qualifiedText: this.claim.claimText,
        remainingWork: this.remaining,
        nominals: this.nominals,
        predicates: this.predicates,
        clauses: this.clauses,
        proofs: this.proofs,
      })
    );
  };
}
const compileRoles = (claim: PatentClaim, evidence: ClaimLexicalEvidence): O.Option<ClaimClauseRolePlan> => {
  if (evidence.status !== "aligned" || evidence.qualifiedText !== claim.claimText) return O.none();
  if (claim.claimText.length > 32_768 || evidence.tokens.length > 8_192) return O.none();
  // Reserve the initial source/token work before validating any provider span.
  if (evidence.tokens.length * 32 + claim.claimText.length > 262_144) return O.none();
  if (!validClaimLexicalTokens(claim.claimText, evidence.tokens)) return O.none();
  return new RoleCompiler(claim, evidence.tokens).run();
};
/**
 * Normalize an anchored nominal's lexical head without inventing source.
 *
 * @category parsing
 * @since 0.0.0
 */
export const clauseNominalHead = (nominal: ClaimNominalSpan): string => normalized(nominal.head.quote);
/**
 * Validate exact provider spans.
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
 * @category parsing
 * @since 0.0.0
 */
export const compileClaimClauseRoles: {
  (evidence: ClaimLexicalEvidence): (claim: PatentClaim) => O.Option<ClaimClauseRolePlan>;
  (claim: PatentClaim, evidence: ClaimLexicalEvidence): O.Option<ClaimClauseRolePlan>;
} = dual(2, compileRoles);
