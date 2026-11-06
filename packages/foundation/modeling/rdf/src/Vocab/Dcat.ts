/**
 * DCAT vocabulary constants from the identity CoreVocab registry.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { makeNamedNode } from "../Rdf.ts";
import { DCAT_NAMESPACE } from "./generated/Dcat.terms.ts";

/**
 * Generated namespace and selected upstream inventory.
 *
 * @category constants
 * @since 0.0.0
 */
export { DCAT_NAMESPACE, DCAT_TERMS } from "./generated/Dcat.terms.ts";

/**
 * Named node for `dcat:Catalog`.
 *
 * **Example** (Read dcat Catalog)
 *
 * ```ts import.meta.vitest name="Read dcat Catalog"
 * import { DCAT_CATALOG } from "@beep/rdf/Vocab/Dcat"
 *
 * DCAT_CATALOG.value // => "http://www.w3.org/ns/dcat#Catalog"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DCAT_CATALOG = makeNamedNode(`${DCAT_NAMESPACE}Catalog`);

/**
 * Named node for `dcat:Dataset`.
 *
 * **Example** (Read dcat Dataset)
 *
 * ```ts import.meta.vitest name="Read dcat Dataset"
 * import { DCAT_DATASET } from "@beep/rdf/Vocab/Dcat"
 *
 * DCAT_DATASET.value // => "http://www.w3.org/ns/dcat#Dataset"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DCAT_DATASET = makeNamedNode(`${DCAT_NAMESPACE}Dataset`);

/**
 * Named node for `dcat:Distribution`.
 *
 * **Example** (Read dcat Distribution)
 *
 * ```ts import.meta.vitest name="Read dcat Distribution"
 * import { DCAT_DISTRIBUTION } from "@beep/rdf/Vocab/Dcat"
 *
 * DCAT_DISTRIBUTION.value // => "http://www.w3.org/ns/dcat#Distribution"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DCAT_DISTRIBUTION = makeNamedNode(`${DCAT_NAMESPACE}Distribution`);

/**
 * Named node for `dcat:DataService`.
 *
 * **Example** (Read dcat DataService)
 *
 * ```ts import.meta.vitest name="Read dcat DataService"
 * import { DCAT_DATA_SERVICE } from "@beep/rdf/Vocab/Dcat"
 *
 * DCAT_DATA_SERVICE.value // => "http://www.w3.org/ns/dcat#DataService"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DCAT_DATA_SERVICE = makeNamedNode(`${DCAT_NAMESPACE}DataService`);

/**
 * Named node for `dcat:downloadURL`.
 *
 * **Example** (Read dcat downloadURL)
 *
 * ```ts import.meta.vitest name="Read dcat downloadURL"
 * import { DCAT_DOWNLOAD_URL } from "@beep/rdf/Vocab/Dcat"
 *
 * DCAT_DOWNLOAD_URL.value // => "http://www.w3.org/ns/dcat#downloadURL"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DCAT_DOWNLOAD_URL = makeNamedNode(`${DCAT_NAMESPACE}downloadURL`);

/**
 * Named node for `dcat:accessURL`.
 *
 * **Example** (Read dcat accessURL)
 *
 * ```ts import.meta.vitest name="Read dcat accessURL"
 * import { DCAT_ACCESS_URL } from "@beep/rdf/Vocab/Dcat"
 *
 * DCAT_ACCESS_URL.value // => "http://www.w3.org/ns/dcat#accessURL"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DCAT_ACCESS_URL = makeNamedNode(`${DCAT_NAMESPACE}accessURL`);

/**
 * Named node for `dcat:mediaType`.
 *
 * **Example** (Read dcat mediaType)
 *
 * ```ts import.meta.vitest name="Read dcat mediaType"
 * import { DCAT_MEDIA_TYPE } from "@beep/rdf/Vocab/Dcat"
 *
 * DCAT_MEDIA_TYPE.value // => "http://www.w3.org/ns/dcat#mediaType"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DCAT_MEDIA_TYPE = makeNamedNode(`${DCAT_NAMESPACE}mediaType`);

/**
 * Named node for `dcat:byteSize`.
 *
 * **Example** (Read dcat byteSize)
 *
 * ```ts import.meta.vitest name="Read dcat byteSize"
 * import { DCAT_BYTE_SIZE } from "@beep/rdf/Vocab/Dcat"
 *
 * DCAT_BYTE_SIZE.value // => "http://www.w3.org/ns/dcat#byteSize"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DCAT_BYTE_SIZE = makeNamedNode(`${DCAT_NAMESPACE}byteSize`);

/**
 * Named node for `dcat:distribution`.
 *
 * **Example** (Read dcat distribution)
 *
 * ```ts import.meta.vitest name="Read dcat distribution"
 * import { DCAT_DISTRIBUTION_PREDICATE } from "@beep/rdf/Vocab/Dcat"
 *
 * DCAT_DISTRIBUTION_PREDICATE.value // => "http://www.w3.org/ns/dcat#distribution"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DCAT_DISTRIBUTION_PREDICATE = makeNamedNode(`${DCAT_NAMESPACE}distribution`);

/**
 * Named node for `dcat:dataset`.
 *
 * **Example** (Read dcat dataset)
 *
 * ```ts import.meta.vitest name="Read dcat dataset"
 * import { DCAT_DATASET_PREDICATE } from "@beep/rdf/Vocab/Dcat"
 *
 * DCAT_DATASET_PREDICATE.value // => "http://www.w3.org/ns/dcat#dataset"
 * ```
 *
 * @category constants
 * @since 0.0.0
 */
export const DCAT_DATASET_PREDICATE = makeNamedNode(`${DCAT_NAMESPACE}dataset`);
