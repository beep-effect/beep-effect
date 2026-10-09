// The CycloneDX 1.6 model, owned.
//
// A general-purpose CycloneDX library carries XML serialization, schema
// validation and SPDX expression parsing, which an emitter never calls. What an
// emitter needs is an object model and a JSON normalizer, which is what this
// module is.
//
// 1.6 ONLY. There is no 1.5 path, no dual-emission branch and no version
// option.

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { License, isValidExpression } from "../spdx/index.ts";
import * as S from "effect/Schema";
import * as R from "effect/Record";

const $I = $ScratchpadId.create("effected/sbom/SbomDocument");

/**
 * The BOM format discriminator. CycloneDX requires this exact string.
 *

 * **Example** (Inspect the BOM format)
 *
 * ```ts
 * import { BOM_FORMAT } from "@beep/scratchpad/effected/sbom/SbomDocument"
 *
 * console.log(BOM_FORMAT) // CycloneDX
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const BOM_FORMAT = "CycloneDX" as const;

/**
 * The only specification version this package emits.
 *

 * **Example** (Inspect the emitted specification version)
 *
 * ```ts
 * import { SPEC_VERSION } from "@beep/scratchpad/effected/sbom/SbomDocument"
 *
 * console.log(SPEC_VERSION) // 1.6
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SPEC_VERSION = "1.6" as const;

/**
 * The CycloneDX component types this package emits.
 *
 * **Details**
 *
 * A deliberate subset of the specification's fourteen: an npm SBOM describes
 * libraries and applications. The full enum is available in the schema; adding
 * a member here is a one-line change when something needs one.
 *

 * **Example** (Decode a library component type)
 *
 * ```ts
 * import { ComponentType } from "@beep/scratchpad/effected/sbom/SbomDocument"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(ComponentType)("library")) // library
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ComponentType = LiteralKit(["library", "application", "framework"]).pipe($I.annoteSchema("ComponentType", { description: "The CycloneDX component types this package emits." }));

/**
 * The decoded type of {@link (ComponentType:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ComponentType = typeof ComponentType.Type;

/**
 * An external reference's kind.
 *
 * **Details**
 *
 * The four the manifest mapping produces, out of the specification's 43. Each
 * corresponds to a `package.json` field: `vcs` ← `repository`,
 * `issue-tracker` ← `bugs`, `website` and `documentation` ← `homepage`.
 *

 * **Example** (Decode a source repository reference kind)
 *
 * ```ts
 * import { ExternalReferenceType } from "@beep/scratchpad/effected/sbom/SbomDocument"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(ExternalReferenceType)("vcs")) // vcs
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ExternalReferenceType = LiteralKit(["vcs", "issue-tracker", "website", "documentation"]).pipe($I.annoteSchema("ExternalReferenceType", { description: "An external reference's kind." }));

/**
 * The decoded type of {@link (ExternalReferenceType:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ExternalReferenceType = typeof ExternalReferenceType.Type;

/**
 * A link from a component to something outside the BOM.
 *

 * **Example** (Preserve an external reference URL)
 *
 * ```ts
 * import { ExternalReference } from "@beep/scratchpad/effected/sbom/SbomDocument"
 *
 * const reference = ExternalReference.make({
 *   type: "vcs",
 *   url: "https://example.com/source"
 * })
 * console.log(reference.url) // https://example.com/source
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class ExternalReference extends S.Class<ExternalReference>($I`ExternalReference`)({
	/** The reference kind. */
	type: ExternalReferenceType.annotateKey({ description: "The reference kind." }),
	/** The URL it points at, passed through exactly as supplied. */
	url: S.String.annotateKey({ description: "The URL it points at, passed through exactly as supplied." }),
}, $I.annote("ExternalReference", { description: "A link from a component to something outside the BOM." })) {}

/**
 * A point of contact — a person at a supplier, or an author of the BOM.
 *

 * **Example** (Construct an author contact)
 *
 * ```ts
 * import { Contact } from "@beep/scratchpad/effected/sbom/SbomDocument"
 *
 * const author = Contact.make({ name: "Ada", email: "ada@example.com" })
 * console.log(author.name) // Ada
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Contact extends S.Class<Contact>($I`Contact`)({
	/** The contact's name. */
	name: S.optionalKey(S.String).annotateKey({ description: "The contact's name." }),
	/** Their email address. */
	email: S.optionalKey(S.String).annotateKey({ description: "Their email address." }),
	/** Their telephone number. */
	phone: S.optionalKey(S.String).annotateKey({ description: "Their telephone number." }),
}, $I.annote("Contact", { description: "A point of contact — a person at a supplier, or an author of the BOM." })) {}

/**
 * The organization that supplied a component.
 *
 * **Details**
 *
 * `name` is required because `metadata.supplier.name` is **NTIA minimum
 * element 1**; a supplier without one satisfies nothing.
 *

 * **Example** (Identify the supplying organization)
 *
 * ```ts
 * import { Supplier } from "@beep/scratchpad/effected/sbom/SbomDocument"
 *
 * const supplier = Supplier.make({ name: "Example Corp" })
 * console.log(supplier.name) // Example Corp
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Supplier extends S.Class<Supplier>($I`Supplier`)({
	/** The supplier organization's name. */
	name: S.String.annotateKey({ description: "The supplier organization's name." }),
	/** Its URLs. */
	url: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "Its URLs." }),
	/** Its points of contact. */
	contact: Contact.pipe(S.Array, S.optionalKey).annotateKey({ description: "Its points of contact." }),
}, $I.annote("Supplier", { description: "The organization that supplied a component." })) {}

/**
 * One component in the BOM — the root, or a dependency.
 *
 * **Gotchas**
 *
 * `bomRef` is spelled **`bom-ref`** in the emitted JSON; the rename happens in
 * `Sbom.toJson`. Emitting `bomRef` produces a document that looks
 * correct and validates wrong.
 *

 * **Example** (Identify a library component)
 *
 * ```ts
 * import { Component } from "@beep/scratchpad/effected/sbom/SbomDocument"
 *
 * const component = Component.make({
 *   type: "library",
 *   name: "example-library",
 *   bomRef: "pkg:npm/example-library@1.0.0"
 * })
 * console.log(component.bomRef) // pkg:npm/example-library@1.0.0
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Component extends S.Class<Component>($I`Component`)({
	/** What kind of component this is. */
	type: ComponentType.annotateKey({ description: "What kind of component this is." }),
	/** The component's name — NTIA minimum element 2. */
	name: S.String.annotateKey({ description: "The component's name — NTIA minimum element 2." }),
	/** Its version — NTIA minimum element 3. */
	version: S.optionalKey(S.String).annotateKey({ description: "Its version — NTIA minimum element 3." }),
	/** The package URL uniquely identifying it — NTIA minimum element 4. */
	purl: S.optionalKey(S.String).annotateKey({ description: "The package URL uniquely identifying it — NTIA minimum element 4." }),
	/** The identifier other parts of the document reference it by. */
	bomRef: S.optionalKey(S.String).annotateKey({ description: "The identifier other parts of the document reference it by." }),
	/** A short description. */
	description: S.optionalKey(S.String).annotateKey({ description: "A short description." }),
	/** SPDX license identifiers or expressions. */
	licenses: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "SPDX license identifiers or expressions." }),
	/** Links out of the BOM. */
	externalReferences: ExternalReference.pipe(S.Array, S.optionalKey).annotateKey({ description: "Links out of the BOM." }),
	/** Discovery keywords — CycloneDX 1.6's `tags`, from the manifest's `keywords`. */
	tags: S.String.pipe(S.Array, S.optionalKey).annotateKey({ description: "Discovery keywords — CycloneDX 1.6's `tags`, from the manifest's `keywords`." }),
	/** The component's authors. */
	authors: Contact.pipe(S.Array, S.optionalKey).annotateKey({ description: "The component's authors." }),
	/** The entity that published it. */
	publisher: S.optionalKey(S.String).annotateKey({ description: "The entity that published it." }),
	/** A copyright statement. */
	copyright: S.optionalKey(S.String).annotateKey({ description: "A copyright statement." }),
}, $I.annote("Component", { description: "One component in the BOM — the root, or a dependency." })) {}

/**
 * Document-level metadata: who made the BOM, when, and about what.
 *

 * **Example** (Record the BOM assembly time)
 *
 * ```ts
 * import { SbomMetadata } from "@beep/scratchpad/effected/sbom/SbomDocument"
 *
 * const metadata = SbomMetadata.make({ timestamp: "2026-01-01T00:00:00Z" })
 * console.log(metadata.timestamp) // 2026-01-01T00:00:00Z
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class SbomMetadata extends S.Class<SbomMetadata>($I`SbomMetadata`)({
	/** When the BOM was assembled — NTIA minimum element 7. */
	timestamp: S.optionalKey(S.String).annotateKey({ description: "When the BOM was assembled — NTIA minimum element 7." }),
	/** Who created the BOM — NTIA minimum element 6. */
	authors: Contact.pipe(S.Array, S.optionalKey).annotateKey({ description: "Who created the BOM — NTIA minimum element 6." }),
	/** The component the BOM describes. */
	component: S.optionalKey(Component).annotateKey({ description: "The component the BOM describes." }),
	/** Who supplied that component — NTIA minimum element 1. */
	supplier: S.optionalKey(Supplier).annotateKey({ description: "Who supplied that component — NTIA minimum element 1." }),
}, $I.annote("SbomMetadata", { description: "Document-level metadata: who made the BOM, when, and about what." })) {}

/**
 * A CycloneDX 1.6 bill of materials.
 *
 * **Details**
 *
 * Constructed by `Sbom.generate` and serialized by `Sbom.toJson`; both are
 * total functions, because an owned model over validated values has nothing to
 * fail at.
 *

 * **Example** (Construct an empty CycloneDX document)
 *
 * ```ts
 * import { BOM_FORMAT, SPEC_VERSION, SbomDocument } from "@beep/scratchpad/effected/sbom/SbomDocument"
 *
 * const document = SbomDocument.make({
 *   bomFormat: BOM_FORMAT,
 *   specVersion: SPEC_VERSION,
 *   version: 1,
 *   components: []
 * })
 * console.log(document.components.length) // 0
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class SbomDocument extends S.Class<SbomDocument>($I`SbomDocument`)({
	/** Always `"CycloneDX"`. */
	bomFormat: S.Literal(BOM_FORMAT).annotateKey({ description: "Always `\"CycloneDX\"`." }),
	/** Always `"1.6"`. */
	specVersion: S.Literal(SPEC_VERSION).annotateKey({ description: "Always `\"1.6\"`." }),
	/** The document revision, `1` for a freshly assembled BOM. */
	version: S.Finite.annotateKey({ description: "The document revision, `1` for a freshly assembled BOM." }),
	/** Document metadata. */
	metadata: S.optionalKey(SbomMetadata).annotateKey({ description: "Document metadata." }),
	/** The components the BOM describes, sorted by name. */
	components: S.Array(Component).annotateKey({ description: "The components the BOM describes, sorted by name." }),
}, $I.annote("SbomDocument", { description: "A CycloneDX 1.6 bill of materials." })) {}

/** Drop absent keys so the emitted JSON omits them rather than carrying nulls. */
const compact = <T extends Record<string, unknown>>(value: T): Record<string, unknown> => {
	const out: Record<string, unknown> = {};
	for (const [key, entry] of R.toEntries(value)) {
		if (entry !== undefined) out[key] = entry;
	}
	return out;
};

/**
 * The `licenses` array in one of the three shapes CycloneDX permits.
 *
 * **Details**
 *
 * A manifest's `license` field is an SPDX **expression** field: `MIT`,
 * `MIT OR Apache-2.0` and `UNLICENSED` are all legal values of it, and the
 * specification renders them three different ways — `license.id` is constrained
 * to the SPDX identifier enumeration, an expression goes in a one-element
 * `{ expression }` tuple, and anything else is a named license. Emitting every
 * value as an id produces a document that looks right and validates wrong.
 *
 * The identifier-versus-expression question is `@effected/spdx`'s to answer:
 * the kit's one SPDX engine, never a local regex.
 */
const licensesJson = (licenses: ReadonlyArray<string>): ReadonlyArray<Record<string, unknown>> => {
	// The expression tuple is exclusive — the schema caps it at one element — so
	// it is only available when the component carries a single license.
	const [only] = licenses;
	if (licenses.length === 1 && only !== undefined && !License.isKnownId(only) && isValidExpression(only)) {
		return [{ expression: only }];
	}
	return licenses.map((license) =>
		License.isKnownId(license) ? { license: { id: license } } : { license: { name: license } },
	);
};

const contactJson = (contact: Contact): Record<string, unknown> =>
	compact({ name: contact.name, email: contact.email, phone: contact.phone });

const componentJson = (component: Component): Record<string, unknown> =>
	compact({
		type: component.type,
		// The rename. CycloneDX spells this key with a hyphen; the model cannot,
		// so the translation lives here and nowhere else.
		"bom-ref": component.bomRef,
		name: component.name,
		version: component.version,
		description: component.description,
		publisher: component.publisher,
		copyright: component.copyright,
		authors: component.authors?.map(contactJson),
		// `licenses` is an array of single-key wrappers, never bare strings.
		licenses: component.licenses === undefined ? undefined : licensesJson(component.licenses),
		purl: component.purl,
		externalReferences: component.externalReferences?.map((reference) => ({
			url: reference.url,
			type: reference.type,
		})),
		tags: component.tags,
	});

/**
 * The document as a plain JSON value, in CycloneDX's key shapes.
 *

 * **Example** (Emit the CycloneDX component reference key)
 *
 * ```ts
 * import { BOM_FORMAT, SPEC_VERSION, Component, SbomDocument, documentJson } from "@beep/scratchpad/effected/sbom/SbomDocument"
 *
 * const document = SbomDocument.make({
 *   bomFormat: BOM_FORMAT,
 *   specVersion: SPEC_VERSION,
 *   version: 1,
 *   components: [Component.make({
 *     type: "library",
 *     name: "example-library",
 *     bomRef: "pkg:npm/example-library@1.0.0"
 *   })]
 * })
 * console.log(JSON.stringify(documentJson(document))) // {"bomFormat":"CycloneDX","specVersion":"1.6","version":1,"components":[{"type":"library","bom-ref":"pkg:npm/example-library@1.0.0","name":"example-library"}]}
 * ```
 *
 * @internal
 * @category serialization
 * @since 0.0.0
 */
export const documentJson = (document: SbomDocument): Record<string, unknown> =>
	compact({
		bomFormat: document.bomFormat,
		specVersion: document.specVersion,
		version: document.version,
		metadata:
			document.metadata === undefined
				? undefined
				: compact({
						timestamp: document.metadata.timestamp,
						authors: document.metadata.authors?.map(contactJson),
						component:
							document.metadata.component === undefined ? undefined : componentJson(document.metadata.component),
						supplier:
							document.metadata.supplier === undefined
								? undefined
								: compact({
										name: document.metadata.supplier.name,
										url: document.metadata.supplier.url,
										contact: document.metadata.supplier.contact?.map(contactJson),
									}),
					}),
		components: document.components.map(componentJson),
	});
