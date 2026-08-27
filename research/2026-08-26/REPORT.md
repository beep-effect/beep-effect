# REPORT — 2026-08-26

First supervised packet. Window 2026-08-25 22:22 → 2026-08-26 22:22 America/Chicago (48h fallback). Status: **partial** (X search blocked: `client-not-enrolled`). 34 claims. Collision rate 0 (empty ledger). No standing claims to refute.

## Delta

### New

- **Legal-AI competitors shipped models and MCP in the same week.** RelativityOne connected to Gemini Enterprise for Legal over MCP (2026-08-25). Thomson Reuters launched Thomson 1.0 (Qwen 3.5 post-trained on Westlaw/Practical Law) and generally released next-gen CoCounsel Legal with Deep Research Verify plus a Claude MCP. Harvey shipped Tenet (Kimi K3 post-train) and Harvey II matter memory. Spellbook closed the Word-export gap with an in-agent multi-document editor.
- **USPTO ODP now gates Office Action APIs.** Effective 2026-08-18, four profile fields are required or API keys are revoked. OA text lives at `api.uspto.gov/api/v1/patent/oa/` with daily refresh. Petition `includeDocuments` still 500s. Directly blocks or shapes `uspto-prosecution-read`, OA extraction, and PTMNFEE ingest.
- **Effect v4 rc.112 made SchemaBinary the cluster wire.** `effect@4.0.0-rc.112` (2026-08-25) added SchemaBinary; #7461 (2026-08-26) removed MessagePack. EventLog now retries transient remote writes (#7401). Workflow discard endpoints return execution IDs (#7428). Same day Effect compressed the in-repo jsdocs skill (#7479).
- **Drizzle × Effect v4 is broken in the wild.** drizzle-orm#6162: `effect-core` still calls `Schema.TaggedErrorClass` after Effect renamed it. Unpublished 1.0.0-rc.5 snapshots throw on undefined RQB v2 filters (#6180). Intersects open beep PR #852 (effect-drizzle kits).
- **Local-first vendor shock.** Instant's team joined OpenAI; Instant Cloud sunsets 2027-08-31. Evolu 8.6.1 fixed null-column sync. Jazz landed a trusted React Native relay admission ABI. AgentRoom (arXiv 2608.23740) is a CRDT+MCP shared filesystem for concurrent coding agents.
- **MCP skill/harness layer moved.** StarHarness (2608.24804) evolves skills/MCP/subagent harnesses around frozen weights (+20–35pp). PayPal SCOUT (2608.23992) hybrid-retrieves 2k+ MCP tools (140.2k → 1.3k tokens). Skills-over-MCP WG merged the Agent Plugins (disk) vs SEP-2640 (wire) analysis (PR #120, 2026-08-25). MCP Python SDK patched FastMCP breakage across v2.1.0/2.1.1/v2.0.1. Claude Code v2 now negotiates the 2026-07-28 spec; OpenClaw maps Cursor/Claude/Codex/Agent Plugin bundles.
- **MCP trust is time-shifted.** TrustShiftProbe (2608.23763): compromised servers stay honest for N calls then defect; 69.5% ASR across six agents including Grok-4.3. Install-time SKILL.md scanners miss it.
- **Ontology/neural-symbolic: constraints-before-LLM.** Bosch CGM (2608.24218) uses hard constraints as hypothesis-space operators (~480× shrink; F1 0.08→0.66 from the gate, not the LLM).
- **Patent drafting and USPTO labels.** Dis2Pat (2608.21249) is a disclosure-to-complete-application benchmark with a local multi-agent baseline. ClaimGAT (2608.21924) treats claim dependency as a graph. Y02 green-patent labels are systematically wrong at corpus scale (2608.23420, −25.5% after correction). Nightshift (new OSS) says a top-50 embedding shortlist still misses 59.7% of examiner-applied anticipatory refs.

### Moved

None. First packet.

### Contradicted

None standing. Two cautions for existing goals, not contradictions of prior packets: CPC Y02 is not safe ground truth; USPTO ODP is no longer anonymous.

### Settled

None.

## Intersections with today's repo-replay

Semantica C0 + grok-4.6 gold-v1 (#849/#842) sits next to StarHarness / HypoForge / CGM (harness and constraint gates, not weight updates). Open #853 (park extraction after C0 breaker) should read TrustShiftProbe before trusting long-lived MCP providers. Packet-system-redesign reopen (#850) and yeet cheap-gates (#837/#845) rhyme with SCOUT meta-tools and kilo-kit C4 gates. HttpApi catalog (#847) and Effect discard-ID / SchemaBinary are the same schema-as-wire story. Open #852 is the Drizzle TaggedErrorClass break. Doctest runtime-lane marks (#844/#843/#838) match Effect's jsdocs skill compression.

## Frictions

- X search is connected but API-forbidden (`client-not-enrolled`). Resume cursor in `RUN.json`.
- No Sol/Luna verify seat in this harness.
- GitHub MCP DCR is broken; `gh` + cloud agent published this packet.

## Appendix — topical notes

Law: competitor stack is now "own the model + own the MCP + verify citations." USPTO access got stricter. Public patent-drafting evals (Dis2Pat, Nightshift, ClaimGAT) are usable gold for `patent-drafting-episode-ledger` and `citation-extraction-engine`.

Effect: SchemaBinary replacing MessagePack is the v4 wire decision. Local-first is splitting into "self-host or die" (Instant) vs "binary codec + retry" (Effect EventLog, Evolu, Jazz ABI).

Agents: the skill contract is forking (disk plugins vs wire SEP-2640) while hosts (Claude Code v2, OpenClaw bundles) already implement both. Hybrid tool retrieval and harness evolution are the production patterns, not bigger prompts.
