# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## External Landscape (researched 2026-06-18)

Three `deep-research` tracks plus direct primary-source fetches. Tracks 1 and 3
were re-run sequentially and this file reflects those verified reruns. Track 2's
rerun output was empty, so the original successful synthesis is retained. Full
reports and citations live in [`research/`](./research/):
[`01-ip-prosecution-docketing.md`](./research/01-ip-prosecution-docketing.md),
[`02-court-litigation-outlook.md`](./research/02-court-litigation-outlook.md),
[`03-official-data-handroll.md`](./research/03-official-data-handroll.md).
Vendor ownership, API access, pricing, and government-source limits are in flux;
re-verify the flagged items before committing code.

### The four-layer frame (how the research resolves it)

Docketing is **four independently build-vs-buy layers**. The approval gate is the
stable seam: every layer emits a *candidate* the attorney approves.

| Layer | Verdict from research | Why |
|---|---|---|
| **L1 — Event source / truth feed** | **Mostly HAVE / integrate (open)** | US patents via **USPTO ODP** (already wrapped by `@beep/uspto`, but poll **one-at-a-time per API key**); TM via **TSDR**; foreign via **EPO OPS**; litigation via **CourtListener webhooks + hosted MCP**. PACER itself has no usable public retrieval API. |
| **L2 — Rules engine (deadline math)** | **Narrow HANDROLL first; BUY as redundancy** | The malpractice-grade layer. Narrow US-deterministic handroll (maintenance fees, §133/§136, PCT, TM post-reg) is defensible as approval-gated candidate math cross-checked against ODP/TSDR/`ptmnfee2`; broad foreign/litigation handroll is not. BUY candidates: **CPI** (best IP API, headless OAuth2), **LawToolBox** (court, partner-gated), **Alt Legal** (TM, sales-gated API). |
| **L3 — Agent / approval orchestration** | **BUILD (the moat; half-built)** | No vendor offers candidate-only writes + evidence spans + an Effect SDK. Already have `CandidateTask`, `ApprovalGate`, `ContextPacket`, `EmailArtifact`. |
| **L4 — Reminder / escalation / Outlook sync** | **BUILD orchestration, REUSE `m365-driver`** | Outlook push depends on the graduated [`m365-driver`](../../goals/m365-driver/README.md) goal (`@beep/m365`). Docketing is the concrete driver for the future `Calendars.ReadWrite` write scope. Reminders/escalation/dead-man's-switch are NET-NEW. |

### Decision matrix — agent-integratable candidates (survivors of the API gate)

| Candidate | Layer | API for agents | Rules engine | Outlook fit | Solo price | Verdict |
|---|---|---|---|---|---|---|
| **USPTO ODP** (`@beep/uspto`) | L1 patent | REST + API key; **burst=1/no concurrency** | — | push via `@beep/m365` | free | **Adopt (have)** — patent event source, sequential poller |
| **CourtListener / RECAP** | L1 litigation | **REST v4.4 + Docket Alert webhooks + hosted MCP** | — | push via `@beep/m365` | tight free tier | **Adopt** — use webhooks over polling |
| **TSDR / EPO OPS / WIPO** | L1 TM/foreign | REST/OAuth (SOAP for WIPO), poll | — | push via `@beep/m365` | free/fair-use | adopt as scope expands |
| **Narrow US rules module** | L2 (build) | n/a (ours) | US-deterministic only | — | $0 | **Build as first slice** (candidate-gated, ODP-checked) |
| **Computer Packages (CPI)** | L2 buy | **REST + due-date endpoint + OAuth2 password grant for unattended calls** | Patent/TM/Annuity | data-only (we push) | enterprise-sales | **strongest L2 BUY**; verify commercial access |
| **Alt Legal** | L2 buy (TM) | first-party API, docs/auth sales-gated | TM auto-sync via TSDR | data-only | **$60/mo/50 matters** | #2; TM-first, TSDR SPOF |
| **LawToolBox** | L2 buy (court) | REST + recalc + rule-change poll | court-rules + recalc | add-ins (we bypass, push via `@beep/m365`) | ~$35–42/user/mo, gated | best **court** buy *(partner-gated)* |
| **Clio Manage** | L2 buy (court) | open V4 API | CalendarRules | via Clio | PM platform | court fallback (open API) |

**Disqualified for agents (no usable public deadline API):** **AppColl**
(explicit no-API policy despite great rules engine + USPTO auto-sync + $100/mo
solo price), **Clarivate FoundationIP/IPfolio** (public API is bibliographic IP
Data API, not docketing), **PATTSY WAVE/Anaqua** (marketing-only API claims),
**Dennemeyer DIAMS iQ** (demo-gated partner API, though its foreign-rules engine
is serious), **CourtAlert**, and **CalendarRules** (B2B-embedded only). **Docket
Alarm** has an API but is docket *monitoring*, not a rules engine.

### Cross-track verdict

- **Best single L2 BUY if buying:** **CPI** for IP (public REST docs, due-date
  resource, patent/TM/annuity engine, OAuth2 password grant documented for
  unattended calls) and **LawToolBox** for court (recalc + pull API) — both
  *data/engine via API, Outlook push owned by us*. Caveat: commercial access is
  still enterprise/partner-gated; **Alt Legal** is the closest solo-accessible
  real-API option but is **trademark-first** (patents = manual entry) and TSDR is
  a single point of failure.
- **A narrow US-deterministic HANDROLL is a defensible first slice:** maintenance
  fees + §133/§136 response periods + PCT national-phase + TM post-registration,
  computed as *candidates*, cross-checked against ODP/TSDR ground truth,
  approval-gated. The rules are few and statutory; the data sources exist; the
  candidate doctrine contains the liability.
- **The danger line for handrolling:** foreign annuities, multi-jurisdiction
  extension chains, litigation/court-rules, and any discretionary period — past
  that, buy the engine or keep the attorney as the engine.
- **Polling is the norm except CourtListener.** ODP is especially strict:
  one-at-a-time per key, no fan-out. CourtListener's free REST quota is too tight
  for polling, so use Docket Alert webhooks and monitor replay/disable state.

## In-Repo Capability Inventory

Verified against the current `microsoft-365` branch (2026-06-18). Confirm exact
export paths with ripgrep / `repo-symbol-discovery` before composing.

- **HAVE — `@beep/uspto`** (`packages/drivers/uspto/src/Uspto.service.ts`): ODP
  driver — `getApplication`, `getContinuity`, `getDocuments`, `searchApplications`,
  `downloadDocument`; models capture `docketNumber`, `filingDate`, status. **The
  L1 patent event source, already built.** Design the poller around ODP's
  verified burst=1/no-concurrency rule: sequential calls per API key, no fan-out.
  Re-verify ODP-Beta / legacy Developer Hub sunset details before build.
- **HAVE — governance kit** (`packages/workspace/domain/src/entities/`):
  `CandidateTask`, `ApprovalGate`, `ContextPacket`, `EmailArtifact` (with source
  spans). **The L3 candidate-only / approval-gate spine.**
- **HAVE — connector abstraction** (`packages/shared/domain/src/identity/Shared`,
  `.../entity/Principal.ts`, `.../entity/SourceKind.ts`): `ConnectorAccountId`,
  `ConnectorAccountPrincipal`, `SourceKind.Connector` — first-class connector
  actor for provenance/audit.
- **HAVE — `@beep/libpff`** (`packages/drivers/libpff`): Outlook PST export
  (historical mail/calendar ingest); pairs with `EmailArtifact`.
- **HAVE — substrate**: `@beep/schema` DateTime codecs (`DateTimeFromMillis`,
  `DateTimeEncoded`); `@beep/nlp` + `@beep/wink` date/entity extraction;
  `@beep/onepassword-cli` for secrets (the `USPTO_API_KEY` precedent — same
  pattern for TSDR/EPO/CourtListener keys); `apps/professional-desktop` (Tauri +
  PGlite) host.
- **HAVE — thin — `law-practice` slice** (`packages/law-practice/domain/src/entities/`):
  `Matter`, `PatentAsset`, `LegalClient`, `LegalContact`. The extension point —
  but `Matter` has **no deadline fields** yet.
- **ACTIVE GOAL DEPENDENCY — `@beep/m365`**: the Outlook/Graph transport has
  graduated into [`goals/m365-driver`](../../goals/m365-driver/README.md) (native
  Effect Microsoft Graph driver) and
  [`goals/m365-mcp`](../../goals/m365-mcp/README.md) (read-side MCP exposure).
  Docketing's L4 Outlook push depends on `m365-driver` and is the concrete driver
  for adding the `Calendars.ReadWrite` write scope after the read-only first
  driver lands.
- **NOT FOUND (NET-NEW):**
  - `OfficeAction` / `FilingEvent` / `Deadline` / `TriggeringEvent` entities in
    `law-practice/domain` (documented in goal docs, **not implemented**).
  - Any **deadline-rules / deadline-math engine** in repo. The broader "no
    production-grade open-source rules engine" finding is inferential from
    earlier hand research and should be refreshed before implementation.
  - Calendar-event / **reminder** / recurrence / **notification** models
    (`packages/foundation/primitive/data/src/Calendar.ts` is date *constants*
    only — not a scheduler).
  - **Dead-man's-switch / heartbeat** scheduler for "prove the deadline check
    ran."
  - TSDR / EPO OPS / WIPO / CourtListener drivers (only ODP exists today).

## Constraints Discovered

- **Malpractice-grade reliability.** A silently-stopped reminder job is as bad as
  a wrong date; for events *years* out the dominant failure mode is the job
  failing to run, not the math — hence a **dead-man's-switch** is mandatory, not
  optional.
- **Local-first / privilege.** Privileged client data stays local (PGlite); any
  vendor adopted must permit **data export / an authoritative local copy** and a
  delegated/attributable auth model (mirrors the M365 packet's posture).
- **Polling, not push.** Every official source except CourtListener is poll-only,
  and ODP forbids same-key concurrency. The freshness/SLA model must budget for
  poll latency and sequential request scheduling.
- **Source churn / re-verify flags.** PEDS retirement is complete (2025-03-14).
  Re-verify ODP-Beta **2026-05-29** and legacy Developer Hub **2026-06-05**
  sunset details, TSDR API-key + 60 req/min claims, and EPO fair-use quota before
  build. CalendarRules→Clio and Docket Alarm→Clio acquisitions are recent.
- **Doctrine.** The product must remain a **vigilance overlay, not the docket
  system of record** (locked — see [`DECISIONS.md`](./DECISIONS.md) and
  [`CAPTURE.md`](./CAPTURE.md)). Adopting a vendor means the *vendor* is the
  docket of record; handrolling means the *attorney's existing tool* stays the
  record and we mirror approved candidates.
- **No MCP server from any docketing vendor.** CourtListener is the exception in
  the broader L1 landscape with an official hosted MCP; CPI, Alt Legal,
  LawToolBox, and the IPMS vendors do not offer MCP. Any bought engine is
  REST-over-our-own-driver, optionally exposed through Beep's MCP pattern.
