/**
 * Canonical journal semantics adapted from eyecite 2.7.6, BSD-2-Clause.
 * See THIRD_PARTY_NOTICES.md.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { CitationComponents, CitationDatedMetadata, CitationPublication } from "./Citation.resource.ts";

const $I = $LawPracticeDomainId.create("values/Citation/Citation.journal");

/**
 * Full journal authority semantics without occurrence or execution state.
 * **Example** (Inspect legal components)
 * ```ts
 * import { FullJournalCitation } from "@beep/law-practice-domain/values"
 * console.log(FullJournalCitation.fields.components !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class FullJournalCitation extends S.Opaque<FullJournalCitation, { readonly brand: unique symbol }>()(
  S.Struct({
    type: S.tag("journal"),
    components: CitationComponents,
    publication: CitationPublication,
    metadata: CitationDatedMetadata,
  }).pipe(
    $I.annoteSchema("FullJournalCitation", {
      description:
        "Canonical journal authority identified by legal components and immutable publication editions, with textual locator/date metadata.",
    })
  )
) {}
