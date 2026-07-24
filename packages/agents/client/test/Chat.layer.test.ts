import { resolveChatRpcHttpUrl } from "@beep/agents-client/Chat.layer";
import { describe, expect, it } from "@effect/vitest";

const runtimeAt = (origin: string) => ({ location: { origin } });

describe("chat HTTP endpoint resolution", () => {
  it("uses the same-origin RPC route for HTTP and HTTPS browser runtimes", () => {
    expect(resolveChatRpcHttpUrl(runtimeAt("http://localhost:5173"))).toBe("http://localhost:5173/rpc");
    expect(resolveChatRpcHttpUrl(runtimeAt("https://app.example"))).toBe("https://app.example/rpc");
  });

  it("falls back to the sidecar for custom, missing, and malformed origins", () => {
    expect(resolveChatRpcHttpUrl(runtimeAt("tauri://localhost"))).toBe("http://127.0.0.1:3939/rpc");
    expect(resolveChatRpcHttpUrl(runtimeAt("http://tauri.localhost"))).toBe("http://127.0.0.1:3939/rpc");
    expect(resolveChatRpcHttpUrl(runtimeAt("https://tauri.localhost"))).toBe("http://127.0.0.1:3939/rpc");
    expect(resolveChatRpcHttpUrl(runtimeAt("http://"))).toBe("http://127.0.0.1:3939/rpc");
    expect(resolveChatRpcHttpUrl()).toBe("http://127.0.0.1:3939/rpc");
  });
});
