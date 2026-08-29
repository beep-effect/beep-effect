# Text-to-CAD / AI-CAD Product Landscape

**As of:** 2026-08-17
**Lane:** x1-text-to-cad-market
**Method:** primary product docs + changelogs + X launch/complaint posts
**Prior baseline:** 2026-05-29 report (adopt local CadQuery+build123d first; cloud text-to-CAD opt-in for non-privileged work only; no turnkey disclosure→figure pipeline)

---

## Executive snapshot

The product center of gravity shifted between 2026-05-29 and 2026-08-17. **adam.new is no longer primarily a standalone text-to-CAD editor.** It now sells an in-CAD **agentic copilot / harness** that edits Fusion, Onshape, and SolidWorks feature trees (plus SketchUp/Revit claims), with Slack/email/PLM connectors, Grok 4.6 as the Lite-mode orchestrator, and published personal pricing of **$20 / $40 / $100 per month**. CADAM remains the GPLv3 browser OpenSCAD sibling. ([adam.new](https://adam.new/), checked 2026-08-17; [x.com/adamdotnew 2026-08-13](https://x.com/adamdotnew/status/2087995454193873118); [HN “AI CAD Harness”](https://news.ycombinator.com/item?id=47977694))

**Zoo (KittyCAD) is the most complete programmable AI-CAD stack.** Design Studio + Zookeeper (desktop Mac/Win/Linux + browser), KCL as the parametric language, REST + WebSocket Engine/Agent/File-format/ML APIs, an MCP surface used in the wild, ITAR US-regulated region, SOC 2 Type 2, and an Aug 2026 API Makeathon. Text-to-CAD is now framed as living *inside* Design Studio / Zookeeper rather than a standalone toy. ([zoo.dev](https://zoo.dev/), checked 2026-08-17; [x.com/zoodotdev 2026-08-14](https://x.com/zoodotdev/status/2088362875870167465); [x.com/margorskyi 2026-08-13](https://x.com/margorskyi/status/2087840489445736713))

**Incumbent “neural CAD” is still mostly preview / copilot, not a disclosure→figure product.** Autodesk Project Bernini / Fusion neural CAD remains the watch-item; Onshape/PTC, Shapr3D, Spline, nTop, Siemens, and SOLIDWORKS ship assistants or generative features, not a turnkey patent-figure pipeline. (details + citations in §3)

**The 2026 small-entrant wave is OSS agent harnesses, not new SaaS CAD kernels:** `earthtojake/text-to-cad` (agent skills → STEP/URDF, offline), Digital Metal geometric-intel MCP (Jun 2026), plus a long tail of MCP CAD servers wrapping FreeCAD/CadQuery. No verified turnkey USPTO figure product appeared.

---

## How to read this report

For every product: **(a)** integration surface, **(b)** deployment, **(c)** vendor training-on-user-data policy (quoted), **(d)** price signal.

Claims that could not be verified are marked **UNVERIFIED**. Dates on citations are publication or last-checked dates.

---

## 1. adam.new (Adam CAD) and CADAM

### Current product state (2026-08-17)

Adam is no longer sold as a standalone “type a prompt, get a STEP” web editor. The live site is **“The AI CAD workspace for hardware teams”**: a copilot that connects to **Onshape, Autodesk Fusion, SolidWorks** (icons + FAQ), plus Slack, Gmail, Drive, Notion, Arena PLM, McMaster, Digi-Key, Xometry, and “3,000+ integrations.” It reads geometry/BOMs/drawings in place, edits the **existing feature tree**, drafts ECOs/RFQs, and returns a branched model edit rather than a throwaway mesh. ([adam.new](https://adam.new/), checked 2026-08-17)

A 2026 Show HN restates the repositioning: “Adam is now a harness that integrates directly with your CAD. It reads your parts, understands the existing feature tree, and edits it for you agentically.” ([news.ycombinator.com/item?id=47977694](https://news.ycombinator.com/item?id=47977694), date from HN listing; checked 2026-08-17)

Install surfaces advertised in the last 72 hours:
- Web: [https://adam.new](https://adam.new)
- Fusion add-in one-liner: `irm https://fusion.adam.new/install.ps1 | iex` then Shift+S → enable AdamFusion. ([x.com/grok 2026-08-15](https://x.com/grok/status/2088415625295056937) quoting the official demo thread)
- CADAM (OpenSCAD) still at [https://adam.new/cadam/](https://adam.new/cadam/). ([x.com/adamdotnew 2026-08-15](https://x.com/adamdotnew/status/2088418338921975907))

Official account also claimed **native SketchUp** and **Revit** support in replies on 2026-08-15/16. Those are founder replies, not landing-page product cards — treat as **announced, not independently verified** in this pass. ([x.com/adamdotnew 2026-08-15](https://x.com/adamdotnew/status/2088662413164077508), [x.com/adamdotnew 2026-08-14](https://x.com/adamdotnew/status/2088338204881752265))

**Orchestrator change (last 4 days):** Grok 4.6 is “now the default orchestrator for our Lite mode” and “holds the best price-to-intelligence ratio of any model we've tested so far.” Demo video attached; 1.65M views in ~48h. ([x.com/adamdotnew 2026-08-13](https://x.com/adamdotnew/status/2087995454193873118), [x.com/adamdotnew 2026-08-13](https://x.com/adamdotnew/status/2088038904129851761))

YC company page (live): **Adam — AI Powered CAD**, W25, San Francisco, team size **4**, status Active, legal name on ToS **Adam AI Labs, Inc.** Tagline now: “Applied AI lab building end-to-end agents for mechanical design.” Founders listed: Zach Dive, Aaron Li (Avi still on the original launch post). Hiring 3 roles including Founding Research Engineer. ([ycombinator.com/companies/adam](https://www.ycombinator.com/companies/adam), checked 2026-08-17)

### (a) Integration surface

| Surface | Status |
|---|---|
| In-CAD add-in / harness | **Primary.** Fusion installer + Onshape + SolidWorks connectors on the homepage. Feature-tree edits, not a new kernel. |
| Web app + Slack/email | Primary UX for non-CAD tasks (BOM, RFQ, ECO). |
| REST / gRPC / public API | **No public developer API documented** on adam.new as of 2026-08-17. UNVERIFIED if a private partner API exists. |
| MCP server | **Not advertised.** UNVERIFIED. |
| CLI / headless | Fusion PowerShell install script only; not a modeling CLI. |
| Scriptable library | CADAM emits **OpenSCAD**; commercial Adam writes into host CAD history. |
| File-format | CADAM: STL / SCAD / DXF. Commercial: host-CAD native + drawings/PDF. |

### (b) Deployment

**Hybrid / cloud-orchestrated, not self-hostable.** Geometry stays in the customer’s Onshape/Fusion/SW/PLM (“never copying your CAD into a separate store” — FAQ). The LLM orchestration and third-party model inference are Adam-cloud. Privacy policy (updated **2026-06-05**) lists “third-party service providers for hosting, **model inference**, billing…” ([adam.new/privacy-policy](https://adam.new/privacy-policy))

CADAM geometry runs **in-browser via OpenSCAD WASM**; generation still needs a cloud LLM API key (Anthropic primary historically; repo commit 2026-08-14 swapped Gemini 3.6 Flash → **Gemini 3.7 Flash**). ([github.com/Adam-CAD/CADAM](https://github.com/Adam-CAD/CADAM), last commit 2026-08-14)

**No official on-prem / fully-local commercial story.** Self-host of CADAM is possible (GPLv3, Vite/React/Supabase) if the operator supplies their own LLM.

### (c) Trains on user data?

**Marketing FAQ (stronger than the legal pages):**

> “Your geometry, drawings, BOMs, and correspondence stay in your own accounts and PLM. Adam connects over scoped, authenticated access (OAuth where supported) and reads only what a task needs, never copying your CAD into a separate store. **Nothing you connect trains models**, nothing is shared between accounts, and every workspace is isolated and encrypted.” ([adam.new](https://adam.new/) FAQ “Where does my IP go…”, checked 2026-08-17)

**Legal pages do not repeat that sentence.** Privacy Policy (2026-06-05) says they collect “workspace content, files, and messages” and use information “to provide, maintain, secure, and **improve** our services.” It does **not** say “we do not train.” Terms (2026-06-05) say “You retain ownership of the content you submit” and grant a limited license to use the service. ([adam.new/privacy-policy](https://adam.new/privacy-policy), [adam.new/terms-of-service](https://adam.new/terms-of-service))

**Privilege read:** marketing no-train claim exists; the contract text is weaker (“improve”). For privileged disclosures this is still a **cloud LLM hop** (Adam + inference providers). Treat as **opt-in / non-privileged only** unless a signed DPA + no-train addendum is in hand.

### (d) Price signal

Personal (landing page, 2026-08-17):

| Plan | Price | Notes |
|---|---|---|
| Starter | **$20 / month** | 0.4× usage of Plus |
| Plus | **$40 / month** | 7-day free trial; usage resets weekly |
| Pro | **$100 / month** | 3× usage of Plus; cloud storage |
| Enterprise | sales | SSO, audit logging, admin scope (FAQ) |

Caveat from their own FAQ: “The landing page shows the intended packaging structure. **Pricing and limits should be treated as product copy until finalized by the team.**” Usage is a **weekly dollar cap** covering research + reasoning + tool use. ([adam.new](https://adam.new/) FAQ)

### Funding / traction

- **$4.1M seed, 2025-10-31**, lead **TQ Ventures**; 468 Capital, Pioneer, Script Capital, Transpose Platform; angels Tim Glaser (PostHog), Trevor Blackwell (YC), Theo Browne. Guillermo Rauch: “the v0 of CAD.” ([techcrunch.com 2025-10-31](https://techcrunch.com/2025/10/31/yc-alum-adam-raises-4-1m-to-turn-viral-text-to-3d-tool-into-ai-copilot/))
- YC W25; team size 4 as of YC page check 2026-08-17. **No later public round found** in this pass.
- CADAM GitHub: **~5k stars, 621 forks**, last commit 2026-08-14. GPLv3. ([github.com/Adam-CAD/CADAM](https://github.com/Adam-CAD/CADAM))
- Grok 4.6 launch post: **~1.66M views / 1.3k likes** in two days (2026-08-13 → 17). That is traction-as-attention, not revenue. ([x.com/adamdotnew/status/2087995454193873118](https://x.com/adamdotnew/status/2087995454193873118))

### What changed in the last 6 months (since ~2026-02)

| When | Change | Source |
|---|---|---|
| 2025-10-31 | $4.1M seed; pivot narrative from viral text-to-3D to CAD copilot | TechCrunch |
| 2026-02 → 08 | Product site rewritten from “Text to CAD editor” to in-CAD harness + PLM/Slack workspace | adam.new vs YC launch post |
| 2026-06-05 | ToS + Privacy last-updated | adam.new legal pages |
| 2026-08-13 | Grok 4.6 default Lite orchestrator | @adamdotnew |
| 2026-08-14 | CADAM model swap Gemini 3.6 Flash → 3.7 Flash | GitHub commit |
| 2026-08-14/15 | SketchUp + Revit claimed in founder replies | @adamdotnew |
| 2026-08 | Fusion install script `fusion.adam.new` circulating | @grok quoting Adam |

User reception (not official): “Tonight I showed him Adam CAD demo, and his dream finally became real. The recent updates are amazing.” ([x.com/parhamb 2026-08-14](https://x.com/parhamb/status/2088334568395031026)) — anecdotal, not a quality benchmark.

### CADAM (OSS sibling) record

- **(a)** Browser web app + self-hostable Vite/React codebase. Emits OpenSCAD. Exports STL/SCAD/DXF. **Not an MCP server.**
- **(b)** Geometry: fully local (WASM). LLM: operator-supplied cloud (or local if you point it at one). Hosted demo at adam.new/cadam is hybrid.
- **(c)** Same Adam legal pages when using the hosted demo. Self-host + local LLM = you own the hop.
- **(d)** Free (GPLv3). Hosted CADAM use may still consume Adam account/LLM keys.

---

## 2. Zoo (formerly KittyCAD)

### Current product state

Zoo sells **infrastructure + an AI-native CAD app**, not just a prompt box:

- **Zoo Design Studio** — full CAD (point-and-click + KCL + Zookeeper) on Mac/Windows/Linux; browser is a “test environment.” Assemblies since v1.0. Geometry engine is **cloud**; the desktop app is a client. App is OSS (`KittyCAD/modeling-app`); **engine is not**. ([zoo.dev](https://zoo.dev/), [zoo.dev/docs/faq](https://zoo.dev/docs/faq), checked 2026-08-17)
- **Zookeeper** — conversational CAD agent *inside* Design Studio. Successor to the standalone Text-to-CAD toy: “Informed by our experience with Text-to-CAD, we added new research and reasoning capabilities.” Emits **editable parametric KCL** (B-rep, not mesh). Can inspect selections, renders, compute mass/volume. ([zoo.dev/zookeeper](https://zoo.dev/zookeeper))
- **KCL (KittyCAD Language)** — first-class parametric language; every Studio feature emits KCL. Book at zoo.dev/docs/kcl-book. Staff: “Claude is great at kcl.” ([x.com/margorskyi 2026-08-13](https://x.com/margorskyi/status/2087840489445736713))
- **Text-to-CAD API** — still present as `/user/text-to-cad` list/get/feedback plus copilot websockets. Marketing now folds T2C into Zookeeper “reasoning time.” ([zoo.dev/docs/developer-tools/api/ml](https://zoo.dev/docs/developer-tools/api/ml))
- **ML-ephant** — still the mascot for the ML stack (homepage x-ray art). The public ML API now also includes **custom org models** (`POST /ml/custom/models` backed by org datasets) and `POST /ml/kcl/completions`. That *is* the current ML-ephant surface. ([zoo.dev/docs/developer-tools/api/ml](https://zoo.dev/docs/developer-tools/api/ml))
- **APIs:** Engine API (geometry), Agent API (Zookeeper), File Format API, REST + Zoo WebSocket, OpenAPI at `https://api.zoo.dev/`. CLI (`zoo ml kcl`, etc.).
- **Zoo MCP** — official: `uvx zoo-mcp` + `ZOO_API_TOKEN`. “Connect Zoo to AI tools that support MCP… Claude or Codex.” ([zoo.dev/docs/developer-tools/mcp](https://zoo.dev/docs/developer-tools/mcp); staff confirm 2026-08-13)
- **Enterprise:** “We train our AI on your CAD data at the geometric level” (this is the *paid custom-model* offer, not the free-tier scrape). Converts SW/CATIA/Creo/NX → KCL. ITAR US-regulated region; SOC 2 Type 2 at [trust.zoo.dev](https://trust.zoo.dev/). ([zoo.dev/enterprise](https://zoo.dev/enterprise))
- **2026-08-14 API Makeathon winners** announced (ThreeDSViewer, Zapim, AutoCrate, BeaverFlow). Signal: the API/MCP is being used by third parties this month. ([x.com/zoodotdev 2026-08-14](https://x.com/zoodotdev/status/2088362875870167465))

Design Studio **requires internet** — “processing and our geometry engine run in the cloud.” ([FAQ](https://zoo.dev/docs/faq))

### (a) Integration surface

Highest-rung stack in this market:

1. **Native MCP server** — `zoo-mcp` (`uvx zoo-mcp`)
2. **REST + WebSocket APIs** — Engine, Agent, File-format, ML (`/ml/*`, `/user/text-to-cad`, `/ws/ml/copilot`)
3. **CLI** — `zoo` CLI including `zoo ml kcl`
4. **Scriptable language** — KCL
5. **Desktop + browser app** — Design Studio / Zookeeper
6. File I/O — import STEP/STP, SLDPRT, KCL, STL, glTF/GLB, OBJ, FBX, PLY; export STEP, STL, glTF, OBJ, PLY, FBX

### (b) Deployment

**Cloud-primary / hybrid client.** Desktop app is local UI; **geometry + ML run in Zoo cloud**. ITAR US region exists for export-controlled work. **Self-host of the geometry engine is not offered as a product** (engine is closed). Modeling-app (UI) is OSS. Enterprise “custom Text-to-CAD deployment” is a **pilot / sales** conversation — wording is “custom deployment,” not “you run the kernel on-prem.” Treat on-prem kernel as **UNVERIFIED / not generally available**.

### (c) Trains on user data? (per tier — quoted)

From the live pricing page ([zoo.dev/zoo-pricing](https://zoo.dev/zoo-pricing), checked 2026-08-17):

| Plan | Training line (verbatim from plan cards / compare table) |
|---|---|
| **Free $0** | Card: **“Zoo can train on your data (no opt out)”**. Compare table (inconsistent): “Yes, Opt-out Available” for Free/Plus. **Card text is the stricter / more recent product copy.** |
| **Plus $20** | **“Manually opt out of Zoo training on your data”** |
| **Pro $99** | Compare table: **“No, Can Opt-in”** (i.e. excluded by default) |
| **Team $399/user** | Card: **“Data excluded from training by default”** |
| **Enterprise (sales)** | Card: **“Custom ML models trained on your org's data”** (you *choose* to train a private model). FAQ: “How is our IP protected, and will our data train anyone else's model?” (answer is in a collapsed accordion; not extracted as quote in this scrape). |

FAQ also: “Zookeeper is included with 20 minutes of reasoning time per month, and **Zoo may train on data from Free plan usage to improve our products.**” ([zoo.dev/docs/faq](https://zoo.dev/docs/faq) search snippet)

Privacy Notice last updated **2026-08-11**. It is a *personal-information* notice and explicitly **does not apply to Customer Data** processed under a written customer agreement. It lists R&D / “Developing new products and services” as admin purposes for personal info. ([zoo.dev/privacy-policy](https://zoo.dev/privacy-policy))

**Privilege read:** Free tier is a Rule 1.6 red flag (no-opt-out train). Team/Enterprise exclude-by-default + ITAR region is the only Zoo path that is even discussable for privileged matter — still a vendor cloud.

### (d) Price signal

([zoo.dev/zoo-pricing](https://zoo.dev/zoo-pricing), 2026-08-17)

| Plan | Price | Included Zookeeper / T2C time | Notes |
|---|---|---|---|
| Free | $0 | 20 min/mo | PAYG after; Auto mode only |
| Plus | $20/mo | 400 min/mo (compare table says 402) | Standard/Thoughtful modes |
| Pro | $99/mo | Unlimited | |
| Team | **$399/user/mo** | Unlimited | Org API keys, audit, no-train default |
| Enterprise | Let's talk | Unlimited | Custom ML, SAML SSO, ITAR |
| PAYG overage | **~$0.0083 / second** (~$0.50/min) | | Same rate as 2024 T2C billing blog |

API: “All users get $10.00 worth of API calls per month for free” (FAQ snippet). Design Studio modeling itself is unlimited even on Free.

### Last-6-month product motion

- Text-to-CAD productized *inside* Zookeeper / Design Studio (standalone T2C page now redirects conceptually to Zookeeper).
- Official **MCP** docs + `uvx zoo-mcp`.
- Custom org ML models API (`/ml/custom/models`).
- API Makeathon (winners 2026-08-14).
- Pricing still trains-on-Free; Team at $399/user (was already expensive in May).
- Privacy notice touched **2026-08-11**.
- Intern aircraft build-log series started 2026-08-11 (social proof, not a product ship).

---

## 3. Incumbent CAD vendors (GA vs demo)

### 3.1 Autodesk — Project Bernini / neural CAD / Fusion MCP

**GA status (as of 2026-08-17): mixed.**

| Piece | Status | Evidence |
|---|---|---|
| **Project Bernini** | **Research / not public.** “Project Bernini remains a research effort and is not commercially available technology… strictly experimental and is not available for public use.” | [research.autodesk.com/projects/project-bernini](https://www.research.autodesk.com/projects/project-bernini/), page still live 2026-08-17 |
| **Neural CAD (Fusion + Forma)** | **Announced, not independently confirmed GA.** AU 2025 (2025-09-16): “upcoming commercial availability of this new category… in Forma and in Fusion.” “neural CAD for geometry, can create designs spontaneously based on a text prompt… entirely new, machine learning approach to generating CAD objects in contrast to the classical parametric CAD engines employed for over 40 years.” | [adsknews 2025-09-16](https://adsknews.autodesk.com/en/news/upcoming-3d-generative-ai-foundation-models/) |
| **Inventor Design Copilot** | **Shipping in Inventor 2026** (vendor + third-party reports). Natural-language interface + next-step prediction. | [orbittraining.ae 2025-04-26](https://orbittraining.ae/software/introducing-autodesk-inventor-2026-next-generation-mechanical-design-with-intelligent-engineering-technology/); [getleo.ai Inventor 2026 wrap](https://www.getleo.ai/blog/best-ai-tools-inventor-2026) |
| **Inventor Assistant 2027** | **Tech preview** for NL query of design data. | [blog.autodesk.io 2026-04-22](https://blog.autodesk.io/from-commands-to-conversations-exploring-autodesk-assistant-in-inventor-2027/) |
| **Fusion MCP (official)** | **GA-ish / public tech preview since Apr–May 2026.** Autodesk Platform Services: Fusion MCP + Fusion Data MCP. Claude-for-Creative-Work pairing 2026-04-28. Fusion blog 2026-05-07. Help: `FMCP-OVERVIEW`. | [aps.autodesk.com 2026-04-28](https://aps.autodesk.com/blog/bringing-fusion-claude-creative-work); [aps.autodesk.com DevCon 2026](https://aps.autodesk.com/blog/building-agentic-ai-whats-new-autodesk-platform-services) |
| **Wonder 3D (Flow Studio)** | **GA in M&E**, text/image→3D mesh characters/props — **not mechanical B-rep CAD**. | [blogs.autodesk.com 2026-03-04](https://blogs.autodesk.com/media-and-entertainment/2026/03/04/introducing-wonder-3d-text-and-image-to-3d-in-flow-studio/) |
| **AutoConstrain (Fusion)** | Shipped ~early 2025; cited as the “already-shipping crumb.” | AU 2025 Haley article |

X in Aug 2026 is full of Fusion-MCP demo videos (Claude driving feature trees). That is **real usage of the official MCP**, not Bernini. ([x.com/0xPascual 2026-08-10](https://x.com/0xPascual/status/2086884732093300840); [x.com/irinatoxi 2026-08-14](https://x.com/irinatoxi/status/2088296314484162719))

- **(a)** Fusion: official **MCP servers** (desktop geometry + remote Fusion Data) + Fusion API + Autodesk Assistant in-app. Inventor: in-app Copilot. Bernini: **no product API**.
- **(b)** Fusion desktop + Autodesk cloud. MCP “execution remains securely within Fusion” (APS). Engine is local-to-the-seat; AI hop is Autodesk + the connected LLM (Claude). **Not self-host of Autodesk AI.**
- **(c)** Training: SVP Mike Haley told Develop3D Neural CAD is trained on “a combination of **synthetic data and customer data**.” ([develop3d.com 2025-09-16](https://develop3d.com/cad/autodesk-unleashes-neural-cad-3d-generative-ai-foundation-models/)) APS Fusion-MCP post: “Connecting Fusion with Claude doesn’t change how your data is handled. You stay in control of what’s accessed…” — **not a no-train clause**. Autodesk Trust Center “Trusted AI” pages 403’d from this environment (2026-08-17). **Quote the Haley customer-data line; do not assume a no-train default.**
- **(d)** Fusion Personal free / commercial seat ~$680/yr historically; MCP requires a Fusion subscription. Neural CAD SKU/price **UNVERIFIED** (not on a public price card).

### 3.2 PTC / Onshape AI

**Biggest 2026 ship in incumbent CAD: FeatureScript MCP Server, 2026-08-11, via Onshape Labs (early access).**

Official blog: “The FeatureScript MCP Server from Onshape Labs enables **text-to-code-to-CAD** workflows by connecting AI clients to FeatureScript.” Not mesh generation — the LLM writes **Onshape’s native feature language**, inserts it, runs it, debugs it. Output is a **reusable toolbar feature**, not a one-shot body. “The AI is used to generate the FeatureScript. Once the code exists, it runs like any other custom feature” — no token spend on reuse. ([onshape.com/en/blog 2026-08-11](https://www.onshape.com/en/blog/featurescript-mcp-server-enables-text-code-cad))

Setup (Reddit + official): subscribe via App Store; MCP URL `https://fs-mcp.labs.onshape.app/mcp`, transport HTTP, OAuth to Onshape. ([r/Onshape 2026-08-11](https://www.reddit.com/r/Onshape/comments/1vlrsmx/official_onshape_featurescript_mcp_released/); PTC press 2026-08-13)

Also: **FeatureScript Co-Complete** (inline autocomplete in Feature Studio). Quarterly product blog 2026-08-13 lists ECAD/sim/MBD/robotics/rendering — **not** a general text-to-part generator. ([x.com/Onshape 2026-08-13](https://x.com/Onshape/status/2087803939148157308))

- **(a)** Official **HTTP MCP** (`fs-mcp.labs.onshape.app/mcp`) + FeatureScript language + REST/document APIs Onshape already had.
- **(b)** **Cloud-only** (Onshape is SaaS). Labs app is a subscription add-on.
- **(c)** Onshape/PTC ToS for Labs MCP **not extracted in this pass** (PTC newsroom 403). Treat customer CAD in Onshape as already in PTC cloud; MCP adds an LLM hop (Claude/ChatGPT/Gemini of the user’s choosing). Training-on-user-CAD for Labs **UNVERIFIED**.
- **(d)** Onshape plan + **App Store subscribe** to FeatureScript MCP. Dollar price **UNVERIFIED** (gated).

### 3.3 Shapr3D AI

**Not a text-to-CAD product.** Official “Our AI Approach” FAQ: current AI is **Generative Render** (snapshot + prompt → photoreal image) and a **Help Center chatbot**. Core modeling remains traditional. AI is optional. ([shapr3d.com/ai-approach](https://www.shapr3d.com/ai-approach), checked 2026-08-17; render help updated 2026-05-05)

- **(a)** In-app render + website chatbot. **No MCP, no public geometry API** advertised.
- **(b)** Desktop/iPad app + cloud sync. Hybrid.
- **(c)** Quoted: “Third-party AI providers **cannot use, retain, or train their own models** with Shapr3D customer data.” “Shapr3D **may use customer content** to help develop and improve Shapr3D’s AI tools… Customers can **opt out**… by contacting Shapr3D Support.” Also: “You should avoid entering personal, confidential, or sensitive information when using any AI feature.”
- **(d)** Shapr3D seat pricing unchanged in this pass (Business/Enterprise sales). Generative Render is a feature, not a separate SKU. **Exact credit price UNVERIFIED.**

### 3.4 Spline

**Text-to-3D mesh for web/interactive, not mechanical B-rep CAD.** “AI 3D Generation V1”: text→4 variants, image-to-3D, remix. Publishing to Web/Apple/Android. Sibling **Omma** is NL for interactive experiences. ([spline.design/ai-generate](https://spline.design/ai-generate))

FAQ headings exist for “Is Spline AI using my existing files data?” and “How will Spline AI 3D Generation use my data?” — **accordion bodies not extracted** (UNVERIFIED verbatim). Third-party 2026 roundups quote Spline AI ~$15/mo.

- **(a)** Web editor + dashboard generate. File export for web (not STEP-first). **No CAD MCP.**
- **(b)** Cloud.
- **(c)** Training policy **UNVERIFIED** (FAQ unexpanded).
- **(d)** ~$15/mo cited by aggregators; confirm on spline.design pricing. UNVERIFIED primary.

### 3.5 nTop (formerly nTopology)

**Not text-to-CAD.** Implicit/field-driven computational design. 2026 motion is **AI-accelerated engineering loops** (generate thousands of valid variants → CFD/physics-AI training sets), plus nTop Summit 2026 and a JetZero × NVIDIA NemoClaw aircraft-design mention on the homepage. ([ntop.com](https://www.ntop.com/); [ntop.com blog 2026-04-14](https://www.ntop.com/resources/blog/you-can-t-reach-the-promise-of-ai-accelerated-engineering-without-fixing-the-geometry-bottleneck/))

Integration that *does* exist: **nTop Automate (`ntopcl`)** runnable from Python for unattended notebooks. ([support.ntop.com article, last-crawled 2026-04-02](https://support.ntop.com/hc/en-us/articles/360052703693-Running-nTop-Automate-in-Python-scripts))

- **(a)** Desktop app + **CLI/headless Automate** + Python wrapping. **No public text-to-CAD REST/MCP.**
- **(b)** Desktop / enterprise; on-prem common in aero/defense. Treat as **hybrid / self-hostable client**, cloud optional. Exact on-prem SKU **UNVERIFIED**.
- **(c)** Training-on-user-data for any nTop AI **UNVERIFIED** (no T2C product to train).
- **(d)** Sales-led. Public list price **UNVERIFIED** (always has been).

### 3.6 Siemens (Designcenter NX / NX X)

**GA: copilots and prediction, not text-to-B-rep.** Official AI page: Industrial Copilot “powered by **Microsoft Phi-3**”; Command Prediction, Selection Prediction, Select Similar, Discovery Center, Teamcenter AI part-finder from a photo. Claims “70% faster workflows with Copilot.” Generation section is “asking Designcenter **what commands to run**,” not generating a new solid from a disclosure. ([siemens.com Designcenter AI](https://www.siemens.com/en-us/products/designcenter/cad-software/ai/))

Copilot “available in Designcenter X NX” — how-to dated **2026-05-12**. ([blogs.sw.siemens.com 2026-05-12](https://blogs.sw.siemens.com/designcenter/designcenter-x-nx-tips-and-tricks-copilot/)) NX X Manufacturing chat copilot since 2412 (2025). Community (2026-03): “NX Copilot isn’t available in the [desktop?] …” — availability is **X / value-based licensing**, not every seat.

Independent 2026-08-02 wrap: geometry-from-text “worth watching and not worth building a workflow around yet.” ([getleo.ai NX 2026](https://www.getleo.ai/blog/best-ai-tools-nx-2026) — competitor blog, use as color not gospel)

- **(a)** In-app Copilot + Teamcenter AI. Custom “plug in other AI tools.” **No public Siemens CAD MCP found.**
- **(b)** Desktop NX + cloud X + Teamcenter. Enterprise hybrid.
- **(c)** Siemens AI training-on-customer-CAD policy **UNVERIFIED** in this pass (no quote captured).
- **(d)** Seat + X value-based. Copilot not a $20 SaaS SKU.

### 3.7 Dassault / SOLIDWORKS AI

**SOLIDWORKS 2026 is GA** and marketed as “AI-powered.” What actually shipped (3DS media alert):

- Generative AI for **drawing creation/detailing**
- Auto-recognize/assemble **fastener-like** components
- **AI virtual companion** that summarizes community/wiki/Q&A
- Selective loading, command search, sheet-metal UX, 3DEXPERIENCE cut lists

([3ds.com media alert](https://www.3ds.com/newsroom/media-alerts/dassault-systemes-announces-solidworks-2026-ai-powered-design-and-collaboration-generative-economy))

**AURA** (help chatbot) launched ~Jul 2025, still described as beta and **3DEXPERIENCE-Connected only** as of a Dec 2025 wrap; “assembly generation, geometry from text remain on the roadmap as coming soon.” ([getleo.ai SW copilots](https://www.getleo.ai/blog/best-ai-copilots-for-solidworks-in-2025) — competitor; treat as **not independently re-verified 2026-08**). GOEngineer (2026-08, ~7 days ago): SOLIDWORKS uses both assistive (can be local) and generative (cloud “Virtual Companions”). ([goengineer.com](https://www.goengineer.com/blog/ai-in-solidworks))

**Verdict: assistive + drawing GA. Text-to-parametric-part is still demo/roadmap, not a product you can buy as T2C.**

- **(a)** In-app Design Assistant / Virtual Companion / AURA. Desktop APIs (existing). **No official SW MCP found.**
- **(b)** Desktop + 3DEXPERIENCE cloud for the generative bits.
- **(c)** Dassault training-on-user-CAD quote **UNVERIFIED** this pass.
- **(d)** SW 2026 subscription. AI features bundled, not a separate T2C meter.

### 3.8 Also-ran incumbent notes

- **PTC Creo AI Assistant** — named in 2026 roundups; **not independently verified GA vs demo** here.
- **CATIA 3DEXPERIENCE AI** — same. SW 2026 is the Dassault SKU with a public GA note.

---

## 4. 2026 new / small entrants

These announced first (or loudest) on X. Quality bar is uneven; several are browser toys. Listed newest-signal first.

### 4.1 `earthtojake/text-to-cad` — OSS agent-skill harness (the 2026 breakout)

Not a SaaS. A **library of agent skills** (Claude Code / Codex plugins + `npx skills install earthtojake/text-to-cad`) that makes a coding agent emit **STEP-first CAD**, inspect it, source off-the-shelf STEP parts, write DXF, URDF/SRDF/SDF, slice G-code, talk to Bambu, optional implicit-CAD. Docs: [texttocad.dev](https://www.texttocad.dev). MIT. **13.5k stars, 1.4k forks**, 913 commits, latest tag **0.4.14 on 2026-08-15**. ([github.com/earthtojake/text-to-cad](https://github.com/earthtojake/text-to-cad))

Release cadence on X:
- 2026-05-20: mechanism validation, STEP params/animations, SDF/SRDF/URDF — “3k stars, 10k downloads.” ([x.com/earthtojake 2026-05-20](https://x.com/earthtojake/status/2057203608207466982))
- 2026-08-11: large assemblies, `.step.py` (CAD-as-code), 20× faster builds, 3× faster renders, F-14D one-shot demo. ([x.com/earthtojake 2026-08-11](https://x.com/earthtojake/status/2087310590968582536))
- Viral explainers: “Runs fully offline, no backend.” ([x.com/thesupermanmx 2026-07-19](https://x.com/thesupermanmx/status/2078892919038287950)); agent-as-operator walkthrough ([x.com/TokenGremlin 2026-08-11](https://x.com/TokenGremlin/status/2087321699414892968))

Honest limit from users: geometry can still be wrong; one comparison vs Adam-in-Onshape needed a Codex+YouTube-link workflow and “some geometry is still wrong” in <30 min. ([x.com/vm3jp6u04 2026-04-24](https://x.com/vm3jp6u04/status/2047589987210912142))

- **(a)** Agent **skills / plugins** (Claude + Codex), local Python CAD stack, browser viewer. **Not an MCP server** (skills, not MCP). STEP/STL/3MF/GLB/DXF/URDF file surface.
- **(b)** **Fully local** for geometry. LLM is whatever the agent uses (can be local).
- **(c)** No vendor. You train nothing unless your chosen LLM vendor does.
- **(d)** $0 software. LLM tokens extra.

This is the product that **most changes the May 2026 “use CadQuery first” conclusion** — it *is* that idea, packaged as an installable agent harness, and it grew from a research curiosity to 13.5k stars in ~3 months.

### 4.2 CadXStudio (cadxstudio.in) — 2026 browser T2C (India)

X launch of the engine 2026-07-08; photoreal render feature 2026-08-03. “prompt to parametric 3D model… in your browser.” ([x.com/CadX_Studio 2026-07-08](https://x.com/CadX_Studio/status/2074962255524020363), [2026-08-03](https://x.com/CadX_Studio/status/2084290528108249545))

Live site claims: WASM **B-rep kernel in the browser**, parametric sliders, “Git for CAD,” live collab, **“2D Drawings in Seconds… auto dimensioning,”** STEP & IGES export. Open beta. ([cadxstudio.in](https://cadxstudio.in/), checked 2026-08-17)

Pricing on the homepage:

| Plan | Price | Credits |
|---|---|---|
| Starter | **$2 one-time** | 30 |
| Pro | **$20/mo** | 200 |
| Engineer | **$49/mo** | 400 + SSO |

Kerala ₹3 lakh non-dilutive grant mentioned in a Medium post. Traction numbers on the site show “0k+ / 0m+” placeholders — **do not treat as users**.

- **(a)** Browser app (`engine.cadxstudio.in`). **No public API/MCP found.**
- **(b)** Hybrid: WASM kernel claimed local; AI generation is cloud. Collab is cloud.
- **(c)** Privacy/ToS **UNVERIFIED** (not scraped).
- **(d)** See table. Cheap.

**2D-drawing claim is the only 2026 product that even advertises auto-dimensioned drawings from 3D.** That is *not* a USPTO figure pipeline (no reference numerals, no FIG. letters, no WIPO ST.96). Treat as **watch-item**, not a replacement for build123d.

### 4.3 TextoCAD (textocad.com / @textocad) — launched 2026-08-04

“We just launched Text-to-CAD. Generate editable 3D parts in seconds.” ([x.com/textocad 2026-08-04](https://x.com/textocad/status/2084622303091163389))

Site: browser parametric model + sliders + feature tree; first **2 generations free**; slider edits and basic STEP/STL export stay free; paid plans add a stronger model. Also sells human CAD designers. © 2026, “Drawn by GadiDokan Pvt. Ltd.” ([textocad.com](https://textocad.com/))

- **(a)** Browser only. No API/MCP found.
- **(b)** Cloud generation + browser edit.
- **(c)** ToS **UNVERIFIED**.
- **(d)** 2 free gens; paid **UNVERIFIED** exact $.

### 4.4 Digital Metal geometric-intel layer — shipped 2026-06-12

Founder Connor Kapoor: “geometric intelligence layer for manufacturing… API and MCP… DFM, thickness, clearance, draft… CNC / casting / additive / molding.” Already powers Digital Metal’s quote engine (2 weeks → 10 seconds). Use cases include “RL generative AI CAD models to produce manufacturable designs.” ([x.com/connorkapoor 2026-06-12](https://x.com/connorkapoor/status/2065403757312016676))

This is **analysis MCP**, not a modeler. Relevant as an agent tool in a CAD loop.

- **(a)** **REST API + MCP** (founder post).
- **(b)** Cloud (foundry/SaaS). digitalmetal.io was erroring when crawled.
- **(c)** UNVERIFIED.
- **(d)** UNVERIFIED (foundry-adjacent; likely usage-based).

### 4.5 Leo AI (getleo.ai) — not new in 2026, newly loud

Boston. SOC 2 Type II. Claims PDM connectors (SW PDM, Vault, Windchill, Teamcenter, Arena) and assembly-level generation into SW/CATIA/Onshape/Inventor. G2 “#1 New Software 2026” marketing. Customers named: HP, NVIDIA, Intel, Scania, Elbit, Rafael — **vendor-claimed, not independently audited here**.

Security page, quoted: “**We Never Train on Your Data.** Business & Enterprise customers data and IP are secure - Leo AI does not use your CAD files or documents to train its AI model.” Stores “non-reversible encrypted vectors,” “never your original files.” ([getleo.ai/security](https://www.getleo.ai/security))

SaaSworthy: “Does Leo AI provide API? **No.**” Pricing is sales/onboarding. ([saasworthy.com/product/leo-ai](https://www.saasworthy.com/product/leo-ai))

- **(a)** Web app + PDM connectors. **No public API/MCP** (directory says no).
- **(b)** Cloud (GCP vectors) + customer PDM stays in place.
- **(c)** Explicit no-train for Business/Enterprise (quoted).
- **(d)** Subscription / demo. List price **UNVERIFIED**.

### 4.6 C33D / @c33dbench — OSS graph CAD + token (2026-07-24)

“unique open-source parametric geometry and graph intelligence harness.” GitHub `3esign/c33d`, demo `c33d.vercel.app`. Also launched a **Robinhood token** to fund it. ([x.com/SonyxEth 2026-07-24](https://x.com/SonyxEth/status/2080709422511280489))

- Treat as **research/OSS + crypto funding experiment**, not a product for privileged work.

### 4.7 Others seen, not fully verified

| Name | Signal | Status |
|---|---|---|
| **CADScribe** | Xometry Pro interview 2026-02-02; LLM→CAD parts; same “prompt + dims → model” architecture as Zoo/Adam. | Live-enough to be interviewed. Site/pricing **UNVERIFIED** this pass. |
| **MakeIt3D** | Was a CadQuery-codegen beta in the 2026-05-29 report. | **2026 status UNVERIFIED** — did not reappear in Aug 2026 X or first-page web. Possibly stale/quiet. |
| **sparkoh.ai** | Promo tweet 2026-07-06 “prompts to production-ready CAD.” | Looks like spam/affiliate. **Do not treat as a real vendor** without a product page review. |
| **PartMode / CadSense** | Named in sibling research lanes of this fan-out. | **No 2026-08 X launch found** in this lane. UNVERIFIED as shipping products. |
| **Chamfer (SmartAI/Chamfer)** | GitHub: “text/image to CAD Agent harness… different MCPs and LLMs.” 7★. | Tiny. |
| **MIT 2D→CAD-program VLM** (2026-07-16) | Research, not a product. | [news.mit.edu 2026-07-16](https://news.mit.edu/2026/turning-2d-designs-into-3d-models-for-rapid-prototyping-0716) |

---

## 5. Agentic CAD with MCP / agent SDK

This is the layer that did not exist as a *vendor-official* category in May 2026.

| Vendor / project | Surface (exact) | First seen | Notes |
|---|---|---|---|
| **Zoo MCP** | `uvx zoo-mcp` + env `ZOO_API_TOKEN` | Docs live 2026-08; staff 2026-08-13 | Official. Engine/file/CAD utilities. Cloud token. [docs](https://zoo.dev/docs/developer-tools/mcp) |
| **Autodesk Fusion MCP** | Official Autodesk MCP (desktop geometry + remote Fusion Data). Claude connector. | DevCon 2026 / 2026-04-28 APS / 2026-05-07 Fusion blog | “Tech preview” language on APS DevCon post; Creative-Work launch treats it as usable by subscribers. [APS](https://aps.autodesk.com/blog/bringing-fusion-claude-creative-work) |
| **Onshape FeatureScript MCP** | `https://fs-mcp.labs.onshape.app/mcp` HTTP + OAuth | **2026-08-11** | Labs / App Store subscribe. Text→FeatureScript, not text→body. [blog](https://www.onshape.com/en/blog/featurescript-mcp-server-enables-text-code-cad) |
| **Digital Metal** | API + MCP (DFM/geometry intel) | 2026-06-12 | Not a modeler. [X](https://x.com/connorkapoor/status/2065403757312016676) |
| **FreeCAD MCP** (`neka-nat/freecad-mcp`) | Local MCP ↔ FreeCAD addon | Ongoing; last commit 2026-08-07 | OSS, local kernel. Also `contextform/freecad-mcp`, `sandraschi/freecad-mcp`. |
| **earthtojake/text-to-cad** | **Skills / Codex+Claude plugins**, not MCP | 2026 | Functionally an agent SDK. |
| **Adam** | In-CAD harness + Fusion install script | 2026 | **No MCP advertised.** |
| **Leo AI** | PDM connectors | — | **No public API/MCP** (directory). |
| **Unofficial Fusion 360 MCP** | Community add-in + MCP | pre-official | Superseded for most users by Autodesk’s own MCP. |

**There is still no vendor MCP that emits USPTO/WIPO numbered figures.** Closest agent-local 2D path remains build123d `project_to_viewport` / `ExportSVG` (prior report) plus earthtojake’s **DXF skill**.

---

## 6. Ranked table (integration + deploy + data policy + price)

Rank is for **an IP/privileged-work buyer who also wants an agentic path** — not for a hobbyist printing a vase. Higher = more usable as a programmable, inspectable CAD primitive *without* lighting a Rule 1.6 fire.

| Rank | Product | (a) Surface | (b) Deploy | (c) Trains on user CAD? | (d) Price signal | GA vs demo |
|---:|---|---|---|---|---|---|
| 1 | **earthtojake/text-to-cad** + CadQuery/build123d | Agent skills; Python; STEP/DXF/URDF | Fully local | N/A (no vendor) | $0 + your LLM | **GA (OSS)** |
| 2 | **CADAM** | Browser OpenSCAD WASM; no MCP | Geometry local; LLM BYO/cloud | Hosted = Adam legal; self-host = yours | Free GPLv3 | **GA (OSS)** |
| 3 | **FreeCAD + MCP** | Local MCP (`neka-nat` et al.) | Fully local | N/A | $0 | **GA (OSS, rough)** |
| 4 | **Zoo Design Studio + MCP + APIs** | MCP `zoo-mcp`; REST/WS Engine/Agent/ML; KCL; CLI | Cloud engine (ITAR region exists). Engine **not** self-host | **Free: “can train… no opt out.” Plus: manual opt-out. Team: excluded by default.** | $0 / $20 / $99; Team **$399/user**; PAYG $0.0083/s | **GA** |
| 5 | **Autodesk Fusion official MCP** | Fusion MCP + Fusion Data MCP + API | Hybrid (local Fusion + Autodesk/Claude hop) | Haley: Neural CAD uses **synthetic + customer data**. MCP: “doesn’t change how data is handled” — not a no-train clause | Fusion seat | MCP **usable preview/GA**; Neural CAD **not confirmed GA**; Bernini **research** |
| 6 | **Onshape FeatureScript MCP** | HTTP MCP `fs-mcp.labs.onshape.app` | Cloud-only | UNVERIFIED (Labs) | Onshape + Labs app (price UNVERIFIED) | **Labs early access (2026-08-11)** |
| 7 | **adam.new** | In-CAD harness (Fusion/Onshape/SW); Slack/email; **no public API/MCP** | Hybrid (CAD stays in host; Adam cloud LLM) | FAQ: “Nothing you connect trains models.” Legal: “improve our services” only | $20 / $40 / $100/mo (copy “not finalized”) | **GA as copilot**; SketchUp/Revit **claimed** |
| 8 | **Leo AI** | Web + PDM connectors; no public API | Cloud vectors + customer PDM | **“does not use your CAD files… to train”** (Business/Enterprise) | Sales | Vendor-claimed GA; assembly-T2C **not independently audited** |
| 9 | **nTop** | CLI Automate + Python | Desktop / enterprise | N/A (not T2C) | Sales | **GA** as implicit CAD, not T2C |
| 10 | **SOLIDWORKS 2026** | In-app drawing AI + companion | Desktop + 3DEXPERIENCE | UNVERIFIED | SW subscription | **GA assistive**; text-to-part **not GA** |
| 11 | **Siemens Designcenter Copilot** | In-app Copilot (Phi-3) | Hybrid NX X | UNVERIFIED | NX / X license | **GA copilot**; T2C **not** |
| 12 | **CadXStudio** | Browser only | Hybrid WASM + cloud AI | UNVERIFIED | $2 / $20 / $49 | Open beta |
| 13 | **TextoCAD** | Browser only | Cloud | UNVERIFIED | 2 free gens | Just launched 2026-08-04 |
| 14 | **Shapr3D AI** | Render + help bot | Hybrid | 3P no-train; Shapr3D trains w/ **opt-out** | Seat | **GA render**, not T2C |
| 15 | **Spline AI** | Text/image→mesh | Cloud | UNVERIFIED | ~$15/mo (secondary) | **GA mesh**, not CAD |
| 16 | **Project Bernini** | None | Lab | Trained on 10M public+CAD+organic shapes | N/A | **Research only** |
| — | **Digital Metal MCP** | API + MCP (DFM) | Cloud | UNVERIFIED | UNVERIFIED | Shipped 2026-06-12 |
| — | **MakeIt3D** | (was CadQuery codegen) | — | — | — | **2026 status UNVERIFIED** |

---

## 7. WHAT CHANGED SINCE 2026-05-29

The 2026-05-29 landscape (`research/agentic-cad-landscape.md`) closed with three operational conclusions. Status of each:

### Conclusion 1 — “Adopt local CadQuery + build123d first.”

**Still the right default for privileged matter. The *packaging* is stale, not the principle.**

What changed:
- The local path is no longer “you write CadQuery by hand.” **`earthtojake/text-to-cad` (MIT, 13.5k★ by 2026-08-15)** is an installable agent-skill harness that targets STEP (and DXF/URDF/G-code) from Claude/Codex, with a local viewer and an Aug 11 large-assembly release. That *is* CadQuery-class local codegen, productized.
- **CADAM is still alive** (5k★, commit 2026-08-14, Gemini 3.7 Flash) and still OpenSCAD-WASM, still not privilege-safe on the hosted demo.
- **FreeCAD MCP** matured into a usable (if janky) local agent surface.
- Cloud options got *much* better **integration** (Zoo MCP, Fusion MCP, Onshape FeatureScript MCP) but none of them moved geometry generation fully on-prem.

**Do not drop the local-first rule.** Do update the shopping list: *CadQuery/build123d + earthtojake skills + optional FreeCAD MCP*, not “raw CadQuery only.”

### Conclusion 2 — “Cloud text-to-CAD is opt-in for non-privileged work only.”

**Not stale. If anything, sharper.**

What changed (does **not** relax the rule):
- **Zoo Free still says, on the live price card, “Zoo can train on your data (no opt out).”** Team ($399/user) excludes-by-default. Same red flag as May, now printed more boldly.
- **Adam’s marketing FAQ now claims “Nothing you connect trains models”** (new since May). The **June 5, 2026 legal pages do not repeat it** and still collect workspace content “to improve” the service. Treat as marketing, not a DPA.
- **Official Fusion MCP and Onshape MCP** make it *easier* to pipe a disclosure into a vendor+LLM hop. Ease is not permission.
- Autodesk SVP on the record: Neural CAD trains on **“synthetic data and customer data.”**
- Leo AI is the first commercial T2C-adjacent vendor with a **plain “we never train on your data” + SOC 2 Type II** page. Still a cloud hop. Still not a figure pipeline.

**Keep: cloud T2C only for non-privileged / already-public work**, unless a signed no-train + no-retention addendum exists (Zoo Team/Enterprise, Adam Enterprise DPA, Leo Enterprise). Free Zoo is still a hard no.

### Conclusion 3 — “No turnkey disclosure → figure pipeline exists.”

**Not stale.**

What looked like movement and why it doesn’t count:
- **CadXStudio** advertises “2D Drawings in Seconds… auto dimensioning.” Unproven beta, no USPTO/WIPO conventions, no reference-numeral mapping, no FIG. lettering. Not a pipeline.
- **SOLIDWORKS 2026** GA includes generative AI that “speeds up drawing creation and detailing” from an *existing* 3D model. That is drawing acceleration, not disclosure→figures.
- **earthtojake DXF skill** + **build123d** `project_to_viewport` / `TechnicalDrawing` / `ExportSVG` remain the only *composable* 2D-from-3D primitives, and they still do not auto-number patent figures.
- Zoo/Adam/Leo/Fusion MCP all target **3D / feature-tree / KCL / FeatureScript**, not numbered black-line patent figures.

**No product in this August 2026 pass ingests an invention disclosure and emits a filing-ready figure set.** The 2026-05-29 close still holds.

### Other deltas worth a one-liner

| May 2026 belief | Aug 2026 fact |
|---|---|
| adam.new is a standalone text-to-CAD editor | It is an **in-CAD agentic harness** (Fusion/Onshape/SW) with Grok 4.6 Lite, $20–100/mo |
| Zoo T2C is a standalone API toy | T2C lives **inside Zookeeper / Design Studio**; official **MCP**; custom org ML models API |
| Autodesk neural CAD “upcoming” | Still upcoming. **Fusion MCP shipped** instead. Bernini page still says not public |
| Incumbents have no MCP | **Fusion MCP (Apr/May) + Onshape FeatureScript MCP (Aug 11)** |
| No serious OSS agent harness | **13.5k★ text-to-cad skills** in ~90 days |
| MakeIt3D is a named cloud peer | **Quiet / UNVERIFIED** this cycle |

---

## Sources index

Primary product / legal (checked 2026-08-17 unless dated):

- https://adam.new/ — product, pricing, FAQ (no-train marketing)
- https://adam.new/privacy-policy — updated 2026-06-05
- https://adam.new/terms-of-service — updated 2026-06-05
- https://www.ycombinator.com/companies/adam — W25, team 4
- https://github.com/Adam-CAD/CADAM — 5k★, GPLv3, 2026-08-14 commit
- https://techcrunch.com/2025/10/31/yc-alum-adam-raises-4-1m-to-turn-viral-text-to-3d-tool-into-ai-copilot/ — $4.1M seed
- https://news.ycombinator.com/item?id=47977694 — “AI CAD Harness” Show HN
- https://zoo.dev/ , https://zoo.dev/zookeeper , https://zoo.dev/enterprise
- https://zoo.dev/zoo-pricing — Free/Plus/Pro/Team training lines
- https://zoo.dev/docs/faq , https://zoo.dev/docs/developer-tools/api , https://zoo.dev/docs/developer-tools/api/ml
- https://zoo.dev/docs/developer-tools/mcp — `uvx zoo-mcp`
- https://zoo.dev/privacy-policy — updated 2026-08-11
- https://www.research.autodesk.com/projects/project-bernini/ — still not commercial
- https://adsknews.autodesk.com/en/news/upcoming-3d-generative-ai-foundation-models/ — 2025-09-16 AU
- https://aps.autodesk.com/blog/bringing-fusion-claude-creative-work — 2026-04-28 Fusion MCP
- https://aps.autodesk.com/blog/building-agentic-ai-whats-new-autodesk-platform-services — DevCon 2026 MCPs
- https://www.onshape.com/en/blog/featurescript-mcp-server-enables-text-code-cad — 2026-08-11
- https://www.shapr3d.com/ai-approach
- https://spline.design/ai-generate
- https://www.ntop.com/ , https://support.ntop.com/hc/en-us/articles/360052703693-Running-nTop-Automate-in-Python-scripts
- https://www.siemens.com/en-us/products/designcenter/cad-software/ai/
- https://blogs.sw.siemens.com/designcenter/designcenter-x-nx-tips-and-tricks-copilot/ — 2026-05-12
- https://www.3ds.com/newsroom/media-alerts/dassault-systemes-announces-solidworks-2026-ai-powered-design-and-collaboration-generative-economy
- https://github.com/earthtojake/text-to-cad — 13.5k★, 0.4.14 on 2026-08-15
- https://cadxstudio.in/
- https://textocad.com/
- https://www.getleo.ai/security , https://www.getleo.ai/blog/best-text-to-cad-ai-tools-2026
- https://github.com/neka-nat/freecad-mcp

X (first-class):

- https://x.com/adamdotnew/status/2087995454193873118 — Grok 4.6 (2026-08-13)
- https://x.com/adamdotnew/status/2088038904129851761 — Lite default
- https://x.com/adamdotnew/status/2088418338921975907 — CADAM URL
- https://x.com/adamdotnew/status/2088662413164077508 — Revit+SketchUp claim
- https://x.com/zoodotdev/status/2088362875870167465 — API Makeathon (2026-08-14)
- https://x.com/margorskyi/status/2087840489445736713 — Zoo MCP + KCL (2026-08-13)
- https://x.com/earthtojake/status/2057203608207466982 — May release
- https://x.com/earthtojake/status/2087310590968582536 — Aug 11 release
- https://x.com/CadX_Studio/status/2074962255524020363 , https://x.com/CadX_Studio/status/2084290528108249545
- https://x.com/textocad/status/2084622303091163389
- https://x.com/connorkapoor/status/2065403757312016676
- https://x.com/Onshape/status/2087803939148157308
- https://x.com/parhamb/status/2088334568395031026 — user praise
- https://x.com/irinatoxi/status/2088296314484162719 — Fusion MCP assembly demo

Secondary (use as color, not sole proof): Develop3D Haley interview 2025-09-16; GOEngineer SW AI 2026-08; Leo competitor roundups; r/Onshape MCP setup 2026-08-11.

**Could not verify in this pass (UNVERIFIED):** Adam public API; Adam self-host commercial; Zoo on-prem kernel; Autodesk Neural CAD GA date/SKU; Onshape Labs MCP dollar price and training clause; Shapr3D render credit price; Spline training FAQ body; Siemens/Dassault training-on-CAD quotes; MakeIt3D 2026 status; PartMode/CadSense as shipping products; Leo named-customer claims; CadX ToS.
