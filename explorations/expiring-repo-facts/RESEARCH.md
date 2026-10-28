# Research

<!--
Stage 1. Ground the capture in reality. Two halves: what exists outside the
repo (cited), and what exists inside it (so we compose bricks instead of
rebuilding them). Date sections; research goes stale.
-->

Pre-seeded during capture. The packet is still at `capture`; this file holds
the research that ran alongside the capture.

## External Landscape (2026-10-22)

The full cited report is
[`research/prior-art-report-2026-10-22.md`](./research/prior-art-report-2026-10-22.md).
The raw notes from its three research lanes are in
[`research/notes/`](./research/notes/). Summary:

- **No product covers the whole loop.** None records a temporary repo fact in
  a schema-checked store, re-checks it with a probe, wakes an agent at the
  right time, falls back across providers, and lands a PR.
- **Dependency holds have no expiry.** Renovate, Dependabot, syncpack and
  pnpm overrides offer free-text labels at most.
- **Vulnerability ignores do carry expiries, but date-only.** Snyk,
  OSV-Scanner, Trivy and audit-ci all use one record shape (id, scope, reason,
  optional expiry). Snyk treats a malformed date as "never expires".
- **Condition-based expiry is the best prior art.**
  - `@ts-expect-error` errors itself once the error it hides is gone.
  - eslint-plugin-unicorn's `expiring-todo-comments` fires on manifest
    conditions, but it can't resolve `catalog:` references.
  - Rust `todo-or-die` fires when an upstream issue closes or a crates.io
    version appears.
- **Leases to borrow from:**
  - Vault: a renewal counts from now, and a hard maximum TTL caps total
    lifetime even with renewals.
  - cert-manager: renews at two-thirds of the lifetime.
  - ACME ARI (RFC 9773): random jitter inside a renewal window.
  - Certificates are the only renewals that carry evidence (each reissue
    re-validates the domain). `actions/stale` is the anti-pattern: any
    comment resets the clock.
- **gh-aw has the safest PR pipeline but blocks the fallback chain.** Its
  agent job is read-only, a separate detection job runs before any write, and
  PRs are drafts with patch-size caps. Cross-provider fallback chains fail
  compilation.
- **Every vendor scheduler is tied to its vendor.** Claude Code cloud
  scheduled tasks are the only first-party one-shot "run at time T" trigger.
  ACP is now the common protocol across agent CLIs. No orchestrator surveyed
  documents cross-provider quota fallback.
- **Exact-time wakes.** systemd, Temporal, Inngest, Trigger.dev and Restate
  give per-item timers. On one workstation, systemd plus a reconciler is the
  lightest option.

## skulk (2026-10-27)

[kitlangton/skulk](https://github.com/kitlangton/skulk) is MIT, v0.1.0 (last
commit 2026-10-13), about 2.7k lines of plain Bun TypeScript, not Effect. It
was read from the local reference checkout.

- **What it is.** A `systemd --user` or launchd daemon that keeps durable
  watches in SQLite and queues exactly one message into an OpenCode session
  when a watch fires. A watch fires on:
  - a time (`in`, `at`);
  - a built-in event (`gh-run`, `pr-checks`, `npm`, another session going
    idle, another watch finishing, machine capacity);
  - a custom poll (`changes`, `equals`, `matches`, `succeeds`).
- **Guardrails that match this packet's risks:**
  - For value conditions, a non-zero exit, empty output or timeout is a failed
    check, never a change (`src/condition.ts`).
  - `skulk poll` refuses to create a watch whose check fails or whose
    condition already holds.
  - Each watch wakes once. The message ID is stored before posting, so a retry
    can't double-deliver.
  - Hard limits: 14-day maximum deadline, at most 20 open watches, custom
    polls no more often than every 60 seconds, a wake after five consecutive
    failures.
  - Built-in triggers poll adaptively every 10–15 seconds.
  - `SKULK_ALLOW_EXEC=0` disables stored commands. Observed values are quoted
    as data in the wake message.
- **Gaps:**
  - It isn't a ledger: watches are short-lived and live in local SQLite.
  - It has no renewal chain. Multi-step waits are re-armed by the woken
    session.
  - Delivery is OpenCode only, through `opencode api`. `EngineDeps.deliver`
    (`src/engine.ts`) is the swappable delivery hook.
  - It isn't schema-first: `Condition` and `Watch` are plain TypeScript types
    (`src/watch.ts`).
- **What it implies.** skulk solves the wake-and-deliver layer, not the
  ledger. The capability is also wider than holds: repo tooling sleep-polls
  in `yeet monitor`, `job wait`, the review window and orchestrator waits.

## In-Repo Capability Inventory (2026-10-22, re-checked 2026-10-28)

- **Example holds.**
  - `syncpack.config.ts` has a "Held back — do not auto-update" version group,
    with its reasons in prose comments.
  - `statelyai` is pinned exactly in the root `package.json` catalog with no
    reason anywhere.
- **Claim envelope.** `makeClaimEnvelope` in
  `packages/foundation/modeling/epistemics/src/Claim/Claim.model.ts` provides:
  - `validTime` (an interval)
  - `supersedes` (version chains)
  - `supportedBy` (evidence)
  - `signals.validator`
  - `review` state
  - `DependenceAssessment`
- **Research ledger laws.** `research/README.md` defines immutable packets
  with a per-packet `claims.jsonl` and a single-writer `research/ledger/`.
  This is the storage pattern to follow.
- **Timer rendering.** The `Research` command group in
  `packages/tooling/tool/cli/src/commands/Research/` renders the nightly
  research systemd timers. `docs/runbooks/systemd-timers.md` is the runbook.
- **Session ledger.** `packages/tooling/tool/cli/src/commands/Session/` holds
  the workstation session ledger, a JSONL file.
- **Agent pools.** `docs/runbooks/agent-pools.md` and `beep models check`
  hold the provider routes and pins the delivery adapters must follow.
- **Admission.** The `beep-heavy` wrapper and the quality scheduler admission
  tokens are the in-repo counterpart of skulk's capacity slots.
- **Syntactic guards.** `@beep/lint-rules` carries Biome GritQL `.grit` rules.
- **NOT FOUND:**
  - any hold, expiry or re-check ledger;
  - any agent wake service or event-trigger daemon;
  - any provider-agnostic agent launch adapter with quota fallback.

## Constraints Discovered

- The repo is public. Holds and probe output must not carry secrets, home
  paths or client data.
- Probes for Bun-catalog dependencies must resolve `catalog:` themselves.
- Provider fallback is allowed only on confirmed quota, availability or
  unsupported-model failures (`AGENTS.md` volume pools). Never switch provider
  to get a better result.
- Effect v4 and schema-first rules apply to any port of skulk: a LiteralKit
  union for `Condition`, `Context.Service` contracts, and no native
  `Set`/`Map`.
