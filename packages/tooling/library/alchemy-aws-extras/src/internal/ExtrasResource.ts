/**
 * Public call surface of the resources in this package.
 *
 * @packageDocumentation
 * @internal
 * @since 0.0.0
 */

import type { PropsInput } from "alchemy/Input";
import type { ResourceClassLike, ResourceLike } from "alchemy/Resource";
import type * as Effect from "effect/Effect";

/**
 * The `Resource(...)` constructor narrowed to its declaration form,
 * `Resource("id", props)`.
 *
 * **Details**
 *
 * Alchemy's `ResourceClass` also carries a `(id, Effect<props>)` overload and
 * a methods-extension overload. The repo's `missingPipeableSignature`
 * diagnostic rejects the first on an exported value, and no stack in this
 * repo uses either, so the exported constants are typed through this
 * interface. The runtime value is Alchemy's unchanged constructor.
 *
 * @internal
 * @since 0.0.0
 */
export interface ExtrasResource<R extends ResourceLike> extends ResourceClassLike<R> {
  ref(id: string, options?: { stage?: string; stack?: string }): Effect.Effect<R>;
  (
    id: string,
    ...args: {} extends R["Props"] ? [props?: PropsInput<R["Props"]>] : [props: PropsInput<R["Props"]>]
  ): Effect.Effect<R, never, R["Providers"]>;
}
