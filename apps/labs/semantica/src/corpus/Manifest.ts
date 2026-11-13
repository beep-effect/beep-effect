import { $SemanticaId } from "@beep/identity/packages";
import { LiteralKit, Sha256Hex } from "@beep/schema";
import { sha256 } from "@noble/hashes/sha2.js";
import * as A from "effect/Array";
import * as Equal from "effect/Equal";
import * as Hex from "effect/encoding/Hex";
import { constFalse } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as N from "effect/Number";
import * as Order from "effect/Order";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import * as Tuple from "effect/Tuple";
import { canonicalJsonResult } from "@/corpus/Canonical";

const $I = $SemanticaId.create("corpus/Manifest");

const corpusPaperIdPattern = /^[0-9a-f]{12}$/;

/**
 * Twelve-character lowercase hexadecimal identifier used by the academia corpus.
 *
 * **Example** (Recognize a paper id)
 *
 * ```ts
 * import { isCorpusPaperId } from "@/corpus/Manifest"
 *
 * console.log(isCorpusPaperId("057e356e94f8")) // true
 * console.log(isCorpusPaperId("057E356E94F8")) // false
 * ```
 *
 * @category identifiers
 * @since 0.0.0
 */
export const CorpusPaperId = S.String.check(
  S.makeFilterGroup([
    S.isBetweenLength(
      12,
      12,
      $I.annote("CorpusPaperIdLength", {
        title: "Corpus paper id length",
        description: "A corpus paper id containing exactly twelve characters.",
        message: "Corpus paper id must contain exactly twelve characters.",
      })
    ),
    S.isPattern(
      corpusPaperIdPattern,
      $I.annote("CorpusPaperIdPattern", {
        title: "Corpus paper id syntax",
        description: "A corpus paper id containing only lowercase hexadecimal characters.",
        message: "Corpus paper id must contain only lowercase hexadecimal characters.",
      })
    ),
  ])
).pipe(
  S.brand("CorpusPaperId"),
  $I.annoteSchema("CorpusPaperId", {
    description: "Twelve-character lowercase hexadecimal academia corpus identifier.",
  })
);

/**
 * Decoded value accepted by {@link CorpusPaperId}.
 *
 * @see {@link CorpusPaperId} for validation and branding.
 * @category models
 * @since 0.0.0
 */
export type CorpusPaperId = typeof CorpusPaperId.Type;

/**
 * Schema-derived guard for twelve-character lowercase corpus paper ids.
 *
 * **Example** (Narrow an unknown value)
 *
 * ```ts
 * import { isCorpusPaperId } from "@/corpus/Manifest"
 *
 * const value: unknown = "057e356e94f8"
 * console.log(isCorpusPaperId(value)) // true
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isCorpusPaperId = S.is(CorpusPaperId);

const CorpusManifestRowFields = S.Struct({
  id: CorpusPaperId,
  relativePath: S.NonEmptyString,
  sha256: Sha256Hex,
  bytes: S.Natural,
});

const CorpusManifestRowRelativePathCheck = S.makeFilter(
  (row: typeof CorpusManifestRowFields.Type) =>
    Str.Equivalence(row.relativePath, `${row.id}.pdf`) || "relativePath must equal the paper id plus .pdf",
  $I.annote("CorpusManifestRowRelativePathCheck", {
    title: "Corpus manifest row relative path",
    description: "Requires every W1 relative path to equal its corpus paper id with a .pdf suffix.",
    message: "Corpus manifest row relativePath must equal `${id}.pdf`.",
  })
);

const CorpusManifestRowDefinition = CorpusManifestRowFields.check(CorpusManifestRowRelativePathCheck);

/**
 * Content-addressed metadata for one W1 paper.
 *
 * **Example** (Create a manifest row)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CorpusManifestRow, CorpusPaperId } from "@/corpus/Manifest"
 * import { Sha256Hex } from "@beep/schema"
 *
 * const id = CorpusPaperId.make("057e356e94f8")
 * const row = CorpusManifestRow.make({
 *   id,
 *   relativePath: `${id}.pdf`,
 *   sha256: Sha256Hex.make("0".repeat(64)),
 *   bytes: S.Natural.make(12)
 * })
 * console.log(row.id) // "057e356e94f8"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CorpusManifestRow extends S.Opaque<CorpusManifestRow, { readonly brand: unique symbol }>()(
  CorpusManifestRowDefinition.pipe(
    $I.annoteSchema("CorpusManifestRow", {
      description: "Content hash, byte length, and deterministic relative path for one W1 paper.",
    })
  )
) {}

const CorpusManifestSelectionFields = S.Struct({
  rule: S.tag("first-25-by-id"),
  take: S.tag(25),
  onDisk: S.Natural,
});

const CorpusManifestSelectionDefinition = CorpusManifestSelectionFields.check(
  S.makeFilter(
    (selection: typeof CorpusManifestSelectionFields.Type) =>
      N.isGreaterThanOrEqualTo(selection.onDisk, selection.take),
    $I.annote("CorpusManifestSelectionSourceCensus", {
      title: "Corpus manifest source census",
      description:
        "Requires the source PDF census to contain at least as many papers as the committed selection takes.",
      message: "Corpus manifest selection.onDisk must be greater than or equal to selection.take.",
    })
  )
);

/**
 * Selection receipt that records how the committed W1 rows were chosen.
 *
 * **Example** (Record the 76-paper source census)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { CorpusManifestSelection } from "@/corpus/Manifest"
 *
 * const selection = CorpusManifestSelection.make({
 *   rule: "first-25-by-id",
 *   take: 25,
 *   onDisk: S.Natural.make(76)
 * })
 * console.log(selection.take) // 25
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CorpusManifestSelection extends S.Opaque<CorpusManifestSelection, { readonly brand: unique symbol }>()(
  CorpusManifestSelectionDefinition.pipe(
    $I.annoteSchema("CorpusManifestSelection", {
      description: "Deterministic first-25 selection rule and source PDF count used to define W1.",
    })
  )
) {}

const CorpusManifestFields = S.Struct({
  schemaVersion: S.tag("w1-manifest/v1"),
  corpusId: S.tag("academia-2026-07"),
  selection: CorpusManifestSelection,
  rows: S.NonEmptyArray(CorpusManifestRow),
  corpusHash: Sha256Hex,
});

type CorpusManifestFields = typeof CorpusManifestFields.Type;

const rowsAreStrictlyAscending = (manifest: CorpusManifestFields): boolean => {
  const pairs = A.zip(manifest.rows, A.drop(manifest.rows, 1));
  return A.every(pairs, ([left, right]) => Order.isLessThan(Order.String)(left.id, right.id));
};

const rowIdsAreUnique = (manifest: CorpusManifestFields): boolean =>
  Equal.equals(HashSet.size(HashSet.fromIterable(A.map(manifest.rows, (row) => row.id))), A.length(manifest.rows));

const rowCountMatchesSelection = (manifest: CorpusManifestFields): boolean =>
  Equal.equals(A.length(manifest.rows), manifest.selection.take);

// Rows the canonical JSON owner refuses have no canonical bytes, so no hash
// matches them: the check fails typed instead of throwing.
const manifestHashMatchesRows = (manifest: CorpusManifestFields): boolean =>
  Result.match(canonicalJsonResult(manifest.rows), {
    onFailure: constFalse,
    onSuccess: (canonical) =>
      Str.Equivalence(manifest.corpusHash, Hex.encode(sha256(new TextEncoder().encode(canonical)))),
  });

const CorpusManifestChecks = S.makeFilterGroup([
  S.makeFilter(
    rowsAreStrictlyAscending,
    $I.annote("CorpusManifestRowsAscending", {
      title: "Corpus manifest row order",
      description: "Requires W1 rows to be strictly ascending by corpus paper id.",
      message: "Corpus manifest rows must be strictly ascending by id.",
    })
  ),
  S.makeFilter(
    rowIdsAreUnique,
    $I.annote("CorpusManifestRowIdsUnique", {
      title: "Corpus manifest row id uniqueness",
      description: "Requires every W1 row to carry a unique corpus paper id.",
      message: "Corpus manifest row ids must be unique.",
    })
  ),
  S.makeFilter(
    rowCountMatchesSelection,
    $I.annote("CorpusManifestSelectionCount", {
      title: "Corpus manifest selection count",
      description: "Requires the number of W1 rows to match selection.take.",
      message: "Corpus manifest row count must equal selection.take.",
    })
  ),
  S.makeFilter(
    manifestHashMatchesRows,
    $I.annote("CorpusManifestHash", {
      title: "Corpus manifest hash",
      description: "Requires corpusHash to equal SHA-256 over compact canonical JSON of rows.",
      message: "Corpus manifest corpusHash must match the canonical rows digest.",
    })
  ),
]);

const CorpusManifestDefinition = CorpusManifestFields.check(CorpusManifestChecks);

/**
 * Committed manifest that defines the 25-paper W1 corpus independently of directory contents.
 *
 * **Example** (Inspect the fixed protocol fields)
 *
 * ```ts
 * import { CorpusManifest } from "@/corpus/Manifest"
 *
 * console.log(CorpusManifest.fields.schemaVersion.schema.literal) // "w1-manifest/v1"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CorpusManifest extends S.Opaque<CorpusManifest, { readonly brand: unique symbol }>()(
  CorpusManifestDefinition.pipe(
    $I.annoteSchema("CorpusManifest", {
      description: "Schema-refined, content-addressed manifest that defines the W1 corpus.",
    })
  )
) {}

const ManifestDriftKind = LiteralKit(["missing-file", "sha256-mismatch", "bytes-mismatch"]).pipe(
  $I.annoteSchema("ManifestDriftKind", {
    description: "Row-level drift variants reported while checking the W1 manifest.",
  })
);

class MissingManifestFile extends S.Opaque<MissingManifestFile, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("missing-file"),
    id: CorpusPaperId,
    relativePath: S.NonEmptyString,
  }).pipe(
    $I.annoteSchema("MissingManifestFile", {
      description: "Manifest row whose selected PDF is absent from the configured corpus root.",
    })
  )
) {}

class ManifestSha256Mismatch extends S.Opaque<ManifestSha256Mismatch, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("sha256-mismatch"),
    id: CorpusPaperId,
    relativePath: S.NonEmptyString,
    expectedSha256: Sha256Hex,
    actualSha256: Sha256Hex,
  }).pipe(
    $I.annoteSchema("ManifestSha256Mismatch", {
      description: "Manifest row whose selected PDF bytes have a different SHA-256 digest.",
    })
  )
) {}

class ManifestBytesMismatch extends S.Opaque<ManifestBytesMismatch, { readonly brand: unique symbol }>()(
  S.Struct({
    kind: S.tag("bytes-mismatch"),
    id: CorpusPaperId,
    relativePath: S.NonEmptyString,
    expectedBytes: S.Natural,
    actualBytes: S.Natural,
  }).pipe(
    $I.annoteSchema("ManifestBytesMismatch", {
      description: "Manifest row whose selected PDF has a different byte length.",
    })
  )
) {}

/**
 * Row-level missing-file, SHA-256, and byte-length drift details.
 *
 * **Example** (Construct a missing-file drift)
 *
 * ```ts
 * import { CorpusPaperId, ManifestDiff } from "@/corpus/Manifest"
 *
 * const diff = ManifestDiff.cases["missing-file"].make({
 *   id: CorpusPaperId.make("057e356e94f8"),
 *   relativePath: "057e356e94f8.pdf"
 * })
 * console.log(diff.kind) // "missing-file"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const ManifestDiff = ManifestDriftKind.mapMembers(
  Tuple.evolve([() => MissingManifestFile, () => ManifestSha256Mismatch, () => ManifestBytesMismatch])
).pipe(
  $I.annoteSchema("ManifestDiff", {
    description: "Exhaustive row-level W1 manifest drift details.",
  }),
  S.toTaggedUnion("kind")
);

/**
 * Runtime type for {@link ManifestDiff}.
 *
 * @see {@link ManifestDiff} for constructors and discriminator-aware helpers.
 * @category models
 * @since 0.0.0
 */
export type ManifestDiff = typeof ManifestDiff.Type;

const CorpusRootUnavailableReason = LiteralKit([
  "not-configured",
  "missing-directory",
  "unreadable-directory",
  "insufficient-pdfs",
]).pipe(
  $I.annoteSchema("CorpusRootUnavailableReason", {
    description: "Reasons the external W1 corpus root cannot supply the required first 25 PDFs.",
  })
);

/**
 * Reports that W1 cannot be read from the configured external corpus root.
 *
 * **Example** (Represent an absent configuration)
 *
 * ```ts
 * import { CorpusRootUnavailable } from "@/corpus/Manifest"
 * import * as O from "effect/Option"
 *
 * const error = CorpusRootUnavailable.make({
 *   message: "SEMANTICA_CORPUS_ROOT is not configured.",
 *   corpusRoot: O.none(),
 *   reason: "not-configured"
 * })
 * console.log(error._tag) // "CorpusRootUnavailable"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class CorpusRootUnavailable extends S.TaggedError<CorpusRootUnavailable, { readonly brand: unique symbol }>(
  $I`CorpusRootUnavailable`
)(
  "CorpusRootUnavailable",
  {
    message: S.NonEmptyString,
    corpusRoot: S.OptionFromNullOr(S.NonEmptyString),
    reason: CorpusRootUnavailableReason,
  },
  $I.annoteError<CorpusRootUnavailable>("CorpusRootUnavailable", {
    description: "Typed failure raised when the external W1 corpus root is absent or unreadable.",
  })
) {}

/**
 * Reports all row-level differences found while checking a W1 manifest.
 *
 * **Example** (Inspect a drift error)
 *
 * ```ts
 * import { CorpusPaperId, ManifestDiff, ManifestDrift } from "@/corpus/Manifest"
 *
 * const error = ManifestDrift.make({
 *   message: "W1 manifest drift detected.",
 *   manifestPath: "fixtures/w1.manifest.json",
 *   diffs: [ManifestDiff.cases["missing-file"].make({
 *     id: CorpusPaperId.make("057e356e94f8"),
 *     relativePath: "057e356e94f8.pdf"
 *   })]
 * })
 * console.log(error.diffs[0].kind) // "missing-file"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ManifestDrift extends S.TaggedError<ManifestDrift, { readonly brand: unique symbol }>($I`ManifestDrift`)(
  "ManifestDrift",
  {
    message: S.NonEmptyString,
    manifestPath: S.NonEmptyString,
    diffs: S.NonEmptyArray(ManifestDiff),
  },
  $I.annoteError<ManifestDrift>("ManifestDrift", {
    description: "Typed failure carrying every missing, hash-mismatched, or size-mismatched W1 row.",
  })
) {}

/**
 * Reports that a W1 manifest file could not be read or decoded at its boundary.
 *
 * **Example** (Construct a decode failure)
 *
 * ```ts
 * import { ManifestDecodeFailed } from "@/corpus/Manifest"
 *
 * const error = ManifestDecodeFailed.make({
 *   message: "Manifest is not valid w1-manifest/v1 JSON.",
 *   manifestPath: "fixtures/w1.manifest.json"
 * })
 * console.log(error._tag) // "ManifestDecodeFailed"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ManifestDecodeFailed extends S.TaggedError<ManifestDecodeFailed, { readonly brand: unique symbol }>(
  $I`ManifestDecodeFailed`
)(
  "ManifestDecodeFailed",
  {
    message: S.NonEmptyString,
    manifestPath: S.NonEmptyString,
  },
  $I.annoteError<ManifestDecodeFailed>("ManifestDecodeFailed", {
    description: "Typed boundary failure for unreadable or schema-invalid W1 manifest JSON.",
  })
) {}

/**
 * Reports that a built W1 manifest could not be written to its requested path.
 *
 * **Example** (Construct a write failure)
 *
 * ```ts
 * import { ManifestWriteFailed } from "@/corpus/Manifest"
 *
 * const error = ManifestWriteFailed.make({
 *   message: "Could not write W1 manifest.",
 *   manifestPath: "fixtures/w1.manifest.json"
 * })
 * console.log(error._tag) // "ManifestWriteFailed"
 * ```
 *
 * @category errors
 * @since 0.0.0
 */
export class ManifestWriteFailed extends S.TaggedError<ManifestWriteFailed, { readonly brand: unique symbol }>(
  $I`ManifestWriteFailed`
)(
  "ManifestWriteFailed",
  {
    message: S.NonEmptyString,
    manifestPath: S.NonEmptyString,
  },
  $I.annoteError<ManifestWriteFailed>("ManifestWriteFailed", {
    description: "Typed filesystem failure raised while writing a generated W1 manifest.",
  })
) {}
