import { $RunpodId } from "@beep/identity";
import {
  CreatePodParams,
  CreatePodRequest,
  DeletePodParams,
  GetPodLogsParams,
  ListAuditLogsParams,
  ListPodsParams,
  listPodsOperation,
  PodActionParams,
  parseRunpodDocsIndex,
  podActionOperation,
  RUNPOD_OPERATION_SPECS,
  Runpod,
  RunpodConfigInput,
  RunpodDocs,
  RunpodDocsConfigInput,
  RunpodDocsError,
  RunpodDocsErrorOptions,
  RunpodDocsIndex,
  RunpodDocsIndexEntry,
  RunpodError,
  RunpodErrorOptions,
  RunpodProblem,
  RunpodRawRequest,
  RunpodRawResponse,
} from "@beep/runpod";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { A, Str } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import * as Arbitrary from "effect/Arbitrary";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Fiber from "effect/Fiber";
import { flow, pipe } from "effect/Function";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Redacted from "effect/Redacted";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";
import openApi from "../openapi.json" with { type: "json" };

const decodeUnknownJsonEffect = S.decodeUnknownEffect(S.fromJsonString(S.Unknown));
const decodeUnknownCreatePodRequest = S.decodeUnknownEffect(CreatePodRequest);

const $TestI = $RunpodId.create("Runpod.service.test");

const documentedPod = openApi.paths["/v2/pods"].post.responses["201"].content["application/json"].examples.pod.value;
const documentedQueuedPod =
  openApi.paths["/v2/pods"].post.responses["202"].content["application/json"].examples.queuedPod.value;
const documentedPodList =
  openApi.paths["/v2/pods"].get.responses["200"].content["application/json"].examples.pods.value;
const documentedAuditLogs =
  openApi.paths["/v2/audit-logs"].get.responses["200"].content["application/json"].examples.auditLogs.value;

type CapturedRequest = {
  readonly bodyText: string | undefined;
  readonly contentType: string | undefined;
  readonly headers: Readonly<Record<string, string>>;
  readonly method: string;
  readonly url: string;
};

type RunpodTestRespond = (
  request: HttpClientRequest.HttpClientRequest
) => Effect.Effect<Response, HttpClientError.HttpClientError>;

type RunpodTestHttpShape = {
  readonly captures: Effect.Effect<ReadonlyArray<CapturedRequest>>;
  readonly handle: RunpodTestRespond;
  readonly reset: Effect.Effect<void>;
  readonly respondWith: (respond: RunpodTestRespond) => Effect.Effect<void>;
};

class RunpodTestHttp extends Context.Service<RunpodTestHttp, RunpodTestHttpShape>()($TestI`RunpodTestHttp`) {}

class CapturedCreatePodBody extends S.Opaque<CapturedCreatePodBody, { readonly brand: unique symbol }>()(
  S.Struct({
    gpu: S.Struct({ count: S.Int, id: S.String }),
    image: S.String,
    name: S.String,
  }).pipe(
    $TestI.annoteSchema("CapturedCreatePodBody", {
      description: "Minimal request body decoded from Runpod create pod test captures.",
    })
  )
) {}

const decodeCapturedCreatePodBody = S.decodeUnknownEffect(CapturedCreatePodBody);

class DocumentedExample extends S.Opaque<DocumentedExample, { readonly brand: unique symbol }>()(
  S.Struct({ value: S.Unknown }).pipe(
    $TestI.annoteSchema("DocumentedExample", {
      description: "One named example payload of the vendored Runpod OpenAPI document.",
    })
  )
) {}

const DocumentedResponse = S.Struct({
  content: S.optionalKey(
    S.Record(S.String, S.Struct({ examples: S.optionalKey(S.Record(S.String, DocumentedExample)) }))
  ),
}).pipe(
  $TestI.annoteSchema("DocumentedResponse", {
    description: "Response object of the vendored Runpod OpenAPI document, reduced to its examples.",
  })
);

const DocumentedOperation = S.Struct({
  operationId: S.String,
  responses: S.Record(S.String, DocumentedResponse),
}).pipe(
  $TestI.annoteSchema("DocumentedOperation", {
    description: "Operation of the vendored Runpod OpenAPI document, reduced to its response examples.",
  })
);
type DocumentedOperation = typeof DocumentedOperation.Type;

const DocumentedPaths = S.Struct({
  paths: S.Record(
    S.String,
    S.Struct({
      delete: S.optionalKey(DocumentedOperation),
      get: S.optionalKey(DocumentedOperation),
      patch: S.optionalKey(DocumentedOperation),
      post: S.optionalKey(DocumentedOperation),
      put: S.optionalKey(DocumentedOperation),
    })
  ),
}).pipe(
  $TestI.annoteSchema("DocumentedPaths", {
    description: "Paths of the vendored Runpod OpenAPI document, reduced to their response examples.",
  })
);

const decodeDocumentedPaths = S.decodeUnknownEffect(DocumentedPaths);

type DocumentedCase = {
  readonly example: string;
  readonly operationId: string;
  readonly status: string;
  readonly value: unknown;
};

const documentedCases = (operation: DocumentedOperation): ReadonlyArray<DocumentedCase> =>
  pipe(
    R.toEntries(operation.responses),
    A.filter(([status]) => Str.startsWith("2")(status)),
    A.flatMap(([status, response]) =>
      pipe(
        O.fromUndefinedOr(response.content),
        O.flatMap(R.get("application/json")),
        O.flatMap((media) => O.fromUndefinedOr(media.examples)),
        O.map(R.toEntries),
        O.getOrElse(A.empty<readonly [string, DocumentedExample]>),
        A.map(([example, documented]) => ({
          example,
          operationId: operation.operationId,
          status,
          value: documented.value,
        }))
      )
    )
  );

const operationSpecs: Readonly<
  Record<string, { readonly responses: { readonly [status: string]: S.ConstraintDecoder<unknown> } }>
> = RUNPOD_OPERATION_SPECS;

const encode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): Codec["Encoded"] =>
  Result.getOrThrow(S.encodeResult(schema)(value));

const decode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Encoded"]): Codec["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const expectRoundTrip = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): void => {
  const encoded = encode(schema, value);
  const decoded = decode(schema, encoded);
  const reencoded = encode(schema, decoded);

  expect(reencoded).toEqual(encoded);
  expect(Equal.equals(decoded, value) || S.toEquivalence(schema)(decoded, value)).toBe(true);
};

const normalizeRawPathForTest = (path: string): string => (Str.startsWith("/")(path) ? path : `/${path}`);

const RunpodRawRequestArbitrary = Arbitrary.schema(RunpodRawRequest).pipe(
  Arbitrary.map((request) =>
    RunpodRawRequest.make({
      ...request,
      path: normalizeRawPathForTest(request.path),
    })
  )
);

const makeJsonResponse = (body: unknown, status = 200, contentType = "application/json") =>
  Response.json(body, {
    headers: {
      "content-type": contentType,
    },
    status,
  });

const urlPath = (request: HttpClientRequest.HttpClientRequest): string =>
  pipe(
    HttpClientRequest.toUrl(request),
    O.map((url) => url.pathname),
    O.getOrElse(() => request.url)
  );

const defaultRespond: RunpodTestRespond = (request) =>
  Effect.succeed(
    Match.value({ method: request.method, path: urlPath(request) }).pipe(
      Match.when({ method: "DELETE" }, () => new Response(null, { status: 204 })),
      Match.when({ method: "GET", path: "/api/v2/openapi.json" }, () => makeJsonResponse({ openapi: openApi.openapi })),
      Match.when({ method: "GET", path: "/api/v2/pods" }, () => makeJsonResponse(documentedPodList)),
      Match.when({ method: "GET", path: "/api/v2/audit-logs" }, () => makeJsonResponse(documentedAuditLogs)),
      Match.when({ method: "POST", path: "/api/v2/pods" }, () => makeJsonResponse(documentedPod, 201)),
      Match.orElse(() => makeJsonResponse(documentedPod))
    )
  );

const bodyTextFor = (request: HttpClientRequest.HttpClientRequest): string | undefined =>
  request.body._tag === "Uint8Array" ? new TextDecoder().decode(request.body.body) : undefined;

const bodyContentTypeFor = (request: HttpClientRequest.HttpClientRequest): string | undefined =>
  request.body._tag === "Empty" ? undefined : request.body.contentType;

const testError = (path: string): RunpodError =>
  RunpodError.make({
    path: O.some(path),
    reason: "request encoding",
  });

const captureAt = (
  captures: ReadonlyArray<CapturedRequest>,
  index: number,
  label: string
): Effect.Effect<CapturedRequest, RunpodError> =>
  pipe(
    captures,
    A.get(index),
    Effect.fromOption(() => testError(label))
  );

const bodyTextFromCapture = (capture: CapturedRequest, label: string): Effect.Effect<string, RunpodError> =>
  pipe(
    O.fromUndefinedOr(capture.bodyText),
    Effect.fromOption(() => testError(label))
  );

const RunpodTestHttpLayer = Layer.effect(
  RunpodTestHttp,
  Effect.gen(function* () {
    const capturesRef = yield* Ref.make<ReadonlyArray<CapturedRequest>>([]);
    const respondRef = yield* Ref.make<RunpodTestRespond>(defaultRespond);

    return RunpodTestHttp.of({
      captures: Ref.get(capturesRef),
      handle: Effect.fn("RunpodTestHttp.handle")(function* (request) {
        const url = pipe(
          HttpClientRequest.toUrl(request),
          O.map((value) => value.toString()),
          O.getOrElse(() => request.url)
        );

        yield* Ref.update(
          capturesRef,
          A.append({
            bodyText: bodyTextFor(request),
            contentType: bodyContentTypeFor(request),
            headers: request.headers,
            method: request.method,
            url,
          })
        );

        const respond = yield* Ref.get(respondRef);
        return yield* respond(request);
      }),
      reset: Effect.all([Ref.set(capturesRef, []), Ref.set(respondRef, defaultRespond)], {
        concurrency: 1,
        discard: true,
      }),
      respondWith: Effect.fn("RunpodTestHttp.respondWith")(function* (respond) {
        yield* Ref.set(respondRef, respond);
      }),
    });
  })
);

const TestHttpClientLayer = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const testHttp = yield* RunpodTestHttp;

    return HttpClient.make((request) =>
      Effect.gen(function* () {
        const response = yield* testHttp.handle(request);
        return HttpClientResponse.fromWeb(request, response);
      })
    );
  })
);

const makeRunpodUnitLayer = (
  config = RunpodConfigInput.make({
    apiKey: Redacted.make("test-key"),
    apiUrl: "https://example.test/api/v2///",
  })
) => Runpod.makeLayer(config).pipe(Layer.provide(TestHttpClientLayer), Layer.provideMerge(RunpodTestHttpLayer));

const makeRunpodDocsUnitLayer = (
  config = RunpodDocsConfigInput.make({
    indexUrl: "https://docs.example.test/llms.txt",
  })
) => RunpodDocs.makeLayer(config).pipe(Layer.provide(TestHttpClientLayer), Layer.provideMerge(RunpodTestHttpLayer));

const llmsText = `# Runpod Documentation

## Docs
- [Pods](https://docs.runpod.io/pods.md): Manage GPU pods
- [Templates](https://docs.runpod.io/templates.md): Manage templates
`;

const logEvents = `id: 2026-06-01T12:02:03Z/000000000001
data: {"ts":"2026-06-01T12:02:03Z","source":"container","line":"Model loaded."}

id: 2026-06-01T12:02:04Z/000000000002
data: {"ts":"2026-06-01T12:02:04Z","source":"container","line":"Serving."}

`;

describe("@beep/runpod", () => {
  it.layer(makeRunpodUnitLayer(), { timeout: "5 seconds" })((it) =>
    it.effect("exposes the generated REST API v2 operation surface", () =>
      Effect.sync(() => {
        const operationKeys = R.keys(RUNPOD_OPERATION_SPECS);

        expect(operationKeys).toHaveLength(109);
        expect(operationKeys).toEqual(
          expect.arrayContaining(["listPods", "podAction", "getPodLogs", "getOpenApi", "createCluster"])
        );
        expect(operationKeys).not.toEqual(expect.arrayContaining(["resetPod"]));
        expect(operationKeys).not.toEqual(expect.arrayContaining(["updatePodViaPost"]));
        expect(listPodsOperation.path).toBe("/pods");
        expect(podActionOperation.path).toBe("/pods/{id}/action");
      })
    )
  );

  it.effect(
    "decodes every documented 2xx JSON example with its generated response schema",
    Effect.fnUntraced(function* () {
      const document = yield* decodeDocumentedPaths(openApi);
      const cases = pipe(
        R.values(document.paths),
        A.flatMap((pathItem) =>
          A.getSomes(
            A.map([pathItem.get, pathItem.post, pathItem.patch, pathItem.put, pathItem.delete], O.fromUndefinedOr)
          )
        ),
        A.flatMap(documentedCases)
      );
      const failures = yield* Effect.forEach(
        cases,
        (documented) =>
          pipe(
            R.get(operationSpecs, documented.operationId),
            O.flatMap((spec) => R.get(spec.responses, documented.status)),
            O.match({
              onNone: () => Effect.succeedSome(`${documented.operationId} ${documented.status}: no decoder`),
              onSome: (decoder) =>
                pipe(
                  S.decodeUnknownEffect(decoder)(documented.value),
                  Effect.as(O.none<string>()),
                  Effect.orElseSucceed(() =>
                    O.some(`${documented.operationId} ${documented.status} ${documented.example}`)
                  )
                ),
            })
          ),
        { concurrency: 1 }
      );

      expect(A.length(cases)).toBeGreaterThan(0);
      expect(A.getSomes(failures)).toEqual([]);
    })
  );

  it.layer(makeRunpodUnitLayer(), { timeout: "5 seconds" })((it) =>
    it.effect(
      "sends typed operations with expected auth, query, path, and JSON body encoding",
      Effect.fnUntraced(function* () {
        const testHttp = yield* RunpodTestHttp;
        const runpod = yield* Runpod;
        yield* testHttp.reset;

        const openApiDocument = yield* runpod.getOpenApi();
        yield* runpod.listPods(
          ListPodsParams.make({
            filters: { tags: [{ key: "env", values: ["dev"] }] },
            includeClusterPods: true,
            limit: 50,
          })
        );
        yield* runpod.listAuditLogs(ListAuditLogsParams.make({ actorIds: ["user-a", "user-b"] }));
        const created = yield* runpod.createPod(
          CreatePodParams.make({
            body: { gpu: { count: 1, id: "NVIDIA L4" }, image: "runpod/pytorch", name: "demo-pod" },
          })
        );
        yield* runpod.deletePod(DeletePodParams.make({ id: "pod 1" }));

        const captures = yield* testHttp.captures;
        const openApiCapture = yield* captureAt(captures, 0, "openapi capture");
        const listCapture = yield* captureAt(captures, 1, "list pods capture");
        const auditCapture = yield* captureAt(captures, 2, "audit logs capture");
        const createCapture = yield* captureAt(captures, 3, "create pod capture");
        const deleteCapture = yield* captureAt(captures, 4, "delete pod capture");
        const capturedBody = yield* pipe(
          bodyTextFromCapture(createCapture, "create pod body"),
          Effect.flatMap(decodeUnknownJsonEffect),
          Effect.flatMap(decodeCapturedCreatePodBody)
        );
        const listUrl = new URL(listCapture.url);

        expect(openApiDocument).toEqual({ openapi: "3.1.0" });
        expect(openApiCapture.headers.authorization).toBeUndefined();
        expect(openApiCapture.url).toBe("https://example.test/api/v2/openapi.json");
        expect(listCapture.headers.authorization).toBe("Bearer test-key");
        expect(listUrl.pathname).toBe("/api/v2/pods");
        expect(listUrl.searchParams.get("includeClusterPods")).toBe("true");
        expect(listUrl.searchParams.get("limit")).toBe("50");
        expect(listUrl.searchParams.get("filters")).toBe('{"tags":[{"key":"env","values":["dev"]}]}');
        expect(new URL(auditCapture.url).searchParams.getAll("actorIds")).toEqual(["user-a,user-b"]);
        expect(createCapture.method).toBe("POST");
        expect(createCapture.contentType).toContain("application/json");
        expect(capturedBody).toMatchObject({
          gpu: { count: 1, id: "NVIDIA L4" },
          image: "runpod/pytorch",
          name: "demo-pod",
        });
        expect(created).toMatchObject({ id: documentedPod.id, status: documentedPod.status });
        expect(deleteCapture.method).toBe("DELETE");
        expect(deleteCapture.url).toBe("https://example.test/api/v2/pods/pod%201");
      })
    )
  );

  it.layer(makeRunpodUnitLayer(), { timeout: "5 seconds" })((it) =>
    it.effect(
      "decodes each declared success status with its own schema",
      Effect.fnUntraced(function* () {
        const testHttp = yield* RunpodTestHttp;
        const runpod = yield* Runpod;
        const createPod = CreatePodParams.make({
          body: { gpu: { id: "NVIDIA L4" }, image: "runpod/pytorch", name: "queued-pod" },
        });

        yield* testHttp.reset;
        yield* testHttp.respondWith(() => Effect.succeed(makeJsonResponse(documentedQueuedPod, 202)));
        const queued = yield* runpod.createPod(createPod);

        yield* testHttp.respondWith(() => Effect.succeed(new Response(null, { status: 204 })));
        const terminated = yield* runpod.podAction(
          PodActionParams.make({ body: { action: "terminate" }, id: "pod-1" })
        );

        yield* testHttp.respondWith(() => Effect.succeed(makeJsonResponse(documentedPod)));
        const stopped = yield* runpod.podAction(PodActionParams.make({ body: { action: "stop" }, id: "pod-1" }));
        const captures = yield* testHttp.captures;
        const actionCapture = yield* captureAt(captures, 2, "pod action capture");
        const actionBody = yield* pipe(
          bodyTextFromCapture(actionCapture, "pod action body"),
          Effect.flatMap(decodeUnknownJsonEffect)
        );

        expect(queued).toMatchObject({ id: documentedQueuedPod.id, status: "QUEUED" });
        expect(terminated).toBeUndefined();
        expect(stopped).toMatchObject({ id: documentedPod.id });
        expect(actionCapture.url).toBe("https://example.test/api/v2/pods/pod-1/action");
        expect(actionBody).toEqual({ action: "stop" });
      })
    )
  );

  it.effect(
    "keeps v2 request body enums strict while GPU ids stay open",
    Effect.fnUntraced(function* () {
      const decoded = yield* decodeUnknownCreatePodRequest({
        cloud: "COMMUNITY",
        gpu: { id: "dynamic-gpu-id" },
        image: "runpod/pytorch",
        name: "demo",
      });
      const error = yield* decodeUnknownCreatePodRequest({ cloud: "ALL", name: "demo" }).pipe(Effect.flip);

      expect(decoded).toMatchObject({ cloud: "COMMUNITY", gpu: { id: "dynamic-gpu-id" } });
      expect(error._tag).toBe("SchemaError");
    })
  );

  it.layer(makeRunpodUnitLayer(), { timeout: "5 seconds" })((it) =>
    it.effect(
      "refuses a body key that bypassed the constructor while record fields keep any key",
      Effect.fnUntraced(function* () {
        const testHttp = yield* RunpodTestHttp;
        const runpod = yield* Runpod;
        const params = CreatePodParams.make({ body: { image: "runpod/pytorch", name: "demo" } });
        const keyAdded = Reflect.set(params.body, "dataCenterId", "US-KS-2");

        yield* testHttp.reset;
        const failure = yield* runpod.createPod(params).pipe(Effect.flip);
        const refusedCaptures = yield* testHttp.captures;
        yield* runpod.createPod(
          CreatePodParams.make({
            body: { env: { ANY_NAME: "1", HF_HOME: "/models" }, image: "runpod/pytorch", name: "demo" },
          })
        );
        const createCapture = yield* pipe(
          testHttp.captures,
          Effect.flatMap((captures) => captureAt(captures, 0, "create pod capture"))
        );
        const sentBody = yield* pipe(
          bodyTextFromCapture(createCapture, "create pod body"),
          Effect.flatMap(decodeUnknownJsonEffect)
        );

        expect(keyAdded).toBe(true);
        assertSome(failure.operationId, "createPod");
        expect(
          failure.reason,
          "make drops unknown keys, so the encode check refuses a v1 field written onto the body after construction"
        ).toBe("request encoding");
        const sanitizedCauseLabel = failure.cause;
        assertSome(sanitizedCauseLabel, "SchemaError");
        expect(refusedCaptures).toEqual([]);
        expect(sentBody).toMatchObject({ env: { ANY_NAME: "1", HF_HOME: "/models" } });
      })
    )
  );

  it.layer(makeRunpodUnitLayer(), { timeout: "5 seconds" })((it) =>
    it.effect(
      "maps RFC 9457 problems, bare status failures, and transport failures into typed errors",
      Effect.fnUntraced(function* () {
        const testHttp = yield* RunpodTestHttp;
        const runpod = yield* Runpod;

        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(
            makeJsonResponse(
              {
                detail: "request body failed validation",
                errors: ["$: additional properties 'dataCenterId' not allowed"],
                status: 422,
                title: "Unprocessable Entity",
              },
              422,
              "application/problem+json"
            )
          )
        );
        const problemError = yield* runpod.listPods().pipe(Effect.flip);

        yield* testHttp.respondWith(() =>
          Effect.succeed(
            new Response("<html>bad gateway</html>", { headers: { "content-type": "text/html" }, status: 502 })
          )
        );
        const statusError = yield* runpod.listPods().pipe(Effect.flip);

        yield* testHttp.respondWith((request) =>
          Effect.fail(
            new HttpClientError.HttpClientError({
              reason: new HttpClientError.TransportError({
                request,
              }),
            })
          )
        );
        const transportError = yield* runpod.listPods().pipe(Effect.flip);
        const problem = yield* Effect.fromOption(problemError.problem);

        expect(problemError.reason).toBe("response status");
        assertSome(problemError.status, 422);
        assertSome(problemError.operationId, "listPods");
        assertSome(problem.title, "Unprocessable Entity");
        assertSome(problem.detail, "request body failed validation");
        expect(problem.errors).toEqual(["$: additional properties 'dataCenterId' not allowed"]);
        expect(statusError.reason).toBe("response status");
        assertSome(statusError.status, 502);
        assertNone(statusError.problem);
        expect(transportError.reason).toBe("transport");
        assertSome(transportError.cause, "HttpClientError:TransportError");
      })
    )
  );

  it.layer(makeRunpodUnitLayer(), { timeout: "5 seconds" })((it) =>
    it.effect(
      "streams every item of a cursor-paginated list",
      Effect.fnUntraced(function* () {
        const testHttp = yield* RunpodTestHttp;
        const runpod = yield* Runpod;
        const [firstPod] = documentedPodList.pods;

        yield* testHttp.reset;
        yield* testHttp.respondWith(
          flow(
            HttpClientRequest.toUrl,
            O.flatMap((url) => O.fromNullOr(url.searchParams.get("cursor"))),
            O.match({
              onNone: () =>
                makeJsonResponse({
                  pagination: { hasNextPage: true, nextCursor: "page-2" },
                  pods: [{ ...firstPod, id: "pod-a" }],
                }),
              onSome: () =>
                makeJsonResponse({
                  pagination: { hasNextPage: false, nextCursor: null },
                  pods: [{ ...firstPod, id: "pod-b" }],
                }),
            }),
            Effect.succeed
          )
        );

        const pods = yield* Stream.runCollect(runpod.listPodsStream(ListPodsParams.make({ limit: 1 })));
        const captures = yield* testHttp.captures;
        const secondPage = yield* captureAt(captures, 1, "second page capture");

        expect(A.map(pods, (pod) => pod.id)).toEqual(["pod-a", "pod-b"]);
        expect(captures).toHaveLength(2);
        expect(new URL(secondPage.url).searchParams.get("cursor")).toBe("page-2");
        expect(new URL(secondPage.url).searchParams.get("limit")).toBe("1");
      })
    )
  );

  it.layer(makeRunpodUnitLayer(), { timeout: "5 seconds" })((it) =>
    it.effect(
      "fails a paginated stream whose page repeats the cursor it was requested with",
      Effect.fnUntraced(function* () {
        const testHttp = yield* RunpodTestHttp;
        const runpod = yield* Runpod;
        const [firstPod] = documentedPodList.pods;

        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(
            makeJsonResponse({
              pagination: { hasNextPage: true, nextCursor: "page-2" },
              pods: [{ ...firstPod, id: "pod-a" }],
            })
          )
        );

        const failure = yield* Stream.runCollect(runpod.listPodsStream()).pipe(Effect.flip);
        const captures = yield* testHttp.captures;

        expect(failure.reason).toBe("pagination");
        assertSome(failure.operationId, "listPods");
        expect(captures).toHaveLength(2);
      })
    )
  );

  it.layer(makeRunpodUnitLayer(), { timeout: "5 seconds" })((it) =>
    it.effect(
      "keeps the status-only error when a problem body never finishes",
      Effect.fnUntraced(function* () {
        const testHttp = yield* RunpodTestHttp;
        const runpod = yield* Runpod;

        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(
            new Response(new ReadableStream<Uint8Array>(), {
              headers: { "content-type": "application/problem+json" },
              status: 503,
            })
          )
        );

        const fiber = yield* runpod.listPods().pipe(Effect.flip, Effect.forkChild);
        yield* TestClock.adjust("5 seconds");
        const failure = yield* Fiber.join(fiber);

        expect(failure.reason).toBe("response status");
        assertSome(failure.status, 503);
        assertNone(failure.problem);
      })
    )
  );

  it.layer(makeRunpodUnitLayer(), { timeout: "5 seconds" })((it) =>
    it.effect(
      "parses Server-Sent Events log streams and resumes with Last-Event-ID",
      Effect.fnUntraced(function* () {
        const testHttp = yield* RunpodTestHttp;
        const runpod = yield* Runpod;

        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(new Response(logEvents, { headers: { "content-type": "text/event-stream" } }))
        );

        const events = yield* Stream.runCollect(
          runpod.getPodLogs(
            GetPodLogsParams.make({ id: "pod-1", lastEventId: "2026-06-01T12:02:02Z/000000000000", tail: 10 })
          )
        );
        const capture = yield* pipe(
          testHttp.captures,
          Effect.flatMap((captures) => captureAt(captures, 0, "logs capture"))
        );

        expect(A.map(events, (event) => event.id)).toEqual([
          "2026-06-01T12:02:03Z/000000000001",
          "2026-06-01T12:02:04Z/000000000002",
        ]);
        expect(A.map(events, (event) => event.data)).toEqual([
          '{"ts":"2026-06-01T12:02:03Z","source":"container","line":"Model loaded."}',
          '{"ts":"2026-06-01T12:02:04Z","source":"container","line":"Serving."}',
        ]);
        expect(capture.url).toBe("https://example.test/api/v2/pods/pod-1/logs?tail=10");
        expect(capture.headers.accept).toBe("text/event-stream");
        expect(capture.headers["last-event-id"]).toBe("2026-06-01T12:02:02Z/000000000000");
      })
    )
  );

  it.layer(makeRunpodUnitLayer(RunpodConfigInput.make({ apiUrl: "https://example.test/api/v2" })), {
    timeout: "5 seconds",
  })((it) =>
    it.effect(
      "serves public operations without a key and rejects authenticated ones before sending",
      Effect.fnUntraced(function* () {
        const testHttp = yield* RunpodTestHttp;
        const runpod = yield* Runpod;
        yield* testHttp.reset;

        yield* runpod.getOpenApi();
        const error = yield* runpod.listPods().pipe(Effect.flip);
        const captures = yield* testHttp.captures;

        expect(error.reason).toBe("config");
        assertSome(error.operationId, "listPods");
        expect(captures).toHaveLength(1);
      })
    )
  );

  it.layer(makeRunpodUnitLayer(), { timeout: "5 seconds" })((it) =>
    it.effect(
      "supports raw requests for ahead-of-spec endpoints",
      Effect.fnUntraced(function* () {
        const testHttp = yield* RunpodTestHttp;
        const runpod = yield* Runpod;
        yield* testHttp.reset;

        const response = yield* runpod.raw(
          RunpodRawRequest.make({
            authenticated: false,
            method: "GET",
            path: "future",
            query: {
              limit: 1,
            },
          })
        );
        const capture = yield* pipe(
          testHttp.captures,
          Effect.flatMap((captures) => captureAt(captures, 0, "raw capture"))
        );

        expect(response.status).toBe(200);
        expect(response.body).toMatchObject({ id: documentedPod.id });
        expect(capture.headers.authorization).toBeUndefined();
        expect(capture.url).toBe("https://example.test/api/v2/future?limit=1");
      })
    )
  );

  it.layer(makeRunpodDocsUnitLayer(), { timeout: "5 seconds" })((it) =>
    it.effect(
      "parses and fetches the Runpod llms.txt documentation index",
      Effect.fnUntraced(function* () {
        const parsed = yield* parseRunpodDocsIndex(llmsText);
        expect(parsed.title).toBe("Runpod Documentation");
        expect(parsed.entries).toHaveLength(2);
        expect(parsed.entries[0]?.title).toBe("Pods");
        assertSome(
          O.flatMap(A.head(parsed.entries), (entry) => entry.description),
          "Manage GPU pods"
        );

        const testHttp = yield* RunpodTestHttp;
        yield* testHttp.reset;
        yield* testHttp.respondWith(() =>
          Effect.succeed(
            new Response(llmsText, {
              headers: {
                "content-type": "text/plain",
              },
            })
          )
        );

        const docs = yield* RunpodDocs;
        const fetched = yield* docs.fetchIndex;
        const capture = yield* pipe(
          testHttp.captures,
          Effect.flatMap((captures) => captureAt(captures, 0, "docs capture"))
        );

        expect(fetched.entries).toHaveLength(2);
        expect(capture.headers.accept).toBe("text/plain");
        expect(capture.url).toBe("https://docs.example.test/llms.txt");
      })
    )
  );

  it.prop(
    "round-trips schema-derived config, error, problem, raw, and docs models",
    [
      Arbitrary.schema(RunpodConfigInput),
      Arbitrary.schema(RunpodDocsConfigInput),
      RunpodRawRequestArbitrary,
      Arbitrary.schema(RunpodRawResponse),
      Arbitrary.schema(RunpodErrorOptions),
      Arbitrary.schema(RunpodError),
      Arbitrary.schema(RunpodProblem),
      Arbitrary.schema(RunpodDocsErrorOptions),
      Arbitrary.schema(RunpodDocsError),
      Arbitrary.schema(RunpodDocsIndexEntry),
      Arbitrary.schema(RunpodDocsIndex),
    ],
    ([
      config,
      docsConfig,
      rawRequest,
      rawResponse,
      errorOptions,
      error,
      problem,
      docsErrorOptions,
      docsError,
      entry,
      index,
    ]) => {
      expectRoundTrip(RunpodConfigInput, config);
      expectRoundTrip(RunpodDocsConfigInput, docsConfig);
      expectRoundTrip(RunpodRawRequest, rawRequest);
      expectRoundTrip(RunpodRawResponse, rawResponse);
      expectRoundTrip(RunpodErrorOptions, errorOptions);
      expectRoundTrip(RunpodError, error);
      expectRoundTrip(RunpodProblem, problem);
      expectRoundTrip(RunpodDocsErrorOptions, docsErrorOptions);
      expectRoundTrip(RunpodDocsError, docsError);
      expectRoundTrip(RunpodDocsIndexEntry, entry);
      expectRoundTrip(RunpodDocsIndex, index);
      expect(encode(RunpodRawRequest, RunpodRawRequest.make({ method: "GET", path: "future" }))).toMatchObject({
        path: "/future",
      });
    },
    { arbitrary: fcRuns(25) }
  );
});
