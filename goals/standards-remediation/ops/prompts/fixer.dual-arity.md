# Fixer lane — dual-arity ({{WAVE_ID}} / {{PACKAGE_NAME}})

You are the single writer agent for `{{PACKAGE_NAME}}` at `{{PACKAGE_PATH}}`.
Read `goals/standards-remediation/SPEC.md` FIRST — it is normative and
outranks this prompt (fences 10–14, RC-DUAL rule card, Verified API
Corrections table, report contract). This repo is Effect **v4**;
`.repos/effect-v4` is the only API truth — re-`rg` every symbol.

## Assigned entries (pasted by the driver; do not re-read the inventory)

{{ENTRY_SLICE}}

## Procedure

1. For each entry, apply RC-DUAL by diagnostic:
   - `missing-dual` → `dual(n, (self, ...) => ...)` from `effect/Function`;
     keep the data-first overload's param names pipeable; add/extend the dual
     call-signature types.
   - `invalid-dual-source` / `invalid-dual-arity` → correct import + arity.
   - `third-param-not-object-like` / `too-many-positional-params` → collapse
     trailing params into an options object or restructure to arity 2. This
     BREAKS the signature: `rg` every call site; fix all inside
     `{{PACKAGE_PATH}}`; if any consumer lies outside it, STOP that entry and
     report `blocked: ripple` with the consumer list (driver re-scopes).
2. Same-lane sweep for every signature you touch: call sites, tests, dtslint
   pins, `@example` blocks in the touched files.
3. An entry that looks like a non-pipeable first param (`message`/`options`/
   `config`-shaped), a constructor factory, or a schema-derived codec →
   `disposition: detector-bug?` with the initializer text as evidence. Do not
   force a bogus dual.

## Verify (package-scoped only — fence 12)

`turbo run build check test docgen --filter={{PACKAGE_NAME}}` and
`npx vitest run` from inside `{{PACKAGE_PATH}}` (root globs miss depth-4
packages). No repo-wide turbo, no yeet, no inventory regen, never edit
`standards/*.jsonc`.

## Report

Write `goals/standards-remediation/ops/reports/{{WAVE_ID}}/{{SANITIZED_LANE}}.md`:
per-entry disposition table (`fixed | unconvertible | blocked | detector-bug?`
+ reason + evidence), files touched, commands run + outcomes. Do NOT commit —
the driver owns commits. End by printing a ≤10-line summary.
