import { PosInt, URLStr } from "@beep/schema";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import {
  BEEP_TIKA_BASE_URL_ENV,
  BEEP_TIKA_MAX_OUTPUT_BYTES_ENV,
  BEEP_TIKA_TIMEOUT_MILLIS_ENV,
  makeTikaServerFileProcessingEngine,
  makeTikaServerFileProcessingEngineFromEnv,
  TIKA_SERVER_URL,
  TikaServerEngineConfig,
} from "@beep/tika";
import { A } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertTrue } from "@effect/vitest/utils";
import { ConfigProvider, Context, Deferred, Effect, Fiber, Layer, Option as O, pipe, Result } from "effect";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as TestClock from "effect/testing/TestClock";
import { fixtureText, makeExtractOperationFixture, tikaRmetaResponse, tikaVersionResponse } from "./fixtures.ts";
import type * as HttpClientRequest from "effect/http/HttpClientRequest";
import type { TikaFixtureFormat } from "./fixtures.ts";

const decodeTikaServerEngineConfigResult = S.decodeResult(TikaServerEngineConfig);

type Respond = (
  request: HttpClientRequest.HttpClientRequest
) => Effect.Effect<Response, HttpClientError.HttpClientError>;

const extractableFormats: ReadonlyArray<TikaFixtureFormat> = [
  "doc",
  "docx",
  "rtf",
  "html",
  "xhtml",
  "pdf-text-layer",
  "plain-text",
  "markdown",
];

const classifiedOnlyFormats: ReadonlyArray<TikaFixtureFormat> = ["docm", "xls", "xlsx"];

const jsonResponse = (body: string, status = 200): Response =>
  new Response(body, { headers: { "content-type": "application/json" }, status });

const transportFailure: Respond = (request) =>
  Effect.fail(
    new HttpClientError.HttpClientError({
      reason: new HttpClientError.TransportError({ description: "connection refused", request }),
    })
  );

const okVersion: Respond = () => Effect.succeed(new Response(tikaVersionResponse, { status: 200 }));

const rmetaFor =
  (format: TikaFixtureFormat, content?: string): Respond =>
  () =>
    Effect.succeed(jsonResponse(tikaRmetaResponse(format, content)));

const stub =
  (rmeta: Respond, version: Respond = okVersion): Respond =>
  (request) =>
    Str.endsWith("/version")(request.url) ? version(request) : rmeta(request);

class CapturedUrls extends Context.Service<CapturedUrls, Array<string>>()(
  "@beep/tika/test/Tika.server.test/CapturedUrls"
) {}

const capturing =
  (urls: Array<string>, respond: Respond): Respond =>
  (request) => {
    urls.push(request.url);
    return respond(request);
  };

// A tiny extracted text wrapped in oversized metadata: under the old
// text-only budget this passed, so it pins the metadata-bypass regression.
const metadataHeavyPayload = JSON.stringify([
  {
    "Content-Type": "text/plain",
    "dc:description": Str.repeat(4_000)("x"),
    "X-TIKA:content": "hi",
  },
]);

const testLayer = (respond: Respond) =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.map(respond(request), (response) => HttpClientResponse.fromWeb(request, response))
    )
  );

const CapturingTestLayer = Layer.unwrap(
  Effect.map(CapturedUrls, (urls) => testLayer(capturing(urls, stub(rmetaFor("plain-text")))))
).pipe(Layer.provideMerge(Layer.sync(CapturedUrls, () => [])));
class RequestStarted extends Context.Service<RequestStarted, Deferred.Deferred<void>>()(
  "@beep/tika/test/Tika.server.test/RequestStarted"
) {}
const SlowResponseTestLayer = Layer.unwrap(
  Effect.map(RequestStarted, (started) =>
    testLayer(
      stub(() =>
        Deferred.succeed(started, undefined).pipe(
          Effect.andThen(Effect.succeed(jsonResponse(tikaRmetaResponse("plain-text"))).pipe(Effect.delay("500 millis")))
        )
      )
    )
  )
).pipe(Layer.provideMerge(Layer.effect(RequestStarted, Deferred.make<void>())));

const encode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): Codec["Encoded"] =>
  Result.getOrThrow(S.encodeResult(schema)(value));

const decode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Encoded"]): Codec["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const expectRoundTrip = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): void => {
  const encoded = encode(schema, value);
  const decoded = decode(schema, encoded);

  expect(encode(schema, decoded)).toEqual(encoded);
  expect(S.toEquivalence(schema)(decoded, value)).toBe(true);
};

describe("TikaServerEngineConfig", () => {
  it("applies Tika Server schema defaults and keeps encoded shapes stable", () => {
    const config = decode(TikaServerEngineConfig, {});

    expect(config.baseUrl).toBe(TIKA_SERVER_URL);
    expect(config.timeoutMillis).toBe(PosInt.make(120_000));
    assertNone(config.maxOutputBytes);
    expect(encode(TikaServerEngineConfig, config)).toEqual({
      baseUrl: TIKA_SERVER_URL,
      timeoutMillis: 120_000,
    });
    expect(encode(TikaServerEngineConfig, decode(TikaServerEngineConfig, { maxOutputBytes: 4_096 }))).toEqual({
      baseUrl: TIKA_SERVER_URL,
      maxOutputBytes: 4_096,
      timeoutMillis: 120_000,
    });
  });

  it.prop(
    "round-trips schema-derived Tika Server config through encoded form",
    [TikaServerEngineConfig],
    ([config]) => {
      expectRoundTrip(TikaServerEngineConfig, config);
    },
    { arbitrary: fcRuns(25) }
  );

  it.prop(
    "generates valid Tika Server configs for the nightly regression seed",
    [TikaServerEngineConfig],
    ([config]) => {
      expectRoundTrip(TikaServerEngineConfig, config);
    },
    { arbitrary: { ...fcRuns(1_000), seed: 1_754_546_950 } }
  );

  it("strips trailing slashes from the base URL", () => {
    expect(decode(TikaServerEngineConfig, { baseUrl: "http://localhost:9998/" }).baseUrl).toBe(TIKA_SERVER_URL);
    expect(decode(TikaServerEngineConfig, { baseUrl: "http://localhost:9998///" }).baseUrl).toBe(TIKA_SERVER_URL);
    expect(decode(TikaServerEngineConfig, { baseUrl: "https://tika.internal/api/" }).baseUrl).toBe(
      "https://tika.internal/api"
    );
  });

  it("rejects a base URL carrying a query string or fragment", () => {
    const withQuery = decodeTikaServerEngineConfigResult({ baseUrl: "http://localhost:9998/?token=x" });
    const withFragment = decodeTikaServerEngineConfigResult({ baseUrl: "http://localhost:9998/#frag" });

    pipe(withQuery, Result.isFailure, assertTrue);
    pipe(withFragment, Result.isFailure, assertTrue);
    pipe(decodeTikaServerEngineConfigResult({ baseUrl: TIKA_SERVER_URL }), Result.isSuccess, assertTrue);
  });

  it("accepts http and https base URLs", () => {
    expect(decode(TikaServerEngineConfig, { baseUrl: "http://tika.internal:9998" }).baseUrl).toBe(
      "http://tika.internal:9998"
    );
    expect(decode(TikaServerEngineConfig, { baseUrl: "https://tika.internal/api" }).baseUrl).toBe(
      "https://tika.internal/api"
    );
  });

  it("rejects a non-normalized base URL passed straight to the constructor", () => {
    // `make` runs type-side checks but not decode transformations, so without
    // the trailing-slash check it would silently yield `//rmeta/text`.
    expect(() => TikaServerEngineConfig.make({ baseUrl: URLStr.make("http://localhost:9998/") })).toThrow();
    expect(() => TikaServerEngineConfig.make({ baseUrl: URLStr.make("http://localhost:9998///") })).toThrow();
  });

  it("accepts an already-normalized base URL through the constructor", () => {
    expect(TikaServerEngineConfig.make({ baseUrl: URLStr.make(TIKA_SERVER_URL) }).baseUrl).toBe(TIKA_SERVER_URL);
    expect(TikaServerEngineConfig.make({}).baseUrl).toBe(TIKA_SERVER_URL);
  });

  it("rejects base URLs that are not http or https", () => {
    // "A:/" is the counterexample the round-trip property surfaced: stripping
    // its trailing slash changed the URL's identity because it is opaque.
    for (const baseUrl of ["ftp://tika.internal", "file:///tmp/tika", "A:/"]) {
      pipe(decodeTikaServerEngineConfigResult({ baseUrl }), Result.isFailure, assertTrue);
    }
  });
});

describe("makeTikaServerFileProcessingEngine", () => {
  it.layer(testLayer(stub(rmetaFor("plain-text"))))("reports the engine name and the probed runtime version", (it) => {
    it.effect(
      "reports the engine name and the probed runtime version",
      Effect.fnUntraced(function* () {
        const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));

        expect(engine.descriptor.name).toBe("apache-tika");
        expect(engine.descriptor.engine).toBe("tika");
        expect(engine.descriptor.version).toBe(tikaVersionResponse);
      })
    );
  });

  it.layer(testLayer(stub(transportFailure, transportFailure)))(
    "constructs without a version and fails extraction as engine-unavailable when the server is down",
    (it) => {
      it.effect(
        "constructs without a version and fails extraction as engine-unavailable when the server is down",
        Effect.fnUntraced(function* () {
          const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));

          expect(engine.descriptor.version).toBeUndefined();

          const error = yield* engine.extract(yield* makeExtractOperationFixture("plain-text")).pipe(Effect.flip);

          expect(error._tag).toBe("FileProcessingOperationError");
          expect(error.reason).toBe("engine-unavailable");
        })
      );
    }
  );

  for (const format of extractableFormats) {
    it.layer(testLayer(stub(rmetaFor(format))))(`extracts text and metadata for ${format}`, (it) => {
      it.effect(
        `extracts text and metadata for ${format}`,
        Effect.fnUntraced(function* () {
          const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));
          const result = yield* engine.extract(yield* makeExtractOperationFixture(format));

          expect(result.engine).toBe("apache-tika");
          expect(result.format).toBe(format);
          expect(result.text).toBe(fixtureText(format));
          expect(result.metadata["dc:title"]).toBe(`${format} fixture`);
          expect(result.metadata["X-TIKA:Parsed-By"]).toContain("DefaultParser");
          expect(result.metadata["X-TIKA:content"]).toBeUndefined();
        })
      );
    });
  }

  it.layer(testLayer(stub(rmetaFor("image-metadata"))))("returns metadata only for image-metadata sources", (it) => {
    it.effect(
      "returns metadata only for image-metadata sources",
      Effect.fnUntraced(function* () {
        const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));
        const result = yield* engine.extract(yield* makeExtractOperationFixture("image-metadata"));

        expect(result.text).toBeUndefined();
        expect(result.metadata["Content-Type"]).toBe("image/png");
      })
    );
  });

  for (const format of classifiedOnlyFormats) {
    it.layer(testLayer(stub(rmetaFor(format))))(`classifies ${format} without extracting it`, (it) => {
      it.effect(
        `classifies ${format} without extracting it`,
        Effect.fnUntraced(function* () {
          const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));
          const error = yield* engine.extract(yield* makeExtractOperationFixture(format)).pipe(Effect.flip);

          expect(error._tag).toBe("FileProcessingOperationError");
          expect(error.reason).toBe("unsupported-file-format");
        })
      );
    });
  }

  it.layer(testLayer(stub(rmetaFor("plain-text"))))(
    "fails with file-extraction-failed when the source carries no readable content",
    (it) => {
      it.effect(
        "fails with file-extraction-failed when the source carries no readable content",
        Effect.fnUntraced(function* () {
          const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));
          const error = yield* engine
            .extract(yield* makeExtractOperationFixture("plain-text", { omitSourceContent: true }))
            .pipe(Effect.flip);

          expect(error._tag).toBe("FileProcessingOperationError");
          expect(error.reason).toBe("file-extraction-failed");
        })
      );
    }
  );
});

describe("makeTikaServerFileProcessingEngine output budgets", () => {
  it.layer(testLayer(stub(rmetaFor("plain-text"))))(
    "fails with output-limit-exceeded when the driver budget is exceeded",
    (it) => {
      it.effect(
        "fails with output-limit-exceeded when the driver budget is exceeded",
        Effect.fnUntraced(function* () {
          const engine = yield* makeTikaServerFileProcessingEngine(
            TikaServerEngineConfig.make({ maxOutputBytes: O.some(PosInt.make(4)) })
          );
          const error = yield* engine.extract(yield* makeExtractOperationFixture("plain-text")).pipe(Effect.flip);

          expect(error._tag).toBe("FileProcessingOperationError");
          expect(error.reason).toBe("output-limit-exceeded");
        })
      );
    }
  );

  it.layer(testLayer(stub(rmetaFor("plain-text"))))(
    "lets a tighter per-operation budget win over the driver budget",
    (it) => {
      it.effect(
        "lets a tighter per-operation budget win over the driver budget",
        Effect.fnUntraced(function* () {
          const engine = yield* makeTikaServerFileProcessingEngine(
            TikaServerEngineConfig.make({ maxOutputBytes: O.some(PosInt.make(4_096)) })
          );
          const error = yield* engine
            .extract(yield* makeExtractOperationFixture("plain-text", { maxMaterializedBytes: 4 }))
            .pipe(Effect.flip);

          expect(error.reason).toBe("output-limit-exceeded");
        })
      );
    }
  );

  it.layer(testLayer(stub(rmetaFor("plain-text"))))(
    "lets a tighter driver budget win over the per-operation budget",
    (it) => {
      it.effect(
        "lets a tighter driver budget win over the per-operation budget",
        Effect.fnUntraced(function* () {
          const engine = yield* makeTikaServerFileProcessingEngine(
            TikaServerEngineConfig.make({ maxOutputBytes: O.some(PosInt.make(4)) })
          );
          const error = yield* engine
            .extract(yield* makeExtractOperationFixture("plain-text", { maxMaterializedBytes: 4_096 }))
            .pipe(Effect.flip);

          expect(error.reason).toBe("output-limit-exceeded");
        })
      );
    }
  );

  it.layer(testLayer(stub(rmetaFor("plain-text"))))("extracts normally when both budgets leave room", (it) => {
    it.effect(
      "extracts normally when both budgets leave room",
      Effect.fnUntraced(function* () {
        const engine = yield* makeTikaServerFileProcessingEngine(
          TikaServerEngineConfig.make({ maxOutputBytes: O.some(PosInt.make(4_096)) })
        );
        const result = yield* engine.extract(
          yield* makeExtractOperationFixture("plain-text", { maxMaterializedBytes: 4_096 })
        );

        expect(result.text).toBe(fixtureText("plain-text"));
      })
    );
  });

  it.layer(testLayer(stub(() => Effect.succeed(jsonResponse(metadataHeavyPayload)))))(
    "counts response metadata against the budget, not just extracted text",
    (it) => {
      it.effect(
        "counts response metadata against the budget, not just extracted text",
        Effect.fnUntraced(function* () {
          const engine = yield* makeTikaServerFileProcessingEngine(
            TikaServerEngineConfig.make({ maxOutputBytes: O.some(PosInt.make(1_024)) })
          );
          const error = yield* engine.extract(yield* makeExtractOperationFixture("plain-text")).pipe(Effect.flip);

          expect(error._tag).toBe("FileProcessingOperationError");
          expect(error.reason).toBe("output-limit-exceeded");
        })
      );
    }
  );

  it.layer(testLayer(stub(() => Effect.succeed(jsonResponse(Str.repeat(4_000)("x"))))))(
    "enforces the budget before parsing the response body",
    (it) => {
      it.effect(
        "enforces the budget before parsing the response body",
        Effect.fnUntraced(function* () {
          const engine = yield* makeTikaServerFileProcessingEngine(
            TikaServerEngineConfig.make({ maxOutputBytes: O.some(PosInt.make(64)) })
          );
          const error = yield* engine.extract(yield* makeExtractOperationFixture("plain-text")).pipe(Effect.flip);

          // The body is oversized AND unparseable; the budget must win, which
          // only happens if the check runs before JSON decoding.
          expect(error.reason).toBe("output-limit-exceeded");
        })
      );
    }
  );
});

describe("makeTikaServerFileProcessingEngine request shape", () => {
  it.layer(CapturingTestLayer)("targets exactly <baseUrl>/rmeta/text when the base URL has a trailing slash", (it) => {
    it.effect(
      "targets exactly <baseUrl>/rmeta/text when the base URL has a trailing slash",
      Effect.fnUntraced(function* () {
        const capturedUrls = yield* CapturedUrls;
        const engine = yield* makeTikaServerFileProcessingEngine(
          decode(TikaServerEngineConfig, { baseUrl: "http://localhost:9998/" })
        );
        yield* engine.extract(yield* makeExtractOperationFixture("plain-text"));

        expect(capturedUrls).toContain(`${TIKA_SERVER_URL}/version`);
        expect(capturedUrls).toContain(`${TIKA_SERVER_URL}/rmeta/text`);
        expect(A.some(capturedUrls, Str.includes("//rmeta"))).toBe(false);
      })
    );
  });
});

describe("makeTikaServerFileProcessingEngine error boundary", () => {
  it.layer(testLayer(stub(() => Effect.succeed(jsonResponse("", 415)))))(
    "maps a 415 response to unsupported-file-format",
    (it) => {
      it.effect(
        "maps a 415 response to unsupported-file-format",
        Effect.fnUntraced(function* () {
          const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));
          const error = yield* engine.extract(yield* makeExtractOperationFixture("plain-text")).pipe(Effect.flip);

          expect(error._tag).toBe("FileProcessingOperationError");
          expect(error.reason).toBe("unsupported-file-format");
        })
      );
    }
  );

  it.layer(testLayer(stub(() => Effect.succeed(jsonResponse("boom", 500)))))(
    "maps a 500 response to file-extraction-failed",
    (it) => {
      it.effect(
        "maps a 500 response to file-extraction-failed",
        Effect.fnUntraced(function* () {
          const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));
          const error = yield* engine.extract(yield* makeExtractOperationFixture("plain-text")).pipe(Effect.flip);

          expect(error._tag).toBe("FileProcessingOperationError");
          expect(error.reason).toBe("file-extraction-failed");
        })
      );
    }
  );

  it.layer(testLayer(stub(() => Effect.succeed(jsonResponse("unparseable", 422)))))(
    "maps a 422 response to file-extraction-failed",
    (it) => {
      it.effect(
        "maps a 422 response to file-extraction-failed",
        Effect.fnUntraced(function* () {
          const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));
          const error = yield* engine.extract(yield* makeExtractOperationFixture("plain-text")).pipe(Effect.flip);

          expect(error.reason).toBe("file-extraction-failed");
        })
      );
    }
  );

  it.layer(testLayer(stub(transportFailure)))("maps a transport failure to engine-unavailable", (it) => {
    it.effect(
      "maps a transport failure to engine-unavailable",
      Effect.fnUntraced(function* () {
        const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));
        const error = yield* engine.extract(yield* makeExtractOperationFixture("plain-text")).pipe(Effect.flip);

        expect(error._tag).toBe("FileProcessingOperationError");
        expect(error.reason).toBe("engine-unavailable");
      })
    );
  });

  it.layer(testLayer(stub(() => Effect.succeed(jsonResponse("{not json at all")))))(
    "maps an undecodable response body to file-extraction-failed",
    (it) => {
      it.effect(
        "maps an undecodable response body to file-extraction-failed",
        Effect.fnUntraced(function* () {
          const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));
          const error = yield* engine.extract(yield* makeExtractOperationFixture("plain-text")).pipe(Effect.flip);

          expect(error.reason).toBe("file-extraction-failed");
        })
      );
    }
  );

  it.layer(testLayer(stub(() => Effect.succeed(jsonResponse("[]")))))(
    "maps an empty rmeta array to file-extraction-failed",
    (it) => {
      it.effect(
        "maps an empty rmeta array to file-extraction-failed",
        Effect.fnUntraced(function* () {
          const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));
          const error = yield* engine.extract(yield* makeExtractOperationFixture("plain-text")).pipe(Effect.flip);

          expect(error.reason).toBe("file-extraction-failed");
        })
      );
    }
  );

  it.layer(SlowResponseTestLayer)("maps a slow Tika Server to operation-timed-out", (it) => {
    it.effect(
      "maps a slow Tika Server to operation-timed-out",
      Effect.fnUntraced(function* () {
        const engine = yield* makeTikaServerFileProcessingEngine(
          TikaServerEngineConfig.make({ timeoutMillis: PosInt.make(5) })
        );
        const operation = yield* makeExtractOperationFixture("plain-text");
        const request = yield* engine.extract(operation).pipe(Effect.flip, Effect.forkChild);
        yield* Deferred.await(yield* RequestStarted);
        // TestClock waits for supervised fibers to suspend before advancing, so both
        // the response delay and the unchanged operation deadline are armed.
        yield* TestClock.adjust("5 millis");
        const error = yield* Fiber.join(request);

        expect(error._tag).toBe("FileProcessingOperationError");
        expect(error.reason).toBe("operation-timed-out");
      })
    );
  });
});

describe("makeTikaServerFileProcessingEngineFromEnv", () => {
  it.layer(testLayer(stub(rmetaFor("plain-text"))))(
    "resolves BEEP_TIKA_* configuration through the Config provider",
    (it) => {
      it.effect(
        "resolves BEEP_TIKA_* configuration through the Config provider",
        Effect.fnUntraced(function* () {
          const engine = yield* makeTikaServerFileProcessingEngineFromEnv().pipe(
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromUnknown({
                [BEEP_TIKA_BASE_URL_ENV]: TIKA_SERVER_URL,
                [BEEP_TIKA_MAX_OUTPUT_BYTES_ENV]: "4",
                [BEEP_TIKA_TIMEOUT_MILLIS_ENV]: "30000",
              })
            )
          );

          expect(engine.descriptor.version).toBe(tikaVersionResponse);

          const error = yield* engine.extract(yield* makeExtractOperationFixture("plain-text")).pipe(Effect.flip);

          expect(error.reason).toBe("output-limit-exceeded");
        })
      );
    }
  );

  it.layer(testLayer(stub(rmetaFor("plain-text"))))(
    "fails as engine-unavailable when BEEP_TIKA_* values are undecodable",
    (it) => {
      it.effect(
        "fails as engine-unavailable when BEEP_TIKA_* values are undecodable",
        Effect.fnUntraced(function* () {
          const error = yield* makeTikaServerFileProcessingEngineFromEnv().pipe(
            Effect.provideService(
              ConfigProvider.ConfigProvider,
              ConfigProvider.fromUnknown({ [BEEP_TIKA_TIMEOUT_MILLIS_ENV]: "not-a-number" })
            ),
            Effect.flip
          );

          expect(error._tag).toBe("TikaError");
          expect(error.reason).toBe("config");
        })
      );
    }
  );
});
