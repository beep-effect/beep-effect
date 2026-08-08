---
{}
---

No release: adopt `@effect/tsgo` 0.33.0 → 0.35.0 and make the diagnostic
surface explicit.

The 0.33.0 checker hooks segfault (nil-pointer in `ast.IsOuterExpression` via
`etscheckerhooks.afterCheckSourceFile`) while checking 28 workspace packages
against `effect` 4.0.0-beta.105's type surface. A panicking package reports no
diagnostics at all, so every rule finding in those packages was silently
masked — the same branch therefore moves to 0.35.0, where the crash is fixed
and the full rule surface is actually enforced everywhere. The rule inventory
is unchanged between 0.33.0 and 0.35.0 (95 rules).

The wrapper (0.19.0) and the seven platform binaries (0.24.3) had drifted apart
because only the wrapper was in syncpack's held-back group. The binaries are the
half that decides behaviour: `effect-tsgo patch` copies one over
`@typescript/typescript-<platform>/lib/tsc`, so the platform pin *is* the
compiler `bun run check` runs. Both now move together at 0.35.0 and the
hold-back covers all eight.

`diagnosticSeverity` in `tsconfig.base.json` is not a list of opt-ins — rules
omitted from it run at their upstream default. All 95 rules the compiler ships
are now listed and every one is `"error"`, which is exactly what the
`beep quality tsgo-rules` lane enforces: the listed set must match the
installed compiler, no entry may be anything other than `"error"`, and no
source file may carry a disable directive. Every violation the new rules
surfaced was fixed by code change rather than parked.

Most `missingPipeableSignature` fixes are spelling-only: named return aliases,
repaired dual optionality and declaration order, deferred conditional aliases
for naked type parameters and template-literal returns, and data-last partners
for Order comparators and codec factories. A minority are deliberate signature
restructures where dual dispatch is runtime-undecidable — co-equal or
all-optional parameters folded into options objects: the six PatentMetadata
extractors, `LiteralKit`'s two-argument mapped overload, `ThunkOf(output,
error)`, `Monoid.make`, `useSpinner`, `useNumberBoundary`, `useGraph3DHandle`,
`useGraph3DFps`, `setNestedValue`, `createSupportsColor`, `structuralRegion`,
`$createCodeBlockNode`, and `notSupported`'s message argument.
`Rdf.makeLiteral` drops its bare-string language overload,
`formatPostgresError` narrows to unary with a new `formatPostgresErrorWith`
palette factory, and `createContentSecurityPolicyOptionHeaderValue` drops four
never-used converter parameters. All in-repo call sites and JSDoc examples
moved with the new shapes.

Enabling `floatingEffectInVitest` fixed 80 tests that never ran:
`it("...", () => Effect.gen(...))` returns an Effect Vitest does not execute, so
those bodies and their assertions were skipped while reporting as passing.
Running them surfaced a stale upstream error string, a docgen fixture that could
not exercise its own premise, and two secure-header defects that are pinned to
actual behaviour with comments pending their own change.
