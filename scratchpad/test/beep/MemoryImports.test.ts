import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/unstable/arbitrary/Arbitrary";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  CheckedMemoryImportBatchItem,
  MemoryImportArtifact,
  MemoryImportArtifactSourceState,
  MemoryImportBatchItem,
  MemoryImportBatchRequest,
  MemoryImportRun,
  MemoryImportRunStatus,
  importItemHasIdentity,
  normalizeSensitivityLabels,
  utcNow,
} from "../../beep/MemoryImports.ts";

const decode = <Sch extends S.Codec<unknown, unknown, never, unknown>>(schema: Sch, input: unknown): Sch["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const iso = "2026-01-02T03:04:05.000Z";

const item = {
  externalId: " ext-1 ",
  occurredAt: iso,
  title: " Title ",
  snippet: "snippet",
  content: "body",
  contentHash: "hash-1",
  metadata: { source: "limitless" },
  clientDeviceId: "device-1",
};

const run = {
  runId: "run-1",
  uid: "user-1",
  sourceType: "limitless",
  sourceAccountHash: "acct-hash",
  importerVersion: "v1",
  extractorVersion: "x1",
  status: "extracting",
  artifactCount: 4,
  candidateCount: 3,
  acceptedCount: 2,
  promotedCount: 1,
  dedupedCount: 0,
  startedAt: iso,
  updatedAt: iso,
  completedAt: iso,
  lastError: "boom",
};

const artifactRow = {
  artifactId: "art-1",
  uid: "user-1",
  runId: "run-1",
  sourceType: "limitless",
  externalId: "ext-1",
  contentHash: "hash-1",
  title: "Title",
  snippet: "snippet",
  redactedBody: "redacted",
  metadata: {},
  occurredAt: iso,
  capturedAt: iso,
  clientDeviceId: "device-1",
  sourceState: "active",
  redactionStatus: "redacted_or_summary",
  sensitivityLabels: [" PII ", "pii", "", "Health"],
  createdAt: iso,
  updatedAt: iso,
};

describe("MemoryImports literals", () => {
  it("accept every member and reject strangers", () => {
    for (const value of ["received", "extracting", "completed", "failed", "cancelled"]) {
      assert.strictEqual(decode(MemoryImportRunStatus, value), value);
    }
    assert.strictEqual(decodeFails(MemoryImportRunStatus, "canceled"), true);
    for (const value of ["active", "tombstoned", "purged"]) {
      assert.strictEqual(decode(MemoryImportArtifactSourceState, value), value);
    }
    assert.strictEqual(decodeFails(MemoryImportArtifactSourceState, "missing"), true);
  });
});

describe("MemoryImportBatchItem", () => {
  it("decodes present values and strips text", () => {
    const decoded = decode(MemoryImportBatchItem, item);
    assert.strictEqual(O.getOrNull(decoded.externalId), "ext-1");
    assert.strictEqual(O.getOrNull(decoded.title), "Title");
    assert.strictEqual(O.getOrNull(decoded.snippet), "snippet");
    assert.strictEqual(O.getOrNull(decoded.content), "body");
    assert.strictEqual(O.getOrNull(decoded.contentHash), "hash-1");
    assert.strictEqual(O.getOrNull(decoded.clientDeviceId), "device-1");
    assert.deepStrictEqual(decoded.metadata, { source: "limitless" });
    assert.strictEqual(DateTime.formatIso(decoded.occurredAt.pipe(O.getOrThrow)), iso);
  });

  it("decodes null, missing, and blank text to None and encodes None as null", () => {
    const nulled = decode(MemoryImportBatchItem, {
      externalId: null,
      occurredAt: null,
      title: null,
      snippet: null,
      content: null,
      contentHash: null,
      metadata: {},
      clientDeviceId: null,
    });
    assert.strictEqual(O.isNone(nulled.externalId), true);
    assert.strictEqual(O.isNone(nulled.occurredAt), true);
    const blank = decode(MemoryImportBatchItem, { externalId: "   ", title: "", metadata: {} });
    assert.strictEqual(O.isNone(blank.externalId), true);
    assert.strictEqual(O.isNone(blank.title), true);
    assert.strictEqual(O.isNone(blank.snippet), true);
    assert.strictEqual(O.isNone(blank.content), true);
    assert.strictEqual(O.isNone(blank.contentHash), true);
    assert.strictEqual(O.isNone(blank.clientDeviceId), true);
    assert.strictEqual(O.isNone(blank.occurredAt), true);
    const encoded = Effect.runSync(S.encodeEffect(MemoryImportBatchItem)(blank));
    assert.strictEqual(encoded.externalId, null);
    assert.strictEqual(encoded.title, null);
    assert.strictEqual(encoded.occurredAt, null);
    assert.strictEqual(encoded.clientDeviceId, null);
    assert.deepStrictEqual(MemoryImportBatchItem.make({}).metadata, {});
  });

  it("importItemHasIdentity accepts any single identity source", () => {
    const empty = MemoryImportBatchItem.make({});
    assert.strictEqual(importItemHasIdentity(empty), false);
    assert.strictEqual(importItemHasIdentity(MemoryImportBatchItem.make({ externalId: O.some("x") })), true);
    assert.strictEqual(importItemHasIdentity(MemoryImportBatchItem.make({ contentHash: O.some("x") })), true);
    assert.strictEqual(importItemHasIdentity(MemoryImportBatchItem.make({ content: O.some("x") })), true);
    assert.strictEqual(importItemHasIdentity(MemoryImportBatchItem.make({ snippet: O.some("x") })), true);
    assert.strictEqual(importItemHasIdentity(MemoryImportBatchItem.make({ title: O.some("x") })), true);
  });

  it("CheckedMemoryImportBatchItem rejects an item without identity", () => {
    assert.strictEqual(decodeFails(CheckedMemoryImportBatchItem, { metadata: {} }), true);
    assert.strictEqual(decodeFails(CheckedMemoryImportBatchItem, { externalId: "  ", metadata: {} }), true);
    assert.strictEqual(decodeFails(CheckedMemoryImportBatchItem, { title: "t", metadata: {} }), false);
    assert.strictEqual(decodeFails(MemoryImportBatchItem, { metadata: {} }), false);
  });
});

describe("MemoryImportBatchRequest", () => {
  it("decodes, strips, and defaults", () => {
    const request = decode(MemoryImportBatchRequest, {
      sourceType: " limitless ",
      importRunId: "run-1",
      sourceAccountHash: null,
      importerVersion: " v2 ",
      items: [item],
    });
    assert.strictEqual(request.sourceType, "limitless");
    assert.strictEqual(request.importerVersion, "v2");
    assert.strictEqual(O.getOrNull(request.importRunId), "run-1");
    assert.strictEqual(O.isNone(request.sourceAccountHash), true);
    assert.strictEqual(O.isNone(request.extractorVersion), true);
    assert.strictEqual(request.items.length, 1);
    const made = MemoryImportBatchRequest.make({ sourceType: "limitless" });
    assert.strictEqual(made.importerVersion, "v1");
    assert.deepStrictEqual(made.items, []);
  });

  it("rejects a blank source type and more than 100 items", () => {
    assert.strictEqual(decodeFails(MemoryImportBatchRequest, { sourceType: "   ", importerVersion: "v1", items: [] }), true);
    assert.strictEqual(decodeFails(MemoryImportBatchRequest, { sourceType: "x", importerVersion: " ", items: [] }), true);
    const tooMany = Array.from({ length: 101 }, () => ({ title: "t", metadata: {} }));
    assert.strictEqual(decodeFails(MemoryImportBatchRequest, { sourceType: "x", importerVersion: "v1", items: tooMany }), true);
    assert.strictEqual(
      decodeFails(MemoryImportBatchRequest, { sourceType: "x", importerVersion: "v1", items: tooMany.slice(0, 100) }),
      false,
    );
  });
});

describe("MemoryImportRun", () => {
  it("decodes present values", () => {
    const decoded = decode(MemoryImportRun, run);
    assert.strictEqual(decoded.status, "extracting");
    assert.strictEqual(O.getOrNull(decoded.sourceAccountHash), "acct-hash");
    assert.strictEqual(O.getOrNull(decoded.extractorVersion), "x1");
    assert.strictEqual(decoded.artifactCount, 4);
    assert.strictEqual(decoded.dedupedCount, 0);
    assert.strictEqual(DateTime.formatIso(decoded.completedAt.pipe(O.getOrThrow)), iso);
    assert.strictEqual(O.getOrNull(decoded.lastError), "boom");
  });

  it("decodes null and missing Option fields to None, defaults counters, and encodes None as null", () => {
    const decoded = decode(MemoryImportRun, {
      runId: "run-2",
      uid: "user-1",
      sourceType: "limitless",
      importerVersion: "v1",
      status: "received",
      artifactCount: 0,
      candidateCount: 0,
      acceptedCount: 0,
      promotedCount: 0,
      dedupedCount: 0,
      startedAt: iso,
      updatedAt: iso,
      completedAt: null,
      lastError: null,
    });
    assert.strictEqual(O.isNone(decoded.sourceAccountHash), true);
    assert.strictEqual(O.isNone(decoded.extractorVersion), true);
    assert.strictEqual(O.isNone(decoded.completedAt), true);
    assert.strictEqual(O.isNone(decoded.lastError), true);
    const encoded = Effect.runSync(S.encodeEffect(MemoryImportRun)(decoded));
    assert.strictEqual(encoded.sourceAccountHash, null);
    assert.strictEqual(encoded.completedAt, null);
    assert.strictEqual(encoded.lastError, null);
    assert.strictEqual(encoded.startedAt, iso);
    const made = MemoryImportRun.make({
      runId: "run-3",
      uid: "user-1",
      sourceType: "limitless",
      importerVersion: "v1",
      startedAt: decoded.startedAt,
      updatedAt: decoded.updatedAt,
    });
    assert.strictEqual(made.status, "received");
    assert.strictEqual(made.artifactCount, 0);
    assert.strictEqual(made.promotedCount, 0);
  });

  it("rejects negative or fractional counters and an unknown status", () => {
    assert.strictEqual(decodeFails(MemoryImportRun, { ...run, artifactCount: -1 }), true);
    assert.strictEqual(decodeFails(MemoryImportRun, { ...run, candidateCount: 1.5 }), true);
    assert.strictEqual(decodeFails(MemoryImportRun, { ...run, status: "canceled" }), true);
  });
});

describe("normalizeSensitivityLabels", () => {
  it("trims, lowercases, drops blanks, dedupes, and sorts", () => {
    assert.deepStrictEqual(normalizeSensitivityLabels([" PII ", "pii", "", "  ", "Health", "health"]), ["health", "pii"]);
    assert.deepStrictEqual(normalizeSensitivityLabels([]), []);
  });
});

describe("MemoryImportArtifact", () => {
  it("decodes present values and normalizes labels", () => {
    const decoded = decode(MemoryImportArtifact, artifactRow);
    assert.strictEqual(decoded.artifactId, "art-1");
    assert.strictEqual(O.getOrNull(decoded.externalId), "ext-1");
    assert.strictEqual(O.getOrNull(decoded.redactedBody), "redacted");
    assert.strictEqual(decoded.sourceState, "active");
    assert.strictEqual(decoded.redactionStatus, "redacted_or_summary");
    assert.deepStrictEqual(decoded.sensitivityLabels, ["health", "pii"]);
    assert.strictEqual(DateTime.formatIso(decoded.occurredAt.pipe(O.getOrThrow)), iso);
    assert.strictEqual(DateTime.formatIso(decoded.capturedAt), iso);
  });

  it("decodes missing Option fields to None, applies defaults, and encodes None as null", () => {
    const decoded = decode(MemoryImportArtifact, {
      artifactId: "art-2",
      uid: "user-1",
      runId: "run-1",
      sourceType: "limitless",
      contentHash: "hash-2",
      metadata: {},
      capturedAt: iso,
      sourceState: "tombstoned",
      redactionStatus: "redacted_or_summary",
      sensitivityLabels: [],
      createdAt: iso,
      updatedAt: iso,
      occurredAt: null,
      title: null,
    });
    assert.strictEqual(O.isNone(decoded.externalId), true);
    assert.strictEqual(O.isNone(decoded.title), true);
    assert.strictEqual(O.isNone(decoded.snippet), true);
    assert.strictEqual(O.isNone(decoded.redactedBody), true);
    assert.strictEqual(O.isNone(decoded.occurredAt), true);
    assert.strictEqual(O.isNone(decoded.clientDeviceId), true);
    assert.strictEqual(decoded.sourceState, "tombstoned");
    const encoded = Effect.runSync(S.encodeEffect(MemoryImportArtifact)(decoded));
    assert.strictEqual(encoded.externalId, null);
    assert.strictEqual(encoded.occurredAt, null);
    assert.strictEqual(encoded.clientDeviceId, null);
    const made = MemoryImportArtifact.make({
      artifactId: "art-3",
      uid: "user-1",
      runId: "run-1",
      sourceType: "limitless",
      contentHash: "hash-3",
      capturedAt: decoded.capturedAt,
      createdAt: decoded.createdAt,
      updatedAt: decoded.updatedAt,
    });
    assert.strictEqual(made.sourceState, "active");
    assert.strictEqual(made.redactionStatus, "redacted_or_summary");
    assert.deepStrictEqual(made.sensitivityLabels, []);
    assert.deepStrictEqual(made.metadata, {});
  });

  it("rejects an unknown source state", () => {
    assert.strictEqual(decodeFails(MemoryImportArtifact, { ...artifactRow, sourceState: "missing" }), true);
  });
});

describe("utcNow", () => {
  it("returns the same UTC instant", () => {
    const now = decode(MemoryImportRun, run).startedAt;
    assert.strictEqual(DateTime.formatIso(now.pipe(utcNow)), iso);
  });
});

describe("arbitraries", () => {
  it("derive for every exported schema", () => {
    for (const schema of [
      MemoryImportRunStatus,
      MemoryImportArtifactSourceState,
      MemoryImportBatchItem,
      CheckedMemoryImportBatchItem,
      MemoryImportBatchRequest,
      MemoryImportRun,
      MemoryImportArtifact,
    ]) {
      assert.strictEqual(Arbitrary.isArbitrary(schema.pipe(Arbitrary.schema)), true);
    }
  });
});
