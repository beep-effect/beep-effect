/**
 * Worker-safe ontology agent toolkit contracts.
 *
 * @packageDocumentation
 * @category tools
 * @since 0.0.0
 */

import { $OntologyUseCasesId } from "@beep/identity/packages";
import { annotateFourHints, destructiveWriteToolHints, readOnlyToolHints } from "@beep/mcp-kit";
import { ChangeOperation, SessionChangeDelta, SessionId } from "@beep/ontology-domain/aggregates/Session";
import { PrefixMap } from "@beep/rdf/Rdf";
import { LiteralKit, NonNegativeInt, SchemaUtils, Sha256Hex, TaggedErrorClass } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { Tool, Toolkit } from "effect/unstable/ai";
import { OntologyFilePath } from "../aggregates/Session/Session.ports.js";
import {
  OntologyResourceSummary,
  OntologySnapshot,
  OntologyViewMode,
} from "../aggregates/Session/Session.projections.js";
import { RunOntologySparqlResult } from "../aggregates/Session/Session.sparql.js";
import { OntologyRepairProposal, RunOntologyValidationResult } from "../aggregates/Session/Session.validation.js";

const $I = $OntologyUseCasesId.create("tools/OntologyToolkit");

const OptionalSessionHandle = S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault);
const OptionalBaseIri = S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault);

/**
 * Semantic rdfc-1.0 fingerprint used by stateless ontology CAS.
 *
 * @example
 * ```ts
 * import { OntologyFingerprint } from "@beep/ontology-use-cases/tools"
 * const fingerprint = OntologyFingerprint.make("0".repeat(64))
 * console.log(fingerprint.length) // 64
 * ```
 *
 * @category tool-schemas
 * @since 0.0.0
 */
export const OntologyFingerprint = Sha256Hex.pipe(
  S.brand("OntologyFingerprint"),
  $I.annoteSchema("OntologyFingerprint", {
    description: "Semantic rdfc-1.0 fingerprint used by stateless ontology compare-and-set writes.",
  })
);

/** Type for {@link OntologyFingerprint}.
 * @example
 * ```ts
 * import { OntologyFingerprint } from "@beep/ontology-use-cases/tools"
 * const value: OntologyFingerprint = OntologyFingerprint.make("0".repeat(64))
 * console.log(value.length)
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export type OntologyFingerprint = typeof OntologyFingerprint.Type;

/** Server-owned ontology tool ceilings.
 * @example
 * ```ts
 * import { ontologyToolBudgets } from "@beep/ontology-use-cases/tools"
 * console.log(ontologyToolBudgets.maxChangeOperations) // 256
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export class OntologyToolBudgets extends S.Class<OntologyToolBudgets>($I`OntologyToolBudgets`)(
  {
    maxChangeOperations: NonNegativeInt,
    maxQueryResults: NonNegativeInt,
    maxSearchResults: NonNegativeInt,
    maxValidationResults: NonNegativeInt,
    reasonerDriftCap: NonNegativeInt,
  },
  $I.annote("OntologyToolBudgets", { description: "Server-owned static ceilings for ontology tools." })
) {}

/** Immutable ontology tool budget defaults.
 * @example
 * ```ts
 * import { ontologyToolBudgets } from "@beep/ontology-use-cases/tools"
 * console.log(ontologyToolBudgets.maxQueryResults) // 200
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export const ontologyToolBudgets = OntologyToolBudgets.make({
  maxChangeOperations: NonNegativeInt.make(256),
  maxQueryResults: NonNegativeInt.make(200),
  maxSearchResults: NonNegativeInt.make(100),
  maxValidationResults: NonNegativeInt.make(100),
  reasonerDriftCap: NonNegativeInt.make(64),
});

/** Budget family refused by the toolkit.
 * @example
 * ```ts
 * import { OntologyBudgetKind } from "@beep/ontology-use-cases/tools"
 * console.log(OntologyBudgetKind.is.changeOperations("changeOperations"))
 * ```
 * @category errors
 * @since 0.0.0
 */
export const OntologyBudgetKind = LiteralKit([
  "changeOperations",
  "queryResults",
  "searchResults",
  "validationResults",
]).pipe($I.annoteSchema("OntologyBudgetKind", { description: "Server-owned ontology budget family." }));

/** Type for {@link OntologyBudgetKind}.
 * @example
 * ```ts
 * import type { OntologyBudgetKind } from "@beep/ontology-use-cases/tools"
 * const kind: OntologyBudgetKind = "queryResults"
 * console.log(kind)
 * ```
 * @category errors
 * @since 0.0.0
 */
export type OntologyBudgetKind = typeof OntologyBudgetKind.Type;

/** Recoverable semantic CAS conflict.
 * @example
 * ```ts
 * import { OntologyCasConflict } from "@beep/ontology-use-cases/tools"
 * console.log(OntologyCasConflict.fields.currentFingerprint)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class OntologyCasConflict extends TaggedErrorClass<OntologyCasConflict>($I`OntologyCasConflict`)(
  "OntologyCasConflict",
  {
    expectedFingerprint: OntologyFingerprint,
    currentFingerprint: OntologyFingerprint,
    guidance: S.NonEmptyString,
    recoverable: S.Literal(true),
  },
  $I.annote("OntologyCasConflict", { description: "Recoverable rdfc-1.0 compare-and-set conflict." })
) {}

/** Recoverable static budget refusal.
 * @example
 * ```ts
 * import { OntologyBudgetRefusal } from "@beep/ontology-use-cases/tools"
 * console.log(OntologyBudgetRefusal.fields.limit)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class OntologyBudgetRefusal extends TaggedErrorClass<OntologyBudgetRefusal>($I`OntologyBudgetRefusal`)(
  "OntologyBudgetRefusal",
  {
    kind: OntologyBudgetKind,
    actual: NonNegativeInt,
    limit: NonNegativeInt,
    guidance: S.NonEmptyString,
    recoverable: S.Literal(true),
  },
  $I.annote("OntologyBudgetRefusal", {
    description: "Recoverable refusal when a server-owned ontology budget is exceeded.",
  })
) {}

/** Recoverable reasoner drift-cap refusal.
 * @example
 * ```ts
 * import { OntologyReasonerDriftRefusal } from "@beep/ontology-use-cases/tools"
 * console.log(OntologyReasonerDriftRefusal.fields.cap)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class OntologyReasonerDriftRefusal extends TaggedErrorClass<OntologyReasonerDriftRefusal>(
  $I`OntologyReasonerDriftRefusal`
)(
  "OntologyReasonerDriftRefusal",
  {
    actual: NonNegativeInt,
    cap: NonNegativeInt,
    guidance: S.NonEmptyString,
    recoverable: S.Literal(true),
  },
  $I.annote("OntologyReasonerDriftRefusal", {
    description: "Recoverable refusal that prevents an unbounded reasoner recompute.",
  })
) {}

/** Explicit refusal for a change batch with no real delta.
 * @example
 * ```ts
 * import { OntologyNoOpRefusal } from "@beep/ontology-use-cases/tools"
 * const error = OntologyNoOpRefusal.make({ guidance: "Refetch before proposing another change.", recoverable: true })
 * console.log(error._tag)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class OntologyNoOpRefusal extends TaggedErrorClass<OntologyNoOpRefusal>($I`OntologyNoOpRefusal`)(
  "OntologyNoOpRefusal",
  { guidance: S.NonEmptyString, recoverable: S.Literal(true) },
  $I.annote("OntologyNoOpRefusal", {
    description: "Visible refusal for an ontology mutation that would have no effect.",
  })
) {}

/** Typed execution failure from a real ontology layer.
 * @example
 * ```ts
 * import { OntologyToolExecutionError } from "@beep/ontology-use-cases/tools"
 * const error = OntologyToolExecutionError.make({ operation: "open-inspect", message: "The file could not be opened.", recoverable: false })
 * console.log(error.operation)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class OntologyToolExecutionError extends TaggedErrorClass<OntologyToolExecutionError>(
  $I`OntologyToolExecutionError`
)(
  "OntologyToolExecutionError",
  { operation: S.NonEmptyString, message: S.NonEmptyString, recoverable: S.Boolean },
  $I.annote("OntologyToolExecutionError", { description: "Typed safe execution failure returned by an ontology tool." })
) {}

/** Returned ontology tool failure union.
 * @example
 * ```ts
 * import { OntologyToolFailure } from "@beep/ontology-use-cases/tools"
 * console.log(OntologyToolFailure)
 * ```
 * @category errors
 * @since 0.0.0
 */
export const OntologyToolFailure = S.Union([
  OntologyCasConflict,
  OntologyBudgetRefusal,
  OntologyReasonerDriftRefusal,
  OntologyNoOpRefusal,
  OntologyToolExecutionError,
]).pipe($I.annoteSchema("OntologyToolFailure", { description: "Failure returned by the ontology agent toolkit." }));

/** Type for {@link OntologyToolFailure}.
 * @example
 * ```ts
 * import type { OntologyToolFailure } from "@beep/ontology-use-cases/tools"
 * const show = (failure: OntologyToolFailure) => failure._tag
 * console.log(show)
 * ```
 * @category errors
 * @since 0.0.0
 */
export type OntologyToolFailure = typeof OntologyToolFailure.Type;

/** Open/inspect request.
 * @example
 * ```ts
 * import { OpenInspectRequest } from "@beep/ontology-use-cases/tools"
 * console.log(OpenInspectRequest.fields.path)
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export class OpenInspectRequest extends S.Class<OpenInspectRequest>($I`OpenInspectRequest`)(
  { path: OntologyFilePath, baseIri: OptionalBaseIri, sessionHandle: OptionalSessionHandle },
  $I.annote("OpenInspectRequest", { description: "Open and inspect a saved Turtle ontology." })
) {}

/** Open/inspect response.
 * @example
 * ```ts
 * import { OpenInspectResponse } from "@beep/ontology-use-cases/tools"
 * console.log(OpenInspectResponse)
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export class OpenInspectResponse extends S.Class<OpenInspectResponse>($I`OpenInspectResponse`)(
  {
    path: OntologyFilePath,
    sessionId: SessionId,
    fingerprint: OntologyFingerprint,
    quadCount: NonNegativeInt,
    prefixes: PrefixMap,
  },
  $I.annote("OpenInspectResponse", { description: "Inspection metadata for a saved Turtle ontology." })
) {}

/** Snapshot/describe request.
 * @example
 * ```ts
 * import { SnapshotDescribeRequest } from "@beep/ontology-use-cases/tools"
 * console.log(SnapshotDescribeRequest.fields.path)
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export class SnapshotDescribeRequest extends S.Class<SnapshotDescribeRequest>($I`SnapshotDescribeRequest`)(
  { path: OntologyFilePath, baseIri: OptionalBaseIri, sessionHandle: OptionalSessionHandle },
  $I.annote("SnapshotDescribeRequest", { description: "Describe the read model of a saved Turtle ontology." })
) {}

/** Snapshot/describe response.
 * @example
 * ```ts
 * import { SnapshotDescribeResponse } from "@beep/ontology-use-cases/tools"
 * console.log(SnapshotDescribeResponse)
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export class SnapshotDescribeResponse extends S.Class<SnapshotDescribeResponse>($I`SnapshotDescribeResponse`)(
  { fingerprint: OntologyFingerprint, snapshot: OntologySnapshot },
  $I.annote("SnapshotDescribeResponse", { description: "Ontology snapshot with the source semantic fingerprint." })
) {}

/** Search request with no caller-owned result ceiling.
 * @example
 * ```ts
 * import { OntologySearchRequest } from "@beep/ontology-use-cases/tools"
 * console.log(OntologySearchRequest.fields.query)
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export class OntologySearchRequest extends S.Class<OntologySearchRequest>($I`OntologySearchRequest`)(
  {
    path: OntologyFilePath,
    baseIri: OptionalBaseIri,
    sessionHandle: OptionalSessionHandle,
    query: S.String,
    mode: OntologyViewMode.pipe(
      S.withConstructorDefault(Effect.succeed(OntologyViewMode.make("all"))),
      S.withDecodingDefaultKey(Effect.succeed(OntologyViewMode.make("all")))
    ),
  },
  $I.annote("OntologySearchRequest", { description: "Search resources in a saved Turtle ontology." })
) {}

/** Bounded ontology search response.
 * @example
 * ```ts
 * import { OntologySearchResponse } from "@beep/ontology-use-cases/tools"
 * console.log(OntologySearchResponse)
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export class OntologySearchResponse extends S.Class<OntologySearchResponse>($I`OntologySearchResponse`)(
  {
    fingerprint: OntologyFingerprint,
    results: S.Array(OntologyResourceSummary),
    resultCount: NonNegativeInt,
    truncated: S.Boolean,
  },
  $I.annote("OntologySearchResponse", { description: "Server-bounded ontology resource search results." })
) {}

/** SPARQL query request with server-owned safeguards.
 * @example
 * ```ts
 * import { OntologySparqlQueryRequest } from "@beep/ontology-use-cases/tools"
 * console.log(OntologySparqlQueryRequest.fields.profile)
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export class OntologySparqlQueryRequest extends S.Class<OntologySparqlQueryRequest>($I`OntologySparqlQueryRequest`)(
  {
    path: OntologyFilePath,
    baseIri: OptionalBaseIri,
    sessionHandle: OptionalSessionHandle,
    profile: LiteralKit(["select", "construct"]),
    query: S.NonEmptyString,
    includeInferred: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
  },
  $I.annote("OntologySparqlQueryRequest", { description: "Run a bounded SPARQL query over a saved Turtle ontology." })
) {}

/** SPARQL query response.
 * @example
 * ```ts
 * import { OntologySparqlQueryResponse } from "@beep/ontology-use-cases/tools"
 * console.log(OntologySparqlQueryResponse)
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export class OntologySparqlQueryResponse extends S.Class<OntologySparqlQueryResponse>($I`OntologySparqlQueryResponse`)(
  { fingerprint: OntologyFingerprint, query: RunOntologySparqlResult },
  $I.annote("OntologySparqlQueryResponse", {
    description: "Bounded SPARQL result with the source semantic fingerprint.",
  })
) {}

/** CAS-safe typed change batch request.
 * @example
 * ```ts
 * import { ProposeChangeBatchRequest } from "@beep/ontology-use-cases/tools"
 * console.log(ProposeChangeBatchRequest)
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export class ProposeChangeBatchRequest extends S.Class<ProposeChangeBatchRequest>($I`ProposeChangeBatchRequest`)(
  {
    path: OntologyFilePath,
    baseIri: OptionalBaseIri,
    sessionHandle: OptionalSessionHandle,
    expectedFingerprint: OntologyFingerprint,
    operations: S.NonEmptyArray(ChangeOperation),
  },
  $I.annote("ProposeChangeBatchRequest", { description: "Apply and CAS-save a typed ontology change batch." })
) {}

/** CAS-safe typed change batch response.
 * @example
 * ```ts
 * import { ProposeChangeBatchResponse } from "@beep/ontology-use-cases/tools"
 * console.log(ProposeChangeBatchResponse)
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export class ProposeChangeBatchResponse extends S.Class<ProposeChangeBatchResponse>($I`ProposeChangeBatchResponse`)(
  {
    path: OntologyFilePath,
    previousFingerprint: OntologyFingerprint,
    currentFingerprint: OntologyFingerprint,
    appliedOperations: S.NonEmptyArray(ChangeOperation),
    delta: SessionChangeDelta,
  },
  $I.annote("ProposeChangeBatchResponse", {
    description: "Saved ontology change batch with real added and removed deltas.",
  })
) {}

/** SHACL validation request.
 * @example
 * ```ts
 * import { ValidateOntologyRequest } from "@beep/ontology-use-cases/tools"
 * console.log(ValidateOntologyRequest.fields.path)
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export class ValidateOntologyRequest extends S.Class<ValidateOntologyRequest>($I`ValidateOntologyRequest`)(
  {
    path: OntologyFilePath,
    baseIri: OptionalBaseIri,
    sessionHandle: OptionalSessionHandle,
    includeInferred: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
  },
  $I.annote("ValidateOntologyRequest", { description: "Run bounded real-engine SHACL validation." })
) {}

/** SHACL validation response.
 * @example
 * ```ts
 * import { ValidateOntologyResponse } from "@beep/ontology-use-cases/tools"
 * console.log(ValidateOntologyResponse)
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export class ValidateOntologyResponse extends S.Class<ValidateOntologyResponse>($I`ValidateOntologyResponse`)(
  { fingerprint: OntologyFingerprint, result: RunOntologyValidationResult },
  $I.annote("ValidateOntologyResponse", {
    description: "Bounded SHACL validation result and verified repair proposals.",
  })
) {}

/** Verified repair request.
 * @example
 * ```ts
 * import { RepairOntologyRequest } from "@beep/ontology-use-cases/tools"
 * console.log(RepairOntologyRequest)
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export class RepairOntologyRequest extends S.Class<RepairOntologyRequest>($I`RepairOntologyRequest`)(
  {
    path: OntologyFilePath,
    baseIri: OptionalBaseIri,
    sessionHandle: OptionalSessionHandle,
    expectedFingerprint: OntologyFingerprint,
    proposalId: S.NonEmptyString,
  },
  $I.annote("RepairOntologyRequest", {
    description: "Revalidate, select, apply, and CAS-save a P0-registry verified repair proposal.",
  })
) {}

/** Verified repair response.
 * @example
 * ```ts
 * import { RepairOntologyResponse } from "@beep/ontology-use-cases/tools"
 * console.log(RepairOntologyResponse)
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export class RepairOntologyResponse extends S.Class<RepairOntologyResponse>($I`RepairOntologyResponse`)(
  { proposal: OntologyRepairProposal, change: ProposeChangeBatchResponse, validation: RunOntologyValidationResult },
  $I.annote("RepairOntologyResponse", { description: "Applied verified repair with post-save SHACL validation." })
) {}

/** Provenance sidecar export request.
 * @example
 * ```ts
 * import { ExportProvenanceRequest } from "@beep/ontology-use-cases/tools"
 * console.log(ExportProvenanceRequest.fields.provPath)
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export class ExportProvenanceRequest extends S.Class<ExportProvenanceRequest>($I`ExportProvenanceRequest`)(
  {
    path: OntologyFilePath,
    baseIri: OptionalBaseIri,
    sessionHandle: OptionalSessionHandle,
    expectedFingerprint: OntologyFingerprint,
    provPath: OntologyFilePath,
    datasetPath: OntologyFilePath,
  },
  $I.annote("ExportProvenanceRequest", { description: "Export PROV-O and dataset-description Turtle sidecars." })
) {}

/** Provenance sidecar export response.
 * @example
 * ```ts
 * import { ExportProvenanceResponse } from "@beep/ontology-use-cases/tools"
 * console.log(ExportProvenanceResponse)
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export class ExportProvenanceResponse extends S.Class<ExportProvenanceResponse>($I`ExportProvenanceResponse`)(
  { fingerprint: OntologyFingerprint, provPath: OntologyFilePath, datasetPath: OntologyFilePath },
  $I.annote("ExportProvenanceResponse", { description: "Written ontology provenance sidecar locations." })
) {}

/** Capability metadata request.
 * @example
 * ```ts
 * import { CapabilityMetadataRequest } from "@beep/ontology-use-cases/tools"
 * console.log(CapabilityMetadataRequest.make({}))
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export class CapabilityMetadataRequest extends S.Class<CapabilityMetadataRequest>($I`CapabilityMetadataRequest`)(
  { sessionHandle: OptionalSessionHandle },
  $I.annote("CapabilityMetadataRequest", { description: "Request ontology toolkit capability metadata." })
) {}

/** One advertised ontology tool capability.
 * @example
 * ```ts
 * import { OntologyToolCapability } from "@beep/ontology-use-cases/tools"
 * console.log(OntologyToolCapability.make({ name: "ontology-search", mutating: false }).name)
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export class OntologyToolCapability extends S.Class<OntologyToolCapability>($I`OntologyToolCapability`)(
  { name: S.NonEmptyString, mutating: S.Boolean },
  $I.annote("OntologyToolCapability", { description: "Advertised ontology agent tool capability." })
) {}

/** Capability metadata response.
 * @example
 * ```ts
 * import { CapabilityMetadataResponse } from "@beep/ontology-use-cases/tools"
 * console.log(CapabilityMetadataResponse)
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export class CapabilityMetadataResponse extends S.Class<CapabilityMetadataResponse>($I`CapabilityMetadataResponse`)(
  {
    capabilities: S.Array(OntologyToolCapability),
    budgets: OntologyToolBudgets,
    casAlgorithm: S.Literal("rdfc-1.0"),
    casSemantics: S.Literal("semantic"),
    stateless: S.Literal(true),
    reasonerProfile: S.Literal("structural-rdfs-owl-rl-subset"),
  },
  $I.annote("CapabilityMetadataResponse", { description: "Actual ontology toolkit limits and semantics." })
) {}

const makeTool = <Name extends string, Parameters extends S.Top, Success extends S.Top>(
  name: Name,
  description: string,
  parameters: Parameters,
  success: Success,
  mutating: boolean
) =>
  annotateFourHints(
    Tool.make(name, { description, parameters, success, failure: OntologyToolFailure, failureMode: "return" }),
    mutating ? destructiveWriteToolHints : readOnlyToolHints
  );

/** Open and inspect tool declaration.
 * @example
 * ```ts
 * import { OpenInspectTool } from "@beep/ontology-use-cases/tools"
 * console.log(OpenInspectTool.name)
 * ```
 * @category tools
 * @since 0.0.0
 */
export const OpenInspectTool = makeTool(
  "ontology_open_inspect",
  "Open and inspect a saved Turtle ontology.",
  OpenInspectRequest,
  OpenInspectResponse,
  false
);
/** Snapshot and describe tool declaration.
 * @example
 * ```ts
 * import { SnapshotDescribeTool } from "@beep/ontology-use-cases/tools"
 * console.log(SnapshotDescribeTool.name)
 * ```
 * @category tools
 * @since 0.0.0
 */
export const SnapshotDescribeTool = makeTool(
  "ontology_snapshot_describe",
  "Describe a saved ontology read model.",
  SnapshotDescribeRequest,
  SnapshotDescribeResponse,
  false
);
/** Search tool declaration.
 * @example
 * ```ts
 * import { OntologySearchTool } from "@beep/ontology-use-cases/tools"
 * console.log(OntologySearchTool.name)
 * ```
 * @category tools
 * @since 0.0.0
 */
export const OntologySearchTool = makeTool(
  "ontology_search",
  "Search resources in a saved ontology.",
  OntologySearchRequest,
  OntologySearchResponse,
  false
);
/** SPARQL tool declaration.
 * @example
 * ```ts
 * import { OntologySparqlQueryTool } from "@beep/ontology-use-cases/tools"
 * console.log(OntologySparqlQueryTool.name)
 * ```
 * @category tools
 * @since 0.0.0
 */
export const OntologySparqlQueryTool = makeTool(
  "ontology_sparql_query",
  "Run a bounded SPARQL query.",
  OntologySparqlQueryRequest,
  OntologySparqlQueryResponse,
  false
);
/** Change-batch tool declaration.
 * @example
 * ```ts
 * import { ProposeChangeBatchTool } from "@beep/ontology-use-cases/tools"
 * console.log(ProposeChangeBatchTool.name)
 * ```
 * @category tools
 * @since 0.0.0
 */
export const ProposeChangeBatchTool = makeTool(
  "ontology_propose_change_batch",
  "Apply and CAS-save a typed change batch with real deltas.",
  ProposeChangeBatchRequest,
  ProposeChangeBatchResponse,
  true
);
/** Validation tool declaration.
 * @example
 * ```ts
 * import { ValidateOntologyTool } from "@beep/ontology-use-cases/tools"
 * console.log(ValidateOntologyTool.name)
 * ```
 * @category tools
 * @since 0.0.0
 */
export const ValidateOntologyTool = makeTool(
  "ontology_validate",
  "Run bounded real-engine SHACL validation.",
  ValidateOntologyRequest,
  ValidateOntologyResponse,
  false
);
/** Repair tool declaration.
 * @example
 * ```ts
 * import { RepairOntologyTool } from "@beep/ontology-use-cases/tools"
 * console.log(RepairOntologyTool.name)
 * ```
 * @category tools
 * @since 0.0.0
 */
export const RepairOntologyTool = makeTool(
  "ontology_repair",
  "Revalidate and CAS-save a verified repair proposal.",
  RepairOntologyRequest,
  RepairOntologyResponse,
  true
);
/** Provenance export tool declaration.
 * @example
 * ```ts
 * import { ExportProvenanceTool } from "@beep/ontology-use-cases/tools"
 * console.log(ExportProvenanceTool.name)
 * ```
 * @category tools
 * @since 0.0.0
 */
export const ExportProvenanceTool = makeTool(
  "ontology_export_provenance",
  "Write PROV-O and dataset-description sidecars.",
  ExportProvenanceRequest,
  ExportProvenanceResponse,
  true
);
/** Capability metadata tool declaration.
 * @example
 * ```ts
 * import { CapabilityMetadataTool } from "@beep/ontology-use-cases/tools"
 * console.log(CapabilityMetadataTool.name)
 * ```
 * @category tools
 * @since 0.0.0
 */
export const CapabilityMetadataTool = makeTool(
  "ontology_capability_metadata",
  "Describe toolkit limits and reasoner capabilities.",
  CapabilityMetadataRequest,
  CapabilityMetadataResponse,
  false
);

/** Curated nine-tool ontology agent toolkit.
 * @example
 * ```ts
 * import { OntologyToolkit } from "@beep/ontology-use-cases/tools"
 * console.log(Object.keys(OntologyToolkit.tools).length) // 9
 * ```
 * @category tools
 * @since 0.0.0
 */
export const OntologyToolkit = Toolkit.make(
  OpenInspectTool,
  SnapshotDescribeTool,
  OntologySearchTool,
  OntologySparqlQueryTool,
  ProposeChangeBatchTool,
  ValidateOntologyTool,
  RepairOntologyTool,
  ExportProvenanceTool,
  CapabilityMetadataTool
);

/** Type for {@link OntologyToolkit}.
 * @example
 * ```ts
 * import type { OntologyToolkit } from "@beep/ontology-use-cases/tools"
 * const accept = (toolkit: OntologyToolkit) => toolkit
 * console.log(accept)
 * ```
 * @category tools
 * @since 0.0.0
 */
export type OntologyToolkit = typeof OntologyToolkit;
