# Box Typecheck Cost

## Status

Lifecycle: `completed-retained`

Decision document and implementation shipped in the same PR on 2026-08-01.
**Lever 1 (the demand-scoped prune) met budget on its own** — levers 2
(generator-emitted type annotations) and 3 (per-manager split) were never
fired and are retained as designed-but-unbuilt.

| Scope | Baseline | Post-prune | Change |
| --- | ---: | ---: | ---: |
| package instantiations | 7,472,755 | 2,503,112 | **−66.5%** |
| `Box.models.gen.ts` absolute | 4,809,560 | 1,987,845 | −58.7% |
| `Box.models.gen.ts` marginal | 3,160,295 | 338,580 | **−89.3%** |
| check time (file) | 6.797s | 0.816s | −88% |
| generated lines | 88,709 | 9,822 | −89% |

Surface: 9 of 85 managers, 34 of 333 operations, 294 of 2,763 model schemas.

## Mission

Bring `@beep/box`'s type-checking cost under an explicit instantiation budget by
scoping the generated SDK surface to declared demand, and record the staged
levers to fire if pruning alone misses budget.

At HEAD the driver generates 85 manager groups / 333 operations / 2,563 model
classes for a repo whose actual demand is 9 managers. `Box.models.gen.ts` alone
costs ~4.8M type instantiations; the package costs ~7.3M and periodically
exposes the TS2589 native-compiler flake class during full local proofs.

## Reading Order

1. [SPEC.md](./SPEC.md) — the decision document. Authoritative contract.
2. [PLAN.md](./PLAN.md) — phased implementation path.
3. [GOAL.md](./GOAL.md) — `/goal` execution prompt.
4. [ops/manifest.json](./ops/manifest.json) — machine-readable packet state.

## Decisions at a Glance

| ID | Decision |
| --- | --- |
| D1 | Coverage is demand-scoped, not vendor-complete. Initial allowlist is 9 managers. |
| D2 | Manager manifest lives inside the driver; model roots are discovered by scanning the driver's own `src/` only — never product code. |
| D3 | A missing manager is a compile error, not a runtime error. |
| D4 | Budget ≤750K *marginal* per generated file (amended — see below), ≤3M absolute package-wide. Levers staged: prune → annotations → split. |
| D5 | Budget is a documented ritual triggered by manifest edits, not a CI gate. |
| D6 | `@beep/ui` (~3.5M) is out of scope; separate packet after lever 2 is proven. |

## Relationship to `goals/box-driver`

This packet supersedes the **mission framing** of `goals/box-driver`
("full-surface, generated"). It contradicts none of that packet's 10 locked
`keyDecisions` — `generate-from-sdk-types` in particular survives intact, since
this changes the generator's input scope, not its method.

No `standards/architecture/DECISIONS.md` entry: this is a driver-level decision,
following the precedent of `box-driver`'s own `pragmatic-generated-fidelity`.

## The budget amendment

The per-file budget was originally written as "≤1.5M instantiations, absolute".
Measurement during P2 showed that a file importing only `@beep/identity`,
`@beep/schema`, and `effect/Schema` — declaring one trivial schema — already
costs **1,649,265 instantiations**. The original threshold sat *below that
floor*: unachievable by construction, and measuring mostly a constant.

Post-prune, `Box.models.gen.ts` is 83% floor. Box's own contribution is 338,580
instantiations, down from 3,160,295. The per-file budget is therefore restated
in marginal terms (`total − floor`), which is the only number that responds to
work done on this package. The package-wide ≤3M absolute budget was meaningful
as written and was met.

## Known Unknowns

- Whether tsgo's parallel checker makes a per-manager split move total
  instantiations at all remains unvalidated — lever 3 was never fired. `SPEC.md`
  §4 still requires a throwaway half-split measurement before committing it.
- The marginal-cost framing has not been applied to `@beep/ui` (~3.5M absolute).
  Its floor is different (React + component generics, not `effect/Schema`), so
  its marginal number must be derived from its own probe before any budget is
  set there.
