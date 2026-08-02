import { NonNegativeInt } from "@beep/schema";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import {
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
import { describe, expect, it } from "@effect/vitest";
import { Effect, Layer, Redacted, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";

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

const ApplicationNumberArbitrary = S.toArbitrary(UsptoApplicationNumber);
const PatentNumberArbitrary = S.toArbitrary(UsptoPatentNumber);
const ConfigInputArbitrary = S.toArbitrary(UsptoConfigInput);
const ApplicationMetadataArbitrary = S.toArbitrary(UsptoApplicationMetadata);
const ContinuityArbitrary = S.toArbitrary(UsptoContinuity);
const DocumentReferenceArbitrary = S.toArbitrary(UsptoDocumentReference);
const ErrorReasonArbitrary = S.toArbitrary(UsptoErrorReason);
const ErrorArbitrary = S.toArbitrary(UsptoError);

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
  it.effect(
    "resolves application metadata from a file wrapper envelope",
    Effect.fnUntraced(
      function* () {
        const seenUrls: Array<string> = [];
        const uspto = yield* Uspto;
        const metadata = yield* uspto.getApplication("16138242");

        expect(metadata.applicationNumberText).toBe("16138242");
        expect(metadata.inventionTitle).toStrictEqual(O.some("Adjustable widget assembly"));
        expect(metadata.patentNumber).toStrictEqual(O.some("10772255"));
        expect(metadata.firstApplicantName).toStrictEqual(O.some("Precision Widgets LLC"));
        expect(seenUrls).toHaveLength(0);
      },
      provideScopedLayer(usptoLayer(respondWith(applicationEnvelope)))
    )
  );

  it.effect(
    "sends the application request to the open data portal path",
    Effect.fnUntraced(function* () {
      const seenUrls: Array<string> = [];
      const layer = usptoLayer(respondWith(applicationEnvelope, 200, seenUrls));
      yield* Uspto.pipe(
        Effect.flatMap((uspto) => uspto.getApplication("16138242")),
        provideScopedLayer(layer)
      );
      expect(seenUrls).toStrictEqual(["https://api.uspto.gov/api/v1/patent/applications/16138242"]);
    })
  );

  it.effect(
    "maps 404 responses to not-found",
    Effect.fnUntraced(
      function* () {
        const uspto = yield* Uspto;
        const error = yield* uspto.getApplication("99999999").pipe(Effect.flip);
        expect(error.reason).toBe("not-found");
      },
      provideScopedLayer(usptoLayer(respondWith("{}", 404)))
    )
  );

  it.effect(
    "maps 429 responses to rate-limited",
    Effect.fnUntraced(
      function* () {
        const uspto = yield* Uspto;
        const error = yield* uspto.getApplication("16138242").pipe(Effect.flip);
        expect(error.reason).toBe("rate-limited");
      },
      provideScopedLayer(usptoLayer(respondWith("{}", 429)))
    )
  );

  it.effect(
    "extracts continuity parents and children",
    Effect.fnUntraced(
      function* () {
        const uspto = yield* Uspto;
        const continuity = yield* uspto.getContinuity("16138242");
        expect(continuity.parentApplicationNumbers).toStrictEqual(["15111111"]);
        expect(continuity.childApplicationNumbers).toStrictEqual(["17999999"]);
      },
      provideScopedLayer(usptoLayer(respondWith(continuityEnvelope)))
    )
  );

  it.effect(
    "extracts document references with download urls and skips id-less rows",
    Effect.fnUntraced(
      function* () {
        const uspto = yield* Uspto;
        const documents = yield* uspto.getDocuments("16138242");
        expect(documents).toHaveLength(1);
        expect(documents[0]?.documentIdentifier).toBe("DOC123");
        expect(documents[0]?.downloadUrl).toBe("https://api.uspto.gov/docs/DOC123.pdf");
      },
      provideScopedLayer(usptoLayer(respondWith(documentsEnvelope)))
    )
  );

  it.effect(
    "searches applications and projects each wrapper",
    Effect.fnUntraced(
      function* () {
        const uspto = yield* Uspto;
        const results = yield* uspto.searchApplications('applicationMetaData.patentNumber:"10772255"');
        expect(results).toHaveLength(1);
        expect(results[0]?.patentNumber).toStrictEqual(O.some("10772255"));
      },
      provideScopedLayer(usptoLayer(respondWith(applicationEnvelope)))
    )
  );
});

describe("Uspto identifier normalization", () => {
  it("normalizes application numbers", () => {
    expect(normalizeUsptoApplicationNumber("16/138,242")).toStrictEqual(O.some("16138242"));
    expect(normalizeUsptoApplicationNumber("16-138-242")).toStrictEqual(O.some("16138242"));
    expect(O.isNone(normalizeUsptoApplicationNumber("12345"))).toBe(true);
    expect(O.isNone(normalizeUsptoApplicationNumber("not a number"))).toBe(true);
  });

  it("normalizes patent numbers", () => {
    expect(normalizeUsptoPatentNumber("US 10,772,255 B2")).toStrictEqual(O.some("10772255"));
    expect(normalizeUsptoPatentNumber("10772255")).toStrictEqual(O.some("10772255"));
    expect(normalizeUsptoPatentNumber("RE46,604")).toStrictEqual(O.some("RE46604"));
    expect(O.isNone(normalizeUsptoPatentNumber("ABC"))).toBe(true);
  });
});

describe("Uspto schema parity", () => {
  it("keeps encoded schema wire shapes byte-identical", () => {
    const config = Result.getOrThrow(
      S.decodeUnknownResult(UsptoConfigInput)({ apiKey: "test-key", apiUrl: "https://api.uspto.gov///" })
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

  it("round-trips schema-derived USPTO payloads through encoded form", () =>
    fc.assert(
      fc.property(
        ApplicationNumberArbitrary,
        PatentNumberArbitrary,
        ConfigInputArbitrary,
        ApplicationMetadataArbitrary,
        ContinuityArbitrary,
        DocumentReferenceArbitrary,
        ErrorReasonArbitrary,
        ErrorArbitrary,
        (applicationNumber, patentNumber, config, metadata, continuity, document, errorReason, error) => {
          const normalizedConfig = decode(UsptoConfigInput, encode(UsptoConfigInput, config));

          expectEncodedRoundTrip(UsptoApplicationNumber, applicationNumber);
          expectEncodedRoundTrip(UsptoPatentNumber, patentNumber);
          expectEncodedRoundTrip(UsptoConfigInput, normalizedConfig);
          expectEncodedRoundTrip(UsptoApplicationMetadata, metadata);
          expectEncodedRoundTrip(UsptoContinuity, continuity);
          expectEncodedRoundTrip(UsptoDocumentReference, document);
          expectEncodedRoundTrip(UsptoErrorReason, errorReason);
          expectEncodedRoundTrip(UsptoError, error);
        }
      ),
      fcRuns(50)
    ));
});
