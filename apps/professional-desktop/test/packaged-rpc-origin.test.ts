import { resolveChatRpcServerUrl } from "@beep/agents-client/Chat.atoms";
import { describe, expect, it } from "vitest";
import { resolveDesktopRpcServerUrl } from "@/transport/DesktopHttpProtocol";

const SIDECAR_RPC_URL = "http://127.0.0.1:3939/rpc";
const resolvers = [resolveDesktopRpcServerUrl, resolveChatRpcServerUrl];

describe("packaged Tauri RPC origin routing", () => {
  it.each(["http", "https"])("routes the Windows %s packaged origin to the loopback sidecar", (scheme) => {
    const origin = `${scheme}://tauri.localhost`;

    for (const resolveRpcServerUrl of resolvers) {
      expect(resolveRpcServerUrl(origin)).toBe(SIDECAR_RPC_URL);
    }
  });

  it("keeps ordinary HTTP development origins relative to the dev server", () => {
    for (const resolveRpcServerUrl of resolvers) {
      expect(resolveRpcServerUrl("http://professional-desktop.beep.localhost:1355")).toBe(
        "http://professional-desktop.beep.localhost:1355/rpc"
      );
    }
  });
});
