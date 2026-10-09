/**
 * Managed sections in files: marker-delimited blocks a tool owns inside a file
 * whose surrounding content belongs to the user. `SectionDocument` is the pure
 * string-to-string core, `ManagedSection` the `FileSystem`-backed service, and
 * `CommentStyle` and `SectionDialect` describe how markers are written and
 * scanned.
 *
 * @packageDocumentation
 */

export { CommentStyle } from "./CommentStyle.ts";
export {
	ManagedSection,
	type ManagedSectionOptions,
	type ManagedSectionShape,
	SectionFileError,
} from "./ManagedSection.ts";
export { PlacedSection, Section, SectionId, SectionKey } from "./Section.ts";
export { type Eol, SectionDialect, SectionRenderError } from "./SectionDialect.ts";
export { SectionDocument, SectionParseError, type SectionReconciliation } from "./SectionDocument.ts";
export { CheckOutcome, SyncOutcome } from "./SectionOutcome.ts";
