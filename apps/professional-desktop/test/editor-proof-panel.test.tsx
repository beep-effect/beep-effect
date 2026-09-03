import "@testing-library/jest-dom/vitest";
import { RegistryProvider } from "@effect/atom-react";
import { describe, expect, it } from "@effect/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import * as Effect from "effect/Effect";
import { afterEach } from "vitest";
import { EditorProofPanel } from "@/editor-proof/EditorProofPanel";

afterEach(cleanup);

describe("EditorProofPanel", { concurrent: false }, () => {
  it.effect(
    "switches profiles without losing the heading and keeps the editor after invalid import",
    Effect.fnUntraced(function* () {
      render(
        <RegistryProvider>
          <EditorProofPanel />
        </RegistryProvider>
      );
      expect(screen.getByTestId("editor-proof-panel")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "Capability proof" })).toBeVisible();
      expect(screen.getByRole("toolbar").querySelectorAll("button")).toHaveLength(4);
      fireEvent.click(screen.getByLabelText("Document proof"));
      expect(screen.getByRole("toolbar").querySelectorAll("button").length).toBeGreaterThan(4);
      expect(screen.getByRole("heading", { name: "Capability proof" })).toBeVisible();
      fireEvent.change(screen.getByLabelText("Canonical JSON"), { target: { value: "not json" } });
      fireEvent.click(screen.getByRole("button", { name: "Import canonical JSON" }));
      expect(screen.getByRole("alert")).toHaveTextContent("Canonical import failed");
      expect(document.querySelector('[contenteditable="true"]')).toBeInTheDocument();
      yield* Effect.void;
    })
  );
});
