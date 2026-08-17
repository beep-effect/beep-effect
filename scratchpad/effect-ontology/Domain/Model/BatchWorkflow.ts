/**
 * Batch-ingestion lifecycle values and transition policy.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import { LiteralKit, NonNegativeInt, SchemaUtils } from "@beep/schema";
import { pipe } from "effect";
import * as A from "effect/Array";
import * as Bool from "effect/Boolean";
import * as Num from "effect/Number";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { BatchId, DocumentId, GcsUri, OntologyVersion } from "../Identity.ts";

const $I = $ScratchpadId.create("effect-ontology/Domain/Model/BatchWorkflow");

const DocumentFailureFields = {
  code: S.NonEmptyString,
  message: S.NonEmptyString,
} as const;

class DocumentFailure extends S.Class<DocumentFailure>($I`DocumentFailure`)(
  DocumentFailureFields,
  $I.annote("DocumentFailure", {
    description: "Stable code and diagnostic for one failed batch document.",
  })
) {}

const DocumentStatusDefinition = S.Union([
  S.Struct({
    status: S.tag("pending"),
    documentId: DocumentId,
  }),
  S.Struct({
    status: S.tag("processing"),
    documentId: DocumentId,
    startedAt: S.DateTimeUtcFromString,
  }),
  S.Struct({
    status: S.tag("success"),
    documentId: DocumentId,
    graphUri: GcsUri,
    entityCount: NonNegativeInt,
    relationCount: NonNegativeInt,
    claimCount: NonNegativeInt,
    startedAt: S.DateTimeUtcFromString,
    completedAt: S.DateTimeUtcFromString,
  }),
  S.Struct({
    status: S.tag("failed"),
    documentId: DocumentId,
    error: DocumentFailure,
    startedAt: S.OptionFromOptionalKey(S.DateTimeUtcFromString).pipe(SchemaUtils.withNoneDefault),
    completedAt: S.DateTimeUtcFromString,
  }),
]).pipe(S.toTaggedUnion("status"));

/**
 * Per-document batch state with payloads nested by lifecycle variant.
 *
 * **Details**
 *
 * * Success-only graph/count fields and failure-only diagnostics exist solely in
 * their corresponding variants. No consumer needs to correlate a status
 * string with a bag of optional fields.
 *
 * **Example** (Use DocumentStatus)
 * ```ts
 * import * as S from "effect/Schema"
 * import { DocumentStatus } from "@effect-ontology/Model/BatchWorkflow.ts"
 *
 * const status = S.decodeUnknownSync(DocumentStatus)({
 *   status: "pending",
 *   documentId: "doc-0123456789ab"
 * })
 * console.log(status.status) // "pending"
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DocumentStatus = DocumentStatusDefinition.pipe(
  $I.annoteSchema("DocumentStatus", {
    description: "Canonical discriminated lifecycle state for one document in a batch.",
    toArbitrary: () => S.toArbitrary(DocumentStatusDefinition),
  })
);

/**
 * Runtime value decoded by {@link DocumentStatus}.
 *
 * **Example** (Use DocumentStatus)
 * ```ts
 * import type { DocumentStatus } from "@effect-ontology/Model/BatchWorkflow.ts"
 *
 * const tag = (status: DocumentStatus): DocumentStatus["status"] => status.status
 * console.log(typeof tag) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type DocumentStatus = typeof DocumentStatus.Type;

const BatchIdentityFields = {
  batchId: BatchId.annotateKey({
    description: "Stable content-derived batch identifier.",
  }),
  ontologyId: S.NonEmptyString.annotateKey({
    description: "Ontology routing and scoping identifier.",
  }),
  manifestUri: GcsUri.annotateKey({
    description: "Canonical URI of the input manifest.",
  }),
  ontologyVersion: OntologyVersion.annotateKey({
    description: "Ontology version used by every batch stage.",
  }),
  createdAt: S.DateTimeUtcFromString.annotateKey({
    description: "UTC instant at which the batch was created.",
  }),
  updatedAt: S.DateTimeUtcFromString.annotateKey({
    description: "UTC instant of the latest state update.",
  }),
} as const;

/**
 * Identity and immutable routing context shared by every batch state.
 *
 * **Example** (Use BatchIdentity)
 * ```ts
 * import { DateTime } from "effect"
 * import * as S from "effect/Schema"
 * import { BatchIdentity } from "@effect-ontology/Model/BatchWorkflow.ts"
 *
 * const now = DateTime.formatIso(DateTime.nowUnsafe())
 * const identity = S.decodeUnknownSync(BatchIdentity)({
 *   batchId: "batch-0123456789ab",
 *   ontologyId: "football",
 *   manifestUri: "gs://beep-ontology/manifests/batch.json",
 *   ontologyVersion: "football/premier-league@2026-07-25",
 *   createdAt: now,
 *   updatedAt: now
 * })
 * console.log(identity.ontologyId) // "football"
 * ```
 *
 * @category value-objects
 * @since 0.0.0
 */
export class BatchIdentity extends S.Class<BatchIdentity>($I`BatchIdentity`)(
  BatchIdentityFields,
  $I.annote("BatchIdentity", {
    description: "Stable identity, ontology scope, manifest, and timestamps shared by a batch.",
  })
) {}

const BatchFailureFields = {
  code: S.NonEmptyString,
  message: S.NonEmptyString,
  cause: S.OptionFromOptionalKey(S.Defect({ includeStack: false })).pipe(SchemaUtils.withNoneDefault),
} as const;

class BatchFailure extends S.Class<BatchFailure>($I`BatchFailure`)(
  BatchFailureFields,
  $I.annote("BatchFailure", {
    description: "Stable failure code, user-facing diagnostic, and optional defect cause.",
  })
) {}

const BatchCompletionStatsFields = {
  documentsProcessed: NonNegativeInt,
  documentsSucceeded: NonNegativeInt,
  documentsFailed: NonNegativeInt,
  entitiesExtracted: NonNegativeInt,
  relationsExtracted: NonNegativeInt,
  claimsExtracted: NonNegativeInt,
  clustersResolved: NonNegativeInt,
  triplesIngested: NonNegativeInt,
  totalDurationMs: S.DurationFromMillis,
} as const;

class BatchCompletionStats extends S.Class<BatchCompletionStats>($I`BatchCompletionStats`)(
  BatchCompletionStatsFields,
  $I.annote("BatchCompletionStats", {
    description: "Non-negative completion counts and elapsed duration for a batch.",
  })
) {}

/**
 * Batch lifecycle discriminator used by transition policy.
 *
 * **Example** (Use BatchStage)
 * ```ts
 * import { BatchStage } from "@effect-ontology/Model/BatchWorkflow.ts"
 *
 * console.log(BatchStage.is.Extracting("Extracting")) // true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const BatchStage = LiteralKit([
  "Pending",
  "Preprocessing",
  "Extracting",
  "Resolving",
  "Validating",
  "Ingesting",
  "Complete",
  "Failed",
])
  .annotate({
    toArbitrary: () => (fc) =>
      fc.constantFrom(
        "Pending",
        "Preprocessing",
        "Extracting",
        "Resolving",
        "Validating",
        "Ingesting",
        "Complete",
        "Failed"
      ),
  })
  .annotate(
    $I.annote("BatchStage", {
      description: "Closed ordered lifecycle stages for batch ingestion.",
    })
  );

/**
 * Runtime value accepted by {@link BatchStage}.
 *
 * **Example** (Use BatchStage)
 * ```ts
 * import type { BatchStage } from "@effect-ontology/Model/BatchWorkflow.ts"
 *
 * const stage: BatchStage = "Validating"
 * console.log(stage) // "Validating"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type BatchStage = typeof BatchStage.Type;

const BatchStateDefinition = S.TaggedUnion({
  Pending: {
    ...BatchIdentityFields,
    documentCount: NonNegativeInt,
  },
  Preprocessing: {
    ...BatchIdentityFields,
    documentsTotal: NonNegativeInt,
    documentsClassified: NonNegativeInt,
    documentsFailed: NonNegativeInt,
    enrichedManifestUri: S.OptionFromOptionalKey(GcsUri).pipe(SchemaUtils.withNoneDefault),
  },
  Extracting: {
    ...BatchIdentityFields,
    documentsTotal: NonNegativeInt,
    documentsCompleted: NonNegativeInt,
    documentsFailed: NonNegativeInt,
    currentDocumentId: S.OptionFromOptionalKey(DocumentId).pipe(SchemaUtils.withNoneDefault),
    documentStatuses: S.Array(DocumentStatus).pipe(SchemaUtils.withEmptyArrayDefaults<DocumentStatus>()),
  },
  Resolving: {
    ...BatchIdentityFields,
    extractionOutputUri: GcsUri,
    entitiesTotal: NonNegativeInt,
    clustersFormed: NonNegativeInt,
  },
  Validating: {
    ...BatchIdentityFields,
    resolvedGraphUri: GcsUri,
    validationStartedAt: S.DateTimeUtcFromString,
  },
  Ingesting: {
    ...BatchIdentityFields,
    validatedGraphUri: GcsUri,
    triplesTotal: NonNegativeInt,
    triplesIngested: NonNegativeInt,
  },
  Complete: {
    ...BatchIdentityFields,
    canonicalGraphUri: GcsUri,
    stats: BatchCompletionStats,
    documentStatuses: S.Array(DocumentStatus).pipe(SchemaUtils.withEmptyArrayDefaults<DocumentStatus>()),
    completedAt: S.DateTimeUtcFromString,
  },
  Failed: {
    ...BatchIdentityFields,
    failedAt: S.DateTimeUtcFromString,
    failedInStage: S.Literals(["pending", "preprocessing", "extracting", "resolving", "validating", "ingesting"]),
    error: BatchFailure,
    lastSuccessfulStage: S.OptionFromOptionalKey(
      S.Literals(["pending", "preprocessing", "extracting", "resolving", "validating", "ingesting"])
    ).pipe(SchemaUtils.withNoneDefault),
  },
});

type BatchStateValue = typeof BatchStateDefinition.Type;

const stageEquivalence = S.toEquivalence(BatchStage);
const terminalStages: ReadonlyArray<BatchStage> = ["Complete", "Failed"];
const validTransitions: Readonly<Record<BatchStage, ReadonlyArray<BatchStage>>> = {
  Pending: ["Preprocessing", "Failed"],
  Preprocessing: ["Extracting", "Failed"],
  Extracting: ["Resolving", "Failed"],
  Resolving: ["Validating", "Failed"],
  Validating: ["Ingesting", "Failed"],
  Ingesting: ["Complete", "Failed"],
  Complete: [],
  Failed: [],
};

const progressRatio = (completed: number, total: number, span: number, offset: number): number =>
  Bool.match(total > 0, {
    onFalse: () => offset,
    onTrue: () => Num.sum(offset, Num.round(Num.multiply(Num.divideUnsafe(completed, total), span), 0)),
  });

const stageDisplayName = (state: BatchStateValue): string =>
  BatchStateDefinition.match(state, {
    Pending: () => "Pending",
    Preprocessing: () => "Preprocessing",
    Extracting: () => "Extracting",
    Resolving: () => "Resolving",
    Validating: () => "Validating",
    Ingesting: () => "Ingesting",
    Complete: () => "Complete",
    Failed: () => "Failed",
  });

const progressPercent = (state: BatchStateValue): O.Option<number> =>
  BatchStateDefinition.match(state, {
    Pending: () => O.some(0),
    Preprocessing: (value) => O.some(progressRatio(value.documentsClassified, value.documentsTotal, 10, 0)),
    Extracting: (value) => O.some(progressRatio(value.documentsCompleted, value.documentsTotal, 25, 10)),
    Resolving: () => O.some(45),
    Validating: () => O.some(65),
    Ingesting: (value) => O.some(progressRatio(value.triplesIngested, value.triplesTotal, 25, 75)),
    Complete: () => O.some(100),
    Failed: O.none,
  });

const getError = (state: BatchStateValue): O.Option<BatchFailure> =>
  BatchStateDefinition.match(state, {
    Pending: O.none,
    Preprocessing: O.none,
    Extracting: O.none,
    Resolving: O.none,
    Validating: O.none,
    Ingesting: O.none,
    Complete: O.none,
    Failed: ({ error }) => O.some(error),
  });

const isValidTransition = (from: BatchStage, to: BatchStage): boolean =>
  stageEquivalence(from, to) || A.contains(validTransitions[from], to);

const validateTransition = (from: BatchStage, to: BatchStage): O.Option<string> =>
  Bool.match(isValidTransition(from, to), {
    onTrue: O.none,
    onFalse: () =>
      pipe(
        validTransitions[from],
        A.match({
          onEmpty: () => O.some(`Invalid transition: ${from} is terminal and cannot transition to ${to}.`),
          onNonEmpty: (targets) =>
            O.some(`Invalid transition: ${from} -> ${to}. Valid targets: ${A.join(targets, ", ")}.`),
        })
      ),
  });

/**
 * Canonical batch lifecycle union with schema-owned transition behavior.
 *
 * **Details**
 *
 * * Each stage owns only its legal payload. Shared batch identity is nested under
 * `batch`, and failure/success payloads are unavailable in other variants.
 * Re-entering the same stage is valid for progress-only updates.
 *
 * **Example** (Use BatchState)
 * ```ts
 * import { BatchState } from "@effect-ontology/Model/BatchWorkflow.ts"
 *
 * console.log(BatchState.isValidTransition("Pending", "Preprocessing")) // true
 * console.log(BatchState.isValidTransition("Pending", "Validating")) // false
 * console.log(BatchState.isTerminalStage("Complete")) // true
 * ```
 *
 * @invariant `Complete` and `Failed` are terminal; every non-terminal stage
 * advances only to its immediate successor or `Failed`.
 * @category workflows
 * @since 0.0.0
 */
export const BatchState = BatchStateDefinition.pipe(
  $I.annoteSchema("BatchState", {
    description: "Discriminated batch-ingestion lifecycle with legal stage-specific payloads.",
    toArbitrary: () => S.toArbitrary(BatchStateDefinition),
  }),
  SchemaUtils.withCodecStatics,
  SchemaUtils.withStatics(() => ({
    stageDisplayName,
    progressPercent,
    getError,
    isTerminal: BatchStateDefinition.isAnyOf(["Complete", "Failed"]),
    isTerminalStage: (stage: BatchStage): boolean => A.contains(terminalStages, stage),
    isValidTransition,
    validateTransition,
    isValidStateTransition: (from: BatchStateValue, to: BatchStateValue): boolean =>
      isValidTransition(from._tag, to._tag),
    validNextStages: (stage: BatchStage): ReadonlyArray<BatchStage> => validTransitions[stage],
    canFail: (stage: BatchStage): boolean => A.contains(validTransitions[stage], "Failed"),
  }))
);

/**
 * Runtime value decoded by {@link BatchState}.
 *
 * **Example** (Use BatchState)
 * ```ts
 * import type { BatchState } from "@effect-ontology/Model/BatchWorkflow.ts"
 *
 * const stage = (state: BatchState): BatchState["_tag"] => state._tag
 * console.log(typeof stage) // "function"
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type BatchState = BatchStateValue;
