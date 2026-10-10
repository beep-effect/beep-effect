# Executed spike lineage and root-artifact review

2026-10-09. Terminal review: **zero actionable findings** on the reviewed final
packet state. This is a local worktree review, not an exact-commit hosted review
or a production qualification.

## Scope

Reviewed the complete packet's claim/state boundaries and prior-packet lineage,
and inspected the root-owned spike result index, Codex and Claude probes and
receipts, the SQLite contract fixture and receipts, and the separately packaged
Codex explicit-policy mitigation. External provider documentation and the
sibling-owned Grok/Cursor/Relay implementations were not independently
revalidated in this review.

## Resolved findings

- The default-policy Codex reproduction formerly contained an unexecuted queue
  leg that omitted policy/isolation overrides and could cause inference before
  its post-queue check on a different installed configuration. That leg was
  removed. Queue reproduction is now confined to the explicit-policy mitigation.
  The original failed restart receipt remains unchanged.
- The README generated status block temporarily said `research` while the
  manifest and trail said `align`. The final block and manifest agree on
  `active` / `align`.

## Evidence checks

- Fleet derivation versus unimplemented delivery, W7 detached-send failures and
  W8 cut, and the scope-specific Buzz/ACP/A2A judgments remain accurately
  represented. Accepted brief and executed spike supersede the old frontier
  without claiming goal graduation.
- Codex idle/active-steer outcomes, Claude idle/queued-followup outcomes,
  cancellation limits and timings match the retained machine receipts.
  Controller-mediated exchange is distinguished from autonomous tools and
  visible app continuity.
- Codex default restart widened the sandbox and stopped before inference.
  Combined explicit server/resume/queue policy mitigation passed separately;
  independent setting sufficiency and Desktop permission continuity remain
  unproved. The architecture now makes effective-policy equality a precondition.
- Contract receipts show 29 passing assertions. Process-crash scope, simulated
  external consumption, lack of ledger fsync and non-production status remain
  explicit. SQLite fixture timings are not presented as end-to-end performance.
- Cursor access, existing apps, autonomous reply tools, production recovery,
  authority integration and full Relay comparison remain open gates. Capability
  priority and both existing/managed modes are preserved.
- No stale global claim that model-message experiments never ran remains.
  Historical interface census is clearly separated from executed receipts.
- Reviewed public files contain no absolute home paths or UUID account/session
  identifiers. Raw logs remain excluded; public results retain outcome evidence.

## Non-model validation performed

Six inspected Python fixtures compiled from source without execution. The root
Codex/Claude model fixtures refused execution without `--run-model-probes`.
Claude handshake, contract and mitigation fixtures refused execution from the
repository before provider launch. Mitigation uses runtime HOME and a cache-only
location guard. These validation calls performed no model generation, external
messaging, provider setup or changes to global configuration.

Only this review receipt was written during terminal review. The mitigation
report/result/source had been packaged earlier within its explicitly assigned
subdirectory. Passing reviews do not qualify the untested production or app
surfaces.
