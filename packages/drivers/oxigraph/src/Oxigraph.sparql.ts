/**
 * Oxigraph-backed SPARQL service implementation.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
/// <reference path="./vendor.d.ts" />

import * as Rdf from "@beep/rdf/Rdf";
import {
  SparqlAskResult,
  SparqlConstructResult,
  SparqlQueryError,
  SparqlQueryService,
  SparqlSelectResult,
} from "@beep/semantic-web/services/sparql-query";
import { A, O, P, R } from "@beep/utils";
import { Effect, Layer, Match, MutableHashMap, pipe } from "effect";
import * as Str from "effect/String";
import { OxigraphSparqlError } from "./Oxigraph.errors.ts";
import type { SparqlQueryRequest, SparqlQueryResult } from "@beep/semantic-web/services/sparql-query";
import type * as Oxigraph from "oxigraph";

type OxigraphModule = {
  readonly Store: typeof Oxigraph.Store;
};

const unknownMessage = (cause: unknown, fallback: string): string =>
  P.hasProperty(cause, "message") && P.isString(cause.message) ? cause.message : fallback;

const driverError =
  (reason: OxigraphSparqlError["reason"], fallback: string) =>
  (cause: unknown): OxigraphSparqlError =>
    OxigraphSparqlError.make({
      reason,
      message: unknownMessage(cause, fallback),
    });

const semanticError = (error: OxigraphSparqlError): SparqlQueryError =>
  SparqlQueryError.make({
    reason: error.reason === "unsupportedResult" ? "unsupportedProfile" : "unimplemented",
    message: error.message,
  });

const adapterInvariant = (message: string): OxigraphSparqlError =>
  OxigraphSparqlError.make({
    reason: "adapterInvariant",
    message,
  });

const unsupportedResult = (message: string): OxigraphSparqlError =>
  OxigraphSparqlError.make({
    reason: "unsupportedResult",
    message,
  });

const isOxigraphModule = (value: unknown): value is OxigraphModule =>
  P.isObject(value) && P.hasProperty(value, "Store") && P.isFunction(value.Store);

const loadOxigraphModule = Effect.tryPromise({
  try: () => import("oxigraph"),
  catch: driverError("importFailed", "Failed to import oxigraph WASM package."),
}).pipe(
  Effect.filterOrFail(
    (module) => isOxigraphModule(module),
    () => adapterInvariant("Invalid oxigraph module.")
  )
);

const oxigraphNamedNode = (value: string): Oxigraph.NamedNode => ({
  termType: "NamedNode",
  value,
});

const oxigraphBlankNode = (value: string): Oxigraph.BlankNode => ({
  termType: "BlankNode",
  value,
});

const oxigraphDefaultGraph = (): Oxigraph.DefaultGraph => ({
  termType: "DefaultGraph",
  value: "",
});

const toOxigraphSubject = (subject: Rdf.Subject): Oxigraph.Subject =>
  Rdf.Subject.match(subject, {
    NamedNode: (value) => oxigraphNamedNode(value.value),
    BlankNode: (value) => oxigraphBlankNode(value.value),
  });

const toOxigraphLiteral = (value: Rdf.Literal): Oxigraph.Literal => {
  const literal: Oxigraph.Literal = {
    termType: "Literal",
    value: value.value,
    datatype: oxigraphNamedNode(value.datatype.value),
  };
  return pipe(
    value.language,
    O.match({
      onNone: () => literal,
      onSome: (language) => ({
        ...literal,
        language,
      }),
    })
  );
};

const toOxigraphObject = (object: Rdf.ObjectTerm): Oxigraph.Object =>
  Rdf.ObjectTerm.match(object, {
    NamedNode: (value) => oxigraphNamedNode(value.value),
    BlankNode: (value) => oxigraphBlankNode(value.value),
    Literal: toOxigraphLiteral,
  });

const toOxigraphGraph = (graph: Rdf.GraphTerm): Oxigraph.Graph =>
  Rdf.GraphTerm.match(graph, {
    DefaultGraph: oxigraphDefaultGraph,
    NamedNode: (value) => oxigraphNamedNode(value.value),
    BlankNode: (value) => oxigraphBlankNode(value.value),
  });

const toOxigraphQuad = (quad: Rdf.Quad): Oxigraph.Quad => ({
  subject: toOxigraphSubject(quad.subject),
  predicate: oxigraphNamedNode(quad.predicate.value),
  object: toOxigraphObject(quad.object),
  graph: toOxigraphGraph(quad.graph),
});

const fromOxigraphSubject = (subject: Oxigraph.Subject): Rdf.Subject =>
  Match.value(subject).pipe(
    Match.discriminatorsExhaustive("termType")({
      NamedNode: (value) => Rdf.makeNamedNode(value.value),
      BlankNode: (value) => Rdf.makeBlankNode(value.value),
    })
  );

const fromOxigraphObject = (object: Oxigraph.Object): Rdf.ObjectTerm =>
  Match.value(object).pipe(
    Match.discriminatorsExhaustive("termType")({
      NamedNode: (value) => Rdf.makeNamedNode(value.value),
      BlankNode: (value) => Rdf.makeBlankNode(value.value),
      Literal: (value) =>
        Rdf.makeLiteral(value.value, value.datatype.value, {
          ...O.getSomesStruct({
            language: pipe(value.language, O.fromUndefinedOr, O.filter(Str.isNonEmpty)),
          }),
        }),
    })
  );

const fromOxigraphGraph = (graph: Oxigraph.Graph): Rdf.GraphTerm =>
  Match.value(graph).pipe(
    Match.discriminatorsExhaustive("termType")({
      NamedNode: (value) => Rdf.makeNamedNode(value.value),
      BlankNode: (value) => Rdf.makeBlankNode(value.value),
      DefaultGraph: () => Rdf.DefaultGraph.make({ termType: "DefaultGraph", value: "" }),
    })
  );

const fromOxigraphTerm = (term: Oxigraph.Term): Rdf.Term =>
  Match.value(term).pipe(
    Match.discriminatorsExhaustive("termType")({
      NamedNode: (value) => Rdf.makeNamedNode(value.value),
      BlankNode: (value) => Rdf.makeBlankNode(value.value),
      Literal: fromOxigraphObject,
      DefaultGraph: () => Rdf.DefaultGraph.make({ termType: "DefaultGraph", value: "" }),
    })
  );

const fromOxigraphQuad = (quad: Oxigraph.Quad): Rdf.Quad =>
  Rdf.makeQuad(fromOxigraphSubject(quad.subject), Rdf.makeNamedNode(quad.predicate.value), {
    object: fromOxigraphObject(quad.object),
    graph: fromOxigraphGraph(quad.graph),
  });

const makeStore = Effect.fn("Oxigraph.makeStore")(function* (
  request: SparqlQueryRequest,
  stores: MutableHashMap.MutableHashMap<Rdf.Dataset, Oxigraph.Store>
) {
  const cached = MutableHashMap.get(stores, request.dataset);
  if (O.isSome(cached)) {
    return cached.value;
  }
  const module = yield* loadOxigraphModule;
  const store = yield* Effect.try({
    try: () => new module.Store(),
    catch: driverError("adapterInvariant", "Failed to construct Oxigraph store."),
  });

  yield* Effect.forEach(
    request.dataset.quads,
    (quad) =>
      Effect.try({
        try: () => store.add(toOxigraphQuad(quad)),
        catch: driverError("datasetLoadFailed", "Failed to load a quad into Oxigraph."),
      }),
    { discard: true }
  );

  MutableHashMap.clear(stores);
  MutableHashMap.set(stores, request.dataset, store);
  return store;
});

const executeRawQuery = Effect.fn("Oxigraph.executeRawQuery")(function* (
  store: Oxigraph.Store,
  request: SparqlQueryRequest
) {
  return yield* Effect.try({
    try: () =>
      store.query(request.query, {
        use_default_graph_as_union: true,
      }),
    catch: driverError("queryFailed", "Oxigraph failed to execute the SPARQL query."),
  });
});

const selectResult = (result: unknown): Effect.Effect<SparqlSelectResult, OxigraphSparqlError> => {
  if (!A.isArray(result)) {
    return Effect.fail(unsupportedResult("Oxigraph did not return SELECT bindings."));
  }

  const rows = A.map(result, (binding) => {
    if (!(binding instanceof Map)) {
      return O.none<Record<string, Rdf.Term>>();
    }
    return O.some(
      R.fromEntries(
        pipe(
          A.fromIterable(binding.entries()),
          A.map(([key, value]) => [key, fromOxigraphTerm(value)] as const)
        )
      )
    );
  });

  return pipe(
    rows,
    O.all,
    O.match({
      onNone: () => Effect.fail(unsupportedResult("Oxigraph returned an invalid SELECT binding row.")),
      onSome: (validRows) => Effect.succeed(SparqlSelectResult.make({ profile: "select", rows: validRows })),
    })
  );
};

const constructResult = (result: unknown): Effect.Effect<SparqlConstructResult, OxigraphSparqlError> =>
  A.isArray(result)
    ? Effect.succeed(
        SparqlConstructResult.make({
          profile: "construct",
          dataset: Rdf.makeDataset(A.map(result, (quad) => fromOxigraphQuad(quad as Oxigraph.Quad))),
        })
      )
    : Effect.fail(unsupportedResult("Oxigraph did not return CONSTRUCT quads."));

const askResult = (result: unknown): Effect.Effect<SparqlAskResult, OxigraphSparqlError> =>
  P.isBoolean(result)
    ? Effect.succeed(SparqlAskResult.make({ profile: "ask", value: result }))
    : Effect.fail(unsupportedResult("Oxigraph did not return an ASK boolean."));

const executeSparql = Effect.fn("Oxigraph.executeSparql")(function* (
  request: SparqlQueryRequest,
  stores: MutableHashMap.MutableHashMap<Rdf.Dataset, Oxigraph.Store>
) {
  const store = yield* makeStore(request, stores);
  const result = yield* executeRawQuery(store, request);

  return yield* Match.value(request.profile).pipe(
    Match.withReturnType<Effect.Effect<SparqlQueryResult, OxigraphSparqlError>>(),
    Match.when("select", () => selectResult(result)),
    Match.when("construct", () => constructResult(result)),
    Match.when("ask", () => askResult(result)),
    Match.exhaustive
  );
});

/**
 * Live SPARQL service Layer backed by Oxigraph WASM.
 *
 * **Details**
 *
 * The `oxigraph` package is imported lazily during query execution so this
 * Layer can be imported by browser and worker bundles without initializing
 * WebAssembly at module scope. Each Layer acquisition retains the latest
 * loaded immutable dataset instance so repeated queries do not rebuild the
 * complete store and a long-lived service does not accumulate prior stores.
 *
 * **Example** (Import the live layer)
 *
 * ```ts
 * import { OxigraphSparqlQueryServiceLive } from "@beep/oxigraph"
 *
 * console.log(OxigraphSparqlQueryServiceLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const OxigraphSparqlQueryServiceLive = Layer.effect(
  SparqlQueryService,
  Effect.sync(() => {
    const stores = MutableHashMap.empty<Rdf.Dataset, Oxigraph.Store>();
    return SparqlQueryService.of({
      execute: Effect.fn("SparqlQueryService.execute")((request) =>
        executeSparql(request, stores).pipe(Effect.mapError(semanticError))
      ),
    });
  })
);
