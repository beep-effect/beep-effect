import { VaultSyncSessionBinding } from "@beep/documents-server/aggregates/Sync";
import { describe, expect, it } from "@effect/vitest";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { layerDesktopVaultSyncBinding } from "@/sync/VaultSyncSession";
import {
  desktopVaultSyncRemoteCli,
  makeVaultSyncTransportLayer,
  VAULT_SYNC_MCP_PATH,
} from "../server/VaultSyncTransport";

describe("desktop vault-sync transport", () => {
  it.effect("binds the launch token to the signed-in desktop principal without a captured grant", () =>
    Effect.gen(function* () {
      const token = Redacted.make("launch-token");
      const context = yield* Layer.build(token.pipe(layerDesktopVaultSyncBinding));
      const binding = Context.get(context, VaultSyncSessionBinding);
      expect(binding.request.principal).toEqual({ kind: "User", userId: 1 });
      expect(binding.request.orgId).toBe(1);
      expect(binding.request.workspaceId).toBe(1);
      expect(binding.request.sourceKind).toBe("sidecar");
      expect(Redacted.value(binding.token)).toBe("launch-token");
      expect(binding.request).not.toHaveProperty("grants");
    })
  );

  it("exposes HTTP, remote CLI RPC and MCP mounts and a remote CLI", () => {
    expect(Layer.isLayer(makeVaultSyncTransportLayer({ token: Redacted.make("launch-token") }))).toBe(true);
    expect(VAULT_SYNC_MCP_PATH).toBe("/vault-sync/mcp");
    expect(desktopVaultSyncRemoteCli(3939).name).toBe("vault-sync-api");
  });
});
