/**
 * Private bounded transport for metadata-only managed launch facts.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";
import { readEvidenceWindow } from "./evidence-window.ts";
import { observationHttpBodyFailure, readObservationHttpText } from "./internal/observation-http-body.ts";
import {
  makeObservationLaunchFacts,
  ObservationLaunchFact,
  ObservationLaunchIdentity,
  ObservationLaunchReceipt,
} from "./observation-launch-facts.ts";
import type { ObservationControl } from "./observation-control.ts";
import type { TranscriptIntakeConfig } from "./transcript-intake.ts";

const $I = $RepoAiMetricsId.create("observation-launch-http");
/**
 * Explicit route allowlist for the owner's private launch endpoint.
 * **Example** (Disable launch intake)
 * ```ts
 * import { ObservationLaunchHttpPolicy } from "@beep/repo-ai-metrics/observation-launch-http"
 * console.log(ObservationLaunchHttpPolicy.make({ routes: [], bodyTimeoutMillis: 1000 }).routes.length)
 * ```
 * **Details** The private socket authenticates the local owner, not individual harnesses. Route attribution is a producer assertion matched against this administrator allowlist. Empty routes disable intake. This endpoint must never be exposed by the public trace frontend.
 * @category models
 * @since 0.0.0
 */
export class ObservationLaunchHttpPolicy extends S.Opaque<
  ObservationLaunchHttpPolicy,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    routes: S.Array(
      S.Struct({
        routeId: Sha256Hex,
        harness: ObservationLaunchIdentity.fields.harness,
        surface: ObservationLaunchIdentity.fields.surface,
      })
    ).check(
      S.isMaxLength(64),
      S.makeFilter((routes) => A.dedupe(A.map(routes, (route) => route.routeId)).length === routes.length, {
        identifier: "UniqueLaunchRoutes",
        title: "Unique launch route IDs",
        description: "Each allowed launch route has one harness and surface.",
        message: "Launch route IDs must be unique",
      })
    ),
    bodyTimeoutMillis: S.Int.check(S.isBetween({ minimum: 100, maximum: 10000 })),
  }).pipe(
    $I.annoteSchema("ObservationLaunchHttpPolicy", {
      description: "Explicit local-only launch enrollment and body deadline.",
    })
  )
) {}
/**
 * Current local destination window and declared launch routes.
 * **Example** (Inspect the context schema)
 * ```ts
 * import { ObservationLaunchContext } from "@beep/repo-ai-metrics/observation-launch-http"
 * console.log(typeof ObservationLaunchContext.make)
 * ```
 * **Details** Readable while paused. This snapshot can become stale immediately; it is not permission to launch or a reservation. A stale submission is refused instead of moved into another epoch.
 * @category models
 * @since 0.0.0
 */
export class ObservationLaunchContext extends S.Opaque<ObservationLaunchContext, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("observation-launch-context/v1"),
    hostId: Sha256Hex,
    namespaceId: Sha256Hex,
    evidenceEpoch: S.Natural,
    accepting: S.Boolean,
    routes: ObservationLaunchHttpPolicy.fields.routes,
  }).pipe(
    $I.annoteSchema("ObservationLaunchContext", {
      description: "Bounded private destination snapshot, not launch authority.",
    })
  )
) {}
/**
 * Exact fact submission bound to one host, namespace and evidence epoch.
 * **Example** (Inspect the wire boundary)
 * ```ts
 * import { ObservationLaunchSubmission } from "@beep/repo-ai-metrics/observation-launch-http"
 * console.log(typeof ObservationLaunchSubmission.make)
 * ```
 * **Details** Receipt retries must preserve these values. This schema admits no prompts, argv, paths or environment values.
 * @category models
 * @since 0.0.0
 */
export class ObservationLaunchSubmission extends S.Opaque<
  ObservationLaunchSubmission,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    version: S.tag("observation-launch-submission/v1"),
    hostId: Sha256Hex,
    namespaceId: Sha256Hex,
    evidenceEpoch: S.Natural,
    fact: ObservationLaunchFact,
  }).pipe(
    $I.annoteSchema("ObservationLaunchSubmission", {
      description: "Exact metadata submission and destination identity.",
    })
  )
) {}
const decode = S.decodeEffect(S.fromJsonString(ObservationLaunchSubmission), { onExcessProperty: "error" });
const response = (status: number) =>
  HttpServerResponse.text("Launch observation unavailable", {
    status,
    headers: { "cache-control": "no-store", connection: "close" },
  });
const encodeObservationLaunchContextJson = S.encodeEffect(S.fromJsonString(ObservationLaunchContext));
const encodeObservationLaunchReceiptJson = S.encodeEffect(S.fromJsonString(ObservationLaunchReceipt));

const rejectSubmissionHeaders = (request: HttpServerRequest.HttpServerRequest) => {
  const mediaType = Str.toLowerCase(Str.trim(Str.split(request.headers["content-type"] ?? "", ";")[0] ?? ""));
  if (
    mediaType !== "application/json" ||
    Str.toLowerCase(request.headers["content-encoding"] ?? "identity") !== "identity"
  )
    return O.some(response(415));
  const length = request.headers["content-length"];
  if (length !== undefined && (!/^[0-9]{1,10}$/.test(length) || Number(length) > 8192)) return O.some(response(413));
  return O.none();
};

/**
 * Serve one bounded launch write at a time through shared worker admission.
 * **Example** (Inspect the transport factory)
 * ```ts
 * import { makeObservationLaunchHttp } from "@beep/repo-ai-metrics/observation-launch-http"
 * console.log(typeof makeObservationLaunchHttp)
 * ```
 * **Details** A 200 receipt follows the local transaction commit, not backend visibility. Lost responses require exact replay, never a new launch ID. Body reading is limited to 8192 bytes and a deadline; excess concurrency is refused without a queue. An interrupted or uncertain commit can be reconciled by exact retry. The caller owns private socket access and hard process limits. Epoch mismatch is 410 and never automatically resubmitted in a new epoch.
 * @category services
 * @since 0.0.0
 */
export const makeObservationLaunchHttp = Effect.fn("AiMetrics.makeObservationLaunchHttp")(function* (
  config: TranscriptIntakeConfig,
  policy: ObservationLaunchHttpPolicy,
  control: ObservationControl
) {
  const sql = yield* SqlClient.SqlClient;
  const facts = yield* makeObservationLaunchFacts(config);
  const permit = yield* Semaphore.make(1);
  const readContext = Effect.gen(function* () {
    const window = yield* readEvidenceWindow().pipe(Effect.provideService(SqlClient.SqlClient, sql));
    const state = yield* control.status;
    const context = ObservationLaunchContext.make({
      hostId: config.hostId,
      namespaceId: config.namespaceId,
      evidenceEpoch: window.epoch,
      accepting: state.accepting,
      routes: policy.routes,
    });
    return HttpServerResponse.text(yield* encodeObservationLaunchContextJson(context), {
      contentType: "application/json",
      headers: { "cache-control": "no-store", connection: "close" },
    });
  });
  const submit = Effect.fnUntraced(function* (request: HttpServerRequest.HttpServerRequest) {
    const text = yield* readObservationHttpText(request.stream, 8192, policy.bodyTimeoutMillis);
    const submission = yield* decode(text).pipe(Effect.mapError(() => observationHttpBodyFailure("malformed")));
    if (submission.hostId !== config.hostId || submission.namespaceId !== config.namespaceId) return response(409);
    const previous = yield* facts.read(submission.fact.launchId, submission.evidenceEpoch);
    const prepared = submission.fact._tag === "Prepared" ? submission.fact : previous[0]?.fact;
    if (prepared?._tag !== "Prepared") return response(409);
    if (
      !A.some(
        policy.routes,
        (route) =>
          route.routeId === prepared.identity.routeId &&
          route.harness === prepared.identity.harness &&
          route.surface === prepared.identity.surface
      )
    )
      return response(403);
    const receipt = yield* facts.record(submission.fact, submission.evidenceEpoch);
    const body = yield* encodeObservationLaunchReceiptJson(receipt);
    return HttpServerResponse.text(body, {
      status: 200,
      contentType: "application/json",
      headers: {
        "cache-control": "no-store",
        connection: "close",
        "x-observation-receipt": receipt.receiptId,
      },
    });
  });
  const contextRequest = Effect.fnUntraced(function* (request: HttpServerRequest.HttpServerRequest) {
    if (request.method !== "GET") return response(405);
    const result = yield* permit.withPermitsIfAvailable(1)(readContext);
    return O.isSome(result) ? result.value : response(503);
  });
  const submissionRequest = Effect.fnUntraced(function* (request: HttpServerRequest.HttpServerRequest) {
    if (request.method !== "POST") return response(405);
    const rejected = rejectSubmissionHeaders(request);
    if (O.isSome(rejected)) return rejected.value;
    const result = yield* permit.withPermitsIfAvailable(1)(
      control.run(submit(request)).pipe(
        Effect.catchTags({
          ObservationHttpBodyError: (error) =>
            Effect.succeed(response(error.reason === "oversize" ? 413 : error.reason === "timed-out" ? 503 : 400)),
          ObservationControlError: () => Effect.succeed(response(503)),
          ObservationLaunchFactsError: (error) =>
            Effect.succeed(response(error.reason === "retired" ? 410 : error.reason === "conflict" ? 409 : 503)),
        })
      )
    );
    return O.isSome(result) ? result.value : response(503);
  });
  const handler = Effect.gen(function* () {
    const request = yield* HttpServerRequest.HttpServerRequest;
    if (policy.routes.length === 0) return response(404);
    if (request.url === "/v1/launch-context") {
      return yield* contextRequest(request);
    }
    if (request.url !== "/v1/launch-facts") return response(404);
    return yield* submissionRequest(request);
  }).pipe(Effect.orElseSucceed(() => response(503)));
  return { handler };
});
