# What solo and small IP firms are actually adopting in 2026

**As of:** 2026-08-17
**Lane:** x7-iptech-competitive
**Reader:** technical partner to a solo US patent attorney (build vs buy for a local-first matter + document + figure workspace)
**Method:** vendor product/pricing pages, practitioner threads on Reddit (`r/patentlaw`, `r/Patents`, `r/legaltech`), X.com posts, legal-tech press, LinkedIn-adjacent public essays
**Confidentiality note:** this report uses only public marketing, pricing, and social evidence. No client disclosure or unpublished patent content.

---

## How to read this report

For every product: **(a)** what job it actually does (docket, draft, OA, search, analytics, figures), **(b)** whether it touches drawings, **(c)** deployment / confidentiality posture, **(d)** published or reported price, **(e)** what practitioners say they use or refuse.

Claims that could not be verified against a primary page or a dated post are marked **UNVERIFIED**. Dates on citations are publication or last-checked dates.

**X.com finding, stated up front:** practicing US patent attorneys almost never name product SKUs on X. The 2025–2026 X corpus on this topic is vendor marketing, inventor-side “I filed without an attorney,” privilege commentary from general litigators, and one practicing patent attorney (`@KSpikefish`) saying he uses AI in the drafting pipeline but will not trust its claims. The *practitioner adoption signal* lives on Reddit and in LinkedIn-adjacent essays (Patent Beast / Robert Fish). That absence is itself evidence: this market is small, conservative, and does not perform its stack in public.

---

## Executive snapshot

The 2026 solo/small-firm IP stack is still a **split stack**, not a workspace:

| Layer | What solos actually run | Typical monthly cost |
| --- | --- | --- |
| Docket | AppColl, DocketTrak, PATTSY WAVE, or a shadow spreadsheet next to PATTSY | $125–$300 (or $1–$3/active matter) |
| Proof / Word utilities | Patent Bots and/or ClaimMaster | $20–$75 |
| Drafting AI | DeepIP (Word) *or* Claude/ChatGPT Team *or* nothing | $0–$420 |
| Search | Google Patents + Espacenet + PQAI; PatSnap only if the firm already pays | $0–$20 (or $6k–$40k/yr if PatSnap) |
| Figures | Human illustrator ($25–$150/sheet) + Copilot B/W conversion experiments | per-sheet, not a seat |
| Analytics / landscape | Usually skipped | $10k–$80k/yr if bought |

Nobody has shipped a credible **matter + document + figure + CAD** workspace that a solo will treat as system of record. Solve Intelligence comes closest as a browser platform (draft + OA + figures + charts) at a reported ~$775/user/month. Rowan Patents (Clarivate) is the only mature product whose *differentiator* is claim–spec–figure numeral consistency. Both are cloud. Both leave CAD out.

Refusal drivers, in order, are **confidentiality / Rule 1.6**, **price that cannot be billed through**, and **quality that looks like a patent but is not a strategy**. Docket lock-in is the switching-cost fortress. General agents (Claude / ChatGPT, increasingly with MCP) are eating *generic drafting experiments* and *search scaffolding*. They are not eating docketing, USPTO drawing compliance, or the numeral graph.

---

## 1. The 2026 IP-practice AI stack (named products + prices)

Prices are **per seat per month** unless noted. “Quote” means the vendor does not publish a rate card.

### 1.1 Docketing (the system they will not leave)

Docketing is not an AI category. It is the operational risk system. A 2026 comparison written from implementation work puts the selection as a once-per-decade decision: wrong pick costs license + a multi-quarter migration + residual deadline risk ([PerspireIP, 2026-05-06](https://www.perspireip.com/blog/patent-docketing-software-comparison/)).

| Product | Who it is for | Price signal | Figures? | Notes |
| --- | --- | --- | --- | --- |
| **DocketTrak** | Solo / <100 matters | **$125/mo flat, up to 5 users**, no setup fee ([PerspireIP, 2026-05-06](https://www.perspireip.com/blog/patent-docketing-software-comparison/)) | No | Cheapest named small-firm docket |
| **AppColl Prosecution Manager** | Solo–25 attorney IP boutiques | Independent review: **$150/mo base**, typically **$1–$3 per active matter/mo** ([Owlesq, 2026](https://owlesq.com/tools/appcoll)); vendor itself only says “subscription… charges monthly,” no long-term contracts ([AppColl](https://www.appcoll.com/)) | No | USPTO Patent Center sync, QuickBooks, DocuSign, client portal. Matter-count pricing, not seats |
| **PATTSY WAVE** (Anaqua) | Mid-size IP firms | Mid-market / “high end of mid-market”; enterprise class **$25k–$100k+/yr** plus **$10k–$100k+ implementation** ([PerspireIP, 2026-05-06](https://www.perspireip.com/blog/patent-docketing-software-comparison/)) | No | Anaqua’s small/mid product. Reddit: Anaqua bought PATTSY WAVE as the affordable SKU ([r/Patents, 2023-08-08](https://www.reddit.com/r/Patents/comments/15l5xq8/which_docketing_systems_are_you_all_using/)) |
| **Anaqua** (full) | Large firms / Fortune 500 IP | Same $25k–$100k+ band, 4–9 month implementation | No | Reddit veterans call it “best if you just need basic docketing” at scale |
| **Foundation IP** (Clarivate / CPA Global) | Large firms, global corporates | Same enterprise band | No | Annuity-integrated. Support quality complained about |
| **CPI MEMOTECH** | Firms that want native annuity payment | Quote | No | Dated UI; still the annuity standard |
| **Plexus** | Boutique–mid | Quote; “good price-to-feature” ([PerspireIP](https://www.perspireip.com/blog/patent-docketing-software-comparison/)) | No | Smaller installed base |
| **Rowan** (docketing SKU, not Rowan Patents drafting) | Newer / IP-tech-forward | Quote; cloud, 4–8 week impl. | Partial if paired with Rowan Patents | Younger product |
| **Black Hills AI / Otto HUB** | Firms that want docket + AI drafting on one hub | Quote; one third-party puts Black Hills at **$1,000–$2,500/mo** **UNVERIFIED** ([Abigail, 2026-02-25](https://abigail.app/blog/guides/cheapest-patent-ai-tool-2026)) | Via Otto IP add-in | Docket-first vendor that bolted on gen-AI. Integrates with DeepIP ([LawNext, 2024-10-22](https://www.lawnext.com/2024/10/black-hills-ai-and-deepip-announce-integration-designed-to-enhance-patent-prosecution-and-ip-management.html)) |
| **Shadow spreadsheet** | Nearly everyone, including PATTSY users | $0 | No | “I also keep my own shadow docket with a spreadsheet… frankly easier to read than PATTSY” ([r/Patents, 2023-08-08](https://www.reddit.com/r/Patents/comments/15l5xq8/which_docketing_systems_are_you_all_using/)) |

**What practitioners actually say they use (docket):** AppColl, PATTSY, Anaqua, Foundation IP, PerfectLaw/AIM, CPI, DocketTrak. The 2023 `r/Patents` thread is still the best public census; 2026 vendor copy has not displaced those names. AppColl is the named small-firm default in both that thread and the 2026 Owlesq review.

**Outsourced docketing** (if the solo does not want software at all): a few hundred to a few thousand dollars per month depending on caseload ([Teak IP](http://teakipservices.com/what-are-the-best-patent-docketing-services-for-small-firms/)); ~$500–$800/mo cited for ~200 patents+marks ([Menteso](https://menteso.com/tag/ip-docketing/)). CM Law’s 2026 practitioner cost guide bills docket *intake* at **$85/hour**, not a platform fee ([CM Law PDF](https://www.cm.law/wp-content/uploads/2024/08/CM-Law-IP-Practitioner-Cost-Guide-2026.pdf)).

### 1.2 Drafting and OA response (the AI layer)

| Product | Surface | Figures? | Price | Confidentiality posture |
| --- | --- | --- | --- | --- |
| **Patent Bots Prep & Pros Pro** | Word add-in + browser | **No.** Explicit limitation: “does not generate patent figures or flowcharts” ([Patent Bots comparison, Jul 2026](https://www.patentbots.com/patent-drafting-tools-comparison)) | **$702/person/year** individual (~$58.50/mo) ([official individual page](https://www.patentbots.com/pricing-individual)); firm-wide as low as **~$50/user/mo** at scale, **$100/mo minimum** monthly ([firm pricing](https://www.patentbots.com/pricing-law-firm)) | SOC 2 Type II, zero data retention claimed |
| **ClaimMaster** | Word add-in | **Yes, limited:** generate figures/flowcharts from claims; check figures for bad part numbers ([plan matrix](https://www.patentclaimmaster.com/CMComparison.html)). 2026 release: PNG/SVG figure generation + **local LLMs via Ollama** ([ClaimMaster blog](https://www.patentclaimmaster.com/blog/llm-patent-drafting-improvements-claimmaster-2026/)) | Published self-serve: **$24–$90/user/mo** monthly, **$20–$75/user/mo** annual. Pro+Draft = **$78 mo / $65 yr**. Pro+Shells+Draft = **$90 / $75** ([CMComparison](https://www.patentclaimmaster.com/CMComparison.html)) | Desktop Word plugin; can point at local models so invention text never leaves the machine |
| **DeepIP** | Word sidebar (Marketplace add-in) + some web | **Yes, basic:** sketch/flowchart → line art → Visio/PNG. Reviewers: “functional, not feature-rich”; still need an illustrator for mechanical ([Patentext, 2026-07-22](https://patentext.com/blog/solve-intelligence-vs-deepip/)) | **$350/user/mo annual or $420 monthly** reported as published 2026 pricing ([Patentext](https://patentext.com/blog/solve-intelligence-vs-deepip/); [Patent Bots comparison](https://www.patentbots.com/patent-drafting-tools-comparison)). DeepIP’s own site is quote/trial as of this check — treat $350–$420 as **third-party-reported, recently current**. Jun 2026: acquired German **PatentMaker** (€249/mo on PatentMaker’s own page, [patentmaker.eu/pricing](https://patentmaker.eu/pricing/)) ([Global Legal Post, 2026-06-10](https://www.globallegalpost.com/news/ai-patent-platform-start-up-deepip-acquires-german-ai-assistant-patentmaker-972717147)) | SOC 2 Type II + ISO 27001; Word-native so docs stay in the firm’s DMS. Zero-data-retention advertised |
| **Solve Intelligence** | Browser editor only (Claude-backed) | **Yes, first-class marketing feature:** text / napkin sketch / photo → patent-compliant line art, labels, spec sync ([Patentext](https://patentext.com/blog/solve-intelligence-vs-deepip/); Solve’s own copy: “generate labeled figures from CAD files” ([Solve blog, 2026-03-24](https://www.solveintelligence.com/blog/post/solve-intelligence-ranked-1-ip-platform-by-the-worlds-leading-law-firms))) | **Not published.** Best grounded estimate: NAPP 15% off “equivalent of up to ~$1,400” ⇒ **~$9,300/user/year ≈ $775/mo** ([NAPP member page, 2026-01-29](https://napp.org/solve-intelligence/); arithmetic in [Patentext, 2026-07-22](https://patentext.com/blog/solve-intelligence-vs-deepip/)). Competitor Abigail lists **$1,500–$3,000/mo** — treat as **UNVERIFIED** firm-floor, not per-seat. $55M raised; claims **400+ IP teams** ([NAPP](https://napp.org/solve-intelligence/)) | SOC 2; “data not used for training”; “local data processing” claimed. Still a cloud browser app. Browser-only is the #1 practitioner complaint |
| **Patlytics** | Browser platform | Text-first; drawings out of scope ([PatentFig, 2026-07-15](https://patentfig.ai/blog/ai-patent-drafting-tools-and-where-figures-fit)) | **$800–$2,000/user/mo** third-party ([Patent Bots, Jul 2026](https://www.patentbots.com/patent-drafting-tools-comparison)); Abigail $1,200–$2,500 **UNVERIFIED**. VC-backed; Alumni Ventures still pitching it Aug 2026 ([X, 2026-08-12](https://x.com/alumniventures/status/2087561313312555481)) | SOC 2, ISO 27001, ISO 42001 |
| **PatentPal** | Browser; export Word + Visio/PPT | **Yes, the product:** method flowcharts + system block diagrams + figure descriptions from claims ([patentpal.com](https://patentpal.com/)) | Third-party cluster **$49–$99/mo** or **$199/patent**; also **$100–$200/mo** in another survey. **PatentPal does not publish a price page** — all figures **UNVERIFIED** against a primary rate card ([PatentFig, 2026-07-15](https://patentfig.ai/blog/ai-patent-drafting-tools-and-where-figures-fit); [PatentAILab](https://patentailab.com/patentpal-vs-claude-provisional-patent/)) | Cloud. Fine for software-claim diagrams; not mechanical line art |
| **Rowan Patents** (Clarivate) | Dedicated drafting environment | **Yes, the differentiator:** claims, spec, and figures in one model; move a part and every numeral and callout updates ([Clarivate](https://clarivate.com/intellectual-property/ip-management-software/rowan-patents/); [LawNext](https://directory.lawnext.com/products/rowan-patents/)) | Quote. One stale comparison mentioned a **$250/mo single-matter** SKU — **UNVERIFIED / likely obsolete**. Enterprise Clarivate contract | Cloud / Clarivate tenancy. Assembles labeled diagrams; does **not** generate mechanical line art from a photo |
| **Patentext** | Structured drafting + optional human-agent filing | Partial / structured | Platform from **$360/year**; human-drafted provisional **$2,500 flat** ([Patentext, 2026-01-07](https://patentext.com/blog/best-solve-intelligence-alternatives/)) | Cloud. Aimed at companies, not firms |
| **IP Author** | Browser | Unclear | Quote; Abigail $500–$2,000/mo **UNVERIFIED** | Cloud |
| **Edge / Patently** | Browser. Patently “Create” = AI draft; Law Firm+ adds **matter-centric** client/matter + IPMS integration ([patently.com/pricing](https://patently.com/pricing), checked 2026-08-17) | Edge: simple drawings/flowcharts, cloud-only, no Word, no on-prem ([DeepIP’s own comparison, 2026-01-18](https://www.deepip.ai/blog/best-ai-patent-drafting-tools-in-2025)). Patently markets figure tools in third-party roundups | Free search tier; Business+ / Law Firm+ **custom**. Claims UK on-prem for security marketing ([Patently LinkedIn, 2026-02-18](https://www.linkedin.com/pulse/top-10-most-secure-ai-patent-tools-2026-patently-emrde)) — **UNVERIFIED** against a technical white paper | Closest *commercial* “matter + draft + figure” pitch. Still not local-first desktop, still not CAD |
| **Qatent** | Browser (EP-origin) | Limited | Quote | Weak on life sciences (LinkedIn practitioner reviews) |
| **&AI** | Claim charts / litigation | No | Quote. Firms pair it with Solve for prosecution vs litigation charts ([Patentext Solve vs &AI, 2026-01-12](https://patentext.com/blog/solve-intelligence-vs-andai/)) | Cloud |
| **Specifio** | First-draft automation | Basic method/system schematics | Quote | Volume software-patent shops |
| **Abigail** | Pay-per-OA | No | **$99 per OA DOCX**; $25 credit packs ([Abigail, 2026-02-25](https://abigail.app/blog/guides/best-patent-prosecution-ai-2026)) | Cloud, task-priced |
| **Claude Team / ChatGPT Team / Copilot** | General agent | Copilot used by practitioners to B/W-convert drawings (hit-or-miss) | **$20–$30/user/mo** consumer/Team; Copilot for M365 ~$30 | See §6. This is what a large fraction of solos actually type into |

**Marbury Law** (named Solve customer) claims 3–4× drafting speed on fixed-fee work ([Solve case page](https://www.solveintelligence.com/)). Treat vendor case studies as marketing, not adoption census.

### 1.3 Prior-art search and portfolio analytics

| Product | Job | Price | Figures? |
| --- | --- | --- | --- |
| **Google Patents / Espacenet / USPTO ODP** | Default first pass | Free | Image search only |
| **PQAI** | Plain-English novelty | Free; **PQAI+ $20/mo** or $216/yr ([projectpq.ai/pricing](https://projectpq.ai/pricing/)); API from ~$700/mo **UNVERIFIED** in secondary writeups | No |
| **IPRally** | Graph-AI concept search + image-based search (named on pricing page) | Official page: Individual (1 user) vs Team — **no dollars**. Third parties: SourceForge **€3,000/yr starting** **UNVERIFIED**; SoftwareFinder “$24k–$72k/yr industry benchmark” **UNVERIFIED** ([iprally.com/product/pricing](https://www.iprally.com/product/pricing), checked 2026-08-17) | Image *search*, not generation |
| **Ambercite** | Citation-network search | Quote | No |
| **PatSnap** | Landscape + FTO + analytics | Startup Innovation Cloud **~$6k/yr**; standard **$12k–$40k/yr**; enterprise **$80k+** ([Beyond Elevation, 2026-06-12](https://beyondelevation.com/blog/posts/patsnap-vs-derwent-vs-orbit-comparison/)) | No |
| **Questel Orbit** | Search + analytics | **$15k–$50k+/yr**; 5-user full analytics ~$25–35k ([Wicely, 2025-12-28](https://wicely.com/resources/patent-monitoring-platform-comparison)) | No |
| **Clarivate Derwent Innovation** | Premium search | **$30k–$120k+/yr** ([Beyond Elevation, 2026-06-12](https://beyondelevation.com/blog/posts/patsnap-vs-derwent-vs-orbit-comparison/)) | No |
| **Patent Advisor / Juristat / Lexis PatentAdvisor** | Examiner / art-unit stats | Quote (overlaps Patent Bots’ free+premium stats) | No |
| **Cipher / Innography / AcclaimIP** | Corporate portfolio | Enterprise | No |

Reddit on PatSnap price: “Do you really *need* that second kidney?” ([r/patentlaw, 2025-09-25](https://www.reddit.com/r/patentlaw/comments/1nqhopt/do_any_of_your_firms_have_ai_patent_prosecution/)). That is the small-firm relationship to analytics.

### 1.4 What a solo actually pays if they buy the stack

Three realistic 2026 monthly envelopes for **one** registered practitioner:

**A. Frugal / common (what “actually adopting” looks like)**

| Item | $/mo |
| --- | --- |
| AppColl or DocketTrak | 125–150 |
| Patent Bots individual *or* ClaimMaster QA | 30–59 |
| Claude Team or ChatGPT Team (or both) | 20–50 |
| PQAI+ (optional) | 0–20 |
| Human illustrator (amortized, 4–8 sheets/mo at $50–$100) | 200–800 |
| **Total** | **~$375–$1,080** |

**B. “We bought a real patent AI”**

| Item | $/mo |
| --- | --- |
| AppColl | 150 |
| DeepIP | 350–420 |
| Patent Bots or ClaimMaster (they still want proofreading) | 30–59 |
| Illustrator (DeepIP figures do not replace this for mechanical) | 200–800 |
| **Total** | **~$730–$1,430** |

**C. Platform bet**

| Item | $/mo |
| --- | --- |
| Docket (keep AppColl — Solve is not a docket) | 150 |
| Solve Intelligence | ~775 |
| Search (still Google/PQAI, or IPRally if they can stand the quote) | 0–? |
| Illustrator (maybe less if Solve figures stick) | 0–400 |
| **Total** | **~$925–$1,300+** |

PatentFig’s own “boutique recipe” of **$400–$500/user/mo** assumes DeepIP + a cheap figure tool and **omits docketing** ([PatentFig, 2026-06-11](https://patentfig.ai/blog/building-a-patent-software-stack-figures)). Add docket and illustrator and you are in band B.

Hourly context: mid-size IP partners **$450–$800/hr**, senior associates **$350–$550** ([LeanLaw, 2025-10-16](https://www.leanlaw.co/blog/ip-law-billing-rates-the-mid-sized-firms-guide-to-maximizing-revenue-in-a-changing-landscape/)). One saved hour per month pays for ClaimMaster. DeepIP/Solve need several saved hours per week *that convert to capacity or realization*, which is why Reddit is split.

---

## 2. Who actually integrates with drawings / figures

Honest split, matching the sibling lane’s working hypothesis:

### 2.1 Real figure products (still not CAD)

| Product | What it does to figures | Numeral graph? | CAD? |
| --- | --- | --- | --- |
| **Rowan Patents** | Labeled diagrams inside the same model as claims/spec; auto-renumber | **Yes — this is the product** | No |
| **PatentPal** | Auto flowcharts + block diagrams from claims → Visio/PPT | Weak (claim-derived only) | No |
| **Solve Intelligence** | Sketch/photo/text → line art; marketing also says “labeled figures from CAD files” | Partial (platform sync) | **Import claim only** — not a CAD kernel |
| **DeepIP** | Basic sketch → line art | Reviewer flags figure-numbering errors | No |
| **ClaimMaster** | Generate figures from claims; **audit** existing figures for bad part numbers / missing descriptions | Audit, not a live graph | No |
| **Patent Bots** | Proofread figure *labels in the spec* | Label check, no drawing editor | No |
| **Edge / Patently** | Simple drawings / flowcharts | Unclear | No |
| **PatentFig AI / PatentDrawingAI** | Dedicated photo/sketch → multi-view line art; figure checker vs multiple offices | Tooling for compliance, not matter-graph | No |
| **Human illustrators** | The actual production path for mechanical/design | Human discipline | Sometimes they trace a STEP/STL the inventor sends |

PatentFig’s July 2026 roundup is the cleanest public admission from inside the figure-tool category: drafting platforms produce **claim-derived diagrams**; they do not produce mechanical line art with agreeing views, section hatching, and 37 CFR 1.84(p) numeral discipline ([PatentFig, 2026-07-15](https://patentfig.ai/blog/ai-patent-drafting-tools-and-where-figures-fit)).

Illustration market baseline (for buy-vs-build): freelancers **$25–$75/sheet**, specialist houses **$50–$150**, premium **$150–$500+** ([PatentDrawingAI, 2026-05-20](https://patentdrawingai.com/blog/patent-drawing-cost); sibling lane x3 uses $30–$150 utility / $50–$250+ design).

### 2.2 What nobody sells as a product

- A **knowledge graph** whose nodes are matter ↔ document version ↔ claim ↔ embodiment ↔ figure numeral ↔ CAD feature.
- Bidirectional **CAD → USPTO sheet** with the numeral dictionary as a typed domain, not a Visio export.
- Local-first **matter workspace** that also dockets. Patently Law Firm+ is the only commercial “matter-centric + draft + figure + IPMS” pitch, and it is quote-priced cloud (with a UK-on-prem marketing claim).

---

## 3. Practitioner adoption signal (X.com + Reddit + LinkedIn-adjacent)

### 3.1 What they say they use

**The best single primary source is the 2025-09-25 `r/patentlaw` thread** “Do any of your firms have AI patent prosecution tool subscriptions?” ([reddit.com/r/patentlaw/comments/1nqhopt](https://www.reddit.com/r/patentlaw/comments/1nqhopt/do_any_of_your_firms_have_ai_patent_prosecution/)):

- One associate at a firm that *has* bought the stack, daily use:
  1. **PatSnap** — novelty / diligence / FTO
  2. **Patent Bots** — “personal favorite”: antecedent basis, claim support, **figure labels**, art-unit prediction, examiner stats
  3. **DeepIP** — OA review / strategy (still learning)
  4. **Internal chatbot** — background paragraphs, formatting, “dumb questions”; *not* case law
  5. **Copilot** — annotate / convert drawings to black-and-white
- Replies naming alternatives: **ClaimMaster** (templates, reference-number checking — “you’re doing it wrong if you don’t use these”), **Lexis Patent Optimizer / Patent Advisor**, **Patlytics** (easier curve, “sounds kinda AI-y”), **Rowan (“bad”)**, Solve talked-to-not-tried. Preference for **Claude-based** systems; “the rest is UI/packaging.”
- Separate commenter: Patent Bots for *non-gen* drafting automation + Word macros; DeepIP for fluff-on-demand, claim suggestions once the spec exists, “general flow or block diagrams,” and a junior-level OA first pass.
- `patentmom`: “Patent Bots all the way.”

**Docket census (`r/Patents`, 2023-08-08, still the public record):** PATTSY + shadow spreadsheet; Anaqua; AppColl (billing, IDS, email-to-matter, phone-usable); DocketTrak; CPI for annuities; PerfectLaw; Foundation IP ([thread](https://www.reddit.com/r/Patents/comments/15l5xq8/which_docketing_systems_are_you_all_using/)).

**X.com, practicing patent attorney:** `@KSpikefish` (bio: patent attorney), 2026-07-13: “I'm a patent attorney, and I use AI in my patent drafting pipeline now, but I would never TRUST the thing. Definitely do not trust its claims.” ([x.com/KSpikefish/status/2076734737918660757](https://x.com/KSpikefish/status/2076734737918660757)). That is the entire high-signal X practitioner quote. He also objects to OS-level “AI data harvesting assistants” (2026-08-04).

**LinkedIn-adjacent, named partner:** Robert Fish, Fish IP Law / Patent Beast, essay dated ~2026-08-12: use AI, but *how*; do not paste confidential invention information into an unvetted public platform; ABA Formal Opinion 512 still binds; USPTO guidance does not let “the AI wrote it” excuse a filing; inventorship remains human-only after the Nov 2025 USPTO revision ([patentbeast.com](https://www.patentbeast.com/post/should-patent-attorneys-use-ai)).

**General lawyer, not patent, but the usage pattern solos actually have:** `@rwlesq`, 2026-08-15 — drafts motions in ChatGPT, or drafts himself and uses it as copy-editor / sparring partner / research assistant; would not hire an associate who cannot do this ([x.com/rwlesq/status/2088619707976839306](https://x.com/rwlesq/status/2088619707976839306)).

### 3.2 What they refuse, and why

**Quality / “it looks like a patent.”** `r/legaltech` 2025-08-02, a working drafter: tools “do a great job at making something that looks like a patent specification, but without the nuance.” Marketing has retreated from “disclosure → first draft” to “iterate paragraph by paragraph,” i.e. “you have just described thinking” ([thread](https://www.reddit.com/r/legaltech/comments/1mfr023/ai_patent_tool/)). In-house commenter `Hoblywobblesworth`: LLM specs give the same cringe as AI marketing copy; “the only people using LLMs are prep and pros volume shops”; “zero value add over accessing the base models on an enterprise subscription from OpenAI, Google, or Anthropic (that have the zero-data retention guarantees).” A patent *litigator* in the same thread: “I look forward to litigating any patents that were drafted by AI.”

**Price / ROI.** Same `r/patentlaw` thread, `The_flight_guy` (associate testing tools his firm pushed): “Many of the tools don’t justify the price tags… if you are moderately competent at coding and have access to a paid AI subscription you can vibe code a platform to do most of the tasks… All these VCs… want a serious AI hype inflated ROI and I think that’s hurting adoption.” He estimates **~25% of the job** is actually AI-useful. Counter-voice: institutional clients are *cutting budgets and requiring* AI adoption — without naming which tool.

**Confidentiality.** Three independent 2026 signals, none of them “solos love SaaS”:

1. **France CNB (12–13 Mar 2026):** do not send client/case data to Claude, ChatGPT, Gemini, or any proprietary cloud AI; “no training” clauses are “neither provable nor verifiable”; default is local open-weight models. Thread that carried this into English-speaking tech Twitter: `@jedisct1`, 2026-08-10, 53k views ([x.com/jedisct1/status/2086847271543398583](https://x.com/jedisct1/status/2086847271543398583)); primary PDF: [cnb.avocat.fr guide](https://cnb.avocat.fr/medias/guide-deontologie-ia-6a4cef5ea1d577.28126431.pdf). CCBE already calls on-prem the most secure option.
2. **Rakoff / *Heppner* (Feb 2026):** 31 Claude-generated documents a defendant later gave counsel were **not** privileged or work product. Claude is not an attorney; Anthropic’s then-privacy policy permitted disclosure to government; no reasonable expectation of confidentiality. Amplification by IP/tech lawyer `@mpeltz` (2.4M views) ([x.com/mpeltz/status/2021778562328482231](https://x.com/mpeltz/status/2021778562328482231)). Follow-up written order summarized 2026-02-17 ([x.com/mpeltz/status/2023876203397214518](https://x.com/mpeltz/status/2023876203397214518)).
3. **Robert Fish / Patent Beast:** the inventor-facing version of the same warning — unpublished disclosures, drawings, prototypes, and future product plans do not belong in consumer AI.

US solos are *not* under the CNB rule. They *are* under Rule 1.6 and ABA Formal Op. 512. The practical behavior this produces: client-permissioned firm tools (Patent Bots, DeepIP, internal bots) for some; Claude/ChatGPT for “dumb questions” and already-public art; refusal to put unfiled mechanical disclosures into a browser copilot.

**“Still charging them for it.”** Top-voted sour comment in the Sep 2025 thread: the real work is explaining to clients who hired you to write why you offloaded writing to AI. The associate’s reply — big tech clients *demanded* the tools *and* cut the budget — is the 2026 economic vice, not a product preference.

### 3.3 Adoption rates (legal generally, not patent-specific)

Clio’s 2026 solo/small survey: **71% of solos and 75% of small firms** report using AI *in some capacity*; only about a third report a revenue increase; **86% of solos / 78% of small firms have not changed pricing** ([NC Bar summary of Clio 2026, 2026-05-20](https://www.ncbar.org/nc-lawyer/2026-05/by-the-numbers-what-surveys-show-about-law-firm-ai-adoption/)). An earlier Clio cut: among those who use AI, **generic non-legal tools (ChatGPT etc.) are #1** (57% solos / 54% small), then legal research platforms, then document drafting (25/30%) ([Clio, 2026-04-08](https://www.clio.com/blog/solo-small-law-firms-highlights-2025-legal-trends/)). Widespread/universal AI adoption remains a large-firm phenomenon (35% of larger firms vs 8%/4% of solo/small in the 2025 cut).

Patent Bots’ own July 2026 survey claim: **78% of practitioners moderately to very comfortable with gen-AI in drafting** ([Patent Bots comparison](https://www.patentbots.com/patent-drafting-tools-comparison)). That is a vendor survey of people already in their funnel. Discount it.

**Inventor-side X** is the threat from the other direction: `@T9BxY5Et4XcNZ0I` (2026-05-23) claims a 20-claim JPO filing in one day with a Claude multi-agent team and no attorney; `@HomeHotYoga` (2026-05-27) says they “used AI to get a utility patent last year after my patent attorney failed me.” These are not firm-adoption evidence. They are the reason clients will keep asking “why am I paying you if Claude can draft.”

---

## 4. Buy-vs-build economics for a solo firm

### 4.1 Seat math

Assume the technical partner’s labor is already being spent (this is an in-house build, not a greenfield SaaS). Incremental *cash* a solo saves by not buying the AI layer:

| If they would have bought | Annual cash not spent |
| --- | --- |
| ClaimMaster Pro+Draft | ~$780–$900 |
| Patent Bots individual | $702 |
| DeepIP | $4,200–$5,040 |
| Solve | ~$9,300 |
| Patlytics | $9,600–$24,000 |
| PatSnap standard | $12,000–$40,000 |
| Human illustrator, 80 sheets/yr @ $75 | $6,000 |

A DeepIP + illustrator year is **$10k–$11k**. A Solve year is **~$9k plus you still docket and still illustrate mechanical**. Custom software that *only* replaces DeepIP’s Word sidebar is vanity: Claude Team is $300/year and the Reddit in-house voice already said the specialty tools add nothing over ZDR enterprise models.

Custom software that replaces **illustrator spend + numeral-graph pain + confidentiality risk** is a different equation. Eighty mechanical sheets at $75 is $6k/yr cash, plus 1–5 day turnaround, plus the attorney hours spent reconciling numerals after the illustrator delivers. That is the only layer where a build can beat a buy on *both* cash and cycle time for a mechanical-heavy solo.

### 4.2 Where lock-in actually lives

**Docketing data is the fortress.** PerspireIP’s implementation numbers: cloud-native (AppColl, DocketTrak, Rowan) **4–8 weeks**; enterprise (Anaqua, Foundation IP, PATTSY WAVE) **4–9 months**; five-year TCO **2.5–3×** first-year license; implementation **$10k–$100k+** ([PerspireIP, 2026-05-06](https://www.perspireip.com/blog/patent-docketing-software-comparison/)). The rules engine (jurisdictional due-date formulas, who updates them when the PCT national-stage rules change) is the piece a solo must not rewrite. Dual-entry and USPTO reconciliation are malpractice surfaces.

Practitioners already behave as if they do not trust one system: the shadow spreadsheet next to PATTSY is the existence proof.

**Word is the second fortress.** DeepIP, Patent Bots, ClaimMaster, and GC AI all won distribution by living in Word. Solve’s browser editor is the adoption tax every reviewer names. A local desktop that does *not* speak DOCX/track-changes will lose to a worse AI that does.

**Search databases are the third fortress.** Derwent/Orbit/PatSnap prices are paying for corpus + classification + legal-status feed, not for a chat box. Building a search engine is vanity. Wrapping PQAI + Google Patents + USPTO ODP + EPO OPS behind a local agent is not.

**Figure files and numeral dictionaries are not locked.** They are PDFs, Visio, and a Word spec. That is why PatentFig can tell firms to “slot us in after any drafting tool.” It is also why an in-house CAD capability can sit *beside* AppColl and Word without a migration.

### 4.3 Opportunity-cost argument (the vendor version)

EvenUp’s 2026 build-vs-buy piece: if a homegrown legal AI eats **20 hours/month** of a lawyer at $349/hr, that is **~$84k/year** before technical staff ([EvenUp, 2026-08-03](https://www.evenuplaw.com/blog/build-vs-buy-legal-ai/)). That argument is correct **if the builder is the billing attorney**. It is weaker if a technical partner is already building a professional desktop for other reasons (KG, local agents, CAD). The scarce resource is then *scope*, not hours: every week spent reimplementing antecedent-basis checking is a week not spent on the numeral–CAD graph.

Purple Law’s 2025-11-27 inversion piece (“build is now smarter”) is the other pole — cheaper models + agents flipped the 2010s SaaS default ([purple.law](https://purple.law/blog/build-vs-buy-legal-tech/)). For *this* firm that is only true on layers the market does not sell.

### 4.4 Switching-cost map

```
HIGH lock-in, DO NOT BUILD
  Docket rules + historical dates + annuity recs     → AppColl / PATTSY / CPI
  Premium search corpus                              → don't, or wrap free/public APIs
  Word proofreading edge cases                       → ClaimMaster / Patent Bots at $30–$60

MEDIUM lock-in, MAYBE WRAP
  Drafting assistant                                 → Claude/local LLM + house shells
  OA first pass                                      → same, plus MPEP/IFW locally
  Figure production (mechanical)                     → BUILD if CAD is already in-house

LOW lock-in, BUILD IF IT IS THE PRODUCT
  Numeral graph across claim/spec/figure/CAD
  Matter KG (this firm's matters, inventors, house style)
  Local privilege boundary
```

---

## 5. Local-first / self-hosted legal tech (the rare set)

Commercial legal tech in 2026 is cloud-default. The remaining on-prem names are dying or niche.

### 5.1 Legacy on-prem that is ending

- **Worldox:** once the small/mid firm desktop DMS. NetDocuments acquired it (2022). **On-premise support ends 2026-12-31** ([LexWorkplace, 2026](https://lexworkplace.com/imanage-alternatives/); [Docsvault, 2026-04-21](https://docsvault.com/blog/worldox-end-of-support-2026/)). The last widely deployed local-first legal DMS is being marched to the cloud in *this calendar year*.
- **iManage:** historically on-prem; 2026 product is iManage Cloud / “knowledge work platform,” with leftover hybrid estates ([iManage](https://imanage.com/); [LexWorkplace](https://lexworkplace.com/imanage-alternatives/)).
- **Time Matters / PracticeMaster / Tabs3 / PCLaw / AbacusLaw:** still hostable on a Windows box or in a private-cloud RDP farm ([Apps4Rent, 2026-07-09](https://www.apps4rent.com/blog/cloud-hosting-for-law-firms/)). Not AI, not figures, not patent-aware.

### 5.2 Products that can actually stay on the machine

| Product | What it is | Local? |
| --- | --- | --- |
| **ClaimMaster 2026** | Word plugin + GPT/Claude API *or* **Ollama / private LLM** | **Yes — the only patent-specific commercial tool with a documented local-LLM path** ([ClaimMaster, 2026](https://www.patentclaimmaster.com/blog/llm-patent-drafting-improvements-claimmaster-2026/)). A lab writeup ran it against local Llama 4 Scout for “zero-data-egress drafting” ([PatentAILab](https://patentailab.com/chatgpt-vs-claimmaster-vs-rowan-benchmark/)) |
| **Jan / LM Studio / Ollama / Open WebUI / GPT4All** | General local LLMs | Yes. Spellbook’s own 2026 privacy essay names Jan and OpenLLM as what lawyers actually try, then argues they are costly/fragile compared with ZDR cloud ([Spellbook, 2026-08-02](https://spellbook.com/learn/most-private-ai)) |
| **Sound Suite** | Local-first legal doc intelligence, 14 MCP tools, watches case directories, on-prem vector store, no external API | Self-hosted, Polyform NC ([awesome-legaltech](https://github.com/Vaquill-AI/awesome-legaltech)) |
| **AI Workdeck** | “VS Code for lawyers,” Electron, MCP agents, air-gap + Ollama | Self-hosted AGPLv3 |
| **Suzie Law** | Self-hostable Harvey alternative | OSS |
| **Legal Document Chat** | Offline PDF chat, Ollama, loopback-only | MIT |
| **Vaquill Word add-in (community build)** | Contract review on *your* OpenAI/Anthropic key | Hybrid |
| **Patently** | Markets UK on-prem | **UNVERIFIED** as a true air-gap; still a vendor-hosted story |

There is **no** local-first patent *docket*. There is **no** local-first Rowan. There is **no** local-first Solve. The empty cell in the market — desktop, local KG, figures bound to claims, optional local inference — is exactly the builder’s context.

CNB / CCBE (Europe) and the Rakoff order (US) are independently pushing sophisticated clients toward that empty cell.

---

## 6. Threat model: is a general agent eating these products?

**Short answer:** it is eating the *justification* for $350–$2,000/mo patent-drafting SaaS. It is not eating docketing, drawing compliance, or a matter graph.

### 6.1 Price collapse

AI Vortex’s May 2026 comparison (treat as commentary, numbers in the right order of magnitude): Harvey **$1,200–$2,000+/seat/mo** vs Claude Team **$25** vs ChatGPT Team **$25** — “48×.” Their claim: the $45 stack covers **75–85% of daily legal AI tasks**; Harvey’s remainder is Agent Builder, Westlaw grounding, and firm governance. Recommended solo stack: Claude + ChatGPT, **skip Harvey** ([AI Vortex, 2026-05-19](https://www.aivortex.io/legal/ai-tools/harvey-ai-vs-claude-vs-chatgpt-three-way/)).

That is general legal. Patent-specific SaaS is in the same squeeze. The Reddit associate who can “vibe code” 75% of what Solve sells at $20/mo is describing the same arbitrage. In-house `Hoblywobblesworth` said the quiet part: specialty patent tools have “zero value add” over ZDR base models.

### 6.2 MCP is how the general agent grows a spine

May 2026: Thomson Reuters **CoCounsel Legal ↔ Claude via MCP** ([LawNext, 2026-05-12](https://www.lawnext.com/2026/05/two-legal-research-providers-launch-mcp-integrations-with-claude-thomson-reuters-and-free-law-project-connect-their-data-to-ai.html); TR press). Free Law Project / CourtListener also shipped MCP. Claude for Legal (launched 2026-05-12 per secondary writeups) is described as 12 practice-area plugins, 90+ named agents including a **Claim Chart Builder**, and 20+ connectors (Westlaw, DocuSign, Clio, iManage, Everlaw, Relativity, CoCounsel) ([My Legal Academy, 2026-06-14](https://mylegalacademy.com/kb/claude-vs-chatgpt-for-lawyers)). Vaquill’s public playbook is literally “replace Harvey by buying its layers separately” on Claude + MCP ([Vaquill, 2026-05-15](https://www.vaquill.ai/blog/replace-harvey-claude-vaquill-mcp-stack)).

For a *patent* solo this means: the general agent will get **good enough** at OA summaries, claim charts, and IFW Q&A *without* DeepIP, as soon as someone wires Patent Center / PEDs / Google Patents as MCP tools. Several of those APIs are already free (USPTO ODP, EPO OPS, CourtListener).

### 6.3 What the general agent still cannot eat (2026 evidence)

- **Docket rules + dual control.** No Claude project replaces PATTSY/AppColl’s jurisdictional engine or the insurance-underwriter audit trail. PerspireIP is explicit: software does not replace a docketer.
- **37 CFR 1.84 mechanical drawings.** Copilot B/W conversion in the Sep 2025 thread is “hit or miss”; one biotech counsel called it “worthless.” That is the state of general-agent figures.
- **Privilege / sovereignty.** Rakoff + CNB. A consumer Claude chat about an unfiled invention is a disclosure. Enterprise ZDR helps; it does not create an attorney-client relationship with the model, and it does not satisfy a CNB-style “unverifiable promise” objection. Local inference does.
- **This firm’s house style, prior specs, inventor corpus, and CAD.** Those are not in Harvey and not in Solve. They are the only training set that matters.

### 6.4 X-side threat color

- `@polsia` (2026-08) is spamming vapor “Argutron / Docketdawn / Draftowl” agents that “run drafting + docket + monitoring as one loop.” Zero engagement. The *category* is obvious to every agent demo-er; the *product* is not shipping.
- `@heisrahman` (2026-03-26, 24k views): the winning pattern is **Claude Cowork sitting on a paid primary-law database**, not the model’s memory. That is MCP-shaped even when he does not use the word.
- Inventors posting “I filed with Claude, no attorney” will keep arriving. They do not replace counsel on anything that will be enforced. They *do* set client price expectations.

---

## 7. Positioning for an in-house CAD capability

### (1) Positioning statement

An in-house CAD capability beats the buy option for *this* firm only if it is **not a drafting copilot**.

It has to be the **local system of record for the physical invention**: a knowledge graph in which a matter, a document version, a claim limitation, a figure numeral, and a CAD feature are the same kind of thing — edited on-device, exported to USPTO sheets as a view, never as the source. Word remains the filing surface; AppColl remains the docket; Claude/Ollama remains the text slave. The thing you cannot buy in 2026, at any price, is **privilege-preserving, bidirectional, numeral-disciplined CAD ↔ figure ↔ claim** for a solo mechanical/electrical practice.

If the CAD feature is “Solve-like sketch-to-line-art inside our desktop,” Solve already sells that (cloud, ~$775/mo) and PatentPal sells the software-diagram version ($49–$99 **UNVERIFIED**). Building that is vanity. If the CAD feature is “the inventor’s STEP/parametric model is the embodiment, the figure set is a projection, the numerals are graph edges, and none of it left the machine,” there is no buy.

### (2) Workflows where in-house wins decisively

1. **Disclosure → parametric model → agreeing multi-view USPTO set, with the numeral dictionary as a typed graph.** This is the job Solve markets and does not finish, Rowan models and does not generate from CAD, and illustrators do slowly at $50–$150/sheet. Cycle time and numeral consistency are the attorney’s hours; sheet cost is cash. Both fall if CAD is source.
2. **Prosecution deltas on the *same* model.** Examiner wants a section, a new exploded view, a corrected numeral, a substitute sheet. The buy path is “email the illustrator, wait, re-proof ClaimMaster.” The in-house path is re-project the embodiment and regenerate the affected sheets with the graph still valid. This is also where OA text (what the examiner called out) can be an edge on the same matter node.
3. **Privilege-bound working set.** Unpublished invention, client CAD, draft claims, and prior office actions in one local graph, inferred on-box or against a ZDR endpoint the attorney chose. CNB-shaped clients, export-controlled mechanical, and anyone who read Rakoff will not put that bundle in Solve’s browser. ClaimMaster+Ollama covers *text*. Nothing commercial covers the CAD+figure half.

### (3) Where buying obviously wins and building is vanity

- **Docketing.** AppColl at $150/mo or DocketTrak at $125/mo. Building a rules engine is a malpractice hobby. Integrate (read) AppColl; do not replace it.
- **Antecedent-basis / claim-tree / IDS / examiner stats.** Patent Bots $702/yr or ClaimMaster $20–$75/mo. These are 15 years of edge cases. The Sep 2025 thread’s consensus is “you’re doing it wrong if you don’t use these,” and they are not AI.
- **Premium prior-art corpus.** Derwent/Orbit/PatSnap. Wrap PQAI + Google Patents + USPTO/EPO open APIs for first pass; buy a day of a professional searcher when the case is real.
- **Annuities / foreign-agent payments.** CPI, Dennemeyer, PatentRenewal.com. Not software you want.
- **Generic spec prose and OA first-pass narratives.** Claude Team at $25, or DeepIP if the attorney will only work in a Word sidebar and will pay $350 to stay there. Rebuilding a chat-in-a-browser patent editor is what $55M of Solve capital already did.
- **Software-patent flowcharts.** PatentPal. If the practice is methods-and-blocks, buy the $49 tool and stop.

---

## Comparison table (buy options vs this firm’s empty cell)

| Job | Default buy (2026) | $/mo signal | Figures / CAD | Local? | For this firm |
| --- | --- | --- | --- | --- | --- |
| Docket | AppColl / DocketTrak | 125–150 | No | Cloud | **Buy** |
| Proof / forms | Patent Bots / ClaimMaster | 20–75 | Label audit only | ClaimMaster can be local | **Buy** |
| Drafting prose | Claude Team or DeepIP | 25 or 350–420 | Weak | Cloud (or local LLM) | **Buy or wrap** |
| OA first pass | DeepIP / Solve / Abigail $99 | 0–775 | No | Cloud | **Wrap public IFW + local model** |
| Novelty first pass | PQAI+ / Google Patents | 0–20 | No | Web | **Wrap** |
| Landscape | PatSnap / Orbit / Derwent | 500–10,000+ | No | Cloud | **Don’t, unless a client pays** |
| Software diagrams | PatentPal | 49–199 **UNVERIFIED** | Flow/block only | Cloud | Buy if needed |
| Mechanical figures | Human illustrator | $25–$150/sheet | Yes | N/A | **Build if CAD is source** |
| Numeral graph | Rowan Patents | Quote | Yes, no CAD | Cloud | **Build** |
| Matter + doc + figure + CAD, local | *nothing ships* | — | — | — | **This is the product** |

---

## Sources log

**Vendor / price (primary or near-primary)**

- AppColl product + “monthly subscription, no long-term contracts”: https://www.appcoll.com/ (checked 2026-08-17)
- AppColl independent price: https://owlesq.com/tools/appcoll (2026)
- Patent Bots individual $702/yr: https://www.patentbots.com/pricing-individual (checked 2026-08-17)
- Patent Bots firm pricing / $100/mo min: https://www.patentbots.com/pricing-law-firm (checked 2026-08-17)
- Patent Bots competitive table (Jul 2026): https://www.patentbots.com/patent-drafting-tools-comparison
- ClaimMaster published matrix $24–$90 / $20–$75: https://www.patentclaimmaster.com/CMComparison.html (checked 2026-08-17)
- ClaimMaster 2026 local LLM: https://www.patentclaimmaster.com/blog/llm-patent-drafting-improvements-claimmaster-2026/
- NAPP Solve discount (~$1,400 = 15%): https://napp.org/solve-intelligence/ (2026-01-29)
- Solve vs DeepIP price arithmetic: https://patentext.com/blog/solve-intelligence-vs-deepip/ (2026-07-22)
- Patentmaker €249/mo: https://patentmaker.eu/pricing/
- DeepIP acquires PatentMaker: https://www.globallegalpost.com/news/ai-patent-platform-start-up-deepip-acquires-german-ai-assistant-patentmaker-972717147 (2026-06-10)
- Patently pricing (Free / Business+ / Law Firm+ matter-centric): https://patently.com/pricing (fetched 2026-08-17)
- IPRally plans, no dollars, image-based search listed: https://www.iprally.com/product/pricing (fetched 2026-08-17)
- PQAI+ $20/mo: https://projectpq.ai/pricing/
- PatentPal product (claims → spec + Visio figures): https://patentpal.com/
- Rowan at Clarivate: https://clarivate.com/intellectual-property/ip-management-software/rowan-patents/
- Solve “figures from CAD files”: https://www.solveintelligence.com/blog/post/solve-intelligence-ranked-1-ip-platform-by-the-worlds-leading-law-firms (2026-03-24)
- Solve home / Marbury 3–4×: https://www.solveintelligence.com/

**Comparisons / market surveys**

- PerspireIP docketing comparison (prices, impl. times, TCO): https://www.perspireip.com/blog/patent-docketing-software-comparison/ (2026-05-06)
- PatentFig tools + figures gap: https://patentfig.ai/blog/ai-patent-drafting-tools-and-where-figures-fit (2026-07-15)
- PatentFig stack recipes: https://patentfig.ai/blog/building-a-patent-software-stack-figures (2026-06-11)
- Patentext Solve alternatives: https://patentext.com/blog/best-solve-intelligence-alternatives/ (2026-01-07)
- PatSnap / Derwent / Orbit dollars: https://beyondelevation.com/blog/posts/patsnap-vs-derwent-vs-orbit-comparison/ (2026-06-12)
- Orbit range: https://wicely.com/resources/patent-monitoring-platform-comparison (2025-12-28)
- Illustration $25–$500/sheet: https://patentdrawingai.com/blog/patent-drawing-cost (2026-05-20)
- Harvey vs Claude $1,200 vs $25: https://www.aivortex.io/legal/ai-tools/harvey-ai-vs-claude-vs-chatgpt-three-way/ (2026-05-19)
- CoCounsel MCP: https://www.lawnext.com/2026/05/two-legal-research-providers-launch-mcp-integrations-with-claude-thomson-reuters-and-free-law-project-connect-their-data-to-ai.html (2026-05-12)
- Vaquill “replace Harvey with Claude+MCP”: https://www.vaquill.ai/blog/replace-harvey-claude-vaquill-mcp-stack (2026-05-15)
- Worldox EOL 2026-12-31: https://lexworkplace.com/imanage-alternatives/ ; https://docsvault.com/blog/worldox-end-of-support-2026/ (2026-04-21)
- Spellbook on local models: https://spellbook.com/learn/most-private-ai (2026-08-02)
- Awesome-legaltech local/self-host names: https://github.com/Vaquill-AI/awesome-legaltech
- Clio solo AI stats via NC Bar: https://www.ncbar.org/nc-lawyer/2026-05/by-the-numbers-what-surveys-show-about-law-firm-ai-adoption/ (2026-05-20)
- Clio tool mix: https://www.clio.com/blog/solo-small-law-firms-highlights-2025-legal-trends/ (2026-04-08)
- EvenUp build-vs-buy $84k: https://www.evenuplaw.com/blog/build-vs-buy-legal-ai/ (2026-08-03)
- IP billing rates: https://www.leanlaw.co/blog/ip-law-billing-rates-the-mid-sized-firms-guide-to-maximizing-revenue-in-a-changing-landscape/ (2025-10-16)
- CM Law docket intake $85/hr: https://www.cm.law/wp-content/uploads/2024/08/CM-Law-IP-Practitioner-Cost-Guide-2026.pdf
- Abigail competitor price table (treat as UNVERIFIED): https://abigail.app/blog/guides/cheapest-patent-ai-tool-2026 (2026-02-25)
- DeepIP on Edge (cloud-only, simple figures): https://www.deepip.ai/blog/best-ai-patent-drafting-tools-in-2025 (2026-01-18)

**Practitioner primary sources**

- r/patentlaw tool census: https://www.reddit.com/r/patentlaw/comments/1nqhopt/do_any_of_your_firms_have_ai_patent_prosecution/ (2025-09-25)
- r/legaltech quality refusal: https://www.reddit.com/r/legaltech/comments/1mfr023/ai_patent_tool/ (2025-08-02)
- r/Patents docket census: https://www.reddit.com/r/Patents/comments/15l5xq8/which_docketing_systems_are_you_all_using/ (2023-08-08)
- Robert Fish / Patent Beast: https://www.patentbeast.com/post/should-patent-attorneys-use-ai (~2026-08-12)
- `@KSpikefish` uses AI, does not trust claims: https://x.com/KSpikefish/status/2076734737918660757 (2026-07-13)
- `@jedisct1` CNB thread: https://x.com/jedisct1/status/2086847271543398583 (2026-08-10); CNB PDF https://cnb.avocat.fr/medias/guide-deontologie-ia-6a4cef5ea1d577.28126431.pdf
- `@mpeltz` on Rakoff / Claude privilege: https://x.com/mpeltz/status/2021778562328482231 (2026-02-12); order recap https://x.com/mpeltz/status/2023876203397214518 (2026-02-17)
- `@rwlesq` lawyer ChatGPT workflow: https://x.com/rwlesq/status/2088619707976839306 (2026-08-15)
- `@T9BxY5Et4XcNZ0I` inventor Claude filing: https://x.com/T9BxY5Et4XcNZ0I/status/2058198173596942731 (2026-05-23)
- Patlytics VC post: https://x.com/alumniventures/status/2087561313312555481 (2026-08-12)

**UNVERIFIED cluster (secondary blogs, not vendor rate cards):** Solve $1,500–$3,000/mo (Abigail); Patlytics $800–$2,000; IPRally $24k–$72k/yr and €3,000/yr; PatentPal $49–$199; DeepIP $350–$420 (widely repeated, not on deepip.ai at check time); Black Hills $1,000–$2,500/mo; Patently UK on-prem as a true air-gap; Solve “figures from CAD” as more than an import.
