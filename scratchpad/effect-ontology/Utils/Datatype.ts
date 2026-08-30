/**
 * Utils: Datatype Normalization
 *
 * **Details**
 *
 * Automatic XSD datatype detection and normalization for RDF literals.
 * Converts raw string values to typed literals with appropriate XSD datatypes.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $ScratchpadId } from "@beep/identity";
import { IRI, makeNamedNode } from "@beep/rdf";
import { XSD_BOOLEAN, XSD_DOUBLE, XSD_INTEGER, XSD_NAMESPACE, XSD_STRING } from "@beep/rdf/Vocab/Xsd";
import * as P from "effect/Predicate";
import * as S from "effect/Schema";
import * as Str from "effect/String";
import { dual2 } from "./Dual.ts";

const XSD_DATE = makeNamedNode(`${XSD_NAMESPACE}date`);
const XSD_DATE_TIME = makeNamedNode(`${XSD_NAMESPACE}dateTime`);
const XSD_DECIMAL = makeNamedNode(`${XSD_NAMESPACE}decimal`);
const $I = $ScratchpadId.create("effect-ontology/Utils/Datatype");

/**
 * Result of datatype normalization
 *
 * **Example** (Construct a normalized value)
 *
 * ```ts
 * import { IRI } from "@beep/rdf"
 * import { NormalizedValue } from "@effect-ontology/Utils/Datatype"
 *
 * const normalized = NormalizedValue.make({
 *   value: "42",
 *   datatype: IRI.make("http://www.w3.org/2001/XMLSchema#integer")
 * })
 * console.log(normalized.value) // "42"
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export class NormalizedValue extends S.Class<NormalizedValue>($I`NormalizedValue`)(
  {
    value: S.String.annotateKey({ description: "Normalized string representation of the value." }),
    datatype: IRI.annotateKey({ description: "XSD datatype IRI describing the normalized value." }),
  },
  $I.annote("NormalizedValue", {
    description: "Normalized lexical value paired with its XSD datatype IRI.",
  })
) {}

// -----------------------------------------------------------------------------
// Regex patterns for datatype detection
// -----------------------------------------------------------------------------

/**
 * ISO 8601 date pattern: YYYY-MM-DD
 * Validates: year (1000-9999), month (01-12), day (01-31)
 */
const ISO_DATE_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;

/**
 * ISO 8601 dateTime pattern: YYYY-MM-DDTHH:mm:ss with optional timezone
 * Supports: time zone offset (Z, +00:00), fractional seconds
 */
const ISO_DATETIME_PATTERN =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)?$/;

/**
 * Integer pattern: optional sign, digits only
 */
const INTEGER_PATTERN = /^-?\d+$/;

/**
 * Decimal pattern: optional sign, digits with decimal point
 * Note: must contain decimal point to distinguish from integer
 */
const DECIMAL_PATTERN = /^-?\d+\.\d+$/;

/**
 * Boolean pattern: case-insensitive true/false
 */
const BOOLEAN_PATTERN = /^(?:true|false)$/i;

/**
 * Scientific notation pattern: e.g., 1.5e10, -3.2E-5
 */
const SCIENTIFIC_PATTERN = /^-?\d+(?:\.\d+)?[eE][+-]?\d+$/;

// -----------------------------------------------------------------------------
// Core normalization function
// -----------------------------------------------------------------------------

/**
 * Detect and normalize datatype for a value
 *
 * **Details**
 *
 * Analyzes the string value and returns the appropriate XSD datatype:
 * - Dates (YYYY-MM-DD) → xsd:date
 * - DateTimes (ISO 8601 with T) → xsd:dateTime
 * - Integers → xsd:integer
 * - Decimals (with decimal point) → xsd:decimal
 * - Scientific notation → xsd:double
 * - Booleans (true/false) → xsd:boolean
 * - Everything else → xsd:string
 *
 * **Example** (Use normalizeDatatype)
 *
 * ```ts
 * import { normalizeDatatype } from "@effect-ontology/Utils/Datatype"
 *
 * normalizeDatatype("2024-12-16", undefined) // { value: "2024-12-16", datatype: XSD.date }
 * normalizeDatatype("42", undefined)         // { value: "42", datatype: XSD.integer }
 * normalizeDatatype("3.14159", undefined)    // { value: "3.14159", datatype: XSD.decimal }
 * normalizeDatatype("true", undefined)       // { value: "true", datatype: XSD.boolean }
 * normalizeDatatype("Hello World", undefined) // { value: "Hello World", datatype: XSD.string }
 * normalizeDatatype("1.5e10", undefined)     // { value: "1.5e10", datatype: XSD.double }
 * ```
 *
 * @param value - Raw string value to normalize
 * @param expectedType - Optional expected datatype IRI (hint for ambiguous values)
 * @returns Normalized value with detected datatype
 * @category normalization
 * @since 0.0.0
 */
export const normalizeDatatype = dual2((value: string, expectedType: IRI | undefined): NormalizedValue => {
  // If expected type provided, use it with minimal validation
  if (P.isNotUndefined(expectedType)) {
    return { value, datatype: expectedType };
  }

  const trimmed = Str.trim(value);

  // Empty string → xsd:string
  if (trimmed === "") {
    return { value: trimmed, datatype: XSD_STRING.value };
  }

  // DateTime check (must come before date check)
  if (ISO_DATETIME_PATTERN.test(trimmed)) {
    return { value: trimmed, datatype: XSD_DATE_TIME.value };
  }

  // Date check
  if (ISO_DATE_PATTERN.test(trimmed)) {
    return { value: trimmed, datatype: XSD_DATE.value };
  }

  // Boolean check (case-insensitive, normalize to lowercase)
  if (BOOLEAN_PATTERN.test(trimmed)) {
    return { value: Str.toLowerCase(trimmed), datatype: XSD_BOOLEAN.value };
  }

  // Scientific notation → xsd:double
  if (SCIENTIFIC_PATTERN.test(trimmed)) {
    return { value: trimmed, datatype: XSD_DOUBLE.value };
  }

  // Decimal check (must come before integer check)
  if (DECIMAL_PATTERN.test(trimmed)) {
    return { value: trimmed, datatype: XSD_DECIMAL.value };
  }

  // Integer check
  if (INTEGER_PATTERN.test(trimmed)) {
    return { value: trimmed, datatype: XSD_INTEGER.value };
  }

  // Default to string
  return { value: trimmed, datatype: XSD_STRING.value };
});

/**
 * Check if a value is likely a date
 *
 * **Example** (Recognize an ISO date)
 *
 * ```ts
 * import { isDate } from "@effect-ontology/Utils/Datatype"
 *
 * console.log(isDate("2024-12-16")) // true
 * ```
 *
 * @param value - Value to check
 * @returns true if value matches ISO 8601 date pattern
 * @category predicates
 * @since 0.0.0
 */
export const isDate = (value: string): boolean => ISO_DATE_PATTERN.test(Str.trim(value));

/**
 * Check if a value is likely a dateTime
 *
 * **Example** (Recognize an ISO date-time)
 *
 * ```ts
 * import { isDateTime } from "@effect-ontology/Utils/Datatype"
 *
 * console.log(isDateTime("2024-12-16T12:30:00Z")) // true
 * ```
 *
 * @param value - Value to check
 * @returns true if value matches ISO 8601 dateTime pattern
 * @category predicates
 * @since 0.0.0
 */
export const isDateTime = (value: string): boolean => ISO_DATETIME_PATTERN.test(Str.trim(value));

/**
 * Check if a value is likely a numeric type
 *
 * **Example** (Recognize scientific notation)
 *
 * ```ts
 * import { isNumeric } from "@effect-ontology/Utils/Datatype"
 *
 * console.log(isNumeric("1.5e10")) // true
 * ```
 *
 * @param value - Value to check
 * @returns true if value is integer, decimal, or scientific notation
 * @category predicates
 * @since 0.0.0
 */
export const isNumeric = (value: string): boolean => {
  const trimmed = Str.trim(value);
  return INTEGER_PATTERN.test(trimmed) || DECIMAL_PATTERN.test(trimmed) || SCIENTIFIC_PATTERN.test(trimmed);
};

/**
 * Check if a value is likely a boolean
 *
 * **Example** (Recognize a boolean lexical value)
 *
 * ```ts
 * import { isBoolean } from "@effect-ontology/Utils/Datatype"
 *
 * console.log(isBoolean("TRUE")) // true
 * ```
 *
 * @param value - Value to check
 * @returns true if value is "true" or "false" (case-insensitive)
 * @category predicates
 * @since 0.0.0
 */
export const isBoolean = (value: string): boolean => BOOLEAN_PATTERN.test(Str.trim(value));
