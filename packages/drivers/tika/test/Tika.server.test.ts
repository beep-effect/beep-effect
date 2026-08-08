import { PosInt, URLStr } from "@beep/schema";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
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
import { NodeServices } from "@effect/platform-node";
import { describe, expect, it } from "@effect/vitest";
import { ConfigProvider, Effect, Layer, Option as O, Result } from "effect";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc } from "effect/testing";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientError from "effect/unstable/http/HttpClientError";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import { fixtureText, makeExtractOperationFixture, tikaRmetaResponse, tikaVersionResponse } from "./fixtures.ts";
import type * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import type { TikaFixtureFormat } from "./fixtures.ts";

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

const capturedUrls: Array<string> = [];

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
  Layer.merge(
    Layer.succeed(
      HttpClient.HttpClient,
      HttpClient.make((request) =>
        Effect.map(respond(request), (response) => HttpClientResponse.fromWeb(request, response))
      )
    ),
    NodeServices.layer
  );

const provideStub = (respond: Respond) => provideScopedLayer(testLayer(respond));

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
    expect(O.isNone(config.maxOutputBytes)).toBe(true);
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

  it("round-trips schema-derived Tika Server config through encoded form", () =>
    fc.assert(
      fc.property(S.toArbitrary(TikaServerEngineConfig), (config) => {
        expectRoundTrip(TikaServerEngineConfig, config);
      }),
      fcRuns(25)
    ));

  it("strips trailing slashes from the base URL", () => {
    expect(decode(TikaServerEngineConfig, { baseUrl: "http://localhost:9998/" }).baseUrl).toBe(TIKA_SERVER_URL);
    expect(decode(TikaServerEngineConfig, { baseUrl: "http://localhost:9998///" }).baseUrl).toBe(TIKA_SERVER_URL);
    expect(decode(TikaServerEngineConfig, { baseUrl: "https://tika.internal/api/" }).baseUrl).toBe(
      "https://tika.internal/api"
    );
  });

  it("rejects a base URL carrying a query string or fragment", () => {
    const withQuery = S.decodeResult(TikaServerEngineConfig)({ baseUrl: "http://localhost:9998/?token=x" });
    const withFragment = S.decodeResult(TikaServerEngineConfig)({ baseUrl: "http://localhost:9998/#frag" });

    expect(Result.isFailure(withQuery)).toBe(true);
    expect(Result.isFailure(withFragment)).toBe(true);
    expect(Result.isSuccess(S.decodeResult(TikaServerEngineConfig)({ baseUrl: TIKA_SERVER_URL }))).toBe(true);
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
      expect(Result.isFailure(S.decodeResult(TikaServerEngineConfig)({ baseUrl }))).toBe(true);
    }
  });
});

describe("makeTikaServerFileProcessingEngine", () => {
  it.effect(
    "reports the engine name and the probed runtime version",
    Effect.fnUntraced(
      function* () {
        const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));

        expect(engine.descriptor.name).toBe("apache-tika");
        expect(engine.descriptor.engine).toBe("tika");
        expect(engine.descriptor.version).toBe(tikaVersionResponse);
      },
      Effect.scoped,
      provideStub(stub(rmetaFor("plain-text")))
    )
  );

  it.effect(
    "constructs without a version and fails extraction as engine-unavailable when the server is down",
    Effect.fnUntraced(
      function* () {
        const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));

        expect(engine.descriptor.version).toBeUndefined();

        const error = yield* engine.extract(yield* makeExtractOperationFixture("plain-text")).pipe(Effect.flip);

        expect(error._tag).toBe("FileProcessingOperationError");
        expect(error.reason).toBe("engine-unavailable");
      },
      Effect.scoped,
      provideStub(stub(transportFailure, transportFailure))
    )
  );

  for (const format of extractableFormats) {
    it.effect(
      `extracts text and metadata for ${format}`,
      Effect.fnUntraced(
        function* () {
          const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));
          const result = yield* engine.extract(yield* makeExtractOperationFixture(format));

          expect(result.engine).toBe("apache-tika");
          expect(result.format).toBe(format);
          expect(result.text).toBe(fixtureText(format));
          expect(result.metadata["dc:title"]).toBe(`${format} fixture`);
          expect(result.metadata["X-TIKA:Parsed-By"]).toContain("DefaultParser");
          expect(result.metadata["X-TIKA:content"]).toBeUndefined();
        },
        Effect.scoped,
        provideStub(stub(rmetaFor(format)))
      )
    );
  }

  it.effect(
    "returns metadata only for image-metadata sources",
    Effect.fnUntraced(
      function* () {
        const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));
        const result = yield* engine.extract(yield* makeExtractOperationFixture("image-metadata"));

        expect(result.text).toBeUndefined();
        expect(result.metadata["Content-Type"]).toBe("image/png");
      },
      Effect.scoped,
      provideStub(stub(rmetaFor("image-metadata")))
    )
  );

  for (const format of classifiedOnlyFormats) {
    it.effect(
      `classifies ${format} without extracting it`,
      Effect.fnUntraced(
        function* () {
          const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));
          const error = yield* engine.extract(yield* makeExtractOperationFixture(format)).pipe(Effect.flip);

          expect(error._tag).toBe("FileProcessingOperationError");
          expect(error.reason).toBe("unsupported-file-format");
        },
        Effect.scoped,
        provideStub(stub(rmetaFor(format)))
      )
    );
  }

  it.effect(
    "fails with file-extraction-failed when the source carries no readable content",
    Effect.fnUntraced(
      function* () {
        const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));
        const error = yield* engine
          .extract(yield* makeExtractOperationFixture("plain-text", { omitSourceContent: true }))
          .pipe(Effect.flip);

        expect(error._tag).toBe("FileProcessingOperationError");
        expect(error.reason).toBe("file-extraction-failed");
      },
      Effect.scoped,
      provideStub(stub(rmetaFor("plain-text")))
    )
  );
});

describe("makeTikaServerFileProcessingEngine output budgets", () => {
  it.effect(
    "fails with output-limit-exceeded when the driver budget is exceeded",
    Effect.fnUntraced(
      function* () {
        const engine = yield* makeTikaServerFileProcessingEngine(
          TikaServerEngineConfig.make({ maxOutputBytes: O.some(PosInt.make(4)) })
        );
        const error = yield* engine.extract(yield* makeExtractOperationFixture("plain-text")).pipe(Effect.flip);

        expect(error._tag).toBe("FileProcessingOperationError");
        expect(error.reason).toBe("output-limit-exceeded");
      },
      Effect.scoped,
      provideStub(stub(rmetaFor("plain-text")))
    )
  );

  it.effect(
    "lets a tighter per-operation budget win over the driver budget",
    Effect.fnUntraced(
      function* () {
        const engine = yield* makeTikaServerFileProcessingEngine(
          TikaServerEngineConfig.make({ maxOutputBytes: O.some(PosInt.make(4_096)) })
        );
        const error = yield* engine
          .extract(yield* makeExtractOperationFixture("plain-text", { maxMaterializedBytes: 4 }))
          .pipe(Effect.flip);

        expect(error.reason).toBe("output-limit-exceeded");
      },
      Effect.scoped,
      provideStub(stub(rmetaFor("plain-text")))
    )
  );

  it.effect(
    "lets a tighter driver budget win over the per-operation budget",
    Effect.fnUntraced(
      function* () {
        const engine = yield* makeTikaServerFileProcessingEngine(
          TikaServerEngineConfig.make({ maxOutputBytes: O.some(PosInt.make(4)) })
        );
        const error = yield* engine
          .extract(yield* makeExtractOperationFixture("plain-text", { maxMaterializedBytes: 4_096 }))
          .pipe(Effect.flip);

        expect(error.reason).toBe("output-limit-exceeded");
      },
      Effect.scoped,
      provideStub(stub(rmetaFor("plain-text")))
    )
  );

  it.effect(
    "extracts normally when both budgets leave room",
    Effect.fnUntraced(
      function* () {
        const engine = yield* makeTikaServerFileProcessingEngine(
          TikaServerEngineConfig.make({ maxOutputBytes: O.some(PosInt.make(4_096)) })
        );
        const result = yield* engine.extract(
          yield* makeExtractOperationFixture("plain-text", { maxMaterializedBytes: 4_096 })
        );

        expect(result.text).toBe(fixtureText("plain-text"));
      },
      Effect.scoped,
      provideStub(stub(rmetaFor("plain-text")))
    )
  );

  it.effect(
    "counts response metadata against the budget, not just extracted text",
    Effect.fnUntraced(
      function* () {
        const engine = yield* makeTikaServerFileProcessingEngine(
          TikaServerEngineConfig.make({ maxOutputBytes: O.some(PosInt.make(1_024)) })
        );
        const error = yield* engine.extract(yield* makeExtractOperationFixture("plain-text")).pipe(Effect.flip);

        expect(error._tag).toBe("FileProcessingOperationError");
        expect(error.reason).toBe("output-limit-exceeded");
      },
      Effect.scoped,
      provideStub(stub(() => Effect.succeed(jsonResponse(metadataHeavyPayload))))
    )
  );

  it.effect(
    "enforces the budget before parsing the response body",
    Effect.fnUntraced(
      function* () {
        const engine = yield* makeTikaServerFileProcessingEngine(
          TikaServerEngineConfig.make({ maxOutputBytes: O.some(PosInt.make(64)) })
        );
        const error = yield* engine.extract(yield* makeExtractOperationFixture("plain-text")).pipe(Effect.flip);

        // The body is oversized AND unparseable; the budget must win, which
        // only happens if the check runs before JSON decoding.
        expect(error.reason).toBe("output-limit-exceeded");
      },
      Effect.scoped,
      provideStub(stub(() => Effect.succeed(jsonResponse(Str.repeat(4_000)("x")))))
    )
  );
});

describe("makeTikaServerFileProcessingEngine request shape", () => {
  it.effect(
    "targets exactly <baseUrl>/rmeta/text when the base URL has a trailing slash",
    Effect.fnUntraced(
      function* () {
        const engine = yield* makeTikaServerFileProcessingEngine(
          decode(TikaServerEngineConfig, { baseUrl: "http://localhost:9998/" })
        );
        yield* engine.extract(yield* makeExtractOperationFixture("plain-text"));

        expect(capturedUrls).toContain(`${TIKA_SERVER_URL}/version`);
        expect(capturedUrls).toContain(`${TIKA_SERVER_URL}/rmeta/text`);
        expect(A.some(capturedUrls, Str.includes("//rmeta"))).toBe(false);
      },
      Effect.scoped,
      provideStub(capturing(capturedUrls, stub(rmetaFor("plain-text"))))
    )
  );
});

describe("makeTikaServerFileProcessingEngine error boundary", () => {
  it.effect(
    "maps a 415 response to unsupported-file-format",
    Effect.fnUntraced(
      function* () {
        const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));
        const error = yield* engine.extract(yield* makeExtractOperationFixture("plain-text")).pipe(Effect.flip);

        expect(error._tag).toBe("FileProcessingOperationError");
        expect(error.reason).toBe("unsupported-file-format");
      },
      Effect.scoped,
      provideStub(stub(() => Effect.succeed(jsonResponse("", 415))))
    )
  );

  it.effect(
    "maps a 500 response to file-extraction-failed",
    Effect.fnUntraced(
      function* () {
        const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));
        const error = yield* engine.extract(yield* makeExtractOperationFixture("plain-text")).pipe(Effect.flip);

        expect(error._tag).toBe("FileProcessingOperationError");
        expect(error.reason).toBe("file-extraction-failed");
      },
      Effect.scoped,
      provideStub(stub(() => Effect.succeed(jsonResponse("boom", 500))))
    )
  );

  it.effect(
    "maps a 422 response to file-extraction-failed",
    Effect.fnUntraced(
      function* () {
        const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));
        const error = yield* engine.extract(yield* makeExtractOperationFixture("plain-text")).pipe(Effect.flip);

        expect(error.reason).toBe("file-extraction-failed");
      },
      Effect.scoped,
      provideStub(stub(() => Effect.succeed(jsonResponse("unparseable", 422))))
    )
  );

  it.effect(
    "maps a transport failure to engine-unavailable",
    Effect.fnUntraced(
      function* () {
        const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));
        const error = yield* engine.extract(yield* makeExtractOperationFixture("plain-text")).pipe(Effect.flip);

        expect(error._tag).toBe("FileProcessingOperationError");
        expect(error.reason).toBe("engine-unavailable");
      },
      Effect.scoped,
      provideStub(stub(transportFailure))
    )
  );

  it.effect(
    "maps an undecodable response body to file-extraction-failed",
    Effect.fnUntraced(
      function* () {
        const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));
        const error = yield* engine.extract(yield* makeExtractOperationFixture("plain-text")).pipe(Effect.flip);

        expect(error.reason).toBe("file-extraction-failed");
      },
      Effect.scoped,
      provideStub(stub(() => Effect.succeed(jsonResponse("{not json at all"))))
    )
  );

  it.effect(
    "maps an empty rmeta array to file-extraction-failed",
    Effect.fnUntraced(
      function* () {
        const engine = yield* makeTikaServerFileProcessingEngine(TikaServerEngineConfig.make({}));
        const error = yield* engine.extract(yield* makeExtractOperationFixture("plain-text")).pipe(Effect.flip);

        expect(error.reason).toBe("file-extraction-failed");
      },
      Effect.scoped,
      provideStub(stub(() => Effect.succeed(jsonResponse("[]"))))
    )
  );

  it.live(
    "maps a slow Tika Server to operation-timed-out",
    Effect.fnUntraced(
      function* () {
        const engine = yield* makeTikaServerFileProcessingEngine(
          TikaServerEngineConfig.make({ timeoutMillis: PosInt.make(5) })
        );
        const error = yield* engine.extract(yield* makeExtractOperationFixture("plain-text")).pipe(Effect.flip);

        expect(error._tag).toBe("FileProcessingOperationError");
        expect(error.reason).toBe("operation-timed-out");
      },
      Effect.scoped,
      provideStub(
        stub(() => Effect.succeed(jsonResponse(tikaRmetaResponse("plain-text"))).pipe(Effect.delay("500 millis")))
      )
    )
  );
});

describe("makeTikaServerFileProcessingEngineFromEnv", () => {
  it.effect(
    "resolves BEEP_TIKA_* configuration through the Config provider",
    Effect.fnUntraced(
      function* () {
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
      },
      Effect.scoped,
      provideStub(stub(rmetaFor("plain-text")))
    )
  );

  it.effect(
    "fails as engine-unavailable when BEEP_TIKA_* values are undecodable",
    Effect.fnUntraced(
      function* () {
        const error = yield* makeTikaServerFileProcessingEngineFromEnv().pipe(
          Effect.provideService(
            ConfigProvider.ConfigProvider,
            ConfigProvider.fromUnknown({ [BEEP_TIKA_TIMEOUT_MILLIS_ENV]: "not-a-number" })
          ),
          Effect.flip
        );

        expect(error._tag).toBe("TikaError");
        expect(error.reason).toBe("config");
      },
      Effect.scoped,
      provideStub(stub(rmetaFor("plain-text")))
    )
  );
});
