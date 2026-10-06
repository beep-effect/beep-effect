# Practice Mail Tagging — Sources & Provenance

- **Source exploration:** none — this goal was authored directly; build the
  corpus during the first research phase.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|

## 3. External research sources

## 4. In-repo capability references

| Capability | Path | What this packet uses |
| --- | --- | --- |
| Microsoft Graph driver | `packages/drivers/m365` (`goals/m365-driver`) | Read verbs today; message-category and master-category writes from workstream A. |
| Box driver | `packages/drivers/box` (`goals/box-driver`) | `uploads.uploadFile` for attachment filing. |
| Box tree reconciler | `packages/drivers/box-provisioning` (`goals/practice-box-provisioning`) | The provisioned client/matter tree; folder identities live in private adoptions. |
| Practice KG | `packages/law-practice/server` `PracticeKg.*` (`goals/practice-kg-mcp`) | Client-keyed docket families (D-11) as the matter identity; application, patent, and docket lookups. |
| Document intake | `goals/legal-document-intake` | Later vault-to-Box mirror; out of scope here. |
| PST backfill | `goals/practice-mail-backfill` | Explicitly out of scope. |

## 5. Cross-links & provenance

- Operator-ratified solo-practice decisions, 2026-10-06 (decisions 8d and 9,
  workstream B). The decision brief is orchestrator-local and not tracked.
