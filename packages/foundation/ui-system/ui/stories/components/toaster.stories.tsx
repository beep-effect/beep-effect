import { Toast, ToastClose, ToastDescription, ToastTitle, ToastViewport } from "@beep/ui/components/toast";
import { Toaster, ToastPrimitive } from "@beep/ui/components/toaster";
import { A } from "@beep/utils";
import { expect, userEvent, within } from "storybook/test";
import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * `Toaster` is the application's toast-notification surface. It renders a Base UI
 * `ToastProvider` (wired to the shared process-wide toast manager) plus a fixed
 * `ToastViewport` that maps live toasts into styled `Toast` cards with title,
 * description, optional action button, and a close button. Mount it once near the
 * app root; toasts are then pushed imperatively through the toast manager, and the
 * provider auto-dismisses them after its `timeout` (5s) while capping the stack at
 * its `limit` (3). The re-exported `ToastPrimitive` exposes the underlying Base UI
 * parts (`Provider`, `Viewport`, `Root`, `Title`, `Description`, `Close`) and the
 * `useToastManager` hook used to add toasts from within the provider tree.
 *
 * Imported from `@beep/ui/components/toaster`.
 */
const meta = {
  title: "Components/Feedback/Toaster",
  component: Toaster,
  tags: ["autodocs"],
  argTypes: {},
  args: {},
} satisfies Meta<typeof Toaster>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The default toaster mounts cleanly with an empty viewport, ready to receive toasts.
 * The play test confirms the live region exists in the DOM.
 */
export const Default: Story = {
  play: ({ canvasElement }) => {
    const region = canvasElement.ownerDocument.querySelector("[role='region']");
    expect(region).not.toBeNull();
    return Promise.resolve();
  },
};

function ToastInbox() {
  const { toasts } = ToastPrimitive.useToastManager();
  return (
    <>
      {A.map(toasts, (toast) => (
        <Toast key={toast.id} toast={toast}>
          <div className="grid gap-1">
            <ToastTitle>{toast.title}</ToastTitle>
            <ToastDescription>{toast.description}</ToastDescription>
          </div>
          <ToastClose />
        </Toast>
      ))}
    </>
  );
}

function ToastTrigger() {
  const manager = ToastPrimitive.useToastManager();
  return (
    <button
      type="button"
      onClick={() => {
        manager.add({ title: "Saved", description: "Your changes were saved." });
      }}
    >
      Show toast
    </button>
  );
}

/**
 * A trigger button, hosted inside a `ToastPrimitive.Provider`, adds a toast through
 * `useToastManager`, and the styled `Toast` parts from `@beep/ui/components/toast` render it. The
 * play test clicks the trigger and asserts the new toast's title and description render in the
 * viewport, demonstrating the imperative add-and-render flow. The close button appears on hover or
 * focus, as `ToastClose` specifies.
 */
export const WithTrigger: Story = {
  render: () => (
    <ToastPrimitive.Provider>
      <ToastTrigger />
      <ToastViewport>
        <ToastInbox />
      </ToastViewport>
    </ToastPrimitive.Provider>
  ),
  play: ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const trigger = canvas.getByRole("button", { name: "Show toast" });
    expect(trigger).toBeVisible();
    return userEvent.click(trigger).then(() => {
      expect(canvas.getByText("Saved")).toBeVisible();
      expect(canvas.getByText("Your changes were saved.")).toBeVisible();
    });
  },
};
