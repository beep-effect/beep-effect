import commonmarkSpec from "@beep/markdown/conformance/commonmark/spec" with { type: "json" };
import gfmExtensions from "@beep/markdown/conformance/gfm/extensions" with { type: "json" };
import gfmSpecExtensions from "@beep/markdown/conformance/gfm/spec-extensions" with { type: "json" };
import mdastAttention from "@beep/markdown/conformance/mdast/attention" with { type: "json" };
import mdastAutolink from "@beep/markdown/conformance/mdast/autolink" with { type: "json" };
import mdastBlockquote from "@beep/markdown/conformance/mdast/blockquote" with { type: "json" };
import mdastCharacterEscape from "@beep/markdown/conformance/mdast/character-escape" with { type: "json" };
import mdastCharacterReference from "@beep/markdown/conformance/mdast/character-reference" with { type: "json" };
import mdastCharacterReferencesEverywhere from "@beep/markdown/conformance/mdast/character-references-everywhere" with {
  type: "json",
};
import mdastCodeFenced from "@beep/markdown/conformance/mdast/code-fenced" with { type: "json" };
import mdastCodeIndented from "@beep/markdown/conformance/mdast/code-indented" with { type: "json" };
import mdastCodeText from "@beep/markdown/conformance/mdast/code-text" with { type: "json" };
import mdastDefinition from "@beep/markdown/conformance/mdast/definition" with { type: "json" };
import mdastEmpty from "@beep/markdown/conformance/mdast/empty" with { type: "json" };
import mdastHardBreakEscape from "@beep/markdown/conformance/mdast/hard-break-escape" with { type: "json" };
import mdastHardBreakPrefix from "@beep/markdown/conformance/mdast/hard-break-prefix" with { type: "json" };
import mdastHeadingAtx from "@beep/markdown/conformance/mdast/heading-atx" with { type: "json" };
import mdastHeadingSetext from "@beep/markdown/conformance/mdast/heading-setext" with { type: "json" };
import mdastHtmlFlow from "@beep/markdown/conformance/mdast/html-flow" with { type: "json" };
import mdastHtmlText from "@beep/markdown/conformance/mdast/html-text" with { type: "json" };
import mdastImageReference from "@beep/markdown/conformance/mdast/image-reference" with { type: "json" };
import mdastImageResource from "@beep/markdown/conformance/mdast/image-resource" with { type: "json" };
import mdastImageResourceEol from "@beep/markdown/conformance/mdast/image-resource-eol" with { type: "json" };
import mdastLinkReference from "@beep/markdown/conformance/mdast/link-reference" with { type: "json" };
import mdastLinkReferenceWithPhrasing from "@beep/markdown/conformance/mdast/link-reference-with-phrasing" with {
  type: "json",
};
import mdastLinkResource from "@beep/markdown/conformance/mdast/link-resource" with { type: "json" };
import mdastLinkResourceEol from "@beep/markdown/conformance/mdast/link-resource-eol" with { type: "json" };
import mdastList from "@beep/markdown/conformance/mdast/list" with { type: "json" };
import mdastParagraph from "@beep/markdown/conformance/mdast/paragraph" with { type: "json" };
import mdastThematicBreak from "@beep/markdown/conformance/mdast/thematic-break" with { type: "json" };
import { MdastFixture, mdastInputs, SpecCorpus, specInputs } from "./bridgeCorpus.ts";

const MDAST_FIXTURES: ReadonlyArray<MdastFixture> = [
  MdastFixture.make({ name: "attention", tree: mdastAttention }),
  MdastFixture.make({ name: "autolink", tree: mdastAutolink }),
  MdastFixture.make({ name: "blockquote", tree: mdastBlockquote }),
  MdastFixture.make({ name: "character-escape", tree: mdastCharacterEscape }),
  MdastFixture.make({ name: "character-reference", tree: mdastCharacterReference }),
  MdastFixture.make({ name: "character-references-everywhere", tree: mdastCharacterReferencesEverywhere }),
  MdastFixture.make({ name: "code-fenced", tree: mdastCodeFenced }),
  MdastFixture.make({ name: "code-indented", tree: mdastCodeIndented }),
  MdastFixture.make({ name: "code-text", tree: mdastCodeText }),
  MdastFixture.make({ name: "definition", tree: mdastDefinition }),
  MdastFixture.make({ name: "empty", tree: mdastEmpty }),
  MdastFixture.make({ name: "hard-break-escape", tree: mdastHardBreakEscape }),
  MdastFixture.make({ name: "hard-break-prefix", tree: mdastHardBreakPrefix }),
  MdastFixture.make({ name: "heading-atx", tree: mdastHeadingAtx }),
  MdastFixture.make({ name: "heading-setext", tree: mdastHeadingSetext }),
  MdastFixture.make({ name: "html-flow", tree: mdastHtmlFlow }),
  MdastFixture.make({ name: "html-text", tree: mdastHtmlText }),
  MdastFixture.make({ name: "image-reference", tree: mdastImageReference }),
  MdastFixture.make({ name: "image-resource-eol", tree: mdastImageResourceEol }),
  MdastFixture.make({ name: "image-resource", tree: mdastImageResource }),
  MdastFixture.make({ name: "link-reference", tree: mdastLinkReference }),
  MdastFixture.make({ name: "link-reference-with-phrasing", tree: mdastLinkReferenceWithPhrasing }),
  MdastFixture.make({ name: "link-resource-eol", tree: mdastLinkResourceEol }),
  MdastFixture.make({ name: "link-resource", tree: mdastLinkResource }),
  MdastFixture.make({ name: "list", tree: mdastList }),
  MdastFixture.make({ name: "paragraph", tree: mdastParagraph }),
  MdastFixture.make({ name: "thematic-break", tree: mdastThematicBreak }),
];

/**
 * Every @beep/markdown conformance example as a bridge-corpus input: the
 * 652 CommonMark examples (read as CommonMark), the GFM spec-extension and
 * extensions corpora, and the mdast fixtures (both read as GFM).
 */
export const CORPUS_INPUTS = [
  ...specInputs(SpecCorpus.make({ corpus: "commonmark", dialect: "commonmark", examples: commonmarkSpec })),
  ...specInputs(SpecCorpus.make({ corpus: "gfm-spec", dialect: "gfm", examples: gfmSpecExtensions })),
  ...specInputs(SpecCorpus.make({ corpus: "gfm-extensions", dialect: "gfm", examples: gfmExtensions })),
  ...mdastInputs(MDAST_FIXTURES),
];
