import { NonEmptyTrimmedStr, NonNegativeInt } from "@beep/schema";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import {
  makeUsptoError,
  normalizeUsptoApplicationNumber,
  normalizeUsptoPatentNumber,
  Uspto,
  UsptoApplicationMetadata,
  UsptoApplicationNumber,
  UsptoConfigInput,
  UsptoContinuity,
  UsptoDocumentReference,
  UsptoError,
  UsptoErrorReason,
  UsptoPatentNumber,
} from "@beep/uspto";
import { thunkTrue } from "@beep/utils";
import { describe, expect } from "@effect/vitest";
import { assertFailure, assertNone, assertSome } from "@effect/vitest/utils";
import { Effect, Layer, Redacted, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const decodeUsptoConfigInputResult = S.decodeResult(UsptoConfigInput);

const applicationEnvelope = JSON.stringify({
  count: 1,
  patentFileWrapperDataBag: [
    {
      applicationMetaData: {
        applicationStatusDescriptionText: "Patented Case",
        filingDate: "2018-09-21",
        firstApplicantName: "Precision Widgets LLC",
        firstInventorName: "Ada Lovelace",
        grantDate: "2020-09-15",
        inventionTitle: "Adjustable widget assembly",
        patentNumber: "10772255",
      },
      applicationNumberText: "16138242",
    },
  ],
});

const continuityEnvelope = JSON.stringify({
  patentFileWrapperDataBag: [
    {
      childContinuityBag: [{ childApplicationNumberText: "17999999" }],
      parentContinuityBag: [{ parentApplicationNumberText: "15111111" }],
    },
  ],
});

const documentsEnvelope = JSON.stringify({
  documentBag: [
    {
      documentCode: "SPEC",
      documentCodeDescriptionText: "Specification",
      documentIdentifier: "DOC123",
      downloadOptionBag: [{ downloadUrl: "https://api.uspto.gov/docs/DOC123.pdf", mimeTypeIdentifier: "PDF" }],
      officialDate: "2018-09-21",
    },
    { documentCode: "IDS" },
  ],
});

const respondWith = (body: string, status = 200, seenUrls?: Array<string>): Layer.Layer<HttpClient.HttpClient> =>
  Layer.succeed(
    HttpClient.HttpClient,
    HttpClient.make((request) =>
      Effect.sync(() => {
        seenUrls?.push(request.url);
        return HttpClientResponse.fromWeb(
          request,
          new Response(body, { headers: { "content-type": "application/json" }, status })
        );
      })
    )
  );

const usptoLayer = (http: Layer.Layer<HttpClient.HttpClient>): Layer.Layer<Uspto> =>
  Uspto.makeLayer(UsptoConfigInput.make({ apiKey: Redacted.make("test-key") })).pipe(Layer.provide(http));

const ApplicationNumberArbitrary = Arbitrary.schema(UsptoApplicationNumber);
const PatentNumberArbitrary = Arbitrary.schema(UsptoPatentNumber);
const ConfigInputArbitrary = Arbitrary.schema(UsptoConfigInput);
const ApplicationMetadataArbitrary = Arbitrary.schema(UsptoApplicationMetadata);
const ContinuityArbitrary = Arbitrary.schema(UsptoContinuity);
const DocumentReferenceArbitrary = Arbitrary.schema(UsptoDocumentReference);
const ErrorReasonArbitrary = Arbitrary.schema(UsptoErrorReason);
const ErrorArbitrary = Arbitrary.schema(UsptoError);

const encode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): Codec["Encoded"] =>
  Result.getOrThrow(S.encodeResult(schema)(value));

const decode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Encoded"]): Codec["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const expectEncodedRoundTrip = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): void => {
  const encoded = encode(schema, value);
  const decoded = decode(schema, encoded);

  expect(encode(schema, decoded)).toEqual(encoded);
  expect(S.toEquivalence(schema)(decoded, value)).toBe(true);
};

describe("Uspto service", () => {
  {
    const requestedUrls: Array<string> = [];
    it.layer(usptoLayer(respondWith(applicationEnvelope, 200, requestedUrls)), { timeout: "5 seconds" })((it) => {
      it.effect(
        "resolves application metadata from a file wrapper envelope",
        Effect.fnUntraced(function* () {
          const uspto = yield* Uspto;
          const metadata = yield* uspto.getApplication("16138242");

          expect(metadata.applicationNumberText).toBe("16138242");
          assertSome(metadata.inventionTitle, NonEmptyTrimmedStr.make("Adjustable widget assembly"));
          assertSome(metadata.patentNumber, NonEmptyTrimmedStr.make("10772255"));
          assertSome(metadata.firstApplicantName, NonEmptyTrimmedStr.make("Precision Widgets LLC"));
          expect(requestedUrls).toStrictEqual(["https://api.uspto.gov/api/v1/patent/applications/16138242"]);
        })
      );
    });
  }

  {
    const seenUrls: Array<string> = [];
    it.layer(usptoLayer(respondWith(applicationEnvelope, 200, seenUrls)), { timeout: "5 seconds" })((it) => {
      it.effect(
        "sends the application request to the open data portal path",
        Effect.fnUntraced(function* () {
          yield* Uspto.pipe(Effect.flatMap((uspto) => uspto.getApplication("16138242")));
          expect(seenUrls).toStrictEqual(["https://api.uspto.gov/api/v1/patent/applications/16138242"]);
        })
      );
    });
  }

  it.layer(usptoLayer(respondWith("{}", 404)), { timeout: "5 seconds" })((it) => {
    it.effect(
      "maps 404 responses to not-found",
      Effect.fnUntraced(function* () {
        const uspto = yield* Uspto;
        const error = yield* uspto.getApplication("99999999").pipe(Effect.flip);
        expect(error.reason).toBe("not-found");
      })
    );
  });

  it.layer(usptoLayer(respondWith("{}", 429)), { timeout: "5 seconds" })((it) => {
    it.effect(
      "maps 429 responses to rate-limited",
      Effect.fnUntraced(function* () {
        const uspto = yield* Uspto;
        const error = yield* uspto.getApplication("16138242").pipe(Effect.flip);
        expect(error.reason).toBe("rate-limited");
      })
    );
  });

  it.layer(usptoLayer(respondWith(continuityEnvelope)), { timeout: "5 seconds" })((it) => {
    it.effect(
      "extracts continuity parents and children",
      Effect.fnUntraced(function* () {
        const uspto = yield* Uspto;
        const continuity = yield* uspto.getContinuity("16138242");
        expect(continuity.parentApplicationNumbers).toStrictEqual(["15111111"]);
        expect(continuity.childApplicationNumbers).toStrictEqual(["17999999"]);
      })
    );
  });

  it.layer(usptoLayer(respondWith(documentsEnvelope)), { timeout: "5 seconds" })((it) => {
    it.effect(
      "extracts document references with download urls and skips id-less rows",
      Effect.fnUntraced(function* () {
        const uspto = yield* Uspto;
        const documents = yield* uspto.getDocuments("16138242");
        expect(documents).toHaveLength(1);
        expect(documents[0]?.documentIdentifier).toBe("DOC123");
        expect(documents[0]?.downloadUrl).toBe("https://api.uspto.gov/docs/DOC123.pdf");
      })
    );
  });

  it.layer(usptoLayer(respondWith(applicationEnvelope)), { timeout: "5 seconds" })((it) => {
    it.effect(
      "searches applications and projects each wrapper",
      Effect.fnUntraced(function* () {
        const uspto = yield* Uspto;
        const results = yield* uspto.searchApplications('applicationMetaData.patentNumber:"10772255"');
        expect(results).toHaveLength(1);
        assertSome(
          O.flatMap(O.fromUndefinedOr(results[0]), (result) => result.patentNumber),
          NonEmptyTrimmedStr.make("10772255")
        );
      })
    );
  });
});

describe("Uspto identifier normalization", () => {
  it("constructs errors in data-last form", () => {
    const error = makeUsptoError({ cause: "socket hang up" })("transport");

    expect(error.reason).toBe("transport");
    assertSome(error.cause, "socket hang up");
  });

  it("normalizes application numbers", () => {
    assertSome(normalizeUsptoApplicationNumber("16/138,242"), "16138242");
    assertSome(normalizeUsptoApplicationNumber("16-138-242"), "16138242");
    assertNone(normalizeUsptoApplicationNumber("12345"));
    assertNone(normalizeUsptoApplicationNumber("not a number"));
  });

  it("normalizes patent numbers", () => {
    assertSome(normalizeUsptoPatentNumber("US 10,772,255 B2"), "10772255");
    assertSome(normalizeUsptoPatentNumber("10772255"), "10772255");
    assertSome(normalizeUsptoPatentNumber("RE46,604"), "RE46604");
    assertNone(normalizeUsptoPatentNumber("ABC"));
  });
});

describe("Uspto schema parity", () => {
  it("keeps encoded schema wire shapes byte-identical", () => {
    const config = Result.getOrThrow(
      decodeUsptoConfigInputResult({ apiKey: "test-key", apiUrl: "https://api.uspto.gov///" })
    );
    const metadata = decode(UsptoApplicationMetadata, {
      applicationNumberText: "16138242",
      firstApplicantName: "Precision Widgets LLC",
      inventionTitle: "Adjustable widget assembly",
      patentNumber: "10772255",
    });
    const continuity = UsptoContinuity.make({
      childApplicationNumbers: [UsptoApplicationNumber.make("17999999")],
      parentApplicationNumbers: [UsptoApplicationNumber.make("15111111")],
    });
    const document = UsptoDocumentReference.make({
      documentCode: "SPEC",
      documentCodeDescriptionText: "Specification",
      documentIdentifier: "DOC123",
      downloadUrl: "https://api.uspto.gov/docs/DOC123.pdf",
      officialDate: "2018-09-21",
    });
    const fullError = UsptoError.fromReason("response-status", {
      cause: "bad status",
      status: NonNegativeInt.make(429),
    });
    const minimalError = UsptoError.fromReason("transport");

    expect(config.apiUrl).toBe("https://api.uspto.gov");
    expect(encode(UsptoConfigInput, config)).toEqual({
      apiKey: "test-key",
      apiUrl: "https://api.uspto.gov",
    });
    assertFailure(Result.mapError(decodeUsptoConfigInputResult({ apiUrl: "//" }), thunkTrue), true);
    expect(encode(UsptoApplicationMetadata, metadata)).toEqual({
      applicationNumberText: "16138242",
      firstApplicantName: "Precision Widgets LLC",
      inventionTitle: "Adjustable widget assembly",
      patentNumber: "10772255",
    });
    expect(
      encode(UsptoApplicationMetadata, decode(UsptoApplicationMetadata, { applicationNumberText: "16138242" }))
    ).toEqual({
      applicationNumberText: "16138242",
    });
    expect(encode(UsptoContinuity, continuity)).toEqual({
      childApplicationNumbers: ["17999999"],
      parentApplicationNumbers: ["15111111"],
    });
    expect(encode(UsptoDocumentReference, document)).toEqual({
      documentCode: "SPEC",
      documentCodeDescriptionText: "Specification",
      documentIdentifier: "DOC123",
      downloadUrl: "https://api.uspto.gov/docs/DOC123.pdf",
      officialDate: "2018-09-21",
    });
    expect(encode(UsptoError, fullError)).toEqual({
      _tag: "UsptoError",
      cause: "bad status",
      reason: "response-status",
      status: 429,
    });
    expect(encode(UsptoError, minimalError)).toEqual({
      _tag: "UsptoError",
      reason: "transport",
    });
  });

  it.prop(
    "round-trips schema-derived USPTO payloads through encoded form",
    [
      ApplicationNumberArbitrary,
      PatentNumberArbitrary,
      ConfigInputArbitrary,
      ApplicationMetadataArbitrary,
      ContinuityArbitrary,
      DocumentReferenceArbitrary,
      ErrorReasonArbitrary,
      ErrorArbitrary,
    ],
    ([applicationNumber, patentNumber, config, metadata, continuity, document, errorReason, error]) => {
      expectEncodedRoundTrip(UsptoApplicationNumber, applicationNumber);
      expectEncodedRoundTrip(UsptoPatentNumber, patentNumber);
      expectEncodedRoundTrip(UsptoConfigInput, config);
      expectEncodedRoundTrip(UsptoApplicationMetadata, metadata);
      expectEncodedRoundTrip(UsptoContinuity, continuity);
      expectEncodedRoundTrip(UsptoDocumentReference, document);
      expectEncodedRoundTrip(UsptoErrorReason, errorReason);
      expectEncodedRoundTrip(UsptoError, error);
    },
    { arbitrary: fcRuns(50) }
  );
});
