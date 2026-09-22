# Sources — 2026-09-22

Sanitized short excerpts only. No tokens / high-entropy secrets.

## Law

### USPTO ODP Support FAQ
- https://data.uspto.gov/support
```
When prompted to complete your profile, you will be asked to provide the following
four fields: Job Title; Organization Name; Organization Type; Intended Use.
As of August 18, 2026, completing these fields will be required to continue
accessing ODP data products.
```

### iManage × Thomson Reuters partnership
- https://imanage.com/resources/resource-center/news/imanage-thomson-reuters-atrategic-partnership-governed-ai-legal-workflows/
```
API-based integrations … are available today. MCP support enabling approved
Thomson Reuters AI tools to reason from governed content in the iManage platform
will be coming soon.
```

### Harvey × Everlaw
- https://www.harvey.ai/blog/harvey-everlaw-evidence-ediscovery
```
Harvey and Everlaw are building an integration using the Model Context Protocol …
We expect the integration to be available to joint Harvey and Everlaw customers
in fall 2026.
```

### OpenAI Astra for Law (Legal IT Insider, 2026-09-17)
- https://legaltechnology.com/breaking-news-openai-unveils-astra-for-law/
```
OpenAI today (17 September) unveils Astra for Law … launches with 26 partner
plugins from providers including Thomson Reuters, Intapp, Harvey, Legora,
DeepJudge and iManage.
```

### Everlaw evidence-layer press
- https://www.everlaw.com/press/release/ai-partnerships-integrations-evidence-layer-for-litigation/
```
Harvey: … MCP integration is expected to be available to joint Everlaw and Harvey
customers in fall 2026. … Microsoft Copilot: … Everlaw MCP connector is expected
to be available in fall 2026.
```

## Effect / local-first

### Effect #8201 / #7908 / #8354 / #8365 / #8336
- https://github.com/Effect-TS/effect/pull/8201 — merged 2026-09-18T19:42:25Z (`effect@4.0.0-rc.116`)
- https://github.com/Effect-TS/effect/pull/7908 — merged 2026-09-18T10:43:11Z (SchemaJIT/AOT)
- https://github.com/Effect-TS/effect/pull/8354 — merged 2026-09-22T01:06:31Z (unstable → top-level)
- https://github.com/Effect-TS/effect/pull/8365 — merged 2026-09-22T11:39:04Z (`httpapi` → `http-api`)
- https://github.com/Effect-TS/effect/pull/8336 — OPEN staging `effect@4.0.0-rc.118`
```
#8354 migration: effect/unstable/http → effect/http;
effect/unstable/ai/LanguageModel → effect/ai/LanguageModel.
Old paths are not retained.
```

### npm tips (registry JSON, 2026-09-22)
- effect dist-tag `rc=4.0.0-rc.117` (published 2026-09-21T04:54:14Z); has rc.116 + rc.117
- jazz-tools dist-tag `alpha=2.0.0-alpha.56` (published 2026-09-21T00:48:24Z)
- @evolu/common latest `8.10.0` (no 8.11.0)
- @rocicorp/zero canary `1.11.0-canary.11` (published 2026-09-22T06:34:04Z)

### Evolu #708 / Instant / drizzle #6162
- https://github.com/evoluhq/evolu/pull/708 — OPEN, updated 2026-09-19T18:46:10Z
- https://www.instantdb.com/essays/instant_team_joins_openai
```
On August 31st, 2027, all cloud apps will shut down.
```
- https://github.com/drizzle-team/drizzle-orm/issues/6162 — OPEN, updated 2026-08-25T17:32:17Z

## Agents / MCP

### SEP-2640 + SDK gates
- https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2640 — still MERGED Final
- https://github.com/modelcontextprotocol/typescript-sdk/pull/2818 — draft OPEN (updated Sep 22)
- https://github.com/modelcontextprotocol/go-sdk/pull/1238 — OPEN (updated Sep 14)
- https://github.com/modelcontextprotocol/python-sdk/pull/3485 — OPEN blocked (updated Sep 21; claims conformance green)

### MCP #3306 / SEP-3004
- https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3306 — OPEN, updated frozen 2026-09-01
- https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3004 — CLOSED unmerged 2026-09-22T12:39:42Z

### arXiv RAC
- https://arxiv.org/abs/2609.23498 (submitted 2026-09-20)
```
We identify this failure mode "authorization drift." … Runtime Authorization
Consistency Checking (RAC), a lightweight guard at the controller-side
tool-call boundary.
```
