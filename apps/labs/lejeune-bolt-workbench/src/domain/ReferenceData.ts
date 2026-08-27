/**
 * Fixed cited standards and visibly synthetic commercial records for the demo bundle.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $LejeuneBoltWorkbenchId } from "@beep/identity/packages";
import { PosInt } from "@beep/schema";
import * as S from "effect/Schema";
import {
  EntityId,
  Finish,
  IsoDate,
  IsoTimestamp,
  LotCertificate,
  Standard,
  SupplierOffer,
  Tool,
} from "@/domain/Ontology";
import type { NormalizedFixture } from "@/domain/Bundle";

const $I = $LejeuneBoltWorkbenchId.create("domain/ReferenceData");
const entityId = EntityId.make;
const isoDate = IsoDate.make;
const isoTimestamp = IsoTimestamp.make;

/**
 * The fixed standards, finishes, tools, offers, and lot certificates used by replay.
 *
 * **Example** (Inspect the synthetic offers collection)
 *
 * ```ts
 * import { ReferenceData } from "@/domain/ReferenceData"
 *
 * console.log(ReferenceData.fields.offers !== undefined) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
class ReferenceData extends S.Class<ReferenceData>($I`ReferenceData`)(
  {
    certificates: S.NonEmptyArray(LotCertificate),
    finishes: S.NonEmptyArray(Finish),
    offers: S.NonEmptyArray(SupplierOffer),
    standards: S.NonEmptyArray(Standard),
    tools: S.NonEmptyArray(Tool),
  },
  $I.annote("ReferenceData", {
    description: "The immutable cited and synthetic support records required by the fixed replay bundle.",
  })
) {}

/**
 * Build fixed support records for the two normalized product variants.
 *
 * **Example** (Inspect the constructor)
 *
 * ```ts
 * import { buildReferenceData } from "@/domain/ReferenceData"
 *
 * console.log(typeof buildReferenceData === "function") // true
 * ```
 *
 * @category fixtures
 * @since 0.0.0
 */
export const buildReferenceData = (fixtures: readonly [NormalizedFixture, NormalizedFixture]): ReferenceData => {
  const [rfqA, rfqB] = fixtures;
  return ReferenceData.make({
    certificates: [
      LotCertificate.make({
        id: entityId("synthetic-cert-rfq-a"),
        issuedAt: isoTimestamp("2026-08-27T12:00:00.000Z"),
        lotId: entityId("synthetic-lot-rfq-a"),
        standardId: entityId("astm-f1852-type-1"),
      }),
      LotCertificate.make({
        id: entityId("synthetic-cert-rfq-b"),
        issuedAt: isoTimestamp("2026-08-27T12:05:00.000Z"),
        lotId: entityId("synthetic-lot-rfq-b"),
        standardId: entityId("astm-a490-type-1"),
      }),
    ],
    finishes: [
      Finish.make({
        coatingSpecification: "ASTM B695 Class 55 mechanical zinc coating",
        id: entityId("mechanical-galvanized-b695-class-55"),
        label: "MG B695 Class 55",
      }),
      Finish.make({
        coatingSpecification: "Hot-dip galvanized; deliberately incompatible with A490 in the refusal fixture",
        id: entityId("hot-dip-galvanized"),
        label: "HDG",
      }),
    ],
    offers: [
      SupplierOffer.make({
        availableQuantity: PosInt.make(240),
        expiresAt: isoTimestamp("2026-08-28T17:00:00.000Z"),
        id: entityId("synthetic-offer-rfq-a"),
        observedAt: isoTimestamp("2026-08-27T11:30:00.000Z"),
        productVariantId: rfqA.productVariant.id,
        supplier: "SYNTHETIC Northstar Fastener Supply",
        unitPriceCents: PosInt.make(1_899),
      }),
      SupplierOffer.make({
        availableQuantity: PosInt.make(1_000),
        expiresAt: isoTimestamp("2026-08-28T17:00:00.000Z"),
        id: entityId("synthetic-offer-rfq-b"),
        observedAt: isoTimestamp("2026-08-27T11:35:00.000Z"),
        productVariantId: rfqB.productVariant.id,
        supplier: "SYNTHETIC Great Lakes Bolt Supply",
        unitPriceCents: PosInt.make(1_275),
      }),
    ],
    standards: [
      Standard.make({
        accessedOn: isoDate("2026-08-25"),
        designation: "ASTM F1852 Type 1",
        id: entityId("astm-f1852-type-1"),
        revision: "F3125 consolidated designation; RCSC 2020 context",
        sourceUrl: "https://www.aisc.org/aisc/solutions-center/engineering-faqs/6-bolting/",
      }),
      Standard.make({
        accessedOn: isoDate("2026-08-25"),
        designation: "ASTM A563 DH",
        id: entityId("astm-a563-dh"),
        revision: "Compatibility summary accessed 2026-08-25",
        sourceUrl: "https://www.aisc.org/aisc/solutions-center/engineering-faqs/6-bolting/",
      }),
      Standard.make({
        accessedOn: isoDate("2026-08-25"),
        designation: "ASTM F436 Type 1",
        id: entityId("astm-f436-type-1"),
        revision: "Compatibility summary accessed 2026-08-25",
        sourceUrl: "https://www.aisc.org/aisc/solutions-center/engineering-faqs/6-bolting/",
      }),
      Standard.make({
        accessedOn: isoDate("2026-08-25"),
        designation: "ASTM F959 Type 325",
        id: entityId("astm-f959-type-325"),
        revision: "ASTM F959 technical summary accessed 2026-08-25",
        sourceUrl: "https://www.portlandbolt.com/technical/specifications/astm-f959/",
      }),
      Standard.make({
        accessedOn: isoDate("2026-08-25"),
        designation: "ASTM A490 Type 1",
        id: entityId("astm-a490-type-1"),
        revision: "F3125 consolidated designation; coating summary accessed 2026-08-25",
        sourceUrl: "https://blueprint.fastenal.com/structural-bolts.html",
      }),
    ],
    tools: [
      Tool.make({
        id: entityId("synthetic-shear-wrench"),
        label: "SYNTHETIC shear-wrench reference",
        operation: "Install a compatible tension-control assembly after systematic snug-tightening.",
      }),
      Tool.make({
        id: entityId("synthetic-dti-feeler-gauge"),
        label: "SYNTHETIC DTI feeler-gauge reference",
        operation: "Verify the residual DTI gap under the applicable installation procedure.",
      }),
    ],
  });
};
