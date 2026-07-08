# Fixer lane — effect-laws allowlist challenge ({{WAVE_ID}} / {{SCOPE_LABEL}})

You are the single writer for the files named in your slice. Read
`goals/standards-remediation/SPEC.md` FIRST (fences 10–14, RC-ALLOWLIST,
report contract). Effect **v4** only; `.repos/effect-v4` is API truth.

Mission: the user explicitly wants every "justified" allowlist entry
CHALLENGED. Your default is conversion, not confirmation.

## Assigned entries (pasted by the driver; each carries kind/reason/owner/issue)

{{ENTRY_SLICE}}

## Procedure

1. Attempt the conversion per kind:
   - `new-map-set` → `MutableHashMap` / `HashMap` / `HashSet` /
     `MutableHashSet` (verify exact v4 module paths first).
   - `native-error` → `Data.TaggedError` (or the repo's tagged-error pattern).
   - `date-static` → `Clock` / `DateTime` service access.
   - `object-method` → effect helper modules (`Struct`, `Record`, ...).
2. Benchmark-sensitive or GC-sensitive claims (e.g. WeakMap memoization
   keeping builders collectable): attempt the conversion, run the package
   tests, and evaluate the claim concretely — does anything actually rely on
   weak semantics? Cite the line(s) that do.
3. Only if conversion demonstrably breaks behavior or load-bearing semantics:
   report `disposition: unconvertible` with the failed diff + the concrete
   semantic dependency. The driver re-verifies personally; unverified claims
   are returned to the lane.

## Verify (scoped — fence 12)

`turbo run build check test --filter=<touched package>` and `npx vitest run`
inside the package. Never edit `standards/effect-laws.allowlist.jsonc`
(driver-owned).

## Report

`goals/standards-remediation/ops/reports/{{WAVE_ID}}/{{SANITIZED_LANE}}.md`:
per-entry dispositions with evidence, files touched, commands + outcomes.
Do NOT commit. End with a ≤10-line summary.
