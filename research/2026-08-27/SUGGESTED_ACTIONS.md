# SUGGESTED_ACTIONS — 2026-08-27

Proposals only. Human admits. Do not auto-append to `explorations/INBOX.md` or `goals/`.
Derived from `claims.jsonl` (12 findings). An item graduates when a human fires its capture command.

## Priority (PROMPT kickoffs)

These six match `PROMPT.md`. Capture first if you only fire a few.

### f-law-05 — Fireworks publishes Tenet LAB numbers (moved from 2026-08-26 f-law-04)

Fireworks blog 2026-08-26: Harvey Tenet (Kimi K3 + async RL) scores 19.7% LAB all-pass vs 10.8% base Kimi K3; 11.3% vs 9.3% on LAB Contracts; 74.0% vs 58.8% Mercor APEX Corporate Law; 55.5% vs 49.3% Crosby Redline Bench. Cost $5.92 vs $5.62 per LAB task. Moves yesterday's Tenet claim from announcement-only to numbered eval.

```sh
bun run beep research capture https://fireworks.ai/blog/post-training-kimi-k3-with-harvey-for-long-horizon-legal-work --tags law,harvey,tenet,eval,fireworks,competitor
```

### f-law-06 — Tenet eval used bash/fs harness, not Mercor's MCP/ReAct

Harvey's Tenet research preview discloses that LAB was run in Harvey's internal harness with direct bash + filesystem mount, not Mercor's canonical MCP-server + ReAct/Loop (Archipelago) harness. APEX/Redline transfer is therefore a cross-harness result, not a like-for-like MCP-tool score. Intersects effect-native-legal-eval: do not treat Tenet LAB numbers as MCP-harness gold.

```sh
bun run beep research capture https://www.harvey.ai/blog/post-training-update-harvey-tenet --tags law,harvey,tenet,harness,mcp,eval
```

### f-law-01 — Lexis+ Protégé Legal Intelligence Engine: dynamic skill/model harness

On 2026-08-24 LexisNexis rebuilt Lexis+ with Protégé around a Legal Intelligence Engine harness that dynamically selects models, agents, skills, and sources from a natural-language task (not predefined workflows). Several hundred skills ship, including Anthropic Claude Legal skills; Shepard's is the citation check; a proprietary Lexis model is planned later in 2026. Missed by the 2026-08-26 packet; still the live ILTACON talking point on 2026-08-26.

```sh
bun run beep research capture https://www.lexisnexis.com/community/pressroom/b/news/posts/lexis-with-protege-accelerates-frictionless-agentic-productivity-from-first-idea-to-review-ready-legal-work-product --tags law,lexis,protege,harness,skills,competitor
```

### f-effect-01 — Evolu 8.7.0 replaces msgpackr with a JsonValue binary codec

@evolu/common@8.7.0 (2026-08-27T04:57:58Z) adds encodeJsonValue/decodeJsonValue, drops the msgpackr runtime for JSON values and finite numbers, and keeps MessagePack wire compatibility. 2.6 kB vs 10.5 kB gzip vs msgpackr 2.0.5; three round-trip bugfixes (nesting limit, -0, __proto__). Parallel to Effect #7461 removing MessagePack for SchemaBinary: local-first stacks are writing their own schema-narrow codecs instead of generic msgpack.

```sh
bun run beep research capture https://github.com/evoluhq/evolu/releases/tag/%40evolu%2Fcommon%408.7.0 --tags effect,evolu,local-first,schema,codec
```

### f-effect-03 — Effect streamText runs tool handlers eagerly with interruption

Effect #7486 (merged 2026-08-27T02:19Z): one rule for generateText and streamText — a tool handler runs only after the response is known to have moved past that tool call. streamText uses one-chunk lookahead so an incomplete finish cannot start handlers. Alternative to #7447 that keeps safety without giving up eager streaming execution. Directly relevant to beep AI toolkit / yeet tool loops.

```sh
bun run beep research capture https://github.com/Effect-TS/effect/pull/7486 --tags effect,effect-v4,tools,streaming
```

### f-law-03 — Clio hires Casetext/CoCounsel cofounder as SVP Judiciary

Clio appointed Pablo Arredondo (Casetext cofounder; later TR VP of CoCounsel) Senior VP of Judiciary, start 2026-08-31. Mandate is a dedicated AI product line for courts and judges — first move of this scale into the judiciary. Backdrop: vLex acquisition and Clio Docket in Clio Work. Arredondo names hallucination volume on dockets as a driver.

```sh
bun run beep research capture https://www.law.com/legaltechnews/2026/08/25/clio-appoints-casetext-founder-pablo-arredondo-to-lead-judiciary-expansion/ --tags law,clio,casetext,judiciary,competitor
```

## Law

### f-law-02 — ILTACON Day 3: vendors race to own the single agentic legal interface

ILTACON Day 3 (2026-08-26 16:02 ET) frames the market as a race to become the single agentic interface lawyers talk to. Named ships: Litera Lito (company relaunch), Lexis+ Protégé, DISCO Advanced Research (GA, shown at booth 216), Reveal agentic suite, Epiq Automate. Foundation-model chatbots (Claude, Gemini, Perplexity) are the named threat because they already sit in lawyers' daily chat.

```sh
bun run beep research capture https://www.law.com/legaltechnews/2026/08/26/iltacon-day-3-one-agentic-ai-interface-to-rule-them-all/ --tags law,iltacon,litera,disco,reveal,epiq,competitor
```

### f-law-04 — USPTO RPI-disclosure-for-reexam NPR: 26 comments, split

IPWatchdog 2026-08-25: the July 2026 USPTO NPR to require third-party ex parte reexamination requesters to identify all real parties in interest drew 26 comments, sharply split. USPTO argues anonymous EPR is in tension with 315(e)(1)/325(e)(1) estoppel; opponents say Congress designed EPR as available to any person with anonymity. Missed by the 2026-08-26 packet. Touches uspto-prosecution-read / law-docketing-patent-spine identity rules.

```sh
bun run beep research capture https://ipwatchdog.com/2026/08/25/commenters-split-uspto-proposal-require-rpi-disclosure-reexams/ --tags law,uspto,reexam,rpi
```

### f-law-07 — Claude-Patent-Creator: MCP + Claude Code plugin over MPEP/BigQuery

robthepcguy/claude-patent-creator (pushed 2026-08-24) is a USPTO drafting stack: MCP server (MPEP/USC/CFR hybrid RAG, BigQuery 76M+ patents, 35 USC 112 claim/spec checks, Graphviz diagrams) plus a Claude Code plugin of auto-activating skills and a 6-phase autonomous patent-creator subagent (55-80 min). Output is markdown+SVG; USPTO DOCX/PDF conversion is a manual post-step. Intersection of law + skills + MCP; usable foil for patent-drafting-episode-ledger.

```sh
bun run beep research capture https://github.com/robthepcguy/claude-patent-creator --tags law,patent-drafting,mcp,skills,uspto
```

## Effect

### f-effect-02 — Effect cluster: bound teardown interrupt classification

Effect #7489 (merged 2026-08-27T06:56Z) replaces the process-lifetime internalInterruptors fiber-id Set with a refcounted registry of in-flight teardowns (entity, shard, singleton, entity type). Network-replayed interrupts stay non-transient. Closes #7467 / EFF-934. Overnight cluster hardening after rc.112 SchemaBinary.

```sh
bun run beep research capture https://github.com/Effect-TS/effect/pull/7489 --tags effect,effect-v4,cluster
```

### f-effect-04 — Effect Socket.fromWebSocket is now cross-runtime

Effect #7477 (merged 2026-08-27T00:33Z) unties Socket.fromWebSocket from the DOM WebSocket type, adds typed handshake headers, and supports Node (ws), Bun, and browsers. Authenticated OpenAI connections no longer need casts. Cluster/AI clients can share one socket constructor.

```sh
bun run beep research capture https://github.com/Effect-TS/effect/pull/7477 --tags effect,effect-v4,websocket
```

### f-effect-05 — Effect AI guide now prefers Effect.fnUntraced on hot paths

Effect #7492 (merged 2026-08-27T10:06Z) tells the AI guide to use Effect.fnUntraced for reusable library functions and hot paths; traced Effect.fn("name") stays for named spans. #7491 (09:31Z) refined repository skill guidance. Continues yesterday's jsdocs-skill compression (#7479).

```sh
bun run beep research capture https://github.com/Effect-TS/effect/pull/7492 --tags effect,effect-v4,skills,ai-guide
```

## Standing recapture

Challenged this run. Still standing. Recapture if you want the live source on the watchlist.

### f-effect-05 (2026-08-26) — drizzle-orm effect-core still calls Schema.TaggedErrorClass

drizzle-orm#6162 still open; lotap confirmed v1.0.0-rc.4 effect-core/errors.ts on 2026-08-25. Beep #852 merged, does not close upstream.

```sh
bun run beep research capture https://github.com/drizzle-team/drizzle-orm/issues/6162 --tags effect,drizzle,effect-v4
```

### f-agents-03 (2026-08-26) — SEP-2640 still open

SEP-2640 PR still open, updated 2026-08-25T22:57:35Z.

```sh
bun run beep research capture https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2640 --tags agents,mcp,skills,sep-2640
```
