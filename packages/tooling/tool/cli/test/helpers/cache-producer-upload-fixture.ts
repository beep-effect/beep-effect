import {
  CacheConformanceProxyOptions,
  CacheProducerBinding,
  CacheProtocolNativeSummary,
  makeCacheConformanceFaultProxy,
} from "@beep/repo-cli/commands/Cache";
import { Sha256HexFromBytes } from "@beep/schema";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { bearers, goodMode, makeConformanceServer, secrets, targetFor, teamId } from "../cache-conformance-server.ts";
import { input } from "./cache-producer-bundle-fixture.ts";

export const producerUploadTaskHash = "0123456789abcdef";
const hash = producerUploadTaskHash;
const hashBytes = S.decodeEffect(Sha256HexFromBytes);

export const makeOwnedUploadFixture = Effect.fn("ProducerUploadTest.fixture")(function* (taskHash = hash) {
  const binding = yield* S.decodeUnknownEffect(CacheProducerBinding)({
    ...input.pilot,
    protocolClient: input.protocol.observation.client,
    workflowRevision: input.pilot.sourceRevision,
    workflowImplementation: input.pilot.configurationDigest,
    policyDigest: input.pilot.configurationDigest,
  });
  const summary = CacheProtocolNativeSummary.make({
    turboVersion: binding.client.version,
    tasks: [
      {
        taskId: binding.key.computation,
        hash: taskHash,
        cache: { status: "MISS", source: O.none() },
        execution: { exitCode: 0 },
      },
    ],
  });
  const server = yield* makeConformanceServer({ ...goodMode, responseCacheResult: "allowed" });
  const proxy = yield* makeCacheConformanceFaultProxy(
    CacheConformanceProxyOptions.make({ target: targetFor({ url: server.url }), bearers, holdMs: 400 })
  );
  const body = new TextEncoder().encode("owned-upload-body-canary");
  yield* HttpClientRequest.put(`${proxy.url}/v8/artifacts/${taskHash}?teamId=${teamId}`).pipe(
    HttpClientRequest.setHeaders({ authorization: `Bearer ${secrets.writer}`, "x-artifact-tag": "opaque-tag-canary" }),
    HttpClientRequest.bodyUint8Array(body),
    HttpClient.execute,
    Effect.flatMap((reply) => reply.arrayBuffer)
  );
  const events = yield* proxy.events;
  const event = O.getOrThrow(A.head(events));
  return { binding, summary, events, event, archiveSha256: yield* hashBytes(body), archiveBytes: body.byteLength };
});
