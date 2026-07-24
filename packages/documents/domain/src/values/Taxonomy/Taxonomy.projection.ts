/**
 * Deterministic taxonomy-to-vault folder projection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $DocumentsDomainId } from "@beep/identity/packages";
import { TaggedErrorClass } from "@beep/schema";
import { ValidWindowsPlainPathSegment } from "@beep/schema/FilePath";
import { A } from "@beep/utils";
import { Effect, pipe } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { LegalDocumentConceptId, LegalDocumentTaxonomy, VaultFilingContext } from "./Taxonomy.model.ts";
import type { LegalDocumentTaxonomyConcept } from "./Taxonomy.model.ts";

const $I = $DocumentsDomainId.create("values/Taxonomy/Taxonomy.projection");

const ROOT_SEGMENT = "matters" as const;
const INBOX_SEGMENT = "00-inbox" as const;
const FALLBACK_STEM = "document" as const;
const SHORT_DIGEST_LENGTH = 12;

/**
 * Failure raised when deterministic vault path projection cannot complete.
 *
 * @example
 * ```ts
 * import { TaxonomyProjectionError } from "@beep/documents-domain/values/Taxonomy"
 *
 * const error = TaxonomyProjectionError.make({ reason: "unknown taxonomy concept" })
 * console.log(error._tag)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class TaxonomyProjectionError extends TaggedErrorClass<TaxonomyProjectionError>($I`TaxonomyProjectionError`)(
  "TaxonomyProjectionError",
  {
    reason: S.NonEmptyString.annotateKey({
      description: "Deterministic projection failure reason.",
    }),
  },
  $I.annote("TaxonomyProjectionError", {
    description: "Failure raised when deterministic vault path projection cannot be completed.",
  })
) {}

/**
 * Input accepted by deterministic filed-document path projection.
 *
 * @example
 * ```ts
 * import {
 *   DefaultVaultFilingContext,
 *   legalDocumentTaxonomy,
 *   ProjectFiledDocumentPathInput
 * } from "@beep/documents-domain/values/Taxonomy"
 *
 * const input = ProjectFiledDocumentPathInput.make({
 *   contentDigest: "abc123",
 *   context: DefaultVaultFilingContext,
 *   originalFileName: "complaint.pdf",
 *   taxonomy: legalDocumentTaxonomy,
 *   taxonomyConceptId: "pleadings"
 * })
 * console.log(input.originalFileName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProjectFiledDocumentPathInput extends S.Class<ProjectFiledDocumentPathInput>(
  $I`ProjectFiledDocumentPathInput`
)(
  {
    contentDigest: S.NonEmptyString.annotateKey({
      description: "Full deterministic content digest for filename disambiguation.",
    }),
    context: VaultFilingContext.annotateKey({
      description: "Client and matter path context.",
    }),
    originalFileName: S.NonEmptyString.annotateKey({
      description: "Original source filename.",
    }),
    taxonomy: LegalDocumentTaxonomy.annotateKey({
      description: "Legal document taxonomy seed used for folder projection.",
    }),
    taxonomyConceptId: LegalDocumentConceptId.annotateKey({
      description: "Leaf taxonomy concept selected by the filing decision.",
    }),
  },
  $I.annote("ProjectFiledDocumentPathInput", {
    description: "Input accepted by deterministic filed-document path projection.",
  })
) {}

/**
 * Deterministic relative vault path for a filed document.
 *
 * @example
 * ```ts
 * import { ProjectedVaultPath } from "@beep/documents-domain/values/Taxonomy"
 * import * as S from "effect/Schema"
 *
 * const path = S.decodeUnknownSync(ProjectedVaultPath)({
 *   fileName: "complaint--abc123.pdf",
 *   relativePath: "matters/client-default/matter-general/01-pleadings/complaint--abc123.pdf",
 *   segments: ["matters", "client-default", "matter-general", "01-pleadings", "complaint--abc123.pdf"],
 *   taxonomySegments: ["01-pleadings"]
 * })
 * console.log(path.fileName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProjectedVaultPath extends S.Class<ProjectedVaultPath>($I`ProjectedVaultPath`)(
  {
    fileName: ValidWindowsPlainPathSegment.annotateKey({
      description: "Deterministic vault filename.",
    }),
    relativePath: S.NonEmptyString.annotateKey({
      description: "Vault-relative path joined with forward slashes.",
    }),
    segments: S.Array(ValidWindowsPlainPathSegment).annotateKey({
      description: "Vault-relative path segments.",
    }),
    taxonomySegments: S.Array(ValidWindowsPlainPathSegment).annotateKey({
      description: "Ancestor-to-leaf taxonomy folder segments.",
    }),
  },
  $I.annote("ProjectedVaultPath", {
    description: "Deterministic relative vault path for a filed document.",
  })
) {}

const decodeSegment = (value: string): Effect.Effect<ValidWindowsPlainPathSegment, TaxonomyProjectionError> =>
  S.decodeUnknownEffect(ValidWindowsPlainPathSegment)(value).pipe(
    Effect.mapError(() => TaxonomyProjectionError.make({ reason: `invalid vault path segment: ${value}` }))
  );

const asciiSlug = (value: string): string => {
  const normalized = value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  const slug = pipe(normalized, Str.toLowerCase, Str.replace(/[^a-z0-9]+/g, "-"), Str.replace(/^-+|-+$/g, ""));
  return slug.length === 0 ? FALLBACK_STEM : slug;
};

const stableDisplaySegment = (
  stableKey: ValidWindowsPlainPathSegment,
  displayName: string
): Effect.Effect<ValidWindowsPlainPathSegment, TaxonomyProjectionError> =>
  decodeSegment(`${stableKey}-${asciiSlug(displayName)}`);

const taxonomyFolderSegment = (
  concept: LegalDocumentTaxonomyConcept
): Effect.Effect<ValidWindowsPlainPathSegment, TaxonomyProjectionError> =>
  decodeSegment(concept.sortKey === null ? concept.folderSegment : `${concept.sortKey}-${concept.folderSegment}`);

const conceptById = (
  taxonomy: LegalDocumentTaxonomy,
  id: LegalDocumentConceptId
): Effect.Effect<LegalDocumentTaxonomyConcept, TaxonomyProjectionError> =>
  pipe(
    taxonomy.concepts,
    A.findFirst((concept) => concept.id === id),
    Effect.fromOption(() => TaxonomyProjectionError.make({ reason: `unknown taxonomy concept: ${id}` }))
  );

const conceptPath = (
  taxonomy: LegalDocumentTaxonomy,
  concept: LegalDocumentTaxonomyConcept
): Effect.Effect<ReadonlyArray<LegalDocumentTaxonomyConcept>, TaxonomyProjectionError> =>
  concept.parentId === null
    ? Effect.succeed([concept])
    : pipe(
        conceptById(taxonomy, concept.parentId),
        Effect.flatMap((parent) => pipe(conceptPath(taxonomy, parent), Effect.map(A.append(concept))))
      );

const filenameParts = (fileName: string): { readonly extension: string; readonly stem: string } => {
  const trimmed = pipe(fileName, Str.trim);
  const dotIndex = trimmed.lastIndexOf(".");
  if (dotIndex <= 0 || dotIndex === trimmed.length - 1) {
    return { extension: "bin", stem: trimmed };
  }
  return {
    extension: asciiSlug(trimmed.slice(dotIndex + 1)),
    stem: trimmed.slice(0, dotIndex),
  };
};

const projectedFileName = (
  originalFileName: string,
  contentDigest: string
): Effect.Effect<ValidWindowsPlainPathSegment, TaxonomyProjectionError> => {
  const parts = filenameParts(originalFileName);
  return decodeSegment(`${asciiSlug(parts.stem)}--${contentDigest.slice(0, SHORT_DIGEST_LENGTH)}.${parts.extension}`);
};

/**
 * Projects a taxonomy concept decision into a deterministic vault-relative file path.
 *
 * @example
 * ```ts
 * import {
 *   DefaultVaultFilingContext,
 *   legalDocumentTaxonomy,
 *   ProjectFiledDocumentPathInput,
 *   projectFiledDocumentPath
 * } from "@beep/documents-domain/values/Taxonomy"
 * import { Effect } from "effect"
 *
 * const path = Effect.runSync(projectFiledDocumentPath(ProjectFiledDocumentPathInput.make({
 *   contentDigest: "abc123",
 *   context: DefaultVaultFilingContext,
 *   originalFileName: "complaint.pdf",
 *   taxonomy: legalDocumentTaxonomy,
 *   taxonomyConceptId: "pleadings"
 * })))
 * console.log(path.relativePath)
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const projectFiledDocumentPath = Effect.fn("Documents.Taxonomy.projectFiledDocumentPath")(function* (
  input: ProjectFiledDocumentPathInput
) {
  const leaf = yield* conceptById(input.taxonomy, input.taxonomyConceptId);
  const concepts = yield* conceptPath(input.taxonomy, leaf);
  const rootSegment = yield* decodeSegment(ROOT_SEGMENT);
  const clientSegment = yield* stableDisplaySegment(input.context.clientStableKey, input.context.clientDisplayName);
  const matterSegment = yield* stableDisplaySegment(input.context.matterStableKey, input.context.matterDisplayName);
  const taxonomySegments = yield* Effect.all(A.map(concepts, taxonomyFolderSegment));
  const fileName = yield* projectedFileName(input.originalFileName, input.contentDigest);
  const segments = [rootSegment, clientSegment, matterSegment, ...taxonomySegments, fileName];
  return ProjectedVaultPath.make({
    fileName,
    relativePath: segments.join("/"),
    segments,
    taxonomySegments,
  });
});

/**
 * Input accepted by deterministic inbox document path projection.
 *
 * @example
 * ```ts
 * import { ProjectInboxDocumentPathInput } from "@beep/documents-domain/values/Taxonomy"
 *
 * const input = ProjectInboxDocumentPathInput.make({
 *   contentDigest: "abc123",
 *   intakeBatchId: "batch-20260709",
 *   originalFileName: "scan.pdf"
 * })
 * console.log(input.intakeBatchId)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProjectInboxDocumentPathInput extends S.Class<ProjectInboxDocumentPathInput>(
  $I`ProjectInboxDocumentPathInput`
)(
  {
    contentDigest: S.NonEmptyString.annotateKey({
      description: "Full deterministic content digest for filename disambiguation.",
    }),
    intakeBatchId: S.NonEmptyString.annotateKey({
      description: "Intake batch id owning the inbox folder.",
    }),
    originalFileName: S.NonEmptyString.annotateKey({
      description: "Original source filename.",
    }),
  },
  $I.annote("ProjectInboxDocumentPathInput", {
    description: "Input accepted by deterministic inbox document path projection.",
  })
) {}

/**
 * Projects an unfiled intake document into the deterministic inbox vault path.
 *
 * @example
 * ```ts
 * import { ProjectInboxDocumentPathInput, projectInboxDocumentPath } from "@beep/documents-domain/values/Taxonomy"
 * import { Effect } from "effect"
 *
 * const path = Effect.runSync(projectInboxDocumentPath(ProjectInboxDocumentPathInput.make({
 *   contentDigest: "abc123",
 *   intakeBatchId: "batch-20260709",
 *   originalFileName: "scan.pdf"
 * })))
 * console.log(path.relativePath)
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const projectInboxDocumentPath = Effect.fn("Documents.Taxonomy.projectInboxDocumentPath")(function* (
  input: ProjectInboxDocumentPathInput
) {
  const inboxSegment = yield* decodeSegment(INBOX_SEGMENT);
  const batchSegment = yield* decodeSegment(asciiSlug(input.intakeBatchId));
  const fileName = yield* projectedFileName(input.originalFileName, input.contentDigest);
  const segments = [inboxSegment, batchSegment, fileName];
  return ProjectedVaultPath.make({
    fileName,
    relativePath: segments.join("/"),
    segments,
    taxonomySegments: [],
  });
});

/**
 * Projects an intake batch id into the deterministic inbox path.
 *
 * @example
 * ```ts
 * import { projectIntakeInboxPath } from "@beep/documents-domain/values/Taxonomy"
 * import { Effect } from "effect"
 *
 * const inboxPath = Effect.runSync(projectIntakeInboxPath("batch-20260709"))
 * console.log(inboxPath)
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const projectIntakeInboxPath = (intakeBatchId: string): Effect.Effect<string, TaxonomyProjectionError> =>
  decodeSegment(asciiSlug(intakeBatchId)).pipe(Effect.map((batchSegment) => `${INBOX_SEGMENT}/${batchSegment}`));

/**
 * Slugifies a display value for use in vault path segments.
 *
 * @example
 * ```ts
 * import { slugVaultSegment } from "@beep/documents-domain/values/Taxonomy"
 *
 * console.log(slugVaultSegment("General Matter"))
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const slugVaultSegment = asciiSlug;
