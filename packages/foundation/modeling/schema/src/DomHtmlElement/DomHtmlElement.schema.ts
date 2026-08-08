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
 * **Example** (Guard HTMLElement instance)
 *
 * ```ts
 * import { isHTMLElement } from "@beep/schema/DomHtmlElement"
 *
 * console.log(isHTMLElement(document.createElement("div")))
 * ```
 *
 * @category guards
 * @since 0.0.0
 */
export const isHTMLElement = (u: unknown): u is HTMLElement => u instanceof HTMLElement;

/**
 * An HTMLElement.
 *
 * **Example** (Decode HTMLElement with schema)
 *
 * ```ts
 * import { DOMHtmlElement } from "@beep/schema/DomHtmlElement"
 * import * as S from "effect/Schema"
 *
 * const element = S.decodeUnknownSync(DOMHtmlElement)(document.createElement("div"))
 * console.log(element.tagName)
 * ```
 *
 * @category schemas
 * @since 0.0.0
 */
export const DOMHtmlElement = S.declare(isHTMLElement).pipe(
  $I.annoteSchema("DOMHtmlElement", {
    description: "An HTMLElement",
  })
);

/**
 * Type for {@link DOMHtmlElement}.
 *
 * **Example** (Typed DOMHtmlElement decode)
 *
 * ```ts
 * import * as S from "effect/Schema"
 * import { DOMHtmlElement } from "@beep/schema/DomHtmlElement"
 *
 * const element: DOMHtmlElement = S.decodeUnknownSync(DOMHtmlElement)(document.createElement("div"))
 * console.log(element.tagName)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type DOMHtmlElement = typeof DOMHtmlElement.Type;

/**
 * Public aliases for concise namespace roles.
 *
 * @category schemas
 * @since 0.0.0
 */
export { DOMHtmlElement as DomHtmlElement, DOMHtmlElement as Schema };
