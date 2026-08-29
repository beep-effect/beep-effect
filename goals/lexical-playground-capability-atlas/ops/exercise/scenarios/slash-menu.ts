import { expectSelector, keyboard, type } from "./dsl.ts";
import { GROUP, nodeLifecycle, scenario, slashActivation, surfaceLifecycle } from "./helpers.ts";
import { CUSTOM_OUTPUT, EDITOR, OUTPUT, SLASH_ITEM } from "./sourced.ts";

export const scenarios = [
  scenario({
    activationExercise: "Type / in an empty block, traverse the listbox by keyboard, and choose Paragraph.",
    group: GROUP.slashMenu,
    id: "extension.slash-picker",
    steps: surfaceLifecycle([
      type(EDITOR, "/"),
      expectSelector(SLASH_ITEM.paragraph),
      keyboard("ArrowDown", EDITOR),
      keyboard("ArrowUp", EDITOR),
      keyboard("Enter", EDITOR),
      expectSelector(OUTPUT.paragraph),
    ]),
    title: "Slash/component picker",
  }),
  scenario({
    activationExercise: "Choose Card from the slash/component picker.",
    group: GROUP.slashMenu,
    id: "node.card",
    steps: nodeLifecycle(slashActivation(SLASH_ITEM.card), CUSTOM_OUTPUT.card),
    title: "Card",
  }),
  scenario({
    activationExercise: "Choose Pull Quote from the slash/component picker.",
    group: GROUP.slashMenu,
    id: "node.pull-quote",
    steps: nodeLifecycle(slashActivation(SLASH_ITEM.pullQuote), CUSTOM_OUTPUT.pullQuote),
    title: "Pull quote",
  }),
  scenario({
    activationExercise: "Choose Review from the slash/component picker.",
    group: GROUP.slashMenu,
    id: "node.review",
    steps: nodeLifecycle(slashActivation(SLASH_ITEM.review), CUSTOM_OUTPUT.review),
    title: "Review block",
  }),
] as const;
