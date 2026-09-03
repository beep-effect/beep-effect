import { $RunpodId } from "@beep/identity";
import {
  CreatePodRequest,
  DeletePodRequest,
  ListPodsRequest,
  PodCreateInput,
  parseRunpodDocsIndex,
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
  RunpodRawRequest,
  RunpodRawResponse,
} from "@beep/runpod";
import { decodeJsonString } from "@beep/schema/Json";
import { A, Str } from "@beep/utils";
import { describe, expect, layer } from "@effect/vitest";
import { Context, Effect, Equal, Layer, pipe, Redacted, Ref, Result } from "effect";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientError from "effect/unstable/http/HttpClientError";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";

const $TestI = $RunpodId.create("Runpod.service.test");

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

class CapturedCreatePodBody extends S.Class<CapturedCreatePodBody>($TestI`CapturedCreatePodBody`)(
  {
    name: S.String,
  },
  $TestI.annote("CapturedCreatePodBody", {
    description: "Minimal request body decoded from Runpod create pod test captures.",
  })
) {}

const decodeCapturedCreatePodBody = S.decodeUnknownEffect(CapturedCreatePodBody);
const normalizeRawPathForTest = (path: string): string => (Str.startsWith("/")(path) ? path : `/${path}`);

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

const assertSchemaRoundTrip = <Codec extends S.Codec<unknown, unknown>>(
  schema: Codec,
  arbitrary = S.toArbitrary(schema)(fc)
): void => {
  fc.assert(
    fc.property(arbitrary, (value) => {
      expectRoundTrip(schema, value);
    }),
    { numRuns: 25 }
  );
};

const RunpodRawRequestArbitrary = S.toArbitrary(RunpodRawRequest)(fc).map((request) =>
  RunpodRawRequest.make({
    ...request,
    path: normalizeRawPathForTest(request.path),
  })
);

const makeJsonResponse = (body: unknown, status = 200) =>
  Response.json(body, {
    headers: {
      "content-type": "application/json",
    },
    status,
  });

const defaultRespond: RunpodTestRespond = (request) => {
  if (request.method === "DELETE") {
    return Effect.succeed(new Response(null, { status: 204 }));
  }

  return Effect.succeed(
    makeJsonResponse(Str.endsWith("/pods")(request.url) && request.method === "GET" ? [] : { id: "pod-1" })
  );
};

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
      reset: Effect.all([Ref.set(capturesRef, []), Ref.set(respondRef, defaultRespond)], { discard: true }),
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
    apiUrl: "https://example.test/api/v1///",
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

describe("@beep/runpod", () => {
  layer(makeRunpodUnitLayer())((it) =>
    it.effect("keeps the generated operation surface complete", () =>
      Effect.sync(() => {
        const operationKeys = R.keys(RUNPOD_OPERATION_SPECS);

        expect(operationKeys).toHaveLength(37);
        expect(operationKeys).toContain("updatePodViaPost");
        expect(operationKeys).toContain("updateEndpointViaPost");
        expect(operationKeys).toContain("updateTemplateViaPost");
        expect(operationKeys).toContain("updateNetworkVolumeViaPost");
      })
    )
  );

  layer(makeRunpodUnitLayer())((it) =>
    it.effect(
      "sends typed operations with expected auth, query, path, and JSON body encoding",
      Effect.fnUntraced(function* () {
        const testHttp = yield* RunpodTestHttp;
        const runpod = yield* Runpod;
        yield* testHttp.reset;

        yield* runpod.getOpenAPI();
        yield* runpod.listPods(
          ListPodsRequest.make({
            gpuTypeId: ["NVIDIA L4"],
            includeMachine: true,
          })
        );
        yield* runpod.createPod(
          CreatePodRequest.make({
            body: PodCreateInput.make({
              name: "demo-pod",
            }),
          })
        );
        yield* runpod.deletePod(DeletePodRequest.make({ podId: "pod 1" }));

        const captures = yield* testHttp.captures;
        const openApiCapture = yield* captureAt(captures, 0, "openapi capture");
        const listCapture = yield* captureAt(captures, 1, "list pods capture");
        const createCapture = yield* captureAt(captures, 2, "create pod capture");
        const deleteCapture = yield* captureAt(captures, 3, "delete pod capture");
        const capturedBody = yield* pipe(
          bodyTextFromCapture(createCapture, "create pod body"),
          Effect.flatMap(decodeJsonString),
          Effect.flatMap(decodeCapturedCreatePodBody)
        );

        expect(openApiCapture.headers.authorization).toBeUndefined();
        expect(openApiCapture.url).toContain("https://example.test/api/v1/openapi.json");
        expect(listCapture.headers.authorization).toBe("Bearer test-key");
        expect(listCapture.url).toContain("includeMachine=true");
        expect(listCapture.url).toContain("gpuTypeId=");
        expect(createCapture.method).toBe("POST");
        expect(createCapture.contentType).toContain("application/json");
        expect(capturedBody.name).toBe("demo-pod");
        expect(deleteCapture.method).toBe("DELETE");
        expect(deleteCapture.url).toContain("/pods/pod%201");
      })
    )
  );

  layer(makeRunpodUnitLayer())((it) =>
    it.effect(
      "enforces generated OpenAPI enum schemas while leaving dynamic ids flexible",
      Effect.fnUntraced(function* () {
        const decodePodCreateInput = S.decodeUnknownEffect(PodCreateInput);

        const decoded = yield* decodePodCreateInput({
          cloudType: "SECURE",
          computeType: "GPU",
          gpuTypeIds: ["dynamic-gpu-id"],
        });
        const error = yield* decodePodCreateInput({
          cloudType: "LOCAL",
        }).pipe(Effect.flip);

        expect(decoded).toMatchObject({
          cloudType: "SECURE",
          computeType: "GPU",
          gpuTypeIds: ["dynamic-gpu-id"],
        });
        expect(error).toBeDefined();
      })
    )
  );

  layer(makeRunpodUnitLayer())((it) =>
    it.effect(
      "maps status and transport failures into typed errors",
      Effect.fnUntraced(function* () {
        const testHttp = yield* RunpodTestHttp;
        const runpod = yield* Runpod;

        yield* testHttp.reset;
        yield* testHttp.respondWith(() => Effect.succeed(makeJsonResponse({ message: "nope" }, 500)));
        const statusError = yield* runpod.listPods().pipe(Effect.flip);

        yield* testHttp.reset;
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

        expect(statusError.reason).toBe("response status");
        expect(statusError.status).toEqual(O.some(500));
        expect(statusError.operationId).toEqual(O.some("ListPods"));
        expect(transportError.reason).toBe("transport");
        expect(transportError.cause).toEqual(O.some("HttpClientError:TransportError"));
      })
    )
  );

  layer(makeRunpodUnitLayer())((it) =>
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
        expect(response.body).toEqual({ id: "pod-1" });
        expect(capture.headers.authorization).toBeUndefined();
        expect(capture.url).toContain("https://example.test/api/v1/future");
        expect(capture.url).toContain("limit=1");
      })
    )
  );

  layer(makeRunpodDocsUnitLayer())((it) =>
    it.effect(
      "parses and fetches the Runpod llms.txt documentation index",
      Effect.fnUntraced(function* () {
        const parsed = yield* parseRunpodDocsIndex(llmsText);
        expect(parsed.title).toBe("Runpod Documentation");
        expect(parsed.entries).toHaveLength(2);
        expect(parsed.entries[0]?.title).toBe("Pods");
        expect(parsed.entries[0]?.description).toEqual(O.some("Manage GPU pods"));

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

  layer(makeRunpodUnitLayer())((it) =>
    it("round-trips schema-derived config, error, raw, and docs models", () => {
      fc.assert(
        fc.property(S.toArbitrary(RunpodConfigInput)(fc), (value) => {
          expectRoundTrip(RunpodConfigInput, value);
        }),
        { numRuns: 25 }
      );
      assertSchemaRoundTrip(RunpodDocsConfigInput);
      expect(encode(RunpodRawRequest, RunpodRawRequest.make({ method: "GET", path: "future" }))).toMatchObject({
        path: "/future",
      });
      assertSchemaRoundTrip(RunpodRawRequest, RunpodRawRequestArbitrary);
      assertSchemaRoundTrip(RunpodRawResponse);
      assertSchemaRoundTrip(RunpodErrorOptions);
      assertSchemaRoundTrip(RunpodError);
      assertSchemaRoundTrip(RunpodDocsErrorOptions);
      assertSchemaRoundTrip(RunpodDocsError);
      assertSchemaRoundTrip(RunpodDocsIndexEntry);
      assertSchemaRoundTrip(RunpodDocsIndex);
    })
  );
});
