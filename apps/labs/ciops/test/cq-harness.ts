// Shared Oxigraph harness for the CQ-020 and lane-plan SPARQL checks over the committed goldens.
// Only provisional term spellings and the episode binding are adapted in memory; the packet CQ,
// seed, registry and frozen extraction artifacts stay read-only.
import { expect } from "@effect/vitest";
import * as A from "effect/Array";
import * as Effect from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as Str from "effect/String";
import * as Oxigraph from "oxigraph";

export const CIOPS = "https://oip.law/ontology/ci-ops#";
export const PROV = "https://oip.law/ontology/ci-ops-prov#";
export const RDF_TYPE = Oxigraph.namedNode("http://www.w3.org/1999/02/22-rdf-syntax-ns#type");
const XSD_STRING = Oxigraph.namedNode("http://www.w3.org/2001/XMLSchema#string");

const competencyQuestionsPath =
  "../../../explorations/beep-ci-operational-ontology/ontology/docs/competency-questions.yaml";

export type Node = Oxigraph.NamedNode | Oxigraph.BlankNode;

// CQ-020 terms whose ratified ciops: spelling the goldens still emit as provisional ciops-prov:.
const provisionalTerms = [
  "hasCurrentProposal",
  "hasProjectionSpecification",
  "AdmissionProjectionSpecification",
  "hasStep",
  "stepIndex",
  "schedulesSeatRequest",
  "hasScopeTag",
] as const;

export const xsdString = (value: string): Oxigraph.Literal => Oxigraph.literal(value, XSD_STRING);
export const prov = (name: string): Oxigraph.NamedNode => Oxigraph.namedNode(PROV + name);

/** The N-Triples rendering of a term: the comparison key for every term assertion. */
export const render = (term: Oxigraph.Term): string => term.toString();
export const renderAll = A.map(render);

/** The only element of an array; any other length fails the assertion. */
export const only = <T>(items: ReadonlyArray<T>): T => {
  expect(A.length(items), "Expected exactly one element").toBe(1);
  return O.getOrThrow(A.head(items));
};

const isNode = (term: Oxigraph.Term): term is Node => term.termType === "NamedNode" || term.termType === "BlankNode";

/** A subject-position term; any other term fails the assertion. */
export const asNode = (term: Oxigraph.Term): Node => {
  expect(isNode(term), `${render(term)} must be a named or blank node`).toBe(true);
  return isNode(term) ? term : Oxigraph.blankNode();
};

// textwrap.dedent for a block whose lines all carry at least the common indentation.
const dedent = (block: string): string => {
  const lines = Str.split(block, "\n");
  const indent = pipe(
    lines,
    A.filter(Str.isNonEmpty),
    A.map((line) => Str.length(line) - Str.length(Str.trimStart(line))),
    A.reduce(Number.POSITIVE_INFINITY, Math.min)
  );
  return A.join(A.map(lines, Str.slice(indent)), "\n");
};

/** One SELECT solution; reading an unbound column fails the assertion. */
class Solution {
  private readonly row: ReadonlyMap<string, Oxigraph.Term>;

  constructor(row: ReadonlyMap<string, Oxigraph.Term>) {
    this.row = row;
  }

  has(name: string): boolean {
    return this.row.has(name);
  }

  term(name: string): Oxigraph.Term {
    const term = this.row.get(name);
    expect(term, `?${name} must be bound`).toBeDefined();
    return term ?? Oxigraph.defaultGraph();
  }

  node(name: string): Node {
    return asNode(this.term(name));
  }

  integer(name: string): number {
    return Number.parseInt(this.term(name).value, 10);
  }

  value(name: string): string {
    return this.term(name).value;
  }

  render(name: string): string {
    return render(this.term(name));
  }

  /** Every bound column in projection order, rendered: the all-column comparison key. */
  columns(): ReadonlyArray<readonly [string, string]> {
    return A.map(Array.from(this.row.entries()), ([name, term]) => [name, render(term)] as const);
  }
}

/** An in-memory Oxigraph store over the committed goldens. */
export class Graph {
  readonly store: Oxigraph.Store;

  constructor(store: Oxigraph.Store) {
    this.store = store;
  }

  /** Load each golden fixture into one fresh store. */
  static readonly load = Effect.fn("CqHarness.Graph.load")(function* (goldens: ReadonlyArray<string>) {
    const fs = yield* FileSystem.FileSystem;
    const store = new Oxigraph.Store();
    for (const golden of goldens) {
      const turtle = yield* fs.readFileString(`test/fixtures/${golden}`);
      store.load(turtle, { format: "text/turtle" });
    }
    return new Graph(store);
  });

  quads(): ReadonlyArray<Oxigraph.Quad> {
    return this.store.match(null, null, null, null);
  }

  match(
    subject: Node | null,
    predicate: Oxigraph.NamedNode | null,
    object: Oxigraph.Term | null
  ): ReadonlyArray<Oxigraph.Quad> {
    return this.store.match(subject, predicate, object, null);
  }

  /** The solution rows of a SELECT query. */
  select(query: string): ReadonlyArray<Solution> {
    const result = this.store.query(query);
    const rows: ReadonlyArray<unknown> = A.isArray(result) ? result : [];
    const solutions = A.filter(rows, (row): row is Map<string, Oxigraph.Term> => row instanceof Map);
    expect(A.isArray(result) && A.length(solutions) === A.length(rows), "SELECT must return solution rows").toBe(true);
    return A.map(solutions, (row) => new Solution(row));
  }

  objects(subject: Node, predicate: Oxigraph.NamedNode): ReadonlyArray<Oxigraph.Term> {
    return A.map(this.match(subject, predicate, null), (quad) => quad.object);
  }
}

/** CQ-020 as the packet states it, with the provisional terms re-spelled in the ciops-prov: namespace. */
export class Cq020 {
  readonly query: string;

  constructor(query: string) {
    this.query = query;
  }

  /** Read CQ-020's explicit SPARQL block from the read-only competency-question source. */
  static readonly load = Effect.fn("CqHarness.Cq020.load")(function* () {
    const fs = yield* FileSystem.FileSystem;
    const source = yield* fs.readFileString(competencyQuestionsPath);
    const section = pipe(
      A.get(Str.split(source, "- id: CQ-020\n"), 1),
      O.flatMap((tail) => A.head(Str.split(tail, "\n- id:"))),
      O.getOrElse(() => "")
    );
    const sparqlBlock = /^ {2}sparql: \|\n((?: {4}.*\n)+)/m.exec(section);
    expect(sparqlBlock, "CQ-020 must retain its explicit SPARQL block").not.toBeNull();
    const query = A.reduce(provisionalTerms, dedent(sparqlBlock?.[1] ?? ""), (text, term) =>
      Str.replace(new RegExp(`\\bciops:${term}\\b`, "g"), `ciops-prov:${term}`)(text)
    );
    return new Cq020(`PREFIX ciops-prov: <${PROV}>\n${query}`);
  });
}

/** The typed subjects of `type` in a graph. */
export const subjectsOf: {
  (type: Oxigraph.NamedNode): (graph: Graph) => ReadonlyArray<Node>;
  (graph: Graph, type: Oxigraph.NamedNode): ReadonlyArray<Node>;
} = dual(
  2,
  (graph: Graph, type: Oxigraph.NamedNode): ReadonlyArray<Node> =>
    A.filter(
      A.map(graph.match(null, RDF_TYPE, type), (quad) => quad.subject),
      isNode
    )
);

const EPISODE_VALUES = /VALUES \?ep \{[^}]*\}/g;

/** Bind exactly the CQ's `?ep` parameter to one episode node. */
export const bindEpisode: {
  (episode: Node): (cq020: Cq020) => string;
  (cq020: Cq020, episode: Node): string;
} = dual(2, (cq020: Cq020, episode: Node): string => {
  const bindings = pipe(
    Str.match(EPISODE_VALUES)(cq020.query),
    O.map(A.length),
    O.getOrElse(() => 0)
  );
  expect(bindings, "Bind exactly the CQ's episode parameter").toBe(1);
  return Str.replace(EPISODE_VALUES, `VALUES ?ep { ${render(episode)} }`)(cq020.query);
});

/** A copy of every quad in a graph, plus extra quads. */
export const copyGraph: {
  (extra: ReadonlyArray<Oxigraph.Quad>): (graph: Graph) => Graph;
  (graph: Graph, extra: ReadonlyArray<Oxigraph.Quad>): Graph;
} = dual(2, (graph: Graph, extra: ReadonlyArray<Oxigraph.Quad>): Graph => {
  const probe = new Oxigraph.Store(graph.quads());
  A.forEach(extra, (quad) => probe.add(quad));
  return new Graph(probe);
});
