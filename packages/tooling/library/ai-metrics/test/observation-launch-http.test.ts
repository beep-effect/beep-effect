import { makeObservationControl, ObservationControlPolicy } from "@beep/repo-ai-metrics/observation-control";
import {
  makeObservationLaunchFacts,
  ObservationLaunchFact,
  ObservationLaunchIdentity,
  ObservationLaunchReceipt,
} from "@beep/repo-ai-metrics/observation-launch-facts";
import {
  makeObservationLaunchHttp,
  ObservationLaunchHttpPolicy,
  ObservationLaunchSubmission,
} from "@beep/repo-ai-metrics/observation-launch-http";
import { TranscriptIntakeConfig } from "@beep/repo-ai-metrics/transcript-intake";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { makeSqlTestLayer, NodeSqliteTestDriver } from "@beep/test-utils/SqlTest";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import * as NodeHttpServer from "@effect/platform-node/NodeHttpServer";
import { expect } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpServer from "effect/http/HttpServer";
import * as Layer from "effect/Layer";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import * as SqlClient from "effect/sql/SqlClient";

const sqlLayer = makeSqlTestLayer({ config: undefined, driver: NodeSqliteTestDriver });
const id = (digit: string) => Sha256Hex.make(Str.repeat(64)(digit));
const identity = ObservationLaunchIdentity.make({
  routeId: id("c"),
  harness: "codex-cli",
  surface: "cli",
  root: { _tag: "Unknown" },
  repository: { _tag: "Unknown" },
  clone: { _tag: "Unknown" },
  worktree: { _tag: "Unknown" },
  task: { _tag: "Unknown" },
  attempt: { _tag: "Unknown" },
  evidenceId: id("d"),
});
const prepare = ObservationLaunchFact.cases.Prepared.make({ launchId: id("1"), identity });
const encodeObservationLaunchSubmissionJson = S.encodeEffect(S.fromJsonString(ObservationLaunchSubmission));

const fixture = Effect.fn("LaunchHttpTest.fixture")(function* (enabled = true) {
  const config = TranscriptIntakeConfig.make({
    hostId: id("a"),
    namespaceId: id("b"),
    maxPages: 2,
    maxPayloadBytes: 65536,
    maxDatabasePages: 256,
  });
  const control = yield* makeObservationControl(
    ObservationControlPolicy.make({ maxActive: 2, drainTimeoutMillis: 1000 })
  );
  const policy = ObservationLaunchHttpPolicy.make({
    routes: enabled === true ? [{ routeId: id("c"), harness: "codex-cli", surface: "cli" }] : [],
    bodyTimeoutMillis: 200,
  });
  const intake = yield* makeObservationLaunchHttp(config, policy, control);
  const facts = yield* makeObservationLaunchFacts(config);
  const server = Context.get(yield* Layer.build(Layer.fresh(NodeHttpServer.layerTest)), HttpServer.HttpServer);
  const client = Context.get(yield* Layer.build(NodeHttpClient.layerNodeHttp), HttpClient.HttpClient);
  yield* server.serve(intake.handler);
  const url = `${HttpServer.formatAddress(server.address)}/v1/launch-facts`;
  const submission = (fact = prepare) =>
    ObservationLaunchSubmission.make({ hostId: id("a"), namespaceId: id("b"), evidenceEpoch: 0, fact });
  const encode = encodeObservationLaunchSubmissionJson;
  const post = Effect.fn("LaunchHttpTest.post")(function* (
    body: string,
    contentType = "application/json",
    method: "POST" | "GET" = "POST"
  ) {
    const received = yield* client.execute(
      HttpClientRequest.make(method)(url).pipe(HttpClientRequest.bodyText(body, contentType))
    );
    return { status: received.status, headers: received.headers, text: yield* received.text };
  });
  return { config, control, facts, post, submission, encode, client, url };
});
const decodeObservationLaunchReceiptJson = S.decodeEffect(S.fromJsonString(ObservationLaunchReceipt));

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("acknowledges only committed local facts and returns identical receipts on exact replay", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const body = yield* f.encode(f.submission());
      expect((yield* f.post(body)).status).toBe(503);
      expect(yield* f.facts.read(id("1"), 0)).toEqual([]);
      yield* f.control.resume;
      const first = yield* f.post(body);
      expect(first.status).toBe(200);
      const receipt = yield* decodeObservationLaunchReceiptJson(first.text);
      expect(first.headers["x-observation-receipt"]).toBe(receipt.receiptId);
      expect(yield* f.facts.read(id("1"), 0)).toEqual([receipt]);
      expect((yield* f.post(body)).text).toBe(first.text);
      const started = ObservationLaunchFact.cases.Started.make({ launchId: id("1"), processInstanceId: id("2") });
      const startedBody = yield* f.encode(ObservationLaunchSubmission.make({ ...f.submission(), fact: started }));
      expect((yield* f.post(startedBody)).status).toBe(200);
      yield* f.control.pause;
      expect((yield* f.post(startedBody)).status).toBe(503);
      yield* f.control.resume;
      expect((yield* f.post(body)).text).toBe(first.text);
      expect((yield* f.facts.read(id("1"), 0)).length).toBe(2);
      expect(first.headers["cache-control"]).toBe("no-store");
    })
  )
);
const encodeJsonValue = S.encodeEffect(S.fromJsonString(S.Unknown));

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect(
    "refuses unknown private fields, destinations, epochs, routes and conflicting facts without acknowledgments",
    () =>
      Effect.gen(function* () {
        const f = yield* fixture();
        yield* f.control.resume;
        const base = yield* S.encodeEffect(ObservationLaunchSubmission)(f.submission());
        const json = encodeJsonValue;
        for (const [value, status] of [
          [{ ...base, prompt: "private-canary" }, 400],
          [{ ...base, hostId: id("f") }, 409],
          [{ ...base, namespaceId: id("f") }, 409],
          [{ ...base, evidenceEpoch: 1 }, 410],
          [{ ...base, fact: { ...base.fact, identity: { ...identity, surface: "desktop" } } }, 403],
          [{ ...base, fact: { ...base.fact, identity: { ...identity, routeId: id("f") } } }, 403],
        ] as const) {
          const result = yield* f.post(yield* json(value));
          expect(result.status).toBe(status);
          expect(result.headers["x-observation-receipt"]).toBeUndefined();
          expect(result.text).not.toContain("private-canary");
        }
        expect(yield* f.facts.read(id("1"), 0)).toEqual([]);
        expect((yield* f.post(yield* f.encode(f.submission()))).status).toBe(200);
        const changed = { ...base, fact: { ...base.fact, identity: { ...identity, evidenceId: id("f") } } };
        expect((yield* f.post(yield* json(changed))).status).toBe(409);
      })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("enforces streaming body limits, timeout and no queued admission", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.control.resume;
      expect((yield* f.post("{}", "text/plain")).status).toBe(415);
      expect((yield* f.post("{}", "application/json", "GET")).status).toBe(405);
      expect((yield* f.post(Str.repeat(8193)(" "))).status).toBe(413);
      const oversized = yield* f.client.execute(
        HttpClientRequest.post(f.url).pipe(
          HttpClientRequest.bodyStream(Stream.make(new Uint8Array(8193)), { contentType: "application/json" })
        )
      );
      expect(oversized.status).toBe(413);
      yield* oversized.text;
      const partial = Stream.make(new TextEncoder().encode("{")).pipe(Stream.concat(Stream.fromEffect(Effect.never)));
      const slow = yield* f.client
        .execute(
          HttpClientRequest.post(f.url).pipe(HttpClientRequest.bodyStream(partial, { contentType: "application/json" }))
        )
        .pipe(Effect.forkChild);
      let busy = 0;
      for (let attempt = 0; attempt < 20 && busy !== 503; attempt++) {
        yield* Effect.sleep("5 millis");
        busy = (yield* f.post("{}")).status;
      }
      expect(busy).toBe(503);
      const timedOut = yield* Fiber.join(slow);
      expect(timedOut.status).toBe(503);
      yield* timedOut.text;
      expect(yield* f.facts.read(id("1"), 0)).toEqual([]);
      expect((yield* f.control.status).active).toBe(0);
      expect((yield* f.post(yield* f.encode(f.submission()))).status).toBe(200);
    }).pipe(Effect.timeout("3 seconds"))
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("keeps an unenrolled launch endpoint disabled", () =>
    Effect.gen(function* () {
      const f = yield* fixture(false);
      yield* f.control.resume;
      expect((yield* f.post(yield* f.encode(f.submission()))).status).toBe(404);
      expect(yield* f.facts.read(id("1"), 0)).toEqual([]);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("never acknowledges a rolled-back launch fact", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.control.resume;
      const sql = yield* SqlClient.SqlClient;
      yield* sql`CREATE TRIGGER synthetic_launch_failure BEFORE INSERT ON observation_launch_facts BEGIN SELECT RAISE(ABORT,'synthetic'); END`;
      const body = yield* f.encode(f.submission());
      const refused = yield* f.post(body);
      expect(refused.status).toBe(503);
      expect(refused.headers["x-observation-receipt"]).toBeUndefined();
      expect(yield* f.facts.read(id("1"), 0)).toEqual([]);
      yield* sql`DROP TRIGGER synthetic_launch_failure`;
      expect((yield* f.post(body)).status).toBe(200);
    })
  )
);
