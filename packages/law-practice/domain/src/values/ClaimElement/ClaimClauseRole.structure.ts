/**
 * Bounded source-frame to element-plan compiler for enhanced inspection.
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
  ClaimAttachedNominal,
  ClaimClauseRolePlan,
  ClaimFrameArgument,
  ClaimListDeclaration,
  ClaimPlannedElement,
  ClaimSourceElementPlan,
  ClaimSourceFrame,
} from "./ClaimClauseRole.model.ts";
import type { PatentClaim } from "../PatentDocument/PatentDocument.model.ts";
import type { ClaimElementGrouping, ClaimNominalSpan, ClaimPredicateSpan } from "./ClaimClauseRole.model.ts";
import type { ClaimLexicalToken } from "./ClaimLexicalEvidence.model.ts";

const compositions = HashSet.make("includes", "including", "comprises", "comprising", "having");
const separators = HashSet.make(",", ";", "and", "or");
const relatives = HashSet.make("that", "which", "wherein", "whereby", "when", "if", "while");
// Closed grammatical location markers; lexical ADP alone does not prove an
// NP modifier (for example, directional/purpose/complement to/for/by).
const locativePP = HashSet.make(
  "in",
  "on",
  "at",
  "under",
  "over",
  "above",
  "below",
  "beneath",
  "within",
  "inside",
  "outside",
  "between",
  "among",
  "behind",
  "beside",
  "near"
);
const articles = HashSet.make("a", "an", "the", "said", "each", "its", "their", "this", "these", "those");
const romanLabel = /^(?=[ivxlcdm]+$)m*(?:cm|cd|d?c{0,3})(?:xc|xl|l?x{0,3})(?:ix|iv|v?i{0,3})$/u;
const romanValues = HashMap.make(["i", 1], ["v", 5], ["x", 10], ["l", 50], ["c", 100], ["d", 500], ["m", 1000]);
const inside = (outer: TextAnchor, inner: TextAnchor): boolean =>
  inner.startChar >= outer.startChar && inner.endChar <= outer.endChar;

const optionalProof = <Value>(option: O.Option<Value>, proof: (value: Value) => boolean): boolean =>
  O.match(option, { onNone: () => true, onSome: proof });

// Operational state is local to one compilation. All accepted data uses the
// domain schemas; no provisional entry is visible to route resolution.
class SourcePlanner {
  private remaining: number;
  private readonly elements: Array<ClaimPlannedElement> = [];
  private readonly frames: Array<ClaimSourceFrame> = [];
  private readonly declarations: Array<ClaimListDeclaration> = [];
  private attached: ReadonlyArray<ClaimAttachedNominal> = [];
  private nominalEventOwners = HashMap.empty<number, TextAnchor>();
  private frameByElement = HashMap.empty<number, number>();
  private protected = HashSet.empty<number>();
  private tokenIndex = HashMap.empty<number, number>();
  private spans = HashMap.empty<string, TextAnchor>();
  constructor(
    claim: PatentClaim,
    roles: ClaimClauseRolePlan,
    tokens: ReadonlyArray<ClaimLexicalToken>,
    preamble: TextAnchor,
    body: TextAnchor
  ) {
    this.remaining = roles.remainingWork;
    this.claim = claim;
    this.roles = roles;
    this.tokens = tokens;
    this.preamble = preamble;
    this.body = body;
  }
  private readonly claim: PatentClaim;
  private readonly roles: ClaimClauseRolePlan;
  private readonly tokens: ReadonlyArray<ClaimLexicalToken>;
  private readonly preamble: TextAnchor;
  private readonly body: TextAnchor;
  private charge = (amount: number): boolean => {
    this.remaining -= amount;
    return this.remaining >= 0;
  };
  private token = (index: number): O.Option<ClaimLexicalToken> => A.get(this.tokens, index);
  private word = (index: number): string =>
    O.match(this.token(index), { onNone: () => "", onSome: (t) => Str.toLowerCase(t.anchor.quote) });
  private span = (start: number, end: number): TextAnchor => {
    if (start < 0 || end <= start || end > this.tokens.length || !this.charge(2)) {
      this.remaining = -1;
      return this.preamble;
    }
    const startChar = O.getOrThrow(this.token(start)).anchor.startChar;
    const endChar = O.getOrThrow(this.token(end - 1)).anchor.endChar;
    const key = `${startChar}:${endChar}`;
    const cached = HashMap.get(this.spans, key);
    if (O.isSome(cached)) return cached.value;
    // Returning an existing anchor on exhausted operational state allocates no
    // invented source. Every output path rejects the negative reservation.
    if (!this.charge(endChar - startChar + 2)) return this.preamble;
    const value = TextAnchor.make({ startChar, endChar, quote: Str.slice(startChar, endChar)(this.claim.claimText) });
    this.spans = HashMap.set(this.spans, key, value);
    return value;
  };
  private located = (span: TextAnchor): ReadonlyArray<number> =>
    A.filter(A.range(0, this.tokens.length - 1), (i) => O.exists(this.token(i), (t) => inside(span, t.anchor)));
  private owned = (span: TextAnchor): ReadonlyArray<ClaimNominalSpan> =>
    A.filter(this.roles.nominals, (n) => inside(span, n.anchor));
  private predicates = (span: TextAnchor) =>
    A.filter(this.roles.predicates, (p) => inside(span, p.anchor) && p.kind !== "adjunct");
  private trimEnd = (start: number, end: number): number => {
    while (end > start && HashSet.has(HashSet.make(".", ";", ","), this.word(end - 1))) end--;
    return end;
  };
  private trimStart = (start: number, end: number): number => {
    while (start < end && HashSet.has(HashSet.make("and", "or", ",", ";"), this.word(start))) start++;
    return start;
  };
  private reserve = (span: TextAnchor): boolean =>
    this.charge(this.roles.nominals.length + this.roles.predicates.length + span.quote.length + 1);
  private protectedSource = (): boolean => {
    if (!this.charge(this.claim.claimText.length + this.tokens.length * 2)) return false;
    const quotes = A.fromIterable(
      Str.matchAll(/"(?:\\.|[^"\\])*"|“[^”]*”|‘(?:[^’]|’(?=[\p{L}\p{N}]))*’/gu)(this.claim.claimText)
    );
    if (!this.charge(this.tokens.length * (quotes.length + 1))) return false;
    for (let i = 0; i < this.tokens.length; i++) {
      const t = O.getOrThrow(this.token(i));
      this.tokenIndex = HashMap.set(this.tokenIndex, t.anchor.startChar, i);
      if (
        A.some(
          quotes,
          (q) => q.index !== undefined && t.anchor.startChar >= q.index && t.anchor.startChar < q.index + q[0].length
        )
      )
        this.protected = HashSet.add(this.protected, i);
    }
    return true;
  };
  private modifierArgument = (
    previous: O.Option<ClaimNominalSpan>,
    predicate: O.Option<ClaimPredicateSpan>,
    before: O.Option<ClaimLexicalToken>
  ): boolean => {
    if (!O.exists(before, (t) => t.pos === "ADP")) return false;
    const spelling = O.match(before, { onNone: () => "", onSome: (t) => Str.toLowerCase(t.anchor.quote) });
    const nominalOnly = HashSet.has(locativePP, spelling) || HashSet.has(HashSet.make("of", "with"), spelling);
    if (!nominalOnly) return false;
    if (O.isNone(predicate)) return O.isSome(previous);
    // A genitive of-phrase inside an already introduced PP has a nominal
    // governor. A finite predicate's object followed by a PP has no such proof.
    if (spelling !== "of") return false;
    return O.exists(previous, (left) => {
      if (O.exists(predicate, (governor) => left.anchor.endChar <= governor.anchor.endChar)) return false;
      const index = HashMap.get(this.tokenIndex, left.anchor.startChar);
      return O.exists(
        O.flatMap(index, (i) => this.token(i - 1)),
        (token) => token.pos === "ADP"
      );
    });
  };
  private argumentRole = (
    subject: boolean,
    modifier: boolean,
    prep: boolean,
    predicate: boolean
  ): ClaimFrameArgument["role"] => {
    if (subject) return "subject";
    if (modifier) return "nominal-modifier";
    if (prep) return "prepositional-complement";
    return predicate ? "object" : "unknown";
  };
  private argumentHead = (
    subject: boolean,
    modifier: boolean,
    first: O.Option<ClaimPredicateSpan>,
    predicate: O.Option<ClaimPredicateSpan>
  ): O.Option<ClaimPredicateSpan> => {
    if (modifier) return O.none();
    return subject ? first : predicate;
  };
  private argumentPlan = (
    span: TextAnchor,
    nominals: ReadonlyArray<ClaimNominalSpan>,
    operators: ReadonlyArray<TextAnchor>
  ): {
    readonly subject: O.Option<TextAnchor>;
    readonly arguments: ReadonlyArray<ClaimFrameArgument>;
  } => {
    if (!this.charge(this.roles.predicates.length + (nominals.length + 1) * (this.roles.predicates.length * 2 + 4)))
      return { subject: O.none(), arguments: [] };
    const predicates = this.predicates(span);
    const first = A.findFirst(
      predicates,
      (p) => p.kind === "finite" || p.kind === "auxiliary-head" || p.kind === "possession"
    );
    const subject = O.flatMap(first, (p) =>
      O.map(
        A.findLast(nominals, (n) => n.anchor.endChar <= p.anchor.startChar),
        (n) => n.anchor
      )
    );
    const args = A.map(nominals, (n, ordinal) => {
      const index = HashMap.get(this.tokenIndex, n.anchor.startChar);
      const before = O.flatMap(index, (i) => this.token(i - 1));
      const predicate = A.findLast(predicates, (p) => p.anchor.endChar <= n.anchor.startChar);
      const previous = A.get(nominals, ordinal - 1);
      const prep = O.exists(before, (t) => t.pos === "ADP");
      const modifier = this.modifierArgument(previous, predicate, before);
      const isSubject = O.exists(subject, (a) => a.startChar === n.anchor.startChar);
      const role = this.argumentRole(isSubject, modifier, prep, O.isSome(predicate));
      const head = this.argumentHead(isSubject, modifier, first, predicate);
      const operator = O.flatMap(head, (p) => A.findFirst(operators, (op) => inside(op, p.anchor)));
      return ClaimFrameArgument.make({
        role,
        nominal: n.anchor,
        predicate: operator,
        ownerNominal: modifier ? O.map(previous, (left) => left.anchor) : O.none(),
      });
    });
    return { subject, arguments: args };
  };
  private auxiliaryOperator = (previous: ClaimPredicateSpan, predicate: ClaimPredicateSpan): boolean =>
    previous.kind === "auxiliary-head" &&
    HashSet.has(HashSet.make("auxiliary", "adjectival", "auxiliary-head"), predicate.kind);
  private licensedOperatorGap = (from: number, to: number): boolean => {
    const length = to - from;
    if (!this.charge(this.tokens.length + length * (this.roles.predicates.length + 1))) return false;
    return A.every(
      this.tokens,
      (token) =>
        token.anchor.startChar < from ||
        token.anchor.endChar > to ||
        A.some(this.roles.predicates, (p) => p.kind === "adjunct" && p.anchor.startChar === token.anchor.startChar)
    );
  };
  private operators = (predicates: ReadonlyArray<ClaimPredicateSpan>): ReadonlyArray<TextAnchor> => {
    if (!this.charge(predicates.length * 2 + 1)) return [];
    const result: Array<TextAnchor> = [];
    let previous = O.none<ClaimPredicateSpan>();
    for (const predicate of predicates) {
      const merge = O.exists(
        previous,
        (p) =>
          this.auxiliaryOperator(p, predicate) && this.licensedOperatorGap(p.anchor.endChar, predicate.anchor.startChar)
      );
      if (this.remaining < 0) return [];
      if (merge && result.length > 0) {
        const head = O.getOrThrow(A.last(result));
        const start = O.getOrThrow(HashMap.get(this.tokenIndex, head.startChar));
        const end = O.getOrThrow(HashMap.get(this.tokenIndex, predicate.anchor.startChar)) + 1;
        result[result.length - 1] = this.span(start, end);
      } else result.push(predicate.anchor);
      previous = O.some(predicate);
    }
    return result;
  };
  private setOuter = (core: TextAnchor, extent: TextAnchor): boolean => {
    if (!this.charge(this.attached.length * 2 + extent.endChar - core.startChar + 1)) return false;
    this.attached = A.map(this.attached, (n) =>
      n.core.startChar === core.startChar && n.core.endChar === core.endChar
        ? ClaimAttachedNominal.make({
            ...n,
            outer: TextAnchor.make({
              startChar: core.startChar,
              endChar: extent.endChar,
              quote: Str.slice(core.startChar, extent.endChar)(this.claim.claimText),
            }),
          })
        : n
    );
    return true;
  };
  private adjectiveProperty = (
    predicates: ReadonlyArray<ClaimPredicateSpan>,
    nominals: ReadonlyArray<ClaimNominalSpan>
  ): boolean =>
    predicates.length > 0 &&
    A.every(predicates, (p) => p.kind === "auxiliary-head" || p.kind === "adjectival") &&
    A.some(predicates, (p) => p.kind === "adjectival") &&
    !A.some(nominals, (n) => O.exists(A.head(predicates), (p) => n.anchor.startChar > p.anchor.endChar));
  private elementKind = (
    grouping: ClaimElementGrouping,
    container: boolean,
    property: boolean,
    predicates: ReadonlyArray<ClaimPredicateSpan>
  ): ClaimPlannedElement["kind"] => {
    if (grouping === "preamble") return "preamble-subject";
    if (container || property) return "limitation";
    return A.some(predicates, (p) => p.kind !== "possession") ? "functional-relation" : "limitation";
  };
  private frameAttachment = (grouping: ClaimElementGrouping): ClaimSourceFrame["attachment"] =>
    HashSet.has(HashSet.make("composition-child", "enumeration-child"), grouping) ? "composition-child" : "main";
  private elementGrouping = (
    grouping: ClaimElementGrouping,
    property: boolean,
    container: boolean
  ): ClaimElementGrouping => (property && !container ? "adjectival-property" : grouping);
  private sourceIntroducer = (span: TextAnchor): O.Option<TextAnchor> =>
    O.flatMap(HashMap.get(this.tokenIndex, span.startChar), (i) =>
      HashSet.has(HashSet.make("where", "wherein"), this.word(i)) ? O.map(this.token(i), (t) => t.anchor) : O.none()
    );
  private add = (
    span: TextAnchor,
    header: TextAnchor,
    parent: O.Option<number>,
    grouping: ClaimElementGrouping,
    container: boolean
  ): O.Option<number> => {
    if (!this.reserve(span)) return O.none();
    const nominals = this.owned(header);
    const predicates = this.predicates(span);
    const property = this.adjectiveProperty(predicates, nominals);
    const kind = this.elementKind(grouping, container, property, predicates);
    if (nominals.length === 0 && predicates.length === 0) return O.none();
    if (!this.charge(nominals.length + predicates.length + 2)) return O.none();
    const operators = this.operators(predicates);
    const args = this.argumentPlan(span, nominals, operators);
    if (this.remaining < 0) return O.none();
    if (!this.charge(this.attached.length + nominals.length + 1)) return O.none();
    const ordinal = this.elements.length + 1;
    this.elements.push(
      ClaimPlannedElement.make({
        ordinal,
        parent,
        extent: span,
        lexicalHeader: header,
        kind,
        grouping: this.elementGrouping(grouping, property, container),
        nominals,
      })
    );
    const frame = this.frames.length + 1;
    const introduced = this.sourceIntroducer(span);
    this.frames.push(
      ClaimSourceFrame.make({
        ordinal: frame,
        extent: span,
        lexicalHeader: header,
        parent: O.flatMap(
          O.filter(parent, (value) => value !== 1),
          (value) => HashMap.get(this.frameByElement, value)
        ),
        attachment: this.frameAttachment(grouping),
        introducer: introduced,
        predicates: operators,
        nominals: A.map(nominals, (n) => n.anchor),
        coordination: O.none(),
        sharedSubject: O.none(),
        ...args,
      })
    );
    this.frameByElement = HashMap.set(this.frameByElement, ordinal, frame);
    this.attached = A.appendAll(
      this.attached,
      A.map(nominals, (n) => ClaimAttachedNominal.make({ core: n.anchor, head: n.head, outer: n.anchor, nominal: n }))
    );
    return O.some(ordinal);
  };
  private label = (index: number): O.Option<readonly [string, number]> => {
    const label = this.word(index + 1);
    if (
      this.word(index) === "(" &&
      this.word(index + 2) === ")" &&
      (O.isSome(Str.match(/^[a-z]$/u)(label)) || O.isSome(Str.match(romanLabel)(label)))
    )
      return O.some([label, index + 3]);
    return O.none();
  };
  private romanRank = (label: string): number => {
    let total = 0;
    let previous = 0;
    for (let i = label.length - 1; i >= 0; i--) {
      const value = O.getOrThrow(HashMap.get(romanValues, Str.slice(i, i + 1)(label)));
      total += value < previous ? -value : value;
      if (value > previous) previous = value;
    }
    return total - 1;
  };
  private alphabetRank = (label: string): number =>
    label.length === 1 ? O.getOrThrow(Str.charCodeAt(0)(label)) - 97 : -1;
  private labelRank = (label: string, roman: boolean): number => {
    if (!this.charge(label.length + 1)) return -1;
    if (!roman) return this.alphabetRank(label);
    return O.isSome(Str.match(romanLabel)(label)) ? this.romanRank(label) : -1;
  };
  private bracketStep = (word: string): number => {
    if (word === "(" || word === "[") return 1;
    return word === ")" || word === "]" ? -1 : 0;
  };
  private topLevel = (start: number, end: number): O.Option<ReadonlyArray<number>> => {
    if (!this.charge((end - start) * 2 + 1)) return O.none();
    const result: Array<number> = [];
    let depth = 0;
    for (let i = start; i < end; i++) {
      if (HashSet.has(this.protected, i)) continue;
      depth += this.bracketStep(this.word(i));
      if (depth === 0) result.push(i);
    }
    return O.some(result);
  };
  private topColon = (start: number, end: number): O.Option<number> =>
    O.flatMap(this.topLevel(start, end), (indexes) => A.findFirst(indexes, (i) => this.word(i) === ":"));
  private otherLabelFamily = (label: string, roman: boolean): boolean =>
    roman
      ? O.isSome(Str.match(/^[a-z]$/u)(label)) && O.isNone(Str.match(romanLabel)(label))
      : O.isSome(Str.match(romanLabel)(label));
  private nestedLabelStep = (index: number, rank: number, expected: number): number =>
    rank === expected ? -1 : index + 1;
  private listMarkers = (
    colon: number,
    end: number,
    roman: boolean
  ): O.Option<ReadonlyArray<readonly [number, number]>> => {
    const markers: Array<readonly [number, number]> = [];
    let nested = false;
    const accept = (index: number): number => {
      if (HashSet.has(this.protected, index)) return index + 1;
      if (this.word(index) === ":") {
        nested = true;
        return index + 1;
      }
      const label = this.label(index);
      if (O.isNone(label)) return index + 1;
      const rank = this.labelRank(label.value[0], roman);
      if (nested && this.otherLabelFamily(label.value[0], roman))
        return this.nestedLabelStep(index, rank, markers.length);
      if (rank !== markers.length || !this.charge(2)) return -1;
      markers.push([index, label.value[1]]);
      nested = false;
      return label.value[1];
    };
    for (let i = colon + 1; i < end; ) {
      if (!this.charge(1)) return O.none();
      i = accept(i);
      if (i < 0) return O.none();
    }
    return O.some(markers);
  };
  private listOwner = (start: number, end: number, colon: number, parent: number): O.Option<number> => {
    if (colon === start && parent === 1 && HashSet.has(compositions, this.claim.transition)) return O.some(parent);
    return this.add(this.span(start, end), this.span(start, colon), O.some(parent), "explicit-list-header", true);
  };
  private listItems = (
    markers: ReadonlyArray<readonly [number, number]>,
    end: number,
    owner: number,
    depth: number
  ): O.Option<ReadonlyArray<ClaimListDeclaration["items"][number]>> => {
    if (!this.charge(markers.length * 2 + 2)) return O.none();
    const items: Array<ClaimListDeclaration["items"][number]> = [];
    for (let i = 0; i < markers.length; i++) {
      const marker = O.getOrThrow(A.get(markers, i));
      const next = O.match(A.get(markers, i + 1), { onNone: () => end, onSome: (m) => m[0] });
      const child = this.elements.length + 1;
      const label = this.span(marker[0], marker[1]);
      if (!this.parse(marker[1], this.trimEnd(marker[1], next), owner, "enumeration-child", depth + 1)) return O.none();
      const item = this.span(this.trimStart(marker[1], next), this.trimEnd(marker[1], next));
      const projected = O.getOrThrow(A.get(this.elements, child - 1));
      if (projected.extent.startChar !== item.startChar || projected.extent.endChar !== item.endChar) return O.none();
      items.push({ label, child });
    }
    return O.some(items);
  };
  private recordDeclaration = (
    start: number,
    colon: number,
    owner: number,
    items: ReadonlyArray<ClaimListDeclaration["items"][number]>
  ): boolean => {
    const endChar = O.getOrThrow(this.token(colon)).anchor.endChar;
    const startChar = colon === start ? this.preamble.startChar : O.getOrThrow(this.token(start)).anchor.startChar;
    if (!this.charge(endChar - startChar + items.length + 1)) return false;
    this.declarations.push(
      ClaimListDeclaration.make({
        owner,
        anchor: TextAnchor.make({ startChar, endChar, quote: Str.slice(startChar, endChar)(this.claim.claimText) }),
        items,
      })
    );
    return true;
  };
  private labelled = (start: number, end: number, colon: number, parent: number, depth: number): boolean => {
    const first = this.label(colon + 1);
    if (O.isNone(first)) return false;
    const roman = first.value[0] === "i";
    if (this.labelRank(first.value[0], roman) !== 0) return false;
    const markers = this.listMarkers(colon, end, roman);
    if (O.isNone(markers) || markers.value.length < 2) return false;
    const owner = this.listOwner(start, end, colon, parent);
    if (O.isNone(owner)) return false;
    const items = this.listItems(markers.value, end, owner.value, depth);
    return O.exists(items, (values) => this.recordDeclaration(start, colon, owner.value, values));
  };
  private independent = (start: number, end: number): boolean => {
    if (!this.charge(this.roles.nominals.length + this.roles.predicates.length + 1)) return false;
    const skip = HashSet.has(HashSet.make("where", "wherein"), this.word(start)) ? start + 1 : start;
    const first = this.token(skip);
    if (O.isNone(first)) return false;
    const subject = A.findFirst(this.roles.nominals, (n) => n.anchor.startChar === first.value.anchor.startChar);
    if (O.isNone(subject)) return false;
    const predicate = A.findFirst(
      this.roles.predicates,
      (p) =>
        p.kind !== "adjunct" &&
        p.anchor.startChar >= subject.value.anchor.endChar &&
        p.anchor.endChar <= O.getOrThrow(this.token(end - 1)).anchor.endChar
    );
    if (O.isNone(predicate)) return false;
    const length = predicate.value.anchor.startChar - subject.value.anchor.endChar;
    if (!this.charge(length)) return false;
    const gap = Str.slice(subject.value.anchor.endChar, predicate.value.anchor.startChar)(this.claim.claimText);
    // A new subject must reach its own predicate without crossing a relative,
    // argument preposition, list separator or another explicit NP.
    return O.isNone(Str.match(/\b(?:that|which|of|with|in|on|for|to|a|an|the|said)\b|[,;:]/iu)(gap));
  };
  private precededByPredicate = (index: number): boolean => {
    if (!this.charge(this.roles.predicates.length + 1)) return false;
    return O.exists(this.token(index - 1), (t) =>
      A.some(this.roles.predicates, (p) => p.anchor.startChar === t.anchor.startChar)
    );
  };
  private boundaryDecision = (index: number, end: number, complement: boolean): O.Option<boolean> => {
    const word = this.word(index);
    if (!HashSet.has(separators, word)) return O.some(false);
    const right = this.trimStart(index + 1, end);
    if (right >= end || !this.independent(right, end)) return O.some(false);
    if (complement && HashSet.has(HashSet.make("and", "or"), word)) return O.none();
    return O.some(!complement);
  };
  private boundaries = (start: number, end: number): O.Option<ReadonlyArray<number>> => {
    const indexes = this.topLevel(start, end);
    if (O.isNone(indexes)) return O.none();
    const result: Array<number> = [];
    let complement = false;
    let skip = start;
    const accept = (index: number): boolean => {
      if (index < skip) return true;
      if (this.word(index) === "that") complement = complement || this.precededByPredicate(index);
      const decision = this.boundaryDecision(index, end, complement);
      if (O.isNone(decision)) return false;
      if (!decision.value) return true;
      if (!this.charge(1)) return false;
      result.push(index);
      skip = this.trimStart(index + 1, end);
      return true;
    };
    return A.every(indexes.value, accept) ? O.some(result) : O.none();
  };
  private compositionToken = (index: number): O.Option<boolean> => {
    if (HashSet.has(this.protected, index)) return O.some(false);
    if (HashSet.has(relatives, this.word(index))) return O.none();
    return O.some(HashSet.has(compositions, this.word(index)));
  };
  private compositionOperator = (start: number, end: number): O.Option<number> => {
    for (let i = start; i < end; i++) {
      if (!this.charge(1)) return O.none();
      const decision = this.compositionToken(i);
      if (O.isNone(decision)) return O.none();
      if (decision.value) return O.some(i);
    }
    return O.none();
  };
  private compositionItems = (start: number, end: number): O.Option<ReadonlyArray<readonly [number, number]>> => {
    const indexes = this.topLevel(start, end);
    if (O.isNone(indexes)) return O.none();
    const children: Array<readonly [number, number]> = [];
    let from = start;
    let sibling = false;
    const accept = (index: number): boolean => {
      if (index < from || !HashSet.has(separators, this.word(index))) return true;
      const next = this.trimStart(index + 1, end);
      if (!HashSet.has(articles, this.word(next))) return true;
      if (this.independent(next, end)) {
        sibling = true;
        return false;
      }
      if (!this.charge(2)) return false;
      children.push([from, index]);
      from = next;
      return true;
    };
    A.every(indexes.value, accept);
    if (this.remaining < 0) return O.none();
    if (sibling || children.length === 0) return O.some([]);
    if (!this.charge(2)) return O.none();
    children.push([from, end]);
    return O.some(children);
  };
  private parseChildren = (
    children: ReadonlyArray<readonly [number, number]>,
    parent: number,
    grouping: ClaimElementGrouping,
    depth: number
  ): boolean => {
    for (const [start, end] of children)
      if (!this.parse(start, this.trimEnd(start, end), parent, grouping, depth + 1)) return false;
    return true;
  };
  private composition = (start: number, end: number, parent: number, depth: number): O.Option<boolean> => {
    const operator = this.compositionOperator(start, end);
    if (O.isNone(operator)) return this.remaining >= 0 ? O.some(false) : O.none();
    if (!HashSet.has(articles, this.word(operator.value + 1))) return O.some(false);
    const children = this.compositionItems(operator.value + 1, end);
    if (O.isNone(children)) return O.none();
    if (children.value.length === 0) return O.some(false);
    const owner = this.add(
      this.span(start, end),
      this.span(start, operator.value + 1),
      O.some(parent),
      "composition-header",
      true
    );
    if (O.isNone(owner)) return O.none();
    return this.parseChildren(children.value, owner.value, "composition-child", depth) ? O.some(true) : O.none();
  };
  private ambiguousRelative = (index: number, sourceStart: number): boolean => {
    const before = A.filter(
      this.roles.nominals,
      (n) => n.anchor.startChar >= sourceStart && n.anchor.endChar <= O.getOrThrow(this.token(index)).anchor.startChar
    );
    if (before.length < 2) return false;
    const left = O.getOrThrow(A.get(before, before.length - 2));
    const right = O.getOrThrow(A.last(before));
    const length = right.anchor.startChar - left.anchor.endChar;
    if (!this.charge(length)) return true;
    return O.isSome(
      Str.match(/^\s*(?:with|of)\s*$/iu)(Str.slice(left.anchor.endChar, right.anchor.startChar)(this.claim.claimText))
    );
  };
  private clauseAttachment = (index: number): ClaimSourceFrame["attachment"] => {
    if (this.precededByPredicate(index)) return "event-complement";
    return HashSet.has(HashSet.make("if", "when", "while"), this.word(index)) ? "condition" : "relative";
  };
  // Outer admission option rejects ambiguity; inner option is an actual
  // implicit relative subject, absent for a complement or condition.
  private clauseSubject = (
    attachment: ClaimSourceFrame["attachment"],
    index: number,
    sourceStart: number,
    span: TextAnchor
  ): O.Option<O.Option<TextAnchor>> => {
    if (attachment !== "relative") return O.some(O.none());
    if (this.ambiguousRelative(index, sourceStart)) return O.none();
    const antecedent = A.findLast(
      this.roles.nominals,
      (n) => n.anchor.startChar >= sourceStart && n.anchor.endChar <= span.startChar
    );
    if (O.isNone(antecedent)) return O.none();
    return this.setOuter(antecedent.value.anchor, span) ? O.some(O.some(antecedent.value.anchor)) : O.none();
  };
  private relativeStart = (index: number): number =>
    HashSet.has(HashSet.make("which", "that"), this.word(index)) &&
    O.exists(this.token(index - 1), (t) => t.pos === "ADP")
      ? index - 1
      : index;
  private appendClause = (index: number, end: number, parent: number, sourceStart: number): O.Option<number> => {
    if (!this.reserve(this.span(index, end))) return O.none();
    const attachment = this.clauseAttachment(index);
    const frameStart = this.relativeStart(index);
    const span = this.span(frameStart, end);
    const predicates = this.predicates(span);
    if (predicates.length === 0) return O.none();
    const owned = this.owned(span);
    const operators = this.operators(predicates);
    const args = this.argumentPlan(span, owned, operators);
    const subject = this.clauseSubject(attachment, index, sourceStart, span);
    if (O.isNone(subject)) return O.none();
    const introducer = this.span(frameStart, index + 1);
    if (this.remaining < 0) return O.none();
    const ordinal = this.frames.length + 1;
    this.frames.push(
      ClaimSourceFrame.make({
        ordinal,
        extent: span,
        lexicalHeader: span,
        parent: O.some(parent),
        attachment,
        introducer: O.some(introducer),
        predicates: operators,
        nominals: A.map(owned, (n) => n.anchor),
        coordination: O.none(),
        sharedSubject: O.none(),
        ...args,
        subject: O.orElse(subject.value, () => args.subject),
      })
    );
    return O.some(ordinal);
  };
  private clauseCandidate = (index: number): boolean =>
    !HashSet.has(this.protected, index) &&
    HashSet.has(relatives, this.word(index)) &&
    !HashSet.has(HashSet.make("wherein", "whereby"), this.word(index));
  private attachments = (start: number, end: number, main: number): boolean => {
    let parent = main;
    const sourceStart = O.getOrThrow(this.token(start)).anchor.startChar;
    for (let i = start; i < end; i++) {
      if (!this.charge(1)) return false;
      if (!this.clauseCandidate(i)) continue;
      const appended = this.appendClause(i, end, parent, sourceStart);
      if (O.isNone(appended)) return false;
      parent = appended.value;
    }
    return true;
  };
  private directPP = (left: ClaimNominalSpan, right: ClaimNominalSpan): boolean => {
    const index = HashMap.get(this.tokenIndex, right.anchor.startChar);
    const prep = O.flatMap(index, (i) => this.token(i - 1));
    if (O.isNone(prep)) return false;
    if (prep.value.pos !== "ADP" || prep.value.anchor.startChar < left.anchor.endChar) return false;
    const length = right.anchor.startChar - left.anchor.endChar;
    if (!this.charge(length)) return false;
    return O.isSome(
      Str.match(/^\s*$/u)(Str.slice(left.anchor.endChar, prep.value.anchor.startChar)(this.claim.claimText))
    );
  };
  private nominalPPProof = (left: ClaimNominalSpan, right: ClaimNominalSpan): boolean => {
    if (!this.directPP(left, right) || !this.charge(this.frames.length)) return false;
    const frame = A.findLast(this.frames, (f) => inside(f.extent, left.anchor) && inside(f.extent, right.anchor));
    return O.exists(frame, (owner) => {
      if (!this.charge(owner.arguments.length)) return false;
      return A.some(
        owner.arguments,
        (argument) =>
          argument.role === "nominal-modifier" &&
          argument.nominal.startChar === right.anchor.startChar &&
          O.exists(argument.ownerNominal, (nominal) => nominal.startChar === left.anchor.startChar)
      );
    });
  };
  private attachNominalPPs = (element: ClaimPlannedElement): boolean => {
    if (!this.charge(element.nominals.length * 2 + 1)) return false;
    let previousTarget = O.none<number>();
    for (let i = 1; i < element.nominals.length; i++) {
      const left = O.getOrThrow(A.get(element.nominals, i - 1));
      const right = O.getOrThrow(A.get(element.nominals, i));
      if (!this.nominalPPProof(left, right)) continue;
      // A second PP can modify either the first PP's object or its NP shell.
      // Without an attachment production, commit neither interpretation.
      if (O.contains(previousTarget, left.anchor.startChar) || !this.setOuter(left.anchor, right.anchor)) return false;
      previousTarget = O.some(right.anchor.startChar);
    }
    return this.remaining >= 0;
  };
  private nominalAttachments = (): boolean => A.every(this.elements, this.attachNominalPPs);
  private eventPosition = (predicate: ClaimPredicateSpan, index: number): boolean =>
    HashSet.has(HashSet.make("gerund", "infinitive"), predicate.kind) &&
    HashSet.has(HashSet.make("for", "by", "to"), this.word(index - 1));
  private coordinatePosition = (predicate: ClaimPredicateSpan, index: number, enclosing: ClaimSourceFrame): boolean =>
    predicate.kind === "finite" &&
    O.isSome(enclosing.subject) &&
    HashSet.has(HashSet.make("and", "or"), this.word(index - 1));
  private predicateAttachment = (
    predicate: ClaimPredicateSpan,
    index: number,
    enclosing: ClaimSourceFrame
  ): O.Option<ClaimSourceFrame["attachment"]> => {
    if (this.eventPosition(predicate, index)) return O.some("event-complement");
    return this.coordinatePosition(predicate, index, enclosing) ? O.some("coordinate") : O.none();
  };
  private coordinatedEvent = (predicate: ClaimPredicateSpan): boolean =>
    O.exists(
      HashMap.get(this.tokenIndex, predicate.anchor.startChar),
      (i) => this.eventPosition(predicate, i) && HashSet.has(HashSet.make("and", "or"), this.word(i - 2))
    );
  private eventEnd = (
    predicate: ClaimPredicateSpan,
    predicates: ReadonlyArray<ClaimPredicateSpan>,
    end: number
  ): number => {
    if (!this.charge(predicates.length)) return end;
    const next = A.findFirst(
      predicates,
      (p) => p.anchor.startChar > predicate.anchor.startChar && this.coordinatedEvent(p)
    );
    return O.match(next, {
      onNone: () => end,
      onSome: (p) => O.getOrThrow(HashMap.get(this.tokenIndex, p.anchor.startChar)) - 2,
    });
  };
  private predicateSpan = (
    predicate: ClaimPredicateSpan,
    attachment: ClaimSourceFrame["attachment"],
    predicates: ReadonlyArray<ClaimPredicateSpan>,
    end: number
  ): TextAnchor => {
    const index = O.getOrThrow(HashMap.get(this.tokenIndex, predicate.anchor.startChar));
    return attachment === "event-complement"
      ? this.span(index - 1, this.eventEnd(predicate, predicates, end))
      : this.span(index, end);
  };
  private eventGovernor = (parent: ClaimSourceFrame, span: TextAnchor): O.Option<ClaimPredicateSpan> => {
    if (!this.charge(this.roles.predicates.length)) return O.none();
    return A.findLast(
      this.roles.predicates,
      (predicate) =>
        inside(parent.extent, predicate.anchor) &&
        predicate.anchor.endChar <= span.startChar &&
        HashSet.has(HashSet.make("finite", "auxiliary-head", "possession"), predicate.kind)
    );
  };
  private recordEventOwner = (nominal: TextAnchor, span: TextAnchor): boolean => {
    if (!this.charge(2) || !this.setOuter(nominal, span)) return false;
    this.nominalEventOwners = HashMap.set(this.nominalEventOwners, this.frames.length, nominal);
    return true;
  };
  private blankGap = (start: number, end: number): boolean => {
    if (end < start || !this.charge(end - start)) return false;
    return O.isSome(Str.match(/^\s*$/u)(Str.slice(start, end)(this.claim.claimText)));
  };
  private nominalEventOuter = (parent: ClaimSourceFrame, span: TextAnchor, prefix = O.none<TextAnchor>()): boolean => {
    if (!this.charge(parent.nominals.length * 2 + 1)) return false;
    const candidates = A.filter(parent.nominals, (nominal) => nominal.endChar <= span.startChar);
    if (candidates.length !== 1) return false;
    const nominal = O.getOrThrow(A.head(candidates));
    if (nominal.startChar !== parent.extent.startChar) return false;
    const start = O.match(prefix, { onNone: () => span.startChar, onSome: (p) => p.startChar });
    return this.blankGap(nominal.endChar, start) && this.recordEventOwner(nominal, span);
  };
  private infinitiveGovernor = (
    parent: ClaimSourceFrame,
    span: TextAnchor,
    predicate: ClaimPredicateSpan
  ): O.Option<TextAnchor> => {
    if (predicate.kind !== "infinitive" || !this.charge(this.roles.predicates.length)) return O.none();
    const index = HashMap.get(this.tokenIndex, span.startChar);
    if (!O.exists(index, (i) => this.word(i) === "to")) return O.none();
    return O.map(
      A.findLast(
        this.roles.predicates,
        (p) =>
          p.kind === "auxiliary" &&
          inside(parent.extent, p.anchor) &&
          p.anchor.endChar <= span.startChar &&
          this.blankGap(p.anchor.endChar, span.startChar)
      ),
      (p) => p.anchor
    );
  };
  private coordinatedNominalEvent = (
    parent: ClaimSourceFrame,
    span: TextAnchor,
    predicate: ClaimPredicateSpan
  ): boolean => {
    if (!this.coordinatedEvent(predicate) || !this.charge(this.frames.length)) return false;
    const previous = A.findLast(
      this.frames,
      (frame) =>
        frame.attachment === "event-complement" &&
        O.contains(frame.parent, parent.ordinal) &&
        frame.extent.endChar <= span.startChar
    );
    return O.exists(previous, (frame) => {
      if (!this.charge(span.startChar - frame.extent.endChar)) return false;
      const gap = Str.slice(frame.extent.endChar, span.startChar)(this.claim.claimText);
      if (O.isNone(Str.match(/^\s*(?:and|or)\s*$/u)(gap))) return false;
      return O.exists(HashMap.get(this.nominalEventOwners, frame.ordinal), (nominal) =>
        this.recordEventOwner(nominal, span)
      );
    });
  };
  private predicateOuter = (
    parent: ClaimSourceFrame,
    span: TextAnchor,
    attachment: ClaimSourceFrame["attachment"],
    predicate: ClaimPredicateSpan
  ): boolean => {
    if (attachment !== "event-complement") return true;
    const licensed = this.infinitiveGovernor(parent, span, predicate);
    if (O.isSome(licensed)) {
      // A relative predicate's complement remains governed by that frame; an
      // NP-initial nonfinite modifier can also prove its complete nominal outer.
      const first = A.head(parent.nominals);
      return O.exists(first, (n) => n.startChar === parent.extent.startChar)
        ? this.nominalEventOuter(parent, span, licensed)
        : this.remaining >= 0;
    }
    const governor = this.eventGovernor(parent, span);
    if (this.remaining < 0) return false;
    if (O.isNone(governor))
      return this.coordinatedNominalEvent(parent, span, predicate) || this.nominalEventOuter(parent, span);
    const index = HashMap.get(this.tokenIndex, span.startChar);
    return predicate.kind === "gerund" && O.exists(index, (i) => this.word(i) === "by");
  };
  private appendPredicate = (
    predicate: ClaimPredicateSpan,
    enclosing: ClaimSourceFrame,
    predicates: ReadonlyArray<ClaimPredicateSpan>,
    end: number
  ): boolean => {
    if (!this.charge(this.frames.length + 2)) return false;
    const index = HashMap.get(this.tokenIndex, predicate.anchor.startChar);
    if (O.isNone(index)) return false;
    const attachment = this.predicateAttachment(predicate, index.value, enclosing);
    if (O.isNone(attachment)) return true;
    const span = this.predicateSpan(predicate, attachment.value, predicates, end);
    if (!this.reserve(span)) return false;
    const owned = this.owned(span);
    const args = this.argumentPlan(span, owned, [predicate.anchor]);
    const parent = O.getOrElse(
      A.findLast(this.frames, (f) => f.ordinal >= enclosing.ordinal && inside(f.extent, span)),
      () => enclosing
    );
    if (this.remaining < 0) return false;
    const shared = attachment.value === "coordinate" ? enclosing.subject : O.none();
    this.frames.push(
      ClaimSourceFrame.make({
        ordinal: this.frames.length + 1,
        extent: span,
        lexicalHeader: span,
        parent: O.some(parent.ordinal),
        attachment: attachment.value,
        introducer: O.map(this.token(index.value - 1), (t) => t.anchor),
        predicates: [predicate.anchor],
        nominals: A.map(owned, (n) => n.anchor),
        coordination: O.map(shared, () => enclosing.ordinal),
        sharedSubject: shared,
        ...args,
        subject: O.orElse(shared, () => args.subject),
      })
    );
    return this.predicateOuter(parent, span, attachment.value, predicate);
  };
  private predicateAttachments = (start: number, end: number, main: number): boolean => {
    const extent = this.span(start, end);
    if (!this.reserve(extent)) return false;
    const predicates = this.predicates(extent);
    const enclosing = O.getOrThrow(A.get(this.frames, main - 1));
    return A.every(predicates, (predicate) => this.appendPredicate(predicate, enclosing, predicates, end));
  };
  private finalizeFrames = (): boolean => {
    if (!this.charge(this.frames.length ** 2 + this.frames.length * 2)) return false;
    const original = A.copy(this.frames);
    for (let i = 0; i < original.length; i++) {
      const frame = O.getOrThrow(A.get(original, i));
      const children = A.filter(original, (child) => O.contains(child.parent, frame.ordinal));
      const refs = frame.predicates.length + frame.nominals.length + frame.arguments.length;
      if (!this.charge((refs + 1) * (children.length + 1) * 4)) return false;
      const nested = (anchor: TextAnchor): boolean => A.some(children, (child) => inside(child.extent, anchor));
      const predicates = A.filter(frame.predicates, (predicate) => !nested(predicate));
      const nominals = A.filter(frame.nominals, (nominal) => !nested(nominal));
      const args = A.filter(
        frame.arguments,
        (argument) => !nested(argument.nominal) && !O.exists(argument.predicate, nested)
      );
      const subject =
        frame.attachment === "relative" || O.isSome(frame.sharedSubject)
          ? frame.subject
          : O.filter(frame.subject, (s) =>
              A.some(args, (argument) => argument.role === "subject" && argument.nominal.startChar === s.startChar)
            );
      this.frames[i] = ClaimSourceFrame.make({ ...frame, predicates, nominals, arguments: args, subject });
    }
    return true;
  };
  private ancestor = (parent: number, child: ClaimPlannedElement): boolean => {
    let cursor = child.parent;
    while (O.isSome(cursor)) {
      if (!this.charge(1)) return false;
      if (cursor.value === parent) return true;
      cursor = O.getOrThrow(A.get(this.elements, cursor.value - 1)).parent;
    }
    return false;
  };
  private validateNominals = (): boolean => {
    let end = 0;
    for (const nominal of this.attached) {
      if (nominal.core.startChar < end || !inside(nominal.core, nominal.head) || !inside(nominal.outer, nominal.core))
        return false;
      end = nominal.core.endChar;
    }
    return true;
  };
  private validElementParent = (element: ClaimPlannedElement): boolean =>
    optionalProof(
      element.parent,
      (ordinal) =>
        ordinal < element.ordinal &&
        O.exists(
          A.get(this.elements, ordinal - 1),
          (parent) => parent.ordinal === 1 || inside(parent.extent, element.extent)
        )
    );
  private validElementTerms = (element: ClaimPlannedElement): boolean => {
    let last = element.lexicalHeader.startChar;
    for (const nominal of element.nominals) {
      if (nominal.anchor.startChar < last || !inside(element.lexicalHeader, nominal.anchor)) return false;
      last = nominal.anchor.endChar;
    }
    return true;
  };
  private validOverlaps = (index: number, element: ClaimPlannedElement): boolean => {
    for (let i = index + 1; i < this.elements.length; i++) {
      const child = O.getOrThrow(A.get(this.elements, i));
      if (
        element.extent.startChar < child.extent.endChar &&
        child.extent.startChar < element.extent.endChar &&
        !this.ancestor(element.ordinal, child)
      )
        return false;
    }
    return true;
  };
  private validateElements = (): boolean =>
    A.every(
      this.elements,
      (element, index) =>
        inside(element.extent, element.lexicalHeader) &&
        this.validElementParent(element) &&
        this.validElementTerms(element) &&
        this.validOverlaps(index, element)
    );
  private validateFrameParents = (): boolean =>
    A.every(this.frames, (frame) =>
      optionalProof(
        frame.parent,
        (ordinal) =>
          ordinal < frame.ordinal &&
          O.exists(A.get(this.frames, ordinal - 1), (parent) => inside(parent.extent, frame.extent))
      )
    );
  private validListItem = (owner: number, item: ClaimListDeclaration["items"][number]): boolean =>
    O.exists(
      A.get(this.elements, item.child - 1),
      (child) => O.contains(child.parent, owner) && item.label.endChar <= child.extent.startChar
    );
  private validateDeclarations = (): boolean => {
    for (const declaration of this.declarations) {
      if (!this.charge(declaration.items.length * 2 + 1)) return false;
      if (!A.every(declaration.items, (item) => this.validListItem(declaration.owner, item))) return false;
    }
    return true;
  };
  private validatePlan = (): boolean => {
    if (
      !this.charge(
        this.elements.length ** 2 + this.attached.length * 4 + this.frames.length * 2 + this.declarations.length
      )
    )
      return false;
    return (
      this.validateNominals() && this.validateElements() && this.validateFrameParents() && this.validateDeclarations()
    );
  };
  private appendRange = (ranges: Array<readonly [number, number]>, start: number, end: number): boolean => {
    if (!this.charge(2)) return false;
    ranges.push([start, end]);
    return true;
  };
  private semicolonRanges = (start: number, end: number): O.Option<ReadonlyArray<readonly [number, number]>> => {
    const indexes = this.topLevel(start, end);
    if (O.isNone(indexes)) return O.none();
    const ranges: Array<readonly [number, number]> = [];
    let from = start;
    for (const index of indexes.value) {
      if (this.word(index) !== ";") continue;
      if (!this.appendRange(ranges, from, index)) return O.none();
      from = index + 1;
    }
    if (ranges.length > 0 && !this.appendRange(ranges, from, end)) return O.none();
    return O.some(ranges);
  };
  private labelsLicensed = (start: number, end: number): boolean => {
    for (let i = start; i < end; i++) {
      if (!this.charge(1)) return false;
      if (!HashSet.has(this.protected, i) && O.isSome(this.label(i))) return false;
    }
    return true;
  };
  private coordinates = (start: number, end: number, parent: number, depth: number): O.Option<boolean> => {
    const boundaries = this.boundaries(start, end);
    if (O.isNone(boundaries)) return O.none();
    if (boundaries.value.length === 0) return O.some(false);
    let from = start;
    for (const at of boundaries.value) {
      if (!this.parse(from, at, parent, "independent-coordinate", depth + 1)) return O.none();
      from = this.trimStart(at + 1, end);
    }
    const grouping = HashSet.has(HashSet.make("where", "wherein"), this.word(from))
      ? "introduced-restriction"
      : "independent-coordinate";
    return this.parse(from, end, parent, grouping, depth + 1) ? O.some(true) : O.none();
  };
  private subjectProved = (span: TextAnchor, nominals: ReadonlyArray<ClaimNominalSpan>): boolean =>
    optionalProof(
      A.head(this.predicates(span)),
      (p) =>
        HashSet.has(HashSet.make("gerund", "infinitive", "adjunct"), p.kind) ||
        A.some(nominals, (n) => n.anchor.endChar <= p.anchor.startChar)
    );
  private unprovedGovernor = (index: number): boolean =>
    HashSet.has(HashSet.make("configured", "adapted", "operable", "arranged"), this.word(index)) &&
    this.word(index + 1) === "to" &&
    !A.some(
      this.roles.predicates,
      (p) => p.anchor.startChar === O.getOrThrow(this.token(index)).anchor.startChar && p.kind === "auxiliary"
    );
  private functionOwned = (index: number, nominals: ReadonlyArray<ClaimNominalSpan>): boolean => {
    if (this.unprovedGovernor(index)) return false;
    const token = O.getOrThrow(this.token(index));
    if (token.pos !== "VERB" || HashSet.has(this.protected, index) || HashSet.has(compositions, this.word(index)))
      return true;
    return (
      A.some(this.roles.predicates, (p) => p.anchor.startChar === token.anchor.startChar) ||
      A.some(nominals, (n) => inside(n.anchor, token.anchor))
    );
  };
  private functionsOwned = (start: number, end: number, nominals: ReadonlyArray<ClaimNominalSpan>): boolean => {
    for (let i = start; i < end; i++) {
      if (!this.charge(this.roles.predicates.length + nominals.length + 1)) return false;
      if (!this.functionOwned(i, nominals)) return false;
    }
    return true;
  };
  private barePartitive = (index: number): boolean =>
    !HashSet.has(this.protected, index) &&
    this.word(index) === "of" &&
    !HashSet.has(HashSet.make("the", "said"), this.word(index + 1));
  private partitiveAdmitted = (start: number, end: number, span: TextAnchor): boolean => {
    if (this.predicates(span).length > 0 || !HashSet.has(HashSet.make("a", "an"), this.word(start))) return true;
    for (let i = start; i < end; i++) {
      if (!this.charge(1)) return false;
      if (this.barePartitive(i)) return false;
    }
    return true;
  };
  private leaf = (start: number, end: number, parent: number, grouping: ClaimElementGrouping): boolean => {
    const span = this.span(start, end);
    if (!this.reserve(span)) return false;
    const nominals = this.owned(span);
    if (nominals.length === 0 || !this.subjectProved(span, nominals)) return false;
    if (!this.functionsOwned(start, end, nominals) || !this.partitiveAdmitted(start, end, span)) return false;
    const before = this.frames.length;
    const owner = this.add(span, span, O.some(parent), grouping, false);
    return (
      O.isSome(owner) && this.attachments(start, end, before + 1) && this.predicateAttachments(start, end, before + 1)
    );
  };
  private parseAfterLabels = (
    start: number,
    end: number,
    parent: number,
    grouping: ClaimElementGrouping,
    depth: number
  ): boolean => {
    const coordinated = this.coordinates(start, end, parent, depth);
    if (O.isNone(coordinated)) return false;
    if (coordinated.value) return true;
    return O.match(this.composition(start, end, parent, depth), {
      onNone: () => false,
      onSome: (composed) => composed || this.leaf(start, end, parent, grouping),
    });
  };
  private parse = (
    rawStart: number,
    rawEnd: number,
    parent: number,
    grouping: ClaimElementGrouping,
    depth: number
  ): boolean => {
    if (depth > 128 || !this.charge(1)) return false;
    const start = this.trimStart(rawStart, rawEnd);
    const end = this.trimEnd(start, rawEnd);
    if (start >= end) return false;
    const colon = this.topColon(start, end);
    if (O.isSome(colon)) return this.labelled(start, end, colon.value, parent, depth);
    const semicolons = this.semicolonRanges(start, end);
    if (O.isNone(semicolons)) return false;
    if (semicolons.value.length > 0) return this.parseChildren(semicolons.value, parent, "nominal-leaf", depth);
    return this.labelsLicensed(start, end) && this.parseAfterLabels(start, end, parent, grouping, depth);
  };
  private seedRoot = (): O.Option<number> => {
    if (!this.reserve(this.preamble)) return O.none();
    const first = A.head(this.owned(this.preamble));
    return O.flatMap(first, (nominal) => this.add(this.preamble, nominal.anchor, O.none(), "preamble", true));
  };
  private governingPredicate = (nominal: ClaimNominalSpan, predicate: ClaimPredicateSpan): O.Option<boolean> => {
    if (!this.charge(predicate.anchor.startChar - nominal.anchor.endChar)) return O.none();
    const gap = Str.slice(nominal.anchor.endChar, predicate.anchor.startChar)(this.claim.claimText);
    if (O.isSome(Str.match(/\b(?:that|which|wherein)\b/iu)(gap))) return O.none();
    return HashSet.has(HashSet.make("finite", "auxiliary-head", "possession"), predicate.kind)
      ? O.some(false)
      : O.none();
  };
  private governingItem = (start: number, end: number): O.Option<boolean> => {
    const span = this.span(start, this.trimEnd(start, end));
    if (!this.reserve(span)) return O.none();
    const nominals = this.owned(span);
    const first = A.head(nominals);
    if (O.isNone(first) || first.value.anchor.startChar !== span.startChar) return O.some(false);
    const predicate = A.head(this.predicates(span));
    if (O.isSome(predicate)) return this.governingPredicate(first.value, predicate.value);
    return nominals.length === 1 && first.value.anchor.endChar === span.endChar ? O.some(true) : O.none();
  };
  private governingComposition = (start: number, end: number, root: number): O.Option<boolean> => {
    if (!HashSet.has(compositions, this.claim.transition)) return O.some(false);
    const children = this.compositionItems(start, end);
    if (O.isNone(children) || !this.charge(children.value.length)) return O.none();
    // Semicolon framing is already owned by parse; it is not an NP-and-list proof.
    if (A.some(children.value, (item) => this.word(item[1]) === ";")) return O.some(false);
    const first = A.head(children.value);
    if (O.isNone(first)) return O.some(false);
    return O.flatMap(this.governingItem(first.value[0], first.value[1]), (nominal) =>
      nominal
        ? this.parseChildren(children.value, root, "composition-child", 1)
          ? O.some(true)
          : O.none()
        : O.some(false)
    );
  };
  private projectBody = (root: number): boolean => {
    if (!this.charge(this.tokens.length)) return false;
    const indexes = this.located(this.body);
    if (indexes.length === 0) return false;
    const start = O.getOrThrow(A.head(indexes));
    const end = O.getOrThrow(A.last(indexes)) + 1;
    const declaration =
      O.isSome(this.label(start)) && this.word(start - 1) === ":" && HashSet.has(compositions, this.claim.transition);
    if (declaration) return this.labelled(start - 1, end, start - 1, root, 1);
    return O.match(this.governingComposition(start, end, root), {
      onNone: () => false,
      onSome: (composed) => composed || this.parse(start, end, root, "single-restriction", 1),
    });
  };
  private finish = (): O.Option<ClaimSourceElementPlan> => {
    if (
      !this.nominalAttachments() ||
      !this.finalizeFrames() ||
      !this.validatePlan() ||
      !this.charge(this.attached.length + this.elements.length + 3)
    )
      return O.none();
    return O.some(
      ClaimSourceElementPlan.make({
        qualifiedText: this.claim.claimText,
        remainingWork: this.remaining,
        frames: this.frames,
        nominals: this.attached,
        elements: this.elements,
        declarations: this.declarations,
        roles: ClaimClauseRolePlan.make({
          ...this.roles,
          nominals: A.flatMap(this.elements, (element) => element.nominals),
        }),
      })
    );
  };
  run = (): O.Option<ClaimSourceElementPlan> => {
    if (!this.charge(this.tokens.length * 32 + this.claim.claimText.length) || !this.protectedSource()) return O.none();
    const root = this.seedRoot();
    if (O.isNone(root)) return O.none();
    return this.projectBody(root.value) ? this.finish() : O.none();
  };
}

/**
 * Compile complete enhanced topology before committing any source role facts.
 *
 * @category parsing
 * @since 0.0.0
 */
export const compileClaimSourceElements: {
  (
    roles: ClaimClauseRolePlan,
    tokens: ReadonlyArray<ClaimLexicalToken>,
    preamble: TextAnchor,
    body: TextAnchor
  ): (claim: PatentClaim) => O.Option<ClaimSourceElementPlan>;
  (
    claim: PatentClaim,
    roles: ClaimClauseRolePlan,
    tokens: ReadonlyArray<ClaimLexicalToken>,
    preamble: TextAnchor,
    body: TextAnchor
  ): O.Option<ClaimSourceElementPlan>;
} = dual(
  5,
  (
    claim: PatentClaim,
    roles: ClaimClauseRolePlan,
    tokens: ReadonlyArray<ClaimLexicalToken>,
    preamble: TextAnchor,
    body: TextAnchor
  ) => new SourcePlanner(claim, roles, tokens, preamble, body).run()
);
