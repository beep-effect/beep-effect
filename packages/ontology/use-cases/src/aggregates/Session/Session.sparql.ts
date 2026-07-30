/**
 * SPARQL query use cases and safeguards for ontology sessions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $OntologyUseCasesId } from "@beep/identity/packages";
import { deriveSessionGraphPartitions, graphPartitionIri, Session } from "@beep/ontology-domain/aggregates/Session";
import { makeDataset, makeNamedNode, makeQuad } from "@beep/rdf/Rdf";
import { LiteralKit, NonNegativeInt, SchemaUtils, TaggedErrorClass } from "@beep/schema";
import {
  SparqlConstructResult,
  SparqlQueryRequest,
  SparqlQueryResult,
  SparqlQueryService,
  SparqlSelectResult,
} from "@beep/semantic-web/services/sparql-query";
import { A, O, R, Str } from "@beep/utils";
import { Context, Effect, Layer, Match, Order, pipe } from "effect";
import * as S from "effect/Schema";
import { inferredSessionGraphPartitions, OntologyInferenceResult } from "./Session.reasoner.ts";
import type { GraphPartition } from "@beep/ontology-domain/aggregates/Session";
import type { Dataset, PrefixMap, Quad } from "@beep/rdf/Rdf";
import type { SparqlQueryError } from "@beep/semantic-web/services/sparql-query";

const $I = $OntologyUseCasesId.create("aggregates/Session/Session.sparql");

/**
 * SPARQL query profiles exposed by the ontology workbench panel.
 *
 * @example
 * ```ts
 * import { OntologySparqlPanelProfile } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const profile: OntologySparqlPanelProfile = "select"
 *
 * console.log(profile)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const OntologySparqlPanelProfile = LiteralKit(["select", "construct", "ask"]).pipe(
  $I.annoteSchema("OntologySparqlPanelProfile", {
    description: "SPARQL query profiles exposed by the ontology workbench panel.",
  })
);

/**
 * Type for {@link OntologySparqlPanelProfile}.
 *
 * @example
 * ```ts
 * import { OntologySparqlPanelProfile } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const profile: OntologySparqlPanelProfile = "construct"
 *
 * console.log(profile)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export type OntologySparqlPanelProfile = typeof OntologySparqlPanelProfile.Type;

/**
 * SPARQL query safeguard envelope.
 *
 * @example
 * ```ts
 * import { OntologySparqlSafeguards } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const safeguards = OntologySparqlSafeguards.make({})
 *
 * console.log(safeguards.defaultLimit)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export class OntologySparqlSafeguards extends S.Class<OntologySparqlSafeguards>($I`OntologySparqlSafeguards`)(
  {
    defaultLimit: NonNegativeInt.pipe(
      S.withConstructorDefault(Effect.succeed(100)),
      S.withDecodingDefaultKey(Effect.succeed(100))
    ),
    maxResultCount: NonNegativeInt.pipe(
      S.withConstructorDefault(Effect.succeed(200)),
      S.withDecodingDefaultKey(Effect.succeed(200))
    ),
  },
  $I.annote("OntologySparqlSafeguards", {
    description: "SPARQL query safeguard envelope.",
  })
) {}

/**
 * SPARQL panel example query.
 *
 * @example
 * ```ts
 * import { OntologySparqlExample } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const example = OntologySparqlExample.make({
 *   id: "all-triples",
 *   label: "All triples",
 *   profile: "select",
 *   query: "SELECT ?s ?p ?o WHERE { ?s ?p ?o }"
 * })
 *
 * console.log(example.profile)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export class OntologySparqlExample extends S.Class<OntologySparqlExample>($I`OntologySparqlExample`)(
  {
    id: S.NonEmptyString,
    label: S.NonEmptyString,
    profile: OntologySparqlPanelProfile,
    query: S.NonEmptyString,
  },
  $I.annote("OntologySparqlExample", {
    description: "SPARQL panel example query.",
  })
) {}

/**
 * SPARQL execution input for an ontology session.
 *
 * @example
 * ```ts
 * import { CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { RunOntologySparqlInput } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import * as S from "effect/Schema"
 *
 * const input = RunOntologySparqlInput.make({
 *   session: createSession(
 *     CreateSessionInput.make({
 *       id: S.decodeUnknownSync(SessionId)("session-1"),
 *       baseDataset: makeDataset([])
 *     })
 *   ),
 *   profile: "select",
 *   query: "SELECT ?s ?p ?o WHERE { ?s ?p ?o }"
 * })
 *
 * console.log(input.profile)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export class RunOntologySparqlInput extends S.Class<RunOntologySparqlInput>($I`RunOntologySparqlInput`)(
  {
    session: Session,
    profile: OntologySparqlPanelProfile,
    query: S.NonEmptyString,
    includeInferred: S.Boolean.pipe(
      S.withConstructorDefault(Effect.succeed(false)),
      S.withDecodingDefaultKey(Effect.succeed(false))
    ),
    inference: S.OptionFromOptionalKey(OntologyInferenceResult).pipe(SchemaUtils.withNoneDefault),
    safeguards: OntologySparqlSafeguards.pipe(
      S.withConstructorDefault(Effect.succeed(OntologySparqlSafeguards.make({}))),
      S.withDecodingDefaultKey(Effect.succeed(OntologySparqlSafeguards.make({})))
    ),
  },
  $I.annote("RunOntologySparqlInput", {
    description: "SPARQL execution input for an ontology session.",
  })
) {}

/**
 * SPARQL execution result with applied safeguards.
 *
 * @example
 * ```ts
 * import { RunOntologySparqlResult } from "@beep/ontology-use-cases/aggregates/Session"
 * import { NonNegativeInt } from "@beep/schema"
 * import { SparqlSelectResult } from "@beep/semantic-web/services/sparql-query"
 *
 * const result = RunOntologySparqlResult.make({
 *   profile: "select",
 *   submittedQuery: "SELECT ?s WHERE { ?s ?p ?o }",
 *   normalizedQuery: "SELECT ?s WHERE { ?s ?p ?o } LIMIT 100",
 *   effectiveLimit: NonNegativeInt.make(100),
 *   limitInjected: true,
 *   truncated: false,
 *   rawResultCount: 0,
 *   displayedResultCount: 0,
 *   result: SparqlSelectResult.make({ profile: "select", rows: [] })
 * })
 *
 * console.log(result.limitInjected)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export class RunOntologySparqlResult extends S.Class<RunOntologySparqlResult>($I`RunOntologySparqlResult`)(
  {
    profile: OntologySparqlPanelProfile,
    submittedQuery: S.String,
    normalizedQuery: S.String,
    effectiveLimit: NonNegativeInt,
    limitInjected: S.Boolean,
    truncated: S.Boolean,
    rawResultCount: S.Int,
    displayedResultCount: S.Int,
    result: SparqlQueryResult,
  },
  $I.annote("RunOntologySparqlResult", {
    description: "SPARQL execution result with applied safeguards.",
  })
) {}

/**
 * SPARQL safeguard validation failure.
 *
 * @example
 * ```ts
 * import { OntologySparqlError } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const error = OntologySparqlError.make({
 *   reason: "profileMismatch",
 *   message: "The query profile did not match the editor mode."
 * })
 *
 * console.log(error.reason)
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class OntologySparqlError extends TaggedErrorClass<OntologySparqlError>($I`OntologySparqlError`)(
  "OntologySparqlError",
  {
    reason: LiteralKit(["profileMismatch", "engineFailed"]).pipe(
      $I.annoteSchema("OntologySparqlErrorReason", {
        description: "SPARQL safeguard validation failure reason.",
      })
    ),
    message: S.String,
  },
  $I.annote("OntologySparqlError", {
    description: "SPARQL safeguard validation failure.",
  })
) {}

/**
 * SPARQL runner service shape.
 *
 * @example
 * ```ts
 * import type { OntologySparqlRunnerShape } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const acceptRunner = (value: OntologySparqlRunnerShape) => value
 *
 * console.log(acceptRunner)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export interface OntologySparqlRunnerShape {
  readonly run: (input: RunOntologySparqlInput) => Effect.Effect<RunOntologySparqlResult, OntologySparqlError>;
}

const QUERY_EXAMPLES: ReadonlyArray<OntologySparqlExample> = [
  OntologySparqlExample.make({
    id: "all-triples",
    label: "All triples",
    profile: "select",
    query: "SELECT ?s ?p ?o WHERE {\n  ?s ?p ?o\n}",
  }),
  OntologySparqlExample.make({
    id: "classes",
    label: "Classes",
    profile: "select",
    query: "SELECT ?class WHERE {\n  ?class a owl:Class\n}",
  }),
  OntologySparqlExample.make({
    id: "construct-hierarchy",
    label: "Hierarchy graph",
    profile: "construct",
    query: "CONSTRUCT {\n  ?child rdfs:subClassOf ?parent\n} WHERE {\n  ?child rdfs:subClassOf ?parent\n}",
  }),
];

/**
 * Built-in SPARQL query examples for the panel library.
 *
 * @example
 * ```ts
 * import { ontologySparqlExamples } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * const examples = ontologySparqlExamples()
 *
 * console.log(examples.length)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const ontologySparqlExamples = (): ReadonlyArray<OntologySparqlExample> => QUERY_EXAMPLES;

const prefixLines = (prefixes: PrefixMap, query: string): ReadonlyArray<string> => {
  const upperQuery = Str.toUpperCase(query);
  return pipe(
    R.toEntries(prefixes),
    A.sortWith(([prefix]) => prefix, Order.String),
    A.filter(([prefix]) => !pipe(upperQuery, Str.includes(`PREFIX ${Str.toUpperCase(prefix)}:`))),
    A.map(([prefix, namespace]) => `PREFIX ${prefix}: <${namespace}>`)
  );
};

/**
 * Builds a prefix prelude from the session prefix map.
 *
 * @example
 * ```ts
 * import { ontologySparqlPrefixPrelude } from "@beep/ontology-use-cases/aggregates/Session"
 * import { PrefixMap } from "@beep/rdf/Rdf"
 * import * as S from "effect/Schema"
 *
 * const prefixes = S.decodeUnknownSync(PrefixMap)({ ex: "https://example.test/" })
 * const prelude = ontologySparqlPrefixPrelude(prefixes)
 *
 * console.log(prelude)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const ontologySparqlPrefixPrelude = (prefixes: PrefixMap): string =>
  A.join("\n")(A.fromIterable(prefixLines(prefixes, "")));

/**
 * Default prefix-aware SPARQL query for a session.
 *
 * @example
 * ```ts
 * import { CreateSessionInput, createSession, SessionId } from "@beep/ontology-domain/aggregates/Session"
 * import { defaultOntologySparqlQuery } from "@beep/ontology-use-cases/aggregates/Session"
 * import { makeDataset } from "@beep/rdf/Rdf"
 * import * as S from "effect/Schema"
 *
 * const query = defaultOntologySparqlQuery(
 *   createSession(
 *     CreateSessionInput.make({
 *       id: S.decodeUnknownSync(SessionId)("session-1"),
 *       baseDataset: makeDataset([])
 *     })
 *   )
 * )
 *
 * console.log(query)
 * ```
 *
 * @category queries
 * @since 0.0.0
 */
export const defaultOntologySparqlQuery = (session: Session): string => {
  const prelude = ontologySparqlPrefixPrelude(session.prefixes);
  const query = "SELECT ?s ?p ?o WHERE {\n  ?s ?p ?o\n}";
  return Str.isEmpty(prelude) ? query : `${prelude}\n\n${query}`;
};

const normalizePrefixes = (input: RunOntologySparqlInput): string => {
  const lines = prefixLines(input.session.prefixes, input.query);
  return A.isReadonlyArrayEmpty(lines) ? input.query : `${A.join("\n")(A.fromIterable(lines))}\n${input.query}`;
};

const queryWithoutPrefixLines = (query: string): string =>
  pipe(
    Str.split(query, "\n"),
    A.map(Str.trim),
    A.filter((line) => !Str.startsWith(Str.toUpperCase(line), "PREFIX ")),
    A.filter((line) => !Str.startsWith(line, "#")),
    A.filter(Str.isNonEmpty),
    A.join("\n")
  );

const validateProfile = (
  profile: OntologySparqlPanelProfile,
  query: string
): Effect.Effect<void, OntologySparqlError> => {
  const body = pipe(queryWithoutPrefixLines(query), Str.toUpperCase);
  const ok = OntologySparqlPanelProfile.$match(profile, {
    select: () => Str.startsWith(body, "SELECT"),
    construct: () => Str.startsWith(body, "CONSTRUCT"),
    ask: () => Str.startsWith(body, "ASK"),
  });
  return ok
    ? Effect.void
    : Effect.fail(
        OntologySparqlError.make({
          reason: "profileMismatch",
          message: `Expected a ${Str.toUpperCase(profile)} query for the selected SPARQL profile.`,
        })
      );
};

// Whether the query already bounds its own solutions with a top-level `LIMIT`.
//
// This is a safety guard, not a formatter: if it wrongly reports `true` the
// engine materializes an unbounded result set before `truncateResult` ever runs,
// which can exhaust the sidecar. A raw regex over the query text reported `true`
// for a `LIMIT` that appears in a comment (`# LIMIT 1`) or inside a subquery —
// neither of which bounds anything — so the scan below tracks lexical state:
// `#` comments run to end-of-line, `'…'`/`"…"` (incl. triple-quoted) literals and
// `<…>` IRIs are opaque, and only a `LIMIT` keyword at brace depth 0 counts.
// The branches are the lexical scanner's explicit states. Keeping one forward
// pass avoids either a false positive that permits an unbounded query or a
// multi-pass parser whose cost grows with the input.
// fallow-ignore-next-line complexity -- lexical scan distinguishes top-level LIMIT from comments, literals, and subqueries
const topLevelLimit = (query: string): O.Option<number> => {
  let depth = 0;
  let index = 0;

  const startsWithAt = (token: string, at: number): boolean =>
    pipe(query, Str.slice(at, at + Str.length(token)), Str.toUpperCase) === token;

  const skipUntil = (terminator: string, from: number): number => {
    let cursor = from;
    while (cursor < query.length) {
      if (query[cursor] === "\\") {
        cursor += 2;
        continue;
      }
      if (query.startsWith(terminator, cursor)) {
        return cursor + terminator.length;
      }
      cursor += 1;
    }
    return query.length;
  };

  while (index < query.length) {
    const character = query[index];

    if (character === "#") {
      index = skipUntil("\n", index + 1);
      continue;
    }
    if (query.startsWith('"""', index) || query.startsWith("'''", index)) {
      const quote = query.slice(index, index + 3);
      index = skipUntil(quote, index + 3);
      continue;
    }
    if (character === '"' || character === "'") {
      index = skipUntil(character, index + 1);
      continue;
    }
    if (character === "<") {
      index = skipUntil(">", index + 1);
      continue;
    }
    if (character === "{") {
      depth += 1;
      index += 1;
      continue;
    }
    if (character === "}") {
      depth -= 1;
      index += 1;
      continue;
    }
    // A keyword only counts when it stands alone (not `?limit`, not `xLIMIT`).
    if (depth === 0 && startsWithAt("LIMIT", index)) {
      const before = index === 0 ? " " : (query[index - 1] ?? " ");
      const after = query[index + 5] ?? " ";
      if (/[\s(){}]/.test(before) && /\s/.test(after)) {
        // The value matters, not just the keyword. Reporting only *whether* a bound
        // existed is what let the panel announce `LIMIT 100` over a query that had
        // asked for `LIMIT 2` and been given exactly two rows: the badge named a bound
        // that was never applied. A `LIMIT` with no number is not a bound the engine
        // will honour, so it is treated as absent and the safeguard still injects one.
        const digits = /^\s+(\d+)/.exec(query.slice(index + 5));
        if (digits !== null && digits[1] !== undefined) {
          return O.some(Number(digits[1]));
        }
      }
    }
    index += 1;
  }

  return O.none();
};

const queryHasLimit = (query: string): boolean => O.isSome(topLevelLimit(query));

const injectLimit = (query: string, limit: number): { readonly query: string; readonly injected: boolean } =>
  queryHasLimit(query)
    ? { query, injected: false }
    : {
        query: `${query}\nLIMIT ${limit}`,
        injected: true,
      };

const partitionDataset = (partition: GraphPartition, quads: ReadonlyArray<Quad>): ReadonlyArray<Quad> => {
  const graph = makeNamedNode(graphPartitionIri(partition));
  return A.map(quads, (quad) =>
    makeQuad(quad.subject, quad.predicate, {
      object: quad.object,
      graph,
    })
  );
};

const sparqlDataset = (input: RunOntologySparqlInput): Dataset => {
  const partitions =
    input.includeInferred && O.isSome(input.inference)
      ? inferredSessionGraphPartitions(input.session, input.inference.value)
      : deriveSessionGraphPartitions(input.session);
  const quads = pipe(
    partitionDataset("asserted", partitions.asserted.quads),
    A.appendAll(partitionDataset("ontologies", partitions.ontologies.quads)),
    A.appendAll(input.includeInferred ? partitionDataset("inferred", partitions.inferred.quads) : [])
  );
  return makeDataset(quads);
};

const truncateResult = (
  profile: OntologySparqlPanelProfile,
  result: SparqlQueryResult,
  maxResultCount: number
): {
  readonly result: SparqlQueryResult;
  readonly rawResultCount: number;
  readonly displayedResultCount: number;
  readonly truncated: boolean;
} =>
  Match.value(profile).pipe(
    Match.withReturnType<{
      readonly result: SparqlQueryResult;
      readonly rawResultCount: number;
      readonly displayedResultCount: number;
      readonly truncated: boolean;
    }>(),
    Match.when("select", () => {
      const select = result as SparqlSelectResult;
      const rows = A.take(select.rows, maxResultCount);
      return {
        result: SparqlSelectResult.make({ profile: "select", rows }),
        rawResultCount: select.rows.length,
        displayedResultCount: rows.length,
        truncated: select.rows.length > rows.length,
      };
    }),
    Match.when("construct", () => {
      const construct = result as SparqlConstructResult;
      const quads = A.take(construct.dataset.quads, maxResultCount);
      return {
        result: SparqlConstructResult.make({ profile: "construct", dataset: makeDataset(quads) }),
        rawResultCount: construct.dataset.quads.length,
        displayedResultCount: quads.length,
        truncated: construct.dataset.quads.length > quads.length,
      };
    }),
    // An ASK answers with a single boolean. There is nothing to take the first N of,
    // and nothing that can be cut off.
    Match.when("ask", () => ({
      result,
      rawResultCount: 1,
      displayedResultCount: 1,
      truncated: false,
    })),
    Match.exhaustive
  );

const mapSparqlEngineError = (error: SparqlQueryError): OntologySparqlError =>
  OntologySparqlError.make({
    reason: "engineFailed",
    message: error.message,
  });

const runOntologySparql = Effect.fn("Ontology.Sparql.run")(function* (input: RunOntologySparqlInput) {
  const service = yield* SparqlQueryService;
  const normalized = normalizePrefixes(input);
  yield* validateProfile(input.profile, normalized);
  // An ASK returns one boolean; bounding it is meaningless, and appending a LIMIT to
  // someone's query so a badge can describe it would be worse than meaningless.
  const limited =
    input.profile === "ask"
      ? { query: normalized, injected: false }
      : injectLimit(normalized, input.safeguards.defaultLimit);
  const result = yield* service
    .execute(
      SparqlQueryRequest.make({
        query: limited.query,
        profile: input.profile,
        dataset: sparqlDataset(input),
      })
    )
    .pipe(Effect.mapError(mapSparqlEngineError));
  const truncated = truncateResult(input.profile, result, input.safeguards.maxResultCount);

  return RunOntologySparqlResult.make({
    profile: input.profile,
    submittedQuery: input.query,
    normalizedQuery: limited.query,
    // The bound actually in force: the query's own LIMIT when it carried one, and the
    // safeguard's default only when we supplied it. Reporting the default either way
    // meant the badge described a limit the engine had never been given.
    effectiveLimit: NonNegativeInt.make(O.getOrElse(topLevelLimit(input.query), () => input.safeguards.defaultLimit)),
    limitInjected: limited.injected,
    truncated: truncated.truncated,
    rawResultCount: truncated.rawResultCount,
    displayedResultCount: truncated.displayedResultCount,
    result: truncated.result,
  });
});

/**
 * SPARQL runner service tag.
 *
 * @example
 * ```ts
 * import { OntologySparqlRunner } from "@beep/ontology-use-cases/aggregates/Session"
 * import { Effect } from "effect"
 *
 * const program = Effect.gen(function* () {
 *   const runner = yield* OntologySparqlRunner
 *   return runner
 * })
 *
 * console.log(program)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class OntologySparqlRunner extends Context.Service<OntologySparqlRunner, OntologySparqlRunnerShape>()(
  $I`OntologySparqlRunner`
) {}

/**
 * Live SPARQL runner service built on the semantic-web SPARQL contract.
 *
 * @example
 * ```ts
 * import { OntologySparqlRunnerLive } from "@beep/ontology-use-cases/aggregates/Session"
 *
 * console.log(OntologySparqlRunnerLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const OntologySparqlRunnerLive = Layer.effect(
  OntologySparqlRunner,
  Effect.gen(function* () {
    const sparql = yield* SparqlQueryService;
    return OntologySparqlRunner.of({
      run: Effect.fn("OntologySparqlRunner.run")((input) =>
        runOntologySparql(input).pipe(Effect.provideService(SparqlQueryService, sparql))
      ),
    });
  })
);
