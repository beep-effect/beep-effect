/** Inert Cowork plugin artifact renderer; no file writes, install, enablement or restart.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RepoAiMetricsId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import { coworkHookSource } from "./internal/cowork-hook-source.ts";

const $I = $RepoAiMetricsId.create("claude-cowork-plugin");
const SafePath = S.String.check(S.isPattern(/^\/[A-Za-z0-9_./-]{1,106}$/));
const encode = S.encodeUnknownEffect(S.fromJsonString(S.Unknown));
/** Explicit deployment inputs for an uninstalled local-only plugin.
 * **Example** (Inspect the inert API)
 * ```ts
 * import { CoworkLifecyclePluginRequest } from "@beep/repo-ai-metrics/claude-cowork-plugin"
 * console.log(typeof CoworkLifecyclePluginRequest.make)
 * ```
 * @category models
 * @since 0.0.0
 */
export class CoworkLifecyclePluginRequest extends S.Opaque<
  CoworkLifecyclePluginRequest,
  { readonly brand: unique symbol }
>()(
  S.Struct({ socketPath: SafePath, interpreter: SafePath }).pipe(
    $I.annoteSchema("CoworkLifecyclePluginRequest", {
      description:
        "Root-reviewed local socket and separately qualified JavaScript interpreter; no ambient config lookup.",
    })
  )
) {}
/** Render only source files; the caller must separately review and authorize deployment.
 * **Example** (Inspect the inert API)
 * ```ts
 * import { renderCoworkLifecyclePlugin } from "@beep/repo-ai-metrics/claude-cowork-plugin"
 * console.log(typeof renderCoworkLifecyclePlugin)
 * ```
 * @param request - Receiver-owned deployment paths, never native callback fields.
 * @returns An inert file map with manifest, two command hooks and a silent bounded script.
 * @category constructors
 * @since 0.0.0
 */
export const renderCoworkLifecyclePlugin = Effect.fn("AiMetrics.coworkLifecycle.plugin")(function* (
  request: CoworkLifecyclePluginRequest
) {
  const command = `"${request.interpreter}" "\${CLAUDE_PLUGIN_ROOT}/scripts/observe-lifecycle.mjs" "${request.socketPath}"`;
  const handler = { hooks: [{ type: "command", command }] };
  return {
    ".claude-plugin/plugin.json": yield* encode({
      name: "beep-cowork-lifecycle",
      version: "0.1.0",
      description: "Content-free host-local Cowork lifecycle observations; separate receiver enrollment required.",
    }),
    "hooks/hooks.json": yield* encode({ hooks: { SessionStart: [handler], SessionEnd: [handler] } }),
    "scripts/observe-lifecycle.mjs": coworkHookSource,
  };
});
