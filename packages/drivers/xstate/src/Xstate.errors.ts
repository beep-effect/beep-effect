/**
 * Typed failures raised by the xstate driver.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $XstateId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $XstateId.create("Xstate.errors");

/**
 * Stately inspector operations that can raise a driver failure.
 *
 * **Example** (Inspect the operation vocabulary)
 *
 * ```ts
 * import { StatelyInspectorOperation } from "@beep/xstate"
 *
 * console.log(StatelyInspectorOperation.literals) // ["connect", "attach"]
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const StatelyInspectorOperation = LiteralKit(["connect", "attach"]).pipe(
  $I.annoteSchema("StatelyInspectorOperation", {
    description: "Stately inspector operation that raised a driver failure.",
  })
);

/**
 * Runtime type decoded by {@link StatelyInspectorOperation}.
 *
 * @category models
 * @since 0.0.0
 */
export type StatelyInspectorOperation = typeof StatelyInspectorOperation.Type;

/**
 * Failure raised while connecting to, or attaching an actor to, the Stately inspector relay.
 *
 * **Example** (Construct an inspector failure)
 *
 * ```ts
 * import { StatelyInspectorError } from "@beep/xstate"
 *
 * const error = new StatelyInspectorError({
 *   operation: "connect",
 *   message: "Relay unavailable",
 *   cause: "offline",
 * })
 * console.log(error._tag) // "StatelyInspectorError"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class StatelyInspectorError extends S.TaggedError<StatelyInspectorError>($I`StatelyInspectorError`)(
  "StatelyInspectorError",
  {
    operation: StatelyInspectorOperation,
    message: S.String,
    cause: S.Defect({ includeStack: true }),
  },
  $I.annote("StatelyInspectorError", {
    description: "Stately inspector relay registration or actor attachment failed.",
  })
) {}

/**
 * Failure raised when a machine definition cannot be encoded as JSON text.
 *
 * **Example** (Construct an export failure)
 *
 * ```ts
 * import { MachineExportError } from "@beep/xstate"
 *
 * const error = new MachineExportError({
 *   machineId: "approval",
 *   message: "Machine JSON could not be encoded",
 *   cause: "cycle",
 * })
 * console.log(error.machineId) // "approval"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class MachineExportError extends S.TaggedError<MachineExportError>($I`MachineExportError`)(
  "MachineExportError",
  {
    machineId: S.String,
    message: S.String,
    cause: S.Defect({ includeStack: true }),
  },
  $I.annote("MachineExportError", {
    description: "A serialized machine definition could not be encoded as JSON text.",
  })
) {}
