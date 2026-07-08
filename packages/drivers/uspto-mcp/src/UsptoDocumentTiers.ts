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
import { Fn, LiteralKit, NonNegativeInt, PosInt, SchemaUtils, URLStr } from "@beep/schema";
import { UsptoDocumentReference } from "@beep/uspto";
import { dual } from "effect/Function";
import * as S from "effect/Schema";

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
  minimal: S.Struct({
    documentIdentifier: UsptoDocumentReference.fields.documentIdentifier.annotateKey({
      description: "Non-empty USPTO file-wrapper document identifier.",
    }),
  }),
  balanced: S.Struct({
    documentCode: S.String.annotateKey({
      description: "USPTO document code naming the file-wrapper document type.",
    }),
    documentIdentifier: UsptoDocumentReference.fields.documentIdentifier.annotateKey({
      description: "Non-empty USPTO file-wrapper document identifier.",
    }),
    officialDate: S.String.annotateKey({
      description: "Official USPTO date string associated with the file-wrapper document.",
    }),
  }),
  complete: S.Struct({
    documentCode: S.String.annotateKey({
      description: "USPTO document code naming the file-wrapper document type.",
    }),
    documentCodeDescriptionText: S.String.annotateKey({
      description: "Human-readable USPTO document code description.",
    }),
    documentIdentifier: UsptoDocumentReference.fields.documentIdentifier.annotateKey({
      description: "Non-empty USPTO file-wrapper document identifier.",
    }),
    downloadUrl: URLStr.annotateKey({
      description: "Published USPTO document download URL.",
    }),
    officialDate: S.String.annotateKey({
      description: "Official USPTO date string associated with the file-wrapper document.",
    }),
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

const DocumentsProjectionOutputBase = LiteralKit(["Inline", "Fetchable"]).toTaggedUnion("_tag")({
  Inline: { tier: FieldTierName, envelope: ColumnarEnvelope },
  Fetchable: { handle: FetchableHandle },
});

const DocumentsProjectionOutputArbitraryValues = [
  DocumentsProjectionOutputBase.make({
    _tag: "Inline",
    tier: "minimal",
    envelope: ColumnarEnvelope.make({ columns: ["documentIdentifier"], rows: [["doc-1"]] }),
  }),
  DocumentsProjectionOutputBase.make({
    _tag: "Fetchable",
    handle: FetchableHandle.make({
      expiresAt: "2026-07-01T01:00:00.000Z",
      handleId: "uspto-documents-demo-handle",
      sizeBytes: NonNegativeInt.make(1),
      tier: "minimal",
    }),
  }),
] as const;

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
export const DocumentsProjectionOutput = DocumentsProjectionOutputBase.annotate({
  toArbitrary: () => (fc) => fc.constantFrom(...DocumentsProjectionOutputArbitraryValues),
}).pipe(
  $I.annoteSchema("DocumentsProjectionOutput", {
    description:
      "Outcome of projecting a documentBag-shaped document array within a size budget: inline tier-projected columnar envelope, or a fetchable handle when even the minimal tier is oversized.",
  }),
  SchemaUtils.withCodecStatics
);

/**
 * Type for {@link DocumentsProjectionOutput}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DocumentsProjectionOutput = typeof DocumentsProjectionOutput.Type;

/**
 * Callback that mints a fetchable handle when even the minimal document tier
 * exceeds the caller's size budget.
 *
 * @example
 * ```ts
 * import { FetchableHandle } from "@beep/mcp-kit"
 * import { NonNegativeInt } from "@beep/schema"
 * import { MintFetchableHandle } from "@beep/uspto-mcp/UsptoDocumentTiers"
 *
 * const mint = MintFetchableHandle.implementSync((oversized) =>
 *   FetchableHandle.make({
 *     handleId: "5b1d6a3e-8f3e-4a1a-9c1e-2e6b7a2f9c10",
 *     expiresAt: "2026-07-01T01:00:00.000Z",
 *     sizeBytes: NonNegativeInt.make(oversized.sizeBytes),
 *     tier: "minimal"
 *   })
 * )
 * console.log(mint)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MintFetchableHandle = Fn({
  input: OversizedFieldProjection,
  output: FetchableHandle,
}).pipe(
  $I.annoteSchema("MintFetchableHandle", {
    description: "Callback that mints a fetchable handle for an oversized minimal document projection.",
  })
);

/**
 * Type for {@link MintFetchableHandle}.
 *
 * @example
 * ```ts
 * import type { MintFetchableHandle } from "@beep/uspto-mcp/UsptoDocumentTiers"
 *
 * const mint = ((oversized) => ({
 *   handleId: "5b1d6a3e-8f3e-4a1a-9c1e-2e6b7a2f9c10",
 *   expiresAt: "2026-07-01T01:00:00.000Z",
 *   sizeBytes: oversized.sizeBytes,
 *   tier: "minimal"
 * })) satisfies MintFetchableHandle
 * console.log(mint)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type MintFetchableHandle = typeof MintFetchableHandle.Type;

/**
 * Options for {@link projectDocumentsWithinBudget}.
 *
 * @example
 * ```ts
 * import { FetchableHandle } from "@beep/mcp-kit"
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 * import { MintFetchableHandle, ProjectDocumentsWithinBudgetOptions } from "@beep/uspto-mcp/UsptoDocumentTiers"
 *
 * const options = ProjectDocumentsWithinBudgetOptions.make({
 *   budgetBytes: PosInt.make(10_000),
 *   mintFetchableHandle: MintFetchableHandle.implementSync((oversized) =>
 *     FetchableHandle.make({
 *       handleId: "5b1d6a3e-8f3e-4a1a-9c1e-2e6b7a2f9c10",
 *       expiresAt: "2026-07-01T01:00:00.000Z",
 *       sizeBytes: NonNegativeInt.make(oversized.sizeBytes),
 *       tier: "minimal"
 *     })
 *   )
 * })
 * console.log(options.budgetBytes)
 * // 10000
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProjectDocumentsWithinBudgetOptions extends S.Class<ProjectDocumentsWithinBudgetOptions>(
  $I`ProjectDocumentsWithinBudgetOptions`
)(
  {
    budgetBytes: PosInt.annotateKey({
      description: "Maximum serialized size, in bytes, the reshaped response must fit within.",
    }),
    mintFetchableHandle: MintFetchableHandle.annotateKey({
      description: "Callback that mints a fetchable handle when the minimal tier is still oversized.",
    }),
  },
  $I.annote("ProjectDocumentsWithinBudgetOptions", {
    description: "Budget and fetchable-handle minting callback for USPTO document projection.",
  })
) {}

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
 * import { NonNegativeInt, PosInt } from "@beep/schema"
 * import { projectDocumentsWithinBudget } from "@beep/uspto-mcp/UsptoDocumentTiers"
 *
 * const documents = [UsptoDocumentReference.make({ documentIdentifier: "DOC-1" })]
 * const projection = projectDocumentsWithinBudget(documents, {
 *   budgetBytes: PosInt.make(10_000),
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
export const projectDocumentsWithinBudget: {
  (
    options: ProjectDocumentsWithinBudgetOptions
  ): (documents: ReadonlyArray<UsptoDocumentReference>) => DocumentsProjectionOutput;
  (
    documents: ReadonlyArray<UsptoDocumentReference>,
    options: ProjectDocumentsWithinBudgetOptions
  ): DocumentsProjectionOutput;
} = dual(2, (documents: ReadonlyArray<UsptoDocumentReference>, options: ProjectDocumentsWithinBudgetOptions) => {
  const rows = documents.map(documentToRecord);

  for (const tier of TIER_ORDER) {
    const envelope = toColumnarEnvelope(rows.map((row) => projectFieldTier(row, tier, usptoDocumentFieldTiers)));
    if (estimateJsonSize(envelope) <= options.budgetBytes) {
      return DocumentsProjectionOutput.make({ _tag: "Inline", tier, envelope });
    }
  }

  const minimalEnvelope = toColumnarEnvelope(
    rows.map((row) => projectFieldTier(row, "minimal", usptoDocumentFieldTiers))
  );
  const oversized = OversizedFieldProjection.make({
    value: { columns: minimalEnvelope.columns, rows: minimalEnvelope.rows },
    sizeBytes: NonNegativeInt.make(estimateJsonSize(minimalEnvelope)),
  });
  return DocumentsProjectionOutput.make({ _tag: "Fetchable", handle: options.mintFetchableHandle(oversized) });
});
