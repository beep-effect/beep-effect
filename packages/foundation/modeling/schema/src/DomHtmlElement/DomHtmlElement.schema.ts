/**
 * DOM schema helpers.
 *
 * @packageDocumentation
 * @since 0.0.0
 */
import { $SchemaId } from "@beep/identity";
import * as S from "effect/Schema";

const $I = $SchemaId.create("DomHtmlElement");

/**
 * Type guard for HTMLElement.
 *
 * @example
 * ```ts
 * import { isHTMLElement } from "@beep/schema/DomHtmlElement"
 *
 * console.log(isHTMLElement(document.createElement("div")))
 * ```
 *
 * @since 0.0.0
 * @category guards
 */
export const isHTMLElement = (u: unknown): u is HTMLElement => u instanceof HTMLElement;

/**
 * An HTMLElement.
 *
 * @example
 * ```ts
 * import { DOMHtmlElement } from "@beep/schema/DomHtmlElement"
 * import * as S from "effect/Schema"
 *
 * const element = S.decodeUnknownSync(DOMHtmlElement)(document.createElement("div"))
 * console.log(element.tagName)
 * ```
 *
 * @since 0.0.0
 * @category schemas
 */
export const DOMHtmlElement = S.declare(isHTMLElement).pipe(
  $I.annoteSchema("DOMHtmlElement", {
    description: "An HTMLElement",
  })
);

/**
 * Type for {@link DOMHtmlElement}.
 *
 * @example
 * ```ts
 * import * as S from "effect/Schema"
 * import { DOMHtmlElement } from "@beep/schema/DomHtmlElement"
 *
 * const element: DOMHtmlElement = S.decodeUnknownSync(DOMHtmlElement)(document.createElement("div"))
 * console.log(element.tagName)
 * ```
 *
 * @since 0.0.0
 * @category models
 */
export type DOMHtmlElement = typeof DOMHtmlElement.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { DOMHtmlElement as DomHtmlElement, DOMHtmlElement as Schema };
