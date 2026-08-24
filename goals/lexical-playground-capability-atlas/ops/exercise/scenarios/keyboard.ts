import { click, expectSelector, expectText, keyboard, type } from "./dsl.ts";
import { GROUP, scenario, surfaceLifecycle } from "./helpers.ts";
import { EDITOR, FIND_KEY, FIND_REPLACE, KEY } from "./sourced.ts";

export const scenarios = [
  scenario({
    activationExercise: "Open Find and Replace with Ctrl+F, navigate matches with Ctrl+G, and replace all.",
    group: GROUP.keyboard,
    id: "authoring.find-replace",
    steps: surfaceLifecycle(
      [
        keyboard(FIND_KEY.open, EDITOR),
        expectSelector(FIND_REPLACE.dialog),
        type(FIND_REPLACE.find, "needle", "fill"),
        keyboard(FIND_KEY.next),
        keyboard(FIND_KEY.previous),
        type(FIND_REPLACE.replace, "found", "fill"),
        click(FIND_REPLACE.replaceAll),
        expectText(EDITOR, "found"),
      ],
      { seed: "needle and needle" }
    ),
    title: "Find and replace",
  }),
  scenario({
    activationExercise: "Edit content, undo with Ctrl+Z, then redo with Ctrl+Y.",
    group: GROUP.keyboard,
    id: "extension.history",
    steps: surfaceLifecycle(
      [type(EDITOR, " history"), keyboard(KEY.undo, EDITOR), keyboard(KEY.redo, EDITOR), expectText(EDITOR, "history")],
      { seed: "Evidence" }
    ),
    title: "History",
  }),
] as const;
