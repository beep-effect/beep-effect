# Closed literal domains (post-grill application pass, 2026-08-27)

Every string-literal union that appears in prose in the pre-glossary is a CLOSED domain.
S4 extraction lanes treat each as a fixed enumeration — never invent members, never
treat members as free strings. When these reach implementation they become `LiteralKit`
domains in `@beep/schema` (repo law: no hand-rolled unions of literals). Raised by the
round-1 panel (seat B); canonical spellings below win over any prose variant elsewhere.

| Domain | Members | Source of truth |
|--------|---------|-----------------|
| `LaneKind` | `TurboTaskLane`, `ScriptLane`, `CollectedGateLane` | CQ-001; lane assembly in `commands/Quality/Tasks.ts` |
| `ScopeKind` | `FullRepoScope`, `AffectedScope`, `FilterScope`, `ShardScope` | CQ-002 (glossary spelling canonical; "affected-from-base" is AffectedScope's description, not a member name) |
| `AssuranceTierId` | `TierRepairGreen`, `TierLocalFullProof`, `TierCiMergeGreen` | CQ-006 individuals; DECISIONS kpi-shape ruling (renamed from `CertaintyTierId` with the AssuranceTier rename; vernacular "certainty tier" is an altLabel) |
| `CostProvenance` | `measured`, `census`, `default` | CQ-003 |
| `GrantState` | `ActiveGrant`, `ReleasedGrant` *(supports: GrantState — lifecycle terminal; live store holds active leases only, released = ETL history)* | CQ-008 (`WaitingGrant` REMOVED round-3 H-10: a waiting contender is a `SeatRequest` under the ticket/lease split — the deployed store has no waiting lease record) |
| `ContendedResourceId` | `MachineProofLock`, `TurboDaemonResource`, `CpuCoresResource`, `MemoryPoolResource`, `SharedCacheResource` | CQ-008 |
| `AdmissionWorkKind` | `FullProofWork`, `MergedPreviewWork`, `ReviewFixWork`, `PublishWork` | CQ-021/CQ-009; DEPLOYED `AdmissionWorkKind` LiteralKit (`internal/repo-run/QualityScheduler.schemas.ts`): `full-proof`, `merged-preview`, `review-fix`, `publish` — the qualified ontology names dissolve seat F's cross-domain ambiguity (`review-fix` also in `YeetProofTier`; `publish` also in `AdmissionPriority`) |
| `AdmissionPriorityClass` | `PublishPriority`, `VerifyPriority` | CQ-021; DEPLOYED `AdmissionPriority` LiteralKit: `publish`, `verify` |
| `ExecutionState` | `RunningExecution`, `CompletedExecution`, `CancelledExecution` *(supports: ExecutionState — lifecycle terminal for cancelled work; S7's stopping rule writes it)* | CQ-022/CQ-025 (spec/execution split) |
| `CancelClass` | `CleanCancel`, `DirtyCancel` | CQ-022; the stopping ruling's clean/dirty cancel — clean = interruption leaves no corrupt state (read-only verification), dirty = mutating executions that must drain |
| `StarvationException` | `HardFloorException` | CQ-023; ETL-derived per-request from the snapshot-GLOBAL `AdmissionSnapshot.hardFloorEngaged` flag (round-3 J W5). `QuarantineException` REMOVED (round-3 J-B1): deployed `quarantined` is an array of file paths for UNDECODABLE ticket/lease JSON (corrupt-record isolation) and dead owners are REAPED, not quarantined — no owner-quarantine state exists to waive starvation |
| `CachePosture` | `LocalOnly`, `LocalWriteRemoteRead`, `CallerControlled` | CQ-024; DEPLOYED `TurboCachePlan` union (`internal/cli/TurboCache.ts`): `local:rw` -> LocalOnly, `local:rw,remote:r` -> LocalWriteRemoteRead, plus CallerControlled (CI / explicit `--cache=` arg — flags NOT rewritten). Fail-closed precision (round-3 J W2): "everything else -> local-only" holds on the ENV-QUAD resolution path only; `TURBO_CACHE` accepts only the remote-read posture as input — `local:rw` is the fail-closed OUTPUT, not an honored input |

Rulings encoded here (round-1 fixer + application pass):

1. **No punning.** `ContendedResource` members are named INDIVIDUALS, not classes.
   `SharedCacheResource` (the contended mount, an individual) is distinct from the class
   `SharedCache` (CQ-015's machine-shared turbo cache mount concept); an A-Box may type
   `SharedCacheResource` as an instance of `SharedCache`, but the two names never
   collapse into one unqualified term. The same discipline applies to every domain
   above: members are individuals of the domain class.
2. **`AssuranceTierId` is NOT yeet's proof-tier enum.** `YeetProofTier`
   (`full | cheap-gates | review-fix`, `Yeet/internal/Planner.ts`) is a distinct source
   domain; its mapping into assurance tiers is an S4 extraction question, recorded in
   scope.md.
3. **Deployed-literal fidelity.** Domains extracted from deployed LiteralKits record the
   verbatim source literals beside the ontology member names; the mapping is part of the
   domain declaration, and S4 lanes cite the LiteralKit call site as evidence
   (`source_domain` required on every `literal-domain-member` candidate).
4. Adding a member to any domain is a T-Box change: it requires a Must/Should CQ that
   needs the new member (or a named semantic-support license under the two-kind law),
   and goes through the extend → re-run-all → diff loop (R5).
5. **Member licensing (round-3 H-09/W-09).** The validator parses this table: each
   DOMAIN class must be CQ-licensed (blocker), and each MEMBER is audited — licensed by
   exact `ciops:<member>` occurrence in a testable query, by seed exercise, or by an
   inline `*(supports: X)*` annotation on the member; members with none are reported
   (visibility for S5, warn-level — the domain, not the member, is the admission unit).
6. **Not deployed enums** (round-3 J U3): `GrantState`, `ExecutionState`, and
   `CancelClass` are PACKET-SIDE closed domains with no deployed LiteralKit carrier —
   the live store's states are structural (ticket-file vs lease-file vs absent;
   verdict outcome + optional failedStepId). S4 lanes must NOT hunt for source enums
   bearing these names; the ETL derives the members from store/verdict structure.
