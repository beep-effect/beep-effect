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
