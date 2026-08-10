/**
 * OIP Atom registry provider.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

"use client";

import { RegistryProvider, useAtomMount } from "@effect/atom-react";
import { oipBrowserRuntime } from "./OipAtomRuntime";
import type { ReactNode } from "react";

function OipAtomRuntimeMount({ children }: { readonly children: ReactNode }) {
  useAtomMount(oipBrowserRuntime);

  return <>{children}</>;
}

/**
 * Provides the OIP app-local Atom registry and browser runtime.
 *
 * **Example** (Rendering atom provider)
 *
 * ```tsx
 * import { OipAtomProvider } from "@beep/oip-web/runtime/OipAtomProvider"
 *
 * const provider = <OipAtomProvider><main /></OipAtomProvider>
 * console.log(provider.type)
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
export function OipAtomProvider({ children }: { readonly children: ReactNode }) {
  return (
    <RegistryProvider defaultIdleTTL={1_000}>
      <OipAtomRuntimeMount>{children}</OipAtomRuntimeMount>
    </RegistryProvider>
  );
}
