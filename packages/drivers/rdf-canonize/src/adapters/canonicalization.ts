/**
 * Local canonicalization adapter backing.
 *
 * @packageDocumentation
 * @since 0.0.0
 * @packageDocumentation
 */

/// <reference path="../rdf-canonize.d.ts" />

import { canonicalize } from "@beep/rdf/Canonical";
import { GraphTerm, Literal, makeDataset, ObjectTerm, Subject, serializeQuad } from "@beep/rdf/Rdf";
import { Sha256Hex } from "@beep/schema";
import {
  CanonicalDatasetResult,
  CanonicalizationAlgorithm,
  CanonicalizationError,
  CanonicalizationService,
  DatasetFingerprint,
} from "@beep/semantic-web/services/canonicalization";
import { A, O, Str } from "@beep/utils";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import { flow, pipe } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as Layer from "effect/Layer";
import * as Order from "effect/Order";
import * as S from "effect/Schema";
import { NQuads } from "rdf-canonize";
import type { CanonicalizationLimitExceeded } from "@beep/rdf/Canonical";
import type { Dataset, Quad } from "@beep/rdf/Rdf";
import type { CanonicalizationServiceShape } from "@beep/semantic-web/services/canonicalization";
import type { CanonizeGraph, CanonizeObject, CanonizeQuad, CanonizeSubject } from "rdf-canonize";

const decodeSha256Hex = S.decodeEffect(Sha256Hex);

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

  return yield* decodeSha256Hex(hex).pipe(
    Effect.mapError(() =>
      CanonicalizationError.make({
        reason: "fingerprintFailure",
        message: "Failed to decode SHA-256 dataset fingerprint.",
      })
    )
  );
});

const enforceWorkLimit = (
  quadCount: number,
  workLimit: O.Option<number>
): Effect.Effect<void, CanonicalizationError> =>
  O.isSome(workLimit) && quadCount > workLimit.value
    ? Effect.fail(
        CanonicalizationError.make({
          reason: "workLimitExceeded",
          message: `Dataset contains ${quadCount} quads, exceeding the work limit of ${workLimit.value}.`,
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
      datatype: { termType: "NamedNode", value: Literal.datatypeOf(value).value },
      ...O.getSomesStruct({ language: Literal.languageOf(value) }),
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

const byQuadLine: Order.Order<Quad> = Order.mapInput(Order.String, serializeQuad);

const refusedAtBound = (refusal: CanonicalizationLimitExceeded): CanonicalizationError =>
  CanonicalizationError.make({
    reason: "workLimitExceeded",
    message: `Semantic canonicalization exceeded its bound of ${refusal.limit} Hash N-Degree Quads calls.`,
  });

const canonicalizeSemantically = Effect.fn("SemanticWeb.canonicalizeSemantically")(function* (
  digest: Digest.Digest["Service"],
  dataset: Dataset
) {
  const form = yield* canonicalize(dataset).pipe(
    Effect.mapError(refusedAtBound),
    Effect.provideService(Digest.Digest, digest)
  );
  return { canonicalText: pipe(form.nquads, Str.trimEnd), dataset: form.dataset };
});

const canonicalizeLexically = (quads: ReadonlyArray<Quad>) => {
  const sorted = A.sort(quads, byQuadLine);
  return {
    canonicalText: lexicalCanonicalTextFromQuads(sorted),
    dataset: makeDataset(sorted),
  };
};

const getCanonicalDataset = (
  digest: Digest.Digest["Service"],
  request: Pick<Parameters<CanonicalizationServiceShape["canonicalize"]>[0], "algorithm" | "dataset">
): Effect.Effect<
  { readonly canonicalText: string; readonly dataset: ReturnType<typeof makeDataset> },
  CanonicalizationError
> =>
  CanonicalizationAlgorithm.match(request.algorithm, {
    "rdfc-1.0": () => canonicalizeSemantically(digest, request.dataset),
    "lexical-sort-v1": () => request.dataset.quads.pipe(A.fromIterable, canonicalizeLexically, Effect.succeed),
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
export const CanonicalizationServiceLive = Layer.effect(
  CanonicalizationService,
  Effect.gen(function* () {
    const digest = yield* Digest.Digest;
    return CanonicalizationService.of({
      canonicalize: Effect.fn(function* (request) {
        yield* enforceWorkLimit(HashSet.size(request.dataset.quads), request.workLimit);
        const canonical = yield* getCanonicalDataset(digest, request);
        return CanonicalDatasetResult.make(canonical);
      }),
      fingerprint: Effect.fn(function* (request) {
        yield* enforceWorkLimit(HashSet.size(request.dataset.quads), request.workLimit);
        const canonical = yield* getCanonicalDataset(digest, request);
        const fingerprint = yield* hashCanonicalText(canonical.canonicalText);
        return DatasetFingerprint.make({
          canonicalText: canonical.canonicalText,
          fingerprint,
        });
      }),
    } satisfies CanonicalizationServiceShape);
  })
).pipe(Layer.provide(Digest.layerWebCrypto));
