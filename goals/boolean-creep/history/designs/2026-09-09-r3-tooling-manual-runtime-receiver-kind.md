# Instance

- id: `r3-tooling-manual-runtime-receiver-kind`
- file:line:
  `packages/tooling/policy-pack/lint-rules/src/rules/no-manual-effect-runtime-in-tests.ts:191`
- symbol: `runnerLabel.receiverKind`
- members: `isEffectReceiver`, `isManagedRuntimeReceiver`
- evidence:
  - E1 at `no-manual-effect-runtime-in-tests.ts:219-231` — both the named
    import and module import writers use one `if/else-if` chain, so a local
    binding is recorded as an Effect receiver or a ManagedRuntime receiver,
    never both.
  - E2 at `no-manual-effect-runtime-in-tests.ts:197-205` — `runnerLabel`
    gives the Effect probe precedence through `Option.orElse` and has no
    combined-true receiver arm.

# Current shape

The rule tracks Effect, ManagedRuntime, and root `effect` imports in separate
sets. At each member call, two boolean helpers ask which runtime namespace the
receiver denotes. Two more helpers combine those booleans with the property
name and `runnerLabel` selects the first optional diagnostic label. The
receiver has one kind, but that fact is distributed across two predicates and
an ordering-sensitive `Option.orElse`.

# Cardinality gap

Four pairs are representable, while three receiver states are legal:
`effect`, `managed-runtime`, and untracked. The exclusive binding writers and
the AST/import binding rules exclude a combined Effect-and-ManagedRuntime
receiver.

# Target schema

Add a private named `ManualRuntimeReceiverKind` LiteralKit with `effect` and
`managed-runtime`, imported from the narrow `@beep/schema/LiteralKit` subpath.
Create one classifier returning `Option<ManualRuntimeReceiverKind>`; `None`
means an untracked receiver. Match the kind together with the existing
property constraints to produce the exact existing `Effect.<method>` or
`ManagedRuntime.make` label. Add `@beep/schema` to the package manifest if it
is not already available through the package's declared dependencies; do not
reach through another package or hand-roll a string union.

# Migration inventory

- `no-manual-effect-runtime-in-tests.ts:9-18` — add the narrow LiteralKit
  import while retaining the Effect `HashMap`, `HashSet`, `MutableHashSet`,
  and `Option` imports used by the rule.
- `no-manual-effect-runtime-in-tests.ts:170-176` — retain the three tracked
  binding sets. They represent independent imported namespaces, not the
  transient receiver classification being replaced.
- `no-manual-effect-runtime-in-tests.ts:177-195` — keep `isTracked` and
  `isRootMember`; replace the two sibling receiver booleans with the single
  optional receiver-kind classifier.
- `no-manual-effect-runtime-in-tests.ts:197-211` — replace `effectRunner`,
  `managedRuntimeRunner`, and their `Option.orElse` composition with one
  exhaustive kind/property match. Preserve the exact diagnostic label strings
  and the existing optional result consumed by `manualRunnerName`.
- `no-manual-effect-runtime-in-tests.ts:213-251` — preserve the exclusive
  import writers, binding traversal, test-file gate, baseline counting, and
  occurrence ordering. The new classifier reads the same sets those writers
  populate.
- `src/rules/index.ts:13,63` and the package root export continue to expose the
  same default rule under `no-manual-effect-runtime-in-tests`; the private
  literal and classifier are not exported.
- `package.json` — declare the direct `@beep/schema` dependency required by
  the narrow LiteralKit import and follow the repository changeset-ignore
  policy for this private policy package.
- `test/oxlint-sources.ts:240-283` and `test/oxlint-rules.test.ts:1-110` —
  extend the existing spawned-oxlint table rather than adding a source-relative
  product import.

# Guard-deletion accounting

Delete `isEffectReceiver`, `isManagedRuntimeReceiver`, `effectRunner`,
`managedRuntimeRunner`, and the precedence-bearing `Option.orElse` in
`runnerLabel`. The sole receiver classifier owns the previously implicit
mutual-exclusion invariant; one exhaustive match owns method eligibility and
diagnostic-label construction.

# Encoded-side impact

None. The literal is private derived AST state. Rule id, severity, test-file
selection, legacy allowance counts, finding order, source locations, and the
exact `Do not use Effect.<method>` / `Do not use ManagedRuntime.make` messages
remain unchanged.

# Test impact

Retain the direct and aliased named Effect imports, root namespace
`Eff.Effect.run*`, and ManagedRuntime namespace cases. Add named and default
`effect/Effect`, named/default/root ManagedRuntime forms, every accepted
Effect runtime method, wrong-property cases on both receiver kinds, unrelated
and shadowed namespaces, type-only imports, non-member calls, and a fixture
with both kinds imported under different locals. Assert exact finding count,
line, rule id, and diagnostic label where the harness exposes it. Run the
focused lint-rule tests and full `@beep/lint-rules` package verification.

# Risk and sequencing

Land in Tier 1E. Preserve binding provenance and the legacy occurrence
baseline exactly; this refactor classifies an already recognized receiver and
must not broaden which imports or methods count as manual runtime usage.
