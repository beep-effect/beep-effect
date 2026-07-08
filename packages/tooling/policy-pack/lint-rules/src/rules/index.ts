/**
 * Oxlint plugin registry aggregating the repo-local `beep` policy-pack rules.
 *
 * @packageDocumentation
 * @since 0.1.0
 */

import { definePlugin } from "@oxlint/plugins";
import namespaceNodeImports from "./namespace-node-imports.ts";
import noGlobalProcessRuntime from "./no-global-process-runtime.ts";
import noInlineSchemaCompile from "./no-inline-schema-compile.ts";
import noManualEffectRuntimeInTests from "./no-manual-effect-runtime-in-tests.ts";
import noOpaqueInstanceFields from "./no-opaque-instance-fields.ts";

/**
 * Re-exported import-binding model used by individual lint-rule helpers.
 *
 * @example
 * ```ts
 * import type { ImportBinding } from "@beep/lint-rules/oxlint"
 *
 * const binding: ImportBinding = {
 *   kind: "named",
 *   imported: "Effect",
 *   local: "Effect"
 * }
 * console.log(binding.local)
 * ```
 * @category models
 * @since 0.0.0
 */
export { ImportBinding } from "./utils.ts";

/**
 * Oxlint plugin that exposes the repo-local TypeScript policy rules under the
 * `beep` plugin namespace.
 *
 * @example
 * ```ts
 * import { ok } from "node:assert/strict"
 * import plugin from "@beep/lint-rules/oxlint"
 *
 * ok(plugin.rules["no-inline-schema-compile"])
 * ok(plugin.rules["namespace-node-imports"])
 * ```
 * @category tools
 * @since 0.1.0
 */
export default definePlugin({
  meta: {
    name: "beep",
  },
  rules: {
    "namespace-node-imports": namespaceNodeImports,
    "no-global-process-runtime": noGlobalProcessRuntime,
    "no-inline-schema-compile": noInlineSchemaCompile,
    "no-manual-effect-runtime-in-tests": noManualEffectRuntimeInTests,
    "no-opaque-instance-fields": noOpaqueInstanceFields,
  },
});
