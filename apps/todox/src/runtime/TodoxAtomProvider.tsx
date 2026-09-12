/**
 * Todox Atom registry provider.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

"use client";

import { RegistryProvider } from "@effect/atom-react";
import type { ReactNode } from "react";

/**
 * Provides the app-local Atom registry that holds record-inspector selection.
 *
 * **Example** (Wrap the page)
 *
 * ```ts
 * import { TodoxAtomProvider } from "@/runtime/TodoxAtomProvider"
 * import { createElement } from "react"
 *
 * const tree = createElement(TodoxAtomProvider, null, createElement("main"))
 * console.log(tree.type === TodoxAtomProvider)
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
export function TodoxAtomProvider({ children }: { readonly children: ReactNode }) {
  return <RegistryProvider defaultIdleTTL={1_000}>{children}</RegistryProvider>;
}
