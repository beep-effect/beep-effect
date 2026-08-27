/**
 * Frozen lab-local ontology for the LeJeune lunch bundle.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LejeuneBoltWorkbenchId } from "@beep/identity/packages";
import { LiteralKit, PosInt, SchemaUtils } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $LejeuneBoltWorkbenchId.create("domain/Ontology");

/** Stable kebab-case identity for one lab-local ontology instance. @category identifiers @since 0.0.0 */
export const EntityId = S.NonEmptyString.check(
  S.isPattern(/^[a-z][a-z0-9-]*$/u, {
    identifier: $I`EntityIdPatternCheck`,
    title: "LeJeune Entity Identifier",
    description: "Checks the stable lowercase kebab-case identifiers used inside the demo bundle.",
    message: "Expected a lowercase kebab-case LeJeune entity identifier.",
  })
).pipe(
  S.brand("LeJeuneEntityId"),
  $I.annoteSchema("EntityId", {
    description: "Stable lowercase kebab-case identifier for one lab-local ontology instance.",
  })
);

/** Fixed ISO calendar date used by the deterministic bundle. @category schemas @since 0.0.0 */
export const IsoDate = S.String.check(
  S.isPattern(/^\d{4}-\d{2}-\d{2}$/u, {
    identifier: $I`IsoDatePatternCheck`,
    title: "ISO Calendar Date",
    description: "Checks the YYYY-MM-DD date representation frozen by the demo bundle.",
    message: "Expected a YYYY-MM-DD calendar date.",
  })
).pipe(
  S.brand("LeJeuneIsoDate"),
  $I.annoteSchema("IsoDate", {
    description: "Calendar date encoded as YYYY-MM-DD.",
  })
);

/** Fixed millisecond-precision UTC timestamp used by synthetic records. @category schemas @since 0.0.0 */
export const IsoTimestamp = S.String.check(
  S.isPattern(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u, {
    identifier: $I`IsoTimestampPatternCheck`,
    title: "ISO UTC Timestamp",
    description: "Checks the millisecond-precision UTC timestamps frozen by the demo bundle.",
    message: "Expected a millisecond-precision UTC timestamp ending in Z.",
  })
).pipe(
  S.brand("LeJeuneIsoTimestamp"),
  $I.annoteSchema("IsoTimestamp", {
    description: "Millisecond-precision UTC timestamp used by synthetic and review records.",
  })
);

/**
 * Exact top-level ontology class vocabulary authorized for the lunch bundle.
 *
 * **Example** (Inspect the frozen class count)
 *
 * ```ts
 * import { OntologyClassName } from "@/domain/Ontology"
 *
 * console.log(OntologyClassName.Options.length) // 12
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const OntologyClassName = LiteralKit([
  "ProductVariant",
  "Component",
  "Standard",
  "Finish",
  "Tool",
  "SupplierOffer",
  "Project",
  "RFQ",
  "QuoteLine",
  "LotCertificate",
  "Approval",
  "ExpertClaim",
]).pipe(
  $I.annoteSchema("OntologyClassName", {
    description: "The complete and closed twelve-class ontology for the fixed LeJeune lunch scenario.",
  })
);

/**
 * A quoteable fastener variant assembled from standard, finish, and component identities.
 *
 * **Example** (Inspect the identifier field)
 *
 * ```ts
 * import { ProductVariant } from "@/domain/Ontology"
 *
 * console.log(ProductVariant.fields.id !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProductVariant extends S.Class<ProductVariant>($I`ProductVariant`)(
  {
    componentIds: S.NonEmptyArray(EntityId),
    finishId: EntityId,
    id: EntityId,
    label: S.NonEmptyString,
    standardId: EntityId,
  },
  $I.annote("ProductVariant", {
    description: "A fixed-story fastener variant linked to its standard, finish, and assembly components.",
  })
) {}

/**
 * One physical member of a quoted fastener assembly.
 *
 * **Example** (Inspect the component kind field)
 *
 * ```ts
 * import { Component } from "@/domain/Ontology"
 *
 * console.log(Component.fields.kind !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Component extends S.Class<Component>($I`Component`)(
  {
    finishId: EntityId.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
    id: EntityId,
    kind: LiteralKit(["bolt", "nut", "washer", "dti"]),
    label: S.NonEmptyString,
    standardId: EntityId,
    strengthClass: S.NonEmptyString,
  },
  $I.annote("Component", {
    description: "A bolt, nut, washer, or DTI participating in one fixed-story assembly.",
  })
) {}

/**
 * A cited technical standard or public technical authority.
 *
 * **Example** (Inspect the source URL field)
 *
 * ```ts
 * import { Standard } from "@/domain/Ontology"
 *
 * console.log(Standard.fields.sourceUrl !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Standard extends S.Class<Standard>($I`Standard`)(
  {
    accessedOn: IsoDate,
    designation: S.NonEmptyString,
    id: EntityId,
    revision: S.NonEmptyString,
    sourceUrl: S.NonEmptyString,
  },
  $I.annote("Standard", {
    description: "A technical designation with an explicit revision or access date and an opening URL.",
  })
) {}

/**
 * A named finish used by the fixed fastener story.
 *
 * **Example** (Inspect the coating field)
 *
 * ```ts
 * import { Finish } from "@/domain/Ontology"
 *
 * console.log(Finish.fields.coatingSpecification !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Finish extends S.Class<Finish>($I`Finish`)(
  {
    coatingSpecification: S.NonEmptyString,
    id: EntityId,
    label: S.NonEmptyString,
  },
  $I.annote("Finish", {
    description: "A lab-scoped coating or plain-finish designation used by the two RFQ fixtures.",
  })
) {}

/**
 * A named installation or verification tool associated with a quote line.
 *
 * **Example** (Inspect the operation field)
 *
 * ```ts
 * import { Tool } from "@/domain/Ontology"
 *
 * console.log(Tool.fields.operation !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Tool extends S.Class<Tool>($I`Tool`)(
  {
    id: EntityId,
    label: S.NonEmptyString,
    operation: S.NonEmptyString,
  },
  $I.annote("Tool", {
    description: "A fixed-story installation or verification tool referenced without supplier authority.",
  })
) {}

/**
 * A timestamped and visibly synthetic supplier offer.
 *
 * **Example** (Inspect the structural label)
 *
 * ```ts
 * import { SupplierOffer } from "@/domain/Ontology"
 *
 * console.log(SupplierOffer.fields.recordLabel !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SupplierOffer extends S.Class<SupplierOffer>($I`SupplierOffer`)(
  {
    availableQuantity: PosInt,
    expiresAt: IsoTimestamp,
    id: EntityId,
    observedAt: IsoTimestamp,
    productVariantId: EntityId,
    recordLabel: S.tag("SYNTHETIC"),
    supplier: S.NonEmptyString,
    unitPriceCents: PosInt,
  },
  $I.annote("SupplierOffer", {
    description: "A dated synthetic offer that cannot be mistaken for current supplier price or availability.",
  })
) {}

/**
 * The synthetic project receiving one RFQ fixture.
 *
 * **Example** (Inspect the delivery date field)
 *
 * ```ts
 * import { Project } from "@/domain/Ontology"
 *
 * console.log(Project.fields.deliveryDate !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Project extends S.Class<Project>($I`Project`)(
  {
    deliveryDate: IsoDate,
    id: EntityId,
    name: S.NonEmptyString,
  },
  $I.annote("Project", {
    description: "A synthetic project identity and delivery date used by a fixed RFQ pair.",
  })
) {}

/**
 * One normalized request for quote with explicit source and missing-field identities.
 *
 * **Example** (Inspect the missing-fields field)
 *
 * ```ts
 * import { RFQ } from "@/domain/Ontology"
 *
 * console.log(RFQ.fields.missingFields !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RFQ extends S.Class<RFQ>($I`RFQ`)(
  {
    id: EntityId,
    missingFields: S.NonEmptyArray(S.NonEmptyString),
    projectId: EntityId,
    quoteLineIds: S.NonEmptyArray(EntityId),
    sourceDocumentIds: S.NonEmptyArray(EntityId),
  },
  $I.annote("RFQ", {
    description: "A fixed-layout RFQ that preserves every required value the sources did not provide.",
  })
) {}

/**
 * A normalized requested line linked to one product variant.
 *
 * **Example** (Inspect the quantity field)
 *
 * ```ts
 * import { QuoteLine } from "@/domain/Ontology"
 *
 * console.log(QuoteLine.fields.quantity !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class QuoteLine extends S.Class<QuoteLine>($I`QuoteLine`)(
  {
    id: EntityId,
    productVariantId: EntityId,
    quantity: PosInt,
    rfqId: EntityId,
  },
  $I.annote("QuoteLine", {
    description: "A normalized quantity request linked to its RFQ and fixed product variant.",
  })
) {}

/**
 * A timestamped and visibly synthetic lot-certificate record.
 *
 * **Example** (Inspect the structural label)
 *
 * ```ts
 * import { LotCertificate } from "@/domain/Ontology"
 *
 * console.log(LotCertificate.fields.recordLabel !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class LotCertificate extends S.Class<LotCertificate>($I`LotCertificate`)(
  {
    id: EntityId,
    issuedAt: IsoTimestamp,
    lotId: EntityId,
    recordLabel: S.tag("SYNTHETIC"),
    standardId: EntityId,
  },
  $I.annote("LotCertificate", {
    description: "A dated synthetic certificate pointer with no copied mill or third-party payload.",
  })
) {}

/**
 * A local approve, edit, or reject record that grants no external authority.
 *
 * **Example** (Inspect the decision field)
 *
 * ```ts
 * import { Approval } from "@/domain/Ontology"
 *
 * console.log(Approval.fields.decision !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Approval extends S.Class<Approval>($I`Approval`)(
  {
    decision: LiteralKit(["approve", "edit", "reject"]),
    id: EntityId,
    recordedAt: IsoTimestamp,
    reviewer: S.NonEmptyString,
    subjectId: EntityId,
  },
  $I.annote("Approval", {
    description: "A lab-local review record that never represents a quote send, substitution, or order.",
  })
) {}

/**
 * A reviewed, time-bound expert claim with a source and explicit status.
 *
 * **Example** (Inspect the review-status field)
 *
 * ```ts
 * import { ExpertClaim } from "@/domain/Ontology"
 *
 * console.log(ExpertClaim.fields.reviewStatus !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExpertClaim extends S.Class<ExpertClaim>($I`ExpertClaim`)(
  {
    id: EntityId,
    reviewStatus: LiteralKit(["candidate", "approved", "superseded"]),
    sourceUrl: S.NonEmptyString,
    statement: S.NonEmptyString,
    validFrom: IsoDate,
  },
  $I.annote("ExpertClaim", {
    description: "A cited and review-gated veteran claim limited to the fixed demo story.",
  })
) {}
