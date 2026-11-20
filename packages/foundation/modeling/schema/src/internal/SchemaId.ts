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
 * **Gotchas**
 *
 * The export is not annotated with `IdentityComposer<"@beep/schema">`. The
 * inferred type is the same, but checking the call against the annotation
 * makes the checker measure `IdentityComposer`'s variance, about 4,500 type
 * instantiations in every program that loads this module, which the
 * `@beep/schema` check census rejects.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $BeepId } from "@beep/identity/Root";

/**
 * Identity composer for the `@beep/schema` package, built without the
 * identity registry.
 *
 * **Details**
 *
 * `@beep/schema` exports no `internal/*` path, so the example shows the
 * expression this leaf evaluates; package modules import `$SchemaId` from
 * this file by relative path.
 *
 * **Example** (Build the same composer from the root)
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
export const $SchemaId = /*#__PURE__*/ $BeepId.create("schema");
