import * as Data from "effect/Data";
import type { Section, SectionId } from "./Section.ts";

/**
 * What a sync did to one declared section.
 *
 * @remarks
 * `Updated` carries **both sides** rather than a diff, so a pure line
 * reordering is never reported as "nothing changed". A caller wanting a
 * rendering diffs `before.content` against `after.content` with the diff
 * library of its choice.
 *
 * @public
 */
export type SyncOutcome = Data.TaggedEnum<{
	/** The section was not in the document and has been added. */
	readonly Created: { readonly section: Section };
	/** The section was present with different content and has been rewritten. */
	readonly Updated: { readonly before: Section; readonly after: Section };
	/** The section was already exactly as declared. */
	readonly Unchanged: { readonly section: Section };
}>;

/**
 * Constructors and matchers for `SyncOutcome` — e.g.
 * `SyncOutcome.Created({ section })`, `SyncOutcome.$is("Updated")`.
 *
 * @public
 */
export const SyncOutcome = Data.taggedEnum<SyncOutcome>();

/**
 * What a check found, without touching the document.
 *
 * @remarks
 * Three flat variants (`Absent`, `UpToDate`, `Drifted`), so every caller
 * branches once on one tag instead of through a nested check.
 *
 * @public
 */
export type CheckOutcome = Data.TaggedEnum<{
	/** No section with this identity is in the document. */
	readonly Absent: { readonly id: SectionId };
	/** The document already says exactly what was declared. */
	readonly UpToDate: { readonly section: Section };
	/** The document has this section, with different content. */
	readonly Drifted: { readonly onDisk: Section; readonly expected: Section };
}>;

/**
 * Constructors and matchers for `CheckOutcome` — e.g.
 * `CheckOutcome.Absent({ id })`, `CheckOutcome.$is("Drifted")`.
 *
 * @public
 */
export const CheckOutcome = Data.taggedEnum<CheckOutcome>();
