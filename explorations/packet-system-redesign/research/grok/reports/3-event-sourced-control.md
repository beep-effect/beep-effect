# Event Sourcing for Small Control Planes & Workflow State

**Research date:** 2026-08-10  
**Scope:** Practitioner lessons (not theory) for control-plane / workflow state: schema evolution, projections, durable execution versioning, agent checkpoints, git-stored event logs.  
**Method:** Web + GitHub + X (semantic/keyword). Prefer 2025–2026; foundational sources included when still binding. No fabricated URLs or quotes.

---

## 1. TLDR

- **Event sourcing fits audit/replay/readiness derivation**; it is the wrong default for bag-of-CRUD or high-churn exploratory domains. Overeem et al. found five recurring industrial pains: schema evolution, learning curve, tooling, **projection rebuilds**, privacy ([arXiv:2104.01146](https://arxiv.org/abs/2104.01146)).
- **Schema evolution is the tax that never goes to zero.** Five production tactics: versioned events, weak/additive schema, upcasting, in-place transform, copy-and-transform. Prefer additive + version fields early; upcast at read; only rewrite streams when immutability is relaxed ([Overeem](https://arxiv.org/abs/2104.01146); [Oskar Dudycz](https://event-driven.io/en/simple_events_versioning_patterns/)).
- **Regret usually comes from hybrid half-ES** (command handlers dual-write events *and* relational state), using the store as a message bus, or adopting ES before the domain stabilizes—not from “events bad” ([Nat Pryce](http://natpryce.com/articles/000819.html); practitioners on X).
- **Durable execution (Temporal / Restate / DBOS) is event-history + deterministic replay of control flow.** Nondeterministic branches on recovery cause silent wrong side effects. Safe deploys need replay tests, Worker/app versioning, or blue-green drain—not “just ship” ([Vanlightly 2025](https://jack-vanlightly.com/blog/2025/11/24/demystifying-determinism-in-durable-execution); [Temporal safe deploys](https://docs.temporal.io/develop/safe-deployments); [DBOS upgrade docs](https://docs.dbos.dev/typescript/tutorials/upgrading-workflows)).
- **Agent framework checkpoints ≠ production durable execution.** LangGraph/OpenAI sessions persist conversation/graph state; Restate argues recovery boundaries, single-writer fencing, durable waits, and **version-pinned code** are missing from “checkpoint and hope” ([Restate 2026](https://restate.dev/blog/why-checkpointing-is-not-production-grade-durable-execution)).
- **Repo-stored JSONL event logs collide with Git’s line merge.** Real systems (e.g. spec-kitty `status.events.jsonl`) lose audit trails on branch merges unless you ship a **union merge driver** keyed by event id ([GitHub #569](https://github.com/Priivacy-ai/spec-kitty/issues/569)).
- **Per-event immutable files + parent digests** buy CAS, fork detection, and conflict-free parallel appends (git-like); **single JSONL** is simpler and faster for one writer, hostile to concurrent branches.
- **Derived readiness (fold events + approvals) beats stored status fields** for agent fleets—status boards go stale/diverge after merge drops; events+projections rebuild truth ([spec-kitty failure mode](https://github.com/Priivacy-ai/spec-kitty/issues/569); ES projection literature).
- **Ceremony should be risk-tiered.** Full ES machinery for multi-writer mission control; Light = append-only evidence receipts + derived status for solo/low-risk packets. Over-ceremony is the #1 reason teams abandon ES.
- **For beep-effect:** treat control events as git-native CAS chains under each packet, memoize projections (readiness, symbol ledger, gate results) so unrelated PRs recompute nothing, never dual-write mutable `status` as source of truth.

---

## 2. Findings

### 2.1 Small control planes: when ES pays

Event sourcing stores facts (“what happened”), rebuilds state by fold. For **workflow/control planes** (approvals, phase transitions, gate results, evidence receipts), the domain *is* the event history—audit, fork detection, and “why is this packet ready?” queries are first-class, not afterthoughts. Dudycz argues ES is module-level, not system-wide: core process modules yes; CMS/CRUD bags no ([When not to use ES](https://event-driven.io/en/when_not_to_use_event_sourcing/)).

**Fit signals for a packet control plane:**
- Multiple writers (human + agents + CI) need a single causal story.
- Status is contested or reconstructed after crashes/merges.
- You need external verifiability (parent digests, approval attestations).
- Rebuild of derived views is acceptable and cheap (small N events per packet).

**Anti-fit:** rapid greenfield where event names churn weekly before the domain is understood—interview subjects preferred “stabilize model first, then introduce ES” ([Overeem §7](https://ar5iv.labs.arxiv.org/html/2104.01146#S7)).

### 2.2 Schema evolution & upcasting (production)

Overeem et al. (25 engineers, 19 systems) list **event system evolution** as a primary industrial challenge and document five tactics ([arXiv:2104.01146](https://arxiv.org/abs/2104.01146)):

| Tactic | Idea | Trade-off |
|--------|------|-----------|
| **Versioned events** | Explicit type/version (`OrderCreated.v2`) | Simple; pollutes app with version branches |
| **Weak schema** | Additive optional fields; ignore unknowns | Easiest; incomplete for structural renames |
| **Upcasting** | Transform old→new at read/projection time | Preserves immutability; upcaster chains rot |
| **In-place transformation** | Rewrite store | Breaks pure immutability; needs downtime/ops |
| **Copy-and-transform** | New store/stream + backfill | Safest for big breaks; dual-run cost |

Dudycz’s practitioner patterns: simple mapping for optional fields; upcasters for structure breaks; stream transforms/migrations when needed ([simple versioning patterns](https://event-driven.io/en/simple_events_versioning_patterns/)). Artium’s deep dive: chain `v1→v2→v3` upcasters; never embed full mutable domain aggregates inside events (each aggregate field change forces new upcasts) ([upcasting deep dive](https://artium.ai/insights/event-sourcing-what-is-upcasting-a-deep-dive)).

**Operational rule of thumb still cited in 2025–26 discourse:** treat events as long-lived public contracts; prefer additive changes; use schema registry / CI compatibility gates when many consumers exist (Kafka-world version of the same pain—e.g. practitioner threads on X Aug 2026).

### 2.3 Projection rebuilds

Projections are disposable derived state. Industrial pain: **rebuild is slow** once history is large; teams trade developer optimization vs weekend rebuilds ([Overeem §6](https://ar5iv.labs.arxiv.org/html/2104.01146#S6)). Dudycz (2026): inline (same transaction as append) for simple single-stream views; async for complex workflows—inline couples append success to read-model bugs ([rebuilding read models](https://event-driven.io/en/rebuilding_event_driven_read_models/)).

**Control-plane implication:** keep per-packet event volume small; store **snapshots/cursors** for readiness; rebuild from events only when projection schema changes or digests mismatch. Memoize aggressively so unrelated PR paths never fold the full chain.

### 2.4 When teams “regret” event sourcing

Concrete failure patterns (not abstract FUD):

1. **Dual-write hybrid** — handlers write events *and* relational tables without projections → history not rebuildable; still pay migration tax (Nat Pryce, GOV.UK-adjacent experience) ([natpryce.com/000819](http://natpryce.com/articles/000819.html)).
2. **Event store as message bus** — technical noise in business history; confuse EDA with ES (same article).
3. **Eventual consistency seduction** — HTTP event store + app-level consistency hacks (same).
4. **Premature ES** before domain stable (Overeem interviewees E14/E16/E22).
5. **Infrastructure treated as optional** — “pattern elegant; machinery not optional” (practitioner framing 2026).
6. **EDA without schema discipline** — years later: dozens of types, multi-format serialization, debug paths across many services (e.g. @brankopetric00 Dec 2025: “differently complicated… debugging tools worse”).

Allard Buijze (Axon): when he regrets ES it is rarely “wrong pattern,” more often incomplete surrounding infrastructure (LinkedIn “Friday FUD” framing, widely referenced 2025–26). Dudycz: well-done CRUD beats poorly done ES ([when not to use](https://event-driven.io/en/when_not_to_use_event_sourcing/)).

### 2.5 Hash-chained per-event files vs append-only JSONL

| Dimension | Per-event files + parent digest (CAS) | Single JSONL journal |
|-----------|--------------------------------------|----------------------|
| **Concurrency** | Parallel appends on different files; forks are explicit (two children of same parent) | One writer; multi-branch appends → Git conflict |
| **Integrity** | Parent hash chain / Merkle-style verification ([NIST hash chain](https://csrc.nist.gov/glossary/term/hash_chain); audit-log patterns) | Append-only integrity if single process; no fork proof |
| **Git UX** | Many small blobs; renames/renumbers noisy; merge often “add only” | One hot file; **always conflicts** on concurrent append |
| **Ops** | Natural content-addressing like git objects | Simple `tail`/`cat`; fast sequential read |
| **Evidence** | Bind receipt file digests into events cleanly | Embed digests as fields in lines |

**Real merge-conflict experience:** [spec-kitty #569](https://github.com/Priivacy-ai/spec-kitty/issues/569) (Apr 2026): `status.events.jsonl` is append-only; lane branch + main both append → Git 3-way conflict; resolving `--ours`/`--theirs` **drops events**. After a 7-WP mission, board showed all WPs “Planned” despite approvals—**audit trail partially lost**. Fix: custom merge driver = union by `event_id`, sort by timestamp.

**Implication:** if control state lives in git, **do not** use a single mutable JSONL without a merge driver *or* move to per-event CAS files under a content-addressed path. Parent digests detect forks when two agents append “next” offline.

### 2.6 Temporal / Restate / DBOS: determinism & versioning

**Shared mental model (Vanlightly, Nov 2025):** recovery re-executes the function from the top; **control flow must be deterministic**; **side effects** must be journaled and skipped on replay (or be idempotent). Classic bug: branch on `now()` or live DB row → second run takes other branch → double charge ([Demystifying Determinism](https://jack-vanlightly.com/blog/2025/11/24/demystifying-determinism-in-durable-execution)).

**Temporal:** Workflow code deterministic; `patched` / Worker Versioning / replay testing of event histories before deploy ([safe deployments](https://docs.temporal.io/develop/safe-deployments); [TS versioning](https://docs.temporal.io/develop/typescript/workflows/versioning)). Encrypted payloads complicate fetching histories for CI replay.

**DBOS:** Breaking change = different steps or order. **Patching** (`DBOS.patch`) records markers in history so old runs keep old paths; **versioning** tags workflows with app version (default: **hash of workflow source**); recover only matching version; blue-green drain old processes ([upgrade docs](https://docs.dbos.dev/typescript/tutorials/upgrading-workflows)).

**Restate:** Durable execution’s immutability problem: long-running handlers outlive code deploys. Prefer pin executions to immutable deployments; new traffic → new version; old → drain. Serverless Lambda versions make this natural; multi-week handlers remain hard ([immutability problem](https://restate.dev/blog/solving-durable-executions-immutability-problem/); [agent versioning](https://restate.dev/blog/dealing-with-versioning-in-long-running-agents)).

**Lesson for a small control plane:** you are closer to “event log + pure fold” than to Temporal’s full worker model. Still enforce: **gate/projector code version** recorded on each fold; never change historical event semantics without upcast; deploy projector changes with rebuild-or-compat tests.

### 2.7 Agent frameworks: what they persist and what breaks

| System | Persistence model | Failure modes |
|--------|-------------------|---------------|
| **LangGraph** | Checkpointer (thread state) + optional Store; PostgresSaver etc. | `MemorySaver` dies on restart; unbounded checkpoint growth; subgraph namespaces isolate parent/child; `thread_id` length limits ([persistence docs](https://docs.langchain.com/oss/python/langgraph/persistence)) |
| **OpenAI Agents SDK** | Session memory (SQLite/Redis/Mongo…); resume interruptions via `to_state()` + same session | Conversation history, not full durable workflow journal; separate from server `conversation_id` modes ([sessions](https://openai.github.io/openai-agents-python/sessions/)); checkpoint issues open on GitHub |
| **Claude Code** | Local transcript files; resume restores conversation, model, agent, limited permission modes | Transcripts are not a multi-writer control plane; permission modes often *not* restored (`plan`/`bypassPermissions`); process-local, not git-shared ([sessions docs](https://code.claude.com/docs/en/sessions)) |
| **Production agents (survey discourse)** | Prefer short constrained workflows; custom scaffolds over frameworks | Reliability > autonomy; evaluation still human-heavy (DAIR.AI summary of large production-agent study, Dec 2025) |

**Restate (Jun 2026):** agent “checkpoints” often resume at coarse boundaries → duplicate tool side effects; no failure detection/redispatch; no single-writer fencing; no durable human/timer waits; **code upgrades break in-flight runs** ([checkpointing ≠ durable execution](https://restate.dev/blog/why-checkpointing-is-not-production-grade-durable-execution)).

X practitioners (2026): “An agent that survives a crash by repeating the work is not resilient. It is dangerous.” Recovery needs **idempotency keys + input/result hashes**, not a reassuring `checkpoint()` method name.

### 2.8 Repo-as-database: CRDT vs event-log

- **Git is already a CAS DAG** (blob/tree/commit content hashes)—excellent for immutable artifacts and PR review ([Pro Git objects](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects)).
- **Mutable JSON status files in git** are a trap under multi-agent branches (merge last-write-wins).
- **Event-log in git** works if merge semantics are event-union (spec-kitty) *or* events are separate CAS objects never rewritten.
- **CRDTs** shine for concurrent *document* editing without causal audit; they **do not** replace approval chains, risk tiers, or human attestations. For control planes, **event log + derived projections** matches audit/approval better than CRDT merge of status fields.
- **GitOps** (desired state in git) is orthogonal: declarative *target*, not event history of *decisions*.

Tobi Lütke framing (Aug 2026, widely quoted): *everything that can be will be converted into `state = memo { f(log) }`* — pure fold over log as the limit architecture; other state management as intermediate complexity ([@tobi](https://x.com/tobi/status/2086192833061323111)).

---

## 3. Practitioner voices from X

> “everything that can be will be converted into `state = memo { f(log) }` all other state management is just too complex at the limit”  
> — **@tobi** (Tobi Lütke), 2026-08-08 · [https://x.com/tobi/status/2086192833061323111](https://x.com/tobi/status/2086192833061323111) · ~763 likes / ~174k views  

> “Event sourcing turned out to be overkill for applications, but it may be the right architecture for agents.”  
> — **@liambai21**, 2026-08-08, quote-tweeting @tobi · [https://x.com/liambai21/status/2086204890599027070](https://x.com/liambai21/status/2086204890599027070)

> “Event-driven architecture sounded perfect… Two years later: 47 event types, no schema registry, three serialization formats… We traded request-response complexity for eventual consistency complexity. Event-driven isn’t simpler. It’s differently complicated. And the debugging tools are worse.”  
> — **@brankopetric00**, 2025-12-20 · [https://x.com/brankopetric00/status/2002386544196206600](https://x.com/brankopetric00/status/2002386544196206600) · ~290 likes  

> “Event sourcing is risky, complex, and should be avoided in 99% of systems… You sign up for event versioning, projections, replay strategies… The biggest risk is that it’s difficult to reverse.”  
> — **@lroal**, 2026-06-16 · [https://x.com/lroal/status/2066781941009953159](https://x.com/lroal/status/2066781941009953159)

> “Event sourcing projects rarely fail because the pattern was the wrong choice. They fail because the infrastructure surrounding it was treated as an implementation detail rather than a core design concern.”  
> — **@WooderzJames**, 2026-05-02 · [https://x.com/WooderzJames/status/2050519067597901879](https://x.com/WooderzJames/status/2050519067597901879)

> “New blog post: Demystifying Determinism in Durable Execution… Why do some parts of a durable function have to be deterministic while others idempotent…?”  
> — **@vanlightly** (Jack Vanlightly), 2025-11-24 · [https://x.com/vanlightly/status/1992956709023728032](https://x.com/vanlightly/status/1992956709023728032) · ~219 likes  

> “durable execution is the only sane way to do long running agents… been in the trenches… migrating now”  
> — **@boristane**, 2026-06-30 · [https://x.com/boristane/status/2072102551026385104](https://x.com/boristane/status/2072102551026385104) · ~242 likes  

> “Who owns the truth about a running agent? … We migrated our runtime so the JSONL event stream IS the source of truth… On restart, recovery reads the stream — the process is disposable, the truth isn’t.”  
> — **@echo_vic**, 2026-08-10 · [https://x.com/echo_vic/status/2086898217824706957](https://x.com/echo_vic/status/2086898217824706957)

> “An agent that survives a crash by repeating the work is not resilient. It is dangerous. … Resume needs an executable contract, not a reassuring method name.”  
> — **@koksing456**, 2026-08-06 · [https://x.com/koksing456/status/2085367562611957942](https://x.com/koksing456/status/2085367562611957942)

> “Mistakes we made adopting event sourcing (and how we recovered)”  
> — **@natpryce**, 2019-06-30 (foundational, still linked) · [https://x.com/natpryce/status/1145449088642637824](https://x.com/natpryce/status/1145449088642637824) · ~385 likes → [article](http://natpryce.com/articles/000819.html)

---

## 4. Contrarian / failure evidence

| Claim / hype | Disconfirming evidence |
|--------------|------------------------|
| “Just use ES everywhere for audit” | Dudycz: CMS/CRUD and supportive modules better as classical state; socio-technical readiness matters ([when not to](https://event-driven.io/en/when_not_to_use_event_sourcing/)). Overeem: steep learning curve + eventual consistency as top hurdles. |
| “Events make debugging easy” | EDA practitioners report multi-service trace hell without schema registry/tooling (@brankopetric00). Fixing bugs *by mutating state* erases evidence—ES helps only if history is clean business events ([Dudycz on fixing bugs](https://event-driven.io/en/fixing-bugs-in-event-sourcing-is-hard/)). |
| “Checkpoints make agents durable” | Restate: coarse checkpoints re-execute parallel work; no fencing; version skew breaks in-flight agents ([2026](https://restate.dev/blog/why-checkpointing-is-not-production-grade-durable-execution)). |
| “JSONL in git is good enough” | spec-kitty lost mission audit on merge; status board diverged from reality ([#569](https://github.com/Priivacy-ai/spec-kitty/issues/569)). |
| “Immutability forever” | Overeem: degrees of immutability; in-place/copy-transform used in industry when pure upcast chains become untenable. GDPR forces crypto-shredding / separate PII streams—not pure immutability. |
| “Replay always safe after deploy” | Temporal nondeterminism errors; DBOS `DBOSUnexpectedStepError` if patches removed early; encrypted histories block CI replay. |
| “CRDT solves multi-agent repo state” | CRDTs resolve concurrent edits, not *authorization* or *evidence binding*; control planes need ordered decisions + human digests more than commutative merges. |
| “Production agents need long autonomous loops” | Production agent study discourse: most systems ≤10 steps, human gates, custom scaffolds—not open-ended ES-style forever workflows (DAIR.AI 2025-12-06 summary of practitioner study). |

---

## 5. Implications for beep-effect packet redesign

Opinionated mappings from evidence → redesign choices:

### 5.1 Control plane = small event-sourced module, not full app ES

- Apply ES **only** to packet lifecycle / gates / approvals / evidence receipts.
- Keep SPEC/PLAN narrative docs as ordinary git files (human-edited); do **not** event-source every prose edit.
- Stored `status: "active"` fields become **projections** of the event fold + approval set—never authoritative.

### 5.2 Event storage: prefer CAS per-event files over single JSONL

Given multi-agent + PR branches:

```
packet/ops/events/
  <eventId>.json          # immutable payload
  HEAD                    # optional ref → tip event id(s)
# each event:
# { id, type, v, ts, parent: digest|null, actor, payload, evidenceDigests[] }
```

- **Parent digest** enables fork detection when two agents append offline (git-like).
- Avoid one `events.jsonl` unless you ship a **union merge driver** on day one (spec-kitty lesson).
- Evidence artifacts: content-addressed; event references digests only (bind commit SHA + artifact hash as proposed).

### 5.3 Schema evolution policy (lock in early)

1. Every event has **`type` + `v`** from day one.  
2. **Additive fields only** in minor versions; consumers must ignore unknowns (weak schema).  
3. Breaking changes → new `v` + **upcaster** in the fold library; never rewrite historical files.  
4. Projector code version recorded in projection snapshots (DBOS-style “version tag”).  
5. CI: fold golden streams through current upcasters (Temporal-style replay tests, tiny).

### 5.4 Readiness = fold(events, approvals), memoized

- Gate results as events (`GatePassed`, `GateFailed`, `ApprovalGranted`).
- `ready_for_code` etc. derived; cache under `ops/projections/readiness.json` with **`sourceTip` digest**.
- Unrelated PRs: if tip digest unchanged and projector version match → **no recompute** (memoized gates).

### 5.5 Risk tiers map to ceremony volume, not different truth models

| Tier | Events | Approvals | Projections |
|------|--------|-----------|-------------|
| **Light** | Minimal lifecycle + evidence digests | Single operator ack optional | On-read fold |
| **Standard** | + gate ledger + symbol/file tree events | Human approval on design gates | Memoized snapshot |
| **Full** | + parent-chain integrity checks, dual review | Externally verifiable attestations | Snapshots + rebuild proofs |

Same schema; skip optional event types at Light—**do not** invent a second status system.

### 5.6 Do not confuse agent session transcripts with packet control events

Claude Code / LangGraph / OpenAI sessions are **local recovery** for a single run. Packet control must survive:

- different machines,
- PR merges,
- human review outside the agent process.

Agent checkpoints may *emit* control events (“RunCheckpointed”) but are not the source of readiness.

### 5.7 Explicit anti-patterns for this repo

1. Dual-writing `manifest.json` status *and* events without “events win.”  
2. Mutable rewrite of event files “to fix a typo.”  
3. Using control events as a chat bus for agent coordination.  
4. Giant global event stream for all packets (keep streams **per packet**, small).  
5. Full Temporal-like determinism ceremony for human-paced gates—overkill; use pure fold of immutable facts instead.

### 5.8 Graduation criteria (research → design)

Design is “ES-ready” when:

- Event type registry + version policy documented in SPEC.  
- Storage layout + merge/fork semantics proven on a dual-branch fixture (reproduce then prevent the spec-kitty failure).  
- Projection functions pure + unit-tested with historical fixtures.  
- Gate memoization keyed by tip digest + projector version.  
- Clear list of what is **not** event-sourced (prose, large binaries, session transcripts).

---

## 6. Full source list

### Empirical / foundational

- Overeem, Spoor, Jansen, Brinkkemper — *An Empirical Characterization of Event Sourced Systems and Their Schema Evolution* — [arXiv:2104.01146](https://arxiv.org/abs/2104.01146) · [JSS DOI](https://doi.org/10.1016/j.jss.2021.110970) · [HTML](https://ar5iv.labs.arxiv.org/html/2104.01146)
- Martin Fowler — Event Sourcing — [martinfowler.com/eaaDev/EventSourcing.html](https://martinfowler.com/eaaDev/EventSourcing.html)
- Nat Pryce — *Mistakes we made adopting event sourcing* — [natpryce.com/articles/000819.html](http://natpryce.com/articles/000819.html)

### Schema evolution, projections, when not to ES

- Oskar Dudycz — Simple events versioning patterns — [event-driven.io/en/simple_events_versioning_patterns/](https://event-driven.io/en/simple_events_versioning_patterns/)
- Oskar Dudycz — When not to use event sourcing — [event-driven.io/en/when_not_to_use_event_sourcing/](https://event-driven.io/en/when_not_to_use_event_sourcing/)
- Oskar Dudycz — Rebuilding event-driven read models — [event-driven.io/en/rebuilding_event_driven_read_models/](https://event-driven.io/en/rebuilding_event_driven_read_models/)
- Oskar Dudycz — Fixing bugs in event sourcing is hard — [event-driven.io/en/fixing-bugs-in-event-sourcing-is-hard/](https://event-driven.io/en/fixing-bugs-in-event-sourcing-is-hard/)
- Artium — Event Sourcing: What is Upcasting? — [artium.ai/insights/event-sourcing-what-is-upcasting-a-deep-dive](https://artium.ai/insights/event-sourcing-what-is-upcasting-a-deep-dive)

### Durable execution / versioning

- Jack Vanlightly — Demystifying Determinism in Durable Execution (2025-11-24) — [jack-vanlightly.com/blog/2025/11/24/demystifying-determinism-in-durable-execution](https://jack-vanlightly.com/blog/2025/11/24/demystifying-determinism-in-durable-execution)
- Temporal — Safely deploying Workflow code — [docs.temporal.io/develop/safe-deployments](https://docs.temporal.io/develop/safe-deployments)
- Temporal — TypeScript Workflow versioning — [docs.temporal.io/develop/typescript/workflows/versioning](https://docs.temporal.io/develop/typescript/workflows/versioning)
- Restate — Solving durable execution’s immutability problem — [restate.dev/blog/solving-durable-executions-immutability-problem/](https://restate.dev/blog/solving-durable-executions-immutability-problem/)
- Restate — Agent checkpointing is far from production-grade resiliency (2026-06) — [restate.dev/blog/why-checkpointing-is-not-production-grade-durable-execution](https://restate.dev/blog/why-checkpointing-is-not-production-grade-durable-execution)
- Restate — Updating AI agents safely — [restate.dev/blog/dealing-with-versioning-in-long-running-agents](https://restate.dev/blog/dealing-with-versioning-in-long-running-agents)
- DBOS — Upgrading workflow code (patching + versioning) — [docs.dbos.dev/typescript/tutorials/upgrading-workflows](https://docs.dbos.dev/typescript/tutorials/upgrading-workflows)
- Chris Riccomini — Durable Execution: Justifying the Bubble — [materializedview.io/p/durable-execution-justifying-the-bubble](https://materializedview.io/p/durable-execution-justifying-the-bubble)

### Agent persistence

- LangGraph persistence — [docs.langchain.com/oss/python/langgraph/persistence](https://docs.langchain.com/oss/python/langgraph/persistence)
- OpenAI Agents SDK Sessions — [openai.github.io/openai-agents-python/sessions/](https://openai.github.io/openai-agents-python/sessions/)
- Claude Code Sessions — [code.claude.com/docs/en/sessions](https://code.claude.com/docs/en/sessions)

### Git / append-only / hash chains

- Git Internals — Git Objects — [git-scm.com/book/en/v2/Git-Internals-Git-Objects](https://git-scm.com/book/en/v2/Git-Internals-Git-Objects)
- NIST — Hash chain glossary — [csrc.nist.gov/glossary/term/hash_chain](https://csrc.nist.gov/glossary/term/hash_chain)
- Priivacy-ai/spec-kitty #569 — git merge driver for `status.events.jsonl` (2026-04) — [github.com/Priivacy-ai/spec-kitty/issues/569](https://github.com/Priivacy-ai/spec-kitty/issues/569)
- Tamper-proof audit logs (hash chains) — [dev.to/robertatkinson3570/the-architecture-behind-tamper-proof-audit-logs-56ek](https://dev.to/robertatkinson3570/the-architecture-behind-tamper-proof-audit-logs-56ek)
- Append-only workflows (personal knowledge systems) — [decoding.io/2023/11/reviewing-append-only-workflows/](https://decoding.io/2023/11/reviewing-append-only-workflows/)

### X posts cited in §3

- https://x.com/tobi/status/2086192833061323111  
- https://x.com/liambai21/status/2086204890599027070  
- https://x.com/brankopetric00/status/2002386544196206600  
- https://x.com/lroal/status/2066781941009953159  
- https://x.com/WooderzJames/status/2050519067597901879  
- https://x.com/vanlightly/status/1992956709023728032  
- https://x.com/boristane/status/2072102551026385104  
- https://x.com/echo_vic/status/2086898217824706957  
- https://x.com/koksing456/status/2085367562611957942  
- https://x.com/natpryce/status/1145449088642637824  
- https://x.com/arpit_bhayani/status/2056946273165656375 (Temporal under the hood / agentic workflows essay pointer)  
- https://x.com/dair_ai/status/1997366943536554368 (production agents study summary)

---

*End of report.*
