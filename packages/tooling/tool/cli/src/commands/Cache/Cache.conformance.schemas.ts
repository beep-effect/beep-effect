/**
 * Remote Cache conformance corpus, target, receipt and run-report contracts.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { CacheClientChannel } from "@beep/repo-configs/cache";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import { GitObjectId } from "@beep/schema/Conformance";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $RepoCliId.create("commands/Cache/Cache.conformance.schemas");

/**
 * The six independent verdict dimensions of the conformance plan.
 *
 * **Example** (Name the strict dimension)
 * ```ts
 * import { CacheConformanceDimension } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheConformanceDimension.is["strict-openapi"]("strict-openapi"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheConformanceDimension = LiteralKit([
  "strict-openapi",
  "published-stable-client",
  "published-canary-client",
  "beep-security-policy",
  "observability",
  "performance-envelope",
]).pipe(
  $I.annoteSchema("CacheConformanceDimension", {
    description: "One independently reported conformance verdict dimension; no roll-up hides another.",
  })
);
/**
 * One conformance verdict dimension.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheConformanceDimension = typeof CacheConformanceDimension.Type;

/**
 * Where a corpus case can execute.
 *
 * **Example** (Select the direct-wire executor)
 * ```ts
 * import { CacheConformanceExecutor } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheConformanceExecutor.Enum.wire === "wire")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheConformanceExecutor = LiteralKit(["wire", "native", "lab"]).pipe(
  $I.annoteSchema("CacheConformanceExecutor", {
    description:
      "wire: the direct HTTP runner; native: exact Turbo executables; lab: a deployed boundary or measured load.",
  })
);
/**
 * Executor that owns a corpus case.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheConformanceExecutor = typeof CacheConformanceExecutor.Type;

/**
 * Plan classes of the 32 Remote Cache conformance cases.
 *
 * **Example** (Recognise an optional generated case)
 * ```ts
 * import { CacheConformanceCaseClass } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheConformanceCaseClass.is["generated-optional"]("generated-optional"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheConformanceCaseClass = LiteralKit([
  "generated",
  "generated-optional",
  "semantic",
  "security",
  "integrity",
  "fault",
  "concurrency",
  "capacity",
  "lifecycle",
  "privacy",
  "telemetry",
  "rollback",
]).pipe(
  $I.annoteSchema("CacheConformanceCaseClass", {
    description: "Conformance plan class of one corpus case.",
  })
);
/**
 * Plan class of one corpus case.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheConformanceCaseClass = typeof CacheConformanceCaseClass.Type;

/**
 * Operation identifiers published by the pinned Remote Cache OpenAPI.
 *
 * **Example** (Name the upload operation)
 * ```ts
 * import { CacheConformanceOperationId } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheConformanceOperationId.is.uploadArtifact("uploadArtifact"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheConformanceOperationId = LiteralKit([
  "getArtifactStatus",
  "artifactExists",
  "downloadArtifact",
  "uploadArtifact",
  "queryArtifacts",
  "recordCacheEvents",
]).pipe(
  $I.annoteSchema("CacheConformanceOperationId", {
    description: "OpenAPI operationId of one Remote Cache route.",
  })
);
/**
 * OpenAPI operationId of one Remote Cache route.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheConformanceOperationId = typeof CacheConformanceOperationId.Type;

/**
 * HTTP methods used by the Remote Cache surface.
 *
 * **Example** (Accept an upload method)
 * ```ts
 * import { CacheConformanceMethod } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheConformanceMethod.is.PUT("PUT"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheConformanceMethod = LiteralKit(["GET", "HEAD", "PUT", "POST"]).pipe(
  $I.annoteSchema("CacheConformanceMethod", { description: "HTTP method of one Remote Cache exchange." })
);
/**
 * HTTP method of one Remote Cache exchange.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheConformanceMethod = typeof CacheConformanceMethod.Type;

/**
 * Route templates under the `/v8` client mount; concrete URLs are never recorded.
 *
 * **Example** (Name the artifact route template)
 * ```ts
 * import { CacheConformanceRoute } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheConformanceRoute.is["/v8/artifacts/{hash}"]("/v8/artifacts/{hash}"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheConformanceRoute = LiteralKit([
  "/v8/artifacts/status",
  "/v8/artifacts/{hash}",
  "/v8/artifacts",
  "/v8/artifacts/events",
]).pipe(
  $I.annoteSchema("CacheConformanceRoute", {
    description: "Mounted Remote Cache route template; the concrete URL is never written to a receipt.",
  })
);
/**
 * Mounted Remote Cache route template.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheConformanceRoute = typeof CacheConformanceRoute.Type;

/**
 * One documented response of an OpenAPI operation.
 *
 * **Example** (Describe a JSON status response)
 * ```ts
 * import { CacheConformanceResponseShape } from "@beep/repo-cli/commands/Cache"
 * import * as O from "effect/Option"
 * const shape = CacheConformanceResponseShape.make({ status: 200, contentType: O.some("application/json") })
 * console.assert(shape.status === 200)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceResponseShape extends S.Opaque<
  CacheConformanceResponseShape,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    status: S.Int.check(S.isBetween({ minimum: 100, maximum: 599 })),
    contentType: S.OptionFromNullOr(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("CacheConformanceResponseShape", {
      description: "Documented status code and, when the response has a body, its documented media type.",
    })
  )
) {}

/**
 * Generated wire shape of one OpenAPI operation, mounted under `/v8`.
 *
 * **Example** (Inspect generated operation fields)
 * ```ts
 * import { CacheConformanceOperation } from "@beep/repo-cli/commands/Cache"
 * console.assert("responses" in CacheConformanceOperation.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceOperation extends S.Opaque<CacheConformanceOperation, { readonly brand: unique symbol }>()(
  S.Struct({
    operationId: CacheConformanceOperationId,
    method: CacheConformanceMethod,
    route: CacheConformanceRoute,
    optional: S.Boolean,
    responses: S.NonEmptyArray(CacheConformanceResponseShape),
  }).pipe(
    $I.annoteSchema("CacheConformanceOperation", {
      description: "Method, mounted route and documented responses derived from the pinned OpenAPI blob.",
    })
  )
) {}

/**
 * Corpus case identifier `RC-NNN` from the conformance plan.
 *
 * **Example** (Accept a plan case id)
 * ```ts
 * import { CacheConformanceCaseId } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 * console.assert(S.is(CacheConformanceCaseId)("RC-001"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheConformanceCaseId = S.String.check(S.isPattern(/^RC-\d{3}$/)).pipe(
  $I.annoteSchema("CacheConformanceCaseId", { description: "Plan case identifier RC-NNN." })
);
/**
 * Plan case identifier RC-NNN.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheConformanceCaseId = typeof CacheConformanceCaseId.Type;

/**
 * Whether a case is generated from the OpenAPI blob or hand-authored.
 *
 * **Example** (Read a generated origin)
 * ```ts
 * import { CacheConformanceOrigin } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 * console.assert(S.is(CacheConformanceOrigin)({ origin: "generated", operationIds: ["getArtifactStatus"] }))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheConformanceOrigin = LiteralKit(["generated", "hand-authored"])
  .toTaggedUnion("origin")({
    generated: { operationIds: S.NonEmptyArray(CacheConformanceOperationId) },
    "hand-authored": {},
  })
  .pipe(
    $I.annoteSchema("CacheConformanceOrigin", {
      description: "Generated cases carry OpenAPI operationIds; hand-authored cases survive blob regeneration.",
    })
  );
/**
 * Origin of one corpus case.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheConformanceOrigin = typeof CacheConformanceOrigin.Type;

/**
 * One executable corpus case.
 *
 * **Example** (Inspect case fields)
 * ```ts
 * import { CacheConformanceCase } from "@beep/repo-cli/commands/Cache"
 * console.assert("executor" in CacheConformanceCase.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceCase extends S.Opaque<CacheConformanceCase, { readonly brand: unique symbol }>()(
  S.Struct({
    id: CacheConformanceCaseId,
    class: CacheConformanceCaseClass,
    operation: S.NonEmptyString,
    assertion: S.NonEmptyString,
    origin: CacheConformanceOrigin,
    executor: CacheConformanceExecutor,
    dimensions: S.NonEmptyArray(CacheConformanceDimension),
    reason: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("CacheConformanceCase", {
      description: "Plan case with its origin, executor, scored dimensions and the executor's justification.",
    })
  )
) {}

const caseIdAt = (index: number) => `RC-${Str.padStart(3, "0")(`${index + 1}`)}`;
const CorpusCaseSequence = S.makeFilter(
  (cases: ReadonlyArray<CacheConformanceCase>) =>
    (cases.length === 32 && A.every(cases, (entry, index) => entry.id === caseIdAt(index))) ||
    "expected exactly 32 cases RC-001..RC-032 in order",
  $I.annote("CorpusCaseSequence", {
    title: "Corpus case sequence",
    description: "Exactly the 32 plan cases RC-001..RC-032 in plan order.",
  })
);

/**
 * Generated conformance corpus document `cache-conformance-corpus/v1`.
 *
 * **Example** (Inspect corpus pins)
 * ```ts
 * import { CacheConformanceCorpus } from "@beep/repo-cli/commands/Cache"
 * console.assert("openapi" in CacheConformanceCorpus.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceCorpus extends S.Opaque<CacheConformanceCorpus, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("cache-conformance-corpus/v1"),
    openapi: S.Struct({ gitBlob: GitObjectId, sha256: Sha256Hex, mountPrefix: S.tag("/v8") }),
    sourcePlan: S.Struct({ path: S.NonEmptyString, sha256: Sha256Hex }),
    dimensions: S.NonEmptyArray(CacheConformanceDimension),
    operations: S.NonEmptyArray(CacheConformanceOperation),
    cases: S.Array(CacheConformanceCase).check(CorpusCaseSequence),
  }).pipe(
    $I.annoteSchema("CacheConformanceCorpus", {
      description: "Deterministic corpus generated from the pinned OpenAPI blob and the hand-authored case table.",
    })
  )
) {}

/**
 * Verdict literals for one (case, dimension) pair.
 *
 * **Example** (Recognise a non-execution)
 * ```ts
 * import { CacheConformanceVerdictKind } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheConformanceVerdictKind.is["not-executed"]("not-executed"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheConformanceVerdictKind = LiteralKit([
  "pass",
  "fail",
  "unsupported-optional",
  "not-applicable",
  "not-executed",
]).pipe(
  $I.annoteSchema("CacheConformanceVerdictKind", {
    description: "Exactly one verdict per (case, dimension); not-executed never counts as a pass.",
  })
);
/**
 * Verdict literal for one (case, dimension) pair.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheConformanceVerdictKind = typeof CacheConformanceVerdictKind.Type;

/**
 * Verdict with its expectation id or reason.
 *
 * **Example** (Decode a failed expectation)
 * ```ts
 * import { CacheConformanceVerdict } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 * console.assert(S.is(CacheConformanceVerdict)({ verdict: "fail", expectation: "reader-put-denied", detail: "201" }))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheConformanceVerdict = CacheConformanceVerdictKind.toTaggedUnion("verdict")({
  pass: {},
  fail: { expectation: S.NonEmptyString, detail: S.String },
  "unsupported-optional": { reason: S.NonEmptyString },
  "not-applicable": {},
  "not-executed": { reason: S.NonEmptyString },
}).pipe(
  $I.annoteSchema("CacheConformanceVerdict", {
    description: "Verdict for one (case, dimension); fail names the expectation, non-execution names its reason.",
  })
);
/**
 * Verdict for one (case, dimension) pair.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheConformanceVerdict = typeof CacheConformanceVerdict.Type;

/**
 * Exactly one verdict per dimension for one case.
 *
 * **Example** (Inspect the strict verdict slot)
 * ```ts
 * import { CacheConformanceCaseVerdicts } from "@beep/repo-cli/commands/Cache"
 * console.assert("strict-openapi" in CacheConformanceCaseVerdicts.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceCaseVerdicts extends S.Opaque<
  CacheConformanceCaseVerdicts,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    "strict-openapi": CacheConformanceVerdict,
    "published-stable-client": CacheConformanceVerdict,
    "published-canary-client": CacheConformanceVerdict,
    "beep-security-policy": CacheConformanceVerdict,
    observability: CacheConformanceVerdict,
    "performance-envelope": CacheConformanceVerdict,
  }).pipe(
    $I.annoteSchema("CacheConformanceCaseVerdicts", {
      description: "One verdict for each of the six dimensions of one case.",
    })
  )
) {}

/**
 * Run environment profile; local runs never represent deployed behaviour or load.
 *
 * **Example** (Select the local lab profile)
 * ```ts
 * import { CacheConformanceProfile } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheConformanceProfile.Enum["local-container"] === "local-container")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheConformanceProfile = LiteralKit(["local-container", "disposable-deployment"]).pipe(
  $I.annoteSchema("CacheConformanceProfile", {
    description: "local-container targets must be loopback; disposable-deployment targets are isolated replicas.",
  })
);
/**
 * Run environment profile.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheConformanceProfile = typeof CacheConformanceProfile.Type;

/**
 * Named backend topologies compared by the conformance goal.
 *
 * **Example** (Name the owned fixture topology)
 * ```ts
 * import { CacheConformanceTopology } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheConformanceTopology.is["owned-fixture"]("owned-fixture"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheConformanceTopology = LiteralKit([
  "beep-incumbent",
  "beep-incumbent-evolved",
  "bruno-policy",
  "bruno-loopback",
  "ducktors-upstream",
  "owned-fixture",
]).pipe($I.annoteSchema("CacheConformanceTopology", { description: "Named backend topology under test." }));
/**
 * Named backend topology under test.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheConformanceTopology = typeof CacheConformanceTopology.Type;

/**
 * Environment variable name; values are read only at run time into `Redacted`.
 *
 * **Example** (Reject a lowercase name)
 * ```ts
 * import { CacheConformanceEnvName } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheConformanceEnvName)("reader_token"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheConformanceEnvName = S.String.check(S.isPattern(/^[A-Z_][A-Z0-9_]{0,127}$/)).pipe(
  $I.annoteSchema("CacheConformanceEnvName", {
    description: "Name of an environment variable that holds a bearer; never the value itself.",
  })
);
/**
 * Environment variable name holding a bearer.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheConformanceEnvName = typeof CacheConformanceEnvName.Type;

const Namespace = S.NonEmptyString.check(S.isMaxLength(128));

/**
 * Target descriptor `cache-conformance-target/v1`.
 *
 * **Example** (Inspect credential names)
 * ```ts
 * import { CacheConformanceTarget } from "@beep/repo-cli/commands/Cache"
 * console.assert("credentials" in CacheConformanceTarget.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceTarget extends S.Opaque<CacheConformanceTarget, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("cache-conformance-target/v1"),
    profile: CacheConformanceProfile,
    topology: CacheConformanceTopology,
    baseUrl: S.URLFromString,
    backend: S.Struct({ id: S.NonEmptyString, release: S.NonEmptyString, digest: S.NonEmptyString }),
    namespace: S.Struct({ teamId: Namespace, foreignTeamId: Namespace }),
    credentials: S.Struct({
      reader: CacheConformanceEnvName,
      writer: CacheConformanceEnvName,
      foreign: CacheConformanceEnvName,
      unknown: CacheConformanceEnvName,
    }),
    policy: S.Struct({ readerWriterSplit: S.Boolean, tenantBinding: S.Boolean }),
    requestTimeoutMs: S.Int.check(S.isBetween({ minimum: 100, maximum: 120_000 })).pipe(
      S.withDecodingDefaultKey(Effect.succeed(10_000)),
      S.withConstructorDefault(Effect.succeed(10_000))
    ),
  }).pipe(
    $I.annoteSchema("CacheConformanceTarget", {
      description:
        "One backend target: topology, base URL, backend pin, namespaces, credential env names and policy claims.",
    })
  )
) {}

/**
 * Bearer values loaded for one run; never serialized.
 *
 * **Example** (Hold run bearers redacted)
 * ```ts
 * import { CacheConformanceBearers } from "@beep/repo-cli/commands/Cache"
 * import * as Redacted from "effect/Redacted"
 * const bearers = CacheConformanceBearers.make({
 *   reader: Redacted.make("r"), writer: Redacted.make("w"), foreign: Redacted.make("f"), unknown: Redacted.make("u")
 * })
 * console.assert(String(bearers.reader) !== "r")
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceBearers extends S.Opaque<CacheConformanceBearers, { readonly brand: unique symbol }>()(
  S.Struct({
    reader: S.Redacted(S.NonEmptyString),
    writer: S.Redacted(S.NonEmptyString),
    foreign: S.Redacted(S.NonEmptyString),
    unknown: S.Redacted(S.NonEmptyString),
  }).pipe(
    $I.annoteSchema("CacheConformanceBearers", {
      description: "Run-time bearer values read from the target's environment variable names.",
    })
  )
) {}

/**
 * Credential presented by one exchange.
 *
 * **Example** (Name a missing bearer)
 * ```ts
 * import { CacheConformanceCredentialRole } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheConformanceCredentialRole.is.missing("missing"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheConformanceCredentialRole = LiteralKit([
  "reader",
  "writer",
  "foreign",
  "unknown",
  "missing",
  "malformed",
]).pipe(
  $I.annoteSchema("CacheConformanceCredentialRole", {
    description: "Which credential class an exchange presented; never the bearer value.",
  })
);
/**
 * Credential class presented by one exchange.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheConformanceCredentialRole = typeof CacheConformanceCredentialRole.Type;

/**
 * Shape of the namespace selector sent by one exchange.
 *
 * **Example** (Name a traversal selector)
 * ```ts
 * import { CacheConformanceSelectorShape } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheConformanceSelectorShape.is.traversal("traversal"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheConformanceSelectorShape = LiteralKit([
  "team-id",
  "foreign-team-id",
  "empty",
  "conflicting",
  "slug-conflict",
  "traversal",
  "encoded",
  "oversized",
  "run-epoch",
]).pipe(
  $I.annoteSchema("CacheConformanceSelectorShape", {
    description: "Namespace selector shape; the selector value itself is not recorded.",
  })
);
/**
 * Namespace selector shape.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheConformanceSelectorShape = typeof CacheConformanceSelectorShape.Type;

/**
 * Shape of the artifact hash path segment sent by one exchange.
 *
 * **Example** (Name an encoded hash)
 * ```ts
 * import { CacheConformanceHashShape } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheConformanceHashShape.is.encoded("encoded"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheConformanceHashShape = LiteralKit([
  "none",
  "valid",
  "non-hex",
  "traversal",
  "encoded",
  "empty",
  "oversized",
]).pipe(
  $I.annoteSchema("CacheConformanceHashShape", {
    description: "Artifact hash segment shape; the per-run random hash itself is not recorded.",
  })
);
/**
 * Artifact hash segment shape.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheConformanceHashShape = typeof CacheConformanceHashShape.Type;

/**
 * Disposition class of one exchange; faults never masquerade as misses.
 *
 * **Example** (Separate a miss from a server fault)
 * ```ts
 * import { CacheConformanceOutcome } from "@beep/repo-cli/commands/Cache"
 * console.assert(!CacheConformanceOutcome.is.miss(CacheConformanceOutcome.Enum["server-error"]))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheConformanceOutcome = LiteralKit([
  "success",
  "miss",
  "not-found",
  "unauthorized",
  "forbidden",
  "throttled",
  "client-error",
  "server-error",
  "unexpected-status",
  "timeout",
  "transport-error",
  "truncated-body",
]).pipe(
  $I.annoteSchema("CacheConformanceOutcome", {
    description:
      "miss is only a 404 on a hash never written in the namespace; every other non-2xx keeps its own class.",
  })
);
/**
 * Disposition class of one exchange.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheConformanceOutcome = typeof CacheConformanceOutcome.Type;

/**
 * Finite backend observations without retaining an untrusted header value.
 *
 * **Example** (Reject a claimed genuine miss)
 * ```ts
 * import { CacheConformanceBackendResult } from "@beep/repo-cli/commands/Cache"
 * import * as S from "effect/Schema"
 * console.assert(!S.is(CacheConformanceBackendResult)("genuine-miss"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheConformanceBackendResult = LiteralKit([
  "allowed",
  "authentication-denied",
  "write-denied",
  "tenant-denied",
  "selector-invalid",
  "route-invalid",
  "method-denied",
  "signature-missing",
  "metadata-invalid",
  "not-found",
  "throttled",
  "backend-unavailable",
  "write-ambiguous",
  "payload-rejected",
  "unexpected-status",
  "invalid-evidence",
]).pipe(
  $I.annoteSchema("CacheConformanceBackendResult", {
    description:
      "Finite observation-only adapter result, or a static invalid claim; never producer or genuine-miss authority.",
  })
);
/**
 * A bounded adapter-result observation.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheConformanceBackendResult = typeof CacheConformanceBackendResult.Type;

/**
 * Sanitized HTTP exchange with optional observation-only backend attribution.
 *
 * **Example** (Inspect the finite attribution field)
 * ```ts
 * import { CacheConformanceExchange } from "@beep/repo-cli/commands/Cache"
 * console.assert("backendResult" in CacheConformanceExchange.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceExchange extends S.Opaque<CacheConformanceExchange, { readonly brand: unique symbol }>()(
  S.Struct({
    step: S.NonEmptyString.check(S.isMaxLength(96)),
    role: CacheConformanceCredentialRole,
    method: CacheConformanceMethod,
    route: CacheConformanceRoute,
    operationId: S.OptionFromNullOr(CacheConformanceOperationId),
    strictScored: S.Boolean,
    selector: CacheConformanceSelectorShape,
    hash: CacheConformanceHashShape,
    outcome: CacheConformanceOutcome,
    status: S.OptionFromNullOr(S.Int.check(S.isBetween({ minimum: 100, maximum: 599 }))),
    backendResult: S.OptionFromNullOr(CacheConformanceBackendResult).pipe(
      S.withDecodingDefaultKey(Effect.succeed(null)),
      S.withConstructorDefault(Effect.succeedNone)
    ),
    contentType: S.OptionFromNullOr(S.String.check(S.isMaxLength(128))),
    requestBytes: S.Natural,
    requestSha256: S.OptionFromNullOr(Sha256Hex),
    requestTagSha256: S.OptionFromNullOr(Sha256Hex).pipe(
      S.withDecodingDefaultKey(Effect.succeed(null)),
      S.withConstructorDefault(Effect.succeedNone)
    ),
    responseBytes: S.Natural,
    responseSha256: S.OptionFromNullOr(Sha256Hex),
    tagPresent: S.Boolean,
    tagSha256: S.OptionFromNullOr(Sha256Hex),
    durationPresent: S.Boolean,
    elapsedMs: S.Natural,
  }).pipe(
    $I.annoteSchema("CacheConformanceExchange", {
      description:
        "Method, route template, selector and hash shapes, status class, byte counts, body and sent/received tag digests, timing.",
    })
  )
) {}

/**
 * Fault the conformance proxy injects into one artifact read.
 *
 * **Example** (Name a throttling fault)
 * ```ts
 * import { CacheConformanceFault } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheConformanceFault.is["status-429"]("status-429"))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CacheConformanceFault = LiteralKit([
  "none",
  "missing-tag",
  "tampered-tag",
  "tampered-body",
  "truncated-body",
  "wrong-team",
  "status-429",
  "status-503",
  "timeout",
  "reset",
]).pipe(
  $I.annoteSchema("CacheConformanceFault", {
    description: "Explicit proxy fault for artifact reads; every other request is forwarded unchanged to the target.",
  })
);
/**
 * Fault the conformance proxy injects into one artifact read.
 *
 * @category models
 * @since 0.0.0
 */
export type CacheConformanceFault = typeof CacheConformanceFault.Type;

/**
 * One sanitized request observed by the fault proxy.
 *
 * **Example** (Inspect proxy event fields)
 * ```ts
 * import { CacheConformanceProxyEvent } from "@beep/repo-cli/commands/Cache"
 * console.assert("upstreamStatus" in CacheConformanceProxyEvent.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceProxyEvent extends S.Opaque<
  CacheConformanceProxyEvent,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    scenario: S.NonEmptyString.check(S.isMaxLength(96)),
    fault: CacheConformanceFault,
    upstreamStatus: S.OptionFromNullOr(S.Int.check(S.isBetween({ minimum: 100, maximum: 599 }))),
    exchange: CacheConformanceExchange,
  }).pipe(
    $I.annoteSchema("CacheConformanceProxyEvent", {
      description:
        "Scenario, applied fault, upstream status and the sanitized exchange the client was actually delivered.",
    })
  )
) {}

/**
 * Latency and correctness of one measured envelope step.
 *
 * **Example** (Inspect measurement fields)
 * ```ts
 * import { CacheConformanceMeasurement } from "@beep/repo-cli/commands/Cache"
 * console.assert("readP95Ms" in CacheConformanceMeasurement.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceMeasurement extends S.Opaque<
  CacheConformanceMeasurement,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    label: S.NonEmptyString.check(S.isMaxLength(96)),
    sizeBytes: S.Natural,
    readConcurrency: S.Natural,
    writeConcurrency: S.Natural,
    requests: S.Natural,
    failures: S.Natural,
    readP50Ms: S.Natural,
    readP95Ms: S.Natural,
    readMaxMs: S.Natural,
    writeP50Ms: S.Natural,
    writeP95Ms: S.Natural,
    writeMaxMs: S.Natural,
  }).pipe(
    $I.annoteSchema("CacheConformanceMeasurement", {
      description: "Request count, failures and nearest-rank read/write latency for one size or concurrency step.",
    })
  )
) {}

/**
 * Selected fields of the measured production load envelope.
 *
 * **Example** (Inspect envelope fields)
 * ```ts
 * import { CacheConformanceLoadEnvelope } from "@beep/repo-cli/commands/Cache"
 * console.assert("envelope" in CacheConformanceLoadEnvelope.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceLoadEnvelope extends S.Opaque<
  CacheConformanceLoadEnvelope,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    schemaVersion: S.tag("cache-conformance-load-envelope/v1"),
    artifactSizes: S.Struct({ p50Bytes: S.Natural, p95Bytes: S.Natural, p99Bytes: S.Natural, maxBytes: S.Natural }),
    concurrency: S.Struct({
      readPeak: S.Natural,
      writePeak: S.Natural,
      censored: S.Boolean.pipe(
        S.withDecodingDefaultKey(Effect.succeed(false)),
        S.withConstructorDefault(Effect.succeed(false))
      ),
    }),
    envelope: S.Struct({ payloadBytes: S.Natural, readConcurrency: S.Natural, writeConcurrency: S.Natural }),
  }).pipe(
    $I.annoteSchema("CacheConformanceLoadEnvelope", {
      description: "Observed artifact size quantiles, peak concurrency and the ratified safety envelope.",
    })
  )
) {}

/**
 * Exact native client that produced a native run.
 *
 * **Example** (Inspect client record fields)
 * ```ts
 * import { CacheConformanceClientRecord } from "@beep/repo-cli/commands/Cache"
 * console.assert("executableSha256" in CacheConformanceClientRecord.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceClientRecord extends S.Opaque<
  CacheConformanceClientRecord,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    channel: CacheClientChannel,
    version: S.NonEmptyString,
    executableSha256: Sha256Hex,
  }).pipe(
    $I.annoteSchema("CacheConformanceClientRecord", {
      description: "Channel, exact version and verified executable digest of one native client lane.",
    })
  )
) {}

/**
 * Executed or skipped result of one corpus case.
 *
 * **Example** (Inspect result fields)
 * ```ts
 * import { CacheConformanceCaseResult } from "@beep/repo-cli/commands/Cache"
 * console.assert("verdicts" in CacheConformanceCaseResult.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceCaseResult extends S.Opaque<
  CacheConformanceCaseResult,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    id: CacheConformanceCaseId,
    executor: CacheConformanceExecutor,
    exchanges: S.Array(CacheConformanceExchange),
    notes: S.Array(S.String.check(S.isMaxLength(512))),
    measurements: S.Array(CacheConformanceMeasurement).pipe(
      S.withDecodingDefaultKey(Effect.succeed([])),
      S.withConstructorDefault(Effect.succeed([]))
    ),
    verdicts: CacheConformanceCaseVerdicts,
  }).pipe(
    $I.annoteSchema("CacheConformanceCaseResult", {
      description: "Sanitized exchanges, attribution notes and one verdict per dimension for one case.",
    })
  )
) {}

/**
 * Verdict counts for one dimension.
 *
 * **Example** (Inspect summary counts)
 * ```ts
 * import { CacheConformanceVerdictCounts } from "@beep/repo-cli/commands/Cache"
 * console.assert("notExecuted" in CacheConformanceVerdictCounts.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceVerdictCounts extends S.Opaque<
  CacheConformanceVerdictCounts,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    dimension: CacheConformanceDimension,
    pass: S.Natural,
    fail: S.Natural,
    unsupportedOptional: S.Natural,
    notApplicable: S.Natural,
    notExecuted: S.Natural,
  }).pipe(
    $I.annoteSchema("CacheConformanceVerdictCounts", {
      description: "Per-dimension verdict counts; dimensions are never rolled up together.",
    })
  )
) {}

/**
 * Direct-wire run report `cache-conformance-run/v1`.
 *
 * **Example** (Inspect report fields)
 * ```ts
 * import { CacheConformanceRun } from "@beep/repo-cli/commands/Cache"
 * console.assert("summary" in CacheConformanceRun.fields)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export class CacheConformanceRun extends S.Opaque<CacheConformanceRun, { readonly brand: unique symbol }>()(
  S.Struct({
    schemaVersion: S.tag("cache-conformance-run/v1"),
    profile: CacheConformanceProfile,
    representative: S.Boolean.pipe(
      S.withDecodingDefaultKey(Effect.succeed(false)),
      S.withConstructorDefault(Effect.succeed(false))
    ),
    executors: S.NonEmptyArray(CacheConformanceExecutor).pipe(
      S.withDecodingDefaultKey(Effect.succeed<readonly ["wire"]>(["wire"])),
      S.withConstructorDefault(Effect.succeed<readonly ["wire"]>(["wire"]))
    ),
    clients: S.Array(CacheConformanceClientRecord).pipe(
      S.withDecodingDefaultKey(Effect.succeed([])),
      S.withConstructorDefault(Effect.succeed([]))
    ),
    topology: CacheConformanceTopology,
    backend: CacheConformanceTarget.fields.backend,
    policy: CacheConformanceTarget.fields.policy,
    corpus: S.Struct({ specSha256: Sha256Hex, sourcePlanSha256: Sha256Hex }),
    startedAt: S.NonEmptyString,
    cases: S.Array(CacheConformanceCaseResult),
    summary: S.NonEmptyArray(CacheConformanceVerdictCounts),
  }).pipe(
    $I.annoteSchema("CacheConformanceRun", {
      description:
        "One target's per-case, per-dimension verdicts with sanitized receipts and per-dimension summary counts.",
    })
  )
) {}
