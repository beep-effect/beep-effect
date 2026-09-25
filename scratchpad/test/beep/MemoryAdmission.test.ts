import { createHash } from "node:crypto";
import { assert, describe, it } from "@effect/vitest";
import * as O from "effect/Option";
import {
  REQUIRED_PROCESSING_RECEIPT_VERSION,
  REQUIRED_PROCESSOR_ID,
  REQUIRED_PROCESSOR_VERSION,
  pythonInt,
  validRequiredProcessingReceipt,
} from "../../beep/MemoryAdmission.ts";

const content = "Ada lives in Seattle";
const outputHash = createHash("sha256").update(content, "utf8").digest("hex");

const baseReceipt = {
  receiptVersion: REQUIRED_PROCESSING_RECEIPT_VERSION,
  processorId: REQUIRED_PROCESSOR_ID,
  processorVersion: REQUIRED_PROCESSOR_VERSION,
  decision: "durable_required",
  sourceSubmissionId: "sub-1",
  inputHash: "hash-1",
  outputHash,
  inputItemRevision: 1,
  outputItemRevision: 2,
};

const baseSubmission = {
  submissionId: "sub-1",
  contentHash: "hash-1",
};

const promotion = (patch: {
  readonly processorId?: unknown;
  readonly processorVersion?: unknown;
  readonly processingReceipt?: unknown;
  readonly submission?: unknown;
} = {}): Record<string, unknown> => ({
  processorId: REQUIRED_PROCESSOR_ID,
  processorVersion: REQUIRED_PROCESSOR_VERSION,
  processingReceipt: baseReceipt,
  submission: baseSubmission,
  ...patch,
});

const check = (
  patch: {
    readonly processorId?: unknown;
    readonly processorVersion?: unknown;
    readonly processingReceipt?: unknown;
    readonly submission?: unknown;
  } = {},
  itemRevision = 2,
): boolean => validRequiredProcessingReceipt({ content, itemRevision, promotion: promotion(patch) });

describe("validRequiredProcessingReceipt", () => {
  it("accepts a bound receipt and a boolean revision", () => {
    assert.strictEqual(check(), true);
    assert.strictEqual(O.getOrNull(pythonInt(true)), 1);
    assert.strictEqual(O.getOrNull(pythonInt(false)), 0);
    assert.strictEqual(O.isNone(pythonInt(1.5)), true);
    assert.strictEqual(
      check({ processingReceipt: { ...baseReceipt, inputItemRevision: true, outputItemRevision: 2 } }),
      true,
    );
  });

  it("rejects each broken clause", () => {
    assert.strictEqual(validRequiredProcessingReceipt({ content, itemRevision: 2, promotion: {} }), false);
    assert.strictEqual(check({ processingReceipt: "nope" }), false);
    const receipt = (patch: Record<string, unknown>) => ({ ...baseReceipt, ...patch });
    assert.strictEqual(check({ processingReceipt: receipt({ receiptVersion: "other" }) }), false);
    assert.strictEqual(check({ processingReceipt: receipt({ processorId: "other" }) }), false);
    assert.strictEqual(check({ processingReceipt: receipt({ processorVersion: "v2" }) }), false);
    assert.strictEqual(check({ processorId: "other" }), false);
    assert.strictEqual(check({ processorVersion: "v2" }), false);
    assert.strictEqual(check({ processingReceipt: receipt({ decision: "drop" }) }), false);
    assert.strictEqual(check({ submission: { submissionId: "", contentHash: "hash-1" } }), false);
    assert.strictEqual(check({ submission: { submissionId: "other", contentHash: "hash-1" } }), false);
    assert.strictEqual(check({ processingReceipt: receipt({ inputHash: "nope" }) }), false);
    assert.strictEqual(check({ processingReceipt: receipt({ outputHash: "nope" }) }), false);
    assert.strictEqual(check({ processingReceipt: receipt({ inputItemRevision: "1" }) }), false);
    assert.strictEqual(check({ processingReceipt: receipt({ outputItemRevision: 3 }) }), false);
    assert.strictEqual(check({}, 1), false);
  });
});
