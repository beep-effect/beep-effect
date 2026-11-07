/** Private schemas shared by the fixed receiver and source-only test port. */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import * as S from "effect/Schema";

const $I = $RepoAiMetricsId.create("cursor-lifecycle");
const Path = S.String.check(S.isPattern(/^\/[\x20-\x7e]{1,1023}$/));
const Id = S.String.check(S.isMinLength(1), S.isMaxLength(256));
const PublicId = S.String.check(S.isPattern(/^[a-zA-Z0-9][a-zA-Z0-9_.:/-]{0,127}$/));
const Reason = S.Literals(["completed", "aborted", "error", "window_close", "user_close"]);
const Callback = S.Struct({
  hook_event_name: S.Literals(["sessionStart", "sessionEnd"]),
  cursor_version: S.tag("2026.11.05-86047df"),
  session_id: Id,
  conversation_id: Id,
  generation_id: S.optionalKey(Id),
  is_background_agent: S.tag(false),
  reason: S.optionalKey(Reason),
  final_status: S.optionalKey(Reason),
  duration_ms: S.optionalKey(S.Natural.check(S.isLessThanOrEqualTo(Number.MAX_SAFE_INTEGER))),
  model: S.optionalKey(PublicId),
  model_id: S.optionalKey(PublicId),
  model_params: S.optionalKey(S.Array(S.Struct({ id: PublicId, value: PublicId })).check(S.isMaxLength(16))),
}).check(
  S.makeFilter(
    (v) =>
      v.session_id === v.conversation_id &&
      (v.hook_event_name === "sessionEnd"
        ? v.reason !== undefined && v.duration_ms !== undefined
        : v.reason === undefined && v.duration_ms === undefined && v.final_status === undefined),
    { identifier: "CursorLifecycleShape", message: "Native lifecycle identity and kind must agree" }
  )
);
const decodeCallback = S.decodeUnknownEffect(S.fromJsonString(Callback));
const encodeCallback = S.encodeEffect(S.fromJsonString(Callback));
const Acknowledgement = S.Struct({ receiptId: Sha256Hex, accepted: S.Natural, rejected: S.Natural });
const decodeAcknowledgement = S.decodeUnknownEffect(S.fromJsonString(Acknowledgement));
const Kernel = S.Struct({
  peerPid: S.Int,
  peerStartTicks: Id,
  runtimePid: S.Int,
  runtimeStartTicks: Id,
  runtimeSha256: Sha256Hex,
  cwd: Path,
  uid: S.Natural,
});
const JsonValue = S.fromJsonString(S.Unknown);
const encodeJsonValue = S.encodeUnknownEffect(JsonValue);
const decodeReady = S.decodeUnknownEffect(S.fromJsonString(S.Struct({ ready: S.tag(true) })));
/** Transient kernel observation and projected native envelope. */
export class CursorLifecycleObserved extends S.Opaque<CursorLifecycleObserved, { readonly brand: unique symbol }>()(
  S.Struct({ peer: Kernel, callback: Callback }).pipe(
    $I.annoteSchema("CursorLifecycleObserved", {
      description: "Transient receiver observation; not a caller attestation.",
    })
  )
) {}
const decodeObserved = S.decodeUnknownEffect(S.fromJsonString(CursorLifecycleObserved));

/** Receiver-owned enrollment; never decoded from the callback or OTLP attributes.
 * **Example** (Inspect receiver configuration)
 * ```ts
 * import { CursorLifecyclePolicy } from "@beep/repo-ai-metrics/cursor-lifecycle"
 * console.log(typeof CursorLifecyclePolicy.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CursorLifecyclePolicy extends S.Opaque<CursorLifecyclePolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    workspace: Path,
    runtimeExecutable: Path,
    runtimeSha256: Sha256Hex,
    sourcePins: S.Array(S.Struct({ path: Path, sha256: Sha256Hex })).check(S.isMinLength(2), S.isMaxLength(8)),
    helperSha256: Sha256Hex,
    pythonExecutable: Path,
    pythonSha256: Sha256Hex,
    rootId: Sha256Hex,
    hostId: Sha256Hex,
    routeId: Sha256Hex,
    hashSalt: S.Redacted(S.String.check(S.isMinLength(16))),
    approvedModels: S.Array(PublicId).check(S.isMaxLength(32)),
  }).pipe(
    $I.annoteSchema("CursorLifecyclePolicy", {
      description: "Private receiver enrollment of public source pins, canonical runtime/root and salted namespace.",
    })
  )
) {}

/** Finite content-free refusal; native auth and inference remain unknown.
 * **Example** (Inspect a refusal)
 * ```ts
 * import { CursorLifecycleError } from "@beep/repo-ai-metrics/cursor-lifecycle"
 * console.log(CursorLifecycleError.make({ reason: "callback" }).reason)
 * ```
 * @category errors
 * @since 0.0.0
 */
export class CursorLifecycleError extends S.TaggedError<CursorLifecycleError, { readonly brand: unique symbol }>(
  $I`CursorLifecycleError`
)(
  "CursorLifecycleError",
  { reason: S.Literals(["enrollment", "kernel-binding", "callback", "transport"]) },
  $I.annote("CursorLifecycleError", { description: "Payload-free passive lifecycle refusal." })
) {}
export const isLifecycleError = S.is(CursorLifecycleError);
export const failure = (reason: CursorLifecycleError["reason"]) => CursorLifecycleError.make({ reason });

/** Closed public-file identity contract supplied by installed code. */
export class CursorLifecycleSourceContract extends S.Opaque<
  CursorLifecycleSourceContract,
  { readonly brand: unique symbol }
>()(
  S.Struct({
    pins: S.Array(S.Struct({ suffix: Path, sha256: Sha256Hex })).check(S.isMinLength(2), S.isMaxLength(2)),
  }).pipe(
    $I.annoteSchema("CursorLifecycleSourceContract", {
      description: "Exactly two public source suffix/SHA-256 identities; production supplies fixed native pins.",
    })
  )
) {}

/** Precompiled private boundary codecs. */
export const CursorLifecycleCodecs = {
  decodeCallback,
  encodeCallback,
  decodeAcknowledgement,
  encodeJsonValue,
  decodeReady,
  decodeObserved,
};

/** Known public effort labels; absence or other native values stay unknown. */
export const CursorReportedEffort = LiteralKit(["low", "medium", "high", "xhigh"]).pipe(
  $I.annoteSchema("CursorReportedEffort", { description: "Finite native-reported effort values, not inference proof." })
);
export const isCursorReportedEffort = S.is(CursorReportedEffort);
