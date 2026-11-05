import {
  buildCacheConformanceCorpus,
  CacheConformanceClientPin,
  CacheConformanceComparison,
  CacheConformanceEvidence,
  CacheConformanceEvidenceCheck,
  CacheConformanceLoadEnvelope,
  CacheConformanceObligationCheck,
  CacheConformanceProxyEvent,
  CacheConformanceProxyOptions,
  CacheConformanceRubric,
  CacheConformanceRun,
  CacheConformanceTarget,
  compareCacheConformanceRuns,
  loadCacheConformanceBearers,
  makeCacheConformanceFaultProxy,
  mergeCacheConformanceRuns,
  renderCacheConformanceComparison,
  runCacheConformance,
  runCacheConformanceLab,
  runCacheConformanceNative,
} from "@beep/repo-cli/commands/Cache";
import * as Evidence from "@beep/repo-cli/commands/Cache/Cache.evidence";
import * as ProtocolFixture from "@beep/repo-cli/commands/Cache/Cache.protocol.fixture";
import { CacheRuntimeProcess } from "@beep/repo-cli/test/Cache";
import { Sha256Hex } from "@beep/schema";
import { NodeCrypto, NodeServices } from "@effect/platform-node";
import { afterEach, expect, it, vi } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Digest from "effect/crypto/Digest";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Headers from "effect/http/Headers";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import {
  bearers,
  caseOf,
  foreignTeamId,
  goodMode,
  makeConformanceServer,
  repoRoot,
  secrets,
  targetFor,
  teamId,
} from "./cache-conformance-server.ts";
import type * as HttpServerResponse from "effect/http/HttpServerResponse";
import type { ServerMode } from "./cache-conformance-server.ts";

afterEach(() => vi.restoreAllMocks());

const Services = Layer.mergeAll(NodeServices.layer, NodeCrypto.layer, FetchHttpClient.layer);
const observeProxyBody = Effect.fn("ConformanceTest.observeProxyBody")(function* () {
  const started = yield* Deferred.make<void>();
  const completed = yield* Deferred.make<void>();
  const serve = ProtocolFixture.serveCacheLoopback;
  vi.spyOn(ProtocolFixture, "serveCacheLoopback").mockImplementation(
    <E, R>(app: Effect.Effect<HttpServerResponse.HttpServerResponse, E, R>, maxRequestBodySize: number) =>
      serve(
        Effect.gen(function* () {
          const request = yield* HttpServerRequest.HttpServerRequest;
          const watched = new Proxy(request, {
            get(target, property) {
              return property === "arrayBuffer"
                ? Deferred.succeed(started, undefined).pipe(Effect.andThen(target.arrayBuffer))
                : Reflect.get(target, property, target);
            },
          });
          return yield* app.pipe(Effect.provideService(HttpServerRequest.HttpServerRequest, watched));
        }).pipe(Effect.ensuring(Deferred.succeed(completed, undefined))),
        maxRequestBodySize
      )
  );
  return { started, completed };
});
// The fault proxy injects `reset` and `truncated-body` by failing the response
// stream, which Bun.serve turns into a connection abort. The CLI only runs on
// Bun; vitest's Node run serves through a Bun.serve shim that completes the
// response instead, so abort-dependent expectations assert that shim behaviour
// there rather than the abort.
const abortsConnections = process.versions.bun !== undefined;

type ProbeReply = { readonly status: number; readonly headers: Headers.Headers; readonly body: Uint8Array };
type ProbeOutcome = Result.Result<O.Option<ProbeReply>, unknown>;
const replied = (outcome: ProbeOutcome, check: (reply: ProbeReply) => boolean) =>
  Result.isSuccess(outcome) && O.exists(outcome.success, check);
const tagOf = (outcome: ProbeOutcome) =>
  Result.isSuccess(outcome)
    ? O.flatMap(outcome.success, (reply) => Headers.get(reply.headers, "x-artifact-tag"))
    : O.none();
const abortedOrShimCompleted = (outcome: ProbeOutcome) =>
  abortsConnections ? Result.isFailure(outcome) : replied(outcome, (reply) => reply.status === 200);
const RunJson = S.fromJsonString(CacheConformanceRun, { space: 2 });
const ComparisonJson = S.fromJsonString(CacheConformanceComparison, { space: 2 });
const encodeProxyEvents = S.encodeEffect(CacheConformanceProxyEvent.pipe(S.Array, S.fromJsonString));
const encodeSummaryJson = S.encodeEffect(S.fromJsonString(S.Json));

// A small envelope keeps the measured steps fast while exercising every step.
const envelope = CacheConformanceLoadEnvelope.make({
  schemaVersion: "cache-conformance-load-envelope/v1",
  artifactSizes: {
    p50Bytes: S.Natural.make(64),
    p95Bytes: S.Natural.make(512),
    p99Bytes: S.Natural.make(1024),
    maxBytes: S.Natural.make(4096),
  },
  concurrency: { readPeak: S.Natural.make(4), writePeak: S.Natural.make(2) },
  envelope: {
    payloadBytes: S.Natural.make(2048),
    readConcurrency: S.Natural.make(6),
    writeConcurrency: S.Natural.make(3),
  },
});

const withEnv = (env: Record<string, string>) =>
  Effect.provideService(ConfigProvider.ConfigProvider, ConfigProvider.fromEnvRecord(env));

const policyTarget = (readerWriterSplit: boolean, tenantBinding: boolean) =>
  targetFor({ url: "http://127.0.0.1:1", readerWriterSplit, tenantBinding });

it.layer(Services, { timeout: "60 seconds", excludeTestServices: true })("cache conformance bearer rule", (it) => {
  it.effect("allows reuse only where the target claims no separation", () =>
    Effect.gen(function* () {
      const load = (target: CacheConformanceTarget, env: Record<string, string>) =>
        loadCacheConformanceBearers(target).pipe(withEnv(env), Effect.result);
      const shared = { READER: "one-token", WRITER: "one-token", FOREIGN: "one-token", UNKNOWN: "other-token" };
      (yield* load(policyTarget(false, false), shared)).pipe(Result.isSuccess, assertTrue);
      (yield* load(policyTarget(true, false), shared)).pipe(Result.isFailure, assertTrue);
      const split = { READER: "reader-token", WRITER: "writer-token", FOREIGN: "reader-token", UNKNOWN: "other-token" };
      (yield* load(policyTarget(true, false), split)).pipe(Result.isSuccess, assertTrue);
      (yield* load(policyTarget(true, true), split)).pipe(Result.isFailure, assertTrue);
      (yield* load(policyTarget(false, false), { ...shared, UNKNOWN: "one-token" })).pipe(Result.isFailure, assertTrue);
      (yield* load(policyTarget(false, false), { ...shared, READER: "" })).pipe(Result.isFailure, assertTrue);
    })
  );
});

it.layer(Services, { timeout: "60 seconds", excludeTestServices: true })("cache conformance fault proxy", (it) => {
  it.effect("rejects later traffic and invalidates evidence when the request budget is exhausted", () =>
    Effect.gen(function* () {
      const server = yield* makeConformanceServer(goodMode);
      const proxy = yield* makeCacheConformanceFaultProxy(
        CacheConformanceProxyOptions.make({
          target: targetFor({ url: server.url }),
          bearers,
          holdMs: 400,
          maxEvents: 2,
        })
      );
      const put = HttpClientRequest.put(
        `${proxy.url}/v8/artifacts/00112233445566778899aabbccddeeff?teamId=${teamId}`
      ).pipe(
        HttpClientRequest.setHeaders({ authorization: `Bearer ${secrets.writer}`, "x-artifact-tag": "A" }),
        HttpClientRequest.bodyUint8Array(new TextEncoder().encode("body")),
        HttpClient.execute,
        Effect.flatMap((response) => response.arrayBuffer.pipe(Effect.as(response.status)))
      );
      const put1 = yield* put;
      expect(put1).toBe(200);
      const put2 = yield* put;
      expect(put2).toBe(200);
      const put3 = yield* put;
      expect(put3).toBe(503);
      const put4 = yield* put;
      expect(put4).toBe(503);
      expect((yield* server.tags).length).toBe(2);
      (yield* proxy.events.pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
    })
  );

  it.effect("refuses an unreadable request body without forwarding an empty upload", () =>
    Effect.gen(function* () {
      const server = yield* makeConformanceServer(goodMode);
      const proxy = yield* makeCacheConformanceFaultProxy(
        CacheConformanceProxyOptions.make({
          target: targetFor({ url: server.url }),
          bearers,
          holdMs: 400,
          maxBodyBytes: 4,
        })
      );
      const response = yield* HttpClientRequest.put(
        `${proxy.url}/v8/artifacts/00112233445566778899aabbccddeeff?teamId=${teamId}`
      ).pipe(
        HttpClientRequest.setHeaders({ authorization: `Bearer ${secrets.writer}`, "x-artifact-tag": "A" }),
        HttpClientRequest.bodyUint8Array(new TextEncoder().encode("large")),
        HttpClient.execute
      );
      expect(response.status).toBe(413);
      const tags5 = yield* server.tags;
      expect(tags5).toEqual([]);
      (yield* proxy.events.pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
    })
  );

  it.effect("bounds retained replay bytes and rejects overflow before an upstream write", () =>
    Effect.gen(function* () {
      const server = yield* makeConformanceServer(goodMode);
      const proxy = yield* makeCacheConformanceFaultProxy(
        CacheConformanceProxyOptions.make({
          target: targetFor({ url: server.url }),
          bearers,
          holdMs: 400,
          maxCaptureBytes: 10,
        })
      );
      const put = HttpClientRequest.put(
        `${proxy.url}/v8/artifacts/00112233445566778899aabbccddeeff?teamId=${teamId}`
      ).pipe(
        HttpClientRequest.setHeaders({ authorization: `Bearer ${secrets.writer}`, "x-artifact-tag": "A" }),
        HttpClientRequest.bodyUint8Array(new TextEncoder().encode("body")),
        HttpClient.execute,
        Effect.flatMap((response) => response.arrayBuffer.pipe(Effect.as(response.status)))
      );
      const put6 = yield* put;
      expect(put6).toBe(200);
      const put7 = yield* put;
      expect(put7).toBe(200);
      const put8 = yield* put;
      expect(put8).toBe(503);
      expect((yield* server.tags).length).toBe(2);
      (yield* proxy.events.pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
    })
  );

  it.effect("does not turn an interrupted upload into an empty upstream write", () =>
    Effect.gen(function* () {
      if (!abortsConnections) {
        // The Node Bun.serve shim buffers the complete body before dispatching
        // the handler. Run this streaming lifecycle control in the real runtime.
        const root = yield* repoRoot;
        const path = yield* Path.Path;
        const native = yield* CacheRuntimeProcess.runCaptured({
          command: "bun",
          args: [
            path.join(root, "node_modules/vitest/vitest.mjs"),
            "run",
            path.join(root, "packages/tooling/tool/cli/test/cache-conformance-lab.test.ts"),
            "--testNamePattern",
            "does not turn an interrupted upload into an empty upstream write",
            "--fileParallelism=false",
            "--maxWorkers=1",
          ],
          cwd: root,
          bound: CacheRuntimeProcess.OutputBound.make({
            maxChars: 16 * 1024,
            truncatedNotice: "native interruption control exceeded its output bound",
          }),
          timeout: "45 seconds",
          source: "merge",
        });
        expect(native.exitCode).toBe(0);
        expect(native.truncated).toBe(false);
        return;
      }
      const server = yield* makeConformanceServer(goodMode);
      const { started, completed } = yield* observeProxyBody();
      const release = yield* Deferred.make<void>();
      const proxy = yield* makeCacheConformanceFaultProxy(
        CacheConformanceProxyOptions.make({ target: targetFor({ url: server.url }), bearers, holdMs: 400 })
      );
      const upload = yield* HttpClientRequest.put(
        `${proxy.url}/v8/artifacts/00112233445566778899aabbccddeeff?teamId=${teamId}`
      ).pipe(
        HttpClientRequest.setHeaders({ authorization: `Bearer ${secrets.writer}`, "x-artifact-tag": "A" }),
        HttpClientRequest.bodyStream(
          Stream.concat(
            Stream.make(new TextEncoder().encode("partial")),
            Stream.fromEffect(release.pipe(Deferred.await, Effect.timeout("5 seconds"))).pipe(
              Stream.drain,
              Stream.concat(Stream.fail("synthetic request abort"))
            )
          )
        ),
        HttpClient.execute,
        Effect.result,
        Effect.forkChild
      );
      yield* started.pipe(Deferred.await, Effect.timeout("5 seconds"));
      const pendingReceipt = yield* proxy.events.pipe(Effect.forkChild);
      yield* Effect.yieldNow;
      yield* Effect.sync(() => O.fromUndefinedOr(pendingReceipt.pollUnsafe()).pipe(assertNone));
      yield* Deferred.succeed(release, undefined);
      yield* Fiber.join(upload);
      yield* Deferred.await(completed).pipe(Effect.timeout("5 seconds"));
      const tags9 = yield* server.tags;
      expect(tags9).toEqual([]);
      (yield* Fiber.join(pendingReceipt).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
    })
  );

  it.effect("rejects an oversized upstream body and cannot return a complete receipt", () =>
    Effect.gen(function* () {
      const server = yield* makeConformanceServer(goodMode);
      const path = `/v8/artifacts/00112233445566778899aabbccddeeff?teamId=${teamId}`;
      yield* HttpClientRequest.put(`${server.url}${path}`).pipe(
        HttpClientRequest.setHeaders({ authorization: `Bearer ${secrets.writer}`, "x-artifact-tag": "A" }),
        HttpClientRequest.bodyUint8Array(new TextEncoder().encode("large")),
        HttpClient.execute,
        Effect.flatMap((response) => response.arrayBuffer)
      );
      const proxy = yield* makeCacheConformanceFaultProxy(
        CacheConformanceProxyOptions.make({
          target: targetFor({ url: server.url }),
          bearers,
          holdMs: 400,
          maxBodyBytes: 4,
        })
      );
      const response = yield* HttpClient.get(`${proxy.url}${path}`, {
        headers: { authorization: `Bearer ${secrets.reader}` },
      });
      expect(response.status).toBe(503);
      (yield* proxy.events.pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
    })
  );

  it.effect("reserves the request budget atomically across concurrent clients", () =>
    Effect.gen(function* () {
      const server = yield* makeConformanceServer(goodMode);
      const proxy = yield* makeCacheConformanceFaultProxy(
        CacheConformanceProxyOptions.make({
          target: targetFor({ url: server.url }),
          bearers,
          holdMs: 400,
          maxEvents: 2,
        })
      );
      const statuses = yield* Effect.forEach(
        A.range(1, 8),
        () =>
          HttpClientRequest.put(`${proxy.url}/v8/artifacts/00112233445566778899aabbccddeeff?teamId=${teamId}`).pipe(
            HttpClientRequest.setHeaders({ authorization: `Bearer ${secrets.writer}`, "x-artifact-tag": "A" }),
            HttpClientRequest.bodyUint8Array(new TextEncoder().encode("body")),
            HttpClient.execute,
            Effect.flatMap((response) => response.arrayBuffer.pipe(Effect.as(response.status)))
          ),
        { concurrency: 8 }
      );
      expect(A.filter(statuses, (status) => status === 200).length).toBeLessThanOrEqual(2);
      expect(A.filter(statuses, (status) => status === 503).length).toBeGreaterThanOrEqual(6);
      expect((yield* server.tags).length).toBeLessThanOrEqual(2);
      (yield* proxy.events.pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
    })
  );

  it.effect("reserves the replay-entry limit before concurrent upstream writes", () =>
    Effect.gen(function* () {
      const server = yield* makeConformanceServer(goodMode);
      const proxy = yield* makeCacheConformanceFaultProxy(
        CacheConformanceProxyOptions.make({ target: targetFor({ url: server.url }), bearers, holdMs: 400 })
      );
      const statuses = yield* Effect.forEach(
        A.range(1, 65),
        (index) =>
          HttpClientRequest.put(`${proxy.url}/v8/artifacts/${Str.padStart(32, "0")(`${index}`)}?teamId=${teamId}`).pipe(
            HttpClientRequest.setHeaders({ authorization: `Bearer ${secrets.writer}`, "x-artifact-tag": "A" }),
            HttpClientRequest.bodyUint8Array(new TextEncoder().encode("body")),
            HttpClient.execute,
            Effect.flatMap((response) => response.arrayBuffer.pipe(Effect.as(response.status)))
          ),
        { concurrency: 8 }
      );
      expect(statuses).toContain(503);
      expect((yield* server.tags).length).toBe(64);
      (yield* proxy.events.pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
    })
  );

  it.effect("preserves bounded backend claims through proxy capture and rejects secret text", () =>
    Effect.gen(function* () {
      for (const responseCacheResult of ["not-found", `${secrets.reader} /fixture/private/result body-canary-15ab`]) {
        const server = yield* makeConformanceServer({ ...goodMode, readFault: O.some(404), responseCacheResult });
        const proxy = yield* makeCacheConformanceFaultProxy(
          CacheConformanceProxyOptions.make({ target: targetFor({ url: server.url }), bearers, holdMs: 400 })
        );
        const url = `${proxy.url}/v8/artifacts/00112233445566778899aabbccddeeff?teamId=${teamId}`;
        yield* HttpClientRequest.put(url).pipe(
          HttpClientRequest.setHeaders({ authorization: `Bearer ${secrets.writer}`, "x-artifact-tag": "fixture-tag" }),
          HttpClientRequest.bodyUint8Array(new TextEncoder().encode("owned fixture body")),
          HttpClient.execute,
          Effect.flatMap((reply) => reply.arrayBuffer)
        );
        yield* HttpClient.get(url, {
          headers: { authorization: `Bearer ${secrets.reader}` },
        }).pipe(Effect.flatMap((reply) => reply.arrayBuffer));
        const events = yield* proxy.events;
        const reads = A.filter(events, (event) => event.exchange.method === "GET");
        expect(reads.length).toBe(1);
        for (const event of reads) {
          assertSome(
            event.exchange.backendResult,
            responseCacheResult === "not-found" ? "not-found" : "invalid-evidence"
          );
          expect(event.exchange.outcome).toBe("not-found");
        }
        const encoded = yield* encodeProxyEvents(events);
        for (const secret of [secrets.reader, "/fixture/private/result", "body-canary-15ab"])
          expect(encoded).not.toContain(secret);
      }
    })
  );

  it.effect("redacts untrusted response media-type values from proxy receipts", () =>
    Effect.gen(function* () {
      const canary = "proxy-header-artifact-content-4ef2";
      const privatePath = "/fixture/private/proxy-artifact";
      for (const responseContentType of [
        `application/octet-stream; token=${secrets.reader}; path=${privatePath}; body=${canary}`,
        `application/x-${secrets.reader}`,
      ]) {
        const server = yield* makeConformanceServer({ ...goodMode, responseContentType });
        const proxy = yield* makeCacheConformanceFaultProxy(
          CacheConformanceProxyOptions.make({ target: targetFor({ url: server.url }), bearers, holdMs: 400 })
        );
        const url = `${proxy.url}/v8/artifacts/00112233445566778899aabbccddeeff?teamId=${teamId}`;
        yield* HttpClientRequest.put(url).pipe(
          HttpClientRequest.setHeaders({ authorization: `Bearer ${secrets.writer}`, "x-artifact-tag": "Atag-value" }),
          HttpClientRequest.bodyUint8Array(new TextEncoder().encode("opaque fixture artifact")),
          HttpClient.execute,
          Effect.flatMap((reply) => reply.arrayBuffer)
        );
        yield* HttpClient.get(url, { headers: { authorization: `Bearer ${secrets.reader}` } }).pipe(
          Effect.flatMap((reply) => reply.arrayBuffer)
        );
        const events10 = yield* proxy.events;
        const encoded = yield* encodeProxyEvents(events10);
        for (const secret of [secrets.reader, privatePath, canary]) expect(encoded).not.toContain(secret);
      }
    })
  );

  it.effect("forwards unchanged and injects each read fault with a direct receipt", () =>
    Effect.gen(function* () {
      const server = yield* makeConformanceServer(goodMode);
      const target = targetFor({ url: server.url });
      const proxy = yield* makeCacheConformanceFaultProxy(
        CacheConformanceProxyOptions.make({ target, bearers, holdMs: 400 })
      );
      const hash = "00112233445566778899aabbccddeeff";
      const body = new TextEncoder().encode("proxied artifact body");
      const query = `?teamId=${teamId}`;
      const upload = yield* HttpClientRequest.put(`${proxy.url}/v8/artifacts/${hash}${query}`).pipe(
        HttpClientRequest.setHeaders({ authorization: `Bearer ${secrets.writer}`, "x-artifact-tag": "Atag-value" }),
        HttpClientRequest.bodyUint8Array(body),
        HttpClient.execute
      );
      expect(upload.status).toBe(200);
      const read = (fault: Parameters<typeof proxy.setScenario>[1]) =>
        proxy.setScenario(`probe-${fault}`, fault).pipe(
          Effect.andThen(
            HttpClient.get(`${proxy.url}/v8/artifacts/${hash}${query}`, {
              headers: { authorization: `Bearer ${secrets.reader}` },
            }).pipe(
              Effect.flatMap((response) =>
                response.arrayBuffer.pipe(
                  Effect.map((buffer) => ({
                    status: response.status,
                    headers: response.headers,
                    body: new Uint8Array(buffer),
                  }))
                )
              ),
              Effect.timeoutOption("200 millis"),
              Effect.result
            )
          )
        );
      const plain = yield* read("none");
      assertTrue(replied(plain, (reply) => reply.status === 200));
      assertSome(tagOf(plain), "Atag-value");
      (yield* read("missing-tag")).pipe(tagOf, assertNone);
      const read11 = yield* read("tampered-tag");
      assertSome(tagOf(read11), "Btag-value");
      const tampered = yield* read("tampered-body");
      assertTrue(replied(tampered, (reply) => reply.body.byteLength === body.byteLength && reply.body[0] !== body[0]));
      const read12 = yield* read("status-429");
      assertTrue(replied(read12, (reply) => reply.status === 429));
      const read13 = yield* read("status-503");
      assertTrue(replied(read13, (reply) => reply.status === 503));
      const held = yield* read("timeout");
      assertTrue(Result.isSuccess(held) && O.isNone(held.success));
      (yield* read("reset")).pipe(abortedOrShimCompleted, assertTrue);
      (yield* read("truncated-body")).pipe(abortedOrShimCompleted, assertTrue);
      const events = yield* proxy.events;
      const faults = A.map(
        A.filter(events, (event) => event.exchange.method === "GET"),
        (event) => event.fault
      );
      expect(faults).toEqual(
        expect.arrayContaining([
          "none",
          "missing-tag",
          "tampered-tag",
          "tampered-body",
          "status-429",
          "status-503",
          "reset",
          "truncated-body",
        ])
      );
      const receipts = yield* encodeProxyEvents(events);
      for (const secret of [...R.values(secrets), "Atag-value", "Btag-value", hash])
        expect(receipts).not.toContain(secret);
    })
  );
});

it.layer(Services, { timeout: "120 seconds", excludeTestServices: true })("cache conformance lab runner", (it) => {
  it.effect("separates every proxied fault class and measures the envelopes", () =>
    Effect.gen(function* () {
      const server = yield* makeConformanceServer(goodMode);
      const repoRoot14 = yield* repoRoot;
      const corpus = yield* buildCacheConformanceCorpus(repoRoot14);
      const report = yield* runCacheConformanceLab(corpus, targetFor({ url: server.url }), bearers, envelope);
      expect(report.executors).toEqual(["lab"]);
      expect(report.representative).toBe(false);
      expect(caseOf(report, "RC-023").verdicts.observability.verdict).toBe(abortsConnections ? "pass" : "fail");
      for (const id of ["RC-027", "RC-028"]) {
        expect(caseOf(report, id).verdicts["performance-envelope"].verdict).toBe("pass");
        expect(caseOf(report, id).measurements.length).toBeGreaterThan(0);
      }
      const outcomes = A.map(
        A.filter(caseOf(report, "RC-023").exchanges, (exchange) => Str.startsWith("reader-get-")(exchange.step)),
        (exchange) => exchange.outcome
      );
      expect(outcomes).toEqual([
        "miss",
        "success",
        "throttled",
        "server-error",
        "timeout",
        ...(abortsConnections ? ["transport-error", "truncated-body"] : ["success", "success"]),
      ]);
      expect(caseOf(report, "RC-002").verdicts["strict-openapi"].verdict).toBe("not-executed");
      const encoded = yield* S.encodeEffect(RunJson)(report);
      for (const secret of R.values(secrets)) expect(encoded).not.toContain(secret);
      const argument = S.encodeEffect(RunJson);
      const value1 = yield* S.decodeEffect(RunJson)(encoded);
      const value15 = yield* argument(value1);
      expect(value15).toBe(encoded);
    })
  );

  it.effect("labels only a disposable-deployment run representative", () =>
    Effect.gen(function* () {
      const server = yield* makeConformanceServer(goodMode);
      const repoRoot16 = yield* repoRoot;
      const corpus = yield* buildCacheConformanceCorpus(repoRoot16);
      const deployed = CacheConformanceTarget.make({
        ...targetFor({ url: server.url }),
        profile: "disposable-deployment",
      });
      expect((yield* runCacheConformanceLab(corpus, deployed, bearers, envelope)).representative).toBe(true);
    })
  );
});

// Stand-in signed client at the native process seam: it signs and verifies a
// tag over (hash, team, bytes) with the run key, so proxied tampering, a
// wrong team or a dropped tag must all cause a rejection. It never claims
// real Turbo or sandbox execution.
const taskHash = "c0ffee0123456789";
const sign = (key: string, team: string, body: Uint8Array) =>
  Digest.Digest.use((crypto) =>
    crypto.digest(Digest.sha256, new Uint8Array([...new TextEncoder().encode(`${key}|${taskHash}|${team}|`), ...body]))
  ).pipe(Effect.map(Hex.encode));

type SimulatedRun = {
  readonly work: string;
  readonly team: string;
  readonly key: string;
  readonly url: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly deny: boolean;
};

const simulatedRun = (options: Parameters<typeof CacheRuntimeProcess.runCapturedStreams>[0]): SimulatedRun => {
  const args = options.args ?? [];
  const env = options.env ?? {};
  const team = env.TURBO_TEAMID ?? "";
  return {
    work: O.getOrThrow(A.get(args, O.getOrThrow(A.findFirstIndex(args, (arg) => arg === "--bind")) + 1)),
    team,
    key: env.TURBO_REMOTE_CACHE_SIGNATURE_KEY ?? "",
    url: `${env.TURBO_API}/v8/artifacts/${taskHash}?teamId=${team}`,
    headers: { authorization: `Bearer ${env.TURBO_TOKEN}` },
    deny: env.PROBE_DENY_EXECUTION === "1",
  };
};

const simulatedOutput = new TextEncoder().encode("conformance-native-signed-output\n");

const makeNativeClient = (
  fs: FileSystem.FileSystem,
  path: Path.Path,
  client: HttpClient.HttpClient,
  digest: Digest.Digest["Service"]
) => {
  const restore = Effect.fnUntraced(function* (run: SimulatedRun) {
    const response = yield* client.get(run.url, { headers: run.headers });
    const arrayBuffer17 = yield* response.arrayBuffer;
    const stored = new Uint8Array(arrayBuffer17);
    const tag = Headers.get(response.headers, "x-artifact-tag");
    const verified =
      response.status === 200 &&
      (yield* Effect.map(sign(run.key, run.team, stored), (value) => O.contains(tag, value)));
    return { verified, stored };
  });
  const writeOutput = Effect.fnUntraced(function* (run: SimulatedRun, bytes: Uint8Array) {
    yield* fs.makeDirectory(path.join(run.work, "dist"), { recursive: true });
    yield* fs.writeFile(path.join(run.work, "dist/result.txt"), bytes);
  });
  const upload = Effect.fnUntraced(function* (run: SimulatedRun) {
    yield* HttpClientRequest.put(run.url).pipe(
      HttpClientRequest.setHeaders({
        ...run.headers,
        "x-artifact-tag": yield* sign(run.key, run.team, simulatedOutput),
      }),
      HttpClientRequest.bodyUint8Array(simulatedOutput),
      client.execute,
      Effect.flatMap((reply) => reply.arrayBuffer)
    );
  });
  const writeSummary = Effect.fnUntraced(function* (run: SimulatedRun, verified: boolean, exitCode: number) {
    yield* fs.makeDirectory(path.join(run.work, ".turbo/runs"), { recursive: true });
    const argument1 = path.join(run.work, ".turbo/runs/run.json");
    const encodedSummaryJson = yield* encodeSummaryJson({
      turboVersion: "2.11.10",
      tasks: [
        {
          taskId: "build",
          hash: taskHash,
          cache: verified ? { status: "HIT", source: "REMOTE" } : { status: "MISS" },
          execution: { exitCode },
        },
      ],
    });
    yield* fs.writeFileString(argument1, encodedSummaryJson);
  });
  return Effect.fn("ConformanceNativeTest.process")(
    function* (options: Parameters<typeof CacheRuntimeProcess.runCapturedStreams>[0]) {
      expect(options.command).toBe("/usr/bin/bwrap");
      expect(options.args).toContain("--skip-infer");
      expect(options.args).toContain("--single-package");
      const run = simulatedRun(options);
      const { verified, stored } = yield* restore(run);
      // Restored from a verified remote hit, executed when allowed, or denied (exit 42).
      if (verified) {
        yield* writeOutput(run, stored);
      }
      if (!verified && !run.deny) {
        yield* writeOutput(run, simulatedOutput).pipe(Effect.andThen(upload(run)));
      }
      const exitCode = verified || !run.deny ? 0 : 42;
      yield* writeSummary(run, verified, exitCode);
      return CacheRuntimeProcess.CapturedStreams.make({ exitCode, stdout: "", stderr: "", truncated: false });
    },
    Effect.orDie,
    Effect.provideService(Digest.Digest, digest)
  );
};

const pin = CacheConformanceClientPin.make({
  channel: "stable",
  version: "2.11.10",
  platformPackage: "@turbo/linux-64@2.11.10",
  platformIntegrity: "sha512-AAAA",
  executableSha256: Sha256Hex.make(Str.repeat(64)("a")),
});

const runNativeAgainst = Effect.fn("ConformanceNativeTest.run")(function* (mode: ServerMode) {
  const fs = yield* FileSystem.FileSystem;
  vi.spyOn(Evidence, "hashCacheExperimentExecutable").mockImplementation(() => Effect.succeed(pin.executableSha256));
  const argument2 = vi.spyOn(CacheRuntimeProcess, "runCapturedStreams");
  const argument3 = yield* Path.Path;
  const argument4 = yield* HttpClient.HttpClient;
  const Digest2 = yield* Digest.Digest;
  argument2.mockImplementation(makeNativeClient(fs, argument3, argument4, Digest2));
  const server = yield* makeConformanceServer({ ...mode, bindTenant: false });
  const root = yield* fs.makeTempDirectoryScoped({ prefix: "cache-conformance-native-" });
  const repoRoot18 = yield* repoRoot;
  const corpus = yield* buildCacheConformanceCorpus(repoRoot18);
  const target = targetFor({ url: server.url, tenantBinding: false });
  return {
    corpus,
    target,
    report: yield* runCacheConformanceNative(root, corpus, target, bearers, { pin, executable: "/synthetic/turbo" }),
  };
});

it.layer(Services, { timeout: "120 seconds", excludeTestServices: true })("cache conformance native matrix", (it) => {
  it.effect("scores a tag-preserving backend through every signed case", () =>
    Effect.gen(function* () {
      const { report } = yield* runNativeAgainst(goodMode);
      expect(report.executors).toEqual(["native"]);
      expect(A.map(report.clients, (client) => client.version)).toEqual(["2.11.10"]);
      for (const id of ["RC-009", "RC-010", "RC-017", "RC-018", "RC-019", "RC-020", "RC-021", "RC-022"])
        expect([id, caseOf(report, id).verdicts["published-stable-client"]]).toEqual([id, { verdict: "pass" }]);
      expect(caseOf(report, "RC-022").verdicts["beep-security-policy"].verdict).toBe("pass");
      expect(caseOf(report, "RC-017").verdicts["published-canary-client"].verdict).toBe("not-executed");
      const encoded = yield* S.encodeEffect(RunJson)(report);
      for (const secret of R.values(secrets)) expect(encoded).not.toContain(secret);
    })
  );

  it.effect("never credits a fault rejection when the control replay could not restore", () =>
    Effect.gen(function* () {
      const { report } = yield* runNativeAgainst({ ...goodMode, dropTags: true });
      const signed = caseOf(report, "RC-017").verdicts["published-stable-client"];
      expect(signed.verdict).toBe("fail");
      for (const id of ["RC-018", "RC-019", "RC-020", "RC-021"]) {
        const verdict = caseOf(report, id).verdicts["published-stable-client"];
        expect(verdict.verdict === "fail" ? verdict.expectation : verdict.verdict).toBe("control-replay-restored");
      }
    })
  );
});

it.layer(Services, { timeout: "180 seconds", excludeTestServices: true })("cache conformance comparison", (it) => {
  it.effect("merges runs per target and never passes an unexecuted gate", () =>
    Effect.gen(function* () {
      const { corpus, target, report: native } = yield* runNativeAgainst(goodMode);
      const wire = yield* runCacheConformance(corpus, target, bearers);
      const lab = yield* runCacheConformanceLab(corpus, target, bearers, envelope);
      const merged = yield* mergeCacheConformanceRuns([wire, native, lab]);
      expect(merged.executors).toEqual(["wire", "native", "lab"]);
      expect(caseOf(merged, "RC-017").verdicts["published-stable-client"].verdict).toBe("pass");
      expect(caseOf(merged, "RC-023").verdicts.observability.verdict).toBe(abortsConnections ? "pass" : "fail");
      const incumbent = CacheConformanceRun.make({ ...wire, topology: "beep-incumbent" });
      const repoRoot19 = yield* repoRoot;
      const comparison = yield* compareCacheConformanceRuns(repoRoot19, [wire, native, lab, incumbent]);
      expect(comparison.verdict).toContain("No eligible replacement");
      expect(comparison.eligibleReplacements).toEqual([]);
      const candidate = A.findFirst(comparison.targets, (entry) => entry.topology === "owned-fixture").pipe(
        O.getOrThrow
      );
      const status = (gate: number) =>
        A.findFirst(candidate.gates, (result) => result.gate === gate).pipe(
          O.map((result) => result.status),
          O.getOrThrow
        );
      expect([status(1), status(2), status(9), status(12)]).toEqual(["pass", "unproven", "unproven", "unproven"]);
      expect(candidate.eligible).toBe(false);
      expect(candidate.materialWin).toBe("not-evaluated");
      const markdown = renderCacheConformanceComparison(comparison);
      expect(markdown).toContain("No eligible replacement");
      const encoded = yield* S.encodeEffect(ComparisonJson)(comparison);
      const argument5 = S.encodeEffect(ComparisonJson);
      const value3 = yield* S.decodeEffect(ComparisonJson)(encoded);
      const value20 = yield* argument5(value3);
      expect(value20).toBe(encoded);
    })
  );

  it.effect("refuses to compare targets scored against different corpora", () =>
    Effect.gen(function* () {
      const server = yield* makeConformanceServer(goodMode);
      const repoRoot21 = yield* repoRoot;
      const corpus = yield* buildCacheConformanceCorpus(repoRoot21);
      const wire = yield* runCacheConformance(corpus, targetFor({ url: server.url }), bearers);
      const regenerated = CacheConformanceRun.make({
        ...wire,
        topology: "beep-incumbent",
        corpus: { ...wire.corpus, specSha256: Sha256Hex.make(Str.repeat(64)("b")) },
      });
      const repoRoot22 = yield* repoRoot;
      const outcome = yield* compareCacheConformanceRuns(repoRoot22, [wire, regenerated]).pipe(Effect.result);
      outcome.pipe(Result.isFailure, assertTrue);
    })
  );

  it.effect("never compares a candidate with another profile's incumbent", () =>
    Effect.gen(function* () {
      const repoRoot23 = yield* repoRoot;
      const corpus = yield* buildCacheConformanceCorpus(repoRoot23);
      const good = yield* makeConformanceServer(goodMode);
      const weak = yield* makeConformanceServer({ ...goodMode, bindTenant: false });
      const candidate = yield* runCacheConformance(corpus, targetFor({ url: good.url }), bearers);
      const weakRun = yield* runCacheConformance(corpus, targetFor({ url: weak.url }), bearers);
      // The only incumbent fails gate 5, which the candidate passes, but it was
      // measured in another profile: a fallback would report gate 5 as removed.
      const otherProfileIncumbent = CacheConformanceRun.make({
        ...weakRun,
        profile: "disposable-deployment",
        topology: "beep-incumbent",
      });
      const repoRoot24 = yield* repoRoot;
      const comparison = yield* compareCacheConformanceRuns(repoRoot24, [candidate, otherProfileIncumbent]);
      const target = A.findFirst(comparison.targets, (entry) => entry.topology === "owned-fixture").pipe(O.getOrThrow);
      expect(target.blockersRemoved).toEqual([]);
      expect(target.regressions).toEqual([]);
    })
  );

  it.effect("lets executed external evidence and pinned licenses settle gates", () =>
    Effect.gen(function* () {
      const server = yield* makeConformanceServer(goodMode);
      const repoRoot25 = yield* repoRoot;
      const corpus = yield* buildCacheConformanceCorpus(repoRoot25);
      const wire = yield* runCacheConformance(corpus, targetFor({ url: server.url }), bearers);
      const pinned = CacheConformanceRun.make({
        ...wire,
        backend: { id: "turborepo-remote-cache", release: "2.12.0", digest: "pinned" },
      });
      const check = (id: string, dimension: "beep-security-policy" | "observability", verdict: "pass" | "fail") =>
        CacheConformanceEvidenceCheck.make({
          case: id,
          dimension,
          verdict,
          expectation: `${id}-${dimension}`,
          detail: "lab",
        });
      const document = CacheConformanceEvidence.make({
        schemaVersion: "cache-conformance-evidence/v1",
        source: "test/deployed-evidence",
        observedAt: "2026-10-24",
        profile: "local-container",
        topologies: ["owned-fixture"],
        checks: [
          check("RC-029", "beep-security-policy", "pass"),
          check("RC-029", "observability", "pass"),
          check("RC-030", "beep-security-policy", "pass"),
          check("RC-030", "observability", "fail"),
        ],
        obligations: [
          CacheConformanceObligationCheck.make({
            gate: 12,
            obligation: "maintenance",
            verdict: "pass",
            expectation: "maintenance-acceptable",
            detail: "lab",
          }),
        ],
      });
      const repoRoot26 = yield* repoRoot;
      const comparison = yield* compareCacheConformanceRuns(repoRoot26, [pinned], [document]);
      const target = A.head(comparison.targets).pipe(O.getOrThrow);
      const status = (gate: number) =>
        A.findFirst(target.gates, (result) => result.gate === gate).pipe(
          O.map((result) => result.status),
          O.getOrThrow
        );
      expect([status(8), status(10), status(12)]).toEqual(["fail", "pass", "pass"]);
      expect(comparison.evidenceSources).toEqual(["test/deployed-evidence"]);
      const gate9 = A.findFirst(target.gates, (result) => result.gate === 9).pipe(O.getOrThrow);
      expect(gate9.reason).toContain("demand is censored");
      const repoRoot27 = yield* repoRoot;
      const bare = yield* compareCacheConformanceRuns(repoRoot27, [wire]);
      const unpinned = A.findFirst(A.head(bare.targets).pipe(O.getOrThrow).gates, (result) => result.gate === 12).pipe(
        O.getOrThrow
      );
      expect(unpinned.status).toBe("unproven");
    })
  );

  it.effect("refuses to compare when the frozen rubric changed", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* repoRoot;
      const scratch = yield* fs.makeTempDirectoryScoped({ prefix: "cache-conformance-rubric-" });
      const copy = path.join(scratch, CacheConformanceRubric.path);
      yield* fs.makeDirectory(path.dirname(copy), { recursive: true });
      yield* fs.writeFileString(
        copy,
        `${yield* fs.readFileString(path.join(root, CacheConformanceRubric.path))}\nedit\n`
      );
      const server = yield* makeConformanceServer(goodMode);
      const corpus = yield* buildCacheConformanceCorpus(root);
      const wire = yield* runCacheConformance(corpus, targetFor({ url: server.url }), bearers);
      const refused = yield* compareCacheConformanceRuns(scratch, [wire]).pipe(Effect.result);
      refused.pipe(Result.isFailure, assertTrue);
      if (Result.isFailure(refused)) expect(refused.failure.message).toContain("changed");
      expect(foreignTeamId).not.toBe(teamId);
    })
  );
});

const ProxyEventJson = S.fromJsonString(CacheConformanceProxyEvent);
const encodeProxyEvent = S.encodeEffect(ProxyEventJson);
const decodeProxyEvent = S.decodeEffect(ProxyEventJson);

it.effect.prop(
  "round trips schema-generated proxy events through JSON",
  { event: CacheConformanceProxyEvent },
  ({ event }) =>
    Effect.gen(function* () {
      const encoded = yield* encodeProxyEvent(CacheConformanceProxyEvent.make(event));
      const decodedProxyEvent = yield* decodeProxyEvent(encoded);
      const encodedProxyEvent = yield* encodeProxyEvent(decodedProxyEvent);
      expect(encodedProxyEvent).toBe(encoded);
    }),
  { arbitrary: { runs: 50 } }
);
