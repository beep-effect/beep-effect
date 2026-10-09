import { Effect, Equal, Option, Result, Schema } from "effect";
import { reconcile } from "./internal/reconcile.ts";
import { SCAN_FAILURE_REASONS, detectEol, identityOf, normalizeEol, scan } from "./internal/scan.ts";
import type { Section, SectionId } from "./Section.ts";
import { PlacedSection } from "./Section.ts";
import type { Eol, SectionRenderError } from "./SectionDialect.ts";
import { SectionDialect } from "./SectionDialect.ts";
import type { SyncOutcome } from "./SectionOutcome.ts";
import { CheckOutcome } from "./SectionOutcome.ts";

/**
 * Raised when a document's managed-section structure cannot be read without
 * guessing.
 *
 * @remarks
 * Every reason names an ambiguity whose silent resolution corrupts a file.
 * A skipped unterminated marker makes the next write append a **second** copy
 * of the section; a duplicate means every sync updates the first copy while
 * the stale second one lives on disk forever. Malformed input therefore fails
 * through the typed channel with the line that identifies it, and the user
 * fixes their file.
 *
 * @public
 */
export class SectionParseError extends Schema.TaggedError<SectionParseError>()("SectionParseError", {
	/** Which ambiguity was found. */
	reason: Schema.Literals(SCAN_FAILURE_REASONS),
	/** 1-based line of the offending marker. */
	line: Schema.Number,
	/** The section key involved, when the failure names one. */
	key: Schema.optionalKey(Schema.String),
	/** The file the document came from. Absent for a document parsed from a string. */
	path: Schema.optionalKey(Schema.String),
}) {
	override get message(): string {
		const where = this.path === undefined ? `line ${this.line}` : `${this.path}:${this.line}`;
		const which = this.key === undefined ? "" : ` for section "${this.key}"`;
		return `${REASON_PROSE[this.reason]}${which} at ${where}`;
	}

	/**
	 * The same failure, attributed to a file.
	 *
	 * @remarks
	 * The pure core has no path to report; the service that read the file
	 * attaches one on the way out.
	 */
	static at(path: string, error: SectionParseError): SectionParseError {
		return SectionParseError.make({
			reason: error.reason,
			line: error.line,
			// An `optionalKey` field must be OMITTED rather than set to undefined.
			...(error.key === undefined ? {} : { key: error.key }),
			path,
		});
	}
}

const REASON_PROSE: Record<(typeof SCAN_FAILURE_REASONS)[number], string> = {
	unterminatedSection: "Managed section is never closed",
	orphanedEnd: "End marker closes no open section",
	overlappingSections: "Managed section opens inside another",
	duplicateSection: "Managed section appears twice",
};

/**
 * The result of reconciling a declared set of sections against a document.
 *
 * @remarks
 * A plain interface rather than a `Schema.Class`: `outcomes` holds
 * `SyncOutcome` values, which are a `Data.TaggedEnum` and therefore not
 * a schema, so the class form would be schema-shaped in name only.
 *
 * @public
 */
export interface SectionReconciliation {
	/** The document as it should now read. */
	readonly text: string;
	/** One outcome per declared section, in declared order. */
	readonly outcomes: ReadonlyArray<SyncOutcome>;
	/** Whether `text` differs from the document it was reconciled against. */
	readonly changed: boolean;
}

/**
 * A parsed document: its text, the dialect it was read with, and every
 * managed section found in it.
 *
 * @remarks
 * This is the package's pure core. Parsing, inspection, reconciliation and
 * removal are all string-to-string, so every interesting invariant —
 * idempotency, text preservation, ordering normalization, line-ending
 * handling, marker-injection refusal — is assertable from a string literal
 * with no layer, no runtime and no filesystem.
 *
 * @example
 * ```ts
 * import { CommentStyle, SectionDocument, SectionId } from "./index.ts";
 * import { Result } from "effect";
 *
 * const doc = SectionDocument.parseResult(source);
 * if (Result.isSuccess(doc)) {
 *   const id = SectionId.make({ key: "example-tool", commentStyle: CommentStyle.hash });
 *   const next = doc.success.reconcile([id.section("echo hello")]);
 * }
 * ```
 *
 * @public
 */
export class SectionDocument extends Schema.Class<SectionDocument>("SectionDocument")({
	/** The document's source text, exactly as parsed. */
	text: Schema.String,
	/** The marker vocabulary this document was read with. */
	dialect: SectionDialect,
	/** Every managed section found, in document order. */
	sections: Schema.Array(PlacedSection),
	/** The document's dominant line ending. */
	eol: Schema.Literals(["\n", "\r\n"]),
}) {
	/**
	 * Parse a document. The synchronous primitive.
	 *
	 * @remarks
	 * Pure computation exposes the sync form as the primitive; {@link SectionDocument.parse}
	 * derives from this and adds only the tracing span, so the two cannot drift.
	 * Synchronous callers — a lint hook, a build plugin — use this directly and
	 * never build an Effect runtime.
	 */
	static parseResult(
		text: string,
		dialect: SectionDialect = SectionDialect.default,
	): Result.Result<SectionDocument, SectionParseError> {
		const scanned = scan(text, dialect);
		if (!scanned.ok) {
			const { reason, line, key } = scanned.failure;
			return Result.fail(SectionParseError.make({ reason, line, ...(key === undefined ? {} : { key }) }));
		}
		return Result.succeed(SectionDocument.make({ text, dialect, sections: scanned.sections, eol: detectEol(text) }));
	}

	/**
	 * Parse a document, in `Effect`.
	 *
	 * @remarks
	 * Defined in terms of {@link SectionDocument.parseResult} — synchronous
	 * callers can use that variant directly.
	 */
	static readonly parse = Effect.fn("SectionDocument.parse")(
		(text: string, dialect: SectionDialect = SectionDialect.default) =>
			Effect.fromResult(SectionDocument.parseResult(text, dialect)),
	);

	/** The section with this identity, if the document has one. */
	read(id: SectionId): Option.Option<Section> {
		const identity = identityOf(id.key, id.commentStyle);
		const found = this.sections.find(
			(placed) => identityOf(placed.section.key, placed.section.commentStyle) === identity,
		);
		return found === undefined ? Option.none() : Option.some(found.section);
	}

	/** Whether the document carries a section with this identity. */
	has(id: SectionId): boolean {
		return Option.isSome(this.read(id));
	}

	/**
	 * Compare a declared section against the document, changing nothing.
	 *
	 * @remarks
	 * Total: there is no way for a comparison to fail. Line endings are
	 * normalized on both sides, so a CRLF document does not report drift
	 * against LF content forever.
	 */
	check(section: Section): CheckOutcome {
		const expected = section.withContent(normalizeEol(section.content));
		const current = this.read(section.id);
		if (Option.isNone(current)) {
			return CheckOutcome.Absent({ id: section.id });
		}
		return Equal.equals(current.value, expected)
			? CheckOutcome.UpToDate({ section: current.value })
			: CheckOutcome.Drifted({ onDisk: current.value, expected });
	}

	/**
	 * Fit a declared set of sections into this document.
	 *
	 * @remarks
	 * Declared sections come back **in declared order** — the ordering
	 * normalization is a guarantee consumers depend on, not a side effect.
	 * Text outside a managed span and sections this dialect does not own are
	 * preserved byte-for-byte. Nothing is rendered into the output until every
	 * declared section has rendered successfully, so a refusal leaves the
	 * document untouched.
	 */
	reconcile(sections: ReadonlyArray<Section>): Result.Result<SectionReconciliation, SectionRenderError> {
		return reconcile({
			text: this.text,
			placed: this.sections,
			declared: sections.map((section) => section.withContent(normalizeEol(section.content))),
			dialect: this.dialect,
			eol: this.eol,
		});
	}

	/**
	 * The document with this section removed, or `none` if it was not there.
	 *
	 * @remarks
	 * The blank lines around the removed block collapse into a single
	 * separator, so repeated removals never accumulate gaps.
	 */
	remove(id: SectionId): Option.Option<string> {
		const identity = identityOf(id.key, id.commentStyle);
		const found = this.sections.find(
			(placed) => identityOf(placed.section.key, placed.section.commentStyle) === identity,
		);
		if (found === undefined) {
			return Option.none();
		}
		const eol: Eol = this.eol;
		const before = this.text.slice(0, found.start).replace(/(?:\r?\n)+$/, "");
		const after = this.text.slice(found.end).replace(/^(?:\r?\n)+/, "");
		if (before !== "" && after !== "") {
			return Option.some(`${before}${eol}${eol}${after}`);
		}
		if (before !== "") {
			return Option.some(`${before}${eol}`);
		}
		return Option.some(after);
	}
}
