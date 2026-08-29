/**
 * PROV vocabulary helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { makeNamedNode } from "../Rdf.ts";

/**
 * PROV namespace IRI.
 *
 * **Example** (Construct entity IRI)
 *
 * ```ts import.meta.vitest name="Construct entity IRI"
 * import { PROV_NAMESPACE } from "@beep/rdf/Vocab/Prov"
 *
 * const entityIri = `${PROV_NAMESPACE}Entity`
 * entityIri // => "http://www.w3.org/ns/prov#Entity"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export const PROV_NAMESPACE = "http://www.w3.org/ns/prov#" as const;

/**
 * `prov:Entity`
 *
 * **Example** (Inspect Entity NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect Entity NamedNode"
 * import { PROV_ENTITY } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_ENTITY.value // => "http://www.w3.org/ns/prov#Entity"
 * PROV_ENTITY.termType // => "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_ENTITY = makeNamedNode(`${PROV_NAMESPACE}Entity`);

/**
 * `prov:Activity`
 *
 * **Example** (Inspect Activity NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect Activity NamedNode"
 * import { PROV_ACTIVITY } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_ACTIVITY.value // => "http://www.w3.org/ns/prov#Activity"
 * PROV_ACTIVITY.termType // => "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_ACTIVITY = makeNamedNode(`${PROV_NAMESPACE}Activity`);

/**
 * `prov:Agent`
 *
 * **Example** (Inspect Agent NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect Agent NamedNode"
 * import { PROV_AGENT } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_AGENT.value // => "http://www.w3.org/ns/prov#Agent"
 * PROV_AGENT.termType // => "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_AGENT = makeNamedNode(`${PROV_NAMESPACE}Agent`);

/**
 * `prov:wasGeneratedBy`
 *
 * **Example** (Inspect wasGeneratedBy NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect wasGeneratedBy NamedNode"
 * import { PROV_WAS_GENERATED_BY } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_WAS_GENERATED_BY.value // => "http://www.w3.org/ns/prov#wasGeneratedBy"
 * PROV_WAS_GENERATED_BY.termType // => "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_WAS_GENERATED_BY = makeNamedNode(`${PROV_NAMESPACE}wasGeneratedBy`);

/**
 * `prov:used`
 *
 * **Example** (Inspect used NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect used NamedNode"
 * import { PROV_USED } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_USED.value // => "http://www.w3.org/ns/prov#used"
 * PROV_USED.termType // => "NamedNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_USED = makeNamedNode(`${PROV_NAMESPACE}used`);

/**
 * `prov:SoftwareAgent` term.
 *
 * **Example** (Inspect Software agent class)
 *
 * ```ts import.meta.vitest name="Inspect Software agent class"
 * import { PROV_SOFTWARE_AGENT } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_SOFTWARE_AGENT.value // => "http://www.w3.org/ns/prov#SoftwareAgent"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_SOFTWARE_AGENT = makeNamedNode(`${PROV_NAMESPACE}SoftwareAgent`);

/**
 * `prov:Usage` term.
 *
 * **Example** (Inspect Usage influence class)
 *
 * ```ts import.meta.vitest name="Inspect Usage influence class"
 * import { PROV_USAGE } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_USAGE.value // => "http://www.w3.org/ns/prov#Usage"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_USAGE = makeNamedNode(`${PROV_NAMESPACE}Usage`);

/**
 * `prov:Generation` term.
 *
 * **Example** (Inspect Generation influence class)
 *
 * ```ts import.meta.vitest name="Inspect Generation influence class"
 * import { PROV_GENERATION } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_GENERATION.value // => "http://www.w3.org/ns/prov#Generation"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_GENERATION = makeNamedNode(`${PROV_NAMESPACE}Generation`);

/**
 * `prov:Association` term.
 *
 * **Example** (Inspect Association influence class)
 *
 * ```ts import.meta.vitest name="Inspect Association influence class"
 * import { PROV_ASSOCIATION } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_ASSOCIATION.value // => "http://www.w3.org/ns/prov#Association"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_ASSOCIATION = makeNamedNode(`${PROV_NAMESPACE}Association`);

/**
 * `prov:Attribution` term.
 *
 * **Example** (Inspect Attribution influence class)
 *
 * ```ts import.meta.vitest name="Inspect Attribution influence class"
 * import { PROV_ATTRIBUTION } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_ATTRIBUTION.value // => "http://www.w3.org/ns/prov#Attribution"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_ATTRIBUTION = makeNamedNode(`${PROV_NAMESPACE}Attribution`);

/**
 * `prov:Derivation` term.
 *
 * **Example** (Inspect Derivation influence class)
 *
 * ```ts import.meta.vitest name="Inspect Derivation influence class"
 * import { PROV_DERIVATION } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_DERIVATION.value // => "http://www.w3.org/ns/prov#Derivation"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_DERIVATION = makeNamedNode(`${PROV_NAMESPACE}Derivation`);

/**
 * `prov:PrimarySource` term.
 *
 * **Example** (Inspect Primary-source influence class)
 *
 * ```ts import.meta.vitest name="Inspect Primary-source influence class"
 * import { PROV_PRIMARY_SOURCE } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_PRIMARY_SOURCE.value // => "http://www.w3.org/ns/prov#PrimarySource"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_PRIMARY_SOURCE = makeNamedNode(`${PROV_NAMESPACE}PrimarySource`);

/**
 * `prov:wasAssociatedWith` term.
 *
 * **Example** (Inspect Direct association property)
 *
 * ```ts import.meta.vitest name="Inspect Direct association property"
 * import { PROV_WAS_ASSOCIATED_WITH } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_WAS_ASSOCIATED_WITH.value // => "http://www.w3.org/ns/prov#wasAssociatedWith"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_WAS_ASSOCIATED_WITH = makeNamedNode(`${PROV_NAMESPACE}wasAssociatedWith`);

/**
 * `prov:wasAttributedTo` term.
 *
 * **Example** (Inspect Direct attribution property)
 *
 * ```ts import.meta.vitest name="Inspect Direct attribution property"
 * import { PROV_WAS_ATTRIBUTED_TO } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_WAS_ATTRIBUTED_TO.value // => "http://www.w3.org/ns/prov#wasAttributedTo"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_WAS_ATTRIBUTED_TO = makeNamedNode(`${PROV_NAMESPACE}wasAttributedTo`);

/**
 * `prov:hadPrimarySource` term.
 *
 * **Example** (Inspect Direct primary-source property)
 *
 * ```ts import.meta.vitest name="Inspect Direct primary-source property"
 * import { PROV_HAD_PRIMARY_SOURCE } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_HAD_PRIMARY_SOURCE.value // => "http://www.w3.org/ns/prov#hadPrimarySource"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_HAD_PRIMARY_SOURCE = makeNamedNode(`${PROV_NAMESPACE}hadPrimarySource`);

/**
 * `prov:wasDerivedFrom` term.
 *
 * **Example** (Inspect Direct derivation property)
 *
 * ```ts import.meta.vitest name="Inspect Direct derivation property"
 * import { PROV_WAS_DERIVED_FROM } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_WAS_DERIVED_FROM.value // => "http://www.w3.org/ns/prov#wasDerivedFrom"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_WAS_DERIVED_FROM = makeNamedNode(`${PROV_NAMESPACE}wasDerivedFrom`);

/**
 * `prov:wasQuotedFrom` term.
 *
 * **Example** (Inspect Direct quotation property)
 *
 * ```ts import.meta.vitest name="Inspect Direct quotation property"
 * import { PROV_WAS_QUOTED_FROM } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_WAS_QUOTED_FROM.value // => "http://www.w3.org/ns/prov#wasQuotedFrom"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_WAS_QUOTED_FROM = makeNamedNode(`${PROV_NAMESPACE}wasQuotedFrom`);

/**
 * `prov:wasRevisionOf` term.
 *
 * **Example** (Inspect Direct revision property)
 *
 * ```ts import.meta.vitest name="Inspect Direct revision property"
 * import { PROV_WAS_REVISION_OF } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_WAS_REVISION_OF.value // => "http://www.w3.org/ns/prov#wasRevisionOf"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_WAS_REVISION_OF = makeNamedNode(`${PROV_NAMESPACE}wasRevisionOf`);

/**
 * `prov:generatedAtTime` term.
 *
 * **Example** (Inspect Entity generation timestamp property)
 *
 * ```ts import.meta.vitest name="Inspect Entity generation timestamp property"
 * import { PROV_GENERATED_AT_TIME } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_GENERATED_AT_TIME.value // => "http://www.w3.org/ns/prov#generatedAtTime"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_GENERATED_AT_TIME = makeNamedNode(`${PROV_NAMESPACE}generatedAtTime`);

/**
 * `prov:invalidatedAtTime` term.
 *
 * **Example** (Inspect Entity invalidation timestamp property)
 *
 * ```ts import.meta.vitest name="Inspect Entity invalidation timestamp property"
 * import { PROV_INVALIDATED_AT_TIME } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_INVALIDATED_AT_TIME.value // => "http://www.w3.org/ns/prov#invalidatedAtTime"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_INVALIDATED_AT_TIME = makeNamedNode(`${PROV_NAMESPACE}invalidatedAtTime`);

/**
 * `prov:startedAtTime` term.
 *
 * **Example** (Inspect Activity start timestamp property)
 *
 * ```ts import.meta.vitest name="Inspect Activity start timestamp property"
 * import { PROV_STARTED_AT_TIME } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_STARTED_AT_TIME.value // => "http://www.w3.org/ns/prov#startedAtTime"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_STARTED_AT_TIME = makeNamedNode(`${PROV_NAMESPACE}startedAtTime`);

/**
 * `prov:endedAtTime` term.
 *
 * **Example** (Inspect Activity end timestamp property)
 *
 * ```ts import.meta.vitest name="Inspect Activity end timestamp property"
 * import { PROV_ENDED_AT_TIME } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_ENDED_AT_TIME.value // => "http://www.w3.org/ns/prov#endedAtTime"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_ENDED_AT_TIME = makeNamedNode(`${PROV_NAMESPACE}endedAtTime`);

/**
 * `prov:atTime` term.
 *
 * **Example** (Inspect Qualified influence timestamp property)
 *
 * ```ts import.meta.vitest name="Inspect Qualified influence timestamp property"
 * import { PROV_AT_TIME } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_AT_TIME.value // => "http://www.w3.org/ns/prov#atTime"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_AT_TIME = makeNamedNode(`${PROV_NAMESPACE}atTime`);

/**
 * `prov:value` term.
 *
 * **Example** (Inspect Entity value property)
 *
 * ```ts import.meta.vitest name="Inspect Entity value property"
 * import { PROV_VALUE } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_VALUE.value // => "http://www.w3.org/ns/prov#value"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_VALUE = makeNamedNode(`${PROV_NAMESPACE}value`);

/**
 * `prov:hadPlan` term.
 *
 * **Example** (Inspect Association plan property)
 *
 * ```ts import.meta.vitest name="Inspect Association plan property"
 * import { PROV_HAD_PLAN } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_HAD_PLAN.value // => "http://www.w3.org/ns/prov#hadPlan"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_HAD_PLAN = makeNamedNode(`${PROV_NAMESPACE}hadPlan`);

/**
 * `prov:qualifiedUsage` term.
 *
 * **Example** (Inspect Qualified usage property)
 *
 * ```ts import.meta.vitest name="Inspect Qualified usage property"
 * import { PROV_QUALIFIED_USAGE } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_QUALIFIED_USAGE.value // => "http://www.w3.org/ns/prov#qualifiedUsage"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_QUALIFIED_USAGE = makeNamedNode(`${PROV_NAMESPACE}qualifiedUsage`);

/**
 * `prov:qualifiedGeneration` term.
 *
 * **Example** (Inspect Qualified generation property)
 *
 * ```ts import.meta.vitest name="Inspect Qualified generation property"
 * import { PROV_QUALIFIED_GENERATION } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_QUALIFIED_GENERATION.value // => "http://www.w3.org/ns/prov#qualifiedGeneration"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_QUALIFIED_GENERATION = makeNamedNode(`${PROV_NAMESPACE}qualifiedGeneration`);

/**
 * `prov:qualifiedAssociation` term.
 *
 * **Example** (Inspect Qualified association property)
 *
 * ```ts import.meta.vitest name="Inspect Qualified association property"
 * import { PROV_QUALIFIED_ASSOCIATION } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_QUALIFIED_ASSOCIATION.value // => "http://www.w3.org/ns/prov#qualifiedAssociation"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_QUALIFIED_ASSOCIATION = makeNamedNode(`${PROV_NAMESPACE}qualifiedAssociation`);

/**
 * `prov:qualifiedAttribution` term.
 *
 * **Example** (Inspect Qualified attribution property)
 *
 * ```ts import.meta.vitest name="Inspect Qualified attribution property"
 * import { PROV_QUALIFIED_ATTRIBUTION } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_QUALIFIED_ATTRIBUTION.value // => "http://www.w3.org/ns/prov#qualifiedAttribution"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_QUALIFIED_ATTRIBUTION = makeNamedNode(`${PROV_NAMESPACE}qualifiedAttribution`);

/**
 * `prov:qualifiedDerivation` term.
 *
 * **Example** (Inspect Qualified derivation property)
 *
 * ```ts import.meta.vitest name="Inspect Qualified derivation property"
 * import { PROV_QUALIFIED_DERIVATION } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_QUALIFIED_DERIVATION.value // => "http://www.w3.org/ns/prov#qualifiedDerivation"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_QUALIFIED_DERIVATION = makeNamedNode(`${PROV_NAMESPACE}qualifiedDerivation`);

/**
 * `prov:qualifiedPrimarySource` term.
 *
 * **Example** (Inspect Qualified primary-source property)
 *
 * ```ts import.meta.vitest name="Inspect Qualified primary-source property"
 * import { PROV_QUALIFIED_PRIMARY_SOURCE } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_QUALIFIED_PRIMARY_SOURCE.value // => "http://www.w3.org/ns/prov#qualifiedPrimarySource"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_QUALIFIED_PRIMARY_SOURCE = makeNamedNode(`${PROV_NAMESPACE}qualifiedPrimarySource`);

/**
 * `prov:entity` relation target.
 *
 * **Example** (Inspect Qualified entity target property)
 *
 * ```ts import.meta.vitest name="Inspect Qualified entity target property"
 * import { PROV_ENTITY_PROPERTY } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_ENTITY_PROPERTY.value // => "http://www.w3.org/ns/prov#entity"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_ENTITY_PROPERTY = makeNamedNode(`${PROV_NAMESPACE}entity`);

/**
 * `prov:activity` relation target.
 *
 * **Example** (Inspect Qualified activity target property)
 *
 * ```ts import.meta.vitest name="Inspect Qualified activity target property"
 * import { PROV_ACTIVITY_PROPERTY } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_ACTIVITY_PROPERTY.value // => "http://www.w3.org/ns/prov#activity"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_ACTIVITY_PROPERTY = makeNamedNode(`${PROV_NAMESPACE}activity`);

/**
 * `prov:agent` relation target.
 *
 * **Example** (Inspect Qualified agent target property)
 *
 * ```ts import.meta.vitest name="Inspect Qualified agent target property"
 * import { PROV_AGENT_PROPERTY } from "@beep/rdf/Vocab/Prov"
 *
 * PROV_AGENT_PROPERTY.value // => "http://www.w3.org/ns/prov#agent"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const PROV_AGENT_PROPERTY = makeNamedNode(`${PROV_NAMESPACE}agent`);
