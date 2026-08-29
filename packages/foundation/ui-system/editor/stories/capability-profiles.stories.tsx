import { editorCapabilityCatalog } from "@beep/editor/capability/catalog";
import { CapabilityComposer } from "@beep/editor/capability/composer";
import { referenceProfiles } from "@beep/editor/capability/profiles";
import { projectCommands } from "@beep/editor/capability/projection";
import { resolveEditorProfile } from "@beep/editor/capability/resolver";
import {
  CapabilityId,
  CommandId,
  EditorProfile,
  Keybinding,
  KeybindingOverride,
  KeyChord,
  ProfileId,
} from "@beep/editor/capability/schemas";
import { Result } from "effect";
import * as A from "effect/Array";
import { expect, within } from "storybook/test";
import { capabilityProofInitialState } from "./fixtures.ts";
import type { Meta, StoryObj } from "@storybook/react-vite";

const invalidProfile = EditorProfile.make({
  id: ProfileId.make("beep-editor.story.invalid"),
  capabilities: [CapabilityId.make("authoring.undo")],
  keybindingOverrides: [],
});
const conflictProfile = EditorProfile.make({
  ...referenceProfiles.minimal,
  id: ProfileId.make("beep-editor.story.conflict"),
  keybindingOverrides: [
    KeybindingOverride.make({
      commandId: CommandId.make("format.italic"),
      keybindings: [
        Keybinding.make({ platform: "windows-linux", chord: KeyChord.make({ modifiers: ["control"], key: "b" }) }),
        Keybinding.make({ platform: "apple", chord: KeyChord.make({ modifiers: ["meta"], key: "b" }) }),
      ],
    }),
  ],
});
const documentResolved = Result.getOrThrow(
  resolveEditorProfile(editorCapabilityCatalog, referenceProfiles.documentProof)
);

const meta = {
  title: "Editor/CapabilityProfiles",
  component: CapabilityComposer,
  tags: ["autodocs"],
  parameters: { layout: "padded", a11y: { disable: false } },
  args: { initialState: capabilityProofInitialState, platform: "windows-linux" },
} satisfies Meta<typeof CapabilityComposer>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Minimal: Story = {
  args: { profile: referenceProfiles.minimal },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(A.map(canvas.getAllByRole("button"), (button) => button.textContent)).toEqual([
      "Bold",
      "Italic",
      "Undo",
      "Redo",
    ]);
    expect(canvas.getByRole("heading", { name: "Capability proof" })).toBeVisible();
    expect(canvas.getByText("Second item")).toBeVisible();
    expect(canvas.getByText("B2")).toBeVisible();
    expect(canvas.getByRole("link", { name: "proof link" })).toBeVisible();
    expect(canvas.getByRole("region", { name: "Keyboard shortcuts" }).querySelectorAll("dt")).toHaveLength(4);
  },
};

export const DocumentProof: Story = {
  args: { profile: referenceProfiles.documentProof },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("toolbar").querySelectorAll("button")).toHaveLength(
      projectCommands(documentResolved, "toolbar").length
    );
    expect(canvas.getByRole("region", { name: "Keyboard shortcuts" }).querySelectorAll("dt")).toHaveLength(
      documentResolved.commands.length
    );
    expect(canvas.getByRole("heading", { name: "Capability proof" })).toBeVisible();
  },
};

export const SameDocumentBothProfiles: Story = {
  args: { profile: referenceProfiles.minimal },
  render: () => (
    <div className="grid grid-cols-2 gap-4">
      <CapabilityComposer profile={referenceProfiles.minimal} initialState={capabilityProofInitialState} />
      <CapabilityComposer profile={referenceProfiles.documentProof} initialState={capabilityProofInitialState} />
    </div>
  ),
};

export const InvalidProfile: Story = {
  args: { profile: invalidProfile },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("alert")).toHaveTextContent("MissingDependencyError");
    expect(canvasElement.querySelector("[contenteditable]")).toBeNull();
  },
};

export const KeybindingConflict: Story = {
  args: { profile: conflictProfile },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByRole("alert")).toHaveTextContent("KeybindingConflictError");
  },
};
