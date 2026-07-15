/**
 * Headless title-width minima projections for the Dockview POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $DockId } from "@beep/identity/packages";
import { naturalWidth, PretextCapture, PretextCaptureRequest } from "@beep/pretext";
import { SchemaUtils } from "@beep/schema";
import { Layer, Number as N, Order, pipe } from "effect";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { DockNode, DockWorkspace as DockWorkspaceModel, TabsNode } from "./Dock.tree.ts";
import type { FontMetrics } from "@beep/pretext";
import type { GroupMinimaRecord } from "./Dock.geometry.ts";
import type { DockWorkspace } from "./Dock.tree.ts";

const $I = $DockId.create("Minima");

const PixelAllowance = S.Finite.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("PixelAllowance", { description: "A finite non-negative pixel allowance." })
);

const emptyMinima: GroupMinimaRecord = R.empty<string, number>();
const wordSeparator = "\u0000";

const workspaceTabs = (workspace: DockWorkspace): ReadonlyArray<TabsNode> =>
  pipe(DockWorkspaceModel.roots(workspace), A.flatMap(DockNode.tabs));

interface MakeTitleMinimaAtomInput {
  readonly captureLayer: Layer.Layer<PretextCapture>;
  readonly chrome?: TabChrome | undefined;
  readonly font: string;
  readonly lineHeight: number;
  readonly workspaceAtom: Atom.Atom<DockWorkspace>;
}

/**
 * Pixel allowances added around measured tab titles.
 *
 * @category models
 * @since 0.0.0
 */
/**
 * Pixel allowances surrounding measured tab titles.
 *
 * @example
 * ```ts
 * import { TabChrome } from "@beep/dock"
 *
 * const chrome = TabChrome.make({ perTab: 7, strip: 11 })
 * console.log(chrome.strip)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TabChrome extends S.Class<TabChrome>($I`TabChrome`)(
  {
    perTab: PixelAllowance.pipe(SchemaUtils.withConstantDefault<number>(0)),
    strip: PixelAllowance.pipe(SchemaUtils.withConstantDefault<number>(0)),
  },
  $I.annote("TabChrome", { description: "Per-tab and fixed tab-strip pixel allowances." })
) {}

/**
 * Distinct sorted words from every docked and floating panel title.
 *
 * @category projections
 * @since 0.0.0
 */
/**
 * Returns distinct sorted words from all docked and floating panel titles.
 *
 * @example
 * ```ts
 * import { GroupId, Panel, PanelId, PopulatedWorkspace, TabsNode, TextPanelView, titleWords } from "@beep/dock"
 *
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "The dragon", view: TextPanelView.make({ text: "one" }) })
 * const workspace = PopulatedWorkspace.make({ root: TabsNode.make({ groupId: GroupId.make("group-one"), active: panel }) })
 * const words = titleWords(workspace)
 * console.log(words)
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const titleWords = (workspace: DockWorkspace): ReadonlyArray<string> =>
  pipe(
    workspaceTabs(workspace),
    A.flatMap(TabsNode.panels),
    A.flatMap((panel) => Str.split(panel.title, " ")),
    A.dedupe,
    A.sort(Order.String)
  );

/**
 * Per-group no-truncation title floors from an existing font-metrics snapshot.
 *
 * @category projections
 * @since 0.0.0
 */
/**
 * Computes per-group no-truncation title floors from font metrics.
 *
 * @example
 * ```ts
 * import { GroupId, Panel, PanelId, PopulatedWorkspace, TabChrome, TabsNode, TextPanelView, titleMinima } from "@beep/dock"
 * import { EngineProfile, FontMetrics } from "@beep/pretext"
 * import * as O from "effect/Option"
 *
 * const groupId = GroupId.make("group-one")
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "Panel One", view: TextPanelView.make({ text: "one" }) })
 * const workspace = PopulatedWorkspace.make({ root: TabsNode.make({ groupId, active: panel }) })
 * const metrics = FontMetrics.make({
 *   capturedAt: "2026-07-15",
 *   engine: "example",
 *   platform: "example",
 *   font: "16px Arial",
 *   lineHeight: 20,
 *   spaceWidth: 4,
 *   words: { Panel: 40, One: 30 },
 *   engineProfile: EngineProfile.make({
 *     lineFitEpsilon: 0,
 *     carryCJKAfterClosingQuote: false,
 *     breakKeepAllAfterPunctuation: false,
 *     preferPrefixWidthsForBreakableRuns: false,
 *     preferEarlySoftHyphenBreak: false
 *   }),
 *   sentence: O.none(),
 *   oracle: O.none(),
 *   domLineCounts: O.none()
 * })
 * const minima = titleMinima(metrics, workspace, TabChrome.make({ perTab: 7, strip: 11 }))
 * console.log(minima[groupId])
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const titleMinima = (metrics: FontMetrics, workspace: DockWorkspace, chrome: TabChrome): GroupMinimaRecord =>
  pipe(
    workspaceTabs(workspace),
    A.reduce(emptyMinima, (record, tabs) => {
      const measured = pipe(
        TabsNode.panels(tabs),
        A.map((panel) => naturalWidth(metrics, panel.title)),
        A.getSomes
      );
      return A.match(measured, {
        onEmpty: () => record,
        onNonEmpty: (widths) =>
          R.set(
            record,
            tabs.groupId,
            N.sum(
              chrome.strip,
              A.reduce(widths, 0, (total, width) => N.sum(total, N.sum(width, chrome.perTab)))
            )
          ),
      });
    })
  );

/**
 * Reactive title minima backed by headless font-metrics capture.
 *
 * @category atoms
 * @since 0.0.0
 */
/**
 * Composes a reactive title-minima projection with headless font capture.
 *
 * @example
 * ```ts
 * import { GroupId, Panel, PanelId, PopulatedWorkspace, TabsNode, TextPanelView, makeTitleMinimaAtom } from "@beep/dock"
 * import { PretextCaptureFixture } from "@beep/pretext"
 * import { Effect } from "effect"
 * import * as Layer from "effect/Layer"
 * import { Atom, AtomRegistry } from "effect/unstable/reactivity"
 *
 * const groupId = GroupId.make("group-one")
 * const panel = Panel.make({ id: PanelId.make("panel-one"), title: "The dragon", view: TextPanelView.make({ text: "one" }) })
 * const workspace = PopulatedWorkspace.make({ root: TabsNode.make({ groupId, active: panel }) })
 * const minimaAtom = makeTitleMinimaAtom({
 *   workspaceAtom: Atom.make(workspace),
 *   captureLayer: Layer.orDie(PretextCaptureFixture),
 *   font: "16px Arial",
 *   lineHeight: 20
 * })
 * const registry = AtomRegistry.make()
 * const release = registry.mount(minimaAtom)
 * await Effect.runPromise(Effect.repeat(Effect.yieldNow, { times: 4 }))
 * console.log(registry.get(minimaAtom)[groupId])
 * release()
 * registry.dispose()
 * ```
 *
 * @category projections
 * @since 0.0.0
 */
export const makeTitleMinimaAtom = (input: MakeTitleMinimaAtomInput): Atom.Atom<GroupMinimaRecord> => {
  const factory = Atom.context({ memoMap: Layer.makeMemoMapUnsafe() });
  const runtime = factory(input.captureLayer);
  const chrome = O.getOrElse(O.fromUndefinedOr(input.chrome), () => TabChrome.make());
  const captureAtom = Atom.family((key: string) =>
    runtime.atom(
      PretextCapture.use((capture) =>
        capture.captureFontMetrics(
          PretextCaptureRequest.make({
            font: input.font,
            lineHeight: input.lineHeight,
            words: Str.split(key, wordSeparator),
          })
        )
      )
    )
  );

  return Atom.readable((get) => {
    const workspace = get(input.workspaceAtom);
    return A.match(titleWords(workspace), {
      onEmpty: () => emptyMinima,
      onNonEmpty: (words) =>
        AsyncResult.matchWithWaiting(get(captureAtom(A.join(words, wordSeparator))), {
          onWaiting: () => emptyMinima,
          onError: () => emptyMinima,
          onDefect: () => emptyMinima,
          onSuccess: ({ value: snapshot }) => titleMinima(snapshot.metrics, workspace, chrome),
        }),
    });
  });
};
