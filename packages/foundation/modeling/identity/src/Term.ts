/**
 * Declared terms: namespaces, term IRIs, term bindings, deprecations and the
 * term-stability snapshot.
 *
 * **Details**
 *
 * A published IRI is declared, never derived from a code path. The snapshot
 * records the published set, and {@link snapshotViolations} reports every way a
 * successor snapshot breaks it. Collections are strictly ascending arrays, so
 * the committed snapshot is byte-deterministic without a hash set.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as Equal from "effect/Equal";
import { dual, flow, pipe } from "effect/Function";
import * as HashMap from "effect/HashMap";
import * as HashSet from "effect/HashSet";
import * as O from "effect/Option";
import * as Order from "effect/Order";
import * as R from "effect/Record";
import * as Result from "effect/Result";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { IRI } from "./Iri.ts";
import { isSafeLocal, SafePnPrefix } from "./PnLocal.ts";
import { $IdentityId } from "./packages.ts";

const $I = $IdentityId.create("Term");

/**
 * A published term IRI, declared in the registry and never derived from a code path.
 *
 * **Example** (Decode a term IRI)
 *
 * ```ts import.meta.vitest name="Decode a term IRI"
 * import * as S from "effect/Schema"
 * import { TermIri } from "@beep/identity/Term"
 *
 * S.is(TermIri)("http://www.w3.org/ns/prov#Activity") // => true
 * S.is(TermIri)("not an iri") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TermIri = IRI.pipe(
  S.brand("TermIri"),
  $I.annoteSchema("TermIri", { description: "A registry-declared term IRI." })
);

/**
 * Decoded type of {@link TermIri}.
 *
 * @category models
 * @since 0.0.0
 */
export type TermIri = typeof TermIri.Type;

/**
 * The compile-checked code identity of a kind, `@beep/<package>/<path>`, as a composer prints it.
 *
 * **Example** (Check a code identity)
 *
 * ```ts import.meta.vitest name="Check a code identity"
 * import * as S from "effect/Schema"
 * import { CodeId } from "@beep/identity/Term"
 *
 * S.is(CodeId)("@beep/test-runner/Vitest/TestHang") // => true
 * S.is(CodeId)("@beep/test-runner") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodeId = S.String.check(
  S.isPattern(
    /^@beep\/[a-z0-9][a-z0-9-]*(?:\/[A-Za-z0-9._-]+)+$/,
    $I.annote("CodeIdPattern", {
      title: "Code Identity",
      description: "A @beep package name followed by at least one module path segment.",
      message: "Expected a code identity of the form @beep/<package>/<path>.",
    })
  )
).pipe(S.brand("CodeId"), $I.annoteSchema("CodeId", { description: "A code-path identity for a kind." }));

/**
 * Decoded type of {@link CodeId}.
 *
 * @category models
 * @since 0.0.0
 */
export type CodeId = typeof CodeId.Type;

/**
 * A vocabulary release `major.minor.patch` of the term snapshot.
 *
 * **Details**
 *
 * This is not a package version. The snapshot writer bumps the minor when a
 * term is added and the major when a term is deprecated, and existing rows
 * keep their `since`. The pattern is local because `@beep/identity` cannot
 * import `@beep/schema`; the schema package's tests cross-check it against
 * `SemanticVersion`.
 *
 * **Example** (Check a release version)
 *
 * ```ts import.meta.vitest name="Check a release version"
 * import * as S from "effect/Schema"
 * import { ReleaseVersion } from "@beep/identity/Term"
 *
 * S.is(ReleaseVersion)("1.0.0") // => true
 * S.is(ReleaseVersion)("1.0.0-beta") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const ReleaseVersion = S.String.check(
  S.isPattern(
    /^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)$/,
    $I.annote("ReleaseVersionPattern", {
      title: "Release Version",
      description: "A core semantic version with no prerelease or build suffix.",
      message: "Expected a version of the form major.minor.patch.",
    })
  )
).pipe(
  S.brand("ReleaseVersion"),
  $I.annoteSchema("ReleaseVersion", { description: "A vocabulary release of the term snapshot." })
);

/**
 * Decoded type of {@link ReleaseVersion}.
 *
 * @category models
 * @since 0.0.0
 */
export type ReleaseVersion = typeof ReleaseVersion.Type;

const isTermLocal: (local: string) => boolean = flow(Str.split("/"), A.every(isSafeLocal));

/**
 * The local name of a term: one or more safe `PN_LOCAL` segments joined by `/`.
 *
 * **Details**
 *
 * New internal terms use one segment. Multi-segment locals exist for the
 * versioned contract IRIs that keep their bytes, such as `receipts/accepted/v2`.
 * The canonical CURIE keeps the raw `/`; a Turtle writer escapes it at the boundary.
 *
 * **Example** (Check term locals)
 *
 * ```ts import.meta.vitest name="Check term locals"
 * import * as S from "effect/Schema"
 * import { TermLocal } from "@beep/identity/Term"
 *
 * S.is(TermLocal)("Activity") // => true
 * S.is(TermLocal)("receipts/accepted/v2") // => true
 * S.is(TermLocal)("receipts//v2") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const TermLocal = S.String.check(
  S.makeFilter(
    isTermLocal,
    $I.annote("TermLocalCheck", {
      title: "Term Local",
      description: "One or more safe PN_LOCAL segments joined by a slash.",
      message: "Expected one or more safe PN_LOCAL segments joined by a slash.",
    })
  )
).pipe(S.brand("TermLocal"), $I.annoteSchema("TermLocal", { description: "The local name of a declared term." }));

/**
 * Decoded type of {@link TermLocal}.
 *
 * @category models
 * @since 0.0.0
 */
export type TermLocal = typeof TermLocal.Type;

/**
 * One registry namespace: the CURIE prefix and the IRI it expands to.
 *
 * **Example** (Make a namespace)
 *
 * ```ts import.meta.vitest name="Make a namespace"
 * import { IRI } from "@beep/identity/Iri"
 * import { Namespace } from "@beep/identity/Term"
 *
 * const prov = Namespace.make({ prefix: "prov", iri: IRI.make("http://www.w3.org/ns/prov#") })
 * prov.prefix // => "prov"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Namespace extends S.Opaque<Namespace, { readonly brand: unique symbol }>()(
  S.Struct({
    prefix: SafePnPrefix.annotateKey({ description: "CURIE prefix, for example prov or oa." }),
    iri: IRI.annotateKey({ description: "Namespace IRI the prefix expands to." }),
  }).pipe($I.annoteSchema("Namespace", { description: "A registry namespace: prefix and IRI." }))
) {}

/**
 * Encoded representation of {@link Namespace}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Namespace {
  /**
   * Encoded namespace row.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Namespace.Encoded;
}

/**
 * One declared term of a registry namespace.
 *
 * **Example** (Declare a term under a namespace)
 *
 * ```ts import.meta.vitest name="Declare a term under a namespace"
 * import { IRI } from "@beep/identity/Iri"
 * import { Namespace, Term, TermLocal } from "@beep/identity/Term"
 *
 * const prov = Namespace.make({ prefix: "prov", iri: IRI.make("http://www.w3.org/ns/prov#") })
 * const activity = Term.of(prov, TermLocal.make("Activity"))
 * activity.iri // => "http://www.w3.org/ns/prov#Activity"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Term extends S.Opaque<Term, { readonly brand: unique symbol }>()(
  S.Struct({
    iri: TermIri.annotateKey({ description: "The term IRI: the namespace IRI followed by the local." }),
    namespace: SafePnPrefix.annotateKey({ description: "Prefix of the namespace that declares the term." }),
    local: TermLocal.annotateKey({ description: "Local name inside the namespace." }),
  }).pipe($I.annoteSchema("Term", { description: "A registry term: IRI, namespace and local name." }))
) {
  /**
   * Declare the term `local` of `namespace`, whose IRI is the namespace IRI followed by the local.
   *
   * **Gotchas**
   *
   * Throws the schema validation error when the concatenation is not an IRI, for
   * example when the local holds a `PN_LOCAL` code point RFC 3987 refuses.
   *
   * **Example** (Declare a multi-segment term)
   *
   * ```ts import.meta.vitest name="Declare a multi-segment term"
   * import { IRI } from "@beep/identity/Iri"
   * import { Namespace, Term, TermLocal } from "@beep/identity/Term"
   *
   * const qa = Namespace.make({ prefix: "qa", iri: IRI.make("https://beep-effect.com/ns/qa/") })
   * Term.of(qa, TermLocal.make("receipts/accepted/v2")).iri // => "https://beep-effect.com/ns/qa/receipts/accepted/v2"
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly of = (namespace: Namespace, local: TermLocal): Term =>
    Term.make({ iri: TermIri.make(`${namespace.iri}${local}`), namespace: namespace.prefix, local });
}

/**
 * Encoded representation of {@link Term}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Term {
  /**
   * Encoded term row.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Term.Encoded;
}

/**
 * A binding row that pins a code identity to its published term.
 *
 * **Details**
 *
 * A module rename edits `code`, never `term`, so a published IRI survives a
 * file move.
 *
 * **Example** (Bind a code identity)
 *
 * ```ts import.meta.vitest name="Bind a code identity"
 * import { CodeId, ReleaseVersion, TermBinding, TermIri } from "@beep/identity/Term"
 *
 * const binding = TermBinding.make({
 *   code: CodeId.make("@beep/test-runner/Vitest/TestHang"),
 *   term: TermIri.make("https://beep-effect.com/ns/vitest/TestHang"),
 *   since: ReleaseVersion.make("1.0.0")
 * })
 * binding.since // => "1.0.0"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TermBinding extends S.Opaque<TermBinding, { readonly brand: unique symbol }>()(
  S.Struct({
    code: CodeId.annotateKey({ description: "Code identity of the kind today." }),
    term: TermIri.annotateKey({ description: "Published term the code identity is bound to." }),
    since: ReleaseVersion.annotateKey({ description: "Vocabulary release that first published the binding." }),
  }).pipe(
    $I.annoteSchema("TermBinding", {
      description: "Data-table binding from a code identity to a published term IRI.",
    })
  )
) {}

/**
 * Encoded representation of {@link TermBinding}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TermBinding {
  /**
   * Encoded binding row.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof TermBinding.Encoded;
}

/**
 * The record that alone may remove a published term, with its optional successor.
 *
 * **Example** (Deprecate a term with a replacement)
 *
 * ```ts import.meta.vitest name="Deprecate a term with a replacement"
 * import * as O from "effect/Option"
 * import { Deprecation, ReleaseVersion, TermIri } from "@beep/identity/Term"
 *
 * const deprecation = Deprecation.make({
 *   term: TermIri.make("https://beep-effect.com/ns/test-utils/Vitest/TestHang"),
 *   since: ReleaseVersion.make("1.0.0"),
 *   replacement: O.some(TermIri.make("https://beep-effect.com/ns/vitest/TestHang"))
 * })
 * O.isSome(deprecation.replacement) // => true
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Deprecation extends S.Opaque<Deprecation, { readonly brand: unique symbol }>()(
  S.Struct({
    term: TermIri.annotateKey({ description: "The deprecated term." }),
    since: ReleaseVersion.annotateKey({ description: "Vocabulary release that deprecated the term." }),
    replacement: S.OptionFromOptionalKey(TermIri).annotateKey({ description: "Successor term, when one exists." }),
  }).pipe($I.annoteSchema("Deprecation", { description: "A term deprecation with its optional successor." }))
) {}

/**
 * Encoded representation of {@link Deprecation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Deprecation {
  /**
   * Encoded deprecation row; an absent `replacement` key means no successor.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Deprecation.Encoded;
}

const isStrictlyAscendingBy =
  <Row>(key: (row: Row) => string) =>
  (rows: ReadonlyArray<Row>): boolean =>
    A.every(rows, (row, index) =>
      O.match(A.get(rows, index - 1), {
        onNone: () => true,
        onSome: (previous) => key(previous) < key(row),
      })
    );

const namespaceKey = (namespace: Namespace): string => namespace.prefix;
const termKey = (term: TermIri): string => term;
const bindingKey = (binding: TermBinding): string => binding.code;
const deprecationKey = (deprecation: Deprecation): string => deprecation.term;

const strictlyAscending = <Row>(key: (row: Row) => string, name: string) =>
  S.makeFilter(
    isStrictlyAscendingBy(key),
    $I.annote(`${name}StrictlyAscending`, {
      title: `${name} Strictly Ascending`,
      description: `${name} rows are strictly ascending by key, so they are sorted and duplicate-free.`,
      message: `Expected ${name} rows strictly ascending by key, with no duplicate.`,
    })
  );

/**
 * The term-stability snapshot: the published namespaces, terms, bindings and deprecations.
 *
 * **Details**
 *
 * `terms` holds every published term IRI and every namespace IRI, since
 * instances are minted under a namespace. Each collection is strictly
 * ascending by its key (`prefix`, the IRI, `code`, `term`) in UTF-16 code-unit
 * order, and decoding refuses an unsorted or duplicated row, so the encoded
 * snapshot is byte-deterministic.
 *
 * **Example** (Build a snapshot from unsorted rows)
 *
 * ```ts import.meta.vitest name="Build a snapshot from unsorted rows"
 * import { IRI } from "@beep/identity/Iri"
 * import * as Result from "effect/Result"
 * import { Namespace, ReleaseVersion, TermIri, TermSnapshot } from "@beep/identity/Term"
 *
 * const snapshot = TermSnapshot.fromRows({
 *   release: ReleaseVersion.make("1.0.0"),
 *   namespaces: [Namespace.make({ prefix: "prov", iri: IRI.make("http://www.w3.org/ns/prov#") })],
 *   terms: [TermIri.make("http://www.w3.org/ns/prov#Entity"), TermIri.make("http://www.w3.org/ns/prov#Activity")],
 *   bindings: [],
 *   deprecations: []
 * })
 * Result.getOrThrow(snapshot).terms[0] // => "http://www.w3.org/ns/prov#Activity"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class TermSnapshot extends S.Opaque<TermSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("term-snapshot/v1"),
    release: ReleaseVersion.annotateKey({ description: "Vocabulary release of this snapshot." }),
    namespaces: S.Array(Namespace)
      .check(strictlyAscending(namespaceKey, "Namespace"))
      .annotateKey({ description: "Published namespaces, ascending by prefix." }),
    terms: S.Array(TermIri)
      .check(strictlyAscending(termKey, "Term"))
      .annotateKey({ description: "Every published term IRI and namespace IRI, ascending." }),
    bindings: S.Array(TermBinding)
      .check(strictlyAscending(bindingKey, "Binding"))
      .annotateKey({ description: "Term bindings, ascending by code identity." }),
    deprecations: S.Array(Deprecation)
      .check(strictlyAscending(deprecationKey, "Deprecation"))
      .annotateKey({ description: "Append-only deprecations, ascending by term." }),
  }).pipe($I.annoteSchema("TermSnapshot", { description: "Snapshot of the published term set (L0-3)." }))
) {
  /**
   * Build a snapshot from rows in any order, sorting each collection and dropping exact repeats.
   *
   * **Details**
   *
   * Two distinct rows with one key, such as one code identity bound to two
   * terms, fail validation instead of one silently winning.
   *
   * **Example** (Refuse a code bound twice)
   *
   * ```ts import.meta.vitest name="Refuse a code bound twice"
   * import * as Result from "effect/Result"
   * import { CodeId, ReleaseVersion, TermBinding, TermIri, TermSnapshot } from "@beep/identity/Term"
   *
   * const code = CodeId.make("@beep/test-runner/Vitest/TestHang")
   * const since = ReleaseVersion.make("1.0.0")
   * const snapshot = TermSnapshot.fromRows({
   *   release: since,
   *   namespaces: [],
   *   terms: [],
   *   bindings: [
   *     TermBinding.make({ code, term: TermIri.make("https://beep-effect.com/ns/vitest/A"), since }),
   *     TermBinding.make({ code, term: TermIri.make("https://beep-effect.com/ns/vitest/B"), since })
   *   ],
   *   deprecations: []
   * })
   * Result.isFailure(snapshot) // => true
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromRows = (rows: {
    readonly release: ReleaseVersion;
    readonly namespaces: Iterable<Namespace>;
    readonly terms: Iterable<TermIri>;
    readonly bindings: Iterable<TermBinding>;
    readonly deprecations: Iterable<Deprecation>;
  }): Result.Result<TermSnapshot, S.SchemaError> =>
    decodeSnapshotType({
      version: "term-snapshot/v1",
      release: rows.release,
      namespaces: canonicalRows(rows.namespaces, namespaceKey),
      terms: canonicalRows(rows.terms, termKey),
      bindings: canonicalRows(rows.bindings, bindingKey),
      deprecations: canonicalRows(rows.deprecations, deprecationKey),
    });

  /**
   * The snapshot with no rows at release `0.0.0`, the base when no earlier snapshot exists.
   *
   * **Example** (Read the empty snapshot)
   *
   * ```ts import.meta.vitest name="Read the empty snapshot"
   * import { TermSnapshot } from "@beep/identity/Term"
   *
   * TermSnapshot.empty.terms.length // => 0
   * TermSnapshot.empty.release // => "0.0.0"
   * ```
   *
   * @category constants
   * @since 0.0.0
   */
  static readonly empty: TermSnapshot = TermSnapshot.make({
    version: "term-snapshot/v1",
    release: ReleaseVersion.make("0.0.0"),
    namespaces: [],
    terms: [],
    bindings: [],
    deprecations: [],
  });
}

/**
 * Encoded representation of {@link TermSnapshot}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace TermSnapshot {
  /**
   * Encoded snapshot, the shape of the committed `term-snapshot.json`.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof TermSnapshot.Encoded;
}

const decodeSnapshotType = S.decodeUnknownResult(S.toType(TermSnapshot));

const canonicalRows = <Row>(rows: Iterable<Row>, key: (row: Row) => string): ReadonlyArray<Row> =>
  pipe(A.fromIterable(rows), A.sort(Order.mapInput(Order.String, key)), A.dedupeWith(Equal.equals));

/**
 * Every way a successor snapshot breaks the published term set of its predecessor.
 *
 * **Details**
 *
 * - `TermRemoved`: a term of the previous snapshot is absent and has no deprecation.
 * - `TermRevived`: a deprecated term is published again.
 * - `DeprecationRemoved` and `DeprecationChanged`: deprecations are append-only.
 * - `SinceRewritten`: a bound term's `since` changed.
 * - `BindingReassigned`: a code identity is bound to a different term.
 * - `BindingAmbiguous`: one term is bound by more than one code identity.
 * - `NamespaceDropped`: a namespace is gone and its IRI has no deprecation.
 * - `NamespacePrefixChanged`: a namespace IRI is published under a new prefix.
 *
 * **Example** (Match a violation)
 *
 * ```ts import.meta.vitest name="Match a violation"
 * import { SnapshotViolation, TermIri } from "@beep/identity/Term"
 *
 * const violation = SnapshotViolation.cases.TermRemoved.make({
 *   term: TermIri.make("http://www.w3.org/ns/prov#Activity")
 * })
 * violation._tag // => "TermRemoved"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const SnapshotViolation = S.TaggedUnion({
  TermRemoved: { term: TermIri },
  TermRevived: { term: TermIri },
  DeprecationRemoved: { term: TermIri },
  DeprecationChanged: { term: TermIri },
  SinceRewritten: { term: TermIri, from: ReleaseVersion, to: ReleaseVersion },
  BindingReassigned: { code: CodeId, from: TermIri, to: TermIri },
  BindingAmbiguous: { term: TermIri, codes: S.Array(CodeId) },
  NamespaceDropped: { prefix: SafePnPrefix, iri: IRI },
  NamespacePrefixChanged: { iri: IRI, from: SafePnPrefix, to: SafePnPrefix },
}).pipe($I.annoteSchema("SnapshotViolation", { description: "A break of the published term set (L0-3)." }));

/**
 * Decoded type of {@link SnapshotViolation}.
 *
 * @category models
 * @since 0.0.0
 */
export type SnapshotViolation = typeof SnapshotViolation.Type;

/**
 * A one-line, human-readable statement of a snapshot violation.
 *
 * **Example** (Describe a violation)
 *
 * ```ts import.meta.vitest name="Describe a violation"
 * import { SnapshotViolation, snapshotViolationMessage, TermIri } from "@beep/identity/Term"
 *
 * const violation = SnapshotViolation.cases.TermRemoved.make({ term: TermIri.make("http://www.w3.org/ns/prov#Activity") })
 * snapshotViolationMessage(violation) // => "http://www.w3.org/ns/prov#Activity is removed without a deprecation."
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const snapshotViolationMessage: (violation: SnapshotViolation) => string = SnapshotViolation.match({
  TermRemoved: ({ term }) => `${term} is removed without a deprecation.`,
  TermRevived: ({ term }) => `${term} is deprecated and published again.`,
  DeprecationRemoved: ({ term }) => `The deprecation of ${term} is removed.`,
  DeprecationChanged: ({ term }) => `The deprecation of ${term} is changed.`,
  SinceRewritten: ({ term, from, to }) => `The binding of ${term} changes its since from ${from} to ${to}.`,
  BindingReassigned: ({ code, from, to }) => `Code identity ${code} is rebound from ${from} to ${to}.`,
  BindingAmbiguous: ({ term, codes }) => `${term} is bound by more than one code identity (${A.join(codes, ", ")}).`,
  NamespaceDropped: ({ prefix, iri }) => `Namespace "${prefix}" (${iri}) is removed without a deprecation of its IRI.`,
  NamespacePrefixChanged: ({ iri, from, to }) => `Namespace ${iri} changes its prefix from "${from}" to "${to}".`,
});

const Violation = SnapshotViolation.cases;

const indexBy = <Row, Key>(rows: ReadonlyArray<Row>, key: (row: Row) => Key): HashMap.HashMap<Key, Row> =>
  HashMap.fromIterable(A.map(rows, (row) => [key(row), row] as const));

const termViolations = (previous: TermSnapshot, next: TermSnapshot): ReadonlyArray<SnapshotViolation> => {
  const published = HashSet.fromIterable(next.terms);
  const deprecated = HashSet.fromIterable(
    A.appendAll(A.map(previous.deprecations, deprecationKey), A.map(next.deprecations, deprecationKey))
  );
  const nextDeprecated = HashSet.fromIterable(A.map(next.deprecations, deprecationKey));
  return A.appendAll(
    pipe(
      previous.terms,
      A.filter((term) => !HashSet.has(published, term) && !HashSet.has(nextDeprecated, term)),
      A.map((term) => Violation.TermRemoved.make({ term }))
    ),
    pipe(
      next.terms,
      A.filter((term) => HashSet.has(deprecated, term)),
      A.map((term) => Violation.TermRevived.make({ term }))
    )
  );
};

const deprecationViolations = (previous: TermSnapshot, next: TermSnapshot): ReadonlyArray<SnapshotViolation> => {
  const nextByTerm = indexBy(next.deprecations, (deprecation) => deprecation.term);
  return A.flatMap(
    previous.deprecations,
    (deprecation): ReadonlyArray<SnapshotViolation> =>
      O.match(HashMap.get(nextByTerm, deprecation.term), {
        onNone: () => [Violation.DeprecationRemoved.make({ term: deprecation.term })],
        onSome: (successor) =>
          Equal.equals(successor, deprecation) ? [] : [Violation.DeprecationChanged.make({ term: deprecation.term })],
      })
  );
};

const bindingViolations = (previous: TermSnapshot, next: TermSnapshot): ReadonlyArray<SnapshotViolation> => {
  const nextByCode = indexBy(next.bindings, (binding) => binding.code);
  const nextByTerm = indexBy(next.bindings, (binding) => binding.term);
  const reassigned = A.flatMap(previous.bindings, (binding) =>
    pipe(
      HashMap.get(nextByCode, binding.code),
      O.filter((successor) => successor.term !== binding.term),
      O.match({
        onNone: () => [],
        onSome: (successor) => [
          Violation.BindingReassigned.make({ code: binding.code, from: binding.term, to: successor.term }),
        ],
      })
    )
  );
  const rewritten = A.flatMap(previous.bindings, (binding) =>
    pipe(
      HashMap.get(nextByTerm, binding.term),
      O.filter((successor) => successor.since !== binding.since),
      O.match({
        onNone: () => [],
        onSome: (successor) => [
          Violation.SinceRewritten.make({ term: binding.term, from: binding.since, to: successor.since }),
        ],
      })
    )
  );
  const ambiguous = pipe(
    A.groupBy(next.bindings, (binding) => binding.term),
    R.values,
    A.filter((group) => group.length > 1),
    A.sort(Order.mapInput(Order.String, (group: A.NonEmptyReadonlyArray<TermBinding>) => A.headNonEmpty(group).term)),
    A.map((group) =>
      Violation.BindingAmbiguous.make({
        term: A.headNonEmpty(group).term,
        codes: A.map(group, (binding) => binding.code),
      })
    )
  );
  return A.appendAll(A.appendAll(reassigned, rewritten), ambiguous);
};

const namespaceViolations = (previous: TermSnapshot, next: TermSnapshot): ReadonlyArray<SnapshotViolation> => {
  const nextByIri = indexBy(next.namespaces, (namespace) => namespace.iri);
  const nextDeprecated = HashSet.fromIterable(A.map(next.deprecations, deprecationKey));
  return A.flatMap(
    previous.namespaces,
    (namespace): ReadonlyArray<SnapshotViolation> =>
      O.match(HashMap.get(nextByIri, namespace.iri), {
        onNone: () =>
          HashSet.has(nextDeprecated, namespace.iri)
            ? []
            : [Violation.NamespaceDropped.make({ prefix: namespace.prefix, iri: namespace.iri })],
        onSome: (successor) =>
          successor.prefix === namespace.prefix
            ? []
            : [
                Violation.NamespacePrefixChanged.make({
                  iri: namespace.iri,
                  from: namespace.prefix,
                  to: successor.prefix,
                }),
              ],
      })
  );
};

/**
 * Every way `next` breaks the published term set of `previous` (law L0-3).
 *
 * **When to use**
 *
 * Use to gate a regenerated snapshot against the committed base: an empty
 * result means the change only added terms or explained each removal with a
 * deprecation.
 *
 * **Details**
 *
 * The result is ordered by kind (terms, deprecations, bindings, namespaces)
 * and, within a kind, by the ascending row order of the snapshots, so equal
 * inputs give equal arrays.
 *
 * **Example** (Report a removal without a deprecation)
 *
 * ```ts import.meta.vitest name="Report a removal without a deprecation"
 * import * as A from "effect/Array"
 * import * as Result from "effect/Result"
 * import { ReleaseVersion, snapshotViolations, TermIri, TermSnapshot } from "@beep/identity/Term"
 *
 * const activity = TermIri.make("http://www.w3.org/ns/prov#Activity")
 * const previous = Result.getOrThrow(
 *   TermSnapshot.fromRows({ release: ReleaseVersion.make("1.0.0"), namespaces: [], terms: [activity], bindings: [], deprecations: [] })
 * )
 * A.map(snapshotViolations(previous, TermSnapshot.empty), (violation) => violation._tag) // => ["TermRemoved"]
 * snapshotViolations(TermSnapshot.empty, previous).length // => 0
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const snapshotViolations: {
  (next: TermSnapshot): (previous: TermSnapshot) => ReadonlyArray<SnapshotViolation>;
  (previous: TermSnapshot, next: TermSnapshot): ReadonlyArray<SnapshotViolation>;
} = dual(
  2,
  (previous: TermSnapshot, next: TermSnapshot): ReadonlyArray<SnapshotViolation> =>
    A.flatten([
      termViolations(previous, next),
      deprecationViolations(previous, next),
      bindingViolations(previous, next),
      namespaceViolations(previous, next),
    ])
);

/**
 * The packages a registry shard may project its rows into.
 *
 * **Details**
 *
 * A package that `@beep/identity` depends on cannot import the registry, so the
 * generator writes such a shard's rows into that package as plain literals.
 *
 * **Example** (Check a projection target)
 *
 * ```ts import.meta.vitest name="Check a projection target"
 * import * as S from "effect/Schema"
 * import { RegistryProjection } from "@beep/identity/Term"
 *
 * S.is(RegistryProjection)("@beep/test-runner") // => true
 * S.is(RegistryProjection)("@beep/schema") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const RegistryProjection = S.Literals(["@beep/test-runner"]).pipe(
  $I.annoteSchema("RegistryProjection", { description: "A package a registry shard projects its rows into." })
);

/**
 * Decoded type of {@link RegistryProjection}.
 *
 * @category models
 * @since 0.0.0
 */
export type RegistryProjection = typeof RegistryProjection.Type;

/**
 * A binding row of a source shard: a code identity bound to a local of the shard's namespace.
 *
 * **Example** (Bind a code identity inside a shard)
 *
 * ```ts import.meta.vitest name="Bind a code identity inside a shard"
 * import { CodeId, ReleaseVersion, ShardBinding, TermLocal } from "@beep/identity/Term"
 *
 * const binding = ShardBinding.make({
 *   code: CodeId.make("@beep/test-runner/Vitest/TestHang"),
 *   local: TermLocal.make("TestHang"),
 *   since: ReleaseVersion.make("1.0.0")
 * })
 * binding.local // => "TestHang"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShardBinding extends S.Opaque<ShardBinding, { readonly brand: unique symbol }>()(
  S.Struct({
    code: CodeId.annotateKey({ description: "Code identity of the kind today." }),
    local: TermLocal.annotateKey({ description: "Local of the shard namespace the code identity is bound to." }),
    since: ReleaseVersion.annotateKey({ description: "Vocabulary release that first published the binding." }),
  }).pipe($I.annoteSchema("ShardBinding", { description: "A source-shard binding of a code identity to a local." }))
) {}

/**
 * Encoded representation of {@link ShardBinding}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ShardBinding {
  /**
   * Encoded shard binding row.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ShardBinding.Encoded;
}

// A replacement local of the shard namespace, or "" for the namespace IRI itself.
const ShardReplacement = S.Union([TermLocal, S.Literal("")]);

/**
 * A deprecation row of a source shard, whose replacement is a local of the shard's namespace.
 *
 * **Details**
 *
 * The empty replacement `""` names the shard namespace itself, for a retired
 * namespace IRI whose successor is the namespace, not one of its terms.
 *
 * **Example** (Deprecate a re-minted term inside a shard)
 *
 * ```ts import.meta.vitest name="Deprecate a re-minted term inside a shard"
 * import * as O from "effect/Option"
 * import { ReleaseVersion, ShardDeprecation, TermIri, TermLocal } from "@beep/identity/Term"
 *
 * const deprecation = ShardDeprecation.make({
 *   term: TermIri.make("https://beep-effect.com/ns/test-utils/Vitest/TestHang"),
 *   since: ReleaseVersion.make("1.0.0"),
 *   replacement: O.some(TermLocal.make("TestHang"))
 * })
 * O.getOrThrow(deprecation.replacement) // => "TestHang"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class ShardDeprecation extends S.Opaque<ShardDeprecation, { readonly brand: unique symbol }>()(
  S.Struct({
    term: TermIri.annotateKey({ description: "The deprecated term IRI, under any namespace." }),
    since: ReleaseVersion.annotateKey({ description: "Vocabulary release that deprecated the term." }),
    replacement: S.OptionFromOptionalKey(ShardReplacement).annotateKey({
      description: 'Local of the shard namespace that succeeds the term, or "" for the namespace itself.',
    }),
  }).pipe($I.annoteSchema("ShardDeprecation", { description: "A source-shard term deprecation." }))
) {}

/**
 * Encoded representation of {@link ShardDeprecation}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ShardDeprecation {
  /**
   * Encoded shard deprecation row; an absent `replacement` key means no successor.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ShardDeprecation.Encoded;
}

const localKey = (local: TermLocal): string => local;
const shardBindingKey = (binding: ShardBinding): string => binding.code;
const shardDeprecationKey = (deprecation: ShardDeprecation): string => deprecation.term;
const isIri = S.is(IRI);

const RegistryShardFields = S.Struct({
  namespace: Namespace,
  terms: S.Array(TermLocal)
    .check(strictlyAscending(localKey, "ShardTerm"))
    .annotateKey({ description: "Live term locals, ascending." }),
  bindings: S.Array(ShardBinding)
    .check(strictlyAscending(shardBindingKey, "ShardBinding"))
    .annotateKey({ description: "Bindings of code identities to locals, ascending by code identity." }),
  deprecations: S.Array(ShardDeprecation)
    .check(strictlyAscending(shardDeprecationKey, "ShardDeprecation"))
    .annotateKey({ description: "Append-only deprecations, ascending by term." }),
  projection: S.OptionFromOptionalKey(RegistryProjection).annotateKey({
    description: "Package the shard's rows are also projected into, when one is named.",
  }),
});

const shardLocals = (shard: typeof RegistryShardFields.Type): ReadonlyArray<string> =>
  A.flatten([
    shard.terms,
    A.map(shard.bindings, (binding) => binding.local),
    A.getSomes(A.map(shard.deprecations, (deprecation) => deprecation.replacement)),
  ]);

const shardIriIssues = (shard: typeof RegistryShardFields.Type): ReadonlyArray<string> =>
  pipe(
    shardLocals(shard),
    A.filter((local) => !isIri(`${shard.namespace.iri}${local}`)),
    A.map((local) => `The namespace IRI followed by "${local}" is not an IRI.`)
  );

/**
 * One source shard of the registry: one namespace, its locals, its bindings and its deprecations.
 *
 * **Details**
 *
 * A shard is the encoded JSON file `registry/namespaces/<prefix>.json` of the
 * identity package. Every collection is strictly ascending, and every local
 * must form an IRI under the namespace, so a decoded shard always yields valid
 * terms.
 *
 * **Example** (Decode a shard)
 *
 * ```ts import.meta.vitest name="Decode a shard"
 * import * as S from "effect/Schema"
 * import { RegistryShard } from "@beep/identity/Term"
 *
 * const shard = S.decodeUnknownSync(RegistryShard)({
 *   namespace: { prefix: "fabio", iri: "http://purl.org/spar/fabio/" },
 *   terms: ["Report"],
 *   bindings: [],
 *   deprecations: []
 * })
 * shard.namespace.prefix // => "fabio"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegistryShard extends S.Opaque<RegistryShard, { readonly brand: unique symbol }>()(
  RegistryShardFields.check(
    S.makeFilter(
      shardIriIssues,
      $I.annote("RegistryShardIris", {
        title: "Registry Shard IRIs",
        description: "Every local of the shard forms an IRI under the shard namespace.",
        message: "Expected every local of the shard to form an IRI under the shard namespace.",
      })
    )
  ).pipe($I.annoteSchema("RegistryShard", { description: "One source shard of the identity registry." }))
) {}

/**
 * Encoded representation of {@link RegistryShard}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RegistryShard {
  /**
   * Encoded shard, the shape of a `registry/namespaces/<prefix>.json` file.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof RegistryShard.Encoded;
}

/**
 * Every way a set of shards fails to form one registry table.
 *
 * **Details**
 *
 * - `DuplicatePrefix` and `DuplicateNamespaceIri`: prefixes and namespace IRIs are unique.
 * - `DuplicateTermIri`: a term IRI is declared once, so contraction is an exact lookup.
 * - `NamespaceIriIsTerm`: no namespace IRI is also a term IRI, so the snapshot keeps the two apart.
 * - `TermOutsideNamespace`: a term IRI is its namespace IRI followed by its local.
 * - `DuplicateBinding`: a code identity is bound at most once.
 * - `BindingToUnknownTerm`: a binding names a live term.
 * - `DuplicateDeprecation`: a term is deprecated at most once.
 * - `DeprecatedTermLive`: a deprecated IRI is not live.
 * - `ReplacementUnknown` and `ReplacementCycle`: a replacement chain ends at a live term.
 *
 * **Example** (Make a conflict)
 *
 * ```ts import.meta.vitest name="Make a conflict"
 * import { RegistryConflict } from "@beep/identity/Term"
 *
 * const conflict = RegistryConflict.cases.DuplicatePrefix.make({ prefix: "dc", iris: [] })
 * conflict._tag // => "DuplicatePrefix"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export const RegistryConflict = S.TaggedUnion({
  DuplicatePrefix: { prefix: SafePnPrefix, iris: S.Array(IRI) },
  DuplicateNamespaceIri: { iri: IRI, prefixes: S.Array(SafePnPrefix) },
  DuplicateTermIri: { term: TermIri, namespaces: S.Array(SafePnPrefix) },
  NamespaceIriIsTerm: { iri: TermIri, namespaces: S.Array(SafePnPrefix), termNamespaces: S.Array(SafePnPrefix) },
  TermOutsideNamespace: { term: TermIri, namespace: SafePnPrefix },
  DuplicateBinding: { code: CodeId, terms: S.Array(TermIri) },
  BindingToUnknownTerm: { code: CodeId, term: TermIri },
  DuplicateDeprecation: { term: TermIri },
  DeprecatedTermLive: { term: TermIri },
  ReplacementUnknown: { term: TermIri, replacement: TermIri },
  ReplacementCycle: { term: TermIri },
}).pipe($I.annoteSchema("RegistryConflict", { description: "A reason shards do not form one registry table." }));

/**
 * Decoded type of {@link RegistryConflict}.
 *
 * @category models
 * @since 0.0.0
 */
export type RegistryConflict = typeof RegistryConflict.Type;

const Conflict = RegistryConflict.cases;

/**
 * A one-line, human-readable statement of a registry conflict.
 *
 * **Example** (Describe a conflict)
 *
 * ```ts import.meta.vitest name="Describe a conflict"
 * import { RegistryConflict, registryConflictMessage, TermIri } from "@beep/identity/Term"
 *
 * const conflict = RegistryConflict.cases.DeprecatedTermLive.make({ term: TermIri.make("http://purl.org/spar/fabio/Report") })
 * registryConflictMessage(conflict) // => "http://purl.org/spar/fabio/Report is deprecated and still declared live."
 * ```
 *
 * @category formatting
 * @since 0.0.0
 */
export const registryConflictMessage: (conflict: RegistryConflict) => string = RegistryConflict.match({
  DuplicatePrefix: ({ prefix, iris }) => `Prefix "${prefix}" is declared more than once (${A.join(iris, ", ")}).`,
  DuplicateNamespaceIri: ({ iri, prefixes }) =>
    `Namespace IRI ${iri} is declared under more than one prefix (${A.join(prefixes, ", ")}).`,
  DuplicateTermIri: ({ term, namespaces }) =>
    `Term ${term} is declared more than once (in ${A.join(namespaces, ", ")}).`,
  NamespaceIriIsTerm: ({ iri, namespaces, termNamespaces }) =>
    `${iri} is the IRI of namespace ${A.join(namespaces, ", ")} and a term of ${A.join(termNamespaces, ", ")}.`,
  TermOutsideNamespace: ({ term, namespace }) =>
    `Term ${term} is not its namespace "${namespace}" IRI followed by its local.`,
  DuplicateBinding: ({ code, terms }) => `Code identity ${code} is bound more than once (${A.join(terms, ", ")}).`,
  BindingToUnknownTerm: ({ code, term }) => `Code identity ${code} is bound to ${term}, which is not a live term.`,
  DuplicateDeprecation: ({ term }) => `Term ${term} is deprecated more than once.`,
  DeprecatedTermLive: ({ term }) => `${term} is deprecated and still declared live.`,
  ReplacementUnknown: ({ term, replacement }) =>
    `The replacement chain of ${term} reaches ${replacement}, which is neither live nor deprecated with a successor.`,
  ReplacementCycle: ({ term }) => `The replacement chain of ${term} returns to a term it already visited.`,
});

const RegistryTableFields = S.Struct({
  namespaces: S.Array(Namespace)
    .check(strictlyAscending(namespaceKey, "RegistryNamespace"))
    .annotateKey({ description: "Every namespace, ascending by prefix." }),
  terms: S.Array(Term)
    .check(strictlyAscending((term: Term) => term.iri, "RegistryTerm"))
    .annotateKey({ description: "Every live term, ascending by IRI." }),
  bindings: S.Array(TermBinding)
    .check(strictlyAscending(bindingKey, "RegistryBinding"))
    .annotateKey({ description: "Every binding, ascending by code identity." }),
  deprecations: S.Array(Deprecation)
    .check(strictlyAscending(deprecationKey, "RegistryDeprecation"))
    .annotateKey({ description: "Every deprecation, ascending by term." }),
});

type RegistryRows = typeof RegistryTableFields.Type;

const duplicateGroups = <Row>(
  rows: ReadonlyArray<Row>,
  key: (row: Row) => string
): ReadonlyArray<A.NonEmptyReadonlyArray<Row>> =>
  pipe(
    A.groupBy(rows, key),
    R.values,
    A.filter((group) => group.length > 1),
    A.sort(Order.mapInput(Order.String, (group: A.NonEmptyReadonlyArray<Row>) => key(A.headNonEmpty(group))))
  );

const sortedStrings = <Value extends string>(values: ReadonlyArray<Value>): Array<Value> =>
  A.sort(A.dedupe(values), Order.String);

const followReplacement = (
  live: HashSet.HashSet<string>,
  byTerm: HashMap.HashMap<string, Deprecation>,
  origin: TermIri,
  current: TermIri,
  seen: HashSet.HashSet<string>
): O.Option<RegistryConflict> =>
  HashSet.has(live, current)
    ? O.none()
    : HashSet.has(seen, current)
      ? Conflict.ReplacementCycle.makeOption({ term: origin })
      : pipe(
          HashMap.get(byTerm, current),
          O.flatMap((successor) => successor.replacement),
          O.match({
            onNone: () => Conflict.ReplacementUnknown.makeOption({ term: origin, replacement: current }),
            onSome: (next) => followReplacement(live, byTerm, origin, next, HashSet.add(seen, current)),
          })
        );

const registryConflicts = (rows: RegistryRows): ReadonlyArray<RegistryConflict> => {
  const live = HashSet.fromIterable(
    A.appendAll(
      A.map(rows.terms, (term) => term.iri),
      A.map(rows.namespaces, (namespace): string => namespace.iri)
    )
  );
  const namespaceByPrefix = indexBy(rows.namespaces, namespaceKey);
  const deprecationByTerm = indexBy(rows.deprecations, deprecationKey);
  return A.flatten([
    A.map(duplicateGroups(rows.namespaces, namespaceKey), (group) =>
      Conflict.DuplicatePrefix.make({
        prefix: A.headNonEmpty(group).prefix,
        iris: sortedStrings(A.map(group, (namespace) => namespace.iri)),
      })
    ),
    A.map(
      duplicateGroups(rows.namespaces, (namespace) => namespace.iri),
      (group) =>
        Conflict.DuplicateNamespaceIri.make({
          iri: A.headNonEmpty(group).iri,
          prefixes: sortedStrings(A.map(group, namespaceKey)),
        })
    ),
    A.map(
      duplicateGroups(rows.terms, (term) => term.iri),
      (group) =>
        Conflict.DuplicateTermIri.make({
          term: A.headNonEmpty(group).iri,
          namespaces: sortedStrings(A.map(group, (term) => term.namespace)),
        })
    ),
    A.filterMap(
      duplicateGroups(
        A.appendAll(
          A.map(rows.terms, (term) => ({ iri: term.iri, prefix: term.namespace, namespace: false })),
          A.map(rows.namespaces, (namespace) => ({ iri: namespace.iri, prefix: namespace.prefix, namespace: true }))
        ),
        (row) => row.iri
      ),
      (group) => {
        const [namespaces, termNamespaces] = A.partition(group, (row) =>
          row.namespace ? Result.succeed(row.prefix) : Result.fail(row.prefix)
        );
        return A.isReadonlyArrayNonEmpty(namespaces) && A.isReadonlyArrayNonEmpty(termNamespaces)
          ? Result.succeed(
              Conflict.NamespaceIriIsTerm.make({
                iri: TermIri.make(A.headNonEmpty(group).iri),
                namespaces: sortedStrings(namespaces),
                termNamespaces: sortedStrings(termNamespaces),
              })
            )
          : Result.failVoid;
      }
    ),
    pipe(
      rows.terms,
      A.filter((term) =>
        O.match(HashMap.get(namespaceByPrefix, term.namespace), {
          onNone: () => true,
          onSome: (namespace) => term.iri !== `${namespace.iri}${term.local}`,
        })
      ),
      A.map((term) => Conflict.TermOutsideNamespace.make({ term: term.iri, namespace: term.namespace }))
    ),
    A.map(duplicateGroups(rows.bindings, bindingKey), (group) =>
      Conflict.DuplicateBinding.make({
        code: A.headNonEmpty(group).code,
        terms: sortedStrings(A.map(group, (binding) => binding.term)),
      })
    ),
    pipe(
      rows.bindings,
      A.filter((binding) => !HashSet.has(live, binding.term)),
      A.map((binding) => Conflict.BindingToUnknownTerm.make({ code: binding.code, term: binding.term }))
    ),
    A.map(duplicateGroups(rows.deprecations, deprecationKey), (group) =>
      Conflict.DuplicateDeprecation.make({ term: A.headNonEmpty(group).term })
    ),
    pipe(
      rows.deprecations,
      A.filter((deprecation) => HashSet.has(live, deprecation.term)),
      A.map((deprecation) => Conflict.DeprecatedTermLive.make({ term: deprecation.term }))
    ),
    A.filterMap(rows.deprecations, (deprecation) =>
      pipe(
        deprecation.replacement,
        O.flatMap((replacement) =>
          followReplacement(live, deprecationByTerm, deprecation.term, replacement, HashSet.make(deprecation.term))
        ),
        Result.fromOption(() => deprecation)
      )
    ),
  ]);
};

const termIriOf = (namespace: Namespace, local: TermLocal): TermIri => TermIri.make(`${namespace.iri}${local}`);

const releaseParts = (release: ReleaseVersion): readonly [number, number] => {
  const [major = "0", minor = "0"] = Str.split(".")(release);
  return [Number(major), Number(minor)];
};

const nextMajor = (release: ReleaseVersion): ReleaseVersion =>
  ReleaseVersion.make(`${releaseParts(release)[0] + 1}.0.0`);

const nextMinor = (release: ReleaseVersion): ReleaseVersion => {
  const [major, minor] = releaseParts(release);
  return ReleaseVersion.make(`${major}.${minor + 1}.0`);
};

const genesisRelease = ReleaseVersion.make("1.0.0");
const snapshotEquivalence = S.toEquivalence(TermSnapshot);

const snapshotAt = (table: RegistryRows, release: ReleaseVersion): TermSnapshot =>
  Result.getOrThrow(
    TermSnapshot.fromRows({
      release,
      namespaces: table.namespaces,
      terms: A.appendAll(
        A.map(table.terms, (term) => term.iri),
        A.map(table.namespaces, (namespace) => TermIri.make(namespace.iri))
      ),
      bindings: table.bindings,
      deprecations: table.deprecations,
    })
  );

const nextRelease = (previous: TermSnapshot, unchanged: TermSnapshot): ReleaseVersion => {
  if (snapshotEquivalence(unchanged, previous)) {
    return previous.release;
  }
  if (previous.release === TermSnapshot.empty.release) {
    return genesisRelease;
  }
  const deprecated = HashSet.fromIterable(A.map(previous.deprecations, deprecationKey));
  return A.some(unchanged.deprecations, (deprecation) => !HashSet.has(deprecated, deprecation.term))
    ? nextMajor(previous.release)
    : nextMinor(previous.release);
};

/**
 * The one registry table: every namespace, live term, binding and deprecation.
 *
 * **Details**
 *
 * The table's invariants are a schema check, so decoding refuses a table with
 * a {@link RegistryConflict}. {@link RegistryTable.fromShards} is the
 * constructor the generator uses.
 *
 * **Example** (Build a table from shards)
 *
 * ```ts import.meta.vitest name="Build a table from shards"
 * import * as Result from "effect/Result"
 * import * as S from "effect/Schema"
 * import { RegistryShard, RegistryTable } from "@beep/identity/Term"
 *
 * const fabio = S.decodeUnknownSync(RegistryShard)({
 *   namespace: { prefix: "fabio", iri: "http://purl.org/spar/fabio/" },
 *   terms: ["Report"],
 *   bindings: [],
 *   deprecations: []
 * })
 * const table = Result.getOrThrow(RegistryTable.fromShards([fabio]))
 * table.terms[0]?.iri // => "http://purl.org/spar/fabio/Report"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class RegistryTable extends S.Opaque<RegistryTable, { readonly brand: unique symbol }>()(
  RegistryTableFields.check(
    S.makeFilter(
      (rows: RegistryRows) => A.map(registryConflicts(rows), registryConflictMessage),
      $I.annote("RegistryTableInvariants", {
        title: "Registry Table Invariants",
        description: "The table has no registry conflict.",
        message: "Expected a registry table with no conflict.",
      })
    )
  ).pipe($I.annoteSchema("RegistryTable", { description: "The one identity registry table." }))
) {
  /**
   * Build the table from source shards, or return every conflict they hold.
   *
   * **Details**
   *
   * Conflicts are ordered by kind and then by key, so equal shards give equal
   * results whatever their input order.
   *
   * **Example** (Refuse two shards with one prefix)
   *
   * ```ts import.meta.vitest name="Refuse two shards with one prefix"
   * import * as A from "effect/Array"
   * import * as Result from "effect/Result"
   * import * as S from "effect/Schema"
   * import { RegistryShard, RegistryTable } from "@beep/identity/Term"
   *
   * const shard = (iri: string) =>
   *   S.decodeUnknownSync(RegistryShard)({ namespace: { prefix: "ex", iri }, terms: [], bindings: [], deprecations: [] })
   * const result = RegistryTable.fromShards([shard("https://a.example/"), shard("https://b.example/")])
   * Result.isFailure(result) && A.map(result.failure, (conflict) => conflict._tag) // => ["DuplicatePrefix"]
   * ```
   *
   * @category constructors
   * @since 0.0.0
   */
  static readonly fromShards = (
    shards: Iterable<RegistryShard>
  ): Result.Result<RegistryTable, A.NonEmptyReadonlyArray<RegistryConflict>> => {
    const all = A.fromIterable(shards);
    const rows: RegistryRows = {
      namespaces: A.map(all, (shard) => shard.namespace),
      terms: A.flatMap(all, (shard) => A.map(shard.terms, (local) => Term.of(shard.namespace, local))),
      bindings: A.flatMap(all, (shard) =>
        A.map(shard.bindings, (binding) =>
          TermBinding.make({
            code: binding.code,
            term: termIriOf(shard.namespace, binding.local),
            since: binding.since,
          })
        )
      ),
      deprecations: A.flatMap(all, (shard) =>
        A.map(shard.deprecations, (deprecation) =>
          Deprecation.make({
            term: deprecation.term,
            since: deprecation.since,
            replacement: O.map(deprecation.replacement, (local) => TermIri.make(`${shard.namespace.iri}${local}`)),
          })
        )
      ),
    };
    const conflicts = registryConflicts(rows);
    return A.isReadonlyArrayNonEmpty(conflicts)
      ? Result.fail(conflicts)
      : Result.succeed(
          RegistryTable.make({
            namespaces: canonicalRows(rows.namespaces, namespaceKey),
            terms: canonicalRows(rows.terms, (term) => term.iri),
            bindings: canonicalRows(rows.bindings, bindingKey),
            deprecations: canonicalRows(rows.deprecations, deprecationKey),
          })
        );
  };

  /**
   * Project the table to the term-stability snapshot that succeeds `previous`.
   *
   * **Details**
   *
   * The snapshot's `terms` hold every live term IRI and every namespace IRI.
   * Its `release` is `previous.release` when nothing changed, `1.0.0` when
   * `previous` is the empty snapshot, the next major when the table adds a
   * deprecation and the next minor for any other change. Rows keep their own
   * `since`.
   *
   * **Example** (Take the first snapshot)
   *
   * ```ts import.meta.vitest name="Take the first snapshot"
   * import * as Result from "effect/Result"
   * import * as S from "effect/Schema"
   * import { RegistryShard, RegistryTable, TermSnapshot } from "@beep/identity/Term"
   *
   * const fabio = S.decodeUnknownSync(RegistryShard)({
   *   namespace: { prefix: "fabio", iri: "http://purl.org/spar/fabio/" },
   *   terms: ["Report"],
   *   bindings: [],
   *   deprecations: []
   * })
   * const snapshot = RegistryTable.snapshot(Result.getOrThrow(RegistryTable.fromShards([fabio])), TermSnapshot.empty)
   * snapshot.release // => "1.0.0"
   * snapshot.terms // => ["http://purl.org/spar/fabio/", "http://purl.org/spar/fabio/Report"]
   * ```
   *
   * @category projections
   * @since 0.0.0
   */
  static readonly snapshot: {
    (previous: TermSnapshot): (table: RegistryTable) => TermSnapshot;
    (table: RegistryTable, previous: TermSnapshot): TermSnapshot;
  } = dual(2, (table: RegistryTable, previous: TermSnapshot): TermSnapshot => {
    const unchanged = snapshotAt(table, previous.release);
    const release = nextRelease(previous, unchanged);
    return release === previous.release ? unchanged : snapshotAt(table, release);
  });
}

/**
 * Encoded representation of {@link RegistryTable}.
 *
 * @category type-level
 * @since 0.0.0
 */
export declare namespace RegistryTable {
  /**
   * Encoded registry table.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof RegistryTable.Encoded;
}
