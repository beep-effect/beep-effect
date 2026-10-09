// The remark-ecosystem interop boundary: projection between this package's
// node classes and plain mdast JSON. The emission conventions are documented on
// the exported `Mdast` class.

import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { unescapeString } from "./internal/unescape.ts";
import type {
	FlowContent,
	Frontmatter,
	FrontmatterFormat,
	List,
	MarkdownNode,
	MdxJsxAttributeContent,
	PhrasingContent,
	Position,
} from "./MarkdownNode.ts";
import { Root } from "./MarkdownNode.ts";

/**
 * A plain mdast node: a `type` tag plus whatever fields that type carries.
 *
 * @remarks
 * Deliberately loose — plain-object mdast is a foreign, structurally-typed
 * contract; the precise shapes live in the mdast specification, and
 * {@link Mdast.fromMdast} is the checked way back into typed nodes.
 *
 * @public
 */
export interface MdastNode {
	readonly type: string;
	readonly [key: string]: unknown;
}

/**
 * Indicates that foreign mdast input failed to decode into the package's
 * node classes.
 *
 * @remarks
 * `issue` carries the **structured** schema failure — at runtime a
 * `SchemaIssue.Issue` tree, reachable through `_tag` and nested `issues` —
 * never a stringified rendering. It is typed `unknown` because core exposes
 * no `Schema` for `Issue`; narrow it with the `SchemaIssue` module.
 *
 * @public
 */
export class MdastDecodeError extends S.TaggedError<MdastDecodeError>()("MdastDecodeError", {
	/** The structured schema issue. Never a string. */
	issue: S.Defect(),
}) {
	override get message(): string {
		return "mdast input failed to decode into markdown nodes";
	}
}

/** The zero-width sentinel position synthesized for foreign nodes. */
const sentinelPosition = {
	start: { line: 1, column: 1, offset: 0 },
	end: { line: 1, column: 1, offset: 0 },
};

const projectPosition = (position: Position): Record<string, unknown> => ({
	start: { line: position.start.line, column: position.start.column, offset: position.start.offset },
	end: { line: position.end.line, column: position.end.column, offset: position.end.offset },
});

type AnyNode = Root | Frontmatter | FlowContent | PhrasingContent | MarkdownNode;

const projectChildren = (children: ReadonlyArray<AnyNode>): Array<Record<string, unknown>> =>
	children.map((child) => projectNode(child));

// This package's Code.value carries its final line terminator (the engine's
// convention); mdast-util-from-markdown stores the value
// without it and lets renderers re-add it. The projection translates: strip
// one final line ending going out, restore it coming back in.
const stripFinalLineEnding = (value: string): string =>
	value.endsWith("\r\n") ? value.slice(0, -2) : value.endsWith("\n") ? value.slice(0, -1) : value;

// mdast's Association rules that `label` is a *parsed* value — character
// escapes and character references decoded — while this package's nodes keep
// the label as written in source (the stringify layer depends on that). The
// projection decodes at the boundary; identifiers stay source-form per the
// same mixin.
const projectLabel = (label: string | undefined): Record<string, unknown> =>
	label === undefined ? {} : { label: unescapeString(label) };

// mdast's List.spread means "a blank line separates two of the list's
// items" — narrower than this package's List.spread fidelity field, which
// records CommonMark looseness (a blank line between items OR between the
// blocks inside one item; the rendering contract). The between-items reading
// is recomputable from item positions, so the projection derives it instead
// of forwarding the looseness bit.
const listSpread = (node: List): boolean => {
	for (let index = 0; index + 1 < node.children.length; index += 1) {
		const current = node.children[index];
		const next = node.children[index + 1];
		if (current !== undefined && next !== undefined && next.position.start.line - current.position.end.line >= 2) {
			return true;
		}
	}
	return false;
};

// One arm per node type. Field order mirrors mdast-util-from-markdown's
// emission for readability of test diffs; deep equality does not depend on it.
const projectNode = (node: AnyNode): Record<string, unknown> => {
	const position = projectPosition(node.position);
	switch (node.type) {
		case "root":
			return { type: "root", children: projectChildren(node.children), position };
		case "paragraph":
		case "blockquote":
		case "emphasis":
		case "strong":
		case "delete":
		case "tableRow":
		case "tableCell":
			return { type: node.type, children: projectChildren(node.children), position };
		case "heading":
			return { type: "heading", depth: node.depth, children: projectChildren(node.children), position };
		case "text":
			return {
				type: "text",
				value: node.value,
				...(node.escapeStyle === undefined ? {} : { escapeStyle: node.escapeStyle }),
				position,
			};
		case "html":
		case "inlineCode":
			return { type: node.type, value: node.value, position };
		case "break":
		case "thematicBreak":
			return { type: node.type, position };
		case "code":
			return {
				type: "code",
				lang: node.lang ?? null,
				meta: node.meta ?? null,
				value: stripFinalLineEnding(node.value),
				position,
			};
		case "link":
			return {
				type: "link",
				title: node.title ?? null,
				url: node.url,
				children: projectChildren(node.children),
				position,
			};
		case "image":
			return { type: "image", title: node.title ?? null, url: node.url, alt: node.alt ?? "", position };
		case "linkReference":
			return {
				type: "linkReference",
				children: projectChildren(node.children),
				position,
				...projectLabel(node.label),
				identifier: node.identifier,
				referenceType: node.referenceType,
			};
		case "imageReference":
			return {
				type: "imageReference",
				alt: node.alt ?? "",
				position,
				...projectLabel(node.label),
				identifier: node.identifier,
				referenceType: node.referenceType,
			};
		case "definition":
			return {
				type: "definition",
				identifier: node.identifier,
				...projectLabel(node.label),
				title: node.title ?? null,
				url: node.url,
				position,
			};
		case "footnoteReference":
			return {
				type: "footnoteReference",
				identifier: node.identifier,
				...projectLabel(node.label),
				position,
			};
		case "footnoteDefinition":
			return {
				type: "footnoteDefinition",
				identifier: node.identifier,
				...projectLabel(node.label),
				children: projectChildren(node.children),
				position,
			};
		case "list":
			return {
				type: "list",
				ordered: node.ordered ?? false,
				start: node.start ?? null,
				spread: listSpread(node),
				children: projectChildren(node.children),
				position,
			};
		case "listItem":
			return {
				type: "listItem",
				spread: node.spread ?? false,
				checked: node.checked ?? null,
				children: projectChildren(node.children),
				position,
			};
		case "table":
			return {
				type: "table",
				align: node.align === undefined ? null : [...node.align],
				children: projectChildren(node.children),
				position,
			};
		case "frontmatter":
			return { type: node.format, value: node.value, position };
		case "mdxJsxFlowElement":
		case "mdxJsxTextElement":
			return {
				type: node.type,
				name: node.name,
				attributes: node.attributes.map((attribute) => projectMdxAttribute(attribute)),
				children: projectChildren(node.children),
				position,
			};
		case "mdxFlowExpression":
		case "mdxTextExpression":
		case "mdxjsEsm":
			return { type: node.type, value: node.value, position };
	}
};

// mdast-util-mdx spells a bare attribute's value as explicit `null` (its
// parser writes it, "as it serializes in JSON"), and puts NO position on an
// attribute value expression — both mirrored here so the output deep-equals
// the reference utilities' trees.
const projectMdxAttribute = (attribute: MdxJsxAttributeContent): Record<string, unknown> => {
	if (attribute.type === "mdxJsxExpressionAttribute") {
		return {
			type: "mdxJsxExpressionAttribute",
			value: attribute.value,
			position: projectPosition(attribute.position),
		};
	}
	const value = attribute.value;
	return {
		type: "mdxJsxAttribute",
		name: attribute.name,
		value:
			value === undefined || value === null
				? null
				: typeof value === "string"
					? value
					: { type: "mdxJsxAttributeValueExpression", value: value.value },
		position: projectPosition(attribute.position),
	};
};

/** The frontmatter literal node types foreign mdast spells per format. */
const frontmatterTypes: ReadonlyMap<string, FrontmatterFormat> = new Map([
	["yaml", "yaml"],
	["toml", "toml"],
	["json", "json"],
]);

/**
 * Fields admitted per foreign node type, beyond `type`/`position`/`children`.
 * Unknown fields (`data`, custom extensions) are dropped at the boundary;
 * `null` values on optional fields normalize to absence per unist's
 * null-equals-absent convention.
 */
const admittedFields: Readonly<Record<string, ReadonlyArray<string>>> = {
	root: [],
	paragraph: [],
	blockquote: [],
	emphasis: [],
	strong: [],
	delete: [],
	tableRow: [],
	tableCell: [],
	break: [],
	thematicBreak: [],
	// `escapeStyle` is this package's emitter instruction, not spec mdast,
	// but it is the one extra a plain tree must be able to carry in: a
	// consumer building mdast for `Markdown.stringify` has no decoded node to
	// set it on until after admission.
	text: ["value", "escapeStyle"],
	html: ["value"],
	inlineCode: ["value"],
	heading: ["depth"],
	code: ["value", "lang", "meta"],
	link: ["url", "title"],
	image: ["url", "title", "alt"],
	linkReference: ["identifier", "label", "referenceType"],
	imageReference: ["identifier", "label", "referenceType", "alt"],
	definition: ["identifier", "label", "url", "title"],
	footnoteReference: ["identifier", "label"],
	footnoteDefinition: ["identifier", "label"],
	list: ["ordered", "start", "spread"],
	listItem: ["spread", "checked"],
	table: ["align"],
	mdxFlowExpression: ["value"],
	mdxTextExpression: ["value"],
	mdxjsEsm: ["value"],
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const completePoint = (value: unknown): boolean =>
	isRecord(value) &&
	typeof value.line === "number" &&
	typeof value.column === "number" &&
	typeof value.offset === "number";

const normalizePosition = (value: unknown): Record<string, unknown> => {
	if (isRecord(value) && completePoint(value.start) && completePoint(value.end)) {
		const start = value.start as Record<string, unknown>;
		const end = value.end as Record<string, unknown>;
		return {
			start: { line: start.line, column: start.column, offset: start.offset },
			end: { line: end.line, column: end.column, offset: end.offset },
		};
	}
	return sentinelPosition;
};

// Normalize one foreign node: admit whitelisted fields (dropping nulls on
// optional ones), synthesize sentinel positions, map frontmatter literal
// types onto the Frontmatter capture shape, and recurse into children.
// Unrecognized types pass through shallowly so schema decoding reports them
// as typed failures rather than this walk throwing.
const normalizeNode = (value: unknown): unknown => {
	if (!isRecord(value) || typeof value.type !== "string") {
		return value;
	}
	const type = value.type;
	const format = frontmatterTypes.get(type);
	if (format !== undefined) {
		return {
			type: "frontmatter",
			format,
			value: value.value,
			position: normalizePosition(value.position),
		};
	}
	// The JSX elements need their own admission: a `null` name is meaningful
	// (a fragment) so the null-equals-absent normalization must not touch it,
	// and the attributes array carries nested attribute nodes whose positions
	// (and value-expression positions) need the same sentinel synthesis as
	// tree nodes. `data.estree` is dropped like every foreign `data` field.
	// `name`, `attributes` and `children` pass through verbatim when they do
	// not match the oracle contract (`string | null`, an array, an array) —
	// a number name, an `attributes: {}`, a string `children` all reach the
	// schema and fail the decode typed rather than being coerced and
	// silently losing input, like every other malformed recognized field.
	if (type === "mdxJsxFlowElement" || type === "mdxJsxTextElement") {
		return {
			type,
			name: value.name,
			attributes: Array.isArray(value.attributes) ? value.attributes.map(normalizeMdxAttribute) : value.attributes,
			children: Array.isArray(value.children) ? value.children.map(normalizeNode) : value.children,
			position: normalizePosition(value.position),
		};
	}
	const admitted = admittedFields[type];
	if (admitted === undefined) {
		return value;
	}
	const normalized: Record<string, unknown> = { type };
	for (const field of admitted) {
		const raw = value[field];
		if (raw !== undefined && raw !== null) {
			normalized[field] = raw;
		}
	}
	// Restore the engine's carried-terminator convention on code values (the
	// inverse of toMdast's strip).
	if (type === "code" && typeof normalized.value === "string" && normalized.value !== "") {
		const code = normalized.value;
		normalized.value = code.endsWith("\n") ? code : `${code}\n`;
	}
	if (Array.isArray(value.children)) {
		normalized.children = value.children.map(normalizeNode);
	}
	normalized.position = normalizePosition(value.position);
	return normalized;
};

// One foreign JSX attribute node: positions synthesized like tree nodes,
// a string/null value passed through (both spellings are the contract), a
// value-expression object rebuilt with only its contract fields.
const normalizeMdxAttribute = (value: unknown): unknown => {
	if (!isRecord(value) || typeof value.type !== "string") {
		return value;
	}
	if (value.type === "mdxJsxExpressionAttribute") {
		return {
			type: "mdxJsxExpressionAttribute",
			value: value.value,
			position: normalizePosition(value.position),
		};
	}
	if (value.type === "mdxJsxAttribute") {
		const raw = value.value;
		const normalized: Record<string, unknown> = {
			type: "mdxJsxAttribute",
			name: value.name,
			position: normalizePosition(value.position),
		};
		if (raw !== undefined) {
			normalized.value =
				isRecord(raw) && raw.type === "mdxJsxAttributeValueExpression"
					? {
							type: "mdxJsxAttributeValueExpression",
							value: raw.value,
							position: normalizePosition(raw.position),
						}
					: raw;
		}
		return normalized;
	}
	return value;
};

const decodeRoot = S.decodeUnknownResult(Root);

/**
 * Projects parsed markdown trees to plain mdast JSON and admits foreign mdast
 * back into this package's node classes, for interop with the remark
 * ecosystem.
 *
 * @remarks
 * `Mdast.toMdast` projects a parsed {@link Root} to plain spec-valid mdast
 * objects — fidelity extras stripped, optional fields spelled the way
 * `mdast-util-from-markdown@2.0.3` spells them (explicit `null`/`false` where
 * the reference utility emits them), so the output deep-equals what the
 * remark ecosystem produces and consumes: `list.ordered`/`start`/`spread` and
 * `listItem.spread`/`checked` are always explicit (`null` for unknown
 * `start`/`checked`), `code.lang`/`meta` and every `title` are explicit
 * `null` when absent, and `image.alt`/`imageReference.alt` are always
 * strings. Under unist's null-equals-absent convention for optional fields
 * this stays spec-valid mdast. GFM shapes follow the same convention from
 * `mdast-util-gfm`; the frontmatter capture projects to mdast's `yaml`/`toml`
 * literal nodes, and a `json` capture projects to a `json`-typed literal node
 * per the `mdast-util-frontmatter` custom-preset convention (presets name the
 * node type after the language).
 *
 * `Mdast.fromMdast` admits foreign plain mdast back into the package's Schema
 * node classes, synthesizing zero-width sentinel positions where unist leaves
 * them optional.
 *
 * @example
 * ```ts
 * import { Markdown, Mdast } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const root = yield* Markdown.parse("# Hello\n");
 *   const plain = Mdast.toMdast(root); // plain mdast JSON
 *   return yield* Mdast.fromMdast(plain); // back to node classes
 * });
 * ```
 *
 * @public
 */
export class Mdast {
	/**
	 * Project a parsed {@link Root} to plain mdast JSON.
	 *
	 * @remarks
	 * Total and pure: every tree the parser or {@link Mdast.fromMdast}
	 * produces projects without failure. Fidelity extras are stripped;
	 * optional mdast fields are spelled the way `mdast-util-from-markdown`
	 * spells them, so the output deep-equals the reference utility's trees
	 * (the vendored interop corpus pins this). The frontmatter capture
	 * projects to a `yaml`/`toml`/`json` literal node.
	 *
	 * @param root - The parsed document tree.
	 * @returns A plain mdast `root` object with unist positions.
	 */
	static toMdast(root: Root): MdastNode {
		return projectNode(root) as unknown as MdastNode;
	}

	/**
	 * Decode foreign plain mdast into the package's node classes,
	 * synchronously, as a `Result`. The pure primitive twin of
	 * {@link Mdast.fromMdast}.
	 *
	 * @remarks
	 * unist makes positions optional and this package's classes require
	 * them, so missing or incomplete positions are synthesized as the
	 * zero-width sentinel (line 1, column 1, offset 0) — clearly synthetic
	 * and inert for rendering. Trees carrying sentinel positions serve
	 * tree-level workflows (stringify, the visitor, projection back out),
	 * not offset-splice editing, whose offsets must come from a real parse.
	 * `null` values on optional fields normalize to absence per unist's
	 * null-equals-absent convention; foreign `data` and other unrecognized
	 * fields are dropped at the boundary; `yaml`/`toml`/`json` literal nodes
	 * decode into the {@link Frontmatter} capture. Unknown node types fail
	 * typed.
	 *
	 * **This package's fidelity fields are among the fields dropped**, because
	 * they are not spec mdast. A `fenceChar`, `headingStyle`, `markerChar` or
	 * `delimiter` set on the tree BEFORE admission is silently discarded, and
	 * the node then serializes with the canonical default — set them on the
	 * decoded nodes this returns instead. The drop is correct (the boundary
	 * admits spec mdast and nothing else) but it is silent, which is why it is
	 * called out here.
	 *
	 * **One exception: `escapeStyle` on a `text` node is admitted.** It
	 * records no source spelling; it is the caller's instruction to the
	 * emitter (`"literal"` writes the value verbatim, see {@link Text}), so a
	 * plain tree built for `Markdown.stringify` can carry it straight in. A
	 * value outside `"canonical" | "literal"` fails the decode typed.
	 *
	 * @param input - A plain mdast tree, typically a `root`.
	 * @returns A `Result` succeeding with the decoded {@link Root}, or
	 *   failing with {@link MdastDecodeError} carrying the structured issue.
	 */
	static fromMdastResult(input: unknown): Result.Result<Root, MdastDecodeError> {
		return Result.mapError(decodeRoot(normalizeNode(input)), (error) => MdastDecodeError.make({ issue: error.issue }));
	}

	/**
	 * Decode foreign plain mdast into the package's node classes. Defined in
	 * terms of {@link Mdast.fromMdastResult} — synchronous callers can use
	 * that variant directly.
	 *
	 * @param input - A plain mdast tree, typically a `root`.
	 * @returns An `Effect` that succeeds with the decoded {@link Root}, or
	 *   fails with {@link MdastDecodeError}.
	 */
	static readonly fromMdast = Effect.fn("Mdast.fromMdast")((input: unknown) =>
		Effect.fromResult(Mdast.fromMdastResult(input)),
	);
}
