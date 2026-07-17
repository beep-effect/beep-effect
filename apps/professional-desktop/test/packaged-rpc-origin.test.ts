import { resolveChatRpcHttpUrl } from "@beep/agents-client/Chat.layer";
import { describe, expect, it } from "vitest";

const SIDECAR_RPC_URL = "http://127.0.0.1:3939/rpc";
const runtimeAt = (origin: string) => ({ location: { origin } });

// DesktopHttpProtocol.ts derives its SERVER_URL from this same resolver, so the
// desktop transport is covered by these cases without a duplicate local copy.
describe("packaged Tauri RPC origin routing", () => {
  it.each(["http", "https"])("routes the Windows %s packaged origin to the loopback sidecar", (scheme) => {
    expect(resolveChatRpcHttpUrl(runtimeAt(`${scheme}://tauri.localhost`))).toBe(SIDECAR_RPC_URL);
  });

  it("keeps ordinary HTTP development origins relative to the dev server", () => {
    expect(resolveChatRpcHttpUrl(runtimeAt("http://professional-desktop.beep.localhost:1355"))).toBe(
      "http://professional-desktop.beep.localhost:1355/rpc"
    );
  });

  it("falls back to the sidecar for non-HTTP origins", () => {
    expect(resolveChatRpcHttpUrl(runtimeAt("tauri://localhost"))).toBe(SIDECAR_RPC_URL);
    expect(resolveChatRpcHttpUrl()).toBe(SIDECAR_RPC_URL);
  });
});
