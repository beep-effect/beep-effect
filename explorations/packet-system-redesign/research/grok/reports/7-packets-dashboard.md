# Packets dashboard: prior art, realtime file projection, React UI, and second-source-of-truth failures

**Lane:** packets dashboard (research)  
**Date:** 2026-08-10  
**Scope:** Repo-local docs-as-code portfolio dashboards; Vite/React file-watch realtime; DAG/kanban/markdown libs (2025–2026); read-only projection discipline; honest build-vs-buy for internal dashboards.  
**Method:** web + GitHub + X (native). Prefer primary sources; disconfirming and failure evidence included. No fabricated quotes or URLs.  
**Local constraint (binding):** KSA D (2026-07-31) + packet redesign — one deterministic projection feeds JSON + Mermaid + dashboard; ratified **v1 = self-contained static HTML** (kanban + DAG, no server, no React build). Any richer React v2 must stay a **read-only projection consumer**; writes only via CLI single-writer.

---

## 1. TLDR

- **Closest prior art is the 2025–2026 markdown-native agent board family** (Backlog.md, kanban-md, taskmd, markplane, single-file HTML kanbans) — not Backstage or Linear. They win when files *are* the ledger and the UI is a view; they rot when the UI becomes a second writer.
- **Backlog.md is the structural twin and the cautionary twin:** Bun+TS, Git-native markdown tasks, TUI board, React `backlog browser` with realtime + drag-and-drop *and* forms that edit tasks. Its own docs say prefer CLI/MCP/Web over hand-editing files — then ship a Web that writes. Beep must copy the file model and **reject** the dual-writer Web.
- **The catalog maintenance trap is the failure mode that matters.** Manually maintained `catalog-info.yaml` / status UIs go stale; teams stop trusting them; option three is quiet rot. Escape = auto-discover / project from artifacts people already edit to ship — not a second registry. ([riftmap.dev](https://riftmap.dev/blog/the-catalog-maintenance-trap/))
- **One projection, many renderers** is already the correct architecture (matches ratified plan). Divergent Mermaid vs React vs JSON is how dashboards invent “truth.” Layout libraries (xyflow+dagre/elk) only *display* precomputed nodes/edges/parallel sets.
- **Realtime for a single operator is a solved, boring problem.** Prefer: projector rebuilds on scoped chokidar → write projection blob → push invalidate over Vite HMR custom events / SSE / short poll. Do **not** watch the whole monorepo. Sub-second is vanity; 1–5s + visible `sourceTip` age is trustworthy.
- **Read-only kanban does not need dnd-kit.** Drag-and-drop libraries exist to *mutate* column order. Rendering columns from a status projection is CSS/grid + click-to-detail. Adding DnD invites “move card = write status” which reopens dual-writer.
- **@xyflow/react + dagre is the pragmatic 2025–2026 DAG stack** for portfolio graphs (~40KB layout). elkjs wins only if you need heavy edge routing / nested subflows and accept ~1.4MB + async complexity. Stately’s cookbook: domain graph is SoT; React Flow node array is *not*.
- **Build-vs-buy consensus for *generic* internal KPI dashboards: buy or don’t.** High-signal X: vibe-coded internal tools become admin for “10% more customization” then get abandoned. **Exception:** when the domain *is* proprietary (packet projection, frontier, CAS tips) and hosted trackers cannot model it without dual-write. That exception is beep’s case — but only for a thin viewer, not a productized IDP.
- **v1 static HTML is not a compromise; it is the high-leverage shape.** Zero build, zero server, drop-in after `beep goals project`. React v2 is justified only after v1 proves daily operator value and the projection API is frozen.
- **Staleness is a first-class UI field**, not a toast. Show `sourceTip`, projector version, projected-at, and “disk tip ≠ projection tip” when watch lags or someone edited outside CLI.

---

## 2. Findings

### 2.1 Prior art: docs-as-code / markdown portfolio boards

| Family | Shape | What worked | What rots | Fit for beep |
|--------|-------|-------------|-----------|--------------|
| **Backlog.md** | Markdown tasks under `backlog/`, Bun CLI, TUI board, React web | Agent-native; Git is sync; milestones+deps; JSON CLI; dogfooded | Web UI is **read-write** (DnD + forms); dual path with hand-edit | Architecture twin; **anti-pattern** on writes |
| **kanban-md** | One MD file per task + YAML FM; CLI/TUI; no DB | Multi-agent claim/WIP; `board --watch` | Still a task tracker, not portfolio/DAG of packets | Watch pattern; claim model optional later |
| **taskmd** | Per-task MD + validate + graph/tracks CLI + web | Explicit **parallel tracks** and critical path | New; web adds surface area | Parallel-group UX is on-target |
| **markplane** | `.markplane/` epics/tasks/plans; `serve` dashboard | Local kanban + dependency graph + dark mode | Another folder convention; write paths via CLI | Closest “dashboard product” shape |
| **MarkdownTaskManager / chr15m/kanban-todo** | Single HTML + `kanban.md` | Zero infra; git-friendly; v1-like | Merge conflicts on one fat board file; limited DAG | Validates **static HTML v1** |
| **Imdone / Obsidian Kanban** | Cards extracted from MD in vault/repo | Local-first; lives where notes live | Plugin rot; vault ≠ monorepo CLI | Personal, not fleet |
| **Markwhen** | Timeline DSL in markdown | Great for roadmaps/gantt-from-text | Separate DSL; not packet status | Optional roadmap export later |
| **Backstage catalog** | `catalog-info.yaml` + portal | Ownership, TechDocs, scaffolder at org scale | Maintenance trap; upgrade treadmill; not a goal board | Wrong layer for packets |
| **GitHub Projects** | Hosted board over issues | Collab, views, automations | Not files-as-truth; API/UI dual state; poor offline/agent | Loses docs-as-code premise |
| **MkDocs/Docusaurus status sites** | Static site from MD | Cheap publish | Regenerated, not live; status hand-maintained | Sibling to generated ATLAS |
| **gum/glow TUIs** | Terminal render of MD | Fast for operator in shell | No portfolio DAG | Keep CLI `beep goals board` |

**Backlog.md (primary).** Features: markdown-native tasks, AC/DoD, milestones & dependencies, terminal kanban, `backlog browser` local React Kanban with DnD and task forms, local-first, MCP. Explicit warning: *“prefer Backlog.md commands (CLI/MCP/Web) over hand-editing task files, so field types and metadata stay consistent.”* Web is first-class **writer**, not projection. HN (2025-07, 254 pts) and Devoxx/AI Engineer talks show the category is mainstream for agent fleets.  
Sources: https://github.com/MrLesk/Backlog.md · https://news.ycombinator.com/item?id=44483530 · https://en.thedavestack.com/backlog-md/

**kanban-md.** File-based board, no server/DB; CLI + optional TUI; `kanban-md board --watch` live-updates on file changes; WIP limits / claim timeouts aimed at multi-agent.  
Source: https://github.com/antopolskiy/kanban-md

**taskmd.** Agent-era task MD; `taskmd graph` / `taskmd tracks` surface critical path and **parallel work streams** — exactly the operator question “what can run in parallel?”  
Source: https://medium.com/@driangle/taskmd-task-management-for-the-ai-era-92d8b476e24e

**markplane.** Local `markplane serve` → dashboard with kanban, dependency graph, markdown rendering; CLI is the mutator (`start`/`done`/`sync`).  
Source: https://github.com/zerowand01/markplane

**Single-file HTML kanban.** chr15m/kanban-todo: one `index.html` + markdown textfile; drag-and-drop visual editing of plain text. MarkdownTaskManager: self-contained HTML + per-project `kanban.md`. These are existence proofs that **v1 static HTML is a finished product shape**, not a stub.  
Sources: https://github.com/chr15m/kanban-todo · https://github.com/ioniks/MarkdownTaskManager

**Hermes-agent kanban (architecture note).** Dashboard is React SPA; WebSocket **tails** `task_events`; REST writes call the **same** `kanban_db.*` path as CLI verbs. Shared writer + event tail = correct dual-surface pattern (still a DB, not pure files, but the single-writer lesson transfers).  
Source: https://github.com/nousresearch/hermes-agent/blob/main/website/docs/user-guide/features/kanban.md

**Backstage / IDP.** Catalog SoT is YAML in git (good instinct) but humans must keep it true. Port/Roadie/Riftmap critiques: no real-time, YAML maintainability, plugin abandonment, upgrade cost; 56% of adopters cite upgrades as top pain (Roadie 2025 report cited in cost piece). Catalog is for ownership/docs/scaffolding — **bad** as live dependency/status graph.  
Sources: https://backstage.io/docs/features/software-catalog/ · https://riftmap.dev/blog/the-catalog-maintenance-trap/ · https://roadie.io/blog/backstage-how-much-does-it-really-cost/ · https://www.port.io/blog/what-are-the-technical-disadvantages-of-backstage

**Local single-user vs hosted trackers.** Local wins: agents read/write files; offline; no second account; git history = audit; no SaaS schema impedance. Local loses: multi-human collab UX, notifications, mobile, non-engineer stakeholders. Beep is **one operator + agent fleet** → local projection wins; hosted Jira/Linear would force status mirroring (classic dual-write).

### 2.2 Realtime data-from-files in Vite/React

**Canonical “HMR for data” pattern (recommended stack for v2):**

1. **Scope the watch** to `explorations/**/ops/**`, `goals/**/ops/**`, and the projection output path — never `**/*` of a monorepo.
2. **On change:** run/incrementally update the **same projector** that CI and static HTML use (bun:sqlite + decoded manifests/events).
3. **Emit** a new projection artifact (`projection.json` or query API over sqlite) carrying `sourceTip`, `projectorVersion`, `generatedAt`.
4. **Push invalidate** to the browser:
   - **Vite custom HMR events** (dev): plugin `configureServer` → `server.watcher.add(...)` + `server.ws.send({ type: 'custom', event: 'packets:projection', data })`; client `import.meta.hot.on('packets:projection', ...)`.
   - **SSE or thin WS** if the dashboard is not Vite-owned.
   - **TanStack Query:** `queryClient.invalidateQueries({ queryKey: ['projection'] })` on event; or setQueryData if payload is small.
5. **Fallback poll** every 2–5s comparing `sourceTip` — fine for N=1 operator; often simpler and more reliable than fighting watcher edge cases.

**Vite HMR API facts.** `import.meta.hot.on` / `send` for custom events; server plugins use `server.ws`; typed custom events documented under client-server communication. Built-in events include `vite:ws:disconnect` / `connect` — surface connection state in the UI chrome.  
Sources: https://vite.dev/guide/api-hmr · https://vueschool.io/articles/vuejs-tutorials/how-to-send-real-time-custom-events-from-the-browser-a-vite-dev-server/ (2025-09)

**Proven app pattern.** kaitranntt/ccs dashboard plan: chokidar → WebSocket broadcast → React Query invalidation + connection indicator + heartbeat — textbook for config-as-files UIs.  
Source: https://github.com/kaitranntt/ccs/issues/65

**Gotchas (large git worktrees / monorepos):**

| Gotcha | Evidence | Mitigation |
|--------|----------|------------|
| Watching too much | chokidar docs: be judicious; monorepo watchers overload (esp. macOS) | Watch only packet roots + projection out |
| `server.watch: null` → NoopWatcher | Shopify Hydrogen HMR postmortem | Never disable watch “for perf” without alternative |
| Symlink path mismatch | Vite module graph keys vs chokidar realpath | `handleHotUpdate` path remap; `server.watcher.add` |
| Initial scan `add` storms | vite#15347 chokidar throttle → spurious HMR | Debounce; ignore first N ms after boot |
| Proxy / `.localhost` HMR | vite discussions: clientPort/protocol/wss | Configure `server.hmr` for portless proxy |
| Editor atomic saves | temp write + rename double events | Debounce 50–200ms; project on settle |
| Git operations | checkout touches many files | Coalesce; or reproject once on `HEAD` change |

**When polling is fine.** Single operator, projection rebuild <100ms for fleet size of tens of packets, dashboard open while agents work: **2s poll of `/projection.json` etag/`sourceTip`** is simpler than a custom WS server and fails closed (shows stale). Push is nicer; poll is correct.

**Anti-pattern:** importing packet markdown as Vite modules and relying on code HMR. That couples renderer to raw files and encourages client-side “status derivation” — the divergent-semantics failure mode the redesign forbids.

### 2.3 React libraries for this UI shape (2025–2026)

**DAG / dependency graph**

| Lib | Role | Verdict for packets |
|-----|------|---------------------|
| **@xyflow/react** (React Flow) | Pan/zoom graph, custom nodes, minimap | Default viewer shell |
| **@dagrejs/dagre** | Fast directed layout; ~40KB | **Default** for execution-order / prereq DAG |
| **elkjs** | Full ELK; dynamic sizes, subflows, edge routing; ~1.4MB | Only if dagre layouts are unreadable |
| **d3-dag / d3-hierarchy** | Tree/DAG specialized | Optional; single-root assumptions hurt |
| **Mermaid** (already planned) | Generated text diagram | Keep as portable artifact; don’t dual-implement layout rules in React |

xyflow official layout guide ranks dagre simplest → elk most complex; recommends dagre for trees. Stately cookbook (2025–2026): **domain model → ELK layout → toXYFlow**; graph is SoT, not React Flow’s node array — maps cleanly onto “projection owns semantics.”  
Sources: https://reactflow.dev/learn/layouting/layouting · https://reactflow.dev/examples/layout/elkjs · https://stately.ai/docs/packages/graph/react-flow-elk-pipeline

**Kanban**

- **Read-only:** hand-roll columns from `projection.byStatus`; cards = packet chips; click → detail. Zero DnD dependency.
- **dnd-kit / @hello-pangea/dnd:** only if you intentionally support reorder writes — **do not** for beep v2.
- Backlog.md / hermes show the market expects DnD boards; that is a product habit, not a requirement for a projection viewer.

**Markdown + tabs**

- **react-markdown** + `remark-gfm` for README/SPEC/PLAN/DECISIONS; `components` prop for safe defaults (no raw HTML unless sanitized).
- **Shiki** (or `rehype-pretty-code`) for fenced code; heavier but matches monorepo docs quality.
- **MDX:** skip for packet files — MDX is an executable document format; packets are authored markdown, not React components. Compiling arbitrary repo MD as MDX is a supply-chain/footgun.
- **Tabs:** Radix/shadcn Tabs keyed by canonical filenames; lazy-fetch file text by path from a **read API** that only serves allowlisted packet paths.
- Editors (`@uiw/react-md-editor`, etc.): irrelevant if read-only.

**Roadmap / execution order**

- Roadmap: sorted list or simple Gantt from projected dates/stages — Markwhen only if you want a dedicated timeline DSL export.
- Execution order / parallel groups: **tables + chips driven by CTE outputs**, not re-derived in the client. Graph view highlights the same `parallelGroupId`.

### 2.4 “Dashboard becomes second source of truth”

**Named failure: catalog maintenance trap** (Westgaard / Riftmap, 2026-05). Catalogs describe the world *as of last human edit*. Drift → “is this accurate?” → “kind of” → worse than no catalog because people decide as if it were true. Three options: mandate PR tax, build automation, or quiet rot — most converge on rot. Escape: **parse what engineers already edit to ship**; graph maintains itself.  
Source: https://riftmap.dev/blog/the-catalog-maintenance-trap/

**Same pattern for status UIs:** Jira/Linear boards that don’t match git; Notion “source of truth” pages nobody updates; generated INDEX.md hand-edited after generation (beep’s own ATLAS/README status drift — D6 retires that class).

**Discipline that works:**

| Rule | Mechanism |
|------|-----------|
| Single writer | CLI/CAS append only; UI has no mutate endpoints |
| Single projector | One code path → JSON, Mermaid, static HTML, React |
| Tip binding | UI shows `sourceTip` digest; doctor fails if tip ≠ disk head |
| Generated marking | Banners: “GENERATED — do not edit”; lint forbids hand edits |
| Staleness chrome | Age, tip mismatch, projector version skew → yellow/red banner |
| No optimistic status | Cards never move until new projection arrives |

**How tools mark staleness (patterns to copy):**

- CI: “outdated base” / required checks pending.
- Package managers: lockfile out of sync warnings.
- Backstage: implicit “last ingested” — weak if not shown.
- Beep redesign already: projection cache with `sourceTip` + projector version (D1).

**Hermes dual-surface (positive):** UI and CLI share write path; WS tails events. Beep variant: UI and Mermaid **share read path**; only CLI writes events.

### 2.5 Build vs buy / regret

**Generic internal dashboards — buy or don’t build.** Geckoboard (updated 2026-01): buy for internal KPIs; build when customer-facing or proprietary; vibe-code only for prototypes. Hidden costs: API churn, permissions, iteration friction, engineer day-rate.  
Source: https://www.geckoboard.com/blog/dashboard-build-vs-buy/

**High-signal practitioner regret (X):**

- **@buccocapital** (2026-06-10): watched people vibe-code internal tooling then realize they are “admin for something that basically does the same thing as the software we used to use” and go back — *“10% more customization isn’t really worth it.”* ~2.5k likes, 327k views.  
  https://x.com/buccocapital/status/2064672567311393162
- **@Hartdrawss / @WasimShips** (2026-08): pretty internal tools that save zero hours; survivors are boring one-screen ops views on a cron.  
  https://x.com/Hartdrawss/status/2085244699980312689
- **@GergelyOrosz** (2025-07): Linear wins vs Jira largely on **speed** (devs hate sluggish software). Relevance: a slow custom packets UI loses to `beep goals board` in the terminal.  
  https://x.com/GergelyOrosz/status/1945234307502473609

**When building is justified (narrow):**

- Domain model is **not** expressible in Linear/Jira without dual-write (packet stages from event chain, CAS tips, parallel groups from dependency CTE).
- Consumer is one power user + agents, not an org portal.
- Surface is a **viewer** over an existing projector, not a new system of record.
- Timebox: static HTML first; React only if daily use proves the gap.

**IDP build-vs-buy literature** (OpsLevel, Humanitec, Qovery) is mostly about multi-team portals — overkill and wrong analogy. Do not import Backstage-scale staffing assumptions for a local packets viewer.

### 2.6 Why local single-user dashboards beat / lose to hosted trackers

| Dimension | Local projection wins | Hosted wins |
|-----------|----------------------|-------------|
| Agent access | Files + CLI | API keys, rate limits |
| Audit | Git + CAS events | Vendor history |
| Schema fit | Exact packet model | Forced issue/epic shape |
| Latency to truth | fs + project | sync jobs |
| Collab / non-dev | Weak | Strong |
| Mobile / notify | Weak | Strong |
| Abandonment risk | Low if CLI works without UI | Account sprawl |

Beep’s operator model matches **local win column**. Hosted is a regression unless someone needs non-repo stakeholders — then export a **generated** static site/PDF, don’t make Linear SoT.

---

## 3. Practitioner voices from X

Cite format: handle · date · URL · engagement (as returned by search).

1. **@buccocapital** · 2026-06-10 · https://x.com/buccocapital/status/2064672567311393162 · **2571 likes, 105 RTs, 327k views**  
   Vibe-coded internal tools → you become admin of a 10%-different clone → teams revert to the original SaaS. Direct counter to “just build a React packets app because we can.”

2. **@elirousso** · 2026-07-14 · https://x.com/elirousso/status/2077083570028335373 · 22 likes, 5.2k views  
   Tickets/strategy/workflows as separate markdown files; thin client renders `BACKLOG.md` as kanban; replaced Notion and Linear. Existence proof of markdown SoT + thin viewer — productively aligned with beep, with the usual risk if the client writes.

3. **@TheViableEdge** · 2026-07-09 · https://x.com/TheViableEdge/status/2075254799352607188 · 1 like, 1k views  
   Stack: orchestrator + Claude Code + **markdown kanban as work queue** + memory files as SoT — “plain markdown in git. That is the leverage.”

4. **@sandepMachiraju** · 2026-08-07 · https://x.com/sandepMachiraju/status/2085705708528636189 · low eng.  
   Forked agent UI; added **derived-state** kanban (Needs You / Working / Review / Done / Idle / Snoozed) across repos — status derived, not hand-set. Pattern matches D3 stage-as-derivation.

5. **@burakkarakann** · 2026-04-29 · https://x.com/burakkarakann/status/2049500452874600833 · 248 likes, 26k views  
   Open-sourced **dashboard-as-code** (`dac`): YAML/JSX → single binary; agents generate files; governance via review of files not free-form React. Sibling philosophy to projection-as-artifact.

6. **@Hartdrawss** · 2026-08-06 · https://x.com/Hartdrawss/status/2085244699980312689 · 21 likes  
   Ops dashboards that get used: one screen, cron refresh, “needs action” on top, email export — not nav-heavy SPAs.

7. **@GergelyOrosz** · 2025-07-15 · https://x.com/GergelyOrosz/status/1945234307502473609 · 565 likes, 69k views  
   Linear vs Jira: speed is the product. Implication: packets UI latency (including projection lag) is a first-class UX metric.

8. **@devtocash** · 2026-07-31 · https://x.com/devtocash/status/2083072159186894958 · low eng.  
   Backstage pitch: `catalog-info.yaml` lives with code so ownership “never goes stale in a wiki.” **Counterpoint in literature:** YAML still goes stale if not derived — the trap is manual metadata, not wiki vs git.

9. **@m13v_** · 2026-06-16 · https://x.com/m13v_/status/2066765800762220843 · low eng.  
   Distinguishes “file survives on disk” vs “agent re-reads after compaction” — relevant: dashboard refresh ≠ agent memory; projection must also feed agent-facing indexes.

10. **@ryolu_** · 2026-01-01 · https://x.com/ryolu_/status/2006859681390801390 · 532 likes, 76k views  
    Docs/changelog from code + markdown → static site. Reinforces generate-from-source over hand-maintained status sites.

---

## 4. Contrarian / failure evidence

- **Backlog.md Web is popular *because* it writes.** The category pressure is toward full PM replacement. Copying that UX into beep without a write gateway recreates Jira-inside-the-repo. Prefer ugly read-only over pretty dual-write.
- **Static HTML is not “less serious.”** Multiple successful tools *are* single HTML + markdown (kanban-todo, MarkdownTaskManager). Operator daily driver may stay HTML forever if projection JSON is rich enough.
- **React Flow + elk is overkill** for <100 packet nodes. Dagre or even pure Mermaid + list views cover execution order; complexity budget belongs in the projector CTEs.
- **File watchers on monorepos fail loudly** (CPU, missed events, symlink skew). Teams “solve” this by disabling watch or polling everything — design for scoped watch + poll fallback from day one.
- **Hosted tracker migration regret cuts both ways:** teams leave Jira for Linear for speed, then invent markdown boards for agents; teams leave custom tools back to SaaS for maintenance. Beep already chose files; the dashboard must not re-open the SaaS-shaped hole.
- **Catalog/portal ROI at single-operator scale is near zero.** Roadie cost model assumes platform engineers; one operator cannot afford a Backstage.
- **MDX/executable docs in a dashboard** creates a new attack/complexity surface for free. Render markdown; do not execute it.
- **“Realtime” without tip display trains false trust.** A card that moves 30s late with no banner is worse than a card that shows “projection 30s old.”

---

## 5. Implications for the beep-effect packets app

Opinionated, ordered. Respects **read-only projection** + **ratified static-HTML v1**.

### 5.1 Ship order (do not invert)

1. **Projector + schema** (`sourceTip`, frontier, blockers, cycles, parallel groups, readiness from events).  
2. **JSON + Mermaid + static HTML v1** (kanban columns + DAG from *same* JSON). Open as `file://` or `beep goals dashboard` writing a single HTML.  
3. **CLI board** (`beep goals board`) for terminal-only days — same JSON.  
4. **React v2 only if** v1 is used daily and pain is interaction (filter, multi-panel, tabbed MD), not correctness.

### 5.2 Non-negotiable architecture for any v2

```
disk packets + CAS events
        │
        ▼
 single writer CLI ──► events/manifests
        │
        ▼
 projector (bun:sqlite CTEs) ──► projection.json (+ mermaid, html)
        │
        ├── static HTML (v1)
        ├── CLI board
        └── React app (v2, read-only fetch + watch invalidate)
```

- **No** React route that POSTs status.  
- **No** DnD that implies column changes.  
- **No** client-side reimplementation of frontier/blocker logic.  
- Clicking a card opens tabs: README / SPEC / PLAN / DECISIONS / manifest / events tail — content from allowlisted read API or embedded projection payloads for small files.

### 5.3 Realtime recipe (v2)

- Watch **only** `goals/*/ops/**`, `explorations/*/ops/**`, and projection output.  
- Debounced reproject → atomic write `projection.json`.  
- Vite plugin custom event `packets:projection` with `{ sourceTip, generatedAt }` OR 2s poll of ETag.  
- Header chrome: tip short-hash, age, projector version, WS/poll state. Red if `diskHead ≠ sourceTip`.  
- Detail markdown: fetch on tab focus; re-fetch when tip changes.

### 5.4 UI library choices (if v2)

| Concern | Choose | Skip |
|---------|--------|------|
| Graph | `@xyflow/react` + `@dagrejs/dagre` | elkjs until proven need |
| Kanban | Hand-rolled columns | dnd-kit |
| Markdown | `react-markdown` + GFM + Shiki | MDX compile of packet files |
| Data | TanStack Query over projection | Client redux of “status” |
| Shell | Existing monorepo Vite + portless `.localhost` | Separate Next app / hosted |

### 5.5 Steal / refuse from prior art

| Steal | From | Refuse |
|-------|------|--------|
| CLI-first, markdown ledger | Backlog.md, kanban-md | Web as writer |
| Parallel tracks / graph CLI | taskmd | Second task ontology |
| Watch → invalidate Query | ccs-style dashboards | Full-tree chokidar |
| Single HTML board | kanban-todo, KSA v1 | Premature SPA |
| Derived status columns | @sandepMachiraju fork pattern | Hand-set column fields |
| sourceTip staleness | Packet D1 | Silent eventual consistency |
| Dashboard-as-code mindset | dac / burakkarakan | Free-form agent-generated React each time |

### 5.6 Success metrics (so the UI doesn’t become status theater)

- Time from CLI event append → projection tip change → UI card update (p50/p95).  
- Zero dual-write incidents (UI cannot mutate).  
- Doctor failures on tip skew catchable from UI banner.  
- Operator still productive with **only** CLI + static HTML if Vite is down.

### 5.7 Explicit non-goals

- Multi-user auth, comments, @mentions (use PR/GitHub).  
- Replacing Linear for non-packet work.  
- Backstage-like service catalog.  
- Editable board “for convenience.”  
- Perfect sub-100ms HMR aesthetics.

---

## 6. Full source list

### GitHub / tools / docs

- https://github.com/MrLesk/Backlog.md  
- https://github.com/MrLesk/Backlog.md/blob/main/CLI-INSTRUCTIONS.md  
- https://github.com/antopolskiy/kanban-md  
- https://github.com/ioniks/MarkdownTaskManager  
- https://github.com/chr15m/kanban-todo  
- https://github.com/zerowand01/markplane  
- https://github.com/LachyFS/kanban-markdown-vscode-extension  
- https://github.com/TheJoeFin/kanban-files  
- https://github.com/nousresearch/hermes-agent/blob/main/website/docs/user-guide/features/kanban.md  
- https://github.com/kaitranntt/ccs/issues/65  
- https://github.com/vitejs/vite/issues/15347  
- https://github.com/shopify/hydrogen/issues/2722  
- https://github.com/remarkjs/react-markdown  
- https://github.com/xyflow/xyflow  
- https://backstage.io/docs/features/software-catalog/  
- https://markwhen.com/ · https://docs.markwhen.com/visualizations/timeline/ · https://github.com/mark-when/obsidian-plugin  
- https://imdone.io/markdown-kanban-board  

### Articles / vendor analyses

- https://en.thedavestack.com/backlog-md/  
- https://medium.com/@driangle/taskmd-task-management-for-the-ai-era-92d8b476e24e  
- https://news.ycombinator.com/item?id=44483530  
- https://riftmap.dev/blog/the-catalog-maintenance-trap/  
- https://roadie.io/blog/backstage-how-much-does-it-really-cost/  
- https://roadie.io/blog/self-hosting-backstage-the-real-to-do-list/  
- https://www.port.io/blog/what-are-the-technical-disadvantages-of-backstage  
- https://www.geckoboard.com/blog/dashboard-build-vs-buy/  
- https://www.opslevel.com/resources/build-or-buy-your-developer-portal  
- https://vite.dev/guide/api-hmr  
- https://vueschool.io/articles/vuejs-tutorials/how-to-send-real-time-custom-events-from-the-browser-a-vite-dev-server/  
- https://reactflow.dev/learn/layouting/layouting  
- https://reactflow.dev/examples/layout/elkjs  
- https://stately.ai/docs/packages/graph/react-flow-elk-pipeline  
- https://www.contentful.com/blog/react-markdown/  
- https://www.npmjs.com/package/chokidar  
- https://forum.golangbridge.org/t/kanban-md-file-based-kanban-cli-tui-for-multi-agent-workflows/41591  

### X posts (also §3)

- https://x.com/buccocapital/status/2064672567311393162  
- https://x.com/elirousso/status/2077083570028335373  
- https://x.com/TheViableEdge/status/2075254799352607188  
- https://x.com/sandepMachiraju/status/2085705708528636189  
- https://x.com/burakkarakann/status/2049500452874600833  
- https://x.com/Hartdrawss/status/2085244699980312689  
- https://x.com/GergelyOrosz/status/1945234307502473609  
- https://x.com/devtocash/status/2083072159186894958  
- https://x.com/m13v_/status/2066765800762220843  
- https://x.com/ryolu_/status/2006859681390801390  
- https://x.com/WasimShips/status/2086694255863447781  
- https://x.com/nejatian/status/2008924427120226610  

### Local binding context

- `explorations/packet-system-redesign/CAPTURE.md` (packets app intent; KSA static HTML v1)  
- `explorations/packet-system-redesign/DECISIONS.md` (D1 sourceTip projection; D3 derived stage; D6 generated ATLAS/README)  
- `explorations/packet-system-redesign/research/2026-08-10-codex-deep-research-redesign.md` (HTML as non-normative projection)

---

*End of lane report. Density prioritized over encyclopedic coverage of every Jira alternative; the binding constraint for beep is single-writer projection, not feature parity with Linear.*
