import { describe, expect, test } from "bun:test";
import { chromeLinuxArial16, makePretextCaptureFixture, naturalWidth, PretextCaptureFixture } from "@beep/pretext";
import { Effect } from "effect";
import * as A from "effect/Array";
import * as Layer from "effect/Layer";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { TopLeftAnchoredBox } from "../AnchoredBox.ts";
import {
  type DockNode,
  type DockWorkspace,
  FloatingMember,
  GroupId,
  Panel,
  PanelId,
  PopulatedWorkspace,
  SplitId,
  SplitLayout,
  SplitNode,
  SplitRatio,
  TabsNode,
  TextPanelView,
} from "../Domain.ts";
import { DockBox, makeDockGeometryAtoms } from "../Geometry.ts";
import { makeTitleMinimaAtom, TabChrome, titleMinima, titleWords } from "../Minima.ts";

const snapshot = Effect.runSync(chromeLinuxArial16);
const metrics = snapshot.metrics;

const groupOne = GroupId.make("minima-group-one");
const groupTwo = GroupId.make("minima-group-two");
const groupFloating = GroupId.make("minima-group-floating");

const panel = (id: string, title: string): Panel =>
  Panel.make({ id: PanelId.make(id), title, view: TextPanelView.make({ text: title }) });

const tabs = (groupId: GroupId, titles: A.NonEmptyReadonlyArray<string>): TabsNode =>
  TabsNode.make({
    groupId,
    active: panel(`${groupId}-0`, A.headNonEmpty(titles)),
    after: A.map(A.tailNonEmpty(titles), (title, index) => panel(`${groupId}-${N.increment(index)}`, title)),
  });

const split = (ratio: number, left: DockNode, right: DockNode, splitId: SplitId): SplitNode =>
  SplitNode.make({
    splitId,
    layout: SplitLayout.cases.horizontal.make({ leftRatio: SplitRatio.make(ratio), left, right }),
  });

const floating = (root: DockNode): FloatingMember =>
  FloatingMember.make({
    anchoredBox: TopLeftAnchoredBox.make({ left: 0, top: 0, width: 100, height: 100 }),
    root,
  });

const settle = Effect.repeat(Effect.yieldNow, { times: 4 });

const settledAtomValue = <A>(atom: Atom.Atom<A>): Effect.Effect<A> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const registry = AtomRegistry.make();
      return [registry, registry.mount(atom)] as const;
    }),
    ([registry]) => Effect.map(settle, () => registry.get(atom)),
    ([registry, release]) =>
      Effect.sync(() => {
        release();
        registry.dispose();
      })
  );

describe("title minima projections", () => {
  test("deduplicates and sorts title words across docked and floating panels", () => {
    const workspace = PopulatedWorkspace.make({
      root: tabs(groupOne, ["dragon the", "The dragon"]),
      floating: [floating(tabs(groupFloating, ["page The"]))],
    });

    expect(titleWords(workspace)).toEqual(["The", "dragon", "page", "the"]);
  });

  test("sums measured tab widths with per-tab and strip chrome", () => {
    const workspace = PopulatedWorkspace.make({ root: tabs(groupOne, ["The dragon", "the page"]) });
    const chrome = TabChrome.make({ perTab: 7, strip: 11 });
    const expected = N.sum(
      11,
      N.sum(
        N.sum(O.getOrThrow(naturalWidth(metrics, "The dragon")), 7),
        N.sum(O.getOrThrow(naturalWidth(metrics, "the page")), 7)
      )
    );

    expect(R.get(titleMinima(metrics, workspace, chrome), groupOne)).toEqual(O.some(expected));
  });

  test("keeps measured siblings while unmeasured titles contribute zero", () => {
    const workspace = PopulatedWorkspace.make({ root: tabs(groupOne, ["dragon", "wyvern"]) });
    const chrome = TabChrome.make({ perTab: 5, strip: 3 });
    const expected = N.sum(3, N.sum(O.getOrThrow(naturalWidth(metrics, "dragon")), 5));

    expect(R.get(titleMinima(metrics, workspace, chrome), groupOne)).toEqual(O.some(expected));
  });

  test("omits groups with no measurable titles", () => {
    const workspace = PopulatedWorkspace.make({ root: tabs(groupOne, ["wyvern", "griffin"]) });

    expect(titleMinima(metrics, workspace, TabChrome.make())).toEqual({});
  });

  test("includes floating-member groups", () => {
    const workspace = PopulatedWorkspace.make({
      root: tabs(groupOne, ["The"]),
      floating: [floating(tabs(groupFloating, ["dragon"]))],
    });
    const minima = titleMinima(metrics, workspace, TabChrome.make());

    expect(R.get(minima, groupOne)).toEqual(naturalWidth(metrics, "The"));
    expect(R.get(minima, groupFloating)).toEqual(naturalWidth(metrics, "dragon"));
  });
});

describe("reactive title minima", () => {
  test("resolves fixture-backed capture to the pure minima record", () => {
    const workspace = PopulatedWorkspace.make({ root: tabs(groupOne, ["The dragon", "the page"]) });
    const chrome = TabChrome.make({ perTab: 4, strip: 8 });
    const minimaAtom = makeTitleMinimaAtom({
      workspaceAtom: Atom.make<DockWorkspace>(workspace),
      captureLayer: Layer.orDie(PretextCaptureFixture),
      font: "16px Arial",
      lineHeight: 20,
      chrome,
    });

    return Effect.runPromise(
      Effect.map(settledAtomValue(minimaAtom), (minima) => {
        expect(minima).toEqual(titleMinima(metrics, workspace, chrome));
      })
    );
  });

  test("degrades capture failure to an empty record", () => {
    const workspace = PopulatedWorkspace.make({ root: tabs(groupOne, ["wyvern"]) });
    const minimaAtom = makeTitleMinimaAtom({
      workspaceAtom: Atom.make<DockWorkspace>(workspace),
      captureLayer: makePretextCaptureFixture(snapshot),
      font: "16px Arial",
      lineHeight: 20,
    });

    return Effect.runPromise(
      Effect.map(settledAtomValue(minimaAtom), (minima) => {
        expect(minima).toEqual({});
      })
    );
  });

  test("feeds feasible clamps and preserves proportional degradation when infeasible", () => {
    const longTabs = tabs(groupOne, ["dragon slithers"]);
    const shortTabs = tabs(groupTwo, ["The"]);
    const workspace = PopulatedWorkspace.make({
      root: split(1_000, longTabs, shortTabs, SplitId.make("minima-split")),
    });
    const workspaceAtom = Atom.make<DockWorkspace>(workspace);
    const minimaAtom = makeTitleMinimaAtom({
      workspaceAtom,
      captureLayer: Layer.orDie(PretextCaptureFixture),
      font: "16px Arial",
      lineHeight: 20,
    });
    const requirement = O.getOrThrow(naturalWidth(metrics, "dragon slithers"));
    const feasible = makeDockGeometryAtoms({
      workspaceAtom,
      containerAtom: Atom.make(DockBox.make({ left: 0, top: 0, width: 160, height: 40 })),
      minimaAtom,
    });
    const infeasible = makeDockGeometryAtoms({
      workspaceAtom,
      containerAtom: Atom.make(DockBox.make({ left: 0, top: 0, width: 100, height: 40 })),
      minimaAtom,
    });

    return Effect.runPromise(
      Effect.gen(function* () {
        const feasibleBox = O.getOrThrow(yield* settledAtomValue(feasible.groupBoxAtom(groupOne)));
        const infeasibleBox = O.getOrThrow(yield* settledAtomValue(infeasible.groupBoxAtom(groupOne)));
        expect(feasibleBox.width).toBeGreaterThanOrEqual(requirement);
        expect(infeasibleBox.width).toBe(10);
        expect(infeasibleBox.width).toBeLessThan(requirement);
      })
    );
  });
});
