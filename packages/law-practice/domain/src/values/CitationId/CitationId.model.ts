/**
 * Citation-identity value object: a stable, opaque per-result-set token for
 * referencing a parsed citation by id rather than by fragile array position.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $LawPracticeDomainId.create("values/CitationId/CitationId.model");

/**
 * Stable identity for a citation within one `extractCitations()` result set.
 * Survives consumer filter/sort/map of the returned array, so aggregates
 * (history chains, parallel groups, short-form references) reference members by
 * id rather than by fragile positional array index.
 *
 * NOT durable across runs — the same logical citation re-extracts to a fresh id
 * each call. Opaque token (currently 'c0', 'c1', ...): compare it, key a
 * Map/Set with it, store it as a reference — but never parse it or derive it
 * from array position.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { CitationId } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const id = S.decodeUnknownSync(CitationId)("c0")
 * console.log(id) // "c0"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CitationId = S.String.pipe(
  S.brand("CitationId"),
  $I.annoteSchema("CitationId", {
    description:
      "Stable opaque identity for a citation within one extractCitations() result set; compared, keyed, or stored, but never parsed or derived from array position.",
  })
);

/**
 * The decoded brand type for {@link CitationId} — an opaque `string` tagged with
 * the `CitationId` brand so it cannot be confused with an unbranded string.
 *
 * **Example**
 *
 * @example
 * ```ts
 * import { CitationId } from "@beep/law-practice-domain"
 * import * as S from "effect/Schema"
 *
 * const id: CitationId = S.decodeUnknownSync(CitationId)("c1")
 * console.log(id) // "c1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type CitationId = typeof CitationId.Type;
