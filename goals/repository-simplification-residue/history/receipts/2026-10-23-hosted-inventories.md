# Hosted cache and recovery inventories — 2026-10-23

Refs #1858. Read-only inventories and one explicitly authorized writer dispatch;
no repository or environment secret was deleted or changed.

## E-11: Cache Warm dispatch

Dispatched `cache-warm.yml` once on `main` with defaults (no R2 probe):
[run 40026178733](https://github.com/beep-effect/beep-effect/actions/runs/40026178733),
event SHA `93ed4b751e9f0d6ea1d453762839877dcbf19c14`,
[job 120662840305](https://github.com/beep-effect/beep-effect/actions/runs/40026178733/job/120662840305).
The environment API reports only `branch_policy` protection for
`turbo-cache-write`; no reviewer approval was requested. The job started,
checked out main, set up the pinned toolchain, and entered “Warm cache and
write receipt”. Outcome at this receipt: **in progress**, not success.
The workflow explicitly checks out `main`; the event SHA alone does not prove
the checkout SHA if main advances before checkout. E-11's successful cold
warming/recovery acceptance remains unqualified until its terminal receipt
and Turbo summaries are read. This is one dispatch, not a retry loop.

## E-16: cache inventory

The paginated GitHub Actions cache API returned 469 cache entries. Their exact
names/keys, with no values or file contents, are retained in the adjacent
`2026-10-23-hosted-cache-inventory.json`. Families include `turbo-Linux-*`,
`playwright-chromium-Linux-*`, and
`v0-rust-professional-desktop-ipc-stdio-Linux-x64-*`.
No cache was deleted. This is the requested inventory; it does not establish
which entries are orphaned or prove cold output restoration.

## E-26: Vercel bindings and recovery sources

Vercel's logged-in project listing was complete (four projects, no next page).
Per-project read-only API queries returned these names and Git bindings:

| Project | Git organization/repository | Production branch |
| --- | --- | --- |
| oip-web | beep-effect/beep-effect | main |
| todox | beep-effect/beep-effect | main |
| oip-web-staging | beep-effect/beep-effect | main |
| luckytay | kriegcloud/luckytay | main |

Binding disposition stays with the existing project owner (`kriegclouds-projects`);
all bindings are preserved. Names-only GitHub secret listings still contain:

- Repository: APP_ENV, APP_LOG_FORMAT, APP_LOG_LEVEL, APP_NAME,
  KNOWLEDGE_MINT_APP_PRIVATE_KEY, NEXT_PUBLIC_ENV, TURBO_READ_TOKEN,
  TURBO_TEAM, TURBO_TOKEN.
- `turbo-cache-write` environment: TURBO_TOKEN.

The retained environment copy is the operational writer recovery source, as
established by successful main deployments in the predecessor
[hosted-probes receipt](https://github.com/beep-effect/beep-effect-goals-archive/blob/main/goals/repository-simplification-confidence/history/receipts/2026-10-22-hosted-probes.md).
GitHub secret names cannot recover their values. No untested 1Password writer
reference is asserted as working, and no value was requested from GitHub.
A separately verified source would be needed to reconstruct a lost environment
copy. This inventory does not itself qualify E-26's full recovery acceptance.

## Left open

The operator deletes only the repository-level TURBO_TOKEN, keeping its
`turbo-cache-write` environment copy. After that, agents repeat E-02/E-14/E-32
writer/PR-boundary probes. E-13 still needs a non-member/non-collaborator fork
witness (or a separately recorded scoped waiver); E-31 awaits all-green main.
Other unrun rows retain their predecessor gates. E-11 is dispatched and pending
terminal outcome. This PR uses Refs #1858 and does not close the umbrella.
Reversal: inventories require no state restoration. Preserve the writer copy,
Vercel bindings and cache entries; rerun read-only inventories when stale.
