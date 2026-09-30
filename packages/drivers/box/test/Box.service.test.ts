import { Buffer } from "node:buffer";
import { text as readableText } from "node:stream/consumers";
import * as B from "@beep/box";
import { HttpsUrl } from "@beep/schema";
import { it } from "@beep/test-runner";
import { fcRuns, provideScopedLayer } from "@beep/test-utils";
import * as NodeStream from "@effect/platform-node-shared/NodeStream";
import { describe, expect } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import {
  Cause,
  ConfigProvider,
  Effect,
  Layer as EffectLayer,
  Equal,
  Exit,
  Fiber,
  pipe,
  Redacted,
  Result,
  Stream,
} from "effect";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import { constVoid } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";

const decodeBBoxCcgConfig = S.decodeEffect(B.BoxCcgConfig);
const decodeBEventEventTypeField = S.decodeEffect(B.EventEventTypeField);
const decodeBBoxGetZipDownloadContentPayloadOption = S.decodeOption(B.BoxGetZipDownloadContentPayload);

type FakeUploadRequestBody = {
  readonly attributes: {
    readonly name: string;
    readonly parent: {
      readonly id: string;
    };
  };
  readonly file: NodeJS.ReadableStream;
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

type FakeEventListener = (payload?: unknown) => void;

class FakeEventStream {
  readonly emissions: ReadonlyArray<unknown>;
  readonly keepOpen: boolean;
  readonly onRead: () => void;
  wasClosed = false;
  readableEnded = false;
  closed = false;
  private index = 0;
  private readonly onceListeners = MutableHashMap.empty<FakeEventListener, FakeEventListener>();
  private readonly listeners: {
    readonly end: Array<FakeEventListener>;
    readonly error: Array<FakeEventListener>;
    readonly readable: Array<FakeEventListener>;
  } = { end: [], error: [], readable: [] };

  constructor(emissions: ReadonlyArray<unknown>, keepOpen = false, onRead: () => void = constVoid) {
    this.emissions = emissions;
    this.keepOpen = keepOpen;
    this.onRead = onRead;
  }

  read(): unknown {
    this.onRead();
    if (this.index < this.emissions.length) {
      const emission = this.emissions[this.index];
      this.index += 1;
      return emission;
    }
    if (!this.keepOpen && !this.readableEnded) {
      this.readableEnded = true;
      this.emit("end");
    }
    return null;
  }

  on(event: "end" | "error" | "readable", listener: FakeEventListener): this {
    this.listeners[event].push(listener);
    return this;
  }

  once(event: "end" | "error" | "readable", listener: FakeEventListener): this {
    const wrapped: FakeEventListener = (payload) => {
      this.off(event, wrapped);
      listener(payload);
    };
    MutableHashMap.set(this.onceListeners, listener, wrapped);
    return this.on(event, wrapped);
  }

  off(event: "end" | "error" | "readable", listener: FakeEventListener): this {
    const wrapped = MutableHashMap.get(this.onceListeners, listener);
    const retained = A.filter(
      this.listeners[event],
      (candidate) => candidate !== listener && !O.contains(wrapped, candidate)
    );
    MutableHashMap.remove(this.onceListeners, listener);
    this.listeners[event].splice(0, this.listeners[event].length, ...retained);
    return this;
  }

  listenerCount(event: "end" | "error" | "readable"): number {
    return A.length(this.listeners[event]);
  }

  pipe(): this {
    return this;
  }

  destroy(): this {
    this.wasClosed = true;
    this.closed = true;
    return this;
  }

  private emit(event: "end" | "error" | "readable", payload?: unknown): void {
    for (const listener of [...this.listeners[event]]) {
      listener(payload);
    }
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
      downloadFile: (_fileId, _optionalsInput) =>
        Promise.resolve(NodeStream.toReadableNever(Stream.make(new Uint8Array(Buffer.from("downloaded"))))),
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

const resolveEmptyEntries = (..._args: ReadonlyArray<unknown>): Promise<unknown> => Promise.resolve({ entries: [] });

const provisioningClient = {
  files: {
    getFileById: (..._args: ReadonlyArray<unknown>) => Promise.resolve(fileFull),
  },
  folderMetadata: {
    getFolderMetadata: resolveEmptyEntries,
  },
  folders: {
    getFolderById: (..._args: ReadonlyArray<unknown>) =>
      Promise.resolve({ id: "folder-id", name: "Fixture folder", type: "folder" }),
    getFolderItems: resolveEmptyEntries,
  },
  listCollaborations: {
    getCollaborations: resolveEmptyEntries,
    getFileCollaborations: resolveEmptyEntries,
    getFolderCollaborations: resolveEmptyEntries,
    getGroupCollaborations: resolveEmptyEntries,
  },
  metadataCascadePolicies: {
    getMetadataCascadePolicies: resolveEmptyEntries,
  },
  metadataTemplates: {
    getEnterpriseMetadataTemplates: resolveEmptyEntries,
    getGlobalMetadataTemplates: resolveEmptyEntries,
    getMetadataTemplatesByInstanceId: resolveEmptyEntries,
  },
  retentionPolicies: {
    getRetentionPolicies: resolveEmptyEntries,
  },
  retentionPolicyAssignments: {
    getRetentionPolicyAssignments: resolveEmptyEntries,
  },
  signRequests: {
    getSignRequests: resolveEmptyEntries,
  },
  signTemplates: {
    getSignTemplates: resolveEmptyEntries,
  },
  userCollaborations: {
    getCollaborationById: (..._args: ReadonlyArray<unknown>) =>
      Promise.resolve({ id: "collaboration-id", type: "collaboration" }),
  },
  users: {
    getUsers: resolveEmptyEntries,
  },
  webhooks: {
    getWebhooks: resolveEmptyEntries,
  },
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

const decodeCollectionEffect = S.decodeUnknownEffect(B.Collection);

const expectRoundTrip = <Codec extends S.Codec<unknown, unknown>>(schema: Codec, value: Codec["Type"]): void => {
  const encoded = encode(schema, value);
  const decoded = decode(schema, encoded);
  const reencoded = encode(schema, decoded);

  expect(reencoded).toEqual(encoded);
  pipe(Equal.equals(decoded, value) || S.toEquivalence(schema)(decoded, value), assertTrue);
};

const UploadBigFilePayloadArbitrary = Arbitrary.schema(S.Natural).pipe(
  Arbitrary.map((fileSize) =>
    B.BoxUploadBigFilePayload.make({
      file: new Uint8Array([1, 2, 3]),
      fileName: "large-document.txt",
      fileSize,
      parentFolderId: "0",
    })
  )
);

describe("@beep/box", () => {
  it.layer(
    B.Box.makeLayerFromClient({
      chunkedUploads: {
        getCachedUploadPart: (...args: ReadonlyArray<unknown>) => {
          expect(args).toEqual(["https://box.example/plan", 0, 42, "part-sha512"]);
          return Promise.resolve(undefined);
        },
      },
    }),
    { timeout: "10 seconds" }
  )("generated methods without cancellation parameters", (it) => {
    it.effect(
      "forwards cached-part arguments and preserves an absent cache result",
      Effect.fnUntraced(function* () {
        const box = yield* B.Box;
        const part = yield* box.chunkedUploads.getCachedUploadPart(
          B.ChunkedUploadsGetCachedUploadPartPayload.make({
            planUrl: "https://box.example/plan",
            offset: 0,
            size: 42,
            sha512: "part-sha512",
          })
        );
        expect(part).toBeUndefined();
      })
    );
  });

  it.effect(
    "accepts future Box enum values generated as open unions",
    Effect.fnUntraced(function* () {
      const eventType = yield* decodeBEventEventTypeField("FUTURE_BOX_EVENT");

      expect(eventType).toBe("FUTURE_BOX_EVENT");
    })
  );

  it.effect(
    "decodes generated collection fields through their suspended schemas",
    Effect.fnUntraced(function* () {
      const collection = yield* decodeCollectionEffect({
        id: "collection-id",
        type: "collection",
        name: "Favorites",
        collectionType: "favorites",
      });

      expect(collection).toMatchObject({
        id: "collection-id",
        type: "collection",
        name: "Favorites",
        collectionType: "favorites",
      });
    })
  );

  it.prop(
    "round-trips BoxCcgConfig without encoded-shape drift",
    { value: Arbitrary.schema(B.BoxCcgConfig) },
    ({ value }) => expectRoundTrip(B.BoxCcgConfig, value),
    { arbitrary: fcRuns(25) }
  );

  it.prop(
    "round-trips BoxErrorOptions without encoded-shape drift",
    { value: Arbitrary.schema(B.BoxErrorOptions) },
    ({ value }) => expectRoundTrip(B.BoxErrorOptions, value),
    { arbitrary: fcRuns(25) }
  );

  it.prop(
    "round-trips BoxErrorDiagnostic without encoded-shape drift",
    { value: Arbitrary.schema(B.BoxErrorDiagnostic) },
    ({ value }) => expectRoundTrip(B.BoxErrorDiagnostic, value),
    { arbitrary: fcRuns(25) }
  );

  it.prop(
    "round-trips BoxError without encoded-shape drift",
    { value: Arbitrary.schema(B.BoxError).pipe(Arbitrary.map((value) => B.BoxError.make({ ...value }))) },
    ({ value }) => expectRoundTrip(B.BoxError, value),
    { arbitrary: fcRuns(25) }
  );

  it.prop(
    "round-trips BoxPartAccumulator without encoded-shape drift",
    { value: Arbitrary.schema(B.BoxPartAccumulator) },
    ({ value }) => expectRoundTrip(B.BoxPartAccumulator, value),
    { arbitrary: fcRuns(25) }
  );

  it.prop(
    "round-trips BoxUploadBigFilePayload without encoded-shape drift",
    { value: UploadBigFilePayloadArbitrary },
    ({ value }) => expectRoundTrip(B.BoxUploadBigFilePayload, value),
    { arbitrary: fcRuns(25) }
  );

  it("round-trips handwritten schema values without encoded-shape drift", () => {
    const zipPayload = B.BoxGetZipDownloadContentPayload.make({
      downloadUrl: HttpsUrl.make("https://example.com/content"),
    });

    expectRoundTrip(B.BoxGetZipDownloadContentPayload, zipPayload);
    assertNone(
      decodeBBoxGetZipDownloadContentPayloadOption({
        downloadUrl: "http://example.com/content",
      })
    );
  });

  it("keeps only the strict conflict projection from API failure context", () => {
    const withContext = B.BoxError.fromReason("response status", {
      context: B.BoxApiFailureContext.make({
        values: {
          conflictCount: S.Natural.make(1),
          conflicts: [{ id: "123", type: "file" }],
        },
      }),
    });

    expectRoundTrip(B.BoxError, withContext);

    const conflict = B.BoxError.fromUnknown("files.getFileById", {
      responseInfo: {
        contextInfo: {
          conflicts: [
            {
              etag: "unsafe-etag",
              id: "456",
              name: "unsafe-name",
              sha1: "unsafe-sha1",
              type: "file",
            },
          ],
          retry: () => undefined,
        },
        statusCode: 409,
      },
    });

    assertSome(
      conflict.context,
      B.BoxApiFailureContext.make({
        values: {
          conflictCount: S.Natural.make(1),
          conflicts: [{ id: "456", type: "file" }],
        },
      })
    );
    assertSome(conflict.status, 409);
  });

  it("retains only the schema error class without issue text", () => {
    const schemaFailure = {
      _tag: "SchemaError",
      message: 'Expected string, got undefined\n  at ["entries"][0]["nextMarker"]',
    };

    const error = B.BoxError.fromUnknown("folders.getFolderItems", schemaFailure);

    assertSome(error.cause, "SchemaError");
  });

  it("excludes confidential sentinels from encoded and rendered Box errors", () => {
    const resourceName = "P1-4 Confidential Matter Alpha";
    const login = "p1-4-login@example.invalid";
    const callbackUrl = "https://callback.invalid/p1-4-secret";
    const bearerToken = "Bearer p1-4-token-abcdef123456";
    const sentinels = [resourceName, login, callbackUrl, bearerToken];

    const sdkFailure = B.BoxError.fromUnknown("folders.createFolder", {
      responseInfo: {
        code: "item_name_in_use",
        contextInfo: {
          callbackUrl,
          conflicts: [
            {
              etag: login,
              id: "987654321",
              name: resourceName,
              pathCollection: { entries: [{ name: callbackUrl }] },
              sha1: bearerToken,
              type: "folder",
            },
          ],
          login,
          token: bearerToken,
        },
        helpUrl: callbackUrl,
        requestId: "request-409-safe",
        statusCode: 409,
      },
    });
    const schemaFailure = B.BoxError.fromUnknown("folders.getFolderItems", {
      _tag: "SchemaError",
      message: `Rejected ${resourceName}; ${login}; ${callbackUrl}; ${bearerToken}`,
    });

    assertSome(
      sdkFailure.context,
      B.BoxApiFailureContext.make({
        values: {
          conflictCount: S.Natural.make(1),
          conflicts: [{ id: "987654321", type: "folder" }],
        },
      })
    );
    assertNone(sdkFailure.helpUrl);
    assertSome(schemaFailure.cause, "SchemaError");
    expect(B.BoxError.toDiagnostic(sdkFailure).provider).toBe("box");

    for (const error of [sdkFailure, schemaFailure]) {
      const renderedForms = [
        JSON.stringify(encode(B.BoxError, error)),
        String(error),
        JSON.stringify(error),
        Cause.pretty(Cause.fail(error)),
      ];

      for (const rendered of renderedForms) {
        for (const sentinel of sentinels) {
          expect(rendered).not.toContain(sentinel);
        }
      }
    }
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

    assertNone(error.status);
    assertNone(outOfRange.status);
    expect(error.sdkVersion).toBe("10.14.0");
  });

  it("sanitizes raw string SDK throws", () => {
    const error = B.BoxError.fromUnknown("users.getUserMe", "Bearer secret-token");

    expect(error.reason).toBe("sdk thrown");
    assertSome(error.cause, "String");
  });

  it("survives SDK throwables whose property access throws", () => {
    const hostile = {
      get name(): string {
        throw new Error("property access denied");
      },
    };

    const error = B.BoxError.fromUnknown("users.getUserMe", hostile);

    expect(error.reason).toBe("sdk thrown");
    assertSome(error.cause, "Unknown");
  });

  it.effect(
    "maps developer-token config failures into BoxError",
    Effect.fnUntraced(function* () {
      const exit = yield* Effect.exit(
        B.BoxConfig.pipe(
          provideScopedLayer(
            B.BoxConfigLayer.pipe(EffectLayer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({}))))
          )
        )
      );

      pipe(exit, Exit.isFailure, assertTrue);
      if (Exit.isFailure(exit)) {
        const error = Cause.findErrorOption(exit.cause);
        pipe(error, O.isSome, assertTrue);
        if (O.isSome(error)) {
          expect(error.value).toBeInstanceOf(B.BoxError);
          expect(error.value.reason).toBe("config");
          expect(error.value.sdkVersion).toBe("10.14.0");
        }
      }
    })
  );

  it.effect(
    "rejects CCG config without an enterprise or user subject",
    Effect.fnUntraced(function* () {
      const exit = yield* Effect.exit(
        decodeBBoxCcgConfig({
          clientId: "client-id",
          clientSecret: Redacted.make("client-secret"),
        })
      );

      pipe(exit, Exit.isFailure, assertTrue);
    })
  );

  it.effect(
    "rejects ambiguous CCG config with both enterprise and user subjects",
    Effect.fnUntraced(function* () {
      const exit = yield* Effect.exit(
        decodeBBoxCcgConfig({
          clientId: "client-id",
          clientSecret: Redacted.make("client-secret"),
          enterpriseId: "enterprise-id",
          userId: "user-id",
        })
      );

      pipe(exit, Exit.isFailure, assertTrue);
    })
  );

  // The SDK deserializers materialize absent response fields as present-but-
  // undefined keys. Exact-optional schema keys reject those, which silently
  // broke every real Box call whose response omitted an optional field (the
  // mirror-root probe read it as "disconnected" rather than a decode failure).
  it.layer(
    B.Box.makeLayerFromClient(
      makeFakeClient({
        users: {
          getUserMe: (_queryParams, _headersInput, _cancellationToken) =>
            Promise.resolve({ ...userFull, jobTitle: undefined, phone: undefined }),
        },
      })
    ),
    { timeout: "10 seconds" }
  )((it) => {
    it.effect(
      "decodes responses whose absent optional fields are present-but-undefined keys",
      Effect.fnUntraced(function* () {
        const box = yield* B.Box;
        const response = yield* box.users.getUserMe(B.UsersGetUserMePayload.make({}));

        expect(response).toBeInstanceOf(B.UserFull);
        expect(response.id).toBe("user-id");
      })
    );
  });

  // A response carrying a raw `__proto__` key still decodes. (The normalizer
  // writes keys with `defineProperty` so the legacy prototype setter is never
  // invoked; that hardening is not otherwise observable here, because schema
  // decoding ignores the unknown key either way.)
  it.layer(
    B.Box.makeLayerFromClient(
      makeFakeClient({
        users: {
          getUserMe: (_queryParams, _headersInput, _cancellationToken) =>
            Promise.resolve(JSON.parse(`{"id":"user-id","type":"user","__proto__":{"polluted":true}}`)),
        },
      })
    ),
    { timeout: "10 seconds" }
  )((it) => {
    it.effect(
      "decodes responses carrying a raw __proto__ key",
      Effect.fnUntraced(function* () {
        const box = yield* B.Box;
        const response = yield* box.users.getUserMe(B.UsersGetUserMePayload.make({}));

        expect(response.id).toBe("user-id");
      })
    );
  });

  it.layer(B.Box.makeLayerFromClient(makeFakeClient()), { timeout: "10 seconds" })((it) => {
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

        pipe(B.BoxMethodName.is["downloads.downloadFile"]("downloads.downloadFile"), assertTrue);
        pipe(B.BoxMethodName.is["downloads.getDownloadFileUrl"]("downloads.getDownloadFileUrl"), assertTrue);
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

  it.layer(B.Box.makeLayerFromClient(provisioningClient), { timeout: "10 seconds" })((it) => {
    it.effect(
      "decodes every Box provisioning discovery surface",
      Effect.fnUntraced(function* () {
        const box = yield* B.Box;
        const file = yield* box.files.getFileById(B.FilesGetFileByIdPayload.make({ fileId: "file-id" }));
        const folder = yield* box.folders.getFolderById(B.FoldersGetFolderByIdPayload.make({ folderId: "folder-id" }));
        const folderItems = yield* box.folders.getFolderItems(
          B.FoldersGetFolderItemsPayload.make({ folderId: "folder-id" })
        );
        const folderMetadata = yield* box.folderMetadata.getFolderMetadata(
          B.FolderMetadataGetFolderMetadataPayload.make({ folderId: "folder-id" })
        );
        const folderCollaborations = yield* box.listCollaborations.getFolderCollaborations(
          B.ListCollaborationsGetFolderCollaborationsPayload.make({ folderId: "folder-id" })
        );
        const pendingCollaborations = yield* box.listCollaborations.getCollaborations(
          B.ListCollaborationsGetCollaborationsPayload.make({ queryParams: { status: "pending" } })
        );
        const fileCollaborations = yield* box.listCollaborations.getFileCollaborations(
          B.ListCollaborationsGetFileCollaborationsPayload.make({ fileId: "file-id" })
        );
        const groupCollaborations = yield* box.listCollaborations.getGroupCollaborations(
          B.ListCollaborationsGetGroupCollaborationsPayload.make({ groupId: "group-id" })
        );
        const cascadePolicies = yield* box.metadataCascadePolicies.getMetadataCascadePolicies(
          B.MetadataCascadePoliciesGetMetadataCascadePoliciesPayload.make({ queryParams: { folderId: "folder-id" } })
        );
        const metadataTemplates = yield* box.metadataTemplates.getEnterpriseMetadataTemplates(
          B.MetadataTemplatesGetEnterpriseMetadataTemplatesPayload.make({})
        );
        const globalMetadataTemplates = yield* box.metadataTemplates.getGlobalMetadataTemplates(
          B.MetadataTemplatesGetGlobalMetadataTemplatesPayload.make({})
        );
        const instanceMetadataTemplates = yield* box.metadataTemplates.getMetadataTemplatesByInstanceId(
          B.MetadataTemplatesGetMetadataTemplatesByInstanceIdPayload.make({
            queryParams: { metadataInstanceId: "instance-id" },
          })
        );
        const retentionPolicies = yield* box.retentionPolicies.getRetentionPolicies(
          B.RetentionPoliciesGetRetentionPoliciesPayload.make({})
        );
        const retentionAssignments = yield* box.retentionPolicyAssignments.getRetentionPolicyAssignments(
          B.RetentionPolicyAssignmentsGetRetentionPolicyAssignmentsPayload.make({ retentionPolicyId: "policy-id" })
        );
        const signRequests = yield* box.signRequests.getSignRequests(B.SignRequestsGetSignRequestsPayload.make({}));
        const signTemplates = yield* box.signTemplates.getSignTemplates(
          B.SignTemplatesGetSignTemplatesPayload.make({})
        );
        const collaboration = yield* box.userCollaborations.getCollaborationById(
          B.UserCollaborationsGetCollaborationByIdPayload.make({ collaborationId: "collaboration-id" })
        );
        const users = yield* box.users.getUsers(B.UsersGetUsersPayload.make({}));
        const webhooks = yield* box.webhooks.getWebhooks(B.WebhooksGetWebhooksPayload.make({}));

        expect(file).toBeInstanceOf(B.FileFull);
        expect(folder).toBeInstanceOf(B.FolderFull);
        expect(folderItems).toBeInstanceOf(B.Items);
        expect(folderMetadata).toBeInstanceOf(B.Metadatas);
        expect(folderCollaborations).toBeInstanceOf(B.Collaborations);
        expect(pendingCollaborations).toBeInstanceOf(B.CollaborationsOffsetPaginated);
        expect(fileCollaborations).toBeInstanceOf(B.Collaborations);
        expect(groupCollaborations).toBeInstanceOf(B.CollaborationsOffsetPaginated);
        expect(cascadePolicies).toBeInstanceOf(B.MetadataCascadePolicies);
        expect(metadataTemplates).toBeInstanceOf(B.MetadataTemplates);
        expect(globalMetadataTemplates).toBeInstanceOf(B.MetadataTemplates);
        expect(instanceMetadataTemplates).toBeInstanceOf(B.MetadataTemplates);
        expect(retentionPolicies).toBeInstanceOf(B.RetentionPolicies);
        expect(retentionAssignments).toBeInstanceOf(B.RetentionPolicyAssignments);
        expect(signRequests).toBeInstanceOf(B.SignRequests);
        expect(signTemplates).toBeInstanceOf(B.SignTemplates);
        expect(collaboration).toBeInstanceOf(B.Collaboration);
        expect(users).toBeInstanceOf(B.Users);
        expect(webhooks).toBeInstanceOf(B.Webhooks);
      })
    );

    it.effect(
      "exposes the provisioning mutation operations required by the reconciler",
      Effect.fnUntraced(function* () {
        const box = yield* B.Box;

        pipe(P.isFunction(box.userCollaborations.createCollaboration), assertTrue);
        pipe(P.isFunction(box.userCollaborations.updateCollaborationById), assertTrue);
        pipe(P.isFunction(box.userCollaborations.deleteCollaborationById), assertTrue);
        pipe(P.isFunction(box.webhooks.createWebhook), assertTrue);
        pipe(P.isFunction(box.webhooks.updateWebhookById), assertTrue);
        pipe(P.isFunction(box.webhooks.deleteWebhookById), assertTrue);
        pipe(P.isFunction(box.signRequests.createSignRequest), assertTrue);
        pipe(P.isFunction(box.signRequests.cancelSignRequest), assertTrue);
        pipe(P.isFunction(box.signRequests.resendSignRequest), assertTrue);
      })
    );
  });

  it.layer(
    B.Box.makeLayerFromClient(makeFakeClient({ downloads: { downloadFile: () => Promise.resolve(undefined) } })),
    { timeout: "10 seconds" }
  )((it) => {
    it.effect(
      "fails byte downloads when the SDK returns no stream",
      Effect.fnUntraced(function* () {
        const box = yield* B.Box;
        const exit = yield* Effect.exit(box.downloads.downloadFile({ fileId: "file-id" }).pipe(Stream.runCollect));

        pipe(exit, Exit.isFailure, assertTrue);
        if (Exit.isFailure(exit)) {
          const error = Cause.findErrorOption(exit.cause);
          pipe(error, O.isSome, assertTrue);
          if (O.isSome(error)) {
            expect(error.value).toBeInstanceOf(B.BoxError);
            expect(error.value.reason).toBe("stream");
            assertSome(error.value.method, "downloads.downloadFile");
          }
        }
      })
    );
  });

  it.layer(
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
    ),
    { timeout: "10 seconds" }
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

  it.layer(
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
    ),
    { timeout: "10 seconds" }
  )((it) => {
    it.effect(
      "translates SDK throws into sanitized BoxError values",
      Effect.fnUntraced(function* () {
        const box = yield* B.Box;
        const exit = yield* Effect.exit(box.users.getUserMe(B.UsersGetUserMePayload.make({})));

        pipe(exit, Exit.isFailure, assertTrue);
        if (Exit.isFailure(exit)) {
          const error = Cause.findErrorOption(exit.cause);
          pipe(error, O.isSome, assertTrue);
          if (O.isSome(error)) {
            expect(error.value).toBeInstanceOf(B.BoxError);
            expect(error.value.reason).toBe("response status");
            assertSome(error.value.method, "users.getUserMe");
            assertSome(error.value.status, 429);
            assertSome(error.value.code, "rate_limit");
            assertSome(error.value.requestId, "request-id");
            assertNone(error.value.context);
            assertNone(error.value.helpUrl);
            expect(error.value.sdkVersion).toBe("10.14.0");
            assertSome(error.value.cause, "Unknown");
          }
        }
      })
    );
  });

  const uploaded: { content: string | undefined } = { content: undefined };

  it.layer(
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
    ),
    { timeout: "10 seconds" }
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

  it.layer(
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
    ),
    { timeout: "10 seconds" }
  )((it) => {
    it.effect("preserves direct caller cancellation tokens for generated methods", () => {
      // The controller is the caller's, which is the whole point of the test:
      // `Effect.abortSignal` would hand the driver Effect's own signal and prove
      // nothing about a token supplied from outside. Built here rather than in
      // the generator so it reads as fixture setup, not effectful work.
      const callerController = new AbortController();

      return Effect.gen(function* () {
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
      });
    });
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

  it.layer(
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
    ),
    { timeout: "10 seconds" }
  )((it) => {
    it.effect("preserves optionalsInput caller cancellation tokens for generated methods", () => {
      // Caller-supplied on purpose, as above.
      const callerController = new AbortController();

      return Effect.gen(function* () {
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
      });
    });
  });

  const eventStream = new FakeEventStream([
    {
      eventId: "event-id",
      eventType: "FUTURE_BOX_EVENT",
      type: "event",
    },
  ]);

  it.layer(B.Box.makeLayerFromClient(makeFakeClient({ events: { getEventStream: () => eventStream } })), {
    timeout: "10 seconds",
  })((it) => {
    it.effect(
      "streams SDK event objects and closes the SDK readable",
      Effect.fnUntraced(function* () {
        const box = yield* B.Box;
        const events = yield* box.events.getEventStream({}).pipe(Stream.runCollect);
        const values = A.fromIterable(events);

        expect(A.map(values, (event) => event.eventType)).toEqual(["FUTURE_BOX_EVENT"]);
        pipe(eventStream.wasClosed, assertTrue);
      })
    );
  });

  it.effect(
    "closes a still-open SDK event readable when the consumer takes one event",
    Effect.fnUntraced(function* () {
      const source = new FakeEventStream(
        [{ eventId: "early-event", eventType: "FUTURE_BOX_EVENT", type: "event" }],
        true
      );
      const events = yield* B.Box.use((box) =>
        box.events.getEventStream({}).pipe(Stream.take(1), Stream.runCollect)
      ).pipe(
        provideScopedLayer(B.Box.makeLayerFromClient(makeFakeClient({ events: { getEventStream: () => source } })))
      );

      expect(A.map(A.fromIterable(events), (event) => event.eventId)).toEqual(["early-event"]);
      pipe(source.readableEnded, assertFalse);
      pipe(source.wasClosed, assertTrue);
      expect(source.listenerCount("readable")).toBe(0);
      expect(source.listenerCount("end")).toBe(0);
      expect(source.listenerCount("error")).toBe(0);
    })
  );

  it.effect(
    "closes a still-open SDK event readable and removes listeners on interruption",
    Effect.fnUntraced(function* () {
      const entered = Promise.withResolvers<void>();
      const source = new FakeEventStream([], true, entered.resolve);
      const fiber = yield* B.Box.use((box) => box.events.getEventStream({}).pipe(Stream.runCollect)).pipe(
        provideScopedLayer(B.Box.makeLayerFromClient(makeFakeClient({ events: { getEventStream: () => source } }))),
        Effect.forkChild
      );
      yield* Effect.promise(() => entered.promise);
      pipe(source.wasClosed, assertFalse);
      expect(source.listenerCount("readable")).toBeGreaterThan(0);
      yield* Fiber.interrupt(fiber);
      const exit = yield* Fiber.await(fiber);
      pipe(exit, Exit.isFailure, assertTrue);
      pipe(source.readableEnded, assertFalse);
      pipe(source.wasClosed, assertTrue);
      expect(source.listenerCount("readable")).toBe(0);
      expect(source.listenerCount("end")).toBe(0);
      expect(source.listenerCount("error")).toBe(0);
    })
  );

  const invalidEventStream = new FakeEventStream([
    { createdAt: 123 },
    {
      eventId: "event-id-after-invalid-payload",
      eventType: "FUTURE_BOX_EVENT",
      type: "event",
    },
  ]);

  it.layer(B.Box.makeLayerFromClient(makeFakeClient({ events: { getEventStream: () => invalidEventStream } })), {
    timeout: "10 seconds",
  })((it) => {
    it.effect(
      "fails event streams and closes the SDK readable when payloads cannot decode",
      Effect.fnUntraced(function* () {
        const box = yield* B.Box;
        const exit = yield* Effect.exit(box.events.getEventStream({}).pipe(Stream.runCollect));

        pipe(exit, Exit.isFailure, assertTrue);
        pipe(invalidEventStream.wasClosed, assertTrue);
        if (Exit.isFailure(exit)) {
          const error = Cause.findErrorOption(exit.cause);
          pipe(error, O.isSome, assertTrue);
          if (O.isSome(error)) {
            expect(error.value).toBeInstanceOf(B.BoxError);
            expect(error.value.reason).toBe("response decoding");
            assertSome(error.value.method, "events.getEventStream");
          }
        }
      })
    );
  });
});

describe("Box layer constructors", () => {
  it.layer(B.Box.makeLayer(B.BoxDeveloperTokenConfig.make({ token: Redacted.make("box-token") })), {
    timeout: "10 seconds",
  })((it) => {
    it.effect(
      "builds a developer-token layer from explicit configuration",
      Effect.fnUntraced(function* () {
        const box = yield* B.Box;

        pipe(P.isFunction(box.users.getUserMe), assertTrue);
        pipe(P.isFunction(box.downloads.downloadFile), assertTrue);
      })
    );
  });

  it.layer(
    B.Box.makeCcgLayer(
      B.BoxCcgConfig.make({
        clientId: "client-id",
        clientSecret: Redacted.make("client-secret"),
        enterpriseId: O.some("enterprise-id"),
      })
    ),
    { timeout: "10 seconds" }
  )((it) => {
    it.effect(
      "builds a client-credentials layer from explicit configuration",
      Effect.fnUntraced(function* () {
        const box = yield* B.Box;

        pipe(P.isFunction(box.users.getUserMe), assertTrue);
      })
    );
  });

  it.layer(
    B.Box.layer.pipe(
      EffectLayer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown({ CLOUD_BOX_TOKEN: "box-token" })))
    ),
    { timeout: "10 seconds" }
  )((it) => {
    it.effect(
      "builds the live developer-token layer from CLOUD_BOX_TOKEN",
      Effect.fnUntraced(function* () {
        const box = yield* B.Box;

        pipe(P.isFunction(box.users.getUserMe), assertTrue);
      })
    );
  });
});
