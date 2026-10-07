/** Source-only research library test seams.
 * @packageDocumentation
 * @since 0.0.0
 */
export { acquireLibrarySource } from "../commands/Research/Library/Library.acquire.ts";
export {
  decodeLibraryJson,
  encodeLibraryJson,
  LibraryAdapterResult,
  runLibraryCommand,
  sanitizeLibraryDiagnostic,
  saveLibraryText,
} from "../commands/Research/Library/Library.adapter.ts";
export { runLibraryVerificationCommand } from "../commands/Research/Library/Library.command.ts";
export * from "../commands/Research/Library/Library.corrections.ts";
export * from "../commands/Research/Library/Library.events.ts";
export * from "../commands/Research/Library/Library.evidence.ts";
export { acquireLibraryGithub } from "../commands/Research/Library/Library.github.ts";
export * from "../commands/Research/Library/Library.integrity.ts";
export * from "../commands/Research/Library/Library.provenance.ts";
export { mergeLibraryVersions } from "../commands/Research/Library/Library.store.ts";
export * from "../commands/Research/Library/Library.versions.ts";
export { acquireLibraryPaper, acquireLibraryWeb } from "../commands/Research/Library/Library.web.ts";
export { acquireLibraryYoutube, libraryCaptionProvenance } from "../commands/Research/Library/Library.youtube.ts";
