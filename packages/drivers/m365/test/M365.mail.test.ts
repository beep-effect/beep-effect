import {
  M365,
  M365_ATTACHMENT_MAX_BYTES,
  M365_ATTACHMENT_SINGLE_REQUEST_MAX_BYTES,
  M365_ATTACHMENT_UPLOAD_CHUNK_BYTES,
  M365AddMessageAttachmentRequest,
  M365AppOnlyConfigInput,
  M365Auth,
  M365ClientSecretCredential,
  M365CreateDraftMessageRequest,
  M365DeleteDraftMessageRequest,
  M365GetMessageRequest,
  M365MailAddress,
  M365MailBody,
  M365MailDraft,
  M365SendDraftMessageRequest,
} from "@beep/m365";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { Cause, Context, Effect, Exit, Layer, pipe, Redacted, Ref, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as Base64 from "effect/encoding/Base64";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import type { M365Error } from "@beep/m365";

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const MAILBOX = "mailbox-id";
const MAILBOX_URL = `${GRAPH_BASE_URL}/users/${MAILBOX}`;
const MESSAGE_URL = `${MAILBOX_URL}/messages/message-id`;
const TOKEN = "m365-app-only-token";
const UPLOAD_URL =
  "https://outlook.example.test/api/v2.0/Users('mailbox-id')/Messages('message-id')/AttachmentSessions('session-id')?authtoken=fixture-session-token";
const JSON_CONTENT_TYPE = "application/json";

type CapturedRequest = {
  readonly bytes: O.Option<Uint8Array>;
  readonly headers: Readonly<Record<string, string>>;
  readonly json: O.Option<unknown>;
  readonly method: string;
  readonly url: string;
};

type TestRespond = (
  request: HttpClientRequest.HttpClientRequest,
  index: number
) => Effect.Effect<Response, HttpClientError.HttpClientError>;

type MailTestHttpShape = {
  readonly captures: Effect.Effect<ReadonlyArray<CapturedRequest>>;
  readonly handle: (
    request: HttpClientRequest.HttpClientRequest
  ) => Effect.Effect<Response, HttpClientError.HttpClientError>;
  readonly respondWith: (respond: TestRespond) => Effect.Effect<void>;
};

class MailTestHttp extends Context.Service<MailTestHttp, MailTestHttpShape>()(
  "@beep/m365/test/M365.mail.test/MailTestHttp"
) {}

const decodeJsonText = S.decodeUnknownOption(S.fromJsonString(S.Unknown));
const textDecoder = new TextDecoder();

const requestBytes = (request: HttpClientRequest.HttpClientRequest): O.Option<Uint8Array> =>
  request.body._tag === "Uint8Array" ? O.some(request.body.body) : O.none();

const requestJson = (request: HttpClientRequest.HttpClientRequest): O.Option<unknown> =>
  pipe(
    requestBytes(request),
    O.filter(() => request.headers["content-type"] === JSON_CONTENT_TYPE),
    O.flatMap((bytes) => decodeJsonText(textDecoder.decode(bytes)))
  );

const requestUrl = (request: HttpClientRequest.HttpClientRequest): string =>
  HttpClientRequest.toUrl(request).pipe(
    O.map((value) => value.toString()),
    O.getOrElse(() => request.url)
  );

const jsonResponse = (body: unknown, status = 200, headers: Readonly<Record<string, string>> = {}): Response =>
  Response.json(body, { headers: { "content-type": JSON_CONTENT_TYPE, ...headers }, status });

const emptyResponse = (status: number, headers: Readonly<Record<string, string>> = {}): Response =>
  new Response(null, { headers, status });

const transportFailure = (
  request: HttpClientRequest.HttpClientRequest
): Effect.Effect<Response, HttpClientError.HttpClientError> =>
  Effect.fail(
    new HttpClientError.HttpClientError({
      reason: new HttpClientError.TransportError({ request }),
    })
  );

const MailTestHttpLayer = Layer.effect(
  MailTestHttp,
  Effect.gen(function* () {
    const capturesRef = yield* Ref.make<ReadonlyArray<CapturedRequest>>([]);
    const respondRef = yield* Ref.make<TestRespond>(() => Effect.succeed(jsonResponse({ value: [] })));

    return MailTestHttp.of({
      captures: Ref.get(capturesRef),
      handle: Effect.fn("MailTestHttp.handle")(function* (request) {
        const index = A.length(yield* Ref.get(capturesRef));
        yield* Ref.update(
          capturesRef,
          A.append({
            bytes: requestBytes(request),
            headers: request.headers,
            json: requestJson(request),
            method: request.method,
            url: requestUrl(request),
          })
        );
        const respond = yield* Ref.get(respondRef);
        return yield* respond(request, index);
      }),
      respondWith: Effect.fn("MailTestHttp.respondWith")(function* (respond) {
        yield* Ref.set(respondRef, respond);
      }),
    });
  })
);

const TestHttpClientLayer = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const testHttp = yield* MailTestHttp;
    return HttpClient.make((request) =>
      pipe(
        testHttp.handle(request),
        Effect.map((response) => HttpClientResponse.fromWeb(request, response))
      )
    );
  })
);

const appOnlyLayer = (maxRetries = 0) =>
  M365.makeAppOnlyLayer(
    M365AppOnlyConfigInput.make({
      clientId: "client-id",
      credential: M365ClientSecretCredential.make({ clientSecret: Redacted.make("fixture-secret") }),
      maxRetries: S.Natural.make(maxRetries),
      tenantId: "tenant-id",
    })
  ).pipe(
    Layer.provide(M365Auth.layerStatic(Redacted.make(TOKEN))),
    Layer.provide(TestHttpClientLayer),
    Layer.provideMerge(MailTestHttpLayer)
  );

const failureOf = <A>(effect: Effect.Effect<A, M365Error>): Effect.Effect<O.Option<M365Error>> =>
  Effect.exit(effect).pipe(Effect.map(Exit.match({ onFailure: Cause.findErrorOption, onSuccess: O.none })));

const reasonOf = <A>(effect: Effect.Effect<A, M365Error>) =>
  failureOf(effect).pipe(Effect.map(O.map((error) => error.reason)));

const routes = A.map((capture: CapturedRequest) => `${capture.method} ${capture.url}`);

const syntheticBytes = (size: number): Uint8Array => Uint8Array.from({ length: size }, (_, index) => index % 251);

const sameBytes = (actual: O.Option<Uint8Array>, expected: Uint8Array): boolean =>
  O.exists(
    actual,
    (bytes) => bytes.byteLength === expected.byteLength && bytes.every((value, index) => value === expected[index])
  );

const roundTrip = <Sch extends S.ConstraintCodec<unknown, unknown, never, never>>(
  schema: Sch,
  value: Sch["Type"]
): Sch["Type"] => Result.getOrThrow(S.decodeUnknownResult(schema)(Result.getOrThrow(S.encodeResult(schema)(value))));

const mailDraft = M365MailDraft.make({
  body: M365MailBody.make({ content: "Synthetic body for a fixture.", contentType: "text" }),
  ccRecipients: ["copy@example.test"],
  subject: "Fixture subject",
  toRecipients: ["first@example.test", "second@example.test"],
});

const draftResponse = {
  bccRecipients: [],
  ccRecipients: [{ emailAddress: { address: "copy@example.test" } }],
  hasAttachments: false,
  id: "message-id",
  internetMessageId: "<fixture@example.test>",
  isDraft: true,
  parentFolderId: "drafts-id",
  subject: "Fixture subject",
  toRecipients: [
    { emailAddress: { address: "first@example.test" } },
    { emailAddress: { address: "second@example.test" } },
  ],
  webLink: "https://outlook.example.test/owa/?ItemID=message-id",
};

const attachmentRequest = (content: Uint8Array, userId: O.Option<string> = O.some(MAILBOX)) =>
  M365AddMessageAttachmentRequest.make({
    content,
    contentType: "application/pdf",
    messageId: "message-id",
    name: "fixture.pdf",
    userId,
  });

const sendRequest = M365SendDraftMessageRequest.make({ messageId: "message-id", userId: O.some(MAILBOX) });

describe("@beep/m365 mail outbound verbs", () => {
  it("accepts only addresses with one @ and no whitespace", () => {
    const isAddress = S.is(M365MailAddress);

    expect(A.map(["a@example.test", "first.last+tag@sub.example.test"], isAddress)).toStrictEqual([true, true]);
    expect(
      A.map(["", "example.test", "@example.test", "a@", "a@b@example.test", "a b@example.test"], isAddress)
    ).toStrictEqual([false, false, false, false, false, false]);
  });

  it.prop(
    "round-trips a mail draft through its encoded shape",
    [Arbitrary.schema(M365MailDraft)],
    ([draft]) => {
      expect(S.toEquivalence(M365MailDraft)(roundTrip(M365MailDraft, draft), draft)).toBe(true);
    },
    { arbitrary: fcRuns(25) }
  );

  it.layer(appOnlyLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "creates a draft with Graph recipient wrappers and decodes the stored draft",
      Effect.fnUntraced(function* () {
        const testHttp = yield* MailTestHttp;
        const m365 = yield* M365;
        yield* testHttp.respondWith(() => Effect.succeed(jsonResponse(draftResponse, 201)));

        const message = yield* m365.createDraftMessage(
          M365CreateDraftMessageRequest.make({ draft: mailDraft, userId: O.some(MAILBOX) })
        );
        const captures = yield* testHttp.captures;
        const capture = A.get(captures, 0);

        expect(routes(captures)).toStrictEqual([`POST ${MAILBOX_URL}/messages`]);
        assertSome(
          O.map(capture, (request) => request.headers.authorization),
          `Bearer ${TOKEN}`
        );
        assertSome(
          O.map(capture, (request) => request.headers["content-type"]),
          JSON_CONTENT_TYPE
        );
        assertSome(
          O.flatMap(capture, (request) => request.json),
          {
            bccRecipients: [],
            body: { content: "Synthetic body for a fixture.", contentType: "text" },
            ccRecipients: [{ emailAddress: { address: "copy@example.test" } }],
            subject: "Fixture subject",
            toRecipients: [
              { emailAddress: { address: "first@example.test" } },
              { emailAddress: { address: "second@example.test" } },
            ],
          }
        );
        expect(message.id).toBe("message-id");
        assertSome(message.isDraft, true);
        assertSome(message.parentFolderId, "drafts-id");
      })
    );
  });

  it.layer(appOnlyLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "reads a draft back with every recipient list through getMessage",
      Effect.fnUntraced(function* () {
        const testHttp = yield* MailTestHttp;
        const m365 = yield* M365;
        yield* testHttp.respondWith(() =>
          Effect.succeed(
            jsonResponse({ ...draftResponse, bccRecipients: [{ emailAddress: { address: "hidden@example.test" } }] })
          )
        );

        const message = yield* m365.getMessage(
          M365GetMessageRequest.make({ messageId: "message-id", userId: O.some(MAILBOX) })
        );
        const addresses = O.map(
          message.bccRecipients,
          A.map((recipient) =>
            pipe(
              recipient.emailAddress,
              O.flatMap((emailAddress) => emailAddress.address)
            )
          )
        );

        expect(routes(yield* testHttp.captures)).toStrictEqual([`GET ${MESSAGE_URL}`]);
        assertSome(addresses, [O.some("hidden@example.test")]);
        assertSome(O.map(message.toRecipients, A.length), 2);
        assertSome(O.map(message.ccRecipients, A.length), 1);
        assertSome(message.subject, "Fixture subject");
        assertSome(message.hasAttachments, false);
        assertSome(message.internetMessageId, "<fixture@example.test>");
        assertSome(message.webLink, "https://outlook.example.test/owa/?ItemID=message-id");
      })
    );
  });

  it.layer(appOnlyLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "attaches small content in one request as base64",
      Effect.fnUntraced(function* () {
        const testHttp = yield* MailTestHttp;
        const m365 = yield* M365;
        const content = syntheticBytes(1024);
        yield* testHttp.respondWith(() =>
          Effect.succeed(
            jsonResponse(
              {
                "@odata.type": "#microsoft.graph.fileAttachment",
                contentType: "application/pdf",
                id: "attachment-id",
                name: "fixture.pdf",
                size: 1024,
              },
              201
            )
          )
        );

        const attachment = yield* m365.addMessageAttachment(attachmentRequest(content));
        const captures = yield* testHttp.captures;
        const capture = A.get(captures, 0);

        expect(routes(captures)).toStrictEqual([`POST ${MESSAGE_URL}/attachments`]);
        assertSome(
          O.map(capture, (request) => request.headers.authorization),
          `Bearer ${TOKEN}`
        );
        assertSome(
          O.flatMap(capture, (request) => request.json),
          {
            "@odata.type": "#microsoft.graph.fileAttachment",
            contentBytes: Base64.encode(content),
            contentType: "application/pdf",
            name: "fixture.pdf",
          }
        );
        expect(attachment.id).toBe("attachment-id");
        assertSome(attachment.size, 1024);
      })
    );
  });

  it.layer(appOnlyLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "keeps content of exactly the single-request limit out of an upload session",
      Effect.fnUntraced(function* () {
        const testHttp = yield* MailTestHttp;
        const m365 = yield* M365;
        yield* testHttp.respondWith(() => Effect.succeed(jsonResponse({ id: "attachment-id" }, 201)));

        yield* m365.addMessageAttachment(attachmentRequest(new Uint8Array(M365_ATTACHMENT_SINGLE_REQUEST_MAX_BYTES)));

        expect(routes(yield* testHttp.captures)).toStrictEqual([`POST ${MESSAGE_URL}/attachments`]);
      })
    );
  });

  it.layer(appOnlyLayer(), { timeout: "10 seconds" })((it) => {
    it.effect(
      "uploads large content in ranged chunks that carry no bearer token",
      Effect.fnUntraced(function* () {
        const testHttp = yield* MailTestHttp;
        const m365 = yield* M365;
        const chunk = M365_ATTACHMENT_UPLOAD_CHUNK_BYTES;
        const total = 2 * chunk + 1000;
        const content = syntheticBytes(total);
        yield* testHttp.respondWith((_request, index) =>
          Effect.succeed(
            index === 0
              ? jsonResponse({ nextExpectedRanges: ["0-"], uploadUrl: UPLOAD_URL }, 201)
              : index < 3
                ? jsonResponse({ nextExpectedRanges: [`${index * chunk}-`] })
                : emptyResponse(201, {
                    location:
                      "https://outlook.example.test/api/v2.0/Users('mailbox-id')/Messages('message-id')/Attachments('AAMkAGfixture%3D')",
                  })
          )
        );

        const attachment = yield* m365.addMessageAttachment(attachmentRequest(content));
        const captures = yield* testHttp.captures;
        const session = A.get(captures, 0);
        const puts = A.drop(captures, 1);

        expect(routes(captures)).toStrictEqual([
          `POST ${MESSAGE_URL}/attachments/createUploadSession`,
          `PUT ${new URL(UPLOAD_URL).toString()}`,
          `PUT ${new URL(UPLOAD_URL).toString()}`,
          `PUT ${new URL(UPLOAD_URL).toString()}`,
        ]);
        assertSome(
          O.map(session, (request) => request.headers.authorization),
          `Bearer ${TOKEN}`
        );
        assertSome(
          O.flatMap(session, (request) => request.json),
          {
            AttachmentItem: {
              attachmentType: "file",
              contentType: "application/pdf",
              name: "fixture.pdf",
              size: total,
            },
          }
        );
        expect(A.map(puts, (request) => request.headers["content-range"])).toStrictEqual([
          `bytes 0-${chunk - 1}/${total}`,
          `bytes ${chunk}-${2 * chunk - 1}/${total}`,
          `bytes ${2 * chunk}-${total - 1}/${total}`,
        ]);
        expect(A.map(puts, (request) => request.headers["content-length"])).toStrictEqual([
          `${chunk}`,
          `${chunk}`,
          "1000",
        ]);
        expect(A.map(puts, (request) => request.headers["content-type"])).toStrictEqual([
          "application/octet-stream",
          "application/octet-stream",
          "application/octet-stream",
        ]);
        expect(A.map(puts, (request) => request.headers.authorization)).toStrictEqual([
          undefined,
          undefined,
          undefined,
        ]);
        expect(
          A.map(puts, (request, index) =>
            sameBytes(request.bytes, content.subarray(index * chunk, (index + 1) * chunk))
          )
        ).toStrictEqual([true, true, true]);
        expect(attachment.id).toBe("AAMkAGfixture=");
        assertSome(attachment.name, "fixture.pdf");
        assertSome(attachment.contentType, "application/pdf");
        assertSome(attachment.size, total);
      })
    );
  });

  it.layer(appOnlyLayer(2), { timeout: "10 seconds" })((it) => {
    it.effect(
      "replays a throttled chunk with the same range and reads a path-style attachment id",
      Effect.fnUntraced(function* () {
        const testHttp = yield* MailTestHttp;
        const m365 = yield* M365;
        const total = M365_ATTACHMENT_SINGLE_REQUEST_MAX_BYTES + 1;
        yield* testHttp.respondWith((_request, index) =>
          Effect.succeed(
            index === 0
              ? jsonResponse({ uploadUrl: UPLOAD_URL }, 201)
              : index === 1
                ? jsonResponse({}, 429, { "retry-after": "0" })
                : emptyResponse(201, { location: `${MESSAGE_URL}/attachments/plain-attachment-id` })
          )
        );

        const attachment = yield* m365.addMessageAttachment(attachmentRequest(new Uint8Array(total)));
        const puts = A.drop(yield* testHttp.captures, 1);

        expect(A.map(puts, (request) => request.headers["content-range"])).toStrictEqual([
          `bytes 0-${total - 1}/${total}`,
          `bytes 0-${total - 1}/${total}`,
        ]);
        expect(attachment.id).toBe("plain-attachment-id");
      })
    );
  });

  it.layer(appOnlyLayer(), { timeout: "10 seconds" })((it) => {
    it.effect(
      "fails an upload whose final chunk names no attachment and refuses a plain-http session URL",
      Effect.fnUntraced(function* () {
        const testHttp = yield* MailTestHttp;
        const m365 = yield* M365;
        const content = new Uint8Array(M365_ATTACHMENT_SINGLE_REQUEST_MAX_BYTES + 1);
        yield* testHttp.respondWith((_request, index) =>
          Effect.succeed(index === 0 ? jsonResponse({ uploadUrl: UPLOAD_URL }, 201) : emptyResponse(201))
        );
        const missingLocation = yield* failureOf(m365.addMessageAttachment(attachmentRequest(content)));
        yield* testHttp.respondWith(() =>
          Effect.succeed(jsonResponse({ uploadUrl: "http://outlook.example.test/upload?authtoken=fixture" }, 201))
        );
        const insecureSession = yield* reasonOf(m365.addMessageAttachment(attachmentRequest(content)));

        assertSome(
          O.map(missingLocation, (error) => error.reason),
          "response decoding"
        );
        assertSome(
          O.flatMap(missingLocation, (error) => error.url),
          `${MESSAGE_URL}/attachments/createUploadSession`
        );
        assertSome(insecureSession, "response decoding");
        expect(yield* testHttp.captures).toHaveLength(3);
      })
    );
  });

  it.layer(appOnlyLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "rejects empty and oversize content before any HTTP call",
      Effect.fnUntraced(function* () {
        const testHttp = yield* MailTestHttp;
        const m365 = yield* M365;

        const empty = yield* reasonOf(m365.addMessageAttachment(attachmentRequest(new Uint8Array(0))));
        const oversize = yield* reasonOf(
          m365.addMessageAttachment(attachmentRequest(new Uint8Array(M365_ATTACHMENT_MAX_BYTES + 1)))
        );

        assertSome(empty, "request encoding");
        assertSome(oversize, "request encoding");
        expect(yield* testHttp.captures).toHaveLength(0);
      })
    );
  });

  it.layer(appOnlyLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "sends a draft with an empty signed POST and deletes a draft by id",
      Effect.fnUntraced(function* () {
        const testHttp = yield* MailTestHttp;
        const m365 = yield* M365;
        yield* testHttp.respondWith((request) => Effect.succeed(emptyResponse(request.method === "POST" ? 202 : 204)));

        yield* m365.sendDraftMessage(sendRequest);
        yield* m365.deleteDraftMessage(
          M365DeleteDraftMessageRequest.make({ messageId: "message-id", userId: O.some(MAILBOX) })
        );
        const captures = yield* testHttp.captures;

        expect(routes(captures)).toStrictEqual([`POST ${MESSAGE_URL}/send`, `DELETE ${MESSAGE_URL}`]);
        expect(A.map(captures, (request) => request.headers.authorization)).toStrictEqual([
          `Bearer ${TOKEN}`,
          `Bearer ${TOKEN}`,
        ]);
        assertNone(O.flatMap(A.get(captures, 0), (request) => request.bytes));
        assertNone(O.flatMap(A.get(captures, 1), (request) => request.bytes));
      })
    );
  });

  it.layer(appOnlyLayer(2), { timeout: "5 seconds" })((it) => {
    it.effect(
      "never replays a send after a transport failure",
      Effect.fnUntraced(function* () {
        const testHttp = yield* MailTestHttp;
        const m365 = yield* M365;
        yield* testHttp.respondWith(transportFailure);

        const reason = yield* reasonOf(m365.sendDraftMessage(sendRequest));

        assertSome(reason, "ambiguous write");
        expect(yield* testHttp.captures).toHaveLength(1);
      })
    );
  });

  it.layer(appOnlyLayer(2), { timeout: "5 seconds" })((it) => {
    it.effect(
      "never replays a send after a 503",
      Effect.fnUntraced(function* () {
        const testHttp = yield* MailTestHttp;
        const m365 = yield* M365;
        yield* testHttp.respondWith(() => Effect.succeed(jsonResponse({}, 503, { "retry-after": "0" })));

        const reason = yield* reasonOf(m365.sendDraftMessage(sendRequest));

        assertSome(reason, "ambiguous write");
        expect(yield* testHttp.captures).toHaveLength(1);
      })
    );
  });

  it.layer(appOnlyLayer(2), { timeout: "5 seconds" })((it) => {
    it.effect(
      "replays a send after an explicit 429 refusal",
      Effect.fnUntraced(function* () {
        const testHttp = yield* MailTestHttp;
        const m365 = yield* M365;
        yield* testHttp.respondWith((_request, index) =>
          Effect.succeed(index === 0 ? jsonResponse({}, 429, { "retry-after": "0" }) : emptyResponse(202))
        );

        yield* m365.sendDraftMessage(sendRequest);

        expect(routes(yield* testHttp.captures)).toStrictEqual([
          `POST ${MESSAGE_URL}/send`,
          `POST ${MESSAGE_URL}/send`,
        ]);
      })
    );
  });

  it.layer(appOnlyLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "refuses every mail verb without a mailbox before any HTTP call",
      Effect.fnUntraced(function* () {
        const testHttp = yield* MailTestHttp;
        const m365 = yield* M365;

        const reasons = yield* Effect.all([
          reasonOf(m365.createDraftMessage(M365CreateDraftMessageRequest.make({ draft: mailDraft }))),
          reasonOf(m365.addMessageAttachment(attachmentRequest(syntheticBytes(8), O.none()))),
          reasonOf(
            m365.addMessageAttachment(
              attachmentRequest(new Uint8Array(M365_ATTACHMENT_SINGLE_REQUEST_MAX_BYTES + 1), O.none())
            )
          ),
          reasonOf(m365.sendDraftMessage(M365SendDraftMessageRequest.make({ messageId: "message-id" }))),
          reasonOf(m365.deleteDraftMessage(M365DeleteDraftMessageRequest.make({ messageId: "message-id" }))),
        ]);

        expect(reasons).toStrictEqual(A.replicate(O.some("request encoding"), 5));
        expect(yield* testHttp.captures).toHaveLength(0);
      })
    );
  });
});
