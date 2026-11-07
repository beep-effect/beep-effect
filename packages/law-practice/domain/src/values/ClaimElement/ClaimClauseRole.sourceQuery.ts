/**
 * Bounded source-local queries shared only by this value object's compiler and validator.
 * @packageDocumentation
 * @since 0.0.0
 */

import * as A from "effect/Array";
import { dual } from "effect/Function";
import * as O from "effect/Option";
import type { TextAnchor } from "@beep/provenance/TextAnchor";
import type {
  ClaimFiniteSourceProof,
  ClaimFrameArgument,
  ClaimPlannedElement,
  ClaimSourceFrame,
} from "./ClaimClauseRole.model.ts";

/**
 * Find the first positively source-ordered value whose start reaches a UTF-16 boundary.
 * The caller supplies a static accessor and proves ordering; this function does not infer containment.
 * **Example** (Use the source control)
 * ```ts
 * import { sourceLowerBound } from "../../src/values/ClaimElement/ClaimClauseRole.sourceQuery.ts"
 * console.log(sourceLowerBound([1, 1, 3], 2, (value) => value, () => true)) // 2
 * ```
 * @category parsing
 * @since 0.0.0
 */
const sourceLowerBoundBody = <Value>(
  values: ReadonlyArray<Value>,
  startChar: number,
  startOf: (value: Value) => number,
  charge: (amount: number) => boolean
): number => {
  let lower = 0;
  let upper = values.length;
  while (lower < upper) {
    if (!charge(2)) return -1;
    const middle = Math.floor((lower + upper) / 2);
    if (startOf(O.getOrThrow(A.get(values, middle))) < startChar) lower = middle + 1;
    else upper = middle;
  }
  return lower;
};
const sameSourceAnchor = (a: TextAnchor, b: TextAnchor): boolean =>
  a.startChar === b.startChar && a.endChar === b.endChar && a.quote === b.quote;
const selectionArgumentOwned = (
  argument: ClaimFrameArgument,
  core: TextAnchor,
  owner: O.Option<ClaimFiniteSourceProof>
): boolean =>
  argument.role === "selection-value" &&
  sameSourceAnchor(argument.nominal, core) &&
  O.isNone(argument.predicate) &&
  O.match(owner, {
    onNone: () => O.isNone(argument.ownerNominal),
    onSome: (proof) =>
      proof.kind === "head" && O.exists(argument.ownerNominal, (anchor) => sameSourceAnchor(anchor, proof.core)),
  });
/**
 * Test the existing positive owned-core and selection-argument joins, before any ancestor choice.
 * This neither creates an attachment nor chooses a nearby frame.
 * **Example** (Use the source control)
 * ```ts
 * import { sourceSelectionFrameMember } from "../../src/values/ClaimElement/ClaimClauseRole.sourceQuery.ts"
 * console.log(typeof sourceSelectionFrameMember) // function
 * ```
 * @category validation
 * @since 0.0.0
 */
const sourceSelectionFrameMemberBody = (
  frame: ClaimSourceFrame,
  element: O.Option<ClaimPlannedElement>,
  core: TextAnchor,
  owner: O.Option<ClaimFiniteSourceProof>,
  charge: (amount: number) => boolean
): boolean => {
  if (
    !charge(
      frame.nominals.length +
        frame.arguments.length +
        O.getOrElse(
          O.map(element, (value) => value.ownedTermRegions.length),
          () => 0
        ) +
        4
    )
  )
    return false;
  return (
    frame.extent.startChar <= core.startChar &&
    core.endChar <= frame.extent.endChar &&
    A.some(frame.nominals, (nominal) => sameSourceAnchor(nominal, core)) &&
    O.exists(element, (value) => A.some(value.ownedTermRegions, (region) => sameSourceAnchor(region.extent, core))) &&
    A.some(frame.arguments, (argument) => selectionArgumentOwned(argument, core, owner))
  );
};

/**
 * Source-ordered lower-bound query with the original per-step work debit.
 * **Example** (Use the source control)
 * ```ts
 * import { sourceLowerBound } from "../../src/values/ClaimElement/ClaimClauseRole.sourceQuery.ts"
 * console.log(sourceLowerBound([1, 1, 3], 2, (value) => value, () => true)) // 2
 * ```
 * @category parsing
 * @since 0.0.0
 */
export const sourceLowerBound: {
  <Value>(
    startChar: number,
    startOf: (value: Value) => number,
    charge: (amount: number) => boolean
  ): (values: ReadonlyArray<Value>) => number;
  <Value>(
    values: ReadonlyArray<Value>,
    startChar: number,
    startOf: (value: Value) => number,
    charge: (amount: number) => boolean
  ): number;
} = dual(4, sourceLowerBoundBody);
/**
 * Existing positive frame membership through owned source core and selection arguments.
 * **Example** (Use the source control)
 * ```ts
 * import { sourceSelectionFrameMember } from "../../src/values/ClaimElement/ClaimClauseRole.sourceQuery.ts"
 * console.log(typeof sourceSelectionFrameMember) // function
 * ```
 * @category validation
 * @since 0.0.0
 */
export const sourceSelectionFrameMember: {
  (
    element: O.Option<ClaimPlannedElement>,
    core: TextAnchor,
    owner: O.Option<ClaimFiniteSourceProof>,
    charge: (amount: number) => boolean
  ): (frame: ClaimSourceFrame) => boolean;
  (
    frame: ClaimSourceFrame,
    element: O.Option<ClaimPlannedElement>,
    core: TextAnchor,
    owner: O.Option<ClaimFiniteSourceProof>,
    charge: (amount: number) => boolean
  ): boolean;
} = dual(5, sourceSelectionFrameMemberBody);
