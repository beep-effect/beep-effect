/**
 * L0 identity: declared terms, namespaces as prefix and IRI, term bindings,
 * deprecations and the term-stability snapshot.
 *
 * Owner package: `@beep/identity`, which depends on effect only (decision
 * 2026-11-19-p0-l0-split-by-dependency). This file therefore imports only
 * `effect/*` and `@beep/identity/*`, the RFC 3987 schemas included
 * (`@beep/identity/Iri`). The version field is a branded string with a
 * local pattern check, and any literal domain here uses `S.Literals`, the
 * standing exception for the bottom package the schema package itself depends
 * on; the registry test cross-checks both against the schema package's
 * version and literal schemas as a test dependency. Namespace pins live in L6 (`@beep/rdf`), gUFO typing in L3
 * (`@beep/ontology`), digests and minting in `L0.digest.ts`.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IRI } from "@beep/identity/Iri";
import { SafePnLocal, SafePnPrefix } from "@beep/identity/PnLocal";
import { $RepoCliId } from "@beep/identity/packages";
import { dual } from "effect/Function";
import * as HashSet from "effect/HashSet";
import * as S from "effect/Schema";

const $I = $RepoCliId.create("goals/text-knowledge-stack-rebuild/ops/design/L0.identity");

/** A published term IRI, declared in the registry under `https://beep-effect.com/ns/` and never derived from a code path. */
export const TermIri = IRI.pipe(
  S.brand("TermIri"),
  $I.annoteSchema("TermIri", { description: "A registry-declared term IRI." })
);

/** Decoded type of {@link TermIri}. */
export type TermIri = typeof TermIri.Type;

/** The compile-checked code identity of a kind, `@beep/<package>/<path>`, as an `$I` composer prints it. */
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

/** Decoded type of {@link CodeId}. */
export type CodeId = typeof CodeId.Type;

/**
 * A vocabulary release `major.minor.patch` of the term snapshot, not a package
 * version: the snapshot writer bumps the minor on additions and the major on
 * deprecations, and existing rows keep theirs. Checked locally because identity
 * cannot import the schema package's `SemanticVersion`; the schema package's tests
 * check the pattern against that schema.
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

/** Decoded type of {@link ReleaseVersion}. */
export type ReleaseVersion = typeof ReleaseVersion.Type;

/** One registry namespace: the prefix and the IRI it expands to. Its pin is an L6 `NamespacePin` keyed by prefix. */
export class Namespace extends S.Opaque<Namespace, { readonly brand: unique symbol }>()(
  S.Struct({
    prefix: SafePnPrefix.annotateKey({ description: "CURIE prefix, for example prov or oa." }),
    iri: IRI.annotateKey({ description: "Namespace IRI the prefix expands to." }),
  }).pipe($I.annoteSchema("Namespace", { description: "A registry namespace: prefix and IRI." }))
) {}

/** One declared term of a registry namespace. Its optional gUFO typing is an L3 record keyed by term IRI. */
export class Term extends S.Opaque<Term, { readonly brand: unique symbol }>()(
  S.Struct({
    iri: TermIri,
    namespace: SafePnPrefix.annotateKey({ description: "Prefix of the namespace that declares the term." }),
    local: SafePnLocal.annotateKey({ description: "Local name inside the namespace." }),
  }).pipe($I.annoteSchema("Term", { description: "A registry term: IRI, namespace and local name." }))
) {}

/** A row of the binding table that pins a code identity to its published term; a module rename edits `code`, never `term`. */
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

/** The record that alone may remove or change a published term. */
export class Deprecation extends S.Opaque<Deprecation, { readonly brand: unique symbol }>()(
  S.Struct({
    term: TermIri.annotateKey({ description: "The deprecated term." }),
    since: ReleaseVersion.annotateKey({ description: "Vocabulary release that deprecated the term." }),
    replacement: S.OptionFromOptionalKey(TermIri).annotateKey({ description: "Successor term, when one exists." }),
  }).pipe($I.annoteSchema("Deprecation", { description: "A term deprecation with its optional successor." }))
) {}

/** The term-stability snapshot: the published term set (module-derived IRIs included) and the deprecations that explain removals. */
export class TermSnapshot extends S.Opaque<TermSnapshot, { readonly brand: unique symbol }>()(
  S.Struct({
    version: S.tag("term-snapshot/v1"),
    terms: S.HashSet(TermIri).annotateKey({ description: "Every published term IRI." }),
    deprecations: S.HashSet(Deprecation).annotateKey({ description: "Deprecation records of retired terms." }),
  }).pipe($I.annoteSchema("TermSnapshot", { description: "Snapshot of the published term set (L0-3)." }))
) {}

/** L0-3: the terms of `previous` that `next` no longer publishes and that no deprecation record in `next` explains. */
export const unexplainedRemovals: {
  (next: TermSnapshot): (previous: TermSnapshot) => HashSet.HashSet<TermIri>;
  (previous: TermSnapshot, next: TermSnapshot): HashSet.HashSet<TermIri>;
} = dual(
  2,
  (previous: TermSnapshot, next: TermSnapshot): HashSet.HashSet<TermIri> =>
    HashSet.filter(
      HashSet.difference(previous.terms, next.terms),
      (term) => !HashSet.some(next.deprecations, (deprecation) => deprecation.term === term)
    )
);
