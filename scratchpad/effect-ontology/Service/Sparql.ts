/**
 * Service: SPARQL Execution
 *
 * SPARQL query execution using Oxigraph WASM.
 * Provides type-safe SPARQL execution against RDF stores.
 *
 * @since 2.0.0
 * @module Service/Sparql
 */

import { $ScratchpadId } from "@beep/identity";
import { Context, Data, Effect, Layer } from "effect";
import * as A from "effect/Array";
import * as HashMap from "effect/HashMap";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as oxigraph from "oxigraph";
import { SparqlExecutionError, SparqlLoadError } from "../Domain/Error/Sparql.ts";
import type { RdfStore } from "./Rdf.ts";
import { RdfBuilder } from "./Rdf.ts";

const $I = $ScratchpadId.create("effect-ontology/Service/Sparql");

// -----------------------------------------------------------------------------
// Result Types
// -----------------------------------------------------------------------------

/**
 * A single binding value in SPARQL results
 */
export type SparqlValue =
  | { readonly type: "uri"; readonly value: string }
  | { readonly type: "literal"; readonly value: string; readonly datatype?: string; readonly language?: string }
  | { readonly type: "bnode"; readonly value: string };

/**
 * A single row of bindings from a SELECT query
 */
export type SparqlBindings = HashMap.HashMap<string, SparqlValue>;

/**
 * A quad in SPARQL CONSTRUCT/DESCRIBE results
 *
 * @since 2.0.0
 * @category Results
 */
export interface SparqlQuad {
  readonly subject: string;
  readonly predicate: string;
  readonly object: SparqlValue;
  readonly graph?: string;
}

/**
 * Result of a SELECT query
 *
 * @since 2.0.0
 * @category Results
 */
export class SelectResult extends Data.TaggedClass("SelectResult")<{
  readonly variables: ReadonlyArray<string>;
  readonly bindings: ReadonlyArray<SparqlBindings>;
}> {}

/**
 * Result of an ASK query
 *
 * @since 2.0.0
 * @category Results
 */
export class AskResult extends Data.TaggedClass("AskResult")<{
  readonly value: boolean;
}> {}

/**
 * Result of a CONSTRUCT/DESCRIBE query
 *
 * @since 2.0.0
 * @category Results
 */
export class ConstructResult extends Data.TaggedClass("ConstructResult")<{
  readonly quads: ReadonlyArray<SparqlQuad>;
}> {}

/**
 * Fallback result when SPARQL execution fails but we can still provide data
 *
 * Used in OntologyAgent.query() when SPARQL execution fails but we can
 * fall back to returning all triples from the store.
 *
 * @since 2.0.0
 * @category Results
 */
export class FallbackResult extends Data.TaggedClass("FallbackResult")<{
  readonly quads: ReadonlyArray<SparqlQuad>;
  readonly reason: string;
}> {}

/**
 * Union of all SPARQL query result types
 *
 * @since 2.0.0
 * @category Results
 */
export type SparqlResult = SelectResult | AskResult | ConstructResult | FallbackResult;

// -----------------------------------------------------------------------------
// Internal Helpers
// -----------------------------------------------------------------------------

/**
 * Convert Oxigraph term to SparqlValue
 */
const oxTermToSparqlValue = (term: oxigraph.Term): SparqlValue => {
  if (term.termType === "NamedNode") {
    return { type: "uri", value: term.value };
  } else if (term.termType === "BlankNode") {
    return { type: "bnode", value: term.value };
  } else if (term.termType === "Literal") {
    const lit = term as oxigraph.Literal;
    return {
      type: "literal",
      value: lit.value,
      ...(lit.datatype?.value === undefined ? {} : { datatype: lit.datatype.value }),
      ...(lit.language === "" ? {} : { language: lit.language }),
    };
  }
  // Fallback
  return { type: "literal", value: String(term) };
};

/**
 * Convert Oxigraph quad to our format
 */
const oxQuadToResult = (quad: oxigraph.Quad): SparqlQuad => ({
  subject: quad.subject.value,
  predicate: quad.predicate.value,
  object: oxTermToSparqlValue(quad.object),
  ...(quad.graph.termType === "NamedNode" ? { graph: quad.graph.value } : {}),
});

// -----------------------------------------------------------------------------
// Service Interface
// -----------------------------------------------------------------------------

/**
 * SparqlService - SPARQL query execution
 *
 * Executes SPARQL queries against RDF stores using Oxigraph WASM.
 *
 * @example
 * ```typescript
 * Effect.gen(function*() {
 *   const sparql = yield* SparqlService
 *   const rdf = yield* RdfBuilder
 *
 *   const store = yield* rdf.parseTurtle(turtleData)
 *   const result = yield* sparql.execute(store, `
 *     SELECT ?name WHERE { ?s <http://schema.org/name> ?name }
 *   `)
 *
 *   if (result._tag === "SelectResult") {
 *     for (const binding of result.bindings) {
 *       console.log(HashMap.get(binding, "name"))
 *     }
 *   }
 * })
 * ```
 *
 * @since 2.0.0
 * @category Services
 */
export interface SparqlServiceMethods {
  readonly execute: (
    store: RdfStore,
    query: string
  ) => Effect.Effect<SparqlResult, SparqlExecutionError | SparqlLoadError>;
  readonly executeSelect: (
    store: RdfStore,
    query: string,
    variables: ReadonlyArray<string>
  ) => Effect.Effect<ReadonlyArray<HashMap.HashMap<string, string>>, SparqlExecutionError | SparqlLoadError>;
  readonly executeAsk: (
    store: RdfStore,
    query: string
  ) => Effect.Effect<boolean, SparqlExecutionError | SparqlLoadError>;
}

export class SparqlService extends Context.Service<SparqlService, SparqlServiceMethods>()($I`SparqlService`, {
  make: Effect.gen(function* () {
    const rdfBuilder = yield* RdfBuilder;

    // Core execute function - extracted so it can be referenced from other methods
    const execute = (
      store: RdfStore,
      query: string
    ): Effect.Effect<SparqlResult, SparqlExecutionError | SparqlLoadError> =>
      Effect.gen(function* () {
        // 1. Serialize N3 store to Turtle
        const turtle = yield* rdfBuilder.toTurtle(store).pipe(
          Effect.mapError((e) =>
            SparqlLoadError.make({
              message: `Failed to serialize RDF store: ${e.message}`,
              cause: O.some(e),
              format: O.some("Turtle"),
            })
          )
        );

        // 2. Create Oxigraph store and load data
        const oxStore = new oxigraph.Store();

        yield* Effect.try({
          try: () => {
            oxStore.load(turtle, {
              format: "text/turtle",
              base_iri: "http://example.org/",
            });
          },
          catch: (error) =>
            SparqlLoadError.make({
              message: `Failed to load RDF into Oxigraph: ${error}`,
              cause: O.some(error),
              format: O.some("text/turtle"),
            }),
        });

        // 3. Execute SPARQL query
        const result = yield* Effect.try({
          try: () => oxStore.query(query),
          catch: (error) =>
            SparqlExecutionError.make({
              message: `SPARQL execution failed: ${error}`,
              cause: O.some(error),
              query: O.some(query),
            }),
        });

        // 4. Process result based on query type
        // Oxigraph returns different types based on query:
        // - SELECT: iterable rows of string-to-term entries
        // - ASK: boolean
        // - CONSTRUCT/DESCRIBE: iterable of Quad

        if (typeof result === "boolean") {
          // ASK query
          return new AskResult({ value: result });
        }

        // Check if it's SELECT bindings or CONSTRUCT quads
        const resultArray = Array.from(result as Iterable<unknown>);

        if (resultArray.length === 0) {
          // Empty result - could be SELECT or CONSTRUCT
          // Detect from query type
          const queryType = query.trim().toUpperCase();
          if (queryType.startsWith("SELECT")) {
            // Extract variable names from query
            const varMatch = query.match(/SELECT\s+(.+?)\s+WHERE/i);
            const variables = P.isNotNull(varMatch)
              ? varMatch[1]
                  .split(/\s+/)
                  .filter((v) => v.startsWith("?") || v.startsWith("$"))
                  .map((v) => v.slice(1))
              : [];

            return new SelectResult({ variables, bindings: [] });
          }
          return new ConstructResult({ quads: [] });
        }

        if (query.trim().toUpperCase().startsWith("SELECT")) {
          // SELECT query result
          const bindings = resultArray.map((row) => {
            const entries = row as Iterable<readonly [string, oxigraph.Term]>;
            return HashMap.fromIterable(
              A.map(A.fromIterable(entries), ([key, value]) => [key, oxTermToSparqlValue(value)] as const)
            );
          });

          // Extract variable names from first binding
          const variables =
            bindings.length > 0 ? O.getOrThrow(A.head(bindings)).pipe(HashMap.keys, A.fromIterable) : [];

          return new SelectResult({ variables, bindings });
        }

        // CONSTRUCT/DESCRIBE query result (array of Quads)
        const quads = resultArray.map((q) => oxQuadToResult(q as oxigraph.Quad));

        return new ConstructResult({ quads });
      });

    return {
      /**
       * Execute a SPARQL query against an RDF store
       *
       * Supports SELECT, ASK, CONSTRUCT, and DESCRIBE queries.
       *
       * @param store - RDF store to query
       * @param query - SPARQL query string
       * @returns Query result (type depends on query type)
       */
      execute,

      /**
       * Execute a SELECT query and extract bindings for specific variables
       *
       * Convenience method that extracts just the values for requested variables.
       *
       * @param store - RDF store to query
       * @param query - SPARQL SELECT query
       * @param variables - Variables to extract (without ? prefix)
       * @returns Array of extracted values
       */
      executeSelect: (
        store: RdfStore,
        query: string,
        variables: ReadonlyArray<string>
      ): Effect.Effect<ReadonlyArray<HashMap.HashMap<string, string>>, SparqlExecutionError | SparqlLoadError> =>
        Effect.gen(function* () {
          const result = yield* execute(store, query);

          if (result._tag !== "SelectResult") {
            return yield* SparqlExecutionError.make({
              message: `Expected SELECT query, got ${result._tag}`,
              query: O.some(query),
            });
          }

          return result.bindings.map((binding: SparqlBindings) => {
            let extracted = HashMap.empty<string, string>();
            for (const v of variables) {
              const value = HashMap.get(binding, v);
              if (O.isSome(value)) {
                extracted = HashMap.set(extracted, v, value.value.value);
              }
            }
            return extracted;
          });
        }),

      /**
       * Execute an ASK query
       *
       * @param store - RDF store to query
       * @param query - SPARQL ASK query
       * @returns Boolean result
       */
      executeAsk: (store: RdfStore, query: string): Effect.Effect<boolean, SparqlExecutionError | SparqlLoadError> =>
        Effect.gen(function* () {
          const result = yield* execute(store, query);

          if (result._tag !== "AskResult") {
            return yield* SparqlExecutionError.make({
              message: `Expected ASK query, got ${result._tag}`,
              query: O.some(query),
            });
          }

          return result.value;
        }),
    };
  }),
}) {
  /**
   * Test implementation for testing without Oxigraph
   *
   * Provides mock query results for testing scenarios.
   *
   * @since 2.0.0
   * @category Testing
   */
  static readonly Test = Layer.succeed(SparqlService, {
    execute: Effect.fn("SparqlService.execute")(() => Effect.succeed(new AskResult({ value: true }))),
    executeSelect: Effect.fn("SparqlService.executeSelect")(() => Effect.succeed([])),
    executeAsk: Effect.fn("SparqlService.executeAsk")(() => Effect.succeed(true)),
  });
  static readonly Default = Layer.effect(this, this.make).pipe(Layer.provide([RdfBuilder.Default]));
}
