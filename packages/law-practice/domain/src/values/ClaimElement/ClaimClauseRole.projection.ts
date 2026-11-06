/**
 * Atomic role projection into existing source term payloads.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Str from "effect/String";
import { clauseNominalHead } from "./ClaimClauseRole.behavior.ts";
import type { TextAnchor } from "@beep/provenance/TextAnchor";
import type { ClaimClauseRolePlan, ClaimNominalSpan } from "./ClaimClauseRole.model.ts";
import type { ClaimTerm } from "./ClaimElement.model.ts";

const overlaps = (left: typeof TextAnchor.Encoded, right: typeof TextAnchor.Encoded): boolean =>
  left.startChar < right.endChar && right.startChar < left.endChar;
const sourceOrder = Order.mapInput(Num.Order, (span: TextAnchor) => span.startChar);
const termOrder = Order.mapInput(Num.Order, (term: typeof ClaimTerm.Encoded) => term.anchor.startChar);
const ownedBy =
  (owned: typeof TextAnchor.Encoded) =>
  ({ anchor }: { readonly anchor: TextAnchor }): boolean =>
    anchor.startChar >= owned.startChar && anchor.endChar <= owned.endChar;

// A noun-tag hypothesis cannot bridge two independent legacy terms or annex
// source text beyond an already established legacy predicate boundary.
const respectsLegacyBoundary =
  (original: ReadonlyArray<typeof ClaimTerm.Encoded>) =>
  (nominal: ClaimNominalSpan): boolean => {
    const previous = A.filter(original, (term) => overlaps(term.anchor, nominal.anchor));
    return previous.length <= 1 && !A.some(previous, (term) => term.anchor.endChar < nominal.anchor.endChar);
  };

// Refinement of an original nominal is atomic. Every non-whitespace source
// character must belong to a complete new nominal or a proved function span.
// A partial `nut`/`shaft` parse leaves the possessive clitic uncovered and keeps
// the complete legacy nominal, rather than deleting its owner's provenance.
const coveredGap = (text: string, from: number, to: number): boolean =>
  to <= from || Str.trim(Str.slice(from, to)(text)) === "";
const completelyCovered = (
  text: string,
  original: typeof TextAnchor.Encoded,
  intervals: ReadonlyArray<TextAnchor>
): boolean => {
  let cursor = original.startChar;
  for (let index = 0; index < intervals.length && cursor < original.endChar; index++) {
    const interval = O.getOrThrow(A.get(intervals, index));
    if (interval.endChar <= cursor) continue;
    if (interval.startChar >= original.endChar) break;
    const gapEnd = Num.min(interval.startChar, original.endChar);
    if (!coveredGap(text, cursor, gapEnd)) return false;
    cursor = Num.max(cursor, interval.endChar);
  }
  return Str.trim(Str.slice(cursor, original.endChar)(text)) === "";
};

const projectTerms = (
  plan: ClaimClauseRolePlan,
  owned: typeof TextAnchor.Encoded,
  original: ReadonlyArray<typeof ClaimTerm.Encoded>,
  charge: (amount: number) => boolean
): O.Option<ReadonlyArray<typeof ClaimTerm.Encoded>> => {
  if (!charge(original.length + 1)) return O.none();
  const characters = A.reduce(original, 0, (sum, term) => sum + term.anchor.quote.length);
  const size = plan.nominals.length + plan.predicates.length;
  // Bound all filters, interval/term sorts and the monotonic coverage scans
  // before allocating them. Each coverage gap reads disjoint original text.
  const work =
    characters + (size + 1) * (original.length + 1) * 8 + (size + 1) ** 2 + (size + original.length + 1) ** 2;
  if (!charge(work)) return O.none();
  const nominals = A.filter(A.filter(plan.nominals, ownedBy(owned)), respectsLegacyBoundary(original));
  const functions = A.filter(plan.predicates, ownedBy(owned));
  const intervals = A.sort(
    A.appendAll(
      A.map(nominals, ({ anchor }) => anchor),
      A.map(functions, ({ anchor }) => anchor)
    ),
    sourceOrder
  );
  const keep = A.filter(original, (term) => !completelyCovered(plan.qualifiedText, term.anchor, intervals));
  const proposed = A.map(
    A.filter(nominals, (nominal) => !A.some(keep, (term) => overlaps(term.anchor, nominal.anchor))),
    (nominal) => ({
      anchor: nominal.anchor,
      determiner: nominal.determiner,
      head: clauseNominalHead(nominal),
    })
  );
  return O.some(A.sort(A.appendAll(keep, proposed), termOrder));
};

/**
 * Project only fully owned source terms under one shared source reservation.
 *
 * @category parsing
 * @since 0.0.0
 */
export const projectClaimRoleTerms: {
  (
    owned: typeof TextAnchor.Encoded,
    original: ReadonlyArray<typeof ClaimTerm.Encoded>,
    charge: (amount: number) => boolean
  ): (plan: ClaimClauseRolePlan) => O.Option<ReadonlyArray<typeof ClaimTerm.Encoded>>;
  (
    plan: ClaimClauseRolePlan,
    owned: typeof TextAnchor.Encoded,
    original: ReadonlyArray<typeof ClaimTerm.Encoded>,
    charge: (amount: number) => boolean
  ): O.Option<ReadonlyArray<typeof ClaimTerm.Encoded>>;
} = dual(4, projectTerms);
