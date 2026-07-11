declare module "@rdfjs/data-model" {
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

  export type Variable = {
    readonly termType: "Variable";
    readonly value: string;
  };

  export type Subject = NamedNode | BlankNode;
  export type Object = NamedNode | BlankNode | Literal;
  export type Graph = NamedNode | BlankNode | DefaultGraph;
  export type Term = Subject | Object | Graph | Variable;

  export type Quad = {
    readonly subject: Subject;
    readonly predicate: NamedNode;
    readonly object: Object;
    readonly graph: Graph;
  };

  export type DataFactory = {
    readonly namedNode: (value: string) => NamedNode;
    readonly blankNode: (value: string) => BlankNode;
    readonly defaultGraph: () => DefaultGraph;
    readonly literal: (value: string, languageOrDatatype?: string | NamedNode) => Literal;
    readonly quad: (subject: Subject, predicate: NamedNode, object: Object, graph?: Graph) => Quad;
    readonly variable: (value: string) => Variable;
  };

  const factory: DataFactory;
  export default factory;
}

declare module "@rdfjs/dataset" {
  import type { Quad } from "@rdfjs/data-model";

  export type DatasetCore = {
    readonly add: (quad: Quad) => DatasetCore;
    readonly [Symbol.iterator]: () => IterableIterator<Quad>;
  };

  export type DatasetFactory = {
    readonly dataset: (quads?: Iterable<Quad>) => DatasetCore;
  };

  const factory: DatasetFactory;
  export default factory;
}

declare module "shacl-engine" {
  import type { DataFactory } from "@rdfjs/data-model";
  import type { DatasetCore, DatasetFactory } from "@rdfjs/dataset";

  export type ShaclEngineFactory = DataFactory & DatasetFactory;

  export class Validator {
    constructor(
      shapes: DatasetCore,
      options: { readonly factory: ShaclEngineFactory; readonly targetResolvers: unknown }
    );
    validate(input: { readonly dataset: DatasetCore }): Promise<unknown>;
  }
}

declare module "shacl-engine/sparql.js" {
  export const targetResolvers: unknown;
}
