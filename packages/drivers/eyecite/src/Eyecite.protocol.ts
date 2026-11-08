/**
 * Typed Effect RPC procedure for an isolated pinned recognizer.
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import { EyeciteFailure, EyeciteRecognizeInput, EyeciteRecognizeOutput } from "./Eyecite.models.ts";
/** Recognition protocol; process ownership and deadlines belong to the caller.
 * **Example** (Inspect the recognition contract)
 * ```ts
 * import { EyeciteRpcs } from "@beep/eyecite/protocol"
 * console.log(EyeciteRpcs.requests.has("Recognize")) // true
 * ```
 * @category services
 * @since 0.0.0
 */
export const EyeciteRpcs = RpcGroup.make(
  Rpc.make("Recognize", {
    payload: EyeciteRecognizeInput,
    success: EyeciteRecognizeOutput,
    error: EyeciteFailure,
  })
);
