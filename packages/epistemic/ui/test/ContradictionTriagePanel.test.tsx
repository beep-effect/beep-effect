// @vitest-environment jsdom

import {
  contradictionKnownAtAtom,
  contradictionQueueAtom,
  contradictionQueueOffsetAtom,
  contradictionValidAtAtom,
} from "@beep/epistemic-client";
import { ContradictionTriagePanel } from "@beep/epistemic-ui";
import { it } from "@beep/test-runner";
import { RegistryContext, RegistryProvider } from "@effect/atom-react";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as O from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

describe("ContradictionTriagePanel", () => {
  const originalActEnvironment = Object.getOwnPropertyDescriptor(globalThis, "IS_REACT_ACT_ENVIRONMENT");
  let container: HTMLDivElement;
  let root: Root;

  beforeAll(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  });

  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("renders an accessible temporal initialization failure", () => {
    const temporalFailure = AsyncResult.failure<DateTime.Utc>(Cause.die("private temporal failure"));

    act(() =>
      root.render(
        <RegistryProvider
          initialValues={[
            [contradictionKnownAtAtom, temporalFailure],
            [contradictionValidAtAtom, temporalFailure],
          ]}
        >
          <ContradictionTriagePanel />
        </RegistryProvider>
      )
    );

    const alert = container.querySelector('[data-testid="contradiction-temporal-failure"]');
    expect(alert?.getAttribute("role")).toBe("alert");
    expect(alert?.getAttribute("aria-live")).toBe("assertive");
    expect(alert?.textContent).toContain("Unable to initialize the contradiction timeline");
    expect(alert?.textContent).not.toContain("private temporal failure");
  });

  it("resets queue paging when either timeline picker selects a new instant", () => {
    const instant = DateTime.makeUnsafe("2026-01-02T03:04:00Z");
    const registry = AtomRegistry.make({
      initialValues: [
        [contradictionValidAtAtom, AsyncResult.success(instant)],
        [contradictionKnownAtAtom, AsyncResult.success(instant)],
        [contradictionQueueAtom, AsyncResult.initial()],
      ],
    });
    const unmountOffset = registry.subscribe(contradictionQueueOffsetAtom, () => {});
    const pickDayThreeFromFirstPage = (pickerTestId: string): number => {
      const pickerRoot = createRoot(container);
      act(() =>
        pickerRoot.render(
          <RegistryContext.Provider value={registry}>
            <ContradictionTriagePanel />
          </RegistryContext.Provider>
        )
      );
      act(() => registry.set(contradictionQueueOffsetAtom, 50));
      act(() => container.querySelector<HTMLButtonElement>(`[data-testid="${pickerTestId}"] button`)?.click());
      const dayThree = A.findFirst(
        A.fromIterable(document.querySelectorAll<HTMLButtonElement>('[role="gridcell"]')),
        (cell) => cell.textContent === "3"
      );
      act(() => O.map(dayThree, (cell) => cell.click()));
      const offset = registry.get(contradictionQueueOffsetAtom);
      act(() => pickerRoot.unmount());
      return offset;
    };

    act(() => root.unmount());
    expect(pickDayThreeFromFirstPage("contradiction-valid-at")).toBe(0);
    expect(pickDayThreeFromFirstPage("contradiction-known-at")).toBe(0);
    root = createRoot(container);
    unmountOffset();
  });

  afterAll(() => {
    if (originalActEnvironment === undefined) Reflect.deleteProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT");
    else Object.defineProperty(globalThis, "IS_REACT_ACT_ENVIRONMENT", originalActEnvironment);
  });
});
