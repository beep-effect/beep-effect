/**
 * Graph mailbox and calendar adapter proofs over a fake HTTP transport.
 *
 * Every fixture is synthetic: invented ids, `*.invalid` hosts and placeholder
 * text. No real mail, sender, tenant, matter or client appears here.
 */
import { DocketCategory } from "@beep/law-practice-domain/values/DocketDeadline";
import { DocketGraphConfig, makeDocketGraphLayer, withDocketCategory } from "@beep/law-practice-server/DocketIntake";
import {
  DocketCalendar,
  DocketCalendarEntry,
  DocketMailbox,
  DocketMessage,
} from "@beep/law-practice-use-cases/DocketIntake";
import {
  M365,
  M365_IDEMPOTENCY_KEY_PROPERTY_ID,
  M365AppOnlyConfigInput,
  M365Auth,
  M365ClientSecretCredential,
} from "@beep/m365";
import { LocalDate } from "@beep/schema/LocalDate";
import { it } from "@beep/test-runner";
import { fcRuns } from "@beep/test-utils";
import { describe, expect } from "@effect/vitest";
import { assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { Cause, Context, DateTime, Effect, Exit, Layer, pipe, Redacted, Ref } from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientError from "effect/http/HttpClientError";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { DocketIntakeError } from "@beep/law-practice-use-cases/DocketIntake";

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const MAILBOX = "docket@fixture.invalid";
const MAILBOX_URL = `${GRAPH_BASE_URL}/users/${MAILBOX}`;
const KEY = "docket:0f3a9c2b7d11";
const INITIAL_SINCE = "2030-01-01T00:00:00.000Z";

type CapturedRequest = {
  readonly body: O.Option<unknown>;
  readonly headers: Readonly<Record<string, string>>;
  readonly method: string;
  readonly url: string;
};

type TestRespond = (
  capture: CapturedRequest,
  index: number
) => Effect.Effect<Response, HttpClientError.HttpClientError>;

type GraphTestHttpShape = {
  /** Requests made after the layer was built (the master-category setup is not included). */
  readonly calls: Effect.Effect<ReadonlyArray<CapturedRequest>>;
  readonly handle: (
    request: HttpClientRequest.HttpClientRequest
  ) => Effect.Effect<Response, HttpClientError.HttpClientError>;
  readonly respondWith: (respond: TestRespond) => Effect.Effect<void>;
  readonly setup: Effect.Effect<ReadonlyArray<CapturedRequest>>;
};

class GraphTestHttp extends Context.Service<GraphTestHttp, GraphTestHttpShape>()(
  "@beep/law-practice-server/test/DocketIntake.graph.test/GraphTestHttp"
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

const jsonResponse = (body: unknown, status = 200): Response =>
  Response.json(body, { headers: { "content-type": "application/json" }, status });

const isSetup = (capture: CapturedRequest): boolean => Str.includes("/outlook/masterCategories")(capture.url);

const DisplayName = S.Struct({ displayName: S.String });
const displayNameOf = (capture: CapturedRequest): string =>
  pipe(
    capture.body,
    O.flatMap(S.decodeUnknownOption(DisplayName)),
    O.map((body) => body.displayName),
    O.getOrElse(() => "")
  );

// The mailbox starts with no docket categories, so building the layer creates all six.
const respondToSetup = (capture: CapturedRequest): Response =>
  capture.method === "GET"
    ? jsonResponse({ value: [] })
    : jsonResponse({ color: "none", displayName: displayNameOf(capture), id: "category-id" }, 201);

const GraphTestHttpLayer = Layer.effect(
  GraphTestHttp,
  Effect.gen(function* () {
    const capturesRef = yield* Ref.make<ReadonlyArray<CapturedRequest>>([]);
    const respondRef = yield* Ref.make<TestRespond>(() => Effect.succeed(jsonResponse({ value: [] })));
    const calls = Ref.get(capturesRef).pipe(Effect.map(A.filter((capture) => !isSetup(capture))));

    return GraphTestHttp.of({
      calls,
      handle: Effect.fn("GraphTestHttp.handle")(function* (request) {
        const capture: CapturedRequest = {
          body: requestBody(request),
          headers: request.headers,
          method: request.method,
          url: requestUrl(request),
        };
        const index = A.length(yield* calls);
        yield* Ref.update(capturesRef, A.append(capture));
        if (isSetup(capture)) {
          return respondToSetup(capture);
        }
        const respond = yield* Ref.get(respondRef);
        return yield* respond(capture, index);
      }),
      respondWith: Effect.fn("GraphTestHttp.respondWith")(function* (respond) {
        yield* Ref.set(respondRef, respond);
      }),
      setup: Ref.get(capturesRef).pipe(Effect.map(A.filter(isSetup))),
    });
  })
);

const TestHttpClientLayer = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const testHttp = yield* GraphTestHttp;
    return HttpClient.make((request) =>
      pipe(
        testHttp.handle(request),
        Effect.map((response) => HttpClientResponse.fromWeb(request, response))
      )
    );
  })
);

const M365TestLayer = M365.makeAppOnlyLayer(
  M365AppOnlyConfigInput.make({
    clientId: "client-id",
    credential: M365ClientSecretCredential.make({ clientSecret: Redacted.make("fixture-secret") }),
    maxRetries: S.Natural.make(0),
    tenantId: "tenant-id",
  })
).pipe(
  Layer.provide(M365Auth.layerStatic(Redacted.make("fixture-token"))),
  Layer.provide(TestHttpClientLayer),
  Layer.provideMerge(GraphTestHttpLayer)
);

const graphConfig = (overrides: Partial<ConstructorParameters<typeof DocketGraphConfig>[0]> = {}) =>
  DocketGraphConfig.make({
    initialSince: INITIAL_SINCE,
    mailbox: MAILBOX,
    timeZone: DateTime.zoneMakeNamedUnsafe("America/Chicago"),
    ...overrides,
  });

const graphLayer = (overrides: Partial<ConstructorParameters<typeof DocketGraphConfig>[0]> = {}) =>
  makeDocketGraphLayer(graphConfig(overrides)).pipe(Layer.provideMerge(M365TestLayer));

const failureOf = <A, R>(
  effect: Effect.Effect<A, DocketIntakeError, R>
): Effect.Effect<O.Option<DocketIntakeError>, never, R> =>
  Effect.exit(effect).pipe(Effect.map(Exit.match({ onFailure: Cause.findErrorOption, onSuccess: O.none })));

const succeed = (response: Response) => Effect.succeed(response);

const transportFailure = (capture: CapturedRequest): Effect.Effect<Response, HttpClientError.HttpClientError> =>
  Effect.fail(
    new HttpClientError.HttpClientError({
      reason: new HttpClientError.TransportError({ request: HttpClientRequest.get(capture.url) }),
    })
  );

const describeCall = (capture: CapturedRequest): string => `${capture.method} ${capture.url}`;

const filterOf = (capture: CapturedRequest): O.Option<string> =>
  O.fromNullishOr(new URL(capture.url).searchParams.get("$filter"));

const message = (id: string): DocketMessage =>
  DocketMessage.make({
    bodyText: "Synthetic fixture body.",
    messageId: id,
    receivedAt: "2030-01-09T10:00:00.000Z",
    receivedDate: LocalDate.make({ year: 2030, month: 1, day: 9 }),
  });

const fromOther = { emailAddress: { address: "sender@fixture.invalid" } };
const fromSelf = { emailAddress: { address: "DOCKET@fixture.invalid" } };

const NEXT_LINK = `${MAILBOX_URL}/messages?$skiptoken=opaque`;

const firstPage = {
  "@odata.nextLink": NEXT_LINK,
  value: [
    {
      body: { content: "Synthetic fixture body one.", contentType: "text" },
      from: fromOther,
      id: "m1",
      internetMessageId: "<m1@fixture.invalid>",
      receivedDateTime: "2030-01-10T03:30:00Z",
      subject: "Fixture subject",
      webLink: "https://outlook.fixture.invalid/mail/m1",
    },
    { from: fromOther, id: "draft-1", isDraft: true, receivedDateTime: "2030-01-10T04:00:00Z" },
    { from: fromSelf, id: "sent-1", receivedDateTime: "2030-01-10T05:00:00Z" },
  ],
};

const secondPage = {
  value: [
    { from: fromOther, id: "m2", receivedDateTime: "2030-01-10T12:00:00Z" },
    { from: fromOther, id: "undated-1" },
  ],
};

const attachment = (id: string, overrides: Readonly<Record<string, unknown>> = {}) => ({
  "@odata.type": "#microsoft.graph.fileAttachment",
  contentType: "application/pdf",
  id,
  isInline: false,
  name: `${id}.pdf`,
  size: 3,
  ...overrides,
});

const attachments = {
  value: [
    attachment("inline-pdf", { isInline: true }),
    attachment("image", { contentType: "image/png", name: "image.png" }),
    attachment("oversize-pdf", { size: 1001 }),
    attachment("item", { "@odata.type": "#microsoft.graph.itemAttachment" }),
    attachment("pdf-1"),
    attachment("pdf-by-name", { contentType: "application/octet-stream", name: "FIXTURE.PDF" }),
    attachment("pdf-3"),
  ],
};

const calendarEntry = (tentative: boolean) =>
  DocketCalendarEntry.make({
    bodyText: "Synthetic fixture entry body.",
    category: tentative ? "Docket - unverified" : "Docket - reminder",
    date: LocalDate.make({ year: 2030, month: 4, day: 8 }),
    key: KEY,
    kind: tentative ? "due" : "reminder",
    subject: "[UNVERIFIED] Fixture response due",
    tentative,
  });

const decodeGraphConfig = S.decodeUnknownOption(DocketGraphConfig);

const CategoryNames = S.Array(S.String.check(S.isMaxLength(24)));

const decodeColorBody = S.decodeUnknownOption(S.Struct({ color: S.String }));
const decodeShowAsBody = S.decodeUnknownOption(S.Struct({ showAs: S.String }));

describe("@beep/law-practice-server DocketIntake Graph adapters", () => {
  it.prop(
    "adds a docket category once, after every existing category, and never reorders or drops one",
    [Arbitrary.schema(CategoryNames), Arbitrary.schema(DocketCategory)],
    ([existing, category]) => {
      const once = withDocketCategory(existing, category);
      const twice = withDocketCategory(once, category);

      expect(twice).toStrictEqual(once);
      expect(A.take(once, A.length(existing))).toStrictEqual(existing);
      assertTrue(A.contains(once, category));
      assertTrue(A.length(once) - A.length(existing) <= 1);
    },
    { arbitrary: fcRuns(200) }
  );

  it.layer(graphLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "creates the six docket master categories, each with its own color, when the layer is built",
      Effect.fnUntraced(function* () {
        const testHttp = yield* GraphTestHttp;
        const setup = yield* testHttp.setup;
        const created = A.filter(setup, (capture) => capture.method === "POST");
        const colors = A.getSomes(
          A.map(created, (capture) => O.map(O.flatMap(capture.body, decodeColorBody), (body) => body.color))
        );

        expect(A.map(setup, (capture) => capture.method)).toStrictEqual(["GET", ...A.replicate("POST", 6)]);
        expect(A.map(created, displayNameOf)).toStrictEqual([...DocketCategory.literals]);
        expect(A.dedupe(colors)).toHaveLength(6);
      })
    );
  });

  it.layer(graphLayer({ pageSize: 2 }), { timeout: "5 seconds" })((it) => {
    it.effect(
      "lists every page from the floor, drops drafts, own mail and undated mail, and converts the receipt day",
      Effect.fnUntraced(function* () {
        const testHttp = yield* GraphTestHttp;
        const mailbox = yield* DocketMailbox;
        yield* testHttp.respondWith((_capture, index) =>
          succeed(jsonResponse(index % 2 === 0 ? firstPage : secondPage))
        );

        const messages = yield* mailbox.receivedSince(O.none());
        yield* mailbox.receivedSince(O.some("2030-01-09T08:00:00.000Z"));
        const calls = yield* testHttp.calls;
        const first = A.get(calls, 0);
        const firstUrl = O.map(first, (capture) => new URL(capture.url));

        expect(A.map(messages, (received) => received.messageId)).toStrictEqual(["m1", "m2"]);
        // 03:30 UTC on the 10th is still the evening of the 9th in Chicago.
        expect(A.map(messages, (received) => received.receivedDate.toISOString())).toStrictEqual([
          "2030-01-09",
          "2030-01-10",
        ]);
        expect(A.map(messages, (received) => received.receivedAt)).toStrictEqual([
          "2030-01-10T03:30:00.000Z",
          "2030-01-10T12:00:00.000Z",
        ]);
        assertSome(
          O.flatMap(A.head(messages), (received) => received.internetMessageId),
          "<m1@fixture.invalid>"
        );
        assertSome(
          O.map(A.head(messages), (received) => received.bodyText),
          "Synthetic fixture body one."
        );
        assertNone(O.flatMap(A.get(messages, 1), (received) => received.internetMessageId));

        expect(calls).toHaveLength(4);
        assertSome(
          O.map(firstUrl, (url) => url.pathname),
          `/v1.0/users/${MAILBOX}/messages`
        );
        assertSome(O.flatMap(first, filterOf), `receivedDateTime ge ${INITIAL_SINCE}`);
        assertSome(
          O.map(firstUrl, (url) => url.searchParams.get("$orderby")),
          "receivedDateTime asc"
        );
        assertSome(
          O.map(firstUrl, (url) => url.searchParams.get("$top")),
          "2"
        );
        assertSome(
          O.map(A.get(calls, 1), (capture) => capture.url),
          NEXT_LINK
        );
        assertSome(O.flatMap(A.get(calls, 2), filterOf), "receivedDateTime ge 2030-01-09T08:00:00.000Z");
        expect(A.map(calls, (capture) => capture.headers.prefer)).toStrictEqual(
          A.replicate('outlook.body-content-type="text"', 4)
        );
      })
    );
  });

  it.layer(graphLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "marks a message entered by adding one category and keeping every category it does not own",
      Effect.fnUntraced(function* () {
        const testHttp = yield* GraphTestHttp;
        const mailbox = yield* DocketMailbox;
        yield* testHttp.respondWith((capture) =>
          succeed(
            jsonResponse({
              categories:
                capture.method === "GET"
                  ? ["M: FIX-0001", "P: fixture-party"]
                  : ["M: FIX-0001", "P: fixture-party", "Docket - entered"],
              changeKey: "ck-1",
              id: "m1",
            })
          )
        );

        yield* mailbox.markEntered(message("m1"));
        const calls = yield* testHttp.calls;
        const patch = A.get(calls, 1);

        expect(A.map(calls, describeCall)).toStrictEqual([
          `GET ${MAILBOX_URL}/messages/m1`,
          `PATCH ${MAILBOX_URL}/messages/m1`,
        ]);
        assertSome(
          O.flatMap(patch, (capture) => capture.body),
          {
            categories: ["M: FIX-0001", "P: fixture-party", "Docket - entered"],
          }
        );
        assertSome(
          O.map(patch, (capture) => capture.headers["if-match"]),
          'W/"ck-1"'
        );
      })
    );
  });

  it.layer(graphLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "writes nothing when the message already carries the entered category",
      Effect.fnUntraced(function* () {
        const testHttp = yield* GraphTestHttp;
        const mailbox = yield* DocketMailbox;
        yield* testHttp.respondWith(() =>
          succeed(jsonResponse({ categories: ["Docket - entered", "M: FIX-0001"], changeKey: "ck-1", id: "m1" }))
        );

        yield* mailbox.markEntered(message("m1"));

        expect(A.map(yield* testHttp.calls, (capture) => capture.method)).toStrictEqual(["GET"]);
      })
    );
  });

  it.layer(graphLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "re-reads the message once and retries when the conditional write is stale",
      Effect.fnUntraced(function* () {
        const testHttp = yield* GraphTestHttp;
        const mailbox = yield* DocketMailbox;
        yield* testHttp.respondWith((capture, index) =>
          succeed(
            capture.method === "PATCH" && index === 1
              ? jsonResponse({}, 412)
              : jsonResponse({ categories: ["M: FIX-0001"], changeKey: index === 0 ? "ck-1" : "ck-2", id: "m1" })
          )
        );

        yield* mailbox.markEntered(message("m1"));
        const calls = yield* testHttp.calls;

        expect(A.map(calls, (capture) => capture.method)).toStrictEqual(["GET", "PATCH", "GET", "PATCH"]);
        expect(A.map(calls, (capture) => capture.headers["if-match"])).toStrictEqual([
          undefined,
          'W/"ck-1"',
          undefined,
          'W/"ck-2"',
        ]);
      })
    );
  });

  it.layer(graphLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "gives up after one retry of a stale write and reports the mailbox stage",
      Effect.fnUntraced(function* () {
        const testHttp = yield* GraphTestHttp;
        const mailbox = yield* DocketMailbox;
        yield* testHttp.respondWith((capture) =>
          succeed(
            capture.method === "PATCH"
              ? jsonResponse({}, 412)
              : jsonResponse({ categories: [], changeKey: "ck-1", id: "m1" })
          )
        );

        const failure = yield* failureOf(mailbox.markEntered(message("m1")));

        expect(yield* testHttp.calls).toHaveLength(4);
        assertSome(
          O.map(failure, (error) => [error.stage, error.cause, error.ambiguousWrite]),
          ["mailbox", "response status", false]
        );
      })
    );
  });

  it.layer(graphLayer({ maxDocumentBytes: 1000, maxDocuments: 2 }), { timeout: "5 seconds" })((it) => {
    it.effect(
      "hands the reviewer only non-inline PDF file attachments within the size and count caps",
      Effect.fnUntraced(function* () {
        const testHttp = yield* GraphTestHttp;
        const mailbox = yield* DocketMailbox;
        yield* testHttp.respondWith((_capture, index) =>
          succeed(index === 0 ? jsonResponse(attachments) : new Response(new Uint8Array([1, 2, 3]), { status: 200 }))
        );

        const documents = yield* mailbox.sourceDocuments(message("m1"));
        const calls = yield* testHttp.calls;

        expect(A.map(A.drop(calls, 1), (capture) => capture.url)).toStrictEqual([
          `${MAILBOX_URL}/messages/m1/attachments/pdf-1/$value`,
          `${MAILBOX_URL}/messages/m1/attachments/pdf-by-name/$value`,
        ]);
        expect(A.map(documents, (document) => document.contentType)).toStrictEqual([
          "application/pdf",
          "application/pdf",
        ]);
        expect(A.map(documents, (document) => document.bytes)).toStrictEqual([
          new Uint8Array([1, 2, 3]),
          new Uint8Array([1, 2, 3]),
        ]);
      })
    );
  });

  it.layer(graphLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "creates an all-day entry in the practice time zone with its category, status and idempotency key",
      Effect.fnUntraced(function* () {
        const testHttp = yield* GraphTestHttp;
        const calendar = yield* DocketCalendar;
        yield* testHttp.respondWith((capture) =>
          succeed(
            capture.method === "POST"
              ? jsonResponse({ id: "event-1", webLink: "https://outlook.fixture.invalid/calendar/event-1" }, 201)
              : jsonResponse({ value: [{ id: "event-1" }, { id: "event-2" }] })
          )
        );

        const written = yield* calendar.create(calendarEntry(true));
        yield* calendar.create(calendarEntry(false));
        const found = yield* calendar.findByKey(KEY);
        const calls = yield* testHttp.calls;

        expect(written.eventId).toBe("event-1");
        assertSome(written.webLink, "https://outlook.fixture.invalid/calendar/event-1");
        assertSome(
          O.map(found, (entry) => entry.eventId),
          "event-1"
        );
        assertSome(O.map(A.get(calls, 0), describeCall), `POST ${MAILBOX_URL}/events`);
        assertSome(
          O.flatMap(A.get(calls, 0), (capture) => capture.body),
          {
            body: { content: "Synthetic fixture entry body.", contentType: "text" },
            categories: ["Docket - unverified"],
            end: { dateTime: "2030-04-09T00:00:00", timeZone: "America/Chicago" },
            isAllDay: true,
            isReminderOn: true,
            reminderMinutesBeforeStart: 0,
            showAs: "tentative",
            singleValueExtendedProperties: [{ id: M365_IDEMPOTENCY_KEY_PROPERTY_ID, value: KEY }],
            start: { dateTime: "2030-04-08T00:00:00", timeZone: "America/Chicago" },
            subject: "[UNVERIFIED] Fixture response due",
            transactionId: KEY,
          }
        );
        assertSome(
          O.flatMap(A.get(calls, 1), (capture) => O.flatMap(capture.body, decodeShowAsBody)),
          { showAs: "free" }
        );
        assertTrue(O.exists(O.flatMap(A.get(calls, 2), filterOf), Str.includes(KEY)));
      })
    );
  });

  it.layer(graphLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "reports a create whose outcome is unknown as an ambiguous write, and finds nothing for an unused key",
      Effect.fnUntraced(function* () {
        const testHttp = yield* GraphTestHttp;
        const calendar = yield* DocketCalendar;
        yield* testHttp.respondWith((capture) =>
          capture.method === "POST" ? transportFailure(capture) : succeed(jsonResponse({ value: [] }))
        );

        const failure = yield* failureOf(calendar.create(calendarEntry(true)));
        const found = yield* calendar.findByKey(KEY);

        assertSome(
          O.map(failure, (error) => [error.stage, error.cause, error.ambiguousWrite]),
          ["calendar", "ambiguous write", true]
        );
        assertNone(found);
        expect(A.filter(yield* testHttp.calls, (capture) => capture.method === "POST")).toHaveLength(1);
      })
    );
  });

  it.layer(graphLayer(), { timeout: "5 seconds" })((it) => {
    it.effect(
      "refuses to report an entry as written when the created event comes back without an id",
      Effect.fnUntraced(function* () {
        const testHttp = yield* GraphTestHttp;
        const calendar = yield* DocketCalendar;
        yield* testHttp.respondWith((capture) =>
          succeed(capture.method === "POST" ? jsonResponse({ id: "" }, 201) : jsonResponse({ value: [{ id: "" }] }))
        );

        const failure = yield* failureOf(calendar.create(calendarEntry(true)));
        const found = yield* calendar.findByKey(KEY);

        assertSome(
          O.map(failure, (error) => [error.stage, error.cause, error.ambiguousWrite]),
          ["calendar", "event-without-id", false]
        );
        assertNone(found);
      })
    );
  });

  it("cannot be configured with a time zone it cannot resolve", () => {
    const encoded = { initialSince: INITIAL_SINCE, mailbox: MAILBOX };

    assertNone(decodeGraphConfig({ ...encoded, timeZone: "Fixture/Nowhere" }));
    assertNone(decodeGraphConfig(encoded));
    assertSome(
      O.map(decodeGraphConfig({ ...encoded, timeZone: "America/Chicago" }), (config) => [
        DateTime.zoneToString(config.timeZone),
        config.pageSize,
        config.maxDocuments,
        config.maxDocumentBytes,
      ]),
      ["America/Chicago", 50, 3, 15_000_000]
    );
  });
});
