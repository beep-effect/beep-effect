/**
 * Reserved top-level routes on the public origin.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $PublicSiteId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";

const $I = $PublicSiteId.create("SiteRoute");

/**
 * **Details**
 *
 * `ns` is reserved for identity dereference and must stay equal to the
 * `@beep/identity` authority. `taxonomy` is its HTML discovery projection.
 * `labs` hosts lab projections through `labRoute`.
 *
 * **Example** (Check a reserved route)
 *
 * ```ts import.meta.vitest name="Check a reserved route"
 * import { SiteRoute } from "@beep/public-site/SiteRoute.schema"
 *
 * SiteRoute.is.ns("ns") // => true
 * SiteRoute.literals.length // => 13
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const SiteRoute = LiteralKit([
  "ns",
  "taxonomy",
  "docs",
  "api",
  "storybook",
  "llms.txt",
  "mcp",
  "labs",
  "goals",
  "explorations",
  "research",
  ".well-known",
  "sitemap.xml",
]).pipe(
  $I.annoteSchema("SiteRoute", {
    description: "A reserved top-level route slug on the public origin.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type SiteRoute = typeof SiteRoute.Type;

/**
 * Schema for routes that name a single file and never take a nested path.
 *
 * **Example** (Recognize file routes)
 *
 * ```ts import.meta.vitest name="Recognize file routes"
 * import { FileRoute } from "@beep/public-site/SiteRoute.schema"
 *
 * FileRoute.is["llms.txt"]("llms.txt") // => true
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const FileRoute = SiteRoute.pick(["llms.txt", "sitemap.xml"]).pipe(
  $I.annoteSchema("FileRoute", {
    description: "A reserved route that names a single file and accepts no nested path.",
  })
);

/**
 * Union of the file route slugs decoded by {@link FileRoute}.
 *
 * @category models
 * @since 0.0.0
 */
export type FileRoute = typeof FileRoute.Type;

/**
 * Schema for routes that accept a nested path in `hostedUrl`.
 *
 * **Details**
 *
 * Excludes the file routes and `labs`; lab URLs go through `labRoute`.
 *
 * **Example** (Recognize nested-path routes)
 *
 * ```ts import.meta.vitest name="Recognize nested-path routes"
 * import { PathRoute } from "@beep/public-site/SiteRoute.schema"
 *
 * PathRoute.is.docs("docs") // => true
 * PathRoute.is.mcp("labs") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const PathRoute = SiteRoute.pick([
  "ns",
  "taxonomy",
  "docs",
  "api",
  "storybook",
  "mcp",
  "goals",
  "explorations",
  "research",
  ".well-known",
]).pipe(
  $I.annoteSchema("PathRoute", {
    description: "A reserved route that accepts a nested path below it.",
  })
);

/**
 * Union of the nested-path route slugs decoded by {@link PathRoute}.
 *
 * @category models
 * @since 0.0.0
 */
export type PathRoute = typeof PathRoute.Type;
