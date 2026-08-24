import { click, expectSelector, keyboard, type } from "./dsl.ts";
import { GROUP, scenario, surfaceLifecycle } from "./helpers.ts";
import { COMMENTS, EDITOR, FLOATING_TOOLBAR, KEY } from "./sourced.ts";

export const scenarios = [
  scenario({
    activationExercise: "Select a range, add a comment from the floating toolbar, then invoke the keyboard command.",
    group: GROUP.floatingToolbar,
    id: "node.mark",
    steps: surfaceLifecycle(
      [
        keyboard("Control+A", EDITOR),
        expectSelector(FLOATING_TOOLBAR),
        keyboard(KEY.addComment, EDITOR),
        expectSelector(COMMENTS.input),
        type(COMMENTS.input, "Evidence comment", "fill"),
        click(COMMENTS.commentButton),
        expectSelector(COMMENTS.mark),
        expectSelector(COMMENTS.panel),
      ],
      {
        afterActivation: [click(COMMENTS.hide), expectSelector(COMMENTS.panel, "detached")],
        seed: "Comment this range",
      }
    ),
    title: "Comment range projection",
  }),
] as const;
