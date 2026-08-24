import { click, expectSelector, type } from "./dsl.ts";
import { GROUP, nodeLifecycle, scenario } from "./helpers.ts";
import { CUSTOM_OUTPUT, EDITOR, MENTION_YODA } from "./sourced.ts";

export const scenarios = [
  scenario({
    activationExercise: "Type @ and choose the injected Yoda entity from the typeahead.",
    group: GROUP.typeahead,
    id: "node.mention",
    steps: nodeLifecycle(
      [type(EDITOR, "@Yo"), expectSelector(MENTION_YODA), click(MENTION_YODA)],
      CUSTOM_OUTPUT.mention
    ),
    title: "Mention",
  }),
] as const;
