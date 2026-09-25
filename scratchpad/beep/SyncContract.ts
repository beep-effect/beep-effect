/**
 * OpenAPI response contracts for the asynchronous local-file sync route.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as S from "effect/Schema";
import { Model, optionalText, pg, text } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/SyncContract");

/**
 * FastAPI validation payload for a rejected sync request.
 *
 * **Details**
 *
 * FastAPI's multipart/request validation shape for sync input failures.
 * `detail` is a list of error objects. The objects are open JSON records
 * because FastAPI's error dict is not a closed schema.
 *
 * **Example** (Decode a validation payload)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { SyncRequestValidationErrorResponse } from "@beep/scratchpad/beep/SyncContract"
 *
 * const error = Effect.runSync(
 *   S.decodeUnknownEffect(SyncRequestValidationErrorResponse)({
 *     detail: [{ loc: ["body"], msg: "field required", type: "missing" }],
 *   }),
 * )
 * console.log(error.detail.length) // 1
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SyncRequestValidationErrorResponse extends Model<SyncRequestValidationErrorResponse>(
  "SyncRequestValidationErrorResponse",
)(
  {
    detail: S.Array(S.JsonObject)
      .annotateKey({ description: "FastAPI validation errors for the sync request." })
      .pipe(pg.jsonb(), pg.columnName("detail")),
  },
  $I.annote("SyncRequestValidationErrorResponse", {
    description: "FastAPI multipart validation failure for a local-file sync request.",
  }),
) {}

/**
 * Encoded validation failure before decoding.
 *
 * @see {@link SyncRequestValidationErrorResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SyncRequestValidationErrorResponse {
  export type Encoded = S.Codec.Encoded<typeof SyncRequestValidationErrorResponse>;
}

/**
 * Refusal when automatic sync recovery is outside the allowed window.
 *
 * **Details**
 *
 * `code` stays an open string. `lane` is omitted when the refusal is not
 * tied to one sync lane.
 *
 * **Example** (Decode a window refusal)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as O from "effect/Option"
 * import * as S from "effect/Schema"
 * import { SyncRecoveryWindowExceededResponse } from "@beep/scratchpad/beep/SyncContract"
 *
 * const error = Effect.runSync(
 *   S.decodeUnknownEffect(SyncRecoveryWindowExceededResponse)({
 *     code: "recovery_window_exceeded",
 *     detail: "too old",
 *   }),
 * )
 * console.log(error.code) // "recovery_window_exceeded"
 * console.log(O.isNone(error.lane)) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class SyncRecoveryWindowExceededResponse extends Model<SyncRecoveryWindowExceededResponse>(
  "SyncRecoveryWindowExceededResponse",
)(
  {
    code: text("code"),
    detail: text("detail"),
    lane: optionalText("lane"),
  },
  $I.annote("SyncRecoveryWindowExceededResponse", {
    description: "Automatic local-file recovery was refused because the recovery window was exceeded.",
  }),
) {}

/**
 * Encoded recovery-window refusal before decoding.
 *
 * @see {@link SyncRecoveryWindowExceededResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SyncRecoveryWindowExceededResponse {
  export type Encoded = S.Codec.Encoded<typeof SyncRecoveryWindowExceededResponse>;
}

/**
 * Untagged 422 body for local-file sync v2.
 *
 * **Details**
 *
 * `SYNC_LOCAL_FILES_V2_RESPONSES[422]` is the untagged union
 * `SyncRecoveryWindowExceededResponse | SyncRequestValidationErrorResponse`.
 * The members do not share a discriminant. A string `detail` selects the
 * recovery refusal. An array `detail` selects the FastAPI validation shape.
 *
 * **Gotchas**
 *
 * This is not a shape-splitting tagged union. Adding a tag would change the
 * wire.
 *
 * **Example** (Decode both 422 shapes)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { SyncLocalFilesV2Response } from "@beep/scratchpad/beep/SyncContract"
 *
 * const recovery = Effect.runSync(
 *   S.decodeUnknownEffect(SyncLocalFilesV2Response)({ code: "window", detail: "too old" }),
 * )
 * const validation = Effect.runSync(
 *   S.decodeUnknownEffect(SyncLocalFilesV2Response)({ detail: [{ type: "missing" }] }),
 * )
 * console.log(recovery.code) // "window"
 * console.log(validation.detail.length) // 1
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SyncLocalFilesV2Response = S.Union([
  SyncRecoveryWindowExceededResponse,
  SyncRequestValidationErrorResponse,
]).pipe(
  $I.annoteSchema("SyncLocalFilesV2Response", {
    description: "Untagged 422 body: recovery window exceeded, or a malformed sync request.",
  }),
);

/**
 * Decoded local-file sync 422 body.
 *
 * @see {@link SyncLocalFilesV2Response} for the runtime union.
 * @category type-level
 * @since 0.0.0
 */
export type SyncLocalFilesV2Response = typeof SyncLocalFilesV2Response.Type;

/**
 * OpenAPI response map for local-file sync v2.
 *
 * **Details**
 *
 * Only status 422 is declared. The description is the Python constant's
 * description: automatic recovery window exceeded or malformed request.
 *
 * **Example** (Read the 422 description)
 *
 * ```ts
 * import { syncLocalFilesV2Responses } from "@beep/scratchpad/beep/SyncContract"
 *
 * console.log(syncLocalFilesV2Responses[422].description)
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const syncLocalFilesV2Responses = {
  422: {
    model: SyncLocalFilesV2Response,
    description: "Automatic recovery window exceeded or malformed request",
  },
};
