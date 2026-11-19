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
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { IRI } from "./Iri.ts";
import { isSafeLocal, SafePnPrefix } from "./PnLocal.ts";
import { $IdentityId } from "./packages.ts";
import type * as Result from "effect/Result";

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
