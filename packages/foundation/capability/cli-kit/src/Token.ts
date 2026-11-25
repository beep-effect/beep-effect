/**
 * Semantic colour tokens (`success`, `failure`, `warning`, `info`, `error`, `muted`, `accent`, `emphasis`), their
 * default styles and the styles a theme can override them with.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $CliKitId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $CliKitId.create("Token");

/**
 * A named terminal colour: the eight ANSI colours and their bright variants.
 *
 * **Details**
 *
 * The bright variants are spelled as chalk and Ink spell them (`redBright`, `blackBright`), so a style maps to
 * either without a rename table. `gray` is chalk's alias for `blackBright`.
 *
 * **Example** (Validate a bright colour)
 *
 * ```ts
 * import { NamedColor } from "@beep/cli-kit/Token"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(NamedColor)("redBright")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const NamedColor = LiteralKit([
  "black",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "white",
  "blackBright",
  "redBright",
  "greenBright",
  "yellowBright",
  "blueBright",
  "magentaBright",
  "cyanBright",
  "whiteBright",
  "gray",
]).pipe($I.annoteSchema("NamedColor", { description: "Named ANSI colors and their bright variants." }));
/**
 * The decoded named ANSI colour accepted by {@link NamedColor}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type NamedColor = typeof NamedColor.Type;

/**
 * A terminal style: an optional foreground colour and text attributes.
 *
 * **Details**
 *
 * A style is data; it carries no escape sequences. `CliTheme.paint` renders it for the terminal's colour
 * level, and at level `none` rendering is the identity. A hex foreground that is not `#rgb` or `#rrggbb`, and
 * a name that is not a {@link NamedColor}, is ignored when rendered rather than failing.
 *
 * **Example** (Validate a foreground and text attribute)
 *
 * ```ts
 * import { Style } from "@beep/cli-kit/Token"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(Style)({ fg: "#abc", bold: true })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class Style extends S.Opaque<Style, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The foreground: a named colour or a hex spelling, including invalid hex handled by the renderer. */
    fg: S.optionalKey(S.Union([NamedColor, S.TemplateLiteral(["#", S.String])])).pipe(
      $I.annoteKey("Style.fg", {
        description:
          "The foreground colour: a named ANSI colour or a `#`-prefixed hex spelling; a hex that is not `#rgb` or `#rrggbb` is accepted and ignored when rendered.",
      })
    ),
    /** Bold. */
    bold: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("Style.bold", { description: "Renders the text bold (SGR 1) when true." })
    ),
    /** Dim, or faint. */
    dim: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("Style.dim", { description: "Renders the text dim, or faint (SGR 2), when true." })
    ),
    /** Italic. */
    italic: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("Style.italic", { description: "Renders the text italic (SGR 3) when true." })
    ),
    /** Underline. */
    underline: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("Style.underline", { description: "Renders the text underlined (SGR 4) when true." })
    ),
  }).pipe($I.annoteSchema("Style", { description: "A readonly terminal foreground and text attributes." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { Style } from "@beep/cli-kit/Token"
 * import * as S from "effect/Schema"
 *
 * const plain: Style.Encoded = { fg: "red", bold: true }
 * console.log(S.is(Style)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Style {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Style.Encoded;
}

/**
 * The semantic tokens a theme resolves to a {@link Style}.
 *
 * **Example** (Validate a semantic token)
 *
 * ```ts
 * import { TokenName } from "@beep/cli-kit/Token"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(TokenName)("warning")) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const TokenName = LiteralKit([
  "success",
  "failure",
  "warning",
  "info",
  "error",
  "muted",
  "accent",
  "emphasis",
]).pipe($I.annoteSchema("TokenName", { description: "Semantic tokens resolved by a CLI theme." }));
/**
 * The decoded semantic theme token accepted by {@link TokenName}.
 *
 * @category type-level
 * @since 0.0.0
 */
export type TokenName = typeof TokenName.Type;

/** The default style of every token. Readonly data: the record is shared. */
const DEFAULTS: Readonly<Record<TokenName, Style.Encoded>> = {
  success: { fg: "green" },
  failure: { fg: "red" },
  error: { fg: "red", bold: true },
  warning: { fg: "yellow" },
  info: { fg: "cyan" },
  muted: { dim: true },
  accent: { fg: "cyan" },
  emphasis: { bold: true },
} as const;

/**
 * Constructors for {@link Style} values, and the pure resolution of a token to one.
 *
 * **Example** (Construct and resolve a style)
 *
 * ```ts
 * import { Token } from "@beep/cli-kit/Token"
 *
 * console.log(Token.resolve(Token.hex("#abc")).fg) // #abc
 * ```
 *
 * @public
 * @category constructors
 * @since 0.0.0
 */
export class Token {
  private constructor() {}

  /**
   * The default {@link Style} of every token, readonly.
   *
   * **Details**
   *
   * Data, not a service: it is what `CliTheme` starts from, and a renderer with no Effect context (an Ink
   * component) reads it directly.
   *
   * **Example** (Inspect the shared success style)
   *
   * ```ts
   * import { Token } from "@beep/cli-kit/Token"
   *
   * console.log(Token.defaults.success.fg) // green
   * ```
   *
   * @category constants
   * @since 0.0.0
   */
  static readonly defaults: Readonly<Record<TokenName, Style.Encoded>> = DEFAULTS;

  /**
   * The style a token or style resolves to, as a pure function: no service, no terminal.
   *
   * **Details**
   *
   * An explicit style resolves to itself. A token name resolves to its override when `overrides` has one, else
   * its default; a name that is not a token (including an `Object.prototype` member) resolves to the empty
   * style. This is the same resolution `CliTheme.paint` applies, which is what `StreamTheme.style` reports.
   *
   * **Example** (Resolve defaults and overrides)
   *
   * ```ts
   * import { Token } from "@beep/cli-kit/Token"
   *
   * console.log(Token.resolve("success").fg) // green
   * console.log(Token.resolve("success", { success: { fg: "blue" } }).fg) // blue
   * ```
   *
   * @param token - a token name or an explicit style
   * @param overrides - styles that replace the default of a token, as `CliThemeOptions.tokens` does
   * @category getters
   * @since 0.0.0
   */
  static readonly resolve = (
    token: TokenName | Style.Encoded,
    overrides?: Partial<Record<TokenName, Style.Encoded>>
  ): Style.Encoded => {
    if (!P.isString(token)) return token;
    const own =
      overrides !== undefined && R.has<string, Style.Encoded | undefined>(overrides, token)
        ? overrides[token]
        : undefined;
    if (own !== undefined) return own;
    return R.has(DEFAULTS, token) ? DEFAULTS[token] : {};
  };

  /**
   * A foreground from a hex colour.
   *
   * **Example** (Construct a hex foreground)
   *
   * ```ts
   * import { Token } from "@beep/cli-kit/Token"
   *
   * console.log(Token.hex("#123456").fg) // #123456
   * ```
   *
   * @param hex - `#rrggbb` (or `#rgb`)
   * @category constructors
   * @since 0.0.0
   */
  static readonly hex = (hex: `#${string}`): Style.Encoded => ({ fg: hex });

  /**
   * A foreground from a named colour.
   *
   * **Example** (Construct a named foreground)
   *
   * ```ts
   * import { Token } from "@beep/cli-kit/Token"
   *
   * console.log(Token.named("redBright").fg) // redBright
   * ```
   *
   * @param color - the colour
   * @category constructors
   * @since 0.0.0
   */
  static readonly named = (color: NamedColor): Style.Encoded => ({ fg: color });

  /**
   * A style, as written. Exists so a style reads as a token at a call site.
   *
   * **Example** (Keep an explicit style identity)
   *
   * ```ts
   * import { Token } from "@beep/cli-kit/Token"
   *
   * const style = { bold: true }
   * console.log(Token.style(style) === style) // true
   * ```
   *
   * @param style - the style
   * @category constructors
   * @since 0.0.0
   */
  static readonly style = (style: Style.Encoded): Style.Encoded => style;
}
