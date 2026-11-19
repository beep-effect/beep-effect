/**
 * Package-local identity leaf for `@beep/schema`.
 *
 * **Details**
 *
 * CI runner Lambda handlers bundle `@beep/schema` modules, and a bundle's
 * source map embeds every module it loads. Taking the composer from this leaf
 * instead of `@beep/identity/packages` keeps the identity registry out of
 * those bundles, so registering a new workspace package does not change their
 * code hash. The value equals the registry's `$SchemaId`; a test in this
 * package asserts it.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BeepId } from "@beep/identity/Root";
import type { IdentityComposer } from "@beep/identity/Id";

/**
 * Identity composer for the `@beep/schema` package, built without the
 * identity registry.
 *
 * **Example** (Derive a schema identifier)
 *
 * ```ts
 * import { $BeepId } from "@beep/identity/Root"
 *
 * console.log($BeepId.create("schema").make("Email"))
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $SchemaId: IdentityComposer<"@beep/schema"> = /*#__PURE__*/ $BeepId.create("schema");
