# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-11-06

Operator grilling session (party/epistemic ownership, PR #2829), verbatim
operator lines and the facts they reacted to:

- "so what is the point of the epistemics slice then. That slice always seemed fishy to me."
- Operator ruling in the same session: "Move execution, then grill" — first finish
  the already-decided move of agent execution authority out of the epistemic slice,
  then run a separate grill on the epistemic slice's direction.

Facts surfaced in that session:

- `standards/architecture/DECISIONS.md` "2026-10-21: Epistemic Vocabulary Is
  Foundation; Party Is A Product Slice; Propositions Are Slice-Owned" recorded
  `ExecutionGrant`, `GrantSet`, `ExecutionRecord`, `ExecutionVerdict` as misfiled
  in `@beep/epistemic-domain` ("they are not epistemics") and said they move to
  their own home in a separate change. That change never happened.
- `@beep/epistemic-config` describes itself entirely as execution authority:
  "destination allowlist, audience resolution, and pinned policy revision".
- Rough surface: epistemic domain 11 files, use-cases 6 (`ExecutionLedger`),
  server 14 (`ExecutionLedger`), tables 8 (`ExecutionRecord` table/converters),
  config 5.
- Live tables in `packages/_internal/db-admin/drizzle/20260813130540_baseline`:
  `epistemic_execution_decision`, `epistemic_execution_outcome` — the hash-chained
  append-only ledger built by `goals/agent-execution-authority` (#485, #493).
- Consumers: law-practice imports `@beep/epistemic-domain/values/ExecutionRecord`
  (5 sites); professional-desktop MCP sidecar is the governed surface.
- Candidate home: `packages/agents` (agents, skills, provider instances,
  assistant-turn streaming) or a new slice.
- Open: home slice; rename the tables (migration, hash-chain impact) or keep the
  physical names under new ownership; fate of `@beep/epistemic-config`; order of
  consumer repointing.
- Deferred to its own grill afterwards: epistemic slice A (the claim store every
  slice projects into) vs B (split into reusable infrastructure; party already
  carries its own claims on foundation factories).
