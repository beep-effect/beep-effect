/**
 * Closed provenance-reference kind domain for practice knowledge-graph rows.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $LawPracticeDomainId.create("values/PracticeKgProvenanceKind");

/**
 * Closed provenance-reference kinds stored on graph projections.
 *
 * @remarks
 * The kind tells a reader how to interpret the accompanying `provenanceRef`: a
 * `catalog-digest` ref is a content digest, a `uspto-anchor` ref is an
 * application number, and so on. Widening this set means teaching every consumer
 * a new ref format.
 *
 * @example
 * ```ts
 * import { PracticeKgProvenanceKind } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * const kind = S.decodeUnknownSync(PracticeKgProvenanceKind)("uspto-anchor")
 * console.log(kind) // "uspto-anchor"
 * console.log(PracticeKgProvenanceKind.Enum["extract-operation"]) // "extract-operation"
 * ```
 *
 * @see {@link PracticeKgEpistemicStatus} for the authority label carried beside this kind.
 *
 * @category schemas
 * @since 0.0.0
 */
export const PracticeKgProvenanceKind = LiteralKit([
  "catalog-digest",
  "uspto-anchor",
  "organize-row",
  "extract-operation",
]).pipe(
  $I.annoteSchema("PracticeKgProvenanceKind", {
    description: "Stable source-reference kinds accepted by the practice knowledge graph.",
  })
);

/**
 * Runtime type for {@link PracticeKgProvenanceKind}.
 *
 * @example
 * ```ts
 * import type { PracticeKgProvenanceKind } from "@beep/law-practice-domain/values"
 *
 * const refLabel = (kind: PracticeKgProvenanceKind): string =>
 *   kind === "uspto-anchor" ? "application number" : "corpus reference"
 *
 * console.log(refLabel("uspto-anchor")) // "application number"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type PracticeKgProvenanceKind = typeof PracticeKgProvenanceKind.Type;
