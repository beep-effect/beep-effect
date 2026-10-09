// Manifest → CycloneDX derivation.
//
// Author parsing and repository-URL normalization are not done here: they are
// `@effected/package-json`'s `Person.FromValue` and `Repository.browseUrl`,
// which serve consumers with no SBOM interest at all. What lives here is the
// part that is genuinely CycloneDX vocabulary: which manifest field becomes
// which external-reference type, how a supplier and publisher resolve, and
// what a purl looks like.
//
// Layering an explicit config file over inferred values is NOT here.
// Precedence is release policy and the config file is the consumer's; this
// module offers derivation and `merge`, and which side wins is the caller's
// call.
//
// Everything is total. Nothing reads an ambient clock or environment: a
// timestamp is an argument, and so is the copyright year.

import type { Package, Person } from "../package-json/index.ts";
import * as O from "effect/Option";
import type { ComponentType } from "./SbomDocument.ts";
import { Component, Contact, ExternalReference, SbomMetadata, Supplier } from "./SbomDocument.ts";

// ── Package URL ───────────────────────────────────────────────────────────
//
// For npm, an `@scope` is the purl NAMESPACE, not part of the name. The
// canonical form is `pkg:npm/%40angular/animation@12.3.1` — the `@`
// percent-encoded, the separating slash kept literal — which is the
// package-url spec's own roundtrip vector (`tests/types/npm-test.json`) and
// what its npm type definition states ("the npm scope @ sign prefix is always
// percent encoded"). Encoding the whole name with `encodeURIComponent` would
// collapse that slash to `%2F`, which parses back as a namespace-less name and
// is not a canonical purl.
//
// Versions pass through verbatim: every character semver permits
// (`0-9A-Za-z.+-`) is a legal RFC 3986 path character — `+` is a sub-delim — so
// encoding them would produce a longer string meaning the same thing and
// matching no published example.

/** The purl namespace and name segments for an npm package name. */
const purlSegments = (name: string): string => {
	const separator = name.lastIndexOf("/");
	if (!name.startsWith("@") || separator <= 0) return encodeURIComponent(name);
	return `${encodeURIComponent(name.slice(0, separator))}/${encodeURIComponent(name.slice(separator + 1))}`;
};

// Implementation of SbomMetadataSource.npmPurl; the public contract lives on the static.
const npmPurl = (name: string, version?: string): string => {
	const path = purlSegments(name);
	return version === undefined ? `pkg:npm/${path}` : `pkg:npm/${path}@${version}`;
};

/**
 * What a manifest cannot supply, and the two places an explicit value wins.
 *
 * @remarks
 * A `package.json` says who wrote the software. It never says which
 * organization supplied it, who assembled the BOM, or when — so `supplier`,
 * `authors` and `timestamp` are explicit-only. Deriving them would fabricate
 * three of the seven NTIA minimum elements.
 *
 * @public
 */
export interface SbomMetadataOptions {
	/** The supplying organization — NTIA minimum element 1. */
	readonly supplier?: Supplier | undefined;
	/** Who assembled the BOM — NTIA minimum element 6. */
	readonly authors?: ReadonlyArray<Contact> | undefined;
	/** When it was assembled — NTIA minimum element 7, as an ISO 8601 string. */
	readonly timestamp?: string | undefined;
	/** The publishing entity. Falls back to the supplier, then the manifest's author. */
	readonly publisher?: string | undefined;
	/** A copyright statement; {@link SbomMetadataSource.formatCopyright} builds one. */
	readonly copyright?: string | undefined;
	/** The documentation URL, winning over the manifest's `homepage`. */
	readonly documentationUrl?: string | undefined;
	/** The root component's type. Defaults to `library`. */
	readonly type?: ComponentType | undefined;
}

/**
 * The fields a dependency contributes to its component entry.
 *
 * @public
 */
export interface ComponentInput {
	/** The package name, scope included. */
	readonly name: string;
	/**
	 * Its resolved version. Absent produces a component with no version and no
	 * purl version segment. Typed `string | undefined` so a caller forwarding a
	 * statically optional version (e.g. `WorkspacePackage.version` from
	 * `@effected/workspaces`) compiles under `exactOptionalPropertyTypes`.
	 */
	readonly version?: string | undefined;
	/** An SPDX identifier or expression. */
	readonly license?: string | undefined;
	/** A short description. */
	readonly description?: string | undefined;
	/** The component type. Defaults to `library`. */
	readonly type?: ComponentType | undefined;
}

/**
 * The years a copyright statement spans.
 *
 * @public
 */
export interface CopyrightYears {
	/** The first year of the range. Omit for a single-year statement. */
	readonly startYear?: number | undefined;
	/** The year the statement is current through, supplied by the caller. */
	readonly year: number;
}

const contactOf = (person: Person): Contact =>
	Contact.make({
		name: person.name,
		...(person.email !== undefined && { email: person.email }),
	});

/** The manifest's authors: its maintainers, or its lone author when it lists none. */
const authorsOf = (pkg: Package): ReadonlyArray<Contact> | undefined => {
	if (pkg.maintainers !== undefined && pkg.maintainers.length > 0) return pkg.maintainers.map(contactOf);
	return pkg.author === undefined ? undefined : [contactOf(pkg.author)];
};

/** The supplier's first URL, which becomes a `website` reference when it says something new. */
const supplierUrl = (options: SbomMetadataOptions | undefined): string | undefined => options?.supplier?.url?.[0];

const documentationUrl = (pkg: Package, options: SbomMetadataOptions | undefined): string | undefined =>
	options?.documentationUrl ?? pkg.homepage;

// Implementation of SbomMetadataSource.externalReferences; the public contract lives on the static.
const externalReferences = (pkg: Package, options?: SbomMetadataOptions): ReadonlyArray<ExternalReference> => {
	const references: Array<ExternalReference> = [];

	const vcs = pkg.repository === undefined ? O.none<string>() : pkg.repository.browseUrl;
	if (O.isSome(vcs)) references.push(ExternalReference.make({ type: "vcs", url: vcs.value }));

	// An email-only `bugs` entry is legal npm and carries no URL to point at.
	if (pkg.bugs?.url !== undefined) {
		references.push(ExternalReference.make({ type: "issue-tracker", url: pkg.bugs.url }));
	}

	const documentation = documentationUrl(pkg, options);
	if (documentation !== undefined) {
		references.push(ExternalReference.make({ type: "documentation", url: documentation }));
	}

	const website = supplierUrl(options);
	if (website !== undefined && website !== documentation) {
		references.push(ExternalReference.make({ type: "website", url: website }));
	}

	return references;
};

// Implementation of SbomMetadataSource.componentFor; the public contract lives on the static.
const componentFor = (input: ComponentInput): Component =>
	Component.make({
		type: input.type ?? "library",
		name: input.name,
		...(input.version !== undefined && { version: input.version }),
		purl: npmPurl(input.name, input.version),
		bomRef: input.version === undefined ? input.name : `${input.name}@${input.version}`,
		...(input.description !== undefined && { description: input.description }),
		...(input.license !== undefined && { licenses: [input.license] }),
	});

// Implementation of SbomMetadataSource.rootComponent; the public contract lives on the static.
const rootComponent = (pkg: Package, options?: SbomMetadataOptions): Component => {
	const version = pkg.version.toString();
	const references = externalReferences(pkg, options);
	const authors = authorsOf(pkg);
	const publisher = options?.publisher ?? options?.supplier?.name ?? pkg.author?.name;

	return Component.make({
		type: options?.type ?? "library",
		name: pkg.name,
		version,
		purl: npmPurl(pkg.name, version),
		bomRef: `${pkg.name}@${version}`,
		...(pkg.description !== undefined && { description: pkg.description }),
		...(pkg.license !== undefined && { licenses: [pkg.license] }),
		...(references.length > 0 && { externalReferences: references }),
		...(pkg.keywords !== undefined && pkg.keywords.length > 0 && { tags: pkg.keywords }),
		...(authors !== undefined && { authors }),
		...(publisher !== undefined && { publisher }),
		...(options?.copyright !== undefined && { copyright: options.copyright }),
	});
};

// Implementation of SbomMetadataSource.fromPackage; the public contract lives on the static.
const fromPackage = (pkg: Package, options?: SbomMetadataOptions): SbomMetadata => {
	const supplier = options?.supplier;
	const contacts = supplier?.contact ?? authorsOf(pkg);
	const resolved =
		supplier === undefined
			? undefined
			: Supplier.make({
					name: supplier.name,
					...(supplier.url !== undefined && { url: supplier.url }),
					...(contacts !== undefined && { contact: contacts }),
				});

	return SbomMetadata.make({
		...(options?.timestamp !== undefined && { timestamp: options.timestamp }),
		...(options?.authors !== undefined && { authors: options.authors }),
		...(resolved !== undefined && { supplier: resolved }),
	});
};

// Implementation of SbomMetadataSource.formatCopyright; the public contract lives on the static.
const formatCopyright = (holder: string, years: CopyrightYears): string =>
	years.startYear === undefined || years.startYear === years.year
		? `Copyright ${years.year} ${holder}`
		: `Copyright ${years.startYear}-${years.year} ${holder}`;

// Implementation of SbomMetadataSource.merge; the public contract lives on the static.
const merge = (base: SbomMetadata, override: SbomMetadata): SbomMetadata => {
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
};

/**
 * Derivation of CycloneDX metadata from a `package.json` manifest.
 *
 * @example
 * ```ts
 * import { Package, Sbom, SbomMetadataSource, Supplier } from "./index.ts";
 * import { Effect } from "effect";
 *
 * const program = Effect.gen(function* () {
 *   const pkg = yield* Package.decode({ name: "@acme/app", version: "1.0.0", license: "MIT" });
 *   const supplier = Supplier.make({ name: "Acme Inc." });
 *   const root = SbomMetadataSource.rootComponent(pkg, { supplier });
 *   const metadata = SbomMetadataSource.fromPackage(pkg, { supplier, timestamp: "2026-01-01T00:00:00Z" });
 *   return Sbom.generate({ root, components: [], metadata });
 * });
 * ```
 *
 * @public
 */
export class SbomMetadataSource {
	private constructor() {}

	/**
	 * The canonical npm package URL for a name and optional version.
	 *
	 * @remarks
	 * The NTIA's "unique identifier" element, and the identifier an in-toto
	 * subject names. Exposed because a caller assembling its own components —
	 * or a statement subject — needs the same encoding this module applies.
	 */
	static readonly npmPurl = npmPurl;

	/**
	 * A component entry for one resolved dependency.
	 *
	 * @remarks
	 * The caller assembles the component list — the kit has no second merge
	 * rule for sibling packages released in the same wave, because which
	 * versions are in flight is release planning and `@effected/workspaces`
	 * already knows it. This is the mapping that would otherwise be
	 * re-derived at every call site.
	 */
	static readonly componentFor = componentFor;

	/**
	 * The root component the BOM is about, derived from its own manifest.
	 *
	 * @remarks
	 * `publisher` resolves explicit → supplier name → the manifest's author,
	 * which is what lets NTIA element 6 be satisfied from a manifest alone.
	 */
	static readonly rootComponent = rootComponent;

	/**
	 * The manifest's outward links, as CycloneDX external references.
	 *
	 * @remarks
	 * Four of the specification's 43 types, one per manifest field: `vcs` ←
	 * `repository`, `issue-tracker` ← `bugs`, `documentation` ← `homepage`,
	 * `website` ← the supplier's first URL.
	 *
	 * A `repository` value the package-json model cannot interpret produces
	 * **no** reference rather than a passed-through string: CycloneDX's
	 * `externalReference.url` is a URL, and emitting `owner/name` there is a
	 * document that validates and misleads.
	 */
	static readonly externalReferences = externalReferences;

	/**
	 * Document-level metadata for a manifest.
	 *
	 * @remarks
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
	 * `pkg` is a `@effected/package-json` `Package`, re-exported from
	 * this package's entry point so a caller can name the parameter type
	 * without adding `@effected/package-json` as an undeclared dependency.
	 */
	static readonly fromPackage = fromPackage;

	/**
	 * A copyright statement for a holder and a year, or a span of years.
	 *
	 * @remarks
	 * The year is an **argument**: nothing here reads the clock, so the output is
	 * deterministic. Read the ambient year at the caller's edge.
	 */
	static readonly formatCopyright = formatCopyright;

	/**
	 * Field-wise metadata merge: every field the override carries wins.
	 *
	 * @remarks
	 * A helper, not a policy. Which side is the override — a config file over
	 * inferred values, or the reverse — is the consumer's precedence rule,
	 * and a library that decided it would be encoding one repository's
	 * release policy.
	 */
	static readonly merge = merge;
}
