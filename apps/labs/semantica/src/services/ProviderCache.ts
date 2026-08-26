import { $SemanticaId } from "@beep/identity/packages";
import { Context } from "effect";
import type { Effect } from "effect";
import type * as O from "effect/Option";
import type { ProviderCacheCorrupt } from "@/schema/Errors";
import type { ProviderCacheEntry, ProviderCacheKey } from "@/schema/ProviderCache";

const $I = $SemanticaId.create("services/ProviderCache");

/**
 * Immutable content-addressed provider response storage.
 *
 * @category services
 * @since 0.0.0
 */
interface ProviderCacheShape {
  readonly lookup: (key: ProviderCacheKey) => Effect.Effect<O.Option<ProviderCacheEntry>, ProviderCacheCorrupt>;
  readonly store: (entry: ProviderCacheEntry) => Effect.Effect<void, ProviderCacheCorrupt>;
}

/**
 * App-local write-once provider cache boundary.
 *
 * @category services
 * @since 0.0.0
 */
export class ProviderCache extends Context.Service<ProviderCache, ProviderCacheShape>()($I`ProviderCache`) {}
