import "@testing-library/jest-dom/vitest";
import { cleanup, render, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { App } from "@/App";

describe("Professional Desktop app", { concurrent: false }, () => {
  afterEach(cleanup);

  it("mounts the chat shell", () => {
    const { container, unmount } = render(<App />);
    const screen = within(container);

    // the app is now a thin wrapper over the chat surface: the sidebar,
    // composer-creation control, and chat frame render in the empty/loading
    // state without a live sidecar.
    return screen
      .findByTestId("chat-app")
      .then((chatApp) => {
        expect(chatApp).toBeInTheDocument();
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
        // Without a reachable sidecar the state names the problem (a failed
        // thread load) instead of pretending the workspace is merely empty.
        expect(within(noThread).getByText(/first thread|Chat is unavailable/, { selector: "h2" })).toBeInTheDocument();
      })
      .finally(unmount);
  });
});
