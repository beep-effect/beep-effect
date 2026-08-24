import { click, expectSelector, hover, type } from "./dsl.ts";
import { GROUP, scenario, surfaceLifecycle } from "./helpers.ts";
import { DRAGGABLE, OUTPUT, SLASH_ITEM } from "./sourced.ts";

export const scenarios = [
  scenario({
    activationExercise: "Hover a desktop block, open Click to add below, filter, and choose Quote.",
    group: GROUP.draggableBlock,
    id: "extension.draggable-block",
    steps: surfaceLifecycle(
      [
        hover(OUTPUT.paragraph),
        expectSelector(DRAGGABLE.add),
        click(DRAGGABLE.add),
        type(DRAGGABLE.filter, "Quote", "fill"),
        click(SLASH_ITEM.quote),
        expectSelector(OUTPUT.quote),
      ],
      { seed: "Draggable block evidence" }
    ),
    title: "Draggable block menu",
  }),
] as const;
