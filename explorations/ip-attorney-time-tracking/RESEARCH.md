# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

## 2026-06-18 External Landscape

### Definition of "top"

This packet uses separate definitions of "top" because attorney utility and
agent/developer utility diverge:

- **Solo/small-firm attorney fit:** legal matter/client billing, timers,
  invoices, trust/accounting boundaries, self-serve availability, and fit for a
  solo IP workflow.
- **Enterprise presence:** platforms sold into mid/large law firms with
  passive capture, compliance validation, prebill/e-billing, finance-system
  integrations, and Microsoft 365 or DMS adjacency.
- **Agent/developer usefulness:** public API docs, OAuth/API-key story,
  write-capable time-entry endpoints, webhooks, export formats, sandbox access,
  and whether an official or credible MCP path exists.

### Market Signal

Clio's 2025 Legal Trends benchmarks report a 38% utilization rate, 3.0
captured billable hours per lawyer per day, 88% realization, and 2.6 invoiced
hours per lawyer per day, which frames time leakage as a core legal-operations
problem rather than a mere UX problem ([Clio Legal Trends Benchmarks](https://www.clio.com/resources/legal-trends/benchmarks/)).

The ABA TechReport is the recurring source tied to the ABA Legal Technology
Survey and expert analysis, so it should be preferred over generic software
roundups when making legal-market claims ([ABA TechReport](https://www.americanbar.org/groups/law_practice/resources/tech-report/)).

LEDES defines legal e-billing and related exchange formats, including formats
for budgeting, timekeeper, rate, and IP matter-management data exchange
([LEDES](https://ledes.org/)). UTBMS maintains task-code resources including
patent prosecution code sets, so IP time-entry work should treat task-code
mapping as a first-class constraint ([UTBMS](https://utbms.com/)).

### Solo / Small-Firm Findings

Clio Manage is a strong small-firm integration candidate: its API documentation
exposes Activities for time and expense entries, and Clio's product pages
position legal billing around time tracking, expense tracking, LEDES billing,
split billing, invoices, and alternative fees ([Clio API reference](https://docs.developers.clio.com/clio-manage/api-reference/),
[Clio legal billing](https://www.clio.com/features/legal-billing-software/)).
Clio's public pricing page listed entry pricing starting at $49/user/month
when this packet was researched on 2026-06-18 ([Clio pricing](https://www.clio.com/pricing/)).

MyCase has a published Open API story, but MyCase states API access requires a
paid Advanced subscription, which makes sandbox/self-serve validation weaker
than a fully open developer program ([MyCase Open API](https://www.mycase.com/blog/cloud-saas-for-lawyers/how-to-use-mycases-open-api-to-get-more-of-your-time-back/)).

PracticePanther exposes a RESTful API and advertises converting calendar
events, tasks, emails, notes, texts, and calls into time entries, which makes it
interesting as a comparison point for automated leakage detection ([PracticePanther API](https://support.practicepanther.com/en/articles/479897-practicepanther-api),
[PracticePanther legal billing](https://www.practicepanther.com/legal-billing/)).

Smokeball's AutoTime records work in matters and its product materials
emphasize Word and Outlook integration, making it a strong attorney-user
baseline for passive capture even if developer openness is less obvious from
public docs ([Smokeball time tracking](https://www.smokeball.com/features/legal-time-tracking-software),
[Smokeball email integrations](https://www.smokeball.com/features/email-integrations/)).

TimeSolv focuses on legal time tracking and billing, publishes integrations
with NetDocuments, QuickBooks, Dropbox, and LawPay, and has an IP-practice page,
which makes it a relevant small-firm IP comparator ([TimeSolv](https://www.timesolv.com/),
[TimeSolv integrations](https://www.timesolv.com/resources/blog/saving-time-with-timesolvs-integration-features/),
[TimeSolv intellectual property](https://www.timesolv.com/business-type/attorney/intellectual-property/)).

Bill4Time publishes API documentation for time entries and describes one-click
timers, matter syncing, invoices, and prebill review; its support docs also
warn that some API versions are read-only, so write-path validation is needed
before choosing it as the first integration ([Bill4Time time entries API](https://secure.bill4time.com/apinode/v1/docs/timeentries),
[Bill4Time API overview](https://support.bill4time.com/hc/en-us/articles/27906381671963-API-Overview),
[Bill4Time](https://www.bill4time.com/)).

LeanLaw is deliberately tied to QuickBooks Online; Intuit's app and partner
materials make it especially relevant if the chosen doctrine is "QuickBooks is
the accounting source of truth, Beep is capture/prebill" ([LeanLaw](https://www.leanlaw.co/),
[LeanLaw on QuickBooks App Store](https://quickbooks.intuit.com/app/apps/appdetails/leanlaw/en-us/),
[Intuit on LeanLaw integration](https://quickbooks.intuit.com/r/innovation/leanlaw-deep-integration-with-quickbooks-for-any-legal-timekeeping-and-billing-app/)).

CosmoLex combines time tracking with billing, trust accounting, business
accounting, email, documents, calendar, and Office 365 integrations, so it is a
useful "all-in-one" boundary case for why Beep should not casually own the
ledger ([CosmoLex time tracking](https://www.cosmolex.com/features/time-tracking/),
[CosmoLex integrations](https://www.cosmolex.com/integrations/)).

### Mid / Large / Enterprise Findings

Intapp Time is the enterprise benchmark for AI-assisted and compliance-aware
timekeeping: Intapp describes AI-enabled time capture, compliance support, and
cloud timekeeping workflows for law firms ([Intapp Time](https://www.intapp.com/time-tracking/),
[Intapp Time Horizon Cloud](https://www.intapp.com/blog/time-horizon-cloud-legal-timekeeping/),
[Intapp AI time capture](https://www.intapp.com/blog/ai-time-capture-law-firms-3/)).

Aderant iTimekeep is the strongest public enterprise evidence for "AI plus
approval/compliance gates": Aderant describes AI and rule-based validation,
client billing requirements, AI narratives, automatic capture, predictive
client/matter assignment, and Outlook add-in support ([Aderant iTimekeep](https://www.aderant.com/solutions-itimekeep/),
[Aderant Apollo](https://www.aderant.com/solutions-apollo/),
[iTimekeep for Outlook](https://www.aderant.com/news-pr/itimekeep-for-outlook-highlights-july-product-release/)).
Aderant also claims iTimekeep is used by more than 500 firms, which is a useful
enterprise-adoption signal to verify later if this packet moves toward
enterprise analysis ([Aderant iTimekeep video](https://www.aderant.com/video/itimekeep-effortless-timekeeping-with-ai-guided-compliance/)).

Elite 3E is a major finance/practice-management system of record rather than a
time-capture overlay; Thomson Reuters materials describe 3E in time and billing
contexts, and partner pages show an integration ecosystem around iManage and
LawPay ([Thomson Reuters Elite 3E release](https://www.thomsonreuters.com/en/press-releases/2017/may/elite-3e-brings-convenience-of-amazon-alexa-to-time-and-billing),
[iManage Elite partner page](https://imanage.com/technology-partners/elite/),
[LawPay Elite 3E partner page](https://www.lawpay.com/partners/elite-3e/)).

BigHand is relevant as an enterprise legal-operations platform, but its public
positioning is broader than pure time capture, emphasizing resource management,
workflow, pricing, and business intelligence ([BigHand](https://www.bighand.com/en-us/)).

Legaltech Hub's timekeeping category is useful as a secondary market map, not
as primary proof, because it aggregates vendor listings rather than serving as
a vendor or survey source ([Legaltech Hub timekeeping](https://www.legaltechnologyhub.com/topics/law-firm-operations/timekeeping/)).

### M365 / Agent Capture Findings

Microsoft Graph delta query supports change tracking so an application can
maintain a local data store from Graph resources ([Microsoft Graph delta query](https://learn.microsoft.com/en-us/graph/delta-query-overview)).
Outlook change notifications support subscriptions for Outlook messages,
events, and contacts, which is the right primitive for local-first capture if
privacy and consent boundaries are approved ([Outlook change notifications](https://learn.microsoft.com/en-us/graph/outlook-change-notifications-overview)).
Graph permission scopes are granular and must be chosen deliberately for least
privilege ([Microsoft Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference)).

For historical Outlook archives, Microsoft Purview eDiscovery can export search
results to PST or individual messages, but that is an administrative/export
workflow, not a normal app sync API ([Microsoft Purview eDiscovery export](https://learn.microsoft.com/en-us/purview/edisc-search-export)).

### MCP Finding

No official first-party MCP server from a legal timekeeping vendor was found in
this sweep. Third-party/community paths do exist: a GitHub topic search shows
TypeScript MCP adapters for Clio and MyCase, a community `clio-mcp` repository
describes an MCP server for the Clio Manage v4 API, and Zapier publishes an MCP
entry point for MyCase ([GitHub practice-management MCP search](https://github.com/topics/practice-management?l=typescript&o=desc&s=updated),
[lawyered0/clio-mcp](https://github.com/lawyered0/clio-mcp),
[Zapier MyCase MCP](https://zapier.com/mcp/mycase)).

## 2026-06-18 In-Repo Capability Inventory

### FOUND

- Candidate lifecycle primitives:
  `packages/workspace/domain/package.json` exports `./entities/CandidateTask`,
  `./entities/ApprovalGate`, `./entities/ContextPacket`, and
  `./entities/EmailArtifact`.
- `CandidateTask`:
  `packages/workspace/domain/src/entities/CandidateTask/CandidateTask.model.ts`
  models candidate work with `fixtureKey`, `lifecycle`, and `snapshot`.
- `ApprovalGate`:
  `packages/workspace/domain/src/entities/ApprovalGate/ApprovalGate.model.ts`
  models approval state with `decision`, `fixtureKey`, `lifecycle`, and
  `snapshot`.
- `ContextPacket`:
  `packages/workspace/domain/src/entities/ContextPacket/ContextPacket.model.ts`
  provides a bounded evidence packet surface.
- `EmailArtifact`:
  `packages/workspace/domain/src/entities/EmailArtifact/EmailArtifact.model.ts`
  models normalized email artifacts with subject, body, sender/recipient,
  received time, thread key, and source spans.
- Agent SDK contracts:
  `packages/agents/use-cases/src/public.ts` exports candidate-output and
  context-packet contracts including `ProposeCandidateOutputSet`,
  `CandidateOutputSet`, `GetContextPacket`, and `ProfessionalRuntimeSdk`.
- Runtime candidate/approval DTOs:
  `packages/agents/use-cases/src/processes/ProfessionalRuntime/ProfessionalRuntime.contracts.ts`
  includes `RuntimeCandidateTask`, `RuntimeApprovalGate`,
  `RuntimeEvidenceRef`, and `SdkContextPacket`.
- Law-practice entities:
  `packages/law-practice/domain/package.json` exports `LegalClient`,
  `LegalContact`, `Matter`, and `PatentAsset`.
- Matter model:
  `packages/law-practice/domain/src/entities/Matter/Matter.model.ts` and
  `Matter.values.ts` exist, with `MatterType` currently limited to
  `patent_application`.
- PGlite:
  `packages/drivers/pglite/package.json` exports `@beep/pglite`, and
  `packages/drivers/pglite/src/PgliteClient.service.ts` provides an embedded
  PostgreSQL/PGlite client layer.
- PST/libpff:
  `packages/drivers/libpff/README.md`,
  `packages/drivers/libpff/src/Libpff.service.ts`, and
  `packages/drivers/libpff/src/Libpff.pffexport.ts` provide a PST archive
  ingestion scaffold and pffexport-backed export path.
- Date/time primitives:
  `packages/foundation/modeling/utils/src/DateTime.ts`,
  `packages/foundation/modeling/schema/src/LocalDate/index.ts`,
  `packages/foundation/modeling/schema/src/DateTimeUtcFromValid/DateTimeUtcFromValid.schema.ts`,
  and `packages/foundation/modeling/schema/src/Model/Model.datetime.ts`.
- NLP/entity extraction foundations:
  `packages/drivers/nlp-mcp/README.md`,
  `packages/drivers/wink/README.md`, and
  `docs/BEEPGRAPH_ARCHITECTURE.md` describe NLP tools, source spans, and
  extraction as candidate generation rather than authority.
- Product doctrine:
  `docs/product/prose-to-proof.md` and `docs/PROSE_TO_PROOF_VISION.md` define
  Beep as a solo IP attorney workspace that does not replace email, calendar,
  billing, docketing, CRM, or USPTO systems of record.

### NOT FOUND

- No dedicated M365/Microsoft Graph driver/package was found in this checkout.
- No product `TimeEntry`, timekeeping, billable-hour, invoice, LEDES, UTBMS, or
  billing-ledger model was found in `packages/**` beyond docs/examples, AI
  metrics timers, or generated provider-cost artifacts.
- No product trust-accounting model was found.
- No product timer/timekeeping UI surface was found.
- No first-party in-repo MCP adapter for Clio, MyCase, TimeSolv, Bill4Time,
  Intapp, Aderant, or Elite was found.

## 2026-06-18 Constraints Discovered

- Attorney approval is not optional. The repo already has candidate and
  approval primitives, and the legal market already includes compliance-aware
  time capture, so Beep's differentiator should be evidence-backed local
  candidate generation and attorney-controlled approval.
- The accounting/billing system-of-record boundary is high risk. Legal billing
  products often touch invoices, payments, trust accounting, LEDES/e-billing,
  and finance systems; Beep should not own that ledger without an explicit
  doctrine decision.
- IP timekeeping needs task-code awareness. Patent prosecution can involve
  UTBMS/LEDES code mapping, fixed-fee phases, office actions, IDS work,
  examiner interviews, trademark prosecution, portfolio review, and client
  reporting.
- Passive capture has privilege and privacy risk. Local-first storage and
  least-privilege Graph scopes help, but the user must choose what can be
  passively observed and what requires explicit start/stop or review.
- Developer friendliness differs sharply by segment. Clio and Bill4Time are
  more promising public API targets for small-firm experimentation; Intapp,
  Aderant, and Elite are better enterprise comparators but likely heavier to
  integrate without partner access.

## 2026-06-18 Recommendation To Carry Into Align

Recommend Beep as a local-first **time-capture/prebill assistant**:

- Capture local activity and external signals as evidence, not billable truth.
- Generate candidate time entries with matter/client hints, task-code guesses,
  confidence, evidence refs, and narrative drafts.
- Route candidates through approval gates before any billable record is
  exported.
- Integrate with legal billing/practice-management systems for the authoritative
  client billing record.
- Start with Tom solo IP practice unless the user explicitly chooses an
  enterprise-first comparison.
