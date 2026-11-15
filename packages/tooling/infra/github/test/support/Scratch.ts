/**
 * A typed view of the harness's scratch stack. `ScratchStack` erases its
 * error channel to `any`; this restates the failures Alchemy declares for a
 * deployment plus the definition's own `E`, so no erased channel reaches a
 * test.
 */
import type * as GitHub from "@alchemy.run/github";
import type * as Core from "@alchemy.run/test/Core";
import type * as Test from "@alchemy.run/test/Vitest";
import type { Input } from "alchemy/Input";
import type * as Plan from "alchemy/Plan";
import type { StackServices } from "alchemy/Stack";
import type * as Effect from "effect/Effect";

/** The failures Alchemy's own top-level `deploy` declares for a stack deployment. */
export type DeployError = Effect.Error<Core.DeployResult<unknown>>;

type Remaining<R> = Exclude<R, GitHub.Providers | StackServices>;

/** Deploy, plan and destroy with their error channels restated. */
export interface TypedScratch {
  deploy<A, E, R>(definition: Effect.Effect<A, E, R>): Effect.Effect<Input.Resolve<A>, DeployError | E, Remaining<R>>;
  destroy(options?: { readonly include?: never; readonly exclude?: never }): Effect.Effect<void, DeployError>;
  plan<A, E, R>(definition: Effect.Effect<A, E, R>): Effect.Effect<Plan.Plan<A>, DeployError | E, Remaining<R>>;
}

/** The scratch stack, viewed through {@link TypedScratch}. */
export const typed = (stack: Test.ScratchStack): TypedScratch => stack;
