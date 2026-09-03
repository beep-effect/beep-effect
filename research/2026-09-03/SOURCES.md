# SOURCES — 2026-09-03

Short sanitized excerpts only. Canonical links.

## f-law-01 — Many Worlds sues OpenAI in ED Texas over five retrieval/personalization/generation patents
- URL: https://ipwatchdog.com/2026/09/02/openai-sued-over-ai-patents-covering-retrieval-personalization-content-generation/
- Kind: web / axis: law
```
Many Worlds 2T Innovations LLC has filed a patent infringement lawsuit against OpenAI OpCo, LLC, alleging that OpenAI's artificial intelligence products and services infringe five AI patents covering personalized search, vector-based retrieval, recommendation systems and probabilistically controlled content generation. The complaint, filed August 31, 2026, in the U.S. District Court for the Eastern District of Texas, Marshall Division, seeks a jury trial, monetary damages… The complaint also anticipates that OpenAI will challenge the patents under Section 101.
```

## f-law-02 — iManage/TR expand CoCounsel + HighQ/Noetica/Contract Express/Legal Tracker; MCP due to follow (not GA)
- URL: https://itbrief.news/story/imanage-thomson-reuters-expand-legal-ai-partnership-fa5ccdab-b18b-4424-9ced-113260dfe622
- Kind: web / axis: law
```
API-based integrations linking the iManage platform with CoCounsel Legal, HighQ, Contract Express, Noetica and Legal Tracker are already available, while MCP support for approved Thomson Reuters AI tools is due to follow. The MCP will add another way for our systems to work together, complementing the integrations customers already use today.
```

## f-law-03 — Everlaw-CoCounsel bridge announced Sept 1; wording is future-facing, not GA
- URL: https://www.everlaw.com/blog/ai-and-law/everlaw-and-thomson-reuters-cocounsel-partnership/
- Kind: web / axis: law
```
With this integration, users of Everlaw and CoCounsel Legal will be able to access Everlaw matters and data directly in CoCounsel, giving legal professionals new ways to bring the evidence in their matters together with the authoritative legal content and deep domain expertise from Westlaw and Practical Law.
```

## f-law-04 — USPTO ODP four-field gate still holds (live Sep 3); includeDocuments 500 unverified
- URL: https://data.uspto.gov/support
- Kind: web / axis: law
```
Live Sep 3 still requires Job Title, Organization Name, Organization Type, Intended Use to retain ODP products/API key. No rollback. includeDocuments 500 remains unverified (no auth probe).
```

## f-effect-01 — Version Packages (rc) still open; rc.113 staged not published
- URL: https://github.com/Effect-TS/effect/pull/7446
- Kind: github / axis: effect
```
main in pre mode. PR state=open; merged_at=null; updated_at=2026-09-03T13:17:05Z. Body lists effect@4.0.0-rc.113. Published latest remains effect@4.0.0-rc.112 (2026-08-25).
```

## f-effect-02 — MCP 2026-07-28 protocol adapter still OPEN; HOLD+MOVED
- URL: https://github.com/Effect-TS/effect/pull/7265
- Kind: github / axis: effect
```
state=open; updated_at=2026-09-02T16:32:07Z. McpProtocol.v2026_07_28; McpSchema.InputRequired; Schema-declared tool output / structuredContent. Pending release.
```

## f-effect-03 — [BUG]: Deprecated TaggedErrorClass syntax incompatible with Effect v4 RCs — still OPEN
- URL: https://github.com/drizzle-team/drizzle-orm/issues/6162
- Kind: github / axis: effect
```
state=open; no update since 2026-08-25. labels=bug. closed_at=null.
```

## f-effect-04 — Jazz #2467 CI rehearsal closed unmerged; alpha.54 RC #2361 still OPEN
- URL: https://github.com/garden-co/jazz/pull/2467
- Kind: github / axis: effect
```
#2467 integration CI rehearsal opened+closed unmerged Aug 31; must not merge independently. Actual alpha.54 RC #2361 remains OPEN. Not release completion.
```

## f-agents-01 — ACLE-MCP: short-lived sender-constrained leases for invocation-time MCP trust
- URL: https://arxiv.org/abs/2609.02690
- Kind: arxiv / axis: agents
```
For protected calls, ACLE-MCP issues a short-lived, sender-constrained capability lease that binds the expected workload, freshness requirement, operation, object and parameter bounds, downstream constraints, and receipt obligations. ... full ACLE-MCP blocks all evaluated attack families while preserving all benign tasks. ... the complete design increases request-level pooled p95 latency on normal allowed calls by 25.7% relative to OAuth-only.
```

## f-agents-02 — SkillShift formalizes Skill Policy Integrity; scanners miss covert steering
- URL: https://arxiv.org/abs/2609.02564
- Kind: arxiv / axis: agents
```
We formalize Skill Policy Integrity, which requires a Skill-induced policy to remain aligned with its declared functionality and the user-authorized objective. ... SkillShift achieving attacker-favored selection rates of 81% and 63% while maintaining a 100% valid-output rate. ... the evaluated scanners fail to detect the constructed Skills.
```

## f-agents-03 — DisCo Repo-To-Skill: 5,000+ verified skills from 1,000 ML repos (author-reported)
- URL: https://arxiv.org/abs/2609.02749
- Kind: arxiv / axis: agents
```
The former, applied across the open ecosystem, yields the AREX-Skill Library, with 5,000+ verified skills distilled from 1,000 widely used ML repositories and organized into 20 areas and 178 capability families. ... the skill-equipped research agent scores 134.3% higher on MLE-bench, 34.4% higher on PaperBench, 9.2% higher on FrontierCS, and 14.0% higher on PassNet than the same agent without skills.
```

## f-agents-04 — SafeEvolve: bounded reversible harness prompt/skill updates plus SFT/RL
- URL: https://arxiv.org/abs/2609.02786
- Kind: arxiv / axis: agents
```
On the harness side, SafeEvolve converts trajectory-level safety evidence into bounded, component-level updates across safety prompt and hierarchical skills, yielding auditable and reversible harness artifacts. ... For Qwen3.5-4B, SafeEvolve achieves a 3× ASR reduction on AgentDojo while improving benign utility from 59.79% to 61.86%.
```

## f-agents-05 — EFFECTBOUND: policy-relative effect closure; GitHub merge tool may merge a different commit
- URL: https://arxiv.org/abs/2609.02866
- Kind: arxiv / axis: agents
```
The GitHub tool cannot bind a merge to the reviewed commit; a controlled run confirms that it may merge a different commit. ... EffectBound... returns a strategy, an impossibility certificate, or no verdict when evidence is insufficient.
```

## f-agents-06 — CodePoisonRAG: one task-matched poison reaches Top-3 at 0.7% corpus ratio
- URL: https://arxiv.org/abs/2609.02774
- Kind: arxiv / axis: agents
```
We construct 85 poisoned artifacts covering ten CWE classes across Java and C, yielding an aggregate corpus-poisoning ratio of 0.7%. Across three generators, all 85 artifacts appear among the Top-3 results for their corresponding queries, and CodePoisonRAG achieves attack success rates between 0.80 and 0.93. Against CodeGuarder... the attack retains success rates between 0.40 and 0.71.
```

## f-agents-07 — kitter: local-first skill manager created 2026-09-02 (metadata volatile)
- URL: https://github.com/what1f/kitter
- Kind: github / axis: agents
```
local-first skill manager (one library, only what each project needs); created 2026-09-02T15:44:45Z; 93 stars at preflight. Metadata volatile; no quality inference.
```
