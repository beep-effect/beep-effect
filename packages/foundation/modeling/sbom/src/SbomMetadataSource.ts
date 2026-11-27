/**
 * Manifest → CycloneDX derivation.
 *
 * **Details**
 *
 * Author parsing and repository-URL normalization are not done here: they are
 * `@beep/package-json`'s `Person.FromValue` and `Repository.browseUrl`,
 * which serve consumers with no SBOM interest at all. What lives here is the
 * part that is genuinely CycloneDX vocabulary: which manifest field becomes
 * which external-reference type, how a supplier and publisher resolve, and
 * what a purl looks like.
 *
 * Layering an explicit config file over inferred values is NOT here.
 * Precedence is release policy and the config file is the consumer's; this
 * module offers derivation and `merge`, and which side wins is the caller's
 * call.
 *
 * Everything is total. Nothing reads an ambient clock or environment: a
 * timestamp is an argument, and so is the copyright year.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SbomId } from "@beep/identity/packages";
import * as A from "effect/Array";
import { dual, pipe } from "effect/Function";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { Component, ComponentType, Contact, ExternalReference, SbomMetadata, Supplier } from "./SbomDocument.ts";
import type { Package } from "@beep/package-json/Package";
import type { Person } from "@beep/package-json/Person";
import type { ExternalReferenceType } from "./SbomDocument.ts";

const $I = $SbomId.create("SbomMetadataSource");

const purlSegments = (name: string): string =>
  pipe(
    Str.lastIndexOf("/")(name),
    O.filter((separator) => Str.startsWith("@")(name) && separator > 0),
    O.match({
      onNone: () => encodeURIComponent(name),
      onSome: (separator) =>
        `${encodeURIComponent(Str.slice(0, separator)(name))}/${encodeURIComponent(Str.slice(separator + 1)(name))}`,
    })
  );

// decision: dual-dispatch-by-subject-key
const isPackageFirst = (args: IArguments): boolean => P.hasProperty(args[0], "name");

const npmPurl = (name: string, version?: string): string => {
  const path = purlSegments(name);
  return version === undefined ? `pkg:npm/${path}` : `pkg:npm/${path}@${version}`;
};

/**
 * **Gotchas**
 *
 * A `package.json` says who wrote the software. It never says which
 * organization supplied it, who assembled the BOM, or when — so `supplier`,
 * `authors` and `timestamp` are explicit-only. Deriving them would fabricate
 * three of the seven NTIA minimum elements.
 *
 * **Example** (Validate explicit assembly metadata)
 *
 * ```ts
 * import { SbomMetadataOptions } from "@beep/sbom/SbomMetadataSource";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(SbomMetadataOptions)({ timestamp: "2026-01-01T00:00:00Z" })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class SbomMetadataOptions extends S.Opaque<SbomMetadataOptions, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The supplying organization — NTIA minimum element 1. */
    supplier: S.optionalKey(Supplier).pipe(
      $I.annoteKey("SbomMetadataOptions.supplier", {
        description: "The supplying organization — NTIA minimum element 1.",
      })
    ),
    /** Who assembled the BOM — NTIA minimum element 6. */
    authors: Contact.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("SbomMetadataOptions.authors", { description: "Who assembled the BOM — NTIA minimum element 6." })
    ),
    /** When it was assembled — NTIA minimum element 7, as an ISO 8601 string. */
    timestamp: S.optionalKey(S.String).pipe(
      $I.annoteKey("SbomMetadataOptions.timestamp", {
        description: "When it was assembled — NTIA minimum element 7, as an ISO 8601 string.",
      })
    ),
    /** The publishing entity. Falls back to the supplier, then the manifest's author. */
    publisher: S.optionalKey(S.String).pipe(
      $I.annoteKey("SbomMetadataOptions.publisher", {
        description: "The publishing entity. Falls back to the supplier, then the manifest's author.",
      })
    ),
    /** A copyright statement; {@link SbomMetadataSource.formatCopyright} builds one. */
    copyright: S.optionalKey(S.String).pipe(
      $I.annoteKey("SbomMetadataOptions.copyright", {
        description: "A copyright statement; SbomMetadataSource.formatCopyright builds one.",
      })
    ),
    /** The documentation URL, winning over the manifest's `homepage`. */
    documentationUrl: S.optionalKey(S.String).pipe(
      $I.annoteKey("SbomMetadataOptions.documentationUrl", {
        description: "The documentation URL, winning over the manifest's homepage.",
      })
    ),
    /** The root component's type. Defaults to `library`. */
    type: S.optionalKey(ComponentType).pipe(
      $I.annoteKey("SbomMetadataOptions.type", { description: "The root component's type. Defaults to library." })
    ),
  }).pipe(
    $I.annoteSchema("SbomMetadataOptions", {
      description: "What a manifest cannot supply, and the two places an explicit value wins.",
    })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SbomMetadataOptions {
  /**
   * The plain object a {@link SbomMetadataOptions} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SbomMetadataOptions.Encoded;
}

/**
 * **Example** (Validate a dependency without a resolved version)
 *
 * ```ts
 * import { ComponentInput } from "@beep/sbom/SbomMetadataSource";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(ComponentInput)({ name: "@acme/core" })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class ComponentInput extends S.Opaque<ComponentInput, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The package name, scope included. */
    name: S.String.pipe($I.annoteKey("ComponentInput.name", { description: "The package name, scope included." })),
    /**
     * Its resolved version. Absent produces a component with no version and no
     * purl version segment. An exact optional key (EF-40): a caller with no
     * version omits the key, and a present key holding `undefined` is rejected.
     */
    version: S.optionalKey(S.String).pipe(
      $I.annoteKey("ComponentInput.version", {
        description: "Its resolved version. Absent produces a component with no version and no purl version segment.",
      })
    ),
    /** An SPDX identifier or expression. */
    license: S.optionalKey(S.String).pipe(
      $I.annoteKey("ComponentInput.license", { description: "An SPDX identifier or expression." })
    ),
    /** A short description. */
    description: S.optionalKey(S.String).pipe(
      $I.annoteKey("ComponentInput.description", { description: "A short description." })
    ),
    /** The component type. Defaults to `library`. */
    type: S.optionalKey(ComponentType).pipe(
      $I.annoteKey("ComponentInput.type", { description: "The component type. Defaults to library." })
    ),
  }).pipe(
    $I.annoteSchema("ComponentInput", { description: "The fields a dependency contributes to its component entry." })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ComponentInput {
  /**
   * The plain object a {@link ComponentInput} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ComponentInput.Encoded;
}

/**
 * **Example** (Validate an explicit year range)
 *
 * ```ts
 * import { CopyrightYears } from "@beep/sbom/SbomMetadataSource";
 * import * as S from "effect/Schema";
 *
 * console.log(S.is(CopyrightYears)({ startYear: 2020, year: 2026 })) // true
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export class CopyrightYears extends S.Opaque<CopyrightYears, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The first year of the range. Omit for a single-year statement. */
    startYear: S.optionalKey(S.Finite).pipe(
      $I.annoteKey("CopyrightYears.startYear", {
        description: "The first year of the range. Omit for a single-year statement.",
      })
    ),
    /** The year the statement is current through, supplied by the caller. */
    year: S.Finite.pipe(
      $I.annoteKey("CopyrightYears.year", {
        description: "The year the statement is current through, supplied by the caller.",
      })
    ),
  }).pipe($I.annoteSchema("CopyrightYears", { description: "The years a copyright statement spans." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace CopyrightYears {
  /**
   * The plain object a {@link CopyrightYears} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof CopyrightYears.Encoded;
}

const contactOf = (person: Person): Contact.Encoded => ({
  name: person.name,
  ...(person.email !== undefined && { email: person.email }),
});

const authorsOf = (pkg: Package): O.Option<ReadonlyArray<Contact.Encoded>> =>
  pipe(
    O.fromUndefinedOr(pkg.maintainers),
    O.filter(A.isReadonlyArrayNonEmpty),
    O.map(A.map(contactOf)),
    O.orElse(() => O.map(O.fromUndefinedOr(pkg.author), (author) => A.of(contactOf(author))))
  );

const referenceTo =
  (type: ExternalReferenceType) =>
  (url: string): ExternalReference.Encoded => ({ type, url });

const referenceRecords = (
  pkg: Package,
  options: SbomMetadataOptions.Encoded | undefined
): ReadonlyArray<ExternalReference.Encoded> => {
  const documentation = O.fromUndefinedOr(options?.documentationUrl ?? pkg.homepage);
  return A.getSomes([
    O.map(
      O.flatMap(O.fromUndefinedOr(pkg.repository), (repository) => repository.browseUrl),
      referenceTo("vcs")
    ),
    O.map(O.fromUndefinedOr(pkg.bugs?.url), referenceTo("issue-tracker")),
    O.map(documentation, referenceTo("documentation")),
    pipe(
      O.fromUndefinedOr(options?.supplier?.url),
      O.flatMap(A.head),
      O.filter((website) => !O.exists(documentation, (url) => url === website)),
      O.map(referenceTo("website"))
    ),
  ]);
};

const externalReferences: {
  (pkg: Package, options?: SbomMetadataOptions.Encoded): ReadonlyArray<ExternalReference>;
  (options?: SbomMetadataOptions.Encoded): (pkg: Package) => ReadonlyArray<ExternalReference>;
} = dual(
  isPackageFirst,
  (pkg: Package, options?: SbomMetadataOptions.Encoded): ReadonlyArray<ExternalReference> =>
    A.map(referenceRecords(pkg, options), (reference) => ExternalReference.make(reference))
);

const componentFor = (input: ComponentInput.Encoded): Component => {
  const bomRef = input.version === undefined ? input.name : `${input.name}@${input.version}`;
  return Component.make({
    type: input.type ?? "library",
    name: input.name,
    ...(input.version !== undefined && { version: input.version }),
    purl: npmPurl(input.name, input.version),
    ...(Str.isNonEmpty(bomRef) && { bomRef }),
    ...(input.description !== undefined && { description: input.description }),
    ...(input.license !== undefined && { licenses: [input.license] }),
  });
};

const manifestFields = (pkg: Package) => ({
  ...(pkg.description !== undefined && { description: pkg.description }),
  ...(pkg.license !== undefined && { licenses: A.of(pkg.license) }),
  ...(pkg.keywords !== undefined && A.isReadonlyArrayNonEmpty(pkg.keywords) && { tags: pkg.keywords }),
});

const attributionFields = (pkg: Package, options: SbomMetadataOptions.Encoded | undefined) => {
  const references = referenceRecords(pkg, options);
  const authors = pipe(pkg, authorsOf, O.getOrUndefined);
  const publisher = publisherOf(pkg, options);
  return {
    ...(A.isReadonlyArrayNonEmpty(references) && { externalReferences: references }),
    ...(authors !== undefined && { authors }),
    ...(publisher !== undefined && { publisher }),
    ...(options?.copyright !== undefined && { copyright: options.copyright }),
  };
};

const publisherOf = (pkg: Package, options: SbomMetadataOptions.Encoded | undefined): string | undefined =>
  options?.publisher ?? options?.supplier?.name ?? pkg.author?.name;

const rootComponent: {
  (pkg: Package, options?: SbomMetadataOptions.Encoded): Component;
  (options?: SbomMetadataOptions.Encoded): (pkg: Package) => Component;
} = dual(isPackageFirst, (pkg: Package, options?: SbomMetadataOptions.Encoded): Component => {
  const version = pkg.version.toString();
  return Component.make({
    type: options?.type ?? "library",
    name: pkg.name,
    version,
    purl: npmPurl(pkg.name, version),
    bomRef: `${pkg.name}@${version}`,
    ...manifestFields(pkg),
    ...attributionFields(pkg, options),
  });
});

const supplierRecord = (supplier: Supplier.Encoded, pkg: Package): Supplier.Encoded => {
  const contact = supplier.contact ?? pipe(pkg, authorsOf, O.getOrUndefined);
  return {
    name: supplier.name,
    ...(supplier.url !== undefined && { url: supplier.url }),
    ...(contact !== undefined && { contact }),
  };
};

const fromPackage: {
  (pkg: Package, options?: SbomMetadataOptions.Encoded): SbomMetadata;
  (options?: SbomMetadataOptions.Encoded): (pkg: Package) => SbomMetadata;
} = dual(
  isPackageFirst,
  (pkg: Package, options?: SbomMetadataOptions.Encoded): SbomMetadata =>
    SbomMetadata.make({
      ...(options?.timestamp !== undefined && { timestamp: options.timestamp }),
      ...(options?.authors !== undefined && { authors: options.authors }),
      ...(options?.supplier !== undefined && { supplier: supplierRecord(options.supplier, pkg) }),
    })
);

const formatCopyright: {
  (holder: string, years: CopyrightYears.Encoded): string;
  (years: CopyrightYears.Encoded): (holder: string) => string;
} = dual(2, (holder: string, years: CopyrightYears.Encoded): string =>
  years.startYear === undefined || years.startYear === years.year
    ? `Copyright ${years.year} ${holder}`
    : `Copyright ${years.startYear}-${years.year} ${holder}`
);

const merge: {
  (base: SbomMetadata, override: SbomMetadata): SbomMetadata;
  (override: SbomMetadata): (base: SbomMetadata) => SbomMetadata;
} = dual(2, (base: SbomMetadata, override: SbomMetadata): SbomMetadata => {
  const timestamp = override.timestamp ?? base.timestamp;
  const authors = override.authors ?? base.authors;
  const component = override.component ?? base.component;
  const supplier = override.supplier ?? base.supplier;
  return SbomMetadata.make({
    ...(timestamp !== undefined && { timestamp }),
    ...(authors !== undefined && { authors }),
    ...(component !== undefined && { component }),
    ...(supplier !== undefined && { supplier }),
  });
});

/**
 * Derivation of CycloneDX metadata from a `package.json` manifest.
 *
 * **Example** (Generate an SBOM from package metadata and an explicit supplier)
 *
 * ```ts
 * import { Package } from "@beep/package-json/Package";
 * import { Sbom } from "@beep/sbom/Sbom";
 * import { SbomMetadataSource } from "@beep/sbom/SbomMetadataSource";
 * import { Supplier } from "@beep/sbom/SbomDocument";
 * import * as Effect from "effect/Effect";
 *
 * const program = Effect.gen(function* () {
 *   const pkg = yield* Package.decode({ name: "@acme/app", version: "1.0.0", license: "MIT" });
 *   const supplier = Supplier.make({ name: "Acme Inc." });
 *   const root = SbomMetadataSource.rootComponent(pkg, { supplier });
 *   const metadata = SbomMetadataSource.fromPackage(pkg, { supplier, timestamp: "2026-01-01T00:00:00Z" });
 *   return Sbom.generate({ root, components: [], metadata });
 * });
 *
 * console.log(Effect.isEffect(program)) // true
 * ```
 *
 * @public
 * @category utilities
 * @since 0.0.0
 */
export class SbomMetadataSource {
  private constructor() {}

  /**
   * The canonical npm package URL for a name and optional version.
   *
   * **Details**
   *
   * The NTIA's "unique identifier" element, and the identifier an in-toto
   * subject names. Exposed because a caller assembling its own components —
   * or a statement subject — needs the same encoding this module applies.
   *
   * **Gotchas**
   *
   * For npm, an `@scope` is the purl namespace, not part of the name. The
   * canonical form is `pkg:npm/%40angular/animation@12.3.1`: the `@`
   * percent-encoded, the separating slash kept literal, which is the
   * package-url spec's own roundtrip vector (`tests/types/npm-test.json`) and
   * what its npm type definition states. Encoding the whole name with
   * `encodeURIComponent` would collapse that slash to `%2F`, which parses back
   * as a namespace-less name and is not a canonical purl.
   *
   * Versions pass through verbatim: every character semver permits
   * (`0-9A-Za-z.+-`) is a legal RFC 3986 path character (`+` is a sub-delim),
   * so encoding them would produce a longer string meaning the same thing and
   * matching no published example.
   *
   * **Example** (Encode a scoped npm identifier)
   *
   * ```ts
   * import { SbomMetadataSource } from "@beep/sbom/SbomMetadataSource";
   *
   * console.log(SbomMetadataSource.npmPurl("@acme/core", "1.2.3")) // pkg:npm/%40acme/core@1.2.3
   * ```
   *
   * @since 0.0.0
   */
  static readonly npmPurl = npmPurl;

  /**
   * A component entry for one resolved dependency.
   *
   * **Details**
   *
   * The caller assembles the component list — the kit has no second merge
   * rule for sibling packages released in the same wave, because which
   * versions are in flight is release planning and the effected `workspaces`
   * module already knows it. This is the mapping that would otherwise be
   * re-derived at every call site.
   *
   * **Gotchas**
   *
   * A nameless, unversioned input gets no `bomRef` rather than failing the
   * admission: `bomRef` is non-empty by schema (CycloneDX `refType`).
   *
   * **Example** (Derive an unversioned dependency component)
   *
   * ```ts
   * import { SbomMetadataSource } from "@beep/sbom/SbomMetadataSource";
   *
   * const component = SbomMetadataSource.componentFor({ name: "@acme/core" });
   * console.log(component.purl) // pkg:npm/%40acme/core
   * ```
   *
   * @since 0.0.0
   */
  static readonly componentFor = componentFor;

  /**
   * The root component the BOM is about, derived from its own manifest.
   *
   * **Details**
   *
   * `publisher` resolves explicit → supplier name → the manifest's author,
   * which is what lets NTIA element 6 be satisfied from a manifest alone.
   *
   * **Example** (Derive the root package identifier)
   *
   * ```ts
   * import { SbomMetadataSource } from "@beep/sbom/SbomMetadataSource";
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "@acme/app", version: "1.0.0", license: "MIT", homepage: "https://example.com/docs" }));
   *
   * console.log(SbomMetadataSource.rootComponent(pkg).bomRef) // @acme/app@1.0.0
   * ```
   *
   * @since 0.0.0
   */
  static readonly rootComponent = rootComponent;

  /**
   * The manifest's outward links, as CycloneDX external references.
   *
   * **Details**
   *
   * Four of the specification's 43 types, one per manifest field, in this
   * order: `vcs` ← `repository`, `issue-tracker` ← `bugs`, `documentation` ←
   * `homepage`, `website` ← the supplier's first URL. An email-only `bugs`
   * entry is legal npm and yields no `issue-tracker`; a supplier URL equal to
   * the documentation link yields no `website`.
   *
   * A `repository` value the package-json model cannot interpret produces
   * **no** reference rather than a passed-through string: CycloneDX's
   * `externalReference.url` is a URL, and emitting `owner/name` there is a
   * document that validates and misleads.
   *
   * **Example** (Map a homepage to a documentation reference)
   *
   * ```ts
   * import { SbomMetadataSource } from "@beep/sbom/SbomMetadataSource";
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "@acme/app", version: "1.0.0", license: "MIT", homepage: "https://example.com/docs" }));
   *
   * console.log(SbomMetadataSource.externalReferences(pkg)[0]?.type) // documentation
   * ```
   *
   * @since 0.0.0
   */
  static readonly externalReferences = externalReferences;

  /**
   * Document-level metadata for a manifest.
   *
   * **Details**
   *
   * The root component is **not** on the returned value: `Sbom.generate`
   * threads its `root` argument onto the metadata itself, so setting it
   * here would only be overwritten. Build the root with
   * {@link SbomMetadataSource.rootComponent} and pass both.
   *
   * When the caller supplies a supplier with no contacts, the manifest's
   * maintainers fill them — the one derivation that crosses from manifest
   * vocabulary into supplier vocabulary, and only where the caller left a
   * hole.
   *
   * `pkg` is a `@beep/package-json` `Package`; callers import the type from
   * `@beep/package-json` directly (this entry point no longer re-exports it).
   *
   * **Example** (Keep assembly time explicit)
   *
   * ```ts
   * import { SbomMetadataSource } from "@beep/sbom/SbomMetadataSource";
   * import { Package } from "@beep/package-json/Package";
   * import * as Effect from "effect/Effect";
   *
   * const pkg = Effect.runSync(Package.decode({ name: "@acme/app", version: "1.0.0", license: "MIT", homepage: "https://example.com/docs" }));
   *
   * const metadata = SbomMetadataSource.fromPackage(pkg, { timestamp: "2026-01-01T00:00:00Z" });
   * console.log(metadata.timestamp) // 2026-01-01T00:00:00Z
   * ```
   *
   * @since 0.0.0
   */
  static readonly fromPackage = fromPackage;

  /**
   * A copyright statement for a holder and a year, or a span of years.
   *
   * **Details**
   *
   * The year is an **argument**: nothing here reads the clock, so the output is
   * deterministic. Read the ambient year at the caller's edge.
   *
   * **Example** (Format a caller-supplied year range)
   *
   * ```ts
   * import { SbomMetadataSource } from "@beep/sbom/SbomMetadataSource";
   *
   * console.log(SbomMetadataSource.formatCopyright("Acme Inc.", { startYear: 2020, year: 2026 })) // Copyright 2020-2026 Acme Inc.
   * ```
   *
   * @since 0.0.0
   */
  static readonly formatCopyright = formatCopyright;

  /**
   * Field-wise metadata merge: every field the override carries wins.
   *
   * **Details**
   *
   * A helper, not a policy. Which side is the override — a config file over
   * inferred values, or the reverse — is the consumer's precedence rule,
   * and a library that decided it would be encoding one repository's
   * release policy.
   *
   * **Example** (Override the assembly timestamp)
   *
   * ```ts
   * import { SbomMetadataSource } from "@beep/sbom/SbomMetadataSource";
   * import { SbomMetadata } from "@beep/sbom/SbomDocument";
   *
   * const base = SbomMetadata.make({ timestamp: "2025-01-01T00:00:00Z" });
   * const override = SbomMetadata.make({ timestamp: "2026-01-01T00:00:00Z" });
   * console.log(SbomMetadataSource.merge(base, override).timestamp) // 2026-01-01T00:00:00Z
   * ```
   *
   * @since 0.0.0
   */
  static readonly merge = merge;
}
