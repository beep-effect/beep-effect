/**
 * Registry-free root composer for the `@beep` namespace.
 *
 * **Details**
 *
 * `$BeepId` is the same root as `$I` in `@beep/identity/packages`, built in a
 * module that imports only `./Id.ts`. A package whose modules end up in a
 * deployed bundle (the CI runner Lambda handlers) derives its own composer
 * from it in a package-local leaf module, so the bundle never loads the
 * registry: registering a new workspace package then leaves the bundle, its
 * source map and its hash unchanged.
 *
 * Everything else keeps importing its composer from
 * `@beep/identity/packages`, which stays the one list `beep create-package`
 * and `beep lint identity-registry` read and write. Tests assert that each
 * leaf derived from `$BeepId` mints what the registry composer for the same
 * slug mints, and `beep lint identity-registry` confines `$BeepId` to
 * `src/internal/<Composer>.ts` leaves over their own registry slug and keeps
 * every module of a leaf package off the registry.
 *
 * **Example** (Derive a package leaf from the root)
 *
 * ```ts import.meta.vitest name="Derive a package leaf from the root"
 * import { $BeepId } from "@beep/identity/Root"
 *
 * const $SchemaId = $BeepId.create("schema")
 * $SchemaId.make("Email") // => "@beep/schema/Email"
 * ```
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as Identity from "./Id.ts";

/**
 * Root identity composer for the `@beep` namespace, built without the
 * package registry.
 *
 * **Details**
 *
 * Equal to `$I` from `@beep/identity/packages`: same identifier, IRI and
 * CURIE. Import it only in a package-local leaf module that must stay out of
 * the registry's module graph; any other module takes its composer from
 * `@beep/identity/packages`. `beep lint identity-registry` reports a use
 * anywhere else.
 *
 * **Example** (Mint a root identifier)
 *
 * ```ts import.meta.vitest name="Mint a root identifier"
 * import { $BeepId } from "@beep/identity/Root"
 *
 * $BeepId.make("CustomSegment") // => "@beep/CustomSegment"
 * $BeepId.iri // => "https://beep-effect.com/ns/"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const $BeepId: Identity.IdentityComposer<"@beep"> = Identity.make("beep", {
  authority: Identity.IdentityAuthority,
  prefix: "beep",
}).$BeepId;
