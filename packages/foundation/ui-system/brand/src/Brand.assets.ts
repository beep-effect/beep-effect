/**
 * The generated files this package ships, rendered from the brand identity so the checked-in stylesheet and SVG assets can be proven current.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $BrandId } from "@beep/identity";
import * as O from "effect/Option";
import * as S from "effect/Schema";
import { renderThemeCss } from "./Brand.css.ts";
import { MarkGround, MarkPaint, MarkSvgRequest, WordmarkSvgRequest } from "./Brand.schema.ts";
import { renderMarkSvg, renderWordmarkSvg } from "./Brand.svg.ts";
import type { BrandIdentity } from "./Brand.schema.ts";

const $I = $BrandId.create("Brand.assets");

/**
 * One generated file: its package-relative path and full text content.
 *
 * **Example** (Construct a rendered asset)
 *
 * ```ts
 * import { RenderedAsset } from "@beep/brand"
 *
 * console.log(RenderedAsset.make({ path: "styles/brand.css", content: "" }).path)
 * ```
 *
 * @category rendering
 * @since 0.0.0
 */
export class RenderedAsset extends S.Class<RenderedAsset>($I`RenderedAsset`)(
  {
    path: S.NonEmptyString.annotateKey({ description: "Path relative to the package root." }),
    content: S.String.annotateKey({ description: "Full file text." }),
  },
  $I.annote("RenderedAsset", { description: "A generated file: package-relative path and text content." })
) {}

const onDark = (identity: BrandIdentity): MarkPaint =>
  MarkPaint.make({ stroke: "currentColor", frame: identity.dark.foreground.base, lens: identity.dark.surface["0"] });

const accentOnDark = (identity: BrandIdentity): MarkPaint =>
  MarkPaint.make({
    stroke: identity.dark.brand["400"],
    frame: identity.dark.foreground.base,
    lens: identity.dark.surface["0"],
  });

const accentOnLight = (identity: BrandIdentity): MarkPaint =>
  MarkPaint.make({
    stroke: identity.light.brand["400"],
    frame: identity.dark.foreground.base,
    lens: identity.dark.surface["0"],
  });

const favicon = (identity: BrandIdentity): MarkPaint =>
  MarkPaint.make({
    stroke: identity.dark.brand["400"],
    frame: identity.dark.foreground.base,
    lens: identity.dark.brand["900"],
  });

/**
 * Render every generated file for an identity.
 *
 * **Details**
 *
 * The list is the contract between `scripts/render.ts`, which writes these files, and
 * the parity test, which fails when a checked-in file no longer matches its render.
 * The PNG icon set is not generated here; it is rasterised from `assets/favicon.svg`.
 *
 * **Example** (List generated paths)
 *
 * ```ts
 * import { beep, renderBrandAssets } from "@beep/brand"
 *
 * console.log(renderBrandAssets(beep).map((asset) => asset.path))
 * ```
 *
 * @param identity - Brand identity to render.
 * @returns The stylesheet and SVG assets in a stable order.
 * @category rendering
 * @since 0.0.0
 */
export const renderBrandAssets = (identity: BrandIdentity): ReadonlyArray<RenderedAsset> => [
  RenderedAsset.make({ path: "styles/brand.css", content: renderThemeCss(identity) }),
  RenderedAsset.make({
    path: "assets/mark.svg",
    content: renderMarkSvg(
      MarkSvgRequest.make({ mark: identity.mark, size: identity.mark.viewBox, paint: onDark(identity) })
    ),
  }),
  RenderedAsset.make({
    path: "assets/favicon.svg",
    content: renderMarkSvg(
      MarkSvgRequest.make({
        mark: identity.mark,
        size: 32,
        paint: favicon(identity),
        ground: O.some(MarkGround.make({ fill: identity.dark.brand["900"], radius: 6 })),
      })
    ),
  }),
  RenderedAsset.make({
    path: "assets/wordmark.svg",
    content: renderWordmarkSvg(
      WordmarkSvgRequest.make({ identity, paint: accentOnDark(identity), textFill: identity.dark.foreground.base })
    ),
  }),
  RenderedAsset.make({
    path: "assets/wordmark-light.svg",
    content: renderWordmarkSvg(
      WordmarkSvgRequest.make({ identity, paint: accentOnLight(identity), textFill: identity.light.foreground.base })
    ),
  }),
];
