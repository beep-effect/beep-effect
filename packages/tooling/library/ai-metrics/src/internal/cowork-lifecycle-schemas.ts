/** Host-local Cowork boundary models; no settings or native sessions are opened. */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import { Sha256Hex } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CursorLifecycleObserved, CursorLifecyclePolicy } from "./cursor-lifecycle-schemas.ts";

const $I = $RepoAiMetricsId.create("claude-cowork-lifecycle");
const Id = S.String.check(S.isMinLength(1), S.isMaxLength(256));
const Path = CursorLifecyclePolicy.fields.workspace;
const Callback = S.Struct({
  hook_event_name: S.Literals(["SessionStart", "SessionEnd"]),
  session_id: Id,
  source: S.optionalKey(S.Literals(["startup", "resume", "clear", "compact", "fork"])),
  reason: S.optionalKey(S.Literals(["clear", "resume", "logout", "prompt_input_exit", "other"])),
}).check(
  S.makeFilter(
    (value) =>
      value.hook_event_name === "SessionStart"
        ? value.source !== undefined && value.reason === undefined
        : value.reason !== undefined && value.source === undefined,
    { identifier: "CoworkCallbackStage", message: "Only the event-specific native lifecycle field is allowed" }
  )
);
const Envelope = S.Struct({
  occurrenceId: S.String.check(S.isPattern(/^[a-zA-Z0-9-]{16,128}$/)),
  selector: S.tag("local-agent"),
  callback: Callback,
});
const Observed = S.Struct({
  peer: S.Struct({ ...CursorLifecycleObserved.fields.peer.fields, appPid: S.Int, appStartTicks: Id }),
  callback: Envelope,
});
/** Receiver-owned enrollment of one host-local Cowork source; never callback authority.
 * **Example** (Inspect the inert API)
 * ```ts
 * import { CoworkLifecyclePolicy } from "@beep/repo-ai-metrics/claude-cowork-lifecycle"
 * console.log(typeof CoworkLifecyclePolicy.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CoworkLifecyclePolicy extends S.Opaque<CoworkLifecyclePolicy, { readonly brand: unique symbol }>()(
  S.Struct({
    ...CursorLifecyclePolicy.fields,
    approvedModels: S.Array(S.String).check(S.isMaxLength(0)),
    enrollmentId: Sha256Hex,
    socketPath: S.String.check(S.isPattern(/^\/[A-Za-z0-9_./-]{1,106}$/)),
    listenMillis: S.Int.check(S.isGreaterThanOrEqualTo(1000), S.isLessThanOrEqualTo(300000)).pipe(
      S.withConstructorDefault(Effect.succeed(30000))
    ),
    executionHost: S.tag("local"),
    surface: S.tag("cowork"),
    appExecutable: Path,
    appSha256: Sha256Hex,
    appPid: S.Int.check(S.isGreaterThan(1)),
    appStartTicks: Id,
  }).pipe(
    $I.annoteSchema("CoworkLifecyclePolicy", {
      description: "Private source/kernel enrollment; same-UID nonexclusive, VM/cloud unsupported.",
    })
  )
) {}
/** Private precompiled codecs; input extras are discarded before forwarding or persistence. */
export const CoworkLifecycleCodecs = {
  decodeCallback: S.decodeUnknownEffect(S.fromJsonString(Callback)),
  makeEnvelope: Envelope.make,
  encodeEnvelope: S.encodeEffect(S.fromJsonString(Envelope)),
  decodeObserved: S.decodeUnknownEffect(S.fromJsonString(Observed)),
};
