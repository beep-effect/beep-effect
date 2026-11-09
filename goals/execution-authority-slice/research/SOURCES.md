# Execution Authority Slice — Sources & Provenance

- **Source exploration:** `explorations/execution-authority-home` — primary ledger:
  [explorations/execution-authority-home/research/SOURCES.md](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/explorations/execution-authority-home/research/SOURCES.md).

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|

## 3. External research sources

| Source | URL | Disposition |
| --- | --- | --- |
| Fowler, "Bounded Context" (bliki) | https://martinfowler.com/bliki/BoundedContext.html | reference: one unified model per bounded context; context maps relate models |
| Microsoft Azure Architecture Center, "Use Domain Analysis to Model Microservices" | https://learn.microsoft.com/en-us/azure/architecture/microservices/model/domain-analysis | reference: core/supporting/generic subdomains; context-map relationship patterns (Open Host Service / Published Language ≈ foundation port inversion) |
| Crosby & Wallach, "Efficient Data Structures for Tamper-Evident Logging", USENIX Security 2009 | https://www.usenix.org/legacy/event/sec09/tech/full_papers/crosby.pdf | reference: logger/client/auditor separation; linear hash-chain proof cost versus tree proofs |
| RFC 6962 Certificate Transparency §2.1 | https://datatracker.ietf.org/doc/html/rfc6962 | reference: domain-separation prefixes are part of the hash contract (frames the `epistemic-*/v1` prefixes) |

Deep-research report (2026-11-07), primary copy in the exploration:
[`research/provenance-placement-ddd.md`](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/explorations/execution-authority-home/research/provenance-placement-ddd.md).
It cites Evans's DDD Reference, Young's CQRS Documents, Fowler's Audit Log and
Temporal Property, W3C PROV-DM and PROV-AQ, PaperTrail, django-auditlog,
Hibernate Envers, supa_audit, pgaudit, Heap and GitLab on jsonb, Marten,
Kurrent, OpenLineage, DataHub, OPA, CloudTrail, Google Cloud Audit Logs, the
Entra PCI DSS Requirement 10 page, AuthZed, OWASP, Crosby & Wallach, RFC 9162,
SQL Server ledger, the MCP tools spec, OpenTelemetry GenAI, the Claude Agent SDK
hooks docs, and arXiv 2609.30266 and 2607.05518. The URLs are in the report.


## 4. In-repo capability references

| Brick | Path | Disposition |
| --- | --- | --- |
| Execution values | `packages/epistemic/domain/src/values/{ExecutionGrant,GrantSet,ExecutionVerdict,ExecutionRecord}/` | move candidate (subject of the exploration) |
| Canonical JSON alias | `packages/epistemic/domain/src/values/internal/CanonicalJson.ts` → `@beep/epistemics/ContradictionDetection` `canonicalDetectionJson` (`packages/foundation/modeling/epistemics`) | coupling seam; hash-critical, must stay byte-identical |
| Ledger port + errors | `packages/epistemic/use-cases/src/ExecutionLedger/` | move candidate |
| Ledger adapter, tier gate, egress | `packages/epistemic/server/src/{ExecutionLedger,GovernedTierGate,GovernedEgress}/` | move candidate |
| Epistemic aggregate layer | `packages/epistemic/server/src/Layer.ts` (`EpistemicServerDrizzleLive`) | coupling seam; changes on split |
| Ledger tables | `packages/epistemic/tables/src/values/ExecutionRecord/`; aggregate `packages/epistemic/tables/src/Schema.ts` | move candidate; physical names are an open question |
| Config package | `packages/epistemic/config/` | move/retire candidate |
| Baseline SQL | `packages/_internal/db-admin/drizzle/20260813130540_baseline/migration.sql:290-313`, `20260813143745_baseline-functions/migration.sql:48-97` | persisted contract (constraints, triggers) |
| db-admin target + schema aggregator | `packages/_internal/db-admin/src/migrations/EpistemicExecutionLedger.ts`, `src/schema.ts`, `src/targets.ts`, `test/integration/EpistemicExecutionLedgerMigration.pglite.test.ts` | repoint on move |
| db-admin authoring rules | `packages/_internal/db-admin/AGENTS.md` | constraint (drizzle-kit, re-baseline history, splitter limits) |
| Desktop legacy migration names | `apps/professional-desktop/src/runtime/Migrations.ts:29-50` | precedent (journal rename via `MigrationBundleLegacyNameSet`) |
| Governed MCP binding site | `apps/professional-desktop/server/OntologyMcpTransport.ts`, `apps/professional-desktop/server/main.ts` | consumer; binding stays at the app |
| Desktop integration tests | `apps/professional-desktop/test/integration/{execution-authority.pglite,ontology-mcp-http,contradiction-qa-seed.pglite}.test.ts`, `support/ontology-mcp-harness.ts` | consumer; repoint |
| `TierGate` port | `packages/foundation/capability/mcp-kit` (README:30-37 coupling record) | reuse; README record must be updated |
| `EgressDenied` | `packages/foundation/capability/api-transport` (README:37) | reuse; README record must be updated |
| Agents slice | `packages/agents/{domain,use-cases,server,tables,client}` | candidate home (no MCP/authority today) |
| Shared kernel | `packages/shared/*`, `standards/architecture/02-shared-kernel.md` | candidate home; gate evidence against adapters |
| Tooling law pin | `packages/tooling/tool/cli/src/commands/Laws/FrozenGrantSet.ts:33`, `test/frozen-grant-set.test.ts` | repoint on move |
| CI/coverage pins | `packages/tooling/tool/cli/src/commands/Ci/CiLanePartitions.ts:350,584`, `.../Quality/internal/CoverageScope.ts:200`, `test/ci-coverage.test.ts:1263-1264` | repoint on move |
| Identity composers | `packages/foundation/modeling/identity/src/packages.ts` (`$EpistemicConfigId`, `$Agents*Id`) | regenerated by `create-package` |
| Env keys | `turbo.json:53-54`, `.env.example:92-94` | operator contract; separate decision |
| Schema identifier fixture | `packages/epistemic/domain/test/ValueSchemaIdentifiers.test.ts`, `test/fixtures/value-schema-identifiers.txt` | evidence: no execution identifiers are pinned |
| Package scaffolding | `bun run beep create-package --help`, `bun run beep architecture {create slice,create package,add concept,add role} --help` | required tooling for a new slice or role |
| Doctrine | `standards/architecture/01-hexagonal-vertical-slices.md`, `06-configuration-boundaries.md`, `10-cross-slice-coordination.md`, `11-evolution-and-deprecation.md`, `GLOSSARY.md:585` | constraints |


## 5. Cross-links & provenance

- Graduated from `explorations/execution-authority-home` on 2026-11-07; the exploration's ledger is primary and this file reproduces its corpus.
- Exploration manifest `links.goals` lists `goals/execution-authority-slice`; this manifest's `provenance.exploration` points back.
