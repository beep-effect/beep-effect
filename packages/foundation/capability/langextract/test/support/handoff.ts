const { createHash } = process.getBuiltinModule("node:crypto");

import { TermIri } from "@beep/identity/Term";
import { LangExtractRequest } from "@beep/langextract/Extraction";
import { ExtractionTarget, TargetAnnotation } from "@beep/langextract/Target";
import {
  SourceTextDigest,
  SourceTextExtractor,
  SourceTextIdentity,
  SourceTextLocator,
} from "@beep/text/SourceTextIdentity";

export const sourceForText = (text: string) => {
  const digest = SourceTextDigest.make(`sha256:${createHash("sha256").update(text).digest("hex")}`);
  return SourceTextIdentity.make({
    scopeRef: "matter:test",
    sourceRef: "source:test",
    locator: SourceTextLocator.make("test.txt"),
    sourceDigest: digest,
    textDigest: digest,
    extractor: SourceTextExtractor.make({ name: "utf8", version: "1" }),
    normalizationVersion: "raw/1",
  });
};
export const makeTarget = (input: Omit<Parameters<typeof ExtractionTarget.make>[0], "annotates">) =>
  ExtractionTarget.make({
    ...input,
    annotates: TargetAnnotation.cases.Mention.make({ class: TermIri.make(`https://example.org/${input.name}`) }),
  });
export const makeRequest = (input: Omit<Parameters<typeof LangExtractRequest.make>[0], "source">) =>
  LangExtractRequest.make({ ...input, source: sourceForText(input.text) });
