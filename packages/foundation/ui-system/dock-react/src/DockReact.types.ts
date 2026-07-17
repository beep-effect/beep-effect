/**
 * Public prop, renderer, and adapter-api types for the React dock adapter.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { PanelId as PanelIdSchema } from "@beep/dock";
import { $DockReactId } from "@beep/identity";
import * as S from "effect/Schema";
import type { DockAtomOperation, GroupId, makeDockAtoms, PanelParameters, TabChrome } from "@beep/dock";
import type { PretextCapture } from "@beep/pretext";
import type { Effect, Layer } from "effect";
import type * as O from "effect/Option";
import type { Atom } from "effect/unstable/reactivity";
import type React from "react";
import type { RatioOverride, TabDrag } from "./internal/Gesture.models.ts";

/**
 * Atom graph consumed by the React dock adapter.
 *
 * @example
 * ```ts
 * import type { DockAtomGraph } from "@beep/dock-react"
 *
 * const workspaceAtom = (graph: DockAtomGraph) => graph.workspaceAtom
 * console.log(workspaceAtom)
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export type DockAtomGraph = Effect.Success<ReturnType<typeof makeDockAtoms>>;

const $I = $DockReactId.create("DockReact.types");

/**
 * Renderer-facing API for one dock panel.
 *
 * @example
 * ```ts
 * import { DockPanelApi } from "@beep/dock-react"
 * import { PanelId } from "@beep/dock"
 *
 * const api = DockPanelApi.make({ id: PanelId.make("panel-1") })
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class DockPanelApi extends S.Class<DockPanelApi>($I`DockPanelApi`)(
  {
    id: PanelIdSchema,
  },
  $I.annote("DockPanelApi", {
    description: "Renderer-facing API identifying the dock panel currently being rendered.",
  })
) {}

/**
 * Properties supplied to a dock panel renderer.
 *
 * @example
 * ```ts
 * import type { DockPanelProps } from "@beep/dock-react"
 *
 * const panelId = (props: DockPanelProps) => props.api.id
 * console.log(panelId)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export type DockPanelProps = {
  readonly params: PanelParameters;
  readonly api: DockPanelApi;
  readonly containerApi: DockviewAdapterApi;
};

/**
 * Panel-renderer properties extended with the tab title.
 *
 * @example
 * ```ts
 * import type { DockTabProps } from "@beep/dock-react"
 *
 * const tabTitle = (props: DockTabProps) => props.title
 * console.log(tabTitle)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export type DockTabProps = DockPanelProps & { readonly title: string };

/**
 * React component contract for rendering panel content.
 *
 * @example
 * ```ts
 * import type { DockRenderer } from "@beep/dock-react"
 *
 * const Renderer: DockRenderer = () => null
 * console.log(Renderer)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export type DockRenderer = React.FunctionComponent<DockPanelProps>;

/**
 * React component contract for rendering a panel tab.
 *
 * @example
 * ```ts
 * import type { DockTabRenderer } from "@beep/dock-react"
 *
 * const TabRenderer: DockTabRenderer = ({ title }) => title
 * console.log(TabRenderer)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export type DockTabRenderer = React.FunctionComponent<DockTabProps>;

/**
 * Imperative adapter surface exposed to panel renderers and `onReady` handlers.
 *
 * @example
 * ```ts
 * import type { DockviewAdapterApi } from "@beep/dock-react"
 *
 * const awaitIdle = (api: DockviewAdapterApi) => api.awaitIdle
 * console.log(awaitIdle)
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export type DockviewAdapterApi = {
  readonly submit: (operation: DockAtomOperation) => void;
  readonly awaitIdle: Effect.Effect<void>;
  readonly atoms: {
    readonly workspace: DockAtomGraph["workspaceAtom"];
    readonly panels: DockAtomGraph["panelsAtom"];
    readonly focusedGroup: Atom.Writable<O.Option<GroupId>>;
    readonly drag: Atom.Writable<O.Option<TabDrag>>;
    readonly ratioOverride: Atom.Writable<O.Option<RatioOverride>>;
  };
};

/**
 * Browser-side title measurement used to clamp docked group widths.
 *
 * A custom `captureLayer` must carry a `captureKey` — the provider's stable
 * semantic identity. Adapter state is cached per graph and measurement
 * configuration (gap, font, line height, chrome, captureKey), so layers
 * built inline on every render share one state as long as their key is
 * stable, while switching providers under a new key gets fresh state
 * instead of stale metrics. The default live provider needs no key.
 *
 * @example
 * ```ts
 * import type { DockTitleMinimaOptions } from "@beep/dock-react"
 *
 * const options: DockTitleMinimaOptions = { font: "16px sans-serif", lineHeight: 20 }
 * console.log(options.font)
 * ```
 *
 * @category adapters
 * @since 0.0.0
 */
export type DockTitleMinimaOptions = {
  readonly font: string;
  readonly lineHeight: number;
  readonly chrome?: TabChrome | undefined;
} & (
  | { readonly captureLayer: Layer.Layer<PretextCapture>; readonly captureKey: string }
  | { readonly captureLayer?: undefined; readonly captureKey?: undefined }
);

/**
 * Configuration and renderer registry accepted by {@link DockviewReact}.
 *
 * @example
 * ```ts
 * import type { DockviewReactProps } from "@beep/dock-react"
 *
 * const components = (props: DockviewReactProps) => props.components
 * console.log(components)
 * ```
 *
 * @category components
 * @since 0.0.0
 */
export type DockviewReactProps = {
  readonly graph: DockAtomGraph;
  readonly components: Readonly<Record<string, DockRenderer>>;
  readonly tabComponents?: Readonly<Record<string, DockTabRenderer>> | undefined;
  readonly watermarkComponent?: React.FunctionComponent | undefined;
  readonly defaultTabComponent?: DockTabRenderer | undefined;
  readonly onReady?: ((event: { readonly api: DockviewAdapterApi }) => void) | undefined;
  readonly options?:
    | { readonly gap?: number | undefined; readonly titleMinima?: DockTitleMinimaOptions | undefined }
    | undefined;
};
