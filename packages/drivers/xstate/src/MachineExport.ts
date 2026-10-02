/**
 * Serializes xstate machines into the JSON document Stately Studio and the
 * Stately MCP server accept.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $XstateId } from "@beep/identity/packages";
import { Effect, pipe } from "effect";
import * as S from "effect/Schema";
import { serializeMachine } from "xstate";
import { MachineExportError } from "./Xstate.errors.ts";
import type { AnyStateMachine, MachineJSON } from "xstate";

const $I = $XstateId.create("MachineExport");

/**
 * Codec between a serialized machine value and its pretty-printed JSON text.
 *
 * **Example** (Encode a machine value)
 *
 * ```ts
 * import { MachineJsonText } from "@beep/xstate"
 * import * as S from "effect/Schema"
 *
 * console.log(S.encodeEffect(MachineJsonText)({ id: "toggle", states: {} }))
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const MachineJsonText = S.fromJsonString(S.Unknown, { space: 2 }).pipe(
  $I.annoteSchema("MachineJsonText", {
    description: "Pretty-printed JSON text of a serialized xstate machine definition.",
  })
);

/**
 * Serializes a machine into xstate's data form. Inline functions become
 * `@code` expressions and runtime-only values such as actor logic are omitted.
 *
 * **Example** (Serialize a machine)
 *
 * ```ts
 * import { toMachineJson } from "@beep/xstate"
 * import { createMachine } from "xstate"
 *
 * const machine = createMachine({ id: "toggle", initial: "off", states: { off: {}, on: {} } })
 * console.log(toMachineJson(machine).id) // "toggle"
 * ```
 *
 * @param machine - Machine to serialize.
 * @returns The machine's JSON-serializable definition.
 * @category combinators
 * @since 0.0.0
 */
export const toMachineJson = (machine: AnyStateMachine): MachineJSON => serializeMachine(machine);

/**
 * Serializes a machine into pretty-printed JSON text for Studio import,
 * `statelyai diff`, or the MCP `validate_machine` tool.
 *
 * **Example** (Export a machine as JSON text)
 *
 * ```ts
 * import { toMachineJsonText } from "@beep/xstate"
 * import { createMachine } from "xstate"
 *
 * const machine = createMachine({ id: "toggle", initial: "off", states: { off: {}, on: {} } })
 * console.log(toMachineJsonText(machine))
 * ```
 *
 * @param machine - Machine to serialize.
 * @returns JSON text, or {@link MachineExportError} when encoding fails.
 * @category combinators
 * @since 0.0.0
 */
export const toMachineJsonText = Effect.fn("MachineExport.toMachineJsonText")(function* (machine: AnyStateMachine) {
  return yield* pipe(
    S.encodeEffect(MachineJsonText)(toMachineJson(machine)),
    Effect.mapError((cause) =>
      MachineExportError.make({
        machineId: machine.id,
        message: "The serialized machine definition could not be encoded as JSON text.",
        cause,
      })
    )
  );
});
