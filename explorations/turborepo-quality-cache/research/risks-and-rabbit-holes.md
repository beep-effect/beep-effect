# Risks, Stop Conditions, and Rabbit Holes

## Stop conditions

Stop a research or implementation lane when:

- a cache hit diverges from a fresh run and the cause is unexplained;
- a semantic input cannot be accounted for or a negative test fails to
  invalidate;
- a log, trace, summary, or artifact reveals synthetic sensitive material;
- a reader can write, a bearer can escape its tenant, or unsigned fallback is
  possible in a signed epoch;
- exact stable/canary/backend provenance cannot be reproduced;
- the effective hosted workflow or required-context set is not tied to a
  concrete SHA/ruleset receipt;
- a production write, infrastructure mutation, credential expansion, or
  unbudgeted external cost would be required without graduated authority;
- an adjacent goal's single-writer artifact would be duplicated or overwritten;
- the lab cannot guarantee teardown and cost bounds;
- backend errors remain indistinguishable from ordinary misses.

## High-risk assumptions

### “Cacheable” is a property of a task name

It is a property of a computation, reuse layer, profile, and epoch. A pure
package check and a composite audit wrapper with the same broad label have
different contracts.

### A remote hit proves correctness

It proves only that the client accepted an entry for a hash. Missing semantic
inputs, nondeterminism, stale compiler state, unsafe logs, or wrong environment
profiles can all survive a hit.

### HMAC proves a protected producer

It proves possession of the shared key for the artifact hash/team/body. Readers
also possess that key; protected upload authority and producer receipts remain
separate.

### Turbo's terminal output explains remote health

The cache multiplexer deliberately degrades many remote errors to no artifact.
Direct backend receipts are mandatory.

### Dry-run nodes are executable tasks

Turbo creates configured nodes for missing package scripts. `transit` currently
demonstrates a 142-node dry graph and zero executions.

### Actions cache and Turbo cache are the same proof

The archive only transports `.turbo/cache`. Every entry still needs Turbo's
task-hash and signature acceptance. Archive-key hits must never become quality
verdicts.

### Worktree sharing is automatically portable

Current Turbo shares cache across linked worktrees when `cacheDir` is omitted,
but output bytes can embed the original absolute root. Compiler, source-map,
manifest, and log fixtures must prove the desired envelope.

### Published canary equals upstream `main`

The histories are currently divergent. Stable is production authority, exact
published canary is isolated, and `main@SHA` remains a non-scoring appendix.

### Source parity proves deployed parity

Pulumi and Lambda source establish intent, not the live endpoint, IAM, object
lifecycle, secret revision, or deployment digest. Live checks require separate
read-only authority and sanitized receipts.

## Rabbit holes deliberately deferred

- asymmetric artifact attestation, Sigstore, DSSE, PKI, transparency logs, or
  non-repudiation without a demonstrated consumer requirement;
- a general telemetry platform before stable summaries/events prove the signal
  and redaction contract;
- unbounded comparisons of every community cache server or hosted vendor;
- rewriting the Yeet proof model already owned by `time-to-certainty`;
- reopening completed Ship Velocity decisions instead of refreshing evidence;
- redesigning CI runner placement owned by `ci-lane-economics`;
- caching external verdicts, security/advisory scans, persistent services,
  fixers, or mutating generators as whole tasks;
- a big-bang `turbo.json` cleanup that removes inputs to chase hit rate;
- production benchmarking, test uploads, or credential experiments during the
  exploration stage;
- treating the Vercel `remote-cache` client SDK as an open-source server;
- selecting Bruno or Ducktors because it is newer, Rust-based, widely starred,
  or easier to deploy without passing the frozen hard gates.

## Known topology traps

- API Gateway and synchronous Lambda payload ceilings can invalidate an
  otherwise capable Ducktors application parser.
- Bruno's streaming and OTEL are attractive, but its default global token and
  caller-controlled namespace do not meet Beep's authorization policy.
- Ducktors' signature environment variable is a tag-storage switch, not a
  verifier; giving the backend the key would needlessly widen trust.
- Beep's gateway-to-writer HMAC and Turbo's artifact HMAC solve different
  problems and must not be conflated.
- Secret caches in warm Lambdas complicate in-place rotation; namespace epochs
  avoid pretending dual-key verification exists.
- `check.yml` resolves Heavy from `@main`, so branch-local workflow evidence can
  be illusory.
- runner home/workdir differences have already corrupted other cache restores;
  absolute-path behavior must be partitioned or proven.
- high-cardinality OTLP data can leak paths and create cost/reliability debt
  before it creates insight.

## Evidence freshness

Registry tags, releases, clone heads, live `main`, rulesets, CI definitions,
deployed infrastructure, pricing, and observed artifact distributions all
drift. Refresh them at the start of the implementation goal and again before
backend selection or rollout. Exact hashes in
[`version-manifest.json`](./version-manifest.json) are this research snapshot,
not evergreen facts.
