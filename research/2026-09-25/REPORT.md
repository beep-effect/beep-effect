# Nightly research packet — 2026-09-25

Window: `2026-09-23T08:57:00-05:00` → `2026-09-25T08:17:00-05:00` (America/Chicago, ~47h; 2026-09-24 blocked by open PR #1215 which merged ~3:50 PM CT).  
Prior: `research/2026-09-23` / PR #1215 (merged). Status: **partial** (X client-not-enrolled).  
Friday — no Sunday consolidation.

## Delta-first

### New (window)

- **Legora enterprise cluster** (Sep 23–25): Bradley firm-wide (>750 lawyers / 13 offices, Sep 23); ALI Restatements content partnership (Sep 23); Veolia Group Legal (Sep 24); Brodies LLP first Scotland-HQ firm after firm-wide pilot (Sep 25); Justice Connect pro bono / access-to-justice rollout (Sep 25). AmLaw + UK/IE + in-house + NGO OS signal in one window. [f-law-04] [f-law-05] [f-law-06] [f-law-07] [f-law-09]
- **Everlaw 2026 Legal AI Adoption Report** (Sep 24, with ACEDS/ILTA): 49% genAI use (+12pp YoY); half say billing already altered or will be within a year; only 3% deploy autonomous agents but ~30% pilot multi-agent systems. Reinforces Everlaw evidence-layer positioning. [f-law-08]
- **HEXIS** (arXiv 2609.30123, Sep 24): compiles Agent Skills into extended FSMs separating knowledge from control flow; +16.1pp avg vs Skill+ReAct across 4 benches/4 executors. Structured skill IR / compliance rising edge. [f-agents-03]
- **Persistent Billable State / DoW** (arXiv 2609.28585, Sep 23): first systematic Denial-of-Wallet study via retained tool returns; max CAF 14,293×; only 71/3830 public MCP repos show safeguard proxy; host-side D1–D4 pre-reingestion kernel. [f-agents-04]
- **Approval Laundering** (arXiv 2609.28586, Sep 23): durable approval records name entry invocations but omit transitive effects; effect-bound records cut residuals 10→3; Claude Code PreToolUse PoC. Complements SEP-2640 permission gates. [f-agents-05]
- **Progressive Skill Discovery** (arXiv 2609.28693, Sep 23): role-scoped capability delivery as structural access control vs prompt-only policies. Intersects IntentCap / Stochastic Deputy. [f-agents-06]
- **Plugin-migration skill eval** (arXiv 2609.30120, Sep 24): higher diagnostic score ≠ target-version contract satisfaction — eval foil for skills-over-MCP quality gates. [f-agents-07]
- **Smart-contract auditing skills study** (arXiv 2609.29454, Sep 24): domain-skill design evidence for Claude Code / Codex. [f-agents-08]
- **ARGUS** (arXiv 2609.30184, Sep 24): role-aware event KGs from CourtListener employment-discrimination complaints (5W1H + legal-domain models). Law×agents ontology edge. [f-agents-09]
- **Effect main merge wave** continues under pre-mode (e.g. #8533 Preserve Effect.repeat result types merged Sep 25) while #8336→rc.118 still unshipped. [f-effect-02]
- **Effect #8292** HttpApi QUERY ops in Swagger/Scalar still OPEN (updated Sep 25) — docs/codegen surface for QUERY not yet in tip. [f-effect-08]
- **Zero canary HOLD broken** — see Contradicted; retargeted as window_new + refute. [f-effect-06]

### Moved / refreshed (no tip break)

- Effect **#8336** updated repeatedly in-window (last ~6:15 AM CT Sep 25) but **still OPEN** — tip remains **rc.117**; body still lists effect@4.0.0-rc.118. Main keeps moving under pre-mode. [f-effect-01] [f-effect-02]
- SEP-2640 Tier-1 SDKs still OPEN with Sep 23–24 activity: go#1238 (updated Sep 23), python#3485 (Sep 24, blocked), ts#2818 still draft (Sep 24). Spec Final≠SDK ship. [f-agents-02]
- Evolu **#708** refreshed Sep 24; `@evolu/common@8.11.0` still unpublished (npm latest 8.10.0). [f-effect-05]

### Settled (unchanged from prior admit)

- Prior #1215 (research/2026-09-23) **MERGED** 2026-09-24 ~3:50 PM CT — unblocks this packet. Never auto-merge.
- Prior retire/add rows from #1215 WATCHLIST (A2M, PayPal ZT, GraphSkillEvo, Cimplifi, Zero-head, MCP Infra WG, SEP-3371) still await human admit of ledger patch on main; this packet proposes further updates on top.
- SEP-3004 remains **CLOSED unmerged** (no reopen) — no dedicated re-cite this packet.

### Unchanged HOLDs (refute quota re-checked live)

- USPTO ODP four-field gate still mandatory (patent.dev secondary confirmation; support SPA empty via fetch). [f-law-01]
- iManage/TR CoCounsel MCP still “coming soon”. [f-law-02]
- Harvey–Everlaw MCP still “fall 2026” (not GA). [f-law-03]
- Effect tip still **rc.117**; #8336→rc.118 still OPEN. [f-effect-01]
- Instant Cloud sunset still **2027-08-31**. [f-effect-03]
- drizzle `#6162` TaggedErrorClass still OPEN (frozen since 2026-08-25). [f-effect-04]
- Evolu `#708` still OPEN; `@evolu/common@8.11.0` unpublished. [f-effect-05]
- jazz-tools alpha tip still **2.0.0-alpha.56**. [f-effect-07]
- SEP-2640 Tier-1 SDK ship still OPEN (go#1238 / py#3485 / ts#2818). [f-agents-02]
- MCP `#3306` Enterprise IdP docs still OPEN (mergeable_state blocked). [f-agents-01]

### Contradicted

- **Zero canary HOLD broken:** prior “canary.11 static (watch head)” no longer holds. dist-tag canary advanced **canary.11 → canary.12 (Sep 23) → canary.13 (Sep 24)**; head tip now `1.11.0-head-16ef0358-20260925`. Retarget watch to canary.13 + daily head. [f-effect-06]

## Counts

| metric | value |
| --- | --- |
| total claims | 26 |
| window_new | 16 |
| refute | 11 |
| law / effect / agents | 9 / 8 / 9 |
| novelty (unique claim URL ∩ exclusion) | 38.5% (10/26) — gate ≤40% pass |
| novelty among window_new | 6.25% (1/16; Zero registry URL re-cite on HOLD break) |

## Topical appendix

### IP-law / legal-AI

~47h window after #1215 merge: standing DMS/MCP clocks (iManage coming-soon; Harvey–Everlaw fall 2026) unchanged. Competitive delta is a **Legora adoption cluster** (Bradley AmLaw firm-wide, ALI Restatements ontology grounding, Veolia in-house, Brodies Scotland HQ, Justice Connect pro bono) plus **Everlaw 2026 Adoption Report** (49% genAI; billable-hour pressure; multi-agent pilots ~30%). USPTO four-field ODP gate still blocks casual API-key automation. ARGUS employment-discrimination event KGs (arXiv 2609.30184) supply a law×agents ontology foil.

### Effect-TS / schema-first / local-first

Tip day still quiet on publish: **rc.117** holds; **#8336→rc.118** staged and refreshed Sep 25 but unmerged despite heavy main merge wave (#8533 etc.). Local-first **contradiction**: Zero canary thawed to **.13** with head on 20260925 — prior canary.11 HOLD broken. Jazz/Evolu/Instant/drizzle HOLDs flat. HttpApi QUERY Swagger/Scalar (#8292) still OPEN for rc.118 inclusion watch.

### Agents / MCP / skills

Skills / governance research spike: **HEXIS** (FSM compile), **DoW / Persistent Billable State**, **Approval Laundering**, **Progressive Skill Discovery**, plugin-migration eval, smart-contract auditing skills, plus **ARGUS** legal event KGs. Spec/SDK ship gates unchanged: SEP-2640 Tier-1 SDKs still OPEN; MCP `#3306` still blocked. Complements prior A2M / PayPal ZT / GraphSkillEvo theme from #1215.

## Watchlist patch note (publisher)

See `WATCHLIST_PATCH.md` + `LEDGER_PATCH.md` sidecars. **Update** w-zero-canary → canary.13 (HOLD broken) and w-zero-head → 20260925 tip; keep/refresh Effect #8336 / rc.117 and standing HOLDs with Sep 25 evidence dates; **add** consolidated Legora cluster + Everlaw Adoption Report + HEXIS / DoW / Approval Laundering / Progressive Skill Discovery / ARGUS (arXiv ids); draft until human merge of `research/2026-09-25`.
