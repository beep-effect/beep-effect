/**
 * Canonical durable-memory admission receipt contract.
 *
 * The check is a boolean. Callers learn only whether the promotion dict is
 * bound to the current content lineage, not which clause failed.
 *
 * @since 0.0.0
 */
import { createHash } from "node:crypto";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as P from "effect/Predicate";

/**
 * Required `processing_receipt.receipt_version`.
 *
 * **Example** (Read the receipt version)
 *
 * ```ts
 * import { REQUIRED_PROCESSING_RECEIPT_VERSION } from "@beep/scratchpad/beep/MemoryAdmission"
 *
 * console.log(REQUIRED_PROCESSING_RECEIPT_VERSION) // "canonical_memory_processing_receipt.v1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const REQUIRED_PROCESSING_RECEIPT_VERSION = "canonical_memory_processing_receipt.v1";

/**
 * Required processor id on both the receipt and the promotion.
 *
 * **Example** (Read the processor id)
 *
 * ```ts
 * import { REQUIRED_PROCESSOR_ID } from "@beep/scratchpad/beep/MemoryAdmission"
 *
 * console.log(REQUIRED_PROCESSOR_ID) // "canonical_required_memory"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const REQUIRED_PROCESSOR_ID = "canonical_required_memory";

/**
 * Required processor version on both the receipt and the promotion.
 *
 * **Example** (Read the processor version)
 *
 * ```ts
 * import { REQUIRED_PROCESSOR_VERSION } from "@beep/scratchpad/beep/MemoryAdmission"
 *
 * console.log(REQUIRED_PROCESSOR_VERSION) // "v1"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const REQUIRED_PROCESSOR_VERSION = "v1";

const sha256Hex = (content: string): string => createHash("sha256").update(content, "utf8").digest("hex");

const isRecord = (value: unknown): value is Record<string, unknown> =>
  P.isObject(value);

const read = (record: Record<string, unknown>, key: string): unknown =>
  R.has(record, key) ? record[key] : undefined;

/**
 * Python `int` check, including booleans.
 *
 * **Details**
 *
 * `isinstance(True, int)` is true in Python, so a boolean revision passes the
 * admission arithmetic. `true` is 1 and `false` is 0. Non-integer numbers fail.
 *
 * **Example** (Count true as one)
 *
 * ```ts
 * import * as O from "effect/Option"
 * import { pythonInt } from "@beep/scratchpad/beep/MemoryAdmission"
 *
 * console.log(O.getOrNull(pythonInt(true))) // 1
 * ```
 *
 * @category utilities
 * @since 0.0.0
 */
export const pythonInt = (value: unknown): O.Option<number> => {
  if (P.isBoolean(value)) return O.some(value ? 1 : 0);
  if (P.isNumber(value) && Number.isInteger(value)) return O.some(value);
  return O.none();
};

const text = (value: unknown): O.Option<string> => (P.isString(value) && value.length > 0 ? O.some(value) : O.none());

/**
 * Returns whether admission proof is bound to the current content lineage.
 *
 * **Details**
 *
 * `promotion.processingReceipt` and `promotion.submission` must be objects.
 * The receipt version, processor id, and processor version must match the
 * module constants, and the promotion must repeat that same processor id and
 * version. The decision must be `durable_required`. The submission id must be
 * present and equal `sourceSubmissionId`. `inputHash` must equal the
 * submission `contentHash`. `outputHash` must be the SHA-256 hex of `content`
 * encoded as UTF-8. `inputItemRevision` and `outputItemRevision` must be
 * Python ints, the output must be the input plus one, and the output must be
 * less than or equal to `itemRevision`.
 *
 * **Gotchas**
 *
 * A boolean revision is a Python int. The function returns false for every
 * failure and does not say which clause failed. Property names are the
 * camelCase port of the stored receipt keys (`processing_receipt` becomes
 * `processingReceipt`).
 *
 * **Example** (Reject a promotion with no receipt)
 *
 * ```ts
 * import { validRequiredProcessingReceipt } from "@beep/scratchpad/beep/MemoryAdmission"
 *
 * console.log(validRequiredProcessingReceipt({ content: "Ada", itemRevision: 2, promotion: {} })) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const validRequiredProcessingReceipt = (input: {
  readonly content: string;
  readonly itemRevision: number;
  readonly promotion: Record<string, unknown>;
}): boolean => {
  const receipt = read(input.promotion, "processingReceipt");
  const submission = read(input.promotion, "submission");
  if (!isRecord(receipt) || !isRecord(submission)) return false;
  if (read(receipt, "receiptVersion") !== REQUIRED_PROCESSING_RECEIPT_VERSION) return false;
  if (read(receipt, "processorId") !== REQUIRED_PROCESSOR_ID) return false;
  if (read(receipt, "processorVersion") !== REQUIRED_PROCESSOR_VERSION) return false;
  if (read(input.promotion, "processorId") !== REQUIRED_PROCESSOR_ID) return false;
  if (read(input.promotion, "processorVersion") !== REQUIRED_PROCESSOR_VERSION) return false;
  if (read(receipt, "decision") !== "durable_required") return false;
  const submissionId = text(read(submission, "submissionId"));
  if (O.isNone(submissionId) || read(receipt, "sourceSubmissionId") !== submissionId.value) return false;
  if (read(receipt, "inputHash") !== read(submission, "contentHash")) return false;
  if (read(receipt, "outputHash") !== sha256Hex(input.content)) return false;
  const inputRevision = pythonInt(read(receipt, "inputItemRevision"));
  const outputRevision = pythonInt(read(receipt, "outputItemRevision"));
  if (O.isNone(inputRevision) || O.isNone(outputRevision)) return false;
  return inputRevision.value + 1 === outputRevision.value && outputRevision.value <= input.itemRevision;
};
