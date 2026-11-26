import "@testing-library/jest-dom/vitest";
import { it } from "@beep/test-runner";
import { afterEach, describe, expect } from "@effect/vitest";
import { cleanup, render, within } from "@testing-library/react";
import { App } from "@/App";
import { DOCK_SNAPSHOT_KEY } from "@/workspace/dock.atoms";

describe("Professional Desktop app", { concurrent: false }, () => {
  afterEach(() => {
    cleanup();
    globalThis.localStorage.removeItem(DOCK_SNAPSHOT_KEY);
  });

  it("mounts the chat shell", () => {
    const { container, unmount } = render(<App />);
    const screen = within(container);

    return screen
      .findByTestId("chat-app")
      .then((chatApp) => {
        expect(
          chatApp,
          "the app is a thin wrapper whose chat shell renders without a live sidecar"
        ).toBeInTheDocument();
        expect(chatApp.querySelector('[data-slot="orb-background"]')).toBeNull();
        expect(screen.getByTestId("sidebar")).toBeInTheDocument();
        expect(screen.getByTestId("sidebar-new")).toBeInTheDocument();
      })
      .finally(unmount);
  });

  it("renders the empty no-thread state when no thread is selected and no server is reachable", () => {
    const { container, unmount } = render(<App />);
    const screen = within(container);

    return screen
      .findByTestId("chat-no-thread")
      .then((noThread) => {
        expect(noThread).toBeInTheDocument();
        expect(
          within(noThread).getByText(/first thread|Chat is unavailable/, { selector: "h2" }),
          "without a reachable sidecar the state names the failed load instead of pretending the workspace is empty"
        ).toBeInTheDocument();
      })
      .finally(unmount);
  });
});
