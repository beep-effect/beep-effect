import { Buffer } from "node:buffer";
import { Readable } from "node:stream";
import { text as readableText } from "node:stream/consumers";
import * as B from "@beep/box";
import { HttpsUrl, NonNegativeInt } from "@beep/schema";
import { describe, expect, it, layer } from "@effect/vitest";
import {
  Cause,
  ConfigProvider,
  Effect,
  Layer as EffectLayer,
  Equal,
  Exit,
  Fiber,
  Redacted,
  Result,
  Stream,
} from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { FastCheck as fc } from "effect/testing";

type FakeUploadRequestBody = {
  readonly attributes: {
    readonly name: string;
    readonly parent: {
      readonly id: string;
    };
  };
  readonly file: Readable;
  readonly fileContentType?: string;
  readonly fileFileName?: string;
};

type FakeUsersManager = {
  readonly getUserMe: (
    queryParams: unknown,
    headersInput: unknown,
    cancellationToken: AbortSignal | undefined
  ) => Promise<unknown>;
};

type FakeDownloadsManager = {
  readonly downloadFile: (fileId: string, optionalsInput: unknown) => Promise<unknown>;
  readonly getDownloadFileUrl: (fileId: string, optionalsInput: unknown) => Promise<unknown>;
};

type FakeUploadsManager = {
  readonly uploadFile: (requestBody: FakeUploadRequestBody, optionalsInput: unknown) => Promise<unknown>;
};

type FakeEventsManager = {
  readonly getEventStream: (queryParams: unknown, headersInput: unknown) => unknown;
};

type FakeBoxClient = {
  readonly downloads: FakeDownloadsManager;
  readonly events: FakeEventsManager;
  readonly uploads: FakeUploadsManager;
  readonly users: FakeUsersManager;
};

type FakeBoxClientOverrides = {
  readonly [K in keyof FakeBoxClient]?: Partial<FakeBoxClient[K]>;
};

type PromiseController<A> = {
  readonly promise: Promise<A>;
  readonly reject: (reason?: unknown) => void;
  readonly resolve: (value: A | PromiseLike<A>) => void;
};

class FakeEventStream extends Readable {
  readonly emissions: ReadonlyArray<unknown>;
  wasClosed = false;
  private emitted = false;

  constructor(emissions: ReadonlyArray<unknown>) {
    super({ objectMode: true });
    this.emissions = emissions;
  }

  override _read(): void {
    if (this.emitted) {
      return;
    }

    this.emitted = true;
    for (const emission of this.emissions) {
      this.push(emission);
    }
    this.push(null);
  }

  override _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    this.wasClosed = true;
    callback(error);
  }
}

const userFull = {
  id: "user-id",
  login: "ada@example.com",
  name: "Ada Lovelace",
  type: "user",
};

const fileFull = {
  id: "file-id",
  name: "document.txt",
  type: "file",
};

const files = {
  entries: [fileFull],
  totalCount: 1,
};

const makeFakeClient = (overrides: FakeBoxClientOverrides = {}): FakeBoxClient => {
  const defaults: FakeBoxClient = {
    downloads: {
      downloadFile: (_fileId, _optionalsInput) => Promise.resolve(Readable.from([Buffer.from("downloaded")])),
      getDownloadFileUrl: (fileId, _optionalsInput) => Promise.resolve(`https://box.example/files/${fileId}/download`),
    },
    events: {
      getEventStream: (_queryParams, _headersInput) =>
        new FakeEventStream([
          {
            eventId: "event-id",
            eventType: "FUTURE_BOX_EVENT",
            type: "event",
          },
        ]),
    },
    uploads: {
      uploadFile: (_requestBody, _optionalsInput) => Promise.resolve(files),
    },
    users: {
      getUserMe: (_queryParams, _headersInput, _cancellationToken) => Promise.resolve(userFull),
    },
  };

  return {
    downloads: { ...defaults.downloads, ...overrides.downloads },
    events: { ...defaults.events, ...overrides.events },
    uploads: { ...defaults.uploads, ...overrides.uploads },
    users: { ...defaults.users, ...overrides.users },
  };
};

const chunksToText = (chunks: Iterable<Uint8Array>): string =>
  Buffer.concat(A.map(A.fromIterable(chunks), (chunk) => Buffer.from(chunk))).toString("utf8");

const byteAbortProbe: {
  aborted: PromiseController<void> | undefined;
  cancellationToken: AbortSignal | undefined;
  entered: PromiseController<void> | undefined;
  pending: PromiseController<unknown> | undefined;
} = {
  aborted: undefined,
  cancellationToken: undefined,
  entered: undefined,
  pending: undefined,
};

const encode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): Codec["Encoded"] =>
  Result.getOrThrow(S.encodeResult(schema)(value));

const decode = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Encoded"]): Codec["Type"] =>
  Result.getOrThrow(S.decodeUnknownResult(schema)(value));

const expectRoundTrip = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): void => {
  const encoded = encode(schema, value);
  const decoded = decode(schema, encoded);
  const reencoded = encode(schema, decoded);

  expect(reencoded).toEqual(encoded);
  expect(Equal.equals(decoded, value) || S.toEquivalence(schema)(decoded, value)).toBe(true);
};

const assertSchemaRoundTrip = <Codec extends S.Codec<unknown, unknown>>(schema: Codec): void => {
  fc.assert(
    fc.property(S.toArbitrary(schema), (value) => {
      expectRoundTrip(schema, value);
    }),
    { numRuns: 25 }
  );
};

const assertSchemaRoundTripWithArbitrary = <Codec extends S.Codec<unknown, unknown>>(
  schema: Codec,
  arbitrary: fc.Arbitrary<Codec["Type"]>
): void => {
  fc.assert(
    fc.property(arbitrary, (value) => {
      expectRoundTrip(schema, value);
    }),
    { numRuns: 25 }
  );
};

const UploadBigFilePayloadArbitrary = S.toArbitrary(NonNegativeInt).map((fileSize) =>
  B.BoxUploadBigFilePayload.make({
    file: new Uint8Array([1, 2, 3]),
    fileName: "large-document.txt",
    fileSize,
    parentFolderId: "0",
  })
);

describe("@beep/box", () => {
  it.effect(
    "accepts future Box enum values generated as open unions",
    Effect.fnUntraced(function* () {
      const eventType = yield* S.decodeUnknownEffect(B.EventEventTypeField)("FUTURE_BOX_EVENT");

      expect(eventType).toBe("FUTURE_BOX_EVENT");
    })
  );

  it("round-trips handwritten schema values without encoded-shape drift", () => {
    assertSchemaRoundTrip(B.BoxCcgConfig);
    assertSchemaRoundTrip(B.BoxErrorOptions);
    assertSchemaRoundTrip(B.BoxError);
    assertSchemaRoundTrip(B.BoxPartAccumulator);
    assertSchemaRoundTripWithArbitrary(B.BoxUploadBigFilePayload, UploadBigFilePayloadArbitrary);

    const zipPayload = B.BoxGetZipDownloadContentPayload.make({
      downloadUrl: HttpsUrl.make("https://example.com/content"),
    });

    expectRoundTrip(B.BoxGetZipDownloadContentPayload, zipPayload);
    expect(
      O.isNone(
        S.decodeUnknownOption(B.BoxGetZipDownloadContentPayload)({
          downloadUrl: "http://example.com/content",
        })
      )
    ).toBe(true);
  });

  it("drops invalid SDK status codes from sanitized errors", () => {
    const error = B.BoxError.fromUnknown("users.getUserMe", {
      responseInfo: {
        statusCode: Number.NaN,
      },
    });

    const outOfRange = B.BoxError.fromUnknown("users.getUserMe", {
      responseInfo: {
        statusCode: 99,
      },
    });

    expect(error.status).toEqual(O.none());
    expect(outOfRange.status).toEqual(O.none());
    expect(error.sdkVersion).toBe("10.11.1");
  });

  it("sanitizes raw string SDK throws", () => {
    const error = B.BoxError.fromUnknown("users.getUserMe", "Bearer secret-token");

    expect(error.reason).toBe("sdk thrown");
    expect(error.cause).toEqual(O.some("String"));
  });

  it.effect(
    "maps developer-token config failures into BoxError",
    Effect.fnUntraced(function* () {
      const exit = yield* Effect.exit(
        Effect.scoped(
          EffectLayer.build(
            B.BoxConfigLayer.pipe(EffectLayer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))))
          ).pipe(Effect.flatMap((context) => B.BoxConfig.pipe(Effect.provide(context))))
        )
      );

      expect(Exit.isFailure(exit)).toBe(true);
      if (Exit.isFailure(exit)) {
        const error = Cause.findErrorOption(exit.cause);
        expect(O.isSome(error)).toBe(true);
        if (O.isSome(error)) {
          expect(error.value).toBeInstanceOf(B.BoxError);
          expect(error.value.reason).toBe("config");
          expect(error.value.sdkVersion).toBe("10.11.1");
        }
      }
    })
  );

  it.effect(
    "rejects CCG config without an enterprise or user subject",
    Effect.fnUntraced(function* () {
      const exit = yield* Effect.exit(
        S.decodeUnknownEffect(B.BoxCcgConfig)({
          clientId: "client-id",
          clientSecret: Redacted.make("client-secret"),
        })
      );

      expect(Exit.isFailure(exit)).toBe(true);
    })
  );

  layer(B.Box.makeLayerFromClient(makeFakeClient()))((it) => {
    it.effect(
      "wraps SDK JSON operations in decoded success schemas",
      Effect.fnUntraced(function* () {
        const box = yield* B.Box;
        const response = yield* box.users.getUserMe(B.UsersGetUserMePayload.make({}));

        expect(response).toBeInstanceOf(B.UserFull);
        expect(response.id).toBe("user-id");
      })
    );

    it.effect(
      "keeps generated JSON operations alongside handwritten byte operations",
      Effect.fnUntraced(function* () {
        const box = yield* B.Box;
        const url = yield* box.downloads.getDownloadFileUrl(
          B.DownloadsGetDownloadFileUrlPayload.make({ fileId: "file-id" })
        );

        expect(B.BoxMethodName.is["downloads.downloadFile"]("downloads.downloadFile")).toBe(true);
        expect(B.BoxMethodName.is["downloads.getDownloadFileUrl"]("downloads.getDownloadFileUrl")).toBe(true);
        expect(url).toBe("https://box.example/files/file-id/download");
      })
    );

    it.effect(
      "bridges SDK byte downloads into Effect streams",
      Effect.fnUntraced(function* () {
        const box = yield* B.Box;
        const chunks = yield* box.downloads.downloadFile({ fileId: "file-id" }).pipe(Stream.runCollect);

        expect(chunksToText(chunks)).toBe("downloaded");
      })
    );
  });

  layer(B.Box.makeLayerFromClient(makeFakeClient({ downloads: { downloadFile: () => Promise.resolve(undefined) } })))(
    (it) => {
      it.effect(
        "fails byte downloads when the SDK returns no stream",
        Effect.fnUntraced(function* () {
          const box = yield* B.Box;
          const exit = yield* Effect.exit(box.downloads.downloadFile({ fileId: "file-id" }).pipe(Stream.runCollect));

          expect(Exit.isFailure(exit)).toBe(true);
          if (Exit.isFailure(exit)) {
            const error = Cause.findErrorOption(exit.cause);
            expect(O.isSome(error)).toBe(true);
            if (O.isSome(error)) {
              expect(error.value).toBeInstanceOf(B.BoxError);
              expect(error.value.reason).toBe("stream");
              expect(error.value.method).toEqual(O.some("downloads.downloadFile"));
            }
          }
        })
      );
    }
  );

  layer(
    B.Box.makeLayerFromClient(
      makeFakeClient({
        downloads: {
          downloadFile: (_fileId, optionalsInput) => {
            byteAbortProbe.cancellationToken = (
              optionalsInput as { readonly cancellationToken?: AbortSignal }
            ).cancellationToken;
            byteAbortProbe.cancellationToken?.addEventListener(
              "abort",
              () => byteAbortProbe.aborted?.resolve(undefined),
              { once: true }
            );
            byteAbortProbe.entered?.resolve(undefined);
            byteAbortProbe.pending = Promise.withResolvers<unknown>();
            return byteAbortProbe.pending.promise;
          },
        },
      })
    )
  )((it) => {
    it.effect(
      "aborts byte download setup when interrupted before the SDK returns",
      Effect.fnUntraced(function* () {
        byteAbortProbe.aborted = Promise.withResolvers<void>();
        byteAbortProbe.cancellationToken = undefined;
        byteAbortProbe.entered = Promise.withResolvers<void>();
        byteAbortProbe.pending = undefined;

        const box = yield* B.Box;
        const fiber = yield* box.downloads.downloadFile({ fileId: "file-id" }).pipe(Stream.runDrain, Effect.forkChild);

        yield* Effect.promise(() => byteAbortProbe.entered?.promise ?? Promise.reject("download did not start"));
        expect(byteAbortProbe.cancellationToken).toBeInstanceOf(AbortSignal);
        yield* Fiber.interrupt(fiber);
        yield* Effect.promise(() => byteAbortProbe.aborted?.promise ?? Promise.reject("download did not abort"));
      })
    );
  });

  layer(
    B.Box.makeLayerFromClient(
      makeFakeClient({
        users: {
          getUserMe: (_queryParams, _headersInput, _cancellationToken) =>
            Promise.reject({
              requestInfo: {
                body: "must-not-leak",
              },
              responseInfo: {
                code: "rate_limit",
                contextInfo: { retry: "later" },
                helpUrl: "https://box.dev/help",
                requestId: "request-id",
                statusCode: 429,
              },
            }),
        },
      })
    )
  )((it) => {
    it.effect(
      "translates SDK throws into sanitized BoxError values",
      Effect.fnUntraced(function* () {
        const box = yield* B.Box;
        const exit = yield* Effect.exit(box.users.getUserMe(B.UsersGetUserMePayload.make({})));

        expect(Exit.isFailure(exit)).toBe(true);
        if (Exit.isFailure(exit)) {
          const error = Cause.findErrorOption(exit.cause);
          expect(O.isSome(error)).toBe(true);
          if (O.isSome(error)) {
            expect(error.value).toBeInstanceOf(B.BoxError);
            expect(error.value.reason).toBe("response status");
            expect(error.value.method).toEqual(O.some("users.getUserMe"));
            expect(error.value.status).toEqual(O.some(429));
            expect(error.value.code).toEqual(O.some("rate_limit"));
            expect(error.value.requestId).toEqual(O.some("request-id"));
            expect(error.value.sdkVersion).toBe("10.11.1");
            expect(error.value.cause).toEqual(O.some("Unknown"));
          }
        }
      })
    );
  });

  const uploaded: { content: string | undefined } = { content: undefined };

  layer(
    B.Box.makeLayerFromClient(
      makeFakeClient({
        uploads: {
          uploadFile: (requestBody, _optionalsInput) =>
            readableText(requestBody.file).then((content) => {
              uploaded.content = content;
              return files;
            }),
        },
      })
    )
  )((it) => {
    it.effect(
      "bridges Effect byte streams into SDK upload readables",
      Effect.fnUntraced(function* () {
        const box = yield* B.Box;
        const response = yield* box.uploads.uploadFile({
          requestBody: {
            attributes: {
              name: "document.txt",
              parent: { id: "0" },
            },
            file: Stream.make(new Uint8Array(Buffer.from("uploaded"))),
          },
        });

        expect(response).toBeInstanceOf(B.Files);
        expect(uploaded.content).toBe("uploaded");
      })
    );
  });

  const generatedDirectCancellationProbe: {
    readonly aborted: PromiseController<void>;
    readonly entered: PromiseController<void>;
    readonly pending: PromiseController<unknown>;
    received: AbortSignal | undefined;
  } = {
    aborted: Promise.withResolvers<void>(),
    entered: Promise.withResolvers<void>(),
    pending: Promise.withResolvers<unknown>(),
    received: undefined,
  };

  layer(
    B.Box.makeLayerFromClient(
      makeFakeClient({
        users: {
          getUserMe: (_queryParams, _headersInput, cancellationToken) => {
            generatedDirectCancellationProbe.received = cancellationToken;
            cancellationToken?.addEventListener("abort", () => generatedDirectCancellationProbe.aborted.resolve(), {
              once: true,
            });
            generatedDirectCancellationProbe.entered.resolve();
            return generatedDirectCancellationProbe.pending.promise;
          },
        },
      })
    )
  )((it) => {
    it.effect(
      "preserves direct caller cancellation tokens for generated methods",
      Effect.fnUntraced(function* () {
        const callerController = new AbortController();
        const box = yield* B.Box;
        const fiber = yield* box.users
          .getUserMe(B.UsersGetUserMePayload.make({ cancellationToken: callerController.signal }))
          .pipe(Effect.forkChild);

        yield* Effect.promise(() => generatedDirectCancellationProbe.entered.promise);
        expect(generatedDirectCancellationProbe.received).toBeInstanceOf(AbortSignal);
        callerController.abort();
        yield* Effect.promise(() => generatedDirectCancellationProbe.aborted.promise);
        generatedDirectCancellationProbe.pending.resolve(userFull);
        yield* Fiber.join(fiber);
      })
    );
  });

  const generatedOptionalsCancellationProbe: {
    readonly aborted: PromiseController<void>;
    readonly entered: PromiseController<void>;
    readonly pending: PromiseController<unknown>;
    received: AbortSignal | undefined;
  } = {
    aborted: Promise.withResolvers<void>(),
    entered: Promise.withResolvers<void>(),
    pending: Promise.withResolvers<unknown>(),
    received: undefined,
  };

  layer(
    B.Box.makeLayerFromClient(
      makeFakeClient({
        downloads: {
          getDownloadFileUrl: (fileId, optionalsInput) => {
            generatedOptionalsCancellationProbe.received = (
              optionalsInput as { readonly cancellationToken?: AbortSignal }
            ).cancellationToken;
            generatedOptionalsCancellationProbe.received?.addEventListener(
              "abort",
              () => generatedOptionalsCancellationProbe.aborted.resolve(),
              {
                once: true,
              }
            );
            generatedOptionalsCancellationProbe.entered.resolve();
            return generatedOptionalsCancellationProbe.pending.promise.then(() => `https://box.example/${fileId}`);
          },
        },
      })
    )
  )((it) => {
    it.effect(
      "preserves optionalsInput caller cancellation tokens for generated methods",
      Effect.fnUntraced(function* () {
        const callerController = new AbortController();
        const box = yield* B.Box;
        const fiber = yield* box.downloads
          .getDownloadFileUrl(
            B.DownloadsGetDownloadFileUrlPayload.make({
              fileId: "file-id",
              optionalsInput: { cancellationToken: callerController.signal },
            })
          )
          .pipe(Effect.forkChild);

        yield* Effect.promise(() => generatedOptionalsCancellationProbe.entered.promise);
        expect(generatedOptionalsCancellationProbe.received).toBeInstanceOf(AbortSignal);
        callerController.abort();
        yield* Effect.promise(() => generatedOptionalsCancellationProbe.aborted.promise);
        generatedOptionalsCancellationProbe.pending.resolve(undefined);
        expect(yield* Fiber.join(fiber)).toBe("https://box.example/file-id");
      })
    );
  });

  const eventStream = new FakeEventStream([
    {
      eventId: "event-id",
      eventType: "FUTURE_BOX_EVENT",
      type: "event",
    },
  ]);

  layer(B.Box.makeLayerFromClient(makeFakeClient({ events: { getEventStream: () => eventStream } })))((it) => {
    it.effect(
      "streams SDK event objects and closes the SDK readable",
      Effect.fnUntraced(function* () {
        const box = yield* B.Box;
        const events = yield* box.events.getEventStream({}).pipe(Stream.runCollect);
        const values = A.fromIterable(events);

        expect(A.map(values, (event) => event.eventType)).toEqual(["FUTURE_BOX_EVENT"]);
        expect(eventStream.wasClosed).toBe(true);
      })
    );
  });

  const invalidEventStream = new FakeEventStream([
    { createdAt: 123 },
    {
      eventId: "event-id-after-invalid-payload",
      eventType: "FUTURE_BOX_EVENT",
      type: "event",
    },
  ]);

  layer(B.Box.makeLayerFromClient(makeFakeClient({ events: { getEventStream: () => invalidEventStream } })))((it) => {
    it.effect(
      "fails event streams and closes the SDK readable when payloads cannot decode",
      Effect.fnUntraced(function* () {
        const box = yield* B.Box;
        const exit = yield* Effect.exit(box.events.getEventStream({}).pipe(Stream.runCollect));

        expect(Exit.isFailure(exit)).toBe(true);
        expect(invalidEventStream.wasClosed).toBe(true);
        if (Exit.isFailure(exit)) {
          const error = Cause.findErrorOption(exit.cause);
          expect(O.isSome(error)).toBe(true);
          if (O.isSome(error)) {
            expect(error.value).toBeInstanceOf(B.BoxError);
            expect(error.value.reason).toBe("response decoding");
            expect(error.value.method).toEqual(O.some("events.getEventStream"));
          }
        }
      })
    );
  });
});
