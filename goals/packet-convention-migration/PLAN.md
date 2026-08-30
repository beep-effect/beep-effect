# PLAN — Packet Convention Migration

Mutable execution plan. `SPEC.md` is normative.

## P0 — Research and rulings (COMPLETE 2026-08-26)

Session B's three repository audits and three prior-art sweeps are preserved
under the parent exploration. D17–D26 charter the campaign, settle H/I/J, route
J to `typed-agent-skill-contracts`, choose the applier-only first slice, and
authorize one-PR delivery.

## P1 — Implement (COMPLETE 2026-08-26)

1. Prove staged `repair-fork --preview|--apply` against the committed fork
   fixture.
2. Add schema-first actual-shape probes, translation reports, assumptions,
   issues, severity, and drift classification.
3. Add fleet lint for duplicate slugs, dependency cycles, and unreachable
   references.
4. Add honest genesis seeding plus trace projection.
5. Expose deterministic fleet preview/apply commands.

## P2 — Fleet apply and verify (COMPLETE 2026-08-26)

The reviewed preview found 65 translations, 65 seeds, zero violations, and two
transitional warnings for known legacy targets. Apply migrated both targets,
and the post-apply preview reached zero translations, seeds, issues, and fleet
findings. Census: all 161 manifests including the template are v2; 66 goal
streams fold with fresh traces. Focused checks, package typecheck/lint, doctor,
index, explore check, and the full 2,328-test repo-cli suite pass.

## P3 — Implementation delivery (COMPLETE BY D27 RECOVERY 2026-08-30)

PR #855 merged the implementation at
`94c7966fa18c5482b6445b5f0ead558822ba866e`, and all 17 review threads were
resolved. Its final hosted wave did not establish the packet's strict
exact-head merge-readiness contract: Fallow Advisory Envelopes and Vercel were
red, and Greptile produced no score. D27 preserves that gap and authorizes the
separate recovery PR; P3 is terminal under that explicit exception, not by
retroactive reinterpretation of #855.

## P4 — Close (COMPLETE 2026-08-30)

The recovery PR repaired the public convention-preview runtime, proved a second
preview empty, added the Codex closeout reflection, marked this goal
`completed-retained`, and graduated the parent exploration for the candidate-6
wave. The recovery head itself is accepted only through the current exact-head
Yeet closeout contract.

## Current blockers

None. Candidates 2–5 remain gated re-entry work in the parent exploration and
are not owned by this closed goal.
