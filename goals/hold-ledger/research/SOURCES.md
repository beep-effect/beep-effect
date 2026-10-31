# Hold Ledger — Sources & Provenance

- **Source exploration:** `explorations/expiring-repo-facts` — primary ledger:
  [`explorations/expiring-repo-facts/research/SOURCES.md`](../../../explorations/expiring-repo-facts/research/SOURCES.md).
  The full cited report is
  [`research/prior-art-report-2026-10-22.md`](../../../explorations/expiring-repo-facts/research/prior-art-report-2026-10-22.md).

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|
| `hold-register` | Manual #1861 hold census | beep-effect | `goals/repository-simplification-residue/history/receipts/hold-register.md` | existing holds and exits | reference (migrate rows) |

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| none | — | — | — |

## 3. External research sources

See section 3 of the exploration's `research/SOURCES.md`. This goal adds no
new external sources at graduation.

## 4. In-repo capability references

- `makeClaimEnvelope` — `packages/foundation/modeling/epistemics/src/Claim/Claim.model.ts` (reuse)
- Research ledger laws — `research/README.md` (reuse the pattern)
- Repo CLI command groups — `packages/tooling/tool/cli/src/commands/` (extend: `Holds`)
- `syncpack.config.ts` held group, `osv-scanner.toml`, root `package.json` `deps:update`, `overrides` and `patchedDependencies` (consumers)
- `HoldProposition`, the ledger files and `beep holds` — NET-NEW

## 5. Cross-links & provenance

- Exploration: [`explorations/expiring-repo-facts`](../../../explorations/expiring-repo-facts/README.md)
  ([`BRIEF.md`](../../../explorations/expiring-repo-facts/BRIEF.md),
  [`DECISIONS.md`](../../../explorations/expiring-repo-facts/DECISIONS.md),
  [`MAP.md`](../../../explorations/expiring-repo-facts/MAP.md)).
- Sibling goal: [`goals/wake-service`](../../wake-service/README.md).
