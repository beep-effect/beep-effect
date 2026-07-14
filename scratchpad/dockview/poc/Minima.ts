/**
 * Headless title-width minima projections for the Dockview POC.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $ScratchpadId } from "@beep/identity/packages";
import { type FontMetrics, naturalWidth, PretextCapture, PretextCaptureRequest } from "@beep/pretext";
import { SchemaUtils } from "@beep/schema";
import { pipe } from "effect";
import * as A from "effect/Array";
import * as Layer from "effect/Layer";
import * as N from "effect/Number";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { AsyncResult, Atom } from "effect/unstable/reactivity";
import { DockNode, type DockWorkspace, DockWorkspace as DockWorkspaceModel, TabsNode } from "./Domain.ts";
import type { GroupMinimaRecord } from "./Geometry.ts";

const $I = $ScratchpadId.create("dockview/poc/Minima");

const PixelAllowance = S.Finite.check(S.isGreaterThanOrEqualTo(0)).pipe(
  $I.annoteSchema("PixelAllowance", { description: "A finite non-negative pixel allowance." })
);

const emptyMinima: GroupMinimaRecord = R.empty<string, number>();
const wordSeparator = "\u0000";

const workspaceTabs = (workspace: DockWorkspace): ReadonlyArray<TabsNode> =>
  pipe(DockWorkspaceModel.roots(workspace), A.flatMap(DockNode.tabs));

/**
 * Pixel allowances added around measured tab titles.
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
export const makeTitleMinimaAtom = (input: {
  readonly workspaceAtom: Atom.Atom<DockWorkspace>;
  readonly captureLayer: Layer.Layer<PretextCapture>;
  readonly font: string;
  readonly lineHeight: number;
  readonly chrome?: TabChrome | undefined;
}): Atom.Atom<GroupMinimaRecord> => {
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
