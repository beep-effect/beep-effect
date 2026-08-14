# Provenance & Shared Claim Kernel

## Status

Lifecycle: `completed-retained`

Source: [`ops/manifest.json`](./ops/manifest.json)

## Mission

Make the `epistemic` boundary consumable by a second vertical (`law-practice`)
without breaking slice isolation. Route the cross-slice coupling to its correct
homes: domain-agnostic **substrate** → `foundation/modeling` (`@beep/schema`
`UnitInterval`, new `@beep/provenance` `TextAnchor`); minimum **product
vocabulary** → `shared/domain` (`ClaimLifecycle`); the **mechanism**
(gate/projection services + live Layers) stays in the `epistemic` slice. The net
result is a `law-practice-domain` that imports only `foundation` + shared-kernel.

## Read This First

1. [`GOAL.md`](./GOAL.md) — compact launcher.
2. [`SPEC.md`](./SPEC.md) — normative contract + locked decisions.
3. [`PLAN.md`](./PLAN.md) — execution record (F → S → D).
4. [`ops/manifest.json`](./ops/manifest.json) — machine routing.
5. [`history/`](./history/) — closeout reflection.

Provenance: the 2026-06-18 architecture grilling session that surfaced the
cross-slice collision while planning `goals/law-practice-office-action-spike`.
Doctrine recorded in
[`standards/architecture/DECISIONS.md`](../../standards/architecture/DECISIONS.md)
("2026-06-18: Cross-Slice Consumption Of The Epistemic Boundary").

Related research: [`explorations/project-intelligence/CAPTURE.md`](../../explorations/project-intelligence/CAPTURE.md)
preserves the authority-versus-projection findings from the superseded
project-intelligence loop.

## Current Phase

All phases complete and reviewed. `@beep/schema` `UnitInterval`,
`@beep/provenance` `TextAnchor`, the epistemic `EvidenceSpan` wrap, the
`@beep/shared-domain` `ClaimLifecycle` promotion + epistemic re-point, and the
doctrine record are all in place and green.

## Latest Evidence

`2026-06-18` — full `bun run check` green (87 build tasks + dtslint [107 files] +
Effect-LSP test-tsgo [325 files / 80 pkgs] + smoke lane); the 12 epistemic tests
pass after the `EvidenceSpan` wrap and the `ClaimLifecycle` re-point;
`config-sync:check` reports no drift. An adversarial review (3 dimensions, each
blocker independently refuted) confirmed the cross-slice routing is clean and
surfaced 3 P1 issues — all fixed (a tstyche type-test widened to the 4-state
union; the promotion record corrected to 1 current + 1 provisional-planned
consumer; the ADR `shared/*` wording tightened). Closeout reflection at
[`history/reflections/2026-06-18-claude.md`](./history/reflections/2026-06-18-claude.md)
passes `bun run beep lint reflection-artifacts` (blocking_findings=0).

## Notes

- `repo-exports:catalog` is intentionally **not** a gate here (being removed by
  PR #254); `config-sync` remains the active managed-artifact gate.
- The consumer (`goals/law-practice-office-action-spike`) builds on this surface
  and owns the bounded use-cases composition exception.
