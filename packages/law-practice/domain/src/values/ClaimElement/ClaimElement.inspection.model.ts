/**
 * Explicit per-record structural inspection outcomes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";
import { ClaimDecompositionError } from "./ClaimElement.errors.ts";
import { ClaimInputQualification } from "./ClaimElement.input.model.ts";
import { ClaimElementTree } from "./ClaimElement.tree.model.ts";

const $I = $LawPracticeDomainId.create("values/ClaimElement/ClaimElement.inspection.model");
const outcomeKind = LiteralKit(["decomposed", "decomposition-failed", "unchecked"]).pipe(
  $I.annoteSchema("ClaimInputDecompositionKind", {
    description:
      "A context-ready record produced a tree, failed decomposition, or remained unchecked for explicit input/context reasons.",
  })
);

/**
 * Structural inspection of one original source record, retaining all unknowns.
 *
 * **Details**
 * A tree does not mean that substantive antecedent checks succeeded. An
 * unchecked record preserves its extraction, normalization or ancestry reason.
 *
 * **Example** (Recognize unchecked input)
 *
 * ```ts
 * import { ClaimInputDecomposition } from "@beep/law-practice-domain/values/ClaimElement"
 * console.log(ClaimInputDecomposition.guards.unchecked({})) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ClaimInputDecomposition = outcomeKind
  .toTaggedUnion("status")({
    decomposed: { qualification: ClaimInputQualification.cases["context-ready"], tree: ClaimElementTree },
    "decomposition-failed": {
      qualification: ClaimInputQualification.cases["context-ready"],
      cause: ClaimDecompositionError,
    },
    unchecked: {
      qualification: S.Union([
        ClaimInputQualification.cases["context-unavailable"],
        ClaimInputQualification.cases["extraction-failed"],
        ClaimInputQualification.cases["normalization-failed"],
      ]),
    },
  })
  .pipe(
    $I.annoteSchema("ClaimInputDecomposition", {
      description:
        "One result per original record; valid independent siblings can decompose without pretending a sparse set is PatentClaims.",
    })
  );

/**
 * Runtime per-record structural inspection type.
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClaimInputDecomposition = typeof ClaimInputDecomposition.Type;
