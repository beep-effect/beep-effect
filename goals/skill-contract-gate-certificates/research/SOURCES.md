# Skill Contract Gate Certificates — Sources & Provenance

- **Source exploration:** `explorations/typed-agent-skill-contracts` — primary ledger:
  `explorations/typed-agent-skill-contracts/research/SOURCES.md`.

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|

## 3. External research sources

## 4. In-repo capability references

P0 (2026-11-02) read these before implementing:

| Reference | Used for |
|-----------|----------|
| `explorations/typed-agent-skill-contracts/MAP.md` §Amendment J re-entry | Binding inputs (envelope, five outcomes, reach, inconclusive exclusion, apply plan, first slice) |
| `explorations/typed-agent-skill-contracts/DECISIONS.md` 2026-08-26 and 2026-10-14 | Ownership ruling: candidate 7, kernel goal stays closed, one certificate vocabulary |
| `packages/foundation/modeling/skill-contract/src/EvidenceReceipt.ts` | Reused `EvidenceReceipt` envelope factory, `EvidenceSubject`/`EvidenceDigest`, `GateSummaryVerifier` |
| `packages/foundation/modeling/skill-contract/src/Gate.ts` | Reused `GateId`, `GateSeverity`, `EvidencePredicateType`, `IsoDateTimeString`; unique-id filter pattern |
| `packages/foundation/modeling/schema/src/LiteralKit` | Outcome, reach and refusal domains; `pick` for the inconclusive subset |
| `packages/foundation/modeling/schema/src/Conformance` | Searched for an existing EARL/ACT vocabulary: none |
| `packages/tooling/tool/cli/src/commands/Qa/JudgeContract.ts`, `JudgeCheck.ts` | Five declared QA gates and the existing settlement the certificate mirrors |
| `packages/tooling/tool/cli/test/qa-judge-contract-parity.test.ts` | Fixture style for the new parity suite |
| `.changeset/README.md` | Private workspaces need no changeset |

## 5. Cross-links & provenance
