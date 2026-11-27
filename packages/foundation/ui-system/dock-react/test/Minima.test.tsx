import {
  GroupId,
  HorizontalSplitLayout,
  makeDockAtoms,
  Panel,
  PanelId,
  PopulatedWorkspace,
  SplitId,
  SplitNode,
  SplitRatio,
  TabsNode,
  TextPanelView,
} from "@beep/dock";
import { DockviewReact } from "@beep/dock-react";
import { resize } from "@beep/dock-react/internal/ResizeObserverHarness";
import { chromeLinuxArial16, naturalWidth, PretextCaptureFixture } from "@beep/pretext";
import { it } from "@beep/test-runner";
import { afterEach, describe, expect } from "@effect/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Str from "effect/String";
import type { DockviewReactProps } from "@beep/dock-react";

const longGroupId = GroupId.make("minima-long");
const shortGroupId = GroupId.make("minima-short");
const containerWidth = 160;

const panel = (id: string, title: string): Panel =>
  Panel.make({ id: PanelId.make(id), title, view: TextPanelView.make({ text: title }) });

const workspace = (longTitle: string) =>
  PopulatedWorkspace.make({
    root: SplitNode.make({
      splitId: SplitId.make("minima-split"),
      layout: HorizontalSplitLayout.make({
        leftRatio: SplitRatio.make(1_000),
        left: TabsNode.make({ groupId: longGroupId, active: panel("minima-long-panel", longTitle) }),
        right: TabsNode.make({ groupId: shortGroupId, active: panel("minima-short-panel", "The") }),
      }),
    }),
  });

const mount = Effect.fn("MinimaTest.mount")(function* (
  longTitle: string,
  options?: DockviewReactProps["options"] | undefined
) {
  const graph = yield* Effect.acquireRelease(makeDockAtoms(workspace(longTitle)), (graph) =>
    Effect.sync(() => graph.dispose())
  );
  render(<DockviewReact graph={graph} components={{}} options={options} />);
  resize(screen.getByTestId("dockview-react"), { width: containerWidth, height: 100 });
  return graph;
});

const longGroup = (): HTMLElement => {
  const node = screen.getByTestId("dockview-react").querySelector<HTMLElement>(`[data-group-id='${longGroupId}']`);
  if (node === null) throw new Error(`Missing group ${longGroupId}`);
  return node;
};

const width = (): number =>
  pipe(longGroup().style.getPropertyValue("--dock-width"), Str.slice(0, -2), N.parse, O.getOrThrow);

const titleMinima = {
  font: "16px Arial",
  lineHeight: 20,
  captureLayer: Layer.orDie(PretextCaptureFixture),
  captureKey: "fixture",
};

afterEach(cleanup);

describe("dock title minima", { concurrent: false }, () => {
  it.effect("clamps a feasible split to the measured long-title width", () =>
    Effect.gen(function* () {
      const requirement = O.getOrThrow(naturalWidth((yield* chromeLinuxArial16).metrics, "dragon slithers"));
      const graph = yield* mount("dragon slithers", { titleMinima });
      yield* graph.awaitIdle;
      yield* Effect.promise(() => waitFor(() => expect(width()).toBeGreaterThanOrEqual(requirement)));
    })
  );

  it.effect("preserves proportional geometry without title minima", () =>
    Effect.gen(function* () {
      const requirement = O.getOrThrow(naturalWidth((yield* chromeLinuxArial16).metrics, "dragon slithers"));
      const graph = yield* mount("dragon slithers");
      yield* graph.awaitIdle;
      yield* Effect.promise(() => waitFor(() => expect(width()).toBeLessThan(requirement)));
    })
  );

  it.effect("clamps geometry with estimated title minima when capture fails", () =>
    Effect.gen(function* () {
      const graph = yield* mount("wyvern", { titleMinima });
      yield* graph.awaitIdle;
      yield* Effect.promise(() =>
        waitFor(() =>
          expect(width(), "on capture failure the estimate holds: 6 chars of 'wyvern' at 7px, zero chrome").toBe(42)
        )
      );
    })
  );
});
