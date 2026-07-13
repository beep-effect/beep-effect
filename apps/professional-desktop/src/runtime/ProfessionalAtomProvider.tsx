/**
 * Professional Desktop Atom registry provider.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

"use client";

import { RegistryProvider, useAtomMount } from "@effect/atom-react";
import { browserFailureListenersAtom } from "./BrowserFailure.atoms.ts";
import { professionalBrowserRuntime } from "./ProfessionalAtomRuntime.ts";
import type { ReactNode } from "react";

const chatIdleTtlMs = 30_000;

function ProfessionalAtomRuntimeMount({ children }: { readonly children: ReactNode }) {
  useAtomMount(professionalBrowserRuntime);
  useAtomMount(browserFailureListenersAtom);

  return <>{children}</>;
}

/**
 * Provides the app-local Atom registry and runtime for the desktop chat surface.
 *
 * @example
 * ```tsx
 * import { ProfessionalAtomProvider } from "@/runtime/ProfessionalAtomProvider"
 *
 * const provider = <ProfessionalAtomProvider><main /></ProfessionalAtomProvider>
 * console.log(provider.type)
 * ```
 *
 * @category providers
 * @since 0.0.0
 */
export function ProfessionalAtomProvider({ children }: { readonly children: ReactNode }) {
  return (
    <RegistryProvider defaultIdleTTL={chatIdleTtlMs}>
      <ProfessionalAtomRuntimeMount>{children}</ProfessionalAtomRuntimeMount>
    </RegistryProvider>
  );
}
