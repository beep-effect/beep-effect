# Instance

- id: `r2-domains-ontology-graph-worker-requeue-latches`
- file:line: `packages/ontology/client/src/aggregates/Session/Session.atoms.ts:1791`
- symbol: `ontologyGraphWorkerBridgeAtom.requeueLatches`
- members: `lastProjectionRequest`, `requeuedAfterFailure`
- evidence: E4 at `Session.atoms.ts:1905-1918` — the retry marker is set only
  while matching a present last command; `requeued` without a command is
  unreachable. Fresh requests and successful results reset the marker while
  retaining the command.

# Current shape

The worker bridge keeps an optional last projection command beside a boolean
retry latch. A failure first checks the latch and then separately matches the
optional command. Fresh projections write `Some(command)` plus `false`; the
first failure writes `true` and re-dispatches; a second failure is stopped by
the boolean guard. Success resets only the latch, making the retained command
retryable again.

# Cardinality gap

Treating command presence and the retry boolean as two state dimensions gives
four representable combinations and three legal states: `absent`,
`retryable(command)`, and `retried(command)`. `None + true` is illegal.

# Target schema

Introduce a private annotated `OntologyGraphProjectionRetryState` tagged union
with `absent`, `retryable { command: WorkerCommand }`, and
`retried { command: WorkerCommand }`. Keep a single local value of that type.
Fresh graph requests write `retryable`; the first failure atomically changes it
to `retried` before dispatch; `absent` and `retried` do not dispatch. Successful
projection and delta results turn `retried` back into `retryable` with the same
command. Use the union's generated matcher/guards rather than boolean
conditionals.

# Migration inventory

- `Session.atoms.ts` near the worker error schemas — add the three named tagged
  variants and annotated union using the existing `$I` and `WorkerCommand`
  schema owner; keep them private to the bridge module.
- `Session.atoms.ts:1791-1792` — replace only `lastProjectionRequest` plus
  `requeuedAfterFailure` with one `absent` state. Preserve the independent
  `worker` and `previousProjection` locals at lines 1789-1790 unchanged.
- `Session.atoms.ts:1855-1871` — preserve result handling and reset a retried
  command to retryable without fabricating a command for `absent`.
- `Session.atoms.ts:1905-1919` — replace the guard-plus-Option match with one
  exhaustive tagged-state match and atomically advance before dispatch.
- `Session.atoms.ts:1922-1954` — install every fresh command as `retryable` and
  remove the separate latch write.
- `packages/ontology/client/test/Session.atoms.test.ts:152-274` — retain all
  worker replacement/redaction assertions and make the retry-state transitions
  explicit through observable post counts.

# Guard-deletion accounting

Delete `lastProjectionRequest`, `requeuedAfterFailure`, the leading retry
boolean guard, the nested `Option.match`, both success-path boolean resets, and
the paired fresh-request assignments. One tagged match makes
commandless-requeued state unrepresentable.

# Encoded-side impact

None. This state lives inside one mounted client atom. Worker command/result
wire codecs, structured-clone payloads, watchdog timing, redacted errors,
renderer projection state, and RPC contracts remain byte-for-byte unchanged.

# Test impact

Cover absent/no-retry defensively, fresh retryable request, first failure
requeue with the identical encoded command, second failure suppression, new
request budget reset, successful result budget reset, malformed result and
message-error retry behavior, synchronous constructor/send failures, and
finalizer cleanup. Run focused `Session.atoms` and worker-wire tests plus full
`@beep/ontology-client` package verification and its changeset policy.

# Risk and sequencing

Land in Tier 1D with the other ontology UI/client state migrations. Advance to
`retried` before dispatch so a synchronous send failure cannot recurse into a
retry storm. Do not change watchdog ownership or the ontology `/public` barrel.
