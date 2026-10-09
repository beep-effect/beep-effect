import { $ScratchpadId } from "@beep/identity/packages";
import type { SectionParseError } from "../templates/index.ts";
import { CommentStyle, SectionDialect, SectionDocument, SectionId } from "../templates/index.ts";
import * as Effect from "effect/Effect";
import * as O from "@beep/utils/Option";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $ScratchpadId.create("effected/github-actions/ManagedDocument");

/** The region dialect rejected its own comment style. */
export class RejectedRegionDialectError extends S.TaggedError<RejectedRegionDialectError>($I`RejectedRegionDialectError`)("RejectedRegionDialectError", {
	message: S.String,
}, $I.annote("RejectedRegionDialectError", { description: "The region dialect rejected its own comment style." })) {}

/**
 * The grammar shared by a document's `namespace`, its `key` and every region
 * key.
 *
 * @remarks
 * Letters, digits, dashes and underscores, starting alphanumeric. Dots are
 * excluded deliberately: the three parts are joined with `.` into the marker
 * key written to the wire (`namespace.key.region`), and a dot inside a part
 * would make two different documents spell the same marker.
 */
const NamePart = S.String.check(S.isPattern(/^[A-Za-z0-9][A-Za-z0-9_-]*$/u));

/**
 * The marker vocabulary every managed document is written with: HTML comments
 * — the one comment style GitHub renders invisibly — and a phrase distinct
 * from `@effected/templates`' default, so a document that also carries
 * ordinary `MANAGED SECTION` blocks never has them mistaken for regions.
 */
const REGION_DIALECT: SectionDialect = SectionDialect.make({
	phrase: "MANAGED REGION",
	styles: [CommentStyle.html],
});

/**
 * Raised when a managed document cannot be read or regenerated without
 * guessing.
 *
 * @remarks
 * The four structural kinds (`unterminatedRegion`, `orphanedEnd`,
 * `overlappingRegions`, `duplicateRegion`) surface at parse time and name an
 * ambiguity whose silent resolution would corrupt content a human wrote by
 * hand. The three declaration kinds surface when regions are applied:
 * `markerInContent` refuses region content that itself contains a line the
 * scanner would read as a region marker, `duplicateDeclaration` refuses
 * one call that states two intentions for the same region, and
 * `invalidAttribute` refuses region metadata whose name is outside the
 * `[A-Za-z][A-Za-z0-9_-]*` grammar or whose value contains `"` or a line
 * break — either would write a marker the region scanner could not read
 * back verbatim.
 *
 * @public
 */
export class ManagedDocumentError extends S.TaggedError<ManagedDocumentError>($I`ManagedDocumentError`)("ManagedDocumentError", {
	/** Which ambiguity or refusal was found. */
	kind: S.Literals([
		"unterminatedRegion",
		"orphanedEnd",
		"overlappingRegions",
		"duplicateRegion",
		"markerInContent",
		"duplicateDeclaration",
		"invalidAttribute",
	]).annotateKey({ description: "Which ambiguity or refusal was found." }),
	/** 1-based line of the offending marker, for the structural kinds. */
	line: S.optionalKey(S.Finite).annotateKey({ description: "1-based line of the offending marker, for the structural kinds." }),
	/** The region key involved, when the failure names one. */
	key: S.optionalKey(S.String).annotateKey({ description: "The region key involved, when the failure names one." }),
	/** The offending metadata attribute's name, for `invalidAttribute`. */
	attribute: S.optionalKey(S.String).annotateKey({ description: "The offending metadata attribute's name, for `invalidAttribute`." }),
}, $I.annote("ManagedDocumentError", { description: "Raised when a managed document cannot be read or regenerated without guessing." })) {
	override get message(): string {
		const which = this.key === undefined ? "" : ` for region "${this.key}"`;
		const named = this.attribute === undefined ? "" : ` (attribute "${this.attribute}")`;
		const where = this.line === undefined ? "" : ` at line ${this.line}`;
		return `${KIND_PROSE[this.kind]}${which}${named}${where}`;
	}
}

const KIND_PROSE: Record<ManagedDocumentError["kind"], string> = {
	unterminatedRegion: "Managed region is never closed",
	orphanedEnd: "Region end marker closes no open region",
	overlappingRegions: "Managed region opens inside another",
	duplicateRegion: "Managed region appears twice",
	markerInContent: "Region content contains a managed-region marker",
	duplicateDeclaration: "Region was declared twice in one call",
	invalidAttribute: "Region metadata has an invalid attribute name or value",
};

/** Map a templates scan failure onto this surface's vocabulary. */
const STRUCTURAL_KIND = {
	unterminatedSection: "unterminatedRegion",
	orphanedEnd: "orphanedEnd",
	overlappingSections: "overlappingRegions",
	duplicateSection: "duplicateRegion",
} as const;

/** A structurally corrupt region layout, in this surface's vocabulary. */
const structural = (failure: SectionParseError): ManagedDocumentError =>
	ManagedDocumentError.make({
		kind: STRUCTURAL_KIND[failure.reason],
		line: failure.line,
		...O.getSomesStruct({ key: O.fromUndefinedOr(failure.key) }),
	});

/**
 * Options identifying a managed document inside a text that may not carry one
 * yet.
 *
 * @public
 */
export interface ManagedDocumentSource {
	/** Whose document this is, e.g. your action's name. */
	readonly namespace: string;
	/** Which document, within that namespace. */
	readonly key: string;
	/**
	 * The current text — a fetched comment body, a PR description — or absent
	 * when there is nothing yet. An absent text and an empty one mean the same
	 * thing: a fresh document.
	 */
	readonly text?: string | undefined;
}

/**
 * A marker-delimited document: named regions a tool owns, inside text a human
 * may also edit.
 *
 * @remarks
 * The one primitive behind both the sticky PR comment and the managed PR
 * description. A sentinel HTML comment (`<!-- namespace:key -->`) identifies
 * the document; each region is delimited by HTML-comment markers keyed
 * `namespace.key.region`; and everything outside the managed regions is
 * preserved byte-for-byte on regeneration. Regions are **replaced from
 * current state, never appended** — applying the same region twice yields one
 * region carrying the latest content, which is what makes a check that
 * resolves many times safe to re-render.
 *
 * The region engine is `@effected/templates`' pure `SectionDocument`, fixed to
 * the HTML comment style and a region-specific phrase. Everything here is string → string; the GitHub
 * write path composes this with `PullRequestComment` (whose `CommentMarker`
 * renders the *same* sentinel for the same namespace and key) or a PR-body
 * update in `@effected/github`.
 *
 * Construct with {@link ManagedDocument.parseResult} — create-or-update in
 * one call, so the consumer never branches on whether the document exists
 * yet. `ManagedDocument.make` is the raw schema constructor and performs no
 * structural validation.
 *
 * @example
 * ```ts
 * import { ManagedDocument } from "./index.ts";
 * import * as Result from "effect/Result";
 *
 * const doc = ManagedDocument.parseResult({ namespace: "my-action", key: "release", text: fetched });
 * if (Result.isSuccess(doc)) {
 *   const next = doc.success.withRegionsResult([
 *     ["header", "## Validating Release"],
 *     ["footer", "generated by my-action"],
 *   ]);
 * }
 * ```
 *
 * @public
 */
export class ManagedDocument extends S.Class<ManagedDocument>($I`ManagedDocument`)({
	/** Whose document this is. */
	namespace: NamePart.annotateKey({ description: "Whose document this is." }),
	/** Which document, within that namespace. */
	key: NamePart.annotateKey({ description: "Which document, within that namespace." }),
	/** The document's full text, sentinel and regions included. */
	text: S.String.annotateKey({ description: "The document's full text, sentinel and regions included." }),
}, $I.annote("ManagedDocument", { description: "A marker-delimited document: named regions a tool owns, inside text a human may also edit." })) {
	/**
	 * Read a document out of existing text, or begin a fresh one.
	 *
	 * @remarks
	 * The synchronous primitive; {@link ManagedDocument.parse} derives from it.
	 * Absent text, empty text and text that carries no sentinel are all legal —
	 * the sentinel and regions are added by the first
	 * {@link ManagedDocument.withRegionsResult}. Only a *structurally corrupt*
	 * region layout fails, because every structural ambiguity is a case where
	 * a silent choice would destroy content a human wrote.
	 */
	static parseResult(source: ManagedDocumentSource): Result.Result<ManagedDocument, ManagedDocumentError> {
		const document = ManagedDocument.make({ namespace: source.namespace, key: source.key, text: source.text ?? "" });
		return Result.map(Result.mapError(document.scan(), structural), () => document);
	}

	/**
	 * Read a document out of existing text, in `Effect`.
	 *
	 * @remarks
	 * Defined in terms of {@link ManagedDocument.parseResult} — synchronous
	 * callers can use that variant directly.
	 */
	static readonly parse = Effect.fn("ManagedDocument.parse")((source: ManagedDocumentSource) =>
		Effect.fromResult(ManagedDocument.parseResult(source)),
	);

	/** The HTML comment identifying this document, `<!-- namespace:key -->`. */
	get sentinel(): string {
		return `<!-- ${this.namespace}:${this.key} -->`;
	}

	/** Does this text carry the document's sentinel? */
	matches(text: string): boolean {
		return text.includes(this.sentinel);
	}

	/** The content of one region, if the document carries it. */
	region(key: string): O.Option<string> {
		return O.map(this.entry(key), (found) => found.content);
	}

	/**
	 * One region's content and metadata together, if the document carries it.
	 *
	 * @remarks
	 * `meta` is the region's `name="value"` marker attributes, empty when the
	 * marker carries none. Metadata never participates in region
	 * addressability — this looks up by key exactly as
	 * {@link ManagedDocument.region} does.
	 */
	entry(key: string): O.Option<{ readonly content: string; readonly meta: Readonly<Record<string, string>> }> {
		const found = this.ownRegions().find((candidate) => candidate.key === key);
		return found === undefined ? O.none() : O.some({ content: found.content, meta: found.meta });
	}

	/**
	 * Every region this document carries, in document order.
	 *
	 * @remarks
	 * `meta` is always present: a region whose marker carries no attributes
	 * reports an empty record, so callers never branch on absence.
	 */
	get regions(): ReadonlyArray<{
		readonly key: string;
		readonly content: string;
		readonly meta: Readonly<Record<string, string>>;
	}> {
		return this.ownRegions();
	}

	/**
	 * The document with these regions replaced from current state.
	 *
	 * @remarks
	 * The synchronous primitive; {@link ManagedDocument.withRegions} derives
	 * from it. Each entry pairs a region key with its full new content, plus
	 * optional metadata. A region already present is **replaced in place**; a
	 * region not present yet is added; regions not named are left exactly as
	 * they are; and every byte outside a managed region survives untouched.
	 * Applying entries that change nothing returns byte-identical text, which
	 * is what lets a caller compare-and-skip instead of issuing a write.
	 *
	 * `meta` becomes `name="value"` attributes on the region's BEGIN marker.
	 * It round-trips verbatim through {@link ManagedDocument.entry}, survives
	 * writes by parties that do not know about it — a region not named in a
	 * call keeps its content *and* its metadata untouched — and never
	 * participates in region addressability: a region is found by key alone,
	 * so changing metadata updates the region in place. A two-element entry
	 * supplies no metadata. Names must match
	 * `[A-Za-z][A-Za-z0-9_-]*` and values may not contain `"` or a line
	 * break; violations fail typed as `invalidAttribute`.
	 *
	 * Region keys share the name grammar `namespace` and `key` obey; a key
	 * outside it is a wiring error and throws at construction rather than
	 * surfacing in the typed channel.
	 */
	withRegionsResult(
		entries: ReadonlyArray<readonly [key: string, content: string, meta?: Readonly<Record<string, string>>]>,
	): Result.Result<ManagedDocument, ManagedDocumentError> {
		const parsed = this.scan();
		if (Result.isFailure(parsed)) {
			return parsed.failure.pipe(structural, Result.fail);
		}
		const declared = entries.map(([key, content, meta]) =>
			SectionId.make({ key: this.wireKey(key), commentStyle: CommentStyle.html }).section(content, meta),
		);
		const reconciled = parsed.success.reconcile(declared);
		if (Result.isFailure(reconciled)) {
			const failure = reconciled.failure;
			if (failure.reason === "unknownCommentStyle") {
				// Structurally unreachable: every declared section above is built
				// with the one style the module's own dialect recognizes.
				throw RejectedRegionDialectError.make({ message: "ManagedDocument: the region dialect rejected its own comment style" });
			}
			return Result.fail(
				ManagedDocumentError.make({
					kind: failure.reason,
					key: this.regionKeyOf(failure.key),
					...O.getSomesStruct({ attribute: O.fromUndefinedOr(failure.attribute) }),
				}),
			);
		}
		const withSentinel = this.ensureSentinel(reconciled.success.text, parsed.success.eol);
		return Result.succeed(ManagedDocument.make({ namespace: this.namespace, key: this.key, text: withSentinel }));
	}

	/**
	 * The document with these regions replaced, in `Effect`.
	 *
	 * @remarks
	 * Defined in terms of {@link ManagedDocument.withRegionsResult} —
	 * synchronous callers can use that variant directly.
	 */
	withRegions(
		entries: ReadonlyArray<readonly [key: string, content: string, meta?: Readonly<Record<string, string>>]>,
	): Effect.Effect<ManagedDocument, ManagedDocumentError> {
		return Effect.fromResult(this.withRegionsResult(entries));
	}

	// The scan of `text`, once: the instance is immutable and every accessor
	// reads the same layout, so `CheckDocument.reconcile`'s parse → regions →
	// withRegions pass scans the body once rather than three times.
	#scanned: Result.Result<SectionDocument, SectionParseError> | undefined;

	private scan(): Result.Result<SectionDocument, SectionParseError> {
		this.#scanned ??= SectionDocument.parseResult(this.text, REGION_DIALECT);
		return this.#scanned;
	}

	/** What every wire key of this document's regions begins with. */
	private get wirePrefix(): string {
		return `${this.namespace}.${this.key}.`;
	}

	/** The marker key a region is written under: `namespace.key.region`. */
	private wireKey(region: string): string {
		return `${this.wirePrefix}${region}`;
	}

	/** The region key back out of a wire key, for error reporting. */
	private regionKeyOf(wireKey: string): string {
		return wireKey.startsWith(this.wirePrefix) ? wireKey.slice(this.wirePrefix.length) : wireKey;
	}

	/**
	 * This document's own regions, in document order.
	 *
	 * @remarks
	 * A document a human already edited can be structurally corrupt, and a
	 * read has no error channel worth having — a corrupt document simply has
	 * no readable regions; {@link ManagedDocument.parseResult} is where
	 * corruption fails typed. Regions belonging to a *different* document in
	 * the same text (another namespace or key) are not this document's and are
	 * never reported.
	 */
	private ownRegions(): ReadonlyArray<{
		readonly key: string;
		readonly content: string;
		readonly meta: Readonly<Record<string, string>>;
	}> {
		const parsed = this.scan();
		if (Result.isFailure(parsed)) {
			return [];
		}
		const prefix = this.wirePrefix;
		return parsed.success.sections
			.filter((placed) => placed.section.key.startsWith(prefix))
			.map((placed) => ({
				key: placed.section.key.slice(prefix.length),
				content: placed.section.content,
				meta: placed.section.attributes,
			}));
	}

	/**
	 * Append the sentinel when the text does not carry it yet.
	 *
	 * @remarks
	 * Appended at the end — the same position `PullRequestComment.upsert`
	 * writes its marker to — so a document rendered here and a comment written
	 * there agree about where the identity line lives.
	 */
	private ensureSentinel(text: string, eol: "\n" | "\r\n"): string {
		if (text.includes(this.sentinel)) {
			return text;
		}
		const separator = Str.isEmpty(text) || Str.endsWith("\n")(text) ? "" : eol;
		return `${text}${separator}${this.sentinel}${eol}`;
	}
}
