# Prior Opportunity Disposition

The packet treats historical `OPPORTUNITIES.md` entries as leads, not current
truth. Each item below was reconciled against HEAD before being adopted,
routed, or retired.

| Source opportunity | Current disposition | Owner / packet consequence |
| --- | --- | --- |
| Speed Loop #2: audit churn-prone Turbo inputs and low warm hit rates | **Adopted, reframed.** Correctness and complete invalidation come before hit-rate narrowing. | `turborepo-task-qualification`; use current task census and must-fail perturbations. |
| Speed Loop #12: cross-clone/LAN remote cache | **Partially realized.** Beep now has an AWS remote cache and Turbo automatically shares local cache across linked worktrees when `cacheDir` is omitted. | This packet qualifies cross-root portability and compares backend topology; it does not assume LAN or worktree safety. |
| Speed Loop #21: input-hash proof-carrying CI | **Actively owned elsewhere.** `ProofFact`/`ProofLedger` exist, but production wiring is incomplete. | `time-to-certainty`; this packet consumes digest receipts and must not build a second proof authority. |
| Speed Loop #37: stale plugin diagnostics persisted through `.tsbuildinfo` | **Adopted as a must-fail regression class.** Current build/audit outputs include compiler state. | Qualification must perturb plugin/config inputs and prove no stale cross-machine replay. |
| Speed Loop #41: coverage affected-scoping and cache forensics | **Split.** Timing/scope measurement belongs to lane economics; reuse safety belongs here. | `ci-lane-economics` owns p95/scoping evidence; this packet qualifies pure shards and keeps aggregation/verdict fresh. |
| Speed Loop note that replay is proof, not skipping | **Ratified invariant.** Required jobs still start; only their pure prerequisites may hit. | Applies to adoption and Yeet integration goals. |
| Graphnosis incident: same-repo PRs were cold and should receive read-only cache | **Resolved at HEAD.** Principal workflows now give same-repo PRs remote read-only and forks local-only. | Preserve as a security regression test; do not reimplement. |
| Ship Velocity: Turbo rendered `403` as ordinary misses | **Adopted as a conformance hard gate.** | Direct wire/server receipts must distinguish auth faults from `404`; task logs alone cannot pass. |
| Ship Velocity C7: fallback `.turbo/cache` was never populated | **Historical account is stale.** Check and Heavy now have post-lane saves. | Remaining seam: push Build can still rely on the setup-time pre-lane save, and archive keys omit child Turbo configs. |
| Time To Certainty: dry-run hash exists for a configured task with no package script | **Adopted as census law.** | Executable population comes from workspace manifests; dry nodes are graph data only. |
| Lane Economics: required-context metadata drifted from live ruleset | **Open and owned.** The current source registry again disagrees with the active ruleset account for JSDoc Ratchet. | `ci-lane-economics` owns the fresh ruleset census; this packet never hard-codes requiredness as authority. |
| Lane Economics: lane-proof fixture flaked under load | **Adopted as a determinism fixture, implementation owned elsewhere.** | `time-to-certainty` repairs proof identity; cache qualification requires stable fingerprints under load. |
| Lane Economics: concurrent coverage lanes deleted a shared report directory | **Adopted as a decomposition and concurrency gate.** | Qualify isolated coverage shards only after unique report ownership is proven. |
| Completed Ship Velocity cache report: local/CI setup and warmer findings | **Reference-only and partially superseded.** It predates current Turbo, post-lane saves, dedicated warmer, and current workflow posture. | Reuse its experiment shapes, not its configuration claims or old timing numbers. |

## Newly surfaced opportunities at HEAD

### Resolve reusable workflows by immutable revision during CI changes

`check.yml` invokes Heavy through
`beep-effect/beep-effect/.github/workflows/heavy.yml@main`. A branch-local
`heavy.yml` edit cannot be exercised by that call until it reaches `main`, and
the effective definition can move while a branch is under review. The adoption
goal should either pin/record the resolved workflow SHA for proof or use a safe
branch-test mechanism that cannot be confused with production authority.

### Make task-script presence a first-class projection

Turbo's configured graph and executable script surface are intentionally
different. A durable census command should join `turbo query ls`, task policy,
package scripts, child configs, lane wrappers, and run summaries. That prevents
future “2,840 tasks” reports from overstating the executable population.

### Bind all Turbo configuration sources into proof epochs and archive keys

Five production child configs change effective hashes, while some adjacent
reuse identities mention only root `turbo.json`. The implementation goals
should inventory the exact files Turbo hashed and add must-fail child-config
fixtures before changing either Actions keys or ProofLedger epochs.

### Carry signature tags without sharing the signing key with the server

The incumbent Ducktors shim gates opaque tag persistence on a server-side
environment variable named like the signing key, even though it never performs
HMAC verification. A narrow adapter or upstream patch should preserve supplied
tags unconditionally in signed mode while keeping key material client-only.

### Replace apparent-miss counters with a typed result taxonomy

Current dashboard Lambda counters rely on log substrings and the restoration
probe cannot separate auth, signature, metadata, backend, and genuine-miss
outcomes. The trust/observability goal should emit typed correlated results
before optimizing hit rates.

## Sources

- [`goals/speed-loop/research/OPPORTUNITIES.md`](../../../goals/speed-loop/research/OPPORTUNITIES.md)
- [`goals/time-to-certainty/research/OPPORTUNITIES.md`](../../../goals/time-to-certainty/research/OPPORTUNITIES.md)
- [`goals/ci-lane-economics/research/OPPORTUNITIES.md`](../../../goals/ci-lane-economics/research/OPPORTUNITIES.md)
- [`goals/ship-velocity/research/OPPORTUNITIES.md`](../../../goals/ship-velocity/research/OPPORTUNITIES.md)
- [`goals/ship-velocity/SPEC.md`](../../../goals/ship-velocity/SPEC.md)
- [`explorations/graphnosis-prior-art/research/OPPORTUNITIES.md`](../../graphnosis-prior-art/research/OPPORTUNITIES.md)
