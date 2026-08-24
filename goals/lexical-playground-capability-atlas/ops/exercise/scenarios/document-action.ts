import stableStringify from "fast-json-stable-stringify";
import { click, expectAttr, expectSelector, expectText, keyboard, text, type } from "./dsl.ts";
import { GROUP, scenario, surfaceLifecycle } from "./helpers.ts";
import {
  ACTION,
  ACTION_FEEDBACK,
  COMMENTS,
  EDITOR,
  modal,
  OUTPUT,
  SETTING_QUERY,
  TIME_TRAVEL_BUTTON,
  TIME_TRAVEL_EXIT,
} from "./sourced.ts";

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
              text: "Imported JSON evidence",
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
  lastSaved: 0,
  source: "Playground",
});

export const scenarios = [
  scenario({
    activationExercise: "Invoke Clear editor contents, confirm the modal, and inspect the empty editor.",
    group: GROUP.documentAction,
    id: "document.clear",
    steps: surfaceLifecycle(
      [
        click(ACTION.clear),
        expectSelector(modal("Clear editor")),
        click(ACTION_FEEDBACK.clearConfirm),
        expectText(EDITOR, ""),
      ],
      { seed: "Clear this evidence" }
    ),
    title: "Clear document",
  }),
  scenario({
    activationExercise: "Open the Comments panel, exercise focus, then close and reopen it.",
    group: GROUP.documentAction,
    id: "document.comments-panel",
    steps: surfaceLifecycle(
      [
        click(COMMENTS.show),
        expectSelector(COMMENTS.panel),
        keyboard("Tab"),
        click(COMMENTS.hide),
        expectSelector(COMMENTS.panel, "detached"),
        click(COMMENTS.show),
        expectSelector(COMMENTS.panel),
      ],
      {
        afterActivation: [click(COMMENTS.hide), expectSelector(COMMENTS.panel, "detached")],
        seed: "Comments panel evidence",
      }
    ),
    title: "Comments panel",
  }),
  scenario({
    activationExercise: "Convert the live document to terse HTML DOM text and convert it back.",
    group: GROUP.documentAction,
    id: "document.export-dom",
    steps: surfaceLifecycle(
      [
        click(ACTION.htmlTo),
        expectSelector(OUTPUT.code),
        expectText(EDITOR, "<p"),
        click(ACTION.htmlFrom),
        expectSelector(OUTPUT.code, "detached"),
        expectText(EDITOR, "DOM export evidence"),
      ],
      { seed: "DOM export evidence" }
    ),
    title: "Terse DOM export",
  }),
  scenario({
    activationExercise: "Invoke Export editor state to JSON and retain the browser download.",
    group: GROUP.documentAction,
    id: "document.export-lexical-json",
    steps: surfaceLifecycle([click(ACTION.exportJson, { downloadSlot: "lexical-json" })], {
      seed: "Export JSON evidence",
    }),
    title: "Export raw Lexical JSON",
  }),
  scenario({
    activationExercise: "Enter HTML source mode, edit HTML, convert from HTML, then repeat by keyboard focus.",
    group: GROUP.documentAction,
    id: "document.html-source",
    steps: surfaceLifecycle([
      click(ACTION.htmlTo),
      expectSelector(OUTPUT.code),
      keyboard("Control+A", EDITOR),
      type(EDITOR, "<h1>HTML source evidence</h1>"),
      expectText(EDITOR, "<h1>HTML source evidence</h1>", true),
      click(ACTION.htmlFrom),
      expectSelector(OUTPUT.heading1),
      keyboard("Control+Z", EDITOR),
      keyboard("Control+Y", EDITOR),
    ]),
    title: "HTML source mode",
  }),
  scenario({
    activationExercise: "Import a raw Playground JSON file through the file chooser and export the restored state.",
    group: GROUP.documentAction,
    id: "document.import-lexical-json",
    steps: surfaceLifecycle([
      click(ACTION.importJson, {
        upload: { content: rawLexicalJson, fileName: "evidence.json", mimeType: "application/json" },
      }),
      expectSelector(text("Imported JSON evidence", { exact: true })),
      expectText(EDITOR, "Imported JSON evidence"),
      click(ACTION.exportJson, { downloadSlot: "roundtrip-json" }),
    ]),
    title: "Import raw Lexical JSON",
  }),
  scenario({
    activationExercise: "Convert to Markdown source, edit it, convert back, and verify the projected heading.",
    group: GROUP.documentAction,
    id: "document.markdown-source",
    steps: surfaceLifecycle([
      click(ACTION.markdownTo),
      keyboard("Control+A", EDITOR),
      type(EDITOR, "# Markdown source evidence", "fill"),
      click(ACTION.markdownFrom),
      expectSelector(OUTPUT.heading1),
    ]),
    title: "Markdown source mode",
  }),
  scenario({
    activationExercise: "Lock read-only mode, verify contenteditable=false, then unlock and edit.",
    group: GROUP.documentAction,
    id: "document.read-only",
    steps: surfaceLifecycle(
      [
        click(ACTION.lock),
        expectAttr(EDITOR, "contenteditable", "false"),
        click(ACTION.unlock),
        expectAttr(EDITOR, "contenteditable", "true"),
        type(EDITOR, " editable"),
      ],
      { seed: "Read-only evidence" }
    ),
    title: "Read-only lock",
  }),
  scenario({
    activationExercise:
      "Invoke Share, verify the clipboard notification, and exercise the hash-state lifecycle without external egress.",
    group: GROUP.documentAction,
    id: "document.share-url",
    networkExpectation: "rejected",
    steps: surfaceLifecycle([click(ACTION.share), expectText(ACTION_FEEDBACK.shareToast, "URL copied to clipboard")], {
      seed: "Share URL evidence",
    }),
    title: "Compressed state share URL",
  }),
  scenario({
    activationExercise: "Enable Tree View, create history, open Time Travel, and traverse the time-travel controls.",
    group: GROUP.documentAction,
    id: "document.time-travel",
    steps: surfaceLifecycle(
      [
        type(EDITOR, " one"),
        type(EDITOR, " two"),
        expectSelector(TIME_TRAVEL_BUTTON),
        click(TIME_TRAVEL_BUTTON),
        keyboard("Tab"),
        keyboard("ArrowLeft"),
        keyboard("ArrowRight"),
        click(TIME_TRAVEL_EXIT),
        expectSelector(TIME_TRAVEL_EXIT, "detached"),
        expectSelector(TIME_TRAVEL_BUTTON),
      ],
      { query: { [SETTING_QUERY.treeView]: true }, seed: "Time travel" }
    ),
    title: "Time travel",
  }),
] as const;
