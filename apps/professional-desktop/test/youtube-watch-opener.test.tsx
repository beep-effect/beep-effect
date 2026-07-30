import { YOUTUBE_WATCH_EVENT, YouTubeWatchRequest } from "@beep/editor/youtube-embed";
import "@testing-library/jest-dom/vitest";
import { it } from "@effect/vitest";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import { Effect } from "effect";
import { afterEach, beforeEach, describe, expect, vi } from "vitest";
import { YouTubeWatchOpener } from "@/chat/ui/YouTubeWatchOpener";

const opener = vi.hoisted(() => vi.fn<() => Promise<void>>(() => Promise.resolve()));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: opener,
}));

describe("YouTube native opener bridge", { concurrent: false }, () => {
  beforeEach(() => {
    opener.mockReset();
    opener.mockResolvedValue(undefined);
    Object.defineProperty(globalThis, "__TAURI_INTERNALS__", {
      configurable: true,
      value: {},
    });
  });

  afterEach(() => {
    cleanup();
    Reflect.deleteProperty(globalThis, "__TAURI_INTERNALS__");
  });

  it.effect(
    "rejects forged event detail before it can reach the scoped opener",
    Effect.fnUntraced(function* () {
      render(<YouTubeWatchOpener />);

      const forged = new CustomEvent(YOUTUBE_WATCH_EVENT, {
        cancelable: true,
        detail: { url: "https://evil.example/steal" },
      });
      window.dispatchEvent(forged);
      yield* Effect.yieldNow;

      expect(forged.defaultPrevented).toBe(false);
      expect(opener).not.toHaveBeenCalled();
    })
  );

  it.effect(
    "claims a valid request and resolves without a failure notice",
    Effect.fnUntraced(function* () {
      const view = render(<YouTubeWatchOpener />);
      const valid = new CustomEvent(YOUTUBE_WATCH_EVENT, {
        cancelable: true,
        detail: YouTubeWatchRequest.make({
          url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        }),
      });
      window.dispatchEvent(valid);
      yield* Effect.promise(() => waitFor(() => expect(opener).toHaveBeenCalledTimes(1)));

      expect(valid.defaultPrevented).toBe(true);
      expect(opener).toHaveBeenCalledWith("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      expect(within(view.container).queryByRole("alert")).toBeNull();
    })
  );

  it.effect(
    "keeps a rejected request actionable without exposing the native cause",
    Effect.fnUntraced(function* () {
      opener.mockRejectedValueOnce(new Error("private native opener detail"));
      const view = render(<YouTubeWatchOpener />);
      const request = YouTubeWatchRequest.make({
        url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      });
      const rejected = new CustomEvent(YOUTUBE_WATCH_EVENT, {
        cancelable: true,
        detail: request,
      });

      window.dispatchEvent(rejected);
      yield* Effect.promise(() =>
        waitFor(() =>
          expect(within(view.container).getByRole("alert")).toHaveTextContent("YouTube could not be opened.")
        )
      );

      const alert = within(view.container).getByRole("alert");
      expect(rejected.defaultPrevented).toBe(true);
      expect(alert).not.toHaveTextContent("private native opener detail");
      expect(within(alert).getByRole("link", { name: "Open in browser" })).toHaveAttribute("href", request.url);
      expect(within(alert).getByRole("link", { name: "Open in browser" })).toHaveAttribute("target", "_blank");
      expect(within(alert).getByRole("link", { name: "Open in browser" })).toHaveAttribute(
        "rel",
        "noopener noreferrer"
      );

      yield* Effect.sync(() => fireEvent.click(within(alert).getByRole("button", { name: "Retry" })));
      yield* Effect.promise(() => waitFor(() => expect(opener).toHaveBeenCalledTimes(2)));
      yield* Effect.promise(() =>
        waitFor(() => expect(within(view.container).queryByRole("alert")).not.toBeInTheDocument())
      );
    })
  );
});
