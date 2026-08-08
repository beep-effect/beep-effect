/**
 * Professional Desktop browser Atom runtime services.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

"use client";

import { ClientObservabilityLive } from "@beep/agents-client";
import { Layer } from "effect";
import { KeyValueStore } from "effect/unstable/persistence";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";
import { ComposerPolicyLive } from "@/chat/ui/ComposerPolicy";

const professionalAtomRuntimeFactory = Atom.context({
  memoMap: Layer.makeMemoMapUnsafe(),
});
professionalAtomRuntimeFactory.addGlobalLayer(ClientObservabilityLive);

// The application Context.Service layers every professional browser runtime
// atom can reach. Grown as policy moves out of atom closures into services.
const ProfessionalDesktopServicesLive = Layer.mergeAll(ComposerPolicyLive);

/**
 * Browser runtime mounted by the Professional Desktop Atom provider.
 *
 * @example
 * ```ts
 * import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime"
 *
 * console.log(typeof professionalBrowserRuntime.fn === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const professionalBrowserRuntime = professionalAtomRuntimeFactory(ProfessionalDesktopServicesLive);

// Browser-local persistence service backing the storage runtime.
const ProfessionalStorageLive = KeyValueStore.layerStorage(() => globalThis.localStorage);

/**
 * Shared browser-storage runtime for app-owned persisted atoms.
 *
 * @example
 * ```ts
 * import { professionalStorageRuntime } from "@/runtime/ProfessionalAtomRuntime"
 *
 * console.log(typeof professionalStorageRuntime.fn === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const professionalStorageRuntime = professionalAtomRuntimeFactory(ProfessionalStorageLive);

/**
 * The active application registry, exposed through the browser Atom runtime.
 *
 * Dock renderers temporarily enter a private dock registry, so the shell passes
 * this registry back to portaled application surfaces without reading React
 * context directly.
 *
 * @example
 * ```ts
 * import { professionalAtomRegistryAtom } from "@/runtime/ProfessionalAtomRuntime"
 *
 * console.log(typeof professionalAtomRegistryAtom === "object") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const professionalAtomRegistryAtom = professionalBrowserRuntime.atom(AtomRegistry.AtomRegistry);
