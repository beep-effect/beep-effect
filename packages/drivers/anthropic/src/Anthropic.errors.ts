/**
 * Typed technical errors raised by the Anthropic driver boundary.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AnthropicId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $AnthropicId.create("Anthropic.errors");

const RepairErrorFields = {
  message: S.NonEmptyString.annotateKey({
    description: "Non-empty diagnostic message describing the repair helper failure.",
  }),
  operation: S.NonEmptyString.annotateKey({
    description: "Repair helper operation that raised the failure.",
  }),
} satisfies S.Struct.Fields;
const sameRepairErrorFields = S.toEquivalence(S.TaggedStruct("RepairError", RepairErrorFields));
const sameRepairError = (self: RepairError, that: RepairError): boolean => sameRepairErrorFields(self, that);

/**
 * Recoverable technical failure raised while running an Anthropic repair helper.
 *
 * **Details**
 *
 * Provider, retry-plan, and configuration failures are normalized into this
 * tagged error so repair callers can handle one package-level error shape.
 *
 * **Example** (Creating a RepairError)
 *
 * ```ts
 * import { strictEqual } from "node:assert"
 * import { RepairError } from "@beep/anthropic"
 *
 * const error = RepairError.make({
 *   message: "repair call failed",
 *   operation: "generate_tool_json",
 * })
 *
 * strictEqual(error._tag, "RepairError")
 * strictEqual(error.operation, "generate_tool_json")
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class RepairError extends S.TaggedError<RepairError>($I`RepairError`)(
  "RepairError",
  RepairErrorFields,
  $I.annoteClass<S.declare<RepairError>, readonly [S.TaggedStruct<"RepairError", typeof RepairErrorFields>]>(
    "RepairError",
    {
      description: "Technical Anthropic driver failure raised while running repair helper calls.",
      toEquivalence: () => sameRepairError,
    }
  )
) {}
