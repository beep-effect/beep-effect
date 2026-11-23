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
 * **Gotchas**
 *
 * Canonicalization uses a stable key sort and drops adjacent exact repeats.
 * Distinct rows with one key remain for schema refusal, including repeats
 * separated by a distinct row. Snapshot terms include namespace IRIs;
 * vocabulary membership excludes those and checks namespaces separately.
 * Replacement chains end at declared terms. Namespace IRIs are neither
 * replacements nor binding targets. Release components are unbounded decimal integers, so release
 * arithmetic uses exact bigint operations.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import * as A from "effect/Array";
import * as BI from "effect/BigInt";
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
 * @category models
 * @since 0.0.0
 */
export type TermIri = typeof TermIri.Type;

/**
 * The compile-checked code identity of a kind, `@beep/<package>/<path>`, as a composer prints it.
 *
 * **Details**
 *
 * No path segment is made of dots alone, so a code identity never names a
 * path outside its package: `.` and `..` are refused, and `Library.schemas`
 * is a segment like any other.
 *
 * **Example** (Check a code identity)
 *
 * ```ts import.meta.vitest name="Check a code identity"
 * import * as S from "effect/Schema"
 * import { CodeId } from "@beep/identity/Term"
 *
 * S.is(CodeId)("@beep/test-runner/Vitest/TestHang") // => true
 * S.is(CodeId)("@beep/test-runner") // => false
 * S.is(CodeId)("@beep/test-runner/../Vitest/TestHang") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodeId = S.String.check(
  S.isPattern(
    /^@beep\/[a-z0-9][a-z0-9-]*(?:\/(?!\.+(?:\/|$))[A-Za-z0-9._-]+)+$/,
    $I.annote("CodeIdPattern", {
      title: "Code Identity",
      description:
        "A @beep package name followed by at least one module path segment, none of which is made of dots alone.",
      message: "Expected a code identity of the form @beep/<package>/<path>.",
    })
  )
).pipe(S.brand("CodeId"), $I.annoteSchema("CodeId", { description: "A code-path identity for a kind." }));

/**
 * @category models
 * @since 0.0.0
 */
export type CodeId = typeof CodeId.Type;

/**
 * The package half of a code identity, `@beep/<package>`: the prefix every code identity of the package shares.
 *
 * **Details**
 *
 * A package is never a {@link CodeId}: a binding names a kind, so a stored
 * code always has a module path. Only a {@link CodeMove} names a package.
 *
 * **Example** (Check a code package)
 *
 * ```ts import.meta.vitest name="Check a code package"
 * import * as S from "effect/Schema"
 * import { CodePackage } from "@beep/identity/Term"
 *
 * S.is(CodePackage)("@beep/test-runner") // => true
 * S.is(CodePackage)("@beep/test-runner/Vitest/TestHang") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodePackage = S.String.check(
  S.isPattern(
    /^@beep\/[a-z0-9][a-z0-9-]*$/,
    $I.annote("CodePackagePattern", {
      title: "Code Package",
      description: "A @beep package name with no module path.",
      message: "Expected a package of the form @beep/<package>.",
    })
  )
).pipe(
  S.brand("CodePackage"),
  $I.annoteSchema("CodePackage", { description: "The package prefix of a package's code identities." })
);

/**
 * @category models
 * @since 0.0.0
 */
export type CodePackage = typeof CodePackage.Type;

/**
 * **Details**
 *
 * Neither end is under the other. A move from `@beep/p/A` to `@beep/p/A/B`
 * would match the codes it moved again, so it could not be run twice, and a
 * retry after a partial write would move those codes a second time. Make such
 * a move in two moves through a third code identity that is outside both ends
 * and has no code under it, so the second move carries only the moved codes.
 *
 * **Example** (Rename a module)
 *
 * ```ts import.meta.vitest name="Rename a module"
 * import { CodeId, CodeIdMove } from "@beep/identity/Term"
 *
 * const move = CodeIdMove.make({
 *   from: CodeId.make("@beep/test-runner/Vitest"),
 *   to: CodeId.make("@beep/test-runner/Runner")
 * })
 * move.to // => "@beep/test-runner/Runner"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CodeIdMove extends S.Opaque<CodeIdMove, { readonly brand: unique symbol }>()(
  S.Struct({ from: CodeId, to: CodeId })
    .check(
      S.makeFilter(
        ({ from, to }) => !Str.startsWith(`${from}/`)(to) && !Str.startsWith(`${to}/`)(from),
        $I.annote("CodeIdMoveDisjoint", {
          title: "Code Identity Move Disjoint",
          description: "Neither end of the move is under the other, so the move never applies to a code it moved.",
          message: "Expected a move whose ends are not under one another; move through a third code identity.",
        })
      )
    )
    .pipe($I.annoteSchema("CodeIdMove", { description: "The rename of a code identity and every code under it." }))
) {}

/**
 * The rename of a package: every code identity of it moves to the new package and keeps its path.
 *
 * **Example** (Rename a package)
 *
 * ```ts import.meta.vitest name="Rename a package"
 * import { CodePackage, CodePackageMove } from "@beep/identity/Term"
 *
 * const move = CodePackageMove.make({
 *   from: CodePackage.make("@beep/test-runner"),
 *   to: CodePackage.make("@beep/test-kit")
 * })
 * move.to // => "@beep/test-kit"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class CodePackageMove extends S.Opaque<CodePackageMove, { readonly brand: unique symbol }>()(
  S.Struct({ from: CodePackage, to: CodePackage }).pipe(
    $I.annoteSchema("CodePackageMove", { description: "The rename of a package and every code identity of it." })
  )
) {}

/**
 * A rename of code identities: one code identity (with every code under it) or one whole package.
 *
 * **Details**
 *
 * Both ends are of the same kind, so a moved code always keeps a package and
 * at least one path segment: a package moves to a package, and a code
 * identity to a code identity. {@link moveCode} applies the move to one code.
 *
 * **Example** (Check the ends of a move)
 *
 * ```ts import.meta.vitest name="Check the ends of a move"
 * import * as S from "effect/Schema"
 * import { CodeMove } from "@beep/identity/Term"
 *
 * S.is(CodeMove)({ from: "@beep/test-runner", to: "@beep/test-kit" }) // => true
 * S.is(CodeMove)({ from: "@beep/test-runner/Vitest", to: "@beep/test-runner/Runner" }) // => true
 * S.is(CodeMove)({ from: "@beep/test-runner/Vitest", to: "@beep/test-kit" }) // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const CodeMove = S.Union([CodeIdMove, CodePackageMove]).pipe(
  $I.annoteSchema("CodeMove", {
    description: "A rename of a code identity and every code under it, or of every code identity of a package.",
  })
);

/**
 * @category models
 * @since 0.0.0
 */
export type CodeMove = typeof CodeMove.Type;

/**
 * The code identity a code has after a move: `to` for `from` itself, `to/<rest>` for `from/<rest>`, else itself.
 *
 * **Example** (Move a code with its package)
 *
 * ```ts import.meta.vitest name="Move a code with its package"
 * import { CodeId, CodePackage, CodePackageMove, moveCode } from "@beep/identity/Term"
 *
 * const move = CodePackageMove.make({
 *   from: CodePackage.make("@beep/test-runner"),
 *   to: CodePackage.make("@beep/test-kit")
 * })
 * moveCode(CodeId.make("@beep/test-runner/Vitest/TestHang"), move) // => "@beep/test-kit/Vitest/TestHang"
 * moveCode(CodeId.make("@beep/test-runner-ui/Vitest/TestHang"), move) // => "@beep/test-runner-ui/Vitest/TestHang"
 * ```
 *
 * @param code - The code identity to move.
 * @param move - The rename to apply.
 * @returns The moved code identity, or `code` when the move does not reach it.
 * @category combinators
 * @since 0.0.0
 */
export const moveCode: {
  (move: CodeMove): (code: CodeId) => CodeId;
  (code: CodeId, move: CodeMove): CodeId;
} = dual(
  2,
  (code: CodeId, { from, to }: CodeMove): CodeId =>
    code === from || Str.startsWith(`${from}/`)(code) ? CodeId.make(`${to}${Str.slice(Str.length(from))(code)}`) : code
);

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
 * @category models
 * @since 0.0.0
 */
export type TermLocal = typeof TermLocal.Type;

/**
 * Check whether an IRI has the shape of a namespace IRI: it ends with `/` or `#`.
 *
 * **Details**
 *
 * A {@link TermLocal} never ends with `/` or `#`, so no term IRI does, and a
 * {@link NamespaceIri} always does. A deprecated IRI of that shape is therefore
 * a retired namespace IRI, whose replacement chain ends at a namespace IRI;
 * every other deprecated IRI is a retired term, whose chain ends at a declared
 * term.
 *
 * **Example** (Tell a namespace IRI from a term IRI)
 *
 * ```ts import.meta.vitest name="Tell a namespace IRI from a term IRI"
 * import { isNamespaceShapedIri } from "@beep/identity/Term"
 *
 * isNamespaceShapedIri("http://www.w3.org/ns/prov#") // => true
 * isNamespaceShapedIri("https://beep-effect.com/ns/research-library/") // => true
 * isNamespaceShapedIri("http://www.w3.org/ns/prov#Activity") // => false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const isNamespaceShapedIri = (iri: string): boolean => Str.endsWith("/")(iri) || Str.endsWith("#")(iri);

/**
 * **Details**
 *
 * A term IRI is the namespace IRI followed by a local, with nothing between
 * them, so the namespace IRI carries the separator itself. The check is
 * {@link isNamespaceShapedIri}, which also tells a retired namespace IRI from a
 * retired term.
 *
 * **Example** (Refuse an IRI without a separator)
 *
 * ```ts import.meta.vitest name="Refuse an IRI without a separator"
 * import * as S from "effect/Schema"
 * import { NamespaceIri } from "@beep/identity/Term"
 *
 * S.is(NamespaceIri)("http://www.w3.org/ns/prov#") // => true
 * S.is(NamespaceIri)("https://example.test/old") // => false
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const NamespaceIri = IRI.check(
  S.makeFilter(
    isNamespaceShapedIri,
    $I.annote("NamespaceIriSeparator", {
      title: "Namespace IRI Separator",
      description: "A namespace IRI ends with the separator its terms follow, a slash or a hash.",
      message: "Expected a namespace IRI that ends with / or #.",
    })
  )
).pipe(
  S.brand("NamespaceIri"),
  $I.annoteSchema("NamespaceIri", { description: "An IRI that ends with the separator its terms follow." })
);

/**
 * @category models
 * @since 0.0.0
 */
export type NamespaceIri = typeof NamespaceIri.Type;

/**
 * One registry namespace: the CURIE prefix and the IRI it expands to.
 *
 * **Example** (Make a namespace)
 *
 * ```ts import.meta.vitest name="Make a namespace"
 * import { Namespace, NamespaceIri } from "@beep/identity/Term"
 *
 * const prov = Namespace.make({ prefix: "prov", iri: NamespaceIri.make("http://www.w3.org/ns/prov#") })
 * prov.prefix // => "prov"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class Namespace extends S.Opaque<Namespace, { readonly brand: unique symbol }>()(
  S.Struct({
    prefix: SafePnPrefix.annotateKey({ description: "CURIE prefix, for example prov or oa." }),
    iri: NamespaceIri.annotateKey({ description: "Namespace IRI the prefix expands to, ending with / or #." }),
  }).pipe($I.annoteSchema("Namespace", { description: "A registry namespace: prefix and IRI." }))
) {}

/**
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
 * import { Namespace, NamespaceIri, Term, TermLocal } from "@beep/identity/Term"
 *
 * const prov = Namespace.make({ prefix: "prov", iri: NamespaceIri.make("http://www.w3.org/ns/prov#") })
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
   * import { Namespace, NamespaceIri, Term, TermLocal } from "@beep/identity/Term"
   *
   * const qa = Namespace.make({ prefix: "qa", iri: NamespaceIri.make("https://beep-effect.com/ns/qa/") })
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
 * import * as Result from "effect/Result"
 * import { Namespace, NamespaceIri, ReleaseVersion, TermIri, TermSnapshot } from "@beep/identity/Term"
 *
 * const snapshot = TermSnapshot.fromRows({
 *   release: ReleaseVersion.make("1.0.0"),
 *   namespaces: [Namespace.make({ prefix: "prov", iri: NamespaceIri.make("http://www.w3.org/ns/prov#") })],
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

  /**
   * Whether a snapshot publishes a term set; the empty snapshot, at release `0.0.0`, publishes none.
   *
   * **Example** (Tell the empty snapshot from a release)
   *
   * ```ts import.meta.vitest name="Tell the empty snapshot from a release"
   * import { ReleaseVersion, TermSnapshot } from "@beep/identity/Term"
   *
   * TermSnapshot.isPublished(TermSnapshot.empty) // => false
   * TermSnapshot.isPublished(TermSnapshot.make({ ...TermSnapshot.empty, release: ReleaseVersion.make("1.0.0") })) // => true
   * ```
   *
   * @category predicates
   * @since 0.0.0
   */
  static readonly isPublished = (snapshot: TermSnapshot): boolean => snapshot.release !== TermSnapshot.empty.release;
}

/**
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
  pipe(A.fromIterable(rows), A.sort(Order.mapInput(Order.String, key)), A.dedupeAdjacent);

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
 * - `ReleaseRegressed`: the release is lower than the previous snapshot's release.
 * - `ReleaseUnderstated`: the rows changed but the release is lower than the one the change
 *   calls for (a minor bump for additions, a major bump for a new deprecation), so a
 *   different term set would ship under a release the previous snapshot already published.
 * - `ReleaseOverstated`: the release is higher than the one the change calls for, so one
 *   change would skip a release.
 * - `BindingSinceMisstated` and `DeprecationSinceMisstated`: a binding of a term the previous
 *   snapshot did not bind, or a deprecation it did not hold, records another `since` than the
 *   release the change calls for. A rebind keeps the term bound, so it keeps its `since`.
 *
 * The empty snapshot publishes nothing, so the last three are never reported against it.
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
  ReleaseRegressed: { from: ReleaseVersion, to: ReleaseVersion },
  ReleaseUnderstated: { base: ReleaseVersion, expected: ReleaseVersion, release: ReleaseVersion },
  ReleaseOverstated: { base: ReleaseVersion, expected: ReleaseVersion, release: ReleaseVersion },
  BindingSinceMisstated: { code: CodeId, term: TermIri, since: ReleaseVersion, expected: ReleaseVersion },
  DeprecationSinceMisstated: { term: TermIri, since: ReleaseVersion, expected: ReleaseVersion },
}).pipe($I.annoteSchema("SnapshotViolation", { description: "A break of the published term set (L0-3)." }));

/**
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
  ReleaseRegressed: ({ from, to }) => `The snapshot release goes back from ${from} to ${to}.`,
  ReleaseUnderstated: ({ base, expected, release }) =>
    `The snapshot changes the rows of release ${base} but is released as ${release}; the change calls for ${expected}.`,
  ReleaseOverstated: ({ base, expected, release }) =>
    `The snapshot is released as ${release}; its change to release ${base} calls for ${expected}.`,
  BindingSinceMisstated: ({ code, term, since, expected }) =>
    `The new binding of ${term} to ${code} records since ${since}; the change is release ${expected}.`,
  DeprecationSinceMisstated: ({ term, since, expected }) =>
    `The new deprecation of ${term} records since ${since}; the change is release ${expected}.`,
});

const Violation = SnapshotViolation.cases;

const indexBy = <Row, Key>(rows: ReadonlyArray<Row>, key: (row: Row) => Key): HashMap.HashMap<Key, Row> =>
  HashMap.fromIterable(A.map(rows, (row) => [key(row), row] as const));

const vocabularyTerms = (snapshot: TermSnapshot): ReadonlyArray<TermIri> => {
  const namespaceIris = HashSet.fromIterable(A.map(snapshot.namespaces, (namespace): string => namespace.iri));
  return A.filter(snapshot.terms, (term) => !HashSet.has(namespaceIris, term));
};

const termViolations = (previous: TermSnapshot, next: TermSnapshot): ReadonlyArray<SnapshotViolation> => {
  const published = HashSet.fromIterable(vocabularyTerms(next));
  const deprecated = HashSet.fromIterable(
    A.appendAll(A.map(previous.deprecations, deprecationKey), A.map(next.deprecations, deprecationKey))
  );
  const nextDeprecated = HashSet.fromIterable(A.map(next.deprecations, deprecationKey));
  return A.appendAll(
    pipe(
      vocabularyTerms(previous),
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

const releaseNumbers = (release: ReleaseVersion): readonly [bigint, bigint, bigint] => {
  const [major = "0", minor = "0", patch = "0"] = Str.split(".")(release);
  return [BigInt(major), BigInt(minor), BigInt(patch)];
};

const releaseOrder: Order.Order<ReleaseVersion> = Order.mapInput(
  Order.Tuple([Order.BigInt, Order.BigInt, Order.BigInt]),
  releaseNumbers
);
const releaseIsLower = Order.isLessThan(releaseOrder);
const latestRelease = Order.max(releaseOrder);

const nextMajor = (release: ReleaseVersion): ReleaseVersion =>
  ReleaseVersion.make(`${BI.increment(releaseNumbers(release)[0])}.0.0`);

const nextMinor = (release: ReleaseVersion): ReleaseVersion => {
  const [major, minor] = releaseNumbers(release);
  return ReleaseVersion.make(`${major}.${BI.increment(minor)}.0`);
};

const genesisRelease = ReleaseVersion.make("1.0.0");
const snapshotEquivalence = S.toEquivalence(TermSnapshot);

const nextRelease = (previous: TermSnapshot, unchanged: TermSnapshot): ReleaseVersion => {
  if (snapshotEquivalence(unchanged, previous)) {
    return previous.release;
  }
  if (!TermSnapshot.isPublished(previous)) {
    return genesisRelease;
  }
  const deprecated = HashSet.fromIterable(A.map(previous.deprecations, deprecationKey));
  return A.some(unchanged.deprecations, (deprecation) => !HashSet.has(deprecated, deprecation.term))
    ? nextMajor(previous.release)
    : nextMinor(previous.release);
};

const sinceViolations = (
  previous: TermSnapshot,
  next: TermSnapshot,
  expected: ReleaseVersion
): ReadonlyArray<SnapshotViolation> => {
  const bound = HashSet.fromIterable(A.map(previous.bindings, (binding) => binding.term));
  const deprecated = HashSet.fromIterable(A.map(previous.deprecations, (deprecation) => deprecation.term));
  return A.appendAll(
    pipe(
      next.bindings,
      A.filter((binding) => !HashSet.has(bound, binding.term) && binding.since !== expected),
      A.map(({ code, term, since }) => Violation.BindingSinceMisstated.make({ code, term, since, expected }))
    ),
    pipe(
      next.deprecations,
      A.filter((deprecation) => !HashSet.has(deprecated, deprecation.term) && deprecation.since !== expected),
      A.map(({ term, since }) => Violation.DeprecationSinceMisstated.make({ term, since, expected }))
    )
  );
};

const releaseViolations = (previous: TermSnapshot, next: TermSnapshot): ReadonlyArray<SnapshotViolation> => {
  const expected = nextRelease(previous, TermSnapshot.make({ ...next, release: previous.release }));
  const published = TermSnapshot.isPublished(previous);
  const misstated = published ? sinceViolations(previous, next, expected) : A.empty<SnapshotViolation>();
  if (releaseIsLower(next.release, previous.release)) {
    return A.append(misstated, Violation.ReleaseRegressed.make({ from: previous.release, to: next.release }));
  }
  const stated = { base: previous.release, expected, release: next.release };
  if (releaseIsLower(next.release, expected)) {
    return A.append(misstated, Violation.ReleaseUnderstated.make(stated));
  }
  return published && next.release !== expected
    ? A.append(misstated, Violation.ReleaseOverstated.make(stated))
    : misstated;
};

/**
 * Every way the rows of `next` break the term set of `previous`, whatever release `next` states.
 *
 * **When to use**
 *
 * Use to refuse a regeneration: no release repairs these breaks. {@link snapshotViolations} adds the
 * release and `since` violations, which a regeneration against the base repairs or reports.
 *
 * **Example** (Judge the rows apart from the release)
 *
 * ```ts import.meta.vitest name="Judge the rows apart from the release"
 * import * as A from "effect/Array"
 * import * as Result from "effect/Result"
 * import { ReleaseVersion, termSetViolations, TermIri, TermSnapshot } from "@beep/identity/Term"
 *
 * const activity = TermIri.make("http://www.w3.org/ns/prov#Activity")
 * const previous = Result.getOrThrow(
 *   TermSnapshot.fromRows({ release: ReleaseVersion.make("1.0.0"), namespaces: [], terms: [activity], bindings: [], deprecations: [] })
 * )
 * A.map(termSetViolations(previous, TermSnapshot.empty), (violation) => violation._tag) // => ["TermRemoved"]
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const termSetViolations: {
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
 * The result is ordered by kind (terms, deprecations, bindings, namespaces,
 * `since` values, release) and, within a kind, by the ascending row order of
 * the snapshots, so equal inputs give equal arrays.
 *
 * The release is a property of the whole change from `previous` to `next`: it
 * must be exactly the release that change calls for, and every binding or
 * deprecation the change adds records it as `since`. Against the empty
 * snapshot, which publishes nothing, a changed snapshot may state any release
 * from `1.0.0` on. An unchanged empty snapshot stays unpublished, so it
 * accepts `0.0.0`.
 *
 * **Gotchas**
 *
 * Release components are unbounded decimal integers. Ordering and arithmetic use exact
 * bigint components so adjacent releases beyond the safe integer range remain distinct.
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
 * A.map(snapshotViolations(previous, TermSnapshot.empty), (violation) => violation._tag) // => ["TermRemoved", "ReleaseRegressed"]
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
    A.appendAll(termSetViolations(previous, next), releaseViolations(previous, next))
);

/**
 * **Details**
 *
 * A package that `@beep/identity` depends on cannot import the registry, so the
 * generator writes such a shard's rows into that package as plain literals. The
 * set is closed in source: renaming such a package changes its name here and in
 * the shard's `projection` first, and `beep identity rebind` then moves its
 * bindings.
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

const ShardReplacement = S.Union([TermLocal, S.Literal("")]);

/**
 * A deprecation row of a source shard, whose replacement is a local of the shard's namespace.
 *
 * **Details**
 *
 * The empty replacement `""` names the shard namespace itself, for a retired
 * namespace IRI whose successor is the namespace, not one of its terms. The
 * table accepts it only for a deprecated IRI that ends with `/` or `#`
 * ({@link isNamespaceShapedIri}): a retired term is never succeeded by a
 * namespace IRI.
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
 * - `TermOutsideNamespace`: a term IRI is its namespace IRI followed by its local, so it never ends with the
 *   separator a {@link NamespaceIri} ends with, and no namespace IRI is also a term IRI.
 * - `DuplicateBinding`: a code identity is bound at most once.
 * - `BindingToUnknownTerm`: a binding names a declared term, never a namespace IRI.
 * - `DuplicateDeprecation`: a term is deprecated at most once.
 * - `DeprecatedTermLive`: a deprecated IRI is neither a term IRI nor a namespace IRI.
 * - `ReplacementUnknown` and `ReplacementCycle`: a retired term's replacement chain ends at a declared term,
 *   never a namespace IRI; a retired namespace IRI ({@link isNamespaceShapedIri}) ends at a declared namespace IRI.
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
  TermOutsideNamespace: { term: TermIri, namespace: SafePnPrefix },
  DuplicateBinding: { code: CodeId, terms: S.Array(TermIri) },
  BindingToUnknownTerm: { code: CodeId, term: TermIri },
  DuplicateDeprecation: { term: TermIri },
  DeprecatedTermLive: { term: TermIri },
  ReplacementUnknown: { term: TermIri, replacement: TermIri },
  ReplacementCycle: { term: TermIri },
}).pipe($I.annoteSchema("RegistryConflict", { description: "A reason shards do not form one registry table." }));

/**
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
  TermOutsideNamespace: ({ term, namespace }) =>
    `Term ${term} is not its namespace "${namespace}" IRI followed by its local.`,
  DuplicateBinding: ({ code, terms }) => `Code identity ${code} is bound more than once (${A.join(terms, ", ")}).`,
  BindingToUnknownTerm: ({ code, term }) => `Code identity ${code} is bound to ${term}, which is not a live term.`,
  DuplicateDeprecation: ({ term }) => `Term ${term} is deprecated more than once.`,
  DeprecatedTermLive: ({ term }) => `${term} is deprecated and still declared live.`,
  ReplacementUnknown: ({ term, replacement }) =>
    `The replacement chain of ${term} reaches ${replacement}, which is neither a declared ${isNamespaceShapedIri(term) ? "namespace IRI" : "term"} nor deprecated with a successor.`,
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
  successors: HashSet.HashSet<string>,
  byTerm: HashMap.HashMap<string, Deprecation>,
  origin: TermIri,
  current: TermIri,
  seen: HashSet.HashSet<string>
): O.Option<RegistryConflict> =>
  HashSet.has(successors, current)
    ? O.none()
    : HashSet.has(seen, current)
      ? Conflict.ReplacementCycle.makeOption({ term: origin })
      : pipe(
          HashMap.get(byTerm, current),
          O.flatMap((successor) => successor.replacement),
          O.match({
            onNone: () => Conflict.ReplacementUnknown.makeOption({ term: origin, replacement: current }),
            onSome: (next) => followReplacement(successors, byTerm, origin, next, HashSet.add(seen, current)),
          })
        );

const registryConflicts = (rows: RegistryRows): ReadonlyArray<RegistryConflict> => {
  const terms = HashSet.fromIterable(A.map(rows.terms, (term): string => term.iri));
  const namespaceIris = HashSet.fromIterable(A.map(rows.namespaces, (namespace): string => namespace.iri));
  const live = HashSet.union(terms, namespaceIris);
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
      A.filter((binding) => !HashSet.has(terms, binding.term)),
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
          followReplacement(
            isNamespaceShapedIri(deprecation.term) ? namespaceIris : terms,
            deprecationByTerm,
            deprecation.term,
            replacement,
            HashSet.make(deprecation.term)
          )
        ),
        Result.fromOption(() => deprecation)
      )
    ),
  ]);
};

const termIriOf = (namespace: Namespace, local: TermLocal): TermIri => TermIri.make(`${namespace.iri}${local}`);

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

const sinceValues = (table: RegistryRows): ReadonlyArray<ReleaseVersion> =>
  A.appendAll(
    A.map(table.bindings, (binding) => binding.since),
    A.map(table.deprecations, (deprecation) => deprecation.since)
  );

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
   * The release the change from `previous` to the table calls for.
   *
   * **Details**
   *
   * It is `previous.release` when nothing changed, so an unchanged empty
   * snapshot stays at `0.0.0`, unpublished. It is `1.0.0` for the first change
   * after the empty snapshot, the next major when the table adds a deprecation and
   * the next minor for any other change. It depends on the rows alone, so a
   * change made in many steps calls for the same release as the same change
   * made at once.
   *
   * **Example** (Count a change once)
   *
   * ```ts import.meta.vitest name="Count a change once"
   * import * as Effect from "effect/Effect"
   * import * as Result from "effect/Result"
   * import * as S from "effect/Schema"
   * import { RegistryShard, RegistryTable, TermSnapshot } from "@beep/identity/Term"
   *
   * const tableOf = async (terms: ReadonlyArray<string>) => {
   *   const shard = await Effect.runPromise(S.decodeUnknownEffect(RegistryShard)({
   *     namespace: { prefix: "fabio", iri: "http://purl.org/spar/fabio/" },
   *     terms,
   *     bindings: [],
   *     deprecations: []
   *   }))
   *   return Result.getOrThrow(RegistryTable.fromShards([shard]))
   * }
   * const base = RegistryTable.snapshot(await tableOf(["Report"]), TermSnapshot.empty)
   * RegistryTable.releaseAfter(await tableOf(["Article", "Report"]), base) // => "1.1.0"
   * RegistryTable.releaseAfter(await tableOf(["Article", "Report", "Thesis"]), base) // => "1.1.0"
   * ```
   *
   * @category projections
   * @since 0.0.0
   */
  static readonly releaseAfter: {
    (previous: TermSnapshot): (table: RegistryTable) => ReleaseVersion;
    (table: RegistryTable, previous: TermSnapshot): ReleaseVersion;
  } = dual(
    2,
    (table: RegistryTable, previous: TermSnapshot): ReleaseVersion =>
      nextRelease(previous, snapshotAt(table, previous.release))
  );

  /**
   * Project the table to the term-stability snapshot that succeeds `previous`.
   *
   * **Details**
   *
   * The snapshot's `terms` hold every live term IRI and every namespace IRI.
   * Its `release` is {@link RegistryTable.releaseAfter}, raised to the largest
   * `since` a row records: a row names a release that exists. Rows keep their
   * own `since`.
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
    const release = A.reduce(sinceValues(table), RegistryTable.releaseAfter(table, previous), latestRelease);
    return snapshotAt(table, release);
  });

  /**
   * Project the table to the snapshot of a registry no base has published yet, keeping the release `committed` has.
   *
   * **Details**
   *
   * Until a base publishes a term set, every row of the checkout belongs to one
   * unreleased change, so a further edit calls for no further release. The
   * snapshot keeps the release of `committed`, or takes the one
   * {@link RegistryTable.releaseAfter} gives when `committed` publishes nothing,
   * raised to the largest `since` a row records.
   *
   * **Example** (Keep the release across two edits)
   *
   * ```ts import.meta.vitest name="Keep the release across two edits"
   * import * as Result from "effect/Result"
   * import * as S from "effect/Schema"
   * import { RegistryShard, RegistryTable, TermSnapshot } from "@beep/identity/Term"
   *
   * const tableOf = (terms: ReadonlyArray<string>) =>
   *   Result.getOrThrow(RegistryTable.fromShards([S.decodeUnknownSync(RegistryShard)({
   *     namespace: { prefix: "fabio", iri: "http://purl.org/spar/fabio/" },
   *     terms,
   *     bindings: [],
   *     deprecations: []
   *   })]))
   * const first = RegistryTable.snapshotKeeping(tableOf(["Report"]), TermSnapshot.empty)
   * first.release // => "1.0.0"
   * RegistryTable.snapshotKeeping(tableOf(["Article", "Report"]), first).release // => "1.0.0"
   * ```
   *
   * @category projections
   * @since 0.0.0
   */
  static readonly snapshotKeeping: {
    (committed: TermSnapshot): (table: RegistryTable) => TermSnapshot;
    (table: RegistryTable, committed: TermSnapshot): TermSnapshot;
  } = dual(2, (table: RegistryTable, committed: TermSnapshot): TermSnapshot => {
    const kept = TermSnapshot.isPublished(committed) ? committed.release : RegistryTable.releaseAfter(table, committed);
    return snapshotAt(table, A.reduce(sinceValues(table), kept, latestRelease));
  });

  /**
   * Move the bindings a {@link CodeMove} reaches to their new code identities, keeping each term and `since`.
   *
   * **Details**
   *
   * A binding moves when its code is the move's `from` or is under `from/`; the
   * rest of the code is kept under `to/`. Terms, namespaces and deprecations
   * are untouched, so the published term set of the table's snapshot is
   * unchanged. A move onto a code that is already bound returns the
   * `DuplicateBinding` conflict.
   *
   * **When to use**
   *
   * Use after a module or package rename: the code identity follows the file
   * and the published IRI stays.
   *
   * **Example** (Rebind a module's code identities)
   *
   * ```ts import.meta.vitest name="Rebind a module's code identities"
   * import * as Result from "effect/Result"
   * import * as S from "effect/Schema"
   * import { CodeId, CodeIdMove, RegistryShard, RegistryTable } from "@beep/identity/Term"
   *
   * const vitest = S.decodeUnknownSync(RegistryShard)({
   *   namespace: { prefix: "vitest", iri: "https://beep-effect.com/ns/vitest/" },
   *   terms: ["TestHang"],
   *   bindings: [{ code: "@beep/test-runner/Vitest/TestHang", local: "TestHang", since: "2.0.0" }],
   *   deprecations: []
   * })
   * const table = Result.getOrThrow(RegistryTable.fromShards([vitest]))
   * const move = CodeIdMove.make({
   *   from: CodeId.make("@beep/test-runner/Vitest"),
   *   to: CodeId.make("@beep/test-runner/Runner")
   * })
   * const moved = RegistryTable.rebind(table, move)
   * Result.getOrThrow(moved).bindings[0]?.code // => "@beep/test-runner/Runner/TestHang"
   * ```
   *
   * @category combinators
   * @since 0.0.0
   */
  static readonly rebind: {
    (move: CodeMove): (table: RegistryTable) => Result.Result<RegistryTable, A.NonEmptyReadonlyArray<RegistryConflict>>;
    (table: RegistryTable, move: CodeMove): Result.Result<RegistryTable, A.NonEmptyReadonlyArray<RegistryConflict>>;
  } = dual(
    2,
    (table: RegistryTable, move: CodeMove): Result.Result<RegistryTable, A.NonEmptyReadonlyArray<RegistryConflict>> => {
      const rows: RegistryRows = {
        namespaces: table.namespaces,
        terms: table.terms,
        bindings: A.map(table.bindings, (binding) =>
          TermBinding.make({ code: moveCode(binding.code, move), term: binding.term, since: binding.since })
        ),
        deprecations: table.deprecations,
      };
      const conflicts = registryConflicts(rows);
      return A.isReadonlyArrayNonEmpty(conflicts)
        ? Result.fail(conflicts)
        : Result.succeed(RegistryTable.make({ ...rows, bindings: canonicalRows(rows.bindings, bindingKey) }));
    }
  );
}

/**
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
