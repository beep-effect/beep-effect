import {
  HubSpot,
  HubSpotBaseUrl,
  HubSpotConfigInput,
  HubSpotError,
  HubSpotSubmitFormRequest,
  HubSpotSubmitFormResponse,
  HubSpotUpsertContactRequest,
  HubSpotUpsertContactResponse,
} from "@beep/hubspot";
import { fcRuns } from "@beep/test-utils";
import { A } from "@beep/utils";
import { describe, expect, it, layer } from "@effect/vitest";
import { Cause, Context, Effect, Exit, Layer, Redacted, Ref, Result } from "effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import type * as HttpClientError from "effect/unstable/http/HttpClientError";

type CapturedRequest = {
  readonly headers: Readonly<Record<string, string>>;
  readonly method: string;
  readonly url: string;
};

type TestRespond = (
  request: HttpClientRequest.HttpClientRequest
) => Effect.Effect<Response, HttpClientError.HttpClientError>;

type HubSpotTestHttpShape = {
  readonly captures: Effect.Effect<ReadonlyArray<CapturedRequest>>;
  readonly handle: TestRespond;
  readonly respondWith: (respond: TestRespond) => Effect.Effect<void>;
};

class HubSpotTestHttp extends Context.Service<HubSpotTestHttp, HubSpotTestHttpShape>()(
  "@beep/hubspot/test/HubSpot.service.test/HubSpotTestHttp"
) {}

const ConfigInputArbitrary = S.toArbitrary(HubSpotConfigInput).filter((config) => config.accessToken === undefined);
const SubmitFormRequestArbitrary = S.toArbitrary(HubSpotSubmitFormRequest);
const UpsertContactRequestArbitrary = S.toArbitrary(HubSpotUpsertContactRequest);
const SubmitFormResponseArbitrary = S.toArbitrary(HubSpotSubmitFormResponse);
const UpsertContactResponseArbitrary = S.toArbitrary(HubSpotUpsertContactResponse);
const ErrorArbitrary = S.toArbitrary(HubSpotError);

const encode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): Codec["Encoded"] =>
  Result.getOrThrow(S.encodeResult(schema)(value));

const decode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Encoded"]): Codec["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const expectRoundTrip = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): void => {
  const encoded = encode(schema, value);
  const decoded = decode(schema, encoded);
  const reencoded = encode(schema, decoded);

  expect(reencoded).toEqual(encoded);
  expect(S.toEquivalence(schema)(decoded, value)).toBe(true);
};

const makeJsonResponse = (body: unknown, status = 200) =>
  Response.json(body, {
    headers: {
      "content-type": "application/json",
    },
    status,
  });

const defaultRespond: TestRespond = () => Effect.succeed(makeJsonResponse({ inlineMessage: "Thanks" }));

const HubSpotTestHttpLayer = Layer.effect(
  HubSpotTestHttp,
  Effect.gen(function* () {
    const capturesRef = yield* Ref.make<ReadonlyArray<CapturedRequest>>([]);
    const respondRef = yield* Ref.make<TestRespond>(defaultRespond);

    return HubSpotTestHttp.of({
      captures: Ref.get(capturesRef),
      handle: Effect.fn("HubSpotTestHttp.handle")(function* (request) {
        const url = HttpClientRequest.toUrl(request).pipe(
          O.map((value) => value.toString()),
          O.getOrElse(() => request.url)
        );

        yield* Ref.update(
          capturesRef,
          A.append({
            headers: request.headers,
            method: request.method,
            url,
          })
        );

        const respond = yield* Ref.get(respondRef);
        return yield* respond(request);
      }),
      respondWith: Effect.fn("HubSpotTestHttp.respondWith")(function* (respond) {
        yield* Ref.set(respondRef, respond);
      }),
    });
  })
);

const TestHttpClientLayer = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const testHttp = yield* HubSpotTestHttp;

    return HttpClient.make((request) =>
      Effect.gen(function* () {
        const response = yield* testHttp.handle(request);
        return HttpClientResponse.fromWeb(request, response);
      })
    );
  })
);

const TestLayer = HubSpot.makeLayer(
  HubSpotConfigInput.make({
    accessToken: Redacted.make("hubspot-service-key"),
    accountId: "12345",
  })
).pipe(Layer.provide(TestHttpClientLayer), Layer.provideMerge(HubSpotTestHttpLayer));

const request = HubSpotSubmitFormRequest.make({
  fields: [
    {
      name: "email",
      value: "tom@example.com",
    },
  ],
  formGuid: "form-guid",
});

describe("@beep/hubspot", () => {
  it("keeps encoded HubSpot schema wire shapes byte-identical", () => {
    const config = HubSpotConfigInput.make({
      accountId: "12345",
      crmApiUrl: "https://api.hubapi.com",
      formsApiUrl: "https://api.hsforms.com",
      headers: {
        "x-hubspot-test": "1",
      },
    });
    const submitRequest = HubSpotSubmitFormRequest.make({
      context: {
        pageName: "Contact",
        pageUri: "https://example.com/contact",
      },
      fields: [{ name: "email", value: "tom@example.com" }],
      formGuid: "form-guid",
      submittedAt: 1_704_067_200_000,
    });
    const submitResponse = HubSpotSubmitFormResponse.make({
      inlineMessage: "Thanks",
      redirectUri: "https://example.com/thanks",
    });
    const upsertRequest = HubSpotUpsertContactRequest.make({
      email: "tom@example.com",
      objectWriteTraceId: "trace-id",
      properties: {
        email: "tom@example.com",
        firstname: "Tom",
      },
    });
    const upsertResponse = HubSpotUpsertContactResponse.make({
      results: [{ id: "contact-id" }],
      status: "COMPLETE",
    });
    const error = HubSpotError.fromReason("response status", {
      formGuid: "form-guid",
      status: 401,
      url: "https://api.hsforms.com/submissions/v3/integration/secure/submit/12345/form-guid",
    });

    expect(encode(HubSpotConfigInput, config)).toEqual({
      accountId: "12345",
      crmApiUrl: "https://api.hubapi.com",
      formsApiUrl: "https://api.hsforms.com",
      headers: {
        "x-hubspot-test": "1",
      },
    });
    expect(encode(HubSpotBaseUrl, decode(HubSpotBaseUrl, "https://api.hubapi.com/"))).toBe("https://api.hubapi.com");
    expect(encode(HubSpotSubmitFormRequest, submitRequest)).toEqual({
      context: {
        pageName: "Contact",
        pageUri: "https://example.com/contact",
      },
      fields: [{ name: "email", value: "tom@example.com" }],
      formGuid: "form-guid",
      submittedAt: 1_704_067_200_000,
    });
    expect(encode(HubSpotSubmitFormResponse, submitResponse)).toEqual({
      inlineMessage: "Thanks",
      redirectUri: "https://example.com/thanks",
    });
    expect(encode(HubSpotUpsertContactRequest, upsertRequest)).toEqual({
      email: "tom@example.com",
      objectWriteTraceId: "trace-id",
      properties: {
        email: "tom@example.com",
        firstname: "Tom",
      },
    });
    expect(encode(HubSpotUpsertContactResponse, upsertResponse)).toEqual({
      results: [{ id: "contact-id" }],
      status: "COMPLETE",
    });
    expect(encode(HubSpotError, error)).toEqual({
      _tag: "HubSpotError",
      formGuid: "form-guid",
      reason: "response status",
      status: 401,
      url: "https://api.hsforms.com/submissions/v3/integration/secure/submit/12345/form-guid",
    });
  });

  it("round-trips schema-derived HubSpot payloads through encoded form", () =>
    fc.assert(
      fc.property(
        ConfigInputArbitrary,
        SubmitFormRequestArbitrary,
        UpsertContactRequestArbitrary,
        SubmitFormResponseArbitrary,
        UpsertContactResponseArbitrary,
        ErrorArbitrary,
        (config, submitRequest, upsertRequest, submitResponse, upsertResponse, error) => {
          expect(config.crmApiUrl.endsWith("/")).toBe(false);
          expect(config.formsApiUrl.endsWith("/")).toBe(false);
          expect(submitRequest.formGuid.length).toBeGreaterThan(0);
          expect(A.every(submitRequest.fields, (field) => field.name.length > 0)).toBe(true);
          expect(upsertRequest.email.length).toBeGreaterThan(0);
          expect(A.every(Object.keys(upsertRequest.properties), (name) => name.length > 0)).toBe(true);
          if (error.status !== undefined) {
            expect(error.status).toBeGreaterThanOrEqual(100);
            expect(error.status).toBeLessThanOrEqual(599);
          }

          expectRoundTrip(HubSpotConfigInput, config);
          expectRoundTrip(HubSpotSubmitFormRequest, submitRequest);
          expectRoundTrip(HubSpotUpsertContactRequest, upsertRequest);
          expectRoundTrip(HubSpotSubmitFormResponse, submitResponse);
          expectRoundTrip(HubSpotUpsertContactResponse, upsertResponse);
          expectRoundTrip(HubSpotError, error);
        }
      ),
      fcRuns(50)
    ));

  layer(TestLayer)((it) => {
    it.effect(
      "submits a form through the secure Forms API endpoint",
      Effect.fnUntraced(function* () {
        const hubspot = yield* HubSpot;
        const response = yield* hubspot.submitForm(request);
        const testHttp = yield* HubSpotTestHttp;
        const captures = yield* testHttp.captures;

        expect(response.inlineMessage).toBe("Thanks");
        expect(captures[0]?.method).toBe("POST");
        expect(captures[0]?.url).toBe(
          "https://api.hsforms.com/submissions/v3/integration/secure/submit/12345/form-guid"
        );
        expect(captures[0]?.headers.authorization).toBe("Bearer hubspot-service-key");
      })
    );

    it.effect(
      "maps non-success responses to typed driver errors",
      Effect.fnUntraced(function* () {
        const testHttp = yield* HubSpotTestHttp;
        yield* testHttp.respondWith(() => Effect.succeed(makeJsonResponse({ message: "nope" }, 401)));

        const hubspot = yield* HubSpot;
        const exit = yield* Effect.exit(hubspot.submitForm(request));

        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          const error = Cause.findErrorOption(exit.cause);
          expect(O.isSome(error)).toBe(true);
          if (O.isSome(error)) {
            expect(error.value).toBeInstanceOf(HubSpotError);
            expect(error.value.reason).toBe("response status");
            expect(error.value.status).toBe(401);
          }
        }
      })
    );

    it.effect(
      "upserts contacts through the CRM batch endpoint",
      Effect.fnUntraced(function* () {
        const testHttp = yield* HubSpotTestHttp;
        yield* testHttp.respondWith(() => Effect.succeed(makeJsonResponse({ results: [{ id: "contact-id" }] })));

        const hubspot = yield* HubSpot;
        const response = yield* hubspot.upsertContact(
          HubSpotUpsertContactRequest.make({
            email: "tom@example.com",
            properties: {
              email: "tom@example.com",
              firstname: "Tom",
            },
          })
        );
        const captures = yield* testHttp.captures;
        const capture = captures[captures.length - 1];

        expect(response.results[0]?.id).toBe("contact-id");
        expect(capture?.method).toBe("POST");
        expect(capture?.url).toBe("https://api.hubapi.com/crm/v3/objects/contacts/batch/upsert");
        expect(capture?.headers.authorization).toBe("Bearer hubspot-service-key");
      })
    );

    it.effect(
      "maps upsert response status failures with email context",
      Effect.fnUntraced(function* () {
        const testHttp = yield* HubSpotTestHttp;
        yield* testHttp.respondWith(() => Effect.succeed(makeJsonResponse({ message: "rate limited" }, 429)));

        const hubspot = yield* HubSpot;
        const exit = yield* Effect.exit(
          hubspot.upsertContact(
            HubSpotUpsertContactRequest.make({
              email: "tom@example.com",
              properties: {
                email: "tom@example.com",
              },
            })
          )
        );

        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          const error = Cause.findErrorOption(exit.cause);
          expect(O.isSome(error)).toBe(true);
          if (O.isSome(error)) {
            expect(error.value).toBeInstanceOf(HubSpotError);
            expect(error.value.reason).toBe("response status");
            expect(error.value.status).toBe(429);
            expect(error.value.email).toBe("tom@example.com");
            expect(error.value.formGuid).toBeUndefined();
          }
        }
      })
    );
  });
});
