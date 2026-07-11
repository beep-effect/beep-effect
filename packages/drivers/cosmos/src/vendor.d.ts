declare module "@cosmos.gl/graph" {
  export class Graph {
    readonly destroy?: () => void;
    readonly render: () => void;
    readonly setLinks: (links: Float32Array) => void;
    readonly setPointPositions: (positions: Float32Array) => void;
    readonly stop?: () => void;

    constructor(
      container: HTMLElement,
      config: {
        readonly enableDrag: boolean;
        readonly enableSimulation: boolean;
        readonly fitViewDelay: number;
        readonly fitViewOnInit: boolean;
        readonly fitViewPadding: number;
        readonly linkBlending: boolean;
        readonly simulationFriction: number;
        readonly simulationGravity: number;
        readonly simulationRepulsion: number;
        readonly transitionDuration: number;
      }
    );
  }
}

declare module "graphology" {
  export default class Graph {
    constructor(options: { readonly multi: boolean; readonly type: "directed" });

    readonly addDirectedEdgeWithKey: (
      key: string,
      source: string,
      target: string,
      attributes: { readonly color: string; readonly size: number }
    ) => void;
    readonly addNode: (
      key: string,
      attributes: {
        readonly color: string;
        readonly label: string;
        readonly size: number;
        readonly x: number;
        readonly y: number;
      }
    ) => void;
  }
}

declare module "sigma" {
  import type Graph from "graphology";

  export default class Sigma {
    readonly kill?: () => void;
    readonly refresh?: () => void;

    constructor(graph: Graph, container: HTMLElement);
  }
}
