/**
 * The identity authority, the IRI root of every declared internal namespace.
 *
 * **Details**
 *
 * This module has no imports, so the generated registry data and the
 * identity composer can both depend on it without an import cycle.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

/**
 * Identity authority that roots every owned `@beep/*` IRI.
 *
 * **Details**
 *
 * This is the single runtime source for the repository identity root. The
 * root `$I` composer, the default composer authority type, and the `beep`
 * vocabulary namespace all reference it, so the authority is written once.
 * The value keeps its trailing `/`, so a namespace segment is appended
 * directly: `research-library/` mints `https://beep-effect.com/ns/research-library/`.
 *
 * **Example** (Read the identity authority)
 *
 * ```ts import.meta.vitest name="Read the identity authority"
 * import { IdentityAuthority } from "@beep/identity/Authority"
 *
 * const namespace = `${IdentityAuthority}research-library/`
 *
 * IdentityAuthority // => "https://beep-effect.com/ns/"
 * namespace // => "https://beep-effect.com/ns/research-library/"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const IdentityAuthority = "https://beep-effect.com/ns/" as const;
