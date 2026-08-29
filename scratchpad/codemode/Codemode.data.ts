/**
 * Dependency-neutral CodeMode boundary data schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $ScratchpadId.create("codemode/Codemode.data");

/** A JSON value that can cross the confined interpreter boundary. */
export const DataValue = S.Json.pipe(
  $I.annoteSchema("DataValue", {
    description: "A JSON value returned across the CodeMode execution boundary.",
  })
);

/** Runtime type for {@link DataValue}. */
export type DataValue = typeof DataValue.Type;
