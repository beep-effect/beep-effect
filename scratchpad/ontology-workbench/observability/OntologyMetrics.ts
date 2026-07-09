/**
 * @fileoverview Pure ontology-metrics math.
 *
 * This module contains ONLY pure functions: the component gathers raw counts
 * (via SPARQL COUNT queries and getGraphCounts) and hands them here to derive
 * the displayed ratios. Keeping the math here makes it unit-testable without a
 * worker, a DOM, or any I/O.
 *
 * IMPORTANT — these "quality" ratios are deliberately simple heuristics. They
 * are *OQuaRE-flavored* (inspired by the structural metrics OQuaRE builds on)
 * but they are NOT a certified OQuaRE assessment. Treat them as quick,
 * directional signals, not a formal quality score.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {$ScratchpadId} from "@beep/identity";
import * as S from "effect/Schema";

import {P, dual} from "@beep/utils";

const $I = $ScratchpadId.create("ontology-workbench/observability/OntologyMetrics");

/**
 * Raw counts gathered by the panel before any ratios are derived.
 *
 * **Example**
 *
 * ```ts
 *
 * ```
 *
 * @category metrics
 * @since 0.0.0
 */
export class OntologyRawCounts extends S.Class<OntologyRawCounts>($I`OntologyRawCounts`)({
	/** Total triples in the asserted data graph (urn:vg:data). */
	totalTriples: S.Finite.annotateKey({description: "Total triples in the asserted data graph (urn:vg:data)."}),
	/** Distinct rdfs:Class / owl:Class subjects. */
	classCount: S.Finite.annotateKey({description: "Distinct rdfs:Class / owl:Class subjects."}),
	/** Distinct owl:ObjectProperty subjects. */
	objectPropertyCount: S.Finite.annotateKey({description: "Distinct owl:ObjectProperty subjects."}),
	/** Distinct owl:DatatypeProperty subjects. */
	datatypePropertyCount: S.Finite.annotateKey({description: "Distinct owl:DatatypeProperty subjects."}),
	/** Distinct owl:NamedIndividual subjects. */
	namedIndividualCount: S.Finite.annotateKey({description: ""}),
	/** Distinct subjects of any triple in the data graph. */
	subjectCount: S.Finite.annotateKey({description: "Distinct subjects of any triple in the data graph."}),
	/** Distinct classes carrying at least one rdfs:label. */
	labeledClassCount: S.Finite.annotateKey({description: "Distinct classes carrying at least one rdfs:label."}),
	/** Asserted triples (urn:vg:data) — usually equals totalTriples. */
	assertedTriples: S.Finite.annotateKey({description: "Asserted triples (urn:vg:data) — usually equals totalTriples."}),
	/** Inferred triples produced by reasoning (urn:vg:inferred). */
	inferredTriples: S.Finite.annotateKey({description: "Inferred triples produced by reasoning (urn:vg:inferred)."}),
}, $I.annote("OntologyRawCounts", {
	description: "Raw counts gathered by the panel before any ratios are derived.",
})) {
}


/**
 * Derived, display-ready heuristic ratios. All are non-negative finite numbers.
 *
 * **Example**
 *
 * ```ts
 * ```
 *
 * @category metrics
 * @since 0.0.0
 */
export class OntologyMetrics extends S.Class<OntologyMetrics>($I`OntologyMetrics`)({
	/** objectProperties + datatypeProperties. */
	totalPropertyCount: S.Finite.check(S.isGreaterThanOrEqualTo(0))
		.annotateKey({description: "objectProperties + datatypeProperties."}),
	/** Average properties per class = totalProperties / classes (0 if no classes). */
	avgPropertiesPerClass: S.Finite.check(S.isGreaterThanOrEqualTo(0))
		.annotateKey({description: "Average properties per class = totalProperties / classes (0 if no classes)."}),
	/** classes / properties (0 if no properties). */
	classToPropertyRatio: S.Finite.check(S.isGreaterThanOrEqualTo(0))
		.annotateKey({description: "classes / properties (0 if no properties)."}),
	/** Fraction of classes carrying an rdfs:label, in [0, 1] (0 if no classes). */
	labeledClassRatio: S.Finite.check(S.isGreaterThanOrEqualTo(0))
		.annotateKey({description: "Fraction of classes carrying an rdfs:label, in [0, 1] (0 if no classes)."}),
	/** inferred / asserted (0 if nothing asserted). */
	inferredToAssertedRatio: S.Finite.check(S.isGreaterThanOrEqualTo(0))
		.annotateKey({description: "inferred / asserted (0 if nothing asserted)."}),
	/** Convenience percentage form of labeledClassRatio, in [0, 100]. */
	labeledClassPercent: S.Finite.check(S.isGreaterThanOrEqualTo(0))
		.annotateKey({description: "Convenience percentage form of labeledClassRatio, in [0, 100]."}),
}, $I.annote("OntologyMetrics", {
	description: "Derived, display-ready heuristic ratios. All are non-negative finite numbers.",
})) {
	static readonly safeRatio: {
		(numerator: number, denominator: number): number,
		(denominator: number): (numerator: number) => number
	} = dual(2, (numerator: number, denominator: number): number => {
		if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) return 0;
		if (denominator === 0) return 0;
		return numerator / denominator;
	})

	/** Coerce an arbitrary count-like value into a non-negative finite integer-ish number. */
	static readonly nonNeg = (value: number | undefined | null): number => {
		const n = P.isNumber(value)
			? value
			: Number(value);
		if (!Number.isFinite(n) || n < 0) return 0;
		return n;
	}

	/**
	 * Compute the derived heuristic metrics from raw gathered counts.
	 *
	 * Pure: same input → same output, no side effects. Robust to missing/NaN/negative
	 * inputs (treated as 0) so the panel never renders NaN.
	 */
	static readonly computeOntologyMetrics = (raw: Partial<OntologyRawCounts>): OntologyMetrics => {
		const classCount = OntologyMetrics.nonNeg(raw.classCount);
		const objectPropertyCount = OntologyMetrics.nonNeg(raw.objectPropertyCount);
		const datatypePropertyCount = OntologyMetrics.nonNeg(raw.datatypePropertyCount);
		const labeledClassCount = OntologyMetrics.nonNeg(raw.labeledClassCount);
		const assertedTriples = OntologyMetrics.nonNeg(raw.assertedTriples);
		const inferredTriples = OntologyMetrics.nonNeg(raw.inferredTriples);

		const totalPropertyCount = objectPropertyCount + datatypePropertyCount;
		const labeledClassRatio = OntologyMetrics.safeRatio(labeledClassCount, classCount);

		return {
			totalPropertyCount,
			avgPropertiesPerClass: OntologyMetrics.safeRatio(totalPropertyCount, classCount),
			classToPropertyRatio: OntologyMetrics.safeRatio(classCount, totalPropertyCount),
			labeledClassRatio,
			inferredToAssertedRatio: OntologyMetrics.safeRatio(inferredTriples, assertedTriples),
			labeledClassPercent: labeledClassRatio * 100,
		};
	}

	/** Format a ratio for compact display (e.g. 2.5), trimming trailing zeros. */
	static readonly formatRatio = (value: number, fractionDigits = 2): string => {
		if (!Number.isFinite(value)) return '—';
		const fixed = value.toFixed(fractionDigits);
		return fixed.replace(/\.?0+$/, '') || '0';
	}

	/** Format a [0,1] ratio as a whole-number percentage string (e.g. "50%"). */
	static readonly formatPercent = (ratio: number): string => {
		if (!Number.isFinite(ratio)) return '—';
		return `${Math.round(ratio * 100)}%`;
	}
}







