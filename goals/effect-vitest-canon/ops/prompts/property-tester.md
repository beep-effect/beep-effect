# Property Tester

Use lane-contract.md. Lens: property. Apply after scope and assertion structure
are stable, before flake and observability changes.

## Mission and rules

Turn schema invariants and domain laws into meaningful generated tests.
A failing generated value is evidence about the production boundary: sharpen
the production schema or its arbitrary annotation when it accepts invalid data.
Never substitute a weaker test-only schema, lower the run floor, raise a timeout
or discard difficult values merely to pass. Any required production change is
its own finding and is called out in the wave PR.

At rc.112 synchronous it.prop accepts FastCheck Arbitraries at runtime and
throws for Schemas even though the public type is permissive. it.effect.prop
and it.live.prop accept Schemas or FastCheck Arbitraries. Options use fastCheck,
not arbitrary. Explicit parameters use fcRuns(n), which returns the parameter
object and honors BEEP_FC_NUM_RUNS; do not put fcRuns(n) inside numRuns.
Omitting explicit parameters inherits the global floor. Preserve existing seeds,
runs, shrinking, preconditions and failure visibility during migration.

Use existing assertSchemaArbitraryDecodesToSelf for schema round-trip laws when
it fits. Bound recursive generators and collections through valid domain
constraints, sparse recursion and supported annotations, not fewer trials.
Keep rich valid input and deliberate invalid-boundary cases distinct.

## Judgment beyond detectors

Check vacuous assertions, schema/arbitrary disagreement, discarded invalid
values, accidental coverage narrowing, expensive recursion, nondeterministic
seeds, conflated property/setup failures and laws that only restate code.
Reproduce the CI property lane with BEEP_FC_NUM_RUNS=400 and
BEEP_FC_SEED=20260708; nightly uses its existing higher floor.

Suggested rules: L-PROP-01 schema boundary gap, L-PROP-02 arbitrary gap,
L-PROP-03 floor/seed loss, L-PROP-04 vacuous law, L-PROP-05 generator explosion.
Use the shared finding schema and record the minimal counterexample, seed and
reproduction command where available. Do not expose secret generated data.

## Evidence and pinned anchors

Use the production schema, arbitrary annotations, existing test-kit helpers,
detector EV007 rows and failure/shrink output. Anchors: it.effect.prop
(index.ts 68-94), it.prop (119-139), both fastCheck option entries, and utils
assertions in the graph. Pinned internal.ts 177-208 rejects synchronous Schema
inputs. That runtime distinction is proven by P0d fixtures, not inferred from
a successful typecheck.

## Worked property registration migration

Before: a manual FastCheck runner sits inside an ordinary test callback.

~~~ts
import { fcRuns } from "@beep/fc-runs"
import { it } from "@effect/vitest"
import { assertTrue } from "@effect/vitest/utils"
import { Number } from "effect"
import * as fc from "effect/testing/FastCheck"

it("integer", () => {
  fc.assert(fc.property(fc.integer(), (value) => {
    assertTrue(Number.round(value, 0) === value)
  }), fcRuns(100))
})
~~~

After: the effect property uses the production-style Schema input and preserves
the same explicit run floor. Keep the real domain law when applying this shape.

~~~ts
import { fcRuns } from "@beep/fc-runs"
import { it } from "@effect/vitest"
import { assertTrue } from "@effect/vitest/utils"
import { Effect, Number, Schema } from "effect"

it.effect.prop("integer", { value: Schema.Int }, ({ value }) =>
  Effect.sync(() => assertTrue(Number.round(value, 0) === value)),
  { fastCheck: fcRuns(100) }
)
~~~

For a synchronous law, it.prop with fc.integer() is also valid. Do not copy a
Schema argument into that synchronous form. This illustrative integer law is
not a substitute for the package's actual invariants or richer domain coverage.
