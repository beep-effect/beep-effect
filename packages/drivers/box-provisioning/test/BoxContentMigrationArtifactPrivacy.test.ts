import {
  BoxApplyAttemptId,
  BoxContentActionBlocked,
  BoxContentActionFailed,
  BoxContentActionKind,
  BoxContentActionNotAttempted,
  BoxContentBlockReason,
  BoxContentFailureKind,
  BoxContentJournalEntry,
  BoxContentJournalSkipped,
  BoxContentJournalStarted,
  BoxContentMigrationPlan,
  BoxContentMigrationReceipt,
  BoxContentMigrationRuleId,
  BoxContentMigrationVerdict,
  BoxContentNotAttemptedReason,
  BoxContentUploadTransport,
  BoxProviderId,
  BoxSourceRevision,
  decodeBoxContentMigrationPlan,
  decodeBoxContentMigrationReceipt,
  encodeBoxContentJournalEntry,
  makeExampleContentJournalFields,
} from "@beep/box-provisioning";
import { Sha256Hex } from "@beep/schema";
import { it } from "@beep/test-runner";
import { describe, expect } from "@effect/vitest";
import { assertFalse } from "@effect/vitest/utils";
import { Effect, pipe } from "effect";
import * as A from "effect/Array";
import * as S from "effect/Schema";

const sensitiveSentinels = [
  { category: "folder-name", value: "Confidential Client Folder" },
  { category: "file-name", value: "Engagement Letter - Jane Doe.pdf" },
  { category: "source-path", value: "/srv/clients/jane-doe/engagement letter.pdf" },
  { category: "login", value: "attorney@example.test" },
  { category: "error-text", value: "Item with the same name already exists" },
];

const digest = "a".repeat(64);
const isJournalSkipped = S.is(BoxContentJournalSkipped);
const isActionBlocked = S.is(BoxContentActionBlocked);
const isActionFailed = S.is(BoxContentActionFailed);
const isActionNotAttempted = S.is(BoxContentActionNotAttempted);
const journalBase = { actionDigest: digest, attemptId: "attempt-12345678", planDigest: digest, sequence: 0 };

/** Every schema a string can occupy in a plan, receipt, or journal entry. */
const stringCarriers = [
  { schemaName: "Sha256Hex", accepts: S.is(Sha256Hex) },
  { schemaName: "BoxProviderId", accepts: S.is(BoxProviderId) },
  { schemaName: "BoxSourceRevision", accepts: S.is(BoxSourceRevision) },
  { schemaName: "BoxApplyAttemptId", accepts: S.is(BoxApplyAttemptId) },
  { schemaName: "BoxContentMigrationRuleId", accepts: S.is(BoxContentMigrationRuleId) },
];

const closedDomains = [
  { schemaName: "BoxContentUploadTransport", accepts: S.is(BoxContentUploadTransport) },
  { schemaName: "BoxContentActionKind", accepts: S.is(BoxContentActionKind) },
  { schemaName: "BoxContentFailureKind", accepts: S.is(BoxContentFailureKind) },
  { schemaName: "BoxContentBlockReason", accepts: S.is(BoxContentBlockReason) },
  { schemaName: "BoxContentNotAttemptedReason", accepts: S.is(BoxContentNotAttemptedReason) },
  { schemaName: "BoxContentMigrationVerdict", accepts: S.is(BoxContentMigrationVerdict) },
  {
    schemaName: "BoxContentActionBlocked.reason",
    accepts: (sentinel: string) =>
      isActionBlocked({ _tag: "Blocked", actionDigest: digest, actionKind: "file", reason: sentinel }),
  },
  {
    schemaName: "BoxContentActionFailed.failureKind",
    accepts: (sentinel: string) =>
      isActionFailed({ _tag: "Failed", actionDigest: digest, actionKind: "file", failureKind: sentinel }),
  },
  {
    schemaName: "BoxContentActionNotAttempted.reason",
    accepts: (sentinel: string) =>
      isActionNotAttempted({ _tag: "NotAttempted", actionDigest: digest, actionKind: "file", reason: sentinel }),
  },
  {
    schemaName: "BoxContentJournalSkipped.reason",
    accepts: (sentinel: string) =>
      isJournalSkipped({ ...journalBase, actionKind: "file", phase: "Skipped", reason: sentinel }),
  },
];

const emptySummary = {
  blockedNameConflictCount: 0,
  blockedSourceChangedCount: 0,
  blockedSourceMissingCount: 0,
  estimatedProviderCalls: 4,
  folderCreateCount: 0,
  folderExistsCount: 0,
  planProviderCalls: 2,
  skipIdenticalCount: 0,
  totalUploadBytes: 0,
  uploadCount: 0,
  uploadCountsByRule: [],
};

const planDocument = {
  chunkedThresholdBytes: 52_428_800,
  expectedEnterpriseId: "enterprise-id",
  fileActions: [{ _tag: "Upload", entryDigest: digest, sizeBytes: 1, transport: "single" }],
  folderActions: [{ _tag: "FolderCreate", depth: 1, parentPathDigest: digest, pathDigest: digest }],
  mapDigest: digest,
  planDigest: digest,
  rootFolderId: "100",
  sourceRevision: "map-1",
  subjectId: "service-account-id",
  summary: emptySummary,
  version: "box-content-migration-plan/v1",
};

const receiptDocument = {
  appliedAt: "2026-08-30T00:00:00.000Z",
  attemptId: "attempt-12345678",
  counts: { applied: 0, blocked: 0, failed: 1, notAttempted: 0, skipped: 0 },
  outcomes: [{ _tag: "Failed", actionDigest: digest, actionKind: "file", failureKind: "provider-error", status: 503 }],
  planDigest: digest,
  providerCalls: 4,
  uploadedBytes: 0,
  version: "box-content-migration-receipt/v1",
};

const journalDocument = { ...journalBase, actionKind: "file", failureKind: "provider-error", phase: "Failed" };

const encodeJsonText = S.encodeEffect(S.fromJsonString(S.Unknown));
/** Sentinel documents are plain JSON values, so serializing one cannot fail. */
const encodeJson = (document: unknown) => Effect.orDie(encodeJsonText(document));
const isPlan = S.is(S.toEncoded(BoxContentMigrationPlan));
const isReceipt = S.is(S.toEncoded(BoxContentMigrationReceipt));
const isJournalEntry = S.is(S.toEncoded(BoxContentJournalEntry));

/** One document per string-bearing field, each with that field replaced by the sentinel. */
const withSentinel = (document: Readonly<Record<string, unknown>>, sentinel: string) => [
  ...A.map(
    ["expectedEnterpriseId", "mapDigest", "planDigest", "rootFolderId", "sourceRevision", "subjectId"],
    (key) => ({
      ...document,
      [key]: sentinel,
    })
  ),
  { ...document, fileActions: [{ _tag: "Upload", entryDigest: sentinel, sizeBytes: 1, transport: "single" }] },
  { ...document, fileActions: [{ _tag: "Upload", entryDigest: digest, sizeBytes: 1, transport: sentinel }] },
  { ...document, fileActions: [{ _tag: "SkipIdentical", entryDigest: digest, providerId: sentinel }] },
  { ...document, folderActions: [{ _tag: "FolderExists", depth: 1, pathDigest: digest, providerId: sentinel }] },
  { ...document, folderActions: [{ _tag: "FolderCreate", depth: 1, parentPathDigest: sentinel, pathDigest: digest }] },
  {
    ...document,
    summary: { ...emptySummary, uploadCountsByRule: [{ ruleId: sentinel, uploadBytes: 1, uploadCount: 1 }] },
  },
];

describe("@beep/box-provisioning content migration artifact privacy", () => {
  describe("rejects sensitive-looking values from every string carrier", () => {
    it.each(
      A.flatMap(stringCarriers, (carrier) => A.map(sensitiveSentinels, (sentinel) => ({ ...carrier, ...sentinel })))
    )("$schemaName rejects $category", ({ accepts, value }) => {
      pipe(accepts(value), assertFalse);
    });
  });

  describe("keeps reasons, kinds, and verdicts in closed domains", () => {
    it.each(
      A.flatMap(closedDomains, (carrier) => A.map(sensitiveSentinels, (sentinel) => ({ ...carrier, ...sentinel })))
    )("$schemaName rejects $category", ({ accepts, value }) => {
      pipe(accepts(value), assertFalse);
    });
  });

  it("accepts the baseline plan, receipt, and journal documents", () => {
    expect([isPlan(planDocument), isReceipt(receiptDocument), isJournalEntry(journalDocument)]).toEqual([
      true,
      true,
      true,
    ]);
  });

  it.effect(
    "encodes a journal entry built from the documented example fields to the baseline shape",
    Effect.fnUntraced(function* () {
      const entry = BoxContentJournalStarted.make(makeExampleContentJournalFields());
      const decoded = yield* S.decodeEffect(S.fromJsonString(S.Unknown))(yield* encodeBoxContentJournalEntry(entry));

      expect(decoded).toEqual({ ...journalBase, actionKind: "file", phase: "Started", planDigest: "c".repeat(64) });
    })
  );

  describe("cannot decode a plan carrying a sentinel in any string field", () => {
    it.effect.each(sensitiveSentinels)(
      "$category",
      Effect.fnUntraced(function* ({ value }) {
        const errors = yield* Effect.forEach(withSentinel(planDocument, value), (document) =>
          encodeJson(document).pipe(Effect.flatMap(decodeBoxContentMigrationPlan), Effect.flip)
        );

        expect(A.dedupe(A.map(errors, (error) => error.stage))).toEqual(["migration-plan"]);
      })
    );
  });

  describe("cannot decode a receipt or journal entry carrying a sentinel", () => {
    it.effect.each(sensitiveSentinels)(
      "$category",
      Effect.fnUntraced(function* ({ value }) {
        const receipts = [
          { ...receiptDocument, attemptId: value },
          { ...receiptDocument, planDigest: value },
          { ...receiptDocument, outcomes: [{ ...receiptDocument.outcomes[0], actionDigest: value }] },
          { ...receiptDocument, outcomes: [{ ...receiptDocument.outcomes[0], failureKind: value }] },
          { ...receiptDocument, outcomes: [{ ...receiptDocument.outcomes[0], providerId: value }] },
          { ...receiptDocument, outcomes: [{ ...receiptDocument.outcomes[0], message: value }] },
        ];
        const errors = yield* Effect.forEach(A.take(receipts, 5), (document) =>
          encodeJson(document).pipe(Effect.flatMap(decodeBoxContentMigrationReceipt), Effect.flip)
        );
        // An unknown key such as raw error text is not rejected, it is dropped: it can never be re-encoded.
        const stripped = yield* encodeJson(receipts[5]).pipe(Effect.flatMap(decodeBoxContentMigrationReceipt));
        const journalEntries = [
          { ...journalDocument, actionDigest: value },
          { ...journalDocument, attemptId: value },
          { ...journalDocument, failureKind: value },
          { ...journalDocument, planDigest: value },
          { ...journalDocument, providerId: value },
        ];

        expect(A.dedupe(A.map(errors, (error) => error.stage))).toEqual(["migration-receipt"]);
        expect(stripped.outcomes).toMatchObject([{ _tag: "Failed", failureKind: "provider-error" }]);
        expect(stripped.outcomes[0]).not.toHaveProperty("message");
        pipe(A.some(journalEntries, isJournalEntry), assertFalse);
      })
    );
  });
});
