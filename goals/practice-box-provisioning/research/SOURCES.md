# Practice Box Provisioning — Sources & Provenance

- **Source exploration:** `explorations/practice-office-provisioning` —
  primary ledger:
  [`explorations/practice-office-provisioning/research/SOURCES.md`](../../../explorations/practice-office-provisioning/research/SOURCES.md)
  (with the per-lane URL registry in
  [`SOURCES-lane-citations.md`](../../../explorations/practice-office-provisioning/research/SOURCES-lane-citations.md)).
  This file reproduces the implementation-relevant slice; the exploration's
  ledger stays canonical.
- **Provenance:** five research lanes + live tenant probes + the
  operator-run Sol Pro gap report, all 2026-08-30.

## 1. Mined source corpus

No upstream code is mined or ported. Patterns come from in-repo bricks (§4)
and vendor documentation (§3).

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| `box-node-sdk` (installed dependency) | Apache-2.0 | use as a dependency; wrap via the driver's canonical generator | the provisioning managers (collaborations, webhooks, sign requests/templates, metadata/retention reads) |

## 3. External research sources

Carried by the exploration lane reports (each with its own Sources section on
disk):

- [`r4-provisioning-code-shape.md`](../../../explorations/practice-office-provisioning/research/r4-provisioning-code-shape.md)
  — driver gap tables with `file:line` evidence, desired-state schema
  sketch, per-resource idempotency rules, Pulumi rejection analysis, and the
  Box/Graph/Pulumi primary URLs.
- [`r1-box-legal-dms.md`](../../../explorations/practice-office-provisioning/research/r1-box-legal-dms.md)
  — matter-centric taxonomy patterns, plan-gate analysis, starter taxonomy
  sketch, upgrade-trigger table.
- [`r7-sol-pro-gap-report.md`](../../../explorations/practice-office-provisioning/research/r7-sol-pro-gap-report.md)
  — §B plan matrix (watermarking correction, collaborator economics),
  §F identity-topology cautions and Sign request ownership.

P2 pre-apply lanes (2026-09-02), delegated per the routing doctrine and kept
in this packet with tenant ids, names, and principals excluded:

- [`2026-09-02-preapply-review-codex.md`](./2026-09-02-preapply-review-codex.md)
  — Codex (GPT-5.6 Sol, xhigh) static adversarial review of the reconciler,
  driver errors, and private runner before the first attended apply:
  one P0 (silent exact-name adoption), seven P1, three P2, the 33-mutation
  apply sequence, digest inclusions, and an unverified-assumption list.
- [`2026-09-02-box-api-semantics-grok.md`](./2026-09-02-box-api-semantics-grok.md)
  — Grok 4.6 (xhigh) verification of the Box REST semantics the apply
  depends on against developer.box.com and support.box.com: case-insensitive
  sibling names, forbidden name characters, pending-collaboration shape,
  `user_already_collaborator`, webhook limits, service-account identity, and
  why a root-folder metadata 403 is not a Governance signal.

## 4. In-repo capability references

| Brick | Path | Mark |
|-------|------|------|
| Demand-scoped Box generator + type budget | `packages/drivers/box/scripts/box.surface.ts`, `packages/drivers/box/README.md` | extend (add managers to the demand manifest; regenerate + remeasure) |
| Generated operations contract | `packages/drivers/box/src/_generated/Box.operations.gen.ts` | extend (folder CRUD present; provisioning families absent) |
| Service composition + developer-token/CCG layers | `packages/drivers/box/src/Box.service.ts` | reuse |
| SDK version trace constant (drifted) | `packages/drivers/box/src/internal/Box.constants.ts` | repair |
| `@beep/m365` reads (contact-intent inventory side) | `packages/drivers/m365` | reuse |
| Schema-first substrate (`LiteralKit`, tagged unions, `S.Redacted`) | `packages/foundation/modeling/schema` (`@beep/schema`) | reuse |
| Reconciler package home | confirmed at P0 with `bun run beep architecture`; scaffolded with `bun run beep create-package` | NET-NEW |

## 5. Cross-links & provenance

- Exploration: [`explorations/practice-office-provisioning`](../../../explorations/practice-office-provisioning/README.md)
  — `DECISIONS.md` (binding), `BRIEF.md` (sketch point 1),
  `MAP.md` (sequencing, first vertical slice, risks).
- Sibling goals: [`goals/practice-m365-contacts`](../../practice-m365-contacts/README.md),
  [`goals/practice-mail-backfill`](../../practice-mail-backfill/README.md),
  [`goals/freshbooks-driver`](../../freshbooks-driver/README.md).
- Gated dependents (exploration `MAP.md`): `practice-sign-invoice-flow` and
  `practice-walkthroughs` both gate on this goal's live tree.
- Related packets: `goals/box-driver` (the original generated surface),
  `goals/box-typecheck-cost` (the type-budget regime this goal must respect).
