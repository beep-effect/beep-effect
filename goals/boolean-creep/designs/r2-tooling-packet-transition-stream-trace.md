# Instance

- id: `r2-tooling-packet-transition-stream-trace`
- file:line: `packages/tooling/tool/cli/src/commands/Goals/PacketCore/PacketTransitionWriter.ts:266`
- symbol: `PacketTransitionPlan`
- members: `streamPresent`, `traceWritten`
- evidence: E4 at `PacketTransitionWriter.ts:542-565` and `:647-683` — a
  streamless plan always commits with no trace write, while a trace write is
  reachable only for skipped or append plans backed by a stream.

# Current shape

The plan already owns `disposition: append | skipped | streamless` but also
stores a redundant `streamPresent` boolean. The resulting outcome repeats the
three-way disposition and adds `traceWritten`. Across the plan/commit aggregate
the two bits describe one transition phase; tests reconstruct the legal
combinations with separate assertions.

# Cardinality gap

The two booleans represent four combinations and only three are reachable:
streamless/no trace, stream-backed/fresh trace, and stream-backed/written
trace. `!streamPresent && traceWritten` cannot occur. The existing disposition
further distinguishes append from skipped work and must not be erased.

# Target schema

Keep the existing `PacketTransitionDisposition` literal on plans and remove
`streamPresent`, since `streamless` is already exact. Define a separate
annotated `PacketTransitionOutcomeDisposition` LiteralKit with
`streamless`, `skipped-fresh`, `skipped-refreshed`, and `appended`. Replace the
outcome's old disposition plus `traceWritten` pair with this one exact literal:
streamless commit selects `streamless`; skipped commit selects `skipped-fresh`
or `skipped-refreshed` from `writeTraceWhenStale`; append selects `appended`.

# Migration inventory

- `PacketTransitionWriter.ts:75-80` — retain the plan disposition owner and add
  the exact outcome disposition owner.
- `PacketTransitionWriter.ts:238-313` — remove plan `streamPresent`, replace
  outcome disposition values, remove `traceWritten`, and update exported JSDoc
  examples.
- `PacketTransitionWriter.ts:529-565` — remove the sealed-plan true projection
  and the streamless false projection.
- `PacketTransitionWriter.ts:633-684` — map the stale-trace result directly to
  the two skipped outcome variants and construct exact streamless/appended
  outcomes.
- `SetStatus.ts:419` — replace the post-commit `outcome.disposition === "skipped"` reader with an exhaustive `PacketTransitionOutcomeDisposition` match that preserves the skipped log for both `skipped-fresh` and `skipped-refreshed`, the append log for `appended`, and existing streamless behavior. The plan disposition read at line 270 remains `skipped` and is a different model.
- `SetRiskTier.ts` consumes plan events/types only; recheck its exhaustive
  behavior but do not add compatibility aliases.
- `test/goals-set-status-stream.test.ts:180-300` — migrate streamless, fresh
  skipped, refreshed skipped, and append assertions to the exact dispositions.
- Recheck the `@beep/repo-cli/test/Goals` barrel and doc examples because these
  decoded models are exported for in-repo tests.

# Guard-deletion accounting

Delete `streamPresent`, `traceWritten`, their constructors and examples, and
the paired test assertions. The plan's existing literal and the outcome's
four-state literal are the sole phase owners; no compatibility boolean getters
remain.

# Encoded-side impact

None outside decoded in-repo TypeScript. Plans and outcomes are transient CLI
service values; event JSONL, trace JSON, packet manifests, Goals index output,
command text, exit behavior, compare-and-set checks, and filesystem writes are
unchanged. The ratification authorizes the atomic in-repo decoded API migration.

# Test impact

Cover streamless, skipped with already-fresh trace, skipped with missing/stale
trace, append, risk-tier override append, and moved-stream refusal. Assert
exact event/trace files and new outcome dispositions, plus schema construction
for every legal literal. Run focused Goals command/packet-core tests and full
`@beep/repo-cli` verification with its changeset policy.

# Risk and sequencing

Land in Tier 1E with the repo-CLI internal-domain batch. Do not collapse
`skipped-refreshed` into `appended`: both write a trace but only the latter
appends events. Preserve the existing CAS check before any skipped trace repair.
