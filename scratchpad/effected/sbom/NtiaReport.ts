// The NTIA minimum elements, as a report.
//
// Three design choices, each with a reason:
//
// - `id` is a stable literal, not a display string. Consumers branch on the
//   identifier; rendering a display name is presentation and belongs at the
//   edge.
// - No `suggestion` field. A library cannot know a consumer's config format,
//   so remediation advice naming a particular file would couple a kit package
//   to one repository.
// - A REPORT, not a failure. Compliance is a question: a caller may
//   legitimately emit a non-compliant SBOM and warn. `compliant` is a derived
//   getter, so a caller wanting a hard gate writes its own `Effect.fail`.
//
// @see https://www.ntia.gov/files/ntia/publications/sbom_minimum_elements_report.pdf

import { $ScratchpadId } from "@beep/identity/packages";
import { LiteralKit } from "@beep/schema/LiteralKit";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import type { SbomDocument } from "./SbomDocument.ts";

const $I = $ScratchpadId.create("effected/sbom/NtiaReport");

/**
 * The seven NTIA minimum elements, by stable identifier.
 *
 * **Details**
 *
 * A literal union rather than free text: this is what a consumer branches on,
 * and a display name is what it renders afterwards.
 *
 * **Example** (Decode a stable NTIA element identifier)
 *
 * ```ts
 * import { NtiaElementId } from "@beep/scratchpad/effected/sbom/NtiaReport"
 * import * as S from "effect/Schema"
 *
 * console.log(S.decodeUnknownSync(NtiaElementId)("supplierName")) // supplierName
 * ```
 *
 * @public
 * @category schemas
 * @since 0.0.0
 */
export const NtiaElementId = LiteralKit([
	"supplierName",
	"componentName",
	"componentVersion",
	"uniqueIdentifier",
	"dependencyRelationship",
	"sbomAuthor",
	"timestamp",
]).pipe($I.annoteSchema("NtiaElementId", { description: "The seven NTIA minimum elements, by stable identifier." }));

/**
 * The decoded type of {@link (NtiaElementId:variable)}.
 *
 * @public
 * @category type-level
 * @since 0.0.0
 */
export type NtiaElementId = typeof NtiaElementId.Type;

/**
 * One element's verdict.
 *
 * **Example** (Record a satisfied component name)
 *
 * ```ts
 * import { NtiaElement } from "@beep/scratchpad/effected/sbom/NtiaReport"
 *
 * const verdict = NtiaElement.make({ id: "componentName", satisfied: true, value: "lib" })
 * console.log(verdict.value) // lib
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class NtiaElement extends S.Class<NtiaElement>($I`NtiaElement`)({
	/** Which element this is. */
	id: NtiaElementId.annotateKey({ description: "Which element this is." }),
	/** Whether the document satisfies it. */
	satisfied: S.Boolean.annotateKey({ description: "Whether the document satisfies it." }),
	/** The value that satisfied it, when one did. */
	value: S.optionalKey(S.String).annotateKey({ description: "The value that satisfied it, when one did." }),
}, $I.annote("NtiaElement", { description: "One element's verdict." })) {}

const element = (id: NtiaElementId, value: string | undefined): NtiaElement =>
	NtiaElement.make({
		id,
		satisfied: value !== undefined,
		...(value !== undefined && { value }),
	});

const PresentText = S.String.check(S.isTrimmed(), S.isNonEmpty()).pipe(
	$I.annoteSchema("PresentText", { description: "Trimmed, non-empty text satisfying an NTIA element." }),
);
const isPresentText = S.is(PresentText);

const PackageIdentifier = PresentText.check(S.isStartingWith("pkg:")).pipe(
	$I.annoteSchema("PackageIdentifier", { description: "Present NTIA identifier text with a package URL prefix." }),
);
const isPackageIdentifier = S.is(PackageIdentifier);

/** A string that carries something, or nothing. */
const present = (value: string | undefined): string | undefined => {
	if (value === undefined) return undefined;
	const trimmed = Str.trim(value);
	return isPresentText(trimmed) ? trimmed : undefined;
};

/** Element 1: the entity that supplies the software. */
const supplierName = (document: SbomDocument): NtiaElement =>
	element("supplierName", present(document.metadata?.supplier?.name));

/** Element 2: what the software is called. */
const componentName = (document: SbomDocument): NtiaElement =>
	element("componentName", present(document.metadata?.component?.name));

/** Element 3: which release it is. */
const componentVersion = (document: SbomDocument): NtiaElement =>
	element("componentVersion", present(document.metadata?.component?.version));

/**
 * Element 4: an identifier that is unique across suppliers — a package URL.
 *
 * **Details**
 *
 * Present-and-non-empty is not enough: a homepage URL in the `purl` field is a
 * string, and identifies the component to nobody.
 */
const uniqueIdentifier = (document: SbomDocument): NtiaElement => {
	const purl = present(document.metadata?.component?.purl);
	return element("uniqueIdentifier", isPackageIdentifier(purl) ? purl : undefined);
};

/**
 * Element 5: how the components relate to the thing the BOM is about.
 *
 * **Details**
 *
 * A flat component list plus a declared root IS that relationship in this
 * version — the CycloneDX `dependencies` graph is deferred until a consumer
 * needs one. What the element therefore requires is a declared **subject**: a
 * list of components with nothing saying what they are components OF relates
 * nothing to anything.
 *
 * An empty list is compliant. "This package has no dependencies" is an
 * assertion, not a gap.
 */
const dependencyRelationship = (document: SbomDocument): NtiaElement => {
	const count = document.components.length;
	return element(
		"dependencyRelationship",
		document.metadata?.component === undefined ? undefined : `${count} component${count === 1 ? "" : "s"}`,
	);
};

/**
 * Element 6: who assembled the BOM.
 *
 * **Details**
 *
 * Named authors first; a supplier or a publisher is the honest fallback, since
 * both identify an entity that stood behind the document.
 */
const sbomAuthor = (document: SbomDocument): NtiaElement => {
	const author = document.metadata?.authors?.map((contact) => present(contact.name)).find((name) => name !== undefined);
	const supplier = present(document.metadata?.supplier?.name);
	const publisher = present(document.metadata?.component?.publisher);
	return element("sbomAuthor", author ?? supplier ?? publisher);
};

const parseTimestamp = S.decodeUnknownResult(S.DateFromString);

/**
 * Element 7: when the BOM was assembled.
 *
 * **Details**
 *
 * Parsed, not merely present — a field holding `last tuesday` records nothing,
 * and this is the cheapest place to notice.
 */
const timestamp = (document: SbomDocument): NtiaElement => {
	const stamped = present(document.metadata?.timestamp);
	return element("timestamp", stamped !== undefined && parseTimestamp(stamped)._tag === "Success" ? stamped : undefined);
};

/**
 * A document's standing against the NTIA minimum elements.
 *
 * **Example** (Check an SBOM for missing NTIA elements)
 *
 * ```ts
 * import { Component } from "@beep/scratchpad/effected/sbom/SbomDocument"
 * import { NtiaReport } from "@beep/scratchpad/effected/sbom/NtiaReport"
 * import { Sbom } from "@beep/scratchpad/effected/sbom/Sbom"
 *
 * const root = Component.make({ type: "library", name: "lib", version: "1.0.0" })
 * const report = NtiaReport.of(Sbom.generate({ root, components: [] }))
 *
 * console.log(report.compliant) // false
 * console.log(report.missing.join(", ")) // supplierName, uniqueIdentifier, sbomAuthor, timestamp
 * ```
 *
 * @public
 * @category models
 * @since 0.0.0
 */
export class NtiaReport extends S.Class<NtiaReport>($I`NtiaReport`)({
	/** One verdict per element, in the published order. */
	elements: S.Array(NtiaElement).annotateKey({ description: "One verdict per element, in the published order." }),
}, $I.annote("NtiaReport", { description: "A document's standing against the NTIA minimum elements." })) {
	/**
	 * Whether every element is satisfied.
	 *
	 * **Example** (Inspect a report with no unsatisfied verdicts)
	 *
	 * ```ts
	 * import { NtiaReport } from "@beep/scratchpad/effected/sbom/NtiaReport"
	 *
	 * const report = NtiaReport.make({ elements: [] })
	 * console.log(report.compliant) // true
	 * ```
	 *
	 * @category predicates
	 * @since 0.0.0
	 */
	get compliant(): boolean {
		return this.elements.every((entry) => entry.satisfied);
	}

	/**
	 * The elements the document does not satisfy, by id.
	 *
	 * **Example** (Find an unsatisfied supplier element)
	 *
	 * ```ts
	 * import { NtiaElement, NtiaReport } from "@beep/scratchpad/effected/sbom/NtiaReport"
	 *
	 * const report = NtiaReport.make({
	 *   elements: [NtiaElement.make({ id: "supplierName", satisfied: false })]
	 * })
	 * console.log(report.missing.join(", ")) // supplierName
	 * ```
	 *
	 * @category getters
	 * @since 0.0.0
	 */
	get missing(): ReadonlyArray<NtiaElementId> {
		return this.elements.filter((entry) => !entry.satisfied).map((entry) => entry.id);
	}

	/**
	 * Check a document against the seven NTIA minimum elements.
	 *
	 * **Details**
	 *
	 * **Total** — a report is the answer for every input,
	 * including a document that satisfies nothing.
	 *
	 * **Example** (Report missing elements for a minimal document)
	 *
	 * ```ts
	 * import { Component } from "@beep/scratchpad/effected/sbom/SbomDocument"
	 * import { NtiaReport } from "@beep/scratchpad/effected/sbom/NtiaReport"
	 * import { Sbom } from "@beep/scratchpad/effected/sbom/Sbom"
	 *
	 * const root = Component.make({ type: "library", name: "lib" })
	 * const report = NtiaReport.of(Sbom.generate({ root, components: [] }))
	 * console.log(report.missing.includes("componentVersion")) // true
	 * ```
	 *
	 * @category constructors
	 * @since 0.0.0
	 */
	static of(document: SbomDocument): NtiaReport {
		return NtiaReport.make({
			elements: [
				supplierName(document),
				componentName(document),
				componentVersion(document),
				uniqueIdentifier(document),
				dependencyRelationship(document),
				sbomAuthor(document),
				timestamp(document),
			],
		});
	}
}
