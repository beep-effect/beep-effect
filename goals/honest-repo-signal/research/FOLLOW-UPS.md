# Follow-ups — deleted stubs still have owning goals

Deleting a VERSION-only workspace package is not cancelling the driver. The
research, specs, and product-pull gates stay in the packets below. Recreate
the package with `bun run beep create-package` (or `beep architecture`) in
the same PR that lands the first real surface.

`@beep/protobuf` is **not** listed. Another beep-effect clone is already
removing it. Do not touch that package in this packet.

Identity check (2026-08-13): `bun run topo-sort` slugs minus `@beep/root`
equal `$I.compose(...)` slugs. No other stale package IdentityComposers.
Removed a duplicate `"doc-text"` compose argument. Left `@beep/ui/Button`
alone — that is a JSDoc example of `$UiId.make("Button")`, not a workspace
package.

## Driver stubs this packet deletes

| Deleted package | Why it is empty today | Owning / resume packet | Resume trigger | Restart from |
| --- | --- | --- | --- | --- |
| `@beep/federal-register` | Delivery packet closed as won't-do-until-product-pull and **intentionally kept** an empty scaffold. This packet supersedes that keep. | [`goals/gov-legal-data-driver-delivery`](../../gov-legal-data-driver-delivery/README.md) P2 | A product feature pulls Federal Register | [`research/specs/federal-register-openapi.json`](../../gov-legal-data-driver-delivery/research/specs/federal-register-openapi.json) (14 ops, official) |
| `@beep/dol` | Same delivery deferral. Keyed driver. | [`goals/gov-legal-data-driver-delivery`](../../gov-legal-data-driver-delivery/README.md) P3 | A product feature pulls DOL | Delivery P0 matrix + DOL auth fact (`X-API-KEY` is a **query** param on dataportal.dol.gov) |
| `@beep/courtlistener` | Same delivery deferral (P4 core + P5 long tail). AGPL upstream: clean-room / official capture only. | [`goals/gov-legal-data-driver-delivery`](../../gov-legal-data-driver-delivery/README.md) P4–P5 | A product feature pulls CourtListener | [`research/specs/courtlistener/`](../../gov-legal-data-driver-delivery/research/specs/courtlistener/) and [`research/courtlistener-deltas.md`](../../gov-legal-data-driver-delivery/research/courtlistener-deltas.md) |

Related but **not** a reason to keep the empty driver:

- [`goals/court-reporter-vocabulary`](../../court-reporter-vocabulary/README.md)
  owns courts-db / reporters-db artifacts and identities. It is not the
  CourtListener HTTP driver. Do not recreate `@beep/courtlistener` from that
  packet unless a later decision joins them.
- [`goals/gov-legal-data-driver-codegen`](../../gov-legal-data-driver-codegen/README.md)
  is completed-retained substrate. Its P2 authed-driver phase is already
  superseded by the delivery packet. Do not reopen codegen to hold names.

## After this packet: how to recreate a reserved driver

The delivery packet's `GOAL.md` is recreate-first. It is not a license to
edit deleted driver directories — `@beep/federal-register`, `@beep/dol`,
and `@beep/courtlistener` trees are gone.

1. Confirm a product-slice consumer (use-cases or server), not a name claim.
2. `bun run beep create-package <name> --family drivers`.
3. Land schemas/service/tests in the same PR as the package. No VERSION-only
   merge.
4. Point the delivery packet's deferred phase at the new package path.

## Other follow-ups this packet will not execute

| Item | Owner | Why not tonight |
| --- | --- | --- |
| `beep goals bootstrap` (schema-compiled, template-free) | [`goals/knowledge-surface-automation`](../../knowledge-surface-automation/README.md) Workstream E | Specified, not implemented. Live CLI is still `doctor` / `index` / `set-status`. This packet used `goals/_template`. |
| CI main redness / fleet calm | [`goals/ci-fleet-endgame`](../../ci-fleet-endgame/README.md) | Active, mid-cutover. |
| UI coverage (`@beep/ui` 13.6%) | New packet if wanted | Not a one-night pass. |
| `@beep/graph-3d` 0% coverage | Existing graph packets | Not a stub; not tonight. |
| Git history filter-repo | None | Permanent history rewrite. Document policy only. |
| Context-rent telemetry | [`explorations/context-rent-telemetry`](../../../explorations/context-rent-telemetry/README.md) | Empirical AGENTS.md pruning. Separate from the router table. |
