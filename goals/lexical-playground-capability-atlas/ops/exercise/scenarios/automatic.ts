import { click, expectSelector, keyboard, setViewport, type } from "./dsl.ts";
import { baseLifecycle, GROUP, INSERT_ITEM, nodeLifecycle, PAGE_ITEM, scenario, surfaceLifecycle } from "./helpers.ts";
import {
  AUTOCOMPLETE_PREFIX,
  CUSTOM_OUTPUT,
  EDITOR,
  INSERT_MENU,
  OUTPUT,
  PAGE_SETUP,
  SETTING_QUERY,
} from "./sourced.ts";

export const scenarios = [
  scenario({
    activationExercise: "Type an eligible prefix; accept with Tab and repeat with Right Arrow.",
    group: GROUP.automatic,
    id: "authoring.autocomplete",
    steps: [
      ...nodeLifecycle(
        [type(EDITOR, AUTOCOMPLETE_PREFIX), expectSelector(OUTPUT.autocomplete), keyboard("Tab", EDITOR)],
        OUTPUT.paragraph,
        { query: { [SETTING_QUERY.autocomplete]: true } }
      ),
      keyboard("End", EDITOR),
      type(EDITOR, ` ${AUTOCOMPLETE_PREFIX}`),
      expectSelector(OUTPUT.autocomplete),
      keyboard("ArrowRight", EDITOR),
    ],
    title: "Autocomplete provider",
  }),
  scenario({
    activationExercise: "Type and paste validated URLs and accept the automatic link transform.",
    group: GROUP.automatic,
    id: "node.auto-link",
    steps: baseLifecycle([keyboard("End", EDITOR), type(EDITOR, " https://example.com ")], OUTPUT.link),
    title: "Automatic link",
  }),
  scenario({
    activationExercise: "Type hashtag source text and accept the automatic transform.",
    group: GROUP.automatic,
    id: "node.hashtag",
    steps: baseLifecycle([keyboard("End", EDITOR), type(EDITOR, " #evidence ")], OUTPUT.hashtag),
    title: "Hashtag",
  }),
  scenario({
    activationExercise: "Type the pinned keyword-transform dictionary token.",
    group: GROUP.automatic,
    id: "node.keyword",
    steps: baseLifecycle([keyboard("End", EDITOR), type(EDITOR, " congratulations ")], CUSTOM_OUTPUT.keyword),
    title: "Keyword entity",
  }),
  scenario({
    activationExercise: "Enable the UTF-16 character limit and type past its five-character Playground threshold.",
    group: GROUP.automatic,
    id: "node.overflow",
    steps: nodeLifecycle([type(EDITOR, "123456789")], OUTPUT.charLimit, {
      query: { [SETTING_QUERY.charLimitUtf16]: true },
    }),
    title: "Overflow marker",
  }),
  scenario({
    activationExercise: "Enable bracket special text and type matching bracketed source text.",
    group: GROUP.automatic,
    id: "node.special-text",
    steps: nodeLifecycle([type(EDITOR, "[evidence]")], OUTPUT.specialText, {
      query: { [SETTING_QUERY.bracketSpecialText]: true },
    }),
    title: "Bracket special text",
  }),
  scenario({
    activationExercise: "Choose A4 fixed pages, insert an explicit page break, edit content, and resize to 480x900.",
    group: GROUP.automatic,
    id: "page.pagination",
    steps: surfaceLifecycle(
      [
        click(PAGE_SETUP),
        click(PAGE_ITEM.a4),
        expectSelector(OUTPUT.page),
        click(EDITOR),
        click(INSERT_MENU),
        click(INSERT_ITEM.pageBreak),
        expectSelector(OUTPUT.pageBreak),
        keyboard("Control+Z", EDITOR),
        keyboard("Control+Y", EDITOR),
        setViewport(480, 900),
        expectSelector(OUTPUT.page),
      ],
      { seed: "Pagination evidence" }
    ),
    title: "Automatic pagination",
  }),
] as const;
