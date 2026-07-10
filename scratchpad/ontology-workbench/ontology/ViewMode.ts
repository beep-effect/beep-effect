/**
 * @fileoverview Type definitions for ontology-related data structures
 * Provides comprehensive TypeScript interfaces for RDF/OWL ontology components,
 * knowledge graph entities, and related metadata.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import {$ScratchpadId} from "@beep/identity";
import {IRI} from "@beep/rdf";
import * as S from "effect/Schema";
import {Fn, LiteralKit, NonNegativeInt, SchemaUtils} from "@beep/schema";
import {Percentage} from "@beep/schema/Percentage";

const $I = $ScratchpadId.create("ontology-workbench/ontology/ViewMode");

/**
 * Represents a namespace mapping in an ontology
 *
 * @category models
 * @since 0.0.0
 */
export class NamespaceMap extends S.Class<NamespaceMap>($I`NamespaceMap`)({
	/** The namespace prefix (e.g., 'foaf', 'owl') */
	prefix: S.String.annotateKey({
		description: "The namespace prefix (e.g., 'foaf', 'owl')",
	}),
	/** The full URI of the namespace */
	iri: IRI.annotateKey({
		description: "The full URI of the namespace",
	}),
	/** Optional visualization color assigned by the reconciler/palette builder */
	color: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault, $I.annoteKey("NamespaceMap.color", {
		description: "Optional visualization color assigned by the reconciler/palette builder",
	})),
}, $I.annote("NamespaceMap", {
	description: "Represents a namespace mapping in an ontology",
})) {
}


export declare namespace NamespaceMap {
	export type Encoded = typeof NamespaceMap.Encoded;
}

/**
 * Represents an ontology class definition
 *
 * @category models
 * @since 0.0.0
 */
export class OntologyClass extends S.Class<OntologyClass>($I`OntologyClass`)({
	/** Unique identifier/URI for the class */
	iri: S.String.annotateKey({description: "Unique identifier/URI for the class"}),
	/** Human-readable label for the class */
	label: S.String.annotateKey({description: "Human-readable label for the class"}),
	/** Namespace prefix this class belongs to */
	namespace: S.String.pipe(S.annotateKey({description: "Namespace prefix this class belongs to"})),
	/** Array of property URIs associated with this class */
	properties: S.String.pipe(
		S.Array,
		S.annotateKey({description: "Array of property URIs associated with this class"}),
	),
	/** Class restrictions and constraints */
	restrictions: S.Record(S.String, S.Unknown).annotateKey({description: "Class restrictions and constraints"}),
	/** Optional description of the class */
	description: S.String.pipe(
		S.OptionFromOptionalKey,
		SchemaUtils.withNoneDefault,
		S.annotateKey({description: "Optional description of the class"}),
	),
	/** Parent classes (superclasses) */
	superClasses: S.String.pipe(
		S.Array,
		S.OptionFromOptionalKey,
		SchemaUtils.withNoneDefault,
		S.annotateKey({description: "Parent classes (superclasses)"}),
	),
	/** Child classes (subclasses) */
	subClasses: S.String.pipe(
		S.Array,
		S.OptionFromOptionalKey,
		SchemaUtils.withNoneDefault,
		S.annotateKey({description: "Child classes (subclasses)"}),
	),
}, $I.annote("OntologyClass", {
	description: "Represents an ontology class definition",
})) {
}

export declare namespace OntologyClass {
	export type Encoded = typeof OntologyClass.Encoded;
}


/**
 * Represents an object property in an ontology
 */
export class ObjectProperty extends S.Class<ObjectProperty>($I`ObjectProperty`)({
	/** Unique identifier/URI for the property */
	iri: IRI.annotateKey({description: "Unique identifier/URI for the property"}),
	/** Human-readable label for the property */
	label: S.String.annotateKey({description: "Human-readable label for the property"}),
	/** Array of valid domain classes for this property */
	domain: S.String.pipe(S.Array, S.annotateKey({description: "Array of valid domain classes for this property"})),
	/** Array of valid range classes for this property */
	range: S.String.pipe(S.Array, S.annotateKey({description: "Array of valid range classes for this property"})),
	/** Namespace prefix this property belongs to */
	namespace: S.String.annotateKey({description: "Namespace prefix this property belongs to"}),
	/** Optional description of the property */
	description: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault, S.annotateKey({
		description: "Optional description of the property",
	})),
	/** Whether this property is functional */
	isFunctional: S.Boolean.pipe(
		S.OptionFromOptionalKey,
		SchemaUtils.withNoneDefault,
		S.annotateKey({description: "Whether this property is functional"}),
	),
	/** Whether this property is inverse functional */
	isInverseFunctional: S.Boolean.pipe(
		S.OptionFromOptionalKey,
		SchemaUtils.withNoneDefault,
		S.annotateKey({description: "Whether this property is inverse functional"}),
	),
	/** Whether this property is transitive */
	isTransitive: S.Boolean.pipe(
		S.OptionFromOptionalKey,
		SchemaUtils.withNoneDefault,
		S.annotateKey({description: "Whether this property is transitive"}),
	),
	/** Whether this property is symmetric */
	isSymmetric: S.Boolean.pipe(
		S.OptionFromOptionalKey,
		SchemaUtils.withNoneDefault,
		S.annotateKey({description: "Whether this property is symmetric"}),
	),
}, $I.annote("ObjectProperty", {
	description: "Represents an object property in an ontology",
})) {
}

/**
 * Represents an annotation property in an ontology
 */
export class AnnotationProperty extends S.Class<AnnotationProperty>($I`AnnotationProperty`)({
	/** Unique identifier/URI for the annotation property */
	iri: IRI.annotateKey({description: "Unique identifier/URI for the annotation property"}),
	/** Human-readable label for the annotation property */
	label: S.String.annotateKey({description: "Human-readable label for the annotation property"}),
	/** Namespace prefix this property belongs to */
	namespace: S.String.annotateKey({description: "Namespace prefix this property belongs to"}),
	/** Optional description of the annotation property */
	description: S.String.pipe(
		S.OptionFromOptionalKey,
		SchemaUtils.withNoneDefault,
		S.annotateKey({description: "Optional description of the annotation property"}),
	),
}, $I.annote("AnnotationProperty", {
	description: "Represents an annotation property in an ontology",
})) {
}


/**
 * Metadata about the ontology
 */
export class OntologyMetadata extends S.Class<OntologyMetadata>($I`OntologyMetadata`)({
	version: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotateKey({
		description: "Version of the ontology",
	}),
	description: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotateKey({
		description: "Optional description of the ontology",
	}),
	creator: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotateKey({
		description: "Creator of the ontology",
	}),
	created: S.DateTimeUtcFromDate.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
	modified: S.DateTimeUtcFromDate.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault),
}, $I.annote("OntologyMetadata", {
	description: "Metadata about the ontology",
})) {
}


/**
 * Represents a loaded ontology with all its components
 */
export class LoadedOntology extends S.Class<LoadedOntology>($I`LoadedOntology`)(
	{
		/** URL or identifier where the ontology was loaded from */
		url: S.URLFromString.annotateKey({
			description: "URL or identifier where the ontology was loaded from"
		}),
		/** Display name for the ontology */
		name: S.String.pipe(S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotateKey({
			description: "Display name for the ontology"
		}),
		/** All classes defined in this ontology */
		classes: OntologyClass.pipe(S.Array, SchemaUtils.withEmptyArrayDefaults).annotateKey({
			description: "All classes defined in this ontology"
		}),
		/** All object properties defined in this ontology */
		properties: ObjectProperty.pipe(S.Array, SchemaUtils.withEmptyArrayDefaults).annotateKey({
			description: "All object properties defined in this ontology"
		}),
		/** All annotation properties defined in this ontology */
		annotationProperties: AnnotationProperty.pipe(S.Array, S.OptionFromOptionalKey, SchemaUtils.withNoneDefault).annotateKey({
			description: "All annotation properties defined in this ontology"
		}),
		/** Namespace mappings used in this ontology (prefix -> NamespaceMap with iri + optional color) */
		namespaces: S.Record(S.String, NamespaceMap).annotateKey({
			description: "Namespace mappings used in this ontology (prefix -> NamespaceMap with iri + optional color)"
		}),
		/** Metadata about the ontology */
		metadata: OntologyMetadata.pipe(
			S.OptionFromOptionalKey,
			SchemaUtils.withNoneDefault
		).annotateKey({
			description: "Metadata about the ontology"
		})
	},
	$I.annote("LoadedOntology", {
		description: "Represents a loaded ontology with all its components"
	})
) {}

/**
 * Severity level of a validation error.
 *
 * @category schemas
 * @since 0.0.0
 */
export const ValidationSeverity = LiteralKit(["error", "warning", "info"]).pipe(
	$I.annoteSchema("ValidationSeverity", {
		description: "Severity level of a validation error",
	}),
);

export type ValidationSeverity = typeof ValidationSeverity.Type;

/**
 * Type of validation that failed.
 *
 * @category schemas
 * @since 0.0.0
 */
export const ValidationErrorType = LiteralKit(["domain", "range", "cardinality", "type", "syntax"]).pipe(
	$I.annoteSchema("ValidationErrorType", {
		description: "Type of validation that failed",
	}),
);

export type ValidationErrorType = typeof ValidationErrorType.Type;

/**
 * Represents a validation error in the knowledge graph
 *
 * @category models
 * @since 0.0.0
 */
export class ValidationError extends S.Class<ValidationError>($I`ValidationError`)({
	/** ID of the entity (node/edge) that has the error */
	nodeId: S.String.annotateKey({description: "ID of the entity (node/edge) that has the error"}),
	/** Human-readable error message */
	message: S.String.annotateKey({description: "Human-readable error message"}),
	/** Severity level of the error */
	severity: ValidationSeverity.annotateKey({description: "Severity level of the error"}),
	/** Type of validation that failed */
	type: ValidationErrorType.pipe(
		S.OptionFromOptionalKey,
		SchemaUtils.withNoneDefault,
		S.annotateKey({description: "Type of validation that failed"}),
	),
	/** Suggested fix for the error */
	suggestion: S.String.pipe(
		S.OptionFromOptionalKey,
		SchemaUtils.withNoneDefault,
		S.annotateKey({description: "Suggested fix for the error"}),
	),
}, $I.annote("ValidationError", {
	description: "Represents a validation error in the knowledge graph",
})) {
}

/**
 * Represents a literal property value on an entity
 *
 * @category models
 * @since 0.0.0
 */
export class LiteralProperty extends S.Class<LiteralProperty>($I`LiteralProperty`)({
	/** Property URI or name */
	key: S.String.annotateKey({description: "Property URI or name"}),
	/** The literal value */
	value: S.String.annotateKey({description: "The literal value"}),
	/** Data type of the literal (e.g., 'xsd:string', 'xsd:integer') */
	datatype: S.String.pipe(
		S.OptionFromOptionalKey,
		SchemaUtils.withNoneDefault,
		S.annotateKey({description: "Data type of the literal (e.g., 'xsd:string', 'xsd:integer')"}),
	),
	/** Language tag for string literals */
	language: S.String.pipe(
		S.OptionFromOptionalKey,
		SchemaUtils.withNoneDefault,
		S.annotateKey({description: "Language tag for string literals"}),
	),
}, $I.annote("LiteralProperty", {
	description: "Represents a literal property value on an entity",
})) {
}

/**
 * Represents an annotation property value on an entity
 *
 * @category models
 * @since 0.0.0
 */
export class AnnotationPropertyValue extends S.Class<AnnotationPropertyValue>($I`AnnotationPropertyValue`)({
	/** Annotation property URI */
	property: IRI.annotateKey({description: "Annotation property URI"}),
	/** The annotation value */
	value: S.String.annotateKey({description: "The annotation value"}),
	/** Data type of the annotation value */
	datatype: S.String.pipe(
		S.OptionFromOptionalKey,
		SchemaUtils.withNoneDefault,
		S.annotateKey({description: "Data type of the annotation value"}),
	),
	/** Language tag for string annotation values */
	language: S.String.pipe(
		S.OptionFromOptionalKey,
		SchemaUtils.withNoneDefault,
		S.annotateKey({description: "Language tag for string annotation values"}),
	),
}, $I.annote("AnnotationPropertyValue", {
	description: "Represents an annotation property value on an entity",
})) {
}

/**
 * Available entity types in the knowledge graph.
 *
 * @category schemas
 * @since 0.0.0
 */
export const EntityType = LiteralKit(["class", "individual", "property", "annotation"]).pipe(
	$I.annoteSchema("EntityType", {
		description: "Available entity types in the knowledge graph",
	}),
);

export type EntityType = typeof EntityType.Type;

/**
 * Available RDF types for entities.
 *
 * @category schemas
 * @since 0.0.0
 */
export const RDFType = LiteralKit([
	"owl:Class",
	"owl:NamedIndividual",
	"owl:ObjectProperty",
	"owl:DatatypeProperty",
	"owl:AnnotationProperty",
	"rdfs:Class",
	"rdf:Property",
]).pipe(
	$I.annoteSchema("RDFType", {
		description: "Available RDF types for entities",
	}),
);

export type RDFType = typeof RDFType.Type;

/**
 * Represents an entity in the knowledge graph (for autocomplete and UI)
 *
 * @category models
 * @since 0.0.0
 */
export class KnowledgeGraphEntity extends S.Class<KnowledgeGraphEntity>($I`KnowledgeGraphEntity`)({
	/** Unique URI identifier */
	iri: IRI.annotateKey({description: "Unique URI identifier"}),
	/** Human-readable label */
	label: S.String.annotateKey({description: "Human-readable label"}),
	/** Namespace prefix */
	namespace: S.String.annotateKey({description: "Namespace prefix"}),
	/** RDF type of the entity */
	rdfType: RDFType.annotateKey({description: "RDF type of the entity"}),
	/** Entity type category */
	entityType: EntityType.pipe(
		S.OptionFromOptionalKey,
		SchemaUtils.withNoneDefault,
		S.annotateKey({description: "Entity type category"}),
	),
	/** Optional description */
	description: S.String.pipe(
		S.OptionFromOptionalKey,
		SchemaUtils.withNoneDefault,
		S.annotateKey({description: "Optional description"}),
	),
	/** Additional RDF types */
	rdfTypes: S.String.pipe(
		S.Array,
		S.OptionFromOptionalKey,
		SchemaUtils.withNoneDefault,
		S.annotateKey({description: "Additional RDF types"}),
	),
}, $I.annote("KnowledgeGraphEntity", {
	description: "Represents an entity in the knowledge graph (for autocomplete and UI)",
})) {
}

/**
 * Represents progress information for long-running operations
 *
 * @category models
 * @since 0.0.0
 */
export class LoadingProgress extends S.Class<LoadingProgress>($I`LoadingProgress`)({
	/** Current progress percentage (0-100) */
	progress: Percentage.annotateKey({description: "Current progress percentage (0-100)"}),
	/** Current operation message */
	message: S.String.annotateKey({description: "Current operation message"}),
	/** Current step number */
	step: NonNegativeInt.pipe(
		S.OptionFromOptionalKey,
		SchemaUtils.withNoneDefault,
		S.annotateKey({description: "Current step number"}),
	),
	/** Total number of steps */
	totalSteps: NonNegativeInt.pipe(
		S.OptionFromOptionalKey,
		SchemaUtils.withNoneDefault,
		S.annotateKey({description: "Total number of steps"}),
	),
}, $I.annote("LoadingProgress", {
	description: "Represents progress information for long-running operations",
})) {
}

/**
 * Progress callback function.
 *
 * @category schemas
 * @since 0.0.0
 */
export const LoadingProgressCallback = Fn({
	input: LoadingProgress,
	output: S.Void,
}).pipe(
	$I.annoteSchema("LoadingProgressCallback", {
		description: "Progress callback function",
	}),
);

export type LoadingProgressCallback = typeof LoadingProgressCallback.Type;

/**
 * Configuration options for loading ontologies
 *
 * @category models
 * @since 0.0.0
 */
export class OntologyLoadOptions extends S.Class<OntologyLoadOptions>($I`OntologyLoadOptions`)({
	/** Progress callback function */
	onProgress: LoadingProgressCallback.pipe(
		S.OptionFromOptionalKey,
		SchemaUtils.withNoneDefault,
		S.annotateKey({description: "Progress callback function"}),
	),
	/** Whether to merge with existing ontologies or replace */
	merge: S.Boolean.pipe(
		S.OptionFromOptionalKey,
		SchemaUtils.withNoneDefault,
		S.annotateKey({description: "Whether to merge with existing ontologies or replace"}),
	),
	/** Custom namespace mappings to use */
	customNamespaces: S.Record(S.String, S.String).pipe(
		S.OptionFromOptionalKey,
		SchemaUtils.withNoneDefault,
		S.annotateKey({description: "Custom namespace mappings to use"}),
	),
	/** Whether to validate the ontology after loading */
	validate: S.Boolean.pipe(
		S.OptionFromOptionalKey,
		SchemaUtils.withNoneDefault,
		S.annotateKey({description: "Whether to validate the ontology after loading"}),
	),
}, $I.annote("OntologyLoadOptions", {
	description: "Configuration options for loading ontologies",
})) {
}

/**
 * Export format options for knowledge graphs.
 *
 * @category schemas
 * @since 0.0.0
 */
export const ExportFormat = LiteralKit(["turtle", "owl-xml", "json-ld", "rdf-xml", "n3"]).pipe(
	$I.annoteSchema("ExportFormat", {
		description: "Export format options for knowledge graphs",
	}),
);

export type ExportFormat = typeof ExportFormat.Type;

/**
 * View modes for the knowledge graph visualization.
 *
 * @category schemas
 * @since 0.0.0
 */
export const ViewMode = LiteralKit(["abox", "tbox", "mixed"]).pipe(
	$I.annoteSchema("ViewMode", {
		description: "View modes for the knowledge graph visualization",
	}),
);

export type ViewMode = typeof ViewMode.Type;

/**
 * Color scheme for namespace visualization
 *
 * @category models
 * @since 0.0.0
 */
export class NamespaceColorScheme extends S.Class<NamespaceColorScheme>($I`NamespaceColorScheme`)({
	/** Background color */
	background: S.String.annotateKey({description: "Background color"}),
	/** Text color */
	text: S.String.annotateKey({description: "Text color"}),
	/** Border color */
	border: S.String.annotateKey({description: "Border color"}),
	/** Accent color */
	accent: S.String.annotateKey({description: "Accent color"}),
}, $I.annote("NamespaceColorScheme", {
	description: "Color scheme for namespace visualization",
})) {
}
