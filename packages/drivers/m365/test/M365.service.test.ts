import {
  GraphDrive,
  GraphDriveItem,
  GraphDriveItemVersion,
  GraphEvent,
  GraphFolder,
  GraphListItem,
  GraphMessage,
  GraphQuota,
  GraphSite,
  M365,
  M365Auth,
  M365ConfigInput,
  M365DeltaDriveItemsRequest,
  M365DownloadDriveItemContentRequest,
  M365DownloadedContent,
  M365DriveItemDownload,
  M365Error,
  M365GetEventRequest,
  M365GetListItemRequest,
  M365GetMessageRequest,
  M365GetSiteRequest,
  M365ListDriveItemVersionsRequest,
  M365ListDrivesRequest,
  M365ListEventsRequest,
  M365ListMessagesRequest,
  M365ListSitesRequest,
  M365SkippedEncryptedItem,
} from "@beep/m365";
import { NonNegativeInt, PosInt } from "@beep/schema";
import { HttpStatus } from "@beep/schema/HttpStatus";
import { fcRuns } from "@beep/test-utils";
import { describe, expect, it, layer } from "@effect/vitest";
import { Cause, Context, Duration, Effect, Exit, Fiber, Layer, pipe, Redacted, Ref, Result } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { FastCheck as fc, TestClock } from "effect/testing";
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

type M365TestHttpShape = {
  readonly captures: Effect.Effect<ReadonlyArray<CapturedRequest>>;
  readonly handle: TestRespond;
  readonly respondWith: (respond: TestRespond) => Effect.Effect<void>;
};

class M365TestHttp extends Context.Service<M365TestHttp, M365TestHttpShape>()(
  "@beep/m365/test/M365.service.test/M365TestHttp"
) {}

const GRAPH_BASE_URL = "https://graph.microsoft.com/v1.0";
const TOKEN = "m365-access-token";
const SITE_ID = "contoso.sharepoint.com,site-guid,web-guid";
const DRIVE_ID = "b!drive";
const ITEM_ID = "01ABC";
const DOWNLOAD_URL = "https://download.example.test/memo.docx";
const METADATA_URL = `${GRAPH_BASE_URL}/drives/${DRIVE_ID}/items/${ITEM_ID}?$select=id%2Cname%2Csize%2Cfile%2Cfolder%2C%40microsoft.graph.downloadUrl`;
const M365ConfigInputArbitrary = S.toArbitrary(M365ConfigInput);
const M365ErrorArbitrary = S.toArbitrary(M365Error);
const GraphDriveItemArbitrary = S.toArbitrary(GraphDriveItem);
const M365ListMessagesRequestArbitrary = S.toArbitrary(M365ListMessagesRequest);
const M365DriveItemDownloadArbitrary = S.toArbitrary(M365DriveItemDownload);
const sameM365Error = S.toEquivalence(M365Error);
const sameGraphDriveItem = S.toEquivalence(GraphDriveItem);
const sameM365ListMessagesRequest = S.toEquivalence(M365ListMessagesRequest);
const sameM365DriveItemDownload = S.toEquivalence(M365DriveItemDownload);

const expectEncodedRoundTripStable = <Sch extends S.ConstraintCodec<unknown, unknown, never, never>>(
  schema: Sch,
  value: Sch["Type"]
): Sch["Type"] => {
  const encoded = Result.getOrThrow(S.encodeResult(schema)(value));
  const decoded = Result.getOrThrow(S.decodeUnknownResult(schema)(encoded));

  expect(Result.getOrThrow(S.encodeResult(schema)(decoded))).toStrictEqual(encoded);
  return decoded;
};

const requestUrl = (request: HttpClientRequest.HttpClientRequest): string =>
  HttpClientRequest.toUrl(request).pipe(
    O.map((value) => value.toString()),
    O.getOrElse(() => request.url)
  );

const makeJsonResponse = (body: unknown, status = 200, headers: Readonly<Record<string, string>> = {}): Response =>
  Response.json(body, {
    headers: {
      "content-type": "application/json",
      ...headers,
    },
    status,
  });

const makeBytesResponse = (bytes: Uint8Array, status = 200): Response => {
  const body = new ArrayBuffer(bytes.byteLength);
  const view = new Uint8Array(body);
  view.set(bytes);
  return new Response(body, {
    headers: {
      "content-type": "application/octet-stream",
    },
    status,
  });
};

const defaultRespond: TestRespond = () => Effect.succeed(makeJsonResponse({ value: [] }));

const M365TestHttpLayer = Layer.effect(
  M365TestHttp,
  Effect.gen(function* () {
    const capturesRef = yield* Ref.make<ReadonlyArray<CapturedRequest>>([]);
    const respondRef = yield* Ref.make<TestRespond>(defaultRespond);
    const recordCapture = (request: HttpClientRequest.HttpClientRequest): CapturedRequest => ({
      headers: request.headers,
      method: request.method,
      url: requestUrl(request),
    });

    return M365TestHttp.of({
      captures: Ref.get(capturesRef),
      handle: Effect.fn("M365TestHttp.handle")(function* (request) {
        yield* Ref.update(capturesRef, A.append(recordCapture(request)));

        const respond = yield* Ref.get(respondRef);
        return yield* respond(request);
      }),
      respondWith: Effect.fn("M365TestHttp.respondWith")(function* (respond) {
        yield* Ref.set(respondRef, respond);
      }),
    });
  })
);

const TestHttpClientLayer = Layer.effect(
  HttpClient.HttpClient,
  Effect.gen(function* () {
    const testHttp = yield* M365TestHttp;

    return HttpClient.make((request) =>
      pipe(
        testHttp.handle(request),
        Effect.map((response) => HttpClientResponse.fromWeb(request, response))
      )
    );
  })
);

const testConfig = (maxRetries = 0): M365ConfigInput =>
  M365ConfigInput.make({
    clientId: "client-id",
    maxRetries: NonNegativeInt.make(maxRetries),
    tenantId: "common",
  });

const makeTestLayer = (config = testConfig()): Layer.Layer<M365 | M365TestHttp, M365Error> =>
  M365.makeLayer(config).pipe(
    Layer.provide(M365Auth.layerStatic(Redacted.make(TOKEN))),
    Layer.provide(TestHttpClientLayer),
    Layer.provideMerge(M365TestHttpLayer)
  );

const makeAuthFailureLayer = (): Layer.Layer<M365 | M365TestHttp, M365Error> =>
  M365.makeLayer(testConfig()).pipe(
    Layer.provide(
      Layer.succeed(
        M365Auth,
        M365Auth.of({
          acquireToken: M365Error.failEffectFromReason("auth"),
        })
      )
    ),
    Layer.provide(TestHttpClientLayer),
    Layer.provideMerge(M365TestHttpLayer)
  );

type FixtureRoute = {
  readonly respond: () => Effect.Effect<Response>;
  readonly url: string;
};

const fixtureRoutes: ReadonlyArray<FixtureRoute> = [
  {
    url: `${GRAPH_BASE_URL}/sites/${SITE_ID}/drives`,
    respond: () => Effect.succeed(makeJsonResponse({ value: [{ id: DRIVE_ID, name: "Documents" }] })),
  },
  {
    url: `${GRAPH_BASE_URL}/sites?search=legal%20docs`,
    respond: () => Effect.succeed(makeJsonResponse({ value: [{ displayName: "Legal Docs", id: SITE_ID }] })),
  },
  {
    url: `${GRAPH_BASE_URL}/sites/${SITE_ID}`,
    respond: () => Effect.succeed(makeJsonResponse({ displayName: "Legal Docs", id: SITE_ID })),
  },
  {
    url: `${GRAPH_BASE_URL}/drives/${DRIVE_ID}/root/delta`,
    respond: () =>
      Effect.succeed(
        makeJsonResponse({
          "@odata.deltaLink": `${GRAPH_BASE_URL}/drives/${DRIVE_ID}/root/delta?token=abc`,
          value: [
            {
              file: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
              id: ITEM_ID,
              name: "memo.docx",
            },
          ],
        })
      ),
  },
  {
    url: `${GRAPH_BASE_URL}/sites/${SITE_ID}/lists/list-id/items/7?$expand=fields`,
    respond: () =>
      Effect.succeed(
        makeJsonResponse({
          fields: { Client: "Example Co", Matter: "M-100" },
          id: "7",
        })
      ),
  },
  {
    url: `${GRAPH_BASE_URL}/drives/${DRIVE_ID}/items/${ITEM_ID}/versions`,
    respond: () => Effect.succeed(makeJsonResponse({ value: [{ id: "1.0", size: 128 }] })),
  },
  {
    url: `${GRAPH_BASE_URL}/me/messages?$filter=receivedDateTime%20ge%202026-01-01&$top=2`,
    respond: () => Effect.succeed(makeJsonResponse({ value: [{ id: "message-id", subject: "Status" }] })),
  },
  {
    url: `${GRAPH_BASE_URL}/me/messages/message-id`,
    respond: () => Effect.succeed(makeJsonResponse({ id: "message-id", subject: "Status" })),
  },
  {
    url: `${GRAPH_BASE_URL}/users/user-id/events?$top=3`,
    respond: () => Effect.succeed(makeJsonResponse({ value: [{ id: "event-id", subject: "Hearing" }] })),
  },
  {
    url: `${GRAPH_BASE_URL}/users/user-id/events/event-id`,
    respond: () => Effect.succeed(makeJsonResponse({ id: "event-id", subject: "Hearing" })),
  },
];

const routeFixture = (request: HttpClientRequest.HttpClientRequest): Effect.Effect<Response> => {
  const url = requestUrl(request);

  return pipe(
    fixtureRoutes,
    A.findFirst((route) => route.url === url),
    O.map((route) => route.respond()),
    O.getOrElse(() => Effect.succeed(makeJsonResponse({ error: "missing fixture", url }, 404)))
  );
};

describe("@beep/m365 service", () => {
  it("keeps encoded schema wire shapes byte-identical", () => {
    const config = Result.getOrThrow(
      S.decodeResult(M365ConfigInput)({
        authority: "https://login.microsoftonline.com/common",
        clientId: "client-id",
        graphBaseUrl: GRAPH_BASE_URL,
        maxRetries: 3,
        redirectUri: "http://localhost",
        scopes: ["User.Read", "Files.Read.All"],
        tenantId: "common",
        tokenCachePath: ".cache/m365.json",
      })
    );
    const drive = Result.getOrThrow(
      S.decodeResult(GraphDrive)({
        id: DRIVE_ID,
        quota: {
          remaining: 12,
          total: 24,
          used: 12,
        },
      })
    );
    const folder = Result.getOrThrow(S.decodeResult(GraphFolder)({ childCount: 2 }));
    const item = Result.getOrThrow(
      S.decodeResult(GraphDriveItem)({
        folder: { childCount: 2 },
        id: ITEM_ID,
        size: 3,
      })
    );
    const messagesRequest = Result.getOrThrow(
      S.decodeResult(M365ListMessagesRequest)({
        filter: "receivedDateTime ge 2026-01-01",
        top: 2,
        userId: "user-id",
      })
    );
    const sitesRequest = Result.getOrThrow(S.decodeResult(M365ListSitesRequest)({}));
    const error = M365Error.fromReason("throttled", {
      resource: "drives",
      retryAfterSeconds: 12,
      status: 429,
      url: `${GRAPH_BASE_URL}/me/drives`,
    });

    expect(Result.getOrThrow(S.encodeResult(M365ConfigInput)(config))).toStrictEqual({
      authority: "https://login.microsoftonline.com/common",
      clientId: "client-id",
      graphBaseUrl: GRAPH_BASE_URL,
      maxRetries: 3,
      redirectUri: "http://localhost",
      scopes: ["User.Read", "Files.Read.All"],
      tenantId: "common",
      tokenCachePath: ".cache/m365.json",
    });
    expect(Result.getOrThrow(S.encodeResult(GraphDrive)(drive))).toStrictEqual({
      id: DRIVE_ID,
      quota: {
        remaining: 12,
        total: 24,
        used: 12,
      },
    });
    expect(Result.getOrThrow(S.encodeResult(GraphQuota)(pipe(drive.quota, O.getOrThrow)))).toStrictEqual({
      remaining: 12,
      total: 24,
      used: 12,
    });
    expect(Result.getOrThrow(S.encodeResult(GraphFolder)(folder))).toStrictEqual({ childCount: 2 });
    expect(Result.getOrThrow(S.encodeResult(GraphDriveItem)(item))).toStrictEqual({
      folder: { childCount: 2 },
      id: ITEM_ID,
      size: 3,
    });
    expect(Result.getOrThrow(S.encodeResult(M365ListMessagesRequest)(messagesRequest))).toStrictEqual({
      filter: "receivedDateTime ge 2026-01-01",
      top: 2,
      userId: "user-id",
    });
    expect(Result.getOrThrow(S.encodeResult(M365ListSitesRequest)(sitesRequest))).toStrictEqual({
      search: "*",
    });
    expect(Result.getOrThrow(S.encodeResult(M365Error)(error))).toStrictEqual({
      _tag: "M365Error",
      reason: "throttled",
      resource: "drives",
      retryAfterSeconds: 12,
      status: 429,
      url: `${GRAPH_BASE_URL}/me/drives`,
    });
  });

  it("round-trips schema-derived m365 models through their encoded shape", () =>
    fc.assert(
      fc.property(
        M365ConfigInputArbitrary,
        M365ErrorArbitrary,
        GraphDriveItemArbitrary,
        M365ListMessagesRequestArbitrary,
        M365DriveItemDownloadArbitrary,
        (config, error, item, request, download) => {
          expectEncodedRoundTripStable(M365ConfigInput, config);
          expect(sameM365Error(expectEncodedRoundTripStable(M365Error, error), error)).toBe(true);
          expect(sameGraphDriveItem(expectEncodedRoundTripStable(GraphDriveItem, item), item)).toBe(true);
          expect(
            sameM365ListMessagesRequest(expectEncodedRoundTripStable(M365ListMessagesRequest, request), request)
          ).toBe(true);
          expect(
            sameM365DriveItemDownload(expectEncodedRoundTripStable(M365DriveItemDownload, download), download)
          ).toBe(true);
        }
      ),
      fcRuns(50)
    ));

  layer(makeTestLayer())((it) => {
    it.effect(
      "decodes Graph fixtures for each read verb and sends bearer auth to Graph",
      Effect.fnUntraced(function* () {
        const testHttp = yield* M365TestHttp;
        yield* testHttp.respondWith(routeFixture);
        const m365 = yield* M365;

        const drives = yield* m365.listDrives(M365ListDrivesRequest.make({ siteId: O.some(SITE_ID) }));
        const sites = yield* m365.listSites(M365ListSitesRequest.make({ search: "legal docs" }));
        const site = yield* m365.getSite(M365GetSiteRequest.make({ siteId: SITE_ID }));
        const delta = yield* m365.deltaDriveItems(M365DeltaDriveItemsRequest.make({ driveId: DRIVE_ID }));
        const listItem = yield* m365.getListItem(
          M365GetListItemRequest.make({ itemId: "7", listId: "list-id", siteId: SITE_ID })
        );
        const versions = yield* m365.listDriveItemVersions(
          M365ListDriveItemVersionsRequest.make({ driveId: DRIVE_ID, itemId: ITEM_ID })
        );
        const messages = yield* m365.listMessages(
          M365ListMessagesRequest.make({
            filter: O.some("receivedDateTime ge 2026-01-01"),
            top: O.some(PosInt.make(2)),
          })
        );
        const message = yield* m365.getMessage(M365GetMessageRequest.make({ messageId: "message-id" }));
        const events = yield* m365.listEvents(
          M365ListEventsRequest.make({ top: O.some(PosInt.make(3)), userId: O.some("user-id") })
        );
        const event = yield* m365.getEvent(
          M365GetEventRequest.make({ eventId: "event-id", userId: O.some("user-id") })
        );

        expect(drives.value[0]).toBeInstanceOf(GraphDrive);
        expect(sites.value[0]).toBeInstanceOf(GraphSite);
        expect(site).toBeInstanceOf(GraphSite);
        expect(delta.value[0]).toBeInstanceOf(GraphDriveItem);
        expect(listItem).toBeInstanceOf(GraphListItem);
        expect(versions.value[0]).toBeInstanceOf(GraphDriveItemVersion);
        expect(messages.value[0]).toBeInstanceOf(GraphMessage);
        expect(message).toBeInstanceOf(GraphMessage);
        expect(events.value[0]).toBeInstanceOf(GraphEvent);
        expect(event).toBeInstanceOf(GraphEvent);

        const captures = yield* testHttp.captures;
        const graphCaptures = A.filter(captures, (capture) => Str.startsWith(GRAPH_BASE_URL)(capture.url));
        expect(A.every(graphCaptures, (capture) => capture.headers.authorization === `Bearer ${TOKEN}`)).toBe(true);
        expect(A.every(graphCaptures, (capture) => capture.headers.accept === "application/json")).toBe(true);
        expect(A.map(captures, (capture) => capture.url)).toContain(`${GRAPH_BASE_URL}/sites/${SITE_ID}/drives`);
      })
    );
  });

  layer(makeAuthFailureLayer())((it) => {
    it.effect(
      "preserves auth failures before HTTP execution",
      Effect.fnUntraced(function* () {
        const m365 = yield* M365;
        const testHttp = yield* M365TestHttp;
        const exit = yield* Effect.exit(m365.listDrives(M365ListDrivesRequest.make({ siteId: O.some(SITE_ID) })));
        const captures = yield* testHttp.captures;

        expect(captures).toHaveLength(0);
        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          const error = Cause.findErrorOption(exit.cause);
          expect(O.isSome(error)).toBe(true);
          if (O.isSome(error)) {
            expect(error.value.reason).toBe("auth");
          }
        }
      })
    );
  });

  layer(makeTestLayer())((it) => {
    it.effect(
      "rejects untrusted deltaLink values before sending signed continuation requests",
      Effect.fnUntraced(function* () {
        const untrustedDeltaLink = `${GRAPH_BASE_URL}.evil.tld/drives/${DRIVE_ID}/root/delta?token=abc`;
        const testHttp = yield* M365TestHttp;
        yield* testHttp.respondWith((request) => {
          const url = requestUrl(request);
          return url === `${GRAPH_BASE_URL}/drives/${DRIVE_ID}/root/delta`
            ? Effect.succeed(makeJsonResponse({ "@odata.deltaLink": untrustedDeltaLink, value: [] }))
            : Effect.succeed(makeJsonResponse({ error: "unexpected continuation fetch", url }, 500));
        });

        const m365 = yield* M365;
        const firstPage = yield* m365.deltaDriveItems(M365DeltaDriveItemsRequest.make({ driveId: DRIVE_ID }));
        const deltaLink = yield* pipe(
          firstPage["@odata.deltaLink"],
          O.match({
            onNone: () => M365Error.failEffectFromReason("response decoding"),
            onSome: Effect.succeed,
          })
        );
        const exit = yield* Effect.exit(
          m365.deltaDriveItems(M365DeltaDriveItemsRequest.make({ deltaLink: O.some(deltaLink), driveId: DRIVE_ID }))
        );
        const captures = yield* testHttp.captures;

        expect(captures).toHaveLength(1);
        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          const error = Cause.findErrorOption(exit.cause);
          expect(O.isSome(error)).toBe(true);
          if (O.isSome(error)) {
            expect(error.value.reason).toBe("request encoding");
          }
        }
      })
    );
  });

  layer(makeTestLayer())((it) => {
    it.effect(
      "rejects path-segment injection in Graph identifier request fields before HTTP",
      Effect.fnUntraced(function* () {
        const m365 = yield* M365;
        const testHttp = yield* M365TestHttp;
        const requests: ReadonlyArray<Effect.Effect<unknown, M365Error>> = pipe(
          ["../../me", "%2E%2E"],
          A.flatMap((injectedSegment) => [
            m365.listDrives({ siteId: injectedSegment } as unknown as M365ListDrivesRequest),
            m365.getSite({ siteId: injectedSegment } as M365GetSiteRequest),
            m365.deltaDriveItems({ driveId: injectedSegment } as M365DeltaDriveItemsRequest),
            m365.downloadDriveItemContent({
              driveId: injectedSegment,
              itemId: ITEM_ID,
            } as M365DownloadDriveItemContentRequest),
            m365.downloadDriveItemContent({
              driveId: DRIVE_ID,
              itemId: injectedSegment,
            } as M365DownloadDriveItemContentRequest),
            m365.getListItem({
              itemId: injectedSegment,
              listId: "list-id",
              siteId: SITE_ID,
            } as M365GetListItemRequest),
            m365.getListItem({ itemId: "7", listId: injectedSegment, siteId: SITE_ID } as M365GetListItemRequest),
            m365.getListItem({ itemId: "7", listId: "list-id", siteId: injectedSegment } as M365GetListItemRequest),
            m365.listDriveItemVersions({
              driveId: injectedSegment,
              itemId: ITEM_ID,
            } as M365ListDriveItemVersionsRequest),
            m365.listDriveItemVersions({
              driveId: DRIVE_ID,
              itemId: injectedSegment,
            } as M365ListDriveItemVersionsRequest),
            m365.listMessages({ userId: injectedSegment } as unknown as M365ListMessagesRequest),
            m365.getMessage({ messageId: injectedSegment } as M365GetMessageRequest),
            m365.getMessage({
              messageId: "message-id",
              userId: injectedSegment,
            } as unknown as M365GetMessageRequest),
            m365.listEvents({ userId: injectedSegment } as unknown as M365ListEventsRequest),
            m365.getEvent({ eventId: injectedSegment } as M365GetEventRequest),
            m365.getEvent({ eventId: "event-id", userId: injectedSegment } as unknown as M365GetEventRequest),
          ])
        );

        yield* Effect.forEach(
          requests,
          Effect.fnUntraced(function* (request) {
            const exit = yield* Effect.exit(request);

            expect(Exit.isFailure(exit)).toBe(true);
            if (Exit.isFailure(exit)) {
              const error = Cause.findErrorOption(exit.cause);
              expect(O.isSome(error)).toBe(true);
              if (O.isSome(error)) {
                expect(error.value.reason).toBe("request encoding");
              }
            }
          }),
          { discard: true }
        );

        const captures = yield* testHttp.captures;
        expect(captures).toHaveLength(0);
      })
    );
  });

  layer(makeTestLayer())((it) => {
    it.effect(
      "downloads file content from the preauthenticated URL without forwarding Authorization",
      Effect.fnUntraced(function* () {
        const testHttp = yield* M365TestHttp;
        yield* testHttp.respondWith((request) => {
          const url = requestUrl(request);
          if (url === METADATA_URL) {
            return Effect.succeed(
              makeJsonResponse({
                "@microsoft.graph.downloadUrl": DOWNLOAD_URL,
                file: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
                id: ITEM_ID,
                name: "memo.docx",
                size: 3,
              })
            );
          }
          if (url === DOWNLOAD_URL) {
            return Effect.succeed(makeBytesResponse(new Uint8Array([1, 2, 3])));
          }
          return Effect.succeed(makeJsonResponse({ error: "missing fixture", url }, 404));
        });

        const m365 = yield* M365;
        const result = yield* m365.downloadDriveItemContent(
          M365DownloadDriveItemContentRequest.make({ driveId: DRIVE_ID, itemId: ITEM_ID })
        );
        const captures = yield* testHttp.captures;

        expect(result).toBeInstanceOf(M365DownloadedContent);
        expect(result._tag).toBe("M365DownloadedContent");
        if (M365DriveItemDownload.guards.M365DownloadedContent(result)) {
          expect(A.fromIterable(result.bytes)).toStrictEqual([1, 2, 3]);
        }
        expect(captures[0]?.headers.authorization).toBe(`Bearer ${TOKEN}`);
        expect(captures[1]?.url).toBe(DOWNLOAD_URL);
        expect(captures[1]?.headers.authorization).toBeUndefined();
      })
    );
  });

  layer(makeTestLayer())((it) => {
    it.effect(
      "skips protected/encrypted items by extension without fetching content",
      Effect.fnUntraced(function* () {
        const testHttp = yield* M365TestHttp;
        yield* testHttp.respondWith((request) => {
          const url = requestUrl(request);
          if (url === METADATA_URL) {
            return Effect.succeed(
              makeJsonResponse({
                "@microsoft.graph.downloadUrl": DOWNLOAD_URL,
                file: { mimeType: "application/octet-stream" },
                id: ITEM_ID,
                name: "sealed.pfile",
                size: 512,
              })
            );
          }
          return Effect.succeed(makeJsonResponse({ error: "unexpected content fetch", url }, 500));
        });

        const m365 = yield* M365;
        const result = yield* m365.downloadDriveItemContent(
          M365DownloadDriveItemContentRequest.make({ driveId: DRIVE_ID, itemId: ITEM_ID })
        );
        const captures = yield* testHttp.captures;

        expect(result).toBeInstanceOf(M365SkippedEncryptedItem);
        expect(result._tag).toBe("M365SkippedEncryptedItem");
        expect(captures).toHaveLength(1);
      })
    );
  });

  layer(makeTestLayer())((it) => {
    it.effect(
      "maps Retry-After throttles to typed driver errors",
      Effect.fnUntraced(function* () {
        const testHttp = yield* M365TestHttp;
        yield* testHttp.respondWith(() =>
          Effect.succeed(makeJsonResponse({ error: { code: "TooManyRequests" } }, 429, { "retry-after": "12" }))
        );

        const m365 = yield* M365;
        const exit = yield* Effect.exit(m365.listDrives(M365ListDrivesRequest.make({})));

        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          const error = Cause.findErrorOption(exit.cause);
          expect(O.isSome(error)).toBe(true);
          if (O.isSome(error)) {
            expect(error.value.reason).toBe("throttled");
            expect(error.value.retryAfterSeconds).toStrictEqual(O.some(NonNegativeInt.make(12)));
            expect(error.value.status).toStrictEqual(O.some(HttpStatus.make(429)));
          }
        }
      })
    );
  });

  layer(makeTestLayer(testConfig(1)))((it) => {
    it.effect(
      "retries throttled requests after Retry-After within the configured budget",
      Effect.fnUntraced(function* () {
        const testHttp = yield* M365TestHttp;
        yield* testHttp.respondWith(() =>
          Effect.gen(function* () {
            const captures = yield* testHttp.captures;
            return A.length(captures) === 1
              ? makeJsonResponse({ error: { code: "TooManyRequests" } }, 429, { "retry-after": "0" })
              : makeJsonResponse({ value: [{ id: DRIVE_ID, name: "Documents" }] });
          })
        );

        const m365 = yield* M365;
        const drives = yield* m365.listDrives(M365ListDrivesRequest.make({}));
        const captures = yield* testHttp.captures;

        expect(drives.value[0]?.id).toBe(DRIVE_ID);
        expect(captures).toHaveLength(2);
      })
    );
  });

  layer(makeTestLayer(testConfig(1)))((it) => {
    it.effect(
      "retries throttled requests with a default delay when Retry-After is absent",
      Effect.fnUntraced(function* () {
        const testHttp = yield* M365TestHttp;
        yield* testHttp.respondWith(() =>
          Effect.gen(function* () {
            const captures = yield* testHttp.captures;
            return A.length(captures) === 1
              ? makeJsonResponse({ error: { code: "TooManyRequests" } }, 429)
              : makeJsonResponse({ value: [{ id: DRIVE_ID, name: "Documents" }] });
          })
        );

        const m365 = yield* M365;
        const fiber = yield* m365.listDrives(M365ListDrivesRequest.make({})).pipe(Effect.forkChild);
        yield* TestClock.adjust(Duration.seconds(1));
        const drives = yield* Fiber.join(fiber);
        const captures = yield* testHttp.captures;

        expect(drives.value[0]?.id).toBe(DRIVE_ID);
        expect(captures).toHaveLength(2);
      })
    );
  });
});
