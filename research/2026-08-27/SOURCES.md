# SOURCES — 2026-08-27

Quarantined evidence. Short fenced quotes only. Canonical links. Scraped text sanitized (no tokens, no high-entropy secrets).

## Law

### Lexis+ Protégé Legal Intelligence Engine

- https://www.lexisnexis.com/community/pressroom/b/news/posts/lexis-with-protege-accelerates-frictionless-agentic-productivity-from-first-idea-to-review-ready-legal-work-product
- https://www.lawnext.com/2026/08/lexisnexis-unveils-legal-intelligence-engine-rebuilding-protege-around-dynamic-agentic-orchestration.html

```
Legal professionals simply describe what they want to accomplish, and Lexis+ with
Protégé applies the right AI models … along with appropriate agents, skills, and
selected sources behind the scenes.
```

```
The key change … is the harness architecture. … workflows were scripted in
advance. The new platform … can bring in additional tools … check its work and
then loop back. The platform now includes several hundred skills … including
skills from Anthropic's Claude Legal offering.
```

### ILTACON Day 3 — single agentic interface

- https://www.law.com/legaltechnews/2026/08/26/iltacon-day-3-one-agentic-ai-interface-to-rule-them-all/

```
Now, legal tech vendors are racing to become the single agentic AI interface
lawyers use. … Litera itself is looking to become that chat interface …
centralizes all its offerings around its AI agent Lito.
```

```
LexisNexis recently announced dynamic agentic AI capabilities for … Lexis+ With
Protégé … Meanwhile e-discovery company DISCO also announced the general
availability of its agentic AI platform Advances Research … Reveal recently
launched an agentic AI suite … Epiq announced its AI Agent Automate …
```

### Clio judiciary

- https://www.law.com/legaltechnews/2026/08/25/clio-appoints-casetext-founder-pablo-arredondo-to-lead-judiciary-expansion/
- https://www.lawnext.com/2026/08/pablo-arredondo-casetext-cofounder-and-legal-ai-pioneer-joins-clio-to-lead-its-expansion-into-the-judiciary.html

```
Arredondo will head Clio's move into the justice system and lead the creation of
an artificial intelligence-powered, judiciary-specific product line … starts
Aug. 31.
```

### USPTO RPI / reexam NPR

- https://ipwatchdog.com/2026/08/25/commenters-split-uspto-proposal-require-rpi-disclosure-reexams/

```
the 26 comments submitted to the Office reveal a sharp divide … The proposed
rule would … require identification of … real parties in interest to the request.
```

### Harvey Tenet numbers + harness

- https://fireworks.ai/blog/post-training-kimi-k3-with-harvey-for-long-horizon-legal-work
- https://www.harvey.ai/blog/post-training-update-harvey-tenet

```
Harvey Tenet scores 19.7% all-pass on LAB against 10.8% for base Kimi K3 …
$5.92 per LAB task against $5.62 for base Kimi K3.
```

```
We ran our post-trained Kimi K3 checkpoint in our internal harness with direct
bash access to a filesystem mount of each task's world. This differs from
Mercor's canonical implementation, which exposes files/tools … through
structured MCP servers driven by a ReAct or Loop agent harness (Archipelago).
```

### Claude-Patent-Creator

- https://github.com/robthepcguy/claude-patent-creator

```
USPTO patent creation system with MCP server + Claude Code plugin. Hybrid RAG
search over MPEP/USC/CFR, BigQuery access to 76M+ patents, automated 35 USC 112
compliance checks, prior art search, diagram generation.
```

## Effect / local-first

### Evolu 8.7.0

- https://github.com/evoluhq/evolu/releases/tag/%40evolu%2Fcommon%408.7.0

```
The Evolu Protocol now uses these functions for JSON values and finite numbers
instead of msgpackr, removing the msgpackr runtime dependency while preserving
MessagePack compatibility. … 2.6 kB versus 10.5 kB gzip.
```

### Effect cluster / tools / socket / AI guide

- https://github.com/Effect-TS/effect/pull/7489
- https://github.com/Effect-TS/effect/pull/7486
- https://github.com/Effect-TS/effect/pull/7477
- https://github.com/Effect-TS/effect/pull/7492
- https://github.com/Effect-TS/effect/pull/7491

```
Replace the process-lifetime internalInterruptors fiber-id Set with a
refcounted registry of in-flight teardowns …
```

```
One rule for both paths: a tool call executes only when the response is known
to have moved past it. streamText uses a one-chunk lookahead …
```

```
Recommend Effect.fnUntraced for reusable library functions and hot paths where
tracing is unnecessary.
```

## Refutation sources (not new claims)

### drizzle-orm#6162 — held

- https://github.com/drizzle-team/drizzle-orm/issues/6162

```
The issue is with 1.0.0-rc.4. It's on that branch:
https://github.com/drizzle-team/drizzle-orm/blob/v1.0.0-rc.4/drizzle-orm/src/effect-core/errors.ts
```

### SEP-2640 — held

- https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2640
  state=open, updated 2026-08-25T22:57:35Z
