import { ChatComposer } from "@beep/editor/chat/chat-composer";
import { EditorComposer } from "@beep/editor/composer";
import { expect, fn, userEvent, within } from "storybook/test";
import { draftReplyInitialState as initialState } from "./fixtures.ts";
import type { MentionOption } from "@beep/editor/chat/config";
import type { Meta, StoryObj } from "@storybook/react-vite";

// Sample app-injected `@` mention source (ephemeral; serializes to plain text).
const MENTIONS: ReadonlyArray<MentionOption> = [
  { id: "ada", label: "Ada Lovelace", hint: "collaborator" },
  { id: "grace", label: "Grace Hopper", hint: "collaborator" },
  { id: "assistant", label: "assistant", hint: "the workspace agent" },
];
const sampleMentionSource = (query: string): ReadonlyArray<MentionOption> =>
  MENTIONS.filter((m) => m.label.toLowerCase().includes(query.toLowerCase()));

const meta = {
  title: "Editor/ChatComposer",
  component: ChatComposer,
  tags: ["autodocs"],
  args: { onSerializedChange: fn(), onSend: fn(), placeholder: "Message…", mentionSource: sampleMentionSource },
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Feature-flagged chat composer over the `@beep/lexical-schema` v1 vocabulary: fixed toolbar, `/` slash, `@` mentions, attachment capture, character count, and plain-Enter send. Every feature is opt-in via the `features` config; disabling all reduces it to the minimal editable surface.",
      },
    },
  },
} satisfies Meta<typeof ChatComposer>;

export default meta;
type Story = StoryObj<typeof meta>;

/** All features enabled (the chat-surface default). */
export const Default: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    void expect(canvas.getByText("Message…")).toBeVisible();
    void expect(canvas.getByLabelText("Bold")).toBeInTheDocument();
    void expect(canvas.getByLabelText("Bulleted list")).toBeInTheDocument();
    void expect(canvas.getByLabelText("Attach files")).toBeInTheDocument();
    void expect(canvas.getByText("0 characters")).toBeVisible();
    void expect(canvas.getByLabelText("Send")).toBeInTheDocument();
  },
};

/** Every feature disabled — reduces to the minimal editable surface + send. */
export const MinimalSubset: Story = {
  args: {
    features: { toolbar: false, slash: false, mentions: false, attachments: false, characterCount: false },
  },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    void expect(canvas.getByText("Message…")).toBeVisible();
    void expect(canvas.queryByLabelText("Bold")).toBeNull();
    void expect(canvas.queryByLabelText("Attach files")).toBeNull();
    void expect(canvas.queryByText("0 characters")).toBeNull();
    void expect(canvas.getByLabelText("Send")).toBeInTheDocument();
  },
};

/** Streaming swaps the send button for a stop button. */
export const Streaming: Story = {
  args: { streaming: true, onStop: fn() },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    void expect(canvas.getByLabelText("Stop generating")).toBeInTheDocument();
    void expect(canvas.queryByLabelText("Send")).toBeNull();
  },
};

/** Placeholder shows only on the empty state — absent once content is present. */
export const WithContent: Story = {
  args: { initialState },
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    void void expect(canvas.getByText("Draft a reply…")).toBeVisible();
    void void expect(canvas.queryByText("Message…")).toBeNull();
  },
};

/**
 * Empty-composer send guard (regression): plain Enter on an empty editor must NOT
 * dispatch a send. An empty Lexical editor is a single empty paragraph, so without
 * a text-content guard the consumer would receive an empty turn — the send binding
 * skips dispatch when the editor has no text.
 */
export const EmptyEnterIsNoOp: Story = {
  play: ({ canvasElement, args }) => {
    const editable = canvasElement.querySelector('[contenteditable="true"]');
    void expect(editable).not.toBeNull();
    (editable as HTMLElement).focus();
    return userEvent.keyboard("{Enter}").then(() => {
      void expect(args.onSend).not.toHaveBeenCalled();
    });
  },
};

/**
 * Placeholder/cursor alignment regression: the editable surface and its
 * placeholder overlay must share the same padding so the empty-state cursor
 * lines up with the placeholder text (the bug was a `py-[18px]` placeholder over
 * a `py-4` editable). Asserted on the class contract, independent of whether the
 * test runner loads Tailwind CSS.
 */
export const PlaceholderAlignment: Story = {
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const placeholder = canvas.getByText("Message…");
    void expect(placeholder).toBeVisible();
    const editable = canvasElement.querySelector('[contenteditable="true"]');
    void expect(editable).not.toBeNull();
    for (const padding of ["px-3", "py-2.5"]) {
      void expect((editable as HTMLElement).className).toContain(padding);
      void expect(placeholder.className).toContain(padding);
    }
  },
};

/**
 * The same alignment regression for the bare `EditorComposer` default
 * `ContentEditable` padding (`px-8 py-4` on both editable and placeholder).
 */
export const EditorComposerPlaceholderAlignment: Story = {
  render: () => <EditorComposer placeholder="Message the workspace…" />,
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const placeholder = canvas.getByText("Message the workspace…");
    expect(placeholder).toBeVisible();
    const editable = canvasElement.querySelector('[contenteditable="true"]');
    void expect(editable).not.toBeNull();
    for (const padding of ["px-8", "py-4"]) {
      void expect((editable as HTMLElement).className).toContain(padding);
      void expect(placeholder.className).toContain(padding);
    }
  },
};
