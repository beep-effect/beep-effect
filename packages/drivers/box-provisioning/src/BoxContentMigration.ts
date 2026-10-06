/**
 * Dry-run-first, resumable migration of local files into an existing Box folder tree.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import * as B from "@beep/box";
import { $BoxProvisioningId } from "@beep/identity";
import { Sha256Hex } from "@beep/schema";
import * as NodeCrypto from "@effect/platform-node-shared/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node-shared/NodeFileSystem";
import * as NodePath from "@effect/platform-node-shared/NodePath";
import {
  Context,
  DateTime,
  Effect,
  Layer,
  Match,
  MutableHashMap,
  MutableHashSet,
  Order,
  pipe,
  Ref,
  Semaphore,
} from "effect";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Stream from "effect/Stream";
import * as Str from "effect/String";
import { decodeBoxContentMigrationMap } from "./BoxContentMigrationMap.ts";
import {
  BoxContentBlockedNameConflict,
  BoxContentBlockedSourceChanged,
  BoxContentBlockedSourceMissing,
  BoxContentFolderCreate,
  BoxContentFolderExists,
  BoxContentMigrationPlan,
  BoxContentMigrationPlanSummary,
  BoxContentRuleUploadCount,
  BoxContentSkipIdentical,
  BoxContentUpload,
  decodeBoxContentMigrationPlan,
} from "./BoxContentMigrationPlan.ts";
import {
  BoxContentActionApplied,
  BoxContentActionBlocked,
  BoxContentActionFailed,
  BoxContentActionNotAttempted,
  BoxContentActionSkipped,
  BoxContentJournalAdoptedExistingFolder,
  BoxContentJournalApplied,
  BoxContentJournalFailed,
  BoxContentJournalSkipped,
  BoxContentJournalStarted,
  BoxContentMigrationApplyResult,
  BoxContentMigrationCounts,
  BoxContentMigrationReceipt,
} from "./BoxContentMigrationReceipt.ts";
import {
  BoxContentMigrationBudgetError,
  BoxContentMigrationMapError,
  BoxProvisioningDriftError,
  BoxProvisioningInvariantError,
  BoxProvisioningSchemaError,
} from "./BoxProvisioningErrors.ts";
import { boxFolderNamesEquivalent, boxNameEquivalenceKey } from "./BoxProvisioningIntent.ts";
import { BoxProviderId } from "./BoxProvisioningObserved.ts";
import { BoxApplyAttemptId } from "./BoxProvisioningReceipt.ts";
import {
  boxContentMigrationMapDigest,
  digestEncoded,
  hasValidBoxContentMigrationPlanDigest,
  sealBoxContentMigrationPlan,
} from "./internal/canonical.ts";
import { hashFileContent } from "./internal/contentHash.ts";
import { contentPathKey, contentPathKeys, requiredContentFolders } from "./internal/contentMigration.ts";
import {
  assertExpectedBoxIdentity,
  collectMarkerPages,
  loadFolderItemsPage,
  markerPageLimit,
  observeBoxIdentity,
} from "./internal/live.ts";
import type * as PlatformError from "effect/PlatformError";
import type { BoxContentMigrationFile, BoxContentMigrationMap } from "./BoxContentMigrationMap.ts";
import type { BoxContentFileAction, BoxContentFolderAction } from "./BoxContentMigrationPlan.ts";
import type {
  BoxContentActionOutcome,
  BoxContentFailureKind,
  BoxContentJournalEntry,
} from "./BoxContentMigrationReceipt.ts";
import type {
  BoxProvisioningApplyJournalError,
  BoxProvisioningSubjectMismatchError,
  BoxProvisioningTenantMismatchError,
} from "./BoxProvisioningErrors.ts";
import type { BoxCanonicalDigestError } from "./internal/canonical.ts";
import type { RequiredContentFolder } from "./internal/contentMigration.ts";

const $I = $BoxProvisioningId.create("BoxContentMigration");

const mebibyte = 1024 * 1024;

/** Box rejects chunked upload sessions for files smaller than 20 MiB. */
const minimumChunkedThresholdBytes = 20 * mebibyte;

/**
 * Smallest part size Box assigns to an upload session. Larger files get larger
 * parts, so dividing by this value never undercounts the part requests.
 */
const minimumChunkedPartBytes = 8 * mebibyte;

/** Session create, part listing, and commit requests around the part uploads. */
const chunkedSessionOverheadCalls = 3;

const sourceInspectionConcurrency = 4;

const sha256Equivalence = S.toEquivalence(Sha256Hex);

/**
 * Tuning and safety limits for one content-migration plan or apply.
 *
 * **Details**
 *
 * `chunkedThresholdBytes` (default 50 MiB, minimum 20 MiB) selects the chunked
 * route at or above that size and is sealed into the plan, so plan and apply
 * must use the same value. `uploadConcurrency` (default 4) bounds parallel
 * uploads. `maxProviderCalls` is a hard cap on Box calls for the whole run.
 * `attemptId` correlates journal entries; a UUID is generated when absent.
 *
 * **Gotchas**
 *
 * The Box SDK buffers a single-request upload whole and a chunked upload one
 * part at a time, so peak upload memory is about `uploadConcurrency` times
 * `chunkedThresholdBytes`. The budget counts the calls this engine issues; a
 * request the SDK retries internally after a 429 or 5xx is counted once.
 *
 * **Example** (Cap a run at 500 provider calls)
 *
 * ```ts
 * import { BoxContentMigrationOptions } from "@beep/box-provisioning/BoxContentMigration"
 * import * as O from "effect/Option"
 *
 * const options = BoxContentMigrationOptions.make({ maxProviderCalls: O.some(500) })
 * console.log(options.uploadConcurrency) // 4
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class BoxContentMigrationOptions extends S.Class<BoxContentMigrationOptions>($I`BoxContentMigrationOptions`)(
  {
    chunkedThresholdBytes: S.Int.check(S.isGreaterThanOrEqualTo(minimumChunkedThresholdBytes)).pipe(
      S.withConstructorDefault(Effect.succeed(50 * mebibyte))
    ),
    uploadConcurrency: S.Int.check(S.isBetween({ minimum: 1, maximum: 16 })).pipe(
      S.withConstructorDefault(Effect.succeed(4))
    ),
    maxProviderCalls: S.OptionFromOptionalKey(S.Int.check(S.isGreaterThan(0))).pipe(
      S.withConstructorDefault(Effect.succeedNone)
    ),
    attemptId: S.OptionFromOptionalKey(BoxApplyAttemptId).pipe(S.withConstructorDefault(Effect.succeedNone)),
  },
  $I.annote("BoxContentMigrationOptions", {
    description: "Chunked threshold, upload concurrency, provider-call budget, and attempt id for one run.",
  })
) {}

type BudgetPhase = BoxContentMigrationBudgetError["phase"];

type PlanError =
  | B.BoxError
  | BoxProvisioningInvariantError
  | BoxProvisioningSchemaError
  | BoxProvisioningSubjectMismatchError
  | BoxProvisioningTenantMismatchError
  | BoxContentMigrationMapError
  | BoxContentMigrationBudgetError
  | PlatformError.PlatformError;

type ApplyError = PlanError | BoxProvisioningDriftError | BoxProvisioningApplyJournalError;

type Run = {
  readonly box: B.Box["Service"];
  readonly calls: Ref.Ref<number>;
  readonly maxProviderCalls: O.Option<number>;
};

type SourceState =
  | { readonly _tag: "Present"; readonly sha1: string }
  | { readonly _tag: "Missing" }
  | { readonly _tag: "Changed" };

type ListedItem = {
  readonly providerId: BoxProviderId;
  /** Lowercase hex SHA-1 for files; absent for folders and web links. */
  readonly sha1: O.Option<string>;
};

type FolderListing = {
  readonly entryCount: number;
  readonly files: MutableHashMap.MutableHashMap<string, ListedItem>;
  readonly folders: MutableHashMap.MutableHashMap<string, BoxProviderId>;
  readonly others: MutableHashMap.MutableHashMap<string, BoxProviderId>;
  readonly pageCount: number;
};

type PlannedFolder = {
  readonly action: BoxContentFolderAction;
  readonly folder: RequiredContentFolder;
};

type PlannedFile = {
  readonly action: BoxContentFileAction;
  readonly file: BoxContentMigrationFile;
  readonly folderPathKey: string;
  readonly source: SourceState;
};

type SourceStates = MutableHashMap.MutableHashMap<Sha256Hex, SourceState>;

type PlanContext = {
  readonly files: ReadonlyArray<PlannedFile>;
  /** Provider id of every required folder that exists, keyed by provider-equivalent path key. */
  readonly folderIds: MutableHashMap.MutableHashMap<string, BoxProviderId>;
  readonly folders: ReadonlyArray<PlannedFolder>;
  readonly listings: MutableHashMap.MutableHashMap<BoxProviderId, FolderListing>;
  readonly plan: BoxContentMigrationPlan;
  /** Upper bound on the calls the post-apply plan needs once every planned write lands. */
  readonly postPlanReserve: number;
  readonly sources: SourceStates;
};

const rootPathKey = "";

type DigestError = BoxCanonicalDigestError | S.SchemaError;

const digestFailure = (error: DigestError): PlatformError.PlatformError | BoxProvisioningSchemaError =>
  P.isTagged("PlatformError")(error) ? error : BoxProvisioningSchemaError.make({ stage: "migration-plan" });

const hashed = <A>(effect: Effect.Effect<A, DigestError, Crypto.Crypto>) => effect.pipe(Effect.mapError(digestFailure));

const folderPathDigest = (pathKeys: ReadonlyArray<string>) =>
  hashed(digestEncoded({ kind: "box-content-folder", path: pathKeys }));

const fileEntryDigest = (file: BoxContentMigrationFile) =>
  hashed(
    digestEncoded({
      fileName: boxNameEquivalenceKey(file.fileName),
      folderPath: contentPathKeys(file.folderPath),
      kind: "box-content-file",
      sha256: file.sha256,
      sizeBytes: file.sizeBytes,
    })
  );

/** Marker pages a folder listing needs for `entryCount` entries; exact multiples cost one extra page. */
const listingPages = (entryCount: number): number => Math.floor(entryCount / markerPageLimit) + 1;

const uploadProviderCalls = (action: BoxContentUpload): number =>
  action.transport === "chunked"
    ? chunkedSessionOverheadCalls + Math.ceil(action.sizeBytes / minimumChunkedPartBytes)
    : 1;

const isUpload = S.is(BoxContentUpload);
const isFolderCreate = S.is(BoxContentFolderCreate);
const isFolderExists = S.is(BoxContentFolderExists);
const isSkipIdentical = S.is(BoxContentSkipIdentical);

const budgetError = (run: Run, phase: BudgetPhase, usedProviderCalls: number) =>
  BoxContentMigrationBudgetError.make({
    maxProviderCalls: O.getOrElse(run.maxProviderCalls, () => 0),
    phase,
    usedProviderCalls,
  });

/** Charges one required read against the hard budget, failing before the call when it cannot be afforded. */
const spendRead = Effect.fnUntraced(function* (run: Run, phase: BudgetPhase) {
  const used = yield* Ref.get(run.calls);
  if (O.exists(run.maxProviderCalls, (max) => used + 1 > max)) {
    return yield* budgetError(run, phase, used);
  }
  yield* Ref.set(run.calls, used + 1);
});

const readListing = Effect.fn("BoxContentMigration.readListing")(function* (
  run: Run,
  phase: BudgetPhase,
  folderId: BoxProviderId
) {
  let pageCount = 0;
  const items = yield* collectMarkerPages<B.Item, B.BoxError | BoxContentMigrationBudgetError>((marker) =>
    spendRead(run, phase).pipe(
      Effect.andThen(
        Effect.sync(() => {
          pageCount += 1;
        })
      ),
      Effect.andThen(loadFolderItemsPage(run.box, folderId)(marker))
    )
  );
  const files = MutableHashMap.empty<string, ListedItem>();
  const folders = MutableHashMap.empty<string, BoxProviderId>();
  const others = MutableHashMap.empty<string, BoxProviderId>();
  A.forEach(items, (item) =>
    O.match(O.fromNullishOr(item.name), {
      onNone: () => undefined,
      onSome: (name) => {
        const nameKey = boxNameEquivalenceKey(name);
        const providerId = BoxProviderId.make(item.id);
        Match.value(item).pipe(
          Match.when({ type: "folder" }, () => MutableHashMap.set(folders, nameKey, providerId)),
          Match.when({ type: "file" }, (file) =>
            MutableHashMap.set(files, nameKey, {
              providerId,
              sha1: O.map(O.fromNullishOr(file.sha1), Str.toLowerCase),
            })
          ),
          Match.orElse(() => MutableHashMap.set(others, nameKey, providerId))
        );
      },
    })
  );
  const listing: FolderListing = { entryCount: A.length(items), files, folders, others, pageCount };
  return listing;
});

/** The item occupying a destination name: a file first, then a folder, then any other Box item. */
const nameOccupant = (listing: FolderListing, nameKey: string): O.Option<ListedItem> =>
  pipe(
    MutableHashMap.get(listing.files, nameKey),
    O.orElse(() =>
      pipe(
        MutableHashMap.get(listing.folders, nameKey),
        O.orElse(() => MutableHashMap.get(listing.others, nameKey)),
        O.map((providerId): ListedItem => ({ providerId, sha1: O.none() }))
      )
    )
  );

const isNotFound = (error: PlatformError.PlatformError): boolean => error.reason._tag === "NotFound";

const inspectSource = Effect.fn("BoxContentMigration.inspectSource")(function* (
  sourcePath: string,
  file: BoxContentMigrationFile
): Effect.fn.Return<SourceState, PlatformError.PlatformError, FileSystem.FileSystem> {
  const fs = yield* FileSystem.FileSystem;
  const info = yield* fs.stat(sourcePath).pipe(
    Effect.asSome,
    Effect.catchIf(isNotFound, () => Effect.succeedNone)
  );
  if (!O.exists(info, (stat) => stat.type === "File")) {
    return { _tag: "Missing" };
  }
  const hashes = yield* hashFileContent(sourcePath);
  return hashes.sizeBytes === file.sizeBytes && sha256Equivalence(hashes.sha256, file.sha256)
    ? { _tag: "Present", sha1: hashes.sha1 }
    : { _tag: "Changed" };
});

const classifyFile = (
  entryDigest: Sha256Hex,
  file: BoxContentMigrationFile,
  source: SourceState,
  listing: O.Option<FolderListing>,
  chunkedThresholdBytes: number
): BoxContentFileAction =>
  Match.value(source).pipe(
    Match.tag("Missing", () => BoxContentBlockedSourceMissing.make({ entryDigest })),
    Match.tag("Changed", () => BoxContentBlockedSourceChanged.make({ entryDigest })),
    Match.tag("Present", ({ sha1 }) =>
      pipe(
        listing,
        O.flatMap((present) => nameOccupant(present, boxNameEquivalenceKey(file.fileName))),
        O.match({
          onNone: (): BoxContentFileAction =>
            BoxContentUpload.make({
              entryDigest,
              sizeBytes: file.sizeBytes,
              transport: file.sizeBytes >= chunkedThresholdBytes ? "chunked" : "single",
            }),
          onSome: (occupant): BoxContentFileAction =>
            O.contains(occupant.sha1, sha1)
              ? BoxContentSkipIdentical.make({ entryDigest, providerId: occupant.providerId })
              : BoxContentBlockedNameConflict.make({ entryDigest, providerId: occupant.providerId }),
        })
      )
    ),
    Match.exhaustive
  );

const byDepthThenDigest = Order.combine(
  Order.mapInput(Order.Number, (planned: PlannedFolder) => planned.action.depth),
  Order.mapInput(Order.String, (planned: PlannedFolder) => planned.action.pathDigest)
);

const byEntryDigest = Order.mapInput(Order.String, (planned: PlannedFile) => planned.action.entryDigest);

const countWhere = <T>(values: ReadonlyArray<T>, predicate: (value: T) => boolean): number =>
  A.length(A.filter(values, predicate));

const ruleUploadCounts = (files: ReadonlyArray<PlannedFile>): ReadonlyArray<BoxContentRuleUploadCount> => {
  const byRule = MutableHashMap.empty<string, BoxContentRuleUploadCount>();
  A.forEach(files, (planned) => {
    if (!isUpload(planned.action)) {
      return;
    }
    const ruleKey = O.getOrElse(planned.file.ruleId, () => "");
    const current = O.getOrElse(MutableHashMap.get(byRule, ruleKey), () =>
      BoxContentRuleUploadCount.make({ ruleId: planned.file.ruleId, uploadBytes: 0, uploadCount: 0 })
    );
    MutableHashMap.set(
      byRule,
      ruleKey,
      BoxContentRuleUploadCount.make({
        ruleId: current.ruleId,
        uploadBytes: current.uploadBytes + planned.file.sizeBytes,
        uploadCount: current.uploadCount + 1,
      })
    );
  });
  return A.sortWith(MutableHashMap.values(byRule), (count) => O.getOrElse(count.ruleId, () => ""), Order.String);
};

/**
 * Calls the post-apply plan needs if every planned write lands: the identity
 * check plus one listing per folder that has a required child folder or a
 * mapped file, sized for the entries it will hold afterwards.
 */
const postPlanProviderCalls = (
  map: BoxContentMigrationMap,
  folders: ReadonlyArray<PlannedFolder>,
  files: ReadonlyArray<PlannedFile>,
  folderIds: MutableHashMap.MutableHashMap<string, BoxProviderId>,
  listings: MutableHashMap.MutableHashMap<BoxProviderId, FolderListing>
): number => {
  const additions = MutableHashMap.empty<string, number>();
  const listed = MutableHashSet.empty<string>();
  const add = (pathKey: string, count: number) =>
    MutableHashMap.set(additions, pathKey, O.getOrElse(MutableHashMap.get(additions, pathKey), () => 0) + count);
  A.forEach(folders, (planned) => {
    const parentKey = O.getOrElse(planned.folder.parentPathKey, () => rootPathKey);
    MutableHashSet.add(listed, parentKey);
    add(parentKey, isFolderCreate(planned.action) ? 1 : 0);
  });
  A.forEach(files, (planned) => {
    MutableHashSet.add(listed, planned.folderPathKey);
    add(planned.folderPathKey, isUpload(planned.action) ? 1 : 0);
  });
  const currentEntries = (pathKey: string): number =>
    pipe(
      pathKey === rootPathKey ? O.some(map.rootFolderId) : MutableHashMap.get(folderIds, pathKey),
      O.flatMap((folderId) => MutableHashMap.get(listings, folderId)),
      O.match({ onNone: () => 0, onSome: (listing) => listing.entryCount })
    );
  return A.reduce(
    A.fromIterable(listed),
    1,
    (calls, pathKey) =>
      calls + listingPages(currentEntries(pathKey) + O.getOrElse(MutableHashMap.get(additions, pathKey), () => 0))
  );
};

const buildPlan = Effect.fn("BoxContentMigration.buildPlan")(function* (
  run: Run,
  phase: BudgetPhase,
  map: BoxContentMigrationMap,
  options: BoxContentMigrationOptions,
  sourcePaths: Path.Path,
  knownSources: O.Option<SourceStates>
) {
  const callsBefore = yield* Ref.get(run.calls);
  yield* spendRead(run, phase);
  const identity = yield* observeBoxIdentity(run.box);
  yield* assertExpectedBoxIdentity(map, identity);

  const entries = yield* Effect.forEach(
    map.files,
    (file) => Effect.map(fileEntryDigest(file), (entryDigest) => ({ entryDigest, file })),
    { concurrency: 1 }
  );
  const sources = yield* O.match(knownSources, {
    onNone: Effect.fnUntraced(function* () {
      const states: SourceStates = MutableHashMap.empty();
      yield* Effect.forEach(
        entries,
        ({ entryDigest, file }) =>
          inspectSource(sourcePaths.resolve(map.sourceRoot, file.sourceRelativePath), file).pipe(
            Effect.map((state) => MutableHashMap.set(states, entryDigest, state))
          ),
        { concurrency: sourceInspectionConcurrency, discard: true }
      );
      return states;
    }),
    onSome: Effect.succeed,
  });

  const listings = MutableHashMap.empty<BoxProviderId, FolderListing>();
  const listFolder = (folderId: BoxProviderId) =>
    O.match(MutableHashMap.get(listings, folderId), {
      onNone: () =>
        readListing(run, phase, folderId).pipe(
          Effect.tap((listing) => Effect.sync(() => MutableHashMap.set(listings, folderId, listing)))
        ),
      onSome: Effect.succeed,
    });

  const folderIds = MutableHashMap.empty<string, BoxProviderId>();
  const rootPathDigest = yield* folderPathDigest(A.empty());
  const folders = yield* Effect.forEach(
    requiredContentFolders(map),
    Effect.fnUntraced(function* (folder) {
      const pathDigest = yield* folderPathDigest(folder.pathKeys);
      const parentId = O.match(folder.parentPathKey, {
        onNone: () => O.some(map.rootFolderId),
        onSome: (parentPathKey) => MutableHashMap.get(folderIds, parentPathKey),
      });
      // A folder below a missing parent is missing too; nothing beneath it is ever listed.
      const existing = yield* O.match(parentId, {
        onNone: () => Effect.succeed(O.none<BoxProviderId>()),
        onSome: (id) => Effect.map(listFolder(id), (listing) => MutableHashMap.get(listing.folders, folder.nameKey)),
      });
      const action = yield* O.match(existing, {
        onNone: Effect.fnUntraced(function* () {
          const created: BoxContentFolderAction = BoxContentFolderCreate.make({
            depth: folder.depth,
            parentPathDigest:
              folder.depth > 1 ? yield* folderPathDigest(A.take(folder.pathKeys, folder.depth - 1)) : rootPathDigest,
            pathDigest,
          });
          return created;
        }),
        onSome: (providerId) => {
          MutableHashMap.set(folderIds, folder.pathKey, providerId);
          const exists: BoxContentFolderAction = BoxContentFolderExists.make({
            depth: folder.depth,
            pathDigest,
            providerId,
          });
          return Effect.succeed(exists);
        },
      });
      const planned: PlannedFolder = { action, folder };
      return planned;
    }),
    { concurrency: 1 }
  );

  const files = yield* Effect.forEach(
    entries,
    Effect.fnUntraced(function* ({ entryDigest, file }) {
      const folderPathKey = contentPathKey(file.folderPath);
      const source = O.getOrElse(MutableHashMap.get(sources, entryDigest), (): SourceState => ({ _tag: "Missing" }));
      const listing = yield* O.match(MutableHashMap.get(folderIds, folderPathKey), {
        onNone: () => Effect.succeed(O.none<FolderListing>()),
        onSome: (folderId) => Effect.asSome(listFolder(folderId)),
      });
      const planned: PlannedFile = {
        action: classifyFile(entryDigest, file, source, listing, options.chunkedThresholdBytes),
        file,
        folderPathKey,
        source,
      };
      return planned;
    }),
    { concurrency: 1 }
  );

  const sortedFolders = A.sort(folders, byDepthThenDigest);
  const sortedFiles = A.sort(files, byEntryDigest);
  const uploads = A.filter(
    A.map(sortedFiles, (planned) => planned.action),
    isUpload
  );
  const folderCreateCount = countWhere(sortedFolders, (planned) => isFolderCreate(planned.action));
  const postPlanReserve = postPlanProviderCalls(map, sortedFolders, sortedFiles, folderIds, listings);
  const planProviderCalls = (yield* Ref.get(run.calls)) - callsBefore;
  const fileTagCount = (tag: BoxContentFileAction["_tag"]) =>
    countWhere(sortedFiles, (planned) => planned.action._tag === tag);

  const plan = yield* hashed(
    sealBoxContentMigrationPlan(
      BoxContentMigrationPlan.make({
        chunkedThresholdBytes: options.chunkedThresholdBytes,
        expectedEnterpriseId: map.expectedEnterpriseId,
        fileActions: A.map(sortedFiles, (planned) => planned.action),
        folderActions: A.map(sortedFolders, (planned) => planned.action),
        mapDigest: yield* hashed(boxContentMigrationMapDigest(map)),
        planDigest: Sha256Hex.make("0".repeat(64)),
        rootFolderId: map.rootFolderId,
        sourceRevision: map.sourceRevision,
        subjectId: identity.subjectId,
        summary: BoxContentMigrationPlanSummary.make({
          blockedNameConflictCount: fileTagCount("BlockedNameConflict"),
          blockedSourceChangedCount: fileTagCount("BlockedSourceChanged"),
          blockedSourceMissingCount: fileTagCount("BlockedSourceMissing"),
          estimatedProviderCalls:
            planProviderCalls +
            folderCreateCount +
            A.reduce(uploads, 0, (calls, upload) => calls + uploadProviderCalls(upload)) +
            postPlanReserve,
          folderCreateCount,
          folderExistsCount: A.length(sortedFolders) - folderCreateCount,
          planProviderCalls,
          skipIdenticalCount: fileTagCount("SkipIdentical"),
          totalUploadBytes: A.reduce(uploads, 0, (bytes, upload) => bytes + upload.sizeBytes),
          uploadCount: A.length(uploads),
          uploadCountsByRule: ruleUploadCounts(sortedFiles),
        }),
      })
    )
  );
  const context: PlanContext = {
    files: sortedFiles,
    folderIds,
    folders: sortedFolders,
    listings,
    plan,
    postPlanReserve,
    sources,
  };
  return context;
});

/**
 * Runtime contract for append-only sanitized content-migration journal persistence.
 *
 * @category services
 * @since 0.0.0
 */
export interface BoxContentMigrationJournalShape {
  readonly append: (entry: BoxContentJournalEntry) => Effect.Effect<void, BoxProvisioningApplyJournalError>;
}

const noopJournal: BoxContentMigrationJournalShape = {
  append: Effect.fn("BoxContentMigrationJournal.noopAppend")((_entry) => Effect.void),
};

/**
 * Sink for durable evidence emitted around every content-migration action.
 *
 * **Details**
 *
 * `Started` is appended before a folder create or upload is dispatched, then
 * `Applied`, `Failed`, or `AdoptedExistingFolder` after it. `Skipped` records
 * identical, blocked, and not-attempted actions. Appends are serialized, so
 * `sequence` is gap-free even with concurrent uploads. An append failure stops
 * the run: a write that cannot be journaled is not dispatched.
 *
 * **Example** (Provide the discarding journal)
 *
 * ```ts
 * import { BoxContentMigrationJournal } from "@beep/box-provisioning/BoxContentMigration"
 * import * as Effect from "effect/Effect"
 *
 * const program = BoxContentMigrationJournal.pipe(Effect.provide(BoxContentMigrationJournal.noopLayer))
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class BoxContentMigrationJournal extends Context.Service<
  BoxContentMigrationJournal,
  BoxContentMigrationJournalShape
>()($I`BoxContentMigrationJournal`) {
  /**
   * Discards journal entries for callers that do not provide a durable sink.
   *
   * **Example** (Inspect the discarding layer)
   *
   * ```ts
   * import { BoxContentMigrationJournal } from "@beep/box-provisioning/BoxContentMigration"
   *
   * console.log(BoxContentMigrationJournal.noopLayer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly noopLayer = Layer.succeed(BoxContentMigrationJournal, noopJournal);
}

type JournalBase = {
  readonly attemptId: BoxApplyAttemptId;
  readonly planDigest: Sha256Hex;
  readonly sequence: number;
};

type JournalWriter = (
  entry: (base: JournalBase) => BoxContentJournalEntry
) => Effect.Effect<void, BoxProvisioningApplyJournalError>;

const makeJournalWriter = Effect.fnUntraced(function* (
  journal: BoxContentMigrationJournalShape,
  attemptId: BoxApplyAttemptId,
  planDigest: Sha256Hex
) {
  const lock = yield* Semaphore.make(1);
  const sequence = yield* Ref.make(0);
  const write: JournalWriter = (entry) =>
    lock.withPermits(1)(
      Ref.getAndUpdate(sequence, (current) => current + 1).pipe(
        Effect.flatMap((current) => journal.append(entry({ attemptId, planDigest, sequence: current })))
      )
    );
  return write;
});

const blockedOutcome = Match.type<Exclude<BoxContentFileAction, BoxContentUpload | BoxContentSkipIdentical>>().pipe(
  Match.tagsExhaustive({
    BlockedNameConflict: (action) =>
      BoxContentActionBlocked.make({
        actionDigest: action.entryDigest,
        actionKind: "file",
        providerId: O.some(action.providerId),
        reason: "name-conflict",
      }),
    BlockedSourceChanged: (action) =>
      BoxContentActionBlocked.make({
        actionDigest: action.entryDigest,
        actionKind: "file",
        providerId: O.none(),
        reason: "source-changed",
      }),
    BlockedSourceMissing: (action) =>
      BoxContentActionBlocked.make({
        actionDigest: action.entryDigest,
        actionKind: "file",
        providerId: O.none(),
        reason: "source-missing",
      }),
  })
);

type WriteFailure = {
  readonly failureKind: BoxContentFailureKind;
  readonly providerId: O.Option<BoxProviderId>;
  readonly status: O.Option<number>;
};

const providerFailure = (error: B.BoxError): WriteFailure => ({
  failureKind: O.contains(error.status, 409) ? "name-in-use" : "provider-error",
  providerId: O.none(),
  status: error.status,
});

const localFailure = (
  failureKind: BoxContentFailureKind,
  providerId: O.Option<BoxProviderId> = O.none()
): WriteFailure => ({ failureKind, providerId, status: O.none() });

/** Provider id of a create response that names the expected parent and a provider-equivalent name. */
const createdFolderId = (created: B.FolderFull, parentId: BoxProviderId, name: string): O.Option<BoxProviderId> =>
  pipe(
    O.all({
      name: O.fromNullishOr(created.name),
      parentId: pipe(
        O.fromNullishOr(created.parent),
        O.flatMap((parent) => O.fromNullishOr(parent.id))
      ),
    }),
    O.filter((identity) => identity.parentId === parentId && boxFolderNamesEquivalent(identity.name, name)),
    O.map(() => BoxProviderId.make(created.id))
  );

const sourceReadFailure = () => B.BoxError.fromReason("stream", { cause: "source file read failed" });

const applyPlan = Effect.fn("BoxContentMigration.applyPlan")(function* (
  run: Run,
  map: BoxContentMigrationMap,
  options: BoxContentMigrationOptions,
  sourcePaths: Path.Path,
  context: PlanContext,
  write: JournalWriter
) {
  const fs = yield* FileSystem.FileSystem;
  const folderIds = context.folderIds;
  let budgetStopped = false;
  /** Whether `cost` more calls still leave room for the post-apply plan. */
  const affordable = Effect.fnUntraced(function* (cost: number) {
    const used = yield* Ref.get(run.calls);
    return !O.exists(run.maxProviderCalls, (max) => used + cost + context.postPlanReserve > max);
  });
  const charge = (cost: number) => Ref.update(run.calls, (used) => used + cost);

  const notAttempted = Effect.fnUntraced(function* (
    actionDigest: Sha256Hex,
    actionKind: BoxContentActionNotAttempted["actionKind"],
    reason: BoxContentActionNotAttempted["reason"]
  ) {
    yield* write((base) =>
      BoxContentJournalSkipped.make({ ...base, actionDigest, actionKind, providerId: O.none(), reason })
    );
    const outcome: BoxContentActionOutcome = BoxContentActionNotAttempted.make({ actionDigest, actionKind, reason });
    return outcome;
  });

  const failed = Effect.fnUntraced(function* (
    actionDigest: Sha256Hex,
    actionKind: BoxContentActionFailed["actionKind"],
    failure: WriteFailure
  ) {
    yield* write((base) =>
      BoxContentJournalFailed.make({
        ...base,
        actionDigest,
        actionKind,
        failureKind: failure.failureKind,
        providerId: failure.providerId,
      })
    );
    const outcome: BoxContentActionOutcome = BoxContentActionFailed.make({
      actionDigest,
      actionKind,
      failureKind: failure.failureKind,
      providerId: failure.providerId,
      status: failure.status,
    });
    return outcome;
  });

  const applied = Effect.fnUntraced(function* (
    actionDigest: Sha256Hex,
    actionKind: BoxContentActionApplied["actionKind"],
    providerId: BoxProviderId
  ) {
    yield* write((base) =>
      BoxContentJournalApplied.make({ ...base, actionDigest, actionKind, providerId: O.some(providerId) })
    );
    const outcome: BoxContentActionOutcome = BoxContentActionApplied.make({
      actionDigest,
      actionKind,
      adopted: false,
      providerId,
    });
    return outcome;
  });

  /**
   * Resolves a 409 from a folder create by re-listing the parent and binding the
   * folder with the provider-equivalent name. Any other occupant stays a failure.
   */
  const adoptExistingFolder = Effect.fnUntraced(function* (
    planned: PlannedFolder,
    parentId: BoxProviderId,
    conflict: WriteFailure
  ) {
    const pathDigest = planned.action.pathDigest;
    const relisted = yield* readListing(run, "plan", parentId).pipe(
      Effect.map((listing): O.Option<BoxProviderId> => MutableHashMap.get(listing.folders, planned.folder.nameKey)),
      Effect.catchTags({
        BoxContentMigrationBudgetError: () => Effect.fail(localFailure("budget-exhausted")),
        BoxError: (error) => Effect.fail(providerFailure(error)),
      }),
      Effect.result
    );
    if (relisted._tag === "Failure") {
      return yield* failed(pathDigest, "folder", relisted.failure);
    }
    if (O.isNone(relisted.success)) {
      return yield* failed(pathDigest, "folder", conflict);
    }
    const providerId = relisted.success.value;
    MutableHashMap.set(folderIds, planned.folder.pathKey, providerId);
    yield* write((base) =>
      BoxContentJournalAdoptedExistingFolder.make({
        ...base,
        actionDigest: pathDigest,
        actionKind: "folder",
        providerId: O.some(providerId),
      })
    );
    const outcome: BoxContentActionOutcome = BoxContentActionApplied.make({
      actionDigest: pathDigest,
      actionKind: "folder",
      adopted: true,
      providerId,
    });
    return outcome;
  });

  const applyFolder = Effect.fnUntraced(function* (planned: PlannedFolder) {
    const action = planned.action;
    if (isFolderExists(action)) {
      const outcome: BoxContentActionOutcome = BoxContentActionSkipped.make({
        actionDigest: action.pathDigest,
        actionKind: "folder",
        providerId: action.providerId,
      });
      return outcome;
    }
    const parentId = O.match(planned.folder.parentPathKey, {
      onNone: () => O.some(map.rootFolderId),
      onSome: (parentPathKey) => MutableHashMap.get(folderIds, parentPathKey),
    });
    if (O.isNone(parentId)) {
      return yield* notAttempted(action.pathDigest, "folder", "dependency-failed");
    }
    // One create plus the re-list a 409 adoption would need.
    const adoptionReserve = pipe(
      MutableHashMap.get(context.listings, parentId.value),
      O.match({ onNone: () => 1, onSome: (listing) => listingPages(listing.entryCount + 1) })
    );
    if (budgetStopped || !(yield* affordable(1 + adoptionReserve))) {
      budgetStopped = true;
      return yield* notAttempted(action.pathDigest, "folder", "budget-exhausted");
    }
    yield* write((base) =>
      BoxContentJournalStarted.make({
        ...base,
        actionDigest: action.pathDigest,
        actionKind: "folder",
        providerId: O.none(),
      })
    );
    yield* charge(1);
    const created = yield* run.box.folders
      .createFolder(
        B.FoldersCreateFolderPayload.make({
          requestBody: { name: planned.folder.name, parent: { id: parentId.value } },
        })
      )
      .pipe(Effect.result);
    if (created._tag === "Failure") {
      const failure = providerFailure(created.failure);
      return failure.failureKind === "name-in-use"
        ? yield* adoptExistingFolder(planned, parentId.value, failure)
        : yield* failed(action.pathDigest, "folder", failure);
    }
    const providerId = createdFolderId(created.success, parentId.value, planned.folder.name);
    if (O.isNone(providerId)) {
      return yield* failed(action.pathDigest, "folder", localFailure("unreadable-response"));
    }
    MutableHashMap.set(folderIds, planned.folder.pathKey, providerId.value);
    return yield* applied(action.pathDigest, "folder", providerId.value);
  });

  const upload = Effect.fnUntraced(function* (
    planned: PlannedFile,
    action: BoxContentUpload,
    folderId: BoxProviderId,
    sha1: string
  ) {
    const bytes: B.BoxByteStream = fs
      .stream(sourcePaths.resolve(map.sourceRoot, planned.file.sourceRelativePath))
      .pipe(Stream.mapError(sourceReadFailure));
    yield* write((base) =>
      BoxContentJournalStarted.make({
        ...base,
        actionDigest: action.entryDigest,
        actionKind: "file",
        providerId: O.none(),
      })
    );
    const uploaded = yield* (
      action.transport === "chunked"
        ? run.box.chunkedUploads
            .uploadBigFile(
              B.BoxUploadBigFilePayload.make({
                file: bytes,
                fileName: planned.file.fileName,
                fileSize: planned.file.sizeBytes,
                parentFolderId: folderId,
              })
            )
            .pipe(Effect.asSome)
        : run.box.uploads
            .uploadFile(
              B.BoxUploadFilePayload.make({
                // Box verifies the request body against this SHA-1 before storing it.
                optionalsInput: { headers: { contentMd5: sha1 } },
                requestBody: {
                  attributes: { name: planned.file.fileName, parent: { id: folderId } },
                  file: bytes,
                  fileFileName: planned.file.fileName,
                },
              })
            )
            .pipe(Effect.map((result) => O.flatMap(O.fromNullishOr(result.entries), A.head)))
    ).pipe(Effect.result);
    if (uploaded._tag === "Failure") {
      return yield* failed(action.entryDigest, "file", providerFailure(uploaded.failure));
    }
    if (O.isNone(uploaded.success)) {
      return yield* failed(action.entryDigest, "file", localFailure("unreadable-response"));
    }
    const stored = uploaded.success.value;
    const providerId = BoxProviderId.make(stored.id);
    const storedSha1 = O.map(O.fromNullishOr(stored.sha1), Str.toLowerCase);
    if (O.isNone(storedSha1)) {
      return yield* failed(action.entryDigest, "file", localFailure("unreadable-response", O.some(providerId)));
    }
    // A stored hash that differs is reported, never repaired: the Box item is left exactly as it is.
    return storedSha1.value === sha1
      ? yield* applied(action.entryDigest, "file", providerId)
      : yield* failed(action.entryDigest, "file", localFailure("content-hash-mismatch", O.some(providerId)));
  });

  const folderOutcomes = yield* Effect.forEach(context.folders, applyFolder, { concurrency: 1 });

  // Admission is sequential and in plan order, so the budget stop is deterministic
  // and every admitted upload has its calls reserved before any of them starts.
  const admitted = yield* Effect.forEach(
    context.files,
    Effect.fnUntraced(function* (planned) {
      const action = planned.action;
      const settled = (outcome: BoxContentActionOutcome) => ({
        entryDigest: action.entryDigest,
        outcome: O.some(outcome),
        planned,
        run: O.none<Effect.Effect<BoxContentActionOutcome, BoxProvisioningApplyJournalError>>(),
      });
      if (isSkipIdentical(action)) {
        yield* write((base) =>
          BoxContentJournalSkipped.make({
            ...base,
            actionDigest: action.entryDigest,
            actionKind: "file",
            providerId: O.some(action.providerId),
            reason: "identical",
          })
        );
        return settled(
          BoxContentActionSkipped.make({
            actionDigest: action.entryDigest,
            actionKind: "file",
            providerId: action.providerId,
          })
        );
      }
      if (!isUpload(action)) {
        const blocked = blockedOutcome(action);
        yield* write((base) =>
          BoxContentJournalSkipped.make({
            ...base,
            actionDigest: blocked.actionDigest,
            actionKind: "file",
            providerId: blocked.providerId,
            reason: blocked.reason,
          })
        );
        return settled(blocked);
      }
      const folderId = MutableHashMap.get(folderIds, planned.folderPathKey);
      if (O.isNone(folderId) || planned.source._tag !== "Present") {
        return settled(yield* notAttempted(action.entryDigest, "file", "dependency-failed"));
      }
      const cost = uploadProviderCalls(action);
      if (budgetStopped || !(yield* affordable(cost))) {
        budgetStopped = true;
        return settled(yield* notAttempted(action.entryDigest, "file", "budget-exhausted"));
      }
      yield* charge(cost);
      return {
        entryDigest: action.entryDigest,
        outcome: O.none<BoxContentActionOutcome>(),
        planned,
        run: O.some(upload(planned, action, folderId.value, planned.source.sha1)),
      };
    }),
    { concurrency: 1 }
  );

  const uploadOutcomes = MutableHashMap.empty<Sha256Hex, BoxContentActionOutcome>();
  yield* Effect.forEach(
    admitted,
    (entry) =>
      O.match(entry.run, {
        onNone: () => Effect.void,
        onSome: (dispatch) =>
          Effect.map(dispatch, (outcome) => MutableHashMap.set(uploadOutcomes, entry.entryDigest, outcome)),
      }),
    { concurrency: options.uploadConcurrency, discard: true }
  );
  const fileOutcomes = A.getSomes(
    A.map(admitted, (entry) => O.orElse(entry.outcome, () => MutableHashMap.get(uploadOutcomes, entry.entryDigest)))
  );
  const outcomes = A.appendAll(folderOutcomes, fileOutcomes);
  const uploadedBytes = A.reduce(admitted, 0, (bytes, entry) =>
    pipe(
      MutableHashMap.get(uploadOutcomes, entry.entryDigest),
      O.exists((outcome) => outcome._tag === "Applied")
    )
      ? bytes + entry.planned.file.sizeBytes
      : bytes
  );
  return { outcomes, uploadedBytes };
});

const outcomeCounts = (outcomes: ReadonlyArray<BoxContentActionOutcome>): BoxContentMigrationCounts => {
  const count = (tag: BoxContentActionOutcome["_tag"]) => countWhere(outcomes, (outcome) => outcome._tag === tag);
  return BoxContentMigrationCounts.make({
    applied: count("Applied"),
    blocked: count("Blocked"),
    failed: count("Failed"),
    notAttempted: count("NotAttempted"),
    skipped: count("Skipped"),
  });
};

const isSettledPlan = (plan: BoxContentMigrationPlan): boolean =>
  A.every(plan.folderActions, isFolderExists) && A.every(plan.fileActions, isSkipIdentical);

const defaultOptions = (): BoxContentMigrationOptions => BoxContentMigrationOptions.make({});

const makeService = (
  box: B.Box["Service"],
  journal: BoxContentMigrationJournalShape,
  fs: FileSystem.FileSystem,
  sourcePaths: Path.Path,
  crypto: Crypto.Crypto
): BoxContentMigrationShape => {
  const provided = <A, E>(effect: Effect.Effect<A, E, Crypto.Crypto | FileSystem.FileSystem>) =>
    effect.pipe(Effect.provideService(Crypto.Crypto, crypto), Effect.provideService(FileSystem.FileSystem, fs));

  const decodeMap = Effect.fnUntraced(function* (mapInput: unknown) {
    const map = yield* decodeBoxContentMigrationMap(mapInput);
    if (!sourcePaths.isAbsolute(map.sourceRoot)) {
      return yield* BoxContentMigrationMapError.make({ reason: "source-root-not-absolute", violationCount: 1 });
    }
    return map;
  });

  const makeRun = Effect.fnUntraced(function* (options: BoxContentMigrationOptions) {
    const run: Run = { box, calls: yield* Ref.make(0), maxProviderCalls: options.maxProviderCalls };
    return run;
  });

  const plan = Effect.fn("BoxContentMigration.plan")(function* (
    mapInput: unknown,
    options: BoxContentMigrationOptions = defaultOptions()
  ) {
    const map = yield* decodeMap(mapInput);
    const run = yield* makeRun(options);
    const context = yield* buildPlan(run, "plan", map, options, sourcePaths, O.none());
    return context.plan;
  }, provided);

  const applyReviewedPlan = Effect.fn("BoxContentMigration.applyReviewedPlan")(function* (
    mapInput: unknown,
    reviewedPlanInput: unknown,
    options: BoxContentMigrationOptions = defaultOptions()
  ) {
    const [map, reviewedPlan] = yield* Effect.all([
      decodeMap(mapInput),
      decodeBoxContentMigrationPlan(reviewedPlanInput),
    ]);
    if (!(yield* hashed(hasValidBoxContentMigrationPlanDigest(reviewedPlan)))) {
      return yield* BoxProvisioningInvariantError.make({ code: "invalid-plan-digest" });
    }
    const run = yield* makeRun(options);
    const context = yield* buildPlan(run, "plan", map, options, sourcePaths, O.none());
    if (!sha256Equivalence(reviewedPlan.planDigest, context.plan.planDigest)) {
      return yield* BoxProvisioningDriftError.make({
        actualPlanDigest: context.plan.planDigest,
        expectedPlanDigest: reviewedPlan.planDigest,
      });
    }
    // A run that cannot afford its own post-apply verification writes nothing.
    const usedByPlan = yield* Ref.get(run.calls);
    if (O.exists(run.maxProviderCalls, (max) => usedByPlan + context.postPlanReserve > max)) {
      return yield* budgetError(run, "post-plan", usedByPlan);
    }
    const attemptId = yield* O.match(options.attemptId, {
      onNone: () => Effect.map(crypto.randomUUIDv4, BoxApplyAttemptId.make),
      onSome: Effect.succeed,
    });
    const write = yield* makeJournalWriter(journal, attemptId, reviewedPlan.planDigest);
    const written = yield* applyPlan(run, map, options, sourcePaths, context, write);
    // Sources were hashed moments ago for the drift check; only Box state is read again.
    const post = yield* buildPlan(run, "post-plan", map, options, sourcePaths, O.some(context.sources));
    return BoxContentMigrationApplyResult.make({
      postPlan: post.plan,
      receipt: BoxContentMigrationReceipt.make({
        appliedAt: yield* DateTime.now,
        attemptId,
        counts: outcomeCounts(written.outcomes),
        maxProviderCalls: run.maxProviderCalls,
        outcomes: written.outcomes,
        planDigest: reviewedPlan.planDigest,
        providerCalls: yield* Ref.get(run.calls),
        uploadedBytes: written.uploadedBytes,
      }),
      verdict: isSettledPlan(post.plan) ? "complete" : "incomplete",
    });
  }, provided);

  return { applyReviewedPlan, plan };
};

/**
 * Runtime contract for dry-run-first Box content migration.
 *
 * @category services
 * @since 0.0.0
 */
export interface BoxContentMigrationShape {
  /** Re-plan, reject drift before any write, then create folders and upload files. */
  readonly applyReviewedPlan: (
    mapInput: unknown,
    reviewedPlanInput: unknown,
    options?: BoxContentMigrationOptions
  ) => Effect.Effect<BoxContentMigrationApplyResult, ApplyError>;
  /** Read-only: verify sources, resolve existing folders, and classify every file. */
  readonly plan: (
    mapInput: unknown,
    options?: BoxContentMigrationOptions
  ) => Effect.Effect<BoxContentMigrationPlan, PlanError>;
}

/**
 * Plans and applies a content-hash-deduplicated file migration into a Box folder tree.
 *
 * **Details**
 *
 * `plan` is read-only. It checks the authenticated enterprise and subject
 * first, hashes every source in one bounded-memory pass, lists only folders
 * that exist on the required path set, and classifies each file. A Box file
 * with the same provider-equivalent name and the same SHA-1 is `SkipIdentical`;
 * the same name with other content is `BlockedNameConflict`.
 *
 * `applyReviewedPlan` reproduces the reviewed plan, fails with
 * `BoxProvisioningDriftError` before any write when it differs, creates missing
 * folders in depth order, then uploads with bounded concurrency. It never
 * overwrites, versions, renames, moves, or deletes a Box item, and it opens
 * sources read-only. One failed upload does not stop the others; a failed
 * folder skips only its dependents.
 *
 * **Gotchas**
 *
 * Resumability is idempotence, not a checkpoint: after any partial run, a new
 * `plan` shows finished uploads as `SkipIdentical` and created folders as
 * `FolderExists`, so reviewing and applying that plan continues the work. An
 * upload whose stored `sha1` does not verify is reported `Failed` and the Box
 * item is left in place; the next plan reports it as `BlockedNameConflict`.
 *
 * **Example** (Run the read-only planning entry point)
 *
 * ```ts
 * import { BoxContentMigration } from "@beep/box-provisioning/BoxContentMigration"
 * import { Effect } from "effect"
 *
 * const dryRun = (mapInput: unknown) =>
 *   Effect.gen(function* () {
 *     const migration = yield* BoxContentMigration
 *     return yield* migration.plan(mapInput)
 *   })
 * console.log(dryRun)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class BoxContentMigration extends Context.Service<BoxContentMigration, BoxContentMigrationShape>()(
  $I`BoxContentMigration`
) {
  /**
   * Migration service requiring Box, a journal sink, and platform file services.
   *
   * **Example** (Inspect the platform-agnostic layer)
   *
   * ```ts
   * import { BoxContentMigration } from "@beep/box-provisioning/BoxContentMigration"
   *
   * console.log(BoxContentMigration.layer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly layer: Layer.Layer<
    BoxContentMigration,
    never,
    B.Box | BoxContentMigrationJournal | FileSystem.FileSystem | Path.Path
  > = Layer.effect(
    BoxContentMigration,
    Effect.all([B.Box, BoxContentMigrationJournal, FileSystem.FileSystem, Path.Path, Crypto.Crypto]).pipe(
      Effect.map(([box, journal, fs, sourcePaths, crypto]) =>
        BoxContentMigration.of(makeService(box, journal, fs, sourcePaths, crypto))
      )
    )
  ).pipe(Layer.provide(NodeCrypto.layer));

  /**
   * Live layer that requires an explicit durable journal sink and one Box layer.
   *
   * **Example** (Inspect the journal-aware live layer)
   *
   * ```ts
   * import { BoxContentMigration } from "@beep/box-provisioning/BoxContentMigration"
   *
   * console.log(BoxContentMigration.liveLayerWithJournal)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly liveLayerWithJournal: Layer.Layer<BoxContentMigration, never, B.Box | BoxContentMigrationJournal> =
    BoxContentMigration.layer.pipe(Layer.provide(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer)));

  /**
   * Live layer with the Node file system and a discarding journal, requiring one Box layer.
   *
   * **Example** (Inspect the Box-backed layer)
   *
   * ```ts
   * import { BoxContentMigration } from "@beep/box-provisioning/BoxContentMigration"
   *
   * console.log(BoxContentMigration.liveLayer)
   * ```
   *
   * @category layers
   * @since 0.0.0
   */
  static readonly liveLayer: Layer.Layer<BoxContentMigration, never, B.Box> =
    BoxContentMigration.liveLayerWithJournal.pipe(Layer.provide(BoxContentMigrationJournal.noopLayer));
}
