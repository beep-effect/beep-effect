// The marker scanner: locate every managed section in a document, in order,
// and refuse any structure that could only be resolved by guessing.
//
// Ambiguity is a typed failure rather than a silent choice: skipping an
// unterminated begin marker or picking the first begin/end pair by `indexOf`
// are silent wrong answers with a file-corrupting tail — a skipped marker
// makes the next write append a SECOND copy of the section, and a duplicate
// means every sync updates the first copy while the stale second lives on
// disk forever.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as A from "effect/Array";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { dual } from "effect/Function";
import * as MutableHashMap from "effect/MutableHashMap";
import * as MutableHashSet from "effect/MutableHashSet";
import type { CommentStyle } from "../CommentStyle.ts";
import { PlacedSection, Section } from "../Section.ts";
import type { Eol, SectionDialect } from "../SectionDialect.ts";
import { parseAttributeRun } from "./attributes.ts";
import * as O from "@beep/utils/Option";

const $I = $ScratchpadId.create("effected/templates/internal/scan");

/** The ways a document can be structurally unreadable. */
export const ScanFailureReason = LiteralKit([
	"unterminatedSection", "orphanedEnd", "overlappingSections", "duplicateSection",
]).annotate($I.annote("ScanFailureReason", { description: "The ambiguities refused by the managed-section scanner." }));
export type ScanFailureReason = typeof ScanFailureReason.Type;

/** The existing ordered list of scanner failure reasons. */
export const SCAN_FAILURE_REASONS = ScanFailureReason.literals;

/** A scanner failure retains its required, explicitly undefined-capable key. */
export const ScanFailure = S.Struct({
	reason: ScanFailureReason.annotateKey({ description: "The first structural ambiguity found." }),
	line: S.Finite.annotateKey({ description: "The one-based line of the offending marker." }),
	key: S.UndefinedOr(S.String).annotateKey({ description: "The section key, explicitly undefined when unknown." }),
}).annotate($I.annote("ScanFailure", { description: "A plain scanner failure with its reason and marker location." }));
export type ScanFailure = typeof ScanFailure.Type;

/** Plain scan results keep the boolean ok discriminant and variant-specific fields. */
export const ScanResult = S.Union([
	S.Struct({
		ok: S.Literal(true).annotateKey({ description: "The scan succeeded." }),
		sections: S.Array(S.suspend(() => PlacedSection)).annotateKey({ description: "Located sections in source order." }),
	}),
	S.Struct({
		ok: S.Literal(false).annotateKey({ description: "The scan failed." }),
		failure: ScanFailure.annotateKey({ description: "The first structural failure." }),
	}),
]).annotate($I.annote("ScanResult", { description: "Either located sections or the first ambiguity, in plain-object form." }));
export type ScanResult = typeof ScanResult.Type;

/** A document's dominant line ending. Any CRLF makes the document CRLF. */
export const detectEol = (text: string): Eol => (text.includes("\r\n") ? "\r\n" : "\n");

/**
 * Collapse CRLF to LF.
 *
 * **Details**
 *
 * Applied to section content at parse time so that the `Section` values the
 * rest of the package compares are already canonical. Doing it here rather
 * than inside equality keeps `Equal.equals` honest for a consumer comparing
 * two sections directly, and it is what stops a CRLF document from reporting
 * drift on every single run.
 */
export const normalizeEol = (text: string): string => text.replace(/\r\n/g, "\n");

/** Strip exactly one line break from the start of a string. */
const stripLeadingBreak = (text: string): string =>
	text.startsWith("\r\n") ? text.slice(2) : text.startsWith("\n") ? text.slice(1) : text;

/** Strip exactly one line break from the end of a string. */
const stripTrailingBreak = (text: string): string =>
	text.endsWith("\r\n") ? text.slice(0, -2) : text.endsWith("\n") ? text.slice(0, -1) : text;

/** Offsets at which each 1-based line starts, for O(log n) line lookup. */
const lineStarts = (text: string): ReadonlyArray<number> => {
	const starts = [0];
	for (let index = 0; index < text.length; index += 1) {
		if (text.charCodeAt(index) === 10) {
			starts.push(index + 1);
		}
	}
	return starts;
};

const lineAt = (starts: ReadonlyArray<number>, offset: number): number => {
	let low = 0;
	let high = starts.length - 1;
	while (low < high) {
		const mid = (low + high + 1) >> 1;
		if ((starts[mid] ?? 0) <= offset) {
			low = mid;
		} else {
			high = mid - 1;
		}
	}
	return low + 1;
};

/** A raw marker hit, before any structural interpretation. */
interface MarkerHit {
	readonly kind: "BEGIN" | "END";
	readonly key: string;
	readonly style: CommentStyle;
	readonly start: number;
	readonly end: number;
	/** The BEGIN marker's parsed attribute pairs, in document order. */
	readonly attributes?: Record<string, string>;
}

/** The identity two sections must share to be duplicates of each other. */
export const identityOf: {
	(key: string, style: CommentStyle): string;
	(style: CommentStyle): (key: string) => string;
} = dual(2, (key: string, style: CommentStyle): string => `${key}\u0000${style.id}`);

const collectHits = (text: string, dialect: SectionDialect): ReadonlyArray<MarkerHit> => {
	const hits: Array<MarkerHit> = [];
	const seen = MutableHashSet.empty<number>();
	for (const matcher of dialect.matchers()) {
		for (const match of text.matchAll(matcher.regex)) {
			const start = match.index;
			// Two styles could in principle match one line; the first wins so a
			// marker is never counted twice.
			if (start === undefined || MutableHashSet.has(seen, start)) {
				continue;
			}
			// The loosely-captured attribute run decides whether this line is a
			// marker at all. An END never carries attributes, and a run that does
			// not parse cleanly is not a marker — the line is ordinary content,
			// and any structural ambiguity that creates (an END now orphaned, a
			// BEGIN now unterminated) fails typed downstream rather than being
			// resolved by a guess here.
			const run = match[3];
			let attributes: Record<string, string> | undefined;
			if (run !== undefined) {
				if (match[1] === "END") {
					continue;
				}
				attributes = parseAttributeRun(run);
				if (attributes === undefined) {
					continue;
				}
			}
			MutableHashSet.add(seen, start);
			hits.push({
				kind: match[1] === "BEGIN" ? "BEGIN" : "END",
				key: match[2] ?? "",
				style: matcher.style,
				start,
				end: start + match[0].length,
				// An absent optional field must be OMITTED, not set to undefined.
				...O.getSomesStruct({ attributes: O.fromUndefinedOr(attributes) }),
			});
		}
	}
	return A.sort(hits, Order.mapInput(Order.Number, (hit: MarkerHit) => hit.start));
};

/**
 * Locate every managed section, in document order.
 *
 * **Details**
 *
 * A bounded linear pass — no recursion, so no stack-overflow surface on
 * hostile input. Sections cannot nest: a begin marker encountered while
 * another section is open is `overlappingSections`, not an inner block.
 */
export const scan: {
	(text: string, dialect: SectionDialect): ScanResult;
	(dialect: SectionDialect): (text: string) => ScanResult;
} = dual(2, (text: string, dialect: SectionDialect): ScanResult => {
	const starts = lineStarts(text);
	const sections: Array<PlacedSection> = [];
	const firstSeenAt = MutableHashMap.empty<string, number>();
	let open: MarkerHit | undefined;

	for (const hit of collectHits(text, dialect)) {
		if (hit.kind === "BEGIN") {
			if (open !== undefined) {
				return { ok: false, failure: { reason: "overlappingSections", line: lineAt(starts, hit.start), key: hit.key } };
			}
			open = hit;
			continue;
		}

		// An end marker must close the section that is actually open — same key
		// and same comment style. Anything else is a document whose block
		// boundaries cannot be determined without guessing.
		if (open === undefined || open.key !== hit.key || open.style.id !== hit.style.id) {
			return { ok: false, failure: { reason: "orphanedEnd", line: lineAt(starts, hit.start), key: hit.key } };
		}

		const identity = identityOf(open.key, open.style);
		if (MutableHashMap.has(firstSeenAt, identity)) {
			return { ok: false, failure: { reason: "duplicateSection", line: lineAt(starts, open.start), key: open.key } };
		}
		MutableHashMap.set(firstSeenAt, identity, open.start);

		const inner = stripTrailingBreak(stripLeadingBreak(text.slice(open.end, hit.start)));
		sections.push(
			PlacedSection.make({
				section: Section.make({
					key: open.key,
					commentStyle: open.style,
					content: normalizeEol(inner),
					// Omitted when the marker carries none: the constructor default
					// fills the canonical empty record, so a bare marker and an
					// explicit `attributes: {}` are the same section under equality.
					...O.getSomesStruct({ attributes: O.fromUndefinedOr(open.attributes) }),
				}),
				start: open.start,
				end: hit.end,
				line: lineAt(starts, open.start),
			}),
		);
		open = undefined;
	}

	if (open !== undefined) {
		return { ok: false, failure: { reason: "unterminatedSection", line: lineAt(starts, open.start), key: open.key } };
	}

	return { ok: true, sections };
});
