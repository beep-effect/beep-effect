/**
 * Deterministic Remote Cache conformance corpus generation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoCliId } from "@beep/identity/packages";
import { Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { flow } from "effect/Function";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  CacheConformanceCase,
  CacheConformanceCaseClass,
  CacheConformanceCaseId,
  CacheConformanceCorpus,
  CacheConformanceDimension,
  CacheConformanceExecutor,
  CacheConformanceMethod,
  CacheConformanceOperation,
  CacheConformanceOperationId,
  CacheConformanceResponseShape,
  CacheConformanceRoute,
} from "./Cache.conformance.schemas.ts";
import { decodeCacheExperimentText, readCacheExperimentBytes } from "./Cache.evidence.ts";
import { CacheCommandError } from "./Cache.schemas.ts";
import type { CacheConformanceOrigin } from "./Cache.conformance.schemas.ts";

const $I = $RepoCliId.create("commands/Cache/Cache.conformance.corpus");

/**
 * Repository-relative paths and pins consumed and produced by the corpus generator.
 *
 * **Example** (Read the committed corpus path)
 * ```ts
 * import { CacheConformancePaths } from "@beep/repo-cli/commands/Cache"
 * console.assert(CacheConformancePaths.corpus.endsWith("conformance-corpus.json"))
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CacheConformancePaths = {
  openapi: "goals/turborepo-cache-conformance/research/remote-cache-openapi.json",
  specGitBlob: "4938812fcc199b66bbbe15c2e9c29fc9c84f5dbe",
  specSha256: "1080314512226dc48535fe24648fc0abb10c1cd405c1fd74eacfdc95e22d70b8",
  plan: "explorations/turborepo-quality-cache/research/conformance-corpus-plan.json",
  corpus: "goals/turborepo-cache-conformance/research/conformance-corpus.json",
} as const;

const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const CorpusJson = S.fromJsonString(CacheConformanceCorpus, { space: 2 });
const JsonValue = S.fromJsonString(S.Unknown);
const decodeJson = S.decodeEffect(JsonValue);
const encodeJson = S.encodeEffect(JsonValue);
const decodeCaseType = S.decodeUnknownEffect(S.toType(CacheConformanceCase));
const decodeCorpusType = S.decodeUnknownEffect(S.toType(CacheConformanceCorpus));
const normalise = (text: string) => decodeJson(text).pipe(Effect.flatMap(encodeJson));

const OpenApiResponse = S.Struct({
  content: S.optionalKey(S.Record(S.String, S.Unknown)),
  $ref: S.optionalKey(S.String),
}).pipe(
  $I.annoteSchema("OpenApiResponse", {
    description: "An inline response object or a `#/components/responses/<name>` reference.",
  })
);
const OpenApiDocument = S.Struct({
  paths: S.Record(S.String, S.Record(S.String, S.Unknown)),
  components: S.optionalKey(S.Struct({ responses: S.optionalKey(S.Record(S.String, OpenApiResponse)) })),
}).pipe(
  $I.annoteSchema("OpenApiDocument", {
    description: "Selected paths and shared responses of the vendored OpenAPI blob.",
  })
);
const OpenApiOperation = S.Struct({
  operationId: CacheConformanceOperationId,
  responses: S.Record(S.String, OpenApiResponse),
}).pipe($I.annoteSchema("OpenApiOperation", { description: "Selected fields of one OpenAPI operation." }));
const PlanDocument = S.Struct({
  verdictDimensions: S.NonEmptyArray(CacheConformanceDimension),
  cases: S.Array(
    S.Struct({
      id: CacheConformanceCaseId,
      class: CacheConformanceCaseClass,
      operation: S.NonEmptyString,
      assertion: S.NonEmptyString,
    })
  ),
}).pipe($I.annoteSchema("ConformancePlanDocument", { description: "Selected fields of the 32-case plan." }));
const decodePlanJson = S.decodeEffect(S.fromJsonString(PlanDocument));
const StatusCode = S.NumberFromString.check(S.isInt(), S.isBetween({ minimum: 100, maximum: 599 }));
const decodeStatusCode = S.decodeUnknownOption(StatusCode);
const decodeOperation = S.decodeUnknownEffect(OpenApiOperation);

const OptionalOperation = CacheConformanceOperationId.pick(["queryArtifacts", "recordCacheEvents"]);
const isOptionalOperation = S.is(OptionalOperation);

// Hand-authored route table: the generator looks each (method, path) up in the
// blob and takes the operationId the blob publishes, mounted under `/v8`.
const routeTable: ReadonlyArray<readonly [CacheConformanceMethod, string]> = [
  ["GET", "/artifacts/status"],
  ["HEAD", "/artifacts/{hash}"],
  ["GET", "/artifacts/{hash}"],
  ["PUT", "/artifacts/{hash}"],
  ["POST", "/artifacts"],
  ["POST", "/artifacts/events"],
];

const wireReason = "Reproducible against any target with the direct HTTP runner and per-run random hashes.";
const nativeReason =
  "Requires the exact pinned Turbo executables and signing epochs; executed by cache conformance-native through the fault proxy.";

const CaseRule = S.Struct({
  executor: CacheConformanceExecutor,
  dimensions: S.NonEmptyArray(CacheConformanceDimension),
  reason: S.NonEmptyString,
  routes: S.Array(S.Tuple([CacheConformanceMethod, S.NonEmptyString])),
}).pipe($I.annoteSchema("ConformanceCaseRule", { description: "Hand-authored executor assignment for one case." }));
type CaseRule = typeof CaseRule.Type;

const rule = (
  executor: CacheConformanceExecutor,
  dimensions: CaseRule["dimensions"],
  reason: string,
  routes: CaseRule["routes"] = []
): CaseRule => ({ executor, dimensions, reason, routes });
const putHeadGet: CaseRule["routes"] = [
  ["PUT", "/artifacts/{hash}"],
  ["HEAD", "/artifacts/{hash}"],
  ["GET", "/artifacts/{hash}"],
];
const clients = ["published-stable-client", "published-canary-client"] as const;

// RC-001..RC-032 in plan order.
const caseTable: ReadonlyArray<CaseRule> = [
  rule("wire", ["strict-openapi"], wireReason, [["GET", "/artifacts/status"]]),
  rule("wire", ["strict-openapi", ...clients], wireReason, putHeadGet),
  rule("wire", ["strict-openapi", ...clients], wireReason, putHeadGet),
  rule("wire", ["strict-openapi"], wireReason, [["PUT", "/artifacts/{hash}"]]),
  rule("wire", ["strict-openapi", ...clients], wireReason, putHeadGet),
  rule("wire", ["strict-openapi", ...clients], wireReason, putHeadGet),
  rule("wire", ["strict-openapi"], wireReason, [["POST", "/artifacts"]]),
  rule("wire", ["strict-openapi"], wireReason, [["POST", "/artifacts/events"]]),
  rule(
    "wire",
    ["strict-openapi", ...clients],
    "The wire runner records the documented upload status; client acceptance is scored only by native runs."
  ),
  rule(
    "wire",
    ["strict-openapi", ...clients, "observability"],
    "The wire runner separates a genuine 404 from fault classes; client fail-soft and log evidence stay native/lab."
  ),
  rule("wire", ["strict-openapi", "beep-security-policy"], wireReason),
  rule(
    "wire",
    ["strict-openapi", "beep-security-policy"],
    "The wire runner covers the bearer half; the reader execution role's storage denial needs deployed IAM (lab)."
  ),
  rule(
    "lab",
    ["beep-security-policy"],
    "Direct writer invocation outside the gateway needs the deployed Lambda/IAM boundary."
  ),
  rule("wire", ["strict-openapi", "beep-security-policy"], wireReason),
  rule("wire", ["strict-openapi", "beep-security-policy"], wireReason),
  rule("wire", ["strict-openapi", "beep-security-policy"], wireReason),
  rule("native", [...clients], nativeReason),
  rule("native", [...clients], nativeReason),
  rule("native", [...clients], nativeReason),
  rule("native", [...clients], nativeReason),
  rule(
    "native",
    [...clients],
    `${nativeReason} The wrong-team response is replayed by the fault proxy, so it scores clients only; backend tenant isolation is RC-014.`
  ),
  rule("native", [...clients, "beep-security-policy"], nativeReason),
  rule(
    "wire",
    ["strict-openapi", "observability"],
    "The wire run covers 401, 403 and a genuine 404; cache conformance-lab injects 429, 503, timeout, reset and truncation at the fault proxy and scores observability."
  ),
  rule("wire", ["strict-openapi", "beep-security-policy"], wireReason),
  rule("wire", ["strict-openapi", "beep-security-policy"], wireReason),
  rule("wire", ["strict-openapi", "beep-security-policy"], wireReason),
  rule(
    "lab",
    ["performance-envelope"],
    "cache conformance-lab measures the p50/p95/p99, 2x p99 and observed-max sizes; only a disposable-deployment run is representative."
  ),
  rule(
    "lab",
    ["performance-envelope"],
    "cache conformance-lab measures observed peak and 1.5x peak read/write concurrency; only a disposable-deployment run is representative."
  ),
  rule(
    "lab",
    ["beep-security-policy", "observability"],
    "Retention and namespace cleanup need storage lifecycle timers."
  ),
  rule("lab", ["beep-security-policy", "observability"], "Log and trace privacy needs backend log capture."),
  rule("lab", ["observability"], "Correlation needs client, backend and storage telemetry capture."),
  rule("lab", ["beep-security-policy"], "Cutback needs a rehearsed endpoint and epoch restoration receipt."),
];

const responseRefPrefix = "#/components/responses/";

// Error responses in the pinned blob are `$ref`s to shared components; resolve
// them so their documented media type is scored, and fail on a dangling ref.
const resolveResponse = (
  components: (typeof OpenApiDocument.Type)["components"],
  response: typeof OpenApiResponse.Type
) =>
  O.match(O.fromUndefinedOr(response.$ref), {
    onNone: () => Effect.succeed(response),
    onSome: (ref) =>
      R.get(components?.responses ?? {}, Str.slice(responseRefPrefix.length)(ref)).pipe(
        O.filter(() => Str.startsWith(responseRefPrefix)(ref)),
        Effect.fromOption(() => CacheCommandError.new(`OpenAPI response reference ${ref} does not resolve.`))
      ),
  });

const deriveOperations = Effect.fn("CacheConformance.deriveOperations")(function* (document: unknown) {
  const { paths, components } = yield* S.decodeUnknownEffect(OpenApiDocument)(document);
  return yield* Effect.forEach(
    routeTable,
    Effect.fnUntraced(function* ([method, path]) {
      const raw = yield* R.get(paths, path).pipe(
        O.flatMap(R.get(Str.toLowerCase(method))),
        Effect.fromOption(() => CacheCommandError.new(`OpenAPI blob has no ${method} ${path} operation.`))
      );
      const operation = yield* decodeOperation(raw);
      const resolved = yield* Effect.forEach(R.toEntries(operation.responses), ([status, response]) =>
        resolveResponse(components, response).pipe(Effect.map((shape) => [status, shape] as const))
      );
      const responses = A.sort(
        A.getSomes(
          A.map(resolved, ([status, response]) =>
            O.map(decodeStatusCode(status), (code) =>
              CacheConformanceResponseShape.make({
                status: code,
                contentType: O.fromUndefinedOr(response.content).pipe(O.flatMap(flow(R.keys, A.head))),
              })
            )
          )
        ),
        Order.mapInput(Order.Number, (response: CacheConformanceResponseShape) => response.status)
      );
      return CacheConformanceOperation.make({
        operationId: operation.operationId,
        method,
        route: yield* S.decodeUnknownEffect(CacheConformanceRoute)(`/v8${path}`),
        optional: isOptionalOperation(operation.operationId),
        responses: yield* Effect.fromOption(A.isReadonlyArrayNonEmpty(responses) ? O.some(responses) : O.none()).pipe(
          Effect.mapError(() => CacheCommandError.new(`OpenAPI ${operation.operationId} documents no responses.`))
        ),
      });
    })
  );
});

const originFor = Effect.fn("CacheConformance.originFor")(function* (
  routes: CaseRule["routes"],
  operations: ReadonlyArray<CacheConformanceOperation>
) {
  const ids = yield* Effect.forEach(routes, ([method, path]) =>
    A.findFirst(operations, (operation) => operation.method === method && operation.route === `/v8${path}`).pipe(
      Effect.fromOption(() => CacheCommandError.new(`Case route ${method} ${path} is not a derived operation.`)),
      Effect.map((operation) => operation.operationId)
    )
  );
  return yield* A.match(ids, {
    onEmpty: () => CacheCommandError.new("Generated cases must reference at least one OpenAPI operation."),
    onNonEmpty: (operationIds) => Effect.succeed<CacheConformanceOrigin>({ origin: "generated", operationIds }),
  });
});

/**
 * Build the corpus from the SHA-256-verified OpenAPI blob, the plan and the case table.
 *
 * **Details**
 * The blob digest is checked before the blob is parsed; a mismatch fails with
 * a typed error. The plan digest is recorded. Case identity, class, operation
 * and assertion come from the plan; executor, dimensions and justification
 * come from the hand-authored table in this module.
 *
 * **Example** (Build the corpus from the repository root)
 * ```ts
 * import { buildCacheConformanceCorpus } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect"
 * console.assert(Effect.isEffect(buildCacheConformanceCorpus(".")))
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const buildCacheConformanceCorpus = Effect.fn("CacheConformance.buildCorpus")(function* (root: string) {
  const openapiBytes = yield* readCacheExperimentBytes(root, CacheConformancePaths.openapi);
  const openapiSha256 = yield* hashBytes(openapiBytes);
  if (openapiSha256 !== CacheConformancePaths.specSha256)
    return yield* CacheCommandError.new(
      `Vendored OpenAPI digest ${openapiSha256} does not match the pinned ${CacheConformancePaths.specSha256}.`
    );
  const document = yield* decodeJson(yield* decodeCacheExperimentText(openapiBytes));
  const operations = yield* deriveOperations(document);
  const planBytes = yield* readCacheExperimentBytes(root, CacheConformancePaths.plan);
  const plan = yield* decodePlanJson(yield* decodeCacheExperimentText(planBytes));
  if (plan.cases.length !== caseTable.length)
    return yield* CacheCommandError.new(
      `Plan has ${plan.cases.length} cases; the hand-authored table has ${caseTable.length}.`
    );
  const cases = yield* Effect.forEach(
    A.zip(plan.cases, caseTable),
    Effect.fnUntraced(function* ([planned, entry]) {
      const generated = planned.class === "generated" || planned.class === "generated-optional";
      if (generated !== A.isReadonlyArrayNonEmpty(entry.routes))
        return yield* CacheCommandError.new(`${planned.id} origin disagrees with its plan class ${planned.class}.`);
      return yield* decodeCaseType({
        ...planned,
        origin: generated ? yield* originFor(entry.routes, operations) : { origin: "hand-authored" as const },
        executor: entry.executor,
        dimensions: entry.dimensions,
        reason: entry.reason,
      });
    })
  );
  // Validate through the type side so a plan drift is a typed failure, not a thrown make.
  return yield* decodeCorpusType({
    schemaVersion: "cache-conformance-corpus/v1",
    openapi: { gitBlob: CacheConformancePaths.specGitBlob, sha256: openapiSha256, mountPrefix: "/v8" },
    sourcePlan: { path: CacheConformancePaths.plan, sha256: yield* hashBytes(planBytes) },
    dimensions: plan.verdictDimensions,
    operations,
    cases,
  });
}, CacheCommandError.mapError("Cannot build the Remote Cache conformance corpus."));

/**
 * Render a corpus as deterministic two-space JSON with a trailing newline.
 *
 * **Example** (Render a corpus)
 * ```ts
 * import { buildCacheConformanceCorpus, renderCacheConformanceCorpus } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect"
 * const text = buildCacheConformanceCorpus(".").pipe(Effect.flatMap(renderCacheConformanceCorpus))
 * console.assert(Effect.isEffect(text))
 * ```
 *
 * @category encoding
 * @since 0.0.0
 */
export const renderCacheConformanceCorpus = Effect.fn("CacheConformance.renderCorpus")(function* (
  corpus: CacheConformanceCorpus
) {
  return `${yield* S.encodeEffect(CorpusJson)(corpus)}\n`;
}, CacheCommandError.mapError("Cannot encode the Remote Cache conformance corpus."));

/**
 * Write the generated corpus, or with `check` fail when the committed file's
 * content differs; whitespace-only reformatting is tolerated.
 *
 * **Example** (Check corpus freshness)
 * ```ts
 * import { syncCacheConformanceCorpus } from "@beep/repo-cli/commands/Cache"
 * import * as Effect from "effect/Effect"
 * console.assert(Effect.isEffect(syncCacheConformanceCorpus(".", true)))
 * ```
 *
 * @category use-cases
 * @since 0.0.0
 */
export const syncCacheConformanceCorpus = Effect.fn("CacheConformance.syncCorpus")(function* (
  root: string,
  check: boolean
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const rendered = yield* renderCacheConformanceCorpus(yield* buildCacheConformanceCorpus(root));
  const target = path.join(root, CacheConformancePaths.corpus);
  if (!check) {
    yield* fs.writeFileString(target, rendered);
    return CacheConformancePaths.corpus;
  }
  const committed = yield* readCacheExperimentBytes(root, CacheConformancePaths.corpus).pipe(
    Effect.flatMap(decodeCacheExperimentText)
  );
  // Compare whitespace-normalised JSON: the commit formatter may re-wrap the
  // generated document, but any change of content or key order still fails.
  if ((yield* normalise(committed)) !== (yield* normalise(rendered)))
    return yield* CacheCommandError.new(
      `${CacheConformancePaths.corpus} is stale; run bun run beep cache conformance-corpus.`
    );
  return CacheConformancePaths.corpus;
}, CacheCommandError.mapError("Cannot synchronise the Remote Cache conformance corpus."));
