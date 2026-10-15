/**
 * The Microsoft 365 provider: the read-only Graph tools of `@beep/m365-mcp`,
 * mounted once the lawyer has signed in through the gateway.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { M365, M365Error } from "@beep/m365";
import { M365ConfigInput } from "@beep/m365/M365.config";
import { M365McpRegistrationsLive } from "@beep/m365-mcp/Server";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as O from "effect/Option";
import { M365SignIn } from "./M365SignIn.ts";
import { ProfileStore } from "./ProfileStore.ts";
import { profileSelects } from "./Requirements.ts";
import type { M365InteractiveAuthorizer } from "@beep/m365";

// Tool calls never start a browser sign-in: an expired sign-in fails the call,
// and setup_status / setup_repair walk the lawyer through signing in again.
const signInThroughSetup: M365InteractiveAuthorizer = () => M365Error.failEffectFromReason("auth");

/**
 * The Microsoft 365 Graph read tools, mounted when the saved profile selects
 * `microsoft-365`, an app id is configured and a sign-in is saved.
 *
 * **Details**
 *
 * Tokens come from the DPAPI-protected cache the sign-in wrote; MSAL
 * refreshes them silently. Anything short of a saved sign-in mounts nothing
 * and logs why, so the setup tools stay reachable. The profile and the
 * sign-in are read once at startup: after the first sign-in, Claude restarts
 * the gateway to show the tools.
 *
 * **Example** (Compose the provider)
 *
 * ```ts
 * import { M365ProviderLayer } from "@beep/practice-gateway/M365Provider"
 * import * as Layer from "effect/Layer"
 *
 * console.log(Layer.isLayer(M365ProviderLayer))
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const M365ProviderLayer = Layer.unwrap(
  Effect.gen(function* () {
    const profile = yield* ProfileStore.use((store) => store.get);
    if (!O.exists(profile, profileSelects("microsoft-365"))) {
      return Layer.empty;
    }
    const connection = yield* M365SignIn.use((signIn) => signIn.connection);
    const saved = yield* connection.tokenCache.load;
    if (O.isNone(saved)) {
      yield* Effect.logInfo("Microsoft 365 tools wait for the first sign-in (setup_repair m365-consented).");
      return Layer.empty;
    }
    return M365McpRegistrationsLive.pipe(
      Layer.provide(
        M365.makeLiveLayer(M365ConfigInput.make(connection.config), {
          interactiveAuthorizer: signInThroughSetup,
          tokenCache: connection.tokenCache,
        })
      )
    );
  })
).pipe(
  Layer.catchCause((cause) =>
    Layer.effectDiscard(Effect.logWarning("The Microsoft 365 tools were not mounted.", Cause.pretty(cause)))
  )
);
