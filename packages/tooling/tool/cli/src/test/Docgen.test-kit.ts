/**
 * Source-only test kit for docgen command internals.
 *
 * @internal
 * @since 0.0.0
 */

export * from "../commands/Docgen/Doctest.errors.ts";
export * from "../commands/Docgen/Doctest.schemas.ts";
export * from "../commands/Docgen/Doctest.service.ts";
export * from "../commands/Docgen/index.ts";
export {
  analyzeDoctestSourceForTesting,
  classifyDoctestFence,
  DoctestFenceAnalyzerLive,
  DoctestFenceRewriterLive,
  makeDoctestAnalyzerLayer,
  makeDoctestRewriterLayer,
  planConsoleRewrites,
  quotedDoctestName,
  rewriteDoctestSourceForTesting,
  validateDoctestAssertions,
} from "../commands/Docgen/internal/Doctest.ts";
export * from "../commands/Docgen/internal/Local.ts";
export * from "../commands/Docgen/internal/Operations.ts";
export * from "../commands/Docgen/internal/Quality.ts";
export * from "../commands/Docgen/internal/QualityWorkerEval.ts";
export * from "../commands/Docgen/internal/QualityWorkerRunpodEval.ts";
export { isDoctestSourcePath } from "../internal/jsdoc/DoctestSource.ts";
export {
  fencedLineState,
  JSDocSection,
  JSDocSectionName,
  jsDocSectionBodyText,
  jsDocSectionOrder,
  jsdocCommentsFromSource,
  jsdocOwnersByStart,
  ownJSDocNodeName,
  ParseJSDocSectionsOptions,
  ParseJSDocSectionsResult,
  parseJSDocSections,
  RawJSDocSpan,
  rawJSDocSpans,
} from "../internal/jsdoc/JSDocSections.ts";
