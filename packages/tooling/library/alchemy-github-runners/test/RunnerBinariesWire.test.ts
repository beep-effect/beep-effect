import { ReleaseAsset, RunnerBinaries, runnerBinariesLive } from "@beep/alchemy-github-runners";
import * as AwsCredentials from "@distilled.cloud/aws/Credentials";
import * as AwsEndpoint from "@distilled.cloud/aws/Endpoint";
import { describe, expect, it } from "@effect/vitest";
import { deepStrictEqual } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as Str from "effect/String";
import { makeWireS3 } from "./support/WireS3.ts";
import type { WireRequest } from "./support/WireS3.ts";

const mib = 1024 * 1024;
const bucket = "binaries";
const key = "actions-runner-linux.tar.gz";
const assetName = "actions-runner-linux-x64-2.338.2.tar.gz";

const lambdaTransportOnStubS3 = (origin: string) =>
  runnerBinariesLive.pipe(
    Layer.provide(Layer.mergeAll(FetchHttpClient.layer, AwsCredentials.mock, AwsEndpoint.of(origin)))
  );

const mirrorFrom = Effect.fn("RunnerBinariesWire.mirrorFrom")(function* (origin: string) {
  const context = yield* Layer.build(lambdaTransportOnStubS3(origin));
  return yield* Context.get(context, RunnerBinaries).mirror({
    bucket,
    key,
    asset: ReleaseAsset.make({ name: assetName, downloadUrl: `${origin}/download/${assetName}` }),
  });
});

const isS3 = (request: WireRequest) =>
  !Str.startsWith("/download/")(request.target) && !Str.startsWith("/assets/")(request.target);

const header = (request: WireRequest, name: string) => O.getOrUndefined(R.get(request.headers, name));

const s3RequestFraming = (request: WireRequest) => ({
  method: request.method,
  rejected: request.rejected,
  contentLength: header(request, "content-length"),
  bodyBytes: `${request.body.byteLength}`,
  transferEncoding: header(request, "transfer-encoding"),
  chunkedSignature: Str.startsWith("STREAMING-")(header(request, "x-amz-content-sha256") ?? ""),
  awsChunked: Str.includes("aws-chunked")(header(request, "content-encoding") ?? ""),
});

const digest = (bytes: Uint8Array) =>
  Effect.promise(() => crypto.subtle.digest("SHA-256", new Uint8Array(bytes))).pipe(
    Effect.map((buffer) => new Uint8Array(buffer))
  );

const joined = (parts: ReadonlyArray<Uint8Array>) => {
  const out = new Uint8Array(A.reduce(parts, 0, (total, part) => total + part.byteLength));
  A.reduce(parts, 0, (offset, part) => {
    out.set(part, offset);
    return offset + part.byteLength;
  });
  return out;
};

describe("RunnerBinaries.mirror on the wire (FetchHttpClient, as in the Lambda)", () => {
  it.effect(
    "uploads a multi-part asset with a fixed Content-Length on every S3 request and no chunked framing",
    () =>
      Effect.gen(function* () {
        const stub = yield* makeWireS3({ assetSize: 17 * mib + 12_345, assetContentLength: true });
        const outcome = yield* mirrorFrom(stub.origin).pipe(Effect.result);
        const received = yield* stub.requests;
        const s3 = A.filter(received, isS3);
        for (const request of s3) {
          const frame = s3RequestFraming(request);
          expect(frame, request.head).toStrictEqual({
            ...frame,
            rejected: false,
            contentLength: frame.bodyBytes,
            transferEncoding: undefined,
            chunkedSignature: false,
            awsChunked: false,
          });
        }
        expect(outcome._tag).toBe("Success");
        const parts = A.filter(
          s3,
          (request) => request.method === "PUT" && Str.includes("partNumber=")(request.target)
        );
        expect(A.map(parts, (part) => part.body.byteLength)).toStrictEqual([16 * mib, mib + 12_345]);
        const uploadedDigest = yield* digest(joined(A.map(parts, (part) => part.body)));
        const assetDigest = yield* digest(stub.asset);
        expect(uploadedDigest).toStrictEqual(assetDigest);
        const create = A.findFirst(
          s3,
          (request) => request.method === "POST" && Str.endsWith("?uploads")(request.target)
        );
        deepStrictEqual(
          O.map(create, (request) => header(request, "x-amz-tagging")),
          O.some(`name=${assetName}`)
        );
        const complete = A.findFirst(
          s3,
          (request) => request.method === "POST" && Str.includes("uploadId=")(request.target)
        );
        deepStrictEqual(
          O.map(complete, (request) =>
            Str.includes("<PartNumber>2</PartNumber>")(new TextDecoder().decode(request.body))
          ),
          O.some(true)
        );
        expect(A.some(s3, (request) => request.method === "DELETE")).toBe(false);
      }),
    60_000
  );

  it.effect(
    "aborts the multipart upload and completes nothing when the download ends short",
    () =>
      Effect.gen(function* () {
        const stub = yield* makeWireS3({ assetSize: 17 * mib, assetContentLength: true, truncateBy: mib });
        const error = yield* mirrorFrom(stub.origin).pipe(Effect.flip);
        const received = yield* stub.requests;
        const s3 = A.filter(received, isS3);
        expect([error._tag, error.operation]).toStrictEqual(["GitHubApiError", "downloadAsset"]);
        expect(A.map(s3, (request) => request.method)).toStrictEqual(["POST", "PUT", "DELETE"]);
        expect(A.some(s3, (request) => request.rejected)).toBe(false);
      }),
    60_000
  );

  it.effect("fails closed with a typed error and writes nothing to S3 when the asset has no Content-Length", () =>
    Effect.gen(function* () {
      const stub = yield* makeWireS3({ assetSize: 4096, assetContentLength: false });
      const error = yield* mirrorFrom(stub.origin).pipe(Effect.flip);
      expect([error._tag, error.operation]).toStrictEqual(["GitHubApiError", "downloadAsset"]);
      const received = yield* stub.requests;
      expect(A.filter(received, isS3)).toStrictEqual([]);
    })
  );
});
