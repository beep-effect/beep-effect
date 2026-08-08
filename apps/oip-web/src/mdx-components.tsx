/**
 * MDX component bindings for oip web.
 *
 * @since 0.0.0
 * @packageDocumentation
 */

import type { MDXComponents } from "mdx/types";

const components: MDXComponents = {};

/**
 * Returns the MDX component overrides used by oip web.
 *
 * **Example** (Counting MDX components)
 *
 * ```ts
 * import { useMDXComponents } from "@beep/oip-web/mdx-components"
 *
 * const components = useMDXComponents()
 * console.log(Object.keys(components).length)
 * ```
 *
 * @category constructors
 * @since 0.0.0
 */
export function useMDXComponents(): MDXComponents {
  return components;
}
