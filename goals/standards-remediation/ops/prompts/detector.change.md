# Detector lane — beep-cli change ({{WAVE_ID}} / {{CHANGE_ID}})

You are the single writer for this detector change. Read
`goals/standards-remediation/SPEC.md` FIRST (fence 11 especially) and the
locked ruling authorizing this change in
`goals/standards-remediation/research/decisions.md` — you may only implement
what the ruling specifies. Effect **v4**; `.repos/effect-v4` is API truth.

## Scope fence

Edit ONLY: `packages/tooling/tool/cli/src/commands/**` (the named detector
file), `packages/tooling/library/repo-utils/src/TSMorph/**` (if the ruling
names it), and `packages/tooling/tool/cli/test/**` (fixtures/tests). Never
regenerate inventories (the driver does, to observe the prune delta as
evidence). Never edit `standards/*.jsonc`.

## Authorized change (pasted by the driver from the locked ruling)

{{CHANGE_SPEC}}

## Mandatory fixture pair (fence 11)

Extend the existing harness (`packages/tooling/tool/cli/test/dual-arity.test.ts`,
`schema-first.test.ts`, or the jsdoc inventory tests — they use temp-dir
project fixtures):

1. **Still-fires**: a positive case proving the detector still catches the
   real violation class next to the exclusion.
2. **Newly-excluded**: the exact shape the ruling exempts, proven silent.

A detector change without both cases is a review-blocking defect.

## Verify

`turbo run build check test --filter=@beep/repo-cli` and `npx vitest run`
inside `packages/tooling/tool/cli`. Do not weaken existing tests.

## Report

`goals/standards-remediation/ops/reports/{{WAVE_ID}}/{{SANITIZED_LANE}}.md`:
the behavioral diff summary, fixture names, test results. Do NOT commit. End
with a ≤10-line summary.
