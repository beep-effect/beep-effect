import { click, expectSelector, keyboard, type } from "./dsl.ts";
import { GROUP, manualScenario, scenario, slashActivation, surfaceLifecycle } from "./helpers.ts";
import { EDITOR, OUTPUT, SLASH_ITEM } from "./sourced.ts";

const remoteResolutionReason =
  "The pinned Playground has no authorized-provider resolver or consent UI for inert remote references; its embed nodes load provider content directly, so the atlas contract must be exercised manually in the product host that owns authorization policy.";

export const scenarios = [
  scenario({
    activationExercise:
      "Create a code block, click the editor root below it, and type into the inserted trailing paragraph.",
    group: GROUP.selection,
    id: "extension.click-after-last-block",
    steps: surfaceLifecycle([
      ...slashActivation(SLASH_ITEM.code),
      type(EDITOR, "Last block evidence"),
      click(EDITOR, { position: { x: 240, y: 120 } }),
      type(EDITOR, "after last block"),
      expectSelector(OUTPUT.paragraph),
      keyboard("Control+Z", EDITOR),
      keyboard("Control+Y", EDITOR),
    ]),
    title: "Click after last block",
  }),
  manualScenario({
    activationExercise:
      "Resolve an inert reference only after explicit user authorization through a product-owned provider.",
    group: GROUP.selection,
    id: "network.remote-embed-resolution",
    networkExpectation: "authorized-provider",
    reason: remoteResolutionReason,
    title: "Authorized remote embed resolution",
  }),
] as const;
