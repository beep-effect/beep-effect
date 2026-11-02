/**
 * Citation occurrences with verified runtime evidence and structural receipts.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $LawPracticeDomainId } from "@beep/identity/packages";
import { SourceTextIdentity } from "@beep/provenance/SourceTextIdentity";
import { TextAnchorVerificationReceipt, VerifiedTextAnchor } from "@beep/provenance/VerifiedTextAnchor";
import { Sha256Hex } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { CitationSignal } from "../CitationSignal/index.ts";
import { CitationMentionId } from "./Citation.identity.ts";
import { Citation } from "./Citation.models.ts";

const $I = $LawPracticeDomainId.create("values/Citation/Citation.mention");
const sourceEquivalent = S.toEquivalence(SourceTextIdentity);
const AnchorProof: S.Codec<VerifiedTextAnchor> = VerifiedTextAnchor;

// Named schema-field descriptors retain the public opaque proof type in .d.ts.
// They describe schemas, not an independently maintained data model.
type ComponentFields = { readonly name: typeof S.NonEmptyString; readonly anchor: S.Codec<VerifiedTextAnchor> };
const ComponentFields: ComponentFields = { name: S.NonEmptyString, anchor: AnchorProof };

/**
 * One named, verified raw-source component of a citation occurrence.
 * Names can repeat for compound components. Full-span/pincite anchors may
 * extend beyond the primary token anchor; every anchor must share its source.
 * **Example** (Inspect the proof field)
 * ```ts
 * import { CitationComponentAnchor } from "@beep/law-practice-domain/values"
 * console.log(CitationComponentAnchor.fields.anchor !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationComponentAnchor extends S.Opaque<CitationComponentAnchor, { readonly brand: unique symbol }>()(
  S.Struct(ComponentFields).pipe(
    $I.annoteSchema("CitationComponentAnchor", {
      description: "Named canonical verified raw anchor, without a new coordinate primitive or cleaned-text position.",
    })
  )
) {}

/**
 * Persistable component evidence requiring canonical-source re-verification.
 * **Example** (Inspect receipt composition)
 * ```ts
 * import { CitationComponentReceipt } from "@beep/law-practice-domain/values"
 * console.log(CitationComponentReceipt.fields.anchor !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationComponentReceipt extends S.Opaque<CitationComponentReceipt, { readonly brand: unique symbol }>()(
  S.Struct({ name: S.NonEmptyString, anchor: TextAnchorVerificationReceipt }).pipe(
    $I.annoteSchema("CitationComponentReceipt", {
      description: "Structural component receipt; it is not a runtime source proof.",
    })
  )
) {}

const FootnoteLabel = S.OptionFromNullOr(S.NonEmptyString);
type FootnoteFields = { readonly label: typeof FootnoteLabel; readonly anchor: S.Codec<VerifiedTextAnchor> };
const FootnoteFields: FootnoteFields = { label: FootnoteLabel, anchor: AnchorProof };

/**
 * Verified raw footnote zone asserted by its producer, with an optional label.
 * This schema does not implement or assert a footnote detection algorithm.
 * **Example** (Inspect source evidence)
 * ```ts
 * import { CitationFootnoteZone } from "@beep/law-practice-domain/values"
 * console.log(CitationFootnoteZone.fields.anchor !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationFootnoteZone extends S.Opaque<CitationFootnoteZone, { readonly brand: unique symbol }>()(
  S.Struct(FootnoteFields).pipe(
    $I.annoteSchema("CitationFootnoteZone", {
      description:
        "Producer-asserted footnote zone over canonical verified raw evidence; label precision remains textual.",
    })
  )
) {}

/**
 * Persistable footnote-zone receipt, without runtime verification authority.
 * **Example** (Inspect receipt fields)
 * ```ts
 * import { CitationFootnoteReceipt } from "@beep/law-practice-domain/values"
 * console.log(CitationFootnoteReceipt.fields.label !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationFootnoteReceipt extends S.Opaque<CitationFootnoteReceipt, { readonly brand: unique symbol }>()(
  S.Struct({ label: FootnoteLabel, anchor: TextAnchorVerificationReceipt }).pipe(
    $I.annoteSchema("CitationFootnoteReceipt", {
      description: "Structural footnote-zone receipt requiring canonical source re-verification.",
    })
  )
) {}

/**
 * Typed overlap diagnostic corresponding to the oracle's unknown-overlap event.
 * It names the other occurrence without retaining citation repr/text in logs.
 * Emission and warning-normalization proof remain engine responsibilities.
 * **Example** (Inspect the related occurrence field)
 * ```ts
 * import { CitationOverlapWarning } from "@beep/law-practice-domain/values"
 * console.log(CitationOverlapWarning.fields.previousMentionId !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationOverlapWarning extends S.Opaque<CitationOverlapWarning, { readonly brand: unique symbol }>()(
  S.Struct({ kind: S.tag("unexpected-overlap"), previousMentionId: CitationMentionId }).pipe(
    $I.annoteSchema("CitationOverlapWarning", {
      description: "Case-specific unexpected-overlap diagnostic referring to the previous occurrence by ID.",
    })
  )
) {}

/**
 * Finite occurrence-warning domain; operation/document warnings are separate.
 * **Example** (Use the derived discriminator)
 * ```ts
 * import { CitationMentionWarning } from "@beep/law-practice-domain/values"
 * console.log(CitationMentionWarning.tag) // "kind"
 * ```
 * @category models
 * @since 0.0.0
 */
export const CitationMentionWarning = S.Union([CitationOverlapWarning]).pipe(
  S.toTaggedUnion("kind"),
  $I.annoteSchema("CitationMentionWarning", {
    description: "Typed occurrence warning payloads; no generic message, context or raw citation bag.",
  })
);
/**
 * Schema-derived occurrence warning.
 * @category models
 * @since 0.0.0
 */
export type CitationMentionWarning = typeof CitationMentionWarning.Type;

const MetadataFields = {
  id: CitationMentionId,
  citation: Citation,
  engineArtifact: Sha256Hex,
  signal: S.OptionFromNullOr(CitationSignal),
  warnings: S.Array(CitationMentionWarning),
  evidenceConfidence: S.OptionFromNullOr(UnitInterval),
};
const Components = S.Array(CitationComponentAnchor);
const Footnote = S.OptionFromNullOr(CitationFootnoteZone);
type EvidenceFields = {
  readonly anchor: S.Codec<VerifiedTextAnchor>;
  readonly components: typeof Components;
  readonly footnote: typeof Footnote;
};
const EvidenceFields: EvidenceFields = { anchor: AnchorProof, components: Components, footnote: Footnote };
const MentionShape = S.Struct({ ...MetadataFields, ...EvidenceFields });

/**
 * Semantic citation composed with genuine verified occurrence evidence.
 *
 * **Details**
 *
 * The primary anchor is the citation token span. Extended/full/pincite spans
 * use named components; exact matched text is derived from anchor.anchor.quote.
 * Group membership and resolution pointers belong to CitationDocument.
 * This is a runtime proof-bearing value. Persist its receipt through the
 * server projector; decoding structural receipts cannot issue anchor proofs.
 * The server producer computes/checks the ID; this schema validates its format.
 *
 * **Example** (Inspect semantic/evidence composition)
 * ```ts
 * import { CitationMention } from "@beep/law-practice-domain/values"
 * console.log(CitationMention.fields.citation !== undefined) // true
 * console.log(CitationMention.fields.anchor !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationMention extends S.Opaque<CitationMention, { readonly brand: unique symbol }>()(
  MentionShape.check(
    S.makeFilter(
      (mention) => {
        const source = mention.anchor.source;
        const primary = mention.anchor.anchor;
        const zone = mention.footnote;
        return (
          A.every(mention.components, (component) => sourceEquivalent(source, component.anchor.source)) &&
          (O.isNone(zone) ||
            (sourceEquivalent(source, zone.value.anchor.source) &&
              zone.value.anchor.anchor.startChar <= primary.startChar &&
              zone.value.anchor.anchor.endChar >= primary.endChar))
        );
      },
      $I.annote("MentionEvidenceCoherence", {
        title: "Mention Evidence Coherence",
        description:
          "Every component/zone uses the primary source identity; a footnote zone contains the primary anchor.",
        message: "Citation occurrence evidence is incoherent.",
      })
    )
  ).pipe(
    $I.annoteSchema("CitationMention", {
      description:
        "Canonical semantic citation and verified raw occurrence evidence, with optional producer assertions and no document group duplication.",
    })
  )
) {}

const ReceiptShape = S.Struct({
  schemaVersion: S.tag("citation-mention-receipt/v1"),
  ...MetadataFields,
  anchor: TextAnchorVerificationReceipt,
  components: S.Array(CitationComponentReceipt),
  footnote: S.OptionFromNullOr(CitationFootnoteReceipt),
});

/**
 * Persistable mention data requiring authorized raw-source re-verification.
 *
 * **Details**
 *
 * This codec preserves data; it does not authenticate classification, issue
 * runtime proofs or validate that an engine artifact is installed. Restoration
 * must verify every anchor and recompute the occurrence ID against the expected
 * engine/source before returning CitationMention.
 *
 * **Example** (Inspect the structural boundary)
 * ```ts
 * import { CitationMentionReceipt } from "@beep/law-practice-domain/values"
 * console.log(CitationMentionReceipt.fields.schemaVersion !== undefined) // true
 * ```
 * @category models
 * @since 0.0.0
 */
export class CitationMentionReceipt extends S.Opaque<CitationMentionReceipt, { readonly brand: unique symbol }>()(
  ReceiptShape.check(
    S.makeFilter(
      (mention) => {
        const source = mention.anchor.source;
        const primary = mention.anchor.anchor;
        const zone = mention.footnote;
        return (
          A.every(mention.components, (component) => sourceEquivalent(source, component.anchor.source)) &&
          (O.isNone(zone) ||
            (sourceEquivalent(source, zone.value.anchor.source) &&
              zone.value.anchor.anchor.startChar <= primary.startChar &&
              zone.value.anchor.anchor.endChar >= primary.endChar))
        );
      },
      $I.annote("MentionReceiptCoherence", {
        title: "Mention Receipt Coherence",
        description:
          "Structural receipt anchors share one source identity and a footnote zone contains the primary anchor.",
        message: "Citation receipt evidence is incoherent.",
      })
    )
  ).pipe(
    $I.annoteSchema("CitationMentionReceipt", {
      description:
        "Versioned structural persistence boundary for citation occurrence evidence; canonical-source restoration is mandatory.",
    })
  )
) {}
