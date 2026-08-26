/**
 * beep brand identity: schema-first color schemes, typography, and mark geometry, plus the
 * encoders that render them to CSS and SVG; stylesheets and static assets ship beside the
 * source on `@beep/brand/styles/*` and `@beep/brand/assets/*`, and React components live on
 * the `@beep/brand/react` subpath so this root stays framework-free.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

export {
  /**
   * @category rendering
   * @since 0.0.0
   */
  RenderedAsset,
  /**
   * @category rendering
   * @since 0.0.0
   */
  renderBrandAssets,
} from "./Brand.assets.ts";
export {
  /**
   * @category rendering
   * @since 0.0.0
   */
  GENERATED_CSS_BANNER,
  /**
   * @category rendering
   * @since 0.0.0
   */
  renderThemeCss,
} from "./Brand.css.ts";
export {
  /**
   * @category models
   * @since 0.0.0
   */
  Alpha,
  /**
   * @category models
   * @since 0.0.0
   */
  Border,
  /**
   * @category models
   * @since 0.0.0
   */
  BrandIdentity,
  /**
   * @category models
   * @since 0.0.0
   */
  BrandMark,
  /**
   * @category models
   * @since 0.0.0
   */
  ColorScale,
  /**
   * @category models
   * @since 0.0.0
   */
  ColorScheme,
  /**
   * @category models
   * @since 0.0.0
   */
  FontStack,
  /**
   * @category models
   * @since 0.0.0
   */
  Foreground,
  /**
   * @category models
   * @since 0.0.0
   */
  Glow,
  /**
   * @category models
   * @since 0.0.0
   */
  GlowLayer,
  /**
   * @category models
   * @since 0.0.0
   */
  GlowStop,
  /**
   * @category models
   * @since 0.0.0
   */
  MarkGround,
  /**
   * @category models
   * @since 0.0.0
   */
  MarkPaint,
  /**
   * @category models
   * @since 0.0.0
   */
  MarkPoint,
  /**
   * @category models
   * @since 0.0.0
   */
  MarkRotation,
  /**
   * @category models
   * @since 0.0.0
   */
  MarkSvgRequest,
  /**
   * @category models
   * @since 0.0.0
   */
  PixelGlasses,
  /**
   * @category models
   * @since 0.0.0
   */
  ScaleStep,
  /**
   * @category models
   * @since 0.0.0
   */
  SchemeName,
  /**
   * @category models
   * @since 0.0.0
   */
  Semantic,
  /**
   * @category models
   * @since 0.0.0
   */
  SurfaceScale,
  /**
   * @category models
   * @since 0.0.0
   */
  SurfaceStep,
  /**
   * @category models
   * @since 0.0.0
   */
  SvgPaint,
  /**
   * @category models
   * @since 0.0.0
   */
  SvgPathData,
  /**
   * @category models
   * @since 0.0.0
   */
  Typography,
  /**
   * @category models
   * @since 0.0.0
   */
  WordmarkSvgRequest,
} from "./Brand.schema.ts";
export {
  /**
   * @category rendering
   * @since 0.0.0
   */
  glassesTransform,
  /**
   * @category rendering
   * @since 0.0.0
   */
  renderMarkSvg,
  /**
   * @category rendering
   * @since 0.0.0
   */
  renderWordmarkSvg,
} from "./Brand.svg.ts";
export {
  /**
   * @category tokens
   * @since 0.0.0
   */
  beep,
} from "./Brand.tokens.ts";
