/**
 * OData `$filter` building shared by the outbox reads.
 *
 * @internal
 * @since 0.1.0
 */
import { dual } from "effect/Function";
import * as Str from "effect/String";

/**
 * An OData equality on a string property, with the value quoted and every
 * single quote in it doubled.
 *
 * @internal
 */
export const odataEquals: {
  (value: string): (property: string) => string;
  (property: string, value: string): string;
} = dual(2, (property: string, value: string): string => `${property} eq '${Str.replaceAll("'", "''")(value)}'`);
