// Root types are named through the package's own name, so the emitted ui.d.ts imports them from "../index.ts".
import type * as Cli from "../index.ts";
import type { FunctionComponent, ReactElement } from "react";
import { Render } from "../Render.ts";
import { fromReact, inkModules } from "./internal/ink.ts";
import { screenContext } from "./internal/ScreenContext.ts";
import { useTerminalSize } from "./UiTheme.ts";

/**
 * Props of {@link DocView}.
 *
 * @public
 */
export interface DocViewProps {
	/** The document, or one block of it, which is drawn as a one-block document. */
	readonly doc: Cli.Document | Cli.Block;
	/**
	 * The render context. Omitted, it is built from the tree's theme (`useTheme`): its colour, its `paint` (token
	 * overrides included) and its glyphs, the width `useTerminalSize().columns`, a human audience, links off, the
	 * identity `displayPath`, and `neutralizeWorkflowCommands` when the tree is under the GitHub Actions runner. Given,
	 * it replaces that context entirely, neutralizing included (set `neutralizeWorkflowCommands` on it when the runner
	 * reads the output), and the view needs no provider.
	 */
	readonly ctx?: Cli.RenderContext;
}

const OUTSIDE =
	"@effected/cli/ui: DocView was drawn with no ctx outside a screen, a live view or a UiProvider, so it has no theme";

/** The context a `DocView` builds from its tree's theme: the theme's own paint, so token overrides hold. */
const contextOf = (theme: Cli.StreamTheme, width: number, neutralize: boolean): Cli.RenderContext => ({
	...(neutralize ? { neutralizeWorkflowCommands: true } : {}),
	width,
	audience: "human",
	color: theme.color,
	paint: theme.paint,
	glyphs: theme.glyphs,
	link: (_target, label) => label,
	displayPath: (absolute) => absolute,
});

/** The document's lines as the kit's own renderer lays them out: plain at colour `none`, painted otherwise. */
const linesOf = (doc: Cli.Document | Cli.Block, ctx: Cli.RenderContext): ReadonlyArray<string> => {
	const document: Cli.Document = Array.isArray(doc) ? doc : [doc as Cli.Block];
	const text = ctx.color === "none" ? Render.plain(document, ctx) : Render.ansi(document, ctx);
	return text === "" ? [] : text.split("\n");
};

/** The view, memoised on its props and built on the loaded React, like every kit component. */
const docView: () => FunctionComponent<DocViewProps> = fromReact((react) => {
	const View = (props: DocViewProps): ReactElement => {
		const { ink } = inkModules();
		const screen = react.useContext(screenContext());
		const { columns } = useTerminalSize();
		const given = props.ctx;
		const theme = screen?.theme;
		const neutralize = screen?.neutralizeWorkflowCommands === true;
		if (given === undefined && theme === undefined) throw new Error(OUTSIDE);
		const ctx = react.useMemo(
			() => given ?? contextOf(theme as Cli.StreamTheme, columns, neutralize),
			[given, theme, columns, neutralize],
		);
		// Laid out once per document and context: a live view's tick redraws with the same document.
		const lines = react.useMemo(() => linesOf(props.doc, ctx), [props.doc, ctx]);
		return react.createElement(
			ink.Box,
			// Its own height, whatever its parent's: a parent that clips shows the first rows, never a squeezed sample.
			{ flexDirection: "column", flexShrink: 0 },
			...lines.map((line, index) =>
				// Each row is cut, never re-wrapped by Ink: the kit's renderer has already laid it out at the width. An empty
				// row is a space, which Ink keeps as a row.
				react.createElement(ink.Text, { key: index, wrap: "truncate-end" }, line === "" ? " " : line),
			),
		);
	};
	View.displayName = "CliUiDocView";
	return react.memo(View) as unknown as FunctionComponent<DocViewProps>;
});

/**
 * The kit's document IR (`Doc`) drawn as Ink rows, laid out by the kit's own renderers, so a live view and a static
 * report show a document the same way.
 *
 * @remarks
 * The document is rendered with `Render.ansi` (`Render.plain` at colour `none`) at the width, and each line becomes
 * one Ink `Text` row cut with `wrap: "truncate-end"`, so Ink never re-wraps what the renderer laid out. Everything the
 * static renderers do holds: a collapsible is drawn open, an annotation is skipped, text from data is sanitised.
 *
 * Without a `ctx` the view takes its theme from the tree (a screen, a live view, or a `UiProvider`) and its width from
 * `useTerminalSize`, so it follows a resize; for an agent the theme is colourless, so the view is escape-free. Links
 * are off. The layout is memoised on the document's identity and the context: re-render with the same document, as a
 * live view's tick does, and the renderer does not run again; build a new document only when it changes.
 *
 * @param props - the document, and optionally the render context
 *
 * @public
 */
export const DocView = (props: DocViewProps): ReactElement => inkModules().react.createElement(docView(), props);
