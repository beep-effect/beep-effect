import {
  buildCacheConformanceCorpus,
  CacheConformanceExchange,
  CacheConformancePaths,
  CacheConformanceRun,
  renderCacheConformanceCorpus,
  runCacheConformance,
  syncCacheConformanceCorpus,
} from "@beep/repo-cli/commands/Cache";
import { NodeServices } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
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
import type { ServerMode } from "./cache-conformance-server.ts";

const RunJson = S.fromJsonString(CacheConformanceRun, { space: 2 });
const runAgainst = Effect.fn("test.runAgainst")(function* (mode: ServerMode, split = true) {
  const server = yield* makeConformanceServer(mode);
  const corpus = yield* buildCacheConformanceCorpus(yield* repoRoot);
  const report = yield* runCacheConformance(corpus, targetFor({ url: server.url, readerWriterSplit: split }), bearers);
  return { report, tags: yield* server.tags };
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
