import { resolveEpistemicRpcHttpUrl } from "@beep/epistemic-client";
import { describe, expect, it } from "vitest";

const runtimeAt = (origin: string): Readonly<{ readonly location: Readonly<{ readonly origin: string }> }> => ({
  location: { origin },
});

describe("epistemic client protocol", () => {
  it("uses the same-origin RPC route for browser sessions", () => {
    expect(resolveEpistemicRpcHttpUrl(runtimeAt("https://app.example"))).toBe("https://app.example/rpc");
  });

  it.each(["http://tauri.localhost", "https://tauri.localhost", "tauri://localhost"])(
    "uses the sidecar endpoint for packaged origin %s",
    (origin) => {
      expect(resolveEpistemicRpcHttpUrl(runtimeAt(origin))).toBe("http://127.0.0.1:3939/rpc");
    }
  );

  it("uses the sidecar endpoint when no browser runtime is available", () => {
    expect(resolveEpistemicRpcHttpUrl(undefined)).toBe("http://127.0.0.1:3939/rpc");
  });
});
