import {
  BoxAdoption,
  BoxAdoptions,
  BoxCollaborationIntent,
  BoxDesiredState,
  BoxDiscoveryAvailable,
  BoxEntitlements,
  BoxFolderIntent,
  BoxLogicalKey,
  BoxMetadataIntent,
  BoxObservedCollaboration,
  BoxObservedFolder,
  BoxObservedState,
  BoxObservedWebhook,
  BoxProviderId,
  BoxProviderRevision,
  BoxRetentionIntent,
  BoxSourceRevision,
  BoxWebhookIntent,
  boxFolderNamesEquivalent,
} from "@beep/box-provisioning";
import { HttpsUrl } from "@beep/schema";
import { sha1 } from "@noble/hashes/legacy.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { pipe } from "effect";
import * as A from "effect/Array";
import * as Num from "effect/Number";
import * as O from "effect/Option";

const workspaceKey = BoxLogicalKey.make("folder.workspace");
const childKey = BoxLogicalKey.make("folder.child");

export const desiredFixture = BoxDesiredState.make({
  adoptions: BoxAdoptions.make({
    entries: [
      BoxAdoption.make({
        expectedParentProviderId: BoxProviderId.make("0"),
        expectedProviderId: BoxProviderId.make("100"),
        logicalKey: workspaceKey,
        resourceKind: "folder",
      }),
    ],
  }),
  sourceRevision: BoxSourceRevision.make("intent-1"),
  expectedEnterpriseId: BoxProviderId.make("enterprise-id"),
  expectedSubjectId: BoxProviderId.make("service-account-id"),
  rootFolderId: BoxProviderId.make("0"),
  entitlements: BoxEntitlements.make({
    externalCollaboratorsRequirePaidSeats: true,
    metadata: "unavailable",
    planName: "Business",
    retention: "unavailable",
    signCustomIntegrationAnnualAllowance: O.some(100),
  }),
  folders: [
    BoxFolderIntent.make({ logicalKey: workspaceKey, name: "Fixture workspace", parentKey: O.none() }),
    BoxFolderIntent.make({ logicalKey: childKey, name: "Fixture child", parentKey: O.some(workspaceKey) }),
  ],
  collaborations: [
    BoxCollaborationIntent.make({
      billingImpact: "external",
      folderKey: childKey,
      logicalKey: BoxLogicalKey.make("collaboration.fixture"),
      principal: "collaborator@example.test",
      principalType: "user",
      role: "editor",
    }),
  ],
  webhooks: [
    BoxWebhookIntent.make({
      address: HttpsUrl.make("https://example.test/box/events"),
      folderKey: workspaceKey,
      logicalKey: BoxLogicalKey.make("webhook.workspace"),
      triggers: ["FILE.UPLOADED"],
    }),
  ],
  metadata: [
    BoxMetadataIntent.make({
      folderKey: childKey,
      logicalKey: BoxLogicalKey.make("metadata.child"),
      templateKey: "fixture_properties",
    }),
  ],
  retention: [
    BoxRetentionIntent.make({
      folderKey: childKey,
      logicalKey: BoxLogicalKey.make("retention.child"),
      policyKey: "records-policy",
    }),
  ],
});

const available = (kind: "metadata" | "retention" | "signRequests" | "signTemplates") =>
  BoxDiscoveryAvailable.make({ count: 0, kind });

export const observedFixture = BoxObservedState.make({
  enterpriseId: BoxProviderId.make("enterprise-id"),
  subjectId: BoxProviderId.make("service-account-id"),
  rootFolderId: BoxProviderId.make("0"),
  folders: [
    BoxObservedFolder.make({
      etag: O.some(BoxProviderRevision.make("etag-workspace")),
      name: "Fixture workspace",
      parentProviderId: O.some(BoxProviderId.make("0")),
      providerId: BoxProviderId.make("100"),
    }),
    BoxObservedFolder.make({
      etag: O.none(),
      name: "Foreign staging drop",
      parentProviderId: O.some(BoxProviderId.make("0")),
      providerId: BoxProviderId.make("999"),
    }),
  ],
  collaborations: [],
  webhooks: [],
  metadata: available("metadata"),
  retention: available("retention"),
  signRequests: available("signRequests"),
  signTemplates: available("signTemplates"),
});

export const postApplyAdoptionsFixture = [
  BoxAdoption.make({
    expectedParentProviderId: BoxProviderId.make("100"),
    expectedProviderId: BoxProviderId.make("101"),
    logicalKey: childKey,
    resourceKind: "folder",
  }),
];

export const observedAfterApplyFixture = BoxObservedState.make({
  ...observedFixture,
  folders: [
    ...observedFixture.folders,
    BoxObservedFolder.make({
      etag: O.some(BoxProviderRevision.make("etag-child")),
      name: "Fixture child",
      parentProviderId: O.some(BoxProviderId.make("100")),
      providerId: BoxProviderId.make("101"),
    }),
  ],
  collaborations: [
    BoxObservedCollaboration.make({
      folderProviderId: BoxProviderId.make("101"),
      principal: "collaborator@example.test",
      principalProviderId: O.none(),
      principalType: "user",
      providerId: BoxProviderId.make("200"),
      role: "editor",
    }),
  ],
  webhooks: [
    BoxObservedWebhook.make({
      address: HttpsUrl.make("https://example.test/box/events"),
      providerId: BoxProviderId.make("300"),
      targetProviderId: BoxProviderId.make("100"),
      triggers: ["FILE.UPLOADED"],
    }),
  ],
});

/** One item held by the in-memory fake Box tenant. */
export type FakeBoxEntry = {
  readonly id: string;
  readonly name: string;
  readonly parentId: string;
  /** Lowercase hex SHA-1 for files; absent for folders and web links. */
  readonly sha1?: string;
  readonly type: "file" | "folder" | "web_link";
};

/** Initial identity, page size, and content of the in-memory fake Box tenant. */
export type FakeBoxOptions = {
  readonly enterpriseId?: string;
  readonly entries?: ReadonlyArray<FakeBoxEntry>;
  readonly pageSize?: number;
  readonly subjectId?: string;
};

type FakeByteSource = { readonly toArray: () => Promise<ReadonlyArray<Uint8Array>> };

type FakeUploadRequest = {
  readonly attributes: { readonly name: string; readonly parent: { readonly id: string } };
  readonly file: FakeByteSource;
};

type FakeUploadOptionals = { readonly headers?: { readonly contentMd5?: string } };

type FakeListOptionals = { readonly queryParams?: { readonly marker?: string } };

type FakeFolderRequest = { readonly name: string; readonly parent: { readonly id: string } };

/** One upload request the fake received, whether or not it was stored. */
type FakeBoxUpload = {
  readonly contentMd5: O.Option<string>;
  readonly name: string;
  readonly parentId: string;
  readonly stored: boolean;
  readonly transport: "chunked" | "single";
};

const removeFirst = (values: ReadonlyArray<string>, value: string): ReadonlyArray<string> =>
  O.match(
    A.findFirstIndex(values, (candidate) => candidate === value),
    { onNone: () => values, onSome: (index) => A.remove(values, index) }
  );

const reject = (statusCode: number, code: string): Promise<never> =>
  Promise.reject({ responseInfo: { code, statusCode } });

/**
 * In-memory Box tenant exposing the SDK client surface the content migration uses.
 *
 * Folders and files live in one flat list keyed by parent id. Sibling names are
 * unique case-insensitively, uploads never replace an existing item, and every
 * SDK call is counted so tests can prove what did not happen.
 */
export const makeFakeBox = (options: FakeBoxOptions = {}) => {
  let entries: ReadonlyArray<FakeBoxEntry> = options.entries ?? A.empty();
  let nextId = 5000;
  let uploads = A.empty<FakeBoxUpload>();
  let listedFolderIds = A.empty<string>();
  let failUploadsOnce: ReadonlyArray<string> = A.empty();
  let corruptUploads = A.empty<string>();
  let failFolders = A.empty<string>();
  let raceFolders: ReadonlyArray<string> = A.empty();
  let failListingsOnce: ReadonlyArray<string> = A.empty();
  let malformedFolders = A.empty<string>();
  let emptyUploadResponses = A.empty<string>();
  let hashlessUploads = A.empty<string>();
  const calls = { createFolder: 0, getFolderItems: 0, getUserMe: 0, uploadBigFile: 0, uploadFile: 0 };
  const pageSize = options.pageSize ?? 1000;

  const allocateId = (): string => {
    nextId += 1;
    return `${nextId}`;
  };
  const siblings = (parentId: string) => A.filter(entries, (entry) => entry.parentId === parentId);
  const occupied = (parentId: string, name: string) =>
    A.some(siblings(parentId), (entry) => boxFolderNamesEquivalent(entry.name, name));
  const itemJson = (entry: FakeBoxEntry) =>
    entry.type === "file"
      ? { id: entry.id, name: entry.name, sha1: entry.sha1, type: entry.type }
      : entry.name === ""
        ? { id: entry.id, type: entry.type }
        : { id: entry.id, name: entry.name, type: entry.type };

  const store = (
    transport: FakeBoxUpload["transport"],
    parentId: string,
    name: string,
    chunks: ReadonlyArray<Uint8Array>,
    contentMd5: O.Option<string>
  ): Promise<unknown> => {
    const record = (stored: boolean) => {
      uploads = A.append(uploads, { contentMd5, name, parentId, stored, transport });
    };
    if (A.contains(failUploadsOnce, name)) {
      failUploadsOnce = removeFirst(failUploadsOnce, name);
      record(false);
      return reject(503, "unavailable");
    }
    if (occupied(parentId, name)) {
      record(false);
      return reject(409, "item_name_in_use");
    }
    const hasher = sha1.create();
    A.forEach(chunks, (chunk) => hasher.update(chunk));
    const actualSha1 = bytesToHex(hasher.digest());
    if (O.isSome(contentMd5) && contentMd5.value !== actualSha1) {
      record(false);
      return reject(400, "bad_digest");
    }
    const storedSha1 = A.contains(corruptUploads, name) ? "0".repeat(40) : actualSha1;
    const entry: FakeBoxEntry = { id: allocateId(), name, parentId, sha1: storedSha1, type: "file" };
    entries = A.append(entries, entry);
    record(true);
    const stored = {
      id: entry.id,
      name,
      parent: { id: parentId, type: "folder" },
      size: A.reduce(chunks, 0, (total, chunk) => total + chunk.byteLength),
      type: "file",
    };
    return Promise.resolve(A.contains(hashlessUploads, name) ? stored : { ...stored, sha1: storedSha1 });
  };

  const client = {
    chunkedUploads: {
      uploadBigFile: (file: FakeByteSource, fileName: string, _fileSize: number, parentFolderId: string) => {
        calls.uploadBigFile += 1;
        return file.toArray().then((chunks) => store("chunked", parentFolderId, fileName, chunks, O.none()));
      },
    },
    folders: {
      createFolder: (requestBody: FakeFolderRequest, _optionalsInput: unknown): Promise<unknown> => {
        calls.createFolder += 1;
        const { name, parent } = requestBody;
        if (A.contains(failFolders, name)) {
          return reject(503, "unavailable");
        }
        if (A.contains(raceFolders, name)) {
          // A concurrent writer wins the create between the plan and this request.
          raceFolders = removeFirst(raceFolders, name);
          entries = A.append(entries, { id: allocateId(), name, parentId: parent.id, type: "folder" });
          return reject(409, "item_name_in_use");
        }
        if (occupied(parent.id, name)) {
          return reject(409, "item_name_in_use");
        }
        const entry: FakeBoxEntry = { id: allocateId(), name, parentId: parent.id, type: "folder" };
        entries = A.append(entries, entry);
        return Promise.resolve({
          etag: "0",
          id: entry.id,
          name,
          // A malformed response names a parent the request never asked for.
          parent: { id: A.contains(malformedFolders, name) ? "unexpected-parent" : parent.id, type: "folder" },
          type: "folder",
        });
      },
      getFolderItems: (folderId: string, optionalsInput: FakeListOptionals): Promise<unknown> => {
        calls.getFolderItems += 1;
        listedFolderIds = A.append(listedFolderIds, folderId);
        if (A.contains(failListingsOnce, folderId)) {
          failListingsOnce = removeFirst(failListingsOnce, folderId);
          return reject(503, "unavailable");
        }
        const start = pipe(
          O.fromNullishOr(optionalsInput.queryParams?.marker),
          O.flatMap(Num.parse),
          O.getOrElse(() => 0)
        );
        const all = siblings(folderId);
        const page = A.map(A.take(A.drop(all, start), pageSize), itemJson);
        const end = start + A.length(page);
        return Promise.resolve(end < A.length(all) ? { entries: page, nextMarker: `${end}` } : { entries: page });
      },
    },
    uploads: {
      uploadFile: (requestBody: FakeUploadRequest, optionalsInput: FakeUploadOptionals): Promise<unknown> => {
        calls.uploadFile += 1;
        const { name, parent } = requestBody.attributes;
        return requestBody.file
          .toArray()
          .then((chunks) =>
            store("single", parent.id, name, chunks, O.fromNullishOr(optionalsInput.headers?.contentMd5))
          )
          .then((file) =>
            A.contains(emptyUploadResponses, name) ? { entries: [], totalCount: 0 } : { entries: [file], totalCount: 1 }
          );
      },
    },
    users: {
      getUserMe: (_queryParams: unknown): Promise<unknown> => {
        calls.getUserMe += 1;
        return Promise.resolve({
          enterprise: { id: options.enterpriseId ?? "enterprise-id", type: "enterprise" },
          id: options.subjectId ?? "service-account-id",
          type: "user",
        });
      },
    },
  };

  return {
    addEntry: (entry: FakeBoxEntry): void => {
      entries = A.append(entries, entry);
    },
    calls,
    client,
    /** Store the next upload of `name` with a wrong SHA-1, as a corrupted transfer would. */
    corruptUpload: (name: string): void => {
      corruptUploads = A.append(corruptUploads, name);
    },
    /** Answer the next upload of `name` with an empty entry list, although the file was stored. */
    emptyUploadResponse: (name: string): void => {
      emptyUploadResponses = A.append(emptyUploadResponses, name);
    },
    entries: (): ReadonlyArray<FakeBoxEntry> => entries,
    /** Reject only the next listing of folder `folderId` with a 503. */
    failListingOnce: (folderId: string): void => {
      failListingsOnce = A.append(failListingsOnce, folderId);
    },
    /** Answer uploads of `name` without a `sha1`, although the file was stored. */
    hashlessUpload: (name: string): void => {
      hashlessUploads = A.append(hashlessUploads, name);
    },
    /** Answer creates of a folder named `name` with a parent the request did not name. */
    malformFolder: (name: string): void => {
      malformedFolders = A.append(malformedFolders, name);
    },
    /** Reject every create of a folder named `name` with a 503. */
    failFolder: (name: string): void => {
      failFolders = A.append(failFolders, name);
    },
    /** Reject only the next upload of `name` with a 503. */
    failUploadOnce: (name: string): void => {
      failUploadsOnce = A.append(failUploadsOnce, name);
    },
    listedFolderIds: (): ReadonlyArray<string> => listedFolderIds,
    /** Let a concurrent writer create the folder named `name` just before the next create request. */
    raceFolder: (name: string): void => {
      raceFolders = A.append(raceFolders, name);
    },
    /** Total SDK calls of every kind received so far. */
    totalCalls: (): number =>
      calls.createFolder + calls.getFolderItems + calls.getUserMe + calls.uploadBigFile + calls.uploadFile,
    uploads: (): ReadonlyArray<FakeBoxUpload> => uploads,
  };
};

/** Fake Box tenant returned by {@link makeFakeBox}. */
export type FakeBox = ReturnType<typeof makeFakeBox>;
