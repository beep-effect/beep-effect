/**
 * jsdom render tests for the document intake boundary's vault notice.
 *
 * Against the real desktop intake client the vault read fails where nothing
 * listens and hangs where the connection does, so the retry notice rendered on
 * some machines and not others. These renders name their client.
 */

import "@testing-library/jest-dom/vitest";
import { it } from "@beep/test-runner";
import { WorkspaceVaultActionError } from "@beep/workspace-use-cases/public";
import { RegistryProvider } from "@effect/atom-react";
import { afterEach, describe, expect } from "@effect/vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";
import * as Reactivity from "effect/reactivity/Reactivity";
import { DesktopIntakeClient } from "@/intake/DesktopIntake.client";
import { DocumentIntakeTarget } from "@/intake/DocumentIntakeTarget";
import { configuredVault, intakeClient } from "./support/IntakeHarness.ts";
import type { IntakeHandlers } from "./support/IntakeHarness.ts";

afterEach(() => {
  cleanup();
});

const renderTarget = (handlers: IntakeHandlers) =>
  render(
    <RegistryProvider
      initialValues={[
        [
          DesktopIntakeClient.runtime.layer,
          Layer.mergeAll(Layer.succeed(DesktopIntakeClient, intakeClient(handlers)), Reactivity.layer),
        ],
      ]}
    >
      <DocumentIntakeTarget>
        <div data-testid="intake-child">content</div>
      </DocumentIntakeTarget>
    </RegistryProvider>
  );

describe("DocumentIntakeTarget vault notice", { concurrent: false }, () => {
  it("keeps the notice hidden while the vault configuration is still being read", () => {
    const { getByTestId, queryByTestId, unmount } = renderTarget({ GetWorkspaceVault: () => Effect.never });

    expect(getByTestId("document-intake-target")).toBeInTheDocument();
    expect(getByTestId("intake-child")).toBeInTheDocument();
    expect(queryByTestId("intake-vault-unavailable")).toBeNull();
    unmount();
  });

  it.effect(
    "shows the unavailable notice after a failed vault read and clears it when the retry succeeds",
    Effect.fnUntraced(function* () {
      const attempts = yield* Ref.make(0);
      const { findByTestId, getByTestId, queryByTestId, unmount } = renderTarget({
        GetWorkspaceVault: () =>
          Effect.flatMap(
            Ref.updateAndGet(attempts, (count) => count + 1),
            (count) =>
              count === 1
                ? Effect.fail(WorkspaceVaultActionError.new("Vault store unavailable."))
                : Effect.succeed(configuredVault)
          ),
      });

      yield* Effect.promise(() => findByTestId("intake-vault-unavailable"));
      expect(getByTestId("intake-vault-unavailable")).toHaveTextContent("Workspace vault status is unavailable");
      fireEvent.click(getByTestId("intake-vault-retry"));
      yield* Effect.promise(() => waitFor(() => expect(queryByTestId("intake-vault-unavailable")).toBeNull()));
      expect(yield* Ref.get(attempts)).toBe(2);
      unmount();
    })
  );
});
