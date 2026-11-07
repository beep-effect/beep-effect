/** Positive content-free lifecycle metadata, minted by a receiver-owned bridge.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as O from "effect/Option";
import * as S from "effect/Schema";

const $I = $RepoAiMetricsId.create("native-lifecycle");
const PublicId = S.String.check(S.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,127}$/));

/** A native session occurrence, not a model request or successful turn.
 * **Details** Native absolute time is unknown. Export uses the first durable
 * intake's observer-clock point; reported duration remains a separate value.
 * Source assurance is deliberately same-UID and nonexclusive.
 * **Example** (Inspect the metadata constructor)
 * ```ts
 * import { NativeLifecycleMetadata } from "@beep/repo-ai-metrics/native-lifecycle"
 * console.log(typeof NativeLifecycleMetadata.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class NativeLifecycleMetadata extends S.Opaque<NativeLifecycleMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("native-lifecycle/v1"),
    harness: S.tag("cursor"),
    surface: S.tag("cli"),
    sourceVersion: S.tag("2026.11.05-86047df"),
    kind: S.Literals(["sessionStart", "sessionEnd"]),
    sessionHash: Sha256Hex,
    generationHash: S.OptionFromOptionalKey(Sha256Hex),
    runtimeInstanceId: Sha256Hex,
    rootId: Sha256Hex,
    hostId: Sha256Hex,
    assurance: S.tag("native-hook-kernel-observed-same-uid-nonexclusive"),
    sourceTimestamp: S.tag("Unknown"),
    observerClock: S.tag("first-durable-intake"),
    reportedDurationMillis: S.OptionFromOptionalKey(S.Natural.check(S.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER))),
    reportedReason: S.OptionFromOptionalKey(
      S.Literals(["completed", "aborted", "error", "window_close", "user_close"])
    ),
    reportedStatus: S.OptionFromOptionalKey(
      S.Literals(["completed", "aborted", "error", "window_close", "user_close"])
    ),
    reportedModelId: S.OptionFromOptionalKey(PublicId),
    reportedEffort: S.OptionFromOptionalKey(S.Literals(["low", "medium", "high", "xhigh"])),
  })
    .check(
      S.makeFilter(
        (value) =>
          value.kind === "sessionEnd" ||
          (O.isNone(value.reportedDurationMillis) && O.isNone(value.reportedReason) && O.isNone(value.reportedStatus)),
        { identifier: "LifecycleReportedFields", message: "Start callbacks cannot assert end fields" }
      )
    )
    .pipe(
      $I.annoteSchema("NativeLifecycleMetadata", {
        description:
          "Receiver-minted native lifecycle metadata; never a caller attestation, model call or usage estimate.",
      })
    )
) {}

/** Receiver-minted host-local Cowork occurrence; ordinary chat and Code are separate.
 * **Example** (Inspect the inert API)
 * ```ts
 * import { ClaudeCoworkLifecycleMetadata } from "@beep/repo-ai-metrics/native-lifecycle"
 * console.log(typeof ClaudeCoworkLifecycleMetadata.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ClaudeCoworkLifecycleMetadata extends S.Opaque<
  ClaudeCoworkLifecycleMetadata,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    ...NativeLifecycleMetadata.fields,
    harness: S.tag("claude-desktop"),
    surface: S.tag("cowork"),
    sourceVersion: S.tag("4.23118.0/2.1.317"),
    engineBinding: S.tag("kernel-executable-sha256"),
    appScriptBinding: S.tag("Unproved"),
    callbackScriptBinding: S.tag("Unproved"),
    occurrenceHash: Sha256Hex,
    enrollmentId: Sha256Hex,
    reportedSource: S.OptionFromOptionalKey(S.Literals(["startup", "resume", "clear", "compact", "fork"])),
    reportedReason: S.OptionFromOptionalKey(S.Literals(["clear", "resume", "logout", "prompt_input_exit", "other"])),
  })
    .check(
      S.makeFilter(
        (value) =>
          O.isNone(value.reportedDurationMillis) &&
          O.isNone(value.reportedStatus) &&
          O.isNone(value.reportedModelId) &&
          O.isNone(value.reportedEffort) &&
          O.isNone(value.generationHash) &&
          (value.kind === "sessionStart"
            ? O.isSome(value.reportedSource) && O.isNone(value.reportedReason)
            : O.isNone(value.reportedSource) && O.isSome(value.reportedReason)),
        { identifier: "CoworkLifecycleShape", message: "Cowork reports only its event-specific native lifecycle field" }
      )
    )
    .pipe(
      $I.annoteSchema("ClaudeCoworkLifecycleMetadata", {
        description: "Host-local Cowork source evidence with unknown usage/time and same-UID nonexclusive assurance.",
      })
    )
) {}
/** Disjoint native source variants; existing Cursor wire values are preserved.
 * **Example** (Inspect the inert API)
 * ```ts
 * import { NativeLifecycleObservation } from "@beep/repo-ai-metrics/native-lifecycle"
 * console.log(typeof NativeLifecycleObservation)
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const NativeLifecycleObservation = S.Union([NativeLifecycleMetadata, ClaudeCoworkLifecycleMetadata]).pipe(
  S.toTaggedUnion("harness"),
  $I.annoteSchema("NativeLifecycleObservation", {
    description: "Cursor CLI or host-local Claude Cowork lifecycle; never ordinary chat.",
  })
);
/** Decoded native lifecycle source variant.
 * @category types
 * @since 0.0.0
 */
export type NativeLifecycleObservation = typeof NativeLifecycleObservation.Type;
