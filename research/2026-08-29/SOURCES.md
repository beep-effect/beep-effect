# SOURCES — 2026-08-29

Short sanitized excerpts only. Canonical links.

## f-law-01 — Harvey + PacerPro: firm litigation record into Harvey workflows
- URL: https://www.lawnext.com/2026/08/harvey-and-pacerpro-announce-partnership-to-connect-docket-data-with-ai-litigation-workflows.html
- Kind: web / axis: law
```
The legal AI company Harvey and the court data company PacerPro have announced an integration partnership that gives litigation teams working in Harvey access to their firm's complete litigation record, including the filings and case context from matters the firm has previously handled and those currently on the docket. PacerPro captures state and federal court filings and their underlying documents as they post, connecting each filing to its case and docket history.
```

## f-law-02 — LawToolBox MCP: 70 tools over M365 matter containers
- URL: https://www.lawnext.com/2026/08/watch-lawtoolbox-mcp-for-microsoft-365-claude-connects-legal-ai-to-matter-data-containers-in-m365.html
- Kind: web / axis: law
```
This connector includes 70 tools that leverage (i) the M365 data in the LawToolBox matter containers, (ii) the applicable laws and regulations, and (iii) the legal team's strategic analysis, amplified with LLMs and saved to containers. Any MCP-compatible AI such as Microsoft 365, Claude, Harvey, Legora, CoCounsel, or Lexis AI can reach that data directly, without a separate custom integration.
```

## f-law-03 — DeepJudge AHP: agent-to-agent handoff on top of MCP
- URL: https://www.lawnext.com/2026/08/deepjudge-releases-an-open-protocol-for-passing-users-and-their-context-between-ai-products-with-harvey-and-thomson-reuters-on-board.html
- Kind: web / axis: law
```
When asked how AHP differs from MCP, Kilcher said AHP is built on top of MCP and is not intended to replace it. Harvey has already announced that it is building an integration implementing the protocol, which will enter beta this month, and Thomson Reuters says it will support it in CoCounsel for Legal, with details on its implementation and timing still to come.
```

## f-law-04 — Trellis adds ChatGPT plugin + Trellis Chat beside Claude MCP
- URL: https://www.lawnext.com/2026/08/having-already-launched-a-claude-connector-trellis-extends-ai-access-to-its-court-data-with-chatgpt-plugin-and-its-own-chat-tool.html
- Kind: web / axis: law
```
Trellis, a legal research company that provides state trial court data and insights, has expanded agentic AI access to its data with a new plugin for OpenAI's ChatGPT and a native assistant called Trellis Chat, both of which are in addition to the Trellis MCP connector for Claude that the company launched in May.
```

## f-law-05 — Refute: USPTO ODP four-field gate and petition includeDocuments 500s still hold
- URL: https://patent.dev/heads-up-complete-your-uspto-profile-by-august-18/
- Kind: web / axis: law
```
Since June, the Open Data Portal requires a registered USPTO.gov account. Now four profile fields have become mandatory: Job Title, Organization Name, Organization Type, and Intended Use. The deadline is August 18, 2026. If the fields are missing, your API access may be interrupted.
```

## f-effect-01 — Effect Schema.mutable fixed for encoded arrays; pipe order matters
- URL: https://github.com/Effect-TS/effect/pull/7519
- Kind: github / axis: effect
```
Placing Schema.mutable after Schema.withDecodingDefaultType in a schema pipe causes runtime errors when decoding to the default and does not correctly infer a mutable decoded type. The confirmed intended usage is Schema.Array(...).pipe(Schema.mutable, Schema.withDecodingDefaultType(...)); any later placement of Schema.mutable should be rejected, ideally with a compile-time error.
```

## f-effect-02 — Jazz resets sync wire to v1 and hardens per-replica node identity
- URL: https://github.com/garden-co/jazz/pull/2330
- Kind: github / axis: effect
```
Reset the sync wire protocol to v1. Freeze nested catalogue envelopes at v1. Persist a unique node identity per browser replica. Safely reuse foreground node identities.
```

## f-effect-03 — Refute: drizzle TaggedErrorClass break still open
- URL: https://github.com/drizzle-team/drizzle-orm/issues/6162
- Kind: github / axis: effect
```
[BUG]:Deprecated TaggedErrorClass syntax incompatible with Effect v4 release candidates. state: open. updated_at: 2026-08-25T17:32:17Z. comments: 3.
```

## f-effect-04 — Refute: Instant Cloud sunset 2027-08-31 still holds
- URL: https://www.instantdb.com/essays/instant_team_joins_openai
- Kind: web / axis: effect
```
The Instant team is joining OpenAI. Instant Cloud runs until August 31st, 2027.
```

## f-effect-05 — Refute: still on effect@4.0.0-rc.112; no rc.113 yet
- URL: https://github.com/Effect-TS/effect/releases/tag/effect%404.0.0-rc.112
- Kind: github / axis: effect
```
@effect/*@4.0.0-rc.112 Pre-release published 2026-08-25. No newer effect@4.0.0-rc.113 release tag present.
```

## f-agents-01 — RedEvoAgent: red-team skill evolution with a validation ratchet
- URL: https://arxiv.org/abs/2608.27439
- Kind: arxiv / axis: agents
```
We propose RedEvoAgent, a black-box red-teaming agent that distills cross-case attack trajectories into a concise, human-readable attack skill. The attack skill adaptively evolves through tool-effectiveness profiling and Deciding-Tool Attribution for skill updates, and a validation ratchet that retains only updates improving validation performance.
```

## f-agents-02 — Contract-centered agentic runtime: Skill / Harness / Scaffold
- URL: https://arxiv.org/abs/2608.27086
- Kind: arxiv / axis: agents
```
We present four responsibility objects as shared organizational contracts: Skill (reusable, versioned capability and workflow asset), Harness (runtime compiler and governor), Scaffold (execution/control boundary and NFR owner), and a stack-external data substrate under independent CIO-governed semantics and telemetry. The runtime core is A = <S, H, X>.
```

## f-agents-03 — MCP Enterprise Interest Group charter merged
- URL: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2626
- Kind: github / axis: agents
```
docs(community): Add Enterprise Interest Group charter. Merged 2026-08-29. Adds docs/community/enterprise-ig/charter.mdx.
```

## f-agents-04 — webMCP: compile human intent into a bounded WebMCP tool contract
- URL: https://github.com/HarzerHeribert/webMCP
- Kind: github / axis: agents
```
A compiler from human intent to a live, bounded WebMCP tool contract. Relay CRM is the host demo.
```

## f-agents-05 — Refute: SEP-2640 still open; skill-contract fork unsettled
- URL: https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2640
- Kind: github / axis: agents
```
SEP-2640: Skills Extension. State: OPEN. updatedAt: 2026-08-25T22:57:35Z. Extension identifier: io.modelcontextprotocol/skills.
```
