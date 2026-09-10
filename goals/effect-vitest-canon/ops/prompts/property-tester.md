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

At rc.113, synchronous it.prop and it.effect.prop / it.live.prop accept Schemas
or native Arbitrary inputs. Options use arbitrary: Arbitrary.CheckOptions.
Explicit parameters use `{ arbitrary: fcRuns(n) }`; fcRuns returns the native
runs/seed object and honors BEEP_FC_NUM_RUNS and BEEP_FC_SEED. Do not nest the
object inside runs. Omitting options does not inherit the CI floor because the
native engine has no global configuration. Preserve existing seeds, runs,
shrinking, preconditions, replay and failure visibility during migration.
Replay tokens override runs and seed options and reproduce one case; replay is
additional evidence and does not replace the normal CI floor-bearing run.
Sync properties must not return an Effect or Promise. Effect/live properties
must return an Effect. Check that generation, evaluation and shrinking share
the registration's deadline and lifecycle.

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

Use the production schema, native arbitrary annotations, existing test-kit
helpers, detector EV007 rows and failure/shrink output. Graph anchors include
it.effect.prop, it.live.prop, it.prop, their arbitrary options, Arbitrary.schema
and Arbitrary.CheckOptions. Verify both source types and runtime behavior at
the immutable rc.113 tag. Prior rc.112 Schema-rejection probes are historical.

## Worked property registration migration

Before: a manual native property runner sits inside an Effect test body.

~~~ts
import { fcRuns } from "@beep/fc-runs"
import { it } from "@effect/vitest"
import { assertTrue } from "@effect/vitest/utils"
import { Effect, Number, Schema } from "effect"
import { Arbitrary } from "effect/unstable/arbitrary"

it.effect("integer", Effect.fnUntraced(function* () {
  const result = yield* Arbitrary.checkEffect(
    Arbitrary.schema(Schema.Int),
    (value) => Number.round(value, 0) === value,
    fcRuns(100)
  )
  assertTrue(result._tag === "Passed")
}))
~~~

After: the property registration consumes the same Schema and explicit run
floor. Keep the real domain law when applying this shape.

~~~ts
import { fcRuns } from "@beep/fc-runs"
import { it } from "@effect/vitest"
import { assertTrue } from "@effect/vitest/utils"
import { Number, Schema } from "effect"

it.prop("integer", { value: Schema.Int }, ({ value }) => {
  assertTrue(Number.round(value, 0) === value)
}, { arbitrary: fcRuns(100) })
~~~

Use it.effect.prop for an Effect-returning law. This illustrative integer law
is not a substitute for the package's actual invariants or richer domain coverage.
