/**
 * OWL/RDFS/RDF meta-ontology axioms (domain and range declarations).
 *
 * These axioms are seeded into urn:vg:ontologies by the worker at startup so
 * that the fat-map reconciliation (buildFatMap / updateFatMap) automatically
 * produces ObjectProperty entries with correct domain[] and range[] data.
 * The mapper then derives TBOX_STRUCT_BOTH_SIDES and TBOX_STRUCT_SUBJ_ONLY
 * from that fat-map data — no hardcoded predicate lists in the mapper.
 *
 * Sources:
 *   https://www.w3.org/TR/owl2-rdf-based-semantics/ (OWL 2 meta-ontology)
 *   https://www.w3.org/TR/rdf-schema/ (RDFS meta-ontology)
 *   https://www.w3.org/TR/rdf-syntax-grammar/ (RDF meta-ontology)
 */
import {$ScratchpadId} from "@beep/identity";
import * as S from "effect/Schema";
import {SchemaUtils} from "@beep/schema";
import {O} from "@beep/utils";

const $I = $ScratchpadId.create("ontology-workbench/constants/OwlSchemaData");

const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
const OWL = "http://www.w3.org/2002/07/owl#";


export class SchemaPredicateAxiom extends S.Class<SchemaPredicateAxiom>($I`SchemaPredicateAxiom`)({
	predicate: S.String,
	domain: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
	range: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
}, $I.annote("SchemaPredicateAxiom", {
	description: "A predicate axiom in the OWL schema.",
})) {
}

export const OWL_SCHEMA_AXIOMS: readonly SchemaPredicateAxiom[] = [

	// ── RDFS structural predicates ────────────────────────────────────────────
	{
		predicate: `${RDFS}subClassOf`,
		domain: O.some(`${RDFS}Class`),
		range: O.some(`${RDFS}Class`),
	},
	{
		predicate: `${RDFS}subPropertyOf`,
		domain: O.some(`${RDF}Property`),
		range: O.some(`${RDF}Property`),
	},
	{
		predicate: `${RDFS}domain`,
		domain: O.some(`${RDF}Property`),
		range: O.some(`${RDFS}Class`),
	},
	{
		predicate: `${RDFS}range`,
		domain: O.some(`${RDF}Property`),
		range: O.some(`${RDFS}Class`),
	},

	// ── OWL class-expression predicates (both subject and object are TBox) ────
	{
		predicate: `${OWL}equivalentClass`,
		domain: O.some(`${OWL}Class`),
		range: O.some(`${OWL}Class`),
	},
	{
		predicate: `${OWL}disjointWith`,
		domain: O.some(`${OWL}Class`),
		range: O.some(`${OWL}Class`),
	},
	{
		predicate: `${OWL}complementOf`,
		domain: O.some(`${OWL}Class`),
		range: O.some(`${OWL}Class`),
	},
	{
		predicate: `${OWL}onProperty`,
		domain: O.some(`${OWL}Restriction`),
		range: O.some(`${RDF}Property`),
	},
	{
		predicate: `${OWL}allValuesFrom`,
		domain: O.some(`${OWL}Restriction`),
		range: O.some(`${RDFS}Class`),
	},
	{
		predicate: `${OWL}someValuesFrom`,
		domain: O.some(`${OWL}Restriction`),
		range: O.some(`${RDFS}Class`),
	},
	{
		predicate: `${OWL}onClass`,
		domain: O.some(`${OWL}Restriction`),
		range: O.some(`${OWL}Class`),
	},
	{
		predicate: `${OWL}onDataRange`,
		domain: O.some(`${OWL}Restriction`),
		range: O.some(`${RDFS}Datatype`),
	},
	{
		predicate: `${OWL}inverseOf`,
		domain: O.some(`${OWL}ObjectProperty`),
		range: O.some(`${OWL}ObjectProperty`),
	},
	{
		predicate: `${OWL}equivalentProperty`,
		domain: O.some(`${RDF}Property`),
		range: O.some(`${RDF}Property`),
	},
	{
		predicate: `${OWL}propertyDisjointWith`,
		domain: O.some(`${RDF}Property`),
		range: O.some(`${RDF}Property`),
	},

	// ── OWL predicates where ONLY the subject is TBox ─────────────────────────
	//    (range is rdf:List of individuals, or an individual — not a class)
	SchemaPredicateAxiom.make({
		predicate: `${OWL}propertyChainAxiom`,
		domain: O.some(`${OWL}ObjectProperty`),
	}),
	SchemaPredicateAxiom.make({
		predicate: `${OWL}hasValue`,
		domain: O.some(`${OWL}Restriction`),
	}),
	SchemaPredicateAxiom.make({
		predicate: `${OWL}intersectionOf`,
		domain: O.some(`${OWL}Class`),
	}),
	SchemaPredicateAxiom.make({
		predicate: `${OWL}unionOf`,
		domain: O.some(`${OWL}Class`),
	}),
	SchemaPredicateAxiom.make({
		predicate: `${OWL}oneOf`,
		domain: O.some(`${OWL}Class`),
	}),

	// ── OWL n-ary axiom predicates ────────────────────────────────────────────
	// owl:members is polymorphic: AllDisjointClasses/AllDisjointProperties (TBox) entry below;
	// owl:AllDifferent also uses owl:members (ABox) — handled specially in the mapper pre-scan.
	SchemaPredicateAxiom.make({
		predicate: `${OWL}members`,
		domain: O.some(`${OWL}AllDisjointClasses`),
	}),
	SchemaPredicateAxiom.make({
		predicate: `${OWL}distinctMembers`,
		domain: O.some(`${OWL}AllDifferent`),
	}),

	// ── OWL predicates missing from the original list (domain is a TBox metaclass) ──
	// These were absent from the bootstrap seed, causing their list cons-cells to be
	// mis-classified as ABox.  Adding them here ensures the fat-map has correct data
	// from worker startup — no mapper code changes required.
	//
	// owl:disjointUnionOf: subject is owl:Class (TBox), range is rdf:List of member classes
	SchemaPredicateAxiom.make({
		predicate: `${OWL}disjointUnionOf`,
		domain: O.some(`${OWL}Class`),
	}),
	// owl:hasKey: subject is owl:Class (TBox), range is rdf:List of key properties
	SchemaPredicateAxiom.make({
		predicate: `${OWL}hasKey`,
		domain: O.some(`${OWL}Class`),
	}),
	// owl:hasSelf: subject is owl:Restriction (TBox), range is rdfs:Resource (literal boolean)
	SchemaPredicateAxiom.make({
		predicate: `${OWL}hasSelf`,
		domain: O.some(`${OWL}Restriction`),
	}),
];

/**
 * W3C metaclass IRIs — the single source of truth for TBox classification.
 *
 * A node whose rdf:type contains any of these is a TBox entity (it IS a class,
 * property, restriction, or structural schema axiom).  Everything else is either
 * ABox or unknown.
 *
 * Derivation: these are the types defined in the RDF 1.1, RDFS, and OWL 2 specs
 * themselves.  They are irreducible bootstrap vocabulary — you must know what
 * rdf:type owl:Class means to bootstrap any OWL reasoning.
 *
 * Intentional omissions:
 *   - owl:AllDifferent   — ABox axiom (asserts individuals are distinct)
 *   - owl:Thing / owl:Nothing — too broad, instances are ABox individuals
 *
 * Also used by the mapper when testing availableProperties[].domain / .range to
 * decide whether a predicate is schema-structural (TBOX_STRUCT_* sets).
 */
export const SCHEMA_TBOX_CLASS_IRIS = new Set<string>([
	// ── Core RDF / RDFS metaclasses ───────────────────────────────────────────
	`${RDFS}Class`,
	`${RDF}Property`,
	`${RDFS}Datatype`,

	// ── OWL class and property metaclasses ────────────────────────────────────
	`${OWL}Class`,
	`${OWL}ObjectProperty`,
	`${OWL}DatatypeProperty`,
	`${OWL}AnnotationProperty`,

	// ── OWL class-expression types ────────────────────────────────────────────
	`${OWL}Restriction`,

	// ── OWL structural axiom types (TBox — defined in the schema layer) ───────
	`${OWL}AllDisjointClasses`,
	`${OWL}AllDisjointProperties`,
	`${OWL}Ontology`,
	`${OWL}Axiom`,

	// ── OWL property characteristic types ────────────────────────────────────
	`${OWL}TransitiveProperty`,
	`${OWL}SymmetricProperty`,
	`${OWL}AsymmetricProperty`,
	`${OWL}ReflexiveProperty`,
	`${OWL}IrreflexiveProperty`,
	`${OWL}FunctionalProperty`,
	`${OWL}InverseFunctionalProperty`,
]);
