# Goal: ship-velocity

Make the multi-agent pipeline ship correct code faster. Read `goals/ship-velocity/SPEC.md`
(backlog + acceptance criteria) and `goals/ship-velocity/PLAN.md` (order), then implement the
next unfinished item. Evidence and design rationale live in `goals/ship-velocity/research/`.

Five workstreams:

- **A Backpressure**: `yeet monitor --watch` accumulates failure capsules and dispatches
  remediation immediately (no exit-on-first-red, no wait-for-suite-end); the ACK inbox in
  `<checkout>/.beep/inbox/` injects P0 context at active tool boundaries and blocks Stop while a
  P0 is unacknowledged; package-scoped `audit` gates run by every sub-agent immediately after
  touching a package (and emitted by create-package). Operator PR #921 retired the published-PR
  ownership lease, watcher, takeover, and mutation fence before closeout, so no dead harness can
  strand the checkout behind that lease and no automatic takeover is claimed.
- **B Parity**: local green ⇒ 17/17 required remote green. Yeet lanes call `beep ci lane <id>`
  (same argv as CI); coverage runs locally with the baseline pinned from origin/main; missing
  cheap lanes (codegen, commitlint-range, desktop-ipc, base-pinned gitleaks) join default
  verify; `--ci-parity` runs `beep ci local --affected` inside the existing merged preview under
  PR-posture env; per-lane proof reuse lands shadow-first.
- **C Cache**: every checkout reads the AWS Turbo cache (`TURBO_API`/`TOKEN`/`TEAM` +
  `remote:r`; CLI stops forcing local-only); warm = verified main-push writes + `beep cache
  warm` recovery; measure hit rates before tuning keys; fix `vitest.setup.ts` input hole first.
- **D Concurrency**: machine-wide weighted admission leases in XDG_RUNTIME_DIR (5 GiB tokens,
  ~40-48 GiB budget; token weights: full-proof 3, merged-preview 5, review-fix 1×3); queue with visible
  progress; adaptive Check c3/c2; heartbeats + starttime-checked reaping; RSS telemetry before
  raising caps.
- **E Hot files**: publish refuses hand-staged `goals/INDEX.md` and regenerates it; INDEX
  end-state per SPEC E2; derived-only auto-heal allowlist (never baselines/allowlists/
  bun.lock/ATLAS); ATLAS generator (packet-redesign D6); contention families serialize only
  intersecting publishes; path-filtered required checks for `goals/**`-only PRs; stacked-PRs
  (`gh stack`) spike; merge queue only against the recorded flip condition.

Rules: schema-first (Effect v4, LiteralKit, `S.Class`); services via Context.Service; validate
v4 APIs against `.repos/effect`; no webhook tunnel, no cgroup freezing, no blanket turbo c8, no
`merge=union` on hotspots, no claim registry on derived files (all rejected with reasons in
SPEC). Update PLAN checkmarks and the parity ledger as work lands; record friction receipts in
`research/OPPORTUNITIES.md` at the moment it happens. The operator-authorized 2026-08-27
closeout bundles all remaining items into one Yeet-published PR.

Closeout status (2026-09-02): the packet is closed pending merge of the successor final-evidence
PR on branch goals/ship-velocity-cache-auth-evidence. Digest proof retracted the mirror-drift
hypothesis, the helper repaired stale checkout references, and the frozen fleet sample found no
cache authentication failure. A narrow cache-only canary also proved remote reads in the root
whose exact all-file wrapper failed on an unrelated reference. This branch carries the cache
receipt, completed-retained status, and closeout reflection. PR #937 remains historical, not the
final PR; drive the successor to terminal Yeet `merge-ready: yes` before merge.
