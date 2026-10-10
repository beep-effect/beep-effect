// Repo-law canary for the effected-port `lint` gate.
//
// Each declaration violates one `bun run beep laws` rule on purpose. The gate
// includes this file in every law run and refuses to go green unless the law
// reports it, so a law that silently scans nothing (an excluded path prefix, an
// empty promotion list, a scope change) turns the gate red instead of passing.
// Never "fix" this file; it sits outside every tsconfig, oxlint and module scope.

// effect-imports: a root `effect` import of module namespaces
import { Effect } from "effect";
import * as O from "effect/Option";

// effect-fn: a reusable function returning Effect.gen directly
export const canaryGen = (value: number) =>
  Effect.gen(function* () {
    return yield* Effect.succeed(value);
  });

// terse-effect: a trivial wrapper lambda around a helper
export const canaryHelperRef = { none: () => O.none<number>() };

// native-runtime: native Map construction in runtime code
export const canaryMap = new Map<string, number>();

// oxlint beep(no-inline-schema-compile): a schema built inline at the call site
import * as S from "effect/Schema";
export const canaryInlineSchema = (value: unknown): boolean => S.is(S.Record(S.String, S.String))(value);
