# Capture

<!--
Stage 0. Append-only raw dump: thoughts, links, screenshots (drop files in
assets/ and reference them), half-sentences, contradictions. Nobody tidies
this file; cleaning it up destroys provenance. New material goes under a new
dated heading at the bottom.
-->

## 2026-08-30

Original scratch prompt (WebStorm scratch_62.md, verbatim):

> I forget which goal packet is the most relevant to this change that I want to make so I'll need you to tell me so we can make an
> ammendment but one of the things I want accomplised when re-running the corpus pipeline for the oppold-corpus is to simultaneously
> uplaod all of my dad's historical emails & relevant documents to our oip.law Office Microsoft 365 Pro so that he can search them.
> Futher more as part of the pipeline process I want us to setup the box.com DMS for his practice creating his client & matter folders based
> on the client's we extract, matter folders & other important documents. This will require us to consider the ideal setup for box.com & I'll need you to do research on both
> using Azure / the m365 driver to upload documents, create contacts & emails as well as configure box properly to work a DMS for his practice.
>
> Please use GPT 5.6 Sol on xhigh & Grok 4.6 on xhigh to perform comprehensive research on this.
>
> We need to completely setup his practice so that he has a process & an organization system for his practice with document versioning.
>
> We need it to be an industry standard box configuration. We should also include html artifacts we can deploy that will walk him through how he should manage his clients matters, documents
> & other important things.
>
> use /grill-with-docs to align & lock in decisions. ensure grok & codex use the /deep-research skill. deploy several to investigate different angles of everything.
>
> This might warrant an initial exploration packet before we ammend the goal or even a goal that needs to proceed the oppold-corpus pipeline so that we can get all of his prior
> lawfirm documents, matters, clients, emails & contacts setup as a result of running the pipeline.
>
> This needs to be production grade.
>
> Delegate all token heavy work to codex & use grok as the primary driver of web research, make sure it uses its relevant firecrawl skills according to its task & that x search is enabled.

Same-session grilling (3 rounds, /grill-with-docs) reframed the premises and
locked the decisions now pre-seeded in [`DECISIONS.md`](./DECISIONS.md):
the "goal that precedes the pipeline" already exists
(`goals/oppold-corpus-salvage-restoration`), pipeline re-run is the gated
`oppold-corpus-pipeline-v2` MAP re-entry, `@beep/box` driver is complete,
`@beep/m365` driver is complete but read-only by design, and the egress
scope had no packet owner — hence this packet.

Mid-session addenda from Benjamin:

> Either way if we can set it up with code we version to iterate on that is
> ideal over cli scripts or commands so we can iterate in a more controlled
> fasion.

> Might be useful https://developer.box.com/llms.txt

> My Dad already has an account on box as well as Box drive installed for sync

> If possible we also are going to want to setup some document signature
> workflows & E-Billing for his clients, I think box has this.

Later the same day, with a screenshot of the FreshBooks developer portal
(app "Oppold IP Law Development", type Private App, description "Automations
for Oppold IP Law", in Tom's FreshBooks account):

> I've already setup these integrations:
>
> * Box for Microsoft 365 for Web
> * Claude
> * ChatGPT
> * Copilot Studio
>
> I've just created a freshbooks app test environments and stored off these
> 1pass refs:
>
> * FRESHBOOKS_CLIENT_ID: "op://BEEP_SECRETS/BEEP_SECRETS/PAYMENTS_DEV_FRESHBOOKS_CLIENT_ID"
> * FRESHBOOKS_CLIENT_SECRET: "op://BEEP_SECRETS/BEEP_SECRETS/PAYMENTS_DEV_FRESHBOOKS_CLIENT_SECRET"
>
> The settings url, redirect url & website url will be wrong though & I
> imagine that this will be local.

(The dev-app URLs currently point at https://www.oip.law placeholders;
FreshBooks requires an exact-match HTTPS redirect URI, with localhost
permitted for development — so the redirect will indeed be a local callback
once the token-acquisition helper exists.)

Follow-up from Benjamin, same day:

> And what about application settings url? Also in regard to scopes I just
> enabled all of them for the dev test appl.

(Settings URL is cosmetic for a private automation app — no OAuth role.
All-scopes on the DEV app accepted for iteration speed; the production app
registration must be least-privilege with the exact scope set declared by
the driver config at align time. FreshBooks re-requires authorization when
scopes change, so dev tokens will need re-auth whenever scopes are tightened.)

Benjamin then connected live claude.ai connectors: Microsoft 365, Box, and
HubSpot. Read-only tenant probes (2026-08-30, all as the connector identity):

- Box and M365 both authenticate as `boppold@oip.law` (Benjamin, CTO seat on
  the practice org tenant). HubSpot account 246203876 (NA2, standard tier,
  US/Eastern).
- Box enterprise metadata templates: **zero** — the tenant is
  metadata-greenfield; the reconciler starts from nothing to adopt there.
- Benjamin's Box root already holds a 2026-07-03 staging drop (corpus-refresh
  era): folder `OppoldIPLaw` (subfolders `Sent 2015-2026`,
  `LH_Other_Folders_2026-06-30`, `New folder`; contacts.csv,
  pwolff_docket_emails.txt, search_history.csv, suggested_people.csv) plus
  root-level `Agreements.zip` / `Applications.zip` / `canonical.zip` /
  `Correspondence.zip` / `Responses.zip` (~300 MB), and beep-side folders
  (`beep-vault`, `beep-qa-professional-desktop-2026-07`,
  `IP_LAW_ONTOLOGY_RESEARCH`).
- Every probed item is Benjamin-owned with `hasCollaborations: false` — Box
  roots are per-user, so NONE of this staging is visible from Tom's seat.
  Ownership/collaboration topology (service-account vs Tom-owned matter
  folders, who collaborates where) is therefore a first-class align question,
  and Tom's actual current folder structure remains unobserved from this
  connector identity.

Azure CLI access established the same day (`az login` device-code as
boppold@oip.law; Microsoft Foundry MCP also connected). Live Graph reads
settled the SKU preflight:

- Tenant subscribed SKUs: `BUSINESS_PREMIUM_AND_MICROSOFT_365_COPILOT_FOR_BUSINESS`
  (2 seats enabled, 2 consumed) + `FLOW_FREE`. So: **Microsoft 365 Business
  Premium with Copilot for Business, both seats assigned** — users
  `toppold@oip.law` (Tom) and `boppold@oip.law` (Benjamin).
- Consequence per R2/R5: the 1.5 TB auto-expanding archive and retention
  labels are covered, but bulk **PST Import Service user rights are NOT
  covered by Business Premium** — a temporary step-up (EXO Plan 2 / one E3
  seat / Purview add-on) is a confirmed requirement for the mail backfill.
  Cheapest compliant path = oracle prompt section A, now baselined.

> I have M365 Copilot (Premium).

(Operator clarification: the Copilot component on the tenant is the full
M365 Copilot tier — so Copilot-grade search/assistant over the mailbox and
the imported archive is available to the assigned seats.)

> Just added the Box integration to office.

(Screenshot: M365 Copilot → Chat settings → Sources now lists **Box**
connected as a Copilot source, beside HubSpot and AI Meeting Notes
TeamsMaestro. Design implication: Copilot becomes the single search/ask
surface across Outlook mail AND Box documents, which retires the residual
one-search-box argument for duplicating documents into SharePoint — the
Box-as-sole-record decision now has a native cross-store search story.
Copilot connector coverage/limits for Box content belong in align.)

Post-merge additions (PR #904 merged 2026-08-30T19:02Z while its local proof
was still queued):

> BTW here are the refs for Hubspot:
>
> * "op://BEEP_SECRETS/BEEP_SECRETS/CRM_HUBSPOT_PERSONAL_ACCESS_KEY"
> * "op://BEEP_SECRETS/BEEP_SECRETS/CRM_HUBSPOT_DEVELOPER_API_KEY"

(HubSpot portal "Oppold IP Law", id 246203876, NA2 — matches the connector
probe. The portal's account screen lists domain `www.opip.law`, not
`oip.law`: either a typo'd HubSpot account field or a second owned domain —
flagged for the intake-process design. Also possible align-stage follow-up:
whether HubSpot participates in the client-intake walkthrough as the
prospect front-end ahead of Box/FreshBooks.)

Same session: align rounds 1–3 resolved the full seven-item frontier plus
the reconciler-shape ratification; entries appended to DECISIONS.md. Review
comments from PR #904 (openclaw + Greptile) were triaged — ten valid fixes
landed in the follow-up branch; the "r7 missing from PR" finding was
invalid (both files verified present on main).
