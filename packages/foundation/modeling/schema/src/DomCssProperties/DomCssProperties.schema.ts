/**
 * DOM schema helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import { A, P } from "@beep/utils";
import * as S from "effect/Schema";
import type * as React from "react";

const $I = $SchemaId.create("DomCssProperties");

/**
 * Type guard for React.CSSProperties.
 *
 * **Example** (Check CSS properties object)
 *
 * ```ts
 * import { isCSSProperties } from "@beep/schema/DomCssProperties"
 *
 * console.log(isCSSProperties({ color: "red" }))
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isCSSProperties = (u: unknown): u is React.CSSProperties => {
  if (P.not(P.isObject)(u) || P.isNull(u)) {
    return false;
  }
  return !A.isArray(u) && Object.prototype.toString.call(u) === "[object Object]";
};

/**
 * A React.CSSProperties object.
 *
 * **Example** (Decode CSS properties object)
 *
 * ```ts
 * import { DOMCssProperties } from "@beep/schema/DomCssProperties"
 * import * as S from "effect/Schema"
 *
 * const styles = S.decodeUnknownSync(DOMCssProperties)({ color: "red" })
 * console.log(styles)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DOMCssProperties = S.declare(isCSSProperties).pipe(
  $I.annoteSchema("DOMCssProperties", {
    description: "A React.CSSProperties",
  })
);

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { DOMCssProperties as DomCssProperties, DOMCssProperties as Schema };
