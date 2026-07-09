/**
 * Filed document aggregate model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocumentsDomainId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { LegalDocumentConceptId, ProjectedVaultPath } from "../../values/Taxonomy/index.js";

const $I = $DocumentsDomainId.create("aggregates/Document/Document.model");

/**
 * Stable SHA-256 digest for filed document bytes.
 *
 * @example
 * ```ts
 * import { DocumentContentDigest } from "@beep/documents-domain/aggregates/Document"
 * import * as S from "effect/Schema"
 *
 * const digest = S.decodeUnknownSync(DocumentContentDigest)("abc123")
 * console.log(digest)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const DocumentContentDigest = S.NonEmptyString.pipe(
  S.brand("DocumentContentDigest"),
  $I.annoteSchema("DocumentContentDigest", {
    description: "Deterministic content digest for a source document.",
  })
);

/**
 * Stable SHA-256 digest for filed document bytes.
 *
 * @example
 * ```ts
 * import { DocumentContentDigest } from "@beep/documents-domain/aggregates/Document"
 * import * as S from "effect/Schema"
 *
 * const digest: DocumentContentDigest = S.decodeUnknownSync(DocumentContentDigest)("abc123")
 * console.log(digest)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type DocumentContentDigest = typeof DocumentContentDigest.Type;

/**
 * A document materialized into the workspace vault.
 *
 * @example
 * ```ts
 * import { Document } from "@beep/documents-domain/aggregates/Document"
 * import * as S from "effect/Schema"
 *
 * const document = S.decodeUnknownSync(Document)({
 *   contentDigest: "abc123",
 *   originalFileName: "complaint.pdf",
 *   taxonomyConceptId: "pleadings",
 *   vaultPath: {
 *     fileName: "complaint--abc123.pdf",
 *     relativePath: "matters/client-default/matter-general/01-pleadings/complaint--abc123.pdf",
 *     segments: ["matters", "client-default", "matter-general", "01-pleadings", "complaint--abc123.pdf"],
 *     taxonomySegments: ["01-pleadings"]
 *   }
 * })
 * console.log(document.originalFileName)
 * ```
 *
 * @category aggregates
 * @since 0.0.0
 */
export class Document extends S.Class<Document>($I`Document`)(
  {
    contentDigest: DocumentContentDigest.annotateKey({
      description: "Deterministic content digest for the filed source bytes.",
    }),
    originalFileName: S.NonEmptyString.annotateKey({
      description: "Original filename supplied by the source drop.",
    }),
    taxonomyConceptId: LegalDocumentConceptId.annotateKey({
      description: "Taxonomy concept selected for the filed document.",
    }),
    vaultPath: ProjectedVaultPath.annotateKey({
      description: "Deterministic vault-relative materialization path.",
    }),
  },
  $I.annote("Document", {
    description: "A document materialized into the workspace vault.",
  })
) {}
