/**
 * Bounded local evidence windows and cumulative retirement accounting.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { hashPublicTextSha256 } from "./privacy.ts";

const $I = $RepoAiMetricsId.create("evidence-window");
const count = S.Int.check(S.isBetween({ minimum: 0, maximum: Number.MAX_SAFE_INTEGER }));
/**
 * Cumulative observation counts, explicitly scoped to retired local windows.
 * **Example** (Inspecting totals)
 * ```ts
 * import { RetiredEvidenceTotals } from "@beep/repo-ai-metrics/evidence-window"
 * console.log(typeof RetiredEvidenceTotals.make)
 * ```
 * **Details** An event may recur in another window. These counts are not lifetime unique events or fleet coverage. Native accepted occurrences include duplicates; transcript frame occurrences include non-accepted frames. State populations refer only to canonical enrolled event observations.
 * @category models
 * @since 0.0.0
 */
export class RetiredEvidenceTotals extends S.Opaque<RetiredEvidenceTotals, { readonly brand: unique symbol }>()(
  S.Struct({
    pages: count,
    payloadBytes: count,
    nativeAcceptedOccurrences: count,
    nativeRejectedOccurrences: count,
    transcriptFrameOccurrences: count,
    eventObservations: count,
    attempts: count,
    pending: count,
    acceptedUnverified: count,
    visible: count,
    rejected: count,
    unresolved: count,
    verifiedPages: count,
    expiredPages: count,
    unenrolledReferences: S.optionalKey(count),
    unenrolledNativeEvents: S.optionalKey(count),
    launchPreparations: S.optionalKey(count),
    launchStarts: S.optionalKey(count),
    launchSessionBindings: S.optionalKey(count),
    launchFinishes: S.optionalKey(count),
    launchPayloadBytes: S.optionalKey(count),
  })
    .check(
      S.makeFilter(
        (v) =>
          v.eventObservations === v.pending + v.acceptedUnverified + v.visible + v.rejected + v.unresolved &&
          v.pages === v.verifiedPages + v.expiredPages,
        {
          identifier: "RetiredPopulation",
          message: "Retired state and page populations must reconcile",
        }
      )
    )
    .pipe($I.annoteSchema("RetiredEvidenceTotals", { description: "Bounded counters of retired window observations." }))
) {}
/**
 * Content-free summary of the latest retired observation window.
 * **Example** (Inspecting a retirement record)
 * ```ts
 * import { EvidenceRetirement } from "@beep/repo-ai-metrics/evidence-window"
 * console.log(typeof EvidenceRetirement.make)
 * ```
 * **Details** previousDigest links the preceding summary; it does not make missing historical detail reconstructible. Counts preserve uncertainty at retirement, without promoting delivery. Times describe local evidence retention, not source-event time.
 * @category models
 * @since 0.0.0
 */
export class EvidenceRetirement extends S.Opaque<EvidenceRetirement, { readonly brand: unique symbol }>()(
  S.Struct({
    epoch: count,
    openedAt: count,
    closedAt: count,
    totals: RetiredEvidenceTotals,
    previousDigest: S.OptionFromOptionalKey(Sha256Hex),
  }).pipe($I.annoteSchema("EvidenceRetirement", { description: "Latest retired window and aggregate uncertainty." }))
) {}
/**
 * Current duplicate-detection scope and bounded historical accounting.
 * **Example** (Inspecting the window)
 * ```ts
 * import { EvidenceWindow } from "@beep/repo-ai-metrics/evidence-window"
 * console.log(typeof EvidenceWindow.make)
 * ```
 * **Details** Detailed receipts and canonical hashes exist only within the current epoch. Earlier evidence is retired, not known absent. Source cursors survive retirement. A native event can be observed again in a later epoch, with its source identity unchanged.
 * @category models
 * @since 0.0.0
 */
export class EvidenceWindow extends S.Opaque<EvidenceWindow, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("evidence-window/v1"),
    epoch: count,
    openedAt: count,
    totals: RetiredEvidenceTotals,
    latest: S.OptionFromOptionalKey(S.Struct({ record: EvidenceRetirement, digest: Sha256Hex })),
  })
    .check(
      S.makeFilter((v) => (O.isSome(v.latest) ? v.epoch === v.latest.value.record.epoch + 1 : v.epoch === 0), {
        identifier: "EvidenceEpochContinuity",
        message: "Current epoch must follow the latest retirement",
      })
    )
    .pipe(
      $I.annoteSchema("EvidenceWindow", {
        description: "Current local evidence epoch and cumulative retired observations.",
      })
    )
) {}
const decodeArguments = S.decodeUnknownEffect(S.Tuple([S.Struct({ payload: S.String, digest: Sha256Hex })]));
const decodeEvidenceWindowJson = S.decodeEffect(S.fromJsonString(EvidenceWindow), { onExcessProperty: "error" });
const encodeEvidenceRetirementJson = S.encodeEffect(S.fromJsonString(EvidenceRetirement));

/**
 * Read and checksum-verify the owned bounded evidence window.
 * **Example** (Inspecting the reader)
 * ```ts
 * import { readEvidenceWindow } from "@beep/repo-ai-metrics/evidence-window"
 * console.log(typeof readEvidenceWindow)
 * ```
 * **Details** The intake factory initializes the table. Callers map SQL/schema failures to their safe domain error. No raw identifiers or source content are returned.
 * @category utilities
 * @since 0.0.0
 */
export const readEvidenceWindow = Effect.fn("AiMetrics.readEvidenceWindow")(function* () {
  const sql = yield* SqlClient.SqlClient;
  const rows =
    yield* sql`SELECT substr(payload,1,8193) AS payload,digest FROM observation_evidence_window WHERE singleton=1`.pipe(
      Effect.flatMap(decodeArguments)
    );
  if ((yield* hashPublicTextSha256(rows[0].payload)) !== rows[0].digest) return yield* Effect.fail("evidence-checksum");
  const window = yield* decodeEvidenceWindowJson(rows[0].payload);
  if (O.isSome(window.latest)) {
    const payload = yield* encodeEvidenceRetirementJson(window.latest.value.record);
    if ((yield* hashPublicTextSha256(payload)) !== window.latest.value.digest)
      return yield* Effect.fail("retirement-checksum");
  }
  return window;
});
