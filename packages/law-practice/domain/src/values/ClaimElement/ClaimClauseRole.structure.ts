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
  ClaimOwnedTermRegion,
  ClaimPlannedElement,
  ClaimSourceDeclaration,
  ClaimSourceElementPlan,
  ClaimSourceExclusion,
  ClaimSourceFrame,
  ClaimSourceProof,
  ClaimTermOwnerCertificate,
} from "./ClaimClauseRole.model.ts";
import { validateClaimSourceOwnership } from "./ClaimClauseRole.projection.ts";
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
const citationWords = HashSet.make("claim", "claims");
const citationSeparators = HashSet.make(",", "and", "or");
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
  private readonly sourceExclusions: Array<ClaimSourceExclusion> = [];
  private attachedIndices = HashMap.empty<number, number>();
  private readonly unresolvedCitations: Array<TextAnchor> = [];
  private citationSkipUntil = 0;
  private readonly elements: Array<ClaimPlannedElement> = [];
  private readonly frames: Array<ClaimSourceFrame> = [];
  private declarations: Array<ClaimListDeclaration> = [];
  private declarationPlans: Array<ClaimSourceDeclaration> = [];
  private attached: ReadonlyArray<ClaimAttachedNominal> = [];
  private nominalEventOwners = HashMap.empty<number, TextAnchor>();
  private frameByElement = HashMap.empty<number, number>();
  private declarationFrames = HashMap.empty<number, number>();
  private protected = HashSet.empty<number>();
  private tokenIndex = HashMap.empty<number, number>();
  private tokenEnds = HashSet.empty<number>();
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
  private phrase = (index: number, words: ReadonlyArray<string>): boolean =>
    this.charge(words.length) && A.every(words, (word, offset) => this.word(index + offset) === word);
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
    if (!this.charge(this.claim.claimText.length + this.tokens.length * 3)) return false;
    const quotes = A.fromIterable(
      Str.matchAll(/"(?:\\.|[^"\\])*"|“[^”]*”|‘(?:[^’]|’(?=[\p{L}\p{N}]))*’/gu)(this.claim.claimText)
    );
    if (!this.charge(this.tokens.length * (quotes.length + 1))) return false;
    for (let i = 0; i < this.tokens.length; i++) {
      const t = O.getOrThrow(this.token(i));
      this.tokenIndex = HashMap.set(this.tokenIndex, t.anchor.startChar, i);
      this.tokenEnds = HashSet.add(this.tokenEnds, t.anchor.endChar);
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
      const prep = O.exists(
        before,
        (t) => t.pos === "ADP" || (Str.toLowerCase(t.anchor.quote) === "to" && O.isSome(previous))
      );
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
        A.some(this.roles.predicates, (p) => p.kind === "adjunct" && inside(p.anchor, token.anchor))
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
  private elementContent = (
    nominals: ReadonlyArray<ClaimNominalSpan>,
    predicates: ReadonlyArray<ClaimPredicateSpan>
  ): boolean => nominals.length > 0 || predicates.length > 0;
  private add = (
    span: TextAnchor,
    header: TextAnchor,
    parent: O.Option<number>,
    grouping: ClaimElementGrouping,
    container: boolean
  ): O.Option<number> => {
    if (!this.reserve(span)) return O.none();
    const nominals = this.owned(header);
    const predicates = this.predicates(container ? header : span);
    const property = this.adjectiveProperty(predicates, nominals);
    const kind = this.elementKind(grouping, container, property, predicates);
    if (!this.elementContent(nominals, predicates)) return O.none();
    if (!this.charge(nominals.length + predicates.length + 2)) return O.none();
    const operators = this.operators(predicates);
    const args = this.argumentPlan(container ? header : span, nominals, operators);
    if (this.remaining < 0) return O.none();
    if (!this.charge(this.attached.length + nominals.length + 1)) return O.none();
    const ordinal = this.elements.length + 1;
    const element = ClaimPlannedElement.make({
      ordinal,
      parent,
      extent: span,
      lexicalHeader: header,
      kind,
      grouping: this.elementGrouping(grouping, property, container),
      nominals,
      ownedTermRegions: [],
    });
    this.elements.push(element);
    return this.appendElementFrame(element, operators, args) ? O.some(ordinal) : O.none();
  };
  private isCompositionChild = (element: ClaimPlannedElement, parent: O.Option<number>): boolean =>
    O.isSome(parent) &&
    (HashSet.has(HashSet.make("composition-child", "enumeration-child"), element.grouping) ||
      O.exists(element.parent, (value) => HashMap.has(this.declarationFrames, value)));
  private actionIntroducer = (element: ClaimPlannedElement): O.Option<TextAnchor> => {
    if (HashSet.has(HashSet.make("composition-child", "enumeration-child"), element.grouping)) return O.none();
    return O.flatMap(
      A.findFirst(
        this.roles.proofs,
        (proof) => proof.kind === "action" && proof.operator.startChar === element.extent.startChar
      ),
      (proof) => (proof.kind === "action" ? O.some(proof.governor) : O.none())
    );
  };
  private inheritedArguments = (
    nominals: ReadonlyArray<ClaimNominalSpan>,
    parentFrame: O.Option<number>,
    arguments_: ReadonlyArray<ClaimFrameArgument>,
    compositionChild: boolean
  ): ReadonlyArray<ClaimFrameArgument> => {
    const inherited = O.flatMap(parentFrame, (value) =>
      O.flatMap(A.get(this.frames, value - 1), (f) => A.head(f.predicates))
    );

    const inheritedNominals = A.filter(
      nominals,
      (n) =>
        !A.some(
          arguments_,
          (arg) =>
            arg.nominal.startChar === n.anchor.startChar &&
            (arg.role === "object" || arg.role === "prepositional-complement")
        )
    );
    const childArguments =
      compositionChild && O.isSome(inherited)
        ? A.map(inheritedNominals, (n) =>
            ClaimFrameArgument.make({
              nominal: n.anchor,
              role: "object",
              predicate: inherited,
              ownerNominal: O.none(),
            })
          )
        : [];
    return compositionChild
      ? A.appendAll(
          A.filter(arguments_, (arg) => arg.role !== "unknown"),
          childArguments
        )
      : arguments_;
  };
  private appendElementFrame = (
    element: ClaimPlannedElement,
    operators: ReadonlyArray<TextAnchor>,
    args: Pick<ClaimSourceFrame, "subject" | "arguments">
  ): boolean => {
    const { ordinal, parent, grouping, nominals, extent: span, lexicalHeader: header } = element;
    const frame = this.frames.length + 1;
    const introduced = this.sourceIntroducer(span);
    const parentFrame = O.flatMap(parent, (value) =>
      O.orElse(HashMap.get(this.declarationFrames, value), () =>
        value === 1 ? O.none() : HashMap.get(this.frameByElement, value)
      )
    );
    const compositionChild = this.isCompositionChild(element, parentFrame);
    if (!this.charge(nominals.length * (args.arguments.length + 1) + this.roles.proofs.length + 2)) return false;
    const arguments_ = this.inheritedArguments(nominals, parentFrame, args.arguments, compositionChild);
    this.frames.push(
      ClaimSourceFrame.make({
        ordinal: frame,
        publicOwner: element.ordinal,
        extent: span,
        lexicalHeader: header,
        parent: parentFrame,
        attachment: compositionChild ? "composition-child" : this.frameAttachment(grouping),
        introducer: O.orElse(introduced, () => this.actionIntroducer(element)),
        predicates: operators,
        nominals: A.map(nominals, (n) => n.anchor),
        coordination: O.none(),
        sharedSubject: O.none(),
        ...args,
        arguments: arguments_,
      })
    );
    this.frameByElement = HashMap.set(this.frameByElement, ordinal, frame);
    this.attached = A.appendAll(
      this.attached,
      A.map(nominals, (n) => ClaimAttachedNominal.make({ core: n.anchor, head: n.head, outer: n.anchor, nominal: n }))
    );
    return true;
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
    if (colon === start && parent === 1 && HashSet.has(compositions, this.claim.transition)) {
      return this.rootDeclaration(start - 1, end, colon + 1, parent) ? O.some(parent) : O.none();
    }
    const owner = this.add(
      this.span(start, end),
      this.span(start, colon),
      O.some(parent),
      "explicit-list-header",
      true
    );
    if (O.isSome(owner)) this.declarationIntroducer(owner.value, colon, colon + 1);
    return owner;
  };
  private rootDeclaration = (operator: number, end: number, introEnd: number, owner: number): boolean => {
    if (!this.charge(8)) return false;
    const header = this.span(operator, this.word(introEnd - 1) === ":" ? introEnd - 1 : introEnd);
    const predicate = O.getOrThrow(this.token(operator)).anchor;
    const ordinal = this.frames.length + 1;
    this.frames.push(
      ClaimSourceFrame.make({
        ordinal,
        publicOwner: owner,
        extent: this.span(operator, this.trimEnd(operator, end)),
        lexicalHeader: header,
        parent: O.none(),
        attachment: "main",
        introducer: O.some(this.span(operator, introEnd)),
        predicates: [predicate],
        nominals: [],
        subject: O.none(),
        sharedSubject: O.none(),
        coordination: O.none(),
        arguments: [],
      })
    );
    this.declarationFrames = HashMap.set(this.declarationFrames, owner, ordinal);
    return this.remaining >= 0;
  };
  private declarationIntroducer = (owner: number, operator: number, introEnd: number): void => {
    const frame = HashMap.get(this.frameByElement, owner);
    if (O.isNone(frame)) return;
    const original = O.getOrThrow(A.get(this.frames, frame.value - 1));
    if (!this.charge(this.tokens.length + 2)) return;
    const predicates = this.predicates(original.lexicalHeader);
    const first = A.last(predicates);
    const from = O.flatMap(first, (p) => HashMap.get(this.tokenIndex, p.anchor.startChar));
    this.frames[frame.value - 1] = ClaimSourceFrame.make({
      ...original,
      introducer: O.some(
        this.span(
          O.getOrElse(from, () => operator),
          introEnd
        )
      ),
    });
    this.declarationFrames = HashMap.set(this.declarationFrames, owner, frame.value);
  };
  private canonicalDeclaration = (
    kind: ClaimSourceDeclaration["kind"],
    owner: number,
    intro: TextAnchor,
    children: ReadonlyArray<number>,
    labels: ReadonlyArray<TextAnchor> = []
  ): boolean => {
    if (!this.charge(children.length * 3 + 3)) return false;
    const frame = O.orElse(HashMap.get(this.declarationFrames, owner), () => HashMap.get(this.frameByElement, owner));
    if (O.isNone(frame)) return false;
    const items = A.map(children, (child) => ({ child, extent: O.getOrThrow(A.get(this.elements, child - 1)).extent }));
    const fields = { owner, frame: frame.value, anchor: intro };
    if (kind === "labelled")
      this.declarationPlans.push(
        ClaimSourceDeclaration.cases.labelled.make({
          ...fields,
          items: A.map(items, (item, index) => ({ ...item, label: O.getOrThrow(A.get(labels, index)) })),
        })
      );
    else
      this.declarationPlans.push(
        kind === "action"
          ? ClaimSourceDeclaration.cases.action.make({ ...fields, items })
          : ClaimSourceDeclaration.cases.composition.make({ ...fields, items })
      );
    return true;
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
  private recordDeclaration = (owner: number, items: ReadonlyArray<ClaimListDeclaration["items"][number]>): boolean => {
    if (!this.charge(items.length + 1)) return false;
    const frame = O.orElse(HashMap.get(this.declarationFrames, owner), () => HashMap.get(this.frameByElement, owner));
    const intro = O.flatMap(frame, (id) => O.flatMap(A.get(this.frames, id - 1), (f) => f.introducer));
    return O.exists(intro, (value) =>
      this.canonicalDeclaration(
        "labelled",
        owner,
        value,
        A.map(items, (item) => item.child),
        A.map(items, (item) => item.label)
      )
    );
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
    return O.exists(items, (values) => this.recordDeclaration(owner.value, values));
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
      if (!this.charge(this.roles.nominals.length + 1)) return false;
      if (
        !O.exists(this.token(next), (token) =>
          A.some(this.roles.nominals, (n) => n.anchor.startChar === token.anchor.startChar)
        )
      )
        return true;
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
  private declarationChildren = (start: number, end: number): O.Option<ReadonlyArray<readonly [number, number]>> => {
    const semicolons = this.semicolonRanges(start, end);
    return O.flatMap(semicolons, (ranges) => (ranges.length > 0 ? O.some(ranges) : this.compositionItems(start, end)));
  };
  private actionItem = (start: number, end: number): boolean => {
    const span = this.span(start, this.trimEnd(start, end));
    if (!this.reserve(span)) return false;
    const first = A.head(this.predicates(span));
    return (
      O.exists(first, (p) => p.kind === "gerund" && p.anchor.startChar === span.startChar) &&
      this.owned(span).length > 0 &&
      this.functionsOwned(start, end, this.owned(span))
    );
  };
  private declaredChildren = (
    ranges: ReadonlyArray<readonly [number, number]>,
    owner: number,
    depth: number
  ): O.Option<ReadonlyArray<number>> => {
    const children: Array<number> = [];
    for (const [from, to] of ranges) {
      if (!this.charge(1)) return O.none();
      children.push(this.elements.length + 1);
      if (!this.parse(from, this.trimEnd(from, to), owner, "composition-child", depth + 1)) return O.none();
    }
    return O.some(children);
  };
  private declarationOwner = (
    start: number,
    end: number,
    colon: number,
    parent: number,
    actions: boolean
  ): O.Option<number> => {
    if (actions) return this.rootDeclaration(start - 1, end, colon + 1, parent) ? O.some(parent) : O.none();
    return this.add(this.span(start, end), this.span(start, colon), O.some(parent), "composition-header", true);
  };
  private completeDeclarationItems = (ranges: ReadonlyArray<readonly [number, number]>, actions: boolean): boolean =>
    A.every(ranges, ([from, to]) =>
      actions ? this.actionItem(from, to) : O.contains(this.governingItem(from, to), true)
    );
  private explicitActionHeader = (start: number, colon: number, parent: number): boolean =>
    this.phrase(start, ["the", "steps", "of"]) && colon === start + 3 && parent === 1;
  private unlabelledOperator = (operator: O.Option<number>, colon: number): boolean =>
    O.exists(operator, (index) => index + 1 === colon);
  private unlabelledRanges = (
    colon: number,
    end: number,
    explicitActions: boolean
  ): O.Option<ReadonlyArray<readonly [number, number]>> => {
    const children = this.declarationChildren(colon + 1, end);
    if (O.isNone(children)) return O.none();
    const ranges: ReadonlyArray<readonly [number, number]> =
      children.value.length === 0 ? [[colon + 1, end]] : children.value;
    if (!this.charge(ranges.length)) return O.none();
    if (!this.completeDeclarationItems(ranges, explicitActions)) return O.none();
    return O.some(ranges);
  };
  private unlabelledDeclaration = (
    start: number,
    end: number,
    colon: number,
    parent: number,
    depth: number
  ): boolean => {
    const explicitActions = this.explicitActionHeader(start, colon, parent);
    const operator = this.compositionOperator(start, colon);
    if (!explicitActions && !this.unlabelledOperator(operator, colon)) return false;
    const ranges = this.unlabelledRanges(colon, end, explicitActions);
    if (O.isNone(ranges)) return false;
    const owner = this.declarationOwner(start, end, colon, parent, explicitActions);
    if (O.isNone(owner)) return false;
    if (!explicitActions) this.declarationIntroducer(owner.value, O.getOrThrow(operator), colon + 1);
    const childOrdinals = this.declaredChildren(ranges.value, owner.value, depth);
    if (O.isNone(childOrdinals)) return false;
    const intro = explicitActions ? this.span(start - 1, colon + 1) : this.span(O.getOrThrow(operator), colon + 1);
    return this.canonicalDeclaration(
      explicitActions ? "action" : "composition",
      owner.value,
      intro,
      childOrdinals.value
    );
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
        publicOwner: O.getOrThrow(A.get(this.frames, parent - 1)).publicOwner,
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
    ((predicate.kind === "finite" && O.isSome(enclosing.subject)) ||
      A.some(
        this.roles.proofs,
        (proof) => proof.kind === "coordinated-action" && proof.operator.startChar === predicate.anchor.startChar
      )) &&
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
        publicOwner: enclosing.publicOwner,
        extent: span,
        lexicalHeader: span,
        parent: O.some(parent.ordinal),
        attachment: attachment.value,
        introducer: O.map(this.token(index.value - 1), (t) => t.anchor),
        predicates: [predicate.anchor],
        nominals: A.map(owned, (n) => n.anchor),
        coordination: attachment.value === "coordinate" ? O.some(enclosing.ordinal) : O.none(),
        sharedSubject: shared,
        ...args,
        subject: O.orElse(shared, () => args.subject),
      })
    );
    return this.predicateOuter(parent, span, attachment.value, predicate);
  };
  private predicateAttachments = (start: number, end: number, main: number): boolean => {
    const extent = this.span(start, end);
    if (!this.reserve(extent) || !this.charge(this.roles.proofs.length * (this.roles.predicates.length + 1)))
      return false;
    const predicates = this.predicates(extent);
    const enclosing = O.getOrThrow(A.get(this.frames, main - 1));
    return A.every(predicates, (predicate) => this.appendPredicate(predicate, enclosing, predicates, end));
  };
  private appendReduced = (
    proof: Extract<ClaimSourceProof, { readonly kind: "reduced-adjective" | "reduced-participle" }>,
    main: number
  ): boolean => {
    if (!this.charge(proof.complement.endChar - proof.operator.startChar + 7)) return false;
    const extent = TextAnchor.make({
      startChar: proof.operator.startChar,
      endChar: proof.complement.endChar,
      quote: Str.slice(proof.operator.startChar, proof.complement.endChar)(this.claim.claimText),
    });
    this.frames.push(
      ClaimSourceFrame.make({
        ordinal: this.frames.length + 1,
        publicOwner: O.getOrThrow(A.get(this.frames, main - 1)).publicOwner,
        parent: O.some(main),
        attachment: "relative",
        extent,
        lexicalHeader: extent,
        introducer: O.none(),
        predicates: [proof.operator],
        nominals: [proof.complement],
        subject: O.some(proof.nominal),
        coordination: O.none(),
        sharedSubject: O.none(),
        arguments: [
          ClaimFrameArgument.make({
            nominal: proof.complement,
            role: "prepositional-complement",
            predicate: O.some(proof.operator),
            ownerNominal: O.none(),
          }),
        ],
      })
    );
    if (!this.setOuter(proof.nominal, extent)) return false;
    return true;
  };
  private reducedAttachments = (span: TextAnchor, main: number): boolean => {
    if (!this.charge(this.roles.proofs.length)) return false;
    for (const proof of this.roles.proofs) {
      if ((proof.kind !== "reduced-adjective" && proof.kind !== "reduced-participle") || !inside(span, proof.operator))
        continue;
      if (!this.appendReduced(proof, main)) return false;
    }
    return true;
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
    let last = element.extent.startChar;
    for (const nominal of element.nominals) {
      if (nominal.anchor.startChar < last || !inside(element.extent, nominal.anchor)) return false;
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
  private deriveLabelledDeclarations = (): boolean => {
    if (!this.charge(this.declarationPlans.length)) return false;
    const declarations: Array<ClaimListDeclaration> = [];
    for (const declaration of this.declarationPlans) {
      if (declaration.kind !== "labelled") continue;
      if (!this.charge(declaration.items.length * 2 + 1)) return false;
      declarations.push(
        ClaimListDeclaration.make({
          owner: declaration.owner,
          anchor: declaration.anchor,
          items: A.map(declaration.items, (item) => ({ child: item.child, label: item.label })),
        })
      );
    }
    this.declarations = declarations;
    return true;
  };
  private validDeclarationFrame = (declaration: ClaimSourceDeclaration): boolean => {
    const mapped = O.orElse(HashMap.get(this.declarationFrames, declaration.owner), () =>
      HashMap.get(this.frameByElement, declaration.owner)
    );
    return (
      O.contains(mapped, declaration.frame) &&
      O.exists(A.get(this.frames, declaration.frame - 1), (frame) =>
        O.exists(
          frame.introducer,
          (intro) => intro.startChar === declaration.anchor.startChar && intro.endChar === declaration.anchor.endChar
        )
      )
    );
  };
  private validDeclaredExtent = (owner: number, child: number, extent: TextAnchor): boolean =>
    O.exists(
      A.get(this.elements, child - 1),
      (element) =>
        O.contains(element.parent, owner) &&
        element.extent.startChar === extent.startChar &&
        element.extent.endChar === extent.endChar
    );
  private completeDeclaration = (declaration: ClaimSourceDeclaration): boolean =>
    this.validDeclarationFrame(declaration) &&
    declaration.items.length > 0 &&
    A.every(declaration.items, (item) => this.validDeclaredExtent(declaration.owner, item.child, item.extent));
  private validateDeclarationPlans = (): boolean => {
    if (!this.charge(this.declarationPlans.length * 4)) return false;
    for (const declaration of this.declarationPlans) {
      if (!this.charge(declaration.items.length * 4 + declaration.anchor.quote.length + 1)) return false;
      if (!this.completeDeclaration(declaration)) return false;
    }
    return true;
  };
  private validateDeclarations = (): boolean => {
    for (const declaration of this.declarations) {
      if (!this.charge(declaration.items.length * 2 + 1)) return false;
      if (!A.every(declaration.items, (item) => this.validListItem(declaration.owner, item))) return false;
    }
    return true;
  };
  private reducedProofAnchors = (
    proof: Extract<ClaimSourceProof, { readonly kind: "reduced-adjective" | "reduced-participle" }>
  ): ReadonlyArray<TextAnchor> => [
    proof.operator,
    proof.nominal,
    proof.complement,
    proof.introducer,
    ...O.toArray(proof.governingPredicate),
  ];
  private proofAnchors = (proof: ClaimSourceProof): ReadonlyArray<TextAnchor> =>
    ClaimSourceProof.match(proof, {
      "finite-pp": (proof) => [
        proof.operator,
        proof.lexicalPredicate,
        proof.subject,
        proof.complement,
        proof.introducer,
        ...proof.labels,
        ...proof.adjuncts,
      ],
      "reduced-adjective": this.reducedProofAnchors,
      "reduced-participle": this.reducedProofAnchors,
      "scalar-auxiliary": (proof) => [
        proof.operator,
        proof.auxiliary,
        proof.scalar,
        proof.participle,
        proof.complement,
        proof.introducer,
        ...proof.adjuncts,
      ],
      action: (proof) => [proof.operator, proof.governor, proof.object],
      "coordinated-action": (proof) => [
        proof.operator,
        proof.governor,
        proof.firstAction,
        proof.coordinator,
        proof.object,
      ],
      "nominal-coordination": (proof) => [proof.core, proof.head, ...proof.branches],
      quantity: (proof) => [proof.core, proof.head],
      "nominal-modifier": (proof) => [proof.core, proof.operator, proof.head],
    });
  private alignedProofAnchor = (span: TextAnchor): boolean => {
    if (!this.charge(span.quote.length + this.frames.length * 2 + 3)) return false;
    return (
      span.endChar > span.startChar &&
      HashMap.has(this.tokenIndex, span.startChar) &&
      HashSet.has(this.tokenEnds, span.endChar) &&
      Str.slice(span.startChar, span.endChar)(this.claim.claimText) === span.quote &&
      A.some(
        this.frames,
        (frame) => inside(frame.extent, span) || O.exists(frame.introducer, (intro) => inside(intro, span))
      )
    );
  };
  private provedNominal = (core: TextAnchor): boolean =>
    A.some(
      this.attached,
      (nominal) => nominal.core.startChar === core.startChar && nominal.core.endChar === core.endChar
    );
  private provedArgument = (operator: TextAnchor, nominal: TextAnchor): boolean =>
    A.some(this.frames, (frame) =>
      A.some(
        frame.arguments,
        (argument) =>
          argument.nominal.startChar === nominal.startChar &&
          argument.nominal.endChar === nominal.endChar &&
          O.exists(argument.predicate, (predicate) => inside(predicate, operator))
      )
    );
  private proofMembership = (proof: ClaimSourceProof): boolean => {
    if (!this.charge(this.frames.length)) return false;
    if (
      !this.charge(
        this.attached.length * 2 +
          A.reduce(this.frames, this.frames.length, (sum, frame) => sum + frame.arguments.length * 3)
      )
    )
      return false;
    return ClaimSourceProof.match(proof, {
      "finite-pp": (proof) =>
        this.provedNominal(proof.subject) &&
        this.provedNominal(proof.complement) &&
        this.provedArgument(proof.operator, proof.subject) &&
        this.provedArgument(proof.operator, proof.complement),
      "reduced-adjective": this.reducedProofMembership,
      "reduced-participle": this.reducedProofMembership,
      "scalar-auxiliary": (proof) => this.provedArgument(proof.operator, proof.complement),
      action: (proof) => this.provedArgument(proof.operator, proof.object),
      "coordinated-action": (proof) => this.provedArgument(proof.operator, proof.object),
      quantity: this.nominalProofMembership,
      "nominal-coordination": this.nominalProofMembership,
      "nominal-modifier": this.nominalProofMembership,
    });
  };
  private reducedProofMembership = (
    proof: Extract<ClaimSourceProof, { readonly kind: "reduced-adjective" | "reduced-participle" }>
  ): boolean => this.provedNominal(proof.nominal) && this.provedArgument(proof.operator, proof.complement);
  private nominalProofMembership = (
    proof: Extract<ClaimSourceProof, { readonly kind: "quantity" | "nominal-coordination" | "nominal-modifier" }>
  ): boolean => this.provedNominal(proof.core) && inside(proof.core, proof.head);
  private proofVariableSize = (proof: ClaimSourceProof): number => {
    if (proof.kind === "finite-pp") return proof.labels.length + proof.adjuncts.length;
    if (proof.kind === "scalar-auxiliary") return proof.adjuncts.length;
    return proof.kind === "nominal-coordination" ? proof.branches.length : 0;
  };
  private validateProofs = (): boolean => {
    if (!this.charge(this.roles.proofs.length + this.frames.length)) return false;
    const argumentCount = A.reduce(this.frames, this.frames.length, (sum, frame) => sum + frame.arguments.length);
    for (const proof of this.roles.proofs) {
      const variable = this.proofVariableSize(proof);
      if (!this.charge(variable + argumentCount + 10)) return false;
      const anchors = this.proofAnchors(proof);
      if (!A.every(anchors, this.alignedProofAnchor) || !this.proofMembership(proof)) return false;
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
      this.validateNominals() &&
      this.validateElements() &&
      this.validateFrameParents() &&
      this.validateDeclarations() &&
      this.validateDeclarationPlans() &&
      this.validateProofs()
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
      A.some(this.roles.predicates, (p) => inside(p.anchor, token.anchor)) ||
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
  private partitiveTokenAdmitted = (index: number): boolean => {
    if (!this.charge(this.roles.proofs.length + 1)) return false;
    return (
      !this.barePartitive(index) ||
      A.some(
        this.roles.proofs,
        (proof) => proof.kind === "quantity" && inside(proof.core, O.getOrThrow(this.token(index)).anchor)
      )
    );
  };
  private partitiveAdmitted = (start: number, end: number, span: TextAnchor): boolean => {
    if (this.predicates(span).length > 0 || !HashSet.has(HashSet.make("a", "an"), this.word(start))) return true;
    for (let i = start; i < end; i++) {
      if (!this.charge(1)) return false;
      if (!this.partitiveTokenAdmitted(i)) return false;
    }
    return true;
  };
  private PPFollowedByObject = (span: TextAnchor, nominal: ClaimNominalSpan): boolean => {
    if (!this.charge(this.roles.predicates.length + 2)) return false;
    const start = HashMap.get(this.tokenIndex, nominal.anchor.startChar);
    const pp = O.exists(
      O.flatMap(start, (i) => this.token(i - 1)),
      (token) => token.pos === "ADP"
    );
    const governor = A.some(
      this.roles.predicates,
      (p) => p.kind === "finite" && p.anchor.startChar >= span.startChar && p.anchor.endChar <= nominal.anchor.startChar
    );
    return pp && governor;
  };
  private nominalGap = (span: TextAnchor, left: ClaimNominalSpan, right: ClaimNominalSpan): boolean => {
    if (!this.charge(right.anchor.startChar - left.anchor.endChar + 1)) return false;
    const blank = Str.trim(Str.slice(left.anchor.endChar, right.anchor.startChar)(this.claim.claimText)) === "";
    return !blank || this.PPFollowedByObject(span, left);
  };
  private unambiguousAuxiliaryPP = (span: TextAnchor, nominals: ReadonlyArray<ClaimNominalSpan>): boolean => {
    if (!this.charge(this.roles.predicates.length + nominals.length * 2 + this.tokens.length)) return false;
    const predicates = this.predicates(span);
    if (predicates.length !== 1 || !O.exists(A.head(predicates), (p) => p.kind === "auxiliary-head")) return true;
    // A bare auxiliary cannot choose between successive PP attachments.
    const pp = A.filter(nominals, (nominal) =>
      O.exists(HashMap.get(this.tokenIndex, nominal.anchor.startChar), (index) =>
        O.exists(this.token(index - 1), (token) => token.pos === "ADP")
      )
    );
    return pp.length <= 1;
  };
  private nominalSequence = (span: TextAnchor, nominals: ReadonlyArray<ClaimNominalSpan>): boolean => {
    for (let index = 1; index < nominals.length; index++)
      if (!this.nominalGap(span, O.getOrThrow(A.get(nominals, index - 1)), O.getOrThrow(A.get(nominals, index))))
        return false;
    return this.unambiguousAuxiliaryPP(span, nominals);
  };
  private leafNominalsAdmitted = (span: TextAnchor, nominals: ReadonlyArray<ClaimNominalSpan>): boolean =>
    nominals.length > 0 && this.subjectProved(span, nominals) && this.nominalSequence(span, nominals);
  private leafAttachments = (start: number, end: number, frame: number, span: TextAnchor): boolean =>
    this.attachments(start, end, frame) &&
    this.predicateAttachments(start, end, frame) &&
    this.reducedAttachments(span, frame);
  private leaf = (start: number, end: number, parent: number, grouping: ClaimElementGrouping): boolean => {
    const span = this.span(start, end);
    if (!this.reserve(span)) return false;
    const nominals = this.owned(span);
    if (!this.leafNominalsAdmitted(span, nominals)) return false;
    if (!this.functionsOwned(start, end, nominals) || !this.partitiveAdmitted(start, end, span)) return false;
    const before = this.frames.length;
    const owner = this.add(span, span, O.some(parent), grouping, false);
    return O.isSome(owner) && this.leafAttachments(start, end, before + 1, span);
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
  private colonProduction = (start: number, end: number, colon: number, parent: number, depth: number): boolean =>
    O.isSome(this.label(colon + 1))
      ? this.labelled(start, end, colon, parent, depth)
      : this.unlabelledDeclaration(start, end, colon, parent, depth);
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
    if (O.isSome(colon)) return this.colonProduction(start, end, colon.value, parent, depth);
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
  private nonDeclaration = (children: ReadonlyArray<readonly [number, number]>): O.Option<boolean> => {
    if (this.remaining < 0) return O.none();
    if (A.some(children, ([, to]) => this.word(to) === ";")) return O.some(false);
    const first = O.getOrThrow(A.head(children));
    return O.map(this.governingItem(first[0], first[1]), () => false);
  };
  private governingDeclaration = (
    start: number,
    end: number,
    root: number,
    children: ReadonlyArray<readonly [number, number]>,
    action: boolean
  ): O.Option<boolean> => {
    const operator = start - (this.word(start - 1) === ":" ? 2 : 1);
    const introEnd = this.word(start - 1) === ":" ? start : operator + 1;
    if (!this.rootDeclaration(operator, this.trimEnd(start, end), introEnd, root)) return O.none();
    const ordinals = this.declaredChildren(children, root, 1);
    if (O.isNone(ordinals)) return O.none();
    return this.canonicalDeclaration(
      action ? "action" : "composition",
      root,
      this.span(operator, introEnd),
      ordinals.value
    )
      ? O.some(true)
      : O.none();
  };
  private governingComposition = (start: number, end: number, root: number): O.Option<boolean> => {
    if (!HashSet.has(compositions, this.claim.transition)) return O.some(false);
    const children = this.declarationChildren(start, end);
    if (O.isNone(children) || !this.charge(children.value.length)) return O.none();
    if (children.value.length < 2) return O.some(false);
    const nominal = A.every(children.value, ([from, to]) => O.contains(this.governingItem(from, to), true));
    const action = !nominal && A.every(children.value, ([from, to]) => this.actionItem(from, to));
    if (!nominal && !action) return this.nonDeclaration(children.value);
    return this.governingDeclaration(start, end, root, children.value, action);
  };
  private projectBody = (root: number): boolean => {
    if (!this.charge(this.tokens.length)) return false;
    const indexes = this.located(this.body);
    if (indexes.length === 0) return false;
    let start = O.getOrThrow(A.head(indexes));
    const end = O.getOrThrow(A.last(indexes)) + 1;
    // The qualified body starts after its governing transition. Exclude only
    // its one leading separator; internal and repeated colons still need proof.
    if (!this.charge(1)) return false;
    if (this.word(start) === ":") start++;
    if (start >= end) return false;
    const declaration =
      O.isSome(this.label(start)) && this.word(start - 1) === ":" && HashSet.has(compositions, this.claim.transition);
    if (declaration) return this.labelled(start - 1, end, start - 1, root, 1);
    return O.match(this.governingComposition(start, end, root), {
      onNone: () => false,
      onSome: (composed) => composed || this.parse(start, end, root, "single-restriction", 1),
    });
  };
  private sameCore = (a: TextAnchor, b: TextAnchor): boolean =>
    a.startChar === b.startChar && a.endChar === b.endChar && a.quote === b.quote;
  private exclusionOverlap = (a: TextAnchor, b: TextAnchor): boolean =>
    a.startChar < b.endChar && b.startChar < a.endChar;
  private citationNumbers = (index: number): O.Option<readonly [ReadonlyArray<number>, number]> => {
    const references: Array<number> = [];
    let end = index + 1;
    while (end < this.tokens.length && inside(this.preamble, O.getOrThrow(this.token(end)).anchor)) {
      const decimal = this.citationDecimal(end);
      if (O.isNone(decimal)) return this.citationResult(references, end);
      references.push(decimal.value);
      end++;
      const width = this.citationConnector(end);
      if (O.isNone(width)) return O.none();
      if (width.value === 0) break;
      end += width.value;
    }
    return O.some([references, end]);
  };
  private citationResult = (
    references: ReadonlyArray<number>,
    end: number
  ): O.Option<readonly [ReadonlyArray<number>, number]> => (this.remaining < 0 ? O.none() : O.some([references, end]));
  private citationDecimal = (index: number): O.Option<number> => {
    const token = O.getOrThrow(this.token(index));
    if (!this.charge(token.anchor.quote.length + 5)) return O.none();
    return O.map(Str.match(/^[1-9][0-9]*$/u)(token.anchor.quote), () => Number(token.anchor.quote));
  };
  private citationConnector = (index: number): O.Option<0 | 1 | 2> => {
    if (!this.charge(4)) return O.none();
    const separator = this.word(index);
    if (!HashSet.has(citationSeparators, separator)) return O.some(0);
    const repeated = HashSet.has(citationWords, this.word(index + 1));
    const width = repeated ? 2 : 1;
    const next = this.token(index + width);
    const decimal = O.exists(
      next,
      (t) =>
        this.charge(t.anchor.quote.length + 1) &&
        inside(this.preamble, t.anchor) &&
        O.isSome(Str.match(/^[1-9][0-9]*$/u)(t.anchor.quote))
    );
    if (decimal) return O.some(width);
    // An explicit repeated keyword or a dangling coordinator is not a complete
    // citation end. Ordinary following noun syntax remains outside the citation.
    if (repeated) return O.none();
    const ordinaryEnd =
      separator === "," || O.exists(next, (t) => inside(this.preamble, t.anchor) && t.pos !== "PUNCT");
    return ordinaryEnd ? O.some(0) : O.none();
  };
  private unresolvedCitation = (start: number, end: number): boolean => {
    if (!this.charge(2)) return false;
    this.unresolvedCitations.push(this.span(start, end));
    return this.remaining >= 0;
  };
  private citationStarts = (index: number): boolean => {
    if (
      index < this.citationSkipUntil ||
      HashSet.has(this.protected, index) ||
      !HashSet.has(citationWords, this.word(index))
    )
      return false;
    const next = this.token(index + 1);
    return O.exists(
      next,
      (token) => this.charge(token.anchor.quote.length + 1) && O.isSome(Str.match(/^[1-9][0-9]*$/u)(token.anchor.quote))
    );
  };
  private citationExclusion = (index: number): boolean => {
    if (this.claim.claimType !== "dependent" || !this.citationStarts(index)) return this.remaining >= 0;
    const parsed = this.citationNumbers(index);
    if (O.isNone(parsed)) return false;
    const [references, end] = parsed.value;
    this.citationSkipUntil = end;
    if (!this.charge((references.length + this.claim.claimReferences.length) ** 2 + 1)) return false;
    const actual = A.dedupe(A.sort(references, (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0)));
    const expected = A.dedupe(
      A.sort(this.claim.claimReferences, (a: number, b: number) => (a < b ? -1 : a > b ? 1 : 0))
    );
    if (actual.length !== expected.length || !A.every(actual, (n, i) => O.contains(A.get(expected, i), n)))
      return this.unresolvedCitation(index, end);
    if (!this.charge(references.length + 4)) return false;
    this.sourceExclusions.push(
      ClaimSourceExclusion.cases["dependency-citation"].make({
        extent: this.span(index, end),
        claimReferences: expected,
      })
    );
    return true;
  };
  private transitionExclusion = (): boolean => {
    if (this.preamble.endChar >= this.body.startChar) return true;
    if (!this.charge(this.body.startChar - this.preamble.endChar + 4)) return false;
    this.sourceExclusions.push(
      ClaimSourceExclusion.cases["qualified-transition"].make({
        extent: TextAnchor.make({
          startChar: this.preamble.endChar,
          endChar: this.body.startChar,
          quote: Str.slice(this.preamble.endChar, this.body.startChar)(this.claim.claimText),
        }),
        preamble: this.preamble,
        body: this.body,
      })
    );
    return true;
  };
  private quoteExclusions = (): boolean => {
    const quotes = A.fromIterable(
      Str.matchAll(/"(?:\\.|[^"\\])*"|“[^”]*”|‘(?:[^’]|’(?=[\p{L}\p{N}]))*’/gu)(this.claim.claimText)
    );
    if (!this.charge(quotes.length * 4)) return false;
    for (const quote of quotes) {
      if (quote.index === undefined) return false;
      this.sourceExclusions.push(
        ClaimSourceExclusion.cases["quoted-protection"].make({
          extent: TextAnchor.make({ startChar: quote.index, endChar: quote.index + quote[0].length, quote: quote[0] }),
        })
      );
    }
    return true;
  };
  private declarationExclusions = (): boolean => {
    for (const declaration of this.declarations) {
      if (!this.charge(declaration.items.length * 3)) return false;
      for (const item of declaration.items)
        this.sourceExclusions.push(
          ClaimSourceExclusion.cases["declaration-metadata"].make({ extent: item.label, owner: declaration.owner })
        );
    }
    return true;
  };
  private citationExclusions = (): boolean => {
    for (let i = 0; i < this.tokens.length; i++) {
      if (!this.charge(1)) return false;
      if (inside(this.preamble, O.getOrThrow(this.token(i)).anchor) && !this.citationExclusion(i)) return false;
    }
    return true;
  };
  private prepareSourceExclusions = (): boolean =>
    this.charge(this.claim.claimText.length + this.tokens.length + this.declarations.length + 2) &&
    this.transitionExclusion() &&
    this.quoteExclusions() &&
    this.declarationExclusions() &&
    this.citationExclusions();
  private preambleCoreBlocked = (nominal: ClaimNominalSpan): boolean =>
    A.some(
      this.sourceExclusions,
      (e) =>
        this.exclusionOverlap(nominal.anchor, e.extent) &&
        (e.kind !== "quoted-protection" || !inside(nominal.anchor, e.extent))
    ) || A.some(this.unresolvedCitations, (extent) => this.exclusionOverlap(nominal.anchor, extent));
  private sourceClauseAligned = (scope: TextAnchor): boolean =>
    this.charge(scope.quote.length + 3) &&
    HashMap.has(this.tokenIndex, scope.startChar) &&
    HashSet.has(this.tokenEnds, scope.endChar) &&
    Str.slice(scope.startChar, scope.endChar)(this.claim.claimText) === scope.quote;
  private preambleCandidate = (nominal: ClaimNominalSpan): O.Option<number> => {
    if (
      !this.charge(this.roles.clauses.length + this.sourceExclusions.length + this.unresolvedCitations.length + 1) ||
      this.preambleCoreBlocked(nominal)
    )
      return O.none();
    for (let i = 0; i < this.roles.clauses.length; i++) {
      const clause = O.getOrThrow(A.get(this.roles.clauses, i));
      if (!this.charge(clause.nominals.length + nominal.anchor.quote.length + 1)) return O.none();
      if (
        inside(clause.anchor, nominal.anchor) &&
        A.some(clause.nominals, (core) => this.sameCore(core, nominal.anchor))
      )
        return O.filter(O.some(i + 1), () => this.sourceClauseAligned(clause.anchor));
    }
    return O.none();
  };
  private existingCoreOwner = (nominal: ClaimNominalSpan): O.Option<boolean> => {
    if (!this.charge(this.elements.length + nominal.anchor.quote.length + 1)) return O.none();
    let found = false;
    for (const element of this.elements) {
      if (!this.charge(element.nominals.length * (nominal.anchor.quote.length + 1) + 1)) return O.none();
      found = found || A.some(element.nominals, (n) => this.sameCore(n.anchor, nominal.anchor));
    }
    return O.some(found);
  };
  private excludedPreambleCore = (nominal: ClaimNominalSpan): boolean =>
    this.charge(this.sourceExclusions.length + this.tokens.length + 1) &&
    A.some(this.sourceExclusions, (e) => e.kind !== "quoted-protection" && inside(e.extent, nominal.anchor));
  private additionalPreambleCore = (nominal: ClaimNominalSpan): O.Option<boolean> => {
    const existing = this.existingCoreOwner(nominal);
    if (O.isNone(existing)) return O.none();
    if (existing.value) return O.some(false);
    const clause = this.preambleCandidate(nominal);
    if (O.isSome(clause)) return O.some(true);
    return this.remaining >= 0 && this.excludedPreambleCore(nominal) ? O.some(false) : O.none();
  };
  private updatePreambleFrame = (root: ClaimPlannedElement, nominals: ReadonlyArray<ClaimNominalSpan>): boolean => {
    const main = O.getOrThrow(HashMap.get(this.frameByElement, root.ordinal));
    const frame = O.getOrThrow(A.get(this.frames, main - 1));
    if (!this.charge(nominals.length * 8 + this.roles.predicates.length + 2)) return false;
    const args =
      this.predicates(this.preamble).length === 0
        ? this.argumentPlan(this.preamble, nominals, [])
        : {
            subject: frame.subject,
            arguments: A.map(nominals, (n) =>
              ClaimFrameArgument.make({
                nominal: n.anchor,
                role: "unknown",
                predicate: O.none(),
                ownerNominal: O.none(),
              })
            ),
          };
    this.frames[main - 1] = ClaimSourceFrame.make({ ...frame, nominals: A.map(nominals, (n) => n.anchor), ...args });
    return this.remaining >= 0;
  };
  private appendPreambleCore = (
    nominal: ClaimNominalSpan,
    nominals: ReadonlyArray<ClaimNominalSpan>
  ): O.Option<ReadonlyArray<ClaimNominalSpan>> => {
    const additional = this.additionalPreambleCore(nominal);
    if (O.isNone(additional)) return O.none();
    if (!additional.value) return O.some(nominals);
    if (
      !inside(nominal.anchor, nominal.head) ||
      !this.alignedProofAnchor(nominal.anchor) ||
      !this.alignedProofAnchor(nominal.head)
    )
      return O.none();
    if (
      !this.charge(nominals.length + this.attached.length + nominal.anchor.quote.length + nominal.head.quote.length + 4)
    )
      return O.none();
    this.attached = A.append(
      this.attached,
      ClaimAttachedNominal.make({ core: nominal.anchor, head: nominal.head, outer: nominal.anchor, nominal })
    );
    return O.some(A.append(nominals, nominal));
  };
  private expandPreambleOwnership = (): boolean => {
    const root = O.getOrThrow(A.head(this.elements));
    if (!this.charge(this.roles.nominals.length + root.nominals.length + 1)) return false;
    let nominals: ReadonlyArray<ClaimNominalSpan> = A.copy(root.nominals);
    for (const nominal of this.roles.nominals) {
      if (!inside(this.preamble, nominal.anchor)) continue;
      const next = this.appendPreambleCore(nominal, nominals);
      if (O.isNone(next)) return false;
      nominals = next.value;
    }
    return this.commitPreambleOwnership(root, nominals);
  };
  private commitPreambleOwnership = (
    root: ClaimPlannedElement,
    candidates: ReadonlyArray<ClaimNominalSpan>
  ): boolean => {
    if (!this.charge(candidates.length ** 2 + this.attached.length ** 2 + 2)) return false;
    const nominals = A.sort(candidates, (a: ClaimNominalSpan, b: ClaimNominalSpan) =>
      a.anchor.startChar < b.anchor.startChar ? -1 : a.anchor.startChar > b.anchor.startChar ? 1 : 0
    );
    this.attached = A.sort(this.attached, (a: ClaimAttachedNominal, b: ClaimAttachedNominal) =>
      a.core.startChar < b.core.startChar ? -1 : a.core.startChar > b.core.startChar ? 1 : 0
    );
    this.elements[0] = ClaimPlannedElement.make({ ...root, nominals });
    return this.updatePreambleFrame(root, nominals);
  };
  private ownerCertificate = (
    element: ClaimPlannedElement,
    nominal: ClaimNominalSpan,
    core: number
  ): O.Option<ClaimTermOwnerCertificate> => {
    const fields = { element: element.ordinal, roleNominal: core };
    if (inside(element.lexicalHeader, nominal.anchor))
      return O.some(
        ClaimTermOwnerCertificate.cases["existing-element-nominal"].make({
          ...fields,
          production: element.grouping,
          lexicalRegion: element.lexicalHeader,
        })
      );
    const clause = this.preambleCandidate(nominal);
    return element.grouping === "preamble"
      ? O.map(clause, (sourceClause) =>
          ClaimTermOwnerCertificate.cases["preamble-clause-nominal"].make({
            ...fields,
            sourceClause,
            clauseNominal: nominal.anchor,
            preamble: this.preamble,
          })
        )
      : O.none();
  };
  private ownerRegion = (
    element: ClaimPlannedElement,
    nominal: ClaimNominalSpan,
    ordinal: number
  ): O.Option<ClaimOwnedTermRegion> => {
    if (!this.charge(nominal.anchor.quote.length + 8)) return O.none();
    const core = HashMap.get(this.attachedIndices, nominal.anchor.startChar);
    if (O.isNone(core)) return O.none();
    const certificate = this.ownerCertificate(element, nominal, core.value + 1);
    if (O.isNone(certificate) || !this.charge(nominal.anchor.quote.length + 8)) return O.none();
    return O.some(
      ClaimOwnedTermRegion.make({
        ordinal,
        ownerElement: element.ordinal,
        core: core.value + 1,
        extent: nominal.anchor,
        certificate: certificate.value,
      })
    );
  };
  private ownerRegions = (element: ClaimPlannedElement): O.Option<ReadonlyArray<ClaimOwnedTermRegion>> => {
    if (!this.charge(element.nominals.length + 1)) return O.none();
    const regions: Array<ClaimOwnedTermRegion> = [];
    for (const nominal of element.nominals) {
      const region = this.ownerRegion(element, nominal, regions.length + 1);
      if (O.isNone(region)) return O.none();
      regions.push(region.value);
    }
    return O.some(regions);
  };
  private indexAttachedCores = (): boolean => {
    if (!this.charge(this.attached.length * 3)) return false;
    for (let index = 0; index < this.attached.length; index++) {
      const core = O.getOrThrow(A.get(this.attached, index)).core;
      if (HashMap.has(this.attachedIndices, core.startChar)) return false;
      this.attachedIndices = HashMap.set(this.attachedIndices, core.startChar, index);
    }
    return true;
  };
  private prepareTermOwnership = (): boolean => {
    if (!this.prepareSourceExclusions() || !this.expandPreambleOwnership() || !this.indexAttachedCores()) return false;
    for (let i = 0; i < this.elements.length; i++) {
      const element = O.getOrThrow(A.get(this.elements, i));
      const regions = this.ownerRegions(element);
      if (O.isNone(regions) || !this.charge(1)) return false;
      this.elements[i] = ClaimPlannedElement.make({ ...element, ownedTermRegions: regions.value });
    }
    return true;
  };
  private finishSourceFacts = (): boolean =>
    this.deriveLabelledDeclarations() &&
    this.nominalAttachments() &&
    this.prepareTermOwnership() &&
    this.finalizeFrames() &&
    this.validatePlan() &&
    this.charge(this.attached.length + this.elements.length + 3);
  private finish = (): O.Option<ClaimSourceElementPlan> => {
    if (!this.charge(this.declarationPlans.length ** 2)) return O.none();
    this.declarationPlans = A.sort(
      this.declarationPlans,
      (left: ClaimSourceDeclaration, right: ClaimSourceDeclaration) =>
        left.anchor.startChar < right.anchor.startChar ? -1 : left.anchor.startChar > right.anchor.startChar ? 1 : 0
    );
    if (!this.finishSourceFacts()) return O.none();
    const plan = ClaimSourceElementPlan.make({
      qualifiedText: this.claim.claimText,
      remainingWork: this.remaining,
      frames: this.frames,
      nominals: this.attached,
      sourceExclusions: this.sourceExclusions,
      elements: this.elements,
      declarations: this.declarations,
      declarationPlans: this.declarationPlans,
      proofs: this.roles.proofs,
      roles: ClaimClauseRolePlan.make({
        ...this.roles,
        nominals: A.flatMap(this.elements, (element) => element.nominals),
      }),
    });
    if (!validateClaimSourceOwnership(plan, this.charge) || !this.charge(1)) return O.none();
    return O.some(ClaimSourceElementPlan.make({ ...plan, remainingWork: this.remaining }));
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
