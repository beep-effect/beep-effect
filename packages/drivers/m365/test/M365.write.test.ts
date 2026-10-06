import {
  M365,
  M365_IDEMPOTENCY_KEY_PROPERTY_ID,
  M365AppOnlyConfigInput,
  M365Auth,
  M365CertificateCredential,
  M365ClientSecretCredential,
  M365ConfigInput,
  M365CreateEventRequest,
  M365DeleteEventRequest,
  M365DownloadMessageAttachmentRequest,
  M365EnsureMasterCategoriesRequest,
  M365EventDraft,
  M365EventPatch,
  M365FindEventsByIdempotencyKeyRequest,
  M365GetMailFolderRequest,
  M365ListDrivesRequest,
  M365ListMessageAttachmentsRequest,
  M365ListMessagesRequest,
  M365MasterCategoryDraft,
  M365UpdateEventRequest,
  M365UpdateMessageCategoriesRequest,
  m365AllDayWindow,
  m365AppOnlyScope,
  resolveM365AppOnlyAuthority,
} from "@beep/m365";
import { addDays, diffInDays, LocalDate } from "@beep/schema/LocalDate";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome } from "@effect/vitest/utils";
import { Cause, Context, Effect, Exit, Layer, pipe, Redacted, Ref, Result } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { M365Error } from "@beep/m365";

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const MAILBOX = "mailbox-id";
const MAILBOX_URL = `${GRAPH_BASE_URL}/users/${MAILBOX}`;
const TOKEN = "m365-app-only-token";
const KEY = "docket:0f3a9c2b7d11";

type CapturedRequest = {
  readonly body: O.Option<unknown>;
  readonly headers: Readonly<Record<string, string>>;
  readonly method: string;
  readonly url: string;
};

type TestRespond = (
  request: HttpClientRequest.HttpClientRequest,
  index: number
) => Effect.Effect<Response, HttpClientError.HttpClientError>;

type WriteTestHttpShape = {
  readonly captures: Effect.Effect<ReadonlyArray<CapturedRequest>>;
  readonly handle: (
    request: HttpClientRequest.HttpClientRequest
  ) => Effect.Effect<Response, HttpClientError.HttpClientError>;
  readonly respondWith: (respond: TestRespond) => Effect.Effect<void>;
};

class WriteTestHttp extends Context.Service<WriteTestHttp, WriteTestHttpShape>()(
  "@beep/m365/test/M365.write.test/WriteTestHttp"
) {}

const decodeJsonText = S.decodeUnknownOption(S.fromJsonString(S.Unknown));
const textDecoder = new TextDecoder();

const requestBody = (request: HttpClientRequest.HttpClientRequest): O.Option<unknown> =>
  request.body._tag === "Uint8Array" ? decodeJsonText(textDecoder.decode(request.body.body)) : O.none();

const requestUrl = (request: HttpClientRequest.HttpClientRequest): string =>
  HttpClientRequest.toUrl(request).pipe(
    O.map((value) => value.toString()),
    O.getOrElse(() => request.url)
  );

const jsonResponse = (body: unknown, status = 200, headers: Readonly<Record<string, string>> = {}): Response =>
  Response.json(body, { headers: { "content-type": "application/json", ...headers }, status });

const transportFailure = (
  request: HttpClientRequest.HttpClientRequest
): Effect.Effect<Response, HttpClientError.HttpClientError> =>
  Effect.fail(
    new HttpClientError.HttpClientError({
      reason: new HttpClientError.TransportError({ request }),
    })
  );

const WriteTestHttpLayer = Layer.effect(
  WriteTestHttp,
  Effect.gen(function* () {
    const capturesRef = yield* Ref.make<ReadonlyArray<CapturedRequest>>([]);
    const respondRef = yield* Ref.make<TestRespond>(() => Effect.succeed(jsonResponse({ value: [] })));

    return WriteTestHttp.of({
      captures: Ref.get(capturesRef),
      handle: Effect.fn("WriteTestHttp.handle")(function* (request) {
        const index = A.length(yield* Ref.get(capturesRef));
        yield* Ref.update(
          capturesRef,
          A.append({
            body: requestBody(request),
            headers: request.headers,
            method: request.method,
            url: requestUrl(request),
          })
        );
        const respond = yield* Ref.get(respondRef);
        return yield* respond(request, index);
      }),
      respondWith: Effect.fn("WriteTestHttp.respondWith")(function* (respond) {
        yield* Ref.set(respondRef, respond);
      }),
    });
  })
);

const TestHttpClientLayer = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const testHttp = yield* WriteTestHttp;
    return HttpClient.make((request) =>
      pipe(
        testHttp.handle(request),
        Effect.map((response) => HttpClientResponse.fromWeb(request, response))
      )
    );
  })
);

const appOnlyConfig = (maxRetries = 0): M365AppOnlyConfigInput =>
  M365AppOnlyConfigInput.make({
    clientId: "client-id",
    credential: M365ClientSecretCredential.make({ clientSecret: Redacted.make("fixture-secret") }),
    maxRetries: S.Natural.make(maxRetries),
    tenantId: "tenant-id",
  });

const withTestTransport = <E>(layer: Layer.Layer<M365, E, M365Auth | HttpClient.HttpClient>) =>
  layer.pipe(
    Layer.provide(M365Auth.layerStatic(Redacted.make(TOKEN))),
    Layer.provide(TestHttpClientLayer),
    Layer.provideMerge(WriteTestHttpLayer)
  );

const appOnlyLayer = (maxRetries = 0) => withTestTransport(M365.makeAppOnlyLayer(appOnlyConfig(maxRetries)));
const delegatedLayer = withTestTransport(
  M365.makeLayer(M365ConfigInput.make({ clientId: "client-id", maxRetries: S.Natural.make(0), tenantId: "common" }))
);

const failureOf = <A>(effect: Effect.Effect<A, M365Error>): Effect.Effect<O.Option<M365Error>> =>
  Effect.exit(effect).pipe(Effect.map(Exit.match({ onFailure: Cause.findErrorOption, onSuccess: O.none })));

const dueDate = LocalDate.make({ year: 2030, month: 1, day: 31 });

const draft = M365EventDraft.make({
  ...m365AllDayWindow(dueDate, "UTC"),
  categories: ["Docket - unverified"],
  isAllDay: true,
  showAs: O.some("tentative"),
  subject: "[UNVERIFIED] Response due",
});

const createRequest = M365CreateEventRequest.make({
  event: draft,
  idempotencyKey: O.some(KEY),
  userId: O.some(MAILBOX),
});

const eventResponse = { categories: ["Docket - unverified"], id: "event-id", transactionId: KEY };

const roundTrip = <Sch extends S.ConstraintCodec<unknown, unknown, never, never>>(
  schema: Sch,
  value: Sch["Type"]
): Sch["Type"] => Result.getOrThrow(S.decodeUnknownResult(schema)(Result.getOrThrow(S.encodeResult(schema)(value))));

const isNamedBody = S.is(S.Struct({ displayName: S.String }));

const DayOffset = S.Int.check(S.isBetween({ maximum: 40_000, minimum: -40_000 }));

describe("@beep/m365 app-only lane and write verbs", () => {
  it("derives the app-only scope and authority from configuration", () => {
    expect(m365AppOnlyScope(GRAPH_BASE_URL)).toBe("https://graph.microsoft.com/.default");
    expect(resolveM365AppOnlyAuthority(appOnlyConfig())).toBe("https://login.microsoftonline.com/tenant-id");
  });

  it.layer(M365Auth.makeAppOnlyLayer(appOnlyConfig()), { timeout: "10 seconds" })((it) => {
    it.effect(
      "builds the app-only token provider from a client-secret credential without any network call",
      Effect.fnUntraced(function* () {
        const auth = yield* M365Auth;

        expect(Effect.isEffect(auth.acquireToken)).toBe(true);
      })
    );
  });

  it.layer(
    M365Auth.makeAppOnlyLayer(
      M365AppOnlyConfigInput.make({
        clientId: "client-id",
        credential: M365CertificateCredential.make({
          privateKey: Redacted.make("fixture-key-material"),
          thumbprintSha256: "AB12CD34",
        }),
        tenantId: "tenant-id",
      })
    ),
    { timeout: "10 seconds" }
  )((it) => {
    it.effect(
      "builds the app-only token provider from a certificate credential without any network call",
      Effect.fnUntraced(function* () {
        const auth = yield* M365Auth;

        expect(Effect.isEffect(auth.acquireToken)).toBe(true);
      })
    );
  });

  it.prop(
    "an all-day window starts on the date and ends exactly one day later",
    [Arbitrary.schema(DayOffset)],
    ([offset]) => {
      const date = addDays(dueDate, offset);
      const window = m365AllDayWindow(date, "UTC");

      expect(window.start.dateTime).toBe(`${date.toISOString()}T00:00:00`);
      expect(window.end.dateTime).toBe(`${addDays(date, 1).toISOString()}T00:00:00`);
      expect(diffInDays(addDays(date, 1), date)).toBe(1);
      expect(window.start.timeZone).toBe(window.end.timeZone);
    },
    { arbitrary: fcRuns(100) }
  );

  it.prop(
    "round-trips write models through their encoded shape",
    [Arbitrary.schema(M365EventPatch), Arbitrary.schema(M365EventDraft), Arbitrary.schema(M365MasterCategoryDraft)],
    ([patch, eventDraft, categoryDraft]) => {
      expect(S.toEquivalence(M365EventPatch)(roundTrip(M365EventPatch, patch), patch)).toBe(true);
      expect(S.toEquivalence(M365EventDraft)(roundTrip(M365EventDraft, eventDraft), eventDraft)).toBe(true);
      expect(
        S.toEquivalence(M365MasterCategoryDraft)(roundTrip(M365MasterCategoryDraft, categoryDraft), categoryDraft)
      ).toBe(true);
    },
    { arbitrary: fcRuns(25) }
  );

  it.layer(appOnlyLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "creates an event with the idempotency key in both places",
      Effect.fnUntraced(function* () {
        const testHttp = yield* WriteTestHttp;
        const m365 = yield* M365;
        yield* testHttp.respondWith(() => Effect.succeed(jsonResponse(eventResponse, 201)));

        const event = yield* m365.createEvent(createRequest);
        const captures = yield* testHttp.captures;
        const capture = A.headNonEmpty(captures as A.NonEmptyReadonlyArray<CapturedRequest>);

        expect(captures).toHaveLength(1);
        expect(event.id).toBe("event-id");
        assertSome(event.transactionId, KEY);
        expect(capture.method).toBe("POST");
        expect(capture.url).toBe(`${MAILBOX_URL}/events`);
        expect(capture.headers.authorization).toBe(`Bearer ${TOKEN}`);
        expect(capture.headers["content-type"]).toBe("application/json");
        assertSome(capture.body, {
          categories: ["Docket - unverified"],
          end: { dateTime: "2030-02-01T00:00:00", timeZone: "UTC" },
          isAllDay: true,
          showAs: "tentative",
          singleValueExtendedProperties: [{ id: M365_IDEMPOTENCY_KEY_PROPERTY_ID, value: KEY }],
          start: { dateTime: "2030-01-31T00:00:00", timeZone: "UTC" },
          subject: "[UNVERIFIED] Response due",
          transactionId: KEY,
        });
      })
    );
  });

  it.layer(appOnlyLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "refuses every /me route before any HTTP call",
      Effect.fnUntraced(function* () {
        const testHttp = yield* WriteTestHttp;
        const m365 = yield* M365;

        const failures = yield* Effect.all([
          failureOf(m365.createEvent(M365CreateEventRequest.make({ event: draft }))),
          failureOf(m365.listMessages(M365ListMessagesRequest.make({}))),
          failureOf(m365.listDrives(M365ListDrivesRequest.make({}))),
          failureOf(
            m365.updateMessageCategories(M365UpdateMessageCategoriesRequest.make({ categories: [], messageId: "m" }))
          ),
        ]);

        for (const failure of failures) {
          assertSome(
            O.map(failure, (error) => error.reason),
            "request encoding"
          );
        }
        expect(yield* testHttp.captures).toHaveLength(0);
      })
    );
  });

  it.layer(delegatedLayer, { timeout: "5 seconds" })((it) => {
    it.effect(
      "keeps /me addressing on the delegated lane",
      Effect.fnUntraced(function* () {
        const testHttp = yield* WriteTestHttp;
        const m365 = yield* M365;

        yield* m365.listMessages(M365ListMessagesRequest.make({}));
        const captures = yield* testHttp.captures;

        expect(A.map(captures, (capture) => capture.url)).toStrictEqual([`${GRAPH_BASE_URL}/me/messages`]);
      })
    );
  });

  it.layer(appOnlyLayer(2), { timeout: "5 seconds" })((it) => {
    it.effect(
      "never replays a create after a transport failure",
      Effect.fnUntraced(function* () {
        const testHttp = yield* WriteTestHttp;
        const m365 = yield* M365;
        yield* testHttp.respondWith(transportFailure);

        const failure = yield* failureOf(m365.createEvent(createRequest));

        assertSome(
          O.map(failure, (error) => error.reason),
          "ambiguous write"
        );
        expect(yield* testHttp.captures).toHaveLength(1);
      })
    );
  });

  it.layer(appOnlyLayer(2), { timeout: "5 seconds" })((it) => {
    it.effect(
      "never replays a create after a 503",
      Effect.fnUntraced(function* () {
        const testHttp = yield* WriteTestHttp;
        const m365 = yield* M365;
        yield* testHttp.respondWith(() => Effect.succeed(jsonResponse({}, 503, { "retry-after": "0" })));

        const failure = yield* failureOf(m365.createEvent(createRequest));

        assertSome(
          O.map(failure, (error) => error.reason),
          "ambiguous write"
        );
        assertSome(
          O.flatMap(failure, (error) => error.status),
          503
        );
        expect(yield* testHttp.captures).toHaveLength(1);
      })
    );
  });

  it.layer(appOnlyLayer(2), { timeout: "5 seconds" })((it) => {
    it.effect(
      "replays a create after an explicit 429 refusal",
      Effect.fnUntraced(function* () {
        const testHttp = yield* WriteTestHttp;
        const m365 = yield* M365;
        yield* testHttp.respondWith((_request, index) =>
          Effect.succeed(index === 0 ? jsonResponse({}, 429, { "retry-after": "0" }) : jsonResponse(eventResponse, 201))
        );

        const event = yield* m365.createEvent(createRequest);

        expect(event.id).toBe("event-id");
        expect(yield* testHttp.captures).toHaveLength(2);
      })
    );
  });

  it.layer(appOnlyLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "patches only the supplied event fields and deletes by id",
      Effect.fnUntraced(function* () {
        const testHttp = yield* WriteTestHttp;
        const m365 = yield* M365;
        yield* testHttp.respondWith((request) =>
          Effect.succeed(
            request.method === "DELETE" ? new Response(null, { status: 204 }) : jsonResponse(eventResponse)
          )
        );

        yield* m365.updateEvent(
          M365UpdateEventRequest.make({
            eventId: "event-id",
            patch: M365EventPatch.make({ categories: O.some(["Docket - verified"]), showAs: O.some("free") }),
            userId: O.some(MAILBOX),
          })
        );
        yield* m365.deleteEvent(M365DeleteEventRequest.make({ eventId: "event-id", userId: O.some(MAILBOX) }));
        const captures = yield* testHttp.captures;

        expect(A.map(captures, (capture) => `${capture.method} ${capture.url}`)).toStrictEqual([
          `PATCH ${MAILBOX_URL}/events/event-id`,
          `DELETE ${MAILBOX_URL}/events/event-id`,
        ]);
        assertSome(
          O.flatMap(A.get(captures, 0), (capture) => capture.body),
          { categories: ["Docket - verified"], showAs: "free" }
        );
        assertNone(O.flatMap(A.get(captures, 1), (capture) => capture.body));
      })
    );
  });

  it.layer(appOnlyLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "finds events by idempotency key and rejects keys that could alter the filter",
      Effect.fnUntraced(function* () {
        const testHttp = yield* WriteTestHttp;
        const m365 = yield* M365;
        yield* testHttp.respondWith(() => Effect.succeed(jsonResponse({ value: [eventResponse] })));

        const found = yield* m365.findEventsByIdempotencyKey(
          M365FindEventsByIdempotencyKeyRequest.make({ idempotencyKey: KEY, userId: O.some(MAILBOX) })
        );
        const rejected = yield* failureOf(
          m365.findEventsByIdempotencyKey({
            idempotencyKey: "x' or 1 eq 1 or '",
            userId: O.some(MAILBOX),
          } as M365FindEventsByIdempotencyKeyRequest)
        );
        const captures = yield* testHttp.captures;
        const url = new URL(A.headNonEmpty(captures as A.NonEmptyReadonlyArray<CapturedRequest>).url);

        expect(found.value).toHaveLength(1);
        expect(captures).toHaveLength(1);
        expect(url.pathname).toBe(`/v1.0/users/${MAILBOX}/events`);
        expect(url.searchParams.get("$filter")).toBe(
          `singleValueExtendedProperties/Any(ep: ep/id eq '${M365_IDEMPOTENCY_KEY_PROPERTY_ID}' and ep/value eq '${KEY}')`
        );
        expect(url.searchParams.get("$expand")).toBe(
          `singleValueExtendedProperties($filter=id eq '${M365_IDEMPOTENCY_KEY_PROPERTY_ID}')`
        );
        assertSome(
          O.map(rejected, (error) => error.reason),
          "request encoding"
        );
      })
    );
  });

  it.layer(appOnlyLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "replaces message categories conditionally on the change key",
      Effect.fnUntraced(function* () {
        const testHttp = yield* WriteTestHttp;
        const m365 = yield* M365;
        yield* testHttp.respondWith((_request, index) =>
          Effect.succeed(
            index === 0
              ? jsonResponse({ categories: ["Docket - entered", "M: fixture"], changeKey: "ck-2", id: "message-id" })
              : jsonResponse({}, 412)
          )
        );
        const request = M365UpdateMessageCategoriesRequest.make({
          categories: ["Docket - entered", "M: fixture"],
          changeKey: O.some("ck-1"),
          messageId: "message-id",
          userId: O.some(MAILBOX),
        });

        const message = yield* m365.updateMessageCategories(request);
        const stale = yield* failureOf(m365.updateMessageCategories(request));
        const captures = yield* testHttp.captures;
        const capture = A.headNonEmpty(captures as A.NonEmptyReadonlyArray<CapturedRequest>);

        assertSome(message.categories, ["Docket - entered", "M: fixture"]);
        assertSome(message.changeKey, "ck-2");
        expect(capture.method).toBe("PATCH");
        expect(capture.url).toBe(`${MAILBOX_URL}/messages/message-id`);
        expect(capture.headers["if-match"]).toBe('W/"ck-1"');
        assertSome(capture.body, { categories: ["Docket - entered", "M: fixture"] });
        assertSome(
          O.map(stale, (error) => error.reason),
          "response status"
        );
        assertSome(
          O.flatMap(stale, (error) => error.status),
          412
        );
      })
    );
  });

  it.layer(appOnlyLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "ensures master categories without touching existing ones",
      Effect.fnUntraced(function* () {
        const testHttp = yield* WriteTestHttp;
        const m365 = yield* M365;
        yield* testHttp.respondWith((request) => {
          if (request.method === "GET") {
            return Effect.succeed(jsonResponse({ value: [{ color: "preset3", displayName: "docket - UNVERIFIED" }] }));
          }
          const name = pipe(
            requestBody(request),
            O.filter(isNamedBody),
            O.map((body) => body.displayName),
            O.getOrElse(() => "")
          );
          return Effect.succeed(
            Str.endsWith("raced")(name)
              ? jsonResponse({}, 409)
              : jsonResponse({ color: "preset1", displayName: name, id: "new-id" }, 201)
          );
        });

        const result = yield* m365.ensureMasterCategories(
          M365EnsureMasterCategoriesRequest.make({
            categories: [
              M365MasterCategoryDraft.make({ displayName: "Docket - unverified" }),
              M365MasterCategoryDraft.make({ color: "preset1", displayName: "Docket - reminder" }),
              M365MasterCategoryDraft.make({ displayName: "Docket - raced" }),
            ],
            userId: O.some(MAILBOX),
          })
        );
        const captures = yield* testHttp.captures;

        expect(A.map(result.created, (category) => category.displayName)).toStrictEqual(["Docket - reminder"]);
        expect(result.existing).toStrictEqual(["Docket - unverified", "Docket - raced"]);
        expect(A.map(captures, (capture) => `${capture.method} ${capture.url}`)).toStrictEqual([
          `GET ${MAILBOX_URL}/outlook/masterCategories`,
          `POST ${MAILBOX_URL}/outlook/masterCategories`,
          `POST ${MAILBOX_URL}/outlook/masterCategories`,
        ]);
        assertSome(
          O.flatMap(A.get(captures, 1), (capture) => capture.body),
          { color: "preset1", displayName: "Docket - reminder" }
        );
      })
    );
  });

  it.layer(appOnlyLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "pages messages in order and follows only trusted next links",
      Effect.fnUntraced(function* () {
        const testHttp = yield* WriteTestHttp;
        const m365 = yield* M365;
        const nextLink = `${MAILBOX_URL}/messages?$skiptoken=opaque`;
        yield* testHttp.respondWith((_request, index) =>
          Effect.succeed(
            index === 0
              ? jsonResponse({
                  "@odata.nextLink": nextLink,
                  value: [{ categories: ["P: USPTO"], id: "m1", parentFolderId: "inbox-id" }],
                })
              : jsonResponse({ value: [{ id: "m2" }] })
          )
        );

        const first = yield* m365.listMessages(
          M365ListMessagesRequest.make({
            bodyContentType: O.some("text"),
            filter: O.some("receivedDateTime ge 2026-07-01T00:00:00Z"),
            orderby: O.some("receivedDateTime asc"),
            userId: O.some(MAILBOX),
          })
        );
        const second = yield* m365.listMessages(
          M365ListMessagesRequest.make({ nextLink: first["@odata.nextLink"], userId: O.some(MAILBOX) })
        );
        const untrusted = yield* failureOf(
          m365.listMessages(
            M365ListMessagesRequest.make({
              nextLink: O.some("https://graph.example.test/v1.0/users/x/messages"),
              userId: O.some(MAILBOX),
            })
          )
        );
        const captures = yield* testHttp.captures;
        const firstUrl = new URL(A.headNonEmpty(captures as A.NonEmptyReadonlyArray<CapturedRequest>).url);

        expect(captures).toHaveLength(2);
        expect(firstUrl.searchParams.get("$orderby")).toBe("receivedDateTime asc");
        expect(firstUrl.searchParams.get("$filter")).toBe("receivedDateTime ge 2026-07-01T00:00:00Z");
        expect(A.map(captures, (capture) => capture.headers.prefer)).toStrictEqual([
          'outlook.body-content-type="text"',
          undefined,
        ]);
        assertSome(
          O.map(A.get(captures, 1), (capture) => capture.url),
          nextLink
        );
        assertSome(
          O.flatMap(A.head(first.value), (message) => message.parentFolderId),
          "inbox-id"
        );
        assertSome(
          O.flatMap(A.head(first.value), (message) => message.categories),
          ["P: USPTO"]
        );
        expect(A.map(second.value, (message) => message.id)).toStrictEqual(["m2"]);
        assertSome(
          O.map(untrusted, (error) => error.reason),
          "request encoding"
        );
      })
    );
  });

  it.layer(appOnlyLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "lists attachment metadata without bytes and downloads one attachment signed",
      Effect.fnUntraced(function* () {
        const testHttp = yield* WriteTestHttp;
        const m365 = yield* M365;
        yield* testHttp.respondWith((_request, index) =>
          Effect.succeed(
            index === 0
              ? jsonResponse({
                  value: [
                    {
                      "@odata.type": "#microsoft.graph.fileAttachment",
                      contentType: "application/pdf",
                      id: "attachment-id",
                      isInline: false,
                      name: "fixture.pdf",
                      size: 3,
                    },
                  ],
                })
              : new Response(new Uint8Array([1, 2, 3]), { status: 200 })
          )
        );

        const attachments = yield* m365.listMessageAttachments(
          M365ListMessageAttachmentsRequest.make({ messageId: "message-id", userId: O.some(MAILBOX) })
        );
        const content = yield* m365.downloadMessageAttachment(
          M365DownloadMessageAttachmentRequest.make({
            attachmentId: "attachment-id",
            messageId: "message-id",
            userId: O.some(MAILBOX),
          })
        );
        const captures = yield* testHttp.captures;
        const listUrl = new URL(A.headNonEmpty(captures as A.NonEmptyReadonlyArray<CapturedRequest>).url);

        assertSome(
          O.flatMap(A.head(attachments.value), (attachment) => attachment["@odata.type"]),
          "#microsoft.graph.fileAttachment"
        );
        expect(listUrl.searchParams.get("$select")).toBe("id,name,contentType,size,isInline,lastModifiedDateTime");
        expect(content.bytes).toStrictEqual(new Uint8Array([1, 2, 3]));
        assertSome(
          O.map(A.get(captures, 1), (capture) => capture.url),
          `${MAILBOX_URL}/messages/message-id/attachments/attachment-id/$value`
        );
        assertSome(
          O.map(A.get(captures, 1), (capture) => capture.headers.authorization),
          `Bearer ${TOKEN}`
        );
      })
    );
  });

  it.layer(appOnlyLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "reads a mail folder by well-known name and refuses a name that could change the path",
      Effect.fnUntraced(function* () {
        const testHttp = yield* WriteTestHttp;
        const m365 = yield* M365;
        yield* testHttp.respondWith(() =>
          Effect.succeed(jsonResponse({ childFolderCount: 0, displayName: "Fixture folder", id: "folder-id" }))
        );

        const folder = yield* m365.getMailFolder(
          M365GetMailFolderRequest.make({ folder: "deleteditems", userId: O.some(MAILBOX) })
        );
        const rejected = yield* failureOf(
          m365.getMailFolder({ folder: "inbox/childFolders", userId: O.some(MAILBOX) } as M365GetMailFolderRequest)
        );
        const withoutMailbox = yield* failureOf(
          m365.getMailFolder(M365GetMailFolderRequest.make({ folder: "junkemail" }))
        );
        const captures = yield* testHttp.captures;

        expect(folder.id).toBe("folder-id");
        assertSome(folder.displayName, "Fixture folder");
        expect(A.map(captures, (capture) => `${capture.method} ${capture.url}`)).toStrictEqual([
          `GET ${MAILBOX_URL}/mailFolders/deleteditems`,
        ]);
        assertSome(
          O.map(rejected, (error) => error.reason),
          "request encoding"
        );
        assertSome(
          O.map(withoutMailbox, (error) => error.reason),
          "request encoding"
        );
      })
    );
  });
});
