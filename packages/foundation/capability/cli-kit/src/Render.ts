/**
 * Pure renderers from a document to text (`plain`, `ansi`, `markdown`, `githubLog`) and the rendering context they
 * share: width, audience, colour, glyphs, links and path display.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { CommandNeutralizer } from "@beep/github-commands";
import { $CliKitId } from "@beep/identity/packages";
import { Audience, TerminalEnv } from "@beep/runtime-env";
import { AudienceKind } from "@beep/runtime-env/Audience";
import { ColorLevel } from "@beep/runtime-env/ColorLevel";
import * as O from "@beep/utils/Option";
import * as Effect from "effect/Effect";
import { dual } from "effect/Function";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import { CliLinks } from "./CliLinks.ts";
import { CliTheme, StreamTheme } from "./CliTheme.ts";
import { GlyphSet, Glyphs } from "./Glyphs.ts";
import { paintStyle } from "./internal/ansi.ts";
import { underGithubActions } from "./internal/autoFormat.ts";
import { AnyNumber, DisplayPath, LinksService } from "./internal/declared.ts";
import { renderAnsi } from "./internal/renderAnsi.ts";
import { renderGithubLog } from "./internal/renderGithubLog.ts";
import { renderMarkdown } from "./internal/renderMarkdown.ts";
import { renderPlain } from "./internal/renderPlain.ts";
import { Token } from "./Token.ts";
import type { Document } from "./Doc.ts";
import type { LinkTargetInput } from "./LinkTarget.ts";
import type { Style, TokenName } from "./Token.ts";

const $I = $CliKitId.create("Render");

const RenderContextLink = S.declare<{
  (target: LinkTargetInput, label: string): string;
  (label: string): (target: LinkTargetInput) => string;
}>(
  (
    value
  ): value is {
    (target: LinkTargetInput, label: string): string;
    (label: string): (target: LinkTargetInput) => string;
  } => P.isFunction(value)
).pipe(
  $I.annoteSchema("RenderContextLink", { description: "Wraps a label in a link to a target where the context links." })
);

/**
 * Everything a renderer needs to know about where its output is going.
 *
 * **Details**
 *
 * A renderer is a pure function of a document and one of these, so two contexts give two renderings of the
 * same document. `paint` and `link` are plain functions: a context for a stream with no colour passes the
 * identity, and one whose hyperlinks are off passes a `link` that returns its label unchanged.
 *
 * **Example** (Inspect the schema)
 *
 * ```ts
 * import { RenderContext } from "@beep/cli-kit/Render"
 *
 * console.log(typeof RenderContext.make) // function
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export class RenderContext extends S.Opaque<RenderContext, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Who the output is for. */
    audience: AudienceKind.pipe(
      $I.annoteKey("RenderContext.audience", { description: "The audience field of RenderContext." })
    ),
    /** The colour level of the stream being written. */
    color: ColorLevel.pipe($I.annoteKey("RenderContext.color", { description: "The color field of RenderContext." })),
    /** Turns an absolute path into its display form; the identity by default. */
    displayPath: DisplayPath.pipe(
      $I.annoteKey("RenderContext.displayPath", { description: "The displayPath field of RenderContext." })
    ),
    /** The glyph set: status glyphs, separators, the ellipsis. */
    glyphs: GlyphSet.pipe($I.annoteKey("RenderContext.glyphs", { description: "The glyphs field of RenderContext." })),
    /**
     * Wraps a label as a link to a target; returns the label unchanged when links are off.
     *
     * **Gotchas**
     *
     * It must be pure and cheap: a renderer may call it more than once for one link. `Render.ansi` calls it once with
     * the plain label to learn whether links are on (an unchanged label means off, and the target is then written
     * after the label), and again when it paints, with the painted label. So it must decide on whether links are
     * allowed, not on the label's content, and it must not count or record its calls.
     */
    link: RenderContextLink.pipe(
      $I.annoteKey("RenderContext.link", { description: "The link field of RenderContext." })
    ),
    /**
     * A base URL for file links in markdown, such as `https://github.com/<owner>/<repo>/blob/<sha>/`. When set,
     * `Render.markdown` links a `{ file }` target to the base followed by its display path (`displayPath`, URL-encoded,
     * without a leading `/`) and `#L<line>` when it has a line, in place of a `file://` URL a step summary's reader
     * cannot open. The other renderers do not read it.
     */
    linkBase: S.optionalKey(S.String).pipe(
      $I.annoteKey("RenderContext.linkBase", { description: "The linkBase field of RenderContext." })
    ),
    /**
     * Whether the output will be read by the GitHub Actions runner, which has two command parsers: a line is a command
     * if, after .NET whitespace, it starts with `::`, or if `##[` occurs ANYWHERE in it (a bare `##` is not one). When
     * `true`, `plain`, `ansi` and `markdown` put a zero-width space in front of such a `::` line and between `##` and
     * `[` at each `##[`, so a document's text, an error message, say, can never inject a command. Unset or `false`
     * leaves their text alone. `Render.githubLog` ignores it and always neutralizes: its output is for the runner by
     * definition.
     *
     * **Details**
     *
     * The trigger is the runner, not the audience: a person or an agent whose output lands in an Actions log is read
     * by it just the same. `Render.context` sets it when `CurrentRuntimeEnv` says GitHub Actions.
     */
    neutralizeWorkflowCommands: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("RenderContext.neutralizeWorkflowCommands", {
        description: "The neutralizeWorkflowCommands field of RenderContext.",
      })
    ),
    /** Paints text in a token or a style; the identity at colour `none`. */
    paint: StreamTheme.fields.paint.pipe(
      $I.annoteKey("RenderContext.paint", { description: "The paint field of RenderContext." })
    ),
    /**
     * The display columns available.
     *
     * **Details**
     *
     * `Infinity` is no limit. A renderer clamps what it is given: zero or a negative width is 1, and `NaN` is 80.
     * `Render.context` gives a human writing to a terminal `TerminalEnv.width()`, which is the terminal's columns as
     * stdout reports them, even for a context built for `"stderr"` (core's `Terminal` has one width), and gives no limit
     * when the stream is not a terminal; pass `width` to override it.
     */
    width: AnyNumber.pipe($I.annoteKey("RenderContext.width", { description: "The width field of RenderContext." })),
  }).pipe($I.annoteSchema("RenderContext", { description: "Plain RenderContext data." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import type { RenderContext } from "@beep/cli-kit/Render"
 *
 * const accepts = (_value: RenderContext.Encoded) => true
 * console.log(typeof accepts) // function
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RenderContext {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof RenderContext.Encoded;
}

/**
 * **Example** (Validate plain options)
 *
 * ```ts
 * import { RenderContextOfOptions } from "@beep/cli-kit/Render"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(RenderContextOfOptions)({ audience: "agent" })) // true
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export class RenderContextOfOptions extends S.Opaque<RenderContextOfOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Who the output is for. An `agent` gets no escape of any kind, whatever the other options say. */
    audience: AudienceKind.pipe(
      $I.annoteKey("RenderContextOfOptions.audience", { description: "The audience field of RenderContextOfOptions." })
    ),
    /** The colour level; `none` by default, which paints nothing. */
    color: S.optionalKey(ColorLevel).pipe(
      $I.annoteKey("RenderContextOfOptions.color", { description: "The color field of RenderContextOfOptions." })
    ),
    /** Turns an absolute path into its display form; the identity by default. */
    displayPath: S.optionalKey(DisplayPath).pipe(
      $I.annoteKey("RenderContextOfOptions.displayPath", {
        description: "The displayPath field of RenderContextOfOptions.",
      })
    ),
    /** The glyph set; Unicode by default. */
    glyphs: S.optionalKey(GlyphSet).pipe(
      $I.annoteKey("RenderContextOfOptions.glyphs", { description: "The glyphs field of RenderContextOfOptions." })
    ),
    /** See {@link RenderContext.linkBase}; unset by default. */
    linkBase: S.optionalKey(S.String).pipe(
      $I.annoteKey("RenderContextOfOptions.linkBase", { description: "The linkBase field of RenderContextOfOptions." })
    ),
    /**
     * Hyperlinks: `off` (the default) leaves every label unlinked; a `CliLinksShape`, such as a `CliLinks` service's
     * value, makes OSC 8 hyperlinks through {@link CliLinks.linker}, for any audience but an agent.
     */
    links: S.optionalKey(S.Union([S.Literal("off"), LinksService])).pipe(
      $I.annoteKey("RenderContextOfOptions.links", { description: "The links field of RenderContextOfOptions." })
    ),
    /**
     * See {@link RenderContext.neutralizeWorkflowCommands}. `true` by default for a `ci` audience, whose output the
     * Actions runner may read (it is harmless elsewhere), and unset for the others; an explicit `false` always wins.
     */
    neutralizeWorkflowCommands: S.optionalKey(S.Boolean).pipe(
      $I.annoteKey("RenderContextOfOptions.neutralizeWorkflowCommands", {
        description: "The neutralizeWorkflowCommands field of RenderContextOfOptions.",
      })
    ),
    /** The display columns; unbounded (`Infinity`) by default. */
    width: S.optionalKey(AnyNumber).pipe(
      $I.annoteKey("RenderContextOfOptions.width", { description: "The width field of RenderContextOfOptions." })
    ),
  }).pipe($I.annoteSchema("RenderContextOfOptions", { description: "Plain RenderContextOfOptions data." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { RenderContextOfOptions } from "@beep/cli-kit/Render"
 * import * as S from "effect/Schema"
 *
 * const plain: RenderContextOfOptions.Encoded = { audience: "agent" }
 * console.log(S.is(RenderContextOfOptions)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RenderContextOfOptions {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof RenderContextOfOptions.Encoded;
}

/** A renderer's text, with workflow commands neutralized when the context says the runner is reading it. */
const guarded: {
  (text: string, ctx: RenderContext.Encoded): string;
  (ctx: RenderContext.Encoded): (text: string) => string;
} = dual(2, (text: string, ctx: RenderContext.Encoded): string =>
  ctx.neutralizeWorkflowCommands === true ? CommandNeutralizer.text(text) : text
);

/**
 * **Example** (Validate plain options)
 *
 * ```ts
 * import { RenderContextOptions } from "@beep/cli-kit/Render"
 * import * as S from "effect/Schema"
 *
 * console.log(S.is(RenderContextOptions)({ width: 100 })) // true
 * ```
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export class RenderContextOptions extends S.Opaque<RenderContextOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Turns an absolute path into its display form, for example relative to the working directory; the identity by default. */
    displayPath: S.optionalKey(DisplayPath).pipe(
      $I.annoteKey("RenderContextOptions.displayPath", {
        description: "The displayPath field of RenderContextOptions.",
      })
    ),
    /**
     * The display columns to lay out at. By default a human writing to a terminal gets `TerminalEnv.width()`, the
     * terminal's columns as stdout reports them even when the stream is `"stderr"`; a human whose stream is not a
     * terminal (a pipe, a file), an agent and a CI get no limit at all.
     */
    width: S.optionalKey(AnyNumber).pipe(
      $I.annoteKey("RenderContextOptions.width", { description: "The width field of RenderContextOptions." })
    ),
  }).pipe($I.annoteSchema("RenderContextOptions", { description: "Plain RenderContextOptions data." }))
) {}
/**
 * **Example** (Refer to the plain input)
 *
 * ```ts
 * import { RenderContextOptions } from "@beep/cli-kit/Render"
 * import * as S from "effect/Schema"
 *
 * const plain: RenderContextOptions.Encoded = { width: 100 }
 * console.log(S.is(RenderContextOptions)(plain)) // true
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RenderContextOptions {
  /** The plain, unbranded shape callers pass, so an object literal works.
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof RenderContextOptions.Encoded;
}

const contextPaint = (color: ColorLevel): RenderContext.Encoded["paint"] =>
  color === "none"
    ? dual(2, (_token: TokenName | Style.Encoded, text: string): string => text)
    : dual(2, (token: TokenName | Style.Encoded, text: string): string =>
        paintStyle(Token.resolve(token), color, text)
      );

const neutralizeOptions = (
  options: RenderContextOfOptions.Encoded
): { readonly neutralizeWorkflowCommands?: boolean } => {
  if (options.neutralizeWorkflowCommands ?? options.audience === "ci") return { neutralizeWorkflowCommands: true };
  return options.neutralizeWorkflowCommands === false ? { neutralizeWorkflowCommands: false } : {};
};

/**
 * Pure renderers of a document: `(doc, context) => string`.
 *
 * **Details**
 *
 * A renderer has no environment and no effects, so the same document and context always give the same string.
 * {@link Render.plain} is for agents; the rest of the set follows.
 *
 * **Example** (Render check results as plain text)
 *
 * ```ts
 * import { Doc } from "@beep/cli-kit/Doc"
 * import { Render } from "@beep/cli-kit/Render"
 *
 * const doc = [Doc.heading(2, "Results"), Doc.paragraph("3 checks passed")]
 * const ctx = Render.contextOf({ audience: "agent" })
 *
 * console.log(Render.plain(doc, ctx)) // Results\n3 checks passed
 * ```
 *
 * @public
 * @category formatting
 * @since 0.0.0
 */
export class Render {
  private constructor() {}

  /**
   * The {@link RenderContext} for a stream, from the services a CLI already has.
   *
   * **Details**
   *
   * Everything is read once, here, so the renderers stay pure:
   *
   * - `audience` is the `Audience` in force, so an audience flag is honoured;
   * - `color`, `paint` and `glyphs` are the `CliTheme`'s for THAT stream, so redirecting stdout does not quiet
   *   stderr; except that an agent's `color` is `none` and its `paint` the identity, so no renderer, `ansi` included,
   *   writes an escape for an agent whatever the terminal could do;
   * - `link` is `CliLinks.linker` over that stream's hyperlink support and the audience, so an agent never
   *   gets an escape and a terminal without OSC 8 gets the label;
   * - `neutralizeWorkflowCommands` is set when `CurrentRuntimeEnv` says GitHub Actions (read if present, not
   *   required), for every audience, since the runner reads whatever is written there;
   * - `width` is the option, else `TerminalEnv.width()` for a human whose stream is a terminal, and **unbounded**
   *   (`Infinity`) for a human whose stream is not one (`tool | grep`, `tool > out.txt`), an agent or a CI, so nothing
   *   a reader needs is truncated or wrapped for a terminal that is not there: a pipe has no width to honour.
   *
   * **Example** (Construct a stream context effect)
   *
   * ```ts
   * import { Render } from "@beep/cli-kit/Render"
   * import * as Effect from "effect/Effect"
   *
   * const program = Render.context("stderr", { width: 80 })
   * console.log(Effect.isEffect(program)) // true
   * ```
   *
   * @param stream - the stream the output is for
   * @param options - an explicit width and a path display function
   * @category formatting
   * @since 0.0.0
   */
  static readonly context: {
    (
      stream: "stdout" | "stderr",
      options?: RenderContextOptions.Encoded
    ): Effect.Effect<RenderContext.Encoded, never, CliTheme | TerminalEnv | Audience | CliLinks>;
    (
      options?: RenderContextOptions.Encoded
    ): (
      stream: "stdout" | "stderr"
    ) => Effect.Effect<RenderContext.Encoded, never, CliTheme | TerminalEnv | Audience | CliLinks>;
  } = dual(
    (args) => P.isString(args[0]),
    Effect.fn("Render.context")(function* (
      stream: "stdout" | "stderr",
      options?: RenderContextOptions.Encoded
    ): Effect.fn.Return<RenderContext.Encoded, never, CliTheme | TerminalEnv | Audience | CliLinks> {
      const terminal = yield* TerminalEnv;
      const { kind } = yield* Audience;
      const theme = (yield* CliTheme).forStream(stream);
      const seen = CliTheme.forAudience(theme, kind);
      const links = yield* CliLinks;
      // Read if the environment has it, as `Doc.print` does: GitHub Actions makes every format unable to inject a
      // workflow command, whoever the audience is.
      const underActions = yield* underGithubActions;
      return {
        ...(underActions ? { neutralizeWorkflowCommands: true } : {}),
        // A pipe or a file has no width to honour: wrapping at a guessed 80 only splits a line someone greps.
        width:
          options?.width ??
          (kind === "human" && terminal[stream].isTerminal ? terminal.width() : Number.POSITIVE_INFINITY),
        audience: kind,
        // An agent never gets an escape of any kind, so its context is colourless whatever the terminal says: every
        // renderer, including an explicit `ansi`, then writes none (the linker already refuses its hyperlinks).
        color: seen.color,
        paint: seen.paint,
        glyphs: theme.glyphs,
        link: CliLinks.linker({ links, hyperlinks: terminal[stream].hyperlinks, audience: kind }),
        displayPath: options?.displayPath ?? ((absolute: string) => absolute),
      };
    })
  );

  /**
   * A {@link RenderContext} from plain options, for a caller outside Effect, such as a test reporter or an Ink tree.
   *
   * **Details**
   *
   * Pure: nothing is read from the environment. The defaults are colour `none`, the identity paint, no links,
   * Unicode glyphs, unbounded width and the identity `displayPath`, so a context built from an audience alone renders
   * with no escape of any kind. A colour level paints with the default token styles. An `agent` is colourless and
   * unlinked whatever `color` and `links` say, as in {@link Render.context}.
   *
   * **Example** (Build an escape-free agent context)
   *
   * ```ts
   * import { Render } from "@beep/cli-kit/Render"
   *
   * const ctx = Render.contextOf({ audience: "agent", color: "basic" })
   * console.log(ctx.color) // none
   * ```
   *
   * @param options - the audience, and the colour, glyphs, width, path display, links, neutralizing and link base
   * @category formatting
   * @since 0.0.0
   */
  static readonly contextOf = (options: RenderContextOfOptions.Encoded): RenderContext.Encoded => {
    const agent = options.audience === "agent";
    const color: ColorLevel = agent ? "none" : (options.color ?? "none");
    const links = agent ? "off" : (options.links ?? "off");
    return {
      width: options.width ?? Number.POSITIVE_INFINITY,
      audience: options.audience,
      color,
      paint: contextPaint(color),
      glyphs: options.glyphs ?? Glyphs.unicode,
      link:
        links === "off"
          ? dual(2, (_target: LinkTargetInput, label: string): string => label)
          : CliLinks.linker({ links, hyperlinks: true, audience: options.audience }),
      displayPath: options.displayPath ?? ((absolute: string) => absolute),
      // A ci audience may be read by the Actions runner, and neutralizing is harmless anywhere else.
      ...neutralizeOptions(options),
      ...O.getSomesStruct({ linkBase: O.fromUndefinedOr(options.linkBase) }),
    };
  };

  /**
   * Render a document as plain text for an agent.
   *
   * **Details**
   *
   * There are no escape sequences of any kind, whatever the context's colour or hyperlinks allow: `paint` and
   * `link` are never called, and a control character in a document's text is removed. The audience is treated as
   * `agent`, so a path joins with ` > `.
   *
   * - A heading is its text alone, code is in backticks, and a link is its label followed by the target in
   *   parentheses, as `path:line:col` through `displayPath` for a file, unless the label already is the target.
   * - A paragraph wraps to the width and is never truncated; a word longer than the width, such as a URL, stays
   *   whole on its own line.
   * - A list uses `- ` items, and past its cap the overflow row. A table is aligned text columns with a rule under
   *   the header; a short row is padded with empty cells, a cell holding line breaks shows its first line and an
   *   ellipsis, and cells are truncated only when the table is wider than the context, widest column first. A tree uses the glyph set's tree segments.
   * - A collapsible is its title and the indented body, a callout its upper-case kind and the body, a code block
   *   four-space indented, and a diff `- expected` lines then `+ received` lines, the cap limiting each side.
   * - Counts take their total and their visible counters from {@link Doc.total} and {@link Doc.visibleCounters}.
   *   Inline gives `3/5 passed, 1 failed (1.2s)`: the first counter is the headline and shows its share of the
   *   total, unless `share` is `false`. Columns gives aligned label and number pairs, and row one line of cells.
   * - A link with `suffix: false` never has its target after the label, and one with `suffix: true` always does.
   * - Verbatim text is its lines exactly, each indented by `indent` spaces, never wrapped; an annotation is nothing.
   * - Strong and emphasised content is its text; a file is its display path, unlinked. `Lines` are one line per entry,
   *   a `Line` with `truncate` is cut to the width with the ellipsis, and diff text is its lines as given, the cap
   *   followed by `… N more lines`. A counts table is a table with a column per counter key and the total row last,
   *   and a counts `suffix` follows the duration.
   * - A compact list has no blank lines inside an item. A `style: "pipe"` table is istanbul's shape: a rule of dashes
   *   meeting at `|` above and below the header and at the end, and cells joined with ` | `.
   * - Top-level blocks are consecutive lines; a section separates its title and children with blank lines.
   *
   * **Example** (Render an agent paragraph)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   * import { Render } from "@beep/cli-kit/Render"
   *
   * const doc = [Doc.paragraph("Ready")]
   * const ctx = Render.contextOf({ audience: "agent" })
   * console.log(Render.plain(doc, ctx)) // Ready
   * ```
   *
   * @param doc - the document
   * @param ctx - where the output is going
   * @category formatting
   * @since 0.0.0
   */
  static readonly plain: {
    (doc: Document, ctx: RenderContext.Encoded): string;
    (ctx: RenderContext.Encoded): (doc: Document) => string;
  } = dual(2, (doc: Document, ctx: RenderContext.Encoded): string => guarded(renderPlain(doc, ctx), ctx));

  /**
   * Render a document for a person: the same layout as {@link Render.plain}, painted and linked.
   *
   * **Details**
   *
   * The context's `paint` and `link` do the styling, so a context at colour `none` with links off gives exactly
   * what `plain` gives, apart from two things: code has no backticks (it is painted `accent` instead), and a path
   * joins with the audience's separator (`›` for a person) rather than ` > `. Tokens:
   *
   * - headings, section and collapsible titles, and table headers are `emphasis`; the rule under a header, tree
   *   lines and overflow rows are `muted`;
   * - a status glyph takes its definition's token, and a diff's `-` lines are `failure` and `+` lines `success`;
   * - a callout's label takes its kind's token (`note` info, `tip` success, `important` accent, `warning` warning,
   *   `caution` error), and a counter the token of its status, with the qualifier, the duration and the suffix `muted`.
   *   A `Counts` with `paint: "none"` paints none of it, and with `paint: "glyph"` only a status glyph.
   * - strong content is bold and emphasised content italic, over any token it has; in diff text a `+` line is
   *   `success` and a `-` line `failure`; a counts table's counts take their status's token.
   *
   * A link goes through `ctx.link`, which makes an OSC 8 hyperlink only when the policy allows it. When it does
   * not (it returns the label unchanged), the target follows the label in parentheses, muted, as in plain text.
   *
   * Text is cut and wrapped before it is painted, so a colour or a hyperlink is never cut in half, and a table
   * cut to the width keeps the colour of what remains. Tables are plain aligned columns, never box drawing:
   * box drawing costs two columns of every row for nothing a rule and the padding do not already say, and it
   * cannot be matched to plain text.
   *
   * **Example** (Render without color or links)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   * import { Render } from "@beep/cli-kit/Render"
   *
   * const doc = [Doc.paragraph("Ready")]
   * const ctx = Render.contextOf({ audience: "agent" })
   * console.log(Render.ansi(doc, ctx)) // Ready
   * ```
   *
   * @param doc - the document
   * @param ctx - where the output is going
   * @category formatting
   * @since 0.0.0
   */
  static readonly ansi: {
    (doc: Document, ctx: RenderContext.Encoded): string;
    (ctx: RenderContext.Encoded): (doc: Document) => string;
  } = dual(2, (doc: Document, ctx: RenderContext.Encoded): string => guarded(renderAnsi(doc, ctx), ctx));

  /**
   * Render a document as GitHub-flavoured markdown, for a step summary or a file.
   *
   * **Details**
   *
   * There is no ANSI and no OSC 8 (`paint` and `link` are never called), and the width does not apply: a reader
   * wraps. Everything a document carries as text is escaped so that it cannot become markdown: the characters
   * that mean something, `|` everywhere so text can never form a table, the marker at the start of a line (a
   * heading, bullet, setext underline or ordered item) and the start of an autolink (a URL scheme or `www.`). An
   * email address is not escaped: a reader may make a `mailto:` link of it, which is harmless. A leading indent is
   * dropped, since markdown would read it as code.
   *
   * Under GitHub Actions (`neutralizeWorkflowCommands`) the same neutralizing applies, since markdown can be printed
   * to the log. Markdown escapes `[` in text, so `##[` cannot appear outside code and the headings are untouched
   * (a bare `##` is not a command); code spans and blocks, which are not escaped, get the zero-width space, which can
   * also land inside code or table text where it would otherwise have formed a command.
   *
   * GitHub also turns `@user`, `@org/team`, `#123` and commit SHAs in rendered markdown into mentions and references.
   * Nothing here escapes them: in a step summary they do not notify, but markdown posted as a comment could ping
   * whoever the text names.
   *
   * - A heading is `#` repeated by its level. A section's title is a heading of level 2 for a section at the top,
   *   one deeper for each section nested inside it, to level 6.
   * - A table is a GFM pipe table: `|` is `\|` in a cell and a line break in a cell is `<br>`. A short row is
   *   padded and a long one widens the table. With no header, the header row is empty.
   * - A collapsible is `<details><summary>title</summary>`, a blank line, the body as markdown, a blank line and
   *   `</details>`. The title is HTML, so it is HTML-escaped and plain.
   * - A callout is a quoted `[!KIND]` followed by its body. A code block is a fence longer than any backtick run it
   *   holds, and a diff a `diff` fence of `-` and `+` lines.
   * - A link is `[label](url)` when it has a URL a reader can follow: an `http`, `https`, `mailto`, `file` or
   *   `vscode` URL, or a relative one. A file link has one when its path is absolute (`file://`). Otherwise, such as
   *   for a `javascript:` URL or a relative file path, it is the label followed by the target in inline code, as
   *   `path:line:col` for a file.
   * - A list is bullets, a tree a nested bullet list under its root label, and overflow rows paragraphs after what
   *   they cap. Counts inline is a paragraph, columns a list of `label: n` and row a one-row table of the counter
   *   labels over their numbers, every header named (the duration as `duration`), with the label above the table and
   *   the qualifier and suffix below it.
   * - Verbatim text is a fenced code block, so its indentation survives; an annotation is nothing.
   * - Strong content is `**…**` and emphasised `*…*`, which GFM reads inside a word too, with the spaces at a run's
   *   edges kept outside the markers. `Lines` are one paragraph with a hard break between entries, an empty entry
   *   between two others an empty line (one at either end is dropped); a `Line` is one
   *   paragraph; diff text a `diff` fence; a counts table a pipe table; a file is its display path as text.
   * - With `linkBase`, a file link goes to the base and the display path, plus `#L<line>`, in place of `file://`. A
   *   display path that is absolute or climbs out with `..` is not under the base, so its link has no URL form.
   * - A compact list item joins its parts with no blank line, putting a hard break where two paragraphs would merge.
   *   A row of counts names its duration column `duration`.
   *
   * **Example** (Render a Markdown heading)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   * import { Render } from "@beep/cli-kit/Render"
   *
   * const doc = [Doc.heading(2, "Results")]
   * const ctx = Render.contextOf({ audience: "agent" })
   * console.log(Render.markdown(doc, ctx)) // ## Results
   * ```
   *
   * @param doc - the document
   * @param ctx - where the output is going; its glyph set, audience and `displayPath` are used
   * @category formatting
   * @since 0.0.0
   */
  static readonly markdown: {
    (doc: Document, ctx: RenderContext.Encoded): string;
    (ctx: RenderContext.Encoded): (doc: Document) => string;
  } = dual(2, (doc: Document, ctx: RenderContext.Encoded): string => guarded(renderMarkdown(doc, ctx), ctx));

  /**
   * Render a document for a GitHub Actions log.
   *
   * **Details**
   *
   * Everything is what {@link Render.plain} renders, except an annotation, which is one workflow command
   * (`::error file=…,line=…::message`), and a collapsible that starts a line, which is a group: `::group::title`, its
   * body, `::endgroup::`. An annotation is a command at the top level, as a top-level section's child, and as a direct
   * child of a group's body; anywhere deeper (inside a list, a callout, or a section within a group) it is nothing,
   * as in plain. Its message and properties are escaped, so no text can end
   * the command or start another, and the kit's own command is never neutralized. That is a top-level collapsible, or one that is a direct child of a
   * top-level section. GitHub does not nest groups, so a collapsible inside a group, or inside a list or callout
   * (where it would not start a line), keeps plain's rendering: its title on a line and its body indented.
   *
   * The runner has two command parsers, and a line is a command if either accepts it: after its leading whitespace it
   * starts with `::`, or `##[` occurs ANYWHERE in it (a bare `##` is not one). A document's text must not be able to
   * do that (`::add-mask::`, `::error::`, `##[error]`), so such a `::` line gets a zero-width space in front, which
   * the runner does not treat as whitespace, and every `##[` gets one between the `##` and the `[`. The text is
   * otherwise unchanged. A
   * group's title is a command's data, so its `%`, CR and LF are escaped. Lines are split at CR, LF and CRLF before
   * that check, as the runner splits them. There is no ANSI and `paint` and `link` are never called, and the audience
   * is treated as `agent`, as `plain` does.
   *
   * **Example** (Render a workflow annotation)
   *
   * ```ts
   * import { Doc } from "@beep/cli-kit/Doc"
   * import { Render } from "@beep/cli-kit/Render"
   *
   * const doc = [Doc.annotation({ level: "error", file: "src/main.ts", line: 1 }, "Invalid input")]
   * const ctx = Render.contextOf({ audience: "agent" })
   * console.log(Render.githubLog(doc, ctx)) // ::error file=src/main.ts,line=1::Invalid input
   * ```
   *
   * @param doc - the document
   * @param ctx - where the output is going; the width, glyph set and `displayPath` are used as plain uses them
   * @category formatting
   * @since 0.0.0
   */
  static readonly githubLog: {
    (doc: Document, ctx: RenderContext.Encoded): string;
    (ctx: RenderContext.Encoded): (doc: Document) => string;
  } = dual(2, (doc: Document, ctx: RenderContext.Encoded): string => renderGithubLog(doc, ctx));
}
