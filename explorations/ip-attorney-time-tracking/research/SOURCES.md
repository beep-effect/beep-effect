# IP Attorney Time Tracking — Sources & Provenance

- **Cluster / origin:** 2026-06-18 external landscape sweep, three focused
  research tracks, and live repo capability inventory; FreshBooks gap recorded
  2026-07-14 after product alignment.
- **Provenance:** [`../RESEARCH.md`](../RESEARCH.md) is the synthesis;
  [`01-solo-small-firm-time-tracking.md`](./01-solo-small-firm-time-tracking.md),
  [`02-mid-large-enterprise-time-platforms.md`](./02-mid-large-enterprise-time-platforms.md),
  and [`03-agent-developer-integration-and-handroll.md`](./03-agent-developer-integration-and-handroll.md)
  contain the cited research. Except for the explicitly marked FreshBooks
  additions requested at shape, every URL below is reproduced from those files.

## 1. Upstream repositories and licenses

| Repo | On-disk citation | License | Port discipline | Packet use |
| --- | --- | --- | --- | --- |
| `lawyered0/clio-mcp` | [repository](https://github.com/lawyered0/clio-mcp) | **NEEDS-REVERIFICATION** | reference-only | Evidence that a community Clio MCP surface exists; not an implementation dependency. |

No upstream source code was mined for this packet. No code may be copied or
ported from the repository above unless its license and exact source provenance
are verified in an implementation goal.

## 2. External research sources

### Market, professional, and e-billing authorities

- [ABA TechReport](https://www.americanbar.org/groups/law_practice/resources/tech-report/)
- [Clio Legal Trends Benchmarks](https://www.clio.com/resources/legal-trends/benchmarks/)
- [LEDES](https://ledes.org/)
- [UTBMS](https://utbms.com/)

### Solo and small-firm vendor documentation

- **Actionstep:** [time-entry creation](https://support.actionstep.com/hc/en-us/articles/50482503086355-Creating-a-Time-or-Fee-Entry),
  [time-entry data management](https://support.actionstep.com/hc/en-us/articles/50482596376595-Understanding-How-Time-Entry-Data-is-Managed-Between-Legal-Accounting-and-Practice-Management),
  [billing](https://www.actionstep.com/billing/)
- **Bill4Time:** [time-entry API](https://secure.bill4time.com/apinode/v1/docs/timeentries),
  [API overview](https://support.bill4time.com/hc/en-us/articles/27906381671963-API-Overview),
  [product](https://www.bill4time.com/)
- **Clio:** [API reference](https://docs.developers.clio.com/clio-manage/api-reference/),
  [legal billing](https://www.clio.com/features/legal-billing-software/),
  [pricing](https://www.clio.com/pricing/)
- **CosmoLex:** [time tracking](https://www.cosmolex.com/features/time-tracking/),
  [integrations](https://www.cosmolex.com/integrations/)
- **LeanLaw:** [product](https://www.leanlaw.co/),
  [QuickBooks App Store](https://quickbooks.intuit.com/app/apps/appdetails/leanlaw/en-us/),
  [Intuit integration article](https://quickbooks.intuit.com/r/innovation/leanlaw-deep-integration-with-quickbooks-for-any-legal-timekeeping-and-billing-app/)
- **MyCase:** [Open API](https://www.mycase.com/blog/cloud-saas-for-lawyers/how-to-use-mycases-open-api-to-get-more-of-your-time-back/)
- **PracticePanther:** [API](https://support.practicepanther.com/en/articles/479897-practicepanther-api),
  [legal billing](https://www.practicepanther.com/legal-billing/)
- **Smokeball:** [time tracking](https://www.smokeball.com/features/legal-time-tracking-software),
  [email integrations](https://www.smokeball.com/features/email-integrations/)
- **TimeSolv:** [product](https://www.timesolv.com/),
  [integrations](https://www.timesolv.com/resources/blog/saving-time-with-timesolvs-integration-features/),
  [intellectual-property practice](https://www.timesolv.com/business-type/attorney/intellectual-property/)

### Enterprise pattern benchmarks

- **Intapp:** [Time](https://www.intapp.com/time-tracking/),
  [Time Horizon Cloud](https://www.intapp.com/blog/time-horizon-cloud-legal-timekeeping/),
  [AI time capture](https://www.intapp.com/blog/ai-time-capture-law-firms-3/)
- **Aderant:** [iTimekeep](https://www.aderant.com/solutions-itimekeep/),
  [Apollo](https://www.aderant.com/solutions-apollo/),
  [iTimekeep for Outlook](https://www.aderant.com/news-pr/itimekeep-for-outlook-highlights-july-product-release/),
  [iTimekeep adoption video](https://www.aderant.com/video/itimekeep-effortless-timekeeping-with-ai-guided-compliance/)
- **Elite 3E ecosystem:** [Thomson Reuters release](https://www.thomsonreuters.com/en/press-releases/2017/may/elite-3e-brings-convenience-of-amazon-alexa-to-time-and-billing),
  [iManage partner page](https://imanage.com/technology-partners/elite/),
  [LawPay partner page](https://www.lawpay.com/partners/elite-3e/)
- [BigHand](https://www.bighand.com/en-us/)
- [Legaltech Hub timekeeping category](https://www.legaltechnologyhub.com/topics/law-firm-operations/timekeeping/)

These enterprise sources remain pattern benchmarks only; Tom's solo practice is
the locked first segment.

### Microsoft Graph and archive capture

- [Microsoft Graph delta query](https://learn.microsoft.com/en-us/graph/delta-query-overview)
- [Outlook change notifications](https://learn.microsoft.com/en-us/graph/outlook-change-notifications-overview)
- [Microsoft Graph permissions reference](https://learn.microsoft.com/en-us/graph/permissions-reference)
- [Microsoft Purview eDiscovery export](https://learn.microsoft.com/en-us/purview/edisc-search-export)

### MCP discovery signals

- [GitHub practice-management MCP search](https://github.com/topics/practice-management?l=typescript&o=desc&s=updated)
- [`lawyered0/clio-mcp`](https://github.com/lawyered0/clio-mcp)
- [Zapier MyCase MCP](https://zapier.com/mcp/mycase)

### FreshBooks — NEEDS-EVALUATION

- [FreshBooks product](https://www.freshbooks.com/)
- [FreshBooks public API documentation root](https://www.freshbooks.com/api/start/)

**Named research gap:** the 2026-06-18 packet did not evaluate FreshBooks, even
though it is Tom's selected billing and accounting system. Do not treat the
presence of a public API as integration proof. The `law-time-freshbooks-export`
P0 must verify developer onboarding, OAuth scopes, time-entry writes, invoice
adjacency, client/project-to-matter mapping, stable identifiers, idempotency,
reconciliation, error/rate behavior, and test-account access.

## 3. In-repo capability references

| Brick | Live reference from packet research | Disposition |
| --- | --- | --- |
| Candidate governance | `CandidateTask`, `ApprovalGate`, `ContextPacket`, `EmailArtifact`; `packages/workspace/domain/src/entities/` | reuse candidate, evidence, and explicit approval patterns |
| Agent contracts | `packages/agents/use-cases/src/public.ts`; `ProfessionalRuntime.contracts.ts` | reuse/extend candidate-output and runtime DTO patterns |
| Law-practice context | `Matter`, `LegalClient`, `LegalContact`, `PatentAsset`; `packages/law-practice/domain/src/entities/` | reuse/extend in owning slice |
| Durable local SQL | `@beep/pglite`; `packages/drivers/pglite/src/PgliteClient.service.ts` | reuse; law-time tables are **NET-NEW** |
| PST ingestion | `packages/drivers/libpff/` | reuse/extend for bounded historical import |
| Date/time foundations | `packages/foundation/modeling/utils/src/DateTime.ts` and packet-listed schema/value modules | reuse |
| Narrative/extraction foundations | `packages/drivers/nlp-mcp/`, `packages/drivers/wink/`, source-span doctrine | reuse patterns; purpose-bounded narrative assistant is **NET-NEW** |
| Time capture | No product time-entry model or timer surface found in packet research | **NET-NEW** |
| FreshBooks | No first-party adapter found or prior evaluation performed | **NET-NEW; NEEDS-EVALUATION** |
| M365 activity capture | No dedicated time-signal driver found in packet research | **NET-NEW; spike-gated** |

## 4. Cross-links and provenance

- Packet synthesis: [`../RESEARCH.md`](../RESEARCH.md)
- Ratified decisions: [`../DECISIONS.md`](../DECISIONS.md)
- Shaped pitch and decomposition: [`../BRIEF.md`](../BRIEF.md) and
  [`../MAP.md`](../MAP.md)
- Graduated implementation ledger:
  [`goals/law-time-capture-spine/research/SOURCES.md`](../../../goals/law-time-capture-spine/research/SOURCES.md).
- Product doctrine:
  [`docs/product/ip-attorney-time-tracking.md`](../../../docs/product/ip-attorney-time-tracking.md).
- The other five `MAP.md` candidates remain queued behind their named gates.
