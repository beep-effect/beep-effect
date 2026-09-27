import {
  DockBox,
  FloatingMember,
  GroupId,
  makeDockGeometryAtoms,
  makeTitleMinimaAtom,
  Panel,
  PanelId,
  PopulatedWorkspace,
  SplitId,
  SplitLayout,
  SplitNode,
  SplitRatio,
  TabChrome,
  TabsNode,
  TextPanelView,
  TopLeftAnchoredBox,
  titleMinima,
  titleWords,
} from "@beep/dock";
import {
  chromeLinuxArial16Encoded,
  FontMetricsSnapshotV1,
  makePretextCaptureFixture,
  naturalWidth,
  PretextCapture,
  PretextCaptureFixture,
  PretextMeasurementError,
} from "@beep/pretext";
import { describe, expect, it } from "@effect/vitest";
import { assertSome, assertTrue } from "@effect/vitest/utils";
import { Effect, Exit, Fiber, pipe, Queue, Result } from "effect";
import * as A from "effect/Array";
import * as Layer from "effect/Layer";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as R from "effect/Record";
import { Atom, AtomRegistry } from "effect/reactivity";
import * as S from "effect/Schema";
import type { DockNode, DockWorkspace } from "@beep/dock";

const snapshot = pipe(chromeLinuxArial16Encoded, S.decodeResult(FontMetricsSnapshotV1), Result.getOrThrow);
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

const observedCapture = Effect.fnUntraced(function* (fixture: Layer.Layer<PretextCapture>) {
  const fibers = yield* Queue.unbounded<Fiber.Fiber<unknown, unknown>>();
  const layer = Layer.effect(
    PretextCapture,
    Effect.map(PretextCapture, (capture) =>
      PretextCapture.of({
        captureFontMetrics: Effect.fn("PretextCapture.captureFontMetrics")((request) =>
          Effect.withFiber((fiber) => Effect.andThen(Queue.offer(fibers, fiber), capture.captureFontMetrics(request)))
        ),
      })
    )
  ).pipe(Layer.provide(fixture));
  return { layer, completed: Effect.flatMap(Queue.take(fibers), Fiber.await) };
});

const settledAtomValue = <A>(atom: Atom.Atom<A>, completed: Effect.Effect<Exit.Exit<unknown, unknown>>) =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const registry = AtomRegistry.make();
      return [registry, registry.mount(atom)] as const;
    }),
    ([registry]) => Effect.map(completed, (exit) => [registry.get(atom), exit] as const),
    ([registry, release]) =>
      Effect.sync(() => {
        release();
        registry.dispose();
      })
  );

describe("title minima projections", () => {
  it("deduplicates and sorts title words across docked and floating panels", () => {
    const workspace = PopulatedWorkspace.make({
      root: tabs(groupOne, ["dragon the", "The dragon"]),
      floating: [floating(tabs(groupFloating, ["page The"]))],
    });

    expect(titleWords(workspace)).toEqual(["The", "dragon", "page", "the"]);
  });

  it("sums measured tab widths with per-tab and strip chrome", () => {
    const workspace = PopulatedWorkspace.make({ root: tabs(groupOne, ["The dragon", "the page"]) });
    const chrome = TabChrome.make({ perTab: 7, strip: 11 });
    const expected = N.sum(
      11,
      N.sum(
        N.sum(O.getOrThrow(naturalWidth(metrics, "The dragon")), 7),
        N.sum(O.getOrThrow(naturalWidth(metrics, "the page")), 7)
      )
    );

    assertSome(R.get(titleMinima(metrics, workspace, chrome), groupOne), expected);
  });

  it("keeps measured siblings while unmeasured titles contribute zero", () => {
    const workspace = PopulatedWorkspace.make({ root: tabs(groupOne, ["dragon", "wyvern"]) });
    const chrome = TabChrome.make({ perTab: 5, strip: 3 });
    const expected = N.sum(3, N.sum(O.getOrThrow(naturalWidth(metrics, "dragon")), 5));

    assertSome(R.get(titleMinima(metrics, workspace, chrome), groupOne), expected);
  });

  it("omits groups with no measurable titles", () => {
    const workspace = PopulatedWorkspace.make({ root: tabs(groupOne, ["wyvern", "griffin"]) });

    expect(titleMinima(metrics, workspace, TabChrome.make())).toEqual({});
  });

  it("includes floating-member groups", () => {
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
  it.effect(
    "resolves fixture-backed capture to the pure minima record",
    Effect.fnUntraced(function* () {
      const capture = yield* PretextCaptureFixture.pipe(Layer.orDie, observedCapture);
      const workspace = PopulatedWorkspace.make({ root: tabs(groupOne, ["The dragon", "the page"]) });
      const chrome = TabChrome.make({ perTab: 4, strip: 8 });
      const minimaAtom = makeTitleMinimaAtom({
        workspaceAtom: Atom.make<DockWorkspace>(workspace),
        captureLayer: capture.layer,
        font: "16px Arial",
        lineHeight: 20,
        chrome,
      });

      const [minima, exit] = yield* settledAtomValue(minimaAtom, capture.completed);
      assertTrue(Exit.isSuccess(exit));
      expect(minima).toEqual(titleMinima(metrics, workspace, chrome));
    })
  );

  it.effect(
    "degrades capture failure to an empty record",
    Effect.fnUntraced(function* () {
      const capture = yield* observedCapture(makePretextCaptureFixture(snapshot));
      const workspace = PopulatedWorkspace.make({ root: tabs(groupOne, ["wyvern"]) });
      const minimaAtom = makeTitleMinimaAtom({
        workspaceAtom: Atom.make<DockWorkspace>(workspace),
        captureLayer: capture.layer,
        font: "16px Arial",
        lineHeight: 20,
      });

      const [minima, exit] = yield* settledAtomValue(minimaAtom, capture.completed);
      const failure = yield* pipe(
        exit,
        Exit.findErrorOption,
        O.getOrThrow,
        S.decodeUnknownEffect(S.toType(PretextMeasurementError))
      );
      expect(failure.operation).toBe("fixtureCapture");
      expect(failure.message).toBe("Fixture does not carry widths for: wyvern.");
      expect(minima).toEqual({});
    })
  );

  it.effect(
    "feeds feasible clamps and preserves proportional degradation when infeasible",
    Effect.fnUntraced(function* () {
      const capture = yield* PretextCaptureFixture.pipe(Layer.orDie, observedCapture);
      const longTabs = tabs(groupOne, ["dragon slithers"]);
      const shortTabs = tabs(groupTwo, ["The"]);
      const workspace = PopulatedWorkspace.make({
        root: split(1_000, longTabs, shortTabs, SplitId.make("minima-split")),
      });
      const workspaceAtom = Atom.make<DockWorkspace>(workspace);
      const minimaAtom = makeTitleMinimaAtom({
        workspaceAtom,
        captureLayer: capture.layer,
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

      const [feasibleValue, feasibleExit] = yield* settledAtomValue(feasible.groupBoxAtom(groupOne), capture.completed);
      const [infeasibleValue, infeasibleExit] = yield* settledAtomValue(
        infeasible.groupBoxAtom(groupOne),
        capture.completed
      );
      assertTrue(Exit.isSuccess(feasibleExit));
      assertTrue(Exit.isSuccess(infeasibleExit));
      const feasibleBox = O.getOrThrow(feasibleValue);
      const infeasibleBox = O.getOrThrow(infeasibleValue);
      expect(feasibleBox.width).toBeGreaterThanOrEqual(requirement);
      expect(infeasibleBox.width).toBe(10);
      expect(infeasibleBox.width).toBeLessThan(requirement);
    })
  );
});
