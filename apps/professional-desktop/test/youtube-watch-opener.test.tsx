import { YOUTUBE_WATCH_EVENT, YouTubeWatchRequest } from "@beep/editor/youtube-embed";
import "@testing-library/jest-dom/vitest";
import { it } from "@effect/vitest";
import { cleanup, render, waitFor } from "@testing-library/react";
import { Effect } from "effect";
import { afterEach, describe, expect, vi } from "vitest";
import { YouTubeWatchOpener } from "@/chat/ui/YouTubeWatchOpener";

const opener = vi.hoisted(() => vi.fn(() => Promise.resolve()));

vi.mock("@tauri-apps/plugin-opener", () => ({
  openUrl: opener,
}));

describe("YouTube native opener bridge", { concurrent: false }, () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    Reflect.deleteProperty(globalThis, "__TAURI_INTERNALS__");
  });

  it.effect(
    "rejects forged event detail before it can reach the scoped opener",
    Effect.fnUntraced(function* () {
      Object.defineProperty(globalThis, "__TAURI_INTERNALS__", {
        configurable: true,
        value: {},
      });
      render(<YouTubeWatchOpener />);

      const forged = new CustomEvent(YOUTUBE_WATCH_EVENT, {
        cancelable: true,
        detail: { url: "https://evil.example/steal" },
      });
      window.dispatchEvent(forged);
      yield* Effect.yieldNow;

      expect(forged.defaultPrevented).toBe(false);
      expect(opener).not.toHaveBeenCalled();

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
    })
  );
});
