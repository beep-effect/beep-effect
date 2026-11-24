/**
 * RDFC-1.0 canonical forms of RDF datasets, the dataset digest and dataset
 * isomorphism.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $RdfId } from "@beep/identity/packages";
import { ContentHash } from "@beep/schema/ContentHash";
import * as A from "effect/Array";
import * as Digest from "effect/crypto/Digest";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";
import { issueCanonicalLabels, relabelQuad, sortByCodePoint } from "./internal/rdfc10/Rdfc10.ts";
import { Dataset, makeDataset, serializeQuad } from "./Rdf.ts";
import type { Quad } from "./Rdf.ts";

const $I = $RdfId.create("Canonical");

/**
 * The most Hash N-Degree Quads calls one canonicalization may make.
 *
 * **Details**
 *
 * The count is deterministic, so an input passes or fails the bound the same
 * way on every machine and under every blank-node labelling. The densest
 * four-label dataset, K4 with all twelve directed edges, needs 76 calls.
 *
 * **Example** (Read the bound)
 *
 * ```ts
 * import { CanonicalWorkBound } from "@beep/rdf/Canonical"
 *
 * console.log(CanonicalWorkBound) // 1024
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const CanonicalWorkBound = 1024;

/**
 * The refusal raised when canonicalization would pass {@link CanonicalWorkBound}.
 *
 * **Example** (Describe a refused canonicalization)
 *
 * ```ts
 * import { CanonicalizationLimitExceeded } from "@beep/rdf/Canonical"
 *
 * const refusal = CanonicalizationLimitExceeded.make({ limit: 1024, reached: 1025 })
 * console.log(refusal.reached) // 1025
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CanonicalizationLimitExceeded extends S.TaggedError<
  CanonicalizationLimitExceeded,
  { readonly brand: unique symbol }
>($I`CanonicalizationLimitExceeded`)(
  "CanonicalizationLimitExceeded",
  {
    limit: S.Int.pipe(
      $I.annoteKey("CanonicalizationLimitExceeded.limit", {
        description: "The Hash N-Degree Quads call bound the run was held to.",
      })
    ),
    reached: S.Int.pipe(
      $I.annoteKey("CanonicalizationLimitExceeded.reached", {
        description: "The call count at which the run was refused, one past the bound.",
      })
    ),
  },
  $I.annoteError<CanonicalizationLimitExceeded>("CanonicalizationLimitExceeded", {
    description: "RDFC-1.0 canonicalization would make more Hash N-Degree Quads calls than the work bound allows.",
  })
) {}

/**
 * RDFC-1.0 canonical N-Quads: one newline-terminated line per quad, sorted in
 * Unicode code point order, blank nodes labelled `c14n0`, `c14n1` and so on.
 *
 * **Example** (Brand canonical text)
 *
 * ```ts
 * import { CanonicalNQuads } from "@beep/rdf/Canonical"
 *
 * const text = CanonicalNQuads.make("<https://example.test/s> <https://example.test/p> \"v\" .\n")
 * console.log(text.endsWith("\n")) // true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const CanonicalNQuads = S.String.pipe(
  S.brand("CanonicalNQuads"),
  $I.annoteSchema("CanonicalNQuads", {
    description: "RDFC-1.0 canonical N-Quads text, newline-terminated lines in code point order.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type CanonicalNQuads = typeof CanonicalNQuads.Type;

/**
 * The digest of a dataset: `sha256:` and the hex SHA-256 of its canonical
 * N-Quads' UTF-8 bytes.
 *
 * **Example** (Brand a dataset digest)
 *
 * ```ts
 * import { DatasetDigest } from "@beep/rdf/Canonical"
 * import { ContentHash } from "@beep/schema/ContentHash"
 *
 * const hash = ContentHash.make("sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
 * console.log(DatasetDigest.make(hash).startsWith("sha256:")) // true
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const DatasetDigest = ContentHash.pipe(
  S.brand("DatasetDigest"),
  $I.annoteSchema("DatasetDigest", {
    description: "SHA-256 content hash of a dataset's RDFC-1.0 canonical N-Quads.",
  })
);

/**
 * @category identifiers
 * @since 0.0.0
 */
export type DatasetDigest = typeof DatasetDigest.Type;

/**
 * **Example** (Build a canonical form)
 *
 * ```ts
 * import { CanonicalForm, CanonicalNQuads } from "@beep/rdf/Canonical"
 * import { makeDataset } from "@beep/rdf/Rdf"
 *
 * const form = CanonicalForm.make({ nquads: CanonicalNQuads.make(""), dataset: makeDataset([]) })
 * console.log(form.nquads.length) // 0
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CanonicalForm extends S.Opaque<CanonicalForm, { readonly brand: unique symbol }>()(
  S.Struct({
    nquads: CanonicalNQuads,
    dataset: Dataset,
  }).pipe(
    $I.annoteSchema("CanonicalForm", {
      description: "RDFC-1.0 canonical N-Quads and the dataset relabelled with canonical blank-node labels.",
    })
  )
) {}

const isGround = (dataset: Dataset): boolean =>
  HashSet.every(
    dataset.quads,
    (quad) =>
      quad.subject.termType !== "BlankNode" &&
      quad.object.termType !== "BlankNode" &&
      quad.graph.termType !== "BlankNode"
  );

const encoder = new TextEncoder();

/**
 * Canonicalize a dataset with RDFC-1.0 over SHA-256.
 *
 * **Example** (Canonicalize one blank-node statement)
 *
 * ```ts
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 * import { canonicalize } from "@beep/rdf/Canonical"
 * import { makeBlankNode, makeDataset, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf"
 *
 * const dataset = makeDataset([
 *   makeQuad(makeBlankNode("x"), makeNamedNode("https://example.test/p"), makeLiteral("v"))
 * ])
 *
 * Effect.runPromise(canonicalize(dataset).pipe(Effect.provide(Digest.layerWebCrypto))).then((form) =>
 *   console.log(form.nquads) // _:c14n0 <https://example.test/p> "v" .
 * )
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const canonicalize = Effect.fn("Canonical.canonicalize")(function* (dataset: Dataset) {
  const quads: ReadonlyArray<Quad> = A.fromIterable(dataset.quads);
  const labels = yield* issueCanonicalLabels(quads, CanonicalWorkBound, (reached) =>
    CanonicalizationLimitExceeded.make({ limit: CanonicalWorkBound, reached })
  );
  const relabelled = A.map(
    quads,
    relabelQuad((label) => HashMap.getUnsafe(labels, label))
  );
  const lines = sortByCodePoint(A.map(relabelled, (quad) => `${serializeQuad(quad)}\n`));
  return CanonicalForm.make({ nquads: CanonicalNQuads.make(A.join(lines, "")), dataset: makeDataset(relabelled) });
});

/**
 * The dataset digest: SHA-256 of the canonical N-Quads' UTF-8 bytes.
 *
 * **Example** (Digest two labellings of one dataset)
 *
 * ```ts
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 * import { canonicalDigest } from "@beep/rdf/Canonical"
 * import { makeBlankNode, makeDataset, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf"
 *
 * const labelled = (label: string) =>
 *   makeDataset([makeQuad(makeBlankNode(label), makeNamedNode("https://example.test/p"), makeLiteral("v"))])
 *
 * const program = Effect.all([canonicalDigest(labelled("a")), canonicalDigest(labelled("b"))], { concurrency: 1 })
 *
 * Effect.runPromise(program.pipe(Effect.provide(Digest.layerWebCrypto))).then(([a, b]) => console.log(a === b)) // true
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const canonicalDigest = Effect.fn("Canonical.canonicalDigest")(function* (dataset: Dataset) {
  const form = yield* canonicalize(dataset);
  const digest = yield* Digest.Digest;
  const hex = yield* digest.digestHex(Digest.sha256, encoder.encode(form.nquads));
  return DatasetDigest.make(ContentHash.make(`sha256:${hex}`));
});

/**
 * Whether two datasets are equal up to a renaming of blank nodes.
 *
 * **Details**
 *
 * Two ground datasets are compared with `Equal`; otherwise the canonical
 * N-Quads are compared.
 *
 * **Example** (Compare two labellings)
 *
 * ```ts
 * import * as Digest from "effect/crypto/Digest"
 * import * as Effect from "effect/Effect"
 * import { isIsomorphic } from "@beep/rdf/Canonical"
 * import { makeBlankNode, makeDataset, makeLiteral, makeNamedNode, makeQuad } from "@beep/rdf/Rdf"
 *
 * const labelled = (label: string) =>
 *   makeDataset([makeQuad(makeBlankNode(label), makeNamedNode("https://example.test/p"), makeLiteral("v"))])
 *
 * Effect.runPromise(isIsomorphic(labelled("a"), labelled("b")).pipe(Effect.provide(Digest.layerWebCrypto))).then(
 *   console.log
 * ) // true
 * ```
 *
 * @category normalization
 * @since 0.0.0
 */
export const isIsomorphic = Effect.fn("Canonical.isIsomorphic")(function* (left: Dataset, right: Dataset) {
  if (isGround(left) && isGround(right)) {
    return Equal.equals(left, right);
  }
  const [a, b] = yield* Effect.all([canonicalize(left), canonicalize(right)], { concurrency: 1 });
  return a.nquads === b.nquads;
});
