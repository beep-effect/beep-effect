# SOURCES — 2026-10-09

Quarantined evidence: short fenced quotes only. This publisher did not re-scrape. Each fence quotes the structured finding claim (already sanitized; no tokens or high-entropy strings). Canonical link per finding.

## Law / legal-AI / IP

- **f-law-01** — Harvey LAB-AA v1.1 adds a hallucination gate; headline scores collapse to single digits (2026-10-08): https://artificialanalysis.ai/articles/harvey-lab-aa-v1-1

  ```text
  Hallucination-Gated All-Pass Rate zeroes any task with a material hallucination.
  ```

- **f-law-02** — Checker choice swings LAB-AA hallucination counts ~8x (2026-10-08): https://www.ai-primer.com/engineer/stories/harvey-hallucination-gated-benchmark

  ```text
  GPT-6 Sol upheld 470 material hallucinations vs Claude Sonnet 5.5's 57 on the same deliverables.
  ```

- **f-law-03** — Harvey + LexisNexis ship first co-developed agentic workflow: Motion to Dismiss (2026-10-08): https://www.harvey.ai/blog/motion-to-dismiss-workflow-lexisnexis

  ```text
  A planning agent ranks up to eight dismissal grounds from an uploaded complaint, and the lawyer approves.
  ```

- **f-law-04** — Harvey publishes wake-sleep memory results for long-horizon legal agents (2026-10-08): https://x.com/harvey/status/2108231639616930135

  ```text
  Over 196 LAB tasks and 10 cycles all-pass rose 2.9% to 15.7%, at about 2.5x tool calls.
  ```

- **f-law-05** — USA Today Co. sues OpenAI for >$250M (SDNY 1:26-cv-08892) (2026-10-08): https://www.theverge.com/ai-artificial-intelligence/1008198/usa-today-openai-copyright-lawsuit

  ```text
  USA Today Co. and 13 affiliated newspaper entities sued OpenAI in SDNY seeking more than $250M.
  ```

- **f-law-06** — Ropes & Gray / Akerman credit AI training toward billable targets (2026-10-08): https://financetime.org/legal/legalindustry/law-firms-give-lawyers-time-off-billing-grind-test-drive-ai-2026-10-08

  ```text
  Ropes & Gray lets associates count up to 100 hours of approved AI experimentation toward billing requirements.
  ```

- **f-law-07** — Cited but Not Consulted: legal CoT names the right authority but verdicts ignore it (2026-10-08): https://arxiv.org/abs/2610.12361

  ```text
  Models name the correct authority 66.7-100% of the time, but verdicts change with the authority only 0-21.7% on CaseHOLD.
  ```

- **f-law-08** — PARCEL: claim-level benchmark for legal citation hallucination (2026-10-07): https://arxiv.org/abs/2610.10971

  ```text
  Strongest zero-shot LLMs reach about 0.97 accuracy but still mislabel unsupported claims.
  ```

## Effect / schema-first / local-first

- **f-eff-01** — Effect adds DNS resolution to effect/net (+ TLSA records) (2026-10-09): https://github.com/Effect-TS/effect/pull/8880

  ```text
  Effect-TS/effect #8880 adds DNS resolution to effect/net; #8953 adds TLSA records. Unreleased on npm.
  ```

- **f-eff-02** — Effect MCP server: HTTP servers can disable subscriptions; spurious list-change notifications fixed (2026-10-08): https://github.com/Effect-TS/effect/pull/8924

  ```text
  HTTP MCP servers can disable subscriptions, and spurious list-change notifications on first subscription are fixed.
  ```

- **f-eff-03** — Effect spans now start with the active OpenTelemetry parent span itself (2026-10-08): https://github.com/Effect-TS/effect/pull/8929

  ```text
  Effect spans now start with the active OpenTelemetry parent span itself.
  ```

- **f-eff-04** — Effect Cluster shutdown/shard-handoff hardening burst (2026-10-09): https://github.com/Effect-TS/effect/pull/8941

  ```text
  Graceful one-at-a-time shard handoff on shutdown, with lease-based SQL shard lock renewal restored.
  ```

- **f-eff-05** — Effect Schema: JSON Schema export safe-integer bounds fixed; class field override docs (2026-10-09): https://github.com/Effect-TS/effect/pull/8956

  ```text
  Safe integer bounds in JSON Schema export are fixed; Schema class field overrides are documented.
  ```

- **f-eff-06** — Zero 1.10.0 goes stable (npm latest), 1.11 canaries continue (2026-10-09): https://www.npmjs.com/package/@rocicorp/zero

  ```text
  npm @rocicorp/zero latest moved to 1.10.0; canary is 1.11.0-canary.34.
  ```

- **f-eff-07** — Google AI Edge Foresight: offline, local-first meeting notes on EmbeddingGemma 2 (2026-10-08): https://techcrunch.com/2026/10/08/google-releases-a-new-local-first-granola-competitor/

  ```text
  Google AI Edge Foresight transcribes and answers over local files fully on-device, on EmbeddingGemma 2.
  ```

- **r-02** — Refutation attempt: jazz-tools alpha still 2.0.0-alpha.59 (2026-10-09): https://www.npmjs.com/package/jazz-tools

  ```text
  npm jazz-tools alpha dist-tag is still 2.0.0-alpha.59 as of 2026-10-09.
  ```

- **r-04** — Refutation attempt: TanStack DB still 0.12.3 (2026-10-09): https://www.npmjs.com/package/@tanstack/db

  ```text
  npm latest is still 0.12.3, published 2026-10-07; no further release in the window.
  ```

## Agents / MCP / skills / ontologies / neural-symbolic

- **f-agt-01** — Claude Code 2.1.295: hooks can fail closed (onFailure: block); MCP reconnect fixes (2026-10-08): https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md

  ```text
  onFailure block makes a hook that cannot start, times out, or exits unexpectedly block the action.
  ```

- **f-agt-02** — Codex 0.162.0: managed git worktrees, Command Center pinning, ranked tool search in Code Mode (2026-10-08): https://github.com/openai/codex/releases/tag/rust-v0.162.0

  ```text
  Codex 0.162.0 adds tools to create and list managed Git worktrees from trusted local projects.
  ```

- **f-agt-03** — Skill Constellations: 2.19M dated SKILL.md adoptions mapped as a copy network (2026-10-08): https://arxiv.org/abs/2610.11169

  ```text
  A dated copy network of 2,193,119 skill adoptions traces origin, fix reach, and repos warranting review.
  ```

- **f-agt-04** — One Skill Too Many: co-installed skills silently override each other (2026-10-08): https://arxiv.org/abs/2610.11647

  ```text
  An installed skill can lose core constraints while the task still passes.
  ```

- **f-agt-05** — PyCache Trap: skill scanners inspect source but Python runs a swapped .pyc (2026-10-07): https://arxiv.org/abs/2610.10612

  ```text
  Across 100 skills and seven scanners, a substituted bytecode cache reaches 94-100% attack success.
  ```

- **f-agt-06** — NOMOS compiles written policies into statically verified tool-call gates (2026-10-08): https://arxiv.org/abs/2610.11030

  ```text
  Tool-schema-level static checks alone repair or reject 37% (airline) and 13% (retail) of inoperable candidate rules.
  ```

- **f-agt-07** — Spec Growth Engine: deterministic spec-graph vs import-graph divergence check (2026-10-08): https://arxiv.org/abs/2610.11725

  ```text
  A model-free engine validates a spec graph against the code import graph and classifies changes by blast radius.
  ```

- **f-agt-08** — Ontology tower: narrow-and-deep ontology as an LLM agent's operating knowledge (2026-10-08): https://arxiv.org/abs/2610.11768

  ```text
  Few entities with deep knowledge, run daily on a real test plant via PLC.
  ```

- **f-agt-09** — Cross-provider review as a runtime contract for coding agents (2026-10-07): https://arxiv.org/abs/2610.10961

  ```text
  In a 20-turn paired pilot, 8 turns had a material reviewer finding.
  ```

- **r-01** — Refutation attempt: MCP python-sdk Skills extension still not shipped (2026-10-09): https://github.com/modelcontextprotocol/python-sdk/pull/3485

  ```text
  python-sdk #3485 Add Skills extension remains OPEN as of 2026-10-09.
  ```

- **r-03** — Refutation attempt: MCP TS SDK has no new release since 1.32.1 (2026-10-09): https://www.npmjs.com/package/@modelcontextprotocol/sdk

  ```text
  npm latest remains 1.32.1, published 2026-10-05; no newer patch in the window.
  ```
