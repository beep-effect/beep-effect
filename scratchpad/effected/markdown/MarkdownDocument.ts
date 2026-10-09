// The lossless unit: source text plus the parsed tree, the materialized
// diagnostics and the link-reference definition index, in one Schema class.
//
// Cycle firewall: this module never touches raw carriers directly — it shares
// `Markdown.ts`'s single carrier-catching helper, so the document and the
// bare-tree entry points agree exactly on what is a typed failure and what is
// a defect.

import * as Effect from "effect/Effect";
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
	Heading,
	HeadingDepth,
	Image,
	ImageReference,
	Link,
	LinkReference,
	MarkdownNode,
	MarkdownNodeOfType,
	MarkdownNodeType,
	PhrasingContent,
} from "./MarkdownNode.ts";
import { Definition, Root } from "./MarkdownNode.ts";

/**
 * A heading entry from {@link MarkdownDocument.headings}: the {@link Heading}
 * node plus the derivations navigation wants — its `depth` and its plain-text
 * content.
 *
 * @remarks
 * `text` concatenates the values of text and inline-code descendants, uses
 * image `alt` text where present, renders a hard break as a single space and
 * contributes nothing for raw HTML or footnote references.
 *
 * @public
 */
export interface DocumentHeading {
	readonly node: Heading;
	readonly depth: HeadingDepth;
	readonly text: string;
}

/**
 * A heading-delimited span from {@link MarkdownDocument.sections}: the
 * heading, its depth, the source `range` the section occupies and the
 * root-level blocks that follow the heading inside it.
 *
 * @remarks
 * A section runs from its heading's start offset to the start of the next
 * root-level heading of equal or shallower depth, or to the end of the
 * source. Deeper headings nest inside, so a parent section's `range` and
 * `children` include its subsections — the list is flat, in document order,
 * with `depth` carrying the hierarchy.
 *
 * Instances come from {@link MarkdownDocument.sections} and the two finders;
 * there is no reason to construct one directly.
 *
 * @public
 */
export class DocumentSection {
	/** The heading that opens the section. */
	readonly heading: Heading;
	/** The heading's depth, and the section's. */
	readonly depth: HeadingDepth;
	/** The whole section including its heading — spliceable by `MarkdownEdit`. */
	readonly range: MarkdownRange;
	/** The root-level blocks after the heading, subsections included. */
	readonly children: ReadonlyArray<FlowContent>;
	/**
	 * The heading's plain-text content.
	 *
	 * @remarks
	 * The same derivation as {@link DocumentHeading.text}: text and inline-code
	 * values concatenated, image `alt` where present, a hard break as one space,
	 * nothing for raw HTML or footnote references. So `## **1.2.3**` reads
	 * `1.2.3`.
	 */
	readonly text: string;
	/**
	 * The section WITHOUT its heading: from the heading's end offset to the
	 * section's end.
	 *
	 * @remarks
	 * This is the span a "give me the release notes under this version" reader
	 * wants, and the one that is fiddly to derive by hand.
	 */
	readonly bodyRange: MarkdownRange;

	/** The document source these ranges index into. */
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

	/** The section's source text, heading included. */
	get source(): string {
		return this.#documentSource.slice(this.range.offset, this.range.offset + this.range.length);
	}

	/**
	 * The section's source text without its heading.
	 *
	 * @remarks
	 * **Untrimmed, deliberately.** It is exactly the bytes {@link
	 * DocumentSection.bodyRange} describes, so the string and the offsets can
	 * never disagree — a package that publishes a span's offsets and then hands
	 * back a different span is lying about it. Callers that want the tidy form
	 * write `.body.trim()`, visibly.
	 */
	get body(): string {
		return this.#documentSource.slice(this.bodyRange.offset, this.bodyRange.offset + this.bodyRange.length);
	}
}

/**
 * Narrowing options for {@link MarkdownDocument.firstSection} and
 * {@link MarkdownDocument.sectionByHeading}.
 *
 * @public
 */
export interface SectionQueryOptions {
	/**
	 * Restrict to sections opened by a heading of exactly this depth.
	 *
	 * @remarks
	 * Equality, not a maximum: `{ depth: 2 }` is "the H2 sections", which is the
	 * changelog idiom. A depth *range* is a different question and belongs in a
	 * predicate.
	 */
	readonly depth?: HeadingDepth;
}

/**
 * How {@link MarkdownDocument.sectionByHeading} decides a section matches: an
 * exact trimmed-text string, a `RegExp`, or a predicate over the text and the
 * section.
 *
 * @public
 */
export type SectionHeadingMatch = string | RegExp | ((text: string, section: DocumentSection) => boolean);

/**
 * The node types {@link MarkdownDocument.links} collects: the nodes that
 * carry an outbound URL themselves ({@link Link}, {@link Image},
 * {@link Definition}) and the reference nodes that reach one through the
 * definition index ({@link LinkReference}, {@link ImageReference}).
 *
 * @public
 */
export type LinkBearingNode = Link | Image | Definition | LinkReference | ImageReference;

/**
 * A link entry from {@link MarkdownDocument.links}: the link-bearing node and
 * the URL it points at.
 *
 * @remarks
 * `url` is the node's own `url` field, unmodified — bundle-relative and
 * otherwise non-normalized hrefs pass through exactly as written. For
 * reference nodes it is the matching definition's `url`; when no definition
 * matches (possible only on trees decoded from foreign mdast — the parser
 * never forms an unmatched reference), the field is genuinely absent.
 *
 * @public
 */
export interface DocumentLink {
	readonly node: LinkBearingNode;
	readonly url?: string;
}

// The accessor walks recurse over the tree, so they share the engine's depth
// cap. A getter has no typed error channel, so — like `applyAll`'s overlap
// guard — an over-deep tree (reachable only via a hand-built or foreign
// decoded tree; the parser refuses deeper input) is a thrown defect.
type NavigationNode = Frontmatter | MarkdownNode;

const walkTree = (node: NavigationNode, depth: number, visit: (node: NavigationNode) => void): void => {
	if (depth > MAX_NESTING_DEPTH) {
		throw new Error(`NestingDepthExceeded: limit ${MAX_NESTING_DEPTH} exceeded while walking the document tree`);
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
		throw new Error(`NestingDepthExceeded: limit ${MAX_NESTING_DEPTH} exceeded while walking the document tree`);
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
	typeof selector === "string" ? (node: MarkdownNode): boolean => node.type === selector : selector;

// The plain-text projection of phrasing content, for DocumentHeading.text and
// DocumentSection.text. MDX policy: a JSX text wrapper is transparent — its
// children's text comes through, so `<span>Title</span>` reads "Title" — while
// a text EXPRESSION contributes nothing: its value is code, not prose, and no
// rendering of it is faithful plain text.
const phrasingText = (nodes: ReadonlyArray<PhrasingContent>): string => {
	let out = "";
	for (const node of nodes) {
		switch (node.type) {
			case "text":
			case "inlineCode":
				out += node.value;
				break;
			case "break":
				out += " ";
				break;
			case "image":
			case "imageReference":
				out += node.alt ?? "";
				break;
			case "emphasis":
			case "strong":
			case "delete":
			case "link":
			case "linkReference":
			case "mdxJsxTextElement":
				out += phrasingText(node.children);
				break;
			case "mdxTextExpression":
				// Deliberately no text — see the policy note above.
				break;
			default:
				break;
		}
	}
	return out;
};

/**
 * A parsed markdown document: the original `source`, the mdast-shaped
 * {@link Root} tree, the non-fatal {@link MarkdownDiagnostic}s the parse
 * produced, and the link-reference `definitions` index.
 *
 * @remarks
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
 * @example
 * ```ts
 * import { MarkdownDocument } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const doc = yield* MarkdownDocument.parse("# Title\n\nSee [docs](./docs.md).\n\n## Usage\n");
 *   doc.headings.map((heading) => heading.text); // ["Title", "Usage"]
 *   doc.links.map((link) => link.url); // ["./docs.md"]
 * });
 * ```
 *
 * @public
 */
export class MarkdownDocument extends S.Class<MarkdownDocument>("MarkdownDocument")({
	source: S.String,
	root: Root,
	diagnostics: S.Array(MarkdownDiagnostic),
	definitions: S.ReadonlyMap(S.String, Definition),
}) {
	/**
	 * The document's frontmatter capture, or `undefined` when there is none.
	 *
	 * @remarks
	 * Derived from the tree rather than stored: a {@link Frontmatter} node can
	 * only ever sit at the head of `root.children` (the capture fires at most
	 * once, at offset 0), so the tree is the single source of truth and the
	 * accessor can never disagree with it. `undefined` covers both a document
	 * with no frontmatter block and one parsed with the capture toggle off —
	 * {@link MarkdownDocument.hasFrontmatterBlock} tells the two apart.
	 */
	get frontmatter(): Frontmatter | undefined {
		const head = this.root.children[0];
		return head !== undefined && head.type === "frontmatter" ? head : undefined;
	}

	/**
	 * Whether the source opens with a well-formed frontmatter block —
	 * regardless of how the document was parsed.
	 *
	 * @remarks
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
	 */
	get hasFrontmatterBlock(): boolean {
		return scanFrontmatter(preprocessLines(this.source), this.source) !== null;
	}

	/**
	 * Every heading in the document, in document order, wherever it sits —
	 * including headings nested inside blockquotes and list items.
	 *
	 * @remarks
	 * Each {@link DocumentHeading} carries the node, its depth and its
	 * plain-text content. For an outline restricted to section boundaries, use
	 * {@link MarkdownDocument.sections}, which considers root-level headings
	 * only.
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
	 * @remarks
	 * Only root-level headings delimit sections — a heading inside a
	 * blockquote or list cannot mark a span of root-level source. Content
	 * before the first heading (the preamble) and the frontmatter block belong
	 * to no section. Each {@link DocumentSection.range} is spliceable by the
	 * edit layer: it runs from the heading's start offset to the next
	 * boundary heading's start, or to the end of the source.
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
	 * @remarks
	 * `firstSection({ depth: 2 })` is "the newest entry" for a changelog whose
	 * releases are H2s under an H1 title. Like the other navigation accessors
	 * this recomputes {@link MarkdownDocument.sections}; a caller scanning one
	 * document repeatedly should bind `document.sections` once instead.
	 *
	 * @param options - Depth restriction.
	 * @returns The first matching section, or `undefined`.
	 */
	firstSection(options?: SectionQueryOptions): DocumentSection | undefined {
		const depth = options?.depth;
		return this.sections.find((section) => depth === undefined || section.depth === depth);
	}

	/**
	 * The first section whose heading matches, in document order.
	 *
	 * @remarks
	 * A **string matches the trimmed heading text exactly** — never a substring.
	 * That is a deliberate refusal of the obvious convenience: `"1.2.3"` would
	 * otherwise match a `## 1.2.30` heading, and in a changelog (where `1.2.30`
	 * sorts newer and therefore sits *earlier*) that silently publishes the
	 * wrong release. A `RegExp` is tested against the same trimmed text, and its
	 * `lastIndex` is reset first so a `/g/` pattern cannot skip sections. A
	 * predicate receives the raw {@link DocumentSection.text} plus the section
	 * itself and decides freely.
	 *
	 * @param match - A string, a RegExp, or a predicate.
	 * @param options - Depth restriction, applied before matching.
	 * @returns The first matching section, or `undefined`.
	 */
	sectionByHeading(match: SectionHeadingMatch, options?: SectionQueryOptions): DocumentSection | undefined {
		const depth = options?.depth;
		const matches: (section: DocumentSection) => boolean =
			typeof match === "string"
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
	 * @remarks
	 * See {@link DocumentLink} for the url semantics — the raw `url` string
	 * passes through unmodified, and an unresolvable foreign reference leaves
	 * the field genuinely absent. Autolinks and GFM autolink literals are
	 * {@link Link} nodes, so they appear with no special casing. Footnote
	 * references carry no URL and are not link entries.
	 */
	get links(): ReadonlyArray<DocumentLink> {
		const entries: Array<DocumentLink> = [];
		for (const child of this.root.children) {
			walkTree(child, 1, (node) => {
				switch (node.type) {
					case "link":
					case "image":
					case "definition":
						entries.push({ node, url: node.url });
						break;
					case "linkReference":
					case "imageReference": {
						const definition = this.definitions.get(normalizeLabelText(node.identifier));
						entries.push(definition === undefined ? { node } : { node, url: definition.url });
						break;
					}
					default:
						break;
				}
			});
		}
		return entries;
	}

	/**
	 * Find the first node matching a selector, in document pre-order — the
	 * same order {@link MarkdownVisitor} enters nodes, starting at the root
	 * itself.
	 *
	 * @remarks
	 * A string selector matches on the node's `type` tag and narrows the
	 * result (`find("heading")` is `Heading | undefined`); a type-guard
	 * predicate narrows the same way, and a plain predicate returns the wide
	 * `MarkdownNode` union. The returned node is the document's own — matched
	 * and returnable by identity, so it feeds `MarkdownFormat.modify`
	 * directly. Like the navigation getters, the walk is synchronous with no
	 * error channel: a tree nested past the depth cap (reachable only via a
	 * hand-built or foreign decoded tree) is a thrown defect.
	 *
	 * @param selector - A node `type` tag or a predicate over nodes.
	 * @returns The first matching node in document order, or `undefined`.
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
	 * @remarks
	 * Selector and narrowing semantics are `MarkdownDocument.find`'s; so is
	 * the guard posture — an over-deep hand-built or foreign tree is a
	 * thrown defect. Nodes are the document's own, matched by identity, so
	 * `findAll("heading")[1]` addresses the second heading for
	 * `MarkdownFormat.modify` without raw child indexing.
	 *
	 * @param selector - A node `type` tag or a predicate over nodes.
	 * @returns Every matching node, in document order; empty when none match.
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
	 * @remarks
	 * Carries no span: it is not an `Effect`. Effect callers should reach for
	 * {@link MarkdownDocument.parse}, which carries the
	 * `MarkdownDocument.parse` tracing span.
	 *
	 * @param text - The markdown source to parse.
	 * @param options - Optional {@link MarkdownParseOptions}; the dialect
	 *   defaults to `"gfm"`.
	 * @returns A `Result` succeeding with the document, or failing with
	 *   `MarkdownParseError`.
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
			}),
		);
	}

	/**
	 * Parse markdown into a {@link MarkdownDocument}. Defined in terms of
	 * {@link MarkdownDocument.parseResult} — synchronous callers can use that
	 * variant directly.
	 *
	 * @param text - The markdown source to parse.
	 * @param options - Optional {@link MarkdownParseOptions}; the dialect
	 *   defaults to `"gfm"`.
	 * @returns An `Effect` that succeeds with the document, or fails with
	 *   `MarkdownParseError`.
	 */
	static readonly parse = Effect.fn("MarkdownDocument.parse")((text: string, options?: MarkdownParseOptions) =>
		Effect.fromResult(MarkdownDocument.parseResult(text, options)),
	);
}
