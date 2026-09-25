import { assert, describe, it } from "@effect/vitest";
import * as Arbitrary from "effect/Arbitrary";
import * as A from "effect/Array";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import {
  ImportJob,
  ImportJobResponse,
  ImportJobStatus,
  ImportSourceType,
  dumpImportJob,
} from "../../beep/ImportJob.ts";

const decode = <A extends S.Top & S.Codec<unknown, unknown, never, unknown>>(schema: A, input: unknown): A["Type"] =>
  Effect.runSync(S.decodeUnknownEffect(schema)(input));

const decodeFails = (schema: S.Codec<unknown, unknown, never, unknown>, input: unknown): boolean =>
  Effect.runSyncExit(S.decodeUnknownEffect(schema)(input))._tag === "Failure";

const jobInput = {
  id: "job-1",
  uid: "user-1",
  status: "processing",
  sourceType: "limitless",
  totalFiles: 4,
  processedFiles: 2,
  conversationsCreated: 3,
  conversationsSkipped: 1,
  createdAt: "2020-01-02T03:04:05.000Z",
  startedAt: "2020-01-02T04:00:00.000Z",
  completedAt: null,
  error: null,
};

describe("ImportJob", () => {
  it("decodes present values and null option fields", () => {
    const decoded = decode(ImportJob, jobInput);
    assert.strictEqual(decoded.id, "job-1");
    assert.strictEqual(decoded.uid, "user-1");
    assert.strictEqual(decoded.status, "processing");
    assert.strictEqual(decoded.sourceType, "limitless");
    assert.strictEqual(decoded.totalFiles, 4);
    assert.strictEqual(decoded.processedFiles, 2);
    assert.strictEqual(decoded.conversationsCreated, 3);
    assert.strictEqual(decoded.conversationsSkipped, 1);
    assert.strictEqual(DateTime.formatIso(decoded.createdAt), "2020-01-02T03:04:05.000Z");
    assert.strictEqual(O.isSome(decoded.startedAt) && DateTime.formatIso(decoded.startedAt.value), "2020-01-02T04:00:00.000Z");
    assert.strictEqual(O.isNone(decoded.completedAt), true);
    assert.strictEqual(O.isNone(decoded.error), true);
  });

  it("decodes missing option fields as None and constructs non-null defaults", () => {
    const missing = decode(ImportJob, {
      id: "job-1",
      uid: "user-1",
      status: "pending",
      sourceType: "limitless",
      totalFiles: 0,
      processedFiles: 0,
      conversationsCreated: 0,
      conversationsSkipped: 0,
      createdAt: "2020-01-02T03:04:05.000Z",
    });
    assert.strictEqual(O.isNone(missing.startedAt), true);
    assert.strictEqual(O.isNone(missing.completedAt), true);
    assert.strictEqual(O.isNone(missing.error), true);
    const made = ImportJob.make({ id: "job-1", uid: "user-1", sourceType: "limitless" });
    assert.strictEqual(made.status, "pending");
    assert.strictEqual(made.totalFiles, 0);
    assert.strictEqual(made.processedFiles, 0);
    assert.strictEqual(made.conversationsCreated, 0);
    assert.strictEqual(made.conversationsSkipped, 0);
    assert.strictEqual(DateTime.isDateTime(made.createdAt), true);
    assert.strictEqual(O.isNone(made.startedAt), true);
  });

  it("keeps cancelled distinct and rejects an unknown status or source", () => {
    assert.strictEqual(decode(ImportJobStatus, "cancelled"), "cancelled");
    assert.strictEqual(decode(ImportSourceType, "limitless"), "limitless");
    assert.strictEqual(decodeFails(ImportJob, { ...jobInput, status: "canceled" }), true);
    assert.strictEqual(decodeFails(ImportJob, { ...jobInput, sourceType: "omi" }), true);
  });

  it("encodes clocks as strings and leaves null clocks null", () => {
    const encoded = Effect.runSync(dumpImportJob(decode(ImportJob, jobInput)));
    assert.strictEqual(encoded.createdAt, "2020-01-02T03:04:05.000Z");
    assert.strictEqual(encoded.startedAt, "2020-01-02T04:00:00.000Z");
    assert.strictEqual(encoded.completedAt, null);
  });

  it("derives an arbitrary for every exported model", () => {
    const schemas = [ImportJobStatus, ImportSourceType, ImportJob, ImportJobResponse];
    A.forEach(schemas, (schema) => {
      assert.strictEqual(Arbitrary.isArbitrary(schema.pipe(Arbitrary.schema)), true);
    });
  });
});

describe("ImportJobResponse", () => {
  it("decodes present counters, including a negative count", () => {
    const decoded = decode(ImportJobResponse, {
      jobId: "job-1",
      status: "failed",
      totalFiles: -1,
      processedFiles: 2,
      conversationsCreated: 0,
      conversationsSkipped: 4,
      createdAt: "2020-01-02T03:04:05.000Z",
      error: "disk full",
    });
    assert.strictEqual(decoded.jobId, "job-1");
    assert.strictEqual(decoded.status, "failed");
    assert.strictEqual(O.isSome(decoded.totalFiles) && decoded.totalFiles.value, -1);
    assert.strictEqual(O.isSome(decoded.error) && decoded.error.value, "disk full");
    assert.strictEqual(O.isSome(decoded.createdAt) && decoded.createdAt.value, "2020-01-02T03:04:05.000Z");
  });

  it("decodes null and missing option fields as None", () => {
    const nulled = decode(ImportJobResponse, {
      jobId: "job-1",
      status: "pending",
      totalFiles: null,
      processedFiles: null,
      conversationsCreated: null,
      conversationsSkipped: null,
      createdAt: null,
      error: null,
    });
    assert.strictEqual(O.isNone(nulled.totalFiles), true);
    assert.strictEqual(O.isNone(nulled.processedFiles), true);
    assert.strictEqual(O.isNone(nulled.conversationsCreated), true);
    assert.strictEqual(O.isNone(nulled.conversationsSkipped), true);
    assert.strictEqual(O.isNone(nulled.createdAt), true);
    assert.strictEqual(O.isNone(nulled.error), true);
    const missing = decode(ImportJobResponse, { jobId: "job-1", status: "pending" });
    assert.strictEqual(O.isNone(missing.totalFiles), true);
    assert.strictEqual(O.isNone(missing.error), true);
  });
});

