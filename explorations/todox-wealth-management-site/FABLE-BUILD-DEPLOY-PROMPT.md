# Fable build and deployment prompt

Copy the prompt below into a fresh Claude Fable session started from the
repository root.

---

You are Claude Fable. Design, implement, verify, and deploy the Todox.ai
wealth-management marketing website in the existing `apps/todox` Next.js app.
Use the installed Impeccable workflow as the design authority.

This is a production execution request, not another research pass. The earlier
`research/FABLE-SEED.md` stopped before implementation. This prompt supplies
the separate implementation and production-deployment authorization described
there. It supersedes only that stop condition. Every product-truth boundary,
human confirmation gate, no-go, and provenance restriction remains binding.

## Required outcome

Ship one original, high-craft Persuade experience at `https://todox.ai` that
makes this mechanism understandable within the first viewport:

```text
approved source and stable source span
  -> candidate client context or work
  -> advisor or policy review
  -> current, rejected, or superseded state
  -> bounded meeting-preparation packet
  -> activity receipt attached to the work
```

The site is for senior wealth-management buyers who already have CRMs,
planning tools, document systems, meeting tools, compliance processes, and an
AI roadmap. It must feel authored for that audience without borrowing wealth
industry cliches or a competitor's trade dress.

The primary action is `Request a private walkthrough`. Resolve the real CTA
destination with the human during product initialization. Do not invent an
email address, form endpoint, scheduler, waitlist, or signup flow. Do not add a
backend merely to make the CTA look functional.

Implementation and production deployment are already authorized after the two
human gates below close. Do not ask for a third approval immediately before
deploying unless the Vercel target, domain, or authenticated account differs
from this prompt.

## Worktree and ownership fence

You share this checkout with other sessions. Preserve their work.

1. Begin with `pwd`, `git branch --show-current`, and `git status --short`.
2. The expected repository is `beep-effect21` and the expected branch is
   `todox-init`. If a different branch is active, do not switch across a dirty
   shared checkout. Report the mismatch and wait.
3. Treat every pre-existing modification and untracked file as another
   session's work. In particular, do not edit the Impeccable provider payload,
   `explorations/ATLAS.md`, `scratchpad/partners/**`, or research files in this
   packet.
4. Your write boundary is `apps/todox/**`, including app-local
   `PRODUCT.md`, `DESIGN.md`, `.impeccable/**`, source, tests, and original
   production assets. If an unexpected pre-existing edit already exists
   inside that boundary, inspect and integrate it rather than replacing it.
5. Do not run `git clean`, `git reset`, `git restore`, `git checkout --`,
   stashing, rebasing, broad repair commands, or destructive deletion. Never
   run a local `rm -rf`. Do not delete or reorganize unrelated files.
6. Do not commit, push, open a PR, or merge. This request authorizes the app
   implementation and Vercel deployment, not source-control publication.

## Read before deciding

Read the repository and app instructions first:

1. `AGENTS.md`
2. `apps/todox/AGENTS.md`
3. `standards/ARCHITECTURE.md`
4. the installed Impeccable `SKILL.md`
5. the installed Unslop `SKILL.md` for all human-facing copy

Then read the completed research packet in this order:

1. `explorations/todox-wealth-management-site/README.md`
2. `explorations/todox-wealth-management-site/DECISIONS.md`
3. `explorations/todox-wealth-management-site/BRIEF.md`
4. `explorations/todox-wealth-management-site/RESEARCH.md`
5. `explorations/todox-wealth-management-site/research/PRODUCT-TRUTH.md`
6. `explorations/todox-wealth-management-site/research/CLAIMS.jsonl`
7. `explorations/todox-wealth-management-site/research/SOURCE-MANIFEST.json`
8. `explorations/todox-wealth-management-site/research/CONTENT-SEED.md`
9. `explorations/todox-wealth-management-site/research/CUSTOMER-VOICE.md`
10. `explorations/todox-wealth-management-site/research/COMPETITIVE-POSITIONING.md`
11. `explorations/todox-wealth-management-site/research/VISUAL-INSPIRATION.md`
12. `explorations/todox-wealth-management-site/research/ARTIFACT-INVENTORY.md`
13. `explorations/todox-wealth-management-site/research/DATA-CONTRACTS.md`
14. `explorations/todox-wealth-management-site/research/SOURCES.md`
15. `explorations/todox-wealth-management-site/MAP.md`

Read `research/ACCOUNT-BRIEFS.md` only to understand buyer altitude,
objections, and installed-context risk. It is sales-only. No named account,
person, quote, statistic, relationship detail, or identifying composite may
enter public output.

Inspect the current `apps/todox` source, tests, package scripts, and deployment
configuration. It is a minimal Next.js App Router shell, not an incumbent
visual identity. Do not treat its placeholder typography or page as brand
authority.

## Impeccable process and human gates

Follow the installed Impeccable version exactly. Do not edit the skill or
hand-author substitutes for its scripts, decision board, reviewers, or
documentation passes.

Run its context command once for `apps/todox/src/app/page.tsx`. The expected
result is a greenfield web project with no `PRODUCT.md`, `DESIGN.md`, surface
brief, or visual authority.

### Gate 1: confirm product truth

Run `/impeccable init` with `apps/todox` as the active project. Use the packet
to avoid making the human repeat settled facts, but ask about material gaps the
packet cannot answer. The CTA destination is one such gap. Ask no aesthetic
questions during init.

Present the proposed app-local product record and obtain real human
confirmation before writing `apps/todox/PRODUCT.md`. The record must say:

- platform: web;
- stack: the existing Next.js App Router app in this monorepo;
- users: senior wealth buyers across advisor, operations, compliance/privacy,
  innovation/technology, and executive lenses;
- product posture: a vision-only wealth-management concept built around a
  deterministic synthetic proof fixture;
- purpose: make source-linked client context, candidate work, review,
  supersession, bounded action authority, and attached activity provenance
  concrete;
- systems of record remain authoritative for the data they own;
- the public site may invite a private walkthrough but may not claim product
  availability, deployment, adoption, integrations, compliance, or outcomes;
- demonstrations are synthetic and do not provide financial, investment, tax,
  or legal advice;
- no third-party endorsement, customer story, production asset, or named
  researched account is available for public use.

Record only confirmed facts and open decisions. Do not put a palette,
typography choice, component recipe, page structure, or selected inspiration
family in `PRODUCT.md`.

### Gate 2: lock the direction and shape brief

Run `/impeccable shape` for the Todox wealth-management marketing homepage in
Persuade mode. Enter the new-work process because there is no visual authority.

Derive the visual world from the product's mechanism, the buyer's actual work
scene, and the audience's cultural materials. The seven families in
`VISUAL-INSPIRATION.md` are provocations, not candidates already selected by
the research team. Follow Impeccable's direction derivation, concept seed,
challenger evaluation, decision board, re-roll, canon exit, and build-path
rules. Do not collapse this into a list of familiar website styles. The human
must lock a direction and confirm the resulting shape brief.

Within `shape`, stop where Impeccable tells `shape` to stop. Present the
human-locked direction, its rationale, the truthful risk, and the resulting
shape brief for confirmation. Once the human confirms it, treat that answer as
the continuation trigger for this already-authorized build. Resume the normal
new-work flow without rerunning context or demanding another implementation
approval.

After direction and analysis are settled, load Impeccable's `craft-floor.md`
immediately before the first UI edit. Persist the required direction contract
as the first emitted body child, including the seed key and exact FINISH line,
and verify that the production build preserves it.

## Product truth and public claim gate

Repository authority outranks historical demos, private notes, competitor
copy, visual references, and this marketing implementation.

Every factual public assertion must map to a `CLAIMS.jsonl` record whose
`publicEligible` value is `true`. Preserve its caveat and verify the linked
source record permits public use. `publicEligible: true` is necessary, not
sufficient. A sales-only source never becomes public because its language is
convenient.

Use honest concept tense where required, such as `designed to`, `the proposed
runtime`, `the concept`, or `a product direction`. Do not use copy that makes a
visitor infer that a rendered synthetic interface is a deployed product.

The site must never claim or imply:

- a deployed, generally available, production-ready, or pilot-ready wealth
  product;
- a named customer, partner, commissioner, endorser, or supplied individual;
- live CRM, custodian, email, calendar, document, portfolio, planning, or MCP
  connectors;
- autonomous advice, recommendations, tax conclusions, trading, money
  movement, unsupervised client communication, or silent system-of-record
  writes;
- SOC 2 or another certification, regulatory approval, compliance readiness,
  examination readiness, zero retention, or absolute privacy;
- zero hallucinations, universal truth, hidden chain-of-thought, complete
  explainability, or a promise that nothing leaves the device;
- time saved, AUM, adoption, accuracy, performance, ROI, or a customer outcome;
- `first`, `only`, `the AI OS for wealth`, or uniqueness based on citations,
  audit logs, MCP, human review, local deployment, privacy, or integrations.

Use the required truth in a concise, visible qualification near the page close:

> Todox.ai is a product concept in development. Demonstrations use synthetic
> data and do not provide financial, investment, tax, or legal advice. Product
> capabilities, integrations, controls, and availability remain subject to
> validation.

You may tighten the sentence only if every underlying fact and limitation
survives.

## What the experience must prove

Build one flagship narrative, not a dashboard suite or a generic feature
catalog. Author original synthetic data at production fidelity and label it
`Synthetic demonstration - no client data` wherever a visitor could mistake
it for a real record, operating customer, deployed product, or measured
result.

The narrative must make these states inspectable:

- an approved source and an exact supporting span;
- a proposed fact, task, question, or draft marked as a candidate;
- a conflict or changed instruction with explicit current and superseded
  states;
- accept, edit, and reject review by an advisor or policy role;
- a meeting-preparation assertion that opens or reveals its supporting source;
- an excluded item whose evidence or authorization is insufficient;
- an activity receipt naming source, actor, time, model or tool, policy or
  credential class, and review disposition;
- an uncertain or wrong model output remaining a candidate instead of silently
  entering accepted context.

Review records a scoped professional disposition. It does not make an
assertion universally true. The story ends at a reviewable meeting-preparation
packet. It stops before a client send, recommendation, tax conclusion, trade,
money movement, or external write.

The page must answer, in visible server-rendered language:

- What is Todox?
- Is this another meeting recorder or CRM replacement?
- How does source-linked meeting preparation work?
- What stays under firm and professional control?
- What is synthetic today, and what is not yet available?
- What does a private walkthrough examine?

Use `CONTENT-SEED.md` as raw material, not mandated copy or page order. Apply
Unslop before shipping. Prefer concrete verbs over category nouns. Do not lead
with `agentic`, `local-first`, `explainable`, `knowledge graph`, `copilot`, or
`human in the loop` unless the same viewport demonstrates the behavior.

## Design standard

The first viewport is the thesis, not a conventional navbar plus headline plus
CTA plus floating dashboard card. A visitor who leaves after one viewport
should remember the source-to-candidate-to-review mechanism, not merely a
color, atmosphere, or animation.

Commit to one coherent world. Rebuild every control, data object, rule,
navigation element, and state marker in its grammar. Do not hide stock product
UI inside an expressive shell. Pace the page with deliberate changes in
density, scale, motion, and quiet while keeping one spatial and typographic
logic.

Typography must have a point of view and remain legible. Do not default to
Inter, Roboto, Geist, Fraunces, Space Grotesk, Plus Jakarta Sans, Playfair,
Cormorant, Lora, Newsreader, Syne, DM Sans, Outfit, Instrument Sans, or IBM
Plex. If the human pins one during the direction process, honor that decision;
otherwise select a properly licensed face whose structure belongs to the
chosen world, with robust fallbacks and efficient loading.

Avoid the category defaults and packet anti-references:

- generic dark neon, glowing nodes, particle fields, AI brains, orbit diagrams,
  glass command centers, rainbow timelines, and cybersecurity theater;
- dominant chat, transcript, or meeting-recorder UI;
- yachts, lake scenes, marble lobbies, leather-and-gold old-money costume,
  happy-retiree stock photography, or generic smiling advisors;
- cream plus teal plus people photography that reads as Mariner;
- white plus orange numbered line art that reads as AdvicePeriod;
- third-party logos, screenshots, illustrations, photography, proprietary
  fonts, exact palettes, copy, or compositions;
- fake analyst, certification, regulator, award, ranking, customer-logo, or
  performance proof.

If the chosen direction requires imagery, diagrams, textures, or other
rasters, create or source them under Impeccable's asset process and preserve
prompt or origin provenance. A generic gradient, icon tile, glass panel, or
decorative product mockup is not a substitute for the authored material the
composition requires.

Motion must express the chosen form's native transition once, with intent.
Keep all content available without waiting for animation. Support
`prefers-reduced-motion`; avoid scroll hijacking, cursor replacement, noisy
hover effects, or motion that blocks reading and action.

## AEO, GEO, SEO, and linked-data foundation

Make the site unusually easy for search engines, answer engines, research
agents, and ordinary scrapers to read. Do this through the same public truth a
human sees. No cloaking, hidden keyword blocks, generated query variants, or
machine-only factual claims.

Required foundation:

1. Render critical copy, headings, navigation, qualification, and source-to-
   review explanation as semantic server-rendered HTML. The page must remain
   understandable without client JavaScript.
2. Use one clear `h1`, a correct heading order, landmark elements, descriptive
   links, useful alt text, and real crawlable `<a href>` navigation.
3. Set `metadataBase` to `https://todox.ai`, one canonical URL, a truthful title
   and description, Open Graph and Twitter metadata, and an original social
   card. Metadata must describe a product concept and synthetic demonstration,
   not shipped software.
4. Add `robots.ts`, `sitemap.ts`, and a web manifest where appropriate. Allow
   ordinary search and citation crawlers, including Googlebot, Bingbot,
   OAI-SearchBot, ChatGPT-User, PerplexityBot, Perplexity-User,
   Claude-SearchBot, and Claude-User. Keep training policy separate. Unless the
   human changes the policy, disallow GPTBot, ClaudeBot, and Google-Extended
   while leaving search and user-request agents allowed.
5. Add a concise `/llms.txt` as a convenience map to canonical public content
   and machine-readable data. State the concept and synthetic status clearly.
   Do not claim that `llms.txt` improves Google ranking.
6. Embed one valid JSON-LD `@graph` and expose the same safe graph at a stable
   public endpoint such as `/knowledge/todox.jsonld` with
   `application/ld+json`. Link the endpoint from the document head.
7. Give public entities stable canonical IRIs under `https://todox.ai`, for
   example `#organization`, `#website`, `#homepage`, and fragment identifiers
   for visible defined terms. Use Schema.org for the organization, website,
   page, and visible definitions. Add SKOS or PROV-O only when it expresses a
   real public relationship more precisely. Do not add vocabulary for the
   appearance of sophistication.
8. Keep structured data in parity with visible copy. Do not mark the concept as
   an available `SoftwareApplication`, add ratings, prices, offers, customers,
   FAQs, or capabilities the page does not truthfully expose. Do not publish
   internal repository paths, private source labels, the complete research
   ledger, sales-only evidence, or the fictional household as real data.
9. If the implementation defines terms such as candidate, supersession, review
   disposition, bounded context, or activity receipt in JSON-LD, give visitors
   the same definitions in a readable glossary or explainer on the page.
10. Keep one source of truth for metadata and public linked data where practical
    so copy, canonical IDs, the endpoint, and tests cannot drift independently.
11. Make all public knowledge endpoints fast, static or cacheable, indexable,
    and free of authentication, WAF challenges, client-side rendering, and
    cookies. Do not add analytics, tracking, or consent machinery unless the
    human explicitly asks.

The initial content scope remains one flagship public narrative. Technical
discoverability routes do not authorize an AI-written article farm, city or
persona variants, fake comparison pages, or a broad glossary of terms the page
does not actually teach.

## Implementation boundaries

- Work inside the existing `apps/todox` workspace. Do not create
  `apps/todox.ai` or another app.
- Keep app internals app-local through `@/*`. Do not create package-root
  exports or turn the app into a shared runtime package.
- Preserve Next.js App Router conventions and server components by default.
  Use a client component only where the approved interaction genuinely needs
  one, and progressively enhance it so core content remains accessible.
- Inspect live shared source and barrels before recreating a shared helper or
  component. Do not add a heavy design or animation dependency for work that
  well-authored CSS and small app-local code can do.
- Do not add authentication, a database, a CRM connector, a form backend, a
  fake API, a model call, telemetry, or an external system-of-record write.
- Keep external systems authoritative in both copy and behavior.
- Update the placeholder test suite to cover the public truth that matters:
  primary heading and action, concept and synthetic qualification, absence of
  forbidden availability language, usable landmark structure, and structured
  metadata or linked-data helpers where they can be tested without brittle
  snapshots.
- Keep runtime weight and hydration proportional to a one-page marketing
  experience. Prefer static output and bounded effects.

## Verification and finish workflow

Use the portless-wrapped app script for local development. Never start raw
Next.js or use a numeric localhost port. The expected development URL is the
portless Todox URL printed by `bun run --cwd apps/todox dev`.

If the approved experience has any gesture-bearing interaction, load and run
the repository's `browser-qa-loop` skill. Record real input, extract the
evidence, open every required still or frame, and judge it against the event
timeline. Do not substitute DOM inspection for interaction proof.

Follow Impeccable's bounded finish:

1. Complete the committed build before polishing.
2. If the build is comp-led, prove the first viewport against the approved
   comp at its exact size before building past it and save the required hero
   reproduction evidence.
3. Capture desktop and mobile together in one inspection round after entrance
   motion settles. Open every image and confirm that it contains the intended,
   fully loaded state.
4. Batch all material corrections, then run at most one confirmation round.
5. Run the Impeccable detector once on the changed web targets when the hook did
   not already do so. Triage every finding. Fix real defects, use only narrow
   justified suppressions for intentional choices, and report anything left
   standing.
6. Run the shipped Impeccable finish reviewer with fresh context and the full
   evidence packet. Obey `recapture`, `rebuild`, `fix`, or `ship` exactly. Do
   not self-certify around its verdict.
7. After the last correction, run the shipped Impeccable documenter so
   `apps/todox/DESIGN.md` and its required sidecar describe the built world,
   not the initial intention. Persist the small app-local surface brief.
8. Scan every shipping raster for provenance as required by Impeccable.

Run these scoped repository checks from the repository root:

```bash
bun run --cwd apps/todox check
bun run --cwd apps/todox test
bun run --cwd apps/todox lint
bun run --cwd apps/todox build
git diff --check -- apps/todox
```

Do not run a broad fixer over the dirty repository. Attribute any failure. Fix
failures introduced inside `apps/todox`; report inherited or unrelated
failures with evidence instead of changing another session's files.

Before deployment, inspect the app diff and status. Confirm that every changed
path is inside the authorized boundary and that no private research, source
capture, credential, account identity, or copied production asset entered the
build.

## Production deployment through Vercel CLI

Use the existing authenticated Vercel CLI and existing project. Do not create a
second Vercel project. Do not mutate Cloudflare settings. Do not print or store
tokens.

The last verified deployment state on 2026-08-27 was:

- authenticated user: `kriegcloud`;
- Vercel project: `todox`;
- project owner: the personal `kriegcloud` account;
- project root directory: `apps/todox`;
- production aliases: `todox.ai` and `www.todox.ai`;
- production status: Ready.

That state can drift, so verify it immediately before deployment:

```bash
vercel whoami
vercel project inspect todox
vercel domains inspect todox.ai
```

Do not pass `--scope kriegcloud`; the CLI rejects a personal account as an
explicit scope. If the authenticated user, project, root directory, or domain
attachment differs, stop and report the exact mismatch. Never answer a prompt
that would create or rename a project.

From the repository root, inspect deployment input without creating a
deployment:

```bash
vercel deploy --dry --json --yes --project todox \
  --local-config apps/todox/vercel.json \
  | jq '{framework:.framework.slug, basePath, fileCount, totalSize, ignoredCount}'
```

If the dry run identifies the existing `todox` project and the intended
monorepo root, deploy to production and wait for build logs:

```bash
vercel deploy --prod --yes --logs --project todox \
  --local-config apps/todox/vercel.json
```

Do not use `--force` unless Vercel proves the upload was skipped despite a
changed app and you can explain why. Do not create or expose a token. Do not
run local cleanup to influence the deployment. The existing `vercel.json`
install cleanup, inherited from `oip-web`, runs only in Vercel's disposable
remote builder. Never copy or invoke that cleanup command in the shared local
checkout.

Capture the returned immutable deployment URL. Then verify:

```bash
vercel inspect <immutable-deployment-url>
vercel inspect https://todox.ai
```

The deployment is complete only when both inspections report a Ready
production deployment and `https://todox.ai` points to that deployment.
Perform live HTTP and browser checks against the canonical domain, not only the
`.vercel.app` URL:

- homepage returns 200 and shows the approved build;
- canonical metadata points to `https://todox.ai`;
- title, description, Open Graph image, and structured data are present;
- `/robots.txt`, `/sitemap.xml`, `/llms.txt`, and
  `/knowledge/todox.jsonld` return successful, correct content types;
- JSON-LD parses and contains no forbidden or sales-only claims;
- primary navigation and CTA work at desktop and mobile widths;
- the page is usable by keyboard, respects reduced motion, and has no console
  errors, hydration errors, broken assets, or horizontal overflow;
- critical copy remains visible to a simple HTML fetch and to allowed crawler
  user agents.

If the build fails, fix only an introduced `apps/todox` problem, rerun the
scoped checks, and redeploy. If DNS or alias ownership has changed, stop and
report it. The existing domain attachment authorizes using the alias, not
changing Cloudflare or taking ownership actions elsewhere.

## Definition of done

Do not call the task complete until all of the following are true:

- the human confirmed `apps/todox/PRODUCT.md`;
- the human locked one Impeccable direction and confirmed the shape brief;
- the chosen direction's contract survives the production build;
- the final site is original, responsive, accessible, and specific to the
  source-to-review mechanism;
- every demonstration is unmistakably synthetic;
- every factual claim passes the public claim gate and retains its caveat;
- no named account, person, endorsement, private source, competitor asset, or
  fabricated proof entered the site;
- the AEO, GEO, SEO, crawler, and linked-data foundation is live and truthful;
- scoped typecheck, tests, lint, build, and diff hygiene pass;
- browser and Impeccable evidence exists, all captures were opened and
  validated, and the reviewer returned a closed disposition;
- `DESIGN.md`, its sidecar, and the app-local surface brief document the shipped
  result;
- Vercel reports the new production deployment Ready;
- `https://todox.ai` and `https://www.todox.ai` resolve to that deployment and
  the live acceptance checks pass;
- no unrelated work was edited, deleted, formatted, stashed, committed, or
  pushed.

## Final report

Return a compact but evidence-backed handoff containing:

1. the locked direction, first-viewport thesis, signature interaction, and
   honest design risk;
2. the final public positioning and the exact synthetic/product-concept
   qualification;
3. the files changed, grouped by product context, interface, content and linked
   data, tests, and Impeccable artifacts;
4. the scoped command results;
5. browser evidence paths, inspected viewport sizes, detector triage, finish
   reviewer disposition, and any unresolved finding the human chose to ship;
6. the immutable Vercel deployment URL, the production inspection status, and
   proof that `todox.ai` and `www.todox.ai` point to it;
7. any deliberate non-goal or blocked external dependency;
8. confirmation that no commit, push, PR, Cloudflare mutation, destructive
   cleanup, or unrelated-file edit occurred.

Do the work all the way through the two required human gates, implementation,
bounded finish, and production verification. Do not stop after producing a
mockup, a plan, a local build, or a preview deployment.

---
