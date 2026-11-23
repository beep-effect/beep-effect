/**
 * Source positions with independent reported extraction observations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $EpistemicsId } from "@beep/identity/packages";
import { makeSignal } from "@beep/schema/Signal";
import { TextAnchor } from "@beep/text/TextAnchor";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { ReportedConfidence } from "./Confidence.ts";

const $I = $EpistemicsId.create("EvidencePosition.schema");

/**
 * An extraction observation that preserves the reason for missing measurements.
 *
 * **Example** (Keep an unassessed extraction absent)
 *
 * ```ts
 * import { ExtractorConfidence } from "@beep/epistemics/EvidencePosition.schema"
 * const signal = ExtractorConfidence.cases.Absent.make({ reason: "not-assessed" })
 * console.log(signal._tag)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExtractorConfidence = makeSignal(ReportedConfidence).pipe(
  $I.annoteSchema("ExtractorConfidence", {
    description: "Reported extraction confidence or an explicit absence reason.",
  })
);

/**
 * Decoded extraction observation.
 *
 * @category models
 * @since 0.0.0
 */
export type ExtractorConfidence = typeof ExtractorConfidence.Type;

/**
 * A current evidence position whose extraction observation cannot alter its anchor.
 *
 * **Example** (Represent source evidence without a model score)
 *
 * ```ts
 * import { EvidencePosition, ExtractorConfidence } from "@beep/epistemics/EvidencePosition.schema"
 * import { TextAnchor } from "@beep/text/TextAnchor"
 * import * as S from "effect/Schema"
 * const position = EvidencePosition.make({
 *   position: TextAnchor.make({ startChar: S.Natural.make(0), endChar: S.Natural.make(4), quote: "fact" }),
 *   extractorConfidence: ExtractorConfidence.cases.Absent.make({ reason: "not-assessed" })
 * })
 * console.log(position.version)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class EvidencePosition extends S.Opaque<EvidencePosition, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("evidence-position/v2"),
    position: TextAnchor.check(
      S.makeFilter(
        (anchor) => Str.length(anchor.quote) <= 65_536,
        $I.annote("EvidenceQuoteBound", {
          title: "Evidence quote bound",
          description: "An evidence quote fits within one 65,536-code-unit page.",
          message: "Expected at most 65,536 UTF-16 code units.",
        })
      )
    ),
    extractorConfidence: ExtractorConfidence,
  }).pipe(
    $I.annoteSchema("EvidencePosition", {
      description: "Versioned text anchor and independent extraction observation.",
    })
  )
) {}
