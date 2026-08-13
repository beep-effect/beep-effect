/**
 * Utils: Datatype Normalization
 *
 * Automatic XSD datatype detection and normalization for RDF literals.
 * Converts raw string values to typed literals with appropriate XSD datatypes.
 *
 * @since 2.0.0
 * @module Utils/Datatype
 */

import * as P from "effect/Predicate";
import { XSD } from "../Domain/Rdf/Constants.ts";
import type { IRI } from "../Domain/Rdf/Types.ts";
import { dual2 } from "./Dual.ts";

/**
 * Result of datatype normalization
 *
 * @since 2.0.0
 * @category Types
 */
export interface NormalizedValue {
  /** Normalized string representation of the value */
  readonly value: string;
  /** XSD datatype IRI */
  readonly datatype: IRI;
}

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
 * Analyzes the string value and returns the appropriate XSD datatype:
 * - Dates (YYYY-MM-DD) → xsd:date
 * - DateTimes (ISO 8601 with T) → xsd:dateTime
 * - Integers → xsd:integer
 * - Decimals (with decimal point) → xsd:decimal
 * - Scientific notation → xsd:double
 * - Booleans (true/false) → xsd:boolean
 * - Everything else → xsd:string
 *
 * @param value - Raw string value to normalize
 * @param expectedType - Optional expected datatype IRI (hint for ambiguous values)
 * @returns Normalized value with detected datatype
 *
 * @example
 * ```typescript
 * normalizeDatatype("2024-12-16", undefined) // { value: "2024-12-16", datatype: XSD.date }
 * normalizeDatatype("42", undefined)         // { value: "42", datatype: XSD.integer }
 * normalizeDatatype("3.14159", undefined)    // { value: "3.14159", datatype: XSD.decimal }
 * normalizeDatatype("true", undefined)       // { value: "true", datatype: XSD.boolean }
 * normalizeDatatype("Hello World", undefined) // { value: "Hello World", datatype: XSD.string }
 * normalizeDatatype("1.5e10", undefined)     // { value: "1.5e10", datatype: XSD.double }
 * ```
 *
 * @since 2.0.0
 * @category Normalization
 */
export const normalizeDatatype = dual2((value: string, expectedType: IRI | undefined): NormalizedValue => {
  // If expected type provided, use it with minimal validation
  if (P.isNotUndefined(expectedType)) {
    return { value, datatype: expectedType };
  }

  const trimmed = value.trim();

  // Empty string → xsd:string
  if (trimmed === "") {
    return { value: trimmed, datatype: XSD.string };
  }

  // DateTime check (must come before date check)
  if (ISO_DATETIME_PATTERN.test(trimmed)) {
    return { value: trimmed, datatype: XSD.dateTime };
  }

  // Date check
  if (ISO_DATE_PATTERN.test(trimmed)) {
    return { value: trimmed, datatype: XSD.date };
  }

  // Boolean check (case-insensitive, normalize to lowercase)
  if (BOOLEAN_PATTERN.test(trimmed)) {
    return { value: trimmed.toLowerCase(), datatype: XSD.boolean };
  }

  // Scientific notation → xsd:double
  if (SCIENTIFIC_PATTERN.test(trimmed)) {
    return { value: trimmed, datatype: XSD.double };
  }

  // Decimal check (must come before integer check)
  if (DECIMAL_PATTERN.test(trimmed)) {
    return { value: trimmed, datatype: XSD.decimal };
  }

  // Integer check
  if (INTEGER_PATTERN.test(trimmed)) {
    return { value: trimmed, datatype: XSD.integer };
  }

  // Default to string
  return { value: trimmed, datatype: XSD.string };
});

/**
 * Check if a value is likely a date
 *
 * @param value - Value to check
 * @returns true if value matches ISO 8601 date pattern
 *
 * @since 2.0.0
 * @category Predicates
 */
export const isDate = (value: string): boolean => ISO_DATE_PATTERN.test(value.trim());

/**
 * Check if a value is likely a dateTime
 *
 * @param value - Value to check
 * @returns true if value matches ISO 8601 dateTime pattern
 *
 * @since 2.0.0
 * @category Predicates
 */
export const isDateTime = (value: string): boolean => ISO_DATETIME_PATTERN.test(value.trim());

/**
 * Check if a value is likely a numeric type
 *
 * @param value - Value to check
 * @returns true if value is integer, decimal, or scientific notation
 *
 * @since 2.0.0
 * @category Predicates
 */
export const isNumeric = (value: string): boolean => {
  const trimmed = value.trim();
  return INTEGER_PATTERN.test(trimmed) || DECIMAL_PATTERN.test(trimmed) || SCIENTIFIC_PATTERN.test(trimmed);
};

/**
 * Check if a value is likely a boolean
 *
 * @param value - Value to check
 * @returns true if value is "true" or "false" (case-insensitive)
 *
 * @since 2.0.0
 * @category Predicates
 */
export const isBoolean = (value: string): boolean => BOOLEAN_PATTERN.test(value.trim());
