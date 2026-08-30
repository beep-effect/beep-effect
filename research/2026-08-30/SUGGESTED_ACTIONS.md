# SUGGESTED ACTIONS — 2026-08-30

Executable captures. Human admits. Do not auto-append to `explorations/INBOX.md` or `goals/`.
Derived from `claims.jsonl` (21 findings). An item graduates when a human fires its capture command.

## Priority (PROMPT kickoffs)

These six match `PROMPT.md` plus the methods/DMS captures named for this packet. Capture first if you only fire a few.

### f-law-04 — USPTO OED In re Mitchell (D2026-16): first AI-predicated discipline for intrinsic-record hallucinations

USPTO OED posted its first generative-AI-predicated discipline order (~2026-08-27; IPWatchdog 2026-08-28): In re Brian E. Mitchell, D2026-16. Hallucinated citations were to the intrinsic record (specification, figures, prosecution history) of the patent in suit, not case law. OED found competence, diligence, misrepresentation, and prejudice to the administration of justice; a second reviewing model did not discharge the duty. Citation-verification products and beep #871 verified-span / citation-extraction-engine must treat in-file-wrapper cites, not only Westlaw/Lexis.

```
bun run beep research capture https://ipwatchdog.com/2026/08/28/uspto-issues-its-first-ai-predicated-discipline-order-involving-hallucinated-cites-to-intrinsic-record/ --tags law,uspto,oed,citation,duty-of-care
```

### f-agents-02 — Rayrun implements SEP-2640 draft skills/list+get with SHA-256 digests

Rayrun docs dated 2026-08-29 advertise io.modelcontextprotocol/skills on both MCP endpoints and implement the current SEP-2640 draft: skills/list + skills/get, SHA-256 digests, immutable revisions, resources/read. CI tests protocol 2026-07-28. allowed-tools frontmatter is not authorization — actual authority is tool policy. Treat as a host implementation of the draft, not a SEP vote. Direct foil for skill-contract-kernel / mcp-kit.

```
bun run beep research capture https://ray.run/docs/skills --tags agents,mcp,skills,sep-2640,rayrun
```

### f-effect-01 — Refute: effect@4.0.0-rc.112 holds; Changesets #7446 stages unpublished rc.113

Standing SchemaBinary/rc.112 watchlist HOLDS on the published line and MOVES because Changesets #7446 (OPEN, title Version Packages (rc), last update 2026-08-28T17:16Z) now stages unpublished effect@4.0.0-rc.113 and the matching @effect/* rc.113 set. Latest published tags remain 4.0.0-rc.112 (2026-08-25). Do not pin beep cluster transport or effect-v4 kits on an unmerged Changesets PR.

```
bun run beep research capture https://github.com/Effect-TS/effect/pull/7446 --tags effect,effect-v4,rc,refute
```

### f-law-05 — Thomson Continual Learning methods paper (arXiv 2608.27147)

Thomson: Continual Learning of Frontier Models for SovereignAI (arXiv 2608.27147) is the missing methods paper behind Thomson 1.0. Final Thomson-1.0-Large training run conservatively under USD 450,000; total program ~USD 40M. Harvey LAB 85.7 vs Opus 4.8 86.9. Continual Learning on open-weight Qwen checkpoints, not from-scratch pretrain. Moves w-legal-models-2026-08 from launch URLs to a citable methods artifact.

```
bun run beep research capture https://arxiv.org/abs/2608.27147 --tags law,thomson,continual-learning,arxiv,competitor
```

### f-law-06 — Legora↔NetDocuments MCP: Legal Context Graph into agentic work

Legora (press 2026-08-26, missed yesterday) wired NetDocuments through MCP so the Legal Context Graph — documents, matters, parties, ethical walls intact — feeds agentic review and drafting. NetDocuments remains the system of record; each Legora search inherits DMS permissions. Continues the 08-28 DMS write-back / Gemini connector graph with a second major DMS MCP (after iManage).

```
bun run beep research capture https://legora.com/newsroom/legora-deepens-its-netdocuments-partnership-to-bring-governed-institutional-knowledge-into-agentic-legal-work --tags law,legora,netdocuments,mcp,dms
```

### f-agents-06 — experimental-ext-skills#132 ratifies v1 decision log

experimental-ext-skills#132 (updated 2026-08-28) ratifies three Proposed decision-log entries to Accepted, aligning the log with the SEP-2640 baseline: resources/directory/read; skills/get; v1 scope (archives dropped; per-file resources with digests; skills/list + skills/get). Writes down the accepted v1 wire shape that Rayrun implemented. Disk Agent Plugins vs this wire remains a fork until #2640 closes.

```
bun run beep research capture https://github.com/modelcontextprotocol/experimental-ext-skills/pull/132 --tags agents,mcp,skills,sep-2640
```

## Remainder

### f-law-01 — Refute: USPTO ODP four-field gate and petition includeDocuments 500s still hold

Standing USPTO ODP claim HOLDS. Live data.uspto.gov banner still mandates four profile fields as of 2026-08-18; patent.dev essay unchanged through this window: Job Title, Organization Name, Organization Type, and Intended Use remain mandatory or ODP products/API keys revoke; not settable via API. Prior live check that GET petition decisions with includeDocuments=true returns HTTP 500 across 2004-2026 is not walked back. No in-window USPTO fix. uspto-prosecution-read / OA extraction / PTMNFEE still gated.

```
bun run beep research capture https://patent.dev/heads-up-complete-your-uspto-profile-by-august-18/ --tags law,uspto,odp,refute
```

### f-law-02 — Croatian e-Oglasna court-noticeboard MCP (public API, store-nothing)

AvoccadoTech/legal-mcp-croatia (created 2026-08-29T07:27Z; bankruptcy views pushed 2026-08-30) is a read-only MCP over Croatia's e-Oglasna ploča sudova: public government API, no key, no account, store-nothing, log-nothing. Tools cover notice search, full notice, PDF download, court list, plus company_bankruptcies and personal_bankruptcies views. Foil for gov-legal-mcp / court-reporter vocabulary: a public-court MCP that never holds the firm's lookup list.

```
bun run beep research capture https://github.com/AvoccadoTech/legal-mcp-croatia --tags law,mcp,court-data,croatia,gov-legal
```

### f-law-03 — Ambrogi ILTACON wrap: everyone MCP-ing; Harvey/Legora; Claude CoWork

Ambrogi's ILTACON wrap (LawNext 2026-08-28, missed yesterday) names the week: everyone is MCP-ing, API-ing, or otherwise integrating; Harvey and Legora owned the floor; the recurring answer to "where they work" was Anthropic's Claude CoWork. Partnerships and integrations, not another standalone chat wrapper, were the product theme. Completes the 08-26/28/29 legal-MCP fabric with the conference's own summary.

```
bun run beep research capture https://www.lawnext.com/2026/08/have-we-reached-peak-legal-tech-sure-felt-that-way-at-iltacon-this-week.html --tags law,iltacon,mcp,harvey,legora
```

### f-effect-02 — Refute: drizzle TaggedErrorClass break still open

Standing drizzle Schema.TaggedErrorClass claim HOLDS. drizzle-orm#6162 remains OPEN (closed_at=null, last update still 2026-08-25T17:32Z). No upstream fix in this window. beep #852 kits do not close it.

```
bun run beep research capture https://github.com/drizzle-team/drizzle-orm/issues/6162 --tags effect,drizzle,effect-v4,refute
```

### f-effect-03 — Refute: Instant Cloud sunset 2027-08-31 still holds

Standing Instant Cloud sunset watchlist HOLDS. Official essay unchanged: Instant Cloud runs until August 31st, 2027; backups through August 31st, 2028; new signups closed; self-host migration remains the path. No walk-back in this window.

```
bun run beep research capture https://www.instantdb.com/essays/instant_team_joins_openai --tags effect,local-first,instant,refute
```

### f-effect-04 — Effect #7524: Schema codecs for platform-neutral socket addresses

Effect #7524 (OPEN, opened/updated 2026-08-30) adds platform-neutral IPv4, IPv6, resolved internet, Unix path, and portable socket address values under effect/unstable/net/Net, plus effect/Schema codecs, and migrates HTTP/socket server address models. In-tree work that unpublished rc.113 would absorb. Relevant to beep box-driver / openai-driver sockets; do not assume it until an RC cuts.

```
bun run beep research capture https://github.com/Effect-TS/effect/pull/7524 --tags effect,effect-v4,schema,socket,net
```

### f-effect-05 — Effect #7514: in-place TLS socket upgrade

Effect #7514 (OPEN, updated 2026-08-30T07:23Z, in-window) adds in-place TLS wrapping to the Reader acquired from socket.reader. Each reader exposes { pull, upgrade } in the same scoped connection region. Transports that cannot wrap use SocketUpgradeError.unsupported. Continues the 08-28 Socket/TLS constructor work. Flag kits that assume a static TLS constructor if this lands in the next RC.

```
bun run beep research capture https://github.com/Effect-TS/effect/pull/7514 --tags effect,effect-v4,socket,tls
```

### f-effect-06 — Effect #7521: @effect/bun-test

Effect #7521 (OPEN, updated 2026-08-29T21:00Z) adds @effect/bun-test mirroring the @effect/vitest API (it.effect, it.live, layer, it.prop, flakyTest, utils) on bun:test instead of Vitest. Replacement for Effect-TS/effect-smol#2204 after the v4 merge-back. Watch for beep test-kit / bun runner alignment; not a pin until published.

```
bun run beep research capture https://github.com/Effect-TS/effect/pull/7521 --tags effect,effect-v4,bun-test,vitest
```

### f-effect-07 — Jazz #2347: replica-identity completion still OPEN

Jazz #2347 (OPEN, updated 2026-08-29T21:28Z) completes browser foreground identity and recovery. It now absorbs the work originally reviewed as #2345/#2346 (merged just before yesterday's stamp when those branches became ancestors). Wire v1 already landed; identity/recovery is the live follow-through for w-jazz-wire-v1.

```
bun run beep research capture https://github.com/garden-co/jazz/pull/2347 --tags effect,jazz,local-first,identity
```

### f-effect-08 — Jazz #2361: alpha.54 RC still OPEN

Jazz #2361 (OPEN, updated 2026-08-30T06:43Z) is the release-candidate-only PR for Jazz 2.0.0-alpha.54. Intentionally contains no product changes beyond an empty preview trigger; will restack onto the stable main release stack for pkg.pr.new plus adopter/example-app testing. Versioning follow-through on top of wire v1.

```
bun run beep research capture https://github.com/garden-co/jazz/pull/2361 --tags effect,jazz,local-first,rc
```

### f-agents-01 — Refute: SEP-2640 still OPEN (draft + SEP + extension)

Standing skills-over-MCP / SEP-2640 watchlist HOLDS (unsettled). modelcontextprotocol#2640 remains OPEN (draft + SEP + extension; identifier io.modelcontextprotocol/skills). In-window activity includes a comment that Rayrun implements the draft; that does not close the SEP. Disk Agent Plugins vs wire skills remains a live fork.

```
bun run beep research capture https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2640 --tags agents,mcp,skills,sep-2640,refute
```

### f-agents-03 — MCP #3321: Enterprise IG charter into interest-groups nav

modelcontextprotocol#3321 (OPEN, updated 2026-08-30T02:54Z) wires the Enterprise IG charter from #2626 into docs/community/interest-groups/ navigation. #2626 landed at docs/community/enterprise-ig/charter.mdx after charters were reorganized, so the page was not listed in docs.json. Moves w-mcp-enterprise-ig from charter-merged to nav-wiring.

```
bun run beep research capture https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3321 --tags agents,mcp,enterprise,governance
```

### f-agents-04 — Agents WG 2026-08-28: error provenance in payload, not mutated codes

MCP Agents WG notes (2026-08-28) settle error contracts for agent operations: operation-specific error codes are defined, reusing existing protocol codes where they fit, and error provenance belongs in the payload rather than mutated code numbers (no 402→4020 style offsets). Same schema-first error story as Structured ToolFailure (#3313).

```
bun run beep research capture https://github.com/modelcontextprotocol/agents-wg/blob/a7be70f1f5806949e2196bc0a9c2771f6a135a4d/meetings/2026-08-28.md --tags agents,mcp,agents-wg,errors
```

### f-agents-05 — experimental-ext-skills#126 catalogs spec followups

experimental-ext-skills#126 (OPEN, updated 2026-08-30T03:03Z) recaps recurring Agent Skills spec topics from 13 Skills-over-MCP sessions (2026-03-17 through 2026-08-25): version, env contract, tool dependencies, and other gaps. Companion to the accepted v1 decision log (#132) and the still-open SEP-2640.

```
bun run beep research capture https://github.com/modelcontextprotocol/experimental-ext-skills/issues/126 --tags agents,mcp,skills,sep-2640
```

### f-agents-07 — MCP #3313 Structured ToolFailure SEP still OPEN

modelcontextprotocol#3313 (OPEN, updated 2026-08-27T21:59Z) is the formal SEP for Structured Tool-Failure Classification (ToolFailure), prototyped in #3312 and based on discussion #2930. Schema-first error SEP next to Agents WG payload-provenance. Placeholder SEP number 0000 pending assignment.

```
bun run beep research capture https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3313 --tags agents,mcp,errors,toolfailure
```
