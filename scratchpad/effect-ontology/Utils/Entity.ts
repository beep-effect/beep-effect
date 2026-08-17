/**
 * Entity Utilities
 *
 * Pure functions for entity ID validation and reference detection.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { ENTITY_ID_PATTERN } from "../Domain/Model/shared.ts";

/**
 * Check if a string value is an entity reference (vs a literal)
 *
 * Entity references are snake_case identifiers starting with lowercase letter.
 * This distinguishes entity ID references from literal string values.
 *
 * **Example**
 *
 * ```ts
 * isEntityReference("cristiano_ronaldo")  // => true
 * isEntityReference("al_nassr_fc")        // => true
 * isEntityReference("1985-02-05")         // => false (starts with digit)
 * isEntityReference("Portuguese")         // => false (starts with uppercase)
 * isEntityReference("hello world")        // => false (contains space)
 * ```
 *
 * @param value - String to check
 * @returns True if value matches entity reference pattern
 * @since 0.0.0
 * @category predicates
 */
export const isEntityReference = (value: string): boolean => ENTITY_ID_PATTERN.test(value);
