import * as NodeURL from "node:url";
import * as Zlib from "node:zlib";
import { TranscriptAcceptance, TranscriptIntakeStats } from "@beep/repo-ai-metrics/transcript-intake";
import { it } from "@beep/test-runner";
import { NodeServices } from "@effect/platform-node";
import * as NodeHttpClient from "@effect/platform-node/NodeHttpClient";
import { expect } from "@effect/vitest";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Fiber from "effect/Fiber";
import * as FileSystem from "effect/FileSystem";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import * as ChildProcess from "effect/process/ChildProcess";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";

const fixturePath = NodeURL.fileURLToPath(new URL("./fixtures/native-http-process.ts", import.meta.url));
const packageRoot = NodeURL.fileURLToPath(new URL("../", import.meta.url));
const Inspection = S.Struct({
  stats: TranscriptIntakeStats,
  pages: S.Array(TranscriptAcceptance),
  events: S.Tuple([S.Struct({ n: S.Natural })]),
  receipts: S.Tuple([S.Struct({ n: S.Natural })]),
  integrity: S.Tuple([S.Struct({ integrity_check: S.tag("ok") })]),
});
const encodeJsonValue = S.encodeEffect(S.fromJsonString(S.Unknown));
const decodeInspectionJson = S.decodeEffect(S.fromJsonString(Inspection));
const decodeUrlRecordJson = S.decodeEffect(S.fromJsonString(S.Struct({ url: S.String })));
const decodeJsonValue = S.decodeEffect(S.fromJsonString(S.Unknown));

const scenario = Effect.fn("NativeHttpCrashTest.scenario")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const executablePath = yield* Config.String("PATH");
  const directory = yield* fs.makeTempDirectoryScoped();
  const ready = `${directory}/ready.json`;
  const marker = `${directory}/boundary.json`;
  const output = `${directory}/result.json`;
  const client = Context.get(yield* Layer.build(NodeHttpClient.layerNodeHttp), HttpClient.HttpClient);
  const body = yield* encodeJsonValue({
    resourceSpans: [
      {
        scopeSpans: [
          {
            spans: [
              {
                traceId: Str.repeat(32)("1"),
                spanId: Str.repeat(16)("2"),
                name: "synthetic-private-native-crash-command",
              },
            ],
          },
        ],
      },
    ],
  });
  const qualifyProtocol = Effect.fnUntraced(function* (url: string) {
    const post = (bytes: Uint8Array, contentType = "application/json", encoding = "identity") =>
      client
        .execute(
          HttpClientRequest.post(url).pipe(
            HttpClientRequest.bodyUint8Array(bytes),
            HttpClientRequest.setHeaders({ "content-type": contentType, "content-encoding": encoding })
          )
        )
        .pipe(Effect.flatMap((response) => response.arrayBuffer.pipe(Effect.as(response.status))));
    expect(yield* post(new Uint8Array(), "application/x-protobuf")).toBe(200);
    expect(yield* post(Zlib.gzipSync(body), "application/json", "gzip")).toBe(200);
    expect(yield* post(Zlib.gzipSync(Str.repeat(1_048_576)(" ")), "application/json", "gzip")).toBe(413);
    expect(yield* post(new Uint8Array([255]), "application/x-protobuf")).toBe(400);
    const incomplete = yield* client
      .execute(
        HttpClientRequest.post(url).pipe(
          HttpClientRequest.bodyStream(Stream.make(new TextEncoder().encode(" ")).pipe(Stream.concat(Stream.never)), {
            contentType: "application/json",
          })
        )
      )
      .pipe(
        Effect.flatMap((response) => response.arrayBuffer.pipe(Effect.as(response.status))),
        Effect.forkChild
      );
    let busy = 0;
    for (let attempt = 0; attempt < 20 && busy !== 503; attempt++) {
      yield* Effect.sleep("5 millis");
      busy = yield* post(new TextEncoder().encode("{}"));
    }
    expect(busy).toBe(503);
    expect(yield* Fiber.join(incomplete)).toBe(503);
    expect(yield* post(new TextEncoder().encode(body))).toBe(200);
  });
  const start = Effect.fn("NativeHttpCrashTest.start")(function* (
    mode: "inspect" | "serve" | "protocol" | "before-commit" | "after-commit"
  ) {
    yield* fs.remove(ready, { force: true });
    yield* fs.remove(marker, { force: true });
    yield* fs.remove(output, { force: true });
    const child = yield* ChildProcess.make(
      "bun",
      [
        "--no-env-file",
        fixturePath,
        mode === "protocol" ? "serve" : mode,
        `${directory}/intake.sqlite`,
        ready,
        output,
        marker,
      ],
      {
        cwd: packageRoot,
        env: { PATH: executablePath },
        extendEnv: false,
        killSignal: "SIGKILL",
        stdin: "ignore",
        stdout: "ignore",
        stderr: "inherit",
      }
    );
    if (mode === "inspect") {
      expect(yield* child.exitCode).toBe(0);
      return O.some(yield* fs.readFileString(output).pipe(Effect.flatMap(decodeInspectionJson)));
    }
    while (!(yield* fs.exists(ready))) {
      expect(yield* child.isRunning).toBe(true);
      yield* Effect.sleep("10 millis");
    }
    const { url } = yield* fs.readFileString(ready).pipe(Effect.flatMap(decodeUrlRecordJson));
    if (mode === "protocol") {
      yield* qualifyProtocol(url);
      yield* child.kill({ killSignal: "SIGKILL" });
      expect(Exit.isFailure(yield* Effect.exit(child.exitCode))).toBe(true);
      return O.none();
    }
    const request = yield* client
      .execute(HttpClientRequest.post(url).pipe(HttpClientRequest.bodyText(body, "application/json")))
      .pipe(
        Effect.flatMap((response) =>
          response.arrayBuffer.pipe(
            Effect.as({ status: response.status, receipt: response.headers["x-observation-receipt"] })
          )
        ),
        Effect.forkChild
      );
    if (mode === "serve") {
      const response = yield* Fiber.join(request);
      expect(response.status).toBe(200);
      expect(response.receipt).toMatch(/^[a-f0-9]{64}$/);
      yield* child.kill({ killSignal: "SIGKILL" });
      expect(Exit.isFailure(yield* Effect.exit(child.exitCode))).toBe(true);
      return O.none();
    }
    while (!(yield* fs.exists(marker))) {
      expect(yield* child.isRunning).toBe(true);
      yield* Effect.sleep("10 millis");
    }
    const evidence = yield* fs.readFileString(marker).pipe(Effect.flatMap(decodeJsonValue));
    expect(evidence).toEqual(
      mode === "before-commit"
        ? { boundary: mode, pages: [{ n: 1 }], events: [{ n: 1 }], receipts: [{ n: 0 }] }
        : { boundary: mode, stats: { pages: 1, frames: 1, payloadBytes: expect.any(Number) } }
    );
    expect(yield* Effect.sync(() => request.pollUnsafe())).toBeUndefined();
    yield* child.kill({ killSignal: "SIGKILL" });
    expect(Exit.isFailure(yield* Effect.exit(child.exitCode))).toBe(true);
    expect(Exit.isFailure(yield* request.pipe(Fiber.join, Effect.exit))).toBe(true);
    expect(yield* child.isRunning).toBe(false);
    return O.none();
  });
  return { start };
});
it.layer(NodeServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("rolls back native events and page when the HTTP worker is killed before receipt commit", () =>
    Effect.gen(function* () {
      const { start } = yield* scenario();
      yield* start("before-commit");
      expect(yield* start("inspect")).toMatchObject({
        _tag: "Some",
        value: {
          stats: { pages: 0, frames: 0, payloadBytes: 0 },
          events: [{ n: 0 }],
          receipts: [{ n: 0 }],
          pages: [],
        },
      });
      yield* start("serve");
      const accepted = yield* start("inspect");
      expect(accepted).toMatchObject({
        _tag: "Some",
        value: { stats: { pages: 1, frames: 1 }, events: [{ n: 1 }], receipts: [{ n: 1 }] },
      });
      yield* start("serve");
      expect(yield* start("inspect")).toEqual(accepted);
    }).pipe(Effect.timeout("20 seconds"))
  )
);
it.layer(NodeServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("replays the original durable receipt after commit but before the HTTP acknowledgment is sent", () =>
    Effect.gen(function* () {
      const { start } = yield* scenario();
      yield* start("after-commit");
      const accepted = yield* start("inspect");
      expect(accepted).toMatchObject({
        _tag: "Some",
        value: { stats: { pages: 1, frames: 1 }, events: [{ n: 1 }], receipts: [{ n: 1 }] },
      });
      yield* start("serve");
      expect(yield* start("inspect")).toEqual(accepted);
    }).pipe(Effect.timeout("20 seconds"))
  )
);

it.layer(NodeServices.layer, { timeout: "30 seconds", excludeTestServices: true })((it) =>
  it.effect("qualifies gzip, empty protobuf, expansion refusal and unfinished uploads on an actual Bun worker", () =>
    Effect.gen(function* () {
      const { start } = yield* scenario();
      yield* start("protocol");
      expect(yield* start("inspect")).toMatchObject({
        _tag: "Some",
        value: {
          stats: { pages: 1, frames: 1 },
          events: [{ n: 1 }],
          receipts: [{ n: 1 }],
        },
      });
    }).pipe(Effect.timeout("20 seconds"))
  )
);
