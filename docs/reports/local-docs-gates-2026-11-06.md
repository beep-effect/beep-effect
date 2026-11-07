# Local report-only cheap-gate qualification

Publication review superseded the original four-lane shortcut. Git cleanliness
and a materialized tracked tree cannot establish the full inputs of the semantic
Effect Vitest and schema-first scanners. Both now remain live. The explicit opt-in
candidate qualifies only regenerated JSDoc and source Effect imports, with an
additional names-only filesystem guard for ignored files and linked ancestors.
Its current-source performance qualification is recorded separately below; the
older four-lane measurements are historical receipts, not acceptance evidence
for this implementation.

## Scope and safety

Only ordinary additions/modifications of nonexecutable `.md` reports under
`docs/reports/` qualify. The two static opt-ins are:

- `quality:jsdoc-ratchet:regenerated`
- `lint:effect-imports`

Every other cheap lane stays live, including Effect Vitest, schema-first,
Markdown fences/imports, retired
laws, schema catalog, observability/catalog checks, goals, changesets, committed
JSDoc comparison, and cache policy. The implementation PR changes source and
therefore takes the ordinary full path; the timing fixtures add only a report
over an already fixed source commit.

The runner uses existing NUL-safe Git status, name-status, and tree readers. It
requires a nonempty merge-base diff, stable resolved/pinned base and HEAD, clean
index/worktree, no nonignored untracked paths, and one shared lane working
directory. Missing/failed Git reads, deletions, renames, unknown statuses, source,
configuration, root Markdown, policy directories, hidden tooling, agent
instructions, MDX, symlinks, and executable/type changes restore normal execution.
Renames are read as deletion plus addition so their source side cannot disappear.
Both committed modes and live file metadata must describe ordinary files.

Eligibility is rechecked before each skip. The existing fresh temporary-index
helper materializes actual tracked contents and must match the captured HEAD
tree. This catches edits hidden by `assume-unchanged` or `skip-worktree`; it never
copies, clears, or refreshes the user's index flags. Tests verify byte-for-byte
index preservation. Final HEAD/base/status fences catch a moved tree, and a
retained generator changing source restores later source-lane execution. The
schema guard uses dotAll plus an exact string suffix: newline directories cannot
conceal hidden segments, and a terminal newline after `.md` is rejected.

A skipped row has status `skipped`, its reason, `inputsCacheable: false`, and no
fabricated pass, reuse, digest, timing, or exit code. It never enters the lane-proof
success list or proof-shadow observations. First-red, precise/imprecise scheduling,
and `not-run-early-stop` accounting retain their meaning. Set
`BEEP_QUALITY_REPORT_ONLY_SKIP=1` to opt into selection. The default, `0`, and
all other values run the complete battery without the selector filesystem guard.
The opt-in can help a cold report-only check but failed warm acceptance below;
it is not recommended as a default performance improvement.

Qualification locks the exact two IDs, selected Turbo task declarations,
their complete dependency structure, and global/future configuration. Each task
must exist, enable caching, and declare explicit nondefault inputs. Unknown edges
or input expansion require renewed review. Five real Turbo report-edit probes
also keep both selected source-task hashes equal, including nested, Unicode, newline,
and fenced-code reports. Strict Markdown root-import failure remains covered.

## Publication safety review

Three adversarial controls invalidated the earlier Git-only identity claim:

- A new test ignored through `.git/info/exclude` left Git status and the fresh
  virtual tree unchanged, while actual Effect Vitest discovery read it and the
  detector emitted major EV001.
- A tracked source symlink into an ignored target, and a tracked source directory
  symlink into an ignored directory, left Git identity unchanged while actual
  scanners consumed the changed sources.
- A tracked test importing an ignored helper outside the discovery roots changed
  between major EV014 and no finding solely as that helper changed. The test
  bytes and Git tree remained identical. Effect Vitest remains live; no parallel
  module resolver was added. Schema-first also uses types and symbols, so its
  execution remains live rather than claiming that source globs cover its inputs.

The selected lanes have narrower observable input behavior. An actual complete
JSDoc inventory control changed an ignored imported helper from missing to a
class with another export; the entire fixed-time inventory stayed byte-identical.
The inventory scores declarations from their own source file and analyzes
re-export declarations syntactically. The actual Effect imports CLI handler
forces `effectOnly: true`, bypassing semantic foundation export mapping. A
qualification test binds that actual call-site option; default scanner options
are not used as evidence for the CLI behavior. A narrow test seal covers the
reviewed scanner/discovery implementations and requires explicit input-closure
review when they change; ordinary application source and workspace membership
are excluded from this seal.

The additional guard queries names through existing discovery helpers and
`Git.checkIgnore`, then inspects matched source/configuration paths and every
lexical ancestor with `lstat`. An ignored input, linked ancestor, nonregular
entry, out-of-root path, failed read, or malformed configuration restores full
execution. Configuration metadata is checked before docgen source-directory
redirection is read. Source names follow directory links where JSDoc does, then
reject relevant links before reading source contents. Benign linked YAML
fixtures outside source roots remain eligible because they contain no matching
source/configuration inputs. Source roots themselves remain checked. No ignored contents or external target file contents are printed or
hashed, and dependency/tool cache trees are not globally inventoried.

Focused controls include ordinary reports, unsafe paths/modes, hidden index
flags, ignored source/configuration, relevant file and directory links, benign
YAML links, retained failures, mixed checkouts, and generator changes. Supported workspace root domains are part of the qualification contract.
Generated seal inputs normalize only compiler-proven literal source paths and
literal workspace manifests that cannot match an accepted Markdown report.
Other inputs, configuration, glob/negation patterns, task settings and dependency
edges stay exact. Normal package/source additions within a supported root no
longer require hand-updating a checksum; unknown roots or report-related inputs
still require review.

The guard obtains workspace configuration from the existing workspace pattern
reader and enumerator. It checks only actual root and declared-workspace scanner
configuration locations, including pnpm's workspace preference and the JSDoc
baseline. Unrelated generated `.oxlintrc.docs.prebuilt.json` and nested build
`package.json` outputs stay outside this metadata set. Regression controls keep
both selected skips with these normal artifacts present while refusing ignored
real package/docgen/tsdoc/tsconfig/pnpm inputs. The final comparison includes the
actual generated prebuilt docs configuration and an ignored build manifest.

## Current two-lane measurement

Pending the matched cold-cache qualification on the reviewed two-lane source.
Acceptance remains **at least 30% and at least 60 seconds**, with exactly two
reasoned skips and **25 equivalent retained outcomes**. Earlier measurements
below cannot satisfy this gate. The current command has 27 actual lanes: the static
catalog plus the dynamic changeset preflight. Historical 26-lane runs also had
the changeset preflight but predated the entity-kit-freeze lane; no retained lane
is omitted from the current comparison.

Before the final representative pair, a test-only inline decoder violation
invalidated one partial baseline and was fixed with the actual root oxlint rule.
A subsequent 27-lane green baseline exposed a harness expectation of 26; its
monotonic wall time had not been written before the assertion, so no elapsed
time was reconstructed. A separately recorded 274.060-second green baseline
used the older metadata guard; its candidate was stopped when review proved that
ordinary generated docs metadata unnecessarily disabled selection. These are
failure-path/control history, not accepted paired performance evidence.

The first completed artifact-present two-lane pair was functionally green but
**rejected on performance**: **258.977 → 201.831 seconds**, saving **57.146 seconds
(22.066%)**, below both declared floors. All 25 retained lanes passed, both skips
had no proof fields, and all 20 → 17 observed Turbo tasks were cold misses. Shared
host load varied; it does not waive the floor or justify repeating that version
for a better result.

That version left 20.036 seconds outside the union of timed candidate lane spans,
versus 0.933 seconds in its baseline. Most was at the initial eligibility edge;
this is not a dedicated guard timer, and overlap hides later guard work. Review
identified repeated per-workspace lstat/checkIgnore calls followed by another
combined check. The distinct revision batches source identity validation once per
eligibility epoch while retaining initial and per-skip revalidation. It also
anchors source globs at literal configured directories. That revision kept the canonical walk because an entry-stat refusal propagated
there while ordinary glob expansion could omit the refused file. Tests cover bracket-containing roots, explicitly configured
node_modules roots, known missing roots, linked roots, and PermissionDenied.
The batched canonical-walk revision was also rejected: **246.557 → 194.671
seconds**, saving **51.886 seconds (21.044%)**. Its three alternating warm pairs
were worse: baseline median **30.384 seconds**, candidate **44.999 seconds**,
a **14.616-second (48.104%) regression**. Baseline selected tasks were genuine
local cache hits. The warm guardrail, declared before those measurements, allows
at most the larger of five seconds and five percent of baseline median. Cold
and warm requirements both apply; warm diagnostics cannot rescue failed cold
qualification.

The final bounded attempt adds an optional strict stat-error policy to the
existing walker and FsUtils glob API. Default callers retain skip behavior.
Opting into `onStatError: "fail"` propagates non-NotFound filesystem errors with
the original typed cause, including errors for listed nonmatching and pruned
entries. The selector uses this policy and removes its duplicate canonical walk;
literal source-directory anchoring, source roots, lexical ancestor checks,
metadata ordering and initial/per-skip identity fences remain. Independent review
found no observed blocker. This distinct source still requires its own cold and
warm qualification before any performance claim or readiness declaration.

Its first baseline was invalidated by four introduced EV014 findings in the new
shared-package tests: test layers lacked explicit hook timeouts. The run was
stopped, its owned process tree terminated, and the four declarations were fixed
without changing production code, scanner inventories or policy floors. That
partial run is excluded from performance evidence.

A separate representative attempt was invalidated by introduced EV006 in a new
test's Option matcher. It was corrected to the canonical assertion on the
original Option; the exact-file detector and full retained Effect Vitest command
then passed without changing any inventory or baseline.

The strict-discovery source `720d6c40d17b8a6796b20117fbe1df7e82231529`
was also rejected as a default-on optimization. Its single cold pair observed
**404.558 → 132.724 seconds** (271.834 seconds, 67.193%), with 25 equivalent
retained passes, two reasoned skips and 20 → 17 cold Turbo tasks. This busy-host
observation is not a generalized speed guarantee: one-minute load rose from
29.48 to 56.75 during baseline and fell to 29.57 during candidate on 64 logical
CPUs; five-minute load also differed materially.

Its three alternating warm pairs produced baseline times 26.623, 27.564 and
25.053 seconds, versus candidate 45.797, 36.919 and 38.049 seconds. The medians
**26.623 → 38.049 seconds** regress by **11.425 seconds (42.914%)**, exceeding
the unchanged five-second allowance. Baseline selected tasks were genuine local
hits. All retained outcomes passed, but this functional proof does not waive the
performance rejection.

Warm wall time outside the union of timed lane spans was 0.978–1.073 seconds
for baseline versus 8.788–9.461 seconds for candidate, almost entirely at the
scheduling edge. This is not a dedicated guard timer. Review found the initial
full filesystem/tree proof only supplied an admission boolean: every actual
skip already performed the entire proof again. A distinct scheduling revision
uses only shared-root/tier/environment admission up front and retains all full
per-skip checks. A generator may restore an initially dirty source to the pinned
tree, but a skip then requires a fresh complete current-state proof. Controls
cover that restoration, later source mutations, mutation between selected
lanes, mixed checkouts, opt-out and failed base reads. Its unchanged cold and warm
qualification is recorded in the following section.

## Final admission-only scheduling qualification: rejected

Source `6de11c811c555e264b51ec0ef5a60abea4f5cb9b`, tree
`82135f19438047313d44c78c3b683dda19b71c25`, was measured with private
report fixture `08459f550d11309730f56c5a995de0e4753aa3ac` (tree
`9838505625893c0fc4378ce171cd5840feadd004`). Its cold pair observed
**258.222 → 149.305 seconds**, saving **108.917 seconds (42.179%)**.
All 27 baseline lanes passed; candidate retained 25 passes with exactly the two
qualified skips. The 20 → 17 Turbo tasks were local misses with no remote cache.
This observed pair passes both cold floors, but variable host load prevents a
generalized speed guarantee.

The first warm launch was interrupted before its first sample completed: no
raw timing or completed outcome existed. Its startup log and ignored-output
state were preserved, the original post-cold candidate state restored, and the
unchanged six-sample harness resumed. No cold pair was repeated. Warm execution
used the prescribed baseline/candidate/candidate/baseline/baseline/candidate
order and preserved separate populated local caches and per-variant outputs.

| Warm sample | Baseline seconds | Candidate seconds |
| --- | ---: | ---: |
| Pair 1 | 42.236 | 61.782 |
| Pair 2, reversed order | 61.268 | 59.357 |
| Pair 3 | 34.099 | 52.863 |
| Median | **42.236** | **59.357** |

The median regression is **17.120 seconds (40.534%)**, exceeding the unchanged
five-second allowance. All retained outcomes passed, selected baseline tasks
were genuine local cache hits in every baseline, and no remote cache was used.
**Default-on performance qualification failed.** The threshold was not changed
and no additional timing run was scheduled after this result.

Wall time outside the union of timed lane spans was 1.172–1.477 seconds for
baseline and 1.168–1.705 seconds for candidate. Thus the prior large scheduling
edge was absent. Several retained lane medians also increased: Fallow audit
17.005 → 19.389 seconds, retired-IRI checks 10.139 → 12.004 seconds, and
retired-path checks 5.746 → 7.503 seconds. These overlapping spans cannot be
summed or used as a dedicated guard timer: skipped receipts intentionally carry
no timing. One-minute host load ranged from 44.02 to 103.25 on 64 logical CPUs;
global admission reported other runs holding tokens. The measurements do not
isolate causal guard overhead, and that uncertainty does not waive rejection.

The published disposition keeps selection **disabled by default**. Only the exact
`BEEP_QUALITY_REPORT_ONLY_SKIP=1` value enables the fully guarded two-lane path;
unset, zero and unknown values execute every lane. This retains the tested
strict-discovery API and an explicit experiment without claiming default gains.
A subsequent main integration disabled caching for several retained discovery
checks. Those changes were not part of source `6de11c811c`; the timing above is
historical evidence for that source, not a performance claim for the integrated
publication head. No additional benchmark was run to obtain a favorable result.

## Method lessons

Measure warm-cache behavior before accepting a skip optimization: a cold scan
saving can hide slower repeated local checks. Run the actual Effect Vitest
detector over changed tests in every touched package before expensive timing.
Keep the runtime lane population and scanner input contracts explicit; static
catalog counts and Git cleanliness alone did not establish either boundary.

## Historical four-lane method and acceptance

The floor was declared before timing: **at least 30% and at least 60 seconds**
saved, with 22 equivalent retained outcomes and exactly four reasoned skips.
The six-run order was disabled/enabled, enabled/disabled, disabled/enabled.
Installation and fixture preparation are excluded; frozen install took 40.52s.
Each sample had a unique empty local Turbo cache. Clone-owned `.beep`, `.turbo`,
and `.fallow` outputs/caches were archived between samples after confirming they
contained no tracked files. No global cache was deleted.

An isolated local clone owned its private `origin/main` and report-only branch;
shared checkout refs were untouched. The pinned base prevented a fetch. Remote
credentials were removed, host defaults disabled, proof reuse off, and the cheap
pool explicitly fixed at four slots. All measured commands used this shape,
with the source SHA matching that experiment's private base:

```sh
env -u TURBO_API -u TURBO_TOKEN -u TURBO_TEAM \
  -u TURBO_REMOTE_CACHE_SIGNATURE_KEY \
  TURBO_CACHE=local:rw TURBO_CACHE_DIR="$sample_cache" \
  BEEP_TURBO_HOST_CACHE_DISABLED=true \
  BEEP_YEET_LANE_PROOF_MODE=off BEEP_YEET_PROOF_BASE="$source_sha" \
  BEEP_QUALITY_CHEAP_GATE_CONCURRENCY=4 \
  BEEP_QUALITY_REPORT_ONLY_SKIP="$selector" \
  TURBO_TELEMETRY_DISABLED=1 TURBO_UI=stream \
  bun --no-env-file run beep quality github-checks cheap-gates
```

For reproduction, clone locally, check out the named source, pin private
`origin/main` to it, add and commit only
`docs/reports/local-docs-benchmark-fixture.md`, verify clean Git status before and
after each sample, and time the whole command with a monotonic clock. Use fresh
cache/output directories for every run. The fixture contains ordinary prose.

## Historical original six-run comparison

Source: `25aea6ec4e61cd00cc901e5f35e985ab43713537`, tree
`0bd2b59e87c49fcc47eb07f09e96d26a02d5ebf1`. Report-only HEAD:
`5e86f23e7257301efb1db8dafcc3e8f86c337d0e`, tree
`631405e12eb47d8498d765570173bba1d2e2b4a2`.

| Sample | Selector | End-to-end seconds |
| --- | --- | ---: |
| 1 | Disabled | 205.388 |
| 2 | Enabled | 53.581 |
| 3 | Enabled | 56.679 |
| 4 | Disabled | 218.818 |
| 5 | Disabled | 293.768 |
| 6 | Enabled | 76.009 |

Medians were **218.818 → 56.679 seconds**, saving **162.140 seconds (74.098%)**.
Every pair independently cleared both thresholds. All six exited zero, with all
22 retained outcomes equivalent and four explicit candidate skips. Raw summaries
show all root tasks as cache `MISS`, local/remote hit flags false, and identical
source-task hashes across all three baselines. No sample invoked a secret session
or enabled remote caching. Component counts were 26 → 22 lane subprocesses and
19 → 14 root Turbo task executions; these are not total OS process counts.

## Historical materialized-source bridge

Adversarial controls subsequently reproduced unsafe skips for hidden-directory
newlines, terminal newlines, and source edits hidden by both Git index flags. The
schema and fresh-tree checks above close those cases. That measured source was
`8fbf67772d7298312d9b677a9a9bb59dee90fb1d`, tree
`d21ceb59abf57a5e3262b903cdc84eec738d7022`. Its report-only HEAD is
`1cfcb96f48b31758d714a80816e05eaadec4a35f`, tree
`ae4970f278f420687a9aa34759361a1d75ec07ec`.

| Historical-source sample | End-to-end seconds |
| --- | ---: |
| Selector disabled | 298.837 |
| Selector enabled | 80.461 |

This separate pair saved **218.376 seconds (73.075%)**, including all fresh-tree
checks, and passed the unchanged 60-second/30-percent floor. Both exited zero,
all 22 retained outcomes matched, and all four skips passed no-proof-field
assertions. Root task executions again fell 19 → 14, all cold misses without local
or remote hits. A separate actual-clone sanity check confirmed materialized-tree
and HEAD-tree equality. That single sanity probe overlapped the baseline; shared
host contention also varied. The later publication controls invalidate its safety acceptance. This pair is
retained as versioned performance history and does not qualify the two-lane guard.

## Historical verification and limits

Thirty-five focused safety/input/consumer tests, the owning package check, and
Fallow health with zero findings passed on that historical runtime. Scoped `docgen:local`
passed for its two selected packages. An earlier full package verification passed lint/audit/docgen. On that historical
runtime, package verification passed lint (2.3s), check, and docgen (50.0s), but
the unit suite had 8,934 passes and one unchanged CI-profile integration case
reported `Error: Test timed out in 30000ms.` The same-head isolated case passed
in about 26.5s (31.94s total), leaving limited headroom below its unchanged 30s
budget. The test and bootstrap script are unchanged from the base. A full
same-population replay used the existing two-worker configuration via three-CPU
affinity, without changing assertions/timeouts; it was stopped when polled past
the ten-minute local-gate cap (682s), with no completed audit receipt. The timeout
is recorded as environment-only, with failure/pass evidence retained. Current-head
package-wide proof remains for hosted verification; these results are not called
a green final full audit. No floor, test population, retained gate, review window, or proof identity
was weakened. The evidence is local on one shared host, not hosted CI or production.

The first attempted baseline at `248d165f67` failed Fallow health because four new
functions/fixtures exceeded existing complexity limits. Its 229.464s receipt is
preserved and excluded. Helper extraction and Match-based fixtures removed the
findings without changing baselines. An intermediate filename-only `a2581ed0df`
pair (354.908 → 83.540s) remains versioned history, not final safety qualification.
The older 251.373s publish observation had an inherited cache-policy failure and
is only a cost lead; parallel lane durations were never summed as wall-time gains.

Retained Fallow digests can vary because its own ignored `.fallow/.gitignore` and
`.fallow/cache/dupes-tokens-v16/.gitignore` enter broad task inputs at different
within-sample times. Exact task IDs, input paths, before/after task hashes and lane
digests are preserved as a potential cache-invalidation lead; no extra gain is
established here. Private receipts retain all raw logs, summaries, cache censuses,
Git identities, failure-path history, and the original predeclared thresholds.
