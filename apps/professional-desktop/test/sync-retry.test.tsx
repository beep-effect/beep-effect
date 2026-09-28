import { VaultSyncActionError } from "@beep/documents-use-cases/public";
import { DesktopSyncClient } from "@/sync/Sync.atoms";
import { VaultSyncPanel } from "@/sync/VaultSyncPanel";
import "@testing-library/jest-dom/vitest";
import { it } from "@beep/test-runner";
import { RegistryProvider } from "@effect/atom-react";
import { afterEach, describe, expect } from "@effect/vitest";
import { cleanup, render, waitFor, within } from "@testing-library/react";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Reactivity } from "effect/reactivity";

describe("a failed sync query is not a dead end", () => {
  afterEach(cleanup);

  it.effect(
    "offers a way to ask again when the status cannot be loaded",
    Effect.fnUntraced(function* () {
      // A failed sidecar status query had no retry, and
      // nothing else invalidates it — so a sidecar that merely restarted, or a single
      // dropped request, left the panel reading "unavailable" for the rest of the
      // session, long after sync had come back. A state with no way out of it is not a
      // state; it is an abandonment.
      const client = DesktopSyncClient.of((() =>
        VaultSyncActionError.failEffect("sync status unavailable")) as unknown as DesktopSyncClient["Service"]);
      const clientLayer = Layer.mergeAll(Layer.succeed(DesktopSyncClient, client), Reactivity.layer);
      const { container } = render(
        <RegistryProvider initialValues={[[DesktopSyncClient.runtime.layer, clientLayer]]}>
          <VaultSyncPanel floating={false} />
        </RegistryProvider>
      );
      const screen = within(container);

      const retry = yield* Effect.promise(() =>
        waitFor(() => screen.getByTestId("vault-sync-status-retry"), { timeout: 4_000 })
      );

      expect(retry).toBeInTheDocument();
      expect(retry).toHaveTextContent("Retry");
    })
  );
});
