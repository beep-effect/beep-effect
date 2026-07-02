/**
 * Progressive field-tier projection for USPTO file-wrapper documents.
 *
 * `@beep/uspto`'s `getDocuments` resolves an application's
 * `documentBag`-shaped file-wrapper listing (`UsptoDocumentReference[]`,
 * `packages/drivers/uspto/src/Uspto.models.ts:210-221`) — a canonical
 * candidate for oversized MCP tool results. This module composes
 * `@beep/mcp-kit`'s field-tier primitives (`projectFieldTier`,
 * `toColumnarEnvelope`, `estimateJsonSize`) into a bulk, array-level budget
 * projector; the kit's own `projectWithinBudget` only projects a single flat
 * record, not a row-oriented array, so this composition — not a
 * reimplementation of the kit's logic — is the host-side glue the kit's
 * design expects consumers to provide.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $UsptoMcpId } from "@beep/identity/packages";
import {
  ColumnarEnvelope,
  defineFieldTiers,
  estimateJsonSize,
  FetchableHandle,
  FieldTierName,
  OversizedFieldProjection,
  projectFieldTier,
  toColumnarEnvelope,
} from "@beep/mcp-kit";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import * as S from "effect/Schema";
import type { UsptoDocumentReference } from "@beep/uspto";

const $I = $UsptoMcpId.create("UsptoDocumentTiers");

/**
 * Named field tiers over a USPTO file-wrapper document reference: `minimal`
 * carries only the identifier, `balanced` adds the document code and
 * official date, `complete` adds the human-readable code description and
 * download URL.
 *
 * @example
 * ```ts
 * import { usptoDocumentFieldTiers } from "@beep/uspto-mcp/UsptoDocumentTiers"
 *
 * console.log(Object.keys(usptoDocumentFieldTiers.minimal.fields))
 * // ["documentIdentifier"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const usptoDocumentFieldTiers = defineFieldTiers({
  minimal: S.Struct({ documentIdentifier: S.String }),
  balanced: S.Struct({
    documentCode: S.String,
    documentIdentifier: S.String,
    officialDate: S.String,
  }),
  complete: S.Struct({
    documentCode: S.String,
    documentCodeDescriptionText: S.String,
    documentIdentifier: S.String,
    downloadUrl: S.String,
    officialDate: S.String,
  }),
});

const documentToRecord = (document: UsptoDocumentReference): Record<string, unknown> => ({
  documentCode: document.documentCode,
  documentCodeDescriptionText: document.documentCodeDescriptionText,
  documentIdentifier: document.documentIdentifier,
  downloadUrl: document.downloadUrl,
  officialDate: document.officialDate,
});

const TIER_ORDER: ReadonlyArray<FieldTierName> = ["complete", "balanced", "minimal"];

/**
 * Tagged outcome of {@link projectDocumentsWithinBudget}: `Inline` names the
 * field tier that fit within budget, carrying the tier-projected columnar
 * envelope directly; `Fetchable` carries a {@link FetchableHandle} minted by
 * the caller when even the `minimal` tier's columnar envelope exceeds
 * budget.
 *
 * @category schemas
 * @since 0.0.0
 */
export const DocumentsProjectionOutput = LiteralKit(["Inline", "Fetchable"])
  .toTaggedUnion("_tag")({
    Inline: { tier: FieldTierName, envelope: ColumnarEnvelope },
    Fetchable: { handle: FetchableHandle },
  })
  .pipe(
    $I.annoteSchema("DocumentsProjectionOutput", {
      description:
        "Outcome of projecting a documentBag-shaped document array within a size budget: inline tier-projected columnar envelope, or a fetchable handle when even the minimal tier is oversized.",
    })
  );

/**
 * Type for {@link DocumentsProjectionOutput}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DocumentsProjectionOutput = typeof DocumentsProjectionOutput.Type;

/**
 * Projects an array of USPTO document references to the most complete field
 * tier whose reshaped columnar envelope fits within `budgetBytes`. Every
 * candidate tier is reshaped via {@link toColumnarEnvelope} — one column-name
 * list plus value-only rows — before its size is measured, so the same
 * reshaping that shrinks a single record's JSON also compounds across the
 * whole document array. When even `minimal` does not fit,
 * `mintFetchableHandle` is called with the oversized minimal projection and
 * its size; the payload is never returned inline in that case.
 *
 * @example
 * ```ts
 * import { UsptoDocumentReference } from "@beep/uspto"
 * import { FetchableHandle } from "@beep/mcp-kit"
 * import { NonNegativeInt } from "@beep/schema"
 * import { projectDocumentsWithinBudget } from "@beep/uspto-mcp/UsptoDocumentTiers"
 *
 * const documents = [UsptoDocumentReference.make({ documentIdentifier: "DOC-1" })]
 * const projection = projectDocumentsWithinBudget(documents, {
 *   budgetBytes: 10_000,
 *   mintFetchableHandle: (oversized) =>
 *     FetchableHandle.make({
 *       handleId: "5b1d6a3e-8f3e-4a1a-9c1e-2e6b7a2f9c10",
 *       expiresAt: "2026-07-01T01:00:00.000Z",
 *       sizeBytes: oversized.sizeBytes,
 *       tier: "minimal"
 *     })
 * })
 * console.log(projection._tag)
 * // "Inline"
 * ```
 *
 * @category combinators
 * @since 0.0.0
 */
export const projectDocumentsWithinBudget = (
  documents: ReadonlyArray<UsptoDocumentReference>,
  options: {
    readonly budgetBytes: number;
    readonly mintFetchableHandle: (oversized: OversizedFieldProjection) => FetchableHandle;
  }
): DocumentsProjectionOutput => {
  const rows = documents.map(documentToRecord);

  for (const tier of TIER_ORDER) {
    const envelope = toColumnarEnvelope(rows.map((row) => projectFieldTier(usptoDocumentFieldTiers, tier, row)));
    if (estimateJsonSize(envelope) <= options.budgetBytes) {
      return DocumentsProjectionOutput.make({ _tag: "Inline", tier, envelope });
    }
  }

  const minimalEnvelope = toColumnarEnvelope(
    rows.map((row) => projectFieldTier(usptoDocumentFieldTiers, "minimal", row))
  );
  const oversized = OversizedFieldProjection.make({
    value: { columns: minimalEnvelope.columns, rows: minimalEnvelope.rows },
    sizeBytes: NonNegativeInt.make(estimateJsonSize(minimalEnvelope)),
  });
  return DocumentsProjectionOutput.make({ _tag: "Fetchable", handle: options.mintFetchableHandle(oversized) });
};
