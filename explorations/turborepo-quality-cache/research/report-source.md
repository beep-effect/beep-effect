# Turborepo Quality Cache — Deep Research Report

Research date: 2026-09-04. Repository snapshot:
`f56748290df89c5a07743fa7e2c8bc5da1fff51a`. This is the canonical source
report for the exploration; focused machine and design artifacts live beside
it in [`research/`](./).

## Executive conclusion

Beep already has substantial remote-cache and proof-reuse infrastructure, but
it does not yet have a durable answer to “is this computation safe to reuse in
this layer and environment?” Current `cache` flags, archive restores, Turbo
hits, and Yeet proof records represent different contracts. Treating all of
them as one cacheable boolean would create false certainty.

The correct program is therefore not “turn caching on for every quality job.”
It is:

1. enumerate the real computation surface;
2. qualify the lowest pure computations with adversarial evidence;
3. conform and harden the remote-cache transport;
4. add native Turbo artifact verification plus protected producer receipts;
5. make failures and value attributable;
6. adopt qualified reuse without suppressing volatile verdicts or required
   hosted statuses;
7. migrate backends only if a neutral lab proves a material win.

No production Turbo, CI, Yeet, cache, credential, or infrastructure setting was
changed during research. No production cache write or live secret operation was
performed.

## What changed after the pinned refresh

The ratified direction survives, with six important refinements:

1. **The real workspace-script population is 1,503, not 2,840.** Turbo dry-run
   creates a configured node for every requested package/task pair even when a
   package lacks the script. Qualification must join the graph to manifests.
2. **Conformance needs three verdicts.** Strict OpenAPI, exact stable-client
   compatibility, and exact canary-client compatibility can differ.
3. **Turbo hides evidence.** Several remote auth, metadata, signature, and
   transport errors degrade to apparent misses at task level. Direct proxy and
   backend receipts are mandatory.
4. **The incumbent's authorization is stronger than candidate defaults, but
   its artifact trust is incomplete.** Beep separates readers/writers and IAM
   roles, yet native Turbo signing is off and bearer-to-tenant binding is not
   enforced.
5. **The server should not receive the signing key.** Both inspected servers
   can act as opaque tag carriers. Ducktors only enables that carriage behind a
   misleading server environment switch; adapt the carriage instead of
   widening key trust.
6. **Hosted workflow provenance is part of correctness.** The Check workflow
   calls Heavy from `@main`, so a branch-local workflow edit is not proof of
   the definition that ran.

None of these refinements requires reopening the previously ratified packet,
version, backend-neutrality, security, qualification, ownership, or staged
rollout decisions.

## Current version and source authority

The full pin set is in [`version-manifest.json`](./version-manifest.json).

| Surface | Pinned value | Authority |
| --- | --- | --- |
| Beep Turbo | `2.10.12` | Production |
| npm `latest` | `2.10.12` | Confirms production pin |
| npm `canary` | `2.10.13-canary.1` | Isolated experiment only |
| Upstream live `main` | `fd8dc599…` | Non-scoring appendix |
| Remote Cache OpenAPI | blob `4938812…`, SHA-256 `10803145…` | Generated corpus baseline |
| Bruno release | `4.0.17`, commit `6cf8bdd7…` | Candidate lab pin |
| Ducktors release | `2.12.3`, commit `7a8f5c03…` | Candidate lab pin |
| Incumbent shim | Ducktors `2.12.0`, commit `1767fb37…` | Deployed-source baseline |
| Vercel remote SDK | clone `579b2e11…` | Client reference, not server |

The published canary and upstream main histories are divergent, not a linear
“main is the canary plus commits” chain. Targeted remote-cache wire code and
the OpenAPI are currently identical across stable, canary, and inspected main,
but whole binaries still differ. Exact executables—not semantic proximity—are
the lab inputs.

## Turborepo skill and AI-guide audit

The installed [Turborepo skill](../../../.claude/skills/turborepo/SKILL.md)
matches the official `vercel/turborepo/skills/turborepo` tree byte-for-byte at
the inspected source snapshot. Its normalized tree SHA-256 is
`e489455debbc9ab3eaeaea80a4f08a862d9910beec27057ebe9ccca7bf1c16ee`,
and [`skills-lock.json`](../../../skills-lock.json) points to
`vercel/turborepo`, `main`. The one live-main commit beyond the local clone
touches only kitchen-sink example files, not the skill. No skill update is
needed.

The current official AI guide adds several operational discovery practices
that the installed skill already reflects:

- install/sync the official `vercel/turborepo` skill;
- use `turbo docs` for version-aware documentation lookup;
- use AI-friendly `.md` pages, the sitemap, `llms.txt`, and `agents.md`;
- add task `description` fields so humans and agents understand graph intent;
- rely on automatic linked-worktree cache sharing when `cacheDir` is omitted,
  while accounting for absolute paths in restored output bytes.

The appropriate repo change is therefore not a copied skill rewrite. Later
adoption work can add evidence-backed task descriptions and a version-refresh
check while continuing to sync the upstream skill.

## Available stable/canary capabilities worth testing

### Graph and impact analysis

- `turbo query` exposes the package/task graph through GraphQL.
- `turbo query affected` can resolve affected packages/tasks for explicit
  base/head revisions and return a decision exit code.
- `turbo ls` supplies the canonical workspace population.
- run supports `--affected` and task-aware filters; the repo has already
  enabled `affectedUsingTaskInputs` and `filterUsingTasks`.
- graph output and dry JSON can visualize dependencies, but dry nodes must not
  be mistaken for executed computations.

Potential use: generate the qualification projection, warmer candidates, and
changed-scope explanations from one graph source rather than maintaining task
lists in workflows.

### Execution evidence

- `--summarize` emits task hashes and cache outcomes;
- `--dry=json` exposes the planned graph and relevant task metadata;
- `--profile` and `--anon-profile` produce performance traces;
- log ordering, prefixes, output selection, cache modes, force, and remote-only
  controls can build deterministic experiment fixtures;
- stable summaries should remain primary evidence before experimental OTEL.

Potential use: a cache-shadow harness can run fresh/fresh and fresh/hit twins,
normalize output/log receipts, and correlate task hashes with backend wire
results.

### Local/worktree cache behavior

With no explicit `cacheDir`, current Turbo shares the main worktree's cache
with linked worktrees. An explicit relative `.turbo/cache` changes that
behavior. Because output files restore byte-for-byte, path-bearing artifacts
can refer to another root.

Potential use: eliminate redundant computation across agent worktrees only for
computations that pass bidirectional cross-root tests. Partition or exclude
path-bearing compiler artifacts otherwise.

### Future and experimental flags

The exact stable schema includes:

- `affectedUsingTaskInputs` — enabled;
- `filterUsingTasks` — enabled;
- `globalConfiguration` — enabled;
- `errorsOnlyShowHash`;
- `githubActionsRemoteBaseRefFallback`;
- `longerSignatureKey`;
- `strictTaskEntrypointSelection`;
- `watchUsingTaskInputs`;
- `experimentalObservability`;
- experimental Cargo and Python workspaces;
- `pruneIncludesGlobalFiles`.

The likely audit candidates are `longerSignatureKey`,
`strictTaskEntrypointSelection`, `githubActionsRemoteBaseRefFallback`, and
possibly `errorsOnlyShowHash`. Experimental observability remains safety-gated.
Cargo, Python, prune, and watch flags have no demonstrated current need. Test
one relevant flag at a time against stable and canary; do not enable a bundle.

## Beep task-graph audit

The complete compact census is in [`task-census.json`](./task-census.json), and
the interpreted audit is in [`task-census.md`](./task-census.md).

### Current production posture

- explicit cache enabled: 551 workspace scripts across `build`, `lint`,
  `audit`, and `docgen`;
- explicit cache disabled: 575 scripts across fixers, test typecheck,
  integrations, coverage, codegen, persistent services, and Storybook tests;
- cache field omitted: 377 scripts across `check`, `test`, property tests, and
  Storybook build; Turbo's default currently caches them;
- five production child configs alter inputs, outputs, or dependencies.

### Highest-priority correctness questions

1. Do build/audit `.tsbuildinfo`, source maps, framework outputs, or logs embed
   absolute producer roots or runner-class assumptions?
2. Does `audit` cache a composite that includes integrations or other volatile
   behavior that should remain fresh?
3. Are root and child config, generated aliases, test setup, compiler plugin,
   locale/time/random, and wildcard environment inputs complete?
4. Can test/property output and logs be replayed without hiding nondeterminism
   or sensitive material?
5. Is docgen deterministic across clean roots, discovery order, and concurrent
   sessions, and are its writes wholly declared?
6. Can coverage be split into pure isolated shards, deterministic aggregation,
   ratchet comparison, and a fresh hosted verdict?
7. Which integration/browser tasks have hermetic build or fixture prerequisites
   worth caching even though the external verdict remains fresh?

### Configuration opportunities

The future adoption goal should consider, only after qualification:

- making every cache decision explicit instead of inheriting an undocumented
  default;
- replacing broad composite `audit` reuse with lowest-pure-child reuse;
- correcting or localizing inputs before removing global invalidators;
- partitioning path-bearing artifacts by proven environment profile;
- describing each task's contract in `turbo.json`;
- deriving affected computation sets and warmer candidates from the graph;
- including child Turbo configs in adjacent proof/archive epochs where needed;
- retaining `TURBO_FORCE` and fresh external/security verdicts where their
  correctness contract requires execution.

## Quality, CI, and Yeet audit

The source registry contains 25 hosted descriptors: 23 replayable CLI lane IDs
plus two CI-native checks. Requiredness in that registry is not current hosted
authority; it disagrees with the active ruleset account. The active
`ci-lane-economics` packet owns the fresh 18-context and p95 census.

Four existing reuse mechanisms must stay separate:

1. Turbo task results;
2. GitHub Actions transport of `.turbo/cache`;
3. Quality's local whole-tree `LaneProofReuse`;
4. Yeet's exact full-proof state reuse.

An exact-digest fifth mechanism, `ProofLedger`, is substantially authored but
not wired into production lanes. That work belongs to `time-to-certainty`.

The intended composition is:

```text
required hosted job always starts
  -> restore transport pool, if allowed
  -> reuse only qualified pure Turbo prerequisites
  -> execute volatile/external/security verdicts fresh
  -> emit exact-head or merge-ref hosted status
  -> correlate Turbo, backend, Quality, Yeet, and hosted receipts
```

This preserves branch protection and Yeet semantics while still removing
repeated pure computation.

## Remote Cache contract findings

The full contract is in
[`remote-cache-contract.md`](./remote-cache-contract.md), and the reusable
corpus plan is in
[`conformance-corpus-plan.json`](./conformance-corpus-plan.json).

The OpenAPI core is small—status plus single-artifact `HEAD`, `GET`, and `PUT`.
Batch query and events are optional. The published client hardcodes `/v8`,
preserves several optional metadata headers, accepts any successful upload
status, and can hide remote read errors as recomputation. OpenAPI-generated
tests are necessary but insufficient: authorization, tenant isolation,
fail-soft attribution, signing, rotation, concurrency, log safety, payload
ceilings, and rollback need hand-authored cases.

## Artifact integrity and producer trust

The full model is in [`trust-model.md`](./trust-model.md).

Turn on Turbo's native artifact HMAC only as a coordinated, epoch-scoped
rollout with:

- `remoteCache.signature: true`;
- a key meeting the `longerSignatureKey` minimum;
- client-only key distribution to approved readers and protected writers;
- separate read and write bearer credentials;
- opaque server tag preservation;
- credential-to-tenant binding;
- protected workflow producer receipts;
- missing/tampered/wrong-team/corrupted-artifact tests;
- attributable local-only fallback for readers and hard failure for writers;
- an explicit namespace-epoch rotation and rollback plan.

Do not call the incumbent gateway-to-writer HMAC artifact signing. It protects
an invocation path and excludes the query, tenant, body, bytes, and Turbo tag.

## Backend comparison

The frozen rubric is [`backend-rubric.md`](./backend-rubric.md).

### Incumbent

Strengths: separate reader/writer tokens, Lambdas, IAM roles, private encrypted
S3, lifecycle expiry, explicit protected write posture, and existing
operational history.

Gaps: signing/tag transport disabled, tenant selector unbound, synchronous
payload ceiling, heuristic telemetry, possible mixed warm-secret rotation, and
no refreshed live-deployment parity receipt.

### Bruno

Strengths: streaming S3-compatible uploads, opaque tag/duration carriage,
simple Rust service, broad route surface, Docker/Kubernetes/Action options, and
built-in OTLP.

Gaps: one optional global token, no read/write split, caller-controlled tenant,
strict OpenAPI mismatches on optional batch and response statuses, no SHA/dirty
metadata carriage, and unproven log/trace redaction.

### Ducktors 2.12.3

Strengths: familiar incumbent lineage, multiple storage providers, static/JWT
auth modes, authorization-header redaction, and a larger configurable body
parser outside gateway limits.

Gaps: no optional batch, status outside auth upstream, static mode has no
per-token read/write distinction, caller-controlled tenant, tag persistence
behind a misleading key-named switch, no native structured hit/miss telemetry,
and Lambda topology still has a small effective payload ceiling.

### Result

No backend is selected. The incumbent is neither automatically retained nor
discarded. It is the control and “minimal evolved incumbent” is a scored
candidate. Migration exists only if every hard gate passes and the candidate
beats the control by the ratified material-win rule.

## Observability and value

The metrics and rollout design are in
[`observability-and-economics.md`](./observability-and-economics.md).

Build the minimum stable signal chain first: Turbo summaries, direct protocol
receipts, typed backend events, object operations, exact workflow/source facts,
and qualification decisions. Replace apparent-miss and uppercase-substring
heuristics with typed results. OTLP stays disabled until captured payloads pass
redaction, cardinality, cost, queue, and critical-path gates.

Measure value as qualified critical-path seconds saved and reliability/cost
improvement, not raw hits. The active lane-economics goal owns current p95 and
required-context baselines. The warmer should select qualified computations
from observed protected-main demand and a bounded value function instead of a
static task list.

## Creative design opportunities retained from divergence

These are solution candidates for shaping, not implementation authority:

- **Qualification compiler:** generate Turbo/Quality/Yeet policy from one
  schema-validated computation ledger; configuration cannot self-promote.
- **Two-part quality jobs:** a reusable pure evidence producer followed by a
  fresh, cheap verdict/status publisher.
- **Differential cache proxy:** capture stable/canary/server wire behavior and
  label swallowed errors without altering client semantics.
- **Portable-artifact canaries:** seed outputs with known producer roots and
  fail cross-root restore when any forbidden path survives normalization.
- **Cache quarantine:** a typed fault or divergence suspends a computation or
  epoch without disabling unrelated cache populations.
- **Epoch namespaces:** make key/backend/profile/signature rotations observable
  and rollback-safe without pretending native dual-key support.
- **Critical-path warmer:** spend bounded write capacity only where a qualified
  miss is likely to delay a real verification episode.
- **Proof bridge, not proof merger:** correlate Turbo task evidence with
  ProofLedger and hosted status while preserving each authority's semantics.
- **Backend policy adapter:** compare application engines behind the same Beep
  auth/tenant/receipt boundary, so a server's weak defaults do not bias the
  storage/performance comparison.

## Prior opportunities and ownership

[`opportunity-disposition.md`](./opportunity-disposition.md) reconciles the
most relevant Speed Loop, Ship Velocity, Time To Certainty, Lane Economics,
fleet, and prior-art entries. Several old problems are resolved or stale;
several have active owners. The main rules are:

- `time-to-certainty` owns exact-digest proof reuse;
- `ci-lane-economics` owns current timing, required-context, and placement
  evidence;
- the CI operational ontology owns KPI/planner semantics;
- completed Ship Velocity is historical evidence, not active authority;
- this packet owns the prospective task qualification, conformance, trust, and
  adoption decomposition only after alignment.

The complete boundary is in [`ownership-map.md`](./ownership-map.md).

## Architecture placement result

The docs-backed placement grill is recorded in
[`architecture-grill.md`](./architecture-grill.md). Existing homes cover the
first vertical slice without inventing a new public package:

- `@beep/repo-configs/cache` owns pure, reviewed qualification vocabulary and
  its immutable enforcement projection;
- `@beep/repo-cli/commands/Cache` owns cache-specific discovery, experiments,
  transitions, conformance runs, receipts, projection materialization, typed
  errors, services, and renderers;
- Quality enforces, CI renders, and Yeet consumes the result without becoming
  qualification writers or weakening their own proof/status contracts;
- the current infra cache package owns runtime auth, tenant, tag-carriage,
  event, storage, and deployment adaptation;
- generic evidence digests/subjects/receipts may be reused from
  `@beep/skill-contract`, while cache predicates and lifecycle states remain in
  the Cache domain;
- CLI and standalone Lambda surfaces exchange versioned JSON instead of
  importing each other's TypeScript implementation.

A new `tooling/library` or `drivers/*` package is earned only when a stable
contract has at least two independent production consumers that cannot use
these homes cleanly. This keeps extraction available without making it a
speculative prerequisite.

## Recommended graduated program

After user alignment, shape and decompose—not yet create or execute—the
following goals:

### `turborepo-task-qualification`

Materialize the per-computation/per-layer/per-profile ledger, wrappers and
subprocess contracts, must-fail perturbation suite, shadow harness, enforced
projection, and initial qualified cohort. Coordinate digest surfaces with
`time-to-certainty`.

### `turborepo-cache-conformance`

Generate the OpenAPI baseline, implement semantic/adversarial cases, deploy the
bounded disposable AWS lab, run exact stable/canary/backends, emit separate
verdicts, and prove teardown. It may recommend no migration.

### `turborepo-cache-trust-observability`

Implement opaque tag transport, native client signing, 32-byte key enforcement,
tenant binding, credential/epoch policy, protected producer receipts, typed
faults, stable metrics, privacy tests, and rollback controls.

### `turborepo-quality-cache-adoption`

Apply qualified task-graph/input/output/description changes, compose the reuse
layers, preserve fresh verdicts and hosted statuses, derive the warmer, and
roll out local -> named hosted cohort -> broader proven profiles.

### Conditional `turborepo-cache-backend-migration`

Create only when the signed conformance result selects a replacement under the
hard gates and material-win threshold. Execute seven-day soak, seven-day cohort,
fourteen-day observation, and rehearsed incumbent rollback.

## Proposed first vertical slice after shaping

The narrowest end-to-end slice is one pure, high-value task family—likely a
small `lint` or `check` cohort—plus the trust/control plane needed to avoid
false evidence:

1. select a few package computations with simple outputs and no external I/O;
2. materialize their contracts and negative tests;
3. run fresh/fresh and signed fresh/hit twins locally and in one named hosted
   profile against the disposable incumbent replica;
4. capture typed wire receipts and log-safety evidence;
5. keep the hosted job/status fresh;
6. project only those exact qualified tuples into policy;
7. demonstrate suspension by intentionally breaking one declared input;
8. report critical-path and failure-attribution delta, then decide whether to
   expand.

This slice proves the entire safety and evidence loop without combining an
infrastructure migration, broad `turbo.json` rewrite, or all quality lanes.

## Research limits and remaining alignment gate

Static inspection cannot prove live deployment parity, end-to-end signed
behavior, payload/concurrency performance, or redaction. Those are deliberate
lab/implementation deliverables. A sanitized authenticated production status
or body-discarded read may be useful later, but source answered the research
questions without touching production.

The pinned evidence and ownership map preserve the ratified four-goal shaping
basis and conditional migration boundary. The only remaining alignment branch
is code placement: accept the docs-backed existing-homes-first split, with a
new tooling library or Remote Cache driver earned only after a stable contract
has multiple independent consumers, or reserve a new package before that proof
exists. Until that alignment occurs, [`BRIEF.md`](../BRIEF.md) and
[`MAP.md`](../MAP.md) remain intentionally empty of implementation authority.

## Artifact index

- [`version-manifest.json`](./version-manifest.json)
- [`task-census.json`](./task-census.json)
- [`task-census.md`](./task-census.md)
- [`cache-qualification.json`](./cache-qualification.json)
- [`cache-qualification.md`](./cache-qualification.md)
- [`remote-cache-contract.md`](./remote-cache-contract.md)
- [`conformance-corpus-plan.json`](./conformance-corpus-plan.json)
- [`backend-rubric.md`](./backend-rubric.md)
- [`trust-model.md`](./trust-model.md)
- [`observability-and-economics.md`](./observability-and-economics.md)
- [`opportunity-disposition.md`](./opportunity-disposition.md)
- [`ownership-map.md`](./ownership-map.md)
- [`architecture-grill.md`](./architecture-grill.md)
- [`risks-and-rabbit-holes.md`](./risks-and-rabbit-holes.md)
- [`SOURCES.md`](./SOURCES.md)
