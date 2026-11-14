/**
 * The exported shape of a Vercel resource constructor.
 *
 * @packageDocumentation
 * @since 0.0.0
 */

import type { PropsInput } from "alchemy/Input";
import type { ResourceClass, ResourceLike } from "alchemy/Resource";
import type * as Effect from "effect/Effect";

/**
 * A resource class as this package exports it: Alchemy's `ResourceClass`
 * without the overload that takes props as an `Effect`.
 *
 * **Details**
 *
 * The repository's `missingPipeableSignature` diagnostic rejects that
 * fixed-arity overload on an exported value. Declarations yield their props
 * first instead (`const props = yield* ...`), which is equivalent.
 *
 * @since 0.0.0
 * @internal
 */
export interface DeclaredResource<R extends ResourceLike>
  extends Pick<ResourceClass<R>, "Type" | "Props" | "Self" | "Provider" | "Aliases" | "ref"> {
  (
    id: string,
    ...args: {} extends R["Props"] ? [props?: PropsInput<R["Props"]>] : [props: PropsInput<R["Props"]>]
  ): Effect.Effect<R, never, R["Providers"]>;
}
