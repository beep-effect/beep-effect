/**
 * SHACL vocabulary helpers, built from the `sh` namespace of the identity
 * registry.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { makeNamedNode } from "../Rdf.ts";
import { SHACL_NAMESPACE } from "./generated/Shacl.terms.ts";
import type { SHACL_TERMS } from "./generated/Shacl.terms.ts";

/**
 * SHACL namespace IRI and its registered term locals, read from the identity registry.
 *
 * **Example** (Build a shape IRI)
 *
 * ```ts import.meta.vitest name="Build a shape IRI"
 * import { SHACL_NAMESPACE } from "@beep/rdf/Vocab/Shacl"
 *
 * `${SHACL_NAMESPACE}NodeShape` // => "http://www.w3.org/ns/shacl#NodeShape"
 * ```
 *
 * @category configuration
 * @since 0.0.0
 */
export { SHACL_NAMESPACE, SHACL_TERMS } from "./generated/Shacl.terms.ts";

const shaclTerm = (local: (typeof SHACL_TERMS)[number]) => makeNamedNode(`${SHACL_NAMESPACE}${local}`);

/**
 * `sh:NodeShape`
 *
 * **Example** (Inspect NodeShape NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect NodeShape NamedNode"
 * import { SH_NODE_SHAPE } from "@beep/rdf/Vocab/Shacl"
 *
 * SH_NODE_SHAPE.value // => "http://www.w3.org/ns/shacl#NodeShape"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SH_NODE_SHAPE = shaclTerm("NodeShape");

/**
 * `sh:property`
 *
 * **Example** (Inspect property NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect property NamedNode"
 * import { SH_PROPERTY } from "@beep/rdf/Vocab/Shacl"
 *
 * SH_PROPERTY.value // => "http://www.w3.org/ns/shacl#property"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SH_PROPERTY = shaclTerm("property");

/**
 * `sh:path`
 *
 * **Example** (Inspect path NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect path NamedNode"
 * import { SH_PATH } from "@beep/rdf/Vocab/Shacl"
 *
 * SH_PATH.value // => "http://www.w3.org/ns/shacl#path"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SH_PATH = shaclTerm("path");

/**
 * `sh:node`
 *
 * **Example** (Inspect node NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect node NamedNode"
 * import { SH_NODE } from "@beep/rdf/Vocab/Shacl"
 *
 * SH_NODE.value // => "http://www.w3.org/ns/shacl#node"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SH_NODE = shaclTerm("node");

/**
 * `sh:targetClass`
 *
 * **Example** (Inspect targetClass NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect targetClass NamedNode"
 * import { SH_TARGET_CLASS } from "@beep/rdf/Vocab/Shacl"
 *
 * SH_TARGET_CLASS.value // => "http://www.w3.org/ns/shacl#targetClass"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SH_TARGET_CLASS = shaclTerm("targetClass");

/**
 * `sh:targetNode`
 *
 * **Example** (Inspect targetNode NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect targetNode NamedNode"
 * import { SH_TARGET_NODE } from "@beep/rdf/Vocab/Shacl"
 *
 * SH_TARGET_NODE.value // => "http://www.w3.org/ns/shacl#targetNode"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SH_TARGET_NODE = shaclTerm("targetNode");

/**
 * `sh:minCount`
 *
 * **Example** (Inspect minCount NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect minCount NamedNode"
 * import { SH_MIN_COUNT } from "@beep/rdf/Vocab/Shacl"
 *
 * SH_MIN_COUNT.value // => "http://www.w3.org/ns/shacl#minCount"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SH_MIN_COUNT = shaclTerm("minCount");

/**
 * `sh:maxCount`
 *
 * **Example** (Inspect maxCount NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect maxCount NamedNode"
 * import { SH_MAX_COUNT } from "@beep/rdf/Vocab/Shacl"
 *
 * SH_MAX_COUNT.value // => "http://www.w3.org/ns/shacl#maxCount"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SH_MAX_COUNT = shaclTerm("maxCount");

/**
 * `sh:datatype`
 *
 * **Example** (Inspect datatype NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect datatype NamedNode"
 * import { SH_DATATYPE } from "@beep/rdf/Vocab/Shacl"
 *
 * SH_DATATYPE.value // => "http://www.w3.org/ns/shacl#datatype"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SH_DATATYPE = shaclTerm("datatype");

/**
 * `sh:class`
 *
 * **Example** (Inspect class NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect class NamedNode"
 * import { SH_CLASS } from "@beep/rdf/Vocab/Shacl"
 *
 * SH_CLASS.value // => "http://www.w3.org/ns/shacl#class"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SH_CLASS = shaclTerm("class");

/**
 * `sh:hasValue`
 *
 * **Example** (Inspect hasValue NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect hasValue NamedNode"
 * import { SH_HAS_VALUE } from "@beep/rdf/Vocab/Shacl"
 *
 * SH_HAS_VALUE.value // => "http://www.w3.org/ns/shacl#hasValue"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SH_HAS_VALUE = shaclTerm("hasValue");

/**
 * `sh:Info`
 *
 * **Example** (Inspect Info NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect Info NamedNode"
 * import { SH_INFO } from "@beep/rdf/Vocab/Shacl"
 *
 * SH_INFO.value // => "http://www.w3.org/ns/shacl#Info"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SH_INFO = shaclTerm("Info");

/**
 * `sh:Warning`
 *
 * **Example** (Inspect Warning NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect Warning NamedNode"
 * import { SH_WARNING } from "@beep/rdf/Vocab/Shacl"
 *
 * SH_WARNING.value // => "http://www.w3.org/ns/shacl#Warning"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SH_WARNING = shaclTerm("Warning");

/**
 * `sh:MinCountConstraintComponent`
 *
 * **Example** (Inspect MinCountConstraintComponent NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect MinCountConstraintComponent NamedNode"
 * import { SH_MIN_COUNT_COMPONENT } from "@beep/rdf/Vocab/Shacl"
 *
 * SH_MIN_COUNT_COMPONENT.value // => "http://www.w3.org/ns/shacl#MinCountConstraintComponent"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SH_MIN_COUNT_COMPONENT = shaclTerm("MinCountConstraintComponent");

/**
 * `sh:DatatypeConstraintComponent`
 *
 * **Example** (Inspect DatatypeConstraintComponent NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect DatatypeConstraintComponent NamedNode"
 * import { SH_DATATYPE_COMPONENT } from "@beep/rdf/Vocab/Shacl"
 *
 * SH_DATATYPE_COMPONENT.value // => "http://www.w3.org/ns/shacl#DatatypeConstraintComponent"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SH_DATATYPE_COMPONENT = shaclTerm("DatatypeConstraintComponent");

/**
 * `sh:ClassConstraintComponent`
 *
 * **Example** (Inspect ClassConstraintComponent NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect ClassConstraintComponent NamedNode"
 * import { SH_CLASS_COMPONENT } from "@beep/rdf/Vocab/Shacl"
 *
 * SH_CLASS_COMPONENT.value // => "http://www.w3.org/ns/shacl#ClassConstraintComponent"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SH_CLASS_COMPONENT = shaclTerm("ClassConstraintComponent");

/**
 * `sh:HasValueConstraintComponent`
 *
 * **Example** (Inspect HasValueConstraintComponent NamedNode)
 *
 * ```ts import.meta.vitest name="Inspect HasValueConstraintComponent NamedNode"
 * import { SH_HAS_VALUE_COMPONENT } from "@beep/rdf/Vocab/Shacl"
 *
 * SH_HAS_VALUE_COMPONENT.value // => "http://www.w3.org/ns/shacl#HasValueConstraintComponent"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const SH_HAS_VALUE_COMPONENT = shaclTerm("HasValueConstraintComponent");
