/**
 * Professional Desktop browser Atom runtime services.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

"use client";

import { ClientObservabilityLive } from "@beep/agents-client";
import * as Layer from "effect/Layer";
import { KeyValueStore } from "effect/unstable/persistence";
import { Atom, AtomRegistry } from "effect/unstable/reactivity";

const professionalAtomRuntimeFactory = Atom.context({
  memoMap: Layer.makeMemoMapUnsafe(),
});
professionalAtomRuntimeFactory.addGlobalLayer(ClientObservabilityLive);

/**
 * Browser runtime mounted by the Professional Desktop Atom provider.
 *
 * **Example** (Verify fn is function)
 *
 * ```ts
 * import { professionalBrowserRuntime } from "@/runtime/ProfessionalAtomRuntime"
 *
 * console.log(typeof professionalBrowserRuntime.fn === "function") // true
 * ```
 *
 * @category atoms
 * @since 0.0.0
 */
export const professionalBrowserRuntime = professionalAtomRuntimeFactory(Layer.empty);

/**
 * Browser-local persistence service shared by the runtime and bootstrap
 * migrations that must complete before persisted atoms mount.
 *
 * **Example** (Confirm is a Layer)
 *
 * ```ts
 * import { ProfessionalStorageLive } from "@/runtime/ProfessionalAtomRuntime"
 * import * as Layer from "effect/Layer";
 * console.log(Layer.isLayer(ProfessionalStorageLive)) // true
 * ```
 *
 * @category layers
 * @since 0.0.0
 */
export const ProfessionalStorageLive = KeyValueStore.layerStorage(() => globalThis.localStorage);

/**
 * Shared browser-storage runtime for app-owned persisted atoms.
 *
 * **Example** (Verify storage fn type)
 *
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
 * **Details**
 *
 * Dock renderers temporarily enter a private dock registry, so the shell passes
 * this registry back to portaled application surfaces without reading React
 * context directly.
 *
 * **Example** (Assert registry is object)
 *
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
