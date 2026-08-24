import { clipboardPaste, expectSelector } from "./dsl.ts";
import { GROUP, scenario, surfaceLifecycle } from "./helpers.ts";
import { CUSTOM_OUTPUT, EDITOR } from "./sourced.ts";

const imageHtml =
  '<figure><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" alt="paste evidence"></figure>';

export const scenarios = [
  scenario({
    activationExercise: "Paste a figure/image HTML payload through the browser clipboard boundary.",
    group: GROUP.pasteDrop,
    id: "extension.drag-drop-paste",
    steps: surfaceLifecycle([
      clipboardPaste(EDITOR, { mimeType: "text/html", text: imageHtml }),
      expectSelector(CUSTOM_OUTPUT.image),
    ]),
    title: "Drag, drop, and paste",
  }),
] as const;
