/**
 * The CycloneDX 1.6 model, owned.
 *
 * **Details**
 *
 * A general-purpose CycloneDX library carries XML serialization, schema
 * validation and SPDX expression parsing, which an emitter never calls. What an
 * emitter needs is an object model and a JSON normalizer, which is what this
 * module is.
 *
 * 1.6 ONLY. There is no 1.5 path, no dual-emission branch and no version
 * option.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SbomId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import { isValidExpression, License } from "@beep/spdx";
import * as A from "effect/Array";
import * as O from "effect/Option";
import * as P from "effect/Predicate";
import * as R from "effect/Record";
import * as S from "effect/Schema";

const $I = $SbomId.create("SbomDocument");

/**
 * The BOM format discriminator. CycloneDX requires this exact string.
 *
 * **Example** (Inspect the BOM format)
 *
 * ```ts
 * import { BOM_FORMAT } from "@beep/sbom/SbomDocument"
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
 * import { SPEC_VERSION } from "@beep/sbom/SbomDocument"
 *
 * console.log(SPEC_VERSION) // 1.6
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SPEC_VERSION = "1.6" as const;

/**
 * **Details**
 *
 * A deliberate subset of the specification's fourteen: an npm SBOM describes
 * libraries and applications. The full enum is available in the schema; adding
 * a member here is a one-line change when something needs one.
 *
 * **Example** (Decode a library component type)
 *
 * ```ts
 * import { ComponentType } from "@beep/sbom/SbomDocument"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(ComponentType)("library")) // library
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ComponentType = LiteralKit(["library", "application", "framework"]).pipe(
  $I.annoteSchema("ComponentType", { description: "The CycloneDX component types this package emits." })
);

/**
 * The decoded type of {@link (ComponentType:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ComponentType = typeof ComponentType.Type;

/**
 * **Details**
 *
 * The four the manifest mapping produces, out of the specification's 43. Each
 * corresponds to a `package.json` field: `vcs` ← `repository`,
 * `issue-tracker` ← `bugs`, `website` and `documentation` ← `homepage`.
 *
 * **Example** (Decode a source repository reference kind)
 *
 * ```ts
 * import { ExternalReferenceType } from "@beep/sbom/SbomDocument"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(ExternalReferenceType)("vcs")) // vcs
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const ExternalReferenceType = LiteralKit(["vcs", "issue-tracker", "website", "documentation"]).pipe(
  $I.annoteSchema("ExternalReferenceType", { description: "An external reference's kind." })
);

/**
 * The decoded type of {@link (ExternalReferenceType:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type ExternalReferenceType = typeof ExternalReferenceType.Type;

/**
 * **Example** (Preserve an external reference URL)
 *
 * ```ts
 * import { ExternalReference } from "@beep/sbom/SbomDocument"
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
export class ExternalReference extends S.Opaque<ExternalReference, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The reference kind. */
    type: ExternalReferenceType.pipe($I.annoteKey("ExternalReference.type", { description: "The reference kind." })),
    /** The URL it points at, passed through exactly as supplied. */
    url: S.String.pipe(
      $I.annoteKey("ExternalReference.url", {
        description: "The URL it points at, passed through exactly as supplied.",
      })
    ),
  }).pipe(
    $I.annoteSchema("ExternalReference", { description: "A link from a component to something outside the BOM." })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace ExternalReference {
  /**
   * The plain object a {@link ExternalReference} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof ExternalReference.Encoded;
}

const ContactEmail = S.String.pipe(
  $I.annoteSchema("ContactEmail", {
    description:
      "A CycloneDX contact email: an external-protocol string passed through verbatim. npm never validates a manifest author's email, so the 1.6 schema's idn-email format is not enforced.",
  })
);

/**
 * **Example** (Construct an author contact)
 *
 * ```ts
 * import { Contact } from "@beep/sbom/SbomDocument"
 *
 * const author = Contact.make({ name: "Ada", email: "ada@example.com" })
 * console.log(author.name) // Ada
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Contact extends S.Opaque<Contact, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The contact's name. */
    name: S.optionalKey(S.String).pipe($I.annoteKey("Contact.name", { description: "The contact's name." })),
    /** Their email address. */
    email: S.optionalKey(ContactEmail).pipe($I.annoteKey("Contact.email", { description: "Their email address." })),
    /** Their telephone number. */
    phone: S.optionalKey(S.String).pipe($I.annoteKey("Contact.phone", { description: "Their telephone number." })),
  }).pipe(
    $I.annoteSchema("Contact", { description: "A point of contact — a person at a supplier, or an author of the BOM." })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Contact {
  /**
   * The plain object a {@link Contact} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Contact.Encoded;
}

/**
 * **Details**
 *
 * `name` is required because `metadata.supplier.name` is **NTIA minimum
 * element 1**; a supplier without one satisfies nothing.
 *
 * **Example** (Identify the supplying organization)
 *
 * ```ts
 * import { Supplier } from "@beep/sbom/SbomDocument"
 *
 * const supplier = Supplier.make({ name: "Example Corp" })
 * console.log(supplier.name) // Example Corp
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class Supplier extends S.Opaque<Supplier, { readonly brand: unique symbol }>()(
  S.Struct({
    /** The supplier organization's name. */
    name: S.String.pipe($I.annoteKey("Supplier.name", { description: "The supplier organization's name." })),
    /** Its URLs. */
    url: S.String.pipe(S.Array, S.optionalKey, $I.annoteKey("Supplier.url", { description: "Its URLs." })),
    /** Its points of contact. */
    contact: Contact.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("Supplier.contact", { description: "Its points of contact." })
    ),
  }).pipe($I.annoteSchema("Supplier", { description: "The organization that supplied a component." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Supplier {
  /**
   * The plain object a {@link Supplier} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Supplier.Encoded;
}

/**
 * **Gotchas**
 *
 * `bomRef` is spelled **`bom-ref`** in the emitted JSON; the rename happens in
 * `Sbom.toJson`. Emitting `bomRef` produces a document that looks
 * correct and validates wrong.
 *
 * **Example** (Identify a library component)
 *
 * ```ts
 * import { Component } from "@beep/sbom/SbomDocument"
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
export class Component extends S.Opaque<Component, { readonly brand: unique symbol }>()(
  S.Struct({
    /** What kind of component this is. */
    type: ComponentType.pipe($I.annoteKey("Component.type", { description: "What kind of component this is." })),
    /** The component's name — NTIA minimum element 2. */
    name: S.String.pipe(
      $I.annoteKey("Component.name", { description: "The component's name — NTIA minimum element 2." })
    ),
    /** Its version — NTIA minimum element 3. */
    version: S.optionalKey(S.String).pipe(
      $I.annoteKey("Component.version", { description: "Its version — NTIA minimum element 3." })
    ),
    /** The package URL uniquely identifying it — NTIA minimum element 4. */
    purl: S.optionalKey(S.String).pipe(
      $I.annoteKey("Component.purl", {
        description: "The package URL uniquely identifying it — NTIA minimum element 4.",
      })
    ),
    /**
     * The identifier other parts of the document reference it by. Non-empty:
     * the CycloneDX 1.6 `refType` has `minLength: 1`, so an empty one would
     * emit a document that fails the specification.
     */
    bomRef: S.optionalKey(S.NonEmptyString).pipe(
      $I.annoteKey("Component.bomRef", {
        description: "The non-empty identifier other parts of the document reference it by.",
      })
    ),
    /** A short description. */
    description: S.optionalKey(S.String).pipe(
      $I.annoteKey("Component.description", { description: "A short description." })
    ),
    /** SPDX license identifiers or expressions. */
    licenses: S.String.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("Component.licenses", { description: "SPDX license identifiers or expressions." })
    ),
    /** Links out of the BOM. */
    externalReferences: ExternalReference.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("Component.externalReferences", { description: "Links out of the BOM." })
    ),
    /** Discovery keywords — CycloneDX 1.6's `tags`, from the manifest's `keywords`. */
    tags: S.String.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("Component.tags", {
        description: "Discovery keywords — CycloneDX 1.6's `tags`, from the manifest's `keywords`.",
      })
    ),
    /** The component's authors. */
    authors: Contact.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("Component.authors", { description: "The component's authors." })
    ),
    /** The entity that published it. */
    publisher: S.optionalKey(S.String).pipe(
      $I.annoteKey("Component.publisher", { description: "The entity that published it." })
    ),
    /** A copyright statement. */
    copyright: S.optionalKey(S.String).pipe(
      $I.annoteKey("Component.copyright", { description: "A copyright statement." })
    ),
  }).pipe($I.annoteSchema("Component", { description: "One component in the BOM — the root, or a dependency." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace Component {
  /**
   * The plain object a {@link Component} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof Component.Encoded;
}

/**
 * **Example** (Record the BOM assembly time)
 *
 * ```ts
 * import { SbomMetadata } from "@beep/sbom/SbomDocument"
 *
 * const metadata = SbomMetadata.make({ timestamp: "2026-01-01T00:00:00Z" })
 * console.log(metadata.timestamp) // 2026-01-01T00:00:00Z
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class SbomMetadata extends S.Opaque<SbomMetadata, { readonly brand: unique symbol }>()(
  S.Struct({
    /** When the BOM was assembled — NTIA minimum element 7. */
    timestamp: S.optionalKey(S.String).pipe(
      $I.annoteKey("SbomMetadata.timestamp", { description: "When the BOM was assembled — NTIA minimum element 7." })
    ),
    /** Who created the BOM — NTIA minimum element 6. */
    authors: Contact.pipe(
      S.Array,
      S.optionalKey,
      $I.annoteKey("SbomMetadata.authors", { description: "Who created the BOM — NTIA minimum element 6." })
    ),
    /** The component the BOM describes. */
    component: S.optionalKey(Component).pipe(
      $I.annoteKey("SbomMetadata.component", { description: "The component the BOM describes." })
    ),
    /** Who supplied that component — NTIA minimum element 1. */
    supplier: S.optionalKey(Supplier).pipe(
      $I.annoteKey("SbomMetadata.supplier", { description: "Who supplied that component — NTIA minimum element 1." })
    ),
  }).pipe(
    $I.annoteSchema("SbomMetadata", { description: "Document-level metadata: who made the BOM, when, and about what." })
  )
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SbomMetadata {
  /**
   * The plain object a {@link SbomMetadata} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SbomMetadata.Encoded;
}

/**
 * **Details**
 *
 * Constructed by `Sbom.generate` and serialized by `Sbom.toJson`; both are
 * total functions, because an owned model over validated values has nothing to
 * fail at.
 *
 * **Example** (Construct an empty CycloneDX document)
 *
 * ```ts
 * import { BOM_FORMAT, SPEC_VERSION, SbomDocument } from "@beep/sbom/SbomDocument"
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
export class SbomDocument extends S.Opaque<SbomDocument, { readonly brand: unique symbol }>()(
  S.Struct({
    /** Always `"CycloneDX"`. */
    bomFormat: S.tag(BOM_FORMAT).pipe($I.annoteKey("SbomDocument.bomFormat", { description: 'Always `"CycloneDX"`.' })),
    /** Always `"1.6"`. */
    specVersion: S.tag(SPEC_VERSION).pipe($I.annoteKey("SbomDocument.specVersion", { description: 'Always `"1.6"`.' })),
    /** The document revision, `1` for a freshly assembled BOM. */
    version: S.Finite.pipe(
      $I.annoteKey("SbomDocument.version", { description: "The document revision, `1` for a freshly assembled BOM." })
    ),
    /** Document metadata. */
    metadata: S.optionalKey(SbomMetadata).pipe(
      $I.annoteKey("SbomDocument.metadata", { description: "Document metadata." })
    ),
    /** The components the BOM describes, sorted by name. */
    components: S.Array(Component).pipe(
      $I.annoteKey("SbomDocument.components", { description: "The components the BOM describes, sorted by name." })
    ),
  }).pipe($I.annoteSchema("SbomDocument", { description: "A CycloneDX 1.6 bill of materials." }))
) {}

/**
 * @category type-level
 * @since 0.0.0
 */
export declare namespace SbomDocument {
  /**
   * The plain object a {@link SbomDocument} decodes from and encodes to.
   *
   * @category type-level
   * @since 0.0.0
   */
  export type Encoded = typeof SbomDocument.Encoded;
}

const compact = (value: Readonly<Record<string, unknown>>): Record<string, unknown> =>
  R.filter(value, P.isNotUndefined);

// decision: licenses-classified-by-beep-spdx
const licensesJson = (licenses: ReadonlyArray<string>): ReadonlyArray<Record<string, unknown>> => {
  const [only, ...others] = licenses;
  if (only !== undefined && others.length === 0 && !License.isKnownId(only) && isValidExpression(only)) {
    return [{ expression: only }];
  }
  return A.map(licenses, (license) =>
    License.isKnownId(license) ? { license: { id: license } } : { license: { name: license } }
  );
};

const optionally = <A, B>(value: A | undefined, f: (value: A) => B): B | undefined =>
  O.getOrUndefined(O.map(O.fromUndefinedOr(value), f));

const contactJson = (contact: Contact): Record<string, unknown> =>
  compact({ name: contact.name, email: contact.email, phone: contact.phone });

const contactsJson = (contacts: ReadonlyArray<Contact>): ReadonlyArray<Record<string, unknown>> =>
  A.map(contacts, contactJson);

const referenceJson = (reference: ExternalReference): Record<string, unknown> => ({
  url: reference.url,
  type: reference.type,
});

const componentJson = (component: Component): Record<string, unknown> =>
  compact({
    type: component.type,
    "bom-ref": component.bomRef,
    name: component.name,
    version: component.version,
    description: component.description,
    publisher: component.publisher,
    copyright: component.copyright,
    authors: optionally(component.authors, contactsJson),
    licenses: optionally(component.licenses, licensesJson),
    purl: component.purl,
    externalReferences: optionally(component.externalReferences, (references) => A.map(references, referenceJson)),
    tags: component.tags,
  });

const supplierJson = (supplier: Supplier): Record<string, unknown> =>
  compact({ name: supplier.name, url: supplier.url, contact: optionally(supplier.contact, contactsJson) });

const metadataJson = (metadata: SbomMetadata): Record<string, unknown> =>
  compact({
    timestamp: metadata.timestamp,
    authors: optionally(metadata.authors, contactsJson),
    component: optionally(metadata.component, componentJson),
    supplier: optionally(metadata.supplier, supplierJson),
  });

/**
 * The document as a plain JSON value, in CycloneDX's key shapes.
 *
 * **Example** (Emit the CycloneDX component reference key)
 *
 * ```ts
 * import { BOM_FORMAT, SPEC_VERSION, Component, SbomDocument, documentJson } from "@beep/sbom/SbomDocument"
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
    metadata: optionally(document.metadata, metadataJson),
    components: A.map(document.components, componentJson),
  });
