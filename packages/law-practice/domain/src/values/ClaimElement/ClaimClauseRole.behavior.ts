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
import { ClaimClauseRolePlan, ClaimClauseSpan, ClaimNominalSpan, ClaimPredicateSpan } from "./ClaimClauseRole.model.ts";
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
  return ["bare", HashSet.has(articleWords, wordAt(tokens, index)) || demonstrativeThat(tokens, index) ? 1 : 0, 0];
};
const determiner = (
  tokens: ReadonlyArray<ClaimLexicalToken>,
  index: number
): readonly [ClaimTermDeterminer, number, number] =>
  O.getOrElse(quantityDeterminer(tokens, index), () => articleDeterminer(tokens, index));
const relativeSubjectAt = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean =>
  HashSet.has(HashSet.make("that", "which"), wordAt(tokens, index - 1)) &&
  HashSet.has(nominalTags, tagAt(tokens, index - 2));
const singularLexicalSubject = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean =>
  O.exists(
    at(tokens, index - 1),
    (token) =>
      token.pos === "NOUN" &&
      O.exists(token.lemma, (lemma) => normalized(lemma) === word(token)) &&
      !Str.endsWith("s")(word(token))
  );
const inflectedNounPredicate = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean => {
  if (!at(tokens, index).pipe(O.getOrThrow, regularPlural)) return false;
  if (singularLexicalSubject(tokens, index) && HashSet.has(articleWords, wordAt(tokens, index + 1))) return true;
  return relativeSubjectAt(tokens, index) && HashSet.has(nominalTags, tagAt(tokens, index + 1));
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
const finitePosition = (tokens: ReadonlyArray<ClaimLexicalToken>, index: number): boolean => {
  if (HashSet.has(HashSet.make("that", "which"), wordAt(tokens, index - 1))) return true;
  if (HashSet.has(nominalTags, tagAt(tokens, index - 1))) return true;
  if (tagAt(tokens, index - 1) === "ADV" && HashSet.has(nominalTags, tagAt(tokens, index - 2))) return true;
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
    tagAt(tokens, start) === "NUM" ||
    HashSet.has(HashSet.make("two", "three", "four", "several", "many"), wordAt(tokens, start))
  )
    return "quantified-introduction";
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
      if (this.protected(index)) continue;
      O.map(predicateKind(this.tokens, index), (kind) => {
        this.predicates.push(ClaimPredicateSpan.make({ anchor: O.getOrThrow(at(this.tokens, index)).anchor, kind }));
        this.predicateIndexes = HashSet.add(this.predicateIndexes, index);
      });
    }
    return true;
  };
  private adjunct = (index: number): boolean => {
    const adjacent = HashSet.has(this.predicateIndexes, index - 1) || HashSet.has(this.predicateIndexes, index + 1);
    const particle = HashSet.has(HashSet.make("ADV", "PART"), tagAt(this.tokens, index)) && adjacent;
    const discourse =
      surface(this.tokens, index - 1, "in response") &&
      HashSet.has(HashSet.make(",", "to"), wordAt(this.tokens, index + 1));
    return particle || discourse;
  };
  private readAdjuncts = (): boolean => {
    for (let index = 0; index < this.tokens.length; index++) {
      if (!this.charge(1)) return false;
      if (this.protected(index) || !this.adjunct(index)) continue;
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
    A.some([auxiliaries, clauseWords, articleWords, stopWords, punctuation, connectors], (words) =>
      HashSet.has(words, wordAt(this.tokens, index))
    );
  private aliasAt = (index: number): boolean =>
    wordAt(this.tokens, index) === "(" &&
    O.exists(at(this.tokens, index + 1), (token) => O.isSome(Str.match(/^[A-Z][A-Z0-9-]+$/u)(token.anchor.quote))) &&
    wordAt(this.tokens, index + 2) === ")";
  private modifierAt = (index: number, hasNoun: boolean, width: number): boolean => {
    const tag = tagAt(this.tokens, index);
    if (HashSet.has(modifierTags, tag)) return true;
    if (tag === "ADV" && tagAt(this.tokens, index + 1) === "ADJ") return true;
    return tag === "VERB" && !hasNoun && width > 0 && HashSet.has(nominalTags, tagAt(this.tokens, index + 1));
  };
  private nominalAdvance = (index: number, hasNoun: boolean, width: number): readonly [number, boolean] => {
    if (this.quoted(index)) return [1, true];
    if (this.aliasAt(index)) return [3, false];
    if (this.nominalBarrier(index)) return [0, false];
    if (HashSet.has(nominalTags, tagAt(this.tokens, index))) return [1, true];
    return [this.modifierAt(index, hasNoun, width) ? 1 : 0, false];
  };
  private nominalEnd = (start: number, width: number): O.Option<number> => {
    let end = start + width;
    let hasNoun = false;
    while (end < this.tokens.length) {
      if (!this.charge(1)) return O.none();
      const [advance, noun] = this.nominalAdvance(end, hasNoun, width);
      if (advance === 0) break;
      hasNoun = hasNoun || noun;
      end += advance;
    }
    return hasNoun && end > start + width ? O.some(end) : O.none();
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
    return O.exists(at(this.tokens, cursor), singularAgreement);
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
    let role = nominalRole(this.claim, this.tokens, start, start + width, end, kind, this.predicateIndexes);
    if (kind === "bare" && HashSet.has(this.names, start)) role = "explicit-name";
    if (kind === "bare" && role === "unknown" && this.coordinatedPlural(start, end)) role = "generic-plural";
    if (role === "generic-plural" && this.contradictoryPluralRelative(end)) role = "unknown";
    this.nominals.push(
      ClaimNominalSpan.make({
        anchor: anchor(this.claim.claimText, first, last),
        head: anchor(this.claim.claimText, head, last),
        determiner: kind,
        role,
      })
    );
  };
  private readNominalAt = (index: number): number => {
    const [kind, width, headWidth] = determiner(this.tokens, index);
    if (this.protected(index) && !this.quoted(index)) return index + 1;
    if (width === 0 && this.nominalBarrier(index)) return index + 1;
    const end = this.nominalEnd(index, width);
    if (O.isNone(end)) return index + 1;
    this.appendNominal(index, end.value, kind, headWidth, width);
    return end.value;
  };
  private readNominals = (): boolean => {
    for (let index = 0; index < this.tokens.length; ) {
      if (!this.charge(1)) return false;
      index = this.readNominalAt(index);
    }
    return this.remaining >= 0;
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
      this.readPredicates,
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
        nominals: this.nominals,
        predicates: this.predicates,
        clauses: this.clauses,
      })
    );
  };
}
const compileRoles = (claim: PatentClaim, evidence: ClaimLexicalEvidence): O.Option<ClaimClauseRolePlan> => {
  if (evidence.status !== "aligned" || evidence.qualifiedText !== claim.claimText) return O.none();
  if (claim.claimText.length > 32_768 || evidence.tokens.length > 8_192) return O.none();
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
