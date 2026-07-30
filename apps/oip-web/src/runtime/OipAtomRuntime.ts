/**
 * OIP browser Atom runtime services.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

"use client";

import * as BrowserHttpClient from "@effect/platform-browser/BrowserHttpClient";
import { Layer } from "effect";
import { Atom } from "effect/unstable/reactivity";

const oipAtomRuntimeFactory = Atom.context({
  memoMap: Layer.makeMemoMapUnsafe(),
});

/**
 * Browser runtime mounted by the OIP app provider.
 *
 * @example
 * ```ts
 * import { oipBrowserRuntime } from "@beep/oip-web/runtime/OipAtomRuntime"
 *
 * console.log(oipBrowserRuntime)
 * ```
 *
 * @category runtime
 * @since 0.0.0
 */
export const oipBrowserRuntime = oipAtomRuntimeFactory(BrowserHttpClient.layerFetch);
