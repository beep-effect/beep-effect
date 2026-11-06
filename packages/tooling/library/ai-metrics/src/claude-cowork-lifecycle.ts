/** Passive host-local Cowork lifecycle bridge. Importing this module enables nothing.
 * @packageDocumentation
 * @since 0.0.0
 */
import { Sha256Hex } from "@beep/schema";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { CoworkLifecycleRuntime, makeCoworkLifecycleCore } from "./internal/cowork-lifecycle-core.ts";
import { CoworkLifecyclePolicy } from "./internal/cowork-lifecycle-schemas.ts";
import { CursorLifecycleSourceContract, failure } from "./internal/cursor-lifecycle-schemas.ts";

export { CoworkLifecyclePolicy } from "./internal/cowork-lifecycle-schemas.ts";
export { CursorLifecycleError as CoworkLifecycleError } from "./internal/cursor-lifecycle-schemas.ts";
export { CoworkLifecycleRuntime };

const nativeContract = CursorLifecycleSourceContract.make({
  pins: [
    {
      suffix: "/resources/app.asar",
      sha256: Sha256Hex.make("587829492e4a825480e7f01feed2462035b459615c1254252c1d83affe95ccc6"),
    },
    {
      suffix: "/2.1.317/cd557f900744/claude",
      sha256: Sha256Hex.make("eb224419e344575faa4a1f39b290b649425a10cd5ee2ef1d003480cd9ae57eb0"),
    },
  ],
});
const isPolicy = S.is(CoworkLifecyclePolicy);
/** Build a scoped receiver for a privately enrolled local Cowork source.
 * **Example** (Inspect the inert API)
 * ```ts
 * import { makeCoworkLifecycleReceiver } from "@beep/repo-ai-metrics/claude-cowork-lifecycle"
 * console.log(typeof makeCoworkLifecycleReceiver)
 * ```
 * @param policy - Receiver-owned app generation, root, route and public source pins.
 * @returns An inert receiver factory; no plugin installation or native launch.
 * @category services
 * @since 0.0.0
 */
export const makeCoworkLifecycleReceiver = Effect.fn("AiMetrics.coworkLifecycle.receiver")(function* (
  policy: CoworkLifecyclePolicy
) {
  if (
    !isPolicy(policy) ||
    policy.runtimeSha256 !== "eb224419e344575faa4a1f39b290b649425a10cd5ee2ef1d003480cd9ae57eb0" ||
    policy.appSha256 !== "ac20c2f43a7ad4cc49320575d6904a3c176e76d5bd4afa5a2a8863fdbd5b3e40"
  )
    return yield* failure("enrollment");
  return yield* makeCoworkLifecycleCore(policy, nativeContract);
});
