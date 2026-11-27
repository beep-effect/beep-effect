// fallow-ignore-file code-duplication -- Storybook story variants repeat the canonical markup on purpose so the docs panel shows each story's own source; shared render helpers would hide that usage. Owner: @beep/ui. Exit: remove when the docs panel can render a shared helper's source, or when a variant stops being a teaching copy.
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@beep/ui/components/conversation";
import { A } from "@beep/utils";
import { ChatCircleIcon } from "@phosphor-icons/react";
import { expect, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

type Message = {
  readonly id: number;
  readonly role: "user" | "assistant";
  readonly text: string;
};

const messages: ReadonlyArray<Message> = [
  { id: 1, role: "user", text: "Hey, can you summarize the deploy checklist?" },
  { id: 2, role: "assistant", text: "Sure — run the migrations, smoke-test the API, then flip the feature flag." },
  { id: 3, role: "user", text: "Do we need a maintenance window?" },
  { id: 4, role: "assistant", text: "Not for this one. The migration is additive, so there is no downtime." },
];

const longThread: ReadonlyArray<Message> = A.makeBy(20, (index) => ({
  id: index + 1,
  role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
  text: `Message ${index + 1} in a long scrolling conversation thread.`,
}));

const defaultConversationChildren = (
  <ConversationContent>
    <ConversationEmptyState />
  </ConversationContent>
);

const meta = {
  title: "Components/Data Display/Conversation",
  component: Conversation,
  tags: ["autodocs"],
  argTypes: {
    className: {
      control: "text",
      description: "Classes merged onto the scrollable root; constrain the height to enable scrolling.",
    },
    children: {
      control: false,
      description: "Conversation content, typically a `ConversationContent` wrapping message bubbles.",
    },
  },
  args: {
    className: "h-80 w-96 rounded-md border",
    children: defaultConversationChildren,
  },
} satisfies Meta<typeof Conversation>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The default conversation: a fixed-height container scrolling a short thread of messages. */
export const Default: Story = {
  render: (args) => (
    <Conversation {...args}>
      <ConversationContent>
        <div className="space-y-3">
          {A.map(messages, (message) => (
            <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  message.role === "user"
                    ? "bg-primary text-primary-foreground max-w-4/5 rounded-lg px-3 py-2 text-sm"
                    : "bg-muted max-w-4/5 rounded-lg px-3 py-2 text-sm"
                }
              >
                {message.text}
              </div>
            </div>
          ))}
        </div>
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("Hey, can you summarize the deploy checklist?")).toBeVisible();
    return Promise.resolve();
  },
};

/** A long thread that overflows the viewport, demonstrating the stick-to-bottom scroll behavior. */
export const LongThread: Story = {
  render: (args) => (
    <Conversation {...args}>
      <ConversationContent>
        <div className="space-y-3">
          {A.map(longThread, (message) => (
            <div key={message.id} className={message.role === "user" ? "flex justify-end" : "flex justify-start"}>
              <div
                className={
                  message.role === "user"
                    ? "bg-primary text-primary-foreground max-w-4/5 rounded-lg px-3 py-2 text-sm"
                    : "bg-muted max-w-4/5 rounded-lg px-3 py-2 text-sm"
                }
              >
                {message.text}
              </div>
            </div>
          ))}
        </div>
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  ),
};

/** The empty placeholder shown before any messages exist, with a custom icon, title, and description. */
export const EmptyState: Story = {
  render: (args) => (
    <Conversation {...args}>
      <ConversationContent>
        <ConversationEmptyState
          description="Send a message to start chatting with the assistant."
          icon={<ChatCircleIcon className="size-8" />}
          title="No messages yet"
        />
      </ConversationContent>
    </Conversation>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    expect(canvas.getByText("No messages yet")).toBeVisible();
    return Promise.resolve();
  },
};
