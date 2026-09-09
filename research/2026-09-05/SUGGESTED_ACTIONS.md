# SUGGESTED ACTIONS -- 2026-09-05

Executable captures. Human admits. Do not auto-append to explorations/INBOX.md or goals/.
Derived from claims.jsonl (17 findings). An item graduates when a human fires its capture command.

## Priority (PROMPT kickoffs)

These six match PROMPT.md plus the captures named for this packet. Capture first if you only fire a few.

### f-law-01 -- Harvey-Everlaw MCP evidence bridge announced Sep 3; fall 2026 joint availability

Harvey Team blog dated 2026-09-03 (after 08:49 CT stamp) announces a partnership with Everlaw building an MCP integration so joint users can query and retrieve Everlaw evidence (including multi-million-document matters) from Harvey, with outputs cited back to source documents. First phase of a longer partnership; future work includes bringing user-defined Everlaw subsets into Harvey. Expected availability to joint...

```
bun run beep research capture https://www.harvey.ai/blog/harvey-everlaw-evidence-ediscovery --tags law,harvey,everlaw,mcp,ediscovery
```

### f-agents-03 -- HookPry: attacker-controlled lifecycle-hook updates steer agent harnesses

arXiv 2609.03884 (submitted 2026-09-03T14:08:42Z, in-window) identifies the lifecycle-hook update path as a supply-chain attack surface: under plugin-metadata + hook-config control only, a benign versioned plugin can be trojanized by an update that binds attacker shell commands to benign events (session start, tool calls, file edits) outside the LLM path. Author-reported HookPry: 10 objectives; 1,000 runs / 25 har...

```
bun run beep research capture https://arxiv.org/abs/2609.03884 --tags agents,harness,plugins,supply-chain
```

### f-agents-05 -- SWE-Gate: functional tests miss review-constraint compliance for coding agents

arXiv 2609.04167 (submitted 2026-09-03T17:53:34Z, in-window) introduces SWE-Gate: 303 repository-level repair instances across 75 Python repos with separate executable functional and review-constraint tests derived from real PR review comments. Author-reported under a common Mini-SWE-Agent scaffold: among 644 functionally successful repairs across four LLM backends, 221 (34.3%) fail constraint validation (hidden f...

```
bun run beep research capture https://arxiv.org/abs/2609.04167 --tags agents,coding-agents,harness,benchmark
```

### f-agents-01 -- SEP-2640 Accepted by Core Maintainers; still OPEN toward final

Standing SEP-2640 / skills-over-MCP refute MOVES then HOLDS. On 2026-09-03T22:32:50Z (in-window; window start 13:49Z), sponsor @pja-ant commented that Core Maintainers Accepted SEP-2640 and work now moves toward Final (needs reference implementation, conformance tests, and ext-skills repo + docs). gh: state=OPEN, merged_at=null, labels still [SEP, draft, extension], updated_at=2026-09-03T22:32:50Z. Not merged; dis...

```
bun run beep research capture https://github.com/modelcontextprotocol/modelcontextprotocol/pull/2640 --tags agents,mcp,skills,sep-2640
```

### f-effect-04 -- Jazz #2361 alpha.54 pkg.pr.new RC CLOSED obsolete; release path moves to #2118 Changesets stack

Standing Jazz alpha.54 RC watchlist MOVES. garden-co/jazz#2361 (alpha.54 release candidate) CLOSED unmerged on 2026-09-04T01:01:19Z. Maintainer aeplay: closing the old pkg.pr.new release-candidate shell as obsolete; authoritative path is now the consolidated release stack plus official Changesets alpha preview. Supporting packaging tip garden-co/jazz#2118 (Release alpha.54 from the consolidated release stack) rema...

```
bun run beep research capture https://github.com/garden-co/jazz/pull/2361 --tags jazz,local-first,alpha-54
```

### f-effect-02 -- Effect MCP #7265 still OPEN after 2026-09-04 adapter commits; HOLD+MOVED

Standing Effect MCP 2026-07-28 adapter watchlist HOLDS on release (unpublished pending rc.113) but MOVES on body: Effect-TS/effect#7265 remains OPEN (updated_at=2026-09-04T20:15:48Z; mergeable_state=blocked; +7990/-1601 across 50 files). In-window commits add MCP lifecycle runtimes/request context, McpProtocol.v2026_07_28 adapter, multi-round-trip tool results (InputRequired), subscriptions/listen, and JSON-valued...

```
bun run beep research capture https://github.com/Effect-TS/effect/pull/7265 --tags effect,mcp,schema,tool-contracts
```

## Remainder

### f-law-02 -- Refute: USPTO ODP four-field gate still holds (live Sep 5)

Standing USPTO ODP four-field watch HOLDS on live check 2026-09-05. data.uspto.gov Support and Getting Started still banner that effective 2026-08-18 users must supply Job Title, Organization Name, Organization Type, and Intended Use or lose ODP products/API key; FAQ still lists the same four fields as required. No ...

```
bun run beep research capture https://data.uspto.gov/support --tags law,uspto,odp,refute
```

### f-law-03 -- Iceland public-law MCP PoC: Lagasafn/courts/EEA read-only routing (created Sep 4)

Repo gunnaroi/iceland-context-mcp-poc was created 2026-09-04T10:51:11Z (inside window) as a public-only MCP PoC for authoritative Icelandic legal and EEA context. Framing: MCP is a read-only routing/retrieval layer, not the system of record; every live retrieval carries publisher provenance and legal-status warnings...

```
bun run beep research capture https://github.com/gunnaroi/iceland-context-mcp-poc --tags law,mcp,github,iceland,public-law
```

### f-law-06 -- Refute: iManage/TR CoCounsel MCP still coming soon (not GA)

Standing legal-DMS MCP / iManage-TR partnership watch HOLDS on live primary 2026-09-05. iManage press page still states API-based integrations with CoCounsel Legal, HighQ, Contract Express, Noetica and Legal Tracker are available today, while MCP support enabling approved Thomson Reuters AI tools to reason from gove...

```
bun run beep research capture https://imanage.com/resources/resource-center/news/imanage-thomson-reuters-atrategic-partnership-governed-ai-legal-workflows/ --tags law,imanage,thomson-reuters,cocounsel,mcp,refute
```

### f-law-08 -- Refute: Everlaw-CoCounsel wording still future-facing (will be able)

Standing Everlaw-CoCounsel watch HOLDS on live check 2026-09-05. Everlaw blog dated 2026-09-01 still uses future-facing copy: users of Everlaw and CoCounsel Legal will be able to access Everlaw matters and data directly in CoCounsel; no GA/date-certain language added since the Sept 1 claim. Same pattern as Harvey-Ev...

```
bun run beep research capture https://www.everlaw.com/blog/ai-and-law/everlaw-and-thomson-reuters-cocounsel-partnership/ --tags law,everlaw,thomson-reuters,cocounsel,refute
```

### f-effect-01 -- Refute: effect@4.0.0-rc.112 holds; Changesets #7446 still stages unpublished rc.113 (updated 2026-09-05)

Standing SchemaBinary/rc.112 watchlist HOLDS. Checked 2026-09-05: GitHub Releases newest effect@ tag remains effect@4.0.0-rc.112 (published 2026-08-25T00:02:03Z). npm dist-tags.rc remains 4.0.0-rc.112; registry returns 404 for effect@4.0.0-rc.113. Changesets PR Effect-TS/effect#7446 still OPEN (updated_at=2026-09-05...

```
bun run beep research capture https://github.com/Effect-TS/effect/pull/7446 --tags effect,effect-v4,rc,changesets
```

### f-effect-03 -- Refute: drizzle TaggedErrorClass break still open (no update since 2026-08-25)

Standing drizzle Schema.TaggedErrorClass claim HOLDS. Checked 2026-09-05: drizzle-team/drizzle-orm#6162 remains OPEN (closed_at=null, comments=3). Last issue update still 2026-08-25T17:32:17Z; no close or fix merge in the 2026-09-03T13:49Z-2026-09-05T13:20Z window. effect-core still cited as calling Schema.TaggedErr...

```
bun run beep research capture https://github.com/drizzle-team/drizzle-orm/issues/6162 --tags effect,drizzle,TaggedErrorClass
```

### f-effect-05 -- Jazz #2583 merges V1 settlement for unreleased storage/schema/ResultKey formats before alpha.54

garden-co/jazz#2583 MERGED 2026-09-05T07:22:53Z settles unreleased authoritative formats on V1 ahead of alpha.54 (explicitly not a freeze declaration yet). RocksDB namespace/value marker/raw profile: unreleased V3 to one V1 contract (obsolete physical roots rejected). Schema identity domain: jazz-schema-v3-large-val...

```
bun run beep research capture https://github.com/garden-co/jazz/pull/2583 --tags jazz,local-first,wire-v1,schema
```

### f-effect-06 -- Effect #7908 SchemaJITCompiler: experimental opt-in runtime schema compiler (draft, open)

Effect-TS/effect#7908 (Schema compiler) opened by gcanti near window edge (created 2026-09-03T13:47:44Z) and heavily updated in-window through 2026-09-05T08:59:39Z. Draft PR (+5448/-603, 50 files, 33 commits, label 4.0) introduces experimental opt-in SchemaJITCompiler under effect/unstable/schema: import enable inst...

```
bun run beep research capture https://github.com/Effect-TS/effect/pull/7908 --tags effect,schema,jit,effect-v4
```

### f-effect-08 -- Refute: Instant Cloud sunset 2027-08-31 still holds (live 2026-09-05)

Standing Instant Cloud sunset watchlist HOLDS. Re-fetched 2026-09-05: official essay unchanged - new Instant Cloud signups closed; existing users migrate within 12 months; all cloud apps shut down 2027-08-31; backups through 2028-08-31. Homepage banner still: Instant is sunsetting. Services will continue until Augus...

```
bun run beep research capture https://www.instantdb.com/essays/instant_team_joins_openai --tags instant,local-first,sunset
```

### f-agents-02 -- Refute HOLD: MCP #3306 Enterprise IdP / ID-JAG docs still OPEN

Standing MCP Enterprise IG watch HOLDS on #3306. Document identity provider support for enterprise managed auth remains state=OPEN, merged_at=null (checked 2026-09-05). updated_at=2026-09-01T05:43:54Z is before this window (start 2026-09-03T13:49Z); no in-window merge. Prior #2626 charter and #3321 nav already merge...

```
bun run beep research capture https://github.com/modelcontextprotocol/modelcontextprotocol/pull/3306 --tags agents,mcp,enterprise-ig,auth,refute
```

### f-agents-04 -- Cisco skill-scanner #210 modernizes core detection with shadow CEL layer

cisco-ai-defense/skill-scanner#210 feat(scanner)!: modernize core detection merged 2026-09-03T18:31:42Z (in-window). Adds versioned protobuf ScanFacts, official cel-go v0.32.0 decision layer after deterministic detection and before optional LLM/Meta, policy modes off/shadow/enforce; all eight bundled CEL rules remai...

```
bun run beep research capture https://github.com/cisco-ai-defense/skill-scanner/pull/210 --tags agents,skills,security,scanner
```

