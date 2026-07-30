/**
 * Schema-first HttpApi contract for the witness event collector.
 *
 * The `/events` payload is `text/plain` NDJSON — a CORS-safelisted content
 * type, so witness batches never trigger a preflight. Lines are decoded
 * per-event server-side; rejects are counted, never fatal.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $QaCaptureId } from "@beep/identity/packages";
import * as S from "effect/Schema";
import { HttpApi, HttpApiEndpoint, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";
import { SequenceNumber } from "./ActionEvent.models.ts";
import { RoundNumber, SessionId } from "./QaCapture.models.ts";

const $I = $QaCaptureId.create("Collector.api");

const NonNegativeCount = S.Int.check(
  S.isGreaterThanOrEqualTo(0, {
    identifier: $I`NonNegativeCountMinimumCheck`,
    title: "Non Negative Count Minimum",
    description: "Counters are zero or greater.",
    message: "Expected a non-negative count",
  })
);

/**
 * Collector health snapshot returned by `GET /health`.
 *
 * @example
 * ```ts
 * import { CollectorHealth } from "@beep/qa-capture"
 *
 * const health = CollectorHealth.make({
 *   eventsWritten: 12,
 *   rejected: 0,
 *   round: 1,
 *   sessionId: "qa-2026-07-30-091500",
 *   status: "ok"
 * })
 * console.log(health.eventsWritten)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CollectorHealth extends S.Class<CollectorHealth>($I`CollectorHealth`)(
  {
    eventsWritten: NonNegativeCount.pipe(
      $I.annoteKey("CollectorHealth.eventsWritten", {
        description: "Events accepted and appended so far.",
      })
    ),
    rejected: NonNegativeCount.pipe(
      $I.annoteKey("CollectorHealth.rejected", {
        description: "NDJSON lines rejected by schema decoding so far.",
      })
    ),
    round: RoundNumber.pipe(
      $I.annoteKey("CollectorHealth.round", {
        description: "QA round number being recorded.",
      })
    ),
    sessionId: SessionId.pipe(
      $I.annoteKey("CollectorHealth.sessionId", {
        description: "Capture session identifier.",
      })
    ),
    status: S.tag("ok").pipe(
      $I.annoteKey("CollectorHealth.status", {
        description: "Health discriminator; a responding collector is ok.",
      })
    ),
  },
  $I.annote("CollectorHealth", {
    description: "Collector health snapshot returned by GET /health.",
  })
) {}

/**
 * Batch acknowledgement returned by `POST /events`.
 *
 * @example
 * ```ts
 * import { EventsAccepted } from "@beep/qa-capture"
 *
 * const accepted = EventsAccepted.make({ accepted: 12, rejected: 1 })
 * console.log(accepted)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class EventsAccepted extends S.Class<EventsAccepted>($I`EventsAccepted`)(
  {
    accepted: NonNegativeCount.pipe(
      $I.annoteKey("EventsAccepted.accepted", {
        description: "Lines decoded and enqueued from this batch.",
      })
    ),
    rejected: NonNegativeCount.pipe(
      $I.annoteKey("EventsAccepted.rejected", {
        description: "Lines rejected by schema decoding from this batch.",
      })
    ),
  },
  $I.annote("EventsAccepted", {
    description: "Batch acknowledgement returned by POST /events.",
  })
) {}

/**
 * Marker request accepted by `POST /mark`.
 *
 * @example
 * ```ts
 * import { MarkRequest } from "@beep/qa-capture"
 *
 * const request = MarkRequest.make({ label: "scenario:sash-drag/start" })
 * console.log(request.label)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MarkRequest extends S.Class<MarkRequest>($I`MarkRequest`)(
  {
    label: S.String.check(
      S.isMinLength(1, {
        identifier: $I`MarkRequestLabelNonEmptyCheck`,
        title: "Mark Request Label Non Empty",
        description: "Marker labels must not be empty.",
        message: "Expected a non-empty marker label",
      })
    ).pipe(
      $I.annoteKey("MarkRequest.label", {
        description: "Semantic marker label to append to the event log.",
      })
    ),
  },
  $I.annote("MarkRequest", {
    description: "Marker request accepted by POST /mark.",
  })
) {}

/**
 * Marker acknowledgement returned by `POST /mark`.
 *
 * @example
 * ```ts
 * import { MarkAccepted } from "@beep/qa-capture"
 *
 * const accepted = MarkAccepted.make({ seq: 1000000 })
 * console.log(accepted.seq)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class MarkAccepted extends S.Class<MarkAccepted>($I`MarkAccepted`)(
  {
    seq: SequenceNumber.pipe(
      $I.annoteKey("MarkAccepted.seq", {
        description: "Server-allocated sequence number of the appended marker.",
      })
    ),
  },
  $I.annote("MarkAccepted", {
    description: "Marker acknowledgement returned by POST /mark.",
  })
) {}

/**
 * Stop acknowledgement returned by `POST /stop`.
 *
 * @example
 * ```ts
 * import { StopAccepted } from "@beep/qa-capture"
 *
 * const accepted = StopAccepted.make({ status: "stopping" })
 * console.log(accepted.status)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class StopAccepted extends S.Class<StopAccepted>($I`StopAccepted`)(
  {
    status: S.tag("stopping").pipe(
      $I.annoteKey("StopAccepted.status", {
        description: "Stop discriminator; the collector completes its stop deferred.",
      })
    ),
  },
  $I.annote("StopAccepted", {
    description: "Stop acknowledgement returned by POST /stop.",
  })
) {}

/**
 * `text/plain` NDJSON payload accepted by `POST /events`.
 *
 * @example
 * ```ts
 * import { NdjsonPayload } from "@beep/qa-capture"
 * import * as S from "effect/Schema"
 *
 * const effect = S.decodeUnknownEffect(NdjsonPayload)("{\"kind\":\"marker\"}")
 * console.log(effect)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NdjsonPayload = S.String.pipe(
  HttpApiSchema.asText(),
  $I.annoteSchema("NdjsonPayload", {
    description: "text/plain NDJSON payload accepted by POST /events.",
  })
);

/**
 * `text/plain` NDJSON payload accepted by `POST /events`.
 *
 * @example
 * ```ts
 * import type { NdjsonPayload } from "@beep/qa-capture"
 *
 * const body: NdjsonPayload = "{\"kind\":\"marker\"}"
 * console.log(body)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type NdjsonPayload = typeof NdjsonPayload.Type;

/**
 * JavaScript response body served by `GET /witness.js`.
 *
 * @example
 * ```ts
 * import { WitnessScriptBody } from "@beep/qa-capture"
 * import * as S from "effect/Schema"
 *
 * const effect = S.decodeUnknownEffect(WitnessScriptBody)("(()=>{})();")
 * console.log(effect)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const WitnessScriptBody = S.String.pipe(
  HttpApiSchema.asText({ contentType: "text/javascript" }),
  $I.annoteSchema("WitnessScriptBody", {
    description: "JavaScript response body served by GET /witness.js.",
  })
);

/**
 * JavaScript response body served by `GET /witness.js`.
 *
 * @example
 * ```ts
 * import type { WitnessScriptBody } from "@beep/qa-capture"
 *
 * const body: WitnessScriptBody = "(()=>{})();"
 * console.log(body)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type WitnessScriptBody = typeof WitnessScriptBody.Type;

/**
 * The collector endpoint group: health, witness.js, events, mark, stop.
 *
 * @example
 * ```ts
 * import { QaCollectorApiGroup } from "@beep/qa-capture"
 *
 * console.log(QaCollectorApiGroup.identifier)
 * ```
 *
 * @category api
 * @since 0.0.0
 */
export const QaCollectorApiGroup = HttpApiGroup.make("collector")
  .add(HttpApiEndpoint.get("health", "/health", { success: CollectorHealth }))
  .add(HttpApiEndpoint.get("witnessJs", "/witness.js", { success: WitnessScriptBody }))
  .add(HttpApiEndpoint.post("events", "/events", { payload: NdjsonPayload, success: EventsAccepted }))
  .add(HttpApiEndpoint.post("mark", "/mark", { payload: MarkRequest, success: MarkAccepted }))
  .add(HttpApiEndpoint.post("stop", "/stop", { success: StopAccepted }));

/**
 * The witness event collector HttpApi.
 *
 * @example
 * ```ts
 * import { QaCollectorApi } from "@beep/qa-capture"
 *
 * console.log(QaCollectorApi.identifier)
 * ```
 *
 * @category api
 * @since 0.0.0
 */
export const QaCollectorApi = HttpApi.make("QaCollectorApi").add(QaCollectorApiGroup);
