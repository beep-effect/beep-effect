# Mergeability Bottleneck Pulse

## Headline answer

**No candidate can currently be named as the dominant source of merge latency
from hard telemetry.** The strongest current signal is a **diagnosis/attribution
gap at the publish boundary**, not measured diagnosis time: in the retained
post-cutoff cohort (`createdAt >= 2026-07-07T00:00:00Z`), 8 of 58 verdicts
failed, and 7 of those failures were publish-mode outcomes with no lane marked
`failed`. The remaining failure was `monitor:pr-checks:watch`.

Across the full retained fleet history, local proof is the most recurrent
*attributed failure class*: `full:pre-push` accounts for 15 failures, ahead of
`monitor:pr-checks:watch` at 5, `full:review-fix` at 2, and
`publish:git:push` at 1. That establishes recurrence, **not time dominance**.
Yeet has no step-level duration or attempt fields, and live GitHub PR data was
unavailable in this session. Consequently, the evidence cannot separate proof
execution, hosted checks, review churn, rework, diagnosis, and operator absence
by elapsed contribution.

The operational answer for “what dominates now?” is therefore:

1. **Observable failure signal:** unattributed publish failures.
2. **Observable attributed recurrence over retained history:** local pre-push
   proof failures.
3. **Actual elapsed merge latency:** unresolved by current instrumentation.

This report builds on the prior-art distillation rather than reusing its Yeet
baseline and lint-speedup measurements. It also does not treat the known
verdict-hint misattribution as a new finding.

## Scope and artifact coverage

All requested fleet paths existed; none was skipped. The retained artifacts
span `2026-06-11T13:07:31.678Z` through `2026-07-14T04:57:32.052Z` by
`verdict.createdAt`. The full history mixes pre- and post-optimization runs, so
the explicitly defined post-cutoff slice is shown alongside it as the “now”
view. The cutoff is an analytical boundary, not a claimed optimization
completion timestamp.

| Repository | Run directories | `verdict.json` | `state.json` | `status.json` |
|---|---:|---:|---:|---:|
| beep-effect | 31 | 29 | 24 | 16 |
| beep-effect2 | 24 | 24 | 15 | 11 |
| beep-effect3 | 15 | 14 | 11 | 13 |
| beep-effect5 | 11 | 10 | 10 | 7 |
| beep-effect6 | 12 | 11 | 11 | 8 |
| beep-effect7 | 12 | 11 | 7 | 8 |
| beep-effect8 | 17 | 17 | 17 | 5 |
| beep-effect9 | 2 | 2 | 1 | 2 |
| **Fleet** | **124** | **118** | **96** | **70** |

Artifact incompleteness is material: outcome mining uses the 118 verdicts;
proof-tier mining can classify only verdicts that also have state; remote and
closeout snapshots exist for only 70 runs.

## Yeet fleet evidence

### Outcomes

| Cohort | Success | Failure | Total |
|---|---:|---:|---:|
| Full retained verdict history | 76 | 42 | 118 |
| Post-cutoff retained verdicts | 50 | 8 | 58 |

### Failure lanes and phases

Each full-history failure fell into exactly one row below when the explicit
“no failed lane” bucket is included.

| Failure class | Phase | Full history | Post-cutoff |
|---|---|---:|---:|
| No lane marked `failed` | Unattributed | 19 | 7 |
| `full:pre-push` | `full` | 15 | 0 |
| `monitor:pr-checks:watch` | `monitor` | 5 | 1 |
| `full:review-fix` | `full` | 2 | 0 |
| `publish:git:push` | `publish` | 1 | 0 |

The 19 full-history unattributed failures break down structurally as 11
publish, 7 closeout, and 1 verify outcome. All 7 post-cutoff unattributed
failures are publish outcomes. The artifacts contain a free-text verdict
message, but this public report deliberately does not reproduce it; the lane
structure alone does not support a narrower cause assignment.

The full-history failing-phase totals are 17 `full`, 5 `monitor`, and 1
`publish`, plus the 19 unattributed outcomes. Thus the recurring machine-
attributed class is local proof, while the post-cutoff recurring problem is
failure attribution itself.

### Proof tier mix

| Proof tier | Full verdict cohort | Post-cutoff cohort |
|---|---:|---:|
| `full` | 90 | 56 |
| `review-fix` | 3 | 0 |
| No matching `state.json` | 25 | 2 |

The mix shows that nearly all classifiable runs used full proof. It does not
show how long that proof took.

### Hosted-check snapshots available inside Yeet status

Of 70 status files, 43 have `remote.checked == true` and 27 do not. One status
snapshot reports a failing remote check. Three report pending checks, totaling
22 pending checks at those snapshot moments. These are point-in-time counts,
not check durations or check histories. They cannot establish reruns.

### COARSE lifecycle timing

These values are labeled **COARSE** because Yeet does not persist step-level
durations. `state.verifiedAt` can represent previously accepted proof, and file
mtimes can span later monitor/closeout activity or stale artifacts. None of the
rows is a proof-runtime measurement.

| COARSE interval | N | Min s | Median s | P90 s | Max s |
|---|---:|---:|---:|---:|---:|
| `state.verifiedAt` to `verdict.createdAt` | 93 | 0 | 523 | 1977 | 272568 |
| `verdict.createdAt` to verdict file mtime | 118 | -1 | 0 | 0 | 0 |
| Earliest to latest available artifact mtime in a run | 118 | 0 | 586.5 | 9060 | 677296 |

The extreme gaps are evidence that these timestamps cannot be treated as
execution timers. In particular, successful verify-mode runs have a median
verified-to-verdict gap of 0 seconds, while failed verify-mode runs have a
median of 18005 seconds; this is consistent with different timestamp
semantics or stale accepted-proof state, not a credible comparison of proof
speed.

## GitHub PR cycle-time evidence

### Availability result

The requested GitHub lane could not be measured. The configured `gh` account
reported an invalid token, the authenticated request could not connect to
`api.github.com`, and an isolated anonymous `gh` configuration also could not
authenticate. No connected GitHub app tool was exposed in the session.

| Requested measure | Result |
|---|---|
| Create-to-merge median | Unavailable; no PR records returned |
| Create-to-merge P90 | Unavailable; no PR records returned |
| Size-versus-latency relationship | Unavailable; no PR records returned |
| Slowest merged PR cohort | Unavailable; `gh pr view` was not run because no ranked PR list could be obtained |
| Check-failure versus review-churn versus silence classification | Unavailable |
| PRs with visible check reruns in `statusCheckRollup` | Unavailable |

No PR number, title, latency, size, check count, or stall cause is guessed from
local git history. In particular, absence of GitHub data prevents any hard-
telemetry claim that review churn or operator absence dominates merge latency.

## Candidate-cause ranking by evidence strength

This ranks support in the available data, not elapsed-time contribution.

| Rank | Candidate | Evidence assessment |
|---:|---|---|
| 1 | Diagnosis | Strongest current indirect signal: 7 of 8 post-cutoff failures have no failed lane, all at publish. This measures missing attribution, not diagnosis time. |
| 2 | Proof execution | Strong historical recurrence signal: 15 `full:pre-push` failures, the largest attributed class. No post-cutoff failed proof lane and no step durations, so current latency dominance is unproven. |
| 3 | Hosted checks | Direct but smaller recurrence signal: 5 monitor-watch failures over full history and 1 post-cutoff. GitHub check duration and rerun history are unavailable. |
| 4 | Rework | Only 2 explicit `full:review-fix` failures in retained history; commit count, requested-change loops, and rework time are unavailable. |
| 5 | Review churn | No live PR review timeline. It appears in prior reflections/docs only for this pulse. |
| 6 | Operator absence | No live PR activity timeline. COARSE artifact gaps cannot distinguish absence from tool execution or stale state. |

The top rank should not be read as “diagnosis consumed the most minutes.” It
means the current data most strongly demonstrate a diagnosability bottleneck.
The answer to elapsed dominance remains insufficiently instrumented.

## Cross-reference to the AGENTS.md pre-audit taxonomy

| Pre-audit friction theme | Hard telemetry from this pulse | Status |
|---|---|---|
| Quality/Yeet/lint feedback loops | `full:pre-push`, `full:review-fix`, and unattributed Yeet failures recur fleet-wide. | **Corroborated**, for recurrence only. |
| Packet lifecycle and closeout drift | 7 closeout failures have no lane marked failed. The artifacts do not expose paperwork drift or stale packet state. | **Partially corroborated** at the closeout boundary; the documented drift mechanism remains docs-only. |
| Runner/environment/tool-state failures | No retained lane field distinguishes runner, environment, inherited-red, mutation race, or pipe-status causes. | **Not corroborated by these structural fields**; prior reflections/docs only. |
| Discovery, exports, scaffolding, reuse | No Yeet or available PR field attributes time or failures to discovery/scaffolding. | **Prior reflections/docs only.** |
| Agent coordination and handoff | No ownership, handoff, or worktree-coordination event is present. | **Prior reflections/docs only.** |
| Browser/real-engine proof gaps | No browser-proof dimension appears in verdict, state, or status. | **Prior reflections/docs only.** |

This cross-reference uses section B of
`research/2026-07-13-agents-md-preaudit.md` as the taxonomy authority. It does
not re-count that document's reflection findings.

## Exact reproducible commands

All commands were run from
`/home/elpresidank/YeeBois/projects/beep-effect`. The DuckDB file was not
opened.

### Fleet paths and artifact coverage

```zsh
repos=(/home/elpresidank/YeeBois/projects/beep-effect /home/elpresidank/YeeBois/projects/beep-effect{2,3,5,6,7,8,9})
for repo in "${repos[@]}"; do
  { find "$repo/.beep/yeet/runs" -mindepth 1 -maxdepth 1 -type d -printf 'run\n'; find "$repo/.beep/yeet/runs" -mindepth 2 -maxdepth 2 -name verdict.json -type f -printf 'verdict\n'; find "$repo/.beep/yeet/runs" -mindepth 2 -maxdepth 2 -name state.json -type f -printf 'state\n'; find "$repo/.beep/yeet/runs" -mindepth 2 -maxdepth 2 -name status.json -type f -printf 'status\n'; } | jq -Rn --arg repo "${repo:t}" '[inputs] | {repo:$repo,runs:(map(select(.=="run"))|length),verdicts:(map(select(.=="verdict"))|length),states:(map(select(.=="state"))|length),statuses:(map(select(.=="status"))|length)}'
done | jq -s '{repos:length,totals:{runs:(map(.runs)|add),verdicts:(map(.verdicts)|add),states:(map(.states)|add),statuses:(map(.statuses)|add)},by_repo:.}'
```

### Outcomes, failure lanes/phases, and proof tiers

```zsh
runs=(${repos[@]/%//.beep/yeet/runs})
find ${runs[@]} -mindepth 2 -maxdepth 2 -name verdict.json -type f -print0 |
  xargs -0 jq -r '.outcome // "(missing)"' | sort | uniq -c | sort -nr

find ${runs[@]} -mindepth 2 -maxdepth 2 -name verdict.json -type f -print0 |
  xargs -0 jq -r '.lanes[]? | select(.status=="failed") | [.label,.phase] | @tsv' |
  sort | uniq -c | sort -nr

find ${runs[@]} -mindepth 2 -maxdepth 2 -name verdict.json -type f -print0 |
  xargs -0 jq -r '.lanes[]? | select(.status=="failed") | .phase' |
  sort | uniq -c | sort -nr

for v in $(find ${runs[@]} -mindepth 2 -maxdepth 2 -name verdict.json -type f); do
  s=${v%/verdict.json}/state.json
  if [[ -f "$s" ]]; then jq -r '.proofTier // "(missing)"' "$s"; else printf '(no-state)\n'; fi
done | sort | uniq -c | sort -nr

find ${runs[@]} -mindepth 2 -maxdepth 2 -name verdict.json -type f -print0 |
  xargs -0 jq -r 'select(.outcome=="failure" and ([.lanes[]? | select(.status=="failed")]|length)==0) | .mode' |
  sort | uniq -c | sort -nr
```

### Post-cutoff cohort

```zsh
find ${repos[@]/%//.beep/yeet/runs} -mindepth 2 -maxdepth 2 -name verdict.json -type f -print0 |
  xargs -0 jq -s '[.[] | select(.createdAt >= "2026-07-07T00:00:00Z")] | {n:length,outcomes:(group_by(.outcome)|map({outcome:.[0].outcome,n:length})),failed_lane_labels:([.[]|.lanes[]?|select(.status=="failed")|.label]|group_by(.)|map({label:.[0],n:length})),failures_without_failed_lane:([.[]|select(.outcome=="failure" and ([.lanes[]?|select(.status=="failed")]|length)==0)]|length),unattributed_failure_modes:([.[]|select(.outcome=="failure" and ([.lanes[]?|select(.status=="failed")]|length)==0)|.mode]|group_by(.)|map({mode:.[0],n:length}))}'

for v in $(find ${runs[@]} -mindepth 2 -maxdepth 2 -name verdict.json -type f); do
  if [[ $(jq -r '.createdAt >= "2026-07-07T00:00:00Z"' "$v") == true ]]; then
    s=${v%/verdict.json}/state.json
    if [[ -f "$s" ]]; then jq -r '.proofTier//"(missing)"' "$s"; else printf '(no-state)\n'; fi
  fi
done | sort | uniq -c | sort -nr
```

### Remote status snapshots

```zsh
find ${runs[@]} -mindepth 2 -maxdepth 2 -name status.json -type f -print0 |
  xargs -0 jq -s '{files:length,remote_checked:(map(select(.remote.checked==true))|length),remote_unchecked:(map(select(.remote.checked!=true))|length),with_failing_checks:(map(select((.remote.failingCheckCount//0)>0))|length),with_pending_checks:(map(select((.remote.pendingCheckCount//0)>0))|length),failing_check_total:(map(.remote.failingCheckCount//0)|add),pending_check_total:(map(.remote.pendingCheckCount//0)|add),closeout_states:(group_by(.closeout.state//"(missing)")|map({state:(.[0].closeout.state//"(missing)"),n:length}))}'
```

### COARSE timing

```zsh
for v in $(find ${runs[@]} -mindepth 2 -maxdepth 2 -name verdict.json -type f); do
  d=${v:h}; s="$d/state.json"; t="$d/status.json"
  verified=null; [[ -f "$s" ]] && verified=$(jq -c '.verifiedAt // null' "$s")
  created=$(jq -c '.createdAt // null' "$v"); vm=$(stat -c %Y "$v")
  sm=null; tm=null
  [[ -f "$s" ]] && sm=$(stat -c %Y "$s")
  [[ -f "$t" ]] && tm=$(stat -c %Y "$t")
  jq -cn --argjson verified "$verified" --argjson created "$created" --argjson vm "$vm" --argjson sm "$sm" --argjson tm "$tm" '{verified:$verified,created:$created,vm:$vm,sm:$sm,tm:$tm}'
done | jq -s '
  def epoch: if .==null then null else (sub("\\.[0-9]+Z$";"Z") | fromdateiso8601) end;
  def median: sort as $a | ($a|length) as $n | if $n==0 then null elif ($n%2)==1 then $a[($n/2|floor)] else (($a[$n/2-1]+$a[$n/2])/2) end;
  def p90: sort as $a | if ($a|length)==0 then null else $a[(((($a|length)*0.9)|ceil)-1)] end;
  def stats: {n:length,min:min,median:median,p90:p90,max:max,zero:(map(select(.==0))|length),negative:(map(select(.<0))|length)};
  {verified_to_verdict_created: ([.[] | select(.verified!=null and .created!=null) | ((.created|epoch)-(.verified|epoch))] | stats),
   verdict_created_to_verdict_mtime: ([.[] | select(.created!=null) | (.vm-(.created|epoch))] | stats),
   artifact_mtime_span: ([.[] | ([.vm,.sm,.tm]|map(select(.!=null))) as $m | (($m|max)-($m|min))] | stats)}'
```

### GitHub attempts

```zsh
git remote get-url origin
gh auth status
gh pr list --state merged --limit 1000 --json number,title,createdAt,mergedAt,additions,deletions,changedFiles,statusCheckRollup,reviews,reviewDecision | jq '{count:length, first:(sort_by(.mergedAt)|first|{number,createdAt,mergedAt}), last:(sort_by(.mergedAt)|last|{number,createdAt,mergedAt})}'
GH_CONFIG_DIR=/tmp/gh-public-empty env -u GH_TOKEN -u GITHUB_TOKEN gh api repos/beep-effect/beep-effect --jq '{full_name,open_issues_count}'
```

The first GitHub metadata request failed before returning JSON. The anonymous
fallback requested authentication. Therefore no `gh pr view` command was run
for the unavailable slowest-PR cohort.

## Limitations

- Yeet verdicts contain no step duration, elapsed time, retry count, or
  attempt history. Failure frequency cannot be converted into time share.
- Missing state and status artifacts make proof-tier and remote-check coverage
  incomplete.
- `verifiedAt` is not a start timestamp. It can point to accepted proof from a
  different stage of the lifecycle; mtimes are even coarser.
- The retained fleet is not a controlled sample. Repositories contribute
  different numbers of runs, and older artifacts cross optimization epochs.
- A failure outcome without a failed lane is not evidence for any particular
  root cause. It is evidence that structural attribution is missing.
- Status remote counts are snapshots; they do not show check duration,
  historical failures, reruns, or superseded commits.
- GitHub API failure removes create-to-merge latency, size, review, commit,
  activity-gap, and check-history evidence. Review churn and operator absence
  are therefore not testable in this run.
- The requested DuckDB was intentionally not opened because another process
  was writing it.
- No transcript, chat excerpt, commit body, or PR body prose was mined or
  included.

## Instrumentation gaps that would settle this

- Persist per-step `startedAt`, `completedAt`, `durationMs`, `attempt`, and
  stable step identity in every Yeet verdict, including failed and not-run
  steps.
- Persist a structured failure code and causal lane for every failure outcome,
  especially pre-lane publish and closeout failures; keep human hints separate
  from causal attribution.
- Link retries across runs with `priorRunId`, reused-proof identity, and a
  machine-readable reason for proof reuse or invalidation.
- Snapshot hosted-check history by PR, head SHA, check name, attempt, start,
  completion, conclusion, and supersession rather than only current counts.
- Record PR lifecycle events needed for attribution: created, first green,
  review requested, changes requested, new head pushed, approved, mergeable,
  and merged.
- Derive explicit intervals for author/reviewer wait, hosted-check execution,
  local rework, and operator-inactive gaps, with classification rules fixed
  before measurement.
- Add change-size fields and a stable PR/run join key so size-versus-latency and
  local-proof-versus-hosted-wait comparisons do not depend on title or branch
  heuristics.
