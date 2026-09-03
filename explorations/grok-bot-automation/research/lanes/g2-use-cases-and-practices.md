# Grok Bot use cases and automation best practices

**Research date:** 2026-09-03
**Lane:** web + X research for beep-effect Grok Bot automation
**Official product page:** https://x.ai/bot
**Status:** complete for this lane (2026-09-03) — Q1 catalog ~40 rows; Q2–Q5 filled from first-party docs + practitioner writeups + vendor comparables; shortlist ranked; stop new research.

Legend for claims:
- **Source class:** `xAI-documented` vs `reported-by-users` vs `vendor-docs` vs `practitioner`
- **Confidence:** `[high]` first-party docs / high-engagement firsthand writeups; `[medium]` credible but secondhand or incomplete; `[low]` rumor, single anecdote, or inferred
- Every claim carries a dated URL and `accessed 2026-09-03`
- **Do not conflate:** Grok chat, Grok Automations (grok.com scheduled jobs, 2026-07-16), Grok CLI/Build, xAI API, and **Grok Bot** (Cursor-hosted named teammates). Only the last is this report’s subject unless a comparable system is explicitly labeled.

---

## Q1. Catalog of real Grok Bot use cases

Aim: 25+ distinct examples with links. Groups: developer/repo maintenance; research digests and monitoring; QA/testing; content and social; data pipelines; personal/ops.

For each: what it does, trigger, tools used, what worked, what broke, engagement/credibility.

**Filter:** only count an example as Grok Bot if the source clearly names x.ai/bot, SuperGrok Heavy bots, Cursor-hosted Grok Bot, or the hosted scheduled-bot product. Exclude `@grok` on X, Telegram/Discord wrappers, and generic “I built a grok bot.”

Numbering is for this report only. Engagement on X posts is filled as posts are fetched; blog posts are firsthand writeups unless noted.

### Developer / repo maintenance

**D1. Atmoio Blog Manager pushed a live blog change** — `reported-by-users` `[high]`
- **What:** One of eight specialized bots “had pushed a change to my blog”; author built eight bots in an afternoon including a Blog Manager that modifies and publishes blog code.
- **Trigger:** Unspecified (manual / as-needed in the writeup).
- **Tools:** Computer-use / browser + filesystem on the shared Linux VM (author’s thesis: click through sites without APIs).
- **Worked:** Independent locate-edit-publish of blog files.
- **Broke:** Article flags four hard limits (paywalled); will not connect Google; routine-scheduling limitation “wasted a first afternoon.”
- **Credibility:** Firsthand Substack, 2026-08-25. Source: https://atmoio.substack.com/p/i-went-in-ready-to-hate-grok-bot accessed 2026-09-03.

**D2. Dennis Yu IT Support desk — WordPress/GitHub/AWS fleet ops with receipts** — `reported-by-users` `[high]`
- **What:** Named desk “Austin” does bounded recovery: WP-CLI via AWS SSM, REST application passwords, plugin patches, GitHub org invites. Public receipts dated 2026-08-16 through 2026-09-02 (access reset on theninetriangles.com while site stayed up; patched Smush/NitroPack; invited `hezekiah-lss` to Local-Service-Spotlight GitHub org Write on two repos; 40/41 All-in-One WP Migration copies updated; 116 BlitzAdmin DB records reconciled).
- **Trigger:** Access/hosting/DNS/WordPress/plugin incidents routed by Ops Coordinator; not a firehose.
- **Tools:** AWS SSM, EC2 inventory, Route 53, WP-CLI, WordPress REST, application passwords. **Cannot** use the AWS website, reboot/delete servers, widen permissions, publish, or send mail.
- **Worked:** Multiple dated receipts; public site stayed up during login recovery.
- **Broke:** WP Engine portal still needed a human; licensed WP-CLI missing so Elementor Pro CVE-2026-32475 not patched (refused pirated package); GitHub App for wordpress-site-builder blocked by org policy (deploy keys); some DNS/hosting ownership questions.
- **Credibility:** Firsthand ops log with dates. Source: https://dennisyu.com/how-i-use-grok-bot/ accessed 2026-09-03.

**D3. Dennis Yu Training + Documentation (Alex) — receipt-to-skill / SOP loop** — `reported-by-users` `[high]`
- **What:** Converts completed work (Zoom, broken button, deck, newly learned process) into public master versions, SOPs, skills, and training. Shared GitHub skill repository is how desks stay current (“Learn-Do-Teach”).
- **Trigger:** Completed work / new process.
- **Tools:** Article guidelines, skill packs, GitHub, Drive, Task Library. Sensitive actions gated.
- **Worked:** Presented as the mechanism that keeps agents current; durable receipts in GitHub `agent-notes` + `NOW.md`.
- **Broke:** Not a failure story; GitHub App deploy-key policy blocked one automation path (see D2).
- **Why it matters for beep-effect:** closest field analogue to “style & law enhancer” that *writes skills back into git* rather than only commenting on PRs.
- Source: https://dennisyu.com/how-i-use-grok-bot/ accessed 2026-09-03.

**D4. CasJam 13-bot product org — Head / Growth / Maintainer per product** — `reported-by-users` `[high]` for the org chart; `[medium]` for run quality (no public receipts)
- **What:** v1 (2026-08-21, 121 likes / 45k views): Chief, Heads, Doers bench, Reviewers (QA, they don’t build), human for vision/approvals. v2 (2026-08-29, **200 likes / 354 bookmarks / 32.7k views**): each product gets Head (roadmap, orchestrates feature dev, weekly report to Chief), Growth (pitches/ships experiments, documents learnings), Maintainer (recurring chores). Four brands → 13 bots. Pack: copy the *shape*, not the brands; routines **off** until a read-only task passes; Growth does not ship without Head visibility; Maintainer must not invent work; Reviewers are approval gates. **2026-08-30 clarification:** “most heavy usage happens through amp and OpenAI subscription. **Grok Bot is mostly just orchestrator.**” Split: Building = Cursor; Chat/thinking = Grok app; Operations = Grok Bot.
- **Trigger:** Weekly Head→Chief; Maintainer recurring; Doers hired from bench for a specific week.
- **Worked / broke:** Org chart is the artifact; Lakshmanan reply: watch shared state when Head and Growth disagree — needs a versioned decision log (not shown as implemented).
- Sources: https://x.com/CasJam/status/2093762642867581359 ; https://x.com/CasJam/status/2090852790809620631 ; https://x.com/CasJam/status/2093900327498010843 ; https://github.com/majiayu000/awesome-grok-bot/blob/main/packs/casjam-product-heads.md accessed 2026-09-03.

**D5. Official “Product Performance” investigator** — `xAI-documented` `[high]` as intended shape, not a user receipt
- **What:** Investigate a focused regression with screenshots + direct links; separate confirmed facts from hypotheses; **do not modify alerts or production config.** Recurring health reporting suggested.
- **Trigger:** Regression prompt; optional recurring health report.
- **Tools:** Observability, analytics, incident tools, source-control links.
- Source: https://docs.x.ai/grok-bot/use-cases accessed 2026-09-03.

**D6. Flocker VM as a persistent build box (capability report, not a named repo)** — `practitioner` `[medium]`
- **What:** Measured the shared computer: Debian KVM, 8 vCPU Xeon Emerald Rapids-class, ~16 GB RAM, ~120 GB disk, no GPU. Reports installing NPM packages, running builds, keeping watchers/local servers after closing the laptop. Computer time is **not** billed separately — weekly plan + token charges.
- **Broke:** Manually installed packages may not survive image updates; VM can be rebuilt; shared files/creds are account-wide.
- Source: https://flocker.md/blog/grok-bot-roles-workspace-and-specs/ (2026-08-25) accessed 2026-09-03.

**D7. Catalog-only coding seats (unverified shares)** — `reported-by-users` `[low]` until a writeup is attached
awesome-grok-bot lists 61 “Coding & shipping” shares (0 verified at catalog review). Names that match beep-effect jobs: **PR Reviewer, Tech Lead, Engineering QA, Gardener, Nightly Audit Engineer, Repo Engineer, Code Red** (confirmation-gated emergency stop), **Usage Auditor / Brake**, plus delegators to Claude Code / Cursor Agent / Grok Build. A share copies config/skills/routines, **not** computer or logins. Do not treat these as proven field runs.
Source: https://github.com/majiayu000/awesome-grok-bot accessed 2026-09-03.

**D8. Rick Hightower — 13-actor Grok Bot roster + git-backed second brain shared with Claude Code / Codex** — `reported-by-users` `[high]`
- **What:** Grok Bot cloud agents and laptop Claude Code / Codex / Claude Desktop / Grok Build share a **separate Markdown/YAML knowledge repo**. Working memory (chat) vs institutional memory (typed nodes). **“Reads on main; writes happen on a branch.”** Session start: fetch, fast-forward `main`, build a bounded pack (max 2 hops / 20 nodes, pack gitignored). Writes: claim actor identity → fresh worktree `brain/<actor-slug>/<session-id>` → `brain.py` stamps metadata → validate types/titles/links → commit, push, PR, merge after checks. **“The model proposes.”** Inbox roles: Chief of Staff, Media Consultant, Pipeline Sales, AI News Journalist, client managers, job-search, consulting-leads (13 actors including 4 unnamed client managers).
- **Trigger:** session-start hook + per-lane work (news digests, sales stages, consulting qualification, daily executive digest).
- **Worked:** typed files beat flat note folders; named links = deterministic retrieval without embeddings; worktrees turn concurrent Bot+laptop writes into reviewable merges; satellite trees keep high-volume drafts out of the shared graph.
- **Broke / residual:** session context dies when a tab closes; concurrent edits on `main` clobber; status goes stale unless verified against mail/calendar; duplicate entities; over-promotion makes the tree unreadable; **worktrees are concurrency control, not tenant security** — Grok chats still share one Linux host.
- **Date:** 2026-08-22.
- Source: https://rickhigh.substack.com/p/grok-bot-claude-code-and-codex-share accessed 2026-09-03.
- **Beep-effect note:** this is the strongest published pattern for “Grok Bot nightly research packet → PR” plus sharing with Claude Code / Codex. Steal: typed packets, worktree-per-run, PR-only, bounded retrieval pack.

**D9. n2parko (SpaceXAI product) — CoS + EM + 5 eng ICs + Databricks analyst + PM** — `reported-by-users` `[high]`
- **What (launch day thread 2026-08-11):** Core team: **Chief of staff** (Slack/inbox/cal: archives off-focus email, triages Slack, registered two office visitors + calendar holds); **Eng manager Emily** (explicitly **must not code** — breaks down work, delegates, validates against the goal; onboarded by reading @danielstjules Slack to learn “what great looks like”); **five eng IC bots** that spin and manage **Cursor Cloud Agents**, validate/test outputs, coordinate with each other (“agents all the way down”); **data analyst** (most-used; Databricks; answers arbitrary questions with charts; **reviews key dashboards and flags concerning trends every morning**); **PM Pete** (product sidekick; researched a missing hardware part and **ordered it on Amazon**). Follow-up 2026-08-28: will publish full product team; 2026-09-02 Spaces “Grok Bot: Product Best Practices.”
- **Trigger:** mix of chat, event (inbox/Slack), morning dashboard review.
- **Worked:** specialist roles; Cloud Agent delegation; morning analytics.
- **Broke / caveat:** learning curve called out in the opener. Nan Yu asked why not one bot — n2parko’s design is the answer (specialists).
- **Engagement:** thread 424 likes / 570 bookmarks / 64.7k views; quoted @bot launch 35k likes / 50M views; later “how I’ve been using Grok Bot” article 318 likes / 493 bookmarks / 1.09M views (https://x.com/i/article/2088646125351997440); Spaces post 149 likes / 209 bookmarks / 12.7k views.
- Sources: https://x.com/n2parko/status/2087251704744235298 ; https://x.com/n2parko/status/2095194988309336081 accessed 2026-09-03.

**D10. Lingxi Li (SpaceXAI, *building Grok Bot*) — five engineer bots + Jenny ops + nightly 3am audits + 30-min PR patrol** — `reported-by-users` (staff firsthand) `[high]`
- **What (2026-08-31 article-post):** Treat Grok Bot as a capable intern that **manages coding agents**, not as the coder. Five domain-owner engineer bots (Baltata mobile/iOS shared layer, Shaoruru Desktop+CI/CD, Hogan infra + unclear-ownership issues, Craig Android, Quill harness). Each has its own memory; they work best focused. Every bot can **create Cursor Cloud Agents**, read transcripts, review proofs on PRs, queue follow-ups or interrupt a run. Task (from Lingxi or Slack) → Cloud Agent with his skills (`/lingxi-design`, `/react-native-best-practices`, `/lingxi-review`, `/lingxi-product`) + explicit **proof expected**. Can also start Cloud Agents on a **private worker** (spare Mac mini / VPN box) for iOS Simulator screenshots. **Shared Notion DB** polled **every 30 minutes**: Bugbot/security comments (verify legitimacy), failing CI, merge conflicts → follow up with the Cloud Agent and set row back to Working; if clean, mark Ready for Review and kick a code-review run; **auto-merge only if highly confident and blast radius is low**. Claims: before Bot he managed ~15 Cloud Agents; fleet now **>200 simultaneous**. @poteto “shipped 2,000+ PRs in the past month”; Grok Bot iOS v0 in three weeks using only Grok Bot; foundation built in four weeks by teammates using Bot.
  - **Jenny (ops, the only non-coding bot):** 05:00 1:1 with every bot (playbook, blockers, vibe); postmortems when a bot doesn’t push back enough; onboards new bots.
  - **Nightly audits 03:00:** cleanup, dead logic, load time, bundle size → “fresh set of PRs” each morning. Suggested extra audits: security, CI/CD build-time, i18n gaps, **iOS vs desktop parity**, catch-up summary of last-24h PRs in an area. Favorite prompt: “You have six hours tonight. Build whatever you want. Have fun!”
  - **P0 process:** temporary routine that checks the Cloud Agent transcript **every 5 minutes** and steers it. **“This can burn tokens much faster than you think, so only use it for true urgency.”**
- **Trigger:** Slack/user task; 30-min Notion patrol; 03:00 nightly; 05:00 Jenny 1:1s; P0 keyword.
- **Worked:** proof loop (screenshots, DevTools, CLI, speech-to-speech I/O); flakiness unblocked without waking him; morning merge-ready queue.
- **Broke / residual:** one-off flakiness still reaches him when Bot **lacks security permissions** to fix it; auto-merge is gated; P0 burns tokens; context limit → Notion + daily 1:1s as external memory.
- **Staff tips (counter-intuitive, high value):** Grok Bot **manages work** (starts Cloud Agents, inspects proof, sends back) rather than being the worker; **put rules and progress in files**, inspect on a timer, don’t stuff the same chat; missing piece is a **feedback loop**, not a longer prompt; daily bot meetings beat mega-prompts; treat it like a talented intern (“do your homework”); if you do something more than once a day with a pattern, offload it.
- **Engagement:** 3,494 likes / 362 reposts / 7,868 bookmarks / 942k views. Replies include @ericzakariasson “holy shit this is good.”
- Source: https://x.com/lingxi/status/2094493172516966781 (also https://x.com/i/article/2090147220838588416) accessed 2026-09-03.
- **Beep-effect note:** this is the template for Benjamin’s unused Heavy grant: Bot = orchestrator + proof-checker; Cloud Agent / Codex / Claude Code = workers; nightly audits as PRs; 30-min CI/Bugbot babysit; auto-merge **off** (his main is PR-only + Greptile). Steal the audit menu (parity, i18n N/A, catch-up of merged PRs vs skills/docs, dead-logic vs knip).

**D11. Ray Fernando “Clippy CTO” / other catalog engineering seats** — `reported-by-users` `[low]`
- Catalog field-case: coordinating child bots and PRs. Primary writeup not independently fetched this pass. Prefer D9/D10.

**D12. James Martinez — Tailscale from Bot VM → Mac mini running Grok Build** — `reported-by-users` `[medium]`
- **What (2026-09-03):** “I made my own grok bot cloud agent since SuperGrok Heavy doesn’t come with cloud agents. Tailscale on grok bot computer, ssh into Mac mini, run grok build on mini with repos there.”
- **Credibility:** n=1, 1 like / 65 views at fetch. Matches official private-networks docs (Tailscale on the cloud computer) and Lingxi’s “private worker” path.
- Source: https://x.com/realjamesmtz/status/2095347033393475885 accessed 2026-09-03.

**D13. The Futurist — live booking page + daily directory Markdown → coding agent publish** — `reported-by-users` `[medium]`
- **What (2026-08-22):** Per-project Grok Bot accounts. CoS on Notion/Slack/Gmail. Research agent writes daily directory brand pages in Markdown; coding agent publishes them. Built a live booking page (Cloudflare, Porkbun, Astro, GitHub). Newsletter op: 2×/week restaurant research → Notion → Make.com blurbs → Beehiiv Thursday issue; Gmail for ad inquiries; bagel-shop sponsor (~6k readers). Status contract: “what shipped, what is stuck, and what needs you.” Mixing businesses in one account burned tokens.
- Source: https://www.thefuturist.co/making-with-grok-bot/ accessed 2026-09-03.

### Research digests and monitoring

**R1. Official Chief of Staff daily digest** — `xAI-documented` `[high]`
- **What:** Source-linked digest of changes and decisions requiring attention across Slack, email, calendar, meeting notes, planning docs. Filter against stated priorities; refine by labeling useful vs irrelevant. **Do not send messages or modify meetings.**
- **Trigger:** “Activity since yesterday”; schedule at a reviewable time.
- Source: https://docs.x.ai/grok-bot/use-cases accessed 2026-09-03.

**R2. Official Sales Outbound nightly account research** — `xAI-documented` `[high]`
- **What:** Research 25 CRM accounts, score vs ICP, rank contacts, prepare outreach **review queue**. Do not send or enroll. Optional nightly routine **after** results are dependable.
- Source: https://docs.x.ai/grok-bot/use-cases accessed 2026-09-03.

**R3. Official Account Health weekly portfolio ranking** — `xAI-documented` `[high]`
- **What:** Rank customer risks and expansion signals. Do not contact customers or edit CRM. Put risk thresholds in Bot instructions.
- Source: https://docs.x.ai/grok-bot/use-cases accessed 2026-09-03.

**R4. Atmoio monitoring fleet (Analytics Watcher, PressBot, EspionageBot, Search Presence)** — `reported-by-users` `[medium]`
- **What:** Eight-bot afternoon build: dashboard without API; watch arbitrary pages; competitor pricing/careers/changelogs; search visibility. Author argues specialized single-purpose bots beat one generalist. Teach-by-demonstration “worked better in beta than writing lengthy prompts.”
- **Broke:** Will not connect Google; scheduling limitation wasted a first afternoon.
- Source: https://atmoio.substack.com/p/i-went-in-ready-to-hate-grok-bot (2026-08-25) accessed 2026-09-03.

**R5. Debbie O’Brien news patrol + weekday morning MP3 podcast** — `reported-by-users` `[high]`
- **What:** Recurring news monitoring (Playwright, Cursor, MCP, model launches among topics), calendar checks, email/calendar “actionable ping,” weekday morning MP3 podcast. Coordinated home / travel / chief-of-staff bots.
- **Trigger:** Recurring routines + NL from mobile/desktop.
- **Tools:** Remote browser; attempted X connection.
- Source: https://debbie.codes/blog/i-sent-grok-bot-to-buy-my-gluten-free-beer (2026-08-16) accessed 2026-09-03. Also https://dev.to/debs_obrien/grok-bot-just-dropped-and-i-had-to-try-it-2bnf

**R6. Nate customer-language research specialist** — `reported-by-users` `[medium]`
- **What:** One of ~12 bots in ~8 hours (2026-08-14): searched for language customers use. Also contact-research bot. “A Bot owns a theme, not a task.”
- Source: https://natesnewsletter.substack.com/p/grok-bot-review accessed 2026-09-03.

**R7. Catalog research seats** — `reported-by-users` `[low]` unverified shares
awesome-grok-bot “Research & briefings” = 62 listed: Competitor Watching, Scout, Frontier Model Watch, X Brief, Daily YouTube Recap, Podcast Summary, last30days. 0 verified. Source: https://github.com/majiayu000/awesome-grok-bot

### QA / testing

**Q1a. Official Bug Reproduction pack** — `xAI-documented` `[high]`
- **What:** Read bug report, reproduce in **staging** with a **fresh test account**, produce evidence-rich test package. Never production customer data. Credentials via secure channel, not chat.
- **Trigger:** Bug report (event or manual). Skills-page sibling: Slack `#customer-escalations` + “needs repro” → repro pack in the Bot conversation; never post back to Slack without approval.
- Sources: https://docs.x.ai/grok-bot/use-cases ; https://docs.x.ai/grok-bot/skills-routines-and-automations accessed 2026-09-03.
- **Beep-effect note:** this is the official twin of Benjamin’s existing desktop-web-app QA bot.

**Q1b. Atmoio UptimeBot + Analytics Watcher** — `reported-by-users` `[medium]`
- **What:** Check uptime *and* whether a server is up but serving the wrong result; read a dashboard with no API.
- Source: https://atmoio.substack.com/p/i-went-in-ready-to-hate-grok-bot accessed 2026-09-03.

**Q1c. Dennis Yu Fleet Monitor — canary-first website QA** — `reported-by-users` `[high]`
- **What:** Existing canary-first website fleet loop, uptime, property registry; routes bounded incidents to IT Support. Monitoring and routing, not arbitrary remediation.
- **Tools:** Website QA audit, QA checklist, DNS, digital plumbing.
- Source: https://dennisyu.com/how-i-use-grok-bot/ accessed 2026-09-03.

**Q1d. Official Paid Media monitor (read-only)** — `xAI-documented` `[high]`
- **What:** Pull current spend/performance; recommend budget changes; **never** change budgets or auto-send the Slack update.
- Source: https://docs.x.ai/grok-bot/use-cases accessed 2026-09-03.

### Content and social

**C1. Remy “Gordon” — newsletter → X / LinkedIn / YouTube comments** — `reported-by-users` `[high]`
- **What:** Three-bot roster (Alfred personal, Gordon content, Florence brand deals). Gordon reworked the previous newsletter for X and LinkedIn, began responding to YouTube comments, then continued automatically. Output “extremely solid,” almost no extra training. Alfred delegated an NDA to Florence (Bot-to-Bot).
- **Trigger:** After testing, automatic (schedule not specified).
- **Worked:** Specialist roles + delegation.
- **Broke:** Gordon spent ~1 hour trying to publish an article to X; Remy could not see which tools were in use, why it stalled, or **stop it while it burned usage**. “Told is last year. Done is the frontier” is Nate’s line; Remy’s lesson is the missing kill switch. Compares ~$200 Cursor Ultra vs Hermes-on-Codex $100–200; does **not** expect Bot to replace Claude Code (Claude = building; Bot = autonomous ops).
- **Date:** 2026-08-15.
- Source: https://aiwithremy.beehiiv.com/p/what-i-m-actually-using-grok-bot-for accessed 2026-09-03.

**C2. Dennis Yu Article Writer (Trenton) + Website Builder** — `reported-by-users` `[high]`
- **What:** Research → long-form article (source-faithful, label unknowns; human review required). Website Builder coordinates specialists and verifies saved source + desktop/mobile rendering. **Documentation on the hub can ship by default; email/spend/delete/permissions/production stay gated.** “Do not click Reset” — use Update Computer so files/logins persist.
- Source: https://dennisyu.com/how-i-use-grok-bot/ accessed 2026-09-03.

**C3. Nate landing-page project lead** — `reported-by-users` `[medium]`
- **What:** One of the 12 day-one bots managed a landing-page project. Also LinkedIn bot. Super Doer / Business-in-a-Box recommended starters.
- Source: https://natesnewsletter.substack.com/p/grok-bot-review (2026-08-14) accessed 2026-09-03.

**C4. Catalog content seats** — `reported-by-users` `[low]`
68 listed “Content & publishing” shares: ClipMaker/Shorty, Social Media GTM, Twitter Automations, X Account Crew, Site Audit, ChatPRD. 0 verified. Source: https://github.com/majiayu000/awesome-grok-bot

### Data pipelines

**P1. Official Expense Manager weekly reconcile** — `xAI-documented` `[high]`
- **What:** Weekly expense summary from expense system + attached policy; cite policy per exception; reconcile totals to source. Do not send follow-ups or alter reimbursements.
- Source: https://docs.x.ai/grok-bot/use-cases accessed 2026-09-03.

**P2. Dennis Yu Meter Maid — usage-pool watchdog** — `reported-by-users` `[high]`
- **What:** Watches paid-seat usage / ticket levels; warns and routes work; **cannot buy usage or raise caps unless asked.** Prioritize included capacity before overflow. Author says excessive overflow previously cost **thousands monthly** (across his AI stack, not claimed as Grok Bot-only).
- **Trigger:** Usage concern / live dashboards.
- **Beep-effect note:** portable pattern for SuperGrok Heavy’s unpublished weekly pool + on-demand spill (Q4).
- Source: https://dennisyu.com/how-i-use-grok-bot/ accessed 2026-09-03.

**P3. Debbie Amazon order + Alcampo cart (purchase pipeline)** — `reported-by-users` `[high]`
- **What:** Extracted school-supply list; added/purchased two jumbo paper-towel rolls on Amazon (order confirmed via email); researched gluten-free beer, built Alcampo cart, reserved cheaper delivery slot **without completing payment**.
- **Tools:** Remote browser; 1Password retrieved **by Debbie on desktop** (not pasted in chat). She suggests a 1Password MCP.
- **Worked:** Amazon purchase; state persisted mobile↔desktop; Alcampo cart preserved.
- **Broke:** Mobile Alcampo login/forms (`about:blank`, disabled connect, mystery AI-car tab); security change forced password reset; she took over the browser to log in. X connection attempted.
- Source: https://debbie.codes/blog/i-sent-grok-bot-to-buy-my-gluten-free-beer (2026-08-16) accessed 2026-09-03.

### Personal / ops

**O1. Remy Alfred + Florence — NDA handoff** — `reported-by-users` `[medium]` (happened; few tool details)
- Source: https://aiwithremy.beehiiv.com/p/what-i-m-actually-using-grok-bot-for

**O2. Nate 12-bot first day (Gmail, Slack, Calendar, travel, exercise, backyard sauna, CoS)** — `reported-by-users` `[medium]`
- Login handoff (human takes control for auth, returns it) worked. Shared computer is “the point.” Paywalled price section. Source: https://natesnewsletter.substack.com/p/grok-bot-review

**O3. Debbie home / school / shopping / travel / CoS mesh** — `reported-by-users` `[high]`
- Covered under R5/P3. Source: https://debbie.codes/blog/i-sent-grok-bot-to-buy-my-gluten-free-beer

**O4. Official Talent Scout** — `xAI-documented` `[high]`
- Find 20 candidates, document evidence, draft outreach, prepare interviews. Do not contact without approval. Exclude existing ATS records.
- Source: https://docs.x.ai/grok-bot/use-cases

**O5. Tyler Nishida — Work vs Life inboxes that spawn specialist channels** — `reported-by-users` `[medium]`
- **What (2026-08-28):** Split tasks into Life and Work buckets; those bots create new channels and specialist bots. If a task is both, default to Life. Published share templates (life + work). Quoted @bot “share templates” launch (4,468 likes / 14.9M views).
- **Engagement:** 5 likes / 601 views — pattern is documented, not a high-receipt run.
- **Beep-effect note:** two-door isolation is **organizational**, not a security boundary (shared VM). Do not treat Life/Work bots as tenant isolation.
- Sources: https://x.com/TylerNishida/status/2093426221732532457 ; pack `packs/two-door-work-life.md` accessed 2026-09-03.

**O6. HouseHackerJon — plumbing-company office manager (work-order intake across six apps)** — `reported-by-users` `[high]`
- **What (2026-08-12, 24h writeup):** Automate work-order intake, capacity planning, booking across Gmail, Slack, ServiceTitan, Quo, plus a facility-maintenance client portal. Claude Code Max had ~80% (MCP/API) after a week but **no easy browser automation in client portals**. Grok Bot trial: ~4 hours to finish; ran a live lead start-to-finish until trial credits ran out; bought Cursor Ultra $200/mo. Claims 5–6 time-sensitive work orders/day; ~10 minutes intake→calendar if the customer replies.
- **Trigger:** inbound work orders (email/Slack/portals).
- **Tools:** computer-use/browser on portals without APIs; Slack/Gmail; ServiceTitan. Spawns agents and “automatically handles dealing with context windows.”
- **Worked:** the no-API portal gap that blocked Claude; live lead booked.
- **Broke / residual:** trial credits mid-job; hopes Ultra $200 is enough because the work is “repetitive boring and simple”; no independent confirmation of booking accuracy.
- **Engagement:** **2,406 likes / 141 reposts / 3,227 bookmarks / 700k views.**
- Source: https://x.com/HouseHackerJon/status/2087635639701573962 accessed 2026-09-03.
- **Beep-effect note:** strongest public proof that **computer-use on sites without MCP** is the Bot-shaped job (same shape as the desktop-web-app QA bot). Not a reason to put beep-effect *coding* on the shared VM.

**O7. Gota — twelve-job first-week mesh (research, images, travel, subs, local LLM on the VM)** — `reported-by-users` `[medium]`
- **What (2026-08-12):** Character-locked image production; X research for image-gen lore; 3D ghost icon via script **and** mouse; travel agent (candidates only, no booking); weekly brief on AI labs/agent firms/evals; subscription ledger then **actual cancel/plan-change**; machine-spec survey; **ran a local LLM inside the cloud VM and measured speed**; installed Blender (no GPU — confirmed 3D software still opens); morning digest + mail triage; calendar watch for ticket onsale.
- **Broke / residual:** “still many improvements”; **once Cursor Cloud Agent was available, started full migration to Cloud Agents** for the heavy work.
- **Engagement:** 51 likes / 39 bookmarks / 6.6k views.
- Source: https://x.com/gota_bara/status/2087666940450152841 accessed 2026-09-03.

**O8. Gergely Orosz — Gmail spam scan + multi-account Gmail/Slack (API-impossible jobs)** — `reported-by-users` `[high]`
- **What:** (2026-08-23) “Go thru my spam (at my main domain) and check if there are any emails from paid or free newsletter subscribers.” Gmail API **does not expose spam**; Bot does it via the web UI. (2026-08-20) Connecting several Gmail + Slack accounts in a *managed* agent — “no other managed agent (e.g. Codex, Claude Cowork) supports this.”
- **Engagement:** spam post 255 likes / 96 bookmarks / 40.5k views; multi-account post 276 likes / 147 bookmarks / 61.5k views.
- Sources: https://x.com/GergelyOrosz/status/2091476557399237015 ; https://x.com/GergelyOrosz/status/2090353329771631080 accessed 2026-09-03.

**O9. Farzad — Bot pinged that an X API changelog he asked for shipped** — `reported-by-users` `[medium]`
- **What (2026-09-02):** Asked X team to fix uploads >10 min; Grok Bot later pinged that it was fixed and attached changelogs. Separate thread: Peter Yang does not like typing passwords/OTP into the cloud browser; Farzad’s proposed “fix” is dumping the Chrome password manager into Grok Bot (**do not copy** — contradicts official secret-card / human-takeover guidance).
- **Engagement:** changelog ping 2,866 likes / 2.68M views (quote-tweet of Elon “Will fix”); Yang’s password concern 304 likes / 82k views.
- Sources: https://x.com/farzyness/status/2095187604924723328 ; https://x.com/petergyang/status/2095217706647851168 accessed 2026-09-03.

### Official xAI use-case index (all eight, 2026-09-03)

From https://docs.x.ai/grok-bot/use-cases `[high]` `xAI-documented`: Sales Outbound, Talent Scout, Paid Media, Expense Manager, Product Performance, Bug Reproduction, Account Health, Chief of Staff. Shared recipe: define role + connected systems + output structure + permanent limits → test a real task → save skill → add routine only after retries/failure handling are understood → keep consequential external actions behind approval.

### Q1 notes / gaps

- **Counted distinct jobs:** D1–D13, R1–R7, Q1a–Q1d, C1–C4, P1–P3, O1–O9 ≈ **40 numbered rows**. Firsthand / official: D1–D6, D8–D10, D12–D13, R1–R6, Q1a–Q1d, C1–C3, P1–P3, O2–O9, plus eight official use-cases. Catalog-only / unverified shares: D7, D11, R7, C4.
- awesome-grok-bot: **440 listed shares, 0 verified** at the review snapshot. Treat catalog names as *existence of a public share*, not proof of a successful run.
- Staff/product-side field cases with the highest engineering signal: **Lingxi Li (D10)** and **n2parko (D9)**. Highest non-eng computer-use signal: **HouseHackerJon (O6)** and **Debbie (P3)**.
- Cursor forum threads in salvage are mostly **quota / MCP / X-auth failure modes**, not success catalogs — they belong in Q4/Q5.
- leerob (SpaceXAI) posts fetched this pass are commentary (“Grok Bot is 100% cloud already”), not a personal roster. Source: https://x.com/leerob/status/2092730629540708858 accessed 2026-09-03.


---

## Q2. Practitioner and official best practices for unattended bots

Topics: prompt/operating-file structure; output contracts; idempotency and dedup; evidence/receipts; HITL gates; runaway-cost controls; secret handling; prompt-injection defenses; testing before scheduling; observability.

### xAI-documented practices

**Source class: `xAI-documented` unless noted. All accessed 2026-09-03.**

#### Operating-file / skill structure

xAI does **not** ship a git-tracked `bot.yaml` that the hosted Bot auto-loads. Config lives in the Cursor/Grok Bot cloud account (profile, skills, routines, plugins, Auto-review rules) plus durable files on the shared computer under `/workspace`. Source: https://docs.x.ai/grok-bot/bots ; https://docs.x.ai/grok-bot/computer-and-apps `[high]`.

Official skill recipe (save after a successful one-off, then automate):

1. When to use it
2. Required inputs and access
3. Sequence of work
4. How to validate the result
5. What to return
6. What requires approval

Example they give: “Weekly account health” with source systems, risk definitions, output format, and “customer contact always requires approval.” Source: https://docs.x.ai/grok-bot/skills-routines-and-automations `[high]`.

**Graduation path they prescribe:** one-time task → make it reliable → save as a skill → only then create a routine. Teach-a-task recordings are drafts (max 10 minutes, no mic audio); add decision rules, failure handling, and approval boundaries that one demo does not show. Same source + https://docs.x.ai/grok-bot/faq `[high]`.

Bot **description** = lasting responsibilities, preferences, safety boundaries; task-specific directions go in chat. Duplicate copies profile/skills/routines, **not** memory/history. Public share copies identity/description/skills/routines, **not** computer/logins/history. Source: https://docs.x.ai/grok-bot/bots `[high]`.

#### Output contracts

Routine-creation prompt they recommend includes: owning Bot, schedule + timezone, input source, expected result, approval boundary, and **what happens when a source is missing**. Example output: “Post a linked watch list in this conversation.” Source: https://docs.x.ai/grok-bot/skills-routines-and-automations `[high]`.

Documented delivery surfaces: conversation transcript (files/images/tool results as cards); `/workspace` files; drafts left for approval; Bot-to-Bot / group threads (2–6 Bots; Bot-to-group handoffs are **text-only**); per-Bot “finished / needs input” notifications. Sources: https://docs.x.ai/grok-bot/files-and-results ; https://cursor.com/docs/grok-bot/work ; https://docs.x.ai/grok-bot/settings-and-notifications `[high]`.

**Not documented as first-class Bot delivery:** posting to X, generic outbound webhooks, “deliver as GitHub PR” toggle. PRs go through GitHub plugin, `gh` on the VM, or Cloud Agent delegation.

#### Idempotency, stale data, retries

Official “Design routines for trust” list (verbatim intent):

- Automate **preparation before execution**.
- Draft, reconcile, or recommend first.
- Require approval for sending, purchasing, deleting, publishing, or changing production systems.
- Include a **no-data and stale-data policy**.
- **Make retries idempotent where possible.**
- Tell the Bot where to report **partial completion**.
- Re-test after a website, connector, or source format changes.

Source: https://docs.x.ai/grok-bot/skills-routines-and-automations `[high]`.

The weekday example explicitly: “If the source data is unavailable, report the failure instead of using old data.” Same page `[high]`.

#### Evidence / receipts

- Preserve **source links and an action log** for important decisions. Source: https://docs.x.ai/grok-bot/approvals-security-and-privacy `[high]`.
- Test-run review checklist: current inputs, required output format, **every action has a source or audit trail**, stopped at intended approval, failure states explicit. Source: https://docs.x.ai/grok-bot/skills-routines-and-automations `[high]`.
- Enterprise: Action Recording (off by default, 90-day internal retention, optional OTel export). Source: https://docs.x.ai/grok-bot/teams-and-enterprises `[high]`.

#### Propose-vs-act (HITL) gates

- Put the boundary **in the request**: “Do not change the campaign or message the agency. Ask for approval after showing current value, proposed value, and expected impact.” Source: https://docs.x.ai/grok-bot/approvals-security-and-privacy `[high]`.
- Explicit stop-list: sending messages/invitations; publishing; purchases/transfers; deleting/overwriting; changing permissions; production changes; accepting legal terms.
- Auto Review (Settings → General → Auto-review): independent review of shell, plugin calls, computer use, routine/trigger writes, Cloud Agent/subagent launches. **Require Approval beats Always Allow.** Does **not** review every side effect (memory writes, most settings). Same page + https://docs.x.ai/grok-bot/teams-and-enterprises `[high]`.
- “Stop now” ends the turn; it does **not** undo completed actions. An approval controls the proposed action only. `[high]`.
- Event routines: “Never post back to Slack without approval.” Narrow match rules; “every new message” is explicitly discouraged (noise + usage burn + acting on irrelevant input). Source: https://docs.x.ai/grok-bot/skills-routines-and-automations `[high]`.

#### Runaway-cost controls

- Event listeners: avoid broad “every new message.” `[high]`
- After a **long period away**, Grok Bot may ask whether to keep routines running and **pause them if unanswered**. Source: https://docs.x.ai/grok-bot/skills-routines-and-automations `[high]`.
- Included usage **resets weekly**; extra continues on **on-demand spend if enabled**. No separate Grok Bot spend cap documented. Source: https://cursor.com/help/grok-bot/plans `[high]`.
- Trial-efficiency guidance (also applies to scoping paid jobs): start small, scope tightly, check the plan screen before large jobs; usage is **agent steps and tokens**, not message count. Same page `[high]`.
- Hard caps: **50 Bots + group chats combined**; **50 routines per Bot**; **20 most recent run records** per routine. Sources: https://docs.x.ai/grok-bot/bots ; https://docs.x.ai/grok-bot/skills-routines-and-automations `[high]`.
- One Bot: **one computer-use task per screen at a time**. Source: https://docs.x.ai/grok-bot/computer-and-apps `[high]`.

#### Secret handling

- Do **not** paste passwords/OTPs into chat. Human takeover for password/passkey/2FA/CAPTCHA/payment. Source: https://docs.x.ai/grok-bot/approvals-security-and-privacy `[high]`.
- **Secure secret card:** masked, excluded from transcript, not shown to the model. Source: https://cursor.com/help/grok-bot/secrets `[high]`.
- Plugin OAuth tokens stay on **Cursor’s connector backend**; Bots invoke tools without receiving tokens. Source: https://cursor.com/help/grok-bot/connect-plugins `[high]`.
- Do not put secrets in Bot description, share links, Team Setup scripts, or world-readable `/workspace` files. Sources: https://docs.x.ai/grok-bot/approvals-security-and-privacy ; https://docs.x.ai/grok-bot/teams-and-enterprises `[high]`.
- **Bots are not a security boundary.** All of a user’s Bots share one Firecracker microVM (browser cookies, CLI creds, `/workspace`). Do not use separate Bots as isolation. Source: https://docs.x.ai/grok-bot/approvals-security-and-privacy ; https://cursor.com/docs/grok-bot/work `[high]`. Cursor forum title matches: “Grok Bot: ship real session fences — bots are not a security boundary” https://forum.cursor.com/t/grok-bot-ship-real-session-fences-bots-are-not-a-security-boundary/168476 `reported-by-users` `[medium]`.

#### Prompt-injection defenses (official)

Enterprise/security docs: outside content (web/plugin/command output) is marked untrusted; Auto Review + network policy + per-action approval **“reduce, but do not eliminate”** risk. Source: https://docs.x.ai/grok-bot/teams-and-enterprises ; https://docs.x.ai/grok-bot/approvals-security-and-privacy `[high]`.

No public 2026 Grok Bot injection-incident post was found in the sibling facts lane. Treat as acknowledged residual risk, not a solved control.

#### Testing a bot before scheduling

- **Test run** after creating or editing a routine. “A test run performs **real work**. It can navigate websites, change files, and call connected tools. Use safe inputs and keep write actions behind approval.” Source: https://docs.x.ai/grok-bot/skills-routines-and-automations `[high]`.
- Teach-a-task: “Test it on a safe example before scheduling it.” Same page `[high]`.
- Re-test after website/connector/source-format changes. `[high]`.

#### Observability

- Routine run history: last **20** per routine (success/failure). `[high]`
- Conversation shows tool activity, computer use, approvals.
- Composer error + **request ID**. Source: https://docs.x.ai/grok-bot/settings-and-notifications `[high]`.
- Spend: `cursor.com/dashboard/usage` by product; invoices combine Cursor+Bot. Source: https://cursor.com/help/grok-bot/plans `[high]`.
- **No consumer per-run cost line item** published.
- Cursor help: report routines that stay enabled but inactive **>24 hours**. Source: https://cursor.com/help/grok-bot/getting-started `[high]`.
- Troubleshooting checklist when a routine did not run: enabled, schedule/TZ, owning Bot exists, plugins authenticated, computer reachable, usage not paused. Source: https://docs.x.ai/grok-bot/troubleshooting `[high]`.

### Practitioner practices (Grok Bot specifically)

All `reported-by-users` unless noted. Accessed 2026-09-03.

#### Operating files and identity

- **A Bot owns a theme, not a task** (Nate, 2026-08-14). Source: https://natesnewsletter.substack.com/p/grok-bot-review `[medium]`.
- **One coordinator conversation, named specialist desks** (Dennis Yu, roster 2026-08-20). Silent multi-agent fan-out is rejected as wasteful. “A Grok Bot skill is how. A routine is when.” Source: https://dennisyu.com/how-i-use-grok-bot/ `[high]`.
- **Copy CasJam’s shape, not the brands.** One Chief + Head/Growth/Maintainer per *real* product. Keep routines **disabled** until a read-only task passes. Growth does not ship without Head visibility. Maintainer must not invent work. Do not import twelve random catalog rows. Source: https://github.com/majiayu000/awesome-grok-bot/blob/main/packs/casjam-product-heads.md `[medium]`.
- **One project per Grok Bot account** (The Futurist, 2026-08-22): mixing businesses in one account accumulated context, slowed work, burned tokens. Source: https://www.thefuturist.co/making-with-grok-bot/ `[medium]`.
- **Flocker role model:** durable role = name, title, avatar, recurring responsibility, conversation, memory, skills, routines. Duplicate copies profile/skills/routines, **not** history/memory. Shared VM vs per-Bot identity. Source: https://flocker.md/blog/grok-bot-roles-workspace-and-specs/ `[high]`.
- **Rick High second-brain repo** (2026-08-22): typed Markdown/YAML nodes in a repo *separate from* each agent’s home project; `brain/<actor-slug>/<session-id>` worktrees; “The model proposes”; scripts stamp metadata and enforce actor write permissions. Source: https://rickhigh.substack.com/p/grok-bot-claude-code-and-codex-share `[high]`.

#### Output contracts and receipts

- Dennis: every desk **leaves a receipt**; public-safe handoffs in Drive; durable receipts in GitHub `agent-notes` + `NOW.md`. Hub docs may ship by default; email/spend/delete/permissions/production stay gated. `[high]`
- The Futurist: recurring status of **“what shipped, what is stuck, and what needs you.”** Short reports cut token use. Review loops claimed to lift completeness ~50% → ~90% (n=1, `[medium]`).
- Rick: bounded retrieval pack (2 hops / 20 nodes), gitignored, rebuilt; promotion rules so only durable cross-agent facts enter the shared tree. `[high]`
- xAI official + forum: **always post a chat receipt**, because staff-confirmed silent successes exist. https://forum.cursor.com/t/grok-bot-routines-dont-auto-run-on-schedule/170358 `[medium]`

#### Idempotency / computer hygiene

- Dennis: **“Do not click Reset.”** Use **Update Grok Bot’s Computer** so files and logins persist. Stale computers should be updated, not reset. `[high]`
- Flocker: treat manually installed packages as replaceable; VM updates can rebuild. `[high]`
- Rick: never write durable knowledge on `main`; never skip the start-hook pull if uncommitted changes exist. `[high]`

#### HITL and kill switch

- Remy (2026-08-15): Gordon burned ~1 hour publishing to X with **no visible tool trace and no way to stop usage**. Specialist roles worked; observability/cancel did not. Source: https://aiwithremy.beehiiv.com/p/what-i-m-actually-using-grok-bot-for `[high]`
- Debbie: human takeover for Alcampo login; 1Password on desktop, never in chat; payment not completed by the bot. `[high]`
- Dennis Meter Maid: can warn/route, **cannot buy usage**. `[high]`

#### Cost / quota practices unique to Bot

- Scheduled routines can complete **silently and 10–37 min late** (staff Colin, 2026-09-02). Source: https://forum.cursor.com/t/grok-bot-routines-dont-auto-run-on-schedule/170358 `[medium]`
- Local/VPN MCP that works in Cursor IDE often fails in Bot (`needsAuth`, `fetch failed`) because discovery/OAuth runs from Cursor cloud. https://forum.cursor.com/t/does-grok-bot-support-local-mcp-e-g-workflowy/168182 `[medium]`
- Computer refresh wipes WhatsApp linked-device session. https://forum.cursor.com/t/computer-refresh-wipes-whatsapp-linked-device-session-in-grok-bot/169025 `[medium]`
- **No warning** before weekly usage spills into paid on-demand. https://forum.cursor.com/t/grok-bot-gives-no-warning-before-weekly-usage-spills-into-paid-on-demand/169679 `[medium]`
- awesome-grok-bot maintainer advice: start with one plugin and a read-only task; never paste API keys into setup; recommend a **zero-dollar on-demand cap** if you want a hard stop; hung custom MCP can break *all* connector discovery. Source: https://github.com/majiayu000/awesome-grok-bot `[medium]`
- The Futurist: per-project accounts to preserve tokens. `[medium]`
- Atmoio: specialized single-purpose bots beat one generalist; teach-by-demo beat long prompts in beta. https://atmoio.substack.com/p/i-went-in-ready-to-hate-grok-bot `[medium]`

#### Testing before scheduling

- CasJam pack: routines off until read-only task passes. `[medium]`
- xAI: Test run is **real work**. Matches Debbie’s Amazon purchase (real money) — test with safe inputs. `[high]`
- Dennis: canary-first fleet loop before remediation. `[high]`

#### Lingxi / n2parko / CasJam operating practices (staff + product, 2026-08/09)

- **Bot manages work; Cloud Agents do the coding.** Start a Cloud Agent with named skills + **proof expected**; Bot reads the transcript, reviews the PR proof, queues follow-ups. Source: https://x.com/lingxi/status/2094493172516966781 `[high]` accessed 2026-09-03.
- **Rules and progress live in files, not the same chat.** Inspect on a timer. Daily 1:1s beat mega-prompts. Same source `[high]`.
- **Proof loop is the missing piece**, not a longer prompt: screenshots, DevTools, CLI, Simulator on a private worker. Same `[high]`.
- **P0 5-minute transcript babysit burns tokens** — only for true urgency. Same `[high]`.
- **Auto-merge only if highly confident and blast radius is low** (Lingxi). Beep-effect should keep auto-merge **off**. Same `[high]`.
- **EM must not code** (n2parko Emily). Coordinator validates against the goal. Source: https://x.com/n2parko/status/2087251704744235298 `[high]`.
- **Grok Bot is mostly orchestrator**; heavy usage through Cursor/Amp/OpenAI (CasJam 2026-08-30). Source: https://x.com/CasJam/status/2093900327498010843 `[high]`.

### Practitioner practices (scheduled coding agents generally, portable)

Filled from Claude Code Routines, ChatGPT scheduled tasks, Copilot cloud agent, Devin, pstack benny, CodeRabbit, Sweep, Ellipsis, Dosu, Codex Action security, Microsoft Rule of Two — see Q3/Q5.

Portable patterns already visible in sibling prior-art lane (`g3-prior-art.md`) that should apply to Grok Bot:

- **PR-only delivery, never silent-merge to main** (Mintlify Automations default `automerge: false`). Source: https://www.mintlify.com/blog/automations `vendor-docs` `[high]`.
- **Build/CLI gate before the PR** (Mintlify CLI; Sweep feeding failed Actions logs back). Sources: https://www.mintlify.com/docs/agent ; Sweep historical https://github.com/sweepai/sweep/blob/main/docs/pages/blogs/giving-dev-tools.mdx `[high]`.
- **Split “draft user-facing changelog” from “report style violations without editing.”** Mintlify style-audit template. `[medium]`.
- **Graduate repeated LLM nits into ast-grep/Biome/Vale** (CodeRabbit’s documented path: NL path-instruction → custom check → ast-grep YAML). Source: https://docs.coderabbit.ai/tools/ast-grep `[high]`.
- **Two-sided execution gate for “docs lie” claims** (CASCADE: only report inconsistency if existing code fails a doc-derived test *and* a doc-derived implementation passes it). Source: https://arxiv.org/abs/2604.19400 `[high]`.
- **Narrow event matchers** — same advice as xAI’s “don’t listen to every Slack message,” echoed by Copilot/Codex automation docs (Q3).

---

## Q3. Comparable systems and what ports over

Systems to cover: Claude Code Routines / scheduled tasks / cloud routines; OpenAI Codex cloud tasks; ChatGPT scheduled tasks; Cursor automations (incl. pstack "benny"); GitHub Copilot coding agent; Devin; Dosu; Sweep; Ellipsis; CodeRabbit.

### Pattern transfer table

| System | What it is | Trigger | Delivery | What ports to Grok Bot | What does not |
| --- | --- | --- | --- | --- | --- |
| **pstack “benny” (Cursor automations)** | Slack-issue triage then reproduce-and-fix pack | New top-level Slack report; repro waits for triage marker | Thread replies; **draft PR only after two successful repros + before/after evidence**; no merge/deploy | Narrow match; fail closed; immutable thread coordinates; verify existing PR/commit before competing change; at most one bounded fix; secrets stay out of the copied pack | Cursor `/automate` YAML in-repo vs Grok Bot UI routines; Grok Bot not mentioned in FOR_AGENTS.md |
| **Claude Code Routines** | Research-preview unattended Claude Code jobs in the cloud | Schedule (min **1 hour**, stagger recommended); GitHub PR/release events with filters; API `/fire` | Autonomous run **with no approval during the run**; `claude/`-prefixed branches; connectors included by default **including writes** | **Docs-drift weekly** and **library-port on merge** are first-party examples; wrap fire payloads as untrusted (`<routine-fire-payload>`); remove unused write connectors; green status ≠ task success; daily run cap + subscription usage (one-off `/fire` does not count against daily cap) | Not a persistent shared VM; not native X; not Cursor-metered; local `/loop` and Desktop scheduled tasks are **different products** |
| **ChatGPT Scheduled tasks** (learn.chatgpt.com; *not* a Codex-cloud heartbeat) | Clock + event automations in ChatGPT | RRULE clock; GitHub / Gmail / Slack events. **Event-based cannot also have a time schedule** | Standalone vs attached-chat; worktrees; no guaranteed GitHub-PR toggle on the page fetched | “Use the narrowest access”; “Review the first few runs”; keep event vs clock separate (Grok Bot can mix, but xAI still warns against “every new message”) | Not a coding VM; not Cursor Cloud Agents; help.openai.com article 10291617 returned HTTP 403 this pass |
| **OpenAI Codex Action (CI)** | GitHub Action that runs Codex on the runner | Workflow events you wire | Diffs/PRs via the action’s job; Codex should be the **final** job step | Treat PR titles/bodies, commit messages, `AGENTS.md`, screenshots as **hostile**; restrict to repository writers; narrowest `permission-profile` (prefer `:workspace`); `drop-sudo` / unprivileged user; put untrusted GitHub values in `env:` not `run:` interpolation; never `allow-users: "*"`; do not load `codex-home` from an untrusted checkout | Runs on GH Actions minutes + API key, not SuperGrok Heavy; no shared Bot computer |
| **GitHub Copilot coding agent / cloud automations** | Hosted Copilot agent + scheduled/event automations | Hourly / daily / weekly; issue / PR / push | Agent PRs; **cannot commit to default branch**; **do not run CI automatically** on those PRs; creator cannot approve own automation PRs; workflows from those PRs need a write-user’s approval | Private/internal only; write access required; default ignore events from non-writers; strip hidden Unicode/HTML; inspectable context + firewall (GitHub agentic-security blog 2025-11-25); only write-permission users assign the agent; public repos limit issue-comment context to writers | Automations stored **outside git** (opposite of Ellipsis); no persistent VM; no native X; Actions minutes + AI credits are a second meter |
| **Devin scheduled sessions** | Cron sessions in Settings → Schedules | Cron; one-time then disable | Independent sessions; consecutive failures → **Error** state. **Automations now recommended** over scheduled sessions (2026 docs) | Smallest atomic slice; must include a validation (tests/CI/script); human review before `main`; automate high-volume isolated junior work (migrations, debt), not net-new features | No duplicate-work / secrets / injection section on the best-practices page fetched; product is a billed Devin session, not a Cursor Bot |
| **Ellipsis agents-as-code** | Version-controlled YAML under `agents/` / `.ellipsis/` | One trigger per file: UTC cron / EventBridge, or `react` on GitHub/Linear/Sentry/Slack | Fresh single-turn session per fire; default-branch YAML is authoritative; git push registers; invalid edits leave previous valid version | **Git-review the agent itself**; caller cannot raise the budget; narrow permissions (GitHub read-only possible); filter events; input schema; Sentry cap **one investigation per issue / 6 hours**; PR preview of branch YAML for write-authors | Grok Bot has **no** bot-as-code YAML API — steal the *discipline* (budget cap, one trigger, rollback) and encode it in skills + `/workspace` files |
| **CodeRabbit scheduled reports** | Cadenced PR-metadata reports, not a coding gardener | Selected weekdays every 1–3 weeks, or monthly dates + TZ | Email / Slack / Discord / Teams. PRs marked stale after **168 hours** | Steal as a *report* shape (standup / sprint / release notes) with filters that drop bot conversations; do not confuse with a docs-writing bot | No computer-use; no PRs from the report job; Essentials+; GitLab lacks team filtering |
| **Dosu** | Issue Q&A + docs reminders + “self-documenting PRs” | Continuous issue monitor | Issue/discussion comments (Slack/Discord on paid); docs write/remind | Citation-backed answers; remind when docs need changes; don’t treat vendor “4,000+ issues resolved” as measured quality | Not a persistent VM; hosted auto-label was withdrawn (negative lesson) |
| **Sweep (historical GitHub App)** | Issue titled `Sweep: …` → attempted PR | GitHub issue | PR, often broken; mitigation was **feed failed Actions logs back**. Product pivoted to JetBrains assistant by 2026 | CI-log repair loop; never merge; treat the issue title as a prompt not a grant of trust | Not a current unattended GitHub gardener — the pivot is itself evidence |
| **Mintlify Automations** (from g3) | Scheduled/event docs agent | Cron or product-repo push | Default PR; `automerge: false`; Mintlify CLI check | Docs-draft vs style-audit split; CLI gate; fire on merge or cron | MDX site is a second source of truth beep-effect does not want |

**pstack benny operating contract** (Cursor plugin, 2026; `vendor-docs`/`practitioner` `[high]`): two automations — (1) triage new Slack issues (classify, owning layer, duplicate search, route/create tracker work); (2) reproduce-and-fix **only after trusted triage**. Evidence: two successful reproductions, screenshots, video, read-only state check. Draft PR only after before/after evidence. Stop if clearly owned elsewhere. Fail closed if Slack coordinates / tracker / control adapter / feature map missing. Subagents may help but **must not get Slack credentials or posting authority**. `/automate` once; edit in place, don’t duplicate. Source: https://github.com/cursor/plugins/blob/main/pstack/automations/benny/FOR_AGENTS.md accessed 2026-09-03.

**Maps onto Grok Bot:** official Bug Reproduction use-case + Slack event integration is the same shape, but benny’s **evidence bar** (2× repro, video, don’t compete with an existing PR) is stricter than xAI’s example prompt and should be copied into the Bot skill.

### What is unique to Grok Bot

Documented differentiators vs the comparable set `[high]` `xAI-documented` unless noted:

| Unique-ish | What it is | Consequence for beep-effect |
| --- | --- | --- |
| **Native X connector + marketplace X plugin** | Search/read/bookmarks/mentions (no posting/DMs claimed). Paid Bot users get “free X API credits to start.” | Nightly research packets can pull X without a separate X-dev budget *if* enrollment/credits actually work. Forum reports 402/403. Source: https://x.ai/news/grok-bot-and-x |
| **One shared persistent cloud computer per user** | Firecracker microVM, `/workspace` durable, all Bots share cookies/creds. Isolation **per user, not per Bot**. | Multi-bot orgs (CasJam-style) share state — useful for handoffs, dangerous as a security boundary. |
| **Subscription-funded runs** | SuperGrok Heavy link = “highest linked usage” on the **Cursor** meter, weekly reset, then on-demand. Not grok.com, not xAI API. | Idle Heavy allowance is the reason to schedule more bots; overage is Cursor on-demand with **no separate Bot spend cap**. Source: https://cursor.com/help/grok-bot/plans |
| **Routines + skills in-product, not git** | No Bot-as-code YAML API. Share-link copies config. | Operating files should still live in `/workspace` or the repo so they survive UI drift; the schedule itself is in Cursor cloud. |
| **Cursor Cloud Agent delegation** | Bot can spawn a separate coding VM that opens PRs via GitHub App. | Best-documented “land in repo” path. Admins can disable spawning. |
| **Computer use / browser** | Sign into existing apps; Teach-a-task. | QA of desktop web apps, sites without MCP. CAPTCHA/2FA need a human. |
| **Model picker absent** | “Cursor manages model selection.” | Cannot pin Grok 4.6 vs a cheaper model per routine; usage analytics show what actually served. Source: https://docs.x.ai/grok-bot/settings-and-notifications |
| **Remote-only MCP** | Public HTTPS URL; local stdio MCP that works in Cursor IDE often fails in Bot. | DankStation local MCP (1Password, etc.) will not attach unless exposed as public HTTPS. |

Not unique (ports over): scheduled NL jobs, Slack/GitHub event triggers, draft-then-PR, Auto Review ≈ Copilot/Codex approval, weekly usage pools, 20-run history similar to other “last N runs” UIs.

**learncursor (2026-08-14) operating split** `[medium]` third-party, matches official isolation: Grok Bot = persistent named teammate on a **shared** computer; Cursor Cloud Agent = bounded coding task on an **isolated per-run** VM. Use both in series: Bot detects/gathers/decides; Cloud Agent lands the tested PR. A Bot approval to *start coding* is **not** a merge approval. Cloud Agents take an initial spend limit (API pricing of the selected model); Grok Bot has **no** Bot-specific spend cap. Source: https://www.learncursor.dev/compare/grok-bot-vs-cursor-cloud-agents accessed 2026-09-03.

---

## Q4. Quota economics (SuperGrok Heavy)

What the monthly allowance covers; how usage is measured; how people maximize an underused allowance without waste; published rate limits / fair-use rules that bite scheduled bots.

### What SuperGrok Heavy actually covers `[high]` `xAI-documented` / Cursor-documented

- Grok Bot is a **Cursor product**. Usage is metered on the **Cursor account**, not grok.com. Source: https://cursor.com/help/grok-bot/plans accessed 2026-09-03.
- Individual SuperGrok Heavy must be **linked** from the Grok Bot plan screen. Linking is a **usage grant**, **permanent** (cannot unlink/move), and does not change the Cursor plan. Source: https://cursor.com/help/grok-bot/supergrok ; https://cursor.com/help/grok-bot/plans `[high]`.
- Linked Heavy language: **“Highest linked usage.”** Same qualitative tier as Cursor Ultra’s “Highest weekly usage.” **No official numeric Bot weekly quota, token pool, or hours** is published. Check in-app Settings → Usage and billing / plan screen. `[high]` that the number is unpublished.
- “Grok Bot comes with its own usage, separate from your Grok and Cursor plans.” Source: https://x.ai/news/grok-bot-more-plans (2026-08-26) `[high]`. Dual Cursor+SuperGrok: FAQ vs plans-page wording differs; treat as **one Cursor-side Bot bucket, sized by the better grant** `[medium]`.
- Included usage **resets weekly**. Extra continues on **shared on-demand spend if on-demand is enabled**. **No separate Grok Bot spend cap.** Source: https://cursor.com/help/grok-bot/plans `[high]`.
- Usage unit (trial language, likely the paid meter too): **agent steps and tokens, not message count**. Larger/longer jobs use more. Same page `[high]`.
- SuperGrok Heavy **dollar price is not in official HTML** on 2026-09-03. SuperGrok $30/mo, Plus $100/mo are listed. Third-party **continuumcode** (Aug 2026) reports Heavy **$300/month**; their xAI HTML fetch 403 on 2026-08-22 — **unverified**. Source: https://x.ai/pricing `[high]` for listed $; https://continuumcode.ai/guides/supergrok-heavy/ `[low]` for $300. FAQ notes unexpected large invoices are often a **yearly SuperGrok Heavy** charge, not API. Source: https://docs.x.ai/grok/faq `[medium]`.
- SuperGrok Team / Enterprise **cannot link**. SuperGrok Lite not included. `[high]`.
- X connector: “Paid Grok Bot users get free X API credits to start.” Amount unpublished. Source: https://x.ai/news/grok-bot-and-x `[high]` that credits exist; `[low]` for how far they go. This is **X API credits**, not Grok Bot quota.

### Hard published limits that bite scheduled routines `[high]`

| Limit | Value | Source |
| --- | --- | --- |
| Bots + group chats combined | 50 per account | https://docs.x.ai/grok-bot/bots |
| Routines per Bot | 50 | https://docs.x.ai/grok-bot/skills-routines-and-automations |
| Run records retained per routine | **20 most recent** | same |
| Teach-a-task | 10 minutes | https://docs.x.ai/grok-bot/faq |
| Desktop attachments | 6; 25 MB docs/images/audio; 200 MB video | https://docs.x.ai/grok-bot/files-and-results |
| Group chat size | 2–6 Bots; text-only handoffs | https://cursor.com/docs/grok-bot/work |
| Computer-use concurrency | one task per Bot screen | https://docs.x.ai/grok-bot/computer-and-apps |
| Cron syntax / min interval / max run duration / routine concurrency cap | **unpublished** | docs silent |

### Queue / fairness (beta, unofficial but staff-confirmed) `[medium]` `reported-by-users`

Cursor forum “Grok Bot routines don’t auto-run on schedule” (2026-09-01/02): daily 11:00/15:00/21:00 KST looked missing. Staff **Colin** (2026-09-02): every slot **did** run, delayed **10–37 minutes** in a queue; some completed **without posting chat messages**. Timezone was correct. Editing Bot instructions does not touch the routine schedule. Catch-up: missed slot appears **queued and started late**, not skipped and not doubled — not a documented policy. Source: https://forum.cursor.com/t/grok-bot-routines-dont-auto-run-on-schedule/170358 accessed 2026-09-03.

Implication for nightly research: do not assume 00:00 America/Chicago fires at 00:00; budget a 30–40 min queue; require the Bot to **always post a chat receipt** even on no-op, because silent success is a documented failure mode.

### How people hit overage / maximize an underused Heavy grant

Forum threads (salvage; details to verify):

- “Anyone used GrokBot on the API — very high costs” https://forum.cursor.com/t/anyone-used-grokbot-on-the-api-very-high-costs/169551 `[medium]` — title conflates Bot with API; verify.
- “Grok Bot gives no warning before weekly usage spills into paid on-demand” https://forum.cursor.com/t/grok-bot-gives-no-warning-before-weekly-usage-spills-into-paid-on-demand/169679 `[medium]`.
- “Grok Bot spend / Cursor usage I can’t accept” https://forum.cursor.com/t/grok-bot-spend-cursor-usage-i-cant-accept-it/169796 `[medium]`.
- “Is Grok Bot usage separate from Cursor plan?” https://forum.cursor.com/t/is-grok-bot-usage-separate-from-cursor-plan/169658 `[medium]`.
- “Per-agent Grok Bot usage: who worked, tokens, cache, and cost vs the weekly pool” https://forum.cursor.com/t/per-agent-grok-bot-usage-who-worked-tokens-cache-and-cost-vs-the-weekly-pool/169926 `[medium]`.

**Maximizing an underused Heavy grant without waste (inferred from official + forum, not a vendor “do this” page)** `[medium]`:

1. Prefer **narrow, idempotent, draft-only** nightly jobs that always emit a receipt (chat + `/workspace` file). Empty-diff nights should be cheap no-ops, not full repo rewrites.
2. **Do not** attach broad Slack/GitHub “every notification” listeners — xAI explicitly says they burn usage.
3. Keep write actions behind approval so a runaway loop cannot open 40 PRs on your dime.
4. Watch `cursor.com/dashboard/usage` weekly; **on-demand has no Bot-specific cap** — disable on-demand if you want a hard stop.
5. 20-run history is tiny: persist receipts in `/workspace` or the repo, or you lose the audit trail.
6. 50-routines-per-bot: split personas (research vs QA vs docs) rather than one mega-bot with 40 crons — but remember they **share the VM**.
7. Computer-use/browser QA is the expensive shape (steps+tokens); GitHub-plugin + Cloud Agent handoff may be cheaper for code landing. Unverified numerically `[low]`.

### What Heavy does **not** buy

- Not xAI API credits. `x_search` on the Responses API is **$5 / 1,000 successful calls** plus tokens, separate product. Source: https://docs.x.ai/developers/pricing `[high]`.
- Not Grok CLI local usage (that’s grok.com subscription).
- Not a published “hours of Bot time.”
- Not X posting rights.
- Not local MCP.
- Not a model picker.

---

## Q5. Failure modes and cautionary tales

For each: duplicate PR floods; stale-branch fights; hallucinated doc edits; cost blowups; bots acting on injected instructions; silent stops. Mitigation people converged on.

### Silent / late scheduled runs (Grok Bot specific)

- **Symptom:** routine looks skipped; or succeeds with no chat message. **Mitigation staff described:** wait for queue (10–37 min); don’t assume chat output = ran; use Test run / Run now; keep a `/workspace` receipt the next job can see. Source: https://forum.cursor.com/t/grok-bot-routines-dont-auto-run-on-schedule/170358 `[medium]` accessed 2026-09-03.
- **Long-away pause:** unanswered “keep running?” prompt pauses routines. Source: https://docs.x.ai/grok-bot/skills-routines-and-automations `[high]`.

### Cost blowups / on-demand spill

- No warning before weekly pool spills to on-demand. Source: https://forum.cursor.com/t/grok-bot-gives-no-warning-before-weekly-usage-spills-into-paid-on-demand/169679 `[medium]`.
- **Mitigation (official):** check plan screen before large jobs; scope tightly; disable on-demand for a hard stop; avoid “every new message” listeners. `[high]` official + `[medium]` forum.

### Shared-computer / session wipe

- Computer refresh wipes WhatsApp linked-device session. Source: https://forum.cursor.com/t/computer-refresh-wipes-whatsapp-linked-device-session-in-grok-bot/169025 `[medium]`.
- **Official:** Bots are not a security boundary; Reset reverts to last synced snapshot; installed packages are **not** durable. Sources: https://docs.x.ai/grok-bot/computer-and-apps ; https://docs.x.ai/grok-bot/approvals-security-and-privacy `[high]`.

### Auth / plugin flakes (scheduled jobs that “just don’t run”)

- Custom remote MCP OAuth never starts in Bot; same URL works in IDE. Source: https://forum.cursor.com/t/grok-bot-custom-remote-mcp-oauth-never-starts-fetch-failed-same-url-works-in-cursor-ide/168188 `[medium]`.
- X plugin: no recent-search tool; 402 credits depleted; `needsAuth` / `user-not-enrolled` / `client-not-enrolled`. Sources: https://forum.cursor.com/t/grok-bot-x-connector-lacks-recent-search-direct-api-requires-separate-credits/168227 ; https://forum.cursor.com/t/official-x-plugin-auth-is-broken-on-cursor-cloud-grok-bot-and-desktop-refresh/169592 `[medium]`.
- **Mitigation:** treat plugin auth as a first-class health check in the routine (“if GitHub/X plugin needsAuth, report failure, do not proceed”); don’t put the only copy of a job behind a flaky connector.

### Duplicate PR floods / competing changes

- **pstack benny (Cursor):** verify existing PR/commit **before** a competing change; at most one bounded fix; fail closed. Source: https://github.com/cursor/plugins/blob/main/pstack/automations/benny/FOR_AGENTS.md `vendor-docs` `[high]` accessed 2026-09-03.
- **Lingxi (Grok Bot + Cloud Agents):** shared **Notion DB** is the work tracker; 30-min patrol follows up the *same* Cloud Agent rather than spawning a second PR for the same row; auto-merge only if high confidence + low blast radius. Source: https://x.com/lingxi/status/2094493172516966781 `[high]`.
- **Copilot cloud automations:** default **ignore events from non-writers**; creator **cannot approve own automation PRs**; workflows on those PRs do not auto-run. Reduces “bot-on-bot” CI loops. Source: https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-automations `vendor-docs` `[high]`.
- **Sweep (historical):** issue-to-PR bot produced broken PRs; repair loop was **feed failed Actions logs back**. Product **pivoted off GitHub** by 2026 — evidence that unattended issue→PR without a CI gate is not a durable product. Sources: https://github.com/sweepai/sweep/blob/main/docs/pages/blogs/giving-dev-tools.mdx (2023-07-26); https://github.com/sweepai/sweep `[high]`.
- **Ellipsis:** Sentry starts **at most one investigation per issue within six hours** — explicit duplicate-work cap. Source: https://www.ellipsis.dev/docs/agents-as-code `[high]`.
- **Claude Code Routines:** GitHub webhook events have **per-routine and per-account hourly caps; events beyond the limit are dropped**. Two PR updates produce **two independent sessions** (no reuse) — a flood risk if filters are wide. Source: https://code.claude.com/docs/en/routines `[high]`.
- **Mitigation people converged on:** one work-item row (issue/Notion/tracker) per change; search for an open PR on the same path before opening another; **draft** PRs; never auto-merge on beep-effect; keep write actions behind Auto Review; do not listen to “every new message.”

### Stale-branch fights / concurrent writers

- **Rick High:** reads on `main`; writes on `brain/<actor-slug>/<session-id>` worktrees; concurrent Bot+laptop writes become reviewable merges instead of clobbers. Worktrees are **concurrency control, not tenant security**. Source: https://rickhigh.substack.com/p/grok-bot-claude-code-and-codex-share (2026-08-22) `[high]`.
- **Claude Code Routines:** always push `claude/`-prefixed branches; reject push if the branch is protected, someone else has an open PR from it, or it has commits authored by someone else. Source: https://code.claude.com/docs/en/routines `[high]`.
- **ChatGPT desktop scheduled tasks:** prefer a **background worktree** over the current checkout so automation does not mutate files you are editing; archive obsolete worktrees. Source: https://learn.chatgpt.com/docs/automations?surface=app `[high]`.
- **Grok Bot unique risk:** all Bots share **one** `/workspace` and git checkout. Two routines that `git checkout` the same clone will fight. Mitigation: Cloud Agent per coding job (isolated VM) **or** Rick-style worktree-per-run; never two Bots writing `main` on the shared computer.
- **learncursor (2026-08-14):** Cloud Agent isolation is **per run**; Grok Bot computer is **per user**. A Bot approval to start coding does **not** approve merging. Source: https://www.learncursor.dev/compare/grok-bot-vs-cursor-cloud-agents `[medium]` (third-party explainer, matches official isolation docs).

### Hallucinated / noisy doc edits

- **CASCADE (2026):** only report a docs/code inconsistency when (1) current code fails a doc-derived test **and** (2) a doc-derived implementation passes that test. 13 unknown inconsistencies, 10 later fixed. Source: https://arxiv.org/abs/2604.19400 `[high]`.
- **Tan et al.:** >25% of 1,000 popular GitHub projects had at least one outdated code-element reference in docs; ships a PR-time Action. Sources: https://arxiv.org/abs/2212.01479 ; https://arxiv.org/abs/2307.04291 `[high]`.
- **fiberplane/drift:** bind Markdown to AST symbols (`drift.lock` + XxHash3 of normalized AST); `drift check` fails CI when docs are stale; reformatting does not false-positive. TypeScript supported. ~140 stars. Source: https://github.com/fiberplane/drift `[high]`.
- **Mintlify:** CLI/build gate before the PR; style-audit templates **describe violations instead of auto-editing**; `automerge: false`. Sources: https://www.mintlify.com/docs/agent ; https://www.mintlify.com/blog/automations `[high]`.
- **CodeRabbit:** docstring-coverage check false-positives on test callback closures ([gsd-build/get-shit-done#2932](https://github.com/gsd-build/get-shit-done/issues/2932)); Crossplane disables both coverage and auto-generation. Do **not** add a second JSDoc-coverage bot on beep-effect. Sources: g3-prior-art; https://docs.coderabbit.ai/configuration/path-instructions `[high]`.
- **Sweep:** undefined variables / syntax errors in generated PRs until CI logs were looped in. `[high]`.
- **Mitigation:** execute the docs (beep-effect already compiles JSDoc examples); symbol-existence lint; human PR; split “draft changelog” from “report style violations without editing”; graduate repeated nits into Biome/laws/knip.

### Cost blowups (other vendors + Grok Bot)

- **Lingxi P0:** 5-minute transcript steer “can burn tokens much faster than you think.” `[high]`.
- **Remy:** ~1 hour hung X publish, **no kill switch / no tool trace**. Source: https://aiwithremy.beehiiv.com/p/what-i-m-actually-using-grok-bot-for (2026-08-15) `[high]`.
- **Claude Code Routines:** daily **run cap** + subscription usage; overage only if usage credits on; one-off `/fire` does not count against the daily cap but **does** draw subscription. Wide GitHub filters multiply sessions. `[high]`.
- **Copilot automations:** Actions minutes **+** GitHub AI credits, billed to the **creator**. `[high]`.
- **Ellipsis:** session budget in YAML; caller can lower but **cannot raise**. `[high]`.
- **learncursor:** Cloud Agents need an initial spending limit and charge **API pricing of the selected model**; Grok Bot has **no Bot-specific spend cap**. `[medium]`.
- **continuumcode (third-party, Aug 2026):** SuperGrok Heavy **reported at $300/month**; xAI HTML 403 to their fetcher 2026-08-22 so **unverified**; Grok Bot overage uncapped; Heavy vs Cursor Ultra incremental ~$100/mo if you already have Ultra. Source: https://continuumcode.ai/guides/supergrok-heavy/ `[low]` for the $300 figure (matches rumor, not official HTML).
- **Mitigation:** disable on-demand for a hard stop; Meter Maid pattern (P2) that **cannot buy usage**; no 5-min P0 loops; no “every Slack message”; prefer Cloud Agent with a spend limit for coding; keep receipts so a silent 37-minute queued run is visible.

### Bots acting on injected instructions

- **xAI official:** outside content marked untrusted; Auto Review + network policy + per-action approval **“reduce, but do not eliminate.”** `[high]`.
- **Microsoft Rule of Two (2026-06-05):** an AI workflow must **never hold all three** of (1) untrusted content, (2) secrets/sensitive systems, (3) state-changing / external-comms tools. Treat issue/PR/comment/commit/file text as **untrusted user input, not instructions**. Hidden HTML comments fool humans, not models. Source: https://www.microsoft.com/en-us/security/blog/2026/06/05/securing-ci-cd-in-agentic-world-claude-code-github-action-case/ `[high]`.
- **Claude Code Routines:** API `/fire` `text` arrives in `<routine-fire-payload>` labeled untrusted; saved prompt must **opt in** to acting on it. Connectors (including **writes**) are included **by default** — remove unused. Autonomous: **no approval during the run**. `[high]`.
- **Codex Action security.md:** treat PR titles/bodies, commit messages, `AGENTS.md`, screenshots as hostile; restrict workflows to repository writers; never `allow-users: "*"`; don’t load `codex-home` from an untrusted checkout; untrusted GitHub values via `env:` not `run:` interpolation; Codex as **final** job step. Source: https://github.com/openai/codex-action/blob/main/docs/security.md `[high]`.
- **GitHub agentic security (2025-11-25):** inspectable context; strip hidden Unicode/HTML; firewall; cannot commit to default branch; **do not run CI automatically** on agent PRs; only write-permission users assign the agent; public repos limit issue-comment context to writers. Source: https://github.blog/ai-and-ml/github-copilot/how-githubs-agentic-security-principles-make-our-ai-agents-as-secure-as-possible/ `[high]`.
- **Copilot automations:** private/internal **only**; skip events from non-writers by default. `[high]`.
- **OpenAI “designing-agents-to-resist-prompt-injection”:** HTTP **403** this pass; do not invent its contents.
- **Mitigation for Grok Bot:** Require Approval (not Always Allow) on shell/plugin/computer-use/Cloud Agent spawn; do not paste secrets in chat (secure secret card); never give a research routine that reads the web **and** GitHub write **and** a secret in the same Bot without a HITL gate (Rule of Two); treat X posts, web pages, issue bodies, and `AGENTS.md` in cloned repos as data; keep the nightly research bot **draft-only**.

### Silent stops / false-green

- **Grok Bot:** staff-confirmed silent successes + 10–37 min queue (Q5 above). Long-away pause if unanswered. 20-run history is tiny. `[high]`/`[medium]`.
- **Claude Code Routines:** **green status means infra started and exited, not that the prompt succeeded.** Open the transcript. Blocked network (`403` `host_not_allowed`), missing connector tools, and task failures live there. `[high]`.
- **Devin:** consecutive scheduled-session failures → **Error**; product now prefers Automations over scheduled sessions. Source: https://docs.devin.ai/product-guides/scheduled-sessions `[high]`.
- **Ellipsis:** invalid YAML leaves the previous valid version running (silent “my edit did nothing”). `[high]`.
- **Cursor help:** report routines enabled but inactive **>24 hours**. `[high]`.
- **Mitigation:** always write a `/workspace` + chat receipt (even no-op); persist receipts in git because 20 records vanish; treat green/success as “process ran,” not “work is correct”; Test run on safe inputs before scheduling.

### Other Grok Bot cautionary tales (field)

- **Dennis:** GitHub App deploy-key policy blocked wordpress-site-builder; refused pirated WP-CLI so an Elementor CVE stayed unpatched; WP Engine portal still needed a human. `[high]`.
- **Debbie:** mobile web login/`about:blank`; security-forced password reset; she took over the browser. `[high]`.
- **Atmoio:** will not connect Google; routine-scheduling limitation wasted a first afternoon. `[medium]`.
- **Futurist:** mixing businesses in one account burned tokens. `[medium]`.
- **Forum:** custom MCP OAuth `fetch failed` in Bot (works in IDE); X 402 credits / `client-not-enrolled`; WhatsApp session wipe on computer refresh; Bugbot missing on Cloud Agents launched from Grok Bot (https://forum.cursor.com/t/review-bugbot-is-missing-on-cloud-agents-launched-from-grok-bot/170096) `[medium]`.
- **Peter Yang / Farzad:** typing passwords/OTP into the cloud browser “feels wrong”; Farzad’s proposed dump of Chrome password manager into Grok Bot **contradicts** official secret-card / human-takeover guidance — do not copy. Sources: https://x.com/petergyang/status/2095217706647851168 ; https://cursor.com/help/grok-bot/secrets `[high]` official rule, `[medium]` field debate.
- **awesome-grok-bot:** hung custom MCP can break **all** connector discovery; **440 shares, 0 verified** — do not treat share names as proven runs. `[medium]`/`[high]`.
- **Heavy ≠ Cloud Agents:** SuperGrok Heavy does not include Cursor Cloud Agents; DIY Tailscale→private worker is a documented workaround (D12) `[medium]`.
- **Meter Maid cannot buy usage** — keep it that way (Dennis P2) `[high]`.
- **Do not click Reset** for routine maintenance (Dennis: use Update Computer) `[high]`.
- **Gota (O7):** after Cloud Agents existed, started migrating heavy work off the Bot `[medium]`.
- **Ray Fernando Clippy CTO (D11)** catalog-only `[low]`.
- **leerob** commentary only (“Grok Bot is 100% cloud already”), not a roster `[medium]`.
- **continuumcode $300 Heavy** unverified (Q4) `[low]`.
- **OpenAI injection blog / ChatGPT help 10291617** HTTP 403 this pass — omitted `[high]` that they were unreachable, not that they are empty.

---

## Idea shortlist for Benjamin

10–15 concrete bot ideas ranked by value for a solo maintainer of a large Effect-TS monorepo (PR-only main, ratcheted quality baselines, goal/exploration packets, in-repo agent skills, nightly research packets). Existing bots: nightly research → intel packet → Cursor cloud PR; QA bot for a desktop web app. Candidate ideas already on the table: (a) documentation enhancement, (b) knowledge/doc staleness detection, (c) style & law enhancer.

Each idea: trigger, inputs, output surface, why a bot rather than CI, strongest source that shows it working somewhere.

Rank is **value for a solo maintainer with unused SuperGrok Heavy**, not novelty. Existing nightly research + QA bots are **upgrades**, not replacements. All write paths: **draft PR only, never merge, never default-branch**. Disable Cursor on-demand if you want a hard stop (Q4). Rule of Two: a Bot that reads the web/X must not also hold GitHub write + a secret without HITL.

### 1. Cloud-Agent orchestrator (proof loop, not a coder) — **highest unused-grant leverage**

- **Trigger:** on-demand in chat + a 30-minute routine that patrols open Cloud Agent / Greptile / CI rows.
- **Inputs:** goal packet or issue; in-repo skills; CI logs; Greptile comments; screenshots/DevTools/CLI proof contract.
- **Output:** a work-tracker row (Notion or a git `NOW.md`); spawn **Cursor Cloud Agent** (or Codex) with the packet; follow the *same* agent rather than opening a second PR; draft PR only after proof. Auto-merge **off**.
- **Why a bot, not CI:** judgment, transcript babysit, multi-tool (X/web/Slack), and “is this still the same work-item?” CI already fails the build; it cannot steer a stuck agent.
- **Strongest source:** Lingxi Li (SpaceXAI, building Grok Bot) — Bot manages work, Cloud Agents code, >200 simultaneous agents vs ~15 before, 30-min Notion PR patrol, P0 5-min loops burn tokens. https://x.com/lingxi/status/2094493172516966781 (3,494 likes / 942k views) `[high]`. learncursor: use both in series; Bot approval ≠ merge. https://www.learncursor.dev/compare/grok-bot-vs-cursor-cloud-agents `[medium]`. CasJam: “Grok Bot is mostly just orchestrator.” `[high]`.
- **Beep-effect constraint:** Heavy **does not include Cloud Agents** (James Martinez D12). Budget Cursor Cloud Agent / Codex separately, or DIY a private worker (Lingxi + D12). Admins can disable Bot-spawned Cloud Agents.

### 2. Nightly 3am audit engineer (ratchets, dead code, last-24h PRs)

- **Trigger:** nightly (budget 30–40 min queue; always write a receipt even on no-op).
- **Inputs:** last 24h merged PRs; knip / typecheck / existing ratchets; Effect v4 API misuse patterns that lints miss; `skills/` and `AGENTS.md`.
- **Output:** `/workspace` receipt + **draft** PR or a “nothing to do” packet. Empty-diff nights must be cheap no-ops, not repo rewrites.
- **Why a bot, not CI:** CI already runs the ratchets. The Bot’s job is **judgment over deltas** (“this merged PR taught a withdrawn pattern”; “this Effect helper is a v3 Map”).
- **Strongest source:** Lingxi nightly 3am audits as PRs `[high]`; catalog share “Nightly Audit Engineer” is **unverified** (D7) `[low]` — copy Lingxi’s *shape*, not the share.

### 3. Docs-drift weekly (candidate **b**, hybrid with CI)

- **Trigger:** weekly clock **or** on merge to `main` (not “every PR comment”).
- **Inputs:** Markdown / JSDoc bound to AST symbols; docgen output; last week’s API-export diffs.
- **Output:** (CI) fail on `drift.lock` / missing symbols; (Bot) **draft** prose-fix PR or a “docs lie” issue with CASCADE-style evidence. Never auto-merge. Do **not** add a JSDoc-coverage bot (CodeRabbit false positives).
- **Why a bot, not CI:** symbol-existence and lockfile drift **are** CI. Deciding which paragraph is lying, and drafting a worked example that still compiles through existing docgen, is LLM work.
- **Strongest source:** Claude Code Routines first-party **Docs drift weekly** example https://code.claude.com/docs/en/routines `[high]`; CASCADE two-sided execution gate https://arxiv.org/abs/2604.19400 `[high]`; fiberplane/drift AST lockfile https://github.com/fiberplane/drift `[high]`; Tan outdated refs https://arxiv.org/abs/2212.01479 `[high]`; Mintlify CLI gate + `automerge: false` `[high]`.

### 4. Skill / AGENTS.md / packet catch-up vs merged PRs (knowledge staleness)

- **Trigger:** daily, last 24h merges only.
- **Inputs:** merged PR diffs; in-repo skills; `explorations/` + `goals/` packets; Effect coding standards.
- **Output:** draft PR that **updates the skill or packet**, or a report “this skill teaches a withdrawn pattern.” Never auto-promote exploration → goal.
- **Why a bot, not CI:** semantic contradiction, not missing symbols.
- **Strongest source:** Lingxi “catch-up vs merged PRs” `[high]`; Dennis Training+Docs receipt-to-skill (D3) https://dennisyu.com/how-i-use-grok-bot/ `[high]`.

### 5. Style & law enhancer → receipt-to-skill (candidate **c**)

- **Trigger:** weekly, or when Greptile / human review comments cluster on the same law.
- **Inputs:** review comments; existing Biome / ast-grep / Effect laws; beep-effect coding standards.
- **Output:** a **PR that adds a law, Biome rule, or skill file** — never only a comment. If it cannot be encoded, file a packet, don’t nag.
- **Why a bot, not CI:** the destination is CI (ratchet). The Bot’s job is **graduation**: NL nits → structure. CodeRabbit-as-gardener is the anti-pattern (comment noise, docstring false positives).
- **Strongest source:** Dennis D3 Learn-Do-Teach `[high]`; g3 CodeRabbit/Crossplane lesson (disable coverage + auto-generation) `[high]`.

### 6. Documentation enhancement with a compile gate (candidate **a**)

- **Trigger:** weekly, or after API-export / public-surface changes.
- **Inputs:** public APIs with thin or missing JSDoc; existing docgen; worked-example contract.
- **Output:** draft JSDoc/README PR that **must compile through existing docgen**. Style-audit lane describes violations and does **not** auto-edit.
- **Why a bot, not CI:** which API needs a worked example is judgment; whether the example typechecks is CI.
- **Strongest source:** Mintlify agent (CLI before PR, style-audit vs draft split) `[high]`; Atmoio Blog Manager actually shipped a live blog change (D1) `[high]` — proof a Bot *can* edit docs/code, not a reason to skip the gate.

### 7. Upgrade the existing QA bot to benny’s evidence bar

- **Trigger:** GitHub issue / Slack bug report (narrow filter, not every message).
- **Inputs:** report text (untrusted); desktop web app; control-adapter / feature map if you have one.
- **Output:** repro pack: **two successful reproductions**, screenshots (video if cheap), read-only state check; **draft PR only after before/after**; fail closed if the evidence bar isn’t met; stop if already owned. Verify an existing PR before competing.
- **Why a bot, not CI:** computer-use on a desktop web app without a stable MCP is the Bot-shaped job (HouseHackerJon O6, official Bug Reproduction).
- **Strongest source:** official Bug Reproduction + Slack needs-repro https://docs.x.ai/grok-bot/use-cases `[high]`; pstack benny https://github.com/cursor/plugins/blob/main/pstack/automations/benny/FOR_AGENTS.md `[high]`; HouseHackerJon portal computer-use (2,406 likes / 700k views) `[high]`.

### 8. Meter Maid / usage Brake (protect the Heavy pool)

- **Trigger:** daily, and whenever in-app usage crosses a threshold you pick.
- **Inputs:** `cursor.com/dashboard/usage`; plan screen; list of enabled routines.
- **Output:** chat + `/workspace` receipt: who spent, cache vs tokens if visible, which routine. **Cannot enable on-demand, cannot buy usage.**
- **Why a bot, not CI:** there is **no official warning** before weekly usage spills to on-demand, and **no Bot spend cap**.
- **Strongest source:** Dennis Meter Maid (P2) `[high]`; forum 169679 `[medium]`; Q4 official plans page `[high]`. Catalog “Usage Auditor / Brake” is unverified `[low]`.

### 9. Keep the nightly intel packet — add native X, keep it draft-only

- **Trigger:** nightly (queue-aware).
- **Inputs:** web + GitHub + arXiv + **native X connector** (and/or marketplace plugin). Treat posts as data.
- **Output:** intel packet in git via Cloud Agent PR (existing path). If X plugin `needsAuth` / 402, **fail the job in chat**, do not silently skip X and pretend the packet is complete.
- **Why a bot, not CI:** native X is the Grok Bot unique (Q3). CI cannot browse X well; xAI API `x_search` is a **separate $5/1k product**.
- **Strongest source:** official X connector https://x.ai/news/grok-bot-and-x `[high]`; Farzad changelog ping (O9) `[medium]`; Debbie news patrol (R5) `[high]`; forum X 402 / `client-not-enrolled` `[medium]`.

### 10. Second-brain worktree discipline for packets (Rick)

- **Trigger:** session-start of any Bot that writes packets/skills.
- **Inputs:** `explorations/`, `goals/`, skills; actor identity.
- **Output:** reads on `main`; writes on `brain/<actor-slug>/<run-id>` (or `packet/<bot>/<run-id>`); PR; merge after checks. Bounded pack (Rick: 2 hops / 20 nodes). **“The model proposes.”**
- **Why a bot, not CI:** concurrent Claude Code + Grok Bot + Codex writers clobber `main`. Worktrees are concurrency control, **not** tenant security (shared VM remains).
- **Strongest source:** Rick High https://rickhigh.substack.com/p/grok-bot-claude-code-and-codex-share (2026-08-22) `[high]`. Claude Routines `claude/`-prefixed branches + reject protected/foreign `[high]`.

### 11. One Ops coordinator + named desks (not 13 product clones)

- **Trigger:** none until each desk’s **read-only** task passes (CasJam pack). Then: Research (idea 9), QA (7), Docs (3+6), Audit (2), Meter (8), Catch-up (4).
- **Inputs:** shared `/workspace` operating files (`NOW.md`, receipts). Handoffs text-only in group chat (2–6 Bots).
- **Output:** coordinator routes; desks do not invent work; Growth/Maintainer analogue must not ship without visibility.
- **Why a bot, not CI:** org chart + durable files beat 40 crons on one mega-bot (50-routine cap; shared VM).
- **Strongest source:** Dennis one-coordinator + named desks `[high]`; CasJam 13-bot pack + “routines off until read-only passes” `[high]`; n2parko CoS + EM **must not code** + 5 ICs `[high]`; Tyler two-door is organizational only (O5) `[medium]`.

### 12. Goal / exploration packet gardener

- **Trigger:** weekly.
- **Inputs:** `explorations/`, `goals/`, merged code, skills.
- **Output:** report of packets that contradict merged code or each other; proposed archive/rewrite **as a draft PR**. Never auto-promote.
- **Why a bot, not CI:** CI can lint frontmatter; contradiction is semantic.
- **Strongest source:** Rick typed nodes + over-promotion warning `[high]`; Lingxi rules/progress in files not chat `[high]`.

### 13. 30-minute CI / Greptile babysit (narrow GitHub notifications)

- **Trigger:** failing CI or Greptile on **open PRs you already own** (filter hard; xAI: do not listen to every notification).
- **Inputs:** Actions logs, Greptile comments, the existing PR.
- **Output:** a comment or a follow-up steer of the **same** Cloud Agent. Search for an existing PR before opening another (benny).
- **Why a bot, not CI:** CI already failed. The Bot’s job is transcript steer — and Lingxi warns P0 5-min loops **burn tokens**.
- **Strongest source:** Lingxi 30-min patrol `[high]`; benny verify-existing-PR `[high]`; Copilot “do not auto-run CI on agent PRs” `[high]`.

### 14. Overnight “six hours, build whatever” sandbox — **low priority, high waste**

- **Trigger:** overnight, only while the Heavy pool is idle **and** on-demand is **off**.
- **Inputs:** a single goal packet marked sandbox.
- **Output:** draft branch only; spend-capped by the weekly grant; delete if unreviewed in 48h.
- **Why a bot, not CI:** this is idle-grant burn, not quality. Lingxi’s favorite shape; also the cost-blowup shape (Remy hung publish; no Bot cap).
- **Strongest source:** Lingxi `[high]`; Remy kill-switch gap `[high]`; Q4 no Bot spend cap `[high]`.

### 15. Private-worker Tailscale only if Cloud Agent cannot hit the desktop app

- **Trigger:** none until idea 7 proves Cloud Agent / Bot computer-use cannot reach the QA target.
- **Inputs:** Tailscale on the Bot VM → a machine that already has the app (James: Mac mini + Grok Build).
- **Output:** same as idea 7, executed on the private worker. HITL for 1Password; never dump a password manager into the Bot (Peter Yang O9 — Farzad’s “fix” is the anti-pattern).
- **Why a bot, not CI:** last-resort computer-use. Heavy does not include Cloud Agents.
- **Strongest source:** James Martinez D12 `[medium]` (1 like / 65 views, but it is a concrete recipe); Lingxi private worker `[high]`; official secret-card / human-takeover `[high]`.

**Do not build (from this research):** a second JSDoc-coverage bot; Always-Allow shell+plugin+computer-use; Life/Work bots treated as security isolation; mixing beep-effect with personal inboxes in one account (Futurist token burn; Tyler is org-only); Bot-as-sole-coder on the shared VM (Lingxi/CasJam/learncursor all say orchestrate); X-posting/DMs (not a documented Bot capability); enabling on-demand “just in case.”

---

## Sources

All accessed 2026-09-03 unless noted. Dates on news/blog posts are publication dates.

### Official / vendor (Grok Bot + Cursor)

- https://x.ai/bot
- https://x.ai/news/introducing-grok-bot (2026-08-11)
- https://x.ai/news/grok-bot-more-plans (2026-08-26)
- https://x.ai/news/grok-bot-and-x (2026-08-29)
- https://x.ai/pricing
- https://docs.x.ai/grok-bot/overview
- https://docs.x.ai/grok-bot/use-cases
- https://docs.x.ai/grok-bot/skills-routines-and-automations
- https://docs.x.ai/grok-bot/approvals-security-and-privacy
- https://docs.x.ai/grok-bot/bots
- https://docs.x.ai/grok-bot/computer-and-apps
- https://docs.x.ai/grok-bot/faq
- https://docs.x.ai/grok-bot/files-and-results
- https://docs.x.ai/grok-bot/settings-and-notifications
- https://docs.x.ai/grok-bot/teams-and-enterprises
- https://docs.x.ai/grok-bot/troubleshooting (updated 2026-09-02)
- https://docs.x.ai/grok/faq
- https://docs.x.ai/developers/pricing (`x_search` $5/1k — not Bot)
- https://cursor.com/help/grok-bot/plans
- https://cursor.com/help/grok-bot/supergrok
- https://cursor.com/help/grok-bot/secrets
- https://cursor.com/help/grok-bot/connect-plugins
- https://cursor.com/docs/grok-bot/work
- https://cursor.com/dashboard/usage

### Comparable systems (vendor docs)

- https://code.claude.com/docs/en/routines (Claude Code Routines)
- https://learn.chatgpt.com/docs/automations?surface=app (ChatGPT scheduled tasks; *not* Codex cloud)
- https://github.com/openai/codex-action/blob/main/docs/security.md
- https://docs.github.com/en/copilot/concepts/agents/cloud-agent/about-automations
- https://github.blog/ai-and-ml/github-copilot/how-githubs-agentic-security-principles-make-our-ai-agents-as-secure-as-possible/ (2025-11-25)
- https://docs.devin.ai/use-cases/best-practices
- https://docs.devin.ai/product-guides/scheduled-sessions
- https://www.ellipsis.dev/docs/agents-as-code
- https://docs.coderabbit.ai/guides/scheduled-reports
- https://docs.coderabbit.ai/configuration/path-instructions
- https://www.mintlify.com/docs/agent
- https://www.mintlify.com/blog/automations
- https://github.com/cursor/plugins/blob/main/pstack/automations/benny/FOR_AGENTS.md
- https://github.com/sweepai/sweep
- https://github.com/sweepai/sweep/blob/main/docs/pages/blogs/giving-dev-tools.mdx (2023-07-26)
- https://www.microsoft.com/en-us/security/blog/2026/06/05/securing-ci-cd-in-agentic-world-claude-code-github-action-case/ (Rule of Two)
- https://arxiv.org/abs/2604.19400 (CASCADE)
- https://arxiv.org/abs/2212.01479 ; https://arxiv.org/abs/2307.04291 (Tan outdated docs)
- https://github.com/fiberplane/drift
- HTTP 403 this pass (do not invent contents): https://openai.com/index/designing-agents-to-resist-prompt-injection ; https://help.openai.com/en/articles/10291617 ; developers.openai.com/codex/app/automations 308 → learn.chatgpt.com

### X posts (author + engagement at fetch)

- Lingxi Li (SpaceXAI) https://x.com/lingxi/status/2094493172516966781 — 3,494 likes / 362 reposts / 7,868 bookmarks / 942k views (D10)
- n2parko thread https://x.com/n2parko/status/2087251704744235298 — 424 likes / 570 bookmarks / 64.7k views (D9)
- n2parko article https://x.com/i/article/2088646125351997440 — 318 likes / 493 bookmarks / 1.09M views (D9)
- CasJam v2 org https://x.com/CasJam/status/2093762642867581359 — 200 likes / 354 bookmarks / 32.7k views (D4)
- CasJam v1 https://x.com/CasJam/status/2090852790809620631 — 121 likes / 45k views (D4)
- CasJam “mostly just orchestrator” https://x.com/CasJam/status/2093900327498010843 (D4)
- HouseHackerJon plumbing OM https://x.com/HouseHackerJon/status/2087635639701573962 — 2,406 likes / 141 reposts / 3,227 bookmarks / 700k views (O6)
- Farzad X changelog ping https://x.com/farzyness/status/2095187604924723328 — 2,866 likes / 2.68M views (O9)
- Peter Yang password-in-cloud-browser https://x.com/petergyang/status/2095217706647851168 — 304 likes / 82k views (O9)
- Gergely Orosz spam scan https://x.com/GergelyOrosz/status/2091476557399237015 — 255 likes / 96 bookmarks / 40.5k views (O8)
- Gergely Orosz multi-account Gmail/Slack https://x.com/GergelyOrosz/status/2090353329771631080 — 276 likes / 147 bookmarks / 61.5k views (O8)
- Gota twelve-job mesh https://x.com/gota_bara/status/2087666940450152841 — 51 likes / 39 bookmarks / 6.6k views (O7)
- Tyler Nishida two-door https://x.com/TylerNishida/status/2093426221732532457 — 5 likes / 601 views (O5)
- James Martinez Tailscale→Mac mini https://x.com/realjamesmtz/status/2095347033393475885 — 1 like / 65 views (D12)
- leerob “Grok Bot is 100% cloud already” https://x.com/leerob/status/2092730629540708858 (commentary, not a roster)

### Practitioner blogs / GitHub / explainers

- https://atmoio.substack.com/p/i-went-in-ready-to-hate-grok-bot (2026-08-25) D1 / R4 / Q1b
- https://dennisyu.com/how-i-use-grok-bot/ (receipts 2026-08-16–09-02) D2 / D3 / P2 / O-ops
- https://rickhigh.substack.com/p/grok-bot-claude-code-and-codex-share (2026-08-22) D8
- https://www.thefuturist.co/making-with-grok-bot/ (2026-08-22) D13
- https://debbie.codes/blog/i-sent-grok-bot-to-buy-my-gluten-free-beer (2026-08-16) R5 / P3
- https://natesnewsletter.substack.com/p/grok-bot-review (2026-08-14) R6 / C3
- https://aiwithremy.beehiiv.com/p/what-i-m-actually-using-grok-bot-for (2026-08-15) C1
- https://flocker.md/blog/grok-bot-roles-workspace-and-specs/ (2026-08-25) D6
- https://www.learncursor.dev/compare/grok-bot-vs-cursor-cloud-agents (2026-08-14)
- https://continuumcode.ai/guides/supergrok-heavy/ ($300 Heavy — unverified)
- https://github.com/majiayu000/awesome-grok-bot (440 shares, 0 verified)
- https://github.com/majiayu000/awesome-grok-bot/blob/main/packs/casjam-product-heads.md
- https://github.com/Anil-matcha/awesome-grok-bot
- https://github.com/rdmgator12/awesome-grok-bot-plugins
- Sibling lane notes (not public sources): `g1-grok-bot-facts.md`, `g3-prior-art.md`, `g2-salvage.md`

### Cursor forum (quota / flakes / silent runs)

- https://forum.cursor.com/t/grok-bot-routines-dont-auto-run-on-schedule/170358 (staff Colin 10–37 min queue; silent success)
- https://forum.cursor.com/t/grok-bot-gives-no-warning-before-weekly-usage-spills-into-paid-on-demand/169679
- https://forum.cursor.com/t/anyone-used-grokbot-on-the-api-very-high-costs/169551
- https://forum.cursor.com/t/grok-bot-spend-cursor-usage-i-cant-accept-it/169796
- https://forum.cursor.com/t/is-grok-bot-usage-separate-from-cursor-plan/169658
- https://forum.cursor.com/t/per-agent-grok-bot-usage-who-worked-tokens-cache-and-cost-vs-the-weekly-pool/169926
- https://forum.cursor.com/t/computer-refresh-wipes-whatsapp-linked-device-session-in-grok-bot/169025
- https://forum.cursor.com/t/grok-bot-ship-real-session-fences-bots-are-not-a-security-boundary/168476
- https://forum.cursor.com/t/grok-bot-x-connector-lacks-recent-search-direct-api-requires-separate-credits/168227
- https://forum.cursor.com/t/official-x-plugin-auth-is-broken-on-cursor-cloud-grok-bot-and-desktop-refresh/169592
- https://forum.cursor.com/t/grok-bot-custom-remote-mcp-oauth-never-starts-fetch-failed-same-url-works-in-cursor-ide/168188
- https://forum.cursor.com/t/review-bugbot-is-missing-on-cloud-agents-launched-from-grok-bot/170096

---

## Research log

- 2026-09-03: created skeleton (Q1–Q5 + shortlist + sources).
- 2026-09-03: reused salvage URL list; read sibling `g1-grok-bot-facts.md` and `g3-prior-art.md`; filled Q2 official practices, Q3 uniqueness, Q4 quota economics, and Grok-Bot-specific Q5 from cached first-party docs (no re-fetch of those URLs).
- 2026-09-03: filled Q1 catalog from practitioner blogs (Atmoio, Dennis, Remy, Debbie, Nate, Flocker, Futurist, Rick High) + official use-cases; awesome-grok-bot 440/0 verified.
- 2026-09-03: fetched vendor comparables (Claude Routines, ChatGPT automations, Copilot automations, Ellipsis agents-as-code, CodeRabbit scheduled reports, Codex Action security.md, Devin best-practices, Microsoft Rule of Two, GitHub agentic security, learncursor, continuumcode, fiberplane/drift). OpenAI injection blog + ChatGPT help 10291617 HTTP 403.
- 2026-09-03: X engagement on Lingxi, n2parko, CasJam, HouseHackerJon, Farzad, Peter Yang, Gergely Orosz, Gota, Tyler, James Martinez, leerob. Filled remaining Q1 O5–O9, Q2 practitioner (Lingxi/n2parko/CasJam), Q3 transfer table, Q5 other-vendor mitigations.
- 2026-09-03: ranked 15-idea shortlist; completed Sources; marked lane complete. Stopped new research. Did not run git.
