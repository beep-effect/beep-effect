import * as B from "@beep/box";
import {
  BoxContentMigration,
  BoxContentMigrationJournal,
  BoxContentMigrationOptions,
  BoxProvisioningApplyJournalError,
  encodeBoxContentJournalEntry,
  encodeBoxContentMigrationPlan,
  encodeBoxContentMigrationReceipt,
} from "@beep/box-provisioning";
import { it } from "@beep/test-runner";
import * as NodeFileSystem from "@effect/platform-node-shared/NodeFileSystem";
import * as NodePath from "@effect/platform-node-shared/NodePath";
import { expect } from "@effect/vitest";
import { assertFalse, assertNone, assertSome, assertTrue } from "@effect/vitest/utils";
import { sha1 } from "@noble/hashes/legacy.js";
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { Context, Effect, Layer, pipe, Ref } from "effect";
import * as A from "effect/Array";
import * as FileSystem from "effect/FileSystem";
import * as O from "effect/Option";
import * as Path from "effect/Path";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { makeFakeBox } from "./fixtures.ts";
import type { BoxContentActionOutcome, BoxContentJournalEntry, BoxContentMigrationPlan } from "@beep/box-provisioning";
import type { Scope } from "effect";
import type { FakeBox, FakeBoxEntry, FakeBoxOptions } from "./fixtures.ts";

const mebibyte = 1024 * 1024;
const rootFolderId = "100";

const bytes = (text: string): Uint8Array => new TextEncoder().encode(text);
const sha1Hex = (content: Uint8Array): string => bytesToHex(sha1(content));
const sha256Hex = (content: Uint8Array): string => bytesToHex(sha256(content));

type SourceSpec = {
  readonly content: Uint8Array;
  readonly fileName: string;
  readonly folderPath: ReadonlyArray<string>;
  readonly relativePath: string;
  readonly ruleId: string;
};

const source = (
  relativePath: string,
  folderPath: ReadonlyArray<string>,
  fileName: string,
  text: string,
  ruleId = "default-rule"
): SourceSpec => ({ content: bytes(text), fileName, folderPath, relativePath, ruleId });

const folder = (id: string, name: string, parentId = rootFolderId): FakeBoxEntry => ({
  id,
  name,
  parentId,
  type: "folder",
});

const storedFile = (id: string, name: string, parentId: string, content: string): FakeBoxEntry => ({
  id,
  name,
  parentId,
  sha1: sha1Hex(bytes(content)),
  type: "file",
});

type Harness = {
  readonly failJournalAt: Ref.Ref<O.Option<number>>;
  readonly fake: FakeBox;
  readonly journal: Ref.Ref<ReadonlyArray<BoxContentJournalEntry>>;
  /** Runs just before an entry is recorded, at the exact point the engine is about to act on it. */
  readonly onAppend: Ref.Ref<(entry: BoxContentJournalEntry) => Effect.Effect<void>>;
};

class MigrationHarness extends Context.Service<MigrationHarness, Harness>()(
  "@beep/box-provisioning/test/BoxContentMigration.test/MigrationHarness"
) {}

type TestServices = BoxContentMigration | MigrationHarness | FileSystem.FileSystem | Path.Path;

const makeTestLayer = (options: FakeBoxOptions, recordJournal = true): Layer.Layer<TestServices> => {
  const harness = Layer.effect(
    MigrationHarness,
    Effect.gen(function* () {
      return MigrationHarness.of({
        failJournalAt: yield* Ref.make(O.none<number>()),
        fake: makeFakeBox(options),
        journal: yield* Ref.make<ReadonlyArray<BoxContentJournalEntry>>(A.empty()),
        onAppend: yield* Ref.make<Harness["onAppend"] extends Ref.Ref<infer Hook> ? Hook : never>(() => Effect.void),
      });
    })
  );
  const box = Layer.unwrap(Effect.map(MigrationHarness, ({ fake }) => B.Box.makeLayerFromClient(fake.client)));
  const journal = Layer.effect(
    BoxContentMigrationJournal,
    Effect.map(MigrationHarness, ({ failJournalAt, journal: entries, onAppend }) =>
      BoxContentMigrationJournal.of({
        append: Effect.fn("BoxContentMigrationTest.append")(function* (entry) {
          if (O.contains(yield* Ref.get(failJournalAt), entry.sequence)) {
            return yield* BoxProvisioningApplyJournalError.make({ operation: "append" });
          }
          yield* (yield* Ref.get(onAppend))(entry);
          yield* Ref.update(entries, A.append(entry));
        }),
      })
    )
  );
  const migration = recordJournal
    ? BoxContentMigration.liveLayerWithJournal.pipe(Layer.provide(journal))
    : BoxContentMigration.liveLayer;
  return migration.pipe(
    Layer.provideMerge(box),
    Layer.provideMerge(harness),
    Layer.provideMerge(Layer.mergeAll(NodeFileSystem.layer, NodePath.layer))
  );
};

/** Runs one behavior against its own fake tenant so no scenario can observe another's Box state. */
const scenario = (
  name: string,
  options: FakeBoxOptions,
  body: () => Effect.Effect<void, unknown, TestServices | Scope.Scope>,
  recordJournal = true
): void =>
  it.layer(makeTestLayer(options, recordJournal), { timeout: "60 seconds" })(name, (it) => {
    it.effect("holds", body);
  });

const prepare = Effect.fn("BoxContentMigrationTest.prepare")(function* (
  sources: ReadonlyArray<SourceSpec>,
  folders: ReadonlyArray<ReadonlyArray<string>> = A.empty()
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const sourceRoot = yield* fs.makeTempDirectoryScoped({ prefix: "box-content-migration-" });
  yield* Effect.forEach(
    sources,
    (spec) => {
      const target = path.join(sourceRoot, spec.relativePath);
      return fs
        .makeDirectory(path.dirname(target), { recursive: true })
        .pipe(Effect.andThen(fs.writeFile(target, spec.content)));
    },
    { discard: true }
  );
  const mapInput = {
    expectedEnterpriseId: "enterprise-id",
    expectedSubjectId: "service-account-id",
    files: A.map(sources, (spec) => ({
      fileName: spec.fileName,
      folderPath: spec.folderPath,
      ruleId: spec.ruleId,
      sha256: sha256Hex(spec.content),
      sizeBytes: spec.content.byteLength,
      sourceRelativePath: spec.relativePath,
    })),
    folders: A.map(folders, (path_) => ({ path: path_ })),
    rootFolderId,
    sourceRevision: "map-1",
    sourceRoot,
    version: "box-content-migration-map/v1",
  };
  return { mapInput, sourceRoot };
});

const snapshotSources = Effect.fn("BoxContentMigrationTest.snapshotSources")(function* (
  sourceRoot: string,
  sources: ReadonlyArray<SourceSpec>
) {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  return yield* Effect.forEach(
    sources,
    Effect.fnUntraced(function* (spec) {
      const target = path.join(sourceRoot, spec.relativePath);
      const info = yield* fs.stat(target);
      return { mtime: info.mtime, sha256: sha256Hex(yield* fs.readFile(target)) };
    }),
    { concurrency: 1 }
  );
});

const fileTags = (plan: BoxContentMigrationPlan) =>
  A.sort(
    A.map(plan.fileActions, (action) => action._tag),
    Str.Order
  );

const folderTags = (plan: BoxContentMigrationPlan) => A.map(plan.folderActions, (action) => action._tag);

const outcomeTags = (outcomes: ReadonlyArray<BoxContentActionOutcome>, kind: "file" | "folder") =>
  A.sort(
    A.map(
      A.filter(outcomes, (outcome) => outcome.actionKind === kind),
      (outcome) => outcome._tag
    ),
    Str.Order
  );

const planAndApply = Effect.fn("BoxContentMigrationTest.planAndApply")(function* (
  mapInput: unknown,
  options: BoxContentMigrationOptions = BoxContentMigrationOptions.make({})
) {
  const migration = yield* BoxContentMigration;
  const plan = yield* migration.plan(mapInput, options);
  const result = yield* migration.applyReviewedPlan(mapInput, yield* encodeBoxContentMigrationPlan(plan), options);
  return { plan, result };
});

const inboxSources = [
  source("a.txt", ["Inbox"], "a.txt", "alpha"),
  source("b.txt", ["Inbox"], "b.txt", "bravo"),
  source("c.txt", ["Inbox"], "c.txt", "charlie"),
];

const classificationTenant: FakeBoxOptions = {
  entries: [
    folder("200", "Clients"),
    folder("201", "Alpha", "200"),
    storedFile("300", "same.txt", "201", "same"),
    storedFile("301", "Conflict.TXT", "201", "theirs"),
  ],
};

const classificationSources = [
  source("alpha/same.txt", ["Clients", "Alpha"], "same.txt", "same", "kept"),
  source("alpha/conflict.txt", ["clients", "alpha"], "conflict.txt", "mine", "kept"),
  source("alpha/new.txt", ["Clients", "Alpha"], "new.txt", "new", "fresh"),
  source("beta/deep.txt", ["Clients", "Beta", "Docs"], "deep.txt", "deep", "fresh"),
  source("alpha/gone.txt", ["Clients", "Alpha"], "gone.txt", "gone", "kept"),
  source("alpha/changed.txt", ["Clients", "Alpha"], "changed.txt", "before", "kept"),
];

/** Writes the classification sources, then removes one and rewrites another behind the map's back. */
const prepareClassification = Effect.fn("BoxContentMigrationTest.prepareClassification")(function* () {
  const fs = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const prepared = yield* prepare(classificationSources, [["Archive"]]);
  yield* fs.remove(path.join(prepared.sourceRoot, "alpha/gone.txt"));
  yield* fs.writeFile(path.join(prepared.sourceRoot, "alpha/changed.txt"), bytes("after!"));
  return prepared;
});

scenario(
  "@beep/box-provisioning content migration plans deterministically and classifies every action",
  classificationTenant,
  Effect.fnUntraced(function* () {
    const { fake } = yield* MigrationHarness;
    const migration = yield* BoxContentMigration;
    const { mapInput, sourceRoot } = yield* prepareClassification();

    const first = yield* migration.plan(mapInput);
    const listedByFirstPlan = fake.listedFolderIds();
    const second = yield* migration.plan(mapInput);
    const firstJson = yield* encodeBoxContentMigrationPlan(first);

    expect(yield* encodeBoxContentMigrationPlan(second)).toBe(firstJson);
    expect(A.sort(folderTags(first), Str.Order)).toEqual([
      "FolderCreate",
      "FolderCreate",
      "FolderCreate",
      "FolderExists",
      "FolderExists",
    ]);
    expect(A.map(first.folderActions, (action) => action.depth)).toEqual([1, 1, 2, 2, 3]);
    expect(fileTags(first)).toEqual([
      "BlockedNameConflict",
      "BlockedSourceChanged",
      "BlockedSourceMissing",
      "SkipIdentical",
      "Upload",
      "Upload",
    ]);
    // Only folders that exist are listed, once each; nothing below the missing Beta folder is read.
    expect(listedByFirstPlan).toEqual(["100", "200", "201"]);
    expect(first.summary).toMatchObject({
      blockedNameConflictCount: 1,
      blockedSourceChangedCount: 1,
      blockedSourceMissingCount: 1,
      estimatedProviderCalls: 15,
      folderCreateCount: 3,
      folderExistsCount: 2,
      planProviderCalls: 4,
      skipIdenticalCount: 1,
      totalUploadBytes: 7,
      uploadCount: 2,
    });
    expect(A.map(first.summary.uploadCountsByRule, (count) => count.uploadCount)).toEqual([2]);
    expect(fake.calls.createFolder + fake.calls.uploadFile + fake.calls.uploadBigFile).toBe(0);
    pipe(
      A.some(["Clients", "Alpha", "Archive", "same.txt", "deep.txt", sourceRoot], (sentinel) =>
        pipe(firstJson, Str.includes(sentinel))
      ),
      assertFalse
    );
  })
);

scenario(
  "@beep/box-provisioning content migration reports blockers without overwriting Box content",
  classificationTenant,
  Effect.fnUntraced(function* () {
    const { fake, journal } = yield* MigrationHarness;
    const { mapInput, sourceRoot } = yield* prepareClassification();
    const callsBefore = fake.totalCalls();

    const { plan, result } = yield* planAndApply(mapInput);

    expect(result.verdict).toBe("incomplete");
    expect(result.receipt.counts).toMatchObject({ applied: 5, blocked: 3, failed: 0, notAttempted: 0, skipped: 3 });
    expect(outcomeTags(result.receipt.outcomes, "file")).toEqual([
      "Applied",
      "Applied",
      "Blocked",
      "Blocked",
      "Blocked",
      "Skipped",
    ]);
    // The estimate reviewed on the plan is exactly what the dry run plus the apply spent.
    expect(result.receipt.providerCalls).toBe(plan.summary.estimatedProviderCalls);
    expect(fake.totalCalls() - callsBefore).toBe(plan.summary.planProviderCalls + result.receipt.providerCalls);
    // The conflicting item keeps its identity and content; exactly the two planned uploads were sent.
    expect(A.filter(fake.entries(), (entry) => entry.id === "301")).toEqual([
      storedFile("301", "Conflict.TXT", "201", "theirs"),
    ]);
    expect(
      A.sort(
        A.map(fake.uploads(), (upload) => upload.name),
        Str.Order
      )
    ).toEqual(["deep.txt", "new.txt"]);
    expect(fileTags(result.postPlan)).toEqual([
      "BlockedNameConflict",
      "BlockedSourceChanged",
      "BlockedSourceMissing",
      "SkipIdentical",
      "SkipIdentical",
      "SkipIdentical",
    ]);

    const artifacts = A.join(
      [
        yield* encodeBoxContentMigrationReceipt(result.receipt),
        ...(yield* Effect.forEach(yield* Ref.get(journal), encodeBoxContentJournalEntry)),
      ],
      "\n"
    );
    pipe(
      A.some(["Clients", "Alpha", "Archive", "Conflict", "deep.txt", sourceRoot], (sentinel) =>
        pipe(artifacts, Str.includes(sentinel))
      ),
      assertFalse
    );
  })
);

scenario(
  "@beep/box-provisioning content migration uploads everything and leaves sources untouched",
  {},
  Effect.fnUntraced(function* () {
    const { fake, journal } = yield* MigrationHarness;
    const { mapInput, sourceRoot } = yield* prepare(inboxSources, [["Empty", "Nested"]]);
    const before = yield* snapshotSources(sourceRoot, inboxSources);

    const { plan, result } = yield* planAndApply(mapInput);

    expect(result.verdict).toBe("complete");
    expect(result.receipt.counts).toMatchObject({ applied: 6, blocked: 0, failed: 0, notAttempted: 0, skipped: 0 });
    expect(result.receipt.planDigest).toBe(plan.planDigest);
    expect(result.receipt.uploadedBytes).toBe(17);
    expect(folderTags(result.postPlan)).toEqual(["FolderExists", "FolderExists", "FolderExists"]);
    expect(fileTags(result.postPlan)).toEqual(["SkipIdentical", "SkipIdentical", "SkipIdentical"]);
    // Every single-request upload carried the local SHA-1 as Box's content-MD5 integrity header.
    expect(A.sort(A.getSomes(A.map(fake.uploads(), (upload) => upload.contentMd5)), Str.Order)).toEqual(
      A.sort(
        A.map(inboxSources, (spec) => sha1Hex(spec.content)),
        Str.Order
      )
    );
    expect(yield* snapshotSources(sourceRoot, inboxSources)).toEqual(before);

    const entries = yield* Ref.get(journal);
    expect(A.map(entries, (entry) => entry.sequence)).toEqual(A.range(0, A.length(entries) - 1));
    expect(A.length(A.filter(entries, (entry) => entry.phase === "Started"))).toBe(6);
    expect(A.length(A.filter(entries, (entry) => entry.phase === "Applied"))).toBe(6);
    pipe(
      A.every(entries, (entry) => entry.planDigest === plan.planDigest && entry.attemptId === result.receipt.attemptId),
      assertTrue
    );
  })
);

scenario(
  "@beep/box-provisioning content migration stops on an enterprise mismatch before any listing",
  { enterpriseId: "other-enterprise" },
  Effect.fnUntraced(function* () {
    const { fake } = yield* MigrationHarness;
    const migration = yield* BoxContentMigration;
    const { mapInput } = yield* prepare(inboxSources);

    const error = yield* Effect.flip(migration.plan(mapInput));

    expect(error._tag).toBe("BoxProvisioningTenantMismatchError");
    expect(fake.calls).toMatchObject({ createFolder: 0, getFolderItems: 0, getUserMe: 1, uploadFile: 0 });
  })
);

scenario(
  "@beep/box-provisioning content migration stops on a subject mismatch before any listing",
  { subjectId: "other-user" },
  Effect.fnUntraced(function* () {
    const { fake } = yield* MigrationHarness;
    const migration = yield* BoxContentMigration;
    const { mapInput } = yield* prepare(inboxSources);

    const error = yield* Effect.flip(migration.plan(mapInput));

    expect(error._tag).toBe("BoxProvisioningSubjectMismatchError");
    expect(fake.calls).toMatchObject({ createFolder: 0, getFolderItems: 0, uploadFile: 0 });
  })
);

scenario(
  "@beep/box-provisioning content migration rejects a relative source root before any provider call",
  {},
  Effect.fnUntraced(function* () {
    const { fake } = yield* MigrationHarness;
    const migration = yield* BoxContentMigration;
    const { mapInput } = yield* prepare(inboxSources);

    const error = yield* Effect.flip(migration.plan({ ...mapInput, sourceRoot: "relative/source" }));

    expect(error).toMatchObject({ _tag: "BoxContentMigrationMapError", reason: "source-root-not-absolute" });
    expect(fake.totalCalls()).toBe(0);
  })
);

scenario(
  "@beep/box-provisioning content migration rejects drift and tampered plans with zero writes",
  { entries: [folder("200", "Inbox")] },
  Effect.fnUntraced(function* () {
    const { fake } = yield* MigrationHarness;
    const migration = yield* BoxContentMigration;
    const { mapInput } = yield* prepare(inboxSources);
    const plan = yield* migration.plan(mapInput);
    const planJson = yield* encodeBoxContentMigrationPlan(plan);

    const tampered = yield* Effect.flip(
      migration.applyReviewedPlan(mapInput, pipe(planJson, Str.replace(`"uploadCount":3`, `"uploadCount":2`)))
    );
    fake.addEntry(storedFile("900", "a.txt", "200", "someone else's"));
    const drifted = yield* Effect.flip(migration.applyReviewedPlan(mapInput, planJson));

    expect(tampered).toMatchObject({ _tag: "BoxProvisioningInvariantError", code: "invalid-plan-digest" });
    expect(drifted).toMatchObject({ _tag: "BoxProvisioningDriftError", expectedPlanDigest: plan.planDigest });
    expect(fake.calls).toMatchObject({ createFolder: 0, uploadBigFile: 0, uploadFile: 0 });
  })
);

scenario(
  "@beep/box-provisioning content migration continues past a failed upload and resumes it",
  {},
  Effect.fnUntraced(function* () {
    const { fake } = yield* MigrationHarness;
    const { mapInput } = yield* prepare(inboxSources);
    fake.failUploadOnce("b.txt");

    const first = yield* planAndApply(mapInput);
    const second = yield* planAndApply(mapInput);

    expect(first.result.verdict).toBe("incomplete");
    expect(first.result.receipt.counts).toMatchObject({ applied: 3, failed: 1, notAttempted: 0 });
    expect(A.filter(first.result.receipt.outcomes, (outcome) => outcome._tag === "Failed")).toMatchObject([
      { actionKind: "file", failureKind: "provider-error" },
    ]);
    expect(fileTags(second.plan)).toEqual(["SkipIdentical", "SkipIdentical", "Upload"]);
    expect(second.result.verdict).toBe("complete");
    // The failed file was retried exactly once; nothing already stored was sent again.
    expect(
      A.sort(
        A.map(fake.uploads(), (upload) => upload.name),
        Str.Order
      )
    ).toEqual(["a.txt", "b.txt", "b.txt", "c.txt"]);
    expect(A.length(A.filter(fake.entries(), (entry) => entry.type === "file"))).toBe(3);
  })
);

scenario(
  "@beep/box-provisioning content migration converges after a crash with zero duplicate uploads",
  {},
  Effect.fnUntraced(function* () {
    const { failJournalAt, fake, journal } = yield* MigrationHarness;
    const migration = yield* BoxContentMigration;
    const { mapInput } = yield* prepare(inboxSources);
    const sequential = BoxContentMigrationOptions.make({ uploadConcurrency: 1 });
    const plan = yield* migration.plan(mapInput, sequential);
    // Sequence 4 is the Started entry of the second upload: the run dies with one file stored.
    yield* Ref.set(failJournalAt, O.some(4));

    const crash = yield* Effect.flip(
      migration.applyReviewedPlan(mapInput, yield* encodeBoxContentMigrationPlan(plan), sequential)
    );
    yield* Ref.set(failJournalAt, O.none());
    const storedAfterCrash = A.length(A.filter(fake.entries(), (entry) => entry.type === "file"));
    const journalAfterCrash = yield* Ref.get(journal);
    const resumed = yield* planAndApply(mapInput, sequential);

    expect(crash._tag).toBe("BoxProvisioningApplyJournalError");
    expect(storedAfterCrash).toBe(1);
    expect(A.map(journalAfterCrash, (entry) => entry.phase)).toEqual(["Started", "Applied", "Started", "Applied"]);
    expect(folderTags(resumed.plan)).toEqual(["FolderExists"]);
    expect(fileTags(resumed.plan)).toEqual(["SkipIdentical", "Upload", "Upload"]);
    expect(resumed.result.verdict).toBe("complete");
    expect(
      A.sort(
        A.map(fake.uploads(), (upload) => upload.name),
        Str.Order
      )
    ).toEqual(["a.txt", "b.txt", "c.txt"]);
    pipe(
      A.every(fake.uploads(), (upload) => upload.stored),
      assertTrue
    );
    expect(fake.calls.createFolder).toBe(1);
  })
);

scenario(
  "@beep/box-provisioning content migration skips only the dependents of a failed folder",
  {},
  Effect.fnUntraced(function* () {
    const { fake } = yield* MigrationHarness;
    const sources = [source("a.txt", ["Good"], "a.txt", "alpha"), source("b.txt", ["Bad", "Deep"], "b.txt", "bravo")];
    const { mapInput } = yield* prepare(sources);
    fake.failFolder("Bad");

    const { result } = yield* planAndApply(mapInput);

    expect(result.verdict).toBe("incomplete");
    expect(outcomeTags(result.receipt.outcomes, "folder")).toEqual(["Applied", "Failed", "NotAttempted"]);
    expect(outcomeTags(result.receipt.outcomes, "file")).toEqual(["Applied", "NotAttempted"]);
    expect(A.filter(result.receipt.outcomes, (outcome) => outcome._tag === "NotAttempted")).toMatchObject([
      { actionKind: "folder", reason: "dependency-failed" },
      { actionKind: "file", reason: "dependency-failed" },
    ]);
    expect(A.map(fake.uploads(), (upload) => upload.name)).toEqual(["a.txt"]);
  })
);

scenario(
  "@beep/box-provisioning content migration adopts a folder created concurrently and journals it",
  {},
  Effect.fnUntraced(function* () {
    const { fake, journal } = yield* MigrationHarness;
    const { mapInput } = yield* prepare([source("a.txt", ["Inbox"], "a.txt", "alpha")]);
    fake.raceFolder("Inbox");

    const { result } = yield* planAndApply(mapInput);

    const inbox = A.filter(fake.entries(), (entry) => entry.type === "folder");
    expect(result.verdict).toBe("complete");
    expect(A.filter(result.receipt.outcomes, (outcome) => outcome.actionKind === "folder")).toMatchObject([
      { _tag: "Applied", adopted: true },
    ]);
    expect(A.length(inbox)).toBe(1);
    expect(A.map(fake.uploads(), (upload) => upload.parentId)).toEqual(A.map(inbox, (entry) => entry.id));
    expect(
      A.map(
        A.filter(yield* Ref.get(journal), (entry) => entry.actionKind === "folder"),
        (entry) => entry.phase
      )
    ).toEqual(["Started", "AdoptedExistingFolder"]);
  })
);

scenario(
  "@beep/box-provisioning content migration stops cleanly at the provider-call budget",
  { entries: [folder("200", "Inbox")] },
  Effect.fnUntraced(function* () {
    const { fake } = yield* MigrationHarness;
    const migration = yield* BoxContentMigration;
    const { mapInput } = yield* prepare(inboxSources);
    const plan = yield* migration.plan(mapInput);
    const planJson = yield* encodeBoxContentMigrationPlan(plan);
    const capped = (maxProviderCalls: number) =>
      BoxContentMigrationOptions.make({ maxProviderCalls: O.some(maxProviderCalls), uploadConcurrency: 1 });

    const tooSmallToPlan = yield* Effect.flip(migration.applyReviewedPlan(mapInput, planJson, capped(2)));
    const tooSmallToVerify = yield* Effect.flip(migration.applyReviewedPlan(mapInput, planJson, capped(5)));
    const writesBeforeBudgetedRun = fake.calls.uploadFile;
    const callsBefore = fake.totalCalls();
    const budgeted = yield* migration.applyReviewedPlan(mapInput, planJson, capped(8));

    expect(plan.summary.estimatedProviderCalls).toBe(9);
    expect(tooSmallToPlan).toMatchObject({ _tag: "BoxContentMigrationBudgetError", phase: "plan" });
    expect(tooSmallToVerify).toMatchObject({ _tag: "BoxContentMigrationBudgetError", phase: "post-plan" });
    expect(writesBeforeBudgetedRun).toBe(0);
    expect(budgeted.verdict).toBe("incomplete");
    expect(budgeted.receipt.counts).toMatchObject({ applied: 2, failed: 0, notAttempted: 1, skipped: 1 });
    expect(A.filter(budgeted.receipt.outcomes, (outcome) => outcome._tag === "NotAttempted")).toMatchObject([
      { actionKind: "file", reason: "budget-exhausted" },
    ]);
    expect(budgeted.receipt.providerCalls).toBe(8);
    assertSome(budgeted.receipt.maxProviderCalls, 8);
    // The fake saw exactly the calls the receipt reports: the cap was never exceeded.
    expect(fake.totalCalls() - callsBefore).toBe(8);
  })
);

scenario(
  "@beep/box-provisioning content migration routes large files through the chunked upload",
  { entries: [folder("200", "Inbox")] },
  Effect.fnUntraced(function* () {
    const { fake } = yield* MigrationHarness;
    const large: SourceSpec = {
      content: new Uint8Array(20 * mebibyte).fill(7),
      fileName: "large.bin",
      folderPath: ["Inbox"],
      relativePath: "large.bin",
      ruleId: "bulk",
    };
    const { mapInput } = yield* prepare([large, source("small.txt", ["Inbox"], "small.txt", "small")]);
    const options = BoxContentMigrationOptions.make({ chunkedThresholdBytes: 20 * mebibyte });

    const { plan, result } = yield* planAndApply(mapInput, options);

    expect(
      A.sort(
        A.map(
          A.filter(plan.fileActions, (action) => action._tag === "Upload"),
          (action) => action.transport
        ),
        Str.Order
      )
    ).toEqual(["chunked", "single"]);
    // 3 plan calls + 1 single upload + (3 session calls + 3 parts of 8 MiB) + 3 post-plan calls.
    expect(plan.summary.estimatedProviderCalls).toBe(13);
    expect(result.verdict).toBe("complete");
    expect(fake.calls).toMatchObject({ uploadBigFile: 1, uploadFile: 1 });
    expect(
      A.map(
        A.filter(fake.uploads(), (upload) => upload.transport === "chunked"),
        (upload) => upload.name
      )
    ).toEqual(["large.bin"]);
    assertNone(S.decodeUnknownOption(BoxContentMigrationOptions)({ chunkedThresholdBytes: mebibyte }));
  })
);

scenario(
  "@beep/box-provisioning content migration fails an upload whose stored SHA-1 does not verify",
  { entries: [folder("200", "Inbox")] },
  Effect.fnUntraced(function* () {
    const { fake } = yield* MigrationHarness;
    const migration = yield* BoxContentMigration;
    const { mapInput } = yield* prepare([source("a.txt", ["Inbox"], "a.txt", "alpha")]);
    fake.corruptUpload("a.txt");

    const { result } = yield* planAndApply(mapInput);
    const replanned = yield* migration.plan(mapInput);

    expect(result.verdict).toBe("incomplete");
    expect(A.filter(result.receipt.outcomes, (outcome) => outcome._tag === "Failed")).toMatchObject([
      { actionKind: "file", failureKind: "content-hash-mismatch" },
    ]);
    expect(result.receipt.uploadedBytes).toBe(0);
    // The unverified item is left in place and can never be overwritten by a later run.
    expect(fileTags(replanned)).toEqual(["BlockedNameConflict"]);
    expect(fake.calls.uploadFile).toBe(1);
  })
);

scenario(
  "@beep/box-provisioning content migration follows marker pagination and counts every page",
  {
    entries: [
      folder("210", "One"),
      folder("211", "Two"),
      folder("212", "Three"),
      folder("213", "Four"),
      folder("200", "Inbox"),
    ],
    pageSize: 2,
  },
  Effect.fnUntraced(function* () {
    const { fake } = yield* MigrationHarness;
    const migration = yield* BoxContentMigration;
    const { mapInput } = yield* prepare([source("a.txt", ["INBOX"], "a.txt", "alpha")]);

    const plan = yield* migration.plan(mapInput);

    expect(folderTags(plan)).toEqual(["FolderExists"]);
    expect(fileTags(plan)).toEqual(["Upload"]);
    // Identity check, three pages of the root, one page of the destination folder.
    expect(plan.summary.planProviderCalls).toBe(5);
    expect(fake.listedFolderIds()).toEqual(["100", "100", "100", "200"]);
  })
);

const failedOutcomes = (outcomes: ReadonlyArray<BoxContentActionOutcome>) =>
  A.filter(outcomes, (outcome) => outcome._tag === "Failed");

const inboxFile = [source("a.txt", ["Inbox"], "a.txt", "alpha")];

scenario(
  "@beep/box-provisioning content migration blocks a name taken by a folder or a web link",
  {
    entries: [
      folder("200", "Inbox"),
      folder("210", "taken.txt", "200"),
      { id: "211", name: "link.txt", parentId: "200", type: "web_link" },
      folder("212", "", "200"),
    ],
  },
  Effect.fnUntraced(function* () {
    const { fake } = yield* MigrationHarness;
    const { mapInput } = yield* prepare([
      source("taken.txt", ["Inbox"], "taken.txt", "one"),
      source("link.txt", ["Inbox"], "link.txt", "two"),
      source("free.txt", ["Inbox"], "free.txt", "three"),
    ]);

    const { plan, result } = yield* planAndApply(mapInput);

    expect(fileTags(plan)).toEqual(["BlockedNameConflict", "BlockedNameConflict", "Upload"]);
    expect(
      A.sort(
        A.map(
          A.filter(plan.fileActions, (action) => action._tag === "BlockedNameConflict"),
          (action) => action.providerId
        ),
        Str.Order
      )
    ).toEqual(["210", "211"]);
    expect(result.verdict).toBe("incomplete");
    expect(A.map(fake.uploads(), (upload) => upload.name)).toEqual(["free.txt"]);
    expect(A.length(fake.entries())).toBe(5);
  })
);

scenario(
  "@beep/box-provisioning content migration runs without a journal sink and uploads an empty file",
  {},
  Effect.fnUntraced(function* () {
    const { fake, journal } = yield* MigrationHarness;
    const sources = [
      source("a.txt", ["Inbox"], "a.txt", "alpha", "kept"),
      source("empty.bin", ["Inbox"], "empty.bin", ""),
      source("c.txt", ["Inbox"], "c.txt", "charlie"),
    ];
    const prepared = yield* prepare(sources);
    // Only the first file keeps its rule; the other two are grouped under "no rule".
    const mapInput = {
      ...prepared.mapInput,
      files: A.map(prepared.mapInput.files, ({ ruleId, ...file }) => (ruleId === "kept" ? { ...file, ruleId } : file)),
    };

    const { plan, result } = yield* planAndApply(mapInput);

    expect(A.map(plan.summary.uploadCountsByRule, (count) => [count.ruleId._tag, count.uploadCount])).toEqual([
      ["None", 2],
      ["Some", 1],
    ]);
    expect(result.verdict).toBe("complete");
    expect(result.receipt.uploadedBytes).toBe(12);
    expect(A.filter(fake.entries(), (entry) => entry.name === "empty.bin")).toMatchObject([
      { sha1: sha1Hex(bytes("")), type: "file" },
    ]);
    expect(yield* Ref.get(journal)).toEqual([]);
  }),
  false
);

scenario(
  "@beep/box-provisioning content migration fails a folder create whose name is held by a file",
  { entries: [storedFile("300", "Inbox", rootFolderId, "a file, not a folder")] },
  Effect.fnUntraced(function* () {
    const { fake } = yield* MigrationHarness;
    const { mapInput } = yield* prepare(inboxFile);

    const { result } = yield* planAndApply(mapInput);

    // The 409 is re-listed, no folder with that name exists, so nothing is adopted and nothing is replaced.
    expect(failedOutcomes(result.receipt.outcomes)).toMatchObject([
      { actionKind: "folder", failureKind: "name-in-use", status: { _tag: "Some", value: 409 } },
    ]);
    expect(outcomeTags(result.receipt.outcomes, "file")).toEqual(["NotAttempted"]);
    expect(result.verdict).toBe("incomplete");
    expect(fake.entries()).toEqual([storedFile("300", "Inbox", rootFolderId, "a file, not a folder")]);
    expect(fake.calls.uploadFile).toBe(0);
  })
);

scenario(
  "@beep/box-provisioning content migration reports a failed re-list after a folder conflict",
  {},
  Effect.fnUntraced(function* () {
    const { fake, onAppend } = yield* MigrationHarness;
    const { mapInput } = yield* prepare(inboxFile);
    fake.raceFolder("Inbox");
    // The root listing fails only once the create has been journaled, i.e. on the adoption re-list.
    yield* Ref.set(onAppend, (entry) =>
      Effect.sync(() => {
        if (entry.phase === "Started" && entry.actionKind === "folder") {
          fake.failListingOnce(rootFolderId);
        }
      })
    );

    const { result } = yield* planAndApply(mapInput);

    expect(failedOutcomes(result.receipt.outcomes)).toMatchObject([
      { actionKind: "folder", failureKind: "provider-error", status: { _tag: "Some", value: 503 } },
    ]);
    expect(outcomeTags(result.receipt.outcomes, "file")).toEqual(["NotAttempted"]);
    expect(folderTags(result.postPlan)).toEqual(["FolderExists"]);
    expect(fileTags(result.postPlan)).toEqual(["Upload"]);
    expect(result.verdict).toBe("incomplete");
  })
);

scenario(
  "@beep/box-provisioning content migration never spends past the budget on an adoption re-list",
  {
    entries: A.map(["One", "Two", "Three", "Four", "Five", "Six"], (name, index) => folder(`21${index}`, name)),
    pageSize: 1,
  },
  Effect.fnUntraced(function* () {
    const { fake, journal } = yield* MigrationHarness;
    const migration = yield* BoxContentMigration;
    const { mapInput } = yield* prepare(inboxFile);
    const options = BoxContentMigrationOptions.make({ maxProviderCalls: O.some(12) });
    const plan = yield* migration.plan(mapInput, options);
    fake.raceFolder("Inbox");
    const callsBefore = fake.totalCalls();

    const error = yield* Effect.flip(
      migration.applyReviewedPlan(mapInput, yield* encodeBoxContentMigrationPlan(plan), options)
    );

    // Seven one-entry pages were needed to re-list the root; the cap allowed four, then stopped the run.
    expect(plan.summary.planProviderCalls).toBe(7);
    expect(error).toMatchObject({ _tag: "BoxContentMigrationBudgetError", maxProviderCalls: 12, phase: "post-plan" });
    expect(fake.totalCalls() - callsBefore).toBe(12);
    expect(A.map(yield* Ref.get(journal), (entry) => entry.phase)).toEqual(["Started", "Failed", "Skipped"]);
    expect(A.filter(yield* Ref.get(journal), (entry) => entry.phase === "Failed")).toMatchObject([
      { actionKind: "folder", failureKind: "budget-exhausted" },
    ]);
    expect(fake.calls.uploadFile).toBe(0);
  })
);

scenario(
  "@beep/box-provisioning content migration leaves a folder create unattempted when the budget cannot cover it",
  {},
  Effect.fnUntraced(function* () {
    const { fake } = yield* MigrationHarness;
    const { mapInput } = yield* prepare(inboxFile);

    const { result } = yield* planAndApply(mapInput, BoxContentMigrationOptions.make({ maxProviderCalls: O.some(5) }));

    expect(A.filter(result.receipt.outcomes, (outcome) => outcome._tag === "NotAttempted")).toMatchObject([
      { actionKind: "folder", reason: "budget-exhausted" },
      { actionKind: "file", reason: "dependency-failed" },
    ]);
    expect(result.receipt.providerCalls).toBe(4);
    expect(result.verdict).toBe("incomplete");
    expect(fake.calls).toMatchObject({ createFolder: 0, uploadFile: 0 });
  })
);

scenario(
  "@beep/box-provisioning content migration fails a folder create it cannot verify",
  {},
  Effect.fnUntraced(function* () {
    const { fake } = yield* MigrationHarness;
    const { mapInput } = yield* prepare(inboxFile);
    fake.malformFolder("Inbox");

    const { result } = yield* planAndApply(mapInput);

    expect(failedOutcomes(result.receipt.outcomes)).toMatchObject([
      { actionKind: "folder", failureKind: "unreadable-response" },
    ]);
    expect(outcomeTags(result.receipt.outcomes, "file")).toEqual(["NotAttempted"]);
    expect(fake.calls.uploadFile).toBe(0);
    // The folder does exist, so the next plan picks it up without creating a second one.
    expect(folderTags(result.postPlan)).toEqual(["FolderExists"]);
  })
);

scenario(
  "@beep/box-provisioning content migration fails uploads whose response cannot be verified",
  { entries: [folder("200", "Inbox")] },
  Effect.fnUntraced(function* () {
    const { fake } = yield* MigrationHarness;
    const { mapInput } = yield* prepare([
      source("a.txt", ["Inbox"], "a.txt", "alpha"),
      source("b.txt", ["Inbox"], "b.txt", "bravo"),
    ]);
    fake.emptyUploadResponse("a.txt");
    fake.hashlessUpload("b.txt");

    const { result } = yield* planAndApply(mapInput);

    const failures = failedOutcomes(result.receipt.outcomes);
    expect(A.map(failures, (outcome) => outcome.failureKind)).toEqual(["unreadable-response", "unreadable-response"]);
    // Only the response that named a file carries its provider id.
    expect(
      A.sort(
        A.map(failures, (outcome) => outcome.providerId._tag),
        Str.Order
      )
    ).toEqual(["None", "Some"]);
    expect(result.receipt.uploadedBytes).toBe(0);
    // Box did store both files intact, which the independent post-apply listing then proves.
    expect(fileTags(result.postPlan)).toEqual(["SkipIdentical", "SkipIdentical"]);
    expect(result.verdict).toBe("complete");
  })
);

scenario(
  "@beep/box-provisioning content migration fails an upload whose source vanishes mid-run",
  { entries: [folder("200", "Inbox")] },
  Effect.fnUntraced(function* () {
    const { fake, onAppend } = yield* MigrationHarness;
    const fs = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const { mapInput, sourceRoot } = yield* prepare(inboxFile);
    yield* Ref.set(onAppend, (entry) =>
      entry.phase === "Started" ? Effect.orDie(fs.remove(path.join(sourceRoot, "a.txt"))) : Effect.void
    );

    const { result } = yield* planAndApply(mapInput);

    expect(failedOutcomes(result.receipt.outcomes)).toMatchObject([
      { actionKind: "file", failureKind: "provider-error" },
    ]);
    expect(A.filter(fake.entries(), (entry) => entry.type === "file")).toEqual([]);
    expect(result.verdict).toBe("incomplete");
  })
);
