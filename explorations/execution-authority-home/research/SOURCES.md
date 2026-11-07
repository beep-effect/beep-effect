# Execution Authority Home — Sources & Provenance

<!--
Provenance ledger for this packet. Started in the research stage (2026-11-06).
Never fabricate a URL; every external URL below appears in ../RESEARCH.md and
was fetched on 2026-11-06.
-->

- **Cluster / origin:** the operator grilling session on party/epistemic
  ownership (PR #2829), recorded in `CAPTURE.md`, plus the 2026-11-06 research
  sweep of `packages/epistemic/*`, its consumers, db-admin, the doctrine docs and
  the `agent-execution-authority` goal packet.
- **Provenance:** `../RESEARCH.md` §"2026-11-06". No codex review yet.

## 1. Mined source corpus

Not applicable. The exploration mines no external corpus, only in-repo code
(§4).

## 2. Upstream repositories & licenses

Not applicable. No upstream code is ported. The external sources in §3 are
read for patterns only.

## 3. External research sources

| Source | URL | Disposition |
| --- | --- | --- |
| Fowler, "Bounded Context" (bliki) | https://martinfowler.com/bliki/BoundedContext.html | reference: one unified model per bounded context; context maps relate models |
| Microsoft Azure Architecture Center, "Use Domain Analysis to Model Microservices" | https://learn.microsoft.com/en-us/azure/architecture/microservices/model/domain-analysis | reference: core/supporting/generic subdomains; context-map relationship patterns (Open Host Service / Published Language ≈ foundation port inversion) |
| Crosby & Wallach, "Efficient Data Structures for Tamper-Evident Logging", USENIX Security 2009 | https://www.usenix.org/legacy/event/sec09/tech/full_papers/crosby.pdf | reference: logger/client/auditor separation; linear hash-chain proof cost versus tree proofs |
| RFC 6962 Certificate Transparency §2.1 | https://datatracker.ietf.org/doc/html/rfc6962 | reference: domain-separation prefixes are part of the hash contract (frames the `epistemic-*/v1` prefixes) |

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

- Decision being executed: `standards/architecture/DECISIONS.md` "2026-10-21:
  Epistemic Vocabulary Is Foundation; Party Is A Product Slice; Propositions Are
  Slice-Owned" (execution values recorded as misfiled).
- Port-inversion doctrine: `standards/architecture/DECISIONS.md` "2026-07-25:
  Foundation-Mediated Port Inversion Is A Legal Cross-Slice Mechanism".
- Originating goal: `goals/agent-execution-authority/` (SPEC decisions 6, 7, 11;
  Exception Ledger; reflection `history/reflections/2026-07-28-claude.md`).
- Sibling goal that excluded these values: `goals/epistemics-foundation-extraction/SPEC.md:16,60,196`.
- Deferred follow-on: the epistemic-slice direction grill (A: claim store versus
  B: split into infrastructure), per `CAPTURE.md`.
- This packet: `../RESEARCH.md`, `../DECISIONS.md` (align stage, not yet
  started).
