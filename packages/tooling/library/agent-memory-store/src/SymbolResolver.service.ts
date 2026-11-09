/**
 * Symbol resolver contract: decides whether a code symbol a note references is
 * still live.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import { $AgentMemoryStoreId } from "@beep/identity/packages";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import type { SymbolResolutionError } from "./AgentMemoryStore.errors.ts";
import type { SymbolReference, SymbolResolution } from "./Scip.models.ts";

const $I = $AgentMemoryStoreId.create("SymbolResolver.service");

/**
 * Resolves symbol references against the SCIP index its Layer owns.
 *
 * **Details**
 *
 * Decision `symbol-resolver-port-scip-driver-p3`: SCIP resolves identity and
 * the result carries it. A symbol SCIP defines whose normalized span hash
 * still matches yields `live` with its current definition; one whose span
 * hash changed yields `reverify` with both hashes, never stale (S35); a
 * symbol SCIP cannot find yields `unresolved`.
 *
 * Decision `symbol-resolver-owns-its-index`: the contract takes the reference
 * only. The implementing Layer loads and holds the index, and reads the
 * defining span through its own dependency (for example `FileSystem`) to hash
 * it, so neither the index document nor that requirement appears here. P3
 * adds the SCIP driver that provides this port.
 *
 * **Example** (Resolve a symbol reference)
 *
 * ```ts
 * import { SymbolReference, SymbolResolver } from "@beep/agent-memory-store"
 * import * as Effect from "effect/Effect"
 *
 * const check = (reference: SymbolReference) =>
 *   Effect.gen(function* () {
 *     const resolver = yield* SymbolResolver
 *     return yield* resolver.resolve(reference)
 *   })
 * console.log(check)
 * ```
 *
 * @category services
 * @since 0.0.0
 */
export class SymbolResolver extends Context.Service<
  SymbolResolver,
  {
    readonly resolve: (reference: SymbolReference) => Effect.Effect<SymbolResolution, SymbolResolutionError>;
  }
>()($I`SymbolResolver`) {}
