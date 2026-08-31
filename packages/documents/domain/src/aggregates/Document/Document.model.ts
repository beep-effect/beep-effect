/**
 * Filed document aggregate model.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocumentsDomainId } from "@beep/identity/packages";
import { LiteralKit, SchemaUtils } from "@beep/schema";
import { UnitInterval } from "@beep/schema/UnitInterval";
import * as S from "effect/Schema";
import { LegalDocumentConceptId, ProjectedVaultPath } from "../../values/Taxonomy/index.ts";

const $I = $DocumentsDomainId.create("aggregates/Document/Document.model");

const FilingOutcomeKind = LiteralKit(["filed", "inboxed"]);

/**
 * Reason a document was routed to the intake inbox instead of a taxonomy folder.
 *
 * **Example** (Decode low-confidence reason)
 *
 * ```ts
 * import { InboxedFilingReason } from "@beep/documents-domain/aggregates/Document"
 * import * as S from "effect/Schema"
 *
 * const reason = S.decodeUnknownSync(InboxedFilingReason)("low-confidence")
 * console.log(reason)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const InboxedFilingReason = LiteralKit(["llm-unavailable", "low-confidence", "no-match"]).pipe(
  $I.annoteSchema("InboxedFilingReason", {
    description: "Reason a document was routed to the intake inbox instead of a taxonomy folder.",
  })
);

/**
 * Type for {@link InboxedFilingReason}.
 *
 * **Example** (Assign no-match reason type)
 *
 * ```ts
 * import { InboxedFilingReason } from "@beep/documents-domain/aggregates/Document"
 *
 * const reason: InboxedFilingReason = "no-match"
 * console.log(reason)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type InboxedFilingReason = typeof InboxedFilingReason.Type;

const FilingOutcomeBase = FilingOutcomeKind.toTaggedUnion("kind")({
  filed: {
    confidence: UnitInterval,
    rationale: S.NonEmptyString,
    taxonomyConceptId: LegalDocumentConceptId,
  },
  inboxed: {
    rationale: S.NonEmptyString,
    reason: InboxedFilingReason,
  },
});

/**
 * Filing decision outcome: filed under a taxonomy concept, or routed to the intake inbox.
 *
 * **Example** (Build filed FilingOutcome)
 *
 * ```ts
 * import { FilingOutcome } from "@beep/documents-domain/aggregates/Document"
 *
 * const outcome = FilingOutcome.decodeUnknownSync({
 *   kind: "filed",
 *   confidence: 1,
 *   rationale: "Matched deterministic taxonomy token for pleadings.",
 *   taxonomyConceptId: "pleadings"
 * })
 * console.log(outcome.kind)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export const FilingOutcome = FilingOutcomeBase.rebuild(FilingOutcomeBase.ast).pipe(
  $I.annoteSchema("FilingOutcome", {
    description: "Filing decision outcome: filed under a taxonomy concept, or routed to the intake inbox.",
  }),
  SchemaUtils.withCodecStatics(["decodeUnknownSync"]),
  (schema) =>
    schema.pipe(
      S.toTaggedUnion("kind"),
      SchemaUtils.withStatics(() => ({ decodeUnknownSync: schema.decodeUnknownSync }))
    )
);

/**
 * Type for {@link FilingOutcome}.
 *
 * **Example** (Make inboxed FilingOutcome)
 *
 * ```ts
 * import { FilingOutcome } from "@beep/documents-domain/aggregates/Document"
 *
 * const outcome: FilingOutcome = FilingOutcome.make({
 *   kind: "inboxed",
 *   rationale: "No taxonomy heuristic token matched the filename.",
 *   reason: "no-match"
 * })
 * console.log(outcome.kind)
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export type FilingOutcome = typeof FilingOutcome.Type;

/**
 * Stable SHA-256 digest for filed document bytes.
 *
 * **Example** (Decode content digest value)
 *
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
 * **Example** (Type annotated digest decode)
 *
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
 * **Example** (Decode filed Document aggregate)
 *
 * ```ts
 * import { Document } from "@beep/documents-domain/aggregates/Document"
 * import * as S from "effect/Schema"
 *
 * const document = S.decodeUnknownSync(Document)({
 *   contentDigest: "abc123",
 *   filing: {
 *     kind: "filed",
 *     confidence: 1,
 *     rationale: "Matched deterministic taxonomy token for pleadings.",
 *     taxonomyConceptId: "pleadings"
 *   },
 *   originalFileName: "complaint.pdf",
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
    filing: FilingOutcome.annotateKey({
      description: "Filing outcome that produced this document's vault placement.",
    }),
    originalFileName: S.NonEmptyString.annotateKey({
      description: "Original filename supplied by the source drop.",
    }),
    vaultPath: ProjectedVaultPath.annotateKey({
      description: "Deterministic vault-relative materialization path.",
    }),
  },
  $I.annote("Document", {
    description: "A document materialized into the workspace vault.",
  })
) {}
