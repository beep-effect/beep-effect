/**
 * Edition-pinned classification identifiers and immutable SKOS snapshots.
 * @packageDocumentation
 * @since 0.0.0
 */
import { $OntologyId, $SemanticFoundationId } from "@beep/identity/packages";
import { IRIReference } from "@beep/rdf";
import { LiteralKit } from "@beep/schema";
import { dual } from "effect/Function";
import * as S from "effect/Schema";
import * as Str from "effect/String";

const $I = $OntologyId.create("Classification.models");

/**
 * The three classification authorities admitted by the semantic foundation.
 * **Example** (Check a scheme kind)
 * ```ts
 * import { ClassificationSchemeKind } from "@beep/ontology/Classification.models"
 * ClassificationSchemeKind.is.ipc("ipc")
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const ClassificationSchemeKind = LiteralKit(["ipc", "cpc", "nice"]).pipe(
  $I.annoteSchema("ClassificationSchemeKind", {
    description: "Admitted patent and goods/services classification authorities.",
  })
);

/**
 * Runtime value admitted by {@link ClassificationSchemeKind}.
 *
 * **Example** (Type a classification value)
 *
 * ```ts
 * import type { ClassificationSchemeKind } from "@beep/ontology/Classification.models"
 * const value: ClassificationSchemeKind = "ipc"
 * console.log(value)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type ClassificationSchemeKind = typeof ClassificationSchemeKind.Type;

/**
 * An IPC edition identifier in year and month form.
 * **Example** (Name an IPC edition)
 * ```ts
 * import { IpcEdition } from "@beep/ontology/Classification.models"
 * IpcEdition.make("2026.01")
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const IpcEdition = S.String.check(S.isPattern(/^\d{4}\.(?:0[1-9]|1[0-2])$/)).pipe(
  $I.annoteSchema("IpcEdition", { description: "An explicit IPC publication year and month." })
);

/**
 * Runtime value admitted by {@link IpcEdition}.
 *
 * **Example** (Type a classification value)
 *
 * ```ts
 * import type { IpcEdition } from "@beep/ontology/Classification.models"
 * const value: IpcEdition = "2026.01"
 * console.log(value)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type IpcEdition = typeof IpcEdition.Type;

/**
 * A CPC publication edition identifier in year and month form.
 * **Example** (Name a CPC edition)
 * ```ts
 * import { CpcEdition } from "@beep/ontology/Classification.models"
 * CpcEdition.make("2026.08")
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const CpcEdition = S.String.check(S.isPattern(/^\d{4}\.(?:0[1-9]|1[0-2])$/)).pipe(
  $I.annoteSchema("CpcEdition", { description: "An explicit CPC publication year and month." })
);

/**
 * Runtime value admitted by {@link CpcEdition}.
 *
 * **Example** (Type a classification value)
 *
 * ```ts
 * import type { CpcEdition } from "@beep/ontology/Classification.models"
 * const value: CpcEdition = "2026.08"
 * console.log(value)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CpcEdition = typeof CpcEdition.Type;

/**
 * A Nice edition and version year, with no floating current-version alias.
 * **Example** (Name a Nice edition)
 * ```ts
 * import { NiceEdition } from "@beep/ontology/Classification.models"
 * NiceEdition.make("13-2026")
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const NiceEdition = S.String.check(S.isPattern(/^[1-9]\d*-\d{4}$/)).pipe(
  $I.annoteSchema("NiceEdition", { description: "A Nice edition and version year." })
);

/**
 * Runtime value admitted by {@link NiceEdition}.
 *
 * **Example** (Type a classification value)
 *
 * ```ts
 * import type { NiceEdition } from "@beep/ontology/Classification.models"
 * const value: NiceEdition = "13-2026"
 * console.log(value)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type NiceEdition = typeof NiceEdition.Type;

/**
 * Canonical IPC notation, including section, class, subclass and group codes.
 * **Example** (Decode an IPC group)
 * ```ts
 * import { IpcSymbol } from "@beep/ontology/Classification.models"
 * IpcSymbol.make("A01B1/02")
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const IpcSymbol = S.String.check(
  S.isPattern(/^[A-H](?:\d{2}(?:[A-Z](?:[1-9]\d{0,2}\/(?:00|\d{2,6}))?)?)?$/)
).pipe(
  $I.annoteSchema("IpcSymbol", { description: "Canonical IPC notation without CPC-only section and indexing codes." })
);

/**
 * Runtime value admitted by {@link IpcSymbol}.
 *
 * **Example** (Type a classification value)
 *
 * ```ts
 * import type { IpcSymbol } from "@beep/ontology/Classification.models"
 * const value: IpcSymbol = "A01B1/02"
 * console.log(value)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type IpcSymbol = typeof IpcSymbol.Type;

/**
 * Canonical CPC notation, admitting the Y section and 2000-series groups.
 * **Example** (Decode a CPC indexing group)
 * ```ts
 * import { CpcSymbol } from "@beep/ontology/Classification.models"
 * CpcSymbol.make("Y02A10/00")
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const CpcSymbol = S.String.check(
  S.isPattern(/^[A-HY](?:\d{2}(?:[A-Z](?:[1-9]\d{0,3}\/(?:00|\d{2,6}))?)?)?$/)
).pipe($I.annoteSchema("CpcSymbol", { description: "Canonical CPC notation including Y and indexing groups." }));

/**
 * Runtime value admitted by {@link CpcSymbol}.
 *
 * **Example** (Type a classification value)
 *
 * ```ts
 * import type { CpcSymbol } from "@beep/ontology/Classification.models"
 * const value: CpcSymbol = "Y02A10/00"
 * console.log(value)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type CpcSymbol = typeof CpcSymbol.Type;

/**
 * Nice class notation, restricted to classes 1 through 45.
 * **Example** (Decode a Nice class)
 * ```ts
 * import { NiceClassNumber } from "@beep/ontology/Classification.models"
 * NiceClassNumber.make("35")
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const NiceClassNumber = S.String.check(S.isPattern(/^(?:[1-9]|[1-3]\d|4[0-5])$/)).pipe(
  $I.annoteSchema("NiceClassNumber", { description: "One of the forty-five Nice goods or services classes." })
);

/**
 * Runtime value admitted by {@link NiceClassNumber}.
 *
 * **Example** (Type a classification value)
 *
 * ```ts
 * import type { NiceClassNumber } from "@beep/ontology/Classification.models"
 * const value: NiceClassNumber = "35"
 * console.log(value)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type NiceClassNumber = typeof NiceClassNumber.Type;

/**
 * A six-digit Nice basic identifier with its two-digit class prefix.
 * **Example** (Decode a Nice basic number)
 * ```ts
 * import { NiceBasicNumber } from "@beep/ontology/Classification.models"
 * NiceBasicNumber.make("010001")
 * ```
 * @category schemas
 * @since 0.0.0
 */
export const NiceBasicNumber = S.String.check(S.isPattern(/^(?:0[1-9]|[1-3]\d|4[0-5])\d{4}$/)).pipe(
  $I.annoteSchema("NiceBasicNumber", { description: "A Nice basic identifier scoped by its class prefix." })
);

/**
 * Runtime value admitted by {@link NiceBasicNumber}.
 *
 * **Example** (Type a classification value)
 *
 * ```ts
 * import type { NiceBasicNumber } from "@beep/ontology/Classification.models"
 * const value: NiceBasicNumber = "010001"
 * console.log(value)
 * ```
 *
 * @category type-level
 * @since 0.0.0
 */
export type NiceBasicNumber = typeof NiceBasicNumber.Type;

/**
 * One concept whose identity includes its authority and edition.
 * **Example** (Inspect a classification concept)
 * ```ts
 * import type { ClassificationConcept } from "@beep/ontology/Classification.models"
 * const notation = (concept: ClassificationConcept) => concept.notation
 * console.log(notation)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ClassificationConcept extends S.Class<ClassificationConcept>($I`ClassificationConcept`)(
  {
    iri: IRIReference,
    schemeIri: IRIReference,
    kind: ClassificationSchemeKind,
    edition: S.NonEmptyString,
    notation: S.NonEmptyString,
    prefLabel: S.NonEmptyString,
    broader: S.Array(IRIReference).check(S.isMaxLength(1)),
    depth: S.Int.check(S.isGreaterThanOrEqualTo(0)),
  },
  $I.annote("ClassificationConcept", {
    description: "An edition-scoped classification concept and its immediate broader identity.",
  })
) {}
/**
 * The immutable result of loading one explicitly pinned classification scheme.
 * **Example** (Read a snapshot edition)
 * ```ts
 * import type { ClassificationSnapshot } from "@beep/ontology/Classification.models"
 * const edition = (snapshot: ClassificationSnapshot) => snapshot.edition
 * console.log(edition)
 * ```
 * @category models
 * @since 0.0.0
 */
export class ClassificationSnapshot extends S.Class<ClassificationSnapshot>($I`ClassificationSnapshot`)(
  {
    schemeIri: IRIReference,
    kind: ClassificationSchemeKind,
    edition: S.NonEmptyString,
    concepts: S.Array(ClassificationConcept),
  },
  $I.annote("ClassificationSnapshot", {
    description: "A complete immutable concept set for one explicitly pinned scheme edition.",
  })
) {}
const ClassificationPinFields = S.Struct({
  kind: ClassificationSchemeKind,
  edition: S.Union([IpcEdition, NiceEdition]),
}).check(
  S.makeFilter(
    (pin) =>
      ClassificationSchemeKind.$match(pin.kind, {
        ipc: () => S.is(IpcEdition)(pin.edition),
        cpc: () => S.is(CpcEdition)(pin.edition),
        nice: () => S.is(NiceEdition)(pin.edition),
      }),
    {
      identifier: $I`ClassificationPinFields`,
      title: "Pinned Classification Edition",
      description: "An edition identifier in the requested authority's notation.",
    }
  )
);

/**
 * A caller must name both the scheme and the edition; there is no latest alias.
 * **Example** (Pin IPC explicitly)
 * ```ts
 * import { ClassificationPin } from "@beep/ontology/Classification.models"
 * ClassificationPin.make({ kind: "ipc", edition: "2026.01" })
 * ```
 * @category models
 * @since 0.0.0
 */
export class ClassificationPin extends S.Class<ClassificationPin>($I`ClassificationPin`)(
  ClassificationPinFields,
  $I.annote("ClassificationPin", {
    description: "The authority and edition a caller must name before loading or lookup.",
  })
) {}
const ClassificationFailureReason = LiteralKit([
  "symbol-not-found",
  "scheme-mismatch",
  "edition-unpinned",
  "source-parse",
  "manifest-invalid",
  "unvetted",
  "path-escape",
  "hierarchy-invalid",
]);

/**
 * A fail-closed classification boundary failure with a stable reason domain.
 * **Example** (Describe an absent symbol)
 * ```ts
 * import { ClassificationError } from "@beep/ontology/Classification.models"
 * ClassificationError.make({ reason: "symbol-not-found", detail: "A01B9999/00" })
 * ```
 * @category errors
 * @since 0.0.0
 */
export class ClassificationError extends S.TaggedError<ClassificationError>($I`ClassificationError`)(
  "ClassificationError",
  {
    reason: ClassificationFailureReason,
    detail: S.String,
  }
) {}

const classificationComposer = (pin: ClassificationPin) =>
  $SemanticFoundationId.create(`classification/${pin.kind}/${pin.edition}`);

/**
 * Mint the frozen scheme identity for one validated authority and edition.
 *
 * **Example** (Mint the IPC scheme IRI)
 *
 * ```ts
 * import { classificationSchemeIri, ClassificationPin } from "@beep/ontology/Classification.models"
 * const pin = ClassificationPin.make({ kind: "ipc", edition: "2026.01" })
 * console.log(classificationSchemeIri(pin))
 * ```
 *
 * @param pin - A schema-validated scheme and edition.
 * @returns The repository-owned IRI of the pinned concept scheme.
 * @category identifiers
 * @since 0.0.0
 */
export const classificationSchemeIri = (pin: ClassificationPin): IRIReference =>
  IRIReference.make(classificationComposer(pin).iri);

/**
 * Mint a concept identity within the pin's scheme; patent slashes become hyphens.
 *
 * **Example** (Keep an IPC code edition-scoped)
 *
 * ```ts
 * import { classificationConceptIri, ClassificationPin } from "@beep/ontology/Classification.models"
 * const pin = ClassificationPin.make({ kind: "ipc", edition: "2026.01" })
 * console.log(classificationConceptIri(pin, "A01B1/02"))
 * ```
 *
 * @param pin - A schema-validated scheme and edition.
 * @param notation - A canonical designation from the authority-specific symbol schema.
 * @returns The notation identity within the pinned scheme.
 * @category identifiers
 * @since 0.0.0
 */
export const classificationConceptIri: {
  (notation: string): (pin: ClassificationPin) => IRIReference;
  (pin: ClassificationPin, notation: string): IRIReference;
} = dual(
  2,
  (pin: ClassificationPin, notation: string): IRIReference =>
    IRIReference.make(classificationComposer(pin).create(`concept/${Str.replace("/", "-")(notation)}`).iri)
);
