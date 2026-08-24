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
import { LiteralKit, NonNegativeInt, SchemaUtils, Sha256Hex } from "@beep/schema";
import { Effect } from "effect";
import * as S from "effect/Schema";
import { Tool, Toolkit } from "effect/unstable/ai";
import { OntologyFilePath } from "../aggregates/Session/Session.ports.ts";
import {
  OntologyResourceSummary,
  OntologySnapshot,
  OntologyViewMode,
} from "../aggregates/Session/Session.projections.ts";
import { RunOntologySparqlResult } from "../aggregates/Session/Session.sparql.ts";
import { OntologyRepairProposal, RunOntologyValidationResult } from "../aggregates/Session/Session.validation.ts";

const $I = $OntologyUseCasesId.create("tools/OntologyToolkit");

const OptionalSessionHandle = S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault);
const OptionalBaseIri = S.OptionFromOptionalKey(S.NonEmptyString).pipe(SchemaUtils.withNoneDefault);

/**
 * Semantic rdfc-1.0 fingerprint used by stateless ontology CAS.
 *
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
 * ```ts
 * import type { OntologyBudgetKind } from "@beep/ontology-use-cases/tools"
 * const kind: OntologyBudgetKind = "queryResults"
 * console.log(kind)
 * ```
 * @category errors
 * @since 0.0.0
 */
export type OntologyBudgetKind = typeof OntologyBudgetKind.Type;

const OntologyCasConflictFields = {
  expectedFingerprint: OntologyFingerprint,
  currentFingerprint: OntologyFingerprint,
  guidance: S.NonEmptyString,
  recoverable: S.Literal(true),
} satisfies S.Struct.Fields;
const sameOntologyCasConflictFields = S.toEquivalence(S.TaggedStruct("OntologyCasConflict", OntologyCasConflictFields));
const sameOntologyCasConflict = (self: OntologyCasConflict, that: OntologyCasConflict): boolean =>
  sameOntologyCasConflictFields(self, that);

/** Recoverable semantic CAS conflict.
 * **Example** (Usage)
 * ```ts
 * import { OntologyCasConflict } from "@beep/ontology-use-cases/tools"
 * console.log(OntologyCasConflict.fields.currentFingerprint)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class OntologyCasConflict extends S.TaggedError<OntologyCasConflict>($I`OntologyCasConflict`)(
  "OntologyCasConflict",
  OntologyCasConflictFields,
  $I.annoteClass<
    S.declare<OntologyCasConflict>,
    readonly [S.TaggedStruct<"OntologyCasConflict", typeof OntologyCasConflictFields>]
  >("OntologyCasConflict", {
    description: "Recoverable rdfc-1.0 compare-and-set conflict.",
    toEquivalence: () => sameOntologyCasConflict,
  })
) {}

const OntologyBudgetRefusalFields = {
  kind: OntologyBudgetKind,
  actual: NonNegativeInt,
  limit: NonNegativeInt,
  guidance: S.NonEmptyString,
  recoverable: S.Literal(true),
} satisfies S.Struct.Fields;
const sameOntologyBudgetRefusalFields = S.toEquivalence(
  S.TaggedStruct("OntologyBudgetRefusal", OntologyBudgetRefusalFields)
);
const sameOntologyBudgetRefusal = (self: OntologyBudgetRefusal, that: OntologyBudgetRefusal): boolean =>
  sameOntologyBudgetRefusalFields(self, that);

/** Recoverable static budget refusal.
 * **Example** (Usage)
 * ```ts
 * import { OntologyBudgetRefusal } from "@beep/ontology-use-cases/tools"
 * console.log(OntologyBudgetRefusal.fields.limit)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class OntologyBudgetRefusal extends S.TaggedError<OntologyBudgetRefusal>($I`OntologyBudgetRefusal`)(
  "OntologyBudgetRefusal",
  OntologyBudgetRefusalFields,
  $I.annoteClass<
    S.declare<OntologyBudgetRefusal>,
    readonly [S.TaggedStruct<"OntologyBudgetRefusal", typeof OntologyBudgetRefusalFields>]
  >("OntologyBudgetRefusal", {
    description: "Recoverable refusal when a server-owned ontology budget is exceeded.",

    toEquivalence: () => sameOntologyBudgetRefusal,
  })
) {}

const OntologyReasonerDriftRefusalFields = {
  actual: NonNegativeInt,
  cap: NonNegativeInt,
  guidance: S.NonEmptyString,
  recoverable: S.Literal(true),
} satisfies S.Struct.Fields;
const sameOntologyReasonerDriftRefusalFields = S.toEquivalence(
  S.TaggedStruct("OntologyReasonerDriftRefusal", OntologyReasonerDriftRefusalFields)
);
const sameOntologyReasonerDriftRefusal = (
  self: OntologyReasonerDriftRefusal,
  that: OntologyReasonerDriftRefusal
): boolean => sameOntologyReasonerDriftRefusalFields(self, that);

/** Recoverable reasoner drift-cap refusal.
 * **Example** (Usage)
 * ```ts
 * import { OntologyReasonerDriftRefusal } from "@beep/ontology-use-cases/tools"
 * console.log(OntologyReasonerDriftRefusal.fields.cap)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class OntologyReasonerDriftRefusal extends S.TaggedError<OntologyReasonerDriftRefusal>(
  $I`OntologyReasonerDriftRefusal`
)(
  "OntologyReasonerDriftRefusal",
  OntologyReasonerDriftRefusalFields,
  $I.annoteClass<
    S.declare<OntologyReasonerDriftRefusal>,
    readonly [S.TaggedStruct<"OntologyReasonerDriftRefusal", typeof OntologyReasonerDriftRefusalFields>]
  >("OntologyReasonerDriftRefusal", {
    description: "Recoverable refusal that prevents an unbounded reasoner recompute.",

    toEquivalence: () => sameOntologyReasonerDriftRefusal,
  })
) {}

const OntologyNoOpRefusalFields = {
  guidance: S.NonEmptyString,
  recoverable: S.Literal(true),
} satisfies S.Struct.Fields;
const sameOntologyNoOpRefusalFields = S.toEquivalence(S.TaggedStruct("OntologyNoOpRefusal", OntologyNoOpRefusalFields));
const sameOntologyNoOpRefusal = (self: OntologyNoOpRefusal, that: OntologyNoOpRefusal): boolean =>
  sameOntologyNoOpRefusalFields(self, that);

/** Explicit refusal for a change batch with no real delta.
 * **Example** (Usage)
 * ```ts
 * import { OntologyNoOpRefusal } from "@beep/ontology-use-cases/tools"
 * const error = OntologyNoOpRefusal.make({ guidance: "Refetch before proposing another change.", recoverable: true })
 * console.log(error._tag)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class OntologyNoOpRefusal extends S.TaggedError<OntologyNoOpRefusal>($I`OntologyNoOpRefusal`)(
  "OntologyNoOpRefusal",
  OntologyNoOpRefusalFields,
  $I.annoteClass<
    S.declare<OntologyNoOpRefusal>,
    readonly [S.TaggedStruct<"OntologyNoOpRefusal", typeof OntologyNoOpRefusalFields>]
  >("OntologyNoOpRefusal", {
    description: "Visible refusal for an ontology mutation that would have no effect.",

    toEquivalence: () => sameOntologyNoOpRefusal,
  })
) {}

const OntologyActorIdentityRefusalFields = {
  guidance: S.NonEmptyString,
  recoverable: S.Literal(true),
} satisfies S.Struct.Fields;
const sameOntologyActorIdentityRefusalFields = S.toEquivalence(
  S.TaggedStruct("OntologyActorIdentityRefusal", OntologyActorIdentityRefusalFields)
);
const sameOntologyActorIdentityRefusal = (
  self: OntologyActorIdentityRefusal,
  that: OntologyActorIdentityRefusal
): boolean => sameOntologyActorIdentityRefusalFields(self, that);

/** Recoverable refusal when authenticated caller identity is unavailable.
 * **Example** (Usage)
 * ```ts
 * import { OntologyActorIdentityRefusal } from "@beep/ontology-use-cases/tools"
 * const error = OntologyActorIdentityRefusal.make({ guidance: "Initialize an authenticated MCP session and retry.", recoverable: true })
 * console.log(error._tag)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class OntologyActorIdentityRefusal extends S.TaggedError<OntologyActorIdentityRefusal>(
  $I`OntologyActorIdentityRefusal`
)(
  "OntologyActorIdentityRefusal",
  OntologyActorIdentityRefusalFields,
  $I.annoteClass<
    S.declare<OntologyActorIdentityRefusal>,
    readonly [S.TaggedStruct<"OntologyActorIdentityRefusal", typeof OntologyActorIdentityRefusalFields>]
  >("OntologyActorIdentityRefusal", {
    description: "Recoverable refusal when authenticated caller identity is unavailable for mutation attribution.",

    toEquivalence: () => sameOntologyActorIdentityRefusal,
  })
) {}

const OntologyTierGateRefusalFields = {
  guidance: S.NonEmptyString,
  recoverable: S.Literal(true),
} satisfies S.Struct.Fields;
const sameOntologyTierGateRefusalFields = S.toEquivalence(
  S.TaggedStruct("OntologyTierGateRefusal", OntologyTierGateRefusalFields)
);
const sameOntologyTierGateRefusal = (self: OntologyTierGateRefusal, that: OntologyTierGateRefusal): boolean =>
  sameOntologyTierGateRefusalFields(self, that);

/** Recoverable refusal returned when TierGate does not approve a mutation.
 * **Example** (Usage)
 * ```ts
 * import { OntologyTierGateRefusal } from "@beep/ontology-use-cases/tools"
 * const error = OntologyTierGateRefusal.make({ guidance: "Resolve the mutation tier and retry.", recoverable: true })
 * console.log(error._tag)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class OntologyTierGateRefusal extends S.TaggedError<OntologyTierGateRefusal>($I`OntologyTierGateRefusal`)(
  "OntologyTierGateRefusal",
  OntologyTierGateRefusalFields,
  $I.annoteClass<
    S.declare<OntologyTierGateRefusal>,
    readonly [S.TaggedStruct<"OntologyTierGateRefusal", typeof OntologyTierGateRefusalFields>]
  >("OntologyTierGateRefusal", {
    description: "Recoverable fail-closed refusal returned when TierGate does not approve an ontology mutation.",

    toEquivalence: () => sameOntologyTierGateRefusal,
  })
) {}

const OntologyToolExecutionErrorFields = {
  operation: S.NonEmptyString,
  message: S.NonEmptyString,
  recoverable: S.Boolean,
} satisfies S.Struct.Fields;
const sameOntologyToolExecutionErrorFields = S.toEquivalence(
  S.TaggedStruct("OntologyToolExecutionError", OntologyToolExecutionErrorFields)
);
const sameOntologyToolExecutionError = (self: OntologyToolExecutionError, that: OntologyToolExecutionError): boolean =>
  sameOntologyToolExecutionErrorFields(self, that);

/** Typed execution failure from a real ontology layer.
 * **Example** (Usage)
 * ```ts
 * import { OntologyToolExecutionError } from "@beep/ontology-use-cases/tools"
 * const error = OntologyToolExecutionError.make({ operation: "open-inspect", message: "The file could not be opened.", recoverable: false })
 * console.log(error.operation)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class OntologyToolExecutionError extends S.TaggedError<OntologyToolExecutionError>(
  $I`OntologyToolExecutionError`
)(
  "OntologyToolExecutionError",
  OntologyToolExecutionErrorFields,
  $I.annoteClass<
    S.declare<OntologyToolExecutionError>,
    readonly [S.TaggedStruct<"OntologyToolExecutionError", typeof OntologyToolExecutionErrorFields>]
  >("OntologyToolExecutionError", {
    description: "Typed safe execution failure returned by an ontology tool.",
    toEquivalence: () => sameOntologyToolExecutionError,
  })
) {}

/** Returned ontology tool failure union.
 * **Example** (Usage)
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
  OntologyActorIdentityRefusal,
  OntologyTierGateRefusal,
  OntologyToolExecutionError,
]).pipe($I.annoteSchema("OntologyToolFailure", { description: "Failure returned by the ontology agent toolkit." }));

/** Type for {@link OntologyToolFailure}.
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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

/** Provenance publication request.
 * **Details**
 *
 * `destination` is supplied by the caller, which is what makes this
 * tool an egress primitive rather than a workspace one. Nothing here validates
 * it: the governed egress boundary owns that decision, so a destination the
 * operator never allowlisted is refused no matter what an agent asks for.
 * **Example** (Usage)
 * ```ts
 * import { PublishProvenanceRequest } from "@beep/ontology-use-cases/tools"
 * console.log(PublishProvenanceRequest)
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export class PublishProvenanceRequest extends S.Class<PublishProvenanceRequest>($I`PublishProvenanceRequest`)(
  {
    provPath: OntologyFilePath.check(
      S.isPattern(/\.prov\.ttl$/u, {
        identifier: "OntologyPublishProvenanceFilePath",
        title: "Published ontology provenance sidecar path",
        description: "A generated ontology provenance sidecar ending in .prov.ttl.",
        message: "Expected a .prov.ttl provenance sidecar path",
      })
    ),
    destination: S.NonEmptyString.annotateKey({
      description: "Absolute URL to publish to; authorized by the governed egress allowlist, never by this schema.",
    }),
  },
  $I.annote("PublishProvenanceRequest", {
    description: "Publish an existing provenance sidecar to a governed egress destination.",
  })
) {}

/** Provenance publication response.
 * **Example** (Usage)
 * ```ts
 * import { PublishProvenanceResponse } from "@beep/ontology-use-cases/tools"
 * console.log(PublishProvenanceResponse)
 * ```
 * @category tool-schemas
 * @since 0.0.0
 */
export class PublishProvenanceResponse extends S.Class<PublishProvenanceResponse>($I`PublishProvenanceResponse`)(
  { provPath: OntologyFilePath, publishedBytes: NonNegativeInt, status: NonNegativeInt },
  $I.annote("PublishProvenanceResponse", { description: "Result of a governed provenance publication." })
) {}

/** Capability metadata request.
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
 * **Example** (Usage)
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
/** Provenance publication tool declaration.
 * **Details**
 *
 * Registered only when the governed egress allowlist is non-empty —
 * the tool and its control ship together, and an empty allowlist means the tool
 * does not appear in `tools/list` at all. Its outbound request must travel the
 * ambient `HttpClient`, never a self-provided one, or the governed egress
 * `Fetch` will not apply to it.
 * **Example** (Usage)
 * ```ts
 * import { PublishProvenanceTool } from "@beep/ontology-use-cases/tools"
 * console.log(PublishProvenanceTool.name)
 * ```
 * @category tools
 * @since 0.0.0
 */
export const PublishProvenanceTool = makeTool(
  "ontology_publish_provenance",
  "Publish an existing provenance sidecar to an authorized external destination.",
  PublishProvenanceRequest,
  PublishProvenanceResponse,
  true
);
/** Capability metadata tool declaration.
 * **Example** (Usage)
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
 * **Example** (Usage)
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

/** Read-only ontology toolkit registered independently of mutation enablement.
 * **Example** (Usage)
 * ```ts
 * import { OntologyReadOnlyToolkit } from "@beep/ontology-use-cases/tools"
 * console.log(Object.keys(OntologyReadOnlyToolkit.tools).includes("ontology_sparql_query"))
 * ```
 * @category tools
 * @since 0.0.0
 */
export const OntologyReadOnlyToolkit = Toolkit.make(
  OpenInspectTool,
  SnapshotDescribeTool,
  OntologySearchTool,
  OntologySparqlQueryTool,
  ValidateOntologyTool,
  CapabilityMetadataTool
);

/** Mutation toolkit registered only when the sidecar mutation feature gate is enabled.
 * **Example** (Usage)
 * ```ts
 * import { OntologyMutationToolkit } from "@beep/ontology-use-cases/tools"
 * console.log(Object.keys(OntologyMutationToolkit.tools).includes("ontology_repair"))
 * ```
 * @category tools
 * @since 0.0.0
 */
export const OntologyMutationToolkit = Toolkit.make(ProposeChangeBatchTool, RepairOntologyTool, ExportProvenanceTool);

/** Egress toolkit registered only when the governed destination allowlist is non-empty.
 * **Details**
 *
 * Separate from {@link OntologyMutationToolkit} because it is gated on
 * a different condition: mutation registration turns on workspace writes, while
 * this turns on outbound publication, and an operator may want the first
 * without the second.
 * **Example** (Usage)
 * ```ts
 * import { OntologyPublishToolkit } from "@beep/ontology-use-cases/tools"
 * console.log(Object.keys(OntologyPublishToolkit.tools).includes("ontology_publish_provenance"))
 * ```
 * @category tools
 * @since 0.0.0
 */
export const OntologyPublishToolkit = Toolkit.make(PublishProvenanceTool);

/** Type for {@link OntologyToolkit}.
 * **Example** (Usage)
 * ```ts
 * import type { OntologyToolkit } from "@beep/ontology-use-cases/tools"
 * const accept = (toolkit: OntologyToolkit) => toolkit
 * console.log(accept)
 * ```
 * @category tools
 * @since 0.0.0
 */
export type OntologyToolkit = typeof OntologyToolkit;
