# Nightly research packet — 2026-09-27

Window: `2026-09-25T08:17:00-05:00` → `2026-09-27T08:19:00-05:00` (America/Chicago, ~48h; 2026-09-26 correctly skipped — stamp under 24h after #1261).  
Prior: `research/2026-09-25` / PR #1261 (merged ~10:57 AM CT Sep 25). Status: **partial** (X client-not-enrolled).  
**Sunday** — weekly consolidation included below.

## Delta-first

### New (window)

- **Evolu #708 MERGED + `@evolu/common@8.11.0` published** (Sep 26 ~3:45 PM CT): local sync between named DBs, `syncState` ReadonlyStore, broadcast helpers. Prior "unpublished" HOLD **broken / settled**. [f-effect-02] [f-effect-07] [f-effect-08]
- **Zero canary.13 → canary.15**; head tip `1.11.0-head-7ebeb217-20260926`. Second consecutive canary advance after last packet's .11→.13 break. [f-effect-03]
- **jazz-tools alpha.56 → alpha.57** (Sep 26 ~11:30 PM CT prior evening / 04:30Z). Wire-v2 upgrade discipline continues. [f-effect-04]
- **Beri GC buyer guide** (Sep 26; prices checked Sep 27): CoCounsel for Westlaw research, Legora for most legal-dept contracts/diligence (Agent Pro metered by project), Harvey strongest product / worst GC buyer terms; Legora citator still limited beta → Q4 GA; Charlotin hallucination DB at 2,079. [f-law-04]
- **HAQQ 50-point rubric** soft foil: Harvey ~38 / CoCounsel ~37 / Legora ~35 — content-moat framing. [f-law-05]
- **ChatGPT plugin fabric**: Legora research plugin via MCP + Everlaw evidence plugin both live for joint customers — while Harvey↔Everlaw MCP and iManage/TR MCP remain fall-2026 / coming-soon. [f-law-06] [f-law-07]
- **Vera Legora ontology/citator analysis** + Gemini MCP beta note. [f-law-08]
- **SpecHarness** (arXiv 2609.29921): State Authority Principle — agents propose, runtime commits; SkillsBench Pass +12pp, S–A gap −20pp. [f-agents-03]
- **Instrumental Monitor Evasion** (arXiv 2609.30217) + instrumental-evasion.com: EvasionBench best-of-3 attempt ≤98% / success ≤88% under ordinary task pressure. [f-agents-04] [f-agents-05]
- **Skills-over-MCP explainers** (DEV + API Evangelist) + ext-skills canonical home soft captures. [f-agents-06] [f-agents-07] [f-agents-09]

### Moved / refreshed (no tip break)

- Effect **#8336** updated Sep 27 ~2:54 AM CT — still OPEN staging rc.118; tip still **rc.117**; mergeable_state=clean but unmerged. [f-effect-01]
- SEP-2640 Tier-1 SDKs still OPEN (go#1238 behind / py#3485 blocked / ts#2818 draft). [f-agents-02]
- MCP `#3306` Enterprise IdP docs still OPEN/blocked (frozen since Sep 22). [f-agents-01]

### Settled (this window)

- Evolu unpublished HOLD → **shipped** (`@evolu/common@8.11.0`). Retarget watch to tip 8.11.0 / post-ship churn.
- Prior #1261 (research/2026-09-25) **MERGED** 2026-09-25 ~10:57 AM CT — unblocks this packet. Never auto-merge.

### Contradicted

- **Zero canary.13 HOLD broken** → canary.15 + head 20260926.
- **jazz-tools alpha.56 HOLD broken** → alpha.57.
- **Evolu 8.11.0 unpublished HOLD broken** → published.

### Unchanged HOLDs (refute quota re-checked live)

- USPTO ODP four-field gate still mandatory. [f-law-01]
- iManage/TR CoCounsel MCP still "coming soon". [f-law-02]
- Harvey–Everlaw MCP still "fall 2026" (not GA). [f-law-03]
- Effect tip still **rc.117**; #8336→rc.118 still OPEN. [f-effect-01]
- Instant Cloud sunset still **2027-08-31**. [f-effect-06]
- drizzle `#6162` TaggedErrorClass still OPEN (frozen since 2026-08-25). [f-effect-05]
- SEP-2640 Tier-1 SDK ship still OPEN. [f-agents-02]
- MCP `#3306` still OPEN/blocked. [f-agents-01]
- SEP-3004 remains **CLOSED unmerged** (no reopen). [f-agents-08]

## Counts

| metric | value |
| --- | --- |
| total claims | 25 |
| window_new | 16 |
| refute | 12 |
| law / effect / agents | 8 / 8 / 9 |
| novelty (unique claim URL ∩ exclusion) | 40.0% (10/25) — gate ≤40% pass |
| novelty among window_new | 6.2% (1/16; Evolu #708 GitHub settle re-cite) |

## Weekly consolidation (Sunday)

Trends across `research/2026-09-22` → `09-23` → `09-25` → this `09-27` packet (~Sep 17–27 effective coverage; 09-24/09-26 skipped for open-PR / stamp gates):

### Week trends

1. **Local-first tip churn accelerated.** Week opened with Zero canary.11 / jazz alpha.56 / Evolu 8.11.0 unpublished. By Sunday: Zero **canary.15**, jazz **alpha.57**, Evolu **8.11.0 shipped**. Instant sunset date untouched. drizzle #6162 frozen.
2. **Effect tip stalled on rc.117.** #8336 has been OPEN staging rc.118 since Sep 21; refreshed daily through Sep 27 with clean mergeability but no cut. Main continues under pre-mode (unstable path removal + http-api rename already merged earlier in the week).
3. **Legal MCP fabric: split clocks hardened.** Harvey↔Everlaw fall 2026 + iManage/TR coming soon reconfirmed every packet. Meanwhile ChatGPT Enterprise plugins for Everlaw evidence and Legora research are live — plugin path outrunning cross-vendor MCP GA. Legora AmLaw/enterprise cluster (Bradley/ALI/Veolia/Brodies/Justice Connect) from mid-week still the competitive adoption signal; Sunday adds buyer-guide / pricing / citator-beta framing.
4. **Skills / governance research wave continued.** Mid-week: A2M, PayPal ZT, HEXIS, DoW, Approval Laundering. Weekend: SpecHarness (spec authority) + Instrumental Monitor Evasion (ordinary-task pressure bypass). Theme: Final SEP-2640 ≠ shipped SDKs; runtime governance papers keep outpacing protocol merge velocity.
5. **SEP-2640 SDK ship gate still closed.** go/python/ts PRs open all week with conformance-green claims but blocked/behind/draft. SEP-3004 closed-unmerged Sep 22 stayed closed. MCP #3306 Enterprise IG docs frozen.

### Recurring frictions (week rollup)

| friction | 09-22 | 09-23 | 09-25 | 09-27 |
| --- | --- | --- | --- | --- |
| X client-not-enrolled | yes | yes | yes | yes |
| local gh bad creds / rate-limit | yes | yes | yes | unused-by-design |
| npmjs.com Cloudflare → registry JSON | yes | yes | yes | yes |
| USPTO support SPA empty shell | — | — | yes | yes (patent.dev secondary) |
| arXiv export empty-on-HTTP | — | once | — | once (HTML list fallback) |

### Tombstone reaper summary

Across SUGGESTED_ACTIONS of 09-22 / 09-23 / 09-25, **pure reconfirm capture URLs** that appeared in all three packets and remain unactioned (proposals only; never admitted to ledger via capture) are proposed for tombstone:

- Standing HOLD reconfirm noise: USPTO support / patent.dev, iManage partnership page, Harvey–Everlaw blog, Instant essay, drizzle #6162, Effect #8336, MCP #3306, go-sdk #1238, Evolu #708 (now settled — tombstone the *unpublished* capture habit; keep tip watch), jazz/zero registry root URLs (superseded by version-specific tips).

See `TOMBSTONES_PATCH.jsonl` for structured rows (url, reason, first_seen, last_seen, runs_unactioned). Human admits. Do not auto-append explorations/INBOX.

## Topical appendix

### IP-law / legal-AI

~48h quiet on vendor GA flips: DMS/MCP clocks unchanged. Competitive delta is **buyer-side framing** (Beri Sep 26 / Sep 27 price check; HAQQ rubric) plus **ChatGPT plugin fabric** (Everlaw evidence + Legora research live) against still-pending Harvey↔Everlaw MCP and iManage/TR MCP. Legora citator remains limited beta → Q4 GA. USPTO four-field ODP gate still blocks casual API-key automation.

### Effect-TS / schema-first / local-first

Publish day for local-first, stall day for Effect tip: **Evolu 8.11.0 / Zero canary.15 / jazz alpha.57** all moved Sep 26; Effect **rc.117** + **#8336→rc.118** still uncut as of Sep 27 morning. Instant sunset and drizzle TaggedError HOLDs flat.

### Agents / MCP / skills

Spec/SDK ship gates unchanged. New research edge: **SpecHarness** (who may establish specification-governed state) and **Instrumental Monitor Evasion** (ordinary task pressure → adaptive PreToolUse bypass). Complements prior week's Approval Laundering / DoW / HEXIS cluster. Skills-over-MCP Final still waiting on Tier-1 SDK merges.

## Watchlist patch note (publisher)

Proposed ledger edits in `WATCHLIST_PATCH.md` and stamp draft in `LEDGER_PATCH.md` (draft until human merge of `research/2026-09-27`). **Update** Zero → canary.15 / head 20260926; jazz → alpha.57; Evolu → shipped 8.11.0; Effect #8336 / rc.117 evidence dates; **add** Beri buyer-guide, SpecHarness, Instrumental Evasion, ChatGPT plugin fabric rows. Never auto-merge.
