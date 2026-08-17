# AI Automation of Patent Figures and the Patent-Illustration Market

**As of:** 2026-08-17
**Lane:** x3-patent-figure-automation
**Reader:** technical partner to a solo US patent attorney (build vs buy)
**Method:** vendor product pages, independent reviews, illustration-house rate cards, USPTO drawing rules, X.com practitioner/founder posts
**Confidentiality note:** public marketing, pricing, and social evidence only. No client disclosure or unpublished figure content.

---

## How to read this report

For every product or service: **(a)** what it actually does to *figures* (not just spec text), **(b)** reference-numeral handling, **(c)** integration surface / whether an outside agent or API can drive it, **(d)** deployment and confidentiality posture, **(e)** price signal.

Claims that could not be verified against a primary page or a dated post are marked **UNVERIFIED**. Dates on citations are publication or last-checked dates.

---

## Executive snapshot

**Most 2024–2026 “AI patent” vendors still sell words.** Of the twelve named platforms, only **PatentPal, Solve Intelligence, DeepIP, Edge/Patently Create, Rowan Patents, Qatent, and Patlytics** touch drawings at all. **&AI, IPRally, Patentfield, and Ambercite do not generate filing figures.** No current product named **Henry** exists in patent drafting (Henry.ai is commercial real estate; Henry H. Perritt is an independent reviewer).

**Two dedicated figure products appeared in 2025–2026 and are the only self-serve SKUs a solo firm can buy without a sales call:** [PatentDrawingAI](https://patentdrawingai.com/) ($19–$399/mo) and [PatentFig AI](https://patentfig.ai/) (free trial; paid tiers advertised at $20–$80/mo on yearly billing). Both convert photo/sketch/text → black-line art, auto-place numerals, and claim 37 CFR §1.84 sheet assembly. Neither is CAD-faithful, and neither is a closed disclosure → complete figure-set + numeral-map pipeline.

**The economic baseline any automation must beat is still a human illustrator, not another SaaS seat.** Live 2026 rate cards:

| Tier | Typical rate | Turnaround | Source |
| --- | --- | --- | --- |
| Offshore / India-staffed houses | **$28–$39 / sheet or figure** | 1–5 days | PatDraw $28/sheet; Menteso $29 utility / $39 design; Patent Express “as low as $39”; Teak IP $35/figure |
| US specialized firms | **$50–$150 / figure**; design higher | 2–7 days | SNS $30–$65 utility (min $500/set), $80–$125 design (min $700); QuickPatents $100 utility / $125 design |
| Premium / US-based senior | **$150–$500+ / sheet** | 3–10 days | PatentDrawingAI 2026 survey; Reddit US-based design artists $50–$300+/pg |
| Dedicated AI figure tools | **~$2–$4 effective / drawing** on subscription | minutes | PatentDrawingAI public pricing |
| Drafting-suite seats that include figures | **~$350–$775 / user / month** | n/a | DeepIP $350–$420 (third-party); Solve ~$9,300/yr (NAPP-inferred) |

**Numeral consistency is a solved *proofreading* problem and an unsolved *generation* problem.** ClaimMaster and Patent Bots already audit spec ↔ figure numerals if the figures have a text layer. Rowan / DeepIP / Patlytics keep a live numeral dictionary *if you draft inside their workspace*. Nobody sells a robust “OCR numerals + lead-line association from an arbitrary illustrator PDF → spec cross-check → attorney-grade report” as an agent-driveable API.

**X.com evidence is thin and vendor-heavy.** Independent practitioner posts about AI figures in 2026 are scarce. The useful ones are failure/limit posts, not launch videos: CAD apps still cannot emit patent drawings; DeepIP’s own PM says attorney sign-off evals are the hard problem; a NotebookLM/Gemini demo maps numerals on *already published* PDFs, which is not drafting. Marketing accounts (PatentFig, Patent AI Lab) dominate the keyword space.

**Build-vs-buy verdict (disclosure → figure set + numeral map): build the pipeline, buy the audit layer and the human last-mile.** Strongest buy case is ClaimMaster/Patent Bots for numeral QC plus a $29–$100/sheet illustrator for design patents and anything geometric. Strongest build case is local CAD → hidden-line 2D + a first-class numeral graph, because no commercial product produces a CAD-faithful, confidential, agent-driveable figure set from a disclosure.

---

## 1. Named AI patent-drafting vendors: do they touch figures?

### 1.1 PatentPal

**Figures:** Yes, but only *logical* figures. Homepage: drop claims → “Generate spec and figures with one click” → export Word + Visio (or PowerPoint). Generated artifacts are (1) flowcharts for methods, (2) block diagrams for systems/devices, (3) detailed descriptions of those generated figures, (4) abstract/summary. ([patentpal.com](https://patentpal.com/), last checked 2026-08-17)

This is claim-tree expansion into boxes-and-arrows, not photo/CAD → black-line utility art. AIPLA reviewer Henry H. Perritt, writing about the same generation class of tools, called early auto-flowcharts “fairly detailed but primitive” and recorded an IP Author run that hallucinated drawings for a different invention entirely. ([AIPLA Innovate review](https://www.aipla.org/list/innovate-articles/ai-aids-for-patent-prosecution---product-review), undated; still live 2026-08-17)

**Numerals:** Implied by flowchart/block-diagram generation. No public claim of cross-figure numeral dictionary or figure-PDF OCR.

**Integration / agent-driveable:** Browser app at `draft.patentpal.com`. Export to Visio/Word. **No public API.** An outside agent cannot drive it.

**Deploy / confidentiality:** Cloud SaaS. Terms allow price changes; no SOC 2 / zero-retention page found on the marketing site. Treat as **UNVERIFIED** for pre-publication invention data.

**Price:** Not published. Third-party 2026 survey: “roughly $100–$200/month for individual users” — **UNVERIFIED** (not on PatentPal’s own site). ([patentailab.com PatentPal vs Claude](https://patentailab.com/patentpal-vs-claude-provisional-patent/), crawled 2026-08-14)

---

### 1.2 Solve Intelligence

**Figures:** Yes, and first-class. Homepage: “Handle figures, chemical structures, biological sequences, and more. Generate, analyze, and edit figures…” ([solveintelligence.com](https://www.solveintelligence.com/), crawled 2026-08-14)

Product article (2025-05-10) is the most detailed vendor write-up in this class:

- Image → patent figure (sample screenshot of input photo → generated line figure)
- Auto-labeling: NLP + computer vision matching spec part names/numerals to drawing elements
- Visual cleanup: line-weight standardization, layout, fonts, geometric distortion correction
- Text-to-drawing: example prompt “Hand Holding iPhone”
- Suggest figures for an application
- Integrated with the drafting system so figure changes sync with text/claims

([Solve: AI for Patent Drawings](https://www.solveintelligence.com/blog/post/ai-for-patent-drawings-figure-generation-and-labeling), 2025-05-10)

Independent 2026 comparison (Patentext, 2026-07-22): “Solve treats figures as a first-class feature. You can describe a diagram in text, upload a napkin sketch, or import a photo, and Solve converts it to patent-compliant line art.” Same review: software patents are the sweet spot; mechanical/chemistry/biotech need more iteration. ([patentext.com Solve vs DeepIP](https://patentext.com/blog/solve-intelligence-vs-deepip/), 2026-07-22)

**Numerals:** Auto-label against spec; feedback loops claimed against “jurisdictional rules.” Not described as figure-PDF OCR of an outside illustrator’s set.

**Integration / agent-driveable:** Browser platform. Export to Word. **No public figure API.** You work inside Solve; an outside agent cannot drive generation. Patentext: “Solve is primarily a self-contained platform.”

**Deploy / confidentiality:** SOC 2 Type 2, ISO 27001, ISO 42001, GDPR, CCPA. EU customers can process on EU servers (Maiwald 2026 partnership write-up). Trust center: [trust.solveintelligence.com](https://trust.solveintelligence.com/). Still **cloud**. Pre-publication drawings leave the firm.

**Price:** Not published. Patentext infers ~**$9,300/user/year (~$775/mo)** from a NAPP 15% discount valued at ~$1,400. **UNVERIFIED** (promotional inference). Series B $40M Dec 2025; vendor claims 400+ IP teams, 8-figure ARR, profitable. ([@SolveIntel](https://x.com/SolveIntel/status/1998461020440801329), 2025-12-09)

---

### 1.3 DeepIP

**Figures:** Yes. Dedicated product page: convert sketches, photos, flowcharts, diagrams, or text descriptions into “patent-office-compliant figures.” Claims USPTO + EPO formal-drawing rules, in-app figure editor, Word add-in. ([deepip.ai/products/patent-drawings-generation](https://www.deepip.ai/products/patent-drawings-generation), crawled 2026-08-14)

FAQ (quoted):

> “An AI Patent Drawing tool uses computer vision and generative models to convert sketches, photos, or text descriptions into patent-compliant line art. Upload your inputs and DeepIP will auto-detect edges and reference points, and produce cleanline drawings figures that meet USPTO and EPO formal-drawing rules.”

> “Simply click a call-out to rename or renumber it; the change propagates across every instance of that label in your spec, claims, and figures.”

Patentext 2026-07-22 is more cautious than DeepIP’s marketing: DeepIP figure generation is “more basic… lacks fine control. You probably still need a dedicated illustration service for complex figures.” ([patentext.com](https://patentext.com/blog/solve-intelligence-vs-deepip/))

DeepIP PM Robin Kuhn on X (2026-03-22): the product includes “Drawings, complex chemical compounds, materials science,” and “The hard part is evals. Getting AI to produce work a patent attorney will sign off on is a much more specific problem than making something that sounds plausible.” ([@robinKnFR](https://x.com/robinKnFR/status/2035662712777080859), 2026-03-22)

**Numerals:** Best-in-class *inside the suite*: click-rename propagates across spec, claims, and figures. This is a live dictionary, not an OCR audit of an imported illustrator PDF.

**Integration / agent-driveable:** Microsoft Word add-in + Outlook + docketing. **REST API is publicly advertised** (“Build custom integrations with a comprehensive, well-documented API”). This is the only named drafting vendor with a stated outside-agent surface. Whether the drawings endpoint is in the public API is **UNVERIFIED** (docs are behind sales).

**Deploy / confidentiality:** Azure US or EU. SOC 2 Type II, ISO 27001, ISO 42001, GDPR, §203 StGB. Claims: never trains on customer data; OpenAI via Azure zero-retention API; “no human access”; drawings/specs deletable; “no data retention policy.” ([deepip.ai/security](https://www.deepip.ai/security), last checked 2026-08-17). Still **cloud**. Drawings transit Microsoft + model hosts.

**Price:** Drawings SKU not published. Third-party listings (Patentext, PatentDrawingAI comparison): **$350–$420/user/month**. **UNVERIFIED** as DeepIP-official.

---

### 1.4 Edge (Patently)

**Identity:** Edge Innovations shipped a figure product in 2023. By 2026 the consumer face is **Patently Create / Onardo**. Patentext lists them as the same figure-editor lineage. Treat as one product family unless a live Edge SKU is confirmed separately.

**Figures (Edge, 2023-11-28, still live):**

1. Text-to-image in the Figures tab → four B&W candidates, “USPTO submission-ready,” auto color-adjust. **Best for conceptual/demonstrative figures. Will not generate flowcharts or Markush chemicals.** CAD upload → line drawing: *not supported*; use CAD’s own HLR export, then label in Edge.
2. Assistant generates a detailed description of a selected figure using every label.

([blog.withedge.com](https://blog.withedge.com/p/assistant-magic-text-to-figure-detailed-spec), 2023-11-28)

**Figures (Patently Create, 2026):** “Onardo drafts the text of the patent specification Figure-by-Figure.” Testimonial on the Create page: *“Patently is the drafting robot with the best UI and best Figure editor.”* — Martin Schweiger. ([patently.com/create](https://patently.com/create), published 2026-08-14)

Patentext 2026 directory: Onardo “auto-labels parts and even suggests flow diagrams, keeping text and illustrations synchronized.” ([patentext.com tool list](https://patentext.com/blog/a-complete-list-of-ai-patent-tools/), crawled 2026-08-16)

**Numerals:** Label generation + referencing (prior Edge update). Auto-label on annotate.

**Integration / agent-driveable:** Browser app (`app.patently.com`). **No public API found.**

**Deploy / confidentiality:** Cloud. Security pages exist (`trust.patently.com`, Data Security and AI Tools). Specific figure-retention policy **UNVERIFIED** in this pass.

**Price:** Contact / demo. Not published.

---

### 1.5 &AI

**Figures:** **Does not generate filing drawings.** Litigation workspace: claim charts, prior-art search, invalidity contentions, “Andy” agent. Patentext comparison table: Figure generation = **—** for &AI vs **✓** for Solve. ([patentext.com Solve vs &AI](https://patentext.com/blog/solve-intelligence-vs-andai/), 2026-01-12)

What it *does* do with figures: search using figures from a patent; LinkedIn (2025, Caleb Harris) announced **live figure annotations** — draw on patent figures and accused-product images, save named versions, reuse across charts. That is litigation markup, not §1.84 generation.

**Numerals:** None for drafting.

**Integration / agent-driveable:** Browser platform + Andy agent (multi-step *litigation* workflows). 7-day trial at `platform.tryandai.com`. **No figure-generation API.**

**Deploy / confidentiality:** SOC 2 Type II. “&AI and subprocessors never train on your or your clients' data, with strict zero data retention.” SAML SSO, encryption in transit/at rest. ([tryandai.com](https://www.tryandai.com/), last checked 2026-08-17)

**Price:** Custom / credit-based, volume-influenced. Not published.

---

### 1.6 IPRally

**Figures:** **Does not generate drawings.** Search/analytics. 2022 feature **“Smart reference numbers”** overlays part *names* on *already-published* patent drawings via computer vision, plus auto-rotate. Hover mode for dense figures. This is a *reading* aid, not a drafting aid. ([IPRally blog](https://www.iprally.com/news/patent-drawing-reviews-simplified-smart-reference-numbers), 2022-04-08)

**Numerals:** Extracts/associates numerals on published figures for search UX. Closest commercial implementation of “figure → numeral overlay,” but only on the corpus, not on the attorney’s unpublished set.

**Integration / agent-driveable:** Web search platform. No drafting API.

**Deploy / confidentiality:** Cloud search over public patents. Uploading an *unpublished* drawing for search is a different (and riskier) question — **UNVERIFIED** whether customer-upload image search exists.

**Price:** Enterprise. Not relevant to figure production.

---

### 1.7 Rowan Patents (Clarivate)

**Figures:** Yes — the most mature *integrated drawing editor* in this list, predating the GenAI wave. Desktop (Clarivate also describes browser/desktop hybrid) application: built-in drawing tool “designed for the unique needs of patent application drawings including numbering synchronized with other parts of the application.” Auto part numbering. Flowchart tools. Import an illustrator image and apply numbers. Import PDF pages from a published patent, crop, cover old numbers. Auto-generate flowcharts and “other figures.” Chemistry module for structures. ([Clarivate Rowan Patents](https://clarivate.com/intellectual-property/ip-management-software/rowan-patents/), last checked 2026-08-17)

Perritt AIPLA review (still the best independent hands-on): “Using these tools, a user can generate a set of drawings more than adequate for initial submission to the patent office.” Also: Rowan “is much more interactive than IP Author”; it flags every claim term that does not also appear in the spec **and in a drawing**.

**Numerals:** This is Rowan’s original value. Terms Manager + automatic part numbering + live propagation. Review module: “Check term usage across claims, specification and figures.” Predicted “drawing parts lists.”

**Integration / agent-driveable:** Desktop app + optional cloud/local LLMs for *text* assists. **No public agent API for figures.** You must live in Rowan. Switching cost is leaving Word.

**Deploy / confidentiality:** Clarivate enterprise. Perritt: “Neither [IP Author nor Rowan] puts user provided information or software generated drafts into the Cloud, and every external exchange is encrypted.” Rowan analytics module optionally sends pieces to Rowan servers; Rowan “does not keep copies.” GenAI: “local or cloud-based language models.” Best posture of the drafting-suite class **if** local models are selected.

**Price:** Perritt: “roughly $500 per seat per month”; attorney license includes support staff. **UNVERIFIED** as current Clarivate list price (review is older). Clarivate claims 36% average productivity gain, 18% fewer OAs, 44% fewer §112 rejections — vendor stats, treat as marketing.

---

### 1.8 Patentfield

**Figures:** **Does not generate drawings.** JP/EN AI patent search + analytics. Relevant figure-adjacent feature: **similar-image search** over gazette drawings (multi-view, design 6-view, exterior + interior). That is prior-art image retrieval, not production. ([patentfield.com](https://patentfield.com/), last checked 2026-08-17)

**Numerals:** None.

**Integration / agent-driveable:** Web search. BASIC plan ¥100,000/year or ¥10,000/month. Not a figure pipeline.

**Deploy / confidentiality:** Cloud JP-centric SaaS. Public-patent corpus.

---

### 1.9 Henry (patent drafting)

**No current product.** Searches for “Henry” + patent drafting AI resolve to:

- Henry H. Perritt, Jr.’s AIPLA product review (author, not vendor)
- Henry Patent Law Firm (a firm)
- Henry.ai (YC commercial-real-estate decks — unrelated)

**UNVERIFIED / not a figure vendor.** Included here so the named list is complete.

---

### 1.10 Qatent (Questel)

**Figures:** Thin. Questel product page: NLP plus “It can also generate accompanying diagrams outlining the invention in simple steps.” Pinch’s 2025 software roundup: “These early outlines aren’t full patent drawings but serve to illustrate invention steps… maintain consistency between text and figures.” Patentext 2026: “basic AI-assisted diagram rendering for mechanical and software inventions.” Perritt’s earlier hands-on: “The figures it generated were garbled and the flow chart was generic. The brief description of drawings was generic with things like ‘Figure 4 shows Block Chart 2.’” ([Questel AI drafting](https://www.questel.com/patent/ai-assistants-patent-productivity/patent-drafting-software-with-ai/), crawled 2026-08-13; [patentext.com](https://patentext.com/blog/a-complete-list-of-ai-patent-tools/); AIPLA review)

**Numerals:** Relation tables for *claim-term* alignment, not drawing-numeral OCR.

**Integration / agent-driveable:** Browser, Questel ecosystem. **No public figure API.**

**Deploy / confidentiality:** Questel enterprise (Orbit adjacency). Marketed as “Secure, Confidential, Self-Service.” Details **UNVERIFIED** in this pass.

**Price:** Flexible monthly subscription; contact sales.

---

### 1.11 Patlytics

**Figures:** Yes. Blog 2026-02-18: **Sketch to Figure Conversion** — upload hand-drawn sketches or photographs → “clean, structured drawings,” automated lead lines, assigned reference numerals, “filing-ready starting point.” Side-by-side figure viewer in the drafting workspace. ([patlytics.ai blog](https://www.patlytics.ai/blog/how-patlytics-transforms-patent-sketches-figures), 2026-02-18)

Series B $40M (banner on site, 2026). Agent launch event advertised Aug 2026.

**Numerals:** **Shared reference-numeral system.** Update a label in one figure → change applies across every figure sharing that numeral. Explicitly framed as the “label drift” / §112 support problem.

**Integration / agent-driveable:** Web platform. Agent product launching (Aug 2026). **No public drawings API documented.** Demo-gated.

**Deploy / confidentiality:** Cloud. Enterprise customer list (Quinn Emanuel, Foley, McDermott, Rivian, Canon, Sanofi, etc.). Specific figure-retention policy **UNVERIFIED**.

**Price:** Contact / demo. Patentext: “built for larger teams… solo practitioners may find it more complex (and costly).”

---

### 1.12 Ambercite

**Figures:** **Does not generate drawings.** Citation-graph prior-art search. UI shows “representative image” of hit patents and “interactive graphics” of similarity networks. No drawing editor, no numeral manager. ([ambercite.com/ambercite-ai](https://www.ambercite.com/ambercite-ai), crawled 2026-08-12)

**Numerals / integration / price:** Search tool. Irrelevant to figure production.

---

### 1.13 Other vendors that actually touch drawings

These are not on the named list but they are the products a solo firm would actually *buy* for figures.

| Product | What it does to figures | Numerals | Agent/API | Deploy | Price |
| --- | --- | --- | --- | --- | --- |
| **[PatentDrawingAI](https://patentdrawingai.com/)** | Photo / sketch / CAD *render* (PNG/JPG/WebP only — no native STEP/DWG) → line art → region edit in English → §1.84 sheet assembly → PDF/PNG/SVG/DXF. Utility + design (design uses shading/broken lines, not Auto-Label). | Auto-Label places numerals; flags reused numerals across figures; **does not** sync into a Word spec. | Web app. **No public API.** | Cloud. “Never trains AI”; image bytes only to AI provider; no client/matter context sent; SOC 2 subprocessors; HMAC signed URLs. Still cloud. | Starter $19/25 cr (~5 drawings); Pro $79/125 cr; Firm $199/400 cr; Team $399/1,000 cr. New drawing = 5 credits; AI redraw = 1 credit. ~$2–$4/drawing. |
| **[PatentFig AI](https://patentfig.ai/)** | Text / sketch / photo / CAD screenshot → line art, 3D renderings, flowcharts. Multi-office (USPTO, CNIPA, EPO, JPO, KIPO, PCT). Chat-to-modify. Versioning. Figure checker. Vectorize / DPI upscale. | “AI adds reference numerals and leader lines.” Tutorial video 2026-05-17. | Web app. **No public API.** | Cloud. “No training on your work”; third-party providers not permitted to train; delete projects; DPA/NDA for business. Testimonials look templated — treat names as **UNVERIFIED**. | Free 20 cr/mo; Basic $20/mo yearly (500 cr, ~50 figs); Pro $40; Enterprise $80. Monthly list $50/$100/$200. |
| **[Pinch](http://pinchpatentdrawings.com/)** | **CAD (STP/STL) → multi-view USPTO/PCT drawings in <10 min.** Token: $50 for a full conversion “up to 21 drawings.” This is the only product in the set that starts from a real solid, not a picture of a solid. | Not marketed as a numeral dictionary. | Web converter. **No public API found.** Site 403’d on direct fetch 2026-08-17; pricing from secondary pages. | Cloud CAD upload. Confidentiality page **UNVERIFIED**. | $50 / 21-drawing token, tokens never expire. ([pinch SmartDraw alt](https://pinchpatentdrawings.com/best-smartdraw-alternative-patent-drawing/), 2025-05-26) |
| **ClaimMaster** | Does **not** generate figures. Loads Visio / PDF-with-text-layer / PPT / Word figures and **proofreads** them. | **Best existing numeral auditor.** Checks: same number / different names; same name / different numbers; out-of-order introduction; spec-only or figure-only numbers; figures not described; missing Brief Description entries; sheet margins/fonts per MPEP. Hover-annotate numerals with part names; export annotated PDF + parts table. | Word add-in. **No agent API.** | Local Word plugin. Strong confidentiality (document stays on disk). | Typical Word-plugin seat; exact 2026 list **UNVERIFIED**. ([ClaimMaster tutorial](https://www.patentclaimmaster.com/blog/tutorial-checking-part-numbers-names/)) |
| **Patent Bots** | Does **not** generate figures. Explicit: “Unlike some competitors, Patent Bots does not generate patent figures or flowcharts from technical inputs.” Rules-based Brief Description + Visio/PPT flowcharts from existing text. GenAI can *read* figures (2025 LinkedIn). | Reference Label Tracker (autocomplete `12//`); proofreading: labels missing/inconsistent vs figures; figure-number presence checks. Requires figures with extractable text. | Word add-in. Zero data retention on GenAI. **No figure API.** | Local Word + optional cloud GenAI with ZDR. | Company pricing exists (`patentbots.com/pricing-company`); per-attorney list **UNVERIFIED**. ([feature overview](https://www.patentbots.com/feature-overview), 2026-07-08) |
| **PowerPatent** | Marketing: upload disclosure + annotated figures → figure-aware spec language; “take rough sketches… clean professional drawings”; “reference numbers that match your written description.” Heavy founder-marketing tone; independent figure-quality evidence **UNVERIFIED**. | Claimed consistency checks. | Cloud. No API found. | Cloud + “real attorneys review.” | Patentext directory listed ~$99/mo in one 2026 roundup — **UNVERIFIED**. |
| **IP Author (Dolcera)** | Perritt: generates “a fairly detailed but primitive flowchart” + figure descriptions from a brief disclosure. Also: hallucinated drawings for a different invention; endless loop when claims + description both supplied. | Generated with the flowchart. | Browser. No modern API found. | Perritt: no user drafts into “the Cloud” — **stale; re-verify**. | Perritt-era: $499/user/mo unlimited inventions; $1,499/user/mo drafting+image-based claims+search+OA. **Stale.** |
| **Patentext** | Not a figure tool. Company-facing invention platform + registered-agent drafting service. Provisional $2,500 flat. Useful as the “don’t DIY” alternative. | n/a | Platform + services. | Cloud + human agents. | Platform from $360/yr; services separate. |

---

## 2. Dedicated patent-illustration services and the economic baseline

Any in-house automation has to beat **dollars, days, revision policy, and confidentiality**, not just “AI is cooler.”

### 2.1 Live 2026 rate cards (primary pages)

| Vendor | Utility | Design | What’s included | Turnaround | Notes |
| --- | --- | --- | --- | --- | --- |
| **PatDraw / thepatentdrawings.com** | **$28/sheet** (up to 2 figures) | marketed separately | Professional sheets | press 2025-07-08 | Effectual Services house. Aggressive offshore price. ([press](https://www.effectualservices.com/press-release/patdraw-launches-professional-patent-illustrations-at-just-28-per-sheet)) |
| **Menteso** (ex–Patent Drawing Experts) | **$29/sheet** | **$39/sheet** | Unlimited iterations; 1–4 days; AutoCAD/Visio/Corel/SolidWorks | 1–4 days | India process, US billing, NDA checkbox. Openly: “Drawing Excellence Processes in India.” ([menteso.com/patent-drawings](https://menteso.com/patent-drawings/)) |
| **Teak IP Services** | **$35/figure** | **$35/figure** | First project ≤10 figures free; attorney-supervised QC; USPTO/PCT/EPO | **2–3 business days** standard | US IP-attorney CEO. Photos, sketches, CAD, prototypes. ([teakipservices.com](https://teakipservices.com/services/patent-drawings/)) |
| **Patent Express** (Trademarkia / LegalForce) | **“as low as $39/sheet”** | included in formal-drawings SKU | Labels, lead lines, multi-view; iterations no extra charge | **3–5 business days** | Interactive price widget on page rendered $0 in scrape — treat headline $39 as marketing floor. ([patentexpress.com](https://www.patentexpress.com/formal-patent-drawings)) |
| **SNS Patent Drafting** (Los Angeles) | **$30–$65+/figure**, **min $500/set** | **$80–$125+/figure**, **min $700/set** | Unlimited edits on *their* drawings; OA corrections $80–$120+/fig, min $500 | “prompt” | US firm. PCT $30–$120+/fig. Flowcharts $30–$65+. ([snspatentdrafting.com/pricing](https://www.snspatentdrafting.com/pricing)) |
| **QuickPatents** (Las Vegas) | **$100/sheet** | **$125/sheet** | As many views as fit; 2 free minor revision cycles; Illustrator → PDF | **1 week** | Extra cycles hourly. Need all 7 design views up front. ([quickpatents.com/drawings](https://www.quickpatents.com/drawings/)) |
| **Artworks IP** (McLean, VA) | quote | quote | **100% US-based draftsmen**; same-day quotes | quote | No public per-sheet number. Premium confidentiality posture. ([artworksip.com](https://www.artworksip.com/patentdrawings.html)) |
| **IP Illustration** | quote | quote | 100% US in-house, “zero outsourcing” | quote | Confidentiality is the product. ([ipillustration.com](https://ipillustration.com/)) |

### 2.2 Aggregated market ranges (vendor-written but sourced)

PatentDrawingAI’s May 2026 cost guide (cites USPTO fee schedule, 37 CFR 1.84, MPEP 608.02, SNS pricing) is the cleanest single 2026 compilation, with the obvious self-interest caveat:

- Freelancers: **$25–$75 / sheet**, 3–7 days
- Specialized firms: **$50–$150 / sheet**, 2–5 days
- Premium: **$150–$500+ / sheet**, 3–10 days
- 10-sheet complex utility: **$750–$3,000** traditional
- Hidden costs: rush, extra revisions, format conversion (EPS/TIFF/AI), minimum order quantities, international adaptation

([patentdrawingai.com/blog/patent-drawing-cost](https://patentdrawingai.com/blog/patent-drawing-cost), 2026-05-20)

FindLaw (updated 2024-05-22, still cited): professionals **$75–$150 per page**. ([findlaw.com](https://www.findlaw.com/smallbusiness/intellectual-property/the-basics-of-patent-drawings.html))

LeanLaw design-patent guide (2026-01-08): illustrators **$250–$600 per design-patent set**. ([leanlaw.co](https://www.leanlaw.co/blog/a-guide-to-design-patent-flat-fees-making-high-volume-design-filings-profitable-for-intellectual-property-law-firms/))

r/patentlaw US-based design artists (2023-12-21, still the working folklore): simple **$50–$75/pg**, normal **$75–$125**, complex **$125–$300+**. ([reddit](https://www.reddit.com/r/patentlaw/comments/18ntt4c/recommendations_for_usbased_design_patent_artists/))

### 2.3 What the baseline means for a solo mechanical/software docket

Assume 20 utility applications/year × 6 sheets:

| Path | Annual drawing spend | Time-to-first-draft | Confidentiality |
| --- | --- | --- | --- |
| Menteso / PatDraw / Teak | **~$3,500–$4,200** | 2–5 days | NDA + offshore staff (export-control question) |
| SNS / QuickPatents | **~$6,000–$12,000** (plus SNS $500 set minimums) | 3–7 days | Better if US-staffed |
| Artworks / IP Illustration | quote; budget **$8k–$20k** | days | Best commercial posture |
| PatentDrawingAI Pro | **$948** | minutes | Cloud, no-train claim |
| DeepIP seat (whole suite) | **$4,200–$5,040** | minutes for simple figs | Azure ZDR, SOC2 |
| Solve seat (inferred) | **~$9,300** | minutes | SOC2 + ISO 42001, EU option |
| Local CAD → HLR + human polish on 20% of sheets | software + **~$700–$1,200** polish | hours | On-device until the 20% |

**The number to beat is ~$30–$100 per *accepted* sheet, 2–5 days, two free revision rounds.** AI subscriptions already beat the dollar number. They have not been independently shown to beat the *accepted-sheet* number on complex mechanical, design-patent shading, or biotech.

---

## 3. Disclosure → figure set, and figure → numeral audit

### 3.1 Who actually does disclosure/spec → figure *set*

| Capability | Who claims it | What is actually shipped | Gap |
| --- | --- | --- | --- |
| Claims → method flowchart + system block diagram | **PatentPal**, Rowan, Qatent, IP Author, Patent Bots (rules-based Visio) | Real, years-old, good enough for software/method provisionals | Not mechanical/design art |
| Text prompt → “patent-looking” picture | **Edge (2023)**, Solve, PatentFig, DeepIP | Diffusion/line-art models; Edge itself said conceptual only | Geometry hallucination; not a *set* |
| Sketch/photo → single line figure | **Solve, DeepIP, Patlytics, PatentDrawingAI, PatentFig** | Working 2025–2026 products | One figure at a time; multi-view consistency is the unsolved bit |
| CAD solid → multi-view formal set | **Pinch** ($50 / ≤21 views) | Closest thing to “figure set from engineering truth” | No disclosure-text understanding; numerals thin; cloud CAD upload |
| Disclosure text → planned figure list + embodiments + numerals + drawings | **Nobody verified** | Marketing language at PowerPatent / DeepIP / Solve | This is the build target |
| Figure → written description | **Edge Assistant**, PatentPal (describes *its own* figures), Patent Bots (Brief Description from existing text), ClaimMaster (annotates) | Real | Inverse of the hard problem |

No vendor demonstrated, with independent samples, a pipeline that:

1. Reads a disclosure,
2. Proposes the figure list (exploded, section, flowchart, block, UI),
3. Emits a consistent multi-view geometric set,
4. Assigns a stable numeral map,
5. Writes the Brief Description + Detailed Description callouts,
6. Re-checks the set after a claim amendment.

That is still a composition of humans + 2–4 tools.

### 3.2 Who solves numeral consistency (the real pain)

Pain, stated in vendor *and* practitioner language: same number / two names; same name / two numbers; number in spec not in figures; number in figures not in spec; figure never described; Brief Description missing; numbers introduced out of order; label changed on FIG. 2 but not FIG. 5; §112 support questions.

| Tool | Direction | Mechanism | Driveable by an agent? |
| --- | --- | --- | --- |
| **ClaimMaster** | Figure file + spec → issues list | Parses Word spec; loads Visio/PDF/PPT/Word figures; OCR-or-text-layer numerals; color-coded report; annotated PDF | No. Attorney clicks Word ribbon. |
| **Patent Bots** | Spec (+ figures if text-extractable) → issues list | Reference Label Tracker while typing; proofreading tabs for labels + figure numbers | No. Word add-in. |
| **Rowan Patents** | Live dictionary while drafting | Part objects bind claims, spec, figures. Edit once, propagate. Review module predicts parts lists. | No. Desktop. |
| **DeepIP** | Live dictionary inside Word/suite | Click call-out → rename/renumber everywhere | **Maybe**, if REST API covers labels. **UNVERIFIED.** |
| **Patlytics** | Live dictionary across figures | Shared numeral system | No public API. |
| **PatentDrawingAI** | Intra-set flag | “Duplicate or reused reference numerals are flagged before you file” | No. |
| **IPRally Smart reference numbers** | Published figure → overlay names | CV on the corpus | No (and wrong direction). |
| **Gemini / NotebookLM** (2026-03-02, @patentailab) | Published PDF → map numerals to detailed description | “Multimodal Gap Solved… examine mechanical drawings (like Fig 3) and map reference numerals directly to the detailed description.” | Promptable, **not** a product, **not** for unpublished work. |

**What does not exist as a product:** an on-device (or ZDR) service that accepts (a) an illustrator PDF with no text layer, (b) a Word spec, and returns a structured numeral graph: `{numeral, names[], figures[], spec_paragraphs[], lead_line_target, issues[]}`. That is the piece a solo firm would pay for even if it never generates a line of art.

---

## 4. Sketch / photo → patent-compliant black-line drawing

### 4.1 The rule surface (why generic vectorizers fail)

37 CFR 1.84 is not “make it look like a patent.” Operational constraints that break consumer AI art:

- Black ink (color only by petition, 1.84(a)(2))
- Specified sheet sizes and **sight-area margins** (1.84(f)–(g))
- Character height ≥ 0.32 cm (1.84(p))
- Lead lines, not decorative callout bubbles
- Hatching for sections; surface shading for design patents; **solid black generally prohibited** except as permitted
- Broken lines for unclaimed design environment (37 CFR 1.152 / MPEP 1503.02)
- Same numeral = same element in every view (1.84(p)(4)–(5))
- No photographs for utility except as permitted (1.84(b))

Lane x8 in this fanout owns the full rule dump. The product implication: **Adobe / Vectorizer.ai / Potrace / Midjourney / ChatGPT image gen are not patent tools.** They can be a first raster. They do not know sight area, lead-line angle, or design-patent shading grammar.

### 4.2 Who does photo/sketch → line art *for patents*

| Path | Rule-aware? | Vector? | Multi-view consistent? | Confidential? |
| --- | --- | --- | --- | --- |
| PatentDrawingAI | Claims §1.84 assembly + sight-area check at export | SVG/DXF out | No — each figure from its own source image | Cloud, no-train claim |
| PatentFig AI | Claims USPTO/CNIPA/EPO/JPO/KIPO/PCT workflows | SVG/TIFF | Marketing says yes for design views; independent proof **UNVERIFIED** | Cloud, no-train claim |
| Solve | “patent-compliant line art” | **UNVERIFIED** | **UNVERIFIED** | Cloud, SOC2/ISO |
| DeepIP | USPTO + EPO claimed | Export Visio/PNG | Reviewers say weak | Azure ZDR |
| Patlytics Sketch-to-Figure | “filing-ready starting point” | **UNVERIFIED** | Shared numerals, not shared geometry | Cloud |
| Pinch | USPTO/PCT from CAD | Yes (from solid) | **Yes, by construction** (same solid, many views) | Cloud CAD |
| Human illustrator | Yes | Usually Illustrator/DWG | Yes if briefed | NDA; offshore vs US |
| Generic vectorizer | No | Yes | No | Varies |

### 4.3 Design-patent shading is a separate market

Utility line art and design-patent surface shading are different crafts. PatentDrawingAI admits Auto-Label is utility-only; design uses shading and broken lines. US-based design artists still quote $75–$300+/page. **No 2026 AI tool has independent, examiner-facing evidence that it emits 1.152-compliant 7-view design sets.** Ethan Brooks “testimonial” on PatentFig is marketing copy until proven.

### 4.4 The honest hybrid (what attorneys already do)

r/patentlaw thread “Patent drafting: using AI to generate drawings” (2025-09-19): teams generate “general mock ups” with AI, **then hand them to an illustrator**. Solve/DeepIP in-product editors exist so the attorney can add labels from claim parts. That is the current equilibrium: AI for first-pass software/method figures and ugly-but-useful mockups; humans for anything that has to survive a drawing objection or a design-patent examination.

---

## 5. X.com / practitioner evidence (2025–2026)

X is a poor primary source for this topic in 2026. Keyword and semantic search over 2025-01-01 → 2026-08-17 returned **vendor marketing and adjacent legal-AI chatter**, not a thick attorney-complaint corpus. That absence is itself evidence: figures are not where patent attorneys are publicly fighting about AI. Hallucinated case citations are.

### 5.1 Useful (non-marketing) posts

**CAD still cannot emit patent drawings.** Greg Atkinson (@GregAtkinson_jp), 2026-08-15:

> “None of the CAD apps I use can put together patent drawings using AI. In any case these get reviewed by patent attorneys & probably changed anyway.”
> ([x.com/GregAtkinson_jp/status/2088437064547324326](https://x.com/GregAtkinson_jp/status/2088437064547324326), 2026-08-15)

This is the build-side tell: even if you have the solid, the last mile (numerals, §1.84 sheet, attorney redlines) is not in Fusion/Onshape/SW.

**Vendor PM, unusually honest.** Robin Kuhn, PM at DeepIP (@robinKnFR), 2026-03-22:

> “At DeepIP, we build the execution layer for AI in patent work. To help attorney intake raw inventions and turn them into a full patent. Drawings, complex chemical compounds, materials science… The hard part is evals. Getting AI to produce work a patent attorney will sign off on is a much more specific problem than making something that sounds plausible.”
> ([x.com/robinKnFR/status/2035662712777080859](https://x.com/robinKnFR/status/2035662712777080859), 2026-03-22)

Read as: generation demos are easy; **sign-off evals** (the thing a solo attorney’s name goes on) are not solved.

**Multimodal numeral mapping exists — on published PDFs.** Patent AI Lab (@patentailab), 2026-03-02:

> “Multimodal Gap Solved. Gemini 1.5 Pro allows NotebookLM to ‘see’ PDFs. It can examine mechanical drawings (like Fig 3) and map reference numerals directly to the detailed description.”
> ([x.com/patentailab/status/2028346985917649101](https://x.com/patentailab/status/2028346985917649101), 2026-03-02)

Directionally the audit feature firms want. It is a consumer multimodal demo, not a confidential product, and it runs on *already published* figures.

**AI can now design around a patent visually.** Adam Rossi (@rossiadam), 2026-07-27, describing @danyay using frontier models + sub-agents to read a patent, design alternatives, **create and test CAD**, render, refine — answering Molson Hart’s claim that “AI cannot work around a patent. It’s too visual.”
([x.com/rossiadam/status/2081707911307280744](https://x.com/rossiadam/status/2081707911307280744), 2026-07-27)

This is *not* a figure-automation product, but it kills the 2024 talking point that geometry is safe from LLMs. It also shows the capability is in **agent + CAD**, not in PatentPal-class flowchart generators.

**AI-generated schematics already appearing in filed patents, poorly.** @ekszentrik, 2025-10-05, on Surfaceplan:

> “They deem it a good move to use AI generated illustration/schematics to describe their invention.”
> ([x.com/ekszentrik/status/1974836231851958527](https://x.com/ekszentrik/status/1974836231851958527), 2025-10-05)

Tone is incredulous. **UNVERIFIED** as to the actual file wrapper; treat as a warning that junk AI figures are already reaching the Office.

### 5.2 Marketing-dominated posts (discount as evidence of *demand*, not *quality*)

- DavieChen @ChenDavie_AI — PatentFig launch/tutorial videos (2026-03-08, 2026-04-16, 2026-05-17). Bio: “Studying how generative AI can assist scientists with figure creation, patent illustration…” Almost certainly a founder/affiliate account.
- Patent AI Lab @patentailab — “How to Generate USPTO-Ready Patent Drawings with AI (2026 Guide)” (2026-01-21). Affiliate/SEO.
- @SolveIntel $40M Series B (2025-12-09) — product is a platform; figures are one module.

### 5.3 What X did *not* contain (searched, not found)

- Named patent attorneys posting “I filed AI figures and got a drawing objection.”
- Named attorneys posting “PatentDrawingAI / Solve / DeepIP replaced my illustrator.”
- A founder post-mortem of a failed figure-gen startup.
- Practitioner threads comparing Pinch vs human CAD draftsmen.

**Interpretation:** either the products are too new/small for public attorney discourse, or attorneys who care about figures are not on X, or the products are not yet good enough to brag about and not yet bad enough to rage about. The last is consistent with “use AI mockups, still pay the illustrator.”

---

## 6. Ranked capability matrix

Scoring is for a **solo US utility practice** that also files some design. 0 = none, 3 = production-usable on the job in the column.

| Product | Logical figs (flow/block) | Photo/sketch → line | CAD → views | Numeral dictionary | Numeral *audit* of imported figs | §1.84 sheet | Agent/API | On-device / ZDR | Solo-viable price |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PatentPal | 3 | 0 | 0 | 1 | 0 | 0 | 0 | 0 | 2 |
| Solve Intelligence | 2 | 3 | 0 | 2 | 0 | 2 | 0 | 1 | 0 |
| DeepIP | 2 | 2 | 0 | **3** | 1 | 2 | **2** | 2 | 1 |
| Edge / Patently | 2 | 2 | 0 | 2 | 0 | 1 | 0 | 1 | 0 |
| &AI | 0 | 0 | 0 | 0 | 0 | 0 | 1 (Andy, litigation) | 2 | 0 |
| IPRally | 0 | 0 | 0 | 0 | 2 (published only) | 0 | 0 | 1 | 0 |
| Rowan Patents | **3** | 1 (import+number) | 0 | **3** | 2 | 2 | 0 | **3** (local LLM option) | 0 |
| Patentfield | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 2 |
| Henry | — | — | — | — | — | — | — | — | — |
| Qatent | 1 | 0 | 0 | 1 | 0 | 0 | 0 | 1 | 1 |
| Patlytics | 2 | 2 | 0 | **3** | 0 | 1 | 1 (agent launching) | 1 | 0 |
| Ambercite | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 1 | 1 |
| PatentDrawingAI | 2 | **3** | 0 (render only) | 2 | 1 | **3** | 0 | 1 | **3** |
| PatentFig AI | 2 | **3** | 0 | 2 | 1 | 2 | 0 | 1 | **3** |
| Pinch | 0 | 0 | **3** | 1 | 0 | 2 | 0 | 0 | **3** |
| ClaimMaster | 0 | 0 | 0 | 1 | **3** | 2 (margin check) | 0 | **3** | 2 |
| Patent Bots | 2 (rules Visio) | 0 | 0 | 2 | 2 | 1 | 0 | 2 | 2 |
| Human illustrator | 3 | 3 | 3 | 2 | 1 (if briefed) | **3** | 0 (email) | 2–3 (US) / 0–1 (offshore) | 2 |

---

## 7. Gap analysis: what a solo firm would pay for that does not exist

A solo US attorney’s technical partner is not shopping for another Word sidebar that rewrites claims. The figure-shaped holes, ranked by willingness-to-pay:

### 7.1 Gaps that would get a check written

1. **Disclosure → figure *plan* + numeral map (even without pretty art).**
   Given an IDF + claim draft, emit: proposed FIG. list, view types, a stable `{numeral → part name → claim support}` table, and a Brief Description stub. Rowan/DeepIP/Patlytics do pieces of this *after* you are inside their editor. Nobody takes a folder of inventor junk and returns the plan. This is 80% of the attorney’s figure *thinking* and 20% of the illustrator’s hours.

2. **On-device (or true ZDR) figure-PDF OCR → spec cross-check.**
   ClaimMaster requires a text layer or Visio. Real illustrator deliveries are often outline-only PDFs. A local model that associates lead lines to numerals and diffs against the spec would pay for itself on the first avoided drawing objection / 112 issue. IPRally proved the CV is possible — on the wrong corpus (published patents).

3. **CAD-faithful multi-view set with patent numerals, locally.**
   Pinch is the commercial existence proof that STP → 21 views is a $50 problem in the cloud. A solo mechanical docket with ITAR/export-control or pre-publication sensitivity cannot use it. FreeCAD TechDraw / build123d `project_to_viewport` is the build path (see sibling lanes r4, x4). The missing product is: local HLR + balloon/numeral graph + §1.84 sheet packager.

4. **Design-patent 7-view consistency + shading grammar.**
   Still a human premium market ($250–$600/set). AI tools claim it; none have examiner-grade public evidence. A tool that keeps broken-line claim boundaries consistent across seven views would be bought even at $50/set.

5. **Agent-driveable figure operations.**
   DeepIP’s REST API is the only advertised hook. Everything else is “open our browser / Word add-in.” A solo technical partner running an in-house agent needs: `propose_figures(disclosure)`, `render_view(solid, camera)`, `label(numeral, target)`, `audit(spec, sheets)`, `export_pdf_1_84()`. That interface does not exist commercially.

### 7.2 Gaps that look like products but are already filled (do not rebuild)

- Claim/spec antecedent basis, claim trees, OA shells → Patent Bots / ClaimMaster / DeepIP / Solve.
- Published-patent numeral overlay for searching → IPRally.
- Cheap first-pass software flowcharts → PatentPal, Patent Bots rules-based Visio, Rowan.
- Cheap photo-to-ugly-line-art → PatentDrawingAI / PatentFig at $2–$4.

### 7.3 Gaps that are traps

- “End-to-end AI patent from disclosure including filing-ready mechanical figures.” Vendor pages say this. Independent reviews (Patentext, Perritt, PatentDrawingAI-vs-DeepIP even while selling) all retreat to “starting point / still need an illustrator / evals are hard.”
- Sending unpublished mechanical drawings to a $28 offshore house *or* a $20/mo diffusion app without an export-control / 35 U.S.C. 184 analysis. Lane x8 owns the legal rule. Commercially: US-based illustrators sell confidentiality as the differentiator because the cheap path leaks.

---

## 8. Build-vs-buy verdict: disclosure → figure set + numeral map

### Verdict

**Build the pipeline. Buy the audit layer and the human last-mile. Do not buy a drafting-suite seat for figures.**

More precisely:

| Layer | Decision | Why |
| --- | --- | --- |
| Figure *planning* + numeral graph from disclosure | **Build** | No vendor sells this as a first-class, extractable object. It is the firm’s knowledge graph. |
| Geometry (solids → 2D HLR views) | **Build local** (CadQuery/build123d/FreeCAD TechDraw) or **buy Pinch** only for non-sensitive mechanical | Pinch proves the job is cheap when you already have a solid. Cloud CAD of an unfiled invention is the wrong default. |
| Photo/sketch cleanup for inventor junk | **Buy** PatentDrawingAI Pro ($79/mo) as a *mockup* tool | Dollars already beat illustrators. Quality does not, so keep it off the filing path unless a human signs the sheet. |
| Numeral / figure-number / margin audit | **Buy** ClaimMaster (and/or Patent Bots if already in the stack) | This is a solved Word-plugin problem. Rebuilding it is vanity. |
| Design-patent shading, complex assemblies, biotech | **Buy** a US-based illustrator ($80–$300/view) | No AI product has independent evidence it survives 1.152 / complex utility objections. |
| Full Solve/DeepIP/Patlytics/Rowan seat “for figures” | **Do not buy** unless you also want their *text* workflow | Figure modules are loss-leaders on $350–$775/mo seats. A solo already has Word. |

### Strongest evidence for BUY

1. **Human sheets are already cheap.** $28–$39 offshore, $35 Teak, $39 Patent Express, $29 Menteso. A 6-sheet utility is **$170–$240** at the floor. You will not recover a six-figure build on drawing fees alone. ([Menteso](https://menteso.com/patent-drawings/), [Teak](https://teakipservices.com/services/patent-drawings/), [PatDraw press](https://www.effectualservices.com/press-release/patdraw-launches-professional-patent-illustrations-at-just-28-per-sheet))

2. **Numeral QC is a shipped Word feature.** ClaimMaster’s figure-load + parts report is exactly the pain attorneys describe. Patent Bots’ Reference Labels / Figure Numbers tabs are the same job. Buying this is a week, not a year. ([ClaimMaster](https://www.patentclaimmaster.com/blog/tutorial-checking-part-numbers-names/), [Patent Bots](https://www.patentbots.com/feature-overview))

3. **Suites that touch figures are sold as text platforms.** DeepIP and Solve win on Word-vs-browser philosophy, OA responses, and firm standardization — not on beating a $35 illustrator. Patentext’s 2026 comparison says DeepIP figures are “functional, not feature-rich” and Solve is first-class *relative to DeepIP*, not relative to a draftsman. ([patentext.com](https://patentext.com/blog/solve-intelligence-vs-deepip/))

4. **Confidentiality posture of the cheap AI figure apps is a policy PDF, not a local process.** PatentDrawingAI and PatentFig make the right promises (no training, encrypted, DPA). They still send image bytes of unfiled inventions to a model host. For this reader’s Oppold-adjacent constraint set, that is a buy *only* for non-privileged mockups.

5. **Rowan already is the “integrated figures + numerals” product**, and it has been for years. If the firm wanted to *buy* the dictionary, Rowan is the incumbent, not a 2026 startup. The reason not to: desktop lock-in, Clarivate pricing, no agent API, and the drawing tool is a 2D editor — not CAD.

### Strongest evidence for BUILD

1. **The job-to-be-done is not a drawing. It is a graph.** `{disclosure, claims, parts, numerals, views, sheets}` with epistemic links (“this hatching is derived from disclosure v3”). No commercial tool emits that object. DeepIP/Rowan/Patlytics keep it hostage inside their workspace. A technical partner who already thinks in schemas should own the graph.

2. **Nothing commercial is agent-driveable for figures.** DeepIP REST API is the lone advertised exception and is sales-gated. PatentPal, Solve, Patently, PatentDrawingAI, PatentFig, Pinch, ClaimMaster: click UIs. An in-house agent that already drafts text cannot call `render_fig(3)`.

3. **Geometry fidelity is the unsolved half, and it is a CAD problem, not an LLM problem.** Edge said in 2023: do not upload CAD to get a line drawing; use CAD’s own export. Atkinson said in 2026: CAD apps still cannot assemble patent drawings with AI. Pinch shows STP → views is a product. The local stack (OCCT HLR, TechDraw balloons, SVG/PDF) is the same kernel the rest of this fanout is evaluating. Building here composes with lanes r4/x4 instead of paying rent to a diffusion wrapper.

4. **Sign-off evals are the bottleneck the vendors themselves name.** Kuhn (DeepIP PM, 2026-03-22): attorney-sign-off evals ≫ plausible pixels. A solo firm that builds can define evals on *its* drawing objections, *its* numeral conventions, *its* 1.84 checklist. Buying a suite means accepting their eval — which they do not publish.

5. **Cloud figure-gen does not remove the illustrator.** r/patentlaw practice (2025) and every honest comparison: AI mockup → human. If the illustrator remains, the software that pays is the software that (a) briefs the illustrator (figure plan + numeral map) and (b) audits what comes back. Both are buildable without generating a single pretty line.

6. **Pre-publication + export-control.** Cheap illustration *and* cheap AI both want the drawing off-box. A local disclosure → figure-set tool is the only architecture that is compatible with “unpublished patent text never goes to cloud AI” without a dated waiver.

### What “build” means in scope (so this does not become a company)

Do **not** build a Solve competitor. Build three schemas and two renderers:

1. **NumeralMap** — part name, numeral, claim support, figures[], spec spans. Import/export JSON + Word comment marks.
2. **FigurePlan** — FIG. n, view type, source (solid / sketch / photo / logical), required elements.
3. **SheetPack** — 1.84 margins, sheet x of y, sight-area, export PDF.
4. **Renderer A:** logical (flowchart/block) from claims — this *can* be bought (PatentPal/Patent Bots) or generated locally from structured claims.
5. **Renderer B:** HLR views from a local solid, with balloons bound to NumeralMap.

Then **buy** ClaimMaster as the independent auditor (do not mark your own homework) and **buy** a US illustrator for design + the 10–20% of utility sheets the HLR cannot make (shading, exploded artistic, biotech).

**If the firm will not build:** the least-wrong buy is **PatentDrawingAI Pro ($79) + ClaimMaster + Teak/SNS for real sheets**, not a $775 Solve seat. Use DeepIP only if the attorney also wants the Word drafting copilot at $350–$420 and can live with Azure.

---

## Sources log

### Vendor primary

- https://patentpal.com/ — 2026-08-17
- https://www.solveintelligence.com/blog/post/ai-for-patent-drawings-figure-generation-and-labeling — 2025-05-10
- https://www.solveintelligence.com/ — 2026-08-14
- https://trust.solveintelligence.com/ — 2026-08-17
- https://www.deepip.ai/products/patent-drawings-generation — 2026-08-14
- https://www.deepip.ai/security — 2026-08-17
- https://blog.withedge.com/p/assistant-magic-text-to-figure-detailed-spec — 2023-11-28
- https://patently.com/create — 2026-08-14
- https://www.tryandai.com/ — 2026-08-17
- https://www.iprally.com/news/patent-drawing-reviews-simplified-smart-reference-numbers — 2022-04-08
- https://clarivate.com/intellectual-property/ip-management-software/rowan-patents/ — 2026-08-17
- https://patentfield.com/ — 2026-08-17
- https://www.questel.com/patent/ai-assistants-patent-productivity/patent-drafting-software-with-ai/ — 2026-08-13
- https://www.patlytics.ai/blog/how-patlytics-transforms-patent-sketches-figures — 2026-02-18
- https://www.ambercite.com/ambercite-ai — 2026-08-12
- https://patentdrawingai.com/ — 2026-08-17
- https://patentdrawingai.com/blog/patent-drawing-cost — 2026-05-20
- https://patentdrawingai.com/patentdrawingai-vs-deepip — 2026-05-11
- https://patentfig.ai/ — 2026-08-17
- https://www.patentclaimmaster.com/blog/tutorial-checking-part-numbers-names/ — 2026-08-17
- https://www.patentbots.com/feature-overview — 2026-07-08
- https://powerpatent.com/blog/how-ai-can-help-with-patent-drawings-and-descriptions — 2025-08-01

### Independent reviews

- https://www.aipla.org/list/innovate-articles/ai-aids-for-patent-prosecution---product-review — Henry H. Perritt, Jr. (live 2026-08-17)
- https://patentext.com/blog/a-complete-list-of-ai-patent-tools/ — crawled 2026-08-16
- https://patentext.com/blog/solve-intelligence-vs-deepip/ — 2026-07-22
- https://patentext.com/blog/solve-intelligence-vs-andai/ — 2026-01-12
- https://pinchpatentdrawings.com/ai-patent-drawing-software/ — 2025
- https://pinchpatentdrawings.com/best-smartdraw-alternative-patent-drawing/ — 2025-05-26

### Illustration pricing

- https://thepatentdrawings.com/product/utility-patent-drawings — PatDraw $28
- https://www.effectualservices.com/press-release/patdraw-launches-professional-patent-illustrations-at-just-28-per-sheet
- https://menteso.com/patent-drawings/ — $29 / $39
- https://teakipservices.com/services/patent-drawings/ — $35/figure, 2–3 days
- https://www.patentexpress.com/formal-patent-drawings — $39 floor, 3–5 days
- https://www.snspatentdrafting.com/pricing — $30–$65+ / $80–$125+, minima
- https://www.quickpatents.com/drawings/ — $100 / $125, 1 week
- https://www.artworksip.com/patentdrawings.html — US-based, quote
- https://ipillustration.com/ — US in-house
- https://www.findlaw.com/smallbusiness/intellectual-property/the-basics-of-patent-drawings.html — $75–$150/page (2024-05-22)

### X.com

- https://x.com/SolveIntel/status/1998461020440801329 — 2025-12-09
- https://x.com/robinKnFR/status/2035662712777080859 — 2026-03-22
- https://x.com/ChenDavie_AI/status/2030543026288841048 — 2026-03-08
- https://x.com/ChenDavie_AI/status/2055824973428875457 — 2026-05-17
- https://x.com/patentailab/status/2013896202249478389 — 2026-01-21
- https://x.com/patentailab/status/2028346985917649101 — 2026-03-02
- https://x.com/GregAtkinson_jp/status/2088437064547324326 — 2026-08-15
- https://x.com/rossiadam/status/2081707911307280744 — 2026-07-27
- https://x.com/ekszentrik/status/1974836231851958527 — 2025-10-05

### Other

- https://www.reddit.com/r/patentlaw/comments/1nkwzdk/patent_drafting_using_ai_to_generate_drawings/ — 2025-09-19 (full thread fetch blocked; snippets used)
- https://www.reddit.com/r/patentlaw/comments/18ntt4c/recommendations_for_usbased_design_patent_artists/ — 2023-12-21
- https://www.ecfr.gov/current/title-37/chapter-I/subchapter-A/part-1/subpart-B/subject-group-ECFRc7605aa2d3f3782/section-1.84 — 37 CFR 1.84
