declare module "rdf-canonize" {
  export type CanonizeNamedNode = {
    readonly termType: "NamedNode";
    readonly value: string;
  };

  export type CanonizeBlankNode = {
    readonly termType: "BlankNode";
    readonly value: string;
  };

  export type CanonizeDefaultGraph = {
    readonly termType: "DefaultGraph";
    readonly value: "";
  };

  export type CanonizeLiteral = {
    readonly termType: "Literal";
    readonly value: string;
    readonly datatype: CanonizeNamedNode;
    readonly language?: string;
  };

  export type CanonizeSubject = CanonizeNamedNode | CanonizeBlankNode;
  export type CanonizeObject = CanonizeNamedNode | CanonizeBlankNode | CanonizeLiteral;
  export type CanonizeGraph = CanonizeNamedNode | CanonizeBlankNode | CanonizeDefaultGraph;

  export type CanonizeQuad = {
    readonly subject: CanonizeSubject;
    readonly predicate: CanonizeNamedNode;
    readonly object: CanonizeObject;
    readonly graph: CanonizeGraph;
  };

  export const NQuads: {
    parse(input: string): Array<CanonizeQuad>;
    serialize(dataset: ReadonlyArray<CanonizeQuad>): string;
    serializeQuad(quad: CanonizeQuad): string;
  };

  export function canonize(
    input: ReadonlyArray<CanonizeQuad> | string,
    options: {
      readonly algorithm: "RDFC-1.0" | "URDNA2015";
      readonly inputFormat?: "application/n-quads";
      readonly format?: "application/n-quads";
      readonly maxWorkFactor?: number;
      readonly maxDeepIterations?: number;
      readonly rejectURDNA2015?: boolean;
      readonly signal?: AbortSignal;
    }
  ): Promise<string>;
}
