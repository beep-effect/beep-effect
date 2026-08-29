/**
 * Closed edge-predicate domain for the practice knowledge graph.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $LawPracticeDomainId.create("values/KgEdgePredicate");

/**
 * Predicates admitted to deterministic practice knowledge-graph edges.
 *
 * **Gotchas**
 *
 * The set is closed: an edge whose predicate is absent here cannot be projected,
 * which is what keeps the graph spine reconcilable against the corpus catalog.
 *
 * **Example** (Decode and guard predicates)
 *
 * ```ts
 * import { KgEdgePredicate } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * const predicate = S.decodeUnknownSync(KgEdgePredicate)("has_docket_family")
 * console.log(predicate) // "has_docket_family"
 * console.log(KgEdgePredicate.is.granted_as("granted_as")) // true
 * console.log(KgEdgePredicate.is.granted_as("cited_by")) // false
 * console.log(KgEdgePredicate.Enum.continuation_of) // "continuation_of"
 * ```
 *
 * @see {@link KgNodeKind} for the node kinds these predicates connect.
 * @category schemas
 * @since 0.0.0
 */
export const KgEdgePredicate = LiteralKit([
  "has_docket_family",
  "has_docket",
  "files_as",
  "granted_as",
  "has_document",
  "family_document",
  "archived_in",
  "continuation_of",
  "enriched_family",
]).pipe(
  $I.annoteSchema("KgEdgePredicate", {
    description: "Closed predicate domain for practice knowledge-graph projections.",
  })
);

/**
 * Runtime type for {@link KgEdgePredicate}.
 *
 * **Example** (Type document edge predicates)
 *
 * ```ts
 * import type { KgEdgePredicate } from "@beep/law-practice-domain/values"
 *
 * const documentEdges: ReadonlyArray<KgEdgePredicate> = ["has_document", "family_document"]
 * const predicate: KgEdgePredicate = "archived_in"
 * console.log(documentEdges.includes(predicate)) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KgEdgePredicate = typeof KgEdgePredicate.Type;
