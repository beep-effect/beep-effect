# Grok and Firecrawl research runbook

This runbook recreates the evidence pass without turning Firecrawl into a
generic scraper. Each Grok lane must load the named Firecrawl skill before it
uses the CLI, retain raw output under the ignored `.firecrawl/` directory, and
return a source-indexed handoff rather than unsourced conclusions.

## Environment and custody

- Work from the repository root.
- Use the repository's ignored research root:
  `.firecrawl/todox-wealth-management-site/`.
- Use the already-authenticated Firecrawl CLI. If authentication is missing,
  authorize through the 1Password integration or inject the secret reference;
  never print, persist, or place the raw credential in a prompt.
- On this machine, invoke the CLI through the pinned Node runtime:
  `mise x node@24.19.0 -- npx -y firecrawl-cli@latest`.
- Capture status and credit usage before and after each lane. The user requested
  no artificial scrape cap, but every request should still have a stated
  research purpose.
- Store screenshots, full scrape payloads, search payloads, and private-source
  extracts only under `.firecrawl/`. The tracked packet receives citations,
  short evidence spans, hashes, and sanitized synthesis.

## Required lanes

| Lane | Firecrawl skills to load first | Outcome |
| --- | --- | --- |
| Site cartography | `firecrawl-map`, `firecrawl-workflows` | Complete URL inventories for Mariner and AdvicePeriod, clustered by page family, with high-value pages selected for scraping. |
| Account intelligence | `firecrawl-lead-research`, `firecrawl-workflows` | First-party operating model, advisor and client language, executive viewpoints, trust concerns, and source-backed sales triggers. |
| Competitive position | `firecrawl-competitive-intel`, `firecrawl-workflows` | Evidence matrix for direct, adjacent, incumbent, and emerging competitors; claims are tied to current primary pages. |
| Visual ingredients | `firecrawl-website-design-clone`, `firecrawl-workflows` | Screenshots plus observed typography, color, imagery, editorial, diagram, and motion ingredients. No final design direction. |
| Corpus and access | `firecrawl-knowledge-base`, `firecrawl-workflows` | Clean public-artifact corpus, access classification for supplied URLs, and a private-context summary kept outside tracked files. |

Use `firecrawl-agent` only when a site requires multi-step navigation or a
structured answer cannot be obtained with map, search, and targeted scrape.
Record why the autonomous agent was necessary.

## Lane contract

Every Grok prompt must state all of the following:

1. Read each required `SKILL.md` completely before invoking Firecrawl.
2. Use primary pages for product and company claims; use trade press,
   interviews, podcasts, video, and social results for voice and discovery.
3. Treat search snippets as leads, not evidence. Scrape or open the underlying
   page before promoting a claim.
4. Record the requested URL, canonical URL, title, publisher, capture date,
   access result, source tier, and local raw-evidence path.
5. Separate observation, inference, hypothesis, and synthetic illustration.
6. Mark quotations precisely and keep them short. Do not manufacture customer
   stories from generic marketing language.
7. Label inaccessible social pages `policy-blocked` or `auth-required` and
   continue through public mirrors, company bios, regulatory records, podcast
   pages, video descriptions, and reputable trade coverage.
8. Keep Mariner and AdvicePeriod account intelligence out of proposed public
   Todox copy unless it describes the market without naming or implying the
   account.
9. Do not claim Todox is deployed, integrated, compliant, certified, or giving
   autonomous financial advice. Repository product truth is the final gate.
10. End with a handoff that cites raw evidence paths and lists unresolved
    uncertainties.

## Site-cartography workflow

1. Map each root domain with sitemap discovery enabled.
2. Run filtered maps for advisor recruiting, services, technology, newsroom,
   insights, leadership, disclosures, privacy, AI, meetings, workflows, client
   stories, and video or podcast surfaces.
3. Deduplicate canonical URLs and group them into page families.
4. Select high-signal pages from every family and scrape them as markdown with
   metadata.
5. Reconcile AdvicePeriod's relationship to Mariner using disclosure or legal
   pages rather than logo placement or search snippets.

## Account-intelligence workflow

1. Start from first-party home, services, team, advisor, newsroom, disclosure,
   privacy, and AI-transparency pages.
2. Expand to named interviews, conference appearances, podcasts, videos,
   regulatory profiles, and trade reporting.
3. Extract operating tensions, not just slogans: client-context fragmentation,
   preparation burden, service consistency, advisor judgment, privacy,
   supervision, handoffs, and evidence retrieval.
4. Build story records only when a source supports the actor, setting, and
   friction. Otherwise label the record a scenario hypothesis.
5. Produce separate account briefs for sales use and a de-identified market
   synthesis for Fable.

## Competitive workflow

Inspect direct advisor assistants, specialized planning tools, wealth-platform
AI, systems of record, and local/explainable infrastructure. For every company,
capture:

- buyer and primary job;
- product form and workflow position;
- stated data, security, review, audit, or deployment posture;
- evidence of integrations and action boundaries;
- proof offered, such as customer quotation, case study, metric, or none;
- overlap with Todox;
- an evidence-backed distinction and the language Todox should not imitate.

A gap in a competitor page is not proof of absence. Phrase it as “not found in
the reviewed public sources” and preserve the reviewed URL set.

## Visual-inspiration workflow

1. Capture both the rendered page and design metadata for each reference.
2. Record only observed ingredients: font family if exposed, approximate color
   values if sampled, material, image treatment, grid, navigation behavior,
   diagrams, density, and motion.
3. Classify each source as an ingredient, contrast, or anti-reference.
4. Explain why an ingredient fits the subject without prescribing that Fable
   use it.
5. Record trademark, image-rights, and font-license cautions. Never lift a
   logo, proprietary image, illustration, or complete composition.

## Access matrix

Test every supplied public URL and classify the result:

- `full`: meaningful page content was retrieved;
- `partial`: metadata or a limited rendered surface was retrieved;
- `auth-required`: the origin requires an authenticated session;
- `policy-blocked`: the provider refuses the origin;
- `not-found`: no usable resource was returned.

Do not treat one tool's failure as a source's nonexistence. Firecrawl,
authenticated Notion access, and anonymous browser access are separate access
paths and must be reported separately.

## Promotion gates

A proposition promoted from the dated research inventory into downstream
public copy, a headline sales conclusion, or the Fable seed must pass every
applicable gate. Detailed source-indexed landscape tables may remain research
inventory without duplicating every cell into `CLAIMS.jsonl`; they must still
identify vendor assertions, preserve date and caveats, and never become public
copy by default.

1. The source exists in `SOURCE-MANIFEST.json`.
2. A proposition promoted beyond research inventory is represented in
   `CLAIMS.jsonl` with evidence and a proof grade.
3. The source's visibility permits the destination file.
4. A search snippet has been replaced by an opened underlying source.
5. A private note has been reduced to a sanitized decision or omitted.
6. Repository product truth does not contradict the wording.
7. Named-account material cannot imply endorsement or a customer relationship.
8. Synthetic demonstrations are visibly labeled synthetic.
9. Fable receives ingredients and constraints, not a predetermined design.

## Downstream handoff

Claude Fable starts with `FABLE-SEED.md`, then reads the source, claim, content,
competitive, customer-voice, and visual-inspiration files it names. Fable runs
Impeccable `init` for `apps/todox`, completes the human product-truth
confirmation, then runs `shape` for the marketing homepage. Within `shape`, it
uses `new-work` only through candidate exploration and a human-locked concept
choice, then returns the shape brief and stops before persistence or code. A
later, separately approved implementation session owns the final information
architecture, components, typography, palette, imagery, motion, brand system,
and code.
