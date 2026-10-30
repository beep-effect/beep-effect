import {
  buildCacheConformanceCorpus,
  CacheConformanceExchange,
  CacheConformancePaths,
  CacheConformanceRun,
  classifyCacheConformanceBackendResult,
  classifyCacheConformanceMediaType,
  classifyCacheConformanceStatus,
  readCacheConformanceReply,
  renderCacheConformanceCorpus,
  runCacheConformance,
  syncCacheConformanceCorpus,
} from "@beep/repo-cli/commands/Cache";
import { NodeServices } from "@effect/platform-node";
import { expect, it, vi } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as Headers from "effect/http/Headers";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import {
  bearers,
  caseOf,
  goodMode,
  makeConformanceServer,
  repoRoot,
  secrets,
  targetFor,
} from "./cache-conformance-server.ts";
import type { CacheConformanceBackendResult, CacheConformanceMethod } from "@beep/repo-cli/commands/Cache";
import type { ServerMode } from "./cache-conformance-server.ts";

const RunJson = S.fromJsonString(CacheConformanceRun, { space: 2 });
const runAgainst = Effect.fn("test.runAgainst")(function* (mode: ServerMode, split = true) {
  const server = yield* makeConformanceServer(mode);
  const corpus = yield* buildCacheConformanceCorpus(yield* repoRoot);
  const report = yield* runCacheConformance(corpus, targetFor({ url: server.url, readerWriterSplit: split }), bearers);
  return { report, tags: yield* server.tags };
});

const recoverAfterBindCollisions = Effect.fn("test.recoverAfterBindCollisions")(function* (forcedCollisions: number) {
  const occupied = yield* makeConformanceServer(goodMode);
  const port = yield* S.decodeEffect(S.FiniteFromString)(new URL(occupied.url).port);
  const original = Bun.serve;
  const serve = vi.spyOn(Bun, "serve");
  for (let attempt = 0; attempt < forcedCollisions; attempt++)
    serve.mockImplementationOnce((options) => original(Object.assign({ ...options }, { port })));
  yield* Effect.gen(function* () {
    const recovered = yield* makeConformanceServer({ ...goodMode, responseCacheResult: "allowed" });
    expect(serve.mock.calls.length).toBeGreaterThanOrEqual(forcedCollisions + 1);
    expect(serve).toHaveBeenLastCalledWith(
      expect.objectContaining({ hostname: "127.0.0.1", port: 0, maxRequestBodySize: 128 * 1024 * 1024 })
    );
    expect(recovered.url).not.toBe(occupied.url);
    const response = yield* HttpClientRequest.get(`${recovered.url}/v8/artifacts/status?teamId=team_conformance`).pipe(
      HttpClientRequest.setHeader("authorization", `Bearer ${secrets.reader}`),
      HttpClient.execute
    );
    expect(response.status).toBe(200);
    assertSome(Headers.get(response.headers, "x-beep-cache-result"), "allowed");
    expect(yield* response.text).toBe('{"status":"enabled"}');
  }).pipe(Effect.ensuring(Effect.sync(() => serve.mockRestore())));
});

const Services = Layer.mergeAll(NodeServices.layer, FetchHttpClient.layer);

it.layer(Services, { timeout: "60 seconds", excludeTestServices: true })("cache conformance corpus", (it) => {
  it.effect("regenerates byte-identically and matches the committed corpus", () =>
    Effect.gen(function* () {
      const root = yield* repoRoot;
      const first = yield* renderCacheConformanceCorpus(yield* buildCacheConformanceCorpus(root));
      const second = yield* renderCacheConformanceCorpus(yield* buildCacheConformanceCorpus(root));
      expect(first).toBe(second);
      assertTrue(Str.endsWith("}\n")(first));
      yield* syncCacheConformanceCorpus(root, true);
      const corpus = yield* buildCacheConformanceCorpus(root);
      expect(A.map(corpus.cases, (entry) => entry.id)).toEqual(
        A.makeBy(32, (index) => `RC-${Str.padStart(3, "0")(`${index + 1}`)}`)
      );
      expect(A.filter(corpus.cases, (entry) => entry.executor === "native").length).toBe(6);
    })
  );

  it.effect("detects drift with --check and rejects a tampered OpenAPI blob", () =>
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;
      const root = yield* repoRoot;
      const scratch = yield* fs.makeTempDirectoryScoped({ prefix: "cache-conformance-" });
      for (const relative of [CacheConformancePaths.openapi, CacheConformancePaths.plan]) {
        yield* fs.makeDirectory(path.dirname(path.join(scratch, relative)), { recursive: true });
        yield* fs.copyFile(path.join(root, relative), path.join(scratch, relative));
      }
      yield* fs.makeDirectory(path.dirname(path.join(scratch, CacheConformancePaths.corpus)), { recursive: true });
      yield* syncCacheConformanceCorpus(scratch, false);
      yield* syncCacheConformanceCorpus(scratch, true);
      const corpusPath = path.join(scratch, CacheConformancePaths.corpus);
      const committed = yield* fs.readFileString(corpusPath);
      yield* fs.writeFileString(corpusPath, Str.replace("RC-032", "RC-099")(committed));
      const drift = yield* syncCacheConformanceCorpus(scratch, true).pipe(Effect.result);
      drift.pipe(Result.isFailure, assertTrue);
      if (Result.isFailure(drift)) expect(drift.failure.message).toContain("is stale");
      const openapiPath = path.join(scratch, CacheConformancePaths.openapi);
      yield* fs.writeFileString(openapiPath, `${yield* fs.readFileString(openapiPath)} `);
      const tampered = yield* buildCacheConformanceCorpus(scratch).pipe(Effect.result);
      tampered.pipe(Result.isFailure, assertTrue);
      if (Result.isFailure(tampered)) expect(tampered.failure.message).toContain("does not match the pinned");
    })
  );
});

it.layer(Services, { timeout: "120 seconds", excludeTestServices: true })("cache conformance wire runner", (it) => {
  it.effect("recovers through one occupied-port retry in the shared scoped loopback server", () =>
    recoverAfterBindCollisions(1)
  );

  it.effect("recovers through two occupied-port retries in the shared scoped loopback server", () =>
    recoverAfterBindCollisions(2)
  );

  it.effect("retains finite backend causes independently of recomputation outcomes", () =>
    Effect.gen(function* () {
      const { report } = yield* runAgainst({
        ...goodMode,
        readFault: O.some(503),
        responseCacheResult: "backend-unavailable",
      });
      const reads = A.filter(
        A.flatMap(report.cases, (entry) => entry.exchanges),
        (entry) => entry.method === "GET" && O.contains(entry.status, 503)
      );
      expect(reads.length).toBeGreaterThan(0);
      for (const read of reads) assertSome(read.backendResult, "backend-unavailable");
      const encoded = yield* S.encodeEffect(RunJson)(report);
      expect(encoded).toContain("backend-unavailable");
      expect(yield* S.encodeEffect(RunJson)(yield* S.decodeEffect(RunJson)(encoded))).toBe(encoded);
    })
  );

  it.effect("records invalid backend claims without retaining private header text", () =>
    Effect.gen(function* () {
      const canary = `${secrets.reader} /fixture/private/result artifact-body-7729`;
      const { report } = yield* runAgainst({ ...goodMode, responseCacheResult: canary });
      const exchanges = A.filter(
        A.flatMap(report.cases, (entry) => entry.exchanges),
        (entry) => O.isSome(entry.status)
      );
      expect(exchanges.length).toBeGreaterThan(0);
      for (const entry of exchanges) assertSome(entry.backendResult, "invalid-evidence");
      const encoded = yield* S.encodeEffect(RunJson)(report);
      for (const secret of [secrets.reader, "/fixture/private/result", "artifact-body-7729"])
        expect(encoded).not.toContain(secret);
    })
  );

  it.effect("passes a policy-complete server and labels absent optional routes", () =>
    Effect.gen(function* () {
      const { report } = yield* runAgainst(goodMode);
      const failures = A.filter(
        report.cases,
        (entry) =>
          entry.verdicts["strict-openapi"].verdict === "fail" ||
          entry.verdicts["beep-security-policy"].verdict === "fail"
      );
      expect(A.map(failures, (entry) => [entry.id, entry.verdicts])).toEqual([]);
      for (const id of ["RC-007", "RC-008"])
        expect(caseOf(report, id).verdicts["strict-openapi"].verdict).toBe("unsupported-optional");
      expect(caseOf(report, "RC-002").verdicts["strict-openapi"].verdict).toBe("pass");
      const native = caseOf(report, "RC-017");
      expect(native.exchanges).toEqual([]);
      expect(native.verdicts["published-stable-client"].verdict).toBe("not-executed");
      expect(native.verdicts["strict-openapi"].verdict).toBe("not-applicable");
      expect(caseOf(report, "RC-010").verdicts["published-stable-client"].verdict).toBe("not-executed");
      const strict = A.findFirst(report.summary, (row) => row.dimension === "strict-openapi").pipe(O.getOrThrow);
      expect(strict.pass + strict.unsupportedOptional).toBe(19);
    })
  );

  it.effect("scores a 201 upload as a strict deviation without failing the policy", () =>
    Effect.gen(function* () {
      const { report } = yield* runAgainst({ ...goodMode, putStatus: 201 });
      const upload = caseOf(report, "RC-002").verdicts["strict-openapi"];
      expect(upload.verdict).toBe("fail");
      if (upload.verdict === "fail") expect(upload.expectation).toBe("documented-status:uploadArtifact");
      expect(caseOf(report, "RC-012").verdicts["beep-security-policy"].verdict).toBe("pass");
      expect(caseOf(report, "RC-012").verdicts["strict-openapi"].verdict).toBe("fail");
    })
  );

  it.effect("classifies a 500 read as a server fault, never a miss", () =>
    Effect.gen(function* () {
      const { report } = yield* runAgainst({ ...goodMode, readFault: O.some(500) });
      const miss = caseOf(report, "RC-010");
      const get = A.findFirst(miss.exchanges, (exchange) => exchange.method === "GET").pipe(O.getOrThrow);
      expect(get.outcome).toBe("server-error");
      assertSome(get.status, 500);
      expect(miss.verdicts["strict-openapi"].verdict).toBe("fail");
      const head = A.findFirst(miss.exchanges, (exchange) => exchange.method === "HEAD").pipe(O.getOrThrow);
      expect(head.outcome).toBe("miss");
    })
  );

  it.effect("fails reader writes on a server without a reader/writer split", () =>
    Effect.gen(function* () {
      const { report } = yield* runAgainst({ ...goodMode, readersWrite: true }, false);
      const boundary = caseOf(report, "RC-012").verdicts["beep-security-policy"];
      expect(boundary.verdict).toBe("fail");
      if (boundary.verdict === "fail") {
        expect(boundary.expectation).toBe("reader-put-denied");
        expect(boundary.detail).toContain("does not claim a reader/writer split");
      }
    })
  );

  it.effect("tags every writer upload and attributes an unreadable untagged write", () =>
    Effect.gen(function* () {
      const { report: good } = yield* runAgainst(goodMode);
      expect(caseOf(good, "RC-024").verdicts["beep-security-policy"].verdict).toBe("pass");
      expect(caseOf(good, "RC-002").verdicts["strict-openapi"].verdict).toBe("pass");
      const uploads = A.filter(caseOf(good, "RC-002").exchanges, (exchange) => exchange.method === "PUT");
      assertTrue(A.every(uploads, (exchange) => O.isSome(exchange.requestTagSha256)));
      const { report: shim } = yield* runAgainst({ ...goodMode, hideUntagged: true });
      const untagged = caseOf(shim, "RC-024").verdicts["beep-security-policy"];
      expect(untagged.verdict).toBe("fail");
      if (untagged.verdict === "fail") {
        expect(untagged.expectation).toBe("untagged-write-readable");
        expect(untagged.detail).toContain(
          "acknowledged write unreadable: tag passthrough requires every writer to sign"
        );
      }
      expect(caseOf(shim, "RC-012").verdicts["beep-security-policy"].verdict).toBe("pass");
      const { report: dropped } = yield* runAgainst({ ...goodMode, dropTags: true });
      const roundTrip = caseOf(dropped, "RC-002").verdicts["strict-openapi"];
      expect(roundTrip.verdict === "fail" ? roundTrip.expectation : roundTrip.verdict).toBe("tag-round-trip");
    })
  );

  it.effect("never serializes bearers or tag values and round-trips through JSON", () =>
    Effect.gen(function* () {
      const { report, tags } = yield* runAgainst(goodMode);
      expect(tags.length).toBeGreaterThan(0);
      const encoded = yield* S.encodeEffect(RunJson)(report);
      for (const secret of [...R.values(secrets), ...tags]) expect(encoded).not.toContain(secret);
      expect(encoded).not.toContain("127.0.0.1");
      const decoded = yield* S.decodeEffect(RunJson)(encoded);
      expect(yield* S.encodeEffect(RunJson)(decoded)).toBe(encoded);
    })
  );

  it.effect("redacts untrusted response media-type parameters and subtype values", () =>
    Effect.gen(function* () {
      const canary = "header-artifact-content-9c12";
      const privatePath = "/fixture/private/cache-artifact";
      for (const responseContentType of [
        `application/octet-stream; token=${secrets.reader}; path=${privatePath}; body=${canary}`,
        `application/x-${secrets.reader}`,
      ]) {
        const { report } = yield* runAgainst({ ...goodMode, responseContentType });
        const encoded = yield* S.encodeEffect(RunJson)(report);
        for (const secret of [secrets.reader, privatePath, canary]) expect(encoded).not.toContain(secret);
      }
    })
  );

  it.effect("refuses a non-loopback base URL for the local-container profile", () =>
    Effect.gen(function* () {
      const corpus = yield* buildCacheConformanceCorpus(yield* repoRoot);
      const refused = yield* runCacheConformance(corpus, targetFor({ url: "http://cache.example.com" }), bearers).pipe(
        Effect.result
      );
      refused.pipe(Result.isFailure, assertTrue);
      if (Result.isFailure(refused)) expect(refused.failure.message).toContain("non-loopback");
    })
  );
});

const ExchangeJson = S.fromJsonString(CacheConformanceExchange);
const encodeExchange = S.encodeEffect(ExchangeJson);
const decodeExchange = S.decodeEffect(ExchangeJson);
const HistoricalExchangeJson = S.fromJsonString(S.Record(S.String, S.Unknown));
const decodeHistoricalExchange = S.decodeEffect(HistoricalExchangeJson);

it.effect.prop(
  "round trips schema-generated exchange receipts through JSON",
  { exchange: CacheConformanceExchange },
  ({ exchange }) =>
    Effect.gen(function* () {
      const encoded = yield* encodeExchange(CacheConformanceExchange.make(exchange));
      expect(yield* encodeExchange(yield* decodeExchange(encoded))).toBe(encoded);
    }),
  { arbitrary: { runs: 50 } }
);

it("projects only registered parameter-free response media types", () => {
  assertSome(
    classifyCacheConformanceMediaType(O.some("  APPLICATION/OCTET-STREAM ; token=private-fixture")),
    "application/octet-stream"
  );
  assertSome(classifyCacheConformanceMediaType(O.some("application/json; charset=utf-8")), "application/json");
  for (const header of [
    O.none(),
    O.some(""),
    O.some("application/json-private-fixture"),
    O.some("application/x-private-fixture"),
  ])
    header.pipe(classifyCacheConformanceMediaType, assertNone);
});

it("checks every backend label against method and status without inventing genuine misses", () => {
  const controls: ReadonlyArray<readonly [CacheConformanceBackendResult, CacheConformanceMethod, number]> = [
    ["allowed", "GET", 200],
    ["authentication-denied", "GET", 401],
    ["write-denied", "PUT", 403],
    ["tenant-denied", "GET", 403],
    ["selector-invalid", "GET", 400],
    ["route-invalid", "GET", 404],
    ["method-denied", "POST", 405],
    ["signature-missing", "PUT", 400],
    ["metadata-invalid", "GET", 400],
    ["not-found", "GET", 404],
    ["throttled", "GET", 429],
    ["backend-unavailable", "GET", 503],
    ["write-ambiguous", "PUT", 503],
    ["payload-rejected", "PUT", 413],
    ["unexpected-status", "GET", 302],
  ];
  for (const [label, method, status] of controls) {
    assertSome(classifyCacheConformanceBackendResult(O.some(label), method, O.some(status)), label);
    assertSome(O.some(label).pipe(classifyCacheConformanceBackendResult(method, O.some(status))), label);
    assertSome(classifyCacheConformanceBackendResult(O.some(label), method, O.some(199)), "invalid-evidence");
    assertSome(classifyCacheConformanceBackendResult(O.some(label), method, O.none()), "invalid-evidence");
  }
  assertNone(classifyCacheConformanceBackendResult(O.none(), "GET", O.some(404)));
  for (const claim of [
    "allowed,allowed",
    "allowed ",
    "genuine-miss",
    "invalid-evidence",
    "private-secret/path/artifact",
  ]) {
    assertSome(classifyCacheConformanceBackendResult(O.some(claim), "GET", O.some(200)), "invalid-evidence");
  }
  for (const claim of ["write-denied", "signature-missing", "write-ambiguous"]) {
    assertSome(classifyCacheConformanceBackendResult(O.some(claim), "GET", O.some(503)), "invalid-evidence");
  }
  assertSome(
    classifyCacheConformanceBackendResult(O.some("backend-unavailable"), "PUT", O.some(503)),
    "invalid-evidence"
  );
});

it.effect.prop(
  "decodes historical exchanges without optional upload metadata",
  { exchange: CacheConformanceExchange },
  ({ exchange }) =>
    Effect.gen(function* () {
      const encoded = yield* encodeExchange(CacheConformanceExchange.make(exchange));
      const historical = yield* decodeHistoricalExchange(encoded);
      const decoded = yield* S.decodeUnknownEffect(CacheConformanceExchange)(
        R.remove(R.remove(historical, "backendResult"), "taskHash")
      );
      assertNone(decoded.backendResult);
      assertNone(decoded.taskHash);
    }),
  { arbitrary: { runs: 25 } }
);

it("keeps unexpected HTTP status observations distinct from genuine misses", () => {
  for (const status of [101, 199, 302, 600]) {
    expect(classifyCacheConformanceStatus(true)(status)).toBe("unexpected-status");
    expect(classifyCacheConformanceStatus(false)(status)).toBe("unexpected-status");
  }
  expect(classifyCacheConformanceStatus(true)(404)).toBe("miss");
  expect(classifyCacheConformanceStatus(false)(404)).toBe("not-found");
});

it.effect("drains segmented replies up to the byte bound and refuses a partial oversized body", () =>
  Effect.gen(function* () {
    const response = () =>
      HttpClientResponse.fromWeb(
        HttpClientRequest.get("http://fixture.invalid/artifact"),
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array([1, 2]));
              controller.enqueue(new Uint8Array([3, 4]));
              controller.close();
            },
          })
        )
      );
    const complete = yield* readCacheConformanceReply(response(), 4);
    assertSome(complete.status, 200);
    expect(complete.body).toEqual(new Uint8Array([1, 2, 3, 4]));
    const oversized = yield* readCacheConformanceReply(response(), 3).pipe(Effect.result);
    oversized.pipe(Result.isFailure, assertTrue);
    if (Result.isFailure(oversized)) {
      expect(oversized.failure._tag).toBe("CacheCommandError");
      expect(oversized.failure.message).toContain("exceeded its byte bound");
    }
    const empty = HttpClientResponse.fromWeb(
      HttpClientRequest.get("http://fixture.invalid/artifact"),
      new Response(null)
    );
    expect((yield* readCacheConformanceReply(empty, 0)).body.byteLength).toBe(0);
  })
);

it.effect("propagates a reply stream failure rather than returning its completed prefix", () =>
  Effect.gen(function* () {
    let started = false;
    const response = HttpClientResponse.fromWeb(
      HttpClientRequest.get("http://fixture.invalid/artifact"),
      new Response(
        new ReadableStream<Uint8Array>({
          pull(controller) {
            if (started) controller.error("synthetic interrupted response");
            else {
              started = true;
              controller.enqueue(new Uint8Array([1, 2]));
            }
          },
        })
      )
    );
    const result = yield* readCacheConformanceReply(response).pipe(Effect.result);
    result.pipe(Result.isFailure, assertTrue);
    if (Result.isFailure(result)) expect(result.failure._tag).toBe("HttpClientError");
  })
);
