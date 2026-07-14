# Law Time Capture Spine — Sources & Provenance

<!-- markdownlint-disable MD034 -- Provenance ledger preserves cited URLs verbatim. -->

- **Primary ledger:**
  [`explorations/ip-attorney-time-tracking/research/SOURCES.md`](../../../explorations/ip-attorney-time-tracking/research/SOURCES.md).
  The relevant implementation corpus below is reproduced from that exploration;
  provenance corrections begin there and are then synchronized here.
- **Origin:** 2026-06-18 external landscape, three focused research tracks, and
  live repo capability inventory; FreshBooks gap recorded 2026-07-14.
- **Freshness rule:** P0 re-verifies live repo paths and any implementation-
  shaping claims. FreshBooks remains out of scope except as a recorded gap.

## 1. Mined source corpus

| Source | Title | Upstream | Exploration location | Theme | Disposition |
| --- | --- | --- | --- | --- | --- |
| `clio-mcp` | community Clio MCP surface | `lawyered0/clio-mcp` | `research/03-agent-developer-integration-and-handroll.md` | practice-management integration prior art | Reference only — LICENSE NEEDS-REVERIFICATION |

No upstream source code was mined for this packet. No code may be copied or
ported unless the exact source provenance and license are verified first.

## 2. Upstream repositories & licenses

| Repo | On-disk URL | License | Port discipline |
| --- | --- | --- | --- |
| `lawyered0/clio-mcp` | https://github.com/lawyered0/clio-mcp | NEEDS-REVERIFICATION | reference-only |

## 3. External research sources

### Market, professional, and e-billing authorities

- ABA TechReport: https://www.americanbar.org/groups/law_practice/resources/tech-report/
- Clio Legal Trends Benchmarks: https://www.clio.com/resources/legal-trends/benchmarks/
- LEDES: https://ledes.org/
- UTBMS: https://utbms.com/

### Solo and small-firm vendor documentation

- Actionstep: https://support.actionstep.com/hc/en-us/articles/50482503086355-Creating-a-Time-or-Fee-Entry · https://support.actionstep.com/hc/en-us/articles/50482596376595-Understanding-How-Time-Entry-Data-is-Managed-Between-Legal-Accounting-and-Practice-Management · https://www.actionstep.com/billing/
- Bill4Time: https://secure.bill4time.com/apinode/v1/docs/timeentries · https://support.bill4time.com/hc/en-us/articles/27906381671963-API-Overview · https://www.bill4time.com/
- Clio: https://docs.developers.clio.com/clio-manage/api-reference/ · https://www.clio.com/features/legal-billing-software/ · https://www.clio.com/pricing/
- CosmoLex: https://www.cosmolex.com/features/time-tracking/ · https://www.cosmolex.com/integrations/
- LeanLaw: https://www.leanlaw.co/ · https://quickbooks.intuit.com/app/apps/appdetails/leanlaw/en-us/ · https://quickbooks.intuit.com/r/innovation/leanlaw-deep-integration-with-quickbooks-for-any-legal-timekeeping-and-billing-app/
- MyCase: https://www.mycase.com/blog/cloud-saas-for-lawyers/how-to-use-mycases-open-api-to-get-more-of-your-time-back/
- PracticePanther: https://support.practicepanther.com/en/articles/479897-practicepanther-api · https://www.practicepanther.com/legal-billing/
- Smokeball: https://www.smokeball.com/features/legal-time-tracking-software · https://www.smokeball.com/features/email-integrations/
- TimeSolv: https://www.timesolv.com/ · https://www.timesolv.com/resources/blog/saving-time-with-timesolvs-integration-features/ · https://www.timesolv.com/business-type/attorney/intellectual-property/

These vendors are market references only. The FreshBooks pivot invalidated the
packet's earlier legal-vendor ranking for Tom's practice, and no vendor adapter
is part of this manual spine.

### Enterprise pattern benchmarks

- Intapp: https://www.intapp.com/time-tracking/ · https://www.intapp.com/blog/time-horizon-cloud-legal-timekeeping/ · https://www.intapp.com/blog/ai-time-capture-law-firms-3/
- Aderant: https://www.aderant.com/solutions-itimekeep/ · https://www.aderant.com/solutions-apollo/ · https://www.aderant.com/news-pr/itimekeep-for-outlook-highlights-july-product-release/ · https://www.aderant.com/video/itimekeep-effortless-timekeeping-with-ai-guided-compliance/
- Elite 3E ecosystem: https://www.thomsonreuters.com/en/press-releases/2017/may/elite-3e-brings-convenience-of-amazon-alexa-to-time-and-billing · https://imanage.com/technology-partners/elite/ · https://www.lawpay.com/partners/elite-3e/
- BigHand: https://www.bighand.com/en-us/
- Legaltech Hub timekeeping category: https://www.legaltechnologyhub.com/topics/law-firm-operations/timekeeping/

Enterprise sources remain pattern benchmarks only; Tom's solo practice is the
ratified first segment.

### Microsoft Graph and archive capture

- Microsoft Graph delta query: https://learn.microsoft.com/en-us/graph/delta-query-overview
- Outlook change notifications: https://learn.microsoft.com/en-us/graph/outlook-change-notifications-overview
- Microsoft Graph permissions: https://learn.microsoft.com/en-us/graph/permissions-reference
- Microsoft Purview eDiscovery export: https://learn.microsoft.com/en-us/purview/edisc-search-export

These are provenance for separately gated M365/PST follow-ons, not inputs that
authorize passive capture in this packet.

### MCP discovery signals

- GitHub practice-management MCP search: https://github.com/topics/practice-management?l=typescript&o=desc&s=updated
- `lawyered0/clio-mcp`: https://github.com/lawyered0/clio-mcp
- Zapier MyCase MCP: https://zapier.com/mcp/mycase

### FreshBooks — NEEDS-EVALUATION

- FreshBooks product: https://www.freshbooks.com/
- FreshBooks public API documentation root: https://www.freshbooks.com/api/start/

**Named research gap:** the exploration did not evaluate FreshBooks even though
it is Tom's selected billing and accounting system. A public API is not
integration proof. The separate `law-time-freshbooks-export` P0 must verify
developer onboarding, OAuth scopes, time-entry writes, invoice adjacency,
client/project-to-matter mapping, stable identifiers, idempotency,
reconciliation, error/rate behavior, and test-account access. None of those
unknowns is implementation scope or acceptance evidence for this packet.

## 4. In-repo capability references

| Brick | Live exploration reference | Disposition |
| --- | --- | --- |
| Candidate governance | `CandidateTask`, `ApprovalGate`, `ContextPacket`, `EmailArtifact`; `packages/workspace/domain/src/entities/` | reuse candidate, evidence, and explicit approval patterns |
| Agent contracts | `packages/agents/use-cases/src/public.ts`; `ProfessionalRuntime.contracts.ts` | reuse/extend candidate-output and runtime DTO patterns |
| Law-practice context | `Matter`, `LegalClient`, `LegalContact`, `PatentAsset`; `packages/law-practice/domain/src/entities/` | reuse/extend in the owning slice |
| Durable local SQL | `@beep/pglite`; `packages/drivers/pglite/src/PgliteClient.service.ts` | reuse; law-time tables are NET-NEW |
| PST ingestion | `packages/drivers/libpff/` | later gated reuse; not Slice 1 |
| Date/time foundations | `packages/foundation/modeling/utils/src/DateTime.ts` and packet-listed schema/value modules | reuse |
| Narrative/extraction foundations | `packages/drivers/nlp-mcp/`, `packages/drivers/wink/`, source-span doctrine | reuse patterns; purpose-bounded narrative assistant is NET-NEW |
| Time capture | No product time-entry model or timer surface found in packet research | NET-NEW |
| FreshBooks | No first-party adapter found or prior evaluation performed | NET-NEW; NEEDS-EVALUATION; separate P0 |
| M365 activity capture | No dedicated time-signal driver found in packet research | NET-NEW; separate spike gate |

## 5. Cross-links & provenance

- Primary provenance surface:
  `explorations/ip-attorney-time-tracking/research/SOURCES.md`.
- Synthesis: `explorations/ip-attorney-time-tracking/RESEARCH.md`.
- Ratified contract:
  `explorations/ip-attorney-time-tracking/{DECISIONS,BRIEF,MAP}.md`.
- Product doctrine: `docs/product/ip-attorney-time-tracking.md`.
- Gate-queued siblings are named in the exploration `MAP.md`; no sibling goal
  packet graduated in this pass.
