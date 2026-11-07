# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## 2026-11-06

Scope: where agent execution authority (`ExecutionGrant`, `GrantSet`,
`ExecutionRecord`, `ExecutionVerdict`, `ExecutionLedger`, `GovernedTierGate`,
`GovernedEgress`, `@beep/epistemic-config`) should live, and what a move costs.
This section is inventory and constraints only. It does not recommend a home.
All paths are relative to the repo root; "NOT FOUND" means a targeted `rg`/`ls`
returned nothing.

### External Landscape

- **Bounded contexts own their model; integration goes through a context map.**
  Fowler: "DDD divides up a large system into Bounded Contexts, each of which
  can have a unified model" — https://martinfowler.com/bliki/BoundedContext.html.
  Microsoft's domain-analysis guide frames the same split as core, supporting
  and generic subdomains and lists the context-map relationships
  (Customer-Supplier, Open Host Service / Published Language, Anti-corruption
  Layer, Separate Ways) —
  https://learn.microsoft.com/en-us/azure/architecture/microservices/model/domain-analysis.
  Fit: the repo's foundation-mediated port inversion (an implementer slice
  behind a foundation `TierGate` port, bound at the app) is an Open Host
  Service / Published Language shape where the published language is
  `@beep/mcp-kit`. Neither source says authorization has to sit inside the
  context it guards. They do say a model should live in the one context whose
  language it speaks.
- **Tamper-evident logs separate the logger from the clients and auditors.**
  Crosby & Wallach, "Efficient Data Structures for Tamper-Evident Logging"
  (USENIX Security 2009) models an untrusted logger serving many clients and
  kept honest by auditors who challenge it to prove that events are still
  present and that the log is consistent with earlier views —
  https://www.usenix.org/legacy/event/sec09/tech/full_papers/crosby.pdf. They
  also measure where a classic hash chain stops scaling: proving one event's
  presence among 80 M events takes an 800 MB trace with a chain and a 3 KB
  proof with their tree. Fit: the ledger's role (one writer, many verifiers,
  `verifyExecutionDecisionChain` as the auditor) is its own concern and is not
  owned by the clients whose actions it records. The repo ledger is a linear
  per-run chain, so its proofs grow linearly with the run.
- **Domain-separation prefixes are part of the hash contract.** RFC 6962 §2.1
  hashes leaves as `SHA-256(0x00 || d)` and interior nodes as
  `SHA-256(0x01 || left || right)`: "This domain separation is required to
  give second preimage resistance" —
  https://datatracker.ietf.org/doc/html/rfc6962. Fit: the repo ledger
  prefixes its hash input with the version strings
  `epistemic-execution-decision/v1`, `epistemic-execution-outcome/v1` and
  `epistemic-grant-set/v1` (see §3). Those strings carry the slice name, so
  renaming them changes every hash.

### In-Repo Capability Inventory

#### 1. Execution-authority surface inside `packages/epistemic/*`

Every package is `private: true` (`packages/epistemic/*/package.json`).

| Package | Execution files (src) | Exported symbols (main) | Subpath |
| --- | --- | --- | --- |
| `@beep/epistemic-domain` | `src/values/ExecutionGrant/ExecutionGrant.model.ts` (449 lines) + `index.ts` | `SinkClass`, `SinkAudience`, `SinkDestination`, `ExecutionSink`, `GrantPurpose`, `GrantResource`, `GrantOperation`, `PolicyRevision`, `GrantBudget`, `ExecutionGrant` | `./values/ExecutionGrant` |
| | `src/values/GrantSet/GrantSet.model.ts` (550), `GrantSet.errors.ts` (71), `index.ts` | `GrantSetDigest`, `DraftGrantSet`, `FrozenGrantSet`, `GrantSet`, `emptyDraftGrantSet`, `addGrant`, `GrantSetDigestInput`, `freezeGrantSet`, `verifyFrozenGrantSetDigest`, `ExecutionRequestEvaluationOptions`, `evaluateExecutionRequest`, `GrantRevisionMismatch` | `./values/GrantSet` |
| | `src/values/ExecutionVerdict/ExecutionVerdict.model.ts` (314) + `index.ts` | `DenialReason`, `evaluatorDenialReasons`, `boundaryDenialReasons`, `denialGuidance`, `ExecutionRequest`, `ExecutionVerdict`, `EgressClassification`, `ungovernedInfrastructureDestinations` | `./values/ExecutionVerdict` |
| | `src/values/ExecutionRecord/ExecutionRecord.model.ts` (867) + `index.ts` | `ExecutionRunKey`, `DecisionRecordHash`, `OutcomeRecordHash`, `SinkDestinationDigest`, `GrantOperationDigest`, `ExecutionSettlement`, `ExecutionDecisionRecord`, `ExecutionOutcomeRecord`, `sealExecutionDecision`, `verifyExecutionDecisionHash`, `ChainVerification`, `verifyExecutionDecisionChain`, `verifyOutcomeBinding`, `sealExecutionOutcome`, `verifyExecutionOutcomeHash`, `digestForLedger`, `operationDigestOf`, `destinationDigestOf` | `./values/ExecutionRecord` |
| `@beep/epistemic-use-cases` | `src/ExecutionLedger/ExecutionLedger.ports.ts` (114), `.errors.ts` (225), `index.ts` | `ExecutionLedger` port (`appendDecision`, `appendOutcome`, `readDecisions`, `readOutcomes`, `readUnsettledAllowed`), `ExecutionLedgerError`, `ExecutionLedgerUnavailable`, `ExecutionLedgerConstraintViolation`, `ExecutionLedgerOperation` | `./ExecutionLedger`; also `ExecutionLedger` namespace from `./server` (`src/server.ts:129`) |
| `@beep/epistemic-server` | `src/ExecutionLedger/{ExecutionLedger.repo.ts,ExecutionLedger.layer.ts,index.ts}` | `makeDrizzleExecutionLedger`, `ExecutionLedgerDrizzle` | `./ExecutionLedger` |
| | `src/GovernedTierGate/{GovernedTierGate.gate.ts (528), .layer.ts, index.ts}` | `makeGovernedTierGate`, `GovernedTierGateOptions`, `GovernedTierGateLive` (implements `@beep/mcp-kit` `TierGate`) | `./GovernedTierGate` |
| | `src/GovernedEgress/{GovernedEgress.fetch.ts (416), .layer.ts, index.ts}` | `makeGovernedEgressFetch`, `GovernedEgressOptions`, `GovernedEgressLive` (uses `@beep/api-transport` `EgressDenied`) | `./GovernedEgress` |
| `@beep/epistemic-tables` | `src/values/ExecutionRecord/{ExecutionRecord.table.ts,.converters.ts,.errors.ts,index.ts}`, `src/values/index.ts` | `EXECUTION_DECISION_TABLE_NAME`, `EXECUTION_OUTCOME_TABLE_NAME`, `executionDecisionTable`, `executionOutcomeTable`, converters, errors | `./values`, `./values/ExecutionRecord` |
| `@beep/epistemic-config` | all of `src/` (`ServerConfig.ts`, `Audience.ts`, `layer.ts`, `TestLayer.ts`, `server.ts`, `test.ts`, `public.ts` = `export {}`, `secrets.ts` = `export {}`, `index.ts`) | see §5 | whole package |

Tests that are wholly execution: `domain/test/ExecutionAuthority.test.ts`,
`use-cases/test/ExecutionLedger.test.ts`, `server/test/GovernedEgress.test.ts`,
`server/test/GovernedTierGate.test.ts`,
`server/test/integration/ExecutionLedger.pglite.test.ts`,
`server/test/integration/GovernedTierGate.pglite.test.ts`,
`tables/test/ExecutionRecordTables.test.ts`, `config/test/Config.test.ts`.

**Genuinely epistemic** (no execution code): every `entities/*` module
(Activity, CandidateClaim, ClaimDisposition, Contradiction, EdgeVersion,
Evidence, EvidenceVerification, UsageRecord), the claim/contradiction/edge/
retention values and use cases, ClaimGate, ContradictionTriage, EdgeAuthority,
Retention, ShaclValidation, and the client and ui packages.

**Coupling (the split seams).** No execution module imports claim, edge,
contradiction or retention code. The direction is one-way, and every shared
point is either a helper or an aggregator:

- `domain/src/values/internal/CanonicalJson.ts` is a one-line alias,
  `canonicalJson = canonicalDetectionJson` from
  `@beep/epistemics/ContradictionDetection`
  (`packages/foundation/modeling/epistemics`). It is used by
  `GrantSet.model.ts:36` and `ExecutionRecord.model.ts:36`, which both
  **hash** through it, and by `Retention/Retention.behavior.ts:12`. So the
  ledger's hash canonicalization depends on a contradiction-detection helper
  in the foundation epistemics package.
- Barrels: `domain/src/values/index.ts:115-179` and the root
  `domain/src/index.ts:37` re-export every execution symbol, so
  `import { FrozenGrantSet } from "@beep/epistemic-domain"` resolves (the
  tooling law test relies on it, `packages/tooling/tool/cli/test/frozen-grant-set.test.ts:169`).
  `use-cases/src/server.ts:115-129` re-exports `ExecutionLedger`.
  `server/src/index.ts:31-50` re-exports ExecutionLedger, GovernedEgress and
  GovernedTierGate.
- Composition: `server/src/Layer.ts` `EpistemicServerDrizzleLive` merges
  `ExecutionLedgerDrizzle` into the epistemic Drizzle layer, and its output type
  includes `ExecutionLedger`. The in-memory `EpistemicServerLive` does not.
- Tables aggregate: `tables/src/Schema.ts:17,28-29,58-59` puts
  `executionDecision` and `executionOutcome` into the epistemic `DbSchema`.
  `ExecutionLedger.repo.ts:18,38` reads the tables through that aggregate
  (`DbSchema.executionDecision`) instead of the concept subpath.
- Internal helpers: `use-cases/src/internal/OptionalDefect.ts` is shared by
  `ExecutionLedger.errors.ts:20` and the EdgeAuthority/ClaimDisposition/
  ContradictionTriage modules.
- Mixed test files: `domain/test/TaggedError.equivalence.test.ts`
  (`GrantRevisionMismatch` beside `ClaimInvalidTransition`),
  `use-cases/test/TaggedError.equivalence.test.ts:10-12,112-115`, and
  `server/test/EpistemicRepositoryDriverFailure.pglite.test.ts:11-18,65`
  (execution-ledger read redaction beside other repositories).

Execution code's own dependencies: `@beep/identity`, `@beep/schema`,
`@beep/utils`, `@beep/shared-domain/entity/Principal` (`Principal`,
`SystemPrincipal`), `@noble/hashes`, `@beep/epistemics` (via CanonicalJson),
`@beep/mcp-kit` and `@beep/api-transport` (foundation/capability), and
`@beep/postgres` plus `drizzle-orm` (server adapter).

#### 2. Consumers outside `packages/epistemic`

Direct imports of the execution surface (TS source and tests):

| File | Symbol / subpath |
| --- | --- |
| `apps/professional-desktop/server/main.ts:32-33,105-106` | `EpistemicConfigLive` (`/layer`), `ExecutionLedgerDrizzle` (`server/ExecutionLedger`) |
| `apps/professional-desktop/server/OntologyMcpTransport.ts:8-17,206,240,255,284` | `EpistemicConfig` (`config/server`); `ExecutionSink`, `GrantOperation`, `GrantPurpose`, `GrantResource`, `SinkDestination` (`domain/values/ExecutionGrant`); `GovernedEgressLive`/`Options`; `GovernedTierGateLive`/`Options` |
| `apps/professional-desktop/test/integration/execution-authority.pglite.test.ts:1-12,50,79,175` | config `/server` + `/test`, `ExecutionGrant`, `ExecutionRecord`, `ExecutionLedgerDrizzle`, `ExecutionLedger` |
| `apps/professional-desktop/test/integration/ontology-mcp-http.test.ts:1-4,49,380` | config `/server` + `/test`, `verifyExecutionDecisionChain`, `verifyOutcomeBinding`, `ExecutionLedger`, `ExecutionLedgerUnavailable` |
| `apps/professional-desktop/test/integration/support/ontology-mcp-harness.ts:1-2,35-36,59,125` | `EpistemicConfigTest`, `EpistemicConfig`, `ExecutionLedger`, record types |
| `packages/_internal/db-admin/src/migrations/EpistemicExecutionLedger.ts:9-48` | `DbSchema` (root) + `EXECUTION_*_TABLE_NAME` (`tables/values/ExecutionRecord`) |

Indirect consumers, through epistemic aggregates:
`apps/professional-desktop/src/runtime/Layer.ts:49,109` and
`apps/professional-desktop/test/integration/contradiction-qa-seed.pglite.test.ts:3,65`
get `ExecutionLedger` from `EpistemicServerDrizzleLive`.
`packages/_internal/db-admin/src/schema.ts` re-exports
`epistemicExecutionDecisionTable` and `epistemicExecutionOutcomeTable` from
`EpistemicDbSchema`, and `src/targets.ts:13,31,60` registers
`EpistemicExecutionLedgerMigrationTarget`.

Name and path pins in tooling and config:

- `packages/tooling/tool/cli/src/commands/Laws/FrozenGrantSet.ts:33`
  hard-codes `FROZEN_GRANT_SET_DEFINING_MODULE = "packages/epistemic/domain/src/values/GrantSet/GrantSet.model.ts"`.
  Its test `packages/tooling/tool/cli/test/frozen-grant-set.test.ts:99,169`
  pins the same path and the root import.
- `packages/tooling/tool/cli/src/commands/Ci/CiLanePartitions.ts:350,584`
  (`@beep/epistemic-config`), `.../Quality/internal/CoverageScope.ts:200`
  (`"@beep/epistemic-config": 13` coverage floor), and
  `packages/tooling/tool/cli/test/ci-coverage.test.ts:1263-1264` (fixture test
  names under `@beep/epistemic-server`).
- `packages/foundation/modeling/identity/src/packages.ts:2385-2399`
  (`$EpistemicConfigId`), the generated `tsconfig.json:1353-1452` paths and
  `vitest.aliases.generated.json:1220-1307`, `bun.lock`, and
  `standards/cache-qualification-baseline.json:410,34187-34712,...` (task
  identities for `@beep/epistemic-config`).
- Env keys `EPISTEMIC_EGRESS_DESTINATION_ALLOWLIST` and
  `EPISTEMIC_POLICY_REVISION`: `turbo.json:53-54`, `.env.example:92-94`.
- Doctrine records that name `epistemic/server` as the implementer:
  `packages/foundation/capability/mcp-kit/README.md:30,33-37` (the port-inversion
  README record), `packages/foundation/capability/api-transport/README.md:37`,
  and `standards/architecture/DECISIONS.md` "2026-07-25: Foundation-Mediated
  Port Inversion".

**law-practice: 0 execution consumers (the capture's "5 sites" is NOT FOUND).**
`rg "Execution(Record|Grant|Verdict|Ledger)|GrantSet" packages/law-practice`
returns one hit, a JSDoc comment
(`packages/law-practice/server/src/PracticeKg.projections.ts:241`, "ExecutionRecord.table.ts
precedent"). law-practice's five `@beep/epistemic-domain` imports are
`CandidateClaim` and `Evidence`
(`use-cases/src/internal/claimEvidence.ts:14`, `ClaimSelfCheck.schemas.ts:9`,
`OfficeActionReview.service.ts:17`, `OfficeActionReview.ports.ts:13`,
`server/src/PracticeKg.claims.ts:9-10`), which are epistemic, not execution.
It uses `EpistemicServerLive` (`law-practice/server/src/Layer.ts:18`), the
variant that has no ledger. ontology, agents and party: 0 execution imports.

Count: 6 files import the execution subpaths directly (5 in the desktop app,
1 in db-admin). 4 more reach the ledger through aggregates (desktop
`Layer.ts`, the qa-seed test, db-admin `schema.ts` and `targets.ts`). 5 tooling
files pin names or paths. Beyond that come generated config, env, identity and
README records.

#### 3. Persistence

**Tables** (`packages/epistemic/tables/src/values/ExecutionRecord/ExecutionRecord.table.ts:45-137`;
SQL `packages/_internal/db-admin/drizzle/20260813130540_baseline/migration.sql:290-313`):

- `epistemic_execution_decision`: `run_key text`, `seq integer`,
  `prev_hash text NULL`, `hash text`, `verdict text`, `reason text NULL`,
  `operation_digest text`, `sink_class text`, `audience text`,
  `destination_digest text`, `grant_set_digest text`, `policy_revision text`,
  `decided_at bigint`. All are `NOT NULL` except the two marked `NULL`.
- `epistemic_execution_outcome`: `run_key text`, `decision_hash text PRIMARY KEY`,
  `decision_verdict text DEFAULT 'allowed'`, `settlement text`,
  `recorded_at bigint`, `hash text`.
- Constraints, all hand-written in
  `drizzle/20260813143745_baseline-functions/migration.sql:48-97`:
  `epistemic_execution_decision_pk (run_key, seq)`, `_hash_unique`,
  `_run_hash_unique`, `_hash_verdict_unique`, CHECKs `_seq_nonnegative`,
  `_genesis_prev`, `_verdict_bounded`, `_reason_iff_denied`,
  `_reason_bounded`, `_sink_class_bounded`, `_audience_bounded`. The outcome
  table drops `_pkey`, then adds `_pk`, `_decision_fk`,
  `_decision_verdict_fk`, `_settles_allowed`, `_hash_unique` and
  `_settlement_bounded`. The function
  `epistemic_execution_ledger_block_mutation()` and four triggers
  (`*_append_only` BEFORE UPDATE OR DELETE, `*_block_truncate` BEFORE TRUNCATE)
  enforce append-only. No secondary indexes beyond the PK and unique
  constraints. The SPEC Exception Ledger
  (`goals/agent-execution-authority/SPEC.md:348`) records that these guards
  are hand-written SQL because `EntitySchema.persist` has no CHECK or trigger
  vocabulary.
- Later migrations (`20260814001821_*`, `20261009202131_audit_soft_delete`,
  `20261021041032_row_version_default`) do not touch these tables.
- The physical names are hard-coded outside the tables package in
  `ExecutionLedger.errors.ts` JSDoc (3), `use-cases/test/ExecutionLedger.test.ts`
  (3), `use-cases/test/TaggedError.equivalence.test.ts` (3),
  `server/test/integration/ExecutionLedger.pglite.test.ts` (27),
  `server/test/integration/GovernedTierGate.pglite.test.ts` (4, raw SQL incl.
  `DROP TABLE`), `apps/professional-desktop/test/integration/execution-authority.pglite.test.ts`
  (23), `db-admin/test/integration/EpistemicExecutionLedgerMigration.pglite.test.ts`
  (23, the exact constraint/trigger name list), and generated
  `apps/professional-desktop/src/runtime/Migrations.gen.ts` (35).
  `ExecutionLedgerConstraintViolation.constraintName` carries the Postgres
  constraint name as data (`ExecutionLedger.repo.ts:44-55`), so a rename
  changes values tests assert.

**Hash chain: no dependence on table names, column names, schema identifiers or
`$I` strings.** It does depend on literal domain-separation strings that
contain the slice name:

- `ExecutionRecord.model.ts:45-46`: `decisionEncodingVersion = "epistemic-execution-decision/v1"`,
  `outcomeEncodingVersion = "epistemic-execution-outcome/v1"`;
  `:456-457` `digestOf = sha256(utf8(`${version}\n${canonical}`))`.
- Decision input is a hand-written projection (`:486-501`) of field *values*
  keyed by camelCase property names (`audience`, `decidedAt` as epoch ms,
  `destinationDigest`, `grantSetDigest`, `operationDigest`, `policyRevision`,
  `prevHash`, `runKey`, `seq`, `sinkClass`, `verdict`, optional `reason`).
  Outcome input is `:734-738`. Column names do not appear. The comment says the
  projection is kept manual "so the hash input must be stable independent of
  schema plumbing".
- `GrantSet.model.ts:46` `grantSetEncodingVersion = "epistemic-grant-set/v1"`;
  `:336-340` hashes the schema-encoded `GrantSetDigestInput`. The encoded form
  holds data only, no annotations. `grant_set_digest` is persisted per decision.
- Canonicalization is `canonicalDetectionJson` from `@beep/epistemics`
  (above). Any move must keep that function or a byte-identical replacement.
- Consequence: moving files, renaming packages, changing `$I` composers or
  renaming tables leaves every stored hash valid **provided the three version
  strings and the canonical JSON function are unchanged**. Renaming a version
  string (say to `agents-execution-decision/v1`) changes all new hashes. A
  verifier would then need both prefixes, or old chains fail
  `verifyExecutionDecisionChain`.

**db-admin composition.** `packages/_internal/db-admin/src/schema.ts` imports
each slice's `DbSchema` (architecture-lab, documents, epistemic, law-practice,
workspace) and re-exports every table flat, because drizzle-kit scans one
level deep (`db-admin/AGENTS.md:5-14`). `drizzle.config.ts` points
`schema: "./src/schema.ts"`. `src/migrations/EpistemicExecutionLedger.ts:39-48`
is a `DbAdminMigrationTarget` (`name: "epistemic-execution-ledger"`,
`schemaName: "epistemic"`, both tables). The tables themselves live in
Postgres's default schema, not a schema named `epistemic`. The
`@beep/agents-tables` `ProviderInstance` table is **not** composed into db-admin
(`rg agents packages/_internal/db-admin/src` is empty). Moving the tables to
agents would make agents a db-admin participant for the first time.

**Rename precedent: NOT FOUND for tables.** No `ALTER TABLE … RENAME` or
`SET SCHEMA` exists in any drizzle folder. `goals/` and `standards/` have no
table-rename record. The closest precedents are:

- The 2026-08-13 re-baseline: "history was wiped and re-baselined 2026-08-13
  with zero users" (`db-admin/AGENTS.md:5-6`). The pre-baseline
  `20260726210000_epistemic_execution_ledger` migration was folded into the
  baseline. Installed desktops stay migratable because
  `apps/professional-desktop/src/runtime/Migrations.ts:29-50` maps 14 legacy
  journal names (including `20260726210000_epistemic_execution_ledger`) to
  the canonical baseline through `MigrationBundleLegacyNameSet`. That is a
  migration-journal rename, not a table rename.
- Package-level renames (`goals/workspace-thread-domain/PLAN.md:37`, the
  `agents` rename touching many imports) and
  `standards/changesets.retired-packages.json` (retired names guarded against
  reuse).
- The desktop sidecar migrates a persistent PGlite store at runtime
  (`Migrations.ts`, `main.ts:100-110`), so any existing install's ledger rows
  survive a code move only through a forward migration.
  The append-only triggers block row UPDATE/DELETE/TRUNCATE. They do not block
  `ALTER TABLE … RENAME`, which is DDL. A copy-into-new-table migration would
  INSERT into the new table (allowed) but could not delete from the old one
  without dropping the triggers.

#### 4. Candidate homes (evidence only)

**Where governed dispatch actually runs.** `apps/professional-desktop/server/OntologyMcpTransport.ts:155-290`
builds the ontology MCP server (`McpServer.layerHttp`, path `/mcp`). It wraps
the mutation and publish toolkits from `@beep/ontology-server/tools` in
`GovernedTierGateLive` and gives the publish branch a fresh
`FetchHttpClient` behind `GovernedEgressLive`. `main.ts:100-110` provides
`ExecutionLedgerDrizzle`, `EpistemicConfigLive` and the shared PGlite. The port
is `@beep/mcp-kit`'s `TierGate` (`packages/foundation/capability/mcp-kit`).
`ontology/server` consumes it and `epistemic/server` implements it. The
mcp-kit README names the desktop entrypoint as the binding site. The MCP
transport, tool registration and dispatch are app code plus ontology and
foundation code. The epistemic slice supplies the policy, the ledger and the
config.

**(a) `packages/agents`** (`domain`, `use-cases`, `server`, `tables`, `client`;
no `config`, no `ui`).

- Domain: `entities/Agent`, `entities/Skill`, `entities/ProviderInstance`,
  `values/AssistantContent`. README: "Schema-first agent and skill models for
  the Agentic Professional Runtime proof."
- Use-cases: `entities/ProviderInstance/*`, `processes/AssistantTurn`,
  `processes/Chat` (`ChatRpcs`), `processes/ProfessionalRuntime`.
- Server: `AssistantTurn` (Anthropic turn kernel/codec, `scanChunk`),
  `ProviderInstance` (layer, probe, repo).
- Tables: `ProviderInstance` only.
- MCP, tool dispatch, grants, authority: **NOT FOUND**.
  `rg -i "mcp|toolcall|grant|permission|authority" packages/agents/*/src`
  turns up a comment and `disableToolCallResolution: true`
  (`server/src/AssistantTurn/AnthropicTurnKernel.ts:267`).
- Dependencies: domain `@beep/identity`, `@beep/md`, `@beep/schema`,
  `@beep/shared-domain`. Server adds `@beep/anthropic`,
  `@beep/ai-provider-cli`, `@beep/postgres`. Use-cases and client depend on
  `@beep/workspace-use-cases`/`-domain`.
- For: the subject of a grant is an agent session acting on sinks. The
  glossary row "Action authorization | `ExecutionVerdict` | governed-execution
  boundary" (`standards/architecture/GLOSSARY.md:585`) does not name
  epistemic. The slice already has `server` and `tables` for the adapter and
  ledger. Identity composers `$AgentsDomainId` through `$AgentsTablesId`
  exist (`identity/src/packages.ts:918-966,2382`).
- Against: agents today models provider/chat/turn streaming, not MCP or sink
  governance. It has no config package, so `@beep/agents-config` would be new,
  as would its first db-admin target. The desktop app already composes agents
  for chat, so co-location adds no new app dependency. It does make one slice
  own both "run the model" and "authorize what the model's tools do".

**(b) New slice** (for example `packages/<execution-authority>/{domain,use-cases,server,tables,config}`).

- Tooling: `bun run beep create-package <name> --dir-name <role> --parent-dir packages/<slice>`
  (flags confirmed by `--help`: `--type`, `--family`, `--kind`, `--dir-name`,
  `--parent-dir`, `--description`, `--dry-run`, `--reuse-retired-name`,
  `--skip-lockfile`). It emits the scripts block, tsconfig overlays, identity
  registration and per-package `turbo.json` (AGENTS.md "Discovery & Reuse").
  `bun run beep architecture create slice <slice> <concept> [--domain-kind aggregates|entities|values] [--stage core|persistence|protocol|client|full] [--dry-run]`
  and `architecture create package <slice> <role>` build from an operation
  plan. `architecture add concept|role` adds concepts to an existing slice.
- For: matches `10-cross-slice-coordination.md` §5 resolution 3 ("Promote the
  orchestrator to its own slice … create a dedicated slice that owns the
  cross-cut as its own domain"). It also matches the 2026-10-21 decision's
  wording "their own home". It keeps the implementer side of the
  port-inversion record a single-purpose slice.
- Against: 4-5 new packages for roughly 4.6 k lines. Each brings
  scripts/coverage/turbo/cache-baseline entries. A one-consumer slice (only the
  desktop app binds it today).

**(c) Shared kernel** (`packages/shared/*`).

- `02-shared-kernel.md:35-48` excludes "workflows, process managers,
  schedulers, handlers, or concrete adapters that execute shared contracts"
  and "a partial domain model waiting for a home". That rules out
  `GovernedTierGate`, `GovernedEgress` and `ExecutionLedgerDrizzle`.
- Values could go to `shared/domain` only with a promotion record listing at
  least 2 importing packages (`:192`, "one consumer is not yet promotable").
  Today the only importers outside epistemic are one app and db-admin. No
  second slice imports them.
- Foundation is also blocked as written. The values import
  `@beep/shared-domain/entity/Principal`, and "foundation may not depend on the
  shared kernel" (DECISIONS 2026-10-21 amendment). Parameterizing over the
  principal type, as `@beep/epistemics` does with `IdCodec`, would be needed.

**(d) Stay in epistemic, renamed or relabelled.** Listed for completeness:
the 2026-10-21 decision calls it misfiled, so this option means reversing that
entry.

#### 5. `@beep/epistemic-config`

- `package.json` description: "Typed server configuration for epistemic
  execution authority: destination allowlist, audience resolution, and pinned
  policy revision." Dependencies: `@beep/epistemic-domain`, `@beep/identity`,
  `effect`. Exports `.`, `./public`, `./server`, `./secrets`, `./layer`,
  `./test`; `./internal/*` is null.
- `/server` (`src/server.ts`): `EpistemicConfig` (Context.Service, key
  `$EpistemicConfigId` `EpistemicConfig`), `EpistemicServerConfig`
  (`destinationAllowlist`, `policyRevision`), `EpistemicConfigShape`,
  `EpistemicDestinationAllowlistConfig` (env
  `EPISTEMIC_EGRESS_DESTINATION_ALLOWLIST`, default `[]`),
  `EpistemicPolicyRevisionConfig` (env `EPISTEMIC_POLICY_REVISION`, default
  `1.0.0`), `defaultPolicyRevision`, `resolveSinkAudience` (`Audience.ts`).
- `/layer`: `EpistemicConfigLive`. `/test`: `fixtureAllowedDestination`,
  `fixtureDeniedDestination`, `fixtureFrozenAt`, `fixtureFrozenGrantSet`,
  `testEpistemicConfig`, `makeEpistemicConfigTest`, `EpistemicConfigTest`.
  `/public` and `/secrets` are empty (`export {}`).
- Readers: `epistemic/server` GovernedTierGate and GovernedEgress
  (`.gate.ts:47`, `.fetch.ts:41`, both `.layer.ts`); desktop `main.ts`,
  `OntologyMcpTransport.ts:284` (uses `destinationAllowlist.length` to decide
  whether to register the publish tool); three desktop integration test files.
  No epistemic claim code reads it.
- Rules that constrain the move (`06-configuration-boundaries.md`): config
  depends inward on its own slice's `domain` and on `shared` (`:107-113`), so
  `@beep/epistemic-config` importing a different slice's domain would be a
  cross-slice import (`01-hexagonal-vertical-slices.md:71-74`). Config owns
  key namespaces (`:14`). Create config only "when the slice has meaningful
  runtime or application configuration contracts" (`:31-33`). Clients import
  only `/public` (`:77`). `/layer` is server/runtime-only (`:79-80`). Config
  must not import drivers (`:121`). Moving the package therefore means it
  follows its domain values into the same slice. The `EPISTEMIC_*` env key
  namespace is an operator-facing contract (`.env.example`, `turbo.json`
  env), and changing it is a separate decision from moving the code.

#### 6. Schema identifier stability

- Execution `$I` composers: `$EpistemicDomainId.create("values/ExecutionGrant/ExecutionGrant.model")`
  (`ExecutionGrant.model.ts:25`) and the equivalents in GrantSet,
  ExecutionVerdict and ExecutionRecord; `$EpistemicUseCasesId.create("ExecutionLedger/ExecutionLedger.{ports,errors}")`;
  `$EpistemicServerId` in GovernedTierGate and GovernedEgress;
  `$EpistemicConfigId.create("ServerConfig")`.
- `packages/epistemic/domain/test/ValueSchemaIdentifiers.test.ts` pins 258
  identifiers in `test/fixtures/value-schema-identifiers.txt`, but only for the
  seven factory-bound modules (ClaimEvidenceReview, ClaimProjection,
  Contradiction, ContradictionDetection, EdgeEndpoint, EvidenceVerification,
  LogicalEdgeIdentity). `grep -ciE "Execution|GrantSet|Sink|PolicyRevision|Denial|Egress|Grant|Chain"`
  on the fixture gives **0**. No test asserts an execution identifier string.
  `rg '"@beep/epistemic-…/(Execution|GrantSet|Governed)'` over ts/json/snap/txt
  finds only import specifiers.
- Persisted: the ledger stores digests, literal domain values
  (`allowed`/`denied`, `DenialReason`, `SinkClass`, `SinkAudience`,
  `ExecutionSettlement`) and the policy revision, never an identifier. Hash
  inputs exclude identifiers (§3). Tests assert tagged-error `_tag` values such
  as `GrantRevisionMismatch` (`ExecutionAuthority.test.ts:260`). Tags are class
  names, not composer paths.
- Context.Service keys move with the composer (for example
  `@beep/epistemic-config/ServerConfig/EpistemicConfig`). They are runtime-only
  and not persisted.

### Constraints Discovered

1. **Slice-to-slice imports are forbidden** (`01-hexagonal-vertical-slices.md:71-74`).
   Whatever home is chosen, domain, use-cases, server, tables and config must
   move together, or the remaining epistemic pieces would import a foreign
   slice. The split has to cut cleanly at the seams in §1: the CanonicalJson
   alias, the barrels, `EpistemicServerDrizzleLive`, `DbSchema`, OptionalDefect
   and the mixed tests.
2. **Foundation-mediated port inversion conditions** (DECISIONS 2026-07-25):
   the implementer and the consumer must not name each other, the binding stays
   at the app entrypoint, and **both package READMEs record the pair and the
   binding site**. Moving the implementer means updating
   `mcp-kit/README.md:30,33-37`, `api-transport/README.md:37` and the
   DECISIONS rationale text that names `epistemic/server`.
3. **Shared kernel admits no adapters or workflows**, and a promotion needs at
   least 2 consumers (`02-shared-kernel.md:35-48,192`). Foundation cannot import
   `shared-domain` `Principal` (DECISIONS 2026-10-21 amendment).
4. **Hash bytes must not change.** `11-evolution-and-deprecation.md` rule 5
   ("Persisted and served bytes do not change") applies by analogy: the three
   `epistemic-*/v1` version strings, the manual projections and
   `canonicalDetectionJson` must stay byte-identical, or old chains need a
   dual-prefix verifier.
5. **Same PR, no alias** (`11-evolution-and-deprecation.md:100-107,148-152`):
   the packages are `private: true`, have never shipped, and have a small,
   enumerable consumer list. The in-repo rule says delete and repoint in one
   change rather than leave re-export shims, which would open a deprecation
   window.
6. **Package creation only through `bun run beep create-package`**
   (AGENTS.md). New identity composers, generated tsconfig and vitest aliases,
   cache-qualification baseline rows, a CI lane partition entry and a
   coverage floor follow from that.
7. **Migrations are drizzle-kit driven since the baseline**
   (`db-admin/AGENTS.md:5-14`). A table rename is a generated or custom
   forward migration, and the hand-written constraint/trigger SQL plus its
   name-pinning migration test move with it. Installed desktops keep their
   PGlite data, and "zero users" was true on 2026-08-13 but has not been
   re-verified.
8. **Config follows its domain** (`06-configuration-boundaries.md:107-113`).
   Env key names are operator-facing and are a separate choice from code
   location.
9. **Tooling law pins a file path**
   (`Laws/FrozenGrantSet.ts:33` `FROZEN_GRANT_SET_DEFINING_MODULE`). If
   GrantSet moves without updating it, the law flags the new defining module.
10. **"Pure move" needs behavioral proof**
    (`goals/agent-execution-authority/history/reflections/2026-07-28-claude.md:118-127`):
    a green test list once hid a harness extraction that rebound a server to
    all interfaces. The move's acceptance should diff behavior (bound address,
    ledger row counts, the `information_schema.columns` pin), not only test
    names.

### Open Questions For Align

Each is phrased as a decision, with options listed neutrally.

1. **Home slice.** (a) `packages/agents`; (b) a new dedicated slice (name
   TBD); (c) split it: values to `shared/domain` or foundation, adapters to a
   slice. (c) currently fails the ≥2-consumer and no-adapter gates, and the
   foundation route fails on the `Principal` dependency.
2. **Physical table names.** (a) Keep `epistemic_execution_decision` and
   `epistemic_execution_outcome`, plus all constraint, trigger and function
   names, under new ownership, recorded as a legacy-name exception. (b) Rename
   with a forward `ALTER TABLE … RENAME` migration covering constraints,
   triggers and the guard function, and update the name-pinned tests and
   `Migrations.gen.ts`. (c) Re-baseline again, which only works if installs
   can still be treated as zero-user. That needs verifying.
3. **Hash domain-separation strings.** (a) Freeze the `epistemic-*/v1` strings
   permanently, as historical labels. (b) Mint `<new-home>-*/v2` for new
   records and keep a dual-prefix verifier for existing chains.
4. **Canonical JSON dependency.** (a) Keep importing `canonicalDetectionJson`
   from `@beep/epistemics`. Foundation is legal for domain, but the new home
   would depend on the epistemics vocabulary package for hashing. (b) Promote
   a neutral canonical-JSON primitive to `foundation/primitive`, with
   byte-identity tests that both epistemics and execution bind to. (c) Copy it
   locally with a golden byte test.
5. **Fate of `@beep/epistemic-config`.** (a) Move it to `@beep/<home>-config`
   unchanged. (b) Fold it into an existing config package at the new home.
   (c) Retire `@beep/epistemic-config` and record its name in
   `changesets.retired-packages.json`. Plus a separate decision on the env keys
   `EPISTEMIC_*`: keep them or rename them with a documented operator
   migration.
6. **Ordering and PR shape.** (a) One atomic PR (move, repoint 6 direct and 4
   indirect consumers, tooling pins, README records) under the "same PR, no
   alias" rule. (b) Staged: create the new packages and move domain+tables
   first, then use-cases, server and config, with temporary dual composition.
   Staging would open a window that rule 3 rejects for unreleased code.
7. **`EpistemicServerDrizzleLive` composition.** (a) Remove `ExecutionLedger`
   from it and have the desktop compose the new home's ledger layer
   explicitly. (b) Provide a new-home aggregate layer that the app merges.
   Either way `apps/professional-desktop/src/runtime/Layer.ts` and the qa-seed
   test change.
8. **Scope of "execution authority".** Does `GovernedEgress` (network sink)
   move with `GovernedTierGate` (MCP sink), or does egress go to its own
   capability? Both share the ledger and config today.
