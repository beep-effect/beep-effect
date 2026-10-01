# Nightly research packet — 2026-10-01

Window: `2026-09-30T08:19:00-05:00` → `2026-10-01T08:19:00-05:00` (~24h). Thursday — **no** Sunday weekly consolidation / tombstone reaper. Prior: research/2026-09-30 PR #1358 merged ~2026-10-01 1:21 AM CT. Blinded front-half; no clone / no PR.

## Delta-first

### New (window)
- **Effect tip BREAK (major):** `#8577` MERGED 2026-10-01 → **`effect@4.0.0` stable** published as npm `latest` (~03:11Z). **No `4.0.0-rc.119`** ever published; `rc` dist-tag still points at `4.0.0-rc.118` while tip consumers should track **4.0.0 LTS**.
- **Zero canary.20 → canary.21**; head tip **`1.11.0-head-*-20261001`**.
- **Evolu `@evolu/common` 8.12.0 → 8.14.0** (via 8.13.0 same evening).
- **Clio acquires Learned Hand** (judiciary AI; LA Superior Court + multi-state pilots) — LawNext + PR Newswire Sep 30.
- **California SB 574 signed** Sep 30 — attorneys may not delegate practice of law to genAI; verify/correct outputs; restrict confidential inputs.
- **arXiv skill-security wave (Sep 30):** Pretext `2609.39607`, ActionGuard `2609.39450`, TrustProbe `2609.39065`, Hiding-in-Plain-Sight `2609.39352`, SkillSeek `2609.38822`.

### Moved / contradicted (HOLD breaks)
- Effect tip **rc.118 → 4.0.0 stable** (prior `#8577`/rc.119 staging HOLD broken — jumped past rc).
- Zero canary / head retargeted (**.21** / **20261001**).
- Evolu tip retargeted (**8.14.0**).

### Settled (still standing HOLDs — reconfirmed)
- USPTO ODP four-field gate (FAQ); Harvey–Everlaw MCP fall 2026; iManage/TR MCP coming soon; jazz-tools alpha.58; Instant sunset 2027-08-31; drizzle `#6162` OPEN (now more urgent post-4.0.0); MCP `#3306` blocked; SEP-3004 closed-unmerged; SEP-2640 Tier-1 SDKs still OPEN (go/py/ts); Patlytics MCP Claude+ChatGPT foil.

### Quiet / unchanged vs prior packet
- Legora UK Scholars / Munich / newsroom — **no newer posts** in window (excluded from re-report).
- iManage ChatGPT plugin — no new GA-change signal (excluded).

## Topical appendix

### Law / legal-AI
Window press is **judiciary OS (Clio×Learned Hand)** + **state statute (CA SB 574)**, not AmLaw firm-wide or Legora DACH follow-ons. Cross-vendor MCP GA clocks (Harvey↔Everlaw fall 2026; iManage↔TR coming soon) unchanged. USPTO four-field still mandatory via ODP FAQ. Patlytics remains soft IP-MCP foil for Tom/solo.

### Effect / local-first
Biggest window event: **Effect 4.0.0 stable LTS** after `#8577` merge — tip consumers should leave the rc channel. Local-first: Zero + Evolu moved; Jazz stalled at alpha.58. drizzle TaggedError `#6162` still OPEN against now-stable Effect 4; Instant sunset unchanged.

### Agents / MCP / skills
Spec Final still ≠ SDK ship. Sep 30 papers push **scanner evasion (Pretext)**, **execution-boundary auth (ActionGuard)**, **taint/trust chains (TrustProbe)**, **pretext/actuation decoupling**, and **marketplace-scale skill retrieval (SkillSeek)** — governance literature again outpaces Tier-1 SDK merges. X pool blocked (client-not-enrolled).

## Counts
25 claims (14 window_new / 14 refute); law8 / effect8 / agents9. Novelty exclusion_collision_pct **36.0%** (gate ≤40%). RUN **partial** (X client-not-enrolled).
