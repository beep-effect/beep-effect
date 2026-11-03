import { makeObservationControl, ObservationControlPolicy } from "@beep/repo-ai-metrics/observation-control";
import {
  makeObservationLaunchClient,
  ObservationLaunchClientPolicy,
} from "@beep/repo-ai-metrics/observation-launch-client";
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
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import { expect } from "@effect/vitest";
import * as Clock from "effect/Clock";
import * as Context from "effect/Context";
import * as Deferred from "effect/Deferred";
import * as Effect from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";

const sqlLayer = makeSqlTestLayer({ config: undefined, driver: NodeSqliteTestDriver });
const id = (digit: string) => Sha256Hex.make(Str.repeat(64)(digit));
const prepare = ObservationLaunchFact.cases.Prepared.make({
  launchId: id("1"),
  identity: ObservationLaunchIdentity.make({
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
  }),
});
const encodeObservationLaunchReceiptJson = S.encodeEffect(S.fromJsonString(ObservationLaunchReceipt));

const fixture = Effect.fn("LaunchClientTest.fixture")(function* () {
  // Protocol validation uses real IO; only this fixture controls its deadline clock.
  const clock = yield* TestClock.make({ warningDelay: "30 seconds" });
  const currentTimeMillis1 = yield* Clock.currentTimeMillis;
  yield* clock.setTime(currentTimeMillis1);
  const fs = yield* FileSystem.FileSystem;
  const directory = yield* fs.makeTempDirectoryScoped({ directory: "/tmp", prefix: "obs-client-" });
  yield* fs.chmod(directory, 0o700);
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
  const intake = yield* makeObservationLaunchHttp(
    config,
    ObservationLaunchHttpPolicy.make({
      routes: [{ routeId: id("c"), harness: "codex-cli", surface: "cli" }],
      bodyTimeoutMillis: 200,
    }),
    control
  );
  const facts = yield* makeObservationLaunchFacts(config);
  const mode = yield* Ref.make("normal");
  const posts = yield* Ref.make(0);
  const reached = yield* Deferred.make<void>();
  const release = yield* Deferred.make<void>();
  const build2 = yield* Layer.build(BunHttpServer.layer({ unix: `${directory}/worker.sock` }));
  const server = Context.get(build2, HttpServer.HttpServer);
  yield* fs.chmod(`${directory}/worker.sock`, 0o600);
  const receiptRow = Effect.gen(function* () {
    const row = (yield* facts.read(id("1"), 0))[0];
    if (row === undefined) return yield* Effect.die("Missing synthetic receipt");
    return row;
  });
  const fixedResponse = (scenario: string, result: HttpServerResponse.HttpServerResponse) => {
    if (scenario === "conflict") return O.some(HttpServerResponse.empty({ status: 409 }));
    if (scenario === "invalid-utf8") return O.some(HttpServerResponse.uint8Array(new Uint8Array([0xff])));
    if (scenario === "wrong-header")
      return O.some(HttpServerResponse.setHeader(result, "x-observation-receipt", id("f")));
    if (scenario === "oversize") return O.some(HttpServerResponse.text(Str.repeat(17000)("X")));
    return O.none();
  };
  const postResponse = Effect.fnUntraced(function* (scenario: string, result: HttpServerResponse.HttpServerResponse) {
    if (scenario === "lost") {
      yield* Deferred.succeed(reached, undefined);
      return yield* Effect.as(Deferred.await(release), result);
    }
    if (scenario === "forged") {
      const row = yield* receiptRow;
      const encodedObservationLaunchReceiptJson = yield* encodeObservationLaunchReceiptJson(
        ObservationLaunchReceipt.make({ ...row, receiptId: id("f") })
      );
      return HttpServerResponse.text(encodedObservationLaunchReceiptJson, {
        contentType: "application/json",
        headers: { "x-observation-receipt": id("f") },
      });
    }
    if (scenario === "extra-field") {
      const row = yield* receiptRow;
      const json = yield* encodeObservationLaunchReceiptJson(row);
      return HttpServerResponse.text(`${Str.slice(0, -1)(json)},"private-extra":true}`, {
        contentType: "application/json",
        headers: { "x-observation-receipt": row.receiptId },
      });
    }
    return result;
  });
  yield* server.serve(
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      const isPost = request.method === "POST";
      if (isPost) yield* Ref.update(posts, (n) => n + 1);
      const result = yield* Effect.provideService(intake.handler, Clock.Clock, clock);
      const scenario = yield* Ref.get(mode);
      if (scenario === "blocked") {
        yield* Deferred.succeed(reached, undefined);
        yield* Deferred.await(release);
      }
      const fixed = fixedResponse(scenario, result);
      if (O.isSome(fixed)) return fixed.value;
      return isPost ? yield* postResponse(scenario, result) : result;
    })
  );
  const policy = ObservationLaunchClientPolicy.make({
    directory,
    hostId: id("a"),
    namespaceId: id("b"),
    timeoutMillis: 250,
  });
  const uid = process.geteuid?.() ?? -1;
  const rawClient = yield* makeObservationLaunchClient(policy, uid);
  // Release held replies before either client or graceful server shutdown runs.
  yield* Effect.addFinalizer(() => Deferred.succeed(release, undefined));
  const client = {
    context: Effect.provideService(rawClient.context, Clock.Clock, clock),
    submit: (submission: ObservationLaunchSubmission) =>
      Effect.provideService(rawClient.submit(submission), Clock.Clock, clock),
  };
  const submission = ObservationLaunchSubmission.make({
    hostId: id("a"),
    namespaceId: id("b"),
    evidenceEpoch: 0,
    fact: prepare,
  });
  return { fs, directory, policy, uid, client, control, facts, mode, posts, submission, reached, release, clock };
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("reads paused context through an owner-only socket and verifies exact committed receipts", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const context3 = yield* f.client.context;
      expect(context3).toMatchObject({
        hostId: id("a"),
        namespaceId: id("b"),
        evidenceEpoch: 0,
        accepting: false,
      });
      yield* f.control.resume;
      expect((yield* f.client.context).accepting).toBe(true);
      const receipt = yield* f.client.submit(f.submission);
      const submit4 = yield* f.client.submit(f.submission);
      expect(submit4).toEqual(receipt);
      const read5 = yield* f.facts.read(id("1"), 0);
      expect(read5).toEqual([receipt]);
      const got = yield* Ref.get(f.posts);
      expect(got).toBe(2);
      expect(
        (yield* f.client
          .submit(ObservationLaunchSubmission.make({ ...f.submission, evidenceEpoch: 1 }))
          .pipe(Effect.flip)).reason
      ).toBe("retired");
      expect((yield* f.client.context).evidenceEpoch).toBe(0);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("refuses malformed acknowledgments and conflicts without losing committed facts", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.control.resume;
      for (const scenario of ["invalid-utf8", "extra-field", "wrong-header", "conflict"]) {
        yield* Ref.set(f.mode, scenario);
        const error = yield* f.client.submit(f.submission).pipe(Effect.flip);
        expect(error.reason, scenario).toBe(scenario === "conflict" ? "conflict" : "invalid-response");
        expect(String(error)).not.toContain("private-extra");
        expect((yield* f.facts.read(id("1"), 0)).length).toBe(1);
      }
      yield* Ref.set(f.mode, "normal");
      expect((yield* f.client.submit(f.submission)).fact).toEqual(prepare);
      const got6 = yield* Ref.get(f.posts);
      expect(got6).toBe(5);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("rejects overlapping work and recovers admission after cancellation", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* Ref.set(f.mode, "blocked");
      const pending = yield* f.client.context.pipe(Effect.forkChild);
      yield* Deferred.await(f.reached);
      expect((yield* f.client.context.pipe(Effect.flip)).reason).toBe("busy");
      yield* Fiber.interrupt(pending);
      yield* Ref.set(f.mode, "normal");
      yield* Deferred.succeed(f.release, undefined);
      expect((yield* f.client.context).accepting).toBe(false);
      const got7 = yield* Ref.get(f.posts);
      expect(got7).toBe(0);
    }).pipe(Effect.timeout("3 seconds"))
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("keeps lost acknowledgments ambiguous without retrying or changing facts", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.control.resume;
      yield* Ref.set(f.mode, "lost");
      const pending = yield* f.client.submit(f.submission).pipe(Effect.flip, Effect.forkChild);
      // Advance only after the real handler has committed and withheld the acknowledgment.
      yield* Deferred.await(f.reached);
      yield* f.clock.adjust(f.policy.timeoutMillis - 1);
      expect(pending.pollUnsafe()).toBeUndefined();
      yield* f.clock.adjust(1);
      expect((yield* Fiber.join(pending)).reason).toBe("ambiguous");
      const rows = yield* f.facts.read(id("1"), 0);
      expect(rows.length).toBe(1);
      const got8 = yield* Ref.get(f.posts);
      expect(got8).toBe(1);
      yield* Ref.set(f.mode, "normal");
      yield* Deferred.succeed(f.release, undefined);
      const submit9 = yield* f.client.submit(f.submission);
      expect(submit9).toEqual(rows[0]);
      const got10 = yield* Ref.get(f.posts);
      expect(got10).toBe(2);
      expect((yield* f.facts.read(id("1"), 0)).length).toBe(1);
    }).pipe(Effect.timeout("3 seconds"))
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("releases held replies before shutdown when the enclosing scope fails", () =>
    Effect.gen(function* () {
      const failure = yield* Effect.scoped(
        Effect.gen(function* () {
          const f = yield* fixture();
          yield* f.control.resume;
          yield* Ref.set(f.mode, "lost");
          yield* f.client.submit(f.submission).pipe(Effect.forkChild);
          yield* Deferred.await(f.reached);
          return yield* Effect.fail("synthetic-scope-failure");
        })
      ).pipe(Effect.flip);
      expect(failure).toBe("synthetic-scope-failure");
    }).pipe(Effect.timeout("3 seconds"))
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("rejects forged receipt digests and unbounded responses", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.control.resume;
      yield* Ref.set(f.mode, "forged");
      expect((yield* f.client.submit(f.submission).pipe(Effect.flip)).reason).toBe("invalid-response");
      expect((yield* f.facts.read(id("1"), 0)).length).toBe(1);
      yield* Ref.set(f.mode, "oversize");
      expect((yield* f.client.context.pipe(Effect.flip)).reason).toBe("unavailable");
      yield* Ref.set(f.mode, "normal");
      expect((yield* f.client.submit(f.submission)).fact).toEqual(prepare);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("refuses exposed permissions, wrong destinations and replacement socket identities", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const wrong = yield* makeObservationLaunchClient(
        ObservationLaunchClientPolicy.make({ ...f.policy, hostId: id("f") }),
        f.uid
      );
      expect((yield* wrong.context.pipe(Effect.flip)).reason).toBe("invalid-response");
      expect((yield* wrong.submit(f.submission).pipe(Effect.flip)).reason).toBe("configuration");
      const got11 = yield* Ref.get(f.posts);
      expect(got11).toBe(0);
      yield* f.fs.chmod(`${f.directory}/worker.sock`, 0o666);
      expect((yield* f.client.context.pipe(Effect.flip)).reason).toBe("configuration");
      yield* f.fs.chmod(`${f.directory}/worker.sock`, 0o600);
      yield* f.fs.rename(`${f.directory}/worker.sock`, `${f.directory}/retired.sock`);
      const build12 = yield* Layer.build(BunHttpServer.layer({ unix: `${f.directory}/worker.sock` }));
      const replacement = Context.get(build12, HttpServer.HttpServer);
      yield* replacement.serve(Effect.succeed(HttpServerResponse.text("synthetic replacement")));
      yield* f.fs.chmod(`${f.directory}/worker.sock`, 0o600);
      expect((yield* f.client.context.pipe(Effect.flip)).reason).toBe("configuration");
    })
  )
);

it.layer(Layer.merge(Layer.fresh(sqlLayer), NodeHttpClient.layerNodeHttp), {
  timeout: "30 seconds",
  excludeTestServices: true,
})((it) =>
  it.effect("keeps its private socket client isolated from the enclosing command HTTP client", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      expect((yield* f.client.context).accepting).toBe(false);
      yield* f.control.resume;
      expect((yield* f.client.submit(f.submission)).fact).toEqual(prepare);
      const got13 = yield* Ref.get(f.posts);
      expect(got13).toBe(1);
      const second = yield* fixture();
      expect((yield* second.client.context).accepting).toBe(false);
      yield* second.control.resume;
      expect((yield* second.client.submit(second.submission)).fact).toEqual(prepare);
      const got14 = yield* Ref.get(second.posts);
      expect(got14).toBe(1);
      const got15 = yield* Ref.get(f.posts);
      expect(got15).toBe(1);
    })
  )
);

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("refuses missing owner metadata when the caller UID is unavailable", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      const missingOwner = {
        ...f.fs,
        lstat: (path: string) => f.fs.lstat(path).pipe(Effect.map((info) => ({ ...info, uid: O.none<number>() }))),
      };
      const error = yield* makeObservationLaunchClient(f.policy, -1).pipe(
        Effect.provideService(FileSystem.FileSystem, missingOwner),
        Effect.flip
      );
      expect(error.reason).toBe("configuration");
      const got16 = yield* Ref.get(f.posts);
      expect(got16).toBe(0);
    })
  )
);
