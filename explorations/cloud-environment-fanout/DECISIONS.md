# Decisions

<!--
Stage 2. The grilling log. One entry per resolved branch-closing question,
newest last. Unresolved questions live in ops/manifest.json `openQuestions`
until they land here. Deferred questions get an entry too, marked DEFERRED
with the reason.
-->

## 2026-10-05 — one bootstrap for every vendor

**Question:** Does each vendor get its own install script, or does one
repo-owned script serve Claude cloud, Codex cloud, and Cursor?

**Answer:** One script, `scripts/cloud/bootstrap.sh`, with vendor detection;
`.cursor/install.sh` becomes a thin caller; every vendor dashboard carries a
single line that invokes it.

**Rationale:** Claude and Codex environments are per account and UI-only, so
eight dashboards hold copies of whatever the repo tells them to paste. Keeping
logic in the dashboards means eight places to edit on every toolchain bump;
keeping it in git means the paste never changes. Rejected: per-vendor scripts
(three copies of the same toolchain contract), and a `.devcontainer` (neither
Claude nor Codex consumes one). Settled during the opening session; the
operator approved starting this work.

## 2026-10-05 — Claude environments first

**Question:** Which fleet is set up first?

**Answer:** The four Claude accounts, then the four Codex accounts.

**Rationale:** Claude's $250 cloud credits expire 2026-11-05, Codex's
2026-11-20; Cursor needs no per-account work.

## 2026-11-02 — first smoke: retry loop alone, no npm-bun fallback

**Question:** Does `bun install` succeed behind the Claude security proxy with
the bootstrap's retry loop alone, or does the first smoke session need the
npm-installed-bun fallback?

**Answer:** The retry loop alone was enough in the runs with public receipts:
the account-1 smoke (#2486, receipt
`goals/cloud-agent-readiness/history/2026-11-01-claude-cloud-smoke.md`) and
the account-2 smoke (#2487, `history/2026-11-01-fleet-cloud-setup.md`) both
completed setup without the npm fallback. The orchestrator reported accounts
3 and 4 as passing on 2026-11-02, but they have no public receipt yet and are
not counted here. The fallback
stays documented in `docs/runbooks/cloud-environments.md`, but no observed run
needed it.

**Rationale:** Settled by passing receipts, not by reasoning. If a future run
needs the fallback, the runbook covers it, and the receipt belongs in the goal
packet.

## 2026-11-02 — Codex lane selection: DEFERRED

**Question:** Which lanes are worth routing to Codex cloud, given that secrets
end at setup and Plus VMs are half-size?

**Answer:** Deferred, because no Codex environment is runnable yet. Setup
checks ran, but publishing the reusable environment failed twice with no
diagnostics. There was no blind retry.

**Rationale:** Choosing lanes for an environment that cannot run work would
be speculation. This reopens in `goals/cloud-agent-readiness` once a Codex
environment publishes and passes a smoke.

## 2026-11-02 — environment id storage: no parallel registry

**Question:** Where do per-account environment ids live for orchestrators:
`.beep/cloud-envs.local.json` or a 1Password item?

**Answer:** Neither is needed for current work. Per-account ids stay in the
existing private handoff and in the CLI defaults. No parallel registry is
created, and nothing is stored in this public repo or queried from 1Password.

**Rationale:** Current lanes launch from the vendor UI or the CLI default
environment. A registry would add a second private store with no consumer.
This reopens only if an orchestrator needs programmatic launch across
accounts.

## 2026-11-02 — parked, superseded by goals/cloud-agent-readiness

**Question:** Does this exploration keep running its own pipeline (align,
shape, decompose, graduate)?

**Answer:** No. Status `parked`, `links.supersededBy:
goals/cloud-agent-readiness`. The work it opened (`scripts/cloud/bootstrap.sh`,
`docs/runbooks/cloud-environments.md`, the guarded hooks) has been executed
under that goal since 2026-11-01 (SPEC D42). This is not a graduation: no
`BRIEF.md` or `MAP.md` was written, and none is retrofitted.

**Reason:** Execution moved to an existing goal of the same lineage. Keeping a
second active queue here would duplicate that goal's residual obligations:
the Codex runnable environment, the Cursor agent proof, the P2 cold-resume
SessionStart timeouts, and P4 doctrine.

**Re-entry:** Reopen at `research` only if cloud environment work leaves the
scope of `goals/cloud-agent-readiness`. One example is a new vendor or a new
fleet pattern that goal does not cover. Record the trigger here first.
