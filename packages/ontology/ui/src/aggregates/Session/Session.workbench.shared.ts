/**
 * Shared helpers for ontology workbench regions.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { IRI } from "@beep/rdf/Iri";
import { Str } from "@beep/utils";
import * as S from "effect/Schema";
import type { ChangeEvent } from "react";

const isIri = S.is(IRI);

/**
 * Whether an Add Triple IRI field holds a usable IRI.
 *
 * @example
 * ```ts
 * import { iriFieldValid } from "@beep/ontology-ui/aggregates/Session"
 *
 * console.log(iriFieldValid("https://example.org/pizza#Pizza")) // true
 * console.log(iriFieldValid("not an iri")) // false
 * ```
 *
 * @category predicates
 * @since 0.0.0
 */
export const iriFieldValid = (value: string): boolean => isIri(Str.trim(value));

/**
 * Extracts the current string value from a workbench form control event.
 *
 * @example
 * ```ts
 * import { valueFromEvent } from "@beep/ontology-ui/aggregates/Session"
 *
 * console.log(valueFromEvent)
 * ```
 *
 * @category forms
 * @since 0.0.0
 */
export const valueFromEvent = (
  event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
): string => event.target.value;
