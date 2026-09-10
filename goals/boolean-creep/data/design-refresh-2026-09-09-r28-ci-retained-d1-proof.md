# R28 retained CI D1 owner proof

Native P2 source proof for exactly four retained IDs. Frozen HEAD
`93217d998f851e2e93d9864e2b5315552eaa58a7`, main
`d1b4d769fbaffddd55717f3b1ba461897dd545c5`. All four retain their exact current
rows and D1 disposition. No qualified case, withdrawal, metadata replacement,
design or further census is proposed. This is not independent P3.

The existing data audit search found prior anchor retention in
`design-refresh-2026-09-09-main-52fcc8d-impact.md:347-349,446`, but no current
owner-specific proof for these four. The A-C blanket footer is not treated as
that proof. Graft located the actual owner, constructor and consumer graph
first; exact source/fixture reads below close the gap.

Read-only `git diff 8f266b878445ca8a7f751f9248da428a4dde39a1
93217d998f851e2e93d9864e2b5315552eaa58a7 --
packages/tooling/tool/cli/src/commands/Ci/CiLane.ts` shows only health moving
from FALLOW_ADVISORY_LANES to FALLOW_BLOCKING_LANES at1210-1211. It changes
health's execution/error policy, not the four declarations, their constructors,
defaults, Boolean readers or legal combinations. The proof nevertheless reads
their current source and fixtures; it does not infer retention from diff size.

All unqualified source spans below refer to
`packages/tooling/tool/cli/src/commands/Ci/CiLane.ts`.

## Per-owner decisions

| Stable ID | Actual owner and exact selected members | Disposition |
| --- | --- | --- |
| ci-lane-run-options | CiLaneRunOptions619-641: affected, summarize, last, changesetStatus, validateEnvelopes | Retain D1;32/32 Boolean request tuples |
| ci-local-options | CiLocalOptions2326-2331: affected, fast | Retain D1;4/4 Boolean request tuples |
| ci-local-step-plan | CiLocalStepPlan2391-2400: affected, onMainBranch | Retain D1;4/4 resolved fact tuples |
| r25-cli-commands-a-c-ci-lane-run-dry-run-force | CiLaneRunOptions619-641: dryRun, force | Retain D1;4/4 pairs with a valid partition; preserve named invalid-request diagnostics elsewhere |

### CiLaneRunOptions five selected toggles

This is an exported S.Class, explicitly documented as options accepted by
runCiLane at593-616, with real required Boolean fields620-630. It also owns
required base/head/to strings, the four-value DocgenLaneMode literal, optional
from/runs/seed/filter strings, optional partition literal and the separate
dryRun/force Booleans. These are complete payloads/domains, not additional
fabricated Boolean members. No schema refinement makes one selected flag
conditional on another. Only dryRun/force have constructor false defaults635-
636; the five selected fields are required in the schema.

The supported CLI constructor2173-2276 supplies every Boolean independently:
all seven flags default false, mode defaults auto, base origin/main, head/to
HEAD, runs400 and the existing seed constant; optional from/filter/partition
are copied by O.getSomesStruct. The named options object2261 is the actual
carrier, not the Flag descriptors or anonymous handler parameters. Public
make callers are supported and appear in the fixtures, not merely accepted by
a permissive schema. The only internal copying constructor1643 spreads all
options and changes mode after automatic Docgen scope resolution.

Complete reads of the five selected fields separate their roles:

- affected and summarize independently append Turbo arguments650-657;
  affected separately sets the base environment1109/1124/1458/1968 and shapes
  partition selection998/2053. The pair permits all four combinations.
- summarize alone shapes build1312 and labs1410 and partition execution1014.
- last1332 selects commitlint's last-commit versus range command; full from/
  base/to payloads remain available. It imposes no relation to the other flags.
- changesetStatus1465 conditionally appends the repo-sanity check.
- validateEnvelopes1267 and1558 independently appends/runs Fallow validation.

These are documented lane-specific options in one raw lane request, not a
stored claim that every selected lane runs every optional operation. Inactive
options on another lane do not make a malformed state. For example, any of
the32 selected Boolean tuples can be passed through the documented request
constructor to a normal nonpartitioned check lane with fixed valid payloads;
its affected/summarize choices shape the plan and its other lane-specific
options stay inapplicable. Source has no combined-Boolean rejection or hidden
exclusive-state invariant. A subprocess failure is a lane verdict, not a
Boolean-product gap.

Legitimate source fixtures: `test/ci-lane.test.ts:161-179` provides all-false and
affected+summarize requests;1033-1051 checks last/range;1101-1128 checks both
changesetStatus settings;1130-1150 checks both validateEnvelopes settings;
1192-1200 checks summarize false/true. `test/quality-tasks.test.ts:911-966`
constructs real public options with affected+summarize and complete payloads.
Hosted `.github/workflows/check.yml:234-260` separately supplies affected,
summarize and changeset-status. None is evidence that only the fixture's
specific combination is allowed. The independent reads establish the full
request product; no exhaustive32-case execution is claimed.

### CiLocalOptions

The named private type2326-2331 contains two Boolean fields plus required base
string and actual lanes:Option<string>. The public runCiLocal signature2570-
2572 exposes this input contract structurally; the object constructor2627
copies all four fields from independently defaulted CLI flags2605-2628. The
public usage example2556-2561 intentionally uses affected=true, fast=true and
lanes=None. Command help in Ci.command.ts345-346 lists --fast and --affected
as separately selectable options.

parseCiLocalLaneSelection2333-2352 reads lanes, validates any supplied comma-
separated names with a named CiCommandError, then fast removes only coverage,
test-integration and nix. runCiLocal2574-2579 independently carries affected
and the full base to the step plan. Neither selection nor filtering reads
affected. Thus the four combinations mean full/affected scope crossed with
all/fast lane selection; all are legitimate. lanes=None and Some(valid names)
are supported for both fast values; an invalid supplied lane list produces
the documented diagnostic for either value. Do not convert that raw Option
payload or required string into a binary operation-state invariant.

There is no focused full four-case runCiLocal test in the located fixtures.
The actual CLI constructor, public true/true example, orthogonal readers and
step-plan tests establish retention without claiming such a test was run or
exists. No runtime execution was needed for this read-only proof.

### CiLocalStepPlan

The exported S.Class2391-2400 has exactly two required Boolean fields and a
required base string; there are no defaults, Options or hidden input fields.
The live constructor2579 preserves requested affected independently of the
branch equality `branch === "main"`. currentGitBranch2354-2370 reads the branch
through the process service and reports errors; it does not rewrite affected.
Requesting full or affected scope is supported on main and on another branch.

Its sole semantic reader ciLocalLaneFlags2402-2435 uses affected for Turbo/base
and Docgen/Doctest mode shaping, while onMainBranch affects only repo-sanity's
changeset-status flag2428. ciLaneDispatchStep2470-2477 calls it; the local step
array2508-2509 maps it without changing the plan. Public callers and the live
Quality PRE_PUSH_CI_LANE_PLAN at GithubChecks.ts104-108 construct the real schema.
That particular true/false pre-push constant does not restrict the public or
local battery's four-state domain.

Fixtures `test/ci-lane.test.ts:1205-1286` cover false/false, true/false and
false/true with exact argv assertions. true/true is directly supported by the
unconditional live constructor when --affected runs on main and by the two
independent reader paths. `test/quality-tasks.test.ts:879-907` checks the public
plan and shared dispatch contract. No test of true/true is invented here.

### CiLaneRunOptions dryRun/force

Both schema fields635-636 and CLI flags2224-2231 independently default false.
The existing five-field record and this two-field record cover disjoint
Boolean subsets of this same real schema. Retain5+2; neither row claims to
list every field, and no redundant seven-field superset is added.

This owner is a raw request. resolvePartitionedLaneRequest1930-1948 first
validates a supplied partition or emits an exact typed diagnostic if proof-
only flags require one. validatePartitionedLaneRequest1893-1927 additionally
rejects unsupported lanes, filter+partition and a partition belonging to a
different lane. `test/ci-lane.test.ts:517-553` deliberately constructs and
passes these inputs to runCiLane, asserting each named CiLanePartitionError
before repository discovery. These are supported diagnostic requests, not
malformed stored resolved operations. That fact alone is not the D1 proof.

There is a successful-operation witness for every selected pair: fix lint
with a valid lint partition, absent filter and a sound partition proof.

| dryRun | force | Specified result after successful partition proof |
| --- | --- | --- |
| false | false | Execute selected packages with normal Turbo caching |
| false | true | Execute selected packages with --force1013 |
| true | false | Log proof completion and return without task execution2059-2062 |
| true | true | Same successful no-task proof; execution-only force has no task invocation to modify |

There is no dryRun/force mutual-exclusion check. partitionDryRunArgs995-999
does not use force; the explicit dryRun return2059 occurs before constructing
execution arguments2071. This is normal dry-run semantics for an execution
option. The existing row's "accepted, not masked" means the combined request
is not rejected as an illegal tuple; it must not be read as a claim that force
changes the no-task proof or is included in its selection argv.

Fixtures show normal partition execution, forced execution556-575/697-713 and
successful dry-run773-785. No combined true/true fixture was found; the exact
validator and branch ordering prove that fourth behavior without relying on
schema .make permissiveness. Preserve these named diagnostics and all full
partition/filter/lane payloads. No strict successful-operation union is
authorized for this raw request or for the four retained rows.

## Public boundaries, source check and limits

Ci/index.ts26 exports CiLane.ts; package.json29 exposes commands/Ci, and
Ci.command.ts19/340-351 wires both public commands. CiLaneRunOptions and
CiLocalStepPlan are public schemas with ordinary schema encode/decode surfaces;
neither is narrowed by a custom codec. CiLocalOptions remains a named private
type in the exported run function's contract. No consumer treats these owners
as exclusive validated operation state. Public step/argument testing helpers
are real consumers of the same types, and the only cross-module live typed
plan constructor is the inspected Quality constant.

All four current owner anchors and member lists are correct. Source/hash
verification compares the listed repository files byte-for-byte to frozen
HEAD through read-only git show. No canonical/current-design/source/test/
archive/ref/index writes, package commands, services, Grok calls or P3 claims
occurred. Existing finalized audits remain untouched. Graft saved approximately
103,578 tokens in this bounded source check. Parent and the seed attribution
audit may bind this receipt without another source review.

## Exact retained rows and hashes

These are exact current lines, retained without edits; hashes exclude LF.
Final documentation checks passed: all four lines equal live inventory, their
declared symbols match the cited source anchors, and all eight source hashes
match both the working files and frozen HEAD. No product tests were run.

```jsonl
{"schemaVersion":"boolean-creep-inventory/v1","id":"ci-lane-run-options","file":"packages/tooling/tool/cli/src/commands/Ci/CiLane.ts","line":619,"symbol":"CiLaneRunOptions","kind":"schema-struct","members":["affected","summarize","last","changesetStatus","validateEnvelopes"],"status":"disqualified","disqualifier":{"class":"D1","note":"Independent lane-body toggles; mode is already a separate literal."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"ci-local-options","file":"packages/tooling/tool/cli/src/commands/Ci/CiLane.ts","line":2326,"symbol":"CiLocalOptions","kind":"type-literal","members":["affected","fast"],"status":"disqualified","disqualifier":{"class":"D1","note":"Independent local-battery toggles: affected filter vs skip-slow-lanes."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"ci-local-step-plan","file":"packages/tooling/tool/cli/src/commands/Ci/CiLane.ts","line":2391,"symbol":"CiLocalStepPlan","kind":"schema-struct","members":["affected","onMainBranch"],"status":"disqualified","disqualifier":{"class":"D1","note":"Independently observed/requested facts: affected scope vs currently on main."}}
{"schemaVersion":"boolean-creep-inventory/v1","id":"r25-cli-commands-a-c-ci-lane-run-dry-run-force","file":"packages/tooling/tool/cli/src/commands/Ci/CiLane.ts","line":619,"symbol":"CiLaneRunOptions","kind":"schema-struct","members":["dryRun","force"],"status":"disqualified","disqualifier":{"class":"D1","note":"Independent partition-proof vs Turbo-execution knobs; dryRun returns after proving the union while force is only spliced into execution argv. Combined dryRun+force is a dry-run of a force replay and is accepted, not masked."}}
```

| Current ID | SHA-256 |
| --- | --- |
| ci-lane-run-options | `21ce290e776b815c7e68d72a6884be3cdebd91b29b98cb3d75105eef62ab7daa` |
| ci-local-options | `01f9e61ca4436ba63f02af639844ef99919f73fc7926d7b9d9cfea56c96ad29a` |
| ci-local-step-plan | `5bf17d243044359d27a7f7485cb9a832e3d6412adacf7f164a2fd794595c9f3b` |
| r25-cli-commands-a-c-ci-lane-run-dry-run-force | `9d877838f00cc29ca3a376027a90352b34c2fa64dca95398538a2e411ea8a19f` |

| Frozen source/fixture path | SHA-256 |
| --- | --- |
| packages/tooling/tool/cli/src/commands/Ci/CiLane.ts | `b05d95d1317b88a2ea485f7f98cc8a383c2485148bbe42607b96b4c8f574e976` |
| packages/tooling/tool/cli/src/commands/Ci/index.ts | `5f5110eb662565d8b25a9d492072996aa3d3bf350e2718a4ba6570dbe6371869` |
| packages/tooling/tool/cli/src/commands/Ci/Ci.command.ts | `80390bdff19b3d7b68387f14f8099c5ce362c981a7e595ee7d67bceff2d84d7a` |
| packages/tooling/tool/cli/package.json | `afcc48072032175baf36b3a7ea79950d274f1bea5e14aba48c4ff60cba7c9d0c` |
| packages/tooling/tool/cli/src/commands/Quality/internal/GithubChecks.ts | `51e1c88f7852689317b0f13fa72b346b3490af00a25669d3477203b08aa70688` |
| packages/tooling/tool/cli/test/ci-lane.test.ts | `9fc15db647b4bd2436cd1acdb8d12f4faa1e9cebb80c1232d14a9e5eb4cce3c7` |
| packages/tooling/tool/cli/test/quality-tasks.test.ts | `ae4aa0e2a1e4a88eed6e56541ce600679d7397f6763fbb0c89fb5f895cfced84` |
| .github/workflows/check.yml | `9b1f12ed4c724cd66dfd5d0b977331b1e556486521e4e3eb49087dc6345d4493` |
