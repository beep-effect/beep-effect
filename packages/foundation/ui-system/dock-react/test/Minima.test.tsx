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
import { it } from "@effect/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { Effect, pipe } from "effect";
import * as Layer from "effect/Layer";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Str from "effect/String";
import { afterEach, describe, expect } from "vitest";
import type { DockviewReactProps } from "@beep/dock-react";

const metrics = Effect.runSync(chromeLinuxArial16).metrics;
const requirement = O.getOrThrow(naturalWidth(metrics, "dragon slithers"));
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
  const graph = yield* makeDockAtoms(workspace(longTitle));
  render(<DockviewReact graph={graph} components={{}} options={options} />);
  resize(screen.getByTestId("dockview-react"), { width: containerWidth, height: 100 });
  return graph;
});

const longGroup = (): HTMLElement => {
  const node = screen.getByTestId("dockview-react").querySelector<HTMLElement>(`[data-group-id='${longGroupId}']`);
  if (node === null) throw new Error(`Missing group ${longGroupId}`);
  return node;
};

const width = (): number => pipe(longGroup().style.width, Str.slice(0, -2), N.parse, O.getOrThrow);

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
      const graph = yield* mount("dragon slithers", { titleMinima });
      yield* graph.awaitIdle;
      yield* Effect.promise(() => waitFor(() => expect(width()).toBeGreaterThanOrEqual(requirement)));
      graph.dispose();
    })
  );

  it.effect("preserves proportional geometry without title minima", () =>
    Effect.gen(function* () {
      const graph = yield* mount("dragon slithers");
      yield* graph.awaitIdle;
      yield* Effect.promise(() => waitFor(() => expect(width()).toBeLessThan(requirement)));
      graph.dispose();
    })
  );

  it.effect("clamps geometry with estimated title minima when capture fails", () =>
    Effect.gen(function* () {
      const graph = yield* mount("wyvern", { titleMinima });
      yield* graph.awaitIdle;
      // Capture failure no longer collapses to unclamped proportional (16px
      // here): the synchronous estimate holds the floor — "wyvern" is 6 chars
      // at the 7px estimate with zero default chrome, so 42px.
      yield* Effect.promise(() => waitFor(() => expect(width()).toBe(42)));
      graph.dispose();
    })
  );
});
