/**
 * The platforms this program can map, and where a user signs in to each.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SocialMapperId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import * as S from "effect/Schema";
import { Platform } from "./locator.ts";

const $I = $SocialMapperId.create("core/catalog");

/**
 * **Example** (Describe an installed platform)
 *
 * ```ts import.meta.vitest name="Describe an installed platform"
 * import { Installed } from "@/core/catalog"
 *
 * Installed.make({ platform: "onlyfans", entry: new URL("https://onlyfans.com") }).entry.host // => "onlyfans.com"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Installed extends S.Opaque<Installed, { readonly brand: unique symbol }>()(
  S.Struct({
    platform: Platform,
    entry: S.URLFromString.pipe(S.annotateKey({ description: "Address a sign-in window opens at." })),
  }).pipe($I.annoteSchema("Installed", { description: "A platform that has a mapper, and where its sign-in begins." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Installed {
  /**
   * @category type-level
   * @since 0.0.0
   */
  export interface Encoded {
    readonly entry: string;
    readonly platform: Platform.Encoded;
  }
}

/**
 * Names the platforms that have a mapper in this program.
 *
 * **Example** (List what can be mapped)
 *
 * ```ts import.meta.vitest name="List what can be mapped"
 * import { Catalog } from "@/core/catalog"
 *
 * const platforms = Catalog.useSync(({ installed }) => installed)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class Catalog extends Context.Service<Catalog, { readonly installed: ReadonlyArray<Installed> }>()(
  $I`Catalog`
) {}
