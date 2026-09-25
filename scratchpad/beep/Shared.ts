/**
 * Generic HTTP acknowledgements shared by routes that do not own a domain body.
 *
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity";
import * as SchemaUtils from "@beep/schema/SchemaUtils";
import * as S from "effect/Schema";
import { Model, pg } from "./Kit.ts";

const $I = $ScratchpadId.create("beep/Shared");

/**
 * Successful response that carries no body.
 *
 * **Details**
 *
 * 200 response with no body. Use for endpoints that return nothing meaningful.
 *
 * **Gotchas**
 *
 * A PostgreSQL model cannot have zero columns. `acknowledged` exists only so
 * the table can be created. It defaults to true on both construction and
 * decode, so `{}` still decodes. Python has no field.
 *
 * **Example** (Decode an empty body)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { EmptyResponse } from "@beep/scratchpad/beep/Shared"
 *
 * const body = Effect.runSync(S.decodeUnknownEffect(EmptyResponse)({}))
 * console.log(body instanceof EmptyResponse) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EmptyResponse extends Model<EmptyResponse>("EmptyResponse")(
  {
    acknowledged: SchemaUtils.withKeyDefaults(S.Boolean, true).pipe(pg.boolean(), pg.columnName("acknowledged")),
  },
  $I.annote("EmptyResponse", {
    description: "200 response with no body for endpoints that return nothing meaningful.",
  }),
) {}

/**
 * Encoded empty response before decoding.
 *
 * @see {@link EmptyResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace EmptyResponse {
  export type Encoded = S.Codec.Encoded<typeof EmptyResponse>;
}

/**
 * Canonical acknowledgement for status-only mutation routes.
 *
 * **Details**
 *
 * Canonical ack response for `{ status: string }` endpoints (deletes,
 * mutations, bulk ops). Prefer this over a hand-built `{ status: "ok" }`
 * record. Domain-specific status responses may stay in their domain module,
 * but generic acks should use this.
 *
 * **Example** (Decode an ok acknowledgement)
 *
 * ```ts
 * import * as Effect from "effect/Effect"
 * import * as S from "effect/Schema"
 * import { StatusResponse } from "@beep/scratchpad/beep/Shared"
 *
 * const ack = Effect.runSync(S.decodeUnknownEffect(StatusResponse)({ status: "ok" }))
 * console.log(ack.status) // "ok"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StatusResponse extends Model<StatusResponse>("StatusResponse")(
  {
    status: S.String.annotateKey({ description: 'Human-readable status message, e.g. "ok".' }).pipe(
      pg.text(),
      pg.columnName("status"),
    ),
  },
  $I.annote("StatusResponse", {
    description: "Generic status acknowledgement for deletes, mutations, and bulk operations.",
  }),
) {}

/**
 * Encoded status acknowledgement before decoding.
 *
 * @see {@link StatusResponse} for the runtime model.
 * @category type-level
 * @since 0.0.0
 */
export declare namespace StatusResponse {
  export type Encoded = S.Codec.Encoded<typeof StatusResponse>;
}
