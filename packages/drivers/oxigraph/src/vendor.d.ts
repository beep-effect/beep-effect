declare module "oxigraph" {
  export type NamedNode = {
    readonly termType: "NamedNode";
    readonly value: string;
  };

  export type BlankNode = {
    readonly termType: "BlankNode";
    readonly value: string;
  };

  export type DefaultGraph = {
    readonly termType: "DefaultGraph";
    readonly value: "";
  };

  export type Literal = {
    readonly termType: "Literal";
    readonly value: string;
    readonly language?: string;
    readonly datatype: NamedNode;
  };

  export type Subject = NamedNode | BlankNode;
  export type Object = NamedNode | BlankNode | Literal;
  export type Graph = NamedNode | BlankNode | DefaultGraph;
  export type Term = Subject | Object | Graph;

  export type Quad = {
    readonly subject: Subject;
    readonly predicate: NamedNode;
    readonly object: Object;
    readonly graph: Graph;
  };

  export type QueryOptions = {
    readonly use_default_graph_as_union?: boolean;
  };

  export class Store {
    constructor(quads?: Iterable<Quad>);
    add(quad: Quad): void;
    query(
      query: string,
      options?: QueryOptions
    ): boolean | ReadonlyArray<ReadonlyMap<string, Term>> | ReadonlyArray<Quad>;
  }
}
