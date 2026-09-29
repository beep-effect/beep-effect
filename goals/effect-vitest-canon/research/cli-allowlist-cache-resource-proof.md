# CLI allowlist and cache resource migrations

Both migrations retain all before-change file/title registrations and pass all
seven cases per file under Node and Bun. The cache migration also preserves all
25 normalized assertion expressions and six explicit 15-second body budgets;
the first test retains its default budget. Native Git and Bun subprocesses
remain the tested boundary.

| Suite | Runtime | Before seconds | After seconds | Tests before / after |
| --- | --- | ---: | ---: | ---: |
| Allowlist | Node | 3.7205 | 3.5705 | 7 / 7 |
| Allowlist | Bun | 2.2684 | 1.8169 | 7 / 7 |
| Cache command | Node | 6.5834 | 3.8712 | 7 / 7 |
| Cache command | Bun | 3.7737 | 1.9688 | 7 / 7 |

Durations are whole-command observations, not causal speedup estimates. Runtime
versions, load averages, CPU/memory/IO pressure, resource limits and before/after
source hashes are retained in the private per-runtime context receipts. Full
Yeet proof ran concurrently. No numerical load correction is applied.

The allowlist migration replaces custom Promise/layer/resource wrappers with
instrumented Effect tests and scoped temporary directories. Its full CLI audit
passed in 790.8 seconds and docgen passed in 20.1 seconds before the additional
cache migration was applied.

The cache dashboard control reproduces leftover native directories on failure
and interruption with the old ownership pattern on Node and Bun. Scoped
allocation leaves no residue on success, failure or interruption. The control
removes its own old-pattern residue. Separate Bun controls prove restoration of
present and absent environment values in the same three outcomes. These controls
exercise resource-pattern copies; installed-suite proof is the seven-case
Node/Bun execution reported above.

Six cache EV004 findings retain deliberate shorter scopes with explicit reasons.
Environment restoration must happen after each warm operation and before later
assertions or the second dirty/stale operation. This is the detector's documented
shorter-lifetime exception, not a redundant whole-test scope. The final ratchet
passes with zero introduced findings and 331 resolved historical findings.

The full CLI package proof for the combined changes passed: audit 657.8 seconds
and docgen 19.4 seconds. These package results do not establish final repository
proof, hosted readiness or goal closure.

Private receipt prefixes: `cli-allowlist-resource`, `cli-cache-resource`;
registration parity: `cli-cache-resource-registration-parity.json`;
controls: `cli-cache-resource-control-node.json` and
`cli-cache-resource-control-bun.json`;
ratchet: `cli-cache-resource-final-ratchet.log`.
