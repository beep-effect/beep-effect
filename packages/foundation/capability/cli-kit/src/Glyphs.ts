/**
 * The glyph sets a theme draws with, Unicode and ASCII, and the selection between them from `TERM`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $CliKitId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $CliKitId.create("Glyphs");

/**
 * **Example** (Validate a built-in glyph set)
 *
 * ```ts
 * import { GlyphSet, Glyphs } from "@beep/cli-kit/Glyphs"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GlyphSet)(Glyphs.ascii)) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class GlyphSet extends S.Opaque<GlyphSet, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Which set this is. */
    kind: S.Literals(["unicode", "ascii"]).pipe(
      $I.annoteKey("GlyphSet.kind", { description: "The kind field of the glyph set." })
    ),
    /** The truncation marker. */
    ellipsis: S.String.pipe($I.annoteKey("GlyphSet.ellipsis", { description: "The ellipsis field of the glyph set." })),
    /** The frames of a spinner, in order. */
    spinner: S.Array(S.String).pipe(
      $I.annoteKey("GlyphSet.spinner", { description: "The spinner field of the glyph set." })
    ),
    /** A list bullet. */
    bullet: S.String.pipe($I.annoteKey("GlyphSet.bullet", { description: "The bullet field of the glyph set." })),
    /** A directional arrow. */
    arrow: S.String.pipe($I.annoteKey("GlyphSet.arrow", { description: "The arrow field of the glyph set." })),
    /** The separator between the segments of a breadcrumb or path: one for people, one for agents. */
    pathSeparator: S.Struct({
      human: S.String.pipe(
        $I.annoteKey("GlyphSet.pathSeparator.human", { description: "The path separator shown to people." })
      ),
      agent: S.String.pipe(
        $I.annoteKey("GlyphSet.pathSeparator.agent", { description: "The path separator shown to agents." })
      ),
    }).pipe($I.annoteKey("GlyphSet.pathSeparator", { description: "Audience-specific path separators." })),
    /** How long a spinner frame is shown, in milliseconds. */
    spinnerIntervalMs: S.Finite.pipe(
      $I.annoteKey("GlyphSet.spinnerIntervalMs", { description: "The spinnerIntervalMs field of the glyph set." })
    ),
    /**
     * The segments a tree is drawn with: `branch` before a child that has later siblings, `last` before the final
     * child, and `pipe` and `blank` as the indent under each. All four are one width so branches align.
     */
    tree: S.Struct({
      branch: S.String.pipe($I.annoteKey("GlyphSet.tree.branch", { description: "The branch segment of a tree." })),
      last: S.String.pipe($I.annoteKey("GlyphSet.tree.last", { description: "The last segment of a tree." })),
      pipe: S.String.pipe($I.annoteKey("GlyphSet.tree.pipe", { description: "The pipe segment of a tree." })),
      blank: S.String.pipe($I.annoteKey("GlyphSet.tree.blank", { description: "The blank segment of a tree." })),
    }).pipe($I.annoteKey("GlyphSet.tree", { description: "Equal-width segments used to draw trees." })),
  }).pipe($I.annoteSchema("GlyphSet", { description: "The symbols and spinner timing a CLI theme draws with." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import type { GlyphSet } from "@beep/cli-kit/Glyphs"
 *
 * const accepts = (_value: GlyphSet.Encoded) => true
 * console.log(typeof accepts) // function
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GlyphSet {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof GlyphSet.Encoded;
}

/**
 * **Example** (Validate plain options)
 *
 * ```ts
 * import { GlyphSelectOptions } from "@beep/cli-kit/Glyphs"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(GlyphSelectOptions)({ ascii: "auto", term: "xterm-256color" })) // true
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export class GlyphSelectOptions extends S.Opaque<GlyphSelectOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /**
     * `true` is ASCII, `false` is Unicode, and `auto` (the default) is ASCII only when `term` is `dumb`.
     */
    ascii: S.optionalKey(S.Union([S.Boolean, S.Literal("auto")])).pipe(
      $I.annoteKey("GlyphSelectOptions.ascii", { description: "The ascii field of GlyphSelectOptions." })
    ),
    /**
     * The `TERM` value, which only `auto` reads. It is passed in rather than read: this selection is pure, so a
     * caller with no Effect context (an Ink component) uses it, and `process` is never consulted. Unset is not
     * `dumb`.
     */
    term: S.optionalKey(S.String).pipe(
      $I.annoteKey("GlyphSelectOptions.term", { description: "The term field of GlyphSelectOptions." })
    ),
  }).pipe($I.annoteSchema("GlyphSelectOptions", { description: "Plain GlyphSelectOptions data." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { GlyphSelectOptions } from "@beep/cli-kit/Glyphs"
 * import * as S from "effect/Schema"
 *
 * const plain: GlyphSelectOptions.Encoded = { ascii: "auto", term: "xterm-256color" }
 * console.log(S.is(GlyphSelectOptions)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace GlyphSelectOptions {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof GlyphSelectOptions.Encoded;
}

/**
 * The two glyph sets: Unicode, and a plain-ASCII fallback for terminals that cannot draw it.
 *
 * **Details**
 *
 * The sets are shared, so they and their nested values have readonly types.
 *
 * **Example** (Select the terminal fallback)
 *
 * ```ts
 * import { Glyphs } from "@beep/cli-kit/Glyphs"
 *
 * console.log(Glyphs.select({ term: "dumb" }).kind) // ascii
 * ```
 *
 * @public
 * @category constants
 * @since 0.0.0
 */
export abstract class Glyphs {
  /**
   * Unicode symbols.
   *
   * **Example** (Inspect the Unicode arrow)
   *
   * ```ts
   * import { Glyphs } from "@beep/cli-kit/Glyphs"
   *
   * console.log(Glyphs.unicode.arrow) // →
   * ```
   *
   * @category constants
   * @since 0.0.0
   */
  static readonly unicode: GlyphSet.Encoded = {
    kind: "unicode",
    ellipsis: "…",
    spinner: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
    bullet: "•",
    arrow: "→",
    pathSeparator: { human: "›", agent: " > " },
    spinnerIntervalMs: 80,
    tree: { branch: "├─ ", last: "└─ ", pipe: "│  ", blank: "   " },
  };

  /**
   * Pick a glyph set without a service: the one `CliTheme` uses, as a pure function.
   *
   * **Details**
   *
   * `CliTheme.layer` reads `TERM` through `Config` and calls this, so the two agree. `StreamEnv` carries no
   * `TERM`, and nothing else in it decides ASCII, so the caller passes `term` when it wants `auto` to mean
   * something.
   *
   * **Example** (Force Unicode on a dumb terminal)
   *
   * ```ts
   * import { Glyphs } from "@beep/cli-kit/Glyphs"
   *
   * console.log(Glyphs.select({ ascii: false, term: "dumb" }).kind) // unicode
   * ```
   *
   * @param options - whether to force ASCII or Unicode, and the `TERM` value `auto` reads
   * @category utilities
   * @since 0.0.0
   */
  static readonly select = (options?: GlyphSelectOptions.Encoded): GlyphSet.Encoded => {
    const ascii = options?.ascii ?? "auto";
    return ascii === true || (ascii === "auto" && options?.term === "dumb") ? Glyphs.ascii : Glyphs.unicode;
  };

  /**
   * ASCII-only symbols.
   *
   * **Example** (Inspect the ASCII arrow)
   *
   * ```ts
   * import { Glyphs } from "@beep/cli-kit/Glyphs"
   *
   * console.log(Glyphs.ascii.arrow) // ->
   * ```
   *
   * @category constants
   * @since 0.0.0
   */
  static readonly ascii: GlyphSet.Encoded = {
    kind: "ascii",
    ellipsis: "...",
    spinner: ["-", "\\", "|", "/"],
    bullet: "*",
    arrow: "->",
    pathSeparator: { human: ">", agent: " > " },
    spinnerIntervalMs: 80,
    tree: { branch: "|-- ", last: "\\-- ", pipe: "|   ", blank: "    " },
  };
}
