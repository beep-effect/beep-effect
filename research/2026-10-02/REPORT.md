# Nightly research packet — 2026-10-02

Window: `2026-09-30T08:19:00-05:00` → `2026-10-02T08:16:00-05:00` (~48h). Friday — **no** Sunday weekly consolidation / tombstone reaper. Prior successful: research/2026-09-30 PR #1358 merged. Closed-unmerged this cycle: research/2026-10-01 PR #1391 (claims copied into `research/ledger/excluded-packets/2026-10-01.jsonl`). Writer stage blinded at written_at (no clone / no PR / no CloudAgent). Publisher opened PR #1403.

## Delta-first

### New (window)
- **Effect tip BREAK (major, absorb + verify):** `#8577` MERGED 2026-10-01 → **`effect@4.0.0` stable** as npm `latest` (~03:11Z). **No `4.0.0-rc.119`**. Official blog documents **LTS ≥3y** (bug/security floors Sep 2029). New open `#8647` Version Packages appears post-stable (watch only).
- **Zero canary.21 → canary.22** (2026-10-02T04:25Z); head tip **`1.11.0-head-*-20261002`** — fresh past closed #1391.
- **Evolu `@evolu/common` 8.14.0 → 8.15.1** (via 8.15.0) — fresh past closed #1391.
- **Clio acquires Learned Hand** (judiciary AI) — Sep 30 Clio press + LawNext; still live Oct 2.
- **California SB 574 signed** Sep 30 + **Holland & Knight Oct 1 compliance alert** (effective Jan 1, 2027 duties).
- **iManage next-gen October GA calendar now open** (MCP read/write on iManage server available today) while **iManage↔TR CoCounsel MCP** remains **coming soon**.
- **arXiv Oct 1 skill wave:** APEX/Chaining Skills `2610.01564`, PACE `2610.01349`, MCRI `2610.01506`, process-level enterprise eval `2610.01833`.
- **arXiv Sep 30 skill-security absorb (never landed via #1391):** Pretext `2609.39607`, ActionGuard `2609.39450` (+ SkillSeek / Hiding-in-Plain-Sight noted in appendix).

### Moved / contradicted (HOLD breaks)
- Effect tip **rc.118 / rc.119 staging → 4.0.0 stable LTS**.
- Zero canary retargeted **.21 → .22**; head **20261001 → 20261002**.
- Evolu tip retargeted **8.14.0 → 8.15.1**.
- iManage platform GA clock enters **October** (split from TR-partnership MCP).

### Settled (still standing HOLDs — reconfirmed Oct 2)
- USPTO ODP four-field gate; Harvey–Everlaw MCP fall 2026; iManage/TR MCP coming soon; Patlytics MCP Claude+ChatGPT foil; jazz-tools alpha.58; Instant sunset 2027-08-31; drizzle `#6162` OPEN (more urgent post-4.0.0); MCP `#3306` blocked; SEP-3004 closed-unmerged; SEP-2640 Tier-1 SDKs still OPEN (go/py/ts).

### Quiet / unchanged vs prior packets
- Legora UK Scholars / Munich / AmLaw cluster — no newer newsroom posts in Oct 1–2 sweep (excluded from re-report).
- Harvey $550M / $15.5B round is Sep 9 — **outside window** (not claimed).
- X pool blocked (client-not-enrolled) — no social corroboration.

## Topical appendix

### Law / legal-AI
Window press is **judiciary OS (Clio×Learned Hand)** + **CA SB 574 statute + Oct 1 practitioner alerts**, plus the **iManage Oct platform-GA vs TR-MCP coming-soon split**. Cross-vendor MCP GA clocks (Harvey↔Everlaw fall 2026; iManage↔TR coming soon) unchanged. USPTO four-field still mandatory. Patlytics remains soft IP-MCP foil for Tom/solo.

### Effect / local-first
Biggest settled event: **Effect 4.0.0 stable LTS** after `#8577`. Local-first: Zero + Evolu moved again past the closed 10-01 packet; Jazz still stalled at alpha.58. drizzle TaggedError `#6162` still OPEN against now-stable Effect 4; Instant sunset unchanged.

### Agents / MCP / skills
Spec Final still ≠ SDK ship (`#3306` blocked; SEP-3004 closed-unmerged; SEP-2640 go/py/ts OPEN). Literature accelerating: **APEX cross-skill approval laundering** (74% ASR) + **PACE provenance enforcement** + **MCRI skill evaluation** + Sep 30 **Pretext/ActionGuard** scanner/auth cluster. X unavailable.

## Counts
25 claims (15 window_new / 10 refute|hold_update); law8 / effect8 / agents9. Canonical novelty exclusion_collision_pct **62.5%** (15/24 unique claim URLs ∩ `research/ledger/excluded-packets/2026-10-01.jsonl`; over the ≤40% gate). Window-new URL collisions **40.0%** (6/15): SB574, effect@4.0.0, #8577, shared Zero package URL, Pretext, ActionGuard. The Clio press URL is not in the excluded packet. RUN **partial** (X client-not-enrolled). Excluded packet holds 25 claims from closed PR #1391.
