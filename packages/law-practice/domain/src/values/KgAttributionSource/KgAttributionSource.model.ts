/**
 * Closed attribution-source domain for practice knowledge-graph node rows.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LawPracticeDomainId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";

const $I = $LawPracticeDomainId.create("values/KgAttributionSource");

/**
 * How a node earned its family, docket, or client attribution.
 *
 * **Details**
 *
 * The label answers "why is this row in this family" independently of the
 * provenance ref, which only says where the row's bytes came from:
 *
 * - `filename` — docket parsed from the catalogued file name or path.
 * - `restored-name` — docket parsed from a recycle-bin restoration record's
 *   original name, so the file name itself was a `$R` stub.
 * - `text-reference` — client prefix read from a `<client>.<docket>` reference
 *   in the document's own extracted text.
 * - `family-consensus` — client inherited because every attributed document of
 *   the bare family names the same client.
 * - `client-map` — client supplied by the organizer's source-label map.
 * - `official-record` — identity carried by a USPTO record (application, patent,
 *   parent chain).
 * - `mention` — the only link is a number mentioned in family documents; never a
 *   membership claim.
 *
 * **Example** (Decode attribution source label)
 *
 * ```ts
 * import { KgAttributionSource } from "@beep/law-practice-domain/values"
 * import * as S from "effect/Schema"
 *
 * const source = S.decodeUnknownSync(KgAttributionSource)("text-reference")
 * console.log(source) // "text-reference"
 * console.log(KgAttributionSource.is.mention("mention")) // true
 * console.log(KgAttributionSource.Enum["family-consensus"]) // "family-consensus"
 * ```
 *
 * @see {@link PracticeKgEpistemicStatus} for the authority label carried beside this source.
 * @category schemas
 * @since 0.0.0
 */
export const KgAttributionSource = LiteralKit([
  "filename",
  "restored-name",
  "text-reference",
  "family-consensus",
  "client-map",
  "official-record",
  "mention",
]).pipe(
  $I.annoteSchema("KgAttributionSource", {
    description: "Closed attribution-source domain explaining why a graph node sits where it sits.",
  })
);

/**
 * Runtime type for {@link KgAttributionSource}.
 *
 * **Example** (Type evidence-backed sources)
 *
 * ```ts
 * import type { KgAttributionSource } from "@beep/law-practice-domain/values"
 *
 * const evidenceBacked: ReadonlyArray<KgAttributionSource> = ["text-reference", "official-record"]
 * const source: KgAttributionSource = "mention"
 * console.log(evidenceBacked.includes(source)) // false
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type KgAttributionSource = typeof KgAttributionSource.Type;
