/**
 * HTML text schemas.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $SchemaId } from "@beep/identity/packages";
import * as S from "effect/Schema";

const $I = $SchemaId.create("Html");

/**
 * Branded schema for trusted HTML fragment strings.
 *
 * **Details**
 *
 * Use this for rendered snippets such as Markdown or rich-text projections that
 * are valid to embed inside an existing HTML document body.
 *
 * This is a nominal trust brand only. Decoding this schema does not sanitize or
 * validate HTML payload safety.
 *
 * **Example** (Make branded HTML fragment)
 *
 * ```ts
 * import { HtmlFragment } from "@beep/schema/Html"
 *
 * const fragment = HtmlFragment.make("<p>Hello</p>")
 * console.log(fragment) // "<p>Hello</p>"
 * ```
 *
 * @category validation
 * @since 0.0.0
 */
export const HtmlFragment = S.String.pipe(
  S.brand("HtmlFragment"),
  $I.annoteSchema("HtmlFragment", {
    description:
      "Trusted HTML fragment text that can be embedded inside a larger HTML document. This is a nominal trust brand and does not perform HTML sanitization.",
  })
);

/**
 * Type for {@link HtmlFragment}.
 *
 * **Example** (Type HtmlFragment parameter)
 *
 * ```ts import.meta.vitest name="Type HtmlFragment parameter"
 * import type { HtmlFragment } from "@beep/schema/Html"
 *
 * const render = (value: HtmlFragment) => value
 * console.log(render)
 * ```
 *
 * @category models
 * @since 0.0.0
 */
export type HtmlFragment = typeof HtmlFragment.Type;
