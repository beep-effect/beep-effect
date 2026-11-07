import { CitationAnnotationEntryConfiguration } from "@beep/law-practice-server/internal/Citation/AnnotationEntry";
import { CitationHtmlDiscoveryConfiguration } from "@beep/law-practice-server/internal/Citation/HtmlDiscovery";
import { CitationHtmlGeometryPreparationConfiguration } from "@beep/law-practice-server/internal/Citation/HtmlGeometryPreparation";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { makeCitationDiffTestRuntime } from "./CitationDiffWorker.fixtures.ts";
import { readCitationHtmlDiscoveryCorpus } from "./CitationHtmlDiscovery.fixtures.ts";
import { setupCitationMetadataRuntime } from "./CitationRegexWorker.fixtures.ts";
import { makeCitationXmlTestRuntime } from "./CitationXmlWorker.fixtures.ts";
import type { CitationNativeRuntimeKind } from "@beep/law-practice-server/internal/Citation/NativeProcess";
/** Shared installed configuration and isolated real-worker paths, with no enclosing budget.
 * @internal @category testing @since 0.0.0
 */
export const installCitationAnnotationEntryFixture = Effect.fn("AnnotationEntryTest.install")(function* (
  kind: CitationNativeRuntimeKind = "bun"
) {
  const setup = yield* setupCitationMetadataRuntime(kind, undefined, false);
  const discovery = yield* readCitationHtmlDiscoveryCorpus();
  const fs = yield* FileSystem.FileSystem;
  const cwd = yield* fs.makeTempDirectoryScoped({ prefix: "citation-entry-diff-" });
  const diffRuntime = yield* makeCitationDiffTestRuntime(kind, cwd);
  const xmlRuntime = yield* makeCitationXmlTestRuntime(kind);
  const configuration = CitationAnnotationEntryConfiguration.make({
    geometry: CitationHtmlGeometryPreparationConfiguration.make({
      discovery: CitationHtmlDiscoveryConfiguration.make(discovery.configuration),
      diffRuntime,
    }),
    xmlRuntime,
  });
  return { ...setup, configuration };
});
