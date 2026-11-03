import "@testing-library/jest-dom/vitest";
import { it } from "@beep/test-runner";
import { RegistryProvider } from "@effect/atom-react";
import { afterEach, expect, vi } from "@effect/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import * as Effect from "effect/Effect";
import * as PlatformError from "effect/PlatformError";

const invoke = vi.hoisted(() => vi.fn());
vi.mock("@tauri-apps/api/core", (importOriginal) =>
  importOriginal<typeof import("@tauri-apps/api/core")>().then((original) => ({ ...original, invoke }))
);

import { App } from "@/App";

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  invoke.mockReset();
});

it.effect("shows a recoverable desktop transport failure when the native bridge rejects", () =>
  Effect.gen(function* () {
    vi.stubGlobal("__TAURI_INTERNALS__", {});
    invoke.mockRejectedValueOnce(
      PlatformError.systemError({ _tag: "NotFound", module: "ChildProcess", method: "sidecar_transport" })
    );
    render(
      <RegistryProvider>
        <App />
      </RegistryProvider>
    );
    yield* Effect.promise(() =>
      waitFor(() => expect(screen.getByRole("heading", { name: "Desktop transport unavailable" })).toBeVisible())
    );
    expect(invoke).toHaveBeenCalledWith("sidecar_transport");
    expect(screen.queryByTestId("chat-app")).toBeNull();
  })
);
