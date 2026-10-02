# Qualification adoption handoff

The [bundle manifest](./adoption/manifest.json) identifies the complete observed
population and the recipes and reviewed sources used to build it. The current
snapshot contains 145 workspaces, 3,498 Turbo graph nodes, 1,984 executable
computations and 1,514 graph-only nodes. Its source checkpoint is the parent
revision recorded in the census; the file hashes bind the observed working-tree
bytes, including the qualification repairs. A later commit name does not renew
this observation automatically.

## Population and semantic boundaries

[population.json](./adoption/population.json) joins every graph node to effective
configuration, graph dependencies and its observed-profile disposition. Shared
configurations are keyed by a canonical JSON SHA-256; each row's
`configurationId` selects its full configuration. Executable rows retain command
text and digest, observed input count and digest, and every semantic profile
reachable through their local script aliases. Graph-only rows have neither a
qualification disposition nor execution profiles.

The [nested graph](./adoption/nested-commands.json) contains 3,364 definitions,
2,170 local-script edges, 1,981 terminal steps and 21 retained shell sites, with
no local alias cycles. The [command inventory](./adoption/command-boundaries.json)
maps every executable root to its reachable boundaries. The
[16 semantic profiles](./adoption/semantic-boundary-profiles.json) describe file,
environment, toolchain/platform, network/time/randomness, output/write, log and
verdict dependencies. Conditional effects remain explicit cohort review inputs.

Command-specific interpretation is retained in three reviews:

- [Shell boundaries](./adoption/shell-boundary-review.json): every retained shell
  site, including discarded diagnostics and shell-dependent control flow.
- [Terminal boundaries](./adoption/terminal-boundary-review.json): all 12 file
  entrypoint sites, six external-tool commands and three Python commands,
  including generator check/write/refresh modes and conditional installation.
- [Dynamic dispatch](./adoption/dynamic-dispatch-review.json): 15 current
  CI/Quality/Yeet branches and nine Cache branch groups covering all 19 Cache
  subcommands, preserving selection, skip, reuse, fresh execution, report writes,
  publication ordering and live status authority.

The raw census retains its two review obligations. The nested graph, semantic
profiles and command-specific reviews supply the population classification
and the bounded Cache/CI/Quality/Yeet interpretation described above. Cache
review separates report/preview operations, authenticated import, locked
transitions and native execution. In particular, restoration-probe success
alone does not assert a cache hit or restored output. This snapshot supplies
static population and dispatch interpretation, not deterministic runtime
closure for every non-pilot command. In particular, selected suites, imported generators,
plugins, external actions and hosted status decisions require evidence for the
cohort that adoption proposes to enable. Planner execution proves selection,
not the selected command's successful execution.

## Qualified pilot and legacy disposition

The ordinary `local-linux-x64-bun1.4.2` / `turbo-task-result` /
`qualification-v2` population has 1,980 unassessed and four excluded executable
tuples. Its 1,259 cache-enabled computations retain legacy configuration status;
their existing settings do not grant qualification. Other layers, profiles and
epochs require their own explicit transitions.

The [signed qualification receipt](./current-signed-qualification.json) records
one real qualified computation in
`local-linux-x64-bun1.4.2-private-loopback-signed-v1`, with operational ledger
revision 8, authenticated acceptance, zero acceptance blockers and zero audit
blockers. Stable and canary native observations are bound to frozen source
`93a19425da0f28d262cfb4b5e9190f137fbbaf58`. This handoff does not relabel them as
evidence for the later working tree. The retained frozen execution sources,
approval and acceptance identities establish their scope.

The private signed-profile ledger remains separate from the public ordinary
profile. Do not copy it over the ordinary baseline or ledger. Rebuilding this
bundle reads those records and cannot provision approval, import evidence,
promote a tuple or enable reuse.

## Reproduce the handoff

From the intended checkout root:

```sh
bun run beep cache census --output .beep/adoption-census.json
python3 goals/turborepo-task-qualification/research/refresh-adoption-handoff.py .beep/adoption-census.json
```

The second command invokes the retained nested-command and boundary recipes,
checks every census source hash, verifies dynamic and terminal review bindings,
and requires exact equality with the reviewed command inventory. New command
text, sites or source changes fail rather than silently inheriting approval.
Renew the affected review before rebuilding after such a change. The manifest
binds all output artifacts and all three recipes.

Input counts and digests are observations of the actual selected file tree.
Build products and ignored files can affect selection according to the effective
configuration; unchanged command text is insufficient to infer identical inputs.
Capture after relevant setup/build activity has settled. Compare content-bound
artifacts when checking reproducibility; a different Git checkpoint remains a
different observation even when the command population is unchanged.

## Adoption procedure and policy API

The pure `@beep/repo-configs/cache` facade owns tuple identity, lifecycle,
evidence requirements and configuration projection. Cache owns discovery,
experiments, authenticated acceptance and single-writer transitions. Quality
consumes the audit. Lane-proof reuse, full Yeet proof and hosted statuses retain
their separate authorities; task reuse cannot substitute for required hosted
proof.

1. Select a computation/layer/profile/epoch from the complete population. Follow
   its nested definitions and all semantic profiles, not only its task name.
2. Decompose composites at their actual boundaries: checks versus fixes, builds
   versus rewrites of prior output, setup versus tests, and local calculations
   versus fresh external verdicts. The population's `adoptionObligations` retains
   the family-specific review needs.
3. Review root and child configuration, source/environment selection, installed
   dependencies, toolchain/linker identity, output trees and logs. Preserve
   conditional network/time/randomness and external verdicts as obligations.
4. Collect fresh candidate and shadow evidence through the Cache experiments,
   independent issuer approval and accepted-import mechanisms. Preserve fresh
   execution as authority until the tuple qualifies. The native pilot supplies
   a validated example, not transferable approval for another computation.
5. Use `cache baseline`, `cache transition --request` with the exact ledger
   revision, and `cache audit`. The CLI validates requests and rejects stale or
   incomplete evidence; never manufacture a disposition by hand-editing records.

Adoption owns broad cohort rollout and final disposition for every in-scope
computation. This goal supplies the mechanism, complete classified population
and validated pilot; it does not activate the other cohorts.

## Invalidation and rollback

Reassess after changes to root/child configuration, selected files or ignore
rules, environment, outputs, persistence, command/dependency identity,
installed toolchain/linker, profile or epoch. Signed source, activation and
exact stable/canary identities remain distinct. A renewed source review or
census does not renew runtime evidence.

Suspend the narrow affected tuple, retain its rejection reason and evidence,
restore the reviewed prior configuration, and keep fresh execution available.
A configuration revert does not prove stale artifacts safe. Shared-cache
deletion is not a substitute for isolated experiment ownership.

## Publication boundary

Final full quality proof, current-head hosted checks and review closure remain
required for this implementation PR. The bundle is an adoption deliverable,
not a merge-ready assertion. Final reflection and lifecycle closeout must land
in the same PR once the acceptance and quality requirements are satisfied.
