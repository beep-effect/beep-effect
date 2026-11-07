/**
 * Existing patent transition selection and source-preserving scope derivation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { TextAnchor } from "@beep/provenance/TextAnchor";
import * as A from "effect/Array";
import { constant, dual, flow, pipe } from "effect/Function";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { PatentClaimTransition } from "./PatentDocument.model.ts";
import type { PatentClaim } from "./PatentDocument.model.ts";

/**
 * Existing lexical transition spellings used by document qualification.
 *
 * **Example** (Recognize a source spelling)
 * ```ts
 * import { transitionPattern } from "../../src/values/PatentDocument/PatentDocument.transition.ts"
 * import * as O from "effect/Option"
 * import * as Str from "effect/String"
 * console.log(O.isSome(Str.match(transitionPattern)("where a sensor is fixed"))) // true
 * ```
 * @category constants
 * @since 0.0.0
 */
export const transitionPattern =
  /\b(consisting essentially of|consisting of|comprising|comprises|comprised of|including|includes|having|wherein|where|(?:(?:is|being)\s+)?characteri[sz]ed (?:in that|by(?: the fact that| the steps of)?)|in which(?: method)?)\b/giu;
const isAmbiguousLexicalTransition = S.is(S.Literals(["including", "having"]));
const ambiguousTransitionPrefixPattern = /\b(?:by|for|of|without)\s*$/iu;
const implicitTransitionPattern = /,(?=\s+(?:the|said|each|an?|operating)\b)/giu;
const implicitParentPattern = /\bclaims?\s+\d+(?:(?:\s*,\s*|\s+(?:and|or|to|through)\s+)\d+)*\s*$/iu;
const implicitPredicatePattern = /\b(?:being|is|are|operating|operative|corresponding|performing)\b/iu;
const byMatchIndex = Order.mapInput(Num.Order, (match: RegExpMatchArray) =>
  O.getOrElse(O.fromUndefinedOr(match.index), constant(0))
);

/**
 * Preserve the normalizer's canonical transition mapping.
 *
 * **Example** (Retain a canonical role for raw wording)
 * ```ts
 * import { parseClaimTransition } from "../../src/values/PatentDocument/PatentDocument.transition.ts"
 * console.log(parseClaimTransition("where")) // wherein
 * ```
 * @category normalization
 * @since 0.0.0
 */
export const parseClaimTransition: (value: string) => PatentClaimTransition = flow(
  Str.toLowerCase,
  Str.replace(/^(?:(?:(?:is|being)\s+)?characteri[sz]ed .+|in which(?: method)?|where)$/u, "wherein"),
  Str.replace(/^(?:comprises|comprised of)$/u, "comprising"),
  Str.replace(/^includes$/u, "including"),
  Str.replace(/^,$/u, "wherein"),
  S.decodeUnknownOption(PatentClaimTransition),
  O.getOrThrow
);

/**
 * Apply the normalizer's existing preamble trim, including its further modifier.
 *
 * **Example** (Keep further in the original source)
 * ```ts
 * import { trimClaimTransitionPreamble } from "../../src/values/PatentDocument/PatentDocument.transition.ts"
 * console.log(trimClaimTransitionPreamble("The system of claim 1, further ")) // The system of claim 1
 * ```
 * @category normalization
 * @since 0.0.0
 */
export const trimClaimTransitionPreamble = flow(Str.trim, Str.replace(/,?\s+further$/iu, ""), Str.trim);

type TransitionEligibility = (match: RegExpMatchArray) => O.Option<boolean>;

const reserveTransitionWork = (charge: ((amount: number) => boolean) | undefined, amount: number): boolean =>
  charge === undefined || charge(amount);

// Numeric dispositions avoid allocating per-candidate state: -1 exhausted, 0 skipped, 1 retained.
const transitionEligibility = (match: RegExpMatchArray, eligible: TransitionEligibility | undefined): number => {
  if (eligible === undefined) return 1;
  const accepted = eligible(match);
  if (O.isNone(accepted)) return -1;
  return accepted.value ? 1 : 0;
};
const lexicalTransitionDisposition = (
  text: string,
  match: RegExpMatchArray,
  charge: ((amount: number) => boolean) | undefined,
  eligible: TransitionEligibility | undefined
): number => {
  const disposition = transitionEligibility(match, eligible);
  if (disposition !== 1) return disposition;
  if (!reserveTransitionWork(charge, match[0].length * 2 + 4)) return -1;
  const transition = Str.toLowerCase(match[0]);
  const index = O.getOrElse(O.fromUndefinedOr(match.index), constant(0));
  if (!isAmbiguousLexicalTransition(transition)) return 1;
  if (!reserveTransitionWork(charge, index * 2 + 8)) return -1;
  return O.isSome(Str.match(ambiguousTransitionPrefixPattern)(Str.slice(0, index)(text))) ? 0 : 1;
};
const lexicalTransitionMatches = (
  text: string,
  charge?: (amount: number) => boolean,
  eligible?: TransitionEligibility
): O.Option<ReadonlyArray<RegExpMatchArray>> => {
  if (!reserveTransitionWork(charge, text.length * 4 + 16)) return O.none();
  const raw = A.fromIterable(Str.matchAll(transitionPattern)(text));
  const matches: Array<RegExpMatchArray> = [];
  for (const match of raw) {
    const disposition = lexicalTransitionDisposition(text, match, charge, eligible);
    if (disposition < 0) return O.none();
    if (disposition === 0) continue;
    if (!reserveTransitionWork(charge, 1)) return O.none();
    matches.push(match);
  }
  return O.some(matches);
};
const implicitTransitionDisposition = (
  text: string,
  match: RegExpMatchArray,
  charge: ((amount: number) => boolean) | undefined,
  eligible: TransitionEligibility | undefined
): number => {
  const disposition = transitionEligibility(match, eligible);
  if (disposition !== 1) return disposition;
  const index = O.getOrElse(O.fromUndefinedOr(match.index), constant(0));
  if (!reserveTransitionWork(charge, index * 2 + 8)) return -1;
  if (O.isNone(Str.match(implicitParentPattern)(Str.slice(0, index)(text)))) return 0;
  if (!reserveTransitionWork(charge, (text.length - index) * 2 + 8)) return -1;
  return O.isSome(Str.match(implicitPredicatePattern)(Str.slice(index + 1)(text))) ? 1 : 0;
};
const implicitTransitionMatch = (
  text: string,
  charge: ((amount: number) => boolean) | undefined,
  exhausted: () => void,
  eligible: TransitionEligibility | undefined
): O.Option<RegExpMatchArray> => {
  if (!reserveTransitionWork(charge, text.length * 4 + 8)) {
    exhausted();
    return O.none();
  }
  const raw = A.fromIterable(Str.matchAll(implicitTransitionPattern)(text));
  for (const match of raw) {
    const disposition = implicitTransitionDisposition(text, match, charge, eligible);
    if (disposition < 0) {
      exhausted();
      return O.none();
    }
    if (disposition > 0) return O.some(match);
  }
  return O.none();
};
const definingTransitionMatch = (
  text: string,
  matches: ReadonlyArray<RegExpMatchArray>,
  subject: O.Option<string>,
  charge: ((amount: number) => boolean) | undefined,
  exhausted: () => void
): O.Option<RegExpMatchArray> => {
  for (const match of matches) {
    const index = O.getOrElse(O.fromUndefinedOr(match.index), constant(0));
    if (!reserveTransitionWork(charge, index * 6 + match[0].length * 2 + 16)) {
      exhausted();
      return O.none();
    }
    const prefix = pipe(Str.slice(0, match.index)(text), Str.trim, Str.toLowerCase);
    if (
      O.isSome(Str.match(/^(?:(?:is|being)\s+)?characteri[sz]ed\b/iu)(match[0])) &&
      (O.isSome(Str.match(/[,;]$/u)(prefix)) ||
        O.exists(subject, (value) => Str.endsWith(` said ${value}`)(prefix) || Str.endsWith(` the ${value}`)(prefix)))
    )
      return O.some(match);
  }
  return O.none();
};

const selectClaimTransition = (
  claimText: string,
  charge?: (amount: number) => boolean,
  eligible?: TransitionEligibility
): O.Option<RegExpMatchArray> => {
  const matches = lexicalTransitionMatches(claimText, charge, eligible);
  if (O.isNone(matches)) return O.none();
  let exhausted = false;
  const implicit = implicitTransitionMatch(
    claimText,
    charge,
    () => {
      exhausted = true;
    },
    eligible
  );
  if (exhausted || !reserveTransitionWork(charge, 16)) return O.none();
  // Only these at-most-two entries are sorted, exactly as in qualification.
  const first = pipe(A.getSomes([A.head(matches.value), implicit]), A.sort(byMatchIndex), A.head);
  const firstIndex = O.match(first, { onNone: () => 0, onSome: (match) => match.index ?? 0 });
  if (!reserveTransitionWork(charge, firstIndex * 4 + 16)) return O.none();
  const subject = first.pipe(
    O.map((match) => Str.slice(0, match.index)(claimText)),
    O.flatMap(
      Str.match(/^(?:(?:an?|the)\s+)?(.+?)(?=\s+(?:for|of|with|according|as|to|designed|intended)\b|\s*\(\d|[,;:]|$)/iu)
    ),
    O.flatMap(A.get(1)),
    O.map(flow(Str.trim, Str.toLowerCase))
  );
  const defining = definingTransitionMatch(claimText, matches.value, subject, charge, () => {
    exhausted = true;
  });
  if (exhausted || !reserveTransitionWork(charge, O.match(first, { onNone: () => 0, onSome: (m) => m[0].length }) + 4))
    return O.none();
  return O.exists(first, (match) => O.isSome(Str.match(/^(?:wherein|having|including)$/iu)(match[0]))) &&
    O.isSome(defining)
    ? defining
    : first;
};

/**
 * Select the same governing transition as qualification; scope callers supply their actual work meter.
 *
 * **Details**
 *
 * The absent meter is reserved for the existing normalizer lane. A supplied
 * meter fails closed before its next scan or allocation and never resets.
 *
 * **Example** (Decline before a metered scan)
 * ```ts
 * import { transitionFromClaimText } from "../../src/values/PatentDocument/PatentDocument.transition.ts"
 * import * as O from "effect/Option"
 * console.log(O.isNone(transitionFromClaimText("A system comprising a sensor.", () => false))) // true
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const transitionFromClaimText: {
  (claimText: string): O.Option<RegExpMatchArray>;
  (claimText: string, charge: (amount: number) => boolean): O.Option<RegExpMatchArray>;
  (charge: (amount: number) => boolean): (claimText: string) => O.Option<RegExpMatchArray>;
} = dual((args) => P.isString(args[0]), selectClaimTransition);

const quotedScopeDelimiter = (text: string, index: number, current: string, quote: string): string => {
  if (current !== quote) return quote;
  if (quote === "’" && O.isSome(Str.match(/^[\p{L}\p{N}]/u)(Str.slice(index + 1, index + 3)(text)))) return quote;
  return "";
};
const openingScopeQuote = (current: string): string => {
  if (current === '"') return '"';
  if (current === "“") return "”";
  return current === "‘" ? "’" : "";
};
const openingScopeBracket = (current: string): string => {
  if (current === "(") return ")";
  return current === "[" ? "]" : "";
};
const closingScopeBracketMatches = (brackets: Array<string>, current: string): boolean => {
  if (current === ")" || current === "]") return brackets.pop() === current;
  return true;
};
const scopeBracketStep = (brackets: Array<string>, current: string, inside: boolean): boolean => {
  const close = openingScopeBracket(current);
  if (close === "") return closingScopeBracketMatches(brackets, current);
  if (inside || brackets.length >= 128) return false;
  brackets.push(close);
  return true;
};
const unquotedScopeStep = (brackets: Array<string>, current: string, inside: boolean): string => {
  const quote = openingScopeQuote(current);
  if (quote !== "" && inside) return "\0";
  return scopeBracketStep(brackets, current, inside) ? quote : "\0";
};
const protectedScopeState = (index: number, start: number, quote: string, brackets: ReadonlyArray<string>): boolean =>
  index >= start && (quote !== "" || brackets.length > 0);
const quotedScopeIndex = (index: number, quote: string, current: string): number =>
  quote === '"' && current === "\\" ? index + 1 : index;
const rawScopeUnprotected = (
  text: string,
  start: number,
  end: number,
  charge: (amount: number) => boolean
): boolean => {
  if (!charge(end * 8 + 16)) return false;
  let quote = "";
  const brackets: Array<string> = [];
  for (let index = 0; index < end; index++) {
    const current = Str.slice(index, index + 1)(text);
    if (protectedScopeState(index, start, quote, brackets)) return false;
    if (quote !== "") {
      const nextIndex = quotedScopeIndex(index, quote, current);
      quote = quotedScopeDelimiter(text, index, current, quote);
      index = nextIndex;
      continue;
    }
    quote = unquotedScopeStep(brackets, current, index >= start);
    if (quote === "\0") return false;
  }
  return !protectedScopeState(end, end, quote, brackets);
};

const originalTransitionEligibility =
  (text: string, charge: (amount: number) => boolean): TransitionEligibility =>
  (match) => {
    if (!charge(6)) return O.none();
    const start = match.index;
    if (start === undefined) return O.some(false);
    let exhausted = false;
    const sourceCharge = (amount: number): boolean => {
      const accepted = charge(amount);
      if (!accepted) exhausted = true;
      return accepted;
    };
    const unprotected = rawScopeUnprotected(text, start, start + match[0].length, sourceCharge);
    return exhausted ? O.none() : O.some(unprotected);
  };

const selectScopeTransition = (
  text: string,
  end: number,
  raw: string,
  canonical: PatentClaimTransition,
  charge: (amount: number) => boolean,
  eligible: TransitionEligibility
): O.Option<RegExpMatchArray> => {
  // These modes cannot trigger the selector's later defining-clause override.
  if (raw === canonical && canonical !== "wherein" && canonical !== "having" && canonical !== "including") {
    if (!charge(end * 4 + 16)) return O.none();
    const prefix = Str.slice(0, end)(text);
    // A comma may become eligible only because of a later body predicate.
    // Any such lexical candidate requires the complete original selector.
    if (O.isNone(Str.match(implicitTransitionPattern)(prefix))) return selectClaimTransition(prefix, charge, eligible);
  }
  return selectClaimTransition(text, charge, eligible);
};

const originalTransitionEnvelopeMatches = (claim: PatentClaim, charge: (amount: number) => boolean): boolean => {
  if (!charge(claim.preamble.length + claim.body.length + 16)) return false;
  return Str.startsWith(claim.preamble)(claim.claimText) && Str.endsWith(claim.body)(claim.claimText);
};
const rawTransitionStart = (text: string, start: number, end: number, charge: (amount: number) => boolean): number => {
  while (start < end) {
    if (!charge(3)) return -1;
    if (O.isNone(Str.match(/\s/u)(Str.slice(start, start + 1)(text)))) break;
    start++;
  }
  return start;
};
const rawTransitionEnd = (text: string, start: number, end: number, charge: (amount: number) => boolean): number => {
  while (end > start) {
    if (!charge(3)) return -1;
    if (O.isNone(Str.match(/\s/u)(Str.slice(end - 1, end)(text)))) break;
    end--;
  }
  return end;
};
const selectedTransitionFieldsMatch = (
  claim: PatentClaim,
  match: RegExpMatchArray,
  index: number,
  bodyStart: number
): boolean =>
  parseClaimTransition(match[0]) === claim.transition &&
  trimClaimTransitionPreamble(Str.slice(0, index)(claim.claimText)) === claim.preamble &&
  Str.trim(Str.slice(index + match[0].length, bodyStart)(claim.claimText)) === "" &&
  O.isNone(Str.match(/\s/u)(Str.slice(0, 1)(claim.body))) &&
  O.isNone(Str.match(/\s/u)(Str.slice(-1)(claim.body)));

const selectedRawTransitionAnchor = (
  claim: PatentClaim,
  match: RegExpMatchArray,
  start: number,
  end: number,
  raw: string,
  charge: (amount: number) => boolean
): O.Option<TextAnchor> => {
  const index = match.index;
  if (index === undefined) return O.none();
  const bodyStart = claim.claimText.length - claim.body.length;
  const matchEnd = index + match[0].length;
  if (matchEnd > bodyStart) return O.none();
  if (!charge(index * 4 + match[0].length * 8 + (bodyStart - matchEnd) * 2 + 48)) return O.none();
  // endsWith already proves every body byte; boundary checks preserve trim equality.
  if (!selectedTransitionFieldsMatch(claim, match, index, bodyStart)) return O.none();
  if (!rawScopeUnprotected(claim.claimText, start, end, charge)) return O.none();
  if (!charge(8)) return O.none();
  return O.some(TextAnchor.make({ startChar: start, endChar: end, quote: raw }));
};

/**
 * Derive the complete licensed raw gap from original qualified UTF-16 source fields.
 *
 * **Example** (Preserve where rather than inventing wherein text)
 * ```ts
 * import { rawClaimTransitionScope } from "../../src/values/PatentDocument/PatentDocument.transition.ts"
 * import { PatentClaim } from "@beep/law-practice-domain/values/PatentDocument"
 * import * as O from "effect/Option"
 * const claim = PatentClaim.cases.independent.make({ claimNumber: 1, claimText: "A system where a sensor is fixed.", preamble: "A system", transition: "wherein", body: "a sensor is fixed." })
 * let remaining = 262_144
 * const result = rawClaimTransitionScope(claim, amount => { remaining -= amount; return remaining >= 0 })
 * console.log(O.getOrElse(O.map(result, scope => scope.quote), () => "unavailable")) // where
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const rawClaimTransitionScope: {
  (charge: (amount: number) => boolean): (claim: PatentClaim) => O.Option<TextAnchor>;
  (claim: PatentClaim, charge: (amount: number) => boolean): O.Option<TextAnchor>;
} = dual(2, (claim: PatentClaim, charge: (amount: number) => boolean): O.Option<TextAnchor> => {
  const text = claim.claimText;
  if (!originalTransitionEnvelopeMatches(claim, charge)) return O.none();
  const bodyStart = text.length - claim.body.length;
  if (bodyStart <= claim.preamble.length) return O.none();
  const start = rawTransitionStart(text, claim.preamble.length, bodyStart, charge);
  if (start < 0) return O.none();
  const end = rawTransitionEnd(text, start, bodyStart, charge);
  if (end < 0) return O.none();
  if (start >= end || !charge((end - start) * 2 + 8)) return O.none();
  const raw = Str.slice(start, end)(text);
  if (!charge(4)) return O.none();
  const eligible = originalTransitionEligibility(text, charge);
  const selected = selectScopeTransition(text, end, raw, claim.transition, charge, eligible);
  if (O.isNone(selected)) return O.none();
  return selectedRawTransitionAnchor(claim, selected.value, start, end, raw, charge);
});
