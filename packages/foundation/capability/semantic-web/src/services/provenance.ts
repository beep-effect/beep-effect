/**
 * Provenance projection and export service contract.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SemanticWebId } from "@beep/identity/packages";
import { LiteralKit, NonNegativeInt } from "@beep/schema";
import { A } from "@beep/utils";
import { Context, Effect, Layer, pipe } from "effect";
import * as S from "effect/Schema";
import { BoundedEvidenceProjection, EvidenceAnchor } from "../evidence.ts";
import {
  Activity,
  Agent,
  Attribution,
  Collection,
  Delegation,
  Derivation,
  End,
  Entity,
  Organization,
  Person,
  Plan,
  PrimarySource,
  ProvBundle,
  Quotation,
  Revision,
  SoftwareAgent,
  Start,
} from "../prov.ts";
import { makeSemanticSchemaMetadata } from "../semantic-schema-metadata.ts";

const $I = $SemanticWebId.create("services/provenance");

const serviceContractMetadata = (canonicalName: string, overview: string) =>
  makeSemanticSchemaMetadata({
    kind: "serviceContract",
    canonicalName,
    overview,
    status: "stable",
    specifications: [{ name: "PROV-O", disposition: "normative" }],
    equivalenceBasis: "Exact bundle, evidence, and bounded projection equality.",
    provenanceProfile: "minimal-core-v1",
    evidenceAnchoring: "Explicit evidence anchors remain first-class.",
    timeSemantics: "Lifecycle fields remain explicit adjuncts.",
  });

/**
 * Provenance export profile.
 *
 * **Example** (Decode export profile value)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { ProvenanceExportProfile } from "@beep/semantic-web/services/provenance"
 *
 * const profile = S.decodeUnknownSync(ProvenanceExportProfile)("prov-core-v1")
 * strictEqual(profile, "prov-core-v1")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProvenanceExportProfile = LiteralKit(["prov-core-v1", "prov-core-extensions-v1"]).pipe(
  $I.annoteSchema("ProvenanceExportProfile", {
    description: "Provenance export profile.",
  })
);

/**
 * Type for {@link ProvenanceExportProfile}.
 *
 * **Example** (Type-check export profile)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { ProvenanceExportProfile } from "@beep/semantic-web/services/provenance"
 *
 * const profile: ProvenanceExportProfile = "prov-core-v1"
 * strictEqual(ProvenanceExportProfile.is["prov-core-v1"](profile), true)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type ProvenanceExportProfile = typeof ProvenanceExportProfile.Type;

/**
 * Provenance service error reason.
 *
 * **Example** (Decode error reason value)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { ProvenanceServiceErrorReason } from "@beep/semantic-web/services/provenance"
 *
 * const reason = S.decodeUnknownSync(ProvenanceServiceErrorReason)("projectionLimit")
 * strictEqual(reason, "projectionLimit")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ProvenanceServiceErrorReason = LiteralKit([
  "missingEvidenceAnchor",
  "unsupportedProfile",
  "projectionLimit",
]).pipe(
  $I.annoteSchema("ProvenanceServiceErrorReason", {
    description: "Provenance service error reason.",
    semanticSchemaMetadata: serviceContractMetadata("ProvenanceServiceErrorReason", "Provenance service error reason."),
  })
);

/**
 * Type for {@link ProvenanceServiceErrorReason}.
 *
 * **Example** (Type-check error reason)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { ProvenanceServiceErrorReason } from "@beep/semantic-web/services/provenance"
 *
 * const reason: ProvenanceServiceErrorReason = "projectionLimit"
 * strictEqual(ProvenanceServiceErrorReason.is.projectionLimit(reason), true)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export type ProvenanceServiceErrorReason = typeof ProvenanceServiceErrorReason.Type;

/**
 * Provenance projection request.
 *
 * **Example** (Decode projection request)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { ProjectProvenanceRequest } from "@beep/semantic-web/services/provenance"
 *
 * const request = S.decodeUnknownSync(ProjectProvenanceRequest)({
 *   bundle: { records: [] },
 *   anchors: [],
 *   maxItems: 25
 * })
 * strictEqual(request.maxItems, 25)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProjectProvenanceRequest extends S.Class<ProjectProvenanceRequest>($I`ProjectProvenanceRequest`)(
  {
    bundle: ProvBundle,
    anchors: S.Array(EvidenceAnchor),
    maxItems: NonNegativeInt,
  },
  $I.annote("ProjectProvenanceRequest", {
    description: "Provenance projection request.",
    semanticSchemaMetadata: serviceContractMetadata("ProjectProvenanceRequest", "Provenance projection request."),
  })
) {}

/**
 * Provenance summary request.
 *
 * **Example** (Decode summary request)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { SummarizeProvenanceRequest } from "@beep/semantic-web/services/provenance"
 *
 * const request = S.decodeUnknownSync(SummarizeProvenanceRequest)({
 *   bundle: { records: [] },
 *   anchors: []
 * })
 * strictEqual(request.bundle.records.length, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SummarizeProvenanceRequest extends S.Class<SummarizeProvenanceRequest>($I`SummarizeProvenanceRequest`)(
  {
    bundle: ProvBundle,
    anchors: S.Array(EvidenceAnchor),
  },
  $I.annote("SummarizeProvenanceRequest", {
    description: "Provenance summary request.",
    semanticSchemaMetadata: serviceContractMetadata("SummarizeProvenanceRequest", "Provenance summary request."),
  })
) {}

/**
 * Provenance export request.
 *
 * **Example** (Decode export request)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { ExportProvenanceRequest } from "@beep/semantic-web/services/provenance"
 *
 * const request = S.decodeUnknownSync(ExportProvenanceRequest)({
 *   bundle: { records: [] },
 *   anchors: [],
 *   profile: "prov-core-v1",
 *   maxItems: 10
 * })
 * strictEqual(request.profile, "prov-core-v1")
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ExportProvenanceRequest extends S.Class<ExportProvenanceRequest>($I`ExportProvenanceRequest`)(
  {
    bundle: ProvBundle,
    anchors: S.Array(EvidenceAnchor),
    profile: ProvenanceExportProfile,
    maxItems: NonNegativeInt,
  },
  $I.annote("ExportProvenanceRequest", {
    description: "Provenance export request.",
    semanticSchemaMetadata: serviceContractMetadata("ExportProvenanceRequest", "Provenance export request."),
  })
) {}

/**
 * Bounded provenance projection result.
 *
 * **Example** (Decode bounded projection)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { BoundedProvenanceProjection } from "@beep/semantic-web/services/provenance"
 *
 * const projection = S.decodeUnknownSync(BoundedProvenanceProjection)({
 *   bundle: { records: [] },
 *   evidence: { anchors: [], truncated: false },
 *   truncated: false
 * })
 * strictEqual(projection.truncated, false)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoundedProvenanceProjection extends S.Class<BoundedProvenanceProjection>($I`BoundedProvenanceProjection`)(
  {
    bundle: ProvBundle,
    evidence: BoundedEvidenceProjection,
    truncated: S.Boolean,
  },
  $I.annote("BoundedProvenanceProjection", {
    description: "Bounded provenance projection result.",
    semanticSchemaMetadata: serviceContractMetadata(
      "BoundedProvenanceProjection",
      "Bounded provenance projection result."
    ),
  })
) {}

/**
 * Provenance summary result.
 *
 * **Example** (Decode provenance summary)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import * as S from "effect/Schema"
 * import { ProvenanceSummary } from "@beep/semantic-web/services/provenance"
 *
 * const summary = S.decodeUnknownSync(ProvenanceSummary)({
 *   recordCount: 0,
 *   entityCount: 0,
 *   activityCount: 0,
 *   agentCount: 0,
 *   anchorCount: 0
 * })
 * strictEqual(summary.recordCount, 0)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ProvenanceSummary extends S.Class<ProvenanceSummary>($I`ProvenanceSummary`)(
  {
    recordCount: NonNegativeInt,
    entityCount: NonNegativeInt,
    activityCount: NonNegativeInt,
    agentCount: NonNegativeInt,
    anchorCount: NonNegativeInt,
  },
  $I.annote("ProvenanceSummary", {
    description: "Provenance summary result.",
    semanticSchemaMetadata: serviceContractMetadata("ProvenanceSummary", "Provenance summary result."),
  })
) {}

/**
 * Typed provenance service error.
 *
 * **Example** (Make service error)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { ProvenanceServiceError } from "@beep/semantic-web/services/provenance"
 *
 * const error = ProvenanceServiceError.make({
 *   reason: "missingEvidenceAnchor",
 *   message: "Projection requests with records require explicit evidence anchors."
 * })
 * strictEqual(error.reason, "missingEvidenceAnchor")
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ProvenanceServiceError extends S.TaggedError<ProvenanceServiceError>($I`ProvenanceServiceError`)(
  "ProvenanceServiceError",
  {
    reason: ProvenanceServiceErrorReason,
    message: S.String,
  },
  $I.annote("ProvenanceServiceError", {
    description: "Typed provenance service error.",
    semanticSchemaMetadata: serviceContractMetadata("ProvenanceServiceError", "Typed provenance service error."),
  })
) {}

/**
 * Provenance service contract shape.
 *
 * **Example** (Accept service shape type)
 *
 * ```ts
 * import type { ProvenanceServiceShape } from "@beep/semantic-web/services/provenance"
 *
 * const acceptProvenanceServiceShape = (value: ProvenanceServiceShape) => value
 * console.log(acceptProvenanceServiceShape)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export interface ProvenanceServiceShape {
  readonly exportBundle: (
    request: ExportProvenanceRequest
  ) => Effect.Effect<BoundedProvenanceProjection, ProvenanceServiceError>;
  readonly project: (
    request: ProjectProvenanceRequest
  ) => Effect.Effect<BoundedProvenanceProjection, ProvenanceServiceError>;
  readonly summarize: (request: SummarizeProvenanceRequest) => Effect.Effect<ProvenanceSummary, ProvenanceServiceError>;
}

/**
 * Provenance service tag.
 *
 * **Example** (Provide mock service tag)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import {
 *   ProvenanceService,
 *   ProvenanceSummary,
 *   SummarizeProvenanceRequest
 * } from "@beep/semantic-web/services/provenance"
 *
 * const request = S.decodeUnknownSync(SummarizeProvenanceRequest)({
 *   bundle: { records: [] },
 *   anchors: []
 * })
 * const program = Effect.gen(function* () {
 *   const service = yield* ProvenanceService
 *   return yield* service.summarize(request)
 * })
 *
 * const summary = Effect.runSync(
 *   Effect.provideService(
 *     program,
 *     ProvenanceService,
 *     ProvenanceService.of({
 *       exportBundle: () => Effect.die("not used"),
 *       project: () => Effect.die("not used"),
 *       summarize: () =>
 *         Effect.succeed(
 *           S.decodeUnknownSync(ProvenanceSummary)({
 *             recordCount: 0,
 *             entityCount: 0,
 *             activityCount: 0,
 *             agentCount: 0,
 *             anchorCount: 0
 *           })
 *         )
 *     })
 *   )
 * )
 * strictEqual(summary.recordCount, 0)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class ProvenanceService extends Context.Service<ProvenanceService, ProvenanceServiceShape>()(
  $I`ProvenanceService`
) {}

type ProvRecord = ProvBundle["records"][number];

const takeUpTo = A.take;

const isEntityRecord = S.is(Entity);
const isActivityRecord = S.is(Activity);
const isAgentRecord = S.is(Agent);
const isSoftwareAgentRecord = S.is(SoftwareAgent);

const extensionTierRecordGuards: ReadonlyArray<(record: ProvRecord) => boolean> = [
  S.is(Plan),
  S.is(Collection),
  S.is(Person),
  S.is(Organization),
  S.is(Attribution),
  S.is(Delegation),
  S.is(Derivation),
  S.is(PrimarySource),
  S.is(Quotation),
  S.is(Revision),
  S.is(Start),
  S.is(End),
];

const isExtensionTierRecord = (record: ProvRecord): boolean =>
  pipe(
    extensionTierRecordGuards,
    A.some((guard) => guard(record))
  );

const countRecords = (
  records: ReadonlyArray<ProvRecord>,
  predicate: (record: ProvRecord) => boolean
): Effect.Effect<NonNegativeInt, ProvenanceServiceError> =>
  decodeNonNegativeInt(
    pipe(
      records,
      A.reduce(0, (count, record) => (predicate(record) ? count + 1 : count))
    ),
    "record count"
  );

const decodeNonNegativeInt = (value: number, label: string): Effect.Effect<NonNegativeInt, ProvenanceServiceError> =>
  S.decodeEffect(NonNegativeInt)(value).pipe(
    Effect.mapError((cause) =>
      ProvenanceServiceError.make({
        reason: "projectionLimit",
        message: `Failed to decode non-negative ${label}: ${String(cause)}`,
      })
    )
  );

const createProjection = (
  bundle: ProvBundle,
  anchors: ReadonlyArray<EvidenceAnchor>,
  maxItems: number
): BoundedProvenanceProjection => {
  const limitedRecords = takeUpTo(bundle.records, maxItems);
  const limitedAnchors = takeUpTo(anchors, maxItems);
  const truncated = bundle.records.length > maxItems || anchors.length > maxItems;

  return BoundedProvenanceProjection.make({
    bundle: ProvBundle.make({
      records: limitedRecords,
      lifecycle: bundle.lifecycle,
    }),
    evidence: BoundedEvidenceProjection.make({
      anchors: limitedAnchors,
      truncated,
    }),
    truncated,
  });
};

/**
 * Live provenance service implementation for bounded projection and summary work.
 *
 * **Example** (Run live summarize layer)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { Effect } from "effect"
 * import * as S from "effect/Schema"
 * import {
 *   ProvenanceService,
 *   ProvenanceServiceLive,
 *   SummarizeProvenanceRequest
 * } from "@beep/semantic-web/services/provenance"
 *
 * const request = S.decodeUnknownSync(SummarizeProvenanceRequest)({
 *   bundle: { records: [] },
 *   anchors: []
 * })
 * const summary = Effect.runSync(
 *   Effect.gen(function* () {
 *     const service = yield* ProvenanceService
 *     return yield* service.summarize(request)
 *   }).pipe(Effect.provide(ProvenanceServiceLive))
 * )
 * strictEqual(summary.recordCount, 0)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ProvenanceServiceLive = Layer.succeed(
  ProvenanceService,
  ProvenanceService.of({
    project: Effect.fn(function* (request: ProjectProvenanceRequest) {
      if (request.bundle.records.length > 0 && request.anchors.length === 0) {
        return yield* ProvenanceServiceError.make({
          reason: "missingEvidenceAnchor",
          message: "Bounded provenance projections require explicit evidence anchors.",
        });
      }

      return createProjection(request.bundle, request.anchors, request.maxItems);
    }),
    summarize: Effect.fn(function* (request: SummarizeProvenanceRequest) {
      return ProvenanceSummary.make({
        recordCount: yield* decodeNonNegativeInt(request.bundle.records.length, "record count"),
        entityCount: yield* countRecords(request.bundle.records, isEntityRecord),
        activityCount: yield* countRecords(request.bundle.records, isActivityRecord),
        agentCount: yield* countRecords(
          request.bundle.records,
          (record) => isAgentRecord(record) || isSoftwareAgentRecord(record)
        ),
        anchorCount: yield* decodeNonNegativeInt(request.anchors.length, "anchor count"),
      });
    }),
    exportBundle: Effect.fn(function* (request: ExportProvenanceRequest) {
      if (request.profile === "prov-core-v1" && pipe(request.bundle.records, A.some(isExtensionTierRecord))) {
        return yield* ProvenanceServiceError.make({
          reason: "unsupportedProfile",
          message: "prov-core-v1 does not include extension-tier provenance records.",
        });
      }

      return createProjection(request.bundle, request.anchors, request.maxItems);
    }),
  })
);
