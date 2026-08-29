# Skill Contract Kernel — Sources & Provenance

<!--
Inherited at graduate (2026-08-13) from explorations/typed-agent-skill-contracts.
The exploration's ledger is the PRIMARY copy; this file reproduces the corpus the
implementation actually needs. Never fabricate a URL; licenses are load-bearing.
-->

- **Source exploration:** `explorations/typed-agent-skill-contracts` — primary ledger:
  [`explorations/typed-agent-skill-contracts/research/SOURCES.md`](../../../explorations/typed-agent-skill-contracts/research/SOURCES.md).
- **Provenance:** mining rollup
  [`research/mining/SYNTHESIS.md`](../../../explorations/typed-agent-skill-contracts/research/mining/SYNTHESIS.md)
  (thesis, five patterns, ten ports); verified in-repo inventory under
  [`research/inventory/`](../../../explorations/typed-agent-skill-contracts/research/inventory/);
  external landscape under
  [`research/landscape/`](../../../explorations/typed-agent-skill-contracts/research/landscape/).

## 1. Mined source corpus

| Source | Title | Upstream (repo) | Location | Theme | Disposition |
|--------|-------|-----------------|----------|-------|-------------|
| exploration mining | OpenLink ai-agent-skills 7-lane mining pass | OpenLinkSoftware/ai-agent-skills @ `929692f4` | exploration `research/mining/*.md` | contract shapes, gate lists, evidence ladders, receipts | port (shapes only) |
| inventory lane 1 | Contract-kernel + evidence capability inventory | this repo | exploration `research/inventory/contract-kernel-evidence.md` | EXISTS/PARTIAL/NET-NEW verdicts for ports 1/2/4 | reuse (verified `file:line`) |
| inventory lane 2 | Protocol/query/memory capability inventory | this repo | exploration `research/inventory/protocol-query-memory.md` | verdicts for ports 3/5/6/7/8/10 | reuse (verified `file:line`) |
| landscape lane 1 | Skill/tool contract formats survey | (multiple; per-URL rows in report) | exploration `research/landscape/skill-contract-formats.md` | MCP, Agent Skills, A2A, OASF, ACS, Effect AI | interop/reference per row |
| landscape lane 2 | Workflow/evidence frameworks survey | (multiple; per-URL rows in report) | exploration `research/landscape/workflow-evidence-frameworks.md` | Temporal, XState, PROV-O, C2PA, in-toto/SLSA, VC | interop/reference per row |

**How these inform implementation:** the kernel ports contract *shapes* (gate lists, ladder
semantics, receipt field sets) — never OpenLink implementations; fail-closed evaluation and
audit-record discipline come from ACS; receipt schemas mirror the in-toto Statement split so
export stays a projection; every reused in-repo brick is cited with `file:line` in the
inventory reports.

## 2. Upstream repositories & licenses

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|
| https://github.com/OpenLinkSoftware/ai-agent-skills | MIT (verified 2026-08-10) | port-with-attribution | contract shapes, gate lists, evidence-ladder semantics, receipt field sets |
| https://github.com/microsoft/agent-governance-toolkit | MIT (verified 2026-08-13) | port-with-attribution | ACS fail-closed evaluation discipline, intervention vocabulary, evidence bounds, audit-record separation |
| https://github.com/in-toto/attestation | Apache-2.0 (verified 2026-08-13) | interop + vocabulary adoption | Statement/predicate/envelope split; inspections ≈ re-extraction; SLSA VSA shape for gate summaries |
| https://github.com/Effect-TS/effect-smol | MIT | substrate (extend, don't compete) | `Tool`/`Toolkit` typed invocation substrate (`effect/unstable/ai`) |

## 3. External research sources

Full per-URL rows (with licenses and dispositions) live in the two landscape reports'
`SOURCES ledger rows` sections — the exploration's
[`skill-contract-formats.md`](../../../explorations/typed-agent-skill-contracts/research/landscape/skill-contract-formats.md)
and
[`workflow-evidence-frameworks.md`](../../../explorations/typed-agent-skill-contracts/research/landscape/workflow-evidence-frameworks.md).
Implementation-load-bearing subset:

- ACS specification + AGT-Evidence profile —
  https://github.com/microsoft/agent-governance-toolkit/blob/main/policy-engine/spec/SPECIFICATION.md,
  https://github.com/microsoft/agent-governance-toolkit/blob/main/policy-engine/spec/agt/AGT-EVIDENCE-1.0.md (MIT).
- in-toto attestation framework —
  https://github.com/in-toto/attestation/blob/main/spec/README.md (Apache-2.0);
  SLSA VSA — https://slsa.dev/spec/v1.1/verification_summary (Community Spec License 1.0).
- Effect AI Tool/Toolkit —
  https://raw.githubusercontent.com/Effect-TS/effect-smol/main/packages/effect/src/unstable/ai/Tool.ts (MIT).

## 4. In-repo capability references

The bricks this goal composes (verified `file:line` citations in the inventory reports):

- `@beep/schema` — `LiteralKit`, `withKeyDefaults`: **reuse**. (The `TaggedErrorClass` helper
  named at graduation was retired repo-wide, commit `ec3bc91e63` — boundary errors use
  Effect's `S.TaggedError` directly.)
- `@beep/identity` — `$I` composers, `$SchemaId`: **reuse**.
- `@beep/provenance` — `VerifiedTextAnchor` opaque-constructor + receipt split: **reuse as
  pattern**.
- `@beep/md` — document model for the SKILL.md projection, rendered via `render`/
  `renderUnsafe` (the deprecated `DocumentToMarkdown` `S.encode` path is not the target;
  see `SPEC.md` §Objective): **reuse**.
- `@beep/repo-cli` Qa command — `Inventory.schemas.ts`, `JudgeCheck.ts`, `JudgeIngest.ts`,
  `JudgeLint.ts`: **extend** (retrofit target; parity required).
- Verdict-value precedents — `@beep/mcp-kit` `TierGate.ts`; `ClaimGateResult` model in
  `@beep/epistemic-domain` (returned by the `@beep/epistemic-use-cases` `ClaimGate` service):
  **reuse as pattern** (read-only precedents — modeling cannot import capability or slices).
- `SkillContract` root, ladder ADT, receipt family, fail-closed gate evaluation: **NET-NEW**
  (declared in exploration `MAP.md` capability check).

## 5. Cross-links & provenance

- Source exploration packet:
  [`explorations/typed-agent-skill-contracts/`](../../../explorations/typed-agent-skill-contracts/README.md)
  (`links.goals` ↔ this packet's `provenance.exploration`).
- Locked decision log:
  [`DECISIONS.md`](../../../explorations/typed-agent-skill-contracts/DECISIONS.md) —
  mirrored in this packet's `SPEC.md` §Decision Log as back-links.
- Wave map (later candidates live in the exploration, not here):
  [`MAP.md`](../../../explorations/typed-agent-skill-contracts/MAP.md).
