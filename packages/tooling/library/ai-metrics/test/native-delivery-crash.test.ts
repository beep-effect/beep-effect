import * as NodeURL from "node:url";
import { DeliveryEventState } from "@beep/repo-ai-metrics/delivery-ledger";
import { NativeDeliveryResult } from "@beep/repo-ai-metrics/native-delivery";
import { NativeScheduleTick } from "@beep/repo-ai-metrics/native-schedule";
import { it } from "@beep/test-runner";
import { provideScopedLayer } from "@beep/test-utils/Layer";
import * as BunHttpServer from "@effect/platform-bun/BunHttpServer";
import { NodeServices } from "@effect/platform-node";
import { expect } from "@effect/vitest";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as ChildProcess from "effect/process/ChildProcess";
import * as Ref from "effect/Ref";
import * as S from "effect/Schema";

const fixture = NodeURL.fileURLToPath(new URL("./fixtures/native-delivery-process.ts", import.meta.url));
const cwd = NodeURL.fileURLToPath(new URL("../", import.meta.url));
const Inspection = S.Struct({
  sendResult: S.NullOr(S.Union([NativeDeliveryResult, NativeScheduleTick])),
  state: S.NullOr(DeliveryEventState),
  attempts: S.Tuple([S.Struct({ n: S.Natural })]),
  results: S.Tuple([S.Struct({ n: S.Natural })]),
  integrity: S.Tuple([S.Struct({ integrity_check: S.Literal("ok") })]),
});
const scenario = Effect.fn("DeliveryCrashTest.scenario")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const executablePath = yield* Config.String("PATH");
  const dir = yield* fs.makeTempDirectoryScoped();
  const context = yield* Layer.build(BunHttpServer.layer({ hostname: "127.0.0.1", port: 0 }));
  const server = Context.get(context, HttpServer.HttpServer);
  const calls = yield* Ref.make(0);
  const reads = yield* Ref.make(0);
  yield* server.serve(
    Effect.gen(function* () {
      const request = yield* HttpServerRequest.HttpServerRequest;
      if (request.method !== "POST") {
        yield* Ref.update(reads, (n) => n + 1);
        return yield* HttpServerResponse.json({ data: [], next_cursor: null });
      }
      const wire = new TextDecoder().decode(yield* request.arrayBuffer);
      expect(wire).not.toContain("synthetic-private-ledger-source");
      expect(wire).toContain("synthetic-process");
      yield* Ref.update(calls, (n) => n + 1);
      return HttpServerResponse.uint8Array(new Uint8Array(), { contentType: "application/x-protobuf" });
    })
  );
  const endpoint = `${HttpServer.formatAddress(server.address)}/v1/traces`;
  const output = `${dir}/result.json`;
  const marker = `${dir}/boundary.json`;
  const run = Effect.fn("DeliveryCrashTest.run")(function* (
    mode: "inspect" | "send" | "before-result" | "after-result" | "schedule-before-result" | "schedule-tick"
  ) {
    yield* fs.remove(output, { force: true });
    yield* fs.remove(marker, { force: true });
    const child = yield* ChildProcess.make(
      "bun",
      ["--no-env-file", fixture, mode, `${dir}/journal.sqlite`, output, marker, endpoint],
      {
        cwd,
        env: { PATH: executablePath },
        extendEnv: false,
        stdin: "ignore",
        stdout: "ignore",
        stderr: "inherit",
        killSignal: "SIGKILL",
      }
    );
    if (mode === "before-result" || mode === "after-result" || mode === "schedule-before-result") {
      while (!(yield* fs.exists(marker))) {
        expect(yield* child.isRunning).toBe(true);
        yield* Effect.sleep("10 millis");
      }
      const observed = yield* fs
        .readFileString(marker)
        .pipe(Effect.flatMap(S.decodeEffect(S.fromJsonString(S.Unknown))));
      expect(observed).toEqual({
        boundary: mode,
        attempts: [{ n: 1 }],
        results: [{ n: mode === "before-result" || mode === "schedule-before-result" ? 0 : 1 }],
      });
      expect(yield* fs.exists(output)).toBe(false);
      yield* child.kill({ killSignal: "SIGKILL" });
      expect(Exit.isFailure(yield* Effect.exit(child.exitCode))).toBe(true);
      expect(yield* child.isRunning).toBe(false);
      return;
    }
    expect(yield* child.exitCode).toBe(0);
    return yield* fs
      .readFileString(output)
      .pipe(Effect.flatMap(S.decodeEffect(S.fromJsonString(S.toCodecJson(Inspection)))));
  });
  return { run, calls, reads };
});
for (const mode of ["before-result", "after-result"])
  it.live(`survives sender death ${mode} without sending the same attempt twice`, () =>
    Effect.gen(function* () {
      const { run, calls } = yield* scenario();
      if (mode !== "before-result" && mode !== "after-result") return yield* Effect.die("Invalid fixture mode");
      yield* run(mode);
      expect(yield* Ref.get(calls)).toBe(1);
      const inspected = yield* run("inspect");
      expect(inspected).toMatchObject({
        state: { state: mode === "before-result" ? "unresolved" : "accepted-unverified", attempts: 1 },
        results: [{ n: mode === "before-result" ? 0 : 1 }],
      });
      const replay = yield* run("send");
      expect(replay).toMatchObject({
        sendResult: { _tag: "ExistingAttempt" },
        state: inspected?.state,
        attempts: [{ n: 1 }],
      });
      expect(yield* Ref.get(calls)).toBe(1);
    }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer), Effect.timeout("20 seconds"))
  );

it.live("recovers the scheduler cursor after SIGKILL between backend acceptance and result commit", () =>
  Effect.gen(function* () {
    const { run, calls, reads } = yield* scenario();
    yield* run("schedule-before-result");
    expect(yield* Ref.get(calls)).toBe(1);
    const next = yield* run("schedule-tick");
    expect(next).toMatchObject({
      sendResult: { _tag: "Complete", outcomes: [{ _tag: "Sent", result: { outcome: { _tag: "Accepted" } } }] },
      state: { state: "unresolved", attempts: 1 },
      attempts: [{ n: 2 }],
      results: [{ n: 1 }],
    });
    const wrapped = yield* run("schedule-tick");
    expect(wrapped).toMatchObject({
      sendResult: { _tag: "Complete", wrapped: true, outcomes: [{ _tag: "Reconciled", result: { _tag: "Missing" } }] },
      state: { state: "unresolved", attempts: 1 },
      attempts: [{ n: 2 }],
    });
    expect(yield* Ref.get(calls)).toBe(2);
    expect(yield* Ref.get(reads)).toBe(1);
  }).pipe(Effect.scoped, provideScopedLayer(NodeServices.layer), Effect.timeout("20 seconds"))
);
