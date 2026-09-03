# SUGGESTED ACTIONS — 2026-09-03

Executable captures. Human admits. Do not auto-append to `explorations/INBOX.md` or `goals/`.
Derived from `claims.jsonl` (15 findings). An item graduates when a human fires its capture command.

## Priority (PROMPT kickoffs)

These six match `PROMPT.md` plus the captures named for this packet. Capture first if you only fire a few.

### f-law-01 — Many Worlds sues OpenAI over five retrieval/personalization/generation patents

IPWatchdog 2026-09-02: Many Worlds 2T Innovations LLC sued OpenAI on 2026-08-31 in ED Texas (Marshall) on five patents (8,676,742; 8,843,433; 10,699,202; 12,307,388; 12,299,603) covering contextual/personalized retrieval, vector search, recommendation, and probabilistic generation. Seeks damages/injunction; anticipates Section 101. Filing is the fact; infringement is the allegation.

```
bun run beep research capture https://ipwatchdog.com/2026/09/02/openai-sued-over-ai-patents-covering-retrieval-personalization-content-generation/ --tags law,patent,openai,retrieval
```

### f-agents-02 — SkillShift formalizes Skill Policy Integrity (arXiv 2609.02564)

SkillShift reports covert utility-preserving skill steering at 81.33%/63.33% with 100% utility preservation, transfer, and scanner misses. Distinct post-tombstone evidence. Add watch. Author-reported metrics. Next to skill-contract-kernel / TrustShift / skillscan.

```
bun run beep research capture https://arxiv.org/abs/2609.02564 --tags agents,skills,skillshift,policy-integrity
```

### f-agents-01 — ACLE-MCP short-lived sender-constrained leases (arXiv 2609.02690)

ACLE-MCP binds workload freshness/operation/object/params/downstream/receipts at invocation. Author-reported prototype blocked all evaluated attacks; normal pooled p95 12.20→15.34ms (+25.7%) vs OAuth-only. Narrow author-reported prototype. Pair with EFFECTBOUND (f-agents-05) for head-SHA binding / receipts.

```
bun run beep research capture https://arxiv.org/abs/2609.02690 --tags agents,mcp,leases,attestation
```

### f-agents-05 — EFFECTBOUND policy-relative effect closure (arXiv 2609.02866)

EffectBound decides policy-relative effect closure via strategy / certificate / no-verdict. Author-reported: a GitHub merge tool may merge a different commit than reviewed. Motivates head-SHA binding and receipts. Adjacent to yeet merge / MCP kit.

```
bun run beep research capture https://arxiv.org/abs/2609.02866 --tags agents,effect-closure,mcp,github
```

### f-law-02 — iManage/TR CoCounsel expansion; MCP due to follow (not GA)

Sept 1 partnership expands CoCounsel links and HighQ/Noetica/Contract Express/Legal Tracker access to governed iManage records. Existing APIs available; MCP support is only due to follow. Do not call MCP GA. Distinct from the standing iManage MCP write-back Oct 2026 watch.

```
bun run beep research capture https://itbrief.news/story/imanage-thomson-reuters-expand-legal-ai-partnership-fa5ccdab-b18b-4424-9ced-113260dfe622 --tags law,imanage,thomson-reuters,cocounsel,mcp
```

### f-agents-03 — DisCo Repo-To-Skill (arXiv 2609.02749)

Author-reported 5,000+ verified skills from 1,000 ML repos / 20 areas / 178 families, and fixed-harness gains +134.3% MLE-bench, +34.4% PaperBench, +9.2% FrontierCS, +14.0% PassNet. Add watch. Author-reported; not a quality inference about generated skills.

```
bun run beep research capture https://arxiv.org/abs/2609.02749 --tags agents,skills,repo-to-skill,disco
```

## Remainder

### f-law-03 — Everlaw-CoCounsel bridge announced; future-facing, not GA

Sept 1 Everlaw-CoCounsel bridge would join matter evidence with Westlaw/Practical Law. Wording is “will be able,” not GA. Same-day CoCounsel fabric news as iManage/TR; different surface (ediscovery vs DMS).

```
bun run beep research capture https://www.everlaw.com/blog/ai-and-law/everlaw-and-thomson-reuters-cocounsel-partnership/ --tags law,everlaw,thomson-reuters,cocounsel
```

### f-law-04 — Refute: USPTO ODP four-field gate still holds; includeDocuments 500s unverified

Standing USPTO ODP four-field gate HOLDS (live data.uspto.gov/support on Sep 3). Job Title, Organization Name, Organization Type, and Intended Use remain mandatory or ODP products/API keys revoke. No rollback. includeDocuments HTTP 500 remains unverified (no authenticated probe). Keep the watch.

```
bun run beep research capture https://data.uspto.gov/support --tags law,uspto,odp,refute
```

### f-effect-01 — Refute: effect@4.0.0-rc.112 holds; Changesets #7446 stages unpublished rc.113

Standing SchemaBinary/rc.112 watchlist HOLDS. GitHub Releases newest effect@ tag remains effect@4.0.0-rc.112 (published 2026-08-25). Changesets #7446 still OPEN (updated 2026-09-03T13:17:05Z) staging unpublished effect@4.0.0-rc.113. Do not pin beep cluster transport or effect-v4 kits on an unmerged Changesets PR.

```
bun run beep research capture https://github.com/Effect-TS/effect/pull/7446 --tags effect,effect-v4,rc,changesets
```

### f-effect-02 — Refute: Effect #7265 MCP adapter HOLD+MOVED, not released

Standing #7265 adapter claim HOLDS and MOVES. Still OPEN (updated 2026-09-02T16:32:07Z). v2026_07_28 adapter / InputRequired / Schema structured outputs pending release. Not broken. Do not treat as shipped.

```
bun run beep research capture https://github.com/Effect-TS/effect/pull/7265 --tags effect,mcp,schema,tool-contracts
```

### f-effect-03 — Refute: drizzle TaggedErrorClass break still open

Standing drizzle Schema.TaggedErrorClass claim HOLDS. drizzle-orm#6162 remains OPEN. No update since 2026-08-25. No upstream fix in this window.

```
bun run beep research capture https://github.com/drizzle-team/drizzle-orm/issues/6162 --tags effect,drizzle,TaggedErrorClass
```

### f-effect-04 — Jazz #2467 CI rehearsal closed unmerged; alpha.54 RC #2361 still OPEN

garden-co/jazz#2467 opened and closed unmerged Aug 31 and explicitly must not merge independently. Actual alpha.54 RC #2361 remains OPEN. MOVES the rehearsal story; not release completion.

```
bun run beep research capture https://github.com/garden-co/jazz/pull/2467 --tags jazz,local-first,alpha-54
```

### f-agents-04 — SafeEvolve bounded reversible harness updates (arXiv 2609.02786)

SafeEvolve makes bounded reversible harness prompt/hierarchical-skill updates plus SFT/RL from trajectory evidence. Author-reported 3× AgentDojo ASR reduction and benign utility 59.79→61.86% on Qwen3.5-4B. Author-reported.

```
bun run beep research capture https://arxiv.org/abs/2609.02786 --tags agents,harness,safety,skills
```

### f-agents-06 — CodePoisonRAG one-poison Top-3 (arXiv 2609.02774)

CodePoisonRAG: one task-matched poison. Author-reported 85 artifacts / 10 CWEs at 0.7% corpus ratio all Top-3; ASR 0.80–0.93, 0.40–0.71 against CodeGuarder. Author-reported RACG study.

```
bun run beep research capture https://arxiv.org/abs/2609.02774 --tags agents,rag,poisoning,code-generation
```

### f-agents-07 — kitter local-first skill manager (created 2026-09-02)

what1f/kitter created 2026-09-02T15:44:45Z. Local-first skill manager (“one library, only what each project needs”). 93 stars at preflight. Metadata volatile; no quality inference.

```
bun run beep research capture https://github.com/what1f/kitter --tags agents,skills,local-first,github
```
