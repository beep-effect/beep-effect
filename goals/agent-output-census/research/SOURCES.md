# Agent Output Census — Sources & Provenance

- **Source exploration:** `explorations/agent-verification-output` — primary ledger:
  `explorations/agent-verification-output/research/SOURCES.md`
  ([link](../../../explorations/agent-verification-output/research/SOURCES.md)).
- This goal uses the transcript audit (method, limits and every table) and the in-repo
  inventory's notes on agent detection. It mines no upstream code.

## 1. Mined source corpus

None from upstream. The corpus the census reads is the operator's local transcripts, which are
private and never quoted, copied or listed in this repository.

| Source | Title | Upstream (repo) | Location (`file:line`) | Theme | Disposition |
|--------|-------|-----------------|------------------------|-------|-------------|

## 2. Upstream repositories & licenses

None. The census is built on in-repo libraries only.

| Repo | License | Port discipline | What we take |
|------|---------|-----------------|--------------|

## 3. External research sources

The harness facts the census relies on are recorded with URLs in
`explorations/agent-verification-output/research/external-landscape.md`
([link](../../../explorations/agent-verification-output/research/external-landscape.md)):

- Section 2, "How tools detect an agent": which variables Claude Code and Codex set.
- Section 5, published guidance and harness output limits: the head-and-tail excerpt window that
  explains why agents filter.

## 4. In-repo capability references

The method and the baseline tables:
`explorations/agent-verification-output/research/transcript-audit.md`
([link](../../../explorations/agent-verification-output/research/transcript-audit.md)), sections
"Method", "Limits", "Totals", "Where tool output goes", "How agents already cope", "What the
turns cost" and "What is in the output that survives filtering". The synthesis is
`explorations/agent-verification-output/RESEARCH.md`
([link](../../../explorations/agent-verification-output/RESEARCH.md)), "The problem, measured".

| Brick | Package / path | Use |
| --- | --- | --- |
| Transcript page reader | `@beep/repo-ai-metrics`, `packages/tooling/library/ai-metrics/src/transcript-page.ts` (`readTranscriptPage`) | reuse its source literal, time parsing and usage projection |
| Transcript sweep and intake | `packages/tooling/library/ai-metrics/src/transcript-sweep.ts`, `transcript-intake.ts` | reference; the census is a batch, not an intake |
| Transcript discovery | `packages/tooling/library/ai-metrics/src/transcript-discovery.ts` | reference for root declaration |
| Line shapes | `packages/tooling/library/ai-metrics/src/models.ts` (`ClaudeTranscriptLine`, `CodexTranscriptLine`) | extend |
| Private hashing | `packages/tooling/library/ai-metrics/src/privacy.ts` (`hashPrivateIdentifier`) | reuse, in memory only |
| JSONL lines | `@beep/jsonl`, `packages/foundation/modeling/jsonl/src/Line.ts` | reuse |
| Census-shaped report command | `packages/tooling/tool/cli/src/commands/Yeet/internal/Economics.ts` | reference |
| Command group | `packages/tooling/tool/cli/src/commands/AIMetrics/AIMetrics.command.ts` | extend |
| Tool-result classification and carried-cost accounting | none | NET-NEW |

## 5. Cross-links & provenance

- Source exploration packet: `explorations/agent-verification-output/RESEARCH.md`,
  `explorations/agent-verification-output/DECISIONS.md`,
  `explorations/agent-verification-output/BRIEF.md`,
  `explorations/agent-verification-output/MAP.md`.
- Consumers of the census rows: `goals/gate-output-switch-on`, `goals/gate-report-core`,
  `goals/gate-report-rollout`, `goals/ci-gate-reports`.
- Write each backticked path in this file from the repo root. A Markdown link
  target resolves from this file's directory instead, so point it three levels
  up to the repo root first; never copy a relative link out of the
  exploration's ledger unchanged.
