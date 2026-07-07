/**
 * Helpers for schema-backed server-sent event envelopes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $UtilsId } from "@beep/identity/packages";
import { dual } from "effect/Function";
import type { TString } from "@beep/types";

/**
 * Re-export of the Effect SSE encoder/decoder primitives.
 *
 * @example
 * ```ts
 * import * as Sse from "@beep/utils/Event"
 *
 * console.log(Sse)
 * ```
 *
 * @category codecs
 * @since 0.0.0
 */
export * from "effect/unstable/encoding/Sse";

import * as S from "effect/Schema";

const $I = $UtilsId.create("Event");

type EventShape<TTag extends TString.NonEmpty, TFields extends S.Struct.Fields> = {
  readonly kind: "Event";
  readonly _tag: TTag;
  readonly payload: S.Struct<TFields>["Type"];
};

/**
 * Builds a typed server-sent event envelope schema.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { makeEvent } from "@beep/utils/Event"
 *
 * const Progress = makeEvent({ percent: S.Finite }, "Progress")
 * const decoded = S.decodeUnknownSync(Progress)({
 *   kind: "Event",
 *   _tag: "Progress",
 *   payload: { percent: 50 },
 * })
 * console.log(decoded)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
const makeEventSchema = <TTag extends TString.NonEmpty, TFields extends S.Struct.Fields>(payload: TFields, tag: TTag) =>
  S.Class<EventShape<TTag, TFields>>($I`Event`)(
    {
      kind: S.tag("Event").annotateKey({
        description: "Envelope family discriminator for server-sent events.",
      }),
      _tag: S.tag(tag).annotateKey({
        description: "Caller-provided event variant discriminator.",
      }),
      payload: S.Struct({ ...payload }).annotateKey({
        description: "Caller-provided event payload fields.",
      }),
    },
    $I.annote("Event", {
      description: "A typed server-sent event envelope.",
    })
  );

type MakeEventSchema<TTag extends TString.NonEmpty, TFields extends S.Struct.Fields> = ReturnType<
  typeof makeEventSchema<TTag, TFields>
>;

/**
 * Creates a typed server-sent event schema.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { makeEvent } from "@beep/utils/Event"
 *
 * const Progress = makeEvent({ percent: S.Finite })("Progress")
 * const event = new Progress({ payload: { percent: 100 } })
 * console.log(event)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export const makeEvent: {
  <TTag extends TString.NonEmpty, TFields extends S.Struct.Fields>(
    payload: TFields,
    tag: TTag
  ): MakeEventSchema<TTag, TFields>;
  <TFields extends S.Struct.Fields>(
    payload: TFields
  ): <TTag extends TString.NonEmpty>(tag: TTag) => MakeEventSchema<TTag, TFields>;
} = dual(2, makeEventSchema);
