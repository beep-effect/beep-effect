/**
 * Exclusive nominal projection from an admitted complete element plan.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import { clauseNominalHead } from "./ClaimClauseRole.behavior.ts";
import type { ClaimPlannedElement } from "./ClaimClauseRole.model.ts";
import type { ClaimTerm } from "./ClaimElement.model.ts";

const projectTerms = (
  element: ClaimPlannedElement,
  charge: (amount: number) => boolean
): O.Option<ReadonlyArray<typeof ClaimTerm.Encoded>> => {
  if (!charge(element.nominals.length + element.lexicalHeader.quote.length + 1)) return O.none();
  let end = element.lexicalHeader.startChar;
  for (const nominal of element.nominals) {
    const span = nominal.anchor;
    if (
      span.startChar < end ||
      span.endChar > element.lexicalHeader.endChar ||
      nominal.head.startChar < span.startChar ||
      nominal.head.endChar > span.endChar
    )
      return O.none();
    end = span.endChar;
  }
  return O.some(
    A.map(element.nominals, (nominal) => ({
      anchor: nominal.anchor,
      determiner: nominal.determiner,
      head: clauseNominalHead(nominal),
    }))
  );
};

/**
 * Project all owned terms atomically; no per-term legacy fallback is permitted.
 *
 * @category parsing
 * @since 0.0.0
 */
export const projectClaimRoleTerms: {
  (
    charge: (amount: number) => boolean
  ): (element: ClaimPlannedElement) => O.Option<ReadonlyArray<typeof ClaimTerm.Encoded>>;
  (
    element: ClaimPlannedElement,
    charge: (amount: number) => boolean
  ): O.Option<ReadonlyArray<typeof ClaimTerm.Encoded>>;
} = dual(2, projectTerms);
