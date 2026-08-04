// @vitest-environment jsdom

import { contradictionKnownAtAtom, contradictionValidAtAtom } from "@beep/epistemic-client";
import { ContradictionTriagePanel } from "@beep/epistemic-ui";
import { RegistryProvider } from "@effect/atom-react";
import * as Cause from "effect/Cause";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import type * as DateTime from "effect/DateTime";
import type { Root } from "react-dom/client";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

describe("ContradictionTriagePanel", () => {
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
});
