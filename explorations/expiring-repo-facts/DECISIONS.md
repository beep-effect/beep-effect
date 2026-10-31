# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-10-31 — unit and schema

**Question:** What is the unit we track, and what schema carries it?

**Answer:** A **hold**: a falsifiable claim with an assertion, a probe, an
exit action and dated evidence. It is a `HoldProposition` inside the
`@beep/epistemics` `makeClaimEnvelope`. `validTime` is the expiry, the
`supersedes` chain is the renewal history (so the renewal count is derived,
not stored) and `supportedBy` holds the probe runs.

**Rationale:** The recommended option. The claim envelope already models
validity intervals, versioning, evidence, validator signals and review state,
so a new schema would re-invent all of it. Rejected: a purpose-built
`HoldRecord` with no epistemics dependency (re-invents validity and
evidence), and a generic "expiring fact" covering reminders and follow-ups
(a wider scope with weaker probes).

## 2026-10-31 — ledger of record

**Question:** Where does the ledger of record live?

**Answer:** In the repo, as append-only files following the `research/`
claims and single-writer ledger pattern, reviewable in PRs. GitHub issues are
a regenerable projection, opened only when a hold escalates. Over time the
ledger replaces the manual
`goals/repository-simplification-residue/history/receipts/hold-register.md`.

**Rationale:** The recommended option. The truth must be schema-checked and
reviewed with the code it governs. Rejected: GitHub issues only (not
schema-checked, not reviewed with the code, API quotas), and a local database
on the box (invisible to PRs, lost with the machine).

## 2026-10-31 — wake service scope

**Question:** How wide should the wake service be?

**Answer:** A general Effect port of skulk: timers, `gh-run`, `pr-checks`,
`npm`, session idle, watch done and custom polls. Holds are its first
producer. `yeet monitor`, `job wait` and orchestrator waits can adopt it
later. Wakes are delivered as messages through the existing
`agent-message-router` delivery store, not through a new queue.

**Rationale:** The recommended option. The repo sleep-polls in many places,
and a holds-only poller would leave all of them as they are. Reusing the
router's transactional store gives the one-wake, no-duplicate guarantee
without a second database. Rejected: a holds-only poller (least code, but
narrow), and installing upstream skulk (delivery is OpenCode-only, so it
would need a fork).

## 2026-10-31 — wave 1 scope

**Question:** What is in scope for wave 1?

**Answer:** Dependency-shaped holds only, about 35 sites: the syncpack held
group, exact catalog pins, overrides, `patchedDependencies` and OSV
exceptions. Test skips and suppressions wait for a later wave.

**Rationale:** The recommended option. These sites already have a manual
register and a scriptable probe (install plus a targeted test or OSV query).
Rejected: adding test skips now (about 40 more anchors and a GritQL rule
before the core loop is proven), and covering every suppression (about 380
sites, which conflicts with the S31 no-inventory-growth ruling).

## 2026-10-31 — launch owner

**Question:** When a hold's wake fires, who decides what runs and on which
provider?

**Answer:** The wake goes first to the live orchestrator session, which
launches the lane under existing doctrine. If no orchestrator is live, a small
dispatcher starts a headless lane down the quota-only fallback chain through
`@beep/ai-provider-cli`. That dispatcher is the first real consumer of the
gated `llm-runtime-dispatch` candidate in
`explorations/multi-provider-llm-dispatch-fallback`.

**Rationale:** The recommended option. The agent-session-bridges Decision Log
(2026-10-09) separates message delivery from launch authority, and AGENTS.md
gives every cross-provider launch decision to the originating orchestrator.
Routing wakes through it keeps that rule. The dispatcher only covers the gap
when no orchestrator is running. Rejected: the dispatcher always launching
(bypasses the orchestrator), and orchestrator-only (nothing runs while no
session is open, which defeats the point).

## 2026-10-31 — renewal gating

**Question:** How is renewing a hold gated?

**Answer:** The woken agent renews by appending a new claim version that
carries today's probe output and the commit SHA. A hard maximum lifetime from
creation (default 180 days) forces escalation to an issue or goal instead of
another renewal. The due-soon state opens at two-thirds of the lease, with
jitter.

**Rationale:** The recommended option. It follows certificates (each renewal
re-proves the fact) and Vault (a hard maximum TTL caps total lifetime even
with renewals). Rejected: evidence only (a hold that keeps reproducing could
live forever without anyone revisiting the decision), and a renewal-count cap
(no surveyed system uses one, and the count says nothing about elapsed time).

## 2026-10-31 — probe trust

**Question:** How much do we trust a probe's verdict before acting on it?

**Answer:** Every scripted probe runs a control at the known-bad version that
must still fail. If the control passes, the verdict is `ProbeBroken`, which
escalates and never unpins. Probes pin their runtime (for example
`vitest --bun`). A verdict flip needs two consecutive passing runs before any
PR opens.

**Rationale:** The recommended option. A probe that has rotted, or that runs
on the wrong runtime, exits 0 and would produce confident wrong unpin PRs. The
jsdom hold fails only under `--bun`. skulk's rule that a failed check is never
a change addresses the same risk. Rejected: a single run (CI on the PR is too
late and too costly as the only safety net), and control only (one flaky pass
still unpins).

## 2026-10-31 — package placement

**Question:** Where do the pieces live in the package topology?

**Answer:** The `HoldProposition` schema and a `beep holds` command group
(admit, probe, why, `lint --write`) go in the repo CLI, `tooling/tool/cli`.
The wake service is a new tooling library created with
`bun run beep create-package`, with a `beep wake` command group, because
`yeet` and orchestrator waits will reuse it.

**Rationale:** The recommended option. Repo operations and automation route to
`tooling` (`standards/architecture/07-non-slice-families.md`). Hold vocabulary
is repo-operational, so it stays out of `foundation/epistemics`, which it
imports from. Rejected: everything inside the repo CLI (the wake service
outgrows a command group), and holds in foundation (repo-operational
vocabulary in a domain-agnostic family).

## 2026-10-31 — Junie and Muse

**Question:** The original request listed Muse and Junie in the fallback
chain, but doctrine makes Muse opt-in only and Junie a volume pool rather than
a fallback step. How does hold work use them?

**Answer:** Follow the doctrine. The fallback chain stays Opus, Codex, Cursor,
grok, and is taken only on quota, availability or unsupported-model failures.
Junie is the preferred first route for bounded hold PRs while
`bun run beep accounts` shows JetBrains credits left. That needs a new Junie
adapter, since `@beep/ai-provider-cli` has none. Muse is used only when a hold
names it.

**Rationale:** The recommended option. It keeps `AGENTS.md` and the
agent-pool runbook unchanged and still spends the underused JetBrains pool.
Rejected: extending the chain with Muse and Junie (needs a doctrine
amendment), and skipping Junie (leaves that pool unspent).

## 2026-10-31 — daemon host

**Question:** Which box runs the wake daemon?

**Answer:** The workstation, as a `systemd --user` service, where the proxy,
the OAuth pools and the Cursor seat live. A small daily GitHub Actions job
opens an issue if the daemon's committed heartbeat goes stale.

**Rationale:** The recommended option. The quota pools the dispatcher spends
are on this box. Rejected: beep-worker (needs every provider credential and
the proxy set up remotely), and both hosts with leader election (more moving
parts than one daemon needs).

## 2026-10-31 — deps:update re-check

**Question:** Should `bun run deps:update` re-check holds itself?

**Answer:** Yes. Before syncpack bumps anything, `deps:update` runs the due
Tier 1 probes for held packages. A hold whose probe flips, with a passing
control and two passing runs, is unpinned in the same commit and tombstoned.

**Rationale:** The recommended option. The re-check rides an operation that
already runs, so most unpins never need an agent. Rejected: leaving
`deps:update` to honor the held list as-is and relying on the wake service
alone.

## 2026-10-31 — first vertical slice

**Question:** What is the first vertical slice?

**Answer:** The jsdom hold, end to end:

- the `HoldProposition` schema;
- a hand-written jsdom record;
- `beep holds probe` running, under `vitest --bun`, a control at the
  known-bad 30.1.0 (must still fail with the recorded `EventTarget`
  signature) and the candidate at npm latest. The pinned 30.0.1 stays as
  installed;
- syncpack's held list derived from the ledger.

No daemon in this slice.

**Rationale:** The recommended option. It proves the schema, the probe-trust
rules and the single source of truth on one real, runtime-sensitive hold
before anything is scheduled. Rejected: the wake service first (it would
schedule a probe that doesn't exist yet), and migrating the register first
(35 records with no working probe).

## 2026-10-31 — shape review

**Question:** Does `BRIEF.md` match the picture in the operator's head? It
proposes two goal packets: holds (schema, ledger, commands, wave 1, the
`deps:update` re-check) and the wake service (skulk port, router delivery,
dispatcher, workstation daemon and dead-man check).

**Answer:** Yes. Decompose into those two goals: holds first with the jsdom
slice, then the wake service. The Junie adapter is a gated follow-on.

**Rationale:** The recommended option. Rejected: splitting the dispatcher and
Junie adapter into a third goal (the dispatcher is small, and
orchestrator-first delivery already covers the common case), and graduating
holds only (the operator's core ask was an agent woken when the event
happens).
