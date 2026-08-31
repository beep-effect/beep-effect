import { acquirePinnedPersonMatchArtifactForTest } from "@beep/repo-cli/test/Files";
import { PosInt, Sha256Hex } from "@beep/schema";
import { A } from "@beep/utils";
import { NodeServices } from "@effect/platform-node";
import { sha256 } from "@noble/hashes/sha2.js";
import { Data, Effect, Encoding, FileSystem, Layer, Match, Path, Ref, Tuple } from "effect";
import * as TestConsole from "effect/testing/TestConsole";
import { HttpClient, HttpClientError, HttpClientResponse } from "effect/unstable/http";
import { describe, expect, it } from "vitest";
import type * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";

type TestResponder = (
  request: HttpClientRequest.HttpClientRequest,
  call: number
) => Effect.Effect<HttpClientResponse.HttpClientResponse, HttpClientError.HttpClientError>;

const provideScopedLayer =
  <ROut, E2, RIn>(layer: Layer.Layer<ROut, E2, RIn>) =>
  <A, E, R>(effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | E2, RIn | Exclude<R, ROut>> =>
    Effect.scoped(Layer.build(layer).pipe(Effect.flatMap((context) => effect.pipe(Effect.provide(context)))));

const testLayer = Layer.mergeAll(NodeServices.layer, TestConsole.layer);

const sha256Hex = (bytes: Uint8Array): Sha256Hex => Sha256Hex.make(Encoding.encodeHex(sha256(bytes)));

const withTempModelRoot = <A, E, R>(use: (modelRoot: string, targetPath: string) => Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const modelRoot = yield* fs.makeTempDirectory();
      return Tuple.make(modelRoot, path.join(modelRoot, "model.safetensors"));
    }),
    ([modelRoot, targetPath]) => use(modelRoot, targetPath),
    ([modelRoot]) =>
      FileSystem.FileSystem.use((fs) => fs.remove(modelRoot, { force: true, recursive: true }).pipe(Effect.ignore))
  ).pipe(provideScopedLayer(testLayer));

const makeRecordingClient = Effect.fnUntraced(function* (respond: TestResponder) {
  const calls = yield* Ref.make(0);
  const requests = yield* Ref.make<ReadonlyArray<readonly [range: string, acceptEncoding: string]>>(A.empty());
  const client = HttpClient.make((request) =>
    Effect.gen(function* () {
      const call = yield* Ref.getAndUpdate(calls, (count) => count + 1);
      yield* Ref.update(
        requests,
        A.append(Tuple.make(request.headers.range ?? "", request.headers["accept-encoding"] ?? ""))
      );
      return yield* respond(request, call);
    })
  );
  return Tuple.make(client, Ref.get(requests));
});

const makeResponse = (
  request: HttpClientRequest.HttpClientRequest,
  body: BodyInit,
  status: number,
  contentRange: string,
  contentLength?: string,
  contentEncoding?: string
): HttpClientResponse.HttpClientResponse => {
  const headers = new Headers({ "content-range": contentRange });
  if (contentLength !== undefined) {
    headers.set("content-length", contentLength);
  }
  if (contentEncoding !== undefined) {
    headers.set("content-encoding", contentEncoding);
  }
  return HttpClientResponse.fromWeb(request, new Response(body, { headers, status }));
};

const makeSuccessfulResponse = (
  request: HttpClientRequest.HttpClientRequest,
  payload: Uint8Array,
  start: number,
  end: number
): HttpClientResponse.HttpClientResponse => {
  const body = payload.slice(start, end + 1);
  return makeResponse(request, body, 206, `bytes ${start}-${end}/${payload.byteLength}`, `${body.byteLength}`);
};

const respondWithPayload = (
  request: HttpClientRequest.HttpClientRequest,
  payload: Uint8Array
): Effect.Effect<HttpClientResponse.HttpClientResponse> =>
  Match.value(request.headers.range).pipe(
    Match.when("bytes=0-2", () => Effect.succeed(makeSuccessfulResponse(request, payload, 0, 2))),
    Match.when("bytes=3-5", () => Effect.succeed(makeSuccessfulResponse(request, payload, 3, 5))),
    Match.orElse((range) => Effect.die(`Unexpected fixture range: ${range ?? "missing"}`))
  );

class FixtureDecodeFailure extends Data.TaggedError("FixtureDecodeFailure") {}

const makeMidBodyFailureResponse = (
  request: HttpClientRequest.HttpClientRequest,
  firstChunk: Uint8Array,
  totalSize: number
): HttpClientResponse.HttpClientResponse => {
  let emitted = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      Match.value(emitted).pipe(
        Match.when(false, () => {
          emitted = true;
          controller.enqueue(firstChunk);
        }),
        Match.orElse(() => controller.error(new FixtureDecodeFailure()))
      );
    },
  });
  return makeResponse(request, body, 206, `bytes 0-2/${totalSize}`, "3");
};

const runAcquisition = (
  client: HttpClient.HttpClient,
  modelRoot: string,
  targetPath: string,
  expectedSize: PosInt,
  expectedSha256: Sha256Hex,
  rangeBytes: PosInt
) =>
  acquirePinnedPersonMatchArtifactForTest(modelRoot, targetPath, expectedSize, expectedSha256, rangeBytes).pipe(
    Effect.provideService(HttpClient.HttpClient, client)
  );

const assertCleanFailure = Effect.fnUntraced(function* (
  client: HttpClient.HttpClient,
  modelRoot: string,
  targetPath: string,
  expectedSize: PosInt,
  expectedSha256: Sha256Hex,
  rangeBytes: PosInt,
  expectedMessage: string
) {
  const fs = yield* FileSystem.FileSystem;
  const error = yield* runAcquisition(client, modelRoot, targetPath, expectedSize, expectedSha256, rangeBytes).pipe(
    Effect.flip
  );
  expect(error.message).toContain(expectedMessage);
  expect(yield* fs.exists(targetPath)).toBe(false);
  expect(yield* fs.readDirectory(modelRoot)).toEqual([]);
});

describe("person-match ranged model acquisition", { concurrent: false }, () => {
  it("downloads multiple exact ranges and atomically installs the verified artifact", () =>
    Effect.runPromise(
      withTempModelRoot((modelRoot, targetPath) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const payload = Uint8Array.of(1, 2, 3, 4, 5, 6);
          const [client, recordedRequests] = yield* makeRecordingClient((request) =>
            respondWithPayload(request, payload)
          );

          yield* runAcquisition(
            client,
            modelRoot,
            targetPath,
            PosInt.make(payload.byteLength),
            sha256Hex(payload),
            PosInt.make(3)
          );

          expect(A.fromIterable(yield* fs.readFile(targetPath))).toEqual(A.fromIterable(payload));
          expect(yield* fs.readDirectory(modelRoot)).toEqual(["model.safetensors"]);
          expect(yield* recordedRequests).toEqual([
            ["bytes=0-2", "identity"],
            ["bytes=3-5", "identity"],
          ]);
        })
      )
    ));

  it("retries a transport failure before installing the exact bytes once", () =>
    Effect.runPromise(
      withTempModelRoot((modelRoot, targetPath) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const payload = Uint8Array.of(1, 2, 3, 4, 5, 6);
          const [client, recordedRequests] = yield* makeRecordingClient((request, call) =>
            Match.value(call).pipe(
              Match.when(0, () =>
                Effect.fail(
                  new HttpClientError.HttpClientError({
                    reason: new HttpClientError.TransportError({
                      cause: "fixture transport failure",
                      request,
                    }),
                  })
                )
              ),
              Match.orElse(() => respondWithPayload(request, payload))
            )
          );

          yield* runAcquisition(
            client,
            modelRoot,
            targetPath,
            PosInt.make(payload.byteLength),
            sha256Hex(payload),
            PosInt.make(3)
          );

          expect(A.fromIterable(yield* fs.readFile(targetPath))).toEqual(A.fromIterable(payload));
          expect(yield* recordedRequests).toEqual([
            ["bytes=0-2", "identity"],
            ["bytes=0-2", "identity"],
            ["bytes=3-5", "identity"],
          ]);
        })
      )
    ));

  it("restarts a range after a mid-body decode failure without duplicating staged bytes", () =>
    Effect.runPromise(
      withTempModelRoot((modelRoot, targetPath) =>
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const payload = Uint8Array.of(1, 2, 3, 4, 5, 6);
          const [client, recordedRequests] = yield* makeRecordingClient((request, call) =>
            Match.value(call).pipe(
              Match.when(0, () =>
                Effect.succeed(makeMidBodyFailureResponse(request, Uint8Array.of(1), payload.byteLength))
              ),
              Match.orElse(() => respondWithPayload(request, payload))
            )
          );

          yield* runAcquisition(
            client,
            modelRoot,
            targetPath,
            PosInt.make(payload.byteLength),
            sha256Hex(payload),
            PosInt.make(3)
          );

          expect(A.fromIterable(yield* fs.readFile(targetPath))).toEqual(A.fromIterable(payload));
          expect(yield* recordedRequests).toEqual([
            ["bytes=0-2", "identity"],
            ["bytes=0-2", "identity"],
            ["bytes=3-5", "identity"],
          ]);
        })
      )
    ));

  it.each([
    ["status", 200, "bytes 0-2/3", "3", undefined, "returned HTTP 200"],
    ["Content-Range", 206, "bytes 1-3/3", "3", undefined, "invalid Content-Range"],
    ["Content-Length", 206, "bytes 0-2/3", "4", undefined, "invalid Content-Length"],
    ["Content-Encoding", 206, "bytes 0-2/3", "3", "gzip", "unsupported Content-Encoding"],
  ])(
    "rejects an invalid %s response and removes all staging",
    (_label, status, contentRange, length, encoding, message) =>
      Effect.runPromise(
        withTempModelRoot((modelRoot, targetPath) =>
          Effect.gen(function* () {
            const payload = Uint8Array.of(1, 2, 3);
            const [client, recordedRequests] = yield* makeRecordingClient((request) =>
              Effect.succeed(makeResponse(request, payload, status, contentRange, length, encoding))
            );
            yield* assertCleanFailure(
              client,
              modelRoot,
              targetPath,
              PosInt.make(payload.byteLength),
              sha256Hex(payload),
              PosInt.make(3),
              message
            );
            expect(A.length(yield* recordedRequests)).toBe(1);
          })
        )
      )
  );

  it("rejects an oversized range body and removes all staging", () =>
    Effect.runPromise(
      withTempModelRoot((modelRoot, targetPath) =>
        Effect.gen(function* () {
          const payload = Uint8Array.of(1, 2, 3);
          const oversized = Uint8Array.of(1, 2, 3, 4);
          const [client, recordedRequests] = yield* makeRecordingClient((request) =>
            Effect.succeed(makeResponse(request, oversized, 206, "bytes 0-2/3"))
          );
          yield* assertCleanFailure(
            client,
            modelRoot,
            targetPath,
            PosInt.make(payload.byteLength),
            sha256Hex(payload),
            PosInt.make(3),
            "exceeded its 3-byte ceiling"
          );
          expect(A.length(yield* recordedRequests)).toBe(1);
        })
      )
    ));

  it("rejects a short range body and removes all staging", () =>
    Effect.runPromise(
      withTempModelRoot((modelRoot, targetPath) =>
        Effect.gen(function* () {
          const payload = Uint8Array.of(1, 2, 3);
          const short = Uint8Array.of(1, 2);
          const [client, recordedRequests] = yield* makeRecordingClient((request) =>
            Effect.succeed(makeResponse(request, short, 206, "bytes 0-2/3"))
          );
          yield* assertCleanFailure(
            client,
            modelRoot,
            targetPath,
            PosInt.make(payload.byteLength),
            sha256Hex(payload),
            PosInt.make(3),
            "ended after 2 bytes; expected 3"
          );
          expect(A.length(yield* recordedRequests)).toBe(1);
        })
      )
    ));

  it("rejects a final SHA mismatch before installation and removes all staging", () =>
    Effect.runPromise(
      withTempModelRoot((modelRoot, targetPath) =>
        Effect.gen(function* () {
          const payload = Uint8Array.of(1, 2, 3, 4, 5, 6);
          const otherPayload = Uint8Array.of(6, 5, 4, 3, 2, 1);
          const [client, recordedRequests] = yield* makeRecordingClient((request) =>
            respondWithPayload(request, payload)
          );
          yield* assertCleanFailure(
            client,
            modelRoot,
            targetPath,
            PosInt.make(payload.byteLength),
            sha256Hex(otherPayload),
            PosInt.make(3),
            "failed integrity validation"
          );
          expect(A.length(yield* recordedRequests)).toBe(2);
        })
      )
    ));
});
