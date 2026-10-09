import type { AudienceKind, ColorLevel } from "../env/index.ts";
import { Audience, TerminalEnv } from "../env/index.ts";
import { CommandNeutralizer } from "../github-commands/index.ts";
import * as Effect from "effect/Effect";
import type { CliLinksShape } from "./CliLinks.ts";
import { CliLinks } from "./CliLinks.ts";
import { CliTheme } from "./CliTheme.ts";
import type { Document, LinkTarget } from "./Doc.ts";
import type { GlyphSet } from "./Glyphs.ts";
import { Glyphs } from "./Glyphs.ts";
import { paintStyle } from "./internal/ansi.ts";
import { underGithubActions } from "./internal/autoFormat.ts";
import { renderAnsi } from "./internal/renderAnsi.ts";
import { renderGithubLog } from "./internal/renderGithubLog.ts";
import { renderMarkdown } from "./internal/renderMarkdown.ts";
import { renderPlain } from "./internal/renderPlain.ts";
import type { Style, TokenName } from "./Token.ts";
import { Token } from "./Token.ts";

/**
 * Everything a renderer needs to know about where its output is going.
 *
 * @remarks
 * A renderer is a pure function of a document and one of these, so two contexts give two renderings of the
 * same document. `paint` and `link` are plain functions: a context for a stream with no colour passes the
 * identity, and one whose hyperlinks are off passes a `link` that returns its label unchanged.
 *
 * @public
 */
export interface RenderContext {
	/**
	 * The display columns available.
	 *
	 * @remarks
	 * `Infinity` is no limit. A renderer clamps what it is given: zero or a negative width is 1, and `NaN` is 80.
	 * `Render.context` gives a human writing to a terminal `TerminalEnv.width()`, which is the terminal's columns as
	 * stdout reports them, even for a context built for `"stderr"` (core's `Terminal` has one width), and gives no limit
	 * when the stream is not a terminal; pass `width` to override it.
	 */
	readonly width: number;
	/** Who the output is for. */
	readonly audience: AudienceKind;
	/** The colour level of the stream being written. */
	readonly color: ColorLevel;
	/** Paints text in a token or a style; the identity at colour `none`. */
	readonly paint: (token: TokenName | Style, text: string) => string;
	/** The glyph set: status glyphs, separators, the ellipsis. */
	readonly glyphs: GlyphSet;
	/**
	 * Wraps a label as a link to a target; returns the label unchanged when links are off.
	 *
	 * @remarks
	 * It must be pure and cheap: a renderer may call it more than once for one link. `Render.ansi` calls it once with
	 * the plain label to learn whether links are on (an unchanged label means off, and the target is then written
	 * after the label), and again when it paints, with the painted label. So it must decide on whether links are
	 * allowed, not on the label's content, and it must not count or record its calls.
	 */
	readonly link: (target: LinkTarget, label: string) => string;
	/** Turns an absolute path into its display form; the identity by default. */
	readonly displayPath: (absolute: string) => string;
	/**
	 * Whether the output will be read by the GitHub Actions runner, which has two command parsers: a line is a command
	 * if, after .NET whitespace, it starts with `::`, or if `##[` occurs ANYWHERE in it (a bare `##` is not one). When
	 * `true`, `plain`, `ansi` and `markdown` put a zero-width space in front of such a `::` line and between `##` and
	 * `[` at each `##[`, so a document's text, an error message, say, can never inject a command. Unset or `false`
	 * leaves their text alone. `Render.githubLog` ignores it and always neutralizes: its output is for the runner by
	 * definition.
	 *
	 * @remarks
	 * The trigger is the runner, not the audience: a person or an agent whose output lands in an Actions log is read
	 * by it just the same. `Render.context` sets it when `CurrentRuntimeEnv` says GitHub Actions.
	 */
	readonly neutralizeWorkflowCommands?: boolean | undefined;
	/**
	 * A base URL for file links in markdown, such as `https://github.com/<owner>/<repo>/blob/<sha>/`. When set,
	 * `Render.markdown` links a `{ file }` target to the base followed by its display path (`displayPath`, URL-encoded,
	 * without a leading `/`) and `#L<line>` when it has a line, in place of a `file://` URL a step summary's reader
	 * cannot open. The other renderers do not read it.
	 */
	readonly linkBase?: string | undefined;
}

/**
 * Options for {@link Render.contextOf}.
 *
 * @public
 */
export interface RenderContextOfOptions {
	/** Who the output is for. An `agent` gets no escape of any kind, whatever the other options say. */
	readonly audience: AudienceKind;
	/** The colour level; `none` by default, which paints nothing. */
	readonly color?: ColorLevel | undefined;
	/** The glyph set; Unicode by default. */
	readonly glyphs?: GlyphSet | undefined;
	/** The display columns; unbounded (`Infinity`) by default. */
	readonly width?: number | undefined;
	/** Turns an absolute path into its display form; the identity by default. */
	readonly displayPath?: ((absolute: string) => string) | undefined;
	/**
	 * Hyperlinks: `off` (the default) leaves every label unlinked; a `CliLinksShape`, such as a `CliLinks` service's
	 * value, makes OSC 8 hyperlinks through {@link CliLinks.linker}, for any audience but an agent.
	 */
	readonly links?: "off" | CliLinksShape | undefined;
	/**
	 * See {@link RenderContext.neutralizeWorkflowCommands}. `true` by default for a `ci` audience, whose output the
	 * Actions runner may read (it is harmless elsewhere), and unset for the others; an explicit `false` always wins.
	 */
	readonly neutralizeWorkflowCommands?: boolean | undefined;
	/** See {@link RenderContext.linkBase}; unset by default. */
	readonly linkBase?: string | undefined;
}

/** A renderer's text, with workflow commands neutralized when the context says the runner is reading it. */
const guarded = (text: string, ctx: RenderContext): string =>
	ctx.neutralizeWorkflowCommands === true ? CommandNeutralizer.text(text) : text;

/**
 * Options for {@link Render.context}.
 *
 * @public
 */
export interface RenderContextOptions {
	/**
	 * The display columns to lay out at. By default a human writing to a terminal gets `TerminalEnv.width()`, the
	 * terminal's columns as stdout reports them even when the stream is `"stderr"`; a human whose stream is not a
	 * terminal (a pipe, a file), an agent and a CI get no limit at all.
	 */
	readonly width?: number | undefined;
	/** Turns an absolute path into its display form, for example relative to the working directory; the identity by default. */
	readonly displayPath?: ((absolute: string) => string) | undefined;
}

/**
 * Pure renderers of a document: `(doc, context) => string`.
 *
 * @remarks
 * A renderer has no environment and no effects, so the same document and context always give the same string.
 * {@link Render.plain} is for agents; the rest of the set follows.
 *
 * @example
 * ```ts
 * import { Doc, Render } from "./index.ts"
 *
 * const doc = [Doc.heading(2, "Results"), Doc.paragraph("3 checks passed")]
 * const ctx = Render.contextOf({ audience: "agent" })
 *
 * Render.plain(doc, ctx)
 * // => "Results\n3 checks passed"
 * ```
 *
 * @public
 */
export class Render {
	private constructor() {}

	/**
	 * The {@link RenderContext} for a stream, from the services a CLI already has.
	 *
	 * @remarks
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
	 * @param stream - the stream the output is for
	 * @param options - an explicit width and a path display function
	 */
	static readonly context = (
		stream: "stdout" | "stderr",
		options?: RenderContextOptions,
	): Effect.Effect<RenderContext, never, CliTheme | TerminalEnv | Audience | CliLinks> =>
		Effect.gen(function* () {
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
		});

	/**
	 * A {@link RenderContext} from plain options, for a caller outside Effect, such as a test reporter or an Ink tree.
	 *
	 * @remarks
	 * Pure: nothing is read from the environment. The defaults are colour `none`, the identity paint, no links,
	 * Unicode glyphs, unbounded width and the identity `displayPath`, so a context built from an audience alone renders
	 * with no escape of any kind. A colour level paints with the default token styles. An `agent` is colourless and
	 * unlinked whatever `color` and `links` say, as in {@link Render.context}.
	 *
	 * @param options - the audience, and the colour, glyphs, width, path display, links, neutralizing and link base
	 */
	static readonly contextOf = (options: RenderContextOfOptions): RenderContext => {
		const agent = options.audience === "agent";
		const color: ColorLevel = agent ? "none" : (options.color ?? "none");
		const links = agent ? "off" : (options.links ?? "off");
		return {
			width: options.width ?? Number.POSITIVE_INFINITY,
			audience: options.audience,
			color,
			paint:
				color === "none"
					? (_token: TokenName | Style, text: string) => text
					: (token: TokenName | Style, text: string) => paintStyle(Token.resolve(token), color, text),
			glyphs: options.glyphs ?? Glyphs.unicode,
			link:
				links === "off"
					? (_target: LinkTarget, label: string) => label
					: CliLinks.linker({ links, hyperlinks: true, audience: options.audience }),
			displayPath: options.displayPath ?? ((absolute: string) => absolute),
			// A ci audience may be read by the Actions runner, and neutralizing is harmless anywhere else.
			...((options.neutralizeWorkflowCommands ?? options.audience === "ci")
				? { neutralizeWorkflowCommands: true }
				: options.neutralizeWorkflowCommands === false
					? { neutralizeWorkflowCommands: false }
					: {}),
			...(options.linkBase === undefined ? {} : { linkBase: options.linkBase }),
		};
	};

	/**
	 * Render a document as plain text for an agent.
	 *
	 * @remarks
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
	 * @param doc - the document
	 * @param ctx - where the output is going
	 */
	static readonly plain = (doc: Document, ctx: RenderContext): string => guarded(renderPlain(doc, ctx), ctx);

	/**
	 * Render a document for a person: the same layout as {@link Render.plain}, painted and linked.
	 *
	 * @remarks
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
	 * @param doc - the document
	 * @param ctx - where the output is going
	 */
	static readonly ansi = (doc: Document, ctx: RenderContext): string => guarded(renderAnsi(doc, ctx), ctx);

	/**
	 * Render a document as GitHub-flavoured markdown, for a step summary or a file.
	 *
	 * @remarks
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
	 * @param doc - the document
	 * @param ctx - where the output is going; its glyph set, audience and `displayPath` are used
	 */
	static readonly markdown = (doc: Document, ctx: RenderContext): string => guarded(renderMarkdown(doc, ctx), ctx);

	/**
	 * Render a document for a GitHub Actions log.
	 *
	 * @remarks
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
	 * @param doc - the document
	 * @param ctx - where the output is going; the width, glyph set and `displayPath` are used as plain uses them
	 */
	static readonly githubLog = (doc: Document, ctx: RenderContext): string => renderGithubLog(doc, ctx);
}
