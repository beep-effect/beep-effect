import { resolveChatRpcServerUrl } from "@beep/agents-client/Chat.atoms";
import { describe, expect, it } from "vitest";

const SIDECAR_RPC_URL = "http://127.0.0.1:3939/rpc";

// DesktopHttpProtocol.ts derives its SERVER_URL from this same resolver, so the
// desktop transport is covered by these cases without a duplicate local copy.
describe("packaged Tauri RPC origin routing", () => {
  it.each(["http", "https"])("routes the Windows %s packaged origin to the loopback sidecar", (scheme) => {
    expect(resolveChatRpcServerUrl(`${scheme}://tauri.localhost`)).toBe(SIDECAR_RPC_URL);
  });

  it("keeps ordinary HTTP development origins relative to the dev server", () => {
    expect(resolveChatRpcServerUrl("http://professional-desktop.beep.localhost:1355")).toBe(
      "http://professional-desktop.beep.localhost:1355/rpc"
    );
  });

  it("falls back to the sidecar for non-HTTP origins", () => {
    expect(resolveChatRpcServerUrl("tauri://localhost")).toBe(SIDECAR_RPC_URL);
    expect(resolveChatRpcServerUrl(undefined)).toBe(SIDECAR_RPC_URL);
  });
});
