import {
  CacheConformanceExchange,
  CacheConformanceProxyEvent,
  CacheConformanceProxyOptions,
  CacheProducerBinding,
  CacheProtocolNativeSummary,
  makeCacheConformanceFaultProxy,
} from "@beep/repo-cli/commands/Cache";
import { CacheHostedProducerUpload, joinCacheProducerUpload } from "@beep/repo-cli/test/Cache";
import { Sha256HexFromBytes } from "@beep/schema";
import { fcRuns } from "@beep/test-utils";
import { NodeCrypto } from "@effect/platform-node";
import { expect, it } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { bearers, goodMode, makeConformanceServer, secrets, targetFor, teamId } from "./cache-conformance-server.ts";
import { input } from "./helpers/cache-producer-bundle-fixture.ts";

const hash = "0123456789abcdef";
const hashBytes = S.decodeEffect(Sha256HexFromBytes);
const encodeUpload = S.encodeEffect(S.fromJsonString(CacheHostedProducerUpload));
const Services = Layer.mergeAll(NodeCrypto.layer, FetchHttpClient.layer);

const fixture = Effect.fn("ProducerUploadTest.fixture")(function* (taskHash = hash) {
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

it.layer(Services, { timeout: "30 seconds", excludeTestServices: true })("owned producer upload join", (it) => {
  it.effect.prop(
    "joins schema-generated native hashes and refuses a different owned summary hash",
    { taskHash: CacheHostedProducerUpload.fields.taskHash },
    ({ taskHash }) =>
      Effect.gen(function* () {
        const f = yield* fixture(taskHash);
        const upload = yield* joinCacheProducerUpload(f.binding, f.summary, f.events);
        expect(upload.taskHash).toBe(taskHash);
        expect(upload.archiveSha256).toBe(f.archiveSha256);
        expect(upload.archiveBytes).toBe(f.archiveBytes);
        const wrongHash = taskHash === hash ? "fedcba9876543210" : hash;
        const altered = CacheProtocolNativeSummary.make({
          ...f.summary,
          tasks: A.map(f.summary.tasks, (task) => ({ ...task, hash: wrongHash })),
        });
        (yield* joinCacheProducerUpload(f.binding, altered, f.events).pipe(Effect.result)).pipe(
          Result.isFailure,
          assertTrue
        );
      }),
    { arbitrary: fcRuns(12) }
  );

  it.effect("joins actual observed upload bytes to one successful fresh native task", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      assertSome(f.event.exchange.taskHash, hash);
      assertSome(f.event.exchange.backendResult, "allowed");
      const upload = yield* joinCacheProducerUpload(f.binding, f.summary, f.events);
      expect(upload).toEqual({
        taskHash: hash,
        archiveSha256: f.archiveSha256,
        archiveBytes: f.archiveBytes,
        status: 200,
        backendResult: "allowed",
      });
      const encoded = yield* encodeUpload(upload);
      for (const value of [secrets.writer, "opaque-tag-canary", "owned-upload-body-canary"])
        expect(encoded).not.toContain(value);
    })
  );

  it.effect("retains only canonical native hashes in real proxy exchanges", () =>
    Effect.forEach(
      [
        { value: hash, retained: true },
        { value: "0123456789ABCDEF", retained: false },
        { value: "00112233445566778899aabbccddeeff", retained: false },
        { value: "hash-secret-canary", retained: false },
      ],
      ({ value, retained }) =>
        Effect.gen(function* () {
          const f = yield* fixture(value);
          if (retained) assertSome(f.event.exchange.taskHash, value);
          else assertNone(f.event.exchange.taskHash);
        }),
      { concurrency: 1, discard: true }
    )
  );

  it.effect("rejects absent, multiple, mismatched, cached and failed native tasks", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const task = O.getOrThrow(A.head(f.summary.tasks));
      const invalid = [
        CacheProtocolNativeSummary.make({ ...f.summary, tasks: [] }),
        CacheProtocolNativeSummary.make({ ...f.summary, tasks: [task, task] }),
        CacheProtocolNativeSummary.make({ ...f.summary, turboVersion: "unapproved-client" }),
        CacheProtocolNativeSummary.make({ ...f.summary, tasks: [{ ...task, taskId: "unapproved#task" }] }),
        CacheProtocolNativeSummary.make({ ...f.summary, tasks: [{ ...task, hash: "fedcba9876543210" }] }),
        CacheProtocolNativeSummary.make({
          ...f.summary,
          tasks: [{ ...task, cache: { ...task.cache, status: "HIT" } }],
        }),
        CacheProtocolNativeSummary.make({ ...f.summary, tasks: [{ ...task, execution: { exitCode: 1 } }] }),
      ];
      yield* Effect.forEach(
        invalid,
        (summary) =>
          Effect.gen(function* () {
            (yield* joinCacheProducerUpload(f.binding, summary, f.events).pipe(Effect.result)).pipe(
              Result.isFailure,
              assertTrue
            );
          }),
        { concurrency: 1, discard: true }
      );
    })
  );

  it.effect.prop(
    "checks the whole reviewed graph before joining its selected upload task",
    { dependencyHash: CacheHostedProducerUpload.fields.taskHash },
    ({ dependencyHash }) =>
      Effect.gen(function* () {
        const f = yield* fixture();
        const selected = O.getOrThrow(A.head(f.summary.tasks));
        const dependency = { ...selected, taskId: "@beep/types#build", hash: dependencyHash };
        const summary = CacheProtocolNativeSummary.make({ ...f.summary, tasks: [dependency, selected] });
        const expectedTasks = [selected.taskId, dependency.taskId];
        const upload = yield* joinCacheProducerUpload(f.binding, summary, f.events, expectedTasks);
        expect(upload.taskHash).toBe(selected.hash);
        expect(upload.archiveSha256).toBe(f.archiveSha256);
        (yield* joinCacheProducerUpload(f.binding, summary, f.events).pipe(Effect.result)).pipe(
          Result.isFailure,
          assertTrue
        );
      }),
    { arbitrary: fcRuns(12) }
  );

  it.effect("rejects missing, foreign, duplicated, failed and cached graph dependencies", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const selected = O.getOrThrow(A.head(f.summary.tasks));
      const dependency = { ...selected, taskId: "@beep/types#build", hash: "fedcba9876543210" };
      const expectedTasks = [selected.taskId, dependency.taskId];
      const invalid: ReadonlyArray<CacheProtocolNativeSummary["tasks"]> = [
        [selected],
        [dependency],
        [selected, dependency, dependency],
        [selected, { ...dependency, taskId: "foreign#task" }],
        [selected, { ...dependency, hash: "not-a-native-hash" }],
        [selected, { ...dependency, cache: { ...dependency.cache, status: "HIT" } }],
        [selected, { ...dependency, cache: { ...dependency.cache, source: O.some("REMOTE") } }],
        [selected, { ...dependency, execution: { exitCode: 1 } }],
      ];
      yield* Effect.forEach(
        invalid,
        (tasks) =>
          Effect.gen(function* () {
            const summary = CacheProtocolNativeSummary.make({ ...f.summary, tasks });
            (yield* joinCacheProducerUpload(f.binding, summary, f.events, expectedTasks).pipe(Effect.result)).pipe(
              Result.isFailure,
              assertTrue
            );
          }),
        { concurrency: 1, discard: true }
      );
      const graph = CacheProtocolNativeSummary.make({ ...f.summary, tasks: [selected, dependency] });
      yield* Effect.forEach(
        [
          [],
          [selected.taskId],
          [selected.taskId, selected.taskId],
          A.makeBy(65, (index) => `dependency-${index}#build`),
        ],
        (expected) =>
          Effect.gen(function* () {
            (yield* joinCacheProducerUpload(f.binding, graph, f.events, expected).pipe(Effect.result)).pipe(
              Result.isFailure,
              assertTrue
            );
          }),
        { concurrency: 1, discard: true }
      );
      const withoutSelected = CacheProtocolNativeSummary.make({ ...f.summary, tasks: [dependency] });
      (yield* joinCacheProducerUpload(f.binding, withoutSelected, f.events, [dependency.taskId]).pipe(
        Effect.result
      )).pipe(Result.isFailure, assertTrue);
      const duplicated = CacheProtocolNativeSummary.make({ ...f.summary, tasks: [selected, selected, dependency] });
      (yield* joinCacheProducerUpload(f.binding, duplicated, f.events, [
        selected.taskId,
        selected.taskId,
        dependency.taskId,
      ]).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
      const oversized = CacheProtocolNativeSummary.make({
        ...f.summary,
        tasks: [selected, ...A.makeBy(64, (index) => ({ ...dependency, taskId: `dependency-${index}#build` }))],
      });
      (yield* joinCacheProducerUpload(
        f.binding,
        oversized,
        f.events,
        A.map(oversized.tasks, (task) => task.taskId)
      ).pipe(Effect.result)).pipe(Result.isFailure, assertTrue);
      const bounded = CacheProtocolNativeSummary.make({ ...oversized, tasks: A.take(oversized.tasks, 64) });
      const accepted = yield* joinCacheProducerUpload(
        f.binding,
        bounded,
        f.events,
        A.map(bounded.tasks, (task) => task.taskId)
      );
      expect(accepted.taskHash).toBe(selected.hash);
    })
  );

  it.effect("rejects failed, foreign, faulted and incoherent upload exchanges", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const exchange = f.event.exchange;
      const invalid = [
        CacheConformanceExchange.make({ ...exchange, role: "reader" }),
        CacheConformanceExchange.make({ ...exchange, selector: "foreign-team-id" }),
        CacheConformanceExchange.make({ ...exchange, strictScored: false }),
        CacheConformanceExchange.make({ ...exchange, outcome: "transport-error" }),
        CacheConformanceExchange.make({ ...exchange, status: O.some(500) }),
        CacheConformanceExchange.make({ ...exchange, status: O.none() }),
        CacheConformanceExchange.make({ ...exchange, method: "GET" }),
        CacheConformanceExchange.make({ ...exchange, hash: "non-hex" }),
        CacheConformanceExchange.make({ ...exchange, taskHash: O.none() }),
        CacheConformanceExchange.make({ ...exchange, requestSha256: O.none() }),
        CacheConformanceExchange.make({ ...exchange, requestTagSha256: O.none() }),
        CacheConformanceExchange.make({ ...exchange, requestBytes: 0 }),
        CacheConformanceExchange.make({ ...exchange, requestBytes: 50 * 1024 * 1024 + 1 }),
        CacheConformanceExchange.make({ ...exchange, backendResult: O.some("invalid-evidence") }),
        CacheConformanceExchange.make({ ...exchange, backendResult: O.none() }),
      ];
      yield* Effect.forEach(
        invalid,
        (exchange) =>
          Effect.gen(function* () {
            const event = CacheConformanceProxyEvent.make({ ...f.event, exchange });
            (yield* joinCacheProducerUpload(f.binding, f.summary, [event]).pipe(Effect.result)).pipe(
              Result.isFailure,
              assertTrue
            );
          }),
        { concurrency: 1, discard: true }
      );
      for (const event of [
        CacheConformanceProxyEvent.make({ ...f.event, fault: "missing-tag" }),
        CacheConformanceProxyEvent.make({ ...f.event, upstreamStatus: O.some(500) }),
      ])
        (yield* joinCacheProducerUpload(f.binding, f.summary, [event]).pipe(Effect.result)).pipe(
          Result.isFailure,
          assertTrue
        );
    })
  );

  it.effect("rejects missing, duplicate and over-bound captures without accepting a prefix", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      for (const events of [[], [f.event, f.event], A.replicate(f.event, 201)])
        (yield* joinCacheProducerUpload(f.binding, f.summary, events).pipe(Effect.result)).pipe(
          Result.isFailure,
          assertTrue
        );
    })
  );

  it.effect("allows successful metadata beside the upload but refuses metadata-only evidence", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const status = CacheConformanceProxyEvent.make({
        ...f.event,
        exchange: CacheConformanceExchange.make({
          ...f.event.exchange,
          method: "GET",
          route: "/v8/artifacts/status",
          hash: "none",
          taskHash: O.none(),
          requestBytes: 0,
          requestSha256: O.none(),
          requestTagSha256: O.none(),
        }),
      });
      const upload = yield* joinCacheProducerUpload(f.binding, f.summary, [status, f.event]);
      expect(upload.taskHash).toBe(hash);
      const unclassified = CacheConformanceProxyEvent.make({
        ...status,
        exchange: CacheConformanceExchange.make({ ...status.exchange, backendResult: O.none() }),
      });
      (yield* joinCacheProducerUpload(f.binding, f.summary, [unclassified, f.event]).pipe(Effect.result)).pipe(
        Result.isFailure,
        assertTrue
      );
      (yield* joinCacheProducerUpload(f.binding, f.summary, [status]).pipe(Effect.result)).pipe(
        Result.isFailure,
        assertTrue
      );
    })
  );
});
