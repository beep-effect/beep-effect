/**
 * Local canonicalization adapter backing.
 *
 * @packageDocumentation
 * @since 0.0.0
 * @packageDocumentation
 */

/// <reference path="../rdf-canonize.d.ts" />

import {
  DefaultGraph,
  GraphTerm,
  makeBlankNode,
  makeDataset,
  makeLiteral,
  makeNamedNode,
  makeQuad,
  ObjectTerm,
  Subject,
  sortDatasetQuads,
} from "@beep/rdf/Rdf";
import { Sha256Hex } from "@beep/schema";
import {
  CanonicalDatasetResult,
  CanonicalizationAlgorithm,
  CanonicalizationError,
  CanonicalizationService,
  DatasetFingerprint,
} from "@beep/semantic-web/services/canonicalization";
import { A, O, Str } from "@beep/utils";
import { Duration, Effect, flow, Layer, Match, pipe } from "effect";
import * as S from "effect/Schema";
import { canonize, NQuads } from "rdf-canonize";
import type { Quad } from "@beep/rdf/Rdf";
import type { CanonicalizationServiceShape } from "@beep/semantic-web/services/canonicalization";
import type { CanonizeGraph, CanonizeObject, CanonizeQuad, CanonizeSubject } from "rdf-canonize";

const SemanticCanonicalizationMaxWorkFactor = 1;
const SemanticCanonicalizationTimeout = Duration.seconds(1);
const SemanticCanonicalizationTimeoutMs = Duration.toMillis(SemanticCanonicalizationTimeout);
const semanticCanonicalizationBudgetFailureNames = ["AbortError", "TimeoutError"] as const;
const semanticCanonicalizationBudgetFailureFragments = [
  "Maximum deep iterations exceeded",
  "Abort signal received",
  "signal timed out",
  "aborted due to timeout",
] as const;
const semanticCanonicalizationBudgetMessage = `Semantic canonicalization exceeded the configured resource budget (maxWorkFactor=${SemanticCanonicalizationMaxWorkFactor}, timeout=${SemanticCanonicalizationTimeoutMs}ms).`;

const hashCanonicalText = Effect.fn("SemanticWeb.hashCanonicalText")(function* (canonicalText: string) {
  const hex = yield* Effect.tryPromise({
    try: () => {
      const bytes = new TextEncoder().encode(canonicalText);
      return crypto.subtle.digest("SHA-256", bytes).then((digest) =>
        pipe(
          A.fromIterable(new Uint8Array(digest)),
          A.map((value) => Str.padStart(2, "0")(value.toString(16))),
          A.join("")
        )
      );
    },
    catch: () =>
      CanonicalizationError.make({
        reason: "fingerprintFailure",
        message: "Failed to hash canonical dataset text.",
      }),
  });

  return yield* S.decodeEffect(Sha256Hex)(hex).pipe(
    Effect.mapError(() =>
      CanonicalizationError.make({
        reason: "fingerprintFailure",
        message: "Failed to decode SHA-256 dataset fingerprint.",
      })
    )
  );
});

const enforceWorkLimit = (
  quads: ReadonlyArray<Quad>,
  workLimit: O.Option<number>
): Effect.Effect<void, CanonicalizationError> =>
  O.isSome(workLimit) && quads.length > workLimit.value
    ? Effect.fail(
        CanonicalizationError.make({
          reason: "workLimitExceeded",
          message: `Dataset contains ${quads.length} quads, exceeding the work limit of ${workLimit.value}.`,
        })
      )
    : Effect.void;

const lexicalCanonicalTextFromQuads = (quads: ReadonlyArray<Quad>): string =>
  pipe(NQuads.serialize(toCanonizeDataset(quads)), Str.trimEnd);

const toCanonizeSubject = (subject: Subject): CanonizeSubject =>
  Subject.match(subject, {
    NamedNode: (value): CanonizeSubject => ({ termType: "NamedNode", value: value.value }),
    BlankNode: (value): CanonizeSubject => ({ termType: "BlankNode", value: value.value }),
  });

const toCanonizeObject = (object: ObjectTerm): CanonizeObject =>
  ObjectTerm.match(object, {
    NamedNode: (value): CanonizeObject => ({ termType: "NamedNode", value: value.value }),
    BlankNode: (value): CanonizeObject => ({ termType: "BlankNode", value: value.value }),
    Literal: (value): CanonizeObject => ({
      termType: "Literal",
      value: value.value,
      datatype: { termType: "NamedNode", value: value.datatype.value },
      ...O.getSomesStruct({ language: value.language }),
    }),
  });

const toCanonizeGraph = (graph: GraphTerm): CanonizeGraph =>
  GraphTerm.match(graph, {
    NamedNode: (value): CanonizeGraph => ({ termType: "NamedNode", value: value.value }),
    BlankNode: (value): CanonizeGraph => ({ termType: "BlankNode", value: value.value }),
    DefaultGraph: (): CanonizeGraph => ({ termType: "DefaultGraph", value: "" }),
  });

const toCanonizeQuad = (quad: Quad): CanonizeQuad => ({
  subject: toCanonizeSubject(quad.subject),
  predicate: { termType: "NamedNode", value: quad.predicate.value },
  object: toCanonizeObject(quad.object),
  graph: toCanonizeGraph(quad.graph),
});

const toCanonizeDataset: (quads: ReadonlyArray<Quad>) => ReadonlyArray<CanonizeQuad> = flow(A.map(toCanonizeQuad));

const fromCanonizeSubject = (subject: CanonizeSubject): Subject =>
  Match.value(subject).pipe(
    Match.withReturnType<Subject>(),
    Match.discriminatorsExhaustive("termType")({
      NamedNode: (value) => makeNamedNode(value.value),
      BlankNode: (value) => makeBlankNode(value.value),
    })
  );

const fromCanonizeObject = (object: CanonizeObject): ObjectTerm =>
  Match.value(object).pipe(
    Match.withReturnType<ObjectTerm>(),
    Match.discriminatorsExhaustive("termType")({
      NamedNode: (value) => makeNamedNode(value.value),
      BlankNode: (value) => makeBlankNode(value.value),
      Literal: (value) =>
        makeLiteral(value.value, value.datatype.value, {
          ...O.getSomesStruct({ language: O.fromUndefinedOr(value.language) }),
        }),
    })
  );

const fromCanonizeGraph = (graph: CanonizeGraph): GraphTerm =>
  Match.value(graph).pipe(
    Match.withReturnType<GraphTerm>(),
    Match.discriminatorsExhaustive("termType")({
      NamedNode: (value) => makeNamedNode(value.value),
      BlankNode: (value) => makeBlankNode(value.value),
      DefaultGraph: () => DefaultGraph.make({ termType: "DefaultGraph", value: "" }),
    })
  );

const fromCanonizeQuad = (quad: CanonizeQuad): Quad =>
  makeQuad(fromCanonizeSubject(quad.subject), makeNamedNode(quad.predicate.value), {
    object: fromCanonizeObject(quad.object),
    graph: fromCanonizeGraph(quad.graph),
  });

const hasSemanticCanonicalizationBudgetFailureName = (error: unknown): boolean =>
  error instanceof Error && A.some(semanticCanonicalizationBudgetFailureNames, (name) => error.name === name);

const isSemanticCanonicalizationBudgetFailure = (message: string): boolean =>
  A.some(semanticCanonicalizationBudgetFailureFragments, (fragment) => pipe(message, Str.includes(fragment)));

const mapCanonizeFailure = (error: unknown): CanonicalizationError => {
  const message = error instanceof Error ? error.message : "RDF dataset canonicalization failed.";

  return hasSemanticCanonicalizationBudgetFailureName(error) || isSemanticCanonicalizationBudgetFailure(message)
    ? CanonicalizationError.make({
        reason: "workLimitExceeded",
        message: semanticCanonicalizationBudgetMessage,
      })
    : CanonicalizationError.make({
        reason: "canonicalizationFailure",
        message,
      });
};

const canonicalizeSemantically = Effect.fn("SemanticWeb.canonicalizeSemantically")(function* (
  quads: ReadonlyArray<Quad>
) {
  const canonicalText = yield* Effect.tryPromise<string, CanonicalizationError>({
    try: () =>
      // Keep the semantic path on an explicit CPU budget instead of relying on upstream defaults.
      canonize(toCanonizeDataset(quads), {
        algorithm: "RDFC-1.0",
        format: "application/n-quads",
        maxWorkFactor: SemanticCanonicalizationMaxWorkFactor,
        signal: AbortSignal.timeout(SemanticCanonicalizationTimeoutMs),
      }),
    catch: mapCanonizeFailure,
  });

  const parsed = yield* Effect.try({
    try: () => NQuads.parse(canonicalText),
    catch: mapCanonizeFailure,
  });

  return {
    canonicalText: pipe(canonicalText, Str.trimEnd),
    dataset: makeDataset(pipe(parsed, A.map(fromCanonizeQuad))),
  };
});

const canonicalizeLexically = (quads: ReadonlyArray<Quad>) => {
  const sorted = sortDatasetQuads(makeDataset(quads));
  return {
    canonicalText: lexicalCanonicalTextFromQuads(sorted),
    dataset: makeDataset(sorted),
  };
};

const getCanonicalDataset = (
  request: Parameters<CanonicalizationServiceShape["canonicalize"]>[0]
): Effect.Effect<
  { readonly canonicalText: string; readonly dataset: ReturnType<typeof makeDataset> },
  CanonicalizationError
> =>
  CanonicalizationAlgorithm.$match(request.algorithm, {
    "rdfc-1.0": () => canonicalizeSemantically(request.dataset.quads),
    "lexical-sort-v1": () => Effect.succeed(canonicalizeLexically(request.dataset.quads)),
  });

/**
 * Canonicalization service live layer.
 *
 * **Example** (Import live layer)
 *
 * ```ts
 * import { CanonicalizationServiceLive } from "@beep/rdf-canonize/adapters/canonicalization"
 *
 * console.log(CanonicalizationServiceLive)
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const CanonicalizationServiceLive = Layer.succeed(
  CanonicalizationService,
  CanonicalizationService.of({
    canonicalize: Effect.fn(function* (request) {
      yield* enforceWorkLimit(request.dataset.quads, request.workLimit);
      const canonical = yield* getCanonicalDataset(request);
      return CanonicalDatasetResult.make(canonical);
    }),
    fingerprint: Effect.fn(function* (request) {
      yield* enforceWorkLimit(request.dataset.quads, request.workLimit);
      const canonical = yield* getCanonicalDataset(request);
      const fingerprint = yield* hashCanonicalText(canonical.canonicalText);
      return DatasetFingerprint.make({
        canonicalText: canonical.canonicalText,
        fingerprint,
      });
    }),
  } satisfies CanonicalizationServiceShape)
);
