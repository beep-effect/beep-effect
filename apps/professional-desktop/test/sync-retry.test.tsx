import { VaultSyncActionError } from "@beep/documents-use-cases/public";
import { DesktopSyncClient } from "@/sync/Sync.atoms";
import { VaultSyncPanel } from "@/sync/VaultSyncPanel";
import "@testing-library/jest-dom/vitest";
import { it } from "@beep/test-runner";
import { RegistryProvider } from "@effect/atom-react";
import { afterEach, describe, expect } from "@effect/vitest";
import { cleanup, fireEvent, render, waitFor, within } from "@testing-library/react";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as MutableRef from "effect/MutableRef";
import * as Reactivity from "effect/reactivity/Reactivity";
import * as Stream from "effect/Stream";

describe("a failed sync query is not a dead end, serial: shared jsdom localStorage and global cleanup", {
  concurrent: false,
}, () => {
  afterEach(() => {
    cleanup();
    globalThis.localStorage.clear();
  });

  it.effect(
    "offers a way to ask again when the status cannot be loaded",
    Effect.fnUntraced(function* () {
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

      expect(
        retry,
        "nothing else invalidates a failed status query, so without a retry a restarted sidecar reads unavailable all session"
      ).toBeInTheDocument();
      expect(retry).toHaveTextContent("Retry");
    })
  );

  it.effect(
    "shows the retry in flight for both the status and the conflicts",
    Effect.fnUntraced(function* () {
      const retryClicked = MutableRef.make(false);
      const client = DesktopSyncClient.of(((tag: string) =>
        tag === "WatchVaultSyncStatus"
          ? MutableRef.get(retryClicked)
            ? Stream.never
            : Stream.unwrap(VaultSyncActionError.failEffect("sync status unavailable"))
          : MutableRef.get(retryClicked)
            ? Effect.never
            : VaultSyncActionError.failEffect("sync query unavailable")) as unknown as DesktopSyncClient["Service"]);
      const clientLayer = Layer.mergeAll(Layer.succeed(DesktopSyncClient, client), Reactivity.layer);
      const { container } = render(
        <RegistryProvider initialValues={[[DesktopSyncClient.runtime.layer, clientLayer]]}>
          <VaultSyncPanel floating={false} />
        </RegistryProvider>
      );
      const screen = within(container);
      const statusRetry = yield* Effect.promise(() =>
        waitFor(() => screen.getByTestId("vault-sync-status-retry"), { timeout: 4_000 })
      );
      const conflictsRetry = yield* Effect.promise(() =>
        waitFor(() => screen.getByTestId("vault-sync-conflicts-retry"), { timeout: 4_000 })
      );
      expect(statusRetry).toHaveTextContent("Retry");
      expect(conflictsRetry).toHaveTextContent("Retry");

      MutableRef.set(retryClicked, true);
      fireEvent.click(statusRetry);
      fireEvent.click(conflictsRetry);
      yield* Effect.promise(() =>
        waitFor(
          () => {
            expect(
              screen.getByTestId("vault-sync-status-retry"),
              "every call after the click stays pending, so the refresh never settles and Retrying… renders on every run"
            ).toHaveTextContent("Retrying…");
            expect(screen.getByTestId("vault-sync-conflicts-retry")).toHaveTextContent("Retrying…");
          },
          { timeout: 4_000 }
        )
      );
      expect(screen.getByTestId("vault-sync-status-retry")).toBeDisabled();
      expect(screen.getByTestId("vault-sync-conflicts-retry")).toBeDisabled();
    })
  );
});
