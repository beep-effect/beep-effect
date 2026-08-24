import stableStringify from "fast-json-stable-stringify";
import { click, expectSelector, expectText, keyboard, text, type } from "./dsl.ts";
import { GROUP, manualScenario, scenario, surfaceLifecycle } from "./helpers.ts";
import { ACTION, EDITOR, OUTPUT } from "./sourced.ts";

const rawLexicalJson = stableStringify({
  editorState: {
    root: {
      children: [
        {
          children: [
            {
              detail: 0,
              format: 0,
              mode: "normal",
              style: "",
              text: "Raw boundary evidence",
              type: "text",
              version: 1,
            },
          ],
          direction: null,
          format: "",
          indent: 0,
          textFormat: 0,
          textStyle: "",
          type: "paragraph",
          version: 1,
        },
      ],
      direction: null,
      format: "",
      indent: 0,
      type: "root",
      version: 1,
    },
  },
  source: "Playground",
});
const absentBoundaryReason = (format: string): string =>
  `The pinned Lexical Playground registers no ${format} importer or exporter UI/programmatic adapter, so there is no honest browser lifecycle to script; a human must exercise the product-owned boundary when it exists.`;

export const scenarios = [
  scenario({
    activationExercise: "Import through HTML source mode and export through the same projection boundary.",
    group: GROUP.importer,
    id: "interchange.html",
    steps: surfaceLifecycle([
      click(ACTION.htmlTo),
      expectSelector(OUTPUT.code),
      keyboard("Control+A", EDITOR),
      type(EDITOR, "<blockquote>HTML boundary evidence</blockquote>"),
      expectText(EDITOR, "<blockquote>HTML boundary evidence</blockquote>", true),
      click(ACTION.htmlFrom),
      expectSelector(OUTPUT.quote),
      click(ACTION.htmlTo),
      expectSelector(OUTPUT.code),
      expectText(EDITOR, "blockquote"),
    ]),
    title: "HTML projection",
  }),
  scenario({
    activationExercise: "Import through Markdown source mode and export through the same projection boundary.",
    group: GROUP.importer,
    id: "interchange.markdown",
    steps: surfaceLifecycle([
      click(ACTION.markdownTo),
      keyboard("Control+A", EDITOR),
      type(EDITOR, "> Markdown boundary evidence", "fill"),
      click(ACTION.markdownFrom),
      expectSelector(OUTPUT.quote),
      click(ACTION.markdownTo),
      expectText(EDITOR, "> Markdown boundary evidence"),
    ]),
    title: "Markdown projection",
  }),
  manualScenario({
    activationExercise: "Import and export through a product-owned Pandoc/DOCX boundary.",
    group: GROUP.importer,
    id: "interchange.pandoc-docx",
    reason: absentBoundaryReason("Pandoc/DOCX"),
    title: "Pandoc and DOCX projection",
  }),
  manualScenario({
    activationExercise: "Import and export through a product-owned PDF boundary.",
    group: GROUP.importer,
    id: "interchange.pdf",
    reason: absentBoundaryReason("PDF"),
    title: "PDF projection",
  }),
  scenario({
    activationExercise: "Import raw Lexical JSON through the file chooser and export it again.",
    group: GROUP.importer,
    id: "interchange.raw-lexical-json",
    steps: surfaceLifecycle([
      click(ACTION.importJson, {
        upload: { content: rawLexicalJson, fileName: "raw-boundary.json", mimeType: "application/json" },
      }),
      expectSelector(text("Raw boundary evidence", { exact: true })),
      expectText(EDITOR, "Raw boundary evidence"),
      click(ACTION.exportJson, { downloadSlot: "raw-roundtrip" }),
    ]),
    title: "Raw Lexical JSON",
  }),
] as const;
