import { EditorViewer } from "@beep/editor/viewer";
import { ARTIFACT_URI_PREFIX, documentToEditorState } from "@beep/lexical-schema";
import * as MdModel from "@beep/md/Md.model";
import * as Effect from "effect/Effect";
import * as O from "effect/Option";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

const text = (value: string) => MdModel.Text.make({ value });

/**
 * A fixture assistant turn as md-core blocks — the canonical `@beep/md` AST
 * an assistant turn persists as — lifted through the `@beep/lexical-schema`
 * codec into serialized Lexical state and rendered by the read-only viewer.
 */
const fixtureTurn = MdModel.Document.make({
  children: [
    MdModel.Heading.make({ level: 2, children: [text("Rollout plan")] }),
    MdModel.P.make({
      children: [
        text("The schema-first pipeline is "),
        MdModel.Strong.make({ children: [text("ready to review")] }),
        text(" — full notes in "),
        MdModel.A.make({ href: "https://example.com/notes", children: [text("the design doc")] }),
        text("."),
      ],
    }),
    MdModel.BlockQuote.make({
      children: [MdModel.P.make({ children: [text("Persisted state must not couple to raw Lexical serialization.")] })],
    }),
    MdModel.Pre.make({
      value: 'const state = Effect.runSync(documentToEditorState(turn))\nconsole.log(state.root.type) // "root"',
      language: O.some("typescript"),
    }),
    MdModel.TaskList.make({
      children: [
        MdModel.TaskItem.make({ checked: true, children: [text("lock the codec lossiness profile")] }),
        MdModel.TaskItem.make({ checked: false, children: [text("wire the desktop chat surface")] }),
      ],
    }),
    MdModel.Ul.make({
      children: [
        MdModel.Li.make({ children: [text("zero runtime lexical imports in the schema package")] }),
        MdModel.Li.make({ children: [MdModel.Em.make({ children: [text("schema owns the persisted contract")] })] }),
      ],
    }),
    MdModel.P.make({
      children: [MdModel.A.make({ href: `${ARTIFACT_URI_PREFIX}artifact-123`, children: [text("Quarterly report")] })],
    }),
  ],
});

const fixtureState = Effect.runSync(documentToEditorState(fixtureTurn));

const meta = {
  title: "Editor/EditorViewer",
  component: EditorViewer,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component:
          "Read-only viewer rendering a fixture assistant turn end-to-end: `@beep/md` AST → `@beep/lexical-schema` codec → serialized Lexical state → `@beep/editor` viewer.",
      },
    },
  },
} satisfies Meta<typeof EditorViewer>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AssistantTurn: Story = {
  args: { state: fixtureState, className: "relative block max-w-2xl px-4 py-2 focus:outline-none" },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    void expect(canvas.getByRole("heading", { name: "Rollout plan" })).toBeVisible();
    void expect(canvas.getByRole("link", { name: "the design doc" })).toBeVisible();
    void expect(canvas.getByText("ready to review")).toBeVisible();
    // The artifact-ref block renders as the decorator chip, not a link.
    void expect(canvas.getByText("Quarterly report")).toBeVisible();
    void expect(canvas.queryByRole("link", { name: "Quarterly report" })).toBeNull();
  },
};
