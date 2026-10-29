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
import { BunSqliteTestDriver, makeSqlTestLayer } from "@beep/test-utils/SqlTest";
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import { expect } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const sqlLayer = makeSqlTestLayer({ config: undefined, driver: BunSqliteTestDriver });
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
  const server = Context.get(
    yield* Layer.build(BunHttpServer.layer({ unix: `${directory}/worker.sock` })),
    HttpServer.HttpServer
  );
  yield* fs.chmod(`${directory}/worker.sock`, 0o600);
  yield* server.serve(
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      if (request.method === "POST") yield* Ref.update(posts, (n) => n + 1);
      const result = yield* intake.handler;
      const scenario = yield* Ref.get(mode);
      // Keep the acknowledgment past the client deadline, but let server cleanup finish.
      if (scenario === "lost" && request.method === "POST") yield* Effect.sleep("1 second");
      if (scenario === "oversize") return HttpServerResponse.text(Str.repeat(17000)("X"));
      if (scenario === "forged" && request.method === "POST") {
        const row = (yield* facts.read(id("1"), 0))[0];
        if (row === undefined) return yield* Effect.die("Missing synthetic receipt");
        return HttpServerResponse.text(
          yield* encodeObservationLaunchReceiptJson(ObservationLaunchReceipt.make({ ...row, receiptId: id("f") })),
          {
            contentType: "application/json",
            headers: { "x-observation-receipt": id("f") },
          }
        );
      }
      return result;
    })
  );
  const policy = ObservationLaunchClientPolicy.make({
    directory,
    hostId: id("a"),
    namespaceId: id("b"),
    timeoutMillis: 250,
  });
  const uid = process.geteuid?.() ?? -1;
  const client = yield* makeObservationLaunchClient(policy, uid);
  const submission = ObservationLaunchSubmission.make({
    hostId: id("a"),
    namespaceId: id("b"),
    evidenceEpoch: 0,
    fact: prepare,
  });
  return { fs, directory, policy, uid, client, control, facts, mode, posts, submission };
});

it.layer(Layer.fresh(sqlLayer), { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("reads paused context through an owner-only socket and verifies exact committed receipts", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      expect(yield* f.client.context).toMatchObject({
        hostId: id("a"),
        namespaceId: id("b"),
        evidenceEpoch: 0,
        accepting: false,
      });
      yield* f.control.resume;
      expect((yield* f.client.context).accepting).toBe(true);
      const receipt = yield* f.client.submit(f.submission);
      expect(yield* f.client.submit(f.submission)).toEqual(receipt);
      expect(yield* f.facts.read(id("1"), 0)).toEqual([receipt]);
      expect(yield* Ref.get(f.posts)).toBe(2);
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
  it.effect("keeps lost acknowledgments ambiguous without retrying or changing facts", () =>
    Effect.gen(function* () {
      const f = yield* fixture();
      yield* f.control.resume;
      yield* Ref.set(f.mode, "lost");
      expect((yield* f.client.submit(f.submission).pipe(Effect.flip)).reason).toBe("ambiguous");
      const rows = yield* f.facts.read(id("1"), 0);
      expect(rows.length).toBe(1);
      expect(yield* Ref.get(f.posts)).toBe(1);
      yield* Ref.set(f.mode, "normal");
      expect(yield* f.client.submit(f.submission)).toEqual(rows[0]);
      expect(yield* Ref.get(f.posts)).toBe(2);
      expect((yield* f.facts.read(id("1"), 0)).length).toBe(1);
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
      expect(yield* Ref.get(f.posts)).toBe(0);
      yield* f.fs.chmod(`${f.directory}/worker.sock`, 0o666);
      expect((yield* f.client.context.pipe(Effect.flip)).reason).toBe("configuration");
      yield* f.fs.chmod(`${f.directory}/worker.sock`, 0o600);
      yield* f.fs.rename(`${f.directory}/worker.sock`, `${f.directory}/retired.sock`);
      const replacement = Context.get(
        yield* Layer.build(BunHttpServer.layer({ unix: `${f.directory}/worker.sock` })),
        HttpServer.HttpServer
      );
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
      expect(yield* Ref.get(f.posts)).toBe(1);
      const second = yield* fixture();
      expect((yield* second.client.context).accepting).toBe(false);
      yield* second.control.resume;
      expect((yield* second.client.submit(second.submission)).fact).toEqual(prepare);
      expect(yield* Ref.get(second.posts)).toBe(1);
      expect(yield* Ref.get(f.posts)).toBe(1);
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
      expect(yield* Ref.get(f.posts)).toBe(0);
    })
  )
);
