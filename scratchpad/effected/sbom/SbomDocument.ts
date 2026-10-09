// The CycloneDX 1.6 model, owned.
//
// A general-purpose CycloneDX library carries XML serialization, schema
// validation and SPDX expression parsing, which an emitter never calls. What an
// emitter needs is an object model and a JSON normalizer, which is what this
// module is.
//
// 1.6 ONLY. There is no 1.5 path, no dual-emission branch and no version
// option.

import { License, isValidExpression } from "../spdx/index.ts";
import { Schema } from "effect";

/** The BOM format discriminator. CycloneDX requires this exact string. */
export const BOM_FORMAT = "CycloneDX" as const;

/** The only specification version this package emits. */
export const SPEC_VERSION = "1.6" as const;

/**
 * The CycloneDX component types this package emits.
 *
 * @remarks
 * A deliberate subset of the specification's fourteen: an npm SBOM describes
 * libraries and applications. The full enum is available in the schema; adding
 * a member here is a one-line change when something needs one.
 *
 * @public
 */
export const ComponentType = Schema.Literals(["library", "application", "framework"]);

/**
 * The decoded type of {@link (ComponentType:variable)}.
 *
 * @public
 */
export type ComponentType = typeof ComponentType.Type;

/**
 * An external reference's kind.
 *
 * @remarks
 * The four the manifest mapping produces, out of the specification's 43. Each
 * corresponds to a `package.json` field: `vcs` ← `repository`,
 * `issue-tracker` ← `bugs`, `website` and `documentation` ← `homepage`.
 *
 * @public
 */
export const ExternalReferenceType = Schema.Literals(["vcs", "issue-tracker", "website", "documentation"]);

/**
 * The decoded type of {@link (ExternalReferenceType:variable)}.
 *
 * @public
 */
export type ExternalReferenceType = typeof ExternalReferenceType.Type;

/**
 * A link from a component to something outside the BOM.
 *
 * @public
 */
export class ExternalReference extends Schema.Class<ExternalReference>("ExternalReference")({
	/** The reference kind. */
	type: ExternalReferenceType,
	/** The URL it points at, passed through exactly as supplied. */
	url: Schema.String,
}) {}

/**
 * A point of contact — a person at a supplier, or an author of the BOM.
 *
 * @public
 */
export class Contact extends Schema.Class<Contact>("Contact")({
	/** The contact's name. */
	name: Schema.optionalKey(Schema.String),
	/** Their email address. */
	email: Schema.optionalKey(Schema.String),
	/** Their telephone number. */
	phone: Schema.optionalKey(Schema.String),
}) {}

/**
 * The organization that supplied a component.
 *
 * @remarks
 * `name` is required because `metadata.supplier.name` is **NTIA minimum
 * element 1**; a supplier without one satisfies nothing.
 *
 * @public
 */
export class Supplier extends Schema.Class<Supplier>("Supplier")({
	/** The supplier organization's name. */
	name: Schema.String,
	/** Its URLs. */
	url: Schema.optionalKey(Schema.Array(Schema.String)),
	/** Its points of contact. */
	contact: Schema.optionalKey(Schema.Array(Contact)),
}) {}

/**
 * One component in the BOM — the root, or a dependency.
 *
 * @remarks
 * `bomRef` is spelled **`bom-ref`** in the emitted JSON; the rename happens in
 * `Sbom.toJson`. Emitting `bomRef` produces a document that looks
 * correct and validates wrong.
 *
 * @public
 */
export class Component extends Schema.Class<Component>("Component")({
	/** What kind of component this is. */
	type: ComponentType,
	/** The component's name — NTIA minimum element 2. */
	name: Schema.String,
	/** Its version — NTIA minimum element 3. */
	version: Schema.optionalKey(Schema.String),
	/** The package URL uniquely identifying it — NTIA minimum element 4. */
	purl: Schema.optionalKey(Schema.String),
	/** The identifier other parts of the document reference it by. */
	bomRef: Schema.optionalKey(Schema.String),
	/** A short description. */
	description: Schema.optionalKey(Schema.String),
	/** SPDX license identifiers or expressions. */
	licenses: Schema.optionalKey(Schema.Array(Schema.String)),
	/** Links out of the BOM. */
	externalReferences: Schema.optionalKey(Schema.Array(ExternalReference)),
	/** Discovery keywords — CycloneDX 1.6's `tags`, from the manifest's `keywords`. */
	tags: Schema.optionalKey(Schema.Array(Schema.String)),
	/** The component's authors. */
	authors: Schema.optionalKey(Schema.Array(Contact)),
	/** The entity that published it. */
	publisher: Schema.optionalKey(Schema.String),
	/** A copyright statement. */
	copyright: Schema.optionalKey(Schema.String),
}) {}

/**
 * Document-level metadata: who made the BOM, when, and about what.
 *
 * @public
 */
export class SbomMetadata extends Schema.Class<SbomMetadata>("SbomMetadata")({
	/** When the BOM was assembled — NTIA minimum element 7. */
	timestamp: Schema.optionalKey(Schema.String),
	/** Who created the BOM — NTIA minimum element 6. */
	authors: Schema.optionalKey(Schema.Array(Contact)),
	/** The component the BOM describes. */
	component: Schema.optionalKey(Component),
	/** Who supplied that component — NTIA minimum element 1. */
	supplier: Schema.optionalKey(Supplier),
}) {}

/**
 * A CycloneDX 1.6 bill of materials.
 *
 * @remarks
 * Constructed by `Sbom.generate` and serialized by `Sbom.toJson`; both are
 * total functions, because an owned model over validated values has nothing to
 * fail at.
 *
 * @public
 */
export class SbomDocument extends Schema.Class<SbomDocument>("SbomDocument")({
	/** Always `"CycloneDX"`. */
	bomFormat: Schema.Literal(BOM_FORMAT),
	/** Always `"1.6"`. */
	specVersion: Schema.Literal(SPEC_VERSION),
	/** The document revision, `1` for a freshly assembled BOM. */
	version: Schema.Number,
	/** Document metadata. */
	metadata: Schema.optionalKey(SbomMetadata),
	/** The components the BOM describes, sorted by name. */
	components: Schema.Array(Component),
}) {}

/** Drop absent keys so the emitted JSON omits them rather than carrying nulls. */
const compact = <T extends Record<string, unknown>>(value: T): Record<string, unknown> => {
	const out: Record<string, unknown> = {};
	for (const [key, entry] of Object.entries(value)) {
		if (entry !== undefined) out[key] = entry;
	}
	return out;
};

/**
 * The `licenses` array in one of the three shapes CycloneDX permits.
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
 * @internal
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
