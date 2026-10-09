// The lossless unit: source text plus the parsed tree, the materialized
// diagnostics and the link-reference definition index, in one Schema class.
//
// Cycle firewall: this module never touches raw carriers directly — it shares
// `Markdown.ts`'s single carrier-catching helper, so the document and the
// bare-tree entry points agree exactly on what is a typed failure and what is
// a defect.

import * as Match from "effect/Match";
import { $ScratchpadId } from "@beep/identity/packages";
import * as Effect from "effect/Effect";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import { scanFrontmatter } from "./internal/blocks/frontmatter.ts";
import { MAX_NESTING_DEPTH } from "./internal/limits.ts";
import { preprocessLines } from "./internal/preprocess.ts";
import { normalizeLabelText } from "./internal/references.ts";
import type { MarkdownParseError, MarkdownParseOptions } from "./Markdown.ts";
import { parsePassResult } from "./Markdown.ts";
import { MarkdownDiagnostic } from "./MarkdownDiagnostic.ts";
import { MarkdownRange } from "./MarkdownEdit.ts";
import type {
	FlowContent,
	Frontmatter,
	MarkdownNode,
	MarkdownNodeOfType,
	MarkdownNodeType,
	PhrasingContent,
} from "./MarkdownNode.ts";
import { Definition, Heading, HeadingDepth, Image, ImageReference, Link, LinkReference, Root } from "./MarkdownNode.ts";
import * as P from "effect/Predicate";

const $I = $ScratchpadId.create("effected/markdown/MarkdownDocument");

/** The document navigation depth guard was exceeded. */
class DocumentNavigationError extends S.TaggedError<DocumentNavigationError>($I`DocumentNavigationError`)(
	"DocumentNavigationError",
	{
		message: S.String,
	},
	$I.annote("DocumentNavigationError", { description: "The document navigation depth guard was exceeded." }),
) {}

/**
 * A heading entry from {@link MarkdownDocument.headings}: the {@link Heading}
 * node plus the derivations navigation wants — its `depth` and its plain-text
 * content.
 *
 * **Details**
 *
 * `text` concatenates the values of text and inline-code descendants, uses
 * image `alt` text where present, renders a hard break as a single space and
 * contributes nothing for raw HTML or footnote references.
 *
 * **Example** (Validate a derived heading entry)
 *
 * ```ts
 * import { DocumentHeading, MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema";
 *
 * const doc = Effect.runSync(MarkdownDocument.parse("# Title"));
 * console.log(S.is(DocumentHeading)(doc.headings[0])) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const DocumentHeading = S.Struct({
	node: Heading.annotateKey({ description: "The original heading node in the document tree" }),
	depth: HeadingDepth.annotateKey({ description: "Heading level used for outline navigation" }),
	text: S.String.annotateKey({ description: "Plain-text projection of the heading's phrasing content" }),
}).annotate($I.annote("DocumentHeading", { description: "Plain-object heading navigation entry retaining its source node, depth and derived text." }));

/**
 * The schema-derived heading navigation entry.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DocumentHeading = typeof DocumentHeading.Type;

/**
 * A heading-delimited span from {@link MarkdownDocument.sections}: the
 * heading, its depth, the source `range` the section occupies and the
 * root-level blocks that follow the heading inside it.
 *
 * **Details**
 *
 * A section runs from its heading's start offset to the start of the next
 * root-level heading of equal or shallower depth, or to the end of the
 * source. Deeper headings nest inside, so a parent section's `range` and
 * `children` include its subsections — the list is flat, in document order,
 * with `depth` carrying the hierarchy.
 *
 * Instances come from {@link MarkdownDocument.sections} and the two finders;
 * there is no reason to construct one directly.
 *
 * **Example** (Read a heading-delimited section)
 *
 * ```ts
 * import { DocumentSection, MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
 * import * as Effect from "effect/Effect";
 *
 * const doc = Effect.runSync(MarkdownDocument.parse("# Title\n\nBody."));
 * const section = doc.firstSection();
 * console.log(section instanceof DocumentSection) // true
 * console.log(section?.body.trim()) // Body.
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class DocumentSection {
	/**
	 * The heading that opens the section.
	 *
	 * **Example** (Read the opening heading)
	 *
	 * ```ts
	 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
	 * import * as Effect from "effect/Effect";
	 *
	 * const doc = Effect.runSync(MarkdownDocument.parse("# Title\n\nBody."));
	 * console.log(doc.firstSection()?.heading.type) // heading
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	readonly heading: Heading;
	/**
	 * The heading's depth, and the section's.
	 *
	 * **Example** (Read the section heading level)
	 *
	 * ```ts
	 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
	 * import * as Effect from "effect/Effect";
	 *
	 * const doc = Effect.runSync(MarkdownDocument.parse("# Title\n\nBody."));
	 * console.log(doc.firstSection()?.depth) // 1
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	readonly depth: HeadingDepth;
	/**
	 * The whole section including its heading — spliceable by `MarkdownEdit`.
	 *
	 * **Example** (Locate the whole section)
	 *
	 * ```ts
	 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
	 * import * as Effect from "effect/Effect";
	 *
	 * const doc = Effect.runSync(MarkdownDocument.parse("# Title\n\nBody."));
	 * console.log(doc.firstSection()?.range.offset) // 0
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	readonly range: MarkdownRange;
	/**
	 * The root-level blocks after the heading, subsections included.
	 *
	 * **Example** (Count the body blocks)
	 *
	 * ```ts
	 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
	 * import * as Effect from "effect/Effect";
	 *
	 * const doc = Effect.runSync(MarkdownDocument.parse("# Title\n\nBody."));
	 * console.log(doc.firstSection()?.children.length) // 1
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	readonly children: ReadonlyArray<FlowContent>;
	/**
	 * The heading's plain-text content.
	 *
	 * **Details**
	 *
	 * The same derivation as {@link DocumentHeading.text}: text and inline-code
	 * values concatenated, image `alt` where present, a hard break as one space,
	 * nothing for raw HTML or footnote references. So `## **1.2.3**` reads
	 * `1.2.3`.
	 *
	 * **Example** (Project a formatted heading as text)
	 *
	 * ```ts
	 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
	 * import * as Effect from "effect/Effect";
	 *
	 * const doc = Effect.runSync(MarkdownDocument.parse("## **1.2.3**\n\nBody."));
	 * console.log(doc.firstSection()?.text) // 1.2.3
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	readonly text: string;
	/**
	 * The section WITHOUT its heading: from the heading's end offset to the
	 * section's end.
	 *
	 * **Details**
	 *
	 * This is the span a "give me the release notes under this version" reader
	 * wants, and the one that is fiddly to derive by hand.
	 *
	 * **Example** (Locate the body after the heading)
	 *
	 * ```ts
	 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
	 * import * as Effect from "effect/Effect";
	 *
	 * const doc = Effect.runSync(MarkdownDocument.parse("# Title\n\nBody."));
	 * console.log(doc.firstSection()?.bodyRange.offset) // 7
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	readonly bodyRange: MarkdownRange;

	/**
	 * The document source these ranges index into.
	 *
	 * **Details**
	 *
	 * The private source is observed through the section's source slices.
	 *
	 * **Example** (Read a slice of the retained document source)
	 *
	 * ```ts
	 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
	 * import * as Effect from "effect/Effect";
	 *
	 * const doc = Effect.runSync(MarkdownDocument.parse("# Title"));
	 * console.log(doc.firstSection()?.source) // # Title
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	readonly #documentSource: string;

	constructor(options: {
		readonly heading: Heading;
		readonly depth: HeadingDepth;
		readonly range: MarkdownRange;
		readonly children: ReadonlyArray<FlowContent>;
		readonly text: string;
		readonly bodyRange: MarkdownRange;
		readonly documentSource: string;
	}) {
		this.heading = options.heading;
		this.depth = options.depth;
		this.range = options.range;
		this.children = options.children;
		this.text = options.text;
		this.bodyRange = options.bodyRange;
		this.#documentSource = options.documentSource;
	}

	/**
	 * The section's source text, heading included.
	 *
	 * **Example** (Read the section source including its heading)
	 *
	 * ```ts
	 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
	 * import * as Effect from "effect/Effect";
	 *
	 * const doc = Effect.runSync(MarkdownDocument.parse("# Title\n\nBody."));
	 * console.log(doc.firstSection()?.source === doc.source) // true
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	get source(): string {
		return this.#documentSource.slice(this.range.offset, this.range.offset + this.range.length);
	}

	/**
	 * The section's source text without its heading.
	 *
	 * **Details**
	 *
	 * **Untrimmed, deliberately.** It is exactly the bytes {@link
	 * DocumentSection.bodyRange} describes, so the string and the offsets can
	 * never disagree — a package that publishes a span's offsets and then hands
	 * back a different span is lying about it. Callers that want the tidy form
	 * write `.body.trim()`, visibly.
	 *
	 * **Example** (Preserve the body whitespace)
	 *
	 * ```ts
	 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
	 * import * as Effect from "effect/Effect";
	 *
	 * const doc = Effect.runSync(MarkdownDocument.parse("# Title\n\nBody."));
	 * console.log(JSON.stringify(doc.firstSection()?.body)) // "\n\nBody."
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	get body(): string {
		return this.#documentSource.slice(this.bodyRange.offset, this.bodyRange.offset + this.bodyRange.length);
	}
}

/**
 * Narrowing options for {@link MarkdownDocument.firstSection} and
 * {@link MarkdownDocument.sectionByHeading}.
 *
 * **Example** (Validate an exact-depth query)
 *
 * ```ts
 * import { SectionQueryOptions } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(SectionQueryOptions)({ depth: 2 })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const SectionQueryOptions = S.Struct({
	/**
	 * Restrict to sections opened by a heading of exactly this depth.
	 *
	 * **Details**
	 *
	 * Equality, not a maximum: `{ depth: 2 }` is "the H2 sections", which is the
	 * changelog idiom. A depth *range* is a different question and belongs in a
	 * predicate.
	 *
	 * @category type-level
	 * @since 0.0.0
	 */
	depth: S.optionalKey(HeadingDepth).annotateKey({ description: "Exact heading depth to select; omission admits every heading depth" }),
}).annotate($I.annote("SectionQueryOptions", { description: "Optional exact-depth restriction for document section navigation." }));

/**
 * The schema-derived section query configuration.
 *
 * @category type-level
 * @since 0.0.0
 */
export type SectionQueryOptions = typeof SectionQueryOptions.Type;

/**
 * How {@link MarkdownDocument.sectionByHeading} decides a section matches: an
 * exact trimmed-text string, a `RegExp`, or a predicate over the text and the
 * section.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type SectionHeadingMatch = string | RegExp | ((text: string, section: DocumentSection) => boolean);

/**
 * The node types {@link MarkdownDocument.links} collects: the nodes that
 * carry an outbound URL themselves ({@link Link}, {@link Image},
 * {@link Definition}) and the reference nodes that reach one through the
 * definition index ({@link LinkReference}, {@link ImageReference}).
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type LinkBearingNode = Link | Image | Definition | LinkReference | ImageReference;

/**
 * A link entry from {@link MarkdownDocument.links}: the link-bearing node and
 * the URL it points at.
 *
 * **Details**
 *
 * `url` is the node's own `url` field, unmodified — bundle-relative and
 * otherwise non-normalized hrefs pass through exactly as written. For
 * reference nodes it is the matching definition's `url`; when no definition
 * matches (possible only on trees decoded from foreign mdast — the parser
 * never forms an unmatched reference), the field is genuinely absent.
 *
 * **Example** (Validate a resolved link entry)
 *
 * ```ts
 * import { DocumentLink, MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
 * import * as Effect from "effect/Effect";
 * import * as S from "effect/Schema";
 *
 * const doc = Effect.runSync(MarkdownDocument.parse("[docs](./docs.md)"));
 * console.log(S.is(DocumentLink)(doc.links[0])) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const DocumentLink = S.Struct({
	node: S.Union([Link, Image, Definition, LinkReference, ImageReference]).annotateKey({ description: "Original outbound-link or reference node in the document tree" }),
	url: S.optionalKey(S.String).annotateKey({ description: "Unmodified outbound URL; absent for unresolved foreign references" }),
}).annotate($I.annote("DocumentLink", { description: "Plain-object link navigation entry with the original node and an optional resolved URL." }));

/**
 * The schema-derived link navigation entry.
 *
 * @category type-level
 * @since 0.0.0
 */
export type DocumentLink = typeof DocumentLink.Type;

// The accessor walks recurse over the tree, so they share the engine's depth
// cap. A getter has no typed error channel, so — like `applyAll`'s overlap
// guard — an over-deep tree (reachable only via a hand-built or foreign
// decoded tree; the parser refuses deeper input) is a thrown defect.
type NavigationNode = Frontmatter | MarkdownNode;

const walkTree = (node: NavigationNode, depth: number, visit: (node: NavigationNode) => void): void => {
	if (depth > MAX_NESTING_DEPTH) {
		throw DocumentNavigationError.make({
			message: `NestingDepthExceeded: limit ${MAX_NESTING_DEPTH} exceeded while walking the document tree`,
		});
	}
	visit(node);
	if ("children" in node) {
		for (const child of node.children) {
			walkTree(child, depth + 1, visit);
		}
	}
};

// Depth-guarded pre-order search with early exit — `walkTree`'s visit callback
// cannot stop the walk, and `find` should not pay for the rest of the tree
// once it has its match.
const findInTree = (
	node: NavigationNode,
	depth: number,
	predicate: (node: MarkdownNode) => boolean,
): MarkdownNode | undefined => {
	if (depth > MAX_NESTING_DEPTH) {
		throw DocumentNavigationError.make({
			message: `NestingDepthExceeded: limit ${MAX_NESTING_DEPTH} exceeded while walking the document tree`,
		});
	}
	if (predicate(node)) {
		return node;
	}
	if ("children" in node) {
		for (const child of node.children) {
			const found = findInTree(child, depth + 1, predicate);
			if (found !== undefined) {
				return found;
			}
		}
	}
	return undefined;
};

/** Normalize a find/findAll selector — a `type` tag or a predicate — to a predicate. */
const selectorPredicate = (
	selector: MarkdownNodeType | ((node: MarkdownNode) => boolean),
): ((node: MarkdownNode) => boolean) =>
	P.isString(selector) ? (node: MarkdownNode): boolean => node.type === selector : selector;

// The plain-text projection of phrasing content, for DocumentHeading.text and
// DocumentSection.text. MDX policy: a JSX text wrapper is transparent — its
// children's text comes through, so `<span>Title</span>` reads "Title" — while
// a text EXPRESSION contributes nothing: its value is code, not prose, and no
// rendering of it is faithful plain text.
const phrasingText = (nodes: ReadonlyArray<PhrasingContent>): string => {
	let out = "";
	for (const node of nodes) {
		Match.value(node).pipe(
			Match.discriminator("type")("text", "inlineCode", (node) => {
				out += node.value;
			}),
			Match.discriminator("type")("break", () => {
				out += " ";
			}),
			Match.discriminator("type")("image", "imageReference", (node) => {
				out += node.alt ?? "";
			}),
			Match.discriminator("type")(
				"emphasis",
				"strong",
				"delete",
				"link",
				"linkReference",
				"mdxJsxTextElement",
				(node) => {
					out += phrasingText(node.children);
				},
			),
			Match.discriminator("type")("mdxTextExpression", () => {}),
			Match.orElse(() => {}),
		);
	}
	return out;
};

/**
 * A parsed markdown document: the original `source`, the mdast-shaped
 * {@link Root} tree, the non-fatal {@link MarkdownDiagnostic}s the parse
 * produced, and the link-reference `definitions` index.
 *
 * **Details**
 *
 * The document is the lossless unit — `source` is retained so offsets on the
 * tree stay meaningful and so the edit and format layer can splice against
 * the exact bytes that were parsed.
 *
 * `definitions` is an index over the {@link Definition} nodes that remain in
 * the tree, keyed by case-folded label with the first definition winning; it
 * is not a place they were moved to. References are emitted unresolved, so
 * resolution happens against this map.
 *
 * `diagnostics` is empty for every input the parser currently accepts: the
 * plumbing from the engine through to this field exists, but no construct
 * emits a non-fatal diagnostic yet. Read an empty array as "nothing to
 * report", and do not code against it staying empty — fatal conditions fail
 * through `MarkdownParseError` instead.
 *
 * The navigation accessors (`headings`, `sections`, `links`) are derived
 * getters over the tree — no stored state, no parse-time cost, and they can
 * never disagree with the tree they read.
 *
 * **Example** (Read document headings and link URLs)
 *
 * ```ts
 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
 * import * as Effect from "effect/Effect";
 *
 * const doc = Effect.runSync(MarkdownDocument.parse("# Title\n\nSee [docs](./docs.md).\n\n## Usage\n"));
 * console.log(doc.headings.map((heading) => heading.text).join(", ")) // Title, Usage
 * console.log(doc.links.map((link) => link.url).join(", ")) // ./docs.md
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class MarkdownDocument extends S.Class<MarkdownDocument>($I`MarkdownDocument`)({
	source: S.String.annotateKey({ description: "Original markdown text retained so tree positions and surgical edits refer to the exact parsed source" }),
	root: Root.annotateKey({ description: "Parsed mdast-shaped document tree carrying source positions and fidelity details" }),
	diagnostics: S.Array(MarkdownDiagnostic).annotateKey({ description: "Non-fatal conditions reported during parsing; currently empty for every accepted document" }),
	definitions: S.HashMap(S.String, Definition).annotateKey({ description: "Link-reference definitions indexed by normalized, case-folded label, with the first definition winning and nodes retained in the tree" }),
	definitionOrder: S.Array(S.Tuple([S.String, Definition])).annotateKey({ description: "Winning normalized labels and their original definition nodes in document order; HashMap iteration order is unspecified" }),
}, $I.annote("MarkdownDocument", { description: "A parsed markdown document: the original `source`, the mdast-shaped Root tree, the non-fatal MarkdownDiagnostics the parse produced, and the link-reference `definitions` index." })) {
	/**
	 * The document's frontmatter capture, or `undefined` when there is none.
	 *
	 * **Details**
	 *
	 * Derived from the tree rather than stored: a {@link Frontmatter} node can
	 * only ever sit at the head of `root.children` (the capture fires at most
	 * once, at offset 0), so the tree is the single source of truth and the
	 * accessor can never disagree with it. `undefined` covers both a document
	 * with no frontmatter block and one parsed with the capture toggle off —
	 * {@link MarkdownDocument.hasFrontmatterBlock} tells the two apart.
	 *
	 * **Example** (Read an opted-in frontmatter capture)
	 *
	 * ```ts
	 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
	 * import * as Effect from "effect/Effect";
	 *
	 * const doc = Effect.runSync(
	 *   MarkdownDocument.parse("---\ntitle: Notes\n---\nBody", { frontmatter: true }),
	 * );
	 * console.log(doc.frontmatter?.type) // frontmatter
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	get frontmatter(): Frontmatter | undefined {
		const head = this.root.children[0];
		return head !== undefined && head.type === "frontmatter" ? head : undefined;
	}

	/**
	 * Whether the source opens with a well-formed frontmatter block —
	 * regardless of how the document was parsed.
	 *
	 * **Details**
	 *
	 * The structural signal that disambiguates the `frontmatter` accessor's
	 * `undefined`: capture is opt-in (`MarkdownParseOptions.frontmatter`
	 * defaults off), so a document whose source visibly starts with `---` can
	 * still carry no capture node — spec-correct CommonMark reads the fences as
	 * a thematic break plus content. `frontmatter === undefined` with
	 * `hasFrontmatterBlock === true` means exactly "parsed with capture off";
	 * with `false` it means the source genuinely has no block.
	 *
	 * Derived, not stored: the getter runs the **same** pre-scan the parser
	 * runs when capture is enabled (the closed fence grammar — `---` yaml,
	 * `+++` toml, `---json` json; an unclosed fence is not frontmatter), so it
	 * is `true` exactly when parsing this source with `frontmatter: true`
	 * would produce a capture node, and the two can never drift. Like the
	 * other navigation accessors it recomputes per access — bind it once when
	 * checking repeatedly.
	 *
	 * **Example** (Detect frontmatter with capture disabled)
	 *
	 * ```ts
	 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
	 * import * as Effect from "effect/Effect";
	 *
	 * const doc = Effect.runSync(MarkdownDocument.parse("---\ntitle: Notes\n---\nBody"));
	 * console.log(doc.frontmatter) // undefined
	 * console.log(doc.hasFrontmatterBlock) // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	get hasFrontmatterBlock(): boolean {
		return scanFrontmatter(preprocessLines(this.source), this.source) !== null;
	}

	/**
	 * Every heading in the document, in document order, wherever it sits —
	 * including headings nested inside blockquotes and list items.
	 *
	 * **Details**
	 *
	 * Each {@link DocumentHeading} carries the node, its depth and its
	 * plain-text content. For an outline restricted to section boundaries, use
	 * {@link MarkdownDocument.sections}, which considers root-level headings
	 * only.
	 *
	 * **Example** (Include headings nested in blockquotes)
	 *
	 * ```ts
	 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
	 * import * as Effect from "effect/Effect";
	 *
	 * const doc = Effect.runSync(MarkdownDocument.parse("# Title\n\n> ## Quoted"));
	 * console.log(doc.headings.map((heading) => heading.text).join(", ")) // Title, Quoted
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	get headings(): ReadonlyArray<DocumentHeading> {
		const entries: Array<DocumentHeading> = [];
		for (const child of this.root.children) {
			walkTree(child, 1, (node) => {
				if (node.type === "heading") {
					entries.push({ node, depth: node.depth, text: phrasingText(node.children) });
				}
			});
		}
		return entries;
	}

	/**
	 * The document's heading-delimited sections, flat and in document order.
	 *
	 * **Details**
	 *
	 * Only root-level headings delimit sections — a heading inside a
	 * blockquote or list cannot mark a span of root-level source. Content
	 * before the first heading (the preamble) and the frontmatter block belong
	 * to no section. Each {@link DocumentSection.range} is spliceable by the
	 * edit layer: it runs from the heading's start offset to the next
	 * boundary heading's start, or to the end of the source.
	 *
	 * **Example** (Restrict section boundaries to root headings)
	 *
	 * ```ts
	 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
	 * import * as Effect from "effect/Effect";
	 *
	 * const doc = Effect.runSync(MarkdownDocument.parse("# Title\n\n> ## Quoted"));
	 * console.log(doc.sections.map((section) => section.text).join(", ")) // Title
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	get sections(): ReadonlyArray<DocumentSection> {
		const blocks = this.root.children;
		const sections: Array<DocumentSection> = [];
		const headings: Array<{ readonly index: number; readonly node: Heading }> = [];
		for (let index = 0; index < blocks.length; index += 1) {
			const block = blocks[index];
			if (block !== undefined && block.type === "heading") {
				headings.push({ index, node: block });
			}
		}
		// `sections` boundaries are defined by ROOT headings only. Building that
		// index once lets the boundary pass scan heading-to-heading instead of
		// re-walking non-heading blocks for every section.
		const nextByDepth: Array<number | undefined> = [
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
			undefined,
		];
		const boundaryByHeading = new Array<number | undefined>(headings.length);
		for (let index = headings.length - 1; index >= 0; index -= 1) {
			const current = headings[index]?.node;
			if (current === undefined) continue;
			let boundary: number | undefined;
			for (let depth = 1; depth <= current.depth; depth += 1) {
				const candidate = nextByDepth[depth];
				if (candidate !== undefined && (boundary === undefined || candidate < boundary)) {
					boundary = candidate;
				}
			}
			boundaryByHeading[index] = boundary;
			nextByDepth[current.depth] = index;
		}
		for (let index = 0; index < headings.length; index += 1) {
			const current = headings[index];
			if (current === undefined) continue;
			const block = current.node;
			const boundaryHeading = boundaryByHeading[index];
			const boundaryNode = boundaryHeading === undefined ? undefined : headings[boundaryHeading]?.node;
			const boundary = boundaryNode === undefined ? this.source.length : boundaryNode.position.start.offset;
			const end = boundaryHeading === undefined ? blocks.length : (headings[boundaryHeading]?.index ?? blocks.length);
			const start = block.position.start.offset;
			const bodyStart = block.position.end.offset;
			sections.push(
				new DocumentSection({
					heading: block,
					depth: block.depth,
					range: MarkdownRange.make({ offset: start, length: boundary - start }),
					children: blocks
						.slice(current.index + 1, end)
						// Navigation is prose-oriented: the frontmatter block and MDX
						// ESM statements are metadata, not section content, so both
						// are excluded — which is also what keeps this predicate's
						// FlowContent narrowing sound.
						.filter((child): child is FlowContent => child.type !== "frontmatter" && child.type !== "mdxjsEsm"),
					text: phrasingText(block.children),
					// The body starts where the heading NODE ends, which is what makes
					// this correct for setext headings too: their node span covers the
					// underline, so the body never begins mid-`---`.
					bodyRange: MarkdownRange.make({ offset: bodyStart, length: Math.max(0, boundary - bodyStart) }),
					documentSource: this.source,
				}),
			);
		}
		return sections;
	}

	/**
	 * The first section in document order, optionally restricted by heading
	 * depth.
	 *
	 * **Details**
	 *
	 * `firstSection({ depth: 2 })` is "the newest entry" for a changelog whose
	 * releases are H2s under an H1 title. Like the other navigation accessors
	 * this recomputes {@link MarkdownDocument.sections}; a caller scanning one
	 * document repeatedly should bind `document.sections` once instead.
	 *
	 * **Example** (Find the newest H2 release)
	 *
	 * ```ts
	 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
	 * import * as Effect from "effect/Effect";
	 *
	 * const doc = Effect.runSync(MarkdownDocument.parse("# Changelog\n\n## 1.2.30\n\nLatest\n\n## 1.2.3\n\nOlder"));
	 * console.log(doc.firstSection({ depth: 2 })?.text) // 1.2.30
	 * ```
	 *
	 * @param options - Depth restriction.
	 * @returns The first matching section, or `undefined`.
	 * @category queries
	 * @since 0.0.0
	 */
	firstSection(options?: SectionQueryOptions): DocumentSection | undefined {
		const depth = options?.depth;
		return this.sections.find((section) => depth === undefined || section.depth === depth);
	}

	/**
	 * The first section whose heading matches, in document order.
	 *
	 * **Gotchas**
	 *
	 * A **string matches the trimmed heading text exactly** — never a substring.
	 * That is a deliberate refusal of the obvious convenience: `"1.2.3"` would
	 * otherwise match a `## 1.2.30` heading, and in a changelog (where `1.2.30`
	 * sorts newer and therefore sits *earlier*) that silently publishes the
	 * wrong release. A `RegExp` is tested against the same trimmed text, and its
	 * `lastIndex` is reset first so a `/g/` pattern cannot skip sections. A
	 * predicate receives the raw {@link DocumentSection.text} plus the section
	 * itself and decides freely.
	 *
	 * **Example** (Match a release heading exactly)
	 *
	 * ```ts
	 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
	 * import * as Effect from "effect/Effect";
	 *
	 * const doc = Effect.runSync(MarkdownDocument.parse("# Changelog\n\n## 1.2.30\n\nLatest\n\n## 1.2.3\n\nOlder"));
	 * console.log(doc.sectionByHeading("1.2.3", { depth: 2 })?.text) // 1.2.3
	 * ```
	 *
	 * @param match - A string, a RegExp, or a predicate.
	 * @param options - Depth restriction, applied before matching.
	 * @returns The first matching section, or `undefined`.
	 * @category queries
	 * @since 0.0.0
	 */
	sectionByHeading(match: SectionHeadingMatch, options?: SectionQueryOptions): DocumentSection | undefined {
		const depth = options?.depth;
		const matches: (section: DocumentSection) => boolean =
			P.isString(match)
				? (section) => section.text.trim() === match
				: match instanceof RegExp
					? (section) => {
							// A `/g/` or `/y/` regex carries `lastIndex` between calls, so
							// reusing one across sections would test from the wrong offset
							// and skip matches.
							match.lastIndex = 0;
							return match.test(section.text.trim());
						}
					: (section) => match(section.text, section);
		return this.sections.find((section) => (depth === undefined || section.depth === depth) && matches(section));
	}

	/**
	 * Every link-bearing node in the document, in document order: links,
	 * images, definitions, and the reference forms resolved through the
	 * definition index.
	 *
	 * **Details**
	 *
	 * See {@link DocumentLink} for the url semantics — the raw `url` string
	 * passes through unmodified, and an unresolvable foreign reference leaves
	 * the field genuinely absent. Autolinks and GFM autolink literals are
	 * {@link Link} nodes, so they appear with no special casing. Footnote
	 * references carry no URL and are not link entries.
	 *
	 * **Example** (Resolve a reference without normalizing its URL)
	 *
	 * ```ts
	 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
	 * import * as Effect from "effect/Effect";
	 *
	 * const doc = Effect.runSync(MarkdownDocument.parse("[docs][guide]\n\n[guide]: ./docs.md"));
	 * console.log(doc.links.map((link) => link.url).join(", ")) // ./docs.md, ./docs.md
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	get links(): ReadonlyArray<DocumentLink> {
		const entries: Array<DocumentLink> = [];
		for (const child of this.root.children) {
			walkTree(child, 1, (node) => {
				Match.value(node).pipe(
					Match.discriminator("type")("link", "image", "definition", (node) => {
						entries.push({ node, url: node.url });
					}),
					Match.discriminator("type")("linkReference", "imageReference", (node) => {
						const definition = HashMap.get(this.definitions, normalizeLabelText(node.identifier));
						entries.push(O.isNone(definition) ? { node } : { node, url: definition.value.url });
					}),
					Match.orElse(() => {}),
				);
			});
		}
		return entries;
	}

	/**
	 * Find the first node matching a selector, in document pre-order — the
	 * same order {@link MarkdownVisitor} enters nodes, starting at the root
	 * itself.
	 *
	 * **Details**
	 *
	 * A string selector matches on the node's `type` tag and narrows the
	 * result (`find("heading")` is `Heading | undefined`); a type-guard
	 * predicate narrows the same way, and a plain predicate returns the wide
	 * `MarkdownNode` union. The returned node is the document's own — matched
	 * and returnable by identity, so it feeds `MarkdownFormat.modify`
	 * directly. Like the navigation getters, the walk is synchronous with no
	 * error channel: a tree nested past the depth cap (reachable only via a
	 * hand-built or foreign decoded tree) is a thrown defect.
	 *
	 * **Example** (Find a heading and retain node identity)
	 *
	 * ```ts
	 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
	 * import * as Effect from "effect/Effect";
	 *
	 * const doc = Effect.runSync(MarkdownDocument.parse("# Title"));
	 * console.log(doc.find("heading")?.depth) // 1
	 * console.log(doc.find("heading") === doc.root.children[0]) // true
	 * ```
	 *
	 * @param selector - A node `type` tag or a predicate over nodes.
	 * @returns The first matching node in document order, or `undefined`.
	 * @category queries
	 * @since 0.0.0
	 */
	find<T extends MarkdownNodeType>(selector: T): MarkdownNodeOfType<T> | undefined;
	find<T extends MarkdownNode>(selector: (node: MarkdownNode) => node is T): T | undefined;
	find(selector: (node: MarkdownNode) => boolean): MarkdownNode | undefined;
	find(selector: MarkdownNodeType | ((node: MarkdownNode) => boolean)): MarkdownNode | undefined {
		return findInTree(this.root, 0, selectorPredicate(selector));
	}

	/**
	 * Find every node matching a selector, in document pre-order — the same
	 * order {@link MarkdownVisitor} enters nodes, starting at the root itself.
	 *
	 * **Details**
	 *
	 * Selector and narrowing semantics are `MarkdownDocument.find`'s; so is
	 * the guard posture — an over-deep hand-built or foreign tree is a
	 * thrown defect. Nodes are the document's own, matched by identity, so
	 * `findAll("heading")[1]` addresses the second heading for
	 * `MarkdownFormat.modify` without raw child indexing.
	 *
	 * **Example** (Collect all headings in pre-order)
	 *
	 * ```ts
	 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
	 * import * as Effect from "effect/Effect";
	 *
	 * const doc = Effect.runSync(MarkdownDocument.parse("# Title\n\n## Usage"));
	 * console.log(doc.findAll("heading").map((heading) => heading.depth).join(", ")) // 1, 2
	 * ```
	 *
	 * @param selector - A node `type` tag or a predicate over nodes.
	 * @returns Every matching node, in document order; empty when none match.
	 * @category queries
	 * @since 0.0.0
	 */
	findAll<T extends MarkdownNodeType>(selector: T): ReadonlyArray<MarkdownNodeOfType<T>>;
	findAll<T extends MarkdownNode>(selector: (node: MarkdownNode) => node is T): ReadonlyArray<T>;
	findAll(selector: (node: MarkdownNode) => boolean): ReadonlyArray<MarkdownNode>;
	findAll(selector: MarkdownNodeType | ((node: MarkdownNode) => boolean)): ReadonlyArray<MarkdownNode> {
		const predicate = selectorPredicate(selector);
		const matches: Array<MarkdownNode> = [];
		walkTree(this.root, 0, (node) => {
			if (predicate(node)) {
				matches.push(node);
			}
		});
		return matches;
	}

	/**
	 * Parse markdown into a {@link MarkdownDocument}, synchronously, as a
	 * `Result`. The pure primitive; {@link MarkdownDocument.parse} is defined
	 * in terms of it, so the two never diverge.
	 *
	 * **Details**
	 *
	 * Carries no span: it is not an `Effect`. Effect callers should reach for
	 * {@link MarkdownDocument.parse}, which carries the
	 * `MarkdownDocument.parse` tracing span.
	 *
	 * **Example** (Inspect a synchronous parse result)
	 *
	 * ```ts
	 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
	 * import * as Result from "effect/Result";
	 *
	 * const result = MarkdownDocument.parseResult("# Title");
	 * console.log(Result.isSuccess(result)) // true
	 * ```
	 *
	 * @param text - The markdown source to parse.
	 * @param options - Optional {@link MarkdownParseOptions}; the dialect
	 *   defaults to `"gfm"`.
	 * @returns A `Result` succeeding with the document, or failing with
	 *   `MarkdownParseError`.
	 * @category parsing
	 * @since 0.0.0
	 */
	static parseResult(
		text: string,
		options?: MarkdownParseOptions,
	): Result.Result<MarkdownDocument, MarkdownParseError> {
		return Result.map(parsePassResult(text, options), (pass) =>
			MarkdownDocument.make({
				source: text,
				root: pass.root,
				diagnostics: pass.carriers.map((carrier) => MarkdownDiagnostic.fromRaw(text, carrier)),
				definitions: pass.refmap,
				definitionOrder: pass.definitionOrder,
			}),
		);
	}

	/**
	 * Parse markdown into a {@link MarkdownDocument}. Defined in terms of
	 * {@link MarkdownDocument.parseResult} — synchronous callers can use that
	 * variant directly.
	 *
	 * **Example** (Run a document parse without services)
	 *
	 * ```ts
	 * import { MarkdownDocument } from "@beep/scratchpad/effected/markdown/MarkdownDocument";
	 * import * as Effect from "effect/Effect";
	 *
	 * const doc = Effect.runSync(MarkdownDocument.parse("# Title"));
	 * console.log(doc.headings[0]?.text) // Title
	 * ```
	 *
	 * @param text - The markdown source to parse.
	 * @param options - Optional {@link MarkdownParseOptions}; the dialect
	 *   defaults to `"gfm"`.
	 * @returns An `Effect` that succeeds with the document, or fails with
	 *   `MarkdownParseError`.
	 * @category parsing
	 * @since 0.0.0
	 */
	static readonly parse = Effect.fn("MarkdownDocument.parse")((text: string, options?: MarkdownParseOptions) =>
		Effect.fromResult(MarkdownDocument.parseResult(text, options)),
	);
}
