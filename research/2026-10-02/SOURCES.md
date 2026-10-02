# Sources — 2026-10-02 nightly

Short sanitized excerpts only. Canonical links. No tokens / high-entropy secrets.

## Law

### Clio × Learned Hand
- https://www.clio.com/about/press/clio-acquires-learned-hand-judiciary-ai/
- https://www.lawnext.com/2026/09/clio-acquires-learned-hand-giving-its-new-judiciary-business-an-existing-product.html

```
Clio today announced the acquisition of Learned Hand, an AI company building
technology specifically for judges and courts. The acquisition marks Clio's
first direct expansion into the judiciary.
```

### California SB 574
- https://www.gov.ca.gov/2026/09/30/californias-nation-leading-ai-framework-just-got-stronger-governor-newsom-signs-more-first-in-the-nation-worker-protections-and-more/
- https://leginfo.legislature.ca.gov/faces/billTextClient.xhtml?bill_id=202520260SB574
- https://www.hklaw.com/en/insights/publications/2026/10/california-enacts-rules-governing-lawyers-use-of-generative-ai

```
Keeping lawyers responsible for practicing law by prohibiting them from fully
handing over core legal work, such as drafting briefs or providing legal
judgment, to AI.
```

```
Effective January 1, 2027, the law imposes duties concerning confidentiality,
AI output verification, court disclosure and citation verification.
```

### Harvey–Everlaw MCP (HOLD)
- https://www.harvey.ai/blog/harvey-everlaw-evidence-ediscovery

```
We expect the integration to be available to joint Harvey and Everlaw customers
in fall 2026.
```

### iManage / Thomson Reuters MCP (HOLD) + Oct platform GA
- https://imanage.com/resources/resource-center/news/imanage-thomson-reuters-atrategic-partnership-governed-ai-legal-workflows/
- https://imanage.com/resources/resource-center/news/imanage-announces-general-availability-next-generation-platform/

```
MCP support enabling approved Thomson Reuters AI tools to reason from governed
content in the iManage platform will be coming soon.
```

```
The next-generation iManage platform will be generally available in October 2026.
Playbook-based review, tabular review, and MCP read and write actions are
available today.
```

### Patlytics MCP (HOLD)
- https://www.patlytics.ai/blog/patlytics-mcp-patent-intelligence-now-available-in-claude-and-chatgpt

```
The integration is read-only, secure, and scoped to each user's organization,
bringing patent intelligence into the AI tools attorneys already use.
```

### USPTO ODP (HOLD)
- https://data.uspto.gov/support/faq

```
When prompted to complete your profile, you will be asked to provide the
following four fields: Job Title, Organization Name, Organization Type,
Intended Use.
```

## Effect / local-first

### effect@4.0.0 + #8577 + LTS blog
- https://www.npmjs.com/package/effect/v/4.0.0
- https://github.com/Effect-TS/effect/pull/8577
- https://effect.website/blog/releases/effect/40

```
dist-tags: latest=4.0.0; rc=4.0.0-rc.118
time 4.0.0 = 2026-10-01T03:11:28.537Z
#8577 merged_at = 2026-10-01T01:43:42Z
```

```
Bug fixes until September 2029, or one year after 5.0 ships, whichever is later.
Security fixes until September 2029, or two years after 5.0 ships, whichever is later.
```

### Zero / Evolu / Jazz
- https://www.npmjs.com/package/@rocicorp/zero
- https://www.npmjs.com/package/@evolu/common
- https://www.npmjs.com/package/jazz-tools/v/2.0.0-alpha.58

```
@rocicorp/zero dist-tags: canary=1.11.0-canary.22; head=1.11.0-head-4d68a11e-20261002
@evolu/common latest=8.15.1 (8.15.1 time 2026-10-01T22:20:48Z)
jazz-tools alpha=2.0.0-alpha.58 (unchanged since 2026-09-30)
```

### drizzle #6162 + Instant sunset (HOLD)
- https://github.com/drizzle-team/drizzle-orm/issues/6162
- https://www.instantdb.com/essays/instant_team_joins_openai

```
[BUG]: Deprecated TaggedErrorClass syntax incompatible with Effect v4 release
candidates — still OPEN
```

```
On August 31st, 2027, all cloud apps will shut down. Backups will stay available
for 12 more months, until August 31st, 2028.
```

## Agents / MCP / skills

### MCP / SEP gates (HOLD)
- https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3306
- https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3004
- https://github.com/modelcontextprotocol/go-sdk/pull/1238
- https://github.com/modelcontextprotocol/python-sdk/pull/3485
- https://github.com/modelcontextprotocol/typescript-sdk/pull/2818

```
#3306 state=open mergeable_state=blocked
#3004 state=closed merged_at=null
go#1238 open/dirty; py#3485 open; ts#2818 open draft
```

### arXiv (window)
- https://arxiv.org/abs/2610.01564 — APEX / Chaining Skills
- https://arxiv.org/abs/2610.01349 — PACE
- https://arxiv.org/abs/2610.01506 — MCRI
- https://arxiv.org/abs/2610.01833 — Continuous process-level eval
- https://arxiv.org/abs/2609.39607 — Pretext
- https://arxiv.org/abs/2609.39450 — ActionGuard

```
APEX: chains induce the selected action in 512 of 690 attempts (74.2%).
On GPT-5.4, the full chain succeeds in 84.3% of attempts, compared with 17.4%
when the workflow is merged into one skill.
```

```
PACE: Vetting an artifact before admission does not settle this. A safe variant
and a leaking variant can look the same at admission time.
```

## Friction
- user-X `search_posts_all` + `search_news`: **client-not-enrolled** (Appropriate Level of API Access) — no X excerpts this run.
